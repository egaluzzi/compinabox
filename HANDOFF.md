# Handoff — Phase 6: employee portal (acknowledgments, training, disclosure), 2026-10-15

Branch `phase-6-employee-portal` (from `origin/claude/trusting-lamport-aq0f52`), PR to `main`, **not merged**. The PR **also contains the phase 5 commits until PR #7 merges** (the base branch already carries the accepted phase 5 code).
**Code tip: 34e83ad** — `./verify.sh` ran on exactly this commit (exit 0, output below). Commits after it touch only `HANDOFF.md` and `docs/phase6-samples/`.
Guardrails touched, all settled by the notes — **nothing blocked**: tenant isolation (employee session → company from the DB row), the one stored client IP (acknowledgments), encryption at rest (disclosures), scope boundary / no certification claims (training + portal copy), append-only evidence, legal content (no citation added; the training names none). One migration (`0005_employee_portal.sql`), **no new dependency, no new env var**.

## What changed

**Migration `0005_employee_portal.sql`** (generated, then hand-edited; `drizzle-kit generate` reports no drift)
- `employees`: `invited_at`, `invite_expires_at`, `deactivated_at`; existing emails lower-cased, then `UNIQUE (company_id, email)`.
- `acknowledgments` `UNIQUE (employee_id, document_id)`; `training_completions` `UNIQUE (employee_id, module_id)`; `disclosures.period_year` (added nullable, backfilled from `submitted_at` UTC year, then `NOT NULL`, so it is safe on a DB that already has rows) + `UNIQUE (employee_id, type, period_year)`.
- **Append-only triggers** (UPDATE/DELETE/TRUNCATE rejected, same pattern as 0002/0004) on `acknowledgments`, `training_completions`, `disclosures`.
- New `employee_sessions` (id, company_id, employee_id, token_hash unique, expires_at, created_at); added to `TENANT_TABLES`.

