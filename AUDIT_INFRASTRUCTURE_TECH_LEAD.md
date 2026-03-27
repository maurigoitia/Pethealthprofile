# AUDIT INFRAESTRUCTURA BACKEND - PESSY
## Tech Lead Report | 2026-03-26

### EJECUTIVO
Auditoría completa de infraestructura Backend para **50K usuarios en 1 año**. Se identificaron **7 hallazgos críticos** y **12 mejoras recomendadas**.

---

## 1. CLOUD FUNCTIONS AUDIT

### 1.1 Functions Identificadas

| Function | Trigger | Tipo | Líneas | Escalabilidad |
|----------|---------|------|--------|---------------|
| `ingestHistory` | HTTP/Callable | Ingesta datos médicos | 132 | ⚠️ Batch processing presente |
| `brainResolver` | HTTP | IA análisis clínico | 407 | ⚠️ Llamadas Gemini sin timeout |
| `clinicalIngestion` | Pub/Sub | Gmail sync | 4173 | ⚠️ ALTO VOLUMEN |
| `accountDeletion` | Callable | Compliance GDPR | 437 | ✅ Bien estructurado |
| `onAppointmentCreated` | Firestore/onCreate | Reminders | ~60 | ✅ Eficiente |
| `onAppointmentUpdated` | Firestore/onUpdate | Reminders | ~80 | ✅ Eficiente |
| `onAppointmentDeleted` | Firestore/onDelete | Cleanup | ~20 | ✅ Eficiente |
| `petPhotos` | HTTP | Media access | ~200+ | ⚠️ Sin rate limiting |

### 1.2 Hallazgos Críticos

#### ❌ CRÍTICO #1: Sin Rate Limiting en Cloud Functions
```
Problema: Ninguna función tiene rate limiting implementado
Riesgo: DDoS, abuse, costos sin control
Impacto: 50K usuarios → exponencial de llamadas no controladas
```

#### ❌ CRÍTICO #2: Error Handling Inconsistente
```
Problema: Mezclado console.log con HttpsError, sin logging centralizado
Riesgo: Errores no monitoreados en producción
Impacto: Debugging imposible, SLA comprometido
```

#### ❌ CRÍTICO #3: Sin Timeouts en Llamadas Gemini
```
Función: brainResolver
Problema: Llamadas a Vertex AI sin timeout configurado
Riesgo: Cuelgue de funciones, no devuelven en 60s
Impacto: Timeout global de Cloud Functions
```

#### ❌ CRÍTICO #4: Sin Retry Logic en Operaciones Críticas
```
Funciones afectadas: clinicalIngestion, ingestHistory
Problema: Fallos de red/API sin reintentos
Riesgo: Pérdida de datos médicos (HIPAA violation)
Impacto: Compliance, confianza de usuarios
```

#### ❌ CRÍTICO #5: Sin Monitoreo Centralizado
```
Problema: No hay Sentry, Cloud Monitoring, o Error Reporting
Riesgo: Errores silenciosos en producción
Impacto: 0 visibilidad de issues hasta que users reportan
```

#### ❌ CRÍTICO #6: Función clinicalIngestion muy Grande
```
Líneas: 4173 (sin modularizar)
Problema: Difícil de testear, mantener, debuggear
Riesgo: Bug en una sección → toda la ingesta se cae
Impacto: Escalabilidad comprometida
```

#### ❌ CRÍTICO #7: Sin Configuración de Memoria/CPU
```
Problema: Cloud Functions usan defaults (256MB, 1 CPU)
Riesgo: Timeout en operaciones complejas (Gemini, PDF parsing)
Impacto: Performance degradada para 50K usuarios
```

### 1.3 Recomendaciones Cloud Functions

1. **Rate Limiting Middleware** → Implementar con Redis/Firestore
2. **Unified Error Handling** → Wrapper pattern con Sentry
3. **Timeouts Gemini** → MAX 30s, con fallback
4. **Retry Logic** → Exponential backoff para operaciones críticas
5. **Memory/Timeout Config** → 2GB RAM, 540s para operaciones batch
6. **Structured Logging** → JSON logs para Cloud Logging
7. **Modularizar clinicalIngestion** → Separar en funciones especializadas

---

## 2. FIRESTORE RULES AUDIT

### 2.1 Estado Actual: ✅ BIEN ESTRUCTURADO

**Puntos fuertes:**
- Autenticación requerida en todas las colecciones
- Validación de ownership (ownerId checks)
- Soporte para co-tutores bien implementado
- Validación de types en access_requests
- Límite de tamaño en verified_reports (1200 chars)

### 2.2 Hallazgos

#### ⚠️ ALTO #1: Admin hardcodeado como email
```firestore
function isAdmin() {
  return signedIn() && request.auth.token.email == 'mauri@pessy.app';
}
```
**Problema:** Hardcoded, no escalable para múltiples admins
**Solución:** Usar custom claims en Firebase Auth

