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
- Local checkout without Mercado Pago: set `PAYMENT_PROVIDER=fake`, `ALLOW_FAKE_PAYMENTS=true`, `FAKE_PAYMENTS_SECRET=<random>`, and `EMAIL_DEV_SINK=true` (emails are written to `.dev-outbox/`). `ALLOW_FAKE_PAYMENTS` provisions accounts without payment: it is allowed in development and on **staging** only, and the app refuses to start with it when `APP_ENV=production` (see "Environments" below).

## Environments (phase 9)

`APP_ENV` is `development` (the default when unset), `staging` or `production`. One tested function, `checkEnvironment()` in `lib/env.ts`, is used three times: at startup (`instrumentation.ts`), by `GET /api/health`, and — through the health check — by every deploy.

- **production** refuses to run with: `ALLOW_FAKE_PAYMENTS` switched on, `PAYMENT_PROVIDER=fake`, `EMAIL_DEV_SINK=true`, a missing or `changeme` `AUTH_SECRET` / `REPORT_ENCRYPTION_KEYS` / `APP_URL` / `AUTH_URL` / `DATABASE_URL`, or an `APP_URL` / `AUTH_URL` that is not https. At startup it throws (the service does not come up); `/api/health` answers 503 with the violation **codes** (never values); a deploy then rolls back. An unknown `APP_ENV` (a typo such as `prod`) is treated as production and reported as `app_env_invalid`. `PAYMENT_PROVIDER=none` is allowed (checkout unavailable). The placeholder price is refused by the existing checkout guard.
- **staging** shows a banner on every page (Portuguese: "Ambiente de teste — dados fictícios"; also en/es), answers `robots.txt` with `Disallow: /`, sends `X-Robots-Tag: noindex, nofollow` on every response, has an empty sitemap, loads no analytics, and allows fake payments and the e-mail sink. It must hold **fictitious data only**.
- **development**: nothing changes.

`GET /api/health` → `{"ok":true,"version":"<git sha>","db":true,"env":"staging"}` (503 when the database does not answer within 2 s or the guard is violated). No authentication, no secrets. `/dev-outbox` (staging only, with `EMAIL_DEV_SINK=true` and `DEV_OUTBOX_PASSWORD` set; user `outbox`) lists the newest 50 e-mails the sink wrote, with their links clickable; in every other configuration it is a plain 404.

## Staging server setup (Esteban: copy and paste, in this order)

**What this is.** A test copy of the product on your server `138.197.70.66`, in the folder `/opt/compinabox`. It has a "test environment" banner on every page, fake payments, no real e-mail (messages appear on a page, `/dev-outbox`, instead) and no search-engine indexing. **Put no real customer, employee or whistleblower data in it.** Nothing in this section was run on the server by the person who wrote it: the first time you follow it is the first time it runs there. If something looks different from what is written here, stop and send the output.

**You need:** (1) to be able to log in to the server as `root` over SSH; (2) admin access to the GitHub repository (to add secrets); (3) a terminal on your own computer (Mac: Terminal; Windows: PowerShell with OpenSSH, or WSL).

### 1. Make the deploy key (on your computer)
```bash
ssh-keygen -t ed25519 -N "" -C "complystart-deploy" -f ~/complystart-deploy-key
```
This creates two files: `~/complystart-deploy-key` (the **private** half — it goes into GitHub only, nowhere else, and is never e-mailed or pasted into a chat) and `~/complystart-deploy-key.pub` (the **public** half — it goes to the server). It has no passphrase because GitHub uses it without anyone present.

### 2. Copy the `ops` folder to the server
In a terminal on your computer, in the folder where you have the repository (on the `main` branch, after the pull request is merged):
```bash
scp -r ops root@138.197.70.66:/root/compinabox-ops
```
(No local copy of the repository? On GitHub press the green **Code** button → **Download ZIP**, unzip it, open a terminal in the unzipped folder and run the same command.)

