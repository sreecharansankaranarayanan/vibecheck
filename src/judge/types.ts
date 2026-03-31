export interface JudgeRequest {
  readonly codeSnippet: string;
  readonly explanation: string;
  readonly courseName: string;
}

export interface JudgeResponse {
  readonly score: 1 | 2 | 3 | 4 | 5;
  readonly feedback: string;
  readonly passed: boolean;
}

export interface LLMProvider {
  // BV-10 fix: Optional AbortSignal so ExplanationGate can cancel an
  // in-flight judge call when the panel is closed during JUDGING state.
  complete(
    systemPrompt: string,
    userMessage: string,
    signal?: AbortSignal,
  ): Promise<string>;
}

export interface LLMProviderConfig {
  readonly model: string;
  readonly apiKey: string;
  readonly baseUrl?: string;
  readonly temperature: number;
}
