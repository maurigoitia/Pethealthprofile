#!/bin/bash
set -e

bash pre-deploy-pwa-check.sh

echo "🔨 Step 1: Building PWA..."
npm run build

echo ""
echo "🚀 Step 2: Deploying PWA to secondary hosting site..."
firebase --config firebase.pwa.json deploy --only hosting

echo ""
echo "✅ Done! PWA deployed to:"
echo "   https://pessy-app-subdomain.web.app"
echo ""
echo "ℹ️  This does NOT change pessy.app by itself."
echo "   To switch app.pessy.app later, remap that custom domain to the pessy-app-subdomain site in Firebase Hosting."
