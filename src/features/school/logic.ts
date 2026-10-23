// The school's structure: plain functions (tested in school.test.ts).
import type { SchoolClass, Section } from './api';

/** "10A": how sections are written everywhere in the app. */
export function sectionLabel(section: Pick<Section, 'grade' | 'name'>): string {
  return `${section.grade}${section.name}`;
}

/**
 * What a teacher may announce to when "teachers post only to what they teach"
 * is on (mirrors teaches_audience() in the database):
 *   grades    grades they teach as a whole (a class with no section)
 *   sections  sections they teach, plus every section of those whole grades
 */
export function teachableAudience(
  teacherId: string,
  classes: Pick<SchoolClass, 'grade' | 'section_id' | 'archived_at' | 'teachers'>[],
  sections: Section[],
): { grades: number[]; sectionIds: string[] } {
  const mine = classes.filter(
    (c) => !c.archived_at && c.teachers.some((t) => t.teacher_id === teacherId),
  );
  const grades = [...new Set(mine.filter((c) => !c.section_id).map((c) => c.grade))].sort(
    (a, b) => a - b,
  );
  const sectionIds = sections
    .filter((s) => grades.includes(s.grade) || mine.some((c) => c.section_id === s.id))
    .map((s) => s.id);
  return { grades, sectionIds };
}
