-- =============================================================================
-- Read-only checks after applying the map migrations (runbook, steps 6 and 7).
-- Changes nothing. Paste into the SQL editor; every row's `result` should
-- equal its `expected`. Rows marked "your count" compare with step 1.
-- The step A rows only make sense once 20261115120100 is applied.
-- =============================================================================
with
map_tables(name) as (
  values ('map_geometry_ids'), ('map_connectors'), ('map_presets'), ('map_assignments'), ('map_overrides')
),
live_tables(name) as (
  values ('map_connectors'), ('map_overrides'), ('map_presets'), ('map_assignments'), ('app_settings')
)
select 1 as n, 'Map tables exist, RLS on' as check_name,
  (select count(*) from pg_tables t join map_tables m on m.name = t.tablename
   where t.schemaname = 'public' and t.rowsecurity)::text as result,
  '5' as expected
union all
select 2, 'App roles have no write grants on map tables',
  (select count(*) from information_schema.role_table_grants g join map_tables m on m.name = g.table_name
   where g.table_schema = 'public' and g.grantee in ('anon', 'authenticated')
     and g.privilege_type in ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE'))::text,
  '0'
union all
select 3, 'Map ids loaded', (select count(*) from public.map_geometry_ids)::text, '3257'
union all
select 4, 'Of which nameable (rooms, places, entrances)',
  (select count(*) from public.map_geometry_ids where destination)::text, '426'
union all
select 5, 'Stairs and lifts (none until an admin places them)',
  (select count(*) from public.map_connectors)::text, '0'
union all
select 6, 'Terms (none until an admin imports the CSV)',
  (select count(*) from public.map_presets)::text, '0'
union all
select 7, 'Active term', (select coalesce(map_active_preset_id::text, 'none') from public.app_settings), 'none'
union all
select 8, 'Tables sent through Realtime',
  (select count(*) from pg_publication_tables p join live_tables l on l.name = p.tablename
   where p.pubname = 'supabase_realtime' and p.schemaname = 'public')::text,
  '5'
union all
select 9, 'map_set_available is callable by signed-in users',
  has_function_privilege('authenticated', 'public.map_set_available(text, text, boolean)', 'execute')::text,
  'true'
union all
select 10, 'The internal assignments writer is NOT callable by signed-in users',
  has_function_privilege('authenticated', 'public.map_write_assignments(uuid, jsonb, text)', 'execute')::text,
  'false'
-- ---------- Step A (20261115120100) ----------
union all
select 11, 'Step A: traced rooms added',
  (select count(*) from public.rooms where region_id is not null)::text, '285'
union all
select 12, 'Step A: floor 3 added, without an image',
  (select count(*) from public.floors where name = '3' and image_path is null)::text, '1'
union all
select 13, 'Step A: original rooms untouched (region_id empty, not retired)',
  (select count(*) from public.rooms where region_id is null and retired_at is null)::text,
  'your rooms count from step 1'
union all
select 14, 'Step A: placeholders mapped to a traced room',
  (select count(*) from public.room_migration_map where old_room_id is not null and new_room_id is not null)::text,
  '15 (fewer if your placeholder codes differ: see row 15)'
union all
select 15, 'Step A: placeholder codes not found',
  coalesce((select string_agg(old_code, ', ' order by old_code) from public.room_migration_map
            where old_room_id is null), 'none'),
  'none'
union all
select 16, 'Step A: reports backed up',
  (select count(*) from public.room_migration_backup where table_name = 'reports')::text,
  'your "reports with a room" count from step 1'
union all
select 17, 'Step A: venues backed up',
  (select count(*) from public.room_migration_backup where table_name = 'venues')::text,
  'your "venues with a room" count from step 1'
union all
select 18, 'Step A: volunteer events backed up',
  (select count(*) from public.room_migration_backup where table_name = 'volunteer_events')::text,
  'your "events with a room" count from step 1'
union all
select 19, 'Step A: reports, venues, events moved to a traced room (must be none before step B)',
  ((select count(*) from public.reports r join public.rooms o on o.id = r.room_id where o.region_id is not null)
   + (select count(*) from public.venues v join public.rooms o on o.id = v.room_id where o.region_id is not null)
   + (select count(*) from public.volunteer_events e join public.rooms o on o.id = e.room_id where o.region_id is not null))::text,
  '0'
order by n;
