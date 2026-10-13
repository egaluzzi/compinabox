# Supervisor notes — worker task: Phase 1 (marketing shell, geo-routing, SEO scaffolding)

Overwrite each time — a relay, not a log. Only one relay at a time; don't queue a worker task
and a verification request together. Read this at the start of your session before anything
else.

---

## If this is a WORKER task

### Context
Phase 0 is accepted and merged to `main` (scaffold, CI, `verify.sh` green). Your job is **Phase 1**
in `IMPLEMENTATION_PLAN.md`: the public marketing site with no backend — four-locale i18n,
country routes, geo-redirect at `/`, SEO scaffolding, waitlist stub, consent banner.
Read, in order: `CLAUDE.md` (§0, §2, §4, §5, §6, §8, §9), Phase 1 of `IMPLEMENTATION_PLAN.md`,
`SPEC.md` §3, §4, §9, then `CONTENT.md` §1–§5 (this is the copy; it is pre-approved).
Also read `KNOWN_ISSUES.md` and the Phase 0 follow-ups in the old `HANDOFF.md` (git history).

**Branch:** create `phase-1-marketing` from current `main`. Push it and open a PR to `main`
(definition of done needs `ci.yml` green on the PR). Do **not** merge, do **not** push to `main`.

**Out of scope — log under "Not done", don't build:** database, auth, Stripe/checkout logic,
real waitlist storage, GTM/GA4 or any tracking script, blog pages, ad-variant pages, any
`/lib/content/*.ts` file (legal-content layer is phase 3; see item 6), dashboard/employee/report
routes, deploy or ops files.

### Decisions already made (don't re-litigate; record deviations as judgment calls)
These are the technical calls the plan leaves open. They are in effect for this phase; the
supervisor is adding the durable ones to CLAUDE.md §9.

- **Routing model.** Locale is derived from the URL's country segment, not from a locale prefix:
  `/` → `en`, `/ar` → `es-AR`, `/br` → `pt-BR`, `/mx` → `es-MX`. Do not use next-intl's
  locale-prefix routing; use `next-intl` for messages/formatting with the locale resolved by us
  (`app/page.tsx` for `/`, `app/[country]/...` with `country ∈ ar|br|mx`, anything else → 404).
  Locale codes must never appear in a URL (`verify.sh` 4f checks this).
- **Edge file name.** The plan says "middleware". Next 16 may have renamed that file convention
  (e.g. `proxy.ts`). Use whatever the installed Next version documents as current, and note it.
- **Geo redirect rules**, implemented as a **pure function** (unit-tested) called by that file,
  matcher limited to `/` only:
  1. Cookie `country` ∈ `ar|br|mx|other` beats the header. Invalid cookie values are ignored.
  2. `ar|br|mx` → redirect to that prefix. `other` → no redirect (the visitor chose the picker).
  3. No/invalid cookie: read `CF-IPCountry` (case-insensitive). `AR|BR|MX` → redirect. Anything
     else (`XX`, `T1`, other countries, absent header) → no redirect, render `/`.
  4. Redirect is **307**, with `Cache-Control: no-store`. Never 301/308: the answer depends on
     the visitor and Cloudflare sits in front.
  5. Never redirect any path other than `/`. Deep links like `/ar/pricing` stay as requested.
  6. Visiting a country page does **not** set the cookie; only an explicit click does.
- **Cookie semantics.** `country` (1 year, `SameSite=Lax`, path `/`): `ar|br|mx` = chosen market,
  `other` = "show me the picker". The **"change country" control** on localized pages sets
  `country=other` and navigates to `/` — otherwise a visitor with `country=br` could never reach
  the picker. Choosing a country in the picker sets that country's value. The site logo/home link
  on a localized page goes to that country's page, not `/`.
- **Language toggle on `/`** (SPEC §3.4) is EN/ES/PT mapping to locales `en` / `es-MX` / `pt-BR`
  (Spanish toggle uses the neutral tuteo, not Argentine voseo). It stores cookie `lang`
  (`en|es|pt`), switches the UI language only (never the country), and `/` renders per cookie
  (default `en`, which is what crawlers and cookie-less requests get). `/` may therefore be
  dynamically rendered; that's accepted.
- **`ENABLED_COUNTRIES`** (env, comma list, default `br`) is read **at request time**, not baked
  at build: mark the pages that depend on it (`/{country}`, `/{country}/pricing`, `sitemap.xml`,
  `robots`-adjacent logic) dynamic. Reason: CI builds the artifact, the droplet's `.env` supplies
  the value; build-time baking would silently ignore it. Put the parsing in one tested helper.
