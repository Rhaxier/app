// What the student map shows for a route: which part of the line is on the
// floor in view, where the floor changes are, and the numbers in words.
// Pure functions over the router's result, tested in routeView.test.ts.
import type { RouteLeg, RouteOk, RouteResult, RouteStep } from './router.ts';
import type { Connector, FloorId, Point } from './types.ts';

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

export type DetourNotice = {
  /** Shown on the route, e.g. "Lift 1 is out of order, so this route goes another way." */
  text: string;
  /** For the toast when an open route changes: "Lift 1 is out of order." */
  short: string;
};

/**
 * Why the route isn't the usual one, if something out of service is the
 * reason. `ideal` is the same trip worked out with every lift, staircase and
 * door in service: if it uses one that is out of order now, that's the
 * reason. Closed doors don't say which, so they only explain a longer route.
 */
export function detourNotice(
  real: RouteResult | null,
  ideal: RouteResult | null,
  connectors: Pick<Connector, 'id' | 'name' | 'available'>[],
  doorsClosed: boolean,
): DetourNotice | null {
  if (!real || !ideal || !ideal.ok) return null;
  const down = ideal.connectors
    .map((id) => connectors.find((c) => c.id === id))
    .filter((c): c is Pick<Connector, 'id' | 'name' | 'available'> => Boolean(c && !c.available));
  const names = [...new Set(down.map((c) => c.name))];
  if (names.length > 0) {
    const who =
      names.length === 1
        ? `${names[0]} is`
        : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]} are`;
    const short = `${who} out of order.`;
    if (!real.ok) {
      const what =
        real.code === 'no-step-free-route' ? 'No step-free route right now' : 'No route right now';
      return { text: `${what}: ${who} out of order.`, short };
    }
    return { text: `${who} out of order, so this route goes another way.`, short };
  }
  if (doorsClosed) {
    if (!real.ok) {
      return {
        text: 'No route right now: a door on the way is closed.',
        short: 'A door on the way is closed.',
      };
    }
    if (real.distanceM > ideal.distanceM + 1) {
      return {
        text: 'A door on the usual way is closed, so this route is longer.',
        short: 'A door on the usual way is closed.',
      };
    }
  }
  return null;
}
