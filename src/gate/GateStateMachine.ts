import { GateContext, GateEvent, GateState } from './types';

/**
 * Pure state transition function — no side effects.
 * Returns a new GateContext given a current context and an event.
 * Throws on invalid transitions so callers surface bugs early.
 */
export function transition(ctx: GateContext, event: GateEvent): GateContext {
  switch (ctx.state) {
    case 'IDLE': {
      if (event.type === 'GATE_TRIGGERED') {
        return { state: 'WAITING_FOR_EXPLANATION', codeSnippet: event.codeSnippet, attemptCount: 0 };
      }
      break;
    }

    case 'WAITING_FOR_EXPLANATION': {
      if (event.type === 'EXPLANATION_SUBMITTED') {
        return { ...ctx, state: 'JUDGING', attemptCount: ctx.attemptCount + 1 };
      }
      if (event.type === 'CANCELLED') {
        return { state: 'IDLE', codeSnippet: '', attemptCount: 0 };
      }
      break;
    }

    case 'JUDGING': {
      if (event.type === 'JUDGE_PASS') {
        return { ...ctx, state: 'PASS' };
      }
      if (event.type === 'JUDGE_FAIL') {
        return { ...ctx, state: 'FAIL' };
      }
      break;
    }

    case 'PASS':
    case 'FAIL': {
      if (event.type === 'RESET') {
        return { state: 'IDLE', codeSnippet: '', attemptCount: 0 };
      }
      // FAIL can loop back to WAITING for a retry
      if (ctx.state === 'FAIL' && event.type === 'GATE_TRIGGERED') {
        return { state: 'WAITING_FOR_EXPLANATION', codeSnippet: ctx.codeSnippet, attemptCount: ctx.attemptCount };
      }
      break;
    }
  }

  throw new Error(`Invalid transition: ${ctx.state} + ${event.type}`);
}

export function makeInitialContext(): GateContext {
  return { state: 'IDLE', codeSnippet: '', attemptCount: 0 };
}

export function isTerminalState(state: GateState): boolean {
  return state === 'PASS' || state === 'IDLE';
}
