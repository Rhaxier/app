-- =============================================================================
-- Part 2 preflight (read-only). Run in the SQL Editor BEFORE applying
-- 20261115120100_rooms_migration_a.sql. Rows 4 to 7 are the counts to write
-- down; the part 2 checks compare with them.
-- =============================================================================
select 1 as n, 'Part 1 is applied' as check_name,
  (to_regclass('public.map_geometry_ids') is not null
   and (select count(*) from public.map_geometry_ids) = 3257)::text as result,
  'true' as expected
union all
select 2, 'Rooms migration A not applied yet',
  ((select count(*) from information_schema.columns
    where table_schema = 'public' and table_name = 'rooms' and column_name in ('region_id', 'retired_at')) = 0
   and to_regclass('public.room_migration_traced') is null)::text,
  'true'
union all
select 3, 'No floor 3 yet', (select count(*) from public.floors where name = '3')::text, '0'
union all
select 4, 'WRITE DOWN: rooms', (select count(*) from public.rooms)::text, '(your number)'
union all
select 5, 'WRITE DOWN: reports with a room',
  (select count(*) from public.reports where room_id is not null)::text, '(your number)'
union all
select 6, 'WRITE DOWN: venues with a room',
  (select count(*) from public.venues where room_id is not null)::text, '(your number)'
union all
select 7, 'WRITE DOWN: volunteer events with a room',
  (select count(*) from public.volunteer_events where room_id is not null)::text, '(your number)'
union all
select 8, 'Placeholder codes the mapping expects that are missing',
  coalesce((select string_agg(wanted.code_wanted, ', ' order by wanted.code_wanted)
            from unnest(array['G.01','G.02','G.03','G.04','G.05','G.06','G.07','G.08',
                              '1.01','1.02','1.03','1.04','2.01','2.02','2.03']) as wanted(code_wanted)
            where not exists (select 1 from public.rooms r where r.code = wanted.code_wanted)), 'none'),
  'none'
order by n;
