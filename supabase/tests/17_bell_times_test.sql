-- Bell times: booking by periods, and the timetable CSV import. Covers:
--   * a booking not on period boundaries is refused while custom times are
--     off, and allowed once an admin turns them on
--   * a booking spanning two consecutive periods is accepted
--   * the CSV import reports overlapping and invalid rows, saves nothing while
--     any row has a problem, and replaces only the weekdays in the file
--
-- Seed periods: Monday to Thursday 07:30–09:00, 09:00–10:30, 10:30–12:00,
-- 12:00–13:30, 13:30–15:00; Friday 07:30–09:00, 09:00–10:30, 10:30–11:30.
-- Dates are in January 2030 (7th = Monday, 11th = Friday, 12th = Saturday),
-- clear of the sample holidays and blackouts.
begin;
create extension if not exists pgtap with schema extensions;
select plan(33);

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

-- book('Lab 1 (placeholder)', '2030-01-07 09:00', '2030-01-07 10:30'): request
-- a booking as whoever we're acting as. Times are Dubai times.
create function pg_temp.book(p_venue text, p_from text, p_to text) returns void language sql as $$
  insert into public.bookings (venue_id, title, starts_at, ends_at)
  values ((select id from public.venues where name = p_venue), 'Bell times test (sample)',
          (p_from || '+04')::timestamptz, (p_to || '+04')::timestamptz);
$$;

