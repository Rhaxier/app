# Venue booking

Check when a venue is free, request it, and get it approved, with no double bookings.
Same shape as announcements; read [`announcements.md`](announcements.md) first.

## What it does

- **After school** (migration `20261114120000_after_school_booking.sql`): below the
  periods, an "After School Hours" line, then blocks of `after_school_block_minutes`
  (default 30) from the day's last period, rounded up to the block (15:00 Mon/Tue, 16:00
  Wed/Thu, 11:30 Fri), until `after_school_until` (default 18:00) or the venue's own
  closing time. Same cards and flow; a run is all periods or all blocks, never both. The
  database accepts these without custom times (`booking_period_problem()`); both settings
  are in Admin › Venues. Until the migration is pushed, the list simply has no
  after-school part.
- **The school's real timetable (2026–27)** is loaded as the periods: see
  [`docs/timetable/README.md`](../timetable/README.md) for every period, break and lunch,
  the CSV files to re-upload (Admin › Upload bell times), and the Term 3 version. Breaks
  and lunch are the gaps between periods; the list labels them ("Lunch" for 25 minutes or
  more) with their times.

- **Calendar, by periods** (reference screen 4): the venue's name as the title (tap it to
  choose another), a strip of school days, and the chosen date's **periods**, each with
  its name and start time: available (with a "+"), booked (hatched), pending approval
  (yellow), not bookable (a holiday or blackout) and your selection (one blue block, with
  the exact times in the floating bar and its Request button). Tap one period, or neighbouring free ones to book several in a row; a run can't
  cross a period that isn't free. The periods are that weekday's own `periods` (Q11,
  Admin > School calendar, or the bell times upload), so a short Friday looks shorter.
- **Bell times in the database.** A new booking must start when a period starts and end
  when a period ends on that weekday (`booking_period_problem()`), so nobody can send other
  times by hand. An admin can allow **custom times** (Q48, Admin > Venues): then the
  calendar also shows an "Another time" card with From and Until, e.g. for after school.
  Holidays, blackouts, bookable hours, the longest booking and how far ahead still apply
  either way. Bookings made before a rule changed are left as they are.
- **Requests.** Staff requests start `pending`. A student must name a supervising teacher;
  their request starts `awaiting_teacher` until that teacher confirms (Q2: only while
  `students_can_request_venues` is on). Venues with `needs_approval = false` are approved
  straight away if the time is free.
- **Approval.** Venue staff (the `venues` responsibility) or admins approve or reject, with an
  optional note and "Announce this to the school". Approving rejects every overlapping
  request still waiting, and each of those requesters is told the time was taken.
- **No double bookings.** An exclusion constraint refuses two approved bookings for the same
  venue at overlapping times, even if two approvers click at the same instant.
- **Notifications.** Approvers get an in-app notification and an immediate email row for
  every pending request, and reminders for old ones (`venue_reminders()`, Q10). Requesters
  hear every decision.
- **Everywhere at once.** The calendar, Home ("Today at school"), the map ("in use") and
  My bookings all read `bookings` and listen to Realtime.
- **Privacy.** Everyone sees approved bookings' title, venue and time. Who asked, why and
  the review note are only for the requester, the supervising teacher and venue staff (Q14).

## Tables and functions

| Name                | What it holds                                                                |
| ------------------- | ---------------------------------------------------------------------------- |
| `venues`            | Name, room, capacity, whether it needs approval, whether it's bookable       |
| `bookings`          | Each request and its status. Only the calendar columns are readable directly |
| `booking_details()` | Full details for the people involved, plus `overlaps_pending` for the queue  |
| `venue_reminders()` | Reminds approvers about requests still waiting (run hourly by pg_cron)       |
| `periods`           | The bell times: each period's name, start, end and weekdays (see bell times) |

Migrations: `supabase/migrations/20261019120800_venues.sql`; the bell times rule is in
`20261027120100_booking_by_periods.sql`.
Database tests: `supabase/tests/07_venues_test.sql`, `17_bell_times_test.sql`.

## Where the rules live

- `bookings_no_double_booking`: the exclusion constraint (needs `btree_gist`).
- Starting status and auto-approval: `bookings_before_insert()`, `booking_auto_approve()`.
- Who may move a booking between statuses: `bookings_before_update()` (the table of
  transitions is in its header comment).
- Clash rejection, notifications and "announce": `bookings_after_write()`.
- Holidays, blackouts, bell times and the venue's own limits: `bookings_check_rules()`
  (a BEFORE INSERT trigger), which calls `booking_calendar_problem()` and
  `booking_period_problem()`.

## Files to read

1. `src/features/venues/api.ts`: the two ways to read bookings, and the Realtime subscription.
2. `logic.ts`: a date's periods (`buildSlots`), their states, picking a run
   (`nextSelection`, `freeRun`), custom times, form validation.
3. `pages/BookPage.tsx` (reference screen 4), `pages/BookingRequestPage.tsx`,
   `pages/MyBookingsPage.tsx`; `components/PeriodList.tsx`, `ReviewActions.tsx` (used in
   Approvals), `TodayAtSchool.tsx` (on Home); the shared `src/components/DateStrip.tsx`.
4. `venues.test.tsx`.

## Try it

As **Admin Venues**, open the Approvals tab: "Debate club practice" and "Robotics demo" want
the same period. Approve one; the other is rejected and its requester notified. As **Student
Grade 10 B**, request the MPH: you must choose a supervising teacher, and the request waits
for them in their Approvals tab. Pick a Friday: Period 3 ends at 11:30, and there are no
Periods 4 and 5.
