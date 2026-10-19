# Hand-off: the school app framework

What's built, how to run it, how it was tested, what the school still has to decide,
what you need to switch on, and where to start reading.

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

## 2. How to run it

See the [README](../README.md):

- **Local Supabase (Docker):** `npm install`, `npm run db:start`, copy the URL and anon
  key into `.env`, `npm run dev`.
- **Cloud Supabase (no Docker):** create a free project, `npx supabase link`,
  `npx supabase db push --include-seed`, copy the URL and key into `.env`, `npm run dev`.
- **Dev role switcher:** with `VITE_AUTH_PROVIDER=dev`, tap **Dev** (bottom right) and pick
  any seeded user. Password for all of them: `devpass123`.

## 3. Test results

| Suite                                        | Result                                                              |
| -------------------------------------------- | ------------------------------------------------------------------- |
| Database (pgTAP, `npm run db:test`)          | **119 passed, 0 failed** in 8 files, covering all 15 required rules |
| UI (Vitest, `npm test`)                      | **111 passed, 0 failed** in 15 files                                |
| Lint, type check, Prettier, production build | All clean                                                           |
| Edge Functions                               | Type-check with Deno                                                |

The 15 required database rules map to these files: roles and audit (1) →
`01_identity_test.sql`; projects (2) → `05`; announcements (3) → `03`; volunteering (4–6)
→ `04`; venues (7–9) → `07`; collab (10–11) → `06`; fix-it (12–14) → `08`; notifications
(15) → `02`. Required UI tests: Approvals tab only for staff (`src/app/TabBar.test.tsx`),
booking slot states (`venues.test.tsx`), "x of y filled" (`collab.test.tsx`), and form
validation for every create form (each feature's test file).

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

## 4. Open questions

All 28 are in [`OPEN_QUESTIONS.md`](OPEN_QUESTIONS.md), each with the default used, where
it lives and exact steps to change it. In short:

| #   | Question                                       | Default used                                                                            |
| --- | ---------------------------------------------- | --------------------------------------------------------------------------------------- |
| Q1  | Who handles facilities/IT and approves venues? | Responsibilities + category routes; placeholder staff hold them                         |
| Q2  | Can students request venues?                   | Yes, with a supervising teacher who confirms first                                      |
| Q3  | Does the email format tell staff apart?        | No: a staff email list, plus an optional pattern                                        |
| Q4  | Must collabs have a teacher?                   | No (setting can require one)                                                            |
| Q5  | Google or Microsoft, and the domain?           | Neither yet; dev login; both wired, switched by env                                     |
| Q6  | Real floor plans, rooms, venues?               | Placeholder plans, 15 rooms, 4 venues                                                   |
| Q7  | Email provider?                                | Nothing sent; outbox + dry-run function                                                 |
| Q8  | Push?                                          | Nothing sent; outbox + dry-run function; flag off                                       |
| Q9  | Name, logo, term dates, SUPW rules?            | Placeholders; no SUPW target                                                            |
| Q10 | Venue reminder timing?                         | 48 hours pending or event within 3 days, hourly                                         |
| Q11 | School days and booking slots?                 | Sun–Thu, five 90-minute slots from 07:30 (please confirm: many UAE schools run Mon–Fri) |
| Q12 | Which grades does each teacher teach?          | Unknown: teachers may post to any grades                                                |
| Q13 | Who confirms hours on staff events?            | Organising teacher, approving teacher, SUPW coordinator, admins                         |
| Q14 | Who sees approved booking details?             | Everyone sees title/venue/time; details only for those involved                         |
| Q15 | Who gets email?                                | Staff with responsibilities                                                             |
| Q16 | What can be muted?                             | Everything except approvals and urgent items                                            |
| Q17 | Busy events' sign-up notifications?            | One per sign-up (mutable)                                                               |
| Q18 | Can people edit their profile?                 | No; admins edit names and grades                                                        |
| Q19 | Can a student edit an approved event?          | No; locked after approval                                                               |
| Q20 | Can a booking's time change?                   | No; cancel and request again                                                            |
| Q21 | Which reports can students see?                | Unresolved ones, plus their own and ones they backed                                    |
| Q22 | Content reports notify anyone?                 | No; staff see them in Approvals and Admin > Moderation                                  |
| Q23 | What does the audit log record?                | Admin-only tables, roles, moderation, by app users                                      |
| Q24 | App id and name?                               | `com.placeholder.schoolapp`, "School App"                                               |
| Q25 | Which grades use the app?                      | 1–12 (Admin > Settings)                                                                 |
| Q26 | What does search cover?                        | Rooms, events, announcements, collab posts; not people                                  |
| Q27 | Event categories (mockup's "Environment")?     | None; chips are All / This week / In school / Signed up                                 |
| Q28 | Whose pending requests show on the calendar?   | Your own; venue staff see all                                                           |

## 5. What you need to unlock

| Item                     | Exact steps                                                                                                                                                                                                                                                                                               |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Supabase project**     | Create a free project (README, option B) or run `npm run db:start` with Docker. Check the "Not verified yet" list above on first run.                                                                                                                                                                     |
| **School answers**       | Take Q1–Q4 and Q11 to the school. Most answers are a change on **Admin > Settings**, **Responsibilities** or **Report routes**, no code.                                                                                                                                                                  |
| **First real admin**     | After the first real sign-in, in the Supabase SQL editor: `update profiles set role = 'admin' where email = '<their email>';`. From then on use Admin > Users.                                                                                                                                            |
| **School sign-in (SSO)** | Q5 steps 1–5: OAuth client from school IT (Google Cloud or Microsoft Entra), redirect URL `<SUPABASE_URL>/auth/v1/callback`, enable the provider in Supabase, set the school email domain in Admin > Settings, set `VITE_AUTH_PROVIDER` and `VITE_SCHOOL_EMAIL_DOMAIN`. Then untick "Allow dev accounts". |
| **Email**                | Q7: choose a provider (e.g. Resend), set the secret, add the send call where `supabase/functions/send-emails/index.ts` says, deploy with `npx supabase functions deploy send-emails`, schedule it (README, "Email and push").                                                                             |
| **Push**                 | Q8: Firebase project with the Android and iOS apps, a `device_tokens` table, the FCM call in `send-push`, then `VITE_ENABLE_PUSH=true`.                                                                                                                                                                   |
| **Floor plans**          | Q6: export each floor as SVG/PNG into `public/floorplans/`, set path and size on Admin > Map, click to place each room; add real venues on Admin > Venues.                                                                                                                                                |
| **Store builds**         | Q24: choose the real app id and name first. Then `npx cap add android` / `npx cap add ios`, `npm run cap:sync`, build in Android Studio / Xcode (needs a Mac). Store accounts belong to the school.                                                                                                       |
| **Hosting**              | Import the repo in Vercel, set the four `VITE_` env vars, add the deployed URL to Supabase's redirect URLs.                                                                                                                                                                                               |

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
7. [`docs/OPEN_QUESTIONS.md`](OPEN_QUESTIONS.md) before talking to the school.

For each feature the order is the same: migration → its pgTAP test → `api.ts` →
`hooks.ts` → `logic.ts` → `components/` → `pages/` → `*.test.tsx`.
