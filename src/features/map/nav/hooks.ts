// Indoor navigation hooks (TanStack Query). Screens call these, never api.ts.
//
// Why the caching looks like this:
//   * The geometry is a large bundled file that never changes while the app
//     runs: loaded once with a lazy import (so it is only downloaded on map
//     screens) and cached forever.
//   * Stairs, lifts, flags and room names change rarely but must show up at
//     once on every open map (a lift out of order). They are cached, and
//     useMapRealtime() refetches them whenever the database says they changed.
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useEffect } from 'react';
import {
  createPreset,
  deletePreset,
  fetchActivePresetId,
  fetchAssignments,
  fetchCanMarkOutOfOrder,
  fetchConnectors,
  fetchOverrides,
  fetchPresets,
  importAssignments,
  renamePreset,
  saveAssignments,
  saveConnectors,
  setActivePreset,
  setAvailable,
  setEdgeTags,
  subscribeToMapChanges,
} from './api.ts';
import { parseAssignmentsCsv } from './assignments.ts';
import type { Assignment, Connector, EdgeTag, Geometry } from './types.ts';

export const navKeys = {
  all: ['map-nav'] as const,
  connectors: () => [...navKeys.all, 'connectors'] as const,
  overrides: () => [...navKeys.all, 'overrides'] as const,
  presets: () => [...navKeys.all, 'presets'] as const,
  activeAssignments: () => [...navKeys.all, 'assignments', 'active'] as const,
  assignments: (presetId: string) => [...navKeys.all, 'assignments', presetId] as const,
  canMarkOutOfOrder: () => [...navKeys.all, 'can-mark-out-of-order'] as const,
};

// Outside navKeys.all on purpose: Realtime refreshes must never reload the geometry.
const geometryKey = ['map-nav-geometry'] as const;

export function useGeometry() {
  return useQuery({
    queryKey: geometryKey,
    queryFn: async () => (await import('./data/geometry.json')).default as unknown as Geometry,
    staleTime: Infinity,
    gcTime: Infinity,
  });
}

export function useConnectors() {
  return useQuery({ queryKey: navKeys.connectors(), queryFn: fetchConnectors });
}

export function useOverrides() {
  return useQuery({ queryKey: navKeys.overrides(), queryFn: fetchOverrides });
}

export function usePresets() {
  return useQuery({ queryKey: navKeys.presets(), queryFn: fetchPresets });
}

/** One preset's room names, for the admin editor (which may edit a term that isn't active). */
export function useAssignments(presetId: string | null) {
  return useQuery({
    queryKey: navKeys.assignments(presetId ?? 'none'),
    queryFn: () => fetchAssignments(presetId as string),
    enabled: presetId !== null,
  });
}

export type ActiveAssignments = {
  /** Null until an admin makes a term active: the names then come from the bundled CSV. */
  presetId: string | null;
  assignments: Assignment[];
};

/** The bundled assignments.csv: what students see before any term is set up. */
async function bundledAssignments(): Promise<Assignment[]> {
  const text = (await import('./data/assignments.csv?raw')).default;
  return parseAssignmentsCsv(text).assignments;
}

/** The room names students see now: the active term's, or the bundled ones. */
export function useActiveAssignments() {
  return useQuery({
    queryKey: navKeys.activeAssignments(),
    queryFn: async (): Promise<ActiveAssignments> => {
      const presetId = await fetchActivePresetId();
      if (presetId === null) {
        return { presetId, assignments: await bundledAssignments() };
      }
      return { presetId, assignments: await fetchAssignments(presetId) };
    },
  });
}

export function useCanMarkOutOfOrder() {
  return useQuery({ queryKey: navKeys.canMarkOutOfOrder(), queryFn: fetchCanMarkOutOfOrder });
}

/** Keeps every map query fresh: refetches when the database reports a change. */
export function useMapRealtime() {
  const queryClient = useQueryClient();
  useEffect(
    () => subscribeToMapChanges(() => queryClient.invalidateQueries({ queryKey: navKeys.all })),
    [queryClient],
  );
}

// ---------- Mutations ----------
// Each one refetches the map queries when it succeeds. Realtime does the same
// for every other open screen.

function useInvalidateNav() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: navKeys.all });
}

export function useSaveConnectors() {
  const invalidate = useInvalidateNav();
  return useMutation({
    mutationFn: (connectors: Connector[]) => saveConnectors(connectors),
    onSuccess: invalidate,
    meta: { successMessage: 'Stairs and lifts saved', errorToast: true },
  });
}

export function useSetAvailable() {
  const invalidate = useInvalidateNav();
  return useMutation({
    mutationFn: (input: { kind: 'connector' | 'door'; id: string; available: boolean }) =>
      setAvailable(input.kind, input.id, input.available),
    onSuccess: invalidate,
    meta: { errorToast: true },
  });
}

export function useSetEdgeTags() {
  const invalidate = useInvalidateNav();
  return useMutation({
    mutationFn: (input: { edgeId: string; tags: EdgeTag[] }) =>
      setEdgeTags(input.edgeId, input.tags),
    onSuccess: invalidate,
    meta: { errorToast: true },
  });
}

export function useCreatePreset() {
  const invalidate = useInvalidateNav();
  return useMutation({
    mutationFn: (input: { name: string; copyFrom?: string }) =>
      createPreset(input.name, input.copyFrom),
    onSuccess: invalidate,
    meta: { successMessage: 'Term created', errorToast: true },
  });
}

export function useRenamePreset() {
  const invalidate = useInvalidateNav();
  return useMutation({
    mutationFn: (input: { id: string; name: string }) => renamePreset(input.id, input.name),
    onSuccess: invalidate,
    meta: { successMessage: 'Term renamed', errorToast: true },
  });
}

export function useDeletePreset() {
  const invalidate = useInvalidateNav();
  return useMutation({
    mutationFn: deletePreset,
    onSuccess: invalidate,
    meta: { successMessage: 'Term deleted', errorToast: true },
  });
}

export function useSetActivePreset() {
  const invalidate = useInvalidateNav();
  return useMutation({
    mutationFn: setActivePreset,
    onSuccess: invalidate,
    meta: { successMessage: 'Students now see this term', errorToast: true },
  });
}

export function useSaveAssignments() {
  const invalidate = useInvalidateNav();
  return useMutation({
    mutationFn: (input: { presetId: string; assignments: Assignment[] }) =>
      saveAssignments(input.presetId, input.assignments),
    onSuccess: invalidate,
    meta: { successMessage: 'Room saved', errorToast: true },
  });
}

export function useImportAssignments() {
  const invalidate = useInvalidateNav();
  return useMutation({
    mutationFn: (input: { presetId: string; assignments: Assignment[]; rows?: number[] }) =>
      importAssignments(input.presetId, input.assignments, input.rows),
    onSuccess: invalidate,
    meta: { successMessage: 'Room names imported', errorToast: true },
  });
}
