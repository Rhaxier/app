# Open questions

Things the school hasn't decided yet, and every assumption made while building.
Each one is a **data, settings or env change**, never a code rewrite.

Most settings live in the single row of the `app_settings` table. Admins change them
on the **Admin > Settings** screen; you can also run SQL in Supabase Studio
(local: http://127.0.0.1:54323) or the cloud dashboard's SQL editor.

---

## Q1: Who handles facilities and IT problems, and who approves venue bookings?

- Default used: four responsibilities, `facilities`, `it`, `venues`, `supw`. Fix-it
  categories route to a responsibility through `report_category_routes` (seeded:
  `it` → `it`, everything else → `facilities`). Seed data gives placeholder staff each
  one: Admin Facilities holds `facilities` + `it`, Admin Venues holds `venues`,
  Teacher A holds `supw`.
- Where it lives: tables `responsibilities` and `report_category_routes`
  (`supabase/migrations/20261019120100_identity.sql`, `..._120900_fixit.sql`).
- To change it: **Admin > Responsibilities** to give or remove a job;
  **Admin > Report routes** to send a category to a different team. Both are logged
  in the audit log.

## Q2: Can students request venues, and must a teacher supervise?

- Default used: yes, students can request; they must name a supervising teacher, and
  the request starts as `awaiting_teacher` until that teacher confirms it.
- Where it lives: `app_settings.students_can_request_venues` (default `true`);
  enforced in `bookings_before_insert()` (`..._120800_venues.sql`).
- To change it: **Admin > Settings**, untick "Students can request venues". Students
  then see a message asking them to ask a teacher.

## Q3: Does the school email format distinguish students from staff?

- Default used: no. Admins keep a staff list (`staff_emails`); anyone on it becomes a
  teacher at first sign-in (an existing student account is promoted when added).
  Optionally, a regex can mark staff by address.
- Where it lives: table `staff_emails`; `app_settings.staff_email_pattern` (null = off);
  checked in `handle_new_user()` (`..._120100_identity.sql`).
- To change it: **Admin > Staff emails** to add addresses. If staff addresses follow
  a pattern (e.g. `first.last@` for staff, digits for students), set **Admin >
  Settings > Staff email pattern** to a regex such as `^[a-z]+\.[a-z]+@`. It applies
  to new sign-ins only; use **Admin > Users** to fix existing accounts.

## Q4: Must cross-grade collabs have a supervising teacher?

- Default used: no. Posts and requests are visible to all staff, every post has a
  Report button, teachers can hide posts, admins can remove them.
- Where it lives: `app_settings.collab_requires_teacher` (default `false`); enforced in
  `collab_posts_before_insert()` (`..._120700_collab.sql`). The post form shows the
  teacher picker as required when it's on.
- To change it: **Admin > Settings**, tick "Collab posts need a supervising teacher".
  Existing posts are unaffected.

## Q5: Google or Microsoft login, and the school email domain

- Default used: neither provider is configured. Dev login is email + password for the
  seeded `@dev.local` users. The app has both OAuth buttons wired; they're disabled
  unless `VITE_AUTH_PROVIDER` selects them. The database refuses sign-ups from any
  domain except `app_settings.school_email_domain` (and its subdomains); while that's
  empty, only dev accounts work.
- Where it lives: `.env` → `VITE_AUTH_PROVIDER=dev|google|azure`,
  `VITE_SCHOOL_EMAIL_DOMAIN` (only a hint for the account picker; named with `VITE_`
  because Vite only exposes variables with that prefix to the app);
  `app_settings.school_email_domain`, `app_settings.allow_dev_accounts`;
  `supabase/config.toml` (`[auth.external.google]`, `[auth.external.azure]`);
  `src/features/auth/` (sign-in code).
- To change it:
  1. School IT creates an OAuth client (Google Cloud console, or Microsoft Entra
     app registration) with redirect URL `<SUPABASE_URL>/auth/v1/callback`.
  2. Local: put the client id/secret in `supabase/.env` as
     `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID` / `..._SECRET` (or the `AZURE` ones,
     plus `SUPABASE_AUTH_EXTERNAL_AZURE_URL=https://login.microsoftonline.com/<tenant-id>`),
     set `enabled = true` for that provider in `supabase/config.toml`, restart
     (`npm run db:stop && npm run db:start`).
     Cloud: dashboard > Authentication > Sign In / Providers, enable Google or Azure
     and paste the same values.
  3. Admin > Settings: set "School email domain" (e.g. `school.example`).
  4. `.env`: `VITE_AUTH_PROVIDER=google` (or `azure`) and
     `VITE_SCHOOL_EMAIL_DOMAIN=school.example`.
  5. Before launch: Admin > Settings, untick "Allow dev accounts".

## Q6: Real floor plans, rooms and venue list

- Default used: one placeholder SVG per floor (G, 1, 2), drawn as labelled
  rectangles, 1000 × 700 px. 15 placeholder rooms and 4 placeholder venues (seed).
- Where it lives: tables `floors`, `rooms`, `venues`; images in `public/floorplans/`.
- To change it:
  1. Export each floor plan as SVG or PNG (any size). Put it in `public/floorplans/`.
  2. **Admin > Map**: edit the floor's image path, width and height (the image's
     pixel size).
  3. On the same screen, pick a room and click the plan to place its pin; add,
     rename or delete rooms there.
  4. **Admin > Venues**: add the real venues, link each to its room, set capacity and
     whether it needs approval.

