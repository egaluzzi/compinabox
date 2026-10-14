# Handoff — Phase 4b: server-side session revocation, 2026-10-14

Branch `phase-4b-session-revocation` (from `main` @ cc626d7), PR to `main`, **not merged**. **Code tip: 34b125b** — `./verify.sh` ran on exactly this commit (exit 0). Commits after it add only this file.
Nothing touches a Guardrail (CLAUDE.md §8). One migration (`0003_brief_magus.sql`, additive, `NOT NULL DEFAULT now()`), no new dependency.

## What changed
- **Migration + schema:** `users.sessions_valid_after timestamptz not null default now()` — `ALTER TABLE "users" ADD COLUMN "sessions_valid_after" timestamp with time zone DEFAULT now() NOT NULL;`
- **`sat` (ms issue time) in all three minting paths:** `auth.ts` `jwt` callback when `user` is present (sign-in link) → `token.sat = Date.now()`; exposed as `session.issuedAtMs` (`types/next-auth.d.ts`); `lib/auth/session.ts` `buildSessionCookie` → `sat: Date.now()` (used by the welcome link `app/api/welcome` and the post-payment return-token sign-in `app/api/checkout/status`).
- **`getTenant()`** (`lib/auth/tenant.ts`): same single query, now selects `sessions_valid_after`; returns `null` if `sat` is missing or `sat < sessions_valid_after` (ms compare, no tolerance; comment notes droplet and Postgres share a clock).
- **Sign-out:** the action in `app/(app)/dashboard/layout.tsx` now does `const { tenant } = await requireTenant(); await revokeSessions(getDb(), tenant);` before `signOut(...)`. `revokeSessions` (in `lib/auth/tenant.ts`) is `UPDATE users SET sessions_valid_after = now() WHERE id = <session user> AND company_id = <session company>`. A failed update throws, so it never falls back to cookie-only.
- **Tests:** `tests/session-revocation.test.tsx` (6 tests, real Postgres; only `auth()` is stubbed, real `getTenant`/`requireTenant`): no `sat` → anonymous; `sat` < valid_after → anonymous, `sat` ≥ → valid; replay of a pre-sign-out session is refused by all 8 sections (redirect `/login`), PDF, `settings/save`, `regenerate` (all 401), and a later session works; `revokeSessions` doesn't touch another user or a wrong company; `buildSessionCookie` and the welcome route stamp `sat`, the cookie is valid right after issue, welcome link is single-use.
- **`scripts/smoke.sh`:** replay of the pre-sign-out cookie jar + sign in again (below).
- Claim verified by reading: `requireTenant`, `requireTenantRoute`, the document/PDF routes, `settings/save` and `/api/documents/regenerate` all reach identity only through `getTenant()` (`tests/dashboard-gate.test.ts` also enforces no dashboard file calls it directly). No other change was needed there.

## Before / after: replaying the cookie copied before sign-out (raw smoke lines)
Check on `getTenant` temporarily commented out (`verify.sh` exit 1, smoke FAIL — the old cookie still works after sign-out):
```
FAIL  REPLAY pre-sign-out cookie: /dashboard -> /login
FAIL  REPLAY pre-sign-out cookie: /dashboard/billing -> /login
FAIL  REPLAY pre-sign-out cookie: PDF route -> 401
FAIL  REPLAY pre-sign-out cookie: settings/save -> 401
FAIL  REPLAY pre-sign-out cookie: regenerate -> 401
FAIL  REPLAY did not change the company name
ok    sign in again after sign-out: link sets a new session
FAIL  sign in again: the pre-sign-out cookie is still refused
FAIL  the original jar (same user, another browser) ended too: all of that user's sessions end
smoke: FAIL
```
(The FAILs are the assertions "refused"; the failing `settings/save` line also means the replay was accepted and renamed the company, hence "did not change the company name" FAIL.) With the check restored (code tip):
```
ok    REPLAY pre-sign-out cookie: /dashboard -> /login
ok    REPLAY pre-sign-out cookie: /dashboard/billing -> /login
ok    REPLAY pre-sign-out cookie: PDF route -> 401
ok    REPLAY pre-sign-out cookie: settings/save -> 401
ok    REPLAY pre-sign-out cookie: regenerate -> 401
ok    REPLAY did not change the company name
ok    sign in again after sign-out: link sets a new session
ok    sign in again: new session reaches /dashboard (200) and the PDF
ok    sign in again: the pre-sign-out cookie is still refused
ok    the original jar (same user, another browser) ended too: all of that user's sessions end
smoke: PASS
```
I did not capture literal HTTP 200 codes for the reverted run; the smoke asserts refusal, so FAIL = not refused. I changed the old smoke check "other browser (company 1's original jar) … unaffected" to its opposite — that was the stale-cookie behavior this phase removes.

