// Webview-side script (runs in the webview iframe, not in the extension host)
// Communicates with the extension host via vscode.postMessage

// VS Code webview API
declare function acquireVsCodeApi(): {
  postMessage(message: unknown): void;
  getState(): unknown;
  setState(state: unknown): void;
};

type ExtToWebview =
  | { type: "show"; code: string; attempt: number }
  | { type: "judging" }
  | { type: "fail"; feedback: string; score: number; attempt: number }
  | { type: "pass" };

const vscode = acquireVsCodeApi();

const codePreview = document.getElementById("code-preview") as HTMLDivElement;
const explanationInput = document.getElementById(
  "explanation",
) as HTMLTextAreaElement;
const submitBtn = document.getElementById("submit-btn") as HTMLButtonElement;
const cancelBtn = document.getElementById("cancel-btn") as HTMLButtonElement;
const feedbackBox = document.getElementById("feedback-box") as HTMLDivElement;
const feedbackScore = document.getElementById(
  "feedback-score",
) as HTMLDivElement;
const feedbackText = document.getElementById("feedback-text") as HTMLDivElement;
const judgingIndicator = document.getElementById(
  "judging-indicator",
) as HTMLDivElement;
const attemptBadge = document.getElementById(
  "attempt-badge",
) as HTMLSpanElement;

function setJudging(active: boolean): void {
  submitBtn.disabled = active;
  cancelBtn.disabled = active;
  explanationInput.disabled = active;
  judgingIndicator.classList.toggle("active", active);
}

function showFeedback(
  type: "fail" | "pass",
  score: number,
  text: string,
): void {
  feedbackBox.className = `feedback-box ${type}`;
  feedbackScore.textContent =
    type === "fail"
      ? `Score ${score}/5 — Not yet at Relational level (3+). Try again:`
      : `Score ${score}/5 — `;
  feedbackText.textContent = text;
}

function clearFeedback(): void {
  feedbackBox.className = "feedback-box";
  feedbackScore.textContent = "";
  feedbackText.textContent = "";
}

submitBtn.addEventListener("click", () => {
  const explanation = explanationInput.value.trim();
  if (!explanation) {
    explanationInput.focus();
    explanationInput.style.borderColor = "var(--warning-border)";
    setTimeout(() => {
      explanationInput.style.borderColor = "";
    }, 1500);
    return;
  }
  vscode.postMessage({ type: "submit", explanation });
});

cancelBtn.addEventListener("click", () => {
  vscode.postMessage({ type: "cancel" });
});

// Allow Ctrl+Enter / Cmd+Enter to submit
explanationInput.addEventListener("keydown", (e: KeyboardEvent) => {
  if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
    submitBtn.click();
  }
});

window.addEventListener("message", (event: MessageEvent) => {
  const message = event.data as ExtToWebview;

  switch (message.type) {
    case "show": {
      clearFeedback();
      setJudging(false);
      codePreview.textContent = message.code;
      attemptBadge.textContent = `Attempt ${message.attempt + 1}`;
      explanationInput.focus();
      break;
    }

    case "judging": {
      setJudging(true);
      break;
    }

    case "fail": {
      setJudging(false);
      attemptBadge.textContent = `Attempt ${message.attempt + 1}`;
      showFeedback("fail", message.score, message.feedback);
      explanationInput.focus();
      // Move cursor to end of existing text so user can continue refining
      const len = explanationInput.value.length;
      explanationInput.setSelectionRange(len, len);
      break;
    }

    case "pass": {
      setJudging(false);
      showFeedback("pass", 5, "Great explanation! Code is being applied...");
      submitBtn.disabled = true;
      cancelBtn.disabled = true;
      break;
    }
  }
});
