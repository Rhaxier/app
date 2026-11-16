-- =============================================================================
-- Where am I? (read-only). Run any time in the SQL Editor: says which parts of
-- the indoor-map migrations are applied, fully, partly or not at all.
-- Changes nothing.
-- =============================================================================
select 1 as n, 'Part 1, map_nav (20261115120000)' as item,
  case
    when to_regclass('public.map_connectors') is null
         and (select count(*) from pg_proc p join pg_namespace s on s.oid = p.pronamespace
              where s.nspname = 'public' and p.proname like 'map\_%') = 0
      then 'not applied'
    when (select count(*) from pg_proc p join pg_namespace s on s.oid = p.pronamespace
          where s.nspname = 'public' and p.proname like 'map\_%') = 13
         and (select count(*) from pg_tables where schemaname = 'public' and tablename in
              ('map_geometry_ids', 'map_connectors', 'map_presets', 'map_assignments', 'map_overrides')) = 5
         and exists (select 1 from information_schema.columns where table_schema = 'public'
                     and table_name = 'app_settings' and column_name = 'map_active_preset_id')
      then 'applied'
    else 'PARTLY applied: tell the developer'
  end as state
union all
select 2, 'Part 1, map ids (20261115120050)',
  case
    when to_regclass('public.map_geometry_ids') is null then 'not applied (needs map_nav first)'
    when (xpath('/row/c/text()', query_to_xml('select count(*) as c from public.map_geometry_ids', false, true, '')))[1]::text = '3257' then 'applied (3257 ids)'
    when (xpath('/row/c/text()', query_to_xml('select count(*) as c from public.map_geometry_ids', false, true, '')))[1]::text = '0' then 'not applied (list empty)'
    else 'PARTLY applied: tell the developer'
  end
union all
select 3, 'Part 2, rooms migration A (20261115120100)',
  case
    when to_regclass('public.room_migration_traced') is null
         and not exists (select 1 from information_schema.columns where table_schema = 'public'
                         and table_name = 'rooms' and column_name = 'region_id')
      then 'not applied'
    when to_regclass('public.room_migration_traced') is not null
         and exists (select 1 from information_schema.columns where table_schema = 'public'
                     and table_name = 'rooms' and column_name = 'region_id')
      then 'applied'
    else 'PARTLY applied: tell the developer'
  end
union all
select 6, 'Part 3, report target (20261116120000)',
  case
    when exists (select 1 from information_schema.columns where table_schema = 'public'
                 and table_name = 'reports' and column_name = 'map_target_id')
         and to_regprocedure('public.reports_check_map_target()') is not null
      then 'applied'
    when not exists (select 1 from information_schema.columns where table_schema = 'public'
                     and table_name = 'reports' and column_name = 'map_target_id')
         and to_regprocedure('public.reports_check_map_target()') is null
      then 'not applied'
    else 'PARTLY applied: tell the developer'
  end
union all
select 4, 'Recorded in the CLI history',
  case when to_regclass('supabase_migrations.schema_migrations') is null then 'no history table'
       else coalesce((xpath('/row/v/text()', query_to_xml(
         $q$select string_agg(version, ', ' order by version) as v from supabase_migrations.schema_migrations where version like '20261115%' or version like '20261116%'$q$,
         false, true, '')))[1]::text, 'none of them')
  end
union all
select 5, 'Earlier migration after_school (20261114120000) present',
  case when exists (select 1 from information_schema.columns where table_schema = 'public'
                    and table_name = 'app_settings' and column_name = 'after_school_until')
       then 'yes' else 'no' end
order by n;
