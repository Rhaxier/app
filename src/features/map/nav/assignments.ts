// Room assignments: what each room is called and used for this term.
//
// Kept apart from the geometry so the school can swap a whole term's set
// (CSV or JSON) or rename one room without touching any shapes. Room ids
// (e.g. "G-R014") are the only link between the two.

import type { Assignment, Geometry, RoomType } from './types.ts';

export const ROOM_TYPES: RoomType[] = [
  'classroom',
  'lab',
  'office',
  'hall',
  'library',
  'cafeteria',
  'toilet',
  'prayer',
  'store',
  'other',
];

export const ASSIGNMENT_COLUMNS = ['room_id', 'name', 'subject', 'teacher', 'type'] as const;

/** Splits one CSV line, honouring double quotes ("a, b" stays one cell; "" is a quote). */
function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (quoted) {
      if (char === '"' && line[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      cells.push(cell);
      cell = '';
    } else {
      cell += char;
    }
  }
  cells.push(cell);
  return cells.map((value) => value.trim());
}

export type AssignmentLoad = {
  assignments: Assignment[];
  /** Human-readable issues: unknown room ids, duplicate rows, bad types. Never thrown. */
  issues: string[];
};

/**
 * Reads a whole term's assignments from CSV text.
 * Header row required: room_id,name,subject,teacher,type (any order; `class` is accepted for `subject`).
 */
export function parseAssignmentsCsv(text: string, geometry?: Geometry): AssignmentLoad {
  const lines = text.split(/\r?\n/).filter((line) => line.trim() !== '');
  const issues: string[] = [];
  if (lines.length === 0) {
    return { assignments: [], issues: ['The file is empty.'] };
  }
  const header = splitCsvLine(lines[0]).map((name) => name.toLowerCase().replace(/\s+/g, '_'));
  const column = (name: string, alias?: string) => {
    const at = header.indexOf(name);
    return at >= 0 || !alias ? at : header.indexOf(alias);
  };
  const at = {
    roomId: column('room_id', 'room'),
    name: column('name'),
    subject: column('subject', 'class'),
    teacher: column('teacher'),
    type: column('type'),
  };
  if (at.roomId < 0) {
    return { assignments: [], issues: ['Missing the "room_id" column.'] };
  }
  const rows = lines.slice(1).map((line) => {
    const cells = splitCsvLine(line);
    return {
      roomId: cells[at.roomId] ?? '',
      name: cells[at.name] ?? '',
      subject: cells[at.subject] ?? '',
      teacher: cells[at.teacher] ?? '',
      type: cells[at.type] ?? '',
    };
  });
  return checkAssignments(rows, geometry, issues);
}

/** Reads assignments from parsed JSON (an array of objects with the same field names as `Assignment`). */
export function parseAssignmentsJson(value: unknown, geometry?: Geometry): AssignmentLoad {
  if (!Array.isArray(value)) {
    return { assignments: [], issues: ['Expected a list of assignments.'] };
  }
  const text = (field: unknown) => (typeof field === 'string' ? field.trim() : '');
  const rows = value.map((row: Record<string, unknown>) => ({
    roomId: text(row?.roomId ?? row?.room_id),
    name: text(row?.name),
    subject: text(row?.subject ?? row?.class),
    teacher: text(row?.teacher),
    type: text(row?.type),
  }));
  return checkAssignments(rows, geometry, []);
}

