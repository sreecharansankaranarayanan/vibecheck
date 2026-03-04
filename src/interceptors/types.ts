export type InterceptorSource = "cursor" | "copilot" | "inline" | "document";

export interface InterceptedEvent {
  readonly codeSnippet: string;
  readonly source: InterceptorSource;
  readonly timestamp: number;
  readonly originalCommand: string;
}

export interface Interceptor {
  activate(onIntercept: (event: InterceptedEvent) => Promise<boolean>): void;
  deactivate(): void;
}
