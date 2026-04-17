# Pessy Focus Recovery — Stack de 5 Capas

**Fecha**: 2026-04-15
**Autor**: Mauri Goitia + Claude
**Estado**: Draft pendiente de review
**Horizonte**: ~6 semanas (una capa por sprint aproximado)

**Rol de este documento**: roadmap maestro del stack de 5 capas. Cada capa es una unidad de trabajo independiente que va a tener **su propio plan de implementación** generado con la skill `writing-plans`. Este spec NO es el plan de una capa — es el mapa que ordena las 5 y define criterios de terminación. El flujo es: aprobar este spec → escribir plan de Capa 1 → ejecutar Capa 1 → checkpoint → plan de Capa 2 → ejecutar → etc.

---

## Contexto

Pessy está en un momento de entropía. Una auditoría en paralelo con 4 agentes expuso lo siguiente:

1. **La promesa "asistente personal con IA" es aspiracional** — Gemini vive en un solo lugar (extraer datos de PDFs clínicos por email). La "intelligence" de la Home es un rule engine determinístico con lookup tables hardcoded (`pessyIntelligenceEngine` + `WELLBEING_MASTER_BOOK`). Veredicto del agente: 2/10 AI-powered.
2. **El pipeline de ingesta clínica existe pero no cierra el loop** — 8 cloud functions, Gemini 2.5-flash integrado, escribe en `medical_events` y `pending_actions`. PERO no notifica al usuario cuando hay algo pendiente (el usuario tiene que entrar a la app y mirar el `ActionTray`). Rompe la promesa "Pessy conecta, no te manda a buscar".
3. **Observabilidad inexistente en prod** — `sentryConfig` es un stub (SCRUM-48), `i18n` es mock Spanish-only (SCRUM-104), `nativePushService` fue implementado recientemente pero no registra FCM tokens en Firestore y **no hay cloud function que envíe push** → end-to-end roto.
4. **Vet mode es una feature fantasma** — 8 componentes production-ready pero totalmente desconectados del core. Los datos del vet no vuelven al usuario.
5. **Los emuladores no corren** — el bloqueo principal de Mauri hoy: quiere probar en Android/iOS y no puede porque la cadena build + device + push está rota.
6. **Deuda estructural acumulada** — 22 worktrees abandonados, 5 GitHub workflows con overlap, 86+ componentes sin audit de dead code, blog infra sobredimensionada (8 artículos vs sync script + 40 SVGs).

## Problema

Hay demasiadas cosas tocándose en paralelo sin orden. El criterio de avance ha sido "lo que aparece" en vez de "lo que desbloquea lo siguiente". El resultado: nada llega al 80% y las piezas que sí funcionan están silenciadas por las que no.

**La pregunta implícita del usuario** que originó este spec: *"¿qué saca de foco a la app? El core es la IA, el core es ser la app end-to-end de la vida de la mascota. ¿Qué features están al 50%? ¿Qué no llega al 80%? ¿Qué está definitivamente mal?"*

## Objetivo

Ordenar el trabajo en **5 capas de abajo hacia arriba**, cada una con criterio de terminación verificable, donde cada capa desbloquea la siguiente. Al final del stack:

- Los emuladores Android/iOS corren la app real con push notifications funcionando.
- Producción tiene observabilidad (Sentry), cierra el loop con el usuario (notif cuando hay pending review), y no tiene stubs pretendiendo ser features.
- Gemini (o equivalente LLM) vive en 4 superficies del Home, no solo en parseo de PDFs.
- Vet mode se conecta al core: el usuario ve notas del vet, el vet lee del mismo `medical_events` backbone.
- El rule engine actual queda como **fallback y guardrails**, no como motor principal.

## Reglas del stack

**Regla 1 — Orden estricto**. No se empieza la capa N hasta que la capa N-1 esté verde con el check-in definido. Si durante una capa aparece algo que rompe la anterior, se baja y se arregla antes de seguir.

**Regla 2 — Checkpoint humano al final de cada capa**. El usuario (Mauri) valida con sus manos en el device/prod lo que la capa declaró como terminado. Claude no auto-aprueba capas.

