# Supervisor notes — worker task: Phase 9 (staging deploy on the dev server, safeguards, legal drafts, tracking)

Overwrite each time — a relay, not a log. Only one relay at a time. Read this at the start of your
session before anything else.

---

## If this is a WORKER task

### Context
Phases 0-8 are merged. Esteban's decision (2026-10-25): the first deployment goes to his
DigitalOcean **dev server `138.197.70.66`, folder `/opt/compinabox`**, **without Cloudflare**, with a
**dummy e-mail**, **legal pages drafted by us**, legal review **later**. So this phase builds a
**staging** environment: the real pipeline and server layout, test data only, loud guards so it can
never be confused with production. Production go-live (domain, Cloudflare, real e-mail, real payments,
reviewed legal text) is **Phase 9d** and still blocks the Brazil launch — do not build it, but do not
build anything that makes it harder.

**You cannot reach the server** (your sandbox blocks it and you have no keys). You write the scripts,
the workflow, the docs and tests, and you rehearse the release/rollback logic locally. **The phase is
accepted only after Esteban runs the one-time setup and a real `deploy.yml` run is green** — so the
README for him must be exact, copy-paste, written for a non-engineer.

Read first: `CLAUDE.md` (§0, §4, §8, §9 — the 2026-10-25 decisions on environments and legal drafts —
§11), the **Phase 9** section of `IMPLEMENTATION_PLAN.md` (rewritten; it is the checklist) and 9d (what
is *not* yours), `SPEC.md` §9, §10, §11, `KNOWN_ISSUES.md`, the existing `ops/backup/*`,
`scripts/backup.sh`, `scripts/restore-test.sh`, `scripts/smoke.sh`, `.github/workflows/ci.yml`,
`README.md`, `app/(visitor)/legal/[doc]/page.tsx`, `lib/payments/index.ts`, `lib/email/index.ts`,
`app/robots.ts`, `next.config.ts`. Branch `phase-9-staging` from current `main`; PR to `main`; don't
merge; don't push to `main`.

**Out of scope — log under "Not done":** the blog (Phase 9c, a parallel task), Mercado Pago (9b),
anything in 9d, a real Resend integration test, Cloudflare, a domain/certificate, SSH hardening beyond
what the bootstrap needs, monitoring/alerting, log shipping.

### UPDATE 2026-10-25 (supervisor) — facts about the real server; these OVERRIDE the bootstrap/Caddy/port bullets below
Esteban ran three commands on `138.197.70.66`. What they show:
- **Ubuntu 25.04** ("plucky"): an interim release that, as far as we know, is past its end of life. **RAM 1967 MB** (about a 2 GB droplet) with 2 GB swap, ~1.3 GB available.
- **The server is not clean.** Listening already: **80** (IPv4+IPv6), **443** (IPv4), **3000**, **8080**, **5432 on all interfaces** (an existing PostgreSQL), 22, and two localhost high ports. We do not yet know what owns them (he ran `ss` without `sudo`). Another web server owns 80/443; something owns **3000** (our default dev port) and 8080.
- Esteban has not decided between (A) a **fresh dedicated 24.04 LTS droplet** (cleanest, my recommendation) and (B) this server alongside whatever runs there. **Build for both.** Assume nothing about the machine.

