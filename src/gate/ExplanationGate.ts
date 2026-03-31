import * as vscode from "vscode";
import { GatePanel } from "./GatePanel";
import { GateContext, GateEvent } from "./types";
import { transition, makeInitialContext } from "./GateStateMachine";
import { JudgeService } from "../judge/JudgeService";
import { TelemetryService } from "../telemetry/TelemetryService";

// SECURITY (MED-1): Cap the number of LLM calls per gate encounter to prevent
// unbounded API cost amplification from a student spamming the submit button.
const MAX_ATTEMPTS_PER_GATE = 20;

// SECURITY (HIGH-3): Cap the feedback string length rendered in the webview.
const MAX_FEEDBACK_LENGTH = 500;

// BV-7 fix: Minimum explanation length. Single characters and trivially short
// strings are rejected before reaching the judge to save API calls and signal
// to the student that a real explanation is required.
const MIN_EXPLANATION_LENGTH = 50;

// BV-1/JudgeFactory: JudgeService is created lazily so the extension can
// activate even when no API key has been set yet. The factory re-fetches the
// stored key on every call — setting a key mid-session takes effect immediately.
export type JudgeFactory = () => Promise<JudgeService | null>;

export class ExplanationGate {
  private ctx: GateContext = makeInitialContext();
  private readonly panel: GatePanel;

  // Cached judge service — null until the first successful factory call.
  // Cleared on auth errors so a freshly-set API key is picked up on retry.
  private judgeService: JudgeService | null = null;

  // BV-2 fix: Reentrancy guard. challenge() is async; if the interceptor calls
  // it concurrently (e.g. "Try Again" toast fires while flushBlockedQueue is
  // already running a gate), the second call must not overwrite the panel's
  // onSubmit/onCancel handlers and abandon the first Promise.
  private _challengeInProgress = false;

  // BV-10 fix: AbortController for the in-flight judge LLM call. Cancelling
  // the panel while JUDGING signals the abort so we can resolve the Promise
  // immediately instead of waiting for a network timeout.
  private _abortController: AbortController | null = null;

  constructor(
    extensionUri: vscode.Uri,
    private readonly judgeFactory: JudgeFactory,
    private readonly courseName: string,
    private readonly telemetry: TelemetryService,
  ) {
    this.panel = new GatePanel(extensionUri);
    // BV-4 (complement): Do NOT register onSubmit/onCancel here. challenge()
    // registers its own handlers that close over the Promise resolver. Constructor-
    // level handlers would be overwritten and never resolve anything — dead code.
  }

  // Returns false immediately if a challenge is already in progress.
  // Callers (AIChangeInterceptor) must treat false as "rejected, keep blocked".
  async challenge(codeSnippet: string): Promise<boolean> {
    // BV-2 fix: Reentrancy guard — prevents concurrent challenge() calls from
    // corrupting the shared panel state and abandoning Promises.
    if (this._challengeInProgress) {
      return false;
    }
    this._challengeInProgress = true;

    try {
      return await this._runChallenge(codeSnippet);
    } finally {
      this._challengeInProgress = false;
    }
  }

  private _runChallenge(codeSnippet: string): Promise<boolean> {
    return new Promise((resolve) => {
      this.ctx = this.dispatch({ type: "GATE_TRIGGERED", codeSnippet });
      this.panel.open(codeSnippet, this.ctx.attemptCount);
      this.telemetry.log({
        event: "gate_shown",
        attempt: 1,
        codeLength: codeSnippet.length,
      });

      this.panel.onSubmit(async (explanation) => {
        const passed = await this.handleSubmit(explanation);
        if (passed !== undefined) {
          resolve(passed);
        }
      });

      this.panel.onCancel(() => {
        this.handleCancel();
        resolve(false);
      });
    });
  }

  private dispatch(event: GateEvent): GateContext {
    const next = transition(this.ctx, event);
    this.ctx = next;
    return next;
  }

