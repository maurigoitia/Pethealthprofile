# PESSY — CTO Handoff Document

> Generated: 2026-04-01 | Branch: `claude/lucid-dubinsky` (14 commits ahead of main)
> Training set: 8/8 (100%) | Build: clean | PWA: operational

---

## 1. What PESSY Is (One Sentence)

**A deterministic behavioral decision engine for pet wellness, wrapped in a PWA super-app with AI-powered clinical intelligence, serving 50K+ target users across web and mobile.**

---

## 2. Product Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        PESSY SUPER-APP                          │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │  PWA (React)  │  │ Capacitor 7  │  │  Landing (pessy.app) │  │
│  │  Vite 6 + TW4 │  │ iOS/Android  │  │  Static HTML         │  │
│  └──────┬───────┘  └──────┬───────┘  └──────────────────────┘  │
│         │                  │                                    │
│  ┌──────┴──────────────────┴──────────────────────────────────┐ │
│  │                    DOMAIN LAYER                             │ │
│  │                                                             │ │
│  │  Intelligence Engine ──→ Routing Layer ──→ Primary/Secondary│ │
│  │       │                      │                              │ │
│  │  Wellbeing Master Book   Segment Strategies                 │ │
│  │  Training Master Book    Injectable Guardrails              │ │
│  │  Training Set (8 cases)  Priority Sorting                   │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                   FIREBASE BACKEND                          │ │
│  │                                                             │ │
│  │  Auth (email/link/google) │ Firestore (16 collections)     │ │
│  │  Cloud Functions (18+)    │ Storage (medical docs)          │ │
│  │  Cloud Messaging (push)   │ Hosting (pessy-website branch) │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                CLINICAL PIPELINE                            │ │
│  │                                                             │ │
│  │  Gmail OAuth ──→ Email Ingestion ──→ Gemini Analysis        │ │
│  │       │              │                    │                  │ │
│  │  Text Extraction  Pet Matching      Brain Resolver          │ │
│  │  PDF/OCR/HEIC     Fuzzy Match       (deterministic routing) │ │
│  │                                          │                  │ │
│  │                              medical_events / pending_review │ │
│  └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Core Intelligence System

### Golden Rule
> "Lógica determinística con piel generativa" — AI only writes copy, never decides rules.

### Decision Flow
```
Input (pet profile + environment)
  │
  ├── inferTrainingSegmentId() → segment classification
  │     Priority: reactive > puppies > active_working > companion
  │     Cats → null (no training segment)
  │
  ├── 15 modules fire independently (each has its own if-gate)
  │
  ├── applySegmentStrategy() → ROUTING LAYER
  │     ├── priorityModules → sorted to top
  │     ├── demoteModules → pushed to bottom
  │     └── injectGuardrailCodes → safety blocks added
  │
  └── splitPrimarySecondary() → UX SPLIT
        ├── primary: blocks + alerts + top recs (what tutor sees first)
        └── secondary: everything else (collapsed/expandable)
```

### Segments & Strategies

| Segment | Triggered By | Priority Modules | Injects |
|---------|-------------|-----------------|---------|
| `reactive` | anxiety, aggression, dog.reactive | aggression_prevention, separation_anxiety, thermal | no_aversives, loose_leash, trigger_mgmt |
| `puppies` | isPuppy, dog.puppy | puppy_socialization, thermal | no_punishment, gradual_exposure |
| `active_working` | dog.active_working | thermal, daily_activity, training | avoid_understimulation, consistent_commands |
| `companion` | fallback (all other dogs) | thermal, training | short_sessions, same_words |

### 15 Active Modules

| Module | Gate | Species | Output Type |
|--------|------|---------|-------------|
| thermal_safety (heat) | temp > threshold | dog+cat | block/alert |
| thermal_safety (cold) | temp < comfortableMin | dog+cat | recommendation/alert |
| puppy_socialization | isPuppy | dog | recommendation + block |
| separation_anxiety (do_first) | hasSeparationAnxiety | dog | recommendation + alert |
| separation_anxiety (never_do) | hasSeparationAnxiety | dog | block (3 guardrails) |
| aggression_prevention | hasAggressionSigns | dog | alert + block |
| active_working | dog.active_working | dog | recommendation + alert |
| training_master_book | species=dog | dog | recommendation (1 cmd) |
| food_safety | always (species-filtered) | dog+cat | block/alert (daily rotation) |
| fears_weather | storm + fear match | any | alert |
| weather_activity | isRaining | any | recommendation |
| time_of_day | currentHour defined | any | recommendation/alert |
| uv_index | UV ≥ 8 | any | recommendation/alert |
| wind_alert | wind ≥ 50 km/h | any | recommendation |
| breed_profile | has primaryRisks | any | recommendation |
| daily_activity | always (personalized) | any | recommendation |
| supply_tracker | foodDaysLeft ≤ 7 | any | alert/recommendation |
| fears_seasonal | fireworks dates | any | alert |

### Training Set (CI Gate)
8 cases, 100% passing. Any failure blocks deploy.

