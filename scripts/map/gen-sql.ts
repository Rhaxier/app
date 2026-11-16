// `npm run map:sql` - writes the generated parts of two migrations from the map data:
//
//   20261115120050_map_geometry_ids.sql   every room, place, door and edge id
//   20261115120100_rooms_migration_a.sql  the named traced rooms for the rooms table
//
// Only the lines between the `<generated:...>` markers change, so the
// hand-written SQL around them stays as it is. `npm run map:sql -- --check`
// changes nothing and fails if the files are out of date (for example after
// a re-trace), which is how a reviewer can confirm the SQL matches the data.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { destinationIds } from '../../src/features/map/nav/assignments.ts';
import type { Assignment, Geometry, RoomType } from '../../src/features/map/nav/types.ts';
import { loadMapData } from './load.ts';

const migrations = fileURLToPath(new URL('../../supabase/migrations/', import.meta.url));
const IDS_FILE = `${migrations}20261115120050_map_geometry_ids.sql`;
const ROOMS_FILE = `${migrations}20261115120100_rooms_migration_a.sql`;

// The rooms table has fewer kinds than the new map's RoomType.
const ROOM_KIND: Record<RoomType, string> = {
  classroom: 'classroom',
  lab: 'lab',
  office: 'office',
  hall: 'hall',
  library: 'library',
  cafeteria: 'cafeteria',
  toilet: 'other',
  prayer: 'other',
  store: 'other',
  other: 'other',
};

const quote = (value: string) => `'${value.replace(/'/g, "''")}'`;
const byId = (a: { id: string }, b: { id: string }) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

function geometryIdsSql(geometry: Geometry): string {
  const destinations = new Set(destinationIds(geometry));
  const nodeFloor = new Map(geometry.nodes.map((node) => [node.id, node.floor]));
  const rows: { id: string; kind: string; floor: string }[] = [
    ...geometry.regions
      .filter((region) => region.kind === 'room')
      .map((region) => ({ id: region.id, kind: 'room', floor: region.floor })),
    ...geometry.places.map((place) => ({ id: place.id, kind: 'place', floor: place.floor })),
    ...geometry.doors.map((door) => ({ id: door.id, kind: 'door', floor: door.floor })),
    ...geometry.edges.map((edge) => ({
      id: edge.id,
      kind: 'edge',
      floor: nodeFloor.get(edge.a) ?? edge.id.split('-')[0],
    })),
  ].sort(byId);
  const values = rows.map(
    (row) =>
      `  (${quote(row.id)}, ${quote(row.kind)}, ${quote(row.floor)}, ${destinations.has(row.id)})`,
  );
  return [
    `-- ${rows.length} ids from geometry.json`,
    'insert into public.map_geometry_ids (id, kind, floor, destination) values',
    values.join(',\n') + ';',
  ].join('\n');
}

function tracedRoomsSql(geometry: Geometry, assignments: Assignment[]): string {
  const names = new Map(assignments.map((a) => [a.roomId, a]));
  const rows: string[] = [];
  const points = [
    ...geometry.regions
      .filter((region) => region.kind === 'room')
      .map((region) => ({
        id: region.id,
        floor: region.floor,
        x: region.labelAt[0],
        y: region.labelAt[1],
      })),
    ...geometry.places.map((place) => ({
      id: place.id,
      floor: place.floor,
      x: place.x,
      y: place.y,
    })),
  ].sort(byId);
  for (const point of points) {
    const assignment = names.get(point.id);
    // Unnamed rooms get no rooms row: nobody can pick a room without a name.
    if (!assignment || assignment.name.trim() === '') continue;
    rows.push(
      `  (${quote(point.id)}, ${quote(point.floor)}, ${quote(assignment.name)}, ` +
        `${quote(ROOM_KIND[assignment.type])}, ${Math.round(point.x)}, ${Math.round(point.y)})`,
    );
  }
  return [
    `-- ${rows.length} named rooms and places (unnamed ones are left out)`,
    'insert into public.room_migration_traced (region_id, floor, name, kind, x, y) values',
    rows.join(',\n') + ';',
  ].join('\n');
}

/** Replaces the lines between `-- <generated:tag>` and `-- </generated:tag>`. */
function fill(text: string, tag: string, body: string): string {
  const open = `-- <generated:${tag}>`;
  const close = `-- </generated:${tag}>`;
  const start = text.indexOf(open);
  const end = text.indexOf(close);
  if (start < 0 || end < start) {
    throw new Error(`Markers for "${tag}" not found.`);
  }
  return `${text.slice(0, start + open.length)}\n${body}\n${text.slice(end)}`;
}

const { geometry, assignments } = loadMapData();
const check = process.argv.includes('--check');
let stale = 0;
for (const [file, tag, body] of [
  [IDS_FILE, 'geometry-ids', geometryIdsSql(geometry)],
  [ROOMS_FILE, 'traced-rooms', tracedRoomsSql(geometry, assignments)],
] as const) {
  const before = readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
  const after = fill(before, tag, body);
  const name = file.split('/').pop();
  if (before === after) {
    console.log(`up to date: ${name}`);
  } else if (check) {
    console.error(`OUT OF DATE: ${name} (run npm run map:sql)`);
    stale += 1;
  } else {
    writeFileSync(file, after);
    console.log(`written: ${name}`);
  }
}
if (stale > 0) process.exit(1);
