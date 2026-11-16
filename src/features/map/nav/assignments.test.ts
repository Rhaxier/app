// The admin screens' strict checks: the CSV import, the edit form and the
// room table. Uses the real traced map, so the ids are real ones.
import { describe, expect, it } from 'vitest';
import geometryJson from './data/geometry.json';
import bundledCsv from './data/assignments.csv?raw';
import {
  checkAssignmentsCsv,
  checkRoomEdit,
  compareAssignments,
  filterRoomRows,
  missingColumnsMessage,
  parseAssignmentsCsv,
  roomRows,
} from './assignments.ts';
import type { Assignment, Geometry } from './types.ts';

const geometry = geometryJson as unknown as Geometry;
const header = 'room_id,name,subject,teacher,type';
const csv = (...rows: string[]) => [header, ...rows].join('\n');

const room = (roomId: string, name: string, change: Partial<Assignment> = {}): Assignment => ({
  roomId,
  name,
  subject: '',
  teacher: '',
  type: 'classroom',
  ...change,
});

describe('checkAssignmentsCsv', () => {
  it('accepts the bundled file from the floor plan as it is', () => {
    const result = checkAssignmentsCsv(bundledCsv, geometry);
    expect(result.errors).toEqual([]);
    expect(result.assignments).toHaveLength(parseAssignmentsCsv(bundledCsv).assignments.length);
  });

  it('reads rows with their file line numbers (the header is line 1)', () => {
    const result = checkAssignmentsCsv(
      csv('G-R030,PYP3 B,Grade 3,Teacher A,classroom', '', 'G-R008,"Design, Tech",,,LAB'),
      geometry,
    );
    expect(result.errors).toEqual([]);
    expect(result.lines).toEqual([2, 4]);
    expect(result.assignments[1]).toEqual(room('G-R008', 'Design, Tech', { type: 'lab' }));
  });

  it('accepts "class" for the subject column, in any column order', () => {
    const result = checkAssignmentsCsv(
      'type,teacher,class,name,room_id\nlab,Teacher B,Chemistry,Lab A,G-R008',
      geometry,
    );
    expect(result.assignments[0]).toMatchObject({ subject: 'Chemistry', teacher: 'Teacher B' });
  });

  it('needs all five columns', () => {
    expect(checkAssignmentsCsv('room_id,name\nG-R030,PYP3 B', geometry).errors).toEqual([
      missingColumnsMessage,
    ]);
    expect(missingColumnsMessage).toBe(
      'The file needs these columns: room_id, name, subject, teacher, type.',
    );
  });

  it('lists every problem with the row it is on', () => {
    const lines = [
      'G-R030,PYP3 B,,,classroom', // 2
      'G-R999,Nowhere,,,classroom', // 3
      'G-R008,Lab,,,labb', // 4
      'G-R030,Again,,,classroom', // 5
      'G-R031,pyp3 b,,,classroom', // 6
      ',No room,,,', // 7
    ];
    expect(checkAssignmentsCsv(csv(...lines), geometry).errors).toEqual([
      'Row 3: "G-R999" is not a room on the map.',
      'Row 4: "labb" is not a room type. Use one of: classroom, lab, office, hall, library, cafeteria, toilet, prayer, store, other.',
      'Row 5: G-R030 already appears on row 2.',
      'Two rooms can\'t share a name: "pyp3 b" is already used by G-R030.',
      'Row 7: the room_id is empty.',
    ]);
  });

  it('allows a row with no name (that room becomes unnamed), and an empty type means "other"', () => {
    const result = checkAssignmentsCsv(csv('G-R030,,,,', 'G-R031,,,,'), geometry);
    expect(result.errors).toEqual([]);
    expect(result.assignments.map((a) => a.type)).toEqual(['other', 'other']);
  });

  it('ignores the invisible mark some spreadsheets put at the start of a file', () => {
    const marked = String.fromCharCode(0xfeff) + csv('G-R030,PYP3 B,,,classroom');
    expect(checkAssignmentsCsv(marked, geometry).errors).toEqual([]);
  });

  it('calls an empty file empty', () => {
    expect(checkAssignmentsCsv('\n\n', geometry).errors).toEqual(['The file is empty.']);
  });
});

describe('compareAssignments', () => {
  it('counts added, changed and removed named rooms', () => {
    const before = [room('A', 'One'), room('B', 'Two'), room('C', 'Three'), room('D', '')];
    const after = [
      room('A', 'One'),
      room('B', 'Two', { teacher: 'Teacher A' }),
      room('D', 'Four'),
      room('C', ''),
    ];
    expect(compareAssignments(before, after)).toEqual({
      added: ['D'],
      changed: ['B'],
      removed: ['C'],
    });
  });
});

describe('checkRoomEdit', () => {
  const list = [room('1-R003', 'Art'), room('G-R030', 'PYP3 B')];

  it('refuses a name another room already has, ignoring capitals', () => {
    expect(checkRoomEdit(list, 'G-R030', ' art ')).toBe(
      'Two rooms can\'t share a name: "art" is already used by 1-R003.',
    );
  });

  it('allows keeping its own name, and clearing it', () => {
    expect(checkRoomEdit(list, '1-R003', 'ART')).toBeNull();
    expect(checkRoomEdit(list, '1-R003', '')).toBeNull();
  });

  it('refuses a name that is too long', () => {
    expect(checkRoomEdit(list, 'G-R030', 'x'.repeat(81))).toBe('Use 80 characters or fewer.');
  });
});

describe('room table', () => {
  const rows = roomRows(geometry, [room('G-R030', 'PYP3 B', { teacher: 'Teacher A' })]);

  it('has a row for every room, place and entrance, floors in order', () => {
    expect(rows.filter((row) => row.kind === 'place')).toHaveLength(geometry.places.length);
    expect(rows.filter((row) => row.kind === 'entrance')).toHaveLength(
      geometry.doors.filter((door) => door.b === 'outside').length,
    );
    expect(rows[0].floor).toBe('G');
    expect(rows[rows.length - 1].floor).toBe('3');
  });

  it('filters by named, unnamed and floor, and searches names, teachers and ids', () => {
    expect(filterRoomRows(rows, '', 'named').map((row) => row.id)).toEqual(['G-R030']);
    expect(filterRoomRows(rows, '', 'unnamed')).toHaveLength(rows.length - 1);
    expect(filterRoomRows(rows, '', 'floor:3').every((row) => row.floor === '3')).toBe(true);
    expect(filterRoomRows(rows, 'teacher a', 'all').map((row) => row.id)).toEqual(['G-R030']);
    expect(filterRoomRows(rows, 'g-r030', 'unnamed')).toEqual([]);
  });
});
