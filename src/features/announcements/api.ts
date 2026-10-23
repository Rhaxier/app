// =============================================================================
// Announcements: the raw Supabase calls (layer 3 of 5; see
// docs/features/announcements.md for the reading order).
//
// This file is the ONLY place the announcements feature talks to Supabase.
// Why keep it separate?
//   * Pages stay about layout and stay readable.
//   * If a query changes (a new column, a different order), there's one place
//     to change it.
//   * hooks.ts wraps these functions with caching; tests can replace them.
//
// Notice what is NOT here: no permission checks. The database's RLS policies
// decide who can read, post, edit and delete (see
// supabase/migrations/20261019120400_announcements.sql). If someone isn't
// allowed, Supabase returns an error and we pass it on.
// =============================================================================
import { supabase } from '@/lib/supabase';
import type { Enums, TablesInsert } from '@/types/database';

// The columns we ask for, written once and reused. `author:profiles!…(full_name)`
// follows the author_id foreign key and fetches the author's name in the same
// request ("embedding"). Two columns point at profiles (author_id and
// removed_by), so `!announcements_author_id_fkey` says which one to follow.
// Only columns the signed-in role may read can be embedded, which is why we
// never ask for the author's email.
const ANNOUNCEMENT_COLUMNS =
  'id, title, body, posted_as, audience, grades, section_ids, pinned, urgent, publish_at, expires_at, author_id, author:profiles!announcements_author_id_fkey(full_name)';

// What a screen gets back. Written by hand (rather than inferred) so it's easy
// to read; the generated Database types check that it matches the query.
export interface Announcement {
  id: string;
  title: string;
  body: string;
  posted_as: string | null;
  audience: Enums<'announcement_audience'>;
  grades: number[] | null;
  /** Only these sections of those grades; null = the whole grades. */
  section_ids: string[] | null;
  pinned: boolean;
  /** An emergency broadcast (Admin > Notifications). Shown in orange. */
  urgent: boolean;
  /** When it appears. In the future = scheduled (only its author and admins see it). */
  publish_at: string;
  /** When it disappears; null = it stays. */
  expires_at: string | null;
  author_id: string;
  author: { full_name: string } | null;
}

// What the form sends. Pick<> keeps it in step with the real table columns.
export type AnnouncementInput = Pick<
  TablesInsert<'announcements'>,
  | 'title'
  | 'body'
  | 'posted_as'
  | 'audience'
  | 'grades'
  | 'section_ids'
  | 'pinned'
  | 'publish_at'
  | 'expires_at'
>;

/**
 * Announcements the signed-in person may see, pinned first, then newest.
 * There's no "where my grade" filter here: RLS already removes what isn't
 * meant for them. `limit` is for Home, which shows only a few.
 */
export async function fetchAnnouncements(limit?: number): Promise<Announcement[]> {
  let query = supabase
    .from('announcements')
    .select(ANNOUNCEMENT_COLUMNS)
    .order('pinned', { ascending: false })
    .order('publish_at', { ascending: false });
  if (limit) query = query.limit(limit);

  const { data, error } = await query;
  // Supabase never throws: it returns { data, error }. We throw so TanStack
  // Query can show the error state.
  if (error) throw error;
  return data;
}

export async function fetchAnnouncement(id: string): Promise<Announcement | null> {
  const { data, error } = await supabase
    .from('announcements')
    .select(ANNOUNCEMENT_COLUMNS)
    .eq('id', id)
    // maybeSingle: zero rows is "not found or not allowed", not an error.
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function createAnnouncement(input: AnnouncementInput): Promise<string> {
  // No author_id: the database fills it in from the session (default
  // auth.uid()), and the insert policy checks it.
  const { data, error } = await supabase.from('announcements').insert(input).select('id').single();
  if (error) throw error;
  return data.id;
}

export async function updateAnnouncement(id: string, input: AnnouncementInput): Promise<void> {
  const { error } = await supabase.from('announcements').update(input).eq('id', id);
  if (error) throw error;
}

export async function deleteAnnouncement(id: string): Promise<void> {
  const { error } = await supabase.from('announcements').delete().eq('id', id);
  if (error) throw error;
}

/** Admin: pin to the top of everyone's feed, or unpin (the database checks it's an admin). */
export async function setPinned(id: string, pinned: boolean): Promise<void> {
  const { error } = await supabase.from('announcements').update({ pinned }).eq('id', id);
  if (error) throw error;
}
