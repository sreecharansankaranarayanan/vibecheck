import { Interceptor, InterceptedEvent } from './types';
import { CursorInterceptor } from './CursorInterceptor';
import { CopilotInterceptor } from './CopilotInterceptor';
import { InlineSuggestionInterceptor } from './InlineSuggestionInterceptor';
import { VibeCheckConfig } from '../config/ConfigService';

export class InterceptorRegistry {
  private readonly interceptors: Interceptor[] = [];

  constructor(private readonly config: VibeCheckConfig) {}

  activate(onIntercept: (event: InterceptedEvent) => Promise<boolean>): void {
    if (this.config.interceptCursor) {
      const i = new CursorInterceptor();
      i.activate(onIntercept);
      this.interceptors.push(i);
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
