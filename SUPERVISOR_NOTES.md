# Supervisor notes — worker task: Phase 7 (vendor questionnaire + sanctions screening)

Overwrite each time — a relay, not a log. Only one relay at a time. Read this at the start of
your session before anything else.

---

## If this is a WORKER task

### Context
Phases 0–6 are accepted. Their code is on your base branch (PRs #7/#8 may still be open on GitHub; your PR to
`main` will show their commits until they merge — say so in the PR description). Phase 7 adds (1) a tokenized
vendor questionnaire — the same pattern as the phase 6 employee link, but simpler (no session) — and (2) a
`ScreeningProvider` with an OpenSanctions implementation. Deep review: vendor names leave our system to a
third party, and the provider is a paid service.

**Two things you probably cannot do from your session, and must not fake:** the environment's network policy likely
blocks `api.opensanctions.org`, and there is no API key. Build and test everything against a local stub (below),
write `scripts/screening-live-check.sh` so the live check is one command for whoever has network + key, run it if
you *can*, and otherwise write "LIVE CHECK NOT RUN — needs SCREENING_API_KEY and network access to
api.opensanctions.org" at the top of HANDOFF.md. Do **not** present stub results as live evidence, and do not
invent the live response shape beyond what is stated here; mark every assumption about the real API in code
comments as `ASSUMED SHAPE — verify at live check`.

Read first: `CLAUDE.md` (§0, §3, §6, §8, §9, §11), the **Phase 7** section of `IMPLEMENTATION_PLAN.md`, SPEC §5.6,
`lib/db/schema.ts` (`vendors`), `lib/db/tenant.ts`, `lib/employee/{session,invites,csv}.ts` and
`app/employee/` (token pattern, headers), `lib/whistleblower/{crypto,rotate}.ts`, `lib/auth/require-tenant.ts`,
`lib/email/`, `app/(app)/dashboard/vendors/page.tsx`, `tests/dashboard-gate.test.ts`, `tests/employee-gate.test.ts`,
`scripts/smoke.sh`, `verify.sh`.
Branch `phase-7-vendor-screening` from **`origin/claude/trusting-lamport-aq0f52`**; PR to `main`; don't merge; don't push to `main`.

**Out of scope:** screening individuals / beneficial owners (v1 screens the vendor entity name only), bulk "screen all",
automatic or scheduled re-screening (every run is an explicit click — each one may cost money), continuous monitoring,
vendor accounts/sessions, vendor CSV import, deleting vendors, risk scoring or any "approved/low risk" verdict, a binder
section (phase 8 — but expose a reusable summary function), self-hosting yente, any new legal citation, any new dependency.

### Decisions already made (record deviations as judgment calls; if one touches a Guardrail, stop and write "blocked")

**Schema (one migration `0006`, committed, drift check green; every new table has `company_id`)**
- `vendors`: add `country` (text, nullable, free 2-letter code if given), `tax_id` (nullable text), `contact_email` (nullable, lower-cased), `contact_name` (nullable), `invited_at`, `invite_expires_at`, `invite_token_hash` (nullable), `submitted_at` (nullable), `archived_at` (nullable), `created_at`. `questionnaire_status` values: `not_sent | sent | submitted` (CHECK; derive "expired" in code from `invite_expires_at`). Unique `(company_id, lower(name))` among non-archived is NOT required; duplicates allowed (two branches with one name) — keep simple.
- New `vendor_responses` (id, company_id, vendor_id, submitted_at, respondent_name, respondent_role, ownership_text, pep_exposure boolean, pep_details, prior_sanctions boolean, sanctions_details, antibribery_policy boolean). **Encrypted** (same `REPORT_ENCRYPTION_KEYS` ring, AAD `vendor_responses:<company_id>:<field>`): `respondent_name`, `respondent_role`, `ownership_text`, `pep_details`, `sanctions_details`. Booleans plain. **Append-only trigger** (copy the 0002/0004/0005 pattern). A resubmission after a re-send inserts a new row; the newest row is "the" answer, older ones stay in the detail page history.
- New `vendor_screenings` (id, company_id, vendor_id, screened_at, provider text, dataset text, name_screened text, status `no_match | possible_match | error`, match_count integer, matches jsonb (array of ≤ 10 of `{id, caption, score, datasets[], topics[]}` — nothing else from the provider is stored), error_code text nullable (a fixed short code, never a message/body), requested_by_user_id). **Append-only trigger.**
- `vendors.screening_result` (text) / `screened_at` hold the latest status + time (cache); updated in the same transaction that inserts the history row.
- Extend `lib/whistleblower/rotate.ts` + its test + README line to re-encrypt `vendor_responses` encrypted columns (same sanctioned trigger-disable-inside-transaction pattern; counts only in output). Add the AAD constant next to the others.

