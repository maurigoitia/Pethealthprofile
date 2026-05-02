# Episode Engine — History Redesign (Hybrid Semantic Model)

**Status:** Draft — planning only, not approved for execution
**Owner:** Mauricio Goitia
**Created:** 2026-05-02
**Supersedes:** referenced but never written `2026-04-26-episode-engine-history-redesign.md`
**Related:** `pessyCompileRecentEpisodes` (functions/src/index.ts:2837), `Timeline.tsx`, `ClinicalEpisode` type (MedicalContext.tsx:55)

---

## 1. Context

Pessy already has v1 of the episode engine: `pessyCompileRecentEpisodes` Gen 1 callable. It receives the last 3 months of `medical_events` for a pet, asks Gemini to group them into narrative episodes, and persists `clinical_episodes` documents in Firestore.

What works:
- Cronological narrative grouping
- Gemini outputs structured JSON (title, summary, period, tags, events, diagnosis, treatments)
- TimelineV2 + ExportReportModal consume the output

What does NOT work yet (the "semantic" gap):
- Grouping is 100% LLM-driven. No deterministic backbone.
- Tags are a flat list (`alergia, control, vacuna, urgencia, cirugia, chequeo, sintoma`). No body-system axis.
- Two events that are clinically related (e.g. vómitos ene + diarrea feb) may end up in different episodes if Gemini doesn't connect them.
- Tutor cannot filter "todo lo digestivo del último año" — there is no axis to filter by.
- A cluster is not auditable: the criterion lives in a prompt.

## 2. The semantic model — Hybrid (Option D)

A `ClinicalEpisode` is defined by **two orthogonal axes**:

### Axis 1 — Body system (anatomical/functional)

A finite, versioned enum. Every event is mapped to ONE primary system. This is deterministic, rule-based, and reviewable.

```ts
type BodySystem =
  | "digestivo"        // vómitos, diarrea, gastritis, parásitos GI
  | "dermatologico"    // alergia cutánea, dermatitis, hongos, sarna
  | "musculoesqueletico" // cojera, fractura, displasia, artrosis
  | "respiratorio"     // tos, neumonía, bronquitis, asma
  | "urinario"         // ITU, cálculos, IRC, IRA
  | "reproductivo"     // celo, castración, parto, gestación
  | "neurologico"      // convulsiones, ataxia, parálisis
  | "oftalmologico"    // conjuntivitis, úlcera corneal, cataratas
  | "odontologico"     // sarro, gingivitis, extracción
  | "cardiovascular"   // soplo, ICC, arritmia
  | "oncologico"       // tumor, masa, biopsia
  | "endocrino"        // diabetes, hipotiroidismo, cushing
  | "infeccioso"       // moquillo, parvovirus, leptospirosis (sistémico)
  | "preventivo"       // vacunas, desparasitación, chequeo de rutina
  | "comportamental"   // ansiedad, agresión, evaluación etóloga
  | "general"          // chequeo general, peso, estado nutricional
  | "otro";            // fallback explícito
```

**Mapping table** (versioned in `functions/src/clinical/bodySystems.ts`):

```ts
const SYMPTOM_TO_SYSTEM: Record<string, BodySystem> = {
  "vómitos": "digestivo",
  "diarrea": "digestivo",
  "picazón": "dermatologico",
  "cojera": "musculoesqueletico",
  // … extensible, reviewable
};
```

### Axis 2 — Temporal window

An episode has a `period: { start, end }`. Events are clustered into the same episode if:
- They share the same `bodySystem`
- AND the gap between any two consecutive events is `≤ TEMPORAL_WINDOW_DAYS` (default: 30)

Two episodes of the same body system separated by >30 days = two distinct episodes.

### Resulting episode shape

```ts
interface ClinicalEpisodeV2 extends ClinicalEpisode {
  bodySystem: BodySystem;             // NEW — required
  bodySystemConfidence: number;       // 0..1, deterministic = 1, LLM-fallback < 1
  temporalWindowDays: number;         // 30 default, configurable per system (oncology might be 90)
  groupingReason: "deterministic" | "llm_assisted" | "tutor_override";
}
```

## 3. The hybrid pipeline

