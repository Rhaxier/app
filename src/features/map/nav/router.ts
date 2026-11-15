// The routing engine: finds a walking route between two spots in the school.
//
// It is pure code with no UI. Give it the three data layers and ask for a
// route; it answers with the path per floor, plain-English steps, a distance
// and a rough time, or with a clear reason why there is no route.
//
// How a search works:
//   1. Each end (a room, a named place, or any point on a floor) becomes a graph node.
//      A free point is snapped to the nearest walkable spot first.
//   2. A* finds the cheapest path. Cost is metres walked, plus a fixed extra for
//      each floor climbed, so stairs always cost more than staying on the flat.
//   3. In step-free mode, stairs and anything tagged `steps` or `narrow` are left out.
//   4. Lifts, stairs and doors marked unavailable are left out in every mode.

import { buildNavGraph, distance, floorGroups, indexGeometry, snapToWalkable } from './graph.ts';
import type { GeometryIndex, NavGraph } from './graph.ts';
import { NO_OVERRIDES } from './types.ts';
import type {
  Connector,
  FloorId,
  Geometry,
  MapOverrides,
  NavEdge,
  NavNode,
  Point,
  Problem,
} from './types.ts';

// ---------- tuning constants (all in one place so the team can adjust them) ----------

/** Average indoor walking speed. */
export const WALK_SPEED_M_PER_S = 1.2;
/** Climbing one floor by stairs counts like walking this many extra metres. */
export const STAIRS_COST_M = 15;
/** Riding one floor by lift (including the wait) counts like walking this many extra metres. */
export const LIFT_COST_M = 20;
export const STAIRS_SECONDS_PER_FLOOR = 15;
export const LIFT_SECONDS_PER_FLOOR = 25;
/** Cutting through a room that is neither the start nor the destination is discouraged, not banned. */
export const THROUGH_ROOM_PENALTY_M = 40;
/** A bend sharper than this (degrees) is announced as a turn. */
export const TURN_ANGLE_DEGREES = 40;
/** Wiggles smaller than this (metres) in a corridor centre-line are not worth a spoken step. */
export const STRAIGHTEN_M = 2;
/** A jog shorter than this (metres) between two bends is folded into one bend. */
export const SHORT_JOG_M = 4;

// ---------- public types ----------

export type RouteMode = 'standard' | 'step-free';

/** Where a route starts or ends. `point` is the "pointer" case: any spot on a floor. */
export type RouteEnd =
  | { type: 'room'; id: string }
  | { type: 'place'; id: string }
  | { type: 'point'; floor: FloorId; x: number; y: number };

export type RouteStepKind = 'start' | 'walk' | 'turn' | 'stairs' | 'lift' | 'arrive';

export type RouteStep = {
  kind: RouteStepKind;
  /** Ready to show, e.g. "Take the stairs up to First Floor". */
  text: string;
  floor: FloorId;
  distanceM: number;
  durationS: number;
  /** Set on stairs and lift steps. */
  connector?: string;
};

/** One unbroken stretch of the path on a single floor, in map coordinates, in walking order. */
export type RouteLeg = { floor: FloorId; points: Point[] };

export type RouteOk = {
  ok: true;
  mode: RouteMode;
  distanceM: number;
  durationS: number;
  legs: RouteLeg[];
  steps: RouteStep[];
  /** Connector ids used, in order. Handy for highlighting them on the map. */
  connectors: string[];
};

export type RouteErrorCode =
  | 'unknown-start'
  | 'unknown-destination'
  | 'start-not-walkable'
  | 'destination-not-walkable'
  | 'floors-not-connected'
  | 'no-step-free-route'
  | 'blocked'
  | 'unreachable';

export type RouteError = { ok: false; code: RouteErrorCode; message: string };

export type RouteResult = RouteOk | RouteError;

export type Router = {
  route(from: RouteEnd, to: RouteEnd, options?: { mode?: RouteMode }): RouteResult;
  /** Call after an admin adds, moves, deletes or edits a connector. Rebuilds the connector layer. */
  setConnectors(connectors: Connector[]): void;
  /** Call after a door is closed/opened or an edge is tagged. */
  setOverrides(overrides: MapOverrides): void;
  /** Display names by room/place id (from the term's assignments), used in the step text. */
  setNames(names: Record<string, string>): void;
  /** Problems from linking the current connectors (for the admin validation panel). */
  problems(): Problem[];
  graph(): NavGraph;
};

