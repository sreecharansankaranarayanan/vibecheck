const STORAGE_KEY = 'vibecheck_enrolled_courses';
export function loadEnrolled() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw)
            return [];
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed))
            return [];
        return parsed;
    }
    catch {
        return [];
    }
}
export function saveEnrolled(courses) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(courses));
    }
    catch {
        // Storage quota exceeded — silently ignore
    }
}
export function clearEnrolled() {
    localStorage.removeItem(STORAGE_KEY);
}
