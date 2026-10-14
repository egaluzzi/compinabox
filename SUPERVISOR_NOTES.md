# Supervisor notes — worker task: Phase 3 (document engine + Brazil legal-content layer)

Overwrite each time — a relay, not a log. Only one relay at a time. Read this at the start of
your session before anything else.

---

## If this is a WORKER task

### Context
Phases 0-2 are merged. Phase 3 builds the engine that generates the customer's code of conduct
and five policies, stores them versioned, and renders them as a web view and PDF. These documents
are the product and they are **legal-adjacent: you are drafting, not giving legal advice, and a
Brazilian lawyer will review everything before launch.** Design for review and correction, and
never state or imply that a document makes anyone compliant.

Read first: `CLAUDE.md` (§0, §8 — the guardrails matter a lot this phase — and §9), the **Phase 3**
section of `IMPLEMENTATION_PLAN.md` (rewritten for this; it is the checklist), `SPEC.md` §5.1, §5.2,
§7, `CONTENT.md` §3 and the pt-BR `legal-basis` copy in `messages/pt-BR.json`, `KNOWN_ISSUES.md`.
Branch `phase-3-documents` from current `main`; PR to `main`; don't merge; don't push to `main`.

**Out of scope — log under "Not done":** the dashboard shell/nav (phase 4), customer text editing of
documents (v1 = regenerate only), training/acknowledgment (phase 6), the whistleblower channel URL
in documents (phase 5 will regenerate), the binder (phase 8), AR/MX content, any citation not
already in SPEC.md/CONTENT.md.

### Guardrails for this phase (a violation means stop and write "blocked")
- **No invented law.** `br.ts` content comes only from SPEC §7 and CONTENT.md §3 / the pt-BR
  messages. Do **not** add article numbers, decree numbers, other statutes or case law even if you
  know them. Put suggested additions in HANDOFF.md under "For the lawyer".
- **No compliance claims.** Neither templates nor UI may say or imply that the document or the
  product makes a company compliant, adequate, certified or "in conformity with" a law, and no ISO
  37301/37002 mentions. Legal-basis sections cite the laws as *context* ("a legislação aplicável
  inclui ..."), with the disclaimer "Isto é informação geral, não aconselhamento jurídico."
- No legal citation string in any template or `.tsx`: references are injected from `br.ts`.
  `lib/documents/**` contains no statute names/numbers (verify.sh 4c scans it).

### Decisions already made (record deviations as judgment calls)
**Content layer**
- `lib/content/br.ts`: typed `CountryLegalContent` = `{country, locale, laws[{id, shortName,
  officialName, citation, summary}], requiredElements[], recommendedElements[], explainer,
  disclaimer, reviewStatus: "draft" | {reviewer, date}}`. `ar.ts`/`mx.ts` export a typed
  `NotYetEnabled`; the engine returns a typed error for them. A test asserts `br.ts`'s explainer text
  equals the pt-BR legal-basis copy in `messages/pt-BR.json` (stop the two copies drifting); the
  marketing page keeps reading the messages.
- Because `br.ts` changes when the lawyer corrects it, generated documents **snapshot the legal
  references they used** inside their stored content; a later `br.ts` correction affects only the
  next regeneration.

**Engine (`lib/documents/`)**
- Pure, deterministic `generateDocument({type, locale, country, company:{name, industry}}) →
  StructuredDocument` = `{templateVersion, locale, type, title, sections[{id, heading,
  paragraphs[]}], legalReferences[], mergeSnapshot}`. No timestamps or randomness in the content (so
  "unchanged inputs" is detectable by comparing content). Stored as JSON text in `documents.content`.
- Merge fields: `{{companyName}}`, `{{industry}}` (the pt-BR label), `{{country}}`. Tiny
  interpolator, no `eval`/template-engine dependency; an unknown or missing field **throws**
  (test it); output is plain text (the React/PDF renderers escape).
- Templates are data (`lib/documents/templates/pt-BR/<type>.ts`), keyed by locale so es-AR/es-MX can
  be added later without touching the engine. Types: `code_of_conduct`, `policy:anti_bribery`,
  `policy:gifts_hospitality`, `policy:conflicts_of_interest`, `policy:third_party_public_officials`,
  `policy:whistleblower_protection`.
- Code of conduct clauses per SPEC §5.1 (anti-bribery, gifts & hospitality, conflicts of interest,
  dealing with public officials, confidentiality) plus a leadership-commitment statement (SPEC §7
  Brazil: senior leadership commitment) and a "how to raise a concern" section that refers to the
  company's reporting channel **generically** (no URL yet). Policies SPEC §5.2. Refer to roles
  ("o responsável pelo programa de integridade designado pela Administração"), not blank
  placeholders. Optional per-industry notes for a few industries (e.g. construction, health,
  finance); the others get none. Plain, direct pt-BR; short paragraphs; no legalese you can't back.
- `lib/documents/REVIEW.md`: a table of every template and `br.ts` with `status: DRAFT — needs legal
  review`, so a lawyer has one list to work from.

**Storage and versioning**
- Table `documents` exists. Add `locale`, `template_version`, `generated_by_user_id` (nullable), and a
  **unique `(company_id, type, version)`**; a new migration (commit it; `verify.sh` drift check).
  Next version = max+1 computed inside a transaction with the company's documents locked (or retry on
  unique violation); concurrent regenerations must not produce duplicate versions (test).
