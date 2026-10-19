// Small text helpers shared by the announcement card, detail page and tests.
import type { Announcement } from './api';

/** "Grades 10, 12" or "Whole school". */
export function audienceLabel(announcement: Pick<Announcement, 'audience' | 'grades'>): string {
  if (announcement.audience === 'school') return 'Whole school';
  const grades = announcement.grades ?? [];
  return `${grades.length === 1 ? 'Grade' : 'Grades'} ${grades.join(', ')}`;
}

/** Who it's from: the "post as" name if given, otherwise the author. */
export function bylineOf(announcement: Announcement): string {
  return announcement.posted_as || announcement.author?.full_name || 'School';
}
