# 🚀 Sprint — Abril 22, 2026 (Update)

**Branch**: `fix/deploy-force` → PR #33 → `main`
**Foco del día**: Core promise. Upload → entender → guardar → **ver claro**.

---

## 🩺 Diagnóstico clave (agente de regresión)

Pessy creció 10× en código, **sin mejorar el core**.

| Archivo | Antes (Feb) | Hoy | Factor |
|---|---|---|---|
| `MedicalContext.tsx` | 223 | 1905 | 8.5× |
| `functions/index.ts` | 230 | 2781 | 12× |
| `clinical/` subfolder | 0 | 5016 | ∞ |

**Consecuencia**: el flujo de upload tiene 5 stages, 3 remapeos, 4 colecciones en cascada, y 2 crons compensatorios. El usuario no ve mejor salida — solo más fricción y resultados rotos (PDF ilegible, timeline con emails crudos, turnos de 2023 como "próximos").

---

## ✅ Hecho hoy

### Export PDF — rehecho de cero
De **dump técnico de 3 páginas** → **narrativa clínica de 1 página**.

**Filtros semánticos nuevos:**
- Kill `%Ï`, `> reply` threads, "Sin interpretación confirmada"
- Email jamás como veterinario (`isEmailLike` guard)
- Agenda próxima: solo `date >= hoy` (adiós recordatorios de 2023)
- Medicamento ↔ Condición: linkea vía `sourceEventId → diagnosis`
- Vets: dedupe por nombre, sin emails, con matrícula + clínica
- Estudios: solo los que tienen interpretación real (máx 6)

**Nueva estructura del PDF:**
1. Estado actual (narrativa)
2. Diagnósticos principales
3. Medicación actual (`Pimobendan · 3/4 comp · cada 12h (para cardiomiopatía dilatada)`)
4. Próximo turno
5. Resumen clínico reciente (últimos 60 días, agrupado por tipo)
6. Veterinarios tratantes
7. Estudios relevantes
8. Alertas

### Extracción visible
`DocumentScannerModal` ahora muestra **"Lo que se encontró"** antes de confirmar — veterinario, fecha, clínica, hallazgo, medicación.

---

## 🧹 En curso (agentes paralelos)

| Agente | Tarea | Archivo |
|---|---|---|
| A | Remover mail-sync dead code | `MedicalContext.tsx` |
| B | Quitar inyección NotebookLM en cada Gemini call | `functions/src/index.ts` |
| C | Simplificar DocumentScannerModal — kill `treatment_questions` wizard | `DocumentScannerModal.tsx` |

**Impacto esperado**: -800+ líneas, flujo de upload de 5 stages → 3 stages, un Gemini call menos pesado.

---

## 📋 Pendiente (ordenado por impacto)

### Must antes del launch
- [ ] `generateAIOverview()` — 1 oración arriba del PDF ("Thor está en tratamiento cardíaco activo...")
- [ ] Eliminar `ClinicalReviewScreen` + `VerifyReportScreen` (351 + 262 líneas)
- [ ] Mover `upsertClinicalBrainFromEvent` fuera del upload path (fire-and-forget o matar)
- [ ] Kill crons compensatorios `reconcileExistingTreatments` + `recomputeClinicalAlertsDaily`
- [ ] Fix timeline en PWA — los mismos filtros del export aplicados al `Timeline.tsx`

### DNS pendientes (manual)
- [ ] `_mta-sts.pessy.app TXT "v=STSv1; id=20260421"`
- [ ] `_smtp._tls TXT "v=TLSRPTv1; rua=mailto:dmarc@pessy.app"`
- [ ] `default._bimi TXT "v=BIMI1; l=https://pessy.app/.well-known/bimi.svg"`
- [ ] `_dmarc` → `p=quarantine; pct=25`

### Otros
- [ ] `VITE_GOOGLE_PLACES_KEY` en GitHub Variables
- [ ] Firebase Storage CORS (`storage.cors.json`)
- [ ] Resend DKIM para `pessy.app`
- [ ] Merge PR #33 a main tras QA

---

## 🧠 Reglas aprendidas (consolidadas)

1. **Jamás score/rating numérico de salud** sin pedirlo
2. **Jamás cambiar semántica de "mascota activa"**
3. **Jamás agregar alertas UI** sin pedirlo
4. **Core = upload → entender → guardar → ver claro**. Si no mejora esos 4 outcomes → no va al launch.
5. **El export no es un dump, es una historia clínica** en 30 segundos.

---

_Última actualización: 2026-04-22 noche — Claude + Mauri_
