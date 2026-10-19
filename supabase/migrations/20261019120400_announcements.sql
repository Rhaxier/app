-- =============================================================================
-- 04 Announcements: the reference feature.
--
-- Read this file first. Every other feature follows the same four steps:
--   1. The table: columns and CHECK constraints (rules about the data itself).
--   2. RLS policies: who may read, insert, update and delete which rows.
--   3. Triggers: things that must always happen (here: notifications).
--   4. Nothing else. The app adds no rules of its own; it only hides buttons.
--
-- The rules, from the plan's privileges table:
--   * Students read announcements meant for them (school-wide or their grade).
--   * Teachers post to grades (not school-wide) and can't pin.
--   * Admins post school-wide and pin.
--   * Authors edit or delete their own; admins edit or delete any.
--   * New pinned or grade-targeted announcements notify the people they're for.
--     Ordinary school-wide posts don't, to avoid notification spam.
-- =============================================================================

-- An enum is a fixed list of allowed values. Postgres refuses anything else,
-- so a typo like 'grade' instead of 'grades' fails loudly instead of hiding.
create type public.announcement_audience as enum ('school', 'grades');

-- -----------------------------------------------------------------------------
-- 1. The table
-- -----------------------------------------------------------------------------
create table public.announcements (
  id uuid primary key default gen_random_uuid(),

  -- `default auth.uid()` fills in the signed-in user, so the app never sends it.
  -- RLS below still checks it, in case someone sends a different id on purpose.
  author_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,

  -- Optional byline shown instead of the author's name, e.g. 'Science Department'.
  posted_as text check (char_length(posted_as) <= 60),

  title text not null check (char_length(trim(title)) between 1 and 140),
  body text not null default '' check (char_length(body) <= 4000),
  audience public.announcement_audience not null default 'grades',
  grades int[],
  pinned boolean not null default false,
  published_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- A CHECK constraint is a rule about one row that Postgres enforces on every
  -- insert and update. School-wide posts have no grade list; grade posts need one.
  constraint announcements_grades_match_audience check (
    (audience = 'school' and grades is null)
    or (audience = 'grades' and cardinality(grades) > 0)
  )
);

-- The feed is "newest first", so index that order. Pinned posts are few and
-- sorted to the top by the query.
create index announcements_published_idx on public.announcements (published_at desc);

create trigger announcements_updated_at
before update on public.announcements
for each row execute function public.set_updated_at();

-- An author can't hand their post to someone else (admins included), so
-- "edit your own" can't be used to edit someone else's.
create function public.announcements_keep_author()
returns trigger
language plpgsql
as $$
begin
  new.author_id := old.author_id;
  return new;
end;
$$;

create trigger announcements_keep_author
before update on public.announcements
for each row execute function public.announcements_keep_author();

-- -----------------------------------------------------------------------------
-- 2. Row Level Security
--
-- With RLS on, a table returns NO rows and accepts NO writes until a policy
-- allows it. Each policy is a yes/no question asked about each row:
--   USING       - may this user see (or change) this existing row?
--   WITH CHECK  - is the new or changed row allowed?
-- Several policies for the same action combine with OR.
--
-- `(select auth.uid())` instead of plain `auth.uid()` lets Postgres work the
-- value out once per query rather than once per row. Same answer, faster.
-- -----------------------------------------------------------------------------
alter table public.announcements enable row level security;

-- Staff see everything (they write announcements and need the full picture).
-- Everyone else sees published ones meant for the whole school or their grade.
create policy "Read announcements meant for me"
on public.announcements for select to authenticated
using (
  public.is_staff()
  or (
    published_at <= now()
    and (audience = 'school' or public.my_grade() = any (grades))
  )
);

-- Admins may post anything. Teachers may post only to grades, unpinned.
-- Students match neither branch, so their inserts are refused.
create policy "Staff post announcements"
on public.announcements for insert to authenticated
with check (
  author_id = (select auth.uid())
  and (
    public.is_admin()
    or (public.is_staff() and audience = 'grades' and not pinned)
  )
);

-- USING picks which rows you may edit (your own as staff, or any as admin).
-- WITH CHECK stops a teacher editing their post into a school-wide or pinned one.
create policy "Authors edit their own, admins edit any"
on public.announcements for update to authenticated
using (
  public.is_admin()
  or (author_id = (select auth.uid()) and public.is_staff())
)
with check (
  public.is_admin()
  or (author_id = (select auth.uid()) and public.is_staff() and audience = 'grades' and not pinned)
);

create policy "Authors delete their own, admins delete any"
on public.announcements for delete to authenticated
using (
  public.is_admin()
  or (author_id = (select auth.uid()) and public.is_staff())
);

-- -----------------------------------------------------------------------------
-- 3. Notifications
--
-- An AFTER INSERT trigger runs once the row is saved. It's `security definer`
-- because it calls notify(), which ordinary users aren't allowed to call.
-- -----------------------------------------------------------------------------
create function public.announcements_notify()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_body text := left(new.body, 140);
  v_link text := '/announcements/' || new.id;
begin
  if new.audience = 'grades' then
    -- Targeted: tell the students in those grades.
    perform public.notify(p.id, 'announcement_new', new.title, v_body, v_link)
    from public.profiles p
    where p.role = 'student' and p.grade = any (new.grades);
  elsif new.pinned then
    -- Pinned school-wide: important enough to tell everyone except the author.
    perform public.notify(p.id, 'announcement_new', new.title, v_body, v_link)
    from public.profiles p
    where p.id <> new.author_id;
  end if;
  -- AFTER triggers ignore the return value; null makes that obvious.
  return null;
end;
$$;

create trigger announcements_notify
after insert on public.announcements
for each row execute function public.announcements_notify();
