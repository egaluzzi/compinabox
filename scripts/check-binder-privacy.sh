#!/usr/bin/env bash
# check-binder-privacy.sh — the dossier privacy invariant (phase 8), run by verify.sh. The binder
# leaves the customer's control (it is handed to auditors and buyers), so lib/binder must never
# read or print: employee e-mail or IP addresses, disclosure contents, whistleblower report text /
# contact / tracking codes / evidence / notes, vendor questionnaire answers, or anything decrypted.
# Scans .ts/.tsx only (REVIEW.md may talk about these things). Two checks, comments count too (same style as check-anonymity.sh / check-vendor-privacy.sh):
#   1. no import of the modules that read or decrypt those values;
#   2. none of the column / field names that hold them appears in lib/binder.
# The marker test (tests/binder-pdf.test.tsx) is the behavioural proof; this is the tripwire.
#
#   scripts/check-binder-privacy.sh                      scans lib/binder
#   BINDER_PATHS="a b" scripts/check-binder-privacy.sh   (used to show the check failing on a planted file)
set -uo pipefail
cd "$(dirname "$0")/.."
PATHS=${BINDER_PATHS:-"lib/binder"}
for p in $PATHS; do [ -e "$p" ] || { echo "check-binder-privacy: FAIL — $p does not exist (a missing path must not pass silently)"; exit 1; }; done
IMPORTS='lib/(whistleblower/(crypto|evidence|tracking-code|queries|intake|status-lookup|rotate)|vendors/(answers|submit)|employee/(client-ip|disclosure|acknowledge|detail|admin|session))'
FIELDS='ipAddress|ip_address|clientIp|cf-connecting|trackingCode|tracking_code|reporterContact|reporter_contact|whistleblowerEvidence|whistleblower_evidence|whistleblowerNotes|whistleblower_notes|vendorResponses|vendor_responses|respondentName|respondentRole|ownershipText|pepDetails|sanctionsDetails|contactEmail|contactName|inviteTokenHash|invite_token_hash|disclosures\.content|\bemail\b|decrypt|encrypt|REPORT_ENCRYPTION|EVIDENCE_DIR'
HITS=$(grep -rnIiE --include='*.ts' --include='*.tsx' "$IMPORTS" $PATHS 2>/dev/null | grep -E "(import|from|require)" || true)
HITS2=$(grep -rnIE --include='*.ts' --include='*.tsx' "$FIELDS" $PATHS 2>/dev/null || true)
if [ -n "$HITS$HITS2" ]; then
  [ -n "$HITS" ] && echo "$HITS"
  [ -n "$HITS2" ] && echo "$HITS2"
  echo "check-binder-privacy: FAIL — lib/binder touches an import or a field that holds data the dossier must exclude"
  exit 1
fi
echo "check-binder-privacy: ok ($(echo $PATHS | wc -w) path(s) scanned)"
