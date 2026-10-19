// UI hints only: these decide which buttons to show. The database enforces the
// real rules (RLS policies and triggers), so a tampered app still can't do
// anything these would hide.
import type { CurrentUser } from '@/features/auth/api';
import type { Enums } from '@/types/database';

export function isStaff(user: CurrentUser): boolean {
  return user.role === 'teacher' || user.role === 'admin';
}

export function isAdmin(user: CurrentUser): boolean {
  return user.role === 'admin';
}

export function hasResponsibility(user: CurrentUser, kind: Enums<'responsibility_kind'>): boolean {
  return isStaff(user) && user.responsibilities.includes(kind);
}

/** Approve or reject venue bookings. */
export function canReviewVenues(user: CurrentUser): boolean {
  return isAdmin(user) || hasResponsibility(user, 'venues');
}

/** Post school-wide or pinned announcements. */
export function canPostSchoolWide(user: CurrentUser): boolean {
  return isAdmin(user);
}

/** Edit or delete an announcement: its author (if still staff) or any admin. */
export function canEditAnnouncement(user: CurrentUser, authorId: string): boolean {
  return isAdmin(user) || (isStaff(user) && authorId === user.id);
}

interface EventLike {
  creator_id: string;
  approved_by: string | null;
  status: Enums<'volunteer_event_status'>;
}

/** Mirrors can_confirm_hours() in the volunteering migration. */
export function canConfirmEventHours(user: CurrentUser, event: EventLike): boolean {
  if (isAdmin(user)) return true;
  if (!isStaff(user)) return false;
  return (
    hasResponsibility(user, 'supw') || event.approved_by === user.id || event.creator_id === user.id
  );
}

/** Students can edit their event until it's approved; staff organisers any time. */
export function canEditEvent(user: CurrentUser, event: EventLike): boolean {
  if (isAdmin(user)) return true;
  if (event.creator_id !== user.id) return false;
  return isStaff(user) || event.status === 'awaiting_approval' || event.status === 'sent_back';
}

export const canDeleteEvent = canEditEvent;
