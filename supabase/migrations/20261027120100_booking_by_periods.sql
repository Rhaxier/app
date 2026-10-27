-- =============================================================================
-- 21 Book venues by periods.
--
-- Setting:   app_settings.allow_custom_booking_times (default false)
-- Functions: booking_period_problem(), bookings_check_rules() (replaced)
--
-- Until now the app offered periods, but the database accepted any start and
-- end. Now a new booking must start when a period starts and end when a
-- period ends, on that date's weekday: one period, or a run of consecutive
-- ones. A short Friday therefore really is shorter. An admin can turn on
-- allow_custom_booking_times to allow other times again (e.g. after school).
--
-- Existing bookings are left as they are: the check runs when a booking is
-- requested, and a booking's times can't be changed afterwards (see
-- bookings_before_update in the venues migration). Every earlier rule still
-- applies: holidays and blackouts, bookable hours, longest booking, how far
-- ahead, and no two approved bookings at once.
-- =============================================================================

alter table public.app_settings
  -- Off: bookings line up with the bell times. On: any start and end time
  -- (the venue's other limits still apply). Admin > Venues.
  add column allow_custom_booking_times boolean not null default false;

-- -----------------------------------------------------------------------------
-- Why a booking from p_starts to p_ends doesn't fit the bell times, in words,
-- or null if it does (or if custom times are allowed).
-- -----------------------------------------------------------------------------
create function public.booking_period_problem(p_starts timestamptz, p_ends timestamptz)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  -- Periods are wall-clock times in Dubai, so compare in Dubai time.
  v_start timestamp := p_starts at time zone 'Asia/Dubai';
  v_end timestamp := p_ends at time zone 'Asia/Dubai';
  v_day int := extract(dow from v_start)::int;
begin
  if (select allow_custom_booking_times from public.app_settings) then
    return null;
  end if;

  if v_end::date <> v_start::date then
    return 'A booking starts and ends on the same day.';
  end if;
  if not exists (select 1 from public.periods where v_day = any (weekdays)) then
    return format('There are no periods on %s, so nothing can be booked.', public.weekday_name(v_day));
  end if;
  if not exists (select 1 from public.periods where v_day = any (weekdays) and starts_at = v_start::time) then
    return format('Bookings follow the bell times, and no period starts at %s on %s.',
      to_char(v_start, 'HH24:MI'), public.weekday_name(v_day));
  end if;
  if not exists (select 1 from public.periods where v_day = any (weekdays) and ends_at = v_end::time) then
    return format('Bookings follow the bell times, and no period ends at %s on %s.',
      to_char(v_end, 'HH24:MI'), public.weekday_name(v_day));
  end if;
  -- Starting on a period's start and ending on a later period's end covers
  -- exactly the periods in between (they can't overlap; see the periods
  -- trigger), and the bookings table already insists the end is after the start.
  return null;
end;
$$;

revoke execute on function public.booking_period_problem(timestamptz, timestamptz) from authenticated;

-- -----------------------------------------------------------------------------
-- The booking rules trigger, as before plus the bell times check.
-- -----------------------------------------------------------------------------
create or replace function public.bookings_check_rules()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_venue public.venues;
  v_problem text := public.booking_calendar_problem(new.venue_id, new.starts_at, new.ends_at);
  v_start timestamp := new.starts_at at time zone 'Asia/Dubai';
  v_end timestamp := new.ends_at at time zone 'Asia/Dubai';
begin
  if v_problem is not null then
    raise exception 'This venue can''t be booked then: %', v_problem;
  end if;

  v_problem := public.booking_period_problem(new.starts_at, new.ends_at);
  if v_problem is not null then
    raise exception '%', v_problem;
  end if;

  select * into v_venue from public.venues where id = new.venue_id;

  if (v_venue.bookable_from is not null and v_start::time < v_venue.bookable_from)
     or (v_venue.bookable_until is not null
         and (v_end::date > v_start::date or v_end::time > v_venue.bookable_until)) then
    raise exception '% can be booked between % and %.', v_venue.name,
      to_char(coalesce(v_venue.bookable_from, '00:00'), 'HH24:MI'),
      to_char(coalesce(v_venue.bookable_until, '23:59'), 'HH24:MI');
  end if;

  if v_venue.max_booking_minutes is not null
     and new.ends_at - new.starts_at > make_interval(mins => v_venue.max_booking_minutes) then
    raise exception 'Bookings for % can be at most % minutes long.', v_venue.name, v_venue.max_booking_minutes;
  end if;

  if v_venue.max_days_ahead is not null
     and v_start::date > (now() at time zone 'Asia/Dubai')::date + v_venue.max_days_ahead then
    raise exception '% can be booked up to % days ahead.', v_venue.name, v_venue.max_days_ahead;
  end if;
  return new;
end;
$$;
