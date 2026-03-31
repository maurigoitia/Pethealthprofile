#!/bin/bash
set -e

bash pre-deploy-pwa-check.sh

echo "🔨 Step 1: Building frontend..."
npm run build

echo "🔨 Step 2: Building functions..."
npm --prefix functions run build

echo "🚀 Step 3: Deploying co-tutor backend fix..."
firebase deploy --only functions:acceptCoTutorInvite

echo "🚀 Step 4: Deploying PWA to secondary hosting site..."
firebase --config firebase.pwa.json deploy --only hosting

echo ""
echo "✅ Done."
echo "   Backend fix is live in functions."
echo "   PWA build is live at https://pessy-app-subdomain.web.app"
echo "   pessy.app was not redeployed by this script."
