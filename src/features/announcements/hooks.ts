// =============================================================================
// Announcements: TanStack Query hooks (layer 4 of 5).
//
// Pages call these instead of api.ts. TanStack Query gives every screen:
//   * caching: going back to the feed shows it instantly, then refreshes;
//   * loading and error state (isPending, isError) without useState/useEffect;
//   * one shared copy of the data, so Home and the feed never disagree.
//
// Query keys name each piece of cached data. After a change (create, edit,
// delete) we "invalidate" the announcement keys so every screen refetches.
// =============================================================================
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { showToast } from '@/lib/toast';
import {
  createAnnouncement,
  deleteAnnouncement,
  fetchAnnouncement,
  fetchAnnouncements,
  setPinned,
  updateAnnouncement,
  type AnnouncementInput,
} from './api';

export const announcementKeys = {
  all: ['announcements'] as const,
  list: (limit?: number) => [...announcementKeys.all, 'list', limit ?? 'all'] as const,
  detail: (id: string) => [...announcementKeys.all, 'detail', id] as const,
};

/** The feed. Pass a limit for a short list (Home shows three). */
export function useAnnouncements(limit?: number) {
  return useQuery({
    queryKey: announcementKeys.list(limit),
    queryFn: () => fetchAnnouncements(limit),
  });
}

export function useAnnouncement(id: string) {
  return useQuery({
    queryKey: announcementKeys.detail(id),
    queryFn: () => fetchAnnouncement(id),
  });
}

export function useCreateAnnouncement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: AnnouncementInput) => createAnnouncement(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: announcementKeys.all }),
    meta: { successMessage: 'Announcement posted' },
  });
}

export function useUpdateAnnouncement(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: AnnouncementInput) => updateAnnouncement(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: announcementKeys.all }),
    meta: { successMessage: 'Announcement saved' },
  });
}

export function useDeleteAnnouncement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteAnnouncement(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: announcementKeys.all }),
    meta: { successMessage: 'Announcement deleted', errorToast: true },
  });
}

export function useSetPinned() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, pinned }: { id: string; pinned: boolean }) => setPinned(id, pinned),
    onSuccess: (_data, { pinned }) => {
      queryClient.invalidateQueries({ queryKey: announcementKeys.all });
      showToast(pinned ? 'Pinned' : 'Unpinned');
    },
    meta: { errorToast: true },
  });
}
