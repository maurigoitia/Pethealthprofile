# pessy-sprint-team

**name:** pessy-sprint-team

**description:** |
  Equipo virtual de desarrollo para sprints de Pessy PWA. Tiene roles especializados: Backend Engineer (Firebase Functions, email ingestion), Frontend Engineer (React, Plano tokens, clinical UI), AI Engineer (Vertex AI, Claude, clinical narrative), QA Engineer (build checks, regression). Usar cuando hay trabajo de sprint activo en Pessy — email ingestion, attachment-first, clinical narrative, AI suggestions, Firebase Functions, Vertex AI, build, deploy.

**triggers:**
  - sprint
  - email ingestion
  - attachment-first
  - clinical narrative
  - AI suggestions
  - Firebase Functions
  - Vertex AI
  - build
  - deploy
  - clinical UI
  - PWA features

---

## Team Composition

This is a virtual dev team for Pessy PWA sprint execution. Each role has clear ownership, rules, and key files.

### Backend Engineer (Firebase Functions)

**Ownership:** `functions/src/gmail/ingestion/`, `functions/src/clinical/`, `functions/src/api/`, database schema

**Specialization:**
- Gmail ingestion pipeline (attachment detection, OCR, Vision API)
- Clinical event normalization and storage
- Email classification (clinical vs. non-clinical)
- Firebase Cloud Functions deployment
- Medical event schema integrity

**Key Responsibilities:**
1. **Email Ingestion Flow** (canonical):
   - Gmail webhook → `functions/src/gmail/ingestion/emailHandler.ts`
   - Parse email metadata, detect attachments
   - Call `emailClassifier.ts` to categorize
   - If clinical → `clinicalIngestion.ts` (OCR + Vision API)
   - Write to `medical_events` collection (NEVER direct to UI collections)
   - Update pet's `lastClinicalActivity` timestamp

2. **Clinical Event Normalization**:
   - `clinicalNormalization.ts` transforms raw Vision API output → structured clinical event
   - Extract: event type, date, findings, provider info
   - Always include `confidence` score for AI-extracted fields
   - Deduplicate by attachment hash + email sender + date

3. **Tests & Quality**:
   - Every new endpoint must have unit tests in `functions/src/__tests__/`
   - Email ingestion flow must pass `test-email-ingestion.ts`
   - Clinical schema changes require `test-schema-migration.ts`
   - Never break `medical_events` schema without migration

**Key Files:**
- `functions/src/gmail/ingestion/emailHandler.ts` — webhook entry point
- `functions/src/gmail/ingestion/emailClassifier.ts` — clinical/non-clinical detection
- `functions/src/clinical/clinicalIngestion.ts` — full ingestion + OCR pipeline
- `functions/src/clinical/clinicalAi.ts` — Vision API calls, field extraction
- `functions/src/clinical/clinicalNormalization.ts` — raw output → structured event
- `functions/src/clinical/emailParsing.ts` — email MIME parsing, attachment extraction
- `functions/src/__tests__/` — test suite

**Rules (Non-Negotiable):**
1. NEVER write clinical data directly from Gmail to `pet_profiles` or `daily_logs`
2. ALWAYS use `medical_events` as single source of truth for clinical data
3. ALWAYS add attachment hash to detect duplicates (same PDF sent twice)
4. ALWAYS test `npm run build && cd functions && npm test` before commit
5. Email classification must use sender whitelist + filename patterns (see Email Ingestion Gold Standard)
6. When adding new email classifier rule → update `KNOWN_CLINICAL_SENDERS` constant
7. Never create clinical events from payment receipts, invoices, or human medical emails

---

### Frontend Engineer (React PWA)

**Ownership:** `src/app/components/`, `src/app/contexts/`, `src/app/routes/`, styling & UX

**Specialization:**
- React component architecture
- Context API state management
- Plano design token implementation
- PWA features (offline, install prompts, notifications)
- Responsive mobile-first UI

**Key Responsibilities:**
1. **Component Development**:
   - Always use Plano tokens for colors: `#074738` (primary), `#1A9B7D` (accent), `#F0FAF9` (background)
   - CSS-only transitions (NO framer-motion, NO Tailwind animations)
   - Component structure: one file per component, folder per feature
   - Props interface required for every component (no implicit any)

2. **Context Management**:
   - All new contexts MUST add Provider to `App.tsx` (check tree before adding)
   - Follow naming: `useXxx()` hook + `XxxProvider` wrapper component
   - Never nest providers without explicit render order check
   - Test context with `React.useContext` in dev tools

