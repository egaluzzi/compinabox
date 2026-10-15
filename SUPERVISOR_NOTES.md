# Supervisor notes — worker task: Phase 5 (whistleblower intake + case log)

Overwrite each time — a relay, not a log. Only one relay at a time. Read this at the start of
your session before anything else.

---

## If this is a WORKER task

### Context
Phases 0-4b are merged. Phase 5 is the product's most sensitive surface: whistleblower data. Three
Guardrails (CLAUDE.md §8) are live here — **anonymous reporting, multi-tenant isolation, and the
scope boundary** — plus SPEC §11 (encryption at rest). Deep review. Keep the diff tight and
boring; no new dependencies unless you cannot do it with Node's `crypto` (state why in HANDOFF if you add one).

Read first: `CLAUDE.md` (§0, §6, §8, §9), the **Phase 5** section of `IMPLEMENTATION_PLAN.md`,
SPEC §5.3 and §11, CONTENT.md §5 ("Whistleblower public page"), `lib/db/schema.ts`
(`whistleblowerReports`, `companies`), `lib/db/tenant.ts`, `lib/auth/require-tenant.ts`,
`lib/uploads.ts`, `lib/email/`, `lib/checkout/attempt.ts` (provisioning), `app/(app)/dashboard/whistleblower/page.tsx`,
`tests/dashboard-gate.test.ts`, `scripts/smoke.sh`, `verify.sh`.
Branch `phase-5-whistleblower` from **`origin/claude/trusting-lamport-aq0f52`** (it carries this
scope commit on top of current `main`); open the PR to `main`; don't merge; don't push to `main`.

**Out of scope:** two-way messaging with the reporter, an investigation workflow beyond status +
notes, deleting/retaining/purging reports (retention is a legal + Esteban decision — list it as a
suggestion for the lawyer in HANDOFF, build nothing), evidence types other than PNG/JPEG,
CAPTCHA, reading any client IP for rate limiting, routing reports to more than the admin, the
binder's "channel proof" (phase 8), any change to Caddy/Cloudflare config (phase 9), any new
legal citation.

### Decisions already made (record deviations as judgment calls; if one touches a Guardrail, stop and write "blocked")

**Company slug**
- `companies.slug text not null unique`. Generated at provisioning inside the existing webhook
  transaction: ASCII-slugify the company name (strip accents, lowercase, `[a-z0-9-]`, max ~40
  chars), and on collision append `-` + 4 random chars from `[a-z0-9]`. If the name slugifies to
  empty use `empresa`. **Immutable** (settings rename does not change it — the URL is printed in
  documents and given to employees). Migration backfills existing rows by the same rule, then sets
  NOT NULL. Update every test seed that inserts a company (grep them all) and the provisioning
  path; touch the provisioning code **only** to add the slug, and say so in HANDOFF (it is the money path; the
  payments tests must stay green untouched).
- Slug generation lives in one pure, unit-tested function.

**Public pages and handlers (`app/report/[slug]` as its own route group/root layout — it must not inherit the marketing cookie banner or UTM capture; `proxy.ts` matcher stays as is)**
- Pages: `/report/[slug]` (form) and `/report/[slug]/status`. Submission: `POST /api/report/[slug]`;
  status lookup: `POST /api/report/[slug]/status` (POST so the code never lands in a URL, history,
  or a referrer). Unknown slug → 404.
