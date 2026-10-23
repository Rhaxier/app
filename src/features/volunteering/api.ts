// SUPW volunteering: raw Supabase calls. Same pattern as announcements/api.ts.
// Rules live in supabase/migrations/20261019120500_volunteering.sql: who sees
// which events, the one-role-per-event rule, the cap per role, who confirms
// hours. This file only reads and writes.
import { supabase } from '@/lib/supabase';
import type { Enums, Tables, TablesInsert, TablesUpdate } from '@/types/database';

// Two foreign keys point from volunteer_events to profiles (creator and
// approver), so `!volunteer_events_creator_id_fkey` says which one to follow.
const EVENT_COLUMNS = `
  id, creator_id, organiser_label, title, description, starts_at, ends_at, room_id, place_text,
  supw_hours, signup_deadline, allow_multiple_roles, status, approved_by, approval_note, created_at,
  category_id,
  creator:profiles!volunteer_events_creator_id_fkey(full_name),
  room:rooms(code, name),
  roles:event_roles(id, name, description, spots_wanted, created_at)
`;

export type EventStatus = Enums<'volunteer_event_status'>;
export type SignupStatus = Enums<'signup_status'>;

export interface EventRole {
  id: string;
  name: string;
  description: string;
  spots_wanted: number;
  /** How many students are selected, from volunteer_role_counts(). */
  selected_count: number;
  waitlisted_count: number;
}

export interface VolunteerEvent {
  id: string;
  creator_id: string;
  organiser_label: string | null;
  title: string;
  description: string;
  starts_at: string;
  ends_at: string;
  room_id: string | null;
  place_text: string | null;
  supw_hours: number;
  signup_deadline: string | null;
  allow_multiple_roles: boolean;
  status: EventStatus;
  approved_by: string | null;
  approval_note: string | null;
  created_at: string;
  /** Optional, from the admin's list (volunteer_categories). */
  category_id: string | null;
  creator: { full_name: string } | null;
  room: { code: string; name: string } | null;
  roles: EventRole[];
}

export interface MySignup {
  id: string;
  role_id: string;
  event_id: string;
  status: SignupStatus;
  note: string | null;
  attended: boolean | null;
  hours_confirmed: number | null;
}

type EventRow = Omit<VolunteerEvent, 'roles'> & {
  roles: {
    id: string;
    name: string;
    description: string;
    spots_wanted: number;
    created_at: string;
  }[];
};
type RoleCount = { role_id: string; selected_count: number; waitlisted_count: number };

// Rows from the table plus counts from volunteer_role_counts(): other people's
// sign-ups are private, but how many spots are taken is not.
function withCounts(row: EventRow, counts: RoleCount[]): VolunteerEvent {
  const roles = [...row.roles]
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .map((role) => {
      const count = counts.find((c) => c.role_id === role.id);
      return {
        id: role.id,
        name: role.name,
        description: role.description,
        spots_wanted: role.spots_wanted,
        selected_count: count?.selected_count ?? 0,
        waitlisted_count: count?.waitlisted_count ?? 0,
      };
    });
  return { ...row, roles };
}

