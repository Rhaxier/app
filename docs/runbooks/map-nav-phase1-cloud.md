# Runbook: indoor-nav migrations on the cloud Supabase project (SQL Editor)

Two parts, applied at different times, both by hand in the dashboard's **SQL Editor**. Nothing here
uses `supabase db push`.

| Part | Files                                                                    | When                                                       | Visible to users?                                                                 |
| ---- | ------------------------------------------------------------------------ | ---------------------------------------------------------- | --------------------------------------------------------------------------------- |
| 1    | `20261115120000_map_nav.sql`, then `20261115120050_map_geometry_ids.sql` | Now, while the old app is still the one deployed           | No. Only admins on the new build see the new "Map and rooms" section              |
| 2    | `20261115120100_rooms_migration_a.sql` (rooms migration step A)          | Only after the new build is deployed and in use everywhere | No, on the new build. On the **old** build, room pickers would list 285 new rooms |

Part 1 creates new tables and functions and adds one column to `app_settings`. It doesn't change any
room, floor, report, venue, event, policy or existing function. Part 2 only adds rows and columns;
nothing is moved, retired or deleted (that is step B, a later runbook).

**Hold back part 2:** don't run `supabase db push` from this branch until you want part 2. `db push`
applies every migration file the project hasn't recorded, which would include part 2.

Rehearsed on a local throwaway Postgres 17 with the same SQL (psql in place of the SQL Editor); see
"How this was tested" at the end. Not tested against Supabase itself.

## Before you start

- A full backup you can restore. Dashboard → Database → Backups (paid plans), or with PostgreSQL 17
  client tools: `pg_dump "<session pooler connection string>" -Fc -f campus-before-map.dump`
  (Project Settings → Database → Connection string → Session pooler). Keep it safe: it holds
  personal data.
- A quiet time (adding the column takes a brief lock on `app_settings`).
- This repository at the commit you are applying, to copy the files from.

How to run a file in the SQL Editor (every step below uses this):

1. SQL Editor → New query.
2. Type `begin;` on the first line, paste the **whole** file below it, then type `commit;` on the
   last line. (`20261115120050` is long, about 3,300 lines: paste all of it.)
3. Run. If it ends with an error, run `rollback;` in the same editor, and nothing from that file is
   kept. Copy the error and stop.

## Where am I?

Any time you're unsure what is applied (after an error, or before an undo), run
`docs/runbooks/sql/status.sql` (read-only). It says for each file "applied", "not applied" or
"PARTLY applied" (stop and tell the developer). The undo scripts are safe to run in any state:
anything already gone is skipped, so an undo when nothing is applied changes nothing.

If a script stops with an error in the SQL Editor, run `rollback;` before anything else.

## Part 1: the map tables (now)

### 1.1 Preflight (read-only)

Run `docs/runbooks/sql/preflight_part1.sql`. Every `result` must equal `expected`.
**Write down rows 6 and 7.** If rows 1-5 don't match, stop: the project is missing an earlier
migration or already has something with these names.

Row 7 showing an older newest version (for example `20261027120100`) means the CLI's history is
behind: later migrations were applied by hand, or not at all. It doesn't block part 1 (nothing in it
depends on them). `status.sql` row 5 says whether `20261114120000_after_school` is actually on the
project. If it is, add `'20261114120000'` to the list in `record_history.sql` at step 1.4 so a
later `db push` doesn't try to run it again. If it isn't, it still needs applying (separately from
this runbook) before the new build's after-school booking rules work.

Undo: nothing to undo.

### 1.2 Apply `20261115120000_map_nav.sql`

Run it as described above (`begin;` … `commit;`).

Check: it finishes without an error. In Table Editor, `map_connectors`, `map_presets`,
`map_assignments`, `map_overrides` and `map_geometry_ids` exist (the last one empty for now).

Undo: `docs/runbooks/sql/undo_20261115120000_map_nav.sql` (below).

### 1.3 Apply `20261115120050_map_geometry_ids.sql`

Same way.

Check: `select count(*) from public.map_geometry_ids;` returns **3257**.

Undo: `docs/runbooks/sql/undo_20261115120050_map_geometry_ids.sql` (empties the list only), or
undo part 1 as a whole.

### 1.4 Record them for the Supabase CLI

Only if row 7 of the preflight said the history table exists: run
`docs/runbooks/sql/record_history.sql` as it is (it lists the part 1 versions). Otherwise skip this
step (the script does nothing on a project without the table anyway).

Check: `npx supabase migration list` shows `20261115120000` and `20261115120050` in both columns,
and `20261115120100` as Local only.

Undo: the undo scripts remove these rows themselves.

### 1.5 Check

Run `docs/runbooks/sql/check_part1_map_tables.sql`. Every `result` must equal `expected`
(row 11 confirms part 2 is still held back).

