# Firebase Hosting Investigation Report
**Project:** polar-scene-488615-i0 (Pessy App)  
**Date:** March 26, 2026

---

## Issue Summary
User reported the site working fine at 10 PM on March 25, but displayed an "old version" when they woke up on March 26. Investigation reveals a deployed stale build.

---

## Critical Findings

### 1. Stale Distribution Build Deployed
- **dist/ built at:** March 25, 23:38:03 local time (02:38:03 UTC)
- **Source:** Firebase cache timestamps in `.firebase/hosting.ZGlzdA.cache`

### 2. Source Code Mismatch Confirmed
- **Current src/ code:** Does NOT contain "Gratis" (correctly removed)
- **Deployed dist/ code:** DOES contain "Gratis" (still present)

### 3. Root Cause: Stale Working Directory Build

**Timeline of March 25:**

| Time | Event |
|------|-------|
| 19:09:01 | Commit `ab1faa0`: Logo size fix (code still has "Gratis") |
| 19:11:41 | Commit `0f1c31f`: Removed "sin tarjeta de crédito" |
| 19:13:48 | Commit `a3fc58c`: Removed "Gratis" |
| ~23:38:03 | **dist/ was BUILT** (4+ hours after last removal) |

**Problem:** The dist/ directory was built from code state BEFORE the commits that removed "Gratis". Someone ran `npm run build` without first pulling the latest commits.

### 4. Git Branch Status
- **main branch:** At `a3fc58c` (latest with all fixes)
- **release/prod branch:** At `f178f3c` (March 20, **65 commits BEHIND main**)
- **dist/ origin:** Built from state matching `ab1faa0` or earlier

### 5. Firebase Configuration
- **Target:** "app" (polar-scene-488615-i0)
- **Public dir:** dist/
- **Service Worker caching:**
  - Assets: 1-year cache (immutable)
  - HTML/SW/Workbox: no-cache headers
  - Custom security headers properly configured in firebase.json

### 6. No Automated Deployment Found
- No GitHub Actions workflows in `.github/workflows/`
- `release/prod` branch not tracking recent changes
- `deploy-qa-gmail.sh` script exists but manual only
- Deployment appears entirely manual via `firebase deploy` CLI

---

## Files Involved

**Configuration:**
- `/mnt/PESSY_PRODUCCION/.firebaserc`
- `/mnt/PESSY_PRODUCCION/firebase.json`
- `/mnt/PESSY_PRODUCCION/.firebase/hosting.ZGlzdA.cache`

**Source Code:**
- `/mnt/PESSY_PRODUCCION/src/app/pages/LandingSocialPage.tsx`

**Deployment Directory:**
- `/mnt/PESSY_PRODUCCION/dist/`

**Relevant Git Commits:**
- `f178f3c`: release/prod tip (March 20) - 65 commits behind
- `ab1faa0`: Code state matching dist/ content (March 25, 19:09:01)
- `0f1c31f`: Removed "sin tarjeta de crédito" (March 25, 19:11:41)
- `a3fc58c`: Removed "Gratis" (March 25, 19:13:48) - current main tip

---

## User Experience Explanation

### At 10 PM on March 25
- Service worker served cached version or previous valid deployment
- User saw correct current version

### By Morning on March 26
- Service worker cache cleared (device sleep, cache expiry, or manual clear)
- Browser downloaded fresh dist/ from Firebase
- dist/ contained old code built at 23:38 (before "Gratis" removal commits)
- User perceived "old version" appearing suddenly

### Technical Reality
- Not a rollback or regression
- Fresh deployment of accidentally stale build
- Build created AFTER source commits but WITHOUT pulling them

---

## Root Cause Analysis

Someone executed `npm run build && firebase deploy` around 23:38 on March 25 **without running `git pull` first** on a development machine. The working directory was at an older state, so the generated dist/ reflected outdated source code.

This pattern suggests:
1. Manual local builds (not CI/CD automated)
2. Potential git branch management confusion
3. No pre-deploy validation checks

---

## Key Timestamps & Evidence

- **19:09:01:** ab1faa0 - has "Gratis"
- **19:11:41:** 0f1c31f - removes "sin tarjeta"
- **19:13:48:** a3fc58c - removes "Gratis"
- **23:38:03:** dist/ file timestamps confirm build at this time
- **grep results:** dist/assets/index-gd8ldk2R.js contains "Gratis" string
- **src/ verification:** Current source code does NOT have "Gratis"

---

## Investigation Completed (Research Only)

All findings based on:
- Firebase cache metadata analysis
- Git commit history and timestamps
- Source code comparison (src/ vs dist/)
- Configuration file review
- Service worker and deployment analysis

**No changes were made to any files or deployments.**
