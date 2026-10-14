# Handoff — Phase 3: document engine + Brazil legal-content layer, 2026-10-14

Branch `phase-3-documents` (from `main`), PR to `main`, **not merged**. **Code tip: 401ce84** — `./verify.sh` ran on exactly this commit (exit 0). Commits after it add only `docs/phase3-samples/`, the plan checkboxes and this file.
Everything is a **DRAFT for lawyer review**; nothing here claims or implies compliance (see "For the lawyer").

## What was built
- `lib/content/{types,br,ar,mx,index}.ts` — typed `CountryLegalContent`; `br.ts` sourced only from SPEC §7 / CONTENT.md §3; `ar`/`mx` export typed `NotYetEnabled`.
- `lib/documents/` — `merge.ts` (tiny `{{field}}` interpolator, throws on unknown/empty/malformed), `generate.ts` (pure deterministic `generateDocument`), `templates/pt-BR/*` (6 templates as data, keyed by locale), `store.ts` (versioning, locking, idempotent initial creation, tenant reads), `pdf.tsx` (react-pdf), `REVIEW.md`.
- Migrations `0001` (locale, template_version, generated_by_user_id, unique `(company_id,type,version)`) and `0002` (append-only trigger: UPDATE/DELETE row trigger + TRUNCATE trigger).
- Onboarding (`/api/onboarding`): profile update + `ensureInitialDocuments` in ONE transaction; generation failure → whole request fails (500) and rolls back.
- Routes: `/dashboard/documents`, `/dashboard/documents/[id]`, `/dashboard/documents/[id]/pdf`, `POST /api/documents/regenerate` (type or `all`). Tenant from session only; foreign/odd ids → 404.
- Logos: WebP dropped from validation (`lib/uploads.ts`, tests, onboarding page `accept`, hint/error strings in 4 locales).
- UI strings `documents.*` in all four message files + `messages/DRAFTS.md` rows (parity/provenance tests green).
- `verify.sh` 4d and `scripts/smoke.sh` extended as permitted (diff below).
- Dependencies: `@react-pdf/renderer` 4.9.0 (exact pin; works with React 19.3 + Next 16.4 standalone build — proven by smoke through the real standalone server). Dev-only `pdfjs-dist` 4.10.38 (exact) for test-side PDF text extraction.

## Definition-of-done evidence
All raw output is from this session (Postgres 16 local, fresh DB migrated from scratch by verify.sh).

**verify.sh (code tip 401ce84):**
```
--- commit state
current HEAD               401ce84  (2026-10-14T13:26:06+00:00)
branch                     phase-3-documents
comparing against          5f3c01f
commits this pass          6
uncommitted changes        0 file(s)
test files changed          7 files changed, 7413 insertions(+), 3 deletions(-)
--- secrets
secrets                    none found
.env.example               present
--- database
fresh database             verify_1791984367_4399
db:migrate                 ok (from scratch)
tables created             16
--- lint
lint                       ok
--- typecheck
typecheck                  ok
--- tests
 Test Files  19 passed (19)
...
test exit code             0
counts                     total=276 pass=276 fail=0 skip=0
--- build
build                      ok
standalone output          present
--- smoke
ok    BR header -> redirect to /br
... (smoke lines for documents: see below) ...
ok    database: direct DELETE of a document is rejected (append-only trigger)
ok    simulator Fail -> attempt failed, nothing provisioned, status endpoint says failed
ok    ALLOW_FAKE_PAYMENTS unset: simulator page 404
ok    ALLOW_FAKE_PAYMENTS unset: simulator action 404
ok    ALLOW_FAKE_PAYMENTS unset: webhook endpoint 404
ok    ALLOW_FAKE_PAYMENTS unset: POST /api/checkout -> 503 unavailable
ok    ALLOW_FAKE_PAYMENTS unset: /checkout?c=br shows 'unavailable', no form
ok    PAYMENT_PROVIDER unset (default none): /checkout?c=br unavailable too
smoke: PASS (port 36883)
smoke                      ok
--- invariants
migration drift            schema changed, migration present
tenant isolation           all tenant tables carry company_id
legal citations            none outside lib/content/
forbidden claims           none
geo                        CF-IPCountry only
urls                       no locale codes in paths
KNOWN_ISSUES.md            present
--- result
verify.sh: PASS (HEAD 401ce84)
```
Tests: 19 files, 276 passed, 0 failed, 0 skipped (new files: `documents-engine` (80 incl. 60 snapshots), `documents-content`, `documents-store` (17, real Postgres), `documents-pdf` (8), `documents-routes` (10)).

