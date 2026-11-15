-- Indoor navigation data: stairs and lifts, presets (terms), room names and
-- the out-of-order flags (migration 20261115120000_map_nav.sql).
--
-- Checks that everyone reads, that nobody writes to the tables directly, that
-- only admins call the editing functions, that the out-of-order switch is open
-- to admins and the staff who handle fix-it reports only, and that the
-- functions refuse bad data with the messages the admin screens show.
-- Stairs and lifts made here are test fixtures; the rollback removes them.
begin;
create extension if not exists pgtap with schema extensions;
select plan(61);

-- ---------------------------------------------------------------------------
-- Test helpers (same as in the other test files; gone after the rollback)
-- ---------------------------------------------------------------------------
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

create function pg_temp.uid(p_who text) returns uuid language sql stable security definer as $$
  select id from auth.users where email = p_who || '@dev.local';
$$;

grant usage on schema extensions to authenticated;
grant execute on all functions in schema extensions to authenticated;
grant execute on function pg_temp.act_as(text), pg_temp.act_as_owner(), pg_temp.uid(text) to authenticated;

-- A teacher who handles IT fix-it reports (the seed has only admins with it).
insert into public.responsibilities (user_id, kind) values (pg_temp.uid('teacher.b'), 'it');

-- One lift on G and 1, used below. Ids are fixed so later steps can find it.
create temporary table fixture (body jsonb);
insert into fixture values ($json$
  [{"id": "f1000000-0000-4000-8000-000000000001", "type": "lift", "name": "Test lift (fixture)",
    "floors": ["G", "1"], "positions": {"G": {"x": 1569, "y": 1190}, "1": {"x": 1569, "y": 1190}}}]
$json$);
grant select on pg_temp.fixture to authenticated;

-- ---------------------------------------------------------------------------
-- Reading: every signed-in user reads the map tables.
-- ---------------------------------------------------------------------------
select pg_temp.act_as('student.g8.a');
select ok((select count(*) from public.map_geometry_ids) > 3000, 'A student reads the map ids');
select ok(
  (select count(*) from public.map_geometry_ids where destination) =
  (select count(*) from public.map_geometry_ids where kind in ('room', 'place'))
    + (select count(*) from public.map_geometry_ids where kind = 'door' and destination),
  'Destinations are rooms, places and some doors (the entrances), never edges'
);
select lives_ok($$ select * from public.map_connectors $$, 'A student reads stairs and lifts');
select lives_ok($$ select * from public.map_presets $$, 'A student reads the terms');
select lives_ok($$ select * from public.map_assignments $$, 'A student reads room names');
select lives_ok($$ select * from public.map_overrides $$, 'A student reads the map flags');

-- ---------------------------------------------------------------------------
-- Nobody writes to the tables directly, not even an admin.
-- ---------------------------------------------------------------------------
select throws_ok(
  $$ insert into public.map_connectors (type, name, floors, accessible) values ('stairs', 'X', '{G}', false) $$,
  '42501', null, 'A student can''t add stairs directly'
);
select pg_temp.act_as('admin.plain');
select throws_ok(
  $$ insert into public.map_connectors (type, name, floors, accessible) values ('stairs', 'X', '{G}', false) $$,
  '42501', null, 'An admin can''t add stairs directly either (only through map_save_connectors)'
);
select throws_ok(
  $$ insert into public.map_presets (name) values ('Sneaky') $$,
  '42501', null, 'An admin can''t add a term directly'
);
select throws_ok(
  $$ update public.map_overrides set available = false $$,
  '42501', null, 'An admin can''t change flags directly'
);
select throws_ok(
  $$ select public.map_write_assignments(null, '[]', 'x') $$,
  '42501', null, 'The shared worker behind save and import can''t be called from the app'
);

