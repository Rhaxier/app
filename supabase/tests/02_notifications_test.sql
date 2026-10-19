-- Notifications. Covers required test 15:
--   users read and update only their own notifications, and can't insert any.
-- Also: mutes work, but approvals can't be muted; staff with responsibilities
-- get email outbox rows.
begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

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
-- Required test 15: own notifications only
-- ---------------------------------------------------------------------------
select pg_temp.act_as('student.g10.a');

select ok(
  (select count(*) from public.notifications) > 0,
  'A student sees their own notifications'
);

select is(
  (select count(*)::int from public.notifications where recipient_id <> auth.uid()),
  0,
  'A student sees nobody else''s notifications'
);

select lives_ok(
  $$ update public.notifications set read_at = now() where read_at is null $$,
  'A student can mark their notifications read'
);

select is(
  (select count(*)::int from public.notifications where read_at is null),
  0,
  'All of their notifications are now read'
);

-- An update aimed at someone else's rows silently matches nothing (RLS hides them).
update public.notifications set read_at = now() where recipient_id = pg_temp.uid('student.g10.b');

select throws_ok(
  $$ update public.notifications set title = 'Changed' where recipient_id = auth.uid() $$,
  '42501', null,
  'Only read_at can be changed, not the content'
);

select throws_ok(
  $$ insert into public.notifications (recipient_id, type, title)
     values (auth.uid(), 'announcement_new', 'Fake') $$,
  '42501', null,
  'Users cannot insert notifications'
);

select throws_ok(
  $$ select public.notify(pg_temp.uid('student.g10.b'), 'announcement_new', 'Fake', '', null) $$,
  '42501', null,
  'Users cannot call notify() through the API'
);

select throws_ok(
  $$ delete from public.notifications $$,
  '42501', null,
  'Users cannot delete notifications'
);

select pg_temp.act_as_owner();

select ok(
  (select count(*) from public.notifications
   where recipient_id = pg_temp.uid('student.g10.b') and read_at is null) > 0,
  'Another student''s notifications were not marked read'
);

-- ---------------------------------------------------------------------------
-- Mutes
-- ---------------------------------------------------------------------------
select pg_temp.act_as('student.g10.a');
insert into public.notification_prefs (type, muted) values ('announcement_new', true);

select pg_temp.act_as('teacher.a');
insert into public.announcements (title, body, audience, grades)
values ('Muted test (sample)', 'Body', 'grades', '{10}');

select pg_temp.act_as_owner();

select is(
  (select count(*)::int from public.notifications
   where title = 'Muted test (sample)' and recipient_id = pg_temp.uid('student.g10.a')),
  0,
  'A muted type is not delivered'
);

select is(
  (select count(*)::int from public.notifications
   where title = 'Muted test (sample)' and recipient_id = pg_temp.uid('student.g10.b')),
  1,
  'Others in the grade still get it'
);

-- Approvals can't be muted: Teacher A mutes them, a student submits an event.
insert into public.notification_prefs (user_id, type, muted)
values (pg_temp.uid('teacher.a'), 'vol_event_pending_approval', true);

select pg_temp.act_as('student.g8.a');
insert into public.volunteer_events (title, starts_at, ends_at, place_text)
values ('Unmutable test (sample)', now() + interval '10 days', now() + interval '10 days 2 hours', 'Gym (placeholder)');

select pg_temp.act_as_owner();

select is(
  (select count(*)::int from public.notifications
   where title = 'Event to approve: Unmutable test (sample)' and recipient_id = pg_temp.uid('teacher.a')),
  1,
  'Approval notifications arrive even when muted'
);

-- ---------------------------------------------------------------------------
-- Email outbox: staff with responsibilities only, urgent = immediate
-- ---------------------------------------------------------------------------
select ok(
  exists (
    select 1 from public.email_outbox o
    join public.notifications n on n.id = o.notification_id
    where o.recipient_id = pg_temp.uid('admin.facilities') and n.urgent and o.kind = 'immediate'
  )
  and not exists (
    select 1 from public.email_outbox where recipient_id = pg_temp.uid('student.g10.a')
  ),
  'Urgent items email responsible staff immediately; students get no email'
);

select * from finish();
rollback;
