-- =============================================================================
-- Part 5 (the release) preflight. Read-only. Run in the SQL Editor right
-- before `select public.room_migration_b_apply();`.
-- Rows 1-5 must equal `expected`. WRITE DOWN rows 6-9: the release check
-- compares with them. Your counts at the backup were 12 reports, 4 venues
-- and 3 volunteer events with a room; today's may be a little higher (new
-- reports since), which is fine: what matters is that the check after the
-- release shows the same numbers as today's preflight.
-- =============================================================================
select 1 as n, 'Parts 1, 2 and 4 are applied' as check_name,
  (to_regclass('public.map_connectors') is not null
   and to_regclass('public.room_migration_traced') is not null
   and to_regprocedure('public.room_migration_b_apply()') is not null)::text as result,
  'true' as expected
union all
select 2, 'Not released yet',
  coalesce((xpath('/row/v/text()', query_to_xml(
    'select map_indoor_live as v from public.app_settings', false, true, '')))[1]::text, 'no column'),
  'false'
union all
select 3, 'Traced rooms present',
  (select count(*) from public.rooms where region_id is not null)::text, '285'
union all
select 4, 'Placeholders in use with no traced room to go to (must be none)',
  coalesce((select string_agg(o.code, ', ' order by o.code) from public.rooms o
            where o.region_id is null
              and (exists (select 1 from public.reports r where r.room_id = o.id)
                   or exists (select 1 from public.venues v where v.room_id = o.id)
                   or exists (select 1 from public.volunteer_events e where e.room_id = o.id))
              and not exists (select 1 from public.room_migration_map m
                              where m.old_code = o.code
                                and exists (select 1 from public.rooms n
                                            where n.region_id = m.new_region_id))),
           'none'),
  'none'
union all
select 5, 'WRITE DOWN: placeholder rooms (to be retired)',
  (select count(*) from public.rooms where region_id is null and retired_at is null)::text,
  '15 (or your own number)'
union all
select 6, 'WRITE DOWN: reports with a room',
  (select count(*) from public.reports where room_id is not null)::text, 'about 12'
union all
select 7, 'WRITE DOWN: venues with a room',
  (select count(*) from public.venues where room_id is not null)::text, 'about 4'
union all
select 8, 'WRITE DOWN: volunteer events with a room',
  (select count(*) from public.volunteer_events where room_id is not null)::text, 'about 3'
union all
select 9, 'WRITE DOWN: floors', (select count(*) from public.floors)::text, '4'
order by n;
