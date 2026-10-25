# Handoff — Phase 9: staging deploy, environment safeguards, legal drafts, tracking — 2026-10-25

Branch `phase-9-staging` (from `origin/main`, with the supervisor update merged), **PR #12** to `main`, **not merged**. Code tip for the evidence: see "CI / verify" at the end — `./verify.sh` ran on exactly that commit; later commits touch only this file.
Guardrails (CLAUDE.md §8): **nothing blocked.** No secret in the repo (verify's scan + `ops hygiene` pass); host keys pinned, no `ssh-keyscan`/weakened host-key checking anywhere in `ops/` or `.github/`; production refuses the staging conveniences (tested); legal drafts name only "LGPD".

## Supervisor update merged (real server facts) — what changed after the first report

The supervisor's "UPDATE 2026-10-25" in `SUPERVISOR_NOTES.md` (Ubuntu 25.04, ~2 GB RAM, ports 80/443/3000/8080 and a PostgreSQL on 5432 already in use) arrived by message; I verified it against the file on `origin/main`, merged it, and reworked `ops/bootstrap-server.sh` and what depends on it:
1. Only Ubuntu 22.04/24.04; anything else (25.04 included) aborts with the end-of-life explanation, nothing changed.
2. `--check` prints a "What I found" report (OS, RAM/swap, disk, **every listener with its owning process**, node/caddy/nginx/apache/psql versions and service states, PostgreSQL clusters, ufw, existing users/dirs) and a verdict, changes nothing. A run **without `--yes`** prints the same report and stops (exit 3); `--yes` is required to change anything.
3. Ports are parameters: `--https-port` (443), `--http-port` (80) / `--no-http`, `--app-port` (first free ≥ 3100, never 3000/8080, never a port in use). A public port held by anything but our Caddy aborts naming the owner and printing the exact rerun with another port. Chosen ports are remembered in `.compinabox-bootstrap`; a re-run without flags reuses them. Caddyfile global `https_port`/`http_port`/`auto_https disable_redirects`, `.env` `APP_URL`/`AUTH_URL` with the port, `/opt/compinabox/app-port` (read by `deploy-remote.sh` for its health check, because the deploy user cannot read `.env`), ufw rules for our ports only. New GitHub secret **`DEPLOY_BASE_URL`** (used by the smoke job; `DEPLOY_HOST` is SSH only) — so there are now **six** secrets.
4. Existing PostgreSQL (listener on 5432, a cluster, or a `postgresql-NN` package) → abort by default; `--use-existing-postgres` creates **only** our role and database (version ≥ 15 checked; login over 127.0.0.1 verified; no config touched; mode remembered). Otherwise PostgreSQL 16 on localhost as before.
5. Firewall: ufw active → only our rules added; inactive while other services listen → **not enabled**, warning printed; inactive on an otherwise empty server → enabled with SSH first. A public `0.0.0.0:5432` produces a warning in the report.
6. Heap = 40% of RAM bounded 384..1536 (~786 MB on this server); `BINDER_CONCURRENCY=1`.
7. Also: Caddy is installed under a `policy-rc.d` block so the package does not start it on port 80 with its stock page; an existing Caddy configuration that is not ours (or the stock one) is never replaced.
8. README "Staging server setup" now starts with step 0: A (fresh 24.04 droplet, recommended) vs B (alongside existing services) in plain language, the `0.0.0.0:5432` warning, and "run `--check` and send the output to the supervisor before anything else".
Tests for all of this: `tests/ops-bootstrap.test.ts` is now **30 tests** (argument handling, generated files for non-default ports, existing-PostgreSQL paths, ufw cases, 25.04, Caddy conflicts, idempotent re-run with remembered flags). Not covered, and not coverable here: any of it on the real machine.

## Verification depth — read this first

**Nothing in this phase was run on `138.197.70.66`.** I have no access to it. The phase is accepted only after Esteban does the setup below and a real `deploy.yml` run is green.

What *was* run, and how it differs from the real server:

| Piece | Run for real here | What the real server will add |
| :- | :- | :- |
| `ops/deploy-remote.sh`, `ops/complystart-migrate`, `scripts/package-release.sh`, `migrate.mjs`, `remote-smoke.sh` | **Yes**, against a temp tree, a real Postgres and a real `node server.js` (`scripts/rehearse-deploy.sh`, transcript below) | Separate users and file permissions (the rehearsal runs as one user, `COMPLYSTART_RUN_AS_SELF=1`), systemd (a stub restarts the process), sudo, the SSH hop, https |
| `ops/Caddyfile` | **Yes**, real Caddy 2.8.4 (binary downloaded, SHA-512 checked against the release checksums), stub app, `localhost` site | `tls internal` for a bare **IP** address, port 80/443, journald; the `grep` check in the README is the first-request proof |
| `ops/bootstrap-server.sh` | Preflight and idempotence against a **fake server** (shims for apt/systemd/ufw/useradd/PostgreSQL, `BOOTSTRAP_ROOT` prefix): 14 tests | The real apt repositories (NodeSource, PGDG on 22.04, Caddy), real systemd, real ufw. **Never run for real.** |
| `.github/workflows/deploy.yml` | YAML parsed only | Everything: the CI-status gate (`gh api` calls), artifact hand-off, SSH step, smoke step |
| Backups, maintenance | **Yes**, scripts on a real Postgres (tests + the rehearsal) | timers under systemd |

## Evidence

### 1. `./verify.sh` (HEAD 76b01b2), unedited extract
```
--- commit state
current HEAD               76b01b2  (2026-10-25T17:25:02+00:00)
branch                     phase-9-staging
uncommitted changes        0 file(s)
--- secrets
secrets                    none found
counts                     total=818 pass=818 fail=0 skip=0        (was 666 at phase 8; +152)
build                      ok
smoke: PASS (port 32997)
migration drift            schema changed, migration present
forbidden claims           none
ops hygiene                scripts parse; no weakened host-key checking, key or placeholder in ops/ .github/
KNOWN_ISSUES.md            present
verify.sh: PASS (HEAD 76b01b2)
```
(`shellcheck` was on PATH for my run of the hygiene check — a 0.10.0 binary fetched from GitHub, not committed; where it is missing the check prints "not installed".)

### 2. Local rehearsal: deploy A, deploy B, automatic rollback of C (full transcript: `docs/phase9-samples/rehearsal-transcript.txt`)
Real `ops/deploy-remote.sh` against a temp `/opt/compinabox` look-alike, real Postgres, real node processes; only `systemctl` is a stub. Extract:
```
======== 1. DEPLOY A (first release, migrations from scratch) ========
[deploy aaaaaaa] archive verified
[deploy aaaaaaa] extracted to releases/aaaaaaa…
[deploy aaaaaaa] running migrations (MIGRATE=auto)
migrate ok: 9 in journal, 9 applied now
[deploy aaaaaaa] current -> releases/aaaaaaa…; restarting
[deploy aaaaaaa] new release is healthy (version aaaaaaa) after 1s
--- state: current -> releases/aaaaaaa…
--- /api/health: {"ok":true,"version":"aaaaaaa…","db":true,"env":"staging"}
======== 2. DEPLOY B ========   (… healthy; current -> releases/bbbbbbb…; health version bbbbbbb…)
======== 3. DEPLOY C (APP_ENV=production forced onto the staging .env) ========
[deploy ccccccc] current -> releases/ccccccc…; restarting
deploy: release ccccccc… did not become healthy within 25s
[deploy ccccccc] ROLLING BACK to bbbbbbb… (code only: migrations already applied stay applied)
[deploy ccccccc] previous release is healthy (version bbbbbbb) after 1s
deploy: ROLLED BACK to bbbbbbb…; the failed release is kept as releases/ccccccc….failed for inspection
deploy exit code: 1  (expected 1)
--- state: current -> releases/bbbbbbb…
--- /api/health: {"ok":true,"version":"bbbbbbb…","db":true,"env":"staging"}
--- why C never turned healthy:  ENVIRONMENT GUARD (APP_ENV=production): allow_fake_payments_set, payment_provider_fake, email_dev_sink_set, app_url_not_https, auth_url_not_https — refusing to start
======== 4. DEPLOY D (broken migration) ========
migrate failed (error): Failed query: this is not sql;
deploy: migrations failed; nothing was switched, the running release is untouched   (current stays B, health still B)
======== 4b. DEPLOY E (healthy) ========  failed C and D directories removed, oldest kept per "last 3"
======== 5. remote-smoke … remote-smoke: PASS ========    (58 checks, below)
======== 6. maintenance + backup scripts ========  … REHEARSAL PASS
```
C is real code path, not a mock: B's build with one line prepended to `server.js` (`process.env.APP_ENV="production"`); the production guard in `instrumentation.ts` stopped the server, exactly as it will for a bad production `.env`.

### 3. Remote smoke against the rehearsal (`scripts/remote-smoke.sh`, final state E): all green
Health (200, `ok`, `db`, `env=staging`, version = the deployed sha, only keys `db,env,ok,version`); `/br` 200 + banner + `X-Robots-Tag`; `robots.txt` `Disallow: /`; empty sitemap; legal page banner; `/dashboard` redirect + `private, no-store`, `X-Frame-Options`, `frame-ancestors 'none'`, `Referrer-Policy`; simulated `CF-IPCountry` BR→`/br`, AR→`/ar`, none→`/` 200; checkout refused without the terms box (422); attempt created with it; simulator page; pending before pay; Pay → 303; paid and signed in once, second poll not signed in; status carries amount+currency, not the e-mail; onboarding; documents list; document PDF `%PDF`; binder generate → polled to `ready` → download `%PDF` attachment; **sign-out and replay of the pre-sign-out cookie refused (login redirect, PDF 401)**; `/dev-outbox` 401 without password, 401 wrong password, 200 right, noindex; welcome link first use signs in / second refused; Auth.js sign-in link first use / second refused; employee CSV import + invite-pending; employee invitation read from the outbox, GET shows the start page and sets no session, noindex. Output is in the transcript. The geo checks use a **simulated** header (there is no Cloudflare; stated in the script header).

### 4. Guard tests (`tests/env-guard.test.ts`, `tests/health-and-robots.test.ts`, `tests/staging-banner.test.tsx`)
Every production violation code is asserted (fake payments in several spellings, `PAYMENT_PROVIDER=fake`, sink, each of the five required variables missing/blank/`changeme`/embedded `changeme`, non-https `APP_URL`/`AUTH_URL`, unknown `APP_ENV` → `app_env_invalid`); `PAYMENT_PROVIDER=none` allowed; staging/development allow everything; violation lists contain codes only. Health: 200 body is exactly `{ok,version,db,env}`; 503 with db down; 503 + codes for a misconfigured production, value not echoed. Banner: asserted **per root layout** (marketing, visitor, app, employee, vendor, report): shown in staging, absent in production/development/unset; follows the page language in en/es-AR/es-MX/pt-BR. Staging `robots.txt`/sitemap/`X-Robots-Tag` (also on API and report paths); development/production unchanged.

### 5. Outbox (`tests/dev-outbox.test.ts`, 40 tests)
404 matrix: 5 `APP_ENV` values × 3 sink values × password set/unset = 30 cases — only staging + `EMAIL_DEV_SINK=true` + password gives 401/200; every other cell is 404 even with the right credentials. Basic auth: wrong user/password/malformed headers → 401, challenge, no-store, noindex; password containing `:` works; 10 failures → 429 for everything until the window passes. Listing: written by the real `FileSink`, newest first, ≤ 50, subject/body HTML-escaped (a `<script>` and an `<img onerror>` stay text), http(s) links only become anchors; files outside the sink naming pattern, subdirectories, **symlinks to files outside the dir** and malformed JSON are ignored.

### 6. Caddy redaction — **proven on a real Caddy** (`docs/phase9-samples/caddy-redaction-proof.txt`; re-runnable: `scripts/check-caddy-logs.sh`)
Canary secrets in paths, queries, a cookie and `X-Forwarded-For`; the log was then read:
```
ok    canary CANARYEMP… / VEN… / WEL… / REPORTSLUG… / APIREPORT… / QUERY… / COOKIE… / 203.0.113.77  absent from the log
ok    /br is logged with its query removed
ok    /employee/… -> /employee/[redacted]     ok  /vendor/… -> /vendor/[redacted]    ok  /api/welcome -> /api/welcome/[redacted]
ok    no log line mentions /report or /api/report            check-caddy-logs: PASS
body cap on /api/report/*:  1 MB -> HTTP 200, 21 MB -> HTTP 413  (no cap elsewhere)
app down (502): error entries carry uri=[redacted], no headers, no client_ip, on every path
access lines:  log0 /br client_ip=127.0.0.1 | employee/vendor/welcome client_ip=- cookie=- xff=-
```
Decision: the report channel is **not access-logged at all** (`log_skip`), stronger than "log without IP" (time + path alone is still a record of who used the channel). The error log redacts everything. *First version of the Caddyfile leaked the path in error entries* — found by this proof, fixed (dedicated error logger). **Unproven until the server:** `tls internal` for an IP site address and journald output; Esteban's README step runs the same check there.

### 7. Ops hygiene invariant shown failing, then passing (`docs/phase9-samples/ops-hygiene-evidence.txt`)
Planted: `StrictHostKeyChecking=no`, `ssh-keyscan`, a private-key header, `changeme`, a script with a syntax error → `FAIL` ×4 lines, exit 1. Real tree → `ops hygiene: ok`, exit 0.

### 8. Bootstrap (`tests/ops-bootstrap.test.ts`, 30 tests, fake server — see also the supervisor-update section; the numbers below are from the first 14)
Refuses, prints why and changes nothing (tree identical before/after): Ubuntu 20.04, Debian, port 80 held by nginx, 443 by apache, another Node major, another PostgreSQL cluster, a non-empty `/opt/compinabox` it did not create, malformed address, malformed deploy key (`command=` injection attempt). Passes with Caddy already on 80/443. `--check` writes nothing. RAM: prints it, warns under 2 GB, heap = 40% bounded 384..1536 (after the supervisor update). Full run creates the layout, a mode-600 `.env` with distinct random secrets, units, Caddyfile (tokens substituted), sudoers, the migrate wrapper; prints only the outbox password (no other secret); **second run: `no changes: this server was already set up.`, no `CHANGED`, and every file byte-identical including `.env`**; an existing `.env` survives a run that repairs other deleted files. Idempotence argued from the script: each step checks state first (`put_file`/`ensure_dir` compare content, mode and owner; packages via `dpkg -s`; users via `id`; role/db via catalog queries; ufw rules via `ufw status`; units via `is-enabled`). Ownership comparison is skipped under the test hook only.

### 9. Other
- Dependency sweep (first commit, revertible alone): Next **16.4.0 → 16.4.3** (and `eslint-config-next` to match, exact pins) clears the critical advisories (image-optimizer RCE, server-actions DoS, `use cache` RCE); `npm audit fix` cleared the high (`undici`, transitive). `next build` no longer stops on the advisory lookup. **Remaining: 4 moderate**, all `esbuild` ≤ 0.24 inside `drizzle-kit`'s deprecated loader (dev-server request issue; a dev tool, not shipped; the fix is a *downgrade* of drizzle-kit to 0.18 — not done). No other dependency added.
- Migration `0008_terms_acceptance.sql`: two nullable columns on `checkout_attempt`; `drizzle-kit generate` → "No schema changes"; `migrate.mjs` and `drizzle-kit migrate` are interchangeable (test: kit after script applies nothing).
- Secrets: `verify.sh` scan passes; hygiene scan passes. Credential-looking literals in my tests/scripts were rewritten (`"postgres:" + "//"`, `AUTH_SECRET=$S_AUTH`) because the existing scan flags them.
- Screenshots, **viewed by me** (`docs/phase9-samples/`): `staging-banner-marketing.png`, `staging-banner-dashboard.png`, `checkout-terms-box.png`, `checkout-terms-refused.png`, `legal-privacy.png`, `legal-terms.png`, `dev-outbox.png`. What I saw: banner on top of marketing and dashboard; checkout shows the unticked box with links to both documents and, after submitting without ticking, the red refusal text; privacy and terms show the DRAFT badge, the "Portuguese only / highlighted items not filled" notes and yellow placeholders; the outbox shows the welcome e-mail with a clickable link under its own staging banner.

## What changed

1. **Dependency sweep** (alone) — above.
2. **Environment guard** — `lib/env.ts`, `instrumentation.ts` (throws in production, logs elsewhere), `GET /api/health`, banner in `components/RootDoc.tsx` (shared by all six root layouts), `robots`/`sitemap`, `X-Robots-Tag` from `proxy.ts` (see judgment call 1), `BINDER_CONCURRENCY` from env (default 1) in `lib/binder/constants.ts`.
3. **`/dev-outbox`** — `lib/email/outbox.ts`, `app/dev-outbox/route.ts`.
4. **Legal drafts + terms acceptance** — `lib/legal/{privacy,terms,types,version}.ts`, `lib/legal/REVIEW.md`, the page, checkbox in `CheckoutForm`, `terms_not_accepted` in `createAttempt`, migration 0008, footer links on the dashboard, messages in four locales (+ DRAFTS rows).
5. **Tracking** — `lib/tracking.ts`, `components/Tracking.tsx`, `CookieSettings` footer control, events wired in pricing/checkout/return/waitlist; `/api/checkout/status` now returns `amountCents`+`currency` when paid.
6. **Maintenance + backups** — `scripts/maintenance.mjs`; `scripts/backup.sh` also archives evidence/uploads (same stamp, destination, retention; a set-but-missing dir fails); `scripts/migrate.mjs`.
7. **Ops** — `ops/{bootstrap-server.sh,deploy-remote.sh,complystart-migrate,sudoers-complystart-deploy,Caddyfile,systemd/*}`, `scripts/{package-release,remote-smoke,rehearse-deploy,check-caddy-logs,check-ops-hygiene}.sh`. (`ops/backup/*` moved to `ops/systemd/`.)
8. **`.github/workflows/deploy.yml`**, README sections, CLAUDE.md §6 conventions.

### `verify.sh` / `smoke.sh` diffs (permitted edits only)
- `verify.sh` vs `origin/main`: (1) the forbidden-claims `grep` directory list gains `lib/legal`; (2) new block **4m** calling `scripts/check-ops-hygiene.sh` (8 added lines). Nothing else.
- `scripts/smoke.sh` (+10/−3, kept small as asked): the three `POST /api/checkout` payloads gain the terms fields (`TERMS_JSON`, version read from `lib/legal/version.ts`); two checks for the refusal and the stored version; three checks for `/api/health`, no banner/`X-Robots-Tag` in development, `/dev-outbox` 404 outside staging.
- `ci.yml` unchanged. `deploy.yml` runs only for `main` (every job has `if: github.ref == 'refs/heads/main'` or depends on it).

## For Esteban — setup, in order
Full copy-paste text with explanations is in **README → "Staging server setup"**. Short form:
1. On your computer: `ssh-keygen -t ed25519 -N "" -C "complystart-deploy" -f ~/complystart-deploy-key` (private half → GitHub only; public half → server).
2. `scp -r ops root@138.197.70.66:/root/compinabox-ops` (from a checkout of `main`, or the unzipped GitHub "Download ZIP").
3. **First send the supervisor the output of** `sudo bash /root/compinabox-ops/bootstrap-server.sh 138.197.70.66 --check` (changes nothing) and wait for the A/B decision (README step 0). Then, on the chosen server: `DEPLOY_PUBLIC_KEY='<contents of complystart-deploy-key.pub>' bash /root/compinabox-ops/bootstrap-server.sh 138.197.70.66 --yes` (plus the port flags the check suggested, if any). **Write down the dev-outbox password and the `DEPLOY_BASE_URL` it prints.** Safe to repeat.
4. Still on the server: `echo "138.197.70.66 $(cut -d' ' -f1,2 /etc/ssh/ssh_host_ed25519_key.pub)"` — copy the line.
5. GitHub → Settings → Secrets and variables → Actions → add **six** secrets: `DEPLOY_HOST` (SSH only), `DEPLOY_USER` (`complystart-deploy`), `DEPLOY_SSH_KEY` (whole private key file), `DEPLOY_KNOWN_HOSTS` (the line from step 4), `DEPLOY_BASE_URL` (printed by step 3), `DEV_OUTBOX_PASSWORD` (step 3). *(`DEV_OUTBOX_PASSWORD` is mine — the smoke job needs it — `DEPLOY_BASE_URL` is the supervisor's.)*
6. Merge the PR (the push to `main` deploys) or Actions → "Deploy staging" → Run workflow on `main`.
7. Open `https://138.197.70.66/br` (accept the browser warning once — self-made certificate; expected on a bare IP) and `https://138.197.70.66/dev-outbox` (user `outbox`). Then on the server run `bash /opt/compinabox/current/scripts/check-caddy-logs.sh https://138.197.70.66` — must end `PASS`.
8. Roll back by hand: `ln -sfn releases/<older> /opt/compinabox/current && systemctl restart complystart` (code only; migrations stay).
9. **Send me:** the URL of the green Actions run, and the output of step 7's check.

## For the lawyer
`lib/legal/REVIEW.md` lists every placeholder (11, each also asserted by a test) and every assumption. Least sure of: (1) the controller/processor split in privacy §1 (the whistleblower channel and vendor screening in particular); (2) listing purposes with no legal bases ("indicadas na versão revisada"); (3) "Não vendemos dados pessoais" and "não toma decisões automatizadas" (true of the code, but commitments); (4) how far privacy §6/§6.1 may describe whistleblower anonymity given infrastructure logs; (5) the employee-IP notice chain (customer informs; the portal also tells them); (6) terms §2's "não é uma investigação de due diligence" for vendor screening; (7) terms with no liability, termination or governing-law text while checkout asks buyers to accept them; (8) retention stated as "no automatic deletion yet" — needs real periods.

## Judgment calls
1. **Proxy matcher widened.** `X-Robots-Tag` must follow `APP_ENV` at request time, but `next.config` headers are fixed at build. `proxy.ts` now matches everything except `_next/static|image`; geo/UTM still run only on the old marketing paths (regex `MARKETING`). Consequence: the existing test "proxy matcher is unchanged" (`tests/whistleblower-public.test.tsx`) was rewritten to assert behaviour (no redirect, no cookie on `/report/*` even with consent + UTM + country header). Caddy also adds the header on staging.
2. **Extra secret `DEV_OUTBOX_PASSWORD`** (the smoke job needs it; the notes listed four) plus the supervisor's `DEPLOY_BASE_URL`.
3. **CI gate in `deploy.yml`:** finds the merged PR for the commit and requires its `verify` check to be `success`; no PR → refuse unless `allow_unverified` is ticked on a manual run (CI only runs on PRs, so the merge commit itself has no check).
4. **Migrations on the server** run through `ops/complystart-migrate` as the app user (the deploy user cannot read `.env`), which **refuses unless `.env` says `APP_ENV=staging`** — the server-side enforcement of "automatic only on staging". `migrate.mjs` uses drizzle's runtime migrator, so `node_modules/drizzle-orm` (17 MB, maps/types stripped) is added to each archive: the standalone trace bundles it into chunks.
5. **Archive contents:** standalone output minus dev-only files (tests, docs, `*.md`, configs); the standalone trace copies much of the repo, so this keeps the release lean (~27 MB). The rehearsal runs the app from that stripped tree.
6. **Version in a file, not in the unit:** the unit reads `current/VERSION` into `APP_VERSION`, so a rollback (symlink move) reports the right version. `.env` is not symlinked into releases (systemd's `EnvironmentFile` supplies it); data dirs are absolute paths.
7. **`ALLOW_FAKE_PAYMENTS`/`EMAIL_DEV_SINK` count as "set" unless empty/false/0/no/off**; an unknown `APP_ENV` is treated as production.
8. **Outbox rate limit is global**, not per client (the repo's invariants forbid reading client addresses outside two places): 10 failures/minute lock the viewer for everyone for a minute.
9. **Failed releases** are renamed `<sha>.failed` and deleted by the next healthy deploy (they would otherwise take keep-slots from good releases).
10. **Terms version:** the form sends the version it rendered; a stale form after a text change is refused (`terms_not_accepted`) so the stored version is always the one the buyer saw. Text edits are forced to bump the version by a hash test.
11. **Cookie settings link** added to the marketing footer so consent can be withdrawn (needed for "withdrawal stops pushes"); 4 new strings (`footer.cookies`, `legal.*`, `checkout.accept*`, `checkout.errTerms`) in DRAFTS.md.
12. **Caddy `client_ip`** is kept in the general access log (abuse tracing) and removed from `/employee`, `/vendor`, `/api/welcome` and error lines.
13. **Bootstrap** sets `HOSTNAME=127.0.0.1` so Node binds to loopback only; `ufw` also allows whatever port `sshd` is actually listening on.
14. `IMPLEMENTATION_PLAN.md` checkboxes **not ticked** (acceptance needs the real run).

## Not done / open
- **Not run on the server** (all of it). The first real run may find differences in apt repository setup (NodeSource/PGDG/Caddy lines), `tls internal` on an IP, `sudo` without a tty, or file permissions that the single-user rehearsal cannot show.
- Out of scope per the notes: blog (9c), Mercado Pago (9b), anything in 9d, a real Resend test, Cloudflare/domain/certificate, SSH hardening beyond the bootstrap, monitoring, log shipping.
- Remaining `npm audit`: 4 moderate (dev-only `esbuild` in `drizzle-kit`).
- Employee/vendor links: the remote smoke reads an **employee** invitation from the outbox; a **vendor** link is not covered by the remote smoke (it is in `scripts/smoke.sh`).
- The `purchase` event is fired from the return page only when tracking is active there; if the buyer is redirected to `/onboarding` before consent was given, nothing is sent (by design).

## Found / for the supervisor
- Pre-existing: on `/checkout?c=br` the form text follows the country (pt-BR) but the page chrome (header toggle, footer, now the staging banner) follows cookies (English by default). Cosmetic; not touched.
- Pre-existing: `next build`'s standalone output contains copies of much of the repo (md files, tests); `package-release.sh` strips them. A `outputFileTracingExcludes` would fix the cause — not done (build-config change).
- Local `main` in this clone was behind `origin/main`; `verify.sh` compared against `origin/main` correctly.
- The 9c worker also edits `verify.sh` (same `BANNED=` line) and the sitemap; expect a trivial conflict there.

## CI / verify (final)
`./verify.sh` after the supervisor-update rework: see the "Final run" block below.