-- ---------------------------------------------------------------------------
-- Stairs and lifts: only admins save the set.
-- ---------------------------------------------------------------------------
select pg_temp.act_as('student.g8.a');
select throws_ok(
  $$ select public.map_save_connectors((select body from pg_temp.fixture)) $$,
  '42501', 'Only admins can change the map.', 'A student can''t save stairs and lifts'
);
select pg_temp.act_as('teacher.a');
select throws_ok(
  $$ select public.map_save_connectors((select body from pg_temp.fixture)) $$,
  '42501', 'Only admins can change the map.', 'A teacher can''t save stairs and lifts'
);
select pg_temp.act_as('admin.plain');
select lives_ok(
  $$ select public.map_save_connectors((select body from pg_temp.fixture)) $$,
  'An admin saves a lift'
);
select is(
  (select row(type::text, floors::text, accessible, available, positions -> 'G' ->> 'x')::text
   from public.map_connectors where id = 'f1000000-0000-4000-8000-000000000001'),
  row('lift', '{1,G}', true, true, '1569')::text,
  'It is stored with its floors and positions; a lift is accessible and available by default'
);
select pg_temp.act_as_owner();
select is(
  (select actor_id from public.audit_log where action = 'map_connectors_saved' order by created_at desc limit 1),
  pg_temp.uid('admin.plain'),
  'Saving stairs and lifts is written to the audit log'
);

select pg_temp.act_as('admin.plain');
select throws_ok(
  $$ select public.map_save_connectors('[{"type": "stairs", "name": "West stairs", "floors": ["G", "1"],
       "positions": {"G": {"x": 1, "y": 2}}}]') $$,
  'P0001', 'West stairs has no position on floor 1. Place it there or untick that floor.',
  'A floor served without a position is refused'
);
select throws_ok(
  $$ select public.map_save_connectors('[{"type": "stairs", "name": "West stairs", "floors": ["G", "4"],
       "positions": {"G": {"x": 1, "y": 2}, "4": {"x": 1, "y": 2}}}]') $$,
  'P0001', 'West stairs: "4" is not a floor on the map. Use one of: 1, 2, 3, G.',
  'A floor that isn''t on the map is refused'
);
select throws_ok(
  $$ select public.map_save_connectors('[
       {"type": "stairs", "name": "West stairs", "floors": ["G"], "positions": {"G": {"x": 1, "y": 2}}},
       {"type": "stairs", "name": "west STAIRS", "floors": ["G"], "positions": {"G": {"x": 5, "y": 6}}}]') $$,
  'P0001', 'Two stairs or lifts can''t share a name: "west STAIRS".',
  'Two stairs or lifts can''t share a name, whatever the capitals'
);
select throws_ok(
  $$ select public.map_save_connectors('[{"type": "ramp", "name": "R", "floors": ["G"], "positions": {"G": {"x": 1, "y": 2}}}]') $$,
  'P0001', 'Item 1: the type must be "stairs" or "lift".',
  'Only stairs and lifts can be saved'
);
select is(
  (select count(*)::int from public.map_connectors), 1,
  'A refused save changes nothing'
);

-- Saving again: the lift keeps its id (and so its link to reports about it);
-- new stairs get an id; anything left out of the list is removed.
select lives_ok(
  $$ select public.map_save_connectors('[
       {"id": "f1000000-0000-4000-8000-000000000001", "type": "lift", "name": "Test lift (fixture)",
        "floors": ["G", "1", "2"], "positions": {"G": {"x": 1569, "y": 1190}, "1": {"x": 1569, "y": 1190},
        "2": {"x": 1570, "y": 1191}, "3": {"x": 9, "y": 9}}, "available": false},
       {"type": "stairs", "name": "Test stairs (fixture)", "floors": ["G"], "positions": {"G": {"x": 1221, "y": 978}}}]') $$,
  'An admin saves the edited set'
);
select is(
  (select row(floors::text, available, positions ? '3')::text
   from public.map_connectors where id = 'f1000000-0000-4000-8000-000000000001'),
  row('{1,2,G}', false, false)::text,
  'The lift kept its id, gained floor 2, and positions for floors it doesn''t serve are dropped'
);
select is(
  (select accessible from public.map_connectors where name = 'Test stairs (fixture)'), false,
  'Stairs are not accessible by default'
);
select lives_ok(
  $$ select public.map_save_connectors((select body from pg_temp.fixture)) $$,
  'Saving a shorter list ...'
);
select is((select count(*)::int from public.map_connectors), 1, '... removes the ones left out');

