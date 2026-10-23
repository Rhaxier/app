-- =============================================================================
-- 11 Admin overview: the numbers on the admin dashboard's home page.
--
-- Functions (admins only; each one checks is_admin() before anything else):
--   admin_attention()             what's waiting, by kind, with the oldest age
--   admin_metrics()               activity for the last 7 and 30 days
--   admin_venue_utilisation(days) booked hours ÷ bookable hours, per venue
--   admin_supw_by_grade(days)     SUPW hours confirmed, per grade
-- Helper:
--   venue_bookable_minutes(venue, day)  how long a venue can be booked that day.
--   Later migrations make it smarter (periods, holidays, venue hours); every
--   number that depends on it follows automatically.
--
-- Everything is counted here, in the database. The browser receives a handful
-- of numbers, never the rows behind them, so the dashboard stays fast and no
-- personal data travels just to be added up.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- How many minutes a venue can be booked on a day. For now: the booking slots
-- from app_settings on school days, nothing on other days.
-- -----------------------------------------------------------------------------
create function public.venue_bookable_minutes(p_venue_id uuid, p_day date)
returns int
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when extract(dow from p_day)::int = any (s.school_days)
      then s.booking_slots_per_day * s.booking_slot_minutes
    else 0
  end
  from public.app_settings s;
$$;

revoke execute on function public.venue_bookable_minutes(uuid, date) from authenticated;

