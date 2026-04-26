# Episode Engine + History Redesign — Implementation Plan

**Goal:** Reemplazar el historial actual (lista infinita de medical_events) por una experiencia narrativa de 3 niveles basada en EPISODIOS generados por el cerebro AI de Pessy.

**Architecture:**
- Backend ya tiene `clinical_episodes` collection (poblada por `episodeCompiler.ts`).
- NUEVO: callable `pessyCompileEpisodeNarrative` que toma un episodio compilado + contexto de la mascota y devuelve `{ title, summary, tags }` con tono Pessy (humano, claro, no clínico).
- NUEVO: `TimelineV2.tsx` (3 niveles) reemplaza `Timeline.tsx` en la ruta `/historial`.
- TRIGGER (next iteration): re-evaluar episodios ante cada nuevo medical_event.

**Tech stack:** Firestore + Gemini 2.5 Flash (response schema JSON) + React + TypeScript.

---

## Episode contract (data model)

```ts
interface EpisodeNarrative {
  id: string;             // viene del clinical_episodes doc
  petId: string;
  period: { start: string; end: string }; // ISO
  title: string;          // "Control por alergia"
  summary: string;        // narrativa Pessy 2-3 frases
  tags: string[];         // ["alergia", "control"]
  events: Array<{ date: string; description: string }>;
  diagnosis?: { label: string; doctor?: string; clinic?: string };
  treatments: Array<{ name: string; dose?: string; frequency?: string; startDate?: string }>;
  professionals: string[];
  clinic?: string;
  documents: Array<{ id: string; type?: string; date?: string }>;
}
```

---

## Tasks

### Task 1: Backend callable `pessyCompileEpisodeNarrative`

**File:** `functions/src/index.ts`

Toma `{ petId, episodeId }` o `{ petId, eventIds: string[] }`, carga datos, llama Gemini con prompt + JSON schema, devuelve `EpisodeNarrative`.

Prompt rules (hardcoded server-side):
- Agrupa eventos cronológicamente por período + contexto
- Tono Pessy: humano, claro, no clínico ("fue atendida por", no "presentó cuadro de")
- Si falta dato → omite (no inventa)
- Title corto (<60 chars), summary 2-3 frases

### Task 2: Bulk `pessyCompileRecentEpisodes`

Para Level 1: toma los últimos 3 meses de events, los agrupa server-side, devuelve array de EpisodeNarrative listos para renderizar.

### Task 3: TimelineV2 component (3 niveles)

**File:** `src/app/components/medical/TimelineV2.tsx`

**Level 1 — Recent (3 meses):**
- Cards verticales, una por episodio
- Avatar/icon según tag → título → summary 2 líneas → CTA "Ver más"
- Si no hay episodios: empty state Pessy

**Level 2 — Detail:**
- Modal o pantalla full-screen
- Hero período + título
- Cronología de eventos
- Diagnóstico (si existe)
- Tratamientos (si existen)
- Profesionales + clínica
- Documentos (lista clickeable)

**Level 3 — Archive:**
- Después de los 3 meses recientes
- Agrupado por año (collapsed)
- Cada año: resumen tipo "12 episodios · 4 controles · 3 vacunas"
- Click → expande a episodios del año (sin scroll infinito)

### Task 4: Wire `/historial` → TimelineV2

Reemplaza el `import Timeline` en la ruta. Mantener `Timeline.tsx` como `Timeline.legacy.tsx` por 1 sprint para rollback rápido.

### Task 5: PDF export usa episodios

ExportReportModal pasa de armar el resumen con templates locales → consumir `clinical_episodes` + `pessyCompileEpisodeNarrative` para construir el PDF (hereda la regla de las 10 secciones del callable `pessyClinicalSummaryStructured` ya creado).

---

## Out of scope (next iteration)
- Firestore trigger automático on medical_event write → re-compile
- Tags interactivos (filtrar por "alergia")
- Comparación período a período
- Animaciones Cork/Fizz en transiciones
