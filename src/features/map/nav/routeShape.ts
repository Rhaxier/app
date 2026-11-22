// Tidies the drawn route line so it reads like a route a person would walk:
// straight down the middle of each corridor, parallel to its walls, with
// square corners.
//
// The router's path follows the corridor centre-lines traced from the plan.
// Those wobble (a tracing follows every recess and doorway), and the last hop
// from a corridor to a door is a straight line at whatever angle it happens to
// be. Drawn as they are, routes zig-zag. This file redraws the line only: the
// search, the distance, the time and the spoken steps all still come from the
// router's own path.
//
// How:
//   1. The path is simplified to its real bends.
//   2. Each stretch is snapped to the building's own directions (worked out
//      from the walls: most rooms are square to the page, the wings are at an
//      angle) and moved onto the middle of the corridor it runs along.
//      Stretches that don't match a direction are kept as they are.
//   3. Neighbouring stretches meet at their crossing point, which is a right
//      angle when both run square to the same walls. A sideways step between
//      two parallel stretches becomes a short square jog.
//   4. The two ends (a door, a lift, a pin) join the first and last stretch
//      straight across, at a right angle.
//   5. Any piece still at an angle becomes an L of two square pieces.
//
// Before all that, detours are cut: where the traced centre-line wanders
// round the middle of a hall and back, the line goes straight across.
//
// Every new piece is checked: it must not cross a drawn wall, and may only
// pass through corridors and the rooms the original path went through (never
// someone else's room). Where a piece fails, the original bend is kept there.
// So a corner that isn't square is one the walls leave no room to square off.
//
// Everything is pure and in map units, like the rest of ./graph.ts.

import { distance, insideRegion, type GeometryIndex, type Segment } from './graph.ts';
import type { FloorId, Point, Region } from './types.ts';

/** Wobbles smaller than this (metres) are not real bends. */
const SIMPLIFY_M = 0.8;
/** A stretch this close (degrees) to one of the building's directions is snapped to it. */
const SNAP_DEGREES = 15;
/** Two parallel stretches closer than this (metres) sideways become one straight line. */
const MERGE_M = 1;
/** A stretch shorter than this (metres) between two others is only a link, not a line of its own. */
const LINK_M = 1.5;
/** The first or last stretch, up to this long (metres), is the hop from a door, and is redrawn. */
const END_LINK_M = 4;
/** A new corner may sit at most this far (metres) from the bend it replaces. */
const CORNER_REACH_M = 4;
/** Lines this close to parallel (degrees) don't get a crossing point; they get a jog. */
const PARALLEL_DEGREES = 10;
/** A detour is cut out when the straight way saves at least this much (metres). */
const DETOUR_M = 2;
/** Detours are looked for this far ahead along the path (metres): a hall, not the whole school. */
const DETOUR_REACH_M = 30;
/** The walls within this distance (map units, about 2.5 m) of a point set its direction. */
const AXIS_REACH_UNITS = 54;
/** Points this close (map units) share one answer for their direction. */
const AXIS_CELL = 8;
/** Outdoors, the line may run this far (metres) from the router's path. */
const OUTDOOR_SLACK_M = 1.5;
/** How far apart (map units) the points checked along a new piece are. */
const SAMPLE_UNITS = 4;
/** The ends of a route sit in doorways, in the wall itself: this close (map units) to them, walls don't count. */
const END_CLEARANCE_UNITS = 8;

/** What a floor's line is checked against. */
export type ShapeFloor = {
  walls: WallGrid;
  /** The floor's walkable regions, each with its bounding box, for quick "is it inside" tests. */
  places: Place[];
  /** Doorways: they sit on the line between two places, so a point there is in neither. */
  doors: Point[];
  /** The building's directions on this floor, in degrees between -45 and 45, main one first. */
  axes: number[];
  /** The direction at a point, from the walls around it (see localAxis). */
  axisAt: (p: Point) => number;
};

type Place = {
  region: Region;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
};

/** Is p in this place? The bounding box first: it rules most places out cheaply. */
const inPlace = (p: Point, place: Place) =>
  p.x >= place.minX &&
  p.x <= place.maxX &&
  p.y >= place.minY &&
  p.y <= place.maxY &&
  insideRegion(p, place.region);

type Line = {
  /** A point on the line. */
  p: Point;
  /** Unit direction. */
  u: Point;
  /** Snapped to a building direction (false: kept as traced). */
  square: boolean;
  /** How much path it stands for (map units), to weigh merges. */
  weight: number;
};

const toRad = (deg: number) => (deg * Math.PI) / 180;
const toDeg = (rad: number) => (rad * 180) / Math.PI;

