# ComplyStart — Product & Technical Specification
*(working name — rebrand before launch)*

Spec for an engineering agent (Claude Code) to build a self-serve, unattended "compliance in a box" website. A company lands on the site, picks a country (or is auto-detected), pays, and walks away with a working compliance program: code of conduct, policies, a branded whistleblower channel, employee training, and an acknowledgment/disclosure tracker — packaged into a binder they can hand to a government procurement officer or a multinational customer's vendor-compliance team.

No lawyer, no sales call, no human in the loop between card swipe and delivery.

---

## 1. Who this is for

Small and mid-sized companies in Argentina, Brazil, and Mexico that need to **prove** they have a compliance program to:
- Qualify for or stay eligible on a **government contract/tender**, or
- Satisfy a **large multinational customer's supplier compliance requirement** (US or European parent company).

They are not trying to build a best-in-class ethics culture. They need a credible, documented, defensible program, fast, cheap, and with no internal compliance expertise required.

---

## 2. Scope boundary (critical — do not build past this line)

**In scope (fully self-serve, automatable):**
- Code of conduct generation
- Policy suite generation (gifts/hospitality, conflicts of interest, dealing with public officials, anti-bribery)
- Whistleblower/reporting channel + case log
- Employee training module + completion tracking
- Employee acknowledgment tracking (code of conduct, policies, disclosures)
- Lightweight third-party/vendor due diligence questionnaire + sanctions-list screening
- Compliance binder/certificate generator (packages the above into a deliverable document)

**Explicitly out of scope — do not attempt to automate, and do not imply the product provides these:**
- Company-specific corruption risk assessments (requires human judgment)
- Human due diligence investigations on third parties beyond automated sanctions screening
- CSDDD-style human rights / environmental supply-chain due diligence
- Legal advice or certification that a program is "adequate" under any specific law
- ISO 37301 / ISO 37002 certification (can be offered later as a paid add-on referral to a certifying body — not built into v1)

The site's copy must never claim the product *guarantees* legal compliance or satisfies any specific audit. Language throughout should be "provides the documented components regulators/auditors typically require," not "guarantees compliance." Flag this to legal/Esteban before launch — this is marketing-copy risk, not a technical requirement, but it shapes several UI strings noted in CONTENT.md.

---

## 3. Country handling & routing

### 3.1 Supported "full" markets
Argentina, Brazil, Mexico — each gets a localized page with country-specific legal citations, language (es-AR, pt-BR, es-MX), currency, and payment method mix.

**Rollout order: Brazil first; Argentina and Mexico later** (see CLAUDE.md §2 for the reasoning). All three country pages exist from launch, but only countries listed in `ENABLED_COUNTRIES` (initially `br`) can check out. A disabled country's pages render normally with a waitlist form in place of the pricing CTA and a `noindex` tag until enabled.

### 3.2 Detection logic
1. Cloudflare proxies DNS in front of the droplet (§12) and sets `CF-IPCountry` on every request. Next.js middleware reads that header to resolve the visitor's country. If the header is absent (local dev, direct hits to the droplet IP), the country is `unknown`. There is no other geo mechanism — no MaxMind database, no live geo API.
2. If resolved country ∈ {AR, BR, MX} → redirect to that country prefix (`/ar`, `/br`, `/mx`) and render localized content. This applies to disabled countries too — an Argentine visitor lands on `/ar` and sees the waitlist, never `/br`.
3. If resolved country ∉ {AR, BR, MX} (including `unknown`/VPN) → land on the **generic/global page** (`/`) in English with a **country/region picker** prominently placed (not buried in nav).
4. Persist the user's explicit choice in a cookie (`country`, 1 year) so manual overrides stick and aren't re-geo'd on next visit. The cookie always wins over `CF-IPCountry`.
5. A visible "change country" control must exist on every localized page — geo-detection is a default, never a lock-in.
6. Redirects only apply to the root `/`. Deep links to `/ar/...`, `/br/...`, `/mx/...` are never redirected based on geo — a Brazilian visitor who opens `/ar/pricing` sees the Argentina page.

### 3.3 The generic/global page
Not a stub. It needs to do real work for visitors who are:
- US/European compliance or procurement officers evaluating whether to direct a supplier to the tool, or
- Companies in a Latin American country not yet supported, who should still be capturable as leads.

Content: product explanation, the "why" (government + multinational supplier triggers), the 3 supported countries with flags/links, a waitlist form for unsupported countries, and FAQ. No country-specific legal citations on this page — keep it jurisdiction-neutral and defensible.