## Q7: Email provider for staff emails

- Default used: nothing is sent. `notify()` writes `email_outbox` rows (for staff with
  responsibilities: `immediate` when urgent or for venue requests, else `digest`).
  The Edge Function `send-emails` is a dry run that previews what it would send.
- Where it lives: table `email_outbox`; `supabase/functions/send-emails/index.ts`.
- To change it: follow the numbered steps at the top of
  `supabase/functions/send-emails/index.ts` (choose Resend or similar, set the secret,
  add the API call, mark rows sent, schedule with pg_cron + pg_net).

## Q8: Push notifications

- Default used: nothing is sent. Every notification writes a `push_outbox` row; the
  `send-push` Edge Function is a dry run. The app registers for Capacitor push only
  when `VITE_ENABLE_PUSH=true` and it is running as a phone app.
- Where it lives: table `push_outbox`; `supabase/functions/send-push/index.ts`;
  `src/features/notifications/push.ts`; `.env` → `VITE_ENABLE_PUSH`.
- To change it: follow the steps at the top of `supabase/functions/send-push/index.ts`
  (Firebase project, device token table, FCM call), then set `VITE_ENABLE_PUSH=true`
  and rebuild the phone apps.

## Q9: School name, logo, term dates, SUPW hour rules

- Default used: `[SCHOOL NAME]` placeholder, a generic icon, no term dates, no SUPW
  hours target (the Volunteer screen shows hours so far without a target).
- Where it lives: `app_settings.school_name`, `app_settings.supw_hours_target`,
  `app_settings.grades` (see Q25);
  `src/config/school.ts` (name shown before sign-in, app name); `public/favicon.svg`.
- To change it: **Admin > Settings** for the name and SUPW target; edit
  `src/config/school.ts` and replace `public/favicon.svg` for the sign-in screen and
  icon. Term dates aren't used by any feature yet.

## Q10: Reminder timing for venue approvals

- Default used: remind venue approvers when a request has been pending 48 hours, or
  when the event is less than 3 days away; at most once a day per booking.
- Where it lives: `app_settings.venue_reminder_hours` (48),
  `app_settings.venue_reminder_days_before` (3); SQL function `venue_reminders()`
  (`..._120800_venues.sql`). Scheduled hourly by pg_cron in
  `..._121000_realtime_and_cron.sql` when pg_cron is available (it is on Supabase).
- To change it: **Admin > Settings** for the timings. If pg_cron isn't available
  (the migration prints a notice), run `select public.venue_reminders();` from any
  scheduler, or enable pg_cron in the dashboard (Database > Extensions) and run
  `select cron.schedule('venue-reminders', '0 * * * *', 'select public.venue_reminders();');`.

---

## Further assumptions made while building

## Q11: Which days are school days, and what are the bookable time slots?

- Default used: Sunday–Thursday and 5 slots of 90 minutes from 07:30 (as drawn in the
  mockup). Note: since 2022 most UAE schools run Monday–Friday, so please confirm.
- Where it lives: `app_settings.school_days` (0 = Sunday … 6 = Saturday),
  `booking_day_start`, `booking_slot_minutes`, `booking_slots_per_day`. The week in
  date strips starts on `WEEK_STARTS_ON` in `src/lib/dates.ts` (Sunday).
- To change it: **Admin > Settings** (e.g. school days `1,2,3,4,5` for Mon–Fri).

## Q12: Which classes or grades does each teacher teach?

**Configurable in Admin.**

- Default used: teachers may still post announcements to any grade (never school-wide or
  pinned) until the school enters its classes. Classes say who teaches whom; with the
  switch off, a teacher may post only to the grades they teach as a whole (a class with no
  section) and the sections they teach.
- Where it lives: tables `classes`, `class_teachers`, `class_students`;
  `app_settings.teachers_post_any_grade` (default `true`); `teaches_audience()` and the
  announcement policies (`supabase/migrations/20261023120100_people_and_grades.sql`).
- To change it: **Admin > People > Classes**: add the classes (or import them later),
  then switch off "Teachers may announce to any grade" at the top of that screen.

## Q13: Who confirms SUPW hours on staff-run events?

