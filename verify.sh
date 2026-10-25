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
BANNED=$(grep -rniE 'guarantee[sd]? (legal )?compliance|garantiza(mos)? (el )?cumplimiento|garante (a )?conformidade|ISO ?3730[12]|certif(ied|icado|icada) (by|por) (la )?ley|em conformidade com a lei|atende (integralmente )?(a|às) exigências' app messages lib/content lib/documents lib/training lib/employee lib/screening lib/vendors lib/binder lib/legal components 2>/dev/null | grep -viE '(^|[^[:alpha:]])(does not|do not|doesn.t|no|não|nao|never|nunca) +(guarantee|garantiza|garante)' || true)
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

# 4i. Anonymous reporting (CLAUDE.md §8): the whistleblower intake paths read no request metadata
# (headers, forwarded/client address, browser identifier, cookies) and log nothing.
if [ -d app/report ]; then
  if ANON_OUT=$(./scripts/check-anonymity.sh 2>&1); then note "anonymous intake" "no request metadata, no logging"; else echo "$ANON_OUT" | head -20; bad "anonymous intake" "request metadata or console output in app/report, app/api/report or lib/whistleblower"; fi
fi

# 4j. Employee portal (phase 6). The ONE place a client IP is read is lib/employee/client-ip.ts:
#   - `cf-connecting` appears in exactly one non-test file under app/ and lib/ outside the
#     anonymous whistleblower trees (those must contain none: check-anonymity.sh, 4i);
#   - it is called (clientIp()) only by the acknowledge handler, and the ip_address column is
#     touched only by the acknowledgment writer, the admin detail reader and the schema;
#   - no user-agent and no x-forwarded-* is read anywhere in app/ or lib/ (outside whistleblower,
#     which has its own check) and the portal never logs.
# Training copy never says "certificate". `IP_SCAN_DIRS` lets the check be shown failing on a planted file.
if [ -d lib/employee ]; then
  IPDIRS=${IP_SCAN_DIRS:-"app lib components proxy.ts"}
  CF_FILES=$(grep -rlIiE 'cf-connecting' $IPDIRS --include='*.ts' --include='*.tsx' 2>/dev/null | grep -vE '^(lib/whistleblower|app/report|app/api/report)/' | grep -vE '\.test\.' | sort || true)
  if [ "$CF_FILES" = "lib/employee/client-ip.ts" ]; then
    note "client ip" "cf-connecting-ip read only in lib/employee/client-ip.ts"
  else
    echo "$CF_FILES"; bad "client ip" "cf-connecting-ip must be read in exactly one file (lib/employee/client-ip.ts)"
  fi
  CALLERS=$(grep -rlIE 'clientIp\(' $IPDIRS --include='*.ts' --include='*.tsx' 2>/dev/null | grep -v '^lib/employee/client-ip.ts$' | sort || true)
  if [ "$CALLERS" = "app/employee/api/acknowledge/route.ts" ]; then
    note "client ip callers" "only the acknowledge handler"
  else
    echo "$CALLERS"; bad "client ip callers" "clientIp() may only be called by app/employee/api/acknowledge/route.ts"
  fi
  IPCOLS=$(grep -rlIE 'ipAddress|ip_address' app lib components --include='*.ts' --include='*.tsx' 2>/dev/null | grep -v '^lib/db/migrations/' | LC_ALL=C sort || true)
  IPALLOW=$(printf '%s\n' 'app/(app)/dashboard/employees/[id]/page.tsx' lib/db/schema.ts lib/employee/acknowledge.ts lib/employee/detail.ts | LC_ALL=C sort)
  if [ "$IPCOLS" = "$IPALLOW" ]; then
    note "ip column" "only schema, acknowledgment writer, admin detail reader and its page"
  else
    echo "$IPCOLS"; bad "ip column" "ip_address touched outside schema / acknowledge.ts / detail.ts / employee detail page"
  fi
  OTHERHDR=$(grep -rnIiE "get\([\"'\`](x-forwarded[a-z-]*|user-agent|x-real-ip)[\"'\`]\)" $IPDIRS --include='*.ts' --include='*.tsx' 2>/dev/null | grep -vE '^(lib/whistleblower|app/report|app/api/report)/' | grep -vE '\.test\.' || true)
  if [ -n "$OTHERHDR" ]; then echo "$OTHERHDR" | head; bad "request headers" "x-forwarded / user-agent / x-real-ip read outside the anonymous paths"; else note "request headers" "no other client-identifying header read"; fi
  if grep -rniE 'console\.' lib/employee app/employee components/employee lib/training 2>/dev/null | grep -vE 'employee invitation email failed' >/dev/null; then
    grep -rniE 'console\.' lib/employee app/employee components/employee lib/training | grep -vE 'employee invitation email failed' | head
    bad "employee logging" "the portal logs nothing but the fixed invitation-failure string"
  else
    note "employee logging" "nothing logged beyond the fixed invitation-failure string"
  fi
  if grep -rniE --include='*.ts' --include='*.tsx' 'certific' lib/training app/employee components/employee >/dev/null 2>&1; then
    grep -rniE --include='*.ts' --include='*.tsx' 'certific' lib/training app/employee components/employee | head
    bad "training copy" "the training and portal say \"concluído\", never \"certificado\""
  else
    note "training copy" "no 'certificate' wording"
  fi