- **Append-only in the database:** a trigger in the migration (raw SQL via drizzle-kit custom
  migration) raises on UPDATE and DELETE of `documents`. Test that both fail and that INSERT works.
  (Any future erasure is a deliberate migration — escalation rule 3.)
- Regenerating when the rendered content equals the latest version's content = no-op, returns the
  latest version, creates nothing.

**When documents are created**
- At **onboarding completion**, in the same transaction as the profile update (`/api/onboarding`),
  idempotent (does nothing if the company already has the six). Not at payment time: industry is
  unknown then. If generation throws, onboarding must fail loudly and roll back — never leave a
  completed profile without documents silently.
- Regenerate (manual): `POST /api/documents/regenerate` for one type or all; uses the company's
  current name/industry.

**Routes** (minimal; phase 4 adds the shell): `/dashboard/documents` (per type, list versions),
`/dashboard/documents/[id]` (web view), `/dashboard/documents/[id]/pdf` (download). Tenant from the
session only; another company's document id → 404 (not 403). UI strings in all four message files
(parity test + `messages/DRAFTS.md` rows as in earlier phases); the document body itself is pt-BR only.

**PDF**
- `@react-pdf/renderer` (pin exact version; confirm it works with the repo's React 19 and Next 16
  standalone build — if it genuinely can't, write "blocked" with the evidence; Puppeteer is a flagged
  fallback that needs the supervisor's decision). A4; built-in fonts (no network font fetch);
  header with company logo if present, title, company name; footer with "Página X de Y", version,
  generation date and the fixed disclaimer ("Isto é informação geral, não aconselhamento jurídico" and
  the pt-BR footer disclaimer already in the messages — reuse, don't rewrite).
- **Logos are PNG/JPEG only.** react-pdf cannot embed WebP, so drop WebP from the Phase 2 upload
  validation (update `lib/uploads.ts`, its tests, any UI string that lists formats). If a stored logo
  can't be loaded at render time, render without it and log once — a PDF must never fail because of a logo.
- Route handler streams the PDF with `Content-Type: application/pdf`, `Content-Disposition:
  attachment` with an ASCII-safe filename, `Cache-Control: no-store`.

### Action items
Work the Phase 3 checklist top to bottom and tick it. Small logical commits. Then run `./verify.sh`
on the final code commit, push, open the PR, wait for CI, write `HANDOFF.md`.

**`verify.sh` / smoke — permitted edits, only these:**
1. Forbidden-claims scan: also scan `lib/documents`, and add a pt-BR pattern for
   `em conformidade com a lei` / `atende (integralmente )?(a|às) exigências` (keep the existing
   negation-with-word-boundary exemption intact). Show the diff and one flagged-line demo.
2. `scripts/smoke.sh`: extend the live flow — after onboarding: six documents exist; list and view
   return 200; PDF download is `%PDF` with the right headers; a second company's session gets 404 for
   the first company's document id; regenerate with a changed company name creates v2 while v1 stays
   readable and unchanged; direct SQL `UPDATE`/`DELETE` on `documents` fails.

### Definition of done
As in the Phase 3 section of `IMPLEMENTATION_PLAN.md`. Hand me evidence, not assurance, for:
snapshot tests per document per industry; the DB trigger and unique-version tests (real Postgres);
concurrent regeneration test; tenant 404 test; the drift test between `br.ts` and the messages; the
grep output proving no citation strings outside `br.ts`/messages; the forbidden-claims scan demo.

**PDF evidence I can look at:** render page 1 and one later page of the code of conduct and of one
policy with `pdftoppm` (or equivalent), **view them yourself**, and commit the PNGs under
`docs/phase3-samples/`. In HANDOFF.md state concretely what you saw (logo present/absent, accents
ç ã é õ rendered, "Página X de Y", footer disclaimer, no overflow/clipped text). Also include text
extracted from the PDF (a dev-only extraction tool in tests is fine) proving the company name and
accented text are in it. Test a company with a logo and one without.

### Report back
`HANDOFF.md` per the template. Verification depth: real Postgres (migrated from scratch), real HTTP
through the standalone build, and PDF checked by extraction + rendered images. Add a section
**"For the lawyer"** (what you assumed, which statements you were least sure of, suggested
additional citations you deliberately did not add) and **"Template overview"** (per document: purpose,
sections, word count). List every judgment call.

---

## If this is a VERIFICATION request

Not applicable for this relay.
