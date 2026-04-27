# Work Recovery Map — 2026-04-27

**Purpose:** snapshot of where the last 2 days of work live in the repo after the folder separation. Designed so that another chat or another agent can pick up without losing context.

**Status:** living document. Update when phases close or scope shifts.

---

## 1. Repo structure after separation

```
apps/
├── web/                  Landing / public website (was apps/website)
├── blog/                 Blog (sources for blog.pessy.app)
├── pwa/
│   └── src/              PWA app source (was root src/)
└── mobile/               Capacitor wrapper (was root capacitor.config.ts + ios/ + android/)
    ├── capacitor.config.ts
    ├── ios/
    └── android/

functions/                Firebase Functions / backend / AI pipelines (root)

firebase.json             Root — shared
.firebaserc               Root — hosting targets app / appqa / appit / appfocusqa
firestore.rules           Root
firestore.indexes.json    Root
storage.rules             Root

docs/
├── superpowers/plans/    Long-form plans (export source-backed, staging real, etc.)
├── ops/
└── WORK_RECOVERY_MAP_2026-04-27.md   ← this file

dist/                     Build output (root, gitignored)
public/                   Static assets (root)
scripts/                  Build/dev scripts (root)
.github/workflows/        CI/CD (root)
```

Root is now reserved for: monorepo glue (`package.json`, `tsconfig.*`, `vite.config.ts`), Firebase shared config, build scripts, and CI.

---

## 2. UI / UX / visual design work

| Area | Location | Status |
|---|---|---|
| Stitch design system tokens | `apps/pwa/src/app/components/...` (Plano tokens applied component-by-component) | merged on `develop` |
| Login / welcome | `apps/pwa/src/app/components/auth/LoginScreen.tsx`, `RegisterUserScreen.tsx`, `RequestAccessScreen.tsx` | merged |
| Onboarding pet | `apps/pwa/src/app/components/onboarding/RegisterPetStep1.tsx`, `RegisterPetStep2.tsx` | merged |
| Pet profile / Identidad Digital | `apps/pwa/src/app/components/pet/`, `PetProfileModal.tsx`, `Timeline.tsx`, `ClinicalProfileBlock.tsx` | merged |
| Appointments | `apps/pwa/src/app/components/appointments/` | merged |
| Medications | `apps/pwa/src/app/components/medications/` (under reminders/treatments) | merged |
| Adoption | `apps/pwa/src/app/components/community/AdoptionFeed.tsx`, `AdoptionContainer.tsx`, `AdopterProfileSetup.tsx` | merged |
| Community / Lost-found | `apps/pwa/src/app/components/community/LostPetFeed.tsx`, `ReportLostPet.tsx` | merged (mock data removed, empty state if no real data) |
| Vet search / nearby vets | `apps/pwa/src/app/components/vet/NearbyVetsScreen.tsx` | merged (depends on `VITE_GOOGLE_PLACES_KEY` in prod — verify) |
| Timeline / history redesign | `apps/pwa/src/app/components/timeline/` + plan `docs/superpowers/plans/2026-04-26-episode-engine-history-redesign.md` | partial — design merged, episode-engine plan pending |
| Export modal visual | `apps/pwa/src/app/components/export/ExportReportModal.tsx`, `VaccinationCardModal.tsx` | merged |
| PDF branding / logo / disclaimer | PDF builder under `apps/pwa/src/app/components/export/` and shared utils | partial — see Section 4 |
| Validation pill | export PDF section | partial |
| Home greeting V2 | `apps/pwa/src/app/components/home/HomeScreen.tsx` (`HomeGreetingV2` was reverted to stable main version) | merged (rollback shipped) |

Tone rule applied across UI: **never** "clínico/médico/historial clínico" in copy. Use "Historial", "salud", "cuidado".

---

## 3. AI / parameterization work

All AI logic lives in `functions/src/`. The PWA never calls Gemini directly.

| Function | Location | Status |
|---|---|---|
| `analyzeDocument` | `functions/src/ingest/analyzeDocument.ts` (or equivalent) | live in prod |
| `generateClinicalSummary` | `functions/src/clinical/` | live |
| `pessyClinicalSummaryStructured` | `functions/src/clinical/structured.ts` | live |
| `pessyCompileRecentEpisodes` | `functions/src/clinical/episodes.ts` | live |
| `pessyHomeIntelligence` | `functions/src/home/intelligence.ts` | live |
| Gmail / email ingestion | `functions/src/gmail/` (Resend → AES-256 → Gemini → `medical_events`) | live |
| Clinical normalization | `functions/src/clinical/normalize.ts` | live |
| `groundedBrain` / RAG | `functions/src/brain/` | partial — RAG layer in progress |
| Source-backed export | **plan only** — `docs/superpowers/plans/2026-04-27-export-source-backed-safety-core.md` | docs merged, no implementation |

Safety contract (must hold across all AI surfaces): never diagnose · never prescribe · never replace vet · always conditional language · always close the loop.

---

## 4. Export PDF work

**Current implementation:** PDF is built client-side with `jspdf`, consuming Firestore data + Gemini-generated narrative from Functions. Lives in `apps/pwa/src/app/components/export/`.

