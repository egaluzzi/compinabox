#!/usr/bin/env bash
# check-ops-hygiene.sh — run by verify.sh (invariant 4m). Fails on:
#   * a shell script under ops/ or scripts/ that does not parse (bash -n);
#   * shellcheck warnings in them, when shellcheck is installed (otherwise it says "not installed");
#   * in ops/ and .github/: SSH host-key checking switched off or trust-on-first-use
#     (StrictHostKeyChecking no / off / accept-new), ssh-keyscan, a literal private-key header, or a
#     `changeme` placeholder (those belong in *.example files and tests only).
# HYGIENE_ROOT lets the check be shown failing on a planted tree.
set -uo pipefail
cd "${HYGIENE_ROOT:-$(dirname "$0")/..}" || exit 2

fail=0
bad() { printf 'FAIL  %s\n' "$1"; fail=1; }

mapfile -t SCRIPTS < <( { ls ops/*.sh ops/complystart-migrate scripts/*.sh 2>/dev/null; } | sort -u)
for f in "${SCRIPTS[@]}"; do
  bash -n "$f" 2>/tmp/hygiene-syntax.$$ || { cat /tmp/hygiene-syntax.$$; bad "$f does not parse"; }
done
rm -f /tmp/hygiene-syntax.$$
echo "bash -n: ${#SCRIPTS[@]} script(s) parsed"

# Lint level: warning for ops/ and the deploy-related scripts of phase 9; at error level for the
# older scripts (their existing warnings are not this check's business).
STRICT=()
LENIENT=()
for f in "${SCRIPTS[@]}"; do
  case "$f" in
    ops/*|scripts/backup.sh|scripts/restore-test.sh|scripts/package-release.sh|scripts/remote-smoke.sh|scripts/rehearse-deploy.sh|scripts/check-caddy-logs.sh|scripts/check-ops-hygiene.sh) STRICT+=("$f") ;;
    *) LENIENT+=("$f") ;;
  esac
done
if command -v shellcheck >/dev/null 2>&1; then
  if shellcheck -S warning "${STRICT[@]}" && shellcheck -S error "${LENIENT[@]}"; then echo "shellcheck: clean (${#STRICT[@]} at warning level, ${#LENIENT[@]} at error level)"; else bad "shellcheck reported problems"; fi
else
  echo "shellcheck: not installed (skipped)"
fi

SCAN=()
for d in ops .github; do [ -d "$d" ] && SCAN+=("$d"); done
if [ "${#SCAN[@]}" -gt 0 ]; then
  hits=$(grep -rnIE 'StrictHostKeyChecking[ =]+("?)(no|off|accept-new)|ssh-keyscan|-----BEGIN [A-Z ]*PRIVATE KEY-----' "${SCAN[@]}" 2>/dev/null || true)
  [ -z "$hits" ] || { echo "$hits"; bad "host-key checking weakened, ssh-keyscan, or a private key in ops/ or .github/"; }
  hits=$(grep -rnIi 'changeme' "${SCAN[@]}" 2>/dev/null | grep -v '\.example' || true)
  [ -z "$hits" ] || { echo "$hits"; bad "a changeme placeholder in ops/ or .github/"; }
fi
[ "$fail" -eq 0 ] && echo "ops hygiene: ok"
exit "$fail"
