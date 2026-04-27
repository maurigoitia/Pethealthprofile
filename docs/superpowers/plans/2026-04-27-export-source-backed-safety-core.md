# Export Source-Backed Safety Core

**Status:** Draft — planning only, not approved for execution
**Owner:** Mauricio Goitia
**Created:** 2026-04-27
**Related:** PDF export, Gemini ingestion pipeline, ClinicalProfileBlock

---

## 1. Context

Pessy genera un export PDF del perfil de la mascota: vacunas, eventos médicos, tratamientos, "información faltante" y "preguntas sugeridas para el veterinario". El contenido del PDF se construye a partir de:

- Eventos en Firestore (`medical_events`, `vaccinations`, `treatments`)
- Resumen narrativo generado por Gemini sobre esos eventos
- Inputs libres del tutor (`tutor_input`) que el usuario escribe en la app

Hoy el sistema **funciona por prompt**: le pedimos a Gemini que no inventa, que no diagnostica, que no recomienda. Si el prompt falla o el modelo alucina, no hay barrera arquitectónica que lo detenga antes de imprimirse en el PDF.

## 2. Riesgo actual

**Safe by prompt, not by architecture.**

Casos reales o posibles:
- Mascota sin eventos → Gemini igual genera "narrativa" e inventa contenido plausible.
- `tutor_input` ("creo que tiene alergia") → puede aparecer como diagnóstico documentado en el PDF.
- "Preguntas sugeridas para el veterinario" → Gemini puede colar recomendaciones disfrazadas de pregunta ("¿No le convendría empezar con apoquel?").
- Copy "Información faltante" → suena a diagnóstico de carencia clínica, no a sugerencia de mejora de perfil.
- Tono general puede deslizar a clínico/médico, contradiciendo el contrato de marca Plano ("Pessy NO es app médica").

Consecuencia: un PDF que un veterinario podría leer como historia clínica formal, cuando legalmente y por marca no lo es.

## 3. Modelo source-backed requerido

Cada afirmación del PDF tiene que poder rastrearse a una fuente verificable:

| Tipo de contenido | Fuente válida | Fuente NO válida |
|---|---|---|
| Diagnóstico documentado | `medical_events.diagnosis` con `source: vet_document` | `tutor_input`, narrativa Gemini |
| Vacuna aplicada | `vaccinations` con fecha y lote | mención libre del tutor |
| Tratamiento | `treatments` con prescripción cargada | inferencia del modelo |
| Síntoma observado | `tutor_input` marcado como observación, NO como diagnóstico | conclusión del modelo sobre el síntoma |
| Preguntas para vet | template fijo + datos del perfil | sugerencias generadas libremente |

**Regla:** si un campo del PDF no tiene un `source_id` que apunte a un documento Firestore concreto, ese campo no se imprime.

## 4. Los 5 fixes obligatorios

### Fix 1 — Empty pet / no events skips Gemini

Si la mascota tiene 0 eventos médicos cargados, el pipeline NO llama a Gemini. Devuelve un template seguro:

```
Perfil de [nombre]
Especie: [...]
Raza: [...]
Edad: [...]

Aún no hay información médica cargada en Pessy.
Cuando subas documentos del veterinario, vacunas o tratamientos, este perfil se irá completando.
```

Sin narrativa generada. Sin "información faltante". Sin preguntas sugeridas.

### Fix 2 — Definir "documentado literalmente"

Un dato es "documentado" sólo si:
- Existe en una colección Firestore que registra evidencia (medical_events, vaccinations, treatments, lab_results)
- Tiene un `source` ∈ {`vet_document`, `vaccination_card`, `lab_pdf`, `prescription`}
- Tiene fecha y referencia (clínica, vet, archivo subido)

Cualquier otra cosa = no documentado. Va a otra sección, NUNCA a "diagnósticos documentados".

### Fix 3 — `tutor_input` no puede convertirse en `documentedDiagnoses`

Hard rule en el backend:
- `tutor_input` se almacena en `observations` o `tutor_notes`
- El builder del PDF NO lee de `tutor_input` cuando llena la sección de diagnósticos
- Validación en tipo: `documentedDiagnoses: Diagnosis[]` donde `Diagnosis.source !== 'tutor_input'`
- Test que falla si un `tutor_input` aparece como diagnóstico en el output

