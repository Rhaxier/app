-- =============================================================================
-- Part 1 preflight (read-only). Run in the SQL Editor BEFORE applying
-- 20261115120000_map_nav.sql. Every row's `result` should equal `expected`.
-- Write down rows 6 and 7: the undo needs them.
-- =============================================================================
select 1 as n, 'Tables part 1 needs' as check_name,
  coalesce(nullif(concat_ws(', ',
    case when to_regclass('public.profiles') is null then 'profiles' end,
    case when to_regclass('public.app_settings') is null then 'app_settings' end,
    case when to_regclass('public.responsibilities') is null then 'responsibilities' end,
    case when to_regclass('public.report_categories') is null then 'report_categories' end,
    case when to_regclass('public.audit_log') is null then 'audit_log' end
  ), ''), 'all there') as result,
  'all there' as expected
union all
select 2, 'Functions part 1 needs',
  coalesce(nullif(concat_ws(', ',
    case when to_regprocedure('public.is_admin()') is null then 'is_admin()' end,
    case when to_regprocedure('public.is_staff()') is null then 'is_staff()' end,
    case when to_regprocedure('public.set_updated_at()') is null then 'set_updated_at()' end
  ), ''), 'all there'),
  'all there'
union all
select 3, 'Nothing called map_* exists yet (tables, types, functions)',
  ((select count(*) from pg_class c join pg_namespace s on s.oid = c.relnamespace
    where s.nspname = 'public' and c.relname like 'map\_%')
   + (select count(*) from pg_type t join pg_namespace s on s.oid = t.typnamespace
      where s.nspname = 'public' and t.typname like 'map\_%')
   + (select count(*) from pg_proc p join pg_namespace s on s.oid = p.pronamespace
      where s.nspname = 'public' and p.proname like 'map\_%'))::text,
  '0'
union all
select 4, 'app_settings has no map_active_preset_id yet',
  (select count(*) from information_schema.columns
   where table_schema = 'public' and table_name = 'app_settings'
     and column_name = 'map_active_preset_id')::text,
  '0'
union all
select 5, 'Realtime publication',
  coalesce((select case when puballtables then 'covers all tables' else 'exists' end
            from pg_publication where pubname = 'supabase_realtime'), 'missing'),
  'exists'
union all
select 6, 'WRITE DOWN: app_settings already sent through Realtime?',
  case when exists (select 1 from pg_publication_tables
                    where pubname = 'supabase_realtime' and schemaname = 'public'
                      and tablename = 'app_settings')
       then 'yes' else 'no' end,
  'no (if yes, see the undo note)'
union all
select 7, 'WRITE DOWN: migration history table (Supabase CLI)',
  case when to_regclass('supabase_migrations.schema_migrations') is null then 'none'
       -- Read through query_to_xml so this file also runs where the table doesn't exist.
       else 'exists, newest: ' || coalesce((xpath('/row/v/text()', query_to_xml(
         'select max(version) as v from supabase_migrations.schema_migrations', false, true, '')))[1]::text,
         'empty')
  end,
  'none, or newest 20261114120000'
order by n;
