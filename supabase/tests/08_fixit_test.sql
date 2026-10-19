-- Fix-it reports. Covers required tests:
--   12. a student reading fix-it reports never receives reporter_id; staff do
--   13. a student can't set urgent; a teacher can
--   14. a new report in category `it` notifies only `it` responsibility holders
begin;
create extension if not exists pgtap with schema extensions;
select plan(15);

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
-- Required test 12: reporter privacy
-- ---------------------------------------------------------------------------
select pg_temp.act_as('student.g8.a');

select ok(
  (select count(*) from public.report_feed()) > 0,
  'A student can read the report feed'
);

select is(
  (select count(*)::int from public.report_feed() where reporter_id is not null or reporter_name is not null),
  0,
  'A student never receives reporter_id (or name)'
);

select throws_ok(
  $$ select reporter_id from public.reports $$,
  '42501', null,
  'A student cannot read reporter_id from the table either'
);

select is(
  (select count(*)::int from public.report_feed() where reported_by_me),
  1,
  'A student can still tell which reports are their own'
);

select pg_temp.act_as('teacher.c');

select is(
  (select count(*)::int from public.report_feed() where reporter_id is null),
  0,
  'Staff receive reporter_id on every report'
);

-- ---------------------------------------------------------------------------
-- Required test 13: urgent
-- ---------------------------------------------------------------------------
select pg_temp.act_as('student.g8.a');

select throws_ok(
  $$ insert into public.reports (room_id, category, description, urgent)
     values ((select id from public.rooms where code = 'G.04'), 'electrical', 'Sparks from socket', true) $$,
  'P0001', 'Only teachers can mark a report as urgent.',
  'A student cannot create an urgent report'
);

update public.reports set urgent = true where description like 'Projector%';

select pg_temp.act_as('teacher.c');

select is(
  (select urgent from public.report_feed() where description like 'Projector%'),
  false,
  'A student cannot mark an existing report urgent'
);

select lives_ok(
  $$ update public.reports set urgent = true where description like 'Projector%' $$,
  'A teacher can mark a report urgent'
);

select throws_ok(
  $$ update public.reports set status = 'resolved' where description like 'Projector%' $$,
  'P0001', 'Only the staff responsible for this kind of problem can update it.',
  'A teacher without the responsibility cannot change the status'
);

-- ---------------------------------------------------------------------------
-- Required test 14: routing
-- ---------------------------------------------------------------------------
-- Give Teacher B facilities (not IT), so "facilities but not IT" exists.
select pg_temp.act_as_owner();
insert into public.responsibilities (user_id, kind) values (pg_temp.uid('teacher.b'), 'facilities');

select pg_temp.act_as('student.g10.b');
insert into public.reports (room_id, category, description)
values ((select id from public.rooms where code = '1.03'), 'it', 'Computers will not log in (sample)');

select pg_temp.act_as_owner();

select results_eq(
  $$ select p.email::text from public.notifications n join public.profiles p on p.id = n.recipient_id
     where n.type = 'report_new' and n.body = 'Computers will not log in (sample)' $$,
  $$ values ('admin.facilities@dev.local') $$,
  'An IT report notifies only IT responsibility holders'
);

select is(
  (select o.kind::text from public.email_outbox o join public.notifications n on n.id = o.notification_id
   where n.body = 'Computers will not log in (sample)'),
  'digest',
  'A non-urgent report goes in the daily email digest'
);

-- ---------------------------------------------------------------------------
-- Duplicates, "me too" and status updates
-- ---------------------------------------------------------------------------
select pg_temp.act_as('student.g8.b');

select is(
  (select vote_count from public.open_reports_in_room((select id from public.rooms where code = 'G.03'))),
  3,
  'open_reports_in_room() shows the existing report with its "me too" count'
);

select throws_ok(
  $$ insert into public.report_votes (report_id)
     select id from public.report_feed() where description like 'Projector%' and not voted_by_me
     union all
     select id from public.report_feed() where description like 'Projector%' $$,
  '23505', null,
  '"Me too" counts once per person'
);

select pg_temp.act_as('admin.facilities');

select lives_ok(
  $$ update public.reports set status = 'in_progress', status_note = 'On it (sample)'
     where description like 'Projector%' $$,
  'Responsible staff change the status'
);

select pg_temp.act_as_owner();

select is(
  (select count(distinct recipient_id)::int from public.notifications
   where type = 'report_status' and body = 'On it (sample)'),
  4,
  'The reporter and all three "me too" voters hear about it'
);

select * from finish();
rollback;
