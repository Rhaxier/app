-- SUPW volunteering. Covers required tests:
--   4. a student-created event is invisible to other students until approved
--   5. with allow_multiple_roles = false, a second sign-up in the event fails
--   6. selecting more students than spots_wanted fails
-- Also: students can't confirm hours (even on their own events); the approving
-- teacher can.
begin;
create extension if not exists pgtap with schema extensions;
select plan(17);

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
-- Required test 4: student events wait for approval
-- ---------------------------------------------------------------------------
select pg_temp.act_as('student.g10.a');

select is(
  (select count(*)::int from public.volunteer_events where title = 'Charity bake sale (sample)'),
  0,
  'Another student cannot see a student event awaiting approval'
);

select is(
  (select count(*)::int from public.event_roles r
   join public.volunteer_events e on e.id = r.event_id
   where e.title = 'Charity bake sale (sample)'),
  0,
  '...nor its roles'
);

-- Trying to approve it does nothing: the row isn't even visible.
update public.volunteer_events set status = 'published' where title = 'Charity bake sale (sample)';

select pg_temp.act_as('student.g12.a');

select is(
  (select status::text from public.volunteer_events where title = 'Charity bake sale (sample)'),
  'awaiting_approval',
  'Its creator sees it, still awaiting approval'
);

select throws_ok(
  $$ update public.volunteer_events set status = 'published' where title = 'Charity bake sale (sample)' $$,
  'P0001', 'Only a teacher or admin can approve or send back an event.',
  'The student creator cannot approve their own event'
);

select pg_temp.act_as('teacher.c');

select lives_ok(
  $$ update public.volunteer_events set status = 'published' where title = 'Charity bake sale (sample)' $$,
  'Any teacher can approve it'
);

select pg_temp.act_as('student.g10.a');

select is(
  (select count(*)::int from public.volunteer_events where title = 'Charity bake sale (sample)'),
  1,
  'Once approved, every student sees it'
);

select pg_temp.act_as_owner();

select ok(
  exists (
    select 1 from public.notifications
    where recipient_id = pg_temp.uid('student.g12.a') and type = 'vol_event_approved'
  ) and (select approved_by from public.volunteer_events where title = 'Charity bake sale (sample)')
        = pg_temp.uid('teacher.c'),
  'The creator is told, and the approving teacher is recorded'
);

select pg_temp.act_as('student.g10.b');
insert into public.volunteer_events (title, starts_at, ends_at, place_text, status)
values ('Sneaky (sample)', now() + interval '8 days', now() + interval '8 days 1 hour', 'Field (placeholder)', 'published');

select is(
  (select status::text from public.volunteer_events where title = 'Sneaky (sample)'),
  'awaiting_approval',
  'A student cannot create an event as already published'
);

-- ---------------------------------------------------------------------------
-- Required test 5: one role per event when multiple roles are off
-- ---------------------------------------------------------------------------
-- Beach clean-up has allow_multiple_roles = false; Grade 10 B is in the crew.
select throws_ok(
  $$ insert into public.role_signups (role_id)
     select r.id from public.event_roles r join public.volunteer_events e on e.id = r.event_id
     where e.title = 'Beach clean-up (sample)' and r.name = 'Registration desk' $$,
  'P0001', 'You''ve already signed up for a role in this event. The organiser allows one role each.',
  'A second sign-up in the same event fails'
);

select pg_temp.act_as('student.g8.b');

select is(
  (select count(*)::int from public.role_signups s
   join public.volunteer_events e on e.id = s.event_id
   where e.title = 'Food drive packing (sample)' and s.student_id = auth.uid()),
  2,
  'When the organiser allows it, a student can hold two roles'
);

-- ---------------------------------------------------------------------------
-- Required test 6: the cap
-- ---------------------------------------------------------------------------
select pg_temp.act_as('teacher.a');

select is(
  (select status::text from public.role_signups s join public.event_roles r on r.id = s.role_id
   where r.name = 'Photographer' and s.student_id = pg_temp.uid('student.g12.b')),
  'waitlisted',
  'When a role fills up, the rest are waitlisted'
);

select throws_ok(
  $$ update public.role_signups set status = 'selected'
     where student_id = pg_temp.uid('student.g12.b')
       and role_id = (select id from public.event_roles where name = 'Photographer') $$,
  'P0001', 'This role already has all 1 students it needs.',
  'Selecting more students than spots_wanted fails'
);

select throws_ok(
  $$ update public.event_roles set spots_wanted = 0 where name = 'Photographer' $$,
  'P0001', 'This role already has 1 selected students. Unselect someone first.',
  'A role cannot shrink below the students already selected'
);

-- ---------------------------------------------------------------------------
-- Hours: a teacher confirms, never a student
-- ---------------------------------------------------------------------------
-- Put Grade 10 A on the (now approved) bake sale, attended, as the owner.
select pg_temp.act_as_owner();
insert into public.role_signups (role_id, student_id, status, attended)
select r.id, pg_temp.uid('student.g10.a'), 'selected', true
from public.event_roles r join public.volunteer_events e on e.id = r.event_id
where e.title = 'Charity bake sale (sample)' and r.name = 'Baker';

select pg_temp.act_as('student.g12.a');

select throws_ok(
  $$ update public.role_signups set hours_confirmed = 2
     where student_id = pg_temp.uid('student.g10.a')
       and event_id = (select id from public.volunteer_events where title = 'Charity bake sale (sample)') $$,
  'P0001', 'Only a teacher can confirm SUPW hours.',
  'A student organiser cannot confirm hours on their own event'
);

select pg_temp.act_as('teacher.b');

select throws_ok(
  $$ update public.role_signups set hours_confirmed = 2
     where student_id = pg_temp.uid('student.g10.a')
       and event_id = (select id from public.volunteer_events where title = 'Charity bake sale (sample)') $$,
  'P0001', 'Only a teacher can confirm SUPW hours.',
  'A teacher who did not approve the event cannot confirm its hours'
);

select pg_temp.act_as('teacher.c');

select lives_ok(
  $$ update public.role_signups set hours_confirmed = 2
     where student_id = pg_temp.uid('student.g10.a')
       and event_id = (select id from public.volunteer_events where title = 'Charity bake sale (sample)') $$,
  'The teacher who approved a student event confirms its hours'
);

select pg_temp.act_as('student.g12.a');

select throws_ok(
  $$ select * from public.event_signups(
       (select id from public.volunteer_events where title = 'Beach clean-up (sample)')) $$,
  '42501', 'Only the organiser and staff can see who signed up.',
  'Only the organiser and staff see sign-up contact details'
);

select * from finish();
rollback;
