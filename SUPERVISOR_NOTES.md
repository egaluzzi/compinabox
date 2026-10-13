# Supervisor notes — [WORKER task | VERIFICATION request]

Overwrite each time — a relay, not a log. One relay at a time: never a worker task and a verification request in the same file. Worker/verifier: read this at the start of your session before anything else.

---

## If this is a WORKER task

### Context
[One or two sentences — a review finding, a follow-up, a newly scoped phase.]

### Scope
Phase: [IMPLEMENTATION_PLAN.md phase number and name]
Branch: [create `phase-N-short-name` from `main`, or continue `<branch>`]
Permission mode: Accept edits.

### Action items
1. [Specific and self-contained — actionable without any conversation context. Reference `CLAUDE.md` / `SPEC.md` / `IMPLEMENTATION_PLAN.md` sections directly.]
2. [...]

### Report back
Run `./verify.sh`, tick completed items in `IMPLEMENTATION_PLAN.md`, write `HANDOFF.md` per its template with real evidence pasted, commit everything, push the branch, open a PR against `main` whose description is a copy of `HANDOFF.md`, then stop. Do not merge.

---

## If this is a VERIFICATION request

**Do not read `HANDOFF.md`.** The implementation narrative would bias you, which defeats the point.

### Claim to test
[One claim, stated flatly, no account of how it was built or why it should work.]

### How to test it
Branch: [name]
[Commands. Re-run suites freely — your context is disposable.]

### Report back
Overwrite `HANDOFF.md` with: **verdict** (holds / does not hold / inconclusive), the raw output you based it on, and nothing else. No narrative, no fixes. Commit and push.
