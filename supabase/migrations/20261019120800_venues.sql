-- =============================================================================
-- 08 Venue booking.
--
-- Tables:    venues, bookings
-- Functions: booking_details(), venue_reminders()
--
-- Rules (plan, "Venue booking"):
--   * Staff requests start `pending`. A student request must name a
--     supervising teacher and starts `awaiting_teacher` until that teacher
--     confirms (Q2: only if app_settings.students_can_request_venues).
--   * Venues that don't need approval approve automatically if the slot is free.
--   * Only staff with the `venues` responsibility (or admins) approve or reject.
--   * No double bookings, guaranteed by an exclusion constraint.
--   * Approving a booking rejects overlapping pending requests for that venue,
--     and tells their requesters the slot was taken.
--   * Approvers are told about new pending requests (in-app + immediate email)
--     and reminded about old ones (venue_reminders()). Requesters hear every
--     decision. Ticking `announce` posts the approved booking to the feed.
--   * Everyone can see approved bookings (title, venue, time). Requesters,
--     supervising teachers and venue staff see the full details.
-- =============================================================================

-- btree_gist lets one index mix "equal venue" with "overlapping time range".
create extension if not exists btree_gist with schema extensions;

create type public.booking_status as enum (
  'awaiting_teacher', 'pending', 'approved', 'rejected', 'cancelled'
);

create table public.venues (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  room_id uuid references public.rooms (id) on delete set null,
  capacity int check (capacity > 0),
  needs_approval boolean not null default true,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues (id) on delete restrict,
  requester_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  supervising_teacher_id uuid references public.profiles (id) on delete set null,
  title text not null check (char_length(trim(title)) between 1 and 120),
  purpose text not null default '' check (char_length(purpose) <= 1000),
  expected_attendance int check (expected_attendance > 0),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status public.booking_status not null default 'pending',
  reviewed_by uuid references public.profiles (id) on delete set null,
  review_note text,
  announce boolean not null default false,
  last_reminder_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bookings_ends_after_start check (ends_at > starts_at),

  -- THE double-booking guarantee. Among approved bookings, no two rows may
  -- have the same venue (=) and overlapping times (&&). '[)' means the end
  -- time is not included, so 9:00–10:30 and 10:30–12:00 don't clash.
  -- Postgres checks this across transactions: if two approvers click at the
  -- same instant, the second one waits for the first, then fails.
  constraint bookings_no_double_booking exclude using gist (
    venue_id with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  ) where (status = 'approved')
);

create index bookings_venue_time_idx on public.bookings (venue_id, starts_at);
create index bookings_requester_idx on public.bookings (requester_id);

create trigger venues_updated_at
before update on public.venues
for each row execute function public.set_updated_at();

create trigger bookings_updated_at
before update on public.bookings
for each row execute function public.set_updated_at();

create trigger venues_audit
after insert or update or delete on public.venues
for each row execute function public.audit_change();

-- =============================================================================
-- Helpers
-- =============================================================================

create function public.can_review_venues()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_admin() or (public.is_staff() and public.has_responsibility('venues'));
$$;

create function public.booking_overlaps_approved(
  p_venue_id uuid, p_starts timestamptz, p_ends timestamptz, p_ignore uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.bookings
    where venue_id = p_venue_id
      and status = 'approved'
      and tstzrange(starts_at, ends_at, '[)') && tstzrange(p_starts, p_ends, '[)')
      and id is distinct from p_ignore
  );
$$;

-- When a booking reaches `pending`, a venue that doesn't need approval
-- approves it straight away, provided the slot is still free.
create function public.booking_auto_approve(p_booking public.bookings)
returns public.bookings
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_booking.status = 'pending'
     and not (select needs_approval from public.venues where id = p_booking.venue_id)
     and not public.booking_overlaps_approved(p_booking.venue_id, p_booking.starts_at, p_booking.ends_at, p_booking.id) then
    p_booking.status := 'approved';
    p_booking.review_note := 'Approved automatically: this venue doesn''t need approval.';
  end if;
  return p_booking;
end;
$$;

-- =============================================================================
-- Triggers
-- =============================================================================

create function public.bookings_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_venue public.venues;
begin
  select * into v_venue from public.venues where id = new.venue_id;
  if not v_venue.active then
    raise exception '% isn''t available for booking right now.', v_venue.name;
  end if;

  new.reviewed_by := null;
  new.review_note := null;
  new.last_reminder_at := null;
  new.announce := false;

  if public.is_staff_member(new.requester_id) then
    new.status := 'pending';
  else
    if not (select students_can_request_venues from public.app_settings) then
      raise exception 'Students can''t request venues at the moment. Ask a teacher to book it for you.';
    end if;
    if new.supervising_teacher_id is null then
      raise exception 'Choose the teacher who will supervise.';
    end if;
    if not public.is_staff_member(new.supervising_teacher_id) then
      raise exception 'The supervising teacher must be a member of staff.';
    end if;
    new.status := 'awaiting_teacher';
  end if;

  new := public.booking_auto_approve(new);
  return new;
end;
$$;

