#!/usr/bin/env bash
# rehearse-deploy.sh — a LOCAL rehearsal of the release / rollback logic in ops/deploy-remote.sh.
#
# Builds a temp tree that mimics /opt/compinabox, a real Postgres database, and runs the REAL
# ops/deploy-remote.sh, ops/complystart-migrate and scripts/package-release.sh against it, with a
# real `node server.js` process. The only stand-in is systemd: `fake-service restart` stops the old
# process and starts the one in `current/` the way complystart.service would.
#
#   1. deploy A  (first release)
#   2. deploy B  (second release; A is kept)
#   3. deploy C  = B's build forced into APP_ENV=production with the staging .env -> the environment
#                  guard refuses to start it -> health never turns green -> automatic rollback to B
#   4. deploy D  = a release whose migration is broken -> aborted before the switch, B untouched
#   4b. deploy E (healthy) -> the failed directories and the oldest release are pruned
#   5. scripts/remote-smoke.sh against the final state
#
# Needs: a finished `npm run build`, TEST_DATABASE_URL (a Postgres that may CREATE DATABASE), node, curl.
# It does NOT test: users/permissions (it runs as the current user), systemd, Caddy, real network.
set -uo pipefail
cd "$(dirname "$0")/.." || exit 2

: "${TEST_DATABASE_URL:?TEST_DATABASE_URL is required}"
[ -f .next/standalone/server.js ] || { echo "run npm run build first"; exit 2; }

ADMIN_URL=${TEST_DATABASE_URL%%\?*}
DBNAME="rehearsal_$(date +%s)_$$"
psql "$ADMIN_URL" -qc "CREATE DATABASE \"$DBNAME\"" || exit 2
DB_URL="${ADMIN_URL%/*}/$DBNAME"
ROOT=$(mktemp -d)
PORT=$(node -e 'const s=require("net").createServer().listen(0,()=>{console.log(s.address().port);s.close()})')
S_AUTH="rehearsal-auth-$(head -c 16 /dev/urandom | base64 | tr -dc 'A-Za-z0-9')"
OUTBOX_PW="rehearsal-$(head -c 12 /dev/urandom | base64 | tr -dc 'A-Za-z0-9')"
export COMPINABOX_ROOT=$ROOT COMPLYSTART_RUN_AS_SELF=1

cleanup() {
  [ -f "$ROOT/.fake.pid" ] && kill "$(cat "$ROOT/.fake.pid")" 2>/dev/null
  psql "$ADMIN_URL" -qc "DROP DATABASE IF EXISTS \"$DBNAME\" WITH (FORCE)" >/dev/null 2>&1
  rm -rf "$ROOT"
}
trap cleanup EXIT

mkdir -p "$ROOT"/{releases,incoming,backups,data/uploads,data/evidence,data/outbox,pkg}
cat > "$ROOT/.env" <<ENV
APP_ENV=staging
NODE_ENV=production
PORT=$PORT
HOSTNAME=127.0.0.1
APP_URL=http://127.0.0.1:$PORT
AUTH_URL=http://127.0.0.1:$PORT
AUTH_SECRET=$S_AUTH
DATABASE_URL=$DB_URL
ENABLED_COUNTRIES=br
PAYMENT_PROVIDER=fake
ALLOW_FAKE_PAYMENTS=true
FAKE_PAYMENTS_SECRET=rehearsal-fake-secret-$(head -c 16 /dev/urandom | base64 | tr -dc 'A-Za-z0-9')
EMAIL_DEV_SINK=true
EMAIL_SINK_DIR=$ROOT/data/outbox
DEV_OUTBOX_PASSWORD=$OUTBOX_PW
REPORT_ENCRYPTION_KEYS=k1:$(head -c 32 /dev/urandom | base64)
EVIDENCE_DIR=$ROOT/data/evidence
UPLOADS_DIR=$ROOT/data/uploads
BINDER_CONCURRENCY=1
BACKUP_DEST=local:$ROOT/backups
ENV
chmod 600 "$ROOT/.env"

