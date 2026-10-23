// Fix-it reports: raw Supabase calls. Rules are in
// supabase/migrations/20261019120900_fixit.sql. Two things to know:
//
// 1. Read reports through report_feed(), never the table. It's the only place
//    that hands out who reported something, and only to staff. (The table
//    doesn't let anyone read reporter_id at all.)
// 2. Photos live in the private `report-photos` bucket at
//    reports/<report id>/<file>. Students can't update a report, so after
//    uploading, attach_report_photo() records the path.
import { supabase } from '@/lib/supabase';
import type { Enums, TablesInsert, TablesUpdate } from '@/types/database';

export type ReportCategory = Enums<'report_category'>;
export type ReportStatus = Enums<'report_status'>;
export type Responsibility = Enums<'responsibility_kind'>;

export interface Report {
  id: string;
  /** Staff only; null for everyone else. */
  reporter_id: string | null;
  reporter_name: string | null;
  reported_by_me: boolean;
  room_id: string | null;
  room_code: string | null;
  room_name: string | null;
  floor_id: string | null;
  x: number | null;
  y: number | null;
  category: ReportCategory;
  /** Which team it went to (facilities or it), from report_category_routes. */
  routed_to: Responsibility;
  description: string;
  photo_path: string | null;
  status: ReportStatus;
  status_note: string | null;
  assigned_to: string | null;
  assigned_to_name: string | null;
  urgent: boolean;
  duplicate_of: string | null;
  resolved_at: string | null;
  created_at: string;
  vote_count: number;
  voted_by_me: boolean;
}

export const OPEN_STATUSES: ReportStatus[] = ['open', 'acknowledged', 'in_progress'];

/** Every report you may see, newest first (students: unresolved, plus their own). */
export async function fetchReports(): Promise<Report[]> {
  const { data, error } = await supabase.rpc('report_feed');
  if (error) throw error;
  return data;
}

/** Open reports, urgent first then oldest first (the admin queue and overview). */
export async function fetchOpenReports(limit?: number): Promise<Report[]> {
  let query = supabase
    .rpc('report_feed')
    .in('status', OPEN_STATUSES)
    .order('urgent', { ascending: false })
    .order('created_at');
  if (limit) query = query.limit(limit);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function fetchReport(id: string): Promise<Report | null> {
  const { data, error } = await supabase.rpc('report_feed').eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}

export interface RoomReport {
  id: string;
  category: ReportCategory;
  description: string;
  status: ReportStatus;
  urgent: boolean;
  created_at: string;
  vote_count: number;
  voted_by_me: boolean;
  reported_by_me: boolean;
}

/** The duplicate check: unresolved reports already open in a room. */
export async function fetchOpenReportsInRoom(roomId: string): Promise<RoomReport[]> {
  const { data, error } = await supabase.rpc('open_reports_in_room', { p_room_id: roomId });
  if (error) throw error;
  return data;
}

export type ReportInput = Pick<
  TablesInsert<'reports'>,
  'room_id' | 'category' | 'description' | 'urgent'
>;

/** Creates the report (the database notifies the right team), then attaches the photo. */
export async function createReport(input: ReportInput, photo: File | null): Promise<string> {
  const { data, error } = await supabase.from('reports').insert(input).select('id').single();
  if (error) throw error;
  if (photo) {
    const extension = photo.name.split('.').pop()?.toLowerCase() || 'jpg';
    const path = `reports/${data.id}/photo.${extension}`;
    const upload = await supabase.storage
      .from('report-photos')
      .upload(path, photo, { contentType: photo.type });
    if (upload.error) throw upload.error;
    const attach = await supabase.rpc('attach_report_photo', {
      p_report_id: data.id,
      p_path: path,
    });
    if (attach.error) throw attach.error;
  }
  return data.id;
}

/** A link to the photo that stops working after five minutes (the bucket is private). */
export async function photoUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from('report-photos').createSignedUrl(path, 300);
  if (error) throw error;
  return data.signedUrl;
}

/** "Me too": one vote per person (a unique constraint), removable. */
export async function addVote(reportId: string): Promise<void> {
  const { error } = await supabase.from('report_votes').insert({ report_id: reportId });
  if (error) throw error;
}

export async function removeVote(reportId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('report_votes')
    .delete()
    .eq('report_id', reportId)
    .eq('user_id', userId);
  if (error) throw error;
}

export type ReportChanges = Pick<
  TablesUpdate<'reports'>,
  'status' | 'status_note' | 'assigned_to' | 'duplicate_of' | 'urgent'
>;

/**
 * Staff updates. The database decides who may change what: any teacher can
 * mark urgent; only the responsible team (or admins) change status, assign
 * or mark duplicates. Each status change notifies the reporter and voters.
 */
export async function updateReport(id: string, changes: ReportChanges): Promise<void> {
  const { error } = await supabase.from('reports').update(changes).eq('id', id);
  if (error) throw error;
}

export interface CategoryRoute {
  id: string;
  category: ReportCategory;
  responsibility: Responsibility;
}

export async function fetchRoutes(): Promise<CategoryRoute[]> {
  const { data, error } = await supabase
    .from('report_category_routes')
    .select('id, category, responsibility')
    .order('category');
  if (error) throw error;
  return data;
}

/** Admin: send a category to a different team (audited). */
export async function updateRoute(id: string, responsibility: Responsibility): Promise<void> {
  const { error } = await supabase
    .from('report_category_routes')
    .update({ responsibility })
    .eq('id', id);
  if (error) throw error;
}

/** Calls onChange whenever a report you can see changes (Realtime). */
export function subscribeToReports(onChange: () => void): () => void {
  const channel = supabase
    .channel(`reports:${crypto.randomUUID()}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'reports' }, onChange)
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}
