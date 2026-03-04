import { InterceptedEvent } from "./types";
import { CursorInterceptor } from "./CursorInterceptor";
import { CopilotInterceptor } from "./CopilotInterceptor";
import { InlineSuggestionInterceptor } from "./InlineSuggestionInterceptor";
import { AIChangeInterceptor } from "./AIChangeInterceptor";
import { VibeCheckConfig } from "../config/ConfigService";
import { INTERCEPTED_COMMANDS } from "../constants";

export class InterceptorRegistry {
  private readonly interceptors: Array<{
    deactivate(): void;
  }> = [];

  constructor(private readonly config: VibeCheckConfig) {}

  activate(onIntercept: (event: InterceptedEvent) => Promise<boolean>): void {
    // Primary: document-change interceptor works regardless of how Cursor applies code.
    // This catches the new Cursor agent mode that bypasses VS Code commands entirely.
    const doc = new AIChangeInterceptor();
    doc.activate(onIntercept);
    this.interceptors.push(doc);

    // Fallback: command interception for older Cursor versions and Copilot.
    if (this.config.interceptCursor) {
      for (const cmd of [
        INTERCEPTED_COMMANDS.CURSOR_APPLY,
        INTERCEPTED_COMMANDS.CURSOR_ACCEPT_STEP,
        INTERCEPTED_COMMANDS.CURSOR_ACCEPT_ALL_FILES,
        INTERCEPTED_COMMANDS.CURSOR_ACCEPT_INLINE_DIFFS,
      ]) {
        const i = new CursorInterceptor(cmd);
        i.activate(onIntercept);
        this.interceptors.push(i);
      }
    }

    if (this.config.interceptCopilot) {
      const i = new CopilotInterceptor();
      i.activate(onIntercept);
      this.interceptors.push(i);
    }

    if (this.config.interceptInline) {
      const i = new InlineSuggestionInterceptor();
      i.activate(onIntercept);
      this.interceptors.push(i);
    }
  }

  deactivate(): void {
    for (const interceptor of this.interceptors) {
      interceptor.deactivate();
    }
    this.interceptors.length = 0;
  }
}
