# PESSY — AGENTS.md

## Stack real del proyecto

- Frontend: `React + Vite + TypeScript`
- App actual: `PWA`
- Backend: `Firebase Functions + Firestore + Storage`
- Mobile path actual: `Capacitor` planeado
- Mobile path NO actual: `Flutter`

No asumir Flutter.
No crear `main.dart`, `pubspec.yaml`, `android/` o `ios/` como si ya existieran.

## Regla de scope

- `pessy.app` = website / landing / blog
- `app.pessy.app` = PWA / app
- No tocar web pública si el trabajo es app.
- No tocar app si el trabajo es landing.

## Deploy

Antes de cualquier deploy, leer:
- [CLAUDE.md](/Users/mauriciogoitia/Downloads/03_PESSY_APP/PESSY_PRODUCCION/CLAUDE.md)

Resumen:
- Nunca deploy sin aprobación explícita del usuario
- Nunca deploy desde otra branch que no sea `pessy-website`
- Nunca correr `firebase deploy` directo para website

## Quién hace qué

### Bueno para Codex

- Firebase Functions
- email ingestion
- tests
- refactors
- lógica clínica canónica
- dedup
- parsers
- scaffolding técnico
- Capacitor setup

### Mejor dejar a Claude / revisión humana

- diseño visual
- branding
- iconografía cartoon
- copy sensible
- narrativa clínica
- decisiones UX ambiguas

## Reglas de producto que no romper

- La app tiene que ser simple, no recargada
- `Cork` debe ser igual al de la web
- La iconografía debe ir hacia estilo cartoon / personajes, no ícono genérico
- No duplicar verdad entre home y tratamientos
- `medical_events` es la verdad canónica para mail ingestion
- `gmail_ingestion_documents` no es historia clínica

## Mobile

Estado actual:
- `flutter doctor` da OK en la máquina
- el repo NO es Flutter
- falta `capacitor.config.*`
- faltan shells `ios/` y `android/`

Si el trabajo es empaquetado mobile:
1. crear `capacitor.config.ts`
2. apuntar `webDir` a `dist`
3. generar `ios` y `android` con Capacitor
4. sync
5. recién después probar build nativo

## Handoffs importantes

- Email ingestion:
  - [CLAUDE_HANDOFF_EMAIL_INGESTION_2026-03-30.md](/Users/mauriciogoitia/Downloads/03_PESSY_APP/PESSY_PRODUCCION/guidelines/CLAUDE_HANDOFF_EMAIL_INGESTION_2026-03-30.md)
- Flujo canónico de mail:
  - [MAIL_INGESTION_CANONICAL_FLOW.md](/Users/mauriciogoitia/Downloads/03_PESSY_APP/PESSY_PRODUCCION/guidelines/MAIL_INGESTION_CANONICAL_FLOW.md)

## Prioridad técnica actual

1. Resolver residual de email ingestion:
- `ECO THOR`
- `ECO DE THOR`

2. Dejar mobile packaging real por Capacitor

3. Después recién abrir UI / diseño pendiente

