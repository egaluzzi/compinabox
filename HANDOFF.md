# Handoff — Phase 7: vendor questionnaire + sanctions screening, 2026-10-16

**LIVE CHECK NOT RUN — needs SCREENING_API_KEY and network access to api.opensanctions.org.** This session has no key, and the environment's proxy refuses the host (`curl: (56) CONNECT tunnel failed, response 403`). Every screening result below is against a **local stub** and is labelled so; none of it is evidence about the real service. The phase is **built, not accepted** until `scripts/screening-live-check.sh` has run (follow-up task, not a rebuild).

Branch `phase-7-vendor-screening` (from `origin/claude/trusting-lamport-aq0f52`), PR to `main`, **not merged**. The PR **also contains the phase 5 and 6 commits until PRs #7/#8 merge**.
**Code tip: 5109983** — `./verify.sh` ran on exactly this commit (exit 0, output below). Commits after it touch only `HANDOFF.md`.
Guardrails touched, all settled by the notes — **nothing blocked**: tenant isolation (every vendor query filters by the session company; cross-tenant → 404), third-party data egress (vendor name + optional country only), encryption at rest (questionnaire free text), append-only evidence, no verdict wording, anonymity-style rule for the public vendor paths. One migration (`0006_vendor_screening.sql`), **no new dependency**; env: `SCREENING_BASE_URL`, `SCREENING_DATASET` added to `.env.example` (already in CLAUDE.md §6).

## What changed

**Migration `0006_vendor_screening.sql`** (generated, then the triggers appended by hand; `drizzle-kit generate` reports no drift)
- `vendors`: + `country`, `tax_id`, `contact_name`, `contact_email` (lower-cased), `invited_at`, `invite_expires_at`, `invite_token_hash`, `submitted_at`, `archived_at`, `created_at`; CHECK `questionnaire_status in (not_sent, sent, submitted)` ("expired" is derived in code). Safe on existing rows (all new columns nullable or defaulted).
- New `vendor_responses` (five encrypted text columns, three plain booleans) and `vendor_screenings` (status CHECK, `matches` jsonb of ≤ 10 `{id, caption, score, datasets, topics}`, fixed `error_code`); both have `company_id`, are in `TENANT_TABLES`, and have **append-only triggers** (UPDATE/DELETE/TRUNCATE rejected), same pattern as 0002/0004/0005.

