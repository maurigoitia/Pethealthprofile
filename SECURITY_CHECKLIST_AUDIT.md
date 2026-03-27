# SECURITY CHECKLIST - PESSY BACKEND AUDIT
## 2026-03-26 | Tech Lead Review

---

## 1. API KEYS & SECRETS

### Current Status

```
✅ VITE_FIREBASE_VAPID_KEY
   Location: .env.example
   Issue: EXPUESTO en control de versión
   Risk Level: ALTO
   Action: REGENERAR inmediatamente
   
✅ VITE_USE_BACKEND_ANALYSIS
   Location: .env.example  
   Type: Feature flag (no sensible)
   Status: ✅ SEGURO

❌ .env.local
   Status: NO COMMITEADO
   Recommendation: ✅ Mantener así (en .gitignore)
```

### Actions Required

```bash
# 1. Regenerar VAPID Key en Firebase Console
# Project Settings > Cloud Messaging > Web Push Certificates
# Copiar nueva key

# 2. Actualizar en:
# - functions/.env.gen-lang-client-0123805751
# - functions/.env.polar-scene-488615-i0
# - CI/CD secrets en GitHub/GitLab

# 3. Invalidar key antigua:
# - Eliminar todas las suscripciones FCM antiguas
```

### Secrets Manager Recommendation

Para 50K usuarios, implementar Google Secret Manager:

```typescript
// functions/src/utils/secrets.ts
import { SecretManagerServiceClient } from "@google-cloud/secret-manager";

const client = new SecretManagerServiceClient();

export async function getSecret(secretId: string): Promise<string> {
  const name = client.secretVersionPath(
    process.env.GCP_PROJECT_ID!,
    secretId,
    "latest"
  );
  const [version] = await client.accessSecretVersion({ name });
  return version.payload?.data?.toString("utf8") || "";
}

// Usage:
const vapidKey = await getSecret("firebase-vapid-key");
```

**Costo:** $0.06 por operación (7M operaciones gratis/mes)

---

## 2. ADMIN EMAILS & HARDCODING

### Current Status

```
❌ CRÍTICO: Admin hardcodeado
   File: firestore.rules (línea ~107)
   Code: request.auth.token.email == 'mauri@pessy.app'
   
   FIXED ✅
   Updated: request.auth.token.admin == true
```

### Migración a Custom Claims

```bash
# 1. En Firebase Console o script:
firebase auth:import accounts.csv --hash-algo=scrypt

# 2. O mediante Firebase Admin SDK:
await admin.auth().setCustomUserClaims("user-uid", {
  admin: true,
  role: "tech_lead"
});

# 3. Usar en Firestore Rules:
function isAdmin() {
  return signedIn() && request.auth.token.admin == true;
}

# 4. Usar en Cloud Functions:
const decodedToken = await admin.auth().verifyIdToken(token);
if (!decodedToken.admin) throw Error("Unauthorized");
```

### Implementar RBAC (Role-Based Access Control)

```typescript
// functions/src/utils/rbac.ts
type Role = "admin" | "moderator" | "user";

export async function hasRole(uid: string, role: Role): Promise<boolean> {
  const token = await admin.auth().getUser(uid);
  const customClaims = token.customClaims || {};
  return customClaims.role === role || customClaims.admin === true;
}

// Usage:
if (!await hasRole(context.auth?.uid, "admin")) {
  throw new functions.https.HttpsError("permission-denied", "Admin required");
}
```

---

## 3. CORS CONFIGURATION

### Current Status

```
❌ Cloud Functions: No configurado
   Risk: Aceptar requests de cualquier origin
   Impact: CSRF attacks posibles

✅ Firebase Hosting: Same-origin implícito
   Status: SEGURO por defecto

❌ Storage: No hay CORS headers específicos
   Risk: Uploads desde otros dominios
```

### Implementation

```typescript
// functions/src/middleware/cors.ts
import * as cors from "cors";

const corsOptions = {
  origin: [
    "https://pessy.app",
    "https://app.pessy.app",
    "https://qa.pessy.app",
    /^https:\/\/.*\.pessy\.app$/,
  ],
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"],
  maxAge: 86400,
};

export const corsMiddleware = cors(corsOptions);

// Usage en HTTP Functions:
export const myFunction = functions.https.onRequest((req, res) => {
  corsMiddleware(req, res, () => {
    // Logic
  });
});
```

### CORS Headers Added to firebase.json ✅

```json
{
  "key": "Access-Control-Allow-Origin",
  "value": "https://pessy.app"
}
```

---

## 4. RATE LIMITING

### Current Status

```
❌ CRÍTICO: NO implementado en ningún lado
   
Endpoints sin protección:
  - Cloud Functions (todos)
  - Firestore writes (ilimitadas)
  - Storage uploads (solo size limit)
  - Auth endpoints (sin brute force protection)
```

### Implementation Plan

