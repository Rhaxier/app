// Loads the three map data layers from disk for the command-line scripts.
// (The app itself will import the same files through Vite.)

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseAssignmentsCsv } from '../../src/features/map/nav/assignments.ts';
import type { Assignment, Connector, Geometry } from '../../src/features/map/nav/types.ts';

const dataDir = fileURLToPath(new URL('../../src/features/map/nav/data/', import.meta.url));

export type MapData = {
  geometry: Geometry;
  connectors: Connector[];
  assignments: Assignment[];
  assignmentIssues: string[];
};

export function loadMapData(): MapData {
  const geometry = JSON.parse(readFileSync(`${dataDir}geometry.json`, 'utf8')) as Geometry;
  const connectors = JSON.parse(readFileSync(`${dataDir}connectors.json`, 'utf8')) as Connector[];
  const loaded = parseAssignmentsCsv(readFileSync(`${dataDir}assignments.csv`, 'utf8'), geometry);
  return { geometry, connectors, assignments: loaded.assignments, assignmentIssues: loaded.issues };
}
