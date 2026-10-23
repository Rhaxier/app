// Small text helpers shared by the announcement card, detail page and tests.
import type { Section } from '@/features/school/api';
import { sectionLabel } from '@/features/school/logic';
import type { Announcement } from './api';

/** "Grades 10, 12", "10A, 10B" or "Whole school". */
export function audienceLabel(
  announcement: Pick<Announcement, 'audience' | 'grades'> & { section_ids?: string[] | null },
  sections: Section[] = [],
): string {
  if (announcement.audience === 'school') return 'Whole school';
  if (announcement.section_ids?.length) {
    const names = sections
      .filter((s) => announcement.section_ids!.includes(s.id))
      .map(sectionLabel);
    if (names.length) return `${names.length === 1 ? 'Section' : 'Sections'} ${names.join(', ')}`;
  }
  const grades = announcement.grades ?? [];
  return `${grades.length === 1 ? 'Grade' : 'Grades'} ${grades.join(', ')}`;
}

/** Who it's from: the "post as" name if given, otherwise the author. */
export function bylineOf(announcement: Announcement): string {
  return announcement.posted_as || announcement.author?.full_name || 'School';
}
