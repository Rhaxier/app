// Projects with teachers: raw Supabase calls. Rules are in
// supabase/migrations/20261019120600_projects.sql: owners see their own,
// teachers see only projects shared with them, admins see all.
import { supabase } from '@/lib/supabase';
import type { Enums, TablesInsert } from '@/types/database';

const PROJECT_COLUMNS = `
  id, owner_id, title, subject, description, link_url, status, created_at, updated_at,
  owner:profiles(full_name, grade),
  shares:project_shares(teacher_id, teacher:profiles(full_name)),
  feedback:project_feedback(id, body, created_at, author:profiles(full_name, avatar_initials))
`;

export type ProjectStatus = Enums<'project_status'>;

export interface Feedback {
  id: string;
  body: string;
  created_at: string;
  author: { full_name: string; avatar_initials: string | null } | null;
}

export interface Project {
  id: string;
  owner_id: string;
  title: string;
  subject: string | null;
  description: string;
  link_url: string | null;
  status: ProjectStatus;
  created_at: string;
  updated_at: string;
  owner: { full_name: string; grade: number | null } | null;
  shares: { teacher_id: string; teacher: { full_name: string } | null }[];
  /** Newest first. */
  feedback: Feedback[];
}

export type ProjectInput = Pick<
  TablesInsert<'projects'>,
  'title' | 'subject' | 'description' | 'link_url'
>;

function newestFeedbackFirst(project: Project): Project {
  return {
    ...project,
    feedback: [...project.feedback].sort((a, b) => b.created_at.localeCompare(a.created_at)),
  };
}

/** Your projects, or for teachers the ones shared with you (RLS decides). */
export async function fetchProjects(): Promise<Project[]> {
  const { data, error } = await supabase
    .from('projects')
    .select(PROJECT_COLUMNS)
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return data.map(newestFeedbackFirst);
}

export async function fetchProject(id: string): Promise<Project | null> {
  const { data, error } = await supabase
    .from('projects')
    .select(PROJECT_COLUMNS)
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data ? newestFeedbackFirst(data) : null;
}

export async function createProject(input: ProjectInput): Promise<string> {
  const { data, error } = await supabase.from('projects').insert(input).select('id').single();
  if (error) throw error;
  return data.id;
}

export async function updateProject(id: string, input: ProjectInput): Promise<void> {
  const { error } = await supabase.from('projects').update(input).eq('id', id);
  if (error) throw error;
}

export async function setProjectStatus(id: string, status: ProjectStatus): Promise<void> {
  const { error } = await supabase.from('projects').update({ status }).eq('id', id);
  if (error) throw error;
}

export async function deleteProject(id: string): Promise<void> {
  const { error } = await supabase.from('projects').delete().eq('id', id);
  if (error) throw error;
}

/** Sharing notifies the teacher and moves a draft to "shared" (database trigger). */
export async function shareProject(projectId: string, teacherId: string): Promise<void> {
  const { error } = await supabase
    .from('project_shares')
    .insert({ project_id: projectId, teacher_id: teacherId });
  if (error) throw error;
}

export async function unshareProject(projectId: string, teacherId: string): Promise<void> {
  const { error } = await supabase
    .from('project_shares')
    .delete()
    .eq('project_id', projectId)
    .eq('teacher_id', teacherId);
  if (error) throw error;
}

/** Adding feedback notifies the owner and sets the status (database trigger). */
export async function addFeedback(projectId: string, body: string): Promise<void> {
  const { error } = await supabase
    .from('project_feedback')
    .insert({ project_id: projectId, body: body.trim() });
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Attachments: private bucket `project-files`, one folder per project.
// Storage policies in the migration let the owner upload and delete, and
// anyone who can read the project download.
// ---------------------------------------------------------------------------
const BUCKET = 'project-files';

export interface Attachment {
  name: string;
  path: string;
  size: number | null;
}

export async function fetchAttachments(projectId: string): Promise<Attachment[]> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .list(projectId, { sortBy: { column: 'name', order: 'asc' } });
  if (error) throw error;
  return data
    .filter((file) => file.id) // folders have no id
    .map((file) => ({
      name: file.name,
      path: `${projectId}/${file.name}`,
      size: (file.metadata as { size?: number } | null)?.size ?? null,
    }));
}

export async function uploadAttachment(projectId: string, file: File): Promise<void> {
  // Keep names simple: storage paths can't contain every character.
  const safeName = file.name.replace(/[^\w.-]+/g, '_');
  const { error } = await supabase.storage.from(BUCKET).upload(`${projectId}/${safeName}`, file);
  if (error) throw error;
}

/** A download link that stops working after a minute, since the bucket is private. */
export async function attachmentUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60);
  if (error) throw error;
  return data.signedUrl;
}

export async function deleteAttachment(path: string): Promise<void> {
  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) throw error;
}
