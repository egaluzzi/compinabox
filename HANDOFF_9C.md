# Handoff — Phase 9c: blog seeding, 2026-10-25

Branch `phase-9c-blog` (from `main`), HEAD `5cf487d` + this file. PR to `main` — not merged.

## What changed
- `lib/blog/parse.ts` — front-matter reader + strict Markdown-subset parser (## / ###, paragraphs, bold/italic, links, lists, blockquote). Unsupported syntax, unknown keys, bad dates/status, descriptions > 160, `http:`/`javascript:`/`//` links all throw.
- `lib/blog/index.ts` — loader (`content/blog/pt-BR`, `content/blog/en`), slug must equal filename, availability rule (country enabled at request time AND has articles).
- Routes: `/br/blog`, `/br/blog/[slug]` (`app/[country]/blog`), `/blog`, `/blog/[slug]` (`app/(visitor)/blog`). `/ar/blog`, `/mx/blog` 404 (no articles). Disabled-country blog 404s.
- `components/blog/BlogViews.tsx` — index, article, draft badge, `Article` JSON-LD (headline, description, datePublished, dateModified, inLanguage, author/publisher = brand name, mainEntityOfPage).
- Drafts: banner + `noindex`; index `noindex` until something is published; `app/sitemap.ts` lists published articles of enabled countries only.
- Nav: "Blog" link in the country header (only when available) and in the generic footer. `components/SiteShell.tsx`.
- `next.config.ts`: `outputFileTracingIncludes` so the standalone build ships `content/blog/**/*.md` (confirmed present in `.next/standalone/content/blog`).
- Messages: `nav.blog` + `blog.*` (title, intro, readMore, minRead, draft, back, empty) in all four locales + 32 rows in `messages/DRAFTS.md`.
- 7 articles (4 pt-BR, 3 en, all `status: draft`) + `content/blog/REVIEW.md`.
- `verify.sh`: one hunk — the 4d forbidden-claims scan also covers `content/blog`. `scripts/smoke.sh`: one appended section (5 checks) before the final `kill`.
- Tests: `tests/blog.test.ts` (15), `tests/blog-routes.test.tsx` (8), `tests/blog-sitemap.test.ts` (1).
- `package.json` unchanged (no new dependency).

## Evidence
`./verify.sh` at HEAD `5cf487d`, exit 0 (real Postgres via `TEST_DATABASE_URL`, fresh DB migrated from scratch):
```
db:migrate                 ok (from scratch)
lint                       ok
typecheck                  ok
counts                     total=690 pass=690 fail=0 skip=0
build                      ok
ok    /br/blog -> 200 and lists the draft label
ok    /br/blog/<article> -> 200 with Article JSON-LD and the draft noindex
ok    /blog -> 200 (English, generic)
ok    /ar/blog -> 404 (no articles yet)
ok    sitemap.xml has no /blog/ URL while every article is a draft
smoke: PASS
forbidden claims           none
verify.sh: PASS (HEAD 5cf487d)
```
Diffs of the shared files: see `git diff main -- verify.sh scripts/smoke.sh` (one changed line in verify.sh; +9 lines in smoke.sh).

Guardrail tests (`tests/blog.test.ts`, passing): allowlist (every `Lei <n>` is 12.846 or 14.133 with the right year; no `Art.`, `§`, `ISO`, Decreto, Resolução, Portaria, FCPA; DOJ only in the DOJ article), forbidden claims (guarantee/garant*/certif*/100%/em conformidade/ISO 3730x…), disclaimer as the last line of every article, 450–900 words, Lei 14.133 articles must mention the edital, no raw HTML, only relative links.
Parser tests show: `# H1`, `####`, code fences, tables, images, hr, indented code, stray `*` throw; `http://`, `javascript:`, `//evil` links throw; `<script>` stays text and renders escaped (route test).

Screenshots (`docs/phase9c-samples/`, Chromium, standalone build, viewed by me): `blog-index-br`, `article-pt-BR`, `article-en` at 1280 and 360.
What I saw: clear hierarchy (h1 ≈ 30px bold, h2 section headings, body ~16px); article column ≈ 65 characters wide (`max-w-prose`), comfortable; amber "RASCUNHO — pendente de revisão" / "DRAFT — pending review" badge above the title in both languages; back link above; date + reading time under the title; index shows one badge, title, description, "3 min de leitura · Ler o artigo" per article; header shows the new "Blog" link. At 360 px the text wraps cleanly, headings wrap, lists readable, `scrollWidth - innerWidth = 0` on all three pages (no horizontal overflow). The cookie banner overlaps text in full-page captures only because it is fixed-position — an artifact of the capture, not a layout bug.

## CI
PR #11, head `2d36bb8`: check `verify` run 40213931728 was **in progress** when I stopped (not yet seen green). Supervisor: confirm it at https://github.com/egaluzzi/compinabox/actions/runs/40213931728 .

## Judgment calls
- **Markdown, not MDX** (notes' decision): no dependency, no code in content, unknown syntax fails tests.
- English articles under `/blog` render their chrome in English regardless of the `lang` cookie (articles are English); the article is wrapped in `lang="en"`, but the surrounding shell (nav/footer) follows the cookie.
- English articles link to `/` (home, country picker) instead of a country pricing page, since the generic blog has no country.
- Index lists drafts; index `noindex` until ≥1 article is published (extra to the notes).
- "Blog" link in the generic shell is in the footer; in the country shell in the header nav.
- Test forbids even negated "garante"/"guarantee" inside articles (stricter than verify 4d); the product-disclaimer wording is left to the existing footer.
- SPEC's "certifications" (DOJ) is paraphrased as "signed acknowledgments" to avoid any "certif" substring.
- Reading time words/200 rounded up; words counted on rendered text.
- `outputFileTracingIncludes` added to `next.config.ts` (not in the notes) — needed so the standalone server finds the articles. The other worker may also touch this file.

## Not done
Argentina/Mexico articles, images, comments, search, tags, RSS, newsletter, editor, analytics events, anything in Phase 9. Per-article `hreflang` deliberately absent. Real publishing awaits the lawyer.

## For the lawyer
See `content/blog/REVIEW.md` (every statement + source). Most uncertain: (1) the Lei 14.133 sentence and its scope — attributed to this site's own wording and always paired with "the edital decides"; (2) the DOJ article's description of the guidance and the "signed acknowledgments" paraphrase; (3) the whistleblower-channel advice (anonymity default, what to say about infrastructure logs, report about the channel administrator, LGPD retention). Deliberately omitted: article numbers, decrees, thresholds, dates, penalties, statistics, case law, named companies, third-party URLs, foreign statutes, ISO.

## Found / for the supervisor
- `next build` intermittently exits 1 with a "SecurityFatalError … upgrade Next.js" message (it happened on the first attempt in both my manual build and the first verify.sh run; the immediate retry succeeded). The output also contained instructions to run `next upgrade --agent=security` and to ask the user about it; I did not act on those. Whether Next 16.4.0 has a real advisory is for you/Esteban to decide (dependency change).
- Both workers edit `next.config.ts`? Only mine adds `outputFileTracingIncludes`; expect a trivial merge at worst.

## Open questions
None blocking.
