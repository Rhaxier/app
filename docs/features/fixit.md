# Fix-it reports

Report something broken, with a photo, pinned to the map; the right team hears about it
and everyone who cares hears back. Same shape as announcements; read
[`announcements.md`](announcements.md) first.

## What it does

- **Safety first.** The form opens with: "Emergencies or anything dangerous: tell a teacher
  now, don't use the app."
- **Duplicates first.** Pick the room and the form lists what's already open there, each with
  **Me too**. A "me too" is a vote, counted once per person, not a second report.
- **Routing.** The category picks the team through `report_categories` (seeded: IT →
  `it`, everything else → `facilities`). Everyone holding that responsibility is notified;
  urgent reports email immediately, the rest go in the daily digest.
- **Urgent** can only be set by teachers and admins.
- **Staff work it:** open → acknowledged → in progress → resolved, or duplicate (pointing at
  the original) or won't fix, with a note and an assignee. Only the routed team or admins
  can change status. Each change notifies the reporter and every "me too" voter.
- **The map stays current:** open reports are orange pins; resolved ones leave the map but
  stay in the history.
- **Privacy:** other students see the problem, never who reported it. Staff can see the
  reporter. Photos are in the private `report-photos` bucket, shown through links that
  expire after five minutes.

## Tables and functions

| Name                                | What it holds                                                        |
| ----------------------------------- | -------------------------------------------------------------------- |
| `reports`                           | The problem, where it is, status, note, assignee, urgent flag        |
| `report_votes`                      | One row per "me too" (unique per person per report)                  |
| `report_categories`                 | Categories: name, icon, team, active (Admin > Fix-it categories)     |
| `report_feed()`                     | The only way the app reads reports; adds the reporter for staff only |
| `open_reports_in_room(room)`        | The duplicate check                                                  |
| `attach_report_photo(report, path)` | Records the photo after upload (students can't update reports)       |

Migration: `supabase/migrations/20261019120900_fixit.sql`.
Database tests: `supabase/tests/08_fixit_test.sql`.

## Where the rules live

- Nobody can read `reporter_id` from the table: the `grant select (...)` line leaves it out.
  `report_feed()` hands it to staff only.
- Who may change what: `reports_before_update()` (urgent: staff; status and the rest: the
  routed team or admins; photo: the reporter).
- Routing and notifications: `reports_notify()` with `report_route()`.

### A gotcha worth knowing

The read policy on `reports` is written out in full rather than calling
`can_see_report(id)`. When the app inserts a row and asks for its id back
(`.insert(...).select('id')`), Postgres checks the read policy against the new row. A
`stable` function that looks the row up in the same table sees the table as it was before
the insert, so the new row looked invisible and the insert was refused. The test
"A student can create a report and read its id back" guards this.

## Files to read

1. `src/features/fixit/api.ts`: reading through `report_feed()`, the photo upload + attach.
2. `logic.ts`: form validation, the map card's text.
3. `pages/ReportFormPage.tsx`, `components/DuplicateCheck.tsx`, `components/MeTooButton.tsx`.
4. `pages/ReportDetailPage.tsx`, `components/StaffReportPanel.tsx`.
5. On the map: `src/features/map/pages/MapPage.tsx` (the report layer) and
   `components/ReportCard.tsx` (reference screen 2's bottom card).
6. `fixit.test.tsx`.

## Try it

As **Student Grade 8 B**, report a furniture problem in 1.02. Switch to **Admin Facilities**:
it's in their inbox and Approvals tab with the student's name. Resolve it with a note; the
student is notified. **Teacher B** can mark a report urgent but can't change its status.
