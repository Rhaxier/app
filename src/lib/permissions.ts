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
