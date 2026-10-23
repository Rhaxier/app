-- People and grades (B2). Covers new tests:
--    2. a suspended user can't create posts, requests, events, reports or
--       announcements; after the suspension ends they can
--    5. with teachers_post_any_grade off, a teacher posts only to grades and
--       sections they teach
--    6. rollover dry-run changes nothing; a real rollover moves grades up,
--       archives the top grade and logs to the audit log
--   11. CSV import rejects bad rows without importing anything of them, and
--       imports the valid ones
-- and part of 1 (non-admins can't write to the new admin tables).
begin;
create extension if not exists pgtap with schema extensions;
select plan(41);


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
-- New test 1 (part): grades, sections, classes and the roster are admin-only
-- ---------------------------------------------------------------------------
select pg_temp.act_as('teacher.a');

select throws_ok($$ insert into public.grades (grade, name) values (9, 'Grade 9') $$,
  '42501', null, 'A teacher cannot add a grade');
select throws_ok($$ insert into public.sections (grade, name) values (10, 'C') $$,
  '42501', null, 'A teacher cannot add a section');
select throws_ok($$ insert into public.classes (name, grade) values ('Mine', 10) $$,
  '42501', null, 'A teacher cannot create a class');
select throws_ok($$ insert into public.roster (email, full_name) values ('a@dev.local', 'A') $$,
  '42501', null, 'A teacher cannot add to the roster');
select throws_ok($$ select public.admin_suspend_posting(pg_temp.uid('student.g8.a'), now() + interval '1 day', 'x') $$,
  '42501', 'Only admins can suspend posting.', 'A teacher cannot suspend anyone');

select pg_temp.act_as('student.g10.b');
select is((select count(*)::int from public.class_students), 0,
  'A student sees no class lists but their own (Grade 10 B is in none)');
select is((select count(*)::int from public.grades), 3, 'Everyone can read the grades');

-- ---------------------------------------------------------------------------
-- New test 2: suspension
-- ---------------------------------------------------------------------------
select pg_temp.act_as('admin.plain');
select public.admin_suspend_posting(pg_temp.uid('student.g10.a'), now() + interval '3 days', 'Spam (sample)');
select public.admin_suspend_posting(pg_temp.uid('teacher.b'), now() + interval '3 days', null);

select ok(
  exists (select 1 from public.audit_log where action = 'posting_suspended'
          and row_id = pg_temp.uid('student.g10.a')::text),
  'Suspending someone is written to the audit log'
);

select pg_temp.act_as('student.g10.a');

select is((select posting_suspended_until is not null from public.my_account_status()), true,
  'A suspended student can see their own suspension (for the banner)');

select throws_like($$ insert into public.collab_posts (title, spots_wanted) values ('Suspended post', 2) $$,
  'Posting is paused on your account until %', 'A suspended student cannot create a collab post');
select throws_like($$ insert into public.join_requests (post_id, message)
     select id, 'hi' from public.collab_posts where title like 'Calligraphy%' $$,
  'Posting is paused%', 'A suspended student cannot ask to join a post');
select throws_like($$ insert into public.volunteer_events (title, starts_at, ends_at, place_text)
     values ('Suspended event', now() + interval '5 days', now() + interval '5 days 2 hours', 'Gym') $$,
  'Posting is paused%', 'A suspended student cannot create a volunteering event');
select throws_like($$ insert into public.reports (room_id, category, description)
     values ((select id from public.rooms where code = 'G.04'), 'other', 'Suspended report') $$,
  'Posting is paused%', 'A suspended student cannot send a fix-it report');

select pg_temp.act_as('teacher.b');
select throws_like($$ insert into public.announcements (title, audience, grades) values ('Suspended', 'grades', '{8}') $$,
  'Posting is paused%', 'A suspended teacher cannot post an announcement');

-- The suspension ends.
select pg_temp.act_as_owner();
update public.profiles set posting_suspended_until = now() - interval '1 minute'
where id in (pg_temp.uid('student.g10.a'), pg_temp.uid('teacher.b'));

select pg_temp.act_as('student.g10.a');
select lives_ok($$ insert into public.collab_posts (title, spots_wanted) values ('Back again (sample)', 2) $$,
  'After the suspension ends, the student can post');
select lives_ok($$ insert into public.join_requests (post_id, message)
     select id, 'hi' from public.collab_posts where title like 'Calligraphy%' $$,
  '…and ask to join a post');
select lives_ok($$ insert into public.volunteer_events (title, starts_at, ends_at, place_text)
     values ('Back event (sample)', now() + interval '5 days', now() + interval '5 days 2 hours', 'Gym') $$,
  '…and create an event');
select lives_ok($$ insert into public.reports (room_id, category, description)
     values ((select id from public.rooms where code = 'G.04'), 'other', 'Back report (sample)') $$,
  '…and send a report');
select pg_temp.act_as('teacher.b');
select lives_ok($$ insert into public.announcements (title, audience, grades) values ('Back (sample)', 'grades', '{8}') $$,
  'After the suspension ends, the teacher can post');

-- ---------------------------------------------------------------------------
-- New test 5: teachers post only to what they teach (when switched on)
-- Seed: Teacher A teaches 10 A Physics (a section); Teacher B teaches
-- Grade 8 English (the whole grade).
-- ---------------------------------------------------------------------------
select pg_temp.act_as_owner();
update public.app_settings set teachers_post_any_grade = false;

select pg_temp.act_as('teacher.a');
select throws_ok($$ insert into public.announcements (title, audience, grades) values ('All of 10', 'grades', '{10}') $$,
  'P0001', 'You can only post to grades and sections you teach. Ask an admin if your classes are missing.',
  'A teacher of one section cannot post to the whole grade');
select lives_ok($$ insert into public.announcements (title, audience, grades, section_ids)
     values ('10 A only (sample)', 'grades', '{}', array[(select id from public.sections where grade = 10 and name = 'A')]) $$,
  'A teacher can post to the section they teach');
select is((select grades from public.announcements where title = '10 A only (sample)'), '{10}'::int[],
  'The grade list is filled in from the chosen sections');
select throws_ok($$ insert into public.announcements (title, audience, grades, section_ids)
     values ('10 B', 'grades', '{}', array[(select id from public.sections where grade = 10 and name = 'B')]) $$,
  'P0001', null, 'A teacher cannot post to a section they don''t teach');

select pg_temp.act_as('teacher.b');
select lives_ok($$ insert into public.announcements (title, audience, grades) values ('All of 8 (sample)', 'grades', '{8}') $$,
  'A teacher of a grade-wide class can post to that grade');

select pg_temp.act_as('student.g10.a');
select ok(exists (select 1 from public.announcements where title = '10 A only (sample)'),
  'A student in 10 A sees the section announcement');
select pg_temp.act_as('student.g10.b');
select ok(not exists (select 1 from public.announcements where title = '10 A only (sample)'),
  'A student in 10 B does not');

select pg_temp.act_as_owner();
update public.app_settings set teachers_post_any_grade = true;
select pg_temp.act_as('teacher.a');
select lives_ok($$ insert into public.announcements (title, audience, grades) values ('Any grade (sample)', 'grades', '{12}') $$,
  'With teachers_post_any_grade on (the default), teachers post to any grade');

-- ---------------------------------------------------------------------------
-- New test 11: CSV import
-- ---------------------------------------------------------------------------
select pg_temp.act_as_owner();
update public.app_settings set school_email_domain = 'school.example';
create temporary table import_rows as select $json$[
  {"name": "New Student (sample)", "email": "New.Student@dev.local", "role": "student", "grade": "10", "section": "a"},
  {"name": "Renamed Grade 8 A (sample)", "email": "student.g8.a@dev.local", "role": "student", "grade": "8", "section": "B"},
  {"name": "", "email": "nameless@dev.local", "role": "student", "grade": "10"},
  {"name": "Outsider", "email": "outsider@gmail.com", "role": "student", "grade": "10"},
  {"name": "Unknown Grade", "email": "unknown.grade@dev.local", "role": "student", "grade": "9"},
  {"name": "Twice", "email": "new.student@dev.local", "role": "student", "grade": "10"},
  {"name": "New Teacher (sample)", "email": "new.teacher@dev.local", "role": "teacher"}
]$json$::jsonb as rows;
grant select on pg_temp.import_rows to authenticated;

select pg_temp.act_as('admin.plain');

select results_eq(
  $$ select outcome || ': ' || message from public.admin_import_people((select rows from pg_temp.import_rows), true) order by row_number $$,
  $$ values
    ('create: Set up when they first sign in.'),
    ('update: Account updated.'),
    ('error: Name is missing.'),
    ('error: Not a school email address (must end in school.example).'),
    ('error: Unknown grade: 9.'),
    ('error: Duplicate: the same email is on row 1.'),
    ('create: Set up when they first sign in.') $$,
  'The preview checks every row and says what is wrong with each bad one'
);

select is((select count(*)::int from public.roster), 0, 'The preview (dry run) saves nothing');

select is(
  (select count(*)::int from public.admin_import_people((select rows from pg_temp.import_rows), false) where outcome <> 'error'),
  3,
  'The real import saves the three good rows'
);

select pg_temp.act_as_owner();

select results_eq(
  $$ select lower(email) from public.roster order by 1 $$,
  $$ values ('new.student@dev.local'), ('new.teacher@dev.local') $$,
  'New people wait on the roster; nothing from the bad rows was saved'
);
select ok(exists (select 1 from public.staff_emails where email = 'new.teacher@dev.local'),
  'An imported teacher is added to the staff list');
select is(
  (select full_name || ' / ' || grade || section from public.profiles where id = pg_temp.uid('student.g8.a')),
  'Renamed Grade 8 A (sample) / 8B',
  'An existing account is updated straight away'
);

-- The imported student signs in for the first time.
insert into auth.users (id, email, raw_user_meta_data)
values ('d1000000-0000-4000-8000-000000000001', 'new.student@dev.local', '{"full_name": "Whatever Google says"}');
select is(
  (select full_name || ' / ' || role || ' / ' || grade || section from public.profiles
   where id = 'd1000000-0000-4000-8000-000000000001'),
  'New Student (sample) / student / 10A',
  'At first sign-in the roster sets their name, role, grade and section'
);

-- ---------------------------------------------------------------------------
-- New test 6: year-end rollover (grades 8, 10, 12: 8 → 10 → 12 → archived)
-- ---------------------------------------------------------------------------
select pg_temp.act_as('admin.plain');

select results_eq(
  $$ select from_grade, to_grade, students from public.admin_rollover(true) $$,
  $$ values (8, 10, 2), (10, 12, 3), (12, null::int, 2) $$,
  'The dry run shows, per grade, where students go and how many'
);

select pg_temp.act_as_owner();
select is(
  (select string_agg(grade::text, ',' order by grade) from public.profiles where role = 'student' and archived_at is null),
  '8,8,10,10,10,12,12',
  'The dry run changed nothing'
);

select pg_temp.act_as('admin.plain');
select throws_like($$ select * from public.admin_rollover(false, 'rollover') $$,
  'Type ROLLOVER % to confirm.', 'The real rollover needs the typed confirmation');
select lives_ok(
  format($$ select * from public.admin_rollover(false, %L) $$,
         'ROLLOVER ' || extract(year from now() at time zone 'Asia/Dubai')::int),
  'With the confirmation, the rollover runs'
);

select pg_temp.act_as_owner();
select is(
  (select string_agg(grade::text, ',' order by grade) from public.profiles where role = 'student' and archived_at is null),
  '10,10,12,12,12',
  'Everyone moved up a grade'
);
select ok(
  (select bool_and(p.archived_at is not null and u.banned_until > now() + interval '100 years')
   from public.profiles p join auth.users u on u.id = p.id
   where p.id in (pg_temp.uid('student.g12.a'), pg_temp.uid('student.g12.b'))),
  'The top grade is archived and can no longer sign in'
);
select ok(exists (select 1 from public.audit_log where action = 'rollover'),
  'The rollover is in the audit log');

select * from finish();
rollback;
