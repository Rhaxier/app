-- Moderation (B5): one queue of reported, hidden and removed content; removed
-- content disappears for everyone but admins and can be restored; dismissing
-- and removing resolve the reports; part of new test 1 (admins only).
begin;
create extension if not exists pgtap with schema extensions;
select plan(14);


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

-- A post's id, whoever we're acting as (even if they can't see it).
create function pg_temp.post_id(p_title text) returns uuid language sql stable security definer as $$
  select id from public.collab_posts where title like p_title;
$$;
grant execute on function pg_temp.post_id(text) to authenticated;

-- A student reports a post, and a teacher hides another.
select pg_temp.act_as('student.g8.b');
insert into public.content_reports (target_table, target_id, reason)
select 'collab_posts', id, 'Not a real project (sample)' from public.collab_posts where title like 'Calligraphy%';

select pg_temp.act_as('teacher.c');
update public.collab_posts set hidden_by = auth.uid(), hidden_reason = 'Checking (sample)'
where title like 'Coding club%';

-- ---------------------------------------------------------------------------
-- Admins only
-- ---------------------------------------------------------------------------
select throws_ok($$ select * from public.admin_moderation_queue() $$,
  '42501', 'Only admins can see the moderation queue.', 'A teacher cannot read the moderation queue');
select throws_ok(
  $$ select public.admin_moderate('remove', 'collab_posts', (select id from public.collab_posts where title like 'Calligraphy%')) $$,
  '42501', 'Only admins can moderate.', 'A teacher cannot remove content');

select pg_temp.act_as('student.g8.a');
update public.collab_posts set removed_at = now() where owner_id = auth.uid();
select ok(
  not exists (select 1 from public.collab_posts where owner_id = auth.uid() and removed_at is not null),
  'Writing removed_at directly is ignored: only moderation can remove'
);

-- ---------------------------------------------------------------------------
-- The queue shows reported content inline, with who reported it and why
-- ---------------------------------------------------------------------------
select pg_temp.act_as('admin.plain');

select is(
  (select title || ' / ' || author_name || ' / ' || reporter_name || ' / ' || reason
   from public.admin_moderation_queue() where kind = 'reported'),
  'Calligraphy mural for the courtyard (sample) / Student Grade 8 A / Student Grade 8 B / Not a real project (sample)',
  'A report shows the content, its author, the reporter and the reason'
);
select is(
  (select title from public.admin_moderation_queue() where kind = 'hidden'),
  'Coding club website (sample)',
  'Posts hidden by a teacher are in the queue'
);

-- ---------------------------------------------------------------------------
-- Remove, then restore
-- ---------------------------------------------------------------------------
select lives_ok(
  $$ select public.admin_moderate('remove', 'collab_posts',
       (select id from public.collab_posts where title like 'Calligraphy%'), 'Off-topic (sample)') $$,
  'An admin removes the reported post'
);
select is(
  (select status::text from public.content_reports where reason = 'Not a real project (sample)'),
  'actioned',
  'Removing it marks its report actioned'
);
select ok(exists (select 1 from public.audit_log where action = 'content_removed'),
  'The removal is in the audit log');

select pg_temp.act_as('student.g8.a');
select ok(not exists (select 1 from public.collab_posts where title like 'Calligraphy%'),
  'The removed post disappears, even for its author');
select pg_temp.act_as('student.g10.b');
select throws_ok(
  $$ insert into public.join_requests (post_id) values (pg_temp.post_id('Calligraphy%')) $$,
  'P0001', 'This has been removed by a moderator.',
  'Nobody can ask to join a removed post, even knowing its id'
);

select pg_temp.act_as('admin.plain');
select is((select count(*)::int from public.admin_moderation_queue() where kind = 'removed'), 1,
  'Removed content is listed, so it can be restored');
select public.admin_moderate('restore', 'collab_posts', (select id from public.collab_posts where title like 'Calligraphy%'));

select pg_temp.act_as('student.g8.a');
select ok(exists (select 1 from public.collab_posts where title like 'Calligraphy%'),
  'Restoring brings it back');

-- ---------------------------------------------------------------------------
-- Announcements can be removed too; reports can be dismissed
-- ---------------------------------------------------------------------------
select pg_temp.act_as('admin.plain');
select public.admin_moderate('remove', 'announcements',
  (select id from public.announcements where title like 'Club fair%'), 'Duplicate (sample)');
select pg_temp.act_as('student.g10.a');
select ok(not exists (select 1 from public.announcements where title like 'Club fair%'),
  'A removed announcement disappears for students');

select pg_temp.act_as('student.g10.b');
insert into public.content_reports (target_table, target_id, reason)
select 'announcements', id, 'Typo (sample)' from public.announcements where title like 'Library opening%';
select pg_temp.act_as('admin.plain');
select public.admin_moderate('dismiss', p_report_id => (select id from public.content_reports where reason = 'Typo (sample)'));
select is((select status::text from public.content_reports where reason = 'Typo (sample)'), 'dismissed',
  'Dismissing a report closes it without touching the content');

select * from finish();
rollback;
