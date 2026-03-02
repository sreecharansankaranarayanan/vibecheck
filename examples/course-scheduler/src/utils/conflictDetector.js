/**
 * Returns true if course A and course B have overlapping time slots on shared days.
 */
export function hasConflict(a, b) {
    const sharedDays = a.days.some((d) => b.days.includes(d));
    if (!sharedDays)
        return false;
    // Overlap when one starts before the other ends
    return a.startHour < b.endHour && b.startHour < a.endHour;
}
/**
 * Returns all courses from the enrolled list that conflict with the candidate.
 */
export function findConflicts(candidate, enrolled) {
    return enrolled.filter((e) => hasConflict(candidate, e));
}