**Regla 3 — Una capa = un slice vertical**. Cada capa termina con algo demostrable end-to-end, no con "la infra está lista". La Capa 1 no termina con "el build compila", termina con "vi la Home en el emulador Android y recibí un push".

**Regla 4 — Uso de agentes paralelos dentro de cada capa**. Las tareas independientes dentro de una capa se ejecutan en paralelo por agentes (build, tests, configs, UI fixes), pero el checkpoint sigue siendo uno por capa.

**Regla 5 — Rule engine como fallback, no reemplazo**. Cuando la Capa 3 introduzca el pipeline LLM, el `pessyIntelligenceEngine` actual NO se borra — queda como fallback si el LLM falla, si el cost cap está hit, o si el usuario está offline. Ningún usuario ve pantalla vacía.

**Regla 6 — Scope congelado durante la capa**. Mientras una capa está en progreso, nada fuera de ella se toca (salvo bugs críticos de prod). No hay "aprovechando que estoy acá" entre capas.

---

## Capa 1 — Emulador corre (🔴 bloqueante hoy)

**Objetivo**: Poder abrir Android Studio y Xcode, lanzar Pessy en un emulador/simulador, loguearse con un usuario real, ver la Home, y recibir una push notification de prueba.

### Alcance

1. **Build pipeline móvil estable**
   - `npm run build:mobile` corre end-to-end sin intervención manual (ya hay fix de UTF-8 locale en commit `b017599`).
   - `cap sync` sincroniza web assets a `android/` y `ios/App/App/public` en ambos.
   - Verificar `capacitor.config.ts` apunta a `dist/` correctamente.

2. **Android — emulador abre la app**
   - `npx cap open android` abre Android Studio.
   - Al menos un emulador (ej: Pixel 7 API 34) lanza la app.
   - Login con Firebase Auth funciona (el apk debe tener `google-services.json` válido).
   - `/inicio` renderiza la Home, no pantalla en blanco.

3. **iOS — simulador abre la app**
   - `npx cap open ios` abre Xcode.
   - Al menos un simulador (ej: iPhone 15 Pro iOS 17) lanza la app.
   - Login funciona (requiere `GoogleService-Info.plist` válido en `ios/App/App/`).
   - `/inicio` renderiza la Home.

4. **Push notifications end-to-end**
   - Arreglar `nativePushService.ts`: registrar el FCM token en Firestore bajo `users/{uid}/devices/{deviceId}` al hacer login.
   - Crear cloud function `sendTestPush(uid)` que dispare una notif a todos los tokens registrados del usuario.
   - Probar desde un botón temporal en `UserProfileScreen` (botón "Test push", solo visible en development).
   - Verificar recepción en Android emulator (FCM) y iOS simulator (si se puede — APNs en simulator es limitado, se valida en device real si hace falta).

5. **QA visual de Release 1 en emulador**
   - QuickActionsV2 renderiza con los 4 botones.
   - Banner de pending review aparece si hay un `pending_reviews` para el pet activo.
   - Navegación entre pillars funciona.

### Criterio de terminación

Mauri abre en vivo:
- [ ] Android emulator con Pessy corriendo y `/inicio` visible
- [ ] iOS simulator con Pessy corriendo y `/inicio` visible
- [ ] Push notification recibida en Android (mínimo)
- [ ] QuickActionsV2 con sus 4 botones visible en ambos
- [ ] Screenshot de ambos emuladores

Si cualquiera falla, se baja al diagnóstico. No se pasa a Capa 2 hasta que los 4 checks están verdes.

### Archivos afectados

- `src/app/services/nativePushService.ts` — completar registro de token en Firestore
- `functions/src/index.ts` — exportar `sendTestPush`
- `functions/src/push/sendTestPush.ts` — crear (nuevo)
- `src/app/components/user/UserProfileScreen.tsx` — botón dev-only
- `android/app/google-services.json` — verificar (no commitear)
- `ios/App/App/GoogleService-Info.plist` — verificar (no commitear)

### Riesgos conocidos

