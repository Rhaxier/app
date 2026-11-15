# MAP_NOTES: indoor navigation hand-off

Status: **Phase 1 and Phase 2 complete, waiting at CHECKPOINT 2.** Phase 3 (the full hand-off spec) is next.
Nothing in the existing map UI, database or styling has been touched, and nothing is wired into the
live map screen yet.

## What exists

| Path                                        | Job                                                                                                                             |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `map-inputs/layout.pdf`                     | Source layout. Git-ignored (it is the real school plan).                                                                        |
| `tools/map-extract/extract.py`              | One-off tracer: PDF pixels -> geometry. Re-run only if the PDF or `labels.json` changes.                                        |
| `tools/map-extract/labels.json`             | Hand-read room names (keyed by a point inside each room), named places, confirmed doors, non-walkable overrides, outdoor links. |
| `tools/map-extract/report.json`             | Tracing details: floor transforms, stair symbols, notes.                                                                        |
| `src/features/map/nav/data/geometry.json`   | **Layer 1.** Regions, places, doors, walkable nodes and edges, all floors. Generated; do not hand-edit.                         |
| `src/features/map/nav/data/connectors.json` | **Layer 2.** Stairs and lifts. `[]` until an admin places them.                                                                 |
| `src/features/map/nav/data/assignments.csv` | **Layer 3.** `room_id,name,subject,teacher,type`. Names currently come from the PDF.                                            |
| `src/features/map/nav/types.ts`             | All types. Read this first.                                                                                                     |
| `src/features/map/nav/graph.ts`             | `indexGeometry`, `snapToWalkable`, `linkConnectors`, `buildNavGraph`.                                                           |
| `src/features/map/nav/validate.ts`          | `validateMap`, `summariseMap`.                                                                                                  |
| `src/features/map/nav/assignments.ts`       | CSV/JSON load, `updateAssignment` (rename one room), `assignmentsToCsv`, `searchableDestinations`.                              |
| `src/features/map/nav/router.ts`            | **Phase 2.** `createRouter(...)`: routes, steps, errors.                                                                        |
| `src/features/map/nav/router.test.ts`       | 20 tests. All stairs and lifts in it are fixtures.                                                                              |
| `scripts/map/*.ts`                          | `npm run map:validate`, `npm run map:debug`, `npm run map:demo` (plain Node 24, no build).                                      |
| `map-debug/index.html`                      | Output of `map:debug`. Git-ignored. Open in a browser.                                                                          |

## The source PDF

Raster, not vector: 4 pages, each one 4253x3000 scanned image, no text layer. Floors: **G, 1, 2, 3**
(the existing app seeds only G, 1, 2). Traced by colour: black = wall, thin green = door mark,
thin red = line across a corridor, filled colours = classrooms.

## Coordinates and scale

- One shared system for all floors = **ground-floor page pixels**. Bounds are in `geometry.bounds`.
- The four pages are drawn at different scales and with different x/y stretch. Floors 1-3 are mapped
  onto the ground floor with `x' = sx*x + tx, y' = sy*y + ty`, fitted to the staircase symbols
  (plus the round east tower). Fit error: at most about 11 units (0.5 m). The same stair box lands
  within a few units on every floor (see the hints table), which confirms the alignment.
- `geometry.metresPerUnit` = **0.046**. From the school: corridors are 2.5 m wide; they measure about
  54 units on the plan.
- y grows downward (image convention).

## Data model in one minute

- `Region`: `room` | `corridor` | `stairwell` | `void`. Ids like `G-R014` are the stable keys used by
  assignments (and later by fix-it reports). `stairwell` only means "the PDF shows a stair symbol
  here"; it creates no connector. `void` is not walkable. `holes` cut the middle out of ring corridors.
- `Place`: a named spot with no walls (`G-P01`...). Has a graph node, so routes can end there. Named
  through assignments exactly like a room.
- `Door`: joins regions `a` and `b` (`b = "outside"` for exterior doors). `kind` is `door` (drawn),
  `opening` (red line; the school confirmed these are passable), or `inferred` (not drawn).
- Graph: corridors have centre-line nodes; a room has one node joined to each of its door nodes.
  Edges through a door carry `door: <id>`. Edge `tags`: `steps`, `ramp`, `narrow`, `outdoor`.
- `Connector` (one record = one stair or lift group): `id, type, name, floors[], positions{floor:{x,y}},
accessible, available`.
- `MapOverrides`: `doorAvailable{doorId:false}`, `edgeTags{edgeId:[...]}`. Admin-editable flags that sit
  on top of the geometry.

