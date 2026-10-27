-- Feature settings (B4). Covers new tests:
--    3. (the rest) bookings outside bookable hours, longer than the maximum,
--       or further ahead than allowed are refused
--    4. an announcement with a future publish_at is invisible to students
--       until then; an expired one disappears
--    9. reaching the auto-urgent "me too" threshold flags the report and
--       notifies the responsible staff
--   10. report categories come from the table, and routing still sends IT
--       issues only to `it` staff
-- plus skill tags, volunteering settings and part of 1 (admin-only writes).
begin;
create extension if not exists pgtap with schema extensions;
select plan(31);


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

create function pg_temp.on_day(p_days int, p_time text) returns timestamptz language sql stable as $$
  select (((now() at time zone 'Asia/Dubai')::date + p_days) + p_time::time) at time zone 'Asia/Dubai';
$$;
grant execute on function pg_temp.on_day(int, text) to authenticated;

-- ---------------------------------------------------------------------------
-- New test 1 (part): the new feature tables are admin-only to write
-- ---------------------------------------------------------------------------
select pg_temp.act_as('teacher.a');
select throws_ok($$ insert into public.skill_tags (name) values ('Juggling') $$,
  '42501', null, 'A teacher cannot add a skill tag');
select throws_ok($$ insert into public.volunteer_categories (name) values ('Sport') $$,
  '42501', null, 'A teacher cannot add a volunteering category');
select throws_ok($$ insert into public.supw_targets (grade, hours) values (8, 1) $$,
  '42501', null, 'A teacher cannot set SUPW targets');
select throws_ok($$ insert into public.report_categories (key, name) values ('roof', 'Roof') $$,
  '42501', null, 'A teacher cannot add a report category');
select throws_ok($$ select public.admin_review_tag_suggestion((select id from public.skill_tag_suggestions limit 1), 'approve') $$,
  '42501', null, 'A teacher cannot review skill suggestions');

-- ---------------------------------------------------------------------------
-- New test 3 (the rest): the venue's own limits.
-- Seed: the Auditorium is bookable 07:00–18:00, up to 240 minutes, 60 days ahead.
-- These limits apply to any booking, so test them with custom times allowed:
-- then the bell times (17_bell_times_test.sql) don't get in the way.
-- ---------------------------------------------------------------------------
select pg_temp.act_as_owner();
update public.app_settings set allow_custom_booking_times = true;
select pg_temp.act_as('teacher.b');

select throws_ok(
  $$ insert into public.bookings (venue_id, title, starts_at, ends_at)
     values ((select id from public.venues where name = 'Auditorium (placeholder)'), 'Too early',
             pg_temp.on_day(5, '06:00'), pg_temp.on_day(5, '07:30')) $$,
  'P0001', 'Auditorium (placeholder) can be booked between 07:00 and 18:00.',
  'A booking outside the venue''s bookable hours is refused'
);
select throws_ok(
  $$ insert into public.bookings (venue_id, title, starts_at, ends_at)
     values ((select id from public.venues where name = 'Auditorium (placeholder)'), 'Too long',
             pg_temp.on_day(5, '08:00'), pg_temp.on_day(5, '13:00')) $$,
  'P0001', 'Bookings for Auditorium (placeholder) can be at most 240 minutes long.',
  'A booking longer than the maximum is refused'
);
select throws_ok(
  $$ insert into public.bookings (venue_id, title, starts_at, ends_at)
     values ((select id from public.venues where name = 'Auditorium (placeholder)'), 'Too far',
             pg_temp.on_day(70, '09:00'), pg_temp.on_day(70, '10:30')) $$,
  'P0001', 'Auditorium (placeholder) can be booked up to 60 days ahead.',
  'A booking further ahead than allowed is refused'
);
select lives_ok(
  $$ insert into public.bookings (venue_id, title, starts_at, ends_at)
     values ((select id from public.venues where name = 'Auditorium (placeholder)'), 'Within the rules (sample)',
             pg_temp.on_day(5, '09:00'), pg_temp.on_day(5, '10:30')) $$,
  'A booking within every rule goes through'
);
select pg_temp.act_as_owner();
update public.app_settings set allow_custom_booking_times = false;

-- ---------------------------------------------------------------------------
-- New test 4: scheduled and expired announcements
-- ---------------------------------------------------------------------------
select pg_temp.act_as('admin.plain');
insert into public.announcements (id, title, audience, pinned, publish_at)
values ('f0000000-0000-4000-8000-000000000001', 'Later (sample)', 'school', true, now() + interval '1 hour');

select pg_temp.act_as('student.g10.a');
select ok(not exists (select 1 from public.announcements where title = 'Later (sample)'),
  'A student cannot see an announcement scheduled for later');
select ok(not exists (select 1 from public.announcements where title = 'Sports day sign-ups open (sample)'),
  '…including the seeded scheduled one');

select pg_temp.act_as_owner();
select is((select count(*)::int from public.notifications where title = 'Later (sample)'), 0,
  'Nobody is notified before it is published');

-- Time passes: its publish time is now in the past.
update public.announcements set publish_at = now() - interval '1 minute'
where id = 'f0000000-0000-4000-8000-000000000001';
select is(public.publish_due_announcements(), 1, 'The scheduler sends the one that is now due');
select is((select count(*)::int from public.notifications where title = 'Later (sample)'), 11,
  'Its notifications go out when it is published (pinned: everyone but the author)');
select is(public.publish_due_announcements(), 0, 'and only once');

select pg_temp.act_as('student.g10.a');
select ok(exists (select 1 from public.announcements where title = 'Later (sample)'),
  'Once its time has come, students see it');

