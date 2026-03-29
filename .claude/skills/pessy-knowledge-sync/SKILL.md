---
name: pessy-knowledge-sync
description: "Consume and sync knowledge from NotebookLM notebooks into Pessy's codebase. Use this skill to query veterinary knowledge, pull domain expertise, research a topic for the cerebro, add sources to notebooks, or check what's in the knowledge base. Trigger on 'consultar NotebookLM', 'qué sabe Pessy de', 'buscar en los notebooks', 'agregar fuente', 'sync conocimiento', 'research', 'investigar', 'qué dice el notebook', 'knowledge base'."
---

# Pessy Knowledge Sync

Bridge between NotebookLM knowledge base and Pessy's codebase. Query notebooks for domain expertise, add new sources, and pull knowledge into code.

## Notebook Map

| Notebook | ID | Use For |
|----------|-----|---------|
| Veterinaria & Bienestar | `8bd4bb98-1342-4e9e-9cf5-8c07df513d00` | Thermal limits, breed care, nutrition, WSAVA guidelines |
| Producto & Reglas | `9e9f778d-76d4-440d-a433-fa04ca3f055e` | Business rules, architecture decisions, product flows |
| Farmacología Pet | `826d2f39-8301-4014-a0ad-2d75f6d9be91` | Medications, vaccines, dosages, treatments |
| Comportamiento & Training | `9ff99f62-0a5a-4a5a-adec-0ec0ef01f362` | Training methods, behavior profiles, socialization |
| Regulatorio & Compliance | `59456848-9e20-4f5a-95a6-3d88d27db942` | GDPR, data policies, security rules, consent |

## Core Operations

### 1. Query a Notebook

When you need domain knowledge to inform a decision or implementation:

```
mcp__notebooklm-mcp__notebook_query({
  notebook_id: "<id>",
  query: "<your question in natural language>"
})
```

**When to query which notebook:**
- "¿A qué temperatura es peligroso para un Husky?" → Veterinaria
- "¿Qué dosis de meloxicam para un gato de 4kg?" → Farmacología
- "¿Cómo socializar un cachorro reactivo?" → Comportamiento
- "¿Podemos guardar emails sin encriptar?" → Regulatorio
- "¿El motor proactivo cubre este caso?" → Producto

### 2. Add a Source

When the user provides new knowledge (URL, PDF, text):

**URL source (article, guide, paper):**
```
mcp__notebooklm-mcp__source_add({
  notebook_id: "<id>",
  source_type: "url",
  url: "<url>"
})
```

**Text source (pasted content, extracted knowledge):**
```
mcp__notebooklm-mcp__source_add({
  notebook_id: "<id>",
  source_type: "text",
  title: "<descriptive title>",
  text: "<content>"
})
```

**File source (PDF from disk):**
```
mcp__notebooklm-mcp__source_add({
  notebook_id: "<id>",
  source_type: "file",
  file_path: "<absolute path>"
})
```

**Multiple URLs at once:**
```
mcp__notebooklm-mcp__source_add({
  notebook_id: "<id>",
  source_type: "url",
  urls: ["<url1>", "<url2>", "<url3>"]
})
```

### 3. Check Notebook Contents

See what sources are loaded:
```
mcp__notebooklm-mcp__notebook_get({
  notebook_id: "<id>"
})
```

Get AI summary of what the notebook knows:
```
mcp__notebooklm-mcp__notebook_describe({
  notebook_id: "<id>"
})
```

### 4. Cross-Notebook Research

When a topic spans multiple domains (e.g., "puppy with skin condition" touches Veterinaria + Farmacología + Comportamiento):

```
mcp__notebooklm-mcp__cross_notebook_query({
  query: "<research question>",
  notebook_ids: ["<id1>", "<id2>", "<id3>"]
})
```

## Workflow: Research → Code

The typical flow for pulling notebook knowledge into Pessy code:

1. **Query** the relevant notebook(s)
2. **Validate** the response against trusted sources (WSAVA, AAHA, etc.)
3. **Extract** the deterministic rules (thresholds, limits, protocols)
4. **Implement** using the `pessy-cerebro-builder` skill
5. **Update** the notebook with the new code knowledge

This creates a bidirectional knowledge loop:
- Notebooks inform code (research → implementation)
- Code informs notebooks (new rules get synced back as sources)

## Adding Knowledge from Conversations

When the user shares veterinary knowledge, research findings, or domain expertise during a conversation:

1. Identify which notebook it belongs to
2. Format it clearly with structure and sources
3. Add it as a text source
4. Confirm what was added

Example:
> User: "Mi veterinario dice que para gatos persas el límite de calor es más bajo, como 28°C"

→ Add to Veterinaria & Bienestar as text source
→ Cross-reference with existing thermal profiles in wellbeingMasterBook
→ If validated, suggest updating the code via cerebro-builder

## Sync to Production (NotebookLM → Firestore → Brain)

The clinical brain (`knowledgeBase.ts`) reads from a Firestore collection `notebook_knowledge` at runtime. To push notebook knowledge into production:

### Step 1: Query NotebookLM for structured knowledge
```
mcp__notebooklm-mcp__notebook_query({
  notebook_id: "<id>",
  query: "Give me all key clinical facts, thresholds, and protocols as structured bullet points"
})
```

### Step 2: Format as sync sections
Structure each piece of knowledge as:
```json
{
  "id": "unique_section_id",
  "notebook": "veterinaria|farmacologia|comportamiento|producto|compliance",
  "title": "Short descriptive title",
  "body": "Clinical content — facts, thresholds, protocols",
  "keywords": ["keyword1", "keyword2"],
  "priority": 80
}
```

### Step 3: Push to Firestore via Cloud Function
```bash
curl -X POST https://us-central1-polar-scene-488615-i0.cloudfunctions.net/syncNotebookKnowledge \
  -H "Content-Type: application/json" \
  -H "x-force-sync-key: <GMAIL_FORCE_SYNC_KEY>" \
  -d '{
    "sections": [...],
    "replace_notebook": "veterinaria"
  }'
```

Or via the Firebase plugin:
```
mcp__plugin_firebase_firebase__firestore_add_document({
  collection: "notebook_knowledge",
  data: { id, notebook, title, body, keywords, priority, active: true, synced_at: new Date().toISOString() }
})
```

### How the brain uses it
1. `knowledgeBase.ts` → `fetchNotebookKnowledge()` queries `notebook_knowledge` collection
2. Scores sections by keyword match against the clinical query
3. Top 5 sections injected into the brain prompt as `CONTEXTO NOTEBOOK KNOWLEDGE`
4. Brain uses this context alongside local knowledge sections and external sources

### When to sync
- After adding significant new sources to a notebook
- After the user validates new clinical knowledge
- When the user says "sync", "push to production", or "actualizar cerebro"

## Keeping Notebooks Fresh

Periodically (or when the user asks), check notebook health:

1. List sources in each notebook
2. Identify gaps (e.g., "Farmacología has no info on antiparasitarios")
3. Suggest URLs or content to add
4. Sync any code changes back to notebooks

## What NOT to Do

- Don't blindly trust notebook answers for safety rules — always cross-reference
- Don't add duplicate sources (check existing ones first)
- Don't put raw code as notebook sources — summarize in human-readable format
- Don't skip the validation step before implementing in code
