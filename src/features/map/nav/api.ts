// Indoor navigation: the raw Supabase calls for the parts of the map that
// admins edit (supabase/migrations/20261115120000_map_nav.sql).
//
// The database stores rows; the router wants its own types (Connector,
// MapOverrides, Assignment in ./types.ts). The small mappers here turn one
// into the other, so hooks and screens only ever see the router's types.
// Every write is a database function (RPC): the tables can't be written
// directly, and the functions check permissions and data again.
import { supabase } from '@/lib/supabase';
import type { Json, Tables } from '@/types/database';
import { ROOM_TYPES } from './assignments.ts';
import type { Assignment, Connector, EdgeTag, MapOverrides, Point, RoomType } from './types.ts';

export type ConnectorRow = Tables<'map_connectors'>;
export type OverrideRow = Tables<'map_overrides'>;
export type AssignmentRow = Tables<'map_assignments'>;
export type Preset = Pick<Tables<'map_presets'>, 'id' | 'name' | 'created_at'>;

// ---------- Mappers (pure, tested in nav/api.test.ts) ----------

/** One stored position. Anything that isn't {x: number, y: number} counts as "not set". */
function toPoint(value: unknown): Point | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const { x, y } = value as { x?: unknown; y?: unknown };
  return typeof x === 'number' && typeof y === 'number' ? { x, y } : undefined;
}

export function connectorFromRow(row: ConnectorRow): Connector {
  const stored = (row.positions ?? {}) as Record<string, unknown>;
  const positions: Connector['positions'] = {};
  for (const floor of row.floors) {
    positions[floor] = toPoint(stored[floor]);
  }
  return {
    id: row.id,
    type: row.type,
    name: row.name,
    floors: row.floors,
    positions,
    accessible: row.accessible,
    available: row.available,
  };
}

/** What map_save_connectors expects. Floors without a position are sent as they are, so the database can say which one is missing. */
export function connectorsToJson(connectors: Connector[]): Json {
  return connectors.map((connector) => {
    const positions: Record<string, { x: number; y: number }> = {};
    for (const floor of connector.floors) {
      const point = connector.positions[floor];
      if (point) positions[floor] = { x: point.x, y: point.y };
    }
    return {
      id: connector.id,
      type: connector.type,
      name: connector.name,
      floors: connector.floors,
      positions,
      accessible: connector.accessible,
      available: connector.available,
    };
  });
}

const EDGE_TAGS: EdgeTag[] = ['steps', 'ramp', 'narrow', 'outdoor'];

export function overridesFromRows(rows: OverrideRow[]): MapOverrides {
  const overrides: MapOverrides = { doorAvailable: {}, edgeTags: {} };
  for (const row of rows) {
    if (row.kind === 'door') {
      overrides.doorAvailable[row.target_id] = row.available;
    } else {
      const tags = row.tags.filter((tag): tag is EdgeTag => EDGE_TAGS.includes(tag as EdgeTag));
      if (tags.length > 0) overrides.edgeTags[row.target_id] = tags;
    }
  }
  return overrides;
}

export function assignmentFromRow(row: AssignmentRow): Assignment {
  return {
    roomId: row.region_id,
    name: row.name,
    subject: row.subject,
    teacher: row.teacher,
    type: ROOM_TYPES.includes(row.type as RoomType) ? (row.type as RoomType) : 'other',
  };
}

/**
 * What map_save_assignments / map_import_assignments expect. `rows` gives each
 * item the line number to use in error messages (the CSV line on import).
 */
export function assignmentsToJson(assignments: Assignment[], rows?: number[]): Json {
  return assignments.map((assignment, index) => ({
    room_id: assignment.roomId,
    name: assignment.name,
    subject: assignment.subject,
    teacher: assignment.teacher,
    type: assignment.type,
    ...(rows?.[index] !== undefined ? { row: rows[index] } : {}),
  }));
}

// ---------- Reads ----------

export async function fetchConnectors(): Promise<Connector[]> {
  const { data, error } = await supabase.from('map_connectors').select('*').order('name');
  if (error) throw error;
  return data.map(connectorFromRow);
}

export async function fetchOverrides(): Promise<MapOverrides> {
  const { data, error } = await supabase.from('map_overrides').select('*');
  if (error) throw error;
  return overridesFromRows(data);
}

