import { JudgeRequest, JudgeResponse, LLMProvider } from "./types";
import { buildSystemPrompt, buildUserMessage } from "./prompts";

const VALID_SCORES = new Set([1, 2, 3, 4, 5]);

function parseResponse(raw: string, passThreshold: number): JudgeResponse {
  // Strip markdown code fences if the model wraps the JSON
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error(`Judge returned non-JSON: ${raw.slice(0, 200)}`);
  }

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    typeof (parsed as Record<string, unknown>).score !== "number" ||
    typeof (parsed as Record<string, unknown>).feedback !== "string"
  ) {
    throw new Error(
      `Judge JSON missing required fields: ${cleaned.slice(0, 200)}`,
    );
  }

  const score = (parsed as Record<string, unknown>).score as number;
  const feedback = (parsed as Record<string, unknown>).feedback as string;

  if (!VALID_SCORES.has(score)) {
    // Use "invalid_score" (not "range") so the retry allowlist in evaluate()
    // does not accidentally retry deterministic bad-score responses.
    throw new Error(`Judge returned invalid_score: ${score}`);
  }

  return {
    score: score as 1 | 2 | 3 | 4 | 5,
    feedback,
    passed: score >= passThreshold,
  };
}

export class JudgeService {
  constructor(
    private readonly provider: LLMProvider,
    private readonly passThreshold: number,
  ) {}

  async evaluate(
    request: JudgeRequest,
    signal?: AbortSignal,
  ): Promise<JudgeResponse> {
    const systemPrompt = buildSystemPrompt(request.courseName);
    const userMessage = buildUserMessage(
      request.codeSnippet,
      request.explanation,
    );

    let lastError: Error | undefined;

    // Retry once on parse failure — model may occasionally mis-format.
    // Do NOT retry if the AbortSignal has been triggered — surface immediately.
    for (let attempt = 0; attempt < 2; attempt++) {
      if (signal?.aborted) {
        throw new DOMException("Aborted", "AbortError");
      }
      try {
        const raw = await this.provider.complete(
          systemPrompt,
          userMessage,
          signal,
        );
        return parseResponse(raw, this.passThreshold);
      } catch (err) {
        // Re-throw abort errors immediately — do not retry.
        if (
          err instanceof Error &&
          (err.name === "AbortError" || signal?.aborted)
        ) {
          throw err;
        }
        lastError = err instanceof Error ? err : new Error(String(err));
        if (attempt === 0) {
          // Only retry on transient parse/empty-response failures.
          // "invalid_score" is deterministic — the model returned a bad value
          // and retrying won't help, so it is intentionally excluded.
          if (
            !lastError.message.includes("non-JSON") &&
            !lastError.message.includes("missing required fields") &&
            !lastError.message.includes("empty")
          ) {
            throw lastError;
          }
        }
      }
    }

    throw lastError ?? new Error("Judge evaluation failed");
  }
}
