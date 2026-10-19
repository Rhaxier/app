// Collab finder: raw Supabase calls. Rules are in
// supabase/migrations/20261019120700_collab.sql: one request per person per
// post, owners decide, the post fills and closes itself, requester emails are
// visible only to the owner and staff.
import { supabase } from '@/lib/supabase';
import type { Enums, TablesInsert } from '@/types/database';

// Three foreign keys point at profiles (owner, supervising teacher, the
// teacher who hid it), so each embed names the key it follows.
const POST_COLUMNS = `
  id, owner_id, title, description, skills, spots_wanted, status,
  supervising_teacher_id, hidden_by, hidden_reason, created_at,
  owner:profiles!collab_posts_owner_id_fkey(full_name, grade, avatar_initials),
  supervisor:profiles!collab_posts_supervising_teacher_id_fkey(full_name)
`;

export type CollabStatus = Enums<'collab_status'>;
export type RequestStatus = Enums<'join_request_status'>;

export interface CollabPost {
  id: string;
  owner_id: string;
  title: string;
  description: string;
  skills: string[];
  spots_wanted: number;
  status: CollabStatus;
  supervising_teacher_id: string | null;
  hidden_by: string | null;
  hidden_reason: string | null;
  created_at: string;
  owner: { full_name: string; grade: number | null; avatar_initials: string | null } | null;
  supervisor: { full_name: string } | null;
  /** From collab_post_counts(): other people's requests are private, the totals aren't. */
  accepted_count: number;
  pending_count: number;
}

export interface MyRequest {
  id: string;
  post_id: string;
  status: RequestStatus;
  message: string;
}

type PostRow = Omit<CollabPost, 'accepted_count' | 'pending_count'>;
type PostCount = { post_id: string; accepted_count: number; pending_count: number };

function withCounts(row: PostRow, counts: PostCount[]): CollabPost {
  const count = counts.find((c) => c.post_id === row.id);
  return {
    ...row,
    accepted_count: count?.accepted_count ?? 0,
    pending_count: count?.pending_count ?? 0,
  };
}

async function fetchCounts(postId?: string): Promise<PostCount[]> {
  let query = supabase.rpc('collab_post_counts').select('post_id, accepted_count, pending_count');
  if (postId) query = query.eq('post_id', postId);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

/** Posts you can see, newest first (hidden ones only for their owner and staff). */
export async function fetchPosts(): Promise<CollabPost[]> {
  const [posts, counts] = await Promise.all([
    supabase.from('collab_posts').select(POST_COLUMNS).order('created_at', { ascending: false }),
    fetchCounts(),
  ]);
  if (posts.error) throw posts.error;
  return posts.data.map((row) => withCounts(row, counts));
}

export async function fetchPost(id: string): Promise<CollabPost | null> {
  const [post, counts] = await Promise.all([
    supabase.from('collab_posts').select(POST_COLUMNS).eq('id', id).maybeSingle(),
    fetchCounts(id),
  ]);
  if (post.error) throw post.error;
  return post.data ? withCounts(post.data, counts) : null;
}

/** The signed-in person's own requests, to show "Requested" / "On the team". */
export async function fetchMyRequests(userId: string): Promise<MyRequest[]> {
  const { data, error } = await supabase
    .from('join_requests')
    .select('id, post_id, status, message')
    .eq('requester_id', userId);
  if (error) throw error;
  return data;
}

export type PostInput = Pick<
  TablesInsert<'collab_posts'>,
  'title' | 'description' | 'skills' | 'spots_wanted' | 'supervising_teacher_id'
>;

export async function createPost(input: PostInput): Promise<string> {
  const { data, error } = await supabase.from('collab_posts').insert(input).select('id').single();
  if (error) throw error;
  return data.id;
}

/** Raising spots_wanted reopens a full post (database trigger). */
export async function updatePost(id: string, input: PostInput): Promise<void> {
  const { error } = await supabase.from('collab_posts').update(input).eq('id', id);
  if (error) throw error;
}

export async function setPostClosed(id: string, closed: boolean): Promise<void> {
  // Reopening sends 'open'; the database turns it into 'full' if the team is full.
  const { error } = await supabase
    .from('collab_posts')
    .update({ status: closed ? 'closed' : 'open' })
    .eq('id', id);
  if (error) throw error;
}

export async function deletePost(id: string): Promise<void> {
  const { error } = await supabase.from('collab_posts').delete().eq('id', id);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Requests
// ---------------------------------------------------------------------------

export async function requestToJoin(postId: string, message: string): Promise<void> {
  const { error } = await supabase
    .from('join_requests')
    .insert({ post_id: postId, message: message.trim() });
  if (error) throw error;
}

export async function setRequestStatus(
  requestId: string,
  status: Extract<RequestStatus, 'accepted' | 'declined' | 'withdrawn'>,
): Promise<void> {
  const { error } = await supabase.from('join_requests').update({ status }).eq('id', requestId);
  if (error) throw error;
}

export interface PostRequest {
  request_id: string;
  requester_id: string;
  full_name: string;
  grade: number | null;
  section: string | null;
  email: string;
  message: string;
  status: RequestStatus;
  created_at: string;
}

/** Everyone who asked, with school emails. Owner and staff only. */
export async function fetchPostRequests(postId: string): Promise<PostRequest[]> {
  const { data, error } = await supabase.rpc('collab_requests', { p_post_id: postId });
  if (error) throw error;
  return data;
}

export interface TeamMember {
  user_id: string;
  full_name: string;
  grade: number | null;
  email: string;
  is_owner: boolean;
}

/** The owner and accepted members, with emails. The team and staff only. */
export async function fetchTeam(postId: string): Promise<TeamMember[]> {
  const { data, error } = await supabase.rpc('collab_team', { p_post_id: postId });
  if (error) throw error;
  return data;
}

// ---------------------------------------------------------------------------
// Moderation
// ---------------------------------------------------------------------------

/** Teachers hide a post while it's reviewed (hiddenBy = their id), or unhide it (null). */
export async function setPostHidden(
  id: string,
  hiddenBy: string | null,
  reason: string | null,
): Promise<void> {
  const { error } = await supabase
    .from('collab_posts')
    .update({ hidden_by: hiddenBy, hidden_reason: reason })
    .eq('id', id);
  if (error) throw error;
}

/** Anyone can report a post. Only staff can read reports. */
export async function reportPost(postId: string, reason: string): Promise<void> {
  const { error } = await supabase
    .from('content_reports')
    .insert({ target_table: 'collab_posts', target_id: postId, reason: reason.trim() });
  if (error) throw error;
}
