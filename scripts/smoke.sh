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

# ---------------------------------------------------------------------------------------------
# Phase 2: the live checkout flow — real Postgres, real HTTP through the standalone server,
# FAKE payment processor (no real payment processor is involved anywhere in this section).
# ---------------------------------------------------------------------------------------------
if [ -z "${DATABASE_URL:-}" ]; then
  echo "FAIL  DATABASE_URL is not set — the checkout flow needs a migrated Postgres (verify.sh sets it)"; fail=1
else
JQ() { node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{try{const v=JSON.parse(d)["'"$1"'"];console.log(v===undefined?"":v)}catch{console.log("")}})'; }
SQL() { psql "$DATABASE_URL" -Atc "$1"; }
SECRET=smoke-fake-secret-$(date +%s)-0123456789
ASEC=smoke-auth-secret-$(date +%s)-0123456789
OUTBOX=$(mktemp -d); UPLOADS=$(mktemp -d); JAR=$(mktemp); JAR_SAVED=$(mktemp); JAR2=$(mktemp)
EMAIL="smoke-$(date +%s)-$$@example.test"
UNKNOWN="ghost-$(date +%s)-$$@example.test"

export AUTH_SECRET=$ASEC
start_server() { # start_server [VAR=value ...]  (restarts the standalone server with a clean flow env)
  kill $SERVER_PID 2>/dev/null; wait $SERVER_PID 2>/dev/null
  env ENABLED_COUNTRIES=br AUTH_URL=$B EMAIL_DEV_SINK=true EMAIL_SINK_DIR=$OUTBOX \
      UPLOADS_DIR=$UPLOADS "$@" node .next/standalone/server.js >"$LOG" 2>&1 &
  SERVER_PID=$!
  for _ in $(seq 1 60); do curl -s -o /dev/null "$B/" && break; sleep 0.5; done
}
FAKE_ENV=(PAYMENT_PROVIDER=fake ALLOW_FAKE_PAYMENTS=true FAKE_PAYMENTS_SECRET=$SECRET)