# --- the stand-in for `systemctl restart complystart` --------------------------------------------
cat > "$ROOT/fake-service" <<'SVC'
#!/usr/bin/env bash
# fake-service restart — stops the running server, starts the one in current/ (like the unit does)
set -u
ROOT=$COMPINABOX_ROOT
if [ -f "$ROOT/.fake.pid" ]; then
  pid=$(cat "$ROOT/.fake.pid"); kill "$pid" 2>/dev/null
  for _ in $(seq 1 50); do kill -0 "$pid" 2>/dev/null || break; sleep 0.1; done
  kill -9 "$pid" 2>/dev/null; rm -f "$ROOT/.fake.pid"
fi
envs=()
while IFS= read -r line; do case "$line" in ''|'#'*) ;; *) envs+=("$line") ;; esac; done < "$ROOT/.env"
cd "$ROOT/current" || exit 1
APP_VERSION=$(cat "$ROOT/current/VERSION")
env -i PATH="$PATH" "${envs[@]}" APP_VERSION="$APP_VERSION" nohup node server.js >> "$ROOT/app.log" 2>&1 &
echo $! > "$ROOT/.fake.pid"
SVC
chmod +x "$ROOT/fake-service"

export RESTART_CMD="$ROOT/fake-service"
export MIGRATE_CMD="$PWD/ops/complystart-migrate"
export HEALTH_URL="http://127.0.0.1:$PORT/api/health"
export MIGRATE=auto

step() { printf '\n======== %s ========\n' "$1"; }
state() {
  echo "--- state: current -> $(readlink "$ROOT/current" 2>/dev/null || echo '(none)')"
  echo "--- releases/: $(ls -1 "$ROOT/releases" | tr '\n' ' ')"
  echo "--- /api/health: $(curl -s -m 3 "$HEALTH_URL" || echo '(no answer)')"
  echo "--- applied migrations: $(psql "$DB_URL" -Atc 'select count(*) from drizzle.__drizzle_migrations' 2>/dev/null || echo 0)"
}
upload() { # upload <sha>  (what the workflow's scp step does)
  mv "$ROOT/pkg/$1.tar.gz" "$ROOT/pkg/$1.tar.gz.sha256" "$ROOT/incoming/"
}
variant() { # variant <from-sha> <new-sha> <shell snippet run inside the extracted tree>
  local d; d=$(mktemp -d)
  tar -xzf "$ROOT/pkg/$1.tar.gz" -C "$d" 2>/dev/null || tar -xzf "$ROOT/incoming/$1.tar.gz" -C "$d"
  printf '%s' "$2" > "$d/VERSION"
  (cd "$d" && eval "$3")
  tar -czf "$ROOT/pkg/$2.tar.gz" -C "$d" .
  (cd "$ROOT/pkg" && sha256sum "$2.tar.gz" > "$2.tar.gz.sha256")
  rm -rf "$d"
}

A=aaaaaaa1111111111111111111111111111111a
B=bbbbbbb2222222222222222222222222222222b
C=ccccccc3333333333333333333333333333333c
D=ddddddd4444444444444444444444444444444d
rc=0

step "package A, B (scripts/package-release.sh on the real build)"
scripts/package-release.sh "$A" "$ROOT/pkg" || exit 2
cp "$ROOT/pkg/$A.tar.gz" "$ROOT/A-keep.tar.gz"
scripts/package-release.sh "$B" "$ROOT/pkg" || exit 2
cp "$ROOT/pkg/$B.tar.gz" "$ROOT/B-keep.tar.gz"

step "1. DEPLOY A (first release, migrations from scratch)"
upload "$A"; ops/deploy-remote.sh "$A"; echo "deploy exit code: $?"; state

step "2. DEPLOY B (second release; A stays as the rollback target)"
upload "$B"; ops/deploy-remote.sh "$B"; echo "deploy exit code: $?"; state

