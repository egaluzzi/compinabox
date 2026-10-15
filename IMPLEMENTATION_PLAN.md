# ComplyStart — Phased Implementation Plan

Companion to `CLAUDE.md` (read that first — it has the rationale behind every decision referenced here) and `SPEC.md` (the requirements each phase implements). This file is the ordered task list and the permanent record. Work top to bottom.

Each phase ends with a **Definition of done** — a command list plus the judgment items that can't be a command. A phase isn't finished until `./verify.sh` exits 0 *and* the judgment items hold. The supervisor accepts or rejects each phase; Esteban's sign-off is business-level only.

**Rollout order is Brazil first** (CLAUDE.md §2). Phases 1–9 ship a Brazil-only launch with AR/MX pages live behind a waitlist. Phases 10–11 enable AR and MX.

One worker session per phase. Worker reads `SUPERVISOR_NOTES.md` → implements → `./verify.sh` → writes `HANDOFF.md` → commits and pushes its branch → stops.

---

## Phase 0 — Repo scaffold and groundwork

- [x] `create-next-app` with TypeScript, Tailwind, App Router, `src/` off, `output: 'standalone'`
- [x] ESLint + Prettier, Vitest + Testing Library, `tsc --noEmit` script
- [x] `package.json` scripts exactly as named in CLAUDE.md §7
- [x] `verify.sh` runnable end to end (it exists; make it pass on the scaffold)
- [x] `.env.example` with every key in CLAUDE.md §6
- [x] `.gitignore` (node, `.env*`, `.next`, Drizzle output)
- [x] `KNOWN_ISSUES.md` empty table committed
- [x] GitHub Actions: `ci.yml` running `./verify.sh` on every PR. **Deploy workflow is NOT this phase** — see phase 9.
- [x] `README.md`: how to run locally, how the handoff files work (two paragraphs, link to CLAUDE.md)

**Definition of done**
```
./verify.sh                      # exit 0
npm run build                    # produces .next/standalone
gh run list --limit 1            # ci.yml green on the PR
```
Judgment: no feature code yet; nothing from CONTENT.md rendered.

---

## Phase 1 — Marketing shell, geo-routing, SEO scaffolding (no backend)

SPEC §3, §4 (marketing routes only), §9. CONTENT.md §1–§5.

- [x] `next-intl` with four locales; `/messages/{en,es-AR,pt-BR,es-MX}.json` populated from CONTENT.md — **copy verbatim, do not rewrite**
- [x] Routes: `/`, `/{country}`, `/{country}/pricing`, `/{country}/how-it-works`, `/{country}/faq`, `/{country}/legal-basis`, `/legal/{terms,privacy,disclaimer}` (legal pages as placeholders marked "DRAFT — pending review")
- [x] Middleware: `CF-IPCountry` → redirect from `/` only; cookie `country` beats header; `unknown` → `/`; never redirect deep links (SPEC §3.2)
- [x] Country picker on `/`, "change country" control on every localized page, EN/ES/PT language toggle on `/`
- [x] `ENABLED_COUNTRIES` flag: disabled countries show waitlist form instead of pricing CTA and emit `noindex`
- [x] Waitlist form posts to a stub API route that logs to console (real storage in phase 2)
- [x] SEO: per-page `<title>`/description from CONTENT.md, `hreflang` + `x-default`, `sitemap.xml`, `robots.txt` (disallow `/dashboard`, `/employee`, `/checkout`, `/onboarding`), JSON-LD `Organization` + `FAQPage`
- [x] Footer disclaimer (CONTENT.md §1) on every page
- [x] Cookie-consent banner component (no tracking scripts yet — GTM wiring is phase 9)
- [x] Fill in CLAUDE.md §7 with the real commands if anything differs

