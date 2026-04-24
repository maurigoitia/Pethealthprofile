# Reglas para curar `learning-videos.csv`

## Por qué este archivo existe

Pessy reemplazó las "sugerencias estáticas hardcodeadas" (DailyHookCard) por
videos educativos curados manualmente. Por la regla **firme** del producto:

> No inventar nada. Cada URL tiene que existir, ser verificable y no provenir
> de una app competidora.

El seed inicial que generó un subagente tenía **3 URLs ficticias** (los IDs no
existen en YouTube — confirmado vía `oembed`). Se borraron por esa razón.

## Cómo curar un video correctamente

### 1. Buscar el video en un canal confiable

**Idiomas + canales sugeridos** (todos verificados oficiales):

**Español (es):**
- `American Kennel Club` (canal en español, AKC)
- `Royal Canin España`
- `Mundo Animal Tv`
- `Veterinaria Tudo Junto`
- `Drauzio Varella` (medicina veterinaria seria)
- `Manolo Tarancón` (etología canina, Madrid)

**Inglés (en):**
- `American Kennel Club`
- `Kikopup` (positive reinforcement training)
- `Zak George's Dog Training Revolution`
- `Jackson Galaxy` (cats)
- `Cornell Feline Health Center`
- `VCA Animal Hospitals`

**Francés (fr):**
- `Royal Canin France`
- `Wamiz`
- `30 Millions d'Amis`
- `Esprit Dog`

**Portugués (pt):**
- `Petlove`
- `Cobasi`
- `Cão Cidadão`
- `Adestramento Inteligente`

**No usar (apps competidoras):**
- Pawtrack
- 11pets
- Petbuddy / PetBuddy
- Pet Cloud / PetCloud
- Paw AI
- Petdesk
- Cualquier app de pet care que ofrezca "tracker" como feature core

### 2. Verificar que el URL existe

Comando exacto:

```bash
VIDEO_ID="abcDEF123"  # los 11 chars después de v=
curl -sA "Mozilla/5.0" "https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=$VIDEO_ID&format=json"
```

Si devuelve JSON con `title` y `author_name` → ✅ existe
Si devuelve `Not Found` → ❌ NO usar

### 3. Extraer metadata oficial

Del response oembed:
- `title` (puede tener emojis — limpiar antes de poner en CSV)
- `author_name` → confirma que es del canal correcto
- `thumbnail_url` → usar tal cual o la versión `hqdefault`

Para `durationSeconds`, abrir el video en YouTube y leer la duración (no hay
oembed que la devuelva).

### 4. Llenar la fila CSV

Columnas obligatorias:

| Campo | Ejemplo | Notas |
|---|---|---|
| `title` | "Cómo administrar pastillas a tu perro" | Plain text, sin emojis |
| `provider` | `youtube` | siempre `youtube` por ahora |
| `url` | `https://www.youtube.com/watch?v=ABC123` | URL completa, verificada |
| `thumbnailUrl` | `https://i.ytimg.com/vi/ABC123/hqdefault.jpg` | construir con video ID |
| `durationSeconds` | `214` | número entero |
| `language` | `es` | uno de: es, en, fr, pt |
| `species` | `dog` | uno de: dog, cat, rabbit, bird, reptile |
| `conditions` | `dermatitis,alergia` | coma-separado o vacío |
| `ageRangeMinMonths` | `0` | vacío = todas las edades |
| `ageRangeMaxMonths` | `12` | vacío = todas |
| `tags` | `medicacion,rutina` | tags libres coma-separados |
| `active` | `true` | `false` para desactivar sin borrar |

### 5. Cobertura mínima recomendada para launch

- **Cachorro/general** (es, en): 4-6 videos
- **Adulto sano** (es, en): 4-6 videos
- **Senior** (es, en): 2-3 videos
- **Gatos** (es, en): 4-6 videos
- **Por condición común** (alergias, sobrepeso, ansiedad): 3-5 videos

Total inicial sugerido: **15-25 videos verificados**.

### 6. Ejecutar el seed

Una vez el CSV está poblado y verificado:

```bash
# Borrar las líneas que empiezan con # del CSV (los comentarios de reglas)
grep -v "^#" seed/learning-videos.csv > /tmp/clean.csv && mv /tmp/clean.csv seed/learning-videos.csv

# Ejecutar el upsert a Firestore
GOOGLE_APPLICATION_CREDENTIALS=~/.config/gcloud/application_default_credentials.json \
  npx tsx scripts/seed-learning-videos.ts
```

## Mantenimiento posterior

- Revisar trimestralmente que las URLs sigan vivas (el script puede checkear
  con HEAD request)
- Marcar `active=false` los que YouTube haya bajado, no borrar (mantiene
  histórico de qué se mostraba)
- Agregar nuevos videos cuando aparezca contenido relevante (ej. una vacuna
  nueva entra al calendario, agregar video que la explique)
