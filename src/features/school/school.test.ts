// The school's structure and calendar as plain functions. The database
// enforces the same rules (supabase/tests/10_people_test.sql, 11_calendar_test.sql).
import { describe, expect, it } from 'vitest';
import type { Period, SchoolClass, Section } from './api';
import { dayNote, periodsOn, teachableAudience, weekdaysLabel, type CalendarData } from './logic';

const calendar: CalendarData = {
  schoolDays: [1, 2, 3, 4, 5],
  terms: [{ id: 't1', name: 'Term 1', starts_on: '2026-09-01', ends_on: '2026-12-10' }],
  holidays: [{ id: 'h1', name: 'Mid-term break', starts_on: '2026-10-26', ends_on: '2026-10-28' }],
  blackouts: [
    { id: 'b1', venue_id: null, starts_on: '2026-11-02', ends_on: '2026-11-02', reason: 'Exams' },
    { id: 'b2', venue_id: 'lab', starts_on: '2026-11-03', ends_on: '2026-11-03', reason: 'Refit' },
  ],
};

describe('dayNote', () => {
  it('blocks holidays and blackouts, saying why', () => {
    expect(dayNote('2026-10-27', calendar)).toEqual({
      text: 'Holiday: Mid-term break',
      blocked: true,
    });
    expect(dayNote('2026-11-02', calendar, 'hall')).toEqual({
      text: 'Not bookable: Exams',
      blocked: true,
    });
  });

  it("applies a venue's own blackout only to that venue", () => {
    expect(dayNote('2026-11-03', calendar, 'lab')?.blocked).toBe(true);
    expect(dayNote('2026-11-03', calendar, 'hall')).toBeNull();
  });

  it('only warns about weekends and days outside term', () => {
    expect(dayNote('2026-10-24', calendar)).toEqual({ text: 'Not a school day', blocked: false });
    expect(dayNote('2026-12-15', calendar)).toEqual({ text: 'Outside term time', blocked: false });
    expect(dayNote('2026-10-29', calendar)).toBeNull();
  });
});

describe('periodsOn and weekdaysLabel', () => {
  const period = (name: string, start: string, weekdays: number[]): Period => ({
    id: name,
    name,
    starts_at: start,
    ends_at: '23:00:00',
    sort_order: 0,
    weekdays,
  });
  const periods = [
    period('P2', '09:00:00', [1, 2, 3, 4, 5]),
    period('P1', '07:30:00', [1, 2, 3, 4, 5]),
    period('Late', '15:00:00', [1, 2, 3, 4]),
  ];

  it('gives that weekday’s periods in time order', () => {
    expect(periodsOn('2026-10-26', periods).map((p) => p.name)).toEqual(['P1', 'P2', 'Late']); // Monday
    expect(periodsOn('2026-10-30', periods).map((p) => p.name)).toEqual(['P1', 'P2']); // Friday
  });

  it('describes days briefly', () => {
    expect(weekdaysLabel([4, 1, 2, 3])).toBe('Mon–Thu');
    expect(weekdaysLabel([5])).toBe('Fri');
    expect(weekdaysLabel([0, 2, 4])).toBe('Sun, Tue, Thu');
  });
});

describe('teachableAudience', () => {
  const sections: Section[] = [
    { id: '10a', grade: 10, name: 'A' },
    { id: '10b', grade: 10, name: 'B' },
    { id: '8a', grade: 8, name: 'A' },
  ];
  const teaching = (
    grade: number,
    section_id: string | null,
  ): Pick<SchoolClass, 'grade' | 'section_id' | 'archived_at' | 'teachers'> => ({
    grade,
    section_id,
    archived_at: null,
    teachers: [{ teacher_id: 'me', teacher: null }],
  });

  it('a section class gives that section; a grade-wide class gives the grade and its sections', () => {
    expect(teachableAudience('me', [teaching(10, '10a'), teaching(8, null)], sections)).toEqual({
      grades: [8],
      sectionIds: ['10a', '8a'],
    });
  });
});
