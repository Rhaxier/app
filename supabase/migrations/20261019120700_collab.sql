-- =============================================================================
-- 07 Collab finder: posts, join requests, moderation.
--
-- Tables:    collab_posts, join_requests, content_reports
-- Functions: collab_post_counts(), collab_requests(), collab_team()
--
-- Rules (plan, "Collab finder"):
--   * A post says how many students it wants. Anyone can ask to join (once),
--     except the owner. The owner is notified.
--   * The owner sees every requester (name, grade, message, status) and their
--     school email, so they can contact anyone before deciding. Only the owner
--     and staff can see those emails.
--   * Accept or decline; the requester is told either way. Accepted students
--     and the owner see each other's emails and the team list.
--   * Auto-close: when accepted = wanted, the post becomes `full` and every
--     pending request is declined with a notification. Raising the number
--     reopens it.
--   * Safeguarding: staff see all posts. Teachers can hide a post pending
--     review; admins can remove posts. Anyone can report a post; only staff
--     read reports.
--   * Q4: if app_settings.collab_requires_teacher is on, a post must name a
--     supervising teacher.
-- =============================================================================

create type public.collab_status as enum ('open', 'full', 'closed');
create type public.join_request_status as enum ('pending', 'accepted', 'declined', 'withdrawn');
create type public.content_report_status as enum ('open', 'actioned', 'dismissed');

create table public.collab_posts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 120),
  description text not null default '' check (char_length(description) <= 2000),
  skills text[] not null default '{}',
  spots_wanted int not null check (spots_wanted > 0 and spots_wanted <= 50),
  status public.collab_status not null default 'open',
  supervising_teacher_id uuid references public.profiles (id) on delete set null,
  -- Moderation: set by a teacher to hide the post while it's reviewed.
  hidden_by uuid references public.profiles (id) on delete set null,
  hidden_at timestamptz,
  hidden_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index collab_posts_created_idx on public.collab_posts (created_at desc);

create table public.join_requests (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.collab_posts (id) on delete cascade,
  requester_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  message text not null default '' check (char_length(message) <= 300),
  status public.join_request_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (post_id, requester_id)
);

create index join_requests_requester_idx on public.join_requests (requester_id);