### 3.4 Locales
Four locales: `en` (generic page at `/`), `es-AR` (`/ar`), `pt-BR` (`/br`), `es-MX` (`/mx`). Public URLs use the two-letter country prefix; locale codes are internal and must never appear in URLs. The generic page defaults to English and offers a manual language toggle (EN/ES/PT) that switches the UI language without changing the country (i.e. `/` can render in Spanish for a visitor from Colombia). `hreflang` tags use the locale codes; `href`s use the URL prefixes; `/` is also `x-default`.

---

## 4. Site map

```
/                      → generic/global landing + country picker (en)
/ar                    → Argentina landing (es-AR)
/br                    → Brazil landing (pt-BR)
/mx                    → Mexico landing (es-MX)
/{country}/pricing     → pricing & checkout entry
/{country}/how-it-works
/{country}/faq
/{country}/legal-basis → "what the law requires" explainer (per-country legal citations)
/{country}/blog/...    → SEO content (see §9)
/checkout              → payment flow (Mercado Pago) (country pre-filled from referrer)
/onboarding            → post-payment setup wizard (company name, industry, logo upload, admin email)
/dashboard/*           → authenticated customer dashboard (see §6)
/report/{company-slug} → PUBLIC whistleblower intake page, one per customer, no login required
/employee/*            → tokenized-link employee portal (training, acknowledgment, disclosures)
/legal/terms, /legal/privacy, /legal/disclaimer
```

---

## 5. Core product — the seven components

Each customer account gets an instance of all seven, auto-provisioned at checkout completion.

### 5.1 Code of Conduct generator
- Template engine: base clauses (anti-bribery, gifts & hospitality, conflicts of interest, dealing with public officials, confidentiality) with merge fields: company name, industry (dropdown at onboarding), country.
- Country layer swaps in required legal references (see §7).
- Output: web-viewable version + exportable PDF.
- Versioned — if the company edits/regenerates, old versions remain in an audit trail.

### 5.2 Policy suite
Same generation mechanism as 5.1, separate documents:
- Anti-bribery & anti-corruption policy
- Gifts, hospitality & entertainment policy
- Conflicts of interest policy
- Third-party/public official dealings policy
- Whistleblower protection policy (this one must exist as a *written policy*, separate from the channel itself in 5.3)

### 5.3 Whistleblower channel
- Public intake page at `/report/{company-slug}`, branded with the customer's name/logo, no login required for the reporter.
- Anonymous-by-default option (do not collect identifying data unless the reporter opts in) — required given data protection law variance across AR/BR/MX.
- Structured intake form: category of concern, description, optional evidence upload, optional contact info.
- Each report generates a tracking code the reporter can use to check status anonymously (standard practice — avoids needing login for anonymous reporters).
- Case management log on the customer dashboard: status (new/under review/closed), notes, resolution date. This log is itself audit evidence.
- Data residency/encryption requirements: see §10.

### 5.4 Employee training module
- Short, scenario-based e-learning (aim for 15–25 minutes), topics mirroring the policy suite.
- Delivered via unique link per employee (no company-wide login system needed for v1 — reduces build complexity).
- Completion tracked with timestamp; quiz/check at the end with a pass threshold.
- Admin can bulk-invite employees via CSV upload (name + email).

### 5.5 Acknowledgment & disclosure tracker
This is the unifying record layer — not just training completion. One roster per employee tracking:
- Code of conduct: read + accepted (timestamp, IP logged)
- Each policy in the suite: read + accepted (same)
- Training: completed/not, score, date
- Annual conflict-of-interest disclosure: submitted/pending, with the actual disclosure content stored
- Dashboard view: per-employee status grid + company-wide completion %, exportable as CSV/PDF for an auditor.

### 5.6 Third-party / vendor due diligence (lightweight)
- Self-serve questionnaire the customer sends to their own vendors/agents (not the customer themselves): ownership structure, PEP (politically exposed person) exposure, prior sanctions, anti-bribery policy in place y/n.
- Automated sanctions/PEP list screening against publicly available watchlists (OFAC SDN, UN, EU consolidated list) via a screening API — this is the one piece of "due diligence" that can legitimately run unattended.
- Explicitly labeled as a screening tool, not a full due diligence investigation — copy must not overstate this.

### 5.7 Compliance binder / certificate generator
- One-click PDF package: code of conduct + policy suite + training completion report + acknowledgment roster + whistleblower channel proof-of-existence (screenshot/link) + vendor screening summary.
- Cover page references the country-specific legal basis (§7).
- This is the actual deliverable a customer hands to a procurement officer or auditor — treat its design quality as a priority, not an afterthought.