### 3. Check the server, then set it up
Log in: `ssh root@138.197.70.66`. First a **dry run** that changes nothing and tells you whether this server is one the script understands:
```bash
bash /root/compinabox-ops/bootstrap-server.sh 138.197.70.66 --check
```
- If it ends with `all checks passed`, go on.
- If it says `NOT CONTINUING … Reasons:` (another Ubuntu version, something already using ports 80/443, another PostgreSQL or Node version, …), **copy the whole message and send it to the supervisor**. Nothing was changed.

Now the real run. On your computer show the public key (`cat ~/complystart-deploy-key.pub`), copy the whole line, and on the server run (paste your line between the quotes):
```bash
DEPLOY_PUBLIC_KEY='ssh-ed25519 AAAA…paste the whole line…' bash /root/compinabox-ops/bootstrap-server.sh 138.197.70.66
```
It installs Node 22, PostgreSQL 16 (reachable from the server only), Caddy and the firewall (SSH, 80, 443), creates the two users, the folders, the database and `/opt/compinabox/.env` with random secrets generated on the server, and the scheduled backup and clean-up jobs. It prints each step and, at the end, **the dev-outbox password — shown only once; write it down** (it is also in `/opt/compinabox/.env`, readable by root). Running the script a second time is safe: it prints `no changes: this server was already set up.` and touches nothing (an existing `.env` is never rewritten).

### 4. Get the server's identity line (so GitHub knows it is talking to your server)
Still on the server:
```bash
echo "138.197.70.66 $(cut -d' ' -f1,2 /etc/ssh/ssh_host_ed25519_key.pub)"
```
It prints one line starting with `138.197.70.66 ssh-ed25519 …`. Copy it. (This is read from the server itself — you are already logged in to it — not guessed from the network.)

### 5. Add the five GitHub secrets
GitHub → the repository → **Settings → Secrets and variables → Actions → New repository secret**. Add exactly these names:

| Name | Value |
| :- | :- |
| `DEPLOY_HOST` | `138.197.70.66` |
| `DEPLOY_USER` | `complystart-deploy` |
| `DEPLOY_SSH_KEY` | the **whole content** of `~/complystart-deploy-key` on your computer (`cat ~/complystart-deploy-key`; include the `-----BEGIN …` and `-----END …` lines) |
| `DEPLOY_KNOWN_HOSTS` | the line from step 4 |
| `DEV_OUTBOX_PASSWORD` | the password from step 3 |

### 6. Run the first deploy
GitHub → **Actions → Deploy staging → Run workflow** (branch `main`). It also runs by itself on every merge to `main`. Three jobs run one after the other: **Build** (refuses to continue if the merged pull request did not pass its CI), **Deploy** (uploads, applies database changes, switches to the new version, checks `/api/health`, rolls back by itself if the new version does not become healthy) and **Remote smoke test** (a scripted tour of the live site). All three must be green.

### 7. Open it
- **https://138.197.70.66/br** — your browser warns that the connection is not private. That is expected: the site uses a certificate the server made for itself, because there is no domain yet. Chrome: *Advanced → Proceed to 138.197.70.66*. Safari: *Show Details → visit this website*. You see the yellow test banner.
- **https://138.197.70.66/dev-outbox** — user `outbox`, the password from step 3. Every e-mail the product "sends" (sign-in links, welcome, employee and vendor invitations) shows up here with clickable links.
- A full fake purchase: `/br` → pricing → checkout (tick the terms box) → the test payment page → **Pay** → follow the welcome link in the outbox.

### 8. What to send back
The address of the green **Actions run** (the page you land on after clicking the run in the Actions tab).

### Roll back by hand
Each deploy keeps the last three versions in `/opt/compinabox/releases/`. On the server:
```bash
ls -1t /opt/compinabox/releases                       # newest first; pick the one you want
ln -sfn releases/<that-folder> /opt/compinabox/current && systemctl restart complystart
curl -s http://127.0.0.1:3000/api/health              # "version" should now be that folder's name
```
A rollback restores the **previous program code only**. Database changes (migrations) are forward-only and stay applied; if the older code cannot work with the newer database, the answer is a restore from a backup (see "Backups"), not a rollback.

