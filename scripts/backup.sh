#!/usr/bin/env bash
# backup.sh — nightly Postgres backup: pg_dump -> gzip -> destination -> prune.
#
#   DATABASE_URL     required (source database)
#   BACKUP_DEST      required: s3://bucket/prefix (uploaded with s3cmd, DigitalOcean Spaces)
#                    or local:/some/dir (used to exercise the script without Spaces)
#   BACKUP_KEEP_DAYS retention in days (default 30). Older dumps are deleted from the destination.
#   BACKUP_PREFIX    file name prefix (default "complystart")
#   EVIDENCE_DIR, UPLOADS_DIR  (optional) when set, their contents are also archived as
#                    <prefix>-data-<same timestamp>.tar.gz (encrypted whistleblower evidence and
#                    uploaded logos), delivered to the same destination and pruned with the same
#                    retention. A set variable whose directory does not exist is an error: a
#                    silently missing evidence backup is the failure this exists to prevent.
#
# Credentials never live in the repo: DATABASE_URL and the s3cmd config (~/.s3cfg of the user
# running the timer) come from the droplet. Exits nonzero on any failure so systemd marks the
# run failed. Restore: see README "Backups".
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL is required}"
: "${BACKUP_DEST:?BACKUP_DEST is required (s3://bucket/prefix or local:/dir)}"
KEEP_DAYS=${BACKUP_KEEP_DAYS:-30}
PREFIX=${BACKUP_PREFIX:-complystart}
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
NAME="${PREFIX}-${STAMP}.sql.gz"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

# --no-owner/--no-privileges: the dump restores into any role. Plain SQL so it is greppable.
# pipefail makes a failed pg_dump fail the whole pipeline (no silently empty backups).
pg_dump --no-owner --no-privileges "$DATABASE_URL" | gzip -9 > "$TMP/$NAME"
[ -s "$TMP/$NAME" ] || { echo "backup: empty dump" >&2; exit 1; }
gzip -t "$TMP/$NAME"                     # integrity check of the archive itself
SIZE=$(stat -c %s "$TMP/$NAME")

# deliver FILE: copy/upload one file to the destination (prune happens once, below).
case "$BACKUP_DEST" in
  local:*)
    DIR=${BACKUP_DEST#local:}
    mkdir -p "$DIR"
    deliver() { cp "$1" "$DIR/$(basename "$1")"; }
    prune() { find "$DIR" -maxdepth 1 \( -name "${PREFIX}-*.sql.gz" -o -name "${PREFIX}-data-*.tar.gz" \) -mtime "+$KEEP_DAYS" -print -delete; }
    ;;
  s3://*)
    command -v s3cmd >/dev/null || { echo "backup: s3cmd not installed" >&2; exit 1; }
    DEST=${BACKUP_DEST%/}
    deliver() { s3cmd put --no-progress "$1" "$DEST/$(basename "$1")"; }
    # prune: delete objects older than KEEP_DAYS (s3cmd ls prints "YYYY-MM-DD HH:MM size url")
    prune() {
      CUTOFF=$(date -u -d "$KEEP_DAYS days ago" +%Y-%m-%d)
      s3cmd ls "$DEST/" | awk -v c="$CUTOFF" -v p="$PREFIX" '$1 < c && $4 ~ p"-.*\\.(sql|tar)\\.gz$" {print $4}' | while read -r old; do
        echo "pruning $old"; s3cmd del "$old"
      done
    }
    ;;
  *)
    echo "backup: BACKUP_DEST must be s3://… or local:/…" >&2; exit 1 ;;
esac

# The database dump goes first: if the data archive fails afterwards, last night's dump still exists.
deliver "$TMP/$NAME"
RESULT="$NAME ($SIZE bytes)"

# Data directories (phase 9). tar exit 1 = "a file changed while it was read": the archive is
# still written; anything worse fails the run.
TAR_ARGS=()
for var in EVIDENCE_DIR UPLOADS_DIR; do
  dir=${!var:-}
  [ -n "$dir" ] || continue
  [ -d "$dir" ] || { echo "backup: $var=$dir is not a directory" >&2; exit 1; }
  parent=$(cd "$dir/.." && pwd); base=$(basename "$(cd "$dir" && pwd)")
  TAR_ARGS+=(-C "$parent" "$base")
done
if [ "${#TAR_ARGS[@]}" -gt 0 ]; then
  DATA="${PREFIX}-data-${STAMP}.tar.gz"
  rc=0; tar -czf "$TMP/$DATA" "${TAR_ARGS[@]}" || rc=$?
  [ "$rc" -le 1 ] || { echo "backup: tar failed ($rc)" >&2; exit 1; }
  gzip -t "$TMP/$DATA"
  deliver "$TMP/$DATA"
  RESULT="$RESULT + $DATA ($(stat -c %s "$TMP/$DATA") bytes)"
fi

prune
echo "backup ok: $RESULT -> $BACKUP_DEST"
