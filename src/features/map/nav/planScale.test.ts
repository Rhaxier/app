// The plan drawn to scale: line widths follow the zoom exactly, and a room's
// name shows only once the room can hold it.
import { describe, expect, it } from 'vitest';
import geometryJson from './data/geometry.json';
import {
  boxFitsInRoom,
  LABEL_LINE_PX,
  LABEL_PADDING_PX,
  labelMinScale,
  pxPerMetre,
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

describe('labelMinScale', () => {
  it('finds the zoom where the name and its clear space first fit', () => {
    // 50px of text needs 58px with padding; the room is 100 units wide, so
    // width fits from 0.58 px/unit. Height needs 24px in 40 units: 0.6.
    const height = LABEL_LINE_PX + 2 * LABEL_PADDING_PX;
    const scale = labelMinScale(room, 50, 4);
    expect(scale).not.toBeNull();
    expect(scale!).toBeCloseTo(height / 40, 2);
  });

  it('says never when even the closest zoom is too small', () => {
    expect(labelMinScale(room, 1000, 4)).toBeNull();
  });

  it('shows a longer name later than a shorter one in the same room', () => {
    const wide = {
      ...room,
      polygon: room.polygon.map(([x, y]) => [x, y * 4]) as [number, number][],
      labelAt: [50, 80] as [number, number],
    };
    expect(labelMinScale(wide, 80, 4)!).toBeGreaterThan(labelMinScale(wide, 40, 4)!);
  });

  it('works on every traced room, with names appearing within the zoom range', () => {
    const rooms = geometry.regions.filter((region) => region.kind === 'room');
    const shown = rooms.filter((region) => labelMinScale(region, 60, 4) !== null);
    // A 60px name fits most rooms by the closest zoom.
    expect(shown.length / rooms.length).toBeGreaterThan(0.5);
  });
});
