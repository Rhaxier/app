// The school's structure: plain functions (tested in school.test.ts).
import {
  addDaysToKey,
  atSchoolTime,
  dayKey,
  formatTime,
  weekdayOfKey,
  WEEK_STARTS_ON,
} from '@/lib/dates';
import { csvToObjects } from '@/lib/csv';
import type {
  Blackout,
  Holiday,
  Period,
  PeriodCsvRow,
  PeriodImportResult,
  SchoolClass,
  Section,
  Term,
} from './api';

/** "10A": how sections are written everywhere in the app. */
export function sectionLabel(section: Pick<Section, 'grade' | 'name'>): string {
  return `${section.grade}${section.name}`;
}

/**
 * What a teacher may announce to when "teachers post only to what they teach"
 * is on (mirrors teaches_audience() in the database):
 *   grades    grades they teach as a whole (a class with no section)
 *   sections  sections they teach, plus every section of those whole grades
 */
export function teachableAudience(
  teacherId: string,
  classes: Pick<SchoolClass, 'grade' | 'section_id' | 'archived_at' | 'teachers'>[],
  sections: Section[],
): { grades: number[]; sectionIds: string[] } {
  const mine = classes.filter(
    (c) => !c.archived_at && c.teachers.some((t) => t.teacher_id === teacherId),
  );
  const grades = [...new Set(mine.filter((c) => !c.section_id).map((c) => c.grade))].sort(
    (a, b) => a - b,
  );
  const sectionIds = sections
    .filter((s) => grades.includes(s.grade) || mine.some((c) => c.section_id === s.id))
    .map((s) => s.id);
  return { grades, sectionIds };
}

// ---------------------------------------------------------------------------
// The school calendar. Days are Dubai day keys ('2026-10-25'), which compare
// correctly as text, so "is this day in that range" is a string comparison.
// ---------------------------------------------------------------------------

/** The school days of a week, as day keys. weekOffset 0 = this week. */
export function schoolDaysOfWeek(
  weekOffset: number,
  settings: { school_days: number[] },
  now = new Date(),
): string[] {
  const today = dayKey(now);
  const sinceWeekStart = (weekdayOfKey(today) - WEEK_STARTS_ON + 7) % 7;
  const weekStart = addDaysToKey(today, -sinceWeekStart + weekOffset * 7);
  return Array.from({ length: 7 }, (_, i) => addDaysToKey(weekStart, i)).filter((day) =>
    settings.school_days.includes(weekdayOfKey(day)),
  );
}

/** The periods that run on a day, in time order. */
export function periodsOn(day: string, periods: Period[]): Period[] {
  const weekday = weekdayOfKey(day);
  return periods
    .filter((period) => period.weekdays.includes(weekday))
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at) || a.sort_order - b.sort_order);
}

/** One period on one date, for the bell times screens. */
export interface BellTime {
  id: string;
  name: string;
  start: Date;
  end: Date;
  /** Happening right now. */
  now: boolean;
}

/** A date's periods with their real start and end, and which one is on now. */
export function bellTimesOn(day: string, periods: Period[], now: Date = new Date()): BellTime[] {
  return periodsOn(day, periods).map((period) => {
    const start = atSchoolTime(day, period.starts_at.slice(0, 5));
    const end = atSchoolTime(day, period.ends_at.slice(0, 5));
    return { id: period.id, name: period.name, start, end, now: start <= now && now < end };
  });
}

/**
 * One line for Home: "Now: Period 2, until 10:30", "Next: Period 3 at 10:30",
 * "Done for today: 7:30–15:00", or "No periods today".
 */
export function bellTimesSummary(periods: Period[], now: Date = new Date()): string {
  const today = bellTimesOn(dayKey(now), periods, now);
  if (today.length === 0) return 'No periods today';
  const current = today.find((bell) => bell.now);
  if (current) return `Now: ${current.name}, until ${formatTime(current.end)}`;
  const next = today.find((bell) => bell.start > now);
  if (next) return `Next: ${next.name} at ${formatTime(next.start)}`;
  return `Done for today: ${formatTime(today[0].start)}–${formatTime(today[today.length - 1].end)}`;
}

