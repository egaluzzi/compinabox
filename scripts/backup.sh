#!/usr/bin/env bash
# backup.sh — nightly Postgres backup: pg_dump -> gzip -> destination -> prune.
#
#   DATABASE_URL     required (source database)
#   BACKUP_DEST      required: s3://bucket/prefix (uploaded with s3cmd, DigitalOcean Spaces)
#                    or local:/some/dir (used to exercise the script without Spaces)
#   BACKUP_KEEP_DAYS retention in days (default 30). Older dumps are deleted from the destination.
#   BACKUP_PREFIX    file name prefix (default "complystart")
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

case "$BACKUP_DEST" in
  local:*)
    DIR=${BACKUP_DEST#local:}
    mkdir -p "$DIR"
    cp "$TMP/$NAME" "$DIR/$NAME"
    find "$DIR" -maxdepth 1 -name "${PREFIX}-*.sql.gz" -mtime "+$KEEP_DAYS" -print -delete
    ;;
  s3://*)
    command -v s3cmd >/dev/null || { echo "backup: s3cmd not installed" >&2; exit 1; }
    DEST=${BACKUP_DEST%/}
    s3cmd put --no-progress "$TMP/$NAME" "$DEST/$NAME"
    # prune: delete objects older than KEEP_DAYS (s3cmd ls prints "YYYY-MM-DD HH:MM size url")
    CUTOFF=$(date -u -d "$KEEP_DAYS days ago" +%Y-%m-%d)
    s3cmd ls "$DEST/" | awk -v c="$CUTOFF" -v p="$PREFIX" '$1 < c && $4 ~ p"-.*\\.sql\\.gz$" {print $4}' | while read -r old; do
      echo "pruning $old"; s3cmd del "$old"
    done
    ;;
  *)
    echo "backup: BACKUP_DEST must be s3://… or local:/…" >&2; exit 1 ;;
esac
echo "backup ok: $NAME ($SIZE bytes) -> $BACKUP_DEST"