**Definition of done**
```
./verify.sh
npm run build
# geo routing — run against `npm start` of the standalone build:
curl -sI -H "CF-IPCountry: BR" http://localhost:3000/ | grep -i "location: .*/br"
curl -sI -H "CF-IPCountry: AR" http://localhost:3000/ | grep -i "location: .*/ar"
curl -sI -H "CF-IPCountry: DE" http://localhost:3000/ | grep -E "^HTTP/.* 200"
curl -sI -H "CF-IPCountry: BR" -H "Cookie: country=mx" http://localhost:3000/ | grep -i "location: .*/mx"
curl -sI -H "CF-IPCountry: BR" http://localhost:3000/ar/pricing | grep -E "^HTTP/.* 200"   # no redirect on deep links
curl -s http://localhost:3000/ar | grep -i 'noindex'
curl -s http://localhost:3000/br | grep -ic 'noindex'    # expect 0
curl -s http://localhost:3000/sitemap.xml | grep -c "<loc>"   # > 0
```
Judgment: copy matches CONTENT.md word for word (spot-check 5 strings per locale); no legal citation hardcoded in JSX (all in `/lib/content/*` or messages); Lighthouse mobile LCP < 2.5s on `/br`.

---

## Phase 2 — Database, auth, checkout, provisioning

SPEC §6 (auth only), §8, §13. **Deep review** — money and auth. The payment processor is **Mercado Pago, integrated last (phase 9b)**; this phase builds the whole checkout flow against a guarded `fake` provider, so everything after the processor's "paid" signal is real and tested.

