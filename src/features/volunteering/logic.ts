// SUPW volunteering: plain functions the screens use to decide what to show.
// No React and no Supabase, so they're simple to test (volunteering.test.tsx).
import { fromDateTimeInputValue, isThisWeek, toDateTimeInputValue, weeksAgo } from '@/lib/dates';
import type { EventInput, EventRole, MySignup, RoleInput, VolunteerEvent } from './api';

/** Signed up, selected or waitlisted: still taking part. */
export function isActiveSignup(signup: Pick<MySignup, 'status'>): boolean {
  return ['applied', 'selected', 'waitlisted'].includes(signup.status);
}

/** Where it happens: the room's name, or the free-text place. */
export function placeOf(event: Pick<VolunteerEvent, 'room' | 'place_text'>): string {
  return event.room ? event.room.name : (event.place_text ?? '');
}

/** Spots still open in one role. */
export function roleSpotsLeft(role: Pick<EventRole, 'spots_wanted' | 'selected_count'>): number {
  return Math.max(0, role.spots_wanted - role.selected_count);
}

/** Spots still open across every role in the event. */
export function eventSpotsLeft(event: Pick<VolunteerEvent, 'roles'>): number {
  return event.roles.reduce((total, role) => total + roleSpotsLeft(role), 0);
}

/** "3 of 5 filled" */
export function filledLabel(role: Pick<EventRole, 'spots_wanted' | 'selected_count'>): string {
  return `${role.selected_count} of ${role.spots_wanted} filled`;
}

/** Can students sign up right now? (The database checks the same things.) */
export function isSignupOpen(
  event: Pick<VolunteerEvent, 'status' | 'signup_deadline' | 'starts_at'>,
  now: Date = new Date(),
): boolean {
  if (event.status !== 'published') return false;
  if (event.signup_deadline && now > new Date(event.signup_deadline)) return false;
  return now < new Date(event.starts_at);
}

export function hasStarted(
  event: Pick<VolunteerEvent, 'starts_at'>,
  now: Date = new Date(),
): boolean {
  return now >= new Date(event.starts_at);
}

/** Total confirmed SUPW hours from a student's own sign-ups. */
export function hoursSoFar(signups: Pick<MySignup, 'hours_confirmed'>[]): number {
  return signups.reduce((total, signup) => total + (signup.hours_confirmed ?? 0), 0);
}

/**
 * Confirmed hours in each of the last few school weeks, oldest first: the
 * small chart beside your total (design PDF page 7, "Hours as a number").
 * A sign-up counts in the week its event happened.
 */
export function hoursByWeek(
  signups: Pick<MySignup, 'event_id' | 'hours_confirmed'>[],
  events: Pick<VolunteerEvent, 'id' | 'starts_at'>[],
  now: Date = new Date(),
  weeks = 8,
): number[] {
  const startsAt = new Map(events.map((event) => [event.id, event.starts_at]));
  const totals: number[] = Array(weeks).fill(0);
  for (const signup of signups) {
    const start = startsAt.get(signup.event_id);
    if (!signup.hours_confirmed || !start) continue;
    const ago = weeksAgo(start, now);
    if (ago >= 0 && ago < weeks) totals[weeks - 1 - ago] += signup.hours_confirmed;
  }
  return totals;
}

/** Your sign-up for an event that's still taking part, if any (the "You're in" chip). */
export function activeSignupFor(eventId: string, signups: MySignup[]): MySignup | undefined {
  return signups.find((signup) => signup.event_id === eventId && isActiveSignup(signup));
}

export type VolunteerFilter = 'all' | 'week' | 'school' | 'mine';

export const volunteerFilters: { value: VolunteerFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'week', label: 'This week' },
  { value: 'school', label: 'In school' },
  { value: 'mine', label: 'Signed up' },
];

/**
 * The list screen's chips. "All" hides events that have finished, unless you
 * organised or joined them ("Signed up" keeps your history).
 */
export function filterEvents(
  events: VolunteerEvent[],
  filter: VolunteerFilter,
  mySignups: MySignup[],
  userId: string,
  now: Date = new Date(),
): VolunteerEvent[] {
  // Your events: any you signed up for and didn't withdraw from, past or future.
  const joined = new Set(
    mySignups.filter((signup) => signup.status !== 'withdrawn').map((signup) => signup.event_id),
  );
  const upcoming = (event: VolunteerEvent) => new Date(event.ends_at) >= now;
  switch (filter) {
    case 'week':
      return events.filter((event) => upcoming(event) && isThisWeek(event.starts_at, now));
    case 'school':
      // A room on the map means the event happens at school.
      return events.filter((event) => upcoming(event) && event.room_id !== null);
    case 'mine':
      return events.filter((event) => joined.has(event.id));
    default:
      return events.filter((event) => upcoming(event) || event.creator_id === userId);
  }
}

/** The category chips (Q27): '' = every category. */
export function filterByCategory<T extends Pick<VolunteerEvent, 'category_id'>>(
  events: T[],
  categoryId: string,
): T[] {
  return categoryId ? events.filter((event) => event.category_id === categoryId) : events;
}

// ---------------------------------------------------------------------------
// The create / edit form
// ---------------------------------------------------------------------------

