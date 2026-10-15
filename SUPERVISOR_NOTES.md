# Supervisor notes — worker task: Phase 6 (employee portal: acknowledgments, training, disclosure)

Overwrite each time — a relay, not a log. Only one relay at a time. Read this at the start of
your session before anything else.

---

## If this is a WORKER task

### Context
Phases 0–5 are accepted. Phase 5 (PR #7) may not be merged to `main` yet; your branch already contains it
(the supervisor merged `phase-5-whistleblower` into the base branch), so your PR to `main` will show
phase-5 commits until #7 merges — say so in the PR description. Phase 6 is the first feature with
**non-admin, non-account access** (tokenized employee links), so tenant isolation and token handling are
the risks: deep review. Keep the diff boring; no new dependencies (Node `crypto`, existing react-pdf; write
the CSV parser/serializer yourself — it is small — and unit-test it hard).

Read first: `CLAUDE.md` (§0, §6, §8, §9), the **Phase 6** section of `IMPLEMENTATION_PLAN.md`, SPEC §5.4 + §5.5,
CONTENT.md §5 ("Employee invitation email"), `lib/db/schema.ts` (`employees`, `acknowledgments`,
`trainingCompletions`, `disclosures`, `documents`), `lib/db/tenant.ts`, `lib/auth/require-tenant.ts`,
`lib/auth/links.ts` (token pattern), `lib/documents/` (store, web view, PDF styles),
`lib/dashboard/completion.ts`, `lib/whistleblower/crypto.ts` + `rotate.ts`, `lib/email/`,
`app/(app)/dashboard/{employees,training,page.tsx}`, `tests/dashboard-gate.test.ts`, `scripts/smoke.sh`, `verify.sh`.
Branch `phase-6-employee-portal` from **`origin/claude/trusting-lamport-aq0f52`**; PR to `main`; don't merge; don't push to `main`.

**Out of scope:** self-service "email me a new link", changing an employee's email, deleting employees (data
deletion = Esteban's call), annual retraining / re-assignment cycles, automatic reminder emails, SSO, employees
downloading PDFs, training content in locales other than pt-BR, vendors (phase 7), the binder (phase 8; but build
the roster model so phase 8 can reuse it), any new legal citation (the training and portal copy name no statute or article).

### Decisions already made (record deviations as judgment calls; if one touches a Guardrail, stop and write "blocked")

**Schema (one migration `0005`, committed, drift check green; every new table carries `company_id`)**
- `employees`: add `invited_at`, `invite_expires_at`, `deactivated_at` (timestamptz, nullable). Emails stored lower-cased (migration lower-cases existing rows); `UNIQUE (company_id, email)`.
- `acknowledgments`: `UNIQUE (employee_id, document_id)`; **append-only trigger** (reject UPDATE/DELETE/TRUNCATE, same pattern as migrations 0002/0004).
- `training_completions`: `UNIQUE (employee_id, module_id)`; append-only trigger. Rows exist only for passes.
- `disclosures`: add `period_year integer not null`; `UNIQUE (employee_id, type, period_year)`; append-only trigger; `content` is encrypted (below).
- New `employee_sessions` (id, company_id, employee_id, token_hash unique, expires_at, created_at). Rows may be deleted (sign-out, deactivation, re-issue).
- The generic gap: existing code/tests that insert employees/acks must be updated minimally; list every existing test you touch in HANDOFF.

**Roster and CSV**
- Import form on `/dashboard/employees`: one file, ≤ 256 KB, ≤ 500 data rows, UTF-8 with or without BOM, delimiter `,` or `;` (auto-detect from the header line), quoted fields with embedded delimiters/quotes/newlines, CRLF or LF. Header row required: `name,email` (also accept `nome,email`, case-insensitive). Per row: name 1–120 chars trimmed, email valid + ≤ 254 + lower-cased; duplicates inside the file keep the first. **Valid rows are imported, invalid rows are reported** (line number + reason; never echo more than the first 20). Existing active email → skipped; existing deactivated email → reactivated (and left un-invited until the admin sends an invite). Result summary: created / reactivated / skipped / invalid.
- CSV parser and serializer in one module with unit tests: BOM, `;`, quotes, embedded newline, empty trailing line, ragged rows, 501 rows, binary garbage → friendly error. **Export serializer neutralises formula injection**: a cell starting with `=`, `+`, `-`, `@`, tab or CR is prefixed with `'`.
- Deactivate/reactivate by action (never delete). Deactivating deletes the employee's sessions, clears the invite token, and excludes them from the grid default view and from every completion number; their records stay.

**Invites**
- Admin-triggered only: per-employee "Send / Resend invitation" and "Send pending invitations" (employees active and never invited, or whose link expired — at most **50 per click**, sequential; the result says sent / failed / remaining). `invited_at` is set only after a successful send; a failed send leaves it unset. Sending always issues a **new** token (random 32 bytes base64url; only `sha256` stored in `employees.invite_token_hash`), `invite_expires_at = now + 14 days`, which **kills the previous link** (the hash is replaced).
- Email per CONTENT.md §5 ("Employee invitation email"): es-AR wording verbatim; translate faithfully for pt-BR / en / es-MX and list every gap-filled string in `messages/DRAFTS.md` (CLAUDE.md §9). Link `APP_URL/employee/<token>`. Language = the company's country locale. Through `getEmailSender()`. No other content (no document text) in the mail.

**Token → session (the critical part)**
- `GET /employee/[token]` renders a "Start" page **without consuming** anything (mail-scanner prefetch must not burn the link) and without echoing the token anywhere except the form's hidden field. `POST /employee/api/session` (token in the body): atomically `UPDATE employees SET invite_token_hash = NULL … WHERE invite_token_hash = <sha256> AND invite_expires_at > now() AND deactivated_at IS NULL RETURNING id, company_id` — one statement, so two concurrent POSTs cannot both win. Success → insert an `employee_sessions` row (random 32-byte token, only its hash stored, 8-hour expiry), set cookie `employee_session`: httpOnly, `SameSite=Lax`, **`Path=/employee`** (so the browser never sends it to `/report`, `/dashboard` or anything else — to make that work **all employee handlers live under `/employee/api/…`**, not `/api/employee/…`), `Secure` when `APP_URL` is https, `Max-Age` 8h; 303 to `/employee`. Failure (unknown/used/expired/deactivated) → the same friendly page with the same copy ("this link is no longer valid — ask your administrator for a new one"), HTTP 200 or 410 (pick one, same for all cases), no stack trace, no hint which case it was.
- The employee identity and **company come only from the session row** (never from URL, query or body). `requireEmployee()` (mirror `requireTenant`: page version redirects to the friendly page; route-handler version returns 401) is used by **every** page and handler under `app/employee` (pages and `app/employee/api` handlers) except the token-entry page and the session-exchange route; add a coverage test in the style of `tests/dashboard-gate.test.ts`.
- Sign-out in the portal deletes the session row and clears the cookie. Pages and handlers: `Cache-Control: private, no-store`, `Referrer-Policy: no-referrer`, frame denial, `noindex` (`/employee` is already disallowed in robots.txt — keep the headers in `next.config` or code like the dashboard's).
- No rate limiter needed on the exchange (256-bit tokens); do not add one.

**Acknowledgments**
- Portal home `/employee` is a checklist: 6 documents, training (if available), current-year disclosure; progress shown. `/employee/documents/[id]`: renders the document's full content (reuse the structured-document renderer) and an "I have read and accept" button. The `[id]` must be a document belonging to the employee's company **and the latest version of its type**; anything else → 404 (an older version → a friendly "this document was updated, go back" page).
- `POST /employee/api/acknowledge`: employee + company from the session; insert with `onConflictDoNothing` on `(employee_id, document_id)` (double-click safe); stores `accepted_at` (DB `now()`) and `ip_address`.
- **IP rule (the one place a client IP is stored):** `lib/employee/client-ip.ts` is the **only** file that reads `cf-connecting-ip` (CLAUDE.md §3: Cloudflare is the only geo/IP source; never `x-forwarded-for`). Validate with `net.isIP`; absent/invalid → store NULL (dev/CI). Show the employee a plain line before accepting: date, time and IP address are recorded as proof of acceptance. **New `verify.sh` invariant:** `cf-connecting` appears in exactly one non-test file under `app`/`lib` outside `lib/whistleblower` + `app/report` + `app/api/report` (those must still contain none — `scripts/check-anonymity.sh` stays as is), and the acknowledge path writes the IP to no table other than `acknowledgments`. No user-agent, no other header, anywhere in this phase.
- Status semantic: an acknowledgment counts only if its `document_id` is the company's **current** latest version of that type; an older one shows as "outdated — accept the new version". (A regeneration with changed inputs therefore lowers completion until re-accepted; unchanged regenerate is a no-op already.)

**Training**
- `lib/training/` : module data (not code) for `pt-BR` only: **6 lessons** mirroring the document set (code of conduct basics, anti-bribery, gifts & hospitality, conflicts of interest, dealing with public officials, whistleblower protection / speaking up), each ~350–450 words with **one realistic scenario** and what to do; total reading time shown ≈ 15–25 min. **12 questions** (2 per lesson), 4 options, exactly one correct, each with a one-sentence explanation. Pass mark: `correct / total ≥ 0.8` (so 10 of 12 passes, 9 fails). Module id `anticorruption-pt-BR-v1`.
- Content rules: it is a **draft**: `lib/training/REVIEW.md` lists the lessons/quiz with status DRAFT and a note for Esteban; **no statute, article or decree is named** (point to "the company's code of conduct and policies"); no sentence claims the employee, the company or the training makes anyone compliant, certified, protected from liability or legally covered; completion copy says "Treinamento concluído", never "certificado". Extend the existing forbidden-claims invariant to cover `lib/training/` and the portal messages if it doesn't already.
- Delivery: lessons are pages `/employee/training/[n]` (server-rendered; question data sent to the client **without the correct answers**), the quiz is one form; `POST /employee/api/training` grades **server-side**, returns score + per-question correct/incorrect + explanation. Fail → nothing stored, retake allowed immediately. Pass → insert `training_completions` (module id, score as integer percent, `completed_at` DB now) idempotently (`onConflictDoNothing`). No timer, no minimum time.
- For a company whose locale has no training content (everything except pt-BR): the portal shows a clear "training not yet available" state for that step and the step is **excluded** from required steps and completion. Test it with an `es-AR` seeded company.

**Disclosure**
- `/employee/disclosure`: one form per calendar year (`period_year` = current **UTC** year; note it as a judgment call): radio "I have nothing to disclose" / "I have something to disclose" + details (required, ≤ 5000 chars, if the latter). Stored as `type = 'conflict_of_interest_annual'`, `content` = encrypted JSON `{"hasConflict":bool,"details":string}` using `lib/whistleblower/crypto.ts` (AAD `disclosures:<company_id>:content`; add the constant next to the others; same `REPORT_ENCRYPTION_KEYS` ring — do not introduce a second key). Extend `lib/whistleblower/rotate.ts` (+ its test) to re-encrypt `disclosures.content` (same sanctioned trigger-disable-in-transaction pattern as note bodies; counts only in the output) and add a README line. Second submit in the same year → friendly "already submitted", nothing changes.

**Completion definition (fills `lib/dashboard/completion.ts`)**
- Per active (non-deactivated) employee the required steps are: acknowledgment of each of the 6 current document versions + training (if available for the locale) + current-year disclosure. **Company completion % = completed required steps ÷ total required steps across active employees**, rounded **down** to an integer (never shows 100 unless truly 100). Zero active employees → `null` (Overview keeps "—"). Also expose "employees fully complete: N of M". Invited-but-not-started employees count as 0 done.
- One roster model, `lib/employee/roster.ts`: tenant-scoped function returning, per active employee, the status of every step (`done` with timestamp / `outdated` / `pending`) — used by the dashboard grid, the CSV, the PDF and (later) the binder. Unit-test the math, including: outdated ack, deactivated excluded, training unavailable, no employees.

**Dashboard (every file via `requireTenant`/`requireTenantRoute`; company from the session; ids from URLs are lookup keys combined with the session company; cross-tenant → 404)**
- `/dashboard/employees`: import form + result, summary bar (completion %, N of M complete), grid (name, email, invitation state, six document marks, training, disclosure; horizontal scroll or stacked cards on mobile), per-row invite/resend and deactivate/reactivate, "Send pending invitations", "show deactivated" toggle, exports (CSV, PDF). Empty state kept for zero employees.
- `/dashboard/employees/[id]`: that employee's record: acknowledgments (document title + version, timestamp, **IP**), training (score, date), disclosure (year, submitted date, **decrypted content**; a "cannot decrypt — key missing" state like phase 5). `private, no-store`.
- `/dashboard/training`: module overview (lessons, pass mark, time) + per-employee results (not started / failed attempts are not tracked / passed with score + date) + company training rate.
- **Exports** (`GET /dashboard/employees/export.csv` and `…/export.pdf`): roster status with ISO timestamps; **no IP and no disclosure content** (only "submitted yes/no + date"); CSV through the injection-safe serializer; PDF via react-pdf in the style of the phase 3 documents (company logo, title, generated date, A4, "Página X de Y", disclaimer footer, a compact table that paginates). The export must equal the grid (test: same rows, same marks).
- Overview widgets: completion % and the employees count become real (update the phase 4 tests that expect "—" only where employees exist).

### Action items
1. Migration + schema + tests that touch seeds.
2. `lib/employee/` (csv, roster, tokens/session, client-ip, acknowledge, disclosure, invites) and `lib/training/` (content, grading, REVIEW.md), each with unit tests.
3. Portal pages + handlers; dashboard pages + exports; invite email; messages in four locales (+ `DRAFTS.md`).
4. `verify.sh` invariants (client IP in one file; `request company_id` check extended to `app/employee`); README ("Employee portal: links, sessions and what is logged"); `.env.example` only if you add a variable (you shouldn't).
5. Tests (`npm run test -- employee`, real Postgres): token — GET does not consume; POST consumes once (second POST and a concurrent pair → exactly one session); expired, deactivated, re-issued-old, unknown tokens all produce the identical friendly response; stored value is a hash; session cookie flags; session expiry; deactivation kills sessions; **cross-tenant** — an employee session of company A can neither see nor acknowledge a document id of company B (404), employee/ack/disclosure rows never cross, dashboard employee detail/export/actions of company B → 404 from company A's admin; acknowledgments — IP stored from `cf-connecting-ip`, NULL when absent/garbage, idempotent double-submit, old version rejected/“outdated”, UPDATE/DELETE rejected by the DB (also training + disclosure); quiz — 9/12 fails and stores nothing, 10/12 passes and stores score, answers absent from the served page, retake works, pass is idempotent; disclosure — one per year, ciphertext in the DB (plaintext not present), decrypts in the detail page, rotation covers it; CSV — all cases above incl. formula injection on export; invites — new token each time, old link dies, ≤ 50 per click, failed send leaves `invited_at` unset, mail has no document content; completion math; the `requireEmployee` coverage test; unavailable-training locale; existing tests (`dashboard-gate`, tenant, payments, auth, session-revocation, whistleblower-*) stay green (edit them only where a seed/shape forces it, and list each edit).
6. `scripts/smoke.sh` (only this edit): import a 3-row CSV (with `;` and a BOM) → send invitations → read the three emails from the dev sink → GET the first link (verify it did not consume) → Start → acknowledge all six documents → fail the quiz once, pass it → submit the disclosure → admin grid shows that employee complete and the others pending; completion % matches hand-computed → CSV + PDF exports (`%PDF`, row count = grid, no IP column) → reuse the first link → friendly page; re-issue invalidates an unused link → company 2 admin gets 404 on company 1's employee detail and export. Show the smoke lines.

### Definition of done
`./verify.sh` exit 0 on the final code commit; `npm run test -- employee` green; smoke lines pasted. Raw outputs in HANDOFF.md: (a) the new IP invariant failing on a planted violation then passing; (b) `psql -x` of one `acknowledgments` row from the smoke run (shows the IP) and of the `disclosures` row (ciphertext, no plaintext); (c) the `employees` row of an invited employee showing a hash (not the token) and, after Start, `invite_token_hash` NULL; (d) the concurrent double-POST test output (one winner).

### Report back
Short `HANDOFF.md` per the template: what changed (migration, lib, portal, dashboard, exports, email), evidence above, full `./verify.sh` output on the final code commit, CI run id + head SHA (check status after a minute; if still queued say so), code tip vs pushed tip, judgment calls, and **Found / for the supervisor**: anything about token handling you would harden further, mail-scanner behaviour, anything touching phase 5 code (the rotation extension), what Esteban must do at deploy (migration 0005 on live data = his call; nothing else expected).

---

## If this is a VERIFICATION request

Not applicable for this relay.
