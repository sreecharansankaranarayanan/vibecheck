import { GateContext, GateEvent, GateState } from "./types";

/**
 * Pure state transition function — no side effects.
 * Returns a new GateContext given a current context and an event.
 * Throws on invalid transitions so callers surface bugs early.
 */
export function transition(ctx: GateContext, event: GateEvent): GateContext {
  switch (ctx.state) {
    case "IDLE": {
      if (event.type === "GATE_TRIGGERED") {
        return {
          state: "WAITING_FOR_EXPLANATION",
          codeSnippet: event.codeSnippet,
          attemptCount: 0,
        };
      }
      break;
    }

    case "WAITING_FOR_EXPLANATION": {
      if (event.type === "EXPLANATION_SUBMITTED") {
        return { ...ctx, state: "JUDGING", attemptCount: ctx.attemptCount + 1 };
      }
      if (event.type === "CANCELLED") {
        return { state: "IDLE", codeSnippet: "", attemptCount: 0 };
      }
      break;
    }

    case "JUDGING": {
      if (event.type === "JUDGE_PASS") {
        return { ...ctx, state: "PASS" };
      }
      if (event.type === "JUDGE_FAIL") {
        return { ...ctx, state: "FAIL" };
      }
      // BV-10 fix: Allow cancellation while the judge LLM call is in-flight.
      // Without this, closing the panel during judging leaves the state machine
      // stuck and the Promise in challenge() never resolves, keeping
      // globalGateOpen=true permanently and deadlocking the extension.
      if (event.type === "CANCELLED") {
        return { state: "IDLE", codeSnippet: "", attemptCount: 0 };
      }
      break;
    }

    case "FAIL": {
      if (event.type === "RESET") {
        return { state: "IDLE", codeSnippet: "", attemptCount: 0 };
      }
      // FAIL can loop back to WAITING for a retry
      if (event.type === "GATE_TRIGGERED") {
        return {
          state: "WAITING_FOR_EXPLANATION",
          codeSnippet: ctx.codeSnippet,
          attemptCount: ctx.attemptCount,
        };
      }
      if (event.type === "CANCELLED") {
        return { state: "IDLE", codeSnippet: "", attemptCount: 0 };
      }
      break;
    }

    case "PASS": {
      if (event.type === "RESET") {
        return { state: "IDLE", codeSnippet: "", attemptCount: 0 };
      }
      // Allow CANCELLED in PASS state: if the student closes the panel within
      // the 1200ms auto-close window, onDidDispose fires before setTimeout
      // calls panel.dispose(). Without this, the transition throws a noisy
      // uncaught error in the extension host output.
      if (event.type === "CANCELLED") {
        return { state: "IDLE", codeSnippet: "", attemptCount: 0 };
      }
      break;
    }
  }

  throw new Error(`Invalid transition: ${ctx.state} + ${event.type}`);
}

export function makeInitialContext(): GateContext {
  return { state: "IDLE", codeSnippet: "", attemptCount: 0 };
}

export function isTerminalState(state: GateState): boolean {
  return state === "PASS" || state === "IDLE";
}
