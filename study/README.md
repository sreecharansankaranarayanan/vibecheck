# Study Replication Guide: VibeCheck Explanation Gate

**Paper:** *Mitigating 'Epistemic Debt' in Generative AI-Scaffolded Novice Programming using Metacognitive Scripts*
**Venue:** ACM Learning at Scale (L@S '26)
**Preprint:** https://arxiv.org/abs/2602.20206

This directory contains everything needed to replicate the N=78 study from the paper as a new experiment. Read this file top to bottom before running any sessions.

---

## Table of Contents

1. [Study Design](#1-study-design)
2. [Participant Criteria and Recruitment](#2-participant-criteria-and-recruitment)
3. [Condition Setup (Groups A / B / C)](#3-condition-setup-groups-a--b--c)
4. [Facilitator Protocol: Session Flow](#4-facilitator-protocol-session-flow)
5. [Participant Instructions](#5-participant-instructions)
6. [Grading and Data Collection](#6-grading-and-data-collection)
7. [Post-Session Survey](#7-post-session-survey)
8. [Analysis Pipeline](#8-analysis-pipeline)

---

## 1. Study Design

A 2-hour remote between-subjects experiment. Three conditions, N=26 per group.

| Group | Condition | Tool |
|---|---|---|
| A (n=26) | **Manual / Control** | VS Code (no AI assistance) |
| B (n=26) | **Unrestricted AI** | Cursor + Claude 3.5 Sonnet, no gate |
| C (n=26) | **Scaffolded AI** | Cursor + VibeCheck Explanation Gate active |

**Phase 1 (90 min):** Build the Course Scheduler from the starter scaffold.
**Phase 2 (30 min):** Debug the buggy version. AI revoked for all groups.

**Stratified randomization:** Within each recruitment channel, randomly assign to conditions to maintain equal distribution.

---

## 2. Participant Criteria and Recruitment

### Inclusion criteria

| Criterion | Requirement |
|---|---|
| JavaScript experience | Basic: knows loops, functions, variables |
| React experience | **None** (exclude anyone with prior React) |
| Age | 18-35 |
| Location | US-based |
| Equipment | Own laptop, Node.js 18+, able to run `npm install` |
| Compensation | $15 USD/hour ($30 total for the 2-hour session) |

### Screening questions (send before session)

1. *Rate your JavaScript experience:* None / **Basic** / **Intermediate** / Advanced
   Accept: Basic or Intermediate only
2. *Have you used React.js, Next.js, or any JSX framework before?* Yes / **No**
   Accept: No only
3. *What is a JavaScript array? Give an example.*
   Manual review for minimal competency (any correct answer passes)

### Original paper recruitment channels

- **Prolific** (n=53): undergraduate CS majors, screened as above
- **UserInterviews.com** (n=25): coding bootcamp graduates (<12 months since graduation)

---

## 3. Condition Setup (Groups A / B / C)

### Group A: Manual / VS Code

1. Participant opens `examples/course-scheduler-starter/` in **VS Code** (not Cursor)
2. No AI extensions installed or active
3. No GitHub Copilot, no Cursor, no ChatGPT tabs
4. Only allowed resource: MDN Web Docs, official React docs

### Group B: Unrestricted AI / Cursor

1. Participant opens `examples/course-scheduler-starter/` in **Cursor**
2. Cursor AI sidebar enabled, model: Claude 3.5 Sonnet (or equivalent)
3. **No VibeCheck extension installed** in this window
4. No restrictions on number of prompts or code applications

### Group C: Scaffolded AI / Cursor + VibeCheck

1. Participant opens `examples/course-scheduler-starter/` in **Cursor**
2. **CRITICAL — Set Cursor's AI model to Claude 3.5 Sonnet** (the code generator):
   - Open Cursor Settings (`Cmd+,`) → Models → select **claude-3-5-sonnet** (or `claude-3-5-sonnet-20241022`)
   - This is the generator model used in the paper. Replicating with a different model
     changes the code style and complexity of AI suggestions, affecting gate firing rate
     and explanation difficulty. This setting is separate from the VibeCheck judge model below.
3. VibeCheck extension is loaded via Extension Development Host:
   - Facilitator clones this repo, runs `npm install && npm run compile`
   - Opens the `vibecheck/` folder in Cursor and presses F5 to launch the Extension Development Host
   - Participant works in the Extension Development Host window
4. Set the Judge API key: `Cmd+Shift+P` -> `VibeCheck: Set Judge API Key` -> paste key
5. Recommended settings (`Cmd+,` -> search `vibecheck`):
   ```
   vibecheck.judgeProvider    = openai
   vibecheck.judgeModel       = gpt-4o
   vibecheck.judgeTemperature = 0.1
   vibecheck.passThreshold    = 3
   vibecheck.courseName       = React
   vibecheck.telemetryEnabled = true
   ```
6. Verify the gate fires: open any file, use Cursor AI, click Apply; the modal should appear
   - Note: the gate requires explanations of at least **50 characters**. Trivially short
     responses ("it adds state") are rejected locally before reaching the judge.

#### Telemetry file location (Group C)

At session end, collect:
- **macOS:** `~/Library/Application Support/Code/User/globalStorage/vibecheck.vibecheck/vibecheck-YYYY-MM-DD.jsonl`
- **Linux:** `~/.config/Code/User/globalStorage/vibecheck.vibecheck/`
- **Windows:** `%APPDATA%\Code\User\globalStorage\vibecheck.vibecheck\`

---

## 4. Facilitator Protocol: Session Flow

### 30 minutes before session

- [ ] Confirm participant Node.js 18+: `node --version`
- [ ] Send them the starter: `examples/course-scheduler-starter/`
- [ ] Verify they can run `npm install && npm run dev` and the login screen appears
- [ ] Group C only: verify VibeCheck gate fires in Extension Development Host
- [ ] Confirm grading harness installed: `cd examples/course-scheduler && npm install`

### Session start

1. Welcome the participant and read the consent statement:
   > *"This session involves programming tasks. We will record your screen activity for research purposes. Your data will be anonymised. You may stop at any time. Do you consent?"*
2. Explain the two phases:
   > *"You'll have 90 minutes to build an app, then 30 minutes for a follow-up task. I'll give you the details of the follow-up task when the time comes."*
   > **Do NOT reveal that Phase 2 is a debugging task.**
3. Group C: confirm the VibeCheck gate appears when they try to apply AI code
4. Start the Phase 1 timer. Announce: *"You may begin."*

### At 90 minutes (Phase 1 end)

1. Announce: *"Time's up for Phase 1. Please stop coding."*
2. Facilitator runs the grading harness while the participant's app is still running:
   ```bash
   cd examples/course-scheduler
   GRADE_URL=http://localhost:5173 npm run grade
   ```
   This outputs a score and writes `grade-result.json`. Save it with the participant ID.
3. Group C: copy the telemetry JSONL to your data folder (see section 3 above)

### Phase 2 setup (5 minutes between phases)

1. Revoke AI for Groups B and C:
   - Close Cursor, reopen VS Code (or disable all AI extensions)
   - Group C: `Cmd+Shift+P` -> `VibeCheck: Disable Explanation Gate`
2. Give the participant `examples/course-scheduler-buggy/`:
   ```bash
   cd examples/course-scheduler-buggy
   npm install
   npm run dev   # http://localhost:5173
   ```
3. Announce:
   > *"This is a version of the same app. Users are reporting that when they enroll in courses and refresh the page, the courses disappear. You have 30 minutes to find and fix the bug. No AI assistance for this task."*
4. Start the Phase 2 timer

### Phase 2 monitoring

- Note the exact time when the participant reports the fix or makes a commit
- At the end: ask them to demonstrate: enroll a course, hard refresh, confirm the course is still there
- **Pass:** Bug is fixed (enrolled courses persist). Record time-to-fix.
- **Fail:** Bug not fixed in 30 minutes. Record what they tried.

### Session end

1. Administer the post-session survey (section 7)
2. Confirm compensation details
3. Thank the participant

---

## 5. Participant Instructions

Send this text to participants at the start of Phase 1 (copy-paste or display on screen):

---

**Phase 1: Build Task (90 minutes)**

You are going to build a React web app called the **Course Scheduler**. A login screen is already implemented. Your job is to build everything shown after login.

**Starter app location:** `examples/course-scheduler-starter/`

```bash
cd examples/course-scheduler-starter
npm install
npm run dev   # Opens at http://localhost:5173
```

**Login credentials:** `student` / `cs2026`

**What to build** (also listed in the app's README):

1. Display the course catalog (20+ courses from the JSON file)
2. Show each course's name, instructor, credits, and timeslot
3. Enroll button adds a course to a "My Schedule" sidebar
4. Block enrolling in the same course twice
5. Block enrolling in a course that conflicts in time with an enrolled course
6. Show a warning message when a conflict is detected
7. Display a live credit counter
8. Persist enrolled courses so they survive a page refresh
9. Drop button in the sidebar removes a course
10. Search bar filters the catalog in real time
11. Export the schedule as a .txt or .csv file
12. Detect back-to-back scheduling conflicts (courses touching with no gap)

**Group A only:** Use only documentation (MDN, React docs). No AI.
**Group B only:** You may use Cursor AI freely. No restrictions.
**Group C only:** You may use Cursor AI. VibeCheck is active; you must explain each code block before it is applied.

---

## 6. Grading and Data Collection

### Phase 1: Functional Utility Score (0-100)

Run while participant's app is at `http://localhost:5173`:

```bash
cd examples/course-scheduler
GRADE_URL=http://localhost:5173 npm run grade
```

Sample output:
```
  ✅ A1: Login with mock credentials (student/cs2026)
  ✅ A2: Render 20+ courses from JSON (found 20)
  ...
  Passed: 11 / 12 assertions
  Functional Utility Score: 91.6 / 100
  Results written to grade-result.json
```

Save `grade-result.json` per participant. It contains:
```json
{
  "timestamp": "2026-03-01T14:32:00Z",
  "score": 91.6,
  "passed": 11,
  "total": 12,
  "assertions": [...]
}
```

### Phase 2: Maintenance Success

| Field | Values |
|---|---|
| `repairSuccess` | `true` / `false` |
| `timeToFixSeconds` | integer (from phase start to confirmed fix) |
| `approachNotes` | free text (what the participant tried) |

### Group C Telemetry Schema

Each line in the JSONL file is one event:

```jsonl
{"event":"gate_shown","timestamp":1234567890123,"sessionId":"abc123","attempt":1,"codeLength":142,"source":"cursor"}
{"event":"explanation_submitted","timestamp":1234567892100,"explanationLength":87}
{"event":"judge_response","timestamp":1234567895300,"score":2,"passed":false,"feedback":"..."}
{"event":"gate_passed","timestamp":1234567910500,"totalAttempts":2}
{"event":"gate_cancelled","timestamp":...}
```

---

## 7. Post-Session Survey

Administer verbally or via a form after Phase 2. Record responses.

### For all groups

1. *On a scale of 1-5, how confident are you that you could debug the Phase 2 app if you encountered it in a real job?*
   (1 = not at all confident, 5 = very confident)

2. *During Phase 1, how often did you feel like you understood the code you were writing?*
   Never / Sometimes / Often / Always

3. *How would you describe your experience during Phase 2 (the debugging task)?*
   (open-ended, 1-3 sentences)

### Group C only (VibeCheck gate questions)

4. *How did the Explanation Gate affect your workflow during Phase 1?*
   (open-ended)

5. *Did the gate help you understand the code better, or was it mostly friction?*
   Mostly friction / Neutral / Helped somewhat / Helped a lot

6. *Did the gate's feedback help you improve your explanations?*
   Never / Sometimes / Usually / Always

---

## 8. Analysis Pipeline

### Directory structure for collected data

```
study/data/
+-- participants.csv          # One row per participant: id, group, phase1Score, repairSuccess, timeToFix
+-- telemetry/
|   +-- P001.jsonl            # One file per Group C participant
+-- grades/
|   +-- P001-grade-result.json
+-- surveys/
    +-- P001-survey.json
```

### Phase 1 analysis (Functional Utility Score)

```python
import pandas as pd
from scipy import stats

df = pd.read_csv('study/data/participants.csv')

# One-way ANOVA across groups
groups = [df[df.group == g]['phase1Score'] for g in ['A', 'B', 'C']]
f, p = stats.f_oneway(*groups)
print(f'Phase 1 ANOVA: F={f:.2f}, p={p:.4f}')

# Descriptive stats per group
print(df.groupby('group')['phase1Score'].agg(['mean', 'std', 'median']))
```

### Phase 2 analysis (Repair Success)

```python
from scipy.stats import chi2_contingency

# Contingency table: rows=groups, cols=[success, failure]
table = df.groupby(['group', 'repairSuccess']).size().unstack(fill_value=0)
chi2, p, dof, expected = chi2_contingency(table)
print(f'Phase 2 chi-square: chi2={chi2:.2f}, df={dof}, p={p:.4f}')

# Paper result: chi2(2)=13.8, p=.001
```

### Group C telemetry analysis

```python
import json
import glob
import pandas as pd

events = []
for f in glob.glob('study/data/telemetry/*.jsonl'):
    pid = f.split('/')[-1].replace('.jsonl', '')
    for line in open(f):
        e = json.loads(line)
        e['participant'] = pid
        events.append(e)

df_tel = pd.DataFrame(events)

# Median attempts per gate encounter (paper result: 2.4, SD=1.1)
attempts = df_tel.groupby('sessionId').apply(
    lambda g: g[g.event == 'gate_shown'].shape[0]
)
print(f'Median attempts per gate: {attempts.median():.1f}')
```

### Paper key results (for comparison)

| Metric | Group A (Manual) | Group B (Unrestricted AI) | Group C (VibeCheck) |
|---|---|---|---|
| Phase 1 Functional Utility Score | 65.2% | 92.4% | 89.1% |
| Phase 2 Repair Success | 69.2% | **23.1%** | **61.5%** |
| Median gate attempts | n/a | n/a | 2.4 (SD=1.1) |

**Key finding:** Groups B and C had near-identical productivity in Phase 1, but Group C had a 2.7x higher repair success rate than Group B in Phase 2 (61.5% vs 23.1%, chi-squared(2) = 13.8, p = .001).
