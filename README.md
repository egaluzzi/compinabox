# ComplyStart

Placeholder product name (see `CLAUDE.md` §11). Durable project context, stack decisions and guardrails live in [CLAUDE.md](CLAUDE.md) — read it first.

## Run locally

- Node 22 (see `.nvmrc`; `nvm use`)
- `npm ci`
- `cp .env.example .env` and fill in values (placeholders only until the phases that use them)
- `npm run dev` — dev server on http://localhost:3000
- `./verify.sh` — lint, typecheck, tests, build and project invariants; must exit 0 before work is handed off

## How the handoff files work

Work runs in phases (see `IMPLEMENTATION_PLAN.md`). A supervisor session scopes the next piece of work in `SUPERVISOR_NOTES.md`, which a worker session reads first. The worker implements it on a branch, runs `./verify.sh`, and reports back in `HANDOFF.md` with the real command output as evidence. Both files are overwritten on every relay; they are not a log.

The supervisor audits `HANDOFF.md` against the evidence and accepts or rejects the phase. `IMPLEMENTATION_PLAN.md` is the permanent record: its checkboxes are ticked as work is accepted. Decisions and rules for both roles are in [CLAUDE.md](CLAUDE.md).

## Database and local setup (phase 2)

- Postgres 16. Create a database and set `DATABASE_URL` in `.env` (see `.env.example`).
- `npm run db:migrate` applies the committed migrations in `lib/db/migrations/`; after a schema change in `lib/db/schema.ts` run `npm run db:generate` and commit the new migration. Never alter the live schema by hand.
- Tests that touch the database need `TEST_DATABASE_URL` (a Postgres that may `CREATE DATABASE`). `./verify.sh` creates a fresh database there, migrates it from scratch, runs the suite and the live smoke flow against it, and drops it. If it is unset the DB-backed tests **fail** (they never skip).
- Local checkout without Mercado Pago: set `PAYMENT_PROVIDER=fake`, `ALLOW_FAKE_PAYMENTS=true`, `FAKE_PAYMENTS_SECRET=<random>`, and `EMAIL_DEV_SINK=true` (emails are written to `.dev-outbox/`). **Never set `ALLOW_FAKE_PAYMENTS` on the droplet** — it provisions accounts without payment.

## Backups

Whistleblower data lives in this database; backups must exist and a restore must have been tested **before the first real customer** (CLAUDE.md §4, gated in phase 9).

**What runs:** `scripts/backup.sh` does `pg_dump` → gzip → integrity check → upload to DigitalOcean Spaces with `s3cmd` → prune dumps older than `BACKUP_KEEP_DAYS` (default 30). A failed dump exits nonzero and uploads nothing. A systemd timer (`ops/backup/complystart-backup.{service,timer}`) runs it nightly at ~03:15 UTC.

