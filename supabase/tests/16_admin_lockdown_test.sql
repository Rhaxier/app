-- New test 1: a non-admin can't write to any new admin table or call any
-- admin function.
--
-- The functions are found in the catalogue, not listed by hand: every function
-- named admin_* is called as a teacher and as a student, with every argument
-- null, and must refuse with 42501 (permission denied) before doing anything.
-- So a new admin function added later is checked automatically.
-- The tables: no non-admin row update or delete gets through, and inserts are
-- refused (more insert checks per table are in tests 09 to 15).
begin;
create extension if not exists pgtap with schema extensions;

-- The admin functions, with a call that passes null for each argument.
create temporary table admin_calls as
select
  p.proname as name,
  format('select * from public.%I(%s)', p.proname, coalesce((
    select string_agg('null::' || format_type(t.type, null), ', ' order by t.n)
    from unnest(p.proargtypes::oid[]) with ordinality as t(type, n)
  ), '')) as call
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname like 'admin\_%';

-- The admin-only tables added by the admin dashboard.
create temporary table admin_tables (name text);
insert into admin_tables values
  ('grades'), ('sections'), ('classes'), ('class_teachers'), ('class_students'), ('roster'),
  ('periods'), ('terms'), ('holidays'), ('venue_blackouts'), ('skill_tags'),
  ('volunteer_categories'), ('supw_targets'), ('report_categories'), ('staff_email_prefs'),
  ('emergency_broadcasts'), ('feature_flags');

grant select on pg_temp.admin_calls, pg_temp.admin_tables to authenticated;

select plan(
  1 + 2 * (select count(*)::int from pg_temp.admin_calls) + 2 * (select count(*)::int from pg_temp.admin_tables) + 4
);


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

select cmp_ok((select count(*)::int from pg_temp.admin_calls), '>=', 20, 'The sweep found the admin functions');

-- ---------------------------------------------------------------------------
-- Every admin function refuses a teacher and a student
-- ---------------------------------------------------------------------------
select pg_temp.act_as('teacher.a');
select throws_ok(call, '42501', null, name || '() refuses a teacher') from pg_temp.admin_calls order by name;

select pg_temp.act_as('student.g10.a');
select throws_ok(call, '42501', null, name || '() refuses a student') from pg_temp.admin_calls order by name;

-- ---------------------------------------------------------------------------
-- No non-admin changes any admin table. RLS doesn't raise on update or
-- delete: it simply finds no rows it may touch, so count what changed.
-- ---------------------------------------------------------------------------
create function pg_temp.rows_changed(p_sql text) returns int language plpgsql as $$
declare
  v_count int;
begin
  execute p_sql;
  get diagnostics v_count = row_count;
  return v_count;
exception when insufficient_privilege then
  return 0; -- refused outright (no update or delete permission at all): nothing changed
end;
$$;
grant execute on function pg_temp.rows_changed(text) to authenticated;

select pg_temp.act_as('teacher.a');
select is(pg_temp.rows_changed(format('update public.%I set created_at = created_at', name)), 0,
  'A teacher updates no rows in ' || name)
from pg_temp.admin_tables order by name;
select is(pg_temp.rows_changed(format('delete from public.%I', name)), 0,
  'A teacher deletes no rows from ' || name)
from pg_temp.admin_tables order by name;

-- Inserts not already covered in tests 09 to 15.
select throws_ok(
  $$ insert into public.class_teachers (class_id, teacher_id) select id, auth.uid() from public.classes limit 1 $$,
  '42501', null, 'A teacher cannot put themselves on a class');
select pg_temp.act_as('student.g10.b');
select throws_ok(
  $$ insert into public.class_students (class_id, student_id) select id, auth.uid() from public.classes limit 1 $$,
  '42501', null, 'A student cannot join a class list');
select throws_ok(
  $$ insert into public.emergency_broadcasts (title, message, recipients) values ('x', 'x', 1) $$,
  '42501', null, 'Nobody writes the broadcast record directly');
select throws_ok(
  $$ insert into public.feature_flags (feature) values ('map') $$,
  '42501', null, 'A student cannot add a feature switch');

select * from finish();
rollback;
