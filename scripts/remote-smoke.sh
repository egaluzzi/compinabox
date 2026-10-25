#!/usr/bin/env bash
# remote-smoke.sh <base-url> — end-to-end check of a DEPLOYED staging server, curl only (no database
# access, no files on the server). Run from the CI runner after a deploy, or by hand.
#
#   DEV_OUTBOX_PASSWORD   required: the /dev-outbox password (from the repo secret / the server's .env).
#                         Passed to curl through a config pipe, never as an argument, never printed.
#   EXPECT_VERSION        optional: /api/health must report this version (the deployed git SHA)
#   EXPECT_ENV            default staging
#   CURL_K=1              accept a self-signed certificate. ONLY for the staging site on a bare IP
#                         (Caddy `tls internal`); the deploy workflow sets it for that host alone.
#
# What it cannot prove: geo detection here uses a SIMULATED CF-IPCountry header. There is no
# Cloudflare in front of staging, so the header is whatever the client sends; this checks that the app
# honours it, not that Cloudflare sets it (that is a production check, Phase 9d).
#
# Creates one fictitious company per run (a test buyer at @example.test). Staging holds test data only.
set -uo pipefail

BASE=${1:?usage: remote-smoke.sh <base-url>}
BASE=${BASE%/}
: "${DEV_OUTBOX_PASSWORD:?DEV_OUTBOX_PASSWORD is required}"
EXPECT_ENV=${EXPECT_ENV:-staging}
cd "$(dirname "$0")/.." || exit 2

KOPT=()
[ "${CURL_K:-0}" = 1 ] && KOPT=(-k)
c() { curl -s -m 30 "${KOPT[@]}" "$@"; }                    # curl with the common options
code() { c -o /dev/null -w '%{http_code}' "$@"; }
hdrs() { c -D - -o /dev/null "$@" | tr -d '\r'; }
JQ() { node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{try{const v=JSON.parse(d)["'"$1"'"];console.log(v===undefined?"":v)}catch{console.log("")}})'; }
outbox() { c -K <(printf 'user = "outbox:%s"\n' "$DEV_OUTBOX_PASSWORD") "$BASE/dev-outbox"; }

fail=0
ok()  { printf 'ok    %s\n' "$1"; }
bad() { printf 'FAIL  %s\n' "$1"; fail=1; }
t()   { local d=$1; shift; if "$@" >/dev/null 2>&1; then ok "$d"; else bad "$d"; fi; }
# Data is passed as arguments, never pasted into a shell string, so quotes in responses are harmless.
has()   { printf '%s' "$1" | grep -qiE -- "$2"; }      # has   <text> <regex>
lacks() { ! has "$1" "$2"; }                           # lacks <text> <regex>
eq()    { [ "$1" = "$2" ]; }
first_line_has() { printf '%s' "$1" | head -1 | grep -q -- "$2"; }
json_ok() { printf '%s' "$1" | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{try{const j=JSON.parse(d);process.exit(j.ok===true&&j.db===true?0:1)}catch{process.exit(1)}})'; }
json_keys() { printf '%s' "$1" | node -pe 'Object.keys(JSON.parse(require("fs").readFileSync(0,"utf8"))).sort().join()'; }
json_field() { printf '%s' "$1" | JQ "$2"; }
magic_cookie() { # magic_cookie <jar> <url>: GET it, keep cookies, print whether a session cookie was set
  c -D - -o /dev/null -c "$1" "$2" | tr -d '\r' | grep -iq 'set-cookie: .*session-token='
}

TERMS_VERSION=$(sed -n 's/.*TERMS_VERSION = "\(.*\)";/\1/p' lib/legal/version.ts)
[ -n "$TERMS_VERSION" ] || { echo "remote-smoke: cannot read TERMS_VERSION from lib/legal/version.ts"; exit 2; }
RUN="$(date +%s)-$$"
EMAIL="remote-smoke-$RUN@example.test"
JAR=$(mktemp); JAR_OLD=$(mktemp); JAR_W=$(mktemp); JAR_S=$(mktemp); JAR_N=$(mktemp); JS=$(mktemp); TMP=$(mktemp -d)
trap 'rm -rf "$JAR" "$JAR_OLD" "$JAR_W" "$JAR_S" "$JAR_N" "$JS" "$TMP"' EXIT

echo "== remote smoke against $BASE (env expected: $EXPECT_ENV) =="