- **iOS push en simulator** no funciona nativo, hay que usar device real o workaround con Apple Push Console.
- **APK signing** puede bloquear Android en primera corrida — se usa debug keystore.
- **CocoaPods encoding** ya está fixeado en `package.json`.

---

## Capa 2 — Producción estable

**Objetivo**: Prod tiene ojos (Sentry), cierra el loop con el usuario (notif cuando hay pending review), y no tiene stubs ocultos mintiendo sobre capacidades.

### Alcance

1. **Sentry real**
   - Reemplazar `src/app/config/sentryConfig.ts` stub por integración real de `@sentry/react`.
   - Inicializar en `main.tsx` antes del `createRoot()`.
   - DSN desde `VITE_SENTRY_DSN` (ya existe en `.env.example`).
   - Error boundary global que reporta a Sentry.
   - Verificar captura forzando un error en prod.
   - Mismo setup para cloud functions (`@sentry/node`).

2. **Cerrar el loop: notif al usuario cuando hay pending review**
   - Hoy: el pipeline escribe a `pending_reviews` + `pending_actions`, pero el usuario solo se entera si abre la app y ve el `ActionTray`.
   - Fix: trigger Firestore `onDocumentCreated` sobre `pending_reviews` → cloud function que dispara push al usuario.
   - Mensaje: "Tenemos algo nuevo sobre [nombre_pet]. Tocá para revisarlo."
   - Tap → deep link a `/inicio` con el banner abierto.
   - Depende de Capa 1 (push end-to-end).

3. **Service worker versionado limpio**
   - Verificar `skipWaiting: true` ya está (`vite.config.ts:70`).
   - Agregar build ID visible en consola al cargar (ayuda a diagnosticar incidentes falsos como el de hoy).
   - Documentar en `CLAUDE.md` cómo forzar update del SW en un device.

4. **Validación de env vars críticas en boot**
   - `src/lib/firebase.ts` ya valida `VITE_FIREBASE_PROJECT_ID`.
   - Agregar validación similar para `VITE_GOOGLE_PLACES_KEY` (afecta Explorar) y warning si falta.
   - Agregar validación de `GEMINI_API_KEY`, `MAIL_TOKEN_ENCRYPTION_KEY`, `GMAIL_FORCE_SYNC_KEY` en el arranque de las cloud functions (fail fast, log claro).

5. **Cleanup de stubs que NO se van a implementar en este stack**
   - `i18n` + `LanguageSelector`: aceptar que es Spanish-only. Marcar el component como "disabled — single language" y borrar las referencias al selector del UI. No dejar botones muertos.
   - Si en el futuro se agrega i18n, se reintroduce limpio.

6. **Verificación de env vars de cloud functions en prod**
   - Correr `firebase functions:secrets:access` para cada secret listado en `envConfig.ts`.
   - Documentar en `CLAUDE.md` qué secrets existen y qué cosa rompen si faltan.

### Criterio de terminación

- [ ] Sentry captura un error de prueba en prod (tanto web como functions)
- [ ] Push llega al usuario cuando se crea un `pending_review` en su pet
- [ ] Tap en la notif abre la Home con el banner visible
- [ ] Build ID visible en consola al cargar la PWA
- [ ] No hay botones de idioma en la UI
- [ ] `firebase functions:secrets:access` retorna valores para todos los secrets requeridos

### Archivos afectados

- `src/app/config/sentryConfig.ts` — reescribir
- `src/main.tsx` — inicializar Sentry temprano
- `src/app/components/ErrorBoundary.tsx` — si existe, conectar a Sentry
- `functions/src/index.ts` — exportar nuevo trigger
- `functions/src/notifications/pendingReviewNotification.ts` — nuevo
- `functions/src/config/sentry.ts` — nuevo
- `src/lib/firebase.ts` — agregar validación adicional
- `src/app/components/settings/LanguageSelector.tsx` — borrar uso, dejar archivo con comment o borrar
- `vite.config.ts` — confirmar build ID plumbing
- `CLAUDE.md` — sección nueva de secrets + cómo verificar

---

## Capa 3 — Infra LLM

