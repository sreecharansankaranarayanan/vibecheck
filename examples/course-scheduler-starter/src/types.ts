// Provided — do not modify.
// These types describe the shape of data you'll work with throughout the task.

export interface Course {
  id: string;
  name: string;
  instructor: string;
  credits: number;
  timeslot: string;  // human-readable, e.g. "MWF 09:00-10:00"
  startHour: number; // numeric start for conflict detection, e.g. 9
  endHour: number;   // numeric end, e.g. 10
  days: string[];    // e.g. ["M", "W", "F"] or ["T", "Th"]
  description: string;
}

export type AppView = 'login' | 'scheduler';
