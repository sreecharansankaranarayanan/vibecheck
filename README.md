# VibeCheck

> **Explanation Gate for AI-generated code** — forces you to explain code before it's applied.

Based on the paper *"Mitigating Epistemic Debt in Generative AI-Scaffolded Novice Programming using Metacognitive Scripts"* (Sankaranarayanan, L@S '26).

---

## What It Does

Every time you click **Apply** in Cursor AI, accept a GitHub Copilot suggestion, or accept an inline completion, VibeCheck intercepts the action and shows a modal:

> "Wait! Before applying this code, explain its causal logic. How does it work, and why?"

A Judge LLM evaluates your explanation using the **SOLO Taxonomy** rubric (score 1–5). You need to reach **Relational level (score ≥ 3)** — explaining *how components interact* — before the code is applied.

If you fail, you get Socratic feedback (guiding questions, not answers) and try again.

---

## Why This Exists

Accepting AI code without understanding it creates *epistemic debt* — future maintenance crises when you can't debug the code you shipped. The paper found that students using the Explanation Gate achieved comparable productivity to unrestricted AI users, while having only a **39% failure rate** on maintenance tasks vs. **77%** for unrestricted users.

---

## Installation

### From Marketplace
*(Coming soon — see releases)*

### From Source
```bash
git clone https://github.com/vibecheck/vibecheck
cd vibecheck
npm install
npm run compile
```
Press `F5` in VS Code to launch the Extension Development Host.

---

## Configuration

Open Settings (`Cmd+,`) and search for **VibeCheck**.

| Setting | Default | Description |
|---|---|---|
| `vibecheck.enabled` | `true` | Enable/disable the gate globally |
| `vibecheck.courseName` | `"Programming"` | Injected into judge prompt (e.g. "React", "Python") |
| `vibecheck.judgeProvider` | `"openai"` | `openai` \| `anthropic` \| `ollama` |
| `vibecheck.judgeModel` | `"gpt-4o"` | Any model ID supported by the provider |
| `vibecheck.judgeBaseUrl` | `""` | Override for Ollama: `http://localhost:11434/v1` |
| `vibecheck.judgeTemperature` | `0.1` | Low temp = deterministic grading (matches paper) |
| `vibecheck.passThreshold` | `3` | SOLO score required to pass (1–5) |
| `vibecheck.interceptCursor` | `true` | Gate Cursor IDE's Apply action |
| `vibecheck.interceptCopilot` | `true` | Gate Copilot inline acceptance |
| `vibecheck.interceptInline` | `false` | Gate Tab completions (high friction) |
| `vibecheck.telemetryEnabled` | `false` | Log gate encounters locally (no data leaves machine) |

### Setting Your API Key
```
Cmd+Shift+P → VibeCheck: Set Judge API Key
```
Keys are stored in VS Code's SecretStorage (never in `settings.json`).

### Using Ollama (local, free)
1. Install [Ollama](https://ollama.ai) and pull a model: `ollama pull llama3.2`
2. Set `vibecheck.judgeProvider` to `ollama`
3. Set `vibecheck.judgeModel` to `llama3.2`
4. Set `vibecheck.judgeBaseUrl` to `http://localhost:11434/v1`
5. No API key needed — run `VibeCheck: Set Judge API Key` and enter any placeholder

---

## SOLO Taxonomy Rubric

| Score | Level | Description |
|---|---|---|
| 1 | Pre-structural | Just restates the code or is tautological |
| 2 | Uni-structural | Identifies one relevant feature |
| **3** | **Relational** ✅ | **Explains component interactions; cause-and-effect** |
| 4 | Ext. Abstract (partial) | Begins addressing edge cases |
| 5 | Extended Abstract | Edge cases, implications, generalization |

**Default pass threshold: 3** — you must explain the *why*, not just the *what*.

---

## Demo: Course Scheduler

The `examples/course-scheduler/` directory contains the exact app used in the L@S '26 study:
a React + TypeScript student course scheduling app.

```bash
cd examples/course-scheduler
npm install
npm run dev
```

**Features:**
- Mock login (`student` / `cs2026`)
- 20-course catalog with search/filter
- Enrollment with conflict detection
- Credit counter
- localStorage persistence
- CSV/TXT export

### Maintenance Task (Debugging Practice)

`examples/course-scheduler-buggy/` contains the **logic bomb** from the paper:
`await` keywords stripped from async calls + rollback logic deleted → ghost courses on refresh.

**Your challenge**: fix the bugs in `src/hooks/useEnrollment.ts` in 30 minutes, without AI.

---

## Architecture

```
src/
├── extension.ts              # activate() / deactivate()
├── config/ConfigService.ts   # Settings + SecretStorage
├── judge/
│   ├── JudgeService.ts       # Evaluation orchestrator
│   ├── prompts.ts            # SOLO taxonomy system prompt
│   └── providers/            # OpenAI / Anthropic / Ollama
├── gate/
│   ├── GateStateMachine.ts   # Pure state transitions
│   ├── GatePanel.ts          # WebviewPanel lifecycle
│   └── ExplanationGate.ts    # Side-effect orchestrator
├── interceptors/
│   ├── CursorInterceptor.ts  # aichat.applyCodeBlock
│   ├── CopilotInterceptor.ts # editor.action.inlineSuggest.commit
│   └── InterceptorRegistry.ts
└── webview/                  # Modal HTML/CSS/TS
```

---

## Development

```bash
npm install          # Install dependencies
npm run compile      # Build extension + webview
npm run watch        # Watch mode
npm test             # Run unit tests
npm run package      # Package .vsix
```

---

## Citation

```bibtex
@inproceedings{sankaranarayanan2026epistemic,
  title={Mitigating 'Epistemic Debt' in Generative AI-Scaffolded Novice Programming using Metacognitive Scripts},
  author={Sankaranarayanan, Sreecharan},
  booktitle={Proceedings of the 13th ACM Conference on Learning at Scale},
  year={2026}
}
```

---

## License

MIT
