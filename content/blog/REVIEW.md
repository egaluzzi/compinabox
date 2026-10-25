# Blog articles — review sheet (Phase 9c)

All seven articles are `status: draft`. They carry a visible draft banner and `noindex`, and stay out of `sitemap.xml`. They use only facts from SPEC §7 and CONTENT.md §1–§6 (the only legal/product sources). Nothing here has been reviewed by a lawyer.

| File | Language | Status | Words (body) |
| :- | :- | :- | :- |
| pt-BR/lei-14133-o-que-muda-para-fornecedores.md | pt-BR | draft | 554 |
| pt-BR/lei-anticorrupcao-12846-pequenas-empresas.md | pt-BR | draft | 510 |
| pt-BR/canal-de-denuncias-fornecedores-multinacionais.md | pt-BR | draft | 512 |
| pt-BR/como-comprovar-compliance-licitacao-publica.md | pt-BR | draft | 508 |
| en/what-us-and-european-companies-require-from-latin-american-suppliers.md | en | draft | 537 |
| en/doj-compliance-program-guidelines-for-non-us-suppliers.md | en | draft | 550 |
| en/whistleblower-channels-what-multinational-buyers-expect.md | en | draft | 531 |

(Approximate counts; `tests/blog.test.ts` enforces 450–900.)

## Every legal or factual statement, and its source

**Lei 14.133 (article 1, and one sentence each in articles 3 and 4).**
- "A Lei 14.133/2021 passou a exigir programas de integridade robustos para elegibilidade em licitações públicas, incluindo canal de denúncias e liderança comprometida com a ética" — CONTENT.md §3 ("O mínimo exigido por lei"); SPEC §7 (Brazil). Always attributed ("é assim que este site resume o tema") and followed by: the scope depends on the edital/contract; ask a lawyer.
- "Nova Lei de Licitações" — CONTENT.md §3; SPEC §7 ("new public tenders law").
- Nothing about which contracts, thresholds, dates or penalties is stated. **This is the open question in CLAUDE.md §11.** If the lawyer says the requirement is narrower, articles 1, 3 and 4 need rewording.

**Lei 12.846/2013 (article 2; one sentence in article 5).**
- "Usa a existência de um programa efetivo como atenuante em caso de apuração de responsabilidade" — CONTENT.md §3; SPEC §7 ("Clean Company Act"). Article 5 repeats it in English as a Brazil example.
- The name "Lei Anticorrupção" — CONTENT.md §3.

**Multinational buyers (articles 2, 3, 5, 7).**
- US and European multinationals ask Brazilian/Latin American suppliers for programs even outside tenders — CONTENT.md §1 and §3; SPEC §7 cross-cutting.
- Neither tenders nor multinationals care about company size; both want documentation — CONTENT.md §1.

**Typical documents** (code of conduct; policies on bribery, gifts, conflicts of interest, public officials; whistleblower channel; training with proof; record of acceptances; sanctions screening) — CONTENT.md §1 "What you get"; SPEC §5. Presented as "what buyers and auditors commonly ask for", never as a legal list.

**Whistleblower channel details** (anonymous by default, optional contact details, categories corruption/bribery, conflict of interest, fraud, harassment, other; tracking code; commitment to review) — CONTENT.md §5.

**LGPD (article 3)** — named only, as Brazil's data-protection law; no article, no obligation stated (CONTENT.md §3 FAQ mentions it). The advice that reports can contain personal data and to ask a lawyer about retention/access is the worker's own caution, not a legal fact.

**DOJ (article 6 only).**
- Themes: third-party due diligence, ongoing monitoring, documented recordkeeping tying training / hotline usage / certifications together — SPEC §7. "Certifications" is written as "signed acknowledgments" so the articles contain no "certif…" at all; please confirm the paraphrase is faithful.
- Framed as "an overview of publicly known themes, not a summary of the document's text".
- US/EU buyers' expectations are shaped by it — SPEC §7 ("driven by US/EU buyer expectations"); "a buyer may turn them into questions for you" is the worker's inference.

**Scope boundaries stated** (not a risk assessment, sanctions screening is a filter not an investigation, no audit, no legal opinion) — SPEC §2.

## Statements I was least sure of (please check)
1. Articles 1/4: the wording of the Lei 14.133 requirement and the "depends on each edital" caveat.
2. Article 6: "The guidance is about how a US authority looks at companies' own programs. It is not a rulebook for suppliers in other countries" — my description of the document's nature, not in SPEC.
3. Article 6: "ongoing monitoring … reminders, refreshed training, new employees receiving the rules" — my illustration of the theme.
4. Article 2: "efetivo … um documento guardado numa gaveta dificilmente é o que a lei tem em mente" — interpretation, hedged.
5. Articles 3 and 7: "a good default is anonymous reports"; what to do when a report concerns the person running the channel (open input in CLAUDE.md §11); article 7 "Anonymity has limits" (Cloudflare sees IPs — open input).
6. Article 4: the note on what employee data is handed to third parties (binder REVIEW.md raises the same point).
7. Article 5: the Brazil sentence inside an English article about Latin America generally.

## Left out on purpose
Article numbers, decrees, thresholds, contract values, dates of entry into force, penalties, case law, statistics, named companies, third-party URLs, ISO standards, Argentina and Mexico laws, FCPA/UK Bribery Act and any other foreign statute.

## How to publish after review
1. Fix any wording the lawyer flags.
2. In the article's front matter set `status: published` and bump `updated`.
3. Deploy. The draft banner and `noindex` disappear; the article enters `sitemap.xml` (enabled countries only); the index becomes indexable once one article is published.
4. Keep the last line ("Isto é informação geral…" / "This is general information…").
