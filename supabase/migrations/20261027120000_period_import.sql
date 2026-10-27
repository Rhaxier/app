-- =============================================================================
-- 20 Bell times: upload the timetable as a CSV file.
--
-- Functions: admin_import_periods() (preview and import), weekday_name(),
--            weekday_from_text(), periods_check_overlap() (a new trigger)
--
-- What changes:
--   * Periods on the same weekday can't overlap any more. Booking works by
--     periods (next migration): "Period 2 to Period 3" only means something
--     when periods follow one another. The rule covers the admin editor and
--     the import alike.
--   * Admins can upload the whole timetable at once instead of entering
--     periods one by one. Columns: weekday, period_name, start_time, end_time,
--     order. Every weekday in the file gets exactly the periods in the file;
--     weekdays not in the file keep theirs.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Weekday names, for messages and for reading the CSV file.
-- 0 = Sunday … 6 = Saturday, the same numbers as periods.weekdays.
-- -----------------------------------------------------------------------------
create function public.weekday_name(p_day int)
returns text
language sql
immutable
set search_path = ''
as $$
  select (array['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'])[p_day + 1];
$$;

-- 'Monday', 'monday', 'Mon' and 'Tues' all mean 1: a day's name, or its first
-- three letters or more. Anything else is null (not a weekday).
create function public.weekday_from_text(p_text text)
returns int
language sql
immutable
set search_path = ''
as $$
  select d.n::int - 1
  from unnest(array['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'])
       with ordinality as d(name, n)
  where length(trim(p_text)) >= 3
    and starts_with(d.name, lower(trim(p_text)));
$$;

-- Internal helpers: the app doesn't call them.
revoke execute on function public.weekday_name(int) from authenticated;
revoke execute on function public.weekday_from_text(text) from authenticated;

-- -----------------------------------------------------------------------------
-- No two periods on the same weekday may overlap. Back to back is fine (one
-- ends at 09:00, the next starts at 09:00).
-- -----------------------------------------------------------------------------
create function public.periods_check_overlap()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_days int[] := new.weekdays;
  v_other public.periods;
  v_day int;
begin
  -- An edit that keeps the times only needs checking on the days it newly
  -- runs on. (So taking a day away from a period never fails, even if some
  -- old periods overlapped before this rule existed.)
  if tg_op = 'UPDATE' and new.starts_at = old.starts_at and new.ends_at = old.ends_at then
    v_days := array(select unnest(new.weekdays) except select unnest(old.weekdays));
  end if;

  select p.* into v_other
  from public.periods p
  where p.id <> new.id
    and p.weekdays && v_days
    and p.starts_at < new.ends_at
    and new.starts_at < p.ends_at
  order by p.starts_at
  limit 1;

  if found then
    select min(d) into v_day from unnest(v_days) as d where d = any (v_other.weekdays);
    raise exception '% (%–%) overlaps % (%–%) on %.',
      new.name, to_char(new.starts_at, 'HH24:MI'), to_char(new.ends_at, 'HH24:MI'),
      v_other.name, to_char(v_other.starts_at, 'HH24:MI'), to_char(v_other.ends_at, 'HH24:MI'),
      public.weekday_name(v_day)
      using errcode = '23P01';
  end if;
  return new;
end;
$$;

create trigger periods_check_overlap
before insert or update on public.periods
for each row execute function public.periods_check_overlap();

-- -----------------------------------------------------------------------------
-- The CSV import. p_rows is a JSON array of
--   {weekday, period_name, start_time, end_time, order}
-- with every value as text, straight from the file.
--
-- With p_dry_run (the preview) nothing is saved: each row comes back with
-- outcome 'ok' or 'error' and a message saying what's wrong. Problems found:
--   * a weekday that isn't one ('Funday')
--   * a missing or too long name, a time that isn't a time, a missing order
--   * a period that ends before (or when) it starts
--   * two periods on the same weekday that overlap, or share an order number
--
-- Without p_dry_run it saves, all or nothing: if any row has a problem nothing
-- changes. Every weekday in the file loses its old periods and gets the ones
-- in the file, in one transaction; other weekdays keep theirs.
--
-- Row numbers in messages are the file's line numbers (line 1 is the headings),
-- so an admin can find them in a spreadsheet.
-- -----------------------------------------------------------------------------
create function public.admin_import_periods(p_rows jsonb, p_dry_run boolean default true)
returns table (
  line int,
  weekday text,
  period_name text,
  start_time text,
  end_time text,
  sort_order text,
  outcome text,
  message text
)
language plpgsql
security definer
set search_path = ''
as $$
-- The result columns share names with the working table's columns; inside
-- SQL statements here, a bare name means the table column.
#variable_conflict use_column
declare
  v_settings public.app_settings;
  v_row jsonb;
  v_line int := 1;
  v_day int;
  v_name text;
  v_start_text text;
  v_end_text text;
  v_order_text text;
  v_problem text;
  v_days int[];
  v_removed int;
  v_trimmed int;
  v_added int;
  -- 7:30, 07:30 or 07:30:00, from 00:00 to 23:59.
  c_time constant text := '^([01]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$';
