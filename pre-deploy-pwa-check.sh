#!/bin/bash
set -e

echo "🔍 Pre-deploy PWA check..."

BRANCH=$(git branch --show-current)
if [ "$BRANCH" != "pessy-website" ]; then
  echo "❌ ABORT: You are on branch '$BRANCH', not 'pessy-website'"
  echo "   Run: git checkout pessy-website && git pull origin pessy-website"
  exit 1
fi

if [ ! -f "firebase.pwa.json" ]; then
  echo "❌ ABORT: firebase.pwa.json not found"
  exit 1
fi

if ! grep -q '"site": "pessy-app-subdomain"' firebase.pwa.json; then
  echo "❌ ABORT: firebase.pwa.json is not targeting pessy-app-subdomain"
  exit 1
fi

echo "✅ PWA deploy path is safe."