### If something fails
- The deploy rolled itself back: the failed version is kept as `/opt/compinabox/releases/<sha>.failed`; `journalctl -u complystart -n 100 --no-pager` shows why (for example `ENVIRONMENT GUARD … refusing to start`).
- Site does not answer: `systemctl status complystart caddy` and `journalctl -u caddy -n 50 --no-pager`.
- A sentence in these steps does not match what you see: send the screen to the supervisor; do not improvise on the server.

### Check that the access log keeps secrets out
After the first deploy, as root on the server:
```bash
bash /opt/compinabox/current/scripts/check-caddy-logs.sh https://138.197.70.66
```
It makes a few requests with fake secrets in the address, the query and the cookie, then reads Caddy's log. It must end with `check-caddy-logs: PASS`. (`ops/Caddyfile` logs `/employee/…`, `/vendor/…` and `/api/welcome` with the secret part replaced by `[redacted]`, strips query strings, and does not log the whistleblower channel at all. Proven on a real Caddy 2.8.4 in `docs/phase9-samples/caddy-redaction-proof.txt`; the bare-IP certificate form (`tls internal` for an IP address) can only be proven on the server.)

### Later: a real certificate once there is a domain
In `/etc/caddy/Caddyfile` (and in `ops/Caddyfile`) change two things: put the domain where `https://138.197.70.66` is, and delete the line `tls internal`. Caddy then gets a public certificate by itself; then remove `CURL_K` from the smoke step of `.github/workflows/deploy.yml`. Production (Phase 9d) also needs Cloudflare in front, the origin reachable from Cloudflare only, a real e-mail provider and `APP_ENV=production`; none of that is part of staging.

### What lives where on the server
```
/opt/compinabox/.env             secrets and settings (mode 600, owner complystart; never in git; never printed)
/opt/compinabox/releases/<sha>/  one folder per version (last 3 kept);  current -> the live one
/opt/compinabox/incoming/        the upload area of the deploy
/opt/compinabox/data/{uploads,evidence,outbox}   files the app writes (not served by Caddy)
/opt/compinabox/backups/         nightly dumps + data archives (14 days)
```
`complystart.service` runs the app as the unprivileged user `complystart`; `complystart-deploy` can log in only with the deploy key and may run, as root, only `systemctl restart/is-active complystart` and the migration wrapper `/usr/local/sbin/complystart-migrate <sha>` (which refuses unless `.env` says `APP_ENV=staging`). Timers: `complystart-backup.timer` (03:15 UTC) and `complystart-maintenance.timer` (04:10 UTC, deletes expired employee sessions and sign-in tokens; prints counts only).

## Legal pages and terms acceptance (phase 9)

`/legal/privacy` and `/legal/terms` render **pt-BR drafts** written from what the product actually does (`lib/legal/privacy.ts`, `lib/legal/terms.ts`), marked DRAFT and `noindex`. They name the LGPD and nothing else (no articles, decrees or other laws), make no compliance claim, and show visible highlighted placeholders (`[CNPJ — a preencher]`, …) where facts or lawyer wording are still missing. `lib/legal/REVIEW.md` lists every placeholder and every assumption for the lawyer. A test fails if the text changes without a new version label (`lib/legal/version.ts`).

`/checkout` has a required checkbox linking both documents. `POST /api/checkout` is refused (`terms_not_accepted`) without it; the attempt stores `terms_accepted_at` and `terms_version` (migration `0008`).

## Analytics (phase 9)

`GTM_ID` (a real `GTM-XXXX` id) enables Google Tag Manager — **only** after the visitor accepted cookies, only outside `/report`, `/dashboard`, `/employee`, `/vendor`, `/login`, `/onboarding`, `/dev-outbox`, and never when `APP_ENV=staging`. Events through `dataLayer`: `view_pricing`, `begin_checkout`, `purchase` (`value`, `currency` only — no e-mail, name, tax id or ids) and `lead_generic_country_waitlist`. The footer's "Cookie settings" re-opens the choice; withdrawing consent stops further pushes (`lib/tracking.ts`, `tests/tracking.test.tsx`).

## Local rehearsal of the deploy (phase 9)