- Default used: the plan says "a teacher confirms; for a student-run event, the teacher
  who approved it". We also let the organising teacher of a staff-run event, any
  admin, and staff with the `supw` responsibility (the SUPW coordinator) confirm.
- Where it lives: `can_confirm_hours()` (`..._120500_volunteering.sql`).
- To change it: edit that function (one `or` per rule) in a new migration.

## Q14: Who may see the details of approved bookings?

- Default used: everyone signed in sees approved bookings' title, venue and time.
  Who asked, why, expected attendance and review notes are visible only to the
  requester, supervising teacher and venue staff (column privileges + the
  `booking_details()` function).
- Where it lives: grants and `booking_details()` in `..._120800_venues.sql`.
- To change it: add columns to the `grant select (...) on public.bookings` line.

## Q15: Who gets email?

- Default used: only staff holding a responsibility (facilities, IT, venues, SUPW), as
  the plan describes. Teachers without one (e.g. a supervising teacher) get in-app and
  push only.
- Where it lives: `notify()` (`..._120200_notifications.sql`).
- To change it: in `notify()`, replace the responsibilities check with
  `exists (select 1 from public.profiles where id = p_recipient and role in ('teacher', 'admin'))`.

## Q16: Which notifications can be muted?

- Default used: everything except approval-type items (`report_new`,
  `vol_event_pending_approval`, `booking_awaiting_teacher`, `booking_pending`,
  `booking_reminder`) and anything urgent.
- Where it lives: `notification_type_is_unmutable()` (`..._120200_notifications.sql`)
  and the matching list in `src/features/notifications/types.ts`.
- To change it: edit both lists together.

## Q17: Busy events: one notification per sign-up?

- Default used: the organiser gets one `vol_signup_new` notification per sign-up. The
  plan's "daily summary for busy events" is not built yet.
- Where it lives: `role_signups_notify()` (`..._120500_volunteering.sql`).
- To change it: mute `vol_signup_new` (Notifications > Settings) per person, or add a
  daily digest query to the `send-emails` function.

## Q18: Can people edit their own profile?

- Default used: no. Names come from the school account; grade and section are set by
  admins (Admin > Users). Sign-in metadata is never trusted for grade or role.
- Where it lives: column grants on `profiles`; `admin_update_profile()`
  (`..._120100_identity.sql`).
- To change it: `grant update (full_name) on public.profiles to authenticated;` plus a
  policy "users update their own row".

## Q19: Can a student edit their event after a teacher approves it?

- Default used: no. Once approved, a student's event details are locked (they can
  still close it). Before approval and after "send back" they can edit and resubmit.
- Where it lives: `volunteer_events_before_update()` (`..._120500_volunteering.sql`).
- To change it: remove the "A student's event is locked" block, or make edits send
  the event back to `awaiting_approval`.

## Q20: Can a booking's time or venue change after it is requested?

- Default used: no; cancel and request again, so an approval always refers to the
  exact slot that was approved. Title, purpose and attendance can be edited until it
  is decided.
- Where it lives: `bookings_before_update()` (`..._120800_venues.sql`).
- To change it: remove the lines that copy `starts_at`, `ends_at` and `venue_id` from
  `old` at the top of that function (and re-check clashes when times change).

## Q21: Which fix-it reports can students see?

- Default used: unresolved reports (they are on the map), plus their own and any they
  said "me too" to, in any status. Staff see all. Nobody but staff sees who reported.
- Where it lives: `can_see_report()`, `report_feed()` and the "Read reports you may see"
  policy (`..._120900_fixit.sql`; the policy repeats the rule on purpose, see
  `docs/features/fixit.md`).
- To change it: edit the rule in all three places together, e.g. drop the status
  condition to let students see resolved reports too.

## Q22: Content reports (the Report button) don't notify anyone

- Default used: there is no notification type for them in the agreed list, so staff
  check **Admin > Moderation** (teachers see it through the Approvals tab link).
- To change it: add a value to the `notification_type` enum in a new migration and
  call `notify()` from a trigger on `content_reports`.

## Q23: What does the audit log record?

- Default used: every change to admin-only tables (settings, staff emails,
  responsibilities, report routes, floors, rooms, venues), role and profile changes,
  and moderation (hiding or removing posts), when made by a signed-in app user.
  Changes made directly in the Supabase dashboard or by the seed have no app user and
  aren't logged there (Supabase keeps its own logs).
- Where it lives: `audit_change()` and the admin functions (`..._120100_identity.sql`).
- To change it: attach the `audit_change()` trigger to more tables in a new migration,
  or remove the `auth.uid() is null` early return to also log dashboard changes.

## Q24: Placeholder app identity

- Default used: app id `com.placeholder.schoolapp`, name "School App".
- Where it lives: `capacitor.config.ts`, `src/config/school.ts`, `index.html` title.
- To change it: edit those three before the first store build (the app id can't
  change after publishing).

