# Handoff — Phase 2: database, auth, checkout, provisioning (PR #3)

Branch `phase-2-checkout` from `main` (c579dbb). PR: https://github.com/egaluzzi/compinabox/pull/3 — not merged, nothing pushed to `main`.
**Code tip: cd8e5ea** (`./verify.sh` was run on exactly this commit; the pushed tip adds only this file).

## Verification depth — read this first

| Layer | What was real | What was NOT |
| :- | :- | :- |
| Postgres | Real Postgres 16 (apt-installed in this session). `verify.sh` creates a fresh DB, runs `npm run db:migrate` from scratch (16 tables), runs the 154 tests and the smoke flow against it, drops it. | — |
| HTTP | Smoke drives the **standalone production build** (`node .next/standalone/server.js`) with curl + cookie jars: checkout, simulator, webhook, return, sign-in, onboarding, upload. | Not through Caddy or Cloudflare (no TLS, no `CF-IPCountry` from Cloudflare; geo headers simulated as in phase 1). |
| Payment processor | **No real payment processor was involved.** Only the `fake` provider (HMAC-signed webhooks, stateless signed payment refs). | Mercado Pago, Pix, real webhooks: phase 9b. |
| Email | Dev file sink (`EMAIL_DEV_SINK=true`) used in tests/smoke. | **Real Resend send NOT verified** (no account) — moves to phase 9. |
| Backups | `pg_dump` → gzip → local destination → restore into scratch DB → row counts compared (output below). | The `s3://` / `s3cmd` upload+prune branch and the systemd units were **not executed** (no s3cmd/Spaces/systemd here). Esteban installs and runs the first restore test (phase 9 gate). |

## Definition of done (supervisor's judgment items) → evidence

All of these are asserted twice: at unit/integration level (vitest, real DB) and live (smoke, real HTTP). Raw smoke lines are in the `./verify.sh` output below.

