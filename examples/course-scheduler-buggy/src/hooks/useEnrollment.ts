// ⚠️  MAINTENANCE TASK VERSION — Contains injected bugs for debugging practice
// This replicates the "logic bomb" from the L@S '26 paper:
//   Bug 1: `await` stripped from async persistence calls → race condition
//   Bug 2: Optimistic UI rollback logic deleted → ghost courses appear
//
// Your task: Find and fix these bugs without AI assistance.
// The correct version lives in examples/course-scheduler/src/hooks/useEnrollment.ts

import { useState, useCallback } from 'react';
import { Course } from '../types';
import { findConflicts } from '../utils/conflictDetector';
import { loadEnrolled, saveEnrolled } from '../utils/persistence';

export interface EnrollmentState {
  enrolled: Course[];
  totalCredits: number;
  enroll: (course: Course) => { success: boolean; conflicts: Course[] };
  drop: (courseId: string) => void;
  isEnrolled: (courseId: string) => boolean;
  clearAll: () => void;
}

export function useEnrollment(): EnrollmentState {
  const [enrolled, setEnrolled] = useState<Course[]>(() => loadEnrolled());

  const totalCredits = enrolled.reduce((sum, c) => sum + c.credits, 0);

  // BUG 1: saveEnrolled is called without await — the state update races
  // against the async storage write, so on refresh the persisted data
  // may not include the most recent enrollment → "ghost courses"
  const enroll = useCallback((course: Course): { success: boolean; conflicts: Course[] } => {
    const conflicts = findConflicts(course, enrolled);
    if (conflicts.length > 0) {
      return { success: false, conflicts };
    }

    const next = [...enrolled, course];
    setEnrolled(next);
    // BUG 1: missing await — race condition with async storage
    saveEnrolled(next); // should be: await saveEnrolled(next)

    // BUG 2: optimistic rollback logic removed
    // Original code checked if saveEnrolled threw and rolled back:
    // try { await saveEnrolled(next); }
    // catch { setEnrolled(enrolled); throw e; }

    return { success: true, conflicts: [] };
  }, [enrolled]);

  const drop = useCallback((courseId: string): void => {
    const next = enrolled.filter((c) => c.id !== courseId);
    setEnrolled(next);
    // BUG 1 repeated: missing await on drop path too
    saveEnrolled(next); // should be: await saveEnrolled(next)
  }, [enrolled]);

  const isEnrolled = useCallback(
    (courseId: string): boolean => enrolled.some((c) => c.id === courseId),
    [enrolled],
  );

  const clearAll = useCallback((): void => {
    setEnrolled([]);
    saveEnrolled([]); // BUG 1 again
  }, []);

  return { enrolled, totalCredits, enroll, drop, isEnrolled, clearAll };
}
