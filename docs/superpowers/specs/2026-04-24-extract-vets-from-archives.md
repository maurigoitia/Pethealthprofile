# Spec — Extracción de veterinarios desde archivos ya subidos

## Contexto

Hoy la sección "Tus veterinarios" (en `/buscar-vet` y `/cuidados`) se alimenta de `TreatingVetsList`, que lee `useMedical().events` y saca el campo `extractedData.masterPayload.document_info.veterinarian_name` de cada evento. El problema:

1. Solo los eventos **nuevos** (post-pipeline Gemini 2.5) tienen ese campo estructurado.
2. Eventos viejos (de febrero en adelante) tienen el vet en campos distintos: `provider`, `doctor`, `veterinarian`, a veces solo en el raw text.
3. Resultado: la sección aparece vacía aunque la mascota tenga años de historial con vets.

**Objetivo**: extraer el vet (nombre, clínica, matrícula, teléfono, email) de **todos los archivos ya subidos** y surfacearlo en UI.

## Alcance

- IN: pets del user, documentos ya procesados (`medical_events` con `attachmentUrl`), correos ingestados (si hay).
- OUT: extracción de vets desde nuevos uploads (ya cubierto por el pipeline de ingesta actual).

## Arquitectura propuesta

### Nueva subcolección: `pets/{petId}/extractedVets/{vetDocId}`

Schema:
```ts
interface ExtractedVet {
  id: string;                    // hash(name + clinic) normalizado
  name: string;                  // "Dr. Juan Pérez"
  clinic?: string;               // "Veterinaria San Martín"
  license?: string;              // matrícula
  phone?: string;
  email?: string;
  firstSeenAt: Timestamp;        // primera vez que aparece en algún evento
  lastSeenAt: Timestamp;         // último evento donde aparece
  eventCount: number;            // cuántos eventos lo mencionan
  sourceEventIds: string[];      // para auditoría/debug
  confidence: "high" | "medium" | "low";  // según qué tan estructurado vino
}
```

**Por qué subcolección y no array en el pet doc:**
- Array en pet → tope ~1MB, queries imposibles
- Subcolección → paginación, ordering, growth ilimitado

### Cloud Function: `extractVetsFromArchives`

Callable, region us-central1. Input: `{ petId }`. Autorización: `context.auth.uid === pet.ownerId || context.auth.uid in coTutorUids`.

**Lógica:**
1. Traer todos los `medical_events` where `petId == input.petId`
2. Para cada evento, extraer vet según qué campo exista:
   - **Path A (eventos nuevos):** `event.extractedData.masterPayload.document_info.{veterinarian_name, veterinarian_license, clinic_name, phone, email}` — si hay → no re-procesar, usar directo
   - **Path B (eventos viejos sin masterPayload):** re-llamar Gemini con el `rawText` o el `attachmentUrl` del evento, prompt específico:
     > "Del documento veterinario, extrae SOLO: nombre del vet (con título Dr/Dra si está), clínica, matrícula, teléfono, email. Devolvé JSON. Si no se identifica alguno, null. No inventes."
3. Normalizar: trim, lowercase el email, format tel argentino/internacional.
4. Dedup por `hash(normalizeName(name) + normalizeName(clinic))`. Si ya existe en `extractedVets` → update (`lastSeenAt`, `eventCount++`, append `sourceEventId`). Si no → create.
5. Return `{ processed: N, vetsFound: M, newlyAdded: K }`.

**Rate limit Gemini**: procesar en batches de 5 con delay, para evitar timeout de Cloud Function (max 9min).

**Idempotencia**: si el mismo evento se procesa 2 veces, no se duplica (el dedup por `hash(name+clinic)` + el check de `sourceEventIds` lo garantizan).

### Client: trigger + UI

1. **Auto-trigger one-shot**: cuando el user entra a `/buscar-vet` y `extractedVets` está vacía para el pet activo → spinner + llamar CF. Máximo 1 vez por pet (flag en localStorage `pessy_vets_extracted_{petId}`).
2. **Botón manual "Actualizar lista"**: en `/buscar-vet`, abajo de "Tus veterinarios". Fuerza re-corrida de la CF (limpia flag).
3. **Auto-trigger incremental**: después de cada `addEvent` exitoso, si el evento tiene `extractedData.masterPayload.document_info.veterinarian_name` → upsertear directo desde cliente (sin CF), más rápido.

### UI en `TreatingVetsList`

Reemplazar la lógica que hoy lee `events` por query a `pets/{petId}/extractedVets` ordenado por `lastSeenAt desc`. Cada vet aparece como card:
- Avatar inicial + nombre + clínica
- Chips: matrícula · tel (tap → `tel:`) · email (tap → `mailto:`)
- Badge "Te atendió N veces" si `eventCount >= 2`
- Sin data → no render (ya está hoy)

## Plan de implementación

| Fase | Qué | Tiempo | Gate |
|---|---|---|---|
| **A** | Schema + subcolección + security rules | 30min | aprobar acá |
| **B** | Cloud Function `extractVetsFromArchives` | 2h | A ✅ |
| **C** | Client hook + botón "Actualizar" | 1h | B desplegada |
| **D** | Refactor `TreatingVetsList` para leer subcolección | 45min | C funcionando |
| **E** | Auto-trigger incremental al addEvent | 30min | D ✅ |
| **F** | Backfill para pets existentes (admin script one-shot) | 1h | Todo OK |

Total: ~6h. Hacedero en 1 día.

## Riesgos

1. **Costo Gemini**: si un user tiene 100 eventos viejos, son 100 llamadas a Gemini. A $0.0001 input + $0.0004 output por llamada ≈ $0.05 por user. Aceptable.
2. **Rate limit Firestore**: 500 writes/sec por colección. Con batch de 5 vets por segundo estamos muy debajo.
3. **Falsos positivos**: Gemini puede extraer "Dr. García" de una receta que menciona al dr de un producto, no al emisor. Mitigación: `confidence` field + ranking en UI (prioridad por `eventCount`).
4. **Datos sensibles**: email/tel de vets son datos profesionales públicos. No hay issue legal (no es data del paciente).

## Veterinarios PRESTADORES vs ATENDIERON

Aclaración importante para evitar confusión:

| Concepto | Fuente | Colección |
|---|---|---|
| **Te atendieron** (extraído de archivos) | IA sobre tus docs | `pets/{id}/extractedVets/` |
| **Prestadores en Pessy** (agenda turnos) | Vets que se registran | `vetProfiles` (ya existe) |

En UI van en 2 secciones separadas de `/buscar-vet`:
1. **Tus veterinarios** (arriba) — los que ya te atendieron
2. **Verificados en Pessy** (abajo) — los que ofrecen turnos

Los de #2 se onboardean por panel web (`tiendas.pessy.app` / `vets.pessy.app`) — **POSTPONE**, no está en scope de este spec.

## Non-negotiables

- Solo data real extraída de documentos del user.
- NO inventar vets.
- NO mostrar sección si está vacía.
- Si Gemini extrae algo con confidence "low" → omitir o marcar claramente.

## Decisiones pendientes para el dueño

1. ¿Auto-trigger al entrar en `/buscar-vet` la primera vez, o solo botón manual?
2. ¿Mostrar vets con solo 1 aparición, o requerir mínimo 2 apariciones (`eventCount >= 2`)?
3. ¿Procesar también correos ingestados (`gmail/ingestion`) o solo medical_events "oficiales"?