export const ROUTE_MESSAGES: Record<RouteErrorCode, string> = {
  'unknown-start': "We couldn't find that starting point on the map.",
  'unknown-destination': "We couldn't find that destination on the map.",
  'start-not-walkable': "That starting point isn't somewhere you can walk.",
  'destination-not-walkable': "That destination isn't somewhere you can walk.",
  'floors-not-connected':
    "These floors aren't connected yet: an admin needs to add stairs or a lift.",
  'no-step-free-route': 'No step-free route to this room right now.',
  blocked: 'No route right now: a lift, staircase or door on the way is out of order.',
  unreachable: "This room can't be reached from there.",
};

// ---------- the search ----------

type Rules = { stepFree: boolean; respectAvailability: boolean };

/** Extra nodes and edges that exist only for one search (the snapped start and end points). */
type Overlay = { nodes: Map<string, NavNode>; edges: Map<string, NavEdge[]> };

type Found = { nodes: NavNode[]; edges: NavEdge[] };

function edgeUsable(graph: NavGraph, edge: NavEdge, rules: Rules): boolean {
  const connector = edge.connector ? graph.connectors.get(edge.connector) : undefined;
  if (rules.respectAvailability) {
    if (edge.door && graph.overrides.doorAvailable[edge.door] === false) {
      return false;
    }
    if (connector && !connector.available) {
      return false;
    }
  }
  if (rules.stepFree) {
    if (edge.kind === 'stairs' || (edge.kind === 'lift' && connector && !connector.accessible)) {
      return false;
    }
    if (edge.tags?.includes('steps') || edge.tags?.includes('narrow')) {
      return false;
    }
  }
  return true;
}

/** A small binary min-heap of [priority, node id]. */
function createQueue() {
  const heap: [number, string][] = [];
  return {
    get size() {
      return heap.length;
    },
    push(priority: number, id: string) {
      heap.push([priority, id]);
      let at = heap.length - 1;
      while (at > 0) {
        const parent = (at - 1) >> 1;
        if (heap[parent][0] <= heap[at][0]) {
          break;
        }
        [heap[parent], heap[at]] = [heap[at], heap[parent]];
        at = parent;
      }
    },
    pop(): [number, string] {
      const top = heap[0];
      const last = heap.pop() as [number, string];
      if (heap.length > 0) {
        heap[0] = last;
        let at = 0;
        for (;;) {
          const left = at * 2 + 1;
          const right = left + 1;
          let smallest = at;
          if (left < heap.length && heap[left][0] < heap[smallest][0]) {
            smallest = left;
          }
          if (right < heap.length && heap[right][0] < heap[smallest][0]) {
            smallest = right;
          }
          if (smallest === at) {
            break;
          }
          [heap[smallest], heap[at]] = [heap[at], heap[smallest]];
          at = smallest;
        }
      }
      return top;
    },
  };
}

