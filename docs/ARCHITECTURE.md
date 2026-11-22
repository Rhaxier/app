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

| File                      | What it holds                                                                                                                                                                                                                                  |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/styles/tokens.css`   | Every colour, size, radius, shadow and duration. Page 12's tokens copied exactly (`--paper`, `--card`, `--ink`, `--acc`, `--g-*`, `--e1`…), plus the type scale, radii and spacing from pages 3, 10 and 11. Dark on `:root`, light in `.light` |
| `src/styles/glass.css`    | The liquid glass material: `.glass` (Regular), plus `.tabglass`, `.thick` and `.thin`, and `.lens` for the active tab                                                                                                                          |
| `src/styles/globals.css`  | Type, the ambient glow behind every screen, the keyboard focus ring                                                                                                                                                                            |
| `src/styles/tailwind.css` | Tailwind, for shadcn/ui components only: no reset, shadcn's colour names mapped onto the tokens                                                                                                                                                |
| `src/components/ui/`      | shadcn/ui components (Radix base), added with `npx shadcn add <name>`                                                                                                                                                                          |
| `src/lib/theme.ts`        | System / Dark / Light (Me > Appearance), saved on the device; `index.html` applies it before the first paint                                                                                                                                   |
| `src/lib/contrast.ts`     | The school's own accent colour, worked out for both themes                                                                                                                                                                                     |

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

### Screen sizes: phone, tablet, laptop

The design is drawn for a 390px phone. On iPads and laptops the same screens get a
layout of their own; on phones nothing changes.

| Layout | When (`src/lib/layout.ts`)     | Navigation                                    | Screen column                        |
| ------ | ------------------------------ | --------------------------------------------- | ------------------------------------ |
| phone  | anything smaller               | the floating tab bar at the bottom (`TabBar`) | 480px, centred                       |
| tablet | 744px wide **and** 500px tall  | a glass icon rail on the left (`SideNav`)     | up to 720 / 1160 / 1440px (below)    |
| laptop | 1024px wide **and** 500px tall | the rail with full labels, a sidebar          | the same; three cards across at 1280 |

- **Why 744 and the height check.** 1024 is Tailwind's `lg`; the tablet layout starts at
  744 rather than Tailwind's `md` (768) so an iPad mini held upright gets it too. The
  height check keeps iPhones turned sideways (wide but only ~430px tall) on the phone
  layout.
- **The side navigation is the tab bar turned upright**: the same tabs (`tabsFor`), the
  same lens and search button, plus the bell and Me at the bottom (on a phone those are
  in the Home header). On the map and the admin dashboard it stays a rail even on a
  laptop, to leave the room to the plan and the admin menu. `AppLayout` marks `<html>` with `data-nav="rail"` or
  `"sidebar"`; CSS for anything fixed to the screen uses `--nav-space` to keep clear.
- **Three screen widths** (`src/app/screenWidths.ts`): `reading` (720px: forms, text),
  `page` (1160px: card lists, detail screens, the map) and `wide` (1440px: the desk view
  and admin).
- **Screens follow their own width, not the window's.** The screen column is a CSS
  container named `screen`, so screen CSS uses `@container screen (min-width: …)`. The
  phone column is at most 440px wide, so a rule from 600px up can never show on a phone.
  Two shared layouts live in `globals.css`: `.card-grid` (cards two or three across) and
  `.split` with `.split-aside` (a detail screen's main column plus a sticky side column).
- **Fixed things go outside the column.** Being a container makes the column the frame
  for `position: fixed` inside it, so fixed chrome is drawn at the end of `<body>`
  instead: with `PageChrome` (the map, the booking bar); `Sheet` and `Toaster` do it
  themselves.
- **Sheets become dialogs** in the middle of the screen, and search becomes a panel near
  the top, on tablets and laptops.
- **The map** fills the screen under the rail. On a laptop or an iPad turned sideways its
  controls and card form one column at the left and the plan fits beside it; on an iPad
  held upright they stay along the top and bottom, as on a phone, so the plan stays large
  (`src/features/map/mapMargins.ts`).
- **Testing a size:** `setScreenSize(width, height)` from `src/test/media.ts`, then
  `resetScreenSize()` after the test.

### shadcn/ui and Tailwind

shadcn/ui is set up (`components.json`, Radix base) for components the app doesn't have
yet, such as menus, popovers and comboboxes. Tailwind v4 is there only for them; the
app's own screens stay on CSS Modules and tokens, and nothing about them changed.

- **Tailwind's reset is off.** It would restyle every element in the app. shadcn
  components get the small part they rely on, scoped to their own elements
  (`[data-slot]`, at the end of `tailwind.css`).
- **shadcn's colours are the design tokens.** `bg-primary` is the primary button fill
  (white in dark mode, black in light), `bg-muted` is `--card2`, `ring` is the accent,
  radii are the design's concentric radii. Light and dark mode and a school's own
  colour come for free. The `dark:` variant means "not `.light`".
- **Cascade layers decide who wins** (declared at the top of `tokens.css`): `theme` <
  `base` < `components` < `utilities`, and anything unlayered beats every layer. The
  app's element defaults (`globals.css`) are in `base`, so a Tailwind class on a shadcn
  component can override, say, the link colour. Tokens, CSS Modules, `glass.css` and
  `motion.css` are unlayered, so nothing from Tailwind can change the app's components.
- **Same names, different meanings.** The app's `--muted` is grey text; shadcn's would
  be a pale background. The app's always wins, so in shadcn components use the
  `bg-muted` / `text-muted-foreground` utilities, never `var(--muted)` directly.
- **Touch targets.** shadcn's default button is 32px tall; use `size="lg"` or add `h-11`
  where people tap, to keep the 44px minimum.

## Motion

Interactions should feel quick and calm, iOS-style: presses respond at once (scale .97,
darken 6%, 4% in light mode), indicators spring to where you tapped, screens slide when
you drill in and cross-fade between tabs, sheets glide up. Everything settles in 150–400ms
and only `opacity` and `transform` ever animate. Simple things (presses, hovers, fades,
list stagger) are plain CSS; springs, shared-element moves and exits use Motion (the
`motion` package).

**One tokens file:** `src/lib/motion.ts` holds every duration, curve, distance and spring.
Motion components import the springs; `installMotionTokens()` (called in `main.tsx`)
writes the same values onto `<html>` as CSS custom properties, so CSS and Motion can't
drift apart.

| Token / export                      | Value                             | Used for                                         |
| ----------------------------------- | --------------------------------- | ------------------------------------------------ |
| `--motion-fast` / `duration.fast`   | `120ms`                           | press feedback, hovers, colour changes           |
| `--motion-base` / `duration.base`   | `200ms`                           | fades, list items, toasts                        |
| `--motion-slow` / `duration.slow`   | `280ms`                           | CSS-only panels                                  |
| `--ease-out` / `easeOut`            | `cubic-bezier(0.2, 0, 0, 1)`      | everything that arrives (the deck's curve)       |
| `--ease-in-out` / `easeInOut`       | `cubic-bezier(0.4, 0, 0.2, 1)`    | things moving on screen                          |
| `--motion-shift` / `distance.shift` | `8px` (`0px` with reduced motion) | how far things travel as they fade in            |
| `spring.indicator`                  | 0.34s, bounce 0.14                | tab lens, segmented thumb, chip pill             |
| `spring.page`                       | 0.32s, no bounce                  | screens sliding in and out                       |
| `spring.sheet`                      | 0.4s, bounce 0.08                 | sheets, the search panel growing from its button |
| `spring.pop`                        | 0.3s, bounce 0.22                 | notification dots and counters                   |

**What to use:**

| You want…                                | Use                                                                                                  |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| A tappable thing that presses in         | `className="pressable"` (Button, chips, tiles and tabs already have it)                              |
| Feedback after an action                 | `meta: { successMessage: 'Saved' }` on the mutation, or `showToast()` (`src/lib/toast.ts`)           |
| Errors from a button with nowhere to say | `meta: { errorToast: true }` on the mutation                                                         |
| A loading list                           | `<LoadingState />` (skeleton cards; `shape="row"`, `"slot"` or `"block"` for other shapes)           |
| Items that arrive or leave while open    | `<MotionList>` or `useListMotion()` (new items slide in, removed ones fade out; first load is still) |
| A pop-up panel                           | `<Sheet open={…}>` (springs up, reverses on close, moves focus in and back)                          |
| A selected option that slides            | `<SegmentedControl>`, or `<ChipGroup>` with sliding chips (a shared `layoutId`)                      |
| A number that changes                    | `<AnimatedNumber value={…} />` (rolls; screen readers get the plain value)                           |
| An instant response to a small toggle    | An optimistic mutation: see `useToggleVote` (fix-it), `useMarkRead`, `useSetRequestStatus`           |

**Screen changes** (`src/app/screenTransitions.ts`, used by `AppLayout`): drilling in
(`/collab` → `/collab/123`) slides the new screen in from the right while the old one
drifts left; coming back reverses it; switching tabs cross-fades. The leaving screen is
lifted out of the page's flow (`AnimatePresence mode="popLayout"`), so nothing jumps.
Only the screen moves: the tab bar is outside it, and screens move their own fixed chrome
(the map, the booking bar) out of the sliding layer with `PageChrome`, so it fades in
place. The browser's View Transitions API isn't used: an element with a
`view-transition-name` can't blur what's behind it, which would turn the glass off.

**The tab bar**: the active tab's raised lens is one element that springs between tabs
(Motion `layoutId="tab-lens"`), and the search button grows into the search overlay and
shrinks back when it closes (`SEARCH_MORPH_ID`). ⌘K / Ctrl+K opens search without
animation: a keyboard shortcut should feel instant.

**Reduced motion** (the design's "opacity only"). When the device asks for less motion,
nothing slides, shrinks or springs, but things still fade: `<MotionConfig
reducedMotion="user">` (App.tsx) drops Motion's movement, `--motion-shift` becomes 0 and
`--press-scale` 1, and Leaflet's zoom stops animating. `motionMs()` still returns the real
durations, so code waits for the fades. **Reduced transparency** swaps every glass
surface for a solid fill (`src/styles/glass.css`). The ambient glow behind the screens
stays still on purpose: a moving backdrop would make every glass surface redraw its blur
on each frame.

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
