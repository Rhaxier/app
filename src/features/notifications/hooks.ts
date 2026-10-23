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
import type { Notification } from './api';
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

/**
 * Marking one as read is optimistic: the dot and the badge update the moment
 * it's tapped. If the database refuses, both go back and a toast says so.
 */
export function useMarkRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: markRead,
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: notificationKeys.all });
      const list = queryClient.getQueryData<Notification[]>(notificationKeys.list());
      const unread = queryClient.getQueryData<number>(notificationKeys.unread());
      const wasUnread = list?.some((item) => item.id === id && !item.read_at) ?? true;
      queryClient.setQueryData<Notification[]>(notificationKeys.list(), (items) =>
        items?.map((item) =>
          item.id === id && !item.read_at ? { ...item, read_at: new Date().toISOString() } : item,
        ),
      );
      if (wasUnread && unread !== undefined) {
        queryClient.setQueryData(notificationKeys.unread(), Math.max(0, unread - 1));
      }
      return { list, unread };
    },
    onError: (_error, _id, context) => {
      queryClient.setQueryData(notificationKeys.list(), context?.list);
      queryClient.setQueryData(notificationKeys.unread(), context?.unread);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: notificationKeys.all }),
    meta: { errorToast: true },
  });
}

export function useMarkAllRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: markAllRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: notificationKeys.all }),
    meta: { successMessage: "You're all caught up", errorToast: true },
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
    meta: { errorToast: true },
  });
}
