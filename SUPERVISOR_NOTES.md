# Supervisor notes — worker task: Phase 4b (server-side session revocation)

Overwrite each time — a relay, not a log. Only one relay at a time. Read this at the start of
your session before anything else.

---

## If this is a WORKER task

### Context
Phases 0-4 are merged. The phase 4 review found a real security gap: **signing out only clears the
cookie.** Sessions are stateless Auth.js JWTs valid 7 days, so a copied cookie keeps working after
sign-out (the phase 4 worker replayed one by hand and `/dashboard` returned 200). Whistleblower data
arrives in phase 5, so this is closed first. This is a **small, focused** task: one column, one check,
one write, tests. Auth + tenancy = deep review; keep the diff tight.

Read first: `CLAUDE.md` (§0, §8, §9), the **Phase 4b** section of `IMPLEMENTATION_PLAN.md`,
`auth.ts`, `lib/auth/tenant.ts` (`getTenant`), `lib/auth/session.ts` (`buildSessionCookie`),
`lib/auth/require-tenant.ts`, the sign-out server action in `app/(app)/dashboard/layout.tsx`,
`lib/auth/links.ts`, `lib/checkout/return.ts`. Branch `phase-4b-session-revocation` from current
`main`; PR to `main`; don't merge; don't push to `main`.

**Out of scope:** switching to database sessions, revocation lists, per-device sessions, session
lists/"sign out everywhere" UI, shortening the 7-day lifetime, anything not listed below.

### Decisions already made (record deviations as judgment calls)
- **Mechanism:** `users.sessions_valid_after timestamptz not null default now()` (new migration,
  committed; the verify.sh drift check applies). A session is valid only if it was **issued at or
  after** that instant. Sign-out sets it to `now()`, which ends *all* of that user's sessions (one
  admin per company, so that is the intended meaning).
- **Issue time = an explicit millisecond claim `sat` in the JWT**, not `iat` (second resolution would
  leave a one-second window or reject a session created right after a sign-out in the same second). Set
  `sat = Date.now()` in **every** place a session is minted: the Auth.js `jwt` callback when `user` is
  present (sign-in link), `buildSessionCookie` (welcome link and the post-payment return-token
  sign-in). Expose it on the session object so `getTenant` can read it. Tokens without `sat` (all
  pre-existing sessions) are rejected; that is acceptable, nothing is live.
- **Check:** in `getTenant()` the user lookup already runs on every request; select
  `sessions_valid_after` in the same query and return `null` (anonymous) if `sat` is missing or
  `< sessions_valid_after`. No extra query. `requireTenant`/`requireTenantRoute`/document and PDF
  routes need no other change because they all go through `getTenant()` — verify that claim by reading
  them, and say so in HANDOFF.md.
- **Sign-out:** the existing server action first runs `UPDATE users SET sessions_valid_after = now()`
  for the session's user (id AND company from the session, never from the request), then clears the
  cookie as today. If the update fails, the action must fail visibly (don't silently clear only the
  cookie).
- Clock: use the database's `now()` for `sessions_valid_after` and compare against `sat` taken from the
  app clock only in whole milliseconds; leave a comment that the droplet and Postgres share a clock
  (same host). Do not add tolerance windows.

### Action items
1. Migration + schema column + `sat` in all three minting paths + `getTenant` check + sign-out write.
2. Tests (Vitest, real Postgres, in the style of `tests/dashboard-*.test.ts*`): a session without `sat`
   → anonymous; `sat` before `sessions_valid_after` → anonymous; `sat` after → valid; sign-out advances
   `sessions_valid_after` and a pre-sign-out session is then refused by **every** dashboard section, the
   PDF route, `settings/save` and `/api/documents/regenerate` (reuse the existing per-route harness);
   a session issued after the sign-out works; the sign-in link, welcome link and return-token flows each
   produce a session that is valid right after issue and still single-use.
3. `scripts/smoke.sh` (permitted edit, only this): after the existing sign-out step, **replay the cookie
   jar copied from before sign-out** against a dashboard section, the PDF route, `settings/save` and
   regenerate → all refused (redirect to `/login` / 401); then sign in again and confirm access.
   Show the smoke lines.
4. Keep the existing coverage tests green (`dashboard-gate`, tenant, auth). No new dependencies.

### Definition of done
`./verify.sh` exit 0; the new tests; the smoke replay. In HANDOFF.md include the **before/after**:
run the replay against the old code path (e.g. temporarily revert the `getTenant` check) to show the
replay returns 200, then with the check it is refused — raw output.

### Report back
Short `HANDOFF.md` per the template: what changed (diff of `getTenant`, the sign-out action, the three
minting paths, the migration), evidence as above, full `./verify.sh` output on the final code commit, CI
run id + head SHA via the GitHub tools, code tip vs pushed tip, judgment calls, anything you found
about other session-minting paths I did not list.

---

## If this is a VERIFICATION request

Not applicable for this relay.