function checkAssignments(
  rows: { roomId: string; name: string; subject: string; teacher: string; type: string }[],
  geometry: Geometry | undefined,
  issues: string[],
): AssignmentLoad {
  // Rooms and wall-less places are both valid targets for a name.
  const rooms = geometry ? new Set(destinationIds(geometry)) : undefined;
  const seen = new Set<string>();
  const assignments: Assignment[] = [];
  for (const row of rows) {
    if (row.roomId === '') {
      issues.push('A row has no room_id and was skipped.');
      continue;
    }
    if (rooms && !rooms.has(row.roomId)) {
      issues.push(`Unknown room id "${row.roomId}": skipped.`);
      continue;
    }
    if (seen.has(row.roomId)) {
      issues.push(`Room "${row.roomId}" appears twice: the first row was kept.`);
      continue;
    }
    seen.add(row.roomId);
    const knownType = ROOM_TYPES.includes(row.type as RoomType);
    if (row.type !== '' && !knownType) {
      issues.push(`Room "${row.roomId}" has unknown type "${row.type}": using "other".`);
    }
    assignments.push({
      roomId: row.roomId,
      name: row.name,
      subject: row.subject,
      teacher: row.teacher,
      type: knownType ? (row.type as RoomType) : 'other',
    });
  }
  return { assignments, issues };
}

const csvCell = (value: string) =>
  /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;

export function assignmentsToCsv(assignments: Assignment[]): string {
  const rows = assignments.map((a) =>
    [a.roomId, a.name, a.subject, a.teacher, a.type].map(csvCell).join(','),
  );
  return [ASSIGNMENT_COLUMNS.join(','), ...rows].join('\n') + '\n';
}

/** Doors that lead outside. An admin can name one ("Main gate") to make it a destination. */
export function entranceDoors(geometry: Geometry): Geometry['doors'] {
  return geometry.doors.filter((door) => door.b === 'outside');
}

/** Ids of everything that can be given a name: rooms, wall-less places and entrances. */
export function destinationIds(geometry: Geometry): string[] {
  const rooms = geometry.regions
    .filter((region) => region.kind === 'room')
    .map((region) => region.id);
  return [
    ...rooms,
    ...geometry.places.map((place) => place.id),
    ...entranceDoors(geometry).map((door) => door.id),
  ];
}

/** `kind` says which RouteEnd type to use: `entrance` goes to the router as `{ type: 'door' }`. */
export type Destination = Assignment & { floor: string; kind: 'room' | 'place' | 'entrance' };

/**
 * What student search should list: every room or place that has a name.
 * Unnamed rooms (small stores, cubicles) stay in the data so an admin can
 * name them later, but they are left out here on purpose.
 */
export function searchableDestinations(
  geometry: Geometry,
  assignments: Assignment[],
): Destination[] {
  const floorOf = new Map<string, { floor: string; kind: Destination['kind'] }>();
  for (const region of geometry.regions) {
    if (region.kind === 'room') {
      floorOf.set(region.id, { floor: region.floor, kind: 'room' });
    }
  }
  for (const place of geometry.places) {
    floorOf.set(place.id, { floor: place.floor, kind: 'place' });
  }
  for (const door of entranceDoors(geometry)) {
    floorOf.set(door.id, { floor: door.floor, kind: 'entrance' });
  }
  const list: Destination[] = [];
  for (const assignment of assignments) {
    const where = floorOf.get(assignment.roomId);
    if (where && assignment.name.trim() !== '') {
      list.push({ ...assignment, ...where });
    }
  }
  return list;
}

/** Renames or re-assigns a single room, leaving the rest of the set as it is. */
export function updateAssignment(
  assignments: Assignment[],
  roomId: string,
  change: Partial<Omit<Assignment, 'roomId'>>,
): Assignment[] {
  const existing = assignments.find((assignment) => assignment.roomId === roomId);
  if (!existing) {
    return [
      ...assignments,
      { roomId, name: '', subject: '', teacher: '', type: 'other', ...change },
    ];
  }
  return assignments.map((assignment) =>
    assignment.roomId === roomId ? { ...assignment, ...change } : assignment,
  );
}

// ---------- Strict checks for the admin screens ----------
// The parser above is forgiving on purpose (scripts and the bundled file use
// it: it skips bad rows and keeps going). The admin import is not: a file
// with any problem can't be applied, and every problem is listed. The same
// messages come back from the database (map_write_assignments), so a bad
// row reads the same whichever side catches it.

export const NAME_MAX_LENGTH = 80;

