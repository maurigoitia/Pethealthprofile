---
name: pessy-feature-review
description: "Review any new Pessy feature, PR, or code change against architecture, cerebro rules, security, and UX patterns. Use this skill whenever implementing a new feature, reviewing a PR, finishing a task, or before merging — even for small changes. Also trigger when the user says 'revisar', 'review', 'está bien esto?', 'chequear feature', or 'validar cambios'."
---

# Pessy Feature Review

Validate any new feature or code change against Pessy's architecture, cerebro intelligence rules, security pipeline, and UX patterns before it ships.

## Why This Matters

Pessy has a golden rule: "Lógica determinística con piel generativa" — security rules are hardcoded, AI only writes the human-facing message, never decides the rule. A bad feature can break this contract, expose patient data, or make the cerebro dumb. This review catches those issues early.

## Review Checklist

For every feature, check these 6 dimensions:

### 1. Architecture Alignment
- Does it respect the 4 core flows? (ingesta asíncrona, memoria episódica, motor proactivo, multi-tenancy)
- Does it use the correct Firestore collections?
- Does it follow the existing stack? (React 18 + TS + Vite 6 + Tailwind v4 + Firebase Functions Node 22)
- New backend logic goes in `functions/src/`, new frontend in `src/`

### 2. Cerebro Rules
- Query NotebookLM notebook **Producto & Reglas de Negocio** (ID: `9e9f778d-76d4-440d-a433-fa04ca3f055e`) for current product rules
- Does the feature respect the wellbeingMasterBook guardrails?
- If it adds intelligence: is the logic deterministic? Does it only use AI for copy/redaction?
- If it touches training: does it respect positive_only reinforcement and prohibited tools?
- If it adds thermal/food/anxiety rules: are they hardcoded, not AI-decided?
- Run the training set (`pessyIntelligenceTrainingSet.ts`) — do all 4 cases still pass?

### 3. Security & Compliance
- Query NotebookLM notebook **Regulatorio & Compliance** (ID: `59456848-9e20-4f5a-95a6-3d88d27db942`) for current compliance rules
- Does it handle user data correctly? (encryption, destruction post-processing)
- Does it respect Firestore security rules? (owner + co-tutor access only)
- Does it expose any PII or clinical data inappropriately?
- NEVER modify `auth/login/firebase.ts` without explicit user approval + QA

### 4. UX Consistency
- Does it follow the existing design language? (Plus Jakarta Sans, green #074738, rounded corners 2rem)
- Does it work on mobile (Capacitor v7)?
- Does it handle loading/error states?
- Is copy in Argentine Spanish ("vos", informal)?

### 5. Data Model
- Are Firestore reads/writes efficient? (no unbounded queries)
- Does it create new collections? If so, are security rules defined?
- Does it respect the pet ownership model? (owner + co-tutores array)

### 6. Regression Check
- Read changed files with `git diff`
- Check if existing tests still pass
- Verify the intelligence engine training set passes:
  ```typescript
  import { runPessyIntelligenceTrainingSet } from './src/domain/intelligence/pessyIntelligenceTrainingSet';
  const result = runPessyIntelligenceTrainingSet();
  // All 4 cases must pass: thor_heat, lola_puppy, milo_anxiety, nori_heat
  ```

## How to Use NotebookLM During Review

When reviewing features that touch product rules or compliance:

```
// Query product rules
mcp__notebooklm-mcp__notebook_query({
  notebook_id: "9e9f778d-76d4-440d-a433-fa04ca3f055e",
  query: "<what the feature does>"
})

// Query compliance
mcp__notebooklm-mcp__notebook_query({
  notebook_id: "59456848-9e20-4f5a-95a6-3d88d27db942",
  query: "<security concern>"
})
```

## Output Format

Present the review as:

```
## Feature Review: [nombre]

### ✅ Passed
- [dimension]: [detail]

### ⚠️ Warnings
- [dimension]: [detail + suggestion]

### ❌ Blockers
- [dimension]: [detail + what to fix]

### Verdict: SHIP / FIX FIRST / BLOCK
```

## When NOT to Use This Skill
- Pure documentation changes (README, comments only)
- Dependency updates with no code changes
- Git/config changes that don't touch app code
