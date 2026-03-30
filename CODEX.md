# PESSY — Rules for OpenAI Codex

## ⛔ DO NOT DEPLOY HOSTING — EVER

**DO NOT run any of these commands:**
- `firebase deploy`
- `firebase deploy --only hosting`
- `firebase deploy --only hosting:polar-scene-488615-i0`
- Any variation of firebase deploy that touches hosting

**WHY:** pessy.app has a two-file architecture (landing + SPA). Direct `firebase deploy` skips the mandatory landing page copy step and **WILL serve a blank page to 50,000+ users**.

## The ONLY safe deploy path

Production deploys MUST:
1. Be on branch `pessy-website` (not `main`, not `feature/*`)
2. Use `bash deploy-with-landing.sh` (not `firebase deploy`)

## What you CAN do

- Read files, understand code, suggest changes
- Run `npm run build` to verify the build
- Run tests
- Edit source files in `src/` or `functions/`
- Commit changes to non-production branches

## Branch reference

| Branch | Can deploy? |
|--------|------------|
| `pessy-website` | YES — only via `bash deploy-with-landing.sh` |
| `main` | NO — different architecture, will break prod |
| `feature/*` | NO |
| `sandbox/*` | NO |
| `claude/*` | NO |

## Incident history

- 2026-03-27: Agent deployed from `main`. Result: blank production page for all users.
- This has happened 4 times. This file exists because of those incidents.
