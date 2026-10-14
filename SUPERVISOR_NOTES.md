# Supervisor notes — worker task: Phase 2 (database, auth, checkout, provisioning)

Overwrite each time — a relay, not a log. Only one relay at a time. Read this at the start of
your session before anything else.

---

## If this is a WORKER task

### Context
Phases 0 and 1 are merged. Phase 2 is **deep review** (money + auth). Esteban chose **Mercado
Pago**, to be integrated **last** (phase 9b, because its webhooks need a public URL). So this
phase builds the *entire* checkout flow against a guarded **`fake` payment provider**: pay
button → (fake) processor says paid → webhook → provisioning → onboarding. Everything after the
processor's "paid" signal is real code with real tests; only the processor is simulated.

Read first: `CLAUDE.md` (§0, §4, §6, §8, §9 — note the new Payments and fake-provider decisions),
the **Phase 2** section of `IMPLEMENTATION_PLAN.md` (rewritten for this — it is the checklist),
`SPEC.md` §6, §8, §13, `KNOWN_ISSUES.md`. Branch `phase-2-checkout` from current `main`; PR to
`main`; don't merge; don't push to `main`.

**Out of scope — log under "Not done":** the real Mercado Pago provider, Stripe anything,
dashboard pages beyond what `/onboarding` and the auth redirect need, document generation,
whistleblower/employee/vendor anything, deploy/Caddy/systemd files other than the backup timer,
GTM. If you think you need one, say so under "Open questions".

### Decisions already made (record deviations as judgment calls)