/** The difference between two directions, ignoring which way along the line (0 to 90). */
function lineAngle(a: number, b: number): number {
  const d = Math.abs((((a - b) % 180) + 180) % 180);
  return Math.min(d, 180 - d);
}

/** The difference between two headings (0 to 180). */
function headingAngle(a: number, b: number): number {
  const d = Math.abs((((a - b) % 360) + 360) % 360);
  return Math.min(d, 360 - d);
}

// ---------- the building's directions ----------

const floorCache = new WeakMap<GeometryIndex, Map<FloorId, ShapeFloor>>();

/** The walls of a floor and its directions, worked out once per floor. */
export function shapeFloor(index: GeometryIndex, floor: FloorId): ShapeFloor {
  let byFloor = floorCache.get(index);
  if (!byFloor) {
    byFloor = new Map();
    floorCache.set(index, byFloor);
  }
  const cached = byFloor.get(floor);
  if (cached) return cached;

  const walls: Segment[] = [];
  for (const line of index.geometry.walls?.[floor] ?? []) {
    for (let k = 2; k < line.length; k += 2) {
      walls.push([line[k - 2], line[k - 1], line[k], line[k + 1]]);
    }
  }
  // Without drawn walls, the outlines of the rooms and corridors say the same.
  const edges: Segment[] =
    walls.length > 0 ? walls : outlineEdges(index.walkableByFloor.get(floor) ?? []);
  const doors = index.geometry.doors.filter((door) => door.floor === floor);
  const grid = wallGrid(walls);
  const axes = buildingAxes(edges);
  const places = (index.walkableByFloor.get(floor) ?? []).map((region) => {
    const xs = region.polygon.map(([x]) => x);
    const ys = region.polygon.map(([, y]) => y);
    return {
      region,
      minX: Math.min(...xs),
      maxX: Math.max(...xs),
      minY: Math.min(...ys),
      maxY: Math.max(...ys),
    };
  });
  const nearby = walls.length > 0 ? grid : wallGrid(edges);
  const axisCache = new Map<string, number>();
  const axisAt = (p: Point) => {
    // Points this close together share an answer.
    const key = `${Math.round(p.x / AXIS_CELL)},${Math.round(p.y / AXIS_CELL)}`;
    let axis = axisCache.get(key);
    if (axis === undefined) {
      axis = localAxis(p, nearby, axes);
      axisCache.set(key, axis);
    }
    return axis;
  };
  const result = { walls: grid, doors, places, axes, axisAt };
  byFloor.set(floor, result);
  return result;
}

function outlineEdges(regions: Region[]): Segment[] {
  const edges: Segment[] = [];
  for (const region of regions) {
    const ring = region.polygon;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
      edges.push([ring[j][0], ring[j][1], ring[i][0], ring[i][1]]);
    }
  }
  return edges;
}

/**
 * The directions the walls run in, folded so that a direction and the one at
 * right angles to it count as one (a square room has one direction, not two).
 * Each wall votes with its length; the clear peaks are the building's
 * directions: one for the main block, one more per angled wing.
 */
export function buildingAxes(edges: Segment[]): number[] {
  const BIN = 0.5;
  const fold = (deg: number) => ((((deg + 45) % 90) + 90) % 90) - 45;
  const walls: { angle: number; length: number }[] = [];
  const bins = new Array(180).fill(0) as number[]; // -45 .. 45 in half degrees
  for (const [x1, y1, x2, y2] of edges) {
    const length = Math.hypot(x2 - x1, y2 - y1);
    if (length < 1) continue;
    const angle = fold(toDeg(Math.atan2(y2 - y1, x2 - x1)));
    walls.push({ angle, length });
    bins[Math.min(179, Math.floor((angle + 45) / BIN))] += length;
  }
  // Smooth over ±2°, wrapping round (-45° and 45° are the same direction).
  const smooth = bins.map((_, i) => {
    let sum = 0;
    for (let k = -4; k <= 4; k += 1) sum += bins[(i + k + 180) % 180];
    return sum;
  });
  const total = bins.reduce((sum, value) => sum + value, 0);
  if (total === 0) return [0];
  const peaks: { angle: number; strength: number }[] = [];
  for (let i = 0; i < 180; i += 1) {
    const value = smooth[i];
    // A direction needs 4% of all the wall length: the main block has about
    // half, each angled wing a few percent.
    if (value < 0.04 * total || value < smooth[(i + 179) % 180] || value <= smooth[(i + 1) % 180]) {
      continue;
    }
    // The exact direction: the length-weighted average of the walls within 3° of the peak,
    // measured from the peak so -44.9° and 44.9° average to 45°, not 0°.
    const centre = -45 + i * BIN + BIN / 2;
    let sum = 0;
    let weight = 0;
    for (const wall of walls) {
      const off = fold(wall.angle - centre);
      if (Math.abs(off) <= 3) {
        sum += off * wall.length;
        weight += wall.length;
      }
    }
    // Tenths of a degree: the tracing is no finer, and a square plan stays exactly square.
    const angle = Math.round(fold(centre + sum / weight) * 10) / 10 || 0;
    // The wings on each side differ by a few degrees (25° and 31°), so peaks only 4° apart are kept apart.
    if (!peaks.some((peak) => lineAngle(peak.angle, angle) < 4)) {
      peaks.push({ angle, strength: value });
    }
  }
  // Strongest first: the main block's direction leads.
  return peaks.sort((a, b) => b.strength - a.strength).map((peak) => peak.angle);
}