# signed webhook helper: wh <attempt id> <status> <eventId> [ref secret] [signature secret]
wh() {
  local body sig
  body=$(node -e '
    const c=require("crypto"),[id,status,ev,rs,ss]=process.argv.slice(1);
    const b=Buffer.from(JSON.stringify({attemptId:id,amountCents:1000,currency:"BRL",status})).toString("base64url");
    const ref=b+"."+c.createHmac("sha256",rs).update(b).digest("hex");
    process.stdout.write(JSON.stringify({eventId:ev,paymentRef:ref}))' "$1" "$2" "$3" "${4:-$SECRET}" )
  sig=$(printf '%s' "$body" | openssl dgst -sha256 -hmac "${5:-$SECRET}" | awk '{print $NF}')
  curl -s -o /tmp/wh.out -w '%{http_code}' -X POST -H "content-type: application/json" -H "x-fake-signature: $sig" --data "$body" "$B/api/webhooks/payments"
}

export -f wh SQL
export B SECRET
start_server "${FAKE_ENV[@]}"
check "/checkout?c=br shows the form and the TEST PRICE label" "curl -s '$B/checkout?c=br' | grep -q 'name=\"companyName\"' && curl -s '$B/checkout?c=br' | grep -q 'PREÇO DE TESTE'"
check "/checkout?c=ar refused (not in ENABLED_COUNTRIES): no form" "! curl -s '$B/checkout?c=ar' | grep -q 'name=\"companyName\"'"
check "/dashboard without a session redirects to /login" "curl -sI $B/dashboard | grep -iE '^location: .*/login'"
check "/onboarding without a session redirects to /login" "curl -sI $B/onboarding | grep -iE '^location: .*/login'"

R=$(curl -s -c "$JAR" -X POST -H 'content-type: application/json' --data "{\"country\":\"br\",\"companyName\":\"Smoke Ltda\",\"taxId\":\"11.222.333/0001-81\",\"billingEmail\":\"$EMAIL\"}" "$B/api/checkout")
ATT=$(echo "$R" | JQ attemptId); REDIR=$(echo "$R" | JQ redirectUrl)
check "POST /api/checkout -> attempt id + hosted-checkout URL" "[ -n '$ATT' ] && echo '$REDIR' | grep -q '/checkout/fake/$ATT'"
check "return_token cookie is httpOnly" "grep -q '#HttpOnly_.*return_token' '$JAR'"
check "DB: attempt is pending, 0 companies for that email" "[ \"\$(psql \"$DATABASE_URL\" -Atc \"select status from checkout_attempt where id='$ATT'\")\" = pending ] && [ \"\$(psql \"$DATABASE_URL\" -Atc \"select count(*) from users where email='$EMAIL'\")\" = 0 ]"
check "invalid CNPJ -> 422 invalid_tax_id" "curl -s -X POST -H 'content-type: application/json' --data '{\"country\":\"br\",\"companyName\":\"X Ltda\",\"taxId\":\"11222333000182\",\"billingEmail\":\"bad-$EMAIL\"}' $B/api/checkout | grep -q invalid_tax_id"
check "simulator page renders Pay/Fail buttons" "curl -s $B/checkout/fake/$ATT | grep -q 'value=\"pay\"'"

# return URL alone never provisions
curl -s -o /dev/null "$B/checkout/return?attempt=$ATT"
curl -s -b "$JAR" "$B/api/checkout/status?attempt=$ATT" -o /tmp/st.out
check "return page + status poll before payment: still pending, nothing provisioned" "grep -q '\"status\":\"pending\"' /tmp/st.out && [ \"\$(psql \"$DATABASE_URL\" -Atc \"select count(*) from users where email='$EMAIL'\")\" = 0 ]"

# attacker-style webhooks first: nothing may be provisioned
check "bad signature -> 401" "[ \"\$(wh $ATT paid ev-bad-$$ $SECRET wrong-secret)\" = 401 ]"
check "valid signature but forged payment ref (processor does not confirm) -> 422" "[ \"\$(wh $ATT paid ev-forged-$$ attacker-secret)\" = 422 ]"
check "processor says pending -> nothing provisioned" "[ \"\$(wh $ATT pending ev-pend-$$)\" = 200 ] && [ \"\$(psql \"$DATABASE_URL\" -Atc \"select count(*) from users where email='$EMAIL'\")\" = 0 ]"

# the simulator's Pay button -> signed webhook -> real endpoint -> provisioning
CODE=$(curl -s -o /dev/null -w '%{http_code} %{redirect_url}' -X POST -d 'outcome=pay' "$B/api/fake-payments/$ATT")
check "simulator Pay -> 303 back to /checkout/return" "echo '$CODE' | grep -q \"^303 .*/checkout/return?attempt=$ATT\""
check "DB: attempt paid, 1 admin user, 1 company, 1 billing record" "[ \"\$(psql \"$DATABASE_URL\" -Atc \"select status from checkout_attempt where id='$ATT'\")\" = paid ] && [ \"\$(psql \"$DATABASE_URL\" -Atc \"select count(*) from users where email='$EMAIL' and role='admin'\")\" = 1 ] && [ \"\$(psql \"$DATABASE_URL\" -Atc \"select count(*) from billing_records b join users u on u.company_id=b.company_id where u.email='$EMAIL'\")\" = 1 ]"

# replay: same signed event twice more -> still one company
EV=ev-replay-$$
check "replayed webhook (new event, already paid) -> 200, no second company" "[ \"\$(wh $ATT paid $EV)\" = 200 ] && [ \"\$(wh $ATT paid $EV)\" = 200 ] && [ \"\$(psql \"$DATABASE_URL\" -Atc \"select count(*) from users where email='$EMAIL'\")\" = 1 ]"
check "payment_event ledger has the replayed event exactly once" "[ \"\$(SQL \"select count(*) from payment_event where event_key='fake:$EV'\")\" = 1 ]"

# the return page resolves to paid and signs the buyer in, once
cp "$JAR" "$JAR_SAVED"
curl -s -b "$JAR" -c "$JAR" "$B/api/checkout/status?attempt=$ATT" -o /tmp/st.out
check "status poll after payment: paid + signed in (session cookie issued)" "grep -q '\"status\":\"paid\"' /tmp/st.out && grep -q '\"signedIn\":true' /tmp/st.out && grep -q 'authjs.session-token' '$JAR'"
check "/onboarding reachable with that session" "curl -s -o /dev/null -w '%{http_code}' -b '$JAR' $B/onboarding | grep -q 200"
curl -s -b "$JAR_SAVED" "$B/api/checkout/status?attempt=$ATT" -o /tmp/st.out
check "return token is single-use: reuse -> paid but NOT signed in" "grep -q '\"status\":\"paid\"' /tmp/st.out && grep -q '\"signedIn\":false' /tmp/st.out"
check "no cookie at all -> paid but NOT signed in" "curl -s '$B/api/checkout/status?attempt=$ATT' | grep -q '\"signedIn\":false'"

# welcome email: single-use link
WLINK=$(node -e 'const fs=require("fs"),d=process.argv[1];for(const f of fs.readdirSync(d)){const m=JSON.parse(fs.readFileSync(d+"/"+f,"utf8"));if(m.to===process.argv[2]&&/welcome/.test(m.text)){console.log(m.text.match(/https?:\/\/\S+/)[0])}}' "$OUTBOX" "$EMAIL" | head -1)
check "welcome email landed in the dev outbox with a link" "echo '$WLINK' | grep -q '/api/welcome?token='"
check "welcome link: first use signs in (303 -> /onboarding + session cookie)" "curl -s -D - -o /dev/null '$WLINK' | tr -d '\r' | grep -iE '^(location: .*/onboarding|set-cookie: authjs.session-token=)' | wc -l | grep -q 2"
check "welcome link: second use is refused (-> /login?error)" "curl -s -D - -o /dev/null '$WLINK' | tr -d '\r' | grep -iE '^location: .*/login\\?error'"

# Auth.js sign-in link: known email gets a link, unknown gets the same response and nothing
signin() { # signin <email> -> prints "<status> <location>"
  local jar; jar=$(mktemp)
  local tok; tok=$(curl -s -c "$jar" "$B/api/auth/csrf" | JQ csrfToken)
  curl -s -o /dev/null -w '%{http_code} %{redirect_url}' -b "$jar" -X POST --data-urlencode "email=$1" --data-urlencode "csrfToken=$tok" --data-urlencode "callbackUrl=$B/dashboard" "$B/api/auth/signin/email"
  rm -f "$jar"
}
KNOWN_RESP=$(signin "$EMAIL"); UNKNOWN_RESP=$(signin "$UNKNOWN")
check "sign-in: known and unknown emails get the identical response" "[ '$KNOWN_RESP' = '$UNKNOWN_RESP' ]"
SLINK=$(node -e 'const fs=require("fs"),d=process.argv[1];let out="";for(const f of fs.readdirSync(d).sort()){const m=JSON.parse(fs.readFileSync(d+"/"+f,"utf8"));if(m.to===process.argv[2]&&/callback/.test(m.text))out=m.text.match(/https?:\/\/\S+/)[0]}console.log(out)' "$OUTBOX" "$EMAIL")
check "sign-in: link emailed to the known address only" "[ -n '$SLINK' ] && ! grep -rl '$UNKNOWN' '$OUTBOX' >/dev/null"
check "sign-in link: first use sets a session" "curl -s -D - -o /dev/null -c '$JAR2' '$SLINK' | tr -d '\r' | grep -iq 'set-cookie: authjs.session-token='"
check "sign-in link: second use is refused" "! curl -s -D - -o /dev/null '$SLINK' | tr -d '\r' | grep -iq 'set-cookie: authjs.session-token='"
check "/dashboard with the sign-in session redirects to /onboarding (profile incomplete)" "curl -s -D - -o /dev/null -b '$JAR2' $B/dashboard | tr -d '\r' | grep -iE '^location: .*/onboarding'"

# onboarding + upload
PNG=$(mktemp --suffix=.png); printf '\x89PNG\r\n\x1a\n\0\0\0\rIHDR' > "$PNG"
SVG=$(mktemp --suffix=.png); printf '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>' > "$SVG"
OTHER=$(SQL "select id from companies where id <> (select company_id from users where email='$EMAIL') limit 1")
check "onboarding with an SVG disguised as .png is rejected (error=logo)" "curl -s -o /dev/null -w '%{redirect_url}' -b '$JAR2' -F companyName='Smoke Ltda' -F industry=technology -F 'logo=@$SVG;type=image/png' $B/api/onboarding | grep -q 'error=logo'"
check "onboarding with a PNG saves it, ignoring a foreign company id" "curl -s -o /dev/null -w '%{redirect_url}' -b '$JAR2' -F companyName='Smoke Renamed' -F industry=technology -F companyId=$OTHER -F 'logo=@$PNG;type=image/png' $B/api/onboarding | grep -q '/dashboard'"
check "DB: only the session's company was renamed" "[ \"\$(SQL \"select name from companies where id=(select company_id from users where email='$EMAIL')\")\" = 'Smoke Renamed' ] && [ \"\$(SQL \"select count(*) from companies where id='$OTHER' and name='Smoke Renamed'\")\" = 0 ]"
LOGO=$(SQL "select logo_file from companies where id=(select company_id from users where email='$EMAIL')")
check "uploaded logo served with fixed content-type + nosniff" "curl -sI $B/uploads/$LOGO | tr -d '\r' | grep -iq '^content-type: image/png' && curl -sI $B/uploads/$LOGO | tr -d '\r' | grep -iq '^x-content-type-options: nosniff'"
check "/dashboard now loads for the signed-in admin" "curl -s -o /dev/null -w '%{http_code}' -b '$JAR2' $B/dashboard | grep -q 200"

# ---------------------------------------------------------------------------------------------
# Phase 3: documents — generated at onboarding completion, viewed, exported to PDF, versioned,
# tenant-isolated, append-only in the database. Real Postgres + real HTTP + real PDF rendering.
# (The logo uploaded above is a deliberately undecodable PNG stub: the PDF must still render.)
# ---------------------------------------------------------------------------------------------
CID=$(SQL "select company_id from users where email='$EMAIL'")
DOC1=$(SQL "select id from documents where company_id='$CID' and type='code_of_conduct' and version=1")
check "onboarding created the six documents, all version 1" "[ \"\$(SQL \"select count(*) from documents where company_id='$CID' and version=1\")\" = 6 ] && [ \"\$(SQL \"select count(distinct type) from documents where company_id='$CID'\")\" = 6 ]"
check "documents list -> 200 and links the code of conduct" "[ \"\$(curl -s -o /dev/null -w '%{http_code}' -b '$JAR2' $B/dashboard/documents)\" = 200 ] && curl -s -b '$JAR2' $B/dashboard/documents | grep -q '/dashboard/documents/$DOC1'"
check "document view -> 200 with title and company name" "curl -s -b '$JAR2' $B/dashboard/documents/$DOC1 | grep -q 'Código de Conduta' && curl -s -b '$JAR2' $B/dashboard/documents/$DOC1 | grep -q 'Smoke Renamed'"
curl -s -D /tmp/pdf.hdr -o /tmp/doc1.pdf -b "$JAR2" "$B/dashboard/documents/$DOC1/pdf"
check "PDF download: %PDF body, application/pdf, attachment with ASCII filename, no-store" "head -c 5 /tmp/doc1.pdf | grep -q '%PDF-' && tr -d '\r' </tmp/pdf.hdr | grep -iq '^content-type: application/pdf' && tr -d '\r' </tmp/pdf.hdr | grep -iqE '^content-disposition: attachment; filename=\"[a-z0-9-]+\.pdf\"' && tr -d '\r' </tmp/pdf.hdr | grep -iq '^cache-control: no-store'"
check "PDF logs the unusable logo once and still renders (stub logo)" "grep -c 'is missing or unreadable' '$LOG' | grep -q '^1\$'"
check "documents routes without a session: view -> /login, PDF -> 401" "curl -s -D - -o /dev/null $B/dashboard/documents/$DOC1 | tr -d '\r' | grep -iqE '^location: .*/login' && [ \"\$(curl -s -o /dev/null -w '%{http_code}' $B/dashboard/documents/$DOC1/pdf)\" = 401 ]"

# a second company's session must get 404 (not 403, not the content) for the first company's document
JAR3=$(mktemp)
EMAIL3="smoke3-$(date +%s)-$$@example.test"
R3=$(curl -s -c "$JAR3" -X POST -H 'content-type: application/json' --data "{\"country\":\"br\",\"companyName\":\"Other Ltda\",\"taxId\":\"11222333000181\",\"billingEmail\":\"$EMAIL3\"}" "$B/api/checkout"); ATT3=$(echo "$R3" | JQ attemptId)
curl -s -o /dev/null -X POST -d 'outcome=pay' "$B/api/fake-payments/$ATT3"
curl -s -b "$JAR3" -c "$JAR3" "$B/api/checkout/status?attempt=$ATT3" -o /tmp/st3.out
check "second company is provisioned and signed in" "grep -q '\"signedIn\":true' /tmp/st3.out"
# the dashboard gate requires completed onboarding; finish it so the 404 checks below test tenant isolation, not the gate
check "second company completes onboarding" "curl -s -o /dev/null -w '%{redirect_url}' -b '$JAR3' -F companyName='Other Ltda' -F industry=retail $B/api/onboarding | grep -q '/dashboard'"
check "second company: first company's document view -> 404" "[ \"\$(curl -s -o /dev/null -w '%{http_code}' -b '$JAR3' $B/dashboard/documents/$DOC1)\" = 404 ]"
check "second company: first company's document PDF -> 404" "[ \"\$(curl -s -o /dev/null -w '%{http_code}' -b '$JAR3' $B/dashboard/documents/$DOC1/pdf)\" = 404 ]"
check "second company: malformed document id -> 404" "[ \"\$(curl -s -o /dev/null -w '%{http_code}' -b '$JAR3' $B/dashboard/documents/not-a-uuid/pdf)\" = 404 ]"

# regenerate: unchanged -> nothing new; renamed company -> v2 for all six, v1 still readable and unchanged
check "regenerate with unchanged inputs creates nothing" "curl -s -o /dev/null -w '%{redirect_url}' -b '$JAR2' -F type=all $B/api/documents/regenerate | grep -q 'regenerated=unchanged' && [ \"\$(SQL \"select count(*) from documents where company_id='$CID'\")\" = 6 ]"
V1_SUM=$(SQL "select md5(content) from documents where id='$DOC1'")
check "rename the company via onboarding: documents untouched until regenerated" "curl -s -o /dev/null -w '%{redirect_url}' -b '$JAR2' -F companyName='Smoke Renamed Again' -F industry=technology $B/api/onboarding | grep -q '/dashboard' && [ \"\$(SQL \"select count(*) from documents where company_id='$CID'\")\" = 6 ]"
check "regenerate after the rename creates v2 for all six" "curl -s -o /dev/null -w '%{redirect_url}' -b '$JAR2' -F type=all $B/api/documents/regenerate | grep -q 'regenerated=created' && [ \"\$(SQL \"select count(*) from documents where company_id='$CID' and version=2\")\" = 6 ] && [ \"\$(SQL \"select count(*) from documents where company_id='$CID'\")\" = 12 ]"
check "v1 is intact: same content in the database, still viewable with the old name" "[ \"\$(SQL \"select md5(content) from documents where id='$DOC1'\")\" = '$V1_SUM' ] && curl -s -b '$JAR2' $B/dashboard/documents/$DOC1 | grep -o '<article.*</article>' | grep -q 'Smoke Renamed' && ! curl -s -b '$JAR2' $B/dashboard/documents/$DOC1 | grep -o '<article.*</article>' | grep -q 'Renamed Again'"
DOC2=$(SQL "select id from documents where company_id='$CID' and type='code_of_conduct' and version=2")
check "v2 carries the new name" "curl -s -b '$JAR2' $B/dashboard/documents/$DOC2 | grep -q 'Smoke Renamed Again'"
check "regenerate: bad type -> 400, no session -> 401" "[ \"\$(curl -s -o /dev/null -w '%{http_code}' -b '$JAR2' -F type=nope $B/api/documents/regenerate)\" = 400 ] && [ \"\$(curl -s -o /dev/null -w '%{http_code}' -F type=all $B/api/documents/regenerate)\" = 401 ]"
check "database: direct UPDATE of a document is rejected (append-only trigger)" "OUT=\$(psql '$DATABASE_URL' -qc \"update documents set content='x' where id='$DOC1'\" 2>&1); [ \$? -ne 0 ] && echo \"\$OUT\" | grep -q 'append-only' && [ \"\$(SQL \"select md5(content) from documents where id='$DOC1'\")\" = '$V1_SUM' ]"
check "database: direct DELETE of a document is rejected (append-only trigger)" "OUT=\$(psql '$DATABASE_URL' -qc \"delete from documents where id='$DOC1'\" 2>&1); [ \$? -ne 0 ] && echo \"\$OUT\" | grep -q 'append-only' && [ \"\$(SQL \"select count(*) from documents where id='$DOC1'\")\" = 1 ]"
# ---------------------------------------------------------------------------------------------
# Phase 4: the dashboard shell — eight sections behind one gate, tenant isolation across every
# section, security headers, Settings, sign-out. Real Postgres, real HTTP, real session cookies.
# Company 1 = "$EMAIL" (JAR2), company 2 = "Other Ltda" (JAR3).
# ---------------------------------------------------------------------------------------------
C2=$(SQL "select company_id from users where email='$EMAIL3'")
# distinctive payments so a leak between the two companies is unmistakable (R$ 76.543,21 / R$ 12.345,67)
SQL "insert into billing_records (company_id, amount_cents, currency, paid_at) values ('$CID', 7654321, 'BRL', now()), ('$C2', 1234567, 'BRL', now())" >/dev/null
NAME1=$(SQL "select name from companies where id='$CID'")
SECTIONS="'' documents employees training whistleblower vendors billing settings"
dash() { case "$1" in "") echo "$B/dashboard";; *) echo "$B/dashboard/$1";; esac; }

