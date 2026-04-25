# Spec — Learning Videos (reemplaza sugerencias estáticas)

## Problema

Hoy el Home muestra `DailyHookCard` con textos hardcodeados sobre training/grooming/tips genéricos. Ocupan espacio, no tienen IA, no tienen acción útil, y duplican lo que ya vive en `/rutinas-eco`. El dueño ya dijo textualmente:

> "sugerencias estáticas están mal, no tienen IA y no cumplen función, no tiene acción. Habíamos hablado una vez de mostrar enlace a video de enseñanza"

## Solución

Reemplazar los tips estáticos por **videos de enseñanza reales** (YouTube / curados), matcheados a la mascota por especie + condiciones + edad.

## Arquitectura

### Colección Firestore: `learningVideos`

Schema:
```ts
interface LearningVideo {
  id: string;
  title: string;                          // "Cómo administrar pastillas a tu perro"
  provider: "youtube" | "vimeo" | "web";
  url: string;                            // URL directa
  thumbnailUrl: string;                   // preview
  durationSeconds: number;
  language: "es" | "en";
  // Matching criteria (null = no restringe)
  species: ("dog" | "cat" | "rabbit" | "bird" | "reptile")[] | null;
  conditions: string[];                   // normalized: ["diabetes", "artritis", "dermatitis"]
  ageRange: { minMonths?: number; maxMonths?: number } | null;
  // Metadata
  curator: string;                        // quién lo curó (Mauri, admin)
  curatedAt: Timestamp;
  verifiedVet: boolean;                   // si fue revisado por un vet
  tags: string[];                         // libres: "alimentación", "medicación", "rutina"
  active: boolean;                        // para ocultar sin borrar
}
```

**Seed inicial**: 20-30 videos curados manualmente (tú + yo te armo template CSV).

### Algoritmo de recomendación (client-side, sin AI)

Simple y determinístico:

```ts
function pickVideosForPet(pet: Pet, conditions: ClinicalCondition[], allVideos: LearningVideo[]): LearningVideo[] {
  return allVideos
    .filter(v => v.active)
    .filter(v => !v.species || v.species.includes(pet.species))
    .filter(v => !v.ageRange || matchesAge(pet.age, v.ageRange))
    .map(v => ({ video: v, score: scoreMatch(v, pet, conditions) }))
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(x => x.video);
}

function scoreMatch(v, pet, conditions): number {
  let score = 0;
  // +10 por cada condición activa que matchea
  for (const c of conditions) {
    if (v.conditions.includes(normalize(c.name))) score += 10;
  }
  // +2 si species match exacto (no null)
  if (v.species?.includes(pet.species)) score += 2;
  // +1 si edad match
  if (v.ageRange && matchesAge(pet.age, v.ageRange)) score += 1;
  return score;
}
```

**Sin match → no mostrar sección.** Nunca default a "video genérico de cuidado".

### UI: `LearningVideoCard`

Reemplaza los `DailyHookCard` en la home:
- Thumbnail 16:9 con play overlay
- Título 2 líneas max
- Duración + chip provider (YouTube / Vimeo)
- Chip condición matcheada si aplica: "Relacionado con artritis"
- Tap → abre `url` en nueva pestaña (`target="_blank" rel="noopener"`)

Sección: "Aprendé sobre {pet.name}" con 1-3 videos. Si 0 matches → sección oculta.

## Plan de implementación

| Fase | Qué | Tiempo |
|---|---|---|
| **A** | Schema Firestore + security rules (read all authed, write solo admin) | 20min |
| **B** | Seed CSV template + script upload a Firestore | 45min |
| **C** | Curar 20 videos reales (yo te doy template, tú los buscas en YouTube) | 1-2h USER |
| **D** | Hook `useLearningVideos(pet)` + componente `LearningVideoCard` | 1h |
| **E** | Integrar en PetHomeView, reemplazando bloque de DailyHookCard | 30min |
| **F** | Remover / deprecate `DailyHookCard` del bundle | 15min |

Total dev: ~3h. Content (USER): 1-2h una vez, iterable después.

## Seed CSV template

```csv
title,provider,url,thumbnailUrl,durationSeconds,language,species,conditions,ageRangeMinMonths,ageRangeMaxMonths,tags,verifiedVet
"Cómo administrar pastillas a tu perro","youtube","https://youtu.be/...","https://i.ytimg.com/vi/.../hqdefault.jpg",180,"es","dog","","","medicacion,rutina","false"
"Dermatitis atópica en perros: señales","youtube","https://youtu.be/...","https://i.ytimg.com/vi/.../hqdefault.jpg",420,"es","dog","dermatitis,alergia","","","salud","true"
"Nutrición del gato senior","youtube","https://youtu.be/...","https://i.ytimg.com/vi/.../hqdefault.jpg",300,"es","cat","","120","","alimentacion","true"
```

Yo te armo el CSV inicial con las condiciones normalizadas esperadas (misma lista que usa `clinical_conditions`).

## Riesgos

1. **Videos de YouTube borrados**: si el curator elige un video que después se toma down, aparece tile roto. Mitigación: cron weekly que checkea `url` con HEAD request y flaggea `active: false`. POSTPONE al launch.
2. **Calidad variable**: algunos videos pueden ser largos/informales. Mitigación: flag `verifiedVet` visible en UI ("Revisado por veterinario").
3. **Escalar el seed**: 30 videos cubre los casos frecuentes. Para long-tail (condiciones raras), el usuario ve la sección vacía — que es el comportamiento correcto según la regla.

## Non-negotiables

- No inventar videos.
- No generar títulos/descripciones con IA (solo curados).
- Tap abre en nueva pestaña (no incrusta iframe — CSP + perf).
- Solo se muestra sección si hay match real (≥1 video con score > 0).

## Decisiones pendientes para el dueño

1. **Quién cura los videos iniciales?** Tu personalmente, un vet amigo, o mezcla?
2. **¿Queremos chip "Revisado por vet"?** Si sí, necesitamos workflow de revisión (o marca manual).
3. **¿Tipo de CTA final?** Solo "Ver video" o agregar "Guardar para después" (bookmark)? Bookmark = otra colección, scope creep — propongo dejarlo afuera.
4. **¿Remover `DailyHookCard` del bundle o dejarlo deprecated?** Yo voto remover (ahorra bundle).

## Relación con Prioridad 3 (extractVets)

Ambos alimentan `/cuidados` y `/buscar-vet`. No se bloquean entre sí — pueden ir en paralelo. El matching de videos usa `clinical_conditions` que ya existe (alimentada por el pipeline de ingesta actual).