/**
 * Which of the building's directions applies at a point: the one most of the
 * walls within reach of it follow. In a wing that's the wing's angle, in the
 * main block the main direction, even inside one long corridor that runs
 * through both. Only that direction (and the one square to it) counts as
 * straight there, so a slant in the main block that happens to match a wing's
 * angle is still a slant.
 */
function localAxis(p: Point, grid: WallGrid, axes: number[]): number {
  const reach = AXIS_REACH_UNITS;
  const votes = axes.map(() => 0);
  const box = { minX: p.x - reach, maxX: p.x + reach, minY: p.y - reach, maxY: p.y + reach };
  const seen = new Set<Segment>();
  for (let cx = Math.floor(box.minX / grid.size); cx <= Math.floor(box.maxX / grid.size); cx += 1) {
    for (
      let cy = Math.floor(box.minY / grid.size);
      cy <= Math.floor(box.maxY / grid.size);
      cy += 1
    ) {
      for (const wall of grid.cells.get(`${cx},${cy}`) ?? []) {
        if (seen.has(wall)) continue;
        seen.add(wall);
        const length = lengthInBox(wall, box);
        if (length <= 0) continue;
        const [x1, y1, x2, y2] = wall;
        const heading = toDeg(Math.atan2(y2 - y1, x2 - x1));
        axes.forEach((axis, k) => {
          if (lineAngle(heading, axis) < 4 || lineAngle(heading, axis + 90) < 4) votes[k] += length;
        });
      }
    }
  }
  const best = votes.indexOf(Math.max(...votes));
  return votes[best] > 0 ? axes[best] : axes[0];
}

/** How much of a wall lies inside a box (Liang-Barsky clipping). */
function lengthInBox(
  [x1, y1, x2, y2]: Segment,
  box: { minX: number; maxX: number; minY: number; maxY: number },
): number {
  let t0 = 0;
  let t1 = 1;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const edges: [number, number][] = [
    [-dx, x1 - box.minX],
    [dx, box.maxX - x1],
    [-dy, y1 - box.minY],
    [dy, box.maxY - y1],
  ];
  for (const [pp, q] of edges) {
    if (pp === 0) {
      if (q < 0) return 0;
      continue;
    }
    const t = q / pp;
    if (pp < 0) t0 = Math.max(t0, t);
    else t1 = Math.min(t1, t);
    if (t0 > t1) return 0;
  }
  return (t1 - t0) * Math.hypot(dx, dy);
}

/** The building direction at a point: that of the place it's in (or the main one). */
type AxisAt = (p: Point) => number;

const middle = (a: Point, b: Point) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

/** Does the piece a-b run along the building direction where it is? */
function runsSquare(a: Point, b: Point, axisAt: AxisAt, tolerance: number): boolean {
  const heading = toDeg(Math.atan2(b.y - a.y, b.x - a.x));
  const axis = axisAt(middle(a, b));
  return lineAngle(heading, axis) < tolerance || lineAngle(heading, axis + 90) < tolerance;
}

// ---------- the line itself ----------

/** Ramer-Douglas-Peucker, keeping the indexes of the points it keeps. */
function simplifyIndexes(points: Point[], tolerance: number): number[] {
  const keep = new Set([0, points.length - 1]);
  const stack: [number, number][] = [[0, points.length - 1]];
  while (stack.length > 0) {
    const [first, last] = stack.pop() as [number, number];
    const a = points[first];
    const b = points[last];
    const length = distance(a, b) || 1;
    let worst = 0;
    let worstAt = -1;
    for (let i = first + 1; i < last; i += 1) {
      const off =
        Math.abs((b.y - a.y) * (points[i].x - a.x) - (b.x - a.x) * (points[i].y - a.y)) / length;
      if (off > worst) {
        worst = off;
        worstAt = i;
      }
    }
    if (worstAt >= 0 && worst > tolerance) {
      keep.add(worstAt);
      stack.push([first, worstAt], [worstAt, last]);
    }
  }
  return [...keep].sort((x, y) => x - y);
}

