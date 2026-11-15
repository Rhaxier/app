# Database tests without Docker

`supabase start` and `supabase test db` need Docker. Where Docker isn't available, `run.sh` runs
every migration, the seed and every pgTAP file on a throwaway plain Postgres 17, with
`supabase-standin.sql` providing the few Supabase parts our SQL uses (API roles and default grants,
`auth.users`, `auth.uid()`, `storage` tables, an empty `supabase_realtime` publication).
It starts its own server on `localhost:54329` and never connects to a cloud project.

It is a stand-in, not Supabase: Realtime delivery, PostgREST and Auth are not tested here.
`supabase test db` remains the reference.

## Setup (Windows, no install)

1. Download the Postgres 17 "binaries" zip from EnterpriseDB
   (`https://get.enterprisedb.com/postgresql/postgresql-17.9-1-windows-x64-binaries.zip`) and unzip
   it into a scratch folder. It includes `btree_gist` and `pgcrypto`.
2. Download pgTAP 1.3.3 (`https://github.com/theory/pgtap/archive/refs/tags/v1.3.3.tar.gz`), and
   install its extension files into that Postgres:

   ```
   sed -e 's,MODULE_PATHNAME,$libdir/pgtap,g' -e 's,__OS__,mingw,g' -e 's,__VERSION__,1.33,g' \
     pgtap-1.3.3/sql/pgtap.sql.in > pgsql/share/extension/pgtap--1.3.3.sql
   sed 's/^module_pathname.*$//' pgtap-1.3.3/pgtap.control > pgsql/share/extension/pgtap.control
   ```

## Run

```
PGBIN=/path/to/pgsql/bin WORKDIR=/path/to/scratch bash tools/local-pg/run.sh
```

Add `KEEP=1` to leave the server running (for `psql` or for generating types, below). Stop it with
`"$PGBIN/pg_ctl" -D "$WORKDIR/data" stop`. Don't pipe the output of a `KEEP=1` run: the server keeps
the pipe open, so redirect to a file instead.

Types from the throwaway database (instead of `npm run db:types`):

```
npx supabase gen types typescript --db-url "postgresql://postgres@localhost:54329/app?sslmode=disable" --schema public
```

The current CLI quotes every key; strip the quotes and run Prettier to match `src/types/database.ts`.
