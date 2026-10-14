# Supervisor notes — worker task: Phase 2 follow-up (PR #3, branch `phase-2-checkout`)

Overwrite each time — a relay, not a log. Read this at the start of your session.

---

## If this is a WORKER task

### Context
Phase 2 review (deep): the money, auth and tenancy paths hold up — I read the webhook handler,
provisioning transaction, fake-provider guard, return-token/session issuance, sign-in and welcome
links. CI is green on `cd8e5ea` and `186163a`. **One defect to fix**, same branch and PR, nothing
else touched. Your judgment calls 1-19 are approved as written.

### Action item
**`scripts/restore-test.sh` gives a false FAIL on any real restore test.** It compares the restored
row counts with the **live** database. The monthly test restores a dump that is hours or days old;
the live DB will have gained customers, so the counts differ and Esteban sees "FAIL" for a perfectly
good backup. (It only passed in your round trip because nothing wrote between dump and restore.)
Fix: compare the restored counts with the row counts **contained in the dump itself**, so it works
on any dump at any time and does not need `DATABASE_URL`:
- Parse the plain-SQL dump: each table's data is a `COPY public.<table> (...) FROM stdin;` block
  ending with a line `\.`; the number of lines in the block is that table's row count. Count them
  from `gunzip -c`, then restore into the scratch DB and compare per table.
- Also fail if a table present in the dump is missing from the restored DB or vice versa, and fail on
  any psql error (keep `ON_ERROR_STOP`). Keep `SCRATCH_ADMIN_URL` as the only required env var.
- Keep the printed table; columns become `in dump` / `restored`. Update the README "Backups"
  restore-test section to match (no `DATABASE_URL` needed; say what PASS means and what it does not).
- Evidence for HANDOFF.md (raw output): (1) PASS on a fresh dump; (2) **PASS on an old dump after you
  insert extra rows into the live DB** — this is the case that used to false-fail; (3) FAIL when you
  corrupt the dump (e.g. delete a few data lines inside one COPY block, re-gzip) and the failure names
  the table; (4) no leftover scratch databases afterwards.

### Out of scope
Everything else in the PR. If you see another problem, list it under "Open questions".

### Report back
Overwrite `HANDOFF.md` with a short follow-up report: what changed (diff of `scripts/restore-test.sh`
and the README section), the four evidence items, `./verify.sh` raw output on the final code commit,
CI run id + head SHA via the GitHub tools, code tip vs pushed tip. Don't re-paste the Phase 2 report.
Do not merge.

---

## If this is a VERIFICATION request

Not applicable for this relay.
