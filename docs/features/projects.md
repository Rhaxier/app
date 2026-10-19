# Projects with teachers

Students keep their projects in the app and share them with chosen teachers for
feedback. Same shape as announcements; read [`announcements.md`](announcements.md) first.

## What it does

- Students create projects (title, subject, description, optional link and files).
  A new project is a **draft** that no teacher can see.
- **Share with a teacher** notifies that teacher and moves a draft to **shared**.
- Shared teachers set the status (**In review**, **Feedback given**, **Complete**) and
  write feedback. New feedback notifies the student and sets "Feedback given".
- Admins can read every project. Teachers can't edit a student's work, only its status.
- Files live in the private `project-files` bucket under `<project id>/`. The owner uploads
  and deletes; anyone who can read the project downloads through a link that expires
  after a minute.

## Tables

| Table              | What it holds                                  |
| ------------------ | ---------------------------------------------- |
| `projects`         | The project and its status                     |
| `project_shares`   | Which teachers it's shared with (one row each) |
| `project_feedback` | Feedback, one row per comment                  |

Migration: `supabase/migrations/20261019120600_projects.sql` (tables, policies, triggers
and the storage policies). Database tests: `supabase/tests/05_projects_test.sql`.

## Where the rules live

- Who reads a project: `is_project_owner()`, `is_project_shared_with_me()`, admins.
  These helpers are `security definer` so the `projects` and `project_shares` policies
  can ask about each other without looping.
- Teachers may change only the status: `projects_before_update()`.
- Share and feedback notifications: `project_shares_notify()`, `project_feedback_notify()`.

## Files to read

1. `src/features/projects/api.ts`: embedding shares and feedback in one query; the
   storage calls (`list`, `upload`, `createSignedUrl`, `remove`).
2. `hooks.ts`, `logic.ts` (segments, the "Shared with…" line, validation).
3. `pages/ProjectsPage.tsx` (reference screen 5), `pages/ProjectDetailPage.tsx`,
   `pages/ProjectFormPage.tsx`.
4. `components/ProjectCard.tsx`, `FeedbackThread.tsx`, `Attachments.tsx`.
5. `projects.test.tsx`.

## Try it

As **Student Grade 10 A**, open Projects: one project has feedback, one is a draft. Tap
"Share with a teacher" on the draft and pick **Teacher C**. Switch to Teacher C: the
project is in their list and their inbox. Give feedback; switch back to see it.
**Teacher B** can't see either project.
