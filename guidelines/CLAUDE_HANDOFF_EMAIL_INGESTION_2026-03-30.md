# Claude Handoff · Email Ingestion · 2026-03-30

## Qué quedó resuelto

### 1. Review-safe canonical events ya están en producción

Se publicó lógica para que mails en `requires_review` pero con estructura suficiente creen también verdad canónica:

- `appointment_*` estructurados:
  - `medical_events` draft/review
  - `appointments`
  - `gmail_event_reviews`
  - `pending_actions`
- `study_report` con señal clínica suficiente:
  - `medical_events` draft/review
  - `gmail_event_reviews`
  - `pending_actions`

Archivos:
- [functions/src/gmail/clinicalIngestion.ts](/Users/mauriciogoitia/Downloads/03_PESSY_APP/PESSY_PRODUCCION/functions/src/gmail/clinicalIngestion.ts)
- [functions/src/gmail/ingestion/clinicalFallbacks.ts](/Users/mauriciogoitia/Downloads/03_PESSY_APP/PESSY_PRODUCCION/functions/src/gmail/ingestion/clinicalFallbacks.ts)
- [functions/src/gmail/ingestion/__tests__/clinicalFallbacks.test.ts](/Users/mauriciogoitia/Downloads/03_PESSY_APP/PESSY_PRODUCCION/functions/src/gmail/ingestion/__tests__/clinicalFallbacks.test.ts)

### 2. Bug de sesión colgada en scan ya está resuelto

Había un bug real:
- `processScanQueueJob()` intentaba llamar `ensurePendingScanJob()` antes de cerrar el job actual.
- Como el job actual seguía en `processing`, `ensurePendingScanJob()` no creaba el siguiente scan job.
- Resultado: sesiones quedaban `queued`, con `next_page_token`, sin trabajos pendientes reales.

Fix aplicado:
- mover `markJobCompleted(doc.ref)` antes del `ensurePendingScanJob()` dentro de `processScanQueueJob()`

Archivo:
- [functions/src/gmail/clinicalIngestion.ts](/Users/mauriciogoitia/Downloads/03_PESSY_APP/PESSY_PRODUCCION/functions/src/gmail/clinicalIngestion.ts)

## Verificación live

### Corrida anterior útil

Sesión:
- `9ea07cf5-722e-4d13-8b12-73f80ce7075e`

Resultado:
- `53` mails escaneados
- `42` candidatos
- `16` reviews
- `13` `medical_events` nuevos

Confirmado:
- `Radiografias de Thor` -> `mixed`
- `Ecografía Thor` -> `mixed`
- `Turno para Thor (ACTUALIZADO)` -> `mixed`
- `Recordatorio de Turno Honorio` -> `mixed`

### Corrida posterior al fix de re-encolado

Sesión:
- `d19b6c55-9b32-4874-8ca8-da785aa38a8e`

Resultado live:
- `status = requires_review`
- `completed_at` presente
- `66` mails escaneados
- `52` candidatos
- `17` reviews
- `14` `medical_events` nuevos
- `0` jobs pendientes (`scan=0`, `attachment=0`, `ai_extract=0`)

Esto confirma que el bug de sesión colgada quedó resuelto.

## Residual exacto que sigue abierto

Quedaron `2` documentos en:
- `processing_status = queued_classification`
- `routing_summary.route_status = pending_background_processing`

Son estos:
- `ECO THOR`
- `ECO DE THOR`

Remitente:
- `laura diaz <lvdiazz@yahoo.com.ar>`

## Hallazgo técnico importante

Para esos dos mensajes:

- existe `gmail_raw_documents_tmp`
- no existe `gmail_attachment_extract_tmp`
- existe job en `gmail_ai_jobs` con:
  - `status = completed`
  - `mode = classify`
- no existe job en `gmail_attachment_jobs`

Interpretación:
- el scan ya no es el problema
- el classify job sí corre y termina
- pero esos dos mails no están dejando `queued_attachment_ocr` ni job de attachment
- el bug residual está entre:
  - salida de `classifyClinicalContentWithAi()`
  - `enqueueStageJob(stage: "attachment")`
  - persistencia de `processing_status = queued_attachment_ocr`

## Qué NO tocar

- No tocar `pessy.app`
- No tocar landing/blog
- No abrir frontend por este bloque
- No reabrir la lógica ya resuelta de `review-safe canonical events`

## Próximo bloque para Claude

### P0

Resolver por qué `ECO THOR` y `ECO DE THOR`:
- completan `gmail_ai_jobs` modo `classify`
- pero no generan `gmail_attachment_jobs`
- y quedan clavados en `queued_classification`

### Cómo empezar

1. Reproducir con la sesión live:
- `d19b6c55-9b32-4874-8ca8-da785aa38a8e`

2. Inspeccionar específicamente:
- `message_id = 198cf1fca792450a`
- `message_id = 19c2e4687f93f380`

3. Verificar en `processAiQueueJob()`:
- retorno real de `classifyClinicalContentWithAi()`
- si entra al branch clínico
- si `enqueueStageJob(stage: "attachment")` se llama
- si el doc Firestore se pisa después por otro write que lo devuelve a `queued_classification`

4. Si el classify ya alcanza para estos correos:
- evaluar si deben ir directo a `attachment` o incluso a fallback attachment-first

### P1

Decidir si `Recordatorio de Vacuna para Thor` debe:
- seguir en `review_queue`
- o pasar también a canónico review-safe

Hoy sigue solo en review.

### P2

Volver a correr QA real:
- reset real
- force-run `80 / 36 meses`
- confirmar que:
  - `queued_classification = 0`
  - `ECO THOR` y `ECO DE THOR` ya no quedan colgados
  - `status` final siga cerrando en `requires_review` o `completed`, pero con `completed_at`

## Criterio de terminado para este hilo

- `0` docs colgados en `queued_classification`
- ningún mail attachment-first clínico queda sin transición a attachment/extract/review/canonical
- `forceRunEmailClinicalIngestion(waitForCompletion=true)` cierra sin jobs pendientes
- sesión final con `completed_at`

