# Approvals and admin screens

Teachers and admins get an extra **Approvals** tab; admins also get the **Admin** screens.
Student screens are the same for everyone: the staff view is added on top.

## Approvals (teachers and admins)

One queue of everything waiting on the signed-in person. A section only appears when
something is in it. Each item has quick actions and an **Open** link.

| Section                      | Who sees it                   | Actions                                 | Data                                                                      |
| ---------------------------- | ----------------------------- | --------------------------------------- | ------------------------------------------------------------------------- |
| Student events to approve    | All staff                     | Approve, Send back (with a note)        | `volunteer_events` with status `awaiting_approval`                        |
| Venue requests               | Venues staff, admins          | Approve / Reject, note, "Announce this" | `booking_details()` with status `pending`, soonest first, clashes flagged |
| Bookings to supervise        | The named supervising teacher | Confirm / Decline                       | `booking_details()` with status `awaiting_teacher`                        |
| Fix-it reports for your team | Facilities / IT staff         | Acknowledge                             | `report_feed()` routed to your responsibilities                           |
| SUPW hours to confirm        | See `can_confirm_hours()`     | Confirm hours                           | `hours_to_confirm()`                                                      |
| Reported content             | All staff                     | Dismiss, Mark actioned                  | `content_reports`                                                         |

The page (`src/features/approvals/pages/ApprovalsPage.tsx`) owns no data of its own: it
calls each feature's hooks and reuses their action components. Admins and the SUPW
coordinator also get **Export SUPW hours (CSV)**.

## Admin (admins only)

| Screen           | What it changes                                         | Table / function                                                 |
| ---------------- | ------------------------------------------------------- | ---------------------------------------------------------------- |
| Users and roles  | Role, name, grade, section, responsibilities            | `admin_set_role()`, `admin_update_profile()`, `responsibilities` |
| Responsibilities | Who handles facilities, IT, venues, SUPW (Q1)           | `responsibilities`                                               |
| Staff emails     | Who becomes a teacher at sign-in (Q3)                   | `staff_emails`                                                   |
| Venues           | Bookable places, capacity, approval needed, active (Q6) | `venues`                                                         |
| Map              | Floor images and sizes, rooms, pin positions (Q6)       | `floors`, `rooms`                                                |
| Report routes    | Which team gets each fix-it category (Q1)               | `report_category_routes`                                         |
| Settings         | Every open question that's a setting (Q2–Q5, Q9–Q11)    | `app_settings`                                                   |
| Moderation       | Reported content, hidden collab posts                   | `content_reports`, `collab_posts`                                |
| Audit log        | Who changed what (read-only, append-only)               | `audit_log`                                                      |
| Outbox           | Emails and pushes queued but not sent (Q7, Q8)          | `email_outbox`, `push_outbox`                                    |

Every change on these screens is recorded in the audit log, either by the `admin_*`
functions or by the `audit_change()` trigger on admin-only tables. The routes sit inside
`<RequireRole role="admin">`, but that is only a convenience: the tables' RLS policies
refuse non-admins anyway.

## Files to read

- `src/features/approvals/pages/ApprovalsPage.tsx` and `components/`.
- `src/features/admin/api.ts`, `hooks.ts`, `logic.ts` (form checks), `pages/`.
- Tests: `src/features/admin/admin.test.tsx`, `src/app/guards.test.tsx`.

## Try it

Sign in as **Admin Plain**, open Admin > Users and roles, make **Student Grade 8 B** a
teacher, then look at Admin > Audit log. As **Admin Venues**, open Approvals and approve
"Debate club practice" with "Announce this": the clashing "Robotics demo" disappears from
the queue and the booking appears in the announcements feed.