  private async handleSubmit(
    explanation: string,
  ): Promise<boolean | undefined> {
    if (this.ctx.state !== "WAITING_FOR_EXPLANATION") {
      return undefined;
    }

    // SECURITY (MED-5): Server-side length guard (client already has maxlength=2000).
    const trimmedExplanation = explanation.slice(0, 2000).trim();
    if (!trimmedExplanation) {
      return undefined;
    }

    // BV-7 fix: Enforce minimum explanation length before sending to the judge.
    // Prevents trivially short strings ("ok", "a", "done") from consuming API
    // quota and gives the student immediate feedback.
    if (trimmedExplanation.length < MIN_EXPLANATION_LENGTH) {
      this.panel.send({
        type: "fail",
        feedback: `Your explanation is too short (${trimmedExplanation.length} chars). Please write at least ${MIN_EXPLANATION_LENGTH} characters explaining what the code does and why.`,
        score: 1,
        attempt: this.ctx.attemptCount,
      });
      return undefined;
    }

    this.dispatch({
      type: "EXPLANATION_SUBMITTED",
      explanation: trimmedExplanation,
    });

    // SECURITY (MED-1): Hard stop after MAX_ATTEMPTS_PER_GATE to cap API costs.
    // Check AFTER dispatch so attemptCount reflects the just-submitted attempt.
    if (this.ctx.attemptCount > MAX_ATTEMPTS_PER_GATE) {
      vscode.window.showWarningMessage(
        `VibeCheck: Maximum attempts (${MAX_ATTEMPTS_PER_GATE}) reached. Code application blocked.`,
      );
      this.dispatch({ type: "CANCELLED" });
      this.panel.dispose();
      this.telemetry.log({
        event: "gate_cancelled",
        totalAttempts: this.ctx.attemptCount,
      });
      return false;
    }
    this.panel.send({ type: "judging" });

    this.telemetry.log({
      event: "explanation_submitted",
      attempt: this.ctx.attemptCount,
      explanationLength: trimmedExplanation.length,
    });

    // Lazily resolve the judge service at submit time.
    // Allows the gate to open (and block saves) even when no API key is set —
    // the student sees a clear prompt to set one before retrying.
    if (!this.judgeService) {
      this.judgeService = await this.judgeFactory();
    }

    if (!this.judgeService) {
      const msg =
        'No API key set. Run "VibeCheck: Set Judge API Key" from the command palette, then try again.';
      vscode.window.showWarningMessage(`VibeCheck: ${msg}`);
      this.dispatch({ type: "JUDGE_FAIL" });
      this.dispatch({
        type: "GATE_TRIGGERED",
        codeSnippet: this.ctx.codeSnippet,
      });
      this.panel.send({
        type: "fail",
        feedback: msg,
        score: 1,
        attempt: this.ctx.attemptCount,
      });
      return undefined;
    }

    // BV-10 fix: Create a fresh AbortController for every judge call. If the
    // panel is closed while the LLM call is in-flight, handleCancel() aborts
    // the request so handleSubmit can return immediately rather than leaving
    // the Promise hanging and globalGateOpen stuck at true permanently.
    this._abortController = new AbortController();
    const { signal } = this._abortController;

    try {
      const result = await this.judgeService.evaluate(
        {
          codeSnippet: this.ctx.codeSnippet,
          explanation: trimmedExplanation,
          courseName: this.courseName,
        },
        signal,
      );

      this._abortController = null;

      // SECURITY (HIGH-3): Cap feedback length before sending to webview.
      const safeFeedback = result.feedback.slice(0, MAX_FEEDBACK_LENGTH);

      this.telemetry.log({
        event: "judge_response",
        score: result.score,
        passed: result.passed,
        attempt: this.ctx.attemptCount,
      });

      if (result.passed) {
        this.dispatch({ type: "JUDGE_PASS" });
        this.panel.send({ type: "pass" });
        this.telemetry.log({
          event: "gate_passed",
          totalAttempts: this.ctx.attemptCount,
        });

        setTimeout(() => {
          this.panel.dispose();
          this.ctx = makeInitialContext();
        }, 1200);

        return true;
      } else {
        this.dispatch({ type: "JUDGE_FAIL" });
        this.dispatch({
          type: "GATE_TRIGGERED",
          codeSnippet: this.ctx.codeSnippet,
        });
        this.panel.send({
          type: "fail",
          feedback: safeFeedback,
          score: result.score,
          attempt: this.ctx.attemptCount,
        });
        return undefined;
      }
    } catch (err) {
      this._abortController = null;

      // BV-10 fix: If the abort was triggered by handleCancel(), do not
      // show an error — the panel is already closed. Return false to resolve
      // the Promise and let the interceptor handle the blocked state.
      if (signal.aborted) {
        return false;
      }

      // SECURITY (HIGH-2): Do NOT surface raw error messages from the LLM SDK
      // to the user — they may contain network details, URL fragments, or quota
      // information. Log to extension output channel; show a sanitized message.
      const sanitizedMsg = sanitizeErrorMessage(err);

      // Clear cached judge service on auth errors so a freshly-set API key is
      // picked up on the next submission attempt.
      if (
        err instanceof Error &&
        (err.message.toLowerCase().includes("401") ||
          err.message.toLowerCase().includes("unauthorized") ||
          err.message.toLowerCase().includes("api key"))
      ) {
        this.judgeService = null;
      }

      vscode.window.showErrorMessage(
        `VibeCheck: Judge evaluation failed. ${sanitizedMsg}`,
      );
      this.dispatch({ type: "JUDGE_FAIL" });
      this.dispatch({
        type: "GATE_TRIGGERED",
        codeSnippet: this.ctx.codeSnippet,
      });
      this.panel.send({
        type: "fail",
        feedback: `Evaluation failed. ${sanitizedMsg}`,
        score: 1,
        attempt: this.ctx.attemptCount,
      });
      return undefined;
    }
  }

