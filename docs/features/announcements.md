# Announcements: the reference feature

Announcements is the simplest feature, so it's built most carefully and commented most
heavily. **Every other feature has the same shape.** Read the files below in order; once
you understand this one, the rest will feel familiar.

## What it does

- One feed of school news. Students see posts for the whole school and for their grade.
- Teachers post to one or more grades. They can't post school-wide or pin.
- Admins post school-wide and pin. Pinned posts sit at the top in the teal card.
- Authors edit or delete their own posts; admins can edit or delete any.
- Pinned posts notify everyone; grade posts notify that grade's students. Ordinary
  school-wide posts notify nobody, to avoid notification spam.

## How a request travels

```
AnnouncementsPage ─ useAnnouncements() ─ fetchAnnouncements() ─ supabase.from('announcements')
   (page)              (hooks.ts)            (api.ts)                       │
                                                                            ▼
                                                Postgres: RLS policy "Read announcements meant for me"
                                                decides which rows come back
```

Posting goes the same way down (`useCreateAnnouncement` → `createAnnouncement` → insert),
and on the way the database checks the insert policy, fills in `author_id`, saves the
row and runs the notification trigger.

## Reading order

### 1. The database: `supabase/migrations/20261019120400_announcements.sql`

Read it top to bottom. It has three parts:

1. **The table.** Columns, types and `check` constraints. The constraint
   `announcements_grades_match_audience` means a school-wide post can't have a grade
   list and a grade post must have one. Postgres refuses bad data no matter which
   screen (or bug) sends it.
2. **RLS policies.** With Row Level Security on, a table returns nothing and accepts
   nothing until a policy allows it. There's one policy per action:
   - _select_: staff see everything; others see published posts for the school or
     their grade (`my_grade() = any (grades)`).
   - _insert_: `author_id` must be you, and you must be an admin, or staff posting to
     grades without pinning.
   - _update_: `using` says which rows you may touch; `with check` says what the row
     may look like afterwards. That's how a teacher is stopped from editing their own
     post into a pinned one.
   - _delete_: your own (as staff), or any (as admin).

   The helper functions (`is_staff()`, `is_admin()`, `my_grade()`) live in the
   identity migration (`20261019120100_identity.sql`). Read their comment about
   `security definer`.

3. **The trigger.** `announcements_notify()` runs after each insert and calls
   `notify()` for each person who should hear about it. The app never creates
   notifications itself.

### 2. The database tests: `supabase/tests/03_announcements_test.sql`

Each `select pg_temp.act_as('teacher.b')` pretends to be a seeded user, exactly as the
app's requests arrive. Then `throws_ok` / `lives_ok` / `is` check what that person can
and can't do. Run them with `npm run db:test`. **This is where permissions are tested**,
because this is where they're enforced.

### 3. The types: `src/types/database.ts`

Generated from the database by `npm run db:types`. Search for `announcements:` to see
`Row` (what you read), `Insert` (what you send to create) and `Update`. Never edit it by
hand: change a migration, reset the database, regenerate.

### 4. The API: `src/features/announcements/api.ts`

The only file in the feature that talks to Supabase. Notice:

- `author:profiles(full_name)` fetches the author's name in the same request.
- There are no permission checks. RLS does that; we just pass errors on.
- Each function throws on error so TanStack Query can show the error state.

### 5. The hooks: `src/features/announcements/hooks.ts`

TanStack Query wrappers. `useAnnouncements()` gives a page `data`, `isPending`,
`isError`, `refetch`. The mutations (`useCreateAnnouncement`, …) invalidate the
`['announcements']` key after success so every screen showing announcements refetches.

### 6. Validation and form values: `src/features/announcements/validation.ts`

Plain functions, no React:

- `validateAnnouncement()` returns a message per problem field. It mirrors the database
  rules to give friendly messages early; it doesn't replace them.
- `toAnnouncementInput()` tidies form values into exactly what the table expects.

### 7. Components: `src/features/announcements/components/`

- `AnnouncementCard.tsx`: one card. Renders what it's given, never fetches.
- `HomeAnnouncements.tsx`: the section on Home; shows loading, error and empty states.
- `AnnouncementForm.tsx`: create and edit share one form. Teachers don't see the
  whole-school and pin options (a UI hint; the database refuses them anyway).

### 8. Pages: `src/features/announcements/pages/`

- `AnnouncementsPage.tsx`: the feed (`/announcements`).
- `AnnouncementDetailPage.tsx`: one post, with Edit/Delete for its author or an admin.
- `AnnouncementFormPage.tsx`: `/announcements/new` and `/announcements/:id/edit`.

Routes are in `src/app/router.tsx`; the new and edit routes sit inside
`<RequireRole role="staff">`.

### 9. UI tests: `src/features/announcements/announcements.test.tsx`

Tests the UI's own logic: validation, value conversion, what teachers vs admins see in
the form, what the card shows. Run with `npm test`.

## Try it

1. `npm run dev`, sign in with the **Dev** button as **Teacher B**.
2. Home → See all → **+** → post to Grade 8.
3. Switch to **Student Grade 8 A**: the post is in the feed and the bell has a new
   notification. Switch to **Student Grade 10 A**: it isn't there.
4. As **Teacher B**, try to pin it: the option isn't shown. Try it anyway from the
   browser console (dev builds put the client on `window.supabase`):
   `await supabase.from('announcements').update({ pinned: true }).eq('id', '<id>')`
   returns a row-level security error. The database refuses, whatever the UI shows.

## Copying the pattern for a new feature

1. Migration: table + `check` constraints, `enable row level security`, one policy per
   action, triggers that call `notify()`. Give it a header comment listing the rules.
2. pgTAP test file in `supabase/tests/` with one check per rule.
3. `npm run db:reset && npm run db:types`.
4. `api.ts` (raw calls) → `hooks.ts` (query keys, queries, mutations that invalidate)
   → `validation.ts` (plain functions) → `components/` → `pages/` → routes.
5. A `*.test.tsx` for validation and anything the UI decides on its own.
