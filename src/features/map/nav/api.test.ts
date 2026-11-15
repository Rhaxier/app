// The mappers between database rows and the router's types, and the shape of
// what the RPCs are sent. (The RPCs themselves are tested in pgTAP:
// supabase/tests/19_map_nav_test.sql.)
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabase', () => ({ supabase: {} }));

import {
  assignmentFromRow,
  assignmentsToJson,
  connectorFromRow,
  connectorsToJson,
  overridesFromRows,
  type AssignmentRow,
  type ConnectorRow,
  type OverrideRow,
} from './api.ts';
import type { Connector } from './types.ts';

const stamp = { created_at: '', updated_at: '' };

function connectorRow(change: Partial<ConnectorRow>): ConnectorRow {
  return {
    id: 'c1',
    type: 'lift',
    name: 'Lift A',
    floors: ['G', '1'],
    positions: { G: { x: 10, y: 20 }, 1: { x: 11, y: 21 } },
    accessible: true,
    available: true,
    ...stamp,
    ...change,
  };
}

describe('connectorFromRow', () => {
  it('keeps the floors and positions as the router expects them', () => {
    expect(connectorFromRow(connectorRow({}))).toEqual<Connector>({
      id: 'c1',
      type: 'lift',
      name: 'Lift A',
      floors: ['G', '1'],
      positions: { G: { x: 10, y: 20 }, 1: { x: 11, y: 21 } },
      accessible: true,
      available: true,
    });
  });

  it('treats a missing or broken position as "not set", so validation can say so', () => {
    const connector = connectorFromRow(
      connectorRow({ floors: ['G', '1', '2'], positions: { G: { x: 1, y: 2 }, 1: { x: 'a' } } }),
    );
    expect(connector.positions).toEqual({ G: { x: 1, y: 2 }, 1: undefined, 2: undefined });
  });
});

describe('connectorsToJson', () => {
  it('sends only the positions of floors the connector serves', () => {
    const connector: Connector = {
      id: 'c1',
      type: 'stairs',
      name: 'West stairs',
      floors: ['G'],
      positions: { G: { x: 1, y: 2 }, 1: { x: 3, y: 4 } },
      accessible: false,
      available: true,
    };
    expect(connectorsToJson([connector])).toEqual([
      {
        id: 'c1',
        type: 'stairs',
        name: 'West stairs',
        floors: ['G'],
        positions: { G: { x: 1, y: 2 } },
        accessible: false,
        available: true,
      },
    ]);
  });
});

describe('overridesFromRows', () => {
  const row = (change: Partial<OverrideRow>): OverrideRow => ({
    id: 'o',
    kind: 'door',
    target_id: 'G-D001',
    available: true,
    tags: [],
    ...stamp,
    ...change,
  });

  it('turns door rows into doorAvailable and edge rows into edgeTags', () => {
    expect(
      overridesFromRows([
        row({ target_id: 'G-D089', available: false }),
        row({ target_id: 'G-D090', available: true }),
        row({ kind: 'edge', target_id: 'G-E0001', tags: ['steps', 'unknown'] }),
        row({ kind: 'edge', target_id: 'G-E0002', tags: [] }),
      ]),
    ).toEqual({
      doorAvailable: { 'G-D089': false, 'G-D090': true },
      edgeTags: { 'G-E0001': ['steps'] },
    });
  });
});

describe('assignments', () => {
  it('maps a row to an Assignment, with an unknown type read as "other"', () => {
    const row: AssignmentRow = {
      id: 'a',
      preset_id: 'p',
      region_id: 'G-R030',
      name: 'PYP3 B',
      subject: 'Grade 3',
      teacher: 'Teacher A',
      type: 'classroom',
      ...stamp,
    };
    expect(assignmentFromRow(row)).toEqual({
      roomId: 'G-R030',
      name: 'PYP3 B',
      subject: 'Grade 3',
      teacher: 'Teacher A',
      type: 'classroom',
    });
    expect(assignmentFromRow({ ...row, type: 'mystery' as never }).type).toBe('other');
  });

  it('sends the CSV line numbers when given, for the error messages', () => {
    const list = [
      { roomId: 'G-R030', name: 'PYP3 B', subject: '', teacher: '', type: 'classroom' as const },
    ];
    expect(assignmentsToJson(list, [14])).toEqual([
      { room_id: 'G-R030', name: 'PYP3 B', subject: '', teacher: '', type: 'classroom', row: 14 },
    ]);
    expect(assignmentsToJson(list)).toEqual([
      { room_id: 'G-R030', name: 'PYP3 B', subject: '', teacher: '', type: 'classroom' },
    ]);
  });
});
