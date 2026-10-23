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

| Section                 | What it does                                                                   | Database                              |
| ----------------------- | ------------------------------------------------------------------------------ | ------------------------------------- |
| School week and periods | School days (Q11) and the periods of each weekday, e.g. a shorter Friday       | `app_settings.school_days`, `periods` |
| Terms and holidays      | The school year and days off                                                   | `terms`, `holidays`                   |
| Venue blackouts         | Days one venue (or every venue) can't be booked, with a reason such as "Exams" | `venue_blackouts`                     |

**Where it shows up:**

- **Book a venue:** the slots are that weekday's periods. Holidays, blackouts and days
  without periods are greyed out in the date strip, with the reason read out and listed
  underneath.
- **The database** refuses any booking request that touches a holiday or a blackout
  (`bookings_check_rules()`, a BEFORE INSERT trigger on `bookings`), with a message such
  as "This venue can't be booked then: Mon 16 Nov is a holiday (Mid-term break)."
- **Volunteering:** the event form warns when the start day is a holiday, a non-school
  day or outside term (Q34).
- **Overview:** utilisation counts bookable time from periods, skipping holidays and
  blackouts (`venue_bookable_minutes()`).

## Feature settings (B4)

| Section           | What it changes                                                                                                                      | Database                                                                                  |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| Announcements     | Default expiry; every post (live, scheduled, expired) with Pin, Edit, Delete                                                         | `announcements.publish_at`, `expires_at`; `app_settings.announcement_default_expiry_days` |
| Collab            | Supervising teacher required (Q4), biggest team, the skills list, suggested skills (approve, merge, reject)                          | `skill_tags`, `skill_tag_suggestions`, `admin_review_tag_suggestion()`                    |
| Volunteering      | Student events need approval, categories (Q27), SUPW target per grade                                                                | `volunteer_categories`, `supw_targets`, `app_settings.student_events_need_approval`       |
| Venues            | Students may request (Q2), reminder timing (Q10); per venue: capacity, approval, bookable hours, longest booking, days ahead, retire | `venues`, `bookings_check_rules()`                                                        |
| Map               | Floors (upload a plan image), rooms and pins                                                                                         | `floors`, `rooms`, bucket `floor-plans`                                                   |
| Fix-it categories | Categories with icon and team, retire instead of delete; auto-urgent threshold (Q37)                                                 | `report_categories`, `app_settings.report_auto_urgent_votes`                              |
| Fix-it reports    | Every open report, urgent first                                                                                                      | `report_feed()`                                                                           |

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

## Files to read

- `supabase/migrations/20261023120000_admin_overview.sql`
- `src/features/admin/components/AdminLayout.tsx`, `AdminMenu.tsx`, `AdminPage.tsx`
- `src/features/admin/pages/OverviewPage.tsx`, `components/BarList.tsx`, `StatTile.tsx`
- `supabase/migrations/20261023120100_people_and_grades.sql`
- `supabase/migrations/20261023120200_school_calendar.sql`
- `supabase/migrations/20261023120300_feature_settings.sql`
- `src/features/admin/components/SettingControls.tsx` (one setting, edited in place) and
  `NameListEditor.tsx` (add, rename, retire)
- `src/features/school/` (grades, sections, classes, periods, terms, holidays, blackouts:
  read hooks used across the app; `dayNote()` and `periodsOn()` in `logic.ts`)
- `src/features/admin/pages/UsersPage.tsx`, `ImportPage.tsx`, `RolloverPage.tsx`,
  `ClassesPage.tsx`, `GradesPage.tsx`; `src/components/ConfirmDialog.tsx`
- Tests: `supabase/tests/09_admin_overview_test.sql`, `10_people_test.sql`,
  `11_calendar_test.sql`, `12_feature_settings_test.sql`; `src/features/school/school.test.ts`;
  `src/features/admin/overview.test.tsx`, `people.test.tsx`
