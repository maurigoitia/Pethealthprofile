# PESSY — Arquitectura Técnica (Actualizada Abril 2026)

**Última actualización:** 5 de abril de 2026  
**Branch:** `pessy-website` (producción)  
**Estado:** Producción activa con PWA + Firebase backend completo

---

## 1. Stack Principal

| Componente | Tecnología | Versión |
|-----------|-----------|---------|
| **Frontend Framework** | React | 18.3.1 |
| **Build Tool** | Vite | 6.3.5 |
| **Lenguaje** | TypeScript | 5.9.2 |
| **Mobile** | Capacitor | 7.4.3 |
| **PWA** | vite-plugin-pwa | 1.2.0 |
| **Estilos** | Tailwind CSS 4 + motion | 4.1.12 + 12.38.0 |
| **Routing** | React Router | 7.13.0 |
| **Formularios** | React Hook Form | 7.55.0 |
| **UI Icons** | lucide-react | 0.487.0 |
| **Toasts** | Sonner | 2.0.3 |
| **Backend** | Firebase | 12.9.0 |
| **Cloud Functions** | Firebase Functions | v5.1.1 |
| **Admin SDK** | firebase-admin | 12.7.0 |
| **Node Runtime** | Node.js | 22 |
| **AI/ML** | Google Vertex AI | 1.10.0 |
| **Email** | Resend | 6.9.3 |
| **PDF Generation** | jsPDF | 4.2.1 |
| **HEIC Support** | heic2any | 0.0.4 |
| **Documento Processing** | Mammoth | 1.11.0 |

**Base de datos:** Firestore (NoSQL)  
**Almacenamiento:** Firebase Storage  
**Autenticación:** Firebase Auth (email, Google, Apple)  
**Hosting:** Firebase Hosting (`pessy.app`)  
**CI/CD:** Pre-deploy hooks + audit logging

---

## 2. Diagrama de Arquitectura

```
┌─────────────────────────────────────────────────────────────────┐
│                         pessy.app (PWA)                         │
│  Frontend: React 18 + TypeScript + Tailwind + Vite             │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ Pages (9): HomeScreen, LoginScreen, PetProfileModal, etc.   ││
│  │ Components (63): ActionTray, Headers, Modals, Cards, etc.   ││
│  │ Contexts (7): Auth, Medical, Pet, Gamification, etc.        ││
│  │ Services (8): calendarSync, brainKnowledge, analysis, etc.  ││
│  │ Utils: clinicalBrain, clinicalRouting, medicalRules, etc.   ││
│  └─────────────────────────────────────────────────────────────┘│
└──────────────────┬──────────────────────────────────────────────┘
                   │ HTTPS
                   ▼
┌─────────────────────────────────────────────────────────────────┐
│              Firebase Hosting (pessy.app)                       │
│  Landing Page (/) → public/landing.html                         │
│  SPA Routes (/login, /inicio, /register-*) → dist/app.html      │
│  Catch-all rewrite (** → /app.html) para React Router           │
│  Headers: no-cache para index.html + app.html                   │
│  Predeploy hook: pre-deploy-check.sh (bloquea bad deployments)  │
└──────────────────┬──────────────────────────────────────────────┘
                   │
        ┌──────────┼──────────┐
        ▼          ▼          ▼
    ┌────────┐ ┌────────┐ ┌────────┐
    │Firestore │ │Storage │ │ Auth  │
    │(NoSQL)  │ │(fotos) │ │(email)│
    └────────┘ └────────┘ └────────┘
        │          │          │
        └──────────┼──────────┘
                   │
                   ▼
    ┌──────────────────────────────────┐
    │  Firebase Cloud Functions v5      │
    │  Node.js 22 + TypeScript          │
    │  ┌──────────────────────────────┐ │
    │  │ Módulos activos:             │ │
    │  │ • Appointments (booking)      │ │
    │  │ • Clinical (medical logic)    │ │
    │  │ • Community (lost pets)       │ │
    │  │ • Places (nearby vets)        │ │
    │  │ • Compliance (email reminders)│ │
    │  │ [DISABLED: Gmail clinical]    │ │
    │  └──────────────────────────────┘ │
    │  External APIs: Vertex AI, Resend │
    └──────────────────────────────────┘
```

