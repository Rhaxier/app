-- =============================================================================
-- Rooms migration, step B: the switch to the indoor map (MAP_NOTES.md,
-- "Rooms migration plan", step 3).
--
-- This file CHANGES NO DATA. It only adds the tools for the release:
--
--   select public.room_migration_b_apply();   -- the release
--   select public.room_migration_b_undo();    -- back to how it was
--
-- Why functions instead of statements in this file: a migration runs
-- whenever someone runs `supabase db push` or `db reset`, and the release must
-- only happen on purpose, on the day, after a backup. A function also makes
-- the undo exact and testable (supabase/tests/22_rooms_migration_b_test.sql).
--
-- What the release does, in one transaction:
--   1. Brings the backup and the placeholder -> traced room mapping up to date
--      (room_migration_a_fill(), from step A).
--   2. Stops, changing nothing, if a placeholder room that a report, venue or
--      event uses has no traced room to go to.
--   3. Moves those reports (room, floor and pin position), venues and
--      volunteer events to their traced rooms.
--   4. Retires the placeholder rooms: retired_at is set; nothing is deleted.
--   5. Moves the floors to the traced map's coordinates (no image; the app
--      draws them from geometry.json). The old values are kept for the undo.
--   6. Turns on app_settings.map_indoor_live: the app then shows the indoor
--      map at /map and lists the traced rooms in every room picker.
--
-- Needs step A (20261115120100_rooms_migration_a.sql).
-- =============================================================================

-- The switch the app reads (src/features/map/useIndoorMapLive.ts).
alter table public.app_settings
  add column map_indoor_live boolean not null default false;

-- The floors as they were before the release, for the undo. Filled by apply.
create table public.room_migration_floors_backup (
  floor_id uuid primary key references public.floors (id) on delete restrict,
  name text not null,
  image_path text,
  width int not null,
  height int not null,
  captured_at timestamptz not null default now()
);

alter table public.room_migration_floors_backup enable row level security;

create policy "Admins read the floors backup"
on public.room_migration_floors_backup for select to authenticated using (public.is_admin());

revoke insert, update, delete, truncate on public.room_migration_floors_backup from authenticated, anon;

-- -----------------------------------------------------------------------------
-- Room names follow the active term once the indoor map is live.
--
-- The traced rooms got their names from the floor plan in step A. After the
-- release, renaming a room for the active term (Map and rooms > Classrooms),
-- or switching terms, renames it in `rooms` too, so the report form, venues,
-- events and report cards show the same name as the map. A room the term
-- leaves unnamed keeps its last name (a report about it still needs one).
-- -----------------------------------------------------------------------------
create function public.rooms_sync_names()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not coalesce((select map_indoor_live from public.app_settings), false) then
    return;
  end if;
  update public.rooms r
  set name = a.name
  from public.map_assignments a, public.app_settings s
  where a.preset_id = s.map_active_preset_id
    and r.region_id = a.region_id
    and r.retired_at is null
    and r.name is distinct from a.name;
end;
$$;

create function public.rooms_sync_names_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.rooms_sync_names();
  return null;
end;
$$;

create trigger map_assignments_sync_rooms
after insert or update or delete on public.map_assignments
for each statement execute function public.rooms_sync_names_trigger();

create trigger app_settings_sync_rooms
after update of map_active_preset_id, map_indoor_live on public.app_settings
for each statement execute function public.rooms_sync_names_trigger();

-- -----------------------------------------------------------------------------
-- The release.
-- -----------------------------------------------------------------------------
create function public.room_migration_b_apply()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_live boolean := coalesce((select map_indoor_live from public.app_settings), false);
  v_unmapped text;
  v_reports int;
  v_venues int;
  v_events int;
  v_retired int;
