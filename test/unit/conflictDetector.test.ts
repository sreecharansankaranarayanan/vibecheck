import { describe, it, expect } from 'vitest';
import { hasConflict, findConflicts } from '../../examples/course-scheduler/src/utils/conflictDetector';
import { Course } from '../../examples/course-scheduler/src/types';

function makeCourse(overrides: Partial<Course>): Course {
  return {
    id: 'TEST',
    name: 'Test',
    instructor: 'Dr. Test',
    credits: 3,
    timeslot: 'MWF 09:00-10:00',
    startHour: 9,
    endHour: 10,
    days: ['M', 'W', 'F'],
    description: '',
    ...overrides,
  };
}

describe('conflictDetector', () => {
  it('detects overlap on same days same time', () => {
    const a = makeCourse({ days: ['M'], startHour: 9, endHour: 10 });
    const b = makeCourse({ id: 'B', days: ['M'], startHour: 9, endHour: 10 });
    expect(hasConflict(a, b)).toBe(true);
  });

  it('detects partial time overlap on shared day', () => {
    const a = makeCourse({ days: ['T'], startHour: 10, endHour: 11.5 });
    const b = makeCourse({ id: 'B', days: ['T'], startHour: 11, endHour: 12.5 });
    expect(hasConflict(a, b)).toBe(true);
  });

  it('no conflict when different days', () => {
    const a = makeCourse({ days: ['M', 'W', 'F'], startHour: 9, endHour: 10 });
    const b = makeCourse({ id: 'B', days: ['T', 'Th'], startHour: 9, endHour: 10 });
    expect(hasConflict(a, b)).toBe(false);
  });

  it('no conflict when same day but non-overlapping times', () => {
    const a = makeCourse({ days: ['M'], startHour: 9, endHour: 10 });
    const b = makeCourse({ id: 'B', days: ['M'], startHour: 10, endHour: 11 });
    expect(hasConflict(a, b)).toBe(false);
  });

  it('no conflict when one ends exactly when another starts', () => {
    const a = makeCourse({ days: ['M'], startHour: 8, endHour: 9 });
    const b = makeCourse({ id: 'B', days: ['M'], startHour: 9, endHour: 10 });
    expect(hasConflict(a, b)).toBe(false);
  });

  it('findConflicts returns all conflicting enrolled courses', () => {
    const candidate = makeCourse({ id: 'C', days: ['T'], startHour: 10, endHour: 11.5 });
    const enrolled = [
      makeCourse({ id: 'A', days: ['T'], startHour: 11, endHour: 12 }), // conflict
      makeCourse({ id: 'B', days: ['M'], startHour: 10, endHour: 11.5 }), // no conflict
    ];
    const conflicts = findConflicts(candidate, enrolled);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].id).toBe('A');
  });

  it('findConflicts returns empty array when no conflicts', () => {
    const candidate = makeCourse({ id: 'C', days: ['F'], startHour: 14, endHour: 15 });
    const enrolled = [
      makeCourse({ id: 'A', days: ['M'], startHour: 9, endHour: 10 }),
    ];
    expect(findConflicts(candidate, enrolled)).toHaveLength(0);
  });
});
