// Collab finder: TanStack Query hooks. Changes invalidate everything under
// ['collab'] (posts, counts, requests and teams are all connected).
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
  });
}

export function useUpdatePost(id: string) {
  const invalidate = useInvalidateCollab();
  return useMutation({
    mutationFn: (input: PostInput) => updatePost(id, input),
    onSuccess: invalidate,
  });
}

export function useSetPostClosed(id: string) {
  const invalidate = useInvalidateCollab();
  return useMutation({
    mutationFn: (closed: boolean) => setPostClosed(id, closed),
    onSuccess: invalidate,
  });
}

export function useDeletePost() {
  const invalidate = useInvalidateCollab();
  return useMutation({ mutationFn: deletePost, onSuccess: invalidate });
}

export function useRequestToJoin(postId: string) {
  const invalidate = useInvalidateCollab();
  return useMutation({
    mutationFn: (message: string) => requestToJoin(postId, message),
    onSuccess: invalidate,
  });
}

export function useSetRequestStatus() {
  const invalidate = useInvalidateCollab();
  return useMutation({
    mutationFn: ({
      requestId,
      status,
    }: {
      requestId: string;
      status: 'accepted' | 'declined' | 'withdrawn';
    }) => setRequestStatus(requestId, status),
    onSuccess: invalidate,
  });
}

export function useSetPostHidden(id: string) {
  const invalidate = useInvalidateCollab();
  return useMutation({
    mutationFn: ({ hiddenBy, reason }: { hiddenBy: string | null; reason: string | null }) =>
      setPostHidden(id, hiddenBy, reason),
    onSuccess: invalidate,
  });
}

export function useReportPost(id: string) {
  return useMutation({ mutationFn: (reason: string) => reportPost(id, reason) });
}
