-- =============================================================================
-- 09 Fix-it reports.
--
-- Tables:    reports, report_votes, report_category_routes
-- Functions: report_feed(), open_reports_in_room(), attach_report_photo()
-- Storage:   private bucket `report-photos`: reports/<report_id>/<file>
--
-- Rules (plan, "Fix-it reports"):
--   * The category picks the team through report_category_routes (seeded:
--     it -> it, everything else -> facilities). Everyone holding that
--     responsibility is notified; urgent reports email immediately, the rest
--     go in the daily digest.
--   * Before reporting, the app shows open reports in the room; "Me too" adds
--     a vote instead of a duplicate report.
--   * Responsible staff (or admins) assign, change status, mark duplicates.
--     Each status change notifies the reporter and every "me too" voter.
--   * Only teachers (staff) can mark a report urgent.
--   * Privacy: students never see who reported something. Staff do.
-- =============================================================================

create type public.report_category as enum (
  'electrical', 'ac', 'plumbing', 'furniture', 'it', 'cleanliness', 'other'
);

create type public.report_status as enum (
  'open', 'acknowledged', 'in_progress', 'resolved', 'duplicate', 'wont_fix'
);

create table public.report_category_routes (
  id uuid primary key default gen_random_uuid(),
  category public.report_category not null unique,
  responsibility public.responsibility_kind not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.report_category_routes (category, responsibility) values
  ('electrical', 'facilities'),
  ('ac', 'facilities'),
  ('plumbing', 'facilities'),
  ('furniture', 'facilities'),
  ('it', 'it'),
  ('cleanliness', 'facilities'),
  ('other', 'facilities');

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  room_id uuid references public.rooms (id) on delete set null,
  floor_id uuid references public.floors (id) on delete set null,
  x numeric,
  y numeric,
  category public.report_category not null,
  description text not null check (char_length(trim(description)) between 3 and 1000),
  photo_path text,
  status public.report_status not null default 'open',
  status_note text,
  assigned_to uuid references public.profiles (id) on delete set null,
  urgent boolean not null default false,
  duplicate_of uuid references public.reports (id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reports_duplicate_has_target check (status <> 'duplicate' or duplicate_of is not null),
  constraint reports_not_duplicate_of_itself check (duplicate_of is distinct from id)
);

create index reports_room_idx on public.reports (room_id) where status in ('open', 'acknowledged', 'in_progress');
create index reports_created_idx on public.reports (created_at desc);

create table public.report_votes (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (report_id, user_id)
);

create trigger report_category_routes_updated_at
before update on public.report_category_routes
for each row execute function public.set_updated_at();

create trigger report_category_routes_audit
after insert or update or delete on public.report_category_routes
for each row execute function public.audit_change();

create trigger reports_updated_at
before update on public.reports
for each row execute function public.set_updated_at();

-- =============================================================================
-- Helpers
-- =============================================================================

create function public.report_route(p_category public.report_category)
returns public.responsibility_kind
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select responsibility from public.report_category_routes where category = p_category),
    'facilities'
  );
$$;

-- Admins, or staff holding the responsibility this category is routed to.
create function public.can_manage_report(p_category public.report_category)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_admin()
    or (public.is_staff() and public.has_responsibility(public.report_route(p_category)));
$$;

