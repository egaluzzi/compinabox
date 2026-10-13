# Supervisor notes — worker task: Phase 0 (repo scaffold and groundwork)

Overwrite each time — a relay, not a log. Only one relay at a time; don't queue a worker task
and a verification request together. Read this at the start of your session before anything
else.

---

## If this is a WORKER task

### Context
First build phase. `main` currently holds docs only (CLAUDE.md, SPEC.md, CONTENT.md,
IMPLEMENTATION_PLAN.md, verify.sh, KNOWN_ISSUES.md, HANDOFF.md template). Your job is the
**Phase 0** checklist in `IMPLEMENTATION_PLAN.md`: an empty but correctly configured project
where `./verify.sh` exits 0 and CI runs it on every PR. Read `CLAUDE.md` first (especially §0,
§1, §3, §4, §6, §7, §8), then Phase 0 in `IMPLEMENTATION_PLAN.md`. Do not re-derive anything
those settle.

**Branch:** create `phase-0-scaffold` from `main`. Push that branch and open a PR to `main`
(the Definition of done needs `ci.yml` green on the PR). Do **not** merge it and do **not** push
to `main`.

**This phase builds no features.** No `next-intl`, no Drizzle, no Stripe/Resend/PDF
dependencies, no middleware, no routes beyond the one placeholder page, nothing from
CONTENT.md rendered, no `/lib/content/*` files, no locale files. Those arrive in the phases
that own them. Dependencies are exactly what the checklist names, plus what they transitively
need.

### Action items
Work the Phase 0 checklist top to bottom, ticking each box in `IMPLEMENTATION_PLAN.md` as it is
done. Notes on each, including the calls already made so you don't have to:

1. **Scaffold.** `create-next-app`: TypeScript (strict), Tailwind, App Router, ESLint, `src/`
   **off** (CLAUDE.md §6 paths are root-relative: `/app`, `/lib`), `output: 'standalone'` in the
   Next config. Use the current stable Next.js, pin exact versions in `package.json`, commit
   `package-lock.json` (npm only). Pin Node 22 LTS via `.nvmrc` and `engines`. Replace the
   starter page with a neutral placeholder showing only the product name — no marketing copy, no
   compliance or legal claim of any kind (CLAUDE.md §8).

2. **Tooling.** ESLint (flat config as generated) + Prettier (add `.prettierrc` and a
   `format:check` script, but keep it out of `lint` so `lint` stays the plain eslint command).
   Vitest + Testing Library (+ jsdom). Add **one smoke test** that renders the placeholder page
   and asserts it renders — `verify.sh` runs `npx vitest run` and fails if there is no
   `Tests …` summary line, so a suite with zero tests will fail it.

3. **Scripts, exactly the names in CLAUDE.md §7:** `dev`, `build`, `lint`, `typecheck`
   (`tsc --noEmit`), `test` (`vitest run`), `db:generate`, `db:migrate`. Drizzle is phase 2, so
   make `db:generate` and `db:migrate` placeholder scripts that print
   "not available until phase 2 (Drizzle)" and **exit 1** — exiting 0 would make a migrate that
   did nothing look like success. Record this as a judgment call. Then edit CLAUDE.md §7:
   replace "Phase 0 fills in the real scripts; until then these are the names to use." with a
   one-line note that `db:*` are placeholders until phase 2. Also fix the stale "(phase 0)" in
   CLAUDE.md §4 "Deploy" bullet: the deploy workflow is **phase 9** per the plan. Change nothing
   else in CLAUDE.md.

4. **`./verify.sh` passes on the scaffold.** It already exists — do not rewrite it. Run it,
   read the failures, fix the scaffold. The only time to edit `verify.sh` is a genuine
   false positive. Likely one: the check 4e geo grep (`grep -r … .`) recurses into
   `node_modules` and may match a dependency; if it does, exclude `node_modules` and `.next` from
   that grep and nothing else, and call it out in HANDOFF.md under judgment calls with the exact
   diff. Any other edit to `verify.sh` is out of scope — log it under open questions instead.