## Q25: Which grades use the app?

**Configurable in Admin.**

- Default used: grades 1 to 12 for a new school (the seed keeps 8, 10 and 12, each with
  sections A and B). The old `app_settings.grades` setting was moved into this table.
- Where it lives: tables `grades` and `sections`
  (`..._20261023120100_people_and_grades.sql`).
- To change it: **Admin > People > Grades and sections**. Archive a grade (rather than
  deleting it) when it's no longer offered; students and history keep pointing at it.

## Q26: What does search cover?

- Default used: the search box on Home finds rooms, volunteering events, announcements
  and collab posts (from data the app already loads). It doesn't search people: there
  are no profile pages to open, and a searchable list of students across grades is a
  safeguarding decision for the school.
- Where it lives: `src/features/search/` (`logic.ts`, `pages/SearchPage.tsx`).
- To change it: add another source to `searchAll()` in `SearchPage.tsx`.

## Q27: Volunteering categories (the mockup's "Environment" chip)

- Default used: the plan has no event categories, so the filter chips are All, This week,
  In school (events in a room on the map) and Signed up.
- Where it lives: `volunteerFilters` and `filterEvents()` in
  `src/features/volunteering/logic.ts`.
- To change it: add a `category` column to `volunteer_events` in a new migration, a field
  on the event form, and a chip per category.

## Q28: Whose pending venue requests appear on the calendar?

- Default used: everyone sees approved bookings; students and teachers also see their own
  waiting requests (and ones they supervise); venue staff see every waiting request. The
  mockup's orange "Pending approval" slot is shown under those rules.
- Where it lives: `booking_details()` (`..._120800_venues.sql`) and `fetchWaitingRequests()`
  in `src/features/venues/api.ts`.
- To change it: to show everyone that a slot is contested (without saying by whom), add a
  function returning only the times of pending requests and draw them as "Requested".

## Q29: What counts as an "active" person on the admin overview?

- Default used: someone who signed in, or did anything in the app (reported, said "me
  too", signed up, created an event, post, request, booking, announcement or project, or
  read a notification) within the period. Supabase only keeps each person's _last_
  sign-in time, so someone who stays signed in for weeks still counts through what they
  do.
- Where it lives: `admin_metrics()`
  (`supabase/migrations/20261023120000_admin_overview.sql`).
- To change it: add or remove a line in the `union all` list inside `admin_metrics()`,
  in a new migration (`create or replace function`).

## Q30: How is venue utilisation measured?

- Default used: approved booked hours ÷ bookable hours over the last 7 or 30 full days
  (today not included). Bookable hours come from `venue_bookable_minutes()`, which
  counts the school's bookable periods on school days, minus holidays and blackouts, and
  within each venue's own bookable hours (see B3 and B4 below).
- Where it lives: `admin_venue_utilisation()` and `venue_bookable_minutes()`
  (`..._20261023120000_admin_overview.sql`, replaced in later migrations).
- To change it: change `venue_bookable_minutes()` in a new migration; every number that
  uses it follows.

## Q31: What does suspending someone's posting block?

- Default used: new announcements, collab posts, join requests, volunteering events and
  fix-it reports. They can still read everything, sign up for volunteering roles, say
  "me too", share projects and book venues. The person sees a banner saying until when,
  and the reason if one was given.
- Where it lives: `profiles.posting_suspended_until`, the `block_suspended_posting`
  triggers and the "Suspended accounts can't post" restrictive policies
  (`..._20261023120100_people_and_grades.sql`).
- To change it: attach the same trigger and policy to more tables (or remove them) in a
  new migration.

## Q32: How does the year-end rollover move students?

- Default used: each student moves to the next grade the school has in use (so with
  grades 8, 10 and 12 only, 8 goes to 10). Students in the top grade are archived: their
  records stay, they disappear from lists and notifications, and their sign-in is
  blocked. Sections keep their letter. Class lists are left as they were.
- Where it lives: `admin_rollover()` (`..._20261023120100_people_and_grades.sql`);
  **Admin > People > Year-end rollover**.
- To change it: edit `admin_rollover()` in a new migration (for example to clear class
  lists, or to keep a "graduated" group signed in).

## Q33: Who can be imported from a CSV file?

- Default used: students and teachers. Admins are made one at a time on the Users screen,
  so a spreadsheet can never create an admin. Imported people who have never signed in
  wait on the `roster` and get their name, role, grade and section at first sign-in.
- Where it lives: `admin_import_people()` and the `roster` table; `handle_new_user()`
  reads the roster (`..._20261023120100_people_and_grades.sql`).
- To change it: allow `admin` in the role check inside `admin_import_people()` and in the
  `roster.role` constraint.