export type AssignmentsCheck = {
  /** Rows that passed, in file order. A row with an empty name is kept: applying it leaves the room unnamed. */
  assignments: Assignment[];
  /** The file line of each row in `assignments` (the header is line 1), for the database's messages. */
  lines: number[];
  /** Every problem, in file order. Empty means the file can be applied. */
  errors: string[];
};

export const missingColumnsMessage = `The file needs these columns: ${ASSIGNMENT_COLUMNS.join(', ')}.`;

export const duplicateNameMessage = (name: string, usedBy: string) =>
  `Two rooms can't share a name: "${name}" is already used by ${usedBy}.`;

/** Checks a whole CSV file for the Import button. Nothing is skipped silently. */
export function checkAssignmentsCsv(text: string, geometry: Geometry): AssignmentsCheck {
  // A spreadsheet may start the file with an invisible byte-order mark.
  const withoutMark = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const lines = withoutMark.split(/\r?\n/);
  const headerAt = lines.findIndex((line) => line.trim() !== '');
  if (headerAt < 0) {
    return { assignments: [], lines: [], errors: ['The file is empty.'] };
  }
  const header = splitCsvLine(lines[headerAt]).map((name) =>
    name.toLowerCase().replace(/\s+/g, '_'),
  );
  const column = (name: string, alias?: string) => {
    const at = header.indexOf(name);
    return at >= 0 || !alias ? at : header.indexOf(alias);
  };
  const at = {
    roomId: column('room_id', 'room'),
    name: column('name'),
    subject: column('subject', 'class'),
    teacher: column('teacher'),
    type: column('type'),
  };
  if (Object.values(at).some((index) => index < 0)) {
    return { assignments: [], lines: [], errors: [missingColumnsMessage] };
  }

  const known = new Set(destinationIds(geometry));
  const roomLine = new Map<string, number>();
  const nameOwner = new Map<string, string>();
  const result: AssignmentsCheck = { assignments: [], lines: [], errors: [] };

  for (let index = headerAt + 1; index < lines.length; index += 1) {
    if (lines[index].trim() === '') continue;
    const row = index + 1; // the line number a spreadsheet shows
    const cells = splitCsvLine(lines[index]);
    const roomId = cells[at.roomId] ?? '';
    const name = cells[at.name] ?? '';
    const rawType = cells[at.type] ?? '';
    const type = rawType.toLowerCase();

    if (roomId === '') {
      result.errors.push(`Row ${row}: the room_id is empty.`);
      continue;
    }
    if (!known.has(roomId)) {
      result.errors.push(`Row ${row}: "${roomId}" is not a room on the map.`);
      continue;
    }
    const firstLine = roomLine.get(roomId);
    if (firstLine !== undefined) {
      result.errors.push(`Row ${row}: ${roomId} already appears on row ${firstLine}.`);
      continue;
    }
    roomLine.set(roomId, row);
    if (type !== '' && !ROOM_TYPES.includes(type as RoomType)) {
      result.errors.push(
        `Row ${row}: "${rawType}" is not a room type. Use one of: ${ROOM_TYPES.join(', ')}.`,
      );
      continue;
    }
    if (name.length > NAME_MAX_LENGTH) {
      result.errors.push(
        `Row ${row}: the name is too long (${NAME_MAX_LENGTH} characters at most).`,
      );
      continue;
    }
    if (name !== '') {
      const owner = nameOwner.get(name.toLowerCase());
      if (owner !== undefined) {
        result.errors.push(duplicateNameMessage(name, owner));
        continue;
      }
      nameOwner.set(name.toLowerCase(), roomId);
    }
    result.assignments.push({
      roomId,
      name,
      subject: cells[at.subject] ?? '',
      teacher: cells[at.teacher] ?? '',
      type: type === '' ? 'other' : (type as RoomType),
    });
    result.lines.push(row);
  }
  return result;
}

export type AssignmentChanges = { added: string[]; changed: string[]; removed: string[] };

