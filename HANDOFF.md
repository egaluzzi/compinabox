# Handoff — Phase 5: whistleblower intake + case log, 2026-10-15

Branch `phase-5-whistleblower` (from `origin/claude/trusting-lamport-aq0f52`, which carries the scope commit 2434bbb on top of `main` @ 7b415d4), PR to `main`, **not merged**.
**Code tip: 5c49788** — `./verify.sh` ran on exactly this commit (exit 0, output at the bottom). Commits after it touch only this file.
Guardrails touched: anonymous reporting, tenant isolation, scope boundary, encryption at rest — all settled by the notes; **nothing blocked**. One new migration (`0004_whistleblower.sql`), **no new dependency** (Node `crypto`/`zlib` only; the rotate script runs under bare Node 22 type stripping).

## What changed

**Migration `0004_whistleblower.sql`** (generated, then hand-ordered; `drizzle-kit generate` reports no drift)
- `companies.slug text not null unique` — added nullable, backfilled by the SQL equivalent of `slugify` (Latin accents stripped, `[a-z0-9-]`, ≤40, `empresa` if empty; duplicates: oldest keeps the plain slug, others get `-` + 4 hex chars), then `NOT NULL` + unique.
- `whistleblower_reports`: default `'new'`, `UPDATE … 'received' → 'new'` (before the constraint), CHECK `status in ('new','under_review','closed')`, `status_changed_at timestamptz not null default now()`, `resolved_at timestamptz`.
- New `whistleblower_evidence` (id, company_id, report_id, file_name, content_type, size_bytes, created_at) and `whistleblower_notes` (id, company_id, report_id, kind `note|status_change` CHECK, body, from_status, to_status, author_user_id, created_at). Both carry `company_id`. Notes are **append-only by trigger** (UPDATE/DELETE/TRUNCATE rejected; same pattern as 0002).
- `tests/whistleblower-keys-and-migration.test.ts` runs migrations 0000–0003 in a scratch DB, inserts accented/duplicate/empty-name companies and a `received` report, applies 0004, and asserts the slugs (agree with `slugify`), `new`, NOT NULL/UNIQUE/CHECK/trigger.