## Linking connectors (`linkConnectors`)

Pure and deterministic; about 0.3 ms per call on this map, so it can run on every drag event.
Per stop: snap to the nearest walkable edge (the region under the point is preferred, so a click
inside a stair box attaches to that box), add a connector node + snap node, then chain the stops of
one connector with vertical edges. The geometry is never mutated; the connector layer is rebuilt
from scratch each time. Problems returned (never thrown):

- `connector-outside-walkable`, `connector-missing-floor`, `connector-unknown-floor` (errors)
- `connector-single-floor`, `floor-not-connected` (warnings)
- `floors-split`: every floor has a connector yet floors still form separate groups (error)

`snapToWalkable(index, floor, point)` is also what Phase 2 will use for the "pointer" start.

## Validation (`npm run map:validate`)

Errors: a walkable region without a door or node; a place without a node; a floor split into pieces;
connector errors above. Warnings: floors with no connector yet; `area-needs-connector` for a cut-off
part that has its own stair symbol (none today).
Current result: **0 errors, 4 warnings** (each floor "not yet connected to others").

## Decisions from the school (applied)

1. Scale: corridor = 2.5 m.
2. Classroom doors are not drawn: inferred at the recess box on the corridor side (accepted).
3. Red lines across corridors are passable (`opening` doors).
4. Green marks on outer walls are real doors (kept as exterior doors, `b = "outside"`).
5. Ground-floor open areas (around PLC, Discovery Centre, between wings) are walkable.
6. Central outlines on floors 1-3 and the auditorium outline on floors 1-2 are not walkable.
7. Hall / canteen / pool block: entered by its green doors. Outdoor links (tag `outdoor`) join the main
   building's east exit to the hall, the hall to the canteen, and the KG pool to the pool.
8. Agile Learning Center (2) has doors to ISC Lounge, MYP5 D and MYP5 E (added as `inferred`).
9. Female Prayer Room by 6A (1), Physics Store by Physics Lab (1) and Store by Chem Lab 2 (2) open
   onto the corridor (added). Pottery and Art (1) are entered through Budhayana Spark Lab.
10. Wall-less areas are `Place` points: Parents Lounge, Reception, PYP 2 Supervisor (G); Staff Room,
    Bio Lab, Chem Lab, Bio Store, Chem Store (2); DP Lounge (3). The Bio/Chem lab wing stays one open area.
11. Unnamed rooms (81) stay in the data with no assignment row. `searchableDestinations()` leaves
    them out of student search; an admin can name them later.
12. Names are as printed. Any name used more than once in the school gets a `(floor-n)` suffix in
    `assignments.csv`, e.g. `Clinic (G-1)`, `Clinic (G-2)`, `Female Washroom (1-2)`. 41 names have one.
13. No stairs or lifts are created. Hints below.

## Hints for placing stairs (nothing is created)

Positions are in map units. A row is one staircase symbol that lines up across the floors listed.

| Hint | Floors     | Where                                                                                            |
| ---- | ---------- | ------------------------------------------------------------------------------------------------ |
| S1   | 1, 2       | 1: 1-R010 at (1597, 666), by Sewing; 2: 2-R002 at (1596, 668), by MYP5 B                         |
| S2   | 1, 2       | 1: 1-R005 at (2228, 671), by IT Services; 2: 2-R003 at (2216, 670), by DP 9                      |
| S3   | G, 1, 2, 3 | G: G-R050 at (1221, 978), by PYP3 C; 1: 1-R047 by MYP2 E; 2: 2-R047 by MYP4 D; 3: 3-R031 by 12 B |
| S4   | G, 1       | G: G-R053 at (1739, 972), by Inclusion; 1: 1-R066 by Head of Middle School                       |
| S5   | G, 1, 2, 3 | G: G-R056 at (2600, 979), by MYP1 B; 1: 1-R051 by MYP1 G; 2: 2-R052 by DP 13; 3: 3-R037 by DP 4  |
| S6   | G, 1, 2    | G: G-R038 at (2979, 812), by Art; 1: 1-R027 by Supervisor Grade 6; 2: 2-R038 by 10 D             |
| S7   | G, 1       | G: G-R081 at (1166, 1397), by PYP2 E; 1: 1-R087 by MYP3 E                                        |
| S8   | G, 1, 2    | G: G-R099 at (792, 1576), by Facility Manager; 1: 1-R108 by MYP3 A; 2: 2-R110 by 7 D             |
| S9   | 1          | 1-R093 at (2650, 1405), by Physics Lab                                                           |
| S10  | G, 2       | G: G-R116 at (1732, 1633), by PYP 1 Supervisor; 2: 2-R100, west of the stage                     |
| S11  | G, 2       | G: G-R117 at (2083, 1637), by Asst. MSO; 2: 2-R102, east of the stage                            |
| S12  | G          | G-R166 at (786, 2248), inside the room labelled GRE                                              |
| S13  | 1          | 1-R152 at (3023, 2251), by PYP5 A                                                                |
| S14  | G, 1       | G: G-R183 at (2650, 2426), by KG1 E; 1: 1-R154 by IT FF2                                         |

