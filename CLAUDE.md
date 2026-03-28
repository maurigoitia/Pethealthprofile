# PESSY — Rules for AI Agents

## CRITICAL: READ THIS FIRST

### NEVER deploy without EXPLICIT user approval
- You MUST ask "Can I deploy to production?" and receive "yes" BEFORE running any deploy command.
- Showing a plan is NOT the same as getting approval. Wait for confirmation.

### NEVER deploy from any branch other than `pessy-website`
- The ONLY branch authorized for production deploys is `pessy-website`.
- `main` has a DIFFERENT architecture and WILL break production.
- If you are on any other branch, STOP and switch to `pessy-website` first.

### NEVER modify firebase.json
- The firebase.json on `pessy-website` is correct and tested.
- Do NOT add rewrites, redirects, headers, or change the hosting config.
- If you think firebase.json needs changes, STOP and ask the user first.

### NEVER run `firebase deploy` directly
- Always use `bash deploy-with-landing.sh` which runs pre-checks automatically.
- Running firebase deploy directly skips the landing page copy step and WILL break the site.

## Project Info
- Firebase Project ID: `polar-scene-488615-i0`
- Domain: pessy.app
- Production branch: `pessy-website`
- Deploy script: `deploy-with-landing.sh`

## Architecture (pessy-website branch)
- `/` → Landing page (public/landing.html, copied to dist/index.html by deploy script)
- `/login`, `/inicio`, `/register-*`, etc. → Vite SPA (dist/app.html)
- Catch-all rewrite: `** → /app.html`

## Branch Strategy
| Branch | Purpose | Deploy to prod? |
|--------|---------|-----------------|
| pessy-website | Production-ready code | YES (only this one) |
| main | Development (different architecture) | NEVER |
| feature/* | Feature development | NEVER (merge to pessy-website first) |
| sandbox/* | Experimental work | NEVER |

## Pre-Deploy Checklist (MANDATORY)
- [ ] On `pessy-website` branch
- [ ] Branch is up to date with origin
- [ ] `public/landing.html` exists
- [ ] `deploy-with-landing.sh` exists
- [ ] User has explicitly approved the deploy
- [ ] NOT modifying firebase.json

## Forbidden Actions
- Deploying from `main` or any branch other than `pessy-website`
- Running `firebase deploy` directly (use deploy-with-landing.sh)
- Modifying firebase.json rewrites
- Pushing to `pessy-website` without user approval

## Incident Log
- 2026-03-27: Agent deployed from `main` instead of `pessy-website`. main has different SPA architecture without landing page. Result: blank page in production. Fixed by redeploying from pessy-website.