**lib/employee/** — `csv.ts` (parser + serializer + formula neutraliser, written from scratch), `session.ts` (hash helpers, read-only `isInviteUsable`, atomic `startSession`, `getPortalEmployee`, `endSession`), `require-employee.ts` (`requireEmployee()` page gate → redirect to the friendly page; `requireEmployeeRoute(request)` → 401; `PORTAL_HEADERS`), `client-ip.ts` (the **only** file that reads `cf-connecting-ip`), `acknowledge.ts`, `disclosure.ts`, `training.ts`, `invites.ts` (`inviteEmail`, `sendInvite`, `sendPending`), `admin.ts` (import / deactivate / reactivate), `roster.ts` (**the** roster model + `computeCompletion`), `detail.ts`, `export.ts` (one table shape for grid/CSV/PDF), `pdf.tsx`, `labels.ts`, `constants.ts`.
**lib/training/** — `content.ts` (module `anticorruption-pt-BR-v1`: 6 lessons of 380–435 words each with one scenario + what to do, 12 questions, 4 options, one correct, one-sentence explanation; data, not code), `grading.ts` (server-side grading in integers: `correct*100 >= total*80`; `publicQuestions()` strips answers and explanations), `REVIEW.md` (everything DRAFT, note for Esteban).

**Portal** (`app/employee/`, its own root layout — no marketing layout, no banner/UTM) — `[token]` (read-only Start page), `link-invalid` (the one friendly page), `page.tsx` (checklist + progress), `documents/[id]`, `training/[n]` (lessons), `training/quiz` (+ client `Quiz` component: answers go to the server, verdict comes back), `disclosure`. Handlers **all under `/employee/api/`** (so `Path=/employee` covers them): `session` (the exchange), `acknowledge`, `training`, `disclosure`, `sign-out`. Headers (`Cache-Control: private, no-store`, `Referrer-Policy: no-referrer`, frame denial, `X-Robots-Tag`) in `next.config.ts` for pages and set in code by the handlers.

**Dashboard** — `/dashboard/employees` (import form + result, summary bar, grid, per-row send/resend + deactivate/reactivate, "send pending invitations (N)", show-deactivated toggle, CSV + PDF export links; empty state kept), `/dashboard/employees/[id]` (acknowledgments with timestamp + **IP**, training, **decrypted** disclosures, "cannot decrypt" state), `/dashboard/training` (module overview, per-employee results, company rate; "unavailable" for non-pt-BR), Overview widgets real (`companyCompletion`; employees count now = active employees). Route handlers `import`, `invite-pending`, `[id]/invite|deactivate|reactivate`, `export.csv`, `export.pdf` — every one through `requireTenantRoute`, ids are lookup keys combined with the session company, cross-tenant → 404. Sample of the export in `docs/phase6-samples/`.

**Email** — `inviteEmail()` per CONTENT.md §5 (es-AR wording as written; en / es-MX / pt-BR translated faithfully), through `getEmailSender()`, company-name + employee-name + link only (no document text).

**Messages** — 141 new keys in all four locales (`employee.*`, `dashboard.employees.*`, `dashboard.training.*`, `email.invite*`, `dashboard.overview.completionDetail`), 564 rows appended to `messages/DRAFTS.md` (the es-AR invite rows cite CONTENT.md §5; "Row counts" header line replaced by a pointer — the old per-locale counts were stale anyway).

**Phase 5 code touched** (the notes asked for it): `lib/whistleblower/rotate.ts` re-encrypts `disclosures.content` (same sanctioned pattern: `ALTER TABLE … DISABLE TRIGGER disclosures_no_update_delete` inside the rotation's own transaction; counts only), `RotateCounts.seen` gained `disclosures`, `AAD_TABLES.disclosures` added next to the others, `scripts/rotate-report-key.ts` prints the new count, README line.

**verify.sh** — new invariant block 4j: `cf-connecting` appears in exactly one non-test file under `app`/`lib`/`components`/`proxy.ts` outside the anonymous whistleblower trees (and `check-anonymity.sh` is untouched, so those must still contain none); `clientIp()` is called only by the acknowledge handler; `ipAddress`/`ip_address` is touched only by the schema, `acknowledge.ts`, `detail.ts` and the admin detail page (an allow-list compare, so a new reader fails the run); no `x-forwarded-*`/`user-agent`/`x-real-ip` header read outside the anonymous trees; no `console.*` in the portal beyond the fixed invitation-failure string; no "certific…" in training/portal code. The forbidden-claims grep (4d) now also scans `lib/training`, `lib/employee`, `components`; the existing "request company_id" check (4h) already scans all of `app/`, so it covers `app/employee`. **README** gained "Employee portal: links, sessions and what is logged".

**scripts/smoke.sh** — only this edit: the Phase 6 section (below).

## Evidence

**(a) The new IP invariant failing on a planted violation, then passing** (`lib/planted/spy.ts` reading both `cf-connecting-ip` and `user-agent`; raw, `SKIP_BUILD=1 ./verify.sh | grep …`; the final `FAIL` line in the second block is only "uncommitted changes" — that run was done before the last commit):
```
=== planted violation: lib/planted/spy.ts
export const spy = (req: Request) => req.headers.get("cf-connecting-ip") ?? req.headers.get("user-agent");
lib/planted/spy.ts
client ip                  FAIL: cf-connecting-ip must be read in exactly one file (lib/employee/client-ip.ts)
client ip callers          only the acknowledge handler
ip column                  only schema, acknowledgment writer, admin detail reader and its page
lib/planted/spy.ts:1:export const spy = (req: Request) => req.headers.get("cf-connecting-ip") ?? req.headers.get("user-agent");
request headers            FAIL: x-forwarded / user-agent / x-real-ip read outside the anonymous paths
--- result
verify.sh: FAIL (HEAD 7ba93d7)
exit=1

=== after removing it
client ip                  cf-connecting-ip read only in lib/employee/client-ip.ts
client ip callers          only the acknowledge handler
ip column                  only schema, acknowledgment writer, admin detail reader and its page
request headers            no other client-identifying header read
employee logging           nothing logged beyond the fixed invitation-failure string
training copy              no 'certificate' wording
verify.sh: FAIL (HEAD 7ba93d7)
```

**(b) Real rows from the smoke run** (`psql -x`; the first is the acknowledgment — it carries the IP; the second is the disclosure — ciphertext only, the details text `Minha prima é sócia da fornecedora Smoke 6e2f` appears nowhere in the row):
```
-[ RECORD 1 ]-------------------------------------
id          | 41483896-f841-46ef-bb8c-34385f75cdda
company_id  | 530f27a9-c7d8-4762-9693-aab2a53a777d
employee_id | 5da7b610-6642-404b-9d02-17b49426481d
document_id | 99f6a05c-add5-400f-a768-13575cb43b9a
accepted_at | 2026-10-15 11:18:40.871306+00
ip_address  | 203.0.113.11

-[ RECORD 1 ]+--------------------------------------------------------------
id           | 1559a4a6-f5ed-48a4-b16d-79671d0f43d5
company_id   | 530f27a9-c7d8-4762-9693-aab2a53a777d
employee_id  | 5da7b610-6642-404b-9d02-17b49426481d
type         | conflict_of_interest_annual
period_year  | 2026
content      | vsmoke:QmD5VaSNBDkbg+ZJ:SltaN/tVP8dGV9qPvEdNdQ==:e/pmDUKOHw0…
submitted_at | 2026-10-15 11:18:42.288733+00
```
(`content` truncated to 60 chars by `left()`; the format is `v<keyId>:iv:tag:ciphertext`. The request that stored the acknowledgment also carried `X-Forwarded-For: 198.51.100.99`; it is nowhere in the table.)

**(c) An invited employee row: a hash, not the token — and `invite_token_hash` NULL after Start** (same employee; smoke: the raw token is also asserted absent from the row):
```
-[ RECORD 1 ]-----+-----------------------------------------------------------------
id                | 5da7b610-6642-404b-9d02-17b49426481d
name              | Ana Smoke
email             | ana6-22628@example.test
invite_token_hash | 7c48541332fdf0bb74474fc7f54ee14b14e17dda2fcf74457edcebcce1610ffa
invited_at        | 2026-10-15 11:18:39.705+00
invite_expires_at | 2026-10-29 11:18:39.705+00
deactivated_at    | 

-- after the Start button (POST /employee/api/session):
-[ RECORD 1 ]-----+-------------------------------------
id                | 5da7b610-6642-404b-9d02-17b49426481d
email             | ana6-22628@example.test
invite_token_hash | 
invited_at        | 2026-10-15 11:18:39.705+00
invite_expires_at | 2026-10-29 11:18:39.705+00
```

**(d) The concurrent double-POST test** (`npx vitest run tests/employee-portal.test.tsx -t concurrent --reporter=verbose`): 8 simultaneous `startSession()` calls with one token → exactly 1 winner and 1 session row; then 3 simultaneous HTTP-handler POSTs → exactly 1 redirect to `/employee` and exactly 1 `Set-Cookie`:
```
 ✓ tests/employee-portal.test.tsx > token -> session > two concurrent POSTs with the same token: exactly one wins 316ms
      Tests  1 passed | 26 skipped (27)
```
`npm run test -- employee`: **6 files, 101 tests passed** (`employee-csv`, `employee-training`, `employee-completion`, `employee-portal`, `employee-dashboard`, `employee-gate`).

**Smoke — the Phase 6 lines** (real Postgres + real HTTP through the standalone server + the real dev email sink; the whole run: 230 `ok`, 0 `FAIL`):
```
ok    import (BOM + ';' + one bad line + one duplicate): 303, created 3, skipped 1, invalid 1, line 5 reported, no email in the URL
ok    DB: three employees, emails lower-cased, none invited yet
ok    admin grid lists the three, 'Não convidado', and the completion line says 0%
ok    send pending invitations: 303, 3 sent, 0 failed, 0 remaining
ok    three invitation emails reached the dev sink, each with its own /employee/<43-char token> link
--- smoke evidence: the invitation email as written to the dev sink
{"to":"ana6-22628@example.test","subject":"A Smoke Settings Ltda convida você a concluir seu treinamento de compliance","text":"Olá Ana Smoke, a Smoke Settings Ltda implementou um programa de compliance e precisamos que você conclua duas etapas curtas: 1) ler e aceitar o código de conduta e as políticas, 2) concluir um treinamento breve (15-20 min).\n\nComeçar →: http://localhost:44329/employee/uBiQtludeDTA_cxpAMBb0HWLk9BgnFiEOhiJu-oXrI4\n","html":"<p>Olá Ana Smoke, a Smoke Settings Ltda implementou um programa de compliance e precisamos que você conclua duas etapas curtas: 1) ler e aceitar o código de conduta e as políticas, 2) concluir um treinamento breve (15-20 min).</p><p><a href=\"http://localhost:44329/employee/uBiQtludeDTA_cxpAMBb0HWLk9BgnFiEOhiJu-oXrI4\">Começar →</a></p><p>http://localhost:44329/employee/uBiQtludeDTA_cxpAMBb0HWLk9BgnFiEOhiJu-oXrI4</p>"}
ok    invitation: pt-BR, names the employee, offers the two steps, carries no document text
ok    DB: invited_at set, 14-day expiry, only the sha256 hash stored (the raw token is nowhere in the row)
--- smoke evidence: the invited employee row (psql -x): a hash, not the token
-[ RECORD 1 ]-----+-----------------------------------------------------------------
id                | 5da7b610-6642-404b-9d02-17b49426481d
name              | Ana Smoke
email             | ana6-22628@example.test
invite_token_hash | 7c48541332fdf0bb74474fc7f54ee14b14e17dda2fcf74457edcebcce1610ffa
invited_at        | 2026-10-15 11:18:39.705+00
invite_expires_at | 2026-10-29 11:18:39.705+00
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
id                | 5da7b610-6642-404b-9d02-17b49426481d
email             | ana6-22628@example.test
invite_token_hash | 
invited_at        | 2026-10-15 11:18:39.705+00
invite_expires_at | 2026-10-29 11:18:39.705+00

ok    portal home: 200, private no-store, checklist shows 0 of 8 steps
ok    six document pages render (200) and six acknowledgments are accepted (303)
ok    double click: still exactly six acknowledgment rows
ok    IP stored from CF-Connecting-IP (203.0.113.11..16), never from X-Forwarded-For
--- smoke evidence: one acknowledgments row exactly as stored (psql -x) — it carries the client IP
-[ RECORD 1 ]-------------------------------------
id          | 41483896-f841-46ef-bb8c-34385f75cdda
company_id  | 530f27a9-c7d8-4762-9693-aab2a53a777d
employee_id | 5da7b610-6642-404b-9d02-17b49426481d
document_id | 99f6a05c-add5-400f-a768-13575cb43b9a
accepted_at | 2026-10-15 11:18:40.871306+00
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
id           | 1559a4a6-f5ed-48a4-b16d-79671d0f43d5
company_id   | 530f27a9-c7d8-4762-9693-aab2a53a777d
employee_id  | 5da7b610-6642-404b-9d02-17b49426481d
type         | conflict_of_interest_annual
period_year  | 2026
content      | vsmoke:QmD5VaSNBDkbg+ZJ:SltaN/tVP8dGV9qPvEdNdQ==:e/pmDUKOHw0…
submitted_at | 2026-10-15 11:18:42.288733+00

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
```

## `./verify.sh` on the final code commit (34e83ad) — exit 0

```
--- commit state
current HEAD               34e83ad  (2026-10-15T11:17:45+00:00)
branch                     phase-6-employee-portal
comparing against          7b415d4
commits this pass          12
uncommitted changes        0 file(s)
test files changed          17 files changed, 4618 insertions(+), 9 deletions(-)
--- secrets
secrets                    none found
.env.example               present
--- database
fresh database             verify_1792063065_21887
db:migrate                 ok (from scratch)
tables created             19
--- lint
lint                       ok
--- typecheck
typecheck                  ok
--- tests
 Test Files  36 passed (36)
      Tests  505 passed (505)
   Start at  11:17:59
   Duration  17.44s (tests 49%, import 27%, setup 14%, environment 6%, transform 3%)

     Import  227 modules were evaluated 1149 times · 12.27s total, 27% of tracked time
             ~2.36s faster with isolate: false — shared modules are evaluated once per worker instead of once per file
             learn more: https://vitest.dev/guide/improving-performance#test-isolation
test exit code             0
counts                     total=505 pass=505 fail=0 skip=0
--- build
build                      ok
standalone output          present
...
(smoke: 230 ok / 0 FAIL; the earlier phases' lines and the Phase 6 block above)
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
KNOWN_ISSUES.md            present
--- result
verify.sh: PASS (HEAD 34e83ad)

```

## Existing tests I touched (each forced by a shape change)
- `tests/tenant.test.ts` — the seed adds `periodYear: 2026` to its disclosure and one `employee_sessions` row (the new tenant table must be seeded; the test iterates `TENANT_TABLES`).
- `tests/dashboard-gate.test.ts` — the expected entry-point list gains the 8 new employee routes/pages.
- `tests/dashboard-headers.test.ts` — the rule list filter also skips `/employee*` (those are asserted in `tests/employee-gate.test.ts`).
- `tests/dashboard-routes.test.tsx` — employees page now takes `searchParams`; "—" for completion became "0%" (company A has one employee with nothing done).
- `tests/session-revocation.test.tsx` — employees page `searchParams` prop.
- `tests/whistleblower-keys-and-migration.test.ts` — rotation now also covers a disclosure: `seen` has `disclosures`, rewritten 4→5, plus an append-only re-check.
No test was weakened or skipped. `tests/documents-store.test.ts` (TRUNCATE documents, acknowledgments) still passes untouched.

## Judgment calls
1. **Mail first, then the token hash.** `sendInvite` sends the email with a fresh token and only after a successful send stores `sha256(token)`, `invited_at` and the 14-day expiry. A failed send therefore changes nothing — including a previous link, which keeps working. (The alternative — replace the hash first — would kill a good link when the mail bounces.)
2. **Deactivate keeps `invited_at`; reactivate clears `invited_at`, `invite_expires_at`, `invite_token_hash`** so a reactivated person shows "Não convidado" and is picked up by "send pending" ("left un-invited" in the notes). A reactivated employee who already completed everything is therefore also "pending" for a new invite; their records stay.
3. **Friendly page**: one page for every failure (unknown/used/expired/re-issued/deactivated link, missing/ended session, sign-out). Chosen status **200 everywhere**: GET of a bad `/employee/<token>` renders that content inline; the POST failure is a 303 to `/employee/link-invalid` (200). No session exists there, so the company language is unknown: the message is shown in pt-BR, es and en together.
4. **Disclosure year = UTC calendar year** (as the notes said); tested at the 31 Dec 23:59Z / 1 Jan 00:00Z boundary. Consequence for Brazil (UTC−3): a disclosure submitted between 21:00 and 23:59 São Paulo time on 31 December is recorded under the *next* year (and the next year's form will then show "already submitted" for someone who thinks they filed last year's). Rare, and harmless to the record; say so if you want São Paulo time instead.
5. **Quiz result** returns per-question correct/incorrect + the explanation, but **not which option was right**, so a failing employee cannot just read off the key (explanations still teach). The quiz is a client component using `fetch`; with JavaScript disabled it cannot be submitted (a form-only fallback was not asked for).
6. **Invite email for non-pt-BR companies** uses the CONTENT.md two-step body even though training is unavailable there (AR/MX are not launched). Flag for when ar/mx are enabled.
7. **CSV import result in the redirect URL** as counts + `line:reason` pairs only (never a name or email), so the result page needs no server-side flash storage. Duplicates inside the file count under "skipped".
8. **`countEmployees` (Overview "N colaboradores") counts active employees only**, consistent with "deactivated leave every number".
9. **Three entry points are exempt from the `requireEmployee` coverage test** and listed with reasons in `tests/employee-gate.test.ts`: `[token]/page.tsx` (read-only link page), `link-invalid/page.tsx` (no session exists), `api/session/route.ts` (the exchange). The test also asserts the exempt files never touch the portal session.
10. **Employee CSV/PDF**: the CSV starts with a UTF-8 BOM (Excel + accents), localized header, ISO timestamps; PDF is **A4 landscape** (ten columns) with the table header repeated on every page — the notes said A4, "a compact table that paginates".
11. **Training copy states what "the company's policies" say** (gift limits, no gifts to public officials without prior approval, no retaliation). Those statements are consistent with the phase 3 pt-BR templates I read, but the lessons are drafts: `lib/training/REVIEW.md` asks Esteban to check them against the generated policies.
12. **No rate limit on the exchange** (as instructed); no email-me-a-new-link; sessions are not purged when expired (see below).

## Found / for the supervisor
- **Token handling I would harden further:** (1) the token is in the URL *path*, so it can end up in Cloudflare/Caddy access logs and browser history; a URL *fragment* (`/employee#<token>`, read by a client script and POSTed) would keep it out of server logs, at the price of requiring JS on the Start page. (2) `employee_sessions` rows are never deleted when they expire (only on sign-out/deactivation); harmless but they accumulate — a purge in the phase 9 ops timer. (3) An employee whose session ended (8 h) or whose link was used has no self-service way back; the admin must re-send (out of scope per notes) — expect support load on day one.
- **Mail scanners:** the GET page consumes nothing, and the exchange is a POST, so a scanner that merely fetches the URL cannot burn the link; a scanner that *submits forms* would (none of the common ones do). Phase 9's real-inbox check is still the proof (already in the plan).
- **`cf-connecting-ip` is only trustworthy if the origin accepts Cloudflare traffic only** (already carried to phase 9). Until then the IP on an acknowledgment is whatever a direct caller sends; the invariant guarantees it is read in one place and stored in one column.
- **Phase 5 code touched:** only the rotation extension described above (`rotate.ts`, `constants.ts` AAD entry, the rotate script's output line, one test, one README line). The disclosure ciphertext shares `REPORT_ENCRYPTION_KEYS`, so dropping an old key after rotation now also requires `disclosures` to be clean — the script's counts show it.
- **Pre-existing smoke fragility (not mine):** the phase 2 smoke line "DB: only the session's company was renamed" derives `$OTHER` from "any other company in the database", which in `./verify.sh` exists only because vitest ran against the same fresh DB first. Run `scripts/smoke.sh` alone against a brand-new database and that one line fails. Not touched ("only this edit").
- **What Esteban must do at deploy:** migration `0005` against the live database is **his call** (CLAUDE.md §4/§8): it lower-cases existing `employees.email` (none exist before this phase), adds NOT NULL `disclosures.period_year` after a backfill (no rows expected), and creates three append-only tables' triggers; take the verified backup first. Nothing else: no new env var, no new service, no new dependency. Before the first real invitations: Resend sending domain (open input), and the pt-BR training + the invite-email wording reviewed (`lib/training/REVIEW.md`, `messages/DRAFTS.md`).
- Open legal/Esteban inputs this phase adds (already listed in CLAUDE.md §11 for the training): retention/purge periods for disclosures and acknowledgment IPs (append-only today — erasure would be a deliberate migration), and a notice to employees about the stored IP/time (the portal tells them at the moment of accepting).

## Code tip vs pushed tip
Code tip `34e83ad`; the branch tip after pushing this file is a docs-only commit on top (see the PR). PR and CI status: see the next section (added after the push).