**Objetivo**: Tener un pipeline unificado que, dado un `petId` y una surface (`tip` | `hook` | `routines` | `next_action`), devuelve un insight generado por LLM con context real, guardrails, cache y cost cap. Reemplaza las llamadas dispersas y el rule engine como motor principal.

### Alcance

1. **Cloud function única: `generatePetInsight(petId, surface)`**
   - Input: `{ petId: string, surface: 'tip'|'hook'|'routines'|'next_action' }`
   - Output: `{ text: string, reasoning: string, source: 'llm'|'fallback', generatedAt: timestamp, surface, version }`
   - Trigger: `onCall` (llamada desde el cliente con auth).

2. **Context assembly (la pieza core)**
   - Módulo `functions/src/intelligence/contextAssembly.ts` que dado un `petId` arma un objeto con:
     - Pet profile (especie, raza, edad, peso, sexo, castrado)
     - Clima actual del lugar del usuario (Open-Meteo, ya existe)
     - Últimos 10 `medical_events` (filtrados por importancia)
     - Vacunas pendientes o vencidas
     - Medicaciones activas
     - Appointments próximos
     - Rutinas del `WELLBEING_MASTER_BOOK` relevantes a la raza
   - Cada campo se convierte a texto estructurado para el prompt.

3. **Prompts versionados**
   - Carpeta `functions/src/intelligence/prompts/` con un archivo por surface:
     - `tip.prompt.md` — genera PessyTip
     - `hook.prompt.md` — genera DailyHookCard
     - `routines.prompt.md` — genera sugerencias de rutina del día
     - `nextAction.prompt.md` — genera "próxima mejor acción"
   - Cada prompt incluye: system instructions, guardrails (nunca diagnosticar, nunca medicar, lenguaje condicional), ejemplos few-shot, schema de output.
   - Versión en el frontmatter del prompt (`version: 1`).

4. **Guardrails de output**
   - Parser + validator del JSON que devuelve el LLM:
     - Nunca debe contener palabras de medicación específica sin disclaimer.
     - Nunca "tu perro tiene X" (diagnóstico), siempre "podría indicar que..."
     - Siempre debe cerrar con un CTA hacia una feature de la app (ej: "revisá en Rutinas").
   - Si el parser detecta violación → se descarta el output → fallback al rule engine.

5. **Caching**
   - Por `(petId, surface, dateHash)` — un insight por pet por surface por día.
   - TTL: 24hs por default, configurable por surface (`next_action` puede ser 6hs).
   - Store: Firestore subcollection `pets/{petId}/insights/{surface_dateHash}`.
   - Si hay cache hit, no se llama al LLM.

6. **Cost cap**
   - Contador diario por usuario en `users/{uid}/usage/llm/{date}`.
   - Cap default: 20 llamadas por día por usuario (4 surfaces × 5 pets).
   - Si se pasa el cap → devuelve fallback del rule engine sin llamar al LLM.
   - Logging de costos a Sentry/BigQuery.

7. **Fallback al rule engine**
   - Si: LLM falla, output no valida, cost cap hit, offline → se llama a `pessyIntelligenceEngine.runPessyIntelligence()` con los mismos inputs.
   - El fallback devuelve data del `WELLBEING_MASTER_BOOK` formateada en el mismo schema.
   - Campo `source: 'fallback'` en la respuesta para observabilidad.

8. **Métricas**
   - Sentry custom events: `llm.call`, `llm.cache_hit`, `llm.fallback`, `llm.guardrail_violation`
   - Dashboard mínimo en `functions/src/intelligence/metrics.ts` que agrega counts.

### Criterio de terminación

- [ ] `generatePetInsight(petId, 'tip')` devuelve un tip generado por Gemini usando context real del pet
- [ ] Para el mismo pet el mismo día, la segunda llamada devuelve del cache (sin tocar Gemini)
- [ ] Forzar un output inválido en el prompt → fallback activa y devuelve rule engine
- [ ] Forzar cost cap hit → fallback activa
- [ ] Los 4 surfaces (`tip`, `hook`, `routines`, `next_action`) devuelven algo coherente para un pet de prueba
- [ ] Métricas de Sentry muestran los eventos custom

