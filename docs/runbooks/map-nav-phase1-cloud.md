# Runbook: the indoor map on the cloud Supabase project (SQL Editor)

Five parts, applied at different times, all by hand in the dashboard's **SQL Editor**. Nothing here
uses `supabase db push`.

| Part | What                                                                        | When                                                  | Visible to users?                                                                 |
| ---- | --------------------------------------------------------------------------- | ----------------------------------------------------- | --------------------------------------------------------------------------------- |
| 1    | `20261115120000_map_nav.sql`, then `20261115120050_map_geometry_ids.sql`    | Any time                                              | No. Admins on the new build get the "Map and rooms" section                       |
| 2    | `20261115120100_rooms_migration_a.sql` (rooms migration step A)             | After the new build is deployed and in use everywhere | No, on the new build. On the **old** build, room pickers would list 285 new rooms |
| 3    | `20261116120000_report_map_target.sql` (reports about a lift or door)       | After part 1, before or with the build that uses it   | No                                                                                |
| 4    | `20261116130000_rooms_migration_b.sql` (the release tools; changes no data) | After part 2                                          | No                                                                                |
| 5    | **The release:** `select public.room_migration_b_apply();`                  | When the school is ready, after a fresh backup        | **Yes:** `/map` becomes the indoor map, room pickers list the traced rooms        |

Parts 1-4 add tables, columns and functions; they don't move, retire or delete anything. Part 5
moves the reports, venues and volunteer events from the 15 placeholder rooms to traced rooms,
retires (hides, never deletes) the placeholders, and switches the app over. It has an exact undo.

**Don't run `supabase db push` from this branch** unless you mean to apply every part not yet
applied. (Part 5 is never applied by `db push`: it is a function you call.)

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
later `db push` doesn't try to run it again. If it isn't, apply it with **Part 0** at the end of this
runbook (it can go at any time; see "Does it have to go before the release?" there).

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

## Part 4: the release tools (after part 2)

`20261116130000_rooms_migration_b.sql` adds `app_settings.map_indoor_live` (off), a table for the old
floor values, and the functions `room_migration_b_apply()` / `room_migration_b_undo()` (only the
database owner, i.e. the SQL Editor, can run them; never the app). It changes no data.

1. `status.sql`: rows 1, 3 say "applied"; row 7 "not applied".
2. Apply the file with `begin;` ... `commit;`.
3. History table: set `record_history.sql`'s marked line to `array['20261116130000']`, run it.
4. `status.sql`: row 7 "applied", row 8 "no".

Undo: `docs/runbooks/sql/undo_20261116130000_rooms_migration_b.sql` (refuses while released).

## Part 5: the release (the school's go-ahead day)

What students see change: `/map` becomes the indoor map with directions, and every room picker (fix-it
form, venues, volunteering) and search list the rooms traced from the floor plan, with this term's
names. Open apps switch within about a minute (or on reload); nobody needs a new build. Your counts at
the backup: **12 reports, 4 venues, 3 volunteer events** with a room.

### 5.1 Before

1. The build deployed everywhere is this branch's (it follows the switch). Check: as a student,
   `/map` shows the old map today.
2. **A fresh backup** ("Before you start"). This is the step most worth a backup.
3. Stairs and lifts placed and saved (Admin -> Map and rooms -> Stairs and lifts says "All four
   floors are connected."), and the term you want students to see is **active** (Classrooms tab).
4. `status.sql`: parts 1-4 "applied", row 8 "no".

### 5.2 Preflight (read-only)

Run `docs/runbooks/sql/preflight_part5_release.sql`. Rows 1-4 must equal `expected`. If row 4 lists
codes, those placeholder rooms are in use but have nowhere to go: stop and tell the developer (the
mapping in `room_migration_map` needs a line for each). **Write down rows 5-9.**

### 5.3 Release

New query, run exactly:

```sql
select public.room_migration_b_apply();
```

It answers with what it did, e.g.
`{"events_moved": 3, "venues_moved": 4, "reports_moved": 12, "placeholders_retired": 15}`.
If it stops with "These placeholder rooms are in use but have no traced room ...", nothing was changed:
see 5.2. Running it twice is harmless (the second time it moves nothing).

### 5.4 Check (read-only)

Run `docs/runbooks/sql/check_part5_release.sql`. Every `result` must equal `expected`; the "your"
rows must equal what you wrote down in 5.2 (counts can only stay the same: nothing is deleted).

### 5.5 Check the app (as a student, then as an admin)

- `/map` is the indoor map; search "Where to?" finds rooms by this term's names; a route works.
- Fix-it report form: "Where is it?" lists traced rooms ("PYP3 B (Ground floor)"); open reports appear
  as pins on their rooms on the indoor map; an old report still opens and shows its room.
- Venue admin and the volunteering event form list traced rooms; a venue shows its room.
- Admin -> Map (old pins) says the old pins are retired and links to Map and rooms.

### Undo the release

New query, run exactly:

```sql
select public.room_migration_b_undo();
```

Everything the release moved goes back to its placeholder room (reports with their old floor and pin),
the placeholders come back, the floors get their images and sizes back, and `/map` is the old map
again within a minute. Reports, venues and events created **after** the release stay on the traced
rooms they were made for (the old map won't show those). Check with `preflight_part5_release.sql`:
row 2 "false" and rows 5-9 equal what you wrote down in 5.2 (plus anything created since).
Running the undo twice is harmless. To go further back, undo part 4, then part 2.

## Last resort

If something looks wrong and the undo scripts don't fix it, restore the backup (Database → Backups,
or `pg_restore --clean --if-exists -d "<connection string>" campus-before-map.dump`). That also
throws away anything written since the backup, and restoring over a live Supabase project can clash
with Supabase's own schemas, so prefer the undo scripts.

## How this was tested (locally only)

Parts 4 and 5 (2026-11-16): a local copy at the cloud project's state (earlier migrations and data),
parts 1-4 applied through the same SQL, the sample data topped up to the school's counts (12 / 4 / 3
with made-up reports). Preflight, release, check, the app's reads, older features' tests, a second
release (no change), undo (every row, floor and placeholder identical to before), release again.
pgTAP `22_rooms_migration_b_test.sql` covers the same (25 checks).

