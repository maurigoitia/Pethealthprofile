#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-polar-scene-488615-i0}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "==> Building web app"
cd "$ROOT_DIR"
npm run build

echo "==> Building cloud functions"
cd "$ROOT_DIR/functions"
npm run build

echo "==> Deploying Gmail sync + ingestion functions to ${PROJECT_ID}"
cd "$ROOT_DIR"
firebase deploy \
  --project "$PROJECT_ID" \
  --only \
functions:getGmailConnectUrl,functions:gmailAuthCallback,functions:disconnectGmailSync,functions:triggerEmailClinicalIngestion,functions:runEmailClinicalIngestionQueue,functions:runEmailClinicalScanWorker,functions:runEmailClinicalAttachmentWorker,functions:runEmailClinicalAiWorker,functions:forceRunEmailClinicalIngestion,functions:sendGmailSyncConsentReminders,functions:syncAppointmentCalendarEvent

echo "==> Deploying app QA hosting to ${PROJECT_ID}"
firebase deploy --project "$PROJECT_ID" --only hosting:appqa

echo "Done."