function findPath(
  graph: NavGraph,
  overlay: Overlay,
  startId: string,
  goalId: string,
  rules: Rules,
): Found | undefined {
  const metresPerUnit = graph.index.geometry.metresPerUnit;
  const levelOf = new Map(graph.index.geometry.floors.map((floor) => [floor.id, floor.level]));
  const nodeOf = (id: string) => overlay.nodes.get(id) ?? graph.nodes.get(id);
  const goal = nodeOf(goalId);
  const start = nodeOf(startId);
  if (!goal || !start) {
    return undefined;
  }
  // Straight-line distance never overestimates the walk, which is what A* needs.
  // On another floor we cannot say anything useful, so the estimate is zero.
  const estimate = (node: NavNode) =>
    node.floor === goal.floor ? distance(node, goal) * metresPerUnit : 0;

  const best = new Map<string, number>([[startId, 0]]);
  const cameBy = new Map<string, { edge: NavEdge; from: string }>();
  const done = new Set<string>();
  const queue = createQueue();
  queue.push(estimate(start), startId);

  while (queue.size > 0) {
    const [, id] = queue.pop();
    if (done.has(id)) {
      continue;
    }
    done.add(id);
    if (id === goalId) {
      break;
    }
    const here = nodeOf(id) as NavNode;
    const soFar = best.get(id) as number;
    for (const edge of [...(graph.adjacency.get(id) ?? []), ...(overlay.edges.get(id) ?? [])]) {
      if (!edgeUsable(graph, edge, rules)) {
        continue;
      }
      const nextId = edge.a === id ? edge.b : edge.a;
      const next = nodeOf(nextId);
      if (!next || done.has(nextId)) {
        continue;
      }
      let cost = edge.length * metresPerUnit;
      if (edge.kind !== 'walk') {
        const floors = Math.abs((levelOf.get(next.floor) ?? 0) - (levelOf.get(here.floor) ?? 0));
        cost = floors * (edge.kind === 'stairs' ? STAIRS_COST_M : LIFT_COST_M);
      }
      if (next.kind === 'room' && nextId !== goalId) {
        cost += THROUGH_ROOM_PENALTY_M;
      }
      const total = soFar + cost;
      if (total < (best.get(nextId) ?? Infinity)) {
        best.set(nextId, total);
        cameBy.set(nextId, { edge, from: id });
        queue.push(total + estimate(next), nextId);
      }
    }
  }

  if (!done.has(goalId)) {
    return undefined;
  }
  const nodes: NavNode[] = [goal];
  const edges: NavEdge[] = [];
  let at = goalId;
  while (at !== startId) {
    const step = cameBy.get(at) as { edge: NavEdge; from: string };
    edges.unshift(step.edge);
    nodes.unshift(nodeOf(step.from) as NavNode);
    at = step.from;
  }
  return { nodes, edges };
}

// ---------- turning the ends into graph nodes ----------

type ResolvedEnd = {
  nodeId: string;
  floor: FloorId;
  isRoom: boolean;
  name?: string;
  snapEdge?: NavEdge;
  snapPoint?: Point;
};

function resolveEnd(
  graph: NavGraph,
  overlay: Overlay,
  end: RouteEnd,
  role: 'start' | 'end',
  names: Record<string, string>,
): ResolvedEnd | 'unknown' | 'not-walkable' {
  const index = graph.index;
  if (end.type === 'room') {
    const region = index.regions.get(end.id);
    const node = index.geometry.nodes.find(
      (candidate) => candidate.kind === 'room' && candidate.region === end.id,
    );
    if (!region || !node) {
      return 'unknown';
    }
    return {
      nodeId: node.id,
      floor: node.floor,
      isRoom: true,
      name: names[end.id] || region.sourceLabel,
    };
  }
  if (end.type === 'place') {
    const place = index.geometry.places.find((candidate) => candidate.id === end.id);
    const node = index.geometry.nodes.find((candidate) => candidate.place === end.id);
    if (!place || !node) {
      return 'unknown';
    }
    return {
      nodeId: node.id,
      floor: node.floor,
      isRoom: false,
      name: names[end.id] || place.sourceLabel,
    };
  }
  if (!index.edgesByFloor.has(end.floor)) {
    return 'unknown';
  }
  const snap = snapToWalkable(index, end.floor, end);
  if (!snap) {
    return 'not-walkable';
  }
  // Two temporary nodes: the point itself, and the spot on the graph nearest to it.
  // The snap node joins both ends of the edge it landed on.
  const pointId = `__${role}`;
  const snapId = `__${role}:snap`;
  overlay.nodes.set(pointId, {
    id: pointId,
    floor: end.floor,
    x: end.x,
    y: end.y,
    kind: 'snap',
    region: snap.region,
  });
  overlay.nodes.set(snapId, {
    id: snapId,
    floor: end.floor,
    x: snap.point.x,
    y: snap.point.y,
    kind: 'snap',
    region: snap.region,
  });
  const a = index.nodes.get(snap.edge.a) as NavNode;
  const b = index.nodes.get(snap.edge.b) as NavNode;
  const inherited = { kind: 'walk' as const, tags: snap.edge.tags, door: snap.edge.door };
  addOverlayEdge(overlay, {
    id: `${pointId}>snap`,
    a: pointId,
    b: snapId,
    length: snap.distance,
    kind: 'walk',
  });
  addOverlayEdge(overlay, {
    id: `${snapId}>a`,
    a: snapId,
    b: a.id,
    length: distance(snap.point, a),
    ...inherited,
  });
  addOverlayEdge(overlay, {
    id: `${snapId}>b`,
    a: snapId,
    b: b.id,
    length: distance(snap.point, b),
    ...inherited,
  });
  return {
    nodeId: pointId,
    floor: end.floor,
    isRoom: false,
    snapEdge: snap.edge,
    snapPoint: snap.point,
  };
}

