-- =============================================================================
-- Part 3 checks (read-only), after 20261116120000_report_map_target.sql.
-- Every row's `result` should equal `expected`.
-- =============================================================================
select 1 as n, 'Part 1 is applied (needed first)' as check_name,
  (to_regclass('public.map_connectors') is not null)::text as result, 'true' as expected
union all
select 2, 'reports has map_target_kind and map_target_id',
  (select count(*) from information_schema.columns
   where table_schema = 'public' and table_name = 'reports'
     and column_name in ('map_target_kind', 'map_target_id'))::text,
  '2'
union all
select 3, 'Reports with a target (none until someone uses it)',
  (select count(*) from public.reports where map_target_kind is not null)::text, '0'
union all
select 4, 'report_feed returns the target columns',
  (select count(*) from information_schema.routines r
   join information_schema.parameters p on p.specific_name = r.specific_name
   where r.routine_schema = 'public' and r.routine_name = 'report_feed'
     and p.parameter_name in ('map_target_kind', 'map_target_id', 'map_target_name'))::text,
  '3'
union all
select 5, 'The target check trigger is on reports',
  (select count(*) from pg_trigger where tgname = 'reports_check_map_target' and not tgisinternal)::text,
  '1'
union all
select 6, 'report_feed is callable by signed-in users',
  has_function_privilege('authenticated', 'public.report_feed()', 'execute')::text, 'true'
order by n;