/** The middle of a stretch of the original path, weighted by length: the corridor's centre. */
function middleOf(points: Point[], from: number, to: number): Point {
  let x = 0;
  let y = 0;
  let total = 0;
  for (let i = from + 1; i <= to; i += 1) {
    const length = distance(points[i - 1], points[i]);
    x += ((points[i - 1].x + points[i].x) / 2) * length;
    y += ((points[i - 1].y + points[i].y) / 2) * length;
    total += length;
  }
  return total > 0 ? { x: x / total, y: y / total } : points[from];
}

/** The foot of the perpendicular from p onto the line. */
function foot(p: Point, line: Line): Point {
  const t = (p.x - line.p.x) * line.u.x + (p.y - line.p.y) * line.u.y;
  return { x: line.p.x + line.u.x * t, y: line.p.y + line.u.y * t };
}

/** Where two lines cross, or undefined if they are parallel. */
function crossing(a: Line, b: Line): Point | undefined {
  const d = a.u.x * b.u.y - a.u.y * b.u.x;
  if (Math.abs(d) < 1e-9) return undefined;
  const t = ((b.p.x - a.p.x) * b.u.y - (b.p.y - a.p.y) * b.u.x) / d;
  return { x: a.p.x + a.u.x * t, y: a.p.y + a.u.y * t };
}

/** How far sideways one parallel line is from another. */
const sideways = (a: Line, b: Line) => Math.abs((b.p.x - a.p.x) * -a.u.y + (b.p.y - a.p.y) * a.u.x);

/** The stretch from a to b as a line: snapped to a building direction if it's close to one. */
function lineFor(points: Point[], from: number, to: number, axisAt: AxisAt): Line {
  const a = points[from];
  const b = points[to];
  const heading = toDeg(Math.atan2(b.y - a.y, b.x - a.x));
  const weight = distance(a, b);
  let best: { angle: number; off: number } | undefined;
  const axis = axisAt(middleOf(points, from, to));
  for (const angle of [axis, axis + 90, axis + 180, axis - 90]) {
    const off = headingAngle(heading, angle);
    if (off <= SNAP_DEGREES && (!best || off < best.off)) best = { angle, off };
  }
  if (!best) {
    return {
      p: a,
      u: { x: (b.x - a.x) / (weight || 1), y: (b.y - a.y) / (weight || 1) },
      square: false,
      weight,
    };
  }
  const u = { x: Math.cos(toRad(best.angle)), y: Math.sin(toRad(best.angle)) };
  return { p: middleOf(points, from, to), u, square: true, weight };
}

/**
 * Redraws one floor's stretch of a route (see the top of this file). `points`
 * is the router's path on that floor, ends included; the ends are kept
 * exactly where they are.
 */