`scripts/rehearse-deploy.sh` (needs a finished `npm run build` and `TEST_DATABASE_URL`) runs the real `ops/deploy-remote.sh`, `ops/complystart-migrate` and `scripts/package-release.sh` against a temp tree and a real Postgres and node process: deploy A, deploy B, a deploy C that cannot start (rolled back automatically), a deploy D with a broken migration (aborted before the switch), a healthy deploy E (old and failed releases pruned), then `scripts/remote-smoke.sh` against the result. The transcript from the phase is in `docs/phase9-samples/rehearsal-transcript.txt`. What it does not cover: users and file permissions, systemd, Caddy, the real network (see `HANDOFF.md`).

## Backups

Whistleblower data lives in this database; backups must exist and a restore must have been tested **before the first real customer** (CLAUDE.md §4, Phase 9d). On staging the data is fictitious, but the same scripts run for real so the production step is a configuration change.

**What runs:** `scripts/backup.sh` does `pg_dump` → gzip → integrity check → copy to the destination → prune files older than `BACKUP_KEEP_DAYS` (default 30; 14 on staging). If `EVIDENCE_DIR` and/or `UPLOADS_DIR` are set it also writes `complystart-data-<same timestamp>.tar.gz` with those directories (the evidence files are already encrypted), delivered and pruned the same way; a set directory that does not exist fails the run. A failed dump exits nonzero. The systemd timer `complystart-backup.timer` (`ops/systemd/`) runs it nightly at ~03:15 UTC. **Staging:** the bootstrap script installs and enables it with `BACKUP_DEST=local:/opt/compinabox/backups`, so dumps stay on the same server (that protects against a bad deploy, not against losing the server — the off-server copy is Phase 9d).

**Run it by hand (staging):** `sudo systemctl start complystart-backup.service && journalctl -u complystart-backup.service -n 20` — expect `backup ok: …`; the files are in `/opt/compinabox/backups/`.