---

## 3. Frontend (PWA)

### 3.1 Estructura del Código

```
src/app/
├── components/           (63 archivos .tsx)
│   ├── Screen components: HomeScreen, LoginScreen, etc.
│   ├── Modals: PetProfileModal, HealthReportModal, etc.
│   ├── Layout: Header, BottomNav, ActionTray
│   ├── Cards & Lists: Reusable UI components
│   └── Specialized: DocumentScannerModal, ExportReportModal
│
├── contexts/             (7 providers)
│   ├── AuthContext.tsx          → User auth state
│   ├── MedicalContext.tsx        → Medical events, clinical data
│   ├── PetContext.tsx            → Pet list, profiles
│   ├── GamificationContext.tsx   → Achievements, streaks
│   ├── NotificationContext.tsx   → Toast/alert management
│   ├── RemindersContext.tsx      → Medication reminders
│   └── PreferenceContext.tsx     → User preferences
│
├── pages/                (9 page components)
│   ├── Landing pages (Empezar, LandingSocial, Preview pages)
│   ├── Legal page
│   └── Preview pages para features
│
├── services/             (8 service modules)
│   ├── analysisService.ts         → Medical report analysis
│   ├── brainKnowledgeService.ts   → Clinical knowledge base
│   ├── calendarSyncService.ts     → iCal sync
│   ├── notificationService.ts     → FCM & notifications
│   ├── petPhotoService.ts         → Photo upload & HEIC handling
│   ├── gmailSyncService.ts        → Gmail OAuth flow [DISABLED]
│   ├── accountDeletionService.ts  → GDPR account removal
│   └── dataExportService.ts       → Data export (PDF/CSV)
│
├── utils/                (26 utility modules)
│   ├── Clinical logic:
│   │   ├── clinicalBrain.ts       → Inference engine
│   │   ├── clinicalRouting.ts     → Context-aware routing
│   │   ├── medicalRulesEngine.ts  → Rule evaluation
│   │   └── deduplication.ts       → Event deduplication
│   │
│   ├── Data processing: firebase utils, date formatters, etc.
│   └── UI helpers: responsive, animation, accessibility
│
├── hooks/                (Custom React hooks)
├── types/                (TypeScript interfaces & types)
├── constants/            (App constants, config)
├── config/               (Firebase config, environment)
└── data/                 (Seed data, static datasets)
```

### 3.2 Características PWA

- **Manifest:** Pessy app, standalone mode, portrait orientation
- **Service Worker:** Auto-update, offline support, precaching
- **Caching Strategy:**
  - Google Fonts: 30 días
  - Open-Meteo (weather): 30 minutos
  - Unsplash images: 7 días
  - HEIC library: 90 días (runtime cache)
- **SPA Fallback:** navigateFallback → `/index.html` (React Router)
- **Build Output:**
  - Vite split chunks por módulo Firebase + vendor pesado
  - Entry: `index.html` (landing) + `app.html` (SPA)

### 3.3 State Management (React Context)

Arquitectura de contextos sin Redux/Zustand:

- **AuthContext:** User authentication, sign-in/out
- **MedicalContext:** Medical events, conditions, alerts, diagnoses (73KB — el más grande)
- **PetContext:** Pet list, current pet, profiles
- **GamificationContext:** Streaks, achievements, rewards
- **NotificationContext:** Toast queue, alert management
- **RemindersContext:** Medication schedule, notifications
- **PreferenceContext:** Dark mode, language, notifications preferences

---

## 4. Backend (Firebase)

### 4.1 Authentication

- **Providers:** Email/password, Google OAuth, Apple Sign-In
- **Custom Claims:** Role-based (admin, moderator, user)
- **Session Management:** Auto-refresh tokens, secure logout

### 4.2 Firestore — Esquema de Colecciones

