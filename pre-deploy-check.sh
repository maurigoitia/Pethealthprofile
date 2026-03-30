#!/bin/bash
set -e

echo "🔍 Pre-deploy safety check..."

# 1. Check branch
BRANCH=$(git branch --show-current)
if [ "$BRANCH" != "pessy-website" ]; then
  echo "❌ ABORT: You are on branch '$BRANCH', not 'pessy-website'"
  echo "   Production deploys ONLY from pessy-website."
  echo "   Run: git checkout pessy-website && git pull origin pessy-website"
  exit 1
fi

# 2. Check NOT in Codex worktree
if echo "$PWD" | grep -q ".codex"; then
  echo "❌ ABORT: Running from a Codex worktree. Deploy from main repo only."
  exit 1
fi

# 3. Check NOT in detached HEAD
if git symbolic-ref -q HEAD > /dev/null 2>&1; then
  : # good, on a branch
else
  echo "❌ ABORT: Detached HEAD state. Checkout pessy-website first."
  exit 1
fi

# 4. Check landing.html exists and has content
if [ ! -f "public/landing.html" ]; then
  echo "❌ ABORT: public/landing.html not found"
  exit 1
fi
if [ ! -s "public/landing.html" ]; then
  echo "❌ ABORT: public/landing.html is empty"
  exit 1
fi

# 5. Check deploy script exists
if [ ! -f "deploy-with-landing.sh" ]; then
  echo "❌ ABORT: deploy-with-landing.sh not found"
  exit 1
fi

# 6. Check firebase.json rewrite points to app.html
if ! grep -q '"destination": "/app.html"' firebase.json; then
  echo "❌ ABORT: firebase.json rewrite does not point to /app.html"
  exit 1
fi

# 7. Log deploy attempt
echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) deploy-attempt branch=$BRANCH user=$(whoami) pwd=$PWD" >> .deploy-audit.log 2>/dev/null || true

echo "✅ All checks passed. Safe to deploy."