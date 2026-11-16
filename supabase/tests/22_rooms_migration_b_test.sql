-- Rooms migration step B, the release (20261116130000_rooms_migration_b.sql):
-- room_migration_b_apply() and room_migration_b_undo().
--
-- The sample data is first topped up to the school's counts on the day of
-- the backup (12 reports, 4 venues, 3 volunteer events with a room), with
-- made-up reports. Then: apply keeps every count, puts every row on its
-- traced room, retires (never deletes) the 15 placeholders, moves the floors
-- and switches the app over; a second apply changes nothing; undo puts every
-- row, placeholder and floor back exactly. Everything is rolled back after.
begin;
create extension if not exists pgtap with schema extensions;
select plan(25);

create function pg_temp.act_as(p_who text) returns void language plpgsql as $$
declare
  v_id uuid;
begin
  reset role;
  select id into strict v_id from auth.users where email = p_who || '@dev.local';
  perform set_config('request.jwt.claims', json_build_object('sub', v_id, 'role', 'authenticated')::text, true);
  set local role authenticated;
end;
$$;

create function pg_temp.act_as_owner() returns void language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claims', '', true);
end;
$$;

grant usage on schema extensions to authenticated;
grant execute on all functions in schema extensions to authenticated;
grant execute on function pg_temp.act_as(text), pg_temp.act_as_owner() to authenticated;

-- ---------------------------------------------------------------------------
-- Sample data at the school's counts: 7 more reports, on placeholder rooms.
-- ---------------------------------------------------------------------------
select pg_temp.act_as('student.g10.b');
insert into public.reports (room_id, category, description)
select (select id from public.rooms where code = c), 'other', 'Top-up report ' || c || ' (sample)'
from unnest(array['G.01', 'G.03', 'G.06', 'G.08', '1.02', '1.04', '2.02']) as c;
select pg_temp.act_as_owner();

create temporary table counts as
select
  (select count(*) from public.reports where room_id is not null) as reports,
  (select count(*) from public.venues where room_id is not null) as venues,
  (select count(*) from public.volunteer_events where room_id is not null) as events;

-- Where everything is before the release, to compare after the undo.
create temporary table before_rows as
select 'reports' as t, id, room_id, floor_id, x, y from public.reports
union all select 'venues', id, room_id, null, null, null from public.venues
union all select 'volunteer_events', id, room_id, null, null, null from public.volunteer_events;
create temporary table before_floors as select id, image_path, width, height from public.floors;

select is(
  (select row(reports, venues, events)::text from pg_temp.counts),
  row(12, 4, 3)::text,
  'Before: 12 reports, 4 venues and 3 volunteer events have a room (the school''s counts)'
);
select is((select map_indoor_live from public.app_settings), false, 'Before: the indoor map is off');

-- ---------------------------------------------------------------------------
-- Nobody but the database owner can run it.
-- ---------------------------------------------------------------------------
select pg_temp.act_as('admin.plain');
select throws_ok($$ select public.room_migration_b_apply() $$, '42501', null, 'Not even an admin can run the release from the app');
select throws_ok($$ select public.room_migration_b_undo() $$, '42501', null, '... or the undo');
select pg_temp.act_as_owner();

-- ---------------------------------------------------------------------------
-- A placeholder in use without a traced room stops everything.
-- ---------------------------------------------------------------------------
update public.room_migration_map set new_region_id = 'G-R999' where old_code = 'G.05';
update public.room_migration_map set new_room_id = null where old_code = 'G.05';
select throws_like(
  $$ select public.room_migration_b_apply() $$,
  'These placeholder rooms are in use but have no traced room to move to: G.05.%',
  'A used placeholder with nowhere to go stops the release'
);
select is(
  (select count(*)::int from public.rooms where retired_at is not null), 0,
  '... and nothing was changed'
);
update public.room_migration_map
set new_region_id = 'G-R023', new_room_id = (select id from public.rooms where region_id = 'G-R023')
where old_code = 'G.05';

