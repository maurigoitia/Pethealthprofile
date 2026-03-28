#!/bin/bash
set -e

echo "🔍 Pre-deploy safety check..."

BRANCH=$(git branch --show-current)
if [ "$BRANCH" != "pessy-website" ]; then
  echo "❌ ABORT: You are on branch '$BRANCH', not 'pessy-website'"
  echo "   Run: git checkout pessy-website && git pull origin pessy-website"
  exit 1
fi

if [ ! -f "public/landing.html" ]; then
  echo "❌ ABORT: public/landing.html not found"
  exit 1
fi

if [ ! -f "deploy-with-landing.sh" ]; then
  echo "❌ ABORT: deploy-with-landing.sh not found"
  exit 1
fi

if ! grep -q '"destination": "/app.html"' firebase.json; then
  echo "❌ ABORT: firebase.json rewrite does not point to /app.html"
  exit 1
fi

echo "✅ All checks passed. Safe to deploy."