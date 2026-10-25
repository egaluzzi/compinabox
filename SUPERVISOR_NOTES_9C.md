# Supervisor notes — worker task: Phase 9c (blog seeding) — PARALLEL task

This is a **second, parallel relay**: another worker is doing Phase 9 (staging deploy) from
`SUPERVISOR_NOTES.md` at the same time. To avoid collisions: read **this** file (not
`SUPERVISOR_NOTES.md`), write your report to **`HANDOFF_9C.md`** (not `HANDOFF.md`), work on branch
`phase-9c-blog` from current `main`, open a PR to `main`, don't merge, don't push to `main`. Don't touch
`SUPERVISOR_NOTES.md`, `HANDOFF.md`, `ops/`, `.github/workflows/deploy.yml`, `lib/legal`, tracking or
environment code — that is the other worker's territory.

---

## If this is a WORKER task

### Context
Phases 0-8 are merged. Phase 9c seeds the SEO blog (SPEC §9: "primary organic acquisition channel";
CONTENT.md §6 lists the topics): **4 Brazil articles (pt-BR) and 3 English generic articles**. The
articles are **drafts for review**: they discuss laws, so they must stay inside the facts the project
already has, be cautious, and be easy for a lawyer to check.

Read first: `CLAUDE.md` (§0, §8 — scope boundary and legal-content guardrails —, §9, §11 — note the open
question on what Lei 14.133 requires and for which contracts), the **Phase 9c** section of
`IMPLEMENTATION_PLAN.md`, `SPEC.md` §2, §7, §9, **`CONTENT.md` §1–§6** (the only source of legal and
product facts), `KNOWN_ISSUES.md`. Code to look at: `app/[country]/`, `app/(visitor)/`, `app/sitemap.ts`,
`app/robots.ts`, `lib/seo.ts`, `lib/country-page.ts`, `lib/i18n.ts`, `components/JsonLd.tsx`,
`components/SiteShell.tsx`, `messages/*.json`, `tests/messages.test.ts`.

**Out of scope — log under "Not done":** Argentina/Mexico articles (their blogs 404 until they have
articles), images/illustrations, comments, search, tags/categories, RSS, newsletters, an admin/editor,
analytics events, anything in the Phase 9 list (deploy, legal pages, tracking, environments).

### Guardrails for this phase (a violation means stop and write "blocked")
- **No invented law or facts.** Legal facts come only from SPEC §7 and CONTENT.md §1–§5: the two Brazilian
  laws by name and number (Lei 12.846/2013, Lei 14.133/2021) described in CONTENT's own words, the
  "DOJ Evaluation of Corporate Compliance Programs" emphases quoted in SPEC §7 (third-party due
  diligence, ongoing monitoring, documented recordkeeping tying training / hotline usage / certifications
  together), and LGPD by name. **No** article numbers, decrees, thresholds, contract values, dates of
  entry into force, case law, statistics, quotes, URLs to third parties or named companies. If an article
  seems to need one, write around it and list it under "For the lawyer" in HANDOFF_9C.md.
- **Attribute, don't assert.** Say "a Lei 14.133/2021 passou a exigir…" only in CONTENT.md's own words and
  always add that requirements vary by tender and the reader must read the edital/contract. Do not
  generalise the Lei 14.133 statement beyond CONTENT.md — its exact scope is the open lawyer question.
