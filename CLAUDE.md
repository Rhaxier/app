# Build prompt: School App structural framework

> **How to use this:** create an empty GitHub repo, put the two PDFs in a `docs/` folder at its root (`docs/School-App-Plan.pdf` and `docs/School-App-Design.pdf`), open the repo in Claude Code and paste everything below the line.

---

You are building the structural framework of a school app for a student team in Dubai. Read both PDFs in `docs/` fully before writing any code:

- **`docs/School-App-Plan.pdf`** is the source of truth for features, roles, privileges, data, workflows and notifications.
- **`docs/School-App-Design.pdf`** is the source of truth for the look: colour tokens, typography, spacing, components, navigation and six reference screens.

Where the two disagree, **the plan wins**. The mockup predates some decisions: volunteer roles per event, number of students wanted on collab posts, the staff Approvals view, and teacher approval of student-created events.

## 1. The situation

- **Who you're working for.** The team can code in general but is new to app development. They will learn React and Supabase basics by reading what you write. You write the code; they read it, run it, test it and review it. Readability and consistency matter as much as working code.
- **What "framework" means here.** Build roughly two-thirds of the whole project: every screen, the full database, all permissions and the workflow logic, running end to end against a local or free Supabase project, with sample data.
- **What's out of reach for now.** The school hasn't answered several questions, and some accounts don't exist yet. These are listed in section 3. **Do not stop or ask about them.** Build so each one is a configuration or data change later, never a rewrite. Log every assumption you make in `docs/OPEN_QUESTIONS.md` (format in section 3).
- **Don't invent school facts.** Don't make up school details, staff names, room numbers or policies. Use clearly marked placeholders such as `[SCHOOL NAME]`, `Teacher A`, `Room G.14 (placeholder)`.

## 2. Tech stack (decided, don't substitute)

| Layer | Choice | Notes |
| --- | --- | --- |
| Frontend | **React 18 + Vite + TypeScript** | Keep types simple and readable. Generate DB types with `supabase gen types`. |
| Routing | React Router | One route per screen; staff-only routes guarded by role. |
| Data fetching | `@supabase/supabase-js` + TanStack Query | One hooks file per feature (`useAnnouncements`, ...). No data calls inside components directly. |
| Styling | Plain CSS with CSS variables (tokens) + CSS Modules | No Tailwind, no UI kit. Tokens from the design PDF in `src/styles/tokens.css`. |
| Backend | **Supabase**: Postgres, Auth, Storage, Realtime, Edge Functions | All schema as SQL migrations in `supabase/migrations/`. |
| Map | Leaflet + react-leaflet, `CRS.Simple` with an image overlay | Indoor floor plans as images; pins in image coordinates. |
| Dates | date-fns, timezone **Asia/Dubai** | Store `timestamptz`; display in Asia/Dubai. Week starts Sunday in UI date strips is fine; make it a constant. |
| Mobile | Capacitor (config + scripts only) | Don't run native builds. |
| Hosting | Vercel (config only) | `vercel.json` with SPA rewrite. |
| Tests | pgTAP via `supabase test db` for database rules; Vitest + React Testing Library for UI logic | See section 8. |

The app must run with `supabase start` (local Supabase via the CLI, needs Docker) **or** against a free cloud Supabase project via `.env`. Document both in the README.

## 3. Unknowns: how to handle each one

Build every item below now, using the default given. Each one must be changeable later through **data, a settings row or an env var**, never a code change. For each, add an entry to `docs/OPEN_QUESTIONS.md` in this format:

```
## Q<n>: <question>
- Default used: ...
- Where it lives: <table/setting/env var + file paths>
- To change it: <exact steps>
```