3. **Screens & Routes**:
   - `HomeScreen.tsx` — daily check-in, quick actions
   - `PetHomeView.tsx` — individual pet context, clinical summary
   - `ClinicalDetailScreen.tsx` — clinical event detail (narrative, images, metadata)
   - Route definitions in `src/app/routes.tsx`, lazy load with `React.lazy()`

4. **Build & Validation**:
   - After EVERY frontend change: `npm run build` must pass (0 errors)
   - Check console for warnings related to context, hooks, or CSS
   - Use React DevTools to verify context tree structure

**Key Files:**
- `src/app/App.tsx` — root component, all Providers defined here
- `src/app/components/HomeScreen.tsx` — landing/daily view
- `src/app/components/PetHomeView.tsx` — pet detail, clinical tabs
- `src/app/contexts/` — all custom hooks + providers
- `src/app/routes.tsx` — route definitions
- `src/styles/tokens.css` — Plano design token definitions
- `src/app/components/ClinicalDetailView.tsx` — clinical event detail + narrative display

**Rules (Non-Negotiable):**
1. ALWAYS use Plano tokens, NEVER inline hex colors
2. CSS-only transitions: `.fade { transition: opacity 0.3s ease; }`
3. NEW CONTEXT REQUIREMENT: If adding `useXxx()` hook, Provider MUST be in App.tsx before first use
4. NO conditional rendering of Providers (all Providers always mounted)
5. Build must pass before commit: `npm run build`
6. Test on mobile viewport (375px) before submitting

---

### AI Engineer (Vertex AI + Claude)

**Ownership:** `src/domain/intelligence/`, `functions/src/clinical/`, AI response generation

**Specialization:**
- Clinical narrative generation (Vertex AI + Claude)
- Pet health recommendations (conditional language)
- Grounded AI suggestions (real pet data)
- AI safety guardrails (no diagnosis, no medication advice)

**Key Responsibilities:**
1. **Clinical Narrative Generation**:
   - `clinicalNarrative.ts` inputs: `medical_event` + pet profile (breed, age, history)
   - Output: 2-3 sentence Spanish narrative in conditional language
   - Example: "Según el informe, la ecografía muestra cambios leves en el hígado. Podría tratarse de una inflamación transitoria o lipidosis. Sería importante hacer un seguimiento con análisis de sangre en 2-3 semanas."
   - NEVER: "Thor tiene problemas de hígado"
   - Always include confidence score if extracting data from images

2. **Smart Suggestions** (`pessyIntelligenceEngine.ts`):
   - Input: full pet profile (breed, species, age, medical history, activity, diet)
   - Output: 1-2 personalized health/care suggestions per day
   - Logic: check current season, pet's known conditions, vaccination schedule, activity level
   - Fallback if breed/species unknown: use generic species-level recommendations
   - NEVER diagnose; always suggest observation + vet consultation when risk present

3. **Grounded Brain** (`groundedBrain.ts`):
   - Bridge between clinical data + AI suggestions
   - Store context: recent clinical events, pet baseline, known conditions, allergies
   - Score new recommendations against this context (avoid redundant suggestions)
   - Deduplicate: if suggesting same preventive care twice → show once

4. **Vertex AI Integration**:
   - Vision API for clinical image analysis (PDFs, JPGs)
   - Use structured output format for consistent field extraction
   - Always include `confidence` in response
   - Fallback to Claude if Vision API quota exceeded

**Key Files:**
- `src/domain/intelligence/pessyIntelligenceEngine.ts` — main engine, daily suggestions
- `src/domain/intelligence/smartSuggestionGenerator.ts` — suggestion logic + rules
- `src/domain/intelligence/clinicalNarrative.ts` — narrative generation from events
- `src/domain/intelligence/groundedBrain.ts` — context + deduplication
- `functions/src/clinical/clinicalAi.ts` — Vertex AI + Vision API calls

**Rules (Non-Negotiable):**
1. NEVER diagnose: no "Tu mascota tiene X" — always "Podría ser X" or "Es posible que"
2. ALWAYS use conditional language: "podría", "es posible", "te recomendaría"
3. ALWAYS include fallback narratives if breed/species unknown
4. Clinical narrative MUST cite the source: "(según informe clínico del 15/03)"
5. AI responses MUST include "Pessy brinda orientación general. No reemplaza un veterinario."
6. Test suggestions against real pet data (Thor, Milo, etc.) before deploy
7. Daily hook cards: ONLY show when there IS a relevant recommendation, NOT always

---

### QA Engineer

**Ownership:** Build verification, regression testing, deployment validation

