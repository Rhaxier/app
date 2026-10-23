// Collab finder: plain functions for the screens (tested in collab.test.tsx).
import type { CollabPost, MyRequest, PostInput, RequestStatus } from './api';

/** "2 of 3 spots filled" (plan: "The card shows progress"). */
export function filledLabel(post: Pick<CollabPost, 'accepted_count' | 'spots_wanted'>): string {
  const filled = Math.min(post.accepted_count, post.spots_wanted);
  return `${filled} of ${post.spots_wanted} ${post.spots_wanted === 1 ? 'spot' : 'spots'} filled`;
}

export function spotsLeft(post: Pick<CollabPost, 'accepted_count' | 'spots_wanted'>): number {
  return Math.max(0, post.spots_wanted - post.accepted_count);
}

/** Every skill mentioned on any post, for the filter chips. */
export function allSkills(posts: Pick<CollabPost, 'skills'>[]): string[] {
  const seen = new Map<string, string>(); // lower-case → first spelling seen
  for (const post of posts) {
    for (const skill of post.skills) {
      const key = skill.trim().toLowerCase();
      if (key && !seen.has(key)) seen.set(key, skill.trim());
    }
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b));
}

export function filterBySkill<T extends Pick<CollabPost, 'skills'>>(
  posts: T[],
  skill: string | null,
): T[] {
  if (!skill) return posts;
  const wanted = skill.toLowerCase();
  return posts.filter((post) => post.skills.some((s) => s.toLowerCase() === wanted));
}

export type JoinState =
  'own' | 'can_ask' | 'requested' | 'on_team' | 'declined' | 'full' | 'closed';

/** What the signed-in person can do about a post. */
export function joinState(
  post: Pick<CollabPost, 'owner_id' | 'status'>,
  myRequest: MyRequest | undefined,
  userId: string,
): JoinState {
  if (post.owner_id === userId) return 'own';
  if (myRequest?.status === 'accepted') return 'on_team';
  if (myRequest?.status === 'pending') return 'requested';
  if (myRequest?.status === 'declined') return 'declined';
  // A withdrawn request still occupies the one-request-per-post slot.
  if (myRequest?.status === 'withdrawn') return 'closed';
  if (post.status === 'full') return 'full';
  if (post.status === 'closed') return 'closed';
  return 'can_ask';
}

/** "CAD, Soldering ,  , 3D printing" → ["CAD", "Soldering", "3D printing"] */
export function parseSkills(text: string): string[] {
  const unique = new Map<string, string>();
  for (const part of text.split(',')) {
    const skill = part.trim();
    if (skill && !unique.has(skill.toLowerCase())) unique.set(skill.toLowerCase(), skill);
  }
  return [...unique.values()];
}

export interface CollabFormValues {
  title: string;
  description: string;
  skills: string; // comma separated
  spotsWanted: string;
  supervisingTeacherId: string;
}

export type CollabFormErrors = Partial<Record<keyof CollabFormValues, string>>;

export const emptyCollabValues: CollabFormValues = {
  title: '',
  description: '',
  skills: '',
  spotsWanted: '2',
  supervisingTeacherId: '',
};

export function validateCollab(
  values: CollabFormValues,
  teacherRequired: boolean,
  acceptedCount = 0,
): CollabFormErrors {
  const errors: CollabFormErrors = {};
  if (!values.title.trim()) errors.title = 'Add a title.';
  else if (values.title.trim().length > 120) errors.title = 'Keep the title under 120 characters.';
  if (parseSkills(values.skills).length === 0) errors.skills = 'List at least one skill you need.';
  const spots = Number(values.spotsWanted);
  if (!Number.isInteger(spots) || spots < 1 || spots > 50)
    errors.spotsWanted = 'Between 1 and 50 people.';
  else if (spots < acceptedCount)
    errors.spotsWanted = `${acceptedCount} people are already on the team.`;
  if (teacherRequired && !values.supervisingTeacherId)
    errors.supervisingTeacherId = 'Choose a supervising teacher.';
  return errors;
}

export function valuesFromPost(post: CollabPost): CollabFormValues {
  return {
    title: post.title,
    description: post.description,
    skills: post.skills.join(', '),
    spotsWanted: String(post.spots_wanted),
    supervisingTeacherId: post.supervising_teacher_id ?? '',
  };
}

export function toPostInput(values: CollabFormValues): PostInput {
  return {
    title: values.title.trim(),
    description: values.description.trim(),
    skills: parseSkills(values.skills),
    spots_wanted: Number(values.spotsWanted),
    supervising_teacher_id: values.supervisingTeacherId || null,
  };
}

/**
 * A copy of cached collab data with one join request's status changed, for the
 * optimistic update in useSetRequestStatus. The owner's list calls it
 * `request_id`, the requester's own list `id`; anything else is returned untouched.
 */
export function withRequestStatus<T>(data: T, requestId: string, status: RequestStatus): T {
  const change = (item: unknown) => {
    if (typeof item !== 'object' || item === null || !('status' in item)) return item;
    const id =
      'request_id' in item ? item.request_id : 'post_id' in item && 'id' in item ? item.id : null;
    return id === requestId ? { ...item, status } : item;
  };
  return (Array.isArray(data) ? data.map(change) : data) as T;
}
