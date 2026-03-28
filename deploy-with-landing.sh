#!/bin/bash
set -e

# Safety check before deploying
bash pre-deploy-check.sh

echo "🔨 Step 1: Building Vite project..."
npm run build

echo "📄 Step 2: Renaming SPA index.html → app.html..."
mv dist/index.html dist/app.html

echo "🔧 Step 2.5: Patching service worker navigateFallback..."
sed -i '' 's/createHandlerBoundToURL("index.html")/createHandlerBoundToURL("app.html")/g' dist/sw.js
echo "   ✓ sw.js patched to use app.html"

echo "🏠 Step 3: Copying landing page as new index.html..."
cp public/landing.html dist/index.html

echo "🖼️  Step 3.5: Copying static assets..."
cp public/pessy-logo.svg dist/pessy-logo.svg
cp public/robots.txt dist/robots.txt
cp public/sitemap.xml dist/sitemap.xml
echo "   ✓ Logo, robots.txt, sitemap.xml copied"

echo "✅ Build ready! dist/ contents:"
ls -la dist/*.html dist/sw.js dist/pessy-logo.svg

echo ""
echo "🚀 Step 4: Deploying to Firebase Hosting..."
firebase deploy --only hosting

echo ""
echo "✅ Done! pessy.app is live with the new landing."
echo "   / → New landing page (index.html)"
echo "   /login, /register-user, /home → React SPA (app.html)"
