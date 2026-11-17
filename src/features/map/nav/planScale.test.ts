// The plan drawn to scale: line widths follow the zoom exactly, and each
// room's name has one place, angle and size that fits it.
import { describe, expect, it } from 'vitest';
import geometryJson from './data/geometry.json';
import {
  boxFitsInRoom,
  LABEL_MAX_UNITS,
  placeLabel,
  pxPerMetre,
  roomAngle,
  routeLineWeight,
} from './planScale.ts';
import type { Geometry } from './types.ts';

const geometry = geometryJson as unknown as Geometry;

// A 100 × 40 room, labelled at its centre.
const room = {
  polygon: [
    [0, 0],
    [100, 0],
    [100, 40],
    [0, 40],
  ] as [number, number][],
  labelAt: [50, 20] as [number, number],
};

describe('line widths', () => {
  it('halve with every step out and double with every step in', () => {
    const mpu = geometry.metresPerUnit;
    expect(routeLineWeight(-3, mpu)).toBeCloseTo(routeLineWeight(-2, mpu) / 2);
    expect(routeLineWeight(1, mpu)).toBeCloseTo(routeLineWeight(0, mpu) * 2);
    expect(pxPerMetre(-1.25, mpu) / pxPerMetre(-1, mpu)).toBeCloseTo(Math.pow(2, -0.25));
  });

  it('draws the route half a metre wide', () => {
    // At zoom 0 a map unit is one pixel.
    expect(routeLineWeight(0, 0.05)).toBeCloseTo(10);
  });
});

describe('boxFitsInRoom', () => {
  it('fits a box that stays inside the walls', () => {
    expect(boxFitsInRoom(room, 90, 30)).toBe(true);
  });

  it('refuses a box that reaches a wall', () => {
    expect(boxFitsInRoom(room, 110, 30)).toBe(false);
    expect(boxFitsInRoom(room, 90, 40)).toBe(false);
  });

  it('refuses a box over a hole, even one wholly inside it', () => {
    const pillar: [number, number][] = [
      [48, 18],
      [52, 18],
      [52, 22],
      [48, 22],
    ];
    expect(boxFitsInRoom({ ...room, holes: [pillar] }, 20, 10)).toBe(false);
  });

  it('refuses a box crossing the inside corner of an L-shaped room', () => {
    const lShape = {
      polygon: [
        [0, 0],
        [100, 0],
        [100, 40],
        [40, 40],
        [40, 100],
        [0, 100],
      ] as [number, number][],
      labelAt: [30, 30] as [number, number],
    };
    expect(boxFitsInRoom(lShape, 30, 30)).toBe(false);
    expect(boxFitsInRoom(lShape, 10, 10)).toBe(true);
  });
});

/** The same room moved by (dx, dy). */
const moved = (r: typeof room, dx: number, dy: number) => ({
  polygon: r.polygon.map(([x, y]) => [x + dx, y + dy]) as [number, number][],
  labelAt: [r.labelAt[0] + dx, r.labelAt[1] + dy] as [number, number],
});

/** The same room turned by `degrees` about the origin. */
function turned(r: typeof room, degrees: number) {
  const a = (degrees * Math.PI) / 180;
  const turn = ([x, y]: [number, number]): [number, number] => [
    x * Math.cos(a) - y * Math.sin(a),
    x * Math.sin(a) + y * Math.cos(a),
  ];
  return { polygon: r.polygon.map(turn), labelAt: turn(r.labelAt) };
}

describe('roomAngle', () => {
  it('reads a room drawn square to the page as level', () => {
    expect(roomAngle(room.polygon)).toBe(0);
  });

  it('follows a room in an angled wing', () => {
    expect(roomAngle(turned(room, 30).polygon)).toBeCloseTo(30);
    expect(roomAngle(turned(room, -20).polygon)).toBeCloseTo(-20);
  });

  it('never turns a name more than 45°', () => {
    // A room turned 70° is the same rectangle as one turned -20°.
    expect(roomAngle(turned(room, 70).polygon)).toBeCloseTo(-20);
  });
});