- **Replay creates no second Company** — `tests/payments.test.ts` (same event ×3 → `replay`, one company/user/billing row, one ledger row, one email; different event id on a paid attempt → `already_paid`; 5 concurrent paid events → exactly 1 `provisioned`). Smoke: `replayed webhook … no second company`, `payment_event ledger has the replayed event exactly once`.
- **Bad signature / unconfirmed "paid" claim provision nothing** — unit: bad sig → 401; validly-signed webhook whose payment ref is forged (other secret) → 422; ref vouched as `pending` → nothing; amount mismatch → 422; unknown attempt → 422. Smoke: `bad signature -> 401`, `valid signature but forged payment ref … -> 422`, `processor says pending -> nothing provisioned`.
- **Return URL alone never provisions** — `tests/return.test.ts` (polling a pending attempt creates nothing); smoke `return page + status poll before payment: still pending, nothing provisioned`. Only `handlePaymentWebhook` writes Company/User/BillingRecord.
- **Fake routes 404 / checkout unavailable without the flag** — `tests/fake-routes.test.ts` (4 configs: nothing set; `fake` only; `ALLOW_FAKE_PAYMENTS=false`; flag without secret → simulator + webhook 404, `/api/checkout` 503, no attempt row) and smoke (`ALLOW_FAKE_PAYMENTS unset: …` ×5 + default `none`).
- **Magic link single-use + expiry on the real DB** — `tests/auth.test.ts` drives the real Auth.js handlers: link emailed → first click sets session, second click refused; link expired by setting `expires` in the past → refused; TTL asserted 14–15 min. Welcome link (24 h): single use, valid at 24 h−1 min, dead at 24 h+1 min, concurrent use → exactly one winner, stored hashed. Smoke repeats single-use for both link types.
- **No account enumeration** — unit + smoke: known and unknown emails get the identical status+Location; nothing emailed and no user created for the unknown one. (Residual: a *send failure* is swallowed and logged, so it cannot distinguish either; timing difference not addressed.)
- **Cross-tenant** — `tests/tenant.test.ts`: two companies seeded in every tenant table (8), each listing returns only own rows both directions; unknown company id → empty; a test fails if a table with `company_id` is added to the schema but not to `TENANT_TABLES`; `/api/onboarding` with a foreign `companyId` in the form changes only the session's company (also live in smoke); no session → 401.
- **No secrets** — `git grep -iE "sk_live|sk_test|APP_USR-|TEST-[0-9a-f]{8}|re_[A-Za-z0-9]{20}" -- . ':!IMPLEMENTATION_PLAN.md' ':!verify.sh'` → exit 1, no matches (the only hits are the plan text and verify.sh's own grep pattern). verify.sh secrets check: `none found`.
- **Backup round trip** — raw output below.
- **DB tests fail, not skip** — see "Negative controls".

## What was built (by checklist item; all ticked in IMPLEMENTATION_PLAN.md)

Schema + migration `lib/db/migrations/0000_*.sql`; `lib/payments/{types,fake,index,webhook}.ts`; `lib/checkout/{attempt,return}.ts`; `lib/auth/{links,session,tenant}.ts` + `auth.ts`; `lib/email`; `lib/uploads.ts`; `lib/utm.ts`; `lib/tax-id.ts`; `lib/pricing.ts`; routes `/api/{checkout,checkout/status,webhooks/payments,fake-payments/[id],welcome,onboarding,auth/*}`, `/uploads/[name]`; pages `/checkout`, `/checkout/return`, `/checkout/fake/[id]`, `/login`, `/dashboard` (stub: session gate only), `/onboarding`; `scripts/backup.sh`, `scripts/restore-test.sh`, `ops/backup/*`. Pins: drizzle-orm 0.45.4, drizzle-kit 0.31.11, pg 8.23.1, next-auth 5.0.0-beta.32, @auth/drizzle-adapter 1.11.3, resend 6.32.1. CLAUDE.md §7 note updated.

## Judgment calls

1. **UTM only with `consent=accepted`** (as instructed). The proxy sets a 30-day `utm` cookie only then; it also sets it on the geo-redirect response from `/`. Limitation: the redirect from `/` drops the query string, so a visitor who lands on `/?utm_…` and accepts the banner *later* has lost the params (ad traffic should land on `/br`, where the banner-accept hook captures them). I did not append the query to the redirect (would change geo behaviour). Whole-touch replacement: a touch with any UTM param replaces the stored set.
2. **Return-token session binding**: random token in an httpOnly, SameSite=Lax cookie (24 h cookie life), SHA-256 hash stored on the attempt. Single-use is an atomic `UPDATE … WHERE used_at IS NULL AND expires_at > now() RETURNING`. The 1 h expiry runs **from payment time** (set at provisioning), not from attempt creation, because a slow payer would otherwise never get the instant sign-in. Tested: wrong/absent/reused/expired/other-attempt's token.
3. **Fake payment refs are stateless signed tokens** (`base64url(json{attemptId,amount,currency,status}).hmac`): `fetchPayment` verifies the signature, no table. The attempt's `provider_ref` holds the "pending" ref; the simulator mints a new ref with the chosen status. Webhook body `{eventId, paymentRef}` is HMAC-SHA256-signed in header `x-fake-signature`.
4. **Idempotency has two layers**: `payment_event.event_key` unique (`fake:<eventId>`) *and* a row lock on the attempt (`SELECT … FOR UPDATE`) so different event ids for one attempt cannot double-provision (the plan only required the first). `payment_event` is a single `event_key` column instead of a composite unique, because verify.sh 4b's awk cannot parse a third `pgTable` argument.
5. **Welcome link is our own route** `/api/welcome?token=` (hashed token in `verification_tokens`, identifier `welcome:<email>`), not Auth.js's, so it can have a 24 h TTL while sign-in links keep 15 min. Both are single-use. Known limitation: link scanners that GET the URL will burn it; the user then requests a sign-in link at `/login`.
6. **Email already has an account**: refused at attempt creation (`email_in_use`, with a sign-in link). If the race happens anyway (email registered between attempt and payment), the payment is recorded, the attempt is marked `failed` with `failure_reason=email_in_use_after_payment`, a loud `PAID BUT NOT PROVISIONED` error is logged, and no second company is created. **This needs a human (refund/merge) — Esteban's call on the policy**; flagged under Open questions.
7. **Session lifetime 7 days** (JWT), not Auth.js's 30-day default — whistleblower data, admins log in rarely. Session cookie issued by our own flows is built with Auth.js's own `encode`, tested to round-trip through its `decode`.
8. **`EMAIL_DEV_SINK=true` takes precedence over Resend** and logs a warning once; with neither it throws. (If someone sets the flag in production, mail goes to disk — it is in `.env.example` as `false` and named dev/CI only.) Added `EMAIL_SINK_DIR` (default `.dev-outbox`) so tests/smoke use temp dirs.
9. **Sign-in email send failures are swallowed and logged** (to keep the response identical for known/unknown emails). A misconfigured sender therefore shows up only in logs.
10. **`/checkout?c=br`** (per notes); pricing CTA updated from `?country=` to `?c=`. Checkout page language follows the country in the query (else cookies), but the layout shell/footer still follows cookies, so a BR visitor with no cookies sees a Portuguese form inside an English footer. Not fixed (would touch the phase 1 layout).
11. **Placeholder price** BRL 10.00 (ARS/MXN same numbers) with `isPlaceholder: true`; "TEST PRICE" badge in the page; non-fake providers refused. No pricing decision made.
12. **Dashboard/onboarding live in a third root-layout group `app/(app)/`** (needed: Next requires a root layout per top-level group). `/dashboard` is a stub that redirects to `/login` (no session) or `/onboarding` (profile incomplete). `/login` added to `robots.txt` disallow.
13. **Waitlist**: unique on lower-cased email, repeat = silent no-op with the same response; console.log removed; tests rewritten to assert against the DB (and that nothing is logged).
14. **Uploads**: PNG/JPEG/WebP by magic bytes, ≤ 1 MB (exactly 1 MB accepted), random 16-byte hex name, content-type derived from the validated name, `nosniff` + `default-src 'none'; sandbox` CSP. Logos are served publicly (unguessable name) — they will appear on the public whistleblower page later.
15. **New UI strings** (checkout form/return/simulator, login, onboarding, industries, dashboard stub, emails) added to all 4 `messages/*.json` and listed in `messages/DRAFTS.md` (244 rows; counts refreshed). `checkout.returnPaid` is verbatim CONTENT.md in es-AR/es-MX; en/pt-BR are drafts. The simulator page is English-only (developer tool).
16. **vitest config**: `server.deps.inline: ["next-auth"]` (the beta imports `next/server` without extension; needed to run the real Auth.js handlers in tests).
17. **`fetchPayment` error mapping**: `PaymentNotFound` → 422, `PaymentLookupUnavailable` → 503 (processor retries).
18. Encryption-at-rest of `whistleblower_reports.description/reporter_contact` is **not** done here (schema shape only, noted in a comment) — phase 5. The schema has no IP/user-agent column on that table.
19. Verify.sh allowlist includes both singular and plural names (`checkout_attempt|checkout_attempts|payment_event|payment_events`). The CI `TEST_DATABASE_URL` is assembled from `$PGPASSWORD` at runtime so no `postgres://user:pass@` literal exists in the repo (verify.sh secret grep would flag it; the CI Postgres is a throwaway service container).

## Not done (out of scope per notes)

Real Mercado Pago provider (phase 9b); Stripe; dashboard pages beyond the stub; document generation; whistleblower/employee/vendor anything; deploy/Caddy/systemd except the backup timer; GTM. CUIT/RFC validators are `NotYetEnabled`.

## Open questions

- Policy for "paid but email already registered" (judgment call 6): refund manually? attach a second company to the existing user (needs multi-company users — v2)? Rare, but it is money.
- Is a 7-day session acceptable, and is a 1 h post-payment instant-sign-in window acceptable? (Both are cheap to change.)
- Welcome-link scanners (judgment call 5): if Resend click-tracking/Gmail prefetch proves a problem in phase 9, switch the link to a GET→confirm-page→POST pattern.

## Negative controls

```
$ ./verify.sh   # with TEST_DATABASE_URL unset (SKIP_BUILD=1), HEAD cd8e5ea
--- database
database                   FAIL: TEST_DATABASE_URL is not set — DB-backed tests must fail, not skip
 Test Files  7 failed | 7 passed (14)
      Tests  74 passed | 80 skipped (154)
counts                     total=154 pass=74 fail=0 skip=80
tests                      FAIL: nonzero exit (1)
--- result
verify.sh: FAIL (HEAD cd8e5ea)
```
(7 suites fail to load because `useTestDb()` throws; vitest reports their tests as skipped *inside failed files* — the run fails, exit nonzero. Nothing passes silently.)

```
$ 4b negative control: appended `pgTable("leaky", { id })` to schema.ts and ran verify.sh's awk
leaky            <- flagged (schema restored afterwards)
```

## Backup round trip (raw, `BACKUP_DEST=local:`, real Postgres; includes prune and failure case)

```
$ git grep -iE "sk_live|sk_test|APP_USR-|TEST-[0-9a-f]{8}|re_[A-Za-z0-9]{20}" -- . ":!IMPLEMENTATION_PLAN.md" ":!verify.sh"
exit=1 (1 = no matches)

$ ls (before)
complystart-20260901T000000Z.sql.gz
complystart-20261009T000000Z.sql.gz
$ scripts/backup.sh   # BACKUP_DEST=local:<dir>, BACKUP_KEEP_DAYS default 30
/tmp/tmp.lGjZrkNjbn/complystart-20260901T000000Z.sql.gz
backup ok: complystart-20261014T112806Z.sql.gz (159932 bytes) -> local:/tmp/tmp.lGjZrkNjbn
$ ls (after: 40-day-old pruned, 5-day-old kept, new dump added)
complystart-20261009T000000Z.sql.gz
complystart-20261014T112806Z.sql.gz

--- source row counts (psql)
companies         334
users             334
billing_records   193
checkout_attempt  325
payment_event     247
waitlist_leads    48
$ scripts/restore-test.sh <new dump>   # restores into a scratch database, then drops it
table                  source  restored
accounts                    0       0
acknowledgments            24      24
billing_records           193     193
checkout_attempt          325     325
companies                 334     334
disclosures                24      24
documents                  24      24
employees                  24      24
payment_event             247     247
sessions                    0       0
training_completions       24      24
users                     334     334
vendors                    24      24
verification_tokens       225     225
waitlist_leads             48      48
whistleblower_reports      24      24
restore-test: PASS (all row counts match)
exit=0

$ gzip -t on the dump
gzip ok

--- failed backup (nonexistent DB): nonzero exit, nothing uploaded
pg_dump: error: connection to server at "localhost" (127.0.0.1), port 5432 failed: FATAL:  database "nonexistent" does not exist
exit=1
files before=2 after=2
leftover scratch databases: 0
```

## verify.sh edits (permitted four only) — diff of `verify.sh` and `.github/workflows/ci.yml`

(Also: `scripts/smoke.sh` extended with the live checkout flow, as permitted.)

```diff
diff --git a/.github/workflows/ci.yml b/.github/workflows/ci.yml
index c5a1253..17ec466 100644
--- a/.github/workflows/ci.yml
+++ b/.github/workflows/ci.yml
@@ -8,6 +8,20 @@ on:
 jobs:
   verify:
     runs-on: ubuntu-latest
+    services:
+      postgres:
+        image: postgres:16
+        env:
+          POSTGRES_PASSWORD: postgres
+        ports:
+          - 5432:5432
+        options: >-
+          --health-cmd "pg_isready -U postgres"
+          --health-interval 5s
+          --health-timeout 5s
+          --health-retries 10
+    env:
+      PGPASSWORD: postgres
     steps:
       - uses: actions/checkout@v4
         with:
@@ -17,4 +31,7 @@ jobs:
           node-version-file: .nvmrc
           cache: npm
       - run: npm ci
+      # verify.sh creates a fresh database in this server, migrates it, and runs DB-backed tests + smoke against it.
+      - name: Point tests at the postgres service
+        run: echo "TEST_DATABASE_URL=postgres://postgres:${PGPASSWORD}@localhost:5432/postgres" >> "$GITHUB_ENV"
       - run: ./verify.sh
diff --git a/verify.sh b/verify.sh
index bee492d..07fb1ad 100755
--- a/verify.sh
+++ b/verify.sh
@@ -40,6 +40,38 @@ else
 fi
 [ -f .env.example ] && note ".env.example" "present" || bad ".env.example" "missing"
 
+# --- 2b. Database: fresh Postgres, migrated from scratch --------------------
+# Once lib/db/schema.ts exists, DB-backed tests and the live smoke flow need a real Postgres.
+# TEST_DATABASE_URL points at a server that may CREATE DATABASE; a fresh database is created for
+# this run, migrated with `npm run db:migrate`, and dropped on exit. Unset = FAIL (never skip).
+hr "database"
+DB_CLEANUP=""
+if [ -f lib/db/schema.ts ]; then
+  if [ -z "${TEST_DATABASE_URL:-}" ]; then
+    bad "database" "TEST_DATABASE_URL is not set — DB-backed tests must fail, not skip"
+  else
+    ADMIN_URL=${TEST_DATABASE_URL%%\?*}
+    FRESH_DB="verify_$(date +%s)_$$"
+    if psql "$ADMIN_URL" -qv ON_ERROR_STOP=1 -c "CREATE DATABASE \"$FRESH_DB\"" >/tmp/verify-createdb.log 2>&1; then
+      DB_CLEANUP="psql \"$ADMIN_URL\" -qc 'DROP DATABASE IF EXISTS \"$FRESH_DB\" WITH (FORCE)' >/dev/null 2>&1"
+      export TEST_DATABASE_URL="${ADMIN_URL%/*}/$FRESH_DB"
+      export DATABASE_URL="$TEST_DATABASE_URL"
+      note "fresh database" "$FRESH_DB"
+      if npm run -s db:migrate >/tmp/verify-migrate.log 2>&1; then
+        note "db:migrate" "ok (from scratch)"
+        note "tables created" "$(psql "$DATABASE_URL" -Atc "select count(*) from information_schema.tables where table_schema='public'")"
+      else
+        tail -20 /tmp/verify-migrate.log; bad "db:migrate" "failed against a fresh database"
+      fi
+    else
+      cat /tmp/verify-createdb.log; bad "database" "could not create a fresh database via TEST_DATABASE_URL"
+    fi
+  fi
+else
+  note "database" "no schema yet (pre-phase 2)"
+fi
+trap '[ -n "$DB_CLEANUP" ] && eval "$DB_CLEANUP"' EXIT
+
 # --- 3. Lint / typecheck / tests / build -----------------------------------
 hr "lint"
 if npm run -s lint >/tmp/verify-lint.log 2>&1; then note "lint" "ok"; else tail -20 /tmp/verify-lint.log; bad "lint" "see above"; fi
@@ -99,7 +131,7 @@ if [ -f lib/db/schema.ts ]; then
     note "migration drift" "schema unchanged"
   fi
   # 4b. Tenant tables must carry company_id. Any pgTable whose block lacks company_id, except the allowlist.
-  ALLOW='^(company|companies|user|users|waitlist_lead|waitlist_leads|session|sessions|account|accounts|verification_token|verification_tokens)$'
+  ALLOW='^(company|companies|user|users|waitlist_lead|waitlist_leads|session|sessions|account|accounts|verification_token|verification_tokens|checkout_attempt|checkout_attempts|payment_event|payment_events)$'
   MISSING=$(awk '
     /pgTable\(/ { inblk=1; name=$0; sub(/.*pgTable\(["'"'"']/,"",name); sub(/["'"'"'].*/,"",name); has=0; next }
     inblk && /company_id|companyId/ { has=1 }
```

## `./verify.sh` — raw output on HEAD cd8e5ea (exit 0)

```
--- commit state
current HEAD               cd8e5ea  (2026-10-14T11:27:04+00:00)
branch                     phase-2-checkout
comparing against          c579dbb
commits this pass          6
uncommitted changes        0 file(s)
test files changed          11 files changed, 1602 insertions(+), 30 deletions(-)
--- secrets
secrets                    none found
.env.example               present
--- database
fresh database             verify_1791977229_5550
db:migrate                 ok (from scratch)
tables created             16
--- lint
lint                       ok
--- typecheck
typecheck                  ok
--- tests
 Test Files  14 passed (14)
      Tests  154 passed (154)
   Start at  11:27:19
   Duration  4.59s (import 36%, environment 21%, tests 20%, setup 18%, transform 4%, worker 1%)

     Import  84 modules were evaluated 193 times · 3.89s total, 36% of tracked time
             ~302ms faster with isolate: false — shared modules are evaluated once per worker instead of once per file
             learn more: https://vitest.dev/guide/improving-performance#test-isolation
test exit code             0
counts                     total=154 pass=154 fail=0 skip=0
--- build
build                      ok
standalone output          present
--- smoke
ok    BR header -> redirect to /br
ok    AR header -> redirect to /ar
ok    DE header -> 200 on /
ok    cookie country=mx beats BR header
ok    deep link /ar/pricing not redirected (200)
ok    /ar carries noindex (disabled country)
ok    /br has no noindex (enabled country)
ok    sitemap.xml has <loc> entries
ok    sitemap.xml excludes disabled /ar
ok    cookie country=other + BR header -> 200, no redirect
ok    redirect status is 307
ok    redirect carries cache-control: no-store
ok    invalid country cookie ignored, header decides
ok    /checkout -> 200
ok    /legal/terms -> 200
ok    /zz -> 404
ok    /pt-BR -> 404
ok    robots.txt disallows /dashboard
ok    robots.txt disallows /employee
ok    robots.txt disallows /checkout
ok    robots.txt disallows /onboarding
ok    ENABLED_COUNTRIES=br,ar at runtime: /ar has no noindex
ok    ENABLED_COUNTRIES=br,ar at runtime: /mx still noindex
ok    /checkout?c=br shows the form and the TEST PRICE label
ok    /checkout?c=ar refused (not in ENABLED_COUNTRIES): no form
ok    /dashboard without a session redirects to /login
ok    /onboarding without a session redirects to /login
ok    POST /api/checkout -> attempt id + hosted-checkout URL
ok    return_token cookie is httpOnly
ok    DB: attempt is pending, 0 companies for that email
ok    invalid CNPJ -> 422 invalid_tax_id
ok    simulator page renders Pay/Fail buttons
ok    return page + status poll before payment: still pending, nothing provisioned
ok    bad signature -> 401
ok    valid signature but forged payment ref (processor does not confirm) -> 422
ok    processor says pending -> nothing provisioned
ok    simulator Pay -> 303 back to /checkout/return
ok    DB: attempt paid, 1 admin user, 1 company, 1 billing record
ok    replayed webhook (new event, already paid) -> 200, no second company
ok    payment_event ledger has the replayed event exactly once
ok    status poll after payment: paid + signed in (session cookie issued)
ok    /onboarding reachable with that session
ok    return token is single-use: reuse -> paid but NOT signed in
ok    no cookie at all -> paid but NOT signed in
ok    welcome email landed in the dev outbox with a link
ok    welcome link: first use signs in (303 -> /onboarding + session cookie)
ok    welcome link: second use is refused (-> /login?error)
ok    sign-in: known and unknown emails get the identical response
ok    sign-in: link emailed to the known address only
ok    sign-in link: first use sets a session
ok    sign-in link: second use is refused
ok    /dashboard with the sign-in session redirects to /onboarding (profile incomplete)
ok    onboarding with an SVG disguised as .png is rejected (error=logo)
ok    onboarding with a PNG saves it, ignoring a foreign company id
ok    DB: only the session's company was renamed
ok    uploaded logo served with fixed content-type + nosniff
ok    /dashboard now loads for the signed-in admin
ok    simulator Fail -> attempt failed, nothing provisioned, status endpoint says failed
ok    ALLOW_FAKE_PAYMENTS unset: simulator page 404
ok    ALLOW_FAKE_PAYMENTS unset: simulator action 404
ok    ALLOW_FAKE_PAYMENTS unset: webhook endpoint 404
ok    ALLOW_FAKE_PAYMENTS unset: POST /api/checkout -> 503 unavailable
ok    ALLOW_FAKE_PAYMENTS unset: /checkout?c=br shows 'unavailable', no form
ok    PAYMENT_PROVIDER unset (default none): /checkout?c=br unavailable too
smoke: PASS (port 32847)
smoke                      ok
--- invariants
migration drift            schema changed, migration present
tenant isolation           all tenant tables carry company_id
forbidden claims           none
geo                        CF-IPCountry only
urls                       no locale codes in paths
KNOWN_ISSUES.md            present
--- result
verify.sh: PASS (HEAD cd8e5ea)
```

## CI

`ci.yml` (with the new `postgres:16` service) is running on the PR head; result recorded in the PR (see checks). If it is red when you read this, treat that as authoritative over this file.
