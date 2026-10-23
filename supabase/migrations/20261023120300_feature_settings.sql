-- =============================================================================
-- 14 Feature settings (admin dashboard, B4).
--
-- Announcements  publish_at (renamed from published_at), expires_at,
--                notified_at; app_settings.announcement_default_expiry_days;
--                publish_due_announcements() (cron) sends scheduled ones.
-- Collab         skill_tags, skill_tag_suggestions, admin_review_tag_suggestion();
--                app_settings.collab_max_team_size.
-- Volunteering   volunteer_categories (+ volunteer_events.category_id),
--                supw_targets (replaces app_settings.supw_hours_target),
--                app_settings.student_events_need_approval.
-- Map, fix-it    report_categories replaces the report_category enum and the
--                report_category_routes table (existing reports keep their
--                category: the old enum values become the table's keys);
--                app_settings.report_auto_urgent_votes; bucket floor-plans.
-- Venues         bookable_from / bookable_until, max_booking_minutes,
--                max_days_ahead, enforced in bookings_check_rules().
-- =============================================================================

-- =============================================================================
-- Announcements: schedule and expiry
-- =============================================================================

-- "published_at" with a future date read like a mistake; publish_at says what
-- it is: the moment it appears. Policies follow the rename automatically.
alter table public.announcements rename column published_at to publish_at;

alter table public.announcements
  add column expires_at timestamptz,
  -- When the "new announcement" notifications went out. Scheduled ones wait
  -- until publish_at (publish_due_announcements() below).
  add column notified_at timestamptz,
  add constraint announcements_expires_after_publish check (expires_at is null or expires_at > publish_at);

-- Everything already posted has been notified.
update public.announcements set notified_at = created_at;

alter table public.app_settings
  -- Pre-fills "Expires" on new announcements. Null = no expiry by default.
  add column announcement_default_expiry_days int check (announcement_default_expiry_days between 1 and 365);

-- Scheduled and expired announcements are hidden from everyone but their
-- author and admins (who manage them). Live ones: as before.
drop policy "Read announcements meant for me" on public.announcements;
create policy "Read announcements meant for me"
on public.announcements for select to authenticated
using (
  public.is_admin()
  or author_id = (select auth.uid())
  or (
    publish_at <= now()
    and (expires_at is null or expires_at > now())
    and (
      public.is_staff()
      or audience = 'school'
      or (
        public.my_grade() = any (grades)
        and (section_ids is null or public.my_section_id() = any (section_ids))
      )
    )
  )
);

-- Who hears about an announcement, in one place: used when it's posted (if
-- it's live straight away) and by the scheduler (when its time comes).
create function public.send_announcement_notifications(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  a public.announcements;
  v_body text;
  v_link text := '/announcements/' || p_id;
begin
  select * into a from public.announcements where id = p_id;
  v_body := left(a.body, 140);
  if a.audience = 'grades' then
    perform public.notify(p.id, 'announcement_new', a.title, v_body, v_link)
    from public.profiles p
    where p.role = 'student' and p.grade = any (a.grades)
      and (
        a.section_ids is null
        or exists (
          select 1 from public.sections s
          where s.id = any (a.section_ids) and s.grade = p.grade and lower(s.name) = lower(trim(p.section))
        )
      );
  elsif a.pinned then
    perform public.notify(p.id, 'announcement_new', a.title, v_body, v_link)
    from public.profiles p
    where p.id <> a.author_id;
  end if;
  update public.announcements set notified_at = now() where id = p_id;
end;
$$;

revoke execute on function public.send_announcement_notifications(uuid) from public, anon, authenticated;

create or replace function public.announcements_notify()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Scheduled for later: publish_due_announcements() sends them then.
  if new.publish_at <= now() then
    perform public.send_announcement_notifications(new.id);
  end if;
  return null;
end;
$$;

-- Runs every few minutes (pg_cron, below): sends the notifications for
-- scheduled announcements whose time has come. Returns how many.
create function public.publish_due_announcements()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_count int := 0;
begin
  for v_id in
    select id from public.announcements
    where notified_at is null and publish_at <= now()
      and (expires_at is null or expires_at > now())
  loop
    perform public.send_announcement_notifications(v_id);
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

revoke execute on function public.publish_due_announcements() from public, anon, authenticated;

do $$
begin
  perform cron.schedule('publish-announcements', '*/5 * * * *', 'select public.publish_due_announcements();');
exception when others then
  raise notice 'pg_cron is not available (%), so scheduled announcements are not sent automatically. Run select public.publish_due_announcements(); every few minutes.', sqlerrm;
end;
$$;

-- =============================================================================
-- Trusted changes made by admin functions
--
-- Feature triggers check "who is signed in may change this row?". Admin
-- functions sometimes change many rows for good reason (merging a skill tag
-- across everyone's posts; later, moderation). They first call
-- begin_trusted_change(), which lasts until the end of the transaction, and
-- the triggers below let those changes through. Ordinary users can't call it.
-- =============================================================================
create function public.begin_trusted_change()
returns void
language sql
security definer
set search_path = ''
as $$
  select set_config('app.trusted_change', 'on', true);
$$;

create function public.is_trusted_change()
returns boolean
language sql
stable
as $$
  select coalesce(current_setting('app.trusted_change', true), '') = 'on';
$$;

revoke execute on function public.begin_trusted_change() from public, anon, authenticated;

-- Same as in 07, except trusted changes skip the "who may change what" part.
create or replace function public.collab_posts_before_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_moderation text[] := array['hidden_by', 'hidden_at', 'hidden_reason', 'updated_at'];
  v_accepted int := public.collab_accepted_count(old.id);
begin
  new.owner_id := old.owner_id;

  if auth.uid() is not null and pg_trigger_depth() = 1 and not public.is_trusted_change() then
    if old.owner_id = auth.uid() and not public.is_staff() then
      -- Owners edit their post but can't unhide it.
      if new.hidden_by is distinct from old.hidden_by or new.hidden_reason is distinct from old.hidden_reason then
        raise exception 'A teacher is reviewing this post.';
      end if;
    elsif old.owner_id <> auth.uid() then
      -- Staff who aren't the owner may only hide or unhide.
      if (to_jsonb(new) - v_moderation) is distinct from (to_jsonb(old) - v_moderation) then
        raise exception 'Only the owner can edit this post.';
      end if;
    end if;

    if new.status is distinct from old.status and new.status = 'full' then
      raise exception 'A post becomes full on its own when enough people are accepted.';
    end if;
    if new.spots_wanted < v_accepted then
      raise exception '% people are already on the team. Remove someone first.', v_accepted;
    end if;
  end if;

  -- Record who hid it and when.
  if new.hidden_by is distinct from old.hidden_by then
    new.hidden_at := case when new.hidden_by is not null then now() end;
    if new.hidden_by is null then
      new.hidden_reason := null;
    end if;
  end if;

  -- Raising (or lowering) the number wanted reopens or fills the post.
  if new.status <> 'closed' then
    new.status := case when v_accepted >= new.spots_wanted then 'full' else 'open' end::public.collab_status;
  end if;
  return new;
end;
$$;

-- =============================================================================
-- Collab: skill tags, suggestions, team size
-- =============================================================================

create table public.skill_tags (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 40),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index skill_tags_name_key on public.skill_tags (lower(name));

-- The skills posts already use become the first tags.
insert into public.skill_tags (name)
select distinct on (lower(trim(skill))) trim(skill)
from public.collab_posts, unnest(skills) as skill
where trim(skill) <> ''
order by lower(trim(skill)), trim(skill);

create type public.tag_suggestion_status as enum ('pending', 'approved', 'merged', 'rejected');

create table public.skill_tag_suggestions (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 40),
  suggested_by uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  status public.tag_suggestion_status not null default 'pending',
  -- Approved: the new tag. Merged: the existing tag it was folded into.
  tag_id uuid references public.skill_tags (id) on delete set null,
  reviewed_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger skill_tags_updated_at before update on public.skill_tags
for each row execute function public.set_updated_at();
create trigger skill_tag_suggestions_updated_at before update on public.skill_tag_suggestions
for each row execute function public.set_updated_at();
create trigger skill_tags_audit after insert or update or delete on public.skill_tags
for each row execute function public.audit_change();

alter table public.skill_tags enable row level security;
alter table public.skill_tag_suggestions enable row level security;

create policy "Everyone reads skill tags" on public.skill_tags for select to authenticated using (true);
create policy "Admins manage skill tags" on public.skill_tags for all to authenticated
using (public.is_admin()) with check (public.is_admin());

-- Everyone sees pending suggestions (so the same one isn't suggested twice
-- and a post can use it while it waits); admins decide through the function.
create policy "Read suggestions" on public.skill_tag_suggestions for select to authenticated
using (status = 'pending' or suggested_by = (select auth.uid()) or public.is_admin());
create policy "Suggest a tag as yourself" on public.skill_tag_suggestions for insert to authenticated
with check (suggested_by = (select auth.uid()) and status = 'pending');

-- A suggestion must be new: not an existing tag, not already waiting.
create function public.skill_tag_suggestions_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.name := trim(new.name);
  if exists (select 1 from public.skill_tags where lower(name) = lower(new.name)) then
    raise exception '"%" is already on the list.', new.name;
  end if;
  if exists (select 1 from public.skill_tag_suggestions where lower(name) = lower(new.name) and status = 'pending') then
    raise exception '"%" has already been suggested. You can use it while an admin reviews it.', new.name;
  end if;
  return new;
end;
$$;

create trigger skill_tag_suggestions_before_insert
before insert on public.skill_tag_suggestions
for each row execute function public.skill_tag_suggestions_before_insert();

alter table public.app_settings
  -- The most people on one collab team, counting the owner.
  add column collab_max_team_size int not null default 8 check (collab_max_team_size between 2 and 51);

-- Skills must come from the list (or a suggestion waiting for review), and the
-- team can't be bigger than the school allows.
create function public.collab_posts_check_rules()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_max int := (select collab_max_team_size from public.app_settings);
  v_unknown text;
begin
  -- Our own updates (merging or rejecting a suggestion) are trusted.
  if pg_trigger_depth() > 1 or public.is_trusted_change() then
    return new;
  end if;

  -- Only when the size is set or changed: older, bigger teams can still be
  -- edited or hidden.
  if (tg_op = 'INSERT' or new.spots_wanted is distinct from old.spots_wanted)
     and new.spots_wanted + 1 > v_max then
    raise exception 'Teams can have at most % people, including you, so ask for up to %.', v_max, v_max - 1;
  end if;

  if tg_op = 'INSERT' or new.skills is distinct from old.skills then
    -- Use each tag's own spelling ("cad" becomes "CAD").
    new.skills := array(
      select coalesce(
        (select t.name from public.skill_tags t where lower(t.name) = lower(trim(s)) and t.active),
        trim(s)
      )
      from unnest(new.skills) with ordinality as x(s, n)
      where trim(s) <> ''
      order by n
    );
    select s into v_unknown
    from unnest(new.skills) s
    where not exists (select 1 from public.skill_tags t where lower(t.name) = lower(s) and t.active)
      and not exists (
        select 1 from public.skill_tag_suggestions g where lower(g.name) = lower(s) and g.status = 'pending'
      )
    limit 1;
    if v_unknown is not null then
      raise exception '"%" isn''t on the skills list. Pick from the list, or suggest it as a new skill.', v_unknown;
    end if;
  end if;
  return new;
end;
$$;

create trigger collab_posts_check_rules
before insert or update on public.collab_posts
for each row execute function public.collab_posts_check_rules();

-- Admin: approve a suggestion (it becomes a tag), merge it into an existing
-- tag (posts using it switch to that tag), or reject it (posts drop it).
create function public.admin_review_tag_suggestion(
  p_suggestion_id uuid,
  p_action text,
  p_merge_into uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_suggestion public.skill_tag_suggestions;
  v_tag public.skill_tags;
begin
  if not public.is_admin() then
    raise exception 'Only admins can review skill suggestions.' using errcode = '42501';
  end if;
  select * into v_suggestion from public.skill_tag_suggestions where id = p_suggestion_id for update;
  if not found or v_suggestion.status <> 'pending' then
    raise exception 'That suggestion has already been dealt with.';
  end if;

  -- Merging and rejecting edit other people's posts.
  perform public.begin_trusted_change();

  if p_action = 'approve' then
    insert into public.skill_tags (name) values (v_suggestion.name)
    on conflict (lower(name)) do update set active = true
    returning * into v_tag;
  elsif p_action = 'merge' then
    select * into v_tag from public.skill_tags where id = p_merge_into;
    if not found then
      raise exception 'Choose the tag to merge it into.';
    end if;
    update public.collab_posts
    set skills = array_replace(skills, v_suggestion.name, v_tag.name)
    where lower(v_suggestion.name) = any (array(select lower(x) from unnest(skills) x));
  elsif p_action = 'reject' then
    update public.collab_posts
    set skills = array_remove(skills, v_suggestion.name)
    where v_suggestion.name = any (skills);
  else
    raise exception 'Approve, merge or reject.';
  end if;

  update public.skill_tag_suggestions
  set status = case p_action when 'approve' then 'approved' when 'merge' then 'merged' else 'rejected' end::public.tag_suggestion_status,
      tag_id = v_tag.id,
      reviewed_by = auth.uid()
  where id = p_suggestion_id;

  insert into public.audit_log (actor_id, action, table_name, row_id, details)
  values (auth.uid(), 'skill_suggestion_' || p_action, 'skill_tag_suggestions', p_suggestion_id::text,
          jsonb_build_object('name', v_suggestion.name, 'tag', v_tag.name));
end;
$$;

-- =============================================================================
-- Volunteering: categories, SUPW targets per grade, approval switch
-- =============================================================================

create table public.volunteer_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 40),
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index volunteer_categories_name_key on public.volunteer_categories (lower(name));

alter table public.volunteer_events
  add column category_id uuid references public.volunteer_categories (id) on delete set null;

create table public.supw_targets (
  id uuid primary key default gen_random_uuid(),
  grade int not null unique references public.grades (grade) on update cascade on delete cascade,
  hours numeric(5, 1) not null check (hours > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- The old single target, if the school had set one, now applies to every grade.
insert into public.supw_targets (grade, hours)
select g.grade, s.supw_hours_target
from public.grades g cross join public.app_settings s
where s.supw_hours_target is not null;

alter table public.app_settings drop column supw_hours_target;

alter table public.app_settings
  -- The plan: student events need a teacher's approval. Off = they go live at once.
  add column student_events_need_approval boolean not null default true;

create trigger volunteer_categories_updated_at before update on public.volunteer_categories
for each row execute function public.set_updated_at();
create trigger supw_targets_updated_at before update on public.supw_targets
for each row execute function public.set_updated_at();
create trigger volunteer_categories_audit after insert or update or delete on public.volunteer_categories
for each row execute function public.audit_change();
create trigger supw_targets_audit after insert or update or delete on public.supw_targets
for each row execute function public.audit_change();

alter table public.volunteer_categories enable row level security;
alter table public.supw_targets enable row level security;

create policy "Everyone reads volunteer categories" on public.volunteer_categories
for select to authenticated using (true);
create policy "Admins manage volunteer categories" on public.volunteer_categories for all to authenticated
using (public.is_admin()) with check (public.is_admin());

create policy "Everyone reads SUPW targets" on public.supw_targets for select to authenticated using (true);
create policy "Admins manage SUPW targets" on public.supw_targets for all to authenticated
using (public.is_admin()) with check (public.is_admin());

-- Same as in 05, plus the approval switch.
create or replace function public.volunteer_events_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.approved_by := null;
  new.approval_note := null;
  if public.is_staff_member(new.creator_id)
     or not (select student_events_need_approval from public.app_settings) then
    new.status := 'published';
  else
    new.status := 'awaiting_approval';
  end if;
  return new;
end;
$$;

-- =============================================================================
-- Fix-it: report categories become a table
--
-- Before: the category was a fixed list in the database (an enum), and a
-- separate table said which team each one went to. Now one table holds both,
-- and admins can add, rename and retire categories. Existing reports keep
-- their category: each old enum value becomes a row whose `key` is that
-- value, and reports.category keeps the same text.
-- =============================================================================

create table public.report_categories (
  id uuid primary key default gen_random_uuid(),
  -- Stable identifier stored on each report (e.g. 'it'). Never shown.
  key text not null unique check (key ~ '^[a-z0-9_]{1,40}$'),
  name text not null check (char_length(trim(name)) between 1 and 40),
  -- An icon name from src/components/Icon.tsx.
  icon text not null default 'alert',
  responsibility public.responsibility_kind not null default 'facilities',
  -- Retired categories stay on old reports but can't be chosen for new ones.
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.report_categories (key, name, icon, responsibility, sort_order)
select
  e.enumlabel,
  case e.enumlabel
    when 'ac' then 'Air conditioning'
    when 'it' then 'IT'
    else initcap(e.enumlabel)
  end,
  case e.enumlabel
    when 'electrical' then 'bolt'
    when 'ac' then 'wind'
    when 'plumbing' then 'droplet'
    when 'furniture' then 'box'
    when 'it' then 'monitor'
    when 'cleanliness' then 'sparkle'
    else 'alert'
  end,
  coalesce(r.responsibility, 'facilities'),
  e.enumsortorder::int
from pg_enum e
left join public.report_category_routes r on r.category::text = e.enumlabel
where e.enumtypid = 'public.report_category'::regtype;

-- Functions that mention the old type have to go before the type can.
drop function public.open_reports_in_room(uuid);
drop function public.report_feed();
drop function public.can_manage_report(public.report_category);
drop function public.report_route(public.report_category);

alter table public.reports alter column category type text using category::text;
alter table public.reports
  add constraint reports_category_fkey foreign key (category)
  references public.report_categories (key) on update cascade;

drop table public.report_category_routes;
drop type public.report_category;

create trigger report_categories_updated_at before update on public.report_categories
for each row execute function public.set_updated_at();
create trigger report_categories_audit after insert or update or delete on public.report_categories
for each row execute function public.audit_change();

alter table public.report_categories enable row level security;
create policy "Everyone reads report categories" on public.report_categories
for select to authenticated using (true);
create policy "Admins manage report categories" on public.report_categories for all to authenticated
using (public.is_admin()) with check (public.is_admin());

-- The same functions as in 09, reading the table instead of the enum.
create function public.report_route(p_category text)
returns public.responsibility_kind
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select responsibility from public.report_categories where key = p_category),
    'facilities'
  );
$$;

create function public.can_manage_report(p_category text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_admin()
    or (public.is_staff() and public.has_responsibility(public.report_route(p_category)));
$$;

-- "Air conditioning in Lab 1 (G.06)" for notification text.
create or replace function public.report_headline(p_report public.reports)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select name from public.report_categories where key = p_report.category), p_report.category)
    || coalesce(
      ' in ' || (select r.name || ' (' || r.code || ')' from public.rooms r where r.id = p_report.room_id),
      ''
    );
$$;

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

create function public.open_reports_in_room(p_room_id uuid)
returns table (
  id uuid,
  category text,
  category_name text,
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
  select f.id, f.category, f.category_name, f.description, f.status, f.urgent, f.created_at,
         f.vote_count, f.voted_by_me, f.reported_by_me
  from public.report_feed() f
  where f.room_id = p_room_id
    and f.status in ('open', 'acknowledged', 'in_progress')
  order by f.vote_count desc, f.created_at desc;
$$;

-- New reports can't use a retired category.
create function public.reports_check_category()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null
     and not exists (select 1 from public.report_categories where key = new.category and active) then
    raise exception 'That kind of problem isn''t on the list any more. Choose another.';
  end if;
  return new;
end;
$$;

create trigger reports_check_category
before insert on public.reports
for each row execute function public.reports_check_category();

-- Auto-urgent: when this many people say "me too", the report becomes urgent,
-- which emails the responsible team straight away (see reports_notify).
alter table public.app_settings
  add column report_auto_urgent_votes int default 5 check (report_auto_urgent_votes between 2 and 100);

create function public.report_votes_auto_urgent()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_threshold int := (select report_auto_urgent_votes from public.app_settings);
begin
  if v_threshold is not null
     and (select count(*) from public.report_votes where report_id = new.report_id) >= v_threshold then
    update public.reports
    set urgent = true
    where id = new.report_id and not urgent and status in ('open', 'acknowledged', 'in_progress');
  end if;
  return null;
end;
$$;

create trigger report_votes_auto_urgent
after insert on public.report_votes
for each row execute function public.report_votes_auto_urgent();

-- Floor plan images, uploaded from Admin > Map. Public, like the app's own
-- placeholder images in public/floorplans/; only admins can change them.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('floor-plans', 'floor-plans', true, 5242880, array['image/svg+xml', 'image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;

create policy "Admins upload floor plans" on storage.objects for insert to authenticated
with check (bucket_id = 'floor-plans' and public.is_admin());
create policy "Admins replace floor plans" on storage.objects for update to authenticated
using (bucket_id = 'floor-plans' and public.is_admin());
create policy "Admins delete floor plans" on storage.objects for delete to authenticated
using (bucket_id = 'floor-plans' and public.is_admin());

-- =============================================================================
-- Venues: when, how long and how far ahead each one can be booked
-- =============================================================================

alter table public.venues
  -- Null = no limit.
  add column bookable_from time,
  add column bookable_until time,
  add column max_booking_minutes int check (max_booking_minutes between 15 and 1440),
  add column max_days_ahead int check (max_days_ahead between 0 and 730),
  add constraint venues_bookable_window check (
    bookable_from is null or bookable_until is null or bookable_until > bookable_from
  );

-- Same as in 13 (holidays and blackouts), plus the venue's own limits.
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
