-- =============================================================================
-- 12 People and grades (admin dashboard, B2).
--
-- Tables:    grades, sections, classes, class_teachers, class_students, roster
-- Columns:   profiles.posting_suspended_until, suspension_reason, archived_at
--            app_settings.teachers_post_any_grade; announcements.section_ids
-- Functions: admin_suspend_posting(), admin_lift_suspension(), my_account_status(),
--            admin_save_class(), admin_import_people(), admin_rollover(),
--            admin_list_users() (now with suspension and archive columns)
--
-- What changes for people:
--   * Suspension: an admin can pause someone's posting until a date. Until
--     then the database refuses their new announcements, collab posts, join
--     requests, volunteering events and fix-it reports, with a clear message.
--   * Grades and sections are tables now (replacing app_settings.grades, Q25).
--   * Classes say who teaches whom. With app_settings.teachers_post_any_grade
--     switched off, teachers may announce only to grades and sections they
--     teach (Q12). It stays on until the school has entered its classes.
--   * CSV import fills a roster: people are set up with the right name, role,
--     grade and section the first time they sign in. Existing accounts are
--     updated straight away.
--   * Year-end rollover moves every student up a grade and archives the top
--     grade (history kept, sign-in removed).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Profiles: suspension and archive
-- -----------------------------------------------------------------------------
alter table public.profiles
  add column posting_suspended_until timestamptz,
  add column suspension_reason text check (char_length(suspension_reason) <= 300),
  add column archived_at timestamptz;

-- Everyone may know who someone is, but not whether they're suspended or
-- archived: those columns stay out of the column grant (see 01 identity).
-- People read their own status through my_account_status() below.

create function public.is_posting_suspended()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select posting_suspended_until > now() from public.profiles where id = auth.uid()),
    false
  );
$$;

-- The signed-in person's own account status, for the banner the app shows.
create function public.my_account_status()
returns table (posting_suspended_until timestamptz, suspension_reason text)
language sql
stable
security definer
set search_path = ''
as $$
  select
    case when p.posting_suspended_until > now() then p.posting_suspended_until end,
    case when p.posting_suspended_until > now() then p.suspension_reason end
  from public.profiles p
  where p.id = auth.uid();
$$;

-- The clear message. Runs before the row is saved, so it fires before RLS
-- (which refuses the same insert with a less friendly error, see the
-- restrictive policies below).
create function public.block_suspended_posting()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_until timestamptz;
begin
  if auth.uid() is null then
    return new;
  end if;
  select posting_suspended_until into v_until from public.profiles where id = auth.uid();
  if v_until > now() then
    raise exception 'Posting is paused on your account until %. You can still read everything. If you think this is a mistake, talk to a teacher.',
      public.format_school_time(v_until);
  end if;
  return new;
end;
$$;

create trigger block_suspended_posting before insert on public.announcements
for each row execute function public.block_suspended_posting();
create trigger block_suspended_posting before insert on public.collab_posts
for each row execute function public.block_suspended_posting();
create trigger block_suspended_posting before insert on public.join_requests
for each row execute function public.block_suspended_posting();
create trigger block_suspended_posting before insert on public.volunteer_events
for each row execute function public.block_suspended_posting();
create trigger block_suspended_posting before insert on public.reports
for each row execute function public.block_suspended_posting();

-- RESTRICTIVE policies are ANDed with the existing ones: whatever else allows
-- an insert, a suspended account still can't make one.
create policy "Suspended accounts can't post" on public.announcements
as restrictive for insert to authenticated with check (not public.is_posting_suspended());
create policy "Suspended accounts can't post" on public.collab_posts
as restrictive for insert to authenticated with check (not public.is_posting_suspended());
create policy "Suspended accounts can't post" on public.join_requests
as restrictive for insert to authenticated with check (not public.is_posting_suspended());
create policy "Suspended accounts can't post" on public.volunteer_events
as restrictive for insert to authenticated with check (not public.is_posting_suspended());
create policy "Suspended accounts can't post" on public.reports
as restrictive for insert to authenticated with check (not public.is_posting_suspended());

