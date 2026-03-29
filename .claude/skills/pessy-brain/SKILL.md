---
name: pessy-brain
description: |
  Motor de IA generativa que vive dentro de PESSY — plataforma de estilo de vida para pet owners (50K+ usuarios). Este cerebro lee el proyecto completo (15+ módulos implementados), se conecta a NotebookLM via MCP, y genera outputs inteligentes fundamentados en conocimiento veterinario, preferencias reales de usuario, gamificación, y los nuevos pilares: mascotas perdidas, adopción, y recomendaciones de lugares. MANDATORY TRIGGERS: "cerebro de PESSY", "brain", "NotebookLM", "knowledge base", "inteligencia PESSY", "recomendaciones", "gamificación", "mascotas perdidas", "adopción", "lugares", "preferencias", "onboarding", arquitectura de PESSY, generar código para PESSY, alimentar o consultar el cerebro, pricing, planes, co-tutors, o cualquier tarea que requiera entender cómo funciona PESSY.
---

# PESSY Brain — Motor de IA Generativa

## Qué es PESSY (estado real)

PESSY es una **plataforma de inteligencia para pet owners** que ya tiene:

**Implementado y funcionando:**
- Escaneo de documentos médicos con extracción AI (vacunas, medicamentos, diagnósticos, lab results)
- Historial médico completo con timeline cronológica y resúmenes mensuales
- Sistema de citas con auto-extracción desde Gmail + Google Calendar
- Tracking de medicaciones (activa/crónica/completada) con notas de tratamiento
- Recordatorios por tipo (vacunas, medicación, checkups, grooming, desparasitación)
- Intelligence Engine: thermal safety por raza, recomendaciones de training, wellbeing profiles
- Nearby Vets: Google Places API con geolocalización, distancia, ratings, estado abierto/cerrado
- Co-tutors: guardianship compartida con códigos de invitación
- Gamificación básica: puntos en localStorage, daily activity tracking
- Pricing multi-país: Free + Premium, MercadoPago (LATAM) + Stripe (US/EU), 11 países
- Preferencias de mascota: actividades favoritas, lugares, personalidad, comida, alergias, miedos
- Notificaciones FCM: routine, contextual, re-engagement, risk-based (max 1-3/día)
- Clinical Brain: Vertex AI + Claude → análisis médico fundamentado con knowledge base
- Export PDF de reportes médicos
- Focus Experience (beta): layout alternativo centrado en timeline médico

**Tagline:** "Porque quererlo ya es suficiente trabajo"
**Web:** pessy.app | **Contacto:** mauri@pessy.app

## Los 5 Pilares — Existente + Nuevo

### Pilar 1: Clinical Brain ✅ IMPLEMENTADO
Sistema de inteligencia clínica completo. No tocar sin necesidad.

Módulos clave (Cloud Functions `functions/src/clinical/`):
- `groundedBrain.ts` — Análisis via Vertex AI + Claude con contexto inyectado
- `knowledgeBase.ts` — Query Firestore `notebook_knowledge`, scoring keywords
- `notebookKnowledgeSync.ts` — Sync NotebookLM → Firestore (POST endpoint)
- `brainResolver.ts` — Normaliza AI outputs → diagnósticos, hallazgos, tratamientos
- `episodeCompiler.ts` — Construye episodios clínicos
- `projectionLayer.ts` — Proyecciones de salud
- `treatmentReminderEngine.ts` — Recordatorios de tratamiento

Frontend (`src/domain/`):
- `intelligence/pessyIntelligenceEngine.ts` (519 líneas) — Motor de recomendaciones
- `intelligence/smartSuggestionGenerator.ts` — Sugerencias contextuales
- `wellbeing/wellbeingMasterBook.ts` — Knowledge base completa
- `training/training_master_book.ts` — Guía conductual

### Pilar 2: User Preference Engine 🔧 EXPANDIR
Ya existe data de preferencias en `PetContext`. Hay que evolucionar de datos estáticos a perfil vivo.

**Lo que YA existe en el modelo Pet:**
```typescript
// En PetContext.tsx — campos reales actuales
preferences: {
  favoriteActivities: string[];  // walk, park, cafe, beach, hiking, playdate, training, swim
  favoritePlaces: string[];      // Google Places IDs
  walkTimes: string[];
  foodPreferences: {
    brand: string;
    type: 'balanced' | 'BARF' | 'mixed';
    supplyTracking: boolean;
  };
  allergies: string[];
  fears: string[];
  personality: string[];         // calm, energetic, shy, social, independent, playful, protective
}
weightHistory: { date: string; weight: number }[];
```

**Lo que FALTA — el perfil vivo del dueño:**
- Preguntas random tipo "¿te gusta ir a cafés con {nombre}?" → tags
- Comportamiento implícito (qué features usa, cuándo, frecuencia)
- Perfil de lifestyle del DUEÑO (no solo de la mascota)
- Tags derivados: "café_lover", "runner", "premium_buyer", "social_butterfly"
- Score de engagement y response rate

