-- =============================================================================
-- Seed data for development. ALL OF IT IS FAKE.
--
-- Loaded by `supabase db reset` (and `supabase db push --include-seed`).
-- Every user signs in with password `devpass123`. Names are generic, places
-- are marked (placeholder), and content is marked (sample).
--
-- Dates are relative to today (Dubai time) and land on school days
-- (app_settings.school_days), so the calendar always has something to show.
--
-- This runs as the database owner with no signed-in user, so the "who may do
-- this" checks in triggers are skipped, but notifications still fire: the
-- inbox starts with realistic content.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Helpers (pg_temp = temporary, gone when the seed finishes)
-- -----------------------------------------------------------------------------

create function pg_temp.create_dev_user(
  p_id uuid, p_email text, p_name text, p_grade int, p_section text
)
returns void
language plpgsql
as $$
begin
  -- The empty strings matter: Supabase Auth expects these token columns to be
  -- '' rather than null for email + password sign-in to work.
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) values (
    '00000000-0000-0000-0000-000000000000', p_id, 'authenticated', 'authenticated', p_email,
    extensions.crypt('devpass123', extensions.gen_salt('bf')), now(),
    '{"provider": "email", "providers": ["email"]}',
    jsonb_build_object('full_name', p_name, 'grade', p_grade, 'section', p_section),
    now(), now(), '', '', '', ''
  );
  insert into auth.identities (
    id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
  ) values (
    gen_random_uuid(), p_id, p_id::text,
    jsonb_build_object('sub', p_id::text, 'email', p_email, 'email_verified', true),
    'email', now(), now(), now()
  );
end;
$$;

-- pg_temp.u('student.g10.a') = that user's id.
create function pg_temp.u(p_short text)
returns uuid
language sql
as $$
  select id from auth.users where email = p_short || '@dev.local';
$$;

create function pg_temp.room(p_code text)
returns uuid
language sql
as $$
  select id from public.rooms where code = p_code;
$$;

create function pg_temp.venue(p_name text)
returns uuid
language sql
as $$
  select id from public.venues where name = p_name;
$$;

