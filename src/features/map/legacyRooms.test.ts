// Rooms migration step A adds the traced rooms and a floor 3 to the database.
// Today's map, room pickers and old Map admin page must not show them until
// step B: fetchRooms asks only for the original rooms, fetchFloors only for
// floors that have an image. A fake Supabase records what was asked.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const calls = vi.hoisted(() => ({
  list: [] as unknown[][],
  data: [] as unknown[],
  // Errors to return, one per query, before the data is returned.
  errors: [] as { code: string; message: string }[],
}));

vi.mock('@/lib/supabase', () => {
  // Every query method records its call and returns the builder, like supabase-js.
  const builder: Record<string, unknown> = {};
  for (const method of ['select', 'is', 'not', 'order', 'eq']) {
    builder[method] = (...args: unknown[]) => {
      calls.list.push([method, ...args]);
      return builder;
    };
  }
  builder.then = (resolve: (value: unknown) => unknown) => {
    const error = calls.errors.shift();
    return resolve(error ? { data: null, error } : { data: calls.data, error: null });
  };
  return {
    supabase: {
      from: (table: string) => {
        calls.list.push(['from', table]);
        return builder;
      },
    },
  };
});

import { fetchFloors, fetchRooms } from './api';

beforeEach(() => {
  calls.list = [];
  calls.data = [];
  calls.errors = [];
});

describe('legacy map reads', () => {
  it('asks only for the original rooms (no region_id, not retired)', async () => {
    await fetchRooms();
    expect(calls.list).toContainEqual(['from', 'rooms']);
    expect(calls.list).toContainEqual(['is', 'region_id', null]);
    expect(calls.list).toContainEqual(['is', 'retired_at', null]);
  });

  it('still works on a database where step A has not run (no region_id column yet)', async () => {
    calls.errors = [{ code: '42703', message: 'column rooms.region_id does not exist' }];
    calls.data = [{ id: 'r', floor_id: 'g', code: 'G.01', name: 'Hall', kind: 'hall', x: 1, y: 2 }];
    const rooms = await fetchRooms();
    expect(rooms.map((room) => room.code)).toEqual(['G.01']);
    expect(calls.list.filter((call) => call[0] === 'from')).toHaveLength(2);
  });

  it('asks only for floors with an image, and never returns one without', async () => {
    calls.data = [
      {
        id: 'g',
        name: 'G',
        sort_order: 0,
        image_path: '/floorplans/floor-g.svg',
        width: 1000,
        height: 700,
      },
      { id: '3', name: '3', sort_order: 3, image_path: null, width: 3448, height: 2551 },
    ];
    const floors = await fetchFloors();
    expect(calls.list).toContainEqual(['not', 'image_path', 'is', null]);
    expect(floors.map((floor) => floor.name)).toEqual(['G']);
  });
});
