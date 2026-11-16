// `npm run map:demo` - prints sample routes on the real school map as text.
//
// The stairs and lift used here are DEMO FIXTURES that exist only in this
// script. They sit where the layout PDF hints at a staircase and a lift (see
// MAP_NOTES.md); nothing is written to connectors.json.

import { createRouter } from '../../src/features/map/nav/router.ts';
import type { RouteEnd, RouteMode, RouteResult } from '../../src/features/map/nav/router.ts';
import type { Connector } from '../../src/features/map/nav/types.ts';
import { loadMapData } from './load.ts';

const { geometry, assignments } = loadMapData();
const names = Object.fromEntries(
  assignments.map((assignment) => [assignment.roomId, assignment.name]),
);
const idOf = (name: string): string => {
  const found = assignments.find((assignment) => assignment.name === name);
  if (!found) {
    throw new Error(`No room or place called "${name}"`);
  }
  return found.roomId;
};
const room = (name: string): RouteEnd => ({
  type: idOf(name).includes('-P') ? 'place' : 'room',
  id: idOf(name),
});

function connector(
  id: string,
  type: 'stairs' | 'lift',
  floors: string[],
  x: number,
  y: number,
): Connector {
  return {
    id,
    type,
    name: id,
    floors,
    positions: Object.fromEntries(floors.map((floor) => [floor, { x, y }])),
    accessible: type === 'lift',
    available: true,
  };
}
// Hint S3: the stair box by PYP3 C, drawn on all four floors.
const demoStairs = connector('Demo stairs (west)', 'stairs', ['G', '1', '2', '3'], 1221, 975);
// The cells labelled "Lifts" west of the auditorium, drawn on G, 2 and 3.
const demoLift = connector('Demo lift', 'lift', ['G', '2', '3'], 1570, 1190);
// The same lift moved to the stair box by MYP1 B on the east side (hint S5).
const demoLiftMoved = connector('Demo lift', 'lift', ['G', '2', '3'], 2600, 975);

function print(title: string, result: RouteResult) {
  console.log(`\n=== ${title} ===`);
  if (!result.ok) {
    console.log(`  NO ROUTE (${result.code}): ${result.message}`);
    return;
  }
  const minutes = Math.max(1, Math.round(result.durationS / 60));
  console.log(`  ${result.mode}: ${result.distanceM} m, about ${minutes} min`);
  console.log(
    `  path: ${result.legs.map((leg) => `floor ${leg.floor} (${leg.points.length} points)`).join(' -> ')}`,
  );
  result.steps.forEach((step, i) => console.log(`  ${String(i + 1).padStart(2)}. ${step.text}`));
}

const router = createRouter(geometry, [demoStairs, demoLift], undefined, names);
const go = (from: RouteEnd, to: RouteEnd, mode: RouteMode = 'standard') =>
  router.route(from, to, { mode });

print('Same floor: PYP3 B to KG1 A', go(room('PYP3 B'), room('KG1 A')));
print('Multi-floor, standard: PYP3 A to 12 A', go(room('PYP3 A'), room('12 A')));
print('Multi-floor, step-free: PYP3 A to 12 A', go(room('PYP3 A'), room('12 A'), 'step-free'));
print(
  'Pointer start (a spot in the ground-floor lobby) to Senior Library',
  go({ type: 'point', floor: 'G', x: 1900, y: 2150 }, room('Senior Library')),
);
print('To a place without walls: PYP1 A to Reception', go(room('PYP1 A'), room('Reception')));
print(
  'Via an outdoor link: Principal to Multipurpose Hall',
  go(room('Principal'), room('Multipurpose Hall')),
);

print(
  'Two-storey hall, from the ground floor: PYP3 B to Auditorium',
  go(room('PYP3 B'), room('Auditorium')),
);
print(
  'Two-storey hall, from the first floor (no stairs needed): 9A to Auditorium',
  go(room('9A'), room('Auditorium')),
);

print(
  'BEFORE moving the lift, step-free: PYP3 I to DP 4',
  go(room('PYP3 I'), room('DP 4'), 'step-free'),
);
router.setConnectors([demoStairs, demoLiftMoved]);
print(
  'AFTER moving the lift to the east side, step-free: PYP3 I to DP 4',
  go(room('PYP3 I'), room('DP 4'), 'step-free'),
);

router.setConnectors([demoStairs, { ...demoLift, available: false }]);
print(
  'Lift marked out of order, step-free: KG1 A to 12 B',
  go(room('KG1 A'), room('12 B'), 'step-free'),
);
print(
  'Lift marked out of order, standard: KG1 A to 12 B (stairs still work)',
  go(room('KG1 A'), room('12 B')),
);
print(
  'Step-free to floor 1, which the demo lift does not serve: KG1 A to 9A',
  go(room('KG1 A'), room('9A'), 'step-free'),
);

router.setConnectors([]);
print('No connectors at all (the real data today): KG1 A to 12 B', go(room('KG1 A'), room('12 B')));

const problems = createRouter(geometry, [demoStairs, demoLift]).problems();
console.log(
  `\nLinking problems with the demo fixtures: ${problems.map((problem) => problem.message).join(' | ') || 'none'}`,
);
