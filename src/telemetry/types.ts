export type TelemetryEvent =
  | { event: 'gate_shown'; attempt: number; codeLength: number }
  | { event: 'explanation_submitted'; attempt: number; explanationLength: number }
  | { event: 'judge_response'; score: number; passed: boolean; attempt: number }
  | { event: 'gate_passed'; totalAttempts: number }
  | { event: 'gate_cancelled'; totalAttempts: number };

export type TelemetryRecord = TelemetryEvent & { timestamp: number };