export interface CalendarData {
  schoolDays: number[];
  terms: Term[];
  holidays: Holiday[];
  blackouts: Blackout[];
}

const within = (day: string, range: { starts_on: string; ends_on: string }) =>
  day >= range.starts_on && day <= range.ends_on;

/**
 * Why a day is special, in words, or null for an ordinary school day.
 * `blocked` days can't be booked (holidays and blackouts; the database refuses
 * them too). Other notes (not a school day, outside term) are just warnings.
 * Pass venueId to include that venue's blackouts; without it, only
 * whole-school blackouts count.
 */
export function dayNote(
  day: string,
  calendar: CalendarData,
  venueId?: string,
): { text: string; blocked: boolean } | null {
  const holiday = calendar.holidays.find((h) => within(day, h));
  if (holiday) return { text: `Holiday: ${holiday.name}`, blocked: true };
  const blackout = calendar.blackouts.find(
    (b) => within(day, b) && (b.venue_id === null || b.venue_id === venueId),
  );
  if (blackout) return { text: `Not bookable: ${blackout.reason}`, blocked: true };
  if (!calendar.schoolDays.includes(weekdayOfKey(day)))
    return { text: 'Not a school day', blocked: false };
  if (calendar.terms.length > 0 && !calendar.terms.some((t) => within(day, t)))
    return { text: 'Outside term time', blocked: false };
  return null;
}

export const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** [1, 2, 3, 4] → "Mon–Thu"; [0, 2, 4] → "Sun, Tue, Thu". */
export function weekdaysLabel(days: number[]): string {
  const sorted = [...days].sort((a, b) => a - b);
  const consecutive = sorted.every((day, i) => i === 0 || day === sorted[i - 1] + 1);
  if (sorted.length > 2 && consecutive) {
    return `${WEEKDAY_NAMES[sorted[0]]}–${WEEKDAY_NAMES[sorted[sorted.length - 1]]}`;
  }
  return sorted.map((day) => WEEKDAY_NAMES[day]).join(', ');
}

// ---------------------------------------------------------------------------
// Bell times upload (CSV)
// ---------------------------------------------------------------------------

export const WEEKDAY_FULL_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

/** The file's columns, in order. */
export const PERIOD_CSV_COLUMNS = [
  'weekday',
  'period_name',
  'start_time',
  'end_time',
  'order',
] as const;

/**
 * The template: today's periods, one line per period per weekday it runs on,
 * by weekday and then time. An admin edits it and uploads it again.
 */
export function periodTemplateRows(periods: Period[]): PeriodCsvRow[] {
  return [0, 1, 2, 3, 4, 5, 6].flatMap((weekday) =>
    periods
      .filter((period) => period.weekdays.includes(weekday))
      .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
      .map((period, index) => ({
        weekday: WEEKDAY_FULL_NAMES[weekday],
        period_name: period.name,
        start_time: period.starts_at.slice(0, 5),
        end_time: period.ends_at.slice(0, 5),
        // The order within the day, counted again so it's always 1, 2, 3…
        order: String(index + 1),
      })),
  );
}

/** CSV text → rows for the database, or a message if the headings are wrong. */
export function periodRowsFromCsv(text: string): { rows: PeriodCsvRow[] } | { problem: string } {
  const objects = csvToObjects(text);
  if (objects.length === 0) return { problem: 'The file has no rows.' };
  const missing = PERIOD_CSV_COLUMNS.filter((column) => !(column in objects[0]));
  if (missing.length > 0) {
    return {
      problem: `The first line must be the headings: ${PERIOD_CSV_COLUMNS.join(',')} (missing ${missing.join(', ')}).`,
    };
  }
  return {
    rows: objects.map((o) => ({
      weekday: o.weekday,
      period_name: o.period_name,
      start_time: o.start_time,
      end_time: o.end_time,
      order: o.order,
    })),
  };
}

/** The weekdays a checked file will replace, in week order: "Monday, Friday". */
export function importedWeekdays(results: PeriodImportResult[]): string {
  const days = new Set(results.filter((r) => r.outcome === 'ok').map((r) => r.weekday));
  return WEEKDAY_FULL_NAMES.filter((name) => days.has(name)).join(', ');
}
