// School map: plain functions (tested in map.test.tsx).
//
// Coordinates: rooms are stored in floor-plan pixels, x from the left and y
// from the TOP, like any image. Leaflet's CRS.Simple measures y ("lat") from
// the BOTTOM. These two functions convert, so nothing else has to think about it.
import type { CalendarBooking, Venue } from '@/features/venues/api';
import type { Floor, Room } from './api';

export function toLatLng(x: number, y: number, floor: Pick<Floor, 'height'>): [number, number] {
  return [floor.height - y, x];
}

/** Where someone clicked on the plan, rounded and kept inside the image. */
export function fromLatLng(
  lat: number,
  lng: number,
  floor: Pick<Floor, 'width' | 'height'>,
): { x: number; y: number } {
  const clamp = (value: number, max: number) => Math.min(Math.max(Math.round(value), 0), max);
  return { x: clamp(lng, floor.width), y: clamp(floor.height - lat, floor.height) };
}

/** Rooms whose code or name contains the query, best matches (code starts) first. */
export function searchRooms(rooms: Room[], query: string, limit = 8): Room[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return rooms
    .filter((room) => room.code.toLowerCase().includes(q) || room.name.toLowerCase().includes(q))
    .sort(
      (a, b) =>
        Number(!a.code.toLowerCase().startsWith(q)) - Number(!b.code.toLowerCase().startsWith(q)),
    )
    .slice(0, limit);
}

/** Room id → the approved booking happening there now. */
export function roomsInUse(
  bookings: CalendarBooking[],
  venues: Pick<Venue, 'id' | 'room_id'>[],
): Map<string, CalendarBooking> {
  const inUse = new Map<string, CalendarBooking>();
  for (const booking of bookings) {
    const roomId = venues.find((venue) => venue.id === booking.venue_id)?.room_id;
    if (roomId && !inUse.has(roomId)) inUse.set(roomId, booking);
  }
  return inUse;
}

/**
 * Where to draw the n-th fix-it pin in a room. Reports share their room's
 * position, so they're nudged to the right (and along, if there are several)
 * to keep the room pin visible.
 */
export function reportPinPosition(
  x: number,
  y: number,
  indexInRoom: number,
): { x: number; y: number } {
  return { x: x + 45 + indexInRoom * 35, y: y - 30 };
}
