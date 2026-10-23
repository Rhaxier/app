// The school's structure: grades, sections and classes. Everyone signed in
// reads grades, sections and classes (pickers, announcement audiences); only
// admins change them (RLS in supabase/migrations/20261023120100_people_and_grades.sql).
// Class lists (who is in a class) are private to the student, the class's
// teachers and admins.
import { supabase } from '@/lib/supabase';
import type { Tables } from '@/types/database';

export type Grade = Pick<Tables<'grades'>, 'id' | 'grade' | 'name' | 'active'>;
export type Section = Pick<Tables<'sections'>, 'id' | 'grade' | 'name'>;

export interface SchoolClass {
  id: string;
  name: string;
  subject: string | null;
  grade: number;
  section_id: string | null;
  archived_at: string | null;
  teachers: { teacher_id: string; teacher: { full_name: string } | null }[];
  /** Only filled in for admins and the class's teachers (RLS). */
  students: { student_id: string }[];
}

export async function fetchGrades(): Promise<Grade[]> {
  const { data, error } = await supabase
    .from('grades')
    .select('id, grade, name, active')
    .order('grade');
  if (error) throw error;
  return data;
}

export async function fetchSections(): Promise<Section[]> {
  const { data, error } = await supabase
    .from('sections')
    .select('id, grade, name')
    .order('grade')
    .order('name');
  if (error) throw error;
  return data;
}

export async function fetchClasses(): Promise<SchoolClass[]> {
  const { data, error } = await supabase
    .from('classes')
    .select(
      'id, name, subject, grade, section_id, archived_at, teachers:class_teachers(teacher_id, teacher:profiles(full_name)), students:class_students(student_id)',
    )
    .order('grade')
    .order('name');
  if (error) throw error;
  return data;
}

// ---------------------------------------------------------------------------
// Admin changes (audited by database triggers)
// ---------------------------------------------------------------------------

export async function saveGrade(
  id: string | null,
  fields: { grade: number; name: string; active: boolean },
): Promise<void> {
  const { error } = id
    ? await supabase.from('grades').update(fields).eq('id', id)
    : await supabase.from('grades').insert(fields);
  if (error) throw error;
}

export async function addSection(grade: number, name: string): Promise<void> {
  const { error } = await supabase
    .from('sections')
    .insert({ grade, name: name.trim().toUpperCase() });
  if (error) throw error;
}

export async function deleteSection(id: string): Promise<void> {
  const { error } = await supabase.from('sections').delete().eq('id', id);
  if (error) throw error;
}

export interface ClassInput {
  id: string | null;
  name: string;
  subject: string;
  grade: number;
  sectionId: string | null;
  teacherIds: string[];
  studentIds: string[];
}

/** The class and both member lists in one transaction (admin_save_class). */
export async function saveClass(input: ClassInput): Promise<void> {
  const { error } = await supabase.rpc('admin_save_class', {
    // The generated types mark these as non-null; null means "a new class" / "whole grade".
    p_id: input.id as string,
    p_name: input.name,
    p_subject: input.subject,
    p_grade: input.grade,
    p_section_id: input.sectionId as string,
    p_teacher_ids: input.teacherIds,
    p_student_ids: input.studentIds,
  });
  if (error) throw error;
}

/** Archived classes keep their history but stop counting for "teaches". */
export async function setClassArchived(id: string, archived: boolean): Promise<void> {
  const { error } = await supabase
    .from('classes')
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq('id', id);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// The school calendar (B3): periods, terms, holidays and venue blackouts.
// Everyone reads them (booking and volunteering screens); admins change them.
// Dates are plain calendar days in Dubai ('2026-10-25'); times are wall-clock
// times ('07:30:00').
// ---------------------------------------------------------------------------

export type Period = Pick<
  Tables<'periods'>,
  'id' | 'name' | 'starts_at' | 'ends_at' | 'sort_order' | 'weekdays'
>;
export type Term = Pick<Tables<'terms'>, 'id' | 'name' | 'starts_on' | 'ends_on'>;
export type Holiday = Pick<Tables<'holidays'>, 'id' | 'name' | 'starts_on' | 'ends_on'>;
export type Blackout = Pick<
  Tables<'venue_blackouts'>,
  'id' | 'venue_id' | 'starts_on' | 'ends_on' | 'reason'
>;

export async function fetchPeriods(): Promise<Period[]> {
  const { data, error } = await supabase
    .from('periods')
    .select('id, name, starts_at, ends_at, sort_order, weekdays')
    .order('starts_at')
    .order('sort_order');
  if (error) throw error;
  return data;
}

export async function fetchTerms(): Promise<Term[]> {
  const { data, error } = await supabase
    .from('terms')
    .select('id, name, starts_on, ends_on')
    .order('starts_on');
  if (error) throw error;
  return data;
}

export async function fetchHolidays(): Promise<Holiday[]> {
  const { data, error } = await supabase
    .from('holidays')
    .select('id, name, starts_on, ends_on')
    .order('starts_on');
  if (error) throw error;
  return data;
}

export async function fetchBlackouts(): Promise<Blackout[]> {
  const { data, error } = await supabase
    .from('venue_blackouts')
    .select('id, venue_id, starts_on, ends_on, reason')
    .order('starts_on');
  if (error) throw error;
  return data;
}

/** The four calendar tables, for the admin create / edit / delete calls below. */
export type CalendarTable = 'periods' | 'terms' | 'holidays' | 'venue_blackouts';

export type CalendarFields = {
  periods: Omit<Period, 'id'>;
  terms: Omit<Term, 'id'>;
  holidays: Omit<Holiday, 'id'>;
  venue_blackouts: Omit<Blackout, 'id'>;
};

/** Admin: add a row (id null) or change one. Audited by a database trigger. */
export async function saveCalendarRow<T extends CalendarTable>(
  table: T,
  id: string | null,
  fields: CalendarFields[T],
): Promise<void> {
  // One function for four tables: the cast tells TypeScript that `fields`
  // matches `table`, which the CalendarFields type above guarantees.
  const rows = supabase.from(table as 'terms');
  const { error } = id
    ? await rows.update(fields as CalendarFields['terms']).eq('id', id)
    : await rows.insert(fields as CalendarFields['terms']);
  if (error) throw error;
}

export async function deleteCalendarRow(table: CalendarTable, id: string): Promise<void> {
  const { error } = await supabase.from(table).delete().eq('id', id);
  if (error) throw error;
}
