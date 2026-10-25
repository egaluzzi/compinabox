#!/usr/bin/env bash
# check-caddy-logs.sh <base-url> — proves what Caddy writes to its logs for the sensitive paths.
#
# Sends requests that carry CANARY secrets (in the path, the query, a cookie, X-Forwarded-For) to
# the site, then reads Caddy's log and fails if a canary appears anywhere, if the report channel
# left any trace, or if the redacted forms are missing (which would mean nothing was logged at
# all, and an empty log proves nothing).
#
#   LOG_SOURCE   journal (default: `journalctl -u caddy`, needs root or the adm group)
#                or file:/path/to/captured/stderr
#   CURL_K       1 (default) = accept the self-signed certificate of the staging site; this script is
#                only for that site.  CADDY_RESOLVE=host:port:addr is passed to curl --resolve.
#
# Read-only for the app: it only makes GET/POST requests that the app answers with 4xx/redirects.
# shellcheck disable=SC2015
set -uo pipefail

BASE=${1:?usage: check-caddy-logs.sh <base-url>}
BASE=${BASE%/}
LOG_SOURCE=${LOG_SOURCE:-journal}
RUN=$(date +%s)-$$
C_EMP="CANARYEMP${RUN}"
C_VEN="CANARYVEN${RUN}"
C_WEL="CANARYWEL${RUN}"
C_REP="CANARYREPORTSLUG${RUN}"
C_API="CANARYAPIREPORT${RUN}"
C_Q="CANARYQUERY${RUN}"
C_COOKIE="CANARYCOOKIE${RUN}"
C_XFF="203.0.113.77"

curl_args=(-s -o /dev/null -m 15)
[ "${CURL_K:-1}" = 1 ] && curl_args+=(-k)
[ -n "${CADDY_RESOLVE:-}" ] && curl_args+=(--resolve "$CADDY_RESOLVE")

since=$(date -u '+%Y-%m-%d %H:%M:%S')
curl "${curl_args[@]}" "$BASE/br?utm_source=${C_Q}"
curl "${curl_args[@]}" -H "Cookie: employee_session=${C_COOKIE}" "$BASE/employee/${C_EMP}/documents?x=${C_Q}"
curl "${curl_args[@]}" "$BASE/vendor/${C_VEN}?x=${C_Q}"
curl "${curl_args[@]}" "$BASE/api/welcome?token=${C_WEL}"
curl "${curl_args[@]}" -H "X-Forwarded-For: ${C_XFF}" "$BASE/report/${C_REP}?c=${C_Q}"
curl "${curl_args[@]}" -X POST -d x=1 "$BASE/api/report/${C_API}"
sleep 2

case "$LOG_SOURCE" in
  journal) LOG=$(journalctl -u caddy --since "$since" --no-pager -o cat 2>&1) ;;
  file:*)  LOG=$(cat "${LOG_SOURCE#file:}") ;;
  *) echo "check-caddy-logs: bad LOG_SOURCE" >&2; exit 2 ;;
esac

fail=0
ok()  { printf 'ok    %s\n' "$1"; }
bad() { printf 'FAIL  %s\n' "$1"; fail=1; }

for c in "$C_EMP" "$C_VEN" "$C_WEL" "$C_REP" "$C_API" "$C_Q" "$C_COOKIE" "$C_XFF"; do
  if printf '%s' "$LOG" | grep -q -- "$c"; then bad "canary $c appears in the Caddy log"; else ok "canary ${c%%"${RUN}"*}… absent from the log"; fi
done
printf '%s' "$LOG" | grep -q '"uri":"/br"' && ok '/br is logged with its query removed' || bad '/br line missing or still has its query (is Caddy logging at all?)'
printf '%s' "$LOG" | grep -q '"uri":"/employee/\[redacted\]"' && ok '/employee/… is logged as /employee/[redacted]' || bad '/employee/[redacted] line missing'
printf '%s' "$LOG" | grep -q '"uri":"/vendor/\[redacted\]"' && ok '/vendor/… is logged as /vendor/[redacted]' || bad '/vendor/[redacted] line missing'
printf '%s' "$LOG" | grep -q '"uri":"/api/welcome/\[redacted\]"' && ok '/api/welcome is logged as /api/welcome/[redacted]' || bad '/api/welcome/[redacted] line missing'
if printf '%s' "$LOG" | grep -qE '/report/|/api/report'; then bad 'the report channel left a trace in the log'; else ok 'no log line mentions /report or /api/report'; fi
[ "$fail" -eq 0 ] && echo "check-caddy-logs: PASS" || echo "check-caddy-logs: FAIL"
exit "$fail"