-- Who can see a report at all: staff see everything; others see unresolved
-- ones (they're on the map), plus their own and ones they said "me too" to.
create function public.can_see_report(p_report_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.reports r
    where r.id = p_report_id
      and (
        public.is_staff()
        or r.status in ('open', 'acknowledged', 'in_progress')
        or r.reporter_id = auth.uid()
        or exists (select 1 from public.report_votes v where v.report_id = r.id and v.user_id = auth.uid())
      )
  );
$$;

-- "Electrical in Lab 1 (G.05)" for notification text.
create function public.report_headline(p_report public.reports)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select initcap(replace(p_report.category::text, '_', ' ')) || coalesce(
    ' in ' || (select r.name || ' (' || r.code || ')' from public.rooms r where r.id = p_report.room_id),
    ''
  );
$$;

-- =============================================================================
-- Triggers
-- =============================================================================

create function public.reports_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_room public.rooms;
begin
  if auth.uid() is not null and pg_trigger_depth() = 1 then
    if new.urgent and not public.is_staff() then
      raise exception 'Only teachers can mark a report as urgent.';
    end if;
    new.status := 'open';
    new.status_note := null;
    new.assigned_to := null;
    new.duplicate_of := null;
    new.resolved_at := null;
    new.photo_path := null; -- added afterwards with attach_report_photo()
  end if;

  -- A report in a room is pinned on that room unless a spot was chosen.
  if new.room_id is not null then
    select * into v_room from public.rooms where id = new.room_id;
    new.floor_id := v_room.floor_id;
    new.x := coalesce(new.x, v_room.x);
    new.y := coalesce(new.y, v_room.y);
  end if;
  return new;
end;
$$;

create trigger reports_before_insert
before insert on public.reports
for each row execute function public.reports_before_insert();

create function public.reports_before_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_can_manage boolean := public.can_manage_report(old.category);
begin
  new.reporter_id := old.reporter_id;

  if auth.uid() is not null and pg_trigger_depth() = 1 then
    if new.urgent is distinct from old.urgent and not public.is_staff() then
      raise exception 'Only teachers can mark a report as urgent.';
    end if;
    if new.photo_path is distinct from old.photo_path
       and not (old.reporter_id = auth.uid() or v_can_manage) then
      raise exception 'Only the reporter can add a photo.';
    end if;
    if (new.status, new.status_note, new.assigned_to, new.duplicate_of, new.category,
        new.description, new.room_id, new.floor_id, new.x, new.y)
       is distinct from
       (old.status, old.status_note, old.assigned_to, old.duplicate_of, old.category,
        old.description, old.room_id, old.floor_id, old.x, old.y)
       and not v_can_manage then
      raise exception 'Only the staff responsible for this kind of problem can update it.';
    end if;
    if new.assigned_to is distinct from old.assigned_to
       and new.assigned_to is not null and not public.is_staff_member(new.assigned_to) then
      raise exception 'Reports can only be assigned to staff.';
    end if;
  end if;

  if new.status is distinct from old.status then
    new.resolved_at := case when new.status = 'resolved' then now() end;
    if new.status <> 'duplicate' then
      new.duplicate_of := null;
    end if;
  end if;
  return new;
end;
$$;

create trigger reports_before_update
before update on public.reports
for each row execute function public.reports_before_update();

create function public.reports_notify()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_link text := '/reports/' || new.id;
  v_headline text := public.report_headline(new);
  v_status_label text := replace(initcap(replace(new.status::text, '_', ' ')), 'Wont Fix', 'Won''t fix');
  v_person uuid;
begin
  if tg_op = 'INSERT' then
    perform public.notify_responsibility(
      public.report_route(new.category), 'report_new',
      case when new.urgent then 'URGENT: ' else 'New report: ' end || v_headline,
      left(new.description, 140),
      v_link,
      new.urgent
    );
    return null;
  end if;

  -- A teacher just marked it urgent: tell the team again, by immediate email.
  if new.urgent and not old.urgent then
    perform public.notify_responsibility(
      public.report_route(new.category), 'report_new',
      'URGENT: ' || v_headline,
      left(new.description, 140),
      v_link,
      true
    );
  end if;

  if new.status is distinct from old.status then
    for v_person in
      select new.reporter_id
      union
      select user_id from public.report_votes where report_id = new.id
    loop
      perform public.notify(
        v_person, 'report_status',
        v_status_label || ': ' || v_headline,
        coalesce(new.status_note, left(new.description, 140)),
        v_link
      );
    end loop;
  end if;
  return null;
end;
$$;

create trigger reports_notify
after insert or update on public.reports
for each row execute function public.reports_notify();

create function public.report_votes_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_report public.reports;
begin
  select * into v_report from public.reports where id = new.report_id;
  if v_report.reporter_id = new.user_id then
    raise exception 'You reported this one, so it already counts you.';
  end if;
  if v_report.status not in ('open', 'acknowledged', 'in_progress') then
    raise exception 'This report is already closed.';
  end if;
  return new;
end;
$$;

create trigger report_votes_before_insert
before insert on public.report_votes
for each row execute function public.report_votes_before_insert();

-- =============================================================================
-- Row Level Security and column privileges
-- =============================================================================
alter table public.report_category_routes enable row level security;
alter table public.reports enable row level security;
alter table public.report_votes enable row level security;

create policy "Everyone reads routes"
on public.report_category_routes for select to authenticated
using (true);

create policy "Admins change routes"
on public.report_category_routes for all to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "Read reports you may see"
on public.reports for select to authenticated
using (public.can_see_report(id));

create policy "Report as yourself"
on public.reports for insert to authenticated
with check (reporter_id = (select auth.uid()));

-- Staff update (teachers: urgent; responsible staff: everything else, as the
-- trigger decides). Reporters add photos through attach_report_photo().
create policy "Staff update reports"
on public.reports for update to authenticated
using (public.is_staff());

create policy "Admins delete reports"
on public.reports for delete to authenticated
using (public.is_admin());

-- Nobody reads reporter_id straight from the table. report_feed() hands it
-- out to staff only.
revoke select on public.reports from authenticated;
grant select (
  id, room_id, floor_id, x, y, category, description, photo_path, status, status_note,
  assigned_to, urgent, duplicate_of, resolved_at, created_at, updated_at
) on public.reports to authenticated;

create policy "Read own votes, staff read all"
on public.report_votes for select to authenticated
using (user_id = (select auth.uid()) or public.is_staff());

create policy "Vote as yourself"
on public.report_votes for insert to authenticated
with check (user_id = (select auth.uid()) and public.can_see_report(report_id));

create policy "Remove your own vote"
on public.report_votes for delete to authenticated
using (user_id = (select auth.uid()));

-- =============================================================================
-- Read functions
-- =============================================================================

-- The one way the app reads reports. reporter_id and reporter_name are filled
-- in for staff only; everyone else gets null (and reported_by_me for their own).
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
  category public.report_category,
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
    r.category, public.report_route(r.category),
    r.description, r.photo_path, r.status, r.status_note,
    r.assigned_to, asg.full_name, r.urgent, r.duplicate_of, r.resolved_at, r.created_at,
    (select count(*)::int from public.report_votes v where v.report_id = r.id),
    exists (select 1 from public.report_votes v where v.report_id = r.id and v.user_id = auth.uid())
  from public.reports r
  join public.profiles rp on rp.id = r.reporter_id
  left join public.rooms rm on rm.id = r.room_id
  left join public.profiles asg on asg.id = r.assigned_to
  where public.can_see_report(r.id)
  order by r.created_at desc;
$$;

-- The duplicate check: unresolved reports in a room, most "me too" first.
create function public.open_reports_in_room(p_room_id uuid)
returns table (
  id uuid,
  category public.report_category,
  description text,
  status public.report_status,
  urgent boolean,
  created_at timestamptz,
  vote_count int,
  voted_by_me boolean,
  reported_by_me boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select f.id, f.category, f.description, f.status, f.urgent, f.created_at,
         f.vote_count, f.voted_by_me, f.reported_by_me
  from public.report_feed() f
  where f.room_id = p_room_id
    and f.status in ('open', 'acknowledged', 'in_progress')
  order by f.vote_count desc, f.created_at desc;
$$;

-- After uploading to report-photos/reports/<id>/..., the reporter records the
-- path here (students can't update reports directly).
create function public.attach_report_photo(p_report_id uuid, p_path text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_path not like 'reports/' || p_report_id || '/%' then
    raise exception 'Photos must be uploaded to reports/<report id>/.';
  end if;
  if not exists (select 1 from public.reports where id = p_report_id and reporter_id = auth.uid()) then
    raise exception 'Only the reporter can add a photo.' using errcode = '42501';
  end if;
  update public.reports set photo_path = p_path where id = p_report_id;
end;
$$;

-- =============================================================================
-- Storage: private photos. Uploads go to reports/<report_id>/<file> by the
-- reporter; anyone who can see the report can view it through a short-lived
-- signed URL.
-- =============================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('report-photos', 'report-photos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/heic'])
on conflict (id) do nothing;

create function public.is_my_report(p_report_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.reports where id = p_report_id and reporter_id = auth.uid());
$$;

create policy "Reporters upload report photos"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'report-photos'
  and (storage.foldername(name))[1] = 'reports'
  and public.is_my_report(public.uuid_or_null((storage.foldername(name))[2]))
);

create policy "Report viewers see report photos"
on storage.objects for select to authenticated
using (
  bucket_id = 'report-photos'
  and public.can_see_report(public.uuid_or_null((storage.foldername(name))[2]))
);
