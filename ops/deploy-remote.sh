#!/bin/bash
# deploy-remote.sh <git-sha> — runs ON THE SERVER as the deploy user (streamed over SSH by
# .github/workflows/deploy.yml, so it is always the script of the commit being deployed).
#
# Expects the CI to have uploaded  $ROOT/incoming/<sha>.tar.gz  and  <sha>.tar.gz.sha256 .
# Steps: verify -> extract to releases/<sha> -> migrations (MIGRATE=auto) -> switch `current` ->
# restart -> wait for /api/health to report this sha and ok -> otherwise ROLL BACK automatically
# (symlink back, restart, wait) and exit nonzero -> prune old releases (only after a healthy deploy).
#
#   COMPINABOX_ROOT  default /opt/compinabox
#   MIGRATE          auto | manual (default manual). The workflow passes auto for staging only.
#                    Migrations are FORWARD-ONLY: a rollback restores the previous code, never the schema.
#   HEALTH_URL       default http://127.0.0.1:3000/api/health
#   HEALTH_TIMEOUT   seconds to wait for a healthy new release (default 60) and for a rollback
#   KEEP_RELEASES    default 3
#   RESTART_CMD / MIGRATE_CMD  default `sudo ... systemctl restart complystart` and
#                    `sudo ... complystart-migrate` (called with the sha). Overridden by the local rehearsal.
# Prints no secrets (it cannot read them: .env belongs to the app user).
# shellcheck disable=SC2015  # `A && B || { error; exit }` is intentional: the error branch cannot fail
set -euo pipefail
umask 027

SHA=${1:-}
[[ "$SHA" =~ ^[0-9a-f]{7,40}$ ]] || { echo "usage: deploy-remote.sh <git-sha>" >&2; exit 2; }

ROOT=${COMPINABOX_ROOT:-/opt/compinabox}
MIGRATE=${MIGRATE:-manual}
HEALTH_URL=${HEALTH_URL:-http://127.0.0.1:3000/api/health}
HEALTH_TIMEOUT=${HEALTH_TIMEOUT:-60}
KEEP_RELEASES=${KEEP_RELEASES:-3}
RESTART_CMD=${RESTART_CMD:-sudo /usr/bin/systemctl restart complystart}
MIGRATE_CMD=${MIGRATE_CMD:-sudo /usr/local/sbin/complystart-migrate}
case "$MIGRATE" in auto|manual) ;; *) echo "deploy: MIGRATE must be auto or manual" >&2; exit 2 ;; esac

log() { printf '[deploy %s] %s\n' "${SHA:0:7}" "$*"; }
RELEASES="$ROOT/releases"
INCOMING="$ROOT/incoming"
mkdir -p "$RELEASES" "$INCOMING"

# One deploy at a time on this server (the workflow also serializes runs).
exec 9>"$ROOT/.deploy.lock"
flock -n 9 || { echo "deploy: another deploy is running" >&2; exit 1; }

# healthy <sha>: /api/health answers ok:true with version == sha
healthy() {
  curl -fsS -m 3 "$HEALTH_URL" 2>/dev/null | node -e '
    let d = ""; process.stdin.on("data", c => d += c).on("end", () => {
      try { const j = JSON.parse(d); process.exit(j.ok === true && j.version === process.argv[1] ? 0 : 1); }
      catch { process.exit(1); }
    });' "$1"
}
wait_healthy() { # wait_healthy <sha> <label>
  local t=0
  while [ "$t" -lt "$HEALTH_TIMEOUT" ]; do
    if healthy "$1"; then log "$2 is healthy (version ${1:0:7}) after ${t}s"; return 0; fi
    sleep 1; t=$((t + 1))
  done
  return 1
}

# --- 1. the uploaded archive ------------------------------------------------
TAR="$INCOMING/$SHA.tar.gz"
[ -f "$TAR" ] && [ -f "$TAR.sha256" ] || { echo "deploy: $TAR (or its .sha256) is missing" >&2; exit 1; }
(cd "$INCOMING" && sha256sum -c "$SHA.tar.gz.sha256" >/dev/null) || { echo "deploy: checksum mismatch for $SHA.tar.gz" >&2; exit 1; }
log "archive verified"

PREVIOUS=""
if [ -L "$ROOT/current" ]; then PREVIOUS=$(basename "$(readlink "$ROOT/current")"); fi

