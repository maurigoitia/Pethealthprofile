#!/usr/bin/env bash
# sync-versions.sh — Reads version from package.json and updates Android + iOS
# Usage: bash scripts/sync-versions.sh [patch|minor|major]
#   Without args: syncs current package.json version to native projects
#   With arg: bumps package.json first, then syncs

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
GRADLE="$ROOT/android/app/build.gradle"
PBXPROJ="$ROOT/ios/App/App.xcodeproj/project.pbxproj"

# Optional: bump package.json version first
if [ "${1:-}" = "patch" ] || [ "${1:-}" = "minor" ] || [ "${1:-}" = "major" ]; then
  npm version "$1" --no-git-tag-version --prefix "$ROOT"
  echo "Bumped package.json to $(node -p "require('$ROOT/package.json').version")"
fi

# Read version from package.json (source of truth)
VERSION=$(node -p "require('$ROOT/package.json').version")
# Extract major.minor for display version
VERSION_NAME=$(echo "$VERSION" | sed 's/-.*//')
# Build number: convert semver to integer (1.2.3 → 10203)
MAJOR=$(echo "$VERSION" | cut -d. -f1)
MINOR=$(echo "$VERSION" | cut -d. -f2)
PATCH=$(echo "$VERSION" | cut -d. -f3 | sed 's/-.*//')
VERSION_CODE=$(( MAJOR * 10000 + MINOR * 100 + PATCH ))

echo "Syncing version: $VERSION_NAME (code: $VERSION_CODE)"

# Update Android build.gradle
if [ -f "$GRADLE" ]; then
  sed -i '' "s/versionCode [0-9]*/versionCode $VERSION_CODE/" "$GRADLE"
  sed -i '' "s/versionName \"[^\"]*\"/versionName \"$VERSION_NAME\"/" "$GRADLE"
  echo "  ✓ Android: versionCode=$VERSION_CODE, versionName=$VERSION_NAME"
else
  echo "  ⚠ Android build.gradle not found at $GRADLE"
fi

# Update iOS project.pbxproj
if [ -f "$PBXPROJ" ]; then
  sed -i '' "s/MARKETING_VERSION = [^;]*/MARKETING_VERSION = $VERSION_NAME/" "$PBXPROJ"
  sed -i '' "s/CURRENT_PROJECT_VERSION = [^;]*/CURRENT_PROJECT_VERSION = $VERSION_CODE/" "$PBXPROJ"
  echo "  ✓ iOS: MARKETING_VERSION=$VERSION_NAME, CURRENT_PROJECT_VERSION=$VERSION_CODE"
else
  echo "  ⚠ iOS project.pbxproj not found at $PBXPROJ"
fi

echo "Done. Run 'npm run build:mobile' to compile with new version."