- **Disabled country behaviour** (CLAUDE.md §2): pages render normally, pricing CTA replaced by the
  waitlist form (same component as the generic page's), `<meta name="robots" content="noindex">`,
  excluded from `sitemap.xml`.
- **Pricing page:** no invented numbers. Show the CONTENT.md plan header, the 7-item included
  list, and a "pricing to be announced" line (Esteban owns pricing). The enabled-country CTA links
  to `/checkout`, for which you add a minimal `noindex` placeholder page ("not available yet") —
  no form, no payment code.
- **Citations live in messages, not code.** The legal-basis text with law names comes verbatim from
  CONTENT.md into `messages/*.json` (that is allowed: `verify.sh` 4c scans only `app` and
  `lib/documents`). Do not hardcode a statute name/number in any `.tsx`/`.ts` file.
- **Waitlist form** posts to a stub route that validates the email, drops honeypot hits, and writes
  **one `console.log` line with email + country + timestamp only — never IP, user-agent or any
  header.** No persistence; phase 2 replaces it. Returns a friendly success state in the UI.
- **Consent banner:** non-blocking bottom bar (SPEC §10: no interstitial over the CTA), stores
  `consent=accepted|rejected` (1 year), loads **nothing** yet. Lives in the root layout.

### Action items
Work the Phase 1 checklist top to bottom, ticking each box in `IMPLEMENTATION_PLAN.md`.

1. **i18n plumbing.** `next-intl` (pin exact version), four message files
   `messages/{en,es-AR,pt-BR,es-MX}.json`, typed message keys, a locale resolver per the routing
   model above. Static rendering for everything not listed as dynamic above.
2. **Copy: verbatim from CONTENT.md.** Hero, subheadlines, CTAs, "why", legal-basis explainers,
   country FAQ items, meta titles/descriptions, how-it-works, shared FAQ, pricing labels, checkout
   micro-copy as it exists. **Copy, don't rewrite** — keep wording, punctuation and the
   "*This is general information, not legal advice*" lines exactly.
3. **Gap-filling translations (flagged, never silent).** CONTENT.md is incomplete across locales:
   the generic page exists only in English; the shared sections (how-it-works, shared FAQ, pricing
   labels, checkout micro-copy) exist only in Argentine Spanish; the footer disclaimer exists only
   in English; the 7-item "what you get" list exists only in English; the consent-banner strings
   don't exist at all. Where a needed string has no source in that locale, produce a **faithful
   translation** of the existing source string (EN↔ES↔PT; Argentine voseo → tuteo for `es-MX`),
   never a rewording and never new claims. For the footer disclaimer, the "does this certify
   compliance?" FAQ answer and the legal-basis lines, translate as literally as natural language
   allows — they are liability-sensitive (CLAUDE.md §8). Record every such string in a new file
   `messages/DRAFTS.md`: one row per `locale | key | source key/locale it was translated from`.
   Esteban reviews that file before launch (supervisor tracks it in CLAUDE.md §11).
   A message-parity test must fail if any locale file is missing a key another has.
4. **Routes** per plan: `/`, `/{country}`, `/{country}/pricing`, `/{country}/how-it-works`,
   `/{country}/faq`, `/{country}/legal-basis`, `/legal/{terms,privacy,disclaimer}`. Legal pages are
   placeholders headed "DRAFT — pending review" (in the page's language) with no substantive legal
   text. `/legal/disclaimer` may show the footer disclaimer text.
5. **Geo redirect** per the rules above, with unit tests covering: header BR/AR/MX, header DE,
   header absent, header `XX`/`T1`, lowercase header, cookie beats header (both directions), cookie
   `other`, invalid cookie, non-root path never redirected, 307 + `no-store`.
6. **Picker + controls.** Country picker prominent on `/` (not buried in nav), "change country"
   control on every localized page, EN/ES/PT toggle on `/`. Choices set cookies per the semantics
   above (small client components; the rest stays server-rendered).
7. **`ENABLED_COUNTRIES` flag** and waitlist behaviour per above, plus the waitlist stub route.
8. **SEO.** Per-page `<title>`/description from messages (CONTENT.md has them for `/` and each
   landing; derive other pages' from the page's own heading, flagged in DRAFTS.md if translated),
   `metadataBase` from `APP_URL`, `hreflang` + `x-default` using locale codes in `hreflang` and
   URL prefixes in `href` (CLAUDE.md §5), `sitemap.xml` (enabled countries only, plus `/`),
   `robots.txt` disallowing `/dashboard`, `/employee`, `/checkout`, `/onboarding`, JSON-LD
   `Organization` (home + landings) and `FAQPage` (every FAQ page, and `/` if it renders the FAQ).
9. **Footer disclaimer** (CONTENT.md §1) on every page, in the page's language.
10. **Consent banner** per above.
11. **`verify.sh` — you may make exactly these two edits and nothing else:**
    (a) make the vitest summary parse colour-proof (strip ANSI escape codes from `OUT` before the
    `grep`), then **remove** the `NO_COLOR`/`FORCE_COLOR` workaround from `ci.yml` and confirm CI
    still passes; (b) add a smoke step after `build` (skipped when `SKIP_BUILD=1`) that runs a new
    `scripts/smoke.sh`: it starts `node .next/standalone/server.js` on a free `PORT`, waits until it
    answers, asserts the Definition-of-done `curl` checks below (all of them, against that port),
    kills the server on exit via `trap`, and exits nonzero on any failed assertion. Show the diff of
    `verify.sh` in HANDOFF.md. Standalone output needs `public/` and `.next/static` next to
    `server.js` to serve assets — copy them in the script if the smoke test needs them, don't
    change the app for it.
12. **Tests (Vitest):** geo resolver; `ENABLED_COUNTRIES` parser; message-key parity across the four
    locales; the disabled-country page renders the waitlist form and no pricing CTA; the enabled
    one the reverse; waitlist route rejects bad email and honeypot and logs no IP/header fields.
13. **Performance:** record a Lighthouse **mobile** run of `/br` against the standalone build
    (headless Chromium is at `/opt/pw-browsers`; do not run `playwright install`). Paste LCP and CLS.
    If it can't be run, say so — don't estimate. Note that localhost numbers are indicative only.
14. Update CLAUDE.md §7 only if commands differ. Tick the Phase 1 boxes. Commit in small logical
    commits, push `phase-1-marketing`, open the PR, wait for `ci.yml` on the PR head, then write
    `HANDOFF.md`.

### Definition of done (from IMPLEMENTATION_PLAN.md — evidence for each goes in HANDOFF.md)
`./verify.sh` exits 0 (now including the smoke step), `npm run build` produces the standalone
output, `ci.yml` green on the PR head (cite run id + head SHA via the GitHub tools if `gh` is
absent), and these pass against the standalone build (the smoke script asserts them; paste its
output):
```
curl -sI -H "CF-IPCountry: BR" http://localhost:$PORT/ | grep -i "location: .*/br"
curl -sI -H "CF-IPCountry: AR" http://localhost:$PORT/ | grep -i "location: .*/ar"
curl -sI -H "CF-IPCountry: DE" http://localhost:$PORT/ | grep -E "^HTTP/.* 200"
curl -sI -H "CF-IPCountry: BR" -H "Cookie: country=mx" http://localhost:$PORT/ | grep -i "location: .*/mx"
curl -sI -H "CF-IPCountry: BR" http://localhost:$PORT/ar/pricing | grep -E "^HTTP/.* 200"
curl -s http://localhost:$PORT/ar | grep -i 'noindex'
curl -s http://localhost:$PORT/br | grep -ic 'noindex'     # expect 0
curl -s http://localhost:$PORT/sitemap.xml | grep -c "<loc>"   # > 0
```
Extra assertions to add to the smoke script: `-H "CF-IPCountry: BR" -H "Cookie: country=other"` on `/`
→ 200 no redirect; the redirect response is 307 and carries `cache-control: no-store`; `/checkout`
and `/legal/terms` return 200; `/zz` returns 404; `/pt-BR` returns 404; `robots.txt` contains the
four disallows.

Judgment items I will check: copy matches CONTENT.md word for word; every gap-filled string is
listed in `messages/DRAFTS.md`; no statute name/number in any `.ts`/`.tsx`; no tracking script;
no `lib/content/*.ts` created; Lighthouse LCP < 2.5s on `/br` (mobile).

### Report back
Run `./verify.sh`, then write `HANDOFF.md` per its template (overwrite the template text). In
addition to the usual evidence:
- **Copy spot-check table:** for each of the four locales, 5 rows of `message key | rendered text |
  the CONTENT.md line it came from (quoted)`, so a mismatch is visible side by side.
- **`messages/DRAFTS.md` row count per locale**, so I can see how much was gap-filled.
- Verification depth: say plainly that the geo behaviour was checked with simulated headers against
  the standalone build, not through Cloudflare (domain/Cloudflare access is an open input), and
  that nothing touches a database or external service.
- Every judgment call, especially any deviation from the decisions above, with why.

---

## If this is a VERIFICATION request

Not applicable for this relay.
