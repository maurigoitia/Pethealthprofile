# PLAN DE QA Y TESTING - PESSY (2026)

**Documento:** Plan de Calidad y Testing Integral  
**Fecha:** Marzo 2026  
**Versión:** 1.0  
**Equipo:** QA & Testing

---

## TABLA DE CONTENIDOS
1. [Estado Actual de Testing](#1-estado-actual-de-testing)
2. [Plan de Testing por Capas](#2-plan-de-testing-por-capas)
3. [Security Audit](#3-security-audit)
4. [Checklist Pre-Launch](#4-checklist-pre-launch)
5. [Estimación de Esfuerzo](#5-estimación-de-esfuerzo)

---

## 1. ESTADO ACTUAL DE TESTING

### 1.1 Resumen de Testing Existente

| Aspecto | Estado | Detalle |
|---------|--------|---------|
| **Unit Tests** | 🟡 Mínimo | 1 archivo de test encontrado (PrivacySecurityScreen.test.tsx) |
| **Integration Tests** | 🔴 Ninguno | No hay tests de flujos críticos |
| **E2E Tests** | 🔴 Ninguno | Playwright está instalado pero sin tests |
| **Linting** | 🔴 No configurado | No hay .eslintrc o eslint.config |
| **Prettier** | 🔴 No configurado | No hay prettier config |
| **CI/CD** | 🔴 No configurado | No hay workflows en .github/workflows |
| **Testing Framework** | 🟢 Vitest 4.1.1 | Configurado en package.json |
| **Test Utils** | 🟢 Testing Library | @testing-library/react, @testing-library/dom, user-event instalados |
| **Coverage Reports** | 🔴 Ninguno | No hay configuración de cobertura |

### 1.2 Cobertura Estimada: **~2-5%**

**Justificación:**
- ✅ 1 test file (PrivacySecurityScreen) = ~280 líneas de test code
- ❌ +60 componentes sin tests
- ❌ 6 services sin tests unitarios
- ❌ 10+ utils/hooks sin tests
- ❌ 0 integration tests
- ❌ 0 E2E tests

### 1.3 Nota de Calidad Actual: **3/10**

**Análisis:**
- ✅ Arquitectura limpia (React 18 + TypeScript + Vite)
- ✅ Error boundary implementado (AppErrorBoundary)
- ✅ Try/catch en services y componentes
- ✅ Firestore + Storage rules bien estructuradas
- ⚠️ Vitest configurado pero sin cobertura
- ❌ **Cero tests en la mayoría de flujos críticos**
- ❌ **Sin linting/formatting rules**
- ❌ **Sin CI/CD para validar cambios**
- ❌ **Vulnerabilidad media en dompurify 3.1.3 sin parchear**
- ❌ **Sin monitoring/logging en producción**

---

## 2. PLAN DE TESTING POR CAPAS

### 2.1 UNIT TESTS

#### Objetivo
Validar lógica aislada de funciones, componentes simples y utilities.

#### Framework: **Vitest 4.1.1** (ya instalado)

#### Prioridad: CRÍTICA - Comenzar semana 1

| Categoría | Módulos | Estimación | Prioridad |
|-----------|---------|-----------|-----------|
| **Utils** | `dateUtils`, `medicalRulesEngine`, `deduplication`, `clinicalBrain` | 16h | P0 |
| **Hooks** | `useStorageQuota`, custom hooks en contextos | 8h | P1 |
| **Services** | `analysisService`, `notificationService`, auth logic | 20h | P0 |
| **Components (simple)** | `Logo`, `MaterialIcon`, `EmptyState`, `ImageWithFallback` | 12h | P2 |
| **Components (business)** | `PetProfileModal`, `AddReminderModal`, `VaccinationCardModal` | 24h | P1 |
| **Contexts** | Auth, Pet, Medical, Notification context logic | 16h | P0 |

**Total Unit Tests: 96 horas**

#### Pasos para implementar:

```bash
# 1. Crear estructura de carpetas de tests
src/
  app/
    utils/
      __tests__/
        dateUtils.test.ts
        medicalRulesEngine.test.ts
        clinicalBrain.test.ts
    services/
      __tests__/
        analysisService.test.ts
        notificationService.test.ts

# 2. Agregar vitest.config.ts si no existe
# 3. Configurar jsdom para emular DOM
# 4. Agregar script en package.json (ya existe):
#    "test": "vitest run"
#    "test:watch": "vitest"

# 5. Ejecutar:
npm run test:watch
```

#### Ejemplo de estructura test:

```typescript
// src/app/utils/__tests__/dateUtils.test.ts
import { describe, it, expect } from 'vitest'
import { toDateKeySafe, toTimestampSafe } from '../dateUtils'

describe('dateUtils', () => {
  describe('toDateKeySafe', () => {
    it('should convert valid date to YYYY-MM-DD', () => {
      const result = toDateKeySafe(new Date('2026-03-15'))
      expect(result).toBe('2026-03-15')
    })

    it('should handle null gracefully', () => {
      const result = toDateKeySafe(null)
      expect(result).toBeNull()
    })
  })
})
```

#### Checklist Configuración:
- [ ] Crear `vitest.config.ts` con jsdom environment
- [ ] Crear archivo setup `src/test/setup.ts` (ya existe, revisar)
- [ ] Agregar `@testing-library/vitest` si es necesario
- [ ] Configurar coverage thresholds (objetivo: 70%)
- [ ] Crear GitHub Actions para ejecutar tests en CI

---

### 2.2 INTEGRATION TESTS

#### Objetivo
Validar flujos entre múltiples capas (componentes → servicios → Firebase).

#### Framework: **Vitest + Testing Library**

#### Flujos Críticos a Testear

| Flujo | Modules | Estimación | Prioridad |
|-------|---------|-----------|-----------|
| **Login Flow** | AuthContext, LoginScreen, Firebase Auth | 12h | P0 |
| **Pet Registration** | RegisterPetStep1/2, PetContext, Firestore | 12h | P0 |
| **Document Scan & Analysis** | DocumentScannerModal, analysisService, Gemini | 16h | P0 |
| **Medical Event Creation** | AddAppointmentModal, medicalService, Firestore | 10h | P1 |
| **Co-Tutor Invite** | InviteFriendsModal, invitations logic | 8h | P1 |
| **Report Generation** | HealthReportModal, ExportReportModal, PDF generation | 10h | P1 |
| **Notification Management** | NotificationsScreen, reminders, FCM | 8h | P2 |

**Total Integration Tests: 76 horas**

#### Estrategia:
1. Mock Firebase Auth y Firestore con `vi.mock()`
2. Mock Gemini API (analysisService)
3. Usar `@testing-library/react` para interactiones de usuario
4. Validar estado en contextos después de acciones

#### Ejemplo:

```typescript
// src/app/components/__tests__/LoginScreen.integration.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LoginScreen } from '../LoginScreen'

vi.mock('../../../lib/firebase', () => ({
  auth: {},
  db: {},
}))

vi.mock('firebase/auth', () => ({
  signInWithEmailAndPassword: vi.fn().mockResolvedValue({
    user: { uid: 'test-uid', email: 'test@test.com' }
  }),
}))

describe('LoginScreen Integration', () => {
  it('should login user and navigate to home', async () => {
    render(<LoginScreen />)
    
    const emailInput = screen.getByPlaceholderText(/email/i)
    const passwordInput = screen.getByPlaceholderText(/password/i)
    const submitBtn = screen.getByRole('button', { name: /ingresar/i })
    
    await userEvent.type(emailInput, 'test@test.com')
    await userEvent.type(passwordInput, 'password123')
    await userEvent.click(submitBtn)
    
    await waitFor(() => {
      expect(screen.queryByText(/cargando/i)).not.toBeInTheDocument()
    })
  })
})
```

---

### 2.3 END-TO-END (E2E) TESTS

#### Objetivo
Validar flujos completos en navegador real. Smoke tests de happy paths.

#### Framework: **Playwright 1.58.2** (ya instalado)

#### Prioritarios - Fase 1

| Escenario | Descripción | Prioridad |
|-----------|-------------|-----------|
| **Smoke: Login → Home** | User login y carga de home page | P0 |
| **Smoke: Register Pet** | Crear mascota nueva | P0 |
| **Smoke: Scan Document** | Subir y escanear documento (mock Gemini) | P0 |
| **Smoke: View Medical Events** | Navegar a eventos médicos | P1 |
| **Smoke: Mobile Responsive** | Validar en viewport móvil (375x667) | P1 |
| **Security: HTTPS/Headers** | Validar headers de seguridad | P1 |

**Total E2E Tests: 32 horas**

#### Setup Playwright:

```bash
# playwright.config.ts (crear si no existe)
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'npm run dev',
    port: 5173,
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
  ],
})
```

#### Estructura de tests:

```
e2e/
  smoke/
    login.spec.ts
    register-pet.spec.ts
    scan-document.spec.ts
  security/
    headers.spec.ts
    https.spec.ts
  mobile/
    responsive.spec.ts
```

#### Ejemplo test:

```typescript
// e2e/smoke/login.spec.ts
import { test, expect } from '@playwright/test'

test.describe('Smoke: Login Flow', () => {
  test('should login and redirect to home', async ({ page }) => {
    await page.goto('/')
    
    // Fill login form
    await page.fill('input[type="email"]', 'test@test.com')
    await page.fill('input[type="password"]', 'password123')
    await page.click('button:has-text("Ingresar")')
    
    // Wait for navigation
    await page.waitForURL('/home')
    
    // Verify home loaded
    await expect(page.locator('text=Mi Mascota')).toBeVisible()
  })
})
```

#### Comandos:

```bash
# Instalar browsers
npx playwright install

# Ejecutar todos los tests
npx playwright test

# Ejecutar smoke tests solo
npx playwright test e2e/smoke

# Modo debug
npx playwright test --debug

# Ver report HTML
npx playwright show-report
```

---

### 2.4 MOBILE TESTING (Capacitor)

#### Objetivo
Validar en iOS Simulator y Android Emulator.

#### Framework: **Capacitor 7 + Vitest/Playwright**

#### Estrategia:

| Plataforma | Cómo Testear | Prioridad |
|------------|-------------|-----------|
| **iOS Simulator** | Xcode simulator + Playwright mobile config | P0 |
| **Android Emulator** | Android Studio emulator + Playwright | P0 |
| **Camera/Photo** | Mock con Vitest, prueba manual en real device | P1 |
| **Notificaciones** | FCM con Firebase emulator | P1 |
| **Almacenamiento** | Mock Firebase Storage en tests | P1 |

#### Setup:

```bash
# Build para móvil
npm run build:mobile

# Abrir en simulador
npm run cap:open:ios
npm run cap:open:android

# Validar capacitor
npm run mobile:doctor
```

#### Tests Específicos Móvil:

```typescript
// src/app/services/__tests__/petPhotoService.mobile.test.ts
import { describe, it, expect, vi } from 'vitest'
import { uploadPetPhoto } from '../petPhotoService'

vi.mock('@capacitor/camera', () => ({
  Camera: {
    getPhoto: vi.fn(),
  },
}))

describe('Mobile: Pet Photo Upload', () => {
  it('should handle HEIC conversion on iOS', async () => {
    // Mock iOS photo
    // Validar heic2any conversion
    // Verificar upload a Storage
  })
})
```

---

### 2.5 PERFORMANCE TESTING

#### Objetivo
Validar Core Web Vitals y carga de recursos.

#### Herramientas: **Lighthouse + WebPageTest**

#### Targets (según Google recommendations):

| Métrica | Target | Prioridad |
|---------|--------|-----------|
| **LCP (Largest Contentful Paint)** | < 2.5s | P0 |
| **FID (First Input Delay)** | < 100ms | P0 |
| **CLS (Cumulative Layout Shift)** | < 0.1 | P0 |
| **First Paint** | < 1.5s | P1 |
| **Time to Interactive** | < 3.5s | P1 |
| **Bundle Size** | < 500KB gzipped | P1 |

#### Medición Automática:

```bash
# Lighthouse CI config (create .github/lighthouse-ci.json)
{
  "ci": {
    "collect": {
      "url": ["http://localhost:5173"],
      "numberOfRuns": 3,
      "settings": {
        "configPath": "./lighthouse-config.js"
      }
    },
    "upload": {
      "target": "temporary-public-storage"
    },
    "assert": {
      "preset": "lighthouse:recommended",
      "assertions": {
        "categories:performance": ["error", { "minScore": 0.8 }],
        "categories:accessibility": ["error", { "minScore": 0.9 }]
      }
    }
  }
}
```

#### Script en package.json:
```json
{
  "scripts": {
    "test:performance": "lighthouse http://localhost:5173 --output=json --output-path=./lighthouse-report.json"
  }
}
```

---

## 3. SECURITY AUDIT

### 3.1 Evaluación de Firestore Rules

#### Estado: 🟢 **BUENO** (90/100)

**Puntos fuertes:**
- ✅ Validación exhaustiva de `canAccessPetById()` y `canJoinPetWithInvite()`
- ✅ Rules correctamente estructuradas por colección
- ✅ Admin check (`isAdmin()`) limitado a email específico
- ✅ Invitaciones con expiración y validación de email
- ✅ Co-tutores con permisos granulares
- ✅ Datos médicos protegidos con acceso basado en mascota

**Vulnerabilidades/Mejoras:**

| Issue | Severidad | Recomendación |
|-------|-----------|---------------|
| Admin hardcoded por email | Media | Usar claims en token JWT en lugar de email |
| No rate limiting en create | Media | Implementar rate limiting para invitaciones |
| access_requests sin validación de duplicados | Baja | Agregar unique constraint en DB o función |
| No versionado de rules | Baja | Agregar comentario de versión y changelog |

**Acciones:**
```firestore
// Mejorar admin validation
function isAdmin() {
  return signedIn() && request.auth.token.admin == true;
  // Requiere setup en Cloud Functions para settear custom claims
}

// Agregar rate limiting (requiere Cloud Function trigger)
// Considerar usar Cloud Firestore Extension para Rate Limiting
```

### 3.2 Evaluación de Storage Rules

#### Estado: 🟡 **ACEPTABLE** (75/100)

**Puntos fuertes:**
- ✅ Autenticación requerida (`isOwner()`)
- ✅ Validación de tamaño (max 30MB)
- ✅ Acceso limitado a carpetas propias

**Vulnerabilidades/Mejoras:**

| Issue | Severidad | Recomendación |
|-------|-----------|---------------|
| Sin validación MIME type | Media | Agregar validación de tipo de archivo |
| Sin validación de extensión | Media | Whitelist de extensiones permitidas |
| Users/{userId} muy permisivo | Media | Especificar tipos (solo .jpg, .png, .pdf) |
| Sin metadata encryption | Media | Encriptar datos sensibles en Storage |

**Rules mejoradas:**

```firestore
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    function isOwner(userId) {
      return request.auth != null && request.auth.uid == userId;
    }

    function validWriteSize() {
      return request.resource == null || request.resource.size < 30 * 1024 * 1024;
    }

    function validMimeType() {
      return request.resource.contentType in [
        'image/jpeg',
        'image/png',
        'image/webp',
        'application/pdf'
      ];
    }

    // Perfil de usuario y assets de mascotas por usuario
    match /users/{userId}/{allPaths=**} {
      allow read, write: if isOwner(userId) 
        && validWriteSize() 
        && validMimeType();
    }

    // Documentos médicos subidos por el tutor
    match /documents/{userId}/{allPaths=**} {
      allow read, write: if isOwner(userId) 
        && validWriteSize() 
        && validMimeType()
        && request.resource.contentType == 'application/pdf';
    }
  }
}
```

### 3.3 Authentication & Authorization

#### Estado: 🟡 **ACEPTABLE** (80/100)

**Análisis:**

| Componente | Estado | Detalle |
|-----------|--------|---------|
| Firebase Auth | ✅ Bien | Email/password + custom claims ready |
| JWT/Claims | ✅ Bien | Setup para custom claims en Cloud Functions |
| Session Management | 🟡 Revisar | Validar timeout de sesiones |
| Password Reset | ✅ Bien | Implementado con reauthenticate + updatePassword |
| 2FA | ❌ NO | No implementado; recomendado agregar |
| SSO/OAuth | 🟡 Parcial | Google/Apple auth posible pero no verificado |

**Recomendaciones:**

1. Implementar 2FA para cuentas con datos médicos:
```typescript
// Cloud Function para generar TOTP
import speakeasy from 'speakeasy'

export const generateTOTP = functions.https.onCall((data, context) => {
  if (!context.auth) throw new Error('Unauthenticated')
  
  const secret = speakeasy.generateSecret({
    name: 'Pessy (' + context.auth.token.email + ')',
    issuer: 'Pessy'
  })
  
  return {
    secret: secret.base32,
    qrCode: secret.otpauth_url
  }
})
```

2. Implementar refresh token rotation
3. Agregar login attempt rate limiting (máx 5 intentos/15 min)
4. Validar email verification antes de acceso a datos médicos

### 3.4 Manejo de Datos Sensibles

#### Estado: 🟡 **PARCIAL** (70/100)

**Datos Sensibles Identificados:**
- ✅ Datos de mascotas (vacunas, diagnósticos, medicamentos)
- ✅ Contacto veterinario
- ✅ Emails de co-tutores
- ✅ Fotos de mascotas
- ✅ Documentos escaneados (recetas, radiografías)

**Protecciones Actuales:**
- ✅ Firestore rules basadas en usuario/cotutor
- ✅ Storage encriptado en tránsito
- ✅ HTTPS enforced

**Mejoras Recomendadas:**

| Mejora | Prioridad | Esfuerzo |
|--------|-----------|---------|
| Encriptación end-to-end de documentos médicos | P0 | 20h |
| Auditoría de acceso (logging de lecturas) | P1 | 12h |
| Redacción automática de datos sensibles en reportes públicos | P0 | 16h |
| Tokenización de datos médicos | P2 | 24h |
| GDPR compliance (right to be forgotten) | P0 | 16h |

### 3.5 CORS & Security Headers

#### Estado: 🔴 **NO CONFIGURADO** (0/100)

**Problema:**
No hay Cloud Functions configuradas para devolver headers de seguridad.

**Recomendación - Agregar headers en Cloud Function:**

```typescript
// functions/src/index.ts
import * as functions from 'firebase-functions/v2/https'

export const secureApi = functions.https.onRequest((req, res) => {
  // Security headers
  res.set('X-Content-Type-Options', 'nosniff')
  res.set('X-Frame-Options', 'DENY')
  res.set('X-XSS-Protection', '1; mode=block')
  res.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload')
  res.set('Content-Security-Policy', 
    "default-src 'self'; script-src 'self' 'unsafe-inline' https://apis.google.com; img-src 'self' https: data:; style-src 'self' 'unsafe-inline'"
  )
  res.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.set('Permissions-Policy', 'geolocation=(), microphone=(), camera=()')
  
  // CORS
  res.set('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || 'https://pessy.app')
  res.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE')
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  
  res.json({ status: 'ok' })
})
```

**O usar firebase.json:**
```json
{
  "hosting": {
    "headers": [
      {
        "source": "**",
        "headers": [
          {
            "key": "X-Content-Type-Options",
            "value": "nosniff"
          },
          {
            "key": "X-Frame-Options",
            "value": "DENY"
          },
          {
            "key": "Strict-Transport-Security",
            "value": "max-age=31536000; includeSubDomains; preload"
          }
        ]
      }
    ]
  }
}
```

### 3.6 Vulnerabilidades de Dependencias

#### Estado: 🟡 **1 Vulnerabilidad Media**

```
npm audit result:
─────────────────
dompurify 3.1.3 - 3.3.1 (MODERATE)
├─ Vulnerability: Cross-site Scripting (XSS)
├─ Link: https://github.com/advisories/GHSA-v2wj-7wpq-c8vv
├─ Fix: Upgrade to dompurify >= 3.4.0
└─ Affected modules: [any module using dompurify]
```

**Acción Inmediata:**
```bash
# Fix vulnerable package
npm audit fix

# O manual
npm install dompurify@^3.4.0

# Verificar
npm audit
```

**Plan de Dependencias:**
```bash
# Script para ejecutar regularmente (agregar a CI)
npm audit --production

# Actualizar dependencias con seguridad
npm update --depth=3
```

### 3.7 GDPR & Privacy Compliance

#### Estado: 🟡 **PARCIAL**

**Implementado:**
- ✅ Terms of Service (public/data-deletion.html)
- ✅ Privacy Policy (docs/DEVOPS_DATA_PRIVACIDAD_SEGURIDAD.md)
- ✅ Account deletion endpoint (accountDeletionService.ts)

**Pendiente:**
- ❌ Right to data portability
- ❌ Data retention policy (automático delete después de X tiempo)
- ❌ Consent management (cookie banner)
- ❌ Data Processing Agreement (DPA)
- ❌ Audit trail de accesos

**Recomendación:**
```typescript
// Cloud Function para GDPR compliance
export const deleteUserData = functions.auth.user().onDelete(async (user) => {
  // 1. Soft delete en users collection
  // 2. Anonymize medical data (no delete, preservar historial)
  // 3. Delete personal documents
  // 4. Remove from invitations
  // 5. Log deletion en audit trail
  // 6. Notify user via email
})

export const exportUserData = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new Error('Unauthenticated')
  
  // Export user data as JSON
  // Include: profile, pets, medical events, documents
  // Return signed download URL
})
```

---

## 4. CHECKLIST PRE-LAUNCH

### 4.1 BUGS CRÍTICOS A PREVENIR

| Bug | Severidad | Verificación |
|-----|-----------|--------------|
| Login no autentica (auth context no se sincroniza) | CRÍTICA | Unit test + integration test de AuthContext |
| Datos de mascota no se cargan (Firestore rules) | CRÍTICA | Integration test de PetContext |
| Documentos no se analizan (Gemini API fallida) | CRÍTICA | Mock Gemini, test de error handling |
| Fotos no se suben (Storage rules) | CRÍTICA | Integration test de petPhotoService |
| Password reset no funciona | CRÍTICA | Unit test de PrivacySecurityScreen (ya existe) |
| Invitaciones de co-tutores fallan | CRÍTICA | Integration test de invitation flow |
| Reportes no se exportan (PDF generation) | ALTA | Test de HealthReportModal |
| Notificaciones no se reciben (FCM) | ALTA | Integration test de notificationService |
| UI no responde en móvil | ALTA | Playwright mobile tests |
| XSS en reportes públicos | CRÍTICA | Security test de report generation |

### 4.2 TESTS MÍNIMOS ANTES DE PRODUCCIÓN

#### Tier 1: Obligatorio (Semana 1)
- [ ] AuthContext: login, logout, session persistence
- [ ] PetContext: crear, leer, actualizar mascota
- [ ] DocumentScannerModal: upload, mock analysis, error handling
- [ ] LoginScreen: formulario, validaciones, error messages
- [ ] Firestore rules: pruebas manuales de permisos

**Tiempo:** 48 horas

#### Tier 2: Muy Recomendado (Semana 1-2)
- [ ] analysisService: mock Gemini API, test de datos extraídos
- [ ] petPhotoService: upload a Storage, validación de MIME
- [ ] HealthReportModal: generación PDF, descarga
- [ ] CoTutorModal: invitación, verificación de email
- [ ] E2E smoke: login → home → ver mascota

**Tiempo:** 36 horas

#### Tier 3: Recomendado (Semana 2-3)
- [ ] Unit tests de utils (dateUtils, medicalRulesEngine)
- [ ] Integration tests de appointment/medication flows
- [ ] Mobile responsive tests (Playwright)
- [ ] Performance baseline (Lighthouse)
- [ ] Security headers (CORS, CSP)

**Tiempo:** 40 horas

### 4.3 MONITORING MÍNIMO REQUERIDO

#### En Producción:
- [ ] **Error Tracking:** Sentry o Firebase Crashlytics
  ```typescript
  import * as Sentry from "@sentry/react"
  
  Sentry.init({
    dsn: process.env.VITE_SENTRY_DSN,
    environment: process.env.NODE_ENV,
    tracesSampleRate: 0.1,
  })
  ```

- [ ] **Analytics:** Google Analytics + Firebase Analytics
  ```typescript
  import { logEvent } from 'firebase/analytics'
  
  logEvent(analytics, 'pet_created', { petName: 'Fluffy' })
  ```

- [ ] **Performance:** Web Vitals
  ```typescript
  import { getCLS, getFID, getFCP, getLCP, getTTFB } from 'web-vitals'
  
  getCLS(console.log)
  getFID(console.log)
  // ... etc
  ```

- [ ] **Logging:** Cloud Logging
  ```typescript
  import { info, error } from '@google-cloud/logging'
  
  error('Critical error in analysisService', { error, userId })
  ```

#### Dashboards Recomendados:
1. **Firebase Console:** Auth, Firestore, Storage metrics
2. **Sentry Dashboard:** Error rate, crash tracking
3. **Google Analytics:** User funnel, event tracking
4. **Google Cloud Logging:** Server-side errors

---

## 5. ESTIMACIÓN DE ESFUERZO

### 5.1 Resumen de Horas por Categoría

| Categoría | Horas | % del Total | Timeline |
|-----------|-------|-----------|----------|
| **Unit Tests** | 96 | 30% | Semanas 1-2 |
| **Integration Tests** | 76 | 24% | Semanas 2-3 |
| **E2E Tests** | 32 | 10% | Semana 3-4 |
| **Mobile Testing** | 24 | 8% | Semana 4 |
| **Performance** | 16 | 5% | Semana 4 |
| **Security Hardening** | 48 | 15% | Semanas 2-4 |
| **CI/CD Setup** | 24 | 8% | Semana 1 |
| **Documentation** | 16 | 5% | Ongoing |
| **Bugfixes from testing** | 32 | Resumen | Semanas 1-4 |
| **TOTAL** | **364** | **100%** | **4 semanas** |

### 5.2 Timeline Sugerido (Acelerado - 2 Weeks)

Si el objetivo es ir a producción rápidamente:

**Semana 1:**
- Lunes-Miércoles (24h):
  - Unit tests tier 1: AuthContext, PetContext, LoginScreen
  - Integration test: login → home flow
- Jueves-Viernes (16h):
  - E2E smoke tests: login, create pet
  - Security: fix dompurify, agregar headers
  
**Total Semana 1: 40 horas**

**Semana 2:**
- Lunes-Miércoles (24h):
  - Integration: document scan, analysis
  - Unit tests: services críticos
  - Mobile responsive tests
- Jueves-Viernes (16h):
  - CI/CD setup (GitHub Actions)
  - Monitoring setup (Sentry/Analytics)
  - Bugfixes from tests

**Total Semana 2: 40 horas**

**Go-Live:** Final de Semana 2

**Post-Launch (Continuo):**
- Semana 3-4: Performance optimization, additional E2E tests, stress testing

### 5.3 Qué se puede Automatizar vs Manual

| Tipo | Automático | Manual | Detalle |
|------|-----------|--------|---------|
| **Unit Tests** | ✅ 100% | - | CI/CD en cada commit |
| **Integration Tests** | ✅ 90% | ⚠️ 10% Firebase emulator setup | Ejecutar en CI pipeline |
| **E2E Smoke** | ✅ 90% | ⚠️ 10% Debug de timeouts | Nightly runs |
| **Mobile Device** | ⚠️ 30% | ✅ 70% | Simulador automático; real device manual |
| **Security Scan** | ✅ 100% | - | npm audit en CI; OWASP ZAP periodic |
| **Performance** | ✅ 90% | ⚠️ 10% Baseline setup | Lighthouse CI |
| **Load Testing** | ✅ 80% | ⚠️ 20% Análisis resultados | k6 o JMeter scripts |
| **Accessibility** | ✅ 70% | ⚠️ 30% Manual screen reader | axe-core + manual |

### 5.4 Recursos Recomendados

**Personal:**
- 1 QA Engineer Lead (full-time, 4 semanas)
- 1-2 QA Engineers (full-time, 4 semanas)
- 1 DevOps para CI/CD setup (part-time, 8 horas)
- Developers para mocks/fixtures (part-time, 20 horas)

**Herramientas (costo):**
- Sentry: Free tier (o $50/month for increased quota)
- Playwright: Free
- GitHub Actions: Free for public repo (included in GitHub Enterprise)
- Firebase: Included (pay per use)
- BrowserStack: $99/month (opcional, para iOS real device)

---

## 6. CI/CD PIPELINE RECOMENDADO

### 6.1 GitHub Actions Workflow

**Crear `.github/workflows/test-and-deploy.yml`:**

```yaml
name: Test & Deploy

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v4
      
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run linter
        run: npm run lint
      
      - name: Run unit tests
        run: npm run test
      
      - name: Run integration tests
        run: npm run test:integration
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/coverage-final.json
      
      - name: Build
        run: npm run build
      
      - name: Run E2E tests
        run: npx playwright test
      
      - name: Security audit
        run: npm audit --production
      
      - name: Upload Playwright report
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-report
          path: playwright-report/

  deploy:
    needs: test
    runs-on: ubuntu-latest
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    
    steps:
      - uses: actions/checkout@v4
      
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Build
        run: npm run build
      
      - name: Deploy to Firebase
        uses: FirebaseExtended/action-hosting-deploy@v0
        with:
          repoToken: '${{ secrets.GITHUB_TOKEN }}'
          firebaseServiceAccount: '${{ secrets.FIREBASE_SERVICE_ACCOUNT }}'
          projectId: pessy-app
          channelId: live
```

### 6.2 Scripts en package.json

Agregar/actualizar:

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:integration": "vitest run --include '**/*.integration.test.ts'",
    "test:coverage": "vitest run --coverage",
    "lint": "eslint src --ext .ts,.tsx",
    "lint:fix": "eslint src --ext .ts,.tsx --fix",
    "format": "prettier --write 'src/**/*.{ts,tsx,css}'",
    "audit": "npm audit --production",
    "audit:fix": "npm audit fix",
    "e2e": "playwright test",
    "e2e:debug": "playwright test --debug",
    "lighthouse": "lighthouse https://pessy.app --output=json"
  }
}
```

---

## 7. MÉTRICAS DE ÉXITO

### 7.1 Métricas de Calidad

| Métrica | Target | Actual | Status |
|---------|--------|--------|--------|
| Test Coverage (Unit + Integration) | ≥ 70% | ~2% | 🔴 Crítico |
| E2E Coverage (happy paths) | ≥ 5 escenarios | 0 | 🔴 Crítico |
| Bug Escape Rate | < 1 bug crítico/1k líneas | ? | 🟡 A medir |
| Security Audit Score | ≥ 90/100 | 80/100 | 🟡 Mejorable |
| Accessibility Score (WCAG AA) | ≥ 85/100 | No medido | 🔴 No medido |

### 7.2 Métricas de Performance

| Métrica | Target | Actual | Status |
|---------|--------|--------|--------|
| LCP | < 2.5s | No medido | 🔴 No medido |
| FID | < 100ms | No medido | 🔴 No medido |
| CLS | < 0.1 | No medido | 🔴 No medido |
| Bundle Size | < 500KB | No medido | 🔴 No medido |
| Time to Interactive | < 3.5s | No medido | 🔴 No medido |

### 7.3 Métricas de Seguridad

| Métrica | Target | Actual | Status |
|---------|--------|--------|--------|
| Dependencia Vulnerabilities | = 0 | 1 (dompurify) | 🟡 Fixeable |
| Security Headers | 8/8 | 0/8 | 🔴 No implementado |
| Firestore Rules Coverage | 100% | 95% | 🟢 Bien |
| Storage Rules Coverage | 100% | 90% | 🟡 Mejorable |
| GDPR Compliance | 100% | 70% | 🟡 Parcial |

---

## 8. RECOMENDACIONES FINALES

### 8.1 Acciones Inmediatas (Esta Semana)

1. **Instalar/Configurar Linting:**
   ```bash
   npm install --save-dev eslint @typescript-eslint/eslint-plugin @typescript-eslint/parser prettier
   # Crear .eslintrc.json y .prettierrc
   ```

2. **Fix Vulnerabilidad dompurify:**
   ```bash
   npm install dompurify@^3.4.0
   npm audit --production  # Verificar
   ```

3. **Crear estructura de testing:**
   ```bash
   mkdir -p src/app/utils/__tests__
   mkdir -p src/app/services/__tests__
   mkdir -p e2e/smoke
   ```

4. **Escribir primer test unitario de AuthContext (4h)**

5. **Configurar GitHub Actions basic workflow (3h)**

### 8.2 Plan 30 Días

**Semana 1:**
- Tests de AuthContext, PetContext, LoginScreen
- Fix dompurify y otros vulnerabilities
- GitHub Actions CI básico

**Semana 2:**
- Integration tests de flujos críticos (login→home→pet)
- E2E smoke tests con Playwright
- Cloud Function para security headers

**Semana 3:**
- Unit tests de services
- Performance baseline (Lighthouse)
- Mobile testing

**Semana 4:**
- Load testing
- Accessibility audit
- Launch preparation

### 8.3 Deuda Técnica a Considerar

- **Refactoring de contexts:** AuthContext muy grande, considerar split
- **Error handling:** Standarizar pattern de try/catch en services
- **Types:** Agregar strict type checking en tsconfig
- **Logging:** Implementar structured logging (no solo console.error)

---

## APÉNDICE: Comandos Útiles de Testing

```bash
# Tests
npm run test                              # Run once
npm run test:watch                        # Watch mode
npm run test:coverage                     # Coverage report
npm run test:integration                  # Integration only

# Linting
npm run lint                              # Check
npm run lint:fix                          # Auto-fix
npm run format                            # Format with prettier

# E2E
npx playwright install                    # Download browsers
npx playwright test                       # Run all
npx playwright test --grep @smoke         # Only smoke tests
npx playwright test --debug               # Debug mode
npx playwright show-report                # View HTML report

# Mobile
npm run cap:open:ios                      # Open iOS simulator
npm run cap:open:android                  # Open Android emulator
npm run mobile:doctor                     # Check setup

# Security
npm audit                                 # Check vulnerabilities
npm audit fix                             # Auto-fix
npm audit --production                    # Only production deps

# Build & Deploy
npm run build                             # Build for web
npm run build:mobile                      # Build for iOS/Android
firebase deploy --only hosting            # Deploy to Firebase
firebase deploy --only functions          # Deploy Cloud Functions
```

---

**Documento preparado:** 26 de Marzo de 2026  
**Próxima revisión:** Después de Semana 1 de testing  
**Contacto:** Equipo QA & Testing
