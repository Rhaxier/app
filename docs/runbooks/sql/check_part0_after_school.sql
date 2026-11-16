-- =============================================================================
-- After-school booking (20261114120000) check. Read-only. Run any time: before
-- applying it, every row says "no"; after, every row says "yes".
-- Changes nothing.
-- =============================================================================
select 1 as n, 'Setting after_school_block_minutes exists' as check_name,
  case when exists (select 1 from information_schema.columns where table_schema = 'public'
    and table_name = 'app_settings' and column_name = 'after_school_block_minutes')
    then 'yes' else 'no' end as result
union all
select 2, 'Setting after_school_until exists',
  case when exists (select 1 from information_schema.columns where table_schema = 'public'
    and table_name = 'app_settings' and column_name = 'after_school_until')
    then 'yes' else 'no' end
union all
select 3, 'The booking rule function knows about after school',
  case when to_regprocedure('public.booking_period_problem(timestamptz, timestamptz)') is not null
    and pg_get_functiondef(to_regprocedure('public.booking_period_problem(timestamptz, timestamptz)'))
        like '%after_school_until%'
    then 'yes' else 'no' end
union all
select 4, 'Needed from earlier migrations: periods, weekday_name, allow_custom_booking_times (must be yes, always)',
  case when to_regclass('public.periods') is not null
    and to_regprocedure('public.weekday_name(integer)') is not null
    and exists (select 1 from information_schema.columns where table_schema = 'public'
      and table_name = 'app_settings' and column_name = 'allow_custom_booking_times')
    then 'yes' else 'MISSING: stop and tell the developer' end
order by n;