create trigger bookings_before_insert
before insert on public.bookings
for each row execute function public.bookings_before_insert();

-- Who may move a booking from one status to another:
--   awaiting_teacher -> pending | rejected     the supervising teacher (or venue staff rejecting)
--   pending          -> approved | rejected    venue staff only
--   any              -> cancelled              the requester, or venue staff (override)
create function public.bookings_before_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_is_requester boolean := old.requester_id = auth.uid();
  v_is_supervisor boolean := old.supervising_teacher_id = auth.uid();
  v_is_reviewer boolean := public.can_review_venues();
begin
  new.requester_id := old.requester_id;
  new.venue_id := old.venue_id;
  new.starts_at := old.starts_at;
  new.ends_at := old.ends_at;

  if v_uid is null or pg_trigger_depth() > 1 then
    return new;
  end if;

  -- Requesters may fix the wording until it's decided. Times and venue never
  -- change: cancel and request again instead, so approvals stay meaningful.
  if (new.title, new.purpose, new.expected_attendance)
     is distinct from (old.title, old.purpose, old.expected_attendance) then
    if not v_is_requester or old.status not in ('awaiting_teacher', 'pending') then
      raise exception 'Only the requester can edit a booking, and only before it''s decided.';
    end if;
  end if;

  if new.status is distinct from old.status then
    if new.status = 'cancelled' then
      if not (v_is_requester or v_is_reviewer) then
        raise exception 'Only the requester or venue staff can cancel a booking.';
      end if;
      if old.status in ('rejected', 'cancelled') then
        raise exception 'This booking is already closed.';
      end if;
    elsif old.status = 'awaiting_teacher' and new.status = 'pending' then
      if not v_is_supervisor then
        raise exception 'Only the supervising teacher can confirm this request.';
      end if;
      new := public.booking_auto_approve(new);
    elsif old.status = 'awaiting_teacher' and new.status = 'rejected' then
      if not (v_is_supervisor or v_is_reviewer) then
        raise exception 'Only the supervising teacher can decline this request.';
      end if;
      new.reviewed_by := v_uid;
    elsif old.status = 'pending' and new.status in ('approved', 'rejected') then
      if not v_is_reviewer then
        raise exception 'Only venue approvers can approve or reject bookings.';
      end if;
      new.reviewed_by := v_uid;
    else
      raise exception 'A booking can''t go from % to %.', old.status, new.status;
    end if;
  end if;

  -- The announce tick-box and review note belong to the approver.
  if (new.announce is distinct from old.announce or new.review_note is distinct from old.review_note)
     and not (v_is_reviewer or v_is_supervisor) then
    raise exception 'Only venue approvers can set the review note or announcement.';
  end if;
  new.last_reminder_at := old.last_reminder_at;
  return new;
end;
$$;

create trigger bookings_before_update
before update on public.bookings
for each row execute function public.bookings_before_update();

create function public.bookings_after_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_venue text := (select name from public.venues where id = new.venue_id);
  v_when text := public.format_school_time(new.starts_at) || '–' || to_char(new.ends_at at time zone 'Asia/Dubai', 'FMHH24:MI');
  v_requester text := (select full_name from public.profiles where id = new.requester_id);
  v_changed boolean := tg_op = 'INSERT' or new.status is distinct from old.status;
begin
  if not v_changed then
    return null;
  end if;

  if new.status = 'awaiting_teacher' then
    perform public.notify(
      new.supervising_teacher_id, 'booking_awaiting_teacher',
      v_requester || ' asked you to supervise: ' || new.title,
      v_venue || ' · ' || v_when,
      '/approvals'
    );
  elsif new.status = 'pending' then
    perform public.notify_responsibility(
      'venues', 'booking_pending',
      'Venue request: ' || new.title,
      v_venue || ' · ' || v_when || ' · from ' || v_requester,
      '/approvals',
      false,
      true -- email immediately
    );
  elsif new.status = 'approved' then
    -- Reject everything still waiting for an overlapping slot in this venue.
    -- Each rejection fires this trigger again, which tells that requester.
    update public.bookings
    set status = 'rejected',
        reviewed_by = new.reviewed_by,
        review_note = 'Slot taken: another booking for this venue was approved for this time.'
    where venue_id = new.venue_id
      and id <> new.id
      and status in ('pending', 'awaiting_teacher')
      and tstzrange(starts_at, ends_at, '[)') && tstzrange(new.starts_at, new.ends_at, '[)');

    perform public.notify(
      new.requester_id, 'booking_approved',
      'Booking approved: ' || new.title,
      v_venue || ' · ' || v_when,
      '/book/mine'
    );

    if new.announce then
      insert into public.announcements (author_id, posted_as, title, body, audience)
      values (
        coalesce(new.reviewed_by, new.requester_id),
        v_venue,
        new.title,
        v_venue || ' · ' || v_when || coalesce(E'\n' || nullif(new.purpose, ''), ''),
        'school'
      );
    end if;
  elsif new.status = 'rejected' then
    perform public.notify(
      new.requester_id, 'booking_rejected',
      'Booking not approved: ' || new.title,
      coalesce(new.review_note, v_venue || ' · ' || v_when),
      '/book/mine'
    );
  elsif new.status = 'cancelled' and tg_op = 'UPDATE' and old.status = 'approved'
        and auth.uid() is distinct from new.requester_id then
    -- Venue staff overrode an approved booking: the requester must know.
    perform public.notify(
      new.requester_id, 'booking_rejected',
      'Booking cancelled: ' || new.title,
      coalesce(new.review_note, 'Venue staff cancelled this booking.'),
      '/book/mine'
    );
  end if;
  return null;
