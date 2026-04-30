# E2E Tests — Pessy (SCRUM-51)

## Setup rápido

```bash
# 1. Instalar browsers de Playwright (una vez)
npx playwright install chromium webkit

# 2. Crear archivo de credenciales de test (NO commitear)
cp .env.test.example .env.test
# Editar .env.test con un usuario de test en Firebase

# 3. Correr todos los tests
npm run e2e

# 4. Ver reporte HTML
npm run e2e:report
```

## Credenciales de test

Crea un archivo `.env.test` en la raíz del proyecto (ya está en `.gitignore`):

```
PESSY_TEST_EMAIL=test@pessy.app
PESSY_TEST_PASSWORD=TuPasswordDeTest123
```

> **Sin credenciales**: los tests autenticados se saltarán automáticamente.
> Los tests unauthenticated (login smoke, rutas públicas) corren siempre.

## Flujos cubiertos (SCRUM-51)

| Flujo | Archivo | Descripción |
|-------|---------|-------------|
| 1 — Ingesta asíncrona | `flows/async-ingestion.spec.ts` | Gmail OAuth consent modal, ARIA roles, cierre con ESC |
| 2 — Memoria episódica | `flows/episodic-memory.spec.ts` | Timeline filters, export PDF button, pet switch state reset |
| 3 — Motor proactivo | `flows/proactive-engine.spec.ts` | Login form validation, toggle de contraseña, acceso a notificaciones |
| 4 — Multi-tenancy | `flows/multi-tenancy.spec.ts` | Portal vet, registro mascota, catch-all redirect, console errors |

## Estrategia de auth

El setup global (`setup/auth.setup.ts`) hace login una vez y guarda el estado en
`playwright/.auth/user.json`. Todos los demás tests reutilizan ese estado sin
volver a autenticarse.

## Scripts disponibles

```bash
npm run e2e              # Corre todos los tests (Chromium + Mobile Safari)
npm run e2e:chromium     # Solo Chromium
npm run e2e:debug        # Modo debug (paso a paso)
npm run e2e:ui           # Playwright UI (interfaz visual)
npm run e2e:report       # Abre el reporte HTML del último run
```
