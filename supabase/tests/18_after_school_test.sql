-- After-school booking. Covers:
--   * after the last period, a booking of whole blocks is accepted without
--     custom times, and one off the block grid, or ending after the latest
--     time, is refused
--   * a booking can't straddle the end of the school day
--   * the after-school start follows each day's own last period (Friday)
--   * admins can change the block length and the latest time
--
-- Seed periods: Monday to Thursday end at 15:00; Friday ends at 11:30.
-- Dates are in January 2030 (7th = Monday, 11th = Friday), clear of the
-- sample holidays and blackouts.
begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

-- ---------------------------------------------------------------------------
-- Test helpers (temporary: they vanish when this transaction ends)
-- ---------------------------------------------------------------------------
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

create function pg_temp.act_as_owner() returns void language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claims', '', true);
end;
$$;

-- book('Lab 1 (placeholder)', '2030-01-07 15:00', '2030-01-07 16:00'): request
-- a booking as whoever we're acting as. Times are Dubai times.
create function pg_temp.book(p_venue text, p_from text, p_to text) returns void language sql as $$
  insert into public.bookings (venue_id, title, starts_at, ends_at)
  values ((select id from public.venues where name = p_venue), 'After-school test (sample)',
          (p_from || '+04')::timestamptz, (p_to || '+04')::timestamptz);
$$;

grant usage on schema extensions to authenticated;
grant execute on all functions in schema extensions to authenticated;
grant execute on function pg_temp.act_as(text), pg_temp.act_as_owner(),
  pg_temp.book(text, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- The defaults: 30-minute blocks until 18:00, custom times off
-- ---------------------------------------------------------------------------
select is(
  (select (after_school_block_minutes, after_school_until)::text from public.app_settings),
  '(30,18:00:00)',
  'After-school blocks are 30 minutes, until 18:00, by default'
);

select pg_temp.act_as('teacher.b');

select lives_ok(
  $$ select pg_temp.book('Lab 1 (placeholder)', '2030-01-07 15:00', '2030-01-07 16:00') $$,
  'Two after-school blocks in a row (15:00-16:00) can be booked'
);
select throws_ok(
  $$ select pg_temp.book('Lab 1 (placeholder)', '2030-01-07 16:00', '2030-01-07 16:45') $$,
  'P0001',
  'After school on Monday, bookings start and end on 30-minute blocks from 15:00.',
  'An after-school booking off the block grid is refused'
);
select throws_ok(
  $$ select pg_temp.book('Lab 1 (placeholder)', '2030-01-07 17:30', '2030-01-07 18:30') $$,
  'P0001', 'After school, bookings can run until 18:00.',
  'An after-school booking can''t end after the latest time'
);
select throws_ok(
  $$ select pg_temp.book('Lab 1 (placeholder)', '2030-01-07 13:30', '2030-01-07 15:30') $$,
  'P0001',
  'Bookings follow the bell times, and no period ends at 15:30 on Monday.',
  'A booking can''t run from a period into after-school time'
);
select throws_ok(
  $$ select pg_temp.book('Lab 1 (placeholder)', '2030-01-07 10:00', '2030-01-07 11:00') $$,
  'P0001',
  'Bookings follow the bell times, and no period starts at 10:00 on Monday.',
  'During school hours, bookings still follow the periods'
);

-- Friday's last period ends at 11:30, so after school starts then.
select lives_ok(
  $$ select pg_temp.book('Lab 1 (placeholder)', '2030-01-11 11:30', '2030-01-11 12:00') $$,
  'On Friday, after-school time starts when Friday''s last period ends'
);

-- ---------------------------------------------------------------------------
-- Admins can change the blocks and the latest time
-- ---------------------------------------------------------------------------
select pg_temp.act_as('teacher.b');
update public.app_settings set after_school_block_minutes = 60, after_school_until = '20:00';
select pg_temp.act_as_owner();
select is(
  (select after_school_block_minutes from public.app_settings), 30,
  'Teachers can''t change the after-school settings'
);

select pg_temp.act_as('admin.plain');
update public.app_settings set after_school_block_minutes = 60, after_school_until = '20:00';
select pg_temp.act_as('teacher.b');
select throws_ok(
  $$ select pg_temp.book('Lab 1 (placeholder)', '2030-01-08 15:00', '2030-01-08 15:30') $$,
  'P0001',
  'After school on Tuesday, bookings start and end on 60-minute blocks from 15:00.',
  'With 60-minute blocks, a 30-minute booking is refused'
);
select lives_ok(
  $$ select pg_temp.book('Lab 1 (placeholder)', '2030-01-08 18:00', '2030-01-08 20:00') $$,
  'With the latest time at 20:00, an evening booking goes through'
);

select pg_temp.act_as_owner();
select throws_ok(
  $$ update public.app_settings set after_school_block_minutes = 7 $$,
  '23514', null,
  'Blocks must be 15 to 120 minutes, in steps of 5'
);

select * from finish();
rollback;
