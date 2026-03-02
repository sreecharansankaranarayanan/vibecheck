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

  const enroll = useCallback((course: Course): { success: boolean; conflicts: Course[] } => {
    const conflicts = findConflicts(course, enrolled);
    if (conflicts.length > 0) {
      return { success: false, conflicts };
    }

    const next = [...enrolled, course];
    setEnrolled(next);
    saveEnrolled(next);
    return { success: true, conflicts: [] };
  }, [enrolled]);

  const drop = useCallback((courseId: string): void => {
    const next = enrolled.filter((c) => c.id !== courseId);
    setEnrolled(next);
    saveEnrolled(next);
  }, [enrolled]);

  const isEnrolled = useCallback(
    (courseId: string): boolean => enrolled.some((c) => c.id === courseId),
    [enrolled],
  );

  const clearAll = useCallback((): void => {
    setEnrolled([]);
    saveEnrolled([]);
  }, []);

  return { enrolled, totalCredits, enroll, drop, isEnrolled, clearAll };
}
