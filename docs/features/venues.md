# Venue booking

Check when a venue is free, request it, and get it approved, with no double bookings.
Same shape as announcements; read [`announcements.md`](announcements.md) first.

## What it does

- **Calendar** (reference screen 4): venue chips, a strip of school days, and the day's
  slots: available, booked (grey), pending approval (orange) and your selection (teal).
  Tap neighbouring free slots to book a longer block. The slots are that weekday's
  `periods` and the days are `app_settings.school_days` (Q11, Admin > School calendar).
  Holidays and blackouts are greyed out; the database refuses them too.
- **Requests.** Staff requests start `pending`. A student must name a supervising teacher;
  their request starts `awaiting_teacher` until that teacher confirms (Q2: only while
  `students_can_request_venues` is on). Venues with `needs_approval = false` are approved
  straight away if the slot is free.
- **Approval.** Venue staff (the `venues` responsibility) or admins approve or reject, with an
  optional note and "Announce this to the school". Approving rejects every overlapping
  request still waiting, and each of those requesters is told the slot was taken.
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

Migration: `supabase/migrations/20261019120800_venues.sql`.
Database tests: `supabase/tests/07_venues_test.sql`.

## Where the rules live

- `bookings_no_double_booking`: the exclusion constraint (needs `btree_gist`).
- Starting status and auto-approval: `bookings_before_insert()`, `booking_auto_approve()`.
- Who may move a booking between statuses: `bookings_before_update()` (the table of
  transitions is in its header comment).
- Clash rejection, notifications and "announce": `bookings_after_write()`.

## Files to read

1. `src/features/venues/api.ts`: the two ways to read bookings, and the Realtime subscription.
2. `logic.ts`: slots, slot states, selection, the week strip, form validation.
3. `pages/BookPage.tsx` (reference screen 4), `pages/BookingRequestPage.tsx`,
   `pages/MyBookingsPage.tsx`; `components/SlotList.tsx`, `DateStrip.tsx`,
   `ReviewActions.tsx` (used in Approvals), `TodayAtSchool.tsx` (on Home).
4. `venues.test.tsx`.

## Try it

As **Admin Venues**, open the Approvals tab: "Debate club practice" and "Robotics demo" want
the same slot. Approve one; the other is rejected and its requester notified. As **Student
Grade 10 B**, request the MPH: you must choose a supervising teacher, and the request waits
for them in their Approvals tab.
