-- =============================================================================
-- Part 5 (the release) check. Read-only. Run right after
-- `select public.room_migration_b_apply();`. Every `result` must equal
-- `expected`; "your" rows compare with the preflight you wrote down.
-- =============================================================================
select 1 as n, 'The indoor map is live' as check_name,
  (select map_indoor_live from public.app_settings)::text as result, 'true' as expected
union all
select 2, 'Reports with a room',
  (select count(*) from public.reports where room_id is not null)::text, 'your preflight row 6'
union all
select 3, 'Venues with a room',
  (select count(*) from public.venues where room_id is not null)::text, 'your preflight row 7'
union all
select 4, 'Volunteer events with a room',
  (select count(*) from public.volunteer_events where room_id is not null)::text, 'your preflight row 8'
union all
select 5, 'Rows still on a retired room (must be none)',
  ((select count(*) from public.reports r join public.rooms o on o.id = r.room_id where o.retired_at is not null)
   + (select count(*) from public.venues v join public.rooms o on o.id = v.room_id where o.retired_at is not null)
   + (select count(*) from public.volunteer_events e join public.rooms o on o.id = e.room_id where o.retired_at is not null))::text,
  '0'
union all
select 6, 'Reports whose pin is not their room''s (must be none)',
  (select count(*) from public.reports r join public.rooms n on n.id = r.room_id
   where n.region_id is not null and (r.floor_id, r.x, r.y) is distinct from (n.floor_id, n.x, n.y))::text,
  '0'
union all
select 7, 'Placeholders retired and still there',
  (select count(*) from public.rooms where region_id is null and retired_at is not null)::text,
  'your preflight row 5'
union all
select 8, 'Floors moved to the traced map (no image, 3448 x 2551)',
  (select count(*) from public.floors where image_path is null and width = 3448 and height = 2551)::text,
  'your preflight row 9'
union all
select 9, 'Old floor values kept for the undo',
  (select count(*) from public.room_migration_floors_backup)::text, 'your preflight row 9'
order by n;
