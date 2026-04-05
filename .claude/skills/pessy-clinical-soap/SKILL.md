---
name: pessy-clinical-soap
description: Organizes ALL pet clinical data into SOAP note format for Pessy. Use when building medical profiles, summaries, PDF exports, Timeline views, or any clinical data presentation. SOAP = Subjective, Objective, Assessment, Plan.
type: implementation
---

# Pessy Clinical SOAP Skill

## What This Skill Does

Every pet profile, medical summary, PDF export, and Timeline view in Pessy MUST be organized using the SOAP note format adapted for veterinary use. SOAP is the international clinical standard: it separates what the owner *reports* (S) from what the *data shows* (O) from what Pessy *thinks* (A) from what *should happen next* (P).

This skill governs how agents read, organize, and present clinical data in Pessy.

---

## Core Rules

1. **Always organize pet data in SOAP format** — every summary, profile block, or report follows this structure.
2. **Never show raw ingestion metadata to users** — no Firestore document IDs, no `createdAt` timestamps, no `source: "email"` labels. Show meaning, not plumbing.
3. **Always prioritize S and A sections** — these are what the owner cares about most (their observations) and what Pessy thinks (the intelligence output).
4. **Use real Firestore data only** — never invent symptoms, diagnoses, medication names, or dates. If data is missing, say "No data available" — do not hallucinate.
5. **PDF exports follow SOAP format** — header: S → O → A → P, one section per page or clearly delineated.
6. **Timeline groups by Assessment (episodes/conditions)**, not by date — a cardiac episode groups all related events regardless of when they happened.

---

## AI Usage Minimization (Core Principle)

**Goal: 80%+ of documents processed WITHOUT calling Gemini AI.**

Process documents in this priority order and stop at the first level that works:

| Priority | Method | When to Use | AI Cost |
|----------|--------|-------------|---------|
| 1 | **OCR + structured parsing** | PDFs with tables, blood panels, lab reports → extract text, then regex/JSON parse | NONE |
| 2 | **Direct JSON parsing** | Structured API responses, already-typed Firestore data | NONE |
| 3 | **Keyword heuristics** | Classify document type (invoice vs. lab vs. vaccination) by keyword matching | NONE |
| 4 | **Template matching** | Known vet report formats (e.g., Banfield, Vetco) → extract fields with templates | NONE |
| 5 | **Gemini AI — LAST RESORT** | Free-text clinical narratives that cannot be parsed by any of the above | API COST |

**Implementation rule:** Every ingestion pipeline function MUST attempt steps 1–4 before calling `clinicalAi.ts`. If a document was processed without Gemini, log `aiUsed: false`. Track this metric in Firestore. Aim for `aiUsed: false` on ≥80% of ingested documents.

Files that enforce this:
- `functions/src/gmail/ingestion/clinicalNormalization.ts` — normalization without AI
- `functions/src/gmail/ingestion/clinicalFallbacks.ts` — fallback parsing before AI
- `functions/src/gmail/ingestion/clinicalAi.ts` — AI extraction (last resort only)
- `functions/src/gmail/ingestion/routingSummary.ts` — routing decision log

---

## SOAP Sections — Pessy Implementation

### S — Subjective (What the Owner Reports)

**Definition:** Information that comes from the owner's perception — not measured, not lab-confirmed. It is still clinically valuable because owner observations often precede objective findings.

**Pessy data sources:**
- `users/{uid}/pets/{petId}/dailyCheckins/` — daily check-in entries ("Thor didn't eat well today", energy level 2/5)
- `users/{uid}/pets/{petId}/` — personality data from onboarding quiz (anxious, playful, calm)
- Pessy Piensa responses — free-text owner concerns submitted via AI chat
- Onboarding behavioral history — known triggers, fears, routines
- Historical check-in trends — patterns over time (e.g., consistently low appetite on Mondays)

**Display rule:** Show as owner voice, not clinical jargon. "Dueño reporta: Thor no comió bien hoy y estuvo menos activo de lo normal."

**Component:** `src/app/components/home/PessyDailyCheckin.tsx`, `src/app/components/home/PessyQuestion.tsx`

**Example S block:**
```
SUBJETIVO
• Dueño reporta baja apetencia desde hace 3 días
• Energía: 2/5 (lunes y martes), 3/5 (miércoles)
• Personalidad: ansioso, sensible a ruidos fuertes
• Preocupación reciente: "se rasca mucho la oreja derecha"
```

---

### O — Objective (What the Data Shows)