function addOverlayEdge(overlay: Overlay, edge: NavEdge) {
  for (const end of [edge.a, edge.b]) {
    overlay.edges.set(end, [...(overlay.edges.get(end) ?? []), edge]);
  }
}

// ---------- turning a path into legs and steps ----------

/** Ramer-Douglas-Peucker: drops the small wiggles of a centre-line so only real bends remain. */
function simplify(points: Point[], tolerance: number): Point[] {
  if (points.length < 3) {
    return points;
  }
  const first = points[0];
  const last = points[points.length - 1];
  const length = distance(first, last) || 1;
  let worst = 0;
  let worstAt = 0;
  for (let i = 1; i < points.length - 1; i += 1) {
    const offLine =
      Math.abs(
        (last.y - first.y) * (points[i].x - first.x) - (last.x - first.x) * (points[i].y - first.y),
      ) / length;
    if (offLine > worst) {
      worst = offLine;
      worstAt = i;
    }
  }
  if (worst <= tolerance) {
    return [first, last];
  }
  return [
    ...simplify(points.slice(0, worstAt + 1), tolerance).slice(0, -1),
    ...simplify(points.slice(worstAt), tolerance),
  ];
}

/**
 * Replaces each very short middle segment by its midpoint. A corridor centre-line often
 * steps sideways for a metre or two at a junction; saying "turn left, turn right" there
 * would only confuse. The drawn path is not affected, only the spoken steps.
 */
function foldJogs(points: Point[], shortest: number): Point[] {
  let line = points;
  for (;;) {
    let folded = false;
    for (let i = 1; i < line.length - 2; i += 1) {
      if (distance(line[i], line[i + 1]) < shortest) {
        const middle = { x: (line[i].x + line[i + 1].x) / 2, y: (line[i].y + line[i + 1].y) / 2 };
        line = [...line.slice(0, i), middle, ...line.slice(i + 2)];
        folded = true;
        break;
      }
    }
    if (!folded) {
      return line;
    }
  }
}

/** Signed bend from heading a->b to heading b->c in degrees. Positive = right (y grows downward on the map). */
function bend(a: Point, b: Point, c: Point): number {
  const before = Math.atan2(b.y - a.y, b.x - a.x);
  const after = Math.atan2(c.y - b.y, c.x - b.x);
  let degrees = ((after - before) * 180) / Math.PI;
  while (degrees > 180) {
    degrees -= 360;
  }
  while (degrees <= -180) {
    degrees += 360;
  }
  return degrees;
}

