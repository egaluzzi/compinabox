#!/usr/bin/env bash
# verify.sh — mechanical checks for ComplyStart. Run by the worker; output pasted into HANDOFF.md.
#
# Anything that can fail deterministically belongs here, so the supervisor reads an exit code
# instead of redoing judgment. Exit nonzero on any failure. Keep it under ~5 minutes.
#
# Usage:  ./verify.sh            (compares against merge-base with main)
#         BASE=<sha> ./verify.sh (compare against a specific commit)
#         SKIP_BUILD=1 ./verify.sh

set -uo pipefail
fail=0
note() { printf '%-26s %s\n' "$1" "$2"; }
bad()  { printf '%-26s FAIL: %s\n' "$1" "$2"; fail=1; }
hr()   { printf -- '--- %s\n' "$1"; }

# --- 1. Commit state -------------------------------------------------------
hr "commit state"
MAIN_BRANCH=${MAIN_BRANCH:-main}
git fetch -q origin "$MAIN_BRANCH" 2>/dev/null || true
BASE=${BASE:-$(git merge-base HEAD "origin/$MAIN_BRANCH" 2>/dev/null || git merge-base HEAD "$MAIN_BRANCH" 2>/dev/null || git rev-parse HEAD~1)}
HEAD_SHA=$(git rev-parse --short HEAD)
note "current HEAD"        "$HEAD_SHA  ($(git show -s --format=%cI HEAD))"
note "branch"              "$(git rev-parse --abbrev-ref HEAD)"
note "comparing against"   "$(git rev-parse --short "$BASE")"
note "commits this pass"   "$(git rev-list --count "$BASE"..HEAD)"
UNCOMMITTED=$(git status --porcelain | wc -l | tr -d ' ')
note "uncommitted changes" "$UNCOMMITTED file(s)"
[ "$UNCOMMITTED" -eq 0 ] || bad "uncommitted" "commit everything before reporting — tests must run against HEAD"
TESTCHG=$(git diff --stat "$BASE"..HEAD -- '*.test.*' '*.spec.*' '__tests__/*' 'vitest.config.*' | tail -1)
note "test files changed"  "${TESTCHG:-none}"

# --- 2. Secrets never committed -------------------------------------------
hr "secrets"
if git grep -nIE '(sk_live_|sk_test_|whsec_|re_[A-Za-z0-9]{24,}|AUTH_SECRET=.{10,}|postgres://[^$]+:[^$]+@)' -- ':!verify.sh' ':!*.example' ':!*.md' >/dev/null 2>&1; then
  git grep -nIE '(sk_live_|sk_test_|whsec_|re_[A-Za-z0-9]{24,}|AUTH_SECRET=.{10,}|postgres://[^$]+:[^$]+@)' -- ':!verify.sh' ':!*.example' ':!*.md'
  bad "secrets" "credential-looking string committed"
else
  note "secrets" "none found"
fi
[ -f .env.example ] && note ".env.example" "present" || bad ".env.example" "missing"

# --- 2b. Database: fresh Postgres, migrated from scratch --------------------
# Once lib/db/schema.ts exists, DB-backed tests and the live smoke flow need a real Postgres.
# TEST_DATABASE_URL points at a server that may CREATE DATABASE; a fresh database is created for
# this run, migrated with `npm run db:migrate`, and dropped on exit. Unset = FAIL (never skip).
hr "database"
DB_CLEANUP=""
if [ -f lib/db/schema.ts ]; then
  if [ -z "${TEST_DATABASE_URL:-}" ]; then
    bad "database" "TEST_DATABASE_URL is not set — DB-backed tests must fail, not skip"
  else
    ADMIN_URL=${TEST_DATABASE_URL%%\?*}
    FRESH_DB="verify_$(date +%s)_$$"
    if psql "$ADMIN_URL" -qv ON_ERROR_STOP=1 -c "CREATE DATABASE \"$FRESH_DB\"" >/tmp/verify-createdb.log 2>&1; then
      DB_CLEANUP="psql \"$ADMIN_URL\" -qc 'DROP DATABASE IF EXISTS \"$FRESH_DB\" WITH (FORCE)' >/dev/null 2>&1"
      export TEST_DATABASE_URL="${ADMIN_URL%/*}/$FRESH_DB"
      export DATABASE_URL="$TEST_DATABASE_URL"
      note "fresh database" "$FRESH_DB"
      if npm run -s db:migrate >/tmp/verify-migrate.log 2>&1; then
        note "db:migrate" "ok (from scratch)"
        note "tables created" "$(psql "$DATABASE_URL" -Atc "select count(*) from information_schema.tables where table_schema='public'")"
      else
        tail -20 /tmp/verify-migrate.log; bad "db:migrate" "failed against a fresh database"
      fi
    else
      cat /tmp/verify-createdb.log; bad "database" "could not create a fresh database via TEST_DATABASE_URL"
    fi
  fi
