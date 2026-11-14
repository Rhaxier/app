# MAP_NOTES: indoor navigation hand-off

Status: **Phase 1 done, waiting at CHECKPOINT 1.** Phase 2 (routing engine) not started.
Nothing in the existing map UI, database or styling has been touched.

## What exists

| Path | Job |
| --- | --- |
| `map-inputs/layout.pdf` | Source layout. Git-ignored (it is the real school plan). |
| `tools/map-extract/extract.py` | One-off tracer: PDF pixels -> geometry. Re-run only if the PDF changes. |
| `tools/map-extract/labels.json` | Hand-read room names (keyed by a point inside each room), non-walkable overrides, outdoor links. |
| `tools/map-extract/report.json` | Tracing details: floor transforms, stair symbols, notes. |
| `src/features/map/nav/data/geometry.json` | **Layer 1.** Regions, doors, walkable nodes and edges, all floors. Generated; do not hand-edit. |
| `src/features/map/nav/data/connectors.json` | **Layer 2.** Stairs and lifts. Starts as `[]`. Admin-editable. |
| `src/features/map/nav/data/assignments.csv` | **Layer 3.** `room_id,name,subject,teacher,type`. Names currently come from the PDF. |
| `src/features/map/nav/types.ts` | All types. Read this first. |
| `src/features/map/nav/graph.ts` | `indexGeometry`, `snapToWalkable`, `linkConnectors`, `buildNavGraph`. |
| `src/features/map/nav/validate.ts` | `validateMap`, `summariseMap`. |
| `src/features/map/nav/assignments.ts` | CSV/JSON load, `updateAssignment` (rename one room), `assignmentsToCsv`. |
| `scripts/map/*.ts` | `npm run map:validate`, `npm run map:debug` (plain Node 24, no build). |
| `map-debug/index.html` | Output of `map:debug`. Git-ignored. Open in a browser. |

## The source PDF

Raster, not vector: 4 pages, each one 4253x3000 scanned image, no text layer. Floors: **G, 1, 2, 3**
(the existing app seeds only G, 1, 2). Traced by colour: black = wall, thin green = door mark,
thin red = line across a corridor, filled colours = classrooms.

## Coordinates

- One shared system for all floors = **ground-floor page pixels**. Bounds are in `geometry.bounds`.
- The four pages are drawn at different scales and with different x/y stretch. Floors 1-3 are mapped
  onto the ground floor with `x' = sx*x + tx, y' = sy*y + ty`, fitted to the staircase symbols
  (plus the round east tower). Fit error: at most about 11 units (0.6 m). Values in `report.json`.
- `geometry.metresPerUnit` = 0.055 is an **estimate** (classroom assumed 7.5 m wide). One number to fix.
- y grows downward (image convention).

## Data model in one minute

- `Region`: `room` | `corridor` | `stairwell` | `void`. Ids like `G-R014` are the stable keys used by
  assignments (and later by fix-it reports). `stairwell` only means "the PDF shows a stair symbol
  here"; it creates no connector. `void` is not walkable. `holes` cut the middle out of ring corridors.
- `Door`: joins regions `a` and `b` (`b = "outside"` for exterior doors). `kind` is `door` (drawn),
  `opening` (red line), or `inferred` (not drawn; placed at the door recess on the corridor wall).
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

Errors: a walkable region without a door or node; a floor split into pieces; connector errors above.
Warnings: floors with no connector yet; `area-needs-connector` for a cut-off part that has its own
stair symbol (today: the Agile Learning Center on floor 2, whose only doors lead to two stair boxes).
Current result: **0 errors, 5 warnings** (4 x floor not connected, 1 x Agile Learning Center).

## Tracing rules worth knowing

- Classroom doors are mostly not drawn. Each classroom has a small recess box on its corridor side;
  the inferred door is placed there (128 inferred doors in total).
- A door mark touching three regions is paired "corridor + best other side".
- Unlabelled closed boxes with no door are dropped as `void`.
- Named areas that are not enclosed by walls are not rooms: Parents Lounge, Reception,
  PYP 2 Supervisor (G), Staff Room (2), DP Lounge (3). Bio Lab + Chem Lab (2) are one open region.
- Outdoor links (tag `outdoor`) join the main building to the hall / canteen / pool block. Assumed.

## Open questions (waiting on the user)

See the CHECKPOINT 1 message. Answers go into `labels.json` (names, voids, outdoor links) or into
`extract.py` constants, then re-run the tracer.

## Next

- **Phase 2**: `router.ts` (A*, standard and step-free modes, multi-floor, pointer start, step list,
  clear errors, availability flags) + Vitest tests using fixture connectors in test files only.
- **Later, for the UI model**: Supabase tables for connectors, assignments and overrides (admin-only
  write, everyone reads, audit log), a link from `rooms.code` to region ids so fix-it reports keep
  working, a fourth floor row, and the admin "click to place a connector" screen calling
  `linkConnectors` live.

## Re-running the tracer

```
pip install pymupdf numpy scipy opencv-python-headless scikit-image
python tools/map-extract/extract.py
npm run map:validate && npm run map:debug
```

Region ids are numbered by position, so they stay the same unless the tracing itself changes.
If it does, `assignments.csv` is regenerated from `labels.json`: copy any hand edits back first.
