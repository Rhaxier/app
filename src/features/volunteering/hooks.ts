// SUPW volunteering: TanStack Query hooks. Every change invalidates the whole
// ['volunteering'] key: lists, counts and sign-ups are all connected, and the
// data is small, so refetching all of it is simplest and always correct.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createEvent,
  deleteEvent,
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
  });
}

export function useSetEventStatus(id: string) {
  const invalidate = useInvalidateVolunteering();
  return useMutation({
    mutationFn: ({ status, note }: { status: EventStatus; note?: string }) =>
      setEventStatus(id, status, note),
    onSuccess: invalidate,
  });
}

export function useDeleteEvent() {
  const invalidate = useInvalidateVolunteering();
  return useMutation({ mutationFn: deleteEvent, onSuccess: invalidate });
}

export function useSignUp(eventId: string) {
  const invalidate = useInvalidateVolunteering();
  return useMutation({
    mutationFn: ({ roleId, note }: { roleId: string; note: string }) =>
      signUp(eventId, roleId, note),
    onSuccess: invalidate,
  });
}

export function useSetMySignupStatus() {
  const invalidate = useInvalidateVolunteering();
  return useMutation({
    mutationFn: ({ signupId, status }: { signupId: string; status: 'withdrawn' | 'applied' }) =>
      setMySignupStatus(signupId, status),
    onSuccess: invalidate,
  });
}

export function useUpdateSignup() {
  const invalidate = useInvalidateVolunteering();
  return useMutation({
    mutationFn: ({ signupId, changes }: { signupId: string; changes: SignupChanges }) =>
      updateSignup(signupId, changes),
    onSuccess: invalidate,
  });
}

export function useSupwHoursReport() {
  return useMutation({ mutationFn: fetchSupwHoursReport });
}
