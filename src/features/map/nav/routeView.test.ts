// The student map's helpers: search ranking, how a route is shown floor by
// floor, line width by zoom, the numbers in words, and the "I'm here" snap.
// Real traced map; the lift is a test fixture (nothing is saved).
import { describe, expect, it } from 'vitest';
import bundledCsv from './data/assignments.csv?raw';
import geometryJson from './data/geometry.json';
import { parseAssignmentsCsv, searchableDestinations } from './assignments.ts';
import { indexGeometry } from './graph.ts';
import { createRouter, ROUTE_MESSAGES, type RouteOk } from './router.ts';
import {
  floorChanges,
  formatDistance,
  formatDuration,
  legsOnFloor,
  routeLineWeight,
  startFloor,
} from './routeView.ts';
import { searchDestinations } from './search.ts';
import { snapStart } from './startPoint.ts';
import type { Connector, Geometry } from './types.ts';

const geometry = geometryJson as unknown as Geometry;
const destinations = searchableDestinations(geometry, parseAssignmentsCsv(bundledCsv).assignments);
const liftSpot = { x: 1569, y: 1169 };
const lift: Connector = {
  id: 'fixture-lift',
  type: 'lift',
  name: 'Fixture lift',
  floors: ['G', '1', '2', '3'],
  positions: { G: liftSpot, 1: liftSpot, 2: liftSpot, 3: liftSpot },
  accessible: true,
  available: true,
};

describe('searchDestinations', () => {
  it('puts names that start with the text first, then words, then anything else', () => {
    const names = searchDestinations(destinations, 'lab').map((d) => d.name);
    expect(names.length).toBeGreaterThan(0);
    expect(names.length).toBeLessThanOrEqual(8);
    expect(names.every((name) => /lab/i.test(name))).toBe(true);
    expect(searchDestinations(destinations, '12 b')[0].name).toBe('12 B');
  });

  it('returns nothing for an empty box, and only named places', () => {
    expect(searchDestinations(destinations, '  ')).toEqual([]);
    expect(searchDestinations(destinations, 'zzz')).toEqual([]);
  });
});

describe('a route between floors', () => {
  const router = createRouter(geometry, [lift]);
  const result = router.route(
    { type: 'room', id: 'G-R030' },
    { type: 'room', id: '3-R043' },
    {
      mode: 'step-free',
    },
  ) as RouteOk;

  it('routes by the lift', () => {
    expect(result.ok).toBe(true);
    expect(result.connectors).toEqual(['fixture-lift']);
  });

  it('starts on the ground floor and has one change of floor, at the lift', () => {
    expect(startFloor(result)).toBe('G');
    const changes = floorChanges(result);
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({ fromFloor: 'G', toFloor: '3', connector: 'fixture-lift' });
    expect(changes[0].text).toBe('Take the lift up to Third Floor');
    expect(Math.hypot(changes[0].at.x - liftSpot.x, changes[0].at.y - liftSpot.y)).toBeLessThan(60);
  });

  it('has a line to draw on the start and end floors only', () => {
    expect(legsOnFloor(result, 'G')).toHaveLength(1);
    expect(legsOnFloor(result, '3')).toHaveLength(1);
    expect(legsOnFloor(result, '1')).toHaveLength(0);
  });
});

describe('numbers and widths', () => {
  it('words distances and times the way a student reads them', () => {
    expect(formatDistance(3.4)).toBe('3 m');
    expect(formatDistance(77)).toBe('75 m');
    expect(formatDuration(40)).toBe('under a minute');
    expect(formatDuration(150)).toBe('about 3 min');
  });

  it('draws the line bolder as you zoom in, within limits', () => {
    expect(routeLineWeight(-4)).toBe(3);
    expect(routeLineWeight(0)).toBeGreaterThan(routeLineWeight(-2));
    expect(routeLineWeight(2)).toBe(14);
  });
});

describe('snapStart', () => {
  const index = indexGeometry(geometry);

  it('snaps a tap near a corridor onto it', () => {
    const snap = snapStart(index, 'G', { x: 1569, y: 1169 });
    expect(snap.ok).toBe(true);
    if (snap.ok) expect(snap.end).toMatchObject({ type: 'point', floor: 'G' });
  });

  it('refuses a tap outside the building with the router’s message', () => {
    expect(snapStart(index, 'G', { x: 5, y: 5 })).toEqual({
      ok: false,
      message: ROUTE_MESSAGES['start-not-walkable'],
    });
  });
});
