// The drawn route line: straight down corridors, parallel to their walls,
// square at the corners, and only off square where the walls leave no choice.
//
// The small cases use a made-up plan (1 unit = 0.1 m) so each rule can be seen
// on its own; the last ones run the real school plan.
import { describe, expect, it } from 'vitest';
import realConnectorsText from './data/connectors.json?raw';
import realGeometryText from './data/geometry.json?raw';
import realWallsText from './data/walls.json?raw';
import type { GeometryIndex, Segment } from './graph.ts';
import { createRouter } from './router.ts';
import { buildingAxes, shapeRoute } from './routeShape.ts';
import type { Connector, Geometry, Point, Region } from './types.ts';

const MPU = 0.1;

const box = (x0: number, y0: number, x1: number, y1: number): [number, number][] => [
  [x0, y0],
  [x1, y0],
  [x1, y1],
  [x0, y1],
];

/** A made-up floor: just what the line-drawing reads (regions, doors and walls). */
function floorPlan(
  regions: { id: string; kind: Region['kind']; polygon: [number, number][] }[],
  walls: number[][],
  doors: Point[] = [],
): GeometryIndex {
  const full: Region[] = regions.map((r) => ({ ...r, floor: 'G', labelAt: r.polygon[0] }));
  return {
    geometry: {
      walls: { G: walls },
      doors: doors.map((d, i) => ({ id: `D${i}`, floor: 'G', ...d, kind: 'door', a: '', b: '' })),
    } as unknown as Geometry,
    walkableByFloor: new Map([['G', full]]),
  } as unknown as GeometryIndex;
}

/** Each piece's heading in degrees, folded to 0..180. */
const headings = (points: Point[]) =>
  points.slice(1).map((p, i) => {
    const a = (Math.atan2(p.y - points[i].y, p.x - points[i].x) * 180) / Math.PI;
    return Math.round(((a % 180) + 180) % 180);
  });

// An L of corridors 4 m wide: along y = 50 from x = 0 to 200, then down x = 180 to y = 200.
const L_CORRIDOR = floorPlan(
  [
    { id: 'east-west', kind: 'corridor', polygon: box(0, 30, 200, 70) },
    { id: 'north-south', kind: 'corridor', polygon: box(160, 30, 200, 200) },
  ],
  [
    [0, 30, 200, 30, 200, 200],
    [0, 70, 160, 70, 160, 200],
  ],
);

describe('buildingAxes', () => {
  it('finds the main direction and each angled wing, as one direction per square pair', () => {
    const at = (deg: number, length: number): Segment => {
      const r = (deg * Math.PI) / 180;
      return [0, 0, Math.cos(r) * length, Math.sin(r) * length];
    };
    const axes = buildingAxes([
      at(0, 1000),
      at(90, 800), // square to the main block: the same direction
      at(30, 200), // a wing
      at(120, 150), // square to the wing
      at(12, 5), // a stray scrap of wall: too little to count
    ]);
    expect(axes.sort((a, b) => a - b)).toEqual([0, 30]);
  });
});

describe('shapeRoute', () => {
  it('draws a wobbly corridor walk straight down the middle with a square corner', () => {
    const wobbly = [
      { x: 10, y: 52 },
      { x: 60, y: 47 },
      { x: 120, y: 53 },
      { x: 175, y: 49 },
      { x: 183, y: 110 },
      { x: 178, y: 190 },
    ];
    const line = shapeRoute(wobbly, L_CORRIDOR, 'G', MPU);
    // The ends never move.
    expect(line[0]).toEqual(wobbly[0]);
    expect(line.at(-1)).toEqual(wobbly.at(-1));
    // In between, only level and upright pieces.
    expect(new Set(headings(line))).toEqual(new Set([0, 90]));
  });

  it('meets a door straight on, not at an angle', () => {
    // The last hop runs at a slant from the corridor's middle to a door in its north wall.
    const path = [
      { x: 10, y: 50 },
      { x: 100, y: 50 },
      { x: 120, y: 30 },
    ];
    const line = shapeRoute(
      path,
      floorPlan([{ id: 'c', kind: 'corridor', polygon: box(0, 30, 200, 70) }], [[0, 70, 200, 70]]),
      'G',
      MPU,
    );
    expect(line).toEqual([
      { x: 10, y: 50 },
      { x: 120, y: 50 },
      { x: 120, y: 30 },
    ]);
  });

  it('keeps a slant the walls leave no room to square off', () => {
    // A narrow passage running at 45°, walled on both sides: no square piece fits in it.
    const plan = floorPlan(
      [{ id: 'hall', kind: 'corridor', polygon: box(0, 0, 100, 100) }],
      [
        [0, 12, 88, 100],
        [12, 0, 100, 88],
        [0, 0, 100, 0], // the hall's own walls set its direction: level and upright
        [0, 100, 100, 100],
      ],
    );
    const slant = [
      { x: 20, y: 20 },
      { x: 80, y: 80 },
    ];
    expect(shapeRoute(slant, plan, 'G', MPU)).toEqual(slant);
  });

  it('never cuts through a room the route doesn’t visit', () => {
    // The square corner would be inside an office; the route itself goes round it.
    const plan = floorPlan(
      [
        { id: 'top', kind: 'corridor', polygon: box(0, 0, 100, 20) },
        { id: 'side', kind: 'corridor', polygon: box(80, 0, 100, 100) },
        { id: 'office', kind: 'room', polygon: box(0, 20, 80, 100) },
      ],
      [],
    );
    const line = shapeRoute(
      [
        { x: 10, y: 10 },
        { x: 90, y: 10 },
        { x: 90, y: 90 },
      ],
      plan,
      'G',
      MPU,
    );
    for (const p of line) expect(p.x >= 80 || p.y <= 20).toBe(true);
  });
});

describe('on the real school plan', () => {
  const geometry = {
    ...(JSON.parse(realGeometryText) as Geometry),
    walls: JSON.parse(realWallsText),
  };
  const router = createRouter(geometry, JSON.parse(realConnectorsText) as Connector[]);

  it('draws Digital Learning Center to the Principal with square corners only', () => {
    const route = router.route({ type: 'room', id: 'G-R041' }, { type: 'room', id: 'G-R158' });
    if (!route.ok) throw new Error(route.message);
    for (const leg of route.legs) {
      for (const heading of headings(leg.points)) expect([0, 90, 180]).toContain(heading);
    }
  });

  it('keeps almost every metre of a route along the building’s own directions', () => {
    const rooms = geometry.regions.filter((r) => r.floor === '1' && r.kind === 'room');
    let total = 0;
    let off = 0;
    for (let i = 0; i < 30; i += 1) {
      const a = rooms[(i * 7) % rooms.length];
      const b = rooms[(i * 13 + 5) % rooms.length];
      const route = router.route({ type: 'room', id: a.id }, { type: 'room', id: b.id });
      if (!route.ok) continue;
      for (const leg of route.legs) {
        for (let k = 1; k < leg.points.length; k += 1) {
          const [p, q] = [leg.points[k - 1], leg.points[k]];
          const length = Math.hypot(q.x - p.x, q.y - p.y);
          const deg = ((((Math.atan2(q.y - p.y, q.x - p.x) * 180) / Math.PI) % 90) + 90) % 90;
          // The main block (0°) and the wings (about 24° and 32° either way).
          const along = [0, 90, 24, 32, 58, 66].some((d) => Math.abs(deg - d) < 2);
          total += length;
          if (!along) off += length;
        }
      }
    }
    expect(off / total).toBeLessThan(0.05);
  });
});