export function shapeRoute(
  points: Point[],
  index: GeometryIndex,
  floor: FloorId,
  metresPerUnit: number,
): Point[] {
  if (points.length < 2) return points;
  const { walls, doors, places, axisAt } = shapeFloor(index, floor);
  const unit = (metres: number) => metres / metresPerUnit;
  const start = points[0];
  const end = points[points.length - 1];

  // Where the new line may go: any corridor, and the rooms the path itself goes
  // through (never through someone else's room).
  const allowed = places.filter((place) => place.region.kind === 'corridor');
  const visited = new Set(allowed);
  for (let i = 1; i < points.length; i += 1) {
    const steps = Math.max(1, Math.ceil(distance(points[i - 1], points[i]) / SAMPLE_UNITS));
    for (let k = 0; k <= steps; k += 1) {
      const t = k / steps;
      const p = {
        x: points[i - 1].x + (points[i].x - points[i - 1].x) * t,
        y: points[i - 1].y + (points[i].y - points[i - 1].y) * t,
      };
      for (const place of places) {
        if (!visited.has(place) && inPlace(p, place)) {
          visited.add(place);
          allowed.push(place);
        }
      }
    }
  }
  const nearEnd = (p: Point) =>
    distance(p, start) < END_CLEARANCE_UNITS || distance(p, end) < END_CLEARANCE_UNITS;
  const inDoorway = (p: Point) => doors.some((door) => distance(p, door) < END_CLEARANCE_UNITS);

  // Where the router's own path goes through a drawn wall. The walls were
  // traced separately from the walking paths, and in a few places they meet a
  // doorway the tracing closed up. The walk shows there is a way through, so
  // the new line may cross that wall there too.
  const passed: Point[] = [];
  for (let i = 1; i < points.length; i += 1) {
    passed.push(...wallCrossings(points[i - 1], points[i], walls));
  }
  const throughWall = (p: Point) => passed.some((q) => distance(p, q) < unit(1));
  const nearPath = (p: Point, within: number) => {
    for (let i = 1; i < points.length; i += 1) {
      if (distanceToPiece(p, points[i - 1], points[i]) < within) return true;
    }
    return false;
  };
  // Outside every room and corridor (an outdoor path between blocks there are
  // no outlines to stay in): the line may move a little off the path to run
  // straight. Inside someone else's room, only right on the path.
  const offPathAllowed = (p: Point) =>
    places.some((place) => inPlace(p, place))
      ? nearPath(p, SAMPLE_UNITS)
      : nearPath(p, unit(OUTDOOR_SLACK_M));

  let lastPlace: Place | undefined;

  /** May the line run straight from a to b: no wall crossed, and only through allowed places? */
  function clear(a: Point, b: Point): boolean {
    const clearance = nearEnd(a) || nearEnd(b) ? END_CLEARANCE_UNITS : 1;
    for (const hit of wallCrossings(a, b, walls)) {
      if (distance(hit, a) <= clearance || distance(hit, b) <= clearance) continue;
      if (!throughWall(hit)) return false;
    }
    const steps = Math.max(1, Math.ceil(distance(a, b) / SAMPLE_UNITS));
    for (let k = 0; k <= steps; k += 1) {
      const t = k / steps;
      const p = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
      if (nearEnd(p)) continue;
      // Neighbouring points are nearly always in the same place: try that one first.
      let inside = lastPlace !== undefined && inPlace(p, lastPlace);
      for (let r = 0; !inside && r < allowed.length; r += 1) {
        if (inPlace(p, allowed[r])) {
          inside = true;
          lastPlace = allowed[r];
        }
      }
      if (!inside && !inDoorway(p) && !offPathAllowed(p)) return false;
    }
    return true;
  }

  const path = cutDetours(points, clear, axisAt, unit(DETOUR_M), unit(DETOUR_REACH_M));
  const squared = squareUp(path, axisAt, unit, clear);
  const drawn = straightRuns(
    squareDiagonals(squared, axisAt, clear, unit(0.05)),
    axisAt,
    clear,
    unit(1),
  );
  // A last check of the whole line: where a piece still fails (a fallback bend
  // can sit awkwardly beside a new corner), that piece follows the path itself.
  const shaped = [drawn[0]];
  for (let k = 1; k < drawn.length; k += 1) {
    const a = shaped[shaped.length - 1];
    const b = drawn[k];
    if (!clear(a, b)) {
      const from = nearestIndex(path, a, 0);
      const to = nearestIndex(path, b, from);
      shaped.push(...path.slice(from + 1, to));
    }
    shaped.push(b);
  }
  return tidy(shaped, unit(0.05));
}

/** The index of the point of `points` nearest to p, from `from` on. */
function nearestIndex(points: Point[], p: Point, from: number): number {
  let best = from;
  for (let i = from; i < points.length; i += 1) {
    if (distance(points[i], p) < distance(points[best], p)) best = i;
  }
  return best;
}

type Clear = (a: Point, b: Point) => boolean;

/**
 * Cuts out detours: where the path wanders off and comes back (round the
 * middle of a hall, say) and a straight line between the two points is clear,
 * the line goes straight. Only real detours count, ones that save at least
 * `least` and a fifth of the way, so a corridor's gentle wobbles are left to
 * the squaring, which centres the line on the corridor.
 */
function cutDetours(
  points: Point[],
  clear: Clear,
  axisAt: AxisAt,
  least: number,
  reach: number,
): Point[] {
  const along = [0];
  for (let i = 1; i < points.length; i += 1) {
    along.push(along[i - 1] + distance(points[i - 1], points[i]));
  }
  const out = [points[0]];
  let i = 0;
  while (i < points.length - 1) {
    let next = i + 1;
    // Detours are local: look a limited way ahead along the path.
    let j = i + 1;
    while (j + 1 < points.length && along[j + 1] - along[i] <= reach) j += 1;
    for (; j > i + 1; j -= 1) {
      const way = along[j] - along[i];
      const saved = way - distance(points[i], points[j]);
      // The short cut must be square already, or squarable: a slant that
      // can't be squared off is worse than the detour.
      if (
        saved >= least &&
        saved >= 0.2 * way &&
        clear(points[i], points[j]) &&
        (runsSquare(points[i], points[j], axisAt, 1) ||
          squarePiece(points[i], points[j], undefined, axisAt, clear) !== undefined)
      ) {
        next = j;
        break;
      }
    }
    out.push(points[next]);
    i = next;
  }
  return out;
}

