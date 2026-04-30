#!/usr/bin/env bash
set -e

BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [[ "$BRANCH" != "main" ]]; then
  echo "❌ Producción solo desde 'main'. Branch actual: '$BRANCH'"
  exit 1
fi

echo "⚠️  DEPLOY A PRODUCCIÓN (pessy.app)"
read -p "¿Seguro? Esto afecta usuarios reales. (s/N) " -n 1 -r; echo
[[ ! $REPLY =~ ^[Ss]$ ]] && exit 1

echo "🔨 Build frontend (prod)..."
npm run build

echo "🚀 Deploy hosting a producción..."
npx firebase-tools deploy --only hosting:app --project polar-scene-488615-i0

read -p "¿Deploy functions también? (s/N) " -n 1 -r; echo
if [[ $REPLY =~ ^[Ss]$ ]]; then
  echo "⚡ Deploy functions..."
  npx firebase-tools deploy --only functions --project polar-scene-488615-i0
fi

echo "✅ Producción deploy completo → https://pessy.app"
