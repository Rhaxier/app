-- =============================================================================
-- Fix-it reports about a lift, staircase or door (MAP_NOTES.md, spec 3).
--
-- A report can name the lift or stairs (a map_connectors row) or the door (a
-- door id from the traced map, e.g. 'G-D089') it is about. That lets the
-- staff who handle it mark that lift, stairs or door out of order with one
-- tap, and back in service when it's fixed (map_set_available, which
-- already checks who may and writes the audit log).
--
-- Why a report never closes anything by itself: one wrong or prank report
-- would stop every student's step-free route. Nothing in this file changes
-- map_connectors.available or map_overrides.
--
-- Needs 20261115120000_map_nav.sql (the map tables); not rooms migration A.
-- =============================================================================

create type public.map_target_kind as enum ('connector', 'door');

alter table public.reports
  add column map_target_kind public.map_target_kind,
  add column map_target_id text,
  add constraint reports_map_target_both check ((map_target_kind is null) = (map_target_id is null));

-- The target must exist on the map. On an update, only the staff who handle
-- this kind of report can change it (the reporter sets it when reporting).
create function public.reports_check_map_target()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE'
     and (new.map_target_kind, new.map_target_id) is not distinct from (old.map_target_kind, old.map_target_id) then
    return new;
  end if;
  if tg_op = 'UPDATE' and auth.uid() is not null and not public.can_manage_report(old.category) then
    raise exception 'Only the staff responsible for this kind of problem can change what it is about.';
  end if;
  -- Half a target is left to the reports_map_target_both check, which says so.
  if new.map_target_kind is null or new.map_target_id is null then
    return new;
  end if;
  if new.map_target_kind = 'connector'
     and not exists (select 1 from public.map_connectors where id::text = new.map_target_id) then
    raise exception 'That lift or staircase isn''t on the map any more.';
  end if;
  if new.map_target_kind = 'door'
     and not exists (select 1 from public.map_geometry_ids where id = new.map_target_id and kind = 'door') then
    raise exception '"%" is not a door on the map.', new.map_target_id;
  end if;
  return new;
end;
$$;

create trigger reports_check_map_target
before insert or update of map_target_kind, map_target_id on public.reports
for each row execute function public.reports_check_map_target();

-- -----------------------------------------------------------------------------
-- report_feed(): the same as before, plus what the report is about. The new
-- columns are added at the end; callers that pick columns are unaffected.
-- -----------------------------------------------------------------------------
drop function public.report_feed();

create function public.report_feed()
returns table (
  id uuid,
  reporter_id uuid,
  reporter_name text,
  reported_by_me boolean,
  room_id uuid,
  room_code text,
  room_name text,
  floor_id uuid,
  x numeric,
  y numeric,
  category text,
  category_name text,
  routed_to public.responsibility_kind,
  description text,
  photo_path text,
  status public.report_status,
  status_note text,
  assigned_to uuid,
  assigned_to_name text,
  urgent boolean,
  duplicate_of uuid,
  resolved_at timestamptz,
  created_at timestamptz,
  vote_count int,
  voted_by_me boolean,
  map_target_kind public.map_target_kind,
  map_target_id text,
  -- The lift's or staircase's name; null for doors (they have no names).
  map_target_name text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    r.id,
    case when public.is_staff() then r.reporter_id end,
    case when public.is_staff() then rp.full_name end,
    r.reporter_id = auth.uid(),
    r.room_id, rm.code, rm.name, r.floor_id, r.x, r.y,
    r.category, coalesce(c.name, r.category), coalesce(c.responsibility, 'facilities'),
    r.description, r.photo_path, r.status, r.status_note,
    r.assigned_to, asg.full_name, r.urgent, r.duplicate_of, r.resolved_at, r.created_at,
    (select count(*)::int from public.report_votes v where v.report_id = r.id),
    exists (select 1 from public.report_votes v where v.report_id = r.id and v.user_id = auth.uid()),
    r.map_target_kind,
    r.map_target_id,
    mc.name
  from public.reports r
  join public.profiles rp on rp.id = r.reporter_id
  left join public.report_categories c on c.key = r.category
  left join public.rooms rm on rm.id = r.room_id
  left join public.profiles asg on asg.id = r.assigned_to
  left join public.map_connectors mc
    on r.map_target_kind = 'connector' and mc.id::text = r.map_target_id
  where public.can_see_report(r.id)
  order by r.created_at desc;
$$;
