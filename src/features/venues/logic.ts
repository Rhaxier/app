// Venue booking: the calendar's maths, as plain functions (tested in
// venues.test.tsx). Venues are booked by periods: on the chosen date, the
// list shows the periods that run on that weekday (Admin > School calendar,
// or the bell times upload), so a short Friday really is shorter. People pick
// one period or a run of neighbouring free ones, and the booking goes from the
// first one's start to the last one's end. The database checks the same rule
// (booking_period_problem). When an admin allows custom times, any start and
// end can be requested as well.
import type { Period } from '@/features/school/api';
import { periodsOn } from '@/features/school/logic';
import type { AppSettings } from '@/features/settings/api';
import { atSchoolTime, dayKey, formatTimeRange } from '@/lib/dates';
import type { BookingDetails, CalendarBooking } from './api';

export type SlotSettings = Pick<AppSettings, 'school_days'>;

/** One period on one date: what the booking list shows and people pick. */
export interface Slot {
  index: number;
  /** The period's name, e.g. "Period 3". */
  name: string;
  start: Date;
  end: Date;
}

/** The periods of one date, in time order, e.g. Period 1 07:30–09:00, Period 2… */
export function buildSlots(day: string, periods: Period[]): Slot[] {
  return periodsOn(day, periods).map((period, index) => ({
    index,
    name: period.name,
    start: atSchoolTime(day, period.starts_at.slice(0, 5)),
    end: atSchoolTime(day, period.ends_at.slice(0, 5)),
  }));
}

/**
 * The day to open on: today if a period is still ahead, otherwise the next
 * day that has periods and isn't blocked (a holiday or blackout).
 */
export function firstBookableDay(
  days: string[],
  periods: Period[],
  now: Date = new Date(),
  isBlocked: (day: string) => boolean = () => false,
): string | undefined {
  const today = dayKey(now);
  return days.find((day) => {
    if (day < today || isBlocked(day)) return false;
    const slots = buildSlots(day, periods);
    if (slots.length === 0) return false;
    return day > today || slots[slots.length - 1].start > now;
  });
}

export type SlotState =
  | { kind: 'available' }
  | { kind: 'selected' }
  | { kind: 'past' }
  /** The whole day can't be booked: a holiday or a blackout. */
  | { kind: 'closed'; reason: string }
  | { kind: 'booked'; booking: CalendarBooking }
  | { kind: 'waiting'; booking: BookingDetails };

function overlaps(slot: Slot, booking: { starts_at: string; ends_at: string }): boolean {
  return slot.start < new Date(booking.ends_at) && new Date(booking.starts_at) < slot.end;
}

export interface Selection {
  first: number;
  last: number;
}

/**
 * What each period shows. Order matters: an approved booking beats a waiting
 * request, which beats a closed day, then "past", then your selection.
 * `closedReason` is set when the whole day can't be booked ("Holiday: …").
 */
export function slotStates(
  slots: Slot[],
  approved: CalendarBooking[],
  waiting: BookingDetails[],
  selection: Selection | null,
  now: Date = new Date(),
  closedReason: string | null = null,
): SlotState[] {
  return slots.map((slot) => {
    const booked = approved.find((booking) => overlaps(slot, booking));
    if (booked) return { kind: 'booked', booking: booked };
    const request = waiting.find((booking) => overlaps(slot, booking));
    if (request) return { kind: 'waiting', booking: request };
    if (closedReason) return { kind: 'closed', reason: closedReason };
    if (slot.start < now) return { kind: 'past' };
    if (selection && slot.index >= selection.first && slot.index <= selection.last)
      return { kind: 'selected' };
    return { kind: 'available' };
  });
}

/**
 * Tapping a period. A selection is one run of neighbouring free periods:
 * tap a free period to start, tap the next one along to extend, tap an end to
 * shrink, tap a lone selected period to clear. Booked, pending, closed and
 * past periods do nothing, and a run never reaches across one of them: tapping
 * a free period beyond it starts a new run instead.
 */
export function nextSelection(
  selection: Selection | null,
  index: number,
  states: SlotState[],
): Selection | null {
  const kind = states[index]?.kind;
  if (kind !== 'available' && kind !== 'selected') return selection;
  if (!selection) return { first: index, last: index };

  const inside = index >= selection.first && index <= selection.last;
  if (inside) {
    if (selection.first === selection.last) return null;
    if (index === selection.first) return { first: index + 1, last: selection.last };
    if (index === selection.last) return { first: selection.first, last: index - 1 };
    return { first: index, last: index };
  }
  if (index === selection.last + 1) return { first: selection.first, last: index };
  if (index === selection.first - 1) return { first: index, last: selection.last };
  return { first: index, last: index };
}

