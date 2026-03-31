import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import * as crypto from "crypto";
import { WEBVIEW_ID, WEBVIEW_TITLE } from "../constants";

// Messages from extension → webview
export type ExtToWebview =
  | { type: "show"; code: string; attempt: number }
  | { type: "judging" }
  | { type: "fail"; feedback: string; score: number; attempt: number }
  // score: actual SOLO score achieved (1–5); webview must not hardcode 5.
  | { type: "pass"; score: number };

// Messages from webview → extension
export type WebviewToExt =
  | { type: "submit"; explanation: string }
  | { type: "cancel" };

export class GatePanel {
  private panel: vscode.WebviewPanel | undefined;
  private onSubmitHandler: ((explanation: string) => void) | undefined;
  private onCancelHandler: (() => void) | undefined;

  // BV-1 fix: Track disposal to prevent double-invocation of onCancelHandler.
  // The sequence that caused the bug:
  //   ExplanationGate.handleCancel() → this.panel.dispose()
  //     → GatePanel.dispose() → panel.dispose()
  //       → onDidDispose fires → onCancelHandler?.() [second call]
  //         → handleCancel dispatches CANCELLED on IDLE state → throws
  // With _disposed, onCancelHandler fires exactly once regardless of which
  // code path triggers the teardown.
  private _disposed = false;

  constructor(private readonly extensionUri: vscode.Uri) {}

  open(code: string, attempt: number): void {
    // Reset disposed flag when re-opening (fresh challenge after a prior cancel).
    this._disposed = false;

    if (!this.panel) {
      this.panel = vscode.window.createWebviewPanel(
        WEBVIEW_ID,
        WEBVIEW_TITLE,
        vscode.ViewColumn.Beside,
        {
          enableScripts: true,
          // SECURITY (MED-3): Do not retain context when hidden — prevents code
          // snippets from lingering in renderer memory after panel is hidden.
          retainContextWhenHidden: false,
          localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, "dist")],
        },
      );

      this.panel.webview.html = this.buildHtml(this.panel.webview);

      this.panel.webview.onDidReceiveMessage((message: WebviewToExt) => {
        if (message.type === "submit") {
          this.onSubmitHandler?.(message.explanation);
        } else if (message.type === "cancel") {
          this.onCancelHandler?.();
        }
      });

      this.panel.onDidDispose(() => {
        this.panel = undefined;
        // BV-1 fix: Guard ensures onCancelHandler fires at most once.
        // dispose() and onDidDispose can both fire in the same teardown chain
        // (ExplanationGate.handleCancel calls dispose(), which triggers onDidDispose).
        if (!this._disposed) {
          this._disposed = true;
          this.onCancelHandler?.();
        }
      });
    }

    this.send({ type: "show", code, attempt });
  }

  send(message: ExtToWebview): void {
    this.panel?.webview.postMessage(message);
  }

  dispose(): void {
    // BV-1 fix: Mark disposed before calling panel.dispose() so that when
    // onDidDispose fires synchronously inside panel.dispose(), the guard above
    // prevents a second invocation of onCancelHandler.
    if (!this._disposed) {
      this._disposed = true;
    }
    this.panel?.dispose();
    this.panel = undefined;
  }

  onSubmit(handler: (explanation: string) => void): void {
    this.onSubmitHandler = handler;
  }

  onCancel(handler: () => void): void {
    this.onCancelHandler = handler;
  }

  private buildHtml(webview: vscode.Webview): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, "dist", "webview.js"),
    );

    // SECURITY (CRIT-2): Generate a fresh cryptographic nonce per panel open.
    // The nonce is used in both the CSP header and the <script> tag so that
    // only our specific script is allowed to execute — 'unsafe-inline' is gone.
    const nonce = crypto.randomBytes(16).toString("base64");

    const htmlPath = path.join(
      this.extensionUri.fsPath,
      "src",
      "webview",
      "index.html",
    );
    let html: string;
    try {
      html = fs.readFileSync(htmlPath, "utf8");
    } catch {
      html = this.fallbackHtml(nonce, scriptUri.toString());
      return html;
    }

    // SECURITY (CRIT-1): Use replaceAll (or regex /g) so BOTH occurrences of
    // {{SCRIPT_URI}} are substituted — the one in the CSP header and the one
    // in the <script src> tag. String.replace() only replaces the first match.
    html = html.replaceAll("{{SCRIPT_URI}}", scriptUri.toString());
    html = html.replaceAll("{{NONCE}}", nonce);
    return html;
  }

  // SECURITY (MED-6): Fallback HTML includes a proper CSP and nonce.
  // No inline styles — 'unsafe-inline' removed; style-src omitted since there
  // are no <style> blocks or style attributes in this minimal error page.
  private fallbackHtml(nonce: string, scriptUri: string): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy"
    content="default-src 'none'; script-src 'nonce-${nonce}';" />
  <title>VibeCheck</title>
</head>
<body>
  <p>VibeCheck webview could not load. Please run <code>npm run compile</code> and reload VS Code.</p>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }
}
