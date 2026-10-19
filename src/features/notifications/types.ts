// What each notification type means, in words for the settings screen.
// UNMUTABLE_TYPES must match notification_type_is_unmutable() in
// supabase/migrations/20261019120200_notifications.sql (Q16).
import type { Enums } from '@/types/database';

export type NotificationType = Enums<'notification_type'>;

export const notificationTypeLabel: Record<NotificationType, string> = {
  announcement_new: 'Announcements for your grade, and pinned ones',
  report_new: 'New fix-it reports for your team',
  report_status: 'Updates on fix-it reports you made or backed',
  collab_request_new: 'Someone asks to join your collab post',
  collab_request_accepted: 'You were accepted onto a team',
  collab_request_declined: 'A collab request was declined',
  vol_event_pending_approval: 'Student volunteering events to approve',
  vol_event_approved: 'Your volunteering event was approved',
  vol_event_sent_back: 'Your volunteering event was sent back',
  vol_signup_new: 'Someone signs up for your event',
  vol_selected: 'You were selected for a volunteering role',
  vol_waitlisted: 'You were waitlisted for a volunteering role',
  vol_withdrawal: 'A selected volunteer withdrew from your event',
  booking_awaiting_teacher: 'A student asks you to supervise a booking',
  booking_pending: 'Venue requests to approve',
  booking_approved: 'Your booking was approved',
  booking_rejected: 'Your booking was not approved or was cancelled',
  booking_reminder: 'Reminders about venue requests still waiting',
  project_shared: 'A student shares a project with you',
  project_feedback: 'A teacher gives feedback on your project',
};

/** Approvals and "someone is waiting on you": always delivered. */
export const UNMUTABLE_TYPES: NotificationType[] = [
  'report_new',
  'vol_event_pending_approval',
  'booking_awaiting_teacher',
  'booking_pending',
  'booking_reminder',
];

/** Types only staff receive, hidden from students' settings to keep it short. */
export const STAFF_ONLY_TYPES: NotificationType[] = [
  'report_new',
  'vol_event_pending_approval',
  'booking_awaiting_teacher',
  'booking_pending',
  'booking_reminder',
  'project_shared',
];
