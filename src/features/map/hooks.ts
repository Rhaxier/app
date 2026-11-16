// School map hooks. The map changes rarely, so it's cached for ten minutes.
//
// Two sets of rooms and floors exist side by side until the release
// (MAP_NOTES.md, rooms migration B): the old map's 15 placeholder rooms on
// floor images, and the rooms traced from the school's floor plan. Which set
// the app uses follows one switch, app_settings.map_indoor_live (set by
// migration B), so the map, the room pickers and search all change together.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { env } from '@/lib/env';
import type { TablesInsert, TablesUpdate } from '@/types/database';
import {
  createRoom,
  deleteRoom,
  fetchAllFloors,
  fetchFloors,
  fetchIndoorMapLive,
  fetchIndoorRooms,
  fetchRooms,
  updateFloor,
  updateRoom,
  uploadFloorPlan,
} from './api';

export const mapKeys = {
  all: ['map'] as const,
  live: () => [...mapKeys.all, 'live'] as const,
  floors: (set: 'old' | 'indoor') => [...mapKeys.all, 'floors', set] as const,
  rooms: (set: 'old' | 'indoor') => [...mapKeys.all, 'rooms', set] as const,
};

/**
 * Is the indoor map live (migration B ran)? Checked every minute and when the
 * app comes back to the front, so a release reaches open apps quickly.
 * VITE_INDOOR_MAP=true forces it on, for trying it locally.
 */
export function useIndoorMapLive(): { live: boolean; ready: boolean } {
  const query = useQuery({
    queryKey: mapKeys.live(),
    queryFn: fetchIndoorMapLive,
    staleTime: 60_000,
    refetchOnWindowFocus: true,
    enabled: !env.indoorMap,
  });
  if (env.indoorMap) return { live: true, ready: true };
  return { live: query.data === true, ready: query.data !== undefined || query.isError };
}

/** The old map's floors (with their images): the old map and its admin page only. */
export function useLegacyFloors() {
  return useQuery({
    queryKey: mapKeys.floors('old'),
    queryFn: fetchFloors,
    staleTime: 10 * 60_000,
  });
}

/** The old map's placeholder rooms: the old map and its admin page only. */
export function useLegacyRooms() {
  return useQuery({ queryKey: mapKeys.rooms('old'), queryFn: fetchRooms, staleTime: 10 * 60_000 });
}

/** The floors in use now (the booking page, the report form): old or indoor, by the switch. */
export function useFloors() {
  const { live, ready } = useIndoorMapLive();
  return useQuery({
    queryKey: mapKeys.floors(live ? 'indoor' : 'old'),
    queryFn: live ? fetchAllFloors : fetchFloors,
    staleTime: 10 * 60_000,
    enabled: ready,
  });
}

/** The rooms in use now (every room picker, search): old or traced, by the switch. */
export function useRooms() {
  const { live, ready } = useIndoorMapLive();
  return useQuery({
    queryKey: mapKeys.rooms(live ? 'indoor' : 'old'),
    queryFn: live ? fetchIndoorRooms : fetchRooms,
    staleTime: 10 * 60_000,
    enabled: ready,
  });
}

function useInvalidateMap() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: mapKeys.all });
}

export function useCreateRoom() {
  const invalidate = useInvalidateMap();
  return useMutation({
    mutationFn: (room: TablesInsert<'rooms'>) => createRoom(room),
    onSuccess: invalidate,
    meta: { successMessage: 'Room added' },
  });
}

export function useUpdateRoom() {
  const invalidate = useInvalidateMap();
  return useMutation({
    mutationFn: ({ id, changes }: { id: string; changes: TablesUpdate<'rooms'> }) =>
      updateRoom(id, changes),
    onSuccess: invalidate,
    meta: { successMessage: 'Room saved', errorToast: true },
  });
}

export function useDeleteRoom() {
  const invalidate = useInvalidateMap();
  return useMutation({
    mutationFn: deleteRoom,
    onSuccess: invalidate,
    meta: { successMessage: 'Room deleted' },
  });
}

export function useUpdateFloor() {
  const invalidate = useInvalidateMap();
  return useMutation({
    mutationFn: ({ id, changes }: { id: string; changes: TablesUpdate<'floors'> }) =>
      updateFloor(id, changes),
    onSuccess: invalidate,
    meta: { successMessage: 'Floor saved' },
  });
}

/** Admin: upload a plan image (the floor is saved separately, after checking). */
export function useUploadFloorPlan() {
  return useMutation({
    mutationFn: ({ floorId, file }: { floorId: string; file: File }) =>
      uploadFloorPlan(floorId, file),
    meta: { successMessage: 'Uploaded. Check the size, then save the floor.', errorToast: true },
  });
}