Therefore, in `ops/bootstrap-server.sh` and everything that depends on it:
1. **Supported OS: Ubuntu 22.04 and 24.04 only.** Any other release (including 25.04) → abort with a plain explanation ("this release is past end of life; rebuild on 24.04 LTS"), changing nothing. Do **not** add 25.04 support.
2. **`--check` mode (dry run) first.** It prints a "what I found" report and changes nothing: OS, RAM/swap, free disk, **every listener with its owning process** (it runs as root so `ss -ltnp` shows owners), installed Node/Caddy/nginx/apache/Postgres versions and whether their services are active, `ufw` state, existing users/dirs. A normal run prints the same report, then requires `--yes` before changing anything. Esteban will run `--check` and send me the output **before** we decide A vs B.
3. **Ports are parameters, never assumptions:** `--https-port` (default 443), `--http-port` (default 80; may be turned off with `--no-http`), `--app-port` (default: first free port ≥ 3100, bound to `127.0.0.1` via `HOSTNAME`; **never 3000 or 8080**). If a chosen public port is held by anything that is not our own Caddy, abort naming the owner and print the exact rerun with another port. Never stop, kill, reload or edit another service or another site's configuration. `APP_URL`/`AUTH_URL` in `.env` include a non-default port; **the deploy workflow gets a `DEPLOY_BASE_URL` secret** (e.g. `https://138.197.70.66` or `https://138.197.70.66:8443`) used by the remote smoke and by `.env`; `DEPLOY_HOST` is SSH only. Remote smoke and `deploy-remote.sh` health checks use the app port locally and the base URL remotely.
4. **Existing PostgreSQL:** if something already listens on 5432 or `psql`/a cluster exists → abort by default ("found an existing PostgreSQL"). With `--use-existing-postgres` create **only our own role and database** in that cluster (random password in `.env`), touch nothing else, and require major version ≥ 15 (our tests run on 16; record the version found). Otherwise install PostgreSQL 16 bound to localhost. Never change `listen_addresses` or `pg_hba.conf` of a cluster that is not ours.
5. **Firewall:** allow 22 first; allow only the ports chosen. If `ufw` is inactive on a server that runs other services, **do not enable it** (print a warning instead); if it is active, add our rules only. Never lock out SSH.
6. **Memory:** the box is about 2 GB shared with whatever else runs. `NODE_OPTIONS=--max-old-space-size` = 40% of total RAM bounded 384..1536 MB (≈ 786 on this server); `BINDER_CONCURRENCY=1`; print a warning if less than 2 GB.
7. The rehearsal and README must cover the non-default-port and existing-Postgres paths (at least by tests of the argument handling and generated files; you cannot run them on the server).
8. README "Staging server setup" starts with: copy the script, run `sudo ./bootstrap-server.sh --check`, **send the output to the supervisor**, then continue only after the decision. Put the A-vs-B explanation in plain language (fresh 24.04 droplet vs alongside existing services, what each risks), and add one line telling him that PostgreSQL listening on all interfaces (`0.0.0.0:5432`) is exposed unless a firewall (ufw or the DigitalOcean cloud firewall) blocks it — worth checking whatever he chooses.

### Guardrails for this phase (a violation means stop and write "blocked")
- **No secret in the repo, the workflow files, the logs or the PR.** The workflow reads secrets only
  from `secrets.*`; the bootstrap generates server secrets on the server; nothing prints a secret
  except the one-time outbox password to the operator's terminal.
- **Host keys are pinned** (`DEPLOY_KNOWN_HOSTS`); never `StrictHostKeyChecking=no`, never
  `ssh-keyscan` inside the workflow. The deploy user can do nothing but deploy (no shell as root; a
  narrowly scoped sudoers entry for exactly `systemctl restart/is-active complystart` is fine).
- **Production must refuse the staging conveniences** (the `APP_ENV` guard below) — tested.
- **No real data on staging**: the banner says so on every page type; nothing in the scripts migrates or
  imports real data.
- **Legal drafts:** no citation beyond the statute *name* "LGPD" (SPEC §11 already names it); no article
  numbers, decrees or other laws; no sentence that says or implies compliance, adequacy or
  certification; no invented company facts (see placeholders).
- Migrations on the live (staging) database are automatic **only because it holds test data**; the
  workflow input that enables that is off for any environment other than `staging`.

### Decisions already made (record deviations as judgment calls)

**Environments and guards**
- `APP_ENV` ∈ `development` (default when unset) | `staging` | `production`. One pure, unit-tested
  function `checkEnvironment(env)` returns the list of violations and is used by (1) `instrumentation.ts`
  `register()` (log loudly at startup; in `production` throw so the service does not come up), (2)
  `/api/health` (`ok:false` + HTTP 503 and the violation *codes*, never values), (3) the deploy
  health check, so a bad production `.env` fails the deploy and rolls back.
- `production` violations (each a code): `ALLOW_FAKE_PAYMENTS` set, `PAYMENT_PROVIDER=fake`,
  `EMAIL_DEV_SINK=true`, any of `AUTH_SECRET`/`REPORT_ENCRYPTION_KEYS`/`APP_URL`/`AUTH_URL`/`DATABASE_URL`
  missing or `changeme`, `APP_URL`/`AUTH_URL` not https, `PAYMENT_PROVIDER=none` is *allowed* (checkout
  unavailable), placeholder pricing is refused by the existing attempt guard.