### Archivos afectados

- `functions/src/intelligence/generatePetInsight.ts` — nuevo, entry point
- `functions/src/intelligence/contextAssembly.ts` — nuevo
- `functions/src/intelligence/prompts/` — nuevo directorio
- `functions/src/intelligence/guardrails.ts` — nuevo, validator
- `functions/src/intelligence/cache.ts` — nuevo, Firestore-backed cache
- `functions/src/intelligence/costCap.ts` — nuevo
- `functions/src/intelligence/metrics.ts` — nuevo
- `functions/src/intelligence/fallbackAdapter.ts` — nuevo, adapta `pessyIntelligenceEngine` al schema
- `functions/src/index.ts` — exportar
- `src/domain/intelligence/pessyIntelligenceEngine.ts` — NO se toca, queda como está
- `src/domain/wellbeing/wellbeingMasterBook.ts` — NO se toca

### Riesgos conocidos

- **Costo real de tokens**: hay que medir con un pet real antes de escalar. Presupuesto estimado: $0.50–$2 USD por usuario activo/mes asumiendo cache.
- **Latencia**: Gemini Flash puede tardar 2–5 segundos. Necesita skeleton loading en las surfaces.
- **Drift de prompts**: sin versionado estricto, futuros cambios pueden romper surfaces. El frontmatter + tests snapshot son el guardrail.

---

## Capa 4 — IA transversal en el Home

**Objetivo**: Las 4 surfaces del Home leen de `generatePetInsight` en vez de data estática / rule engine. El Home se siente vivo y adaptativo.

### Alcance

1. **PessyTip dinámico**
   - Componente `PessyTip` (actual) cambia de recibir data estática a llamar `generatePetInsight(petId, 'tip')` al montar.
   - Loading state: skeleton.
   - Error state: fallback a data del `WELLBEING_MASTER_BOOK` (ya lo hace el backend, pero el frontend maneja el error visualmente).
   - No se muestra el "reasoning" por default, hay un "ver por qué" colapsable.

2. **DailyHookCard dinámico**
   - Mismo patrón con `surface: 'hook'`.
   - El hook tiene que cambiar por día (cache TTL 24hs).
   - Ejemplo: "Hoy hace 32° en Buenos Aires — Luna necesita sombra entre 11 y 17hs".

3. **RoutineChecklist adaptativa**
   - `surface: 'routines'` devuelve un array de rutinas sugeridas para el día.
   - Se compara contra las rutinas hardcoded del `WELLBEING_MASTER_BOOK` para mergear (LLM decide cuáles priorizar por contexto, el master book provee las acciones).
   - El usuario sigue pudiendo marcar como hecho.

4. **QuickActionsV2 "próxima mejor acción"**
   - Hoy es un array fijo de 4 botones.
   - Cambio: el primer botón es dinámico, viene de `surface: 'next_action'`.
   - Ejemplo: "Sacar turno con vet — hace 4 meses del último check-up".
   - Los otros 3 botones siguen como están.

5. **Instrumentación**
   - Cada render de una surface con data LLM emite un evento de Sentry `home.surface.rendered` con `{ surface, source }`.
   - Engagement: si el usuario clickea el CTA del insight, emitir `home.surface.clicked`.

### Criterio de terminación

- [ ] `PessyTip` muestra un tip generado por LLM con el pet real logueado
- [ ] `DailyHookCard` cambia por día (verificable: reload = mismo, day+1 = distinto)
- [ ] `RoutineChecklist` prioriza rutinas según clima/historial
- [ ] El primer botón de `QuickActionsV2` cambia según contexto del pet
- [ ] Si Gemini está caído (test forzando error), los 4 surfaces siguen funcionando con fallback del rule engine, sin pantalla vacía
- [ ] Skeleton loading visible cuando la llamada tarda >500ms

### Archivos afectados

