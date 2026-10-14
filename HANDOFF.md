# Handoff — Phase 1 follow-up fixes (PR #2), 2026-10-14

Scope: the two fixes in SUPERVISOR_NOTES.md (origin/main 6ce16b4). Nothing else changed. Do not merge — PR #2 is still open.

**Code tip: f279e2a** (`f279e2a20e03ec848ea01041b027029c6919cea8`). The pushed tip is one commit later and adds only this file.
Commits: `verify.sh` fix (own commit), then `proxy` fix.

## What changed

1. **`verify.sh` 4d exemption** now requires a non-letter (or line start) before the negation word, so `no` inside `plano` no longer exempts a claim.
2. **`proxy.ts` redirect** builds the absolute `Location` from `APP_URL` (origin only; a path on `APP_URL` is dropped), falling back to `request.url`
   when `APP_URL` is unset or does not parse. Still 307 + `Cache-Control: no-store`. The pure helper is `redirectLocation()` in `lib/geo.ts`.
   Unit tests (4 new, `tests/proxy.test.ts`): set -> `https://example.test/br`; path on `APP_URL` ignored; unset -> `http://localhost:3000/br`;
   invalid (`not a url`) -> falls back, no throw. `scripts/smoke.sh` needed no change and still passes.

## Item 1 evidence — raw output (the first block shows the defect with the OLD filter; the rest is the NEW filter, same pipeline as `verify.sh` 4d)

```
$ OLD exemption on "Nosso plano garante a conformidade":
(nothing flagged -> slipped through)

=== must be FLAGGED (lines printed = flagged) ===
1:We guarantee compliance
2:Nosso plano garante a conformidade
3:Garantizamos el cumplimiento
4:Tu programa garantiza el cumplimiento
=== must be EXEMPT (nothing printed below = exempt) ===
[en scanned]
[es-AR scanned]
[es-MX scanned]
[pt-BR scanned]
=== real scan pipeline on repo ===
(nothing flagged)
```

The "must be exempt" lines are the three real footer disclaimers read straight from `messages/*.json` (`en`; `es-AR`+`es-MX`; `pt-BR`); each scanned clean.
The last block is the unmodified pipeline over `app messages lib/content` in the repo: nothing flagged.

## Extra check on item 2 (runtime, not just unit tests)

Standalone server started with `APP_URL=https://example.test` and no other config:
```
$ curl -sI -H "CF-IPCountry: BR" http://localhost:3995/
HTTP/1.1 307 Temporary Redirect
cache-control: no-store
location: https://example.test/br
```
So the env var is read at request time, not inlined at build. (Still simulated headers; not through Caddy/Cloudflare.)

## Diff (`verify.sh`, `proxy.ts`, `lib/geo.ts`; test file changes are the 4 tests above)

```diff
diff --git a/lib/geo.ts b/lib/geo.ts
index 77eb969..08bc99f 100644
--- a/lib/geo.ts
+++ b/lib/geo.ts
@@ -31,3 +31,23 @@ export function resolveGeoRedirect({
   const header = cfCountry?.trim().toLowerCase();
   return isCountry(header) ? header : null;
 }
+
+/**
+ * Absolute redirect target. Behind Caddy the process sees an internal scheme/host in
+ * `request.url`, so APP_URL (the public origin) wins when it is set and parses;
+ * otherwise fall back to the request's own URL.
+ */
+export function redirectLocation(
+  country: Country,
+  requestUrl: string,
+  appUrl: string | undefined,
+): URL {
+  if (appUrl) {
+    try {
+      return new URL(`/${country}`, new URL(appUrl).origin);
+    } catch {
+      // invalid APP_URL: fall through
+    }
+  }
+  return new URL(`/${country}`, requestUrl);
+}
diff --git a/proxy.ts b/proxy.ts
index e7cb3e2..4c1738c 100644
--- a/proxy.ts
+++ b/proxy.ts
@@ -1,5 +1,5 @@
 import { NextResponse, type NextRequest } from "next/server";
-import { resolveGeoRedirect } from "@/lib/geo";
+import { redirectLocation, resolveGeoRedirect } from "@/lib/geo";
 
 // Next 16 renamed the `middleware` file convention to `proxy`.
 // Geo redirect from `/` only (SPEC §3.2); the decision lives in lib/geo.ts.
@@ -12,8 +12,9 @@ export function proxy(request: NextRequest) {
   if (!target) return NextResponse.next();
 
   // 307 + no-store: the answer depends on the visitor, and Cloudflare sits in front.
+  // Location is built from APP_URL: behind Caddy request.url carries the internal scheme/host.
   const response = NextResponse.redirect(
-    new URL(`/${target}`, request.url),
+    redirectLocation(target, request.url, process.env.APP_URL),
     307,
   );
   response.headers.set("Cache-Control", "no-store");
diff --git a/verify.sh b/verify.sh
index b8f92f7..bee492d 100755
--- a/verify.sh
+++ b/verify.sh
@@ -119,7 +119,7 @@ fi
 # 4d. Forbidden claims in copy (CLAUDE.md §8)
 # A *negated* guarantee ("does not guarantee compliance", "no garantiza el cumplimiento", "não garante a conformidade")
 # is the approved footer disclaimer (CONTENT.md §1), not a claim — those lines are exempt.
-BANNED=$(grep -rniE 'guarantee[sd]? (legal )?compliance|garantiza(mos)? (el )?cumplimiento|garante (a )?conformidade|ISO ?3730[12]|certif(ied|icado|icada) (by|por) (la )?ley' app messages lib/content 2>/dev/null | grep -viE '(does not|do not|doesn.t|no|não|nao|never|nunca) +(guarantee|garantiza|garante)' || true)
+BANNED=$(grep -rniE 'guarantee[sd]? (legal )?compliance|garantiza(mos)? (el )?cumplimiento|garante (a )?conformidade|ISO ?3730[12]|certif(ied|icado|icada) (by|por) (la )?ley' app messages lib/content 2>/dev/null | grep -viE '(^|[^[:alpha:]])(does not|do not|doesn.t|no|não|nao|never|nunca) +(guarantee|garantiza|garante)' || true)
 if [ -n "$BANNED" ]; then echo "$BANNED" | head; bad "forbidden claims" "copy implies guaranteed compliance or ISO certification"; else note "forbidden claims" "none"; fi
 
 # 4e. Second geo mechanism must not exist (CLAUDE.md §4)
```

