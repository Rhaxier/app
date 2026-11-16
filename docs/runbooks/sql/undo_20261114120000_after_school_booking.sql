-- =============================================================================
-- UNDO for 20261114120000_after_school_booking.sql. Run by hand. Safe in any
-- state (does nothing if it isn't applied).
--
-- Puts back the booking rule function from 20261027120100 (bell times only) and
-- removes the two settings. Any block length or end time an admin chose is lost.
-- Bookings already made after school are NOT touched: they stay as they are.
-- =============================================================================
begin;

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
  return null;
end;
$$;

revoke execute on function public.booking_period_problem(timestamptz, timestamptz) from authenticated;

alter table public.app_settings drop column if exists after_school_block_minutes;
alter table public.app_settings drop column if exists after_school_until;

do $$
begin
  if to_regclass('supabase_migrations.schema_migrations') is not null then
    delete from supabase_migrations.schema_migrations where version = '20261114120000';
  end if;
end;
$$;

commit;
