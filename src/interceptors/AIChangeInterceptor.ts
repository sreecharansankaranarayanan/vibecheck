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

// ── Persistence key for workspaceState ───────────────────────────────────────
// BV-3 fix: Blocked/gating state and checkpoints survive extension restarts.
const PERSIST_KEY = "vibecheck.blockedFiles";

interface PersistedEntry {
  checkpoint: string;
  snippet: string;
}

export class AIChangeInterceptor {
  private readonly disposables: vscode.Disposable[] = [];

  // BUG OBSERVED (v2): When restoreToCheckpoint called workspace.applyEdit, the
  // resulting onDidChangeTextDocument event re-triggered the gate detector, causing
  // an immediate second gate to open on the checkpoint content itself.
  // FIX: isReapplying flag suppresses our own programmatic edits in Listener 1.
  private isReapplying = false;

  // BV-9 fix: isReapplying must also be false in deactivate() so that any
  // outstanding applyEdit promises from a dead instance don't confuse a new one.
  // _deactivated is checked after every await applyEdit returns.
  private _deactivated = false;

  // BV-2/BV-5 fix: Guard set preventing recursive onDidChange events when
  // Listener 4 (FileSystemWatcher) writes checkpoint content back to disk.
  // Keyed by URI string so concurrent writes to different files don't suppress
  // each other's watcher events (single-boolean race fixed).
  private readonly writingCheckpoint = new Set<string>();

  // BUG OBSERVED (v3): Cursor's agent writes multiple files simultaneously.
  // FIX: globalGateOpen prevents concurrent gates.
  private globalGateOpen = false;

  // BV-2/BV-5 fix: Tracks URI keys for which a "Try Again" toast callback is
  // pending. flushBlockedQueue skips these to avoid concurrent runGate calls
  // on the same URI from both the flush path and the toast path.
  private readonly retryPending = new Set<string>();

  // Stored so "Try Again" can re-invoke the gate without a new AI change.
  private interceptCallback:
    | ((event: InterceptedEvent) => Promise<boolean>)
    | undefined;

  private readonly docStates = new Map<string, DocState>();
  private readonly checkpoints = new Map<string, string>();

  // BUG OBSERVED (v4): savedChanges and savedSnippets persist the AI diff so
  // the panel can be fully re-populated on retry.
  private readonly savedChanges = new Map<
    string,
    Array<{ range: vscode.Range; text: string }>
  >();
  private readonly savedSnippets = new Map<string, string>();

  // BUG OBSERVED (v5): lastSafeContent maintains a continuously fresh pre-AI
  // snapshot so the checkpoint is always valid when a large AI write is detected.
  private readonly lastSafeContent = new Map<string, string>();

  // BV-3 fix: workspaceState reference for persisting blocked file entries
  // across extension restarts and "Restart Extension Host".
  private workspaceState: vscode.Memento | undefined;

  // ── helpers ──────────────────────────────────────────────────────────────────

  private getState(uri: string): DocState {
    return this.docStates.get(uri) ?? "idle";
  }

  private setState(uri: string, state: DocState): void {
    if (state === "idle") {
      this.docStates.delete(uri);
      this.checkpoints.delete(uri);
      this.savedChanges.delete(uri);
      this.savedSnippets.delete(uri);
      this.persistBlocked(); // BV-3: Remove from persisted state on resolution
    } else {
      this.docStates.set(uri, state);
    }
  }

  // BV-3 fix: Persist all currently blocked/gating files to workspaceState so
  // they survive an extension restart or "Restart Extension Host" command.
  private persistBlocked(): void {
    if (!this.workspaceState) return;
    const entries: Record<string, PersistedEntry> = {};
    for (const [uri, state] of this.docStates.entries()) {
      if (state === "blocked" || state === "gating") {
        const checkpoint = this.checkpoints.get(uri);
        const snippet = this.savedSnippets.get(uri) ?? "";
        if (checkpoint !== undefined) {
          entries[uri] = { checkpoint, snippet };
        }
      }
    }
    this.workspaceState.update(PERSIST_KEY, entries);
  }

