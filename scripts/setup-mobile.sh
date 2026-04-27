#!/usr/bin/env bash
# setup-mobile.sh — Verify mobile build prerequisites for PESSY (Capacitor)
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
PASS=0; FAIL=0; WARN=0

check() {
  if eval "$2" > /dev/null 2>&1; then
    echo -e "  ${GREEN}✓${NC} $1"; ((PASS++))
  else
    echo -e "  ${RED}✗${NC} $1 — $3"; ((FAIL++))
  fi
}

warn() {
  if eval "$2" > /dev/null 2>&1; then
    echo -e "  ${GREEN}✓${NC} $1"; ((PASS++))
  else
    echo -e "  ${YELLOW}⚠${NC} $1 — $3"; ((WARN++))
  fi
}

echo ""
echo "🐾 PESSY Mobile Setup Check"
echo "═══════════════════════════════════════"

echo ""
echo "── Prerequisites ──"
check "Node.js installed"        "command -v node"         "Install from https://nodejs.org"
check "npm installed"            "command -v npm"          "Comes with Node.js"
check "Capacitor CLI available"  "npx cap --version"       "Run: npm install"

echo ""
echo "── Android ──"
warn  "Android SDK (ANDROID_HOME)"   "test -n \"\${ANDROID_HOME:-}\" && test -d \"\$ANDROID_HOME\"" \
      "Set ANDROID_HOME env var (Android Studio → SDK Manager)"
check "google-services.json"     "test -f apps/mobile/android/app/google-services.json" \
      "Download from Firebase Console → Project Settings → Android app"
check "Android icons exist"      "test -f apps/mobile/android/app/src/main/res/mipmap-xxhdpi/ic_launcher.png" \
      "Run icon generation script or add icons manually"

echo ""
echo "── iOS ──"
warn  "Xcode CLI tools"          "xcode-select -p"         "Run: xcode-select --install"
warn  "CocoaPods installed"      "command -v pod"           "Run: sudo gem install cocoapods"
check "GoogleService-Info.plist" "test -f apps/mobile/ios/App/App/GoogleService-Info.plist" \
      "Download from Firebase Console → Project Settings → iOS app"
check "iOS icons exist"          "test -f apps/mobile/ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png" \
      "Run icon generation or add icons manually"

echo ""
echo "── Build test ──"
check "npm run build works"      "npm run build"           "Fix build errors before proceeding"

echo ""
echo "═══════════════════════════════════════"
echo -e "  ${GREEN}✓ ${PASS} passed${NC}  ${RED}✗ ${FAIL} failed${NC}  ${YELLOW}⚠ ${WARN} warnings${NC}"
echo ""

if [ "$FAIL" -gt 0 ]; then
  echo -e "${RED}Fix the failures above before building for mobile.${NC}"
  exit 1
else
  echo -e "${GREEN}Ready to build! Next steps:${NC}"
  echo "  npm run build && npm run cap:sync"
  echo "  npm run cap:open:android   # or: npm run cap:open:ios"
fi
