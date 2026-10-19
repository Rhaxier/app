# Architecture

A one-page map of how the school app fits together. Read this first, then
`docs/features/announcements.md`.

## The big idea

One web app (React) talks to one Supabase project. **The database decides who
may do what.** Every table has Row Level Security (RLS) policies, and every
workflow rule (who can approve, when a post becomes full, who gets told) lives
in SQL: policies, triggers and functions. The React app only _asks_; it hides
buttons a user can't use, but that is a convenience, never the protection.

```
 React app (Vite)                       Supabase
 ┌───────────────────────┐            ┌──────────────────────────────────────┐
 │ pages/components      │            │ Auth (dev password, Google, Microsoft)│
 │   └─ hooks.ts (Query) │──supabase──▶ Postgres                              │
 │        └─ api.ts      │    -js     │   tables + RLS policies               │
 │                       │◀─Realtime──│   triggers ─▶ notify() ─▶ notifications│
 └───────────────────────┘            │                        ├▶ email_outbox │
   Capacitor wraps the same            │                        └▶ push_outbox  │
   build for iOS / Android             │ Storage (private buckets)             │
                                       │ Edge Functions (send-emails/send-push)│
                                       └──────────────────────────────────────┘
```

## Layers, top to bottom

| Layer                 | Where                                                        | Job                                                                                         |
| --------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| Pages and components  | `src/features/<feature>/pages`, `components`                 | Render data, collect input. Only call hooks.                                                |
| Hooks                 | `src/features/<feature>/hooks.ts`                            | TanStack Query: caching, loading/error state, refetch after changes.                        |
| API                   | `src/features/<feature>/api.ts`                              | The raw `supabase.from(...)` and `supabase.rpc(...)` calls. Nothing else talks to Supabase. |
| Types                 | `src/types/database.ts`                                      | Generated from the database with `npm run db:types`.                                        |
| Policies and triggers | `supabase/migrations/*.sql`                                  | Permissions, workflow rules, notifications, audit log.                                      |
| Tests                 | `supabase/tests/*.sql` (pgTAP), `src/**/*.test.tsx` (Vitest) | Prove the rules hold.                                                                       |

## Roles and responsibilities

- **Role** (`profiles.role`): `student`, `teacher` or `admin`. Nobody can change
  their own role. Admins change roles through `admin_set_role()`, which writes to
  `audit_log`.
- **Responsibility** (`responsibilities.kind`): `facilities`, `it`, `venues`,
  `supw`. Tags a staff member with a job. Fix-it routing, venue approvals and
  staff emails follow responsibilities, so no extra roles are needed.
- Helper functions used by every policy: `auth_role()`, `is_staff()`,
  `is_admin()`, `has_responsibility(kind)`.

## Notifications

Triggers call one function, `notify(recipient, type, title, body, link, urgent)`.
It checks the recipient's mutes, inserts a `notifications` row (the in-app inbox,
pushed live over Realtime), queues a `push_outbox` row, and for staff with
responsibilities queues an `email_outbox` row (`immediate` if urgent, else
`digest`). Nothing is actually sent yet; the Edge Function stubs show where
Resend and push delivery plug in.

## Tables by feature

Migrations live in `supabase/migrations/` and run in filename order.

