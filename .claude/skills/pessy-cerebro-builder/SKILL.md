---
name: pessy-cerebro-builder
description: "Expand Pessy's generative brain — add new rules to wellbeingMasterBook, new cases to training set, new signals to the intelligence engine, new knowledge to the clinical knowledge base. Use this skill when the user wants to add pet care knowledge, expand breed profiles, add new safety rules, create new intelligence modules, add medications, or improve the cerebro. Also trigger on 'agregar regla', 'nuevo módulo', 'expandir cerebro', 'nueva raza', 'agregar conocimiento', 'cerebro', 'master book', 'intelligence engine'."
---

# Pessy Cerebro Builder

Safely expand Pessy's intelligence engine with new knowledge, rules, and modules. The cerebro is Pessy's competitive moat — this skill ensures every expansion follows the golden rule and doesn't break existing intelligence.

## The Golden Rule (Non-Negotiable)

> "Lógica determinística con piel generativa"

- Security/safety rules are ALWAYS hardcoded (TypeScript constants, if/else, thresholds)
- AI (Gemini, Vertex) ONLY writes the human-facing message
- AI NEVER decides whether to block, alert, or recommend — that's code

If you're about to let an LLM make a safety decision, STOP. Hardcode it.

## Before Any Change

1. Read the current state of the file you'll modify
2. Run the training set to get a baseline score:
   ```typescript
   runPessyIntelligenceTrainingSet() // must be 4/4 (100%)
   ```
3. Query NotebookLM for domain knowledge to inform the change

## What You Can Build

### A. New Rules in wellbeingMasterBook

**File:** `src/domain/wellbeing/wellbeingMasterBook.ts`

Types of rules:
- `thermal_safety.groups` — new breed thermal profiles
- `food_safety.prohibited` — new toxic foods
- `separation_anxiety.do_first/never_do` — anxiety protocols
- `daily_suggestions` — new activity suggestions by group + weather
- `routines` — new routine templates by group
- `breed_profiles.groups` — new breed behavior profiles

**Pattern for adding a thermal profile:**
```typescript
{
  id: "dog.giant",  // new WellbeingSpeciesGroupId
  label: "Perros gigantes",
  appliesTo: ["Gran Danés", "San Bernardo", "Mastín"],
  comfortableMinC: 5,
  comfortableMaxC: 26,
  avoidExerciseAboveC: 30,
  severeRiskAboveC: 32,
  collapseBodyTempC: 41,
  humiditySensitive: false,
  earlySigns: ["...", "...", "..."],
  prevention: ["...", "...", "..."],
  kind: "guardrail",     // hard_fact | soft_trait | guardrail
  guardrailType: "alert", // block | alert | recommendation
}
```

Before adding: query **Veterinaria & Bienestar** notebook:
```
mcp__notebooklm-mcp__notebook_query({
  notebook_id: "8bd4bb98-1342-4e9e-9cf5-8c07df513d00",
  query: "<breed> thermal limits temperature"
})
```

### B. New Intelligence Module

**File:** `src/domain/intelligence/pessyIntelligenceEngine.ts`

Each module in `runPessyIntelligence()` follows this pattern:
1. Check input conditions (deterministic)
2. Look up data from master books (deterministic)
3. Push recommendation to array with: id, code, title, detail, slot, icon, kind, sourceModule

**To add a new module:**
1. Define the input fields needed in `PessyIntelligenceInput`
2. Add the logic block inside `runPessyIntelligence()`
3. Add at least 1 training case that exercises the new module
4. The `code` field must be unique across all modules

### C. New Training Cases

**File:** `src/domain/intelligence/pessyIntelligenceTrainingSet.ts`

Every new module MUST have at least one training case:
```typescript
{
  id: "rex_giant_heat",
  label: "Rex · gigante con calor",
  input: {
    petName: "Rex",
    species: "dog",
    breed: "Gran Danés",
    ageLabel: "3 años",
    groupIds: ["dog.giant"],
    temperatureC: 33,
    humidityPct: 60,
  },
  expectedCodes: ["avoid_walk_heat", "indoor_play_heat", "practice_wait_signal"],
  expectedSegmentId: "companion",
}
```

### D. Clinical Knowledge Base Expansion

**File:** `functions/src/clinical/knowledgeBase.ts`

Add new `KnowledgeSection` entries with:
- Unique `id`
- `priority` (60-100, higher = more important)
- `keywords` for matching
- `body` with clinical content

Before adding: query **Farmacología Pet** notebook:
```
mcp__notebooklm-mcp__notebook_query({
  notebook_id: "826d2f39-8301-4014-a0ad-2d75f6d9be91",
  query: "<medication or condition>"
})
```

### E. Training Master Book Expansion

**File:** `src/domain/training/training_master_book.ts`

Add new segments or expand existing ones. Always:
- Use `positive_reinforcement` only
- Include guardrails
- Never allow aversive tools

Before adding: query **Comportamiento & Training** notebook:
```
mcp__notebooklm-mcp__notebook_query({
  notebook_id: "9ff99f62-0a5a-4a5a-adec-0ec0ef01f362",
  query: "<training topic>"
})
```

## After Every Change

1. Run the training set — ALL cases must pass
2. If you added a new module, verify the new case passes too
3. Update the corresponding NotebookLM notebook with the new knowledge:
   ```
   mcp__notebooklm-mcp__source_add({
     notebook_id: "<relevant notebook>",
     source_type: "text",
     title: "<descriptive title>",
     text: "<the new knowledge added>"
   })
   ```
4. Explain what was added, why, and what it enables

## NotebookLM Notebook IDs (Quick Reference)

| Notebook | ID |
|----------|-----|
| Veterinaria & Bienestar | `8bd4bb98-1342-4e9e-9cf5-8c07df513d00` |
| Producto & Reglas | `9e9f778d-76d4-440d-a433-fa04ca3f055e` |
| Farmacología Pet | `826d2f39-8301-4014-a0ad-2d75f6d9be91` |
| Comportamiento & Training | `9ff99f62-0a5a-4a5a-adec-0ec0ef01f362` |
| Regulatorio & Compliance | `59456848-9e20-4f5a-95a6-3d88d27db942` |
