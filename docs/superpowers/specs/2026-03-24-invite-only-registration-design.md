# Pessy — Registro Solo por Invitación

**Fecha:** 2026-03-24
**Estado:** Aprobado por usuario
**Scope:** Solo sistema de invitación. No se toca login, auth, firebase config, ni nada fuera de scope.

---

## Problema

Pessy está en beta cerrada. Hoy cualquiera puede registrarse libremente. Necesitamos que solo puedan registrarse:
- Personas invitadas por un usuario existente (Flujo A)
- Personas que solicitaron acceso por redes y fueron aprobadas manualmente (Flujo B)

## Enfoque

Gate en frontend + Firestore Rules (Enfoque A). No se usan blocking functions de Firebase Auth.

---

## Firestore — Datos nuevos

### Colección `access_requests/{docId}`

Para la waitlist (gente que llega por redes sociales).

| Campo | Tipo | Descripción |
|-------|------|-------------|
| name | string | Nombre del solicitante |
| email | string | Email del solicitante |
| source | string | "tiktok" / "instagram" / "facebook" / "otro" |
| status | string | "pending" / "approved" / "rejected" |
| createdAt | timestamp | Fecha de solicitud |
| approvedAt | timestamp? | Fecha de aprobación |
| approvedBy | string? | UID del admin que aprobó |
| accessToken | string? | Token de 8 chars generado al aprobar |
| accessTokenExpiresAt | timestamp? | Token expira 24hs después de aprobación |

### Colección `invitations/{code}` — Campo nuevo

Se agrega `type` a las invitaciones existentes:
- `type: "cotutor"` — invitación de co-tutor (flujo existente, no se toca)
- `type: "platform"` — invitación a la plataforma (flujo nuevo)

Campos adicionales para `type: "platform"`:
| Campo | Tipo | Descripción |
|-------|------|-------------|
| type | string | "platform" |
| createdBy | string | UID del usuario que invita |
| createdByName | string | Nombre del usuario que invita |
| used | boolean | Si ya fue usada |
| usedBy | string? | UID del usuario que la usó |
| usedAt | timestamp? | Cuándo se usó |
| createdAt | timestamp | Cuándo se creó |
| expiresAt | timestamp | Creación + 24 horas |

### Colección `users/{uid}` — Campos nuevos

| Campo | Tipo | Descripción |
|-------|------|-------------|
| invitedBy | string? | UID del usuario que lo invitó (Flujo A) |
| accessSource | string? | "invite" / "waitlist" / "direct" |
| referralCode | string? | Código personal para invitar gente |

---

## Flujo A — Invitado por usuario existente

### Generación del link
1. Usuario va a su perfil → botón "Invitar amigos"
2. Se abre un modal/bottom sheet
3. Si no tiene `referralCode`, se genera uno (6 chars alfanumérico) y se guarda en su doc `users/{uid}`
4. Se crea doc en `invitations/{CODE}` con `type: "platform"`
5. Se muestra el link: `https://app.pessy.app/register-user?ref=CODE` (usamos `?ref=` para NO colisionar con `?invite=` que ya usa el flujo de co-tutores)
6. Botón para copiar + compartir (Web Share API si disponible)

### Uso del link
1. Invitado abre el link → llega a `/register-user?ref=CODE`
2. RegisterUserScreen lee `?ref=` (NO `?invite=`, que es co-tutores) y valida contra Firestore:
   - Existe en `invitations`
   - `type === "platform"`
   - `used === false`
   - `expiresAt > now` (expira en 24 horas desde creación)
3. Si válido → formulario normal de registro
4. Al crear cuenta (en transacción Firestore):
   - Se guarda `invitedBy: createdBy` en el doc del usuario
   - Se marca la invitación como `used: true, usedBy: uid, usedAt: now`
   - La transacción garantiza que no se use 2 veces el mismo código

---

## Flujo B — Waitlist desde redes

### Solicitud de acceso
1. Persona llega a `/solicitar-acceso` (nueva ruta)
2. Ve pantalla con form: nombre, email, "¿Cómo nos conociste?"
3. Submit → crea doc en `access_requests` con `status: "pending"`
4. Pantalla de confirmación: "Te avisamos cuando tengas acceso"

### Aprobación (panel admin)
1. Mauri accede a `/admin/access-requests` (nueva ruta, protegida por UID)
2. Ve lista de solicitudes pendientes
3. Click "Aprobar" → genera `accessToken` (8 chars) → actualiza doc → envía email via **nueva Cloud Function callable** `approveAccessRequest` (necesaria porque Resend necesita API key server-side)
4. Email contiene link: `https://app.pessy.app/register-user?access=TOKEN`

**Nota sobre Cloud Function:** Se necesita UNA función nueva `approveAccessRequest` que: valida que el caller es admin, genera token, actualiza doc, y envía email via Resend (que ya está configurado en el proyecto). Esta es la única Cloud Function nueva.

### Uso del link de acceso
1. Persona abre el link → llega a `/register-user?access=TOKEN`
2. RegisterUserScreen valida contra `access_requests`:
   - Existe doc con ese `accessToken`
   - `status === "approved"`
3. Si válido → formulario normal (pre-llena nombre y email del request)
4. Al crear cuenta:
   - Se guarda `accessSource: "waitlist"` en el doc del usuario
   - Se actualiza `access_requests` doc con `usedAt: now`

---

## Gate en RegisterUserScreen

