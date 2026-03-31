/**
 * Paper Concordance Tests
 *
 * Verifies that key strings in the implementation match verbatim or
 * semantically match what is described in the paper:
 *   "Mitigating 'Epistemic Debt' in Generative AI-Scaffolded Novice
 *    Programming using Metacognitive Scripts" (Sankaranarayanan, L@S '26)
 *
 * If these tests fail, the implementation has drifted from the paper spec.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { buildSystemPrompt, buildUserMessage } from "../../src/judge/prompts";

const ROOT = join(__dirname, "..", "..");

// ---------------------------------------------------------------------------
// Modal prompt text (paper §3.2 — Explanation Gate trigger)
// ---------------------------------------------------------------------------
describe("Modal prompt text (paper §3.2)", () => {
  const html = readFileSync(join(ROOT, "src", "webview", "index.html"), "utf8");

  it("contains the exact modal prompt from the paper", () => {
    // Paper verbatim: "Wait! Before applying this code, explain its causal logic.
    //                  How does it handle state updates?"
    expect(html).toContain(
      "Before applying this code, explain its causal logic.",
    );
    expect(html).toContain("How does it handle state updates?");
  });

  it("does NOT use the old non-paper wording", () => {
    expect(html).not.toContain("Before this code is applied");
    expect(html).not.toContain("How does it work, and why?");
  });
});

// ---------------------------------------------------------------------------
// Judge system prompt (paper §3.3 — SOLO Taxonomy rubric)
// ---------------------------------------------------------------------------
describe("Judge system prompt (paper §3.3)", () => {
  const prompt = buildSystemPrompt("React");

  it("references the SOLO Taxonomy", () => {
    expect(prompt).toContain("SOLO Taxonomy");
  });

  it("defines score 1 as Pre-structural", () => {
    expect(prompt).toMatch(/Score\s+1.*Pre-structural/i);
  });

  it("defines score 3 as Relational with cause-and-effect language", () => {
    expect(prompt).toMatch(/Score\s+3.*Relational/i);
    expect(prompt.toLowerCase()).toContain("cause-and-effect");
  });

  it("defines score 5 as Extended Abstract", () => {
    expect(prompt).toMatch(/Score\s+5.*Extended Abstract/i);
  });

  it("uses passing threshold of >= 3 (Relational)", () => {
    expect(prompt).toMatch(/Score\s*>=?\s*3/);
  });

  it("instructs Socratic feedback (not revealing answers) on failure", () => {
    // Paper §3.3: "Socratic feedback: ask guiding questions WITHOUT revealing the answer"
    expect(prompt.toLowerCase()).toContain("socratic");
    expect(prompt.toLowerCase()).toContain("without revealing");
  });

  it("injects the courseName into the prompt", () => {
    const customPrompt = buildSystemPrompt("Python");
    expect(customPrompt).toContain("Python course");
  });

  it('uses "merge" phrasing (paper §3.2) — not "merge into their project"', () => {
    // Paper says "the code they are trying to merge"
    expect(prompt).toContain("the code they are trying to merge");
    expect(prompt).not.toContain("merge into their project");
  });

  it("requests JSON-only output with score and feedback fields", () => {
    expect(prompt).toContain('"score"');
    expect(prompt).toContain('"feedback"');
  });
});

// ---------------------------------------------------------------------------
// Judge user message — XML delimiter injection defence (paper §4 security)
// ---------------------------------------------------------------------------
describe("Judge user message format", () => {
  const msg = buildUserMessage("const x = 1;", "This declares x as 1.");

  it("wraps code in XML delimiters", () => {
    expect(msg).toContain("<code_to_evaluate>");
    expect(msg).toContain("</code_to_evaluate>");
  });

  it("wraps explanation in XML delimiters", () => {
    expect(msg).toContain("<student_explanation>");
    expect(msg).toContain("</student_explanation>");
  });

  it("places code before explanation", () => {
    const codeIdx = msg.indexOf("<code_to_evaluate>");
    const explIdx = msg.indexOf("<student_explanation>");
    expect(codeIdx).toBeLessThan(explIdx);
  });
});

// ---------------------------------------------------------------------------
// Study README replication requirements (paper §3.1 — condition setup)
// ---------------------------------------------------------------------------
describe("Study README replication requirements (paper §3.1)", () => {
  const readme = readFileSync(join(ROOT, "study", "README.md"), "utf8");

  it("documents the Claude 3.5 Sonnet generator model requirement for Group C", () => {
    // Paper §3.1: Group C used Cursor with Claude 3.5 Sonnet as the code generator.
    // Replicators must configure this explicitly — it is separate from the judge model.
    expect(readme).toContain("claude-3-5-sonnet");
    expect(readme.toLowerCase()).toContain("generator model");
  });

  it("documents the 50-character minimum explanation length", () => {
    // ExplanationGate rejects explanations shorter than MIN_EXPLANATION_LENGTH=50
    // before they reach the LLM judge. Paper replicators should know this constraint.
    expect(readme).toContain("50 characters");
  });

  it("specifies gpt-4o as the judge model in Group C settings", () => {
    // Paper §3.3: judge model is GPT-4o (OpenAI), temperature 0.1
    expect(readme).toContain("vibecheck.judgeModel       = gpt-4o");
  });
});

// ---------------------------------------------------------------------------
// Default configuration values (paper §3 — experimental setup)
// ---------------------------------------------------------------------------
describe("Default configuration values (paper §3)", () => {
  it('package.json uses "React" as default courseName (paper study context)', () => {
    const pkg = JSON.parse(
      readFileSync(join(ROOT, "package.json"), "utf8"),
    ) as {
      contributes: {
        configuration: {
          properties: {
            "vibecheck.courseName": { default: string };
            "vibecheck.judgeTemperature": { default: number };
            "vibecheck.passThreshold": { default: number };
          };
        };
      };
    };
    const props = pkg.contributes.configuration.properties;
    expect(props["vibecheck.courseName"].default).toBe("React");
  });

  it("default judgeTemperature is 0.1 (paper §3.3 — deterministic grading)", () => {
    const pkg = JSON.parse(
      readFileSync(join(ROOT, "package.json"), "utf8"),
    ) as {
      contributes: {
        configuration: {
          properties: { "vibecheck.judgeTemperature": { default: number } };
        };
      };
    };
    expect(
      pkg.contributes.configuration.properties["vibecheck.judgeTemperature"]
        .default,
    ).toBe(0.1);
  });

  it("default passThreshold is 3 (paper §3.3 — Relational level)", () => {
    const pkg = JSON.parse(
      readFileSync(join(ROOT, "package.json"), "utf8"),
    ) as {
      contributes: {
        configuration: {
          properties: { "vibecheck.passThreshold": { default: number } };
        };
      };
    };
    expect(
      pkg.contributes.configuration.properties["vibecheck.passThreshold"]
        .default,
    ).toBe(3);
  });
});
