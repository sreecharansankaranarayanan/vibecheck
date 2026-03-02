import { useMemo } from 'react';
import { Course } from '../types';

export function useSearch(courses: Course[], query: string): Course[] {
  return useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return courses;
    return courses.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.instructor.toLowerCase().includes(q) ||
        c.id.toLowerCase().includes(q),
    );
  }, [courses, query]);
}
