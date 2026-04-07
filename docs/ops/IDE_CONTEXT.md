# Pessy App — Contexto para IDE

## Proyecto
App híbrida (React + Vite + Capacitor) para gestión integral de mascotas.
Firebase Hosting + Cloud Functions (Node 22) + Firestore.
GCP project: `polar-scene-488615-i0` | Dominio: pessy.app

## GUARDRAILS — Archivos protegidos (NO TOCAR sin instrucción explícita)

### Login (ver `src/app/components/LOGIN_PROTECTED.md`)
- `src/app/components/LoginScreen.tsx`
- `src/app/contexts/AuthContext.tsx`
- `src/app/components/AuthPageShell.tsx`
- `src/app/utils/authActionLinks.ts`
- Rutas de login en `src/app/routes.tsx` (`/login`, `/welcome`, `/onboarding`)

**Regla**: Si la tarea NO menciona explícitamente "login" o "autenticación", NO tocar estos archivos.
Si detectás un bug de seguridad en auth, REPORTAR al usuario, no arreglar solo.

---

## Estado actual (23 marzo 2026)

### Completado
- Sidebar dark slide-out (Figma) → `src/app/components/Sidebar.tsx`
- Discovery Feed (3 cards diarias rotativas: PLACE, ACTIVITY, GAMIFICATION) → `PetHomeView.tsx`
- Google Places multi-tipo (parks, cafes, pet stores, restaurants) con keyword pet+friendly
- PetPreferencesEditor (4 tabs: personalidad, actividades, miedos, comida) → `PetPreferencesEditor.tsx`
- Supply stock predictor (bag kg × 1000 / daily grams - days since purchase)
- Intelligence engine expandido con 6 módulos nuevos → `src/domain/intelligence/pessyIntelligenceEngine.ts`
- GmailConsentScreen (Apple 5.1.1 / Google Data Safety) conectada a RegisterUserScreen y PrivacySecurityScreen
- deleteAllUserClinicalData Cloud Function (GDPR Art. 17) — borrar datos clínicos sin borrar cuenta
- Pet ownership check en ingestHistory
- Firestore rules actualizadas (clinical_episodes, clinical_profile_snapshots, gmail tmp collections)
- Security headers en firebase.json (HSTS, X-Frame-Options, etc.)
- CORS restringido en accountDeletion.ts (no wildcard)

### PENDIENTE — Prioridad Alta

#### 1. Wiring Intelligence Engine → PetHomeView (MAYOR IMPACTO)
**Archivo**: `src/app/components/PetHomeView.tsx`
**Qué falta**: El motor `runPessyIntelligence()` acepta inputs expandidos pero PetHomeView no los pasa:
```typescript
// Estos campos se deben pasar al engine:
isRaining?: boolean        // del weather data que ya se obtiene
isStormy?: boolean         // del weather data
windSpeedKmh?: number      // del weather data
uvIndex?: number           // del weather data
currentHour?: number       // new Date().getHours()
fears?: string[]           // de pet.preferences?.fears
personality?: string[]     // de pet.preferences?.personality
favoriteActivities?: string[] // de pet.preferences?.favoriteActivities
walkTimes?: string[]       // de pet.preferences?.walkTimes
foodDaysLeft?: number      // del cálculo de supply forecast que ya existe
```
**Después**: Renderizar las recommendation cards que el engine devuelve como cards interactivas en Home.

#### 2. Recommendation Cards UI
**Archivo**: `src/app/components/PetHomeView.tsx`
**Qué falta**: `runPessyIntelligence()` retorna un array de `PessyAlert[]` con tipos BLOCK/ALERT/RECOMMENDATION. Hay que mostrarlas como cards con colores según severidad (rojo=BLOCK, amarillo=ALERT, verde=RECOMMENDATION).

#### 3. Página de Política de Privacidad
**Qué falta**: Apple 5.1.1 requiere página accesible en `pessy.app/privacidad`. El link existe en PrivacySecurityScreen pero la página no existe. Crear como ruta en la app o como página estática en `public/privacidad/index.html`.

