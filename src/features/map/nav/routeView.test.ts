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
  detourNotice,
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

  it('ignores spaces, dots and capitals, the way people type names', () => {
    expect(searchDestinations(destinations, 'kg2b')[0].name).toBe('KG2 B');
    expect(searchDestinations(destinations, 'pyp 3b')[0].name).toBe('PYP3 B');
    expect(searchDestinations(destinations, 'Asst MSO')[0].name).toBe('Asst. MSO');
  });

  it('takes the words in any order, and forgives one slip in a longer word', () => {
    expect(searchDestinations(destinations, 'lab chem').map((d) => d.name)).toContain('Chem Lab');
    expect(searchDestinations(destinations, 'auditorim')[0].name).toBe('Auditorium');
    expect(searchDestinations(destinations, 'libary').map((d) => d.name)).toContain(
      'Senior Library',
    );
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

describe('detour notices (real router, fixture lift and stairs)', () => {
  const stairsSpot = { x: 1221, y: 978 };
  const stairs: Connector = {
    id: 'fixture-stairs',
    type: 'stairs',
    name: 'West stairs',
    floors: ['G', '1', '2', '3'],
    positions: { G: stairsSpot, 1: stairsSpot, 2: stairsSpot, 3: stairsSpot },
    accessible: false,
    available: true,
  };
  const lift2: Connector = { ...lift, name: 'Lift A' };
  const ideal = createRouter(geometry, [lift2, stairs]);
  const real = createRouter(geometry, [lift2, stairs]);
  const trip = (router: typeof real, mode: 'standard' | 'step-free') =>
    router.route({ type: 'room', id: 'G-R030' }, { type: 'room', id: '3-R043' }, { mode });

  it('says nothing when everything is in service', () => {
    expect(
      detourNotice(trip(real, 'standard'), trip(ideal, 'standard'), [lift2, stairs], false),
    ).toBeNull();
  });

  it('reroutes by the lift when the stairs are out of order, and says why', () => {
    const now = [lift2, { ...stairs, available: false }];
    real.setConnectors(now);
    const result = trip(real, 'standard');
    expect(result.ok && result.connectors).toEqual(['fixture-lift']);
    expect(detourNotice(result, trip(ideal, 'standard'), now, false)).toEqual({
      text: 'West stairs is out of order, so this route goes another way.',
      short: 'West stairs is out of order.',
    });
  });

  it('explains a missing step-free route when the lift is out of order', () => {
    const now = [{ ...lift2, available: false }, stairs];
    real.setConnectors(now);
    const result = trip(real, 'step-free');
    expect(result.ok ? 'ok' : result.code).toBe('no-step-free-route');
    expect(detourNotice(result, trip(ideal, 'step-free'), now, false)?.text).toBe(
      'No step-free route right now: Lift A is out of order.',
    );
  });

  it('blames a closed door only when the route got longer', () => {
    const short = { ...(trip(ideal, 'standard') as RouteOk) };
    const long = { ...short, distanceM: short.distanceM + 20 };
    expect(detourNotice(long, short, [], true)?.text).toBe(
      'A door on the usual way is closed, so this route is longer.',
    );
    expect(detourNotice(short, short, [], true)).toBeNull();
  });
});
