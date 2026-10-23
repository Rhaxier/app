-- Collab finder. Covers required tests:
--   10. when accepted = spots_wanted, the post becomes full and pending
--       requests are declined with notifications
--   11. requester emails on a post are readable by its owner and staff only
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

-- A fresh post wanting two people, and three requests for it.
select pg_temp.act_as('student.g10.b');
insert into public.collab_posts (title, skills, spots_wanted)
values ('Test team (sample)', '{Coding}', 2);

select throws_ok(
  $$ insert into public.join_requests (post_id)
     select id from public.collab_posts where title = 'Test team (sample)' $$,
  'P0001', 'This is your own post.',
  'An owner cannot ask to join their own post'
);

select pg_temp.act_as('student.g8.a');
insert into public.join_requests (post_id, message)
select id, 'I can help' from public.collab_posts where title = 'Test team (sample)';

select throws_ok(
  $$ insert into public.join_requests (post_id)
     select id from public.collab_posts where title = 'Test team (sample)' $$,
  '23505', null,
  'Only one request per person per post'
);

select pg_temp.act_as('student.g8.b');
insert into public.join_requests (post_id) select id from public.collab_posts where title = 'Test team (sample)';
select pg_temp.act_as('student.g12.a');
insert into public.join_requests (post_id) select id from public.collab_posts where title = 'Test team (sample)';

select pg_temp.act_as_owner();

select is(
  (select count(*)::int from public.notifications
   where recipient_id = pg_temp.uid('student.g10.b') and type = 'collab_request_new'
     and title like '%Test team (sample)'),
  3,
  'The owner is notified of each request'
);

-- ---------------------------------------------------------------------------
-- Required test 11: contact emails
-- ---------------------------------------------------------------------------
select pg_temp.act_as('student.g10.b');

select is(
  (select count(*)::int from public.collab_requests(
     (select id from public.collab_posts where title = 'Test team (sample)')) where email like '%@dev.local'),
  3,
  'The owner sees every requester''s school email'
);

select pg_temp.act_as('teacher.c');

select is(
  (select count(*)::int from public.collab_requests(
     (select id from public.collab_posts where title = 'Test team (sample)')) where email is not null),
  3,
  'Staff see requester emails too'
);

select pg_temp.act_as('student.g8.a');

select throws_ok(
  $$ select * from public.collab_requests(
       (select id from public.collab_posts where title = 'Test team (sample)')) $$,
  '42501', 'Only the post''s owner and staff can see requests.',
  'A requester cannot see the other requesters'' emails'
);

select is(
  (select count(*)::int from public.join_requests r
   join public.collab_posts p on p.id = r.post_id where p.title = 'Test team (sample)'),
  1,
  'A requester sees only their own request'
);

select throws_ok(
  $$ select * from public.collab_team((select id from public.collab_posts where title = 'Test team (sample)')) $$,
  '42501', 'Only the team and staff can see the team list.',
  'Before being accepted, a requester cannot see the team list'
);

-- ---------------------------------------------------------------------------
-- Required test 10: accept two, the post fills, the third is declined
-- ---------------------------------------------------------------------------
select pg_temp.act_as('student.g10.b');

select lives_ok(
  $$ update public.join_requests set status = 'accepted'
     where requester_id in (pg_temp.uid('student.g8.a'), pg_temp.uid('student.g8.b'))
       and post_id = (select id from public.collab_posts where title = 'Test team (sample)') $$,
  'The owner accepts two requests'
);

select is(
  (select status::text from public.collab_posts where title = 'Test team (sample)'),
  'full',
  'Accepted count reached spots_wanted, so the post is full'
);

select is(
  (select status::text from public.join_requests
   where requester_id = pg_temp.uid('student.g12.a')
     and post_id = (select id from public.collab_posts where title = 'Test team (sample)')),
  'declined',
  'The remaining pending request was declined'
);

select pg_temp.act_as_owner();

select ok(
  exists (
    select 1 from public.notifications
    where recipient_id = pg_temp.uid('student.g12.a') and type = 'collab_request_declined'
      and title = 'Update on Test team (sample)' and body like '%This team is now full.%'
  ) and exists (
    select 1 from public.notifications
    where recipient_id = pg_temp.uid('student.g8.a') and type = 'collab_request_accepted'
      and title = 'You''re on the team for Test team (sample)'
  ),
  'The declined requester and the accepted ones are notified'
);

select pg_temp.act_as('student.g8.a');

select is(
  (select count(*)::int from public.collab_team(
     (select id from public.collab_posts where title = 'Test team (sample)')) where email is not null),
  3,
  'An accepted member sees the team list with emails (owner + 2)'
);

select pg_temp.act_as('student.g10.b');

select throws_ok(
  $$ update public.join_requests set status = 'accepted'
     where requester_id = pg_temp.uid('student.g12.a')
       and post_id = (select id from public.collab_posts where title = 'Test team (sample)') $$,
  'P0001', 'This team is already full.',
  'Nobody else can be accepted while full'
);

update public.collab_posts set spots_wanted = 3 where title = 'Test team (sample)';

select is(
  (select status::text from public.collab_posts where title = 'Test team (sample)'),
  'open',
  'Raising spots_wanted reopens the post'
);

-- ---------------------------------------------------------------------------
-- Moderation
-- ---------------------------------------------------------------------------
select pg_temp.act_as('teacher.c');
update public.collab_posts set hidden_by = auth.uid(), hidden_reason = 'Checking (sample)'
where title = 'Test team (sample)';

select pg_temp.act_as('student.g12.a');

select is(
  (select count(*)::int from public.collab_posts where title = 'Test team (sample)'),
  0,
  'A post a teacher hid disappears for other students'
);

select pg_temp.act_as('student.g10.b');

select throws_ok(
  $$ update public.collab_posts set hidden_by = null where title = 'Test team (sample)' $$,
  'P0001', 'A teacher is reviewing this post.',
  'The owner still sees it but cannot unhide it'
);

select * from finish();
rollback;
