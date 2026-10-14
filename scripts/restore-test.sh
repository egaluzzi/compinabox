#!/usr/bin/env bash
# restore-test.sh — restore a backup into a SCRATCH database and verify it against the dump itself.
# This is the monthly restore test.
#
#   restore-test.sh <backup.sql.gz>
#   env: SCRATCH_ADMIN_URL (required): a URL that may CREATE/DROP DATABASE, ending in /<some db>
#
# Row counts are read from the dump's own COPY blocks (one line per row), so the test is valid for
# a dump of any age and never touches the live database. Fails on: any psql error, a table present
# on only one side, or any per-table count mismatch.
set -euo pipefail
BACKUP=${1:?usage: restore-test.sh <backup.sql.gz>}
: "${SCRATCH_ADMIN_URL:?SCRATCH_ADMIN_URL is required}"
gzip -t "$BACKUP"

SCRATCH="restore_test_$(date +%s)_$$"
SCRATCH_URL="${SCRATCH_ADMIN_URL%/*}/$SCRATCH"
WORK=$(mktemp -d)
cleanup() {
  psql "$SCRATCH_ADMIN_URL" -qc "DROP DATABASE IF EXISTS \"$SCRATCH\" WITH (FORCE)" >/dev/null 2>&1 || true
  rm -rf "$WORK"
}
trap cleanup EXIT

# Tables and row counts according to the dump: CREATE TABLE gives the table list (empty tables have
# no COPY block); each COPY ... FROM stdin; block up to the "\." terminator gives that table's rows.
gunzip -c "$BACKUP" | awk '
  /^CREATE TABLE / { t=$3; gsub(/"/,"",t); n[t]+=0; next }
  /^COPY / { t=$2; gsub(/"/,"",t); incopy=1; n[t]+=0; next }
  incopy && /^\\\.$/ { incopy=0; next }
  incopy { n[t]++ }
  END { for (k in n) printf "%s\t%d\n", k, n[k] }' | sort > "$WORK/dump.counts"
[ -s "$WORK/dump.counts" ] || { echo "restore-test: FAIL (no tables found in dump)"; exit 1; }

psql "$SCRATCH_ADMIN_URL" -qv ON_ERROR_STOP=1 -c "CREATE DATABASE \"$SCRATCH\""
gunzip -c "$BACKUP" | psql "$SCRATCH_URL" -q -v ON_ERROR_STOP=1 >/dev/null

# every user schema (public, and drizzle for the migrations table), names as schema.table
psql "$SCRATCH_URL" -Atc "SELECT table_schema || '.' || table_name FROM information_schema.tables WHERE table_schema NOT IN ('pg_catalog','information_schema') AND table_type='BASE TABLE'" |
while read -r t; do printf '%s\t%s\n' "$t" "$(psql "$SCRATCH_URL" -Atc "SELECT count(*) FROM ${t%%.*}.\"${t#*.}\"")"; done | sort > "$WORK/restored.counts"

rc=0
printf '%-24s %8s  %9s\n' table "in dump" restored
join -t $'\t' -a1 -a2 -e MISSING -o 0,1.2,2.2 "$WORK/dump.counts" "$WORK/restored.counts" |
while IFS=$'\t' read -r t a b; do
  flag=""; [ "$a" != "$b" ] && flag="  <-- MISMATCH"
  printf '%-24s %8s  %9s%s\n' "$t" "$a" "$b" "$flag"
done | tee "$WORK/table.out"
if grep -q MISMATCH "$WORK/table.out"; then
  echo "restore-test: FAIL (mismatch in: $(grep MISMATCH "$WORK/table.out" | awk '{print $1}' | tr '\n' ' '))"; rc=1
else
  echo "restore-test: PASS (every table restored with the row count recorded in the dump)"
fi
exit $rc