- `staging`: banner "Ambiente de teste — dados fictícios" (all four locales, all page types:
  marketing, dashboard, onboarding, employee, vendor, report, legal, checkout) — implement it once at
  the root-layout level of each route group and assert it per group; `robots.txt` = `Disallow: /`,
  `X-Robots-Tag: noindex, nofollow` on every response (via `next.config` headers or the proxy),
  sitemap empty; no GTM; the banner never appears in `production`/`development`.
- Port: the app reads `PORT` (already true); nothing hardcodes 3000 except dev defaults.

**Health and outbox**
- `GET /api/health` → `{ok, version, db, env}` (`version` from `APP_VERSION`, set by the deploy; `db` from
  `select 1` with a 2 s timeout; `env` = the `APP_ENV` string). No auth, `no-store`, nothing else.
- **`/dev-outbox`** only when `APP_ENV=staging` **and** `EMAIL_DEV_SINK=true` **and**
  `DEV_OUTBOX_PASSWORD` is set; else 404 (test every combination). HTTP Basic auth (constant-time
  compare), lists the newest ~50 messages from the sink directory (to, subject, time, the links as
  clickable anchors, plain text); never lists anything outside the sink dir; `no-store`, `noindex`;
  rate limit failed auth in-process. Escape everything it prints.

**Server layout (all under `/opt/compinabox`)**
```
.env                     # 600, owner complystart; generated by bootstrap; never in git
releases/<git-sha>/      # one dir per release; keep the last 3
current -> releases/<sha>
data/uploads  data/evidence   # outside releases; owner complystart; not served by Caddy
backups/                 # local dumps on staging
```
- `complystart` runs the app (no login shell); `complystart-deploy` receives releases over SSH.
- Postgres 16 on localhost only; database + role created by bootstrap; `DATABASE_URL` written to `.env`.
- Caddy on 80/443 → `127.0.0.1:<PORT>`; Node 22 (NodeSource or equivalent, pinned major); `ufw` allows
  22/80/443 only. Ubuntu 22.04 or 24.04 only: anything else, or ports 80/443 already in use by
  something that is not our Caddy, **aborts with an explanation and changes nothing**. Idempotent: a
  second run changes nothing and says so. Print RAM found; if under 2 GB, warn that binder generation
  is limited.
- `NODE_OPTIONS=--max-old-space-size=<~60% of RAM in MB, bounded 384..2048>` in the unit;
  `BINDER_CONCURRENCY` read from env (default **1**) in `lib/binder/constants.ts` (phase 8 left it a
  constant of 2).

**Deploy pipeline**
- `deploy.yml`: triggers `push` to `main` and `workflow_dispatch`; `concurrency: deploy-staging`
  (no cancel in progress); job 1 builds once (`npm ci`, `npm run build`, package the standalone output +
  `.next/static` + `public` + migrations + the scripts the server needs into one tarball with a
  manifest and SHA-256); job 2 uploads it with `scp`/`rsync` over SSH as `complystart-deploy` and runs
  `ops/deploy-remote.sh <sha>`; job 3 runs `scripts/remote-smoke.sh https://$DEPLOY_HOST` from the
  runner (accept the self-signed certificate with `curl -k` **only in this job and only for this host**;
  say so in a comment). The verify/test gate is the PR's CI — do not duplicate it; do refuse to deploy a
  `main` commit whose CI check is not green if that is cheap to check, else note it as a judgment call.
