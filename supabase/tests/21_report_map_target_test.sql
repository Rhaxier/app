-- Fix-it reports about a lift, staircase or door
-- (20261116120000_report_map_target.sql). A report can name its target, the
-- target must exist on the map, a report never puts anything out of order
-- by itself, and only the right staff can mark the target out of order.
-- The lift here is a test fixture; the rollback removes it.
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

-- A lift to report about (saved as an admin, the only way to add one).
select pg_temp.act_as('admin.plain');
select public.map_save_connectors($json$
  [{"id": "f2000000-0000-4000-8000-000000000001", "type": "lift", "name": "Test lift (fixture)",
    "floors": ["G", "1"], "positions": {"G": {"x": 1569, "y": 1169}, "1": {"x": 1569, "y": 1169}}}]
$json$);

-- ---------------------------------------------------------------------------
-- Reporting
-- ---------------------------------------------------------------------------
select pg_temp.act_as('student.g8.a');
select lives_ok(
  $$ insert into public.reports (room_id, category, description, map_target_kind, map_target_id)
     values ((select id from public.rooms where code = 'G.04'), 'electrical', 'Lift button dead (sample)',
             'connector', 'f2000000-0000-4000-8000-000000000001') $$,
  'A student can say which lift a report is about'
);
select is(
  (select map_target_name from public.report_feed() where description = 'Lift button dead (sample)'),
  'Test lift (fixture)',
  'The reporter sees what it is about, with the lift''s name'
);
select pg_temp.act_as_owner();
select is(
  (select available from public.map_connectors where id = 'f2000000-0000-4000-8000-000000000001'),
  true,
  'Reporting a lift does not put it out of order'
);

select pg_temp.act_as('student.g8.a');
select throws_ok(
  $$ insert into public.reports (room_id, category, description, map_target_kind, map_target_id)
     values ((select id from public.rooms where code = 'G.04'), 'other', 'x',
             'connector', 'f2000000-0000-4000-8000-0000000000ff') $$,
  'P0001', 'That lift or staircase isn''t on the map any more.',
  'A lift that does not exist is refused'
);
select throws_ok(
  $$ insert into public.reports (room_id, category, description, map_target_kind, map_target_id)
     values ((select id from public.rooms where code = 'G.04'), 'other', 'x', 'door', 'G-D999') $$,
  'P0001', '"G-D999" is not a door on the map.',
  'A door that does not exist is refused'
);
select lives_ok(
  $$ insert into public.reports (room_id, category, description, map_target_kind, map_target_id)
     values ((select id from public.rooms where code = 'G.04'), 'other', 'Door stuck (sample)', 'door', 'G-D089') $$,
  'A real door is accepted'
);
select throws_ok(
  $$ insert into public.reports (room_id, category, description, map_target_kind)
     values ((select id from public.rooms where code = 'G.04'), 'other', 'x', 'door') $$,
  '23514', null,
  'Half a target (a kind without an id) is refused'
);
-- Reporters can't update their reports at all (RLS hides the row), so the
-- target stays as it was.
select lives_ok(
  $$ update public.reports set map_target_kind = null, map_target_id = null
     where description = 'Door stuck (sample)' $$,
  'A reporter''s attempt to clear the target ...'
);
select is(
  (select map_target_id from public.report_feed() where description = 'Door stuck (sample)'),
  'G-D089',
  '... changes nothing'
);

-- ---------------------------------------------------------------------------
-- Staff see it, and only the right staff mark it out of order
-- ---------------------------------------------------------------------------
select pg_temp.act_as('teacher.c');
select is(
  (select map_target_kind::text || ':' || map_target_id from public.report_feed()
   where description = 'Door stuck (sample)'),
  'door:G-D089',
  'Staff see what a report is about'
);
select throws_ok(
  $$ select public.map_set_available('connector', 'f2000000-0000-4000-8000-000000000001', false) $$,
  '42501', null,
  'A teacher who doesn''t handle fix-it reports can''t mark the lift out of order'
);
select pg_temp.act_as('admin.facilities');
select lives_ok(
  $$ select public.map_set_available('connector', 'f2000000-0000-4000-8000-000000000001', false) $$,
  'The facilities team marks the lift out of order from the report'
);
select lives_ok(
  $$ select public.map_set_available('door', 'G-D089', false) $$,
  '... and the door'
);
select pg_temp.act_as_owner();
select is(
  (select (select available from public.map_connectors where id = 'f2000000-0000-4000-8000-000000000001')::text
          || ',' ||
          (select available from public.map_overrides where kind = 'door' and target_id = 'G-D089')::text),
  'false,false',
  'Both are now out of order'
);

select * from finish();
rollback;
