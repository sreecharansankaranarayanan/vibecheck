import { Course } from '../types';

export function hasConflict(a: Course, b: Course): boolean {
  const sharedDays = a.days.some((d) => b.days.includes(d));
  if (!sharedDays) return false;
  return a.startHour < b.endHour && b.startHour < a.endHour;
}

export function findConflicts(candidate: Course, enrolled: Course[]): Course[] {
  return enrolled.filter((e) => hasConflict(candidate, e));
}
