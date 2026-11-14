// `npm run map:validate` - fails (exit code 1) when the map data cannot be routed on.
// Prints the per-floor summary first so the numbers are always in front of you.

import { summariseMap, validateMap } from '../../src/features/map/nav/validate.ts';
import { loadMapData } from './load.ts';

const { geometry, connectors, assignments, assignmentIssues } = loadMapData();
console.log(summariseMap(geometry, connectors, assignments));
for (const issue of assignmentIssues) {
  console.log(`  ASSIGNMENTS: ${issue}`);
}
const { errors } = validateMap(geometry, connectors);
if (errors.length > 0) {
  console.error(`\nMap validation FAILED with ${errors.length} error(s).`);
  process.exit(1);
}
console.log('\nMap validation passed.');