---

## 6. Customer dashboard (`/dashboard/*`)

Authenticated via Auth.js magic link (email → Resend → one-time sign-in link). No passwords in v1. One admin per account at minimum (multi-admin can be v2).

Sections: Overview (completion %, open whistleblower cases, binder download), Documents (code of conduct + policies, regenerate/edit), Employees (roster, invite, acknowledgment status), Training (completion tracking), Whistleblower (case log), Vendors (due diligence questionnaire status + screening results), Billing (subscription, invoices), Settings (company profile, logo, industry).

---

## 7. Country legal-basis content (feeds §5.1, 5.2, 5.7)

Store as structured data (not hardcoded in templates) so legal citations can be updated without a redeploy.

**Argentina** — Law 27,401 (Corporate Criminal Liability Law). Mandatory minimum elements when contracting with the federal government: code of conduct, specific policies for public administration dealings, periodic training. Recommended (include anyway, since multinational buyers expect them): risk analysis, whistleblower channel, investigation protocols, compliance officer designation.

**Brazil** — Clean Company Act (Lei 12.846/2013) + Law 14,133/2021 (new public tenders law, requires robust compliance programs including whistleblowing channels and senior leadership commitment for public bid eligibility).

**Mexico** — General Law of Administrative Responsibilities (LGRA), Article 25 — "adequate integrity policy" requires: published code of conduct with implementation mechanisms, clear reporting lines/organizational structure, control and audit systems, adequate whistleblowing + disciplinary system, training and communication, HR screening policies.

**Cross-cutting (applies to all three, driven by US/EU buyer expectations, not local law):** DOJ Evaluation of Corporate Compliance Programs emphasis on third-party due diligence, ongoing monitoring, and documented recordkeeping tying training/hotline usage/certifications together → this is why §5.5 and §5.6 exist even though no single AR/BR/MX law mandates them at that depth.

Each country page's "legal basis" section should cite the specific law, in plain language, with a visible disclaimer: *"This is general information, not legal advice."*

---

## 8. Pricing & checkout

- Flat annual (or monthly) price per country tier — exact pricing is a business decision, not specified here; build the system to support country-specific pricing stored as config, not hardcoded.
- Checkout: company name, tax ID (CUIT/CNPJ/RFC — validate format per country), billing email, payment via Mercado Pago (cards, Pix and other local methods it offers per country; Brazil first). No card data touches our servers.
- Immediately on successful payment: trigger onboarding wizard, auto-provision all 7 components with defaults, send welcome email with login.
- No human touches the order. If payment fails or company data is invalid, the flow must handle it entirely in-browser (clear error states, retry).

---

## 9. SEO requirements

- Server-side rendered or statically generated pages (Next.js App Router with SSG/ISR — do not ship a client-only SPA for the marketing pages).
- Unique `<title>` and meta description per locale page (content in CONTENT.md).
- `hreflang` tags linking `/ar` (`es-AR`), `/br` (`pt-BR`), `/mx` (`es-MX`), and `/` (`en`, also `x-default`) as alternate-language versions of the same intent.
- Structured data: `Organization`, `Product` (with pricing), `FAQPage` schema on the FAQ page, `Article` schema on blog posts.
- Clean URL structure as in §4 — no query-string-based routing for indexable pages.
- `sitemap.xml` auto-generated, `robots.txt` allowing all marketing pages, disallowing `/dashboard/*`, `/employee/*`, `/checkout`, `/onboarding`. Disabled countries' pages additionally carry `noindex` (§3.1).
- Core Web Vitals: target LCP < 2.5s, CLS < 0.1 — keep marketing pages light (no heavy client JS above the fold).
- Blog/content section per country (`/{country}/blog`) seeded with SEO-targeted articles — topic list in CONTENT.md §6. This is the primary organic acquisition channel; budget real content investment here, not an afterthought.

---

## 10. Paid ads & tracking requirements