- `ops/deploy-remote.sh`: extract to `releases/<sha>`; link `.env`/data dirs; install runtime deps if the
  standalone trace does not carry them (decide how migrations run in production: prefer a small
  `scripts/migrate.mjs` using `drizzle-orm`'s runtime migrator over shipping `drizzle-kit`); run
  migrations (staging: yes; guard with `MIGRATE=auto|manual` read from the workflow, default manual);
  switch `current`; `systemctl restart complystart`; poll `/api/health` until `version == <sha>` and
  `ok` (timeout ~60 s); otherwise point `current` back at the previous release, restart, exit nonzero.
  Migrations are forward-only; say in the README what a rollback does and does not undo. Prune old
  releases only after a healthy deploy.
- **Local rehearsal (required evidence):** against a temp tree that mimics `/opt/compinabox`, with a
  stubbed `systemctl`, a real Postgres and a real `node` process: deploy A; deploy B; deploy C whose
  health never turns green → automatic rollback to B; show the `current` symlink and `/api/health`
  version after each step. Then run `scripts/remote-smoke.sh` against it (use `http://` and the staging
  env locally).

**Remote smoke** (`scripts/remote-smoke.sh <base-url>`; curl + cookie jars only, no DB access):
health (version, env=staging); `/br` 200, banner present, `X-Robots-Tag` present; `robots.txt`
disallow; security headers on `/dashboard/*`; geo with a *simulated* `CF-IPCountry` (there is no
Cloudflare: the header is client-controlled — say so in the script header); the fake journey end to end
(checkout → simulator pay → onboarding → documents → PDF `%PDF` → generate binder, poll, download →
sign-out → replay of the old cookie refused); `/dev-outbox` 401 without the password and 200 with it
(password passed as an argument/env from a secret in CI, never echoed); read a sign-in link from the
outbox and use it once, second use refused. Reuse helpers from `scripts/smoke.sh` where sensible; do not
make smoke.sh itself remote.

**Caddy (`ops/Caddyfile`)**
- `tls internal` for the IP site (self-signed; browsers warn once). README shows the exact change to a
  real certificate once there is a domain (a two-line diff), and says why the warning is expected.
- Access log: JSON, **query strings removed**, and the **paths** of `/employee/*`, `/vendor/*`,
  `/report/*` and `/api/welcome` replaced by their prefix + `[redacted]`; **no client IP** for
  `/report/*` and `/api/report/*` (or no access log for them at all — pick one and say why). Request body
  cap on `/api/report/*` (a few MB above the evidence limit). Evidence/upload dirs never served.
- **Evidence:** run Caddy locally (or in the rehearsal) and request those paths with fake tokens;
  paste the resulting log lines showing the redaction. If Caddy cannot run in your sandbox, validate the
  config with `caddy validate`/`caddy adapt` if available and say plainly that the redaction is
  unproven until the first real request on the server; Esteban's README step then includes a `grep`
  that checks it.

**Backups on staging**: `scripts/backup.sh` also archives `data/evidence` and `data/uploads` (tar.gz,
same timestamp, same destination, same retention); `restore-test.sh` unchanged for the DB; document in
the README how to restore the data dirs. The timer uses `BACKUP_DEST=local:/opt/compinabox/backups`.
Do not weaken the existing script tests; extend them for the tar part.

**Maintenance** (`scripts/maintenance.mjs` or equivalent runtime script + timer, daily): delete
`employee_sessions` past their expiry and expired `verification_tokens`; print counts only; test on a
real Postgres with fixtures (expired removed, valid kept, other tables untouched).

**Legal drafts** (pt-BR; `/legal/privacy`, `/legal/terms`; keep `/legal/disclaimer`; keep the DRAFT
banner and `noindex`):
- Source of truth for facts: the code, `README.md` (anonymity/logging, backups), `CLAUDE.md`, the
  schema. State only what the product does. Cover: who we are (**placeholders** for legal name, CNPJ,
  address, privacy contact/encarregado, support e-mail, shown as visible bracketed text and listed in
  `lib/legal/REVIEW.md`); data we hold (account/company, billing metadata — card data is handled by the
  payment processor and never touches us —, employee roster names/e-mails and acceptance records with IP,
  training results, disclosures, whistleblower reports/contacts/evidence encrypted, vendor data, cookies:
  `country`, `lang`, `consent`, `utm` only after consent, session cookies, employee/vendor session
  cookies); purposes; recipients and sub-processors (hosting provider, e-mail provider, payment
  processor, the screening provider that receives vendor names and optional country, the CDN/proxy once
  used — worded so it is true both with and without it); consent-gated analytics; whistleblower channel
  facts exactly as the Phase 5 README states them (no IP/browser stored with the report; infrastructure
  may keep technical logs); international transfers (flag, don't assert legal mechanisms); retention
  **as it is today** ("não há exclusão automática; os prazos serão definidos" — flagged); data-subject
  rights in plain language without article numbers; how to ask (placeholder contact); changes.
  Terms: what the service is and is not (documents are templates, not legal advice, no guarantee, no
  certification; the customer remains responsible), accounts and the single admin, acceptable use,
  prices/payment/cancellation/refund (**placeholders**: pricing and billing terms are open inputs),
  the platform's limits (no uptime promise is invented), liability and governing law/forum
  (**placeholders for the lawyer**), changes to terms. Plain Portuguese, short paragraphs.
- `lib/legal/REVIEW.md`: every assumption (controller vs processor roles for each data category, legal
  bases, transfers, retention, minors, anything you were unsure of) and every placeholder, status DRAFT.
- **Terms acceptance:** required checkbox on `/checkout` linking both documents (UI string in all four
  locales + DRAFTS rows); store `terms_accepted_at` and `terms_version` (a constant bumped when the text
  changes) on `checkout_attempt` (migration, nullable for old rows); the attempt is refused without it.
  Link privacy/terms from the footer where they are not already.
- Strings: messages for the page chrome in all four locales; the body text pt-BR only (the one market).
  The forbidden-claims scan must cover `lib/legal`/the page strings.

**Tracking**: a client component that loads GTM **only** when `GTM_ID` is a real id, consent is
`accepted`, `APP_ENV` is not `staging`, and the path is not `/report/*`, `/dashboard/*`, `/employee/*`,
`/vendor/*`, `/login`, `/onboarding`, `/dev-outbox`; consent withdrawal stops further pushes. Events via
`dataLayer`: `view_pricing` (pricing page), `begin_checkout` (checkout form submit), `purchase` (return page
once paid; `value` = attempt amount, `currency`; **no email, name, tax id, attempt/company id**),
`lead_generic_country_waitlist` (successful waitlist post). Tests with a stub id: no script tag and no
dataLayer push before consent; after consent the script and events appear; never on excluded paths; the
`purchase` payload contains only the allowed keys.

**Order of work (commit in this order; each commit must pass lint/typecheck/tests):**
1. Dependency and advisory sweep (the Next advisory + `npm audit` highs) — alone, so it can be reverted.
2. `APP_ENV` guard, banner, noindex, `/api/health`, `BINDER_CONCURRENCY` from env.
3. `/dev-outbox`.
4. Legal drafts + terms acceptance migration.
5. Tracking.
6. Maintenance script; backup extension.
7. Ops: bootstrap, Caddyfile, units/timers, `deploy-remote.sh`, `migrate.mjs`.
8. `deploy.yml`, `remote-smoke.sh`, local rehearsal, README "Staging server setup".

### `verify.sh` / CI — permitted edits, only these
1. The forbidden-claims scan also covers `lib/legal` (and the legal page strings).
2. A new invariant `ops hygiene`: `bash -n` on every `ops/*.sh` and `scripts/*.sh`, `shellcheck` on them if
   installed (report "not installed" rather than failing), and a grep failing on `StrictHostKeyChecking=no`,
   `ssh-keyscan`, a literal private-key header, or `changeme` values outside `*.example`/tests in `ops/` and
   `.github/`. Show it failing on a planted violation, then passing.
3. `ci.yml` unchanged except if the sweep needs it. `deploy.yml` is new and only runs on `main`.
Show every diff in HANDOFF.md.

### Definition of done
As in the Phase 9 section of `IMPLEMENTATION_PLAN.md`. Evidence I will look for: the guard unit tests (all
production violations, staging banner/noindex present in every route group, development unaffected); health
endpoint behaviour; the outbox 404 matrix and the Basic-auth tests; the rehearsal transcript (deploy A, B,
rollback on C) with symlink/health after each step; remote-smoke output against the rehearsal; Caddy
redaction proof or the honest "unproven until the server" statement; bootstrap idempotence argued from the
script and, if you can run it in a container, shown; tracking tests; legal pages rendered (screenshots under
`docs/phase9-samples/`: privacy, terms, checkout with the acceptance box, the staging banner on a marketing
page and on a dashboard page, the outbox viewer) which **you view yourself**; the migration (terms fields);
a grep proving no secret literals in `ops/`, `.github/`, `scripts/`; no new dependency except what the sweep
requires (justify each).

### Report back
`HANDOFF.md` per the template. Verification depth must say plainly: **nothing in this phase was run on
`138.197.70.66`**; what was rehearsed locally and how it differs from the real server. Include a
**"For Esteban"** section: the exact setup steps in order (what to copy to the server, what to run, how to
make the deploy key and where each of the four GitHub secrets goes, how to trigger the first deploy, how to
open the site and the outbox, how to roll back by hand, what to send me afterwards: the Actions run URL),
plus a **"For the lawyer"** section pointing at `lib/legal/REVIEW.md` and listing the statements you were
least sure of. List every judgment call and open question.

---

## If this is a VERIFICATION request

Not applicable for this relay.
