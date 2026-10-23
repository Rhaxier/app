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

## Files to read

- `supabase/migrations/20261023120000_admin_overview.sql`
- `src/features/admin/components/AdminLayout.tsx`, `AdminMenu.tsx`, `AdminPage.tsx`
- `src/features/admin/pages/OverviewPage.tsx`, `components/BarList.tsx`, `StatTile.tsx`
- Tests: `supabase/tests/09_admin_overview_test.sql`, `src/features/admin/overview.test.tsx`
