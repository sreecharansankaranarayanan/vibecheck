export type GateState =
  | 'IDLE'
  | 'WAITING_FOR_EXPLANATION'
  | 'JUDGING'
  | 'PASS'
  | 'FAIL';

export type GateEvent =
  | { type: 'GATE_TRIGGERED'; codeSnippet: string }
  | { type: 'EXPLANATION_SUBMITTED'; explanation: string }
  | { type: 'JUDGE_PASS' }
  | { type: 'JUDGE_FAIL' }
  | { type: 'CANCELLED' }
  | { type: 'RESET' };

export interface GateContext {
  readonly state: GateState;
  readonly codeSnippet: string;
  readonly attemptCount: number;
}
