// Admin screens: form checks (tested in admin.test.tsx). The database repeats
// the important ones (unique emails and codes, number ranges).
import { differenceInHours } from 'date-fns';
import type { AppSettings } from '@/features/settings/api';
import { csvToObjects } from '@/lib/csv';
import type { AdminUser, ImportResult, ImportRow, Role } from './api';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ---------------------------------------------------------------------------
// Overview
// ---------------------------------------------------------------------------

/** "waiting 3 days", "waiting 5 hours", "waiting under an hour". */
export function waitingFor(since: string | null, now: Date = new Date()): string {
  if (!since) return '';
  const hours = differenceInHours(now, new Date(since));
  if (hours < 1) return 'waiting under an hour';
  if (hours < 48) return `waiting ${hours} ${hours === 1 ? 'hour' : 'hours'}`;
  return `waiting ${Math.floor(hours / 24)} days`;
}

/** 0.4236 → "42%"; null (nothing bookable) → "–". */
export function percent(share: number | null): string {
  return share === null ? '–' : `${Math.round(share * 100)}%`;
}

/** Hours with at most one decimal, without a trailing ".0": 12.5, 3. */
export function hours(value: number): string {
  return String(Math.round(value * 10) / 10);
}

export function validateStaffEmail(email: string, existing: string[]): string | null {
  const value = email.trim().toLowerCase();
  if (!EMAIL.test(value)) return 'Enter a full email address.';
  if (existing.some((e) => e.toLowerCase() === value)) return 'That email is already on the list.';
  return null;
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export interface UserFilters {
  query: string;
  role: Role | 'all';
  /** A grade number as text, or '' for any grade. */
  grade: string;
  status: 'current' | 'suspended' | 'archived' | 'all';
}

export const noUserFilters: UserFilters = { query: '', role: 'all', grade: '', status: 'current' };

/** Search by name or email, then narrow by role, grade and status. */
export function filterUsers(users: AdminUser[], filters: UserFilters): AdminUser[] {
  const q = filters.query.trim().toLowerCase();
  return users.filter((user) => {
    if (q && !user.full_name.toLowerCase().includes(q) && !user.email.toLowerCase().includes(q))
      return false;
    if (filters.role !== 'all' && user.role !== filters.role) return false;
    if (filters.grade && String(user.grade) !== filters.grade) return false;
    if (filters.status === 'current') return !user.archived_at;
    if (filters.status === 'suspended') return Boolean(user.posting_suspended_until);
    if (filters.status === 'archived') return Boolean(user.archived_at);
    return true;
  });
}

// ---------------------------------------------------------------------------
// Grades, sections and classes
// ---------------------------------------------------------------------------

export function validateGrade(value: string, existing: number[]): string | null {
  const grade = Number(value);
  if (!value.trim() || !Number.isInteger(grade) || grade < 1 || grade > 13)
    return 'A grade from 1 to 13.';
  if (existing.includes(grade)) return 'That grade is already set up.';
  return null;
}

export function validateSectionName(value: string, existing: string[]): string | null {
  const name = value.trim();
  if (!name) return 'Name the section, e.g. C.';
  if (name.length > 10) return 'Keep it short, e.g. C or Blue.';
  if (existing.some((s) => s.toLowerCase() === name.toLowerCase()))
    return 'This grade already has that section.';
  return null;
}

export interface ClassFormValues {
  name: string;
  subject: string;
  grade: string;
  sectionId: string;
  teacherIds: string[];
  studentIds: string[];
}

export function validateClass(
  values: ClassFormValues,
): Partial<Record<keyof ClassFormValues, string>> {
  const errors: Partial<Record<keyof ClassFormValues, string>> = {};
  if (!values.name.trim()) errors.name = 'Name the class, e.g. 10 A Physics.';
  else if (values.name.trim().length > 80) errors.name = 'Keep the name under 80 characters.';
  if (!values.grade) errors.grade = 'Choose the grade.';
  if (values.teacherIds.length === 0) errors.teacherIds = 'Choose at least one teacher.';
  return errors;
}

// ---------------------------------------------------------------------------
// Import
// ---------------------------------------------------------------------------

export const IMPORT_COLUMNS = ['name', 'email', 'role', 'grade', 'section'] as const;

/** CSV text → rows for the database, or a message if the headings are wrong. */
export function rowsFromCsv(text: string): { rows: ImportRow[] } | { problem: string } {
  const objects = csvToObjects(text);
  if (objects.length === 0) return { problem: 'The file has no rows.' };
  if (!('name' in objects[0]) || !('email' in objects[0])) {
    return { problem: `The first line must be the headings: ${IMPORT_COLUMNS.join(',')}` };
  }
  return {
    rows: objects.map((o) => ({
      name: o.name ?? '',
      email: o.email ?? '',
      role: o.role ?? '',
      grade: o.grade ?? '',
      section: o.section ?? '',
    })),
  };
}

/** "3 new · 1 to update · 2 with problems" */
export function importSummary(results: ImportResult[]): string {
  const count = (outcome: ImportResult['outcome']) =>
    results.filter((r) => r.outcome === outcome).length;
  return `${count('create')} new · ${count('update')} to update · ${count('error')} with problems`;
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
