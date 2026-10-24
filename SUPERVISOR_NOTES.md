# Supervisor notes — worker task: Phase 8 (binder / dossier generator)

Overwrite each time — a relay, not a log. Only one relay at a time. Read this at the start of
your session before anything else.

---

## If this is a WORKER task

### Context
Phases 0-7 are merged (Phase 7's real OpenSanctions round trip is still outstanding — it only affects
vendor screening, not this phase). Phase 8 assembles everything into one PDF the customer hands to an
auditor or procurement officer. Two things matter equally: **how it looks** (the plan says design
quality is a requirement) and **what it leaves out** (it will leave the customer's control: personal
data and whistleblower material must not leak into it). It states what the platform recorded **as of a
date**; it must never say or imply that the company is compliant, adequate or certified.

Read first: `CLAUDE.md` (§0, §3, §8, §9), the **Phase 8** section of `IMPLEMENTATION_PLAN.md`
(rewritten; it is the checklist), `SPEC.md` §5.4-§5.7, `KNOWN_ISSUES.md`. Code to reuse:
`lib/documents/{store,pdf}.tsx` and `components/DocumentView.tsx` (the six documents),
`lib/content/br.ts` (legal context), `lib/employee/{roster,export,pdf}.tsx` and
`lib/training/*` (training + acknowledgments + disclosure status), `lib/vendors/summary.ts`
(`summarizeVendors`, written for this phase), `lib/whistleblower/company-slug.ts` (channel URL),
`lib/dashboard/*`, `lib/auth/require-tenant.ts`. Branch `phase-8-binder` from current `main`; PR to
`main`; don't merge; don't push to `main`.

