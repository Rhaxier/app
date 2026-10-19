// Fix-it reports: plain functions for the screens (tested in fixit.test.tsx).
import { relativeTime } from '@/lib/dates';
import { reportCategoryLabel } from '@/lib/status';
import type { Report, ReportCategory, ReportInput, ReportStatus } from './api';
import { OPEN_STATUSES } from './api';

export function isOpen(status: ReportStatus): boolean {
  return OPEN_STATUSES.includes(status);
}

// How a team is named mid-sentence ("Sent to IT").
const teamName: Record<Report['routed_to'], string> = {
  facilities: 'facilities',
  it: 'IT',
  venues: 'venue staff',
  supw: 'the SUPW coordinator',
};

/** "Reported today · Sent to facilities" (as on the mockup's map card). */
export function reportSummary(
  report: Pick<Report, 'created_at' | 'routed_to'>,
  now = new Date(),
): string {
  const when = relativeTime(report.created_at, now);
  const reported = /ago|Just now/.test(when)
    ? 'Reported today'
    : `Reported ${when === 'Yesterday' ? 'yesterday' : when}`;
  return `${reported} · Sent to ${teamName[report.routed_to]}`;
}

/** "Projector won't turn on" becomes the card title; long ones are cut. */
export function reportTitle(description: string, max = 60): string {
  const firstLine = description.split('\n')[0].trim();
  return firstLine.length > max ? `${firstLine.slice(0, max - 1)}…` : firstLine;
}

/** "FIX-IT · ROOM G.15" */
export function reportLabel(report: Pick<Report, 'room_code' | 'category'>): string {
  return report.room_code
    ? `Fix-it · Room ${report.room_code}`
    : `Fix-it · ${reportCategoryLabel[report.category]}`;
}

export interface ReportFormValues {
  roomId: string;
  category: ReportCategory | '';
  description: string;
  urgent: boolean;
  photo: File | null;
}

export type ReportFormErrors = Partial<Record<keyof ReportFormValues, string>>;

export const MAX_PHOTO_BYTES = 5 * 1024 * 1024; // the bucket's file_size_limit

export function validateReport(values: ReportFormValues): ReportFormErrors {
  const errors: ReportFormErrors = {};
  if (!values.roomId) errors.roomId = 'Choose the room.';
  if (!values.category) errors.category = 'Choose what kind of problem it is.';
  const description = values.description.trim();
  if (description.length < 3) errors.description = 'Describe the problem in a few words.';
  else if (description.length > 1000) errors.description = 'Keep it under 1000 characters.';
  if (values.photo && values.photo.size > MAX_PHOTO_BYTES)
    errors.photo = 'Photos can be up to 5 MB.';
  if (values.photo && !values.photo.type.startsWith('image/'))
    errors.photo = 'Choose a photo (an image file).';
  return errors;
}

export function toReportInput(values: ReportFormValues): ReportInput {
  return {
    room_id: values.roomId,
    category: values.category as ReportCategory,
    description: values.description.trim(),
    urgent: values.urgent,
  };
}

/** What staff may do next with a report (the database enforces the same). */
export const staffStatusOptions: { value: ReportStatus; label: string }[] = [
  { value: 'acknowledged', label: 'Acknowledged' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'duplicate', label: 'Duplicate' },
  { value: 'wont_fix', label: "Won't fix" },
];