- [x] Drizzle schema for all SPEC §13 entities (even ones not used yet — the shape is known); `company_id` on every tenant table; initial migration committed. Plus two pre-tenant tables: `checkout_attempt` (provider, provider_ref, status pending|paid|failed|expired, company name/tax_id/billing_email/country, amount/currency, UTM fields; no `company_id` because the company doesn't exist yet) and `payment_event` (provider + provider event/payment id, unique — idempotency ledger)
- [x] `WaitlistLead` table; phase 1 stub now writes to it
- [x] Auth.js v5 magic link; `/dashboard` requires session; session carries `company_id`. Email goes through an `EmailSender` interface: Resend implementation, plus a dev/CI sink used when `RESEND_API_KEY` is unset (so magic links are testable without a Resend account)
- [x] `PaymentProvider` interface (`createCheckout`, `verifyWebhook`, `fetchPayment`) + `fake` provider. Guard: `PAYMENT_PROVIDER` defaults to `none` (checkout shows "unavailable"); `fake` works only with `ALLOW_FAKE_PAYMENTS=true`; otherwise the fake routes 404
- [x] `/checkout`: company name, tax ID (CNPJ validated; CUIT/RFC return `NotYetEnabled`), billing email, **pay button**; refuses countries not in `ENABLED_COUNTRIES`. Click → server creates a `checkout_attempt` → provider returns a hosted-checkout URL → browser goes there
- [x] Fake processor simulator page (`/checkout/fake/[id]`, guarded) with "Pay" / "Fail" buttons that behave like a real processor: they send a **signed webhook** to the same webhook endpoint the real provider will use; they never touch the DB directly
- [x] Webhook endpoint `/api/webhooks/payments`: verify signature → treat the event only as a prompt → `fetchPayment` from the processor → if paid, in **one DB transaction** insert `payment_event` (unique; replay is a no-op), create `Company`, `User`, `BillingRecord` (with UTM), mark attempt paid; send welcome email with magic link
- [x] Return page `/checkout/return`: polls attempt status (the webhook may land after the browser) and redirects to `/onboarding` once paid; shows failed/expired/still-pending states with retry
- [x] `/onboarding`: company profile, industry dropdown, logo upload (local disk under `/opt/compinabox/uploads`, served by Caddy — no S3 yet)
- [x] UTM capture in the Phase 1 proxy → cookie → `checkout_attempt` → `BillingRecord`
- [x] Tenant-isolation test: two companies seeded, every tenant-scoped query asserted to return only own rows
- [x] **Backups:** `scripts/backup.sh` (`pg_dump` → Spaces via `s3cmd`), systemd timer unit file, restore instructions in README. Worker writes the files and proves a dump → restore round trip locally; **Esteban installs them on the droplet and runs the first restore test before the first real customer** (gated in phase 9 — dev databases hold test data only).

**Definition of done**
```
./verify.sh                      # exit 0; now includes a fresh-Postgres migrate + DB-backed tests (CI has a postgres service)
npm run db:migrate               # against a fresh Postgres, exit 0
npm run test -- tenant           # isolation suite green
npm run test -- payments         # replay, bad signature, failed payment, guard tests green
# live click-through against the standalone build + real Postgres (paste output):
#   POST checkout -> attempt pending -> simulator "Pay" -> webhook -> Company/User/BillingRecord rows exist
#   -> return page resolves to paid -> /onboarding reachable with the magic-link session
```
Judgment: webhook replay creates no duplicate `Company`; a webhook with a bad signature or a "paid" claim the processor doesn't confirm provisions nothing; browser return alone never provisions; with `ALLOW_FAKE_PAYMENTS` unset the fake routes 404 and checkout is unavailable; magic link expires and is single-use (test it); no secret in repo (`git grep -iE "sk_live|sk_test|APP_USR-|TEST-[0-9a-f]{8}|re_[A-Za-z0-9]{20}"` returns nothing); backup round trip proven in the worker's session (dump → restore into a scratch DB → row counts match). The real Resend send is **not** verified here (no account yet) — it moves to phase 9's definition of done.

---

## Phase 3 — Document generation engine + Brazil legal-content layer

SPEC §5.1, §5.2, §7 (Brazil only). The generated documents *are* the product, and they are legal-adjacent: **the worker drafts them; they are not reviewed law.** Everything here is built so a lawyer can review and correct it, and launch is gated on that review (phase 9).

- [x] `/lib/content/br.ts`: typed `CountryLegalContent` — Lei 12.846 and Lei 14.133 citations, required/recommended elements, plain-language explainer, disclaimer, `reviewStatus: "draft"`. Sourced **only** from SPEC §7 and CONTENT.md §3 — no article numbers, decrees or other statutes added by the worker (suggestions go to the lawyer via HANDOFF). `ar.ts`/`mx.ts` export a typed `NotYetEnabled` placeholder
- [x] Template engine in `/lib/documents/`: pure, deterministic `generateDocument()` → structured content (sections + paragraphs); merge fields (company name, industry, country); unknown/missing field throws; country layer injects legal references from `br.ts` at generation time
- [x] Six documents, pt-BR: code of conduct (SPEC §5.1 clauses + leadership-commitment statement) and five policies (SPEC §5.2), templates as data under `lib/documents/templates/`, plus `lib/documents/REVIEW.md` (every template, status DRAFT — needs legal review)
- [x] Versioning: regenerate inserts a new `documents` row (per company + type, next version, unique); old versions readable; **append-only enforced in the database** (trigger blocks UPDATE/DELETE on `documents`); regenerating with unchanged inputs is a no-op that returns the current version
- [x] Web view + PDF export (react-pdf, A4): company logo (PNG/JPEG — logo uploads restricted to those two, WebP dropped), title, version, generated date, page numbers "Página X de Y", disclaimer footer
- [x] Documents are generated **when onboarding completes** (industry is only known then), in the same transaction as the profile update; idempotent. (Deviation from "on Company creation": a document generated before the industry is known would put a wrong version 1 into the audit trail.)
- [x] Minimal routes under `/dashboard/documents` (list with versions, view, PDF download, regenerate) — phase 4 builds the dashboard shell around them; tenant from the session only, other tenants' ids 404

**Definition of done**
```
./verify.sh                      # includes smoke: onboarding -> 6 documents -> view -> PDF -> regenerate -> v1 intact
npm run test -- documents        # snapshot tests per document per industry; engine, versioning, tenant tests
```
Judgment: every citation string lives in `br.ts`, none in templates (`grep -rn "12.846\|14.133" app lib/documents` returns nothing); no template or UI string claims compliance/adequacy/legal sufficiency; PDFs checked page by page (logo, accents, page numbers) — sample PNGs committed under `docs/phase3-samples/` for the supervisor to look at; a regenerated doc leaves the previous version intact (DB-level); `br.ts` explainer text equals the pt-BR `legal-basis` page copy (drift test). **Legal review of `br.ts` and of the templates is an open input (CLAUDE.md §11), not a worker task, and gates the Brazil launch.**

---

## Phase 4 — Customer dashboard shell

SPEC §6. Wraps the phase 3 document pages in a real app shell and adds the remaining sections as honest empty states, so phases 5–7 each just fill in their section.

- [x] `/dashboard` layout + nav: Overview, Documents, Employees, Training, Whistleblower, Vendors, Billing, Settings; active state, sign-out, responsive (mobile works), accessible landmarks. Language = the company's country locale
- [x] One helper (`requireTenant`) used by **every** dashboard page and route handler (layouts don't re-run on client navigation, so the layout alone is not a gate); enforces session + completed onboarding; a test fails if any file under `app/(app)/dashboard` skips it
- [x] Overview: real tenant-scoped counts where the tables exist (documents, employees, open whistleblower cases), completion % shown as "—" until phase 6 defines it, binder download placeholder
- [x] Documents: phase 3 pages inside the shell (list, view, regenerate, PDF); draft-review status visible
- [x] Employees, Training, Whistleblower, Vendors: empty states written for the finished product; actions that don't exist yet are absent or visibly disabled
- [x] Settings: edit company name, industry, logo; tax ID, country and admin email shown read-only; saving does **not** regenerate documents (it says so and links to Documents); does not touch `onboarding_completed_at`
- [x] Billing: payment history from `BillingRecord` (date, formatted amount, status) + subscription status; no cancel/manage flow (billing terms are an open input)
- [x] Authenticated pages send `Cache-Control: private, no-store`, frame-ancestors denial and `Referrer-Policy: same-origin`
- [x] Every page server-side filters by session `company_id`; no route reads `company_id` from URL, query or body (new verify.sh invariant)

**Definition of done**
```
./verify.sh                      # includes smoke: sign in -> all 8 sections 200 -> sign out -> redirected
npm run test -- dashboard        # cross-tenant test per route; requireTenant coverage test
```
Judgment: empty states exist for every section; renaming a company leaves the old document versions rendering with the name they were generated with (audit trail); desktop and mobile screenshots committed under `docs/phase4-samples/` for the supervisor to look at.

---

## Phase 4b — Server-side session revocation (small; before phase 5)

Found in the phase 4 review: signing out only clears the cookie. Sessions are stateless JWTs (7 days), so a copied cookie keeps working after sign-out (the worker replayed one by hand). Whistleblower data arrives in phase 5, so this closes first.

- [x] `users.sessions_valid_after` (timestamptz, default now) + migration; every issued session (Auth.js sign-in, welcome link, return-token sign-in) carries its issue time
- [x] `getTenant()` rejects a session issued before the user's `sessions_valid_after`
- [x] Sign-out sets `sessions_valid_after = now()` (all of that user's sessions end; one admin per company, so this is the intended meaning)
- [x] Tests on real Postgres: replaying a pre-sign-out cookie gets 401/redirect on every dashboard section and the PDF route; a session issued after sign-out works; sign-in links and welcome links still single-use

**Definition of done:** `./verify.sh`; smoke replays the old cookie after sign-out and is refused.

---

## Phase 5 — Whistleblower intake + case log

SPEC §5.3, §11. CLAUDE.md §8 (anonymous reporting, tenant isolation). **Deep review** — anonymity, encryption, tenant isolation. Scoped in detail in `SUPERVISOR_NOTES.md`; decisions summarised here so they survive the relay.

- [x] **Company slug:** `companies.slug` (unique, not null, immutable, ASCII-slugified name + collision suffix), set at provisioning, backfilled by the migration; the public URL is `/report/[slug]`
- [x] `/report/[slug]` public page, branded (company name + logo), language = company country locale, form per CONTENT.md §5; no cookies, no banner, no tracking, `noindex`, `Referrer-Policy: no-referrer`, frame denial
- [x] Anonymous by default: the intake handlers read **no** request metadata (no IP, user-agent, forwarded headers) and log nothing; `is_anonymous = !wants_contact`; contact stored only on opt-in
- [x] Evidence: optional, up to 3 images (PNG/JPEG, 5 MB each); metadata stripped (EXIF/XMP/ICC/text chunks); **encrypted at rest in a directory that is never web-served** (not `UPLOADS_DIR`); downloaded only through a tenant-gated route
- [x] Tracking code (12 chars, 32-letter unambiguous alphabet, shown grouped) + `/report/[slug]/status` lookup; wrong slug and wrong code are indistinguishable; rate-limited per slug in process memory (no IP is read)
- [x] `description`, `reporter_contact`, case notes and evidence encrypted at rest (AES-256-GCM, key from env, key id in the ciphertext, documented rotation + rotation script)
- [x] Dashboard → Whistleblower: channel URL, list, detail, status (new / under review / closed), append-only notes (DB trigger), resolution date, evidence download
- [x] Email notification to the company admin on a new report (no report content, no category, link to dashboard); a failed send never loses the report
- [x] **Align report statuses**: lifecycle `new` → `under_review` → `closed`; default becomes `new` via migration (existing `received` rows → `new`), CHECK constraint, `OPEN_REPORT_STATUSES` and its tests updated

**Definition of done**
```
./verify.sh                      # includes new invariant: no request-metadata access in report handlers; smoke covers the whole anonymous flow
npm run test -- whistleblower    # anonymous submit with marker IP/UA headers -> marker string appears nowhere in any table; cross-tenant read/note/evidence -> 404; encryption round trip, tamper, rotation
```
Judgment: the supervisor reads the handler and one real anonymous DB row (raw `psql` output in HANDOFF); ciphertext visible in `psql` for description/contact/notes; evidence file on disk is not an image; tracking-code lookup cannot enumerate; encryption key rotation documented in README.

---

## Phase 6 — Employee portal: training + acknowledgment tracking

SPEC §5.4, §5.5.

- [ ] Employees: CSV import (name, email), invite email per CONTENT.md §5, signed single-use token links (`/employee/[token]`), re-issue on expiry
- [ ] Acknowledgment flow: read + accept code of conduct and each policy; stores timestamp **and IP** (this one does log IP — SPEC §5.5)
- [ ] Training module: 15–25 min scenario-based content in pt-BR (content drafted by worker from the policy suite, flagged for Esteban's review), end quiz, pass threshold 80%, `TrainingCompletion` row
- [ ] Annual conflict-of-interest disclosure form → `Disclosure`
- [ ] Dashboard → Employees/Training: per-employee status grid, company completion %, CSV + PDF export
- [ ] Overview widgets from phase 4 now real

**Definition of done**
```
./verify.sh
npm run test -- employee        # token single-use, expiry, cross-tenant token rejected
```
Judgment: an expired or reused token shows a friendly page, not a stack trace; export matches the grid.

---

## Phase 7 — Vendor questionnaire + sanctions screening

SPEC §5.6.

- [ ] `ScreeningProvider` interface + OpenSanctions (yente) implementation; results cached per vendor with `screened_at`
- [ ] Vendor invite via tokenized link → questionnaire (ownership, PEP exposure, prior sanctions, anti-bribery policy y/n)
- [ ] Dashboard → Vendors: list, questionnaire status, screening result, re-screen
- [ ] Copy labels it a *screening tool*, never "due diligence investigation" (SPEC §5.6 — guardrail)

**Definition of done**
```
./verify.sh
npm run test -- vendors         # provider mocked in unit tests
# live check, pasted into HANDOFF.md:
curl -s "https://api.opensanctions.org/match/default" ... | head   # one real call with a known-listed name returns a hit
```
Judgment: mock-only is **not** verified for this phase — one real API round-trip required in evidence.

---

## Phase 8 — Binder / certificate generator

SPEC §5.7. Build last — pulls from everything above.

- [ ] One-click PDF: cover (Brazil legal basis), code of conduct, policies, training report, acknowledgment roster, whistleblower channel proof (URL + screenshot), vendor screening summary
- [ ] Generated async (job table + polling) — large PDFs must not time out the request
- [ ] Download from Overview; previous binders kept

**Definition of done**
```
./verify.sh
npm run test -- binder
```
Judgment: open the PDF — this is the deliverable the customer hands to an auditor; design quality is a requirement. Cover text carries the "not legal advice" disclaimer.

---

## Phase 9 — Production deploy, tracking, blog seeding (Brazil launch)

SPEC §9 (blog), §10, CLAUDE.md §4.

- [ ] `deploy.yml`: on push to `main` → build → rsync standalone to droplet → restart `complystart.service`. **Migration step is manual until Esteban approves automating it.**
- [ ] Caddyfile, `complystart.service`, backup timer — committed under `/ops/` with install notes. **Gate: Esteban installs the backup timer and completes a restore test on the droplet before any real customer data** (CLAUDE.md §4)
- [ ] GTM container after consent; events `view_pricing`, `begin_checkout`, `purchase` (value+currency), `lead_generic_country_waitlist`
- [ ] Blog: `/{country}/blog/[slug]` with MDX; seed the 4 Brazil articles + 3 English generic articles from CONTENT.md §6 (drafts, flagged for review); `Article` JSON-LD
- [ ] Legal pages: real BR privacy policy and terms **from Esteban's legal review** — if not available, pages stay "DRAFT" and launch is blocked (escalation rule 2)
- [ ] **Legal review gate:** `lib/content/br.ts` and the pt-BR document templates (`lib/documents/REVIEW.md`) reviewed by a Brazilian lawyer, corrections applied, `reviewStatus` set to reviewed with reviewer and date — unreviewed templates mean launch is blocked (escalation rule 2: the customer hands these documents to auditors)
- [ ] Cloudflare rate-limit rules for the unauthenticated write endpoints: `/api/checkout`, `/api/auth/*`, `/api/waitlist` (phase 2 left them unlimited; `/api/checkout` also confirms whether an email already has an account)
- [ ] Droplet `.env` review: `ALLOW_FAKE_PAYMENTS` and `EMAIL_DEV_SINK` unset, `APP_URL`/`AUTH_URL` are the public https origin, `AUTH_SECRET` real
- [ ] Real Resend send verified from the droplet (welcome email + sign-in link delivered to a real inbox; link works once)
- [ ] Welcome-link scanner check: open the delivered link via the real mail path; if a prefetch burns it, switch `/api/welcome` to GET → confirm page → POST
- [ ] **Whistleblower anonymity at the edge (phase 5 follow-ups):** Caddy must not write client IPs to its access log for `/report/*` (log filter or no access log for that path) and Cloudflare per-IP rate limits cover `/report/*` and `/api/report/*`; GTM/GA4 and the consent banner must never load on `/report/*` or `/dashboard/*`; the privacy policy must say Cloudflare, as proxy, sees reporter IPs
- [ ] **`REPORT_ENCRYPTION_KEY` custody:** set on the droplet and stored separately from the database backups (password manager); losing it makes every report unreadable and a backup without it is useless — Esteban confirms (hard to undo); `EVIDENCE_DIR` exists, is outside Caddy's served paths, and is included in backups
- [ ] Phase 5 carry-overs: Caddy request-body size cap on `/api/report` (the handler buffers the multipart body before validating sizes); set `NEXT_TELEMETRY_DISABLED=1`; decide how `npm run rotate-report-key` runs on the droplet (it needs a checkout + `node_modules`, the deploy ships only the standalone output); `scripts/backup.sh` currently dumps the DB only — extend it (or add a second job) to cover `EVIDENCE_DIR`
- [ ] Backup bucket is **private**; Esteban confirms a downloaded dump restores with `scripts/restore-test.sh`

**Definition of done**
```
./verify.sh
gh run list --workflow deploy.yml --limit 1        # green
curl -sI https://<domain>/br | grep -E "^HTTP/.* 200"
curl -sI https://<domain>/ | grep -i "cf-ray"       # confirms Cloudflare in front
```
Judgment: first request from a Brazilian IP / VPN to `https://<domain>/` lands on `https://<domain>/br` (the Cloudflare→Caddy→app chain; `APP_URL` correct); Lighthouse mobile on `/br` ≥ 90 performance; consent banner blocks GTM until accepted (check network tab); backup timer active (`systemctl list-timers`).

**→ Deployed. Brazil launch waits for phase 9b (real payments).**

---

## Phase 9b — Mercado Pago payment provider (blocks Brazil launch)

Built after the deploy because Mercado Pago webhooks need a public HTTPS URL. Replaces the `fake` provider in production; the flow, tables and webhook endpoint from phase 2 are unchanged. **Deep review — money.**

- [ ] `MercadoPagoProvider` implementing `PaymentProvider`: hosted checkout (preference) with Pix enabled for BR; webhook verifies the `x-signature` HMAC, then **re-fetches the payment by id** from the API — status in the webhook body is never trusted; idempotent on payment id + status
- [ ] Env: `PAYMENT_PROVIDER=mercadopago`; sandbox credentials first, production credentials last; `ALLOW_FAKE_PAYMENTS` unset on the droplet
- [ ] Handles approved, pending (Pix awaiting payment), rejected, cancelled/expired, and refunded/charged-back (marks `BillingRecord`, does not delete the Company)
- [ ] **Paid but not provisioned** (phase 2 marks the attempt `failed` with `email_in_use_after_payment`, logs `PAID BUT NOT PROVISIONED`): policy is manual refund by Esteban in the Mercado Pago dashboard. Add an alert email to an ops address (`OPS_ALERT_EMAIL`) when it happens so it is not only in logs, and a refund helper if the API makes it cheap

**Definition of done**
```
./verify.sh
# against the deployed URL, sandbox credentials, results pasted in HANDOFF.md:
#   approved test payment -> Company/User/BillingRecord created, welcome email delivered
#   same webhook delivered twice -> still exactly one Company
#   rejected payment -> no Company; user can retry
#   Pix (if sandbox supports it) -> pending then approved path works
#   forged webhook (bad signature) -> 401, nothing created
```
Judgment: mock-only is **not** verified for this phase — every line above needs a real sandbox round-trip; fake routes 404 on the droplet; no credential in repo. Then **one real low-value live payment by Esteban, refunded**, before launch (money — his call).

**→ Brazil launch. Esteban signs off.**

---

## Phase 10 — Enable Argentina

- [ ] `/lib/content/ar.ts` (Ley 27.401) from SPEC §7 / CONTENT.md §2; legal review open input
- [ ] CUIT validator; es-AR document templates; es-AR training content
- [ ] Add `ar` to `ENABLED_COUNTRIES`; remove `noindex`; AR pricing from Esteban
- [ ] Blog: 5 AR articles seeded

**Definition of done:** phase 1–9 suites green with `ENABLED_COUNTRIES=br,ar`; one real AR checkout in the payment sandbox end to end.

---

## Phase 11 — Enable Mexico

- [ ] `/lib/content/mx.ts` (LGRA Art. 25); RFC validator; es-MX templates and training
- [ ] Add `mx`; MX pricing from Esteban; 4 MX articles

**Definition of done:** as phase 10 for `mx`.

---

## Cross-cutting fixes (not tied to a phase)

Log standalone sweeps here — e.g. a bug pattern found twice incidentally — so they stay in the project's history.

- (none yet)

---

## Backlog / v2 (explicitly deferred)

- Document polish: the `{{country}}` merge field yields "contexto de Brasil" (needs "do Brasil"); industry label is capitalised mid-sentence ("No setor de Saúde"); per-country grammatical variants belong in the template/locale data, not the engine
- Customer text editing of generated documents (v1 is regenerate-only)
- Backup manifest: record per-table counts at dump time so the restore test can also prove the dump matched the database
- Ad-variant landing pages `/{country}/gobierno`, `/{country}/proveedores` (CONTENT.md §7)
- Multi-admin per company; password login (note: with one admin, a report about that admin has no independent recipient)
- Whistleblower: retention/purge policy and reporter privacy notice (lawyer + Esteban), no-JS submit path, smoke "only the session's company was renamed" check fails if run alone on an empty DB
- Object storage for uploads (currently local disk behind Caddy)
- DO Managed Postgres migration (only if backups/upgrades become a burden)
- Investigation protocol / case workflow beyond status + notes
- Country waitlist → automated launch notification email
