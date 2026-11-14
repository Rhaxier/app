// Types for the indoor navigation data. Three layers are kept strictly apart:
//   1. Geometry    - traced from the school layout, rarely changes, not admin-editable.
//   2. Connectors  - stairs and lifts, placed by an admin in the app. Starts empty.
//   3. Assignments - what each room is called and used for this term.
// The routing graph is always derived from these layers; it is never stored.

/** Floor ids, lowest first. The order of `Geometry.floors` is the vertical order. */
export type FloorId = string;

/** A point in the shared coordinate system. The same x/y means the same spot on every floor. */
export type Point = { x: number; y: number };

// ---------- Layer 1: geometry ----------

export type RegionKind =
  | 'room' // a place you can navigate to
  | 'corridor' // walkable circulation space with a centre-line graph
  | 'stairwell' // drawn with a stair symbol in the layout; only a suggestion for a connector
  | 'void'; // not walkable: roof outlines, double-height voids, unlabelled closed boxes

export type Region = {
  id: string; // stable, e.g. "G-R014". Assignments and fix-it reports refer to this.
  floor: FloorId;
  kind: RegionKind;
  polygon: [number, number][];
  /** Cut-outs inside the polygon, e.g. the void in the middle of a ring corridor. */
  holes?: [number, number][][];
  /** A point safely inside the polygon, used for labels and as the room's graph node. */
  labelAt: [number, number];
  /** The text printed on the layout PDF, kept only as a tracing aid. */
  sourceLabel?: string;
};

export type DoorKind =
  | 'door' // drawn as a green mark in the layout
  | 'opening' // drawn as a red line across a corridor (meaning to be confirmed)
  | 'inferred'; // not drawn; placed on the wall the room shares with its corridor

/**
 * A named spot that has no walls of its own, e.g. a lounge that is part of a
 * corridor. Students can search for it and routes can end there. Its name
 * lives in the assignments, keyed by this id, exactly like a room's.
 */
export type Place = {
  id: string; // e.g. "G-P01"
  floor: FloorId;
  x: number;
  y: number;
  /** The walkable region the spot stands in. */
  region: string;
  /** The text printed on the layout PDF, kept only as a tracing aid. */
  sourceLabel?: string;
};

export type Door = {
  id: string;
  floor: FloorId;
  x: number;
  y: number;
  kind: DoorKind;
  /** The two sides this door joins. `b` is "outside" for an exterior door. */
  a: string;
  b: string;
};

export type NodeKind = 'corridor' | 'door' | 'room' | 'place' | 'connector' | 'snap';

export type NavNode = {
  id: string;
  floor: FloorId;
  x: number;
  y: number;
  kind: NodeKind;
  /** The region this node stands in (a door node uses its `a` side). */
  region?: string;
  door?: string;
  place?: string;
  connector?: string;
};

/**
 * Extra facts about an edge. `steps` and `narrow` make it unusable step-free.
 * `ramp` and `outdoor` (a walk between buildings) are information only.
 */
export type EdgeTag = 'steps' | 'ramp' | 'narrow' | 'outdoor';

export type EdgeKind = 'walk' | 'stairs' | 'lift';

export type NavEdge = {
  id: string;
  a: string;
  b: string;
  /** Length in map units (multiply by `metresPerUnit`). 0 for vertical links. */
  length: number;
  kind: EdgeKind;
  tags?: EdgeTag[];
  door?: string;
  connector?: string;
};

export type Floor = {
  id: FloorId;
  name: string;
  level: number;
};

export type Geometry = {
  version: number;
  /** One map unit in metres. An estimate until the school gives a real measurement. */
  metresPerUnit: number;
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
  floors: Floor[];
  regions: Region[];
  places: Place[];
  doors: Door[];
  nodes: NavNode[];
  edges: NavEdge[];
};

// ---------- Layer 2: connectors and other admin-editable state ----------

export type ConnectorType = 'stairs' | 'lift';

/**
 * One staircase or lift. A single record is the whole "group": Lift A is one
 * connector with a position on each floor it serves.
 */
export type Connector = {
  id: string;
  type: ConnectorType;
  name: string;
  /** The floors it claims to serve. Each must have an entry in `positions`. */
  floors: FloorId[];
  positions: Record<FloorId, Point | undefined>;
  /** Step-free? Lifts are, stairs are not. Stored so an admin can override. */
  accessible: boolean;
  /** False when out of order. The router then ignores it. */
  available: boolean;
};

/** Admin-editable flags laid over the geometry without changing it. */
export type MapOverrides = {
  /** Door id -> false when the door is locked or closed. Missing means available. */
  doorAvailable: Record<string, boolean | undefined>;
  /** Edge id -> tags added by an admin (steps, ramp, narrow). */
  edgeTags: Record<string, EdgeTag[] | undefined>;
};

export const NO_OVERRIDES: MapOverrides = { doorAvailable: {}, edgeTags: {} };

// ---------- Layer 3: assignments ----------

export type RoomType =
  | 'classroom'
  | 'lab'
  | 'office'
  | 'hall'
  | 'library'
  | 'cafeteria'
  | 'toilet'
  | 'prayer'
  | 'store'
  | 'other';

export type Assignment = {
  roomId: string;
  /** Display name or number, e.g. "PYP3 B". */
  name: string;
  /** Class or subject taught there this term. */
  subject: string;
  teacher: string;
  type: RoomType;
};

// ---------- Problems reported by linking and validation ----------

export type ProblemCode =
  | 'connector-outside-walkable'
  | 'connector-missing-floor'
  | 'connector-unknown-floor'
  | 'connector-single-floor'
  | 'floor-not-connected'
  | 'floors-split'
  | 'room-without-door'
  | 'room-without-node'
  | 'floor-area-split'
  | 'area-needs-connector'
  | 'place-without-node';

export type Problem = {
  severity: 'error' | 'warning';
  code: ProblemCode;
  message: string;
  floor?: FloorId;
  connector?: string;
  region?: string;
};
