-- =============================================================================
-- 01 Identity: who people are, what role they have, and what jobs they hold.
--
-- Tables:   app_settings, profiles, staff_emails, responsibilities, audit_log
-- Helpers:  auth_role(), is_staff(), is_admin(), has_responsibility(kind), my_grade()
-- Admin:    admin_set_role(), admin_update_profile(), admin_list_users()
--
-- Rules (from the plan):
--   * Only school accounts get in (domain check at sign-up).
--   * New users are students, unless their email is on the staff list.
--   * Nobody can change their own role. Admins change roles through
--     admin_set_role(), which writes to audit_log.
--   * Responsibilities (facilities, it, venues, supw) tag staff with jobs.
-- =============================================================================

create type public.user_role as enum ('student', 'teacher', 'admin');
create type public.responsibility_kind as enum ('facilities', 'it', 'venues', 'supw');

-- Keeps updated_at current on every edit. Attached to each table that has the column.
create function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- app_settings: one row of school-wide settings. Everything the school hasn't
-- decided yet lives here so it can change without a code change
-- (see docs/OPEN_QUESTIONS.md).
-- -----------------------------------------------------------------------------
create table public.app_settings (
  -- `id` can only ever be true, so the table can only ever hold one row.
  id boolean primary key default true check (id),
  school_name text not null default '[SCHOOL NAME]',
  -- Q5: e.g. 'school.example'. Null means "not configured": only dev accounts can sign in.
  school_email_domain text,
  -- Seeded @dev.local test users. Switch off before launch.
  allow_dev_accounts boolean not null default true,
  -- Q3: optional regex; matching emails become teachers at first sign-in.
  staff_email_pattern text,
  -- Q2: may students request venues (with a supervising teacher)?
  students_can_request_venues boolean not null default true,
  -- Q4: must a collab post name a supervising teacher?
  collab_requires_teacher boolean not null default false,
  -- Q9: SUPW hours each student should reach. Null = not set yet.
  supw_hours_target numeric(5, 1),
  -- Q10: when to remind venue approvers about a waiting request.
  venue_reminder_hours int not null default 48 check (venue_reminder_hours > 0),
  venue_reminder_days_before int not null default 3 check (venue_reminder_days_before >= 0),
  -- Booking calendar shape (Q11). Days: 0 = Sunday ... 6 = Saturday.
  school_days int[] not null default '{0,1,2,3,4}',
  booking_day_start time not null default '07:30',
  booking_slot_minutes int not null default 90 check (booking_slot_minutes between 15 and 480),
  booking_slots_per_day int not null default 5 check (booking_slots_per_day between 1 and 24),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.app_settings default values;

create trigger app_settings_updated_at
before update on public.app_settings
for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- profiles: one row per person, created automatically at first sign-in.
-- -----------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  email text not null,
  role public.user_role not null default 'student',
  grade int check (grade between 1 and 13),
  section text,
  avatar_initials text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index profiles_email_key on public.profiles (lower(email));

create trigger profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- staff_emails: the list admins keep. Anyone on it becomes a teacher at first
-- sign-in (and an existing student account on it is promoted straight away).
-- -----------------------------------------------------------------------------
create table public.staff_emails (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  added_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create unique index staff_emails_email_key on public.staff_emails (lower(email));

-- -----------------------------------------------------------------------------
-- responsibilities: jobs on top of roles. Decide who receives which fix-it
-- reports and approvals, without inventing more roles.
-- -----------------------------------------------------------------------------
create table public.responsibilities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind public.responsibility_kind not null,
  created_at timestamptz not null default now(),
  unique (user_id, kind)
);

-- -----------------------------------------------------------------------------
-- audit_log: who changed what. Append-only. No foreign key on actor_id on
-- purpose: the record must outlive a deleted account.
-- -----------------------------------------------------------------------------
create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
  action text not null,
  table_name text not null,
  row_id text,
  details jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index audit_log_created_at_idx on public.audit_log (created_at desc);

-- Nobody, not even the database owner, can edit or delete history.
create function public.audit_log_is_append_only()
returns trigger
language plpgsql
as $$
begin
  raise exception 'The audit log can''t be changed or deleted.';
end;
$$;

create trigger audit_log_no_update_or_delete
before update or delete on public.audit_log
for each row execute function public.audit_log_is_append_only();

create trigger audit_log_no_truncate
before truncate on public.audit_log
for each statement execute function public.audit_log_is_append_only();

-- =============================================================================
-- Helper functions used by every RLS policy.
--
-- `security definer` runs the function as its owner, not as the user. That's
-- needed because these read `profiles` and `responsibilities`; if they ran as
-- the user, those tables' own policies would call them again, forever.
-- `set search_path = ''` stops anyone from swapping in look-alike tables, which
-- is why every name inside is written in full (public.profiles).
-- =============================================================================

create function public.auth_role()
returns public.user_role
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.profiles where id = auth.uid();
$$;

create function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.auth_role() in ('teacher', 'admin'), false);
$$;

