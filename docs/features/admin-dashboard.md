# Admin dashboard

The admin dashboard is where admins run the app: who's who, the school calendar, how
each feature behaves, moderation, notifications and system settings. It's for admins
only. The routes sit inside `<RequireRole role="admin">`, and every table and function
behind them refuses non-admins in the database.

**How to get there:** the **Admin** button at the top of the Approvals tab (admins only),
or `/admin`.

## Layout

- **Laptop (900px and wider):** the menu on the left (`AdminMenu compact`), the chosen
  section on the right. `/admin` shows the Overview.
- **Phone:** `/admin` is the menu as a list screen. Each section opens full-screen with a
  back link to the menu.

The menu's groups and sections are one list in `src/features/admin/sections.ts`; the
routes are in `src/features/admin/routes.ts`. To add a section, add it to both. Every
section page is wrapped in `<AdminPage title description actions>`, which supplies the
header, the phone back link and a readable column width.

## Overview (B1)

**Needs attention.** Four cards, each linking straight to the queue where the work gets
done:

| Card                      | Counts                                                                       | Opens              |
| ------------------------- | ---------------------------------------------------------------------------- | ------------------ |
| Pending approvals         | venue requests, bookings waiting for their supervising teacher, SUPW hours   | Approvals          |
| Open fix-it reports       | open, acknowledged and in progress; how many are urgent; the 3 most pressing | Admin > Fix-it     |
| Reported posts            | open content reports and posts hidden pending review                         | Admin > Moderation |
| Student events to approve | volunteering events waiting for a teacher                                    | Approvals          |

Each count shows how long the oldest item has been waiting.

**Activity** for the last 7 or 30 days: active people (Q29), new fix-it reports and the
average days to resolve, venue bookings held and requested, SUPW hours confirmed, collab
posts created and filled. Two small charts: venue utilisation per venue (Q30) and SUPW
hours per grade. Every bar has its number written next to it, and "Show as a table" gives
the same numbers as a table.

**Where the numbers come from:** admin-only SQL functions that count inside the database,
so the browser never downloads the rows behind them.

| Function                             | Returns                                                     |
| ------------------------------------ | ----------------------------------------------------------- |
| `admin_attention()`                  | one row per kind of waiting item: count, urgent, oldest age |
| `admin_metrics()`                    | two rows: the last 7 and the last 30 days                   |
| `admin_venue_utilisation(days)`      | per venue: booked hours, bookable hours, share              |
| `admin_supw_by_grade(days)`          | per grade: hours confirmed, students                        |
| `venue_bookable_minutes(venue, day)` | helper: how long a venue can be booked that day             |

## People (B2)

| Section             | What it does                                                                                                                                                          | Database                                                                                                                 |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Users               | Search by name or email; filter by role, grade, status. Change role (with confirmation), grade and section, responsibilities. Pause posting until a date, or lift it. | `admin_list_users()`, `admin_set_role()`, `admin_update_profile()`, `admin_suspend_posting()`, `admin_lift_suspension()` |
| Grades and sections | Grades in use (archive instead of delete) and their sections                                                                                                          | `grades`, `sections`                                                                                                     |
| Classes             | Who teaches whom; the "Teachers may announce to any grade" switch (Q12)                                                                                               | `classes`, `class_teachers`, `class_students`, `admin_save_class()`                                                      |
| Import people       | CSV with name, email, role, grade, section: template, preview with a reason per bad row, then import the good rows                                                    | `admin_import_people(rows, dry_run)`, `roster`                                                                           |
| Year-end rollover   | Dry-run preview per grade, then the real run after typing `ROLLOVER <year>`                                                                                           | `admin_rollover(dry_run, confirm)`                                                                                       |
| Staff emails        | Who becomes a teacher at sign-in (Q3)                                                                                                                                 | `staff_emails`                                                                                                           |
| Responsibilities    | Facilities, IT, venues, SUPW (Q1)                                                                                                                                     | `responsibilities`                                                                                                       |

**Suspension.** While `profiles.posting_suspended_until` is in the future, a trigger
refuses that person's new announcements, collab posts, join requests, events and fix-it
reports with a readable message, and restrictive RLS policies refuse them too. The person
sees a banner (`SuspensionNotice`) with the date and reason, read through
`my_account_status()` because nobody else may read those columns.

**Sections on announcements.** `announcements.section_ids` narrows a grade announcement to
some sections; a trigger fills in their grades. Students in other sections don't see it.

## School calendar (B3)