```
┌─ users/{userId}                    (Perfil de usuario)
│   ├── name, email, profilePhoto, preferences
│   ├── accountStatus, createdAt, lastLogin
│   ├── coTutorOfPets[], fcm_tokens/
│   └── /fcm_tokens/{tokenId}         (Push notifications)
│
├─ pets/{petId}                      (Perfil de mascota)
│   ├── name, species, breed, birthDate, weight
│   ├── ownerId, coTutorUids[]
│   ├── photos[], medications[], vaccines[]
│   ├── personality{}, dailyRoutine{}
│   ├── medicalHistory[], behavioralNotes
│   └── /dailyCheckins/{checkinId}    (Daily wellness)
│
├─ medical_events/{eventId}          (Registros clínicos)
│   ├── petId, userId, eventType (vaccine, symptom, exam, etc.)
│   ├── notes, attachments[], clinicalCode, severity
│   ├── detectedConditions[], suggestedActions[]
│   ├── timestamp, source (manual, document, email[DISABLED])
│   └── status (open, resolved, archived)
│
├─ medications/{medicationId}        (Medicamentos)
│   ├── petId, name, dosage, frequency, route
│   ├── prescribedBy, startDate, endDate
│   ├── completionRate, nextDose
│   └── reminders[]
│
├─ appointments/{appointmentId}      (Turnos veterinarios)
│   ├── petId, userId, vetId
│   ├── type (checkup, vaccination, surgery, etc.)
│   ├── dateTime, location, notes
│   ├── status (pending, confirmed, completed, cancelled)
│   └── externalId (clinic system)
│
├─ clinical_conditions/{conditionId} (Diagnósticos)
│   ├── petId, name, icd10Code, onsetDate
│   ├── severity (mild, moderate, severe)
│   ├── treatmentPlan[], medications[]
│   ├── monitoringRequired, monitoringParams
│   └── resolvedDate (if applicable)
│
├─ diagnoses/{diagnosisId}          (Diagnósticos registrados)
│   ├── petId, condition, vetName, dateOfDiagnosis
│   ├── notes, testResults, attachments[]
│   └── confidence score
│
├─ treatments/{treatmentId}          (Planes de tratamiento)
│   ├── petId, conditionId, veterinarianId
│   ├── startDate, expectedEndDate, actualEndDate
│   ├── procedures[], medications[], exercises[]
│   └── outcomes[], complications[]
│
├─ clinical_alerts/{alertId}         (Alertas clínicas)
│   ├── petId, alertType (vaccine due, medication low, etc.)
│   ├── severity (info, warning, critical)
│   ├── message, actionable, actionUrl
│   ├── timestamp, resolved
│   └── relatedEventId
│
├─ reminders/{reminderId}            (Recordatorios)
│   ├── petId, type (medication, appointment, vaccine, etc.)
│   ├── nextDueDate, frequency (daily, weekly, once, etc.)
│   ├── enabled, notificationChannels[]
│   └── deliveryLog[]
│
├─ invitations/{code}                (Invitaciones para co-tutores)
│   ├── senderUid, senderEmail, recipientEmail
│   ├── petId, accessLevel (editor, viewer)
│   ├── createdAt, expiresAt, acceptedAt
│   └── status (pending, accepted, rejected)
│
├─ clinical_episodes/{episodeId}     (Episodios clínicos)
│   ├── petId, startDate, endDate, symptoms[]
│   ├── observations, temporalConnection[]
│   ├── episode status (active, resolved, chronic)
│   └── potentialCauses[]
│
├─ diagnoses/{diagnosisId}           (Historical diagnoses)
│
├─ pending_actions/{actionId}        (Acciones pendientes)
│   ├── petId, userId, actionType, description
│   ├── dueDate, priority, assignedTo
│   ├── completed, completedAt
│   └── metadata (context-specific fields)
│
├─ verified_reports/{reportId}       (Reportes verificados)
│   ├── petId, reportType (health, behavior, etc.)
│   ├── generatedAt, generatedBy (AI/user)
│   ├── content, attestedBy (veterinarian)
│   └── verificationStatus (pending, verified, disputed)
│
└─ scheduled_notifications/{id}      (Notificaciones programadas)
    ├── userId, message, payload
    ├── scheduledFor, sentAt
    └── status (pending, sent, failed)
```

**Total de colecciones:** 19 (bien estructuradas)

### 4.3 Firestore Rules (Seguridad)

- **Autenticación:** `signedIn()` required para la mayoría
- **Ownership:** Pet data protegida por `ownerId` + `coTutorUids[]`
- **Access Levels:** Owner (read+write), CoTutor (según `sharedAccessByUid`)
- **Medical Events:** Solo owner y assigned veterinarian
- **Invitations:** Solo sender y recipient pueden leer

