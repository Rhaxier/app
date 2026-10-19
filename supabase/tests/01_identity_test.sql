-- Identity and roles. Covers required test 1:
--   a student can't change their own role; an admin can, and audit_log records it.
-- Run with `npm run db:test`. Everything happens inside one transaction that
-- is rolled back at the end, so the seed data is left as it was.
begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

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
-- Required test 1: roles
-- ---------------------------------------------------------------------------
select pg_temp.act_as('student.g10.a');

select throws_ok(
  $$ update public.profiles set role = 'admin' where id = auth.uid() $$,
  '42501', null,
  'A student cannot update their own role'
);

select throws_ok(
  $$ select public.admin_set_role(auth.uid(), 'admin') $$,
  '42501', 'Only admins can change roles.',
  'A student cannot use the admin role function'
);

select throws_ok(
  $$ select email from public.profiles $$,
  '42501', null,
  'Nobody reads emails straight from profiles'
);

select ok(
  (select count(*) from public.profiles) >= 12,
  'Signed-in users can read names and roles'
);

select is(
  (select count(*)::int from public.audit_log),
  0,
  'A student cannot read the audit log'
);

-- A teacher passes the "staff only" trigger, so this shows RLS doing the refusing.
select pg_temp.act_as('teacher.b');

select throws_ok(
  $$ insert into public.responsibilities (user_id, kind) values (auth.uid(), 'it') $$,
  '42501', null,
  'A teacher cannot give themselves a responsibility (only admins assign them)'
);

select pg_temp.act_as('admin.plain');

select lives_ok(
  $$ select public.admin_set_role(pg_temp.uid('student.g10.b'), 'teacher') $$,
  'An admin can change someone''s role'
);

select pg_temp.act_as_owner();

select is(
  (select role::text from public.profiles where id = pg_temp.uid('student.g10.b')),
  'teacher',
  'The role really changed'
);

select ok(
  exists (
    select 1 from public.audit_log
    where action = 'role_changed'
      and row_id = pg_temp.uid('student.g10.b')::text
      and actor_id = pg_temp.uid('admin.plain')
      and details = '{"from": "student", "to": "teacher"}'::jsonb
  ),
  'An audit_log row records who changed the role, and from what to what'
);

select throws_ok(
  $$ delete from public.audit_log $$,
  'P0001', 'The audit log can''t be changed or deleted.',
  'Even the database owner cannot delete audit history'
);

-- ---------------------------------------------------------------------------
-- Sign-up rules (Q3, Q5)
-- ---------------------------------------------------------------------------
update public.app_settings set school_email_domain = 'school.example';

select throws_ok(
  $$ insert into auth.users (id, email, raw_user_meta_data)
     values ('d0000000-0000-4000-8000-000000000001', 'outsider@gmail.com', '{}') $$,
  'P0001', 'Please sign in with your school email account.',
  'Sign-ups from outside the school domain are refused'
);

insert into auth.users (id, email, raw_user_meta_data)
values ('d0000000-0000-4000-8000-000000000002', 'new.student@students.school.example', '{"full_name": "New Student", "grade": 9}');

select is(
  (select role::text || '/' || coalesce(grade::text, 'no grade') from public.profiles where id = 'd0000000-0000-4000-8000-000000000002'),
  'student/no grade',
  'School accounts (and subdomains) start as students; sign-in metadata cannot set a grade'
);

insert into public.staff_emails (email) values ('New.Teacher@school.example');
insert into auth.users (id, email, raw_user_meta_data)
values ('d0000000-0000-4000-8000-000000000003', 'new.teacher@school.example', '{"full_name": "New Teacher"}');

select is(
  (select role::text from public.profiles where id = 'd0000000-0000-4000-8000-000000000003'),
  'teacher',
  'Emails on the staff list become teachers at first sign-in (case-insensitive)'
);

update public.app_settings set staff_email_pattern = '^staff\.';
insert into auth.users (id, email, raw_user_meta_data)
values ('d0000000-0000-4000-8000-000000000004', 'staff.someone@school.example', '{}');

select is(
  (select role::text from public.profiles where id = 'd0000000-0000-4000-8000-000000000004'),
  'teacher',
  'Emails matching staff_email_pattern become teachers'
);

update public.app_settings set allow_dev_accounts = false;

select throws_ok(
  $$ insert into auth.users (id, email, raw_user_meta_data)
     values ('d0000000-0000-4000-8000-000000000005', 'another@dev.local', '{}') $$,
  'P0001', 'Dev accounts are switched off (app_settings.allow_dev_accounts).',
  'Dev accounts stop working once allow_dev_accounts is off'
);

select pg_temp.act_as('admin.plain');
select public.admin_set_role(pg_temp.uid('admin.facilities'), 'teacher');
select public.admin_set_role(pg_temp.uid('admin.venues'), 'teacher');

select throws_ok(
  $$ select public.admin_set_role(pg_temp.uid('admin.plain'), 'student') $$,
  'P0001', 'You can''t remove the last admin.',
  'The last admin cannot demote themselves'
);

select * from finish();
rollback;