Ver `references/user-preference-engine.md` para el schema completo.

### Pilar 3: Community — Perdidos + Adopción 🆕 NUEVO
No existe nada de esto en el código actual. Se construye desde cero.

**Mascotas perdidas:**
- Reporte con foto + ubicación + descripción (auto-fill de datos de la mascota registrada)
- Push notifications geolocalizadas con radio expansivo (2km → 5km → 10km)
- Feed de perdidos en la zona, avistamientos con notificación al dueño
- Matching visual de fotos

**Adopción:**
- Refugios y usuarios publican mascotas en adopción
- Matching inteligente: lifestyle del adoptante ↔ necesidades de la mascota
- Cuestionario de compatibilidad → match score → conexión

Ver `references/lost-pets-adoption.md` para schemas completos.

### Pilar 4: Gamificación + Planes 🔧 EXPANDIR
Existe gamificación básica en `src/app/utils/gamification.ts` (localStorage). Pricing multi-país configurado pero no expuesto en UI.

**Lo que YA existe:**
- `getPoints()` / `addPoints()` — puntos en localStorage
- `isDailyActivityDone()` / `markDailyActivityDone()` — daily activity
- Pricing: Free + Premium, MercadoPago + Stripe, 11 países con precios localizados
- Detección de país por IP o timezone

**Lo que FALTA:**
- Migrar puntos de localStorage → Firestore (para persistencia y cross-device)
- Streaks (días consecutivos)
- Badges/logros por hitos
- Niveles de progresión
- Leaderboard por zona
- UI de gamificación (badges, streak counter, plan upgrade CTA)
- Plan gating: features restringidas por tier
- Puntos por acciones de comunidad (reportar perdido, avistamiento, adopción)

### Pilar 5: Lifestyle — Recomendaciones de Lugares 🔧 EXPANDIR
Ya existe Nearby Vets con Google Places API. Hay que evolucionar de "vets cercanos" a "experiencias personalizadas".

**Lo que YA existe:**
- `NearbyVets` screen: geolocalización, Google Places API, distancia, ratings, open/closed
- `favoritePlaces` en PetContext: array de Google Places IDs
- `favoriteActivities`: walk, park, cafe, beach, hiking, playdate, training, swim

**Lo que FALTA:**
- Expandir de solo vets a todas las categorías: cafés, parques, shops, grooming, hoteles, restaurantes, playas, eventos
- Motor de scoring personalizado: preferencias + proximidad + mascota + contexto (hora, clima, día)
- Cards de recomendación con razón explícita ("Porque te gustan los cafés pet-friendly")
- Reviews y ratings de la comunidad PESSY (no solo Google)
- Feed de recomendaciones en home (no solo búsqueda)
- Gating por plan: Free (2 recs) vs Premium (5 + push proactivas)

Ver `references/places-recommendations.md` para el motor de scoring.

## Arquitectura del Cerebro v2

```
┌───────────────────────────────────────────────────────────────┐
│                     PESSY BRAIN v2                             │
├───────────────────────────────────────────────────────────────┤
│                                                                │
│  INPUTS                                                        │
│  ┌─────────────┐ ┌──────────────┐ ┌────────────────────────┐ │
│  │ NotebookLM  │ │  Firestore   │ │  User + Pet Context    │ │
│  │ (MCP)       │ │  Knowledge   │ │  preferences, history  │ │
│  │ 9 notebooks │ │  + profiles  │ │  personality, location │ │
│  └──────┬──────┘ └──────┬───────┘ └───────────┬────────────┘ │
│         │               │                      │               │
│         ▼               ▼                      ▼               │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │              Context Resolution Layer                    │  │
│  │  knowledgeBase.ts + userPrefs + petProfile + plan       │  │
│  └────────────────────────┬────────────────────────────────┘  │
│                           │                                    │
│  ENGINES     ┌────────────┼─────────────────┐                 │
│              ▼            ▼                  ▼                 │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────────┐      │
│  │ Clinical     │ │ Lifestyle    │ │ Community        │      │
│  │ ✅ exists    │ │ 🔧 expand    │ │ 🆕 new           │      │
│  │ health+AI   │ │ places+recs  │ │ lost+adoption    │      │
│  └──────────────┘ └──────────────┘ └──────────────────┘      │
│              │            │                  │                 │
│  LAYER       ▼            ▼                  ▼                 │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  Gamification 🔧 expand from localStorage → Firestore   │  │
│  │  Points + Streaks + Badges + Plan Gating (11 countries) │  │
│  └─────────────────────────────────────────────────────────┘  │
│              │                                                 │
│  OUTPUT      ▼                                                 │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  FCM Push · UI Cards · Email · Timeline · PDF Export    │  │
│  └─────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────┘
```

## NotebookLM — 9 Notebooks

