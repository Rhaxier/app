# Hand-off: the school app framework

What's built, how to run it, how it was tested, what the school still has to decide,
what you need to switch on, and where to start reading.

**Round 2 (motion and the admin dashboard)** is summarised in section 1b; the rest of
this document is updated for it.

## 1. What was built

Every screen, the whole database, all permissions and the workflow logic, running end to
end against Supabase with fake sample data. One commit per milestone (`git log`).

| Milestone            | What it contains                                                                                                                                                                                                                          |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M0 Skeleton          | Vite + React 18 + TypeScript, design tokens from the design PDF, shared components, ESLint + Prettier, Vitest, Supabase CLI config, `vercel.json`, `capacitor.config.ts`, README                                                          |
| M1 Database          | 11 migrations: every table with RLS, helper functions, triggers, `notify()` + outboxes, audit log, storage buckets, Realtime, pg_cron reminders. Seed with 12 dev users and content for every feature. 8 pgTAP files. Edge Function stubs |
| M2 Shell and auth    | Login (dev password; Google / Microsoft wired, switched by env), session, role-aware tab bar with Approvals for staff, bell with live badge, inbox, mute settings, dev role switcher, Me screen                                           |
| M3 Announcements     | The reference feature, commented at every layer, with `docs/features/announcements.md`                                                                                                                                                    |
| M4 SUPW volunteering | Events, roles, sign-ups, approval of student events, selection with caps, waitlists, attendance, hours                                                                                                                                    |
| M5 Projects          | Share with teachers, feedback, status, private file attachments                                                                                                                                                                           |
| M6 Collab finder     | Posts, join requests, contact, accept/decline, auto-close when full, moderation, Report button                                                                                                                                            |
| M7 Venue booking     | Live calendar, slot selection, requests, supervising teacher, approval with clash rejection, announce, no double bookings                                                                                                                 |
| M8 School map        | Leaflet floor plans (placeholders), room pins, rooms in use now, room search                                                                                                                                                              |
| M9 Fix-it reports    | Report form with safety notice and duplicate check, routing, Me too, status updates, private photos, map pins                                                                                                                             |
| M10 Staff and admin  | Approvals queue; admin screens for users and roles, responsibilities, staff emails, venues, map editor, report routes, settings, moderation, audit log, outbox; SUPW CSV export                                                           |
| M11 Polish           | Search, accessibility pass (44px targets, focus trap in sheets), 320px and desktop checks, lazy-loaded screens, docs                                                                                                                      |

The six reference screens from the design PDF (Home, Campus map, Volunteer, Book a venue,
Projects, Collab finder) are built to match, with the plan's additions (roles per event,
spots wanted on collab posts, the staff Approvals tab, teacher approval of student events).

**Skipped on purpose (out of scope):** real SSO set-up, actually sending email or push,
store builds, deployment, in-app chat (Contact opens the school email), calendar feeds.

**Bugs found and fixed while testing end to end** (worth reading about):

- The read policy on `reports` called a function that couldn't see a row being inserted,
  so the app's `insert … returning id` failed. Fixed and covered by a test (see
  `docs/features/fixit.md`, "A gotcha worth knowing").
- Typing into a field inside a bottom sheet lost focus after one character, because the
  sheet's effect re-ran on every render. Fixed in `src/components/Sheet.tsx` with a test.

## 1b. Round 2: motion and the admin dashboard

