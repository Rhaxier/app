# MAP_NOTES: indoor navigation hand-off

Status: **Foundation phases 1-3 complete. UI phase 1 (data layer) complete, at checkpoint 1.**
The database tables, functions, rooms migration step A (as a file), the client data layer and the
shared router provider are built; see "UI phase 1" just before the Phase 3 spec. No screen uses them
yet. Next: UI phase 2 (admin "Map and rooms", Classrooms tab). Nothing has been applied to the
cloud project.

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
| `src/features/map/nav/router.test.ts`       | 25 tests. All stairs and lifts in it are fixtures.                                                                              |
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
- `Region.entrances`: other rooms that count as arriving at this one (the auditorium's first-floor
  lobbies). `Door.restricted`: a door routes never use (backstage).
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
**Confirmed by the school: the lift serves all four floors (G, 1, 2, 3)**, so on floor 1 the admin
places it at the same spot even though the PDF does not draw it there.

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

- Ends: `{type:'room', id}`, `{type:'place', id}`, `{type:'door', id}` (an entrance: a door that
  leads outside), or `{type:'point', floor, x, y}` (snapped to the nearest walkable spot).
- Success: `{ ok: true, mode, distanceM, durationS, legs: [{floor, points}], steps: [{kind, text, ...}], connectors }`.
- Failure: `{ ok: false, code, message }` with codes `floors-not-connected`, `no-step-free-route`,
  `blocked`, `unreachable`, `unknown-start`, `unknown-destination`, `start-not-walkable`,
  `destination-not-walkable`. Messages are in `ROUTE_MESSAGES`.
- `router.setConnectors(list)` after any connector change (rebuild takes about 3 ms),
  `router.setOverrides(o)` for door and edge flags, `router.setNames(map)` for step text,
  `router.problems()` for the admin validation panel.
- Cost = metres walked + 15 m per floor by stairs + 20 m per floor by lift + 40 m for cutting through
  a room that is not the start or end + 10 m per outdoor stretch. Step-free drops stairs and edges tagged `steps` or `narrow`.
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

# UI phase 1: data layer (built)

Built on branch `indoor-nav`, 2026-11-15. Spec: "Phase 3" below, sections 1, 2 and 7.1-7.2.

| Path                                                           | Job                                                                                                                                                                                                                          |
| -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `supabase/migrations/20261115120000_map_nav.sql`               | `map_connectors`, `map_presets`, `map_assignments`, `map_overrides`, `map_geometry_ids`, `app_settings.map_active_preset_id`, RLS, RPCs, Realtime.                                                                           |
| `supabase/migrations/20261115120050_map_geometry_ids.sql`      | Generated: the 3,257 ids in `geometry.json` (rooms, places, doors, edges). The RPCs reject ids not in it.                                                                                                                    |
| `supabase/migrations/20261115120100_rooms_migration_a.sql`     | Rooms migration **step A** (additive). The data is generated; the work is `room_migration_a_fill()`.                                                                                                                         |
| `scripts/map/gen-sql.ts`                                       | `npm run map:sql` fills the generated blocks; `-- --check` fails if they are stale.                                                                                                                                          |
| `src/features/map/nav/api.ts`, `hooks.ts`                      | Raw calls + row mappers; TanStack Query hooks (`useGeometry`, `useConnectors`, `useOverrides`, `usePresets`, `useAssignments`, `useActiveAssignments`, `useCanMarkOutOfOrder`, `useMapRealtime`, one mutation hook per RPC). |
| `src/features/map/nav/RouterProvider.tsx`, `routerContext.ts`  | `<NavRouterProvider>` + `useNavRouter()` (the spec's `useRouter`; renamed so it isn't confused with React Router). `{ router, version, ready, ... }`.                                                                        |
| `supabase/tests/19_map_nav_test.sql`, `20_..._a_test.sql`      | pgTAP, 61 + 14 checks.                                                                                                                                                                                                       |
| `docs/runbooks/map-nav-phase1-cloud.md` + `docs/runbooks/sql/` | Cloud runbook, read-only check script, two undo scripts. Rehearsed locally (apply, undo, schema identical, re-apply).                                                                                                        |
| `tools/local-pg/`                                              | Runs migrations + seed + pgTAP on a plain Postgres 17 without Docker (see its README).                                                                                                                                       |