### 4.4 Storage Rules

- **Pet Photos:** `/pets/{petId}/**` — Owner + coTutors
- **Documents:** `/documents/{petId}/**` — Owner + medical team
- **Attachments:** `/attachments/{eventId}/**` — Event owner + assigned vet

---

## 5. Cloud Functions (Node.js 22, Firebase Functions v5)

### 5.1 Estructura del Proyecto

```
functions/src/
├── index.ts                          (Exports principales)
│
├── appointments/                     (ACTIVO)
│   ├── onAppointmentCreate.ts        → Booking confirmation
│   ├── onAppointmentStatusChange.ts  → Status updates
│   ├── checkupReminders.ts           → Appointment reminders
│   └── calendarSync.ts               → Export a Google Calendar
│
├── clinical/                         (ACTIVO)
│   ├── ingestHistory.ts              → Parse uploaded documents
│   ├── brainResolver.ts              → Invoke clinical inference
│   ├── episodeCompiler.ts            → Create clinical episodes
│   ├── treatmentReminderEngine.ts    → Treatment notifications
│   ├── medicalRulesEngine.ts         → Rule evaluation
│   ├── clinicalIngestion.ts          → Main ingestion pipeline
│   ├── knowledgeBase.ts              → Medical reference data
│   ├── canonicalEventPolicy.ts       → Event normalization
│   ├── groundedBrain.ts              → AI reasoning engine
│   ├── projectionLayer.ts            → Clinical state projections
│   ├── notebookKnowledgeSync.ts      → Knowledge sync
│   ├── vertexDatastoreAdmin.ts       → Vertex AI management
│   ├── backfillProjection.ts         → Data migration
│   └── seedNotebookKnowledge.ts      → Seed data loader
│
├── community/                        (ACTIVO)
│   ├── onLostPetReport.ts            → Report lost pet
│   ├── onPetSighting.ts              → Report sighting
│   └── computeAdoptionMatches.ts     → Matching algorithm
│
├── places/                           (ACTIVO)
│   └── nearbyVets.ts                 → Query nearby veterinarians
│
├── gmail/                            (DISABLED - GMAIL-EXTRACTION-DISABLED)
│   ├── clinicalIngestion.ts          [DISABLED]
│   ├── ingestion/
│   │   ├── ...                       [DISABLED]
│   └── oauth.ts                      [DISABLED]
│   └── invitation.ts                 [DISABLED]
│
├── compliance/                       (ACTIVO)
│   └── sendEmailReminders.ts         → Medication email notifications
│   └── pessy email wrapper template
│
├── media/                            (ACTIVO)
│   └── processPetPhoto.ts            → Image optimization
│
└── utils/
    ├── rateLimiter.ts                → Rate limiting
    ├── (shared helpers)
    └── (error handling)
```

**Total de funciones:** 50+ (en index.ts exports)

### 5.2 Funciones Principales

#### Appointments Module
- `onAppointmentCreate` — Trigger en appointments/{id} → send confirmation email
- `onAppointmentStatusChange` — Update user when appointment changes
- `checkupReminders` — Pub/Sub scheduled job para reminder emails
- `calendarSync` — Export appointments a Google Calendar del usuario

#### Clinical Module (El corazón de Pessy)
- `ingestHistory` — Parse PDFs, clinical documents → normalized events
- `clinicalIngestion` — Main pipeline: upload → parse → AI analysis → store
- `brainResolver` — Invoke Vertex AI para clinical inference
- `episodeCompiler` — Compile events en temporal episodes (clusters)
- `treatmentReminderEngine` — Schedule reminders for medications/procedures
- `groundedBrain` — Advanced reasoning: symptom → condition → action
- `notebookKnowledgeSync` — Keep knowledge base up-to-date
- `medicalRulesEngine` — Rule-based decision engine

#### Community Module
- `onLostPetReport` — Create lost pet record, trigger matching
- `onPetSighting` — Report sighting, notify owner
- `computeAdoptionMatches` — Fuzzy matching: sighting → lost pet candidates

#### Places Module
- `nearbyVets` — Geo-query: find vets near user location, return booking links

