-- =============================================================================
-- Part 1 checks (read-only), after 20261115120000 and 20261115120050.
-- Every row's `result` should equal `expected`.
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
select 6, 'Terms (none until an admin starts one)',
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
select 10, 'The internal room-names writer is NOT callable by signed-in users',
  has_function_privilege('authenticated', 'public.map_write_assignments(uuid, jsonb, text)', 'execute')::text,
  'false'
union all
select 11, 'Rooms migration A is NOT applied yet (held back)',
  (to_regclass('public.room_migration_traced') is null)::text,
  'true'
order by n;
