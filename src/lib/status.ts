// Every database status, mapped to the words people see and the chip colour.
// Tones follow the design: good = teal soft, attention = orange soft
// (waiting / needs action), quiet = draft or closed.
import type { BadgeTone } from '@/components/Badge';
import type { Enums } from '@/types/database';

interface StatusLook {
  label: string;
  tone: BadgeTone;
}

type StatusMap<E extends string> = Record<E, StatusLook>;

export const volunteerEventStatus: StatusMap<Enums<'volunteer_event_status'>> = {
  awaiting_approval: { label: 'Awaiting approval', tone: 'attention' },
  published: { label: 'Published', tone: 'good' },
  sent_back: { label: 'Sent back', tone: 'attention' },
  closed: { label: 'Closed', tone: 'quiet' },
};

export const signupStatus: StatusMap<Enums<'signup_status'>> = {
  applied: { label: 'Signed up', tone: 'attention' },
  selected: { label: 'Selected', tone: 'good' },
  waitlisted: { label: 'Waitlisted', tone: 'attention' },
  not_selected: { label: 'Not selected', tone: 'quiet' },
  withdrawn: { label: 'Withdrawn', tone: 'quiet' },
};

export const projectStatus: StatusMap<Enums<'project_status'>> = {
  draft: { label: 'Draft', tone: 'quiet' },
  shared: { label: 'Shared', tone: 'attention' },
  in_review: { label: 'In review', tone: 'attention' },
  feedback_given: { label: 'Feedback', tone: 'good' },
  complete: { label: 'Complete', tone: 'good' },
};

export const collabStatus: StatusMap<Enums<'collab_status'>> = {
  open: { label: 'Open', tone: 'good' },
  full: { label: 'Full', tone: 'quiet' },
  closed: { label: 'Closed', tone: 'quiet' },
};

export const joinRequestStatus: StatusMap<Enums<'join_request_status'>> = {
  pending: { label: 'Pending', tone: 'attention' },
  accepted: { label: 'Accepted', tone: 'good' },
  declined: { label: 'Declined', tone: 'quiet' },
  withdrawn: { label: 'Withdrawn', tone: 'quiet' },
};

export const bookingStatus: StatusMap<Enums<'booking_status'>> = {
  awaiting_teacher: { label: 'Awaiting teacher', tone: 'attention' },
  pending: { label: 'Pending approval', tone: 'attention' },
  approved: { label: 'Approved', tone: 'good' },
  rejected: { label: 'Not approved', tone: 'quiet' },
  cancelled: { label: 'Cancelled', tone: 'quiet' },
};

export const reportStatus: StatusMap<Enums<'report_status'>> = {
  open: { label: 'Open', tone: 'attention' },
  acknowledged: { label: 'Acknowledged', tone: 'attention' },
  in_progress: { label: 'In progress', tone: 'attention' },
  resolved: { label: 'Resolved', tone: 'good' },
  duplicate: { label: 'Duplicate', tone: 'quiet' },
  wont_fix: { label: "Won't fix", tone: 'quiet' },
};

export const contentReportStatus: StatusMap<Enums<'content_report_status'>> = {
  open: { label: 'Open', tone: 'attention' },
  actioned: { label: 'Actioned', tone: 'good' },
  dismissed: { label: 'Dismissed', tone: 'quiet' },
};

export const reportCategoryLabel: Record<Enums<'report_category'>, string> = {
  electrical: 'Electrical',
  ac: 'Air conditioning',
  plumbing: 'Plumbing',
  furniture: 'Furniture',
  it: 'IT',
  cleanliness: 'Cleanliness',
  other: 'Other',
};

export const responsibilityLabel: Record<Enums<'responsibility_kind'>, string> = {
  facilities: 'Facilities',
  it: 'IT',
  venues: 'Venues',
  supw: 'SUPW coordinator',
};

export const roleLabel: Record<Enums<'user_role'>, string> = {
  student: 'Student',
  teacher: 'Teacher',
  admin: 'Admin',
};

export const roomKindLabel: Record<Enums<'room_kind'>, string> = {
  classroom: 'Classroom',
  lab: 'Lab',
  office: 'Office',
  hall: 'Hall',
  library: 'Library',
  cafeteria: 'Cafeteria',
  other: 'Other',
};
