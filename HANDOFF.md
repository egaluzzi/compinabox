# Handoff — Phase 0: repo scaffold and groundwork, 2026-10-13

## Evidence block

Full `./verify.sh` output on code tip 73d8ef5 (run locally, after the last code commit):

```
--- commit state
current HEAD               73d8ef5  (2026-10-13T18:05:19+00:00)
branch                     phase-0-scaffold
comparing against          8ab4a41
commits this pass          6
uncommitted changes        0 file(s)
test files changed          2 files changed, 26 insertions(+)
--- secrets
secrets                    none found
.env.example               present
--- lint
lint                       ok
--- typecheck
typecheck                  ok
--- tests
 RUN  v5.0.4 /home/user/compinabox

 ✓ tests/home.test.tsx (1 test) 174ms

 Test Files  1 passed (1)
      Tests  1 passed (1)
   Start at  18:06:09
   Duration  1.21s (environment 68%, tests 17%, setup 9%, import 3%, transform 2%)
test exit code             0
counts                     total=1 pass=1 fail=0 skip=0
--- build
build                      ok
standalone output          present
--- invariants
db                         no schema yet (pre-phase 2)
forbidden claims           none
geo                        CF-IPCountry only
urls                       no locale codes in paths
KNOWN_ISSUES.md            present
--- result
verify.sh: PASS (HEAD 73d8ef5)
```

```
verify.sh exit code:   0
current HEAD:          73d8ef5 (code tip). The pushed tip is one commit later and adds ONLY HANDOFF.md
                       (verify.sh requires a clean tree, so output cannot be pasted into the commit it
                       describes). CI re-ran verify.sh on the PR merge ref (HEAD cf14184 in its log).
branch:                phase-0-scaffold
PR:                    https://github.com/egaluzzi/compinabox/pull/1
uncommitted changes:   0
test files changed:    2 files changed, 26 insertions(+)   (tests/home.test.tsx smoke test + vitest.setup.ts)
```

CI (ci.yml): run 1 (head 025d87b) **failed**, see Bugs. Run 2 (id 38443926988, head SHA
73d8ef518507e9730d215500bafe909ba368eeae = code tip) log ends `verify.sh: PASS`. Caveat: the GitHub
MCP status API still reported "in_progress" for run 2 when I read the job log, so I am quoting the
log, not a `conclusion` field. Supervisor should confirm green on the PR page.

`npm run build` produced .next/standalone (verify.sh: "standalone output present").

## Verification depth

- **Unit tests (mocked):** one jsdom smoke test renders the placeholder page and finds the "ComplyStart" heading. Proves only that the page renders.
- **Live database:** N/A — nothing touches a database.
- **Real HTTP round-trip:** yes. After build: `PORT=3458 node .next/standalone/server.js`, `curl` of `/` returned **200**, body started `<!DOCTYPE html><html lang="en">...` and contains `<h1 class="text-3xl font-semibold">ComplyStart</h1>`. Server stopped afterwards.
- **Real external calls:** N/A — none exist.

## What was built

All Phase 0 checklist boxes ticked in IMPLEMENTATION_PLAN.md. Next.js 16.4.0 / React 19.3.0 / Tailwind 4.3.3 (via @tailwindcss/postcss) / TypeScript 5.9.3 / ESLint 9 (flat config, eslint-config-next) / Prettier / Vitest 5.0.4 + Testing Library + jsdom; `output: 'standalone'`; `.nvmrc` = 22 and `engines` ">=22 <23"; placeholder page (product name only); exact versions in package.json, package-lock.json committed; scripts per CLAUDE.md §7 plus `format:check` and `start`; `.env.example` (all 12 keys, `changeme` placeholders); `.gitignore`; `.github/workflows/ci.yml` (pull_request to main + workflow_dispatch, fetch-depth 0, Node from .nvmrc, npm ci, ./verify.sh; no deploy, no secrets); README; CLAUDE.md §4 "(phase 0)" -> "(phase 9)" and §7 note edited. KNOWN_ISSUES.md untouched.

## Bugs found and fixed

- **verify.sh not executable in git (mode 100644).** CI's `./verify.sh` would fail with permission denied. Fixed with `chmod +x` (mode change only). Would have broken CI.
- **CI run 1 failed:** vitest emits ANSI colour codes on the CI runner, so verify.sh's `^\s*Tests\s` summary grep missed the line ("no summary line") although the test passed. Fixed in `ci.yml` via `NO_COLOR=1`/`FORCE_COLOR=0` env, **not** by editing verify.sh. Not an issue locally (non-TTY). Worth hardening in verify.sh later (supervisor's call).

## Judgment calls made

- `db:generate` / `db:migrate` are placeholders printing "not available until phase 2 (Drizzle)" to stderr and exiting 1, as instructed.
- verify.sh edit (item 4): geo grep (4e) matched `node_modules/vite/dist/node/index.d.ts`. Diff: added `--exclude-dir=node_modules --exclude-dir=.next` to that one grep. Plus the mode change above. Nothing else.
- `create-next-app` was run in a scratch dir and copied in (the repo root was non-empty). The generator's output differed from older Next versions; I removed its `cacheComponents`, `partialPrefetching` and Turbopack-Tailwind-loader config and the Google-font imports (build-time network fetch, extra risk) in favour of plain config + `@tailwindcss/postcss`. I also dropped starter SVGs/favicon and the generated AGENTS.md (it said `next dev` re-creates it; it will show up untracked after `npm run dev`).
- Pinned `@types/node` to 22 to match the Node 22 pin (v26 conflicted with vitest peer deps).
- Prettier ignores `*.md` and `verify.sh` so it does not reformat the pre-approved docs (an early `prettier --write` did; I reverted it before committing).
- Vitest tests live in `tests/`; `@` alias configured in `vitest.config.mts`.
- The first CI-fix commit added to the PR beyond the 5 planned commits (6 total + HANDOFF).

## Not done / deferred / blocked

Nothing blocked; no Guardrail touched. Out-of-scope items not done: Caddy/systemd/backups, deploy workflow, DB, anything in phases 1–11.

## Open questions for the supervisor

- `npm install` reports 5 high-severity audit findings in the generated dependency tree; not investigated or "fixed" (would mean changing pinned versions). Worth a look before launch.
- CI warns actions/checkout@v4 and setup-node@v4 run on deprecated Node 20; bump when convenient.
- Consider making verify.sh's vitest summary parse colour-proof.
