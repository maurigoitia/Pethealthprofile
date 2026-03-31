# Gmail Vet Gold Set — 2026-03-29

Corpus real de Mauricio usado para endurecer la ingesta clínica de PESSY.

## Objetivo
Fijar ejemplos reales y su routing esperado para que parser, heurísticas, tests y futuros agentes sigan la misma verdad.

## Casos canónicos

### 1. Panda — recordatorio operativo simple
- Gmail id: `19d0b48e2b038c83`
- Subject: `Recordatorio del Turno`
- Clase: `vet_operational`
- Debe producir:
  - `medical_events` canónico tipo `appointment_reminder`
  - `appointments` projection
- Campos mínimos esperados:
  - fecha `2026-03-21`
  - hora `09:45`
  - clínica `PANDA HUIDOBRO 24HS`
  - profesional `LASALA, LUCAS`

### 2. Panda — mail con múltiples actos
- Gmail id: `19ce886e2dcb7f42`
- Subject: `Información de Turno Solicitado`
- Clase: `vet_operational`
- Debe producir:
  - `3` eventos operativos, no `1`
  - `3` proyecciones a `appointments`
- Actos esperados:
  - `2026-03-21 09:45` `CONSULTA CARDIOLOGICA`
  - `2026-03-21 10:30` `ECOGRAFIA ABDOMINAL`
  - `2026-03-21 11:00` `PLACA RADIOGRAFICA SIMPLE`
- No debe producir:
  - `study_report`
  - review eterna

### 3. Panda — comprobante administrativo
- Gmail id: `19d124fe86388414`
- Subject: `Comprobante de Pago`
- Clase: `vet_administrative`
- Debe producir:
  - descarte clínico
  - opcionalmente señal administrativa/recompra futura
- No debe producir:
  - `medical_events`
  - `appointments`
  - `clinical_episodes`

### 4. Thor — estudio attachment-first
- Gmail id: `19c2e4687f93f380`
- Subject: `ECO DE THOR`
- Clase: `vet_clinical_attachment_first`
- Debe producir:
  - `medical_events` canónico tipo `study_report`
  - subtype `imaging`
- Fuente primaria:
  - `THOR.pdf`
  - JPGs adjuntos
- No debe depender de:
  - body del mail

### 5. Thor — estudio reenviado
- Gmail id: `190d12283a899b08`
- Subject: `Fwd: Radiografias de Thor`
- Clase: `vet_clinical_attachment_first`
- Debe producir:
  - `study_report`
  - dedup contra original si ya existe evento equivalente
- Fuente primaria:
  - `302042.pdf`
  - `HistoriaClinica.pdf`

## Regla principal
La clase del mail se define por evidencia clínica y estructura real, no por remitente solamente.

Orden:
1. attachment/body evidence
2. clase operativa vs clínica vs administrativa
3. canonical event
4. projection
5. episodes solo si el evento ya no está en review
