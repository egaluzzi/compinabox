# Known issues — the baseline

Read this before interpreting any test, lint, or typecheck result. Anything failing that is **not** listed here is a new regression and blocks acceptance.

Each entry names the exact test/file, why it is tolerated, and who tolerated it. Remove entries as they're fixed — keep this file current, don't overwrite it.

Tolerating a failure in a money, auth, tenant-isolation, anonymity or user-visible path is Esteban's decision (CLAUDE.md §0, rule 1/3), not the supervisor's or a worker's.

| Test / file | Symptom | Why tolerated | Added by / date | Remove when |
| :- | :- | :- | :- | :- |
| (none) | | | | |