/** Steps 1 to 4 at the top of this file: stretches snapped and centred, joined square. */
function squareUp(
  points: Point[],
  axisAt: AxisAt,
  unit: (metres: number) => number,
  clear: Clear,
): Point[] {
  const start = points[0];
  const end = points[points.length - 1];

  // 1. The real bends. The hops from the two ends onto the corridor always
  //    count, however short: smoothed into the corridor stretch they would
  //    pull its line off the corridor's middle.
  const kept = [
    ...new Set([
      ...simplifyIndexes(points, unit(SIMPLIFY_M)),
      ...(points.length > 3 ? [1, points.length - 2] : []),
    ]),
  ].sort((x, y) => x - y);

  // 2. Each stretch as a line. The short hops from the ends, and short links
  //    between stretches, are left out: the joins in steps 3 and 4 redraw them.
  type Stretch = { line: Line; from: number; to: number };
  let stretches: Stretch[] = [];
  for (let s = 1; s < kept.length; s += 1) {
    const from = kept[s - 1];
    const to = kept[s];
    const length = distance(points[from], points[to]);
    const isEnd = s === 1 || s === kept.length - 1;
    if (kept.length > 2 && length < unit(isEnd ? END_LINK_M : LINK_M)) continue;
    stretches.push({ line: lineFor(points, from, to, axisAt), from, to });
  }
  if (stretches.length === 0) return kept.map((i) => points[i]);

  // Parallel neighbours only a little apart sideways are one line down the corridor.
  const heading = (line: Line) => toDeg(Math.atan2(line.u.y, line.u.x));
  const merged: Stretch[] = [];
  for (const stretch of stretches) {
    const last = merged[merged.length - 1];
    if (
      last &&
      last.line.square &&
      stretch.line.square &&
      lineAngle(heading(last.line), heading(stretch.line)) < 1 &&
      sideways(last.line, stretch.line) < unit(MERGE_M)
    ) {
      const total = last.line.weight + stretch.line.weight;
      const w = stretch.line.weight / total;
      const p = {
        x: last.line.p.x + (stretch.line.p.x - last.line.p.x) * w,
        y: last.line.p.y + (stretch.line.p.y - last.line.p.y) * w,
      };
      merged[merged.length - 1] = {
        line: { ...last.line, p, weight: total },
        from: last.from,
        to: stretch.to,
      };
    } else {
      merged.push(stretch);
    }
  }
  stretches = merged;

  // 3 and 4. The joins, each with the original bend to fall back on.
  type Join = { tryPoints: Point[]; fallback: Point[] };
  const joins: Join[] = [];
  const first = stretches[0];
  joins.push({ tryPoints: [foot(start, first.line)], fallback: [points[first.from]] });
  for (let s = 1; s < stretches.length; s += 1) {
    const a = stretches[s - 1];
    const b = stretches[s];
    // The original bend (or the middle of the link the stretches skip over).
    const bend = {
      x: (points[a.to].x + points[b.from].x) / 2,
      y: (points[a.to].y + points[b.from].y) / 2,
    };
    const fallback = a.to === b.from ? [points[a.to]] : [points[a.to], points[b.from]];
    const angle = lineAngle(heading(a.line), heading(b.line));
    const corner = angle >= PARALLEL_DEGREES ? crossing(a.line, b.line) : undefined;
    if (corner && distance(corner, bend) <= unit(CORNER_REACH_M)) {
      joins.push({ tryPoints: [corner], fallback });
    } else {
      // A sideways step: across at the bend, square to both lines.
      joins.push({ tryPoints: [foot(bend, a.line), foot(bend, b.line)], fallback });
    }
  }
  const last = stretches[stretches.length - 1];
  joins.push({ tryPoints: [foot(end, last.line)], fallback: [points[last.to]] });

  // Lay the line, join by join, checking each new piece.
  const line: Point[] = [start];
  for (let j = 0; j < joins.length; j += 1) {
    const join = joins[j];
    // The piece into this join, through it, and on to the next join's first point.
    const next = j + 1 < joins.length ? joins[j + 1].tryPoints[0] : end;
    const route = [line[line.length - 1], ...join.tryPoints, next];
    let ok = true;
    for (let k = 1; k < route.length && ok; k += 1) ok = clear(route[k - 1], route[k]);
    line.push(...(ok ? join.tryPoints : join.fallback));
  }
  line.push(end);
  return tidy(line, unit(0.05));
}

