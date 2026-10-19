-- Announcements. Covers required test 3:
--   a teacher can't post a school-wide or pinned announcement; an admin can.
begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

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
-- Required test 3: who may post what
-- ---------------------------------------------------------------------------
select pg_temp.act_as('teacher.b');

select throws_ok(
  $$ insert into public.announcements (title, audience) values ('Whole school (sample)', 'school') $$,
  '42501', null,
  'A teacher cannot post school-wide'
);

select throws_ok(
  $$ insert into public.announcements (title, audience, grades, pinned)
     values ('Pinned (sample)', 'grades', '{8}', true) $$,
  '42501', null,
  'A teacher cannot pin'
);

select lives_ok(
  $$ insert into public.announcements (title, audience, grades)
     values ('Grade 8 only (sample)', 'grades', '{8}') $$,
  'A teacher can post to grades'
);

select throws_ok(
  $$ update public.announcements set pinned = true where title = 'Grade 8 only (sample)' $$,
  '42501', null,
  'A teacher cannot pin their post by editing it'
);

select pg_temp.act_as('admin.plain');

select lives_ok(
  $$ insert into public.announcements (title, audience, pinned)
     values ('Pinned for everyone (sample)', 'school', true) $$,
  'An admin can post school-wide and pin'
);

select pg_temp.act_as('student.g8.a');

select throws_ok(
  $$ insert into public.announcements (title, audience, grades) values ('Hi (sample)', 'grades', '{8}') $$,
  '42501', null,
  'A student cannot post'
);

-- ---------------------------------------------------------------------------
-- Who reads what
-- ---------------------------------------------------------------------------
select is(
  (select count(*)::int from public.announcements where title = 'Grade 8 only (sample)'),
  1,
  'A grade 8 student sees a grade 8 announcement'
);

select pg_temp.act_as('student.g10.a');

select is(
  (select count(*)::int from public.announcements where title = 'Grade 8 only (sample)'),
  0,
  'A grade 10 student does not'
);

-- ---------------------------------------------------------------------------
-- Editing: own posts for teachers, any post for admins
-- ---------------------------------------------------------------------------
select pg_temp.act_as('teacher.c');
update public.announcements set title = 'Hijacked' where title = 'Grade 8 only (sample)';

select pg_temp.act_as('admin.plain');
update public.announcements set body = 'Edited by an admin' where title = 'Grade 8 only (sample)';

select pg_temp.act_as_owner();

select is(
  (select title || ' / ' || body from public.announcements where author_id = pg_temp.uid('teacher.b') and title like 'Grade 8 only%'),
  'Grade 8 only (sample) / Edited by an admin',
  'Another teacher cannot edit it; an admin can'
);

-- ---------------------------------------------------------------------------
-- Notifications: pinned = everyone, targeted = that grade's students
-- ---------------------------------------------------------------------------
select is(
  (select count(*)::int from public.notifications where title = 'Pinned for everyone (sample)'),
  (select count(*)::int - 1 from public.profiles),
  'A pinned announcement notifies everyone except its author'
);

select is(
  (select array_agg(p.email order by p.email)::text from public.notifications n
   join public.profiles p on p.id = n.recipient_id
   where n.title = 'Grade 8 only (sample)'),
  '{student.g8.a@dev.local,student.g8.b@dev.local}',
  'A grade announcement notifies only students in that grade'
);

select is(
  (select count(*)::int from public.notifications where title = 'Library opening hours (sample)'),
  0,
  'An ordinary school-wide announcement notifies nobody (no spam)'
);

select * from finish();
rollback;
