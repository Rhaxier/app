-- =============================================================================
-- 13 School calendar (admin dashboard, B3).
--
-- Tables:    periods, terms, holidays, venue_blackouts
-- Functions: calendar_day_note(), booking_calendar_problem(),
--            bookings_check_rules() (a new BEFORE INSERT trigger on bookings),
--            venue_bookable_minutes() (now from periods, holidays, blackouts)
--
-- What changes:
--   * The school week stays app_settings.school_days (Q11).
--   * Bookable times come from `periods` instead of the three slot settings,
--     which are removed. Periods can differ by weekday (a short Friday).
--     This migration turns the old slot settings into periods, so booking
--     works exactly as before until an admin edits them.
--   * Terms and holidays describe the school year. Booking date pickers grey
--     out holidays; volunteering forms warn about them.
--   * Venue blackouts (e.g. "Exams") block bookings for one venue or all.
--   * The database refuses booking requests that touch a holiday or a
--     blackout, with a clear message.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Periods: the bookable blocks of a school day.
-- -----------------------------------------------------------------------------
create table public.periods (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 40),
  starts_at time not null,
  ends_at time not null,
  sort_order int not null default 0,
  -- Which days this period runs on: 0 = Sunday … 6 = Saturday.
  weekdays int[] not null check (cardinality(weekdays) > 0 and weekdays <@ '{0,1,2,3,4,5,6}'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint periods_end_after_start check (ends_at > starts_at)
);

-- Turn the old settings (first slot, slot length, slots per day) into periods
-- on the school's days, so nothing changes until an admin edits them.
insert into public.periods (name, starts_at, ends_at, sort_order, weekdays)
select
  'Period ' || n,
  s.booking_day_start + make_interval(mins => (n - 1) * s.booking_slot_minutes),
  s.booking_day_start + make_interval(mins => n * s.booking_slot_minutes),
  n,
  s.school_days
from public.app_settings s
cross join generate_series(1, (select booking_slots_per_day from public.app_settings)) as n;

alter table public.app_settings
  drop column booking_day_start,
  drop column booking_slot_minutes,
  drop column booking_slots_per_day;

-- -----------------------------------------------------------------------------
-- Terms, holidays and venue blackouts: date ranges, both ends included.
-- -----------------------------------------------------------------------------
create table public.terms (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 60),
  starts_on date not null,
  ends_on date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint terms_end_after_start check (ends_on >= starts_on)
);

create table public.holidays (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 60),
  starts_on date not null,
  ends_on date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint holidays_end_after_start check (ends_on >= starts_on)
);