grant usage on schema extensions to authenticated;
grant execute on all functions in schema extensions to authenticated;
grant execute on function pg_temp.act_as(text), pg_temp.act_as_owner(),
  pg_temp.book(text, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Booking by periods (custom times off, the default)
-- ---------------------------------------------------------------------------
select is(
  (select allow_custom_booking_times from public.app_settings), false,
  'Custom booking times are off by default'
);

select pg_temp.act_as('teacher.b');

select throws_ok(
  $$ select pg_temp.book('Lab 1 (placeholder)', '2030-01-07 10:00', '2030-01-07 11:00') $$,
  'P0001', 'Bookings follow the bell times, and no period starts at 10:00 on Monday.',
  'A booking that doesn''t start when a period starts is refused'
);
select throws_ok(
  $$ select pg_temp.book('Lab 1 (placeholder)', '2030-01-07 09:00', '2030-01-07 11:00') $$,
  'P0001', 'Bookings follow the bell times, and no period ends at 11:00 on Monday.',
  'A booking that doesn''t end when a period ends is refused'
);
select lives_ok(
  $$ select pg_temp.book('Lab 1 (placeholder)', '2030-01-07 09:00', '2030-01-07 10:30') $$,
  'One period (Period 2) can be booked'
);
select lives_ok(
  $$ select pg_temp.book('Lab 1 (placeholder)', '2030-01-07 10:30', '2030-01-07 13:30') $$,
  'Two consecutive periods (Period 3 to Period 4) can be booked as one booking'
);

-- The short Friday: Period 3 ends at 11:30 on Fridays, not 12:00.
select throws_ok(
  $$ select pg_temp.book('Lab 1 (placeholder)', '2030-01-11 10:30', '2030-01-11 12:00') $$,
  'P0001', 'Bookings follow the bell times, and no period ends at 12:00 on Friday.',
  'Friday''s Period 3 can''t be booked with the Monday-to-Thursday times'
);
select lives_ok(
  $$ select pg_temp.book('Lab 1 (placeholder)', '2030-01-11 10:30', '2030-01-11 11:30') $$,
  'Friday''s short Period 3 can be booked'
);
select throws_ok(
  $$ select pg_temp.book('Lab 1 (placeholder)', '2030-01-12 09:00', '2030-01-12 10:30') $$,
  'P0001', 'There are no periods on Saturday, so nothing can be booked.',
  'A day without periods can''t be booked'
);
select throws_ok(
  $$ select pg_temp.book('Lab 1 (placeholder)', '2030-01-07 13:30', '2030-01-08 07:30') $$,
  'P0001', 'A booking starts and ends on the same day.',
  'A booking can''t run overnight'
);

-- The venue's own limits still apply. The MPH allows at most 300 minutes;
-- Period 1 to Period 5 is 450.
select throws_ok(
  $$ select pg_temp.book('MPH (placeholder)', '2030-01-07 07:30', '2030-01-07 15:00') $$,
  'P0001', 'Bookings for MPH (placeholder) can be at most 300 minutes long.',
  'The longest-booking limit still applies to a run of periods'
);

-- ---------------------------------------------------------------------------
-- Custom times: only admins can turn them on
-- ---------------------------------------------------------------------------
select pg_temp.act_as('student.g10.a');
update public.app_settings set allow_custom_booking_times = true;
select pg_temp.act_as('teacher.b');
update public.app_settings set allow_custom_booking_times = true;
select pg_temp.act_as_owner();
select is(
  (select allow_custom_booking_times from public.app_settings), false,
  'Students and teachers can''t turn on custom booking times'
);

select pg_temp.act_as('admin.plain');
update public.app_settings set allow_custom_booking_times = true;
select pg_temp.act_as('teacher.b');
select lives_ok(
  $$ select pg_temp.book('Lab 1 (placeholder)', '2030-01-07 15:30', '2030-01-07 17:00') $$,
  'With custom times on, an after-school booking that follows no period goes through'
);

-- Turning custom times off again leaves that booking alone: venue staff can
-- still approve it.
select pg_temp.act_as('admin.plain');
update public.app_settings set allow_custom_booking_times = false;
select pg_temp.act_as('admin.venues');
update public.bookings set status = 'approved'
where starts_at = '2030-01-07 15:30+04' and title = 'Bell times test (sample)';
select pg_temp.act_as_owner();
select is(
  (select status::text from public.bookings where starts_at = '2030-01-07 15:30+04'),
  'approved',
  'A booking made with custom times can still be approved after they are turned off'
);

-- ---------------------------------------------------------------------------
-- Periods can't overlap on the same weekday
-- ---------------------------------------------------------------------------
select pg_temp.act_as('admin.plain');
select throws_ok(
  $$ insert into public.periods (name, starts_at, ends_at, weekdays)
     values ('Clash (sample)', '08:30', '09:30', '{1}') $$,
  '23P01', 'Clash (sample) (08:30–09:30) overlaps Period 1 (07:30–09:00) on Monday.',
  'A period overlapping another on the same weekday is refused'
);
select lives_ok(
  $$ insert into public.periods (name, starts_at, ends_at, weekdays)
     values ('After school (sample)', '15:00', '16:00', '{1}') $$,
  'A period straight after another (back to back) is fine'
);

-- ---------------------------------------------------------------------------
-- The CSV import: the preview finds the problems
-- ---------------------------------------------------------------------------
select pg_temp.act_as('teacher.a');
select throws_ok(
  $$ select * from public.admin_import_periods('[{"weekday": "Monday", "period_name": "P", "start_time": "07:30", "end_time": "08:00", "order": "1"}]', true) $$,
  '42501', 'Only admins can change the bell times.',
  'A teacher can''t import bell times'
);

-- Line 1 of the file is the headings, so the first row is line 2.
select pg_temp.act_as('admin.plain');
create temporary table preview as
select * from public.admin_import_periods($$[
  {"weekday": "Funday",    "period_name": "Period 1", "start_time": "07:30", "end_time": "08:15", "order": "1"},
  {"weekday": "Friday",    "period_name": "Period 2", "start_time": "09:00", "end_time": "08:15", "order": "2"},
  {"weekday": "Friday",    "period_name": "Period 3", "start_time": "25:00", "end_time": "10:00", "order": "3"},
  {"weekday": "Thursday",  "period_name": "Period 1", "start_time": "07:30", "end_time": "08:30", "order": "1"},
  {"weekday": "Thursday",  "period_name": "Period 2", "start_time": "08:00", "end_time": "09:00", "order": "2"},
  {"weekday": "Wednesday", "period_name": "Period 1", "start_time": "07:30", "end_time": "08:15", "order": "1"},
  {"weekday": "Wednesday", "period_name": "Period 2", "start_time": "08:15", "end_time": "09:00", "order": "1"},
  {"weekday": "mon",       "period_name": "Period 1", "start_time": "7:30",  "end_time": "8:15",  "order": "1"}
]$$::jsonb, true);
select pg_temp.act_as_owner();

select results_eq(
  'select line, outcome from pg_temp.preview order by line',
  $$ values (2, 'error'), (3, 'error'), (4, 'error'), (5, 'error'), (6, 'error'),
            (7, 'error'), (8, 'error'), (9, 'ok') $$,
  'The preview marks every bad row, and only those'
);
select is(
  (select message from pg_temp.preview where line = 2),
  'Unknown weekday "Funday": use Sunday to Saturday, or Sun to Sat.',
  'An unknown weekday is reported'
);
select is(
  (select message from pg_temp.preview where line = 3),
  'It ends before it starts.',
  'A period ending before it starts is reported'
);
select is(
  (select message from pg_temp.preview where line = 4),
  'Start time "25:00" isn''t a time like 07:30.',
  'A start time that isn''t a time is reported'
);
select is(
  (select message from pg_temp.preview where line = 5),
  'Overlaps Period 2 (08:00–09:00) on line 6.',
  'Overlapping periods on the same day are reported (the first one)'
);
select is(
  (select message from pg_temp.preview where line = 6),
  'Overlaps Period 1 (07:30–08:30) on line 5.',
  'Overlapping periods on the same day are reported (the second one)'
);
select is(
  (select message from pg_temp.preview where line = 8),
  'Order 1 is also used on line 7 (Wednesday).',
  'A duplicate order on the same day is reported'
);
select is(
  (select weekday || ' ' || start_time || '–' || end_time from pg_temp.preview where line = 9),
  'Monday 07:30–08:15',
  'Short weekday names and times are read and tidied'
);

-- Saving with problems: refused, nothing changes.
create temporary table periods_before as select * from public.periods;
select pg_temp.act_as('admin.plain');
select throws_ok(
  $$ select * from public.admin_import_periods('[
       {"weekday": "Friday", "period_name": "Period 1", "start_time": "07:30", "end_time": "08:15", "order": "1"},
       {"weekday": "Friday", "period_name": "Period 2", "start_time": "08:00", "end_time": "09:00", "order": "2"}
     ]', false) $$,
  'P0001', 'Nothing was imported: fix the rows marked as problems first.',
  'An import with a problem row is refused as a whole'
);
select pg_temp.act_as_owner();
select set_eq(
  'select id, name, starts_at, ends_at, weekdays from public.periods',
  'select id, name, starts_at, ends_at, weekdays from pg_temp.periods_before',
  'A refused import changes no periods'
);

-- ---------------------------------------------------------------------------
-- The CSV import: saving replaces only the weekdays in the file
-- ---------------------------------------------------------------------------
select pg_temp.act_as('admin.plain');
select lives_ok(
  $$ select * from public.admin_import_periods('[
       {"weekday": "Friday", "period_name": "Period 1", "start_time": "07:30", "end_time": "08:15", "order": "1"},
       {"weekday": "Friday", "period_name": "Period 2", "start_time": "08:15", "end_time": "09:00", "order": "2"},
       {"weekday": "Fri",    "period_name": "Assembly", "start_time": "09:00", "end_time": "09:30", "order": "3"}
     ]', false) $$,
  'A clean file imports'
);
select pg_temp.act_as_owner();

select results_eq(
  $$ select name, to_char(starts_at, 'HH24:MI'), to_char(ends_at, 'HH24:MI')
     from public.periods where 5 = any (weekdays) order by starts_at $$,
  $$ values ('Period 1', '07:30', '08:15'), ('Period 2', '08:15', '09:00'), ('Assembly', '09:00', '09:30') $$,
  'Friday now has exactly the periods in the file'
);
select set_eq(
  $$ select name, starts_at, ends_at from public.periods where 1 = any (weekdays) $$,
  $$ select name, starts_at, ends_at from pg_temp.periods_before where 1 = any (weekdays) $$,
  'Monday keeps its periods (the file had no Monday rows)'
);
select is(
  (select weekdays from public.periods where name = 'Period 1' and starts_at = '07:30' and ends_at = '09:00'),
  '{1,2,3,4}'::int[],
  'A period that ran Monday to Friday keeps Monday to Thursday and loses Friday'
);
select is(
  (select details -> 'weekdays' from public.audit_log
   where action = 'periods_imported' order by created_at desc limit 1),
  '["Friday"]'::jsonb,
  'The import is written to the audit log, with the weekdays it replaced'
);

-- New bookings follow the new Friday bell times straight away.
select pg_temp.act_as('teacher.b');
select lives_ok(
  $$ select pg_temp.book('Lab 1 (placeholder)', '2030-01-18 08:15', '2030-01-18 09:30') $$,
  'Period 2 to Assembly on the new Friday can be booked'
);
select throws_ok(
  $$ select pg_temp.book('Lab 1 (placeholder)', '2030-01-18 10:30', '2030-01-18 11:30') $$,
  'P0001', 'Bookings follow the bell times, and no period starts at 10:30 on Friday.',
  'The old short Friday Period 3 can''t be booked any more'
);

select * from finish();
rollback;
