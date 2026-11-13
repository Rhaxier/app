# School App

One app for school life: announcements, SUPW volunteering, projects with teachers,
collab finder, venue booking, a campus map and fix-it reports. Built with React +
Vite + TypeScript on Supabase.

- **New here?** Read [`docs/HANDOFF.md`](docs/HANDOFF.md) (what's built, what's left,
  reading order), then [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md), then
  [`docs/features/announcements.md`](docs/features/announcements.md).
- **What the school still needs to decide:** [`docs/OPEN_QUESTIONS.md`](docs/OPEN_QUESTIONS.md).
- **Source documents:** `docs/School-App-Plan.pdf` (features, roles, rules; wins any
  disagreement) and `docs/School-App-Design.pdf` (look and feel).

## What you need

- **Node.js 20 or newer** (`node -v`).
- **Docker Desktop**, only for running Supabase on your own computer. If you can't
  install Docker, use a free cloud Supabase project instead (option B).

```bash
npm install
cp .env.example .env
```

## Option A: run Supabase locally (needs Docker)

```bash
npm run db:start      # starts Postgres, Auth, Storage, Realtime in Docker
                      # and applies supabase/migrations + supabase/seed.sql
```

The command prints an **API URL** and an **anon key** (it may say "Publishable key").
Put them in `.env`:

```
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=<the anon key>
```

Then start the app:

```bash
npm run dev           # http://localhost:5173
```

Useful while developing:

| Command            | What it does                                                                                         |
| ------------------ | ---------------------------------------------------------------------------------------------------- |
| `npm run db:reset` | Wipes the local database, re-runs every migration and the seed. Run it after pulling new migrations. |
| `npm run db:test`  | Runs the database tests in `supabase/tests` (pgTAP).                                                 |
| `npm run db:types` | Regenerates `src/types/database.ts` from the local database. Run it after changing a migration.      |
| `npm run db:stop`  | Stops the Docker containers.                                                                         |
| Supabase Studio    | http://127.0.0.1:54323: browse tables, run SQL.                                                      |

## Option B: a free cloud Supabase project (no Docker)

