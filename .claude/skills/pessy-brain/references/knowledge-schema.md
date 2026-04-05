# Knowledge Schema — notebook_knowledge

## Firestore Collection: `notebook_knowledge`

Cada documento representa una sección de conocimiento sincronizada desde NotebookLM.

### Estructura del documento

```typescript
interface KnowledgeSection {
  id: string;                    // ID único (ej: "vet-vacc-protocol-001")
  notebook: NotebookCategory;    // Categoría del notebook
  title: string;                 // Título descriptivo
  body: string;                  // Contenido completo en texto plano o markdown
  keywords: string[];            // Keywords para scoring de relevancia
  priority: number;              // 1-10 (10 = máxima prioridad)
  active: boolean;               // Si la sección está activa
  sync_version: number;          // Versión de sincronización
  synced_at: Timestamp;          // Fecha de última sincronización
}

type NotebookCategory =
  | "veterinaria"      // Protocolos clínicos, diagnósticos
  | "farmacologia"     // Medicamentos, dosis, interacciones
  | "comportamiento"   // Comportamiento canino/felino
  | "producto"         // Features PESSY, roadmap, decisiones
  | "nutricion"        // Dietas, alimentos seguros/tóxicos
  | "emergencias"      // Urgencias, primeros auxilios
  | "bienestar";       // Rutinas, ejercicio, prevención
```

### Endpoint de sincronización

```
POST /syncNotebookKnowledge
Authorization: Bearer {GMAIL_FORCE_SYNC_KEY}
Content-Type: application/json

{
  "sections": [
    {
      "id": "vet-vacc-protocol-001",
      "notebook": "veterinaria",
      "title": "Protocolo de vacunación canina estándar",
      "body": "El protocolo de vacunación canina incluye...",
      "keywords": ["vacunación", "cachorro", "parvovirus", "moquillo", "rabia"],
      "priority": 9
    }
  ],
  "replace_notebook": "veterinaria"  // opcional: desactiva secciones existentes antes de escribir
}
```

### Resolución de contexto clínico

La función `resolveClinicalKnowledgeContext()` en `knowledgeBase.ts`:

1. Recibe keywords de la consulta actual
2. Busca en Firestore secciones `active: true`
3. Calcula score por coincidencia de keywords
4. Retorna hasta 10 secciones más relevantes
5. Estructura el contexto como `ClinicalKnowledgeContext`:

```typescript
interface ClinicalKnowledgeContext {
  sectionIds: string[];    // IDs de secciones usadas
  notebook: string;        // Notebook fuente principal
  contextText: string;     // Texto concatenado para inyectar al AI
}
```

Este contexto se inyecta al `groundedBrain.ts` para que Vertex AI/Claude generen respuestas fundamentadas en el conocimiento verificado.