| Step                 | What it contains                                                                                                                                                                                                                                                    |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Part A Motion        | Motion tokens; press feedback; View Transitions for screen changes (fade between tabs, rise when drilling in, reverse going back); sheets slide and reverse; list items arrive and leave; skeleton loading; toasts; optimistic toggles; reduced motion. No library. |
| B1 Overview          | Admin dashboard shell (side menu on a laptop, menu screen on a phone); needs-attention cards; 7/30-day numbers and two bar charts, all counted in the database                                                                                                      |
| B2 People and grades | Users (search, filters, roles, suspension), grades and sections, classes (teachers' audiences, Q12), CSV import with preview, year-end rollover                                                                                                                     |
| B3 School calendar   | School week and periods (bookings use them), terms, holidays, venue blackouts, all enforced in the database                                                                                                                                                         |
| B4 Feature settings  | Scheduled and expiring announcements; skill tags and suggestions; team size; volunteering categories and SUPW targets; report categories as a table; auto-urgent; venue booking limits; floor plan upload                                                           |
| B5 Moderation        | One queue of reported, hidden and removed content; soft delete and restore                                                                                                                                                                                          |
| B6 Notifications     | Emergency broadcast (rate-limited); digest time; per-staff email settings                                                                                                                                                                                           |
| B7 System            | Feature switches, branding with a contrast check, maintenance banner, CSV exports, data deletion, audit log filters                                                                                                                                                 |
| Final pass           | Every screen checked at 390px and 1280px for sideways overflow (none), page errors (none) and tap targets; reduced motion checked in a browser; docs                                                                                                                |

The full guide is [`docs/features/admin-dashboard.md`](features/admin-dashboard.md); the
motion rules are in [`docs/ARCHITECTURE.md`](ARCHITECTURE.md), "Motion".

### Migrations to run on a cloud project

```bash
npx supabase db push --include-seed
```

It applies the eight new migrations (`20261023120000` to `20261023120600`) in order. Leave
out `--include-seed` on a real school's project; with it, the seed only runs on an empty
database (or after `npx supabase db reset --linked`, which wipes everything).

**Which ones change existing data:**

- `…120100_people_and_grades`: copies `app_settings.grades` into the new `grades` table
  and existing profile sections into `sections`, then drops `app_settings.grades`.
- `…120200_school_calendar`: turns the three booking-slot settings into rows of `periods`
  on the school days, then drops those settings. Booking works as before.
- `…120300_feature_settings`: **the report categories change.** It creates
  `report_categories` from the old `report_category` enum and `report_category_routes`
  (each old value becomes the row's `key`, with its team), changes `reports.category`
  from the enum to text pointing at that key, then drops the enum and the routes table.
  Every report keeps its category and routing. It also renames
  `announcements.published_at` to `publish_at`, copies a single SUPW target (if set) to
  every grade, and makes existing posts' skills the first skills list.
- The others only add tables, columns and functions.

## 1c. Round 3: side-by-side fields, bell times, booking by periods

| Change                  | What was done                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Overlapping fields      | Cause: two-column rows were `1fr 1fr` grids, and a `1fr` column never shrinks below its content's minimum width. Native date and time inputs have a built-in minimum (wider on iPhones, where Safari also ignores `width: 100%`), so on a phone the second field spilled out or over its neighbour. Fix: one shared `FieldRow` (fields shrink to their share, `min-width: 0`, and stack below about 420px) and date/time inputs without the native box, used on every screen with paired fields. |
| Bell times upload       | Admin > School calendar > Upload bell times: template filled with today's periods, a database dry run that shows each line's problem, then an all-or-nothing import that replaces only the weekdays in the file, in one transaction, written to the audit log. Periods on the same weekday can no longer overlap.                                                                                                                                                                                |
| Bell times for everyone | `/bell-times`, from a new card on Home ("Now: Period 2, until 10:30"): any school day's own periods.                                                                                                                                                                                                                                                                                                                                                                                             |
| Booking by periods      | The booking list shows the chosen date's periods by name and time; pick one or a run of neighbours, never across a booked, pending, holiday or blackout period. The database refuses new bookings that don't start and end on that weekday's periods, unless an admin turns on `allow_custom_booking_times` (Admin > Venues), which adds an "Another time" card. Existing bookings are untouched.                                                                                                |

**Why the fixed 90-minute slots were still there.** The booking screen already read the
`periods` table, but on an upgraded project those periods _are_ the old slots: the round 2
calendar migration turned the slot settings (07:30, 90 minutes, the same every day) into
periods, and `db push` doesn't run the seed's weekday-specific timetable (even the seed's
periods are 90 minutes long, apart from Friday's). The list showed only a start time and
"Available", so it looked unchanged, and the database accepted any times. Check yours with
`select name, starts_at, ends_at, weekdays from periods order by starts_at;` and upload the
real bell times.

### Migrations to run on a cloud project (round 3)

```bash
npx supabase db push
```

It applies `20261027120000_period_import.sql` and `20261027120100_booking_by_periods.sql`.
Neither changes existing data: the first adds the period overlap trigger and the import
function, the second adds `app_settings.allow_custom_booking_times` (off) and the bell
times check on new bookings. Then upload the school's bell times (Admin > Upload bell
times); until then, bookings follow the periods already in the table.

## 1d. Round 4: the v5 design ("Campus")

The whole app now follows `docs/School-App-Design.pdf` v5. No database change.

| Change           | What was done                                                                                                                                                                                                        |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tokens and type  | Page 12's tokens copied exactly into `tokens.css` (dark on `:root`, light in `.light`), with the type scale, concentric radii, spacing, elevation and motion from pages 3, 10 and 11. Instrument Sans and Geist Mono |
| Liquid glass     | `src/styles/glass.css`, the page 4 recipe in order: backdrop filter, tint, sheen, top-left highlight, 0.5px rim, edge highlights, E3 lift. Regular, tab bar, thick and thin materials, and the active-tab lens       |
| Light mode       | Designed, not inverted: grey canvas, navy shadows, brighter glass, darker status text, black primary button. System, Dark or Light under Me > Appearance                                                             |
| Navigation       | A floating glass tab bar with a raised lens on the active tab, and a round glass search button beside it. ⌘K / Ctrl+K opens search                                                                                   |
| Home             | Two-line greeting, pinned news as the one large card (swipe between several), six tools in one card with counts and dots, announcements as quiet rows                                                                |
| Map              | The plan fills the screen under floating glass controls; placeholder plans redrawn as an architect's plan, inverted for dark mode; count pins, selected-room tag, "You are here"; fix-it and room sheets in glass    |
| Volunteer, Book  | Hours as one large figure with an 8-week chart; roles with capacity bars. Booking reads like a timetable; your run of periods is one blue block; a floating glass bar with the times and Request                     |
| Projects, Collab | One grouped card with teacher feedback quoted inline; collab posts lead with the title, skills, and spots you can count                                                                                              |
| Staff desk view  | Approvals is now one queue, oldest first, with counts leading the page, a filter by kind, and quick actions on every row; a table on a laptop                                                                        |
| Micro-details    | Notification dot, press and focus states, segmented thumb, hairlines, corridor hatch; reduced motion fades without moving                                                                                            |

**Glass and screen changes.** An element with a `view-transition-name` becomes a
"backdrop root", and any glass inside it can only blur what's inside it (nothing). The tab
bar used to have one so it stayed still during screen changes; screens now only fade (the
design's motion), so the bar stays still without it. See "Look and feel" in
`docs/ARCHITECTURE.md`.

**How it was checked.** Every reference screen was screenshotted against the PDF in dark
and light at 390px, the desk view at 1280px, and the main screens at 320px (no sideways
overflow). Headless Chrome's software renderer doesn't blur in-page content behind fixed
glass, so the screenshots were taken with GPU emulation (SwiftShader); real browsers blur
normally.

## 1e. Round 5: glass, motion, timetable booking, polish

Eight items, one commit each (`Item 1` … `Item 8` in `git log`).

| Item                   | What was done                                                                                                                                                                                                  |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 More liquid glass    | Cards, tiles, list rows, inputs, segmented controls, chips, sheets and popovers are glass (`.surface`, `.surface-control`); never glass on glass; solid with reduced transparency                              |
| 2 iOS-style motion     | Motion library: the tab lens springs between tabs, screens slide when drilling in and back, search grows out of its button, sliding segments and chips, rolling counters. One tokens file: `src/lib/motion.ts` |
| 3 Timetable booking    | The 2026–27 bell times (`docs/timetable/`) loaded into `periods`; booking offers periods, breaks and lunch as the school day runs (Q56)                                                                        |
| 4 After-school booking | Blocks after the last period, under "After School Hours", 30 minutes until 18:00 by default (Q55). **Needs migration `20261114120000` pushed**                                                                 |
| 5 Bottom bar           | 50px search button, labels no longer widen when active; staff phones under 390px get search in the Home header                                                                                                 |
| 6 Search as you type   | Results 150ms after typing stops; Enter at once; waits for Japanese/Chinese/Korean keyboards to finish a word                                                                                                  |
| 7 Ambient glows        | Rose, teal and amber glows join blue and violet; contrast checked; still, not drifting                                                                                                                         |
| 8 Admin descriptions   | A subtitle under every admin section and footnotes under hard settings, all in `src/features/admin/strings.ts`                                                                                                 |

## 2. How to run it

See the [README](../README.md):

- **Local Supabase (Docker):** `npm install`, `npm run db:start`, copy the URL and anon
  key into `.env`, `npm run dev`.
- **Cloud Supabase (no Docker):** create a free project, `npx supabase link`,
  `npx supabase db push --include-seed`, copy the URL and key into `.env`, `npm run dev`.
- **Dev role switcher:** with `VITE_AUTH_PROVIDER=dev`, tap **Dev** (bottom right) and pick
  any seeded user. Password for all of them: `devpass123`.

## 3. Test results

| Suite                                        | Result                                                                                                         |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Database (pgTAP, `npm run db:test`)          | **383 passed, 0 failed** in 17 files; round 5's `18_after_school_test.sql` (11 checks) not yet run (no Docker) |
| UI (Vitest, `npm test`)                      | **209 passed, 0 failed** in 27 files (round 4: 197 in 26; round 3: 176 in 23)                                  |
| Lint, type check, Prettier, production build | All clean                                                                                                      |
| Edge Functions                               | Type-check with Deno                                                                                           |

The 15 required database rules map to these files: roles and audit (1) →
`01_identity_test.sql`; projects (2) → `05`; announcements (3) → `03`; volunteering (4–6)
→ `04`; venues (7–9) → `07`; collab (10–11) → `06`; fix-it (12–14) → `08`; notifications
(15) → `02`. Required UI tests: Approvals tab only for staff (`src/app/TabBar.test.tsx`),
booking slot states (`venues.test.tsx`), "x of y filled" (`collab.test.tsx`), and form
validation for every create form (each feature's test file).

Round 2's 12 database rules: (1) admin-only → `16_admin_lockdown_test.sql` (every
`admin_*` function and admin table, found automatically) plus checks in 09–15;
(2) suspension, (5) teachers' audiences, (6) rollover, (11) CSV import → `10_people_test`;
(3) blackouts and holidays → `11_calendar_test`, venue hours, length and days ahead →
`12_feature_settings_test`; (4) scheduled and expired announcements, (9) auto-urgent,
(10) report categories → `12`; (7) feature switches, (12) data deletion → `15_system_test`;
(8) emergency broadcast → `14_admin_notifications_test`. UI: admin routes refuse
non-admins and the overview shows counts (`src/features/admin/overview.test.tsx`), the
import preview shows row errors (`people.test.tsx`), the accent validator
(`src/lib/contrast.test.ts`), the toast (`src/components/Toaster.test.tsx`) and optimistic
rollback (`src/features/fixit/optimistic.test.tsx`).

Round 3: `17_bell_times_test.sql` covers a booking off the period boundaries refused with
custom times off and allowed with them on, a two-period booking accepted, the short Friday,
the venue limits still applying, and the CSV import refusing overlapping and invalid lines
and replacing only the weekdays in the file. UI: period selection can't cross an
unavailable period (`venues.test.tsx`), and the import preview shows each line's problem
(`src/features/admin/bellTimes.test.tsx`).

### How it was verified, and what wasn't

Docker wasn't available while building, so `supabase start` and `supabase test db` were
**not** run. Instead:

- The migrations, seed and pgTAP tests ran on a real **Postgres 17** with pgTAP, plus a
  small stand-in for the parts Supabase provides (roles, `auth.uid()`, storage tables).
- The app ran end to end against **Supabase Auth (GoTrue v2.197)** and **PostgREST v16.4**,
  the same servers Supabase uses, with our migrations and seed applied to Auth's real
  `auth` schema. Flows were driven in Chromium: sign-in for each role, approving a
  student event, signing up, selecting volunteers, accepting collab requests until full,
  booking a free slot, approving a clashing booking with "announce", reporting and
  resolving a fix-it problem, changing a role and reading the audit log.
- `src/types/database.ts` was generated by the Supabase CLI from that database.
- A two-connection test confirmed the no-double-booking constraint holds across
  transactions, and that signed-out (anon) callers can't read any table or function.

**Not verified yet** (please check on the first `npm run db:start`):

- `supabase start` / `supabase db reset` / `supabase test db` themselves.
- **Storage**: photo uploads (fix-it) and project attachments, and their signed URLs.
- **Realtime**: the live bell badge and live calendar/map updates.
- Edge Functions running inside Supabase (they type-check, and they're dry runs).
- pg_cron scheduling of `venue_reminders()` (the fallback path was tested).
- Google / Microsoft sign-in, Capacitor builds and push.

**Round 2** was checked the same way (you then confirmed round 1 on a cloud project):
the eight new migrations, seed and all 16 pgTAP files on Postgres 17, and these flows in
Chromium against GoTrue + PostgREST: the admin overview at 390px and 1280px; importing a
CSV (preview with row errors, then import); the user editor with its confirmation on top
(Escape closes only the top one); booking weeks with a holiday and an exam blackout
greyed out; a student reporting a post and an admin removing it; an emergency broadcast
and its 10-minute refusal; switching collab off (tab, tile and screen hidden for a
student); a light accent colour refused and a dark one applied; the maintenance banner
on the sign-in screen; reduced motion (no animation, a sheet closes in 1ms instead of
~300ms, focus returns). Every admin and main screen was checked at both widths for
sideways overflow (none) and page errors (none).

**Not verified in round 2** (please check on the cloud project):

- **Storage**: floor plan and logo uploads (public buckets), and data deletion removing
  someone's files through the Storage API.
- **Realtime**: new items sliding into the inbox and Approvals while they're open.
- **pg_cron**: `publish_due_announcements()` every five minutes (the function itself is
  tested).
- **View Transitions** look: checked in Chromium only; Safari and Firefox use the same
  API where they support it, and the plain fade otherwise.
- `npx supabase db push` itself, in particular the two notification migrations
  (`…120500` adds an enum value that `…120510` uses; they're separate on purpose).

## 4. Open questions

All 50 are in [`OPEN_QUESTIONS.md`](OPEN_QUESTIONS.md), each with the default used, where
it lives and exact steps to change it. Q1, Q11, Q12, Q15, Q25, Q27, Q47 and Q48 are
configurable in Admin. In short:

| #   | Question                                       | Default used                                                                           |
| --- | ---------------------------------------------- | -------------------------------------------------------------------------------------- |
| Q1  | Who handles facilities/IT and approves venues? | Configurable in Admin: responsibilities + report categories                            |
| Q2  | Can students request venues?                   | Yes, with a supervising teacher who confirms first                                     |
| Q3  | Does the email format tell staff apart?        | No: a staff email list, plus an optional pattern                                       |
| Q4  | Must collabs have a teacher?                   | No (setting can require one)                                                           |
| Q5  | Google or Microsoft, and the domain?           | Neither yet; dev login; both wired, switched by env                                    |
| Q6  | Real floor plans, rooms, venues?               | Placeholder plans, 15 rooms, 4 venues                                                  |
| Q7  | Email provider?                                | Nothing sent; outbox + dry-run function                                                |
| Q8  | Push?                                          | Nothing sent; outbox + dry-run function; flag off                                      |
| Q9  | Name, logo, term dates, SUPW rules?            | Placeholders; no SUPW target                                                           |
| Q10 | Venue reminder timing?                         | 48 hours pending or event within 3 days, hourly                                        |
| Q11 | School days and periods?                       | Configurable in Admin: Sun–Thu, five 90-minute periods (sample: Mon–Fri, short Friday) |
| Q12 | Which grades does each teacher teach?          | Configurable in Admin: classes; teachers may post anywhere until switched off          |
| Q13 | Who confirms hours on staff events?            | Organising teacher, approving teacher, SUPW coordinator, admins                        |
| Q14 | Who sees approved booking details?             | Everyone sees title/venue/time; details only for those involved                        |
| Q15 | Who gets email?                                | Configurable in Admin: responsibility holders, digest; per-person override             |
| Q16 | What can be muted?                             | Everything except approvals and urgent items                                           |
| Q17 | Busy events' sign-up notifications?            | One per sign-up (mutable)                                                              |
| Q18 | Can people edit their profile?                 | No; admins edit names and grades                                                       |
| Q19 | Can a student edit an approved event?          | No; locked after approval                                                              |
| Q20 | Can a booking's time change?                   | No; cancel and request again                                                           |
| Q21 | Which reports can students see?                | Unresolved ones, plus their own and ones they backed                                   |
| Q22 | Content reports notify anyone?                 | No; staff see them in Approvals and Admin > Moderation                                 |
| Q23 | What does the audit log record?                | Admin-only tables, roles, moderation, by app users                                     |
| Q24 | App id and name?                               | `com.placeholder.schoolapp`, "School App"                                              |
| Q25 | Which grades use the app?                      | Configurable in Admin: grades and sections tables                                      |
| Q26 | What does search cover?                        | Rooms, events, announcements, collab posts; not people                                 |
| Q27 | Event categories (mockup's "Environment")?     | Configurable in Admin: none for a new school, four sample ones                         |
| Q28 | Whose pending requests show on the calendar?   | Your own; venue staff see all                                                          |
| Q29 | What counts as an active person?               | Signed in or did anything in the period                                                |
| Q30 | How is venue utilisation measured?             | Approved hours ÷ bookable hours (periods, minus holidays and blackouts)                |
| Q31 | What does a posting suspension block?          | New announcements, posts, requests, events, reports                                    |
| Q32 | How does the rollover move students?           | To the next grade in use; top grade archived, sign-in blocked                          |
| Q33 | Who can be imported?                           | Students and teachers; admins one at a time                                            |
| Q34 | Volunteering on holidays or weekends?          | Allowed, with a warning                                                                |
| Q35 | Bookings on weekends or outside term?          | Not offered; a day without periods is refused unless custom times are on               |
| Q36 | Scheduled and expiring announcements?          | Hidden until published and after expiry; default expiry off                            |
| Q37 | When does a report become urgent by itself?    | After 5 "me too"                                                                       |
| Q38 | Team size and skills?                          | Up to 8 including the owner; skills from a list, suggestions reviewed                  |
| Q39 | Must student events be approved?               | Yes (switchable)                                                                       |
| Q40 | Venue booking limits?                          | None by default; sample Auditorium and MPH have some                                   |
| Q41 | What does removing content do?                 | Soft delete: admins only, restorable                                                   |
| Q42 | Emergency broadcast?                           | Pinned urgent announcement + urgent notification to all; 10-minute limit               |
| Q43 | Feature switches?                              | All on; off hides and blocks new content, deletes nothing                              |
| Q44 | Branding, and what signed-out visitors see?    | Placeholder name, no logo, system blue; `public_status()` is the only signed-out call  |
| Q45 | What does data deletion delete?                | Name, email, files, settings, sign-in; records stay as "Deleted user"                  |
| Q46 | Maintenance banner?                            | Off; on shows on every screen until its end time                                       |
| Q47 | The timetable's format?                        | Configurable in Admin: CSV upload, all or nothing, whole weekdays replaced             |
| Q48 | Bookings at times that aren't periods?         | Configurable in Admin: no by default (custom times off)                                |
| Q49 | Can periods overlap on the same day?           | No; staggered lunches are one "Lunch" period                                           |
| Q50 | Who sees the bell times?                       | Everyone signed in (Home card, `/bell-times`)                                          |
| Q51 | Light or dark by default?                      | Follows the device; anyone can choose under Me > Appearance (saved on the device)      |
| Q52 | Design colours below 4.5:1?                    | Kept as designed, except badge text, which is strengthened to reach 4.5:1              |
| Q53 | "You are here" on the map?                     | Only from a `/map?here=G.14` link (e.g. a QR code); location is never read             |
| Q54 | Fonts from Google or bundled?                  | Bundled (Fontsource), so the phone app works offline                                   |

## 5. What you need to unlock

| Item                     | Exact steps                                                                                                                                                                                                                                                                                                       |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Supabase project**     | Create a free project (README, option B) or run `npm run db:start` with Docker. Check the "Not verified yet" list above on first run.                                                                                                                                                                             |
| **School answers**       | Take Q1–Q4, Q11, Q12 and Q29–Q50 to the school, and ask for the bell times of each weekday (upload them as a CSV, Q47). Almost every answer is a change in the admin dashboard (`/admin`), no code.                                                                                                               |
| **First real admin**     | After the first real sign-in, in the Supabase SQL editor: `update profiles set role = 'admin' where email = '<their email>';`. From then on use Admin > People > Users (or import everyone from a CSV).                                                                                                           |
| **School sign-in (SSO)** | Q5 steps 1–5: OAuth client from school IT (Google Cloud or Microsoft Entra), redirect URL `<SUPABASE_URL>/auth/v1/callback`, enable the provider in Supabase, set the school email domain in Admin > System > Sign-in, set `VITE_AUTH_PROVIDER` and `VITE_SCHOOL_EMAIL_DOMAIN`. Then untick "Allow dev accounts". |
| **Email**                | Q7: choose a provider (e.g. Resend), set the secret, add the send call where `supabase/functions/send-emails/index.ts` says, deploy with `npx supabase functions deploy send-emails`, schedule it (README, "Email and push").                                                                                     |
| **Push**                 | Q8: Firebase project with the Android and iOS apps, a `device_tokens` table, the FCM call in `send-push`, then `VITE_ENABLE_PUSH=true`.                                                                                                                                                                           |
| **Floor plans**          | Q6: upload each floor's plan on Admin > Features > Map (size filled in), click to place each room; add real venues and their limits on Admin > Features > Venues.                                                                                                                                                 |
| **Store builds**         | Q24: choose the real app id and name first. Then `npx cap add android` / `npx cap add ios`, `npm run cap:sync`, build in Android Studio / Xcode (needs a Mac). Store accounts belong to the school.                                                                                                               |
| **Hosting**              | Import the repo in Vercel, set the four `VITE_` env vars, add the deployed URL to Supabase's redirect URLs.                                                                                                                                                                                                       |

## 6. Suggested reading order

1. [`docs/ARCHITECTURE.md`](ARCHITECTURE.md): the big picture, one page.
2. [`docs/features/announcements.md`](features/announcements.md): the reference feature,
   file by file from migration to test. Read every file it lists.
3. `supabase/migrations/20261019120000_lockdown_defaults.sql` and
   `20261019120100_identity.sql`: roles, helper functions, the audit log.
4. `supabase/migrations/20261019120200_notifications.sql`: how every notification is made.
5. `src/app/` (router, guards, layout, tab bar) and `src/features/auth/`.
6. One feature at a time, each with its guide in `docs/features/`: volunteering, projects,
   collab, venues, map, fixit, then approvals-and-admin.
7. "Motion" in [`docs/ARCHITECTURE.md`](ARCHITECTURE.md), then `src/lib/motion.ts`,
   `usePresence.ts`, `useListMotion.ts`, `toast.ts` and `src/styles/motion.css`.
8. [`docs/features/admin-dashboard.md`](features/admin-dashboard.md), section by section
   with its migration (`20261023120000` to `…120600`) and pgTAP file (09 to 16).
9. [`docs/features/bell-times.md`](features/bell-times.md): the CSV import and booking by
   periods (migrations `20261027120000` and `…120100`, pgTAP file 17), and `FieldRow` in
   "Decisions worth knowing" in [`docs/ARCHITECTURE.md`](ARCHITECTURE.md).
10. [`docs/OPEN_QUESTIONS.md`](OPEN_QUESTIONS.md) before talking to the school.

For each feature the order is the same: migration → its pgTAP test → `api.ts` →
`hooks.ts` → `logic.ts` → `components/` → `pages/` → `*.test.tsx`.
