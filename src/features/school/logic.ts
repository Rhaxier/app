// The school's structure: plain functions (tested in school.test.ts).
import { weekdayOfKey } from '@/lib/dates';
import type { Blackout, Holiday, Period, SchoolClass, Section, Term } from './api';

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

/** The periods that run on a day, in time order. */
export function periodsOn(day: string, periods: Period[]): Period[] {
  const weekday = weekdayOfKey(day);
  return periods
    .filter((period) => period.weekdays.includes(weekday))
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at) || a.sort_order - b.sort_order);
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
