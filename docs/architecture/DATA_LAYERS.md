# Pessy — Arquitectura de datos en 3 capas

> **Source of truth.** Este documento describe lo que **ya existe en el código**, no una propuesta. Si encontrás drift entre este doc y el código, arregla el código o arregla el doc — nunca dejes la inconsistencia.

> **Regla de oro.** Pessy organiza la vida cotidiana con mascotas. **No es app médica, no es herramienta clínica, no es chatbot.** Esta arquitectura existe para que la app se sienta simple y útil — no para sumar complejidad técnica visible.

---

## Por qué 3 capas

El código de Pessy ya separa naturalmente:

1. **Semántica** — qué significa cada cosa (Pet, MedicalEvent, Treatment, Reminder, etc.)
2. **Adapters** — funciones puras que mapean Firestore raw → tipos semánticos
3. **Renderers / Consumers** — UI, PDF export, narrative builder, intelligence layer

El error que se repitió en los últimos sprints: tocar 2 capas a la vez intentando arreglar 1. Cada vez que pasa, el bug se duplica. Esta separación existe para que un cambio en una capa no obligue a tocar las otras.

**Antes de modificar cualquier cosa, identificá en qué capa vivís.**

---

## Capa 1 — Semántica (entidades del dominio)

Todas las entidades del dominio viven en **`apps/pwa/src/app/types/medical.ts`** (frontend) y **`functions/src/export/types.ts`** (backend, para export source-backed). Mantenerlas alineadas es responsabilidad del que toque cualquiera de las dos.

### Entidades core

| Entidad | Archivo | Resumen |
|---|---|---|
| `Pet` | `apps/pwa/src/app/contexts/PetContext.tsx` | Mascota — identidad, raza, peso, ownerId, coTutorUids, publicId (Pack ID), preferences |
| `MedicalEvent` | `apps/pwa/src/app/types/medical.ts` | Evento médico cargado por el tutor o ingresado vía email/Gmail. Tiene `extractedData` con todo lo que la IA detectó del documento. |
| `ExtractedData` | mismo | Output del motor de análisis — diagnóstico, observaciones, medicaciones, próxima cita, summary narrativo, etc. |
| `MasterClinicalPayload` | mismo | Payload estructurado v2 (`pessy_master_clinical_protocol_v1`). Contiene `document_info` (clinic, vet, license) que es la fuente para `extractedVets`. |
| `Appointment` | mismo | Turno (vivido en collection `appointments`, separado de `medical_events`). |
| `ActiveMedication` | mismo | Medicación activa derivada de un MedicalEvent. |
| `ManualReminder` | mismo | Recordatorio manual independiente del historial. Vacuna, desparasitación, control, grooming. |
| `PendingAction` | mismo | Pendiente generado automáticamente desde un MedicalEvent o el motor proactivo. |
| `ClinicalCondition` | mismo | Condición clínica longitudinal (proyección desde múltiples MedicalEvents). |
| `TreatmentEntity` | mismo | Tratamiento longitudinal (proyección desde múltiples MedicalEvents). |
| `ClinicalAlert` | mismo | Alerta clínica derivada (out_of_range, followup_not_scheduled, etc.). |
| `ExtractedVet` | `apps/pwa/src/app/hooks/useExtractedVets.ts` | Profesional veterinario detectado en el historial. Vive en `pets/{petId}/extractedVets`. |

### Modelo de provenance (3-bucket)

**Cada `MedicalEvent` tiene un origen.** El sistema lo deriva en `functions/src/export/firestoreAdapter.ts` con `deriveProvenanceSource()`:

| Provenance | Significa | Bucket |
|---|---|---|
| `vet_input` | Cargado por un veterinario directamente | `vet_document` |
| `tutor_confirmed` | Tutor revisó y confirmó | `vet_document` |
| `ai_extraction` | Extraído por IA de un documento real, sin revisar | `ai_extraction` |
| `ai_pending_review` | Idem pero marcado para revisión manual | `ai_extraction` |
| `tutor_input` | Texto libre del tutor sin documento de respaldo | `tutor_input` |

**Por qué importa:** el PDF export, la narrativa y `extractVetsFromArchives` filtran por bucket. Un nombre de vet que viene de `tutor_input` puro **no se cuenta como vet documentado** — solo lo que tiene respaldo (vet_document o ai_extraction).

### Nomenclatura — regla de tono Plano

Los tipos internos usan terminología clínica (`MedicalEvent`, `MasterClinicalPayload`, `ClinicalCondition`). **La UI nunca los muestra así.** En pantalla:

| Interno | UI |
|---|---|
| MedicalEvent | "Evento", "Documento", "Vacuna", según contexto |
| ClinicalProfile | "Historial", "Salud" |
| Master clinical / Clinical history | "Historial", "Cuidado" |

