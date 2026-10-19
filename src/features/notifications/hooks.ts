// TanStack Query hooks for notifications. After any change we "invalidate"
// the notification queries, which makes every screen showing them refetch.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import {
  fetchMutedTypes,
  fetchNotifications,
  fetchUnreadCount,
  markAllRead,
  markRead,
  setMuted,
  subscribeToNotifications,
} from './api';
import type { NotificationType } from './types';

export const notificationKeys = {
  all: ['notifications'] as const,
  list: () => [...notificationKeys.all, 'list'] as const,
  unread: () => [...notificationKeys.all, 'unread'] as const,
  muted: () => [...notificationKeys.all, 'muted'] as const,
};

export function useNotifications() {
  return useQuery({ queryKey: notificationKeys.list(), queryFn: fetchNotifications });
}

export function useUnreadCount() {
  return useQuery({ queryKey: notificationKeys.unread(), queryFn: fetchUnreadCount });
}

/** Keeps the badge and inbox live. Call once, in the app layout. */
export function useLiveNotifications(userId: string) {
  const queryClient = useQueryClient();
  useEffect(
    () =>
      subscribeToNotifications(userId, () => {
        queryClient.invalidateQueries({ queryKey: notificationKeys.all });
      }),
    [userId, queryClient],
  );
}

export function useMarkRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: markRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: notificationKeys.all }),
  });
}

export function useMarkAllRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: markAllRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: notificationKeys.all }),
  });
}

export function useMutedTypes() {
  return useQuery({ queryKey: notificationKeys.muted(), queryFn: fetchMutedTypes });
}

export function useSetMuted() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ type, muted }: { type: NotificationType; muted: boolean }) =>
      setMuted(type, muted),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: notificationKeys.muted() }),
  });
}
