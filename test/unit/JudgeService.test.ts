import { describe, it, expect, vi } from "vitest";
import { JudgeService } from "../../src/judge/JudgeService";
import { LLMProvider, JudgeRequest } from "../../src/judge/types";

function makeRequest(overrides: Partial<JudgeRequest> = {}): JudgeRequest {
  return {
    codeSnippet: "const [count, setCount] = useState(0);",
    explanation: "It creates a state variable initialized to 0",
    courseName: "React",
    ...overrides,
  };
}

function mockProvider(response: string): LLMProvider {
  return {
    complete: vi.fn().mockResolvedValue(response),
  };
}

describe("JudgeService", () => {
  it("returns passed=true when score meets threshold", async () => {
    const provider = mockProvider(
      '{"score": 3, "feedback": "Good relational explanation."}',
    );
    const svc = new JudgeService(provider, 3);
    const result = await svc.evaluate(makeRequest());
    expect(result.score).toBe(3);
    expect(result.passed).toBe(true);
    expect(result.feedback).toBe("Good relational explanation.");
  });

  it("returns passed=false when score below threshold", async () => {
    const provider = mockProvider(
      '{"score": 2, "feedback": "Try explaining the interactions."}',
    );
    const svc = new JudgeService(provider, 3);
    const result = await svc.evaluate(makeRequest());
    expect(result.score).toBe(2);
    expect(result.passed).toBe(false);
  });

  it("passes with score 5 (extended abstract)", async () => {
    const provider = mockProvider(
      '{"score": 5, "feedback": "Excellent deep understanding."}',
    );
    const svc = new JudgeService(provider, 3);
    const result = await svc.evaluate(makeRequest());
    expect(result.passed).toBe(true);
  });

  it("strips markdown code fences from response", async () => {
    const provider = mockProvider(
      '```json\n{"score": 4, "feedback": "Great!"}\n```',
    );
    const svc = new JudgeService(provider, 3);
    const result = await svc.evaluate(makeRequest());
    expect(result.score).toBe(4);
    expect(result.passed).toBe(true);
  });

  it("retries once on JSON parse failure then succeeds", async () => {
    const provider: LLMProvider = {
      complete: vi
        .fn()
        .mockResolvedValueOnce("not json at all")
        .mockResolvedValueOnce('{"score": 3, "feedback": "OK on retry"}'),
    };
    const svc = new JudgeService(provider, 3);
    const result = await svc.evaluate(makeRequest());
    expect(result.score).toBe(3);
    expect(provider.complete).toHaveBeenCalledTimes(2);
  });

  it("throws after two consecutive parse failures", async () => {
    const provider = mockProvider("not json");
    const svc = new JudgeService(provider, 3);
    await expect(svc.evaluate(makeRequest())).rejects.toThrow();
  });

  it("throws on score out of range", async () => {
    const provider = mockProvider('{"score": 6, "feedback": "wat"}');
    const svc = new JudgeService(provider, 3);
    await expect(svc.evaluate(makeRequest())).rejects.toThrow("invalid_score");
  });

  it("does not retry on network errors (throws immediately)", async () => {
    const provider: LLMProvider = {
      complete: vi.fn().mockRejectedValue(new Error("Network error: timeout")),
    };
    const svc = new JudgeService(provider, 3);
    await expect(svc.evaluate(makeRequest())).rejects.toThrow("Network error");
  });

  it("respects custom pass threshold of 4", async () => {
    const provider = mockProvider(
      '{"score": 3, "feedback": "Relational but not extended."}',
    );
    const svc = new JudgeService(provider, 4);
    const result = await svc.evaluate(makeRequest());
    expect(result.score).toBe(3);
    expect(result.passed).toBe(false);
  });

  // AbortSignal tests
  it("throws AbortError immediately when signal is pre-aborted", async () => {
    const provider = mockProvider('{"score": 3, "feedback": "Good."}');
    const svc = new JudgeService(provider, 3);
    const controller = new AbortController();
    controller.abort();
    await expect(
      svc.evaluate(makeRequest(), controller.signal),
    ).rejects.toThrow();
    expect(
      (provider.complete as ReturnType<typeof vi.fn>).mock.calls.length,
    ).toBe(0);
  });

  // Score validation edge cases
  it("throws on score=0 (below valid range)", async () => {
    const provider = mockProvider('{"score": 0, "feedback": "Terrible."}');
    const svc = new JudgeService(provider, 3);
    await expect(svc.evaluate(makeRequest())).rejects.toThrow("invalid_score");
  });

  it("throws on score as string type (non-number)", async () => {
    const provider = mockProvider('{"score": "3", "feedback": "Good."}');
    const svc = new JudgeService(provider, 3);
    await expect(svc.evaluate(makeRequest())).rejects.toThrow();
  });

  // Malformed JSON field tests
  it("throws on missing score field", async () => {
    const provider = mockProvider('{"feedback": "No score here."}');
    const svc = new JudgeService(provider, 3);
    await expect(svc.evaluate(makeRequest())).rejects.toThrow(
      "missing required fields",
    );
  });

  it("throws on missing feedback field", async () => {
    const provider = mockProvider('{"score": 3}');
    const svc = new JudgeService(provider, 3);
    await expect(svc.evaluate(makeRequest())).rejects.toThrow(
      "missing required fields",
    );
  });

  // Empty response retry tests (Bug 2 regression)
  it("retries once on empty provider response then succeeds", async () => {
    const provider: LLMProvider = {
      complete: vi
        .fn()
        .mockRejectedValueOnce(new Error("Judge returned empty response"))
        .mockResolvedValueOnce('{"score": 3, "feedback": "Good on retry."}'),
    };
    const svc = new JudgeService(provider, 3);
    const result = await svc.evaluate(makeRequest());
    expect(result.score).toBe(3);
    expect(
      (provider.complete as ReturnType<typeof vi.fn>).mock.calls.length,
    ).toBe(2);
  });

  it("throws after two consecutive empty responses", async () => {
    const provider: LLMProvider = {
      complete: vi
        .fn()
        .mockRejectedValue(new Error("Judge returned empty response")),
    };
    const svc = new JudgeService(provider, 3);
    await expect(svc.evaluate(makeRequest())).rejects.toThrow("empty response");
  });
});
