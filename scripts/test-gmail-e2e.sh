#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-polar-scene-488615-i0}"
QA_URL="${QA_URL:-https://pessy-qa-app.web.app}"
CALLBACK_URL="https://us-central1-${PROJECT_ID}.cloudfunctions.net/gmailAuthCallback"
FORCE_SYNC_URL="https://us-central1-${PROJECT_ID}.cloudfunctions.net/forceRunEmailClinicalIngestion"

echo "==> Smoke checks"
echo "- Hosting URL: $QA_URL"
echo "- Callback URL: $CALLBACK_URL"
echo "- Force Sync URL: $FORCE_SYNC_URL"

hosting_code="$(curl -s -o /dev/null -w "%{http_code}" "$QA_URL")"
callback_headers="$(curl -sI "$CALLBACK_URL" || true)"
force_sync_http="$(curl -s -o /tmp/pessy_force_sync_check.json -w "%{http_code}" -X POST "$FORCE_SYNC_URL")"

echo "Hosting HTTP: $hosting_code"
if [[ "$hosting_code" != "200" ]]; then
  echo "FAIL: QA hosting is not returning 200."
  exit 1
fi

if ! grep -qi "location: .*gmail_sync=error" <<<"$callback_headers"; then
  echo "WARN: Callback did not return expected redirect without state."
else
  echo "Callback redirect check: OK"
fi

if [[ "$force_sync_http" != "401" && "$force_sync_http" != "403" ]]; then
  echo "FAIL: forceRunEmailClinicalIngestion expected 401/403 without auth key, got $force_sync_http."
  exit 1
fi
echo "Force sync endpoint auth check: OK (HTTP $force_sync_http)"

echo
echo "==> Deployed function checks"
required_functions=(
  "getGmailConnectUrl"
  "gmailAuthCallback"
  "disconnectGmailSync"
  "triggerEmailClinicalIngestion"
  "runEmailClinicalIngestionQueue"
  "runEmailClinicalScanWorker"
  "runEmailClinicalAttachmentWorker"
  "runEmailClinicalAiWorker"
  "forceRunEmailClinicalIngestion"
)

functions_json="$(firebase functions:list --project "$PROJECT_ID" --json)"
required_csv="$(IFS=,; echo "${required_functions[*]}")"

if ! missing_functions="$(
  REQUIRED_FUNCTIONS_CSV="$required_csv" node -e '
const fs = require("fs");
const input = fs.readFileSync(0, "utf8");
const parsed = JSON.parse(input);
const deployed = Array.isArray(parsed.result) ? parsed.result : [];
const ids = new Set(deployed.map((row) => String(row.id || "")));
const required = String(process.env.REQUIRED_FUNCTIONS_CSV || "").split(",").filter(Boolean);
const missing = required.filter((id) => !ids.has(id));
process.stdout.write(missing.join(","));
' <<<"$functions_json"
)"; then
  echo "FAIL: Unable to parse firebase functions list output."
  exit 1
fi

if [[ -n "$missing_functions" ]]; then
  echo "FAIL: Missing deployed Gmail ingestion functions: $missing_functions"
  exit 1
fi
echo "Required ingestion functions deployed: OK"

echo
echo "==> Manual E2E checklist"
echo "1) Open $QA_URL and login with a QA user."
echo "2) Click 'Dar acceso a sincronización (Gmail)'."
echo "3) Approve consent in Google OAuth."
echo "4) Verify you return to /home with gmail_sync=connected."
echo "5) In Firestore, confirm:"
echo "   - users/{uid}.gmailSync.connected = true"
echo "   - users/{uid}/mail_sync_tokens/gmail exists"
echo "6) Click disconnect and confirm connected = false."
echo "7) Create an appointment in QA and confirm appointment doc stores:"
echo "   - googleCalendarEventId"
echo "   - googleCalendarSyncedAt"
echo "   - googleCalendarSyncStatus = synced (or skipped with reason)"

echo
echo "Automated smoke checks passed. Continue with manual validation."
