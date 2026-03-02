import * as vscode from "vscode";
import { CONFIG_KEYS, SECRET_KEYS } from "../constants";

export type JudgeProvider = "openai" | "anthropic" | "ollama";

export interface VibeCheckConfig {
  readonly enabled: boolean;
  readonly courseName: string;
  readonly judgeProvider: JudgeProvider;
  readonly judgeModel: string;
  readonly judgeBaseUrl: string;
  readonly judgeTemperature: number;
  readonly passThreshold: number;
  readonly interceptCursor: boolean;
  readonly interceptCopilot: boolean;
  readonly interceptInline: boolean;
  readonly telemetryEnabled: boolean;
}

export class ConfigService {
  constructor(private readonly secrets: vscode.SecretStorage) {}

  get(): VibeCheckConfig {
    const cfg = vscode.workspace.getConfiguration();
    const rawBaseUrl = cfg.get<string>(CONFIG_KEYS.JUDGE_BASE_URL, "");

    return {
      enabled: cfg.get<boolean>(CONFIG_KEYS.ENABLED, true),
      // SECURITY (CRIT-3): Sanitize courseName — strip newlines/control chars
      // that could break out of the system prompt context.
      courseName: sanitizeCourseName(
        cfg.get<string>(CONFIG_KEYS.COURSE_NAME, "React"),
      ),
      judgeProvider: cfg.get<JudgeProvider>(
        CONFIG_KEYS.JUDGE_PROVIDER,
        "openai",
      ),
      judgeModel: cfg.get<string>(CONFIG_KEYS.JUDGE_MODEL, "gpt-4o"),
      // SECURITY (HIGH-1): Validate base URL to prevent SSRF / API key exfiltration
      // via a malicious workspace .vscode/settings.json.
      judgeBaseUrl: validateBaseUrl(rawBaseUrl),
      judgeTemperature: clamp(
        cfg.get<number>(CONFIG_KEYS.JUDGE_TEMPERATURE, 0.1),
        0,
        2,
      ),
      passThreshold: clampInt(
        cfg.get<number>(CONFIG_KEYS.PASS_THRESHOLD, 3),
        1,
        5,
      ),
      interceptCursor: cfg.get<boolean>(CONFIG_KEYS.INTERCEPT_CURSOR, true),
      interceptCopilot: cfg.get<boolean>(CONFIG_KEYS.INTERCEPT_COPILOT, true),
      interceptInline: cfg.get<boolean>(CONFIG_KEYS.INTERCEPT_INLINE, false),
      telemetryEnabled: cfg.get<boolean>(CONFIG_KEYS.TELEMETRY_ENABLED, false),
    };
  }

  async getApiKey(): Promise<string | undefined> {
    return this.secrets.get(SECRET_KEYS.JUDGE_API_KEY);
  }

  async setApiKey(key: string): Promise<void> {
    await this.secrets.store(SECRET_KEYS.JUDGE_API_KEY, key);
  }

  async promptAndSaveApiKey(): Promise<boolean> {
    const key = await vscode.window.showInputBox({
      title: "VibeCheck: Set Judge API Key",
      prompt:
        "Enter your API key for the Judge LLM (stored securely in VS Code SecretStorage)",
      password: true,
      ignoreFocusOut: true,
    });
    if (!key) {
      return false;
    }
    await this.setApiKey(key);
    vscode.window.showInformationMessage("VibeCheck: API key saved.");
    return true;
  }
}

// SECURITY (CRIT-3 / MED-2): Strip newlines, control chars, and limit length.
// Prevents prompt injection via workspace-controlled courseName.
function sanitizeCourseName(name: string): string {
  const cleaned = name
    .replace(/[\r\n\t]/g, " ") // Replace newlines/tabs with spaces
    .replace(/[\x00-\x1F\x7F]/g, "") // Strip other ASCII control chars
    .slice(0, 100) // Hard cap at 100 chars
    .trim();
  return cleaned || "React"; // Default if empty after sanitization
}

// SECURITY (HIGH-1): Only allow HTTPS URLs or localhost HTTP.
// Rejects arbitrary URLs that could redirect API calls (and API keys) to
// attacker-controlled servers via workspace .vscode/settings.json.
function validateBaseUrl(url: string): string {
  if (!url) return url;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(
      `VibeCheck: vibecheck.judgeBaseUrl is not a valid URL: "${url}". ` +
        "Please check your settings.",
    );
  }
  const isHttps = parsed.protocol === "https:";
  const isLocalhost =
    parsed.protocol === "http:" &&
    (parsed.hostname === "localhost" ||
      parsed.hostname === "127.0.0.1" ||
      parsed.hostname === "::1");

  if (!isHttps && !isLocalhost) {
    throw new Error(
      `VibeCheck: vibecheck.judgeBaseUrl must be an HTTPS URL or a localhost HTTP URL. ` +
        `Got: "${url}". This restriction prevents API key exfiltration.`,
    );
  }
  return url;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function clampInt(v: number, min: number, max: number): number {
  return Math.round(clamp(v, min, max));
}
