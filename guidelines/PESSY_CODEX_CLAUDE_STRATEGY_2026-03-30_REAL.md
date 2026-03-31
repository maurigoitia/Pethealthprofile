# PESSY — Estrategia Real Codex + Claude

> Versión corregida para este repo real
> 30 marzo 2026

## 1. Contexto correcto

PESSY hoy corre sobre:
- `React + Vite + TypeScript`
- `Firebase Functions`
- `Firestore`
- `PWA`

No es un proyecto Flutter.

La estrategia de agentes tiene que respetar eso:
- Codex para volumen técnico y backend
- Claude para diseño, UX, narrativa y criterio de producto

## 2. Regla general

### Darle a Codex

- email ingestion
- parsers de adjuntos
- multi-appointment extraction
- dedup de forwards
- bloqueo de mails humanos
- tests
- refactors
- Firebase Functions
- setup de Capacitor
- QA técnico reproducible

### Dejar en Claude

- branding
- login visual
- Cork/Fritz/cartoons
- historial / estudios / tratamientos a nivel presentación
- copy clínico
- narrativa de perfil de Thor
- decisiones de UX ambiguas

## 3. Qué conviene pasar ya a Codex en PESSY

### Backend

- clasificador de emails
- parser attachment-first
- normalización clínica
- deduplicación
- routing canónico a:
  - `medical_events`
  - `appointments`
  - `treatments`
  - `medications`

### QA y tests

- vitest de ingestion
- smoke técnico de functions
- validación de counters de sesiones Gmail
- tests de regresión para review-safe canonical events

### Mobile técnico

- crear `capacitor.config.ts`
- apuntar `webDir` a `dist`
- generar shells `ios/` y `android/`
- automatizar `build + cap sync`

## 4. Qué NO pasar a Codex sin guía visual

- rediseño del login
- iconografía
- decisión del home final
- layout de historial/estudios
- copy delicado
- diseño de comunidad/adopción

## 5. Mobile: estado real

### La máquina

Está lista:
- Flutter OK
- Android SDK OK
- Xcode OK
- CocoaPods OK

### El repo

Todavía no está listo para publicar mobile:
- no hay `capacitor.config.*`
- no hay `ios/`
- no hay `android/`
- `npm run build:mobile` falla porque Capacitor espera `./www`

Conclusión:
- el camino corto es `Capacitor`
- no conviene abrir un rewrite a Flutter salvo decisión explícita

## 6. Setup recomendado

### AGENTS.md

Mantener un `AGENTS.md` en root con:
- stack real
- reglas de scope
- deploy guardrails
- prioridades activas
- enlaces a handoffs

### Handoffs

Usar estos docs como fuente de continuidad:
- [CLAUDE_HANDOFF_EMAIL_INGESTION_2026-03-30.md](/Users/mauriciogoitia/Downloads/03_PESSY_APP/PESSY_PRODUCCION/guidelines/CLAUDE_HANDOFF_EMAIL_INGESTION_2026-03-30.md)
- [MAIL_INGESTION_CANONICAL_FLOW.md](/Users/mauriciogoitia/Downloads/03_PESSY_APP/PESSY_PRODUCCION/guidelines/MAIL_INGESTION_CANONICAL_FLOW.md)

## 7. Próximos pasos inmediatos

### Para Codex

1. Cerrar residual de ingestion:
- `ECO THOR`
- `ECO DE THOR`

2. Dejar mobile packaging real:
- `capacitor.config.ts`
- `npx cap add ios`
- `npx cap add android`
- `npm run build && npx cap sync`

3. Agregar checks reproducibles para empaquetado

### Para Claude

1. Login branding
2. Cork exacto al oficial
3. iconografía cartoon
4. historial / estudios / tratamientos visualmente separados
5. narrativa clínica del perfil

## 8. Nota sobre costos

No hardcodear precios en el repo.

Las guías de costos/modelos cambian.
Si hace falta presupuesto real:
- revisar pricing oficial vigente antes de decidir routing
- usar la guía estratégica por tipo de trabajo, no por un número fijo escrito una vez