  // BV-3 fix: On activation, restore blocked entries persisted from a prior
  // session. Each restored file is immediately queued for gating via
  // flushBlockedQueue (called after activate() by InterceptorRegistry / ext).
  private restorePersistedBlocked(): void {
    if (!this.workspaceState) return;
    const entries =
      this.workspaceState.get<Record<string, PersistedEntry>>(PERSIST_KEY) ??
      {};
    for (const [uriKey, entry] of Object.entries(entries)) {
      this.docStates.set(uriKey, "blocked");
      this.checkpoints.set(uriKey, entry.checkpoint);
      this.savedSnippets.set(uriKey, entry.snippet);
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
      // BV-9 fix: Only reset isReapplying if this instance is still active.
      // If deactivate() ran while applyEdit was awaited, the instance is dead
      // and we must NOT leave isReapplying=true on the now-dead instance (a new
      // active instance has already started with its own isReapplying=false).
      if (!this._deactivated) {
        this.isReapplying = false;
      }
    }
  }

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
      if (!this._deactivated) {
        this.isReapplying = false;
      }
    }
  }

  // ── gate runner ──────────────────────────────────────────────────────────────
  private async runGate(
    uriKey: string,
    changedUri: vscode.Uri,
    snippet: string,
    isRetry: boolean,
  ): Promise<void> {
    this.setState(uriKey, "gating");
    this.globalGateOpen = true;
    this.persistBlocked(); // BV-3: Persist before the async gate opens

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
      // BV-6 fix: Advance state to "idle" and update the safe-content baseline
      // BEFORE calling reapplySavedChanges. The resulting onDidChangeTextDocument
      // fires asynchronously after applyEdit resolves. If state were still
      // "gating"/"blocked" when that event fires (old ordering), isReapplying
      // might already be false and the AI-scale change would re-trigger the gate.
      // By setting idle+baseline first, the event sees idle state with a matching
      // content snapshot → delta is zero → no gate triggered.
      this.setState(uriKey, "idle"); // clears maps, persists removal
      const doc = vscode.workspace.textDocuments.find(
        (d) => d.uri.toString() === uriKey,
      );
      // Seed the baseline with the post-approval content (will be the AI code
      // after reapplySavedChanges completes, or checkpoint if non-retry).
      // We refresh it again after reapply to get the exact final text.
      if (doc) {
        this.lastSafeContent.set(uriKey, doc.getText());
      }

      if (isRetry) {
        // On retry the in-memory doc is at checkpoint — put Cursor's changes back.
        await this.reapplySavedChanges(changedUri);
        // Refresh baseline with the actual final content after re-apply.
        const postDoc = vscode.workspace.textDocuments.find(
          (d) => d.uri.toString() === uriKey,
        );
        if (postDoc) {
          this.lastSafeContent.set(uriKey, postDoc.getText());
        }
      }
    } else {
      // Gate failed or cancelled — revert in-memory to checkpoint.
      await this.restoreToCheckpoint(changedUri);
      this.setState(uriKey, "blocked");
      this.persistBlocked(); // BV-3: Persist blocked state after revert

      vscode.window
        .showWarningMessage(
          "VibeCheck: Changes blocked — explain code to apply it.",
          "Try Again",
        )
        .then((choice) => {
          if (choice === "Try Again") {
            // BV-2/BV-5 fix: Guard against concurrent runGate on the same URI.
            // flushBlockedQueue also processes this file; one must win.
            if (this.retryPending.has(uriKey)) return;
            if (this.getState(uriKey) !== "blocked") return;

            const savedSnippet = this.savedSnippets.get(uriKey) ?? snippet;
            const checkpoint = this.checkpoints.get(uriKey);
            const changes = this.savedChanges.get(uriKey);
            const snip = this.savedSnippets.get(uriKey);
            this.setState(uriKey, "idle"); // clears maps
            if (checkpoint !== undefined)
              this.checkpoints.set(uriKey, checkpoint);
            if (changes !== undefined) this.savedChanges.set(uriKey, changes);
            if (snip !== undefined) this.savedSnippets.set(uriKey, snip);

            this.retryPending.add(uriKey);
            this.runGate(uriKey, changedUri, savedSnippet, true)
              .catch((err) => console.error("VibeCheck retry gate error:", err))
              .finally(() => this.retryPending.delete(uriKey));
          }
        });
    }

    // BV-3/BV-5 fix: After this gate resolves, flush any files that were blocked
    // while this gate was active. Skip files that have a pending toast retry
    // (retryPending) to avoid the toast and flush racing on the same URI.
    await this.flushBlockedQueue();
  }

  // BV-3 fix: Drain the queue of files blocked while a gate was active.
  private async flushBlockedQueue(): Promise<void> {
    const blockedKeys = [...this.docStates.entries()]
      .filter(([, state]) => state === "blocked")
      .map(([key]) => key);

    for (const uriKey of blockedKeys) {
      if (this.getState(uriKey) !== "blocked") continue;
      // BV-2/BV-5 fix: Skip if a "Try Again" toast is already handling this URI.
      if (this.retryPending.has(uriKey)) continue;

      const uri = vscode.Uri.parse(uriKey);
      await this.restoreToCheckpoint(uri);

      const snippet = this.savedSnippets.get(uriKey) ?? "";
      await this.runGate(uriKey, uri, snippet, true);
    }
  }

  // ── Public API for safe teardown (BV-4) ──────────────────────────────────────
  // Returns a snapshot of all non-idle checkpoints so the caller (extension.ts)
  // can restore files to a safe state before destroying this interceptor.
  getActiveCheckpoints(): Map<string, string> {
    const snapshot = new Map<string, string>();
    for (const [uri, state] of this.docStates.entries()) {
      if (state !== "idle") {
        const cp = this.checkpoints.get(uri);
        if (cp !== undefined) snapshot.set(uri, cp);
      }
    }
    return snapshot;
  }

  // ── main listeners ────────────────────────────────────────────────────────────

  activate(
    onIntercept: (event: InterceptedEvent) => Promise<boolean>,
    workspaceState?: vscode.Memento,
  ): void {
    this.interceptCallback = onIntercept;
    this.workspaceState = workspaceState;
    this._deactivated = false;

    // BV-3 fix: Restore any blocked state persisted from a prior session.
    this.restorePersistedBlocked();

    // Seed snapshots for all documents already open when the extension activates.
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

    // ── Listener 1: detect AI changes ────────────────────────────────────────
    this.disposables.push(
      vscode.workspace.onDidChangeTextDocument(async (event) => {
        if (this.isReapplying) return;
        if (event.contentChanges.length === 0) return;

        const uriKey = event.document.uri.toString();
        const state = this.getState(uriKey);

        if (state !== "idle") return;

        // BV-5 fix: Add rangeLength check for small targeted edits.
        const largeChange = event.contentChanges.find(
          (c) =>
            c.text.split("\n").length >= MIN_LINES ||
            c.text.length >= MIN_CHARS ||
            c.rangeLength > MIN_CHARS,
        );

        if (!largeChange) {
          this.lastSafeContent.set(uriKey, event.document.getText());
          return;
        }

        const safeContent = this.lastSafeContent.get(uriKey);
        if (safeContent === undefined) {
          this.lastSafeContent.set(uriKey, event.document.getText());
          return;
        }

        const checkpoint = safeContent;

        if (this.globalGateOpen) {
          this.checkpoints.set(uriKey, checkpoint);
          this.setState(uriKey, "blocked");
          this.persistBlocked(); // BV-3: Persist new blocked entry
          return;
        }

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
    this.disposables.push(
      vscode.workspace.onWillSaveTextDocument((event) => {
        const uriKey = event.document.uri.toString();
        const state = this.getState(uriKey);
        if (state === "idle") return;

        const checkpoint = this.checkpoints.get(uriKey);
        if (!checkpoint) return;

        const doc = event.document;
        if (doc.getText() === checkpoint) return;

        const fullRange = new vscode.Range(
          doc.positionAt(0),
          doc.positionAt(doc.getText().length),
        );

        vscode.window.showWarningMessage(
          "VibeCheck: Edit reverted — explain code to apply.",
        );

        event.waitUntil(
          Promise.resolve([new vscode.TextEdit(fullRange, checkpoint)]),
        );
      }),
    );

    // ── Listener 3: post-save fallback (secondary defense) ───────────────────
    this.disposables.push(
      vscode.workspace.onDidSaveTextDocument(async (doc) => {
        const uriKey = doc.uri.toString();
        const state = this.getState(uriKey);
        if (state === "idle") return;

        const checkpoint = this.checkpoints.get(uriKey);
        if (!checkpoint) return;

        if (doc.getText() === checkpoint) return;

        await this.restoreToCheckpoint(doc.uri);
        const current = vscode.workspace.textDocuments.find(
          (d) => d.uri.toString() === uriKey,
        );
        if (current) await current.save();

        vscode.window.showWarningMessage(
          "VibeCheck: Edit reverted — explain code to apply.",
        );
      }),
    );

    // ── Listener 4: filesystem watcher (tertiary defense — Cursor "Keep File") ─
    // BV-2 fix: Catches Cursor's "Keep File" disk writes that bypass both
    // onWillSaveTextDocument AND onDidSaveTextDocument. writingCheckpoint
    // prevents the write itself from re-entering this handler.
    //
    // BV-8 fix: Create one watcher per workspace folder using absolute path
    // globs so files outside the default root are also watched. Also registers
    // a handler for newly added workspace folders.
    const handleFsChange = async (uri: vscode.Uri): Promise<void> => {
      const uriKey = uri.toString();
      if (this.writingCheckpoint.has(uriKey)) return;

      const state = this.getState(uriKey);
      if (state === "idle") return;

      const checkpoint = this.checkpoints.get(uriKey);
      if (!checkpoint) return;

      let diskContent: string;
      try {
        const bytes = await vscode.workspace.fs.readFile(uri);
        diskContent = Buffer.from(bytes).toString("utf8");
      } catch {
        return;
      }

      if (diskContent === checkpoint) return;

      this.writingCheckpoint.add(uriKey);
      try {
        await vscode.workspace.fs.writeFile(
          uri,
          Buffer.from(checkpoint, "utf8"),
        );
      } finally {
        this.writingCheckpoint.delete(uriKey);
      }

      await this.restoreToCheckpoint(uri);

      vscode.window.showWarningMessage(
        "VibeCheck: Edit reverted — explain code to apply.",
      );
    };

    const registerWatcher = (folder: vscode.WorkspaceFolder): void => {
      const pattern = new vscode.RelativePattern(folder, "**/*");
      const w = vscode.workspace.createFileSystemWatcher(pattern);
      this.disposables.push(w);
      this.disposables.push(w.onDidChange(handleFsChange));
    };

    // Register a watcher for each existing workspace folder.
    for (const folder of vscode.workspace.workspaceFolders ?? []) {
      registerWatcher(folder);
    }
    // BV-8 fix: Also watch any folders added after activation.
    this.disposables.push(
      vscode.workspace.onDidChangeWorkspaceFolders((e) => {
        for (const folder of e.added) {
          registerWatcher(folder);
        }
      }),
    );

    // BV-3 fix: If there are persisted blocked files, flush them now that all
    // listeners are active and the interceptCallback is set.
    if (this.docStates.size > 0) {
      this.flushBlockedQueue().catch((err) =>
        console.error(
          "VibeCheck: error flushing persisted blocked queue:",
          err,
        ),
      );
    }
  }

  deactivate(): void {
    this._deactivated = true; // BV-9 fix: signal outstanding applyEdit promises
    for (const d of this.disposables) d.dispose();
    this.disposables.length = 0;
    this.interceptCallback = undefined;
    this.docStates.clear();
    this.checkpoints.clear();
    this.savedChanges.clear();
    this.savedSnippets.clear();
    this.lastSafeContent.clear();
    this.retryPending.clear();
    this.globalGateOpen = false;
    this.isReapplying = false; // BV-9 fix: was missing, could confuse new instance
    this.writingCheckpoint.clear();
  }
}