fi

# 4k. Vendor questionnaire + screening (phase 7). The public tokenized vendor paths read no request
# metadata and log nothing (scripts/check-vendor-privacy.sh, same rule as the anonymous intake);
# the screening client logs nothing and the API key is read in exactly one file
# (lib/screening/index.ts), so it cannot travel into an error, a log or the database.
if [ -d lib/screening ]; then
  if VENDOR_OUT=$(./scripts/check-vendor-privacy.sh 2>&1); then note "vendor public paths" "no request metadata, no logging"; else echo "$VENDOR_OUT" | head -20; bad "vendor public paths" "request metadata or console output in app/vendor, components/vendor or the public lib/vendors files"; fi
  if grep -rnE 'console\.' lib/screening >/dev/null 2>&1; then
    grep -rnE 'console\.' lib/screening | head; bad "screening logging" "lib/screening must log nothing (request/response bodies and the key stay out of logs)"
  else
    note "screening logging" "nothing logged"
  fi
  KEYFILES=$(grep -rlE 'SCREENING_API_KEY' app lib components --include='*.ts' --include='*.tsx' 2>/dev/null | grep -vE '\.test\.' | sort || true)
  if [ "$KEYFILES" = "lib/screening/index.ts" ]; then note "screening key" "SCREENING_API_KEY read only in lib/screening/index.ts"; else echo "$KEYFILES"; bad "screening key" "SCREENING_API_KEY must be read in exactly one file (lib/screening/index.ts)"; fi
fi

# 4l. Dossier / binder (phase 8). The PDF leaves the customer's control, so lib/binder reads names,
# dates, states, scores and counts ONLY: it must not import the modules that read or decrypt
# employee e-mail/IP, disclosure contents, whistleblower report content/evidence/tracking codes or
# vendor questionnaire answers, nor name those fields (scripts/check-binder-privacy.sh). The marker
# test (tests/binder-pdf.test.tsx) proves the output; this is the tripwire on the source.
if [ -d lib/binder ]; then
  if BINDER_OUT=$(./scripts/check-binder-privacy.sh 2>&1); then note "binder privacy" "no excluded import or field in lib/binder"; else echo "$BINDER_OUT" | head -20; bad "binder privacy" "lib/binder touches data the dossier must exclude"; fi
fi

# 4g. KNOWN_ISSUES.md must exist (baseline)
[ -f KNOWN_ISSUES.md ] && note "KNOWN_ISSUES.md" "present" || bad "KNOWN_ISSUES.md" "missing"

hr "result"
[ "$fail" -eq 0 ] && echo "verify.sh: PASS (HEAD $HEAD_SHA)" || echo "verify.sh: FAIL (HEAD $HEAD_SHA)"
exit $fail
