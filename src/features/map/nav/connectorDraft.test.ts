// The stairs and lifts editor's draft functions, on the real traced map.
// Every connector here is a test fixture: nothing is saved anywhere.
import { describe, expect, it } from 'vitest';
import geometryJson from './data/geometry.json';
import {
  checkDraft,
  connectivitySummary,
  isDirty,
  moveConnector,
  newConnector,
  nextConnectorName,
  removeConnector,
  renameConnector,
  setFloorsServed,
} from './connectorDraft.ts';
import { indexGeometry } from './graph.ts';
import type { Connector, Geometry } from './types.ts';

const geometry = geometryJson as unknown as Geometry;
const index = indexGeometry(geometry);
// The "Lifts" cells west of the auditorium (MAP_NOTES, "Hint for the lift").
const liftSpot = { x: 1569, y: 1169 };

const lift = (floors: string[], change: Partial<Connector> = {}): Connector => ({
  id: 'lift-1',
  type: 'lift',
  name: 'Test lift',
  floors,
  positions: Object.fromEntries(floors.map((floor) => [floor, { ...liftSpot }])),
  accessible: true,
  available: true,
  ...change,
});

describe('new connectors', () => {
  it('are named "Stairs 1", "Lift 1" and so on, skipping names in use', () => {
    expect(nextConnectorName('stairs', [])).toBe('Stairs 1');
    const list = [lift(['G'], { name: 'Lift 1' }), lift(['G'], { id: 'x', name: 'lift 2' })];
    expect(nextConnectorName('lift', list)).toBe('Lift 3');
    expect(nextConnectorName('stairs', list)).toBe('Stairs 1');
  });

  it('start on the floor where they were placed; lifts are step-free, stairs are not', () => {
    const stairs = newConnector('stairs', '1', { x: 1597.4, y: 666.6 }, []);
    expect(stairs).toMatchObject({
      type: 'stairs',
      floors: ['1'],
      positions: { 1: { x: 1597, y: 667 } },
      accessible: false,
      available: true,
    });
    expect(newConnector('lift', 'G', liftSpot, []).accessible).toBe(true);
  });
});

describe('editing', () => {
  it('ticking more floors copies the nearest placed floor, by level', () => {
    let list = [lift(['G'])];
    list = moveConnector(list, 'lift-1', 'G', { x: 1600, y: 1200 });
    list = setFloorsServed(list, 'lift-1', ['3', 'G', '1'], geometry);
    expect(list[0].floors).toEqual(['G', '1', '3']);
    expect(list[0].positions['1']).toEqual({ x: 1600, y: 1200 });
    expect(list[0].positions['3']).toEqual({ x: 1600, y: 1200 });
  });

  it('unticking a floor keeps its position in the draft, so ticking it again restores it', () => {
    let list = [lift(['G', '1'])];
    list = moveConnector(list, 'lift-1', '1', { x: 1500, y: 1100 });
    list = setFloorsServed(list, 'lift-1', ['G'], geometry);
    expect(list[0].floors).toEqual(['G']);
    list = setFloorsServed(list, 'lift-1', ['G', '1'], geometry);
    expect(list[0].positions['1']).toEqual({ x: 1500, y: 1100 });
  });

  it('knows when the draft differs from what is saved', () => {
    const saved = [lift(['G', '1'])];
    expect(isDirty([...saved], saved)).toBe(false);
    expect(isDirty(renameConnector(saved, 'lift-1', 'East lift'), saved)).toBe(true);
    expect(isDirty(removeConnector(saved, 'lift-1'), saved)).toBe(true);
    // A position kept for an unticked floor isn't saved, so it doesn't count.
    const extra = [{ ...saved[0], positions: { ...saved[0].positions, 3: { x: 1, y: 1 } } }];
    expect(isDirty(extra, saved)).toBe(false);
  });
});

describe('checking the draft', () => {
  it('with nothing placed: only warnings, and no floors connected', () => {
    const check = checkDraft(index, []);
    expect(check.hasErrors).toBe(false);
    expect(check.problems.every((p) => p.code === 'floor-not-connected')).toBe(true);
    expect(connectivitySummary(index, check.link).text).toBe(
      'No floors are connected yet: add stairs or a lift.',
    );
  });

  it('a lift at the hinted spot on all four floors connects them all', () => {
    const check = checkDraft(index, [lift(['G', '1', '2', '3'])]);
    expect(check.problems).toEqual([]);
    expect(connectivitySummary(index, check.link)).toEqual({
      connected: true,
      text: 'All four floors are connected.',
    });
  });

  it('says which floor is left out', () => {
    const check = checkDraft(index, [lift(['G', '1', '2'])]);
    expect(connectivitySummary(index, check.link).text).toBe(
      'Floor 3 is not connected to the others yet.',
    );
  });

  it('a marker outside any corridor or room is an error that blocks Save', () => {
    const list = moveConnector([lift(['G', '1'])], 'lift-1', 'G', { x: 5, y: 5 });
    const check = checkDraft(index, list);
    expect(check.hasErrors).toBe(true);
    expect(check.problems[0]).toMatchObject({
      code: 'connector-outside-walkable',
      connector: 'lift-1',
      floor: 'G',
    });
  });

  it('a floor ticked without a position is an error', () => {
    const check = checkDraft(index, [{ ...lift(['G']), floors: ['G', '2'] }]);
    expect(check.problems.map((p) => p.code)).toContain('connector-missing-floor');
  });

  it('names must be filled in and different', () => {
    const list = [
      lift(['G'], { name: ' ' }),
      lift(['1'], { id: 'b', name: 'Lift A' }),
      lift(['2'], { id: 'c', name: 'lift a' }),
    ];
    const codes = checkDraft(index, list).problems.map((p) => p.code);
    expect(codes).toContain('connector-no-name');
    expect(codes).toContain('connector-duplicate-name');
  });
});
