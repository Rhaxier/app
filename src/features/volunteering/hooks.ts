// SUPW volunteering: TanStack Query hooks. Every change invalidates the whole
// ['volunteering'] key: lists, counts and sign-ups are all connected, and the
// data is small, so refetching all of it is simplest and always correct.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { showToast } from '@/lib/toast';
import {
  createEvent,
  deleteEvent,
  fetchCategories,
  fetchSupwTargets,
  saveCategory,
  setSupwTarget,
  type VolunteerCategory,
  fetchEvent,
  fetchEvents,
  fetchEventSignups,
  fetchHoursToConfirm,
  fetchMySignups,
  fetchSupwHoursReport,
  setEventStatus,
  setMySignupStatus,
  signUp,
  updateEvent,
  updateSignup,
  type EventInput,
  type EventStatus,
  type RoleInput,
  type SignupChanges,
} from './api';

export const volunteerKeys = {
  all: ['volunteering'] as const,
  events: () => [...volunteerKeys.all, 'events'] as const,
  event: (id: string) => [...volunteerKeys.all, 'event', id] as const,
  mySignups: (userId: string) => [...volunteerKeys.all, 'my-signups', userId] as const,
  signups: (eventId: string) => [...volunteerKeys.all, 'signups', eventId] as const,
  hoursToConfirm: () => [...volunteerKeys.all, 'hours-to-confirm'] as const,
};

export function useEvents() {
  return useQuery({ queryKey: volunteerKeys.events(), queryFn: fetchEvents });
}

export function useEvent(id: string) {
  return useQuery({ queryKey: volunteerKeys.event(id), queryFn: () => fetchEvent(id) });
}

export function useMySignups(userId: string) {
  return useQuery({
    queryKey: volunteerKeys.mySignups(userId),
    queryFn: () => fetchMySignups(userId),
  });
}

/** Contact details of everyone signed up. Only ask when allowed (organiser/staff). */
export function useEventSignups(eventId: string, enabled: boolean) {
  return useQuery({
    queryKey: volunteerKeys.signups(eventId),
    queryFn: () => fetchEventSignups(eventId),
    enabled,
  });
}

export function useHoursToConfirm(enabled = true) {
  return useQuery({
    queryKey: volunteerKeys.hoursToConfirm(),
    queryFn: fetchHoursToConfirm,
    enabled,
  });
}

function useInvalidateVolunteering() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: volunteerKeys.all });
}

export function useCreateEvent() {
  const invalidate = useInvalidateVolunteering();
  return useMutation({
    mutationFn: ({ input, roles }: { input: EventInput; roles: RoleInput[] }) =>
      createEvent(input, roles),
    onSuccess: invalidate,
    meta: { successMessage: 'Event created' },
  });
}

export function useUpdateEvent(id: string) {
  const invalidate = useInvalidateVolunteering();
  return useMutation({
    mutationFn: ({
      input,
      roles,
      removedRoleIds,
    }: {
      input: EventInput;
      roles: RoleInput[];
      removedRoleIds: string[];
    }) => updateEvent(id, input, roles, removedRoleIds),
    onSuccess: invalidate,
    meta: { successMessage: 'Event saved' },
  });
}

export function useSetEventStatus(id: string) {
  const invalidate = useInvalidateVolunteering();
  return useMutation({
    mutationFn: ({ status, note }: { status: EventStatus; note?: string }) =>
      setEventStatus(id, status, note),
    onSuccess: (_data, { status }) => {
      invalidate();
      showToast(eventStatusToast[status]);
    },
    meta: { errorToast: true },
  });
}

export function useDeleteEvent() {
  const invalidate = useInvalidateVolunteering();
  return useMutation({
    mutationFn: deleteEvent,
    onSuccess: invalidate,
    meta: { successMessage: 'Event deleted', errorToast: true },
  });
}

export function useSignUp(eventId: string) {
  const invalidate = useInvalidateVolunteering();
  return useMutation({
    mutationFn: ({ roleId, note }: { roleId: string; note: string }) =>
      signUp(eventId, roleId, note),
    onSuccess: invalidate,
    meta: { successMessage: "You're signed up" },
  });
}

export function useSetMySignupStatus() {
  const invalidate = useInvalidateVolunteering();
  return useMutation({
    mutationFn: ({ signupId, status }: { signupId: string; status: 'withdrawn' | 'applied' }) =>
      setMySignupStatus(signupId, status),
    onSuccess: (_data, { status }) => {
      invalidate();
      showToast(status === 'withdrawn' ? "You've withdrawn" : "You're signed up again");
    },
    meta: { errorToast: true },
  });
}

export function useUpdateSignup() {
  const invalidate = useInvalidateVolunteering();
  return useMutation({
    mutationFn: ({ signupId, changes }: { signupId: string; changes: SignupChanges }) =>
      updateSignup(signupId, changes),
    onSuccess: (_data, { changes }) => {
      invalidate();
      showToast(signupChangeToast(changes));
    },
    meta: { errorToast: true },
  });
}

export function useSupwHoursReport() {
  return useMutation({
    mutationFn: fetchSupwHoursReport,
    meta: { successMessage: 'SUPW hours exported' },
  });
}

// What the toast says after each kind of change.
const eventStatusToast: Record<EventStatus, string> = {
  awaiting_approval: 'Sent to a teacher for approval',
  published: 'Event published',
  sent_back: 'Sent back with your note',
  closed: 'Event closed',
};

function signupChangeToast(changes: SignupChanges): string {
  if (changes.hours_confirmed !== undefined) return 'Hours confirmed';
  if (changes.attended !== undefined) return 'Attendance saved';
  if (changes.status === 'selected') return 'Selected. They have been told.';
  if (changes.status === 'waitlisted') return 'Moved to the waitlist';
  if (changes.role_id !== undefined) return 'Moved to another role';
  return 'Saved';
}

// Categories and SUPW targets ------------------------------------------------

export function useVolunteerCategories() {
  return useQuery({
    queryKey: [...volunteerKeys.all, 'categories'],
    queryFn: fetchCategories,
    staleTime: 10 * 60_000,
  });
}

export function useSupwTargets() {
  return useQuery({
    queryKey: [...volunteerKeys.all, 'targets'],
    queryFn: fetchSupwTargets,
    staleTime: 10 * 60_000,
  });
}

export function useSaveCategory() {
  const invalidate = useInvalidateVolunteering();
  return useMutation({
    mutationFn: ({ id, fields }: { id: string | null; fields: Omit<VolunteerCategory, 'id'> }) =>
      saveCategory(id, fields),
    onSuccess: invalidate,
    meta: { successMessage: 'Category saved', errorToast: true },
  });
}

export function useSetSupwTarget() {
  const invalidate = useInvalidateVolunteering();
  return useMutation({
    mutationFn: ({ grade, hours }: { grade: number; hours: number | null }) =>
      setSupwTarget(grade, hours),
    onSuccess: invalidate,
    meta: { successMessage: 'Target saved', errorToast: true },
  });
}
