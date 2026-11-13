// School map: coordinate conversion, room search and "in use now".
// (Leaflet itself needs a real browser, so the map widget isn't rendered here.)
import { describe, expect, it } from 'vitest';
import type { CalendarBooking } from '@/features/venues/api';
import type { Room } from './api';
import { fromLatLng, reportSpots, roomsInUse, searchRooms, toLatLng } from './logic';

const floor = { width: 1000, height: 700 };

function room(code: string, name: string): Room {
  return { id: code, floor_id: 'g', code, name, kind: 'classroom', x: 100, y: 100 };
}

describe('coordinates', () => {
  it('turns plan pixels (y from the top) into Leaflet positions (y from the bottom)', () => {
    expect(toLatLng(220, 170, floor)).toEqual([530, 220]);
  });

  it('turns a click back into plan pixels, rounded and kept inside the plan', () => {
    expect(fromLatLng(530.4, 219.6, floor)).toEqual({ x: 220, y: 170 });
    expect(fromLatLng(-20, 1200, floor)).toEqual({ x: 1000, y: 700 });
  });

  it('round-trips', () => {
    const [lat, lng] = toLatLng(815, 545, floor);
    expect(fromLatLng(lat, lng, floor)).toEqual({ x: 815, y: 545 });
  });
});

describe('searchRooms', () => {
  const rooms = [
    room('G.06', 'Lab 1'),
    room('G.07', 'Lab 2'),
    room('1.03', 'Computer lab'),
    room('G.05', 'Library'),
  ];

  it('matches codes and names, ignoring case', () => {
    expect(searchRooms(rooms, 'lab').map((r) => r.code)).toEqual(['G.06', 'G.07', '1.03']);
    expect(searchRooms(rooms, 'g.05').map((r) => r.code)).toEqual(['G.05']);
  });

  it('puts codes that start with the query first', () => {
    expect(searchRooms(rooms, '1').map((r) => r.code)[0]).toBe('1.03');
  });

  it('returns nothing for an empty query', () => {
    expect(searchRooms(rooms, '  ')).toEqual([]);
  });
});

describe('roomsInUse', () => {
  it('maps approved bookings happening now onto their venue rooms', () => {
    const booking: CalendarBooking = {
      id: 'b1',
      venue_id: 'v1',
      title: 'Assembly',
      starts_at: '',
      ends_at: '',
      status: 'approved',
    };
    const inUse = roomsInUse(
      [booking],
      [
        { id: 'v1', room_id: 'G.01' },
        { id: 'v2', room_id: null },
      ],
    );
    expect(inUse.get('G.01')?.title).toBe('Assembly');
    expect(inUse.size).toBe(1);
  });
});

describe('reportSpots', () => {
  it('gives each room one count pin, nudged off the room pin', () => {
    const report = (id: string, roomId: string | null, x = 500, y = 485) => ({
      id,
      room_id: roomId,
      x,
      y,
    });
    const spots = reportSpots([
      report('r1', 'G.15'),
      report('r2', 'G.15'),
      report('r3', null, 100, 100),
    ]);
    expect(spots).toHaveLength(2);
    expect(spots[0]).toMatchObject({ key: 'G.15', x: 545, y: 455 });
    expect(spots[0].reports.map((r) => r.id)).toEqual(['r1', 'r2']);
    // A report outside any room keeps a pin of its own.
    expect(spots[1]).toMatchObject({ key: 'r3', x: 145, y: 70 });
  });
});
