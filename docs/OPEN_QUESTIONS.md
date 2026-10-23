# Open questions

Things the school hasn't decided yet, and every assumption made while building.
Each one is a **data, settings or env change**, never a code rewrite.

Most settings live in the single row of the `app_settings` table or in small tables
next to it. Admins change them in the **admin dashboard** (`/admin`, or the Admin button
on the Approvals tab), on the screen of the area they affect; each entry below names the
screen. You can also run SQL in Supabase Studio (local: http://127.0.0.1:54323) or the
cloud dashboard's SQL editor.

---

## Q1: Who handles facilities and IT problems, and who approves venue bookings?

**Configurable in Admin.**

- Default used: four responsibilities, `facilities`, `it`, `venues`, `supw`. Each fix-it
  category is sent to one responsibility (seeded: IT → `it`, everything else →
  `facilities`). Seed data gives placeholder staff each one: Admin Facilities holds
  `facilities` + `it`, Admin Venues holds `venues`, Teacher A holds `supw`.
- Where it lives: tables `responsibilities` and `report_categories` (which replaced the
  `report_category` enum and `report_category_routes` table in
  `supabase/migrations/20261023120300_feature_settings.sql`).
- To change it: **Admin > People > Responsibilities** to give or remove a job;
  **Admin > Features > Fix-it categories** to add a category, retire one, or send it to
  a different team. All of it is logged in the audit log.

## Q2: Can students request venues, and must a teacher supervise?

- Default used: yes, students can request; they must name a supervising teacher, and
  the request starts as `awaiting_teacher` until that teacher confirms it.
- Where it lives: `app_settings.students_can_request_venues` (default `true`);
  enforced in `bookings_before_insert()` (`..._120800_venues.sql`).
- To change it: **Admin > Features > Venues**, switch off "Students can request
  venues". Students then see a message asking them to ask a teacher.

## Q3: Does the school email format distinguish students from staff?

- Default used: no. Admins keep a staff list (`staff_emails`); anyone on it becomes a
  teacher at first sign-in (an existing student account is promoted when added).
  Optionally, a regex can mark staff by address.
- Where it lives: table `staff_emails`; `app_settings.staff_email_pattern` (null = off);
  checked in `handle_new_user()` (`..._120100_identity.sql`).
- To change it: **Admin > People > Staff emails** to add addresses. If staff addresses follow
  a pattern (e.g. `first.last@` for staff, digits for students), set **Admin > System >
  Sign-in > Staff email pattern** to a regex such as `^[a-z]+\.[a-z]+@`. It applies to new
  sign-ins only; use **Admin > People > Users** to fix existing accounts, or import a CSV
  (**Admin > People > Import people**).

## Q4: Must cross-grade collabs have a supervising teacher?

- Default used: no. Posts and requests are visible to all staff, every post has a
  Report button, teachers can hide posts, admins can remove them.
- Where it lives: `app_settings.collab_requires_teacher` (default `false`); enforced in
  `collab_posts_before_insert()` (`..._120700_collab.sql`). The post form shows the
  teacher picker as required when it's on.
- To change it: **Admin > Features > Collab**, switch on "Posts need a supervising
  teacher". Existing posts are unaffected.

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
  3. Admin > System > Sign-in: set "School email domain" (e.g. `school.example`).
  4. `.env`: `VITE_AUTH_PROVIDER=google` (or `azure`) and
     `VITE_SCHOOL_EMAIL_DOMAIN=school.example`.
  5. Before launch: Admin > System > Sign-in, untick "Allow dev accounts".

## Q6: Real floor plans, rooms and venue list

- Default used: one placeholder SVG per floor (G, 1, 2), drawn as labelled
  rectangles, 1000 × 700 px. 15 placeholder rooms and 4 placeholder venues (seed).
- Where it lives: tables `floors`, `rooms`, `venues`; images in `public/floorplans/`.
- To change it:
  1. Export each floor plan as SVG, PNG, JPEG or WebP (up to 5 MB).
  2. **Admin > Features > Map**: "Upload a plan image" for the floor (it fills in the
     image's address and pixel size), then save.
  3. On the same screen, pick a room and click the plan to place its pin; add,
     rename or delete rooms there.
  4. **Admin > Features > Venues**: add the real venues, link each to its room, set
     capacity, whether it needs approval and its booking limits (Q40).

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

- Default used: `[SCHOOL NAME]` placeholder, a generic icon, no SUPW target. The sample
  data sets placeholder targets of 20, 30 and 40 hours for grades 8, 10 and 12; they are
  not the school's rules.
- Where it lives: `app_settings.school_name`; table `supw_targets` (one row per grade,
  replacing the old single `app_settings.supw_hours_target`, which the migration copied
  to every grade); `src/config/school.ts` (name shown before sign-in, app name);
  `public/favicon.svg`.
- To change it: **Admin > Features > Volunteering** for each grade's SUPW target
  (students see their progress on the Volunteer tab); **Admin > School calendar > Terms
  and holidays** for term dates; **Admin > System > Branding** for the school's name,
  logo and colour (Q44). `src/config/school.ts` keeps only the app's own name.

## Q10: Reminder timing for venue approvals

- Default used: remind venue approvers when a request has been pending 48 hours, or
  when the event is less than 3 days away; at most once a day per booking.
- Where it lives: `app_settings.venue_reminder_hours` (48),
  `app_settings.venue_reminder_days_before` (3); SQL function `venue_reminders()`
  (`..._120800_venues.sql`). Scheduled hourly by pg_cron in
  `..._121000_realtime_and_cron.sql` when pg_cron is available (it is on Supabase).
- To change it: **Admin > Features > Venues** for the timings. If pg_cron isn't
  available (the migration prints a notice), run `select public.venue_reminders();` from
  any scheduler, or enable pg_cron in the dashboard (Database > Extensions) and run
  `select cron.schedule('venue-reminders', '0 * * * *', 'select public.venue_reminders();');`.

## Q11: Which days are school days, and what are the bookable time slots?

**Configurable in Admin.**

- Default used: Sunday to Thursday, with five 90-minute periods from 07:30, as drawn in
  the mockup. (The sample data switches to Monday to Friday with a shorter Friday, as most
  UAE schools have run since 2022. Please confirm.) The old slot settings were turned into
  rows of the `periods` table by the migration, so nothing changed until an admin edits
  them.
- Where it lives: `app_settings.school_days` (0 = Sunday … 6 = Saturday); table `periods`
  (name, start, end, weekdays) (`supabase/migrations/20261023120200_school_calendar.sql`).
  The week in date strips starts on `WEEK_STARTS_ON` in `src/lib/dates.ts` (Sunday).
- To change it: **Admin > School calendar > School week and periods**. Give a short day
  its own periods (e.g. "Period 3 (short Friday)", Fridays only).

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

**Configurable in Admin.**

- Default used: only staff holding a responsibility (facilities, IT, venues, SUPW), as
  the plan describes: urgent items at once, the rest in a daily digest. Teachers without
  one (e.g. a supervising teacher) get in-app and push only. Admins can override this per
  person: off, a daily digest, or every email at once. Urgent emails always go at once.
- Where it lives: table `staff_email_prefs` (no row = the default); `notify()`
  (latest in `supabase/migrations/20261023120510_admin_notifications.sql`). The digest
  goes out after `app_settings.digest_time` (Dubai time, default 07:00): the send-emails
  function, run hourly, asks `email_digest_due()`.
- To change it: **Admin > Notifications > Staff email**.

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

- Default used: there is no notification type for them in the agreed list. Admins see
  them in **Admin > Moderation** (and the count on the Overview's "Reported posts" card);
  teachers see them in the Approvals tab.
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

**Configurable in Admin.**

- Default used: no categories for a new school (the filter chips are All, This week, In
  school and Signed up). The sample data has four placeholder categories. Events can have
  one category, and the Volunteer tab shows a chip per category.
- Where it lives: table `volunteer_categories` and `volunteer_events.category_id`
  (`..._20261023120300_feature_settings.sql`).
- To change it: **Admin > Features > Volunteering**: add, rename or retire categories.
  Retired ones stay on old events but can't be chosen.

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

## Q34: Can volunteering events happen on holidays or weekends?

- Default used: yes. Volunteering often happens at weekends (a beach clean-up on a
  Saturday), so the event form only warns ("Holiday: … Events can still run then; check
  with the school first.") instead of refusing. A browser's own date picker can't grey
  out particular days, so the warning appears under the Starts field once a day is
  chosen.
- Where it lives: `dayNote()` (`src/features/school/logic.ts`) used by
  `src/features/volunteering/components/EventForm.tsx`.
- To change it: to refuse them, add a check like `bookings_check_rules()` to
  `volunteer_events` in a new migration, and show the note as an error in the form.

## Q35: Can venues be booked on non-school days or outside term?

- Default used: the booking calendar only offers school days that have periods, and the
  database refuses holidays and blackouts. It doesn't refuse weekends or days outside
  term: staff sometimes book the hall for a weekend event, and those requests still need
  approval.
- Where it lives: `bookings_check_rules()` and `booking_calendar_problem()`
  (`..._20261023120200_school_calendar.sql`).
- To change it: add a weekday check to `bookings_check_rules()` in a new migration.

## Q36: How do scheduled and expiring announcements work?

- Default used: an announcement can be scheduled (`publish_at` in the future) and can
  expire (`expires_at`). Until it's published and after it expires, only its author and
  admins see it. Its notifications go out when it's published: straight away, or from
  `publish_due_announcements()`, which pg_cron runs every five minutes. The default
  expiry (`app_settings.announcement_default_expiry_days`, off by default) only fills in
  the form's "Expires" field; the author can change or clear it.
- Where it lives: `..._20261023120300_feature_settings.sql` (the column was renamed from
  `published_at` to `publish_at`).
- To change it: **Admin > Features > Announcements** for the default expiry. To make it
  a hard rule, set `expires_at` in a BEFORE INSERT trigger instead.

## Q37: When does a fix-it report become urgent by itself?

- Default used: when 5 people have said "me too" (the reporter not counted). It then
  emails the responsible team immediately, as a teacher marking it urgent would.
- Where it lives: `app_settings.report_auto_urgent_votes` (null = never) and the
  `report_votes_auto_urgent` trigger (`..._20261023120300_feature_settings.sql`).
- To change it: **Admin > Features > Fix-it categories**, "Make urgent after this many
  me too".

## Q38: How big can a collab team be, and which skills can posts list?

- Default used: up to 8 people including the owner (so a post asks for at most 7).
  Skills come from an admin-managed list; anyone can suggest a new skill, and posts can
  use a suggestion while it waits. Admins approve it, merge it into an existing skill
  (posts switch over) or reject it (posts drop it). Existing posts' skills became the
  first list when the migration ran.
- Where it lives: `app_settings.collab_max_team_size`; tables `skill_tags` and
  `skill_tag_suggestions`; `collab_posts_check_rules()`
  (`..._20261023120300_feature_settings.sql`).
- To change it: **Admin > Features > Collab**.

## Q39: Must student volunteering events be approved?

- Default used: yes (the plan). Switching it off publishes students' events straight
  away; their SUPW hours are then confirmed by the SUPW coordinator or an admin, since no
  teacher approved the event.
- Where it lives: `app_settings.student_events_need_approval`;
  `volunteer_events_before_insert()` (`..._20261023120300_feature_settings.sql`).
- To change it: **Admin > Features > Volunteering**.

## Q40: When, for how long and how far ahead can each venue be booked?

- Default used: no limits for a new venue. The sample Auditorium can be booked 07:00 to
  18:00, for up to 240 minutes, up to 60 days ahead; the MPH 07:00 to 20:00 for up to
  300 minutes. Requests that break a limit are refused by the database with a sentence
  saying which limit.
- Where it lives: `venues.bookable_from`, `bookable_until`, `max_booking_minutes`,
  `max_days_ahead`; `bookings_check_rules()` (`..._20261023120300_feature_settings.sql`).
- To change it: **Admin > Features > Venues**, edit the venue.

## Q41: What does removing content do?

- Default used: a "soft delete". The post, announcement or event stays in the database
  with `removed_at`, `removed_by` and a reason, but disappears for everyone except
  admins, including its author, and nobody can join or sign up for it. An admin can
  restore it. Removing (or hiding) marks its open reports as dealt with. Owners can still
  delete their own posts for good, as before.
- Where it lives: `removed_*` columns and the "Removed … are for admins only" policies,
  `admin_moderate()` and `admin_moderation_queue()`
  (`supabase/migrations/20261023120400_moderation.sql`).
- To change it: to let authors see their removed content (with a notice), add
  `or author_id = auth.uid()` (or `owner_id`, `creator_id`) to those policies.

## Q42: How does the emergency broadcast work?

- Default used: an admin writes a title and message and confirms. It becomes a pinned,
  urgent school-wide announcement (shown in orange) and one urgent notification to
  every active person: phone push for everyone, immediate email for staff who get email.
  Urgent notifications can't be muted. The database refuses another broadcast within 10
  minutes, whichever admin sends it.
- Where it lives: `admin_emergency_broadcast()`, table `emergency_broadcasts`
  (`..._20261023120510_admin_notifications.sql`); the `emergency` notification type
  (`..._20261023120500_emergency_type.sql`).
- To change it: the 10 minutes is `interval '10 minutes'` in that function; change it in
  a new migration. Nothing is actually pushed or emailed until Q7 and Q8 are done.

## Q43: What does switching a feature off do?

- Default used: every feature is on. Switching one off (Admin > System > Feature switches)
  hides its tab, Home tile and Home section for everyone but admins, shows a short note
  on its screens, and the database refuses new content for it (posts, requests, events,
  sign-ups, projects, bookings, reports, "me too"). Nothing is deleted, and it all comes
  back when switched on. Admins always see everything, so they can check and switch back.
- Where it lives: table `feature_flags`; `feature_enabled()`, the `block_disabled_feature`
  triggers and "Only while the feature is on" policies
  (`supabase/migrations/20261023120600_system.sql`); `RequireFeature` in
  `src/app/guards.tsx`.
- To change it: **Admin > System > Feature switches**.

## Q44: School branding, and what signed-out visitors can see

- Default used: `[SCHOOL NAME]`, no logo, the design's teal. Admins set the name, upload a
  logo (public `branding` bucket, images up to 1 MB) and pick an accent colour, which
  must keep white text at 4.5:1 contrast (checked as they type and by the database). The
  app reads these at start-up through `public_status()`, which is the one thing signed-out
  visitors can call: the sign-in screen needs the name, logo and any maintenance notice.
  Nothing personal is in it.
- Where it lives: `app_settings.school_name`, `logo_url`, `accent_color`;
  `app_settings_check_branding()`, `public_status()` (`..._20261023120600_system.sql`);
  `src/app/Branding.tsx`, `src/lib/contrast.ts`.
- To change it: **Admin > System > Branding**.

## Q45: What does "data deletion" delete, and what does it keep?

- Default used: for a request to delete someone's data, an admin types the person's email
  to confirm. Their name becomes "Deleted user", their email is replaced, the photos and
  files they uploaded are deleted, their notifications, settings, responsibilities and
  class lists are removed, and their sign-in is blocked for good (a new Google or
  Microsoft sign-in would start a fresh, empty account). Kept, under "Deleted user":
  confirmed SUPW hours, reports, posts, requests and bookings, so the school's records
  still add up. The audit log can't be edited by anyone, so earlier entries (for example
  a name change) may still show their old name.
- Where it lives: `admin_user_files()`, `admin_anonymise_user()`, `profiles.anonymised_at`
  (`..._20261023120600_system.sql`); `anonymiseUser()` in `src/features/admin/api.ts`
  removes the files through Storage first.
- To change it: to also blank what they wrote (post descriptions, messages), add those
  updates to `admin_anonymise_user()` in a new migration. Ask the school's data
  protection lead what they need.

## Q46: The maintenance banner

- Default used: off. When on, its message shows at the top of every screen, including the
  sign-in screen, until it's switched off or its end time passes.
- Where it lives: `app_settings.maintenance_enabled`, `maintenance_message`,
  `maintenance_until`; `public_status()`; `MaintenanceBanner` in `src/app/Branding.tsx`.
- To change it: **Admin > System > Maintenance banner**.