create table public.content_reports (
  id uuid primary key default gen_random_uuid(),
  target_table text not null check (target_table in ('collab_posts', 'announcements', 'volunteer_events')),
  target_id uuid not null,
  reporter_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  reason text not null check (char_length(trim(reason)) between 1 and 500),
  status public.content_report_status not null default 'open',
  reviewed_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger collab_posts_updated_at
before update on public.collab_posts
for each row execute function public.set_updated_at();

create trigger join_requests_updated_at
before update on public.join_requests
for each row execute function public.set_updated_at();

create trigger content_reports_updated_at
before update on public.content_reports
for each row execute function public.set_updated_at();

-- =============================================================================
-- Helpers
-- =============================================================================

create function public.is_collab_owner(p_post_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.collab_posts where id = p_post_id and owner_id = auth.uid());
$$;

create function public.collab_accepted_count(p_post_id uuid)
returns int
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::int from public.join_requests where post_id = p_post_id and status = 'accepted';
$$;

-- =============================================================================
-- Post triggers
-- =============================================================================

create function public.collab_posts_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.status := 'open';
  new.hidden_by := null;
  new.hidden_at := null;
  new.hidden_reason := null;
  if new.supervising_teacher_id is null
     and (select collab_requires_teacher from public.app_settings) then
    raise exception 'Choose a supervising teacher for this post.';
  end if;
  if new.supervising_teacher_id is not null and not public.is_staff_member(new.supervising_teacher_id) then
    raise exception 'The supervising teacher must be a member of staff.';
  end if;
  return new;
end;
$$;

create trigger collab_posts_before_insert
before insert on public.collab_posts
for each row execute function public.collab_posts_before_insert();

create function public.collab_posts_before_update()
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

  if auth.uid() is not null and pg_trigger_depth() = 1 then
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

create trigger collab_posts_before_update
before update on public.collab_posts
for each row execute function public.collab_posts_before_update();

-- Moderation is recorded: hiding, unhiding, and an admin removing someone's post.
create function public.collab_posts_audit_moderation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    return null;
  end if;
  if tg_op = 'UPDATE' and new.hidden_by is distinct from old.hidden_by then
    insert into public.audit_log (actor_id, action, table_name, row_id, details)
    values (
      auth.uid(),
      case when new.hidden_by is null then 'post_unhidden' else 'post_hidden' end,
      'collab_posts', new.id::text,
      jsonb_build_object('title', new.title, 'reason', new.hidden_reason)
    );
  elsif tg_op = 'DELETE' and old.owner_id <> auth.uid() then
    insert into public.audit_log (actor_id, action, table_name, row_id, details)
    values (auth.uid(), 'post_removed', 'collab_posts', old.id::text, jsonb_build_object('old', to_jsonb(old)));
  end if;
  return null;
end;
$$;

create trigger collab_posts_audit_moderation
after update or delete on public.collab_posts
for each row execute function public.collab_posts_audit_moderation();

-- =============================================================================
-- Join request triggers
-- =============================================================================

create function public.join_requests_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_post public.collab_posts;
begin
  select * into v_post from public.collab_posts where id = new.post_id;
  if v_post.owner_id = new.requester_id then
    raise exception 'This is your own post.';
  end if;
  if auth.uid() is not null and pg_trigger_depth() = 1 then
    if v_post.status <> 'open' or v_post.hidden_by is not null then
      raise exception 'This post isn''t taking requests right now.';
    end if;
    new.status := 'pending';
  end if;
  return new;
end;
$$;

create trigger join_requests_before_insert
before insert on public.join_requests
for each row execute function public.join_requests_before_insert();

create function public.join_requests_before_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_is_owner boolean := public.is_collab_owner(old.post_id);
  v_wanted int;
begin
  new.post_id := old.post_id;
  new.requester_id := old.requester_id;

  if auth.uid() is not null and pg_trigger_depth() = 1 and new.status is distinct from old.status then
    if old.requester_id = auth.uid() then
      if new.status <> 'withdrawn' or old.status not in ('pending', 'accepted') then
        raise exception 'You can withdraw your request, nothing else.';
      end if;
    elsif v_is_owner then
      if new.status not in ('accepted', 'declined') or old.status = 'withdrawn' then
        raise exception 'You can accept or decline a request.';
      end if;
    else
      raise exception 'Only the post''s owner can accept or decline.';
    end if;
  end if;

  if new.status = 'accepted' and old.status <> 'accepted' then
    -- Lock the post so two quick accepts can't both take the last spot.
    select spots_wanted into v_wanted from public.collab_posts where id = old.post_id for update;
    if public.collab_accepted_count(old.post_id) >= v_wanted then
      raise exception 'This team is already full.';
    end if;
  end if;
  return new;
end;
$$;

create trigger join_requests_before_update
before update on public.join_requests
for each row execute function public.join_requests_before_update();

create function public.join_requests_after_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_post public.collab_posts;
  v_link text;
  v_accepted int;
begin
  select * into v_post from public.collab_posts where id = new.post_id;
  v_link := '/collab/' || v_post.id;

  if tg_op = 'INSERT' then
    perform public.notify(
      v_post.owner_id, 'collab_request_new',
      (select full_name from public.profiles where id = new.requester_id) || ' asked to join ' || v_post.title,
      new.message,
      v_link
    );
    return null;
  end if;

  if new.status is not distinct from old.status then
    return null;
  end if;

  if new.status = 'accepted' then
    perform public.notify(
      new.requester_id, 'collab_request_accepted',
      'You''re on the team for ' || v_post.title,
      'Open the post to see the team and contact them.',
      v_link
    );
  elsif new.status = 'declined' then
    perform public.notify(
      new.requester_id, 'collab_request_declined',
      'Update on ' || v_post.title,
      case when v_post.status = 'full' or public.collab_accepted_count(v_post.id) >= v_post.spots_wanted
        then 'Thanks for offering to help. This team is now full.'
        else 'Thanks for offering to help. The owner has gone with other people this time.'
      end,
      v_link
    );
  end if;

  -- Keep the post's status in step with the team size.
  v_accepted := public.collab_accepted_count(v_post.id);
  if v_post.status = 'open' and v_accepted >= v_post.spots_wanted then
    update public.collab_posts set status = 'full' where id = v_post.id;
    -- Auto-close: everyone still pending is declined (and told, because this
    -- update fires this trigger again for each of them).
    update public.join_requests set status = 'declined' where post_id = v_post.id and status = 'pending';
  elsif v_post.status = 'full' and v_accepted < v_post.spots_wanted then
    update public.collab_posts set status = 'open' where id = v_post.id;
  end if;
  return null;
end;
$$;

create trigger join_requests_after_write
after insert or update on public.join_requests
for each row execute function public.join_requests_after_write();

-- =============================================================================
-- Row Level Security
-- =============================================================================
alter table public.collab_posts enable row level security;
alter table public.join_requests enable row level security;
alter table public.content_reports enable row level security;

-- Hidden posts disappear for students, except for their owner. Staff see all.
create policy "Read visible posts"
on public.collab_posts for select to authenticated
using (hidden_by is null or owner_id = (select auth.uid()) or public.is_staff());

create policy "Create your own posts"
on public.collab_posts for insert to authenticated
with check (owner_id = (select auth.uid()));

-- Staff can update (to hide); the trigger limits them to the moderation fields.
create policy "Owners edit, staff moderate"
on public.collab_posts for update to authenticated
using (owner_id = (select auth.uid()) or public.is_staff());

create policy "Owners and admins delete posts"
on public.collab_posts for delete to authenticated
using (owner_id = (select auth.uid()) or public.is_admin());

create policy "Requesters, owners and staff read requests"
on public.join_requests for select to authenticated
using (
  requester_id = (select auth.uid())
  or public.is_collab_owner(post_id)
  or public.is_staff()
);

create policy "Ask to join as yourself"
on public.join_requests for insert to authenticated
with check (requester_id = (select auth.uid()));

create policy "Requesters withdraw, owners decide"
on public.join_requests for update to authenticated
using (requester_id = (select auth.uid()) or public.is_collab_owner(post_id));

create policy "Anyone reports content"
on public.content_reports for insert to authenticated
with check (reporter_id = (select auth.uid()));

create policy "Staff read reports"
on public.content_reports for select to authenticated
using (public.is_staff());

create policy "Staff resolve reports"
on public.content_reports for update to authenticated
using (public.is_staff())
with check (public.is_staff());

-- =============================================================================
-- Read functions
-- =============================================================================

-- "2 of 3 spots filled" for every post you can see.
create function public.collab_post_counts()
returns table (post_id uuid, accepted_count int, pending_count int)
language sql
stable
security definer
set search_path = ''
as $$
  select
    p.id,
    (count(*) filter (where r.status = 'accepted'))::int,
    (count(*) filter (where r.status = 'pending'))::int
  from public.collab_posts p
  left join public.join_requests r on r.post_id = p.id
  where p.hidden_by is null or p.owner_id = auth.uid() or public.is_staff()
  group by p.id;
$$;

-- Every request on a post, with the requester's school email. Owner and staff only.
create function public.collab_requests(p_post_id uuid)
returns table (
  request_id uuid,
  requester_id uuid,
  full_name text,
  grade int,
  section text,
  email text,
  message text,
  status public.join_request_status,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (public.is_collab_owner(p_post_id) or public.is_staff()) then
    raise exception 'Only the post''s owner and staff can see requests.' using errcode = '42501';
  end if;
  return query
    select r.id, r.requester_id, p.full_name, p.grade, p.section, p.email, r.message, r.status, r.created_at
    from public.join_requests r
    join public.profiles p on p.id = r.requester_id
    where r.post_id = p_post_id
    order by r.created_at;
end;
$$;

-- The owner plus accepted members, with emails. Visible to the team and staff.
create function public.collab_team(p_post_id uuid)
returns table (user_id uuid, full_name text, grade int, email text, is_owner boolean)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (
    public.is_collab_owner(p_post_id)
    or public.is_staff()
    or exists (
      select 1 from public.join_requests
      where post_id = p_post_id and requester_id = auth.uid() and status = 'accepted'
    )
  ) then
    raise exception 'Only the team and staff can see the team list.' using errcode = '42501';
  end if;
  return query
    select p.id, p.full_name, p.grade, p.email, true
    from public.collab_posts c join public.profiles p on p.id = c.owner_id
    where c.id = p_post_id
    union all
    select p.id, p.full_name, p.grade, p.email, false
    from public.join_requests r join public.profiles p on p.id = r.requester_id
    where r.post_id = p_post_id and r.status = 'accepted';
end;
$$;
