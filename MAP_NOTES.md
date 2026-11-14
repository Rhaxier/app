# MAP_NOTES: indoor navigation hand-off

Status: **Phase 1 complete, school's answers applied.** Phase 2 (routing engine) not started.
Nothing in the existing map UI, database or styling has been touched.

## What exists

| Path | Job |
| --- | --- |
| `map-inputs/layout.pdf` | Source layout. Git-ignored (it is the real school plan). |
| `tools/map-extract/extract.py` | One-off tracer: PDF pixels -> geometry. Re-run only if the PDF or `labels.json` changes. |
| `tools/map-extract/labels.json` | Hand-read room names (keyed by a point inside each room), named places, confirmed doors, non-walkable overrides, outdoor links. |
| `tools/map-extract/report.json` | Tracing details: floor transforms, stair symbols, notes. |
| `src/features/map/nav/data/geometry.json` | **Layer 1.** Regions, places, doors, walkable nodes and edges, all floors. Generated; do not hand-edit. |
| `src/features/map/nav/data/connectors.json` | **Layer 2.** Stairs and lifts. `[]` until an admin places them. |
| `src/features/map/nav/data/assignments.csv` | **Layer 3.** `room_id,name,subject,teacher,type`. Names currently come from the PDF. |
| `src/features/map/nav/types.ts` | All types. Read this first. |
| `src/features/map/nav/graph.ts` | `indexGeometry`, `snapToWalkable`, `linkConnectors`, `buildNavGraph`. |
| `src/features/map/nav/validate.ts` | `validateMap`, `summariseMap`. |
| `src/features/map/nav/assignments.ts` | CSV/JSON load, `updateAssignment` (rename one room), `assignmentsToCsv`, `searchableDestinations`. |
| `scripts/map/*.ts` | `npm run map:validate`, `npm run map:debug` (plain Node 24, no build). |
| `map-debug/index.html` | Output of `map:debug`. Git-ignored. Open in a browser. |

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

| Hint | Floors | Where |
| --- | --- | --- |
| S1 | 1, 2 | 1: 1-R010 at (1597, 666), by Sewing; 2: 2-R002 at (1596, 668), by MYP5 B |
| S2 | 1, 2 | 1: 1-R005 at (2228, 671), by IT Services; 2: 2-R003 at (2216, 670), by DP 9 |
| S3 | G, 1, 2, 3 | G: G-R050 at (1221, 978), by PYP3 C; 1: 1-R047 by MYP2 E; 2: 2-R047 by MYP4 D; 3: 3-R031 by 12 B |
| S4 | G, 1 | G: G-R053 at (1739, 972), by Inclusion; 1: 1-R066 by Head of Middle School |
| S5 | G, 1, 2, 3 | G: G-R056 at (2600, 979), by MYP1 B; 1: 1-R051 by MYP1 G; 2: 2-R052 by DP 13; 3: 3-R037 by DP 4 |
| S6 | G, 1, 2 | G: G-R038 at (2979, 812), by Art; 1: 1-R027 by Supervisor Grade 6; 2: 2-R038 by 10 D |
| S7 | G, 1 | G: G-R081 at (1166, 1397), by PYP2 E; 1: 1-R087 by MYP3 E |
| S8 | G, 1, 2 | G: G-R099 at (792, 1576), by Facility Manager; 1: 1-R108 by MYP3 A; 2: 2-R110 by 7 D |
| S9 | 1 | 1-R093 at (2650, 1405), by Physics Lab |
| S10 | G, 2 | G: G-R116 at (1732, 1633), by PYP 1 Supervisor; 2: 2-R100, west of the stage |
| S11 | G, 2 | G: G-R117 at (2083, 1637), by Asst. MSO; 2: 2-R102, east of the stage |
| S12 | G | G-R166 at (786, 2248), inside the room labelled GRE |
| S13 | 1 | 1-R152 at (3023, 2251), by PYP5 A |
| S14 | G, 1 | G: G-R183 at (2650, 2426), by KG1 E; 1: 1-R154 by IT FF2 |

Stair boxes show as pink in the debug page with "stairs?" after the id. S9, S12 and S13 appear on one
floor only, so the matching symbol on another floor may simply be missing from the drawing.

## Hint for the lift (nothing is created)

"Lifts" is printed on the ground floor beside two small cells west of the auditorium: G-R070 at
(1569, 1169) and G-R071 at (1569, 1213). Floor 2 has the same two cells at the same spot (2-R070,
2-R072). Floor 3 shows the same block as an outline inside corridor 3-R053. Floor 1 does not draw it.
Likely one lift group serving G-3.

The round tower on the east side (G-R124 at about (3137, 1717)): **unanswered**. It could be a spiral
staircase. Left alone.

## Fix-it link: what was found and the proposed migration (NOT done yet)

How reports attach today (`supabase/migrations/20261019120900_fixit.sql`):

- `reports.room_id` -> `rooms.id`, `on delete set null`. `reports.floor_id` -> `floors.id`, `on delete set null`.
- On insert, a trigger copies the room's floor and its pin x/y into the report. So each report carries
  its **own copy** of floor, x and y, in the old 1000 x 700 placeholder image coordinates.
- `venues.room_id` and `volunteer_events.room_id` also point at `rooms.id` (`on delete set null`).
- `rooms.floor_id` is `on delete restrict`, so a floor cannot be deleted while it has rooms.
- The only rooms today are the 15 seeded placeholders (`supabase/seed.sql`). Whether a cloud project
  holds real reports could not be checked from here.

What would break if the placeholder rooms were simply deleted:

1. No report is deleted, but every report, venue and volunteer event on a placeholder room silently
   loses its room (`room_id` becomes null).
2. Those reports keep x/y from the old 1000 x 700 space. On the new map (about 2700 x 2000 units,
   different origin) their pins land in the wrong place.
3. `open_reports_in_room` (the "Me too" duplicate check) stops finding them.
4. The four seeded venues lose the room that puts them on the map.

Proposed safe migration (one new SQL migration, no deletes):

1. `alter table rooms add column region_id text unique` (the geometry id, e.g. `G-R014`) and
   `add column retired_at timestamptz`. Add floor `3`. Point all four floors at the new coordinate space.
2. Insert one `rooms` row per traced room and place (`code` = region id, x/y = its label point).
3. **Keep** the placeholder rows; set `retired_at = now()`. Pickers, search and the map list only
   rooms where `retired_at is null`. Reports on a retired room still show its old name.
4. For reports, venues and events on a retired room: leave `room_id` as it is; for reports also set
   `x`, `y` to null so no pin is drawn in a wrong place (the old values go to the audit log first).
   Optionally a small table `placeholder_room -> new region_id` lets an admin re-home them in one step;
   the placeholders are invented rooms, so there is no correct automatic mapping.
5. pgTAP test: report count is unchanged before and after, and no report has a null `room_id` that
   had one before.

Waiting for a yes before writing this migration.

## Next

- **Phase 2**: `router.ts` (A*, standard and step-free modes, multi-floor, pointer start, step list,
  clear errors, availability flags) + Vitest tests using fixture connectors in test files only.
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
