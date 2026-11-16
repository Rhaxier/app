-- =============================================================================
-- Part 2 checks (read-only), after 20261115120100_rooms_migration_a.sql.
-- Every row's `result` should equal `expected`; "your ..." rows compare with
-- the numbers written down in the part 2 preflight.
-- =============================================================================
select 11 as n, 'Step A: traced rooms added' as check_name,
  (select count(*) from public.rooms where region_id is not null)::text as result, '285' as expected
union all
select 12, 'Step A: floor 3 added, without an image',
  (select count(*) from public.floors where name = '3' and image_path is null)::text, '1'
union all
select 13, 'Step A: original rooms untouched (region_id empty, not retired)',
  (select count(*) from public.rooms where region_id is null and retired_at is null)::text,
  'your rooms number'
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
  'your reports-with-a-room number'
union all
select 17, 'Step A: venues backed up',
  (select count(*) from public.room_migration_backup where table_name = 'venues')::text,
  'your venues-with-a-room number'
union all
select 18, 'Step A: volunteer events backed up',
  (select count(*) from public.room_migration_backup where table_name = 'volunteer_events')::text,
  'your events-with-a-room number'
union all
select 19, 'Step A: reports, venues, events moved to a traced room (must be none before step B)',
  ((select count(*) from public.reports r join public.rooms o on o.id = r.room_id where o.region_id is not null)
   + (select count(*) from public.venues v join public.rooms o on o.id = v.room_id where o.region_id is not null)
   + (select count(*) from public.volunteer_events e join public.rooms o on o.id = e.room_id where o.region_id is not null))::text,
  '0'
order by n;