### Fix 4 — Filtro server-side en `suggestedQuestionsForVet`

Después de que Gemini devuelve preguntas, un filtro server-side (no prompt) elimina:
- Toda pregunta que mencione un medicamento por nombre
- Toda pregunta con verbos de prescripción ("dar", "empezar con", "subir dosis", "cambiar a")
- Toda pregunta que afirme un diagnóstico antes del signo de pregunta ("Como tiene X, ¿…?")

Lista de patrones bloqueados versionada en código, revisable, testeable. Si una pregunta se filtra, se reemplaza por template genérico ("¿Qué controles recomienda para esta etapa?").

### Fix 5 — Rename "Información faltante"

`Información faltante` → `Información que podría mejorar tu perfil`

Cambio en:
- Copy del PDF
- UI de la app donde aparece el mismo bloque
- Tono: invitación, no carencia clínica
- i18n key actualizada en todos los idiomas soportados

## 5. Plan de implementación — Backend primero

PR backend (separado, no toca UI):

1. Tipos: `Diagnosis`, `Observation`, `TutorInput` con `source` discriminado
2. Builder del export: función pura `buildExportPayload(petId) → ExportPayload`
   - Lee Firestore
   - Aplica Fix 1 (empty pet skip)
   - Aplica Fix 3 (tutor_input quarantine)
   - Llama Gemini sólo si hay eventos
   - Aplica Fix 4 (filtro server-side)
3. Tests unitarios obligatorios:
   - mascota vacía → template seguro, sin Gemini
   - mascota sólo con `tutor_input` → no aparece como diagnóstico
   - preguntas con medicamento → filtradas
   - preguntas con verbo de prescripción → filtradas
4. Logging: cada filtrada queda registrada para auditar drift del modelo
5. Sin cambios en `firestore.rules` salvo que un nuevo campo lo requiera

### Plan de implementación — Frontend después

PR frontend (consume el payload del backend, no toca lógica):

1. PDF renderer lee `ExportPayload` y nada más
2. Copy "Información faltante" → "Información que podría mejorar tu perfil" (Fix 5)
3. Empty state visual cuando el payload viene vacío
4. Sin llamadas directas a Gemini desde el cliente
5. ClinicalProfileBlock y ExportReportModal renombrados de copy si hace falta para alinear tono no-clínico

## 6. Reglas de seguridad (no negociables)

- Nunca diagnosticar
- Nunca recomendar medicación
- Nunca recomendar tratamiento
- Nunca afirmar pronóstico
- Sin pet/especie/condición hardcodeada en producción
- Lenguaje condicional siempre: "podría", "es posible que", "consultá con tu vet"
- Cualquier output que no pase el filtro server-side se reemplaza por template, nunca se imprime crudo

## 7. QA

QA con mascota real del founder (Mauricio Goitia, AR). Thor se usa **sólo como caso de QA**, no como dato hardcodeado en lógica del producto.

Casos a probar:
1. Mascota vacía recién creada → PDF sin narrativa, sin Gemini llamado (verificar logs)
2. Mascota con 1 vacuna real → PDF muestra vacuna, no inventa nada más
3. Mascota con `tutor_input` "creo que está con alergia" → NO aparece como diagnóstico
4. Mascota con eventos reales → preguntas sugeridas no contienen medicamentos
5. Cambio de copy "Información faltante" verificado en PDF y en app
6. Test de regresión: tomar 3 perfiles previos, regenerar PDF, comparar diff

QA pasa = backend PR + frontend PR pueden mergear a `develop`. Producción sólo después de un sprint en staging.

## 8. Out of scope (este plan)

- Phase 4 mobile move
- PR #24 surgical cleanup
- Staging real (ver `staging-real-roadmap.md`)
- Cambios a auth/login/firebase.ts
- Nuevas features de export (firmas, sellos, etc.)

## 9. Definición de done

- 5 fixes implementados y con test
- Backend PR mergeado a `develop`
- Frontend PR mergeado a `develop`
- QA con mascota real firmado
- Copy actualizado en i18n
- Nada de export-source-backed depende de Thor ni de ningún pet hardcodeado
