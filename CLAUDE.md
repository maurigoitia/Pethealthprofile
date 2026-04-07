# PESSY — Rules for AI Agents

## ⛔ NEVER run `firebase deploy` manually from this branch

`main` is the production branch. **Deploys to production happen exclusively via GitHub Actions** (`deploy-prod.yml`), never from the terminal.

Running `firebase deploy` manually from any branch WILL BREAK pessy.app.
This has already happened TWICE (2026-03-27 and 2026-03-28) causing:
- Blank page in production (wrong architecture deployed)
- CSS completely broken (different file structure)

## Branch model

| Branch | Purpose | Deploy |
|--------|---------|--------|
| `main` | Production | GitHub Actions only — triggers after CI passes |
| `develop` | Staging | Auto-deploys to `appqa` on push |
| feature branches | Development | No deploy |

## How production deploys work

1. Open a PR from `develop` → `main`
2. CI must pass (`npm test` + `tsc` + `lint` + build)
3. Merge to `main` → `deploy-prod.yml` triggers automatically
4. Or trigger manually from GitHub Actions UI (`workflow_dispatch`)

**NEVER** run any of these manually:
- `firebase deploy`
- `firebase deploy --only hosting`
- `firebase deploy --only hosting:app`
- `firebase deploy --only functions` from `main` (use GitHub Actions)

## What agents CAN do locally
- `npm run dev` — local dev server
- `npm run build` — local build for testing
- `npm test` — run vitest
- `firebase emulators:start` — local emulation only

## Incident Log
- 2026-03-27: Agent deployed hosting from main manually → blank page in production
- 2026-03-28 ~12:41: Agent deployed hosting from main manually AGAIN → broke CSS/layout
- 2026-04-07: CI/CD audit — unified branch policy, Node 22, added test gate, dist/ untracked