else
  note "database" "no schema yet (pre-phase 2)"
fi
trap '[ -n "$DB_CLEANUP" ] && eval "$DB_CLEANUP"' EXIT

# --- 3. Lint / typecheck / tests / build -----------------------------------
hr "lint"
if npm run -s lint >/tmp/verify-lint.log 2>&1; then note "lint" "ok"; else tail -20 /tmp/verify-lint.log; bad "lint" "see above"; fi

hr "typecheck"
if npm run -s typecheck >/tmp/verify-tsc.log 2>&1; then note "typecheck" "ok"; else tail -20 /tmp/verify-tsc.log; bad "typecheck" "see above"; fi

hr "tests"
OUT=$(npx vitest run --reporter=default 2>&1); TEST_EXIT=$?
# strip ANSI colour codes so the summary grep works however vitest decides to colour its output
OUT=$(printf '%s\n' "$OUT" | sed -E 's/\x1b\[[0-9;]*[A-Za-z]//g')
echo "$OUT" | tail -8
note "test exit code" "$TEST_EXIT"
# vitest summary looks like: "Tests  42 passed | 1 failed | 2 skipped (45)"
SUMMARY=$(echo "$OUT" | grep -E '^\s*Tests\s' | tail -1)
if [ -z "$SUMMARY" ]; then
  bad "tests" "no summary line — run did not finish"
else
  PASS=$(echo "$SUMMARY" | grep -oE '[0-9]+ passed'  | grep -oE '[0-9]+' || echo 0)
  FAIL=$(echo "$SUMMARY" | grep -oE '[0-9]+ failed'  | grep -oE '[0-9]+' || echo 0)
  SKIP=$(echo "$SUMMARY" | grep -oE '[0-9]+ skipped' | grep -oE '[0-9]+' || echo 0)
  TOTAL=$(echo "$SUMMARY" | grep -oE '\([0-9]+\)' | grep -oE '[0-9]+' || echo 0)
  note "counts" "total=$TOTAL pass=${PASS:-0} fail=${FAIL:-0} skip=${SKIP:-0}"
  [ "${FAIL:-0}" -eq 0 ] || bad "tests" "$FAIL failing"
  [ "$TEST_EXIT" -eq 0 ] || bad "tests" "nonzero exit ($TEST_EXIT)"
  [ "$TOTAL" -eq 0 ] || [ $(( ${PASS:-0} + ${FAIL:-0} + ${SKIP:-0} )) -eq "$TOTAL" ] || bad "count reconciliation" "$PASS+$FAIL+$SKIP != $TOTAL"
fi

hr "build"
if [ "${SKIP_BUILD:-0}" = "1" ]; then
  note "build" "skipped (SKIP_BUILD=1)"
elif npm run -s build >/tmp/verify-build.log 2>&1; then
  note "build" "ok"
  if [ -d .next/standalone ]; then
    note "standalone output" "present"
    hr "smoke"
    if ./scripts/smoke.sh; then note "smoke" "ok"; else bad "smoke" "see above"; fi
  else
    bad "standalone" ".next/standalone missing — check output: 'standalone' in next.config"
  fi
else
  tail -30 /tmp/verify-build.log; bad "build" "see above"
fi

# --- 4. Project invariants (CLAUDE.md §6, §8) ------------------------------
hr "invariants"

# 4a. Migration drift: schema.ts changed → a migration must exist in the same pass.
if [ -f lib/db/schema.ts ]; then
  if git diff --name-only "$BASE"..HEAD | grep -q '^lib/db/schema.ts$'; then
    if git diff --name-only "$BASE"..HEAD | grep -q '^lib/db/migrations/'; then
      note "migration drift" "schema changed, migration present"
    else
      bad "migration drift" "lib/db/schema.ts changed but no file under lib/db/migrations/ — run npm run db:generate"
    fi
  else
    note "migration drift" "schema unchanged"
  fi
  # 4b. Tenant tables must carry company_id. Any pgTable whose block lacks company_id, except the allowlist.
  ALLOW='^(company|companies|user|users|waitlist_lead|waitlist_leads|session|sessions|account|accounts|verification_token|verification_tokens|checkout_attempt|checkout_attempts|payment_event|payment_events)$'
  MISSING=$(awk '
    /pgTable\(/ { inblk=1; name=$0; sub(/.*pgTable\(["'"'"']/,"",name); sub(/["'"'"'].*/,"",name); has=0; next }
    inblk && /company_id|companyId/ { has=1 }
    inblk && /^\}\)?;?$|^\)\);?$|^\}\);$/ { if (!has) print name; inblk=0 }
  ' lib/db/schema.ts | grep -vE "$ALLOW" || true)
  if [ -n "$MISSING" ]; then bad "tenant isolation" "tables without company_id: $(echo $MISSING | tr '\n' ' ')"; else note "tenant isolation" "all tenant tables carry company_id"; fi
