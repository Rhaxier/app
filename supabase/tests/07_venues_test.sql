-- Venue booking. Covers required tests:
--   7. two overlapping approved bookings for one venue fail, even in separate
--      transactions
--   8. approving a booking auto-rejects overlapping pending ones and notifies
--   9. a non-venues teacher can't approve a booking
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
-- Required test 7: no double bookings
-- ---------------------------------------------------------------------------
-- The guarantee is an exclusion constraint (contype 'x'). Postgres enforces
-- it across transactions: a second transaction inserting a clashing approved
-- row waits for the first to finish, then fails. So checking the constraint
-- exists, plus one clash inside this transaction, proves the rule.
select is(
  (select contype::text from pg_constraint where conname = 'bookings_no_double_booking'),
  'x',
  'bookings has an exclusion constraint on approved bookings'
);

select pg_temp.act_as_owner();
insert into public.bookings (id, venue_id, requester_id, title, starts_at, ends_at)
values ('e0000000-0000-4000-8000-000000000001',
        (select id from public.venues where name = 'Lab 1 (placeholder)'),
        pg_temp.uid('teacher.b'), 'First (sample)',
        '2030-01-06 09:00+04', '2030-01-06 10:30+04');
update public.bookings set status = 'approved' where id = 'e0000000-0000-4000-8000-000000000001';

insert into public.bookings (id, venue_id, requester_id, title, starts_at, ends_at)
values ('e0000000-0000-4000-8000-000000000002',
        (select id from public.venues where name = 'Lab 1 (placeholder)'),
        pg_temp.uid('teacher.c'), 'Second (sample)',
        '2030-01-06 10:00+04', '2030-01-06 11:00+04');

select throws_ok(
  $$ update public.bookings set status = 'approved' where id = 'e0000000-0000-4000-8000-000000000002' $$,
  '23P01', null,
  'A second overlapping approved booking is refused by the database itself'
);

insert into public.bookings (venue_id, requester_id, title, starts_at, ends_at)
values ((select id from public.venues where name = 'Lab 1 (placeholder)'),
        pg_temp.uid('teacher.c'), 'Back to back (sample)',
        '2030-01-06 10:30+04', '2030-01-06 12:00+04');

select lives_ok(
  $$ update public.bookings set status = 'approved' where title = 'Back to back (sample)' $$,
  'Back-to-back bookings (one ends as the next starts) do not clash'
);

-- ---------------------------------------------------------------------------
-- Required test 9: only venue staff approve
-- ---------------------------------------------------------------------------
select pg_temp.act_as('teacher.c');

select throws_ok(
  $$ update public.bookings set status = 'approved' where title = 'Drama rehearsal (sample)' $$,
  'P0001', 'Only venue approvers can approve or reject bookings.',
  'A teacher without the venues responsibility cannot approve (even their own request)'
);

select pg_temp.act_as('teacher.b');
update public.bookings set status = 'approved' where title = 'Drama rehearsal (sample)';

select pg_temp.act_as_owner();

select is(
  (select status::text from public.bookings where title = 'Drama rehearsal (sample)'),
  'pending',
  'A teacher not involved cannot touch it at all'
);

-- ---------------------------------------------------------------------------
-- Required test 8: approving rejects the clashes and tells everyone
-- ---------------------------------------------------------------------------
select pg_temp.act_as('admin.venues');

select lives_ok(
  $$ update public.bookings set status = 'approved', review_note = 'Enjoy'
     where title = 'Debate club practice (sample)' $$,
  'A venue approver approves a booking'
);

select pg_temp.act_as_owner();

select is(
  (select status::text || ' / ' || review_note from public.bookings where title = 'Robotics demo (sample)'),
  'rejected / Slot taken: another booking for this venue was approved for this time.',
  'The overlapping pending request was rejected automatically'
);

select ok(
  exists (
    select 1 from public.notifications
    where recipient_id = pg_temp.uid('student.g12.a') and type = 'booking_rejected'
      and title = 'Booking not approved: Robotics demo (sample)'
  ),
  'Its requester was told the slot was taken'
);

select ok(
  exists (
    select 1 from public.notifications
    where recipient_id = pg_temp.uid('teacher.b') and type = 'booking_approved'
      and title = 'Booking approved: Debate club practice (sample)'
  ),
  'The approved requester was told'
);

-- ---------------------------------------------------------------------------
-- Student requests (Q2)
-- ---------------------------------------------------------------------------
select pg_temp.act_as('student.g10.b');

select throws_ok(
  $$ insert into public.bookings (venue_id, title, starts_at, ends_at)
     values ((select id from public.venues where name = 'MPH (placeholder)'), 'No teacher (sample)',
             '2030-01-07 09:00+04', '2030-01-07 10:00+04') $$,
  'P0001', 'Choose the teacher who will supervise.',
  'A student request must name a supervising teacher'
);

insert into public.bookings (venue_id, supervising_teacher_id, title, starts_at, ends_at)
values ((select id from public.venues where name = 'MPH (placeholder)'), pg_temp.uid('teacher.c'),
        'Student request (sample)', '2030-01-07 09:00+04', '2030-01-07 10:00+04');

select is(
  (select status::text from public.bookings where title = 'Student request (sample)'),
  'awaiting_teacher',
  'A student request waits for the supervising teacher'
);

select throws_ok(
  $$ select purpose from public.bookings $$,
  '42501', null,
  'Nobody reads booking purposes straight from the table'
);

select is(
  (select count(*)::int from public.booking_details() where requester_id <> auth.uid()),
  0,
  'booking_details() shows a student only their own requests'
);

select pg_temp.act_as('teacher.c');

select lives_ok(
  $$ update public.bookings set status = 'pending' where title = 'Student request (sample)' $$,
  'The supervising teacher confirms it'
);

select pg_temp.act_as_owner();

select ok(
  exists (
    select 1 from public.email_outbox o join public.notifications n on n.id = o.notification_id
    where o.recipient_id = pg_temp.uid('admin.venues') and o.kind = 'immediate'
      and n.type = 'booking_pending' and n.title = 'Venue request: Student request (sample)'
  ),
  'Venue approvers are notified with an immediate email'
);

update public.app_settings set students_can_request_venues = false;
select pg_temp.act_as('student.g10.b');

select throws_ok(
  $$ insert into public.bookings (venue_id, supervising_teacher_id, title, starts_at, ends_at)
     values ((select id from public.venues where name = 'MPH (placeholder)'), pg_temp.uid('teacher.c'),
             'Not allowed (sample)', '2030-01-08 09:00+04', '2030-01-08 10:00+04') $$,
  'P0001', 'Students can''t request venues at the moment. Ask a teacher to book it for you.',
  'With students_can_request_venues off, students cannot request'
);

select pg_temp.act_as('teacher.a');
insert into public.bookings (venue_id, title, starts_at, ends_at)
values ((select id from public.venues where name = 'Meeting room (placeholder)'),
        'Quick meeting (sample)', '2030-01-08 09:00+04', '2030-01-08 10:00+04');

select is(
  (select status::text from public.booking_details() where title = 'Quick meeting (sample)'),
  'approved',
  'A venue that needs no approval approves a free slot automatically'
);

select * from finish();
rollback;