begin
  -- 1. Backup and mapping current on the day. Only before the first apply:
  --    afterwards the rows sit on traced rooms, and refreshing the backup
  --    would overwrite where they came from.
  if not v_live then
    perform public.room_migration_a_fill();
  end if;

  -- 2. Every placeholder in use must have somewhere to go.
  select string_agg(o.code, ', ' order by o.code) into v_unmapped
  from public.rooms o
  where o.region_id is null
    and (exists (select 1 from public.reports r where r.room_id = o.id)
         or exists (select 1 from public.venues v where v.room_id = o.id)
         or exists (select 1 from public.volunteer_events e where e.room_id = o.id))
    and not exists (
      select 1 from public.room_migration_map m
      where m.old_room_id = o.id and m.new_room_id is not null
    );
  if v_unmapped is not null then
    raise exception 'These placeholder rooms are in use but have no traced room to move to: %. Nothing was changed.', v_unmapped
      using hint = 'Add them to room_migration_map (old_code -> new_region_id), then run this again.';
  end if;

  -- 3. Snapshot the floors (once), then move the rows.
  insert into public.room_migration_floors_backup (floor_id, name, image_path, width, height)
  select id, name, image_path, width, height from public.floors
  on conflict (floor_id) do nothing;

  update public.reports r
  set room_id = m.new_room_id, floor_id = n.floor_id, x = n.x, y = n.y
  from public.room_migration_map m
  join public.rooms n on n.id = m.new_room_id
  where r.room_id = m.old_room_id;
  get diagnostics v_reports = row_count;

  update public.venues v
  set room_id = m.new_room_id
  from public.room_migration_map m
  where v.room_id = m.old_room_id and m.new_room_id is not null;
  get diagnostics v_venues = row_count;

  update public.volunteer_events e
  set room_id = m.new_room_id
  from public.room_migration_map m
  where e.room_id = m.old_room_id and m.new_room_id is not null;
  get diagnostics v_events = row_count;

  -- 4. Hide the placeholders. Never deleted: old records still point at them.
  update public.rooms set retired_at = now() where region_id is null and retired_at is null;
  get diagnostics v_retired = row_count;

  -- 5. Floors in the traced map's coordinates (geometry.bounds max x / y).
  update public.floors
  set image_path = null, width = 3448, height = 2551
  where image_path is not null or width <> 3448 or height <> 2551;

  -- 6. Switch on (the app_settings trigger then syncs room names).
  update public.app_settings set map_indoor_live = true where not map_indoor_live;
  perform public.rooms_sync_names();

  insert into public.audit_log (actor_id, action, table_name, row_id, details)
  values (
    auth.uid(), 'rooms_migration_b_applied', 'rooms', null,
    jsonb_build_object('reports', v_reports, 'venues', v_venues, 'volunteer_events', v_events,
                       'placeholders_retired', v_retired, 'already_live', v_live)
  );
  return jsonb_build_object('reports_moved', v_reports, 'venues_moved', v_venues,
                            'events_moved', v_events, 'placeholders_retired', v_retired);
end;
$$;

-- -----------------------------------------------------------------------------
-- The undo. Rows the release moved go back to their placeholder room (with
-- their old floor and pin position for reports). Rows created after the
-- release stay on the traced rooms they were made for. Safe to run again.
-- -----------------------------------------------------------------------------
create function public.room_migration_b_undo()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reports int;
  v_venues int;
  v_events int;
  v_restored int;
begin
  update public.reports r
  set room_id = b.old_room_id, floor_id = b.old_floor_id, x = b.old_x, y = b.old_y
  from public.room_migration_backup b
  join public.room_migration_map m on m.old_room_id = b.old_room_id
  where b.table_name = 'reports' and b.row_id = r.id and r.room_id = m.new_room_id;
  get diagnostics v_reports = row_count;

  update public.venues v
  set room_id = b.old_room_id
  from public.room_migration_backup b
  join public.room_migration_map m on m.old_room_id = b.old_room_id
  where b.table_name = 'venues' and b.row_id = v.id and v.room_id = m.new_room_id;
  get diagnostics v_venues = row_count;

  update public.volunteer_events e
  set room_id = b.old_room_id
  from public.room_migration_backup b
  join public.room_migration_map m on m.old_room_id = b.old_room_id
  where b.table_name = 'volunteer_events' and b.row_id = e.id and e.room_id = m.new_room_id;
  get diagnostics v_events = row_count;

  update public.rooms set retired_at = null where region_id is null and retired_at is not null;
  get diagnostics v_restored = row_count;

  update public.floors f
  set image_path = s.image_path, width = s.width, height = s.height
  from public.room_migration_floors_backup s
  where s.floor_id = f.id
    and (f.image_path, f.width, f.height) is distinct from (s.image_path, s.width, s.height);

  update public.app_settings set map_indoor_live = false where map_indoor_live;

  insert into public.audit_log (actor_id, action, table_name, row_id, details)
  values (
    auth.uid(), 'rooms_migration_b_undone', 'rooms', null,
    jsonb_build_object('reports', v_reports, 'venues', v_venues, 'volunteer_events', v_events,
                       'placeholders_restored', v_restored)
  );
  return jsonb_build_object('reports_restored', v_reports, 'venues_restored', v_venues,
                            'events_restored', v_events, 'placeholders_restored', v_restored);
end;
$$;

-- Only the database owner (the SQL Editor) runs these; never the app.
revoke execute on function public.room_migration_b_apply() from public, anon, authenticated;
revoke execute on function public.room_migration_b_undo() from public, anon, authenticated;
revoke execute on function public.rooms_sync_names() from public, anon, authenticated;
revoke execute on function public.rooms_sync_names_trigger() from public, anon, authenticated;