/**
 * The last of the diagonals: a piece that doesn't run along one of the
 * building's directions becomes two pieces that do, an L, if the walls allow
 * either way round. The way that carries straight on from the piece before is
 * tried first, so the line turns as few times as it can.
 */
function squareDiagonals(points: Point[], axisAt: AxisAt, clear: Clear, tiny: number): Point[] {
  let line = points;
  for (let pass = 0; pass < 3; pass += 1) {
    let changed = false;
    const out: Point[] = [line[0]];
    for (let i = 1; i < line.length; i += 1) {
      const a = out[out.length - 1];
      const b = line[i];
      if (distance(a, b) < tiny || runsSquare(a, b, axisAt, 1)) {
        out.push(b);
        continue;
      }
      const before = out.length > 1 ? out[out.length - 2] : undefined;
      const corners = squarePiece(a, b, before, axisAt, clear);
      if (corners) {
        out.push(...corners, b);
        changed = true;
      } else {
        out.push(b);
      }
    }
    line = tidy(out, tiny);
    if (!changed) break;
  }
  return line;
}

/**
 * The corners that make the slanted piece a-b square: an L, or failing that a
 * Z, along the building direction there. The way that carries straight on
 * from the piece before (if any) is tried first. Undefined if none is clear.
 */
function squarePiece(
  a: Point,
  b: Point,
  before: Point | undefined,
  axisAt: AxisAt,
  clear: Clear,
): Point[] | undefined {
  const axis = axisAt(middle(a, b));
  const u = { x: Math.cos(toRad(axis)), y: Math.sin(toRad(axis)) };
  const v = { x: -u.y, y: u.x };
  const along = (d: Point) => (b.x - a.x) * d.x + (b.y - a.y) * d.y;
  const corners = [
    { x: a.x + u.x * along(u), y: a.y + u.y * along(u) },
    { x: a.x + v.x * along(v), y: a.y + v.y * along(v) },
  ];
  if (before) {
    const keepsOn = (c: Point) =>
      Math.abs((a.x - before.x) * (c.y - a.y) - (a.y - before.y) * (c.x - a.x)) <=
      1e-6 * distance(before, a) * distance(a, c);
    if (!keepsOn(corners[0]) && keepsOn(corners[1])) corners.reverse();
  }
  const corner = corners.find((c) => clear(a, c) && clear(c, b));
  if (corner) return [corner];
  // No L fits (a pillar or a wall is in the way of both): try a Z, across,
  // along and across again, crossing over part of the way along.
  return zigzag(a, b, u, v, clear);
}

/**
 * Irons out small steps: where a run of pieces could be one straight piece
 * along a building direction, clear of walls, it is. The corner at its far
 * end may slide (up to `slide`) along the piece after it, to make the
 * straight piece exactly square; the route's own end never moves.
 */
function straightRuns(points: Point[], axisAt: AxisAt, clear: Clear, slide: number): Point[] {
  const line = [...points];
  const out = [line[0]];
  let i = 0;
  while (i < line.length - 1) {
    let next = i + 1;
    for (let j = line.length - 1; j > i + 1; j -= 1) {
      const a = line[i];
      const b = line[j];
      const heading = toDeg(Math.atan2(b.y - a.y, b.x - a.x));
      const axis = axisAt(middle(a, b));
      const direction = [axis, axis + 90].find((d) => lineAngle(heading, d) < 3);
      if (direction === undefined) continue;
      let target = b;
      if (lineAngle(heading, direction) >= 0.01) {
        if (j === line.length - 1) continue;
        // Slide b along its next piece until a-b is square.
        const u = { x: Math.cos(toRad(direction)), y: Math.sin(toRad(direction)) };
        const after = line[j + 1];
        const length = distance(b, after) || 1;
        const w = { x: (after.x - b.x) / length, y: (after.y - b.y) / length };
        const moved = crossing(
          { p: a, u, square: true, weight: 0 },
          { p: b, u: w, square: true, weight: 0 },
        );
        if (!moved || distance(moved, b) > slide || !clear(moved, after)) continue;
        target = moved;
      }
      if (clear(a, target)) {
        line[j] = target;
        next = j;
        break;
      }
    }
    out.push(line[next]);
    i = next;
  }
  return out;
}

