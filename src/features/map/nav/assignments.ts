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

/** Renames or re-assigns a single room, leaving the rest of the set as it is. */
/** Ids of everything that can be given a name: rooms and wall-less places. */
export function destinationIds(geometry: Geometry): string[] {
  const rooms = geometry.regions
    .filter((region) => region.kind === 'room')
    .map((region) => region.id);
  return [...rooms, ...geometry.places.map((place) => place.id)];
}

export type Destination = Assignment & { floor: string; kind: 'room' | 'place' };

/**
 * What student search should list: every room or place that has a name.
 * Unnamed rooms (small stores, cubicles) stay in the data so an admin can
 * name them later, but they are left out here on purpose.
 */
export function searchableDestinations(
  geometry: Geometry,
  assignments: Assignment[],
): Destination[] {
  const floorOf = new Map<string, { floor: string; kind: 'room' | 'place' }>();
  for (const region of geometry.regions) {
    if (region.kind === 'room') {
      floorOf.set(region.id, { floor: region.floor, kind: 'room' });
    }
  }
  for (const place of geometry.places) {
    floorOf.set(place.id, { floor: place.floor, kind: 'place' });
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
