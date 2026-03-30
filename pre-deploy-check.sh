#!/bin/bash
set -e

AUDIT_LOG="deploy-audit.log"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

log_and_exit() {
  local msg="$1"
  echo "[$TIMESTAMP] BLOCKED: $msg" >> "$AUDIT_LOG"
  echo "❌ ABORT: $msg"
  exit 1
}

echo "🔍 Pre-deploy safety check..."
echo "[$TIMESTAMP] Deploy attempt started (user: $(whoami), pwd: $(pwd))" >> "$AUDIT_LOG"

# 1. Block Codex worktrees — they should never deploy
if echo "$(pwd)" | grep -q "\.codex/"; then
  log_and_exit "Running inside a Codex worktree ($(pwd)). Codex MUST NOT deploy. Use deploy-with-landing.sh from pessy-website only."
fi

# 2. Block Claude worktrees — same rule
if echo "$(pwd)" | grep -q "\.claude/worktrees/"; then
  log_and_exit "Running inside a Claude worktree ($(pwd)). Worktrees MUST NOT deploy. Switch to pessy-website main checkout."
fi

# 3. Block detached HEAD
if git symbolic-ref --quiet HEAD > /dev/null 2>&1; then
  : # OK, we have a branch
else
  log_and_exit "Detached HEAD state detected. You must be on a named branch (pessy-website) to deploy."
fi

# 4. Must be on pessy-website
BRANCH=$(git branch --show-current)
if [ "$BRANCH" != "pessy-website" ]; then
  log_and_exit "You are on branch '$BRANCH', not 'pessy-website'. Run: git checkout pessy-website && git pull origin pessy-website"
fi

# 5. landing.html must exist AND have content
if [ ! -f "public/landing.html" ]; then
  log_and_exit "public/landing.html not found. The landing page source is missing."
fi
LANDING_SIZE=$(wc -c < "public/landing.html")
if [ "$LANDING_SIZE" -lt 1000 ]; then
  log_and_exit "public/landing.html is suspiciously small ($LANDING_SIZE bytes). It may be empty or corrupted."
fi

# 6. deploy-with-landing.sh must exist
if [ ! -f "deploy-with-landing.sh" ]; then
  log_and_exit "deploy-with-landing.sh not found."
fi

# 7. firebase.json rewrite must point to /app.html (not /index.html)
if ! grep -q '"destination": "/app.html"' firebase.json; then
  log_and_exit "firebase.json rewrite does not point to /app.html — it may have been corrupted."
fi

# 8. If dist/ exists, verify dist/index.html is the LANDING PAGE (not the SPA)
if [ -f "dist/index.html" ]; then
  if grep -q "<div id=\"root\">" dist/index.html 2>/dev/null; then
    log_and_exit "dist/index.html looks like the SPA (contains <div id=\"root\">). The landing copy step may have been skipped. Re-run deploy-with-landing.sh from scratch."
  fi
  if ! grep -qi "pessy\|mascota\|ecosistema\|tu mascota" dist/index.html 2>/dev/null; then
    log_and_exit "dist/index.html does not look like the Pessy landing page. Aborting to prevent deploying wrong content."
  fi
fi

echo "✅ All checks passed. Safe to deploy."
echo "[$TIMESTAMP] SUCCESS: All checks passed on branch '$BRANCH'" >> "$AUDIT_LOG"