## verify.sh on code tip 34b125b (non-"ok" smoke lines trimmed; smoke 156 ok lines, 0 FAIL)
```
--- commit state
current HEAD               34b125b  (2026-10-14T22:18:45+00:00)
branch                     phase-4b-session-revocation
comparing against          cc626d7
commits this pass          2
uncommitted changes        0 file(s)
test files changed          1 file changed, 247 insertions(+)
--- secrets
secrets                    none found
.env.example               present
--- database
fresh database             verify_1792016325_3189
db:migrate                 ok (from scratch)
tables created             16
--- lint
lint                       ok
--- typecheck
typecheck                  ok
--- tests
 Test Files  24 passed (24)
      Tests  331 passed (331)
   Start at  22:18:54
   Duration  9.12s (tests 46%, import 28%, setup 14%, environment 9%, transform 3%)

     Import  143 modules were evaluated 633 times · 6.31s total, 28% of tracked time
             ~1.11s faster with isolate: false — shared modules are evaluated once per worker instead of once per file
             learn more: https://vitest.dev/guide/improving-performance#test-isolation
test exit code             0
counts                     total=331 pass=331 fail=0 skip=0
--- build
build                      ok
standalone output          present
--- smoke
smoke: PASS (port 37091)
smoke                      ok
--- invariants
migration drift            schema changed, migration present
tenant isolation           all tenant tables carry company_id
legal citations            none outside lib/content/
forbidden claims           none
geo                        CF-IPCountry only
urls                       no locale codes in paths
request company_id         never read from the request
KNOWN_ISSUES.md            present
--- result
verify.sh: PASS (HEAD 34b125b)
```
Prettier flags the two generated drizzle `meta/*.json` files; `verify.sh` doesn't run prettier, and drizzle regenerates them, so I left them as generated.

## CI
PR/CI run id and head SHA: see PR comment/links below (filled after push).

## Judgment calls
- Sign-out calls `requireTenant()` (not `getTenant()`) to get the tenant, because `dashboard-gate.test.ts` forbids `getTenant` in dashboard files. Consequence: an already-anonymous sign-out submit redirects to `/login` without a write (nothing to revoke; the cookie is already void).
- Sign-out ends all of the user's sessions, including other browsers (as scoped). Tests and smoke assert it.
- `sat` is compared as ms against `Date#getTime()` of a microsecond timestamp (truncated), so a session minted in the same millisecond as a sign-out counts as valid; no tolerance windows added.
- Sign-in-link and return-token minting are covered by the smoke (existing flows now only pass if `sat` is present, since `/dashboard` and `/onboarding` checks follow them) plus unit tests for `buildSessionCookie` and the welcome route; the Auth.js `jwt` callback itself has no isolated unit test.

## Found / for the supervisor
- Only those three minting paths exist (`grep` of `buildSessionCookie`, `encode(`, `signIn(`): Auth.js email callback, welcome link, return-token. The `/login` form uses Auth.js `signIn("email")` → the `jwt` callback.
- Existing sessions have no `sat` and are rejected, as expected (deploy signs the admin out once).
- Deploy note: migration `0003` is additive but is a migration against the live DB — CLAUDE.md §4 says Esteban is in the loop for that.
