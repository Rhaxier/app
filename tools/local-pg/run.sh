#!/usr/bin/env bash
# =============================================================================
# Runs every migration, the seed and every pgTAP test on a throwaway plain
# Postgres (no Docker, no Supabase). For machines where `supabase start`
# can't run. It never connects to a cloud project: it starts its own server
# on localhost and deletes its data folder at the start of each run.
#
# Needs: Postgres 17 binaries (initdb, pg_ctl, psql) with btree_gist, and
# pgTAP's extension files copied into that Postgres's share/extension folder.
#
#   PGBIN=/path/to/pgsql/bin WORKDIR=/some/scratch/folder tools/local-pg/run.sh
#
# Optional: PGPORT (default 54329), KEEP=1 to leave the server running after
# the tests (stop it with: "$PGBIN/pg_ctl" -D "$WORKDIR/data" stop).
# =============================================================================
set -euo pipefail

: "${PGBIN:?Set PGBIN to the folder holding initdb, pg_ctl and psql}"
: "${WORKDIR:?Set WORKDIR to a scratch folder for the throwaway database}"
PGPORT="${PGPORT:-54329}"
REPO="$(cd "$(dirname "$0")/../.." && pwd)"
DATA="$WORKDIR/data"
# The SQL files are UTF-8 (dashes in messages); psql on Windows would guess otherwise.
export PGCLIENTENCODING=UTF8
PSQL=("$PGBIN/psql" -X -q -h localhost -p "$PGPORT" -U postgres -v ON_ERROR_STOP=1)

# Fresh cluster each run, so the migrations are proven to apply from empty.
if [ -d "$DATA" ]; then
  "$PGBIN/pg_ctl" -D "$DATA" stop -m fast >/dev/null 2>&1 || true
  rm -rf "$DATA"
fi
"$PGBIN/initdb" -D "$DATA" -U postgres -A trust -E UTF8 --locale=C >/dev/null
"$PGBIN/pg_ctl" -D "$DATA" -o "-p $PGPORT -c timezone=UTC" -l "$WORKDIR/server.log" -w start >/dev/null

stop_server() {
  if [ "${KEEP:-0}" != "1" ]; then
    "$PGBIN/pg_ctl" -D "$DATA" stop -m fast >/dev/null 2>&1 || true
  fi
}
trap stop_server EXIT

"${PSQL[@]}" -d postgres -c "create database app" >/dev/null
# Supabase puts the extensions schema on the search path (pgTAP's plan(), ok()...).
"${PSQL[@]}" -d postgres -c "alter database app set search_path = \"\$user\", public, extensions" >/dev/null
DB=("${PSQL[@]}" -d app)

echo "== Stand-in for Supabase"
"${DB[@]}" -f "$REPO/tools/local-pg/supabase-standin.sql" >/dev/null

echo "== Migrations"
for f in "$REPO"/supabase/migrations/*.sql; do
  # Each file in its own transaction, like `supabase db push`.
  "${DB[@]}" -1 -f "$f" >/dev/null 2>"$WORKDIR/last.err" || {
    echo "FAILED: $(basename "$f")"
    cat "$WORKDIR/last.err"
    exit 1
  }
  echo "   ok  $(basename "$f")"
done

echo "== Seed"
"${DB[@]}" -1 -f "$REPO/supabase/seed.sql" >/dev/null

echo "== pgTAP"
total_ok=0
total_fail=0
failed_files=()
for f in "$REPO"/supabase/tests/*.sql; do
  out="$("${PSQL[@]}" -d app -t -A -f "$f" 2>&1 || true)"
  ok=$(grep -cE '^ok [0-9]+' <<<"$out" || true)
  bad=$(grep -cE '^not ok [0-9]+' <<<"$out" || true)
  planned=$(grep -oE '^1\.\.[0-9]+' <<<"$out" | head -1 | cut -d. -f3 || true)
  status="ok"
  if [ "$bad" -gt 0 ] || [ -z "$planned" ] || [ "$planned" != "$ok" ] || grep -q 'ERROR:' <<<"$out"; then
    status="FAIL"
    failed_files+=("$(basename "$f")")
    grep -E '^not ok|^#|ERROR:' <<<"$out" | head -20 | sed 's/^/      /'
  fi
  printf '   %-4s %-36s %s/%s\n' "$status" "$(basename "$f")" "$ok" "${planned:-?}"
  total_ok=$((total_ok + ok))
  total_fail=$((total_fail + bad))
done

echo "== Result: $total_ok passed, $total_fail failed, ${#failed_files[@]} file(s) with problems"
[ "${#failed_files[@]}" -eq 0 ]
