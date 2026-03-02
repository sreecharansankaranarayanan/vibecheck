import { useMemo } from 'react';
export function useSearch(courses, query) {
    return useMemo(() => {
        const q = query.toLowerCase().trim();
        if (!q)
            return courses;
        return courses.filter((c) => c.name.toLowerCase().includes(q) ||
            c.instructor.toLowerCase().includes(q) ||
            c.id.toLowerCase().includes(q));
    }, [courses, query]);
}