| Feature                | Tables, buckets and read functions                                                                                                           | Migration                              |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| Defaults               | locks signed-out access and new functions down                                                                                               | `20261019120000_lockdown_defaults.sql` |
| Identity and roles     | `profiles`, `staff_emails`, `responsibilities`, `app_settings`, `audit_log`; `admin_list_users()`                                            | `20261019120100_identity.sql`          |
| Notifications          | `notifications`, `notification_prefs`, `email_outbox`, `push_outbox`; `notify()`                                                             | `20261019120200_notifications.sql`     |
| School map             | `floors`, `rooms`                                                                                                                            | `20261019120300_map.sql`               |
| Announcements          | `announcements`                                                                                                                              | `20261019120400_announcements.sql`     |
| SUPW volunteering      | `volunteer_events`, `event_roles`, `role_signups`; `volunteer_role_counts()`, `event_signups()`, `hours_to_confirm()`, `supw_hours_report()` | `20261019120500_volunteering.sql`      |
| Projects with teachers | `projects`, `project_shares`, `project_feedback`; bucket `project-files`                                                                     | `20261019120600_projects.sql`          |
| Collab finder          | `collab_posts`, `join_requests`, `content_reports`; `collab_post_counts()`, `collab_requests()`, `collab_team()`                             | `20261019120700_collab.sql`            |
| Venue booking          | `venues`, `bookings`; `booking_details()`, `venue_reminders()`                                                                               | `20261019120800_venues.sql`            |
| Fix-it reports         | `reports`, `report_votes`, `report_category_routes`; `report_feed()`, `open_reports_in_room()`; bucket `report-photos`                       | `20261019120900_fixit.sql`             |
| Realtime and cron      | Realtime on `notifications`, `bookings`, `reports`; hourly `venue_reminders()`                                                               | `20261019121000_realtime_and_cron.sql` |

The staff **Approvals** tab has no tables of its own: it reads the feature tables and
functions above (events awaiting approval, `booking_details()`, `report_feed()`,
`hours_to_confirm()`, `content_reports`).

## Screens (routes)

All routes are in `src/app/router.tsx`. Most screens load lazily (their code downloads on
first visit), so the app starts faster on phones.

| Route                                                                   | Screen                                                                                                            | Who                     |
| ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ----------------------- |
| `/login`                                                                | Sign in (dev password; Google / Microsoft when configured)                                                        | everyone                |
| `/`                                                                     | Home: greeting, search, six tools, today at school, announcements                                                 | everyone                |
| `/search?q=`                                                            | Search rooms, events, announcements, collab posts                                                                 | everyone                |
| `/announcements`, `/announcements/:id`                                  | Feed and one announcement                                                                                         | read: all               |
| `/announcements/new`, `/announcements/:id/edit`                         | Announcement editor                                                                                               | staff                   |
| `/notifications`, `/notifications/settings`                             | Inbox and mutes                                                                                                   | everyone                |
| `/me`                                                                   | Who you are, your jobs, notification settings, sign out                                                           | everyone                |
| `/map`, `/map/report`, `/reports/:id`                                   | Campus map with fix-it pins; report form; report detail                                                           | everyone (staff act)    |
| `/volunteer`, `/volunteer/new`, `/volunteer/:id`, `/volunteer/:id/edit` | SUPW events, roles, sign-ups                                                                                      | everyone                |
| `/projects`, `/projects/new`, `/projects/:id`, `/projects/:id/edit`     | Projects and teacher feedback                                                                                     | owners; shared teachers |
| `/collab`, `/collab/new`, `/collab/:id`, `/collab/:id/edit`             | Collab posts, requests, team                                                                                      | everyone                |
| `/book`, `/book/request`, `/book/mine`                                  | Venue calendar, request form, my bookings                                                                         | everyone                |
| `/approvals`                                                            | Staff queue                                                                                                       | teachers and admins     |
| `/admin/*`                                                              | Users, responsibilities, staff emails, venues, map editor, report routes, settings, moderation, audit log, outbox | admins                  |

## Decisions worth knowing

- **Times** are stored as `timestamptz` and shown in `Asia/Dubai` (`src/lib/dates.ts`).
- **Privacy through column grants and functions.** Where some people may see a
  column and others may not (who reported a fix-it problem, contact emails, a
  booking's purpose), the table doesn't grant that column to anyone, and a
  `security definer` function hands it out only to the right people. We use
  functions rather than views because the permission check is written out
  explicitly inside them.
- **Unknowns are data.** Anything the school hasn't decided lives in
  `app_settings`, a table, or an env var. See `docs/OPEN_QUESTIONS.md`.
