// Every date the app shows goes through these helpers, so times always appear
// in the school's time zone (Asia/Dubai), whatever the phone's own setting.
// The database stores `timestamptz` (an exact instant); we only convert for display.
import { TZDate, tz } from '@date-fns/tz';
import {
  addDays,
  differenceInCalendarDays,
  differenceInMinutes,
  format,
  isSameWeek,
} from 'date-fns';

export const SCHOOL_TIME_ZONE = 'Asia/Dubai';

// 0 = Sunday. Used by "This week" filters and the booking date strip.
export const WEEK_STARTS_ON = 0 as const;

// Passing `in: inSchoolZone` tells date-fns to do its maths in Dubai time.
const inSchoolZone = tz(SCHOOL_TIME_ZONE);

type DateInput = string | Date;

function toDate(value: DateInput): Date {
  return typeof value === 'string' ? new Date(value) : value;
}

/** "Sunday, 11 October" */
export function formatDayHeading(value: DateInput): string {
  return format(toDate(value), 'EEEE, d MMMM', { in: inSchoolZone });
}

/** "Sun 18 Oct" */
export function formatDate(value: DateInput): string {
  return format(toDate(value), 'EEE d MMM', { in: inSchoolZone });
}

/** "7:30" (24-hour, as in the mockup) */
export function formatTime(value: DateInput): string {
  return format(toDate(value), 'H:mm', { in: inSchoolZone });
}

/** "7:00–10:00" */
export function formatTimeRange(start: DateInput, end: DateInput): string {
  return `${formatTime(start)}–${formatTime(end)}`;
}

/** "Sun 18 Oct, 7:30" */
export function formatDateTime(value: DateInput): string {
  return `${formatDate(value)}, ${formatTime(value)}`;
}

/** The pieces of the date block on volunteer cards: OCT / 18 / Sat. */
export function dateBlock(value: DateInput): { month: string; day: string; weekday: string } {
  const date = toDate(value);
  return {
    month: format(date, 'MMM', { in: inSchoolZone }).toUpperCase(),
    day: format(date, 'd', { in: inSchoolZone }),
    weekday: format(date, 'EEE', { in: inSchoolZone }),
  };
}

/** "Just now", "5m ago", "2h ago", "Yesterday", "Thu", "12 Oct" */
export function relativeTime(value: DateInput, now: Date = new Date()): string {
  const date = toDate(value);
  const minutes = differenceInMinutes(now, date);
  const days = differenceInCalendarDays(now, date, { in: inSchoolZone });
  if (minutes < 1) return 'Just now';
  if (days === 0 && minutes < 60) return `${minutes}m ago`;
  if (days === 0) return `${Math.floor(minutes / 60)}h ago`;
  if (days === 1) return 'Yesterday';
  if (days > 1 && days < 7) return format(date, 'EEE', { in: inSchoolZone });
  return format(date, 'd MMM', { in: inSchoolZone });
}

/** "Good morning" / "Good afternoon" / "Good evening", by Dubai time. */
export function greeting(now: Date = new Date()): string {
  const hour = Number(format(now, 'H', { in: inSchoolZone }));
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

/** The Dubai calendar day as "2026-10-19". Handy as a key and in URLs. */
export function dayKey(value: DateInput = new Date()): string {
  return format(toDate(value), 'yyyy-MM-dd', { in: inSchoolZone });
}

/** Adds whole days to a day key: addDaysToKey("2026-10-19", 1) = "2026-10-20". */
export function addDaysToKey(key: string, amount: number): string {
  return dayKey(addDays(atSchoolTime(key, '12:00'), amount));
}

/** Day of the week for a day key, 0 = Sunday … 6 = Saturday. */
export function weekdayOfKey(key: string): number {
  return atSchoolTime(key, '12:00').getDay();
}

/** The exact instant of a Dubai wall-clock time: atSchoolTime("2026-10-19", "07:30"). */
export function atSchoolTime(key: string, time: string): Date {
  const [year, month, day] = key.split('-').map(Number);
  const [hours, minutes] = time.split(':').map(Number);
  const inDubai = new TZDate(year, month - 1, day, hours, minutes, SCHOOL_TIME_ZONE);
  // A plain Date of the same instant, so toISOString() gives UTC ("…Z") for the database.
  return new Date(inDubai.getTime());
}

/** Start (inclusive) and end (exclusive) of a Dubai day, as ISO strings for queries. */
export function dayRange(key: string): { start: string; end: string } {
  return {
    start: atSchoolTime(key, '00:00').toISOString(),
    end: atSchoolTime(addDaysToKey(key, 1), '00:00').toISOString(),
  };
}

/** True if the date falls in the current school week (weeks start on WEEK_STARTS_ON). */
export function isThisWeek(value: DateInput, now: Date = new Date()): boolean {
  return isSameWeek(toDate(value), now, { weekStartsOn: WEEK_STARTS_ON, in: inSchoolZone });
}

/** ISO → value for <input type="datetime-local">, shown in Dubai time. */
export function toDateTimeInputValue(value: DateInput | null | undefined): string {
  if (!value) return '';
  return format(toDate(value), "yyyy-MM-dd'T'HH:mm", { in: inSchoolZone });
}

/** <input type="datetime-local"> value (Dubai wall-clock) → ISO string, or null if empty. */
export function fromDateTimeInputValue(value: string): string | null {
  if (!value) return null;
  const [key, time] = value.split('T');
  return atSchoolTime(key, time).toISOString();
}