**Option A: Firestore-based (Cheap)**

```typescript
// functions/src/utils/rateLimiter.ts
import * as admin from "firebase-admin";

interface RateLimitBucket {
  count: number;
  resetAt: number;
}

export async function checkRateLimit(
  userId: string,
  action: string,
  limit: number,
  windowMs: number
): Promise<boolean> {
  const db = admin.firestore();
  const bucketId = `${userId}:${action}`;
  const ref = db.collection("_rate_limits").doc(bucketId);

  const result = await db.runTransaction(async (transaction) => {
    const doc = await transaction.get(ref);
    const now = Date.now();

    if (!doc.exists) {
      // First request in window
      transaction.set(ref, {
        count: 1,
        resetAt: now + windowMs,
      });
      return true;
    }

    const data = doc.data() as RateLimitBucket;

    if (now > data.resetAt) {
      // Window expired, reset
      transaction.set(ref, {
        count: 1,
        resetAt: now + windowMs,
      });
      return true;
    }

    if (data.count >= limit) {
      // Limit exceeded
      return false;
    }

    // Within limit, increment
    transaction.update(ref, { count: data.count + 1 });
    return true;
  });

  return result;
}

// Usage:
const allowed = await checkRateLimit(
  context.auth?.uid || "anonymous",
  "ingestHistory",
  10,
  60 * 60 * 1000 // 1 hour
);

if (!allowed) {
  throw new functions.https.HttpsError(
    "resource-exhausted",
    "Rate limit exceeded. Max 10 ingestions per hour."
  );
}
```

**Option B: Redis (Faster, needs setup)**

```typescript
import * as redis from "redis";

const client = redis.createClient({
  host: process.env.REDIS_HOST,
  port: 6379,
});

export async function checkRateLimit(
  userId: string,
  action: string,
  limit: number,
  windowMs: number
): Promise<boolean> {
  const key = `ratelimit:${userId}:${action}`;
  const current = await client.incr(key);

  if (current === 1) {
    await client.expire(key, Math.ceil(windowMs / 1000));
  }

  return current <= limit;
}
```

**Recomendación:** Usar Firestore para empezar (simplidad), migrar a Redis si >10K usuarios

---

## 5. INPUT VALIDATION

### Current Status

```
⚠️ PARCIAL: Inconsistente entre funciones

✅ Cloud Functions:
   - ingestHistory: Tiene assertRequest
   - accountDeletion: Tiene validación básica
   - brainResolver: ❌ Sin validación de input

⚠️ Firestore Rules:
   - access_requests: Validación regex ✅ MEJORADO
   - Demás colecciones: Validación basic (type check)
   
❌ Storage:
   - Content-type validation ✅ MEJORADO
   - Extension validation: ✅ MEJORADO
```

### Validation Framework Created ✅

```typescript
// src/app/config/security.ts

// Type guards
isPetId(value): value is string
isUserId(value): value is string
isEmail(value): value is string
isIsoDate(value): value is string
isIsoTime(value): value is string

// Sanitization
sanitizeInput(input)
sanitizeEmail(email)
sanitizePetId(petId)
sanitizeUserId(userId)

// Validation
validateMedicalEvent(data)
validateDocumentSize(data)
```

### Usage Pattern

```typescript
import * as sec from "./config/security";

export const createMedicalEvent = functions.https.onCall(
  async (data, context) => {
    try {
      // Validate input
      const petId = sec.sanitizePetId(data.petId);
      const event = sec.validateMedicalEvent(data.event);
      sec.validateDocumentSize(event);

      // Auth checks
      sec.requireAuth(context.auth?.uid);
      await sec.verifyPetAccess(petSnap.data(), context.auth.uid);

      // Process
      // ...
    } catch (error) {
      throw new functions.https.HttpsError("invalid-argument", error.message);
    }
  }
);
```

---

## 6. FIRESTORE RULES SECURITY

### Current Status

```
✅ BIEN ESTRUCTURADO:
   - Authentication required ✅
   - Ownership verification ✅
   - Co-tutor support ✅
   
⚠️ MEJORADO:
   - Admin claims ✅ (changed from email)
   - Document size limits ✅ (added 500KB)
   - Email validation ✅ (added regex)
   
❌ TODO:
   - Rate limiting a nivel de rules (usar Cloud Functions)
```

### Rules Summary

```firestore
✅ users/{userId}
   - read/write: Solo el usuario autenticado

✅ pets/{petId}
   - create: Solo el owner
   - read: Owner + co-tutors
   - update: Owner + co-tutors (con restricciones)
   - delete: Solo owner

✅ medical_events/{eventId}
   - read/write: Owner + co-tutors del pet
   - size limit: 500KB

✅ access_requests/{docId}
   - create: Validado (nombre, email con regex)
   - read/update: Solo admin
   - delete: Prohibido

✅ invitations/{code}
   - Validación de código (6 caracteres alphanumeric)
   - Soporte para invites de plataforma
   - Expiración de invites
```