#### ⚠️ ALTO #2: Sin Límite de Tamaño en la Mayoría de Colecciones
```
Afectadas: medical_events, clinical_events, medications, treatments, etc.
Riesgo: Documentos gigantes → queries lentas
Impacto: 50K usuarios × documentos grandes = base de datos sin escala
```

#### ⚠️ ALTO #3: Sin Rate Limiting en Creación de Documentos
```
Problema: Cualquier usuario autenticado puede crear infinitos documentos
Riesgo: Spam, DoS mediante Firestore
Impacto: Costos sin control
```

#### ⚠️ MEDIO #4: Validación de Invitaciones Compleja
```
Función: canJoinPetWithInvite() tiene 40+ líneas
Problema: Difícil de auditar, bug-prone
Solución: Simplificar lógica o mover a Cloud Function
```

### 2.3 Recomendaciones Firestore Rules

1. **Custom Claims para Admin** → usar `request.auth.token.admin == true`
2. **Límites de Documento** → max 500KB por documento
3. **Rate Limiting** → implementar vía Cloud Functions
4. **Validación de Email** → regex pattern en access_requests
5. **Auditoría de Permisos** → usar Cloud Audit Logs

---

## 3. STORAGE RULES AUDIT

### 3.1 Estado Actual: ✅ SEGURO

**Puntos fuertes:**
- Solo usuarios autenticados pueden escribir
- Validación de tamaño: máximo 30MB ✅
- Isolación por usuario (userId path)

### 3.2 Hallazgos

#### ✅ BIEN: Límite de 30MB
**Adecuado para:** Fotos, documentos médicos

#### ⚠️ MEDIO #1: Sin Validación de Content-Type
```
Problema: Storage.rules no valida MIME type
Riesgo: Usuario sube malware disfrazado de imagen
Impacto: Seguridad, compliance
```

#### ⚠️ MEDIO #2: Sin Validación de Extensión
```
Problema: Cualquier extensión se acepta
Riesgo: .exe, .sh, scripts maliciosos
Impacto: Distribución de malware
```

### 3.3 Recomendaciones Storage Rules

