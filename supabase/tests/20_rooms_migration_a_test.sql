-- Rooms migration step A (20261115120100_rooms_migration_a.sql), MAP_NOTES.md
-- "Safe order of steps", step 2: the counts match, every mapped room exists,
-- nothing that was there before changed, and the helper tables are private.
begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

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

-- What a backup taken before the migration would record (MAP_NOTES step 0).
create temporary table counts as
select
  (select count(*) from public.reports where room_id is not null) as reports,
  (select count(*) from public.venues where room_id is not null) as venues,
  (select count(*) from public.volunteer_events where room_id is not null) as events;

select has_column('public', 'rooms', 'region_id', 'rooms has region_id');
select has_column('public', 'rooms', 'retired_at', 'rooms has retired_at');
select is(
  (select image_path from public.floors where name = '3'), null,
  'Floor 3 exists, with no image (the new map draws it)'
);
select is(
  (select count(*) from public.rooms where region_id is not null),
  (select count(*) from public.room_migration_traced),
  'Every named traced room and place has a rooms row'
);
select is(
  (select count(*)::int from public.room_migration_map where old_room_id is not null and new_room_id is not null),
  15, 'All 15 placeholder rooms are mapped to a traced room that exists'
);
select is(
  (select count(*)::int from public.rooms where region_id is null and retired_at is null),
  15, 'The 15 placeholders are still there and not retired'
);
select is(
  (select count(*) from public.room_migration_backup where table_name = 'reports'),
  (select reports from pg_temp.counts), 'Every report with a room is backed up'
);
select is(
  (select count(*) from public.room_migration_backup where table_name = 'venues'),
  (select venues from pg_temp.counts), 'Every venue with a room is backed up'
);
select is(
  (select count(*) from public.room_migration_backup where table_name = 'volunteer_events'),
  (select events from pg_temp.counts), 'Every volunteer event with a room is backed up'
);
select is(
  (select count(*)::int from public.reports r
   join public.rooms o on o.id = r.room_id
   where o.region_id is not null),
  0, 'No report was moved to a traced room (that happens in step B)'
);

-- Running the fill again adds nothing.
select public.room_migration_a_fill();
select is(
  (select count(*) from public.rooms where region_id is not null),
  (select count(*) from public.room_migration_traced),
  'Running the fill again adds no duplicate rooms'
);

-- Privacy: the backup holds which room each report was in.
select pg_temp.act_as('student.g8.a');
select is((select count(*)::int from public.room_migration_backup), 0, 'A student can''t read the backup');
select throws_ok(
  $$ select public.room_migration_a_fill() $$, '42501', null, 'Nobody can run the fill from the app'
);
select pg_temp.act_as('admin.plain');
select ok((select count(*) from public.room_migration_backup) > 0, 'An admin can read the backup');

select * from finish();
rollback;
