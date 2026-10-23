// Admin screens: raw Supabase calls. Every table here is admin-only (RLS), and
// every change is written to the audit log by a database trigger or by the
// admin_* functions. Nothing on these screens can grant more than the
// database already allows an admin to do.
import { supabase } from '@/lib/supabase';
import type { Enums, Json, Tables, TablesInsert, TablesUpdate } from '@/types/database';

export type Role = Enums<'user_role'>;
export type Responsibility = Enums<'responsibility_kind'>;

// ---------------------------------------------------------------------------
// Overview (B1). Admin-only functions that count in the database; the browser
// only ever receives the totals.
// ---------------------------------------------------------------------------

export type AttentionKind =
  | 'events_to_approve'
  | 'venue_requests'
  | 'bookings_awaiting_teacher'
  | 'hours_to_confirm'
  | 'open_reports'
  | 'reported_content'
  | 'hidden_posts';

export interface AttentionRow {
  kind: AttentionKind;
  item_count: number;
  urgent_count: number;
  /** When the longest-waiting item started waiting; null when nothing is. */
  oldest_at: string | null;
}

export async function fetchAttention(): Promise<AttentionRow[]> {
  const { data, error } = await supabase.rpc('admin_attention');
  if (error) throw error;
  return data as AttentionRow[];
}

export interface Metrics {
  days: number;
  active_users: number;
  new_reports: number;
  resolved_reports: number;
  avg_days_to_resolve: number | null;
  bookings_requested: number;
  bookings_held: number;
  supw_hours_confirmed: number;
  collab_posts_created: number;
  collab_posts_filled: number;
}

/** Two rows: the last 7 days and the last 30 days. */
export async function fetchMetrics(): Promise<Metrics[]> {
  const { data, error } = await supabase.rpc('admin_metrics');
  if (error) throw error;
  return data as Metrics[];
}

export interface VenueUtilisation {
  venue_id: string;
  venue_name: string;
  booked_hours: number;
  bookable_hours: number;
  /** 0 to 1; null when the venue had no bookable time in the window. */
  utilisation: number | null;
}

export async function fetchVenueUtilisation(days: number): Promise<VenueUtilisation[]> {
  const { data, error } = await supabase.rpc('admin_venue_utilisation', { p_days: days });
  if (error) throw error;
  return data as VenueUtilisation[];
}

export interface SupwByGrade {
  grade: number | null;
  students: number;
  hours: number;
}

export async function fetchSupwByGrade(days: number): Promise<SupwByGrade[]> {
  const { data, error } = await supabase.rpc('admin_supw_by_grade', { p_days: days });
  if (error) throw error;
  return data as SupwByGrade[];
}

// ---------------------------------------------------------------------------
// Users, roles and responsibilities
// ---------------------------------------------------------------------------

export interface AdminUser {
  id: string;
  full_name: string;
  email: string;
  role: Role;
  grade: number | null;
  section: string | null;
  responsibilities: Responsibility[];
  /** Set while posting is paused (only future dates come back). */
  posting_suspended_until: string | null;
  suspension_reason: string | null;
  /** Set when the year-end rollover archived them (left the school). */
  archived_at: string | null;
  created_at: string;
}

export async function fetchUsers(): Promise<AdminUser[]> {
  const { data, error } = await supabase.rpc('admin_list_users');
  if (error) throw error;
  return data as AdminUser[];
}

/** Pause someone's posting until a date (audited). They see why in the app. */
export async function suspendPosting(userId: string, until: string, reason: string): Promise<void> {
  const { error } = await supabase.rpc('admin_suspend_posting', {
    p_user_id: userId,
    p_until: until,
    p_reason: reason,
  });
  if (error) throw error;
}

