# Legal review list — Brazil (pt-BR)

One list for the reviewing lawyer. **Nothing here has been reviewed by a lawyer.** Every item was drafted by the
development team from SPEC.md §5/§7 and CONTENT.md §3 only (CLAUDE.md §9: "Documents are drafts until a lawyer reviews
them"). Brazil launch is blocked until each row below is reviewed (CLAUDE.md §11).

Each generated document stores a snapshot of the review status and of the legal references it was generated from, so a
correction made here affects only the next regeneration; customers regenerate to pick it up.

| # | Item | File | Version | Status |
| :- | :- | :- | :- | :- |
| 1 | Legal-basis content (laws, required/recommended elements, explainer, disclaimer) | `lib/content/br.ts` | — | DRAFT — needs legal review |
| 2 | Código de Conduta | `lib/documents/templates/pt-BR/code-of-conduct.ts` | 1 | DRAFT — needs legal review |
| 3 | Política Anticorrupção e Antissuborno | `lib/documents/templates/pt-BR/anti-bribery.ts` | 1 | DRAFT — needs legal review |
| 4 | Política de Brindes, Presentes e Hospitalidade | `lib/documents/templates/pt-BR/gifts-hospitality.ts` | 1 | DRAFT — needs legal review |
| 5 | Política de Conflito de Interesses | `lib/documents/templates/pt-BR/conflicts-of-interest.ts` | 1 | DRAFT — needs legal review |
| 6 | Política de Relacionamento com Terceiros e Agentes Públicos | `lib/documents/templates/pt-BR/third-party-public-officials.ts` | 1 | DRAFT — needs legal review |
| 7 | Política de Proteção ao Denunciante | `lib/documents/templates/pt-BR/whistleblower-protection.ts` | 1 | DRAFT — needs legal review |
| 8 | Shared wording: legal-context section, industry-notes heading, role phrase | `lib/documents/templates/pt-BR/shared.ts` | — | DRAFT — needs legal review |
| 9 | Per-industry notes (construction, health, finance) | inside templates 2, 3, 5, 6 (`industryNotes`) | 1 | DRAFT — needs legal review |

## How to correct something
- Wording of a document: edit the template file, bump its `version`, run the tests (`npm run test -- documents`), review the
  snapshot diff, and mark the row reviewed here (reviewer, date).
- Legal citations or the explainer: edit `lib/content/br.ts` only. The explainer and disclaimer must also equal the pt-BR
  marketing copy in `messages/pt-BR.json` (`landing.min`, `landing.minNote`); a test enforces that, so change both together.
- When a lawyer has signed off, set `reviewStatus` in `lib/content/br.ts` to `{ reviewer, date }`; documents generated
  afterwards carry that status instead of the draft notice.
- No template may contain a statute name or number: those are injected from `lib/content/br.ts` (verify.sh and a test check this).
