---
name: pessy-devops
description: >
  Senior DevOps and cloud architecture team for PESSY. Use this skill for CI/CD,
  Firebase deployment, hosting config, environment management (QA/staging/prod),
  build verification, Lighthouse audits, service worker debugging, DNS/SSL,
  GitHub Actions, monitoring, and infrastructure decisions. Also trigger for
  deployment failures, 404s, caching issues, or new environment setup.
  Decisions are budget-conscious: $200/mo month 1, $300/mo by month 4, max $1000/mo at year 1.
---

# PESSY DevOps & Cloud Architecture

Senior infrastructure team. Keep deployments smooth, environments separated, costs low.

## Infrastructure

- **Firebase project**: `polar-scene-488615-i0`
- **Hosting targets**: app (pessy.app), appqa, appit, appfocusqa, appsubdomain (app.pessy.app)
- **Auth**: Firebase Auth (email/password + Google OAuth)
- **DB**: Cloud Firestore
- **Storage**: Firebase Storage
- **Push**: FCM
- **GitHub**: `maurigoitia/Pethealthprofile`

## Environments
| Env | URL | Deploy |
|---|---|---|
| Production | pessy.app | `npx firebase deploy --only hosting:app` |
| QA local | localhost:3001 | `npx vite --port 3001` (symlink index.html → app.html) |
| QA remote | pessy-qa.web.app | `npx firebase deploy --only hosting:appqa` |

## Critical Knowledge

### SPA Routing
- Vite entry: `app.html` (not index.html) — build uses `rollupOptions.input: 'app.html'`
- Firebase rewrite: all routes → `/index.html` (Vite outputs index.html in dist/)
- Local dev: symlink `index.html → app.html` for Vite SPA fallback
- Workbox: `navigateFallback: '/index.html'`

### Service Worker
- Aggressive caching via vite-plugin-pwa + Workbox
- After deploy, users on old SW may see stale content until SW updates
- `skipWaiting: true` + `clientsClaim: true` helps but isn't instant
- For critical fixes: bump build ID and redeploy

### Deploy Checklist
1. `npm run build` — verify zero errors, check dist/ output
2. `npx firebase deploy --only hosting:app` — uses default project from .firebaserc
3. Verify routes: `/inicio`, `/login`, `/register-user`, `/privacidad`
4. Check SW registration in DevTools → Application → Service Workers

## Budget Guardrails
Scale target: 50,000 users. Budget discipline is critical.

| Period | Max monthly spend | Focus |
|---|---|---|
| Month 1 | $200 | Firebase free tier + minimal hosting |
| Month 4 | $300 | Add monitoring, basic CI/CD |
| Year 1 | $1,000 | Full pipeline, CDN, error tracking |

### Cost-effective stack decisions
- Firebase Spark (free) covers up to ~50K reads/day, 1GB storage, 10GB hosting
- Move to Blaze (pay-as-you-go) only when hitting limits
- Use Firebase Hosting (included) instead of Cloudflare/Vercel
- GitHub Actions free tier (2,000 min/mo) covers CI needs
- Sentry free tier for error tracking (5K events/mo)
- No paid monitoring until >10K MAU — use Firebase Performance (free)