**Install on the droplet (Esteban / phase 9):**
1. `sudo apt-get install -y s3cmd postgresql-client` and, as the `complystart` user, `s3cmd --configure` with a Spaces key limited to the backup bucket (credentials stay in that user's `~/.s3cfg`, never in the repo).
2. Add to `/opt/compinabox/.env`: `BACKUP_DEST=s3://<space>/complystart-backups` and optionally `BACKUP_KEEP_DAYS=30` (`DATABASE_URL` is already there).
3. `sudo cp ops/backup/complystart-backup.* /etc/systemd/system/ && sudo systemctl daemon-reload && sudo systemctl enable --now complystart-backup.timer`
4. Run it once by hand: `sudo systemctl start complystart-backup.service && journalctl -u complystart-backup.service -n 20` — expect `backup ok: …`. Check the object exists: `s3cmd ls s3://<space>/complystart-backups/`.
5. Turn on Spaces versioning/lifecycle if you want retention beyond the script's pruning.

**Restore (and the monthly restore test):**
1. Fetch a dump: `s3cmd get s3://<space>/complystart-backups/complystart-<stamp>.sql.gz`
2. Run the restore test: `SCRATCH_ADMIN_URL=<url of a role that may create databases, ending /postgres> scripts/restore-test.sh complystart-<stamp>.sql.gz` (no `DATABASE_URL` needed). It restores the dump into a scratch database, compares each table's restored row count with the number of rows recorded **in the dump itself** (its `COPY` blocks), prints a per-table `in dump` / `restored` table, and drops the scratch database. It works on a dump of any age; the live database is never touched.
   - **PASS means:** the dump is a valid gzip, restores with no SQL error, and every table in it (including `drizzle.__drizzle_migrations`) came back with exactly the rows the dump contains and no table is missing.
   - **FAIL means:** a bad gzip, a SQL/COPY error (truncated or damaged dump), or a missing/mismatching table — the table is named in the output.
   - **PASS does not mean:** that the dump is complete relative to the live database (rows deleted from the file consistently are invisible to it), or that the dump is recent — check the timestamp in the file name against the nightly schedule.
3. Real recovery: stop the app (`sudo systemctl stop complystart`), create an empty database, `gunzip -c complystart-<stamp>.sql.gz | psql <new database url>`, point `DATABASE_URL` at it, start the app. Note: a dump holds everything up to its timestamp; anything written since is lost.

To exercise the scripts without Spaces: `BACKUP_DEST=local:/some/dir scripts/backup.sh`.

## Whistleblower channel (phase 5)

Public intake at `/report/<company slug>` (pages `/report/<slug>` and `/report/<slug>/status`; handlers `POST /api/report/<slug>` and `/api/report/<slug>/status`). Reviewed by the company admin under Dashboard → Canal de denúncias. Decisions and guardrails: `CLAUDE.md` §8, `SPEC.md` §5.3 and §11.

### What the intake does and does not log

- The intake handlers and pages read **only** the submitted form (or JSON body) and the slug in the URL. They do not read or store the visitor's IP address, `X-Forwarded-For`, `CF-Connecting-IP`, the browser identifier, the referrer, language headers or cookies, and they set **no cookie**. `is_anonymous = !wants_contact`; the contact is stored (encrypted) only if the reporter opts in. The `whistleblower_reports` table has no IP/user-agent column.
- `scripts/check-anonymity.sh` (run by `./verify.sh`) fails the build if anything under `app/report`, `app/api/report` or `lib/whistleblower` mentions request headers, forwarded/client addresses, the browser identifier, cookies or `console.*`. Error paths log nothing there; the notification email (outside that tree) logs one fixed string on failure.
- `created_at` is a full timestamp (it is audit evidence). Evidence images are stripped of EXIF/XMP/ICC/text metadata before they are encrypted.
- **Outside the app's control:** Caddy, Cloudflare, the OS and Next.js itself can still log request metadata (access logs, platform telemetry). Configure those for the channel's paths in phase 9; do not describe the channel to reporters as untraceable.
- Rate limiting is in-process and per company slug (status lookups 10/minute, submissions 20/hour; HTTP 429) because no client address is read. A per-IP limit is a Cloudflare rule (phase 9). The 12-character tracking code (~59 bits) is what prevents enumeration.

### Report encryption key: generate, rotate, back up

`description`, `reporter_contact`, case-note bodies and evidence files are encrypted with AES-256-GCM (`lib/whistleblower/crypto.ts`). Each ciphertext carries its key id (`v<id>:…`) and is bound (as AAD) to its table, company and column, so a value copied to another tenant or field fails to decrypt.

- **Generate:** `openssl rand -base64 32`. Put it in `/opt/compinabox/.env` as `REPORT_ENCRYPTION_KEYS=k1:<base64>` (`id:base64key`, ids are `[A-Za-z0-9_-]`, up to 16 characters). The first key encrypts; every listed key decrypts. There is no default key: unset or malformed makes the whistleblower pages fail loudly instead of storing plaintext.
- **Back up the key separately from the database and the evidence directory** (password manager / offline copy held by Esteban). A database or evidence backup without the key is unreadable ciphertext — and anyone holding both can read every report. The dashboard shows "cannot decrypt — key missing" for a report whose key is not configured; it never crashes the list.
- **Rotate:** (1) generate a new key and *prepend* it: `REPORT_ENCRYPTION_KEYS=k2:<new>,k1:<old>`; restart the app. New data uses `k2`; old data still decrypts. (2) From a checkout with `npm ci`, with the same `.env` loaded (`DATABASE_URL`, `EVIDENCE_DIR`, `REPORT_ENCRYPTION_KEYS`): `npm run rotate-report-key` is a **dry run** that prints counts only; `npm run rotate-report-key -- --apply` re-encrypts every encrypted column and evidence file under `k2` (idempotent; safe to re-run; prints counts only, never content; exit code 2 if some value could not be decrypted — it is left untouched). Take a database backup first. (3) Only after a clean `--apply` (0 failures) and a fresh backup, drop `k1` from the list.
- Employee conflict-of-interest disclosures (`disclosures.content`, phase 6) use the same key ring and are re-encrypted by the same script; that table is append-only too, and the script switches its update trigger off inside its own transaction exactly as for the case log.
- Vendor questionnaire answers (`vendor_responses`, phase 7: respondent name/role, ownership text, PEP and sanctions details — five encrypted columns per row) use the same key ring and are re-encrypted by the same script; that table is append-only too, same trigger-off-inside-the-transaction pattern.
- The case log (`whistleblower_notes`) is append-only at the database level. The rotation script switches the update trigger off for the length of its own transaction only (DDL is transactional, so a failure rolls the trigger back on) and changes nothing but the ciphertext of note bodies.

### Evidence directory

Evidence images are stored **encrypted** under `EVIDENCE_DIR` (default `./evidence`; `/opt/compinabox/evidence` on the droplet, mode 700, owned by the service user). It must be a different directory from `UPLOADS_DIR` and must never be served by Caddy or any public route — the app refuses to write if the two overlap. Files are named at random on disk; nothing from the uploader's file name or content type is stored. They leave the server only through the signed-in dashboard (`/dashboard/whistleblower/<id>/evidence/<evidence id>`, decrypted, as an attachment). **Back this directory up together with the database** (`scripts/backup.sh` covers the database only).

## Employee portal (phase 6)

### Employee portal: links, sessions and what is logged

Employees never get accounts. The admin imports a roster (`/dashboard/employees`, CSV `name,email`, ≤ 500 rows, ≤ 256 KB, `,` or `;`, BOM-safe) and sends invitations (per person, or "send pending", at most 50 per click). Each invitation carries a personal link, `APP_URL/employee/<token>`:

- **The token** is 32 random bytes (base64url). Only its `sha256` is stored (`employees.invite_token_hash`); it expires after 14 days; sending again always issues a new token and so kills the previous link. `invited_at` is set only after the mail was handed to the sender successfully.
- **Opening the link (GET) consumes nothing**, so a mail scanner or link preview cannot burn it. The page's *Start* button POSTs the token to `/employee/api/session`, which consumes it with one atomic `UPDATE … RETURNING` (two concurrent clicks: exactly one wins) and opens an 8-hour, DB-backed, revocable session (`employee_sessions`; only the hash of the cookie value is stored). Unknown, used, expired, re-issued and deactivated links all land on the same friendly page.
- **The session cookie** `employee_session` is `HttpOnly`, `SameSite=Lax`, `Secure` when `APP_URL` is https, and `Path=/employee`, so the browser never sends it to `/dashboard`, `/report` or anything else. For that reason every employee handler lives under `/employee/api/…`. Employee and company come only from the session row, never from the URL, query or body (`requireEmployee()` / `requireEmployeeRoute()`; `tests/employee-gate.test.ts` fails if a page or handler skips it). Sign-out and deactivation delete the session rows.
- **Pages and handlers** send `Cache-Control: private, no-store`, `Referrer-Policy: no-referrer`, frame denial and `noindex` (`next.config.ts`, and in the handlers themselves).

**What is logged.** Accepting a document stores `accepted_at` and the client IP in `acknowledgments.ip_address` — the audit trail the customer wants (SPEC §5.5) and the **only** place a client IP is stored. The IP is read from Cloudflare's `cf-connecting-ip` header in exactly one file, `lib/employee/client-ip.ts` (validated with `net.isIP`; absent or invalid → NULL; `x-forwarded-for` is never read). The employee is told before accepting. No user agent, no other header, no console logging in the portal. Training attempts are not recorded (only a pass, with its score). The annual conflict-of-interest disclosure is stored **encrypted** (`disclosures.content`, same `REPORT_ENCRYPTION_KEYS` ring as the whistleblower data; the key-rotation script covers it). `acknowledgments`, `training_completions` and `disclosures` are append-only at the database level.

**Deploy note.** `cf-connecting-ip` is only trustworthy if the origin accepts traffic from Cloudflare alone (firewall / Caddy allow-list of Cloudflare ranges) — carried to phase 9. Migration `0005` is a migration against live data: Esteban's call (CLAUDE.md §4).

The training module (pt-BR only; other languages show "not yet available" and are left out of completion) is a **draft**: see `lib/training/REVIEW.md`.

## Vendors: questionnaire and sanctions screening (phase 7)

### Questionnaire links and what is logged

An admin adds a vendor under `/dashboard/vendors` (name required; country, tax id and contact optional) and sends the questionnaire to the contact's email. The link `/vendor/<token>` is a random 32-byte secret; only its sha256 is stored (`vendors.invite_token_hash`). It lasts 30 days, a resend issues a new link and kills the old one, and the mail is sent **before** anything is stored, so a failed send changes nothing. Opening the link (GET) consumes nothing; submitting consumes it and stores the answers in one transaction, so two concurrent submits produce exactly one response. Unknown, used, expired, replaced and archived links all show the same friendly page. There are no vendor accounts or sessions.

The free-text answers (respondent name and role, ownership, PEP and sanctions details) are encrypted with the `REPORT_ENCRYPTION_KEYS` ring (see "Report encryption key"; rotation covers `vendor_responses`). `vendor_responses` and `vendor_screenings` are append-only at the database level: a resubmission after a resend is a new row, the newest is the current answer.

**What is logged: nothing identifying.** The public vendor paths (`app/vendor`, `components/vendor`, `lib/vendors/submit.ts`, `lib/vendors/answers.ts`) read no header, no client address, no user agent, no cookie, and write no log line; `scripts/check-vendor-privacy.sh` (run by `verify.sh`) fails on any of that. Ops: keep `/vendor/*` out of the Caddy access log like `/employee/*` (the token is in the URL path).

### Sanctions screening: what is sent, what is stored

Screening is an explicit admin click per vendor (`POST /dashboard/vendors/<id>/screen`). There is no bulk, scheduled or automatic screening: each run may cost money. Guards, all in `lib/screening/constants.ts`: a 5-minute cooldown per vendor and 50 screenings per company per UTC day (errors count — they may be billed).

- **Sent to the provider:** the vendor **name** and, if given, the **2-letter country code**. Nothing else — no company id, tax id, email or questionnaire answer. A test asserts the exact request body. The provider (OpenSanctions by default) therefore learns which names a customer checks: name it as a sub-processor in the privacy policy.
- **Stored:** per run, the provider and dataset, the name that was screened, the status (`no_match` / `possible_match` / `error`), and at most 10 matches reduced to `{id, caption, score, datasets, topics}`. Never the request or response body, headers, URL or API key. An error stores only a fixed short code (`timeout`, `auth`, `rate_limited`, `upstream`, `bad_response`, `not_configured`) and is shown as "screening failed", never as "no match".
- **Configuration:** `SCREENING_API_KEY` (unset or `changeme` = screening is visibly *unavailable*; the questionnaire still works; there is no fake provider in production code), `SCREENING_BASE_URL` (default `https://api.opensanctions.org`; must be `https`, except localhost for tests — otherwise the provider refuses to run so the key cannot leak over plain http), `SCREENING_DATASET` (default `default`). The key is read in exactly one file, `lib/screening/index.ts`.
- **Copy:** a screening tool against public lists, never an approval: "no results in the lists screened on <date>" / "possible match — review needed", always with the lists-and-date caveat. A result is never described as clear, approved or safe.
- **Live check:** `scripts/screening-live-check.sh` makes one real call through the production client for a clearly sanctioned name (needs `SCREENING_API_KEY` and network access to the provider). Mapping of the provider's response is marked `ASSUMED SHAPE` in `lib/screening/opensanctions.ts` until that check has run.
