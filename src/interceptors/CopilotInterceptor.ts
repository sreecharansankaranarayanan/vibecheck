import * as vscode from "vscode";
import { Interceptor, InterceptedEvent } from "./types";
import { INTERCEPTED_COMMANDS } from "../constants";

export class CopilotInterceptor implements Interceptor {
  readonly commandId = INTERCEPTED_COMMANDS.COPILOT_ACCEPT;
  readonly source = "copilot" as const;

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

        const codeSnippet = extractInlineSuggestion();
        const event: InterceptedEvent = {
          codeSnippet,
          source: "copilot",
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

function extractInlineSuggestion(): string {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return "(no active editor)";
  }
  const selection = editor.selection;
  if (!selection.isEmpty) {
    return editor.document.getText(selection).slice(0, 4000);
  }
  const line = editor.document.lineAt(editor.selection.active.line);
  return line.text.trim() || "(inline suggestion — context unavailable)";
}
