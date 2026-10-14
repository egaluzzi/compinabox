# CLAUDE.md — ComplyStart

Durable context for any Claude Code session working in this repo — supervisor, worker, or verifier. Read this first, every session. It captures the decisions made during scoping *and the reasoning behind them*, so a fresh session can pick up real context from the files alone instead of re-litigating or quietly violating a choice.

If something here conflicts with the code, the documentation is more likely to be stale — resolve it and note what you resolved in `HANDOFF.md`. Update this file directly and immediately when a decision changes; don't append corrections at the bottom.

## 0. How decisions work on this project — read this first

This repo runs on the supervisor/worker model (`supervisor-worker-dev2` skill, loaded only in the supervisor session):

- **Esteban (the human)** owns business decisions and phase sign-off. He understands systems at a high level and does not adjudicate engineering choices — don't hand him one.
- **Supervisor session** owns technical decisions, scopes each phase in `SUPERVISOR_NOTES.md`, audits `HANDOFF.md`, and accepts or rejects phases.
- **Worker session** implements one phase or discrete task, runs `verify.sh`, writes `HANDOFF.md`, commits, pushes, stops. One cloud session per task; it never asks Esteban directly.

Bring something to Esteban only if **(1) users could notice it**, **(2) only he has the information** (money, deadlines, customers, legal exposure, what the product is for), or **(3) it's hard to undo** (deleting data, touching money, a vendor commitment, a migration that can't be walked back). Scoping line for this product: **SPEC.md and CONTENT.md are pre-approved.** Rule 1 applies to *deviations* from them, not to building what they say.

When two goods conflict, this order settles it without escalation: **(1) don't break things, (2) keep it simple to maintain, (3) keep costs down, (4) ship quickly.** Speed is last on purpose — take the safer, slower option, prefer the boring approach, fewer dependencies over more.

Workers: anything ambiguous that SPEC.md, CONTENT.md and the Decisions in §9 don't settle → make the reasonable call, record it under "Judgment calls" in `HANDOFF.md`, keep going. If a call touches a **Guardrail (§8)**, stop, write "blocked" in `HANDOFF.md`, and end the session. Never invent a default on a guardrail.

## 1. Baseline — read this next

- **Source-of-truth branch:** `main`. Deployed to the droplet from `main` only.
- **Stack:** Next.js (App Router), TypeScript, Tailwind, `next-intl`, Postgres + Drizzle, Auth.js v5, Mercado Pago, Resend, `@react-pdf/renderer`. Details in §3.
- **Hosting:** Esteban's DigitalOcean droplet behind Cloudflare. Details in §4.
- **Shell/OS:** workers run in Anthropic cloud sessions (Ubuntu). Deployment target is Ubuntu on the droplet. No Windows paths or PowerShell anywhere in scripts.
- **Mechanical checks:** `./verify.sh` at repo root — lint, typecheck, tests, build, migration drift. Workers run it before writing `HANDOFF.md` and paste its output. Neither session spends judgment on what it can check.
- **Known pre-existing failures:** `KNOWN_ISSUES.md` at repo root. Read it before interpreting any test/lint/typecheck result. Anything failing that isn't listed there is a new regression. Keep it updated; remove entries as they're fixed.
- **Project docs:** `SPEC.md` (requirements, data model), `CONTENT.md` (all copy, four languages), `IMPLEMENTATION_PLAN.md` (ordered phases with definitions of done). Do not re-derive requirements or copy from scratch.
- **Handoff files:** `HANDOFF.md` (worker → supervisor), `SUPERVISOR_NOTES.md` (supervisor → worker/verifier). Both overwritten each relay; the permanent record is `IMPLEMENTATION_PLAN.md`.

## 2. Rollout — Brazil first

**Decision:** Brazil launches first. Argentina and Mexico follow as separate later phases. Reasoning: Lei 14.133 makes compliance programs a hard eligibility requirement for public tenders in Brazil, so demand is clearest there; launching one market first also limits legal-content review to one jurisdiction before real money is taken.

What this means for the build, so no phase re-litigates it:

- **Routing, i18n and the four-locale plumbing are built for all countries from phase 1.** Retrofitting i18n later costs far more than building it in. `/ar` and `/mx` pages render their CONTENT.md copy from day one.
- **Country enablement is config, not code.** `ENABLED_COUNTRIES` env var (initially `br`). A disabled country's landing pages render normally but: pricing CTA is replaced with a waitlist form (same component as the generic page's), `/checkout` refuses that country, and its pages carry `noindex` until enabled.
- **Legal-content layer (SPEC §7) ships Brazil first.** `/lib/content/br.ts` is required for launch; `ar.ts` and `mx.ts` are built in their own phases later (IMPLEMENTATION_PLAN phases 10–11).
- **Country-specific validation (CNPJ, Pix) ships for BR first**; CUIT/RFC validators are stubbed with a clear `NotYetEnabled` error, not half-implemented.
- Geo-detection still routes AR/MX visitors to `/ar` and `/mx` — they just see the waitlist. Never redirect them to `/br`.

