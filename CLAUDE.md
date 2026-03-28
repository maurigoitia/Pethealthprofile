# PESSY — Rules for AI Agents

## ⛔ DO NOT DEPLOY FROM THIS BRANCH

This is the `main` branch. It is for DEVELOPMENT ONLY.

**Production deploys MUST happen from the `pessy-website` branch.**

Running `firebase deploy` from this branch WILL BREAK pessy.app.
This has already happened TWICE (2026-03-27 and 2026-03-28) causing:
- Blank page in production (wrong architecture deployed)
- CSS completely broken (different file structure)

## What to do instead

If you need to deploy to production:
1. Switch to `pessy-website`: `git checkout pessy-website`
2. Use the deploy script: `bash deploy-with-landing.sh`
3. NEVER run `firebase deploy` directly from any branch

## Why this branch is different

| | pessy-website (PRODUCTION) | main (DEVELOPMENT) |
|---|---|---|
| Homepage | Static landing.html | Vite SPA index.html |
| SPA entry | app.html (renamed) | index.html |
| Deploy script | deploy-with-landing.sh | NONE (do not deploy) |
| Firebase rewrite | ** → /app.html | ** → /index.html |

## Forbidden Actions (on this branch)
- `firebase deploy` (any variant)
- `firebase deploy --only hosting`
- `firebase deploy --only hosting:app`
- Any command that pushes to Firebase Hosting

## Allowed Actions (on this branch)
- `firebase deploy --only functions` (Cloud Functions only, OK)
- Development work (coding, testing locally)
- `npm run dev` (local dev server)
- `npm run build` (local build for testing)

## Incident Log
- 2026-03-27: Agent deployed hosting from main → blank page in production
- 2026-03-28 ~12:41: Agent deployed hosting from main AGAIN → broke CSS/layout