/**
 * What applying `after` to a term holding `before` will do, by room id.
 * Only named rooms count: `removed` are the rooms that will become unnamed.
 */
export function compareAssignments(before: Assignment[], after: Assignment[]): AssignmentChanges {
  const named = (list: Assignment[]) =>
    new Map(list.filter((a) => a.name.trim() !== '').map((a) => [a.roomId, a]));
  const old = named(before);
  const next = named(after);
  const changes: AssignmentChanges = { added: [], changed: [], removed: [] };
  for (const [roomId, assignment] of next) {
    const was = old.get(roomId);
    if (!was) {
      changes.added.push(roomId);
    } else if (
      was.name !== assignment.name ||
      was.subject !== assignment.subject ||
      was.teacher !== assignment.teacher ||
      was.type !== assignment.type
    ) {
      changes.changed.push(roomId);
    }
  }
  for (const roomId of old.keys()) {
    if (!next.has(roomId)) changes.removed.push(roomId);
  }
  return changes;
}

/** The edit form's check of a room's new name. Null when it can be saved. */
export function checkRoomEdit(
  assignments: Assignment[],
  roomId: string,
  name: string,
): string | null {
  const trimmed = name.trim();
  if (trimmed.length > NAME_MAX_LENGTH) {
    return `Use ${NAME_MAX_LENGTH} characters or fewer.`;
  }
  if (trimmed === '') return null;
  const other = assignments.find(
    (a) => a.roomId !== roomId && a.name.trim().toLowerCase() === trimmed.toLowerCase(),
  );
  return other ? duplicateNameMessage(trimmed, other.roomId) : null;
}

/** One line of the admin table: every room, place and entrance, named or not. */
export type RoomRow = {
  id: string;
  floor: string;
  kind: Destination['kind'];
  /** Empty when unnamed. */
  name: string;
  subject: string;
  teacher: string;
  type: RoomType;
};

export function roomRows(geometry: Geometry, assignments: Assignment[]): RoomRow[] {
  const byId = new Map(assignments.map((a) => [a.roomId, a]));
  const floorOrder = new Map(geometry.floors.map((floor, index) => [floor.id, index]));
  const items: { id: string; floor: string; kind: Destination['kind'] }[] = [
    ...geometry.regions
      .filter((region) => region.kind === 'room')
      .map((region) => ({ id: region.id, floor: region.floor, kind: 'room' as const })),
    ...geometry.places.map((place) => ({
      id: place.id,
      floor: place.floor,
      kind: 'place' as const,
    })),
    ...entranceDoors(geometry).map((door) => ({
      id: door.id,
      floor: door.floor,
      kind: 'entrance' as const,
    })),
  ];
  return items
    .map((item) => {
      const assignment = byId.get(item.id);
      return {
        ...item,
        name: assignment?.name ?? '',
        subject: assignment?.subject ?? '',
        teacher: assignment?.teacher ?? '',
        type: assignment?.type ?? 'other',
      };
    })
    .sort(
      (a, b) =>
        (floorOrder.get(a.floor) ?? 99) - (floorOrder.get(b.floor) ?? 99) ||
        a.id.localeCompare(b.id),
    );
}

/** 'all', 'named', 'unnamed', or one floor: 'floor:G', 'floor:1' and so on. */
export type RoomFilter = 'all' | 'named' | 'unnamed' | `floor:${string}`;

export function filterRoomRows(rows: RoomRow[], query: string, filter: RoomFilter): RoomRow[] {
  const words = query.trim().toLowerCase();
  return rows.filter((row) => {
    if (filter === 'named' && row.name === '') return false;
    if (filter === 'unnamed' && row.name !== '') return false;
    if (filter.startsWith('floor:') && row.floor !== filter.slice('floor:'.length)) return false;
    if (words === '') return true;
    return [row.id, row.name, row.subject, row.teacher].some((value) =>
      value.toLowerCase().includes(words),
    );
  });
}
