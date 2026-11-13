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

| Feature                | Tables, buckets and read functions                                                                                                           | Migration                               |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| Defaults               | locks signed-out access and new functions down                                                                                               | `20261019120000_lockdown_defaults.sql`  |
| Identity and roles     | `profiles`, `staff_emails`, `responsibilities`, `app_settings`, `audit_log`; `admin_list_users()`                                            | `20261019120100_identity.sql`           |
| Notifications          | `notifications`, `notification_prefs`, `email_outbox`, `push_outbox`; `notify()`                                                             | `20261019120200_notifications.sql`      |
| School map             | `floors`, `rooms`                                                                                                                            | `20261019120300_map.sql`                |
| Announcements          | `announcements`                                                                                                                              | `20261019120400_announcements.sql`      |
| SUPW volunteering      | `volunteer_events`, `event_roles`, `role_signups`; `volunteer_role_counts()`, `event_signups()`, `hours_to_confirm()`, `supw_hours_report()` | `20261019120500_volunteering.sql`       |
| Projects with teachers | `projects`, `project_shares`, `project_feedback`; bucket `project-files`                                                                     | `20261019120600_projects.sql`           |
| Collab finder          | `collab_posts`, `join_requests`, `content_reports`; `collab_post_counts()`, `collab_requests()`, `collab_team()`                             | `20261019120700_collab.sql`             |
| Venue booking          | `venues`, `bookings`; `booking_details()`, `venue_reminders()`                                                                               | `20261019120800_venues.sql`             |
| Fix-it reports         | `reports`, `report_votes`, `report_categories` (B4); `report_feed()`, `open_reports_in_room()`; bucket `report-photos`                       | `20261019120900_fixit.sql`              |
| Realtime and cron      | Realtime on `notifications`, `bookings`, `reports`; hourly `venue_reminders()`                                                               | `20261019121000_realtime_and_cron.sql`  |
| Admin overview         | `admin_attention()`, `admin_metrics()`, `admin_venue_utilisation()`, `admin_supw_by_grade()`                                                 | `20261023120000_admin_overview.sql`     |
| People and grades      | `grades`, `sections`, `classes`, `class_teachers`, `class_students`, `roster`; suspension; import; rollover                                  | `20261023120100_people_and_grades.sql`  |
| School calendar        | `periods`, `terms`, `holidays`, `venue_blackouts`; `bookings_check_rules()`                                                                  | `20261023120200_school_calendar.sql`    |
| Feature settings       | `report_categories` (was an enum), `skill_tags`, `skill_tag_suggestions`, `volunteer_categories`, `supw_targets`; venue limits; scheduling   | `20261023120300_feature_settings.sql`   |
| Moderation             | `removed_*` columns; `admin_moderation_queue()`, `admin_moderate()`                                                                          | `20261023120400_moderation.sql`         |
| Notifications admin    | `emergency` type; `emergency_broadcasts`, `staff_email_prefs`; digest time                                                                   | `20261023120500…`, `…120510…`           |
| System                 | `feature_flags`; branding, maintenance, `public_status()`; exports; `admin_anonymise_user()`                                                 | `20261023120600_system.sql`             |
| Bell times             | periods can't overlap; `admin_import_periods()` (CSV preview and import)                                                                     | `20261027120000_period_import.sql`      |
| Booking by periods     | `app_settings.allow_custom_booking_times`; `booking_period_problem()` in `bookings_check_rules()`                                            | `20261027120100_booking_by_periods.sql` |

The staff **Approvals** tab has no tables of its own: it reads the feature tables and
functions above (events awaiting approval, `booking_details()`, `report_feed()`,
`hours_to_confirm()`, `content_reports`).

## Screens (routes)

All routes are in `src/app/router.tsx`. Most screens load lazily (their code downloads on
first visit), so the app starts faster on phones.

