// Venue booking: TanStack Query hooks. useLiveBookings() keeps any screen
// showing bookings up to date through Realtime.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { showToast } from '@/lib/toast';
import { useEffect } from 'react';
import {
  decideBooking,
  fetchApprovedBookings,
  fetchMyBookings,
  fetchPendingForReview,
  fetchToSupervise,
  fetchVenues,
  fetchWaitingRequests,
  requestBooking,
  subscribeToBookings,
  type BookingInput,
} from './api';

export const venueKeys = {
  all: ['venues'] as const,
  venues: () => [...venueKeys.all, 'list'] as const,
  approved: (from: string, to: string, venueId?: string) =>
    [...venueKeys.all, 'approved', from, to, venueId ?? 'all'] as const,
  waiting: (venueId: string, from: string, to: string) =>
    [...venueKeys.all, 'waiting', venueId, from, to] as const,
  mine: (userId: string) => [...venueKeys.all, 'mine', userId] as const,
  toSupervise: (userId: string) => [...venueKeys.all, 'supervise', userId] as const,
  forReview: () => [...venueKeys.all, 'review'] as const,
  now: () => [...venueKeys.all, 'now'] as const,
};

export function useVenues() {
  return useQuery({ queryKey: venueKeys.venues(), queryFn: fetchVenues, staleTime: 10 * 60_000 });
}

export function useApprovedBookings(from: string, to: string, venueId?: string) {
  return useQuery({
    queryKey: venueKeys.approved(from, to, venueId),
    queryFn: () => fetchApprovedBookings(from, to, venueId),
  });
}

/** Approved bookings happening right now, checked every minute (map "in use"). */
export function useBookingsNow() {
  return useQuery({
    queryKey: venueKeys.now(),
    queryFn: () => {
      const now = new Date();
      return fetchApprovedBookings(
        now.toISOString(),
        new Date(now.getTime() + 60_000).toISOString(),
      );
    },
    refetchInterval: 60_000,
  });
}

export function useWaitingRequests(venueId: string | undefined, from: string, to: string) {
  return useQuery({
    queryKey: venueKeys.waiting(venueId ?? '', from, to),
    queryFn: () => fetchWaitingRequests(venueId!, from, to),
    enabled: Boolean(venueId),
  });
}

export function useMyBookings(userId: string) {
  return useQuery({ queryKey: venueKeys.mine(userId), queryFn: () => fetchMyBookings(userId) });
}

export function useToSupervise(userId: string, enabled = true) {
  return useQuery({
    queryKey: venueKeys.toSupervise(userId),
    queryFn: () => fetchToSupervise(userId),
    enabled,
  });
}

export function usePendingForReview(enabled: boolean) {
  return useQuery({ queryKey: venueKeys.forReview(), queryFn: fetchPendingForReview, enabled });
}

/** Refetch booking data whenever a booking changes anywhere (Realtime). */
export function useLiveBookings() {
  const queryClient = useQueryClient();
  useEffect(
    () => subscribeToBookings(() => queryClient.invalidateQueries({ queryKey: venueKeys.all })),
    [queryClient],
  );
}

function useInvalidateVenues() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: venueKeys.all });
}

export function useRequestBooking() {
  const invalidate = useInvalidateVenues();
  return useMutation({
    mutationFn: (input: BookingInput) => requestBooking(input),
    onSuccess: invalidate,
    meta: { successMessage: 'Booking requested' },
  });
}

export function useDecideBooking() {
  const invalidate = useInvalidateVenues();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      status,
      note,
      announce,
    }: {
      id: string;
      status: 'pending' | 'approved' | 'rejected' | 'cancelled';
      note?: string;
      announce?: boolean;
    }) => decideBooking(id, status, { note, announce }),
    onSuccess: (_data, { status }) => {
      invalidate();
      // "Announce this" posts to the feed.
      queryClient.invalidateQueries({ queryKey: ['announcements'] });
      showToast(bookingDecisionToast[status]);
    },
    meta: { errorToast: true },
  });
}

const bookingDecisionToast: Record<'pending' | 'approved' | 'rejected' | 'cancelled', string> = {
  pending: 'Confirmed. Venue staff will decide next.',
  approved: 'Booking approved',
  rejected: 'Booking not approved',
  cancelled: 'Booking cancelled',
};
