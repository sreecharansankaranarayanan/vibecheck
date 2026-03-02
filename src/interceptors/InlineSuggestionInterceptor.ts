import * as vscode from "vscode";
import { Interceptor, InterceptedEvent } from "./types";
import { INTERCEPTED_COMMANDS } from "../constants";

export class InlineSuggestionInterceptor implements Interceptor {
  readonly commandId = INTERCEPTED_COMMANDS.INLINE_ACCEPT;
  readonly source = "inline" as const;

  private disposable: vscode.Disposable | undefined;
  private _onIntercept:
    | ((event: InterceptedEvent) => Promise<boolean>)
    | undefined;

  activate(onIntercept: (event: InterceptedEvent) => Promise<boolean>): void {
    this._onIntercept = onIntercept;
    this._register();
  }

  deactivate(): void {
    this.disposable?.dispose();
    this.disposable = undefined;
    this._onIntercept = undefined;
  }

  // SECURITY (CRIT-4): Same deactivate/reactivate pattern as CursorInterceptor.
  private _register(): void {
    this.disposable = vscode.commands.registerCommand(
      this.commandId,
      async (...args: unknown[]) => {
        if (!this._onIntercept) return;

        const editor = vscode.window.activeTextEditor;
        const codeSnippet = editor
          ? (
              editor.document.getText(editor.selection) ||
              editor.document.lineAt(editor.selection.active.line).text
            ).slice(0, 4000)
          : "(inline suggestion)";

        const event: InterceptedEvent = {
          codeSnippet,
          source: "inline",
          timestamp: Date.now(),
          originalCommand: this.commandId,
        };

        const approved = await this._onIntercept(event);

        if (approved) {
          this.disposable?.dispose();
          this.disposable = undefined;
          try {
            await vscode.commands.executeCommand(this.commandId, ...args);
          } catch {
            // Best effort
          } finally {
            if (this._onIntercept !== undefined) {
              this._register();
            }
          }
        }
      },
    );
  }
}
