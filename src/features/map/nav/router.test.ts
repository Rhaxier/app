// Tests for the routing engine and connector linking.
//
// Most tests use a tiny hand-made building so the expected numbers are easy to
// check by hand. All stairs and lifts here are TEST FIXTURES: the real
// connectors.json stays empty until an admin places them in the app.
//
// The fixture building, the same on floors G, 1 and 2 (1 unit = 0.1 m):
//
//        room A        room B
//       (x=100)       (x=200)
//          |             |
//   c0 --- c1 --- c2 --- c3 --- c4      one corridor along y = 50
//   x=0   100    200    300    400
//
// Fixture stairs stand at c0 (west end), the fixture lift at c4 (east end).

import { describe, expect, it } from 'vitest';
import { indexGeometry, linkConnectors } from './graph.ts';
import { createRouter } from './router.ts';
import type { RouteOk, RouteResult } from './router.ts';
import type { Connector, Geometry, NavEdge, NavNode, Region } from './types.ts';
import { validateMap } from './validate.ts';
import realGeometryText from './data/geometry.json?raw';
import realConnectorsText from './data/connectors.json?raw';

const FLOORS = ['G', '1', '2'];

function fixtureGeometry(): Geometry {
  const regions: Region[] = [];
  const nodes: NavNode[] = [];
  const edges: NavEdge[] = [];
  const doors: Geometry['doors'] = [];
  const box = (x0: number, y0: number, x1: number, y1: number): [number, number][] => [
    [x0, y0],
    [x1, y0],
    [x1, y1],
    [x0, y1],
  ];
  for (const f of FLOORS) {
    regions.push({
      id: `${f}-COR`,
      floor: f,
      kind: 'corridor',
      polygon: box(0, 30, 400, 70),
      labelAt: [200, 50],
    });
    for (let i = 0; i <= 4; i += 1) {
      nodes.push({
        id: `${f}-c${i}`,
        floor: f,
        x: i * 100,
        y: 50,
        kind: 'corridor',
        region: `${f}-COR`,
      });
      if (i > 0) {
        edges.push({
          id: `${f}-e${i}`,
          a: `${f}-c${i - 1}`,
          b: `${f}-c${i}`,
          length: 100,
          kind: 'walk',
        });
      }
    }
    for (const [name, x, corridorNode] of [
      ['A', 100, 'c1'],
      ['B', 200, 'c2'],
    ] as const) {
      const id = `${f}-${name}`;
      regions.push({
        id,
        floor: f,
        kind: 'room',
        polygon: box(x - 40, 0, x + 40, 30),
        labelAt: [x, 15],
        sourceLabel: `Room ${name}${f}`,
      });
      doors.push({ id: `${id}-door`, floor: f, x, y: 30, kind: 'door', a: id, b: `${f}-COR` });
      nodes.push({ id: `${id}-n`, floor: f, x, y: 15, kind: 'room', region: id });
      nodes.push({
        id: `${id}-dn`,
        floor: f,
        x,
        y: 30,
        kind: 'door',
        region: id,
        door: `${id}-door`,
      });
      edges.push({
        id: `${id}-in`,
        a: `${id}-n`,
        b: `${id}-dn`,
        length: 15,
        kind: 'walk',
        door: `${id}-door`,
      });
      edges.push({
        id: `${id}-out`,
        a: `${id}-dn`,
        b: `${f}-${corridorNode}`,
        length: 20,
        kind: 'walk',
        door: `${id}-door`,
      });
    }
  }
  // A room on the ground floor that no door leads to.
  regions.push({
    id: 'G-X',
    floor: 'G',
    kind: 'room',
    polygon: box(160, 80, 240, 110),
    labelAt: [200, 95],
    sourceLabel: 'Sealed room',
  });
  nodes.push({ id: 'G-X-n', floor: 'G', x: 200, y: 95, kind: 'room', region: 'G-X' });
  // A named place in the corridor on the ground floor.
  nodes.push({
    id: 'G-P1-n',
    floor: 'G',
    x: 350,
    y: 60,
    kind: 'place',
    region: 'G-COR',
    place: 'G-P1',
  });
  edges.push({ id: 'G-P1-e', a: 'G-P1-n', b: 'G-c3', length: Math.hypot(50, 10), kind: 'walk' });
  return {
    version: 1,
    metresPerUnit: 0.1,
    bounds: { minX: 0, minY: 0, maxX: 400, maxY: 110 },
    floors: [
      { id: 'G', name: 'Ground Floor', level: 0 },
      { id: '1', name: 'First Floor', level: 1 },
      { id: '2', name: 'Second Floor', level: 2 },
    ],
    regions,
    places: [{ id: 'G-P1', floor: 'G', x: 350, y: 60, region: 'G-COR', sourceLabel: 'Lounge' }],
    doors,
    nodes,
    edges,
  };
}