| # | Unknown | Default to build | Where it must live |
| --- | --- | --- | --- |
| Q1 | Who handles facilities and IT problems, and who approves venue bookings | Routing by the `responsibilities` table (`facilities`, `it`, `venues`, `supw`). Seed placeholder staff users holding each one. | `responsibilities` table + `report_category_routes` table (category → responsibility) |
| Q2 | Can students request venues, and must a teacher supervise | Yes, students can request; they must name a supervising teacher; status starts `awaiting_teacher`. | `app_settings.students_can_request_venues` (bool, default true) |
| Q3 | Does the school email format distinguish students from staff | No. Use a `staff_emails` allowlist checked at first login. Also support an optional regex. | `staff_emails` table + `app_settings.staff_email_pattern` (nullable) |
| Q4 | Must cross-grade collabs have a supervising teacher | No. Posts are visible to staff, and every post has a Report button. | `app_settings.collab_requires_teacher` (bool, default false); if true, posting requires choosing a teacher |
| Q5 | Google or Microsoft login, and the school email domain | Neither is configured yet. Dev login is email + password for seeded test users. Write the OAuth code path for both providers, switched by env. | `.env`: `VITE_AUTH_PROVIDER=dev|google|azure`, `SCHOOL_EMAIL_DOMAIN=[school-domain]` (also enforced in the DB, see 5.1) |
| Q6 | Real floor plans, rooms and venue list | One placeholder floor plan SVG per floor (G, 1, 2) drawn as simple rectangles. Seeded placeholder rooms and venues. | `floors`, `rooms`, `venues` tables + `public/floorplans/*.svg`; admins can edit rooms in the app |
| Q7 | Email provider for staff emails | Don't send. Write to an `email_outbox` table. An Edge Function stub `send-emails` shows where Resend plugs in. | `email_outbox` + `supabase/functions/send-emails/` |
| Q8 | Push notifications | Don't send. Write to `push_outbox`. Stub `send-push` function. Register Capacitor push behind a feature flag. | `push_outbox` + `supabase/functions/send-push/` |
| Q9 | School name, logo, term dates, SUPW hour rules | Placeholders. | `app_settings` (`school_name`, `supw_hours_target`) + `src/config/school.ts` for static text |
| Q10 | Reminder timing for venue approvals | 48 hours pending, or event within 3 days. Implement the query as a SQL function. Schedule it with `pg_cron` if available, else document it. | `app_settings.venue_reminder_hours`, `app_settings.venue_reminder_days_before` |

Add new rows to `OPEN_QUESTIONS.md` for any other assumption you make.

## 4. Scope

### Build (in order; commit after each milestone)

**M0. Project skeleton.** Vite + TS app, folder structure (below), tokens, base components, ESLint + Prettier, README with setup steps, `.env.example`, Supabase CLI init, `vercel.json`, Capacitor config (`capacitor.config.ts`, app id `com.placeholder.schoolapp`).

**M1. Foundations (database).** All migrations in section 5: enums, tables, helper functions, RLS on every table, triggers, notifications, outboxes, audit log, storage bucket policies. Seed file with test users for every role and responsibility, plus realistic but clearly fake sample content for every feature. pgTAP tests for the rules in section 8.

**M2. App shell and auth.** Login screen (dev email + password; Google and Microsoft buttons wired but disabled unless configured). Session handling. Profile loading. Role-aware layout. Bottom tab bar (Home, Map, Volunteer, Collab, Book). Staff get an extra **Approvals** tab. Notification bell with live unread badge (Realtime) and an inbox screen. **Dev role switcher:** a small floating panel, shown only when `VITE_AUTH_PROVIDER=dev`, to sign in as any seeded user in one tap. This is how the team tests permissions.

**M3. Announcements (the reference feature).** Build it first and best. It's the pattern the team will study and copy. Comment it more heavily than the others, explaining *why* at each layer: migration → RLS → types → hook → component → test. Write `docs/features/announcements.md` walking through the files in reading order.

**M4–M9. Remaining features, same pattern:** SUPW volunteering → Projects with teachers → Collab finder → Venue booking → School map → Fix-it reports. Each one gets its own `docs/features/<feature>.md` (shorter than the announcements one): what it does, tables, rules, which files to read.

**M10. Staff and admin screens.** Approvals queue (combined), admin pages for users and roles, responsibilities, the staff email list, venues, rooms and floors, report category routes, app settings, and an audit log viewer.

**M11. Polish and hand-off.** Empty states, loading and error states, phone-width checks, accessibility pass, and a final report (section 10).

### Don't build (out of scope; leave clear seams)

