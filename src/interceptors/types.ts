export type InterceptorSource = 'cursor' | 'copilot' | 'inline';

export interface InterceptedEvent {
  readonly codeSnippet: string;
  readonly source: InterceptorSource;
  readonly timestamp: number;
  readonly originalCommand: string;
}

export interface Interceptor {
  readonly commandId: string;
  readonly source: InterceptorSource;
  activate(onIntercept: (event: InterceptedEvent) => Promise<boolean>): void;
  deactivate(): void;
}
