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
