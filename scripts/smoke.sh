#!/usr/bin/env bash
# smoke.sh — starts the standalone build on a free port and asserts the Phase 1
# definition-of-done checks. Run by verify.sh after `npm run build`; exits nonzero on any failure.
# Geo is exercised with simulated CF-IPCountry headers, not through Cloudflare.
set -uo pipefail

cd "$(dirname "$0")/.."
[ -f .next/standalone/server.js ] || { echo "smoke: .next/standalone/server.js missing — run npm run build"; exit 1; }

# The standalone output needs static assets next to server.js.
mkdir -p .next/standalone/.next
rm -rf .next/standalone/.next/static
cp -r .next/static .next/standalone/.next/static
[ -d public ] && { rm -rf .next/standalone/public; cp -r public .next/standalone/public; }

PORT=${PORT:-$(node -e 'const s=require("net").createServer().listen(0,()=>{console.log(s.address().port);s.close()})')}
export PORT HOSTNAME=127.0.0.1 ENABLED_COUNTRIES=br APP_URL="http://localhost:$PORT"
LOG=$(mktemp)
node .next/standalone/server.js >"$LOG" 2>&1 &
SERVER_PID=$!
trap 'kill $SERVER_PID 2>/dev/null; rm -f "$LOG"' EXIT

for _ in $(seq 1 60); do
  curl -s -o /dev/null "http://localhost:$PORT/" && break
  kill -0 $SERVER_PID 2>/dev/null || { echo "smoke: server exited early"; cat "$LOG"; exit 1; }
  sleep 0.5
done

B="http://localhost:$PORT"
fail=0
check() { # check "<description>" <command...>   (command run via bash -c; must exit 0)
  local desc=$1; shift
  if bash -c "$*" >/dev/null 2>&1; then printf 'ok    %s\n' "$desc"; else printf 'FAIL  %s\n' "$desc"; fail=1; fi
}

check "BR header -> redirect to /br" "curl -sI -H 'CF-IPCountry: BR' $B/ | grep -i 'location: .*/br'"
check "AR header -> redirect to /ar" "curl -sI -H 'CF-IPCountry: AR' $B/ | grep -i 'location: .*/ar'"
check "DE header -> 200 on /" "curl -sI -H 'CF-IPCountry: DE' $B/ | grep -E '^HTTP/.* 200'"
check "cookie country=mx beats BR header" "curl -sI -H 'CF-IPCountry: BR' -H 'Cookie: country=mx' $B/ | grep -i 'location: .*/mx'"
check "deep link /ar/pricing not redirected (200)" "curl -sI -H 'CF-IPCountry: BR' $B/ar/pricing | grep -E '^HTTP/.* 200'"
check "/ar carries noindex (disabled country)" "curl -s $B/ar | grep -i 'noindex'"
check "/br has no noindex (enabled country)" "[ \"\$(curl -s $B/br | grep -ic 'noindex')\" = 0 ]"
check "sitemap.xml has <loc> entries" "[ \"\$(curl -s $B/sitemap.xml | grep -o '<loc>' | wc -l)\" -gt 0 ]"
check "sitemap.xml excludes disabled /ar" "! curl -s $B/sitemap.xml | grep -q '/ar'"
check "cookie country=other + BR header -> 200, no redirect" "curl -sI -H 'CF-IPCountry: BR' -H 'Cookie: country=other' $B/ | grep -E '^HTTP/.* 200'"
check "redirect status is 307" "curl -sI -H 'CF-IPCountry: BR' $B/ | grep -E '^HTTP/.* 307'"
check "redirect carries cache-control: no-store" "curl -sI -H 'CF-IPCountry: BR' $B/ | grep -i '^cache-control: .*no-store'"
check "invalid country cookie ignored, header decides" "curl -sI -H 'CF-IPCountry: AR' -H 'Cookie: country=zz' $B/ | grep -i 'location: .*/ar'"
check "/checkout -> 200" "curl -sI $B/checkout | grep -E '^HTTP/.* 200'"
check "/legal/terms -> 200" "curl -sI $B/legal/terms | grep -E '^HTTP/.* 200'"
check "/zz -> 404" "curl -sI $B/zz | grep -E '^HTTP/.* 404'"
check "/pt-BR -> 404" "curl -sI $B/pt-BR | grep -E '^HTTP/.* 404'"
for d in /dashboard /employee /checkout /onboarding; do
  check "robots.txt disallows $d" "curl -s $B/robots.txt | grep -E '^Disallow: $d\$'"
done

# ENABLED_COUNTRIES is read at request time: the same build must serve a different value.
kill $SERVER_PID 2>/dev/null; wait $SERVER_PID 2>/dev/null
ENABLED_COUNTRIES=br,ar node .next/standalone/server.js >"$LOG" 2>&1 &
SERVER_PID=$!
for _ in $(seq 1 60); do curl -s -o /dev/null "$B/" && break; sleep 0.5; done
check "ENABLED_COUNTRIES=br,ar at runtime: /ar has no noindex" "[ \"\$(curl -s $B/ar | grep -ic 'noindex')\" = 0 ]"
check "ENABLED_COUNTRIES=br,ar at runtime: /mx still noindex" "curl -s $B/mx | grep -i 'noindex'"

[ "$fail" -eq 0 ] && echo "smoke: PASS (port $PORT)" || echo "smoke: FAIL (port $PORT)"
exit $fail