#### Compliance Module
- `sendEmailReminder` — Email reminder para medication schedule (via Resend API)
- Email wrapper: Custom Pessy branding, unsubscribe links

### 5.3 Disabled Functions (Gmail Clinical Extraction)

Marcadas con `[GMAIL-EXTRACTION-DISABLED]`:
- `backfillNarrativeHistory`
- `backfillGmailTaxonomy`
- `cleanupLegacyMailsyncMedicalEvents`
- `ingestClinicalEmailWebhook`
- `resetEmailImportClinicalData`
- `runEmailClinicalAiWorker`
- `runEmailClinicalScanWorker`
- `runEmailClinicalAttachmentWorker`
- `triggerEmailClinicalIngestion`
- `forceRunEmailClinicalIngestion`

**Razón:** Gmail integration deshabilitada por requerimientos de seguridad (email API access) y cambio en arquitectura clínica.

### 5.4 Dependencias de Cloud Functions

```json
{
  "firebase-functions": "^5.1.1",
  "firebase-admin": "^12.7.0",
  "@google-cloud/vertexai": "^1.10.0",
  "google-auth-library": "^10.6.2",
  "resend": "^6.9.3",
  "mammoth": "^1.11.0"
}
```

- **firebase-admin:** Firestore writes, Auth, Storage
- **Vertex AI SDK:** AI clinical inference (Gemini models)
- **Resend:** Email delivery para reminders
- **Mammoth:** Parse DOCX clinical documents → HTML
- **google-auth-library:** OAuth 2.0 flows (for integrations)

---

## 6. Deploy Flow

### 6.1 Branching y Deployment

```
                        pessy-website (PRODUCTION)
                              │
                      (solo esta rama puede deploy)
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
      main             feature/* / sandbox/*    claude/*
  (no deploy)        (merge a pessy-website    (no deploy,
  (dev architecture)  antes de deploy)          worktree)
```

**Única rama autorizada:** `pessy-website`

### 6.2 Deploy Script (`deploy-with-landing.sh`)

```bash
1. Run pre-deploy-check.sh              (Valida condiciones)
2. npm run build                        (Vite build)
3. mv dist/index.html → dist/app.html  (SPA entry)
4. Patch sw.js                          (navigateFallback → /app.html)
5. cp public/landing.html → dist/index.html
6. Copy static assets (logo, robots.txt, sitemap.xml)
7. firebase deploy --only hosting       (Deploy predeploy hook)
```

**Importante:** No correr `firebase deploy` directamente. Siempre usar `bash deploy-with-landing.sh`.

### 6.3 Pre-Deploy Checks (`pre-deploy-check.sh`)

Bloquea deploys si:
1. En worktree Codex o Claude
2. En detached HEAD
3. No en branch `pessy-website`
4. public/landing.html no existe o <1KB
5. firebase.json rewrite no apunta a `/app.html`
6. dist/index.html es la SPA (no landing)
7. firebase.json predeploy hook removido

**Salida:** Log a `deploy-audit.log` con timestamp + usuario + resultado

### 6.4 Firebase Hosting Config

```json
{
  "hosting": {
    "predeploy": ["bash pre-deploy-check.sh"],
    "public": "dist",
    "headers": [
      {
        "source": "/index.html",
        "headers": [{"key": "Cache-Control", "value": "no-cache"}]
      },
      {
        "source": "/app.html",
        "headers": [{"key": "Cache-Control", "value": "no-cache"}]
      }
    ],
    "rewrites": [
      {"source": "/blog", "destination": "/blog.html"},
      {"source": "/blog/", "destination": "/blog.html"},
      {"source": "**", "destination": "/app.html"}
    ]
  }
}
```

- Landing en `/` (index.html)
- SPA en `/login`, `/inicio`, `/register-*` → app.html (React Router)
- Catch-all rewrite para navegación client-side

---

## 7. Decisiones de Arquitectura Clave

### 7.1 PWA (No React Native)

**Decisión:** Web PWA en lugar de React Native/Flutter

**Razones:**
- Single codebase para iOS/Android web + Capacitor wrapper
- Rápido time-to-market (2026 Q1-Q2)
- Capacitor permite acceso a features nativas (cámara, contact, etc.)
- Firebase Hosting + CDN global (latencia baja)
- Fácil actualización OTA (service worker)
- Costo menor vs. mantener dos native codebases

