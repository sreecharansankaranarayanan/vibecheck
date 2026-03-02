import { Course } from '../types';

const STORAGE_KEY = 'vibecheck_enrolled_courses';

export function loadEnrolled(): Course[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as Course[];
  } catch {
    return [];
  }
}

export function saveEnrolled(courses: Course[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(courses));
  } catch {
    // Storage quota exceeded — silently ignore
  }
}

export function clearEnrolled(): void {
  localStorage.removeItem(STORAGE_KEY);
}