export async function liftSuspension(userId: string): Promise<void> {
  const { error } = await supabase.rpc('admin_lift_suspension', { p_user_id: userId });
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Bulk import (CSV) and year-end rollover
// ---------------------------------------------------------------------------

/** One person from the CSV file, as typed (the database checks everything). */
export interface ImportRow {
  name: string;
  email: string;
  role: string;
  grade: string;
  section: string;
}

export interface ImportResult {
  row_number: number;
  email: string;
  full_name: string;
  /** create = set up at first sign-in, update = account changed, error = not imported. */
  outcome: 'create' | 'update' | 'error';
  message: string;
}

/**
 * dryRun = true is the preview: every row checked, nothing saved. Then the
 * real import saves the good rows in one transaction and skips the bad ones.
 */
export async function importPeople(rows: ImportRow[], dryRun: boolean): Promise<ImportResult[]> {
  const { data, error } = await supabase.rpc('admin_import_people', {
    p_rows: rows as unknown as Json,
    p_dry_run: dryRun,
  });
  if (error) throw error;
  return data as ImportResult[];
}

export interface RolloverStep {
  from_grade: number;
  /** null = this grade leaves the school (archived). */
  to_grade: number | null;
  students: number;
}

export async function rollover(dryRun: boolean, confirm?: string): Promise<RolloverStep[]> {
  const { data, error } = await supabase.rpc('admin_rollover', {
    p_dry_run: dryRun,
    p_confirm: confirm as string,
  });
  if (error) throw error;
  return data as RolloverStep[];
}

/** The only way roles change. Refuses to remove the last admin; audited. */
export async function setRole(userId: string, role: Role): Promise<void> {
  const { error } = await supabase.rpc('admin_set_role', { p_user_id: userId, p_role: role });
  if (error) throw error;
}

export async function updateProfile(
  userId: string,
  fields: { fullName: string; grade: number | null; section: string },
): Promise<void> {
  const { error } = await supabase.rpc('admin_update_profile', {
    p_user_id: userId,
    p_full_name: fields.fullName,
    // The generated types mark these as non-null; null clears the grade.
    p_grade: fields.grade as number,
    p_section: fields.section,
  });
  if (error) throw error;
}

export async function addResponsibility(userId: string, kind: Responsibility): Promise<void> {
  const { error } = await supabase.from('responsibilities').insert({ user_id: userId, kind });
  if (error) throw error;
}

export async function removeResponsibility(userId: string, kind: Responsibility): Promise<void> {
  const { error } = await supabase
    .from('responsibilities')
    .delete()
    .eq('user_id', userId)
    .eq('kind', kind);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Staff email list (Q3)
// ---------------------------------------------------------------------------

export type StaffEmail = Pick<Tables<'staff_emails'>, 'id' | 'email' | 'created_at'>;

export async function fetchStaffEmails(): Promise<StaffEmail[]> {
  const { data, error } = await supabase
    .from('staff_emails')
    .select('id, email, created_at')
    .order('email');
  if (error) throw error;
  return data;
}

/** Also promotes an existing student account with that email (database trigger). */
export async function addStaffEmail(email: string): Promise<void> {
  const { error } = await supabase
    .from('staff_emails')
    .insert({ email: email.trim().toLowerCase() });
  if (error) throw error;
}

export async function removeStaffEmail(id: string): Promise<void> {
  const { error } = await supabase.from('staff_emails').delete().eq('id', id);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Settings (the single app_settings row)
// ---------------------------------------------------------------------------

export type SettingsChanges = Omit<
  TablesUpdate<'app_settings'>,
  'id' | 'created_at' | 'updated_at'
>;

export async function updateSettings(changes: SettingsChanges): Promise<void> {
  const { error } = await supabase.from('app_settings').update(changes).eq('id', true);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Venues
// ---------------------------------------------------------------------------

export type VenueFields = Pick<
  TablesInsert<'venues'>,
  | 'name'
  | 'room_id'
  | 'capacity'
  | 'needs_approval'
  | 'active'
  | 'bookable_from'
  | 'bookable_until'
  | 'max_booking_minutes'
  | 'max_days_ahead'
>;

export async function createVenue(fields: VenueFields): Promise<void> {
  const { error } = await supabase.from('venues').insert(fields);
  if (error) throw error;
}

export async function updateVenue(id: string, fields: VenueFields): Promise<void> {
  const { error } = await supabase.from('venues').update(fields).eq('id', id);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Moderation: reported content (staff read; teachers and admins resolve)
// ---------------------------------------------------------------------------

export interface ContentReport {
  id: string;
  target_table: string;
  target_id: string;
  reason: string;
  status: Enums<'content_report_status'>;
  created_at: string;
  reporter: { full_name: string } | null;
}

export async function fetchContentReports(): Promise<ContentReport[]> {
  const { data, error } = await supabase
    .from('content_reports')
    .select(
      'id, target_table, target_id, reason, status, created_at, reporter:profiles!content_reports_reporter_id_fkey(full_name)',
    )
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function setContentReportStatus(
  id: string,
  status: Enums<'content_report_status'>,
  reviewerId: string,
): Promise<void> {
  const { error } = await supabase
    .from('content_reports')
    .update({ status, reviewed_by: reviewerId })
    .eq('id', id);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Audit log and outboxes (read-only)
// ---------------------------------------------------------------------------

export type AuditEntry = Pick<
  Tables<'audit_log'>,
  'id' | 'actor_id' | 'action' | 'table_name' | 'row_id' | 'details' | 'created_at'
>;

export async function fetchAuditLog(tableName: string | null): Promise<AuditEntry[]> {
  let query = supabase
    .from('audit_log')
    .select('id, actor_id, action, table_name, row_id, details, created_at')
    .order('created_at', { ascending: false })
    .limit(200);
  if (tableName) query = query.eq('table_name', tableName);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export interface OutboxRow {
  id: string;
  kind: Enums<'outbox_kind'>;
  status: Enums<'outbox_status'>;
  payload: unknown;
  created_at: string;
  recipient: { full_name: string } | null;
}

/** What would be emailed or pushed (nothing is sent yet: Q7, Q8). */
export async function fetchOutbox(table: 'email_outbox' | 'push_outbox'): Promise<OutboxRow[]> {
  const { data, error } = await supabase
    .from(table)
    .select('id, kind, status, payload, created_at, recipient:profiles(full_name)')
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw error;
  return data;
}