## 3. Stack — what and why

- **Next.js App Router + TypeScript + Tailwind**, built with `output: 'standalone'`. Standalone because the droplet runs the Node server directly under systemd (§4); there is no platform build step.
- **`next-intl`** — four locales: `en`, `es-AR`, `pt-BR`, `es-MX`. URL mapping in §5. Chosen over `next-i18next` because it's built for App Router and server components.
- **Postgres, self-hosted on the droplet.** Not Supabase, not a managed DB for now: Esteban already pays for the server, whistleblower data staying on infrastructure he controls is a selling point for the privacy policy, and the traffic profile is tiny. Moving to DO Managed Postgres later is a `DATABASE_URL` change. **Backups are therefore the app's problem** — see §4.
- **Drizzle ORM** (`drizzle-orm` + `drizzle-kit`). Lighter than Prisma, SQL-transparent, no binary engine on the droplet. Migrations live in `/lib/db/migrations/`, are committed, and applied on deploy. Never alter the schema by hand in the database.
- **Auth.js v5 (next-auth)**, email/magic-link provider via Resend, **for customer admins only**. No passwords in v1 — one less thing to secure and the admin logs in a few times a year. **Employees and vendors never get accounts**: they receive signed, single-use tokenized links (SPEC §5.4, §5.6). This keeps the employee portal usable for a 30-person company with no IT.
- **Mercado Pago** for payments (Esteban, 2026-10-14; Pix comes through it). Not Stripe. It is integrated **last** (IMPLEMENTATION_PLAN phase 9b) because its webhooks need a public HTTPS URL. Until then everything is built against a `PaymentProvider` interface with a `fake` provider (§8, §9), so the checkout flow — button → processor says paid → provisioning → onboarding — is complete and tested before the real processor exists.
- **`@react-pdf/renderer`** for all PDFs (policies, binder/certificate). Puppeteer only as a flagged fallback for a layout react-pdf truly can't do — Chromium on the droplet is memory the app can't spare.
- **Resend** for transactional email (magic links, employee invites, report notifications).
- **Sanctions/PEP screening:** OpenSanctions (yente API) behind a `ScreeningProvider` interface so ComplyAdvantage can be swapped in. Never build watchlist ingestion in-house.
- **GTM + GA4** for ads/conversion tracking (SPEC §10), loaded only after cookie consent.

## 4. Hosting and operations

Self-managed on Esteban's DigitalOcean droplet — **not** Vercel/Netlify or anything that assumes it owns deployment.

- **Cloudflare proxies DNS** (orange-cloud) in front of the droplet: CDN, DDoS protection, hides the origin IP, and provides the `CF-IPCountry` header used for geo-detection (SPEC §3.2). Middleware reads `CF-IPCountry`; header absent (local dev, direct hits) → country `unknown` → generic page. **There is no second geo mechanism** — no MaxMind, no geo API. Two code paths means one untested one.
- **Caddy** on the droplet terminates TLS (Cloudflare origin cert, "Full (strict)") and reverse-proxies to the Node process. Caddy owns 80/443; the app must not hardcode port assumptions.
- **systemd unit `complystart.service`** runs the Next.js standalone server. Deploy scripts restart it. Never `npm start` in a detached terminal, never PM2 (one process manager is enough).
- **Deploy:** GitHub Actions on push to `main` → build → rsync the standalone output to the droplet over SSH → `npm run db:migrate` → `systemctl restart complystart`. Until that workflow exists (phase 9), deploys are manual: `git pull && npm ci && npm run build && npm run db:migrate && sudo systemctl restart complystart`.
  - **Migrations against the live database are a deliberate step with Esteban in the loop**, never the tail of a merge (escalation rule 3). The GitHub Action may run migrations automatically only once phase 2 is accepted and he has confirmed backups are verified.
- **Backups:** nightly `pg_dump` → DigitalOcean Spaces, with a monthly restore test. **Must exist and be verified before phase 2 is accepted** — this is whistleblower data. Workers starting phase 2+ must confirm it's in place or write "blocked".
- **Secrets** live in `/opt/compinabox/.env` on the droplet, never committed, never assumed injected by a platform. `.env.example` lists every key with placeholder values.

