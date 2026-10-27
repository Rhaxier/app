// Venue booking: the calendar's maths, as plain functions (tested in
// venues.test.tsx). The week's days are app_settings.school_days (Q11), and
// each day is cut into the school's periods that run that weekday (Admin >
// School calendar). Holidays and blackouts are refused by the database; here
// they're greyed out.
import type { Period } from '@/features/school/api';
import { periodsOn } from '@/features/school/logic';
import type { AppSettings } from '@/features/settings/api';
import { atSchoolTime, dayKey } from '@/lib/dates';
import type { BookingDetails, CalendarBooking } from './api';

export type SlotSettings = Pick<AppSettings, 'school_days'>;

export interface Slot {
  index: number;
  /** The period's name, e.g. "Period 3". */
  name: string;
  start: Date;
  end: Date;
}

/** The bookable slots of one day: that weekday's periods, e.g. 7:30, 9:00, 10:30… */
export function buildSlots(day: string, periods: Period[]): Slot[] {
  return periodsOn(day, periods).map((period, index) => ({
    index,
    name: period.name,
    start: atSchoolTime(day, period.starts_at.slice(0, 5)),
    end: atSchoolTime(day, period.ends_at.slice(0, 5)),
  }));
}

/**
 * The day to open on: today if a slot is still ahead, otherwise the next day
 * that has periods and isn't blocked (a holiday or blackout).
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
 * What each slot shows. Order matters: an approved booking beats a waiting
 * request, which beats "past", which beats your selection.
 */
export function slotStates(
  slots: Slot[],
  approved: CalendarBooking[],
  waiting: BookingDetails[],
  selection: Selection | null,
  now: Date = new Date(),
): SlotState[] {
  return slots.map((slot) => {
    const booked = approved.find((booking) => overlaps(slot, booking));
    if (booked) return { kind: 'booked', booking: booked };
    const request = waiting.find((booking) => overlaps(slot, booking));
    if (request) return { kind: 'waiting', booking: request };
    if (slot.start < now) return { kind: 'past' };
    if (selection && slot.index >= selection.first && slot.index <= selection.last)
      return { kind: 'selected' };
    return { kind: 'available' };
  });
}

/**
 * Tapping a slot. A selection is one run of neighbouring free slots:
 * tap a free slot to start, tap the next one along to extend, tap an end to
 * shrink, tap a lone selected slot to clear. Busy and past slots do nothing.
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

export function selectionTimes(slots: Slot[], selection: Selection): { start: Date; end: Date } {
  return { start: slots[selection.first].start, end: slots[selection.last].end };
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