# --- 2. extract ---------------------------------------------------------------
DEST="$RELEASES/$SHA"
if [ "$PREVIOUS" = "$SHA" ]; then
  log "this release is already current; re-running the switch and the health check"
else
  rm -rf "$DEST" "$DEST.partial" "$DEST.failed"
  mkdir "$DEST.partial"
  tar -xzf "$TAR" -C "$DEST.partial"
  [ "$(cat "$DEST.partial/VERSION" 2>/dev/null)" = "$SHA" ] || { echo "deploy: VERSION inside the archive is not $SHA" >&2; rm -rf "$DEST.partial"; exit 1; }
  [ -f "$DEST.partial/server.js" ] && [ -f "$DEST.partial/scripts/migrate.mjs" ] || { echo "deploy: archive is incomplete" >&2; rm -rf "$DEST.partial"; exit 1; }
  # The app (group) may read; only Next's cache directory is writable by it.
  mkdir -p "$DEST.partial/.next/cache"
  chmod -R g+rX "$DEST.partial"
  chmod g+ws "$DEST.partial/.next/cache"
  mv "$DEST.partial" "$DEST"
  log "extracted to releases/$SHA"
fi

# --- 3. migrations -------------------------------------------------------------
if [ "$MIGRATE" = auto ]; then
  log "running migrations (MIGRATE=auto)"
  if ! $MIGRATE_CMD "$SHA" 9>&-; then
    echo "deploy: migrations failed; nothing was switched, the running release is untouched" >&2
    [ "$PREVIOUS" = "$SHA" ] || mv "$DEST" "$DEST.failed"
    exit 1
  fi
else
  log "migrations NOT run (MIGRATE=manual): apply them yourself before relying on this release"
fi

# --- 4. switch + restart + health ------------------------------------------------
switch_to() { ln -sfn "releases/$1" "$ROOT/current.new" && mv -T "$ROOT/current.new" "$ROOT/current"; }
switch_to "$SHA"
log "current -> releases/$SHA; restarting"
$RESTART_CMD 9>&-   # fd 9 is the lock: the server it starts must not inherit it

if wait_healthy "$SHA" "new release"; then
  # --- 5. prune (only after a healthy deploy) ----------------------------------------
  rm -f "$TAR" "$TAR.sha256"
  # keep the newest KEEP_RELEASES good releases, plus the new and the previous one; failed and
  # half-extracted directories from earlier attempts are no longer needed once a deploy is healthy
  keep=$(find "$RELEASES" -mindepth 1 -maxdepth 1 -type d ! -name '*.partial' ! -name '*.failed' -printf '%T@ %f\n' | sort -rn | head -n "$KEEP_RELEASES" | cut -d' ' -f2-)
  for dir in "$RELEASES"/*; do
    name=$(basename "$dir")
    [ -d "$dir" ] || continue
    case "$name" in *.partial|*.failed) log "removing $name"; rm -rf "$dir"; continue ;; esac
    if [ "$name" != "$SHA" ] && [ "$name" != "$PREVIOUS" ] && ! grep -qx -- "$name" <<<"$keep"; then
      log "pruning old release $name"; rm -rf "$dir"
    fi
  done
  log "DEPLOYED ${SHA}"
  exit 0
fi

# --- 6. rollback --------------------------------------------------------------------
echo "deploy: release $SHA did not become healthy within ${HEALTH_TIMEOUT}s" >&2
if [ -n "$PREVIOUS" ] && [ -d "$RELEASES/$PREVIOUS" ] && [ "$PREVIOUS" != "$SHA" ]; then
  log "ROLLING BACK to $PREVIOUS (code only: migrations already applied stay applied)"
  switch_to "$PREVIOUS"
  $RESTART_CMD 9>&-
  mv "$DEST" "$DEST.failed"
  if wait_healthy "$PREVIOUS" "previous release"; then
    echo "deploy: ROLLED BACK to $PREVIOUS; the failed release is kept as releases/$SHA.failed for inspection" >&2
  else
    echo "deploy: ROLLBACK ALSO UNHEALTHY — look at: journalctl -u complystart -n 100" >&2
  fi
else
  echo "deploy: no previous release to roll back to — look at: journalctl -u complystart -n 100" >&2
fi
exit 1