-- The school day `p_offset` school days from today (0 = today, or the next
-- school day if today isn't one; -1 = the previous school day).
create function pg_temp.school_day(p_offset int)
returns date
language plpgsql
as $$
declare
  v_days int[] := (select school_days from public.app_settings);
  v_date date := (now() at time zone 'Asia/Dubai')::date;
  v_step int := case when p_offset < 0 then -1 else 1 end;
  v_left int := abs(p_offset);
begin
  while not (extract(dow from v_date)::int = any (v_days)) loop
    v_date := v_date + 1;
  end loop;
  while v_left > 0 loop
    v_date := v_date + v_step;
    if extract(dow from v_date)::int = any (v_days) then
      v_left := v_left - 1;
    end if;
  end loop;
  return v_date;
end;
$$;

-- pg_temp.at(1, '10:30') = 10:30 Dubai time on the next school day.
create function pg_temp.at(p_offset int, p_time text)
returns timestamptz
language sql
as $$
  select (pg_temp.school_day(p_offset) + p_time::time) at time zone 'Asia/Dubai';
$$;

-- -----------------------------------------------------------------------------
-- People
-- -----------------------------------------------------------------------------

-- Staff emails first, so the sign-up trigger makes these accounts teachers.
insert into public.staff_emails (email) values
  ('teacher.a@dev.local'),
  ('teacher.b@dev.local'),
  ('teacher.c@dev.local'),
  ('admin.facilities@dev.local'),
  ('admin.venues@dev.local'),
  ('admin.plain@dev.local');

select pg_temp.create_dev_user('a0000000-0000-4000-8000-000000000081', 'student.g8.a@dev.local', 'Student Grade 8 A', 8, 'A');
select pg_temp.create_dev_user('a0000000-0000-4000-8000-000000000082', 'student.g8.b@dev.local', 'Student Grade 8 B', 8, 'B');
select pg_temp.create_dev_user('a0000000-0000-4000-8000-000000000101', 'student.g10.a@dev.local', 'Student Grade 10 A', 10, 'A');
select pg_temp.create_dev_user('a0000000-0000-4000-8000-000000000102', 'student.g10.b@dev.local', 'Student Grade 10 B', 10, 'B');
select pg_temp.create_dev_user('a0000000-0000-4000-8000-000000000121', 'student.g12.a@dev.local', 'Student Grade 12 A', 12, 'A');
select pg_temp.create_dev_user('a0000000-0000-4000-8000-000000000122', 'student.g12.b@dev.local', 'Student Grade 12 B', 12, 'B');
select pg_temp.create_dev_user('b0000000-0000-4000-8000-00000000000a', 'teacher.a@dev.local', 'Teacher A', null, null);
select pg_temp.create_dev_user('b0000000-0000-4000-8000-00000000000b', 'teacher.b@dev.local', 'Teacher B', null, null);
select pg_temp.create_dev_user('b0000000-0000-4000-8000-00000000000c', 'teacher.c@dev.local', 'Teacher C', null, null);
select pg_temp.create_dev_user('c0000000-0000-4000-8000-000000000001', 'admin.facilities@dev.local', 'Admin Facilities', null, null);
select pg_temp.create_dev_user('c0000000-0000-4000-8000-000000000002', 'admin.venues@dev.local', 'Admin Venues', null, null);
select pg_temp.create_dev_user('c0000000-0000-4000-8000-000000000003', 'admin.plain@dev.local', 'Admin Plain', null, null);

-- The very first admins are set directly, as the plan says (in the dashboard
-- for a real school). After that, admins use the Users screen.
update public.profiles set role = 'admin' where email like 'admin.%@dev.local';

insert into public.responsibilities (user_id, kind) values
  (pg_temp.u('teacher.a'), 'supw'),
  (pg_temp.u('admin.facilities'), 'facilities'),
  (pg_temp.u('admin.facilities'), 'it'),
  (pg_temp.u('admin.venues'), 'venues');

-- -----------------------------------------------------------------------------
-- School structure: three grades with two sections each, and a few classes.
-- (The migration starts a school with grades 1 to 12; the sample has three.)
-- -----------------------------------------------------------------------------
delete from public.grades where grade not in (8, 10, 12);

insert into public.sections (grade, name) values
  (8, 'A'), (8, 'B'), (10, 'A'), (10, 'B'), (12, 'A'), (12, 'B')
on conflict do nothing;

insert into public.classes (name, subject, grade, section_id) values
  ('10 A Physics (sample)', 'Physics', 10,
   (select id from public.sections where grade = 10 and name = 'A')),
  ('Grade 8 English (sample)', 'English', 8, null),
  ('12 B Computer Science (sample)', 'Computer Science', 12,
   (select id from public.sections where grade = 12 and name = 'B'));

insert into public.class_teachers (class_id, teacher_id)
select c.id, pg_temp.u(t.who)
from (values
  ('10 A Physics (sample)', 'teacher.a'),
  ('Grade 8 English (sample)', 'teacher.b'),
  ('12 B Computer Science (sample)', 'teacher.c')
) as t(class_name, who)
join public.classes c on c.name = t.class_name;

insert into public.class_students (class_id, student_id)
select c.id, pg_temp.u(t.who)
from (values
  ('10 A Physics (sample)', 'student.g10.a'),
  ('Grade 8 English (sample)', 'student.g8.a'),
  ('Grade 8 English (sample)', 'student.g8.b'),
  ('12 B Computer Science (sample)', 'student.g12.b')
) as t(class_name, who)
join public.classes c on c.name = t.class_name;

-- -----------------------------------------------------------------------------
-- Map: three placeholder floors (images in public/floorplans/) and rooms.
-- Coordinates are pixels on the 1000 x 700 placeholder images.
-- -----------------------------------------------------------------------------
insert into public.floors (name, sort_order, image_path, width, height) values
  ('G', 0, '/floorplans/floor-g.svg', 1000, 700),
  ('1', 1, '/floorplans/floor-1.svg', 1000, 700),
  ('2', 2, '/floorplans/floor-2.svg', 1000, 700);

insert into public.rooms (floor_id, code, name, kind, x, y)
select f.id, r.code, r.name, r.kind::public.room_kind, r.x, r.y
from (values
  ('G', 'G.01', 'Auditorium (placeholder)', 'hall', 220, 170),
  ('G', 'G.02', 'Admin office (placeholder)', 'office', 700, 100),
  ('G', 'G.03', 'Classroom G.03 (placeholder)', 'classroom', 560, 245),
  ('G', 'G.04', 'Classroom G.04 (placeholder)', 'classroom', 830, 245),
  ('G', 'G.05', 'Library (placeholder)', 'library', 185, 545),
  ('G', 'G.06', 'Lab 1 (placeholder)', 'lab', 500, 485),
  ('G', 'G.07', 'Lab 2 (placeholder)', 'lab', 500, 610),
  ('G', 'G.08', 'Cafeteria (placeholder)', 'cafeteria', 815, 545),
  ('1', '1.01', 'Classroom 1.01 (placeholder)', 'classroom', 220, 170),
  ('1', '1.02', 'Classroom 1.02 (placeholder)', 'classroom', 700, 170),
  ('1', '1.03', 'Computer lab (placeholder)', 'lab', 220, 545),
  ('1', '1.04', 'Meeting room (placeholder)', 'office', 700, 545),
  ('2', '2.01', 'Multipurpose hall (placeholder)', 'hall', 350, 200),
  ('2', '2.02', 'Art room (placeholder)', 'classroom', 815, 200),
  ('2', '2.03', 'Music room (placeholder)', 'other', 500, 545)
) as r(floor, code, name, kind, x, y)
join public.floors f on f.name = r.floor;

insert into public.venues (name, room_id, capacity, needs_approval) values
  ('Auditorium (placeholder)', pg_temp.room('G.01'), 300, true),
  ('MPH (placeholder)', pg_temp.room('2.01'), 200, true),
  ('Lab 1 (placeholder)', pg_temp.room('G.06'), 30, true),
  ('Meeting room (placeholder)', pg_temp.room('1.04'), 12, false);

-- -----------------------------------------------------------------------------
-- Announcements: five, one pinned.
-- -----------------------------------------------------------------------------
insert into public.announcements (author_id, posted_as, title, body, audience, grades, pinned, published_at) values
  (pg_temp.u('admin.plain'), 'Admin office (placeholder)',
   'Welcome to the school app (sample)',
   'This is sample content for testing. Pinned announcements stay at the top of everyone''s feed.',
   'school', null, true, now() - interval '2 hours'),
  (pg_temp.u('teacher.a'), 'Science Department (placeholder)',
   'Science fair submissions close soon (sample)',
   'Share your project with your teacher in the app before the deadline.',
   'grades', '{10,12}', false, now() - interval '1 day'),
  (pg_temp.u('admin.plain'), 'Student Council (placeholder)',
   'Club fair this week (sample)',
   'Find out about clubs in the MPH (placeholder) during break.',
   'school', null, false, now() - interval '3 days'),
  (pg_temp.u('teacher.b'), null,
   'Grade 8 trip forms due (sample)',
   'Hand in your signed form to your class teacher.',
   'grades', '{8}', false, now() - interval '4 days'),
  (pg_temp.u('admin.venues'), null,
   'Library opening hours (sample)',
   'Placeholder text: the school will confirm the real hours.',
   'school', null, false, now() - interval '6 days');

-- -----------------------------------------------------------------------------
-- Content that needs ids from earlier inserts.
-- -----------------------------------------------------------------------------
do $$
declare
  v_event uuid;
  v_role_desk uuid;
  v_role_crew uuid;
  v_role_photo uuid;
  v_role uuid;
  v_role2 uuid;
  v_project uuid;
  v_post uuid;
  v_booking uuid;
  v_report uuid;
begin
  -- ---------------------------------------------------------------------------
  -- SUPW volunteering: four events.
  -- ---------------------------------------------------------------------------

  -- 1. Staff event, roles filling up, one role full (so a waitlist exists).
  insert into public.volunteer_events (
    creator_id, organiser_label, title, description, starts_at, ends_at, place_text,
    supw_hours, signup_deadline, allow_multiple_roles
  ) values (
    pg_temp.u('teacher.a'), 'Environment Club (placeholder)', 'Beach clean-up (sample)',
    'Help clean the beach. Bring a hat and water. Transport details are placeholders.',
    pg_temp.at(5, '07:00'), pg_temp.at(5, '10:00'), 'Bus leaves from main gate (placeholder)',
    3, pg_temp.at(4, '18:00'), false
  ) returning id into v_event;

  insert into public.event_roles (event_id, name, description, spots_wanted)
  values (v_event, 'Registration desk', 'Sign people in and hand out gloves.', 2)
  returning id into v_role_desk;
  insert into public.event_roles (event_id, name, description, spots_wanted)
  values (v_event, 'Clean-up crew', 'Collect litter along the shore.', 6)
  returning id into v_role_crew;
  insert into public.event_roles (event_id, name, description, spots_wanted)
  values (v_event, 'Photographer', 'Take photos for the school newsletter.', 1)
  returning id into v_role_photo;

  insert into public.role_signups (role_id, student_id, note) values
    (v_role_desk, pg_temp.u('student.g10.a'), 'I did this last year.'),
    (v_role_crew, pg_temp.u('student.g10.b'), null),
    (v_role_crew, pg_temp.u('student.g8.a'), 'Can I come with a friend?'),
    (v_role_photo, pg_temp.u('student.g12.a'), 'I have my own camera.'),
    (v_role_photo, pg_temp.u('student.g12.b'), null);
  -- Selecting the only photographer fills that role, so Grade 12 B is waitlisted.
  update public.role_signups set status = 'selected'
  where role_id = v_role_desk and student_id = pg_temp.u('student.g10.a');
  update public.role_signups set status = 'selected'
  where role_id = v_role_photo and student_id = pg_temp.u('student.g12.a');

  -- 2. Staff event that allows more than one role per student.
  insert into public.volunteer_events (
    creator_id, organiser_label, title, description, starts_at, ends_at, room_id,
    supw_hours, allow_multiple_roles
  ) values (
    pg_temp.u('teacher.b'), 'Community Service (placeholder)', 'Food drive packing (sample)',
    'Pack donated food into boxes for a partner charity (placeholder).',
    pg_temp.at(9, '09:00'), pg_temp.at(9, '12:00'), pg_temp.room('G.08'),
    3, true
  ) returning id into v_event;
  insert into public.event_roles (event_id, name, description, spots_wanted)
  values (v_event, 'Packing', 'Sort and pack boxes.', 5)
  returning id into v_role;
  insert into public.event_roles (event_id, name, description, spots_wanted)
  values (v_event, 'Loading', 'Carry boxes to the van.', 2)
  returning id into v_role2;
  insert into public.role_signups (role_id, student_id) values
    (v_role, pg_temp.u('student.g8.b')),
    (v_role2, pg_temp.u('student.g8.b'));

  -- 3. A past event: attendance marked, one student's hours confirmed and one
  --    waiting for Teacher A to confirm (shows in their Approvals tab).
  insert into public.volunteer_events (
    creator_id, organiser_label, title, description, starts_at, ends_at, room_id, supw_hours
  ) values (
    pg_temp.u('teacher.a'), 'Reading Buddies (placeholder)', 'Reading buddies (sample)',
    'Read with younger students during break.',
    pg_temp.at(-5, '10:00'), pg_temp.at(-5, '11:00'), pg_temp.room('G.05'), 1
  ) returning id into v_event;
  insert into public.event_roles (event_id, name, description, spots_wanted)
  values (v_event, 'Reader', 'Read aloud with a small group.', 3)
  returning id into v_role;
  insert into public.role_signups (role_id, student_id, status, attended, hours_confirmed, confirmed_by, confirmed_at) values
    (v_role, pg_temp.u('student.g10.a'), 'selected', true, null, null, null),
    (v_role, pg_temp.u('student.g12.a'), 'selected', true, 1, pg_temp.u('teacher.a'), now() - interval '3 days'),
    (v_role, pg_temp.u('student.g8.a'), 'selected', false, null, null, null);

  -- 4. A student-created event waiting for a teacher to approve it.
  insert into public.volunteer_events (
    creator_id, organiser_label, title, description, starts_at, ends_at, room_id, supw_hours
  ) values (
    pg_temp.u('student.g12.a'), 'Grade 12 volunteers (placeholder)', 'Charity bake sale (sample)',
    'Sell baked goods at break to raise money for a charity (placeholder).',
    pg_temp.at(12, '12:00'), pg_temp.at(12, '13:30'), pg_temp.room('G.08'), 2
  ) returning id into v_event;
  insert into public.event_roles (event_id, name, description, spots_wanted) values
    (v_event, 'Baker', 'Bake something at home and bring it in.', 4),
    (v_event, 'Stall', 'Run the stall and handle the cash box.', 2);

  -- ---------------------------------------------------------------------------
  -- Projects: three, in the states the mockup shows.
  -- ---------------------------------------------------------------------------
  insert into public.projects (owner_id, title, subject, description)
  values (pg_temp.u('student.g10.a'), 'Solar-powered bus stop model (sample)', 'Physics',
          'A scale model of a bus stop with a solar panel that lights the shelter.')
  returning id into v_project;
  insert into public.project_shares (project_id, teacher_id) values (v_project, pg_temp.u('teacher.a'));
  insert into public.project_feedback (project_id, author_id, body)
  values (v_project, pg_temp.u('teacher.a'), 'Great start. Add your panel efficiency calculations before the fair.');

  insert into public.projects (owner_id, title, subject, description, link_url)
  values (pg_temp.u('student.g12.a'), 'History of the creek podcast (sample)', 'Social Studies',
          'A three-part podcast about the history of the creek.', 'https://example.com/podcast-sample')
  returning id into v_project;
  insert into public.project_shares (project_id, teacher_id) values (v_project, pg_temp.u('teacher.b'));
  update public.projects set status = 'in_review' where id = v_project;

  insert into public.projects (owner_id, title, subject, description)
  values (pg_temp.u('student.g10.a'), 'Traffic flow simulator (sample)', 'Computer Science',
          'Simulates traffic lights at a junction to find the best timings.');

  -- ---------------------------------------------------------------------------
  -- Collab finder: four posts, one full.
  -- ---------------------------------------------------------------------------
  insert into public.collab_posts (owner_id, title, description, skills, spots_wanted, created_at)
  values (pg_temp.u('student.g10.a'), 'Line-following robot for the STEM fair (sample)',
          'Building a small robot that follows a black line. Need help with the chassis and wiring.',
          '{CAD,Soldering}', 3, now() - interval '2 days')
  returning id into v_post;
  insert into public.join_requests (post_id, requester_id, message) values
    (v_post, pg_temp.u('student.g12.b'), 'I''ve done CAD in a design class.'),
    (v_post, pg_temp.u('student.g8.a'), 'I can solder, I learned at a summer camp.'),
    (v_post, pg_temp.u('student.g10.b'), 'Happy to help with anything.');
  update public.join_requests set status = 'accepted'
  where post_id = v_post and requester_id = pg_temp.u('student.g12.b');

  -- This one fills up: two accepted, so the third request is declined automatically.
  insert into public.collab_posts (owner_id, title, description, skills, spots_wanted, created_at)
  values (pg_temp.u('student.g12.a'), 'Student-run sustainability podcast (sample)',
          'A short podcast series about sustainability at school.',
          '{"Audio editing",Writing}', 2, now() - interval '5 days')
  returning id into v_post;
  insert into public.join_requests (post_id, requester_id, message) values
    (v_post, pg_temp.u('student.g10.a'), 'I edit videos, so audio should be fine.'),
    (v_post, pg_temp.u('student.g8.b'), 'I like writing scripts.'),
    (v_post, pg_temp.u('student.g12.b'), 'Can I host an episode?');
  update public.join_requests set status = 'accepted'
  where post_id = v_post and requester_id in (pg_temp.u('student.g10.a'), pg_temp.u('student.g8.b'));

  insert into public.collab_posts (owner_id, title, description, skills, spots_wanted, created_at)
  values (pg_temp.u('student.g8.a'), 'Calligraphy mural for the courtyard (sample)',
          'Designing a mural. Looking for people who like lettering and painting.',
          '{Design,Painting}', 4, now() - interval '8 days');

  insert into public.collab_posts (owner_id, title, description, skills, spots_wanted, supervising_teacher_id, created_at)
  values (pg_temp.u('student.g12.b'), 'Coding club website (sample)',
          'A simple website listing club meetings. Supervised by Teacher C.',
          '{Coding,Design}', 2, pg_temp.u('teacher.c'), now() - interval '1 day')
  returning id into v_post;
  insert into public.join_requests (post_id, requester_id, message)
  values (v_post, pg_temp.u('student.g10.b'), 'I know some HTML and CSS.');

  -- ---------------------------------------------------------------------------
  -- Venue bookings: every status, and two overlap cases.
  -- ---------------------------------------------------------------------------

  -- Approved (today, Auditorium).
  insert into public.bookings (venue_id, requester_id, title, purpose, expected_attendance, starts_at, ends_at)
  values (pg_temp.venue('Auditorium (placeholder)'), pg_temp.u('teacher.b'), 'Grade 10 assembly (sample)',
          'Weekly assembly.', 150, pg_temp.at(0, '09:00'), pg_temp.at(0, '10:30'))
  returning id into v_booking;
  update public.bookings set status = 'approved', reviewed_by = pg_temp.u('admin.venues') where id = v_booking;

  -- Pending (today, Auditorium).
  insert into public.bookings (venue_id, requester_id, title, purpose, expected_attendance, starts_at, ends_at)
  values (pg_temp.venue('Auditorium (placeholder)'), pg_temp.u('teacher.c'), 'Drama rehearsal (sample)',
          'Rehearsal for the end-of-term play.', 25, pg_temp.at(0, '12:00'), pg_temp.at(0, '13:30'));

  -- Overlap case still open: two requests for the same slot. Approving one
  -- (as Admin Venues) automatically rejects the other.
  insert into public.bookings (venue_id, requester_id, title, purpose, expected_attendance, starts_at, ends_at)
  values (pg_temp.venue('Auditorium (placeholder)'), pg_temp.u('teacher.b'), 'Debate club practice (sample)',
          'Practice round before the inter-school debate.', 20, pg_temp.at(1, '10:30'), pg_temp.at(1, '12:00'));
  insert into public.bookings (venue_id, requester_id, supervising_teacher_id, title, purpose, expected_attendance, starts_at, ends_at)
  values (pg_temp.venue('Auditorium (placeholder)'), pg_temp.u('student.g12.a'), pg_temp.u('teacher.a'),
          'Robotics demo (sample)', 'Show the robotics project to younger grades.', 60,
          pg_temp.at(1, '10:30'), pg_temp.at(1, '12:00'))
  returning id into v_booking;
  -- Teacher A has confirmed the student's request, so it's now pending too.
  update public.bookings set status = 'pending' where id = v_booking;

  -- Overlap case already decided: approving "Club fair setup" rejected
  -- "Basketball practice", which asked for the same slot.
  insert into public.bookings (venue_id, requester_id, title, purpose, expected_attendance, starts_at, ends_at)
  values (pg_temp.venue('MPH (placeholder)'), pg_temp.u('teacher.c'), 'Basketball practice (sample)',
          'Team practice.', 15, pg_temp.at(2, '13:30'), pg_temp.at(2, '15:00'));
  insert into public.bookings (venue_id, requester_id, title, purpose, expected_attendance, starts_at, ends_at)
  values (pg_temp.venue('MPH (placeholder)'), pg_temp.u('admin.plain'), 'Club fair setup (sample)',
          'Set up tables for the club fair.', 30, pg_temp.at(2, '13:00'), pg_temp.at(2, '15:00'))
  returning id into v_booking;
  update public.bookings set status = 'approved', reviewed_by = pg_temp.u('admin.venues') where id = v_booking;

  -- Awaiting teacher: a student request Teacher A hasn't confirmed yet.
  insert into public.bookings (venue_id, requester_id, supervising_teacher_id, title, purpose, expected_attendance, starts_at, ends_at)
  values (pg_temp.venue('MPH (placeholder)'), pg_temp.u('student.g10.a'), pg_temp.u('teacher.a'),
          'Science club meeting (sample)', 'Plan the science fair stall.', 12,
          pg_temp.at(3, '10:30'), pg_temp.at(3, '12:00'));

  -- Rejected with a note.
  insert into public.bookings (venue_id, requester_id, title, purpose, expected_attendance, starts_at, ends_at)
  values (pg_temp.venue('Lab 1 (placeholder)'), pg_temp.u('teacher.c'), 'Extra lab session (sample)',
          'Catch-up practicals.', 20, pg_temp.at(4, '13:30'), pg_temp.at(4, '15:00'))
  returning id into v_booking;
  update public.bookings
  set status = 'rejected', reviewed_by = pg_temp.u('admin.venues'),
      review_note = 'The lab is being serviced that afternoon (sample).'
  where id = v_booking;

  -- Cancelled by the requester.
  insert into public.bookings (venue_id, requester_id, title, purpose, starts_at, ends_at)
  values (pg_temp.venue('Lab 1 (placeholder)'), pg_temp.u('teacher.b'), 'Chemistry demo (sample)',
          'Cancelled: moved to next term.', pg_temp.at(1, '07:30'), pg_temp.at(1, '09:00'))
  returning id into v_booking;
  update public.bookings set status = 'cancelled' where id = v_booking;

  -- Auto-approved: the meeting room doesn't need approval.
  insert into public.bookings (venue_id, requester_id, title, purpose, expected_attendance, starts_at, ends_at)
  values (pg_temp.venue('Meeting room (placeholder)'), pg_temp.u('teacher.a'), 'SUPW planning meeting (sample)',
          'Plan next month''s volunteering events.', 6, pg_temp.at(0, '13:30'), pg_temp.at(0, '15:00'));

  -- ---------------------------------------------------------------------------
  -- Fix-it reports: five, with "me too" votes.
  -- ---------------------------------------------------------------------------
  insert into public.reports (reporter_id, room_id, category, description, created_at)
  values (pg_temp.u('student.g10.b'), pg_temp.room('G.03'), 'it', 'Projector won''t turn on (sample).', now() - interval '3 hours')
  returning id into v_report;
  insert into public.report_votes (report_id, user_id) values
    (v_report, pg_temp.u('student.g8.a')),
    (v_report, pg_temp.u('student.g12.a')),
    (v_report, pg_temp.u('student.g10.a'));

  insert into public.reports (reporter_id, room_id, category, description, created_at)
  values (pg_temp.u('student.g8.a'), pg_temp.room('G.08'), 'plumbing', 'Tap by the water cooler keeps dripping (sample).', now() - interval '2 days')
  returning id into v_report;
  update public.reports set status = 'acknowledged', status_note = 'Facilities team has seen this (sample).' where id = v_report;

  insert into public.reports (reporter_id, room_id, category, description, urgent, created_at)
  values (pg_temp.u('teacher.b'), pg_temp.room('G.06'), 'ac', 'AC not cooling, room is very hot (sample).', true, now() - interval '1 day')
  returning id into v_report;
  update public.reports
  set status = 'in_progress', assigned_to = pg_temp.u('admin.facilities'), status_note = 'Technician booked (sample).'
  where id = v_report;

  insert into public.reports (reporter_id, room_id, category, description, created_at)
  values (pg_temp.u('student.g12.a'), pg_temp.room('G.05'), 'furniture', 'Broken chair by the window (sample).', now() - interval '6 days')
  returning id into v_report;
  update public.reports set status = 'resolved', status_note = 'Chair replaced (sample).' where id = v_report;

  insert into public.reports (reporter_id, room_id, category, description, created_at)
  values (pg_temp.u('student.g10.a'), pg_temp.room('1.01'), 'it', 'Wi-Fi drops at the back of the room (sample).', now() - interval '5 hours')
  returning id into v_report;
  insert into public.report_votes (report_id, user_id) values (v_report, pg_temp.u('student.g10.b'));
end;
$$;