- `src/app/components/home/PessyTip.tsx` — consumir hook nuevo
- `src/app/components/home/DailyHookCard.tsx` — idem
- `src/app/components/home/RoutineChecklist.tsx` — idem
- `src/app/components/home/QuickActionsV2.tsx` — idem (solo primer botón)
- `src/app/hooks/usePetInsight.ts` — nuevo, wrapper de la cloud function con loading/error states
- `src/app/components/pet/PetHomeView.tsx` — pasar `petId` a cada surface

---

## Capa 5 — Vet mode bidireccional

**Objetivo**: Vet mode deja de ser feature fantasma. El usuario ve notas del vet en su Home; el vet lee los mismos `medical_events` del backbone y puede escribir notas que el usuario ve. El nexo es el mismo evento clínico.

### Alcance

1. **Schema de vet notes**
   - Nueva colección `vet_notes` con: `{ id, vetId, petId, relatedEventId?, body, createdAt, visibility: 'user'|'private' }`.
   - `relatedEventId` puede apuntar a un `medical_events` doc (ej: el vet enriquece el evento que ingestó Gemini).

2. **Lado usuario (read)**
   - Nuevo componente `VetNotesSection` en `PetHomeView` debajo de la Health Pulse.
   - Muestra las últimas 3 notas del vet con `visibility: 'user'` para el pet activo.
   - Cada nota linkea al vet que la escribió (read-only).
   - Próximo turno con el vet visible en `PetCard` si existe.

3. **Lado vet (read del backbone)**
   - `VetPatientList` ya existe pero lee colecciones separadas. Refactor para que lea `medical_events` del pet seleccionado (requiere que el rule de Firestore permita acceso por role `vet` asignado al pet).
   - `VetConsultationView` muestra el timeline real del pet, no uno mockeado.

4. **Lado vet (write)**
   - En `VetConsultationView`, botón "Agregar nota" → crea doc en `vet_notes` con `visibility: 'user'` por default, privacy toggle.
   - El vet puede marcar una nota como "relacionada a este evento" → setea `relatedEventId`.

5. **Firestore rules**
   - Update de `firestore.rules` para:
     - `vet_notes`: read si `isOwner(petId)` o `isAssignedVet(petId)`; write solo si `isAssignedVet(petId)`.
     - `medical_events`: read si `isOwner(petId)` o `isAssignedVet(petId)` (hoy solo owner).

6. **Asignación vet ↔ pet**
   - Decidir mecanismo: ¿el usuario invita al vet con un código? ¿el vet busca por email? → **Fuera de alcance de este spec**, queda como TODO. Para la Capa 5 asumimos asignación manual vía Firebase console con un doc `vet_assignments/{petId_vetId}`.

### Criterio de terminación

- [ ] Un vet de prueba asignado a un pet de prueba ve el timeline real del pet
- [ ] El vet crea una nota → el usuario la ve en la Home
- [ ] La nota puede linkearse a un `medical_events` existente (el que ingestó Gemini del email)
- [ ] Firestore rules permiten solo al vet asignado leer el pet
- [ ] El pet card muestra "Próximo turno con Dr. X" si existe

### Archivos afectados

- `firestore.rules` — add `vet_notes` + update `medical_events`
- `src/app/components/pet/PetHomeView.tsx` — add `VetNotesSection`
- `src/app/components/pet/VetNotesSection.tsx` — nuevo
- `src/app/components/vet/VetPatientList.tsx` — refactor para leer `medical_events`
- `src/app/components/vet/VetConsultationView.tsx` — refactor + botón de nota
- `src/app/components/vet/VetNoteForm.tsx` — nuevo
- `src/app/contexts/VetContext.tsx` — probablemente nuevo o extender MedicalContext

### Fuera de alcance (para spec separado si se decide)

- Flow de invitación de vet por parte del usuario
- Chat usuario ↔ vet
- Vet facturación / pagos
- Búsqueda de vets cerca mío (ya existe `NearbyVetsScreen` pero usa Places API, no backend propio)

---

## Dependencias entre capas

```
Capa 1 (Emulador) ─────┐
                       ├──► Capa 2 (Producción estable) ──┐
Push notifications ────┘                                  │
                                                          ├──► Capa 3 (Infra LLM) ──► Capa 4 (IA transversal) ──► Capa 5 (Vet)
                       Sentry ────────────────────────────┘
```

