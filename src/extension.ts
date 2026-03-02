import * as vscode from 'vscode';
import { ConfigService } from './config/ConfigService';
import { createProvider } from './judge/providers/ProviderFactory';
import { JudgeService } from './judge/JudgeService';
import { ExplanationGate } from './gate/ExplanationGate';
import { InterceptorRegistry } from './interceptors/InterceptorRegistry';
import { TelemetryService } from './telemetry/TelemetryService';
import { COMMANDS } from './constants';
import { InterceptedEvent } from './interceptors/types';

let registry: InterceptorRegistry | undefined;
let gate: ExplanationGate | undefined;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const configService = new ConfigService(context.secrets);

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand(COMMANDS.ENABLE, () => {
      vscode.workspace.getConfiguration().update('vibecheck.enabled', true, true);
      vscode.window.showInformationMessage('VibeCheck: Explanation Gate enabled.');
    }),

    vscode.commands.registerCommand(COMMANDS.DISABLE, () => {
      vscode.workspace.getConfiguration().update('vibecheck.enabled', false, true);
      vscode.window.showInformationMessage('VibeCheck: Explanation Gate disabled.');
    }),

    vscode.commands.registerCommand(COMMANDS.SET_API_KEY, async () => {
      await configService.promptAndSaveApiKey();
    }),

    vscode.commands.registerCommand(COMMANDS.SHOW_TELEMETRY, () => {
      const telemetry = getTelemetry();
      const logPath = telemetry?.getLogPath();
      if (logPath) {
        vscode.window.showInformationMessage(`VibeCheck telemetry log: ${logPath}`, 'Open').then((choice) => {
          if (choice === 'Open') {
            vscode.commands.executeCommand('vscode.open', vscode.Uri.file(logPath));
          }
        });
      } else {
        vscode.window.showInformationMessage('VibeCheck: Telemetry is disabled. Enable it in Settings.');
      }
    }),
  );

  // Initial setup
  await setupGate(context, configService);

  // Re-setup when config changes
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(async (e) => {
      if (e.affectsConfiguration('vibecheck')) {
        teardown();
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
    vscode.window.setStatusBarMessage('$(circle-slash) VibeCheck OFF', 3000);
    return;
  }

  const apiKey = await configService.getApiKey();
  if (!apiKey) {
    vscode.window
      .showWarningMessage(
        'VibeCheck: No API key set for the Judge LLM. Click to configure.',
        'Set API Key',
      )
      .then((choice) => {
        if (choice === 'Set API Key') {
          vscode.commands.executeCommand(COMMANDS.SET_API_KEY);
        }
      });
    return;
  }

  const provider = createProvider(config.judgeProvider, {
    model: config.judgeModel,
    apiKey,
    baseUrl: config.judgeBaseUrl || undefined,
    temperature: config.judgeTemperature,
  });

  const judgeService = new JudgeService(provider, config.passThreshold);

  const telemetry = new TelemetryService(config.telemetryEnabled, context.globalStorageUri);
  currentTelemetry = telemetry;

  gate = new ExplanationGate(context.extensionUri, judgeService, config.courseName, telemetry);

  registry = new InterceptorRegistry(config);
  registry.activate(async (event: InterceptedEvent) => {
    return gate!.challenge(event.codeSnippet);
  });

  context.subscriptions.push({ dispose: teardown });

  vscode.window.setStatusBarMessage('$(shield) VibeCheck ON', 3000);
}

function teardown(): void {
  registry?.deactivate();
  registry = undefined;
  gate?.dispose();
  gate = undefined;
}

export function deactivate(): void {
  teardown();
}