```
Al montar (ANTES de la lógica de co-tutor existente):
├── ¿Tiene ?ref=CODE? → Validar platform invite en Firestore
│   ├── Válido + no expirado → Mostrar formulario
│   └── Inválido/expirado/usado → "Este link ya no es válido"
├── ¿Tiene ?access=TOKEN? → Validar en access_requests
│   ├── Válido + no expirado → Mostrar formulario (pre-llenado)
│   └── Inválido → "Este acceso no es válido"
├── ¿Tiene ?invite=CODE? → Es co-tutor, NO es platform invite
│   └── Dejar pasar al formulario (el flujo de co-tutor existente se encarga)
└── Sin params → Pantalla bloqueada
    ├── "Pessy está en beta cerrada"
    ├── "Si alguien te invitó, pedile el link"
    └── Botón "Solicitar acceso" → /solicitar-acceso
```

**IMPORTANTE:** `?invite=` es SOLO para co-tutores (sistema existente). `?ref=` es para invitaciones a la plataforma (sistema nuevo). No se mezclan.

---

## Gate en LoginScreen

- Botón "Registrarse gratis" → cambia texto a "Solo por invitación" + `disabled`
- Se agrega link debajo: "¿Querés acceso? Solicitalo acá" → `/solicitar-acceso`
- **No se toca nada más del LoginScreen**

---

## Rutas nuevas

| Ruta | Componente | Acceso |
|------|-----------|--------|
| `/solicitar-acceso` | RequestAccessScreen | Público |
| `/admin/access-requests` | AdminAccessRequests | Solo Mauri (hardcoded UID) |

---

## Firestore Rules nuevas

```
match /access_requests/{docId} {
  // Cualquiera puede crear una solicitud (con validación anti-spam)
  allow create: if request.resource.data.status == 'pending'
                && request.resource.data.createdAt == request.time
                && request.resource.data.keys().hasAll(['name', 'email', 'source', 'status', 'createdAt'])
                && request.resource.data.name is string
                && request.resource.data.email is string
                && request.resource.data.name.size() > 0
                && request.resource.data.email.size() > 5;

  // Solo admin puede leer y actualizar
  allow read, update: if request.auth.uid == 'MAURI_UID';
}

match /invitations/{code} {
  // Reglas existentes de cotutor SE MANTIENEN (merge con OR)
  // Se agrega cláusula para platform invites:
  allow create: if
    // Regla existente de co-tutor (no se modifica, solo se wrappea en OR)
    (/* regla cotutor existente */)
    ||
    // Nueva regla para platform invites
    (request.auth != null
     && request.resource.data.type == 'platform'
     && request.resource.data.createdBy == request.auth.uid
     && request.resource.data.used == false);

  // GET: platform invites son públicos (necesario para validar antes de auth)
  // Co-tutor invites mantienen sus reglas restrictivas existentes
  allow get: if
    (resource.data.type == 'platform')
    || (/* reglas get existentes de cotutor */);

  // UPDATE: platform invites — solo marcar como usado
  // Co-tutor invites mantienen sus reglas existentes
  allow update: if
    (resource.data.type == 'platform'
     && request.auth != null
     && request.resource.data.used == true
     && resource.data.used == false)
    || (/* reglas update existentes de cotutor */);
}
```

**Nota:** `MAURI_UID` se reemplaza por el UID real al implementar. Las reglas de co-tutor existentes se mantienen exactas, solo se envuelven en OR con las nuevas.

---

## Archivos a modificar

| Archivo | Cambio | Impacto |
|---------|--------|---------|
| `RegisterUserScreen.tsx` | Agregar gate al montar + pequeñas adiciones en submit para guardar `invitedBy`/`accessSource` | Gate al inicio + ~5 líneas en submit |
| `LoginScreen.tsx` | Cambiar botón registro + agregar link waitlist | Solo texto y disabled, no toca auth |
| `routes.tsx` | Agregar 2 rutas nuevas | No modifica rutas existentes |
| `firestore.rules` | Agregar reglas para access_requests + platform invites | No modifica reglas existentes |

## Archivos nuevos

| Archivo | Propósito |
|---------|-----------|
| `RequestAccessScreen.tsx` | Formulario de solicitud de acceso (waitlist) |
| `AdminAccessRequests.tsx` | Panel para aprobar/rechazar solicitudes |
| `InviteFriendsModal.tsx` | Modal para que usuarios generen y compartan su link |
| `utils/platformInvite.ts` | Funciones: generatePlatformInvite, validateInviteCode, validateAccessToken |

## Lo que NO se toca

- `AuthContext.tsx` — no se modifica
- `firebase.ts` — no se modifica
- `PetContext.tsx` — no se modifica
- `CoTutorModal.tsx` — no se modifica
- `HomeScreen.tsx` — no se modifica
- Cloud Functions existentes — no se modifican (se agrega UNA nueva: `approveAccessRequest`)
- Flujo de co-tutores existente — no se modifica
- Usuarios existentes — no necesitan backfill, los campos nuevos son opcionales

## Edge Cases Resueltos

1. **`?invite=` vs `?ref=`** — Son params distintos. `?invite=` es co-tutores (existente), `?ref=` es plataforma (nuevo). No colisionan.
2. **Doble uso de código** — Transacción Firestore al registrar + rule que chequea `used == false` al update.
3. **Expiración** — Platform invites: 24 horas. Access tokens: 24 horas.
4. **Spam en waitlist** — `createdAt == request.time` en rules + validación de campos. Se puede agregar Turnstile después si es necesario.
5. **Email duplicado en waitlist** — Se chequea client-side antes de crear. No es crítico si se duplica.
6. **Firestore rules merge** — Las reglas nuevas se agregan con OR, las existentes no se tocan.
7. **Co-tutor que llega con `?invite=`** — El gate lo deja pasar al formulario, el flujo existente se encarga.
