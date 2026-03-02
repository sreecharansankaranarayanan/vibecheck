# Course Scheduler — Maintenance Task (Buggy Version)

This is the **logic bomb** version of the Course Scheduler used in the VibeCheck study.

## Your Task

You have **30 minutes** to identify and fix the bugs **without AI assistance**.

## Bug Description

The app suffers from "ghost courses": when you enroll in a course, it appears briefly but
disappears after a page refresh.

The bugs were injected into `src/hooks/useEnrollment.ts`:

1. **Race condition**: `await` keywords were stripped from async persistence calls
2. **Missing rollback**: The optimistic UI rollback logic on failed saves was deleted

## Why This Matters

If you just accepted AI-generated code for the enrollment logic without understanding it,
you will struggle to find these bugs. The VibeCheck Explanation Gate exists to ensure
you understand code *before* it ships — so maintenance tasks like this don't become crises.

## Setup

```bash
npm install
npm run dev
```

## Files to Inspect

- `src/hooks/useEnrollment.ts` — contains the bugs
- `src/utils/persistence.ts` — the async storage layer

## Hint (only peek if stuck)

The correct implementation is in `../course-scheduler/src/hooks/useEnrollment.ts`.
