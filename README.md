# ComplyStart

Placeholder product name (see `CLAUDE.md` §11). Durable project context, stack decisions and guardrails live in [CLAUDE.md](CLAUDE.md) — read it first.

## Run locally

- Node 22 (see `.nvmrc`; `nvm use`)
- `npm ci`
- `cp .env.example .env` and fill in values (placeholders only until the phases that use them)
- `npm run dev` — dev server on http://localhost:3000
- `./verify.sh` — lint, typecheck, tests, build and project invariants; must exit 0 before work is handed off

## How the handoff files work

Work runs in phases (see `IMPLEMENTATION_PLAN.md`). A supervisor session scopes the next piece of work in `SUPERVISOR_NOTES.md`, which a worker session reads first. The worker implements it on a branch, runs `./verify.sh`, and reports back in `HANDOFF.md` with the real command output as evidence. Both files are overwritten on every relay; they are not a log.

The supervisor audits `HANDOFF.md` against the evidence and accepts or rejects the phase. `IMPLEMENTATION_PLAN.md` is the permanent record: its checkboxes are ticked as work is accepted. Decisions and rules for both roles are in [CLAUDE.md](CLAUDE.md).