function fixtureConnector(
  id: string,
  type: 'stairs' | 'lift',
  x: number,
  floors = FLOORS,
): Connector {
  const positions: Connector['positions'] = {};
  for (const floor of floors) {
    positions[floor] = { x, y: 50 };
  }
  return { id, type, name: id, floors, positions, accessible: type === 'lift', available: true };
}

const WEST_STAIRS = fixtureConnector('West stairs', 'stairs', 0);
const EAST_LIFT = fixtureConnector('East lift', 'lift', 400);

const room = (id: string) => ({ type: 'room' as const, id });

function expectOk(result: RouteResult): RouteOk {
  if (!result.ok) {
    throw new Error(`expected a route, got: ${result.message}`);
  }
  return result;
}

describe('router on the fixture building', () => {
  it('routes between two rooms on the same floor with readable steps', () => {
    const router = createRouter(fixtureGeometry());
    const route = expectOk(router.route(room('G-A'), room('G-B')));
    // 1.5 m out of A, 2 m to the corridor, 10 m along it, 2 m + 1.5 m into B.
    expect(route.distanceM).toBe(17);
    expect(route.legs).toHaveLength(1);
    expect(route.legs[0].floor).toBe('G');
    // The 2 m hop from the door to the corridor is shorter than SHORT_JOG_M,
    // so the spoken steps fold it away instead of saying "Walk 2 m, turn left".
    expect(route.steps.map((step) => step.text)).toEqual([
      'Leave Room AG',
      'Walk 10 m',
      'Your destination, Room BG, is on the left',
    ]);
    expect(route.durationS).toBeGreaterThan(0);
  });

  it('routes across floors and names the connector and the floor', () => {
    const router = createRouter(fixtureGeometry(), [WEST_STAIRS, EAST_LIFT]);
    const route = expectOk(router.route(room('G-A'), room('2-B')));
    expect(route.legs.map((leg) => leg.floor)).toEqual(['G', '2']);
    expect(route.connectors).toEqual(['West stairs']);
    const texts = route.steps.map((step) => step.text);
    expect(texts).toContain('Walk 10 m to the stairs (West stairs)');
    expect(texts).toContain('Take the stairs up to Second Floor');
  });

  it('uses stairs in standard mode but the lift in step-free mode', () => {
    const router = createRouter(fixtureGeometry(), [WEST_STAIRS, EAST_LIFT]);
    const standard = expectOk(router.route(room('G-A'), room('1-B')));
    const stepFree = expectOk(router.route(room('G-A'), room('1-B'), { mode: 'step-free' }));
    expect(standard.connectors).toEqual(['West stairs']);
    expect(stepFree.connectors).toEqual(['East lift']);
    expect(stepFree.steps.some((step) => step.kind === 'stairs')).toBe(false);
    expect(stepFree.steps.map((step) => step.text)).toContain('Take the lift up to First Floor');
    // The lift is at the far end, so the step-free route is longer.
    expect(stepFree.distanceM).toBeGreaterThan(standard.distanceM);
  });

  it('reroutes around an unavailable lift, or says clearly when there is no other', () => {
    const brokenLift = { ...EAST_LIFT, available: false };
    const middleLift = fixtureConnector('Middle lift', 'lift', 300);
    const router = createRouter(fixtureGeometry(), [WEST_STAIRS, brokenLift, middleLift]);
    expect(
      expectOk(router.route(room('G-A'), room('1-B'), { mode: 'step-free' })).connectors,
    ).toEqual(['Middle lift']);

    router.setConnectors([WEST_STAIRS, brokenLift]);
    const none = router.route(room('G-A'), room('1-B'), { mode: 'step-free' });
    expect(none).toMatchObject({
      ok: false,
      code: 'no-step-free-route',
      message: 'No step-free route to this room right now.',
    });
    // People who can use stairs still get a route.
    expect(router.route(room('G-A'), room('1-B')).ok).toBe(true);
  });

  it('reports a room that cannot be reached', () => {
    const router = createRouter(fixtureGeometry());
    expect(router.route(room('G-A'), room('G-X'))).toMatchObject({
      ok: false,
      code: 'unreachable',
    });
    expect(router.route(room('G-A'), room('nope'))).toMatchObject({
      ok: false,
      code: 'unknown-destination',
    });
  });

  it('starts from a point between nodes by snapping to the corridor', () => {
    const router = createRouter(fixtureGeometry());
    // 0.5 m to the centre-line, 5 m along it to c2, then 3.5 m into room B.
    const route = expectOk(router.route({ type: 'point', floor: 'G', x: 150, y: 55 }, room('G-B')));
    expect(route.distanceM).toBe(9);
    expect(route.legs[0].points[0]).toEqual({ x: 150, y: 55 });
    expect(route.legs[0].points[1]).toEqual({ x: 150, y: 50 });
    expect(route.steps[0].text).toBe('Start from your spot on the map');

    // Two points on the same stretch of corridor walk straight to each other.
    const short = expectOk(
      router.route(
        { type: 'point', floor: 'G', x: 120, y: 60 },
        { type: 'point', floor: 'G', x: 180, y: 40 },
      ),
    );
    expect(short.distanceM).toBe(8);

    const outside = router.route({ type: 'point', floor: 'G', x: 900, y: 900 }, room('G-B'));
    expect(outside).toMatchObject({ ok: false, code: 'start-not-walkable' });
  });

  it('routes to a named place that has no walls', () => {
    const router = createRouter(fixtureGeometry());
    const route = expectOk(router.route(room('G-A'), { type: 'place', id: 'G-P1' }));
    expect(route.steps.at(-1)?.text).toBe('You have arrived at Lounge');
  });

  it('explains that floors are not connected when there are no connectors', () => {
    const router = createRouter(fixtureGeometry(), []);
    const result = router.route(room('G-A'), room('1-B'));
    expect(result).toMatchObject({
      ok: false,
      code: 'floors-not-connected',
      message: "These floors aren't connected yet: an admin needs to add stairs or a lift.",
    });
    // Same-floor routes still work.
    expect(router.route(room('1-A'), room('1-B')).ok).toBe(true);
  });

  it('opens a step-free route as soon as a lift is placed', () => {
    const router = createRouter(fixtureGeometry(), [WEST_STAIRS]);
    expect(router.route(room('G-A'), room('1-B'), { mode: 'step-free' })).toMatchObject({
      ok: false,
      code: 'no-step-free-route',
    });
    router.setConnectors([WEST_STAIRS, EAST_LIFT]);
    expect(
      expectOk(router.route(room('G-A'), room('1-B'), { mode: 'step-free' })).connectors,
    ).toEqual(['East lift']);
  });

  it('fails step-free routes with a clear error when the only lift is deleted', () => {
    const router = createRouter(fixtureGeometry(), [WEST_STAIRS, EAST_LIFT]);
    expect(router.route(room('G-A'), room('1-B'), { mode: 'step-free' }).ok).toBe(true);
    router.setConnectors([WEST_STAIRS]);
    const result = router.route(room('G-A'), room('1-B'), { mode: 'step-free' });
    expect(result).toMatchObject({
      ok: false,
      message: 'No step-free route to this room right now.',
    });
  });

  it('changes the route when a staircase is moved', () => {
    const router = createRouter(fixtureGeometry(), [WEST_STAIRS]);
    const before = expectOk(router.route(room('G-A'), room('1-B')));
    router.setConnectors([fixtureConnector('West stairs', 'stairs', 400)]);
    const after = expectOk(router.route(room('G-A'), room('1-B')));
    expect(before.distanceM).toBe(37);
    expect(after.distanceM).toBe(57);
    expect(before.legs[0].points.at(-1)).toEqual({ x: 0, y: 50 });
    expect(after.legs[0].points.at(-1)).toEqual({ x: 400, y: 50 });
  });

  it('reroutes or reports "blocked" when a door is closed', () => {
    const router = createRouter(fixtureGeometry());
    router.setOverrides({ doorAvailable: { 'G-B-door': false }, edgeTags: {} });
    expect(router.route(room('G-A'), room('G-B'))).toMatchObject({ ok: false, code: 'blocked' });
    router.setOverrides({ doorAvailable: {}, edgeTags: {} });
    expect(router.route(room('G-A'), room('G-B')).ok).toBe(true);
  });

  it('keeps step-free routes off edges tagged as steps', () => {
    const router = createRouter(fixtureGeometry());
    router.setOverrides({ doorAvailable: {}, edgeTags: { 'G-e2': ['steps'] } });
    expect(router.route(room('G-A'), room('G-B')).ok).toBe(true);
    expect(router.route(room('G-A'), room('G-B'), { mode: 'step-free' })).toMatchObject({
      ok: false,
      code: 'no-step-free-route',
    });
  });
});

