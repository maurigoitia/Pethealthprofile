# Manual Constitucional del Cerebro de PESSY

Fecha: 2026-03-07

## Objetivo

Blindar la extracción clínica de PESSY para que la IA funcione como procesador de evidencia y no como generador de hechos. La meta operativa es priorizar seguridad clínica, trazabilidad por `userID` y `petID`, y bloquear mutaciones automáticas cuando la evidencia sea ambigua.

## Reglas de Hierro

1. Prohibición de inferencia de dosis
- Una medida anatómica, volumen, diámetro o valor físico nunca puede convertirse en medicamento o dosis.
- Si no existe un fármaco explícito, el objeto `medication` debe quedar vacío y el evento pasa a revisión.

2. Segmentación clínica atómica
- Hallazgos y diagnósticos deben vivir en campos estructurados (`diagnosis`, `lab_results`, `imaging_findings`, `masterClinical`).
- No se aceptan hallazgos médicos enterrados en notas o narrativa libre.

3. Filtro anti-históricos
- Calendarios de vacunación, referencias informativas, texto educativo o menciones históricas no crean tratamientos activos.
- Si el documento solo aporta contexto histórico, se marca para revisión humana.

4. No sobrescritura por contradicción
- Un hallazgo nuevo que contradice el estado clínico del `petID` no sobrescribe el Smart Profile.
- El sistema debe abrir revisión o conflicto antes de consolidar.

5. Narrativa AI no canónica
- `aiGeneratedSummary` es apoyo de lectura, no fuente de verdad.
- Exportes, dashboards y cards clínicas deben priorizar datos estructurados validados.

## Pipeline Operativo

1. Extracción de hechos
- OCR / Vision extrae texto bruto.
- Gemini devuelve solo JSON estructurado.

2. Validación constitucional
- Se filtran falsos positivos de medicación.
- Se revisa si el contenido parece histórico.
- Se bloquean hallazgos no estructurados.

3. Gate de confianza
- Si la confianza es menor a `85%`, si falta estructura o si hay contradicción potencial, el evento queda en `needs_review`.

4. Commit gate
- Solo evidencia estructurada válida puede mutar `medical_events`, `treatments`, `medications` y derivados.
- Todo lo ambiguo va a revisión.

## Perillas Técnicas

- Temperatura de extracción clínica: `0.1`
- Salida: JSON estricto
- Separación explícita entre:
  - `medical_events` / entidades consolidadas
  - `pending_actions`, `gmail_event_reviews`, `clinical_review_drafts`
- Error de permisos o inconsistencia crítica: fallback a estado controlado de revisión requerida

## Touchpoints del Repo

- Prompt de análisis manual: `functions/src/index.ts`
- Prompt de Gmail clínico: `functions/src/gmail/clinicalIngestion.ts`
- Prompt del grounded brain: `functions/src/clinical/groundedBrain.ts`
- Sanitización post-modelo: `functions/src/gmail/clinicalIngestion.ts`
- Contención de narrativa AI en UI:
  - `src/app/components/HealthReportModal.tsx`
  - `src/app/components/ExportReportModal.tsx`
  - `src/app/components/Timeline.tsx`
  - `src/app/components/MedicationsScreen.tsx`
  - `src/app/components/ActionTray.tsx`

## Estado Implementado en Este Hotfix

- Se bloquearon medicaciones sin fármaco explícito.
- Se bajó la temperatura de extracción Gmail.
- Se dejó de copiar narrativa AI a observaciones canónicas en la ruta Gmail.
- Se endureció la revisión para contenido histórico o hallazgos no estructurados.
- Se redujo la exposición de narrativa AI en PDF, health report y cards de revisión.

## Próxima Fase Recomendada

1. Crear entidad explícita `clinical_conflict`.
2. Agregar pantalla de resolución para `sync_review`.
3. Medir precisión por dataset real de Thor y cohortes QA.
4. Versionar prompts y evals con suite adversarial.