**Definition:** Measurable, verifiable clinical data — lab results, imaging, vital signs, medication records. This is what was *observed and recorded* by a veterinary professional or diagnostic system.

**Pessy data sources:**
- `medical_events` Firestore collection — all email-ingested medical documents
  - `type: "lab_result"` — blood panels, urinalysis, fecal tests
  - `type: "imaging"` — X-rays, echocardiograms, ultrasounds
  - `type: "vaccination"` — vaccination records with dates and next due dates
  - `type: "medication"` — prescriptions with dose, frequency, duration
  - `type: "appointment"` — vet visit summaries
- Weight/measurements if present in records
- Vital signs if captured (heart rate, temperature from vet notes)

**Display rule:** Show values with units and reference ranges when available. Flag out-of-range values. Never show document IDs or ingestion metadata.

**Components:** `src/app/components/medical/Timeline.tsx`, `src/app/components/medical/ClinicalProfileBlock.tsx`, `src/app/components/medical/VaccinationCardModal.tsx`, `src/app/components/medical/MedicationsScreen.tsx`

**Example O block:**
```
OBJETIVO
• Hemograma (15 feb 2026): Hematocrito 38% [ref: 37-55%] ✓
  Leucocitos 12,800/μL [ref: 6,000-17,000] ✓
  Plaquetas 89,000/μL [ref: 200,000-500,000] ⚠ BAJO
• Vacuna Rabia: administrada 10 ene 2025 — VENCIDA (venció 10 ene 2026)
• Vacuna DA2PPv: al día — próxima: 10 ene 2027
• Medicamento activo: Prednisona 5mg c/24h — inicio 1 mar 2026
```

---

### A — Assessment (What Pessy Thinks)

**Definition:** Pessy's clinical intelligence output — pattern recognition, episode compilation, risk flags, breed-specific concerns. This is Pessy's added value on top of raw data.

**Pessy data sources:**
- `src/domain/intelligence/pessyIntelligenceEngine.ts` — intelligence engine output
- `functions/src/clinical/episodeCompiler.ts` — groups related events into clinical episodes
- `functions/src/clinical/canonicalEventPolicy.ts` — canonical event classification rules
- `src/domain/groundedBrain.ts` — grounded (factual) clinical reasoning
- Chronic condition identification (recurring patterns in medical_events)
- Risk flags: expired vaccines, potential medication interactions, out-of-range labs
- Breed-specific predispositions (e.g., Golden Retrievers → cardiac, hip dysplasia)

**Display rule:** State as Pessy's inference, not as a diagnosis. Use "Pessy detecta..." or "Señal de alerta:". Never present assessments as veterinary diagnoses.

**Component:** `src/app/components/medical/ClinicalProfileBlock.tsx`, `src/app/components/pet/PetHomeView.tsx`

**Example A block:**
```
ANÁLISIS PESSY
• Episodio activo: Trombocitopenia — plaquetas bajas en 2 de 3 últimos hemogramas
• Condición crónica identificada: Dermatitis alérgica recurrente (3 episodios en 12 meses)
• ⚠ Alerta: Vacuna antirrábica VENCIDA — riesgo legal en viajes
• ⚠ Alerta: Prednisona activa — monitorear glucosa y peso mensualmente
• Raza (Labrador): Predisposición a displasia de cadera — recomendar control radiológico anual
• Semáforo: 🟡 AMARILLO — requiere atención, no emergencia
```

---

### P — Plan (What Should Happen Next)

**Definition:** Actionable next steps — treatments in progress, upcoming appointments, overdue actions, recommended follow-ups.

**Pessy data sources:**
- `appointments` collection — scheduled vet visits
- `pending_actions` collection — overdue or recommended actions
- Active medications with end dates
- Vaccination due dates (from O section, surfaced as action items)
- Treatment tracking from medical_events
- Pessy-generated recommendations based on Assessment

**Display rule:** Ordered by urgency (overdue first, then upcoming, then recommended). Use clear dates. Never include items without a source.

**Components:** `src/app/components/appointments/AppointmentsScreen.tsx`, `src/app/components/reminders/RemindersScreen.tsx`, `src/app/components/medical/ExportReportModal.tsx`

**Example P block:**
```
PLAN
URGENTE
• ✗ VENCIDO: Revacunar antirrábica (venció 10 ene 2026) — coordinar cita

PRÓXIMOS
• Cita: Control hematológico — 30 mar 2026 (solicitada por Dr. López)
• Cita: Revisión dermatológica — 15 abr 2026

TRATAMIENTO ACTIVO
• Prednisona 5mg — continúa hasta 30 mar 2026
  Monitoreo: peso y glucosa semanales

RECOMENDADO POR PESSY
• Radiografía caderas — control anual en Labrador >3 años
• Repetir plaquetas en 30 días para confirmar tendencia
```