Stair boxes show as pink in the debug page with "stairs?" after the id. S9, S12 and S13 appear on one
floor only, so the matching symbol on another floor may simply be missing from the drawing.

## Hint for the lift (nothing is created)

"Lifts" is printed on the ground floor beside two small cells west of the auditorium: G-R070 at
(1569, 1169) and G-R071 at (1569, 1213). Floor 2 has the same two cells at the same spot (2-R070,
2-R072). Floor 3 shows the same block as an outline inside corridor 3-R053. Floor 1 does not draw it.
Likely one lift group serving G-3.

The round tower on the east side **is a staircase** (confirmed by the school). It is region G-R124 at
about (3137, 1717) on the ground floor and is drawn at the same spot on floors 1, 2 and 3 as part of
the outline. Nothing is created for it; an admin places it like any other staircase. On floors 1-3
the tower is not a separate region, so the admin should click just inside the corridor next to it.

## Routing engine (Phase 2)

```ts
const router = createRouter(geometry, connectors, overrides, names);
const result = router.route(
  { type: 'room', id: 'G-R030' },
  { type: 'room', id: '3-R043' },
  { mode: 'step-free' },
);
```

- Ends: `{type:'room', id}`, `{type:'place', id}`, or `{type:'point', floor, x, y}` (snapped to the
  nearest walkable spot).
- Success: `{ ok: true, mode, distanceM, durationS, legs: [{floor, points}], steps: [{kind, text, ...}], connectors }`.
- Failure: `{ ok: false, code, message }` with codes `floors-not-connected`, `no-step-free-route`,
  `blocked`, `unreachable`, `unknown-start`, `unknown-destination`, `start-not-walkable`,
  `destination-not-walkable`. Messages are in `ROUTE_MESSAGES`.
- `router.setConnectors(list)` after any connector change (rebuild takes about 3 ms),
  `router.setOverrides(o)` for door and edge flags, `router.setNames(map)` for step text,
  `router.problems()` for the admin validation panel.
- Cost = metres walked + 15 m per floor by stairs + 20 m per floor by lift + 40 m for cutting through
  a room that is not the start or end. Step-free drops stairs and edges tagged `steps` or `narrow`.
  Unavailable connectors and closed doors are skipped in both modes. Constants are at the top of `router.ts`.
- Spoken steps are smoothed (wiggles under 2 m and jogs under 4 m are ignored); the drawn path in
  `legs` is the exact centre-line.
- `npm run map:demo` prints sample routes on the real map using demo fixtures defined in that script only.

## Rooms migration plan (NOT done; needs approval and a backup first)

This session does not touch the database or the live map screen. The new map data and router sit
beside the old map until this plan is approved and run as its own step.

### How fix-it reports attach today

Source: `supabase/migrations/20261019120900_fixit.sql`, `20261019120300_map.sql`, `supabase/seed.sql`.

- `reports.room_id` -> `rooms.id` (`on delete set null`). `reports.floor_id` -> `floors.id` (`on delete set null`).
- A before-insert trigger copies the room's floor and its pin x/y into the report. So every report
  carries its **own copy** of `floor_id`, `x`, `y`, in the old 1000 x 700 placeholder image space.
- `open_reports_in_room(room_id)` (the "Me too" duplicate check) matches on `room_id`.
- `venues.room_id` and `volunteer_events.room_id` also point at `rooms.id` (`on delete set null`).
- `rooms.floor_id` is `on delete restrict`: a floor cannot be deleted while rooms use it.
- The only rooms today are 15 seeded placeholders on floors G, 1, 2. Whether a cloud project holds
  real reports could not be checked from here: **count them before migrating**
  (`select count(*) from reports where room_id is not null`).

### What breaks if the placeholders are simply replaced

1. Reports, venues and volunteer events on a placeholder silently lose their room (`room_id` -> null).
   No row is deleted, but "which room?" is gone and cannot be recovered without a backup.
