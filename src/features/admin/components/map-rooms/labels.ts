// Words shown for the map's room types, kinds and floors in the admin screens.
import type { RoomRow } from '@/features/map/nav/assignments';
import type { RoomType } from '@/features/map/nav/types';

export const roomTypeLabel: Record<RoomType, string> = {
  classroom: 'Classroom',
  lab: 'Lab',
  office: 'Office',
  hall: 'Hall',
  library: 'Library',
  cafeteria: 'Cafeteria',
  toilet: 'Toilet',
  prayer: 'Prayer room',
  store: 'Store',
  other: 'Other',
};

export const kindLabel: Record<RoomRow['kind'], string> = {
  room: 'Room',
  place: 'Open area',
  entrance: 'Entrance',
};

export const floorLabel = (floor: string) => (floor === 'G' ? 'Ground' : `Floor ${floor}`);
