import * as vscode from "vscode";
import { InterceptedEvent } from "./types";

// ── Detection thresholds ──────────────────────────────────────────────────────
// BUG OBSERVED (v1): The original approach tried to detect AI vs. human edits
// via clipboard-paste events and intercepted command IDs. This was unreliable
// because Cursor's agent uses VS Code's WorkspaceEdit API internally, which is
// indistinguishable from any other programmatic edit at the command level.
// FIX: Size-based heuristics. Humans rarely produce ≥2 lines or ≥50 chars in a
// single atomic edit; Cursor's AI always does when applying a meaningful change.
const MIN_LINES = 2;
const MIN_CHARS = 50;

type DocState = "idle" | "gating" | "blocked";

export class AIChangeInterceptor {
  private readonly disposables: vscode.Disposable[] = [];

  // BUG OBSERVED (v2): When restoreToCheckpoint called workspace.applyEdit, the
  // resulting onDidChangeTextDocument event re-triggered the gate detector, causing
  // an immediate second gate to open on the checkpoint content itself.
  // FIX: isReapplying flag suppresses our own programmatic edits in Listener 1.
  private isReapplying = false;

  // BUG OBSERVED (v3): Cursor's agent writes multiple files simultaneously. Without
  // a guard, the second file's change event arrived while the first gate panel was
  // still opening, causing two concurrent WebView panels to open and the state
  // machine to enter an unrecoverable mixed state.
  // FIX: globalGateOpen prevents concurrent gates. While any gate is open,
  // additional large AI writes transition directly to "blocked" (save-intercepted
  // only) rather than opening a second gate panel.
  private globalGateOpen = false;

  // Stored so "Try Again" can re-invoke the gate without a new AI change.
  private interceptCallback:
    | ((event: InterceptedEvent) => Promise<boolean>)
    | undefined;

  private readonly docStates = new Map<string, DocState>();
  private readonly checkpoints = new Map<string, string>();

  // BUG OBSERVED (v4): The original "Try Again" implementation called
  // ExplanationGate.challenge() without a code snippet. The gate panel re-opened
  // with an empty code preview and no context for the student.
  // FIX: savedChanges and savedSnippets persist the AI diff so the panel can be
  // fully re-populated on retry without requiring a new Cursor AI action.
  private readonly savedChanges = new Map<
    string,
    Array<{ range: vscode.Range; text: string }>
  >();
  private readonly savedSnippets = new Map<string, string>();

  // BUG OBSERVED (v5): Using the document's current content at gate-trigger time
  // as the checkpoint was too late — Cursor had already written the AI content into
  // the document by the time our async handler ran. The "checkpoint" was the AI
  // content, so "reverting to checkpoint" was a no-op.
  // FIX: lastSafeContent is updated on every small (human-scale) edit, maintaining
  // a continuously fresh pre-AI snapshot. When a large AI write is detected, this
  // snapshot (captured before the AI write) becomes the authoritative checkpoint.
  private readonly lastSafeContent = new Map<string, string>();

  // ── helpers ──────────────────────────────────────────────────────────────────

  private getState(uri: string): DocState {
    return this.docStates.get(uri) ?? "idle";
  }

  private setState(uri: string, state: DocState): void {
    if (state === "idle") {
      // Clearing all maps on "idle" prevents stale checkpoints from persisting
      // after a gate is resolved and triggering spurious reversions later.
      this.docStates.delete(uri);
      this.checkpoints.delete(uri);
      this.savedChanges.delete(uri);
      this.savedSnippets.delete(uri);
    } else {
      this.docStates.set(uri, state);
    }
  }

  // Revert the in-memory document to the pre-AI checkpoint.
  // Sets isReapplying to suppress the resulting onDidChangeTextDocument event
  // (see BUG OBSERVED v2 above).
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

  // BUG OBSERVED (v6): On a successful "Try Again" pass, the in-memory document
  // was at the checkpoint (pre-AI state) because we had reverted it when the first
  // attempt failed. The gate approved the explanation but never put the AI code
  // back — the student saw the old (pre-AI) content despite passing the gate.
  // FIX: reapplySavedChanges explicitly re-applies the Cursor diff after a
  // successful retry so the approved AI code lands in the editor.
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