2. Report pins keep x/y from the 1000 x 700 space; on the new map (about 2700 x 2000 units, other
   origin) they land in the wrong place.
3. The duplicate check stops finding those reports, so students file duplicates.
4. The four seeded venues lose the room that puts them on the map and in "in use now".
5. The map screen reads `floors.image_path/width/height`; the placeholder SVGs do not match the traced
   geometry, so the screen must switch to drawing `geometry.json` in the same release.

### Proposed mapping (placeholder -> traced)

The placeholders are invented rooms, so this is a best match by name and kind, for an admin to adjust.
Rows marked * change floor.

| Placeholder            | Traced room               | Id     |
| ---------------------- | ------------------------- | ------ |
| G.01 Auditorium        | Auditorium                | G-R074 |
| G.02 Admin office      | Reception (place)         | G-P02  |
| G.03 Classroom G.03    | PYP3 A                    | G-R031 |
| G.04 Classroom G.04    | PYP3 B                    | G-R030 |
| G.05 Library           | Senior Library            | G-R023 |
| G.06 Lab 1             | Design and Technology Lab | G-R008 |
| G.07 Lab 2             | IT 1 GF                   | G-R110 |
| G.08 Cafeteria         | Canteen (G-1)             | G-R051 |
| 1.01 Classroom 1.01    | 9A                        | 1-R032 |
| 1.02 Classroom 1.02    | 9B                        | 1-R062 |
| 1.03 Computer lab      | IT FF2                    | 1-R162 |
| 1.04 Meeting room      | Conference Room *         | G-R201 |
| 2.01 Multipurpose hall | Multipurpose Hall *       | G-R135 |
| 2.02 Art room          | Art (1-1) *               | 1-R003 |
| 2.03 Music room        | Music Room (2-1)          | 2-R104 |

### Safe order of steps

0. **Backup** (`supabase db dump`, or the dashboard backup). Record
   `select count(*) from reports`, `... where room_id is not null`, and the same for venues and events.
1. Migration A, additive only (safe to run alone, changes nothing students see):
   - `alter table rooms add column region_id text unique, add column retired_at timestamptz`.
   - Insert floor `3` (Third Floor).
   - Insert one `rooms` row per traced room and place: `code` = `region_id` = the geometry id,
     `name` from the assignments, `x`/`y` = its label point.
   - Create `room_migration_map (old_room_id, new_room_id)` filled from the table above, and
     `room_migration_backup` holding `(table_name, row_id, old_room_id, old_floor_id, old_x, old_y)`
     for every report, venue and event that has a room.
2. Check: counts equal step 0; every mapped id exists; pgTAP test added for both.
3. Migration B, the switch (run together with the release that draws the new map):
   - Re-point `reports`, `venues`, `volunteer_events` from old to new rooms using the map table.
     For reports also set `floor_id` to the new room's floor and `x`, `y` to the new room's point.
   - Set `retired_at = now()` on the 15 placeholders. **Do not delete them.**
   - Update `floors.width/height/image_path` to the new coordinate space.
4. App: pickers, search and the map list only rooms where `retired_at is null`.
5. Check again: counts equal step 0; no report lost its room; open a few reports by hand.
6. Only after a term of normal use: optionally delete the retired placeholders and the two helper tables.

### How to undo

- After Migration A only: drop the new rooms (`where region_id is not null`), floor `3`, the two
  helper tables and the two columns. Nothing else was changed.
- After Migration B: for each row in `room_migration_backup`, write `old_room_id`, `old_floor_id`,
  `old_x`, `old_y` back to its table; set `retired_at = null` on the placeholders; restore the three
  floors' `width/height/image_path` (1000 x 700 and the SVG paths); then undo A. Ship the old map screen.
- If anything looks wrong at step 5 and the above is not enough: restore the backup from step 0.

## Next

- **Phase 3**: the full hand-off spec for the UI model (written into this file, not built).
- **Later, for the UI model**: Supabase tables for connectors, assignments and overrides (admin-only
  write, everyone reads, audit log), the rooms migration above, the fourth floor in the floor
  switcher, and the admin "click to place a connector" screen calling `linkConnectors` live.

## Re-running the tracer

```
pip install pymupdf numpy scipy opencv-python-headless scikit-image
python tools/map-extract/extract.py
npm run map:validate && npm run map:debug
```

Region ids are numbered by position, so they stay the same unless the tracing itself changes.
`assignments.csv` is regenerated from `labels.json` on every run: copy any hand edits back first.
On Windows, run Vitest from a path with an upper-case drive letter (`C:\...`), or the suite fails to load.