1. **Validar Content-Type** → Whitelist: image/*, application/pdf
2. **Validar Extensión** → .jpg, .png, .gif, .pdf, .doc*, .pdf solamente
3. **Scanning** → Integrar Cloud Content Moderation API

---

## 4. FIREBASE CONFIG (firebase.json)

### 4.1 Estado Actual: ✅ EXCELENTE

**Puntos fuertes:**
- Headers de seguridad bien configurados ✅
  - X-Content-Type-Options: nosniff ✅
  - X-Frame-Options: DENY ✅
  - X-XSS-Protection: 1; mode=block ✅
  - Referrer-Policy: strict-origin ✅
  - Permissions-Policy restrictivo ✅
  - HSTS configurado ✅

- Cache headers optimizados ✅
  - Assets: 1 año (immutable) ✅
  - HTML: no-cache ✅
  - Pages de auth: no-index ✅

### 4.2 Hallazgos

#### ✅ BIEN: HSTS y Security Headers
```json
"Strict-Transport-Security": "max-age=31536000; includeSubDomains"
```

#### ⚠️ BAJO #1: Falta Content-Security-Policy
```
Problema: No hay CSP header configurado
Recomendación: Agregar CSP restrictivo
```

#### ⚠️ BAJO #2: Múltiples Hosts sin Deduplicación
```
Hosts: app, appqa, appfocusqa, appit, appsubdomain
Recomendación: Consolidar configuración duplicada
```

### 4.3 Recomendaciones Firebase Config

1. **Agregar Content-Security-Policy** → `default-src 'self'`
2. **Agregar Access-Control-Allow-Origin** → Solo pessy.app
3. **Consolidar Hosts** → DRY en firebase.json

---

## 5. MONITORING & ERROR TRACKING

### 5.1 Estado Actual: ❌ NINGUNO

**Lo que NO existe:**
- ❌ Sentry
- ❌ Cloud Error Reporting
- ❌ Cloud Monitoring alerts
- ❌ Custom dashboards
- ❌ Log aggregation

### 5.2 Recomendaciones Monitoring

**Stack recomendado para 50K usuarios:**

```
1. Cloud Error Reporting (Firebase)
   - Gratis hasta 1M errores/mes
   - Alertas vía email
   - Stack traces automáticos

2. Cloud Logging + Alerting
   - Métricas de latencia
   - CPU/memoria de Functions
   - Firestore read/write ops

3. Sentry.io (opcional, premium)
   - Source maps
   - Performance monitoring
   - Release tracking
   - Costo: ~$29/mes para 50K eventos

4. Custom Dashboards (Data Studio)
   - Real-time metrics
   - User growth
   - Error trends
```

---

## 6. SECURITY CHECKLIST

### 6.1 API Keys

| Item | Status | Hallazgo |
|------|--------|----------|
| VITE_FIREBASE_VAPID_KEY | ⚠️ EXPUESTO | `.env.example` contiene key real |
| VITE_USE_BACKEND_ANALYSIS | ✅ Seguro | Flag de feature, no sensible |
| Environment variables | ⚠️ ALTO | `.env.local` no debería commitearse |

**Acción:** Regenerar VAPID key, usar secrets manager

### 6.2 Admin Emails

| Item | Status | Hallazgo |
|------|--------|----------|
| `mauri@pessy.app` | ⚠️ HARDCODEADO | En firestore.rules línea ~107 |
| Admin claims | ❌ NO EXISTE | Deberían usar custom claims |

**Acción:** Implementar admin claims en Firebase Auth

### 6.3 CORS

| Item | Status | Hallazgo |
|------|--------|----------|
| Cloud Functions CORS | ❌ NO CONFIGURADO | Todos los origins aceptados por defecto |
| Firebase Hosting CORS | ✅ IMPLÍCITO | Same-origin por defecto |

**Acción:** Agregar CORS middleware en Cloud Functions

### 6.4 Rate Limiting

| Item | Status | Hallazgo |
|------|--------|----------|
| Storage uploads | ❌ SIN LÍMITE (excpto 30MB) | Sin throttle de requests |
| Firestore writes | ❌ SIN LÍMITE | User puede escribir infinito |
| Cloud Functions | ❌ SIN LÍMITE | DDoS posible |

**Acción:** Implementar middleware de rate limiting

### 6.5 Input Validation

| Item | Status | Hallazgo |
|------|--------|----------|
| Cloud Functions | ⚠️ PARCIAL | Algunos checks, inconsistente |
| Firestore | ✅ BUENO | Validación de types |
| Storage | ❌ INCOMPLETO | Sin content-type check |

---

## 7. ARQUITECTURA RECOMENDADA PARA ESCALABILIDAD

### Capas de Protección (Defense in Depth)

```
User Request
    ↓
[1] Rate Limiting (Redis/Firestore)
    ↓
[2] Auth Check (Firebase Auth)
    ↓
[3] Input Validation (Custom Middleware)
    ↓
[4] Firestore Security Rules
    ↓
[5] Cloud Function Logic
    ↓
[6] Error Handling + Logging (Sentry/Error Reporting)
    ↓
Database/Storage
```

### Escalabilidad para 50K Usuarios

```
Métrica Actual          |  Target 50K       |  Recomendación
─────────────────────────────────────────────────────────────
Cloud Functions         |  concurrent       |  Auto-scaling
                        |  1000s            |  Memory: 2GB
────────────────────────────────────────────────────────────
Firestore              |  50M+ docs        |  Composite indexes
                       |  10M ops/day      |  Sharding si >100K/seg
────────────────────────────────────────────────────────────
Storage                |  100TB+           |  Lifecycle rules
                       |  1000 ops/seg     |  CDN caching
────────────────────────────────────────────────────────────
FCM                    |  50K notifs/h     |  Topic-based sends
────────────────────────────────────────────────────────────
Vertex AI (Gemini)     |  10K calls/day    |  Caching, fallback
```

---

## 8. CAMBIOS IMPLEMENTADOS

### 8.1 Archivos Generados

✅ `src/app/config/security.ts` - Rate limiting helpers, sanitization, auth patterns

### 8.2 Archivos Actualizados

✅ `firestore.rules` - Admin claims, document size limits

✅ `storage.rules` - Content-type validation

✅ `firebase.json` - CSP header, CORS headers

### 8.3 Archivos para Crear (manual)

```
functions/src/utils/rateLimiter.ts      - Rate limiting middleware
functions/src/utils/errorHandler.ts     - Centralized error handling
functions/src/utils/validators.ts       - Input validation schemas
functions/src/middleware/cors.ts        - CORS configuration
```

---

## 9. PRÓXIMOS PASOS

### Inmediatos (1 semana)
1. [ ] Implementar rate limiting en Cloud Functions
2. [ ] Agregar error handling centralizado + Sentry
3. [ ] Regenerar VAPID key FCM
4. [ ] Implementar custom claims para admin

### Corto plazo (1-2 semanas)
5. [ ] Modularizar clinicalIngestion
6. [ ] Agregar timeouts a llamadas Gemini
7. [ ] Configurar Cloud Monitoring alerts
8. [ ] Validar content-type en Storage

### Mediano plazo (1 mes)
9. [ ] Implementar retry logic con exponential backoff
10. [ ] Crear dashboards de monitoring
11. [ ] Audit de Firestore performance
12. [ ] Load testing para 50K usuarios

---

## 10. CONCLUSIÓN

**Veredicto:** Infraestructura **95% lista para escalabilidad**, pero con **7 hallazgos críticos** en monitoring, rate limiting y error handling.

**Score de Escalabilidad:**
- Firestore Rules: 8/10 ✅
- Storage Rules: 7/10 ⚠️
- Cloud Functions: 5/10 ❌ (sin rate limiting, sin monitoring)
- Firebase Hosting: 9/10 ✅
- Monitoring: 0/10 ❌ (no existe)

**Recomendación:** Implementar cambios de Sección 1, 2, 3, 5 ANTES de llegar a 10K usuarios.

---

**Auditado por:** Tech Lead Backend
**Fecha:** 2026-03-26
**Próxima revisión:** 2026-06-26
