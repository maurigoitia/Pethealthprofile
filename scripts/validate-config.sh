#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-polar-scene-488615-i0}"
CALLBACK_URL="https://us-central1-${PROJECT_ID}.cloudfunctions.net/gmailAuthCallback"

check_secret() {
  local name="$1"
  if firebase functions:secrets:get "$name" --project "$PROJECT_ID" >/dev/null 2>&1; then
    echo "  [OK] Secret $name"
  else
    echo "  [ERR] Secret $name not found"
    return 1
  fi
}

echo "==> Firebase account"
firebase login:list

echo "==> Project"
firebase use "$PROJECT_ID" >/dev/null
echo "  [OK] Using project $PROJECT_ID"

echo "==> Required secrets"
check_secret "GMAIL_OAUTH_CLIENT_ID"
check_secret "GMAIL_OAUTH_CLIENT_SECRET"
check_secret "GMAIL_OAUTH_REDIRECT_URI"
check_secret "MAIL_TOKEN_ENCRYPTION_KEY"

echo "==> Function callback URL"
http_code="$(curl -s -o /dev/null -w "%{http_code}" "$CALLBACK_URL")"
if [[ "$http_code" == "302" || "$http_code" == "200" ]]; then
  echo "  [OK] Callback reachable (HTTP $http_code)"
else
  echo "  [ERR] Callback not reachable (HTTP $http_code)"
  exit 1
fi

echo "Configuration looks good."
