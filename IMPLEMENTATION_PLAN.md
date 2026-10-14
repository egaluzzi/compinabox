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

SPEC §6 (auth only), §8, §13. **Deep review** — money and auth.

- [ ] Drizzle schema for all SPEC §13 entities (even ones not used yet — the shape is known); `company_id` on every tenant table; initial migration committed
- [ ] `WaitlistLead` table; phase 1 stub now writes to it
- [ ] Auth.js v5 magic link via Resend; `/dashboard` requires session; session carries `company_id`
- [ ] `PaymentProvider` interface + Stripe Checkout implementation; webhook handler idempotent on `event.id`
- [ ] `/checkout`: company name, tax ID (CNPJ validated; CUIT/RFC return `NotYetEnabled`), billing email; refuses countries not in `ENABLED_COUNTRIES`
- [ ] On `checkout.session.completed`: create `Company`, `User`, `BillingRecord` (with UTM fields), send welcome email with magic link, redirect to `/onboarding`
- [ ] `/onboarding`: company profile, industry dropdown, logo upload (local disk under `/opt/compinabox/uploads`, served by Caddy — no S3 yet)
- [ ] UTM capture in middleware → cookie → `BillingRecord`
- [ ] Tenant-isolation test: two companies seeded, every tenant-scoped query asserted to return only own rows
- [ ] **Backups:** `scripts/backup.sh` (`pg_dump` → Spaces via `s3cmd`), systemd timer unit file, restore instructions in README. Worker writes the files; **Esteban installs and runs the first restore test**; supervisor does not accept phase 2 until he confirms.

**Definition of done**
```
./verify.sh
npm run db:migrate              # against a fresh Postgres, exit 0
npm run test -- tenant          # isolation suite green
stripe listen --forward-to localhost:3000/api/webhooks/stripe   # + stripe trigger checkout.session.completed → Company row created
```
Judgment: webhook replay creates no duplicate `Company`; magic link expires and is single-use (test it); no secret in repo (`git grep -iE "sk_live|sk_test|re_[A-Za-z0-9]{20}"` returns nothing); backup restore confirmed by Esteban.

---

## Phase 3 — Document generation engine + Brazil legal-content layer

SPEC §5.1, §5.2, §7 (Brazil only).

- [ ] `/lib/content/br.ts`: Lei 12.846, Lei 14.133 citations, required elements, plain-language explainer — from SPEC §7 and CONTENT.md §3; `ar.ts`/`mx.ts` export a typed `NotYetEnabled` placeholder
- [ ] Template engine in `/lib/documents/`: merge fields (company name, industry, country), country layer injects legal references
- [ ] Six documents: code of conduct + five policies (SPEC §5.2), pt-BR
- [ ] Versioning: regenerate creates a new `Document` row; old versions readable, never deleted
- [ ] Web view + PDF export (react-pdf) with company logo
- [ ] Auto-provision all six on `Company` creation (hook into phase 2 flow)

**Definition of done**
```
./verify.sh
npm run test -- documents       # snapshot tests per document per industry
```
Judgment: every citation string lives in `br.ts`, none in templates (`grep -rn "12.846\|14.133" app lib/documents` returns nothing); PDFs open in Preview/Acrobat with logo and page numbers; a regenerated doc leaves the previous version intact. **Legal review of `br.ts` is an open input (CLAUDE.md §11), not a worker task.**

---

## Phase 4 — Customer dashboard shell

SPEC §6.

- [ ] `/dashboard` layout + nav: Overview, Documents, Employees, Training, Whistleblower, Vendors, Billing, Settings
- [ ] Overview: completion % (stubbed 0 until phase 6), open cases count (stubbed until phase 5), binder download placeholder
- [ ] Documents: list, view, regenerate (phase 3 engine), download PDF
- [ ] Settings: company profile, logo, industry; Billing: Stripe customer portal link
- [ ] Every page server-side filters by session `company_id`

**Definition of done**
```
./verify.sh
npm run test -- dashboard       # includes a cross-tenant 404/403 test per route
```
Judgment: no route reads `company_id` from URL or body; empty states exist for every section.

---

## Phase 5 — Whistleblower intake + case log

SPEC §5.3, §11. **Deep review** — anonymity and tenant isolation.

- [ ] `/report/[slug]` public page, branded, pt-BR (+ other locales from messages), form per CONTENT.md §5
- [ ] Anonymous by default: request handler must not persist IP, user-agent or any header unless `wants_contact = true`; evidence upload stripped of EXIF
- [ ] Tracking code (12 chars, unguessable) + `/report/[slug]/status` lookup, rate-limited
- [ ] Report `description` and `reporter_contact` encrypted at rest (application-level, key from env)
- [ ] Dashboard → Whistleblower: list, detail, status (new/under review/closed), notes, resolution date; notes are append-only
- [ ] Email notification to admin on new report (no report content in the email)

**Definition of done**
```
./verify.sh
npm run test -- whistleblower   # includes: anonymous submit → DB row has NULL ip/ua/contact; cross-tenant read → 404
```
Judgment: read the handler and the DB row by hand for one anonymous report — nothing identifying; encryption key rotation documented in README; tracking-code lookup can't enumerate.

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
- [ ] Caddyfile, `complystart.service`, backup timer — committed under `/ops/` with install notes
- [ ] GTM container after consent; events `view_pricing`, `begin_checkout`, `purchase` (value+currency), `lead_generic_country_waitlist`
- [ ] Blog: `/{country}/blog/[slug]` with MDX; seed the 4 Brazil articles + 3 English generic articles from CONTENT.md §6 (drafts, flagged for review); `Article` JSON-LD
- [ ] Legal pages: real BR privacy policy and terms **from Esteban's legal review** — if not available, pages stay "DRAFT" and launch is blocked (escalation rule 2)

**Definition of done**
```
./verify.sh
gh run list --workflow deploy.yml --limit 1        # green
curl -sI https://<domain>/br | grep -E "^HTTP/.* 200"
curl -sI https://<domain>/ | grep -i "cf-ray"       # confirms Cloudflare in front
```
Judgment: Lighthouse mobile on `/br` ≥ 90 performance; consent banner blocks GTM until accepted (check network tab); backup timer active (`systemctl list-timers`).

**→ Brazil launch. Esteban signs off.**

---

## Phase 10 — Enable Argentina

- [ ] `/lib/content/ar.ts` (Ley 27.401) from SPEC §7 / CONTENT.md §2; legal review open input
- [ ] CUIT validator; es-AR document templates; es-AR training content
- [ ] Add `ar` to `ENABLED_COUNTRIES`; remove `noindex`; AR pricing from Esteban
- [ ] Blog: 5 AR articles seeded

**Definition of done:** phase 1–9 suites green with `ENABLED_COUNTRIES=br,ar`; one real AR checkout in Stripe test mode end to end.

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

- Mercado Pago / Pix via `PaymentProvider` (Esteban's call, SPEC §15)
- Ad-variant landing pages `/{country}/gobierno`, `/{country}/proveedores` (CONTENT.md §7)
- Multi-admin per company; password login
- Object storage for uploads (currently local disk behind Caddy)
- DO Managed Postgres migration (only if backups/upgrades become a burden)
- Investigation protocol / case workflow beyond status + notes
- Country waitlist → automated launch notification email
