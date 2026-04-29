# PESSY — Environment Separation Contract

> **Read this before touching ANY code in this repo.**
> Violating these rules has broken production twice. Do not repeat history.

## The three environments

PESSY is not one app — it is **three independent deliverables** that happen to share a repo:

| # | Environment | Source | Dev server | Build output | Deploys to |
|---|-------------|--------|-----------|--------------|------------|
| 1 | **PWA** (React app) | `apps/pwa/src/` | `npm run dev:pwa` → `:5173` | `dist/app.html` + `dist/assets/*` | `pessy.app/inicio` (Firebase hosting target `app`) |
| 2 | **Landing page** | `apps/web/` | `npm run dev:landing` → `:5174` | `dist/index.html` + `dist/team/` | `pessy.app/` (same site, different file) |
| 3 | **Blog** | `apps/blog/` | `npm run dev:blog` → `:5175` | `dist/blog.html` + `dist/blog/` | `pessy.app/blog/*` |

**Never** share processes, never share styles, never share runtime code across these.

---

## The Iron Rules

### 🚫 Never do these

1. **Do not import from `apps/web/` or `apps/blog/` inside `apps/pwa/src/`.** The PWA is a React app. If it needs an asset the landing has, copy it into `public/`.
2. **Do not import from `apps/pwa/src/` inside `apps/web/` or `apps/blog/`.** The landing/blog are plain HTML with zero build step. They do not know React exists.
3. **Do not add React/Tailwind/Vite dependencies to the landing or blog.** If the landing grows beyond HTML+CSS, open an RFC and migrate it to its own workspace. Don't smuggle it in.
4. **Do not run `firebase deploy` manually.** Ever. Deploys go through GitHub Actions (`deploy-prod.yml`). This has broken production twice.
5. **Do not add files outside the three source roots.** `apps/pwa/src/` is PWA. `apps/web/` is landing. `apps/blog/` is blog. Anything else is wrong.
6. **Do not change `vite.config.ts` to handle landing or blog.** Vite is PWA-only. The header comment in that file is a contract, not a suggestion.
7. **Do not unify `npm run dev`.** Each environment gets its own dev command. `dev` is an alias for `dev:pwa`, not a multiplexer.

### ✅ Always do these

1. **Keep source roots physically separate.** PWA changes touch only `apps/pwa/src/`. Landing changes touch only `apps/web/`. Blog changes touch only `apps/blog/`.
2. **Use the right dev command for the right task.**
   - Editing the React app? `npm run dev:pwa`
   - Editing the landing HTML? `npm run dev:landing`
   - Editing a blog article? `npm run dev:blog`
3. **When in doubt, run the verification below before you claim you're done.**

---

## Why this matters (incident log)

- **2026-03-27:** Agent deployed hosting manually from `main`. Broke production. Root cause: no environment isolation — a single bad command touched both landing and PWA output.
- **2026-03-28 12:41:** Agent did it **again**. Broke CSS/layout. Same root cause.
- **2026-04-13:** Operación Limpieza — first real attempt at separation. Introduced `app.html` vs `index.html` split, added `postbuild-website.js`, SW denylist.
- **2026-04-14:** Full environment separation (this document). Isolated dev servers, separate env files, explicit contracts.

---

## File ownership map

```
.
├── public/                   ← PWA static assets served at /
├── app.html                  ← PWA entry point (NOT index.html)
├── apps/
│   ├── pwa/
│   │   └── src/              ← PWA (React). OWNED BY: vite.config.ts + Tailwind
│   │       ├── app/
│   │       ├── domain/
│   │       └── lib/
│   ├── web/                  ← LANDING. OWNED BY: serve-landing.js. Zero JS deps.
│   │   ├── index.html
│   │   ├── team/
│   │   └── og-cover.png
│   └── blog/                 ← BLOG. OWNED BY: serve-blog.js. Zero JS deps.
│       ├── blog.html
│       └── articles/
├── scripts/
│   ├── serve-landing.js      ← Landing-only dev server (port 5174)
│   ├── serve-blog.js         ← Blog-only dev server (port 5175)
│   ├── postbuild-website.js  ← Copies landing+blog into dist/ after Vite build
│   ├── sync-website.js       ← Copies apps/web/ → public/ for legacy path
│   └── sync-blog.js          ← Copies apps/blog/ → public/ for legacy path
├── vite.config.ts            ← PWA BUILD ONLY. Never edit for landing/blog.
├── .env.pwa                  ← PWA env vars only
├── .env.landing              ← Landing env vars only
├── .env.blog                 ← Blog env vars only
└── package.json              ← Single root. Scripts are namespaced (dev:pwa, dev:landing, dev:blog).
```

---

## How the pieces fit in production

```
                    Firebase Hosting (pessy.app)
                              │
            ┌─────────────────┼─────────────────┐
            │                 │                 │
            ▼                 ▼                 ▼
     GET /              GET /inicio       GET /blog/*
            │                 │                 │
     dist/index.html    dist/app.html    dist/blog/...
      (from apps/         (from Vite        (from apps/
       web/)               build of          blog/)
                           apps/pwa/src/)
            │                 │                 │
     LANDING PAGE         PWA REACT APP      BLOG HTML
     (static HTML)         (React SPA)      (static HTML)
```

Firebase serves whichever file matches the URL. There is no server-side routing — just static file delivery. The three environments NEVER share runtime code because they are literally different HTML files.

---

## How to verify separation is intact

Run this before any PR that touches config, build, or dev tooling:

```bash
# 1. PWA dev server must serve app.html (React) for /inicio
npm run dev:pwa &
sleep 3
curl -s http://localhost:5173/inicio | grep -q 'id="root"' && echo "✅ PWA OK" || echo "❌ PWA BROKEN"

# 2. Landing dev server must serve plain HTML (no React) for /
npm run dev:landing &
sleep 1
curl -s http://localhost:5174/ | grep -q '<html' && echo "✅ Landing OK" || echo "❌ Landing BROKEN"

# 3. Blog dev server must serve blog.html for /
npm run dev:blog &
sleep 1
curl -s http://localhost:5175/ | grep -q '<html' && echo "✅ Blog OK" || echo "❌ Blog BROKEN"

# 4. Full production build must produce all three outputs in dist/
npm run build
test -f dist/app.html    && echo "✅ PWA build"      || echo "❌ PWA missing"
test -f dist/index.html  && echo "✅ Landing build"  || echo "❌ Landing missing"
test -f dist/blog.html   && echo "✅ Blog build"     || echo "❌ Blog missing"
```

If any of these fail, **stop and fix the isolation before merging anything**.

---

## Commands quick reference

| Task | Command | Port |
|------|---------|------|
| Dev PWA | `npm run dev:pwa` (or `npm run dev`) | 5173 |
| Dev landing | `npm run dev:landing` | 5174 |
| Dev blog | `npm run dev:blog` | 5175 |
| Build everything for deploy | `npm run build` | — |
| Build PWA only | `npm run build:pwa` | — |
| Build PWA for mobile (Capacitor) | `npm run build:mobile` | — |
| Run PWA tests | `npm run test` | — |

---

## Escalation path

If this contract becomes a pain point (e.g. the landing grows to need a real build system), the next step is **npm workspaces**: give each app under `apps/` its own `package.json` and use `npm run dev --workspace=pwa`. That's Option A from the separation discussion on 2026-04-14. Don't do it until you genuinely need it — workspace moves break CI, Capacitor paths, and imports.

Until then: **the contract above is the law.**
