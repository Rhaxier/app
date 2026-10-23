// Collab finder: TanStack Query hooks. Changes invalidate everything under
// ['collab'] (posts, counts, requests and teams are all connected).
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { showToast } from '@/lib/toast';
import {
  createPost,
  deletePost,
  fetchMyRequests,
  fetchPost,
  fetchPostRequests,
  fetchPosts,
  fetchTeam,
  reportPost,
  requestToJoin,
  setPostClosed,
  setPostHidden,
  setRequestStatus,
  updatePost,
  type PostInput,
} from './api';
import { withRequestStatus } from './logic';

export const collabKeys = {
  all: ['collab'] as const,
  posts: () => [...collabKeys.all, 'posts'] as const,
  post: (id: string) => [...collabKeys.all, 'post', id] as const,
  myRequests: (userId: string) => [...collabKeys.all, 'my-requests', userId] as const,
  requests: (postId: string) => [...collabKeys.all, 'requests', postId] as const,
  team: (postId: string) => [...collabKeys.all, 'team', postId] as const,
};

export function usePosts() {
  return useQuery({ queryKey: collabKeys.posts(), queryFn: fetchPosts });
}

export function usePost(id: string) {
  return useQuery({ queryKey: collabKeys.post(id), queryFn: () => fetchPost(id) });
}

export function useMyRequests(userId: string) {
  return useQuery({
    queryKey: collabKeys.myRequests(userId),
    queryFn: () => fetchMyRequests(userId),
  });
}

export function usePostRequests(postId: string, enabled: boolean) {
  return useQuery({
    queryKey: collabKeys.requests(postId),
    queryFn: () => fetchPostRequests(postId),
    enabled,
  });
}

export function useTeam(postId: string, enabled: boolean) {
  return useQuery({ queryKey: collabKeys.team(postId), queryFn: () => fetchTeam(postId), enabled });
}

function useInvalidateCollab() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: collabKeys.all });
}

export function useCreatePost() {
  const invalidate = useInvalidateCollab();
  return useMutation({
    mutationFn: (input: PostInput) => createPost(input),
    onSuccess: invalidate,
    meta: { successMessage: 'Post published' },
  });
}

export function useUpdatePost(id: string) {
  const invalidate = useInvalidateCollab();
  return useMutation({
    mutationFn: (input: PostInput) => updatePost(id, input),
    onSuccess: invalidate,
    meta: { successMessage: 'Post saved' },
  });
}

export function useSetPostClosed(id: string) {
  const invalidate = useInvalidateCollab();
  return useMutation({
    mutationFn: (closed: boolean) => setPostClosed(id, closed),
    onSuccess: (_data, closed) => {
      invalidate();
      showToast(closed ? 'Post closed' : 'Post reopened');
    },
    meta: { errorToast: true },
  });
}

export function useDeletePost() {
  const invalidate = useInvalidateCollab();
  return useMutation({
    mutationFn: deletePost,
    onSuccess: invalidate,
    meta: { successMessage: 'Post deleted', errorToast: true },
  });
}

export function useRequestToJoin(postId: string) {
  const invalidate = useInvalidateCollab();
  return useMutation({
    mutationFn: (message: string) => requestToJoin(postId, message),
    onSuccess: invalidate,
    meta: { successMessage: 'Request sent' },
  });
}

type RequestDecision = 'accepted' | 'declined' | 'withdrawn';

/**
 * Accept, decline or withdraw, optimistically: the request's badge changes
 * straight away. If the database refuses (say the team just filled up), every
 * cached copy goes back and a toast explains why.
 */
export function useSetRequestStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ requestId, status }: { requestId: string; status: RequestDecision }) =>
      setRequestStatus(requestId, status),
    onMutate: async ({ requestId, status }) => {
      await queryClient.cancelQueries({ queryKey: collabKeys.all });
      const before = queryClient.getQueriesData({ queryKey: collabKeys.all });
      queryClient.setQueriesData({ queryKey: collabKeys.all }, (data: unknown) =>
        withRequestStatus(data, requestId, status),
      );
      return { before };
    },
    onError: (_error, _variables, context) => {
      for (const [key, data] of context?.before ?? []) queryClient.setQueryData(key, data);
    },
    onSuccess: (_data, { status }) => showToast(requestStatusToast[status]),
    onSettled: () => queryClient.invalidateQueries({ queryKey: collabKeys.all }),
    meta: { errorToast: true },
  });
}

const requestStatusToast: Record<RequestDecision, string> = {
  accepted: 'Added to the team',
  declined: 'Request declined',
  withdrawn: 'Request withdrawn',
};

export function useSetPostHidden(id: string) {
  const invalidate = useInvalidateCollab();
  return useMutation({
    mutationFn: ({ hiddenBy, reason }: { hiddenBy: string | null; reason: string | null }) =>
      setPostHidden(id, hiddenBy, reason),
    onSuccess: (_data, { hiddenBy }) => {
      invalidate();
      showToast(hiddenBy ? 'Post hidden while it is reviewed' : 'Post visible again');
    },
    meta: { errorToast: true },
  });
}

export function useReportPost(id: string) {
  return useMutation({
    mutationFn: (reason: string) => reportPost(id, reason),
    meta: { successMessage: 'Thanks. Staff will review it.' },
  });
}
