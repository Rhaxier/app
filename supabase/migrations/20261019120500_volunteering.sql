-- =============================================================================
-- 05 SUPW volunteering: events, roles and sign-ups.
--
-- Tables:    volunteer_events, event_roles, role_signups
-- Functions: volunteer_role_counts(), event_signups(), hours_to_confirm(),
--            supw_hours_report()
--
-- Rules (plan, "SUPW volunteering"):
--   * Anyone can create an event. A student's event starts as
--     awaiting_approval and only teachers, admins and the creator can see it.
--     Staff events are published straight away.
--   * Any teacher or admin approves it or sends it back with a note; the
--     creator hears either way. All teachers hear when one is submitted.
--   * Each event has roles, each wanting N students. Students sign up for a
--     role. If the organiser turned multiple roles off, a second sign-up in the
--     same event is refused.
--   * The organiser (creator) selects up to N per role, can move people between
--     roles, and sees everyone's contact email. Selected students are told;
--     once a role is full, everyone still waiting is waitlisted and told.
--   * A selected student withdrawing notifies the organiser.
--   * After the event the organiser marks attendance and a teacher confirms
--     hours: for a student-run event, the teacher who approved it (or an admin).
--     Students never confirm hours, not even on their own events.
-- =============================================================================

create type public.volunteer_event_status as enum (
  'awaiting_approval', 'published', 'sent_back', 'closed'
);

create type public.signup_status as enum (
  'applied', 'selected', 'waitlisted', 'not_selected', 'withdrawn'
);

create table public.volunteer_events (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  -- Optional byline, e.g. 'Environment Club'.
  organiser_label text check (char_length(organiser_label) <= 60),
  title text not null check (char_length(trim(title)) between 1 and 120),
  description text not null default '' check (char_length(description) <= 4000),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  room_id uuid references public.rooms (id) on delete set null,
  place_text text check (char_length(place_text) <= 120),
  supw_hours numeric(5, 1) not null default 0 check (supw_hours >= 0),
  signup_deadline timestamptz,
  allow_multiple_roles boolean not null default false,
  status public.volunteer_event_status not null default 'awaiting_approval',
  approved_by uuid references public.profiles (id) on delete set null,
  approval_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint volunteer_events_ends_after_start check (ends_at > starts_at),
  constraint volunteer_events_has_place check (
    room_id is not null or nullif(trim(place_text), '') is not null
  ),
  constraint volunteer_events_deadline_before_start check (
    signup_deadline is null or signup_deadline <= starts_at
  )
);

create index volunteer_events_starts_idx on public.volunteer_events (starts_at);
create index volunteer_events_status_idx on public.volunteer_events (status);