Nunca usar "clínico", "médico", "historial clínico" en copy de UI. Esto está enforced en CLAUDE.md y debe respetarse en cualquier nuevo componente.

---

## Capa 2 — Adapters (Firestore raw → semántica)

Los adapters son **funciones puras**. No conocen Firebase Admin SDK directamente — reciben una interfaz tipo `FirestoreLike` para que sean testeables sin mock pesado.

### Backend (Cloud Functions)

**`functions/src/export/firestoreAdapter.ts`**

| Función | Input | Output |
|---|---|---|
| `deriveProvenanceSource(e)` | raw event | string del bucket model |
| `bucketForProvenance(p)` | provenance | `"vet_document" \| "ai_extraction" \| "tutor_input"` |
| `mapMedicalEvent(id, raw)` | doc raw de `medical_events` | `RawEvent` con vet, license, clinic, mainFinding, medications |
| `mapAppointment(id, raw)` | doc raw de `appointments` | `RawAppointment` |
| `mapTreatment(id, raw)` | doc raw de `treatments` | `RawEvent` |
| `loadPet/MedicalEvents/Treatments/Appointments(fs, petId)` | Firestore + petId | array de tipos semánticos |

**`functions/src/clinical/extractVetsFromArchives.ts`** (el módulo nuevo)

| Función | Rol |
|---|---|
| `normalizeVetName(s)` | Lower + sin "Dr./Dra." + sin acentos. Clave de dedup. |
| `vetDocId(s)` | Firestore doc ID estable (md5 hex 24 chars). Idempotente. |
| `extractEmail(text)` / `extractPhone(text)` | Best-effort regex sobre texto libre. Retorna `null` si no encuentra — **nunca inventa**. |
| `aggregateVets(rows)` | Pure: dedup + computa confidence high/medium/low. |
| `medicalEventToSourceRow / treatmentToSourceRow / appointmentToSourceRow` | Mappers de raw → SourceRow. |
| `upsertVets(fs, petId, candidates)` | Persistencia idempotente con `set({merge:true})`. |
| `extractVetsFromArchives` | Callable que cablea todo + auth check. |

### Frontend

**`apps/pwa/src/app/hooks/useExtractedVets.ts`** suscribe a `pets/{petId}/extractedVets` ordenado por `lastSeenAt desc`. Devuelve `ExtractedVet[]` tipado, listo para consumo de UI.

**`apps/pwa/src/app/contexts/MedicalContext.tsx`** mantiene los `MedicalEvent[]` activos para el pet seleccionado, con upserts incrementales.

**Regla de capa 2:** un adapter nunca debería tener lógica de UI ni de presentación. Si necesitás formatear una fecha para mostrar, eso vive en capa 3.

---

## Capa 3 — Renderers / Consumers

Aquí viven los **consumidores** de los datos semánticos. Cada consumidor recibe el output de un adapter y produce algo: una pantalla, un PDF, un email, una alerta.

### PDF export (source-backed)

**Pipeline:** `pessyExportSourceBacked` (callable) → `loadMedicalEvents` + `loadTreatments` + `loadAppointments` (adapters) → `buildExportPayload` (renderer) → `narrativeBuilder` (sub-renderer)

| Archivo | Rol |
|---|---|
| `functions/src/index.ts:2689` | Callable `pessyExportSourceBacked` — wire entre capas, sin lógica |
| `functions/src/export/buildExportPayload.ts` | Toma RawEvents y produce `ExportPayload` con `studies`, `professionals`, `institutions`, `pendingReview`, `narrative` |
| `functions/src/export/narrativeBuilder.ts` | Construye la prosa narrativa desde el payload |
| `functions/src/export/questionFilter.ts` | Filtra preguntas sugeridas que se muestran al final |

**Acceptance criteria — no merge a producción sin pasar estos 4 casos:**

1. **Pet con datos completos** → PDF muestra timeline, profesionales, instituciones y estudios. Sin secciones vacías visibles.
2. **Pet con datos incompletos** → PDF no rompe. Las secciones sin data se omiten silenciosamente o muestran un mensaje suave (no `null`, no `undefined`, no stack trace).
3. **Pet sin historial** → PDF muestra el empty state explícito ("Aún no hay eventos cargados para esta mascota") en vez de página en blanco.
4. **Pet con muchos eventos** (>50) → PDF pagina correctamente, los headers se repiten en cada página, el TOC (si existe) está alineado.

Antes de mergear cualquier cambio que toque export, generar manualmente los 4 PDFs y abrirlos. Si alguno falla, el cambio NO va.

### Narrative extraction (interpretación de documentos)

**Pipeline actual:**
- `functions/src/gmail/ingestion/clinicalAi.ts` extrae datos crudos de un documento (PDF/imagen) usando Gemini multimodal
- `functions/src/clinical/episodeCompiler.ts` agrupa MedicalEvents en episodios narrativos con título/summary/tags en tono Pessy
- `functions/src/clinical/groundedBrain.ts` responde preguntas sobre un pet usando contexto curado

