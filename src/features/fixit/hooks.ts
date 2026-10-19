// Fix-it reports: TanStack Query hooks. useLiveReports() keeps the map's pins
// current through Realtime.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import {
  addVote,
  createReport,
  fetchOpenReportsInRoom,
  fetchReport,
  fetchReports,
  fetchRoutes,
  photoUrl,
  removeVote,
  subscribeToReports,
  updateReport,
  updateRoute,
  type ReportChanges,
  type ReportInput,
  type Responsibility,
} from './api';

export const fixitKeys = {
  all: ['fixit'] as const,
  reports: () => [...fixitKeys.all, 'reports'] as const,
  report: (id: string) => [...fixitKeys.all, 'report', id] as const,
  inRoom: (roomId: string) => [...fixitKeys.all, 'room', roomId] as const,
  photo: (path: string) => [...fixitKeys.all, 'photo', path] as const,
  routes: () => [...fixitKeys.all, 'routes'] as const,
};

export function useReports() {
  return useQuery({ queryKey: fixitKeys.reports(), queryFn: fetchReports });
}

export function useReport(id: string) {
  return useQuery({ queryKey: fixitKeys.report(id), queryFn: () => fetchReport(id) });
}

export function useOpenReportsInRoom(roomId: string) {
  return useQuery({
    queryKey: fixitKeys.inRoom(roomId),
    queryFn: () => fetchOpenReportsInRoom(roomId),
    enabled: Boolean(roomId),
  });
}

/** Signed photo links last five minutes; refetch a little before that. */
export function usePhotoUrl(path: string | null) {
  return useQuery({
    queryKey: fixitKeys.photo(path ?? ''),
    queryFn: () => photoUrl(path!),
    enabled: Boolean(path),
    staleTime: 4 * 60_000,
  });
}

export function useRoutes() {
  return useQuery({ queryKey: fixitKeys.routes(), queryFn: fetchRoutes, staleTime: 10 * 60_000 });
}

export function useLiveReports() {
  const queryClient = useQueryClient();
  useEffect(
    () => subscribeToReports(() => queryClient.invalidateQueries({ queryKey: fixitKeys.all })),
    [queryClient],
  );
}

function useInvalidateFixit() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: fixitKeys.all });
}

export function useCreateReport() {
  const invalidate = useInvalidateFixit();
  return useMutation({
    mutationFn: ({ input, photo }: { input: ReportInput; photo: File | null }) =>
      createReport(input, photo),
    onSuccess: invalidate,
  });
}

export function useToggleVote(userId: string) {
  const invalidate = useInvalidateFixit();
  return useMutation({
    mutationFn: ({ reportId, voted }: { reportId: string; voted: boolean }) =>
      voted ? removeVote(reportId, userId) : addVote(reportId),
    onSuccess: invalidate,
  });
}

export function useUpdateReport(id: string) {
  const invalidate = useInvalidateFixit();
  return useMutation({
    mutationFn: (changes: ReportChanges) => updateReport(id, changes),
    onSuccess: invalidate,
  });
}

export function useUpdateRoute() {
  const invalidate = useInvalidateFixit();
  return useMutation({
    mutationFn: ({ id, responsibility }: { id: string; responsibility: Responsibility }) =>
      updateRoute(id, responsibility),
    onSuccess: invalidate,
  });
}
