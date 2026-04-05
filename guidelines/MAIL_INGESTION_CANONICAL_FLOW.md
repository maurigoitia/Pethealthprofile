# Mail Ingestion Canonical Flow

## Objetivo

Definir una sola verdad para la ingesta clínica por email en Pessy.

Regla principal:
- Un mail nunca debe escribir directo a la UI.
- Primero se clasifica.
- Después se decide si va a descarte, revisión o evento canónico.
- Los episodios siempre se derivan desde la verdad consolidada, no desde el mail crudo.

## Jerarquía de verdad

1. `gmail_ingestion_documents`
- Bitácora operativa de cada mail procesado.
- Guarda `processing_status`, clasificación, adjuntos, links y contexto de identidad.
- No es historia clínica.

2. `gmail_event_reviews`
- Cola formal de revisión humana.
- Se usa cuando el mail parece clínico, pero no alcanza para autoingesta confiable.
- No debe asumirse como verdad clínica final.

3. `pending_actions`
- Proyección operativa para que el tutor vea qué revisar o completar.
- Tipos válidos para mail ingestion:
  - `sync_review`
  - `incomplete_data`
- No reemplaza `medical_events`.

4. `clinical_review_drafts`
- Borrador estructurado para tratamientos incompletos.
- Solo existe cuando la detección tiene valor clínico pero faltan campos críticos.

5. `medical_events`
- Evento clínico canónico.
- Es la colección fuente para timeline y derivaciones longitudinales.
- Si el mail se consolida clínicamente, debe existir un `medical_events` correspondiente.

6. Proyecciones operativas derivadas
- `appointments`
- `treatments`
- `medications`

Estas colecciones no deben ser el primer destino del mail.
Siempre nacen a partir del evento canónico o de la lógica de revisión permitida.

7. Derivados longitudinales
- `clinical_episodes`
- `clinical_episode_buckets`
- `clinical_profile_snapshots`

Nunca se escriben directo desde un mail.
Siempre se recalculan desde entidades consolidadas.

## Modelo de segundo plano

La ingesta clínica por mail debe correr siempre en segundo plano.

Orden:

1. `queued_classification`
2. `queued_attachment_ocr`
3. clasificación final:
- `discarded_*`
- `requires_review_*`
- `ingested`

La UI no debe esperar a que termine toda la tubería.
Debe poder mostrar que Pessy:
- está leyendo correos
- está separando estudios/turnos/recetas
- está ordenando la historia

Pero sin tratar esa evidencia operativa como verdad clínica final.

## Trazabilidad mínima por mail

Cada documento de `gmail_ingestion_documents` debería dejar explícito:

- `processing_status`
- `routing_summary.route_status`
- `routing_summary.source_truth_level`
- `routing_summary.event_types_detected`
- `routing_summary.ingested_event_types`
- `routing_summary.review_event_types`
- `routing_summary.actual_write_targets`
- `routing_summary.downstream_projection_targets`

Eso permite auditar si un mail:
- fue descartado
- quedó en review
- creó un `medical_event`
- además proyectó a `appointments`
- además proyectó a `treatments/medications`

## Regla de ruteo por mail

### 1. Mail no clínico

Destino:
- `gmail_ingestion_documents.processing_status = discarded_non_clinical`

No crear:
- `gmail_event_reviews`
- `medical_events`
- `appointments`
- `treatments`
- `medications`
- `clinical_episodes`

Ejemplos:
- Cabify
- invitaciones calendario
- marketing
- pagos sin señal clínica útil

### 2. Mail con baja confianza o señal clínica incompleta

Destino:
- `gmail_ingestion_documents.processing_status = requires_review_low_confidence`
  o `requires_review`
- `gmail_event_reviews`
- `pending_actions` tipo `sync_review`

No crear:
- `appointments`
- `treatments`
- `medications`
- `clinical_episodes`

Excepción:
- Si es tratamiento real pero faltan dosis/frecuencia, ver regla 4.

### 3. Mail clínico autoingestable

Destino mínimo:
- `medical_events`
- `structured_medical_dataset`
- mirror al brain resolver

Después, según tipo:
- turno -> `appointments`
- receta completa -> `treatments` + `medications`
- vacuna -> solo `medical_events` canónico
- estudio / informe clínico -> solo `medical_events` canónico

### 4. Mail de receta o tratamiento con datos incompletos