describe('linking connectors on the fixture building', () => {
  const index = indexGeometry(fixtureGeometry());

  it('snaps a connector to the corridor and links its floors', () => {
    const offCentre = {
      ...WEST_STAIRS,
      positions: { G: { x: 50, y: 65 }, '1': { x: 50, y: 65 }, '2': { x: 50, y: 65 } },
    };
    const link = linkConnectors(index, [offCentre]);
    expect(link.problems.filter((problem) => problem.severity === 'error')).toEqual([]);
    expect(link.stops).toHaveLength(3);
    expect(link.stops[0].snap.point).toEqual({ x: 50, y: 50 });
    expect(link.stops[0].nextTo).toContain('G-COR');
    expect(link.edges.filter((edge) => edge.kind === 'stairs')).toHaveLength(2);
  });

  it('gives the same result every time', () => {
    const first = linkConnectors(index, [EAST_LIFT, WEST_STAIRS]);
    const second = linkConnectors(index, [WEST_STAIRS, EAST_LIFT]);
    expect(second.edges).toEqual(first.edges);
    expect(second.nodes).toEqual(first.nodes);
  });

  it('reports a connector outside any walkable area and a missing floor position', () => {
    const outside = {
      ...WEST_STAIRS,
      positions: { ...WEST_STAIRS.positions, '1': { x: 900, y: 900 } },
    };
    const missing = { ...EAST_LIFT, positions: { ...EAST_LIFT.positions, '2': undefined } };
    const codes = linkConnectors(index, [outside, missing]).problems.map(
      (problem) => `${problem.connector ?? problem.floor}:${problem.code}`,
    );
    expect(codes).toContain('West stairs:connector-outside-walkable');
    expect(codes).toContain('East lift:connector-missing-floor');
  });

  it('warns about floors with no connector and errors when floors stay split', () => {
    const none = linkConnectors(index, []);
    expect(none.problems.filter((problem) => problem.code === 'floor-not-connected')).toHaveLength(
      3,
    );
    expect(none.problems.every((problem) => problem.severity === 'warning')).toBe(true);

    const lower = fixtureConnector('Lower stairs', 'stairs', 0, ['G', '1']);
    const lonely = fixtureConnector('Top lift', 'lift', 400, ['2']);
    const split = linkConnectors(index, [lower, lonely]).problems.map((problem) => problem.code);
    expect(split).toContain('floors-split');
    expect(split).toContain('connector-single-floor');
  });
});