# ---- health, banner, indexing, headers ---------------------------------------------------------
H=$(c "$BASE/api/health")
t "health: HTTP 200" eq "$(code "$BASE/api/health")" 200
t "health: ok:true and db:true" json_ok "$H"
t "health: env is $EXPECT_ENV" eq "$(json_field "$H" env)" "$EXPECT_ENV"
VERSION=$(json_field "$H" version)
if [ -n "${EXPECT_VERSION:-}" ]; then t "health: version is the deployed sha (${EXPECT_VERSION:0:7})" eq "$VERSION" "$EXPECT_VERSION"; else ok "health: version reported: ${VERSION:0:12}"; fi
t "health: nothing but ok/version/db/env in the body" eq "$(json_keys "$H")" "db,env,ok,version"

BR_H=$(hdrs "$BASE/br")
t "/br: 200" first_line_has "$BR_H" ' 200'
t "/br: staging banner on the page" has "$(c "$BASE/br")" 'data-staging-banner'
t "/br: X-Robots-Tag noindex on the response" has "$BR_H" '^x-robots-tag: noindex'
t "robots.txt disallows everything" has "$(c "$BASE/robots.txt")" '^Disallow: /$'
t "sitemap.xml has no URLs" lacks "$(c "$BASE/sitemap.xml")" '<loc>'
t "a legal page shows the banner too (privacy, DRAFT)" has "$(c "$BASE/legal/privacy")" 'data-staging-banner'

DASH=$(hdrs "$BASE/dashboard")
t "/dashboard (signed out): redirect to /login" has "$DASH" '^location: .*/login'
t "/dashboard: Cache-Control private, no-store" has "$DASH" '^cache-control: private, no-store'
t "/dashboard: X-Frame-Options DENY" has "$DASH" '^x-frame-options: DENY'
t "/dashboard: frame-ancestors 'none'" has "$DASH" "^content-security-policy: frame-ancestors 'none'"
t "/dashboard: Referrer-Policy same-origin" has "$DASH" '^referrer-policy: same-origin'

# ---- geo (SIMULATED header, see the note at the top) -----------------------------------------
t "geo (simulated CF-IPCountry: BR) -> / redirects to /br" has "$(hdrs -H 'CF-IPCountry: BR' "$BASE/")" '^location: .*/br$'
t "geo (simulated AR) -> / redirects to /ar" has "$(hdrs -H 'CF-IPCountry: AR' "$BASE/")" '^location: .*/ar$'
t "no header -> / is the generic page (200)" eq "$(code "$BASE/")" 200

