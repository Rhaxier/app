// Venue booking: the calendar's maths, as plain functions (tested in
// venues.test.tsx). The day is cut into slots from app_settings (Q11):
// booking_day_start, booking_slot_minutes, booking_slots_per_day, school_days.
import { addDaysToKey, atSchoolTime, dayKey, weekdayOfKey, WEEK_STARTS_ON } from '@/lib/dates';
import type { AppSettings } from '@/features/settings/api';
import type { BookingDetails, CalendarBooking } from './api';

export type SlotSettings = Pick<
  AppSettings,
  'school_days' | 'booking_day_start' | 'booking_slot_minutes' | 'booking_slots_per_day'
>;

export interface Slot {
  index: number;
  start: Date;
  end: Date;
}

/** The bookable slots of one school day, e.g. 7:30, 9:00, 10:30, 12:00, 13:30. */
export function buildSlots(day: string, settings: SlotSettings): Slot[] {
  const first = atSchoolTime(day, settings.booking_day_start.slice(0, 5));
  const minutes = settings.booking_slot_minutes;
  return Array.from({ length: settings.booking_slots_per_day }, (_, index) => ({
    index,
    start: new Date(first.getTime() + index * minutes * 60_000),
    end: new Date(first.getTime() + (index + 1) * minutes * 60_000),
  }));
}

/** The school days of a week, as day keys. weekOffset 0 = this week. */
export function schoolDaysOfWeek(
  weekOffset: number,
  settings: Pick<SlotSettings, 'school_days'>,
  now = new Date(),
): string[] {
  const today = dayKey(now);
  const sinceWeekStart = (weekdayOfKey(today) - WEEK_STARTS_ON + 7) % 7;
  const weekStart = addDaysToKey(today, -sinceWeekStart + weekOffset * 7);
  return Array.from({ length: 7 }, (_, i) => addDaysToKey(weekStart, i)).filter((day) =>
    settings.school_days.includes(weekdayOfKey(day)),
  );
}

/** The day to open on: today if a slot is still ahead, otherwise the next school day. */
export function firstBookableDay(
  days: string[],
  settings: SlotSettings,
  now: Date = new Date(),
): string | undefined {
  const today = dayKey(now);
  return days.find((day) => {
    if (day > today) return true;
    if (day < today) return false;
    const slots = buildSlots(day, settings);
    return slots[slots.length - 1].start > now;
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