export async function fetchPresets(): Promise<Preset[]> {
  const { data, error } = await supabase
    .from('map_presets')
    .select('id, name, created_at')
    .order('created_at');
  if (error) throw error;
  return data;
}

export async function fetchActivePresetId(): Promise<string | null> {
  const { data, error } = await supabase
    .from('app_settings')
    .select('map_active_preset_id')
    .single();
  if (error) throw error;
  return data.map_active_preset_id;
}

export async function fetchAssignments(presetId: string): Promise<Assignment[]> {
  const { data, error } = await supabase
    .from('map_assignments')
    .select('*')
    .eq('preset_id', presetId)
    .order('region_id');
  if (error) throw error;
  return data.map(assignmentFromRow);
}

/**
 * Which map region each traced room is (rooms.id -> region_id), so reports,
 * venues and events, which point at rooms, can be placed on the indoor map.
 * Empty until rooms migration step A has run (no region_id column: 42703),
 * and only the traced rooms are listed (the old placeholders have none).
 */
export async function fetchTracedRooms(): Promise<Record<string, string>> {
  const { data, error } = await supabase
    .from('rooms')
    .select('id, region_id')
    .not('region_id', 'is', null);
  if (error?.code === '42703') return {};
  if (error) throw error;
  return Object.fromEntries(data.map((room) => [room.id, room.region_id as string]));
}

/** Whether to show "Mark out of order" (the database checks again on the call). */
export async function fetchCanMarkOutOfOrder(): Promise<boolean> {
  const { data, error } = await supabase.rpc('map_can_mark_out_of_order');
  if (error) throw error;
  return data;
}

// ---------- Writes (all RPCs) ----------

export async function saveConnectors(connectors: Connector[]): Promise<void> {
  const { error } = await supabase.rpc('map_save_connectors', {
    p_connectors: connectorsToJson(connectors),
  });
  if (error) throw error;
}

export async function setAvailable(
  kind: 'connector' | 'door',
  targetId: string,
  available: boolean,
): Promise<void> {
  const { error } = await supabase.rpc('map_set_available', {
    p_kind: kind,
    p_target_id: targetId,
    p_available: available,
  });
  if (error) throw error;
}

export async function setEdgeTags(edgeId: string, tags: EdgeTag[]): Promise<void> {
  const { error } = await supabase.rpc('map_set_edge_tags', { p_edge_id: edgeId, p_tags: tags });
  if (error) throw error;
}

export async function createPreset(name: string, copyFrom?: string): Promise<string> {
  const { data, error } = await supabase.rpc('map_create_preset', {
    p_name: name,
    ...(copyFrom ? { p_copy_from: copyFrom } : {}),
  });
  if (error) throw error;
  return data;
}

export async function renamePreset(id: string, name: string): Promise<void> {
  const { error } = await supabase.rpc('map_rename_preset', { p_id: id, p_name: name });
  if (error) throw error;
}

export async function deletePreset(id: string): Promise<void> {
  const { error } = await supabase.rpc('map_delete_preset', { p_id: id });
  if (error) throw error;
}

export async function setActivePreset(id: string): Promise<void> {
  const { error } = await supabase.rpc('map_set_active_preset', { p_id: id });
  if (error) throw error;
}

export async function saveAssignments(presetId: string, assignments: Assignment[]): Promise<void> {
  const { error } = await supabase.rpc('map_save_assignments', {
    p_preset_id: presetId,
    p_rows: assignmentsToJson(assignments),
  });
  if (error) throw error;
}

export async function importAssignments(
  presetId: string,
  assignments: Assignment[],
  rows?: number[],
): Promise<void> {
  const { error } = await supabase.rpc('map_import_assignments', {
    p_preset_id: presetId,
    p_rows: assignmentsToJson(assignments, rows),
  });
  if (error) throw error;
}

// ---------- Realtime ----------

/**
 * Calls `onChange` whenever stairs, lifts, flags, terms, room names or the
 * active term change anywhere. One channel for all five tables. Returns the
 * function that unsubscribes.
 */
export function subscribeToMapChanges(onChange: () => void): () => void {
  const tables = [
    'map_connectors',
    'map_overrides',
    'map_presets',
    'map_assignments',
    'app_settings',
  ];
  let channel = supabase.channel(`map-nav:${crypto.randomUUID()}`);
  for (const table of tables) {
    channel = channel.on('postgres_changes', { event: '*', schema: 'public', table }, onChange);
  }
  channel.subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}