#### 4. Training Master Book
**Definido en doc de producto pero NO implementado**. Similar a WELLBEING_MASTER_BOOK:
- Reglas de entrenamiento por raza/grupo
- Duraciones de sesión según edad
- Solo refuerzo positivo
- Protocolos de ansiedad por separación

### PENDIENTE — Prioridad Media (Seguridad)

#### 5. Rate limiting per-user en AI operations
**Archivo**: `functions/src/gmail/ingestion/clinicalAi.ts`
**Issue**: `consumeGlobalAiQuota` es global, no per-user. Un usuario puede agotar la cuota de todos.
**Fix**: Agregar counter per-user en Firestore antes del global.

#### 6. Sanitizar pet names en Gmail search query
**Archivo**: `functions/src/gmail/ingestion/sessionQueue.ts`
**Issue**: `buildGmailSearchQuery` incluye pet name sin escapar. Un nombre como `Fluffy OR sender:x@evil.com` podría manipular la búsqueda.
**Fix**: Escapar caracteres especiales de Gmail query (OR, AND, from:, to:, subject:, {, }, (, )).

#### 7. Protección SSRF en clinical email link fetching
**Archivo**: `functions/src/gmail/clinicalIngestion.ts`
**Issue**: `shouldTryExternalLinks` puede hacer requests a IPs privadas si un email malicioso incluye links internos.
**Fix**: Validar que URLs resuelvan a IPs públicas antes de fetch.

#### 8. Audit logging para datos clínicos
**Qué falta**: No hay trazabilidad de quién accedió/modificó datos clínicos. Crear colección `audit_logs` con: userId, action, resource, timestamp, IP.

### PENDIENTE — Prioridad Baja

#### 9. Gmail ingestion pipeline end-to-end testing
El flow OAuth → consent → email detection → AI parsing → episode compilation está armado pero no testeado end-to-end.

#### 10. Timezone hardcodeado
**Archivo**: `functions/src/appointments/index.ts` (línea 24)
Hardcoded a `America/Argentina/Buenos_Aires`. Leer del perfil de usuario.

## Arquitectura clave

```
src/
  app/
    components/
      PetHomeView.tsx          ← Home principal, 3 pilares, weather, discovery
      Sidebar.tsx              ← Nav lateral dark
      PetPreferencesEditor.tsx ← Gustos, miedos, comida, personalidad
      GmailConsentScreen.tsx   ← Consent tiered (Apple/Google compliant)
      PrivacySecurityScreen.tsx ← Settings con borrado clínico GDPR
      HomeScreen.tsx           ← Shell con sidebar + viewMode routing
    contexts/
      PetContext.tsx            ← Pet + PetPreferences interfaces
    services/
      gmailSyncService.ts      ← OAuth flow, status subscription
      accountDeletionService.ts ← deleteUserAccount + deleteAllUserClinicalData
  domain/
    intelligence/
      pessyIntelligenceEngine.ts ← Motor proactivo (weather, breed, food, training)
    masterBooks/
      wellbeingMasterBook.ts     ← Reglas de bienestar por raza
      trainingMasterBook.ts      ← (POR CREAR)

functions/src/
  compliance/accountDeletion.ts  ← Account + clinical data deletion
  gmail/
    oauth.ts                     ← Gmail OAuth flow
    clinicalIngestion.ts         ← Pipeline principal de ingesta
    ingestion/
      clinicalAi.ts              ← Gemini 2.5 Flash processing
      sessionQueue.ts            ← Gmail search + queue
      jobProcessing.ts           ← Decrypt + process attachments
  clinical/
    ingestHistory.ts             ← Upload historial (con ownership check)
    brainResolver.ts             ← Pet matching para clinical data
    episodeCompiler.ts           ← Compilador de episodios clínicos
```

## Comandos

```bash
# Build frontend
npm run build

# Deploy todo
firebase deploy --only hosting,firestore

# Deploy functions
cd functions && npm run build && firebase deploy --only functions

# TypeScript check functions
cd functions && npx tsc --noEmit
```
