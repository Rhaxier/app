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

The admin screens are now the **admin dashboard**: see
[`admin-dashboard.md`](admin-dashboard.md) for every section, the database behind it and
the files to read. Admins reach it from the **Admin** button at the top of this tab.

## Files to read

- `src/features/approvals/pages/ApprovalsPage.tsx` and `components/`.
- The admin dashboard: [`admin-dashboard.md`](admin-dashboard.md).
- Tests: `src/app/guards.test.tsx`, `src/app/TabBar.test.tsx`.

## Try it

Sign in as **Admin Plain**, open Admin > People > Users, make **Student Grade 8 B** a
teacher, then look at Admin > System > Audit log. As **Admin Venues**, open Approvals and approve
"Debate club practice" with "Announce this": the clashing "Robotics demo" disappears from
the queue and the booking appears in the announcements feed.