**Trade-off:** Performance nativo vs. desarrollo ágil. PWA es suficiente para MVP.

### 7.2 Firebase (No Supabase/PlanetScale)

**Decisión:** Firebase (Firestore + Cloud Functions + Auth + Storage)

**Razones:**
- Integración nativa con Vertex AI (clinical inference)
- Firestore real-time para notificaciones médicas
- Rules-based security model (granular access control)
- Serverless (no ops, auto-scaling)
- Plan de precios flexible (pay-per-use)
- Google Cloud ecosystem (storage, AI, compute)

### 7.3 Cloud Functions v5 (No Express.js Server)

**Decisión:** Firebase Cloud Functions v5 en lugar de Express.js/Node server

**Razones:**
- No server management
- Auto-scaling para traffic médico
- Integración directa con Firestore triggers
- Pub/Sub para background jobs
- Admin SDK built-in

### 7.4 Vertex AI para Clinical Inference (No fine-tuned models)

**Decisión:** Google Vertex AI (Gemini) como motor de razonamiento clínico

**Razones:**
- Acceso a modelos LLM SOTA (no necesita training)
- Semantic understanding de textos clínicos
- Few-shot learning via prompting
- API estable y soportada

**Trade-off:** No hay fine-tuning con datos de Pessy (por privacidad). Dependencia en prompts bien diseñados.

### 7.5 React Context (No Redux/Zustand)

**Decisión:** React Context para state management

**Razones:**
- Codebase pequeño (210 archivos .tsx)
- Redux sería overkill
- Context es suficiente para data local
- Vertical integration con Firestore listeners

**Límite:** Si app crece >500 componentes, considerar Zustand.

### 7.6 TypeScript Strict Mode

**Decisión:** TypeScript 5.9 con strict mode

**Razones:**
- Medical data is critical (type safety reduces bugs)
- Component contracts bien definidos
- IDE autocompletion
- Refactoring seguro

### 7.7 Tailwind CSS 4 (No CSS-in-JS)

**Decisión:** Tailwind CSS 4 con Vite plugin

**Razones:**
- Utility-first alineado con rapid prototyping
- Build time rápido
- Consistencia de diseño (tokens)
- Mobile-first responsive por defecto

### 7.8 Vite (No Create React App)

**Decisión:** Vite como build tool

**Razones:**
- Build time: ~200ms vs. 2s con CRA
- ES modules nativo
- Plugin ecosystem (PWA, SVG, etc.)
- Dev server con hot reload
- Production bundle optimizado

---

## 8. Lo que NO está en Producción

### 8.1 Gmail Clinical Ingestion [GMAIL-EXTRACTION-DISABLED]

**Status:** Completamente deshabilitado

**Razones:**
- Permisos OAuth de Gmail complejos
- Regulatory compliance (HIPAA, GDPR)
- Cambio de arquitectura clínica (ahora document-first, no email-first)

**Futuro:** Si se habilita, requiere:
- Scopes: `gmail.readonly`, `gmail.modify`
- User consent flow
- Webhook verification
- Encryption at rest

### 8.2 Veterinary Module (BETA)

**Status:** Interfaz implementada, lógica backend NOT WIRED

**Features:**
- `NearbyVetsScreen` — muestra vets cercanos
- Appointment booking UI
- Vet profile modal

**NO FUNCIONA AÚN:**
- Real vet database (test data only)
- Payment integration
- Scheduling sync con clinic systems

**Roadmap:** Q2 2026 (tras MVP)

### 8.3 Direct Payments (NOT YET)

**Status:** Deshabilitado

**Current:** Links a MercadoLibre, vet websites (external payment)

**Future (Q2 2026):**
- Stripe/MercadoPago integration
- Payment processing (tests con fake cards)
- Invoice generation

---

## 9. Tamaño y Complejidad Actual

### 9.1 Frontend

| Métrica | Cantidad |
|---------|----------|
| Components | 63 (.tsx files) |
| Contexts | 7 (auth, medical, pet, etc.) |
| Pages | 9 |
| Services | 8 |
| Utils modules | 26 |
| Total LoC (Frontend) | ~11,800 |
| Vite output (dist/) | ~1.2 MB (gzipped ~300KB) |