function describe(
  graph: NavGraph,
  found: Found,
  mode: RouteMode,
  start: ResolvedEnd,
  end: ResolvedEnd,
): RouteOk {
  const geometry = graph.index.geometry;
  const metresPerUnit = geometry.metresPerUnit;
  const floorOf = new Map(geometry.floors.map((floor) => [floor.id, floor]));
  const legs: RouteLeg[] = [];
  const steps: RouteStep[] = [];
  const used: string[] = [];
  let totalM = 0;
  let totalS = 0;

  steps.push({
    kind: 'start',
    floor: start.floor,
    distanceM: 0,
    durationS: 0,
    text: start.isRoom
      ? `Leave ${start.name ?? 'the room'}`
      : start.name
        ? `Start at ${start.name}`
        : 'Start from your spot on the map',
  });

  // Split the path into runs: walking on one floor, then a ride or climb, then walking again.
  let at = 0;
  while (at < found.nodes.length) {
    let runEnd = at;
    while (runEnd < found.edges.length && found.edges[runEnd].kind === 'walk') {
      runEnd += 1;
    }
    const run = found.nodes.slice(at, runEnd + 1);
    const isFirst = at === 0;
    const isLast = runEnd === found.edges.length;
    const next = isLast ? undefined : found.edges[runEnd];
    const nextConnector = next?.connector ? graph.connectors.get(next.connector) : undefined;

    if (run.length > 1) {
      legs.push({ floor: run[0].floor, points: run.map((node) => ({ x: node.x, y: node.y })) });
      let runM = 0;
      for (let i = 1; i < run.length; i += 1) {
        runM += distance(run[i - 1], run[i]) * metresPerUnit;
      }
      totalM += runM;
      totalS += runM / WALK_SPEED_M_PER_S;

      // For the spoken steps, ignore the bit inside a room: start at its door, stop at the corridor outside the destination.
      let spoken = run;
      if (isFirst && start.isRoom && spoken.length > 2) {
        spoken = spoken.slice(1);
      }
      let side: string | undefined;
      if (isLast && end.isRoom && spoken.length >= 3) {
        const door = spoken[spoken.length - 2];
        spoken = spoken.slice(0, -2);
        if (spoken.length >= 2) {
          const turn = bend(spoken[spoken.length - 2], spoken[spoken.length - 1], door);
          side = Math.abs(turn) < 30 ? 'straight ahead' : turn > 0 ? 'on the right' : 'on the left';
        }
      }
      const line = foldJogs(
        simplify(spoken, STRAIGHTEN_M / metresPerUnit),
        SHORT_JOG_M / metresPerUnit,
      );
      let stretchM = 0;
      const flush = (suffix: string) => {
        if (stretchM >= 1 || suffix !== '') {
          const metres = Math.max(1, Math.round(stretchM));
          steps.push({
            kind: 'walk',
            floor: run[0].floor,
            distanceM: metres,
            durationS: Math.round(stretchM / WALK_SPEED_M_PER_S),
            text: `Walk ${metres} m${suffix}`,
          });
        }
        stretchM = 0;
      };
      for (let i = 1; i < line.length; i += 1) {
        if (i >= 2) {
          const turn = bend(line[i - 2], line[i - 1], line[i]);
          if (Math.abs(turn) >= TURN_ANGLE_DEGREES) {
            flush('');
            steps.push({
              kind: 'turn',
              floor: run[0].floor,
              distanceM: 0,
              durationS: 0,
              text: turn > 0 ? 'Turn right' : 'Turn left',
            });
          }
        }
        stretchM += distance(line[i - 1], line[i]) * metresPerUnit;
      }
      flush(
        nextConnector
          ? ` to the ${nextConnector.type === 'lift' ? 'lift' : 'stairs'} (${nextConnector.name})`
          : '',
      );
      if (isLast) {
        const name = end.name;
        const text = end.isRoom
          ? `Your destination${name ? `, ${name},` : ''} is ${side ?? 'here'}`
          : name
            ? `You have arrived at ${name}`
            : 'You have arrived';
        steps.push({ kind: 'arrive', floor: end.floor, distanceM: 0, durationS: 0, text });
      }
    } else if (isLast) {
      steps.push({
        kind: 'arrive',
        floor: end.floor,
        distanceM: 0,
        durationS: 0,
        text: end.name ? `You have arrived at ${end.name}` : 'You have arrived',
      });
    }
    if (isLast || !next) {
      break;
    }

    // One step for the whole ride, even when it passes several floors.
    let rideEnd = runEnd;
    while (
      rideEnd < found.edges.length &&
      found.edges[rideEnd].kind !== 'walk' &&
      found.edges[rideEnd].connector === next.connector
    ) {
      rideEnd += 1;
    }
    const from = found.nodes[runEnd];
    const to = found.nodes[rideEnd];
    const floors = Math.abs(
      (floorOf.get(to.floor)?.level ?? 0) - (floorOf.get(from.floor)?.level ?? 0),
    );
    const up = (floorOf.get(to.floor)?.level ?? 0) > (floorOf.get(from.floor)?.level ?? 0);
    const seconds =
      floors * (next.kind === 'lift' ? LIFT_SECONDS_PER_FLOOR : STAIRS_SECONDS_PER_FLOOR);
    totalS += seconds;
    if (next.connector) {
      used.push(next.connector);
    }
    steps.push({
      kind: next.kind === 'lift' ? 'lift' : 'stairs',
      floor: from.floor,
      distanceM: 0,
      durationS: seconds,
      connector: next.connector,
      text: `Take the ${next.kind === 'lift' ? 'lift' : 'stairs'} ${up ? 'up' : 'down'} to ${floorOf.get(to.floor)?.name ?? to.floor}`,
    });
    at = rideEnd;
  }

  return {
    ok: true,
    mode,
    distanceM: Math.round(totalM),
    durationS: Math.round(totalS),
    legs,
    steps,
    connectors: used,
  };
}

