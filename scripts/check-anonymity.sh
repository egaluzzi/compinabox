#!/usr/bin/env bash
# check-anonymity.sh — the anonymous-reporting invariant (CLAUDE.md §8, SPEC §5.3/§11), run by
# verify.sh. The public whistleblower intake must not read request metadata or log anything:
# files under the scanned directories may not mention request headers, forwarded/client
# addresses, the browser identifier, cookies, or console output. Comments count too — they would
# only teach the next person where to start. Exit 1 with the offending lines on any hit.
#
#   scripts/check-anonymity.sh              scans the default directories
#   ANON_DIRS="a b" scripts/check-anonymity.sh   (used to show the check failing on a planted file)
set -uo pipefail
cd "$(dirname "$0")/.."
DIRS=${ANON_DIRS:-"app/report app/api/report lib/whistleblower"}
for d in $DIRS; do [ -d "$d" ] || { echo "check-anonymity: FAIL — $d does not exist (a missing directory must not pass silently)"; exit 1; }; done
PATTERN='headers\(|x-forwarded|cf-connecting|user-agent|\.ip\b|cookies\(|console\.'
HITS=$(grep -rnIiE "$PATTERN" $DIRS 2>/dev/null || true)
if [ -n "$HITS" ]; then
  echo "$HITS"
  echo "check-anonymity: FAIL — request metadata or logging in the anonymous intake paths"
  exit 1
fi
echo "check-anonymity: ok ($(echo $DIRS | wc -w) paths scanned, pattern: $PATTERN)"
