# Task: Student Course Scheduler

**Time limit:** 90 minutes
**AI assistance:** Allowed (VibeCheck is active — you must explain each code block before it is applied)

---

## Your Goal

Build a fully functional React course scheduler web app. A login screen is already working. Your job is to implement everything that appears after login.

```bash
npm install
npm run dev   # http://localhost:5173
```

Login with: `student` / `cs2026`

---

## Feature Checklist

Each feature is worth **8.33 points** (12 features × 8.33 ≈ 100). Score is computed automatically by the grading harness.

| # | Feature | Points |
|---|---------|--------|
| 1 | Render course catalog from `courses.json` (20+ cards) | 8.33 |
| 2 | Each card shows: name, instructor, credits, timeslot | 8.33 |
| 3 | Enroll button adds course to "My Schedule" sidebar | 8.33 |
| 4 | Block duplicate enrollment | 8.33 |
| 5 | Detect time conflicts — block overlapping enrollments | 8.33 |
| 6 | Show conflict warning naming the conflicting course | 8.33 |
| 7 | Live credit counter updates on enroll/drop | 8.33 |
| 8 | Persist enrolled schedule to localStorage (survives refresh) | 8.33 |
| 9 | Drop button in sidebar removes course | 8.33 |
| 10 | Search/filter catalog by name or instructor | 8.33 |
| 11 | Export schedule as .csv or .txt | 8.33 |
| 12 | Detect back-to-back adjacency conflicts (same-day, touching hours) | 8.33 |

---

## Technical Notes

- `src/types.ts` defines the `Course` type — `startHour`, `endHour`, and `days[]` are your inputs for conflict logic
- Two courses conflict if they share a day AND `a.startHour < b.endHour && b.startHour < a.endHour`
- Back-to-back: `a.endHour === b.startHour` on a shared day
- Use `localStorage.setItem('vibecheck_enrolled_courses', JSON.stringify(courses))` for persistence

---

## Project Structure

```
src/
├── data/courses.json     # 20 courses — provided, do not modify
├── components/Login.tsx  # Provided — do not modify
├── types.ts              # Provided — do not modify
├── main.tsx              # Provided — do not modify
└── App.tsx               # Your entry point — start here
```

Create any additional files you need (hooks/, utils/, components/).

---

## Grading

After 90 minutes, the facilitator runs:

```bash
# from examples/course-scheduler/
npm run grade
```

This runs 12 Puppeteer assertions against `http://localhost:5173` and outputs your score out of 100.

---

## Reference Implementation

`examples/course-scheduler/` contains a complete working solution. It is available **only after the study session ends**.
