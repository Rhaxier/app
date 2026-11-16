// What the student map shows for a route: which part of the line is on the
// floor in view, where the floor changes are, and the numbers in words.
// Pure functions over the router's result, tested in routeView.test.ts.
import type { RouteLeg, RouteOk, RouteStep } from './router.ts';
import type { FloorId, Point } from './types.ts';

/** The stretches of the route on one floor (usually one; more if the route comes back). */
export function legsOnFloor(result: RouteOk, floor: FloorId): RouteLeg[] {
  return result.legs.filter((leg) => leg.floor === floor && leg.points.length > 1);
}

export type FloorChange = {
  fromFloor: FloorId;
  toFloor: FloorId;
  /** Where on `fromFloor` the stairs or lift are (the end of that floor's stretch). */
  at: Point;
  /** "Take the lift up to Second Floor" (the router's own words). */
  text: string;
  connector?: string;
};

/**
 * One entry per change of floor, in walking order. The k-th change between
 * stretches goes with the k-th stairs or lift step, which has the words.
 */
export function floorChanges(result: RouteOk): FloorChange[] {
  const moves = result.steps.filter((step) => step.kind === 'stairs' || step.kind === 'lift');
  const changes: FloorChange[] = [];
  for (let i = 0; i + 1 < result.legs.length; i += 1) {
    const here = result.legs[i];
    const next = result.legs[i + 1];
    if (here.floor === next.floor || here.points.length === 0) continue;
    const step = moves[changes.length];
    changes.push({
      fromFloor: here.floor,
      toFloor: next.floor,
      at: here.points[here.points.length - 1],
      text: step?.text ?? `Go to floor ${next.floor}`,
      connector: step?.connector,
    });
  }
  return changes;
}

/** The floor to show for a step: where you are when you do it. */
export function stepFloor(step: RouteStep): FloorId {
  return step.floor;
}

/** The floor to show first for a new route: where it starts. */
export function startFloor(result: RouteOk): FloorId | undefined {
  return result.legs[0]?.floor ?? result.steps[0]?.floor;
}

/**
 * Route line width in pixels for a map zoom level. Leaflet keeps strokes the
 * same width at every zoom, so the line is scaled by hand: thin when the
 * whole school is in view, bolder close up, never thinner than 3 px.
 */
export function routeLineWeight(zoom: number): number {
  const weight = 5 * Math.pow(2, (zoom + 1) / 2);
  return Math.round(Math.min(14, Math.max(3, weight)) * 10) / 10;
}

export const formatDistance = (metres: number) =>
  metres < 10 ? `${Math.max(1, Math.round(metres))} m` : `${Math.round(metres / 5) * 5} m`;

export const formatDuration = (seconds: number) =>
  seconds < 60 ? 'under a minute' : `about ${Math.round(seconds / 60)} min`;

/** "Ground floor", "Floor 2". */
export const floorLabel = (floor: FloorId) => (floor === 'G' ? 'Ground floor' : `Floor ${floor}`);
