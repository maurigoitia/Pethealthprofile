# PESSY - Nota DevOps de Datos, Privacidad y Seguridad

Fecha: 2026-03-05  
Entorno revisado: repo local + configuracion Firebase del proyecto `gen-lang-client-0123805751`.

## 1. Resumen Ejecutivo

Estado actual:
- Hay una estructura de datos clara en Firestore por dominio clinico (mascotas, eventos, tratamientos, turnos, recordatorios).
- Los accesos principales estan protegidos por reglas owner/co-tutor en Firestore y por rutas por usuario en Storage.
- La integracion Gmail esta razonablemente endurecida (scope minimo, tokens cifrados, invitacion, estado OAuth con TTL, secretos en Functions).

Riesgos relevantes a cerrar:
1. El flujo de "Eliminar cuenta" en UI no elimina datos backend; hoy limpia `localStorage`.
2. `verified_reports` es lectura publica y contiene campos con datos personales (ej. tutor/mascota) cuando se comparte el link.
3. Config Firebase frontend con fallback al proyecto principal puede mezclar QA/local con datos productivos ante mala configuracion.

## 2. Arquitectura de Datos (alto nivel)

- Frontend (React/Vite PWA) usa:
  - Firebase Auth
  - Firestore
  - Storage
  - Cloud Functions callable/onRequest
- Backend (Cloud Functions):
  - Ingesta Gmail + extraccion clinica + sincronizacion calendario
  - Scheduler jobs (recordatorios, reconciliacion, workers)
- Hosting:
  - Targets separados (`app`, `appqa`, `appit`, `landing`, `landingqa`).

## 3. Estructura de Datos (Firestore)

### 3.1 Colecciones de producto (cliente)
- `users/{uid}`
  - subcolecciones: `fcm_tokens/*`, `pets/*`
- `pets`
- `invitations`
- `medical_events`
- `pending_actions`
- `medications`
- `appointments`
- `clinical_conditions`
- `diagnoses`
- `treatments`
- `clinical_alerts`
- `reminders`
- `scheduled_notifications`
- `scheduled_reminders`
- `dose_events`
- `verified_reports` (consulta publica por ID de verificacion)

### 3.2 Colecciones operativas/backend (admin-only)
Estas se escriben/leen desde Functions con Admin SDK (no estan expuestas por reglas cliente):
- `gmail_oauth_states`
- `gmail_oauth_attempts`
- `gmail_sync_invitations`
- `user_email_config`
- `userGmailConnections`
- `gmail_ingestion_sessions`
- `gmail_ingestion_documents`
- `gmail_ingestion_errors`
- `gmail_raw_documents_tmp`
- `gmail_attachment_extract_tmp`
- `gmail_event_reviews`
- `gmail_event_fingerprints`
- `gmail_document_hashes`
- `gmail_ai_quota`
- `gmail_user_locks`
- `email_sync_plan_overrides`
- `structured_medical_dataset`
- `pet_photo_upload_logs`
- `daily_notification_logs`
- `broadcast_push_campaigns`

## 4. Privacidad y Seguridad Implementadas

## 4.1 Control de acceso
- Firestore aplica aislamiento por usuario y/o mascota:
  - owner/co-tutor en `pets` y entidades clinicas asociadas.
  - recursos por `userId` en recordatorios.
- Storage restringe por path de usuario (`/users/{uid}/**` y `/documents/{uid}/**`), con limite de tamano por write.
- Colecciones no matcheadas en reglas quedan denegadas al cliente por defecto.

## 4.2 Integracion Gmail
- Scope minimo: `gmail.readonly` (+ `calendar.events` opcional).
- OAuth con `state` persistido y TTL.
- Gating por invitacion (`gmail_sync_invitations` / flags embebidos).
- Tokens sensibles cifrados en backend con `MAIL_TOKEN_ENCRYPTION_KEY` (AES-GCM).
- Secrets en Functions (`runWith({ secrets: [...] })`).
- Endpoint de ejecucion forzada protegido con clave (`GMAIL_FORCE_SYNC_KEY`).

## 4.3 IA / analisis clinico
- Camino recomendado backend (`analyzeDocument`, `generateClinicalSummary`) con `GEMINI_API_KEY` en Functions.
- Existe fallback legacy frontend para llamada directa si se habilita por flags/env.

## 4.4 Legal/public pages
- Paginas publicadas: `/privacy`, `/terms`, `/data-deletion`.
- Declaran tratamiento de datos, scopes Gmail, y proceso de borrado.

## 5. Hallazgos Criticos / Prioritarios

### [Alta] Borrado de cuenta no ejecuta borrado real de backend
Impacto:
- Riesgo de incumplimiento de expectativa de usuario y de politica publica de eliminacion.
Evidencia:
- UI de privacidad usa `localStorage.clear()` + logout local, sin pipeline de eliminacion de Firestore/Storage/Auth.
Accion recomendada:
- Implementar `deleteAccount` callable:
  - reautenticacion
  - revocacion Gmail
  - borrado Firestore (usuario + datos ligados)
  - borrado Storage por prefijo
  - eliminacion de usuario Auth
  - auditoria minima del evento.

### [Media] `verified_reports` es publico con datos personales
Impacto:
- Si se filtra el link, se exponen datos del tutor/mascota.
Accion recomendada:
- Minimizar payload publico (hash + metadatos no sensibles).
- Mover datos sensibles a coleccion privada y devolver vista redaccionada.
- Anadir expiracion/revocacion de links de verificacion.

### [Media] Fallback frontend al proyecto Firebase principal
Impacto:
- QA/local puede impactar datos productivos por error de configuracion.
Accion recomendada:
- Forzar fail-fast en entornos no productivos cuando faltan vars criticas.
- Bloquear escritura si `hostname` no corresponde al `projectId` esperado.
- Separar explicitamente config QA/prod sin fallback automatico.

## 6. Respuesta Corta para Stakeholders (lista para usar)

"Si, tenemos estructura y controles. Los datos clinicos estan modelados por entidad (mascotas, eventos, tratamientos, turnos) con reglas owner/co-tutor en Firestore y aislamiento por usuario en Storage. Gmail opera con permisos minimos (`gmail.readonly`), tokens cifrados en backend y secretos gestionados en Cloud Functions.  
Estamos cerrando 3 frentes de hardening: borrado real de cuenta en backend, minimizacion de datos en reportes verificables publicamente y eliminacion del fallback de configuracion que puede mezclar QA con productivo."

## 7. Plan DevOps Recomendado

1. Sprint inmediato (24-48h)
- Implementar `deleteAccount` backend end-to-end.
- Redactar `verified_reports` para exponer solo datos minimos.
- Bloquear fallback Firebase en QA/local.

2. Sprint corto (3-7 dias)
- Agregar tests automaticos de reglas (emulador) por coleccion critica.
- Definir matriz de retencion por coleccion (operativa vs clinica).
- Incorporar checklist de release de privacidad/seguridad en deploy.

3. Sprint de madurez (2-3 semanas)
- Logging estructurado + alertas por accesos anomalos.
- Rotacion y politica formal de secretos.
- Documento de clasificacion de datos (PII/PHI-like) por campo.