end;
$$;

create trigger bookings_after_write
after insert or update on public.bookings
for each row execute function public.bookings_after_write();

-- =============================================================================
-- Row Level Security and column privileges
-- =============================================================================
alter table public.venues enable row level security;
alter table public.bookings enable row level security;

create policy "Everyone reads venues"
on public.venues for select to authenticated
using (true);

create policy "Admins manage venues"
on public.venues for all to authenticated
using (public.is_admin())
with check (public.is_admin());

-- Rows: approved bookings are public (to signed-in users); others only to the
-- people involved and venue staff.
create policy "Read approved bookings, or ones you're involved in"
on public.bookings for select to authenticated
using (
  status = 'approved'
  or requester_id = (select auth.uid())
  or supervising_teacher_id = (select auth.uid())
  or public.can_review_venues()
);

create policy "Request bookings as yourself"
on public.bookings for insert to authenticated
with check (requester_id = (select auth.uid()));

create policy "Involved people and venue staff update bookings"
on public.bookings for update to authenticated
using (
  requester_id = (select auth.uid())
  or supervising_teacher_id = (select auth.uid())
  or public.can_review_venues()
);

-- Columns: straight from the table, everyone gets only the calendar fields
-- (what, where, when, status). Who asked, why, and the review note come from
-- booking_details(), which checks you're involved.
revoke select on public.bookings from authenticated;
grant select (id, venue_id, title, starts_at, ends_at, status, created_at, updated_at)
  on public.bookings to authenticated;

-- Full details of the bookings you're involved in (your requests, ones you
-- supervise) or, for venue staff, all of them. `overlaps_pending` flags
-- requests competing for the same slot, for the approval queue.
create function public.booking_details()
returns table (
  id uuid,
  venue_id uuid,
  venue_name text,
  requester_id uuid,
  requester_name text,
  requester_role public.user_role,
  supervising_teacher_id uuid,
  supervising_teacher_name text,
  title text,
  purpose text,
  expected_attendance int,
  starts_at timestamptz,
  ends_at timestamptz,
  status public.booking_status,
  reviewed_by uuid,
  review_note text,
  announce boolean,
  created_at timestamptz,
  overlaps_pending int
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    b.id, b.venue_id, v.name, b.requester_id, rq.full_name, rq.role,
    b.supervising_teacher_id, st.full_name,
    b.title, b.purpose, b.expected_attendance, b.starts_at, b.ends_at, b.status,
    b.reviewed_by, b.review_note, b.announce, b.created_at,
    (
      select count(*)::int from public.bookings o
      where o.venue_id = b.venue_id
        and o.id <> b.id
        and o.status in ('pending', 'awaiting_teacher')
        and tstzrange(o.starts_at, o.ends_at, '[)') && tstzrange(b.starts_at, b.ends_at, '[)')
    )
  from public.bookings b
  join public.venues v on v.id = b.venue_id
  join public.profiles rq on rq.id = b.requester_id
  left join public.profiles st on st.id = b.supervising_teacher_id
  where b.requester_id = auth.uid()
     or b.supervising_teacher_id = auth.uid()
     or public.can_review_venues();
$$;

-- =============================================================================
-- Reminders (Q10). Finds bookings still pending after
-- app_settings.venue_reminder_hours, or whose event is within
-- venue_reminder_days_before days, and reminds venue staff at most once a day
-- per booking. Scheduled hourly by pg_cron where available (next migration).
-- =============================================================================
create function public.venue_reminders()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_settings public.app_settings;
  v_booking record;
  v_count int := 0;
begin
  select * into v_settings from public.app_settings;
  for v_booking in
    select b.*, v.name as venue_name
    from public.bookings b join public.venues v on v.id = b.venue_id
    where b.status = 'pending'
      and b.starts_at > now()
      and (
        b.created_at < now() - make_interval(hours => v_settings.venue_reminder_hours)
        or b.starts_at < now() + make_interval(days => v_settings.venue_reminder_days_before)
      )
      and (b.last_reminder_at is null or b.last_reminder_at < now() - interval '1 day')
    order by b.starts_at
  loop
    perform public.notify_responsibility(
      'venues', 'booking_reminder',
      'Still waiting: ' || v_booking.title,
      v_booking.venue_name || ' · ' || public.format_school_time(v_booking.starts_at),
      '/approvals',
      false,
      true
    );
    update public.bookings set last_reminder_at = now() where id = v_booking.id;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

revoke execute on function public.venue_reminders() from public, anon, authenticated;

-- Internal building block of the booking triggers, not part of the app's API.
revoke execute on function public.booking_auto_approve(public.bookings) from authenticated;
