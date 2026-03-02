// ⚠️  MAINTENANCE TASK VERSION
//
// This persistence layer simulates an async storage API (as would be used with
// IndexedDB or a remote backend). saveEnrolled() is intentionally async.
//
// The bugs are in useEnrollment.ts, which calls saveEnrolled() without await,
// creating a race condition: React state is updated (UI shows the course) before
// the write completes, so on a hard refresh the persisted snapshot is stale →
// "ghost courses" appear briefly then vanish.

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

/**
 * Simulates an async persistence write (e.g. IndexedDB / remote API).
 * The artificial 80ms delay is enough to expose the race condition when
 * callers forget to await this function.
 */
export async function saveEnrolled(courses: Course[]): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(courses));
        resolve();
      } catch (e) {
        reject(e);
      }
    }, 80);
  });
}

export async function clearEnrolled(): Promise<void> {
  return new Promise<void>((resolve) => {
    setTimeout(() => {
      localStorage.removeItem(STORAGE_KEY);
      resolve();
    }, 80);
  });
}
