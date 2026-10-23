-- =============================================================================
-- 15 Moderation (admin dashboard, B5).
--
-- Columns:   removed_at, removed_by, removed_reason on collab_posts,
--            announcements and volunteer_events (a "soft delete": the row
--            stays, so it can be restored and the record is kept)
-- Functions: admin_moderation_queue()  reported, hidden and removed content
--            admin_moderate()          hide, unhide, remove, restore, dismiss
--
-- Removed content is visible only to admins (restrictive policies below), so
-- it disappears for everyone else, including its author, until restored.
-- =============================================================================

alter table public.collab_posts
  add column removed_at timestamptz,
  add column removed_by uuid references public.profiles (id) on delete set null,
  add column removed_reason text check (char_length(removed_reason) <= 300);

alter table public.announcements
  add column removed_at timestamptz,
  add column removed_by uuid references public.profiles (id) on delete set null,
  add column removed_reason text check (char_length(removed_reason) <= 300);

alter table public.volunteer_events
  add column removed_at timestamptz,
  add column removed_by uuid references public.profiles (id) on delete set null,
  add column removed_reason text check (char_length(removed_reason) <= 300);

-- RESTRICTIVE: whatever else lets someone read a row, a removed one is for
-- admins only.
create policy "Removed posts are for admins only" on public.collab_posts
as restrictive for select to authenticated using (removed_at is null or public.is_admin());
create policy "Removed announcements are for admins only" on public.announcements
as restrictive for select to authenticated using (removed_at is null or public.is_admin());
create policy "Removed events are for admins only" on public.volunteer_events
as restrictive for select to authenticated using (removed_at is null or public.is_admin());

-- Only moderation (admin_moderate) sets or clears these columns.
create function public.protect_removal_columns()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_trusted_change() then
    if tg_op = 'INSERT' then
      new.removed_at := null;
      new.removed_by := null;
      new.removed_reason := null;
    else
      new.removed_at := old.removed_at;
      new.removed_by := old.removed_by;
      new.removed_reason := old.removed_reason;
    end if;
  end if;
  return new;
end;
$$;

create trigger protect_removal_columns before insert or update on public.collab_posts
for each row execute function public.protect_removal_columns();
create trigger protect_removal_columns before insert or update on public.announcements
for each row execute function public.protect_removal_columns();
create trigger protect_removal_columns before insert or update on public.volunteer_events
for each row execute function public.protect_removal_columns();

-- Things that look up events and posts by id must agree that removed ones are gone.
create or replace function public.can_see_volunteer_event(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.volunteer_events e
    where e.id = p_event_id
      and (e.removed_at is null or public.is_admin())
      and (
        e.status = 'published'
        or e.creator_id = auth.uid()
        or public.is_staff()
        or exists (
          select 1 from public.role_signups s
          where s.event_id = e.id and s.student_id = auth.uid()
        )
      )
  );
$$;

create or replace function public.collab_post_counts()
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
  where (p.removed_at is null or public.is_admin())
    and (p.hidden_by is null or p.owner_id = auth.uid() or public.is_staff())
  group by p.id;
$$;

-- Nobody can ask to join, or sign up for, something that was removed.
create function public.block_removed_parent()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_removed boolean;
begin
  -- Two tables share this function; each has its own column for the parent.
  if tg_table_name = 'join_requests' then
    select removed_at is not null into v_removed from public.collab_posts where id = new.post_id;
  else
    select e.removed_at is not null into v_removed
    from public.event_roles r join public.volunteer_events e on e.id = r.event_id
    where r.id = new.role_id;
  end if;
  if v_removed then
    raise exception 'This has been removed by a moderator.';
  end if;
  return new;
end;
$$;

create trigger block_removed_parent before insert on public.join_requests
for each row execute function public.block_removed_parent();
create trigger block_removed_parent before insert on public.role_signups
for each row execute function public.block_removed_parent();

-- Staff marking reports dismissed or actioned is part of the record too.
create trigger content_reports_audit after update on public.content_reports
for each row execute function public.audit_change();

