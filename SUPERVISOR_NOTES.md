# Supervisor notes — worker task (Phase 0: scaffold)

Overwrite each time — a relay, not a log. Only one relay at a time; don't queue a worker task
and a verification request together. Read this at the start of your session before anything
else.

---

## If this is a WORKER task

### Context
Phase 0 of the ComplyStart build: stand up an empty, correctly-configured project skeleton so
that every later phase (SPEC.md §14, CLAUDE.md "Build order") starts from a repo where
`lint`, `typecheck`, `test`, and `build` all run. **This phase builds no product features.**

Work on branch `phase-0-scaffold` (create it from `main`). Do not push to `main`.

**Heads-up on missing docs:** `IMPLEMENTATION_PLAN.md` does not exist in the repo yet, and
SPEC.md §14 defines phases 1–9 with no "Phase 0". This task is therefore scoped from CLAUDE.md
(Stack, Hosting, Repo conventions, Commands) and SPEC.md §12. Do not invent an
IMPLEMENTATION_PLAN.md; if something below seems to contradict SPEC.md, SPEC.md wins — note
the conflict in HANDOFF.md rather than resolving it silently.

### Action items
1. **Branch.** `git checkout -b phase-0-scaffold` from `main`. Read `CLAUDE.md`, `SPEC.md`
   (§3.2, §4, §9, §11, §12, §14) first. Don't re-derive requirements.

2. **Scaffold Next.js.** App Router, TypeScript (strict), Tailwind, ESLint, `src/` dir NOT used
   (CLAUDE.md conventions are root-relative: `/app`, `/lib`). Use the current stable Next.js
   release; pin exact versions in `package.json` and commit the lockfile (npm).

3. **`next.config`: `output: 'standalone'`** (self-hosted droplet, not Vercel — CLAUDE.md
   "Hosting"). Do not add Vercel-specific config, packages, or analytics.

4. **Install `next-intl`** and nothing else product-related. Do NOT install Stripe, Postgres
   drivers/ORMs, Resend, PDF libraries, or screening clients — those arrive in their own phases.
   Do not wire up locale routing, middleware, or geo-detection (that is Phase 1; the geo
   mechanism — Cloudflare `CF-IPCountry` vs MaxMind — is decided and documented then).

5. **Create the directory skeleton** from CLAUDE.md "Repo conventions", each with a minimal
   placeholder (a `.gitkeep` or a trivial stub that compiles) and **no real content**:
   `app/[locale]/`, `app/(app)/`, `app/report/[slug]/`, `lib/content/`, `lib/documents/`.
   Do NOT create `lib/content/{country}.ts` files — legal citations are flagged-review content
   (CLAUDE.md Guardrails) and are out of scope here. Do not write any marketing copy or
   compliance/legal claims anywhere; the default Next.js starter page may be replaced with a
   neutral placeholder that contains no product claims.

6. **Wire the Commands block** so each exists in `package.json` and exits 0 on the empty
   scaffold: `dev`, `build`, `lint`, `typecheck` (`tsc --noEmit`), `test`. Pick **Vitest** for
   `test` (boring, fast, TS-native) and include one trivial passing smoke test so the runner is
   proven to execute rather than "no tests found". Then update the Commands section of
   `CLAUDE.md` to remove the "fill these in once scaffolded" placeholder note (change nothing
   else in CLAUDE.md).

7. **`.env.example`** listing every key CLAUDE.md names (`STRIPE_SECRET_KEY`,
   `STRIPE_WEBHOOK_SECRET`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SCREENING_API_KEY`,
   `RESEND_API_KEY`) with obviously fake placeholder values, plus a `DATABASE_URL` placeholder.
   Ensure `.env*` (except `.env.example`) is in `.gitignore`. Never commit a real secret.
   Flag in HANDOFF.md that CLAUDE.md lists `SUPABASE_*` while SPEC.md §12 allows plain Postgres
   — leave both keys in, do not resolve it.

8. **`verify.sh` at repo root** (executable, `set -e`): runs `npm ci`, `npm run lint`,
   `npm run typecheck`, `npm run test`, `npm run build`, then confirms
   `.next/standalone/server.js` exists, and prints each step's result. Keep it dumb — no
   judgment in the script.

9. **Prove it runs, not just compiles.** After `build`, start the standalone server
   (`node .next/standalone/server.js` on a free port via `PORT` env) and `curl` the root URL;
   paste the HTTP status and first lines of the response into the evidence block, then stop the
   server. A passing build alone is not sufficient evidence.

10. **Out of scope — stop and flag rather than do:** PM2/systemd/Caddy/Nginx config, CI/deploy
    workflows, database setup or backup cron (CLAUDE.md requires a backup flag when starting
    phase 2+, not here), any page content, any i18n message files, anything from phases 1–9.
    If you think one of these is needed, say so in HANDOFF.md under open questions.

11. **Commit** on `phase-0-scaffold` in small logical commits and push that branch. Do not open
    a PR unless asked.

### Report back
Run `verify.sh`, then write your report to `HANDOFF.md` following its template. Paste real
evidence into the evidence block (full `verify.sh` output, the `curl` result from step 9, and
`git log --oneline` for the branch) and be specific about verification depth — don't just say
"verified." List any deviations, version choices, and the doc conflicts noted above.

---

## If this is a VERIFICATION request

Not applicable for this relay.
