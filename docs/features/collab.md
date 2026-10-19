# Collab finder

Post a project, say which skills you need and how many people, and find teammates
across every grade. Same shape as announcements; read [`announcements.md`](announcements.md) first.

## What it does

- A post lists skills needed and the number of students wanted; the card shows
  "2 of 3 spots filled".
- **Ask to join** with a one-line message. One request per person per post; owners can't
  ask to join their own post. The owner is notified.
- The owner's **Requests** list shows every requester's name, grade, message and status,
  with **Contact** (their school email; in-app chat is version 2). Only the owner and staff
  can see those emails.
- **Accept** notifies the student ("You're on the team for …"); accepted students and the
  owner see the team list with emails. **Decline** sends a polite message.
- **Auto-close:** when accepted = wanted, the post becomes **Full** and every pending request
  is declined with a notification. Raising the number reopens it.
- **Safeguarding:** staff see every post and its requests. Teachers can hide a post pending
  review; admins can remove posts (recorded in the audit log). Anyone can **Report** a post
  into `content_reports`, which only staff can read.
- If the school turns on `app_settings.collab_requires_teacher` (Q4), every post must name a
  supervising teacher.

## Tables and functions

| Name                    | What it holds                                                             |
| ----------------------- | ------------------------------------------------------------------------- |
| `collab_posts`          | The post, its status and moderation fields (`hidden_by`, `hidden_reason`) |
| `join_requests`         | One request per person per post, with status                              |
| `content_reports`       | Reports from the Report button                                            |
| `collab_post_counts()`  | Accepted and pending counts per post                                      |
| `collab_requests(post)` | Requests with emails, for the owner and staff only                        |
| `collab_team(post)`     | Owner + accepted members with emails, for the team and staff              |

Migration: `supabase/migrations/20261019120700_collab.sql`.
Database tests: `supabase/tests/06_collab_test.sql`.

## Where the rules live

- Who may change a request: `join_requests_before_update()`; the "team is full" check
  locks the post row so two quick accepts can't both take the last spot.
- Auto-close and notifications: `join_requests_after_write()`.
- Reopen when the number goes up, and moderation limits: `collab_posts_before_update()`.

## Files to read

1. `src/features/collab/api.ts`: the `!collab_posts_owner_id_fkey` style hints (three
   foreign keys point at `profiles`).
2. `logic.ts`: "x of y filled", skills, `joinState()`, validation.
3. `pages/CollabPage.tsx` (reference screen 6), `pages/CollabDetailPage.tsx`,
   `pages/CollabFormPage.tsx`; `components/RequestsList.tsx`, `TeamList.tsx`.
4. `collab.test.tsx`.

## Try it

As **Student Grade 10 A**, open "Line-following robot" and accept the two pending requests:
it becomes Full. Switch to **Student Grade 12 A**: no Ask to join. As **Teacher C**, hide a
post; it disappears for students but its owner still sees it with the reason.