Real SSO setup in a provider console. Actual email or push sending. App store builds. Deployment. In-app chat (version 2: "Contact" opens `mailto:` with the school email for now). Calendar (.ics) feed. Data export files (an admin "Export SUPW hours" button may download CSV from a query; that's fine to build).

## 5. Database specification

Use `snake_case`, `uuid` primary keys (`gen_random_uuid()`), `created_at timestamptz default now()` on every table, and `updated_at` where rows are edited. Use Postgres enums for statuses. Every table has **RLS enabled** with explicit policies. Enforce every permission in the database; UI hiding is convenience only.

### 5.1 Identity and roles

- `profiles`: `id` (= `auth.users.id`), `full_name`, `email`, `role` enum(`student`,`teacher`,`admin`) default `student`, `grade` (int, students), `section` (text), `avatar_initials`.
  - Created by a trigger on `auth.users` insert. The trigger sets `role = 'teacher'` if the email is in `staff_emails`, or if it matches `app_settings.staff_email_pattern`.
  - Reject sign-ups whose email domain isn't `SCHOOL_EMAIL_DOMAIN`. Store the domain in `app_settings.school_email_domain`. Skip this check for seeded dev users, who use a `@dev.local` domain allowed only when `app_settings.allow_dev_accounts = true`.
  - **Users can never change their own `role`.** Only admins can, and only through an RPC that writes to `audit_log`.
- `staff_emails`: `email` (unique), `added_by`.
- `responsibilities`: `user_id`, `kind` enum(`facilities`,`it`,`venues`,`supw`), unique (`user_id`,`kind`).
- `app_settings`: a single row of typed columns: everything in section 3 plus `school_name`.
- Helper SQL functions, `security definer` with `search_path` set: `auth_role()`, `is_staff()` (teacher or admin), `is_admin()`, `has_responsibility(kind)`. Use them in all policies.
- `audit_log`: `actor_id`, `action`, `table_name`, `row_id`, `details jsonb`. Write to it from admin RPCs and from triggers on admin-only changes. Only admins can read it; nobody can update or delete it.

### 5.2 Notifications (shared by all features)

- `notifications`: `recipient_id`, `type` (enum, list below), `title`, `body`, `link` (app route), `read_at`, `urgent` bool.
  - RLS: recipients see and mark-read only their own rows. Inserts happen only from `security definer` trigger functions, never from the client.
- `notification_prefs`: `user_id`, `type`, `muted` bool. Approval and urgent types can't be muted (enforce in the insert function).
- `email_outbox` / `push_outbox`: `recipient_id`, `notification_id`, `kind` (`immediate`/`digest`), `status` (`queued`/`sent`/`failed`), `payload jsonb`.
  - Staff with responsibilities get email outbox rows; urgent ones are `immediate`.
- One function `notify(recipient, type, title, body, link, urgent)` that checks mutes and fans out to the outboxes. Every trigger calls it.
- Notification types to implement: `announcement_new` (only for pinned or targeted ones, to avoid spam), `report_new`, `report_status`, `collab_request_new`, `collab_request_accepted`, `collab_request_declined`, `vol_event_pending_approval`, `vol_event_approved`, `vol_event_sent_back`, `vol_signup_new`, `vol_selected`, `vol_waitlisted`, `vol_withdrawal`, `booking_awaiting_teacher`, `booking_pending`, `booking_approved`, `booking_rejected`, `booking_reminder`, `project_shared`, `project_feedback`.

### 5.3 Announcements

- `announcements`: `author_id`, `title`, `body`, `audience` enum(`school`,`grades`), `grades int[]`, `pinned` bool, `published_at`.
- RLS:
  - Everyone reads announcements whose audience includes them; staff read all.
  - Teachers insert with `audience = 'grades'` only and can't pin.
  - Admins can post school-wide and pin.
  - Authors edit or delete their own; admins edit or delete any.

### 5.4 SUPW volunteering

- `volunteer_events`: `creator_id`, `title`, `description`, `starts_at`, `ends_at`, `room_id` (nullable) or `place_text`, `supw_hours` numeric, `signup_deadline`, `allow_multiple_roles` bool, `status` enum(`awaiting_approval`,`published`,`sent_back`,`closed`), `approved_by`, `approval_note`.
  - **Created by a student:** status is forced to `awaiting_approval` by a trigger. Visible only to the creator and to staff.
  - **Created by staff:** status is `published`.
  - Any teacher or admin can approve (→ `published`) or send back with a note. Notify the creator either way, and notify all teachers when a student event is submitted.
- `event_roles`: `event_id`, `name`, `description`, `spots_wanted` int > 0.
- `role_signups`: `role_id`, `student_id`, `note`, `status` enum(`applied`,`selected`,`waitlisted`,`not_selected`,`withdrawn`), `attended` bool, `hours_confirmed` numeric, `confirmed_by`.
  - Unique (`role_id`,`student_id`).
  - If the event has `allow_multiple_roles = false`, a trigger blocks a second active signup by the same student in the same event.
- **The organiser** (event creator):
  - sees all signups for their event, including student contact emails (via a view or RPC limited to the organiser and staff)
  - selects students per role, up to `spots_wanted`; the database enforces the cap
  - can move a signup to another role
- Selection notifies the student (`vol_selected` with role, time and place). The rest become `waitlisted` and get `vol_waitlisted`.
- When a selected student withdraws, the organiser is notified.
- **After the event:** the organiser marks attendance. Hours are confirmed by a teacher: for student-run events, the approving teacher (or any admin).
- Students can't confirm hours, including on their own events.
- Students see only published events, plus their own events in any status.

### 5.5 Projects with teachers

- `projects`: `owner_id` (student), `title`, `subject`, `description`, `link_url`, `status` enum(`draft`,`shared`,`in_review`,`feedback_given`,`complete`).
- `project_shares`: `project_id`, `teacher_id`. Sharing notifies the teacher.
- `project_feedback`: `project_id`, `author_id`, `body`. Only teachers it's shared with, and admins, can add feedback; adding it notifies the owner.
- RLS: owners have full access to their own. Teachers read projects shared with them and can set the status. Admins read all.
- Optional file attachments go in a private `project-files` bucket with matching storage policies.

### 5.6 Collab finder

- `collab_posts`: `owner_id`, `title`, `description`, `skills text[]`, `spots_wanted` int > 0, `status` enum(`open`,`full`,`closed`), `supervising_teacher_id` (nullable; required if `collab_requires_teacher`), `hidden_by` (staff moderation).
- `join_requests`: `post_id`, `requester_id`, `message`, `status` enum(`pending`,`accepted`,`declined`,`withdrawn`). Unique (`post_id`,`requester_id`). Owners can't request their own post.
- **The owner:**
  - sees every requester's name, grade, message and status, and their school email (contact via `mailto:`), through a view or RPC visible only to the owner and staff
  - can contact any requester, accepted or not
- **Accept:** notify the requester (`collab_request_accepted`). Both sides now see each other's email and the team list.
- **Decline:** notify the requester with a polite message.
- **Auto-close trigger:** when accepted count = `spots_wanted`, set the post to `full` and decline the remaining pending requests with notifications. Raising `spots_wanted` reopens it.
- **Moderation:**
  - Teachers can hide a post pending review.
  - Admins can remove posts.
  - Any user can report a post into `content_reports` (`target_table`, `target_id`, `reporter_id`, `reason`, `status`), which only staff can read.

### 5.7 Venue booking

- `venues`: `name`, `room_id`, `capacity`, `needs_approval` bool, `active` bool.
- `bookings`: `venue_id`, `requester_id`, `supervising_teacher_id`, `title`, `purpose`, `expected_attendance`, `starts_at`, `ends_at`, `status` enum(`awaiting_teacher`,`pending`,`approved`,`rejected`,`cancelled`), `reviewed_by`, `review_note`, `announce` bool.
- **Request flow:**
  - Student request: requires `supervising_teacher_id` and starts `awaiting_teacher`, if `app_settings.students_can_request_venues`.
  - The supervising teacher confirms (→ `pending`) or declines.
  - Staff requests go straight to `pending`.
  - Venues with `needs_approval = false` auto-approve, if there's no clash.
- Only users with `has_responsibility('venues')` (or admins) can approve or reject.
- **No double bookings:** an exclusion constraint using `btree_gist`:
  `EXCLUDE USING gist (venue_id WITH =, tstzrange(starts_at, ends_at, '[)') WITH &&) WHERE (status = 'approved')`.
- **On approval:** a trigger rejects overlapping `pending` and `awaiting_teacher` bookings for that venue and notifies their requesters ("slot taken"). If `announce = true`, it creates an announcement.
- Notify approvers on `pending` (in-app plus an immediate email row). Notify the requester on every decision.
- `venue_reminders()` SQL function: finds bookings pending longer than the configured hours, or with the event within the configured days, and notifies approvers once per day per booking.
- **Reflect everywhere:** every screen reads `bookings` directly. Enable Realtime on `bookings` and subscribe on the calendar, Home ("today at school") and map screens.
- RLS: everyone can read approved bookings (title, venue, time). Requesters, supervising teachers and venue staff read the full details.

### 5.8 School map

- `floors`: `name` (`G`,`1`,`2`), `image_path`, `width`, `height`.
- `rooms`: `floor_id`, `code`, `name`, `kind` enum(`classroom`,`lab`,`office`,`hall`,`library`,`cafeteria`,`other`), `x`, `y` (image coordinates).
- Everyone can read; only admins can edit, with a simple editor: click on the plan to place or move a room pin.
- Map layers: rooms; open fix-it reports; rooms "in use now" from approved bookings.

### 5.9 Fix-it reports

- `reports`: `reporter_id`, `room_id`, `floor_id`, `x`, `y`, `category` enum(`electrical`,`ac`,`plumbing`,`furniture`,`it`,`cleanliness`,`other`), `description`, `photo_path`, `status` enum(`open`,`acknowledged`,`in_progress`,`resolved`,`duplicate`,`wont_fix`), `status_note`, `assigned_to`, `urgent` bool, `duplicate_of`, `resolved_at`.
- `report_votes`: `report_id`, `user_id`, unique pair ("me too").
- `report_category_routes`: `category` → `responsibility kind`. Seed: `it` → `it`, everything else → `facilities`.
- **On insert:** notify every holder of the routed responsibility. If `urgent`, also queue immediate email; otherwise digest.
- **On status change:** notify the reporter and all voters.
- **Privacy:**
  - Students read open reports without `reporter_id`. Expose them through a view that hides the reporter for non-staff.
  - Staff see the reporter.
  - Only teachers can set `urgent`. Students can't, and the column is protected by the policy or trigger.
- Only responsible staff or admins can assign, change status or mark duplicates.
- Photos go in a **private** `report-photos` bucket. The client uploads to `reports/<report_id>/...` and reads through signed URLs (short expiry).
- **Duplicate check:** an RPC `open_reports_in_room(room_id)`. The report form shows these first, with a "Me too" button.
- **Safety copy** on the form: "Emergencies or anything dangerous: tell a teacher now, don't use the app."

## 6. Frontend structure and conventions

```
src/
  app/            # router, providers, layout, tab bar, auth guard, dev role switcher
  styles/         # tokens.css, globals.css
  components/     # shared UI: Button, Card, Chip, Badge, Input, SegmentedControl, Sheet, EmptyState, Avatar, Icon
  lib/            # supabase client, query client, dates, permissions helpers (UI hints only)
  features/
    announcements/ { api.ts, hooks.ts, components/, pages/, announcements.test.tsx }
    volunteering/  ...
    projects/  collab/  venues/  map/  fixit/  notifications/  approvals/  admin/
  types/database.ts   # generated
supabase/ migrations/  seed.sql  tests/  functions/
docs/ ARCHITECTURE.md  OPEN_QUESTIONS.md  features/*.md  (+ the two PDFs)
```

- **Every feature has the same shape.** `api.ts` holds the raw Supabase calls, `hooks.ts` the TanStack Query hooks, and pages and components only call hooks.
- **Design:**
  - Follow the design PDF exactly: tokens, the 390px phone layout, cards, chips, badges, the bottom tab bar, and icons as inline SVG line icons (1.8 stroke).
  - Build the six reference screens to match.
  - For screens the mockup doesn't show (inbox, approvals, admin, forms, detail pages), use the same components and tokens.
  - On desktop, centre a max-width column and keep it usable.
- **Staff UI:**
  - Teachers and admins get the **Approvals** tab: one queue with sections for student events to approve, venue requests (for venue staff), awaiting-teacher bookings where they're the supervisor, fix-it reports routed to them, and hours to confirm.
  - Each item has quick Approve / Send back / Open actions.
  - The staff view is added on top; student screens stay the same for everyone.
- **Status chips** use the design's soft tints: teal soft = good, orange soft = waiting or attention, quiet = draft or closed. Text must meet 4.5:1 contrast.
- **Accessibility:** real `<button>`, `<a>` and `<label>` elements; touch targets ≥ 44px; icon-only buttons get an `aria-label`.
- **Comments:** explain *why*, not what. Add a short header comment per file saying its job. The team are learners; no clever one-liners.

## 7. Seed data (fake, clearly marked)

- **Users** (password `devpass123`, all `@dev.local`):
  - 6 students across grades 8, 10 and 12
  - 3 teachers, one holding the `supw` responsibility
  - 3 admins: one with `facilities` + `it`, one with `venues`, one plain
- **Content per feature:**
  - announcements: 5, one pinned
  - volunteer events: 4 (one student-created, awaiting approval), with roles and signups in mixed states
  - projects: 3
  - collab posts: 4 (one full)
  - venues: 4, with bookings in every status, including an overlap case
  - floors: 3, with about 12 rooms
  - fix-it reports: 5, with votes
- All names generic (e.g. "Student Grade 10 A"), all places marked placeholder.

## 8. Tests that must pass

**Database (pgTAP, `supabase test db`).** At minimum:

1. A student can't update their own `role`. An admin can, and an `audit_log` row appears.
2. A student can't read another student's projects. A teacher reads only projects shared with them.
3. A teacher can't post a school-wide or pinned announcement. An admin can.
4. A student-created volunteer event is invisible to other students until approved.
5. With `allow_multiple_roles = false`, a second signup in the same event fails.
6. Selecting more students than `spots_wanted` fails.
7. Two overlapping **approved** bookings for one venue fail, even when inserted in separate transactions.
8. Approving a booking auto-rejects overlapping pending ones and creates notifications.
9. A non-venues teacher can't approve a booking.
10. When collab accepted count reaches `spots_wanted`, the post becomes `full` and pending requests are declined with notifications.
11. Requester emails on a collab post are readable by its owner and staff only.
12. A student reading fix-it reports never receives `reporter_id`. Staff do.
13. A student can't set `urgent`. A teacher can.
14. A new fix-it report in category `it` notifies only `it` responsibility holders.
15. Users read and update only their own notifications, and can't insert any.

**UI (Vitest):** permission-aware rendering (the Approvals tab only for staff), the booking slot list states, the collab "x of y filled" logic, and form validation on each create form.

Run all tests and fix failures before declaring a milestone done.

## 9. Working style

- **Plan first.** Before M0, write `docs/ARCHITECTURE.md`: a one-page overview and a table list mapped to features. Then proceed without waiting for approval, unless something in the PDFs is self-contradictory. In that case, pick the reading closest to the plan PDF and log it in `OPEN_QUESTIONS.md`.
- **Commits.** Small commits, one milestone or sub-step each, with clear messages ("M5: collab join requests + auto-close trigger"). Never commit `.env` or secrets.
- **Quality.** Don't leave TODOs without an `OPEN_QUESTIONS.md` entry. No dead code, no placeholder lorem ipsum.
- **Unblock yourself.** If a tool is unavailable (e.g. Docker for `supabase start`), say so, keep going with everything that doesn't need it, and list exactly what wasn't verified.

## 10. When you finish, report back with

1. What was built, per milestone, and anything skipped.
2. How to run it: local Supabase, cloud Supabase via `.env`, and the dev role switcher.
3. Test results (counts passing and failing).
4. The full `OPEN_QUESTIONS.md` list.
5. What remains for the team to unlock: accounts, school answers, SSO, email, push, floor plans, store builds. For each, the exact steps.
6. A suggested reading order for the team to learn the codebase, starting from `docs/features/announcements.md`.
