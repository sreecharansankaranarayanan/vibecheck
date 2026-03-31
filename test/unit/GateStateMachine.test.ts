import { describe, it, expect } from "vitest";
import {
  transition,
  makeInitialContext,
} from "../../src/gate/GateStateMachine";
import { GateContext } from "../../src/gate/types";

describe("GateStateMachine", () => {
  it("starts in IDLE state", () => {
    const ctx = makeInitialContext();
    expect(ctx.state).toBe("IDLE");
    expect(ctx.attemptCount).toBe(0);
    expect(ctx.codeSnippet).toBe("");
  });

  it("IDLE → WAITING_FOR_EXPLANATION on GATE_TRIGGERED", () => {
    const ctx = makeInitialContext();
    const next = transition(ctx, {
      type: "GATE_TRIGGERED",
      codeSnippet: "const x = 1;",
    });
    expect(next.state).toBe("WAITING_FOR_EXPLANATION");
    expect(next.codeSnippet).toBe("const x = 1;");
    expect(next.attemptCount).toBe(0);
  });

  it("WAITING → JUDGING on EXPLANATION_SUBMITTED, increments attempt count", () => {
    const ctx: GateContext = {
      state: "WAITING_FOR_EXPLANATION",
      codeSnippet: "const x = 1;",
      attemptCount: 0,
    };
    const next = transition(ctx, {
      type: "EXPLANATION_SUBMITTED",
      explanation: "it assigns 1 to x",
    });
    expect(next.state).toBe("JUDGING");
    expect(next.attemptCount).toBe(1);
  });

  it("JUDGING → PASS on JUDGE_PASS", () => {
    const ctx: GateContext = {
      state: "JUDGING",
      codeSnippet: "x",
      attemptCount: 1,
    };
    const next = transition(ctx, { type: "JUDGE_PASS" });
    expect(next.state).toBe("PASS");
  });

  it("JUDGING → FAIL on JUDGE_FAIL", () => {
    const ctx: GateContext = {
      state: "JUDGING",
      codeSnippet: "x",
      attemptCount: 1,
    };
    const next = transition(ctx, { type: "JUDGE_FAIL" });
    expect(next.state).toBe("FAIL");
  });

  it("FAIL → WAITING on GATE_TRIGGERED (retry), preserves attempt count", () => {
    const ctx: GateContext = {
      state: "FAIL",
      codeSnippet: "x",
      attemptCount: 2,
    };
    const next = transition(ctx, { type: "GATE_TRIGGERED", codeSnippet: "x" });
    expect(next.state).toBe("WAITING_FOR_EXPLANATION");
    expect(next.attemptCount).toBe(2);
  });

  it("WAITING → IDLE on CANCELLED", () => {
    const ctx: GateContext = {
      state: "WAITING_FOR_EXPLANATION",
      codeSnippet: "x",
      attemptCount: 1,
    };
    const next = transition(ctx, { type: "CANCELLED" });
    expect(next.state).toBe("IDLE");
    expect(next.codeSnippet).toBe("");
  });

  it("PASS → IDLE on RESET", () => {
    const ctx: GateContext = {
      state: "PASS",
      codeSnippet: "x",
      attemptCount: 1,
    };
    const next = transition(ctx, { type: "RESET" });
    expect(next.state).toBe("IDLE");
  });

  it("throws on invalid transition", () => {
    const ctx = makeInitialContext();
    expect(() =>
      transition(ctx, { type: "EXPLANATION_SUBMITTED", explanation: "hi" }),
    ).toThrow();
    expect(() => transition(ctx, { type: "JUDGE_PASS" })).toThrow();
    expect(() => transition(ctx, { type: "CANCELLED" })).toThrow();
  });

  it("does not mutate the original context", () => {
    const original = makeInitialContext();
    const next = transition(original, {
      type: "GATE_TRIGGERED",
      codeSnippet: "test",
    });
    expect(original.state).toBe("IDLE");
    expect(next.state).toBe("WAITING_FOR_EXPLANATION");
  });

  // BV-10 regression: closing the panel mid-judge-call must resolve cleanly
  it("JUDGING → IDLE on CANCELLED (BV-10)", () => {
    const ctx: GateContext = {
      state: "JUDGING",
      codeSnippet: "x",
      attemptCount: 1,
    };
    const next = transition(ctx, { type: "CANCELLED" });
    expect(next.state).toBe("IDLE");
    expect(next.codeSnippet).toBe("");
    expect(next.attemptCount).toBe(0);
  });

  it("FAIL → IDLE on CANCELLED", () => {
    const ctx: GateContext = {
      state: "FAIL",
      codeSnippet: "x",
      attemptCount: 3,
    };
    const next = transition(ctx, { type: "CANCELLED" });
    expect(next.state).toBe("IDLE");
    expect(next.codeSnippet).toBe("");
    expect(next.attemptCount).toBe(0);
  });

  // Regression for fix: closing panel within 1200ms auto-close window must not throw
  it("PASS → IDLE on CANCELLED (panel closed before auto-dispose)", () => {
    const ctx: GateContext = {
      state: "PASS",
      codeSnippet: "x",
      attemptCount: 2,
    };
    const next = transition(ctx, { type: "CANCELLED" });
    expect(next.state).toBe("IDLE");
    expect(next.codeSnippet).toBe("");
    expect(next.attemptCount).toBe(0);
  });

  // IDLE + CANCELLED is still an invalid transition — guard against regression
  it("IDLE throws on CANCELLED (invalid transition)", () => {
    const ctx = makeInitialContext();
    expect(() => transition(ctx, { type: "CANCELLED" })).toThrow(
      "Invalid transition",
    );
  });
});