/**
 * The selection, if every period in it is still free. A run picked a moment
 * ago can stop being free (someone else's request arrives over Realtime); then
 * it can't be requested until it's picked again.
 */
export function freeRun(selection: Selection | null, states: SlotState[]): Selection | null {
  if (!selection) return null;
  const run = states.slice(selection.first, selection.last + 1);
  return run.every((state) => state.kind === 'selected') ? selection : null;
}

export function selectionTimes(slots: Slot[], selection: Selection): { start: Date; end: Date } {
  return { start: slots[selection.first].start, end: slots[selection.last].end };
}

/** "Period 2" or "Period 2 to Period 3": the names of a run. */
export function runLabel(slots: Slot[], selection: Selection): string {
  const first = slots[selection.first].name;
  const last = slots[selection.last].name;
  return first === last ? first : `${first} to ${last}`;
}

/**
 * The periods a booking covers, in words ("Period 2 to Period 3"), or null
 * when it doesn't line up with that day's periods (a custom time).
 */
export function periodsLabel(start: Date, end: Date, periods: Period[]): string | null {
  const slots = buildSlots(dayKey(start), periods);
  const first = slots.findIndex((slot) => slot.start.getTime() === start.getTime());
  const last = slots.findIndex((slot) => slot.end.getTime() === end.getTime());
  if (first === -1 || last < first) return null;
  return runLabel(slots, { first, last });
}

// ---------------------------------------------------------------------------
// Custom times (only when an admin allows them: app_settings.allow_custom_booking_times)
// ---------------------------------------------------------------------------

export interface CustomTimes {
  /** Wall-clock times in Dubai, '15:30'. */
  from: string;
  to: string;
}

/**
 * Why a custom time can't be requested on this day, or null if it can. The
 * database checks the venue's own limits (hours, longest booking) on request.
 */
export function customTimesProblem(
  day: string,
  times: CustomTimes,
  approved: CalendarBooking[],
  closedReason: string | null,
  now: Date = new Date(),
): string | null {
  if (closedReason) return closedReason;
  if (!times.from || !times.to) return 'Choose a start and an end time.';
  if (times.to <= times.from) return 'The end must be after the start.';
  const start = atSchoolTime(day, times.from);
  const end = atSchoolTime(day, times.to);
  if (start < now) return 'That time has already started.';
  const clash = approved.find(
    (booking) => start < new Date(booking.ends_at) && new Date(booking.starts_at) < end,
  );
  if (clash) {
    return `Clashes with "${clash.title}" (${formatTimeRange(clash.starts_at, clash.ends_at)}).`;
  }
  return null;
}

// ---------------------------------------------------------------------------
// The request form
// ---------------------------------------------------------------------------

export interface BookingFormValues {
  title: string;
  purpose: string;
  expectedAttendance: string;
  supervisingTeacherId: string;
}

export type BookingFormErrors = Partial<Record<keyof BookingFormValues, string>>;

export const emptyBookingValues: BookingFormValues = {
  title: '',
  purpose: '',
  expectedAttendance: '',
  supervisingTeacherId: '',
};

export function validateBooking(
  values: BookingFormValues,
  { isStudent, capacity }: { isStudent: boolean; capacity: number | null },
): BookingFormErrors {
  const errors: BookingFormErrors = {};
  if (!values.title.trim()) errors.title = 'Say what the booking is for.';
  else if (values.title.trim().length > 120) errors.title = 'Keep the title under 120 characters.';
  if (values.purpose.length > 1000) errors.purpose = 'Keep this under 1000 characters.';
  if (values.expectedAttendance.trim()) {
    const people = Number(values.expectedAttendance);
    if (!Number.isInteger(people) || people < 1)
      errors.expectedAttendance = 'Enter a whole number of people.';
    else if (capacity && people > capacity)
      errors.expectedAttendance = `This venue holds up to ${capacity} people.`;
  }
  if (isStudent && !values.supervisingTeacherId) {
    errors.supervisingTeacherId = 'Students need a teacher to supervise.';
  }
  return errors;
}