5. **`.env.example`** containing every key in CLAUDE.md §6, none omitted: `DATABASE_URL`,
   `AUTH_SECRET`, `AUTH_URL`, `APP_URL`, `ENABLED_COUNTRIES` (value `br`), `RESEND_API_KEY`,
   `EMAIL_FROM`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PUBLISHABLE_KEY`,
   `SCREENING_API_KEY`, `GTM_ID`. Obvious fake placeholders only (e.g. `changeme`); never a
   realistic-looking key.

6. **`.gitignore`:** node, `.next`, `.env*` **with `!.env.example`** re-included, Drizzle output
   (`/drizzle/` and any `*.sqlite`-style artifacts), coverage, OS junk. Build output must be
   ignored or `verify.sh` reports uncommitted changes.

7. **`KNOWN_ISSUES.md`:** the empty table is already committed — leave it, tick the box.

8. **GitHub Actions `.github/workflows/ci.yml`:** on `pull_request` to `main` (and
   `workflow_dispatch`), Ubuntu, Node from `.nvmrc`, `npm ci`, then `./verify.sh`. `verify.sh`
   merge-bases against `origin/main`, so check out with `fetch-depth: 0`. **No deploy workflow**
   — that is phase 9. No secrets, no Postgres service (nothing needs one yet).

9. **`README.md`:** how to run locally (Node version, `npm ci`, `.env` from `.env.example`,
   `npm run dev`, `./verify.sh`) and **two paragraphs** on how the handoff files work
   (`SUPERVISOR_NOTES.md` → worker, `HANDOFF.md` → supervisor, `IMPLEMENTATION_PLAN.md` is the
   permanent record), linking to CLAUDE.md. Do not describe product features.

10. **Prove it runs, not just builds.** After `npm run build`, start the standalone server
    (`PORT=<free port> node .next/standalone/server.js`), `curl -s -o /dev/null -w '%{http_code}'`
    the root and also capture the first lines of the body, then stop the server. A green build
    alone is not evidence for this phase.

11. **Out of scope — stop and log under "Not done" rather than do:** Caddy/systemd/ops files and
    the backup script (phases 2 and 9), any deploy automation, any database setup, anything
    from phases 1–11, and any change to `verify.sh` beyond item 4. Nothing in this phase touches
    a Guardrail (CLAUDE.md §8); if you think something does, write "blocked" and stop.

12. Commit in small logical commits, push `phase-0-scaffold`, open the PR, wait for `ci.yml` to
    finish on the PR head commit, then write `HANDOFF.md` and push that too. Re-check that the
    final pushed tip equals the HEAD printed by your last `./verify.sh` run — if `HANDOFF.md` is
    the only thing committed after the run, re-run `./verify.sh` on the final commit and paste
    that output instead.

### Definition of done (from IMPLEMENTATION_PLAN.md — evidence for each goes in HANDOFF.md)
```
./verify.sh                      # exit 0, full output pasted unedited
npm run build                    # produces .next/standalone
gh run list --limit 1            # ci.yml green on the PR
```
`gh` may not exist in your session; use the GitHub MCP tools (actions list / check run) instead
and paste the workflow run's conclusion, its head SHA, and the PR URL. The head SHA must equal
your pushed branch tip. Plus item 10's live `curl` result.
Judgment items I will check: no feature code; nothing from CONTENT.md rendered; no real or
realistic-looking secret anywhere; the only edits to existing files are the ones named above
(CLAUDE.md §4 and §7 lines, README.md, IMPLEMENTATION_PLAN.md checkboxes, and — only if
justified — the item 4 grep fix).

### Report back
Run `./verify.sh`, then write your report to `HANDOFF.md` following its template (overwrite the
template text). Paste real evidence in the evidence block and be specific about verification
depth: state that nothing here touches a database or external service, so "live database" and
"real external calls" are N/A, and that the real HTTP round-trip was the item 10 standalone
`curl`. List the versions chosen, every judgment call (the `db:*` placeholder scripts at
minimum), and anything in the docs that disagreed with itself or with the scaffold.

---

## If this is a VERIFICATION request

Not applicable for this relay.