describe('placeLabel', () => {
  it('puts the name in the middle of a plain room, level', () => {
    // labelAt is off-centre on purpose: the middle wins.
    const placement = placeLabel({ ...room, labelAt: [20, 20] }, 3)!;
    expect(placement).toMatchObject({ x: 50, y: 20, angle: 0 });
  });

  it('places the name the same way in rooms of the same shape', () => {
    const a = placeLabel({ ...room, labelAt: [20, 20] }, 3)!;
    const b = placeLabel(moved({ ...room, labelAt: [80, 20] }, 500, 300), 3)!;
    expect(b.x - 500).toBeCloseTo(a.x);
    expect(b.y - 300).toBeCloseTo(a.y);
    expect(b.size).toBeCloseTo(a.size);
  });

  it('turns the name with an angled room and keeps it inside', () => {
    const placement = placeLabel(turned(room, 30), 3)!;
    expect(placement.angle).toBeCloseTo(30);
    const [cx, cy] = turned(room, 30).labelAt;
    expect(placement.x).toBeCloseTo(cx);
    expect(placement.y).toBeCloseTo(cy);
  });

  it('sizes the name to fit with clear space, and no bigger than the cap', () => {
    // 3 ems + 0.8 ems of clear space across 100 units: about 26 units.
    const long = placeLabel(room, 3)!;
    expect(long.size).toBeLessThan(100 / 3.8 + 0.01);
    expect(long.size).toBeGreaterThan(100 / 3.8 - 1);
    // A short name in a big room stops at the cap.
    const hall = moved(
      {
        ...room,
        polygon: room.polygon.map(([x, y]) => [x * 10, y * 10]) as [number, number][],
        labelAt: [500, 200],
      },
      0,
      0,
    );
    expect(placeLabel(hall, 1)!.size).toBe(LABEL_MAX_UNITS);
  });

  it('moves to the open part of an L-shaped room', () => {
    const lShape = {
      polygon: [
        [0, 0],
        [200, 0],
        [200, 40],
        [40, 40],
        [40, 200],
        [0, 200],
      ] as [number, number][],
      labelAt: [120, 20] as [number, number],
    };
    const placement = placeLabel(lShape, 3)!;
    // The middle of the bounding box (100, 100) is outside the room.
    expect(boxFitsInRoom({ ...lShape, labelAt: [placement.x, placement.y] }, 1, 1)).toBe(true);
  });

  it('places a name in every traced room', () => {
    const rooms = geometry.regions.filter((region) => region.kind === 'room');
    const placed = rooms.filter((region) => placeLabel(region, 5) !== null);
    expect(placed.length).toBe(rooms.length);
  });

  it('gives rooms of the same shape and name the same placement on the real plan', () => {
    // Group rooms by their shape (outline relative to its first corner).
    const groups = new Map<string, { dx: number; dy: number; x: number; y: number }[]>();
    for (const region of geometry.regions.filter((r) => r.kind === 'room')) {
      const [ox, oy] = region.polygon[0];
      const shape = region.polygon
        .map(([x, y]) => `${Math.round(x - ox)},${Math.round(y - oy)}`)
        .join(' ');
      const placement = placeLabel(region, 5);
      if (!placement) continue;
      const list = groups.get(shape) ?? [];
      list.push({ dx: ox, dy: oy, x: placement.x - ox, y: placement.y - oy });
      groups.set(shape, list);
    }
    let compared = 0;
    for (const list of groups.values()) {
      for (const other of list.slice(1)) {
        expect(other.x).toBeCloseTo(list[0].x, 0);
        expect(other.y).toBeCloseTo(list[0].y, 0);
        compared += 1;
      }
    }
    expect(compared).toBeGreaterThan(0);
  });
});