  // ── gate runner ──────────────────────────────────────────────────────────────
  // BUG OBSERVED (v7): The gate logic was inlined inside onDidChangeTextDocument.
  // The "Try Again" handler duplicated this logic but did not restore
  // checkpoints/savedChanges/savedSnippets before calling setState("idle"), so
  // the second gate run had no code snippet, no diff to re-apply, and no revert
  // target — the retry flow was functionally broken.
  // FIX: runGate is a shared helper for both the initial trigger and retries.
  // isRetry=true skips the in-memory revert assumption and re-applies savedChanges
  // on pass (since the document is at checkpoint during a retry, not at AI state).
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
      // Always clear globalGateOpen so subsequent file changes can trigger gates.
      this.globalGateOpen = false;
    }

    if (approved) {
      if (isRetry) {
        // On retry the in-memory doc is at checkpoint — put Cursor's changes back.
        await this.reapplySavedChanges(changedUri);
      }
      // Advance the safe-content snapshot so the approved AI code becomes the new
      // baseline for future change detection. Without this, the next AI change
      // would compare against the old pre-AI snapshot and incorrectly flag human
      // edits that included the approved AI code as suspicious.
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
          // Message kept short — VS Code truncates notifications over ~60 chars.
          "VibeCheck: Changes blocked — explain code to apply it.",
          "Try Again",
        )
        .then((choice) => {
          if (choice === "Try Again") {
            const savedSnippet = this.savedSnippets.get(uriKey) ?? snippet;
            // BUG OBSERVED (v7 cont.): setState("idle") deletes checkpoints,
            // savedChanges, and savedSnippets from their maps. We need these to
            // re-populate the gate panel and re-apply the diff on a successful
            // retry. FIX: snapshot before clearing, restore after.
            const checkpoint = this.checkpoints.get(uriKey);
            const changes = this.savedChanges.get(uriKey);
            const snip = this.savedSnippets.get(uriKey);
            this.setState(uriKey, "idle"); // clears maps
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

  // ── main listeners ────────────────────────────────────────────────────────────

  activate(onIntercept: (event: InterceptedEvent) => Promise<boolean>): void {
    this.interceptCallback = onIntercept;

    // Seed snapshots for all documents already open when the extension activates.
    // Without this, the first AI change to any already-open file would have no
    // checkpoint and restoreToCheckpoint would produce an empty file (v9 fix).
    for (const doc of vscode.workspace.textDocuments) {
      this.lastSafeContent.set(doc.uri.toString(), doc.getText());
    }
    this.disposables.push(
      vscode.workspace.onDidOpenTextDocument((doc) => {
        // Seed documents opened after activation so their pre-AI content is
        // captured before Cursor can write to them.
        if (!this.lastSafeContent.has(doc.uri.toString())) {
          this.lastSafeContent.set(doc.uri.toString(), doc.getText());
        }
      }),
    );

    // ── Listener 1: detect AI changes ────────────────────────────────────────
    // BUG OBSERVED (v8): The original architecture fought Cursor's in-memory
    // writes with vscode.commands.executeCommand("undo"). Cursor's agent logs
    // showed it responding: "Re-applying both edits", "Writing the full file to
    // ensure changes persist." This undo/redo loop saturated the VS Code event
    // loop, eventually crashing the extension host.
    // FIX: Abandon fighting in-memory. Let Cursor write whatever it wants into
    // the document buffer. Block persistence only — intercept disk writes via
    // Listeners 2 & 3 (onWillSave / onDidSave). Cursor can re-apply in-memory
    // indefinitely; nothing reaches disk until the gate passes.
    this.disposables.push(
      vscode.workspace.onDidChangeTextDocument(async (event) => {
        if (this.isReapplying) return;
        if (event.contentChanges.length === 0) return;

        const uriKey = event.document.uri.toString();
        const state = this.getState(uriKey);

        // While gate is active, further writes are blocked at save time anyway.
        if (state !== "idle") return;

        const largeChange = event.contentChanges.find(
          (c) =>
            c.text.split("\n").length >= MIN_LINES ||
            c.text.length >= MIN_CHARS,
        );

        if (!largeChange) {
          // Small (human-scale) change — advance the safe-content snapshot.
          this.lastSafeContent.set(uriKey, event.document.getText());
          return;
        }

        // BUG OBSERVED (v9): Files opened by Cursor's agent for the first time
        // (never shown in a tab) had no lastSafeContent entry. The fallback "" was
        // stored as the checkpoint. restoreToCheckpoint then overwrote the file
        // with an empty string, corrupting it silently.
        // FIX: If the file is not yet tracked, seed it with the current (AI-
        // modified) content and skip gating. The first write is treated as approved.
        // Subsequent AI changes will be gated once a human baseline exists.
        const safeContent = this.lastSafeContent.get(uriKey);
        if (safeContent === undefined) {
          this.lastSafeContent.set(uriKey, event.document.getText());
          return;
        }

        const checkpoint = safeContent;

        if (this.globalGateOpen) {
          // Another gate is already active. Block this file's saves silently
          // (Listeners 2 & 3 will revert any save attempt).
          this.checkpoints.set(uriKey, checkpoint);
          this.setState(uriKey, "blocked");
          return;
        }

        // ── Enter gating ───────────────────────────────────────────────────────
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

    // ── Listener 2: block saves while gate is active (primary defense) ────────
    // BUG OBSERVED (v10): We originally called showWarningMessage inside a
    // setTimeout(0) to avoid holding up the synchronous onWillSaveTextDocument
    // handler. In practice, the notification never rendered — VS Code requires
    // showWarningMessage to be called synchronously in the handler's call stack,
    // before event.waitUntil() schedules the async TextEdit.
    // FIX: Call showWarningMessage synchronously BEFORE event.waitUntil().
    this.disposables.push(
      vscode.workspace.onWillSaveTextDocument((event) => {
        const uriKey = event.document.uri.toString();
        const state = this.getState(uriKey);
        if (state === "idle") return;

        const checkpoint = this.checkpoints.get(uriKey);
        // Guard: never inject an empty checkpoint — that would replace the file
        // with an empty string. An empty/missing checkpoint means the file was
        // not tracked when the gate started (see v9 fix above).
        if (!checkpoint) return;

        const doc = event.document;
        if (doc.getText() === checkpoint) return;

        const fullRange = new vscode.Range(
          doc.positionAt(0),
          doc.positionAt(doc.getText().length),
        );

        // Show notification synchronously — must precede waitUntil() or VS Code
        // swallows it (tested: deferred calls via setTimeout do not render).
        // Message capped at ~55 chars to avoid truncation in VS Code's toast UI.
        vscode.window.showWarningMessage(
          "VibeCheck: Edit reverted — explain code to apply.",
        );

        event.waitUntil(
          Promise.resolve([new vscode.TextEdit(fullRange, checkpoint)]),
        );
      }),
    );

    // ── Listener 3: post-save fallback (secondary defense) ───────────────────
    // BUG OBSERVED (v11): Cursor's native "Keep Changes" button in its diff/review
    // panel writes files via an internal Cursor command that does NOT trigger
    // onWillSaveTextDocument. Clicking "Keep" for a file in "blocked" state
    // therefore persisted the AI content to disk, bypassing Listener 2 entirely.
    // Observed specifically with multi-file agent edits where Cursor presented its
    // own accept/reject diff UI (e.g., CourseCatalog.tsx in the course-scheduler
    // example app).
    // FIX: onDidSaveTextDocument fires after ANY save regardless of mechanism.
    // If a gated file reaches disk with AI content, immediately overwrite it with
    // the checkpoint content (in-memory via restoreToCheckpoint + disk via .save()).
    // The .save() call is safe because onWillSaveTextDocument will see
    // doc.getText() === checkpoint and skip injection, preventing recursion.
    this.disposables.push(
      vscode.workspace.onDidSaveTextDocument(async (doc) => {
        const uriKey = doc.uri.toString();
        const state = this.getState(uriKey);
        if (state === "idle") return;

        const checkpoint = this.checkpoints.get(uriKey);
        // Guard: skip if checkpoint is missing or empty — do not overwrite an
        // untracked file with an empty string (see v9 fix above).
        if (!checkpoint) return;

        if (doc.getText() === checkpoint) return; // already correct, no action

        // File saved with AI content despite the active gate — undo it.
        await this.restoreToCheckpoint(doc.uri);
        // Persist the checkpoint content to disk so memory ≡ disk.
        // onWillSaveTextDocument will not block this save (content = checkpoint).
        const current = vscode.workspace.textDocuments.find(
          (d) => d.uri.toString() === uriKey,
        );
        if (current) await current.save();

        // Show notification. Capped at ~55 chars to avoid VS Code toast truncation.
        vscode.window.showWarningMessage(
          "VibeCheck: Edit reverted — explain code to apply.",
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
