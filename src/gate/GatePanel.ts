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
  | { type: "pass" };

// Messages from webview → extension
export type WebviewToExt =
  | { type: "submit"; explanation: string }
  | { type: "cancel" };

export class GatePanel {
  private panel: vscode.WebviewPanel | undefined;
  private onSubmitHandler: ((explanation: string) => void) | undefined;
  private onCancelHandler: (() => void) | undefined;

  constructor(private readonly extensionUri: vscode.Uri) {}

  open(code: string, attempt: number): void {
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
        this.onCancelHandler?.();
      });
    }

    this.send({ type: "show", code, attempt });
  }

  send(message: ExtToWebview): void {
    this.panel?.webview.postMessage(message);
  }

  dispose(): void {
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
  private fallbackHtml(nonce: string, scriptUri: string): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy"
    content="default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline';" />
  <title>VibeCheck</title>
</head>
<body>
  <p style="font-family:sans-serif;padding:20px;color:#ccc;">
    VibeCheck webview could not load. Please run <code>npm run compile</code> and reload VS Code.
  </p>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }
}