-- ---------------------------------------------------------------------------
-- The release.
-- ---------------------------------------------------------------------------
select is(
  public.room_migration_b_apply(),
  '{"events_moved": 3, "venues_moved": 4, "reports_moved": 12, "placeholders_retired": 15}'::jsonb,
  'Apply moves 12 reports, 4 venues and 3 events and retires 15 placeholders'
);
select is(
  (select row(
     (select count(*) from public.reports where room_id is not null),
     (select count(*) from public.venues where room_id is not null),
     (select count(*) from public.volunteer_events where room_id is not null))::text),
  (select row(reports, venues, events)::text from pg_temp.counts),
  'Nothing lost its room: the counts are the same'
);
select is(
  (select count(*)::int from public.reports r join public.rooms o on o.id = r.room_id where o.retired_at is not null)
  + (select count(*)::int from public.venues v join public.rooms o on o.id = v.room_id where o.retired_at is not null)
  + (select count(*)::int from public.volunteer_events e join public.rooms o on o.id = e.room_id where o.retired_at is not null),
  0, 'No report, venue or event is left on a retired room'
);
select is(
  (select count(*)::int from pg_temp.before_rows b
   join public.room_migration_map m on m.old_room_id = b.room_id
   left join public.reports r on b.t = 'reports' and r.id = b.id
   left join public.venues v on b.t = 'venues' and v.id = b.id
   left join public.volunteer_events e on b.t = 'volunteer_events' and e.id = b.id
   where coalesce(r.room_id, v.room_id, e.room_id) is distinct from m.new_room_id),
  0, 'Every moved row is on the traced room the mapping names'
);
select is(
  (select count(*)::int from public.reports r join public.rooms n on n.id = r.room_id
   where n.region_id is not null and (r.floor_id, r.x, r.y) is distinct from (n.floor_id, n.x, n.y)),
  0, 'Each moved report has its new room''s floor and pin position'
);
select is(
  (select count(*)::int from public.rooms where region_id is null and retired_at is not null), 15,
  'The 15 placeholders are retired and still there'
);
select is(
  (select count(*)::int from public.floors where image_path is null and width = 3448 and height = 2551),
  (select count(*)::int from public.floors),
  'Every floor is in the traced map''s coordinates'
);
select is((select map_indoor_live from public.app_settings), true, 'The indoor map is on');
select is(
  (select count(*)::int from public.open_reports_in_room((select id from public.rooms where region_id = 'G-R030'))),
  (select count(*)::int from public.reports where room_id = (select id from public.rooms where region_id = 'G-R030')
   and status in ('open', 'acknowledged', 'in_progress')),
  'The "me too" check finds the moved reports in their new room'
);

-- Again: nothing more to do.
select is(
  public.room_migration_b_apply(),
  '{"events_moved": 0, "venues_moved": 0, "reports_moved": 0, "placeholders_retired": 0}'::jsonb,
  'A second apply changes nothing'
);

-- ---------------------------------------------------------------------------
-- Room names follow the active term once live.
-- ---------------------------------------------------------------------------
select pg_temp.act_as('admin.plain');
create temporary table term (id uuid);
grant all on pg_temp.term to authenticated;
insert into pg_temp.term select public.map_create_preset('Term sync test', null);
select public.map_import_assignments((select id from pg_temp.term),
  '[{"room_id": "G-R030", "name": "Grade 3 B (renamed)", "type": "classroom"}]');
select is(
  (select name from public.rooms where region_id = 'G-R030'), 'PYP3 B',
  'Renaming in a term that isn''t active leaves the room''s name'
);
select public.map_set_active_preset((select id from pg_temp.term));
select is(
  (select name from public.rooms where region_id = 'G-R030'), 'Grade 3 B (renamed)',
  'Making that term active renames the room for the report form, venues and events'
);
select public.map_save_assignments((select id from pg_temp.term),
  '[{"room_id": "G-R030", "name": "Grade 3 B", "type": "classroom"}]');
select is(
  (select name from public.rooms where region_id = 'G-R030'), 'Grade 3 B',
  'Renaming in the active term renames the room straight away'
);
select is(
  (select name from public.rooms where region_id = 'G-R031'), 'PYP3 A',
  'A room the term leaves unnamed keeps its last name'
);
select pg_temp.act_as_owner();

-- ---------------------------------------------------------------------------
-- The undo.
-- ---------------------------------------------------------------------------
select is(
  public.room_migration_b_undo(),
  '{"events_restored": 3, "venues_restored": 4, "reports_restored": 12, "placeholders_restored": 15}'::jsonb,
  'Undo puts back 12 reports, 4 venues, 3 events and 15 placeholders'
);
select is(
  (select count(*)::int from pg_temp.before_rows b
   left join public.reports r on b.t = 'reports' and r.id = b.id
   left join public.venues v on b.t = 'venues' and v.id = b.id
   left join public.volunteer_events e on b.t = 'volunteer_events' and e.id = b.id
   where (coalesce(r.room_id, v.room_id, e.room_id), r.floor_id, r.x, r.y)
         is distinct from (b.room_id, b.floor_id, b.x, b.y)),
  0, 'Every report, venue and event is exactly where it was (room, floor, pin)'
);
select is(
  (select count(*)::int from pg_temp.before_floors b join public.floors f on f.id = b.id
   where (f.image_path, f.width, f.height) is distinct from (b.image_path, b.width, b.height)),
  0, 'Every floor has its old image and size back'
);
select is(
  (select row((select map_indoor_live from public.app_settings),
              (select count(*) from public.rooms where retired_at is not null))::text),
  row(false, 0)::text,
  'The indoor map is off and no room is retired'
);
select is(
  public.room_migration_b_undo(),
  '{"events_restored": 0, "venues_restored": 0, "reports_restored": 0, "placeholders_restored": 0}'::jsonb,
  'Running the undo again changes nothing'
);

select * from finish();
rollback;
