import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { CourseCard } from './CourseCard';
import { SearchBar } from './SearchBar';
import { useSearch } from '../hooks/useSearch';
import { findConflicts } from '../utils/conflictDetector';
export function CourseList({ courses, enrolled, isEnrolled, onEnroll, onDrop }) {
    const [query, setQuery] = useState('');
    const [conflictMessages, setConflictMessages] = useState({});
    const filtered = useSearch(courses, query);
    function handleEnroll(course) {
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
    function handleDrop(courseId) {
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
    return (_jsxs("div", { className: "course-list-panel", children: [_jsx(SearchBar, { query: query, onChange: setQuery }), filtered.length === 0 ? (_jsx("p", { className: "empty-state", children: "No courses match your search." })) : (_jsx("div", { className: "course-grid", "data-testid": "course-grid", children: filtered.map((course) => (_jsx(CourseCard, { course: course, isEnrolled: isEnrolled(course.id), onEnroll: handleEnroll, onDrop: handleDrop, conflictMessage: conflictMessages[course.id] }, course.id))) }))] }));
}