Decisions taken in this phase (from the team, 2026-11-15):

- **Who can mark out of order:** `map_set_available` allows admins, and staff holding any
  responsibility that an **active** `report_categories` row routes to (facilities and it today). It is
  not tied to a specific report, so the editor's Available switch works too. Function:
  `map_can_mark_out_of_order()` (the UI uses it to show the button).
- **Step A stays invisible:** today's readers (`fetchRooms`, `fetchFloors` in `src/features/map/api.ts`)
  return only rooms with `region_id is null` and floors with an image (floor 3 has none;
  `floors.image_path` became nullable). `fetchRooms` falls back to the plain list on error 42703, so
  this build also works before step A is applied. **Step B must change these readers** to the traced
  rooms (`retired_at is null`), in the same release as the new map screen.

How the functions behave (the admin UI in phases 2-3 relies on this):

- All writes are RPCs; the tables have no write grants. Every RPC writes `audit_log`.
- `map_save_connectors(list)` replaces the whole set; items keep their `id` (generate one with
  `crypto.randomUUID()` for new ones), items left out are deleted. Checks: type, unique name (any case),
  floors exist, a position on every floor served. Positions for floors not served are dropped.
  "On a corridor" needs the geometry, so the editor checks it with `linkConnectors`.
- `map_save_assignments` / `map_import_assignments(preset, rows)` replace a term's whole set. Rows:
  `{room_id, name, subject, teacher, type, row?}`; `row` is the line number used in messages. Rows
  with an empty name are dropped (room becomes unnamed). All problems are reported together, one per
  line, using the messages from spec section 5(a). Names are unique per term, ignoring case.
- `map_create_preset(name, copy_from?)`, `map_rename_preset`, `map_delete_preset` (refuses the active
  one; the deleted names are kept in `audit_log.details.rooms`), `map_set_active_preset(id)`.
- `map_set_edge_tags(edge, tags)` exists (admin only) but the school said nothing needs tagging; the
  phase 3 brief says "if the spec includes it": it doesn't (spec section 8, points 7 and 9), so no UI.
- Step A on a fresh local database: the migration runs before the seed creates floors and
  placeholders, so `seed.sql` calls `room_migration_a_fill()` again at its end. On the cloud project
  the migration does everything. The fill also refreshes `room_migration_backup`, so **step B should
  call it first**, so the backup is current on the day of the switch.
- Only **named** traced rooms get a `rooms` row (285). A room an admin names later has no `rooms` row
  yet; step B (or phase 5) must add rows for names added since step A, e.g. by re-running the fill
  after refreshing `room_migration_traced`.

Verified (all local; nothing run against the cloud project):

- `tools/local-pg/run.sh` on Postgres 17.9 + pgTAP 1.3.3: all 25 migrations and the seed apply from
  empty; 19_map_nav 61/61, 20_rooms_migration_a 14/14. Whole suite: 465 passed, 1 failed, in 2 files.
  Both failures were there before this phase and are not map-related:
  `09_admin_overview` books "yesterday", which fails on Sundays (no Saturday periods), and
  `17_bell_times` test 33 (an old short-Friday period can still be booked). Not fixed here.
- Runbook rehearsal: check script all as expected; both undo scripts; `pg_dump -s` after undo is
  identical to a database that never had the migrations; re-applying onto existing data passes.
- `npm run build`, `npm run lint`, `npm test` (31 files, 247 tests), `npm run map:validate`,
  `npm run map:sql -- --check`.
- Types regenerated from the local database (`src/types/database.ts`, additive).