**Estado:** la extracción estructurada existe completa. La conversión a **prosa narrativa estilo "On April 12, 2026, Bruno was prescribed Amoxicillin for 7 days..."** todavía es parcial — `aiGeneratedSummary` existe pero no se renderiza con esa forma. Si esto se prioriza, el lugar de cambio es `narrativeBuilder.ts`, no la UI.

### UI (consumidor principal)

| Pantalla | Capa que consume | Notas |
|---|---|---|
| HomeScreen | MedicalContext + RemindersContext | "Día a Día" pillar |
| Timeline | MedicalContext | Render cronológico de MedicalEvents |
| ClinicalProfileBlock | proyecciones de ClinicalCondition + TreatmentEntity | Layer de inteligencia, vive detrás de la UI principal |
| VetSearchScreen | useExtractedVets + Google Places | Lista vets que trataron + cercanos |
| ExportReportModal | dispara `pessyExportSourceBacked` | UI mínima — solo trigger + status |
| VaccinationCardModal | filtro sobre MedicalEvents `eventType === "vaccine"` | Carnet visual |

**Regla de capa 3:** si un componente necesita transformar datos (parsear fecha, agrupar eventos, derivar status), ese código no debería vivir en el componente. Debería estar en `apps/pwa/src/app/utils/` o en el contexto. El componente solo recibe data lista para renderizar.

---

## Wiring entre capas

Las callables son el único lugar donde las 3 capas se tocan. **Una callable no debería contener lógica de negocio** — solo:

1. Auth check
2. Permission check (owner o coTutor)
3. Cargar datos vía adapter
4. Pasar al renderer / agregador
5. Devolver el resultado o persistir

Si una callable empieza a tener `if/else` de transformación, esa lógica debe migrar a un módulo puro testeable.

### Callables existentes que respetan este patrón

- `pessyExportSourceBacked` (PDF export)
- `extractVetsFromArchives` (vets dedup) — el módulo nuevo
- `pessyCompileRecentEpisodes` (episode compiler)

---

## Las 4 áreas de producto y dónde tocan capas

| Área | Capa 1 (semántica) | Capa 2 (adapter) | Capa 3 (renderer/UI) |
|---|---|---|---|
| **Tutores y co-tutores** | `Pet.coTutors`, `CoTutor`, invite codes | `joinWithCode`, `sendCoTutorInvite` callable | PetProfileModal, CoTutorModal |
| **Restablecer contraseña** | Firebase Auth (no entidad propia) | `authActionLinks.ts` genera URL con `handleCodeInApp:true` | ForgotPasswordScreen, ResetPasswordScreen, `/reset-password` route |
| **Export PDF** | RawEvent, ExportPayload, Study, Professional, Institution | firestoreAdapter, loadAppointments | pessyExportSourceBacked + buildExportPayload + narrativeBuilder |
| **Narrativa de documentos** | ExtractedData, MasterClinicalPayload | gmail/ingestion/clinicalAi.ts | episodeCompiler + (pendiente) narrativeBuilder enrich |

---

## Cómo trabajar respetando esto

**Antes de empezar un cambio, escribir en el PR description (o en el commit body):**

```
Capa afectada: 1 / 2 / 3 / wiring
Entidades tocadas: Pet, MedicalEvent, ...
Archivos:
  - apps/pwa/...
  - functions/src/...
Tests / casos manuales:
  - [ ] caso A
  - [ ] caso B
```

**Si el cambio toca más de una capa, pausar y preguntar: ¿es realmente necesario, o puedo aislar?**

---

## Drift conocido (lo que está documentado pero no perfecto)

- **Vacunas viven dentro de MedicalEvents** (`extractedData.documentType === "vaccine"`) en vez de tener su propia colección. El builder devuelve `loadVaccinations: () => []` por eso. Si en el futuro se separan, hay que actualizar `buildExportPayload`.
- **`pessySendCoTutorInvitation`** existe en backend pero la UI usa `sendCoTutorInvite`. El primero es código muerto — pendiente de eliminar.
- **Narrativa "humana"** (estilo "On April 12, 2026...") todavía no se genera. Lo que hay es `aiGeneratedSummary` más estructurado.
- **`pessy.app` en Firebase Auth → Authorized domains** — si no está, password reset email no se manda. Verificar en consola Firebase.

---

## Referencias en el repo

- `CLAUDE.md` — reglas globales, branch model, deploy policy
- `ENVIRONMENTS.md` — separación PWA / landing / blog
- `BRANCHES.md` — workflow de branches
- `docs/architecture/PESSY_ARQUITECTURA_ESCALABILIDAD_50K_USUARIOS.pdf` — escalabilidad

---

_Última actualización: 2026-05-03 — incorporación del módulo `extractVetsFromArchives` y de los acceptance criteria del PDF export._
