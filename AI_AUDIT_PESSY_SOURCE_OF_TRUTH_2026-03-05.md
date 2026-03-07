# AI Audit - PESSY Clinical Brain (Source of Truth vs Generativo)

Fecha: 2026-03-05

## 1. Problem and Targets

- User goal: validar que el cerebro clínico de PESSY prioriza evidencia canónica sobre texto generativo.
- Quality target: narrativa AI no debe alterar hechos clínicos estructurados.
- Latency target: mantener pipeline asíncrono sin bloquear por errores parciales de OCR/IA.
- Cost target: IA en backend con control de cuota y fallback seguro.
- Hard constraints: seguridad clínica, trazabilidad por evento, privacidad de datos.

## 2. System Boundaries

- Inputs:
  - emails + adjuntos en ingesta Gmail
  - documentos manuales en cliente
- Retrieval/context:
  - contexto de mascota y metadata de adjuntos
- Tools/actions:
  - clasificación/extracción con Gemini en backend
  - consolidación de entidades clínicas derivadas
- Output schema:
  - `medical_events`, `treatments`, `medications`, `appointments`, `clinical_conditions`, `clinical_alerts`
- Sensitive data handling:
  - payload temporal cifrado en colecciones `*_tmp`

## 3. Current Truth Model (observado)

Fortalezas:
1. El cerebro clínico prioriza `masterClinical` cuando existe y usa fallback legacy restringido por tipo de documento.
   - Evidencia: `/src/app/utils/clinicalBrain.ts:150`, `:153-170`, `:354-383`.
2. Se congela snapshot normalizado con `protocolSnapshotFrozenAt` para evitar mutaciones posteriores del evento confirmado.
   - Evidencia: `/src/app/contexts/MedicalContext.tsx:267-286`.
3. En ingesta Gmail existe gate de confianza/revisión antes de persistir eventos en dominio.
   - Evidencia: `/functions/src/gmail/clinicalIngestion.ts:2323-2351`, `:2399-2431`.

Brechas:
1. Doble camino de verdad: el flujo Gmail persiste entidades directo en backend sin pasar por el freeze de snapshot del flujo cliente.
   - Riesgo: deriva de representación entre eventos importados y eventos confirmados manualmente.
   - Evidencia: `/functions/src/gmail/clinicalIngestion.ts:2957-3088` vs `/src/app/contexts/MedicalContext.tsx:261-286`.
2. `structured_medical_dataset` guarda `validated_event` aun en casos que fueron a review (no necesariamente validados por humano).
   - Riesgo: contaminación de dataset para tuning/aprendizaje.
   - Evidencia: `/functions/src/gmail/clinicalIngestion.ts:2422-2429`, `:2942-2954`.
3. La UI usa `aiGeneratedSummary` como fallback narrativo en varios renderizados, pudiendo percibirse como hecho clínico.
   - Riesgo: confusión clínica de usuario final.
   - Evidencia: `/src/app/components/Timeline.tsx:234-235`, `:261`.
4. `verified_reports` queda públicamente legible y expone campos de mascota/resumen.
   - Riesgo: privacidad/PII por URL compartida.
   - Evidencia: `/firestore.rules:231-235`, `/src/app/contexts/MedicalContext.tsx:913-918`, `/src/app/components/VerifyReportScreen.tsx:20-25`, `:152-160`.
5. `updateEvent` no dispara re-upsert del cerebro clínico, solo sincroniza turno.
   - Riesgo: inconsistencia entre evento editado y entidades derivadas.
   - Evidencia: `/src/app/contexts/MedicalContext.tsx:694-712`.

## 4. Evaluation Plan

| Scenario | Dataset Slice | Metric | Threshold |
|---|---|---|---|
| Source-of-truth consistency | eventos con `masterClinical` + edición manual | % coherencia entre snapshot y entidades derivadas | >= 99% |
| Review gate safety | ingestas con confianza baja/media | % eventos de baja confianza que NO auto-ingestan | 100% |
| Narrative containment | timeline/reportes | % vistas con etiqueta clara cuando texto es AI | 100% |
| Dataset purity | `structured_medical_dataset` | % registros realmente validados por humano | >= 98% |
| Privacy leak risk | `verified_reports` | % campos sensibles expuestos públicamente | 0% no necesarios |

## 5. Safety and Reliability

- Safety controls presentes:
  - gating por confianza/review en ingesta
  - cifrado temporal para texto crudo y OCR
- Gaps:
  - falta marca explícita de “validated_by_human” en dataset
  - superficie pública de verificación con datos clínicos
- Fallback behavior:
  - fallback heurístico existe y tiende a review (positivo), pero requiere monitoreo de ratio
- Logging and traceability:
  - hay metadatos por adjunto/evento, pero falta contrato único de canonical lineage por ambos caminos (manual y Gmail)

## 6. Rollout Plan

1. Stage 0 (offline eval)
- agregar campos `source_truth_level` y `validated_by_human` en dataset/entidades
- test de coherencia evento -> entidades derivadas

2. Stage 1 (limited traffic)
- endurecer `verified_reports` con payload redaccionado y expiración
- habilitar etiquetas UI: “resumen IA” vs “dato confirmado”

3. Stage 2 (full rollout)
- unificar pipeline Gmail/manual con contrato de snapshot canónico compartido
- monitorear métricas de drift y revisión humana semanalmente

Rollback triggers:
- suba de falsos positivos clínicos
- caída de coherencia canónica
- incidentes de privacidad en enlaces públicos

## 7. Risks and Open Questions

- ¿`structured_medical_dataset` se usa para entrenamiento/fine-tuning interno? Si sí, bloqueo inmediato de registros no validados.
- ¿Se requiere link público para `verified_reports` o puede migrarse a token efímero con redacción estricta?
- ¿Se definirá una jerarquía oficial de verdad por campo para todo el producto (backend + frontend)?

## 8. Recomendación Ejecutiva

PESSY tiene una base sólida de extracción y consolidación clínica, pero hoy conviven dos rutas de verdad y una capa narrativa que puede confundirse con dato canónico en UI/reportes. La prioridad es unificar contrato de source-of-truth, marcar validación humana explícita y cerrar exposición pública innecesaria en verificación de reportes.