describe('the real school map', () => {
  const geometry = JSON.parse(realGeometryText) as Geometry;
  const firstRoomOn = (floor: string, label: string) =>
    geometry.regions.find((region) => region.floor === floor && region.sourceLabel === label)
      ?.id as string;

  it('has no stairs or lifts in the real data', () => {
    expect(JSON.parse(realConnectorsText)).toEqual([]);
  });

  it('passes validation with only "not connected yet" warnings', () => {
    const result = validateMap(geometry, []);
    expect(result.errors).toEqual([]);
    expect(result.warnings.map((warning) => warning.code)).toEqual([
      'floor-not-connected',
      'floor-not-connected',
      'floor-not-connected',
      'floor-not-connected',
    ]);
  });

  it('routes between real rooms on one floor, and across floors with a fixture staircase', () => {
    const router = createRouter(geometry);
    const sameFloor = expectOk(
      router.route(room(firstRoomOn('G', 'PYP3 B')), room(firstRoomOn('G', 'KG1 A'))),
    );
    expect(sameFloor.distanceM).toBeGreaterThan(50);
    // A real corridor route has corners, so the steps must include real turns.
    expect(sameFloor.steps.some((step) => /^Turn (left|right)$/.test(step.text))).toBe(true);
    expect(
      router.route(room(firstRoomOn('G', 'PYP3 B')), room(firstRoomOn('3', '12 B'))),
    ).toMatchObject({ ok: false, code: 'floors-not-connected' });

    // TEST FIXTURE: a staircase at hint S3 from MAP_NOTES.md (the stair box by PYP3 C, floors G-3).
    const stairs: Connector = {
      id: 'fixture-s3',
      type: 'stairs',
      name: 'Fixture stairs',
      floors: ['G', '1', '2', '3'],
      positions: {},
      accessible: false,
      available: true,
    };
    for (const floor of stairs.floors) {
      stairs.positions[floor] = { x: 1221, y: 975 };
    }
    router.setConnectors([stairs]);
    expect(router.problems().filter((problem) => problem.severity === 'error')).toEqual([]);
    const up = expectOk(
      router.route(room(firstRoomOn('G', 'PYP3 B')), room(firstRoomOn('3', '12 B'))),
    );
    expect(up.legs.map((leg) => leg.floor)).toEqual(['G', '3']);
    expect(up.steps.map((step) => step.text)).toContain('Take the stairs up to Third Floor');
  });
});
