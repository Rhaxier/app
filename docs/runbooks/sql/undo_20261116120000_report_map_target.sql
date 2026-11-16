-- =============================================================================
-- UNDO 20261116120000_report_map_target.sql (part 3). Run by hand only.
--
-- Puts report_feed() back exactly as it was and removes the two columns.
-- WARNING: the "what is it about" link on reports made since is lost (the
-- reports themselves stay). Safe to run in any state: anything already gone
-- is skipped.
-- =============================================================================
begin;

drop trigger if exists reports_check_map_target on public.reports;
drop function if exists public.reports_check_map_target();

-- report_feed() as it was before part 3 (20261023120300_feature_settings.sql).
drop function if exists public.report_feed();
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
  voted_by_me boolean
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
    exists (select 1 from public.report_votes v where v.report_id = r.id and v.user_id = auth.uid())
  from public.reports r
  join public.profiles rp on rp.id = r.reporter_id
  left join public.report_categories c on c.key = r.category
  left join public.rooms rm on rm.id = r.room_id
  left join public.profiles asg on asg.id = r.assigned_to
  where public.can_see_report(r.id)
  order by r.created_at desc;
$$;

alter table public.reports
  drop constraint if exists reports_map_target_both,
  drop column if exists map_target_id,
  drop column if exists map_target_kind;
drop type if exists public.map_target_kind;

do $$
begin
  if to_regclass('supabase_migrations.schema_migrations') is not null then
    delete from supabase_migrations.schema_migrations where version = '20261116120000';
  end if;
end;
$$;

commit;