/**
 * A Z from a to b in three square pieces: along one direction, across, and
 * along again. Where it crosses over is tried halfway first, then nearer each
 * end. Returns the two corners, or undefined if no Z is clear.
 */
function zigzag(a: Point, b: Point, u: Point, v: Point, clear: Clear): Point[] | undefined {
  for (const [first, second] of [
    [u, v],
    [v, u],
  ]) {
    const along = (b.x - a.x) * first.x + (b.y - a.y) * first.y;
    const across = (b.x - a.x) * second.x + (b.y - a.y) * second.y;
    for (const share of [0.5, 0.35, 0.65, 0.2, 0.8]) {
      const c1 = { x: a.x + first.x * along * share, y: a.y + first.y * along * share };
      const c2 = { x: c1.x + second.x * across, y: c1.y + second.y * across };
      if (clear(a, c1) && clear(c1, c2) && clear(c2, b)) return [c1, c2];
    }
  }
  return undefined;
}

/** The walls filed by grid square, so a check only looks at the walls near it. */
type WallGrid = { cells: Map<string, Segment[]>; size: number };

const WALL_CELL = 64;

function wallGrid(walls: Segment[]): WallGrid {
  const cells = new Map<string, Segment[]>();
  for (const wall of walls) {
    const [x1, y1, x2, y2] = wall;
    for (
      let cx = Math.floor(Math.min(x1, x2) / WALL_CELL);
      cx <= Math.floor(Math.max(x1, x2) / WALL_CELL);
      cx += 1
    ) {
      for (
        let cy = Math.floor(Math.min(y1, y2) / WALL_CELL);
        cy <= Math.floor(Math.max(y1, y2) / WALL_CELL);
        cy += 1
      ) {
        const key = `${cx},${cy}`;
        const list = cells.get(key);
        if (list) list.push(wall);
        else cells.set(key, [wall]);
      }
    }
  }
  return { cells, size: WALL_CELL };
}

/** Every point where the piece a-b crosses a wall. */
function wallCrossings(a: Point, b: Point, grid: WallGrid): Point[] {
  const hits: Point[] = [];
  const [minX, maxX] = [Math.min(a.x, b.x), Math.max(a.x, b.x)];
  const [minY, maxY] = [Math.min(a.y, b.y), Math.max(a.y, b.y)];
  const near = new Set<Segment>();
  for (let cx = Math.floor(minX / grid.size); cx <= Math.floor(maxX / grid.size); cx += 1) {
    for (let cy = Math.floor(minY / grid.size); cy <= Math.floor(maxY / grid.size); cy += 1) {
      for (const wall of grid.cells.get(`${cx},${cy}`) ?? []) near.add(wall);
    }
  }
  for (const [x1, y1, x2, y2] of near) {
    if (Math.max(x1, x2) < minX || Math.min(x1, x2) > maxX) continue;
    if (Math.max(y1, y2) < minY || Math.min(y1, y2) > maxY) continue;
    const d = (b.x - a.x) * (y2 - y1) - (b.y - a.y) * (x2 - x1);
    if (d === 0) continue;
    const t = ((x1 - a.x) * (y2 - y1) - (y1 - a.y) * (x2 - x1)) / d;
    const u = ((x1 - a.x) * (b.y - a.y) - (y1 - a.y) * (b.x - a.x)) / d;
    if (t < 0 || t > 1 || u < 0 || u > 1) continue;
    hits.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  }
  return hits;
}

/** How far p is from the piece a-b. */
function distanceToPiece(p: Point, a: Point, b: Point): number {
  const length2 = (b.x - a.x) ** 2 + (b.y - a.y) ** 2;
  if (length2 === 0) return distance(p, a);
  const t = Math.max(
    0,
    Math.min(1, ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / length2),
  );
  return distance(p, { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
}

/** Drops repeated points and points in the middle of a straight run. */
function tidy(points: Point[], tiny: number): Point[] {
  const out: Point[] = [];
  points.forEach((p, i) => {
    if (out.length > 0 && distance(out[out.length - 1], p) < tiny) {
      // The route's own end wins over a new point right beside it.
      if (i === points.length - 1 && out.length > 1) out[out.length - 1] = p;
      return;
    }
    out.push(p);
  });
  for (let i = out.length - 2; i >= 1; i -= 1) {
    const a = out[i - 1];
    const b = out[i];
    const c = out[i + 1];
    const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
    const dot = (b.x - a.x) * (c.x - b.x) + (b.y - a.y) * (c.y - b.y);
    if (Math.abs(cross) <= 1e-6 * distance(a, b) * distance(b, c) && dot > 0) out.splice(i, 1);
  }
  return out;
}