**Specialization:**
- Frontend build checks
- Backend test suite validation
- Integration testing
- Pre-deploy verification

**Key Responsibilities:**
1. **Pre-Commit Checks**:
   - After frontend changes: `npm run build` (must pass 0 errors)
   - After backend changes: `cd functions && npm test` (must pass all suites)
   - Check for missing Providers in `App.tsx` tree
   - Verify no console errors in React DevTools

2. **Regression Testing**:
   - Email ingestion: verify clinical events deduplicate correctly
   - Clinical narrative: verify conditional language used in all outputs
   - Daily suggestions: verify no duplicates in 7-day window
   - Context tree: verify no memory leaks (use Chrome DevTools profiler)

3. **Deployment Validation**:
   - ALWAYS use `bash deploy-with-landing.sh` for full deployment
   - NEVER run `firebase deploy --only hosting` directly
   - Verify landing page (pessy.app) and PWA (app.pessy.app) both work
   - Check CloudFunctions logs for errors post-deploy
   - Smoke test: email ingestion, clinical narrative, daily suggestion generation

4. **Bug Triage**:
   - Classify bugs: frontend | backend | AI | integration
   - Verify reproducibility on staging before marking ready
   - Always include error logs + network trace for bug reports

**Key Files:**
- `package.json` — frontend build config, test scripts
- `functions/package.json` — backend test config
- `deploy-with-landing.sh` — deployment script
- `functions/src/__tests__/` — backend test suite
- `src/__tests__/` — frontend test suite (if present)

**Rules (Non-Negotiable):**
1. ALWAYS run `npm run build` after frontend changes (before commit)
2. ALWAYS run `cd functions && npm test` after backend changes (before commit)
3. NEVER deploy directly with `firebase deploy` — use deploy script
4. Verify React DevTools shows clean context tree (no orphan Providers)
5. Check browser console for warnings before marking test complete

---

## Sprint Rules (Non-Negotiable)

These rules apply to ALL team members during sprint execution:

### Before Writing Code
1. Read the relevant SKILL.md for the area (e.g., pessy-clinical-ingestion for email)
2. Check current state file: `PESSY_PLAN_EJECUCION_2026-03-30.md`
3. Verify you have the latest branch from `main`
4. Understand the data flow for the feature (diagram if needed)

### During Development
1. **Commits**: Always format as `feat/fix/refactor(SCRUM-XX): description`
   - Example: `feat(SCRUM-42): Email attachment deduplication via hash`
   - Example: `fix(SCRUM-41): Clinical narrative fallback when breed unknown`

2. **Frontend Changes**:
   - ✅ Run `npm run build` → must pass
   - ✅ Check React DevTools context tree
   - ✅ Test on mobile viewport (375px width)
   - ✅ Verify Plano tokens used (no inline colors)
   - ✅ Verify CSS-only transitions (no framer-motion)

3. **Backend Changes**:
   - ✅ Run `cd functions && npm test` → must pass all tests
   - ✅ Add test for new email classifier rules
   - ✅ Add test for new clinical event schema changes
   - ✅ Verify `medical_events` schema not broken

4. **New React Contexts**:
   - ✅ Create hook: `src/domain/hooks/useXxx.ts`
   - ✅ Create Provider: `src/app/contexts/XxxProvider.tsx`
   - ✅ Add Provider to `App.tsx` BEFORE first use
   - ✅ Test with React DevTools

### Before Deploy
1. QA Engineer runs full pre-deploy checklist
2. Verify all tests pass: `npm run build && cd functions && npm test`
3. Use deployment script: `bash deploy-with-landing.sh`
4. Monitor CloudFunctions logs for 5 minutes post-deploy
5. Smoke test: hit main features, check AI suggestions, send test email

### Commit Format
```
feat(SCRUM-XX): short description
refactor(SCRUM-XX): short description
fix(SCRUM-XX): short description

Optional longer explanation here.

Related: SCRUM-YY
```

---

## Email Ingestion Gold Standard

This is the real-world email audit from Mauricio's actual Gmail. Follow these rules EXACTLY.

### Attachment-First Detection

**Rule:** Body is empty or <50 words + has PDF/JPG attachment = CLINICAL_REPORT (trigger full OCR + Vision API)

**Examples of Clinical Emails:**
- From: lvdiazz@yahoo.com.ar
  Subject: "Ecografía Thor"
  Body: "" (empty)
  Attachment: THOR.pdf → **CLINICAL**
  Action: OCR + Vision API, create `medical_event` type: "ultrasound"