create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.auth_role() = 'admin', false);
$$;

create function public.has_responsibility(p_kind public.responsibility_kind)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.responsibilities where user_id = auth.uid() and kind = p_kind
  );
$$;

create function public.my_grade()
returns int
language sql
stable
security definer
set search_path = ''
as $$
  select grade from public.profiles where id = auth.uid();
$$;

-- True for teachers and admins. Used to check "the person you named is staff".
create function public.is_staff_member(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles where id = p_user_id and role in ('teacher', 'admin')
  );
$$;

-- =============================================================================
-- Sign-up: create the profile, enforce the school domain, pick the role.
-- Runs inside the sign-up itself, so raising an error here refuses the account.
-- =============================================================================
create function public.handle_new_user()
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
begin
  select * into settings from public.app_settings;
  v_school_domain := lower(settings.school_email_domain);

  if v_is_dev then
    if not settings.allow_dev_accounts then
      raise exception 'Dev accounts are switched off (app_settings.allow_dev_accounts).';
    end if;
  -- Accept the school domain and its subdomains (e.g. students.school.example).
  elsif v_school_domain is null
     or not (v_domain = v_school_domain or v_domain like '%.' || v_school_domain) then
    raise exception 'Please sign in with your school email account.';
  end if;

  if exists (select 1 from public.staff_emails where lower(email) = v_email)
     or (settings.staff_email_pattern is not null and v_email ~* settings.staff_email_pattern) then
    v_role := 'teacher';
  end if;

  insert into public.profiles (id, email, full_name, role, grade, section, avatar_initials)
  values (
    new.id,
    v_email,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      split_part(v_email, '@', 1)
    ),
    v_role,
    -- Only seeded dev users carry grade and section in their metadata. Real
    -- users get them from an admin, because sign-in metadata is not trusted.
    case when v_is_dev then (new.raw_user_meta_data ->> 'grade')::int end,
    case when v_is_dev then new.raw_user_meta_data ->> 'section' end,
    case when v_is_dev then new.raw_user_meta_data ->> 'avatar_initials' end
  );
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Adding someone to the staff list promotes their existing student account.
create function public.promote_listed_staff()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles
  set role = 'teacher'
  where lower(email) = lower(new.email) and role = 'student';
  return null;
end;
$$;

create trigger staff_emails_promote
after insert on public.staff_emails
for each row execute function public.promote_listed_staff();

-- Responsibilities are staff jobs; a student can't hold one.
create function public.check_responsibility_holder()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_staff_member(new.user_id) then
    raise exception 'Only teachers and admins can hold a responsibility.';
  end if;
  return new;
end;
$$;

create trigger responsibilities_staff_only
before insert or update on public.responsibilities
for each row execute function public.check_responsibility_holder();

-- =============================================================================
-- Audit trail for admin-only tables. Attached to every table only admins can
-- change. Changes with no signed-in user (seed data, the Supabase dashboard)
-- are skipped: there is no app actor to record, and Supabase keeps its own logs.
-- =============================================================================
create function public.audit_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
begin
  if auth.uid() is null then
    return null;
  end if;
  insert into public.audit_log (actor_id, action, table_name, row_id, details)
  values (
    auth.uid(),
    lower(tg_op),
    tg_table_name,
    v_row ->> 'id',
    case tg_op
      when 'INSERT' then jsonb_build_object('new', to_jsonb(new))
      when 'UPDATE' then jsonb_build_object('old', to_jsonb(old), 'new', to_jsonb(new))
      else jsonb_build_object('old', to_jsonb(old))
    end
  );
  return null;
end;
$$;

create trigger app_settings_audit
after update on public.app_settings
for each row execute function public.audit_change();

create trigger staff_emails_audit
after insert or update or delete on public.staff_emails
for each row execute function public.audit_change();

create trigger responsibilities_audit
after insert or update or delete on public.responsibilities
for each row execute function public.audit_change();

-- =============================================================================
-- Row Level Security
-- =============================================================================
alter table public.app_settings enable row level security;
alter table public.profiles enable row level security;
alter table public.staff_emails enable row level security;
alter table public.responsibilities enable row level security;
alter table public.audit_log enable row level security;