-- -----------------------------------------------------------------------------
-- The moderation queue: one list of
--   reported  each open report, with the reported content shown inline
--   hidden    collab posts a teacher has hidden pending review
--   removed   anything an admin has removed (it can be restored)
-- -----------------------------------------------------------------------------
create function public.admin_moderation_queue()
returns table (
  kind text,
  report_id uuid,
  target_table text,
  target_id uuid,
  title text,
  excerpt text,
  author_id uuid,
  author_name text,
  reporter_name text,
  reason text,
  happened_at timestamptz,
  is_hidden boolean,
  is_removed boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Only admins can see the moderation queue.' using errcode = '42501';
  end if;

  return query
    with content as (
      select 'collab_posts'::text as tbl, p.id, p.title, p.description as body, p.owner_id as author,
             p.hidden_by is not null as hidden, p.hidden_reason, p.hidden_at,
             p.removed_at, p.removed_reason
      from public.collab_posts p
      union all
      select 'announcements', a.id, a.title, a.body, a.author_id, false, null, null, a.removed_at, a.removed_reason
      from public.announcements a
      union all
      select 'volunteer_events', e.id, e.title, e.description, e.creator_id, false, null, null, e.removed_at, e.removed_reason
      from public.volunteer_events e
    )
    select 'reported', r.id, r.target_table, r.target_id, c.title, left(c.body, 280), c.author,
           au.full_name, rp.full_name, r.reason, r.created_at, coalesce(c.hidden, false), c.removed_at is not null
    from public.content_reports r
    left join content c on c.tbl = r.target_table and c.id = r.target_id
    left join public.profiles au on au.id = c.author
    join public.profiles rp on rp.id = r.reporter_id
    where r.status = 'open'
    union all
    select 'hidden', null, c.tbl, c.id, c.title, left(c.body, 280), c.author,
           au.full_name, null, c.hidden_reason, c.hidden_at, true, false
    from content c
    left join public.profiles au on au.id = c.author
    where c.hidden and c.removed_at is null
    union all
    select 'removed', null, c.tbl, c.id, c.title, left(c.body, 280), c.author,
           au.full_name, null, c.removed_reason, c.removed_at, c.hidden, true
    from content c
    left join public.profiles au on au.id = c.author
    where c.removed_at is not null
    order by 11 desc;
end;
$$;

-- -----------------------------------------------------------------------------
-- One function for every moderation action. Hiding is for collab posts
-- (teachers can also hide them from the post itself); remove and restore work
-- on posts, announcements and events. Removing or hiding marks that content's
-- open reports "actioned"; dismiss marks one report "dismissed".
-- -----------------------------------------------------------------------------
create function public.admin_moderate(
  p_action text,
  p_target_table text default null,
  p_target_id uuid default null,
  p_reason text default null,
  p_report_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reason text := nullif(trim(p_reason), '');
  v_rows int;
begin
  if not public.is_admin() then
    raise exception 'Only admins can moderate.' using errcode = '42501';
  end if;

  if p_action = 'dismiss' then
    update public.content_reports
    set status = 'dismissed', reviewed_by = auth.uid()
    where id = p_report_id and status = 'open';
    if not found then
      raise exception 'That report has already been dealt with.';
    end if;
    return;
  end if;

  if p_target_table not in ('collab_posts', 'announcements', 'volunteer_events') then
    raise exception 'That kind of content can''t be moderated here.';
  end if;
  if p_action in ('hide', 'unhide') and p_target_table <> 'collab_posts' then
    raise exception 'Only collab posts can be hidden; remove it instead.';
  end if;

  -- These edit other people's rows on purpose.
  perform public.begin_trusted_change();

  if p_action = 'hide' then
    update public.collab_posts
    set hidden_by = auth.uid(), hidden_reason = coalesce(v_reason, 'Hidden by an admin')
    where id = p_target_id;
    get diagnostics v_rows = row_count;
  elsif p_action = 'unhide' then
    update public.collab_posts set hidden_by = null where id = p_target_id;
    get diagnostics v_rows = row_count;
  elsif p_action in ('remove', 'restore') then
    -- The table name is one of three fixed names (checked above); %I quotes it.
    execute format(
      'update public.%I set removed_at = $1, removed_by = $2, removed_reason = $3 where id = $4',
      p_target_table
    )
    using
      case when p_action = 'remove' then now() end,
      case when p_action = 'remove' then auth.uid() end,
      case when p_action = 'remove' then v_reason end,
      p_target_id;
    get diagnostics v_rows = row_count;
  else
    raise exception 'Choose hide, unhide, remove, restore or dismiss.';
  end if;

  if v_rows = 0 then
    raise exception 'That content doesn''t exist any more.';
  end if;

  if p_action in ('hide', 'remove') then
    update public.content_reports
    set status = 'actioned', reviewed_by = auth.uid()
    where target_table = p_target_table and target_id = p_target_id and status = 'open';
  end if;

  -- Hiding and unhiding are already recorded by collab_posts_audit_moderation.
  if p_action in ('remove', 'restore') then
    insert into public.audit_log (actor_id, action, table_name, row_id, details)
    values (auth.uid(), 'content_' || case p_action when 'remove' then 'removed' else 'restored' end,
            p_target_table, p_target_id::text, jsonb_build_object('reason', v_reason));
  end if;
end;
$$;