- **No compliance claims about the product or the reader** (CLAUDE.md §8): never "garante", "certifica",
  "deixa sua empresa em conformidade", ISO 37301/37002. The product "provides the documented components
  that buyers and auditors commonly ask for" (CONTENT.md wording). Every article ends with the standard
  line "Isto é informação geral, não aconselhamento jurídico." (English: "This is general information, not
  legal advice.").
- No medical-style or quantified promises ("em minutos" is CONTENT's wording for generation time — fine;
  do not invent others).

### Decisions already made (record deviations as judgment calls)
- **No new dependency.** Articles are Markdown files with a few front-matter lines, rendered by a small
  in-repo renderer for a fixed subset (headings `##`/`###`, paragraphs, bold/italic, links, ordered/
  unordered lists, blockquote) — no raw HTML, no JSX, no MDX (MDX would add dependencies and arbitrary
  code to content; the plan said MDX, this is a recorded deviation). Unknown syntax fails the build/test
  rather than rendering raw. Escape all text; links limited to relative paths and `https:`.
- Files: `content/blog/pt-BR/<slug>.md` (4) and `content/blog/en/<slug>.md` (3). Front matter keys:
  `title`, `description` (≤ 160 chars), `slug`, `published` and `updated` (ISO dates), `status`
  (`draft` | `published`), `topic`. All seven are `status: draft`.
- Routes: Brazil `/br/blog` and `/br/blog/[slug]` (`app/[country]/blog/…`, country must have at least one
  article — otherwise 404, so `/ar/blog` and `/mx/blog` 404 for now); generic English `/blog` and
  `/blog/[slug]` (`app/(visitor)/blog/…`). Static generation is fine (content is files), but `status` and
  the country-enabled check follow the existing request-time `ENABLED_COUNTRIES` rule: a disabled
  country's blog 404s.
- Draft handling: a visible banner on each draft article ("RASCUNHO — pendente de revisão" /
  "DRAFT — pending review") and `<meta name="robots" content="noindex">`; drafts are **excluded from
  `sitemap.xml`**; the index lists drafts (so the team can read them) with the same label. Flipping an
  article to `published` after review is a one-line front-matter change (document it in REVIEW.md).
- SEO: unique `<title>` and description per article from front matter; canonical; `hreflang` is **not**
  used between pt-BR and English articles (they are different content); `Article` JSON-LD (headline,
  description, datePublished, dateModified, `author`/`publisher` = Organization name from existing SEO
  helper, `inLanguage`, `mainEntityOfPage`); index page `CollectionPage`/`Blog` JSON-LD is optional.
  Internal links: each article links to its country's pricing or how-it-works page and back to the blog
  index; no external links except none (keep it simple).
- UI chrome (blog index title/intro, "ler mais", "min de leitura", draft label, back link, empty state)
  in **all four message files** + `messages/DRAFTS.md` rows (parity and provenance tests apply). Reading
  time = words / 200, rounded up.
- Footer disclaimer and consent banner come from the existing shell; do not change them.
- Nav: add a "Blog" link in the marketing header/footer only if the shell already has a natural place;
  otherwise link from the home and country landing pages' footer area. Keep the change small.

### The articles (write them; ≈ 500–800 words each; plain, direct, scannable; one idea per heading)
**Brazil (pt-BR)** — topics from CONTENT.md §6:
1. "Lei 14.133: o que muda para fornecedores de contratos públicos"
2. "Lei Anticorrupção (12.846): o que pequenas empresas precisam saber"
3. "Canal de denúncias: exigência real para fornecedores de multinacionais"
4. "Como comprovar compliance em uma licitação pública" — careful: *"comprovar"* must not imply the
   product proves compliance; frame it as "documentos que compradores e órgãos costumam pedir" and what
   a company can organise; end by saying the edital decides what is required.
**English (generic)**:
5. "What US and European Companies Require from Latin American Suppliers on Compliance"
6. "DOJ Compliance Program Guidelines, Explained for Non-US Suppliers" — only the emphases in SPEC §7; say
   plainly it is an overview of publicly known themes, not a summary of the document's text.
7. "Whistleblower Channels: What Multinational Buyers Expect from Their Supply Chain"
Each: a one-sentence summary at the top, 3-5 headed sections, a short "what to do next" list, a soft
pointer to the product ("Documented components such as a code of conduct, policies, a reporting channel,
training and a record of acknowledgments are what buyers and auditors commonly ask for" — in the
article's language) without a hard sell, and the disclaimer line. Do not repeat the same paragraph across
articles.

### Action items
1. Content loader + renderer + front-matter validation (tests: every file parses, slugs unique and equal to
   the filename, required keys present, description length, dates valid, status valid, unsupported syntax
   rejected, HTML/script in text is escaped, external `http:` links rejected).
2. Routes, index, article page, JSON-LD, sitemap (published only, enabled countries only), draft banner and
   `noindex`, 404 rules, UI strings in four locales.
3. The seven articles + `content/blog/REVIEW.md`: a table of every article (file, status, word count) and
   below it, per article, **every legal or factual statement it makes and where in SPEC/CONTENT it comes
   from**, plus anything you were unsure of, plus how to publish after review.
4. Tests that guard the guardrails: an **allowlist test** over all articles — any `Lei <n>`, `Art.`,
   `Decreto`, `§`, `Resolução`, `Portaria`, `ISO` outside the allowed set (Lei 12.846/2013, Lei 14.133/2021,
   LGPD, "DOJ"/"Department of Justice" only as in SPEC) fails; a forbidden-claims test (reuse the phrases
   from `verify.sh` 4d plus "garante", "certific", "100%", "guarantee", "certif"); every article contains
   the disclaimer line; word count within 450–900.
5. Render evidence: run the built app (or dev server) and capture PNGs of the blog index and two articles
   (one pt-BR, one English) at 1280 px and 360 px with Chromium from `/opt/pw-browsers` (do not run
   `playwright install`), **view them yourself**, fix anything ugly, commit under `docs/phase9c-samples/`.
   State concretely what you saw (hierarchy, line length, banner, no overflow at 360 px).

**`verify.sh` / smoke — permitted edits, only these** (the other worker also edits these two files, so keep
your hunks small and separate; I resolve conflicts): (1) the forbidden-claims scan also covers
`content/blog` and the blog components; (2) `scripts/smoke.sh`: append one short section — `/br/blog` 200,
an article 200 containing `Article` JSON-LD and the draft `noindex`, `/blog` 200, `/ar/blog` 404,
`sitemap.xml` contains no `/blog/` URL while every article is a draft. Show the diffs.

### Definition of done
`./verify.sh` exit 0; the tests above; CI green on the PR head (cite run id + head SHA via the GitHub tools);
no new dependency (`package.json` unchanged); samples viewed.

### Report back
`HANDOFF_9C.md` per the HANDOFF template: evidence block, verification depth, what was built, judgment
calls (including the Markdown-instead-of-MDX deviation), "For the lawyer" (statements you were least
sure of — Lei 14.133 above all — and facts you deliberately left out), "Not done", open questions.

---

## If this is a VERIFICATION request

Not applicable for this relay.
