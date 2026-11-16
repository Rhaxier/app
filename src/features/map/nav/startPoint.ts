// The "I'm here" pin: a spot the student taps or drags to, snapped to the
// nearest walkable place, or refused with the router's own message when it is
// too far from any corridor or room (inside a wall, outside the building).
// There is no live positioning: the student always says where they are.
import { snapToWalkable, type GeometryIndex } from './graph.ts';
import { ROUTE_MESSAGES, type RouteEnd } from './router.ts';
import type { FloorId, Point } from './types.ts';

export type StartSnap =
  | { ok: true; end: Extract<RouteEnd, { type: 'point' }>; point: Point }
  | { ok: false; message: string };

export function snapStart(index: GeometryIndex, floor: FloorId, point: Point): StartSnap {
  const snap = snapToWalkable(index, floor, point);
  if (!snap) return { ok: false, message: ROUTE_MESSAGES['start-not-walkable'] };
  return {
    ok: true,
    end: { type: 'point', floor, x: snap.point.x, y: snap.point.y },
    point: snap.point,
  };
}