export interface RoleFormValues {
  id?: string;
  name: string;
  description: string;
  spotsWanted: string;
  /** Existing roles with selected students can't be removed. */
  locked?: boolean;
}

export interface EventFormValues {
  title: string;
  organiserLabel: string;
  description: string;
  startsAt: string; // datetime-local value, Dubai time
  endsAt: string;
  placeKind: 'room' | 'text';
  roomId: string;
  placeText: string;
  supwHours: string;
  signupDeadline: string;
  allowMultipleRoles: boolean;
  /** A volunteer_categories id, or '' for none. */
  categoryId: string;
  roles: RoleFormValues[];
}

export interface EventFormErrors {
  title?: string;
  startsAt?: string;
  endsAt?: string;
  place?: string;
  supwHours?: string;
  signupDeadline?: string;
  roles?: string;
  roleErrors?: { name?: string; spotsWanted?: string }[];
}

export function validateEvent(values: EventFormValues): EventFormErrors {
  const errors: EventFormErrors = {};
  if (!values.title.trim()) errors.title = 'Add a title.';
  else if (values.title.trim().length > 120) errors.title = 'Keep the title under 120 characters.';

  const starts = fromDateTimeInputValue(values.startsAt);
  const ends = fromDateTimeInputValue(values.endsAt);
  if (!starts) errors.startsAt = 'Choose when it starts.';
  if (!ends) errors.endsAt = 'Choose when it ends.';
  if (starts && ends && ends <= starts) errors.endsAt = 'The end must be after the start.';

  if (values.placeKind === 'room' && !values.roomId) errors.place = 'Choose a room.';
  if (values.placeKind === 'text' && !values.placeText.trim()) errors.place = 'Say where it is.';

  const hours = Number(values.supwHours);
  if (values.supwHours.trim() === '' || Number.isNaN(hours) || hours < 0 || hours > 100) {
    errors.supwHours = 'Enter the SUPW hours awarded (0 or more).';
  }

  const deadline = fromDateTimeInputValue(values.signupDeadline);
  if (deadline && starts && deadline > starts) {
    errors.signupDeadline = 'The sign-up deadline must be before the event starts.';
  }

  if (values.roles.length === 0) errors.roles = 'Add at least one role.';
  const roleErrors = values.roles.map((role) => {
    const roleError: { name?: string; spotsWanted?: string } = {};
    if (!role.name.trim()) roleError.name = 'Name this role.';
    const spots = Number(role.spotsWanted);
    if (!Number.isInteger(spots) || spots < 1) roleError.spotsWanted = 'At least 1.';
    return roleError;
  });
  if (roleErrors.some((roleError) => Object.keys(roleError).length > 0))
    errors.roleErrors = roleErrors;

  return errors;
}

export function hasErrors(errors: EventFormErrors): boolean {
  return Object.keys(errors).length > 0;
}

// ---------------------------------------------------------------------------
// Converting between the form and the database
// ---------------------------------------------------------------------------

export const emptyRole: RoleFormValues = { name: '', description: '', spotsWanted: '1' };

export const emptyEventValues: EventFormValues = {
  title: '',
  organiserLabel: '',
  description: '',
  startsAt: '',
  endsAt: '',
  placeKind: 'room',
  roomId: '',
  placeText: '',
  supwHours: '1',
  signupDeadline: '',
  allowMultipleRoles: false,
  categoryId: '',
  roles: [{ ...emptyRole }],
};

export function valuesFromEvent(event: VolunteerEvent): EventFormValues {
  return {
    title: event.title,
    organiserLabel: event.organiser_label ?? '',
    description: event.description,
    startsAt: toDateTimeInputValue(event.starts_at),
    endsAt: toDateTimeInputValue(event.ends_at),
    placeKind: event.room_id ? 'room' : 'text',
    roomId: event.room_id ?? '',
    placeText: event.place_text ?? '',
    supwHours: String(event.supw_hours),
    signupDeadline: toDateTimeInputValue(event.signup_deadline),
    allowMultipleRoles: event.allow_multiple_roles,
    categoryId: event.category_id ?? '',
    roles: event.roles.map((role) => ({
      id: role.id,
      name: role.name,
      description: role.description,
      spotsWanted: String(role.spots_wanted),
      locked: role.selected_count > 0,
    })),
  };
}

export function toEventInput(values: EventFormValues): EventInput {
  return {
    title: values.title.trim(),
    organiser_label: values.organiserLabel.trim() || null,
    description: values.description.trim(),
    starts_at: fromDateTimeInputValue(values.startsAt)!,
    ends_at: fromDateTimeInputValue(values.endsAt)!,
    room_id: values.placeKind === 'room' ? values.roomId : null,
    place_text: values.placeKind === 'text' ? values.placeText.trim() : null,
    supw_hours: Number(values.supwHours),
    signup_deadline: fromDateTimeInputValue(values.signupDeadline),
    allow_multiple_roles: values.allowMultipleRoles,
    category_id: values.categoryId || null,
  };
}

export function toRoleInputs(values: EventFormValues): RoleInput[] {
  return values.roles.map((role) => ({
    id: role.id,
    name: role.name.trim(),
    description: role.description.trim(),
    spots_wanted: Number(role.spotsWanted),
  }));
}
