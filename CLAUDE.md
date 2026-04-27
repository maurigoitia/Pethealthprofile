# PESSY — Rules for AI Agents

## ⛔ READ THIS FIRST: Environment Separation Contract

**PESSY is three independent deliverables in one repo:**

| Environment | Source | Dev server | Entry file |
|-------------|--------|-----------|-----------|
| PWA (React) | `src/` | `npm run dev:pwa` → :5173 | `app.html` |
| Landing page | `apps/web/` | `npm run dev:landing` → :5174 | `apps/web/index.html` |
| Blog | `apps/blog/` | `npm run dev:blog` → :5175 | `apps/blog/blog.html` |

**NEVER** cross these boundaries:
- Do NOT import `apps/web/*` or `apps/blog/*` from `src/`
- Do NOT import `src/*` from `apps/web/*` or `apps/blog/*`
- Do NOT edit `vite.config.ts` to handle landing or blog — Vite is PWA-only
- Do NOT unify `npm run dev` into a multiplexer — each env has its own command
- Do NOT add React/Tailwind/Vite deps for landing or blog use

**Full contract and verification commands: see `ENVIRONMENTS.md` (repo root).**

---

## ⛔ NEVER run `firebase deploy` manually

`main` is the production branch. **Deploys happen exclusively via GitHub Actions** (`deploy-prod.yml`), never from the terminal.

Running `firebase deploy` manually WILL BREAK pessy.app. This happened TWICE already (2026-03-27, 2026-03-28).

---

## Branch model

| Branch | Purpose | Deploy |
|--------|---------|--------|
| `main` | Production | GitHub Actions only — triggers after CI passes |
| `develop` | Staging | Auto-deploys to `appqa` on push |
| feature branches | Development | No deploy |

Production deploy: merge to `main` → `deploy-prod.yml` runs after CI passes.
Manual deploy: GitHub Actions UI → `workflow_dispatch`.

**NEVER run manually:**
- `firebase deploy` (any variant)
- `firebase deploy --only hosting`
- `firebase deploy --only hosting:app`
- `firebase deploy --only functions`

**OK locally:**
- `npm run dev` · `npm run build` · `npm test` · `firebase emulators:start`

---

## Product map

### Identity
Pessy organiza la vida cotidiana con mascotas, integrando información, rutinas y servicios en un solo lugar.  
**Promesa de marca (Plano):** *"Tu mascota, sus cosas, todo en orden."*  
**Pessy NO es una app médica. NO es una herramienta clínica. NO es un chatbot.**  
Es simple, útil y cercana. Tono: humano, práctico, ordenado — nunca técnico ni clínico.

**Misión:** Facilitar la vida cotidiana con mascotas ayudando a organizar información, rutinas y cuidados en un solo lugar, de forma simple y accesible.  
**Visión:** Construir una plataforma que acompañe toda la vida de la mascota, donde su información esté siempre ordenada y disponible.  
**Valores:** Claridad · Cercanía · Utilidad · Confianza · Proactividad

**Regla de tono para agentes:** nunca usar "clínico", "médico", "historial clínico" en copy de UI. Usar "Historial", "salud", "cuidado".

### 4 Pillars (bottom nav)

| Pillar | What it is | Key screens |
|--------|-----------|-------------|
| **Día a Día** | Daily pulse, check-ins, tips by breed/weather/history | HomeScreen, DailyHookCard, PessyTip, QuickActions, RoutineChecklist |
| **Rutinas** | Meds, vaccines, appointments, grooming, deworming | RemindersScreen, AppointmentsScreen, MedicationsScreen |
| **Comunidad** | Adoption, lost/found, local explore, connections | LostPetFeed, ReportLostPet, NearbyVetsScreen |
| **Identidad Digital** | Pet passport, narrative profile, docs, export | PetProfileModal, Timeline, ClinicalProfileBlock, ExportReportModal, VaccinationCardModal |

Medical (Timeline, ClinicalProfileBlock, etc.) = **intelligence layer**, lives behind the pillars — never the face.

### Auth flow
`LoginScreen` → `RegisterUserScreen` → `RegisterPetStep1` → `RegisterPetStep2` → `HomeScreen`

### Vet mode (separate)
`VetLoginScreen` → `VetDashboard` → `VetPatientList` → `VetConsultationView`

### Tech stack
- React 18 + TypeScript + Vite + Firebase (Auth + Firestore + Functions)
- Capacitor (iOS + Android native wrapper — NOT Flutter)
- Design tokens: Plano Branding "Functional Warm Tech"
  - Primary `#074738` · Accent `#1A9B7D` · Surface `#E0F2F1` · Background `#F0FAF9`
  - Typography: Plus Jakarta Sans (headings) + Manrope (body)
  - CSS-only transitions — NEVER framer-motion
- Routing: `createBrowserRouter` (react-router v6)
- Key routes: `/` root → `/inicio` + `/home` → HomeScreen, `/login` → LoginScreen

### AI behavior rules (inside the app)
- Never diagnose · Never recommend medication · Never replace a vet
- Always use conditional language: "Podría ser…", "Es posible que…"
- Always close the loop — connect, don't just suggest
- Tone: calm, supportive, simple, non-technical

---

## CI/CD — deploy-prod.yml

Service account: `pessy-github-deploy@polar-scene-488615-i0.iam.gserviceaccount.com`
Auth: Workload Identity Federation (GitHub Actions → GCP)

### IAM roles granted to service account
- Firebase Admin (original)
- Administrador de Secret Manager (2026-04-13)
- Editor — `roles/editor` (2026-04-13) — covers Cloud Scheduler, Functions IAM, and most GCP services

### Deploy flags
- Functions: `--force` flag required to auto-delete orphaned functions (PR #8)
- Hosting target: `app` → site `polar-scene-488615-i0` → domain `pessy.app`

### Known domains
| Domain | Status | Notes |
|--------|--------|-------|
| `pessy.app` | ✅ Active | Production — smoke tested in CI |
| `app.pessy.app` | ❌ 404 | Never configured as custom domain in Firebase Hosting |

### Hosting targets (.firebaserc)
| Target | Site | Use |
|--------|------|-----|
| `app` | `polar-scene-488615-i0` | Production (pessy.app) |
| `appqa` | `pessy-qa-app` | QA/Staging |
| `appit` | `itpessy` | IT environment |
| `appfocusqa` | `pessy-focus-qa` | Focus QA |
| `appsubdomain` | `pessy-app-subdomain` | Unused — not deployed |

---

## Incident log
- 2026-03-27: Agent deployed hosting from main manually → blank page in production
- 2026-03-28 ~12:41: Agent deployed hosting from main manually AGAIN → broke CSS/layout
- 2026-04-07: CI/CD audit — unified branch policy, Node 22, test gate, dist/ untracked
- 2026-04-13: Operación Limpieza — fixed all deploy blockers (Secret Manager, Cloud Billing API, orphaned functions --force, Editor role for scheduler/IAM, smoke test 404). Full green deploy ✅

---

## Pending (non-blocking)
- `VITE_GOOGLE_PLACES_KEY` env var — verify it's set for Explorar feature in production
- GitHub Actions Node.js 20 deprecation — update actions to Node 24 support before June 2026
- Stubs needing real implementation: sentryConfig, i18n, nativePushService, LanguageSelector
- `app.pessy.app` — either configure as custom domain or remove references
