-- Notifications admin (B6). Covers new test 8: an emergency broadcast creates
-- one urgent notification per active user and is refused within the
-- rate-limit window. Also staff email settings, the digest time and part of
-- new test 1 (admins only).
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
-- Admins only
-- ---------------------------------------------------------------------------
select pg_temp.act_as('teacher.a');
select throws_ok($$ select public.admin_emergency_broadcast('Fire drill', 'Go outside') $$,
  '42501', 'Only admins can send an emergency message.', 'A teacher cannot send an emergency broadcast');
select throws_ok($$ insert into public.staff_email_prefs (user_id) values (auth.uid()) $$,
  '42501', null, 'A teacher cannot change staff email settings');
select throws_ok($$ insert into public.announcements (title, audience, grades, urgent) values ('Panic', 'grades', '{8}', true) $$,
  'P0001', 'Only admins can send an emergency announcement.', 'A teacher cannot post an urgent announcement');
select throws_ok($$ select * from public.admin_staff_email_settings() $$,
  '42501', null, 'A teacher cannot list staff email settings');

-- ---------------------------------------------------------------------------
-- New test 8: the emergency broadcast
-- One seeded student has left (archived), so 11 of the 12 people are active.
-- ---------------------------------------------------------------------------
select pg_temp.act_as_owner();
update public.profiles set archived_at = now() where id = pg_temp.uid('student.g12.b');

select pg_temp.act_as('admin.plain');
select is(public.admin_emergency_broadcast('Lockdown drill (sample)', 'Stay in your classroom. This is a drill (sample).'),
  11, 'The broadcast reaches every active person');

select pg_temp.act_as_owner();
select is(
  (select count(*)::int from public.profiles p
   where p.archived_at is null
     and (select count(*) from public.notifications n
          where n.recipient_id = p.id and n.type = 'emergency' and n.urgent) = 1),
  11,
  'Exactly one urgent notification for each active person'
);
select is(
  (select count(*)::int from public.notifications where recipient_id = pg_temp.uid('student.g12.b') and type = 'emergency'),
  0,
  'Nobody who has left is notified'
);
select is(
  (select count(*)::int from public.push_outbox o join public.notifications n on n.id = o.notification_id
   where n.type = 'emergency' and o.kind = 'immediate'),
  11,
  'Every one of them gets an immediate phone push'
);
select ok(
  (select bool_and(o.kind = 'immediate') and count(*) = 3
   from public.email_outbox o join public.notifications n on n.id = o.notification_id
   where n.type = 'emergency'),
  'Staff who get email (the three with responsibilities) get it immediately'
);
select is(
  (select count(*)::int from public.notifications where type = 'announcement_new' and title = 'Lockdown drill (sample)'),
  0,
  'No second, ordinary "new announcement" notification'
);
select ok(exists (select 1 from public.audit_log where action = 'emergency_broadcast'),
  'The broadcast is in the audit log');

select pg_temp.act_as('student.g8.a');
select ok(
  (select pinned and urgent from public.announcements where title = 'Lockdown drill (sample)'),
  'It is a pinned, urgent announcement everyone can see'
);

select pg_temp.act_as('admin.venues');
select throws_like($$ select public.admin_emergency_broadcast('Again', 'Again') $$,
  'An emergency message already went out at % ("Lockdown drill (sample)"). Wait 10 minutes before sending another.',
  'A second broadcast within 10 minutes is refused, even by another admin');

-- ---------------------------------------------------------------------------
-- Staff email settings (extends Q15)
-- ---------------------------------------------------------------------------
select pg_temp.act_as('admin.plain');
insert into public.staff_email_prefs (user_id, enabled, mode) values (pg_temp.uid('teacher.b'), true, 'immediate');
insert into public.staff_email_prefs (user_id, enabled) values (pg_temp.uid('admin.facilities'), false);

-- Teacher B (no responsibility) is asked to look at a project; a fix-it report
-- goes to Admin Facilities (who has switched email off).
select pg_temp.act_as('student.g10.a');
insert into public.project_shares (project_id, teacher_id)
select id, pg_temp.uid('teacher.b') from public.projects where title like 'Traffic flow%';
insert into public.reports (room_id, category, description)
values ((select id from public.rooms where code = 'G.04'), 'electrical', 'Light flickers (sample)');

select pg_temp.act_as_owner();
select is(
  (select o.kind::text from public.email_outbox o join public.notifications n on n.id = o.notification_id
   where n.recipient_id = pg_temp.uid('teacher.b') and n.type = 'project_shared'),
  'immediate',
  'A teacher switched on for immediate email gets one, even without a responsibility'
);
select is(
  (select count(*)::int from public.email_outbox o join public.notifications n on n.id = o.notification_id
   where n.recipient_id = pg_temp.uid('admin.facilities') and n.body = 'Light flickers (sample)'),
  0,
  'Staff with email switched off get none (still in-app and push)'
);

-- ---------------------------------------------------------------------------
-- The digest time
-- ---------------------------------------------------------------------------
update public.app_settings set digest_time = '00:00', digest_last_sent_on = null;
select public.mark_email_digest_sent();
select is(public.email_digest_due(), false, 'Once today''s digest is marked sent, it isn''t due again today');

select * from finish();
rollback;