**Out of scope — log under "Not done":** share links or an auditor portal (the customer downloads and
sends the file), digital signatures/timestamping, e-mailing the binder, scheduled generation, QR codes,
editing binder content, screenshots (see below), other languages (company locale is pt-BR; UI strings
go in all four message files, the PDF text in the company's locale), Phase 9 items.

### Guardrails for this phase (a violation means stop and write "blocked")
- **No compliance claims** anywhere in the PDF or UI: no "em conformidade", "certificado",
  "aprovado", "adequado", "atende", ISO 37301/37002, and no verdict words about vendors (the existing
  vendor vocabulary test pattern applies; extend it to the `binder.*` namespace in every locale).
  The cover carries the not-legal-advice statement and a "how to read this dossier" paragraph saying
  it is a compilation of records as of a date, not an audit, certification or legal opinion.
- **Privacy exclusions (hard):** the binder never contains employee emails or IP addresses, disclosure
  contents, whistleblower report content, evidence, tracking codes, vendor questionnaire answers, or any
  decrypted value. `lib/binder/**` must not import `lib/whistleblower/crypto`, `lib/vendors/answers`,
  `lib/employee/client-ip`, or select those columns.
- Tenant isolation as everywhere: company from the session, other tenants' binder ids → 404.
- Never add a citation; legal references come from `br.ts` only (it is still a draft).

### Decisions already made (record deviations as judgment calls)
**Composition** — one react-pdf `Document` with many pages (no PDF-merge dependency): refactor the
existing document/roster renderers into reusable page components rather than merging PDFs. Order:
cover → contents → legal context → code of conduct → five policies → training report →
acknowledgment roster → disclosure status → whistleblower channel → vendor screening summary → data
notes appendix. Built-in fonts, A4, no network fetches. If any document or `br.ts` is still `draft`,
the cover shows the same "RASCUNHO — pendente de revisão" notice the documents carry.
- **Layout requirements:** logo + company name + CNPJ + as-of date + binder id on the cover; running
  header (company · dossier title); "Página X de Y" across the **whole** binder; section title pages or
  strong headings; long tables (roster, vendors) break across pages with a repeating header row and no
  orphan headings; contents with **PDF bookmarks (outline)** and clickable entries, plus real page
  numbers if you can do it with a two-pass render (measure then render) — if not, say so. Restrained,
  consistent, print-friendly (greyscale readable). Do not make it look like a marketing page.
- **Contents of each section:** *training* — module name/version and pass threshold from
  `lib/training`, counts (invited / completed / passed), per-employee name, status, date, score;
  *acknowledgments* — per employee × current document: accepted date or pending (names and dates only,
  **no IP, no email**); *disclosures* — counts and per-employee submitted date or pending, never the
  content; *whistleblower channel* — the public URL (`APP_URL` + `/report/<slug>`), when it became
  available (company slug creation), and a factual description of how it works taken from existing
  `messages` copy (anonymous by default, reporter gets a tracking code to check status, reports are
  visible only to the company's admin) — **claims about security/encryption must match what Phase 5
  actually does and be worded modestly**; *optional* channel statistics (total received and counts by
  status, no content), **off by default**, a checkbox at generation time; *vendors* — `summarizeVendors`
  output: name, country, questionnaire state and date, latest screening status/date/dataset, possible-
  match count; always labelled "ferramenta de triagem, não uma investigação de due diligence".
- **Screenshot:** SPEC §5.7 mentions a screenshot of the channel; we do not have a headless browser on
  the droplet (CLAUDE.md §3). Replace with URL + description + availability date. Record it as a
  deviation in HANDOFF.md.

**Async generation** (no queue infrastructure — one Node process under systemd):
- Table `binders` (company_id, status `queued|running|ready|failed`, requested_by_user_id, options jsonb,
  as_of, created/started/finished timestamps, error_code (fixed vocabulary), size_bytes, page_count,
  sha256, `pdf bytea`). **PDF bytes live in Postgres** (so `pg_dump` covers them); cap 25 MB, fail with
  `too_large` beyond it.
- Click → insert `queued` row (partial unique index: one queued/running binder per company; a second
  click returns the existing job) → respond immediately → the work runs in the same process (not
  awaited by the request). Process-wide concurrency cap (start with 2) via a small in-memory semaphore;
  jobs wait as `queued`. Recovery: any job `running`/`queued` older than a timeout (e.g. 10 min) is
  marked `failed` with `interrupted` when the page, the poll or a new request notices (no startup hook
  needed); the customer can retry.
- Rate limits: cooldown (e.g. 30 s) after a finished job and a daily cap (e.g. 20 per company per UTC day;
  failures count). Put the numbers in one constants file.
- Snapshot: read all source data inside one `REPEATABLE READ` transaction at job start, record `as_of`,
  then render from the in-memory snapshot — data changing mid-render must not appear (test it).
- Ready binders are **immutable and never deleted**: DB trigger blocks UPDATE/DELETE/TRUNCATE once
  `status = 'ready'` (status transitions before that are allowed), same family as earlier migrations.
  Store the SHA-256 of the PDF bytes; show it in the list so the customer can tell an auditor which file
  it is.
- Polling: small client component hits `GET /dashboard/binder/status?id=` (backoff, stops at ready/failed);
  works without JS via a refresh link.

**Routes/UI** — `/dashboard/binder` (not a ninth nav item): generate form (stats checkbox, the plain
notice "o arquivo contém nomes de colaboradores e datas; compartilhe só com quem precisa"), current job
status, list of previous binders (date, status, size, pages, hash, download). Routes: `POST
/dashboard/binder/generate`, `GET /dashboard/binder/status`, `GET /dashboard/binder/[id]/pdf`
(`attachment`, ASCII filename `dossie-<slug>-YYYYMMDD.pdf`, `Cache-Control: no-store`,
`X-Content-Type-Options: nosniff`). All through `requireTenant`/`requireTenantRoute` (the coverage test
must pick them up). Replace the disabled Overview card with the real one (latest binder state + link).
Strings: `binder.*` and dashboard strings in all four message files + `messages/DRAFTS.md` rows.

**`lib/binder/REVIEW.md`** — one list for the lawyer: every fixed text in the binder (cover statement,
"how to read", section intros, channel description, data notes) and the **personal-data question**
(employee names and acceptance dates leave the platform; emails and IPs excluded). Status DRAFT.

### Action items
Work the Phase 8 checklist top to bottom and tick it. Small logical commits. Then `./verify.sh` on the
final code commit, push, open the PR, wait for CI, write `HANDOFF.md`.

**`verify.sh` / smoke — permitted edits, only these:** (1) the forbidden-claims scan also covers
`lib/binder`; (2) `scripts/check-binder-privacy.sh` + a new verify.sh block (pattern: the existing
`check-vendor-privacy.sh`) failing on the forbidden imports/columns above in `lib/binder`, shown failing
on a planted violation then passing; (3) `scripts/smoke.sh`: after the existing flow generate a binder,
poll to ready, download (`%PDF`, headers, size > 0), the list shows it with a hash that matches
`sha256sum` of the downloaded file, a second company gets 404 for it, a second click while one is active
returns the same job, and a direct SQL `UPDATE`/`DELETE` on a ready binder fails.

### Definition of done
As in the Phase 8 section of the plan. Hand me evidence, not assurance:
- **Exclusion marker test:** seed one company with unique marker strings in every excluded field
  (employee emails, IPs, disclosure content, whistleblower description, tracking code, evidence file
  name, vendor questionnaire text, decrypted anything) and assert **none** appears in the extracted PDF
  text (pdfjs, as in phase 3), while the included fields (names, dates, statuses, vendor names, URL) do.
  Run it also with the statistics option on and off.
- Cross-tenant: company B's names/vendors/documents never appear in A's binder text; A gets 404 for B's
  binder id on download and status.
- Snapshot consistency, concurrency (double click → one job), stuck-job recovery, immutability trigger,
  cooldown/daily cap, size cap, binder with no employees/vendors/reports (honest empty sections),
  draft banner present while drafts exist.
- **Performance on a big company** (500 employees, 50 vendors, all documents): wall time and peak RSS,
  recorded in HANDOFF.md; say what droplet size you assume. If it exceeds ~60 s or ~600 MB RSS, say so
  and what you did.
- No new dependency unless justified in writing (a PDF text extractor for tests already exists).

**Images I can look at:** render with `pdftoppm` (or equivalent) the cover, a contents page, a page of
the roster table that continues onto a second page, the channel page and the vendor page; **view them
yourself**, iterate on anything ugly, and commit under `docs/phase8-samples/`. Say concretely in
HANDOFF.md what you saw (alignment, orphan headings, clipped text, accents, page numbers, header on
every page).

### Report back
`HANDOFF.md` per the template. Verification depth: real Postgres, real HTTP through the standalone
build with real session cookies, PDFs checked by extraction + rendered images. Add a **"For the
lawyer"** section (statements you were least sure of, the personal-data question) and the list of
judgment calls and open questions.

---

## If this is a VERIFICATION request

Not applicable for this relay.