create table public.venue_blackouts (
  id uuid primary key default gen_random_uuid(),
  -- null = every venue (e.g. the whole school during exams).
  venue_id uuid references public.venues (id) on delete cascade,
  starts_on date not null,
  ends_on date not null,
  reason text not null check (char_length(trim(reason)) between 1 and 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint venue_blackouts_end_after_start check (ends_on >= starts_on)
);

create index holidays_dates_idx on public.holidays (starts_on, ends_on);
create index venue_blackouts_dates_idx on public.venue_blackouts (starts_on, ends_on);

create trigger periods_updated_at before update on public.periods
for each row execute function public.set_updated_at();
create trigger terms_updated_at before update on public.terms
for each row execute function public.set_updated_at();
create trigger holidays_updated_at before update on public.holidays
for each row execute function public.set_updated_at();
create trigger venue_blackouts_updated_at before update on public.venue_blackouts
for each row execute function public.set_updated_at();

create trigger periods_audit after insert or update or delete on public.periods
for each row execute function public.audit_change();
create trigger terms_audit after insert or update or delete on public.terms
for each row execute function public.audit_change();
create trigger holidays_audit after insert or update or delete on public.holidays
for each row execute function public.audit_change();
create trigger venue_blackouts_audit after insert or update or delete on public.venue_blackouts
for each row execute function public.audit_change();

-- Everyone reads the calendar (the booking and volunteering screens need it);
-- only admins change it.
alter table public.periods enable row level security;
alter table public.terms enable row level security;
alter table public.holidays enable row level security;
alter table public.venue_blackouts enable row level security;

create policy "Everyone reads periods" on public.periods for select to authenticated using (true);
create policy "Admins manage periods" on public.periods for all to authenticated
using (public.is_admin()) with check (public.is_admin());

create policy "Everyone reads terms" on public.terms for select to authenticated using (true);
create policy "Admins manage terms" on public.terms for all to authenticated
using (public.is_admin()) with check (public.is_admin());

create policy "Everyone reads holidays" on public.holidays for select to authenticated using (true);
create policy "Admins manage holidays" on public.holidays for all to authenticated
using (public.is_admin()) with check (public.is_admin());

create policy "Everyone reads venue blackouts" on public.venue_blackouts
for select to authenticated using (true);
create policy "Admins manage venue blackouts" on public.venue_blackouts for all to authenticated
using (public.is_admin()) with check (public.is_admin());

-- -----------------------------------------------------------------------------
-- What's special about a date for a venue, in words, or null if nothing is:
-- "a holiday (Mid-term break)" or "blacked out (Exams)".
-- -----------------------------------------------------------------------------
create function public.calendar_day_note(p_venue_id uuid, p_day date)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select 'a holiday (' || h.name || ')' from public.holidays h
     where p_day between h.starts_on and h.ends_on
     order by h.starts_on limit 1),
    (select 'blacked out (' || b.reason || ')' from public.venue_blackouts b
     where p_day between b.starts_on and b.ends_on
       and (b.venue_id is null or b.venue_id = p_venue_id)
     order by b.starts_on limit 1)
  );
$$;

-- The first calendar problem with a booking's dates, as a sentence, or null.
create function public.booking_calendar_problem(p_venue_id uuid, p_starts timestamptz, p_ends timestamptz)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select to_char(d, 'Dy FMDD Mon') || ' is ' || public.calendar_day_note(p_venue_id, d::date) || '.'
  from generate_series(
    (p_starts at time zone 'Asia/Dubai')::date,
    -- A booking ending exactly at midnight doesn't touch the next day.
    ((p_ends - interval '1 microsecond') at time zone 'Asia/Dubai')::date,
    interval '1 day'
  ) d
  where public.calendar_day_note(p_venue_id, d::date) is not null
  order by d
  limit 1;
$$;

-- Every rule about WHEN a venue may be booked, checked on each new request.
-- (Who may book, and the starting status, are in bookings_before_insert.)
-- Later migrations add the venue's own limits to this same function.
create function public.bookings_check_rules()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_problem text := public.booking_calendar_problem(new.venue_id, new.starts_at, new.ends_at);
begin
  if v_problem is not null then
    raise exception 'This venue can''t be booked then: %', v_problem;
  end if;
  return new;
end;
$$;

create trigger bookings_check_rules
before insert on public.bookings
for each row execute function public.bookings_check_rules();

-- -----------------------------------------------------------------------------
-- Bookable time per venue per day, for the overview's utilisation: the
-- periods that run that weekday, on school days, unless it's a holiday or
-- the venue is blacked out.
-- -----------------------------------------------------------------------------
create or replace function public.venue_bookable_minutes(p_venue_id uuid, p_day date)
returns int
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when not (extract(dow from p_day)::int = any (s.school_days))
      or public.calendar_day_note(p_venue_id, p_day) is not null then 0
    else coalesce((
      select sum(extract(epoch from p.ends_at - p.starts_at) / 60)::int
      from public.periods p
      where extract(dow from p_day)::int = any (p.weekdays)
    ), 0)
  end
  from public.app_settings s;
$$;

revoke execute on function public.venue_bookable_minutes(uuid, date) from authenticated;
revoke execute on function public.booking_calendar_problem(uuid, timestamptz, timestamptz) from authenticated;
