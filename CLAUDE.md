# PESSY — Rules for AI Agents

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
Pessy is a **personal AI assistant for pet care** — NOT a medical app, NOT a chatbot.
Core promise: *"Pessy conecta a tu mascota con lo que necesita, sin que tengas que buscar."*
Pessy never says "go look for it" — Pessy takes you there.

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

## Incident log
- 2026-03-27: Agent deployed hosting from main manually → blank page in production
- 2026-03-28 ~12:41: Agent deployed hosting from main manually AGAIN → broke CSS/layout
- 2026-04-07: CI/CD audit — unified branch policy, Node 22, test gate, dist/ untracked