// ---------- the router ----------

/**
 * Creates a router over the map data. Keep one instance and call `setConnectors`
 * or `setOverrides` when the admin-editable layers change; the geometry is
 * indexed only once.
 */
export function createRouter(
  geometry: Geometry,
  connectors: Connector[] = [],
  overrides: MapOverrides = NO_OVERRIDES,
  names: Record<string, string> = {},
): Router {
  const index: GeometryIndex = indexGeometry(geometry);
  let currentConnectors = connectors;
  let currentOverrides = overrides;
  let currentNames = names;
  let graph = buildNavGraph(index, currentConnectors, currentOverrides);

  const fail = (code: RouteErrorCode): RouteError => ({
    ok: false,
    code,
    message: ROUTE_MESSAGES[code],
  });

  function route(from: RouteEnd, to: RouteEnd, options: { mode?: RouteMode } = {}): RouteResult {
    const mode = options.mode ?? 'standard';
    const overlay: Overlay = { nodes: new Map(), edges: new Map() };
    const start = resolveEnd(graph, overlay, from, 'start', currentNames);
    if (typeof start === 'string') {
      return fail(start === 'unknown' ? 'unknown-start' : 'start-not-walkable');
    }
    const end = resolveEnd(graph, overlay, to, 'end', currentNames);
    if (typeof end === 'string') {
      return fail(end === 'unknown' ? 'unknown-destination' : 'destination-not-walkable');
    }
    // Two points snapped onto the same edge can walk straight to each other.
    if (
      start.snapEdge &&
      end.snapEdge &&
      start.snapEdge.id === end.snapEdge.id &&
      start.snapPoint &&
      end.snapPoint
    ) {
      addOverlayEdge(overlay, {
        id: '__direct',
        a: '__start:snap',
        b: '__end:snap',
        length: distance(start.snapPoint, end.snapPoint),
        kind: 'walk',
        tags: start.snapEdge.tags,
        door: start.snapEdge.door,
      });
    }

    const stepFree = mode === 'step-free';
    const found = findPath(graph, overlay, start.nodeId, end.nodeId, {
      stepFree,
      respectAvailability: true,
    });
    if (found) {
      return describe(graph, found, mode, start, end);
    }

    // No route. Work out the most helpful reason, from the most basic cause upward.
    if (start.floor !== end.floor) {
      const groups = floorGroups(index, graph.edges, graph.nodes);
      const together = groups.some(
        (group) => group.includes(start.floor) && group.includes(end.floor),
      );
      if (!together) {
        return fail('floors-not-connected');
      }
    }
    if (
      !findPath(graph, overlay, start.nodeId, end.nodeId, {
        stepFree: false,
        respectAvailability: false,
      })
    ) {
      return fail('unreachable');
    }
    if (
      stepFree &&
      !findPath(graph, overlay, start.nodeId, end.nodeId, {
        stepFree: true,
        respectAvailability: false,
      })
    ) {
      return fail('no-step-free-route');
    }
    // A route exists on paper but something on it is out of order. For a wheelchair user the
    // useful message is still "no step-free route right now".
    return fail(stepFree ? 'no-step-free-route' : 'blocked');
  }

  return {
    route,
    setConnectors(next) {
      currentConnectors = next;
      graph = buildNavGraph(index, currentConnectors, currentOverrides);
    },
    setOverrides(next) {
      currentOverrides = next;
      graph = buildNavGraph(index, currentConnectors, currentOverrides);
    },
    setNames(next) {
      currentNames = next;
    },
    problems: () => graph.link.problems,
    graph: () => graph,
  };
}