On a throwaway Postgres 17.9 with `tools/local-pg`, starting from a database with every earlier
migration and the seed (the state of the cloud project): preflight; part 1 applied with
`begin;`/`commit;` around each file; history recorded into a stand-in history table; checks; the
existing pgTAP tests for every older feature run against that state (all pass apart from the two
date-related failures that predate this work); undo of each file; schema compared with the start
(identical); part 1 again; part 2; checks; undo part 2 (schema identical to part 1 only). Also:
part 1 with `app_settings` already in Realtime, and its undo keeping it there.

---

## Part 0: the after-school booking migration (`20261114120000`)

Not part of the indoor map, but `status.sql` row 5 says "no" on your project, so it was never applied.
It is independent of parts 1-5 and can go at any point: before part 1, between parts, or after the
release.

### Does it have to go before the release?

**No. The release does not need it, and nothing in parts 1-5 touches it.** Apply it before the new
build goes live, though, because the new build's Venues admin page shows two settings that only exist
once it is applied ("after-school block length" and "latest after-school booking ends at"). Without it:

- The new build still works everywhere (it reads settings with `select *`; the booking page just doesn't
  offer after-school times).
- Changing either of those two settings in Admin > Venues fails with an error until it is applied.

**Effect on the old app while it is still live:** none that anyone sees. The old build ignores the two new
columns. The database rule `booking_period_problem()` is replaced; during school hours it behaves exactly
as before. The only change is that a booking after the last period (rounded up to 30-minute blocks, until
18:00) is now accepted by the database instead of refused, and the old app has no way to ask for one.
Existing bookings are not touched.

### 0.1 Check first (read-only)

Run `docs/runbooks/sql/check_part0_after_school.sql`. Rows 1-3 should say **no**; row 4 must say **yes**
(if it says MISSING, stop: an earlier migration is also missing).

### 0.2 Apply

Paste the whole of `supabase/migrations/20261114120000_after_school_booking.sql` into the SQL Editor
between `begin;` and `commit;` and run it. Then run `record_history.sql` with
`v_versions := array['20261114120000']`.

### 0.3 Check

Run `check_part0_after_school.sql` again: rows 1-4 all say **yes**. Optionally, in Admin > Venues (new build)
the two after-school settings appear and save.

### 0.4 Undo

Run `docs/runbooks/sql/undo_20261114120000_after_school_booking.sql`. It puts the old bell-times-only rule
back, removes the two settings (any value an admin chose is lost) and removes the history row. Bookings
already made after school stay as they are. Running it when the migration isn't applied does nothing harmful.
Check: `check_part0_after_school.sql` rows 1-3 say **no** again.

### How this was tested

Locally, from a database without the migration: check (all no) → apply → check (all yes; a Monday
15:00-15:30 booking passes, 17:45-18:15 is refused with "After school, bookings can run until 18:00.")
→ undo → check (all no) → undo again (harmless). The rule function after the undo is the original one.
Nothing was run against your cloud project.

### 0.5 If it is half applied ("column already exists")

Symptom: applying the migration fails with `column "after_school_block_minutes" ... already exists`, or
`check_part0_after_school.sql` shows a mix of yes and no (for example row 1 yes, row 2 no, row 3 yes).
That means an earlier attempt, or the undo, stopped part way. Don't apply the migration again.
Run `docs/runbooks/sql/repair_part0_after_school.sql` instead. It adds whichever setting is missing,
keeps any value already set, installs the new booking rule and records the history row. Safe to run
any number of times. Then run `check_part0_after_school.sql`: rows 1-4 must all say yes.
(To go the other way, run the undo in 0.4, then check that rows 1-3 say no.)
Tested locally from both half-applied states: both ended all yes.
