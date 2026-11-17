// The floor plan is drawn to scale: its lines and labels follow the zoom.
//
// Line widths are real sizes on the floor, in metres (a wall is 10 cm thick,
// the route is half a metre wide). At every zoom they are turned into pixels,
// so they grow and shrink at exactly the rate the plan does: zoom out one
// step and every line is half as thick. Leaflet on its own keeps lines the
// same number of pixels at every zoom, which is why a zoomed-out plan used to
// look heavy.
//
// Room names are drawn on the plan too, so they also shrink and grow with
// it: tiny when the whole school is in view, and growing until they reach
// 10pt, the size of the app's body text, where they stop. Each room's name has
// one place, angle and size, worked out from the room's shape alone, so rooms
// of the same shape always show their names the same way.
//
// All of this is worked out here, away from Leaflet, so it can be tested.
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

/** Names reach their full size, 10pt (13.33px), and stop growing there. */
export const LABEL_MAX_PX = 40 / 3;
/**
 * The zoom at which names in big rooms reach 10pt. Further out they shrink
 * with the plan (half the size at each step), so the whole school shows
 * every name, just very small.
 */
export const LABEL_FULL_SIZE_ZOOM = -1;
/** The largest a name is on the floor, in map units (10pt at LABEL_FULL_SIZE_ZOOM). */
export const LABEL_MAX_UNITS = LABEL_MAX_PX / pxPerUnit(LABEL_FULL_SIZE_ZOOM);

/**
 * The box a name needs, in ems (multiples of its font size): the text's own
 * width plus clear space at each end, by one line of text plus a little above
 * and below.
 */
const LABEL_PAD_X_EM = 0.4;
const LABEL_HEIGHT_EM = 1.4;

/** Where, at what angle and how big a room's name is drawn, in map units. */
export type LabelPlacement = {
  x: number;
  y: number;
  /** Degrees, clockwise (the plan's y grows downward): 0 is level. */
  angle: number;
  /** Font size in map units: the screen size is this times pxPerUnit(zoom), up to 10pt. */
  size: number;
};

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

/** Turns every point of a ring by `angle` degrees about the origin. */
function turnRing(ring: Ring, angle: number): Ring {
  const a = (angle * Math.PI) / 180;
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  return ring.map(([x, y]) => [x * cos - y * sin, x * sin + y * cos]);
}

function boundsOf(ring: Ring): Box {
  const xs = ring.map(([x]) => x);
  const ys = ring.map(([, y]) => y);
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  };
}

/**
 * Which way the room runs: the angle of the tightest rectangle around it,
 * kept between -45° and 45° so names are never more than half on their side.
 * A room drawn square to the page gives 0, and one in an angled wing of the
 * building gives that wing's angle.
 */
export function roomAngle(polygon: Ring): number {
  let best = { angle: 0, area: Infinity };
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const [x1, y1] = polygon[j];
    const [x2, y2] = polygon[i];
    if (x1 === x2 && y1 === y2) continue;
    let angle = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
    // Fold into (-45, 45]: a rectangle looks the same turned by 90°.
    angle = ((((angle + 45) % 90) + 90) % 90) - 45;
    const box = boundsOf(turnRing(polygon, -angle));
    const area = (box.maxX - box.minX) * (box.maxY - box.minY);
    // Ties (within 0.1%) go to the angle nearer level, so a plain room reads flat.
    if (
      area < best.area * 0.999 ||
      (area <= best.area * 1.001 && Math.abs(angle) < Math.abs(best.angle))
    ) {
      best = { angle, area: Math.min(area, best.area) };
    }
  }
  return Math.round(best.angle * 10) / 10;
}

/** The centre of a ring's area. */
function areaCentre(ring: Ring): [number, number] {
  let area = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const cross = ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
    area += cross;
    cx += (ring[j][0] + ring[i][0]) * cross;
    cy += (ring[j][1] + ring[i][1]) * cross;
  }
  if (Math.abs(area) < 1e-9) return ring[0];
  return [cx / (3 * area), cy / (3 * area)];
}

/**
 * Where a room's name goes, given how wide the name is in ems (its width at a
 * font size of 1). Returns null if no name fits at all.
 *
 * The name runs along the room (roomAngle) and sits in the middle of it: the
 * centre of the tightest rectangle around the room, which for any ordinary
 * room is simply its centre, so rooms of the same shape match. Only when an
 * odd shape (an L, a room round a pillar) leaves much more space elsewhere
 * does it move: to the centre of the room's area, or to the traced label
 * point, whichever holds the biggest name.
 *
 * The size is the biggest the name can be there with clear space to the
 * walls, up to LABEL_MAX_UNITS.
 */
export function placeLabel(
  region: Pick<Region, 'polygon' | 'holes' | 'labelAt'>,
  textEm: number,
): LabelPlacement | null {
  const angle = roomAngle(region.polygon);
  // Work in a frame where the room is square to the axes, so the name's box is too.
  const polygon = turnRing(region.polygon, -angle);
  const holes = (region.holes ?? []).map((hole) => turnRing(hole, -angle));
  const box = boundsOf(polygon);
  const [labelX, labelY] = turnRing([region.labelAt], -angle)[0];
  const anchors: [number, number][] = [
    [(box.minX + box.maxX) / 2, (box.minY + box.maxY) / 2],
    areaCentre(polygon),
    [labelX, labelY],
  ];
  const widthEm = textEm + 2 * LABEL_PAD_X_EM;

  /** The biggest font size (map units) that fits at this point. */
  function biggestAt([x, y]: [number, number]): number {
    const fits = (size: number) =>
      boxFitsInRoom({ polygon, holes, labelAt: [x, y] }, widthEm * size, LABEL_HEIGHT_EM * size);
    if (fits(LABEL_MAX_UNITS)) return LABEL_MAX_UNITS;
    let low = 0;
    let high = LABEL_MAX_UNITS;
    for (let i = 0; i < 24; i += 1) {
      const middle = (low + high) / 2;
      if (fits(middle)) low = middle;
      else high = middle;
    }
    return low;
  }

  // The middle of the room wins unless another point holds a name at least
  // a third bigger.
  let best = { at: anchors[0], size: biggestAt(anchors[0]) };
  for (const at of anchors.slice(1)) {
    const size = biggestAt(at);
    if (size > best.size * 1.33) best = { at, size };
  }
  if (best.size <= 0) return null;
  const [x, y] = turnRing([best.at], angle)[0];
  return { x, y, angle, size: best.size };
}