### Changes Made ✅

```diff
- function isAdmin() {
+ function isAdmin() {
-   return signedIn() && request.auth.token.email == 'mauri@pessy.app';
+   return signedIn() && request.auth.token.admin == true;
  }
```

---

## 7. STORAGE RULES SECURITY

### Current Status Before

```
⚠️ Size limit: 30MB ✅ (adecuado)
❌ Sin validación de content-type
❌ Sin validación de extensión
```

### Changes Made ✅

```firestore
+ function validImageType() {
+   return request.resource.contentType.matches('image/(jpeg|png|gif|webp)');
+ }
+
+ function validDocumentType() {
+   return request.resource.contentType.matches('application/(pdf|msword|...)');
+ }
+
+ function validMediaType() {
+   return validImageType() || validDocumentType();
+ }
```

### Effect

```
BEFORE: Cualquier archivo ≤30MB
AFTER:  Solo imágenes y PDFs/docs ≤30MB
BLOCKS: .exe, .sh, .zip, archivos ejecutables
```

---

## 8. FIREBASE HOSTING HEADERS

### Changes Made ✅

Added to firebase.json:

```
✅ Content-Security-Policy
   default-src 'self'
   script-src 'self' 'wasm-unsafe-eval'
   style-src 'self' 'unsafe-inline'
   img-src 'self' https: data:
   connect-src 'self' firebase.googleapis.com
   frame-ancestors 'none'

✅ Access-Control-Allow-Origin
   https://pessy.app

Existing (ya estaban bien):
✅ X-Content-Type-Options: nosniff
✅ X-Frame-Options: DENY
✅ X-XSS-Protection: 1; mode=block
✅ Referrer-Policy: strict-origin
✅ Permissions-Policy: restrictivo
✅ HSTS: 1 año includeSubDomains
```

---

## 9. CONFIGURATION FILES REVIEW

### .env.example

```
✅ Secrets publicly exposed?
   - VITE_FIREBASE_VAPID_KEY: ⚠️ EXPUESTO (regenerar)
   - Other flags: ✅ Seguro

✅ Staging/QA keys?
   - No hay mix de prod/staging
   - ✅ Bien separado
```

### firebase.json

```
✅ Security headers: ✅ OPTIMIZADOS
✅ Cache policies: ✅ CORRECTOS
✅ Redirects: ✅ NECESARIOS
✅ CORS: ✅ MEJORADO
```

### firestore.rules

```
✅ Authentication: ✅ REQUERIDA
✅ Validation: ⚠️ MEJORADA
✅ Admin access: ✅ REFACTORIZADO
```

### storage.rules

```
✅ File size: ✅ LIMITADO
✅ Content-type: ✅ VALIDADO
```

---

## SUMMARY: SECURITY POSTURE

### Score: 7/10

```
Firestore Rules:        8/10 ✅
Storage Rules:          7/10 ⚠️
Hosting Config:         9/10 ✅
API Keys:               4/10 ❌ (VAPID needs regen)
Rate Limiting:          0/10 ❌ (No implementado)
Input Validation:       6/10 ⚠️ (Inconsistente)
Monitoring:             0/10 ❌ (No existe)
Error Handling:         4/10 ⚠️ (No centralizado)
CORS:                   8/10 ✅
Admin Access Control:   7/10 ✅
```

### Top 3 Priorities (Next 2 weeks)

1. **REGENERAR VAPID KEY** (High Risk, 1 hour)
2. **Implement Rate Limiting** (Critical for scale, 1-2 days)
3. **Setup Error Monitoring** (Visibility critical, 1 day)

### Medium Term (1 month)

4. Implement RBAC with custom claims
5. Centralize input validation
6. Add performance monitoring
7. Setup alert policies

---

## IMPLEMENTATION TRACKING

### ✅ COMPLETED

- [x] Firestore Rules improvements (admin claims, size limits, email validation)
- [x] Storage Rules improvements (content-type, extensions)
- [x] Firebase Hosting headers (CSP, CORS)
- [x] Security config file (src/app/config/security.ts)
- [x] Rate limit presets defined
- [x] Input validation helpers created
- [x] Auth verification patterns documented

### 🔄 IN PROGRESS

- [ ] Regenerate VAPID key (manual action)
- [ ] Setup monitoring (Firebase Error Reporting)
- [ ] Implement rate limiting in functions

### ⏳ PENDING

- [ ] RBAC implementation
- [ ] Centralized error handler
- [ ] Structured logging
- [ ] Sentry integration (optional)
- [ ] BigQuery log analysis

---

**Audit completado por:** Tech Lead Backend  
**Fecha:** 2026-03-26  
**Próxima revisión:** 2026-06-26

Todas las recomendaciones están documentadas y listos para implementación.
