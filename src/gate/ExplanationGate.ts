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

export class ExplanationGate {
  private ctx: GateContext = makeInitialContext();
  private readonly panel: GatePanel;

  constructor(
    extensionUri: vscode.Uri,
    private readonly judgeService: JudgeService,
    private readonly courseName: string,
    private readonly telemetry: TelemetryService,
  ) {
    this.panel = new GatePanel(extensionUri);
    this.panel.onSubmit((explanation) => this.handleSubmit(explanation));
    this.panel.onCancel(() => this.handleCancel());
  }

  async challenge(codeSnippet: string): Promise<boolean> {
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

    // SECURITY (MED-1): Hard stop after MAX_ATTEMPTS_PER_GATE to cap API costs.
    if (this.ctx.attemptCount >= MAX_ATTEMPTS_PER_GATE) {
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

    this.dispatch({
      type: "EXPLANATION_SUBMITTED",
      explanation: trimmedExplanation,
    });
    this.panel.send({ type: "judging" });

    this.telemetry.log({
      event: "explanation_submitted",
      attempt: this.ctx.attemptCount,
      explanationLength: trimmedExplanation.length,
    });

    try {
      const result = await this.judgeService.evaluate({
        codeSnippet: this.ctx.codeSnippet,
        explanation: trimmedExplanation,
        courseName: this.courseName,
      });

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
      // SECURITY (HIGH-2): Do NOT surface raw error messages from the LLM SDK
      // to the user — they may contain network details, URL fragments, or quota
      // information. Log to extension output channel; show a sanitized message.
      const sanitizedMsg = sanitizeErrorMessage(err);
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
    if (
      this.ctx.state === "WAITING_FOR_EXPLANATION" ||
      this.ctx.state === "FAIL"
    ) {
      this.dispatch({ type: "CANCELLED" });
      this.panel.dispose();
      this.telemetry.log({
        event: "gate_cancelled",
        totalAttempts: this.ctx.attemptCount,
      });
    }
  }

  dispose(): void {
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