-- ---------------------------------------------------------------------------
-- Out of order: admins and staff who handle fix-it reports only.
-- ---------------------------------------------------------------------------
select pg_temp.act_as('student.g8.a');
select is(public.map_can_mark_out_of_order(), false, 'A student can''t mark things out of order');
select throws_ok(
  $$ select public.map_set_available('connector', 'f1000000-0000-4000-8000-000000000001', false) $$,
  '42501', null, 'A student''s call is refused'
);
select pg_temp.act_as('teacher.a');
select is(public.map_can_mark_out_of_order(), false,
  'A teacher whose responsibility (SUPW) no report category routes to can''t');
select throws_ok(
  $$ select public.map_set_available('connector', 'f1000000-0000-4000-8000-000000000001', false) $$,
  '42501', null, '... and their call is refused'
);
select pg_temp.act_as('teacher.b');
select is(public.map_can_mark_out_of_order(), true, 'A teacher who handles IT reports can');
select lives_ok(
  $$ select public.map_set_available('connector', 'f1000000-0000-4000-8000-000000000001', false) $$,
  'They mark the lift out of order'
);
select is(
  (select available from public.map_connectors where id = 'f1000000-0000-4000-8000-000000000001'), false,
  'The lift is now unavailable'
);
select lives_ok(
  $$ select public.map_set_available('door', 'G-D089', false) $$,
  'They close a door'
);
select is(
  (select available from public.map_overrides where kind = 'door' and target_id = 'G-D089'), false,
  'The door is stored as unavailable'
);
select throws_ok(
  $$ select public.map_set_available('door', 'G-D999', false) $$,
  'P0001', '"G-D999" is not a door on the map.', 'A door that isn''t on the map is refused'
);
select throws_ok(
  $$ select public.map_set_available('connector', 'not-an-id', true) $$,
  'P0001', 'That lift or staircase isn''t on the map any more.', 'An unknown lift is refused'
);
select throws_ok(
  $$ select public.map_save_connectors('[]') $$,
  '42501', 'Only admins can change the map.', 'They still can''t edit stairs and lifts'
);
select pg_temp.act_as('admin.plain');
select lives_ok(
  $$ select public.map_set_available('connector', 'f1000000-0000-4000-8000-000000000001', true) $$,
  'An admin with no responsibility puts the lift back in service'
);
select pg_temp.act_as_owner();
select is(
  (select array_agg(action order by created_at)::text from public.audit_log
   where action in ('map_out_of_order', 'map_back_in_service')),
  '{map_out_of_order,map_out_of_order,map_back_in_service}',
  'Every out-of-order and back-in-service change is in the audit log'
);
-- If no active report category routes to IT any more, IT staff lose the switch.
update public.report_categories set active = false where responsibility = 'it';
select pg_temp.act_as('teacher.b');
select is(public.map_can_mark_out_of_order(), false,
  'Only responsibilities that an active report category routes to count');

-- Edge tags: admins only, known tags only.
select throws_ok(
  $$ select public.map_set_edge_tags('G-E0001', '{steps}') $$,
  '42501', 'Only admins can change the map.', 'Staff can''t tag corridors'
);
select pg_temp.act_as('admin.plain');
select lives_ok($$ select public.map_set_edge_tags('G-E0001', '{steps,ramp}') $$, 'An admin tags a corridor stretch');
select throws_ok(
  $$ select public.map_set_edge_tags('G-E0001', '{lava}') $$,
  'P0001', 'Tags can only be: steps, ramp, narrow, outdoor.', 'Unknown tags are refused'
);