## Full `./verify.sh` output on code tip f279e2a (exit code 0)

```
--- commit state
current HEAD               f279e2a  (2026-10-14T00:14:24+00:00)
branch                     phase-1-marketing
comparing against          de2d416
commits this pass          9
uncommitted changes        0 file(s)
test files changed          7 files changed, 386 insertions(+), 12 deletions(-)
--- secrets
secrets                    none found
.env.example               present
--- lint
lint                       ok
--- typecheck
typecheck                  ok
--- tests
 Test Files  6 passed (6)
      Tests  60 passed (60)
   Start at  00:14:33
   Duration  1.70s (environment 64%, setup 20%, import 6%, tests 6%, transform 3%, worker 1%)

Environment  jsdom was created 6 times · 2.33s total, 64% of tracked time
             create it once per worker with pool: 'vmThreads' (keeps per-file isolation) or isolate: false (shares it across files)
             learn more: https://vitest.dev/guide/improving-performance#test-environments
test exit code             0
counts                     total=60 pass=60 fail=0 skip=0
--- build
build                      ok
standalone output          present
--- smoke
ok    BR header -> redirect to /br
ok    AR header -> redirect to /ar
ok    DE header -> 200 on /
ok    cookie country=mx beats BR header
ok    deep link /ar/pricing not redirected (200)
ok    /ar carries noindex (disabled country)
ok    /br has no noindex (enabled country)
ok    sitemap.xml has <loc> entries
ok    sitemap.xml excludes disabled /ar
ok    cookie country=other + BR header -> 200, no redirect
ok    redirect status is 307
ok    redirect carries cache-control: no-store
ok    invalid country cookie ignored, header decides
ok    /checkout -> 200
ok    /legal/terms -> 200
ok    /zz -> 404
ok    /pt-BR -> 404
ok    robots.txt disallows /dashboard
ok    robots.txt disallows /employee
ok    robots.txt disallows /checkout
ok    robots.txt disallows /onboarding
ok    ENABLED_COUNTRIES=br,ar at runtime: /ar has no noindex
ok    ENABLED_COUNTRIES=br,ar at runtime: /mx still noindex
smoke: PASS (port 42409)
smoke                      ok
--- invariants
db                         no schema yet (pre-phase 2)
forbidden claims           none
geo                        CF-IPCountry only
urls                       no locale codes in paths
KNOWN_ISSUES.md            present
--- result
verify.sh: PASS (HEAD f279e2a)
```

## CI

CI run **38489077543** on head `f279e2a20e03ec848ea01041b027029c6919cea8`: the API still showed `in_progress` (step "Run ./verify.sh") when this file was written; the supervisor should confirm the conclusion on the PR page. Local `./verify.sh` on the same SHA passed (above).

## Open questions

- None new. Reminder from Phase 1: `APP_URL` must be set correctly in `/opt/compinabox/.env` on the droplet, or redirects fall back to `request.url`.