Destino:
- `medical_events` en estado borrador / revisión
- `gmail_event_reviews`
- `clinical_review_drafts`
- `pending_actions` tipo `incomplete_data`
- `structured_medical_dataset` con `review_queue`

No crear:
- recordatorios clínicos finales
- episodios confirmados

Sí puede crear:
- evento canónico en `medical_events` si hace falta sostener el contexto clínico del review

## Matriz canónica por tipo de mail

### Turno confirmado / recordatorio / cancelación

Debe crear:
- `medical_events` con `source = email_import`
- `appointments` mediante proyección operativa

Debe ir a review si:
- falta hora / profesional / clínica / estado
- la fecha futura es dudosa
- la confianza cae debajo del umbral

Puede terminar en episodios:
- sí, pero solo cuando el evento o la proyección ya quedaron consolidados y no requieren revisión

### Receta completa

Debe crear:
- `medical_events`
- `treatments`
- `medications`

No debe crear:
- `pending_actions` de revisión si dosis y frecuencia están completas

Puede terminar en episodios:
- sí, como episodio de tipo `prescription` si el evento canónico queda confirmado

### Receta incompleta

Debe crear:
- `medical_events` en revisión
- `gmail_event_reviews`
- `clinical_review_drafts`
- `pending_actions` tipo `incomplete_data`

No debe crear:
- tratamiento operativo final si faltan campos críticos para recordatorio seguro

### Estudio / laboratorio / informe clínico

Debe crear:
- `medical_events`

Puede crear review si:
- el tipo de estudio no se entiende
- el documento parece clínico pero no estructura lo suficiente
- la fecha o el contexto del paciente son dudosos

Puede terminar en episodios:
- sí, si queda fuera de review y sin `requiresManualConfirmation`

### Factura / comprobante / mail administrativo de veterinaria

Regla:
- no se convierte en evento clínico por defecto

Solo entra a review si:
- trae adjunto clínico
- trae link externo con probable resultado / receta / estudio
- el cuerpo sugiere contenido médico pero la confianza es baja

### Links externos con login requerido

Destino:
- `gmail_event_reviews`
- `pending_actions.sync_review`

No crear:
- evento clínico final

## Campos obligatorios para todo lo que venga de mail

Si una entidad fue creada por mail ingestion, debe guardar:
- `source = email_import`
- `source_email_id`

Cuando aplique, también:
- `generatedFromEventId`
- `sourceEventId`
- `source_truth_level`
- `validated_by_human`
- `requires_confirmation` o `requires_user_confirmation`

## Reglas de episodio

Los episodios se construyen desde `backfillClinicalEpisodes`.

Un `medical_event` solo entra en episodios si:
- `status` no es `draft`
- `workflowStatus` no es `review_required`
- `workflowStatus` no es `invalid_future_date`
- `requiresManualConfirmation` es `false`

Además:
- `appointments` también pueden proyectarse a episodios
- `treatments` y `medications` alimentan sobre todo snapshot/perfil, no deben saltarse el evento canónico

## Reglas duras

1. No escribir `clinical_episodes` directo desde mail ingestion.
2. No crear `treatments` o `medications` si el mail no tiene fármaco explícito.
3. No crear `appointments` si el mail solo “parece” un turno pero no alcanza para sostenerlo.
4. No usar `gmail_ingestion_documents` como historia clínica.
5. No usar `pending_actions` como sustituto de `medical_events`.
6. Si un registro viejo no tiene `source = email_import`, no asumir que proviene de mail.
7. Si un mail entra en review, la UI debe leer review, no inventar una verdad híbrida.

## Contrato del cerebro de Pessy

El cerebro puede narrar:
- eventos canónicos confirmados
- revisiones pendientes
- tratamientos completos
- turnos operativos válidos

El cerebro no debe narrar como hecho:
- mails descartados
- reviews sin confirmar como si fueran verdad
- tratamientos incompletos como medicación activa final

## Runbook corto

Cuando se toque este pipeline:

1. Resetear solo artefactos de mail si hace falta.
2. Reingestar con ventana chica.
3. Reingestar con ventana histórica.
4. Auditar:
- `gmail_ingestion_sessions`
- `gmail_ingestion_documents`
- `gmail_event_reviews`
- `medical_events`
- `appointments`
- `treatments`
- `medications`
- `pending_actions`
- `clinical_episodes`
5. Confirmar que no quedó estado híbrido.