### 9.2 Backend

| Métrica | Cantidad |
|---------|----------|
| Cloud Functions | 50+ exported |
| Firestore collections | 19 |
| Firestore documents (avg) | 10K users × 3 pets × 50 medical events = 1.5M docs |
| Cloud Functions modules | 11 (appointments, clinical, community, places, etc.) |
| Total LoC (Backend) | ~5,000 |

### 9.3 Storage

- **Firebase Storage:** Pet photos (~10GB estimated for 10K users, 3 photos/pet)
- **Firestore size:** ~500MB (metadata + medical events)
- **CDN:** Firebase Hosting + Google Cloud CDN

---

## 10. Decisiones de Testing

- **Frontend:** Vitest + React Testing Library
- **Backend:** Jest (in functions/ if set up)
- **E2E:** Playwright (config en vite.config.ts)

---

## 11. Security & Compliance

### 11.1 Firestore Rules

- Owner-based access control
- CoTutor sharing (role-based: editor/viewer)
- Medical events: Only owner + assigned veterinarian

### 11.2 Firebase Storage Rules

- Signed URLs para documents
- Time-limited access (1 hour)
- Deletion only by owner

### 11.3 Authentication

- Firebase Auth (builtin rate limiting)
- Email verification for signup
- Custom claims para roles (admin, moderator)

### 11.4 Data Privacy

- No datos médicos en logs
- Firebase backups encrypted at rest
- GDPR: Account deletion service implemented (`accountDeletionService.ts`)

---

## 12. Monitoring & Debugging

### 12.1 Firebase Console

- Real-time database viewer
- Cloud Functions logs (Cloud Logging)
- Firestore indexes & query performance
- Storage usage & rules testing

### 12.2 Audit Log

**File:** `/deploy-audit.log`

Registra:
- Timestamp
- Usuario (whoami)
- Branch
- Deploy result (SUCCESS/BLOCKED)

Regenerado en cada deploy attempt.

### 12.3 Metrics

- Cloud Functions: Invocation count, latency, errors
- Firestore: Read/write operations, storage size
- Hosting: Traffic, response time, cache hit ratio

---

## 13. Próximos Pasos (Roadmap)

| Hito | Timeline | Componentes |
|------|----------|-------------|
| MVP | Q2 2026 | Pet profiles, medical timeline, medication reminders |
| Vet Integration | Q2 2026 | Nearby vets, appointment booking (external) |
| Payments | Q3 2026 | MercadoPago/Stripe, in-app purchases |
| Gmail Sync | Q3 2026 | Re-enable clinical email ingestion (si needed) |
| Analytics | Q4 2026 | User behavior, clinical insights |
| Telehealth | Q1 2027 | Vet consultations via video |

---

## 14. Referencias & Documentos Relacionados

- **CLAUDE.md** — Rules para Claude agents (deploy protection)
- **NAVIGATION_MAP.md** — App routing structure
- **AGENTS.md** — AI agent instructions
- **PESSY_AUDIT_TECHNICAL_DETAILS.md** — Detailed technical audit
- **PESSY_CONEXION_AUDIT.md** — Clinical connection flows
- **PESSY_REGLA_DORADA.md** — Product build rule (close the loop)

---

## 15. Glossario

| Término | Significado |
|---------|------------|
| **PWA** | Progressive Web App (installable web app) |
| **SPA** | Single Page Application (React Router handles routing) |
| **Firestore** | NoSQL document database |
| **Cloud Functions** | Serverless functions (Node.js) |
| **CoTutor** | Co-owner de mascota (acceso compartido) |
| **Medical Event** | Registro clínico (vaccine, symptom, exam, etc.) |
| **Episode** | Temporal clustering de eventos (e.g., "gastroenteritis episode") |
| **Clinical Alert** | Alerta automática (vaccine due, med low, etc.) |
| **Vertex AI** | Google's AI platform (Gemini models) |
| **Capacitor** | Bridge entre web code y native APIs |

---

**Documento actualizado:** 5 de abril de 2026  
**Autor:** Architecture Documentation (SCRUM-82)  
**Próxima revisión:** Q3 2026
