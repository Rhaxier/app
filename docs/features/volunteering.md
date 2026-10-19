# SUPW volunteering

Find volunteering events, sign up for a role, and earn SUPW hours. Same shape as
announcements; read [`announcements.md`](announcements.md) first.

## What it does

- Anyone can create an event with **roles**, each wanting a number of students
  ("3 of 5 filled"). The organiser chooses whether a student may hold more than one role.
- **Student events need a teacher.** They start `awaiting_approval`, visible only to the
  creator and staff. Any teacher or admin approves or sends back with a note; the student
  hears either way, and all teachers hear when one is submitted. Staff events go live at once.
- Students sign up for a role with an optional note. A full role puts them on the waitlist.
- The organiser sees everyone (name, grade, note, SUPW hours so far, school email via
  **Contact**), selects up to the number wanted, waitlists, or moves people between roles.
  Selected students are told the role, time and place; when a role fills up, everyone still
  waiting is waitlisted and told.
- A selected student who withdraws notifies the organiser.
- After the event the organiser marks attendance and a teacher confirms hours (for a
  student-run event: the approving teacher; also any admin or the SUPW coordinator).
  Students never confirm hours.

## Tables and functions

| Name                      | What it holds                                                           |
| ------------------------- | ----------------------------------------------------------------------- |
| `volunteer_events`        | The event, its status, who approved it and their note                   |
| `event_roles`             | Roles per event with `spots_wanted`                                     |
| `role_signups`            | One row per student per role: status, note, attendance, confirmed hours |
| `volunteer_role_counts()` | How full each role is (counts only; sign-ups are private)               |
| `event_signups(event)`    | Sign-ups with contact emails, for the organiser and staff only          |
| `hours_to_confirm()`      | Attended sign-ups waiting for this teacher (Approvals tab)              |
| `supw_hours_report()`     | Whole-school totals for the CSV export                                  |

Migration: `supabase/migrations/20261019120500_volunteering.sql`.
Database tests: `supabase/tests/04_volunteering_test.sql`.

## Where the rules live

- Status changes and who may make them: `volunteer_events_before_update()`.
- One role per event: `signup_conflicts()`, called by the sign-up triggers.
- The cap: `assert_role_has_space()` locks the role row so two organisers can't both
  take the last spot.
- Auto-waitlist and notifications: `role_signups_notify()`.
- Who confirms hours: `can_confirm_hours()` (assumption Q13 in `OPEN_QUESTIONS.md`).

## Files to read

1. `src/features/volunteering/api.ts`: note the `!volunteer_events_creator_id_fkey` hint
   (two foreign keys point at `profiles`) and how role counts are merged in.
2. `hooks.ts`: every change invalidates the whole `['volunteering']` key.
3. `logic.ts`: spots left, filters, the sign-up window, form validation and conversion.
4. `pages/VolunteerPage.tsx` (reference screen 3), `pages/EventDetailPage.tsx`,
   `pages/EventFormPage.tsx`.
5. `components/SignupsManager.tsx`: the organiser's tools.
6. `volunteering.test.tsx`.

## Try it

As **Student Grade 12 A**, open "Charity bake sale": it's waiting for approval. Switch to
**Teacher C** and approve it. Switch to **Student Grade 8 B**, sign up as a Baker; the
Stall role now says you can only hold one role. Back as **Student Grade 12 A**, select
them. As **Teacher A**, open "Reading buddies" (a past event) to confirm hours.