| Route                                                                   | Screen                                                                                                                                               | Who                     |
| ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| `/login`                                                                | Sign in (dev password; Google / Microsoft when configured)                                                                                           | everyone                |
| `/`                                                                     | Home: greeting, pinned news, six tools, bell times, today at school, announcements                                                                   | everyone                |
| `/search?q=`                                                            | Search rooms, events, announcements, collab posts                                                                                                    | everyone                |
| `/bell-times`                                                           | Any school day's periods (from the Home card)                                                                                                        | everyone                |
| `/announcements`, `/announcements/:id`                                  | Feed and one announcement                                                                                                                            | read: all               |
| `/announcements/new`, `/announcements/:id/edit`                         | Announcement editor                                                                                                                                  | staff                   |
| `/notifications`, `/notifications/settings`                             | Inbox and mutes                                                                                                                                      | everyone                |
| `/me`                                                                   | Who you are, your jobs, appearance (light or dark), notification settings, sign out                                                                  | everyone                |
| `/map`, `/map/report`, `/reports/:id`                                   | Campus map with fix-it pins; report form; report detail                                                                                              | everyone (staff act)    |
| `/volunteer`, `/volunteer/new`, `/volunteer/:id`, `/volunteer/:id/edit` | SUPW events, roles, sign-ups                                                                                                                         | everyone                |
| `/projects`, `/projects/new`, `/projects/:id`, `/projects/:id/edit`     | Projects and teacher feedback                                                                                                                        | owners; shared teachers |
| `/collab`, `/collab/new`, `/collab/:id`, `/collab/:id/edit`             | Collab posts, requests, team                                                                                                                         | everyone                |
| `/book`, `/book/request`, `/book/mine`                                  | Venue calendar, request form, my bookings                                                                                                            | everyone                |
| `/approvals`                                                            | Staff desk view: counts, then one queue of everything waiting on you                                                                                 | teachers and admins     |
| `/admin/*`                                                              | The admin dashboard: overview, people, school calendar, feature settings, moderation, notifications, system (see `docs/features/admin-dashboard.md`) | admins                  |

## Look and feel (design v5)

The look comes from `docs/School-App-Design.pdf` (v5, "Campus"): a true-black canvas,
cards that rest on it, and Apple-style liquid glass for everything that floats. Light
mode is designed separately, not inverted.

**Where it lives:**