- Language = the company's country locale (`br` → pt-BR, etc.), all strings from `messages/*.json`.
  CONTENT.md §5 has the copy in Spanish only: use it verbatim for es-AR, translate faithfully for
  pt-BR / en / es-MX and list every gap-filled string in `messages/DRAFTS.md` (CLAUDE.md §9).
  Branding: company name + logo (logo via the existing public uploads route). No scope-boundary
  violations: no copy promising legal protection, compliance or outcomes ("we commit to review
  every report" is CONTENT.md's wording and stays).
- Response headers on both pages and both handlers: `Cache-Control: no-store`, `Referrer-Policy: no-referrer`,
  frame denial, `X-Robots-Tag: noindex` + `<meta robots noindex>`. **No cookies are set or read**, no consent banner, no
  third-party requests (self-hosted fonts/assets only).
- Form: category (corruption/bribery, conflict_of_interest, fraud, harassment, other — stored as
  those keys), description (1–10,000 chars), optional evidence, "leave contact details?" yes/no,
  contact (required and ≤ 254 chars only if yes), plus a hidden honeypot field (filled → pretend success, store nothing).
  Works with plain `fetch` multipart; progressive enhancement not required, but no JS-only gate that
  blocks keyboard users; accessible labels/errors.
- Confirmation shows the tracking code once, grouped `XXXX-XXXX-XXXX`, with "save this code" copy.

**Anonymity (the core guardrail)**
- The report handlers and pages must not read or store: IP, `x-forwarded-for`, `cf-connecting-ip`,
  `user-agent`, referer, accept-language, cookies, or any header; they use `request.formData()` /
  `request.json()` only. No `console.*` of request or body content anywhere on these paths; error
  paths log a fixed string at most.
- `is_anonymous = !wants_contact`; `reporter_contact` is NULL unless opted in.
- **New `verify.sh` invariant** (mechanical, in the existing style): files under `app/report` and
  `app/api/report` and `lib/whistleblower` must not contain `headers(`, `x-forwarded`, `cf-connecting`,
  `user-agent`, `.ip`, `cookies(`, `console.` — exits non-zero otherwise. Add a test for the invariant script's patterns
  if the existing invariants are tested that way; otherwise show it failing once against a planted violation, in HANDOFF.
- **Rate limiting without reading an IP:** in-process, in-memory counters keyed by **slug** only
  (e.g. status lookups 10/minute/slug, submissions 20/hour/slug → 429 with a friendly message).
  State in a code comment and in HANDOFF that this is a per-company ceiling and per-IP limiting is a Cloudflare rule
  added in phase 9 (already on that checklist). The tracking-code entropy is the real enumeration defence.
- `created_at` stays as is (full timestamp — it is audit evidence).

**Tracking code and status lookup**
- 12 chars from `ABCDEFGHJKMNPQRSTUVWXYZ23456789` (no 0/O/1/I/L), `crypto.randomInt`, retry on unique-violation (a few tries, then 500 with a fixed message). Stored normalised (no dashes, uppercase); input normalised the same way (strip spaces/dashes, uppercase).
- Lookup is `(company from slug, code)`. Wrong code, wrong company, malformed code → **the same response body and status** (404 with the same "not found" copy). Lookup returns only: status label (new → "Received", under_review → "Under review", closed → "Closed") and the date of the last status change. Nothing else — no category, no description, no notes.

**Encryption**
- `lib/whistleblower/crypto.ts`: AES-256-GCM via `node:crypto`; random 12-byte IV per value; AAD binds the ciphertext to its row context (`<table>:<company_id>:<field>` — so a ciphertext copied to another tenant/field fails to decrypt); output string `v<keyId>:<base64 iv>:<base64 tag>:<base64 ct>`.
- Keys: `REPORT_ENCRYPTION_KEYS` = comma-separated `id:base64(32 bytes)` list; the **first** is used to encrypt, all are accepted to decrypt. Missing/invalid/short key → throw at first use with a clear message (never fall back to plaintext or a default key; `.env.example` gets a placeholder, `CLAUDE.md` §6 env list is updated; tests use a fixed test key set in `vitest.setup.ts`).
- Encrypted fields: `description`, `reporter_contact`, note bodies, evidence file bytes. Not encrypted (needed for listing/filtering): category, status, tracking code, timestamps.
- `scripts/rotate-report-key.ts` (run through the repo's existing script mechanism; if there is none, a `tsx`-free approach such as a Vitest-tested library function plus a tiny `npm run` script — your call, record it): re-encrypts every encrypted column and evidence file under the current first key, idempotent, dry-run by default, `--apply` to write, **prints counts only, never content**. README gets a "Report encryption key: generate, rotate, back up" section (generate with `openssl rand -base64 32`; rotate = prepend new key, run script, later drop the old).
- Decryption failure in the dashboard shows a clear "cannot decrypt — key missing" state for that report; it never crashes the list.

**Evidence**
- New table `whistleblower_evidence` (id, company_id, report_id, file_name (server-chosen random, no client name stored), content_type (sniffed), size_bytes, created_at). ≤ 3 files, ≤ 5 MB each, PNG/JPEG only by magic-byte sniff (reuse `sniffImage`; client type/name ignored — nothing from the client's filename/type is stored).
- **Strip metadata before encrypting**: JPEG → drop all APPn (incl. EXIF, XMP, ICC) and COM segments while keeping image data; PNG → keep only critical chunks (IHDR, PLTE, IDAT, IEND) plus tRNS; drop `eXIf`, `tEXt`, `iTXt`, `zTXt`, `tIME`, etc. Pure functions, no new dependency, unit-tested with fixtures that contain EXIF GPS / text chunks (test builds the bytes in the test; assert the marker bytes are gone and the output still decodes: sniff + well-formed segment/chunk walk). If a file cannot be parsed cleanly → reject the file (422), don't store it.
- Stored encrypted under `EVIDENCE_DIR` (env, default `./evidence`; `/opt/compinabox/evidence` on the droplet) — **a different directory from `UPLOADS_DIR`**, never served by the app's public uploads route or Caddy. A test asserts the evidence dir is not `UPLOADS_DIR` / not under it and that `app/uploads/[name]` cannot return an evidence file name. Written with `wx`; the on-disk bytes must not start with PNG/JPEG magic (test).
- Downloaded only via `GET /dashboard/whistleblower/[id]/evidence/[evidenceId]` (inside the dashboard, `requireTenantRoute`, tenant from session, 404 cross-tenant): decrypt, send with the stored image type, `Content-Disposition: attachment`, `X-Content-Type-Options: nosniff`, `Cache-Control: private, no-store`.
- DB-first failure ordering: write the files, then the rows in one transaction; if the transaction fails remove the files you wrote; if file writing fails the report is not created (422/500, fixed message).

**Statuses and case log**
- Lifecycle `new` → `under_review` → `closed`; any transition among the three is allowed from the dashboard (reopening is real life). Migration: default `'new'`, `UPDATE ... SET status='new' WHERE status='received'`, add a CHECK constraint on the three values. Add `status_changed_at` and `resolved_at` (set when moved to `closed`, cleared on reopen) to `whistleblower_reports`. Update `OPEN_REPORT_STATUSES` and every test/seed that uses `received`.
- New table `whistleblower_notes` (id, company_id, report_id, kind `note | status_change`, body (encrypted; for `status_change` a plain `from→to` pair is enough — store as columns `from_status`/`to_status`, body null), author_user_id, created_at). **Append-only enforced by a DB trigger** (copy the pattern from migration `0002_documents_append_only`: block UPDATE/DELETE/TRUNCATE). Every status change inserts a `status_change` row in the same transaction as the report update — that is the audit trail ("this log is itself audit evidence", SPEC §5.3).
- Status change and note writes: server actions or route handlers going through `requireTenant`/`requireTenantRoute`; report id from the URL is only a lookup key combined with the session `company_id`; the update statement itself carries `AND company_id = <session>`.

**Dashboard (inside the existing shell; every file uses `requireTenant`)**
- `/dashboard/whistleblower`: at the top, the channel URL (`APP_URL` + `/report/<slug>`) with a copy control and one line of copy; below, a table (received date, category, status, open-case emphasis), newest first, limit 100, empty state kept. No description preview in the list (shoulder-surfing + decryption cost).
- `/dashboard/whistleblower/[id]`: decrypted description, category, status control, resolution date, contact (or "anonymous"), evidence list, notes timeline (notes + status changes, oldest first), add-note form. Pages `private, no-store` like the rest of the dashboard.
- Strings via the existing dashboard messages (all four locales; pt-BR is the one that matters; gap-fills go in `DRAFTS.md`).

**Notification email**
- After the report transaction commits, send one email to the company's admin user(s) (`users` where company_id): subject "Nova denúncia recebida no seu canal" (localized), body: "A new report was submitted to your whistleblower channel. Sign in to review it: <APP_URL>/dashboard/whistleblower". **No category, no description, no tracking code, no timestamp finer than the email's own date, no report id.** Send failure is caught and logged as a fixed string; the report stays saved and the submission still succeeds (a report is never lost because email is down). Sent through `getEmailSender()`.

### Action items
1. Migration(s) (one is fine): `companies.slug` (+ backfill + not null + unique), report status default/CHECK/backfill, `status_changed_at`, `resolved_at`, `whistleblower_evidence`, `whistleblower_notes` (+ append-only trigger). Committed, drift check passes. Both new tables carry `company_id`.
2. `lib/whistleblower/` (slug, tracking code, crypto, image-strip, evidence store, rate limiter, queries) with unit tests for each.
3. Public pages + handlers; dashboard list/detail/evidence/notes/status; notification email.
4. Messages in four locales + `DRAFTS.md` entries.
5. `verify.sh`: the new anonymity invariant (and `request company_id` invariant stays green); `.env.example` (`REPORT_ENCRYPTION_KEYS`, `EVIDENCE_DIR`), `CLAUDE.md` §6 env list, README sections (key generation/rotation/backup; evidence dir; "what the intake does and does not log").
6. Tests (`npm run test -- whistleblower`, real Postgres):
   - anonymous submit sent **with marker headers** (`x-forwarded-for: 203.0.113.77`, `cf-connecting-ip`, `user-agent: AnonProbe/9.9`, a cookie) → afterwards a full-database text search (every text/varchar/jsonb column of every table, via `information_schema`) finds none of the markers; the report row has `reporter_contact IS NULL`, `is_anonymous = true`; description column is ciphertext not containing the plaintext
   - opt-in contact path: contact is stored encrypted, `is_anonymous = false`
   - cross-tenant: company B's session gets 404 for A's report detail, evidence, status change, note; list shows only own; status endpoint with A's code on B's slug is indistinguishable from a wrong code
   - tracking code: alphabet/length/uniqueness retry; wrong vs malformed vs right-slug-wrong-code responses are byte-identical; rate limit 429 after threshold and per slug isolation
   - crypto: round trip, tamper → throws, AAD mismatch (ciphertext moved to another company/field) → throws, rotation (encrypt with key1, add key2 first, still decrypts, rotate script re-encrypts, counts only in output), missing key → throws
   - evidence: EXIF/GPS and text-chunk markers gone, bad/oversize/4th file rejected, unparsable image rejected, evidence dir separation, download route sets attachment + nosniff
   - notes: append-only (UPDATE/DELETE rejected at the DB), status change writes a `status_change` row; resolution date set on close and cleared on reopen
   - email: sent to the admin, body contains none of category/description/code/id; email failure doesn't fail the submission
   - statuses: `countOpenReports` counts `new` + `under_review` only; migration backfills `received`
   - existing coverage tests (`dashboard-gate`, tenant isolation, payments, auth) stay green untouched
7. `scripts/smoke.sh`: extend (only this edit) with the full flow against the standalone build: submit an anonymous report with an image carrying an EXIF marker → get code → status lookup shows "Received" → sign in as the admin → report appears, detail decrypts, evidence downloads and has no EXIF marker → add a note → move to under review, then closed → public status shows "Closed" → company B's jar gets 404 on A's report → welcome/notification email was written to the dev sink and contains no report content. Show the smoke lines.

### Definition of done
`./verify.sh` exit 0 on the final code commit; `npm run test -- whistleblower` green; smoke lines pasted.
In HANDOFF.md include, as **raw output**: (a) the anonymity invariant failing once on a planted violation then passing; (b) `psql` of the anonymous report row from the smoke run showing NULL contact and ciphertext description (select the row, not the whole table); (c) `ls -l` + `xxd | head -2` of one evidence file on disk showing it is not an image; (d) the full-database marker search coming back empty, next to a positive control (the same search finds a marker you deliberately insert) so the empty result is meaningful.

### Report back
Short `HANDOFF.md` per the template: what changed (grouped by migration, lib, public, dashboard), evidence above, full `./verify.sh` output on the final code commit, CI run id + head SHA via the GitHub tools (if no run exists, say so and retry once after a minute), code tip vs pushed tip, judgment calls, and **Found / for the supervisor**: anything you noticed that touches anonymity outside your paths (e.g. framework or server logging of request data, Next.js telemetry), suggestions for the lawyer (retention, reporter notices, LGPD basis), and what Esteban must do at deploy (key creation, evidence dir, migration — flag, don't decide).

---

## If this is a VERIFICATION request

Not applicable for this relay.
