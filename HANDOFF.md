# Handoff — Phase 8: binder (dossier) generator, 2026-10-24

Branch `phase-8-binder` (from `main` 6f2f2f8), **PR #10 to `main`, not merged** (https://github.com/egaluzzi/compinabox/pull/10).
**Code tip: cf5d953** — `./verify.sh` ran on exactly this commit: **PASS, exit 0** (output below). Later commits touch only a test title (`639d063`) and this file.
Guardrails touched, all settled by the notes — **nothing blocked**: tenant isolation (company from the session; other tenants' ids → 404), privacy exclusions (marker test + source tripwire), no compliance claims (extended wording tests, every locale), no new citations (legal text comes from `br.ts`). One migration (`0007_binders.sql`), **no new dependency**, no new env var.

## What changed

- **Migration 0007** — `binders` (company_id, status queued|running|ready|failed, requested_by_user_id, options jsonb, as_of, timestamps, error_code, size_bytes, page_count, sha256, `pdf bytea`); CHECK that a ready row is complete; partial unique index = one queued/running job per company; trigger rejects UPDATE/DELETE of a ready row and any TRUNCATE (status transitions before ready allowed). `drizzle-kit generate` reports no drift. Added to `TENANT_TABLES`.
- **lib/binder/** — `constants.ts` (all numbers: 25 MB cap, concurrency 2, 10-min stuck timeout, 30 s cooldown, 20/UTC day, fixed error codes), `snapshot.ts` (one REPEATABLE READ read-only transaction; `as_of` = transaction start), `pdf.tsx` (layout; two-pass render so the contents show real page numbers), `jobs.ts` (request/recover/run, in-process semaphore, atomic claim), `queries.ts` (tenant-scoped; PDF bytes only in `getBinderFile`), `REVIEW.md` (for the lawyer).
- **Routes/UI** — `/dashboard/binder` (form with the plain notice + stats checkbox, current job + no-JS refresh link + polling component `BinderPoller`, list with size/pages/SHA-256/download), `POST generate`, `GET status?id=`, `GET [id]/pdf` (attachment, ASCII `dossie-<slug>-YYYYMMDD.pdf`, no-store, nosniff). All through `requireTenant(Route)`; the gate-coverage test lists them. Overview card replaced. Not a ninth nav item.
- **Messages** — `binder.pdf.*` (PDF text) and `dashboard.binder.*`, `dashboard.overview.binder*` in all four locales; 508 rows appended to `messages/DRAFTS.md`.
- **Reused/refactored** — `lib/documents/pdf.tsx` now exports `DocumentSections`/`bodyStyles` (same look in the standalone PDF and the dossier); roster and `summarizeVendors` run their queries one after another (new `lib/db/sequence.ts`) so they can run inside the single-connection snapshot transaction without pg's "client already executing a query" deprecation.
- **verify.sh / smoke (only the permitted edits)** — forbidden-claims scan also covers `lib/binder`; `scripts/check-binder-privacy.sh` + block 4l; smoke Phase 8 section.
- Plan checklist ticked; `lib/binder` listed in CLAUDE.md §6; README section.

## Evidence

**(a) Exclusion marker test** (`tests/binder-pdf.test.tsx`, real Postgres, real job path, text extracted with pdfjs). Company A is seeded with a unique marker in every excluded field (employee e-mails, acknowledgment IP, disclosure content, report description / contact / tracking code / note / evidence file name, vendor questionnaire name / ownership / PEP text, vendor contact e-mails, ciphertext strings). Checked on the extracted text **and on the text with all whitespace removed** (pdfjs sometimes puts a space inside a kerned run) and on the raw file bytes; with statistics **off and on**; included fields (names, dates, statuses, vendor names, formatted CNPJ, channel URL, documents) are asserted present. A positive control puts a marker into the snapshot and shows the same extraction finds it, so the test can fail. Results: see the list in (b) — all pass.

**(b) Every binder test, verbose** (`npx vitest run tests/binder`, 69 tests; the full suite is 666/666):
```
 ✓ tests/binder-routes.test.tsx > generate -> poll -> download, through the real handlers > the click returns at once with a queued/running job; the status handler reaches ready; the file downloads with the right headers
 ✓ tests/binder-routes.test.tsx > generate -> poll -> download, through the real handlers > the statistics checkbox is stored with the job
 ✓ tests/binder-routes.test.tsx > generate -> poll -> download, through the real handlers > a second click while one is active lands on the same job
 ✓ tests/binder-routes.test.tsx > generate -> poll -> download, through the real handlers > right after a finished job the cooldown message comes back and nothing new is created
 ✓ tests/binder-routes.test.tsx > generate -> poll -> download, through the real handlers > the daily cap message comes back at the cap
 ✓ tests/binder-pdf.test.tsx > what the dossier leaves out (marker test) > none of the unique markers planted in excluded fields appears — statistics off
 ✓ tests/binder-pdf.test.tsx > what the dossier leaves out (marker test) > none appears with the channel statistics option ON either
 ✓ tests/binder-pdf.test.tsx > what the dossier leaves out (marker test) > the raw bytes of the file do not contain the markers either (not just the extracted text)
 ✓ tests/binder-pdf.test.tsx > what the dossier leaves out (marker test) > what IS included appears: names, dates, statuses, vendor names, the channel URL, the documents
 ✓ tests/binder-pdf.test.tsx > what the dossier leaves out (marker test) > channel statistics appear only when asked for, as totals by status
 ✓ tests/binder-pdf.test.tsx > positive control for the marker test > a marker that DOES reach the snapshot is found by the same extraction (the test can fail)
 ✓ tests/binder-routes.test.tsx > access control > no session: every binder handler answers 401, the page redirects to /login
 ✓ tests/binder-pdf.test.tsx > tenant isolation > company B's names, vendors and company name never appear in A's dossier
 ✓ tests/binder-pdf.test.tsx > tenant isolation > and B's own dossier has B's data only
 ✓ tests/binder-routes.test.tsx > access control > another company's binder: status 404 and download 404 — and the owner still gets 200
 ✓ tests/binder-routes.test.tsx > access control > malformed ids are 404, a binder that is not ready cannot be downloaded
 ✓ tests/binder-routes.test.tsx > access control > a company whose language is not pt-BR is told the dossier is unavailable and no job is created
 ✓ tests/binder-routes.test.tsx > access control > the status poll recovers a stuck job
 ✓ tests/binder-routes.test.tsx > the page > shows the generate form with the plain notice, the exclusions and the stats checkbox (off)
 ✓ tests/binder-routes.test.tsx > the page > an active job: status text, the no-JS refresh link, no generate form
 ✓ tests/binder-pdf.test.tsx > layout > every page says 'Página X de Y' with the real total
 ✓ tests/binder-pdf.test.tsx > layout > the running header (company · title) is on every page but the cover
 ✓ tests/binder-pdf.test.tsx > layout > the contents list real start pages, the outline and the links point at the same pages
 ✓ tests/binder-pdf.test.tsx > layout > a long table continues on the next page with its header row repeated
 ✓ tests/binder-pdf.test.tsx > honest wording > no compliance claim, verdict word or ISO mention in anything the dossier itself says
 ✓ tests/binder-pdf.test.tsx > honest wording > the cover carries the not-legal-advice / not-an-audit statement and the date
 ✓ tests/binder-pdf.test.tsx > honest wording > the draft notice is on the cover while documents / legal content / training are drafts
 ✓ tests/binder-pdf.test.tsx > honest wording > the vendor section is labelled a screening tool, not due diligence
 ✓ tests/binder-pdf.test.tsx > honest wording > the draft notice disappears when nothing is a draft (rendering the same snapshot with draft=false)
 ✓ tests/binder-pdf.test.tsx > snapshot consistency > rows committed by another connection after the snapshot started never appear
 ✓ tests/binder-routes.test.tsx > the page > a ready binder: date, size, pages, the full SHA-256 and a download link; failed ones show a fixed reason
 ✓ tests/binder-routes.test.tsx > the page > the overview card reflects the latest state and links to the page
 ✓ tests/binder-pdf.test.tsx > snapshot consistency > data changed between the snapshot and the render (the job path) does not appear in the file
 ✓ tests/binder-routes.test.tsx > copy: no compliance claim or verdict in any binder string, in any locale > en: binder.* and dashboard.binder.* are free of them
 ✓ tests/binder-routes.test.tsx > copy: no compliance claim or verdict in any binder string, in any locale > es-AR: binder.* and dashboard.binder.* are free of them
 ✓ tests/binder-routes.test.tsx > copy: no compliance claim or verdict in any binder string, in any locale > pt-BR: binder.* and dashboard.binder.* are free of them
 ✓ tests/binder-routes.test.tsx > copy: no compliance claim or verdict in any binder string, in any locale > es-MX: binder.* and dashboard.binder.* are free of them
 ✓ tests/binder-routes.test.tsx > copy: no compliance claim or verdict in any binder string, in any locale > the cover statement exists in every locale and says it is not an audit, certification or legal opinion
 ✓ tests/binder-pdf.test.tsx > a company with nothing recorded > renders honest empty sections: no employees, no vendors, no reports
 ✓ tests/binder-jobs.test.ts > one active job per company > a double click returns the same job; exactly one row exists
 ✓ tests/binder-jobs.test.ts > one active job per company > many parallel clicks still yield one job (the partial unique index is the backstop)
 ✓ tests/binder-jobs.test.ts > one active job per company > the database refuses a second queued/running row directly
 ✓ tests/binder-jobs.test.ts > one active job per company > companies do not block each other
 ✓ tests/binder-jobs.test.ts > the job > queued -> running -> ready; the stored hash is the SHA-256 of the stored bytes
 ✓ tests/binder-jobs.test.ts > the job > running a job twice does nothing the second time (the claim is atomic)
 ✓ tests/binder-jobs.test.ts > the job > a render failure is recorded as render_failed with no message and no PDF
 ✓ tests/binder-jobs.test.ts > the job > a snapshot failure is recorded as snapshot_failed
 ✓ tests/binder-jobs.test.ts > the job > a file over the size cap fails with too_large and is never stored
 ✓ tests/binder-jobs.test.ts > the job > a file exactly at the cap is accepted
 ✓ tests/binder-jobs.test.ts > stuck-job recovery > a running job older than the timeout becomes failed: interrupted; fresh ones are untouched
 ✓ tests/binder-jobs.test.ts > stuck-job recovery > a queued job that never started is recovered too
 ✓ tests/binder-jobs.test.ts > stuck-job recovery > a new request notices the stuck job, frees the slot and starts a new one (after the cooldown)
 ✓ tests/binder-jobs.test.ts > stuck-job recovery > a recovered job that wakes up later cannot overwrite the failure (it is no longer running)
 ✓ tests/binder-jobs.test.ts > stuck-job recovery > recovery is scoped to the caller's company
 ✓ tests/binder-jobs.test.ts > rate limits > cooldown: right after a finished job a new one is refused, with the wait; after it, accepted
 ✓ tests/binder-jobs.test.ts > rate limits > daily cap: BINDER_DAILY_CAP jobs per UTC day, failures count; another company is unaffected
 ✓ tests/binder-jobs.test.ts > rate limits > an active job is returned even when the cap or cooldown would refuse a NEW one
 ✓ tests/binder-jobs.test.ts > immutability (trigger) > a ready row cannot be updated, deleted or truncated — not even by the owner role
 ✓ tests/binder-jobs.test.ts > immutability (trigger) > rows that are not ready can change state (that is how a job progresses)
 ✓ tests/binder-jobs.test.ts > immutability (trigger) > a ready row must be complete (hash, size, pages, as-of, bytes)
 ✓ tests/binder-jobs.test.ts > tenant scoping of the readers > another company's binder id is invisible to list, meta and file
 ✓ tests/binder-jobs.test.ts > tenant scoping of the readers > lists and status reads never load the PDF bytes
 ✓ tests/binder-jobs.test.ts > process-wide render concurrency > never more than BINDER_CONCURRENCY renders at once; the rest wait as queued, then all finish
BINDER-PERF employees=500 vendors=50 wall=18.7s pages=67 size=0 MB(272014 B) rss_before=150 MB rss_peak=726 MB rss_delta=576 MB
 ✓ tests/binder-large.test.tsx > a 500-employee, 50-vendor company > renders to ready within the ceilings
 ✓ tests/binder-large.test.tsx > a 500-employee, 50-vendor company > every employee appears exactly once in each of the three roster tables, in order
 ✓ tests/binder-large.test.tsx > a 500-employee, 50-vendor company > the header row repeats on every continuation page and nothing is cut off
 ✓ tests/binder-large.test.tsx > a 500-employee, 50-vendor company > the contents, outline and page numbers stay consistent at this size
 ✓ tests/binder-large.test.tsx > a 500-employee, 50-vendor company > all 50 vendors are listed
 ✓ tests/binder-large.test.tsx > a 500-employee, 50-vendor company > the row is stored and immutable
 Test Files  4 passed (4)
      Tests  69 passed (69)
```

**(c) Source tripwire failing on a planted violation, then passing** (`SKIP_BUILD=1 ./verify.sh | grep …`):
```
=== planted violation: lib/binder/planted-spy.ts
import { decryptField } from "@/lib/whistleblower/crypto";
export const spy = (r: { trackingCode: string; email: string }) => decryptField(r.trackingCode) + r.email;
lib/binder/planted-spy.ts:1:import { decryptField } from "@/lib/whistleblower/crypto";
lib/binder/planted-spy.ts:2:export const spy = (r: { trackingCode: string; email: string }) => decryptField(r.trackingCode) + r.email;
check-binder-privacy: FAIL — lib/binder touches an import or a field that holds data the dossier must exclude
binder privacy             FAIL: lib/binder touches data the dossier must exclude
verify.sh: FAIL (HEAD 639d063)

=== after removing it
branch                     phase-8-binder
binder privacy             no excluded import or field in lib/binder
verify.sh: PASS (HEAD 639d063)
```

**(d) Smoke, real HTTP through the standalone build with real session cookies** (Phase 8 section of the `./verify.sh` run on cf5d953; the binders row is `psql -x` as stored; the two clicks are concurrent; direct SQL is refused by the trigger):
```
ok    no session: the vendor handlers answer 401 and the list redirects to /login
ok    archive: gone from the list, back under 'show archived', still in the table; screening it -> screen=archived
ok    (no key) screening unavailable: the page says so and has no screen button, the click is refused, the stub saw nothing, the questionnaire can still be sent
ok    two simultaneous clicks: both 303, one 'started' and one 'existing', exactly ONE binder row
ok    right after the click the job is queued/running/ready (the request did not wait for the render)
ok    polling the status handler reaches ready (and nothing else is queued)
ok    download: 200 attachment, application/pdf, no-store, nosniff, ASCII filename dossie-<slug>-YYYYMMDD.pdf; starts with %PDF; size matches the stored size
ok    the list shows the binder with a SHA-256 equal to sha256sum of the downloaded file, its page count, and the download link
--- smoke evidence: the binders row as stored (psql -x, PDF bytes shown as their length)
-[ RECORD 1 ]-----------------------------------------------------------------
id          | 20e741f6-b38f-4c69-bfa2-4901872e5bab
company_id  | 5422b3d8-6ad6-48f1-82ae-17dfd35a189a
status      | ready
options     | {"includeChannelStats": true}
as_of       | 2026-10-24 22:31:08.917+00
started_at  | 2026-10-24 22:31:08.913+00
finished_at | 2026-10-24 22:31:10.008+00
error_code  | 
size_bytes  | 78491
page_count  | 23
sha256      | 347a3d5db5343039db572bd1372951a7079f48260ba78e1b839e6978f5842ac7
pdf_bytes   | 78491

ok    the overview card links the latest binder
ok    right after a finished job a new click is refused (cooldown) and nothing is created
--- smoke evidence: direct SQL against the ready binder
ERROR:  binders is immutable once ready: UPDATE is not allowed
CONTEXT:  PL/pgSQL function binders_immutable() line 8 at RAISE
ERROR:  binders is immutable once ready: DELETE is not allowed
CONTEXT:  PL/pgSQL function binders_immutable() line 8 at RAISE
ERROR:  binders is immutable: TRUNCATE is not allowed
CONTEXT:  PL/pgSQL function binders_immutable() line 4 at RAISE
ok    direct SQL UPDATE / DELETE / TRUNCATE on a ready binder all fail ('immutable'); the row and its hash are unchanged
ok    company 2: company 1's binder download -> 404, status -> 404; its binder page shows neither the id nor the hash
ok    no session: binder download / status / generate answer 401, the page redirects to /login
pages 23 outline entries 15
ok    the PDF carries the company name, the active employees (Ana, Beto; Carla was deactivated earlier, so she is not listed) and the vendor
ok    the PDF carries the channel URL (APP_URL + /report/<slug>) and the opt-in statistics total
ok    the PDF carries 'Página 1 de N', the not-an-audit statement, the not-legal-advice line and the draft notice
ok    the PDF does NOT contain: employee e-mails, the acceptance IP, the disclosure text, the report text, the tracking code (formatted or raw), the vendor's answers, the vendor contact e-mails
ok    the PDF says 'ferramenta de triagem, não uma investigação de due diligence' and contains no 'em conformidade' and no ISO 37301/37002
ok    simulator Fail -> attempt failed, nothing provisioned, status endpoint says failed
ok    ALLOW_FAKE_PAYMENTS unset: simulator page 404
ok    ALLOW_FAKE_PAYMENTS unset: simulator action 404
ok    ALLOW_FAKE_PAYMENTS unset: webhook endpoint 404
ok    ALLOW_FAKE_PAYMENTS unset: POST /api/checkout -> 503 unavailable
ok    ALLOW_FAKE_PAYMENTS unset: /checkout?c=br shows 'unavailable', no form
ok    PAYMENT_PROVIDER unset (default none): /checkout?c=br unavailable too
```

**(e) Performance, 500 employees / 50 vendors / 6 documents / 30 reports** (`tests/binder-large.test.tsx`, whole job: snapshot + two render passes + store; 4 vCPU Xeon 2.1 GHz, 16 GB; measured inside a vitest worker, so "before" includes ~150 MB of test harness):
```
BINDER-PERF employees=500 vendors=50 wall=18.7s pages=67 size=0 MB(272014 B) rss_before=150 MB rss_peak=726 MB rss_delta=576 MB
```
Wall time 19–20 s (limit ~60 s: OK). Memory growth ≈ 550–580 MB at Node's default heap — **right at the ~600 MB line**. With V8 capped (`NODE_OPTIONS=--max-old-space-size=450`) the same job still completes in ~19 s with growth ≈ 300 MB, so most of it is collectable garbage, not live data. What I did: halved the node count of the tables (bare `Text` cells) which took it from ~35 s / 965 MB to ~20 s / ~800 MB total; I did not go further (the remaining cost is react-pdf's layout; the two-pass render is what gives the contents real page numbers). **Droplet assumption:** a 2 GB droplet shared with Postgres and Next. A typical company (tens of employees) takes ~2–3 s and little memory. Two simultaneous 500-employee jobs (`BINDER_CONCURRENCY` = 2) could need ~1.1 GB, so for ≤ 2 GB I recommend `BINDER_CONCURRENCY = 1` and `NODE_OPTIONS=--max-old-space-size=…` in the systemd unit (Phase 9). The test's ceilings (90 s, 900 MB growth) are deliberately looser than the target.

**(f) Rendered samples** — `docs/phase8-samples/`: `dossier-sample.pdf` (31 pages, 70 synthetic employees, 14 vendors, with a logo) and PNGs `01-cover` … `09-data-notes`. I looked at every one of them (and at an earlier 28-page and a 75-page render while iterating). What I saw: cover — logo top-left, large title, company, formatted CNPJ, as-of date+time, full binder id, amber bordered "RASCUNHO — pendente de revisão" box, the three "how to read" paragraphs, footer with "Página 1 de 31" and the shared disclaimer; contents — 8 sections + 6 documents indented, right-aligned real page numbers (verified against the outline and the link targets by test); document page — same look as the standalone PDF, accents correct (ç ã é ô), header on the page; roster — header row repeats on the continuation page, no orphan heading, no clipped text; names longer than ~28 characters wrap to two lines (synthetic names are long); channel page — URL in monospace, 6 bullets, optional statistics block; vendor page — table breaks after 13 rows and the **continuation page carries one row with the repeated header** (acceptable, not pretty); notes page — plain bullets. Greyscale-readable (the only colour is the amber draft notice, which also has a border and bold text). **Deviation:** the cover has no running header (it is the header); every other page has "company · Dossiê de integridade" at the top and "Dossiê <id> · date" + "Página X de Y" + disclaimer at the bottom.

**(g) Full `./verify.sh` on cf5d953** (head and tail; the middle is the long smoke log that exists in every phase):
```
--- commit state
current HEAD               cf5d953  (2026-10-24T22:29:38+00:00)
branch                     phase-8-binder
comparing against          6f2f2f8
commits this pass          13
uncommitted changes        0 file(s)
test files changed          6 files changed, 1375 insertions(+), 1 deletion(-)
--- secrets
secrets                    none found
.env.example               present
--- database
fresh database             verify_1792880991_31406
db:migrate                 ok (from scratch)
tables created             22
--- lint
lint                       ok
--- typecheck
typecheck                  ok
--- tests

 Test Files  43 passed (43)
      Tests  666 passed (666)
   Start at  22:30:04
   Duration  36.47s (tests 74%, import 16%, setup 6%, environment 2%, transform 1%)

    Isolate  43 workers spawned · ~168ms startup each (spawn + environment, per file)
             at least ~2.24s faster with isolate: false — reuses workers across files instead of one per file
test exit code             0
counts                     total=666 pass=666 fail=0 skip=0
--- build
build                      ok
standalone output          present
...
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
binder privacy             no excluded import or field in lib/binder
KNOWN_ISSUES.md            present
--- result
verify.sh: PASS (HEAD cf5d953)
exit=0

```

## CI
PR #10 opened; CI result to be recorded here after it runs (see PR checks).

## Judgment calls

1. **Contents show real page numbers** (two-pass render, third pass if unstable, fails the job rather than print wrong numbers); bookmarks are a flat list (react-pdf nests only by element tree): "2.1 Código de Conduta" etc. All 15 entries and the 14 contents links are verified by test.
2. **Training counts:** the platform stores only passes, so "completed" and "passed" are the same number ("Concluíram"); invited = active employees with an invitation date. The section says failed attempts are not recorded. Module "name" is the fixed title plus `MODULE_ID`.
3. **Deactivated employees are not listed** (active only); the smoke run proves it (Carla, deactivated earlier, is absent). Stated in the data notes.
4. **Wording avoids "aprovado"**: the existing training string "Aprovado — {score}%" is not reused; the dossier says "Concluído" and a minimum score.
5. **Non-pt-BR companies** get "not available in your company's language" and no job (documents exist only for BR); the `en`/`es` strings exist for key parity and a few tests.
6. **Snapshot reads** reuse `getRoster` (so dashboard, CSV, PDF and dossier agree) and drop e-mails immediately; they are never stored in the snapshot. Tripwire forbids the word `email` in lib/binder anyway.
7. **Recovery sets `finished_at` to the moment the job became overdue**, so the 30 s cooldown does not also punish the retry. An active job is returned even when the cap would refuse a new one; order: recover → active → cap → cooldown.
8. **`hyphenation`**: react-pdf hyphenated Portuguese with English patterns ("re-sposta"). `lib/documents/pdf.tsx` now registers a no-hyphenation callback; this applies to **all** PDFs (documents, roster, dossier) because the setting is global to react-pdf. Existing PDF tests pass.
9. **Binder tests use a throwaway database** (`useScratchTestDb`). Reason: `scripts/smoke.sh` picks "any document of another company" (`limit 1`, no ORDER BY) and expects it to have no acknowledgments, and the whistleblower test scans the whole shared database for marker strings; my seeded data tripped both in verify runs (both are pre-existing fragilities, not edited since the notes allow only the listed smoke edits). `tests/tenant.test.ts` still inserts one *failed* binder row into the shared DB (harmless).
10. **Cover has no running header** (see (f)); the PDF cover shows the **full binder id**; the SHA-256 cannot be inside the file it hashes, so it is on the dashboard list (and the notes page says so).
11. `dashboard.binder.flash.cap` says "dia em UTC" (the cap is per UTC day).

## Not done (out of scope per the notes)
Share links / auditor portal, signatures or timestamping, e-mailing the binder, scheduled generation, QR codes, editing binder content, screenshots (replaced by URL + description + availability date, per SPEC deviation below), other languages, Phase 9 items. No retention/erasure for binders (immutable by design).

**Deviation from SPEC §5.7:** no screenshot of the channel (no headless browser on the droplet, CLAUDE.md §3); the dossier shows the URL, a factual description and the availability date (= account creation, when the slug is generated).

## For the lawyer
Full list in `lib/binder/REVIEW.md` (every fixed sentence, generated from `messages/pt-BR.json`). Least sure of: (1) the **channel description** states that report text/contact/evidence are stored encrypted and that no IP/browser is stored *with the report* (true of Phase 5, but a security claim made to third parties; it also says infrastructure services may keep their own logs, which is the open Cloudflare/Caddy item); (2) the heading "Elementos de programa citados como exigidos/recomendados" over `br.ts` content (itself a draft; whether Lei 14.133 requires them is the open §11 question); (3) cover paragraphs 2–3 — enough, or is a reliance/liability disclaimer needed?; (4) the **personal-data question**: names + acceptance dates + training scores leave the platform to auditors/buyers; e-mails and IPs excluded — LGPD basis, employee notice, whether scores are needed, retention of immutable dossiers, onward disclosure of vendor names; (5) whether even channel totals (opt-in, off by default) can identify a report in a very small company.

## Found / for the supervisor
- **Build flake in this sandbox:** `next build` fails on every second invocation with a one-time "Next.js security advisory" stop (`SecurityFatalError`, advisory lookup at registry.npmjs.org) and passes on retry, on `main` too. I retried; I did not upgrade anything. It is outside this phase; worth a look at Next 16.4.0 vs the advisory.
- `smoke.sh` depends on the vitest run having populated the same database (e.g. `OTHER` in the Phase 4 check is empty on a fresh DB) and has the `limit 1` fragility in (9); a bare `wait` in a smoke section blocks forever on the server process (I use `wait <pids>`).
- Phase 9 carry-overs worth adding: set `BINDER_CONCURRENCY`/`NODE_OPTIONS` for the droplet size; `binders.pdf` makes the nightly dump grow by ~100–300 KB per generation (already noted for the restore test).
- Open question: should the draft notice also depend on `lib/binder/REVIEW.md` being reviewed? Today it follows documents, `br.ts` and the training module only.
