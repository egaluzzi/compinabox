# CLAUDE.md

Standing instructions for Claude Code working in this repo. Read this first, every session.

## What this project is

A self-serve "compliance in a box" website (placeholder brand: **ComplyStart** — grep/replace once the real name is picked). Full requirements, architecture, data model, and build phases live in **SPEC.md**. All marketing/product copy — hero text, FAQ, legal-basis explainers, emails — lives in **CONTENT.md**. Both are at the repo root.

**Do not re-derive product requirements or copy from scratch.** If something is ambiguous, check SPEC.md and CONTENT.md first; if it's genuinely not covered there, ask rather than guessing, especially on anything touching the compliance/legal claims the site makes (see "Guardrails" below).

## Stack

- Next.js (App Router), TypeScript, Tailwind — built with `output: 'standalone'` for self-hosted deployment
- i18n via `next-intl` — three locales: `es-AR`, `pt-BR`, `es-MX`, plus a default/generic locale for the fallback page
- Postgres (self-hosted on the droplet or DigitalOcean Managed Databases — see Hosting below)
- Stripe for payments
- `@react-pdf/renderer` or server-side Puppeteer for PDF generation (policies, binder/certificate)
- Resend or SendGrid for transactional email
- Sanctions/PEP screening via a third-party API (OpenSanctions or ComplyAdvantage) — do not build watchlist ingestion in-house
- GTM + GA4 for ads/conversion tracking

## Hosting

Self-managed on Esteban's DigitalOcean droplet — **not** Vercel, Netlify, or any platform that assumes it owns deployment. This changes a few things a Next.js default setup usually takes for granted:

- **Geo-detection (SPEC.md §3.2) needs an explicit solution**, since there's no managed-platform edge geo header. Either Cloudflare sits in front of the droplet (DNS-proxied) and the app reads `CF-IPCountry`, or Next.js middleware does a local lookup against a MaxMind GeoLite2-Country `.mmdb` file. Whichever is chosen, document it in SPEC.md §3.2 once implemented — don't leave both as live possibilities in the code.
- **Process management:** the Next.js server runs under PM2 or a systemd unit, not `npm start` in a detached terminal. Any deploy script/instructions should restart that service, not assume a platform handles it.
- **Reverse proxy + TLS:** Caddy or Nginx + Certbot sits in front of the Node process. Don't hardcode port assumptions (3000, etc.) into app logic — the proxy owns 80/443.
- **Database backups are the app's problem now**, not a managed platform's. If Postgres runs on the droplet itself, a backup cron (`pg_dump` → object storage, e.g., DigitalOcean Spaces) must exist before real customer/whistleblower data goes in — flag this explicitly if it's missing when starting phase 2+ of the build (SPEC.md §14).
- **Secrets** live in a `.env` on the droplet (or a secrets manager if one gets added later), never committed, and never assumed to be injected by a platform's dashboard the way Vercel env vars would be.

## Repo conventions

- `/app/[locale]/...` — marketing pages, routed by locale per SPEC.md §3
- `/app/(app)/...` — authenticated customer dashboard (SPEC.md §6)
- `/app/report/[slug]` — public whistleblower intake, no auth
- `/lib/content/{country}.ts` — structured legal-basis data (citations, required elements) per SPEC.md §7. **Never hardcode legal citations inside JSX/templates** — they must live in data files so they can be corrected without a redeploy.
- `/lib/documents/` — code of conduct / policy generation engine (merge-field templates)
- Env vars: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SCREENING_API_KEY`, `RESEND_API_KEY` — never commit real values; `.env.example` should list every key the app needs with placeholder values.

## Build order

Follow SPEC.md §14 phases in order — each phase is meant to be independently testable before moving to the next:
1. Marketing shell + geo-routing + SEO scaffolding (no backend)
2. Checkout + payment + Company/User provisioning
3. Document generation engine + country legal-content layer
4. Customer dashboard shell
5. Whistleblower intake + case log
6. Employee portal: training + acknowledgment tracking
7. Vendor questionnaire + sanctions screening
8. Binder/certificate generator
9. Ads/tracking wiring + blog content seeding

## Commands

*(fill these in once the project is scaffolded — placeholders below)*
```
npm run dev       # local dev server
npm run build     # production build
npm run lint      # lint — run before considering any task done
npm run test      # test suite
npm run typecheck # tsc --noEmit
```
Always run `lint` and `typecheck` before marking a task complete. If a test suite exists, run it too.

## Guardrails — do not cross these without flagging to the user first

- **Scope boundary (SPEC.md §2):** the product generates documented compliance components. It never claims to guarantee legal compliance, certify adequacy under any specific law, or substitute for a lawyer. If a copy change or new feature would imply otherwise, stop and flag it rather than shipping it — this is a liability issue, not a style preference.
- **Multi-tenant data isolation:** a customer must never be able to query, view, or export another customer's data — whistleblower reports especially. Treat any code path that touches `WhistleblowerReport` across tenants as a bug, not an edge case.
- **Anonymous reporting:** the default whistleblower intake path must not log IP address or other identifying metadata against a report unless the reporter explicitly opts to leave contact info (SPEC.md §5.3, §11).
- **No ISO/certification claims:** do not add UI copy implying ISO 37301/37002 certification or compliance — it's explicitly out of scope for v1 (SPEC.md §2).
- **Legal content changes:** edits to `/lib/content/{country}.ts` (citations, required elements) should be flagged for review, not silently changed as part of an unrelated feature PR.

## Source of truth

SPEC.md and CONTENT.md override this file on anything product-related. This file only covers *how to work in the repo* — build conventions, commands, guardrails. If the two ever conflict, SPEC.md wins and this file should be updated to match.
