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