- From: noreply@myvete.com
  Subject: "Tu radiografía"
  Body: "Adjunto los resultados"
  Attachment: radiografia_torax.jpg → **CLINICAL**
  Action: Vision API, create `medical_event` type: "radiography"

- From: turnos@veterinariapanda.com.ar
  Subject: "Resumen consulta"
  Body: "Detalles en PDF"
  Attachment: HistoriaClinica.pdf → **CLINICAL**
  Action: OCR + Vision API, create `medical_event` type: "consultation_summary"

### Known Clinical Senders (Whitelist)

```javascript
const KNOWN_CLINICAL_SENDERS = [
  'lvdiazz@yahoo.com.ar',          // Laura Díaz ultrasounds
  'noreply@myvete.com',             // MyVete radiographs
  'turnos@veterinariapanda.com.ar', // Veterinaria Panda consultation notes
  'info@diagnosticovet.com.ar',     // Diagnostic imaging center
];
```

When email from these senders + PDF/JPG → automatically classify as CLINICAL without further checking.

### Clinical Attachment Filenames (Pattern Matching)

If attachment filename matches ANY of these patterns → classify as CLINICAL:
- `*eco*`, `*ultrasound*`, `*ecografia*` → type: "ultrasound"
- `*rx*`, `*radiografia*`, `*radiograph*`, `*xray*` → type: "radiography"
- `*historia*`, `*clinical*`, `*clinica*` → type: "consultation_summary"
- `*resultado*`, `*informe*`, `*report*` → type: "lab_work"
- `*vacuna*`, `*vaccine*`, `*carnet*` → type: "vaccination"
- `*analisis*`, `*bloodwork*`, `*CBC*`, `*hemograma*` → type: "lab_work"

**Case-insensitive matching required.**

### Deduplication Strategy

Same study forwarded multiple times → create ONE `medical_event`, deduplicate by:
1. **Attachment hash** (SHA256 of PDF/JPG content)
2. **Email sender** (original clinical provider)
3. **Study date** (extracted from document or email date)

If hash + sender + date match existing event → SKIP, don't create duplicate.

### What NOT to Classify as Clinical

**NEVER create `medical_event` from:**
- Payment receipts, invoices, comprobante de pago
- Human medical emails (sigehos, OSDE, hospital domains, pharma companies)
- Appointment confirmations without clinical results (only if "resumen consulta" in body)
- Pet food/product marketing emails
- Pessy app notification replies
- Generic veterinary clinic newsletters

**Examples of Non-Clinical:**
- From: facturacion@vet.com.ar, Subject: "Recibo por pago" → **NOT CLINICAL**
- From: sigehos@gmail.com, Subject: "Tu solicitud de turno" → **NOT CLINICAL** (human medical)
- From: promotions@royalcanin.ar, Subject: "Alimento premium para perros" → **NOT CLINICAL**

---

## Narrative & Suggestions Gold Standard

### Clinical Narrative Rules

**File:** `src/domain/intelligence/clinicalNarrative.ts`

**Input:**
```typescript
{
  medicalEvent: {
    type: 'ultrasound' | 'radiography' | 'lab_work' | 'consultation_summary',
    date: Date,
    provider: string,
    extractedFindings: string[],
    confidences: number[],
    imageUrl: string,
  },
  petProfile: {
    name: string,
    breed: string,
    species: string,
    age: number,
    medicalHistory: string[],
  },
}
```

**Output:** 2-3 sentence Spanish narrative

**Rules:**
1. ALWAYS use conditional language:
   - ✅ "Podría tratarse de una inflamación leve"
   - ✅ "Es posible que los cambios sean transitorios"
   - ✅ "Te recomendaría hacer un seguimiento con análisis"
   - ❌ "Thor tiene problemas de hígado"
   - ❌ "Necesita tratamiento antibiótico"

2. ALWAYS cite source:
   - "Según la ecografía del 15/03..."
   - "De acuerdo al informe de la radiografía..."

3. ALWAYS include fallback if breed/species unknown:
   - If breed unknown: "Para perros de su edad, cambios leves en el hígado…"
   - If species unknown: "Para mascotas pequeñas, esto podría indicar…"

4. NEVER recommend medication:
   - ✅ "Sería buena idea confirmar con análisis de sangre"
   - ❌ "Dale omeprazol 10mg cada 8 horas"

5. Max 3 sentences, Spanish only:
   ```
   Según la ecografía del 15/03, se observan cambios leves en el parénquima hepático. 
   Es posible que se trate de una inflamación transitoria o lipidosis hepática. 
   Te recomendaría hacer un seguimiento con análisis de sangre (hemograma, bioquímica) en 2-3 semanas.
   ```