| Section                 | What it does                                                                             | Database                              |
| ----------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------- |
| School week and periods | School days (Q11) and the periods of each weekday, e.g. a shorter Friday                 | `app_settings.school_days`, `periods` |
| Upload bell times       | The whole timetable from a CSV: template, preview with each line's problem, import (Q47) | `admin_import_periods(rows, dry_run)` |
| Terms and holidays      | The school year and days off                                                             | `terms`, `holidays`                   |
| Venue blackouts         | Days one venue (or every venue) can't be booked, with a reason such as "Exams"           | `venue_blackouts`                     |

**Where it shows up:**

- **Book a venue:** the list is that date's periods, and the database only accepts
  bookings that start and end on them (unless custom times are allowed, Q48). Holidays and
  blackouts show every period as not bookable, with the reason; days without periods are
  greyed out in the date strip.
- **Bell times** (`/bell-times`, from Home): everyone can see any day's periods. See
  [`bell-times.md`](bell-times.md).
- **The database** refuses any booking request that touches a holiday or a blackout
  (`bookings_check_rules()`, a BEFORE INSERT trigger on `bookings`), with a message such
  as "This venue can't be booked then: Mon 16 Nov is a holiday (Mid-term break)."
- **Volunteering:** the event form warns when the start day is a holiday, a non-school
  day or outside term (Q34).
- **Overview:** utilisation counts bookable time from periods, skipping holidays and
  blackouts (`venue_bookable_minutes()`).

## Feature settings (B4)

| Section           | What it changes                                                                                                                                                  | Database                                                                                  |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Announcements     | Default expiry; every post (live, scheduled, expired) with Pin, Edit, Delete                                                                                     | `announcements.publish_at`, `expires_at`; `app_settings.announcement_default_expiry_days` |
| Collab            | Supervising teacher required (Q4), biggest team, the skills list, suggested skills (approve, merge, reject)                                                      | `skill_tags`, `skill_tag_suggestions`, `admin_review_tag_suggestion()`                    |
| Volunteering      | Student events need approval, categories (Q27), SUPW target per grade                                                                                            | `volunteer_categories`, `supw_targets`, `app_settings.student_events_need_approval`       |
| Venues            | Students may request (Q2), custom booking times (Q48), reminder timing (Q10); per venue: capacity, approval, bookable hours, longest booking, days ahead, retire | `venues`, `bookings_check_rules()`                                                        |
| Map               | Floors (upload a plan image), rooms and pins                                                                                                                     | `floors`, `rooms`, bucket `floor-plans`                                                   |
| Fix-it categories | Categories with icon and team, retire instead of delete; auto-urgent threshold (Q37)                                                                             | `report_categories`, `app_settings.report_auto_urgent_votes`                              |
| Fix-it reports    | Every open report, urgent first                                                                                                                                  | `report_feed()`                                                                           |

**The report categories migration changes existing data.** Fix-it categories used to be a
fixed list inside the database (the `report_category` enum) plus a `report_category_routes`
table saying which team got each one. The migration creates `report_categories`, copies
every old category into it (its old value becomes the row's `key`, so `'it'` stays `'it'`)
with its team from the routes table, turns `reports.category` into plain text pointing at
that key, then drops the enum and the routes table. Every existing report keeps its
category and its routing.

**Scheduled announcements** are hidden from everyone but their author and admins until
`publish_at`, and their notifications go out then (`publish_due_announcements()`, run by
pg_cron every five minutes). Expired ones disappear the same way.

**Trusted changes.** Some admin functions edit other people's rows on purpose (merging a
skill rewrites posts that used it). They call `begin_trusted_change()` first, and the
feature triggers let those changes through. Nobody can call it from the app.

## Moderation (B5)

One queue with three tabs:

- **Reported:** every open report, with the reported content shown inline (title, a
  passage, its author), who reported it and why.
- **Hidden:** collab posts a teacher has hidden pending review.
- **Removed:** anything an admin removed, so it can be restored.

Actions: **Dismiss report**, **Hide / Unhide** (collab posts), **Remove** (with a reason,
after a confirmation), **Restore**, and **Suspend the author…**, which opens that person on
the Users screen. All of them go through one function, `admin_moderate(action, …)`, which
writes the audit log. Removing is a soft delete (Q41): `removed_at` is set, and restrictive
policies hide the row from everyone but admins.

## Notifications (B6)

- **Emergency broadcast** (Q42): title and message, a confirmation showing exactly what
  will be sent, then `admin_emergency_broadcast()` creates a pinned, urgent announcement
  and one urgent notification per active person. Refused within 10 minutes of the last
  one, even by another admin (an advisory lock makes two at once take turns). The list
  underneath shows every broadcast with its sender and reach.
