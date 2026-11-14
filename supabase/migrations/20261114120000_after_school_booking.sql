-- =============================================================================
-- 22 After-school booking.
--
-- Settings: app_settings.after_school_block_minutes (default 30)
--           app_settings.after_school_until         (default 18:00)
-- Function: booking_period_problem() (replaced)
--
-- Venues can now be booked after school without turning on custom times.
-- Each school day, after-school time starts when that day's last period ends,
-- rounded up to the block length (with 30-minute blocks and the 2026-27
-- timetable: 15:00 Monday and Tuesday, 16:00 Wednesday and Thursday after the
-- 14:15-15:50 Collab / PD block, 11:30 Friday). From then until
-- after_school_until, a booking is one block or several in a row. During
-- school hours bookings still follow the periods, as before.
--
-- Every other rule still applies: holidays and blackouts, each venue's own
-- bookable hours and longest booking, how far ahead, and no two approved
-- bookings at once. Existing bookings are left as they are.
-- =============================================================================

alter table public.app_settings
  -- Length of each after-school booking block, in minutes. Admin > Venues.
  add column after_school_block_minutes int not null default 30
    check (after_school_block_minutes between 15 and 120 and after_school_block_minutes % 5 = 0),
  -- The latest time an after-school booking can end. Admin > Venues.
  add column after_school_until time not null default '18:00';

-- -----------------------------------------------------------------------------
-- Why a booking from p_starts to p_ends doesn't fit the bell times (or the
-- after-school blocks), in words, or null if it does (or if custom times are
-- allowed).
-- -----------------------------------------------------------------------------
create or replace function public.booking_period_problem(p_starts timestamptz, p_ends timestamptz)
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
  v_block int;
  v_until time;
  v_last_end time;
  v_after time; -- when after-school time starts that day
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

  -- After school: from the last period's end, rounded up to the block grid.
  select after_school_block_minutes, after_school_until into v_block, v_until
  from public.app_settings;
  select max(ends_at) into v_last_end from public.periods where v_day = any (weekdays);
  v_after := time '00:00'
    + make_interval(mins => (ceil(extract(epoch from v_last_end) / 60 / v_block) * v_block)::int);

  if v_start::time >= v_after then
    if v_end::time > v_until then
      return format('After school, bookings can run until %s.', to_char(v_until, 'HH24:MI'));
    end if;
    if (extract(epoch from v_start::time - v_after)::int / 60) % v_block <> 0
      or (extract(epoch from v_end::time - v_after)::int / 60) % v_block <> 0 then
      return format('After school on %s, bookings start and end on %s-minute blocks from %s.',
        public.weekday_name(v_day), v_block, to_char(v_after, 'HH24:MI'));
    end if;
    return null;
  end if;

  -- School hours: one period, or a run of consecutive ones.
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
