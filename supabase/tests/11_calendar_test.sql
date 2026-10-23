-- School calendar (B3). Covers part of new test 3 (a booking that overlaps a
-- venue blackout or a holiday is refused; venue hours, length and how far
-- ahead are in 12_feature_settings_test.sql) and part of new test 1 (the
-- calendar tables are admin-only to write, readable by everyone).
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

-- Dates relative to today, as the seed made them (Dubai time).
create function pg_temp.on_day(p_days int, p_time text) returns timestamptz language sql stable as $$
  select (((now() at time zone 'Asia/Dubai')::date + p_days) + p_time::time) at time zone 'Asia/Dubai';
$$;
grant execute on function pg_temp.on_day(int, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Admin-only writes; everyone reads
-- ---------------------------------------------------------------------------
select pg_temp.act_as('teacher.a');

select throws_ok($$ insert into public.periods (name, starts_at, ends_at, weekdays) values ('P9', '15:00', '16:00', '{1}') $$,
  '42501', null, 'A teacher cannot add a period');
select throws_ok($$ insert into public.terms (name, starts_on, ends_on) values ('T', current_date, current_date) $$,
  '42501', null, 'A teacher cannot add a term');
select throws_ok($$ insert into public.holidays (name, starts_on, ends_on) values ('Day off', current_date, current_date) $$,
  '42501', null, 'A teacher cannot add a holiday');
select throws_ok($$ insert into public.venue_blackouts (starts_on, ends_on, reason) values (current_date, current_date, 'No') $$,
  '42501', null, 'A teacher cannot black out venues');

select pg_temp.act_as('student.g8.a');
select ok((select count(*) from public.periods) = 6 and (select count(*) from public.holidays) = 3,
  'Everyone reads periods and holidays (the booking screen needs them)');

-- ---------------------------------------------------------------------------
-- New test 3 (part): holidays and blackouts
-- Seed: mid-term break in 21–25 days, exams (all venues) in 28–32 days.
-- ---------------------------------------------------------------------------
select pg_temp.act_as('teacher.b');

select throws_like(
  $$ insert into public.bookings (venue_id, title, starts_at, ends_at)
     values ((select id from public.venues where name = 'MPH (placeholder)'), 'On a holiday',
             pg_temp.on_day(22, '09:00'), pg_temp.on_day(22, '10:30')) $$,
  'This venue can''t be booked then: % is a holiday (Mid-term break (placeholder)).',
  'A booking on a holiday is refused, saying which holiday'
);

select throws_like(
  $$ insert into public.bookings (venue_id, title, starts_at, ends_at)
     values ((select id from public.venues where name = 'Lab 1 (placeholder)'), 'In exams',
             pg_temp.on_day(30, '09:00'), pg_temp.on_day(30, '10:30')) $$,
  '%is blacked out (Exams (placeholder)).',
  'A booking during a whole-school blackout is refused'
);

select throws_like(
  $$ insert into public.bookings (venue_id, title, starts_at, ends_at)
     values ((select id from public.venues where name = 'MPH (placeholder)'), 'Overnight',
             pg_temp.on_day(20, '18:00'), pg_temp.on_day(21, '09:00')) $$,
  '%is a holiday%',
  'A booking that runs into a holiday is refused too'
);

-- A blackout for one venue only.
select pg_temp.act_as('admin.plain');
insert into public.venue_blackouts (venue_id, starts_on, ends_on, reason)
values ((select id from public.venues where name = 'Lab 1 (placeholder)'),
        (now() at time zone 'Asia/Dubai')::date + 45, (now() at time zone 'Asia/Dubai')::date + 46,
        'Lab refit (sample)');

select ok(
  exists (select 1 from public.audit_log where table_name = 'venue_blackouts' and action = 'insert'),
  'Adding a blackout is written to the audit log'
);

select pg_temp.act_as('teacher.b');
select throws_like(
  $$ insert into public.bookings (venue_id, title, starts_at, ends_at)
     values ((select id from public.venues where name = 'Lab 1 (placeholder)'), 'Refit day',
             pg_temp.on_day(45, '09:00'), pg_temp.on_day(45, '10:30')) $$,
  '%is blacked out (Lab refit (sample)).',
  'A venue''s own blackout blocks that venue…'
);
select lives_ok(
  $$ insert into public.bookings (venue_id, title, starts_at, ends_at)
     values ((select id from public.venues where name = 'MPH (placeholder)'), 'Refit day elsewhere (sample)',
             pg_temp.on_day(45, '09:00'), pg_temp.on_day(45, '10:30')) $$,
  '…but not the others'
);

-- ---------------------------------------------------------------------------
-- Bookable time follows periods, holidays and blackouts (used by utilisation)
-- ---------------------------------------------------------------------------
select pg_temp.act_as_owner();

select is(
  public.venue_bookable_minutes(
    (select id from public.venues where name = 'MPH (placeholder)'),
    (now() at time zone 'Asia/Dubai')::date + 22),
  0,
  'Nothing is bookable on a holiday'
);

select is(
  (select array_agg(minutes order by minutes) from (
     select distinct public.venue_bookable_minutes(
       (select id from public.venues where name = 'MPH (placeholder)'), d::date) as minutes
     from generate_series((now() at time zone 'Asia/Dubai')::date + 1, (now() at time zone 'Asia/Dubai')::date + 14, interval '1 day') d
     where public.calendar_day_note(null, d::date) is null
   ) m),
  '{0,240,450}'::int[],
  'Weekends 0 minutes, Monday to Thursday 450, the short Friday 240'
);

select * from finish();
rollback;