- **Staff email** (Q15): the daily digest's time, and per teacher or admin "Default",
  "Daily digest", "Every email at once" or "Off" (`staff_email_prefs`, read by `notify()`).
  The send-emails function asks `email_digest_due()` each hour and sends the digest once a
  day after that time.
- **Outbox:** what would be emailed or pushed (nothing is sent until Q7 and Q8).

## System (B7)

| Section            | What it does                                                                              | Database                                                           |
| ------------------ | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Feature switches   | Each feature on or off (Q43): hidden for non-admins, new content refused, nothing deleted | `feature_flags`, `feature_enabled()`, `block_disabled_feature`     |
| Branding           | Name, logo upload, accent colour with a live 4.5:1 contrast check and preview (Q44)       | `app_settings`, bucket `branding`, `app_settings_check_branding()` |
| Maintenance banner | A message on every screen, sign-in included, with an optional end time (Q46)              | `app_settings.maintenance_*`, `public_status()`                    |
| Sign-in            | School email domain, staff email pattern, dev accounts (Q3, Q5)                           | `app_settings`                                                     |
| Data export        | CSV of users, SUPW hours, bookings and fix-it reports (dates for the last two)            | `admin_list_users()`, `supw_hours_report()`, `admin_export_*()`    |
| Data deletion      | Find a person, type their email, and their personal data goes; records stay (Q45)         | `admin_user_files()`, `admin_anonymise_user()`                     |
| Audit log          | Filter by person, action, table and dates; filtered in the database                       | `audit_log`, `admin_audit_filters()`                               |

**How branding reaches the screen.** `public_status()` returns the name, logo, colour and
any maintenance message, and works signed out. `src/app/Branding.tsx` turns the school
colour into accents for both themes (`brandAccents()` in `src/lib/contrast.ts`: the colour
itself in light mode, a lighter mix of it in dark mode so accent text still reads on a dark
card) and sets them on `<html>` as `--brand-acc-light`, `--brand-acc-dark` and their tints;
`tokens.css` falls back to the design's system blue when they aren't set. The database's
default colour (`#0e6857`) means "no school colour". It also draws the maintenance banner.
Both sit in `RootLayout`, so every screen has them.

**Every admin function refuses everyone else.** `supabase/tests/16_admin_lockdown_test.sql`
finds every function named `admin_*` in the database and calls it as a teacher and as a
student; each must refuse. It also checks no non-admin can change any admin table. A new
admin function is covered automatically, as long as its name starts with `admin_` and
its first line checks `is_admin()`.

## Files to read

- `supabase/migrations/20261023120000_admin_overview.sql`
- `src/features/admin/components/AdminLayout.tsx`, `AdminMenu.tsx`, `AdminPage.tsx`
- `src/features/admin/pages/OverviewPage.tsx`, `components/BarList.tsx`, `StatTile.tsx`
- `supabase/migrations/20261023120100_people_and_grades.sql`
- `supabase/migrations/20261023120200_school_calendar.sql`
- `supabase/migrations/20261023120300_feature_settings.sql`
- `supabase/migrations/20261023120400_moderation.sql`; `src/features/admin/pages/ModerationPage.tsx`
- `supabase/migrations/20261023120500_emergency_type.sql`, `20261023120510_admin_notifications.sql`;
  `src/features/admin/pages/EmergencyPage.tsx`, `StaffEmailPage.tsx`
- `supabase/migrations/20261023120600_system.sql`; `src/app/Branding.tsx`,
  `src/lib/contrast.ts`, `src/features/settings/` (status and feature switches)
- `src/features/admin/components/SettingControls.tsx` (one setting, edited in place) and
  `NameListEditor.tsx` (add, rename, retire)
- `src/features/school/` (grades, sections, classes, periods, terms, holidays, blackouts:
  read hooks used across the app; `dayNote()` and `periodsOn()` in `logic.ts`)
- `src/features/admin/pages/UsersPage.tsx`, `ImportPage.tsx`, `RolloverPage.tsx`,
  `ClassesPage.tsx`, `GradesPage.tsx`; `src/components/ConfirmDialog.tsx`
- Tests: `supabase/tests/09_admin_overview_test.sql`, `10_people_test.sql`,
  `11_calendar_test.sql`, `12_feature_settings_test.sql`, `13_moderation_test.sql`,
  `14_admin_notifications_test.sql`, `15_system_test.sql`, `16_admin_lockdown_test.sql`;
  `src/lib/contrast.test.ts`; `src/features/school/school.test.ts`;
  `src/features/admin/overview.test.tsx`, `people.test.tsx`
