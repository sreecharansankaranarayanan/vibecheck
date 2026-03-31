# VibeCheck

> **Explanation Gate for AI-generated code.** Forces you to explain code before it is applied.

---

## Citation

This repository is the artifact for:

> Sankaranarayanan, S. (2026). **Mitigating 'Epistemic Debt' in Generative AI-Scaffolded Novice Programming using Metacognitive Scripts.** In *Proceedings of the 13th ACM Conference on Learning at Scale (L@S '26)*.
>
> Preprint: [https://arxiv.org/abs/2602.20206](https://arxiv.org/abs/2602.20206)

If you use VibeCheck or the course-scheduler task in your own research, please cite:

```bibtex
@inproceedings{sankaranarayanan2026epistemic,
  title={Mitigating 'Epistemic Debt' in Generative AI-Scaffolded Novice Programming using Metacognitive Scripts},
  author={Sankaranarayanan, Sreecharan},
  booktitle={Proceedings of the 13th ACM Conference on Learning at Scale},
  year={2026},
  url={https://arxiv.org/abs/2602.20206}
}
```

---

## What It Does

Every time you click **Apply** in Cursor AI, accept a GitHub Copilot suggestion, or accept an inline completion, VibeCheck intercepts the action and shows a modal:

> "Wait! Before applying this code, explain its causal logic. How does it handle state updates?"

A Judge LLM evaluates your explanation using the **SOLO Taxonomy** rubric (score 1-5). You need to reach **Relational level (score 3 or above)**, explaining *how components interact*, before the code is applied.

If you fail, you get Socratic feedback (guiding questions, not answers) and try again.

---

## Why This Exists

Accepting AI code without understanding it creates *epistemic debt*: future maintenance crises when you cannot debug the code you shipped. The paper found that students using the Explanation Gate achieved comparable productivity to unrestricted AI users, while having only a **39% failure rate** on maintenance tasks vs. **77%** for unrestricted users.

---

## Prerequisites

- **Node.js 18+** ([nodejs.org](https://nodejs.org))
- **npm 9+** (comes with Node)
- **VS Code 1.85+** or **Cursor** (any recent version)
- A Judge LLM API key: OpenAI, Anthropic, or a local Ollama instance (free)

```bash
# Verify versions
node --version   # v18+
npm --version    # 9+
code --version   # 1.85+ (VS Code)  OR
cursor --version # any recent build
```

---

## Getting Started

### 1. Clone and build

```bash
git clone https://github.com/sreecharansankaranarayanan/vibecheck
cd vibecheck
npm install
npm run compile
```

You should see:

```
dist/webview.js   ~2.8kb
dist/extension.js ~800kb
```

---

## Running in VS Code

### Step 1: Open the project

```
File -> Open Folder... -> select the vibecheck/ directory
```

Or from the terminal:

```bash
code /path/to/vibecheck
```

### Step 2: Launch the Extension Development Host

Press **`F5`** (or go to **Run -> Start Debugging**).

VS Code will build the extension and open a second window titled **[Extension Development Host]**. VibeCheck is active in that window; everything you do there runs through the gate.

> **Tip:** If VS Code asks which debug configuration to use, select **"Run Extension"**.

### Step 3: Set your Judge API key

In the **Extension Development Host** window:

1. Open the Command Palette: `Ctrl+Shift+P` (Windows/Linux) or `Cmd+Shift+P` (macOS)
2. Type `VibeCheck: Set Judge API Key` and press Enter
3. Paste your API key. It is stored encrypted in VS Code SecretStorage and never written to disk.

### Step 4: Configure the judge model

1. Open Settings: `Ctrl+,` / `Cmd+,`
2. Search for `vibecheck`
3. Set **Judge Provider** (`openai` / `anthropic` / `ollama`) and **Judge Model** (e.g. `gpt-4o`)

### Step 5: Trigger the gate

1. Open any project in the dev host window
2. Use GitHub Copilot to generate a suggestion and accept it with **Tab**
3. The VibeCheck modal appears; explain the code to proceed

---

## Running in Cursor

Cursor is a VS Code fork and loads VS Code extensions natively. The setup is identical to VS Code with one extra step to confirm Cursor's extension API is enabled.

### Step 1: Open the project

```
File -> Open Folder... -> select the vibecheck/ directory
```

Or from the terminal:

```bash
cursor /path/to/vibecheck
```

### Step 2: Launch the Extension Development Host

Press **`F5`** (or **Run -> Start Debugging**).

A second Cursor window opens titled **[Extension Development Host]**. VibeCheck is live in that window.

> **If F5 does nothing:** open the Run & Debug sidebar (`Ctrl+Shift+D` / `Cmd+Shift+D`), confirm the dropdown at the top reads **"Run Extension"**, then click the green play button.

### Step 3: Set your Judge API key

In the **Extension Development Host** window:

1. `Cmd+Shift+P` -> `VibeCheck: Set Judge API Key`
2. Paste your key

### Step 4: Trigger the gate with Cursor AI

1. Open any file in the dev host window
2. Open the Cursor AI sidebar: `Cmd+L`
3. Ask the AI to generate code, e.g. *"write a function to debounce API calls"*
4. Click **Apply** in the sidebar
5. The VibeCheck modal blocks the apply; explain the code to proceed

> **Why this works:** Cursor fires the command `aichat.applyCodeBlock` when you click Apply. VibeCheck registers an override for this command and intercepts it before Cursor's handler runs.

---

## Study Apps

The `examples/` directory contains all three apps used in the paper's N=78 study:

| Directory | Purpose |
|---|---|
| `course-scheduler-starter/` | **Phase 1 starting point.** Blank scaffold that participants build from. |
| `course-scheduler/` | **Reference implementation.** Complete working solution plus the grading harness. |
| `course-scheduler-buggy/` | **Phase 2 maintenance task.** Logic bomb version for debugging practice. |

### Try the reference implementation

```bash
cd examples/course-scheduler
npm install
npm run dev          # http://localhost:5173
```

**Login:** `student` / `cs2026`

**Features:** 20-course catalog, enrollment with conflict detection, credit counter, localStorage persistence, CSV/TXT schedule export.

### Run the grading harness

With the app running at `:5173`, open a second terminal:

```bash
cd examples/course-scheduler
npm run grade
```

This runs the 12 Puppeteer assertions from the paper and outputs a Functional Utility Score (0-100). Each assertion is worth 8.33 points.

### Phase 2: Maintenance Task

```bash
cd examples/course-scheduler-buggy
npm install
npm run dev
```

**Bug:** Enrolled courses appear but disappear after a page refresh ("ghost courses"). Caused by missing `await` on async persistence calls and deleted rollback logic in `src/hooks/useEnrollment.ts`. Fix it in 30 minutes without AI.

> **Paper finding:** Students who used the Explanation Gate had a 39% failure rate on this task vs. 77% for unrestricted AI users (chi-squared(2) = 13.8, p = .001).

---

## Using Ollama (free, no API key)

Run the Judge locally with no API costs:

```bash
# 1. Install Ollama
brew install ollama        # macOS
# or download from https://ollama.ai

# 2. Pull a model
ollama pull llama3.2

# 3. Start the server
ollama serve               # runs at http://localhost:11434
```

Then in VS Code / Cursor Settings (`Cmd+,` -> search `vibecheck`):

| Setting | Value |
|---|---|
| `vibecheck.judgeProvider` | `ollama` |
| `vibecheck.judgeModel` | `llama3.2` |
| `vibecheck.judgeBaseUrl` | `http://localhost:11434/v1` |

Run `VibeCheck: Set Judge API Key` and enter any placeholder value (Ollama does not require a real key).

---

## Configuration Reference

| Setting | Default | Description |
|---|---|---|
| `vibecheck.enabled` | `true` | Enable/disable the gate globally |
| `vibecheck.courseName` | `"React"` | Course name injected into the Judge prompt (e.g. `"React"`, `"Python"`) |
| `vibecheck.judgeProvider` | `"openai"` | `openai` / `anthropic` / `ollama` |
| `vibecheck.judgeModel` | `"gpt-4o"` | Model ID for the Judge (e.g. `"gpt-4o"`, `"claude-haiku-4-5-20251001"`, `"llama3.2"`) |
| `vibecheck.judgeBaseUrl` | `""` | Override base URL (required for Ollama: `http://localhost:11434/v1`) |
| `vibecheck.judgeTemperature` | `0.1` | Low temperature = deterministic grading (matches paper) |
| `vibecheck.passThreshold` | `3` | Minimum SOLO score to pass (1-5) |
| `vibecheck.interceptCursor` | `true` | Gate Cursor's Apply action |
| `vibecheck.interceptCopilot` | `true` | Gate Copilot inline acceptance |
| `vibecheck.interceptInline` | `false` | Gate all Tab completions (high friction, disabled by default) |
| `vibecheck.telemetryEnabled` | `false` | Log gate encounters to a local JSONL file (no data leaves your machine) |

API keys are always stored in **VS Code SecretStorage**. They are never written to `settings.json` or any file on disk.

---

## SOLO Taxonomy Rubric

| Score | Level | What it looks like |
|---|---|---|
| 1 | Pre-structural | Restates the code verbatim or gives a tautological answer |
| 2 | Uni-structural | Names one thing the code does but does not connect ideas |
| **3** | **Relational (pass)** | **Explains how parts interact; describes cause-and-effect** |
| 4 | Extended Abstract (partial) | Identifies edge cases or potential failure modes |
| 5 | Extended Abstract | Generalises the pattern; addresses architectural implications |

The default threshold is **3 (Relational)**. You must explain the *why*, not just the *what*.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| `F5` does nothing | Make sure you opened the `vibecheck/` root folder, not a subfolder |
| Gate does not appear when clicking Apply in Cursor | Run `npm run compile` to rebuild, then reload the dev host window (`Cmd+Shift+P` -> `Developer: Reload Window`) |
| "Invalid API key" notification | Re-run `VibeCheck: Set Judge API Key` in the Command Palette |
| Modal opens but Submit does nothing | Webview bundle may be stale; run `npm run compile` and reload |
| Ollama: "Judge evaluation failed" | Make sure `ollama serve` is running and the model is pulled (`ollama list`) |
| Want live reload while developing | Use `npm run watch` instead of `npm run compile`; esbuild rebuilds on every save |

---

## Development

```bash
npm install          # Install dependencies
npm run compile      # One-time build (extension + webview)
npm run watch        # Rebuild on save
npm test             # Run unit tests (56 tests)
npm run package      # Package as .vsix for distribution
```

---

## Architecture

```
src/
+-- extension.ts                  # activate() / deactivate() entry point
+-- constants.ts                  # Command IDs, config keys
+-- config/
|   +-- ConfigService.ts          # Settings + SecretStorage (API key)
+-- judge/
|   +-- JudgeService.ts           # Evaluation orchestrator
|   +-- prompts.ts                # SOLO taxonomy system prompt + XML delimiters
|   +-- providers/
|       +-- OpenAIProvider.ts     # OpenAI
|       +-- AnthropicProvider.ts  # Anthropic (dedicated headers)
|       +-- OllamaProvider.ts     # Local Ollama
|       +-- ProviderFactory.ts
+-- gate/
|   +-- GateStateMachine.ts       # Pure state machine: IDLE -> WAITING -> JUDGING -> PASS/FAIL
|   +-- GatePanel.ts              # WebviewPanel with nonce-based CSP
|   +-- ExplanationGate.ts        # Orchestrates gate flow end-to-end
+-- interceptors/
|   +-- AIChangeInterceptor.ts    # Core: detects large AI edits via onDidChangeTextDocument
|   +-- CursorInterceptor.ts      # Hooks aichat.applyCodeBlock (Cursor Apply)
|   +-- CopilotInterceptor.ts     # Hooks editor.action.inlineSuggest.commit
|   +-- InlineSuggestionInterceptor.ts
|   +-- InterceptorRegistry.ts
|   +-- types.ts                  # Shared InterceptedEvent type
+-- telemetry/
|   +-- TelemetryService.ts       # Optional local JSONL logging
+-- webview/
    +-- index.html                # Modal UI
    +-- main.ts                   # Webview-side JS

examples/
+-- course-scheduler-starter/     # Phase 1: blank scaffold for participants
+-- course-scheduler/             # Reference implementation + grading harness
|   +-- test/grade.test.js        # 12 Puppeteer assertions (npm run grade)
+-- course-scheduler-buggy/       # Phase 2: logic bomb version

test/
+-- unit/
    +-- GateStateMachine.test.ts
    +-- JudgeService.test.ts
    +-- conflictDetector.test.ts
    +-- paperConcordance.test.ts   # Verifies exact paper prompt strings

study/
+-- README.md                     # Full replication guide (all 3 conditions)
```

---

## Replicating the Study

`study/README.md` contains the complete guide to running the N=78 three-arm study:

- Full condition setup for Groups A (manual), B (unrestricted AI), and C (VibeCheck)
- Participant screener and consent script
- Facilitator scripts with exact timing and verbatim announcements
- Participant instructions per group
- Data collection schema (telemetry, grades, surveys)
- Post-session survey instrument (7 questions, Group C extras)
- Python analysis pipeline to reproduce the chi-square and ANOVA from the paper

---

## License

MIT