**Vendors and questionnaire**
- `/dashboard/vendors`: add-vendor form (name 1–200 required; country, tax id, contact name/email optional), list (name, country, questionnaire state, screening state + date, actions), "show archived" toggle, archive/unarchive (never delete). Detail `/dashboard/vendors/[id]`: profile, questionnaire answers (decrypted, "cannot decrypt — key missing" state), response history, screening history with each run's matches. All `requireTenant`/`requireTenantRoute`; company from the session; ids are lookup keys combined with it; cross-tenant → 404; add a coverage test like `dashboard-gate`.
- Send/resend questionnaire (needs `contact_email`): fresh token (random 32 bytes base64url, only sha256 stored in `invite_token_hash`), TTL **30 days**, kills the previous link; **send the email first, store hash/`invited_at`/expiry only after a successful send** (same as phase 6). State becomes `sent`. Email in the company's locale (pt-BR for BR): neutral request from `<Company>` to fill a short integrity questionnaire; no document text, no accusation; translate for pt-BR/en/es-MX/es-AR, list every string in `messages/DRAFTS.md`.
- Public form `GET /vendor/<token>` renders the form **without consuming** the token (own root layout, no marketing chrome, no cookies, no consent banner); `POST /vendor/api/submit` validates, then in one transaction consumes the token (`UPDATE vendors SET invite_token_hash=NULL … WHERE invite_token_hash=<sha256> AND invite_expires_at>now() AND archived_at IS NULL RETURNING id, company_id`) and inserts the response, sets `questionnaire_status='submitted'`, `submitted_at`. Unknown/used/expired/archived tokens → the same friendly page (same copy/status, no hint which). Two concurrent submits → exactly one response (test it). Validation errors re-render the form without consuming the token and without losing typed answers. Limits: each text field ≤ 4000 chars, names/roles ≤ 200; yes/no questions required; if PEP/sanctions = yes then details required.
- Headers on those pages/handlers: `Cache-Control: private, no-store`, `Referrer-Policy: no-referrer`, frame denial, `X-Robots-Tag: noindex`; **no IP, no user-agent, no header read, no logging** on the vendor paths (extend `scripts/check-anonymity.sh`-style invariant to `app/vendor` and `lib/vendors`' public handlers — or add a sibling check; your call, record it). Questionnaire copy: states who is asking, that answers go to that company, a plain "not a legal determination" line; never threatens or implies guilt.
- Questions (exact wording is yours, pt-BR primary, all four locales; gap-fills in `DRAFTS.md`): ownership structure (who owns/controls, text); any owner/director a politically exposed person or close associate? (y/n + details); has the company or an owner been subject to sanctions or an anti-corruption investigation/conviction? (y/n + details); does the company have an anti-bribery/anti-corruption policy in place? (y/n); respondent name and role.

**ScreeningProvider**
- `lib/screening/types.ts`: `ScreeningProvider { name; screen(input: {name: string; country?: string}): Promise<ScreeningOutcome> }` with `ScreeningOutcome = {status: "no_match"|"possible_match"; matches: Match[]; dataset: string} | {status: "error"; code: "timeout"|"auth"|"rate_limited"|"upstream"|"bad_response"|"not_configured"}`. `lib/screening/index.ts` `getScreeningProvider()`: returns the OpenSanctions provider when `SCREENING_API_KEY` is set and not `changeme`; otherwise a provider whose `screen()` returns `error/not_configured` and whose `available` is false so the UI shows "screening unavailable". There is **no fake provider in production code**: tests inject their own provider object; the smoke uses a local stub HTTP server through the real client (below).
- `lib/screening/opensanctions.ts`: `POST {SCREENING_BASE_URL or https://api.opensanctions.org}/match/{SCREENING_DATASET or "default"}` with header `Authorization: ApiKey <key>` and JSON body `{"queries":{"q1":{"schema":"Company","properties":{"name":["<vendor name>"],"country":["<cc>"] (only if given)}}}}`. Expected response `ASSUMED SHAPE`: `{"responses":{"q1":{"results":[{"id","caption","schema","score","match","datasets":[…],"properties":{"topics":[…]}}],"total":{…}}}}`. Mapping: `possible_match` iff at least one result has `match === true` **or** `score >= 0.7`; `no_match` iff the call succeeded and neither holds; keep the top ≤ 10 results by score (only the 5 stored fields; `topics` from `properties.topics` or `topics`, tolerate absence). HTTP 401/403 → `auth`, 429 → `rate_limited`, 5xx → `upstream`, timeout (10 s, `AbortSignal.timeout`) → `timeout`, unparsable/unexpected JSON → `bad_response`. **Never report `no_match` unless a 2xx response parsed as expected with a `q1` entry** (an empty/malformed body is `bad_response`, not "no match"). Never log or store the request body, response body, URL with key, or headers; the key never appears in errors or the DB.
- `SCREENING_BASE_URL` must be `https:` unless the host is loopback (`localhost`/`127.0.0.1`/`::1`) — otherwise refuse to build the provider (throw at first use with a clear message), so a mistaken `http://` can't leak the key. Add `SCREENING_BASE_URL` and `SCREENING_DATASET` to `.env.example` and the CLAUDE.md §6 env list (already added there by the supervisor — verify), README section "Sanctions screening: what is sent, what is stored".
- **What is sent to the provider:** the vendor name and the optional country code, nothing else (no company id, no tax id, no email, no questionnaire answers). A test asserts the outgoing request body for a vendor with all fields filled contains only those.

**Screening action**
- `POST /dashboard/vendors/[id]/screen` (admin click). Guards: provider available; **cooldown 5 minutes** per vendor (a second click within it → no provider call, friendly message); **cap 50 screenings per company per UTC day** (counted from `vendor_screenings`, errors included — they may be billed); archived vendors cannot be screened. Order: check guards → call provider → in one transaction insert history row + update the vendor cache. An `error` outcome is recorded (status `error`, `error_code`) and shown as "screening failed — try again later", **never** as no-match; the cached `screening_result` becomes `error` but a previous good result stays visible in the history. Constants in one place.
- Display copy (pt-BR first, all four locales): states are "Não triado" / "Nenhum resultado nas listas triadas em <data>" / "Possível correspondência — revisão necessária" / "Falha na triagem". Always next to the result: "Ferramenta de triagem automatizada contra listas públicas de sanções (<dataset>). Não é uma investigação de due diligence nem uma determinação legal. A ausência de resultados não comprova ausência de risco." Never the words approved / clear / clean / safe / aprovado / limpo / seguro / "due diligence completa" as a verdict. Add a messages test asserting the vendor namespace contains none of those words except inside the negated disclaimer, and extend the forbidden-claims invariant (4d) to `lib/screening`, `lib/vendors`, `app/vendor`.
- Possible matches are shown with caption, score (as a %), datasets and topics, and a plain external link to the provider's entity page only if you are certain of its URL form (otherwise show the entity id as text) — links use `rel="noopener noreferrer"`.

**Summary for the binder (phase 8)**: `lib/vendors/summary.ts` — tenant-scoped, returns per vendor: name, country, questionnaire state/date, last screening status/date/dataset, possible-match count; unit-tested. No UI beyond what the vendors page already shows.

### Action items
1. Migration `0006` + schema + rotation extension; adjust seeds/tests that insert vendors (list every existing test you touch).
2. `lib/screening/` (types, opensanctions, index), `lib/vendors/` (queries, invites, submit, screen, summary), pages/handlers, emails, messages (four locales + `DRAFTS.md`).
3. Invariants in `verify.sh` (vendor public paths read no request metadata and log nothing; forbidden-claims scope extended); README sections; `.env.example`.
4. Tests (`npm run test -- vendors`, real Postgres, provider injected): token — GET doesn't consume, submit consumes once, concurrent double-submit → one response, expired/used/unknown/archived → identical friendly page, resend kills old link, failed email leaves state unchanged, hash-only storage; answers ciphertext in DB and decrypt in the detail page, append-only triggers (responses, screenings), rotation covers `vendor_responses`; cross-tenant 404 on every dashboard vendor route and handler; screening — outgoing body contains only name+country, `possible_match` / `no_match` / each error code mapping with canned provider JSON (including empty body = `bad_response`, score 0.69 without `match` = no_match, 0.7 = possible), cooldown, daily cap (errors count), archived blocked, unavailable provider, error never shown as no-match, cache + history in one transaction, key never in DB/log output; `SCREENING_BASE_URL` http non-loopback refused; messages-vocabulary test; coverage test that every dashboard vendor file uses the tenant gate; summary function. Existing suites stay green.
5. Smoke (`scripts/smoke.sh`, only this edit): start a tiny local HTTP stub (node one-liner, shaped like the assumed `/match` response: returns a hit for a vendor named e.g. `Listed Smoke Corp`, no hit for others, can be told to return 500) on a free port and run the app with `SCREENING_BASE_URL=http://127.0.0.1:<port>` and a dummy `SCREENING_API_KEY`; flow: add two vendors → send questionnaire → email in dev sink → GET form (token not consumed) → submit → admin sees answers → screen listed vendor → "possible match" with the match → screen the other → "no match … em <data>" → second click inside cooldown refused → stub returns 500 → error recorded, not no-match → company 2 gets 404 on company 1's vendor. Label these lines "(local stub)" in the output.
6. `scripts/screening-live-check.sh`: reads `SCREENING_API_KEY` (+ optional `SCREENING_BASE_URL`/`SCREENING_DATASET`) from the environment, refuses to run if the key is unset, makes **one** call through the real provider code (e.g. via a small node script using `lib/screening/opensanctions.ts`) for a well-known, clearly sanctioned entity name you choose, and prints: HTTP-level outcome, `status`, number of matches, top caption/score/datasets — never the key, never the raw body. Exit non-zero if the status is not `possible_match`. Try it in your session; if it fails with a network/proxy 403 for the host, state that plainly (do not work around the proxy).

### Definition of done
`./verify.sh` exit 0 on the final code commit; `npm run test -- vendors` green; smoke lines (labelled local stub) pasted. Raw outputs in HANDOFF.md: (a) the new vendor-path invariant failing on a planted violation then passing; (b) `psql -x` of a `vendor_responses` row (ciphertext) and a `vendor_screenings` row from the smoke run; (c) the captured outgoing request body from the smoke stub (shows only name + country, and the `Authorization` header present but its value redacted); (d) the live-check script output — real, or the literal "LIVE CHECK NOT RUN" line with the reason.

### Report back
Short `HANDOFF.md` per the template; first line states whether the live check ran. Include: what changed, evidence above, full `./verify.sh` output on the final code commit, CI run id + head SHA (check after a minute), code tip vs pushed tip, judgment calls, and **Found / for the supervisor**: every assumption about the real OpenSanctions API (so I can compare at the live check), anything about vendor data privacy (vendor names go to a third party), and what Esteban must do at deploy (migration `0006`; key + base URL + dataset env; commercial terms).

---

## If this is a VERIFICATION request

Not applicable for this relay.
