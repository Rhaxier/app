// The school's structure and calendar as plain functions. The database
// enforces the same rules (supabase/tests/10_people_test.sql, 11_calendar_test.sql,
// 17_bell_times_test.sql).
import { describe, expect, it } from 'vitest';
import type { Period, SchoolClass, Section } from './api';
import {
  bellTimesOn,
  bellTimesSummary,
  dayNote,
  importedWeekdays,
  periodRowsFromCsv,
  periodsOn,
  periodTemplateRows,
  schoolDaysOfWeek,
  teachableAudience,
  weekdaysLabel,
  type CalendarData,
} from './logic';

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

describe('schoolDaysOfWeek', () => {
  const morning = new Date('2026-10-20T02:00:00Z'); // Tuesday, 06:00 in Dubai

  it('lists the school days of this week, starting on Sunday', () => {
    expect(schoolDaysOfWeek(0, { school_days: [0, 1, 2, 3, 4] }, morning)).toEqual([
      '2026-10-18',
      '2026-10-19',
      '2026-10-20',
      '2026-10-21',
      '2026-10-22',
    ]);
    expect(schoolDaysOfWeek(1, { school_days: [0, 1, 2, 3, 4] }, morning)[0]).toBe('2026-10-25');
  });

  it('follows the school_days setting (e.g. Monday to Friday)', () => {
    expect(schoolDaysOfWeek(0, { school_days: [1, 2, 3, 4, 5] }, morning)).toEqual([
      '2026-10-19',
      '2026-10-20',
      '2026-10-21',
      '2026-10-22',
      '2026-10-23',
    ]);
  });
});

// Monday to Thursday: two periods; Friday: a short first period only.
const bellPeriods: Period[] = [
  {
    id: 'p1',
    name: 'Period 1',
    starts_at: '07:30:00',
    ends_at: '08:15:00',
    sort_order: 1,
    weekdays: [1, 2, 3, 4],
  },
  {
    id: 'p2',
    name: 'Period 2',
    starts_at: '08:15:00',
    ends_at: '09:00:00',
    sort_order: 2,
    weekdays: [1, 2, 3, 4],
  },
  {
    id: 'f1',
    name: 'Period 1',
    starts_at: '07:30:00',
    ends_at: '08:00:00',
    sort_order: 1,
    weekdays: [5],
  },
];

describe('bell times', () => {
  it("shows each date's own timings, so Friday differs", () => {
    const monday = bellTimesOn('2026-10-26', bellPeriods).map((b) => b.end.toISOString());
    const friday = bellTimesOn('2026-10-30', bellPeriods).map((b) => b.end.toISOString());
    expect(monday).toEqual(['2026-10-26T04:15:00.000Z', '2026-10-26T05:00:00.000Z']); // 8:15, 9:00
    expect(friday).toEqual(['2026-10-30T04:00:00.000Z']); // 8:00
  });

  it('says where today is up to, for Home', () => {
    const at = (iso: string) => bellTimesSummary(bellPeriods, new Date(iso));
    expect(at('2026-10-26T03:00:00Z')).toBe('Next: Period 1 at 7:30'); // 07:00
    expect(at('2026-10-26T04:30:00Z')).toBe('Now: Period 2, until 9:00'); // 08:30
    expect(at('2026-10-26T06:00:00Z')).toBe('Done for today: 7:30–9:00'); // 10:00
    expect(at('2026-10-25T06:00:00Z')).toBe('No periods today'); // Sunday
  });
});

describe('the bell times CSV', () => {
  it('makes a template from the current periods: one line per period per weekday', () => {
    expect(periodTemplateRows(bellPeriods).map((row) => Object.values(row).join(','))).toEqual([
      'Monday,Period 1,07:30,08:15,1',
      'Monday,Period 2,08:15,09:00,2',
      'Tuesday,Period 1,07:30,08:15,1',
      'Tuesday,Period 2,08:15,09:00,2',
      'Wednesday,Period 1,07:30,08:15,1',
      'Wednesday,Period 2,08:15,09:00,2',
      'Thursday,Period 1,07:30,08:15,1',
      'Thursday,Period 2,08:15,09:00,2',
      'Friday,Period 1,07:30,08:00,1',
    ]);
  });

  it('reads the columns in any order, and says which headings are missing', () => {
    const parsed = periodRowsFromCsv(
      'order,weekday,period_name,start_time,end_time\n1,Friday,Period 1,07:30,08:00\n',
    );
    expect(parsed).toEqual({
      rows: [
        {
          weekday: 'Friday',
          period_name: 'Period 1',
          start_time: '07:30',
          end_time: '08:00',
          order: '1',
        },
      ],
    });
    expect(periodRowsFromCsv('day,name,start,end\nFriday,P1,07:30,08:00\n')).toEqual({
      problem:
        'The first line must be the headings: weekday,period_name,start_time,end_time,order (missing weekday, period_name, start_time, end_time, order).',
    });
    expect(periodRowsFromCsv('')).toEqual({ problem: 'The file has no rows.' });
  });

  it('lists the weekdays an import replaces, in week order', () => {
    const result = (weekday: string, outcome: 'ok' | 'error') => ({
      line: 2,
      weekday,
      period_name: 'P',
      start_time: '07:30',
      end_time: '08:00',
      sort_order: '1',
      outcome,
      message: null,
    });
    expect(
      importedWeekdays([
        result('Friday', 'ok'),
        result('Monday', 'ok'),
        result('Friday', 'ok'),
        result('Funday', 'error'),
      ]),
    ).toBe('Monday, Friday');
  });
});
