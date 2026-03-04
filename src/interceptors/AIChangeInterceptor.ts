import * as vscode from "vscode";
import { InterceptedEvent } from "./types";

const MIN_LINES = 2;
const MIN_CHARS = 50;

type DocState = "idle" | "gating" | "blocked";

export class AIChangeInterceptor {
  private readonly disposables: vscode.Disposable[] = [];

  private isReapplying = false;
  private globalGateOpen = false;

  // Stored so "Try Again" can re-invoke the gate without a new AI change.
  private interceptCallback:
    | ((event: InterceptedEvent) => Promise<boolean>)
    | undefined;

  private readonly docStates = new Map<string, DocState>();
  private readonly checkpoints = new Map<string, string>();

  // Saved AI changes so we can re-apply them after a "Try Again" pass.
  private readonly savedChanges = new Map<
    string,
    Array<{ range: vscode.Range; text: string }>
  >();
  private readonly savedSnippets = new Map<string, string>();

  // Running snapshot updated on every small/human edit.
  private readonly lastSafeContent = new Map<string, string>();

  // ── helpers ──────────────────────────────────────────────────────────────

  private getState(uri: string): DocState {
    return this.docStates.get(uri) ?? "idle";
  }

  private setState(uri: string, state: DocState): void {
    if (state === "idle") {
      this.docStates.delete(uri);
      this.checkpoints.delete(uri);
      this.savedChanges.delete(uri);
      this.savedSnippets.delete(uri);
    } else {
      this.docStates.set(uri, state);
    }
  }

  private async restoreToCheckpoint(uri: vscode.Uri): Promise<void> {
    const checkpoint = this.checkpoints.get(uri.toString());
    if (checkpoint === undefined) return;

    this.isReapplying = true;
    try {
      const doc = vscode.workspace.textDocuments.find(
        (d) => d.uri.toString() === uri.toString(),
      );
      if (!doc || doc.getText() === checkpoint) return;

      const edit = new vscode.WorkspaceEdit();
      const fullRange = new vscode.Range(
        doc.positionAt(0),
        doc.positionAt(doc.getText().length),
      );
      edit.replace(uri, fullRange, checkpoint);
      await vscode.workspace.applyEdit(edit);
    } finally {
      this.isReapplying = false;
    }
  }

  // Re-apply the saved AI changes to the checkpoint document (used after
  // "Try Again" passes — in-memory was restored to checkpoint, so we must
  // put Cursor's changes back explicitly).
  private async reapplySavedChanges(uri: vscode.Uri): Promise<void> {
    const changes = this.savedChanges.get(uri.toString());
    if (!changes || changes.length === 0) return;

    this.isReapplying = true;
    try {
      const edit = new vscode.WorkspaceEdit();
      for (const c of changes) {
        edit.replace(uri, c.range, c.text);
      }
      await vscode.workspace.applyEdit(edit);
    } finally {
      this.isReapplying = false;
    }
  }

  // ── gate runner ────────────────────────────────────────────────────────────
  // Shared by the initial trigger and "Try Again" retries.

  private async runGate(
    uriKey: string,
    changedUri: vscode.Uri,
    snippet: string,
    isRetry: boolean,
  ): Promise<void> {
    this.setState(uriKey, "gating");
    this.globalGateOpen = true;

    const interceptEvent: InterceptedEvent = {
      codeSnippet: snippet,
      source: "document",
      timestamp: Date.now(),
      originalCommand: "onDidChangeTextDocument",
    };

    let approved = false;
    try {
      approved = await this.interceptCallback!(interceptEvent);
    } finally {
      this.globalGateOpen = false;
    }

    if (approved) {
      if (isRetry) {
        // On retry the in-memory doc is at checkpoint — put Cursor's changes back.
        await this.reapplySavedChanges(changedUri);
      }
      // Advance the safe-content snapshot so the approved AI code is the new baseline.
      this.setState(uriKey, "idle");
      const doc = vscode.workspace.textDocuments.find(
        (d) => d.uri.toString() === uriKey,
      );
      if (doc) {
        this.lastSafeContent.set(uriKey, doc.getText());
      }
    } else {
      // Gate failed or cancelled — revert in-memory to checkpoint.
      await this.restoreToCheckpoint(changedUri);
      this.setState(uriKey, "blocked");
      vscode.window
        .showWarningMessage(
          "VibeCheck: Changes blocked — explain the code to apply it.",
          "Try Again",
        )
        .then((choice) => {
          if (choice === "Try Again") {
            const savedSnippet = this.savedSnippets.get(uriKey) ?? snippet;
            // Restore checkpoint entry (setState "idle" would delete it)
            const checkpoint = this.checkpoints.get(uriKey);
            const changes = this.savedChanges.get(uriKey);
            const snip = this.savedSnippets.get(uriKey);
            this.setState(uriKey, "idle"); // clears state maps
            // Restore before re-gating
            if (checkpoint !== undefined)
              this.checkpoints.set(uriKey, checkpoint);
            if (changes !== undefined) this.savedChanges.set(uriKey, changes);
            if (snip !== undefined) this.savedSnippets.set(uriKey, snip);

            this.runGate(uriKey, changedUri, savedSnippet, true).catch((err) =>
              console.error("VibeCheck retry gate error:", err),
            );
          }
        });
    }
  }

