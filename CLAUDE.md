# PESSY — Rules for AI Agents

## CRITICAL: READ THIS FIRST

### NEVER deploy without EXPLICIT user approval
- You MUST ask "Can I deploy to production?" and receive "yes" BEFORE running any deploy command.
- Showing a plan is NOT the same as getting approval. Wait for confirmation.

### NEVER deploy from any branch other than `pessy-website`
- The ONLY branch authorized for production deploys is `pessy-website`.
- `main` has a DIFFERENT architecture and WILL break production.
- `claude/*` worktrees, `feature/*`, `sandbox/*` — NONE of these can deploy.
- If you are on any other branch, STOP. Do not attempt to deploy.

### NEVER modify firebase.json
- The firebase.json on `pessy-website` is correct and tested.
- Do NOT add rewrites, redirects, headers, or change the hosting config.
- EXCEPTION: The `predeploy` hook is intentional and must stay — it calls `pre-deploy-check.sh`.
- If you think firebase.json needs other changes, STOP and ask the user first.

### NEVER run `firebase deploy` directly
- Always use `bash deploy-with-landing.sh` which runs pre-checks automatically.
- Running firebase deploy directly skips the landing page copy step and WILL break the site.
- Note: firebase.json now includes a `predeploy` hook that runs `pre-deploy-check.sh`, so even
  direct `firebase deploy` calls will be blocked if not on pessy-website. But still — don't do it.

### NEVER deploy from a worktree
- Claude worktrees (`.claude/worktrees/*`) and Codex worktrees (`.codex/*`) MUST NOT deploy.
- The pre-deploy-check.sh script will block this automatically.
- If you are in a worktree, commit your changes and work through the main checkout.

## Project Info
- Firebase Project ID: `polar-scene-488615-i0`
- Domain: pessy.app
- Production branch: `pessy-website`
- Deploy script: `deploy-with-landing.sh`
- Audit log: `deploy-audit.log` (auto-written by pre-deploy-check.sh)

## Architecture (pessy-website branch)
- `/` → Landing page (public/landing.html, copied to dist/index.html by deploy script)
- `/login`, `/inicio`, `/register-*`, etc. → Vite SPA (dist/app.html)
- Catch-all rewrite: `** → /app.html`

## Deploy Protection Layers (as of 2026-03-30)

| Layer | What it does |
|-------|-------------|
| `firebase.json predeploy` | Runs pre-deploy-check.sh before ANY firebase deploy command |
| `pre-deploy-check.sh` | Verifies branch, landing.html, dist/index.html, no worktree, no detached HEAD |
| `.git/hooks/pre-push` | Blocks pushing to pessy-website from a different branch |
| `CLAUDE.md` | Rules for Claude agents |
| `CODEX.md` | Rules for OpenAI Codex |
| `.cursorrules` | Rules for Cursor AI |
| `deploy-audit.log` | Logs every deploy attempt with timestamp + result |

## Branch Strategy
| Branch | Purpose | Deploy to prod? |
|--------|---------|-----------------|
| pessy-website | Production-ready code | YES (only this one, only via deploy-with-landing.sh) |
| main | Development (different architecture) | NEVER |
| feature/* | Feature development | NEVER (merge to pessy-website first) |
| sandbox/* | Experimental work | NEVER |
| claude/* | AI agent worktrees | NEVER |

## Pre-Deploy Checklist (MANDATORY)
- [ ] On `pessy-website` branch (not a worktree, not detached HEAD)
- [ ] Branch is up to date with origin
- [ ] `public/landing.html` exists and has content (>1KB)
- [ ] `deploy-with-landing.sh` exists
- [ ] User has explicitly approved the deploy
- [ ] NOT modifying firebase.json rewrites

## Forbidden Actions
- Deploying from `main` or any branch other than `pessy-website`
- Deploying from any worktree (`.claude/worktrees/`, `.codex/`)
- Running `firebase deploy` directly (use deploy-with-landing.sh)
- Modifying firebase.json rewrites
- Pushing to `pessy-website` without user approval
- Touching website files when working on PWA: public/landing.html, public/blog/, public/team/, public/tailwind.css, public/og-cover.png, public/robots.txt, public/sitemap.xml
- Deleting ANY file from public/ without explicit user approval
- Removing or weakening the `predeploy` hook in firebase.json

## Incident Log
- 2026-03-27: Agent deployed from `main` instead of `pessy-website`. main has different SPA
  architecture without landing page. Result: blank page in production. Fixed by redeploying from pessy-website.
- 2026-03-30: Bulletproof protection added after 4 incidents (predeploy hook, Codex/Cursor rules,
  pre-push git hook, worktree detection, audit logging).