## 5. URLs and locales

Public URLs use two-letter country prefixes; locale codes are internal and must never appear in a URL.

| URL prefix | Locale | Language | Status at launch |
| :- | :- | :- | :- |
| `/` | `en` | English — generic/global page (SPEC §3.3) | live |
| `/br` | `pt-BR` | Portuguese (Brazil) | live, checkout enabled |
| `/ar` | `es-AR` | Spanish (Argentina) | live, waitlist, `noindex` |
| `/mx` | `es-MX` | Spanish (Mexico) | live, waitlist, `noindex` |

`hreflang` tags use locale codes; `href`s use the URL prefixes. `/` is also `x-default`.

- Authenticated customer app: **`/dashboard/*`** (not `/app/*` — avoids the `app/app/` folder confusion in Next.js and reads better to a customer).
- Employee portal: `/employee/*` (tokenized links). Public whistleblower intake: `/report/[slug]`.
- Country cookie (`country`, 1 year) always beats `CF-IPCountry`. Geo redirects apply **only to `/`** — deep links like `/ar/pricing` are never geo-redirected.

## 6. Repo conventions

- `/app/(visitor)/...` — generic `en` page `/`, `/legal/*`, `/checkout` (language from cookies); `/app/[country]/...` — marketing pages, `country ∈ ar|br|mx` (language from the URL). Two root layouts so each page gets its own `<html lang>`; URLs are unaffected
- `/app/dashboard/...` — customer dashboard (SPEC §6)
- `/app/employee/...` — tokenized employee portal
- `/app/report/[slug]` — public whistleblower intake, no auth
- `/lib/content/{country}.ts` — structured legal-basis data (SPEC §7). **Never hardcode legal citations in JSX/templates** — they must be correctable without a redeploy.
- `/lib/documents/` — code of conduct / policy generation engine (merge-field templates)
- `/lib/db/schema.ts`, `/lib/db/client.ts`, `/lib/db/migrations/`
- `/lib/payments/` — `PaymentProvider` interface, `fake` provider (dev/test only, guarded), Mercado Pago implementation (phase 9b)
- `/lib/screening/` — `ScreeningProvider` interface + OpenSanctions implementation
- `/messages/{locale}.json` — next-intl messages, one per locale
- **Standing checklist item, every phase that adds a tenant-owned table:** it has a `company_id` column, every query filters by `company_id` taken from the authenticated session (never from a request param), and there is a test proving a second tenant can't read it. `verify.sh` greps for tenant tables without `company_id`.
- Env vars (all in `.env.example`): `DATABASE_URL`, `AUTH_SECRET`, `AUTH_URL`, `APP_URL`, `ENABLED_COUNTRIES`, `RESEND_API_KEY`, `EMAIL_FROM`, `PAYMENT_PROVIDER` (`none` default | `fake` | `mercadopago`), `ALLOW_FAKE_PAYMENTS`, `FAKE_PAYMENTS_SECRET`, `MERCADOPAGO_ACCESS_TOKEN`, `MERCADOPAGO_PUBLIC_KEY`, `MERCADOPAGO_WEBHOOK_SECRET`, `SCREENING_API_KEY`, `GTM_ID`

## 7. Commands

```
npm run dev          # local dev server
npm run build        # production build (standalone)
npm run lint         # eslint
npm run typecheck    # tsc --noEmit
npm run test         # vitest
npm run db:generate  # drizzle-kit generate — new migration from schema changes
npm run db:migrate   # drizzle-kit migrate — apply migrations
./verify.sh          # all of the above + invariants; exit 0 required before HANDOFF.md
```
`db:*` are placeholders (print a message, exit 1) until phase 2 (Drizzle).

## 8. Guardrails — stop and write "blocked" in HANDOFF.md, never decide these in a worker session

- **Scope boundary (SPEC §2):** the product provides documented compliance components. It never claims to guarantee legal compliance, certify adequacy under any law, or substitute for a lawyer. Any copy or feature implying otherwise is a liability issue, not a style preference.
- **Multi-tenant isolation:** a customer must never query, view or export another customer's data — whistleblower reports above all. Any cross-tenant code path touching `WhistleblowerReport` is a bug, not an edge case.
- **Anonymous reporting:** the default intake path must not log IP or identifying metadata against a report unless the reporter explicitly opts in (SPEC §5.3, §11). Note the asymmetry: employee *acknowledgments* DO log IP (SPEC §5.5) — that's an audit trail the customer wants.
- **No ISO/certification claims** (ISO 37301/37002) anywhere in UI copy — out of scope for v1 (SPEC §2).
- **Legal content (`/lib/content/*.ts`)** is edited only in a phase scoped for it, never as a side effect of an unrelated PR.
- **Fake payment provider enabled outside dev/test** (`ALLOW_FAKE_PAYMENTS` set on the droplet or in CI deploy config) — it provisions accounts without payment.
- **Migrations against live data, deleting data, changing what gets logged or retained, adding a paid service** — escalation rule 3; supervisor brings these to Esteban.

