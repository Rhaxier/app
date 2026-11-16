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

export interface ReportSpot<R> {
  /** The room's id, or the report's own id for one placed outside a room. */
  key: string;
  x: number;
  y: number;
  /** In the order given (the feed is newest first). */
  reports: R[];
}

/**
 * Where to draw the fix-it count pins: one per room, counting its open
 * reports (design PDF page 11), and one for each report placed outside a
 * room. Reports share their room's position, so the pin is nudged up and to
 * the right, keeping the room's own pin visible and tappable.
 */
export function reportSpots<R extends { id: string; room_id: string | null; x: number; y: number }>(
  reports: R[],
): ReportSpot<R>[] {
  const spots = new Map<string, ReportSpot<R>>();
  for (const report of reports) {
    const key = report.room_id ?? report.id;
    const spot = spots.get(key);
    if (spot) spot.reports.push(report);
    else spots.set(key, { key, x: report.x + 45, y: report.y - 30, reports: [report] });
  }
  return [...spots.values()];
}

/**
 * How a room is named in pickers and search. A placeholder room has a short
 * code ("G.04 · Classroom G.04"); a room traced from the floor plan has an
 * id-like code ("G-R030"), so it shows its name and floor instead
 * ("PYP3 B (Ground floor)").
 */
export function roomLabel(room: { code: string; name: string }): string {
  const traced = /^([G0-9]+)-[RP]\d+$/.exec(room.code);
  if (!traced) return `${room.code} · ${room.name}`;
  const floor = traced[1] === 'G' ? 'Ground floor' : `Floor ${traced[1]}`;
  return `${room.name} (${floor})`;
}