-- ---------------------------------------------------------------------------
-- Terms (presets) and room names.
-- ---------------------------------------------------------------------------
select pg_temp.act_as('teacher.a');
select throws_ok(
  $$ select public.map_create_preset('Term 1', null) $$,
  '42501', 'Only admins can change the map.', 'A teacher can''t create a term'
);
select pg_temp.act_as('admin.plain');
create temporary table term (name text, id uuid);
grant all on pg_temp.term to authenticated;
insert into pg_temp.term select 'Term 1', public.map_create_preset('Term 1', null);
select throws_ok(
  $$ select public.map_create_preset('term 1', null) $$,
  'P0001', 'There is already a term called "term 1".', 'Term names are unique, whatever the capitals'
);
select lives_ok(
  $$ select public.map_import_assignments((select id from pg_temp.term where name = 'Term 1'), '[
       {"room_id": "G-R008", "name": "Design Lab", "type": "lab", "row": 2},
       {"room_id": "1-R003", "name": "Art", "subject": "Art 9", "teacher": "Teacher A", "row": 3},
       {"room_id": "G-R030", "name": "", "row": 4}]') $$,
  'An admin imports room names'
);
select is(
  (select string_agg(region_id || '=' || name || '/' || type, ',' order by region_id)
   from public.map_assignments where preset_id = (select id from pg_temp.term where name = 'Term 1')),
  '1-R003=Art/other,G-R008=Design Lab/lab',
  'Rows are stored, an empty type becomes "other", and a row with no name leaves the room unnamed'
);
select throws_ok(
  $$ select public.map_import_assignments((select id from pg_temp.term where name = 'Term 1'),
       '[{"room_id": "G-R008", "name": "Lab", "row": 2}, {"room_id": "G-R999", "name": "Nowhere", "row": 14}]') $$,
  'P0001', 'Row 14: "G-R999" is not a room on the map.', 'An unknown room id is refused'
);
select throws_ok(
  $$ select public.map_import_assignments((select id from pg_temp.term where name = 'Term 1'),
       '[{"room_id": "1-R003", "name": "Art"}, {"room_id": "G-R008", "name": "art"}]') $$,
  'P0001', 'Two rooms can''t share a name: "art" is already used by 1-R003.', 'Two rooms can''t share a name'
);
select throws_ok(
  $$ select public.map_save_assignments((select id from pg_temp.term where name = 'Term 1'),
       '[{"room_id": "G-R008", "name": "Lab", "type": "labb", "row": 9}]') $$,
  'P0001',
  'Row 9: "labb" is not a room type. Use one of: classroom, lab, office, hall, library, cafeteria, toilet, prayer, store, other.',
  'An unknown room type is refused'
);
select throws_ok(
  $$ select public.map_import_assignments((select id from pg_temp.term where name = 'Term 1'),
       '[{"room_id": "G-R030", "name": "A", "row": 6}, {"room_id": "G-R030", "name": "B", "row": 20}]') $$,
  'P0001', 'Row 20: G-R030 already appears on row 6.', 'The same room twice in one file is refused'
);
select is(
  (select count(*)::int from public.map_assignments where preset_id = (select id from pg_temp.term where name = 'Term 1')),
  2, 'A refused import leaves the term as it was'
);

insert into pg_temp.term select 'Term 2', public.map_create_preset('Term 2', (select id from pg_temp.term where name = 'Term 1'));
select is(
  (select count(*)::int from public.map_assignments where preset_id = (select id from pg_temp.term where name = 'Term 2')),
  2, 'A new term can start as a copy of another'
);

-- Switching: one call, admins only; the active term can't be deleted.
select lives_ok(
  $$ select public.map_set_active_preset((select id from pg_temp.term where name = 'Term 2')) $$,
  'An admin makes Term 2 active'
);
select is(
  (select map_active_preset_id from public.app_settings),
  (select id from pg_temp.term where name = 'Term 2'),
  'Students now see Term 2'
);
select throws_ok(
  $$ select public.map_delete_preset((select id from pg_temp.term where name = 'Term 2')) $$,
  'P0001', 'You can''t delete the active term. Make another term active first.',
  'The active term can''t be deleted'
);
select pg_temp.act_as('teacher.b');
select throws_ok(
  $$ select public.map_set_active_preset(null) $$,
  '42501', 'Only admins can change the map.', 'Staff can''t switch terms'
);
select pg_temp.act_as('admin.plain');
select lives_ok(
  $$ select public.map_delete_preset((select id from pg_temp.term where name = 'Term 1')) $$,
  'A term that isn''t active can be deleted'
);
select pg_temp.act_as_owner();
select is(
  (select jsonb_array_length(details -> 'rooms') from public.audit_log
   where action = 'map_preset_deleted' order by created_at desc limit 1),
  2, 'Its room names are kept in the audit log'
);

-- Realtime: open maps hear about changes.
select is(
  (select count(*)::int from pg_publication_tables
   where pubname = 'supabase_realtime' and schemaname = 'public'
     and tablename in ('map_connectors', 'map_overrides', 'map_presets', 'map_assignments', 'app_settings')),
  5, 'Stairs, lifts, flags, terms, room names and settings are sent through Realtime'
);

select * from finish();
rollback;