**lib/whistleblower/** (every piece has tests): `slug.ts`, `company-slug.ts` (unique slug, lookup), `tracking-code.ts` (12 chars of `ABCDEFGHJKMNPQRSTUVWXYZ23456789`, `crypto.randomInt`, display `XXXX-XXXX-XXXX`, normalise), `crypto.ts` (AES-256-GCM, `v<keyId>:iv:tag:ct`, AAD `<table>:<company_id>:<field>`, `REPORT_ENCRYPTION_KEYS`), `image-strip.ts` (JPEG: drops every APPn + COM + trailing data; PNG: keeps IHDR/PLTE/IDAT/IEND/tRNS, verifies CRCs; unparsable → rejected), `evidence.ts` (encrypted files under `EVIDENCE_DIR`, `wx`, mode 600, refuses to run if it overlaps `UPLOADS_DIR`), `intake.ts` (parse/validate + files-first-then-transaction store with cleanup), `rate-limit.ts`, `status-lookup.ts`, `queries.ts` (all tenant-scoped; `changeStatus` locks the row and writes the `status_change` log row in the same transaction), `rotate.ts`, `http.ts`, `public-company.ts`.

**Public** — `app/report/[slug]/layout.tsx` is its own root layout (no marketing layout: no banner, no UTM, no cookies; `proxy.ts` matcher untouched), `page.tsx`, `status/page.tsx`; handlers `POST /api/report/[slug]` and `POST /api/report/[slug]/status`. Language = company country locale. Headers on pages (next.config) and handlers (set in code): `Cache-Control: no-store`, `Referrer-Policy: no-referrer`, `X-Frame-Options: DENY` + `frame-ancestors 'none'`, `X-Robots-Tag: noindex, nofollow` (+ `<meta robots>` and `<meta referrer>`). Client components use plain `fetch` with `credentials: "omit"`. Honeypot field `website`. Confirmation shows the code once, grouped, with "save this code" copy.

**Dashboard** — `/dashboard/whistleblower` (channel URL + copy control, table: date/category/status, open cases bold, newest first, limit 100, no description preview), `/dashboard/whistleblower/[id]` (decrypted description, category, status control, resolution date, contact or "Anônima", evidence list, timeline oldest-first, add-note form; "cannot decrypt" state per field), route handlers `[id]/status`, `[id]/note`, `[id]/evidence/[evidenceId]` — all through `requireTenantRoute`, tenant from the session, 404 across tenants.

**Notification email** — `lib/email/report-notice.ts` (called after the report transaction commits): one mail per admin of the company, localized (pt-BR subject "Nova denúncia recebida no seu canal"), body = text + `<APP_URL>/dashboard/whistleblower`; no category/description/code/id/timestamp. Failure is caught; logs the fixed string `report notification email failed`; the submission still succeeds.

**Provisioning (money path) — touched only to add the slug:** `lib/payments/webhook.ts` gains one import and one line, `slug: await uniqueCompanySlug(tx, attempt.companyName)`, in the existing `insert(companies)` inside the webhook transaction. `tests/payments.test.ts` is untouched and green.

**Other:** messages in four locales (`report.*`, `dashboard.whistleblower.*`, `email.report*`; 75 keys each) + 300 rows in `messages/DRAFTS.md` (row counts line updated; CONTENT.md §5 only exists in Spanish, so everything else is gap-filled, the es-AR rows for strings with a company-name placeholder are listed too); `.env.example` (`REPORT_ENCRYPTION_KEYS`, `EVIDENCE_DIR`), `CLAUDE.md` §6 env list, README sections (“What the intake does and does not log”, “Report encryption key: generate, rotate, back up”, “Evidence directory”), `.gitignore` (`/evidence/`), `package.json` script `rotate-report-key`, `tsconfig.json` `allowImportingTsExtensions` (needed so the rotate tree can import `./crypto.ts` under bare Node).

**verify.sh / smoke** — new invariant 4i runs `scripts/check-anonymity.sh` (greps `app/report`, `app/api/report`, `lib/whistleblower`, case-insensitive, comments included, for `headers(`, `x-forwarded`, `cf-connecting`, `user-agent`, `.ip`, `cookies(`, `console.`; a missing directory fails rather than passes). `scripts/smoke.sh`: Phase 5 section (below) plus `EVIDENCE_DIR`/`REPORT_ENCRYPTION_KEYS` in `start_server`, `JQ` exported; no other edit.

## Evidence

**(a) Anonymity invariant failing on a planted violation, then passing** (raw; the same cases are also asserted in `tests/whistleblower-public.test.tsx`, which plants 8 kinds of violation and found a real hole — the first version was case-sensitive and let `CF-Connecting-IP` through; now `grep -i`):
```
=== planted violation
app/api/report/planted.ts:1:export const ip = (req: Request) => req.headers.get("x-forwarded-for");
app/api/report/planted.ts:2:console.log("report body");
check-anonymity: FAIL — request metadata or logging in the anonymous intake paths
exit=1
=== after removing it
check-anonymity: ok (3 paths scanned, pattern: headers\(|x-forwarded|cf-connecting|user-agent|\.ip\b|cookies\(|console\.)
exit=0
```

**(b) The anonymous report row from the smoke run** (`psql -x`; submitted with `X-Forwarded-For`, `CF-Connecting-IP`, `User-Agent`, `Cookie`, `Accept-Language`, `Referer` markers and a JPEG carrying an EXIF marker):
```
-[ RECORD 1 ]-----+-----------------------------------------------------------------------
id                | 4e2934a4-904a-4e16-b83c-78452723040b
company_id        | ff30fd88-a4b2-498a-afe4-b6a1a4274876
tracking_code     | WF4234XE5TDT
category          | fraud
description       | vsmoke:APZFhI8Px0yj1QXQ:FHtQJdtP5FYtaMloOHiGXA==:WrPENFygBUrWwuPapvviz
is_anonymous      | t
reporter_contact  | 
status            | new
status_changed_at | 2026-10-15 01:34:07.72039+00
resolved_at       | 
created_at        | 2026-10-15 01:34:07.72039+00
```
(`description` truncated to 70 chars by the `left()` in the query; it is `v<keyId>:iv:tag:ciphertext`.)

**(c) Evidence file on disk** (`xxd` is not installed in this container and could not be installed; `od -A x -t x1z` shows the same thing):
```
-rw------- 1 root root 4005 Oct 15 01:34 /tmp/tmp.XGjGfujXJx/4553774c13fdc5e11f3398059fb9b0e5.enc
000000 76 73 6d 6f 6b 65 3a 5a 6a 2f 39 6b 77 4f 4f 35  >vsmoke:Zj/9kwOO5<
000010 5a 4d 39 4d 6f 78 59 3a 52 58 6e 76 32 4f 70 39  >ZM9MoxY:RXnv2Op9<
000020
```
Not `FF D8`; the smoke also asserts no marker in it, that it is not under `UPLOADS_DIR`, that `/uploads/<name>` (`.enc` and `.jpg`) is 404, and that the dashboard download is a JPEG with the EXIF marker (and the string `Exif`) gone.

**(d) Full-database marker search, with positive control** (`pg_dump --data-only` of the whole smoke database, 8 markers: both IPs, user-agent, cookie value, accept-language, referer, the client file name, the EXIF marker):
```
--- smoke evidence: marker search over the whole database dump (883 lines, 8 markers): 0 hit(s)
--- smoke evidence: positive control — the same search after deliberately inserting a marker row: 1 hit(s)
```
The vitest version (`tests/whistleblower-intake.test.ts`) searches every text/varchar/char/json/jsonb column of every table via `information_schema` (asserts >20 columns searched), then inserts a marker row into `waitlist_leads` and asserts the search finds exactly that.

**Notification email in the dev sink** (smoke): `{"to":"smoke-…@example.test","subject":"Nova denúncia recebida no seu canal","text":"Uma nova denúncia foi enviada ao seu canal de denúncias. Entre para analisá-la: http://localhost:38901/dashboard/whistleblower", …}`

**`npm run test -- whistleblower`:** 6 files, 70 tests passed (real Postgres). Whole suite: 30 files, 403 tests, 0 failed, 0 skipped.

**Smoke lines, Phase 5 section** (all `ok`; full list in the verify output below): channel page 200/pt-BR/branded/form fields · headers no-store, no-referrer, DENY, noindex (header+meta), no Set-Cookie, no banner · unknown slug 404 · anonymous submit with probe headers → 201 + `XXXX-XXXX-XXXX`, no cookie · DB row anonymous/NULL contact/`new`/ciphertext · whole-DB marker search 0 hits + positive control · evidence row + server-chosen name, not an image on disk, not servable · public status "Recebida"; wrong/malformed/other-company answers byte-identical 404 · dashboard list/detail decrypt · evidence download attachment+nosniff+private no-store, EXIF gone · note → ciphertext in DB, shown decrypted · under review → public "Em análise" · closed → "Encerrada", `resolved_at` set · log = `note,status_change:new>under_review,status_change:under_review>closed` · reopen clears resolution date · UPDATE/DELETE on the log rejected by the DB · company 2 gets 404 on detail, evidence, status, note; its list shows nothing of company 1 · bad category / SVG-as-PNG → 422 · honeypot → fake success, nothing stored · opt-in contact encrypted, `is_anonymous=false` · 2 notification emails, no report content.

## Judgment calls
1. **Existing tests edited, minimally and necessarily** (none weakened): `tests/tenant.test.ts` (seeds the two new tenant tables — its own check requires every `company_id` table be in `TENANT_TABLES` with rows for both tenants), `tests/dashboard-gate.test.ts` (the expected-entry-points list gains the four new dashboard routes), `tests/dashboard-headers.test.ts` (its exact source list now ignores the `/report` and `/api/report` rules, which have their own test), `tests/helpers/db.ts` (`seedCompany` sets a slug; new `scratchDb()` helper), `vitest.setup.ts` (test-only key set, temp `EVIDENCE_DIR`). `payments`, `auth`, `session-revocation`, `documents-*`, `dashboard-routes`, `dashboard-audit` untouched and green.
2. **Rotation vs append-only:** note bodies are encrypted, so rotating a key means updating a row the trigger forbids updating. `rotate.ts` runs `ALTER TABLE … DISABLE TRIGGER` for the update/delete trigger **inside its own transaction only** (DDL is transactional, so failure rolls the trigger back on; a test confirms UPDATE is rejected again afterwards) and changes only `body`. Flag for the supervisor: this is the one sanctioned way around the append-only trigger.
3. **Rotate script mechanism:** no `tsx` in the repo, so `node scripts/rotate-report-key.ts` (Node 22.22 type stripping) calling `lib/whistleblower/rotate.ts` (raw `pg` queries, relative `.ts` imports, hence `allowImportingTsExtensions`). Needs a checkout with `npm ci` (not the rsynced standalone output) — see "for the supervisor".
4. **Evidence AAD** is `whistleblower_evidence:<company_id>:file:<evidence id>` (the id is added to the scoped field so a file can't be swapped between two evidence rows of one tenant); other fields use exactly `<table>:<company_id>:<field>`.
5. **Rate limiting:** every POST counts (including invalid ones and honeypot hits). Status lookups for unknown slugs share one bucket (`?`) so the limiter can't be used to probe which slugs exist; submissions to unknown slugs are 404 before any counting (no unbounded memory).
6. **Status lookup response:** `{status, label, date}` — the label and the date (company-locale, `America/Sao_Paulo`) are rendered server-side from `messages/*.json`; the not-found body is the locale-free `{"error":"not_found"}` so the unknown-slug case is byte-identical (the page localizes it).
7. **Email code lives outside `lib/whistleblower/`** (`lib/email/report-notice.ts`) because the invariant forbids `console.` in that tree and the notes require a fixed-string log on send failure.
8. **No log row at creation** (report `created_at` is the record); only changes get a `status_change` row. A no-op change (same status) writes nothing.
9. **Dashboard timeline shows the author's email** (the admin, looked up within the tenant).
10. **Slug backfill SQL only strips Latin-1 accents**; `slugify` (NFD) handles more. They agree on the test names; it only matters for rows that already exist when 0004 runs (none in production yet). A lost slug race at provisioning fails the webhook transaction on the unique index and the processor retries.
11. **`/robots.txt` unchanged** — a `Disallow: /report` would stop crawlers from ever seeing the `noindex`.
12. **Copy:** CONTENT.md §5 wording kept ("se compromete a revisar cada reporte" → pt-BR "analisar cada relato"). The evidence help says metadata is removed (true: tested). Nothing says "untraceable", "protected by law", or anything about outcomes.
13. A page needs JS to submit (client `fetch`), as the notes allow; labels, a live error region and a real submit button keep it keyboard/AT-usable.
14. Pre-existing, unrelated: `scripts/smoke.sh`'s "DB: only the session's company was renamed" check needs a second company to exist; it passes in `verify.sh` (the tests seed many) but fails if smoke is run alone on an empty database.

## Found / for the supervisor
- **Anonymity outside my paths (phase 9 checklist):** Caddy's access log and Cloudflare (logs/Logpush, plus the `CF-Connecting-IP`/`X-Forwarded-For` headers they add) will record visitor IPs for `/report/*` and `/api/report/*` no matter what the app does — configure Caddy to not log (or to drop the remote address) for those paths and decide Cloudflare log settings; the README says not to describe the channel as untraceable. Next.js itself logs thrown errors server-side (message/stack, never request bodies); every handler catches and answers with a fixed code, and I found no request-data logging in the framework's production server, but I did not audit its telemetry settings — worth `NEXT_TELEMETRY_DISABLED=1` on the droplet.
- **Phase 9 also:** per-IP rate limit as a Cloudflare rule (the in-app limiter is per-slug only); a request-body size cap in Caddy for `/api/report` (the handler reads the multipart body into memory before validating sizes); `EVIDENCE_DIR` backups (`scripts/backup.sh` covers the database only — evidence files and the **encryption key** must be backed up too, key separately; a DB-only restore leaves evidence unreadable/missing).
- **Rotation on the droplet:** `npm run rotate-report-key` needs the repo + `node_modules` + `.env` on the box; the planned deploy rsyncs only the standalone output. Decide in phase 9 (keep a checkout, or ship the script).
- **For the lawyer:** retention/purge periods for reports, notes and evidence (I built nothing — no deletion path exists); LGPD legal basis and a reporter-facing privacy notice for the channel (contact opt-in, sensitive data in free text); what to tell reporters about logging by infrastructure; whether an admin who is the subject of a report is a conflict (there is one admin per company in v1, SPEC §10); the "se compromete a revisar cada reporte" commitment now has a status workflow behind it; no new citation was added.
- **Esteban at deploy (flag, not decided):** (1) create the key (`openssl rand -base64 32`), put `REPORT_ENCRYPTION_KEYS` in `/opt/compinabox/.env`, and keep an offline copy — losing it makes every report unreadable; (2) create `/opt/compinabox/evidence` (mode 700, service user) and set `EVIDENCE_DIR`; (3) migration 0004 against live data is a deliberate step with him in the loop (it rewrites `companies` and the report status default); (4) set `APP_URL` correctly — the channel URL shown in the dashboard and printed to employees comes from it.

## `./verify.sh` on the code tip (5c49788), exit 0
<details><summary>full output</summary>

```
--- commit state
current HEAD               5c49788  (2026-10-15T01:33:24+00:00)
branch                     phase-5-whistleblower
comparing against          7b415d4
commits this pass          3
uncommitted changes        0 file(s)
test files changed          9 files changed, 2134 insertions(+), 6 deletions(-)
--- secrets
secrets                    none found
.env.example               present
--- database
fresh database             verify_1792028007_7816
db:migrate                 ok (from scratch)
tables created             18
--- lint
lint                       ok
--- typecheck
typecheck                  ok
--- tests
 Test Files  30 passed (30)
      Tests  403 passed (403)
   Start at  01:33:41
   Duration  11.27s (tests 46%, import 28%, setup 15%, environment 7%, transform 3%)

     Import  180 modules were evaluated 801 times · 8.14s total, 28% of tracked time
             ~1.45s faster with isolate: false — shared modules are evaluated once per worker instead of once per file
             learn more: https://vitest.dev/guide/improving-performance#test-isolation
test exit code             0
counts                     total=403 pass=403 fail=0 skip=0
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
id                | 4e2934a4-904a-4e16-b83c-78452723040b
company_id        | ff30fd88-a4b2-498a-afe4-b6a1a4274876
tracking_code     | WF4234XE5TDT
category          | fraud
description       | vsmoke:APZFhI8Px0yj1QXQ:FHtQJdtP5FYtaMloOHiGXA==:WrPENFygBUrWwuPapvviz
is_anonymous      | t
reporter_contact  | 
status            | new
status_changed_at | 2026-10-15 01:34:07.72039+00
resolved_at       | 
created_at        | 2026-10-15 01:34:07.72039+00

ok    full-database marker search (headers, cookie, client file name, EXIF marker): 0 hits in a non-trivial dump
--- smoke evidence: marker search over the whole database dump (883 lines, 8 markers): 0 hit(s)
--- smoke evidence: positive control — the same search after deliberately inserting a marker row: 1 hit(s)
ok    positive control: the same search DOES find a marker that is really there
ok    evidence: one row, server-chosen name, sniffed type image/jpeg, stored outside the uploads dir
ok    evidence on disk is not an image (no JPEG magic) and carries no marker
--- smoke evidence: the evidence file on disk (ls -l; first 32 bytes, hex + text)
-rw------- 1 root root 4005 Oct 15 01:34 /tmp/tmp.XGjGfujXJx/4553774c13fdc5e11f3398059fb9b0e5.enc
000000 76 73 6d 6f 6b 65 3a 5a 6a 2f 39 6b 77 4f 4f 35  >vsmoke:Zj/9kwOO5<
000010 5a 4d 39 4d 6f 78 59 3a 52 58 6e 76 32 4f 70 39  >ZM9MoxY:RXnv2Op9<
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
{"to":"smoke-1792028040-8463@example.test","subject":"Nova denúncia recebida no seu canal","text":"Uma nova denúncia foi enviada ao seu canal de denúncias. Entre para analisá-la: http://localhost:38901/dashboard/whistleblower","html":"<p>Uma nova denúncia foi enviada ao seu canal de denúncias. Entre para analisá-la: <a href=\"http://localhost:38901/dashboard/whistleblower\">http://localhost:38901/dashboard/whistleblower</a></p>"}
ok    simulator Fail -> attempt failed, nothing provisioned, status endpoint says failed
ok    ALLOW_FAKE_PAYMENTS unset: simulator page 404
ok    ALLOW_FAKE_PAYMENTS unset: simulator action 404
ok    ALLOW_FAKE_PAYMENTS unset: webhook endpoint 404
ok    ALLOW_FAKE_PAYMENTS unset: POST /api/checkout -> 503 unavailable
ok    ALLOW_FAKE_PAYMENTS unset: /checkout?c=br shows 'unavailable', no form
ok    PAYMENT_PROVIDER unset (default none): /checkout?c=br unavailable too
smoke: PASS (port 38901)
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
KNOWN_ISSUES.md            present
--- result
verify.sh: PASS (HEAD 5c49788)
```
</details>

## Code tip vs pushed tip / CI
To be filled after the push (PR link, CI run id and head SHA).
