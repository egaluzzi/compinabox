# Handoff — Phase 4: customer dashboard shell, 2026-10-14

Branch `phase-4-dashboard` (from `main`), PR to `main`, **not merged**. **Code tip: bc64f23** — `./verify.sh` ran on exactly this commit (exit 0). Commits after it add only this file.
Nothing here touches a Guardrail (CLAUDE.md §8); no schema change, no migration, no new dependency (`package.json` / lockfile unchanged).

## What was built
- `lib/auth/require-tenant.ts` — `requireTenant()` (pages: redirect `/login` without a session, `/onboarding` if `onboarding_completed_at` is null; returns `{tenant, company, locale, t}`), `requireTenantRoute()` (same gate for route handlers: 401 / 403 instead of redirects), `sessionLocale()` (root layout only). One `React.cache`d load per request. `company_id` comes only from `getTenant()` (the signed session).
- `app/(app)/dashboard/layout.tsx` — shell: header (logo if any, company name, admin email, **sign-out = Auth.js `signOut` server action** from a form button), `<nav aria-label>` with the 8 sections, `<main id="main">`, skip-to-content link. `components/DashboardNav.tsx` is the only client component (needs `usePathname` for `aria-current="page"`, since layouts don't re-render on client navigation). Mobile: nav is a 2-/4-column grid, no JS toggle. Plain Tailwind.
- Pages: Overview, Documents (+ `[id]`, `[id]/pdf`), Employees, Training, Whistleblower, Vendors, Billing, Settings, and `POST /dashboard/settings/save`. The four later-phase sections are honest empty states (`components/EmptyState.tsx`) with a visibly disabled primary action where one will exist.
- `lib/db/tenant.ts` — `updateCompanySettings` (name, industry, optional logo only; never touches `onboarding_completed_at`; `updateCompanyProfile` untouched), `getTenantUser`, `countEmployees`, `countOpenReports`; `getBillingRecords` now newest-first. `lib/dashboard/completion.ts` (`completionPercent()` → `null`), `lib/dashboard/format.ts` (date in `America/Sao_Paulo`, `Intl.NumberFormat` per record currency).
- Phase 3 pages/routes moved onto the gate; `/api/documents/regenerate` too (it sits outside the dashboard tree, but is tenant-bound). The document web view no longer uses `doc.locale` for the date but the company locale (same value for BR).
- `app/(app)/layout.tsx`: `<html lang>` = company locale when signed in (was cookie-only); the `<main max-w-3xl>` wrapper moved into `/onboarding` so the dashboard owns its own `<main>` landmark.
- `next.config.ts` `headers()` for `/dashboard/:path*`, `/onboarding`, `/login`: `Cache-Control: private, no-store`, `Content-Security-Policy: frame-ancestors 'none'`, `X-Frame-Options: DENY`, `Referrer-Policy: same-origin`; plus a later rule so the PDF keeps its Phase 3 `Cache-Control: no-store`. No full CSP.
- Messages: `dashboard.*` (57 keys) in all four locales; `dashboard.placeholder` removed; `messages/DRAFTS.md` rows added, row counts line updated (parity + provenance tests green).
- Plan checklist for Phase 4 ticked in `IMPLEMENTATION_PLAN.md`.

## Definition-of-done evidence (raw output from this session; Postgres 16 local, fresh DB migrated from scratch by verify.sh)

**verify.sh on code tip bc64f23:**
```
--- commit state
current HEAD               bc64f23  (2026-10-14T15:07:34+00:00)
branch                     phase-4-dashboard
comparing against          32bce16
uncommitted changes        0 file(s)
--- secrets          secrets none found / .env.example present
--- database         fresh database verify_…  db:migrate ok (from scratch)  tables created 16
--- lint ok   --- typecheck ok
--- tests
 Test Files  23 passed (23)
      Tests  325 passed (325)
test exit code             0
counts                     total=325 pass=325 fail=0 skip=0
--- build ok / standalone output present / smoke ok   (smoke: PASS)
--- invariants
migration drift            schema unchanged
tenant isolation           all tenant tables carry company_id
legal citations            none outside lib/content/
forbidden claims           none
geo                        CF-IPCountry only
urls                       no locale codes in paths
request company_id         never read from the request
KNOWN_ISSUES.md            present
verify.sh: PASS (HEAD bc64f23)
```
Baseline was 276 tests; +49 new (`tests/dashboard-*.test.ts*`). KNOWN_ISSUES.md is empty and still is.

**Cross-tenant test per dashboard route** — `tests/dashboard-routes.test.tsx`: two seeded, onboarded companies (A "Alfa Ltda", B "Beta Segredo S.A.", with distinct documents, payments R$ 123,45 / R$ 987,65, employees, open/closed whistleblower reports). The pages are rendered *inside the real dashboard layout* with real `requireTenant` and real queries on Postgres; the only mock is the JWT→`{userId, companyId}` lookup (a live request is needed for that; the smoke covers it with real cookies). For each of the 8 pages (`describe.each`): no session → `REDIRECT /login`; not onboarded → `REDIRECT /onboarding`; A's HTML never contains B's name, user email, document ids, payment amount, employee names or tracking codes, and does contain the nav; HTML is pt-BR. Plus: documents list/view (A gets 404/`NOT_FOUND` for B's document id and for malformed ids, and vice versa), PDF route (own 200, other tenant 404, no session 401, not onboarded 403), `settings/save` and `regenerate` (401/403, a posted `companyId` is ignored, only the session's company changes), overview counts (A: 1 employee / 0 open cases; B: 3 / 2, closed excluded).
The tests have teeth — mutations I applied and reverted:
```
billing query without its company filter     -> FAIL ... billing page > renders for company A ... never shows company B's ... ; billing page > shows the session company's payments   (2 failed | 39 passed)
documents list without its company filter    -> 7 failed (documents page x2, documents pages x2, PDF route, settings/save, regenerate)
```
**requireTenant coverage** — `tests/dashboard-gate.test.ts` (5 tests): every `page.tsx`/`route.ts` under `app/(app)/dashboard` and under `app/api/documents` calls `requireTenant()`/`requireTenantRoute()`; the scan is asserted non-vacuous (it must find exactly the 11 expected entry points: 8 sections' pages, `documents/[id]`, `[id]/pdf`, `settings/save`); no dashboard file mentions `getTenant`; the predicate rejects a file without the call.

**verify.sh invariant 4h** (greps `app/` for `company_id` read from `formData`/`searchParams`/`params`/body/`.get("company_id")`, and for a `[companyId]` path segment) — catching deliberately bad code, then clean (block run in isolation, bad files created then deleted):
```
### bad line: form.get("companyId")
app/api/zz-bad/route.ts:3:  const cid = form.get("companyId");
request company_id         FAIL: company_id read from the request under app/ — take it from the session (requireTenant)
### bad line: searchParams.get("company_id")            -> same FAIL
### bad: companyId from route params (const { companyId } = await ctx.params)  -> same FAIL
### bad: a [companyId] path segment (app/(app)/dashboard/[companyId])          -> same FAIL
### clean tree
request company_id         never read from the request
```
It is a same-line heuristic (a value laundered through an intermediate variable on another line would slip past it); the behavioural proof is the tests above, which post a foreign `companyId` and assert it is ignored.

**Live security headers** (standalone build, signed-in session, raw `curl -D -`; also asserted for 5 URLs by the smoke):
```
GET /dashboard                     200  Cache-Control: private, no-store | CSP: frame-ancestors 'none' | X-Frame-Options: DENY | Referrer-Policy: same-origin
GET /onboarding                    200  (same four)
GET /login (anonymous)             200  (same four)
GET /dashboard/documents/<id>/pdf  200  Cache-Control: no-store (unchanged from phase 3) + the other three
GET /dashboard (no session)        307  location: /login
```
(First smoke run caught my own regression here: the config's `private, no-store` replaced the PDF route's `no-store`; fixed with the later rule.)

**Rename audit trail** — `tests/dashboard-audit.test.tsx`: onboarded company "Nome Antigo Ltda" → Settings save through the real route handler (new name + real logo PNG) → nothing regenerated (still 6 docs) → v1 `<article>` and v1 **PDF text** (pdfjs extraction) contain the old name and not the new one → explicit regenerate → v2 `<article>` and PDF contain the new name and not the old → v1 still old. The web view already read `content` (the snapshot), not the live company: no fix needed there. The shell *header* shows the live name by design (chrome, not document), so the test and smoke compare the `<article>` only.

**Smoke** (`scripts/smoke.sh`, real standalone server, real session cookies, 2 companies), the Phase 4 lines (full list in the run output; 151 ok lines in total):
```
ok    dashboard/{overview,documents,employees,training,whistleblower,vendors,billing,settings}: signed in -> 200 with the main nav and all eight section links
ok    …: marks itself aria-current="page"                       (x8)
ok    …: no session -> redirect to /login                       (x8)
ok    …: company 2 never sees company 1's name, payment or document id   (x8)
ok    …: company 1 never sees company 2's name or payment       (x8)
ok    billing: each company sees its own payment, formatted pt-BR
ok    headers on /dashboard, /dashboard/settings, /dashboard/documents, /onboarding, /login: private no-store, frame-ancestors 'none', X-Frame-Options DENY, Referrer-Policy same-origin
ok    PDF keeps its own Cache-Control: no-store
ok    settings: no session -> 401 / SVG-as-PNG -> error=logo, nothing changed / save -> 303 ?saved=1
ok    settings: DB has the new name, industry and a new logo file
ok    settings: onboarding_completed_at is intact
ok    settings: company 2 untouched by the posted company id
ok    settings: saving regenerated nothing (still 12 documents)
ok    settings: old logo file is kept on disk
ok    settings: page shows the new logo and the not-regenerated notice linking to Documents
ok    audit trail: v1 document view still carries the name it was generated with
ok    sign-out form carries a server action / sign-out action: 303 to /login / session cookie is cleared
ok    after sign-out: /dashboard redirects to /login
ok    after sign-out: a section and the PDF route are refused too
smoke: PASS
```
Sign-out is exercised through the real server action: the smoke parses the hidden `$ACTION_ID_…` fields out of the header form and submits them as a browser would.

**Screenshots** (`docs/phase4-samples/`, Chromium from `/opt/pw-browsers`, company "Construtora Horizonte Ltda" with a logo, created through the real fake-checkout → onboarding flow; I viewed every image):
`overview-1280`, `documents-1280`, `billing-1280`, `settings-1280`, `employees-1280`, and at 360 px `overview-360`, `settings-360`, `documents-360`, `billing-360`. What I saw: the active item is a dark filled pill and matches the page (also read back via `aria-current` in the browser: "Visão geral", "Documentos", "Cobrança", "Configurações", "Colaboradores"); sidebar at 1280, a 2-column nav grid above the content at 360; `document.scrollWidth == clientWidth` (no horizontal overflow) at 360 on all four mobile pages and at 1280 on all five; header shows logo + company name + admin email + "Sair" and wraps cleanly at 360; Overview shows "6 de 6 documentos gerados / 6 documentos em rascunho, pendentes de revisão", "Nenhum colaborador ainda", "Nenhuma denúncia em aberto", completion "—" with a note, binder card with a greyed-out disabled button + "Ainda não disponível."; Documents shows "RASCUNHO — pendente de revisão" next to every version; Employees empty state has a greyed disabled "Adicionar colaboradores"; Billing table is date / "R$ 249,00" / "Pago" (pt-BR formatting); Settings shows the current logo, read-only CNPJ, country, admin email. The file input reads "Choose File / No file chosen" because it is the headless browser's own locale.

## Judgment calls
1. **`requireTenantRoute()` alongside `requireTenant()`.** Notes say route handlers call `requireTenant`; a redirect is wrong for a PDF download or a form POST (a 307 re-POSTs to `/login`) and Phase 3 smoke asserts PDF-without-session = 401. So routes use a sibling in the same file that returns 401 / 403 (onboarding incomplete). Coverage test accepts either name.
2. **Incomplete onboarding is now refused on the document routes** (view → `/onboarding`, PDF/regenerate → 403). Previously a not-onboarded company got 404 for others' ids. A company without onboarding has no documents, so nothing legitimate changes; to keep the Phase 3 "company 2 gets 404" smoke checks meaningful (they tested isolation, and would now have been testing the gate) I added one smoke line making company 2 complete onboarding. This is the only edit to a pre-existing smoke step besides the next item.
3. **Existing smoke check "v1 is intact … ! grep 'Renamed Again'"** matched the whole page; the new shell header legitimately shows the live name, so it now matches the `<article>` only (same intent).
4. **Open whistleblower cases = status `new` or `under_review`, as scoped** — but the schema default status is `received` (Phase 2) and Phase 5 plans new/under review/closed. A row at the schema default would not be counted. I did not change the schema; Phase 5 must align the default (or the constant `OPEN_REPORT_STATUSES` in `lib/db/tenant.ts`).
5. Settings route is `POST /dashboard/settings/save` (inside the dashboard tree, so the coverage scan includes it automatically) rather than a server action — testable with plain `Request`s and curl. Regenerate stays at `/api/documents/regenerate` (existing contract) and is scanned by an extra directory entry in the gate test.
6. Mobile nav is a stacked grid, not a collapsible menu: no JS, works without hydration.
7. **"Documents" overview card counts the current version of each of the 6 types** ("6 de 6") and "draft" is read from each document's own `reviewStatus`. Billing status is always "Pago" (a `billing_records` row exists only for a settled payment); unknown `subscription_status` values are shown raw. Settings labels the tax-ID field "CNPJ / identificação fiscal" in pt-BR for all countries' rows (only BR is enabled).
8. Copy: neutral "Dossiê" for the binder (CONTENT.md has "binder" only in en/es; the Brazilian term is mine → flagged below), "Conclusão" for completion, "Canal de denúncias" for the Whistleblower nav label. es-AR and es-MX share wording except the admin-email label. All `dashboard.*` strings are in `messages/DRAFTS.md` for Esteban's review. No string claims or implies compliance, adequacy or certification (forbidden-claims invariant green; empty states describe what will be listed, not what it achieves).
9. `Cache-Control: private, no-store` is applied by config to `/dashboard/**`, `/onboarding` and `/login` (login included per notes); the PDF overrides to `no-store` (also uncacheable).
10. Logo `<img>` uses a plain `<img>` with an eslint-disable comment (our own `/uploads` route; `next/image` optimisation is unnecessary and adds config).

## Not done (out of scope per SUPERVISOR_NOTES)
Employee/training/whistleblower/vendor functionality (phases 5-7, sections are empty states), binder (phase 8; Overview card is a disabled placeholder), cancel/manage-subscription, multi-admin, notifications, editing document text, changing country or tax ID, charts. Old logo files are never deleted (disk grows by one file per logo change; no cleanup job).

## Findings / risks to look at
- **Sign-out does not invalidate the session server-side.** Sessions are Auth.js JWTs (Phase 2 decision). The sign-out action clears the cookie and the browser is logged out (smoke asserts it), but I verified by hand that replaying the *old* JWT value in a `Cookie` header after sign-out still returns 200 on `/dashboard` until it expires (7 days). Fixing it needs DB sessions or a revocation list — an architectural change I did not make. Relevant for whistleblower data on shared computers/stolen cookies; your call whether to schedule it (Esteban-visible risk: security).
- One unexplained flake: the very first `./verify.sh` run (before the PDF-header fix, with the new tests) printed `Errors  1 error` in the vitest summary (all 324 tests passed but the run exited 1). I could not reproduce it in about 16 further full-suite runs on fresh databases (also under build load) and the final verify is clean. The summary tail did not capture the message. Watch CI.
- Settings → logo: a PNG that decodes badly is still accepted by magic-byte sniff (Phase 3 behaviour, PDF degrades gracefully) — unchanged.

## Open questions (for Esteban / lawyer)
1. **Billing — cancel / manage / invoices:** the page deliberately offers none. What should it offer (cancel flow? who to contact? Mercado Pago customer portal? invoice/NFS-e issuance?) — depends on billing terms (monthly vs annual, refunds), which are open inputs in CLAUDE.md §11.
2. Copy I was unsure of: "Dossiê" (binder), "Conclusão" (completion — avoid reading as "program completion"), "Canal de denúncias" as a nav label for the Whistleblower section, and the sentence "Exibida quando houver registros de colaboradores" under the empty completion value.
3. Should the dashboard show the subscription's renewal date / plan name? There is no field for it today (`subscription_status` only).

## Verification notes for the supervisor
- CI: PR #5 check `verify` (run 38586869716) completed `success` on head fe73828 (same tree as code tip bc64f23 plus this file).