  private handleCancel(): void {
    // BV-10 fix: Cancel any in-flight judge LLM call first. The AbortController
    // signal is checked in handleSubmit's catch block — it will return false and
    // resolve the Promise immediately rather than waiting for a network timeout.
    if (this._abortController) {
      this._abortController.abort();
      this._abortController = null;
    }

    // BV-10 fix: Removed the state guard that previously only handled
    // WAITING_FOR_EXPLANATION and FAIL. If the panel is closed while JUDGING,
    // we must still dispatch CANCELLED — the state machine now allows this
    // transition (GateStateMachine.ts was updated accordingly). Without this,
    // the Promise in challenge() never resolves when closed mid-judge-call.
    const cancellableStates = [
      "WAITING_FOR_EXPLANATION",
      "JUDGING",
      "FAIL",
    ] as const;
    if (
      cancellableStates.includes(
        this.ctx.state as (typeof cancellableStates)[number],
      )
    ) {
      this.dispatch({ type: "CANCELLED" });
      // BV-1 fix: Do NOT call this.panel.dispose() here. GatePanel already
      // invokes this handler FROM onDidDispose — calling dispose() back creates
      // a cycle: handleCancel → panel.dispose() → onDidDispose → handleCancel.
      // GatePanel._disposed guards against the double-call, but the cleaner fix
      // is to simply not initiate disposal from this side of the callback.
      this.telemetry.log({
        event: "gate_cancelled",
        totalAttempts: this.ctx.attemptCount,
      });
    }
  }

  dispose(): void {
    this._abortController?.abort();
    this._abortController = null;
    this.panel.dispose();
  }
}

// SECURITY (HIGH-2): Map raw error to a user-safe message.
// Strips network details, URLs, and stack traces that could expose internals.
function sanitizeErrorMessage(err: unknown): string {
  if (!(err instanceof Error)) {
    return "An unexpected error occurred. Check your API key and network connection.";
  }
  const msg = err.message.toLowerCase();
  if (
    msg.includes("401") ||
    msg.includes("unauthorized") ||
    msg.includes("api key") ||
    msg.includes("authentication")
  ) {
    return 'Invalid API key. Run "VibeCheck: Set Judge API Key" to update it.';
  }
  if (
    msg.includes("429") ||
    msg.includes("rate limit") ||
    msg.includes("quota")
  ) {
    return "Rate limit reached on the Judge API. Please wait a moment and try again.";
  }
  if (
    msg.includes("timeout") ||
    msg.includes("network") ||
    msg.includes("econnrefused") ||
    msg.includes("enotfound")
  ) {
    return "Network error contacting the Judge. Check your internet connection and base URL setting.";
  }
  if (msg.includes("json") || msg.includes("parse") || msg.includes("syntax")) {
    return "Judge returned an unexpected response format. Try again.";
  }
  // Generic safe fallback — no raw message exposed
  return "Check your settings (Cmd+, → VibeCheck) and try again.";
}
