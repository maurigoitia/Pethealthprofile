# Pessy Trust Layer — Smart Ingestion (Fase 3 v2)

**Decisión founder 2026-04-26:** descartar Fases 4 (Vet Web App) y 5 (Vet Mode app B2B) hasta tener volumen.

En su lugar: **fortalecer la cadena de ingestión actual** para que la confianza salga de la fuente de los datos, no de un vet humano que tilde después.

## Por qué este pivot tiene sentido

- Hoy 95% de los datos entran por email/PDF de veterinarias
- Ya tenemos un pipeline (clinicalAi.ts, extractVets.ts) — falta capa de TRUST
- Si el email viene de `@clinica-norte.com.ar` con firma "MV. Ana Pérez MP 1234", podemos asignar `high confidence` SIN intervención humana
- Eso te da el "Validado por veterinario" creíble en el PDF en semana 1, no en mes 6

## Fase 3 v2 — Smart Ingestion + Trust Layer

### Componentes

#### A. Source detection (email pipeline)
Cuando entra un email a `@inbound.pessy.app` (Gmail/Resend), antes de llamar Gemini:

```
sender.email → match contra DB de clínicas conocidas
sender.domain → heurística: si tiene "vet|clinica|hospital|animal" → high
DKIM/SPF pass → bonus
```

Resultado: `source.type ∈ {veterinary_email, lab_email, generic, unknown}`

#### B. Vet attribution (de signature + cuerpo)
Patrón regex sobre el último párrafo del email:
- `MV\.?\s+([A-ZÁÉÍÓÚÑa-záéíóúñ\s]+)` → vet name
- `M\.?P\.?\s*\d+` o `MP\s*\d+` o `Matrícula:?\s*\d+` → license
- Ya existe `extractVets.ts` que hace algo parecido — extender con scoring

Output:
```
vet: {
  name: "Ana Pérez",
  license: "MP 1234",
  detectedFrom: "email_signature" | "document_body" | "header",
  confidence: 0.0-1.0
}
```

#### C. Event type classifier
Cada documento tiene un tipo. Hoy es campo libre. Fortalecer con rules:
- `documento.title.match(/vacuna|vaccin/i)` + `documento.has(productName)` → `event_type=vaccine`, confidence high
- `subject.match(/resultado|análisis|hemograma/i)` + `pdf.has(table)` → `event_type=lab_result`, confidence high
- Nada match → `event_type=note`, confidence low

#### D. Trust scoring formula
```
trust_score = base_score(provenance.source)
            + 0.15 if vet detected
            + 0.10 if license detected
            + 0.10 if event_type matched with confidence
            - 0.20 if requiresManualConfirmation = true
            clamp [0, 1]

trust_level =
  > 0.8 → "high"  (verde, label "Detectado de fuente veterinaria")
  > 0.5 → "medium" (ámbar, label "Información extraída")
  ≤ 0.5 → "low"   (gris, label "Carga del tutor")
```

#### E. UI surfacing
**Timeline event card:**
- Badge mini al lado del título según trust_level
- High: chip verde "Fuente vet" + tooltip con vet name + license
- Medium: chip ámbar "Extraído"
- Low: chip gris "Manual"

**PDF (cada ítem en sección Estudios/Treatment/etc):**
- Sufijo en italic 7pt: "fuente: Dr. Ana Pérez (MP 1234), Clínica Norte" si vet detected
- Sin sufijo si no hay attribution

**Export modal banner:**
- Si trust_score promedio < 0.5 → mensaje "Mayoría de datos sin fuente verificable. ¿Confirmá los críticos antes?"

### Esquema de datos

```ts
interface MedicalEvent {
  // ... existing fields
  trust: {
    score: number;       // 0.0 - 1.0
    level: "high" | "medium" | "low";
    sources: {
      isVeterinaryEmail: boolean;
      hasVetSignature: boolean;
      hasLicense: boolean;
      eventTypeConfidence: number;
    };
    detectedVet?: {
      name: string;
      license?: string;
      clinic?: string;
      confidence: number;
    };
  };
}
```

### Migración

- NUEVOS events: trust se calcula en ingestion (cloud function)
- VIEJOS events: backfill function que recalcula trust offline
- Hasta backfill: `trust = null` → frontend trata como "medium" default

## Tasks (orden)

| # | Tarea | Esfuerzo | Riesgo |
|---|-------|----------|--------|
| 1 | Plan doc (este archivo) | Done | 0 |
| 2 | `functions/src/ingestion/trustScoring.ts` con helpers puros | 2 sprints | Bajo (no toca pipeline existente) |
| 3 | Integrar en clinicalAi.ts: cada extracción agrega `trust` field | 1 sprint | Medio (modifica pipeline) |
| 4 | Backfill function: recalcular trust en eventos viejos | 1 sprint | Bajo (read-only en happy path) |
| 5 | UI: badge en Timeline cards | 1 sprint | Bajo |
| 6 | PDF: sufijo "fuente: ..." en items con vet detected | 1 sprint | Bajo |
| 7 | Modal banner condicional según trust_score promedio | 0.5 sprint | Bajo |

**Total:** 6.5 sprints (~7 semanas si full-stack 1 dev).

## Métricas de éxito

- 60% de eventos nuevos con `trust.level = "high"` después de fase 3 (subir desde 0%)
- 30% reducción en eventos `requiresManualConfirmation` por mejor classifier
- PDFs ahora muestran "Detectado de fuente veterinaria" en al menos 1 sección de cada PDF promedio
- Tutor confía + comparte el PDF (medible en clicks de share)

## Out of scope

- Backend de validación humana (vet attestation por email/web) → fase 6 si hay traction
- Vet Mode app → fase 7 cuando >100 vets activos en Pessy
- Match contra DB nacional de matrículas (validación real de MP) → fase 8
