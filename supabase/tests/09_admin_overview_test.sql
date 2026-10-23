-- Admin overview (B1): the dashboard's numbers come from admin-only functions
-- that count in the database. Covers part of new test 1 (non-admins can't call
-- admin functions); the full sweep is in 16_admin_lockdown_test.sql.
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
-- Only admins
-- ---------------------------------------------------------------------------
select pg_temp.act_as('teacher.a');

select throws_ok(
  $$ select * from public.admin_attention() $$,
  '42501', 'Only admins can see the dashboard.',
  'A teacher cannot read the dashboard numbers'
);

select throws_ok(
  $$ select * from public.admin_metrics() $$,
  '42501', null,
  'A teacher cannot read the activity metrics'
);

-- ---------------------------------------------------------------------------
-- Needs attention (seed: one student event waiting, three pending venue
-- requests, one awaiting its teacher, one attended sign-up without hours,
-- four open fix-it reports of which one is urgent)
-- ---------------------------------------------------------------------------
select pg_temp.act_as('admin.plain');

select is(
  (select item_count from public.admin_attention() where kind = 'events_to_approve'),
  1,
  'Counts student events waiting for approval'
);

select is(
  (select item_count || '/' || urgent_count from public.admin_attention() where kind = 'open_reports'),
  '4/1',
  'Counts open fix-it reports and how many are urgent'
);

select ok(
  (select oldest_at <= now() - interval '1 day' from public.admin_attention() where kind = 'open_reports'),
  'Gives the age of the oldest waiting item'
);

select is(
  (select item_count from public.admin_attention() where kind = 'hours_to_confirm'),
  1,
  'Counts SUPW hours waiting to be confirmed'
);

-- ---------------------------------------------------------------------------
-- Metrics for 7 and 30 days
-- ---------------------------------------------------------------------------
select results_eq(
  $$ select days from public.admin_metrics() order by days $$,
  $$ values (7), (30) $$,
  'One row of metrics for each window'
);

select ok(
  (select new_reports >= 4 and collab_posts_created >= 3 and supw_hours_confirmed = 1
   from public.admin_metrics() where days = 7),
  'Counts this week''s reports, collab posts and confirmed SUPW hours'
);

-- ---------------------------------------------------------------------------
-- Venue utilisation: add an approved 90-minute booking yesterday.
-- ---------------------------------------------------------------------------
select pg_temp.act_as_owner();
insert into public.bookings (id, venue_id, requester_id, title, starts_at, ends_at)
values (
  'e1000000-0000-4000-8000-000000000001',
  (select id from public.venues where name = 'Lab 1 (placeholder)'),
  pg_temp.uid('teacher.b'), 'Yesterday (sample)',
  ((now() at time zone 'Asia/Dubai')::date - 1 + time '09:00') at time zone 'Asia/Dubai',
  ((now() at time zone 'Asia/Dubai')::date - 1 + time '10:30') at time zone 'Asia/Dubai'
);
update public.bookings set status = 'approved' where id = 'e1000000-0000-4000-8000-000000000001';

select pg_temp.act_as('admin.plain');

select is(
  (select booked_hours from public.admin_venue_utilisation(7) where venue_name = 'Lab 1 (placeholder)'),
  1.5,
  'Utilisation counts approved booked hours in the window'
);

select ok(
  (select bool_and(utilisation is null or utilisation between 0 and 1)
   from public.admin_venue_utilisation(30)),
  'Utilisation is a share between 0 and 1 for every venue'
);

select is(
  (select hours from public.admin_supw_by_grade(30) where grade = 12),
  1.0,
  'SUPW hours confirmed are grouped by grade'
);

select * from finish();
rollback;