create table public.event_roles (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.volunteer_events (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 80),
  description text not null default '' check (char_length(description) <= 500),
  spots_wanted int not null check (spots_wanted > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index event_roles_event_idx on public.event_roles (event_id);

create table public.role_signups (
  id uuid primary key default gen_random_uuid(),
  role_id uuid not null references public.event_roles (id) on delete cascade,
  -- Copied from the role by a trigger, so "one role per event" and "everyone
  -- in this event" are simple lookups. The app never sends it.
  event_id uuid not null references public.volunteer_events (id) on delete cascade,
  student_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  note text check (char_length(note) <= 300),
  status public.signup_status not null default 'applied',
  attended boolean,
  hours_confirmed numeric(5, 1) check (hours_confirmed >= 0),
  confirmed_by uuid references public.profiles (id) on delete set null,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (role_id, student_id)
);

create index role_signups_event_idx on public.role_signups (event_id);
create index role_signups_student_idx on public.role_signups (student_id);

create trigger volunteer_events_updated_at
before update on public.volunteer_events
for each row execute function public.set_updated_at();

create trigger event_roles_updated_at
before update on public.event_roles
for each row execute function public.set_updated_at();

create trigger role_signups_updated_at
before update on public.role_signups
for each row execute function public.set_updated_at();

-- =============================================================================
-- Helpers (security definer, so policies on one table can ask about another
-- without the two tables' policies calling each other in a loop).
-- =============================================================================

create function public.is_event_organiser(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.volunteer_events where id = p_event_id and creator_id = auth.uid()
  );
$$;

-- Same rule as the volunteer_events select policy, usable from other tables.
create function public.can_see_volunteer_event(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.volunteer_events e
    where e.id = p_event_id
      and (
        e.status = 'published'
        or e.creator_id = auth.uid()
        or public.is_staff()
        or exists (
          select 1 from public.role_signups s
          where s.event_id = e.id and s.student_id = auth.uid()
        )
      )
  );
$$;

-- Who may confirm SUPW hours for an event:
--   admins; staff with the `supw` responsibility; for a student-run event the
--   teacher who approved it; for a staff-run event the organising teacher.
create function public.can_confirm_hours(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_admin()
    or (
      public.is_staff()
      and (
        public.has_responsibility('supw')
        or exists (
          select 1 from public.volunteer_events e
          where e.id = p_event_id
            and (
              e.approved_by = auth.uid()
              or (e.creator_id = auth.uid() and public.is_staff_member(e.creator_id))
            )
        )
      )
    );
$$;

create function public.role_selected_count(p_role_id uuid)
returns int
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::int from public.role_signups where role_id = p_role_id and status = 'selected';
$$;

-- True if the student already holds an active sign-up in this event and the
-- event allows only one role per student.
create function public.signup_conflicts(p_event_id uuid, p_student_id uuid, p_ignore_signup uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not e.allow_multiple_roles
    and exists (
      select 1 from public.role_signups s
      where s.event_id = p_event_id
        and s.student_id = p_student_id
        and s.status in ('applied', 'selected', 'waitlisted')
        and s.id is distinct from p_ignore_signup
    )
  from public.volunteer_events e
  where e.id = p_event_id;
$$;

-- "Sun 18 Oct, 7:00 · Primary library" for notification text.
create function public.event_when_where(p_event public.volunteer_events)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select public.format_school_time(p_event.starts_at) || ' · ' || coalesce(
    (select r.name || ' (' || r.code || ')' from public.rooms r where r.id = p_event.room_id),
    p_event.place_text,
    ''
  );
$$;

-- =============================================================================
-- Event triggers
-- =============================================================================

-- New events: students' wait for approval, staff events go live.
create function public.volunteer_events_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.approved_by := null;
  new.approval_note := null;
  if public.is_staff_member(new.creator_id) then
    new.status := 'published';
  else
    new.status := 'awaiting_approval';
  end if;
  return new;
end;
$$;

create trigger volunteer_events_before_insert
before insert on public.volunteer_events
for each row execute function public.volunteer_events_before_insert();

-- Edits and status changes. Changes with no signed-in user (seed data, the
-- dashboard) or made by our own triggers (pg_trigger_depth() > 1) are trusted.
create function public.volunteer_events_before_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_is_creator boolean := old.creator_id = auth.uid();
  v_creator_is_staff boolean := public.is_staff_member(old.creator_id);
  v_approval_fields text[] := array['status', 'approval_note', 'approved_by', 'updated_at'];
begin
  new.creator_id := old.creator_id;

  if v_uid is null or pg_trigger_depth() > 1 then
    return new;
  end if;

  -- A teacher who isn't the organiser may only approve or send back.
  if not v_is_creator and not public.is_admin()
     and (to_jsonb(new) - v_approval_fields) is distinct from (to_jsonb(old) - v_approval_fields) then
    raise exception 'Only the organiser can edit this event.';
  end if;

  -- A student's event is locked once a teacher has approved it.
  if v_is_creator and not v_creator_is_staff and old.status in ('published', 'closed')
     and (to_jsonb(new) - array['status', 'updated_at']) is distinct from (to_jsonb(old) - array['status', 'updated_at']) then
    raise exception 'This event is live, so its details are locked. Ask a teacher if something needs to change.';
  end if;

  if new.status is distinct from old.status then
    if old.status = 'awaiting_approval' and new.status in ('published', 'sent_back') then
      if not public.is_staff() then
        raise exception 'Only a teacher or admin can approve or send back an event.';
      end if;
      if new.status = 'sent_back' and coalesce(trim(new.approval_note), '') = '' then
        raise exception 'Add a note saying what needs to change.';
      end if;
      new.approved_by := case when new.status = 'published' then v_uid end;
    elsif old.status = 'sent_back' and new.status = 'awaiting_approval' then
      if not v_is_creator then
        raise exception 'Only the organiser can resubmit this event.';
      end if;
    elsif new.status = 'closed' then
      if not (v_is_creator or public.is_admin()) then
        raise exception 'Only the organiser or an admin can close this event.';
      end if;
    elsif old.status = 'closed' and new.status = 'published' then
      if not (public.is_admin() or (v_is_creator and (v_creator_is_staff or old.approved_by is not null))) then
        raise exception 'Only the organiser or an admin can reopen this event.';
      end if;
    else
      raise exception 'An event can''t go from % to %.', old.status, new.status;
    end if;
  elsif new.approved_by is distinct from old.approved_by then
    -- approved_by only ever changes as part of an approval.
    new.approved_by := old.approved_by;
  end if;

  return new;
end;
$$;

create trigger volunteer_events_before_update
before update on public.volunteer_events
for each row execute function public.volunteer_events_before_update();

create function public.volunteer_events_notify()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_link text := '/volunteer/' || new.id;
  v_creator text := (select full_name from public.profiles where id = new.creator_id);
begin
  -- Submitted (or resubmitted) for approval: tell every teacher.
  if new.status = 'awaiting_approval'
     and (tg_op = 'INSERT' or old.status is distinct from 'awaiting_approval') then
    perform public.notify(
      p.id, 'vol_event_pending_approval',
      'Event to approve: ' || new.title,
      v_creator || ' created a volunteering event.',
      v_link
    )
    from public.profiles p
    where p.role = 'teacher';
  elsif tg_op = 'UPDATE' and old.status = 'awaiting_approval' and new.status = 'published' then
    perform public.notify(
      new.creator_id, 'vol_event_approved',
      'Your event is live: ' || new.title,
      'A teacher approved it. Students can sign up now.',
      v_link
    );
  elsif tg_op = 'UPDATE' and old.status = 'awaiting_approval' and new.status = 'sent_back' then
    perform public.notify(
      new.creator_id, 'vol_event_sent_back',
      'Changes needed: ' || new.title,
      coalesce(new.approval_note, ''),
      v_link
    );
  end if;
  return null;
end;
$$;

create trigger volunteer_events_notify
after insert or update on public.volunteer_events
for each row execute function public.volunteer_events_notify();

-- A role can't shrink below the number of students already selected for it.
create function public.event_roles_before_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.event_id := old.event_id;
  if new.spots_wanted < public.role_selected_count(new.id) then
    raise exception 'This role already has % selected students. Unselect someone first.',
      public.role_selected_count(new.id);
  end if;
  return new;
end;
$$;

create trigger event_roles_before_update
before update on public.event_roles
for each row execute function public.event_roles_before_update();

-- =============================================================================
-- Sign-up triggers
-- =============================================================================

-- Refuses a selection that would take a role past its spots_wanted.
create function public.assert_role_has_space(p_role_id uuid, p_signup_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_wanted int;
  v_selected int;
begin
  -- Lock the role row. Two organisers selecting at the same moment now take
  -- turns here instead of both squeezing into the last spot.
  select spots_wanted into v_wanted from public.event_roles where id = p_role_id for update;
  select count(*) into v_selected
  from public.role_signups
  where role_id = p_role_id and status = 'selected' and id is distinct from p_signup_id;
  if v_selected >= v_wanted then
    raise exception 'This role already has all % students it needs.', v_wanted;
  end if;
end;
$$;

create function public.role_signups_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.volunteer_events;
begin
  select e.* into v_event
  from public.event_roles r join public.volunteer_events e on e.id = r.event_id
  where r.id = new.role_id;
  new.event_id := v_event.id;

  -- Sign-ups from the app start fresh, whatever was sent.
  if auth.uid() is not null and pg_trigger_depth() = 1 then
    if v_event.status <> 'published' then
      raise exception 'This event isn''t open for sign-ups.';
    end if;
    if v_event.signup_deadline is not null and now() > v_event.signup_deadline then
      raise exception 'Sign-ups for this event have closed.';
    end if;
    if new.student_id = v_event.creator_id then
      raise exception 'You''re organising this event, so you can''t sign up for it.';
    end if;
    new.status := 'applied';
    new.attended := null;
    new.hours_confirmed := null;
    new.confirmed_by := null;
    new.confirmed_at := null;
  end if;

  if public.signup_conflicts(new.event_id, new.student_id, new.id) then
    raise exception 'You''ve already signed up for a role in this event. The organiser allows one role each.';
  end if;

  if new.status = 'selected' then
    perform public.assert_role_has_space(new.role_id, new.id);
  elsif new.status = 'applied'
     and public.role_selected_count(new.role_id) >= (select spots_wanted from public.event_roles where id = new.role_id) then
    -- The role is already full: join the waitlist.
    new.status := 'waitlisted';
  end if;
  return new;
end;
$$;

create trigger role_signups_before_insert
before insert on public.role_signups
for each row execute function public.role_signups_before_insert();

create function public.role_signups_before_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_is_student boolean := old.student_id = auth.uid();
  v_is_organiser boolean := public.is_event_organiser(old.event_id) or public.is_admin();
  v_can_confirm boolean := public.can_confirm_hours(old.event_id);
  v_event public.volunteer_events;
begin
  new.student_id := old.student_id;
  new.event_id := (select event_id from public.event_roles where id = new.role_id);
  if new.event_id is distinct from old.event_id then
    raise exception 'A sign-up can only move to another role in the same event.';
  end if;

  if v_uid is not null and pg_trigger_depth() = 1 then
    if new.role_id <> old.role_id and not v_is_organiser then
      raise exception 'Only the organiser can move someone to another role.';
    end if;
    if new.note is distinct from old.note and not v_is_student then
      raise exception 'Only the student can change their note.';
    end if;

    if new.status is distinct from old.status then
      if v_is_student and new.status = 'withdrawn' then
        if old.status not in ('applied', 'selected', 'waitlisted') then
          raise exception 'There''s nothing to withdraw from.';
        end if;
      elsif v_is_student and old.status = 'withdrawn' and new.status = 'applied' then
        -- Signing up again after withdrawing: same checks as a new sign-up.
        select * into v_event from public.volunteer_events where id = old.event_id;
        if v_event.status <> 'published'
           or (v_event.signup_deadline is not null and now() > v_event.signup_deadline) then
          raise exception 'Sign-ups for this event have closed.';
        end if;
        if public.signup_conflicts(new.event_id, new.student_id, new.id) then
          raise exception 'You''ve already signed up for a role in this event. The organiser allows one role each.';
        end if;
        if public.role_selected_count(new.role_id)
           >= (select spots_wanted from public.event_roles where id = new.role_id) then
          new.status := 'waitlisted';
        end if;
      elsif v_is_organiser then
        if old.status = 'withdrawn' or new.status = 'withdrawn' then
          raise exception 'Only the student can withdraw or sign up again.';
        end if;
      else
        raise exception 'Only the organiser can choose volunteers.';
      end if;
    end if;

    if new.attended is distinct from old.attended and not (v_is_organiser or v_can_confirm) then
      raise exception 'Only the organiser can mark attendance.';
    end if;

    if new.hours_confirmed is distinct from old.hours_confirmed then
      if not v_can_confirm then
        raise exception 'Only a teacher can confirm SUPW hours.';
      end if;
      if new.hours_confirmed is not null and new.attended is not true then
        raise exception 'Mark the student as attended before confirming hours.';
      end if;
      new.confirmed_by := case when new.hours_confirmed is not null then v_uid end;
      new.confirmed_at := case when new.hours_confirmed is not null then now() end;
    else
      new.confirmed_by := old.confirmed_by;
      new.confirmed_at := old.confirmed_at;
    end if;
  end if;

  -- The cap applies to everyone, always.
  if new.status = 'selected' and (old.status <> 'selected' or new.role_id <> old.role_id) then
    perform public.assert_role_has_space(new.role_id, new.id);
  end if;
  return new;
end;
$$;

create trigger role_signups_before_update
before update on public.role_signups
for each row execute function public.role_signups_before_update();

create function public.role_signups_notify()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.volunteer_events;
  v_role_name text := (select name from public.event_roles where id = new.role_id);
  v_student text := (select full_name from public.profiles where id = new.student_id);
  v_link text;
begin
  select * into v_event from public.volunteer_events where id = new.event_id;
  v_link := '/volunteer/' || v_event.id;

  if tg_op = 'INSERT' then
    perform public.notify(
      v_event.creator_id, 'vol_signup_new',
      v_student || ' signed up: ' || v_role_name,
      v_event.title,
      v_link
    );
    if new.status = 'waitlisted' then
      perform public.notify(
        new.student_id, 'vol_waitlisted',
        'Waitlisted: ' || v_role_name || ', ' || v_event.title,
        'This role is full. The organiser will let you know if a spot opens.',
        v_link
      );
    end if;
    return null;
  end if;

  if new.status = 'selected' and (old.status <> 'selected' or new.role_id <> old.role_id) then
    perform public.notify(
      new.student_id, 'vol_selected',
      'You''re in: ' || v_role_name || ', ' || v_event.title,
      public.event_when_where(v_event),
      v_link
    );
    -- Role now full: everyone still waiting goes on the waitlist (and is told,
    -- because that update runs this trigger again for each of them).
    if public.role_selected_count(new.role_id)
       >= (select spots_wanted from public.event_roles where id = new.role_id) then
      update public.role_signups
      set status = 'waitlisted'
      where role_id = new.role_id and status = 'applied';
    end if;
  elsif new.status = 'waitlisted' and old.status <> 'waitlisted' then
    perform public.notify(
      new.student_id, 'vol_waitlisted',
      'Waitlisted: ' || v_role_name || ', ' || v_event.title,
      'The organiser will let you know if a spot opens.',
      v_link
    );
  elsif new.status = 'withdrawn' and old.status = 'selected' then
    perform public.notify(
      v_event.creator_id, 'vol_withdrawal',
      v_student || ' withdrew from ' || v_role_name,
      'Pick someone from the waitlist for ' || v_event.title || '.',
      v_link
    );
  end if;
  return null;
end;
$$;

create trigger role_signups_notify
after insert or update on public.role_signups
for each row execute function public.role_signups_notify();

-- =============================================================================
-- Row Level Security
-- =============================================================================
alter table public.volunteer_events enable row level security;
alter table public.event_roles enable row level security;
alter table public.role_signups enable row level security;

-- Published events for everyone; unapproved ones only for their creator and
-- staff; plus any event you've signed up for (so it stays in your history).
create policy "Read visible volunteer events"
on public.volunteer_events for select to authenticated
using (
  status = 'published'
  or creator_id = (select auth.uid())
  or public.is_staff()
  or exists (
    -- Written in full: a bare `id` here would mean role_signups.id.
    select 1 from public.role_signups s
    where s.event_id = volunteer_events.id and s.student_id = (select auth.uid())
  )
);

create policy "Anyone creates their own events"
on public.volunteer_events for insert to authenticated
with check (creator_id = (select auth.uid()));

-- The trigger above decides which columns each person may change.
create policy "Organisers and staff update events"
on public.volunteer_events for update to authenticated
using (creator_id = (select auth.uid()) or public.is_staff())
with check (creator_id = (select auth.uid()) or public.is_staff());

create policy "Organisers delete unpublished events, admins any"
on public.volunteer_events for delete to authenticated
using (
  public.is_admin()
  or (
    creator_id = (select auth.uid())
    and (status in ('awaiting_approval', 'sent_back') or public.is_staff())
  )
);

create policy "Read roles of visible events"
on public.event_roles for select to authenticated
using (public.can_see_volunteer_event(event_id));

create policy "Organisers manage roles"
on public.event_roles for all to authenticated
using (public.is_event_organiser(event_id) or public.is_admin())
with check (public.is_event_organiser(event_id) or public.is_admin());

-- Students see their own sign-ups; organisers see their event's; staff see all.
create policy "Read own, organised or (staff) all sign-ups"
on public.role_signups for select to authenticated
using (
  student_id = (select auth.uid())
  or public.is_event_organiser(event_id)
  or public.is_staff()
);

create policy "Students sign themselves up"
on public.role_signups for insert to authenticated
with check (student_id = (select auth.uid()));

-- The trigger decides who may change what (withdraw, select, attendance, hours).
create policy "Students, organisers and staff update sign-ups"
on public.role_signups for update to authenticated
using (
  student_id = (select auth.uid())
  or public.is_event_organiser(event_id)
  or public.is_staff()
);

-- =============================================================================
-- Read functions
-- =============================================================================

-- How full each role is, for every event you can see. Counts only: you can't
-- read other people's sign-ups, but you may know how many spots are taken.
create function public.volunteer_role_counts()
returns table (
  event_id uuid,
  role_id uuid,
  spots_wanted int,
  selected_count int,
  waitlisted_count int,
  applied_count int
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    r.event_id,
    r.id,
    r.spots_wanted,
    (count(*) filter (where s.status = 'selected'))::int,
    (count(*) filter (where s.status = 'waitlisted'))::int,
    (count(*) filter (where s.status = 'applied'))::int
  from public.event_roles r
  left join public.role_signups s on s.role_id = r.id
  where public.can_see_volunteer_event(r.event_id)
  group by r.id;
$$;

-- Everyone who signed up for an event, with contact email and SUPW hours so
-- far. Only the organiser and staff.
create function public.event_signups(p_event_id uuid)
returns table (
  signup_id uuid,
  role_id uuid,
  role_name text,
  student_id uuid,
  full_name text,
  grade int,
  section text,
  email text,
  note text,
  status public.signup_status,
  attended boolean,
  hours_confirmed numeric,
  supw_hours_so_far numeric,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (public.is_event_organiser(p_event_id) or public.is_staff()) then
    raise exception 'Only the organiser and staff can see who signed up.' using errcode = '42501';
  end if;
  return query
    select
      s.id, s.role_id, r.name, s.student_id, p.full_name, p.grade, p.section, p.email,
      s.note, s.status, s.attended, s.hours_confirmed,
      coalesce((
        select sum(o.hours_confirmed) from public.role_signups o where o.student_id = s.student_id
      ), 0),
      s.created_at
    from public.role_signups s
    join public.event_roles r on r.id = s.role_id
    join public.profiles p on p.id = s.student_id
    where s.event_id = p_event_id
    order by r.created_at, s.created_at;
end;
$$;

-- Attended sign-ups waiting for this teacher to confirm hours (Approvals tab).
create function public.hours_to_confirm()
returns table (
  signup_id uuid,
  event_id uuid,
  event_title text,
  event_starts_at timestamptz,
  role_name text,
  student_id uuid,
  full_name text,
  grade int,
  suggested_hours numeric
)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, e.id, e.title, e.starts_at, r.name, s.student_id, p.full_name, p.grade, e.supw_hours
  from public.role_signups s
  join public.volunteer_events e on e.id = s.event_id
  join public.event_roles r on r.id = s.role_id
  join public.profiles p on p.id = s.student_id
  where s.attended
    and s.hours_confirmed is null
    and public.can_confirm_hours(e.id)
  order by e.starts_at, p.full_name;
$$;

-- Whole-school SUPW totals for the CSV export. Admins and the SUPW coordinator.
create function public.supw_hours_report()
returns table (
  student_id uuid,
  full_name text,
  email text,
  grade int,
  section text,
  events_attended int,
  hours_confirmed numeric
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (public.is_admin() or (public.is_staff() and public.has_responsibility('supw'))) then
    raise exception 'Only admins and the SUPW coordinator can export hours.' using errcode = '42501';
  end if;
  return query
    select
      p.id, p.full_name, p.email, p.grade, p.section,
      (count(distinct s.event_id) filter (where s.attended))::int,
      coalesce(sum(s.hours_confirmed), 0)
    from public.profiles p
    left join public.role_signups s on s.student_id = p.id
    where p.role = 'student'
    group by p.id
    order by p.grade, p.section, p.full_name;
end;
$$;

-- Internal building blocks of the triggers above, not part of the app's API.
-- (signup_conflicts would otherwise reveal whether a student signed up.)
revoke execute on function public.signup_conflicts(uuid, uuid, uuid) from authenticated;
revoke execute on function public.assert_role_has_space(uuid, uuid) from authenticated;