**Off-server copy for production (Phase 9d, Esteban):** `sudo apt-get install -y s3cmd`, as the `complystart` user `s3cmd --configure` with a Spaces key limited to the backup bucket (credentials stay in that user's `~/.s3cfg`), then in `/opt/compinabox/.env` set `BACKUP_DEST=s3://<space>/complystart-backups`. The script uploads with `s3cmd put` and prunes with `s3cmd del`.

**Restore (and the monthly restore test):**
1. Get a dump (`/opt/compinabox/backups/complystart-<stamp>.sql.gz`, or `s3cmd get …`).
2. Run the restore test: `SCRATCH_ADMIN_URL=<url of a role that may create databases, ending /postgres> scripts/restore-test.sh complystart-<stamp>.sql.gz` (no `DATABASE_URL` needed; on the server the script is in `/opt/compinabox/current/scripts/`). It restores the dump into a scratch database, compares each table's restored row count with the number of rows recorded **in the dump itself** (its `COPY` blocks), prints a per-table `in dump` / `restored` table, and drops the scratch database. It works on a dump of any age; the live database is never touched.
   - **PASS means:** the dump is a valid gzip, restores with no SQL error, and every table in it (including `drizzle.__drizzle_migrations`) came back with exactly the rows the dump contains and no table is missing.
   - **FAIL means:** a bad gzip, a SQL/COPY error (truncated or damaged dump), or a missing/mismatching table — the table is named in the output.
   - **PASS does not mean:** that the dump is complete relative to the live database (rows deleted from the file consistently are invisible to it), or that the dump is recent — check the timestamp in the file name against the nightly schedule.
3. Real recovery: stop the app (`sudo systemctl stop complystart`), create an empty database, `gunzip -c complystart-<stamp>.sql.gz | psql <new database url>`, point `DATABASE_URL` at it, start the app. A dump holds everything up to its timestamp; anything written since is lost.
4. **The data directories:** `tar -xzf complystart-data-<same stamp>.tar.gz -C /opt/compinabox/data` restores `evidence/` and `uploads/` (stop the app first; run as the `complystart` user or fix the owner afterwards: `chown -R complystart:complystart /opt/compinabox/data`). Use the data archive that has the **same timestamp** as the dump, so database rows and files match. The evidence is useless without `REPORT_ENCRYPTION_KEYS`, which is deliberately not in any backup (see "Report encryption key").

To exercise the scripts without a server: `BACKUP_DEST=local:/some/dir scripts/backup.sh` (tests: `tests/ops-scripts.test.ts`).

## Whistleblower channel (phase 5)

Public intake at `/report/<company slug>` (pages `/report/<slug>` and `/report/<slug>/status`; handlers `POST /api/report/<slug>` and `/api/report/<slug>/status`). Reviewed by the company admin under Dashboard → Canal de denúncias. Decisions and guardrails: `CLAUDE.md` §8, `SPEC.md` §5.3 and §11.

### What the intake does and does not log

- The intake handlers and pages read **only** the submitted form (or JSON body) and the slug in the URL. They do not read or store the visitor's IP address, `X-Forwarded-For`, `CF-Connecting-IP`, the browser identifier, the referrer, language headers or cookies, and they set **no cookie**. `is_anonymous = !wants_contact`; the contact is stored (encrypted) only if the reporter opts in. The `whistleblower_reports` table has no IP/user-agent column.
- `scripts/check-anonymity.sh` (run by `./verify.sh`) fails the build if anything under `app/report`, `app/api/report` or `lib/whistleblower` mentions request headers, forwarded/client addresses, the browser identifier, cookies or `console.*`. Error paths log nothing there; the notification email (outside that tree) logs one fixed string on failure.
- `created_at` is a full timestamp (it is audit evidence). Evidence images are stripped of EXIF/XMP/ICC/text metadata before they are encrypted.
- **Outside the app's control:** Caddy, Cloudflare, the OS and Next.js itself can still log request metadata (access logs, platform telemetry). On staging, `ops/Caddyfile` does not access-log `/report/*` or `/api/report/*` at all, and its error log drops URLs and client addresses (proof: `scripts/check-caddy-logs.sh`); Cloudflare, once it is in front, still sees addresses (Phase 9d). Do not describe the channel to reporters as untraceable.
- Rate limiting is in-process and per company slug (status lookups 10/minute, submissions 20/hour; HTTP 429) because no client address is read. A per-IP limit is a Cloudflare rule (Phase 9d). The 12-character tracking code (~59 bits) is what prevents enumeration.

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

**Deploy note.** `cf-connecting-ip` is only trustworthy if the origin accepts traffic from Cloudflare alone (firewall / Caddy allow-list of Cloudflare ranges) — carried to Phase 9d; on staging there is no Cloudflare, the header is whatever the client sends, and the acknowledgment IP is therefore not evidence there.

The training module (pt-BR only; other languages show "not yet available" and are left out of completion) is a **draft**: see `lib/training/REVIEW.md`.

## Vendors: questionnaire and sanctions screening (phase 7)

### Questionnaire links and what is logged

An admin adds a vendor under `/dashboard/vendors` (name required; country, tax id and contact optional) and sends the questionnaire to the contact's email. The link `/vendor/<token>` is a random 32-byte secret; only its sha256 is stored (`vendors.invite_token_hash`). It lasts 30 days, a resend issues a new link and kills the old one, and the mail is sent **before** anything is stored, so a failed send changes nothing. Opening the link (GET) consumes nothing; submitting consumes it and stores the answers in one transaction, so two concurrent submits produce exactly one response. Unknown, used, expired, replaced and archived links all show the same friendly page. There are no vendor accounts or sessions.

The free-text answers (respondent name and role, ownership, PEP and sanctions details) are encrypted with the `REPORT_ENCRYPTION_KEYS` ring (see "Report encryption key"; rotation covers `vendor_responses`). `vendor_responses` and `vendor_screenings` are append-only at the database level: a resubmission after a resend is a new row, the newest is the current answer.

**What is logged: nothing identifying.** The public vendor paths (`app/vendor`, `components/vendor`, `lib/vendors/submit.ts`, `lib/vendors/answers.ts`) read no header, no client address, no user agent, no cookie, and write no log line; `scripts/check-vendor-privacy.sh` (run by `verify.sh`) fails on any of that. Ops: `ops/Caddyfile` logs `/vendor/*` and `/employee/*` as `/vendor/[redacted]` / `/employee/[redacted]` (the token is in the URL path).

### Sanctions screening: what is sent, what is stored

Screening is an explicit admin click per vendor (`POST /dashboard/vendors/<id>/screen`). There is no bulk, scheduled or automatic screening: each run may cost money. Guards, all in `lib/screening/constants.ts`: a 5-minute cooldown per vendor and 50 screenings per company per UTC day (errors count — they may be billed).

- **Sent to the provider:** the vendor **name** and, if given, the **2-letter country code**. Nothing else — no company id, tax id, email or questionnaire answer. A test asserts the exact request body. The provider (OpenSanctions by default) therefore learns which names a customer checks: name it as a sub-processor in the privacy policy.
- **Stored:** per run, the provider and dataset, the name that was screened, the status (`no_match` / `possible_match` / `error`), and at most 10 matches reduced to `{id, caption, score, datasets, topics}`. Never the request or response body, headers, URL or API key. An error stores only a fixed short code (`timeout`, `auth`, `rate_limited`, `upstream`, `bad_response`, `not_configured`) and is shown as "screening failed", never as "no match".
- **Configuration:** `SCREENING_API_KEY` (unset or `changeme` = screening is visibly *unavailable*; the questionnaire still works; there is no fake provider in production code), `SCREENING_BASE_URL` (default `https://api.opensanctions.org`; must be `https`, except localhost for tests — otherwise the provider refuses to run so the key cannot leak over plain http), `SCREENING_DATASET` (default `default`). The key is read in exactly one file, `lib/screening/index.ts`.
- **Copy:** a screening tool against public lists, never an approval: "no results in the lists screened on <date>" / "possible match — review needed", always with the lists-and-date caveat. A result is never described as clear, approved or safe.
- **Live check:** `scripts/screening-live-check.sh` makes one real call through the production client for a clearly sanctioned name (needs `SCREENING_API_KEY` and network access to the provider). Mapping of the provider's response is marked `ASSUMED SHAPE` in `lib/screening/opensanctions.ts` until that check has run.

## Dossier (binder) — phase 8

`/dashboard/binder` generates one PDF (the "dossiê") of what the platform recorded for the company as of a date: cover, contents with bookmarks and real page numbers, legal context, the six documents, training report, acknowledgment roster, disclosure status, whistleblower-channel description, vendor-screening summary and a data-notes appendix. It is a compilation, never a statement that the company is compliant; the fixed texts are listed for the lawyer in `lib/binder/REVIEW.md`.

- **Left out on purpose:** employee e-mail and IP addresses, disclosure contents, whistleblower report content/evidence/tracking codes, vendor questionnaire answers. Enforced by `tests/binder-pdf.test.tsx` (a marker planted in every excluded field must not appear) and `scripts/check-binder-privacy.sh` (run by `verify.sh`).
- **Generation is asynchronous and in-process** (no queue service): a click inserts a `binders` row (one queued/running job per company), the work runs in the same Node process behind a semaphore (`BINDER_CONCURRENCY`, default 1, from the environment), the page polls `/dashboard/binder/status`. All numbers (size cap 25 MB, cooldown 30 s, 20 per UTC day, 10-minute stuck timeout) are in `lib/binder/constants.ts`. A job whose process died is marked `failed: interrupted` by the next page load, poll or click; the customer retries.
- **Snapshot:** all data is read in one `REPEATABLE READ` read-only transaction at the start of the job and rendered from memory.
- **Ready binders are immutable and never deleted** (trigger in migration 0007). The PDF bytes live in Postgres (`binders.pdf`), so the nightly dump grows by one file per generation: check the dump size at the monthly restore test. The SHA-256 shown on the dashboard is the hash of those bytes.
- **Cost of a render:** a typical company (tens of employees) takes a few seconds; the largest case tested (500 employees, 50 vendors, 67 pages) took about 20 s and grew the process by about 550 MB at Node's default heap settings (about 300 MB when V8 was capped at 450 MB, so most of that is collectable garbage). On a small server keep `BINDER_CONCURRENCY=1` (the default; the staging `.env` sets it) — the systemd unit also caps the Node heap with `--max-old-space-size` sized from the server's RAM by the bootstrap script. Measured by `tests/binder-large.test.tsx`.