select pg_temp.act_as_owner();
update public.announcements set expires_at = now() - interval '1 second'
where id = 'f0000000-0000-4000-8000-000000000001';
select pg_temp.act_as('student.g10.a');
select ok(not exists (select 1 from public.announcements where title = 'Later (sample)'),
  'After it expires, it disappears for students');
select pg_temp.act_as('admin.plain');
select ok(exists (select 1 from public.announcements where title = 'Later (sample)'),
  'Admins still see expired ones (to manage them)');

-- ---------------------------------------------------------------------------
-- New test 10: report categories come from the table
-- ---------------------------------------------------------------------------
select pg_temp.act_as_owner();
select is(
  (select data_type from information_schema.columns
   where table_schema = 'public' and table_name = 'reports' and column_name = 'category'),
  'text',
  'reports.category is now a key into report_categories, not an enum'
);
select is((select count(*)::int from public.reports where category not in (select key from public.report_categories)), 0,
  'Every existing report kept a valid category');

select pg_temp.act_as('admin.plain');
insert into public.report_categories (key, name, icon, responsibility)
values ('projector', 'Projector (sample)', 'monitor', 'it');

-- Give Teacher B facilities (not IT), so "facilities but not IT" exists.
select pg_temp.act_as_owner();
insert into public.responsibilities (user_id, kind) values (pg_temp.uid('teacher.b'), 'facilities');

select pg_temp.act_as('student.g8.b');
insert into public.reports (room_id, category, description)
values ((select id from public.rooms where code = 'G.04'), 'projector', 'Projector flickers (sample)');
insert into public.reports (room_id, category, description)
values ((select id from public.rooms where code = '1.03'), 'it', 'Keyboard missing (sample)');

select pg_temp.act_as_owner();
select results_eq(
  $$ select distinct p.email::text from public.notifications n join public.profiles p on p.id = n.recipient_id
     where n.type = 'report_new' and n.body in ('Projector flickers (sample)', 'Keyboard missing (sample)') $$,
  $$ values ('admin.facilities@dev.local') $$,
  'A new category routed to IT, and the old IT one, notify only IT holders'
);
select is((select title from public.notifications where body = 'Projector flickers (sample)' limit 1),
  'New report: Projector (sample) in Classroom G.04 (placeholder) (G.04)',
  'Notifications use the category''s name from the table');

select pg_temp.act_as('admin.plain');
update public.report_categories set active = false where key = 'projector';
select pg_temp.act_as('student.g8.b');
select throws_ok(
  $$ insert into public.reports (room_id, category, description)
     values ((select id from public.rooms where code = 'G.04'), 'projector', 'Again') $$,
  'P0001', 'That kind of problem isn''t on the list any more. Choose another.',
  'A retired category can''t be used for new reports'
);

-- ---------------------------------------------------------------------------
-- New test 9: auto-urgent. Seed: the projector report in G.03 has 3 "me too".
-- ---------------------------------------------------------------------------
select pg_temp.act_as_owner();
update public.app_settings set report_auto_urgent_votes = 4;

select pg_temp.act_as('student.g12.b');
insert into public.report_votes (report_id)
select id from public.report_feed() where description like 'Projector won%';

select pg_temp.act_as_owner();
select is((select urgent from public.reports where description like 'Projector won%'), true,
  'The fourth "me too" makes the report urgent');
select ok(
  exists (
    select 1 from public.notifications n join public.email_outbox o on o.notification_id = n.id
    where n.recipient_id = pg_temp.uid('admin.facilities') and n.type = 'report_new'
      and n.title like 'URGENT: IT%' and o.kind = 'immediate'
  ),
  'and the IT team is notified at once, with an immediate email'
);

-- ---------------------------------------------------------------------------
-- Collab: skill tags, suggestions, team size
-- ---------------------------------------------------------------------------
select pg_temp.act_as('student.g8.b');
select throws_like($$ insert into public.collab_posts (title, skills, spots_wanted) values ('Juggling club', '{Juggling}', 2) $$,
  '"Juggling" isn''t on the skills list.%', 'Skills must come from the list');
select lives_ok($$ insert into public.collab_posts (title, skills, spots_wanted) values ('Printer club (sample)', '{coding,"3D printing"}', 2) $$,
  'A listed skill (any capitals) or a suggestion waiting for review can be used');
select is((select skills from public.collab_posts where title = 'Printer club (sample)'), '{Coding,"3D printing"}'::text[],
  'Listed skills take the list''s spelling');
select throws_like($$ insert into public.collab_posts (title, spots_wanted) values ('Huge team', 20) $$,
  'Teams can have at most 8 people%', 'Teams are capped at collab_max_team_size');

select pg_temp.act_as('admin.plain');
select public.admin_review_tag_suggestion(
  (select id from public.skill_tag_suggestions where name = '3D printing'), 'merge',
  (select id from public.skill_tags where name = 'Design'));
select is((select skills from public.collab_posts where title = 'Printer club (sample)'), '{Coding,Design}'::text[],
  'Merging a suggestion moves posts onto the existing tag');

-- ---------------------------------------------------------------------------
-- Volunteering: the approval switch
-- ---------------------------------------------------------------------------
select pg_temp.act_as_owner();
update public.app_settings set student_events_need_approval = false;
select pg_temp.act_as('student.g10.b');
insert into public.volunteer_events (title, starts_at, ends_at, place_text)
values ('No approval needed (sample)', pg_temp.on_day(6, '09:00'), pg_temp.on_day(6, '11:00'), 'Garden');
select is((select status::text from public.volunteer_events where title = 'No approval needed (sample)'), 'published',
  'With student_events_need_approval off, a student''s event goes live at once');

select * from finish();
rollback;