- Capa 2 depende de Capa 1 porque el "close the loop" usa push.
- Capa 3 depende de Capa 2 porque sin Sentry no se pueden medir costos ni detectar drift del LLM.
- Capa 4 depende de Capa 3 porque consume el pipeline.
- Capa 5 depende de Capa 4 solo débilmente (el Home tiene que tener espacio visual para `VetNotesSection`); técnicamente se podría paralelizar con Capa 4 pero el foco manda secuencial.

## Uso de agentes en paralelo

Dentro de cada capa, las tareas independientes se despachan a agentes en paralelo. Ejemplos:

**Capa 1**:
- Agente A: fix `nativePushService.ts` + escribir test
- Agente B: escribir cloud function `sendTestPush`
- Agente C: verificar `google-services.json` + `GoogleService-Info.plist` + docs de build

**Capa 2**:
- Agente A: Sentry integration web
- Agente B: Sentry integration functions
- Agente C: trigger `pending_reviews` onCreate → push
- Agente D: cleanup `i18n` + `LanguageSelector`

**Capa 3**:
- Agente A: context assembly
- Agente B: prompts + guardrails
- Agente C: cache + cost cap
- Agente D: fallback adapter

**Capa 4**:
- Agente A: `usePetInsight` hook + `PessyTip`
- Agente B: `DailyHookCard` + `RoutineChecklist`
- Agente C: `QuickActionsV2` first-slot + instrumentación

**Capa 5**:
- Agente A: Firestore rules + colecciones
- Agente B: UI lado usuario (`VetNotesSection`)
- Agente C: refactor lado vet (`VetPatientList`, `VetConsultationView`)

Cada agente trabaja aislado en su slice. Al final de cada capa, Mauri valida en device/prod. Si hay bugs, se despacha un agente de fix, no se avanza.

## Lo que NO se toca en este stack (scope freeze 6 semanas)

- ❄️ **Landing copy** — congelado. No más meta tags, no más Hero, no más copy reviews.
- ❄️ **Blog nuevos artículos** — congelado. La infra queda como está.
- ❄️ **Legal section** — congelado. Ya está live.
- ❄️ **Deploy pipeline tweaks** — congelado salvo bugs críticos.
- ❄️ **Lead magnet** — fuera, no se construye.
- ❄️ **Lost pets anónimo** — decidido el veto, queda fuera.
- ❄️ **Pilar Comunidad** — sub-invertido pero NO entra a este stack. Se agenda para un spec separado post Capa 5.
- ❄️ **Worktrees cleanup** — se hace al final, fuera de las 5 capas, como housekeeping.
- ❄️ **Dead code audit de los 86 componentes** — fuera. Se hace en un spec separado.

## Métricas de éxito

Al final de las 5 capas:

1. **Funcionalidad**: Mauri puede abrir Android + iOS emuladores y usar Pessy como un usuario real, recibiendo push notifications.
2. **Observabilidad**: 0 errores no capturados en Sentry por >24hs en prod.
3. **Loop cerrado**: >90% de `pending_reviews` creados se notifican al usuario en <60 segundos.
4. **IA real**: Gemini toca 4 surfaces del Home + 1 del pipeline clínico existente. Cada llamada con cache y cost cap.
5. **Guardrails**: 0 violaciones de guardrails en outputs LLM (todos los descartes caen a fallback).
6. **Vet mode vivo**: al menos 1 vet de prueba puede leer + escribir notas que el usuario ve.

## TODOs explícitos fuera de alcance (no olvidar después)

- **`app.pessy.app` 404** — decidir si se configura o se borra de CLAUDE.md. Spec separado.
- **Pilar Comunidad** — reinicio, spec separado.
- **Dead code audit** — spec separado, probablemente con agente Explore.
- **Worktrees cleanup** — housekeeping, no spec.
- **Flow de invitación vet ↔ usuario** — spec separado post Capa 5.
- **Rate limiting** (`security.ts:503` TODO) — spec separado, probablemente Redis o Firestore-backed.