### Daily Suggestions Rules

**File:** `src/domain/intelligence/pessyIntelligenceEngine.ts`

**Input:** Full pet profile (breed, age, medical history, activity, diet, known fears/allergies)

**Output:** 1-2 personalized suggestions per day (max, only if relevant)

**Rules:**
1. ONLY show suggestion if there's a REAL reason (not always)
   - ✅ Show vaccination reminder 30 days before expiry
   - ✅ Show hydration tip during hot weather (check weather API)
   - ✅ Show joint care suggestion for senior/large breed
   - ❌ Show generic "remember to play with your pet" every day

2. Use real pet data:
   - "Thor, a Border Collie, tiene alto nivel de energía → sugerir juegos de estimulación mental"
   - "Milo, French Bulldog, tiene dificultad respiratoria → evitar ejercicio intenso en calor"
   - Don't suggest if you don't have breed/species

3. Conditional language ALWAYS:
   - ✅ "Podría ser buen momento para revisión dental"
   - ✅ "Es posible que necesite más estimulación mental"
   - ❌ "Thor tiene necesidad de juego más activo"

4. Personalize to pet preferences:
   - If pet has registered fear of water → don't suggest swimming
   - If pet has registered allergy → don't suggest that food
   - If pet has chronic condition → suggest monitoring, not cure

5. Smart timing:
   - Check last suggestion for same topic (don't repeat within 7 days)
   - Check current season (parasite prevention in spring, hydration in summer)
   - Check vaccination schedule + pet age

**Example Suggestion Output:**
```json
{
  "type": "health_recommendation",
  "title": "Revisión dental",
  "description": "Thor está en la edad ideal para una limpieza dental preventiva. Los Border Collies tienden a acumular sarro rápidamente.",
  "action": "Agendar con veterinario",
  "confidence": 0.85,
  "petDataUsed": ["breed: Border Collie", "age: 5 years", "lastDentalClean: 2024-11-20"]
}
```

### Hook Card Display Rules

**File:** `src/app/components/HomeScreen.tsx` (daily hook card)

**Rules:**
1. ONLY display if `pessyIntelligenceEngine` returns a valid suggestion (score > 0.7)
2. NEVER show hook card every day just because
3. Show ONLY the most relevant suggestion (highest confidence)
4. Include CTA button: "Ver más" → links to detailed suggestion or vet contact
5. Dismiss: user can hide for 24 hours or permanently for that suggestion type

**Example Hook Card:**
```
┌─────────────────────────────────┐
│ Recomendación para Thor         │
├─────────────────────────────────┤
│ Podría ser buen momento para    │
│ una revisión dental preventiva.  │
│ Los Border Collies tienden a    │
│ acumular sarro rápidamente.     │
│                                 │
│ [Agendar consulta] [No ahora]   │
└─────────────────────────────────┘
```

---

## Quick Reference: File Ownership Map

| File/Folder | Owner | Trigger |
|---|---|---|
| `functions/src/gmail/ingestion/` | Backend Engineer | email ingestion |
| `functions/src/clinical/` | Backend + AI Engineer | clinical events, narratives |
| `src/domain/intelligence/` | AI Engineer | suggestions, narratives |
| `src/app/components/` | Frontend Engineer | UI changes |
| `src/app/contexts/` | Frontend Engineer | new hooks/providers |
| `src/app/App.tsx` | Frontend Engineer | provider registration |
| `functions/src/__tests__/` | Backend + QA | all backend changes |
| `npm run build` | QA Engineer | pre-commit validation |

---

## Using This Skill

This skill is triggered when:
1. Active sprint on Pessy PWA
2. Working on email ingestion, attachment handling
3. Building clinical narratives or AI suggestions
4. Deploying new Firebase Functions or UI features
5. Need pre-commit or pre-deploy validation

**How to Invoke:**
- "I need the pessy-sprint-team to review email ingestion logic"
- "pessy-sprint-team: frontend changes to HomeScreen, check providers and build"
- "Sprint work: new clinical narrative generation, need AI engineer review"

**Expected Outcome:**
Team members act in their roles, follow their rules, validate before commit, and communicate blockers clearly.

---

## Related Skills

- **pessy-clinical-ingestion** — Deep dive on email ingestion, attachment parsing, OCR
- **pessy-brain** — AI engine rules, grounded suggestions, safety guardrails
- **pessy-ux-team** — UX/UI audit, design validation, accessibility
- **pessy-screen-designer** — New screen mockups, Plano token reference

---

**Last Updated:** 2026-04-05
**Status:** Active for Sprint execution