| File                     | What it holds                                                                                                                                                                                                                                  |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/styles/tokens.css`  | Every colour, size, radius, shadow and duration. Page 12's tokens copied exactly (`--paper`, `--card`, `--ink`, `--acc`, `--g-*`, `--e1`…), plus the type scale, radii and spacing from pages 3, 10 and 11. Dark on `:root`, light in `.light` |
| `src/styles/glass.css`   | The liquid glass material: `.glass` (Regular), plus `.tabglass`, `.thick` and `.thin`, and `.lens` for the active tab                                                                                                                          |
| `src/styles/globals.css` | Type, the ambient glow behind every screen, the keyboard focus ring                                                                                                                                                                            |
| `src/lib/theme.ts`       | System / Dark / Light (Me > Appearance), saved on the device; `index.html` applies it before the first paint                                                                                                                                   |
| `src/lib/contrast.ts`    | The school's own accent colour, worked out for both themes                                                                                                                                                                                     |

**Rules worth knowing:**

- **Use tokens, never raw colours.** If a value isn't in `tokens.css`, add it there.
- **One primary action per screen** ("calm by default"). Button variants: `primary`
  (white in dark mode, black in light), `accent` (blue, your next step on a card:
  Request, Ask to join), `secondary`, `quiet`, `ghost`, and `alert` for destructive
  actions.
- **Glass only for things that float**: the tab bar and search button, the map's
  controls, sheets, the booking bar, toasts. Never glass on glass, and never body text on
  glass without its tint (the `.glass` class always includes it).
- **Nothing with glass inside it may have a `view-transition-name`.** It makes the
  element a "backdrop root", and the glass inside can then blur nothing. That's why the
  tab bar isn't named for screen changes (see Motion).
- **Status colours mean one thing each** (`src/components/Badge.tsx`, `src/lib/status.ts`):
  blue = yours or your next step, green = approved, yellow = pending, orange = fix-it,
  grey = draft or closed. Badge text reaches 4.5:1 on its tint in both themes
  (`--on-accsoft` and friends; checked in `src/lib/contrast.test.ts`).
- **Room codes use Geist Mono**; everything else is Instrument Sans. Numbers use tabular
  figures everywhere, so times and counts line up.
- **Floor plans are drawn light.** Dark mode inverts the plan image (`--plan-filter`), so
  a real plan uploaded by an admin becomes a dark architect's plan too.

## Motion

Interactions should feel quick and calm: presses respond at once (scale .97, darken 6%,
4% in light mode), screens fade, sheets glide, nothing bounces, nothing takes over
300ms. Everything is plain CSS (no animation library) and only `opacity` and
`transform` ever animate.

**Tokens** (`src/styles/tokens.css`):

| Token            | Value                             | Used for                                  |
| ---------------- | --------------------------------- | ----------------------------------------- |
| `--motion-fast`  | `120ms`                           | press feedback, hovers, colour changes    |
| `--motion-base`  | `200ms`                           | fades, list items, toasts, screen changes |
| `--motion-slow`  | `280ms`                           | bottom sheets                             |
| `--ease-out`     | `cubic-bezier(0.2, 0, 0, 1)`      | things arriving                           |
| `--ease-in-out`  | `cubic-bezier(0.4, 0, 0.2, 1)`    | things leaving or moving                  |
| `--motion-shift` | `8px` (`0px` with reduced motion) | how far things travel as they fade in     |

**What to use:**

| You want…                                | Use                                                                                                  |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| A tappable thing that presses in         | `className="pressable"` (Button, chips, tiles and tabs already have it)                              |
| Feedback after an action                 | `meta: { successMessage: 'Saved' }` on the mutation, or `showToast()` (`src/lib/toast.ts`)           |
| Errors from a button with nowhere to say | `meta: { errorToast: true }` on the mutation                                                         |
| A loading list                           | `<LoadingState />` (skeleton cards; `shape="row"`, `"slot"` or `"block"` for other shapes)           |
| Items that arrive or leave while open    | `<MotionList>` or `useListMotion()` (new items slide in, removed ones fade out; first load is still) |
| A pop-up panel                           | `<Sheet open={…}>` (slides up, reverses on close, moves focus in and back)                           |
| An instant response to a small toggle    | An optimistic mutation: see `useToggleVote` (fix-it), `useMarkRead`, `useSetRequestStatus`           |

**Screen changes** use the browser's View Transitions API. `src/app/screenTransitions.ts`
turns it on for every navigation and marks the direction on `<html data-nav>`. Screens
fade (the design's "fade 200ms"); nothing slides. Switching tabs cross-fades, drilling
into a detail page fades the new screen in over the old one, and going back fades the old
one away. Because nothing moves, the tab bar is identical in both pictures and stays
still. Taps pass straight through during a transition. Browsers without the API get a
plain fade (`AppLayout`).

**Reduced motion** (the design's "opacity only"). When the device asks for less motion,
nothing slides, shrinks or spins, but things still fade: `--motion-shift` becomes 0 and
`--press-scale` 1 (`tokens.css`), sheets fade instead of sliding, and Leaflet's zoom
stops animating. `motionMs()` still returns the real durations, so code waits for the
fades.

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
- **Admin functions start with `admin_` and check `is_admin()` first.** A test finds every
  one of them in the database and checks it refuses teachers and students
  (`supabase/tests/16_admin_lockdown_test.sql`).
- **Fields side by side use `FieldRow`** (`src/components/Input.tsx`). It lets each field
  shrink to its share of the row and stacks them on a phone, so date and time inputs (which
  have a built-in minimum width) never spill over their neighbour. Don't build your own
  two-column grid for form fields; if you need a grid, use `minmax(0, 1fr)` tracks.
- **Soft rules in triggers, hard rules in RLS.** Where a refusal needs a sentence a person
  can act on ("Posting is paused until…", "Collab is switched off"), a BEFORE INSERT
  trigger raises it; a restrictive RLS policy refuses the same thing underneath.
