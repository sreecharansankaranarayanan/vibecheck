import { useState, useCallback } from 'react';
import { findConflicts } from '../utils/conflictDetector';
import { loadEnrolled, saveEnrolled } from '../utils/persistence';
export function useEnrollment() {
    const [enrolled, setEnrolled] = useState(() => loadEnrolled());
    const totalCredits = enrolled.reduce((sum, c) => sum + c.credits, 0);
    const enroll = useCallback((course) => {
        const conflicts = findConflicts(course, enrolled);
        if (conflicts.length > 0) {
            return { success: false, conflicts };
        }
        const next = [...enrolled, course];
        setEnrolled(next);
        saveEnrolled(next);
        return { success: true, conflicts: [] };
    }, [enrolled]);
    const drop = useCallback((courseId) => {
        const next = enrolled.filter((c) => c.id !== courseId);
        setEnrolled(next);
        saveEnrolled(next);
    }, [enrolled]);
    const isEnrolled = useCallback((courseId) => enrolled.some((c) => c.id === courseId), [enrolled]);
    const clearAll = useCallback(() => {
        setEnrolled([]);
        saveEnrolled([]);
    }, []);
    return { enrolled, totalCredits, enroll, drop, isEnrolled, clearAll };
}
