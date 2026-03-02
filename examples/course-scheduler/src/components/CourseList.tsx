import { useState } from 'react';
import { Course } from '../types';
import { CourseCard } from './CourseCard';
import { SearchBar } from './SearchBar';
import { useSearch } from '../hooks/useSearch';
import { findConflicts } from '../utils/conflictDetector';

interface CourseListProps {
  courses: Course[];
  enrolled: Course[];
  isEnrolled: (id: string) => boolean;
  onEnroll: (course: Course) => { success: boolean; conflicts: Course[] };
  onDrop: (id: string) => void;
}

export function CourseList({ courses, enrolled, isEnrolled, onEnroll, onDrop }: CourseListProps) {
  const [query, setQuery] = useState('');
  const [conflictMessages, setConflictMessages] = useState<Record<string, string>>({});

  const filtered = useSearch(courses, query);

  function handleEnroll(course: Course) {
    const result = onEnroll(course);
    if (!result.success) {
      const conflictNames = result.conflicts.map((c) => c.name).join(', ');
      setConflictMessages((prev) => ({
        ...prev,
        [course.id]: `Conflicts with: ${conflictNames}`,
      }));
      // Clear conflict message after 4 seconds
      setTimeout(() => {
        setConflictMessages((prev) => {
          const { [course.id]: _, ...rest } = prev;
          return rest;
        });
      }, 4000);
    }
  }

  function handleDrop(courseId: string) {
    onDrop(courseId);
    setConflictMessages((prev) => {
      const { [courseId]: _, ...rest } = prev;
      return rest;
    });
    // Re-check if any other courses now have their conflicts cleared
    courses.forEach((c) => {
      if (conflictMessages[c.id]) {
        const remaining = findConflicts(c, enrolled.filter((e) => e.id !== courseId));
        if (remaining.length === 0) {
          setConflictMessages((prev) => {
            const { [c.id]: _, ...rest } = prev;
            return rest;
          });
        }
      }
    });
  }

  return (
    <div className="course-list-panel">
      <SearchBar query={query} onChange={setQuery} />

      {filtered.length === 0 ? (
        <p className="empty-state">No courses match your search.</p>
      ) : (
        <div className="course-grid" data-testid="course-grid">
          {filtered.map((course) => (
            <CourseCard
              key={course.id}
              course={course}
              isEnrolled={isEnrolled(course.id)}
              onEnroll={handleEnroll}
              onDrop={handleDrop}
              conflictMessage={conflictMessages[course.id]}
            />
          ))}
        </div>
      )}
    </div>
  );
}