1. Create a project at [supabase.com](https://supabase.com) (free tier). Pick the
   region closest to Dubai. Save the database password.
2. Link this folder to it and push the schema:

   ```bash
   npx supabase login
   npx supabase link --project-ref <your-project-ref>   # from the project URL
   npx supabase db push --include-seed                  # migrations + test data
   ```

   `--include-seed` loads the fake test users and content. Leave it off for a real
   school deployment.

3. In the dashboard, **Project Settings > API**: copy the Project URL and the anon
   (publishable) key into `.env`.
4. In **Authentication > Sign In / Providers > Email**, turn off "Allow new users to
   sign up". Seeded users can still sign in; real users will come through Google or
   Microsoft.
5. In **Authentication > URL Configuration**, set the Site URL to
   `http://localhost:5173` (and add your deployed address later).
6. `npm run dev`.

Regenerate types against the cloud project with `npm run db:types:cloud`.

**Database tests on a cloud project:** `npx supabase test db --linked` runs them against
the linked project (the CLI still uses Docker to run the test runner). Without Docker,
open each file in `supabase/tests/` in the dashboard's SQL editor and run it: every line
of the result says `ok` or `not ok`, and each file rolls its changes back.

## Signing in as different people: the dev role switcher

With `VITE_AUTH_PROVIDER=dev` (the default), every screen shows a small **Dev** button in
the bottom-right corner. Tap it, then tap any seeded user to sign in as them. This is how
you test permissions: try something as a student, switch to a teacher, approve it,
switch back. In dev builds the Supabase client is also on `window.supabase`, so you can
try forbidden requests from the browser console and watch the database refuse them.

Every seeded user has the password `devpass123` and an `@dev.local` email:

| Who              | Email                                                                                                                 | What they're for                                   |
| ---------------- | --------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| Students         | `student.g8.a`, `student.g8.b`, `student.g10.a`, `student.g10.b`, `student.g12.a`, `student.g12.b` (all `@dev.local`) | Grades 8, 10 and 12                                |
| Teacher A        | `teacher.a@dev.local`                                                                                                 | Holds the `supw` responsibility (SUPW coordinator) |
| Teacher B, C     | `teacher.b@dev.local`, `teacher.c@dev.local`                                                                          | Plain teachers                                     |
| Admin Facilities | `admin.facilities@dev.local`                                                                                          | `facilities` + `it`: gets fix-it reports           |
| Admin Venues     | `admin.venues@dev.local`                                                                                              | `venues`: approves bookings                        |
| Admin Plain      | `admin.plain@dev.local`                                                                                               | Admin with no responsibilities                     |

Dev accounts only work while `app_settings.allow_dev_accounts` is on
(Admin > System > Sign-in). Turn it off before launch.

## What's in the app

| Tab or screen            | What it does                                                                       | Guide                                                                                      |
| ------------------------ | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Home                     | Greeting, search, six tools, bell times, today's bookings, announcements, the bell | [announcements](docs/features/announcements.md), [bell times](docs/features/bell-times.md) |
| Map                      | Floor plans with rooms, rooms in use, fix-it pins; report a problem                | [map](docs/features/map.md), [fixit](docs/features/fixit.md)                               |
| Volunteer                | SUPW events, roles, sign-ups, approvals, hours                                     | [volunteering](docs/features/volunteering.md)                                              |
| Collab                   | Find teammates, requests, auto-close, moderation                                   | [collab](docs/features/collab.md)                                                          |
| Book                     | Venue calendar by periods, requests, approvals, no double bookings                 | [venues](docs/features/venues.md)                                                          |
| Projects (from Home)     | Share work with teachers for feedback                                              | [projects](docs/features/projects.md)                                                      |
| Approvals (staff)        | One queue of everything waiting on you                                             | [approvals and admin](docs/features/approvals-and-admin.md)                                |
| Admin dashboard (admins) | Overview, people, calendar, feature settings, moderation, system                   | [admin dashboard](docs/features/admin-dashboard.md)                                        |

## Project layout

```
src/
  app/          router, layout, tab bar, route guards, dev role switcher
  styles/       tokens.css (design tokens), glass.css (liquid glass), globals.css, motion.css
  components/   shared UI: Button, Card, Chip, Badge, Input, SegmentedControl, Sheet, ...
  lib/          supabase client, query client, dates (Asia/Dubai), errors, statuses, CSV
  config/       static school text (placeholders)
  features/     one folder per feature, all the same shape:
    <feature>/
      api.ts        raw Supabase calls
      hooks.ts      TanStack Query hooks (pages only call these)
      logic.ts      plain functions: validation, filters, calculations
      components/   pieces used by this feature's pages
      pages/        one file per screen
      *.test.tsx    UI tests
  types/database.ts   generated from the database (npm run db:types)
supabase/
  migrations/   the whole schema: tables, RLS policies, triggers, functions
  seed.sql      fake users and content for development
  tests/        pgTAP database tests
  functions/    Edge Functions (send-emails, send-push: dry-run stubs)
docs/           hand-off, architecture, open questions, one guide per feature
```

## Checks

```bash
npm run lint          # ESLint
npm run typecheck     # TypeScript
npm test              # Vitest UI tests
npm run db:test       # pgTAP database tests (local Supabase)
npm run format        # Prettier
npm run build         # production build into dist/
```

## Email and push (not switched on yet)

Every notification already writes a row to `push_outbox`, and for staff who get email
to `email_outbox` (Admin > Notifications > Outbox shows them; Staff email decides who
gets email and when the digest goes). Nothing is sent: the
Edge Functions `send-emails` and `send-push` are dry runs that report what they would
send. The steps to switch each one on are at the top of
`supabase/functions/send-emails/index.ts` and `supabase/functions/send-push/index.ts`
(Q7 and Q8 in `docs/OPEN_QUESTIONS.md`).

To run them on a schedule once they send, store the service role key in Supabase Vault
and use pg_cron + pg_net, for example in the SQL editor:

```sql
select vault.create_secret('<service role key>', 'service_role_key');

select cron.schedule('send-urgent-emails', '*/5 * * * *', $$
  select net.http_post(
    url := 'https://<project-ref>.supabase.co/functions/v1/send-emails?kind=immediate',
    headers := jsonb_build_object('Authorization', 'Bearer ' ||
      (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key'))
  );
$$);
-- and every hour for ?kind=digest: it sends once a day, after the digest time set in
-- Admin > Notifications > Staff email. And every minute for send-push.
```

Venue reminders (`venue_reminders()`, hourly) and scheduled announcements
(`publish_due_announcements()`, every five minutes) are already scheduled by migrations
when pg_cron is available, which it is on Supabase.

## Phone apps (Capacitor)

The same build is wrapped into iOS and Android apps by Capacitor. The config is in
`capacitor.config.ts` (app id `com.placeholder.schoolapp` until the school registers
store accounts). Native projects aren't generated yet. When you're ready:

```bash
npx cap add android         # needs Android Studio
npx cap add ios             # needs a Mac with Xcode
npm run cap:sync            # build the web app and copy it into the native projects
npm run cap:android         # open in Android Studio
```

Push notifications stay off until `VITE_ENABLE_PUSH=true` and Firebase / Apple push
are configured (Q8).

## Hosting (Vercel)

`vercel.json` is ready: it builds with `npm run build`, serves `dist/`, and sends
every route to `index.html` so deep links work. Set `VITE_SUPABASE_URL`,
`VITE_SUPABASE_ANON_KEY`, `VITE_AUTH_PROVIDER` and `VITE_SCHOOL_EMAIL_DOMAIN` in the
Vercel project's environment variables, and add the deployed address to Supabase's
redirect URLs. Not deployed yet.
