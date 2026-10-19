-- Projects with teachers. Covers required test 2:
--   a student can't read another student's projects; a teacher reads only
--   projects shared with them.
begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

-- ---------------------------------------------------------------------------
-- Test helpers (temporary: they vanish when this transaction ends)
-- ---------------------------------------------------------------------------
-- act_as('student.g10.a'): run what follows as that seeded user, the same way
-- the app's requests arrive (role `authenticated`, user id in the JWT claims).
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

-- act_as_owner(): back to the database owner, who skips RLS, to check results.
create function pg_temp.act_as_owner() returns void language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claims', '', true);
end;
$$;

-- uid('teacher.a'): a seeded user's id, whoever we're acting as.
create function pg_temp.uid(p_who text) returns uuid language sql stable security definer as $$
  select id from auth.users where email = p_who || '@dev.local';
$$;

-- New functions aren't runnable by everyone (see the lockdown migration), so
-- let the signed-in role use pgTAP and these helpers. Undone by the rollback.
grant usage on schema extensions to authenticated;
grant execute on all functions in schema extensions to authenticated;
grant execute on function pg_temp.act_as(text), pg_temp.act_as_owner(), pg_temp.uid(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Required test 2: who reads which projects
-- ---------------------------------------------------------------------------
select pg_temp.act_as('student.g12.a');

select is(
  (select count(*)::int from public.projects where owner_id = pg_temp.uid('student.g10.a')),
  0,
  'A student cannot read another student''s projects'
);

select pg_temp.act_as('student.g10.a');

select is(
  (select count(*)::int from public.projects),
  2,
  'A student reads their own projects'
);

select pg_temp.act_as('teacher.a');

select results_eq(
  $$ select title from public.projects $$,
  $$ values ('Solar-powered bus stop model (sample)') $$,
  'A teacher reads only the project shared with them'
);

select pg_temp.act_as('teacher.c');

select is(
  (select count(*)::int from public.projects),
  0,
  'A teacher with nothing shared reads nothing'
);

select pg_temp.act_as('admin.plain');

select is(
  (select count(*)::int from public.projects),
  3,
  'An admin reads all projects'
);

-- ---------------------------------------------------------------------------
-- Teachers: status and feedback only
-- ---------------------------------------------------------------------------
select pg_temp.act_as('teacher.a');

select lives_ok(
  $$ update public.projects set status = 'complete' where title = 'Solar-powered bus stop model (sample)' $$,
  'A shared teacher can set the status'
);

select throws_ok(
  $$ update public.projects set title = 'Renamed' where title = 'Solar-powered bus stop model (sample)' $$,
  'P0001', 'Only the owner can edit this project.',
  'A shared teacher cannot edit the project itself'
);

-- Remember the project's id as the owner, so Teacher C can aim at it directly.
select pg_temp.act_as_owner();
select set_config(
  'test.solar_id',
  (select id::text from public.projects where title = 'Solar-powered bus stop model (sample)'),
  true
);

select pg_temp.act_as('teacher.c');

select throws_ok(
  $$ insert into public.project_feedback (project_id, body)
     values (current_setting('test.solar_id')::uuid, 'Nice') $$,
  '42501', null,
  'A teacher it is not shared with cannot give feedback'
);

select pg_temp.act_as('student.g10.a');

select throws_ok(
  $$ insert into public.project_shares (project_id, teacher_id)
     select id, pg_temp.uid('student.g12.a') from public.projects where title = 'Traffic flow simulator (sample)' $$,
  'P0001', 'Projects can only be shared with teachers.',
  'Projects can only be shared with staff'
);

select lives_ok(
  $$ insert into public.project_shares (project_id, teacher_id)
     select id, pg_temp.uid('teacher.c') from public.projects where title = 'Traffic flow simulator (sample)' $$,
  'The owner shares with a teacher'
);

select pg_temp.act_as_owner();

select ok(
  exists (
    select 1 from public.notifications
    where recipient_id = pg_temp.uid('teacher.c') and type = 'project_shared'
  ) and (select status::text from public.projects where title = 'Traffic flow simulator (sample)') = 'shared',
  'Sharing notifies the teacher and moves a draft to shared'
);

select * from finish();
rollback;