**Payments**
- `PaymentProvider` interface in `lib/payments/`: `createCheckout(attempt) → {redirectUrl,
  providerRef}`, `verifyWebhook(rawBody, headers) → event | invalid`, `fetchPayment(paymentRef) →
  {status: paid|pending|failed|expired, amount, currency, attemptId}`. Registry picks the provider
  from `PAYMENT_PROVIDER` (`none` default | `fake` | `mercadopago` — the last throws "not
  implemented until phase 9b").
- **Guard (guardrail, CLAUDE.md §8):** `fake` only works when `ALLOW_FAKE_PAYMENTS=true` *and*
  `FAKE_PAYMENTS_SECRET` is set. Otherwise checkout is "unavailable" and every fake route returns
  404. Test both directions. Put `PAYMENT_PROVIDER=none`, `ALLOW_FAKE_PAYMENTS=false` in
  `.env.example`.
- **Webhook = prompt, not truth.** The endpoint `/api/webhooks/payments` verifies the signature,
  then calls `fetchPayment` and acts only on what the *processor* reports. A browser return URL
  never provisions anything. Fake provider: sign webhooks with HMAC-SHA256 (`FAKE_PAYMENTS_SECRET`);
  make payment refs **stateless signed tokens** (attempt id + status + signature) so `fetchPayment`
  can verify them without a table — unless you see a better stateless/simple way; record it.
- **Simulator page** `/checkout/fake/[id]` (guarded): "Pay" and "Fail" buttons that behave like a
  processor — they POST a signed webhook to the real endpoint, then send the browser to the return
  URL. They never write to the DB themselves.
- **Provisioning transaction** (single DB transaction): insert `payment_event` (unique on provider
  + event/payment id; a conflict = replay = no-op, return 200), create `Company`, `User`
  (admin), `BillingRecord` (with UTM), mark `checkout_attempt` paid. Welcome email *after* commit.
- **Price** lives in `lib/pricing.ts` per country with an `isPlaceholder: true` flag (no real price
  yet — Esteban's input). While placeholder, the checkout page shows a visible "TEST PRICE" label,
  and creating an attempt through any provider other than `fake` is refused.
- **Return page** `/checkout/return`: polls attempt status (webhook may arrive after the browser),
  shows pending / failed / expired with retry. When paid it sends the browser to `/onboarding`
  **signed in**: at attempt creation set an httpOnly cookie with a random `return_token` (store its
  hash on the attempt); on paid + matching cookie, issue the session once (single-use, 1 h expiry),
  then clear it. The emailed magic link is the fallback. Test: wrong/absent/reused/expired token →
  no session.
- Use CONTENT.md checkout strings verbatim (button, post-payment confirmation). Other new UI
  strings and the welcome email go in all four `messages/*.json` as faithful drafts, listed in
  `messages/DRAFTS.md` (the provenance test still has to pass).

**Auth**
- Auth.js v5 (pin exact version), Drizzle adapter, email provider, **JWT sessions**, session
  carries `company_id` (and user id). **No self sign-up:** only existing `User` emails can get a
  link; the sign-in response is identical for unknown emails (no account enumeration).
  Sign-in link TTL 15 min; welcome-email link TTL 24 h; both single-use. Test single-use and expiry
  against the real DB.
- `EmailSender` interface: Resend implementation; a **file sink** (`.dev-outbox/`, gitignored) used
  only when `EMAIL_DEV_SINK=true`. If neither `RESEND_API_KEY` nor the sink flag is set, sending
  fails loudly — never silently writes links to disk in production. Add `EMAIL_DEV_SINK` to
  `.env.example`. The real Resend send can't be verified (no account); say so in HANDOFF.

**Data and DB**
- Drizzle + `pg` (pin both; `drizzle-kit` for migrations in `lib/db/migrations/`). Real
  `db:generate` / `db:migrate` scripts replace the placeholders; update CLAUDE.md §7's note.
- Schema: all SPEC §13 entities + `checkout_attempt`, `payment_event`, `waitlist_lead`, plus the
  Auth.js tables. `company_id` on every tenant table (verify.sh 4b enforces it). Phase 1 waitlist
  route now inserts into `waitlist_lead` (still logs nothing identifying; remove the console.log).
- **CNPJ:** real check-digit validation with tests (valid, invalid, formatted/unformatted, repeated
  digits). CUIT/RFC return a typed `NotYetEnabled`. `/checkout` refuses countries not in
  `ENABLED_COUNTRIES` (reuse the Phase 1 helper); country comes from `/checkout?c=br`.
- **UTM:** extend the proxy matcher to the marketing pages **without** changing geo behavior
  (redirect logic still `/` only; keep its tests green). Capture `utm_source|medium|campaign`
  (sanitized, length-capped) into a 30-day cookie, last non-empty touch wins, copied to
  `checkout_attempt` → `BillingRecord`. **Only set the cookie when `consent=accepted`** (LGPD
  caution — call it a judgment call); when the visitor accepts the banner, also capture the current
  URL's UTM params. 
- **Uploads:** logo in `UPLOADS_DIR` (default `./uploads`, gitignored); allow PNG/JPEG/WebP only
  (no SVG), ≤ 1 MB, random server-chosen filename, magic-byte check; serve via a route handler with
  fixed content-type and `nosniff`. Phase 9 will move serving to Caddy.
- **Tenant isolation:** every tenant query takes `company_id` from the session, never from the
  request. Seed two companies; test every tenant-scoped query returns only own rows, and that
  `/onboarding` can't write to another company.

**Backups** (written and round-trip-tested by you; Esteban installs them on the droplet and runs
the first restore test before the first real customer — a phase 9 gate, not a phase 2 gate): `scripts/backup.sh` (`pg_dump` → compress → upload with `s3cmd`; destination
configurable, plus `BACKUP_DEST=local:/path` so it can be exercised without Spaces; prune policy
documented), `ops/backup/complystart-backup.{service,timer}`, README section with install and
**restore** steps. No credentials in the repo. Exercise it in your session with the local
destination: dump → restore into a scratch database → compare row counts; paste that output.

**verify.sh / CI — permitted edits, and only these:**
1. Add `checkout_attempt|payment_event` to the 4b allowlist (they exist before a company does).
2. When `lib/db/schema.ts` exists: **fail** if `TEST_DATABASE_URL` is unset; create a fresh
   database, run `npm run db:migrate`, then run the test suite with that URL. DB-backed tests must
   *fail*, not skip, when it is unset (mock-only is unverified).
3. Extend `scripts/smoke.sh` with the live checkout flow (fake provider + real Postgres): create
   attempt → simulator pay → webhook → rows exist → return resolves paid → session works; replayed
   webhook → still one company; bad signature → 401; with `ALLOW_FAKE_PAYMENTS` unset → fake routes
   404 and checkout unavailable.
4. `.github/workflows/ci.yml`: add a `postgres:16` service and `TEST_DATABASE_URL` env.
Show the diff of `verify.sh` and `ci.yml` in HANDOFF.md.

**Postgres in your session:** it's Ubuntu; `apt-get install -y postgresql` and start it. If that
is impossible, say so — CI's service plus pasted CI output is then your DB evidence, but you must
say you couldn't run it locally.

### Action items
Work the Phase 2 checklist in `IMPLEMENTATION_PLAN.md` top to bottom and tick it. Small logical
commits. Push, open PR, wait for `ci.yml` on the head, run `./verify.sh` on the final code commit,
write `HANDOFF.md`.

### Definition of done
As written in Phase 2 of `IMPLEMENTATION_PLAN.md`. Judgment items I will check (hand me
evidence, not assurance): replay creates no second `Company`; bad signature and "paid-claim the
processor doesn't confirm" provision nothing; return URL alone never provisions; fake routes 404
and checkout unavailable without the flag; magic link single-use + expiry on the real DB;
no enumeration on sign-in; cross-tenant tests; no secrets (`git grep` from the plan); backup
round-trip output; what is NOT verified (real Resend, real Mercado Pago, Caddy/Cloudflare).

### Report back
`HANDOFF.md` per the template. Verification depth must separate: real Postgres (which, how
migrated from scratch), real HTTP through the standalone server, and the fake processor (state
plainly that no real payment processor was involved). List every judgment call (UTM-consent,
session-binding cookie, fake-ref design, file-sink flag, anything you changed from the above).

---

## If this is a VERIFICATION request

Not applicable for this relay.