step "3. DEPLOY C (APP_ENV=production forced onto the staging .env: the guard refuses to start; expect AUTOMATIC ROLLBACK to B)"
# C is B's build with a one-line prefix in server.js. HEALTH_TIMEOUT is short so the rehearsal is quick.
mkdir -p "$ROOT/pkg" && cp "$ROOT/B-keep.tar.gz" "$ROOT/pkg/$B.tar.gz"
variant "$B" "$C" 'sed -i "1i process.env.APP_ENV = \"production\";" server.js'
upload "$C"; HEALTH_TIMEOUT=25 ops/deploy-remote.sh "$C"; crc=$?; echo "deploy exit code: $crc  (expected 1)"; state
[ "$crc" -eq 1 ] || { echo "REHEARSAL FAIL: deploy C should have failed"; rc=1; }
[ "$(basename "$(readlink "$ROOT/current")")" = "$B" ] || { echo "REHEARSAL FAIL: current is not B after the rollback"; rc=1; }
echo "--- why C never turned healthy (app.log, the environment guard):"; grep -m2 'ENVIRONMENT GUARD' "$ROOT/app.log" | cut -c1-300

step "4. DEPLOY D (a broken migration: expect abort BEFORE the switch, B untouched and still serving)"
cp "$ROOT/B-keep.tar.gz" "$ROOT/pkg/$B.tar.gz"
variant "$B" "$D" '
  n=$(node -pe "JSON.parse(require(\"fs\").readFileSync(\"lib/db/migrations/meta/_journal.json\",\"utf8\")).entries.length")
  echo "this is not sql;" > lib/db/migrations/9999_broken.sql
  node -e "const f=\"lib/db/migrations/meta/_journal.json\";const j=JSON.parse(require(\"fs\").readFileSync(f,\"utf8\"));j.entries.push({idx:$n,version:\"7\",when:Date.now()+86400000,tag:\"9999_broken\",breakpoints:true});require(\"fs\").writeFileSync(f,JSON.stringify(j))"'
upload "$D"; ops/deploy-remote.sh "$D"; drc=$?; echo "deploy exit code: $drc  (expected 1)"; state
[ "$drc" -eq 1 ] || { echo "REHEARSAL FAIL: deploy D should have failed"; rc=1; }
[ "$(basename "$(readlink "$ROOT/current")")" = "$B" ] || { echo "REHEARSAL FAIL: current moved although the migration failed"; rc=1; }

step "4b. DEPLOY E (healthy again: expect the failed C and D directories and the oldest release to be pruned)"
cp "$ROOT/B-keep.tar.gz" "$ROOT/pkg/$B.tar.gz"
E=eeeeeee5555555555555555555555555555555e
variant "$B" "$E" 'true'
upload "$E"; ops/deploy-remote.sh "$E"; erc=$?; echo "deploy exit code: $erc  (expected 0)"; state
[ "$erc" -eq 0 ] || { echo "REHEARSAL FAIL: deploy E should have succeeded"; rc=1; }

step "5. scripts/remote-smoke.sh against the final state (E, after the rollback and the aborted D)"
EXPECT_VERSION=$E EXPECT_ENV=staging DEV_OUTBOX_PASSWORD=$OUTBOX_PW scripts/remote-smoke.sh "http://127.0.0.1:$PORT" || rc=1

step "6. maintenance + backup scripts from the release, against the rehearsal database"
( set -a; . /dev/null; set +a; cd "$ROOT/current" && DATABASE_URL=$DB_URL node scripts/maintenance.mjs ) || rc=1
( DATABASE_URL=$DB_URL BACKUP_DEST="local:$ROOT/backups" EVIDENCE_DIR=$ROOT/data/evidence UPLOADS_DIR=$ROOT/data/uploads "$ROOT/current/scripts/backup.sh" ) || rc=1
ls -1 "$ROOT/backups"

step "result"
if [ "$rc" -eq 0 ]; then echo "REHEARSAL PASS"; else echo "REHEARSAL FAIL"; fi
exit "$rc"
