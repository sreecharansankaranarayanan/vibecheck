export interface Course {
  id: string;
  name: string;
  instructor: string;
  credits: number;
  timeslot: string;
  startHour: number;
  endHour: number;
  days: string[];
  description: string;
}

export interface User {
  username: string;
}

export type AppView = 'login' | 'scheduler';
