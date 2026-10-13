# Handoff — [phase/task name], [date]

Worker session's report to the supervisor. Overwrite this file each time — it's a relay, not a log; the permanent record lives in `IMPLEMENTATION_PLAN.md`. Commit it in your branch together with the work.

The supervisor audits this report rather than re-running your work. That only holds if the evidence below is **falsifiable** — facts that would look wrong if they were wrong. "I verified it" tells the supervisor nothing. Paste real output.

## Evidence block

Paste the full `./verify.sh` output here, unedited.

```
[./verify.sh output]
```

Then fill in:

```
verify.sh exit code:   [0 / nonzero + what failed]        <- must be 0
current HEAD:          [sha, from verify.sh]              <- must equal the pushed branch tip
branch:                [name]
PR:                    [url, or "not opened"]
uncommitted changes:   [0]                                <- must be 0
test files changed:    [verify.sh line]                   <- if not "none", explain below
```

If any of these don't hold, say why *here*, plainly. An unexplained mismatch is the single most useful signal in this file.

## Verification depth

What each claim was verified *against*. Mock-only is unverified for anything that talks to a database, Stripe, Resend, OpenSanctions, or the network.

- **Unit tests (mocked):** [what passed; what it does and doesn't prove]
- **Live database:** [ran against a real Postgres? which one? migrations applied from scratch?]
- **Real HTTP round-trip:** [through `npm start` of the standalone build, or only internal logic?]
- **Real external calls:** [Stripe test mode / Resend / OpenSanctions — happened, or mocked?]

## What was built

[Concrete — what changed, in which files, and why. Reference the IMPLEMENTATION_PLAN.md checklist items by name and tick them in that file.]

## Bugs found and fixed (if any)

[Real bugs found incidentally, distinct from the task. State severity plainly — say if one would have broken production.]

## Judgment calls made (if any)

[Anything ambiguous you decided rather than were told. Don't bury these in "what was built" — an unflagged call becomes shipped policy.]

## Not done / deferred / blocked

[Explicitly incomplete items and why. If you hit a Guardrail (CLAUDE.md §8) or an input only Esteban has, write **blocked** and what's needed — don't invent a default.]

## Open questions for the supervisor

[Anything blocking or worth a second opinion before the next phase.]