## 9. Decisions

Settled by Esteban or decided by the supervisor and recorded. Don't reopen; if a task seems to require it, flag in `HANDOFF.md`.

- **Rollout: Brazil first, AR and MX later** (Esteban, 2026-10-12). See §2.
- **Database:** self-hosted Postgres on the droplet, Drizzle. Not Supabase. (2026-10-12) — control over whistleblower data, no extra vendor, trivial traffic.
- **Auth:** Auth.js v5 magic link via Resend for admins; tokenized links for employees/vendors. (2026-10-12) — no passwords to secure, no employee accounts to support.
- **Geo-detection:** Cloudflare proxied + `CF-IPCountry` only. (2026-10-12) — Cloudflare is wanted anyway; a second mechanism is an untested one.
- **URLs:** `/ar` `/br` `/mx`, generic `/` in English, customer app at `/dashboard/*`. (2026-10-12)
- **Whistleblower module: standalone in this repo**, no integration with or white-labeling of any external infrastructure. (Esteban, 2026-10-12)
- **Process/proxy/deploy:** systemd + Caddy + GitHub Actions rsync-over-SSH. (2026-10-12) — one tool per job, all boring.
- **PDF:** react-pdf; Puppeteer only as flagged fallback. (2026-10-12) — droplet memory.
- **Screening:** OpenSanctions behind `ScreeningProvider`. (2026-10-12) — free tier, swappable.
- **Payments: Mercado Pago, not Stripe** (Esteban, 2026-10-14). `PaymentProvider` interface + `fake` provider from phase 2; the real Mercado Pago provider is phase 9b, before the Brazil launch sign-off. The webhook, never the browser return URL, is what marks a payment paid and provisions the account; a webhook is a *prompt to re-fetch the payment from the processor*, not a source of truth.
- **Fake payments are guarded** (2026-10-14): `PAYMENT_PROVIDER` defaults to `none` (checkout unavailable); `fake` works only when `ALLOW_FAKE_PAYMENTS=true`, which must never be set on the droplet. Fake-provider routes return 404 otherwise.
- **Geo/cookie behaviour at `/`** (2026-10-13): cookie `country` ∈ `ar|br|mx|other` beats `CF-IPCountry`; `other` means "show the picker" and is what the "change country" control sets (otherwise a cookie'd visitor could never reach `/`). Redirects are 307 + `no-store`. Generic-page language toggle is EN/ES/PT = locales `en`/`es-MX`/`pt-BR`, cookie `lang`.
- **`ENABLED_COUNTRIES` is read at request time**, not build time (2026-10-13) — CI builds the artifact, the droplet's `.env` supplies the value.
- **Gap-filled translations** (2026-10-13): where CONTENT.md has a string in one locale only, the worker translates it faithfully and lists it in `messages/DRAFTS.md`; Esteban reviews that file before launch (§11).

## 10. Explicitly out of scope / dropped

Considered and declined — don't build unless Esteban asks again:
- Everything in SPEC §2 "out of scope" (risk assessments, human DD, CSDDD, legal advice, ISO certification).
- Supabase, MaxMind, PM2, Nginx, Puppeteer-first PDF — superseded by the decisions above.
- Multi-admin per customer (v2). Password login (v2 at most).
- Ad-variant landing pages (`/ar/gobierno` etc.) — fast-follow per SPEC §10, not v1.

## 11. Open inputs still needed from Esteban (track; don't block other work on these)

- [ ] Final product name/brand (placeholder: ComplyStart — grep/replace once decided)
- [ ] Pricing for Brazil (BRL); later AR/MX
- [ ] Monthly vs annual-only billing
- [x] Payments: Mercado Pago (decided 2026-10-14); Pix via Mercado Pago to be confirmed in sandbox at phase 9b
- [ ] Domain name + Cloudflare account access (needed before phase 1 can be verified end-to-end on geo)
- [ ] Mercado Pago account: sandbox (test) credentials for phase 9b; production credentials before launch
- [ ] Resend account + sending domain
- [ ] Legal review of `/lib/content/br.ts` citations and the BR privacy policy before launch (SPEC §11)
- [ ] Review of `messages/DRAFTS.md` (gap-filled translations, incl. footer disclaimer) by a native speaker / legal before launch
