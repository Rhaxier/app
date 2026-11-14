// Checks that the map data is fit for routing, and writes the per-floor text summary.
//
// Errors mean routing would be wrong (a room nobody can reach, a floor split
// in two). Warnings mean something is simply not set up yet (no stairs placed).
// The same checks run from `npm run map:validate` and can be shown to an admin
// live while they edit connectors.

import { buildNavGraph, floorGroups, indexGeometry } from './graph.ts';
import type { GeometryIndex, NavGraph } from './graph.ts';
import type { Assignment, Connector, Geometry, Problem } from './types.ts';

export type ValidationResult = {
  errors: Problem[];
  warnings: Problem[];
  graph: NavGraph;
};

/**
 * Every room must have a door and a node, and every floor must be one piece.
 *
 * One exception: a cut-off part that has its own stair symbol in the layout
 * (for example a hall entered only from a staircase) is real, not a tracing
 * mistake. It is a warning until a connector placed there joins it to the rest.
 */
export function geometryProblems(index: GeometryIndex, graph: NavGraph): Problem[] {
  const problems: Problem[] = [];
  const { geometry } = index;

  const doorsOf = new Map<string, number>();
  for (const door of geometry.doors) {
    doorsOf.set(door.a, (doorsOf.get(door.a) ?? 0) + 1);
    doorsOf.set(door.b, (doorsOf.get(door.b) ?? 0) + 1);
  }
  const nodesOf = new Map<string, number>();
  for (const node of geometry.nodes) {
    if (node.region && node.kind !== 'door') {
      nodesOf.set(node.region, (nodesOf.get(node.region) ?? 0) + 1);
    }
  }
  for (const region of geometry.regions) {
    if (region.kind === 'void') {
      continue;
    }
    const name = region.sourceLabel ? `${region.id} (${region.sourceLabel})` : region.id;
    if (!doorsOf.get(region.id)) {
      problems.push({
        severity: 'error',
        code: 'room-without-door',
        floor: region.floor,
        region: region.id,
        message: `${name} has no door.`,
      });
    }
    if (!nodesOf.get(region.id)) {
      problems.push({
        severity: 'error',
        code: 'room-without-node',
        floor: region.floor,
        region: region.id,
        message: `${name} has no graph node.`,
      });
    }
  }

  // Which nodes can reach each other in the full graph (all floors, through connectors).
  const reach = new Map<string, string>();
  const find = (id: string): string => {
    let root = id;
    while (reach.get(root) !== root) {
      root = reach.get(root) as string;
    }
    reach.set(id, root);
    return root;
  };
  for (const id of graph.nodes.keys()) {
    reach.set(id, id);
  }
  for (const edge of graph.edges) {
    reach.set(find(edge.a), find(edge.b));
  }

  for (const floor of geometry.floors) {
    const main = index.mainComponent.get(floor.id) as string;
    const pieces = new Map<string, Set<string>>();
    for (const node of geometry.nodes) {
      const piece = index.component.get(node.id) as string;
      if (node.floor === floor.id && piece !== main && node.region) {
        pieces.set(piece, (pieces.get(piece) ?? new Set()).add(node.region));
      }
    }
    for (const [piece, regionIds] of pieces) {
      if (find(piece) === find(main)) {
        continue; // a connector already joins this part to the rest of its floor
      }
      const regions = [...regionIds]
        .map((id) => index.regions.get(id))
        .filter((region) => region !== undefined);
      const names = regions
        .map((region) => region.sourceLabel ?? region.id)
        .slice(0, 6)
        .join(', ');
      if (regions.some((region) => region.kind === 'stairwell')) {
        problems.push({
          severity: 'warning',
          code: 'area-needs-connector',
          floor: floor.id,
          message: `Floor ${floor.id}: ${names} can only be reached by its own stairs. Place a connector there to join it to the map.`,
        });
      } else {
        problems.push({
          severity: 'error',
          code: 'floor-area-split',
          floor: floor.id,
          message: `Floor ${floor.id}'s walkable area is split: ${names} cannot be reached from the rest of the floor.`,
        });
      }
    }
  }
  return problems;
}

export function validateMap(geometry: Geometry, connectors: Connector[]): ValidationResult {
  const index = indexGeometry(geometry);
  const graph = buildNavGraph(index, connectors);
  const all = [...geometryProblems(index, graph), ...graph.link.problems];
  return {
    errors: all.filter((problem) => problem.severity === 'error'),
    warnings: all.filter((problem) => problem.severity === 'warning'),
    graph,
  };
}

/** Plain-text summary: counts per floor and what each connector is next to. */
export function summariseMap(
  geometry: Geometry,
  connectors: Connector[],
  assignments: Assignment[] = [],
): string {
  const { graph, errors, warnings } = validateMap(geometry, connectors);
  const nameOf = new Map(assignments.map((assignment) => [assignment.roomId, assignment.name]));
  const describe = (regionId: string) => {
    const region = graph.index.regions.get(regionId);
    const name = nameOf.get(regionId) ?? region?.sourceLabel;
    return name ? `${name} [${regionId}]` : `${region?.kind ?? 'area'} ${regionId}`;
  };
  const lines: string[] = [];
  for (const floor of geometry.floors) {
    const regions = geometry.regions.filter((region) => region.floor === floor.id);
    const count = (kind: string) => regions.filter((region) => region.kind === kind).length;
    const doors = geometry.doors.filter((door) => door.floor === floor.id);
    const doorCount = (kind: string) => doors.filter((door) => door.kind === kind).length;
    const exits = doors.filter((door) => door.b === 'outside').length;
    const stops = graph.link.stops.filter((stop) => stop.floor === floor.id);
    lines.push(`${floor.name} (${floor.id})`);
    lines.push(
      `  rooms: ${count('room')}   corridors/open areas: ${count('corridor')}   stair symbols in PDF: ${count('stairwell')}   non-walkable outlines: ${count('void')}`,
    );
    lines.push(
      `  doors: ${doors.length} (drawn ${doorCount('door')}, red-line openings ${doorCount('opening')}, inferred ${doorCount('inferred')}; ${exits} lead outside)`,
    );
    lines.push(`  graph: ${geometry.nodes.filter((node) => node.floor === floor.id).length} nodes`);
    lines.push(`  connectors: ${stops.length}`);
    for (const stop of stops) {
      const connector = graph.connectors.get(stop.connector);
      lines.push(
        `    - ${connector?.type} "${connector?.name}" next to: ${stop.nextTo.map(describe).join(', ') || 'nothing'}`,
      );
    }
  }
  const groups = floorGroups(graph.index, graph.edges, graph.nodes);
  lines.push(
    `Floor groups joined by connectors: ${groups.map((group) => group.join('+')).join(' | ')}`,
  );
  lines.push(`Errors: ${errors.length}   Warnings: ${warnings.length}`);
  for (const problem of [...errors, ...warnings]) {
    lines.push(`  ${problem.severity.toUpperCase()}: ${problem.message}`);
  }
  return lines.join('\n');
}
