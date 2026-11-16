// The floor plan is drawn to scale: its lines and labels follow the zoom.
//
// Line widths are real sizes on the floor, in metres (a wall is 10 cm thick,
// the route is half a metre wide). At every zoom they are turned into pixels,
// so they grow and shrink at exactly the rate the plan does: zoom out one
// step and every line is half as thick. Leaflet on its own keeps lines the
// same number of pixels at every zoom, which is why a zoomed-out plan used to
// look heavy.
//
// A room's name appears once the room is big enough on screen to hold it at
// 10pt, the size of the app's small print, and disappears again when it no
// longer fits. Both are worked out here, away from Leaflet, so they can be
// tested.
import { pointInPolygon } from './graph.ts';
import type { Region } from './types.ts';

/** How thick each kind of line is on the floor, in metres. */
export const LINE_M = {
  wall: 0.1,
  /** The outline of the selected room. */
  selection: 0.2,
  /** The route line; its soft glow is wider (RouteLayer). */
  route: 0.5,
} as const;

/**
 * Screen pixels per map unit at a zoom level. The plan uses Leaflet's flat
 * CRS.Simple, where zoom 0 is one pixel per unit and each step doubles it.
 */
export const pxPerUnit = (zoom: number) => Math.pow(2, zoom);

/** Screen pixels per metre on the floor at a zoom level. */
export const pxPerMetre = (zoom: number, metresPerUnit: number) => pxPerUnit(zoom) / metresPerUnit;

/** The route line's width in pixels at a zoom level. */
export function routeLineWeight(zoom: number, metresPerUnit: number): number {
  return LINE_M.route * pxPerMetre(zoom, metresPerUnit);
}

// ---------- room labels ----------

/** Room names are 10pt (13.33px), the app's own typeface. */
export const LABEL_FONT_SIZE = '10pt';
/** One line of 10pt text at a line height of 1.2, in pixels. */
export const LABEL_LINE_PX = 16;
/** Clear space kept between the name and the room's walls, in pixels. */
export const LABEL_PADDING_PX = 4;

type Ring = [number, number][];
type Box = { minX: number; minY: number; maxX: number; maxY: number };

const inside = (x: number, y: number, box: Box) =>
  x > box.minX && x < box.maxX && y > box.minY && y < box.maxY;

/** Which side of the line a-b the point c is on (0 = on the line). */
const side = (ax: number, ay: number, bx: number, by: number, cx: number, cy: number) =>
  Math.sign((bx - ax) * (cy - ay) - (by - ay) * (cx - ax));

/** Do the segments p1-p2 and p3-p4 cross or touch? */
function segmentsMeet(p1: number[], p2: number[], p3: number[], p4: number[]): boolean {
  const d1 = side(p3[0], p3[1], p4[0], p4[1], p1[0], p1[1]);
  const d2 = side(p3[0], p3[1], p4[0], p4[1], p2[0], p2[1]);
  const d3 = side(p1[0], p1[1], p2[0], p2[1], p3[0], p3[1]);
  const d4 = side(p1[0], p1[1], p2[0], p2[1], p4[0], p4[1]);
  if (d1 !== d2 && d3 !== d4) return true;
  // Lined up: they meet only if they overlap.
  const within = (a: number[], b: number[], c: number[]) =>
    Math.min(a[0], b[0]) <= c[0] &&
    c[0] <= Math.max(a[0], b[0]) &&
    Math.min(a[1], b[1]) <= c[1] &&
    c[1] <= Math.max(a[1], b[1]);
  return (
    (d1 === 0 && within(p3, p4, p1)) ||
    (d2 === 0 && within(p3, p4, p2)) ||
    (d3 === 0 && within(p1, p2, p3)) ||
    (d4 === 0 && within(p1, p2, p4))
  );
}

/** Does any wall (an edge of the outline or of a hole) reach into the box? */
function wallInBox(rings: Ring[], box: Box): boolean {
  const corners = [
    [box.minX, box.minY],
    [box.maxX, box.minY],
    [box.maxX, box.maxY],
    [box.minX, box.maxY],
  ];
  for (const ring of rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
      const a = ring[j];
      const b = ring[i];
      if (inside(a[0], a[1], box) || inside(b[0], b[1], box)) return true;
      for (let k = 0; k < 4; k += 1) {
        if (segmentsMeet(a, b, corners[k], corners[(k + 1) % 4])) return true;
      }
    }
  }
  return false;
}

/**
 * Does a box `width` × `height` (map units), centred on the room's label
 * point, sit wholly inside the room? Inside means: its corners are in the
 * room and not in a hole, and no wall crosses it.
 */
export function boxFitsInRoom(
  region: Pick<Region, 'polygon' | 'holes' | 'labelAt'>,
  width: number,
  height: number,
): boolean {
  const [cx, cy] = region.labelAt;
  const box = {
    minX: cx - width / 2,
    maxX: cx + width / 2,
    minY: cy - height / 2,
    maxY: cy + height / 2,
  };
  const holes = region.holes ?? [];
  const corners = [
    { x: box.minX, y: box.minY },
    { x: box.maxX, y: box.minY },
    { x: box.maxX, y: box.maxY },
    { x: box.minX, y: box.maxY },
  ];
  for (const corner of corners) {
    if (!pointInPolygon(corner, region.polygon)) return false;
    if (holes.some((hole) => pointInPolygon(corner, hole))) return false;
  }
  return !wallInBox([region.polygon, ...holes], box);
}

/**
 * The smallest zoom scale (pixels per map unit) at which a name `textWidth`
 * pixels wide fits in the room with clear space around it, or null if it
 * doesn't fit even at `maxScale` (the closest zoom).
 *
 * A bigger scale only ever shrinks the box in map units, and a smaller box
 * centred on the same point fits wherever a bigger one did, so the answer is
 * one threshold, found by halving the range.
 */
export function labelMinScale(
  region: Pick<Region, 'polygon' | 'holes' | 'labelAt'>,
  textWidth: number,
  maxScale: number,
): number | null {
  const boxWidth = textWidth + 2 * LABEL_PADDING_PX;
  const boxHeight = LABEL_LINE_PX + 2 * LABEL_PADDING_PX;
  const fitsAt = (scale: number) => boxFitsInRoom(region, boxWidth / scale, boxHeight / scale);
  if (!fitsAt(maxScale)) return null;
  let low = maxScale / 1024;
  if (fitsAt(low)) return low;
  let high = maxScale;
  // 20 halvings (in log scale) pin the threshold to well under 1% of a zoom step.
  for (let i = 0; i < 20; i += 1) {
    const middle = Math.sqrt(low * high);
    if (fitsAt(middle)) high = middle;
    else low = middle;
  }
  return high;
}