- Google Tag Manager container on every page (marketing + checkout funnel) for Google Ads conversion tracking and Meta Pixel.
- Conversion events to wire: `view_pricing`, `begin_checkout`, `purchase` (with value + currency), `lead_generic_country_waitlist`.
- UTM parameter capture and persistence through the checkout flow (store on the customer record — attributes paid spend to revenue).
- Landing pages must be ready for ad traffic specifically: fast load, no popups/interstitials blocking the CTA, clear single CTA above the fold per page (don't split attention between "buy now" and "learn more" at equal visual weight).
- Separate, ad-specific landing page variants are a reasonable v1.1 addition (e.g., `/ar/gobierno` targeting "requisitos licitación pública" search/ad traffic vs `/ar/multinacional` targeting supplier-compliance traffic) — flag as a fast-follow, not required for launch.
- Consent banner / cookie notice required given AR/BR/MX data protection law (LGPD in Brazil especially) before tracking scripts fire.

---

## 11. Data protection & security (non-functional)

- Encrypt whistleblower report content at rest; restrict access to the reporting customer's admin only (multi-tenant isolation is critical — a data leak here is existential for the product).
- Anonymous reporting path must not log IP/identifying metadata against the report by default.
- Each country's local data protection law (Argentina's PDPA, Brazil's LGPD, Mexico's LFPDPPP) should govern a short, real privacy policy — not boilerplate. This is worth actual legal review before launch, flagged separately from this technical spec.
- Role-based access: customer admins only see their own tenant's data. No cross-tenant data exposure, ever.

---

## 12. Tech stack (decided — reasoning in CLAUDE.md §3–§4 and §9)

- **Frontend/SSR:** Next.js (App Router), TypeScript, `next-intl` for i18n, Tailwind. `output: 'standalone'`.
- **Hosting:** Esteban's DigitalOcean droplet. Cloudflare proxies DNS in front (CDN, DDoS protection, `CF-IPCountry` for §3.2, origin TLS in Full-strict mode). Caddy on the droplet terminates TLS and reverse-proxies to the Node process, which runs under a systemd unit. Deploys run from GitHub Actions on push to `main`: build → rsync the standalone output over SSH → restart the unit. Migrations against the live database are a deliberate manual step until Esteban approves automating them.
- **Database:** Postgres self-hosted on the droplet. ORM: Drizzle, with migrations committed in `/lib/db/migrations/`. Nightly `pg_dump` to DigitalOcean Spaces must be in place and restore-tested before phase 2 is accepted — this is whistleblower data, losing it isn't an option.
- **Auth:** Auth.js v5, magic-link provider via Resend, for customer admins. Employees (§5.4, §5.5) and vendors (§5.6) use signed, single-use tokenized links — no accounts.
- **Payments:** Mercado Pago (incl. Pix) behind a `PaymentProvider` interface; integrated last, with a guarded `fake` provider used until then.
- **PDF generation:** `@react-pdf/renderer` for the binder/certificate (§5.7) and individual policy exports. Puppeteer only as a flagged fallback.
- **Email:** Resend (welcome emails, magic links, employee training invites, report notifications).
- **Sanctions screening:** OpenSanctions API (yente) behind a `ScreeningProvider` interface so ComplyAdvantage can be swapped in later.
- **Analytics/tracking:** GTM + GA4, loaded only after cookie consent, as in §10.

---

## 13. Data model (entities — high level)

```
Company (id, name, tax_id, country, industry, created_at, subscription_status)
User (id, company_id, role[admin], email, ...)
Employee (id, company_id, name, email, invite_token, ...)
Document (id, company_id, type[code_of_conduct|policy:*], version, content, generated_at)
Acknowledgment (id, employee_id, document_id, accepted_at, ip_address)
TrainingCompletion (id, employee_id, module_id, completed_at, score)
Disclosure (id, employee_id, type, content, submitted_at)
WhistleblowerReport (id, company_id, tracking_code, category, description, is_anonymous, reporter_contact?, status, created_at)
Vendor (id, company_id, name, questionnaire_status, screening_result, screened_at)
BillingRecord (id, company_id, amount, currency, utm_source, utm_medium, utm_campaign, paid_at)
```

---

## 14. Build phases

The authoritative, ordered plan with a definition of done per phase is **`IMPLEMENTATION_PLAN.md`**. Summary: 0 scaffold → 1 marketing shell + geo + SEO → 2 DB, auth, checkout, provisioning → 3 document engine + Brazil legal content → 4 dashboard shell → 5 whistleblower intake + case log → 6 employee portal → 7 vendor screening → 8 binder → 9 production deploy + tracking + blog (**Brazil launch**) → 10 enable Argentina → 11 enable Mexico.

---

## 15. Open decisions for Esteban (not for Claude Code to guess)

- Final product name/brand (this doc uses "ComplyStart" as a placeholder throughout — replace before content is finalized).
- Pricing per country (Brazil first).
- Monthly vs annual-only billing.

Settled decisions — database, auth, geo, URLs, standalone whistleblower module, hosting topology, Brazil-first rollout — are logged in CLAUDE.md §9 and are not open. The full list of inputs still needed from Esteban is CLAUDE.md §11.