| Case | Scenario | Segment | Primary | Secondary |
|------|----------|---------|---------|-----------|
| Thor | Pug, brachy, 31°C heat | companion | 5 | 3 |
| Lola | Puppy, unvaccinated | puppies | 5 | 3 |
| Milo | Separation anxiety | reactive | 8 | 5 |
| Nori | Persian cat, heat | null | 5 | 0 |
| Paco | Galgo, 3°C cold | companion | 5 | 2 |
| Kai | Border Collie, working | active_working | 5 | 3 |
| Rocky | Aggression signs | reactive | 8 | 4 |
| Luna | Puppy + aggression | reactive | 8 | 5 |

---

## 4. Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + TypeScript + Vite 6 + Tailwind v4 |
| State | 7 Context Providers (Auth, Pet, Medical, Notifications, Reminders, Preference, Gamification) |
| Backend | Firebase (Auth, Firestore, Functions, Storage, Messaging) |
| Functions | Node 22, TypeScript, 18+ deployed functions |
| AI | Google Gemini 2.0 Flash + Vertex AI (grounding) |
| Email | Resend API |
| Mobile | Capacitor 7 (iOS 15+ / Android 8+) |
| PWA | Workbox, offline caching, push notifications |
| CI/CD | GitHub Actions (3 workflows: pr-check, staging-deploy, prod-deploy) |

---

## 5. Domain Data

| Collection | Records | Purpose |
|-----------|---------|---------|
| users | — | User accounts, preferences, onboarding |
| pets | — | Pet profiles, breed, medical history, co-tutors |
| medical_events | — | Clinic visits, vaccines, diagnostics |
| treatments | — | Active medications, dosages, schedules |
| appointments | — | Vet appointments, follow-ups |
| clinical_episodes | — | SOAP-formatted episode summaries |
| clinical_alerts | — | AI-generated health warnings |
| reminders | — | Medication/appointment reminders |
| verified_reports | — | Medical documents with hash verification |
| invitations | — | Co-tutor invite codes |

---

## 6. Security Posture (Post-Hardening)

### Fixed in This Branch (claude/lucid-dubinsky)
- ✅ Firebase admin → Custom Claims (`request.auth.token.admin == true`)
- ✅ clinicalAi.ts → Fully deterministic document_type classification
- ✅ brainResolver.ts → AI confidence removed from routing decisions
- ✅ Storage rules → SVG blocked, explicit type allowlist
- ✅ Crypto key → `extractable: false`, no sessionStorage persistence
- ✅ Login → No user enumeration (neutral error messages)
- ✅ Firestore rules → Co-tutor field whitelist (`changedKeys().hasOnly(...)`)

### Pending (chore/security-night-batch)
- 🔧 Gemini API key in URL query params → Move to Authorization header
- 🔧 CORS not explicit on gmailAuthCallback → Add headers
- 🔧 ANALYSIS_MODEL not declared in runWith secrets

### Future Considerations
- App Check (Firebase) — not yet configured
- Rate limiting on public Cloud Functions
- Vault/Secret Manager for OAuth refresh tokens (currently Firestore-encrypted)

---

## 7. CI/CD Pipeline

```
PR to main ──→ pr-check.yml
                ├── npm install
                ├── TypeScript check
                ├── Build (Vite)
                ├── Training set gate (8/8 required)
                ├── Functions build
                └── Build verification (index.html, assets, bundle <15MB)

PR open ──→ staging-deploy.yml
              ├── Training set gate
              ├── Build
              └── Firebase preview channel → comment URL on PR

Push to main ──→ prod-deploy.yml
                   ├── TypeScript check
                   ├── Build
                   ├── Training set gate
                   ├── Build verification
                   ├── Functions build
                   └── Deploy (Firestore rules, Storage rules, Functions)
                   ⚠ Does NOT deploy hosting (pessy-website branch only)
```

---

## 8. Deployment Model

| Environment | Branch | URL | Deploy Method |
|------------|--------|-----|--------------|
| Production (landing) | pessy-website | pessy.app | `bash deploy-with-landing.sh` |
| Production (SPA) | pessy-website | pessy.app/app.html | Same script |
| Staging (preview) | any PR | Firebase preview channel | CI auto-deploys |
| Development | main | localhost:5173 | `npm run dev` |

**⛔ NEVER deploy hosting from `main` branch.** This has caused 2 production incidents.

---

## 9. Key Metrics (Architecture)

| Metric | Value |
|--------|-------|
| Frontend components | 133 |
| Domain logic (lines) | ~2,964 |
| Functions logic (lines) | ~23,295 |
| Intelligence modules | 15 |
| Training segments | 4 |
| Training cases | 8 (100% passing) |
| Master book items | 14 food safety + 8 stress signals + 50+ daily suggestions |
| Firestore collections | 16 |
| Cloud Functions | 18+ |
| External APIs | 6 (Gemini, Resend, Gmail, Places, Open-Meteo, Unsplash) |

---

## 10. What's Next (Recommended Priorities)

1. **Merge PR** — `claude/lucid-dubinsky` (routing layer, security hardening, CI/CD)
2. **Merge PR** — `chore/security-night-batch` (API key fix, CORS, secrets)
3. **Bootstrap admin claim** — Run `setAdminClaim` on mauri@pessy.app
4. **Add FIREBASE_TOKEN** — GitHub repo secrets for CI
5. **Wire remaining master book data** — routines (morning/evening), stress_ladder (educational)
6. **User testing** — Run 2 real users through the intelligence engine output
7. **App Check** — Configure Firebase App Check for production
