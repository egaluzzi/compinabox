#!/usr/bin/env bash
# restore-test.sh — restore a backup into a SCRATCH database and compare row counts with the source.
# This is the monthly restore test (and what the phase 2 round-trip proof runs).
#
#   restore-test.sh <backup.sql.gz>
#   env: DATABASE_URL (source, for the comparison), SCRATCH_ADMIN_URL (a URL that may CREATE/DROP DATABASE)
set -euo pipefail
BACKUP=${1:?usage: restore-test.sh <backup.sql.gz>}
: "${DATABASE_URL:?}" "${SCRATCH_ADMIN_URL:?}"
SCRATCH="restore_test_$(date +%s)_$$"
# scratch URL = admin URL with the database name swapped
SCRATCH_URL="${SCRATCH_ADMIN_URL%/*}/$SCRATCH"
psql "$SCRATCH_ADMIN_URL" -qv ON_ERROR_STOP=1 -c "CREATE DATABASE \"$SCRATCH\""
trap 'psql "$SCRATCH_ADMIN_URL" -qc "DROP DATABASE IF EXISTS \"$SCRATCH\"" >/dev/null' EXIT
gunzip -c "$BACKUP" | psql "$SCRATCH_URL" -q -v ON_ERROR_STOP=1 >/dev/null

counts() { # table<TAB>count for every public table, sorted
  psql "$1" -Atc "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY 1" |
  while read -r t; do printf '%s\t%s\n' "$t" "$(psql "$1" -Atc "SELECT count(*) FROM \"$t\"")"; done
}
counts "$DATABASE_URL" > "$(dirname "$BACKUP")/.src.counts"
counts "$SCRATCH_URL"  > "$(dirname "$BACKUP")/.restored.counts"
echo "table                  source  restored"
paste "$(dirname "$BACKUP")/.src.counts" "$(dirname "$BACKUP")/.restored.counts" | awk -F'\t' '{printf "%-22s %6s  %6s\n",$1,$2,$4}'
if diff -q "$(dirname "$BACKUP")/.src.counts" "$(dirname "$BACKUP")/.restored.counts" >/dev/null; then
  echo "restore-test: PASS (all row counts match)"; rc=0
else
  echo "restore-test: FAIL (row counts differ)"; rc=1
fi
rm -f "$(dirname "$BACKUP")/.src.counts" "$(dirname "$BACKUP")/.restored.counts"
exit $rc
