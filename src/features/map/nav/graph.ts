// Builds the routing graph from the three data layers.
//
// The geometry file already holds the walkable graph of each floor on its own.
// This file adds the admin-placed connectors (stairs and lifts) on top: it
// snaps each one to the nearest walkable point, adds the nodes and edges that
// make it reachable, and links its positions on different floors.
//
// Everything here is a pure function of its inputs, with no randomness and a
// fixed processing order, so the same data always gives the same graph. It is
// cheap enough (a few hundred segments per floor) to re-run on every mouse
// move while an admin drags a connector.

import type {
  Connector,
  EdgeTag,
  FloorId,
  Geometry,
  MapOverrides,
  NavEdge,
  NavNode,
  Point,
  Problem,
  Region,
} from './types.ts';
import { NO_OVERRIDES } from './types.ts';

/** A point that is this close (in metres) to a walkable area still counts as inside it. */
export const OUTSIDE_TOLERANCE_M = 1;
/** Rooms whose door is within this many metres of a connector are listed as "next to" it. */
export const NEARBY_RADIUS_M = 10;

// ---------- small geometry helpers ----------

export function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Standard ray-casting test. Points exactly on the outline may land on either side. */
export function pointInPolygon(point: Point, polygon: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    const crosses = yi > point.y !== yj > point.y;
    if (crosses && point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

/** The closest point to `p` on the segment a-b, and how far along it lies (0 = a, 1 = b). */
export function projectOnSegment(p: Point, a: Point, b: Point): { point: Point; t: number } {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) {
    return { point: { x: a.x, y: a.y }, t: 0 };
  }
  const raw = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSquared;
  const t = Math.max(0, Math.min(1, raw));
  return { point: { x: a.x + dx * t, y: a.y + dy * t }, t };
}

// ---------- index over the geometry (build once, reuse) ----------

export type GeometryIndex = {
  geometry: Geometry;
  nodes: Map<string, NavNode>;
  regions: Map<string, Region>;
  /** Walkable regions per floor (everything except voids). */
  walkableByFloor: Map<FloorId, Region[]>;
  /** Walk edges per floor, in file order. */
  edgesByFloor: Map<FloorId, NavEdge[]>;
  /** Node id -> id of the connected piece of its floor that it belongs to. */
  component: Map<string, string>;
  /** Floor -> the component holding the most nodes (the floor's main walkable area). */
  mainComponent: Map<FloorId, string>;
  /** Ids of doors marked `restricted` (not for students). */
  restrictedDoors: Set<string>;
};

export function indexGeometry(geometry: Geometry): GeometryIndex {
  const nodes = new Map(geometry.nodes.map((node) => [node.id, node]));
  const regions = new Map(geometry.regions.map((region) => [region.id, region]));
  const walkableByFloor = new Map<FloorId, Region[]>();
  const edgesByFloor = new Map<FloorId, NavEdge[]>();
  for (const floor of geometry.floors) {
    walkableByFloor.set(floor.id, []);
    edgesByFloor.set(floor.id, []);
  }
  for (const region of geometry.regions) {
    if (region.kind !== 'void') {
      walkableByFloor.get(region.floor)?.push(region);
    }
  }
  for (const edge of geometry.edges) {
    const from = nodes.get(edge.a);
    if (from) {
      edgesByFloor.get(from.floor)?.push(edge);
    }
  }

  // Union-find: which nodes can reach each other inside one floor.
  const parent = new Map<string, string>();
  const find = (id: string): string => {
    let root = id;
    while (parent.get(root) !== root) {
      root = parent.get(root) as string;
    }
    parent.set(id, root);
    return root;
  };
  for (const node of geometry.nodes) {
    parent.set(node.id, node.id);
  }
  for (const edge of geometry.edges) {
    if (parent.has(edge.a) && parent.has(edge.b)) {
      parent.set(find(edge.a), find(edge.b));
    }
  }
  const component = new Map<string, string>();
  const sizes = new Map<string, number>();
  for (const node of geometry.nodes) {
    const root = find(node.id);
    component.set(node.id, root);
    sizes.set(root, (sizes.get(root) ?? 0) + 1);
  }
  const mainComponent = new Map<FloorId, string>();
  for (const node of geometry.nodes) {
    const root = component.get(node.id) as string;
    const best = mainComponent.get(node.floor);
    if (best === undefined || (sizes.get(root) ?? 0) > (sizes.get(best) ?? 0)) {
      mainComponent.set(node.floor, root);
    }
  }
  const restrictedDoors = new Set(
    geometry.doors.filter((door) => door.restricted).map((door) => door.id),
  );
  return {
    geometry,
    nodes,
    regions,
    walkableByFloor,
    edgesByFloor,
    component,
    mainComponent,
    restrictedDoors,
  };
}

// ---------- snapping a free point to the walkable graph ----------

export type Snap = {
  floor: FloorId;
  /** The point on the walkable graph. */
  point: Point;
  /** How far the original point was from it, in map units. */
  distance: number;
  /** The edge that was hit and where along it (0 = edge.a, 1 = edge.b). */
  edge: NavEdge;
  t: number;
  /** The walkable region the original point stands in, if any. */
  region?: string;
};

/** The walkable region containing the point, or undefined. Regions are checked in file order. */
export function regionAt(index: GeometryIndex, floor: FloorId, point: Point): Region | undefined {
  for (const region of index.walkableByFloor.get(floor) ?? []) {
    const inHole = (region.holes ?? []).some((hole) => pointInPolygon(point, hole));
    if (!inHole && pointInPolygon(point, region.polygon)) {
      return region;
    }
  }
  return undefined;
}

/**
 * Snaps a point to the nearest spot on the floor's walkable graph.
 *
 * If the point stands inside a region, only that region's own edges are
 * considered first, so a click inside a stairwell does not attach through a
 * wall to the corridor next door. Returns undefined when the point is outside
 * every walkable area (allowing a small tolerance for clicks on a wall line).
 */
export function snapToWalkable(
  index: GeometryIndex,
  floor: FloorId,
  point: Point,
): Snap | undefined {
  const edges = index.edgesByFloor.get(floor) ?? [];
  const region = regionAt(index, floor, point);

  const nearest = (candidates: NavEdge[]): Snap | undefined => {
    let best: Snap | undefined;
    for (const edge of candidates) {
      const a = index.nodes.get(edge.a);
      const b = index.nodes.get(edge.b);
      if (!a || !b) {
        continue;
      }
      const hit = projectOnSegment(point, a, b);
      const d = distance(point, hit.point);
      // Strict "<" keeps the first edge in file order on a tie, which makes the result deterministic.
      if (!best || d < best.distance) {
        best = { floor, point: hit.point, distance: d, edge, t: hit.t, region: region?.id };
      }
    }
    return best;
  };

  if (region) {
    const own = edges.filter(
      (edge) =>
        index.nodes.get(edge.a)?.region === region.id ||
        index.nodes.get(edge.b)?.region === region.id,
    );
    return nearest(own) ?? nearest(edges);
  }
  const fallback = nearest(edges);
  const tolerance = OUTSIDE_TOLERANCE_M / index.geometry.metresPerUnit;
  return fallback && fallback.distance <= tolerance ? fallback : undefined;
}

// ---------- linking connectors ----------

export type ConnectorStop = {
  connector: string;
  floor: FloorId;
  position: Point;
  snap: Snap;
  /** Names (ids) of regions next to this stop: the one it stands in plus rooms with a door close by. */
  nextTo: string[];
};

export type LinkResult = {
  nodes: NavNode[];
  edges: NavEdge[];
  stops: ConnectorStop[];
  problems: Problem[];
};

export const connectorNodeId = (connector: string, floor: FloorId) => `conn:${connector}:${floor}`;

function regionsNear(
  index: GeometryIndex,
  floor: FloorId,
  point: Point,
  standingIn: string | undefined,
): string[] {
  const radius = NEARBY_RADIUS_M / index.geometry.metresPerUnit;
  const found = new Set<string>();
  if (standingIn) {
    found.add(standingIn);
  }
  for (const door of index.geometry.doors) {
    if (door.floor === floor && distance(door, point) <= radius) {
      for (const side of [door.a, door.b]) {
        if (index.regions.has(side)) {
          found.add(side);
        }
      }
    }
  }
  return [...found].sort();
}

/**
 * Makes every connector reachable and links its floors.
 *
 * For each stop it adds a connector node at the admin's position and a snap
 * node on the nearest walkable edge, then joins consecutive stops of the same
 * connector with a vertical edge. Nothing in the geometry is modified: the
 * result is an extra layer of nodes and edges that is rebuilt from scratch
 * each time, so moving or deleting a connector can never leave stale links.
 *
 * It never throws on bad data. Every issue comes back in `problems`.
 */
export function linkConnectors(index: GeometryIndex, connectors: Connector[]): LinkResult {
  const result: LinkResult = { nodes: [], edges: [], stops: [], problems: [] };
  const levelOf = new Map(index.geometry.floors.map((floor) => [floor.id, floor.level]));
  // Fixed order (by id) so the output does not depend on how the admin list happens to be sorted.
  const ordered = [...connectors].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  for (const connector of ordered) {
    const label = `${connector.type === 'lift' ? 'Lift' : 'Stairs'} "${connector.name}"`;
    const floors = [...new Set(connector.floors)]
      .filter((floor) => {
        if (levelOf.has(floor)) {
          return true;
        }
        result.problems.push({
          severity: 'error',
          code: 'connector-unknown-floor',
          connector: connector.id,
          floor,
          message: `${label} lists floor "${floor}", which does not exist.`,
        });
        return false;
      })
      .sort((a, b) => (levelOf.get(a) as number) - (levelOf.get(b) as number));

    const linked: ConnectorStop[] = [];
    for (const floor of floors) {
      const position = connector.positions[floor];
      if (!position) {
        result.problems.push({
          severity: 'error',
          code: 'connector-missing-floor',
          connector: connector.id,
          floor,
          message: `${label} says it serves floor ${floor} but has no position there.`,
        });
        continue;
      }
      const snap = snapToWalkable(index, floor, position);
      if (!snap) {
        result.problems.push({
          severity: 'error',
          code: 'connector-outside-walkable',
          connector: connector.id,
          floor,
          message: `${label} on floor ${floor} is outside any walkable area.`,
        });
        continue;
      }
      const nodeId = connectorNodeId(connector.id, floor);
      const snapId = `snap:${connector.id}:${floor}`;
      const edgeA = index.nodes.get(snap.edge.a) as NavNode;
      const edgeB = index.nodes.get(snap.edge.b) as NavNode;
      result.nodes.push({
        id: nodeId,
        floor,
        x: position.x,
        y: position.y,
        kind: 'connector',
        region: snap.region,
        connector: connector.id,
      });
      result.nodes.push({
        id: snapId,
        floor,
        x: snap.point.x,
        y: snap.point.y,
        kind: 'snap',
        region: snap.region,
        connector: connector.id,
      });
      result.edges.push({
        id: `${nodeId}>snap`,
        a: nodeId,
        b: snapId,
        length: snap.distance,
        kind: 'walk',
        connector: connector.id,
      });
      // The snap node joins both ends of the edge it landed on. The original edge stays, so
      // distances along the corridor are unchanged. Door and tag info is copied so that a
      // closed door on that edge also closes these two halves.
      const inherited = { kind: 'walk' as const, tags: snap.edge.tags, door: snap.edge.door };
      result.edges.push({
        id: `${snapId}>a`,
        a: snapId,
        b: edgeA.id,
        length: distance(snap.point, edgeA),
        ...inherited,
      });
      result.edges.push({
        id: `${snapId}>b`,
        a: snapId,
        b: edgeB.id,
        length: distance(snap.point, edgeB),
        ...inherited,
      });

      const stop: ConnectorStop = {
        connector: connector.id,
        floor,
        position,
        snap,
        nextTo: regionsNear(index, floor, position, snap.region),
      };
      linked.push(stop);
      result.stops.push(stop);
    }

    // Vertical links between consecutive linked stops. A stop that failed above is skipped,
    // so the stairs still join the floors on either side of it.
    for (let i = 1; i < linked.length; i += 1) {
      const lower = linked[i - 1];
      const upper = linked[i];
      result.edges.push({
        id: `vert:${connector.id}:${lower.floor}-${upper.floor}`,
        a: connectorNodeId(connector.id, lower.floor),
        b: connectorNodeId(connector.id, upper.floor),
        length: 0,
        kind: connector.type,
        connector: connector.id,
      });
    }
    if (linked.length < 2) {
      result.problems.push({
        severity: 'warning',
        code: 'connector-single-floor',
        connector: connector.id,
        message: `${label} is linked on fewer than two floors, so it does not join any floors yet.`,
      });
    }
  }

  result.problems.push(...floorLinkProblems(index, result));
  return result;
}

/** Groups of floors joined by vertical edges. Each floor appears in exactly one group. */
export function floorGroups(
  index: GeometryIndex,
  edges: NavEdge[],
  nodes: Map<string, NavNode>,
): FloorId[][] {
  const group = new Map<FloorId, FloorId>(
    index.geometry.floors.map((floor) => [floor.id, floor.id]),
  );
  const find = (floor: FloorId): FloorId => {
    let root = floor;
    while (group.get(root) !== root) {
      root = group.get(root) as FloorId;
    }
    return root;
  };
  for (const edge of edges) {
    if (edge.kind === 'walk') {
      continue;
    }
    const a = nodes.get(edge.a);
    const b = nodes.get(edge.b);
    if (a && b) {
      group.set(find(a.floor), find(b.floor));
    }
  }
  const groups = new Map<FloorId, FloorId[]>();
  for (const floor of index.geometry.floors) {
    const root = find(floor.id);
    groups.set(root, [...(groups.get(root) ?? []), floor.id]);
  }
  return [...groups.values()];
}

/**
 * Reports floors the connectors leave cut off. A floor with no connector at
 * all is only a warning (nobody has placed one yet). Once every floor has a
 * connector, floors that still cannot reach each other are an error.
 */
function floorLinkProblems(index: GeometryIndex, link: LinkResult): Problem[] {
  const problems: Problem[] = [];
  if (index.geometry.floors.length < 2) {
    return problems;
  }
  const nodes = new Map(link.nodes.map((node) => [node.id, node]));
  const groups = floorGroups(index, link.edges, nodes);
  const floorsWithStops = new Set(link.stops.map((stop) => stop.floor));
  for (const floor of index.geometry.floors) {
    if (!floorsWithStops.has(floor.id)) {
      problems.push({
        severity: 'warning',
        code: 'floor-not-connected',
        floor: floor.id,
        message: `Floor ${floor.id} is not yet connected to others: an admin needs to add stairs or a lift.`,
      });
    }
  }
  const everyFloorHasOne = index.geometry.floors.every((floor) => floorsWithStops.has(floor.id));
  if (everyFloorHasOne && groups.length > 1) {
    const text = groups.map((group) => group.join('+')).join(' | ');
    problems.push({
      severity: 'error',
      code: 'floors-split',
      message: `Every floor has a connector, but the floors still form separate groups: ${text}.`,
    });
  }
  return problems;
}

// ---------- the full graph ----------

export type NavGraph = {
  index: GeometryIndex;
  nodes: Map<string, NavNode>;
  edges: NavEdge[];
  /** Node id -> edges touching it. */
  adjacency: Map<string, NavEdge[]>;
  connectors: Map<string, Connector>;
  overrides: MapOverrides;
  link: LinkResult;
};

/**
 * Geometry + connectors + admin overrides -> one graph for the router.
 * Availability flags are NOT applied here: the router checks them while
 * searching, so marking a lift out of order needs no rebuild.
 */
export function buildNavGraph(
  index: GeometryIndex,
  connectors: Connector[],
  overrides: MapOverrides = NO_OVERRIDES,
): NavGraph {
  const link = linkConnectors(index, connectors);
  const nodes = new Map(index.nodes);
  for (const node of link.nodes) {
    nodes.set(node.id, node);
  }
  const withTags = (edge: NavEdge): NavEdge => {
    const extra: EdgeTag[] | undefined = overrides.edgeTags[edge.id];
    return extra ? { ...edge, tags: [...new Set([...(edge.tags ?? []), ...extra])] } : edge;
  };
  const edges = [...index.geometry.edges.map(withTags), ...link.edges];
  const adjacency = new Map<string, NavEdge[]>();
  for (const edge of edges) {
    for (const end of [edge.a, edge.b]) {
      const list = adjacency.get(end);
      if (list) {
        list.push(edge);
      } else {
        adjacency.set(end, [edge]);
      }
    }
  }
  return {
    index,
    nodes,
    edges,
    adjacency,
    connectors: new Map(connectors.map((c) => [c.id, c])),
    overrides,
    link,
  };
}
