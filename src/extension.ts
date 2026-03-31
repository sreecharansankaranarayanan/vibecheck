import * as vscode from "vscode";
import { ConfigService } from "./config/ConfigService";
import { createProvider } from "./judge/providers/ProviderFactory";
import { JudgeService } from "./judge/JudgeService";
import { ExplanationGate, JudgeFactory } from "./gate/ExplanationGate";
import { InterceptorRegistry } from "./interceptors/InterceptorRegistry";
import { TelemetryService } from "./telemetry/TelemetryService";
import { COMMANDS } from "./constants";
import { InterceptedEvent } from "./interceptors/types";

let registry: InterceptorRegistry | undefined;
let gate: ExplanationGate | undefined;

// BV-4 fix: Track the extension context so teardown() can safely restore
// checkpointed files before destroying the interceptor.
let extensionContext: vscode.ExtensionContext | undefined;

export async function activate(
  context: vscode.ExtensionContext,
): Promise<void> {
  extensionContext = context;
  const configService = new ConfigService(context.secrets);

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand(COMMANDS.ENABLE, () => {
      vscode.workspace
        .getConfiguration()
        .update("vibecheck.enabled", true, true);
      vscode.window.showInformationMessage(
        "VibeCheck: Explanation Gate enabled.",
      );
    }),

    vscode.commands.registerCommand(COMMANDS.DISABLE, () => {
      vscode.workspace
        .getConfiguration()
        .update("vibecheck.enabled", false, true);
      vscode.window.showInformationMessage(
        "VibeCheck: Explanation Gate disabled.",
      );
    }),

    vscode.commands.registerCommand(COMMANDS.SET_API_KEY, async () => {
      await configService.promptAndSaveApiKey();
    }),

    vscode.commands.registerCommand(COMMANDS.SHOW_TELEMETRY, () => {
      const telemetry = getTelemetry();
      const logPath = telemetry?.getLogPath();
      if (logPath) {
        vscode.window
          .showInformationMessage(`VibeCheck telemetry log: ${logPath}`, "Open")
          .then((choice) => {
            if (choice === "Open") {
              vscode.commands.executeCommand(
                "vscode.open",
                vscode.Uri.file(logPath),
              );
            }
          });
      } else {
        vscode.window.showInformationMessage(
          "VibeCheck: Telemetry is disabled. Enable it in Settings.",
        );
      }
    }),
  );

  // Initial setup
  await setupGate(context, configService);

  // Re-setup when config changes.
  // BV-4 fix: teardown() is now async and restores checkpointed files before
  // destroying the interceptor, so a config change mid-gate does not silently
  // leave files with AI content on disk.
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(async (e) => {
      if (e.affectsConfiguration("vibecheck")) {
        await safeTeardown();
        await setupGate(context, configService);
      }
    }),
  );
}

let currentTelemetry: TelemetryService | undefined;

function getTelemetry(): TelemetryService | undefined {
  return currentTelemetry;
}

async function setupGate(
  context: vscode.ExtensionContext,
  configService: ConfigService,
): Promise<void> {
  const config = configService.get();

  if (!config.enabled) {
    vscode.window.setStatusBarMessage("$(circle-slash) VibeCheck OFF", 3000);
    return;
  }

  // BUG FIX (#1): Do NOT gate interceptor activation on API key availability.
  // Previously this returned early when no key was set, leaving zero listeners
  // registered and making the extension a ghost. Now interceptors always activate
  // when enabled; the key is only required at explanation-submit time.
  //
  // Show a non-blocking hint so users know to set a key, but continue setup.
  const apiKey = await configService.getApiKey();
  if (!apiKey) {
    vscode.window
      .showWarningMessage(
        "VibeCheck: No API key set. Interception is active — set a key before submitting explanations.",
        "Set API Key",
      )
      .then((choice) => {
        if (choice === "Set API Key") {
          vscode.commands.executeCommand(COMMANDS.SET_API_KEY);
        }
      });
  }

  const telemetry = new TelemetryService(
    config.telemetryEnabled,
    context.globalStorageUri,
  );
  currentTelemetry = telemetry;

  // JudgeFactory: lazily resolved on first explanation submit.
  // Re-fetches the API key each time so that setting a key mid-session works
  // without requiring a VS Code reload or extension restart.
  const judgeFactory: JudgeFactory = async () => {
    const key = await configService.getApiKey();
    if (!key) return null;
    const provider = createProvider(config.judgeProvider, {
      model: config.judgeModel,
      apiKey: key,
      baseUrl: config.judgeBaseUrl || undefined,
      temperature: config.judgeTemperature,
    });
    return new JudgeService(provider, config.passThreshold);
  };

  gate = new ExplanationGate(
    context.extensionUri,
    judgeFactory,
    config.courseName,
    telemetry,
  );

  registry = new InterceptorRegistry(config);
  // BV-3 fix: Pass workspaceState so AIChangeInterceptor can persist blocked
  // file entries across extension restarts and "Restart Extension Host".
  registry.activate(async (event: InterceptedEvent) => {
    return gate!.challenge(event.codeSnippet);
  }, context.workspaceState);

  context.subscriptions.push({ dispose: () => void safeTeardown() });

  vscode.window.setStatusBarMessage("$(shield) VibeCheck ON", 3000);
}

// BV-4 fix: Safe teardown restores all checkpointed files to their pre-AI
// content before destroying the interceptor. This prevents a config change
// (or the vibecheck.enabled toggle) from leaving files with AI content on disk
// when a gate is interrupted mid-flight.
async function safeTeardown(): Promise<void> {
  if (registry) {
    const checkpoints = registry.getActiveCheckpoints();
    // Restore each gated/blocked file to its pre-AI checkpoint before teardown.
    for (const [uriKey, checkpoint] of checkpoints.entries()) {
      try {
        const uri = vscode.Uri.parse(uriKey);
        // Write checkpoint to disk directly — the interceptor's Listener 2 is
        // still active at this point and would block a normal VS Code save.
        await vscode.workspace.fs.writeFile(
          uri,
          Buffer.from(checkpoint, "utf8"),
        );
        // Also restore in-memory so the editor shows the checkpoint content.
        const doc = vscode.workspace.textDocuments.find(
          (d) => d.uri.toString() === uriKey,
        );
        if (doc && doc.getText() !== checkpoint) {
          const edit = new vscode.WorkspaceEdit();
          const fullRange = new vscode.Range(
            doc.positionAt(0),
            doc.positionAt(doc.getText().length),
          );
          edit.replace(uri, fullRange, checkpoint);
          await vscode.workspace.applyEdit(edit);
        }
      } catch (err) {
        console.error(
          `VibeCheck: failed to restore checkpoint for ${uriKey}`,
          err,
        );
      }
    }
    if (checkpoints.size > 0) {
      vscode.window.showWarningMessage(
        `VibeCheck: Settings changed — ${checkpoints.size} gated file(s) reverted to checkpoint.`,
      );
    }
  }

  registry?.deactivate();
  registry = undefined;
  gate?.dispose();
  gate = undefined;
}

export async function deactivate(): Promise<void> {
  await safeTeardown();
}
