-- System (B7). Covers new tests:
--    7. with a feature switched off, inserts for that feature fail for
--       non-admins
--   12. anonymising a user removes personal details but keeps confirmed SUPW
--       hour totals
-- plus branding (accent contrast), the maintenance message, exports.
begin;
create extension if not exists pgtap with schema extensions;
select plan(20);


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
-- New test 7: feature switches
-- ---------------------------------------------------------------------------
select pg_temp.act_as('teacher.a');
update public.feature_flags set enabled = false where feature = 'collab';
select is((select enabled from public.feature_flags where feature = 'collab'), true,
  'A teacher cannot flip a feature switch (the update changes nothing)');

select pg_temp.act_as('admin.plain');
update public.feature_flags set enabled = false where feature in ('collab', 'fixit', 'venues');

select pg_temp.act_as('student.g8.b');
select throws_ok($$ insert into public.collab_posts (title, skills, spots_wanted) values ('Off', '{Coding}', 2) $$,
  'P0001', 'Collab is switched off at the moment. Existing content can still be read.',
  'With collab off, a student cannot create a post');
select throws_like($$ insert into public.join_requests (post_id) select id from public.collab_posts where title like 'Calligraphy%' $$,
  'Collab is switched off%', '…or ask to join one');
select throws_like($$ insert into public.reports (room_id, category, description)
     values ((select id from public.rooms where code = 'G.04'), 'other', 'Off (sample)') $$,
  'Fix-it reports is switched off%', 'With fix-it off, nobody but admins can report');
select ok(exists (select 1 from public.collab_posts), 'Existing content can still be read');

select pg_temp.act_as('teacher.b');
select throws_like($$ insert into public.bookings (venue_id, title, starts_at, ends_at)
     values ((select id from public.venues where name = 'Lab 1 (placeholder)'), 'Off', now() + interval '3 days', now() + interval '3 days 1 hour') $$,
  'Venue booking is switched off%', 'With venues off, a teacher cannot request a booking');
select lives_ok($$ insert into public.announcements (title, audience, grades) values ('Still on (sample)', 'grades', '{8}') $$,
  'Features that are on carry on as normal');

select pg_temp.act_as('admin.plain');
select lives_ok($$ insert into public.collab_posts (title, skills, spots_wanted) values ('Admin test (sample)', '{Coding}', 2) $$,
  'Admins can still add content to a switched-off feature');

-- ---------------------------------------------------------------------------
-- Branding and maintenance
-- ---------------------------------------------------------------------------
select throws_like($$ update public.app_settings set accent_color = '#7fd1c1' $$,
  'White text on #7fd1c1 has a contrast of only %:1; it needs at least 4.5:1%',
  'A light accent colour is refused, with the reason');
select lives_ok($$ update public.app_settings set accent_color = '#1F4E79' $$, 'A dark enough one is accepted');
select is((select accent_color from public.app_settings), '#1f4e79', 'and stored in lower case');
select is(public.contrast_with_white('#0e6857'), 6.70, 'The default teal has 6.7:1 with white');

update public.app_settings set maintenance_enabled = true,
  maintenance_message = 'Upgrade tonight from 20:00 (sample)', maintenance_until = now() + interval '1 day';

select pg_temp.act_as_owner();
-- Act as a signed-out visitor (pgTAP itself must be usable by that role too).
grant usage on schema extensions to anon;
grant execute on all functions in schema extensions to anon;
set local role anon;
select is((select maintenance_message from public.public_status()), 'Upgrade tonight from 20:00 (sample)',
  'Even signed-out visitors (the sign-in screen) get the maintenance message');
reset role;
update public.app_settings set maintenance_until = now() - interval '1 minute';
select is((select maintenance_message from public.public_status()), null, 'It stops showing after its end time');

-- ---------------------------------------------------------------------------
-- New test 12: anonymising someone (Student Grade 12 A has 1 confirmed hour).
-- Their seeded id is used directly: their email (which uid() looks up) changes.
-- ---------------------------------------------------------------------------
select pg_temp.act_as('admin.plain');
select throws_ok(
  $$ select public.admin_anonymise_user('a0000000-0000-4000-8000-000000000121'::uuid, 'student.g12.b@dev.local') $$,
  'P0001', 'Type their email address exactly, to confirm.', 'It needs the person''s own email typed in');
select lives_ok(
  $$ select public.admin_anonymise_user('a0000000-0000-4000-8000-000000000121'::uuid, 'Student.G12.A@dev.local') $$,
  'With the right email, it runs');

select pg_temp.act_as_owner();
select is(
  (select full_name || ' / ' || email from public.profiles where id = 'a0000000-0000-4000-8000-000000000121'::uuid),
  'Deleted user / deleted-' || 'a0000000-0000-4000-8000-000000000121'::uuid || '@deleted.invalid',
  'Their name and email are replaced'
);
select is(
  (select sum(hours_confirmed) from public.role_signups where student_id = 'a0000000-0000-4000-8000-000000000121'::uuid),
  1.0,
  'Their confirmed SUPW hours are kept'
);
select ok(
  (select banned_until > now() + interval '100 years' and email like 'deleted-%' from auth.users where id = 'a0000000-0000-4000-8000-000000000121'::uuid)
  and not exists (select 1 from auth.identities where user_id = 'a0000000-0000-4000-8000-000000000121'::uuid),
  'They can no longer sign in'
);
select ok(
  exists (select 1 from public.audit_log where action = 'user_anonymised' and details = '{}'::jsonb),
  'The audit log records it, without their name or email'
);

select * from finish();
rollback;
