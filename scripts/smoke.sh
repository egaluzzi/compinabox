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
TV=$(sed -n 's/.*TERMS_VERSION = "\(.*\)";/\1/p' lib/legal/version.ts) # the checkout checkbox (phase 9)
TERMS_JSON="\"termsAccepted\":true,\"termsVersion\":\"$TV\""
SECRET=smoke-fake-secret-$(date +%s)-0123456789
ASEC=smoke-auth-secret-$(date +%s)-0123456789
OUTBOX=$(mktemp -d); UPLOADS=$(mktemp -d); EVIDENCE=$(mktemp -d); JAR=$(mktemp); JAR_SAVED=$(mktemp); JAR2=$(mktemp)
EMAIL="smoke-$(date +%s)-$$@example.test"
UNKNOWN="ghost-$(date +%s)-$$@example.test"

export AUTH_SECRET=$ASEC
start_server() { # start_server [VAR=value ...]  (restarts the standalone server with a clean flow env)
  kill $SERVER_PID 2>/dev/null; wait $SERVER_PID 2>/dev/null
  env ENABLED_COUNTRIES=br AUTH_URL=$B EMAIL_DEV_SINK=true EMAIL_SINK_DIR=$OUTBOX \
      UPLOADS_DIR=$UPLOADS EVIDENCE_DIR=$EVIDENCE REPORT_ENCRYPTION_KEYS="smoke:$(printf 'smoke-report-key-0123456789abcde' | base64)" "$@" node .next/standalone/server.js >"$LOG" 2>&1 &
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

export -f wh SQL JQ
export B SECRET
start_server "${FAKE_ENV[@]}"
check "/checkout?c=br shows the form and the TEST PRICE label" "curl -s '$B/checkout?c=br' | grep -q 'name=\"companyName\"' && curl -s '$B/checkout?c=br' | grep -q 'PREÇO DE TESTE'"
check "/checkout?c=ar refused (not in ENABLED_COUNTRIES): no form" "! curl -s '$B/checkout?c=ar' | grep -q 'name=\"companyName\"'"
check "/dashboard without a session redirects to /login" "curl -sI $B/dashboard | grep -iE '^location: .*/login'"
check "/onboarding without a session redirects to /login" "curl -sI $B/onboarding | grep -iE '^location: .*/login'"

R=$(curl -s -c "$JAR" -X POST -H 'content-type: application/json' --data "{\"country\":\"br\",\"companyName\":\"Smoke Ltda\",\"taxId\":\"11.222.333/0001-81\",\"billingEmail\":\"$EMAIL\",$TERMS_JSON}" "$B/api/checkout")
ATT=$(echo "$R" | JQ attemptId); REDIR=$(echo "$R" | JQ redirectUrl)
check "POST /api/checkout -> attempt id + hosted-checkout URL" "[ -n '$ATT' ] && echo '$REDIR' | grep -q '/checkout/fake/$ATT'"
check "return_token cookie is httpOnly" "grep -q '#HttpOnly_.*return_token' '$JAR'"
check "DB: attempt is pending, 0 companies for that email" "[ \"\$(psql \"$DATABASE_URL\" -Atc \"select status from checkout_attempt where id='$ATT'\")\" = pending ] && [ \"\$(psql \"$DATABASE_URL\" -Atc \"select count(*) from users where email='$EMAIL'\")\" = 0 ]"
check "invalid CNPJ -> 422 invalid_tax_id" "curl -s -X POST -H 'content-type: application/json' --data '{\"country\":\"br\",\"companyName\":\"X Ltda\",\"taxId\":\"11222333000182\",\"billingEmail\":\"bad-$EMAIL\"}' $B/api/checkout | grep -q invalid_tax_id"
check "POST /api/checkout without the terms box -> 422 terms_not_accepted" "curl -s -X POST -H 'content-type: application/json' --data '{\"country\":\"br\",\"companyName\":\"X Ltda\",\"taxId\":\"11222333000181\",\"billingEmail\":\"nt-$EMAIL\"}' $B/api/checkout | grep -q terms_not_accepted"
check "DB: the attempt stored the terms version and time" "[ \"\$(psql \"$DATABASE_URL\" -Atc \"select terms_version from checkout_attempt where id='$ATT' and terms_accepted_at is not null\")\" = '$TV' ]"
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
R3=$(curl -s -c "$JAR3" -X POST -H 'content-type: application/json' --data "{\"country\":\"br\",\"companyName\":\"Other Ltda\",\"taxId\":\"11222333000181\",\"billingEmail\":\"$EMAIL3\",$TERMS_JSON}" "$B/api/checkout"); ATT3=$(echo "$R3" | JQ attemptId)
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
export -f code
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
# ---------------------------------------------------------------------------------------------
# Phase 5: whistleblower intake + case log — anonymous submit with an EXIF-carrying image, tracking
# code, public status, admin review (decrypt, evidence, notes, statuses), tenant isolation, the
# notification email. Real Postgres + real HTTP + real files. Company 1 = JAR5 (admin), company 2 = JAR3.
# ---------------------------------------------------------------------------------------------
SLUG1=$(SQL "select slug from companies where id='$CID'")
COMPANY1=$(SQL "select name from companies where id='$CID'")
RHDR=$(mktemp)
check "channel page: 200 in pt-BR, branded with the company name, form fields present" "curl -s -D '$RHDR' $B/report/$SLUG1 -o /tmp/rpt.html; head -1 '$RHDR' | grep -q ' 200' && grep -q '<html lang=\"pt-BR\"' /tmp/rpt.html && grep -q 'Canal de denúncias de $COMPANY1' /tmp/rpt.html && grep -q 'name=\"category\"' /tmp/rpt.html && grep -q 'name=\"evidence\"' /tmp/rpt.html"
check "channel page headers: no-store, no-referrer, DENY, noindex (header + meta), NO cookie, no banner" "H=\$(tr -d '\r' <'$RHDR') && echo \"\$H\" | grep -iq '^cache-control: no-store' && echo \"\$H\" | grep -iq '^referrer-policy: no-referrer' && echo \"\$H\" | grep -iq '^x-frame-options: DENY' && echo \"\$H\" | grep -iq '^x-robots-tag: noindex' && ! echo \"\$H\" | grep -iq '^set-cookie' && grep -qi 'name=\"robots\" content=\"noindex' /tmp/rpt.html && ! grep -qiE 'consent|googletagmanager' /tmp/rpt.html"
check "unknown channel slug -> 404; status page renders" "[ \"\$(code $B/report/no-such-company-zz)\" = 404 ] && [ \"\$(code $B/report/$SLUG1/status)\" = 200 ]"

# an image carrying an EXIF/GPS-style marker, and probe headers that must never be stored
EVJPG=$(mktemp --suffix=.jpg)
node -e 'const fs=require("fs");const l=fs.readFileSync("tests/fixtures/logo.jpg");const p=Buffer.from("Exif\0\0SMOKE-EXIF-GPS-MARKER","latin1");const n=Buffer.alloc(2);n.writeUInt16BE(p.length+2);fs.writeFileSync(process.argv[1],Buffer.concat([l.subarray(0,2),Buffer.from([0xff,0xe1]),n,p,l.subarray(2)]))' "$EVJPG"
check "the test image really carries the marker before upload" "grep -aq SMOKE-EXIF-GPS-MARKER '$EVJPG'"
RSP=$(curl -s -D "$RHDR" -H 'X-Forwarded-For: 203.0.113.55' -H 'CF-Connecting-IP: 198.51.100.55' -H 'User-Agent: SmokeAnon/7.7' -H 'Cookie: probe=SMOKE-COOKIE-MARKER' -H 'Accept-Language: xx-SMOKE-LANG' -H 'Referer: https://smoke-referer.example/MARKER' \
  -F category=fraud -F 'description=Descrição secreta do smoke 4f1d' -F wantsContact=no -F "evidence=@$EVJPG;type=image/jpeg;filename=my-private-name.jpg" "$B/api/report/$SLUG1")
RCODE=$(echo "$RSP" | JQ code); RAW=${RCODE//-/}
check "anonymous submit with probe headers -> 201 + tracking code XXXX-XXXX-XXXX, no cookie set" "head -1 '$RHDR' | grep -q ' 201' && echo '$RCODE' | grep -qE '^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}\$' && ! grep -qi '^set-cookie' '$RHDR'"
RID=$(SQL "select id from whistleblower_reports where tracking_code='$RAW'")
check "DB: anonymous row — is_anonymous, NULL contact, status new, ciphertext description (no plaintext)" "[ \"\$(SQL \"select is_anonymous::text || ',' || coalesce(reporter_contact,'NULL') || ',' || status from whistleblower_reports where id='$RID'\")\" = 'true,NULL,new' ] && [ \"\$(SQL \"select left(description,6) from whistleblower_reports where id='$RID'\")\" = 'vsmoke' ] && [ \"\$(SQL \"select count(*) from whistleblower_reports where description like '%secreta%'\")\" = 0 ]"
echo "--- smoke evidence: the anonymous report row exactly as stored (psql)"
psql "$DATABASE_URL" -x -c "select id, company_id, tracking_code, category, left(description, 70) as description, is_anonymous, reporter_contact, status, status_changed_at, resolved_at, created_at from whistleblower_reports where id='$RID'"
# whole-database marker search: every table, every column (pg_dump), with a positive control
dump() { pg_dump "$DATABASE_URL" --data-only --no-owner 2>/dev/null; }
MARKERS=(203.0.113.55 198.51.100.55 SmokeAnon/7.7 SMOKE-COOKIE-MARKER xx-SMOKE-LANG smoke-referer.example my-private-name SMOKE-EXIF-GPS-MARKER)
DUMP=$(mktemp); dump >"$DUMP"
HITS=0; for m in "${MARKERS[@]}"; do HITS=$((HITS + $(grep -cF -- "$m" "$DUMP"))); done
check "full-database marker search (headers, cookie, client file name, EXIF marker): 0 hits in a non-trivial dump" "[ '$HITS' = 0 ] && [ \$(wc -l <'$DUMP') -gt 100 ]"
echo "--- smoke evidence: marker search over the whole database dump ($(wc -l <"$DUMP") lines, ${#MARKERS[@]} markers): $HITS hit(s)"
SQL "insert into waitlist_leads (email, country) values ('control-203.0.113.55@example.test', 'br')" >/dev/null; dump >"$DUMP"
echo "--- smoke evidence: positive control — the same search after deliberately inserting a marker row: $(grep -cF -- 203.0.113.55 "$DUMP") hit(s)"
check "positive control: the same search DOES find a marker that is really there" "[ \$(grep -cF -- 203.0.113.55 '$DUMP') -ge 1 ]"
SQL "delete from waitlist_leads where email like 'control-%'" >/dev/null; rm -f "$DUMP"

# evidence on disk: encrypted, not an image, outside the uploads dir
EFILE=$(SQL "select file_name from whistleblower_evidence where report_id='$RID'")
check "evidence: one row, server-chosen name, sniffed type image/jpeg, stored outside the uploads dir" "[ \"\$(SQL \"select count(*) from whistleblower_evidence where report_id='$RID' and content_type='image/jpeg' and file_name ~ '^[a-f0-9]{32}\\.enc\$'\")\" = 1 ] && [ -f '$EVIDENCE/$EFILE' ] && [ ! -e '$UPLOADS/$EFILE' ]"
check "evidence on disk is not an image (no JPEG magic) and carries no marker" "[ \"\$(head -c 2 '$EVIDENCE/$EFILE' | od -An -tx1 | tr -d ' ')\" != ffd8 ] && ! grep -aq SMOKE-EXIF-GPS-MARKER '$EVIDENCE/$EFILE'"
echo "--- smoke evidence: the evidence file on disk (ls -l; first 32 bytes, hex + text)"
ls -l "$EVIDENCE/$EFILE"; od -A x -t x1z -N 32 "$EVIDENCE/$EFILE"
check "the public uploads route cannot serve the evidence file" "[ \"\$(code $B/uploads/$EFILE)\" = 404 ] && [ \"\$(code $B/uploads/${EFILE%.enc}.jpg)\" = 404 ]"

# public status: only the label and a date; wrong / malformed / other-company answers are identical
st() { curl -s -w ' %{http_code}' -X POST -H 'content-type: application/json' --data "{\"code\":\"$2\"}" "$B/api/report/$1/status"; }
export -f st
check "public status: right code -> 'Recebida' and nothing about the report" "R=\$(st $SLUG1 $RCODE) && echo \"\$R\" | grep -q '\"label\":\"Recebida\"' && ! echo \"\$R\" | grep -qiE 'fraud|secreta|category|description' && echo \"\$R\" | grep -q ' 200\$'"
check "public status: wrong, malformed and other-company answers are byte-identical 404s" "A=\$(st $SLUG1 AAAA-AAAA-AAAA) && [ \"\$A\" = \"\$(st $SLUG1 12)\" ] && [ \"\$A\" = \"\$(st no-such-company-zz $RCODE)\" ] && [ \"\$A\" = \"\$(st \$(SQL \"select slug from companies where id='$C2'\") $RCODE)\" ] && echo \"\$A\" | grep -q ' 404\$'"

# the admin reviews: list, decrypted detail, evidence download without metadata
check "dashboard list: report appears (link, 'Recebida'), channel URL shown, no description text" "H=\$(curl -s -b '$JAR5' $B/dashboard/whistleblower) && echo \"\$H\" | grep -q '/dashboard/whistleblower/$RID' && echo \"\$H\" | grep -q '$B/report/$SLUG1' && echo \"\$H\" | grep -q 'Recebida' && ! echo \"\$H\" | grep -q 'secreta'"
check "dashboard detail decrypts the description and says 'Anônima'" "H=\$(curl -s -b '$JAR5' $B/dashboard/whistleblower/$RID) && echo \"\$H\" | grep -q 'Descrição secreta do smoke 4f1d' && echo \"\$H\" | grep -q 'Anônima'"
EVID=$(SQL "select id from whistleblower_evidence where report_id='$RID'")
curl -s -D "$RHDR" -o /tmp/ev.out -b "$JAR5" "$B/dashboard/whistleblower/$RID/evidence/$EVID"
check "evidence download: attachment, image/jpeg, nosniff, private no-store; a JPEG with the EXIF marker gone" "H=\$(tr -d '\r' <'$RHDR') && echo \"\$H\" | grep -iq '^content-disposition: attachment' && echo \"\$H\" | grep -iq '^content-type: image/jpeg' && echo \"\$H\" | grep -iq '^x-content-type-options: nosniff' && echo \"\$H\" | grep -iq '^cache-control: private, no-store' && [ \"\$(head -c 2 /tmp/ev.out | od -An -tx1 | tr -d ' ')\" = ffd8 ] && ! grep -aq SMOKE-EXIF-GPS-MARKER /tmp/ev.out && ! grep -aq Exif /tmp/ev.out"
check "evidence download without a session -> 401" "[ \"\$(code $B/dashboard/whistleblower/$RID/evidence/$EVID)\" = 401 ]"

# case log: note, then under review, then closed; the public status follows
check "add a note -> 303; it shows decrypted, and is ciphertext in the database" "[ \"\$(code -b '$JAR5' -F 'body=Nota interna do smoke 77aa' $B/dashboard/whistleblower/$RID/note)\" = 303 ] && curl -s -b '$JAR5' $B/dashboard/whistleblower/$RID | grep -q 'Nota interna do smoke 77aa' && [ \"\$(SQL \"select count(*) from whistleblower_notes where report_id='$RID' and kind='note' and body like 'v%' and body not like '%interna%'\")\" = 1 ]"
check "move to 'under review' -> public status shows 'Em análise'" "[ \"\$(code -b '$JAR5' -F status=under_review $B/dashboard/whistleblower/$RID/status)\" = 303 ] && st $SLUG1 $RCODE | grep -q 'Em análise'"
check "close it -> resolved_at set, public status shows 'Encerrada'" "[ \"\$(code -b '$JAR5' -F status=closed $B/dashboard/whistleblower/$RID/status)\" = 303 ] && st $SLUG1 $RCODE | grep -q 'Encerrada' && [ \"\$(SQL \"select (resolved_at is not null)::text from whistleblower_reports where id='$RID'\")\" = true ]"
check "case log: note + two status changes recorded; the overview no longer counts it as open" "[ \"\$(SQL \"select string_agg(kind || coalesce(':' || from_status || '>' || to_status, ''), ',' order by created_at, id) from whistleblower_notes where report_id='$RID'\")\" = 'note,status_change:new>under_review,status_change:under_review>closed' ] && curl -s -b '$JAR5' $B/dashboard | grep -q 'Nenhuma denúncia em aberto'"
check "reopen clears the resolution date" "[ \"\$(code -b '$JAR5' -F status=new $B/dashboard/whistleblower/$RID/status)\" = 303 ] && [ \"\$(SQL \"select (resolved_at is null)::text from whistleblower_reports where id='$RID'\")\" = true ]"
SQL "update whistleblower_reports set status='closed' where id='$RID'" >/dev/null # back to closed for the checks below (the report table is not append-only; the log is)
check "database: the case log is append-only (UPDATE and DELETE rejected)" "OUT=\$(psql '$DATABASE_URL' -qc \"update whistleblower_notes set body='x' where report_id='$RID'\" 2>&1); echo \"\$OUT\" | grep -q 'append-only' && OUT=\$(psql '$DATABASE_URL' -qc \"delete from whistleblower_notes where report_id='$RID'\" 2>&1); echo \"\$OUT\" | grep -q 'append-only'"

# company 2 (JAR3) gets 404 for everything of company 1's
check "company 2: report detail -> 404, evidence -> 404, status change -> 404, note -> 404" "[ \"\$(code -b '$JAR3' $B/dashboard/whistleblower/$RID)\" = 404 ] && [ \"\$(code -b '$JAR3' $B/dashboard/whistleblower/$RID/evidence/$EVID)\" = 404 ] && [ \"\$(code -b '$JAR3' -F status=closed $B/dashboard/whistleblower/$RID/status)\" = 404 ] && [ \"\$(code -b '$JAR3' -F body=intruder $B/dashboard/whistleblower/$RID/note)\" = 404 ]"
check "company 2: its list shows nothing of company 1's (no id, no slug, no description)" "H=\$(curl -s -b '$JAR3' $B/dashboard/whistleblower) && ! echo \"\$H\" | grep -q '$RID' && ! echo \"\$H\" | grep -q '$SLUG1' && ! echo \"\$H\" | grep -q secreta"
check "company 1's report is untouched by company 2's attempts" "[ \"\$(SQL \"select count(*) from whistleblower_notes where report_id='$RID' and kind='note'\")\" = 1 ] && [ \"\$(SQL \"select status from whistleblower_reports where id='$RID'\")\" = closed ]"

# bad input and the honeypot
check "intake: invalid category / an SVG named .png -> 422, nothing stored" "N0=\$(SQL 'select count(*) from whistleblower_reports'); [ \"\$(code -F category=gossip -F description=x -F wantsContact=no $B/api/report/$SLUG1)\" = 422 ] && [ \"\$(code -F category=fraud -F description=x -F wantsContact=no -F 'evidence=@$SVG;type=image/png' $B/api/report/$SLUG1)\" = 422 ] && [ \"\$(SQL 'select count(*) from whistleblower_reports')\" = \"\$N0\" ]"
check "intake: a filled honeypot looks like success but stores nothing" "N0=\$(SQL 'select count(*) from whistleblower_reports'); curl -s -F category=fraud -F description=bot -F wantsContact=no -F website=spam $B/api/report/$SLUG1 | grep -q '\"ok\":true' && [ \"\$(SQL 'select count(*) from whistleblower_reports')\" = \"\$N0\" ]"
check "intake: opt-in contact is stored encrypted, is_anonymous = false" "C=\$(curl -s -F category=other -F description='com contato' -F wantsContact=yes -F 'contact=joana@smoke.example' $B/api/report/$SLUG1 | JQ code) && [ -n \"\$C\" ] && [ \"\$(SQL \"select is_anonymous::text || ',' || (reporter_contact like 'v%')::text || ',' || (reporter_contact like '%joana%')::text from whistleblower_reports where tracking_code='\${C//-/}'\")\" = 'false,true,false' ]"

# the notification email: to the admin, localized, a link to the dashboard, nothing from the report
MAILS=$(node -e 'const fs=require("fs"),d=process.argv[1];for(const f of fs.readdirSync(d).sort()){const m=JSON.parse(fs.readFileSync(d+"/"+f,"utf8"));if(m.to===process.argv[2]&&m.subject==="Nova denúncia recebida no seu canal")console.log(JSON.stringify(m))}' "$OUTBOX" "$EMAIL")
check "notification emails reached the admin in the dev sink (one per stored report: 2)" "[ \"\$(echo '$MAILS' | wc -l)\" = 2 ]"
check "notification email: dashboard link, and none of the report's content, code, category or id" "M=\$(echo '$MAILS' | head -1) && echo \"\$M\" | grep -q '/dashboard/whistleblower' && ! echo \"\$M\" | grep -qiE 'secreta|fraud|fraude|$RAW|$RCODE|$RID'"
echo "--- smoke evidence: the notification email as written to the dev sink"
echo "$MAILS" | head -1
rm -f "$RHDR" "$EVJPG" /tmp/rpt.html /tmp/ev.out

# ---------------------------------------------------------------------------------------------
# Phase 6: the employee portal — CSV import -> invitations -> link (GET does not consume) -> Start ->
# acknowledge six documents (with the Cloudflare client IP) -> fail the quiz once, pass it -> the
# annual disclosure -> admin grid + CSV/PDF exports -> link reuse, re-issue, tenant isolation,
# deactivation. Real Postgres + real HTTP + the real dev email sink. Company 1 = JAR5 (admin),
# company 2 = JAR3.
# ---------------------------------------------------------------------------------------------
t() { # t "<description>" <command...>  — runs the command in THIS shell (no quoting gymnastics)
  local d=$1; shift
  if "$@" >/dev/null 2>&1; then printf 'ok    %s\n' "$d"; else printf 'FAIL  %s\n' "$d"; fail=1; fi
}
P6="$$"
P6_CSV=$(mktemp); P6_HDR=$(mktemp); P6_HTML=$(mktemp); JARE=$(mktemp); JARE3=$(mktemp)
ANA_E="ana6-$P6@example.test"; BETO_E="beto6-$P6@example.test"; CARLA_E="carla6-$P6@example.test"
# UTF-8 BOM, ';' delimiter, Portuguese header, an upper-case email, one invalid line, one duplicate
printf '\xef\xbb\xbfnome;email\nAna Smoke;ANA6-%s@example.test\nBeto Smoke;%s\nCarla Smoke;%s\nSem Email;nao-e-email\nAna Repetida;%s\n' "$P6" "$BETO_E" "$CARLA_E" "$ANA_E" >"$P6_CSV"
IMP=$(curl -s -o /dev/null -w '%{http_code} %{redirect_url}' -b "$JAR5" -F "file=@$P6_CSV;type=text/csv" "$B/dashboard/employees/import")
t "import (BOM + ';' + one bad line + one duplicate): 303, created 3, skipped 1, invalid 1, line 5 reported, no email in the URL" \
  bash -c "echo '$IMP' | grep -q '^303 .*imported=3\.0\.1\.1' && echo '$IMP' | grep -q 'bad=5:email_invalid' && ! echo '$IMP' | grep -qi 'example.test'"
ANA=$(SQL "select id from employees where company_id='$CID' and email='$ANA_E'")
BETO=$(SQL "select id from employees where company_id='$CID' and email='$BETO_E'")
CARLA=$(SQL "select id from employees where company_id='$CID' and email='$CARLA_E'")
t "DB: three employees, emails lower-cased, none invited yet" \
  bash -c "[ \"\$(psql '$DATABASE_URL' -Atc \"select count(*) from employees where company_id='$CID' and email in ('$ANA_E','$BETO_E','$CARLA_E') and invited_at is null and invite_token_hash is null\")\" = 3 ]"
curl -s -b "$JAR5" "$B/dashboard/employees" -o "$P6_HTML"
t "admin grid lists the three, 'Não convidado', and the completion line says 0%" bash -c "grep -q 'Ana Smoke' '$P6_HTML' && grep -q 'Beto Smoke' '$P6_HTML' && grep -q 'Não convidado' '$P6_HTML' && grep -q 'Conclusão 0% · 0 de 3' '$P6_HTML'"

# invitations: "send pending" (<= 50 per click)
BATCH=$(curl -s -o /dev/null -w '%{http_code} %{redirect_url}' -b "$JAR5" -X POST "$B/dashboard/employees/invite-pending")
t "send pending invitations: 303, 3 sent, 0 failed, 0 remaining" bash -c "echo '$BATCH' | grep -q '^303 .*batch=3\.0\.0'"
mail_link() { # mail_link <to> [n-th mail, default last] -> prints the /employee/<token> link
  node -e 'const fs=require("fs"),d=process.argv[1],to=process.argv[2];let out=[];for(const f of fs.readdirSync(d).sort()){const m=JSON.parse(fs.readFileSync(d+"/"+f,"utf8"));if(m.to===to&&/employee\//.test(m.text))out.push(m.text.match(/https?:\/\/\S+\/employee\/\S+/)[0])}console.log(out[out.length-1]||"")' "$OUTBOX" "$1"
}
LINK_A=$(mail_link "$ANA_E"); LINK_B1=$(mail_link "$BETO_E"); LINK_C=$(mail_link "$CARLA_E")
TOK_A=${LINK_A##*/}; TOK_B1=${LINK_B1##*/}; TOK_C=${LINK_C##*/}
t "three invitation emails reached the dev sink, each with its own /employee/<43-char token> link" \
  bash -c "echo '$LINK_A' | grep -qE '/employee/[A-Za-z0-9_-]{43}\$' && echo '$LINK_B1' | grep -qE '/employee/[A-Za-z0-9_-]{43}\$' && [ '$TOK_A' != '$TOK_B1' ] && [ '$TOK_A' != '$TOK_C' ]"
MAIL_A=$(node -e 'const fs=require("fs"),d=process.argv[1];for(const f of fs.readdirSync(d).sort()){const m=JSON.parse(fs.readFileSync(d+"/"+f,"utf8"));if(m.to===process.argv[2]&&/employee\//.test(m.text))console.log(JSON.stringify(m))}' "$OUTBOX" "$ANA_E" | tail -1)
echo "--- smoke evidence: the invitation email as written to the dev sink"
echo "$MAIL_A"
t "invitation: pt-BR, names the employee, offers the two steps, carries no document text" \
  bash -c "echo '$MAIL_A' | grep -q 'convida você a concluir seu treinamento' && echo '$MAIL_A' | grep -q 'Olá Ana Smoke' && echo '$MAIL_A' | grep -q '15-20 min' && ! echo '$MAIL_A' | grep -qiE 'Nosso compromisso|vantagem indevida|Comprometimento da alta'"
t "DB: invited_at set, 14-day expiry, only the sha256 hash stored (the raw token is nowhere in the row)" \
  bash -c "[ \"\$(psql '$DATABASE_URL' -Atc \"select (invited_at is not null and invite_expires_at - invited_at = interval '14 days' and invite_token_hash = '\$(printf %s '$TOK_A' | openssl dgst -sha256 | awk '{print \$NF}')')::text from employees where id='$ANA'\")\" = true ] && ! psql '$DATABASE_URL' -Atc \"select * from employees where id='$ANA'\" | grep -q '$TOK_A'"
echo "--- smoke evidence: the invited employee row (psql -x): a hash, not the token"
psql "$DATABASE_URL" -x -c "select id, name, email, invite_token_hash, invited_at, invite_expires_at, deactivated_at from employees where id='$ANA'"

# the link page: GET never consumes (mail scanners and link previews prefetch it)
G1=$(curl -s -o "$P6_HTML" -w '%{http_code}' "$LINK_A"); G2=$(curl -s -o /dev/null -w '%{http_code}' "$LINK_A")
t "GET /employee/<token> (twice): 200 'Start' page with a hidden token field and the company name" bash -c "[ '$G1' = 200 ] && [ '$G2' = 200 ] && grep -q 'name=\"token\"' '$P6_HTML' && grep -q 'Começar' '$P6_HTML' && grep -q 'action=\"/employee/api/session\"' '$P6_HTML'"
t "GET did not consume the link: the hash is still stored, the token is usable" bash -c "[ \"\$(psql '$DATABASE_URL' -Atc \"select (invite_token_hash is not null)::text from employees where id='$ANA'\")\" = true ]"
curl -s -D "$P6_HDR" -o /dev/null "$LINK_A"
t "link page headers: private no-store, no-referrer, DENY, noindex" bash -c "H=\$(tr -d '\r' <'$P6_HDR') && echo \"\$H\" | grep -iq '^cache-control: private, no-store' && echo \"\$H\" | grep -iq '^referrer-policy: no-referrer' && echo \"\$H\" | grep -iq '^x-frame-options: DENY' && echo \"\$H\" | grep -iq '^x-robots-tag: noindex'"
t "no portal cookie reaches /employee without a session: /employee -> friendly page, handlers -> 401" bash -c "curl -s -D - -o /dev/null $B/employee | tr -d '\r' | grep -iqE '^location: .*/employee/link-invalid' && [ \"\$(code -X POST -F documentId=x $B/employee/api/acknowledge)\" = 401 ] && [ \"\$(code -X POST --data '{}' $B/employee/api/training)\" = 401 ]"

# Start (POST) consumes the link and opens the session
curl -s -D "$P6_HDR" -o /dev/null -c "$JARE" -X POST --data-urlencode "token=$TOK_A" "$B/employee/api/session"
t "Start: 303 to /employee; cookie employee_session is HttpOnly, SameSite=Lax, Path=/employee, 8 hours" bash -c "H=\$(tr -d '\r' <'$P6_HDR') && head -1 '$P6_HDR' | grep -q ' 303 ' && echo \"\$H\" | grep -iq '^location: .*/employee\$' && echo \"\$H\" | grep -i '^set-cookie: employee_session=' | grep -iq 'HttpOnly' && echo \"\$H\" | grep -i '^set-cookie: employee_session=' | grep -iq 'Path=/employee' && echo \"\$H\" | grep -i '^set-cookie: employee_session=' | grep -iq 'SameSite=lax' && echo \"\$H\" | grep -i '^set-cookie: employee_session=' | grep -iq 'Max-Age=28800'"
t "cookie jar: the session cookie is scoped to Path=/employee (never sent to /dashboard, /report)" bash -c "grep -q '/employee.*employee_session' '$JARE' && ! curl -s -D - -o /dev/null -b '$JARE' $B/dashboard | tr -d '\r' | grep -iq 'employee'"
t "DB: invite_token_hash is NULL after Start, exactly one session row, only its hash stored" bash -c "[ \"\$(psql '$DATABASE_URL' -Atc \"select (invite_token_hash is null)::text from employees where id='$ANA'\")\" = true ] && [ \"\$(psql '$DATABASE_URL' -Atc \"select count(*) from employee_sessions where employee_id='$ANA'\")\" = 1 ] && ! psql '$DATABASE_URL' -Atc 'select * from employee_sessions' | grep -q \"\$(grep employee_session '$JARE' | awk '{print \$NF}')\""
echo "--- smoke evidence: the same employee row after Start (invite_token_hash is NULL)"
psql "$DATABASE_URL" -x -c "select id, email, invite_token_hash, invited_at, invite_expires_at from employees where id='$ANA'"
curl -s -D "$P6_HDR" -b "$JARE" -o "$P6_HTML" "$B/employee"
t "portal home: 200, private no-store, checklist shows 0 of 8 steps" bash -c "head -1 '$P6_HDR' | grep -q ' 200' && tr -d '\r' <'$P6_HDR' | grep -iq '^cache-control: private, no-store' && grep -q '0 de 8 etapas concluídas' '$P6_HTML' && grep -q 'Smoke' '$P6_HTML'"

# acknowledge the six documents (with the Cloudflare header), then a double click and a foreign id
# the CURRENT version of each type (earlier smoke steps regenerated the documents)
DOCS=$(SQL "select distinct on (type) id from documents where company_id='$CID' order by type, version desc")
N=0; ACKFAIL=0
for d in $DOCS; do
  N=$((N+1))
  [ "$(code -b "$JARE" "$B/employee/documents/$d")" = 200 ] || ACKFAIL=1
  [ "$(code -b "$JARE" -H "CF-Connecting-IP: 203.0.113.$((10+N))" -H 'X-Forwarded-For: 198.51.100.99' -F documentId="$d" "$B/employee/api/acknowledge")" = 303 ] || ACKFAIL=1
done
t "six document pages render (200) and six acknowledgments are accepted (303)" bash -c "[ '$ACKFAIL' = 0 ] && [ '$N' = 6 ]"
FIRSTDOC=$(echo "$DOCS" | head -1)
code -b "$JARE" -F documentId="$FIRSTDOC" "$B/employee/api/acknowledge" >/dev/null
t "double click: still exactly six acknowledgment rows" bash -c "[ \"\$(psql '$DATABASE_URL' -Atc \"select count(*) from acknowledgments where employee_id='$ANA'\")\" = 6 ]"
t "IP stored from CF-Connecting-IP (203.0.113.11..16), never from X-Forwarded-For" bash -c "[ \"\$(psql '$DATABASE_URL' -Atc \"select string_agg(ip_address, ',' order by ip_address) from acknowledgments where employee_id='$ANA'\")\" = '203.0.113.11,203.0.113.12,203.0.113.13,203.0.113.14,203.0.113.15,203.0.113.16' ]"
echo "--- smoke evidence: one acknowledgments row exactly as stored (psql -x) — it carries the client IP"
psql "$DATABASE_URL" -x -c "select id, company_id, employee_id, document_id, accepted_at, ip_address from acknowledgments where employee_id='$ANA' order by accepted_at limit 1"
OTHERDOC=$(SQL "select id from documents where company_id <> '$CID' limit 1")
t "a document of ANOTHER company: page -> 404, acknowledge -> 404, no row written" bash -c "[ \"\$(code -b '$JARE' $B/employee/documents/$OTHERDOC)\" = 404 ] && [ \"\$(code -b '$JARE' -F documentId=$OTHERDOC $B/employee/api/acknowledge)\" = 404 ] && [ \"\$(psql '$DATABASE_URL' -Atc \"select count(*) from acknowledgments where document_id='$OTHERDOC'\")\" = 0 ]"
t "the acknowledgments table is append-only (UPDATE, DELETE rejected)" bash -c "psql '$DATABASE_URL' -qc \"update acknowledgments set ip_address='9.9.9.9' where employee_id='$ANA'\" 2>&1 | grep -q 'append-only' && psql '$DATABASE_URL' -qc \"delete from acknowledgments where employee_id='$ANA'\" 2>&1 | grep -q 'append-only'"

# training: the quiz page ships no answers; fail once (9 of 12), then pass (10 of 12)
curl -s -b "$JARE" "$B/employee/training/quiz" -o "$P6_HTML"
t "quiz page: 12 questions, no explanation text and no correct-answer marker in the HTML" bash -c "[ \"\$(grep -o 'type=\"radio\"' '$P6_HTML' | wc -l)\" = 48 ] && ! grep -qiE 'correctIndex|\"correct\"|Os registros precisam refletir' '$P6_HTML'"
answers() { node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types -e 'import("./lib/training/content.ts").then(m=>{const n=+process.argv[1],a={};m.QUESTIONS.forEach((q,i)=>a[q.id]=i<n?(q.correct+1)%4:q.correct);console.log(JSON.stringify({answers:a}))})' "$1"; }
FAIL_R=$(curl -s -b "$JARE" -H 'content-type: application/json' --data "$(answers 3)" "$B/employee/api/training")
t "quiz 9 of 12: not passed (score 75), explanations returned, NOTHING stored" bash -c "echo '$FAIL_R' | grep -q '\"passed\":false' && echo '$FAIL_R' | grep -q '\"score\":75' && echo '$FAIL_R' | grep -q '\"explanation\"' && [ \"\$(psql '$DATABASE_URL' -Atc \"select count(*) from training_completions where employee_id='$ANA'\")\" = 0 ]"
PASS_R=$(curl -s -b "$JARE" -H 'content-type: application/json' --data "$(answers 2)" "$B/employee/api/training")
curl -s -b "$JARE" -o /dev/null -H 'content-type: application/json' --data "$(answers 0)" "$B/employee/api/training"
t "quiz retake 10 of 12: passed (score 83); a repeated pass stays one row with the first score" bash -c "echo '$PASS_R' | grep -q '\"passed\":true' && [ \"\$(psql '$DATABASE_URL' -Atc \"select count(*) || ',' || max(score) from training_completions where employee_id='$ANA' and module_id='anticorruption-pt-BR-v1'\")\" = '1,83' ]"
t "lessons render server-side (pt-BR scenario), no answers in them" bash -c "curl -s -b '$JARE' $B/employee/training/1 | grep -q 'Cenário' && [ \"\$(code -b '$JARE' $B/employee/training/7)\" = 404 ]"

# annual disclosure: encrypted at rest, one per year
D1=$(curl -s -o /dev/null -w '%{http_code} %{redirect_url}' -b "$JARE" -F choice=some -F 'details=Minha prima é sócia da fornecedora Smoke 6e2f' "$B/employee/api/disclosure")
D2=$(curl -s -o /dev/null -w '%{http_code} %{redirect_url}' -b "$JARE" -F choice=none "$B/employee/api/disclosure")
t "disclosure: first submit recorded; the second in the same year says 'already' and changes nothing" bash -c "echo '$D1' | grep -q 'result=submitted' && echo '$D2' | grep -q 'result=already' && [ \"\$(psql '$DATABASE_URL' -Atc \"select count(*) from disclosures where employee_id='$ANA'\")\" = 1 ]"
t "disclosure content is ciphertext in the database (no plaintext anywhere in the row)" bash -c "C=\$(psql '$DATABASE_URL' -Atc \"select content from disclosures where employee_id='$ANA'\") && echo \"\$C\" | grep -qE '^vsmoke:' && ! echo \"\$C\" | grep -qiE 'prima|Smoke 6e2f|hasConflict'"
echo "--- smoke evidence: the disclosures row exactly as stored (psql -x): ciphertext, no plaintext"
psql "$DATABASE_URL" -x -c "select id, company_id, employee_id, type, period_year, left(content, 60) || '…' as content, submitted_at from disclosures where employee_id='$ANA'"

# the admin sees it: grid, completion (hand-computed 8 of 24 steps = 33%), detail page, exports
curl -s -b "$JAR5" "$B/dashboard/employees" -o "$P6_HTML"
t "admin grid: completion 33% (8 of 24 steps), 1 of 3 fully complete" bash -c "grep -q 'Conclusão 33% · 1 de 3 colaboradores com tudo concluído' '$P6_HTML'"
t "admin grid: Ana's eight marks are 'Feito' (6 documents, training, disclosure); the other two are invited, nothing done" bash -c "[ \"\$(grep -o '>Feito ' '$P6_HTML' | wc -l)\" = 8 ] && [ \"\$(grep -o '>Convidado<' '$P6_HTML' | wc -l)\" -ge 2 ]"
t "Overview widgets are real: 33% and '1 de 3 colaboradores com tudo concluído'" bash -c "H=\$(curl -s -b '$JAR5' $B/dashboard) && echo \"\$H\" | grep -q '33%' && echo \"\$H\" | grep -q '3 colaboradores'"
curl -s -D "$P6_HDR" -b "$JAR5" "$B/dashboard/employees/$ANA" -o "$P6_HTML"
t "employee detail (admin): the six acceptances with IPs, training 83%, the DECRYPTED disclosure; private no-store" bash -c "grep -q '203.0.113.13' '$P6_HTML' && grep -q 'Pontuação 83%' '$P6_HTML' && grep -q 'Minha prima é sócia da fornecedora Smoke 6e2f' '$P6_HTML' && tr -d '\r' <'$P6_HDR' | grep -iq '^cache-control: private, no-store'"
curl -s -D "$P6_HDR" -b "$JAR5" -o /tmp/p6.csv "$B/dashboard/employees/export.csv"
GRIDROWS=$(curl -s -b "$JAR5" "$B/dashboard/employees" | grep -o 'href="/dashboard/employees/[0-9a-f-]\{36\}"' | wc -l)
CSVROWS=$(($(tr -d '\r' </tmp/p6.csv | grep -c .) - 1))
t "CSV export: attachment, UTF-8 with BOM, one row per grid row ($GRIDROWS), ISO timestamps, NO IP and NO disclosure content" bash -c "tr -d '\r' <'$P6_HDR' | grep -iq '^content-disposition: attachment' && [ '$CSVROWS' = '$GRIDROWS' ] && [ '$GRIDROWS' = 3 ] && [ \"\$(head -c 3 /tmp/p6.csv | od -An -tx1 | tr -d ' ')\" = efbbbf ] && grep -qE '[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9:.]+Z' /tmp/p6.csv && ! grep -qE '203\.0\.113|198\.51\.100|prima|Smoke 6e2f' /tmp/p6.csv && ! head -1 /tmp/p6.csv | grep -qi 'ip'"
curl -s -D "$P6_HDR" -b "$JAR5" -o /tmp/p6.pdf "$B/dashboard/employees/export.pdf"
PDFTXT=$(node -e 'import("pdfjs-dist/legacy/build/pdf.mjs").then(async p=>{const d=await p.getDocument({data:new Uint8Array(require("fs").readFileSync(process.argv[1])),verbosity:0}).promise;let t="";for(let i=1;i<=d.numPages;i++){const c=await (await d.getPage(i)).getTextContent();t+=c.items.map(x=>x.str).join(" ")+"\n"}console.log(t)})' /tmp/p6.pdf)
t "PDF export: a real PDF attachment with all three employees, 'Página 1 de 1', no IP, no disclosure content" bash -c "head -c 5 /tmp/p6.pdf | grep -q '%PDF-' && tr -d '\r' <'$P6_HDR' | grep -iq '^content-type: application/pdf' && for n in 'Ana Smoke' 'Beto Smoke' 'Carla Smoke' 'Página 1 de 1'; do echo '$PDFTXT' | grep -q \"\$n\" || exit 1; done; ! echo '$PDFTXT' | grep -qE '203\.0\.113|prima'"

# link reuse, re-issue, tenant isolation, deactivation
REUSE_POST=$(curl -s -o /dev/null -w '%{http_code} %{redirect_url}' -X POST --data-urlencode "token=$TOK_A" "$B/employee/api/session")
REUSE_HTML=$(curl -s -w '\n%{http_code}' "$LINK_A")
t "the first link, reused: GET -> the friendly page (HTTP 200, no stack trace); POST -> 303 to that page, no cookie" bash -c "echo '$REUSE_POST' | grep -q '^303 .*/employee/link-invalid' && echo '$REUSE_HTML' | grep -q 'Este link não é mais válido' && echo '$REUSE_HTML' | tail -1 | grep -q '^200\$' && ! echo '$REUSE_HTML' | grep -qE 'Error:|at .*\\(.*:[0-9]+'"
curl -s -o /dev/null -b "$JAR5" -X POST "$B/dashboard/employees/$BETO/invite"
LINK_B2=$(mail_link "$BETO_E"); TOK_B2=${LINK_B2##*/}
B2POST=$(curl -s -o /dev/null -w '%{http_code} %{redirect_url}' -X POST --data-urlencode "token=$TOK_B1" "$B/employee/api/session")
t "re-issue: Beto's NEW link differs; the unused OLD link is dead (POST -> friendly page), the new one still shows Start" bash -c "[ '$TOK_B1' != '$TOK_B2' ] && echo '$B2POST' | grep -q '/employee/link-invalid' && curl -s '$LINK_B1' | grep -q 'Este link não é mais válido' && curl -s '$LINK_B2' | grep -q 'Começar'"
t "company 2 admin: Ana's detail -> 404; invite / deactivate / reactivate -> 404; export and grid show none of company 1's people" bash -c "[ \"\$(code -b '$JAR3' $B/dashboard/employees/$ANA)\" = 404 ] && for a in invite deactivate reactivate; do [ \"\$(code -b '$JAR3' -X POST $B/dashboard/employees/$ANA/\$a)\" = 404 ] || exit 1; done; ! curl -s -b '$JAR3' $B/dashboard/employees/export.csv | grep -q 'example.test' && ! curl -s -b '$JAR3' $B/dashboard/employees | grep -q 'Ana Smoke' && [ \"\$(psql '$DATABASE_URL' -Atc \"select count(*) from employees where id='$ANA' and deactivated_at is null\")\" = 1 ]"
t "company 2 admin cannot import into or read company 1's roster; its own import is its own (same email allowed)" bash -c "curl -s -o /dev/null -b '$JAR3' -F 'file=@$P6_CSV;type=text/csv' $B/dashboard/employees/import && [ \"\$(psql '$DATABASE_URL' -Atc \"select count(distinct company_id) from employees where email='$ANA_E'\")\" = 2 ] && [ \"\$(psql '$DATABASE_URL' -Atc \"select count(*) from employees where company_id='$CID'\")\" = 3 ]"
curl -s -o /dev/null -c "$JARE3" -X POST --data-urlencode "token=$TOK_C" "$B/employee/api/session"
t "Carla opens a session, then the admin deactivates her: her session is deleted and the cookie is refused (401 / friendly page)" bash -c "[ \"\$(code -b '$JARE3' $B/employee)\" = 200 ] && [ \"\$(code -b '$JAR5' -X POST $B/dashboard/employees/$CARLA/deactivate)\" = 303 ] && [ \"\$(psql '$DATABASE_URL' -Atc \"select count(*) from employee_sessions where employee_id='$CARLA'\")\" = 0 ] && [ \"\$(code -b '$JARE3' -X POST --data '{}' $B/employee/api/training)\" = 401 ] && curl -s -D - -o /dev/null -b '$JARE3' $B/employee | tr -d '\r' | grep -iqE '^location: .*/employee/link-invalid' && [ \"\$(psql '$DATABASE_URL' -Atc \"select count(*) from employees where id='$CARLA'\")\" = 1 ]"
t "deactivated Carla leaves the numbers: the grid says 'Conclusão 50% · 1 de 2' (8 of 16)" bash -c "curl -s -b '$JAR5' $B/dashboard/employees | grep -q 'Conclusão 50% · 1 de 2 colaboradores'"
curl -s -o /dev/null -b "$JARE" -X POST "$B/employee/api/sign-out"
t "sign-out in the portal: the session row is gone and the same cookie is refused" bash -c "[ \"\$(psql '$DATABASE_URL' -Atc \"select count(*) from employee_sessions where employee_id='$ANA'\")\" = 0 ] && [ \"\$(code -b '$JARE' -X POST --data '{}' $B/employee/api/training)\" = 401 ]"
rm -f "$P6_CSV" "$P6_HDR" "$P6_HTML" "$JARE" "$JARE3" /tmp/p6.csv /tmp/p6.pdf

# ---------------------------------------------------------------------------------------------
# Phase 7: vendors — add -> questionnaire link (GET does not consume) -> submit (encrypted at rest)
# -> admin sees the answers -> screening through the REAL client against a LOCAL STUB HTTP server
# shaped like the assumed OpenSanctions /match response (possible match / no match / cooldown /
# 500). Every screening line below is labelled "(local stub)": it is NOT evidence about the live
# service — that is scripts/screening-live-check.sh. Company 1 = JAR5, company 2 = JAR3.
# ---------------------------------------------------------------------------------------------
P7="$$"
P7_HTML=$(mktemp); P7_HDR=$(mktemp); STUBDIR=$(mktemp -d); STUBLOG="$STUBDIR/requests.log"; STUBMODE="$STUBDIR/mode"
STUB_KEY="smoke-dummy-screening-key-$P7-ZZ"
cat >"$STUBDIR/stub.js" <<'JS'
const http = require("http"), fs = require("fs");
const [port, log, modeFile] = process.argv.slice(2);
http.createServer((req, res) => {
  let b = "";
  req.on("data", (c) => (b += c));
  req.on("end", () => {
    const auth = req.headers.authorization ? req.headers.authorization.replace(/ApiKey .+/, "ApiKey <redacted>") : "<absent>";
    fs.appendFileSync(log, JSON.stringify({ method: req.method, url: req.url, authorization: auth, body: (() => { try { return JSON.parse(b || "null"); } catch (e) { return null; } })() }) + "\n");
    if (fs.existsSync(modeFile) && fs.readFileSync(modeFile, "utf8").trim() === "500") { res.statusCode = 500; return res.end("boom"); }
    let name = "";
    try { name = (JSON.parse(b).queries.q1.properties.name || [""])[0]; } catch (e) { res.statusCode = 400; return res.end("bad request"); }
    const hit = name.includes("Listed Smoke Corp");
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ responses: { q1: { results: hit ? [{ id: "NK-SMOKE-1", caption: "Listed Smoke Corp", schema: "Company", score: 0.97, match: true, datasets: ["smoke_sanctions"], properties: { topics: ["sanction"] } }] : [], total: { value: hit ? 1 : 0 } } } }));
  });
}).listen(+port, "127.0.0.1");
JS
STUBPORT=$(node -e 'const s=require("net").createServer().listen(0,()=>{console.log(s.address().port);s.close()})')
node "$STUBDIR/stub.js" "$STUBPORT" "$STUBLOG" "$STUBMODE" &
STUB_PID=$!
for _ in $(seq 1 40); do curl -s -o /dev/null "http://127.0.0.1:$STUBPORT/" && break; sleep 0.1; done
start_server "${FAKE_ENV[@]}" SCREENING_API_KEY="$STUB_KEY" SCREENING_BASE_URL="http://127.0.0.1:$STUBPORT" SCREENING_DATASET=smoke
t "robots.txt disallows /vendor" bash -c "curl -s $B/robots.txt | grep -qE '^Disallow: /vendor\$'"
V_LIST="Listed Smoke Corp $P7"; V_QUIET="Quiet Smoke Ltda $P7"; V_ERR="Err Smoke Ltda $P7"
VL_E="vendor-l-$P7@example.test"; VQ_E="vendor-q-$P7@example.test"
ADDR=$(curl -s -o /dev/null -w '%{http_code} %{redirect_url}' -b "$JAR5" -F "name=$V_LIST" -F country=br -F taxId=11.222.333/0001-81 -F contactName=Contato -F "contactEmail=${VL_E^^}" "$B/dashboard/vendors/add")
curl -s -o /dev/null -b "$JAR5" -F "name=$V_QUIET" -F "contactEmail=$VQ_E" "$B/dashboard/vendors/add"
curl -s -o /dev/null -b "$JAR5" -F "name=$V_ERR" "$B/dashboard/vendors/add"
VL=$(SQL "select id from vendors where company_id='$CID' and name='$V_LIST'"); VQ=$(SQL "select id from vendors where company_id='$CID' and name='$V_QUIET'"); VE=$(SQL "select id from vendors where company_id='$CID' and name='$V_ERR'")
t "add vendor: 303 back to the list; three vendors stored for company 1, email lower-cased, country upper-cased" bash -c "echo '$ADDR' | grep -q '^303 .*added=1' && [ -n '$VL' ] && [ -n '$VQ' ] && [ -n '$VE' ] && [ \"\$(psql '$DATABASE_URL' -Atc \"select contact_email || ',' || country from vendors where id='$VL'\")\" = '$VL_E,BR' ]"
t "add vendor: an empty name is refused with error=name_required and stores nothing" bash -c "[ \"\$(curl -s -o /dev/null -w '%{redirect_url}' -b '$JAR5' -F name= $B/dashboard/vendors/add)\" = '$B/dashboard/vendors?error=name_required' ]"
curl -s -b "$JAR5" "$B/dashboard/vendors" -o "$P7_HTML"
t "vendors list: the three vendors, 'Não triado', 'Não enviado'" bash -c "grep -q '$V_LIST' '$P7_HTML' && grep -q '$V_QUIET' '$P7_HTML' && grep -q 'Não triado' '$P7_HTML' && grep -q 'Não enviado' '$P7_HTML'"

# the questionnaire link
SENDR=$(curl -s -o /dev/null -w '%{http_code} %{redirect_url}' -b "$JAR5" -X POST "$B/dashboard/vendors/$VL/send")
vendor_link() { # vendor_link <to> -> the last /vendor/<token> link mailed to that address
  node -e 'const fs=require("fs"),d=process.argv[1],to=process.argv[2];let out=[];for(const f of fs.readdirSync(d).sort()){const m=JSON.parse(fs.readFileSync(d+"/"+f,"utf8"));if(m.to===to&&/\/vendor\//.test(m.text))out.push(m.text.match(/https?:\/\/\S+\/vendor\/\S+/)[0])}console.log(out[out.length-1]||"")' "$OUTBOX" "$1"
}
VLINK=$(vendor_link "$VL_E"); VTOK=${VLINK##*/}
t "send questionnaire: 303 sent; the dev sink holds a /vendor/<43-char token> link" bash -c "echo '$SENDR' | grep -q 'send=sent' && echo '$VLINK' | grep -qE '/vendor/[A-Za-z0-9_-]{43}\$'"
echo "--- smoke evidence: the questionnaire email as written to the dev sink"
node -e 'const fs=require("fs"),d=process.argv[1];for(const f of fs.readdirSync(d).sort()){const m=JSON.parse(fs.readFileSync(d+"/"+f,"utf8"));if(m.to===process.argv[2]&&/\/vendor\//.test(m.text))console.log(JSON.stringify(m))}' "$OUTBOX" "$VL_E" | tail -1
t "DB: only the sha256 of the token is stored, 30-day expiry, status sent" bash -c "[ \"\$(psql '$DATABASE_URL' -Atc \"select (invite_expires_at - invited_at = interval '30 days' and invite_token_hash = '\$(printf %s '$VTOK' | openssl dgst -sha256 | awk '{print \$NF}')' and questionnaire_status = 'sent')::text from vendors where id='$VL'\")\" = true ] && ! psql '$DATABASE_URL' -Atc \"select * from vendors where id='$VL'\" | grep -q '$VTOK'"
curl -s -D "$P7_HDR" -o "$P7_HTML" "$VLINK"; curl -s -o /dev/null "$VLINK"
t "GET /vendor/<token> (twice): 200 form in pt-BR with the company name and the not-a-legal-determination line; set no cookie" bash -c "head -1 '$P7_HDR' | grep -q ' 200' && grep -q 'Questionário de integridade' '$P7_HTML' && grep -q 'Smoke Settings Ltda' '$P7_HTML' && grep -q 'não é uma determinação legal' '$P7_HTML' && ! tr -d '\r' <'$P7_HDR' | grep -iq '^set-cookie'"
t "vendor page headers: private no-store, no-referrer, DENY, noindex" bash -c "H=\$(tr -d '\r' <'$P7_HDR') && echo \"\$H\" | grep -iq '^cache-control: private, no-store' && echo \"\$H\" | grep -iq '^referrer-policy: no-referrer' && echo \"\$H\" | grep -iq '^x-frame-options: DENY' && echo \"\$H\" | grep -iq '^x-robots-tag: noindex'"
t "GET did not consume the link: the hash is still stored, no response yet" bash -c "[ \"\$(psql '$DATABASE_URL' -Atc \"select (invite_token_hash is not null)::text || ',' || (select count(*) from vendor_responses where vendor_id='$VL') from vendors where id='$VL'\")\" = true,0 ]"

# submit: a validation error keeps the link; a good submit consumes it once
BADR=$(curl -s -X POST -F "token=$VTOK" -F via=js -F respondentName= -F respondentRole=CFO -F ownershipText=x -F pep=no -F sanctions=no -F antibribery=yes "$B/vendor/api/submit")
t "invalid answers: JSON errors (respondentName required), the link is NOT consumed, nothing stored" bash -c "echo '$BADR' | grep -q '\"respondentName\":\"required\"' && [ \"\$(psql '$DATABASE_URL' -Atc \"select (invite_token_hash is not null)::text || ',' || (select count(*) from vendor_responses where vendor_id='$VL') from vendors where id='$VL'\")\" = true,0 ]"
GOODR=$(curl -s -D "$P7_HDR" -X POST -F "token=$VTOK" -F via=js -F 'respondentName=Maria Silva Smoke' -F 'respondentRole=Diretora Financeira' -F 'ownershipText=Controlada por Holding Smoke SA (100%)' -F pep=yes -F 'pepDetails=Primo é prefeito (smoke 5d2c)' -F sanctions=no -F antibribery=yes "$B/vendor/api/submit")
t "submit: {ok:true}, no cookie set, no-store" bash -c "echo '$GOODR' | grep -q '\"ok\":true' && ! tr -d '\r' <'$P7_HDR' | grep -iq '^set-cookie' && tr -d '\r' <'$P7_HDR' | grep -iq '^cache-control: private, no-store'"
t "DB: the link is consumed (hash NULL), status submitted, exactly one response" bash -c "[ \"\$(psql '$DATABASE_URL' -Atc \"select (invite_token_hash is null)::text || ',' || questionnaire_status || ',' || (select count(*) from vendor_responses where vendor_id='$VL') from vendors where id='$VL'\")\" = true,submitted,1 ]"
AGAIN=$(curl -s -X POST -F "token=$VTOK" -F via=js -F respondentName=X -F respondentRole=X -F ownershipText=X -F pep=no -F sanctions=no -F antibribery=no "$B/vendor/api/submit")
G3=$(curl -s -w '\n%{http_code}' "$VLINK")
t "the used link: submit -> {invalid:true}; GET -> the friendly page (HTTP 200, no stack trace); still one response" bash -c "echo '$AGAIN' | grep -q '\"invalid\":true' && echo '$G3' | grep -q 'Este link não é mais válido' && echo '$G3' | tail -1 | grep -q '^200\$' && [ \"\$(psql '$DATABASE_URL' -Atc \"select count(*) from vendor_responses where vendor_id='$VL'\")\" = 1 ]"
t "the vendor answers are ciphertext in the database (no plaintext anywhere in the row), booleans plain" bash -c "R=\$(psql '$DATABASE_URL' -Atc \"select * from vendor_responses where vendor_id='$VL'\") && echo \"\$R\" | grep -q 'vsmoke:' && ! echo \"\$R\" | grep -qE 'Maria Silva|Diretora|Holding Smoke|prefeito|5d2c'"
echo "--- smoke evidence: the vendor_responses row exactly as stored (psql -x): ciphertext, no plaintext"
psql "$DATABASE_URL" -x -c "select id, company_id, vendor_id, submitted_at, left(respondent_name, 40) || '…' as respondent_name, left(respondent_role, 40) || '…' as respondent_role, left(ownership_text, 40) || '…' as ownership_text, pep_exposure, left(pep_details, 40) || '…' as pep_details, prior_sanctions, sanctions_details, antibribery_policy from vendor_responses where vendor_id='$VL'"
t "vendor_responses and vendor_screenings are append-only (UPDATE and DELETE rejected)" bash -c "psql '$DATABASE_URL' -qc \"update vendor_responses set pep_exposure=false where vendor_id='$VL'\" 2>&1 | grep -q 'append-only' && psql '$DATABASE_URL' -qc \"delete from vendor_responses where vendor_id='$VL'\" 2>&1 | grep -q 'append-only'"

# the admin sees the answers
curl -s -D "$P7_HDR" -b "$JAR5" "$B/dashboard/vendors/$VL" -o "$P7_HTML"
t "vendor detail (admin): the DECRYPTED answers, 'Respondido', private no-store" bash -c "grep -q 'Maria Silva Smoke' '$P7_HTML' && grep -q 'Controlada por Holding Smoke SA' '$P7_HTML' && grep -q 'Primo é prefeito (smoke 5d2c)' '$P7_HTML' && grep -q 'Respondido em' '$P7_HTML' && tr -d '\r' <'$P7_HDR' | grep -iq '^cache-control: private, no-store'"

# screening against the LOCAL STUB
: >"$STUBLOG"
S1=$(curl -s -o /dev/null -w '%{http_code} %{redirect_url}' -b "$JAR5" -X POST "$B/dashboard/vendors/$VL/screen")
curl -s -b "$JAR5" "$B/dashboard/vendors/$VL" -o "$P7_HTML"
t "(local stub) screen the listed vendor: 303 to its page, 'Possível correspondência — revisão necessária' with the match, 97%, list and entity id" bash -c "echo '$S1' | grep -q '^303 .*screen=possible_match' && grep -q 'Possível correspondência — revisão necessária' '$P7_HTML' && grep -q 'Listed Smoke Corp' '$P7_HTML' && grep -q '97%' '$P7_HTML' && grep -q 'smoke_sanctions' '$P7_HTML' && grep -q 'NK-SMOKE-1' '$P7_HTML'"
t "(local stub) the lists-and-date caveat is next to the result and the page never says approved/clear/safe" bash -c "grep -q 'Não é uma investigação de due diligence nem uma determinação legal' '$P7_HTML' && grep -q 'A ausência de resultados não comprova ausência de risco' '$P7_HTML' && ! grep -qiE 'aprovad|limpo|segur[oa]|approved' '$P7_HTML'"
S2=$(curl -s -o /dev/null -w '%{http_code} %{redirect_url}' -b "$JAR5" -X POST "$B/dashboard/vendors/$VQ/screen")
curl -s -b "$JAR5" "$B/dashboard/vendors/$VQ" -o "$P7_HTML"
t "(local stub) screen the other vendor: 'Nenhum resultado nas listas triadas em <data>'" bash -c "echo '$S2' | grep -q 'screen=no_match' && grep -qE 'Nenhum resultado nas listas triadas em [0-9]{1,2}/[0-9]{1,2}/[0-9]{4}' '$P7_HTML'"
N_BEFORE=$(wc -l <"$STUBLOG")
S3=$(curl -s -o /dev/null -w '%{http_code} %{redirect_url}' -b "$JAR5" -X POST "$B/dashboard/vendors/$VL/screen")
t "(local stub) a second click inside the cooldown is refused (screen=cooldown) and the stub saw NO new request" bash -c "echo '$S3' | grep -q 'screen=cooldown' && [ \"\$(wc -l <'$STUBLOG')\" = '$N_BEFORE' ]"
echo "500" >"$STUBMODE"
S4=$(curl -s -o /dev/null -w '%{http_code} %{redirect_url}' -b "$JAR5" -X POST "$B/dashboard/vendors/$VE/screen")
curl -s -b "$JAR5" "$B/dashboard/vendors/$VE" -o "$P7_HTML"
t "(local stub) provider returns 500: recorded as an error ('Falha na triagem', code upstream), NEVER as 'nenhum resultado'; the vendor cache says error" bash -c "echo '$S4' | grep -q 'screen=error' && grep -q 'Falha na triagem' '$P7_HTML' && grep -q 'upstream' '$P7_HTML' && ! grep -q 'Nenhum resultado nas listas triadas' '$P7_HTML' && [ \"\$(psql '$DATABASE_URL' -Atc \"select screening_result from vendors where id='$VE'\")\" = error ]"
rm -f "$STUBMODE"
t "(local stub) three runs in the history table: possible_match, no_match, error; the cache matches the latest run" bash -c "[ \"\$(psql '$DATABASE_URL' -Atc \"select string_agg(status, ',' order by status) from vendor_screenings where company_id='$CID'\")\" = 'error,no_match,possible_match' ] && [ \"\$(psql '$DATABASE_URL' -Atc \"select screening_result from vendors where id='$VL'\")\" = possible_match ]"
echo "--- smoke evidence (local stub): the vendor_screenings row of the listed vendor as stored (psql -x)"
psql "$DATABASE_URL" -x -c "select id, company_id, vendor_id, screened_at, provider, dataset, name_screened, status, match_count, matches, error_code, requested_by_user_id from vendor_screenings where vendor_id='$VL'"
echo "--- smoke evidence (local stub): the request the stub received for the listed vendor (Authorization value redacted by the stub)"
head -1 "$STUBLOG"
t "(local stub) the outgoing body carries ONLY the vendor name and country code; the Authorization header was present" bash -c "head -1 '$STUBLOG' | node -e 'let d=\"\";process.stdin.on(\"data\",c=>d+=c).on(\"end\",()=>{const r=JSON.parse(d);const q=r.body.queries;const p=q.q1.properties;const ok=r.method===\"POST\"&&r.url===\"/match/smoke\"&&r.authorization===\"ApiKey <redacted>\"&&Object.keys(r.body).join()===\"queries\"&&Object.keys(q).join()===\"q1\"&&Object.keys(q.q1).sort().join()===\"properties,schema\"&&Object.keys(p).sort().join()===\"country,name\"&&p.name[0]===process.argv[1]&&p.country[0]===\"BR\";process.exit(ok?0:1)})' '$V_LIST'"
t "(local stub) the API key is nowhere in the database or the server log" bash -c "! psql '$DATABASE_URL' -Atc \"select (select string_agg(v::text, '') from vendors v) || (select coalesce(string_agg(s::text, ''), '') from vendor_screenings s)\" | grep -q '$STUB_KEY' && ! grep -q '$STUB_KEY' '$LOG'"

# company 2 cannot see or touch company 1's vendors
t "company 2 admin: company 1's vendor page -> 404; send / archive / unarchive / screen -> 404; its own list shows none; nothing changed" bash -c "[ \"\$(code -b '$JAR3' $B/dashboard/vendors/$VL)\" = 404 ] && for a in send archive unarchive screen; do [ \"\$(code -b '$JAR3' -X POST $B/dashboard/vendors/$VL/\$a)\" = 404 ] || exit 1; done; ! curl -s -b '$JAR3' $B/dashboard/vendors | grep -q 'Smoke Corp' && [ \"\$(psql '$DATABASE_URL' -Atc \"select (archived_at is null)::text || ',' || count(*) from vendors v, vendor_screenings s where v.id='$VL' and s.vendor_id=v.id group by archived_at\")\" = true,1 ]"
t "no session: the vendor handlers answer 401 and the list redirects to /login" bash -c "[ \"\$(code -X POST $B/dashboard/vendors/$VL/screen)\" = 401 ] && [ \"\$(code -F name=x $B/dashboard/vendors/add)\" = 401 ] && curl -s -D - -o /dev/null $B/dashboard/vendors | tr -d '\r' | grep -iqE '^location: .*/login'"

# archive hides, never deletes; archived vendors are refused a questionnaire and a screening
curl -s -o /dev/null -b "$JAR5" -X POST "$B/dashboard/vendors/$VQ/archive"
t "archive: gone from the list, back under 'show archived', still in the table; screening it -> screen=archived" bash -c "! curl -s -b '$JAR5' $B/dashboard/vendors | grep -q '$V_QUIET' && curl -s -b '$JAR5' '$B/dashboard/vendors?show=archived' | grep -q '$V_QUIET' && [ \"\$(psql '$DATABASE_URL' -Atc \"select count(*) from vendors where id='$VQ'\")\" = 1 ] && curl -s -o /dev/null -w '%{redirect_url}' -b '$JAR5' -X POST $B/dashboard/vendors/$VQ/screen | grep -q 'screen=archived'"

# no provider configured: screening visibly unavailable, never a fake result; the questionnaire still works
N_BEFORE=$(wc -l <"$STUBLOG")
start_server "${FAKE_ENV[@]}"
curl -s -b "$JAR5" "$B/dashboard/vendors/$VL" -o "$P7_HTML"
S5=$(curl -s -o /dev/null -w '%{redirect_url}' -b "$JAR5" -X POST "$B/dashboard/vendors/$VL/screen")
S6=$(curl -s -o /dev/null -w '%{redirect_url}' -b "$JAR5" -X POST "$B/dashboard/vendors/$VL/send")
t "(no key) screening unavailable: the page says so and has no screen button, the click is refused, the stub saw nothing, the questionnaire can still be sent" bash -c "grep -q 'Triagem indisponível' '$P7_HTML' && ! grep -q '/screen\"' '$P7_HTML' && echo '$S5' | grep -q 'screen=unavailable' && [ \"\$(wc -l <'$STUBLOG')\" = '$N_BEFORE' ] && echo '$S6' | grep -q 'send=sent'"
kill $STUB_PID 2>/dev/null; wait $STUB_PID 2>/dev/null
rm -rf "$STUBDIR" "$P7_HTML" "$P7_HDR"

# ---------------------------------------------------------------------------------------------
# Phase 8: the dossier (binder) — generate -> poll -> download -> list -> immutability -> tenant
# isolation, then the file itself is opened (pdf.js) to prove what it contains and what it leaves
# out. Real Postgres, real HTTP through the standalone build, real session cookies. Company 1 =
# JAR5 (the one with the employees, the report and the vendors above), company 2 = JAR3.
# ---------------------------------------------------------------------------------------------
P8_DL=$(mktemp); P8_HDR=$(mktemp); P8_HTML=$(mktemp); P8_TXT=$(mktemp); P8A=$(mktemp); P8B=$(mktemp)
( curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' -b "$JAR5" -F stats=on -X POST "$B/dashboard/binder/generate" >"$P8A" ) &
P8_PID1=$!
( curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' -b "$JAR5" -F stats=on -X POST "$B/dashboard/binder/generate" >"$P8B" ) &
P8_PID2=$!
wait "$P8_PID1" "$P8_PID2"   # NOT a bare `wait`: that would also wait for the server process
t "two simultaneous clicks: both 303, one 'started' and one 'existing', exactly ONE binder row" bash -c "cat '$P8A' '$P8B' | grep -c '^303 ' | grep -q '^2\$' && cat '$P8A' '$P8B' | grep -q 'generate=started' && cat '$P8A' '$P8B' | grep -q 'generate=existing' && [ \"\$(psql '$DATABASE_URL' -Atc \"select count(*) from binders where company_id='$CID'\")\" = 1 ]"
BID=$(SQL "select id from binders where company_id='$CID' order by created_at limit 1")
P8_ST=$(curl -s -b "$JAR5" "$B/dashboard/binder/status?id=$BID")
t "right after the click the job is queued/running/ready (the request did not wait for the render)" bash -c "echo '$P8_ST' | grep -qE '\"status\":\"(queued|running|ready)\"'"
for _ in $(seq 1 240); do
  P8_ST=$(curl -s -b "$JAR5" "$B/dashboard/binder/status?id=$BID"); S=$(echo "$P8_ST" | JQ status)
  [ "$S" = ready ] || [ "$S" = failed ] && break; sleep 0.5
done
t "polling the status handler reaches ready (and nothing else is queued)" bash -c "[ '$S' = ready ] && [ \"\$(psql '$DATABASE_URL' -Atc \"select count(*) from binders where company_id='$CID' and status in ('queued','running')\")\" = 0 ]"
curl -s -D "$P8_HDR" -b "$JAR5" -o "$P8_DL" "$B/dashboard/binder/$BID/pdf"
P8_SIZE=$(wc -c <"$P8_DL" | tr -d ' ')
t "download: 200 attachment, application/pdf, no-store, nosniff, ASCII filename dossie-<slug>-YYYYMMDD.pdf; starts with %PDF; size matches the stored size" bash -c "tr -d '\r' <'$P8_HDR' | head -1 | grep -q ' 200' && tr -d '\r' <'$P8_HDR' | grep -iq '^content-type: application/pdf' && tr -d '\r' <'$P8_HDR' | grep -iqE '^cache-control: .*no-store' && tr -d '\r' <'$P8_HDR' | grep -iq '^x-content-type-options: nosniff' && tr -d '\r' <'$P8_HDR' | grep -iqE '^content-disposition: attachment; filename=\"dossie-[a-z0-9-]+-[0-9]{8}\.pdf\"\$' && head -c 5 '$P8_DL' | grep -q '%PDF-' && [ '$P8_SIZE' -gt 1000 ] && [ '$P8_SIZE' = \"\$(psql '$DATABASE_URL' -Atc \"select size_bytes from binders where id='$BID'\")\" ]"
P8_SHA=$(sha256sum "$P8_DL" | cut -d' ' -f1)
curl -s -b "$JAR5" "$B/dashboard/binder" -o "$P8_HTML"
t "the list shows the binder with a SHA-256 equal to sha256sum of the downloaded file, its page count, and the download link" bash -c "grep -q '$P8_SHA' '$P8_HTML' && [ \"\$(psql '$DATABASE_URL' -Atc \"select sha256 from binders where id='$BID'\")\" = '$P8_SHA' ] && grep -q '/dashboard/binder/$BID/pdf' '$P8_HTML' && grep -q 'O arquivo contém nomes de colaboradores e datas; compartilhe só com quem precisa.' '$P8_HTML'"
echo "--- smoke evidence: the binders row as stored (psql -x, PDF bytes shown as their length)"
psql "$DATABASE_URL" -x -c "select id, company_id, status, options, as_of, started_at, finished_at, error_code, size_bytes, page_count, sha256, length(pdf) as pdf_bytes from binders where id='$BID'"
t "the overview card links the latest binder" bash -c "curl -s -b '$JAR5' $B/dashboard | grep -q '/dashboard/binder/$BID/pdf'"
P8C=$(curl -s -o /dev/null -w '%{http_code} %{redirect_url}' -b "$JAR5" -X POST "$B/dashboard/binder/generate")
t "right after a finished job a new click is refused (cooldown) and nothing is created" bash -c "echo '$P8C' | grep -q 'generate=cooldown' && [ \"\$(psql '$DATABASE_URL' -Atc \"select count(*) from binders where company_id='$CID'\")\" = 1 ]"

# immutability: a direct SQL change to a ready binder is refused by the database itself
P8_UPD=$(psql "$DATABASE_URL" -c "update binders set error_code='x' where id='$BID'" 2>&1); P8_DEL=$(psql "$DATABASE_URL" -c "delete from binders where id='$BID'" 2>&1); P8_TRN=$(psql "$DATABASE_URL" -c "truncate binders" 2>&1)
echo "--- smoke evidence: direct SQL against the ready binder"; echo "$P8_UPD"; echo "$P8_DEL"; echo "$P8_TRN"
t "direct SQL UPDATE / DELETE / TRUNCATE on a ready binder all fail ('immutable'); the row and its hash are unchanged" bash -c "echo '$P8_UPD' | grep -q 'immutable' && echo '$P8_DEL' | grep -q 'immutable' && echo '$P8_TRN' | grep -q 'immutable' && [ \"\$(psql '$DATABASE_URL' -Atc \"select sha256 from binders where id='$BID'\")\" = '$P8_SHA' ]"

# tenant isolation + no session
t "company 2: company 1's binder download -> 404, status -> 404; its binder page shows neither the id nor the hash" bash -c "[ \"\$(code -b '$JAR3' $B/dashboard/binder/$BID/pdf)\" = 404 ] && [ \"\$(code -b '$JAR3' '$B/dashboard/binder/status?id=$BID')\" = 404 ] && H=\$(curl -s -b '$JAR3' $B/dashboard/binder) && ! echo \"\$H\" | grep -q '$BID' && ! echo \"\$H\" | grep -q '$P8_SHA'"
t "no session: binder download / status / generate answer 401, the page redirects to /login" bash -c "[ \"\$(code $B/dashboard/binder/$BID/pdf)\" = 401 ] && [ \"\$(code '$B/dashboard/binder/status?id=$BID')\" = 401 ] && [ \"\$(code -X POST $B/dashboard/binder/generate)\" = 401 ] && curl -s -D - -o /dev/null $B/dashboard/binder | tr -d '\r' | grep -iqE '^location: .*/login'"

# the FILE: open it and check what it says and what it leaves out
node --input-type=module -e '
import { readFileSync, writeFileSync } from "node:fs";
const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
const doc = await pdfjs.getDocument({ data: new Uint8Array(readFileSync(process.argv[1])), useSystemFonts: false, verbosity: 0 }).promise;
let out = [];
for (let i = 1; i <= doc.numPages; i++) { const c = await (await doc.getPage(i)).getTextContent(); out.push(c.items.map((x) => ("str" in x ? x.str + (x.hasEOL ? "\n" : " ") : "")).join("")); }
writeFileSync(process.argv[2], out.join("\n=====PAGE=====\n"));
const o = await doc.getOutline(); console.log("pages", doc.numPages, "outline entries", (o || []).length);
' "$P8_DL" "$P8_TXT"
P8_COMPACT=$(tr -d ' \n\t' <"$P8_TXT" | tr 'A-Z' 'a-z')
t "the PDF carries the company name, the active employees (Ana, Beto; Carla was deactivated earlier, so she is not listed) and the vendor" bash -c "grep -q 'Smoke Settings Ltda' '$P8_TXT' && grep -q 'Ana Smoke' '$P8_TXT' && grep -q 'Beto Smoke' '$P8_TXT' && ! grep -q 'Carla Smoke' '$P8_TXT' && grep -q '$V_LIST' '$P8_TXT'"
t "the PDF carries the channel URL (APP_URL + /report/<slug>) and the opt-in statistics total" bash -c "grep -q '$B/report/$SLUG1' '$P8_TXT' && grep -qE 'Relatos recebidos até a data da posição: [0-9]+' '$P8_TXT'"
t "the PDF carries 'Página 1 de N', the not-an-audit statement, the not-legal-advice line and the draft notice" bash -c "grep -qE 'Página 1 de [0-9]+' '$P8_TXT' && grep -q 'Não é uma auditoria, uma certificação nem um parecer jurídico' '$P8_TXT' && grep -q 'não constitui aconselhamento jurídico' '$P8_TXT' && grep -q 'RASCUNHO — pendente de revisão' '$P8_TXT'"
t "the PDF does NOT contain: employee e-mails, the acceptance IP, the disclosure text, the report text, the tracking code (formatted or raw), the vendor's answers, the vendor contact e-mails" bash -c "for needle in 'example.test' '203.0.113' 'minhaprima' 'descriçãosecreta' '$(echo "$RAW" | tr 'A-Z' 'a-z')' 'mariasilvasmoke' 'holdingsmokesa' 'primoéprefeito'; do echo '$P8_COMPACT' | grep -q \"\$needle\" && { echo \"leaked: \$needle\"; exit 1; }; done; exit 0"
t "the PDF says 'ferramenta de triagem, não uma investigação de due diligence' and contains no 'em conformidade' and no ISO 37301/37002" bash -c "grep -q 'ferramenta de triagem, não uma investigação de due diligence' '$P8_TXT' && ! grep -qiE 'em conformidade|ISO ?3730[12]' '$P8_TXT'"
rm -f "$P8_DL" "$P8_HDR" "$P8_HTML" "$P8_TXT" "$P8A" "$P8B"

rm -f "$JAR4" "$SO_HDR" "$JAR_OLD" "$JAR5"

rm -f "$JAR3" /tmp/pdf.hdr /tmp/doc1.pdf /tmp/st3.out

# failed payment path
R=$(curl -s -c "$JAR" -X POST -H 'content-type: application/json' --data "{\"country\":\"br\",\"companyName\":\"Fail Ltda\",\"taxId\":\"11222333000181\",\"billingEmail\":\"fail-$EMAIL\",$TERMS_JSON}" "$B/api/checkout"); FATT=$(echo "$R" | JQ attemptId)
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
rm -rf "$OUTBOX" "$UPLOADS" "$EVIDENCE" "$JAR" "$JAR_SAVED" "$JAR2" "$PNG" "$SVG" /tmp/wh.out /tmp/st.out
fi

[ "$fail" -eq 0 ] && echo "smoke: PASS (port $PORT)" || echo "smoke: FAIL (port $PORT)"
exit $fail
