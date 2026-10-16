#!/usr/bin/env bash
# screening-live-check.sh — ONE real call to the screening provider through the production client
# (lib/screening/opensanctions.ts), for a clearly sanctioned entity. Phase 7 is not accepted until
# this has run against the real service. Costs one screening.
#
#   SCREENING_API_KEY=... [SCREENING_BASE_URL=...] [SCREENING_DATASET=...] scripts/screening-live-check.sh
#
# Prints the outcome status, number of matches and the top match (caption, score, datasets) —
# never the API key and never the raw response body. Exit 0 only if the status is possible_match.
set -uo pipefail
cd "$(dirname "$0")/.."
if [ -z "${SCREENING_API_KEY:-}" ] || [ "$SCREENING_API_KEY" = changeme ]; then
  echo "screening-live-check: SCREENING_API_KEY is not set — refusing to run (nothing was sent)" >&2
  exit 2
fi
# A name that is on the sanctions lists by design: an entity designated by several authorities.
NAME=${SCREENING_CHECK_NAME:-"Wagner Group"}
echo "screening-live-check: base=${SCREENING_BASE_URL:-https://api.opensanctions.org} dataset=${SCREENING_DATASET:-default} name=\"$NAME\""
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --input-type=module -e '
import { getScreeningProvider } from "./lib/screening/index.ts";
const p = getScreeningProvider();
if (!p.available) { console.log("provider unavailable (key not recognised as configured)"); process.exit(2); }
let o;
try { o = await p.screen({ name: process.argv[1] }); }
catch (e) { console.log("provider refused to run: " + (e instanceof Error ? e.message : "error")); process.exit(2); }
if (o.status === "error") { console.log("HTTP-level outcome: error code=" + o.code); process.exit(1); }
console.log("HTTP-level outcome: 2xx, parsed as expected");
console.log("status:", o.status, "| dataset:", o.dataset, "| matches:", o.matches.length);
const m = o.matches[0];
if (m) console.log("top match: caption=" + JSON.stringify(m.caption) + " score=" + m.score + " datasets=" + m.datasets.join(",") + " topics=" + m.topics.join(","));
process.exit(o.status === "possible_match" ? 0 : 1);
' "$NAME"
