import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { TelemetryEvent, TelemetryRecord } from './types';

// SECURITY (MED-4): Cap log file size to prevent unbounded disk usage.
const MAX_LOG_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB per daily log file

/**
 * Privacy-first telemetry: all data stays local on the user's machine.
 * Writes JSONL to globalStorageUri only when explicitly enabled.
 * Only numeric/boolean metadata is logged — never the code snippet or explanation text.
 */
export class TelemetryService {
  private logPath: string | undefined;

  constructor(
    private readonly enabled: boolean,
    globalStorageUri: vscode.Uri,
  ) {
    if (enabled) {
      const dir = globalStorageUri.fsPath;
      fs.mkdirSync(dir, { recursive: true });
      this.logPath = path.join(dir, `vibecheck-${dateStamp()}.jsonl`);
    }
  }

  log(event: TelemetryEvent): void {
    if (!this.enabled || !this.logPath) {
      return;
    }

    // SECURITY (MED-4): Check file size before writing; stop logging if cap reached.
    try {
      const stat = fs.statSync(this.logPath);
      if (stat.size >= MAX_LOG_SIZE_BYTES) {
        return; // Silently stop — never crash the extension for telemetry
      }
    } catch {
      // File doesn't exist yet — that's fine, proceed to write
    }

    const record: TelemetryRecord = { ...event, timestamp: Date.now() };
    try {
      fs.appendFileSync(this.logPath, JSON.stringify(record) + '\n', 'utf8');
    } catch {
      // Telemetry must never crash the extension
    }
  }

  getLogPath(): string | undefined {
    return this.logPath;
  }
}

function dateStamp(): string {
  return new Date().toISOString().slice(0, 10);
}
