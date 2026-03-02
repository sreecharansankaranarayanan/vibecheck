import * as vscode from "vscode";
import { Interceptor, InterceptedEvent } from "./types";
import { INTERCEPTED_COMMANDS } from "../constants";

/**
 * Intercepts Cursor IDE's "Apply" action from the AI sidebar.
 * Cursor fires `aichat.applyCodeBlock` when the user clicks Apply.
 *
 * SECURITY (CRIT-4): Re-dispatch strategy.
 * VS Code routes executeCommand to the last registered handler. If we call
 * executeCommand(commandId) from within our handler, we get infinite recursion.
 * Safe approach: temporarily dispose our override, execute the original Cursor
 * command (now routed to Cursor's built-in handler), then re-register.
 * There is a brief ~1ms window where the command is unprotected; this is
 * acceptable for the educational use case.
 */
export class CursorInterceptor implements Interceptor {
  readonly commandId = INTERCEPTED_COMMANDS.CURSOR_APPLY;
  readonly source = "cursor" as const;

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

  private _register(): void {
    this.disposable = vscode.commands.registerCommand(
      this.commandId,
      async (...args: unknown[]) => {
        if (!this._onIntercept) return;

        const codeSnippet = extractCodeFromArgs(args);
        const event: InterceptedEvent = {
          codeSnippet,
          source: "cursor",
          timestamp: Date.now(),
          originalCommand: this.commandId,
        };

        const approved = await this._onIntercept(event);

        if (approved) {
          // SECURITY (CRIT-4): Temporarily unregister ourselves so the
          // executeCommand call routes to Cursor's built-in handler, not back
          // to us. Re-register immediately after to restore protection.
          this.disposable?.dispose();
          this.disposable = undefined;
          try {
            await vscode.commands.executeCommand(this.commandId, ...args);
          } catch {
            // Cursor command may not exist in non-Cursor builds — that's OK;
            // the user approved and we made a best-effort to apply.
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

function extractCodeFromArgs(args: unknown[]): string {
  if (args.length > 0 && typeof args[0] === "string") {
    return args[0].slice(0, 4000);
  }
  if (args.length > 0 && typeof args[0] === "object" && args[0] !== null) {
    const obj = args[0] as Record<string, unknown>;
    if (typeof obj.code === "string") return obj.code.slice(0, 4000);
    if (typeof obj.content === "string") return obj.content.slice(0, 4000);
    if (typeof obj.text === "string") return obj.text.slice(0, 4000);
  }

  const editor = vscode.window.activeTextEditor;
  if (editor) {
    const selection = editor.selection;
    if (!selection.isEmpty) {
      return editor.document.getText(selection).slice(0, 4000);
    }
    const text = editor.document.getText();
    return text.length > 2000 ? text.slice(0, 2000) + "\n...(truncated)" : text;
  }

  return "(code not available)";
}