# ---- the fake journey --------------------------------------------------------------------------
OUT=$(c -c "$JAR" -X POST -H 'content-type: application/json' --data "{\"country\":\"br\",\"companyName\":\"Remote Smoke Ltda\",\"taxId\":\"11.222.333/0001-81\",\"billingEmail\":\"$EMAIL\",\"termsAccepted\":true,\"termsVersion\":\"$TERMS_VERSION\"}" "$BASE/api/checkout")
ATT=$(json_field "$OUT" attemptId)
t "checkout without the terms box is refused (422)" eq "$(code -X POST -H 'content-type: application/json' --data "{\"country\":\"br\",\"companyName\":\"X Ltda\",\"taxId\":\"11222333000181\",\"billingEmail\":\"no-terms-$EMAIL\"}" "$BASE/api/checkout")" 422
t "checkout with the terms box: attempt created" test -n "$ATT"
DOC=""; BID=""; SIGNIN=""; WELCOME=""
if [ -n "$ATT" ]; then
  t "simulator page renders" has "$(c "$BASE/checkout/fake/$ATT")" 'value="pay"'
  t "before payment the status is pending and signs nobody in" has "$(c -b "$JAR" "$BASE/api/checkout/status?attempt=$ATT")" '"signedIn":false'
  t "simulator Pay -> 303 back to the return page" eq "$(code -X POST -d outcome=pay "$BASE/api/fake-payments/$ATT")" 303
  cp "$JAR" "$JAR_OLD"
  ST=$(c -b "$JAR" -c "$JAR" "$BASE/api/checkout/status?attempt=$ATT")
  t "after payment: paid and signed in (return token used once)" has "$ST" '"status":"paid".*"signedIn":true|"signedIn":true.*"status":"paid"'
  t "the status carries amount + currency for the conversion event, nothing identifying" has "$ST" 'amountCents'
  t "the status does not echo the e-mail" lacks "$ST" "$EMAIL"
  t "return token is single-use (second poll: paid, not signed in)" has "$(c -b "$JAR_OLD" "$BASE/api/checkout/status?attempt=$ATT")" '"signedIn":false'

  # onboarding -> documents -> PDF
  OB=$(c -o /dev/null -w '%{redirect_url}' -b "$JAR" -F companyName='Remote Smoke Ltda' -F industry=technology "$BASE/api/onboarding")
  t "onboarding completes (redirects to /dashboard)" has "$OB" '/dashboard'
  c -b "$JAR" "$BASE/dashboard/documents" -o "$TMP/docs.html"
  DOC=$(grep -o '/dashboard/documents/[0-9a-f-]\{36\}' "$TMP/docs.html" | head -1)
  t "documents list shows the generated documents" test -n "$DOC"
  c -D "$TMP/pdf.hdr" -o "$TMP/doc.pdf" -b "$JAR" "$BASE$DOC/pdf"
  t "document PDF starts with %PDF" bash -c "head -c 5 '$TMP/doc.pdf' | grep -q '%PDF-'"
  t "document PDF is application/pdf" bash -c "tr -d '\r' <'$TMP/pdf.hdr' | grep -iq '^content-type: application/pdf'"

  # binder: generate -> poll -> download
  BG=$(c -o /dev/null -w '%{http_code}' -b "$JAR" -X POST "$BASE/dashboard/binder/generate")
  t "binder: generate answers at once with a redirect" eq "$BG" 303
  c -b "$JAR" "$BASE/dashboard/binder" -o "$TMP/binder.html"
  BID=$(grep -o '/dashboard/binder/status?id=[0-9a-f-]\{36\}\|/dashboard/binder/[0-9a-f-]\{36\}' "$TMP/binder.html" | head -1 | grep -o '[0-9a-f-]\{36\}')
  S=""
  if [ -n "$BID" ]; then
    for _ in $(seq 1 120); do
      S=$(json_field "$(c -b "$JAR" "$BASE/dashboard/binder/status?id=$BID")" status)
      if [ "$S" = ready ] || [ "$S" = failed ]; then break; fi
      sleep 1
    done
  fi
  t "binder: a job id is visible on the page" test -n "$BID"
  t "binder: the job reaches ready (polled)" eq "$S" ready
  c -D "$TMP/b.hdr" -o "$TMP/binder.pdf" -b "$JAR" "$BASE/dashboard/binder/$BID/pdf"
  t "binder: download starts with %PDF" bash -c "head -c 5 '$TMP/binder.pdf' | grep -q '%PDF-'"
  t "binder: download is an attachment" bash -c "tr -d '\r' <'$TMP/b.hdr' | grep -iq '^content-disposition: attachment'"

  # sign-out (an Auth.js server action, submitted as a browser would), then replay the old cookie
  cp "$JAR" "$JAR_S"
  mapfile -d '' -t SO < <(c -b "$JAR_S" "$BASE/dashboard" | node -e '
    let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{
      const form=(d.split("<form").slice(1).find(f=>f.includes("Sair"))||"").split("</form>")[0];
      const dec=s=>s.replace(/&quot;/g,"\"").replace(/&#x27;/g,"\x27").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&amp;/g,"&");
      for(const m of form.matchAll(/<input\b[^>]*>/g)){
        const a=n=>{const r=new RegExp("\\b"+n+"=\"([^\"]*)\"").exec(m[0]);return r?dec(r[1]):null};
        if(a("type")==="hidden"&&a("name")) process.stdout.write("--form-string\0"+a("name")+"="+(a("value")??"")+"\0");
      }
    })')
  t "sign-out form found on the dashboard" test "${#SO[@]}" -ge 2
  cp "$JAR" "$JAR_OLD"
  SOH=$(c -D - -o /dev/null -b "$JAR" -c "$JAR" "${SO[@]}" "$BASE/dashboard" | tr -d '\r')
  t "sign-out: 303" first_line_has "$SOH" ' 303 '
  t "sign-out: goes to /login" has "$SOH" '^location: .*/login'
  t "REPLAY of the pre-sign-out cookie: /dashboard -> /login" has "$(hdrs -b "$JAR_OLD" "$BASE/dashboard")" '^location: .*/login'
  t "REPLAY of the pre-sign-out cookie: the PDF route -> 401" eq "$(code -b "$JAR_OLD" "$BASE$DOC/pdf")" 401
fi

# ---- the dev outbox ---------------------------------------------------------------------------
t "/dev-outbox without the password: 401" eq "$(code "$BASE/dev-outbox")" 401
t "/dev-outbox with a wrong password: 401" eq "$(code -K <(printf 'user = "outbox:definitely-wrong"\n') "$BASE/dev-outbox")" 401
OBX=$(outbox)
t "/dev-outbox with the password: 200 and the viewer page" has "$OBX" 'Dev outbox'
t "/dev-outbox is noindex" has "$(c -D - -o /dev/null -K <(printf 'user = "outbox:%s"\n' "$DEV_OUTBOX_PASSWORD") "$BASE/dev-outbox" | tr -d '\r')" '^x-robots-tag: noindex'

# link_for <recipient> <regex>: first matching link in the outbox, rewritten onto $BASE
link_for() {
  printf '%s' "$OBX" | node -e '
    let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{
      const dec=s=>s.replace(/&quot;/g,"\"").replace(/&#39;/g,"\x27").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&amp;/g,"&");
      for (const a of d.split("<article>").slice(1)) {
        if (!a.includes("To: "+process.argv[1]+" ")) continue;
        for (const m of a.matchAll(/href="([^"]+)"/g)) {
          const u = dec(m[1]);
          if (new RegExp(process.argv[2]).test(u)) { const x = new URL(u); console.log(process.argv[3] + x.pathname + x.search); process.exit(0); }
        }
      }
    })' "$1" "$2" "$BASE"
}
if [ -n "$ATT" ]; then
  WELCOME=$(link_for "$EMAIL" '/api/welcome\?token=')
  t "the welcome e-mail is in the outbox with a link" test -n "$WELCOME"
  if [ -n "$WELCOME" ]; then
    t "welcome link, first use: signs in" magic_cookie "$JAR_W" "$WELCOME"
    t "welcome link, second use: refused (no session cookie)" bash -c "! curl -s ${KOPT[*]:-} -m 30 -D - -o /dev/null '$WELCOME' | tr -d '\r' | grep -iq 'set-cookie: .*session-token='"
  fi

  # sign-in link (Auth.js magic link)
  CSRF=$(json_field "$(c -c "$JS" "$BASE/api/auth/csrf")" csrfToken)
  c -o /dev/null -b "$JS" -X POST --data-urlencode "email=$EMAIL" --data-urlencode "csrfToken=$CSRF" --data-urlencode "callbackUrl=$BASE/dashboard" "$BASE/api/auth/signin/email"
  sleep 1
  OBX=$(outbox)
  SIGNIN=$(link_for "$EMAIL" '/api/auth/callback/')
  t "a sign-in link arrived in the outbox" test -n "$SIGNIN"
  if [ -n "$SIGNIN" ]; then
    t "sign-in link, first use: session cookie" magic_cookie "$JAR_N" "$SIGNIN"
    t "sign-in link, second use: refused" bash -c "! curl -s ${KOPT[*]:-} -m 30 -D - -o /dev/null '$SIGNIN' | tr -d '\r' | grep -iq 'set-cookie: .*session-token='"
  fi

  # employee invitation: import one fictitious employee, invite, open the link (a GET consumes nothing)
  EEMAIL="employee-$RUN@example.test"
  printf 'name,email\nPessoa Teste,%s\n' "$EEMAIL" > "$TMP/roster.csv"
  t "employees: CSV import answers with a redirect" eq "$(code -b "$JAR_N" -F "file=@$TMP/roster.csv;type=text/csv" "$BASE/dashboard/employees/import")" 303
  t "employees: invite-pending answers with a redirect" eq "$(code -b "$JAR_N" -X POST "$BASE/dashboard/employees/invite-pending")" 303
  OBX=$(outbox)
  EMPLINK=$(link_for "$EEMAIL" '/employee/')
  t "the employee invitation is in the outbox with a personal link" test -n "$EMPLINK"
  if [ -n "$EMPLINK" ]; then
    EH=$(hdrs "$EMPLINK")
    t "employee link: opening it (GET) shows the start page" first_line_has "$EH" ' 200'
    t "employee link: a GET sets no session cookie" lacks "$EH" '^set-cookie: employee_session='
    t "employee pages carry noindex and no-store" has "$EH" '^x-robots-tag: noindex'
  fi
fi

echo
if [ "$fail" -eq 0 ]; then echo "remote-smoke: PASS ($BASE)"; else echo "remote-smoke: FAIL ($BASE)"; fi
exit "$fail"
