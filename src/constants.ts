export const COMMANDS = {
  ENABLE: "vibecheck.enable",
  DISABLE: "vibecheck.disable",
  SET_API_KEY: "vibecheck.setApiKey",
  SHOW_TELEMETRY: "vibecheck.showTelemetry",
} as const;

export const INTERCEPTED_COMMANDS = {
  CURSOR_APPLY: "aichat.applyCodeBlock",
  CURSOR_ACCEPT_STEP: "composer.acceptComposerStep",
  CURSOR_ACCEPT_ALL_FILES: "chatEditing.acceptAllFiles",
  CURSOR_ACCEPT_INLINE_DIFFS: "editor.action.inlineDiffs.acceptAll",
  COPILOT_ACCEPT: "editor.action.inlineSuggest.commit",
  INLINE_ACCEPT: "acceptSelectedSuggestion",
} as const;

export const CONFIG_KEYS = {
  ENABLED: "vibecheck.enabled",
  COURSE_NAME: "vibecheck.courseName",
  JUDGE_PROVIDER: "vibecheck.judgeProvider",
  JUDGE_MODEL: "vibecheck.judgeModel",
  JUDGE_BASE_URL: "vibecheck.judgeBaseUrl",
  JUDGE_TEMPERATURE: "vibecheck.judgeTemperature",
  PASS_THRESHOLD: "vibecheck.passThreshold",
  INTERCEPT_CURSOR: "vibecheck.interceptCursor",
  INTERCEPT_COPILOT: "vibecheck.interceptCopilot",
  INTERCEPT_INLINE: "vibecheck.interceptInline",
  TELEMETRY_ENABLED: "vibecheck.telemetryEnabled",
} as const;

export const SECRET_KEYS = {
  JUDGE_API_KEY: "vibecheck.judgeApiKey",
} as const;

export const WEBVIEW_ID = "vibecheck.explanationGate";
export const WEBVIEW_TITLE = "VibeCheck — Explain This Code";
