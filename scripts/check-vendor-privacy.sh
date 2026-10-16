#!/usr/bin/env bash
# check-vendor-privacy.sh — the vendor-questionnaire invariant (phase 7), run by verify.sh. The
# public, tokenized vendor paths must not read request metadata or log anything: a vendor answering
# a compliance questionnaire is not identified by IP, browser or cookie. Same rule and pattern as
# check-anonymity.sh (comments count too). Scanned: the pages and handler (app/vendor), the form
# component, and the two lib files the public handler uses (submit.ts, answers.ts). The
# dashboard-side files in lib/vendors (invites, screen, queries) are tenant-gated and out of scope.
#
#   scripts/check-vendor-privacy.sh                  scans the default paths
#   VENDOR_PATHS="a b" scripts/check-vendor-privacy.sh   (used to show the check failing on a planted file)
set -uo pipefail
cd "$(dirname "$0")/.."
PATHS=${VENDOR_PATHS:-"app/vendor components/vendor lib/vendors/submit.ts lib/vendors/answers.ts"}
for p in $PATHS; do [ -e "$p" ] || { echo "check-vendor-privacy: FAIL — $p does not exist (a missing path must not pass silently)"; exit 1; }; done
PATTERN='headers\(|x-forwarded|cf-connecting|user-agent|\.ip\b|cookies\(|console\.|headers\.get'
HITS=$(grep -rnIiE "$PATTERN" $PATHS 2>/dev/null || true)
if [ -n "$HITS" ]; then
  echo "$HITS"
  echo "check-vendor-privacy: FAIL — request metadata or logging in the public vendor paths"
  exit 1
fi
echo "check-vendor-privacy: ok ($(echo $PATHS | wc -w) paths scanned, pattern: $PATTERN)"
