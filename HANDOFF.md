# Handoff — Phase 2 follow-up: restore-test.sh (PR #3), 2026-10-14

Scope: only the defect in SUPERVISOR_NOTES.md (origin/main aa6695c). Nothing else touched. Not merged.
**Code tip: 94e7f9f** (`./verify.sh` run on exactly this commit). The pushed tip is one commit later and adds only this file. I merged `origin/main` into the branch first (a3dce66) to pick up the notes; that merge touched only CLAUDE.md / IMPLEMENTATION_PLAN.md / SUPERVISOR_NOTES.md, none of my files.

## What changed
`scripts/restore-test.sh` no longer reads the live database or needs `DATABASE_URL`; only `SCRATCH_ADMIN_URL` is required. It now: `gzip -t`s the dump; parses the dump (`CREATE TABLE` gives the table list, each `COPY … FROM stdin;` block up to `\.` gives that table's row count); restores into a scratch DB with `ON_ERROR_STOP`; counts every user-schema table in the restored DB; prints `in dump` / `restored`; fails on any psql error, any mismatch, or a table on one side only (`MISSING`), naming the table(s). README "Restore" step 2 rewritten (what PASS / FAIL / PASS-does-not-mean say).

One thing the notes did not anticipate: the dump also contains `drizzle.__drizzle_migrations` (schema `drizzle`), so the first version (public only) false-FAILed on it. Fixed by comparing schema-qualified names across all user schemas. (Caught by running it.)

Diff: `git diff 186163a..94e7f9f -- scripts/restore-test.sh README.md` (59-line script rewrite, 6-line README change).

## Evidence (raw, real Postgres 16, local backup destination)

(1) PASS on a fresh dump; (2) PASS on that same older dump after inserting 2 waitlist rows + 1 company into the live DB (live now 50 / 335, dump says 48 / 334 — the old false-FAIL case); (4) no leftover scratch DBs:
```
=== (1) PASS on a fresh dump
backup ok: complystart-20261014T114611Z.sql.gz (159919 bytes) -> local:/tmp/tmp.Z0IRlDeNd5
table                     in dump   restored
drizzle.__drizzle_migrations        1          1
public.accounts                 0          0
public.acknowledgments         24         24
public.billing_records        193        193
public.checkout_attempt       325        325
public.companies              334        334
public.disclosures             24         24
public.documents               24         24
public.employees               24         24
public.payment_event          247        247
public.sessions                 0          0
public.training_completions       24         24
public.users                  334        334
public.vendors                 24         24
public.verification_tokens      225        225
public.waitlist_leads          48         48
public.whistleblower_reports       24         24
restore-test: PASS (every table restored with the row count recorded in the dump)
exit=0

=== (2) PASS on that OLD dump after inserting rows into the live DB
live waitlist_leads now: 50  companies: 335
table                     in dump   restored
drizzle.__drizzle_migrations        1          1
public.accounts                 0          0
public.acknowledgments         24         24
public.billing_records        193        193
public.checkout_attempt       325        325
public.companies              334        334
public.disclosures             24         24
public.documents               24         24
public.employees               24         24
public.payment_event          247        247
public.sessions                 0          0
public.training_completions       24         24
public.users                  334        334
public.vendors                 24         24
public.verification_tokens      225        225
public.waitlist_leads          48         48
public.whistleblower_reports       24         24
restore-test: PASS (every table restored with the row count recorded in the dump)
exit=0

=== (3) FAIL on a corrupted dump (3 data lines deleted inside the waitlist_leads COPY block)
exit=0
restore-test: PASS (every table restored with the row count recorded in the dump)

=== (3b) FAIL on a dump with a broken statement (psql error -> ON_ERROR_STOP)
exit=3
ERROR:  syntax error at or near "TABEL"
LINE 1: CREATE TABEL public.vendors (
               ^

=== (4) leftover scratch databases
leftover: 0
```
(3) FAIL on corrupted dumps. **Deviation from the notes — please read:** the notes' example (delete data lines inside a COPY block) cannot fail with this design, because the expected count is read from that same dump: dump and restore agree on the reduced count (case v below, PASS, shown deliberately). A count taken *from the dump* can only detect damage that changes what restores, so I demonstrated those instead; each FAILs and names the table (or the COPY target):
```
=== (3-i) corrupted: a data line inside the waitlist_leads COPY block loses a column
exit=3
ERROR:  missing data for column "created_at"
CONTEXT:  COPY waitlist_leads, line 1: "c5b54211-b2f4-4e51-a609-dd44874bd444	ana-866070c4@example.com	ar"

=== (3-ii) corrupted: dump truncated mid-file
exit=3
ERROR:  missing data for column "amount_cents"
CONTEXT:  COPY checkout_attempt, line 131: "48c44708-2403-4ae6-8757-ee86026af622	fake	eyJhdHRlbXB0SWQiOiI0OGM0NDcwOC0yNDAzLTRhZTYtODc1Ny1lZTg2MD..."

=== (3-iii) corrupted: gzip stream cut
exit=1
gzip: /tmp/tmp.xFMI9RZSed/c3.sql.gz: unexpected end of file

=== (3-iv) table in dump but absent after restore (DROP TABLE appended to the dump)
exit=1
public.vendors                 24    MISSING  <-- MISMATCH
restore-test: FAIL (mismatch in: public.vendors )

=== (3-v) NOT detectable by design: 3 whole data lines deleted from a COPY block (dump and restore agree)
exit=0
restore-test: PASS (every table restored with the row count recorded in the dump)

=== (4) leftover scratch databases
leftover: 0
```

## `./verify.sh` — raw output on code commit 94e7f9f (exit 0)
```
--- commit state
current HEAD               94e7f9f  (2026-10-14T11:46:43+00:00)
branch                     phase-2-checkout
comparing against          aa6695c
commits this pass          10
uncommitted changes        0 file(s)
test files changed          11 files changed, 1602 insertions(+), 30 deletions(-)
--- secrets
secrets                    none found
.env.example               present
--- database
fresh database             verify_1791978405_1010
db:migrate                 ok (from scratch)
tables created             16
--- lint
lint                       ok
--- typecheck
typecheck                  ok
--- tests
 Test Files  14 passed (14)
      Tests  154 passed (154)
   Start at  11:47:08
   Duration  6.55s (import 34%, environment 23%, tests 22%, setup 16%, transform 5%, worker 1%)

     Import  84 modules were evaluated 192 times · 5.34s total, 34% of tracked time
             ~426ms faster with isolate: false — shared modules are evaluated once per worker instead of once per file
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
smoke: PASS (port 43805)
smoke                      ok
--- invariants
migration drift            schema changed, migration present
tenant isolation           all tenant tables carry company_id
forbidden claims           none
geo                        CF-IPCountry only
urls                       no locale codes in paths
KNOWN_ISSUES.md            present
--- result
verify.sh: PASS (HEAD 94e7f9f)
```

## CI
Run 38559106019 on head 94e7f9f (code tip): see the PR checks; result recorded below if it had finished when I pushed this file.

## Open questions
- Detecting a dump that is *missing data* (case v) needs an independent count taken at dump time. Option: `backup.sh` appends a manifest of per-table counts (from one `REPEATABLE READ` snapshot, same as pg_dump's) inside the archive, and restore-test compares against it. Small change, not done (out of scope). Without it, the monthly test proves "restores cleanly and completely as written", not "matches the DB at dump time".
- The `s3://` branch of backup.sh and the systemd units remain unexecuted (no s3cmd/Spaces/systemd here) — unchanged from the Phase 2 report.
