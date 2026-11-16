// The stairs and lifts editor's working copy ("draft"): pure functions that
// return a new list, so the editor can keep one list in React state, check
// it on every change, and save it in one go (map_save_connectors).
//
// Nothing here talks to the database or draws anything, so all of it is
// tested in connectorDraft.test.ts.
import { floorGroups, linkConnectors, type GeometryIndex, type LinkResult } from './graph.ts';
import type { Connector, ConnectorType, FloorId, Geometry, Point, Problem } from './types.ts';

const typeWord: Record<ConnectorType, string> = { stairs: 'Stairs', lift: 'Lift' };

/** "Stairs 1", "Stairs 2"...: the first number not already used by that kind. */
export function nextConnectorName(type: ConnectorType, list: Connector[]): string {
  const used = new Set(list.map((c) => c.name.trim().toLowerCase()));
  let n = 1;
  while (used.has(`${typeWord[type]} ${n}`.toLowerCase())) n += 1;
  return `${typeWord[type]} ${n}`;
}

/** A new connector placed where the admin clicked. Lifts are step-free by default, stairs are not. */
export function newConnector(
  type: ConnectorType,
  floor: FloorId,
  point: Point,
  list: Connector[],
): Connector {
  return {
    id: crypto.randomUUID(),
    type,
    name: nextConnectorName(type, list),
    floors: [floor],
    positions: { [floor]: roundPoint(point) },
    accessible: type === 'lift',
    available: true,
  };
}

// Map units are about 5 cm; whole units keep the saved data tidy.
const roundPoint = (point: Point): Point => ({ x: Math.round(point.x), y: Math.round(point.y) });

function update(list: Connector[], id: string, change: (c: Connector) => Connector): Connector[] {
  return list.map((connector) => (connector.id === id ? change(connector) : connector));
}

export function moveConnector(list: Connector[], id: string, floor: FloorId, point: Point) {
  return update(list, id, (c) => ({
    ...c,
    positions: { ...c.positions, [floor]: roundPoint(point) },
  }));
}

export function renameConnector(list: Connector[], id: string, name: string) {
  return update(list, id, (c) => ({ ...c, name }));
}

export function setAccessible(list: Connector[], id: string, accessible: boolean) {
  return update(list, id, (c) => ({ ...c, accessible }));
}

export function setAvailable(list: Connector[], id: string, available: boolean) {
  return update(list, id, (c) => ({ ...c, available }));
}

export function removeConnector(list: Connector[], id: string) {
  return list.filter((connector) => connector.id !== id);
}

/**
 * Changes the floors a connector serves. A floor ticked for the first time
 * gets the position of the nearest floor that already has one: the floors
 * share one coordinate system, so a straight stair core lands in the right
 * place and the admin only nudges it. A floor unticked keeps its position in
 * the draft (ticking it again brings it back) but isn't saved.
 */
export function setFloorsServed(
  list: Connector[],
  id: string,
  floors: FloorId[],
  geometry: Geometry,
): Connector[] {
  const level = new Map(geometry.floors.map((floor) => [floor.id, floor.level]));
  const ordered = [...new Set(floors)].sort((a, b) => (level.get(a) ?? 0) - (level.get(b) ?? 0));
  return update(list, id, (c) => {
    const positions = { ...c.positions };
    for (const floor of ordered) {
      if (positions[floor]) continue;
      const nearest = c.floors
        .filter((f) => positions[f])
        .sort(
          (a, b) =>
            Math.abs((level.get(a) ?? 0) - (level.get(floor) ?? 0)) -
            Math.abs((level.get(b) ?? 0) - (level.get(floor) ?? 0)),
        )[0];
      if (nearest) positions[floor] = { ...(positions[nearest] as Point) };
    }
    return { ...c, floors: ordered, positions };
  });
}

/** The floors a connector serves that have a position: the ones drawn on the map. */
export const placedFloors = (connector: Connector) =>
  connector.floors.filter((floor) => connector.positions[floor]);

export type DraftCheck = {
  link: LinkResult;
  /** Linking problems plus the editor's own (empty or repeated names). Errors first. */
  problems: Problem[];
  hasErrors: boolean;
};

/** Everything the validation panel and the Save button need, from one linking pass (~0.3 ms). */
export function checkDraft(index: GeometryIndex, draft: Connector[]): DraftCheck {
  const link = linkConnectors(index, draft);
  const own: Problem[] = [];
  const seen = new Map<string, string>();
  for (const connector of draft) {
    const name = connector.name.trim();
    if (name === '') {
      own.push({
        severity: 'error',
        code: 'connector-no-name',
        connector: connector.id,
        message: `A ${connector.type === 'lift' ? 'lift' : 'staircase'} has no name.`,
      });
      continue;
    }
    const other = seen.get(name.toLowerCase());
    if (other) {
      own.push({
        severity: 'error',
        code: 'connector-duplicate-name',
        connector: connector.id,
        message: `Two stairs or lifts can't share a name: "${name}".`,
      });
    }
    seen.set(name.toLowerCase(), connector.id);
  }
  const problems = [...own, ...link.problems].sort(
    (a, b) => Number(a.severity === 'warning') - Number(b.severity === 'warning'),
  );
  return { link, problems, hasErrors: problems.some((p) => p.severity === 'error') };
}

const floorName = (id: FloorId) => (id === 'G' ? 'Ground' : `Floor ${id}`);
const listFloors = (ids: FloorId[]) =>
  ids.length <= 1 ? ids.join('') : `${ids.slice(0, -1).join(', ')} and ${ids[ids.length - 1]}`;

/** The line at the top of the validation panel. */
export function connectivitySummary(
  index: GeometryIndex,
  link: LinkResult,
): { connected: boolean; text: string } {
  const nodes = new Map(link.nodes.map((node) => [node.id, node]));
  const level = new Map(index.geometry.floors.map((floor) => [floor.id, floor.level]));
  const groups = floorGroups(index, link.edges, nodes)
    .map((group) => [...group].sort((a, b) => (level.get(a) ?? 0) - (level.get(b) ?? 0)))
    .sort((a, b) => (level.get(a[0]) ?? 0) - (level.get(b[0]) ?? 0));
  const count = index.geometry.floors.length;
  if (groups.length <= 1) {
    return { connected: true, text: `All ${count === 4 ? 'four' : count} floors are connected.` };
  }
  if (groups.every((group) => group.length === 1)) {
    return { connected: false, text: 'No floors are connected yet: add stairs or a lift.' };
  }
  const alone = groups.filter((group) => group.length === 1);
  if (groups.length === 2 && alone.length === 1) {
    return {
      connected: false,
      text: `${floorName(alone[0][0])} is not connected to the others yet.`,
    };
  }
  return {
    connected: false,
    text: `Not all floors are connected yet. Connected together: ${groups
      .map((group) => listFloors(group))
      .join('; ')}.`,
  };
}

/** True when the draft differs from what is saved (order doesn't matter). */
export function isDirty(draft: Connector[], saved: Connector[]): boolean {
  const key = (list: Connector[]) =>
    JSON.stringify(
      [...list]
        .sort((a, b) => a.id.localeCompare(b.id))
        .map((c) => ({
          ...c,
          name: c.name.trim(),
          floors: [...c.floors].sort(),
          // Only the floors served are saved, so only they count.
          positions: Object.fromEntries(
            [...c.floors].sort().map((floor) => [floor, c.positions[floor] ?? null]),
          ),
        })),
    );
  return key(draft) !== key(saved);
}
