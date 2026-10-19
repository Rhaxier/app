-- =============================================================================
-- 06 Projects with teachers.
--
-- Tables:  projects, project_shares, project_feedback
-- Storage: private bucket `project-files`, one folder per project:
--          project-files/<project_id>/<file name>
--
-- Rules (plan, privileges table):
--   * Students own their projects and share them with chosen teachers.
--     Sharing notifies the teacher.
--   * Teachers see only projects shared with them, give feedback (which
--     notifies the owner) and set the status.
--   * Admins can see all projects.
-- =============================================================================

create type public.project_status as enum (
  'draft', 'shared', 'in_review', 'feedback_given', 'complete'
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 120),
  subject text check (char_length(subject) <= 60),
  description text not null default '' check (char_length(description) <= 4000),
  link_url text check (link_url ~* '^https?://'),
  status public.project_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index projects_owner_idx on public.projects (owner_id);

create table public.project_shares (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  teacher_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (project_id, teacher_id)
);

create index project_shares_teacher_idx on public.project_shares (teacher_id);

create table public.project_feedback (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  author_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index project_feedback_project_idx on public.project_feedback (project_id, created_at);

create trigger projects_updated_at
before update on public.projects
for each row execute function public.set_updated_at();

-- =============================================================================
-- Helpers
-- =============================================================================

create function public.is_project_owner(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.projects where id = p_project_id and owner_id = auth.uid());
$$;

create function public.is_project_shared_with_me(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.project_shares where project_id = p_project_id and teacher_id = auth.uid()
  );
$$;

create function public.can_read_project(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_project_owner(p_project_id)
    or public.is_project_shared_with_me(p_project_id)
    or public.is_admin();
$$;

-- Storage paths are text; this turns a folder name into a uuid, or null if it
-- isn't one (so a bad path is simply refused instead of raising an error).
create function public.uuid_or_null(p_text text)
returns uuid
language plpgsql
immutable
as $$
begin
  return p_text::uuid;
exception when invalid_text_representation then
  return null;
end;
$$;

-- =============================================================================
-- Triggers
-- =============================================================================

-- Teachers may only move a shared project's status along; owners may only use
-- the statuses that describe their own work.
create function public.projects_before_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.owner_id := old.owner_id;
  if auth.uid() is null or pg_trigger_depth() > 1 then
    return new;
  end if;

  if old.owner_id = auth.uid() then
    if new.status is distinct from old.status and new.status not in ('draft', 'shared', 'complete') then
      raise exception 'Your teacher sets "in review" and "feedback given".';
    end if;
  else
    if (to_jsonb(new) - array['status', 'updated_at']) is distinct from (to_jsonb(old) - array['status', 'updated_at']) then
      raise exception 'Only the owner can edit this project.';
    end if;
    if new.status is distinct from old.status and new.status not in ('in_review', 'feedback_given', 'complete') then
      raise exception 'Teachers can set a project to in review, feedback given or complete.';
    end if;
  end if;
  return new;
end;
$$;

create trigger projects_before_update
before update on public.projects
for each row execute function public.projects_before_update();

create function public.project_shares_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_staff_member(new.teacher_id) then
    raise exception 'Projects can only be shared with teachers.';
  end if;
  return new;
end;
$$;

create trigger project_shares_before_insert
before insert on public.project_shares
for each row execute function public.project_shares_before_insert();

create function public.project_shares_notify()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_project public.projects;
begin
  select * into v_project from public.projects where id = new.project_id;
  if v_project.status = 'draft' then
    update public.projects set status = 'shared' where id = new.project_id;
  end if;
  perform public.notify(
    new.teacher_id, 'project_shared',
    'Project shared with you: ' || v_project.title,
    (select full_name from public.profiles where id = v_project.owner_id)
      || coalesce(' · ' || v_project.subject, ''),
    '/projects/' || v_project.id
  );
  return null;
end;
$$;

create trigger project_shares_notify
after insert on public.project_shares
for each row execute function public.project_shares_notify();

create function public.project_feedback_notify()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_project public.projects;
begin
  select * into v_project from public.projects where id = new.project_id;
  update public.projects set status = 'feedback_given' where id = new.project_id;
  perform public.notify(
    v_project.owner_id, 'project_feedback',
    'Feedback on ' || v_project.title,
    (select full_name from public.profiles where id = new.author_id) || ': ' || left(new.body, 120),
    '/projects/' || v_project.id
  );
  return null;
end;
$$;

create trigger project_feedback_notify
after insert on public.project_feedback
for each row execute function public.project_feedback_notify();

-- =============================================================================
-- Row Level Security
-- =============================================================================
alter table public.projects enable row level security;
alter table public.project_shares enable row level security;
alter table public.project_feedback enable row level security;

create policy "Owners, shared teachers and admins read projects"
on public.projects for select to authenticated
using (
  owner_id = (select auth.uid())
  or public.is_project_shared_with_me(id)
  or public.is_admin()
);

create policy "Create your own projects"
on public.projects for insert to authenticated
with check (owner_id = (select auth.uid()));

-- Shared teachers can update too; the trigger limits them to the status.
create policy "Owners and shared teachers update projects"
on public.projects for update to authenticated
using (owner_id = (select auth.uid()) or public.is_project_shared_with_me(id));

create policy "Owners delete their projects"
on public.projects for delete to authenticated
using (owner_id = (select auth.uid()));

create policy "Read shares of projects you can read"
on public.project_shares for select to authenticated
using (public.is_project_owner(project_id) or teacher_id = (select auth.uid()) or public.is_admin());

create policy "Owners share their projects"
on public.project_shares for insert to authenticated
with check (public.is_project_owner(project_id));

create policy "Owners unshare their projects"
on public.project_shares for delete to authenticated
using (public.is_project_owner(project_id));

create policy "Read feedback on projects you can read"
on public.project_feedback for select to authenticated
using (public.can_read_project(project_id));

create policy "Shared teachers and admins give feedback"
on public.project_feedback for insert to authenticated
with check (
  author_id = (select auth.uid())
  and public.is_staff()
  and (public.is_project_shared_with_me(project_id) or public.is_admin())
);

create policy "Authors delete their feedback"
on public.project_feedback for delete to authenticated
using (author_id = (select auth.uid()));

-- =============================================================================
-- Storage: private bucket for attachments. Files live under <project_id>/.
-- Owners upload and delete; anyone who can read the project can download
-- (through a short-lived signed URL, since the bucket is private).
-- =============================================================================
insert into storage.buckets (id, name, public, file_size_limit)
values ('project-files', 'project-files', false, 10485760) -- 10 MB per file
on conflict (id) do nothing;

create policy "Project readers download attachments"
on storage.objects for select to authenticated
using (
  bucket_id = 'project-files'
  and public.can_read_project(public.uuid_or_null((storage.foldername(name))[1]))
);

create policy "Project owners upload attachments"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'project-files'
  and public.is_project_owner(public.uuid_or_null((storage.foldername(name))[1]))
);

create policy "Project owners delete attachments"
on storage.objects for delete to authenticated
using (
  bucket_id = 'project-files'
  and public.is_project_owner(public.uuid_or_null((storage.foldername(name))[1]))
);