-- app_settings: everyone signed in reads them (the app needs them); admins edit.
create policy "Signed-in users read settings"
on public.app_settings for select to authenticated
using (true);

create policy "Admins edit settings"
on public.app_settings for update to authenticated
using (public.is_admin())
with check (public.is_admin());

-- profiles: everyone signed in can see names, roles and grades (needed to show
-- authors, organisers and teams). Emails are NOT readable: see the grants below.
create policy "Signed-in users read profiles"
on public.profiles for select to authenticated
using (true);

-- No insert/update/delete policies on profiles: rows are created by the sign-up
-- trigger and changed only by the admin functions below.

-- Column-level grants: the `email` column is left out, so no one can read
-- emails straight from the table. Functions hand out emails only to the people
-- who may see them (a post's owner, an event's organiser, staff).
revoke all on public.profiles from authenticated;
grant select (id, full_name, role, grade, section, avatar_initials, created_at, updated_at)
  on public.profiles to authenticated;

-- staff_emails: admins only.
create policy "Admins manage the staff list"
on public.staff_emails for all to authenticated
using (public.is_admin())
with check (public.is_admin());

-- responsibilities: you can see your own; staff see everyone's (approvals show
-- who handles what); admins assign them.
create policy "Read own responsibilities, staff read all"
on public.responsibilities for select to authenticated
using (user_id = (select auth.uid()) or public.is_staff());

create policy "Admins assign responsibilities"
on public.responsibilities for insert to authenticated
with check (public.is_admin());

create policy "Admins remove responsibilities"
on public.responsibilities for delete to authenticated
using (public.is_admin());

-- audit_log: admins read. Nobody writes from the app; triggers and admin
-- functions (running as the owner) do.
create policy "Admins read the audit log"
on public.audit_log for select to authenticated
using (public.is_admin());

revoke insert, update, delete, truncate on public.audit_log from authenticated;

-- =============================================================================
-- Admin functions. Each checks is_admin() itself, because `security definer`
-- skips RLS: the function is the only gatekeeper.
-- =============================================================================

-- Change someone's role. The only way roles ever change in the app.
create function public.admin_set_role(p_user_id uuid, p_role public.user_role)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old public.user_role;
begin
  if not public.is_admin() then
    raise exception 'Only admins can change roles.' using errcode = '42501';
  end if;

  select role into v_old from public.profiles where id = p_user_id for update;
  if not found then
    raise exception 'That user doesn''t exist.';
  end if;
  if v_old = p_role then
    return;
  end if;
  if v_old = 'admin' and (select count(*) from public.profiles where role = 'admin') = 1 then
    raise exception 'You can''t remove the last admin.';
  end if;

  update public.profiles set role = p_role where id = p_user_id;

  -- Responsibilities are staff jobs, so they go if someone becomes a student.
  if p_role = 'student' then
    delete from public.responsibilities where user_id = p_user_id;
  end if;

  insert into public.audit_log (actor_id, action, table_name, row_id, details)
  values (
    auth.uid(), 'role_changed', 'profiles', p_user_id::text,
    jsonb_build_object('from', v_old, 'to', p_role)
  );
end;
$$;

-- Fix a name, grade or section (e.g. when a student moves up a year).
create function public.admin_update_profile(
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
begin
  if not public.is_admin() then
    raise exception 'Only admins can edit profiles.' using errcode = '42501';
  end if;

  select * into v_old from public.profiles where id = p_user_id for update;
  if not found then
    raise exception 'That user doesn''t exist.';
  end if;

  update public.profiles
  set full_name = coalesce(nullif(trim(p_full_name), ''), full_name),
      grade = p_grade,
      section = nullif(trim(p_section), '')
  where id = p_user_id;

  insert into public.audit_log (actor_id, action, table_name, row_id, details)
  values (
    auth.uid(), 'profile_updated', 'profiles', p_user_id::text,
    jsonb_build_object(
      'old', jsonb_build_object('full_name', v_old.full_name, 'grade', v_old.grade, 'section', v_old.section),
      'new', jsonb_build_object('full_name', p_full_name, 'grade', p_grade, 'section', p_section)
    )
  );
end;
$$;

-- Everyone, with emails and responsibilities, for the admin Users screen.
create function public.admin_list_users()
returns table (
  id uuid,
  full_name text,
  email text,
  role public.user_role,
  grade int,
  section text,
  responsibilities public.responsibility_kind[],
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
      p.created_at
    from public.profiles p
    left join public.responsibilities r on r.user_id = p.id
    group by p.id
    order by p.role desc, p.grade nulls first, p.full_name;
end;
$$;
