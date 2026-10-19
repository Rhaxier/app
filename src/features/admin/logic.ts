// Admin screens: form checks (tested in admin.test.tsx). The database repeats
// the important ones (unique emails and codes, number ranges).
import type { AppSettings } from '@/features/settings/api';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateStaffEmail(email: string, existing: string[]): string | null {
  const value = email.trim().toLowerCase();
  if (!EMAIL.test(value)) return 'Enter a full email address.';
  if (existing.some((e) => e.toLowerCase() === value)) return 'That email is already on the list.';
  return null;
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export interface SettingsFormValues {
  schoolName: string;
  schoolEmailDomain: string;
  allowDevAccounts: boolean;
  staffEmailPattern: string;
  studentsCanRequestVenues: boolean;
  collabRequiresTeacher: boolean;
  supwHoursTarget: string;
  grades: number[];
  venueReminderHours: string;
  venueReminderDaysBefore: string;
  schoolDays: number[];
  bookingDayStart: string;
  bookingSlotMinutes: string;
  bookingSlotsPerDay: string;
}

export type SettingsFormErrors = Partial<Record<keyof SettingsFormValues, string>>;

export function valuesFromSettings(settings: AppSettings): SettingsFormValues {
  return {
    schoolName: settings.school_name,
    schoolEmailDomain: settings.school_email_domain ?? '',
    allowDevAccounts: settings.allow_dev_accounts,
    staffEmailPattern: settings.staff_email_pattern ?? '',
    studentsCanRequestVenues: settings.students_can_request_venues,
    collabRequiresTeacher: settings.collab_requires_teacher,
    supwHoursTarget: settings.supw_hours_target === null ? '' : String(settings.supw_hours_target),
    grades: [...settings.grades].sort((a, b) => a - b),
    venueReminderHours: String(settings.venue_reminder_hours),
    venueReminderDaysBefore: String(settings.venue_reminder_days_before),
    schoolDays: [...settings.school_days].sort((a, b) => a - b),
    bookingDayStart: settings.booking_day_start.slice(0, 5),
    bookingSlotMinutes: String(settings.booking_slot_minutes),
    bookingSlotsPerDay: String(settings.booking_slots_per_day),
  };
}

function isWhole(value: string, min: number, max: number): boolean {
  const n = Number(value);
  return value.trim() !== '' && Number.isInteger(n) && n >= min && n <= max;
}

export function validateSettings(values: SettingsFormValues): SettingsFormErrors {
  const errors: SettingsFormErrors = {};
  if (!values.schoolName.trim()) errors.schoolName = 'Enter the school name.';
  const domain = values.schoolEmailDomain.trim();
  if (domain && !/^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(domain)) {
    errors.schoolEmailDomain = 'Just the domain, e.g. school.example (no @).';
  }
  if (values.staffEmailPattern.trim()) {
    try {
      new RegExp(values.staffEmailPattern.trim());
    } catch {
      errors.staffEmailPattern = "That pattern isn't valid.";
    }
  }
  if (values.supwHoursTarget.trim() && !(Number(values.supwHoursTarget) >= 0)) {
    errors.supwHoursTarget = 'Enter a number of hours, or leave it empty.';
  }
  if (values.grades.length === 0) errors.grades = 'Choose at least one grade.';
  if (!isWhole(values.venueReminderHours, 1, 720))
    errors.venueReminderHours = 'Between 1 and 720 hours.';
  if (!isWhole(values.venueReminderDaysBefore, 0, 60))
    errors.venueReminderDaysBefore = 'Between 0 and 60 days.';
  if (values.schoolDays.length === 0) errors.schoolDays = 'Choose at least one school day.';
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(values.bookingDayStart))
    errors.bookingDayStart = 'A time like 07:30.';
  if (!isWhole(values.bookingSlotMinutes, 15, 480))
    errors.bookingSlotMinutes = 'Between 15 and 480 minutes.';
  if (!isWhole(values.bookingSlotsPerDay, 1, 24))
    errors.bookingSlotsPerDay = 'Between 1 and 24 slots.';
  return errors;
}

export function toSettingsChanges(values: SettingsFormValues) {
  return {
    school_name: values.schoolName.trim(),
    school_email_domain: values.schoolEmailDomain.trim().toLowerCase() || null,
    allow_dev_accounts: values.allowDevAccounts,
    staff_email_pattern: values.staffEmailPattern.trim() || null,
    students_can_request_venues: values.studentsCanRequestVenues,
    collab_requires_teacher: values.collabRequiresTeacher,
    supw_hours_target: values.supwHoursTarget.trim() ? Number(values.supwHoursTarget) : null,
    grades: values.grades,
    venue_reminder_hours: Number(values.venueReminderHours),
    venue_reminder_days_before: Number(values.venueReminderDaysBefore),
    school_days: values.schoolDays,
    booking_day_start: values.bookingDayStart,
    booking_slot_minutes: Number(values.bookingSlotMinutes),
    booking_slots_per_day: Number(values.bookingSlotsPerDay),
  };
}

// ---------------------------------------------------------------------------
// Venues and rooms
// ---------------------------------------------------------------------------

export interface VenueFormValues {
  name: string;
  roomId: string;
  capacity: string;
  needsApproval: boolean;
  active: boolean;
}

export function validateVenue(
  values: VenueFormValues,
): Partial<Record<keyof VenueFormValues, string>> {
  const errors: Partial<Record<keyof VenueFormValues, string>> = {};
  if (!values.name.trim()) errors.name = 'Name the venue.';
  if (values.capacity.trim() && !isWhole(values.capacity, 1, 100000))
    errors.capacity = 'A whole number of people.';
  return errors;
}

export interface RoomFormValues {
  code: string;
  name: string;
}

export function validateRoom(
  values: RoomFormValues,
  existingCodes: string[],
): Partial<Record<keyof RoomFormValues, string>> {
  const errors: Partial<Record<keyof RoomFormValues, string>> = {};
  const code = values.code.trim();
  if (!code) errors.code = 'Give the room a code, e.g. G.14.';
  else if (existingCodes.some((c) => c.toLowerCase() === code.toLowerCase()))
    errors.code = 'Another room has that code.';
  if (!values.name.trim()) errors.name = 'Name the room.';
  return errors;
}