else
  note "db" "no schema yet (pre-phase 2)"
fi

# 4c. Legal citations only in /lib/content/*
if ls app lib/documents >/dev/null 2>&1; then
  CITES=$(grep -rnE '27\.401|12\.846|14\.133|LGRA|Art(í|i)culo 25' app lib/documents 2>/dev/null | grep -v '/lib/content/' || true)
  if [ -n "$CITES" ]; then echo "$CITES" | head; bad "legal citations" "hardcoded outside lib/content/"; else note "legal citations" "none outside lib/content/"; fi
fi

# 4d. Forbidden claims in copy (CLAUDE.md §8)
# A *negated* guarantee ("does not guarantee compliance", "no garantiza el cumplimiento", "não garante a conformidade")
# is the approved footer disclaimer (CONTENT.md §1), not a claim — those lines are exempt.
BANNED=$(grep -rniE 'guarantee[sd]? (legal )?compliance|garantiza(mos)? (el )?cumplimiento|garante (a )?conformidade|ISO ?3730[12]|certif(ied|icado|icada) (by|por) (la )?ley|em conformidade com a lei|atende (integralmente )?(a|às) exigências' app messages lib/content lib/documents 2>/dev/null | grep -viE '(^|[^[:alpha:]])(does not|do not|doesn.t|no|não|nao|never|nunca) +(guarantee|garantiza|garante)' || true)
if [ -n "$BANNED" ]; then echo "$BANNED" | head; bad "forbidden claims" "copy implies guaranteed compliance or ISO certification"; else note "forbidden claims" "none"; fi

# 4e. Second geo mechanism must not exist (CLAUDE.md §4)
if grep -rqiE 'maxmind|geolite|ip-api|ipinfo' --include='*.ts' --include='*.tsx' --include='package.json' --exclude-dir=node_modules --exclude-dir=.next . 2>/dev/null; then
  bad "geo" "second geo mechanism referenced — only CF-IPCountry is allowed"
else
  note "geo" "CF-IPCountry only"
fi

# 4f. Locale codes must not appear as URL segments
if grep -rnE '["'"'"'`]/(es-AR|pt-BR|es-MX|en)/' app lib 2>/dev/null | grep -v hreflang >/dev/null; then
  grep -rnE '["'"'"'`]/(es-AR|pt-BR|es-MX|en)/' app lib | grep -v hreflang | head
  bad "urls" "locale code used as a URL segment — use /ar /br /mx"
else
  note "urls" "no locale codes in paths"
fi

# 4h. company_id must never come from the request (CLAUDE.md §6, §8): not from formData, search
# params, route params, a JSON body or a `[companyId]` path segment. The tenant is the session's.
# Heuristic on purpose (same-line match); tests/dashboard-routes.test.tsx is the behavioural proof.
if [ -d app ]; then
  REQCID=$(grep -rnEi --include='*.ts' --include='*.tsx' \
    -e '(formData|form|searchParams|params|body|query|\.json\(\))[^;]*company_?id' \
    -e 'company_?id[^;]*(formData|searchParams|params\b|\.json\(\)|\.get\()' \
    -e '\.get\(["'"'"'`]company_?id["'"'"'`]\)' app 2>/dev/null | grep -vE '^\S+:[0-9]+:\s*//' || true)
  CIDDIRS=$(find app -type d -iname '*company*id*' 2>/dev/null || true)
  if [ -n "$REQCID" ] || [ -n "$CIDDIRS" ]; then
    echo "$REQCID" "$CIDDIRS" | head
    bad "request company_id" "company_id read from the request under app/ — take it from the session (requireTenant)"
  else
    note "request company_id" "never read from the request"
  fi
fi

# 4g. KNOWN_ISSUES.md must exist (baseline)
[ -f KNOWN_ISSUES.md ] && note "KNOWN_ISSUES.md" "present" || bad "KNOWN_ISSUES.md" "missing"

hr "result"
[ "$fail" -eq 0 ] && echo "verify.sh: PASS (HEAD $HEAD_SHA)" || echo "verify.sh: FAIL (HEAD $HEAD_SHA)"
exit $fail