**Smoke (documents part, real HTTP through the standalone build; all `ok`):**
```
ok    replayed webhook (new event, already paid) -> 200, no second company
ok    onboarding created the six documents, all version 1
ok    documents list -> 200 and links the code of conduct
```

**Snapshot tests per document per industry:** `tests/documents-engine.test.ts` → 6 types × 10 industries = 60 snapshots in `tests/__snapshots__/documents-engine.test.ts.snap`.
**DB trigger + unique version (real Postgres):** `documents-store.test.ts` — INSERT works; UPDATE, DELETE, TRUNCATE each rejected with "append-only"; duplicate `(company,type,version)` rejected. Also in smoke via `psql`.
**Concurrent regeneration:** 8 parallel `regenerateDocuments` after a rename → exactly one v2 per type, no duplicate versions; plus interleaved rename+regenerate test (versions stay 1..n unique); 5 parallel onboarding completions → exactly 6 documents. Mechanism: `SELECT … FROM companies WHERE id=$1 FOR UPDATE` inside the transaction (+ unique constraint backstop).
**Tenant 404:** `documents-store` (getDocument/list scoped), `documents-routes` (PDF route 404 for another company's id, malformed id, SQL-ish id; page `notFound()`; regenerate touches only session's company), smoke (second company's real session → 404 on view and PDF).
**Drift test:** `documents-content.test.ts` — `br.explainer === messages/pt-BR landing.min`, `br.disclaimer === landing.minNote`, each law summary is a verbatim substring of the explainer.
**No citation strings outside br.ts/messages:**
```
$ grep -rnE '12\.846|14\.133' app lib/documents ; echo exit=$?
exit=1            # no matches
$ grep -rlE '12\.846|14\.133' lib
lib/content/br.ts
```
(plus a test: template data contains no `Lei <n>`, `Art.`, `Decreto`, `LGPD`, …; REVIEW.md deliberately names no statute.)

**Forbidden-claims scan — diff and demo:**
```
-BANNED=$(grep -rniE '…|certif(ied|icado|icada) (by|por) (la )?ley' app messages lib/content 2>/dev/null | grep -viE '<negation exemption, untouched>' || true)
+BANNED=$(grep -rniE '…|certif(ied|icado|icada) (by|por) (la )?ley|em conformidade com a lei|atende (integralmente )?(a|às) exigências' app messages lib/content lib/documents 2>/dev/null | grep -viE '<negation exemption, untouched>' || true)
```
Demo (temporary file `lib/documents/zz_demo.ts`, removed afterwards; third line is negated and correctly exempt):
```
lib/documents/zz_demo.ts:1:  "Com este documento a empresa fica em conformidade com a lei.",
lib/documents/zz_demo.ts:2:  "O produto atende integralmente às exigências da licitação.",
forbidden claims           FAIL: copy implies guaranteed compliance or ISO certification
```
Clean tree: `forbidden claims           none`. A test also scans every generated document × industry for the same phrases + ISO 37301/37002 + "certificado/garante conformidade".

## PDF evidence (viewed by me; PNGs + PDFs in `docs/phase3-samples/`)
Files: `code-of-conduct-with-logo-p1-1.png`, `-p2-2.png` (3-page PDF, company "Construções Ação & João Ltda", construction, **with PNG logo**); `anti-bribery-no-logo-p1-1.png`, `-p2-2.png` (2-page PDF, "Saúde Integrada Ltda", health, **no logo**); the two `.pdf` files too.
What I saw: with-logo — teal logo block top-left of the header, company name bold, document title and orange "RASCUNHO — pendente de revisão" beside it; header repeats on page 2. No-logo — same header with the text starting at the left margin, no gap/placeholder. Accents ç ã é õ í ú render correctly everywhere ("Construções Ação & João", "Código", "Saúde", "Política", "licitações"). Footer on every page: "Versão 1 · Gerado em 14/10/2026" left, **"Página X de Y"** right (1 de 3, 2 de 3; 1 de 2, 2 de 2), then the fixed disclaimer (existing `footer.disclaimer`, 2 lines, not clipped). Headings never stranded at a page bottom; no overflow or clipped text. Last section "Contexto legal" shows citations injected from `br.ts` + explainer + "Isto é informação geral, não aconselhamento jurídico.". Observation: industry labels are capitalised mid-sentence ("No setor de Saúde") because the merge field uses the message label as-is (cosmetic; see judgment calls).
Text extracted from the PDF by `pdftotext -layout` (and by pdfjs in the tests): 
```
                Construções Ação & João Ltda
                Código de Conduta
                RASCUNHO — pendente de revisão
...
Versão 1 · Gerado em 14/10/2026                                                  Página 1 de 3
A ComplyStart fornece os componentes documentados … não garante a conformidade com nenhuma lei ou auditoria específica.
```
Tests (`documents-pdf`, `documents-routes`): company name + ç ã é õ + "Página i de N" on every page + version/date + disclaimer + draft notice; logo PNG and JPEG embedded (`/Subtype /Image` present), absent without logo; corrupt/truncated/stub/WebP-as-png/missing logo → `loadLogo` returns nothing, logs once, PDF still renders (also proven in smoke with the Phase 2 stub-PNG logo: PDF 200, exactly one log line); route headers `application/pdf`, `attachment; filename="[a-z0-9-]+-v1.pdf"`, `no-store`.
Two react-pdf quirks found and worked around (documented in `pdf.tsx`): a `lineHeight` inherited by the footer silently drops the `render` page-number text, and `lineHeight` is a multiple of the node's own fontSize (each node sets both).

## Template overview (word counts = all paragraphs, for industry "other" / with industry notes)
| Document | Purpose | Sections (ids) | Words |
| :- | :- | :- | :- |
| Código de Conduta (`code_of_conduct`) | Core rules: SPEC §5.1 clauses + leadership commitment + generic "how to raise a concern" | purpose, leadership-commitment, scope, anti-bribery, gifts-hospitality, conflicts, public-officials, confidentiality, raise-concern, consequences, [industry-notes], legal-context, review | 789 / 859 (construction) |
| Política Anticorrupção e Antissuborno | Defines/prohibits bribery, red flags, roles | purpose, scope, definitions, rules (6), red-flags, responsibilities, reporting, consequences, [industry-notes], legal-context | 523 / 563 |
| Política de Brindes, Presentes e Hospitalidade | When gifts/hospitality may be given/received | purpose, scope, principles, never, public-officials, receiving, record, consequences, legal-context | 451 (no industry notes) |
| Política de Conflito de Interesses | Identify, disclose, handle conflicts | purpose, scope, definition, duty, assessment, relatives, consequences, [industry-notes], legal-context | 425 / 454 |
| Política de Relacionamento com Terceiros e Agentes Públicos | Dealings with public officials, tenders, third-party vetting | purpose, scope, public-officials, tenders, third-parties, monitoring, red-flags, consequences, [industry-notes], legal-context | 498 / 536 |
| Política de Proteção ao Denunciante | Written protection policy separate from the channel (SPEC §5.2) | purpose, scope, good-faith, channels, anonymity, non-retaliation, handling, responsibilities, legal-context | 511 (no industry notes) |
Industry notes exist for construction, health, finance only (in code of conduct, anti-bribery, conflicts, third-party). Roles are referred to as "o responsável pelo programa de integridade designado pela Administração" (no blanks).

## For the lawyer
**Assumptions I made:** (1) The two laws and what they do are exactly SPEC §7 / CONTENT.md §3 wording; I added nothing. (2) "Required elements" for Brazil = the two SPEC names (whistleblowing channel, senior-leadership commitment); "recommended" = third-party due diligence/monitoring and documented recordkeeping, taken from SPEC's cross-cutting DOJ paragraph (not law). (3) Generic good-practice rules (no cash gifts, pre-approval for gifts to public officials, no facilitation payments, non-retaliation, anonymity allowed, conflict disclosure in writing) are drafted from common practice, not from a statute. (4) Documents are written as the company's own internal rules, in the second/third person, by "a Administração". (5) No numeric thresholds (gift value, response deadlines) — left to the Administração on purpose.
**Statements I was least sure of:** "Pagamentos para agilizar … atos de rotina de agentes públicos não são permitidos" (blanket ban on facilitation payments); the whistleblower policy's promises on anonymity/confidentiality and "a empresa não buscará descobrir a identidade" (must match what the channel actually does in phase 5, and data-protection duties); the disciplinary language ("desligamento", communication to authorities) vs. Brazilian labour-law constraints; "Dependendo do caso, os fatos também podem ser comunicados às autoridades"; the "dever de confidencialidade continua depois que a relação de trabalho termina"; industry notes (construction/health/finance) were written without sector-specific regulation on purpose; the "Contexto legal" wording "A legislação aplicável inclui …".
**Suggested additions I deliberately did NOT add (no citations were added):** specific article numbers of the Clean Company Act and its regulating decree (integrity-program parameters); statute and regulation on whistleblower channels/protection; data-protection law references for the channel; sector rules for construction/health/finance; guidance on gift value limits for public agents; labour-law basis for disciplinary measures. Also consider whether "Política" documents need approval/publication language by the governing body.
Everything is listed in `lib/documents/REVIEW.md` (9 rows, all DRAFT). `br.ts` `reviewStatus: "draft"`; each stored document snapshots it.

## Judgment calls
1. **Draft status inside the document**: `StructuredDocument` has an extra `reviewStatus` field (draft snapshot) beyond the notes' shape, so web view/PDF show "RASCUNHO — pendente de revisão" (existing `legal.draft` string) per CLAUDE §9.
2. **Locale-specific text lives in templates, not the engine**: the legal-context section is a template "slot" (`intro` with `{{laws}}`, `closing`), so the engine contains no Portuguese; `{{laws}}` is joined with `Intl.ListFormat`. `{{laws}}` is a fourth, section-local merge field (only in that slot).
3. **Role phrase** is a constant in `templates/pt-BR/shared.ts` with preposition-contracted variants (do/ao/pelo) rather than a merge field, to keep the three specified fields only.
4. **Locking** = `FOR UPDATE` on the company row (works when a company has no documents yet) rather than locking document rows; unique constraint is the backstop.
5. **Legacy `.webp` uploads are still served** (nothing in Phase 2 prod yet, harmless) but never accepted; PDFs reject them (no logo).
6. **Logo validation for PDF** is a structural check (PNG chunk walk to IEND; JPEG EOI marker) done before react-pdf, plus a try/catch fallback in the renderer; failures log once and render without a logo.
7. **Re-submitting onboarding** (rename) does not regenerate documents (idempotent "has the six" rule); the customer uses Regenerate. Smoke covers this.
8. **Regenerate** redirects (303) back to the list with `?regenerated=created|unchanged` instead of returning JSON; fails (redirect with `?error=1`) if onboarding is incomplete or generation throws.
9. **Dates** in PDF/UI use `America/Sao_Paulo`, pt-BR format.
10. **Snapshots**: 60 full-document snapshots (≈370 KB file) — big but it is the review artefact the notes asked for; reviewers can diff wording changes.
11. Industry label inserted as-is (capital letter mid-sentence, e.g. "Saúde"); not lower-casing because labels such as "Construção e engenharia" would then need per-label grammar. Lawyer/Esteban may want a lower-case variant.
12. Tests run from `TEST_DATABASE_URL`; the DB-backed TRUNCATE test truncates `documents, acknowledgments` (FK requires both) — it only ever runs against the scratch test DB.

## Not done (out of scope per notes)
Dashboard shell/nav (phase 4); customer text editing (v1 = regenerate only); training/acknowledgment (phase 6); whistleblower channel URL in documents (phase 5 regenerates); binder (phase 8); AR/MX content; any new citation. Documents UI is minimal and unstyled by design.

## KNOWN_ISSUES.md
No new entries; none needed (no tolerated failures).

## CI
GitHub Actions `verify` on PR #4, head eec8bcd: **success** (run 38572045125, 13:28:19–13:29:50Z). No review comments at the time of writing.