**lib/screening/** — `types.ts` (`ScreeningProvider`, `ScreeningOutcome`), `opensanctions.ts` (client; `mapResponse`; https-only base URL guard), `index.ts` (`getScreeningProvider()`: OpenSanctions when `SCREENING_API_KEY` is set and not `changeme`, else an `available: false` provider; **no fake provider in production code**), `constants.ts` (cooldown 5 min, cap 50/UTC day, 10 s timeout, 10 matches, 0.7 score — one place). Files import siblings with `.ts` extensions and avoid constructor parameter properties so `scripts/screening-live-check.sh` can run them under Node's strip-only TypeScript.
**lib/vendors/** — `answers.ts` (validation + AES-GCM encrypt/decrypt, AAD `vendor_responses:<company_id>:<field>`), `queries.ts` (tenant-scoped CRUD, detail, derived state), `invites.ts` (email-first send; `questionnaireEmail`), `submit.ts` (read-only `findOpenLink`; atomic `submitQuestionnaire`), `screen.ts` (guards → one provider call → history row + vendor cache in one transaction), `summary.ts` (`summarizeVendors`, for the phase 8 binder), `constants.ts`.
**Public side** — `app/vendor/` (own root layout, no marketing chrome/cookies/banner): `[token]` form page (GET consumes nothing), `api/submit` (POST), `link-invalid`, `thanks`; `components/vendor/VendorForm.tsx` (client form; typed answers live in component state so errors never lose them; works without JS via redirects). Headers for `/vendor/:path*` in `next.config.ts` and set by the handler itself; `/vendor` added to robots.
**Dashboard** — `/dashboard/vendors` (add form, list with questionnaire + screening state, send/resend, archive/unarchive, "show archived"), `/dashboard/vendors/[id]` (profile, decrypted latest answer + history, screening history with matches, screen button or "unavailable"); handlers `add`, `[id]/send|archive|unarchive|screen` — every one through `requireTenantRoute`, ids are lookup keys combined with the session company, cross-tenant → 404.
**Phase 5/6 code touched (as the notes asked):** `lib/whistleblower/rotate.ts` re-encrypts the five `vendor_responses` columns (same sanctioned trigger-off-inside-the-transaction pattern; counts only; `RotateCounts.seen.vendorResponses`), `AAD_TABLES.vendorResponses` next to the others, `scripts/rotate-report-key.ts` prints the new count, README line.
**Messages** — 104 new keys × 4 locales (`vendor.*`, `dashboard.vendors.*`, `email.vendor*`), 416 rows appended to `messages/DRAFTS.md`. pt-BR is primary; es-AR and es-MX carry one shared neutral Spanish text (the three required pt-BR state strings and the disclaimer are verbatim from the notes).
**verify.sh** — new block 4k: `scripts/check-vendor-privacy.sh` (new; same pattern as `check-anonymity.sh` plus `headers.get`, scanning `app/vendor`, `components/vendor`, `lib/vendors/submit.ts`, `lib/vendors/answers.ts`); no `console.*` in `lib/screening`; `SCREENING_API_KEY` read in exactly one file (`lib/screening/index.ts`). The forbidden-claims grep (4d) now also scans `lib/screening` and `lib/vendors` (`app` was already scanned). **README** gained "Vendors: questionnaire and sanctions screening".
**scripts/smoke.sh** — only this edit: the Phase 7 section (labelled "(local stub)" where it concerns screening). **scripts/screening-live-check.sh** — new.
**Existing tests touched** (all because of this phase, none weakened): `tests/tenant.test.ts` (seeds the two new tables), `tests/dashboard-gate.test.ts` (new entry list), `tests/dashboard-headers.test.ts` (excludes `/vendor` rules), `tests/dashboard-routes.test.tsx` and `tests/session-revocation.test.tsx` (vendors page now takes `searchParams`), `tests/whistleblower-keys-and-migration.test.ts` (rotation covers a vendor response: counts 10/10, trigger back on), and **`tests/country-pages.test.tsx`** (added `cleanup()` — see Judgment calls). New: `tests/vendors-screening.test.ts` (38), `tests/vendors-public.test.tsx` (18), `tests/vendors-dashboard.test.tsx` (33).

## Evidence

**(a) The new vendor-path invariant failing on a planted violation, then passing** (raw; `SKIP_BUILD=1 ./verify.sh | grep …`, run on the committed tree):
```
=== planted violation: app/vendor/planted-spy.ts
export const spy = (req: Request) => req.headers.get("x-forwarded-for") ?? console.log("vendor");
app/vendor/planted-spy.ts:1:export const spy = (req: Request) => req.headers.get("x-forwarded-for") ?? console.log("vendor");
app/vendor/planted-spy.ts:1:export const spy = (req: Request) => req.headers.get("x-forwarded-for") ?? console.log("vendor");
check-vendor-privacy: FAIL — request metadata or logging in the public vendor paths
vendor public paths        FAIL: request metadata or console output in app/vendor, components/vendor or the public lib/vendors files
verify.sh: FAIL (HEAD 78fd225)

=== after removing it
branch                     phase-7-vendor-screening
vendor public paths        no request metadata, no logging
screening logging          nothing logged
screening key              SCREENING_API_KEY read only in lib/screening/index.ts
verify.sh: PASS (HEAD 78fd225)
```

**(b) Real rows from the smoke run** (psql -x, copied from the `./verify.sh` output below): a `vendor_responses` row — ciphertext only, the respondent name / role / ownership / PEP details appear nowhere in it — and a `vendor_screenings` row **(local stub)**:
```
--- smoke evidence: the vendor_responses row exactly as stored (psql -x): ciphertext, no plaintext
-[ RECORD 1 ]------+------------------------------------------
id                 | f9e667c7-90e8-4645-b282-1fa1fc6f72b9
company_id         | dad30264-bc7b-45c3-ab67-8a150c006402
vendor_id          | 8b445c52-5d52-4b05-b359-409d08ed0c71
submitted_at       | 2026-10-16 10:57:39.521+00
respondent_name    | vsmoke:vioqLiIg15aJ3XmR:epNIvQfyTO6Kxjc0…
respondent_role    | vsmoke:nI/sv6ZJCZJHnlvp:3856i7kmUQkxh1Q1…
ownership_text     | vsmoke:6oL44IBl6oxjw1sn:cC7b5fXzVuZ+J/ZP…
pep_exposure       | t
pep_details        | vsmoke:n4AEu+lsRSbI1nQ7:Ok+Lk9na4a1M1JR7…
prior_sanctions    | f
sanctions_details  | 
antibribery_policy | t
--- smoke evidence (local stub): the vendor_screenings row of the listed vendor as stored (psql -x)
-[ RECORD 1 ]--------+-------------------------------------------------------------------------------------------------------------------------------
id                   | b3ca7a6b-e662-4d4a-8f3c-7cea3244f25e
company_id           | dad30264-bc7b-45c3-ab67-8a150c006402
vendor_id            | 8b445c52-5d52-4b05-b359-409d08ed0c71
screened_at          | 2026-10-16 10:57:40.027+00
provider             | opensanctions
dataset              | smoke
name_screened        | Listed Smoke Corp 28694
status               | possible_match
match_count          | 1
matches              | [{"id": "NK-SMOKE-1", "score": 0.97, "topics": ["sanction"], "caption": "Listed Smoke Corp", "datasets": ["smoke_sanctions"]}]
error_code           | 
requested_by_user_id | f489ee96-a6c1-480c-b71a-58078de087db
```

**(c) The request the smoke stub received (local stub)** — only the vendor name and the country code; the `Authorization` header was present, its value is redacted by the stub:
```
{"method":"POST","url":"/match/smoke","authorization":"ApiKey <redacted>","body":{"queries":{"q1":{"schema":"Company","properties":{"name":["Listed Smoke Corp 28694"],"country":["BR"]}}}}}
```
Unit tests assert the same body shape exactly (`tests/vendors-screening.test.ts`: "sends the vendor name and country … and nothing else").

**(d) Live check: LIVE CHECK NOT RUN** — needs `SCREENING_API_KEY` and network access to `api.opensanctions.org`. What I did run, honestly:
```
$ env -u SCREENING_API_KEY scripts/screening-live-check.sh
screening-live-check: SCREENING_API_KEY is not set — refusing to run (nothing was sent)      (exit 2)
$ curl -sS -m 15 -X POST https://api.opensanctions.org/match/default
curl: (56) CONNECT tunnel failed, response 403                                                (the environment proxy refuses the host; not worked around)
```
To run it (Esteban, or any session with the key and the host allowed): `SCREENING_API_KEY=… scripts/screening-live-check.sh` (optional `SCREENING_BASE_URL`, `SCREENING_DATASET`, `SCREENING_CHECK_NAME`; default name "Wagner Group"). It makes **one** call through the production client and prints the outcome, status, match count and the top caption/score/datasets — never the key, never the body; exit 0 only on `possible_match`. Paste its output here.

**`npm run test -- vendors`:** 3 files, 89 tests, real Postgres, provider injected or a local HTTP stub; all green. They cover: token (GET doesn't consume, submit consumes once, 4 concurrent submits → one row, expired/used/unknown/archived/replaced → identical page and JSON, resend kills the old link, failed email leaves state untouched, hash-only storage, 30-day TTL), ciphertext in the DB + decrypt in the detail page + "cannot decrypt" state + AAD (another tenant can't decrypt), append-only triggers, rotation covers `vendor_responses`, cross-tenant 404 on the page and every handler, mapping with canned provider JSON (score 0.69 without `match` = no match, 0.7 = possible, empty/malformed body = `bad_response`, 401/403/429/5xx/timeout/refused), cooldown, daily cap (errors count; yesterday and other companies don't), archived blocked, unavailable provider, error never shown as no-match, history+cache in one transaction (a failing insert leaves the cache untouched), one provider call for two simultaneous clicks, key never in the DB/outcomes/console, http non-loopback base URL refused, messages-vocabulary (no approved/clear/clean/safe/aprovado/limpo/seguro/aprobado/limpio/"due diligence completa" in the vendor namespaces of any locale), dashboard-vendor files all use the tenant gate, summary function.

## `./verify.sh` on the final code commit (5109983), exit 0 — full output
```
--- commit state
current HEAD               5109983  (2026-10-16T10:56:32+00:00)
branch                     phase-7-vendor-screening
comparing against          7b415d4
commits this pass          20
uncommitted changes        0 file(s)
test files changed          21 files changed, 6564 insertions(+), 15 deletions(-)
--- secrets
secrets                    none found
.env.example               present
--- database
fresh database             verify_1792148192_27867
db:migrate                 ok (from scratch)
tables created             21
--- lint
lint                       ok
--- typecheck
typecheck                  ok
--- tests
 Test Files  39 passed (39)
      Tests  596 passed (596)
   Start at  10:56:47
   Duration  22.12s (tests 53%, import 26%, setup 13%, environment 5%, transform 2%)

     Import  249 modules were evaluated 1401 times · 15.35s total, 26% of tracked time
             ~3.16s faster with isolate: false — shared modules are evaluated once per worker instead of once per file
             learn more: https://vitest.dev/guide/improving-performance#test-isolation
test exit code             0
counts                     total=596 pass=596 fail=0 skip=0
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
ok    onboarding created the six documents, all version 1
ok    documents list -> 200 and links the code of conduct
ok    document view -> 200 with title and company name
ok    PDF download: %PDF body, application/pdf, attachment with ASCII filename, no-store
ok    PDF logs the unusable logo once and still renders (stub logo)
ok    documents routes without a session: view -> /login, PDF -> 401
ok    second company is provisioned and signed in
ok    second company completes onboarding
ok    second company: first company's document view -> 404
ok    second company: first company's document PDF -> 404
ok    second company: malformed document id -> 404
ok    regenerate with unchanged inputs creates nothing
ok    rename the company via onboarding: documents untouched until regenerated
ok    regenerate after the rename creates v2 for all six
ok    v1 is intact: same content in the database, still viewable with the old name
ok    v2 carries the new name
ok    regenerate: bad type -> 400, no session -> 401
ok    database: direct UPDATE of a document is rejected (append-only trigger)
ok    database: direct DELETE of a document is rejected (append-only trigger)
ok    dashboard/overview: signed in -> 200 with the main nav and all eight section links
ok    dashboard/overview: marks itself aria-current="page"
ok    dashboard/overview: no session -> redirect to /login
ok    dashboard/overview: company 2 never sees company 1's name, payment or document id
ok    dashboard/overview: company 1 never sees company 2's name or payment
ok    dashboard/documents: signed in -> 200 with the main nav and all eight section links
ok    dashboard/documents: marks itself aria-current="page"
ok    dashboard/documents: no session -> redirect to /login
ok    dashboard/documents: company 2 never sees company 1's name, payment or document id
ok    dashboard/documents: company 1 never sees company 2's name or payment
ok    dashboard/employees: signed in -> 200 with the main nav and all eight section links
ok    dashboard/employees: marks itself aria-current="page"
ok    dashboard/employees: no session -> redirect to /login
ok    dashboard/employees: company 2 never sees company 1's name, payment or document id
ok    dashboard/employees: company 1 never sees company 2's name or payment
ok    dashboard/training: signed in -> 200 with the main nav and all eight section links
ok    dashboard/training: marks itself aria-current="page"
ok    dashboard/training: no session -> redirect to /login
ok    dashboard/training: company 2 never sees company 1's name, payment or document id
ok    dashboard/training: company 1 never sees company 2's name or payment
ok    dashboard/whistleblower: signed in -> 200 with the main nav and all eight section links
ok    dashboard/whistleblower: marks itself aria-current="page"
ok    dashboard/whistleblower: no session -> redirect to /login
ok    dashboard/whistleblower: company 2 never sees company 1's name, payment or document id
ok    dashboard/whistleblower: company 1 never sees company 2's name or payment
ok    dashboard/vendors: signed in -> 200 with the main nav and all eight section links
ok    dashboard/vendors: marks itself aria-current="page"
ok    dashboard/vendors: no session -> redirect to /login
ok    dashboard/vendors: company 2 never sees company 1's name, payment or document id
ok    dashboard/vendors: company 1 never sees company 2's name or payment
ok    dashboard/billing: signed in -> 200 with the main nav and all eight section links
ok    dashboard/billing: marks itself aria-current="page"
ok    dashboard/billing: no session -> redirect to /login
ok    dashboard/billing: company 2 never sees company 1's name, payment or document id
ok    dashboard/billing: company 1 never sees company 2's name or payment
ok    dashboard/settings: signed in -> 200 with the main nav and all eight section links
ok    dashboard/settings: marks itself aria-current="page"
ok    dashboard/settings: no session -> redirect to /login
ok    dashboard/settings: company 2 never sees company 1's name, payment or document id
ok    dashboard/settings: company 1 never sees company 2's name or payment
ok    billing: each company sees its own payment, formatted pt-BR
ok    overview: counts come from the session's company (0 employees, 0 open cases)
ok    documents list: draft status shown next to the documents
ok    document pages: no session -> /login; company 2 -> 404 (unchanged inside the shell)
ok    headers on /dashboard: private no-store, frame-ancestors 'none', X-Frame-Options DENY, Referrer-Policy same-origin
ok    headers on /dashboard/settings: private no-store, frame-ancestors 'none', X-Frame-Options DENY, Referrer-Policy same-origin
ok    headers on /dashboard/documents: private no-store, frame-ancestors 'none', X-Frame-Options DENY, Referrer-Policy same-origin
ok    headers on /onboarding: private no-store, frame-ancestors 'none', X-Frame-Options DENY, Referrer-Policy same-origin
ok    headers on /login: private no-store, frame-ancestors 'none', X-Frame-Options DENY, Referrer-Policy same-origin
ok    PDF keeps its own Cache-Control: no-store
ok    settings: no session -> 401
ok    settings: SVG disguised as PNG -> error=logo, nothing changed
ok    settings: save -> 303 to ?saved=1
ok    settings: DB has the new name, industry and a new logo file
ok    settings: onboarding_completed_at is intact
ok    settings: company 2 untouched by the posted company id
ok    settings: saving regenerated nothing (still 12 documents)
ok    settings: old logo file is kept on disk
ok    settings: page shows the new logo and the not-regenerated notice linking to Documents
ok    settings: header shows the new name, tax id and admin email are read-only text
ok    audit trail: v1 document view still carries the name it was generated with (PDF: tests/dashboard-audit)
ok    sign-out form carries a server action (hidden action fields found)
ok    before sign-out the copied session reaches the dashboard
ok    sign-out action: 303 to /login
ok    sign-out action: session cookie is cleared
ok    after sign-out: /dashboard redirects to /login
ok    after sign-out: a section and the PDF route are refused too
ok    REPLAY pre-sign-out cookie: /dashboard -> /login
ok    REPLAY pre-sign-out cookie: /dashboard/billing -> /login
ok    REPLAY pre-sign-out cookie: PDF route -> 401
ok    REPLAY pre-sign-out cookie: settings/save -> 401
ok    REPLAY pre-sign-out cookie: regenerate -> 401
ok    REPLAY did not change the company name
ok    sign in again after sign-out: link sets a new session
ok    sign in again: new session reaches /dashboard (200) and the PDF
ok    sign in again: the pre-sign-out cookie is still refused
ok    the original jar (same user, another browser) ended too: all of that user's sessions end
ok    channel page: 200 in pt-BR, branded with the company name, form fields present
ok    channel page headers: no-store, no-referrer, DENY, noindex (header + meta), NO cookie, no banner
ok    unknown channel slug -> 404; status page renders
ok    the test image really carries the marker before upload
ok    anonymous submit with probe headers -> 201 + tracking code XXXX-XXXX-XXXX, no cookie set
ok    DB: anonymous row — is_anonymous, NULL contact, status new, ciphertext description (no plaintext)
--- smoke evidence: the anonymous report row exactly as stored (psql)
-[ RECORD 1 ]-----+-----------------------------------------------------------------------
id                | d483eb7b-4674-4703-8d13-b4b6aa903b5c
company_id        | dad30264-bc7b-45c3-ab67-8a150c006402
tracking_code     | DKRP9XRC94FD
category          | fraud
description       | vsmoke:UcKAGy6CrLBFZwlT:7sWw9526kqnaG6XnRikuUQ==:TgeWM5D0sd/EbsajshOxt
is_anonymous      | t
reporter_contact  | 
status            | new
status_changed_at | 2026-10-16 10:57:29.888368+00
resolved_at       | 
created_at        | 2026-10-16 10:57:29.888368+00

ok    full-database marker search (headers, cookie, client file name, EXIF marker): 0 hits in a non-trivial dump
--- smoke evidence: marker search over the whole database dump (3206 lines, 8 markers): 0 hit(s)
--- smoke evidence: positive control — the same search after deliberately inserting a marker row: 1 hit(s)
ok    positive control: the same search DOES find a marker that is really there
ok    evidence: one row, server-chosen name, sniffed type image/jpeg, stored outside the uploads dir
ok    evidence on disk is not an image (no JPEG magic) and carries no marker
--- smoke evidence: the evidence file on disk (ls -l; first 32 bytes, hex + text)
-rw------- 1 root root 4005 Oct 16 10:57 /tmp/tmp.W9jhucvf4t/43e8e8c3c26e33ad5240d73f79a577f9.enc
000000 76 73 6d 6f 6b 65 3a 5a 47 34 4f 64 6f 30 2b 52  >vsmoke:ZG4Odo0+R<
000010 45 44 61 72 6f 77 71 3a 4d 35 41 55 30 76 57 47  >EDarowq:M5AU0vWG<
000020
ok    the public uploads route cannot serve the evidence file
ok    public status: right code -> 'Recebida' and nothing about the report
ok    public status: wrong, malformed and other-company answers are byte-identical 404s
ok    dashboard list: report appears (link, 'Recebida'), channel URL shown, no description text
ok    dashboard detail decrypts the description and says 'Anônima'
ok    evidence download: attachment, image/jpeg, nosniff, private no-store; a JPEG with the EXIF marker gone
ok    evidence download without a session -> 401
ok    add a note -> 303; it shows decrypted, and is ciphertext in the database
ok    move to 'under review' -> public status shows 'Em análise'
ok    close it -> resolved_at set, public status shows 'Encerrada'
ok    case log: note + two status changes recorded; the overview no longer counts it as open
ok    reopen clears the resolution date
ok    database: the case log is append-only (UPDATE and DELETE rejected)
ok    company 2: report detail -> 404, evidence -> 404, status change -> 404, note -> 404
ok    company 2: its list shows nothing of company 1's (no id, no slug, no description)
ok    company 1's report is untouched by company 2's attempts
ok    intake: invalid category / an SVG named .png -> 422, nothing stored
ok    intake: a filled honeypot looks like success but stores nothing
ok    intake: opt-in contact is stored encrypted, is_anonymous = false
ok    notification emails reached the admin in the dev sink (one per stored report: 2)
ok    notification email: dashboard link, and none of the report's content, code, category or id
--- smoke evidence: the notification email as written to the dev sink
{"to":"smoke-1792148240-28694@example.test","subject":"Nova denúncia recebida no seu canal","text":"Uma nova denúncia foi enviada ao seu canal de denúncias. Entre para analisá-la: http://localhost:40529/dashboard/whistleblower","html":"<p>Uma nova denúncia foi enviada ao seu canal de denúncias. Entre para analisá-la: <a href=\"http://localhost:40529/dashboard/whistleblower\">http://localhost:40529/dashboard/whistleblower</a></p>"}
ok    import (BOM + ';' + one bad line + one duplicate): 303, created 3, skipped 1, invalid 1, line 5 reported, no email in the URL
ok    DB: three employees, emails lower-cased, none invited yet
ok    admin grid lists the three, 'Não convidado', and the completion line says 0%
ok    send pending invitations: 303, 3 sent, 0 failed, 0 remaining
ok    three invitation emails reached the dev sink, each with its own /employee/<43-char token> link
--- smoke evidence: the invitation email as written to the dev sink
{"to":"ana6-28694@example.test","subject":"A Smoke Settings Ltda convida você a concluir seu treinamento de compliance","text":"Olá Ana Smoke, a Smoke Settings Ltda implementou um programa de compliance e precisamos que você conclua duas etapas curtas: 1) ler e aceitar o código de conduta e as políticas, 2) concluir um treinamento breve (15-20 min).\n\nComeçar →: http://localhost:40529/employee/hu6ryhVI0mST5OPGTaifshU-2r7qP6uevPCpmK_TgUM\n","html":"<p>Olá Ana Smoke, a Smoke Settings Ltda implementou um programa de compliance e precisamos que você conclua duas etapas curtas: 1) ler e aceitar o código de conduta e as políticas, 2) concluir um treinamento breve (15-20 min).</p><p><a href=\"http://localhost:40529/employee/hu6ryhVI0mST5OPGTaifshU-2r7qP6uevPCpmK_TgUM\">Começar →</a></p><p>http://localhost:40529/employee/hu6ryhVI0mST5OPGTaifshU-2r7qP6uevPCpmK_TgUM</p>"}
ok    invitation: pt-BR, names the employee, offers the two steps, carries no document text
ok    DB: invited_at set, 14-day expiry, only the sha256 hash stored (the raw token is nowhere in the row)
--- smoke evidence: the invited employee row (psql -x): a hash, not the token
-[ RECORD 1 ]-----+-----------------------------------------------------------------
id                | ae8c95fe-97a2-42f8-ac03-83c861a074d7
name              | Ana Smoke
email             | ana6-28694@example.test
invite_token_hash | 838c24b7d769487ead067b8d662aaf5199da508b40ef253c0b00364daea738ec
invited_at        | 2026-10-16 10:57:33.165+00
invite_expires_at | 2026-10-30 10:57:33.165+00
deactivated_at    | 

ok    GET /employee/<token> (twice): 200 'Start' page with a hidden token field and the company name
ok    GET did not consume the link: the hash is still stored, the token is usable
ok    link page headers: private no-store, no-referrer, DENY, noindex
ok    no portal cookie reaches /employee without a session: /employee -> friendly page, handlers -> 401
ok    Start: 303 to /employee; cookie employee_session is HttpOnly, SameSite=Lax, Path=/employee, 8 hours
ok    cookie jar: the session cookie is scoped to Path=/employee (never sent to /dashboard, /report)
ok    DB: invite_token_hash is NULL after Start, exactly one session row, only its hash stored
--- smoke evidence: the same employee row after Start (invite_token_hash is NULL)
-[ RECORD 1 ]-----+-------------------------------------
id                | ae8c95fe-97a2-42f8-ac03-83c861a074d7
email             | ana6-28694@example.test
invite_token_hash | 
invited_at        | 2026-10-16 10:57:33.165+00
invite_expires_at | 2026-10-30 10:57:33.165+00

ok    portal home: 200, private no-store, checklist shows 0 of 8 steps
ok    six document pages render (200) and six acknowledgments are accepted (303)
ok    double click: still exactly six acknowledgment rows
ok    IP stored from CF-Connecting-IP (203.0.113.11..16), never from X-Forwarded-For
--- smoke evidence: one acknowledgments row exactly as stored (psql -x) — it carries the client IP
-[ RECORD 1 ]-------------------------------------
id          | 65d4989e-f04b-4903-ae04-d5c9c927d272
company_id  | dad30264-bc7b-45c3-ab67-8a150c006402
employee_id | ae8c95fe-97a2-42f8-ac03-83c861a074d7
document_id | 50e81ab3-0396-4437-86e3-f7a2efe6621e
accepted_at | 2026-10-16 10:57:34.258867+00
ip_address  | 203.0.113.11

ok    a document of ANOTHER company: page -> 404, acknowledge -> 404, no row written
ok    the acknowledgments table is append-only (UPDATE, DELETE rejected)
ok    quiz page: 12 questions, no explanation text and no correct-answer marker in the HTML
ok    quiz 9 of 12: not passed (score 75), explanations returned, NOTHING stored
ok    quiz retake 10 of 12: passed (score 83); a repeated pass stays one row with the first score
ok    lessons render server-side (pt-BR scenario), no answers in them
ok    disclosure: first submit recorded; the second in the same year says 'already' and changes nothing
ok    disclosure content is ciphertext in the database (no plaintext anywhere in the row)
--- smoke evidence: the disclosures row exactly as stored (psql -x): ciphertext, no plaintext
-[ RECORD 1 ]+--------------------------------------------------------------
id           | 26cfbb92-79b8-4244-9a17-1fe56e5bdbbe
company_id   | dad30264-bc7b-45c3-ab67-8a150c006402
employee_id  | ae8c95fe-97a2-42f8-ac03-83c861a074d7
type         | conflict_of_interest_annual
period_year  | 2026
content      | vsmoke:7WmRgoxbxOX48XEi:acw+UiBSLT+oLXSO7/q/gA==:0GeWmWaqYQe…
submitted_at | 2026-10-16 10:57:35.542112+00

ok    admin grid: completion 33% (8 of 24 steps), 1 of 3 fully complete
ok    admin grid: Ana's eight marks are 'Feito' (6 documents, training, disclosure); the other two are invited, nothing done
ok    Overview widgets are real: 33% and '1 de 3 colaboradores com tudo concluído'
ok    employee detail (admin): the six acceptances with IPs, training 83%, the DECRYPTED disclosure; private no-store
ok    CSV export: attachment, UTF-8 with BOM, one row per grid row (3), ISO timestamps, NO IP and NO disclosure content
ok    PDF export: a real PDF attachment with all three employees, 'Página 1 de 1', no IP, no disclosure content
ok    the first link, reused: GET -> the friendly page (HTTP 200, no stack trace); POST -> 303 to that page, no cookie
ok    re-issue: Beto's NEW link differs; the unused OLD link is dead (POST -> friendly page), the new one still shows Start
ok    company 2 admin: Ana's detail -> 404; invite / deactivate / reactivate -> 404; export and grid show none of company 1's people
ok    company 2 admin cannot import into or read company 1's roster; its own import is its own (same email allowed)
ok    Carla opens a session, then the admin deactivates her: her session is deleted and the cookie is refused (401 / friendly page)
ok    deactivated Carla leaves the numbers: the grid says 'Conclusão 50% · 1 de 2' (8 of 16)
ok    sign-out in the portal: the session row is gone and the same cookie is refused
ok    robots.txt disallows /vendor
ok    add vendor: 303 back to the list; three vendors stored for company 1, email lower-cased, country upper-cased
ok    add vendor: an empty name is refused with error=name_required and stores nothing
ok    vendors list: the three vendors, 'Não triado', 'Não enviado'
ok    send questionnaire: 303 sent; the dev sink holds a /vendor/<43-char token> link
--- smoke evidence: the questionnaire email as written to the dev sink
{"to":"vendor-l-28694@example.test","subject":"Smoke Settings Ltda pede que você preencha um breve questionário de integridade","text":"Olá, a Smoke Settings Ltda pede que você preencha um breve questionário de integridade, como parte do seu programa de compliance. Leva poucos minutos e as respostas serão enviadas à Smoke Settings Ltda. O questionário não é uma determinação legal.\n\nAbrir o questionário →: http://localhost:40529/vendor/TgPvd07WN23FCf66bOR5H6kvfHxmW5iRMr-81gcf_Mw\n","html":"<p>Olá, a Smoke Settings Ltda pede que você preencha um breve questionário de integridade, como parte do seu programa de compliance. Leva poucos minutos e as respostas serão enviadas à Smoke Settings Ltda. O questionário não é uma determinação legal.</p><p><a href=\"http://localhost:40529/vendor/TgPvd07WN23FCf66bOR5H6kvfHxmW5iRMr-81gcf_Mw\">Abrir o questionário →</a></p><p>http://localhost:40529/vendor/TgPvd07WN23FCf66bOR5H6kvfHxmW5iRMr-81gcf_Mw</p>"}
ok    DB: only the sha256 of the token is stored, 30-day expiry, status sent
ok    GET /vendor/<token> (twice): 200 form in pt-BR with the company name and the not-a-legal-determination line; set no cookie
ok    vendor page headers: private no-store, no-referrer, DENY, noindex
ok    GET did not consume the link: the hash is still stored, no response yet
ok    invalid answers: JSON errors (respondentName required), the link is NOT consumed, nothing stored
ok    submit: {ok:true}, no cookie set, no-store
ok    DB: the link is consumed (hash NULL), status submitted, exactly one response
ok    the used link: submit -> {invalid:true}; GET -> the friendly page (HTTP 200, no stack trace); still one response
ok    the vendor answers are ciphertext in the database (no plaintext anywhere in the row), booleans plain
--- smoke evidence: the vendor_responses row exactly as stored (psql -x): ciphertext, no plaintext
-[ RECORD 1 ]------+------------------------------------------
id                 | f9e667c7-90e8-4645-b282-1fa1fc6f72b9
company_id         | dad30264-bc7b-45c3-ab67-8a150c006402
vendor_id          | 8b445c52-5d52-4b05-b359-409d08ed0c71
submitted_at       | 2026-10-16 10:57:39.521+00
respondent_name    | vsmoke:vioqLiIg15aJ3XmR:epNIvQfyTO6Kxjc0…
respondent_role    | vsmoke:nI/sv6ZJCZJHnlvp:3856i7kmUQkxh1Q1…
ownership_text     | vsmoke:6oL44IBl6oxjw1sn:cC7b5fXzVuZ+J/ZP…
pep_exposure       | t
pep_details        | vsmoke:n4AEu+lsRSbI1nQ7:Ok+Lk9na4a1M1JR7…
prior_sanctions    | f
sanctions_details  | 
antibribery_policy | t

ok    vendor_responses and vendor_screenings are append-only (UPDATE and DELETE rejected)
ok    vendor detail (admin): the DECRYPTED answers, 'Respondido', private no-store
ok    (local stub) screen the listed vendor: 303 to its page, 'Possível correspondência — revisão necessária' with the match, 97%, list and entity id
ok    (local stub) the lists-and-date caveat is next to the result and the page never says approved/clear/safe
ok    (local stub) screen the other vendor: 'Nenhum resultado nas listas triadas em <data>'
ok    (local stub) a second click inside the cooldown is refused (screen=cooldown) and the stub saw NO new request
ok    (local stub) provider returns 500: recorded as an error ('Falha na triagem', code upstream), NEVER as 'nenhum resultado'; the vendor cache says error
ok    (local stub) three runs in the history table: possible_match, no_match, error; the cache matches the latest run
--- smoke evidence (local stub): the vendor_screenings row of the listed vendor as stored (psql -x)
-[ RECORD 1 ]--------+-------------------------------------------------------------------------------------------------------------------------------
id                   | b3ca7a6b-e662-4d4a-8f3c-7cea3244f25e
company_id           | dad30264-bc7b-45c3-ab67-8a150c006402
vendor_id            | 8b445c52-5d52-4b05-b359-409d08ed0c71
screened_at          | 2026-10-16 10:57:40.027+00
provider             | opensanctions
dataset              | smoke
name_screened        | Listed Smoke Corp 28694
status               | possible_match
match_count          | 1
matches              | [{"id": "NK-SMOKE-1", "score": 0.97, "topics": ["sanction"], "caption": "Listed Smoke Corp", "datasets": ["smoke_sanctions"]}]
error_code           | 
requested_by_user_id | f489ee96-a6c1-480c-b71a-58078de087db

--- smoke evidence (local stub): the request the stub received for the listed vendor (Authorization value redacted by the stub)
{"method":"POST","url":"/match/smoke","authorization":"ApiKey <redacted>","body":{"queries":{"q1":{"schema":"Company","properties":{"name":["Listed Smoke Corp 28694"],"country":["BR"]}}}}}
ok    (local stub) the outgoing body carries ONLY the vendor name and country code; the Authorization header was present
ok    (local stub) the API key is nowhere in the database or the server log
ok    company 2 admin: company 1's vendor page -> 404; send / archive / unarchive / screen -> 404; its own list shows none; nothing changed
ok    no session: the vendor handlers answer 401 and the list redirects to /login
ok    archive: gone from the list, back under 'show archived', still in the table; screening it -> screen=archived
ok    (no key) screening unavailable: the page says so and has no screen button, the click is refused, the stub saw nothing, the questionnaire can still be sent
ok    simulator Fail -> attempt failed, nothing provisioned, status endpoint says failed
ok    ALLOW_FAKE_PAYMENTS unset: simulator page 404
ok    ALLOW_FAKE_PAYMENTS unset: simulator action 404
ok    ALLOW_FAKE_PAYMENTS unset: webhook endpoint 404
ok    ALLOW_FAKE_PAYMENTS unset: POST /api/checkout -> 503 unavailable
ok    ALLOW_FAKE_PAYMENTS unset: /checkout?c=br shows 'unavailable', no form
ok    PAYMENT_PROVIDER unset (default none): /checkout?c=br unavailable too
smoke: PASS (port 40529)
smoke                      ok
--- invariants
migration drift            schema changed, migration present
tenant isolation           all tenant tables carry company_id
legal citations            none outside lib/content/
forbidden claims           none
geo                        CF-IPCountry only
urls                       no locale codes in paths
request company_id         never read from the request
anonymous intake           no request metadata, no logging
client ip                  cf-connecting-ip read only in lib/employee/client-ip.ts
client ip callers          only the acknowledge handler
ip column                  only schema, acknowledgment writer, admin detail reader and its page
request headers            no other client-identifying header read
employee logging           nothing logged beyond the fixed invitation-failure string
training copy              no 'certificate' wording
vendor public paths        no request metadata, no logging
screening logging          nothing logged
screening key              SCREENING_API_KEY read only in lib/screening/index.ts
KNOWN_ISSUES.md            present
--- result
verify.sh: PASS (HEAD 5109983)
```

## CI
PR: https://github.com/egaluzzi/compinabox/pull/9 . CI run 38890777927 on head 9d1ae41 was **queued** when I stopped (result not seen — check it). Code tip = 5109983; pushed tip = this HANDOFF commit (HANDOFF-only commits follow the code tip).

## Judgment calls
1. **Screening runs inside a DB transaction that holds a per-company advisory lock across the provider call (≤ 10 s).** Why: guards (cooldown, cap) must be race-free, otherwise two fast clicks both pass and both bill. Cost: one pooled connection held for the duration of a click, and a company's screenings are serialised. Fine for this traffic; the alternative (reserve-then-update) is impossible because the history table is append-only.
2. **A provider that throws before sending (e.g. non-https base URL) → "unavailable", nothing recorded**; a provider that returns an `error` outcome → recorded as `error` (counts toward the daily cap, may be billed).
3. **`possible_match` iff some result has `match === true` or `score >= 0.7`** (as specified), and the whole response is `bad_response` if any element of `results` is not an object with a string `id` (strict on purpose; a lenient parse could turn a changed API into "no match").
4. **Questionnaire page language = the company's country locale** (pt-BR for BR); the shared "invalid link" and "thanks" pages show pt-BR + es + en, like the employee portal. Root layout `lang="pt-BR"`, the `<main lang>` carries the real one.
5. **Without JavaScript a validation error redirects to `/vendor/<token>?retry=1` and the typed answers are lost** (with JavaScript — the normal case — they are kept). The requirement "re-render without losing answers" is met for the JS path; native `required`/`maxlength` attributes catch most errors first. A server-rendered re-post would have needed react-dom/server in a handler or a server action; not worth it for v1.
6. **`via=js` is a form field, not an `Accept` header,** because the invariant forbids reading any request header on the public vendor paths.
7. **Public vendor paths log nothing, but `lib/vendors/invites.ts` (dashboard side) logs the fixed string "vendor questionnaire email failed"** (same as phase 6); `invites.ts` is deliberately outside `check-vendor-privacy.sh`.
8. **No external link to the provider's entity page** — I am not certain of the URL form, so the entity id is shown as text (as the notes said).
9. **Dashboard locale strings for es-AR and es-MX are identical** (neutral Spanish, "screening" kept as in the existing dashboard copy). Native-speaker review via `messages/DRAFTS.md`.
10. **Archived vendors:** the questionnaire link dies with archiving (the submit `UPDATE` requires `archived_at IS NULL`); unarchiving does not revive it — resend.
11. **Existing flaky test fixed so `verify.sh` can exit 0:** `tests/country-pages.test.tsx` (phase 1, untouched by this phase) intermittently fails the run with "ReferenceError: window is not defined" from React work still queued after jsdom teardown (vitest globals are off, so testing-library never unmounts). It reproduced with that file alone under load (1 of 12 parallel runs, and twice in six full-suite runs on this branch). I added `cleanup()` in its `afterEach`; 24 of 24 loaded runs were clean afterwards. That is evidence, not proof — if `Errors` ever reappears in the vitest summary it is this file.
12. **`scripts/smoke.sh` is re-runnable only on a fresh database** (a pre-existing step counts companies by name); I hit that by running it twice on one DB, not a regression.

## Found / for the supervisor

**Every assumption about the real OpenSanctions API** (all marked `ASSUMED SHAPE — verify at live check` in `lib/screening/opensanctions.ts`; compare with the live response):
- Endpoint `POST {base}/match/{dataset}`, default base `https://api.opensanctions.org`, default dataset `default`.
- Auth header `Authorization: ApiKey <key>` (not `Bearer`).
- Request `{"queries":{"q1":{"schema":"Company","properties":{"name":[…],"country":[…]}}}}`; `country` expected as an ISO-3166 alpha-2 string (the vendor form stores whatever 2 letters the admin typed, upper-cased).
- Response `{"responses":{"q1":{"results":[{"id","caption","schema","score","match","datasets":[…],"properties":{"topics":[…]}}],"total":{…}}}}`; `topics` read from `properties.topics`, falling back to a top-level `topics`; `match` is a boolean; `score` a number 0–1.
- The 0.7 score threshold is from the notes, not from the provider's documentation; the provider's own `match` flag may use a different threshold. Results below 0.7 are still stored (top 10) when another result trips the threshold, but are not shown as a "possible match" on their own.
- Status mapping: 401/403 → `auth`, 429 → `rate_limited`, 5xx and any other non-2xx and network failure → `upstream`, 10 s → `timeout`.
- Whether `schema: "Company"` is the right schema for vendors that are sole traders / individuals (v1 screens the entity name only), and whether the hosted API wants `?algorithm=` or a `threshold` query parameter — unknown.
- The live-check name ("Wagner Group") is my pick of an entity expected to be on several sanctions lists; if it returns no hit the check exits 1 — try `SCREENING_CHECK_NAME` with another listed name before concluding the mapping is wrong.

**Vendor data privacy.** (1) Vendor **names** (and an optional country code) leave our system to a third party, the screening provider: the privacy policy must name it as a sub-processor and say what is sent (README "Sanctions screening: what is sent, what is stored"). Nothing else is sent: no company id, tax id, email or questionnaire answers (tested). (2) The provider learns *which names a given customer checks*; the request carries the customer's API key, which is ours, so the provider cannot tell customers apart — but it can see our whole pattern. (3) `vendor_screenings` stores the screened name and ≤ 10 matches in clear text (they are public-list entities, not personal data about the vendor's people); the questionnaire answers (which can name individuals — owners, PEP relatives) are encrypted at rest and covered by key rotation. (4) The questionnaire respondent is a vendor employee who never accepted a privacy notice: the form says who is asking and that answers go to that company, but there is no LGPD notice for the respondent — the legal review item in CLAUDE.md §11 should include it. (5) Caddy must keep `/vendor/*` out of its access log (the token is in the path).

**What Esteban must do at deploy** (hard to undo / money / vendor commitment — rule 3):
1. **Migration `0006`** against the live database (a deliberate step with him in the loop; it is additive and safe on existing rows, but it creates append-only tables).
2. **OpenSanctions commercial terms and cost** for screening customers' vendors in a paid product — adding a paid service is his call; the "free tier" assumption is unverified. Fallback if unacceptable: self-hosted yente (`SCREENING_BASE_URL` already supports it, loopback http allowed), which costs droplet memory.
3. **Env on the droplet:** `SCREENING_API_KEY`, and optionally `SCREENING_BASE_URL` (https only, or loopback) and `SCREENING_DATASET`; and allow `api.opensanctions.org` in the worker environment's network settings (cloud environment → Edit → Network access) so the live check can run. Without the key, screening shows "unavailable" and everything else works.
4. **Spend bound to remember:** at most 50 screenings per company per UTC day and one per vendor per 5 minutes — worst case 50 billed calls per customer-day; the constants are in `lib/screening/constants.ts`.
5. Privacy policy names the provider as a sub-processor; Caddy log filter for `/vendor/*`.