Not verified: Supabase Realtime delivering the changes (the provider test fakes it), PostgREST's
error code for the step A fallback (42703 is Postgres's code for a missing column),
`supabase test db` itself.

Left for later phases: every screen (admin tabs, student map), `reports.map_target_kind/id`
(phase 5), migration B and its runbook (phase 6).

# Phase 3: hand-off spec for the UI work

Everything below is a **spec, not built**. Nothing in this section exists in the app yet unless it
says "exists". Build order is in "Build order" near the end. Do not guess where a question in
"Still open" (section 8) applies: ask the team.

## 1. Data: formats, locations, loading

### What exists today (files, used by tests and scripts)

| Layer       | File                                        | Format                                                                                           |
| ----------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Geometry    | `src/features/map/nav/data/geometry.json`   | `Geometry` in `types.ts`. Generated by the tracer. Never edited by admins or by hand.            |
| Connectors  | `src/features/map/nav/data/connectors.json` | `Connector[]`. Stays `[]` in the repo forever; real stairs and lifts live in the database.       |
| Assignments | `src/features/map/nav/data/assignments.csv` | Header `room_id,name,subject,teacher,type`. One row per named room or place. Names from the PDF. |

`type` is a `RoomType` from `types.ts`. Rooms without a row are "unnamed": they stay in the geometry
and on the map, but `searchableDestinations` leaves them out of student search.

### What to build (database, so admins can edit without a deploy)

Geometry stays a bundled file: load it with a lazy `import()` so it is only downloaded on the map
screens. The two editable layers move to Supabase. Proposed tables (one migration, with pgTAP tests):

| Table             | Columns                                                                                                                     | Notes                                                                                 |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `map_connectors`  | `id uuid`, `type` enum(`stairs`,`lift`), `name`, `floors text[]`, `positions jsonb`, `accessible bool`, `available bool`    | Same shape as `Connector`. Starts empty. No seed rows, ever.                          |
| `map_presets`     | `id uuid`, `name` unique ("Term 1"), `created_by`                                                                           | A saved set of assignments.                                                           |
| `map_assignments` | `preset_id`, `region_id text`, `name`, `subject`, `teacher`, `type`; unique (`preset_id`,`region_id`), (`preset_id`,`name`) | `region_id` is a geometry id such as `G-R014` or `G-P02`. No FK (geometry is a file). |
| `map_overrides`   | `kind` enum(`door`,`edge`), `target_id text`, `available bool`, `tags text[]`; unique (`kind`,`target_id`)                  | Becomes `MapOverrides`.                                                               |
| `app_settings`    | add `map_active_preset_id uuid` (nullable FK to `map_presets`)                                                              | The one switch that decides what students see.                                        |

Rules: RLS on every table; everyone signed in reads; only admins write, and only through
`security definer` RPCs that also write `audit_log` (same pattern as the other admin RPCs):
`map_save_connectors(jsonb)`, `map_save_assignments(preset_id, jsonb)`, `map_import_assignments(preset_id, jsonb)`,
`map_create_preset(name, copy_from)`, `map_set_active_preset(id)`, `map_set_available(kind, id, available)`.
The RPCs repeat the validation in section 5 (duplicate names, unknown ids) so a bad client cannot
write bad data. Enable Realtime on `map_connectors`, `map_overrides` and `app_settings`.

First run: an admin creates preset "Term 1" by importing `assignments.csv` (the Import button),
then sets it active. Until an active preset exists the student map falls back to the bundled CSV.

### Loading and switching terms

Follow the feature shape: `src/features/map/nav/api.ts` (raw Supabase calls) and `nav/hooks.ts`:

- `useGeometry()`: lazy import of `geometry.json`, cached forever (`staleTime: Infinity`).
- `useConnectors()`, `useOverrides()`: query + Realtime subscription that invalidates the query.
- `useActiveAssignments()`: reads `app_settings.map_active_preset_id`, then that preset's rows.
- `useRouter()`: `useMemo(() => createRouter(geometry, [], NO_OVERRIDES, {}), [geometry])`, then
  effects call `router.setConnectors`, `router.setOverrides`, `router.setNames` when data changes.
  Never build a new router per render; never rebuild geometry.

Switching term = `map_set_active_preset(id)`. One RPC, one row changes, clients pick it up through
Realtime (or on next open), call `router.setNames(...)`, and search uses the new names. Routes do
not change, because assignments never touch the graph.

Parsing helpers exist: `parseAssignmentsCsv`, `parseAssignmentsJson`, `assignmentsToCsv`,
`updateAssignment`, `searchableDestinations` in `nav/assignments.ts`. `src/lib/csv.ts` (exists) has
`downloadCsv` for the export button.

## 2. Routing engine public API

Import only from `nav/router.ts`, `nav/graph.ts`, `nav/assignments.ts`, `nav/validate.ts`, `nav/types.ts`.

```ts
const router = createRouter(geometry, connectors, overrides, names);
// names: { 'G-R030': 'PYP3 B', ... } from the active assignments

// room to room
router.route({ type: 'room', id: 'G-R030' }, { type: 'room', id: '3-R043' }, { mode: 'standard' });
// from a tapped point, step-free, to a place without walls
router.route(
  { type: 'point', floor: 'G', x: 1900, y: 2150 },
  { type: 'place', id: 'G-P02' },
  { mode: 'step-free' },
);
```

Success:

```ts
{ ok: true, mode: 'standard', distanceM: 35, durationS: 74,
  legs: [{ floor: 'G', points: [{x,y}, ...] }, { floor: '3', points: [...] }],   // draw these
  steps: [{ kind, text: 'Walk 5 m to the stairs (West stairs)', floor, distanceM, durationS, connector? }, ...],
  connectors: ['West stairs'] }
```

Failure: `{ ok: false, code, message }`. Show `message` as it is; it is written for students.

| Code                                             | Message shown / meaning                                                      |
| ------------------------------------------------ | ---------------------------------------------------------------------------- |
| `floors-not-connected`                           | "These floors aren't connected yet: an admin needs to add stairs or a lift." |
| `no-step-free-route`                             | "No step-free route to this room right now." Offer "Show route with stairs". |
| `blocked`                                        | A closed door or out-of-order connector cuts the only way.                   |
| `unreachable`                                    | The room has no way in on the map (data problem; report to an admin).        |
| `unknown-start`, `unknown-destination`           | The id is not in the geometry (stale link or old preset).                    |
| `start-not-walkable`, `destination-not-walkable` | The point is too far from any corridor or room.                              |

Other calls: `router.setConnectors(list)`, `router.setOverrides(o)`, `router.setNames(map)`,
`router.problems()` (the `Problem[]` for the admin panel), `router.graph()`.
From `graph.ts`: `linkConnectors(index, connectors)` for live validation while dragging,
`snapToWalkable(index, floor, point)` to show where a tap will snap, `regionAt(index, floor, point)`
to find the room under a click. See "Routing engine (Phase 2)" above for costs and smoothing.

## 3. Fix-it reports and the map

Today (exists): `reports.room_id` -> `rooms.id`, and a trigger copies the room's floor and x/y onto
the report. After the rooms migration (plan above) every traced room and place has a `rooms` row
with `region_id` = its geometry id. So the link is: **report -> `rooms.id` -> `rooms.region_id` ->
geometry region**. The UI never stores geometry ids on a report directly.

- Map layer "open reports": group open reports by `region_id`, draw a pin at the region's `labelAt`.
- Room card: `open_reports_in_room(room_id)` (exists) lists them, with "Report a problem here"
  pre-filling the room.

Out-of-order stairs, lifts and doors (to build):

1. Add nullable `reports.map_target_kind` enum(`connector`,`door`) and `reports.map_target_id text`.
   On the report form, when the category is about access, offer "Which lift or stairs?" listing the
   connectors on that floor. Students tapping a connector on the map get "Report a problem".
2. A student report **never** changes `available` by itself (one wrong or prank report would close
   a lift for everyone). In `StaffReportPanel` (exists), when the report has a map target, staff with
   the routed responsibility see a button "Mark out of order". It calls
   `map_set_available(kind, id, false)`, which is audited.
3. When that report is set to `resolved`, the panel asks "Mark as working again?" and calls
   `map_set_available(kind, id, true)`. If other open reports point at the same target, say so.
4. Reroute: the change arrives through Realtime on `map_connectors` / `map_overrides`;
   `useRouter` calls `setConnectors` / `setOverrides`; any screen showing a route calls `route()`
   again with the same ends and mode. If the result is now an error, show its message and a toast
   ("The East lift is out of order. Route updated.").
5. Students see an out-of-order connector greyed with a small "Out of order" badge, not hidden.

## 4. Student map: UI still to build

Replace the Leaflet image overlay in `MapView.tsx` with a drawing of `geometry.json` (keep Leaflet
`CRS.Simple`, with polygons instead of an image, or plain SVG with pan and zoom; pick one and use it
in the admin editor too). Keep the existing layers (rooms, open reports, in use now).

1. **Floor switcher**: `SegmentedControl` (exists) with G, 1, 2, 3 from `geometry.floors`.
2. **Destination search**: reuse `RoomSearch.tsx`, fed by `searchableDestinations(...)`. Results show
   name, subject or teacher, and floor. Unnamed rooms are not listed.
3. **Start**: two choices in the directions sheet. "Tap the map" drops a pointer (show the snapped
   point from `snapToWalkable`, and refuse with the error message if it is not walkable). "Nearest
   classroom" is the same search box. There is no live positioning; do not imply there is.
4. **Step-free toggle**: `Switch` (exists), remembered per user in `localStorage`.
5. **Route drawing**: one polyline per leg from `legs`, only the current floor's leg at full
   strength. At a floor change show a chip on the map ("Take the stairs up to Third Floor") that
   switches floor when tapped. Fit the view to the current leg.
6. **Directions sheet**: `Sheet` (exists). Header: distance and "about N min". List `steps` in order;
   tapping a step switches to its floor and centres on it. Errors use `EmptyState` from `States.tsx`
   with the message, plus "Show route with stairs" for `no-step-free-route`.
7. **Floors not connected** (true today): the map and search work per floor. A cross-floor route
   shows the `floors-not-connected` message. Admins also see a link "Add stairs or a lift" to the editor.
8. Tests: start and destination pickers, the toggle changing the mode passed to `route`, each error
   message rendering, floor switching from a step.

## 5. Admin: one new settings section, "Map and rooms"

Where: a **new entry next to the existing `map` entry** (path `map-rooms`), because the school wants
the old page kept until the rooms migration has run, been checked and a term has passed. Copy the
pattern of the existing entry: `src/features/admin/sections.ts` (the entry at `path: 'map'`),
`routes.ts`, `strings.ts` (`menuSubtitles`, page description, help texts). Leave
`pages/MapAdminPage.tsx` (floor images and room pins) alone; rename its menu title to
"Map (old pins)" so the two are not confused.

- Sidebar entry: title **Map and rooms**, icon `map`.
- Subtitle (menu): "Room names for each term, and where stairs and lifts are".
- Page description (iOS style, one or two sentences under the title, via `AdminPage`):
  "Name each room for the term and place the stairs and lifts. Walls, rooms and corridors come from
  the school's floor plan and can't be changed here."
- Two tabs with `SegmentedControl`: **Classrooms** | **Stairs and lifts**. Keep the tab in the URL
  (`/admin/map-rooms?tab=connectors`) so links from validation messages work.

### Tab (a): Classrooms

Layout: map on one side, table on the other (stacked on phone width, map first).

- **Term bar** at the top: a select of presets with an "Active" `Badge` on the active one; buttons
  "New term" (name + "Copy from" select), "Make active" (one action, behind `ConfirmDialog`:
  "Students will see Term 2 room names straight away."), "Rename", "Delete" (not allowed on the
  active preset). The editor always edits the preset selected here, which may not be the active one;
  show a `Chip` "Editing a term that is not active" when they differ.
- **Map**: same drawing as the student map, with the floor switcher. Click a room or place to select
  it (highlight with `--selroom`). `regionAt` gives the region under the click.
- **Table**: searchable (`Input`), one row per room, place and entrance (door to the outside; shown
  as a small door marker on the map, selectable like a room) on all floors: id, floor, name,
  class/subject, teacher, type. Filter chips: All, Named, Unnamed, per floor. Clicking a row selects
  it and moves the map to it; selecting on the map scrolls the table to it.
- **Edit panel** (`Sheet` on phone, side panel on desktop): Name, Class or subject, Teacher (free
  text, not linked to staff profiles), Type (select of `RoomType`). Save and Cancel. Clearing the name makes the room unnamed
  (confirm first). Use `updateAssignment` to produce the new list, then `map_save_assignments`.
- **CSV**: "Export" downloads the selected preset with `assignmentsToCsv` + `downloadCsv`. "Import"
  takes a file, parses it with `parseAssignmentsCsv`, and shows a preview using the pattern of
  `ImportPreview.tsx` (exists): counts of added, changed, removed, then the errors. Nothing is saved
  until "Apply"; an import with any error cannot be applied.
- **Validation** (in the form, in the import preview, and again in the RPC), with these messages:
  - Duplicate name in the preset: "Two rooms can't share a name: "Art" is already used by 1-R003."
  - Unknown room id: "Row 14: "G-R999" is not a room on the map."
  - Unknown type: "Row 9: "labb" is not a room type. Use one of: ..."
  - Missing header or column: "The file needs these columns: room_id, name, subject, teacher, type."
  - Same room twice in one file: "Row 20: G-R014 already appears on row 6."

### Tab (b): Stairs and lifts (MappedIn-style editor)

Layout: toolbar on top, map in the middle, side panel on the right (a `Sheet` on phone), validation
panel under the side panel.

- **Map**: pan and zoom, floor switcher. Draw regions and corridors as a quiet background, not
  selectable. **Walls, rooms and corridors are not editable anywhere in this section.** Show the
  PDF's stair symbols (`stairwell` regions) with the `--hatch` pattern as a hint for where to click.
- **Tools** (toolbar): Select (default), "Add stairs", "Add lift". With an Add tool active the
  cursor shows a ghost marker that follows `snapToWalkable`; a click places a new connector on the
  current floor at the clicked point, opens the side panel with the name focused (default name
  "Stairs 1", "Lift 1"), and returns to Select. Esc cancels the tool.
- **Markers**: stairs and lift icons from `Icon.tsx` (add two line icons, 1.8 stroke). Unavailable
  ones are greyed. Selected one gets the accent ring. A thin line joins the marker to its snap point
  on the corridor so the admin sees where it attaches.
- **Drag to move**: updates `positions[currentFloor]` and re-runs `linkConnectors` on every move
  (0.3 ms). If the new spot is not walkable the marker turns `--fix` red and the validation panel
  says why; releasing there keeps the change in the draft but blocks Save.
- **Side panel** for the selected connector: Name; Type (read-only); Floors served (one checkbox per
  floor); Accessible (`Switch`; default on for lifts, off for stairs; help text "Step-free routes
  only use accessible lifts."); Available (`Switch`; help text "Turn off when it is out of order.
  Routes avoid it straight away."); **Delete** (`ConfirmDialog`: "Delete West stairs? Routes that
  use it will change, and floors may stop being connected.").
- **Positions on other floors**: ticking a floor in "Floors served" adds it with the same x/y as the
  nearest floor already set (the floors share one coordinate system, so a straight stair core lands
  in the right place). Each floor row shows "Set" or "Not set" and a button "Show": it switches to
  that floor. On every floor the connector's position on the **floor below and the floor above** is
  drawn as a faint dashed **ghost marker**, so the admin can drop or drag the real marker onto it.
  A floor that is ticked but "Not set" is a validation error (`connector-missing-floor`).
- **Live validation panel**: the output of `linkConnectors` (via `router.problems()` on a draft
  router), grouped errors first, then warnings, using `StatusBadge`. Each line is a button that
  selects the connector and switches to the floor concerned. A summary line on top: "All four floors
  are connected" or "Floor 2 is not connected to the others yet". Problem codes are listed under
  "Linking connectors" above.
- **Saving**: edits live in a local draft (React state, list of `Connector`). A bar shows "Unsaved
  changes" with **Save** and **Discard**. Save is disabled while there is any error; warnings do not
  block. Save calls `map_save_connectors(draft)`, which replaces the set in one transaction, repeats
  the validation and writes one `audit_log` row. Warn before leaving the page with unsaved changes.
  Toggling **Available** is the exception: it saves at once through `map_set_available`, because it
  must work fast from a phone.
- **Refresh after saving**: invalidate the `useConnectors` query; Realtime does the same for every
  other open client; `useRouter` then calls `router.setConnectors(list)` (about 3 ms). No reload.
- **Try a route** (small box under the validation panel): pick two rooms and a mode and see
  distance, steps or the error, computed on the **draft**. This is how an admin checks their work
  before saving.
- **What students see when floors are not connected**: section 4, point 7. In the editor the summary
  line and warnings say exactly which floors are missing.
- Hints for the admin's first session are in "Hints for placing stairs" and "Hint for the lift"
  above. They are hints for a person; the app must not create connectors from them.

## 6. Reuse (all of these exist)

- Shared components (`src/components`): `Button`, `Card`, `Chip`, `Badge`, `StatusBadge`, `Input`,
  `SegmentedControl`, `Sheet`, `Switch`, `ConfirmDialog`, `Toaster`, `States` (empty, loading,
  error), `Icon`, `PageHeader`, `Fab`.
- Admin components (`src/features/admin/components`): `AdminPage` (title + description),
  `AdminLayout`, `SettingSwitch` and friends in `SettingControls`, `ImportPreview`.
- Map components (`src/features/map/components`): `RoomSearch`, `RoomCard`, `Pins`, `MapView`.
- Helpers: `src/lib/csv.ts`, the `nav/` modules, `features/admin/strings.ts` for all admin copy.
- Tokens (`src/styles/tokens.css`), no new colours: `--paper` and `--card` for map background and
  rooms, `--line` and `--hair` for walls and outlines, `--acc` / `--accsoft` for the route and the
  selection, `--selroom` for the selected room, `--hatch` for stair hints, `--fix` / `--fixsoft` for
  errors and out-of-order, `--wait` for warnings, `--ok` for "all connected", `--muted` / `--faint`
  for unnamed rooms and ghost markers, radius and text tokens as elsewhere. Check both themes.
- Motion: existing CSS motion tokens. The route line may draw in; respect reduced motion.

## 7. Build order

1. Migration for the `map_*` tables, RPCs, RLS, pgTAP tests. No seed connectors.
2. `nav/api.ts`, `nav/hooks.ts` (`useRouter` and friends), with tests.
3. Admin tab (b), then tab (a). An admin places the real stairs and lifts; validation reaches 0 warnings.
4. Rooms migration A (additive), after the team's backup and approval.
5. Student map drawing + routing UI behind a feature switch; then migration B with the release that
   turns it on.
6. Fix-it map targets and "Mark out of order".

Rules that stay in force: never create real stairs or lifts in code, seeds or migrations; never
delete reports; geometry is not editable in the app; run build, lint and tests; commit per step.

## 8. Answers from the school (all ten questions closed)

1. **Presets** are a separate list, switched by hand. Tying them to school terms by date can come later.
2. **Old map admin page**: keep it. Remove it only after the rooms migration has run, been checked,
   and a term of normal use has passed (the same moment as step 6 of the migration plan). Until then
   the new section is a second entry, "Map and rooms", next to the existing "Map" entry (see section 5).
3. **Teacher** is free text. No link to staff profiles yet.
4. **Marking out of order**: admins, and staff holding the responsibility the report's category is
   routed to (`report_category_routes`). Not every teacher. Enforce it inside `map_set_available`.
5. **The 81 unnamed rooms** stay unnamed. The school will name them in the Classrooms tab.
6. **The lift serves all floors** (G, 1, 2, 3). See "Hint for the lift".
7. **The auditorium (G-R074)** spans the ground and first floors. Built, from the school's answer:
   - Ground floor: the two side doors (G-D089, G-D090) are the entrances. The two doors at the top
     corners (G-D083, G-D084) are backstage doors: marked `restricted`, never used by any route.
   - First floor: it is entered through two small lobbies (1-R112, 1-R114). They are listed in
     `entrances` on G-R074, so reaching either counts as reaching the Auditorium, and the router
     picks the cheapest way in. Someone on floor 1 is sent to "Auditorium (First Floor entrance)"
     without needing stairs.
   - The ramps inside the hall join the two levels but are **not** modelled: no connector, no edge.
     The first-floor part of the hall stays a non-walkable `void`. Do not add them as stairs.
   - These facts live in `tools/map-extract/labels.json` under `links` and are copied into
     `geometry.json` by the tracer. No edge is tagged `steps`.
   - Confirmed by the school afterwards: backstage doors stay blocked for everyone (no staff
     exception), none of the four entrances has steps, and the steps inside the hall are never
     used by routes. Nothing further to tag.
8. **Outdoor links** are allowed at all times, with a small extra cost so indoor ways are preferred.
   Built: `OUTDOOR_PENALTY_M` = 10 m per outdoor stretch in `router.ts`, with a test.
9. **No door editor.** The available/unavailable toggle is enough. `doorAvailable` stays in the data
   model, set only through "Mark out of order" on a report about a door.
10. **Entrances and exits are destinations.** Built: the 60 doors that lead outside are nameable like
    rooms (`entranceDoors`, included in `destinationIds`). An admin names one in the Classrooms tab
    ("Main gate"); it then appears in `searchableDestinations` with `kind: 'entrance'` and is routed
    to with `{ type: 'door', id }`. Unnamed ones are not listed for students. None are named in the
    data: the PDF does not say which door is which, so nothing was invented.

### Still open

Nothing. For the UI: a search result for a room that has `entrances` needs no special handling;
pass `{ type: 'room', id }` as usual and draw whatever `legs` come back.

## 9. Risks

- **Tracing accuracy.** The plan is a scan; doors marked `inferred` are guesses from room layout.
  An admin should walk the debug page (`npm run map:debug`) once and report wrong doors; fixes go in
  `labels.json` and a tracer re-run, not in the app.
- **Region ids are positional.** A re-trace of a changed PDF can renumber rooms and orphan
  assignments and `rooms.region_id`. Before any re-trace, diff old and new ids and write a mapping.
- **Floor alignment** is fitted to within about 0.5 m. Fine for routing; a connector copied to
  another floor can land just inside a wall, which the validation panel catches.
- **Wordy directions.** Long routes read as about 20 turn steps. Grouping steps or naming rooms
  passed is a possible follow-up in `describe()` in `router.ts`.
- **No live position.** The start is always chosen by the student; a wrong start gives a wrong route.
- **Bundle size.** `geometry.json` is large; keep it behind a lazy import and check the build output.
- **Availability abuse and stale flags.** Only staff flip flags, and a lift left "out of order"
  after repair silently blocks step-free routes: show out-of-order connectors on the admin overview.
- **Migration.** The rooms migration touches reports, venues and events. Follow the plan above
  exactly, with the backup first.
- **Times are rough** (1.2 m/s, fixed seconds per floor) and take no account of crowds between lessons.

## Re-running the tracer

```
pip install pymupdf numpy scipy opencv-python-headless scikit-image
python tools/map-extract/extract.py
npm run map:validate && npm run map:debug
```

Region ids are numbered by position, so they stay the same unless the tracing itself changes.
`assignments.csv` is regenerated from `labels.json` on every run: copy any hand edits back first.
On Windows, run Vitest from a path with an upper-case drive letter (`C:\...`), or the suite fails to load.