| Notebook | Contenido | Pilar |
|----------|-----------|-------|
| `veterinaria` | Protocolos clínicos, guías veterinarias | Clinical ✅ |
| `farmacologia` | Medicamentos, dosis, interacciones | Clinical ✅ |
| `comportamiento` | Comportamiento canino/felino | Clinical + Lifestyle |
| `producto` | Features PESSY, roadmap, decisiones | Todos |
| `nutricion` | Dietas, alimentos seguros/tóxicos | Clinical + Lifestyle |
| `emergencias` | Urgencias, primeros auxilios | Clinical ✅ |
| `bienestar` | Rutinas, ejercicio, prevención | Clinical + Gamification |
| `comunidad` | Protocolos perdidos/adopción, matching | Community 🆕 |
| `lugares` | Directorio de lugares, categorías | Lifestyle 🔧 |

### Setup MCP PleasePrompto
```bash
claude mcp add notebooklm npx notebooklm-mcp@latest
```
Primera auth: "Log me in to NotebookLM" → login Google.

## Flujos de Trabajo

### Flujo 1: Query — Consultar el cerebro
1. Identificar pilar(es) y notebook(s) relevantes
2. Consultar NotebookLM via MCP → respuesta con citas
3. Enriquecer con contexto real: PetContext + preferences + plan del usuario
4. Adaptar output al plan (Free vs Premium)

### Flujo 2: Ingest — Alimentar el cerebro
Schema de `notebookKnowledgeSync.ts`:
```typescript
POST /syncNotebookKnowledge
{ sections: [{ id, notebook, title, body, keywords[], priority }], replace_notebook? }
```
1. Preparar sección → 2. Subir a NotebookLM via MCP → 3. Sync a Firestore → 4. Verificar

### Flujo 3: Build — Generar código
Patterns obligatorios:
- **Backend**: Cloud Functions + TypeScript + Firestore + Vertex AI
- **Frontend**: React 18 + TypeScript + Tailwind + Capacitor
- **Diseño**: Plano tokens (#074738, #1A9B7D, #E0F2F1, rounded-16, 44×44)
- **Animaciones**: CSS-only (150ms ease). NUNCA framer-motion
- **Icons**: Material Design icons (no Lucide en código nuevo si ya usa MD)
- **Toasts**: Sonner
- **Router**: React Router
- **Ejecución**: Desktop Commander MCP, codebase en Mac

### Flujo 4: Recommend — Recomendaciones personalizadas
1. Cargar datos REALES: `PetContext.preferences` (activities, places, personality, food)
2. Cargar perfil vivo del dueño (tags derivados de random questions)
3. Consultar notebook `lugares` via MCP
4. Scoring: preferencias + proximidad + pet compatibility + contexto (hora, clima)
5. Top 5 con razón explícita → cards en UI
6. Gating por plan (Free: 2, Premium: 5 + push)

### Flujo 5: Community — Perdidos y Adopción
1. **Perdido** → formulario auto-fill desde PetContext → push geolocalizadas
2. **Avistamiento** → notificar al dueño + actualizar feed
3. **Adopción** → matching (lifestyle + livingSpace + experience + otherPets ↔ mascota)
4. Todo suma puntos de gamificación

### Flujo 6: Learn — Evolucionar
Cada interacción puede generar nuevo conocimiento:
- Patrón clínico nuevo → notebook `veterinaria`/`farmacologia`
- Lugar validado por usuarios → notebook `lugares`
- Decisión de producto → notebook `producto`
- Preferencia recurrente → refinar scoring

## Pricing Real (multi-país)

| País | Moneda | Procesador |
|------|--------|-----------|
| AR, BR, CL, MX, CO, UY, PE, BO, PY | Local | MercadoPago |
| US, ES, EC | USD/EUR | Stripe |

Planes: Free + Premium (mensual/anual). Pro en roadmap.
El cerebro adapta outputs según plan — nunca mostrar features premium a free sin CTA de upgrade.

## Reglas del Cerebro

### Fundamentación
Nunca inventar. Siempre fundamentar en:
1. NotebookLM con citas verificables
2. Código existente (archivos leídos)
3. Datos reales del PetContext y preferences
4. WellbeingMasterBook validado

### Prioridad al construir
1. EXPANDIR lo existente > crear nuevo
2. Respetar PetContext como fuente de verdad de datos de mascota
3. Usar Google Places IDs existentes (no reinventar ubicaciones)
4. Gamificación → Firestore (no más localStorage)
5. Multi-país siempre (pricing, idioma, UX)

### Ejecución
- Desktop Commander MCP (no sandbox)
- Codebase: `/Users/mauriciogoitia/Downloads/03_PESSY_APP/PESSY_PRODUCCION/`
- Leer antes de editar, verificar antes de avanzar

## Referencias
- `references/module-map.md` — Mapa completo de archivos existentes + propuestos
- `references/knowledge-schema.md` — Schema Firestore notebook_knowledge
- `references/notebooklm-mcp-guide.md` — Guía MCP PleasePrompto
- `references/user-preference-engine.md` — Motor de preferencias (onboarding + random questions)
- `references/lost-pets-adoption.md` — Sistema de perdidos y adopción
- `references/places-recommendations.md` — Motor de recomendaciones de lugares