-- -----------------------------------------------------------------------------
-- "Needs attention": one row per kind of waiting item.
--   item_count    how many are waiting
--   urgent_count  how many of them are urgent (fix-it reports only)
--   oldest_at     when the longest-waiting one started waiting
-- -----------------------------------------------------------------------------
create function public.admin_attention()
returns table (kind text, item_count int, urgent_count int, oldest_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Only admins can see the dashboard.' using errcode = '42501';
  end if;

  return query
    select 'events_to_approve', count(*)::int, 0, min(e.created_at)
    from public.volunteer_events e
    where e.status = 'awaiting_approval'
    union all
    select 'venue_requests', count(*)::int, 0, min(b.created_at)
    from public.bookings b
    where b.status = 'pending'
    union all
    select 'bookings_awaiting_teacher', count(*)::int, 0, min(b.created_at)
    from public.bookings b
    where b.status = 'awaiting_teacher'
    union all
    -- Waiting since the organiser marked attendance (the row's last edit).
    select 'hours_to_confirm', count(*)::int, 0, min(s.updated_at)
    from public.role_signups s
    where s.attended and s.hours_confirmed is null
    union all
    select 'open_reports', count(*)::int, (count(*) filter (where r.urgent))::int, min(r.created_at)
    from public.reports r
    where r.status in ('open', 'acknowledged', 'in_progress')
    union all
    select 'reported_content', count(*)::int, 0, min(c.created_at)
    from public.content_reports c
    where c.status = 'open'
    union all
    select 'hidden_posts', count(*)::int, 0, min(p.hidden_at)
    from public.collab_posts p
    where p.hidden_by is not null;
end;
$$;

-- -----------------------------------------------------------------------------
-- Activity for the last 7 and for the last 30 days (two rows).
--   active_users    people who signed in or did anything in the app
--                   (see docs/OPEN_QUESTIONS.md, "What counts as active?")
--   new_reports, resolved_reports, avg_days_to_resolve
--   bookings_requested  requests made
--   bookings_held       approved bookings that took place
--   supw_hours_confirmed
--   collab_posts_created, collab_posts_filled (of those, how many are full)
-- -----------------------------------------------------------------------------
create function public.admin_metrics()
returns table (
  days int,
  active_users int,
  new_reports int,
  resolved_reports int,
  avg_days_to_resolve numeric,
  bookings_requested int,
  bookings_held int,
  supw_hours_confirmed numeric,
  collab_posts_created int,
  collab_posts_filled int
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_days int;
  v_since timestamptz;
begin
  if not public.is_admin() then
    raise exception 'Only admins can see the dashboard.' using errcode = '42501';
  end if;

  foreach v_days in array array[7, 30] loop
    v_since := now() - make_interval(days => v_days);
    return query
      select
        v_days,
        (
          select count(distinct a.user_id)::int from (
            select u.id as user_id from auth.users u where u.last_sign_in_at >= v_since
            union all select r.reporter_id from public.reports r where r.created_at >= v_since
            union all select v.user_id from public.report_votes v where v.created_at >= v_since
            union all select s.student_id from public.role_signups s where s.created_at >= v_since
            union all select e.creator_id from public.volunteer_events e where e.created_at >= v_since
            union all select p.owner_id from public.collab_posts p where p.created_at >= v_since
            union all select j.requester_id from public.join_requests j where j.created_at >= v_since
            union all select b.requester_id from public.bookings b where b.created_at >= v_since
            union all select n.author_id from public.announcements n where n.created_at >= v_since
            union all select p.owner_id from public.projects p where p.updated_at >= v_since
            union all select n.recipient_id from public.notifications n where n.read_at >= v_since
          ) a
        ),
        (select count(*)::int from public.reports r where r.created_at >= v_since),
        (select count(*)::int from public.reports r where r.resolved_at >= v_since),
        (
          select round(avg(extract(epoch from r.resolved_at - r.created_at) / 86400)::numeric, 1)
          from public.reports r
          where r.resolved_at >= v_since
        ),
        (select count(*)::int from public.bookings b where b.created_at >= v_since),
        (
          select count(*)::int from public.bookings b
          where b.status = 'approved' and b.starts_at >= v_since and b.starts_at < now()
        ),
        (
          select coalesce(sum(s.hours_confirmed), 0)
          from public.role_signups s
          where s.confirmed_at >= v_since
        ),
        (select count(*)::int from public.collab_posts p where p.created_at >= v_since),
        (
          select count(*)::int from public.collab_posts p
          where p.created_at >= v_since and p.status = 'full'
        );
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- Venue utilisation over the last p_days full days (Dubai dates, today not
-- included): approved booked hours ÷ bookable hours, for each active venue.
-- utilisation is null when the venue had no bookable time at all.
-- -----------------------------------------------------------------------------
create function public.admin_venue_utilisation(p_days int)
returns table (
  venue_id uuid,
  venue_name text,
  booked_hours numeric,
  bookable_hours numeric,
  utilisation numeric
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'Asia/Dubai')::date;
  v_from timestamptz;
  v_to timestamptz;
begin
  if not public.is_admin() then
    raise exception 'Only admins can see the dashboard.' using errcode = '42501';
  end if;
  if p_days is null or p_days not between 1 and 366 then
    raise exception 'Choose between 1 and 366 days.';
  end if;

  v_from := (v_today - p_days)::timestamp at time zone 'Asia/Dubai';
  v_to := v_today::timestamp at time zone 'Asia/Dubai';

  return query
    select
      v.id,
      v.name,
      round(booked.minutes / 60.0, 1),
      round(bookable.minutes / 60.0, 1),
      case when bookable.minutes > 0 then round(booked.minutes / bookable.minutes, 3) end
    from public.venues v
    cross join lateral (
      -- Only the part of each booking inside the window counts.
      select coalesce(sum(
        extract(epoch from least(b.ends_at, v_to) - greatest(b.starts_at, v_from)) / 60
      ), 0)::numeric as minutes
      from public.bookings b
      where b.venue_id = v.id
        and b.status = 'approved'
        and b.starts_at < v_to
        and b.ends_at > v_from
    ) booked
    cross join lateral (
      select coalesce(sum(public.venue_bookable_minutes(v.id, d::date)), 0)::numeric as minutes
      from generate_series(v_today - p_days, v_today - 1, interval '1 day') d
    ) bookable
    where v.active
    order by v.name;
end;
$$;

-- -----------------------------------------------------------------------------
-- SUPW hours confirmed in the last p_days days, per grade (null = no grade set).
-- -----------------------------------------------------------------------------
create function public.admin_supw_by_grade(p_days int)
returns table (grade int, students int, hours numeric)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Only admins can see the dashboard.' using errcode = '42501';
  end if;
  if p_days is null or p_days not between 1 and 366 then
    raise exception 'Choose between 1 and 366 days.';
  end if;

  return query
    select p.grade, count(distinct s.student_id)::int, sum(s.hours_confirmed)
    from public.role_signups s
    join public.profiles p on p.id = s.student_id
    where s.hours_confirmed is not null
      and s.confirmed_at >= now() - make_interval(days => p_days)
    group by p.grade
    order by p.grade nulls last;
end;
$$;
