import { Course } from '../types';

/**
 * Returns true if course A and course B have overlapping time slots on shared days.
 */
export function hasConflict(a: Course, b: Course): boolean {
  const sharedDays = a.days.some((d) => b.days.includes(d));
  if (!sharedDays) return false;
  // Overlap when one starts before the other ends
  return a.startHour < b.endHour && b.startHour < a.endHour;
}

/**
 * Returns all courses from the enrolled list that conflict with the candidate.
 */
export function findConflicts(candidate: Course, enrolled: Course[]): Course[] {
  return enrolled.filter((e) => hasConflict(candidate, e));
}