```
medical_events (raw)
   │
   ├─► Step 1: enrichEventWithBodySystem(event)
   │     deterministic mapping (symptom/category → bodySystem)
   │     fallback: LLM classifier ONLY if no rule matches
   │
   ├─► Step 2: clusterByTemporalWindow(events, system)
   │     pure function, no LLM
   │     sliding window per bodySystem
   │
   ├─► Step 3: generateNarrative(cluster)
   │     Gemini fills title/summary/diagnosis ONLY
   │     does NOT decide grouping
   │
   └─► persist clinical_episodes with bodySystem + groupingReason
```

**Inversion vs v1:** in v1 Gemini decides grouping AND writes narrative. In v2, deterministic logic decides grouping, Gemini only writes narrative on top of pre-clustered groups.

## 4. UX impact

### Timeline.tsx
- Add filter chip row at top: `Todos | Digestivo | Dermatológico | Preventivo | …` (only shows systems that have ≥1 episode for this pet)
- Each episode card shows the body system as a colored pill (token-based, Plano palette)
- Empty state per system: "Aún no hay episodios de [sistema] para [nombre]"

### ExportReportModal.tsx
- Section reordering: episodes grouped by body system, then chronological inside each
- Each section has a header with system name + total episodes count
- "Información que podría mejorar tu perfil" suggests systems with no events ("¿Tu mascota tuvo controles dentales este año?")

## 5. Migration

V1 episodes already in Firestore have no `bodySystem`. Migration:

1. **Backfill job** (one-time): `migrateClinicalEpisodesAddBodySystem`
   - Reads each existing `clinical_episodes` doc
   - Re-classifies using the deterministic mapper from its existing tags + diagnosis
   - Writes back `bodySystem`, `bodySystemConfidence`, `groupingReason: "deterministic"` (or `"llm_assisted"` if fallback)
   - Idempotent — safe to re-run
2. **Frontend**: render falls back to `bodySystem: "general"` if missing (no crash)
3. **No re-clustering** — preserve existing user-visible groupings to avoid Timeline rewriting itself overnight

## 6. Tests (mandatory before merge)

Backend (`functions/src/clinical/__tests__/episodeEngine.test.ts`):

1. `enrichEventWithBodySystem` returns `digestivo` for "vómitos"
2. `enrichEventWithBodySystem` falls back to LLM classifier for unknown symptom
3. `clusterByTemporalWindow` separates two `digestivo` events 35 days apart into 2 episodes
4. `clusterByTemporalWindow` keeps two `digestivo` events 10 days apart in 1 episode
5. Mixed-system events of same week → 2 episodes (one per system)
6. Empty input → empty array
7. Backfill: episode without `bodySystem` gets enriched, idempotent on re-run

Frontend (`Timeline.test.tsx`):
1. Filter chip "Digestivo" shows only digestivo episodes
2. Filter chip hides if pet has 0 episodes of that system
3. Episode card renders bodySystem pill
4. Episode card without bodySystem shows "general" pill (migration fallback)

## 7. Out of scope (this plan)

- Auto-suggesting visits to specialists per system
- Cross-pet episode comparison
- Owner-defined custom systems
- Rewriting v1 narrative output
- Changes to ExportReportModal narrative copy (covered by separate plan `2026-04-27-export-source-backed-safety-core.md`)

## 8. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Mapping table incomplete on day 1 | Start with top 20 symptoms covering ~80% of events. Log every LLM fallback for review. |
| LLM fallback misclassifies edge cases | Confidence < 1 surfaces in admin dashboard for manual relabel. |
| Body system feels too clinical, contradicts brand | UX uses friendly labels: "Digestivo" → tooltip "estómago, intestinos, alimentación". Plano tone preserved. |
| 30-day temporal window wrong for chronic conditions | Per-system override: `oncologico: 90`, `endocrino: 180`. |

## 9. Definition of done

- [ ] `bodySystems.ts` mapping table merged with ≥20 symptoms
- [ ] `enrichEventWithBodySystem` + `clusterByTemporalWindow` pure functions with tests
- [ ] `pessyCompileRecentEpisodes` v2 deployed, v1 archived behind feature flag
- [ ] Backfill job run successfully on staging, sampled audit OK
- [ ] Timeline filter chips live with Plano tokens
- [ ] No `bodySystem`-less episode renders broken
- [ ] QA pass with Mauricio's pet (real data) — at least 3 systems present
- [ ] Plan post-mortem updated in CLAUDE.md if any gotchas

## 10. Estimated effort

- Backend (mapping + clustering + tests): ~3 days
- Frontend (chips + pills + filter logic): ~2 days
- Backfill + QA: ~1 day
- Total: **~1 sprint week**
