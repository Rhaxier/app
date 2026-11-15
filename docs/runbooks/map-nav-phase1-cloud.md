# Runbook: indoor-nav phase 1 migrations on the cloud Supabase project

What this applies (three files, in this order; the second is generated data that the first needs):

| File                                                       | What it does                                                                                                                                     | Visible to users?                                                              |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| `supabase/migrations/20261115120000_map_nav.sql`           | New `map_*` tables (stairs and lifts, terms, room names, flags), their RLS, the `map_*` functions, `app_settings.map_active_preset_id`, Realtime | No                                                                             |
| `supabase/migrations/20261115120050_map_geometry_ids.sql`  | 3,257 rows: the ids that exist on the traced map                                                                                                 | No                                                                             |
| `supabase/migrations/20261115120100_rooms_migration_a.sql` | Rooms migration **step A** (additive): `rooms.region_id`, `rooms.retired_at`, floor 3, 285 traced rooms, mapping and backup tables               | No, **if** the app build from this branch is the one people use (step 3 below) |

Nothing here moves, retires or deletes an existing room, report, venue or event. Step B (the switch)
is a separate, later runbook.

Rehearsed on a local throwaway Postgres 17 (`tools/local-pg/run.sh`): apply, check, undo both, schema
compared with a database that never had them (identical), re-apply onto existing data, check again.
Not rehearsed: the Supabase CLI against a real project, Supabase's own Realtime and PostgREST.

## You need

- This branch checked out, with `npm install` done.
- The Supabase CLI linked to the project: `npx supabase link --project-ref <your-project-ref>`
  (asks for the database password). `migration list` and `db push` don't need Docker.
- For the backup: `pg_dump` version 17 (PostgreSQL 17 client tools). `npx supabase db dump` also
  works, but it needs Docker.
- About 20 minutes, at a quiet time.

## 1. Backup and counts (before anything else)

1. Dashboard → Project Settings → Database → Connection string → **Session pooler**. Copy it.
2. Full backup to a file (keep it somewhere safe, it holds personal data):

   ```
   pg_dump "<session pooler connection string>" -Fc -f campus-before-map-phase1.dump
   ```

   Check: the file exists and is not tiny (`ls -l`; more than a few hundred KB).

3. Dashboard → SQL editor, run and **write the four numbers down**:

   ```sql
   select
     (select count(*) from public.reports where room_id is not null)          as reports_with_room,
     (select count(*) from public.venues where room_id is not null)           as venues_with_room,
     (select count(*) from public.volunteer_events where room_id is not null) as events_with_room,
     (select count(*) from public.rooms)                                       as rooms;
   ```

   Undo: nothing to undo.

## 2. Check what's pending

```
npx supabase migration list
```

Check: every migration up to and including `20261114120000` shows in **both** the Local and Remote
columns, and only `20261115120000`, `20261115120050`, `20261115120100` are Local only.
If anything else is Local only, **stop**: `db push` would apply that too. Sort that out first.

## 3. Ship the app build from this branch first

Run or deploy the app from this branch (and ask teammates to pull it) **before** step 4. It works on
the database before and after step A: today's map, the room pickers and the old Map admin page
show only the original rooms and floors either way (`src/features/map/api.ts`).
An older build would list the 285 new rooms in the room pickers as soon as step A is applied.

Check: open the Map screen and the fix-it report form: the same rooms as yesterday.
Undo: redeploy the previous build (safe while step A is not applied).

## 4. Dry run

```
npx supabase db push --dry-run
```

Check: it lists exactly the three files above and nothing else. Undo: nothing to undo.

## 5. Apply

```
npx supabase db push
```

It asks to confirm, then applies the files in order. Each file runs in its own transaction: if one
fails, that file is rolled back, the ones before it stay applied, and the CLI stops. Copy the error,
then go to step 6 to see where it stopped.

Check: the command ends without an error; `npx supabase migration list` now shows all three in both
columns.

## 6. Check the database

Dashboard → SQL editor: paste and run `docs/runbooks/sql/check_map_nav_phase1.sql` (read-only).
Every row's `result` must equal `expected`; rows 13, 16, 17, 18 must equal your numbers from step 1
(row 13 = your `rooms`).

If row 15 lists placeholder codes, those placeholders have other codes on this project: nothing is
broken, but the mapping for those rooms must be fixed before step B (tell the developer).

## 7. Check the app

- Map screen: floors G, 1, 2 only (no floor 3), the same pins as before.
- Fix-it report form, venue admin, volunteer event form: the same room list as before.
- Admin → Map (old pins): the same floors and rooms.
- Nothing new is visible yet: the new admin section and student map come in later phases.

## Undo

Undo in reverse order. Each undo script refuses to run, and changes nothing, if it isn't safe.

### Undo step A (`20261115120100`)

Safe until step B has run. Removes the 285 traced rooms, floor 3, the helper tables and the two
columns; leaves every original room, report, venue and event as it was.

1. Dashboard → SQL editor: run `docs/runbooks/sql/undo_20261115120100_rooms_migration_a.sql`.
2. Check:

   ```sql
   select count(*) from information_schema.columns
   where table_schema = 'public' and table_name = 'rooms' and column_name in ('region_id', 'retired_at');
   -- expect 0
   select count(*) from public.rooms;  -- expect your step 1 "rooms" number
   ```

   `npx supabase migration list` shows `20261115120100` as Local only again.

3. A later `db push` would apply it again. To hold it back, don't push from this branch until you
   decide.

### Undo the map tables (`20261115120000` and `20261115120050`)

Only after step A is undone. **This removes any stairs, lifts, terms and room names admins have
entered.** Export them first (SQL editor; save each result):

```sql
select jsonb_agg(c) from public.map_connectors c;
select jsonb_agg(p) from public.map_presets p;
select jsonb_agg(a) from public.map_assignments a;
select jsonb_agg(o) from public.map_overrides o;
```

1. Run `docs/runbooks/sql/undo_20261115120000_map_nav.sql`.
2. Check: `select to_regclass('public.map_connectors');` returns null;
   `npx supabase migration list` shows both as Local only.

### Last resort: restore the backup

If something looks wrong and the undo scripts don't fix it: Dashboard → Database → Backups (paid
plans), or restore the file from step 1 with
`pg_restore --clean --if-exists -d "<connection string>" campus-before-map-phase1.dump`.
This also throws away anything written since the backup, so prefer the undo scripts. Restoring
over a live Supabase project can clash with Supabase's own schemas: try it on a new free project
first.
