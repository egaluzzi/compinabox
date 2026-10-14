# Supervisor notes — worker task: Phase 1 follow-up fixes (PR #2, branch `phase-1-marketing`)

Overwrite each time — a relay, not a log. Read this at the start of your session.

---

## If this is a WORKER task

### Context
Phase 1 review: everything checks out (CI green on `16fb6c3` and `761cf4d`, scope respected, copy
provenance good) **except two defects**, both found by reading the diff, not by re-running anything.
Fix both on the existing `phase-1-marketing` branch (same PR #2), nothing else. Don't touch the
rest of the PR. Your other judgment calls (2-15 in HANDOFF.md) are approved as written, and the
third `verify.sh` edit is approved **in principle** (needed) but must be tightened as in fix 1.

### Action items

1. **`verify.sh` 4d negation exemption is too loose — a real claim slips through.**
   The filter `(does not|do not|doesn.t|no|não|nao|never|nunca) +(guarantee|garantiza|garante)` has
   no word boundary, so `no` matches inside other words: `Nosso plano garante a conformidade`
   ("plano garante") is silently **exempted** and the forbidden-claims check passes on a positive
   guarantee claim. I reproduced it locally. Fix: require the negation word to start at a word
   boundary, e.g. `(^|[^[:alpha:]])(does not|do not|doesn.t|no|não|nao|never|nunca) +(guarantee|garantiza|garante)`
   (any equivalent is fine). Keep it in its own commit. **Evidence required in HANDOFF.md** (paste
   raw output, not prose): run the exact scan pipeline over these lines and show which are flagged —
   must be flagged: `We guarantee compliance`, `Nosso plano garante a conformidade`,
   `Garantizamos el cumplimiento`, `Tu programa garantiza el cumplimiento`; must be exempt: the three real footer disclaimers
   (`en`, `es-AR`/`es-MX`, `pt-BR`) taken straight from `messages/*.json`.

2. **Redirect `Location` will be wrong behind Caddy/Cloudflare.**
   `proxy.ts` builds the redirect from `request.url`. In the standalone server behind Caddy that URL
   has the internal scheme (`http`) and whatever host the process sees, so a Brazilian visitor can be
   sent to `http://…/br` (or an internal host). Fix: build the absolute `Location` from `APP_URL`
   (already an env var, already used for `metadataBase`/sitemap) when it is set and parses as a URL,
   falling back to `request.url` otherwise. Keep 307 + `no-store`. Add unit tests in
   `tests/proxy.test.ts`: with `APP_URL=https://example.test` the `Location` is
   `https://example.test/br`; with `APP_URL` unset it falls back; with an invalid `APP_URL` it falls
   back (doesn't throw). `scripts/smoke.sh` already exports `APP_URL=http://localhost:$PORT`, so its
   assertions should keep passing; if they don't, say why.

3. Re-run `./verify.sh` on the final code commit, push, wait for `ci.yml` on the PR head, and **overwrite
   HANDOFF.md** with a short follow-up report (what changed, the item-1 raw output, new `verify.sh` and
   `proxy.ts` diffs, full `./verify.sh` output, CI run id + head SHA, code tip vs pushed tip). Don't
   re-paste the Phase 1 report. Do not merge.

### Out of scope
Anything not listed. If you notice something else, put it under "Open questions".

---

## If this is a VERIFICATION request

Not applicable for this relay.
