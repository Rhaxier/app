-- =============================================================================
-- REPAIR for the after-school migration (20261114120000), for a project where
-- it is half applied (for example one setting column exists and the other
-- doesn't, so applying the migration fails with "column already exists").
-- Finishes the job instead of undoing it. Safe to run in any state, any number
-- of times. Changes no bookings and keeps any value already set.
-- Afterwards run check_part0_after_school.sql: rows 1-4 must all say yes.
-- =============================================================================
begin;

alter table public.app_settings
  add column if not exists after_school_block_minutes int not null default 30
    check (after_school_block_minutes between 15 and 120 and after_school_block_minutes % 5 = 0);
alter table public.app_settings
  add column if not exists after_school_until time not null default '18:00';

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

do $$
begin
  if to_regclass('supabase_migrations.schema_migrations') is not null then
    insert into supabase_migrations.schema_migrations (version) values ('20261114120000')
    on conflict (version) do nothing;
  end if;
end;
$$;

commit;
