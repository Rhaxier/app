// =============================================================================
// Announcements: form validation (part of layer 4).
//
// A plain function, no React: it takes what's in the form and returns a
// message per problem field. Plain functions are the easiest thing to test
// (see announcements.test.tsx).
//
// Why check here if the database checks anyway? To give a friendly message
// next to the right field BEFORE sending. The database rules are still the
// real protection: these mirror them, they don't replace them.
// =============================================================================
import type { CurrentUser } from '@/features/auth/api';
import { canPostSchoolWide } from '@/lib/permissions';
import type { Enums } from '@/types/database';
import type { Announcement, AnnouncementInput } from './api';

export interface AnnouncementFormValues {
  title: string;
  body: string;
  postedAs: string;
  audience: Enums<'announcement_audience'>;
  grades: number[];
  /** Optional: only some sections (ids). Their grades are added automatically. */
  sectionIds: string[];
  pinned: boolean;
}

export type AnnouncementErrors = Partial<Record<keyof AnnouncementFormValues, string>>;

export const TITLE_MAX = 140;
export const BODY_MAX = 4000;

export function validateAnnouncement(
  values: AnnouncementFormValues,
  user: CurrentUser,
): AnnouncementErrors {
  const errors: AnnouncementErrors = {};

  if (!values.title.trim()) errors.title = 'Add a title.';
  else if (values.title.trim().length > TITLE_MAX) {
    errors.title = `Keep the title under ${TITLE_MAX} characters.`;
  }

  if (values.body.length > BODY_MAX) errors.body = `Keep it under ${BODY_MAX} characters.`;

  if (values.postedAs.length > 60) errors.postedAs = 'Keep this under 60 characters.';

  if (
    values.audience === 'grades' &&
    values.grades.length === 0 &&
    values.sectionIds.length === 0
  ) {
    errors.grades = 'Choose at least one grade or section.';
  }

  // Mirrors the "Staff post announcements" policy.
  if (!canPostSchoolWide(user)) {
    if (values.audience === 'school') errors.audience = 'Only admins can post to the whole school.';
    if (values.pinned) errors.pinned = 'Only admins can pin announcements.';
  }

  return errors;
}

// -----------------------------------------------------------------------------
// Converting between the form and the database
// -----------------------------------------------------------------------------

export const emptyAnnouncementValues: AnnouncementFormValues = {
  title: '',
  body: '',
  postedAs: '',
  audience: 'grades',
  grades: [],
  sectionIds: [],
  pinned: false,
};

export function valuesFromAnnouncement(announcement: Announcement): AnnouncementFormValues {
  return {
    title: announcement.title,
    body: announcement.body,
    postedAs: announcement.posted_as ?? '',
    audience: announcement.audience,
    // A section announcement stores its grades too; the form shows just the sections.
    grades: announcement.section_ids ? [] : (announcement.grades ?? []),
    sectionIds: announcement.section_ids ?? [],
    pinned: announcement.pinned,
  };
}

/**
 * Tidies the form into exactly what the table expects. When sections are
 * chosen, the database works out their grades (announcements_check_audience),
 * so the form only has to send the section ids.
 */
export function toAnnouncementInput(values: AnnouncementFormValues): AnnouncementInput {
  const forGrades = values.audience === 'grades';
  const sectionIds = forGrades ? values.sectionIds : [];
  return {
    title: values.title.trim(),
    body: values.body.trim(),
    posted_as: values.postedAs.trim() || null,
    audience: values.audience,
    // The table's CHECK constraint: school-wide posts have no grade list.
    grades: forGrades ? (sectionIds.length ? [] : values.grades) : null,
    section_ids: sectionIds.length ? sectionIds : null,
    pinned: values.pinned,
  };
}