create function public.admin_suspend_posting(p_user_id uuid, p_until timestamptz, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Only admins can suspend posting.' using errcode = '42501';
  end if;
  if p_until is null or p_until <= now() then
    raise exception 'Choose a date in the future.';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'You can''t suspend yourself.';
  end if;
  update public.profiles
  set posting_suspended_until = p_until, suspension_reason = nullif(trim(p_reason), '')
  where id = p_user_id;
  if not found then
    raise exception 'That user doesn''t exist.';
  end if;
  insert into public.audit_log (actor_id, action, table_name, row_id, details)
  values (auth.uid(), 'posting_suspended', 'profiles', p_user_id::text,
          jsonb_build_object('until', p_until, 'reason', p_reason));
end;
$$;

create function public.admin_lift_suspension(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Only admins can lift a suspension.' using errcode = '42501';
  end if;
  update public.profiles
  set posting_suspended_until = null, suspension_reason = null
  where id = p_user_id;
  insert into public.audit_log (actor_id, action, table_name, row_id, details)
  values (auth.uid(), 'posting_unsuspended', 'profiles', p_user_id::text, '{}');
end;
$$;

-- -----------------------------------------------------------------------------
-- Grades and sections (replace app_settings.grades, Q25)
-- -----------------------------------------------------------------------------
create table public.grades (
  id uuid primary key default gen_random_uuid(),
  grade int not null unique check (grade between 1 and 13),
  name text not null check (char_length(trim(name)) between 1 and 40),
  -- Archived grades stay in the records but aren't offered in pickers.
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Keep whatever grades the school had chosen in the old setting.
insert into public.grades (grade, name)
select g, 'Grade ' || g from unnest((select grades from public.app_settings)) as g;

alter table public.app_settings drop column grades;

create table public.sections (
  id uuid primary key default gen_random_uuid(),
  grade int not null references public.grades (grade) on update cascade on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 10),
  created_at timestamptz not null default now()
);

create unique index sections_grade_name_key on public.sections (grade, lower(name));

-- Sections people already have (e.g. 10 A) become real sections.
insert into public.sections (grade, name)
select distinct p.grade, upper(trim(p.section))
from public.profiles p
join public.grades g on g.grade = p.grade
where nullif(trim(p.section), '') is not null
on conflict do nothing;

create trigger grades_updated_at
before update on public.grades
for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Classes: who teaches whom. A class without a section covers its whole grade
-- (e.g. a grade-wide elective).
-- -----------------------------------------------------------------------------
create table public.classes (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 80),
  subject text check (char_length(subject) <= 60),
  grade int not null references public.grades (grade) on update cascade,
  section_id uuid references public.sections (id) on delete set null,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.class_teachers (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes (id) on delete cascade,
  teacher_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (class_id, teacher_id)
);

create table public.class_students (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (class_id, student_id)
);

create index class_teachers_teacher_idx on public.class_teachers (teacher_id);
create index class_students_student_idx on public.class_students (student_id);

create trigger classes_updated_at
before update on public.classes
for each row execute function public.set_updated_at();

-- A section must belong to the class's grade; teachers must be staff; students students.
create function public.check_class()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_table_name = 'classes' then
    if new.section_id is not null
       and not exists (select 1 from public.sections where id = new.section_id and grade = new.grade) then
      raise exception 'That section isn''t in grade %.', new.grade;
    end if;
  elsif tg_table_name = 'class_teachers' then
    if not public.is_staff_member(new.teacher_id) then
      raise exception 'Only teachers and admins can teach a class.';
    end if;
  elsif not exists (select 1 from public.profiles where id = new.student_id and role = 'student') then
    raise exception 'Only students can be in a class as students.';
  end if;
  return new;
end;
$$;

create trigger classes_check before insert or update on public.classes
for each row execute function public.check_class();
create trigger class_teachers_check before insert or update on public.class_teachers
for each row execute function public.check_class();
create trigger class_students_check before insert or update on public.class_students
for each row execute function public.check_class();

-- Saves a class and exactly who teaches it and who is in it, in one step, so a
-- class is never left half-saved. Returns the class id.
create function public.admin_save_class(
  p_id uuid,
  p_name text,
  p_subject text,
  p_grade int,
  p_section_id uuid,
  p_teacher_ids uuid[],
  p_student_ids uuid[]
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := p_id;
begin
  if not public.is_admin() then
    raise exception 'Only admins can change classes.' using errcode = '42501';
  end if;

  if v_id is null then
    insert into public.classes (name, subject, grade, section_id)
    values (trim(p_name), nullif(trim(p_subject), ''), p_grade, p_section_id)
    returning id into v_id;
  else
    update public.classes
    set name = trim(p_name), subject = nullif(trim(p_subject), ''), grade = p_grade, section_id = p_section_id
    where id = v_id;
    if not found then
      raise exception 'That class doesn''t exist.';
    end if;
  end if;

  delete from public.class_teachers
  where class_id = v_id and teacher_id <> all (coalesce(p_teacher_ids, '{}'));
  insert into public.class_teachers (class_id, teacher_id)
  select v_id, t from unnest(coalesce(p_teacher_ids, '{}')) t
  on conflict do nothing;

  delete from public.class_students
  where class_id = v_id and student_id <> all (coalesce(p_student_ids, '{}'));
  insert into public.class_students (class_id, student_id)
  select v_id, s from unnest(coalesce(p_student_ids, '{}')) s
  on conflict do nothing;

  return v_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Roster: people the school has imported but who haven't signed in yet.
-- handle_new_user() reads it at first sign-in.
-- -----------------------------------------------------------------------------
create table public.roster (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  full_name text not null check (char_length(trim(full_name)) between 1 and 120),
  role public.user_role not null default 'student' check (role in ('student', 'teacher')),
  grade int,
  section text,
  imported_by uuid default auth.uid() references public.profiles (id) on delete set null,
  claimed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index roster_email_key on public.roster (lower(email));

create trigger roster_updated_at
before update on public.roster
for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Audit, RLS
-- -----------------------------------------------------------------------------
create trigger grades_audit after insert or update or delete on public.grades
for each row execute function public.audit_change();
create trigger sections_audit after insert or update or delete on public.sections
for each row execute function public.audit_change();
create trigger classes_audit after insert or update or delete on public.classes
for each row execute function public.audit_change();
create trigger class_teachers_audit after insert or update or delete on public.class_teachers
for each row execute function public.audit_change();
create trigger class_students_audit after insert or update or delete on public.class_students
for each row execute function public.audit_change();
create trigger roster_audit after insert or update or delete on public.roster
for each row execute function public.audit_change();

alter table public.grades enable row level security;
alter table public.sections enable row level security;
alter table public.classes enable row level security;
alter table public.class_teachers enable row level security;
alter table public.class_students enable row level security;
alter table public.roster enable row level security;

-- Grades, sections and classes are the school's structure, not personal data.
create policy "Everyone reads grades" on public.grades for select to authenticated using (true);
create policy "Admins manage grades" on public.grades for all to authenticated
using (public.is_admin()) with check (public.is_admin());

create policy "Everyone reads sections" on public.sections for select to authenticated using (true);
create policy "Admins manage sections" on public.sections for all to authenticated
using (public.is_admin()) with check (public.is_admin());

create policy "Everyone reads classes" on public.classes for select to authenticated using (true);
create policy "Admins manage classes" on public.classes for all to authenticated
using (public.is_admin()) with check (public.is_admin());

create policy "Everyone reads who teaches which class" on public.class_teachers
for select to authenticated using (true);
create policy "Admins manage class teachers" on public.class_teachers for all to authenticated
using (public.is_admin()) with check (public.is_admin());

-- Class lists are personal: the student, the class's teachers and admins.
create policy "Students, their teachers and admins read class lists" on public.class_students
for select to authenticated
using (
  student_id = (select auth.uid())
  or public.is_admin()
  or exists (
    select 1 from public.class_teachers t
    where t.class_id = class_students.class_id and t.teacher_id = (select auth.uid())
  )
);
create policy "Admins manage class lists" on public.class_students for all to authenticated
using (public.is_admin()) with check (public.is_admin());

create policy "Admins manage the roster" on public.roster for all to authenticated
using (public.is_admin()) with check (public.is_admin());

-- -----------------------------------------------------------------------------
-- Announcements: sections, and "teachers post only to what they teach" (Q12)
-- -----------------------------------------------------------------------------
alter table public.app_settings
  add column teachers_post_any_grade boolean not null default true;

-- Optional: narrow a grade announcement to some sections. Null = whole grades.
alter table public.announcements add column section_ids uuid[];

-- The signed-in student's section, as a sections row id.
create function public.my_section_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select s.id
  from public.profiles p
  join public.sections s on s.grade = p.grade and lower(s.name) = lower(trim(p.section))
  where p.id = auth.uid();
$$;

create function public.teachers_post_any_grade()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select teachers_post_any_grade from public.app_settings;
$$;

-- Does the signed-in teacher teach this audience? A whole grade needs a
-- grade-wide class; a section needs a class in that section (or the grade).
create function public.teaches_audience(p_grades int[], p_section_ids uuid[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when coalesce(cardinality(p_section_ids), 0) = 0 then
      not exists (
        select 1 from unnest(p_grades) g
        where not exists (
          select 1 from public.classes c join public.class_teachers t on t.class_id = c.id
          where t.teacher_id = auth.uid() and c.archived_at is null
            and c.grade = g and c.section_id is null
        )
      )
    else
      not exists (
        select 1 from unnest(p_section_ids) sid
        where not exists (
          select 1 from public.classes c
          join public.class_teachers t on t.class_id = c.id
          join public.sections s on s.id = sid
          where t.teacher_id = auth.uid() and c.archived_at is null
            and (c.section_id = sid or (c.grade = s.grade and c.section_id is null))
        )
      )
  end;
$$;

-- Keeps grades in step with the chosen sections, and gives teachers a clear
-- message when they aim outside their classes (the policies refuse it too).
create function public.announcements_check_audience()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(cardinality(new.section_ids), 0) = 0 then
    new.section_ids := null;
  else
    if new.audience <> 'grades' then
      raise exception 'Sections only apply to announcements for some grades.';
    end if;
    if exists (
      select 1 from unnest(new.section_ids) sid
      where not exists (select 1 from public.sections where id = sid)
    ) then
      raise exception 'One of those sections doesn''t exist any more.';
    end if;
    new.grades := array(
      select distinct s.grade from public.sections s where s.id = any (new.section_ids) order by 1
    );
  end if;

  if auth.uid() is not null and pg_trigger_depth() = 1
     and public.is_staff() and not public.is_admin()
     and not public.teachers_post_any_grade()
     and new.audience = 'grades'
     and not public.teaches_audience(new.grades, new.section_ids) then
    raise exception 'You can only post to grades and sections you teach. Ask an admin if your classes are missing.';
  end if;
  return new;
end;
$$;

create trigger announcements_check_audience
before insert or update on public.announcements
for each row execute function public.announcements_check_audience();

drop policy "Read announcements meant for me" on public.announcements;
create policy "Read announcements meant for me"
on public.announcements for select to authenticated
using (
  public.is_staff()
  or (
    published_at <= now()
    and (
      audience = 'school'
      or (
        public.my_grade() = any (grades)
        and (section_ids is null or public.my_section_id() = any (section_ids))
      )
    )
  )
);

drop policy "Staff post announcements" on public.announcements;
create policy "Staff post announcements"
on public.announcements for insert to authenticated
with check (
  author_id = (select auth.uid())
  and (
    public.is_admin()
    or (
      public.is_staff() and audience = 'grades' and not pinned
      and (public.teachers_post_any_grade() or public.teaches_audience(grades, section_ids))
    )
  )
);

drop policy "Authors edit their own, admins edit any" on public.announcements;
create policy "Authors edit their own, admins edit any"
on public.announcements for update to authenticated
using (
  public.is_admin()
  or (author_id = (select auth.uid()) and public.is_staff())
)
with check (
  public.is_admin()
  or (
    author_id = (select auth.uid()) and public.is_staff() and audience = 'grades' and not pinned
    and (public.teachers_post_any_grade() or public.teaches_audience(grades, section_ids))
  )
);

-- Notify the students the announcement is for (now section-aware).
create or replace function public.announcements_notify()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_body text := left(new.body, 140);
  v_link text := '/announcements/' || new.id;
begin
  if new.audience = 'grades' then
    perform public.notify(p.id, 'announcement_new', new.title, v_body, v_link)
    from public.profiles p
    where p.role = 'student' and p.grade = any (new.grades)
      and (
        new.section_ids is null
        or exists (
          select 1 from public.sections s
          where s.id = any (new.section_ids) and s.grade = p.grade and lower(s.name) = lower(trim(p.section))
        )
      );
  elsif new.pinned then
    perform public.notify(p.id, 'announcement_new', new.title, v_body, v_link)
    from public.profiles p
    where p.id <> new.author_id;
  end if;
  return null;
end;
$$;

-- -----------------------------------------------------------------------------
-- Archived people get no notifications (they can't sign in to read them).
-- Same function as in 02, plus the first check.
-- -----------------------------------------------------------------------------
create or replace function public.notify(
  p_recipient uuid,
  p_type public.notification_type,
  p_title text,
  p_body text,
  p_link text,
  p_urgent boolean default false,
  p_email_now boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_payload jsonb;
begin
  if p_recipient is null
     or exists (select 1 from public.profiles where id = p_recipient and archived_at is not null) then
    return null;
  end if;

  if not p_urgent
     and not public.notification_type_is_unmutable(p_type)
     and exists (
       select 1 from public.notification_prefs
       where user_id = p_recipient and type = p_type and muted
     ) then
    return null;
  end if;

  insert into public.notifications (recipient_id, type, title, body, link, urgent)
  values (p_recipient, p_type, p_title, coalesce(p_body, ''), p_link, p_urgent)
  returning id into v_id;

  v_payload := jsonb_build_object(
    'type', p_type, 'title', p_title, 'body', coalesce(p_body, ''), 'link', p_link, 'urgent', p_urgent
  );

  insert into public.push_outbox (recipient_id, notification_id, kind, payload)
  values (p_recipient, v_id, 'immediate', v_payload);

  if exists (select 1 from public.responsibilities where user_id = p_recipient) then
    insert into public.email_outbox (recipient_id, notification_id, kind, payload)
    values (
      p_recipient,
      v_id,
      case when p_urgent or p_email_now then 'immediate'::public.outbox_kind else 'digest' end,
      v_payload || jsonb_build_object(
        'email', (select email from public.profiles where id = p_recipient)
      )
    );
  end if;

  return v_id;
end;
$$;

revoke execute on function public.notify(uuid, public.notification_type, text, text, text, boolean, boolean)
  from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- First sign-in: also read the roster (imported people). Same as in 01, plus
-- the roster lookup. Roster details are trusted: an admin imported them.
-- -----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  settings public.app_settings;
  v_email text := lower(new.email);
  v_domain text := split_part(lower(new.email), '@', 2);
  v_school_domain text;
  v_is_dev boolean := split_part(lower(new.email), '@', 2) = 'dev.local';
  v_role public.user_role := 'student';
  v_roster public.roster;
begin
  select * into settings from public.app_settings;
  v_school_domain := lower(settings.school_email_domain);

  if v_is_dev then
    if not settings.allow_dev_accounts then
      raise exception 'Dev accounts are switched off (app_settings.allow_dev_accounts).';
    end if;
  elsif v_school_domain is null
     or not (v_domain = v_school_domain or v_domain like '%.' || v_school_domain) then
    raise exception 'Please sign in with your school email account.';
  end if;

  select * into v_roster from public.roster where lower(email) = v_email;

  if exists (select 1 from public.staff_emails where lower(email) = v_email)
     or (settings.staff_email_pattern is not null and v_email ~* settings.staff_email_pattern)
     or v_roster.role = 'teacher' then
    v_role := 'teacher';
  end if;

  insert into public.profiles (id, email, full_name, role, grade, section, avatar_initials)
  values (
    new.id,
    v_email,
    coalesce(
      v_roster.full_name,
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      split_part(v_email, '@', 1)
    ),
    v_role,
    -- Grade and section come from the roster, or (seeded dev users only) from
    -- sign-in metadata. Real sign-in metadata is never trusted for these.
    case when v_roster.id is not null then v_roster.grade
         when v_is_dev then (new.raw_user_meta_data ->> 'grade')::int end,
    case when v_roster.id is not null then v_roster.section
         when v_is_dev then new.raw_user_meta_data ->> 'section' end,
    case when v_is_dev then new.raw_user_meta_data ->> 'avatar_initials' end
  );

  if v_roster.id is not null then
    update public.roster set claimed_at = now() where id = v_roster.id;
  end if;
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Admin profile edits now check the grade and section exist.
-- -----------------------------------------------------------------------------
create or replace function public.admin_update_profile(
  p_user_id uuid,
  p_full_name text,
  p_grade int,
  p_section text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old public.profiles;
  v_section text := upper(nullif(trim(p_section), ''));
begin
  if not public.is_admin() then
    raise exception 'Only admins can edit profiles.' using errcode = '42501';
  end if;

  select * into v_old from public.profiles where id = p_user_id for update;
  if not found then
    raise exception 'That user doesn''t exist.';
  end if;
  if p_grade is not null and not exists (select 1 from public.grades where grade = p_grade) then
    raise exception 'Grade % isn''t set up. Add it under Grades and sections first.', p_grade;
  end if;
  if v_section is not null and p_grade is not null
     and not exists (select 1 from public.sections where grade = p_grade and lower(name) = lower(v_section)) then
    raise exception 'Grade % has no section %. Add it under Grades and sections first.', p_grade, v_section;
  end if;

  update public.profiles
  set full_name = coalesce(nullif(trim(p_full_name), ''), full_name),
      grade = p_grade,
      section = v_section
  where id = p_user_id;

  insert into public.audit_log (actor_id, action, table_name, row_id, details)
  values (
    auth.uid(), 'profile_updated', 'profiles', p_user_id::text,
    jsonb_build_object(
      'old', jsonb_build_object('full_name', v_old.full_name, 'grade', v_old.grade, 'section', v_old.section),
      'new', jsonb_build_object('full_name', p_full_name, 'grade', p_grade, 'section', v_section)
    )
  );
end;
$$;

-- The Users screen needs the new columns, so the function is rebuilt.
drop function public.admin_list_users();

create function public.admin_list_users()
returns table (
  id uuid,
  full_name text,
  email text,
  role public.user_role,
  grade int,
  section text,
  responsibilities public.responsibility_kind[],
  posting_suspended_until timestamptz,
  suspension_reason text,
  archived_at timestamptz,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Only admins can list users.' using errcode = '42501';
  end if;
  return query
    select
      p.id, p.full_name, p.email, p.role, p.grade, p.section,
      coalesce(
        array_agg(r.kind order by r.kind) filter (where r.kind is not null),
        '{}'
      ),
      case when p.posting_suspended_until > now() then p.posting_suspended_until end,
      case when p.posting_suspended_until > now() then p.suspension_reason end,
      p.archived_at,
      p.created_at
    from public.profiles p
    left join public.responsibilities r on r.user_id = p.id
    group by p.id
    order by p.role desc, p.grade nulls first, p.full_name;
end;
$$;

-- -----------------------------------------------------------------------------
-- CSV import. p_rows is a JSON array of {name, email, role, grade, section}.
-- Every row is checked; rows with a problem are reported and nothing of them
-- is saved; the good rows are saved. With p_dry_run nothing is saved at all:
-- that's the preview.
--
-- outcome: 'create' (set up at first sign-in), 'update' (has an account
-- already: name, grade and section updated), or 'error' (see message).
-- -----------------------------------------------------------------------------
create function public.admin_import_people(p_rows jsonb, p_dry_run boolean default true)
returns table (row_number int, email text, full_name text, outcome text, message text)
language plpgsql
security definer
set search_path = ''
as $$
-- The result columns (email, full_name, ...) share names with table columns;
-- inside SQL statements here, a bare name means the table column.
#variable_conflict use_column
declare
  v_settings public.app_settings;
  v_row jsonb;
  v_index int := 0;
  v_email text;
  v_name text;
  v_role text;
  v_grade int;
  v_section text;
  v_domain text;
  v_problem text;
  v_profile public.profiles;
  v_seen jsonb := '{}';
  v_counts jsonb := '{"create": 0, "update": 0, "error": 0}';
begin
  if not public.is_admin() then
    raise exception 'Only admins can import people.' using errcode = '42501';
  end if;
  if jsonb_typeof(p_rows) is distinct from 'array' then
    raise exception 'Send the rows as a list.';
  end if;
  if jsonb_array_length(p_rows) > 2000 then
    raise exception 'Import at most 2000 people at a time.';
  end if;
  select * into v_settings from public.app_settings;

  for v_row in select value from jsonb_array_elements(p_rows) loop
    v_index := v_index + 1;
    v_email := lower(trim(coalesce(v_row ->> 'email', '')));
    v_name := trim(coalesce(v_row ->> 'name', ''));
    v_role := lower(coalesce(nullif(trim(v_row ->> 'role'), ''), 'student'));
    v_section := upper(nullif(trim(coalesce(v_row ->> 'section', '')), ''));
    v_domain := split_part(v_email, '@', 2);
    v_problem := null;
    v_grade := null;

    -- One check at a time; the first problem found is the one reported.
    if v_name = '' then
      v_problem := 'Name is missing.';
    elsif v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
      v_problem := 'That isn''t an email address.';
    elsif v_seen ? v_email then
      v_problem := 'Duplicate: the same email is on row ' || (v_seen ->> v_email) || '.';
    elsif not (
      (v_domain = 'dev.local' and v_settings.allow_dev_accounts)
      or (v_settings.school_email_domain is not null
          and (v_domain = lower(v_settings.school_email_domain)
               or v_domain like '%.' || lower(v_settings.school_email_domain)))
    ) then
      v_problem := case when v_settings.school_email_domain is null
        then 'Set the school email domain first (System > Sign-in).'
        else 'Not a school email address (must end in ' || v_settings.school_email_domain || ').' end;
    elsif v_role = 'admin' then
      v_problem := 'Make admins one at a time on the Users screen.';
    elsif v_role not in ('student', 'teacher') then
      v_problem := 'Role must be student or teacher.';
    elsif v_role = 'student' then
      if (v_row ->> 'grade') !~ '^\s*\d{1,2}\s*$' then
        v_problem := 'Students need a grade (a number).';
      else
        v_grade := trim(v_row ->> 'grade')::int;
        if not exists (select 1 from public.grades where grade = v_grade and active) then
          v_problem := 'Unknown grade: ' || v_grade || '.';
        elsif v_section is not null
              and not exists (select 1 from public.sections where grade = v_grade and lower(name) = lower(v_section)) then
          v_problem := 'Grade ' || v_grade || ' has no section ' || v_section || '.';
        end if;
      end if;
    end if;

    if v_problem is null and v_role = 'student' then
      select * into v_profile from public.profiles where lower(profiles.email) = v_email;
      if v_profile.role in ('teacher', 'admin') then
        v_problem := 'Already a ' || v_profile.role || '. Change roles on the Users screen.';
      end if;
    end if;

    v_seen := v_seen || jsonb_build_object(v_email, v_index);

    if v_problem is not null then
      v_counts := jsonb_set(v_counts, '{error}', to_jsonb((v_counts ->> 'error')::int + 1));
      return query select v_index, v_email, v_name, 'error'::text, v_problem;
      continue;
    end if;

    select * into v_profile from public.profiles where lower(profiles.email) = v_email;
    outcome := case when v_profile.id is null then 'create' else 'update' end;

    if not p_dry_run then
      -- Each row is its own all-or-nothing step: if anything fails part-way,
      -- that row is undone and reported, and the others carry on.
      begin
        if v_role = 'teacher' then
          insert into public.staff_emails (email) values (v_email) on conflict do nothing;
        end if;
        if v_profile.id is not null then
          update public.profiles
          set full_name = v_name,
              grade = case when v_role = 'student' then v_grade else null end,
              section = case when v_role = 'student' then v_section else null end
          where id = v_profile.id;
        else
          insert into public.roster (email, full_name, role, grade, section)
          values (v_email, v_name, v_role::public.user_role, v_grade, v_section)
          on conflict (lower(email)) do update
          set full_name = excluded.full_name, role = excluded.role,
              grade = excluded.grade, section = excluded.section, claimed_at = null;
        end if;
      exception when others then
        v_counts := jsonb_set(v_counts, '{error}', to_jsonb((v_counts ->> 'error')::int + 1));
        return query select v_index, v_email, v_name, 'error'::text, sqlerrm;
        continue;
      end;
    end if;

    v_counts := jsonb_set(v_counts, array[outcome], to_jsonb((v_counts ->> outcome)::int + 1));
    return query select v_index, v_email, v_name, outcome,
      case when outcome = 'create' then 'Set up when they first sign in.' else 'Account updated.' end;
  end loop;

  if not p_dry_run then
    insert into public.audit_log (actor_id, action, table_name, row_id, details)
    values (auth.uid(), 'people_imported', 'roster', null, v_counts);
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- Year-end rollover. Every student moves to the next active grade; students
-- in the top grade are archived: their history stays, but their sign-in is
-- removed and they disappear from lists and notifications.
--
-- Always run it with p_dry_run first: it returns what would happen, one row per
-- grade, and changes nothing. The real run needs p_confirm = 'ROLLOVER <year>'
-- (the current year in Dubai) so it can't happen by accident.
-- -----------------------------------------------------------------------------
create function public.admin_rollover(p_dry_run boolean default true, p_confirm text default null)
returns table (from_grade int, to_grade int, students int)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_expected text := 'ROLLOVER ' || extract(year from now() at time zone 'Asia/Dubai')::int;
  v_top int := (select max(grade) from public.grades where active);
  v_plan jsonb;
begin
  if not public.is_admin() then
    raise exception 'Only admins can run the year-end rollover.' using errcode = '42501';
  end if;
  if v_top is null then
    raise exception 'Set up the school''s grades first.';
  end if;

  -- The plan: each student grade, where it goes (null = archived), how many.
  drop table if exists pg_temp.rollover_plan;
  create temporary table rollover_plan on commit drop as
    select
      p.grade as from_grade,
      case when p.grade >= v_top then null
           else (select min(g.grade) from public.grades g where g.active and g.grade > p.grade)
      end as to_grade,
      count(*)::int as students
    from public.profiles p
    where p.role = 'student' and p.archived_at is null and p.grade is not null
    group by p.grade;

  if p_dry_run then
    return query select r.from_grade, r.to_grade, r.students from pg_temp.rollover_plan r order by r.from_grade;
    drop table pg_temp.rollover_plan;
    return;
  end if;

  if p_confirm is distinct from v_expected then
    raise exception 'Type % to confirm.', v_expected;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('from', r.from_grade, 'to', r.to_grade, 'students', r.students)
                            order by r.from_grade), '[]')
  into v_plan from pg_temp.rollover_plan r;

  -- 1. The top grade leaves: archived, sign-in removed (a far-future ban, which
  --    Supabase Auth checks at every sign-in and token refresh).
  update auth.users u
  set banned_until = '2999-12-31'::timestamptz
  from public.profiles p
  where p.id = u.id and p.role = 'student' and p.archived_at is null and p.grade >= v_top;

  update public.profiles
  set archived_at = now()
  where role = 'student' and archived_at is null and grade >= v_top;

  -- 2. Everyone else moves up (one statement, so 10 → 11 can't then become 12).
  update public.profiles p
  set grade = r.to_grade
  from pg_temp.rollover_plan r
  where p.role = 'student' and p.archived_at is null and p.grade = r.from_grade and r.to_grade is not null;

  insert into public.audit_log (actor_id, action, table_name, row_id, details)
  values (auth.uid(), 'rollover', 'profiles', null, jsonb_build_object('plan', v_plan));

  return query select r.from_grade, r.to_grade, r.students from pg_temp.rollover_plan r order by r.from_grade;
  drop table pg_temp.rollover_plan;
end;
$$;