  // ── main listeners ────────────────────────────────────────────────────────

  activate(onIntercept: (event: InterceptedEvent) => Promise<boolean>): void {
    this.interceptCallback = onIntercept;

    // Seed snapshots for all documents already open.
    for (const doc of vscode.workspace.textDocuments) {
      this.lastSafeContent.set(doc.uri.toString(), doc.getText());
    }
    this.disposables.push(
      vscode.workspace.onDidOpenTextDocument((doc) => {
        if (!this.lastSafeContent.has(doc.uri.toString())) {
          this.lastSafeContent.set(doc.uri.toString(), doc.getText());
        }
      }),
    );

    // ── Listener 1: detect AI changes ──────────────────────────────────────
    this.disposables.push(
      vscode.workspace.onDidChangeTextDocument(async (event) => {
        if (this.isReapplying) return;
        if (event.contentChanges.length === 0) return;

        const uriKey = event.document.uri.toString();
        const state = this.getState(uriKey);

        // While gate is active ignore further writes — saves are blocked anyway.
        if (state !== "idle") return;

        const largeChange = event.contentChanges.find(
          (c) =>
            c.text.split("\n").length >= MIN_LINES ||
            c.text.length >= MIN_CHARS,
        );

        if (!largeChange) {
          this.lastSafeContent.set(uriKey, event.document.getText());
          return;
        }

        const checkpoint = this.lastSafeContent.get(uriKey) ?? "";

        if (this.globalGateOpen) {
          this.checkpoints.set(uriKey, checkpoint);
          this.setState(uriKey, "blocked");
          return;
        }

        // ── Enter gating ─────────────────────────────────────────────────
        const snippet = event.contentChanges
          .map((c) => c.text)
          .join("\n")
          .slice(0, 4000);

        this.checkpoints.set(uriKey, checkpoint);
        this.savedChanges.set(
          uriKey,
          event.contentChanges.map((c) => ({ range: c.range, text: c.text })),
        );
        this.savedSnippets.set(uriKey, snippet);

        await this.runGate(uriKey, event.document.uri, snippet, false);
      }),
    );

    // ── Listener 2: block saves while gate is active ────────────────────
    this.disposables.push(
      vscode.workspace.onWillSaveTextDocument((event) => {
        const uriKey = event.document.uri.toString();
        const state = this.getState(uriKey);
        if (state === "idle") return;

        const checkpoint = this.checkpoints.get(uriKey);
        if (checkpoint === undefined) return;

        const doc = event.document;
        if (doc.getText() === checkpoint) return;

        const fullRange = new vscode.Range(
          doc.positionAt(0),
          doc.positionAt(doc.getText().length),
        );
        // Notify BEFORE waitUntil — synchronous call renders reliably.
        vscode.window.showWarningMessage(
          "VibeCheck: Edit reverted — explain the code in the gate panel to apply it.",
        );

        event.waitUntil(
          Promise.resolve([new vscode.TextEdit(fullRange, checkpoint)]),
        );
      }),
    );
  }

  deactivate(): void {
    for (const d of this.disposables) d.dispose();
    this.disposables.length = 0;
    this.interceptCallback = undefined;
    this.docStates.clear();
    this.checkpoints.clear();
    this.savedChanges.clear();
    this.savedSnippets.clear();
    this.lastSafeContent.clear();
    this.globalGateOpen = false;
  }
}