async function fetchRoleCounts(eventId?: string): Promise<RoleCount[]> {
  let query = supabase
    .rpc('volunteer_role_counts')
    .select('role_id, selected_count, waitlisted_count');
  if (eventId) query = query.eq('event_id', eventId);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

/** Every event the signed-in person may see (RLS decides), soonest first. */
export async function fetchEvents(): Promise<VolunteerEvent[]> {
  const [events, counts] = await Promise.all([
    supabase.from('volunteer_events').select(EVENT_COLUMNS).order('starts_at'),
    fetchRoleCounts(),
  ]);
  if (events.error) throw events.error;
  return events.data.map((row) => withCounts(row, counts));
}

export async function fetchEvent(id: string): Promise<VolunteerEvent | null> {
  const [event, counts] = await Promise.all([
    supabase.from('volunteer_events').select(EVENT_COLUMNS).eq('id', id).maybeSingle(),
    fetchRoleCounts(id),
  ]);
  if (event.error) throw event.error;
  return event.data ? withCounts(event.data, counts) : null;
}

/** The signed-in student's own sign-ups (also used for "SUPW hours so far"). */
export async function fetchMySignups(userId: string): Promise<MySignup[]> {
  const { data, error } = await supabase
    .from('role_signups')
    .select('id, role_id, event_id, status, note, attended, hours_confirmed')
    .eq('student_id', userId);
  if (error) throw error;
  return data;
}

// ---------------------------------------------------------------------------
// Creating and editing events
// ---------------------------------------------------------------------------

export type EventInput = Pick<
  TablesInsert<'volunteer_events'>,
  | 'title'
  | 'organiser_label'
  | 'description'
  | 'starts_at'
  | 'ends_at'
  | 'room_id'
  | 'place_text'
  | 'supw_hours'
  | 'signup_deadline'
  | 'allow_multiple_roles'
  | 'category_id'
>;

export interface RoleInput {
  /** Present for roles that already exist (editing). */
  id?: string;
  name: string;
  description: string;
  spots_wanted: number;
}

export async function createEvent(input: EventInput, roles: RoleInput[]): Promise<string> {
  // The database sets the status: published for staff, awaiting_approval for students.
  const { data, error } = await supabase
    .from('volunteer_events')
    .insert(input)
    .select('id')
    .single();
  if (error) throw error;
  const { error: rolesError } = await supabase.from('event_roles').insert(
    roles.map(({ name, description, spots_wanted }) => ({
      event_id: data.id,
      name,
      description,
      spots_wanted,
    })),
  );
  if (rolesError) throw rolesError;
  return data.id;
}

/** Saves the event, then brings its roles in line with the form. */
export async function updateEvent(
  id: string,
  input: EventInput,
  roles: RoleInput[],
  removedRoleIds: string[],
): Promise<void> {
  const { error } = await supabase.from('volunteer_events').update(input).eq('id', id);
  if (error) throw error;

  for (const role of roles) {
    const fields = {
      name: role.name,
      description: role.description,
      spots_wanted: role.spots_wanted,
    };
    const result = role.id
      ? await supabase.from('event_roles').update(fields).eq('id', role.id)
      : await supabase.from('event_roles').insert({ ...fields, event_id: id });
    if (result.error) throw result.error;
  }
  if (removedRoleIds.length > 0) {
    const { error: deleteError } = await supabase
      .from('event_roles')
      .delete()
      .in('id', removedRoleIds);
    if (deleteError) throw deleteError;
  }
}

/** Approve, send back (with a note), resubmit, close or reopen. */
export async function setEventStatus(
  id: string,
  status: EventStatus,
  note?: string,
): Promise<void> {
  const changes: TablesUpdate<'volunteer_events'> = { status };
  if (note !== undefined) changes.approval_note = note;
  const { error } = await supabase.from('volunteer_events').update(changes).eq('id', id);
  if (error) throw error;
}

export async function deleteEvent(id: string): Promise<void> {
  const { error } = await supabase.from('volunteer_events').delete().eq('id', id);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Signing up (students)
// ---------------------------------------------------------------------------

export async function signUp(eventId: string, roleId: string, note: string): Promise<void> {
  // student_id comes from the session. event_id is required by the table's
  // types, but a trigger overwrites it with the role's real event anyway.
  const { error } = await supabase
    .from('role_signups')
    .insert({ event_id: eventId, role_id: roleId, note: note.trim() || null });
  if (error) throw error;
}

export async function setMySignupStatus(
  signupId: string,
  status: 'withdrawn' | 'applied',
): Promise<void> {
  const { error } = await supabase.from('role_signups').update({ status }).eq('id', signupId);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Organisers and teachers
// ---------------------------------------------------------------------------

export interface EventSignup {
  signup_id: string;
  role_id: string;
  role_name: string;
  student_id: string;
  full_name: string;
  grade: number | null;
  section: string | null;
  email: string;
  note: string | null;
  status: SignupStatus;
  attended: boolean | null;
  hours_confirmed: number | null;
  supw_hours_so_far: number;
}

/** Everyone who signed up, with contact email. Organiser and staff only. */
export async function fetchEventSignups(eventId: string): Promise<EventSignup[]> {
  const { data, error } = await supabase.rpc('event_signups', { p_event_id: eventId });
  if (error) throw error;
  return data;
}

export type SignupChanges = Pick<
  TablesUpdate<'role_signups'>,
  'status' | 'role_id' | 'attended' | 'hours_confirmed'
>;

/** Select, waitlist, move, mark attendance or confirm hours. */
export async function updateSignup(signupId: string, changes: SignupChanges): Promise<void> {
  const { error } = await supabase.from('role_signups').update(changes).eq('id', signupId);
  if (error) throw error;
}

export interface HoursToConfirm {
  signup_id: string;
  event_id: string;
  event_title: string;
  event_starts_at: string;
  role_name: string;
  student_id: string;
  full_name: string;
  grade: number | null;
  suggested_hours: number;
}

/** Attended sign-ups this teacher can confirm hours for (Approvals tab). */
export async function fetchHoursToConfirm(): Promise<HoursToConfirm[]> {
  const { data, error } = await supabase.rpc('hours_to_confirm');
  if (error) throw error;
  return data;
}

export interface SupwHoursRow {
  student_id: string;
  full_name: string;
  email: string;
  grade: number | null;
  section: string | null;
  events_attended: number;
  hours_confirmed: number;
}

/** Whole-school totals for the CSV export (admins and the SUPW coordinator). */
export async function fetchSupwHoursReport(): Promise<SupwHoursRow[]> {
  const { data, error } = await supabase.rpc('supw_hours_report');
  if (error) throw error;
  return data;
}

// ---------------------------------------------------------------------------
// Categories and SUPW targets (Admin > Features > Volunteering). Everyone
// reads them; only admins change them (RLS).
// ---------------------------------------------------------------------------

export type VolunteerCategory = Pick<
  Tables<'volunteer_categories'>,
  'id' | 'name' | 'active' | 'sort_order'
>;
export type SupwTarget = Pick<Tables<'supw_targets'>, 'id' | 'grade' | 'hours'>;

export async function fetchCategories(): Promise<VolunteerCategory[]> {
  const { data, error } = await supabase
    .from('volunteer_categories')
    .select('id, name, active, sort_order')
    .order('sort_order')
    .order('name');
  if (error) throw error;
  return data;
}

export async function saveCategory(
  id: string | null,
  fields: Omit<VolunteerCategory, 'id'>,
): Promise<void> {
  const { error } = id
    ? await supabase.from('volunteer_categories').update(fields).eq('id', id)
    : await supabase.from('volunteer_categories').insert(fields);
  if (error) throw error;
}

export async function fetchSupwTargets(): Promise<SupwTarget[]> {
  const { data, error } = await supabase
    .from('supw_targets')
    .select('id, grade, hours')
    .order('grade');
  if (error) throw error;
  return data;
}

/** Admin: set a grade's target (hours = null removes it). */
export async function setSupwTarget(grade: number, hours: number | null): Promise<void> {
  const { error } =
    hours === null
      ? await supabase.from('supw_targets').delete().eq('grade', grade)
      : await supabase.from('supw_targets').upsert({ grade, hours }, { onConflict: 'grade' });
  if (error) throw error;
}
