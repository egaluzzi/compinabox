#!/usr/bin/env bash
# package-release.sh <git-sha> <out-dir> — packs the result of `npm run build` into the one archive
# the server needs:  <out-dir>/<sha>.tar.gz  +  <sha>.tar.gz.sha256
#
# Contents: the standalone server, .next/static, public/, the migrations, the small runtime scripts
# (migrate.mjs, maintenance.mjs, backup.sh, restore-test.sh), node_modules/drizzle-orm (the standalone
# trace bundles it into chunks, so migrate.mjs needs the package itself), VERSION (= the sha, read by
# the systemd unit) and manifest.json. Everything that is only for developers (tests, docs, the
# markdown files, verify.sh, configs) is left out. No secret can be inside: none is available to a build.
set -euo pipefail

SHA=${1:?usage: package-release.sh <git-sha> <out-dir>}
OUT=${2:?usage: package-release.sh <git-sha> <out-dir>}
[[ "$SHA" =~ ^[0-9a-f]{7,40}$ ]] || { echo "package-release: bad sha" >&2; exit 2; }
cd "$(dirname "$0")/.."
[ -f .next/standalone/server.js ] || { echo "package-release: .next/standalone/server.js missing — run npm run build" >&2; exit 1; }
[ -d node_modules/drizzle-orm ] || { echo "package-release: node_modules/drizzle-orm missing — run npm ci" >&2; exit 1; }

mkdir -p "$OUT"
STAGE=$(mktemp -d)
trap 'rm -rf "$STAGE"' EXIT

cp -a .next/standalone/. "$STAGE/"
(
  cd "$STAGE"
  rm -rf tests docs ops scripts ./*.md verify.sh vitest.config.mts vitest.setup.ts eslint.config.mjs \
         tsconfig.json tsconfig.tsbuildinfo drizzle.config.ts postcss.config.mjs next.config.ts package-lock.json
)
rm -rf "$STAGE/.next/static"
mkdir -p "$STAGE/.next" "$STAGE/scripts"
cp -r .next/static "$STAGE/.next/static"
[ -d public ] && cp -r public "$STAGE/public"
mkdir -p "$STAGE/lib/db"
rm -rf "$STAGE/lib/db/migrations"
cp -r lib/db/migrations "$STAGE/lib/db/migrations"
cp scripts/migrate.mjs scripts/maintenance.mjs scripts/backup.sh scripts/restore-test.sh "$STAGE/scripts/"
chmod +x "$STAGE/scripts/backup.sh" "$STAGE/scripts/restore-test.sh"

# drizzle-orm: runtime files only (no source maps, no type declarations)
rm -rf "$STAGE/node_modules/drizzle-orm"
cp -r node_modules/drizzle-orm "$STAGE/node_modules/drizzle-orm"
find "$STAGE/node_modules/drizzle-orm" \( -name '*.map' -o -name '*.d.ts' -o -name '*.d.cts' \) -delete

printf '%s' "$SHA" > "$STAGE/VERSION"
printf '{"sha":"%s","builtAt":"%s","node":"%s"}\n' "$SHA" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$(node -v)" > "$STAGE/manifest.json"

tar -czf "$OUT/$SHA.tar.gz" -C "$STAGE" .
(cd "$OUT" && sha256sum "$SHA.tar.gz" > "$SHA.tar.gz.sha256")
echo "package-release: $OUT/$SHA.tar.gz ($(du -h "$OUT/$SHA.tar.gz" | cut -f1)), sha256 $(cut -d' ' -f1 "$OUT/$SHA.tar.gz.sha256")"