begin
  if not public.is_admin() then
    raise exception 'Only admins can change the bell times.' using errcode = '42501';
  end if;
  if jsonb_typeof(p_rows) is distinct from 'array' or jsonb_array_length(p_rows) = 0 then
    raise exception 'The file has no rows.';
  end if;
  if jsonb_array_length(p_rows) > 500 then
    raise exception 'Import at most 500 periods at a time.';
  end if;
  select * into v_settings from public.app_settings;

  -- A scratch table for this call only (gone at the end of the transaction).
  drop table if exists pg_temp.period_import;
  create temporary table period_import (
    line int primary key,
    day int,
    weekday text,
    period_name text,
    start_time text,
    end_time text,
    sort_order text,
    starts_at time,
    ends_at time,
    sort_number int,
    problem text,
    note text
  ) on commit drop;

  -- Pass 1: each row on its own. The first problem found is the one reported.
  for v_row in select value from jsonb_array_elements(p_rows) loop
    v_line := v_line + 1;
    v_day := public.weekday_from_text(v_row ->> 'weekday');
    v_name := trim(coalesce(v_row ->> 'period_name', ''));
    v_start_text := trim(coalesce(v_row ->> 'start_time', ''));
    v_end_text := trim(coalesce(v_row ->> 'end_time', ''));
    v_order_text := trim(coalesce(v_row ->> 'order', ''));
    v_problem := null;

    if v_day is null then
      v_problem := format('Unknown weekday "%s": use Sunday to Saturday, or Sun to Sat.',
        trim(coalesce(v_row ->> 'weekday', '')));
    elsif v_name = '' then
      v_problem := 'The period needs a name.';
    elsif char_length(v_name) > 40 then
      v_problem := 'Keep the name under 40 characters.';
    elsif v_start_text !~ c_time then
      v_problem := format('Start time "%s" isn''t a time like 07:30.', v_start_text);
    elsif v_end_text !~ c_time then
      v_problem := format('End time "%s" isn''t a time like 08:15.', v_end_text);
    elsif v_end_text::time <= v_start_text::time then
      v_problem := 'It ends before it starts.';
    elsif v_order_text !~ '^[0-9]{1,3}$' then
      v_problem := 'Order must be a whole number (1 for the first period of the day).';
    end if;

    insert into pg_temp.period_import
      (line, day, weekday, period_name, start_time, end_time, sort_order,
       starts_at, ends_at, sort_number, problem)
    values (
      v_line,
      v_day,
      coalesce(public.weekday_name(v_day), trim(coalesce(v_row ->> 'weekday', ''))),
      v_name,
      case when v_start_text ~ c_time then to_char(v_start_text::time, 'HH24:MI') else v_start_text end,
      case when v_end_text ~ c_time then to_char(v_end_text::time, 'HH24:MI') else v_end_text end,
      v_order_text,
      case when v_problem is null then v_start_text::time end,
      case when v_problem is null then v_end_text::time end,
      case when v_problem is null then v_order_text::int end,
      v_problem
    );
  end loop;

  -- Pass 2: rows against each other, on the same weekday. Only rows that were
  -- fine on their own take part (a broken time can't overlap anything).
  update pg_temp.period_import r
  set problem = format('Order %s is also used on line %s (%s).', r.sort_number, other.line, other.weekday)
  from pg_temp.period_import other
  where r.problem is null and other.problem is null
    and other.line <> r.line
    and other.day = r.day
    and other.sort_number = r.sort_number
    -- Report the first clash only (the one with the lowest line number).
    and other.line = (
      select min(o.line) from pg_temp.period_import o
      where o.line <> r.line and o.day = r.day and o.sort_number = r.sort_number and o.problem is null
    );

  update pg_temp.period_import r
  set problem = format('Overlaps %s (%s–%s) on line %s.', other.period_name, other.start_time, other.end_time, other.line)
  from pg_temp.period_import other
  where r.problem is null
    and other.line = (
      select min(o.line) from pg_temp.period_import o
      where o.line <> r.line and o.day = r.day
        and o.starts_at < r.ends_at and r.starts_at < o.ends_at
    );

  -- Not a mistake, just worth knowing: a weekday that isn't a school day.
  update pg_temp.period_import r
  set note = format('%s isn''t a school day: these periods show once it is (School week).', r.weekday)
  where r.problem is null and r.day <> all (v_settings.school_days);

  if not p_dry_run then
    if exists (select 1 from pg_temp.period_import where problem is not null) then
      raise exception 'Nothing was imported: fix the rows marked as problems first.';
    end if;

    select array_agg(distinct day order by day) into v_days from pg_temp.period_import;

    -- Weekdays in the file lose their old periods. A period that also runs on
    -- other days keeps those days.
    delete from public.periods where weekdays <@ v_days;
    get diagnostics v_removed = row_count;
    update public.periods
    set weekdays = array(select d from unnest(weekdays) as d where d <> all (v_days) order by d)
    where weekdays && v_days;
    get diagnostics v_trimmed = row_count;

    -- The same period on several days ("Period 1, 07:30–08:15" Monday to
    -- Thursday) is stored once, with all its days, like the admin editor does.
    insert into public.periods (name, starts_at, ends_at, sort_order, weekdays)
    select period_name, starts_at, ends_at, sort_number, array_agg(day order by day)
    from pg_temp.period_import
    group by period_name, starts_at, ends_at, sort_number;
    get diagnostics v_added = row_count;

    insert into public.audit_log (actor_id, action, table_name, row_id, details)
    values (auth.uid(), 'periods_imported', 'periods', null, jsonb_build_object(
      'weekdays', (select jsonb_agg(public.weekday_name(d) order by d) from unnest(v_days) as d),
      'rows', (select count(*) from pg_temp.period_import),
      'periods_added', v_added,
      'periods_removed', v_removed,
      'periods_trimmed', v_trimmed
    ));
  end if;

  return query
  select line, weekday, period_name, start_time, end_time, sort_order,
    case when problem is null then 'ok' else 'error' end,
    coalesce(problem, note)
  from pg_temp.period_import
  order by line;
end;
$$;