---

## PDF Export Format

The PDF export (`src/app/components/medical/ExportReportModal.tsx`) MUST follow this layout:

```
[Page 1] Header: Pet name, breed, age, owner, date generated
[Section 1] S — SUBJETIVO: check-in summary, owner concerns
[Section 2] O — OBJETIVO: labs table, vaccines table, medications list, imaging
[Section 3] A — ANÁLISIS PESSY: episode summaries, alerts, semáforo
[Section 4] P — PLAN: urgente → próximos → tratamiento activo → recomendado
[Footer] "Generado por Pessy. No reemplaza diagnóstico veterinario profesional."
```

---

## Timeline Format

The Timeline (`src/app/components/medical/Timeline.tsx`) MUST group events by **Assessment episode/condition**, not by date.

```
Timeline structure:
├── [Episodio] Trombocitopenia
│   ├── Hemograma 15 feb 2026 → plaquetas 89,000 ⚠
│   ├── Hemograma 10 dic 2025 → plaquetas 95,000 ⚠
│   └── Inicio Prednisona 1 mar 2026
├── [Episodio] Dermatitis Alérgica
│   ├── Consulta 5 ene 2026 → diagnóstico dermatitis
│   ├── Consulta 3 ago 2025 → recurrencia
│   └── Consulta 12 mar 2025 → primer episodio
└── [Vacunas] Estado vacunal
    ├── ✗ Rabia — VENCIDA
    └── ✓ DA2PPv — al día
```

---

## Firestore Collection Reference

| Collection | SOAP Section | Key Fields |
|-----------|-------------|-----------|
| `users/{uid}/pets/{petId}/dailyCheckins/` | S | `date`, `energy`, `appetite`, `mood`, `notes` |
| `users/{uid}/pets/{petId}/` | S | `personality`, `breed`, `birthDate`, `conditions` |
| `medical_events` | O | `type`, `date`, `petId`, `uid`, `extractedData`, `aiUsed` |
| `medical_events` where `type=lab_result` | O | `results[]`, `labName`, `referenceRanges` |
| `medical_events` where `type=vaccination` | O | `vaccineName`, `administeredDate`, `nextDueDate` |
| `medical_events` where `type=medication` | O | `drugName`, `dose`, `frequency`, `startDate`, `endDate` |
| `appointments` | P | `date`, `reason`, `vetName`, `status` |
| `pending_actions` | P | `action`, `dueDate`, `priority`, `status` |

---

## Component File Reference

| Component | Role in SOAP |
|-----------|-------------|
| `src/app/components/home/PessyDailyCheckin.tsx` | Captures S data |
| `src/app/components/home/PessyQuestion.tsx` | Captures S data (Pessy Piensa) |
| `src/app/components/home/HomeScreen.tsx` | Displays S + A summary |
| `src/app/components/pet/PetHomeView.tsx` | Full pet SOAP summary view |
| `src/app/components/medical/ClinicalProfileBlock.tsx` | O + A display |
| `src/app/components/medical/Timeline.tsx` | O grouped by A episodes |
| `src/app/components/medical/VaccinationCardModal.tsx` | O — vaccination O section |
| `src/app/components/medical/MedicationsScreen.tsx` | O + P — medications |
| `src/app/components/appointments/AppointmentsScreen.tsx` | P — upcoming/past |
| `src/app/components/reminders/RemindersScreen.tsx` | P — overdue actions |
| `src/app/components/medical/ExportReportModal.tsx` | Full SOAP PDF export |
| `src/domain/intelligence/pessyIntelligenceEngine.ts` | Generates A section |
| `functions/src/clinical/episodeCompiler.ts` | Groups O into A episodes |
| `functions/src/clinical/canonicalEventPolicy.ts` | A — classification rules |

---

## What NOT to Do

- **Do not show**: `documentId`, `createdAt`, `source: "email"`, `ingestionJobId`, `rawText`, `embedding`
- **Do not invent**: any symptom, medication, lab value, date, or diagnosis not present in Firestore
- **Do not use dates alone to organize**: always group by clinical episode/condition (Assessment), then sort by date within the group
- **Do not call Gemini**: for data that can be parsed with regex, templates, or keyword heuristics
- **Do not mix sections**: S is owner-reported, O is objective data — do not mix them