for s in $SECTIONS; do
  s=${s//\'/}
  U=$(dash "$s")
  check "dashboard/${s:-overview}: signed in -> 200 with the main nav and all eight section links" "[ \"\$(curl -s -o /dev/null -w '%{http_code}' -b '$JAR2' $U)\" = 200 ] && H=\$(curl -s -b '$JAR2' $U) && echo \"\$H\" | grep -q 'aria-label=\"Navegação principal\"' && echo \"\$H\" | grep -q '<main id=\"main\"' && for p in '' /documents /employees /training /whistleblower /vendors /billing /settings; do echo \"\$H\" | grep -q \"href=\\\"/dashboard\$p\\\"\" || exit 1; done"
  check "dashboard/${s:-overview}: marks itself aria-current=\"page\"" "curl -s -b '$JAR2' $U | grep -oE '<a [^>]*aria-current=\"page\"[^>]*>' | grep -q 'href=\"/dashboard${s:+/$s}\"'"
  check "dashboard/${s:-overview}: no session -> redirect to /login" "curl -s -D - -o /dev/null $U | tr -d '\r' | grep -iqE '^location: .*/login'"
  check "dashboard/${s:-overview}: company 2 never sees company 1's name, payment or document id" "H=\$(curl -s -b '$JAR3' $U) && ! echo \"\$H\" | grep -q '$NAME1' && ! echo \"\$H\" | grep -q '76.543,21' && ! echo \"\$H\" | grep -q '$DOC1'"
  check "dashboard/${s:-overview}: company 1 never sees company 2's name or payment" "H=\$(curl -s -b '$JAR2' $U) && ! echo \"\$H\" | grep -q 'Other Ltda' && ! echo \"\$H\" | grep -q '12.345,67'"
done
check "billing: each company sees its own payment, formatted pt-BR" "curl -s -b '$JAR2' $B/dashboard/billing | grep -q '76.543,21' && curl -s -b '$JAR3' $B/dashboard/billing | grep -q '12.345,67'"
check "overview: counts come from the session's company (0 employees, 0 open cases)" "H=\$(curl -s -b '$JAR2' $B/dashboard) && echo \"\$H\" | grep -q 'Nenhum colaborador ainda' && echo \"\$H\" | grep -q 'Nenhuma denúncia em aberto' && echo \"\$H\" | grep -q '6 de 6 documentos gerados'"
check "documents list: draft status shown next to the documents" "[ \"\$(curl -s -b '$JAR2' $B/dashboard/documents | grep -o 'RASCUNHO' | wc -l)\" -ge 12 ]"
check "document pages: no session -> /login; company 2 -> 404 (unchanged inside the shell)" "curl -s -D - -o /dev/null $B/dashboard/documents/$DOC1 | tr -d '\r' | grep -iqE '^location: .*/login' && [ \"\$(curl -s -o /dev/null -w '%{http_code}' -b '$JAR3' $B/dashboard/documents/$DOC1)\" = 404 ]"

# security headers, live, on every authenticated surface
for u in /dashboard /dashboard/settings /dashboard/documents /onboarding /login; do
  check "headers on $u: private no-store, frame-ancestors 'none', X-Frame-Options DENY, Referrer-Policy same-origin" "H=\$(curl -s -D - -o /dev/null -b '$JAR2' $B$u | tr -d '\r') && echo \"\$H\" | grep -iq '^cache-control: private, no-store' && echo \"\$H\" | grep -iq \"^content-security-policy: frame-ancestors 'none'\" && echo \"\$H\" | grep -iq '^x-frame-options: DENY' && echo \"\$H\" | grep -iq '^referrer-policy: same-origin'"
done
check "PDF keeps its own Cache-Control: no-store" "curl -s -D - -o /dev/null -b '$JAR2' $B/dashboard/documents/$DOC1/pdf | tr -d '\r' | grep -iq '^cache-control: no-store'"

# Settings: rename + new logo, onboarding_completed_at and documents untouched, foreign company id ignored
OLDLOGO=$(SQL "select logo_file from companies where id='$CID'")
ONB_BEFORE=$(SQL "select extract(epoch from onboarding_completed_at) from companies where id='$CID'")
C2NAME=$(SQL "select name from companies where id='$C2'")
REAL_PNG=tests/fixtures/logo.png
check "settings: no session -> 401" "[ \"\$(curl -s -o /dev/null -w '%{http_code}' -F companyName='Nope Ltda' -F industry=retail $B/dashboard/settings/save)\" = 401 ]"
check "settings: SVG disguised as PNG -> error=logo, nothing changed" "curl -s -o /dev/null -w '%{redirect_url}' -b '$JAR2' -F companyName='Smoke Settings Ltda' -F industry=retail -F 'logo=@$SVG;type=image/png' $B/dashboard/settings/save | grep -q 'error=logo' && [ \"\$(SQL \"select name from companies where id='$CID'\")\" = '$NAME1' ]"
check "settings: save -> 303 to ?saved=1" "curl -s -o /dev/null -w '%{redirect_url}' -b '$JAR2' -F companyName='Smoke Settings Ltda' -F industry=retail -F companyId=$C2 -F company_id=$C2 -F 'logo=@$REAL_PNG;type=image/png' $B/dashboard/settings/save | grep -q '/dashboard/settings?saved=1'"
NEWLOGO=$(SQL "select logo_file from companies where id='$CID'")
check "settings: DB has the new name, industry and a new logo file" "[ \"\$(SQL \"select name from companies where id='$CID'\")\" = 'Smoke Settings Ltda' ] && [ \"\$(SQL \"select industry from companies where id='$CID'\")\" = retail ] && [ -n '$NEWLOGO' ] && [ '$NEWLOGO' != '$OLDLOGO' ]"
check "settings: onboarding_completed_at is intact" "[ \"\$(SQL \"select extract(epoch from onboarding_completed_at) from companies where id='$CID'\")\" = '$ONB_BEFORE' ]"
check "settings: company 2 untouched by the posted company id" "[ \"\$(SQL \"select name from companies where id='$C2'\")\" = '$C2NAME' ]"
check "settings: saving regenerated nothing (still 12 documents)" "[ \"\$(SQL \"select count(*) from documents where company_id='$CID'\")\" = 12 ]"
check "settings: old logo file is kept on disk" "[ -f '$UPLOADS/$OLDLOGO' ]"
check "settings: page shows the new logo and the not-regenerated notice linking to Documents" "H=\$(curl -s -b '$JAR2' '$B/dashboard/settings?saved=1') && echo \"\$H\" | grep -q '/uploads/$NEWLOGO' && echo \"\$H\" | grep -q 'não são regenerados automaticamente' && echo \"\$H\" | grep -q 'href=\"/dashboard/documents\"'"
check "settings: header shows the new name, tax id and admin email are read-only text" "H=\$(curl -s -b '$JAR2' $B/dashboard/settings) && echo \"\$H\" | grep -q 'Smoke Settings Ltda' && echo \"\$H\" | grep -q '$EMAIL' && ! echo \"\$H\" | grep -q 'name=\"taxId\"' && ! echo \"\$H\" | grep -q 'name=\"email\"'"
check "audit trail: v1 document view still carries the name it was generated with (PDF: tests/dashboard-audit)" "A=\$(curl -s -b '$JAR2' $B/dashboard/documents/$DOC1 | grep -o '<article.*</article>') && echo \"\$A\" | grep -q 'Smoke Renamed' && ! echo \"\$A\" | grep -q 'Smoke Settings'"

# Sign-out: the header form is an Auth.js server action; submit it exactly as a browser would
JAR4=$(mktemp); cp "$JAR2" "$JAR4"
JAR_OLD=$(mktemp); cp "$JAR2" "$JAR_OLD" # the cookie as it was BEFORE sign-out: replayed below
mapfile -d '' -t SO_ARGS < <(curl -s -b "$JAR4" "$B/dashboard" | node -e '
  let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{
    const form=(d.split("<form").slice(1).find(f=>f.includes("Sair"))||"").split("</form>")[0];
    const dec=s=>s.replace(/&quot;/g,"\"").replace(/&#x27;/g,"\x27").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&amp;/g,"&");
    for(const m of form.matchAll(/<input\b[^>]*>/g)){
      const a=n=>{const r=new RegExp("\\b"+n+"=\"([^\"]*)\"").exec(m[0]);return r?dec(r[1]):null};
      if(a("type")==="hidden"&&a("name")) process.stdout.write("--form-string\0"+a("name")+"="+(a("value")??"")+"\0");
    }
  })')
check "sign-out form carries a server action (hidden action fields found)" "[ ${#SO_ARGS[@]} -ge 2 ]"
check "before sign-out the copied session reaches the dashboard" "[ \"\$(curl -s -o /dev/null -w '%{http_code}' -b '$JAR4' $B/dashboard)\" = 200 ]"
SO_HDR=$(mktemp)
curl -s -D - -o /dev/null -b "$JAR4" -c "$JAR4" "${SO_ARGS[@]}" "$B/dashboard" | tr -d '\r' >"$SO_HDR"
check "sign-out action: 303 to /login" "head -1 '$SO_HDR' | grep -q ' 303 ' && grep -iqE '^location: .*/login' '$SO_HDR'"
check "sign-out action: session cookie is cleared" "! grep -q 'authjs.session-token.*[A-Za-z0-9_-]\\{40,\\}' '$JAR4'"
check "after sign-out: /dashboard redirects to /login" "curl -s -D - -o /dev/null -b '$JAR4' $B/dashboard | tr -d '\r' | grep -iqE '^location: .*/login'"
check "after sign-out: a section and the PDF route are refused too" "curl -s -D - -o /dev/null -b '$JAR4' $B/dashboard/billing | tr -d '\r' | grep -iqE '^location: .*/login' && [ \"\$(curl -s -o /dev/null -w '%{http_code}' -b '$JAR4' $B/dashboard/documents/$DOC1/pdf)\" = 401 ]"
# Phase 4b: sign-out is server-side. The cookie copied before sign-out must now be refused everywhere.
code() { curl -s -o /dev/null -w '%{http_code}' "$@"; }
check "REPLAY pre-sign-out cookie: /dashboard -> /login" "curl -s -D - -o /dev/null -b '$JAR_OLD' $B/dashboard | tr -d '\r' | grep -iqE '^location: .*/login'"
check "REPLAY pre-sign-out cookie: /dashboard/billing -> /login" "curl -s -D - -o /dev/null -b '$JAR_OLD' $B/dashboard/billing | tr -d '\r' | grep -iqE '^location: .*/login'"
check "REPLAY pre-sign-out cookie: PDF route -> 401" "[ \"\$(code -b '$JAR_OLD' $B/dashboard/documents/$DOC1/pdf)\" = 401 ]"
check "REPLAY pre-sign-out cookie: settings/save -> 401" "[ \"\$(code -b '$JAR_OLD' -F companyName='Replay Ltda' -F industry=retail $B/dashboard/settings/save)\" = 401 ]"
check "REPLAY pre-sign-out cookie: regenerate -> 401" "[ \"\$(code -b '$JAR_OLD' -F type=all $B/api/documents/regenerate)\" = 401 ]"
check "REPLAY did not change the company name" "[ \"\$(SQL \"select name from companies where id='$CID'\")\" = 'Smoke Settings Ltda' ]"
# a new sign-in link after the sign-out gives a session that works (and the old cookie stays dead)
signin "$EMAIL" >/dev/null
SLINK2=$(node -e 'const fs=require("fs"),d=process.argv[1];let out="";for(const f of fs.readdirSync(d).sort()){const m=JSON.parse(fs.readFileSync(d+"/"+f,"utf8"));if(m.to===process.argv[2]&&/callback/.test(m.text))out=m.text.match(/https?:\/\/\S+/)[0]}console.log(out)' "$OUTBOX" "$EMAIL")
JAR5=$(mktemp)
check "sign in again after sign-out: link sets a new session" "[ '$SLINK2' != '$SLINK' ] && curl -s -D - -o /dev/null -c '$JAR5' '$SLINK2' | tr -d '\r' | grep -iq 'set-cookie: authjs.session-token='"
check "sign in again: new session reaches /dashboard (200) and the PDF" "[ \"\$(code -b '$JAR5' $B/dashboard)\" = 200 ] && [ \"\$(code -b '$JAR5' $B/dashboard/documents/$DOC1/pdf)\" = 200 ]"
check "sign in again: the pre-sign-out cookie is still refused" "curl -s -D - -o /dev/null -b '$JAR_OLD' $B/dashboard | tr -d '\r' | grep -iqE '^location: .*/login'"
check "the original jar (same user, another browser) ended too: all of that user's sessions end" "curl -s -D - -o /dev/null -b '$JAR2' $B/dashboard | tr -d '\r' | grep -iqE '^location: .*/login'"
rm -f "$JAR4" "$SO_HDR" "$JAR_OLD" "$JAR5"

rm -f "$JAR3" /tmp/pdf.hdr /tmp/doc1.pdf /tmp/st3.out

# failed payment path
R=$(curl -s -c "$JAR" -X POST -H 'content-type: application/json' --data "{\"country\":\"br\",\"companyName\":\"Fail Ltda\",\"taxId\":\"11222333000181\",\"billingEmail\":\"fail-$EMAIL\"}" "$B/api/checkout"); FATT=$(echo "$R" | JQ attemptId)
curl -s -o /dev/null -X POST -d 'outcome=fail' "$B/api/fake-payments/$FATT"
check "simulator Fail -> attempt failed, nothing provisioned, status endpoint says failed" "curl -s -b '$JAR' '$B/api/checkout/status?attempt=$FATT' | grep -q '\"status\":\"failed\"' && [ \"\$(SQL \"select count(*) from users where email='fail-$EMAIL'\")\" = 0 ]"

# GUARD: with ALLOW_FAKE_PAYMENTS unset, fake routes 404 and checkout is unavailable
start_server PAYMENT_PROVIDER=fake FAKE_PAYMENTS_SECRET=$SECRET
check "ALLOW_FAKE_PAYMENTS unset: simulator page 404" "[ \"\$(curl -s -o /dev/null -w '%{http_code}' $B/checkout/fake/$FATT)\" = 404 ]"
check "ALLOW_FAKE_PAYMENTS unset: simulator action 404" "[ \"\$(curl -s -o /dev/null -w '%{http_code}' -X POST -d outcome=pay $B/api/fake-payments/$FATT)\" = 404 ]"
check "ALLOW_FAKE_PAYMENTS unset: webhook endpoint 404" "[ \"\$(curl -s -o /dev/null -w '%{http_code}' -X POST --data '{}' $B/api/webhooks/payments)\" = 404 ]"
check "ALLOW_FAKE_PAYMENTS unset: POST /api/checkout -> 503 unavailable" "[ \"\$(curl -s -o /dev/null -w '%{http_code}' -X POST -H 'content-type: application/json' --data '{\"country\":\"br\",\"companyName\":\"X\",\"taxId\":\"11222333000181\",\"billingEmail\":\"n-$EMAIL\"}' $B/api/checkout)\" = 503 ]"
check "ALLOW_FAKE_PAYMENTS unset: /checkout?c=br shows 'unavailable', no form" "curl -s '$B/checkout?c=br' | grep -q 'ainda não está disponível' && ! curl -s '$B/checkout?c=br' | grep -q 'name=\"companyName\"'"
start_server
check "PAYMENT_PROVIDER unset (default none): /checkout?c=br unavailable too" "curl -s '$B/checkout?c=br' | grep -q 'ainda não está disponível'"

kill $SERVER_PID 2>/dev/null; wait $SERVER_PID 2>/dev/null
rm -rf "$OUTBOX" "$UPLOADS" "$JAR" "$JAR_SAVED" "$JAR2" "$PNG" "$SVG" /tmp/wh.out /tmp/st.out
fi

[ "$fail" -eq 0 ] && echo "smoke: PASS (port $PORT)" || echo "smoke: FAIL (port $PORT)"
exit $fail
