# School App

One app for school life: announcements, SUPW volunteering, projects with teachers,
collab finder, venue booking, a campus map and fix-it reports. Built with React +
Vite + TypeScript on Supabase.

- **New here?** Read [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md), then
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

| Command | What it does |
| --- | --- |
| `npm run db:reset` | Wipes the local database, re-runs every migration and the seed. Run it after pulling new migrations. |
| `npm run db:test` | Runs the database tests in `supabase/tests` (pgTAP). |
| `npm run db:types` | Regenerates `src/types/database.ts` from the local database. Run it after changing a migration. |
| `npm run db:stop` | Stops the Docker containers. |
| Supabase Studio | http://127.0.0.1:54323: browse tables, run SQL. |

## Option B: a free cloud Supabase project (no Docker)

1. Create a project at [supabase.com](https://supabase.com) (free tier). Pick the
   region closest to Dubai. Save the database password.
2. Link this folder to it and push the schema:

   ```bash
   npx supabase login
   npx supabase link --project-ref <your-project-ref>   # from the project URL
   npx supabase db push --include-seed                  # migrations + test data
   ```

   `--include-seed` loads the fake test users and content. Skip it for a real
   school deployment.
3. In the dashboard, **Project Settings > API**: copy the Project URL and the anon
   (publishable) key into `.env`.
4. In **Authentication > Sign In / Providers > Email**, turn off "Allow new users to
   sign up". Seeded users can still sign in; real users will come through Google or
   Microsoft.
5. In **Authentication > URL Configuration**, add `http://localhost:5173` to the
   redirect URLs.
6. `npm run dev`.

Regenerate types against the cloud project with `npm run db:types:cloud`.

Database tests need the local stack (`npm run db:test`). If you only have a cloud
project, open each file in `supabase/tests/` in the SQL editor and run it: the
results show `ok` / `not ok` for each check.

## Signing in as different people: the dev role switcher

With `VITE_AUTH_PROVIDER=dev` (the default), the app shows a small **Dev** button in
the bottom-right corner. Tap it, then tap any seeded user to sign in as them in one
go. This is how you test permissions: sign in as a student, try something, switch to
a teacher, approve it, switch back.

Every seeded user has the password `devpass123` and an `@dev.local` email:

| Who | Email | What they're for |
| --- | --- | --- |
| Students | `student.g8.a@dev.local`, `student.g8.b@dev.local`, `student.g10.a@dev.local`, `student.g10.b@dev.local`, `student.g12.a@dev.local`, `student.g12.b@dev.local` | Grades 8, 10 and 12 |
| Teacher A | `teacher.a@dev.local` | Holds the `supw` responsibility |
| Teacher B, C | `teacher.b@dev.local`, `teacher.c@dev.local` | Plain teachers |
| Admin Facilities | `admin.facilities@dev.local` | `facilities` + `it`: gets fix-it reports |
| Admin Venues | `admin.venues@dev.local` | `venues`: approves bookings |
| Admin Plain | `admin.plain@dev.local` | Admin with no responsibilities |

The switcher only appears in dev mode, and dev accounts only work while
`app_settings.allow_dev_accounts` is true. Turn that off before launch.

## Project layout

```
src/
  app/          router, providers, layout, tab bar, auth guard, dev role switcher
  styles/       tokens.css (design tokens), globals.css
  components/   shared UI: Button, Card, Chip, Badge, Input, SegmentedControl, Sheet, ...
  lib/          supabase client, query client, dates (Asia/Dubai), error messages
  config/       static school text (placeholders)
  features/     one folder per feature, all the same shape:
    <feature>/
      api.ts        raw Supabase calls
      hooks.ts      TanStack Query hooks (pages only call these)
      components/   pieces used by this feature's pages
      pages/        one file per screen
      *.test.tsx    UI tests
  types/database.ts   generated from the database
supabase/
  migrations/   the whole schema: tables, RLS policies, triggers, functions
  seed.sql      fake users and content for development
  tests/        pgTAP database tests
  functions/    Edge Functions (send-emails, send-push stubs)
docs/           architecture, open questions, one guide per feature
```

## Checks

```bash
npm run lint          # ESLint
npm run typecheck     # TypeScript
npm test              # Vitest UI tests
npm run db:test       # pgTAP database tests (local Supabase)
npm run format        # Prettier
```

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
are configured (see `docs/OPEN_QUESTIONS.md`, Q8).

## Hosting (Vercel)

`vercel.json` is ready: it builds with `npm run build`, serves `dist/`, and sends
every route to `index.html` so deep links work. Set `VITE_SUPABASE_URL`,
`VITE_SUPABASE_ANON_KEY` and `VITE_AUTH_PROVIDER` in the Vercel project's
environment variables. Not deployed yet.
