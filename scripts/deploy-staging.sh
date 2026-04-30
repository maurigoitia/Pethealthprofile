#!/usr/bin/env bash
set -e

BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [[ "$BRANCH" != "develop" && "$BRANCH" != "staging" ]]; then
  echo "⚠️  Estás en '$BRANCH'. Staging solo desde 'develop' o 'staging'."
  read -p "¿Continuar igual? (s/N) " -n 1 -r; echo
  [[ ! $REPLY =~ ^[Ss]$ ]] && exit 1
fi

echo "🔨 Build frontend (staging)..."
VITE_ENV=staging npm run build

echo "🚀 Deploy a Firebase Staging (appqa)..."
npx firebase-tools deploy --only hosting:appqa --project polar-scene-488615-i0

if [[ "$1" == "--with-functions" ]]; then
  echo "⚡ Deploy functions..."
  npx firebase-tools deploy --only functions --project polar-scene-488615-i0
fi

echo "✅ Staging deploy completo → https://pessy-app-subdomain.web.app (appqa)"
