// School map hooks. The map changes rarely, so it's cached for ten minutes.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { TablesInsert, TablesUpdate } from '@/types/database';
import {
  createRoom,
  deleteRoom,
  fetchFloors,
  fetchRooms,
  updateFloor,
  updateRoom,
  uploadFloorPlan,
} from './api';

export const mapKeys = {
  all: ['map'] as const,
  floors: () => [...mapKeys.all, 'floors'] as const,
  rooms: () => [...mapKeys.all, 'rooms'] as const,
};

export function useFloors() {
  return useQuery({ queryKey: mapKeys.floors(), queryFn: fetchFloors, staleTime: 10 * 60_000 });
}

export function useRooms() {
  return useQuery({ queryKey: mapKeys.rooms(), queryFn: fetchRooms, staleTime: 10 * 60_000 });
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
