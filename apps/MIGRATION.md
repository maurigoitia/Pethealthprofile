# Monorepo Migration Plan

## Current State (monolith)

Everything builds from a single `vite.config.ts` entry (`app.html`) into `dist/`.
All 5 Firebase Hosting targets serve the same `dist/` folder.

### What lives where today

| Content | Source files | Entry point |
|---------|-------------|-------------|
| **PWA (app)** | `src/app/**`, `src/domain/**`, `src/lib/**` | `app.html` -> `src/main.tsx` |
| **Website (landing)** | `public/index.html` (static) | `public/index.html` (copied to dist/) |
| **Blog** | `public/blog/*.html`, `public/blog/*/index.html` | Static HTML files (8 articles) |
| **Legal pages** | Rendered by React router (`/privacidad`, `/terminos`) | Part of PWA bundle |

## Target State (monorepo)

```
apps/
  website/    -> Landing page (pessy.app root)
  pwa/        -> React SPA (pessy.app/login, /inicio, /home, etc.)
  blog/       -> Static blog articles
```

Each app builds independently. Firebase Hosting targets can point to different `public` dirs.

## Migration Steps (in order)

### Step 1: Blog (safest, fully static)
- Move `public/blog/` and `public/blog.html` to `apps/blog/`
- Update `firebase.json` rewrites for `/blog/**`
- Blog has zero JS dependencies — pure HTML/CSS

### Step 2: Website (landing)
- Move `public/index.html` (landing) to `apps/website/`
- Move associated landing assets
- The landing page is static HTML — no build step needed
- Update firebase.json so the `app` target serves `/` from `apps/website/`

### Step 3: PWA (core app)
- Move `src/`, `app.html`, `vite.config.ts` to `apps/pwa/`
- Update all import paths
- PWA keeps its own `package.json` with React/Vite deps
- Firebase `app` target serves everything else from `apps/pwa/dist/`

### Step 4: Shared packages (if needed)
- `packages/ui/` — shared components between PWA and website
- `packages/config/` — shared Firebase config, types
- Only create when there's actual code to share

## Rules

1. **Never break the build** — test `npm run build` after every move
2. **One step at a time** — complete blog before starting website
3. **Keep firebase.json working** — update rewrites/targets as you move files
4. **Test locally** — `firebase emulators:start` after each change
5. **Don't move code that's still coupled** — decouple first, move second