**What works today:**
- PDF generates and downloads
- Pulls vaccinations, treatments, events, tutor notes
- Includes Pessy branding, disclaimer, validation pill
- Shows "Información faltante" and "Preguntas sugeridas para el veterinario"

**What remains risky (safe by prompt, not by architecture):**
- Empty pet still calls Gemini → can hallucinate
- `tutor_input` can leak into "documented diagnoses"
- "Preguntas sugeridas" can contain disguised treatment recommendations
- "Información faltante" reads as clinical deficiency, not profile-improvement invitation
- No server-side filter on Gemini output

**Source-backed plan:** `docs/superpowers/plans/2026-04-27-export-source-backed-safety-core.md` — defines the 5 mandatory fixes:
1. Empty pet → skip Gemini, return safe template
2. Define "documented literally" (Firestore source-typed)
3. `tutor_input` cannot become `documentedDiagnoses`
4. Server-side filter on `suggestedQuestionsForVet`
5. Rename "Información faltante" → "Información que podría mejorar tu perfil"

**Next implementation steps:**
1. Backend PR: types + builder `buildExportPayload(petId)` + tests
2. Frontend PR: PDF renderer consumes payload only
3. QA with real pet (Thor as QA case only — never hardcoded)
4. No diagnosis, no treatment recommendation, no hardcoded pet/species/condition

---

## 5. Deploy / Firebase work

| Item | Location | Status |
|---|---|---|
| Branch model + protection (Phase 0a) | repo settings + `CLAUDE.md` | live |
| Staging hosting-only warning + smoke test (Phase 0b) | `.github/workflows/deploy-staging.yml`, smoke step | live |
| Backend shared-resource PR warning (Phase 0c) | `.github/workflows/pr-backend-warning.yml` | live |
| Firebase config cleanup (Phase 1) | `firebase.json`, `.firebaserc` consolidated | merged |
| `apps/website` → `apps/web` (Phase 2) | repo move | merged |
| `src` → `apps/pwa/src` (Phase 3) | repo move (PR #81) | merged |
| Mobile → `apps/mobile/` (Phase 4) | this PR | in flight |
| Production deploy | `deploy-prod.yml` — only on merge to `main`, never manual | live, smoke tested |
| Staging deploy | `deploy-staging.yml` — pushes to `develop` | live (visual only, shared backend) |
| Real staging project | **plan only** — `docs/superpowers/plans/staging-real-roadmap.md` | docs merged, not executed |
| Service account / WIF (prod) | `pessy-github-deploy@polar-scene-488615-i0` with Firebase Admin + Secret Manager + Editor | live |

**Hard rule:** NEVER run `firebase deploy` manually from the terminal. Production deploys only via `deploy-prod.yml`.

---

## 6. Open items

- **PR #24 surgical cleanup** — dead-file removal, must run against new `apps/pwa/src` paths. Pending.
- **`preview.yml` failing** — non-required, pre-existing. Hotfix possible but low priority.
- **Export source-backed implementation** — backend PR + frontend PR + QA. Highest product-value next.
- **Real staging project (`pessy-staging`)** — plan exists, not approved for execution.
- **Mobile native validation** — `npx cap doctor` + iOS/Android local builds not verifiable in CI without Xcode/Android Studio. Manual native QA required before next mobile release.
- **`VITE_GOOGLE_PLACES_KEY`** — verify presence in prod for Explorar feature.
- **Stubs to implement** — `sentryConfig`, `i18n`, `nativePushService`, `LanguageSelector`.
- **`app.pessy.app`** — either configure as custom domain or remove all references.
- **GitHub Actions Node 20 deprecation** — update before June 2026.

---

## 7. Production-readiness table

| Item | Merged | PR open | Docs only | Pending impl | Needs QA |
|---|---|---|---|---|---|
| Phase 0a/0b/0c CI safeguards | ✅ |  |  |  |  |
| Phase 1 Firebase cleanup | ✅ |  |  |  |  |
| Phase 2 `apps/web` | ✅ |  |  |  |  |
| Phase 3 `apps/pwa/src` | ✅ |  |  |  |  |
| Phase 4 `apps/mobile` |  | ✅ |  |  | ✅ native build |
| Export PDF current | ✅ |  |  |  | risk: prompt-only safety |
| Export source-backed |  |  | ✅ | ✅ | ✅ |
| Staging real |  |  | ✅ | ✅ |  |
| Home greeting V2 rollback | ✅ |  |  |  |  |
| Comunidad mock removal | ✅ |  |  |  |  |
| Firebase auth domain fix (staging white screen) | ✅ |  |  |  |  |
| AI pipelines (clinical, episodes, home intel, gmail) | ✅ |  |  |  | ongoing tuning |
| RAG / groundedBrain |  |  |  | ✅ |  |
| Production smoke test (`pessy.app`) | ✅ |  |  |  |  |

---

## 8. What is "done" today

After Phase 4 merges:
- ✅ `apps/web`, `apps/blog`, `apps/pwa`, `apps/mobile` separated
- ✅ `functions` and Firebase config in root by design
- ✅ Two planning docs (export source-backed, staging real) saved as checkpoints
- ✅ This recovery map documents where everything lives

Next focus: **export source-backed implementation** (backend → frontend → QA with real pet).
Not next: Phase 5 (none planned), PR #24 cleanup (after export), staging-real execution (after export stabilizes).
