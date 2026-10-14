# Supervisor notes — worker task: Phase 4 (customer dashboard shell)

Overwrite each time — a relay, not a log. Only one relay at a time. Read this at the start of
your session before anything else.

---

## If this is a WORKER task

### Context
Phases 0-3 are merged. Phase 4 turns the stub `/dashboard` into a real app shell: navigation,
the eight sections of SPEC §6, the phase 3 document pages inside it, Settings and Billing. Phases
5-7 will fill in Whistleblower, Employees/Training and Vendors, so those sections ship now as
honest empty states. This is mostly UI, but it is an **authenticated, multi-tenant surface**:
tenant isolation (CLAUDE.md §8) is the thing to get exactly right.

Read first: `CLAUDE.md` (§0, §6 — standing tenant checklist — §8, §9), the **Phase 4** section of
`IMPLEMENTATION_PLAN.md` (rewritten; it is the checklist), `SPEC.md` §6, `KNOWN_ISSUES.md`. Existing
code to build on: `app/(app)/`, `lib/auth/tenant.ts` (`getTenant`), `lib/db/tenant.ts`,
`lib/documents/store.ts`, `components/DocumentView.tsx`, `lib/i18n.ts`, `lib/uploads.ts`.
Branch `phase-4-dashboard` from current `main`; PR to `main`; don't merge; don't push to `main`.

**Out of scope — log under "Not done":** any employee, training, whistleblower or vendor
functionality (phases 5-7), the binder (phase 8), cancel/manage-subscription flows, multi-admin,
notifications, editing document text, changing country or tax ID, charts.

### Decisions already made (record deviations as judgment calls)
**Gate**
- `requireTenant()` (in `lib/auth/`): returns `{tenant, company, locale, t}`; redirects to `/login`
  without a valid session and to `/onboarding` if `onboarding_completed_at` is null. **Every**
  `page.tsx` and `route.ts` under `app/(app)/dashboard` calls it itself — the layout may also use it
  for the shell, but Next does not re-run layouts on client navigation, so the layout is not a gate.
  Add a Vitest test that scans `app/(app)/dashboard/**` and fails if any page/route doesn't call it.
- The existing phase 3 document pages/routes are brought under the same helper (they currently call
  `getTenant`); behavior (404 for another tenant's ids, PDF headers) must not change.
- Language of the dashboard = the company's country locale (`COUNTRY_LOCALE`), not the cookie.
- **No `company_id` from the request, ever.** Add a verify.sh invariant (4h) that greps `app/` for
  `company_?id` being read from `formData`/`searchParams`/`params`/request body (heuristic is fine,
  keep it simple), and show it catching a deliberately bad line, then passing on the clean tree.

**Shell**
- Nested layout `app/(app)/dashboard/layout.tsx` with: header (company name, logo if any, admin email,
  sign-out), nav of the 8 sections (Overview, Documents, Employees, Training, Whistleblower, Vendors,
  Billing, Settings), active item marked with `aria-current="page"`, a skip-to-content link, `<nav>`/
  `<main>` landmarks. Responsive: works at 360 px (collapsible or stacked nav) and at desktop. Plain
  Tailwind, no component library, no new dependencies. Sign-out via an Auth.js server action
  (`signOut`) from a form button — test that the session is gone afterwards.
- Hardening for authenticated pages (dashboard + `/onboarding` + `/login`): `Cache-Control: private,
  no-store`, `Content-Security-Policy: frame-ancestors 'none'` (and `X-Frame-Options: DENY`),
  `Referrer-Policy: same-origin`, via `next.config` `headers()`; assert them in the smoke test. Do not
  add a full CSP (scripts/styles) in this phase.

**Sections**
- **Overview:** cards with real tenant-scoped counts where the tables already exist (documents: how many
  of the 6 exist and their review status; employees; open whistleblower cases = status `new` or
  `under_review`), completion % rendered as "—" (phase 6 defines it; implement as a function that
  returns `null` for now), binder card as a disabled placeholder. Plus links to the other sections.
- **Documents:** the phase 3 list/view/regenerate/PDF inside the shell; show the draft ("RASCUNHO")
  status next to each document.
- **Employees / Training / Whistleblower / Vendors:** empty states written for the finished product
  ("Nenhum colaborador ainda…"), with their primary action absent or visibly disabled. No fake data,
  no "coming soon" marketing.
- **Settings:** form for company name, industry (existing `INDUSTRIES`), logo (existing `saveLogo`,
  PNG/JPEG, same validation). Tax ID, country and admin email displayed read-only. New
  `updateCompanySettings` in `lib/db/tenant.ts` — do **not** reuse `updateCompanyProfile` (it resets
  `onboarding_completed_at`). After saving, show a notice that documents are not regenerated
  automatically, linking to Documents. Keep old logo files on disk (no deletion).
- **Billing:** table from `getBillingRecords` for the session's company: date (`America/Sao_Paulo`),
  amount formatted with `Intl.NumberFormat` for the record's currency in the company's locale, status
  "Pago"; plus `subscription_status`. No invoices, no manage/cancel (billing terms are an open input
  for Esteban) — list that under open questions.
- All new UI strings in the four `messages/*.json` files + `messages/DRAFTS.md` rows (parity and
  provenance tests as before). Nothing may claim or imply compliance, adequacy or certification
  (CLAUDE.md §8) — including empty-state and overview copy ("seu programa está completo" style text is
  not allowed; describe what exists, not what it achieves).

**Audit-trail check:** the PDF already uses `mergeSnapshot.companyName`. Add a test proving that after
a Settings rename, the v1 document view **and** PDF still show the old name and a regenerated v2 shows
the new one. If the web view reads the live company name anywhere, fix it.

### Action items
Work the Phase 4 checklist top to bottom and tick it. Small logical commits. Then `./verify.sh`
on the final code commit, push, open the PR, wait for CI, write `HANDOFF.md`.

**`verify.sh` / smoke — permitted edits, only these:** (1) the 4h invariant above; (2) extend
`scripts/smoke.sh`: sign in, GET each of the eight sections → 200 and contains the nav; unauthenticated
GET of each → redirect to `/login`; a second company's session never sees the first company's name,
documents or billing amounts in any section's HTML; the security headers are present on a dashboard
page; Settings save changes the name/logo and leaves `onboarding_completed_at` intact; sign-out then
requesting a dashboard page redirects to `/login`.

### Definition of done
As in the Phase 4 section of `IMPLEMENTATION_PLAN.md`. Evidence I will look for: a cross-tenant test
**per dashboard route** (two seeded companies, assert company B's data — name, document titles/ids,
billing amounts — never appears in company A's responses, and A's session gets 404 for B's document
ids); the `requireTenant`-coverage test; the 4h invariant demo; headers asserted live; the rename audit
test; no new dependencies in `package.json` (or each justified).

**Screenshots I can look at:** with Chromium from `/opt/pw-browsers` (do not run `playwright install`),
capture Overview, Documents, Billing and Settings at 1280 px and one section at 360 px, for a
company with a logo; view them yourself; commit under `docs/phase4-samples/`. State in HANDOFF.md
what you saw (nav active state, empty states, no overflow at 360 px).

### Report back
`HANDOFF.md` per the template. Verification depth: real Postgres, real HTTP through the standalone
build with real session cookies (not mocked auth), and screenshots. Open questions to include: what the
Billing page should offer for cancel/manage (needs Esteban), and anything in the copy you were unsure
of. List every judgment call.

---

## If this is a VERIFICATION request

Not applicable for this relay.