### 1.6 Check the old app (still deployed)

- Sign in as an admin: Admin → Settings and the other settings pages open and save as before.
- Map screen, fix-it report form, bookings, volunteering, announcements, projects: as before.
- Admin → Audit log: as before. New entries appear only when someone uses the new section.

### Undo part 1

Undo part 2 first if it has been applied (the script refuses otherwise). **This removes any terms,
room names, stairs, lifts and flags admins have entered since.** Export them first (SQL Editor, save
each result):

```sql
select jsonb_agg(c) from public.map_connectors c;
select jsonb_agg(p) from public.map_presets p;
select jsonb_agg(a) from public.map_assignments a;
select jsonb_agg(o) from public.map_overrides o;
```

1. Open `docs/runbooks/sql/undo_20261115120000_map_nav.sql`. If preflight row 6 said **yes**,
   change `true` to `false` on the marked line, so `app_settings` stays in Realtime as before.
2. Run it. It has its own `begin;` and `commit;`; paste it as it is.
3. Check: run `preflight_part1.sql` again: rows 3, 4 and 6 are back to what you wrote down.

## Part 2: rooms migration step A (later)

Only when the new build (with the new `src/features/map/api.ts`) is deployed and everyone uses it.
The new build shows only the original rooms whether or not part 2 is applied; the old build would
list the 285 new rooms in room pickers.

### 2.1 Fresh backup, then preflight (read-only)

Take a new backup as in "Before you start". Run `docs/runbooks/sql/preflight_part2.sql`.
Rows 1-3 and 8 must match. **Write down rows 4-7** (rooms, and reports, venues and events with a
room). If row 8 lists codes, those placeholders are named differently on this project. Nothing
breaks, but tell the developer: the mapping for those rooms must be fixed before step B.

### 2.2 Apply `20261115120100_rooms_migration_a.sql`

Same way (`begin;` … `commit;`).

Check: finishes without an error.

### 2.3 Record it for the Supabase CLI

If the history table exists: edit the marked line of `record_history.sql` to
`array['20261115120100']` and run it.

### 2.4 Check

Run `docs/runbooks/sql/check_part2_rooms_a.sql`. Every `result` must equal `expected`; rows 13 and
16-18 must equal your numbers from 2.1.

Then in the app: Map screen shows floors G, 1, 2 only (no floor 3) with the same pins; fix-it
report form, venue admin and event form list the same rooms as before.

### Undo part 2

Safe until step B has run. Removes the 285 traced rooms, floor 3, the three helper tables and the
two new columns; every original room, report, venue and event stays as it was.

1. Run `docs/runbooks/sql/undo_20261115120100_rooms_migration_a.sql` (has its own `begin;`/`commit;`).
2. Check: run `preflight_part2.sql` again: rows 2 and 3 say `true` and `0`, row 4 equals your
   number from 2.1.

## Part 3: fix-it reports about a lift, stairs or door (after part 1)

`20261116120000_report_map_target.sql` lets a report say which lift, staircase or door it is about,
and adds three columns to `report_feed()`. It needs part 1, not part 2. The deployed old app keeps
working: it doesn't send the new columns, and `report_feed()` still returns every column it reads
(the new ones are added at the end). Apply it before or with the build that has the new report form.

1. `status.sql`: row 1 says "applied" and row 6 "not applied".
2. Apply `20261116120000_report_map_target.sql` with `begin;` ... `commit;` as above.
3. If the history table exists: set the marked line of `record_history.sql` to
   `array['20261116120000']` and run it.
4. Run `docs/runbooks/sql/check_part3_report_target.sql`: every `result` equals `expected`.
5. In the app: open a fix-it report (list and detail pages), and file a test report: both work as
   before.

Undo: `docs/runbooks/sql/undo_20261116120000_report_map_target.sql` puts `report_feed()` back as it
was and removes the columns (the "about" link on reports made since is lost; the reports stay).
Check with `status.sql` row 6 = "not applied".

## Last resort

If something looks wrong and the undo scripts don't fix it, restore the backup (Database → Backups,
or `pg_restore --clean --if-exists -d "<connection string>" campus-before-map.dump`). That also
throws away anything written since the backup, and restoring over a live Supabase project can clash
with Supabase's own schemas, so prefer the undo scripts.

## How this was tested (locally only)

On a throwaway Postgres 17.9 with `tools/local-pg`, starting from a database with every earlier
migration and the seed (the state of the cloud project): preflight; part 1 applied with
`begin;`/`commit;` around each file; history recorded into a stand-in history table; checks; the
existing pgTAP tests for every older feature run against that state (all pass apart from the two
date-related failures that predate this work); undo of each file; schema compared with the start
(identical); part 1 again; part 2; checks; undo part 2 (schema identical to part 1 only). Also:
part 1 with `app_settings` already in Realtime, and its undo keeping it there.
