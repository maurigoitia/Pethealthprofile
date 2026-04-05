# Motor de Recomendaciones de Lugares

## Lo que YA existe

PESSY ya tiene infraestructura de lugares:

**NearbyVets screen:**
- Google Places API integrada con geolocalización
- Distancia y sorting por proximidad
- Estado abierto/cerrado
- Ratings y reviews de Google
- Links a Google Maps

**PetContext.preferences:**
- `favoritePlaces: string[]` — Google Places IDs ya guardados
- `favoriteActivities: string[]` — walk, park, cafe, beach, hiking, playdate, training, swim

Esto significa que ya tenemos la tubería de Google Places y las preferencias del usuario. Solo hay que expandir.

## Expansión: de "Vets" a "Experiencias"

### Nuevas categorías (además de vets)

| Categoría | Subcategorías | Google Places type |
|-----------|--------------|-------------------|
| `cafe` | pet-friendly, terraza, garden | cafe, bakery |
| `park` | parque, dog park, espacio cerrado | park |
| `vet` | ✅ YA EXISTE — general, emergencias, especialista | veterinary_care |
| `shop` | pet food, accesorios, ropa, juguetes | pet_store |
| `grooming` | baño, corte, spa | — (custom) |
| `hotel` | pet-friendly, guardería, daycare | lodging |
| `restaurant` | terraza pet-friendly, indoor | restaurant |
| `outdoor` | playa, sendero, montaña | — (custom) |
| `event` | meetup, feria, carrera | — (custom) |
| `training` | escuela, entrenador, agility | — (custom) |

Las categorías con Google Places type se pueden seedear automáticamente. Las custom necesitan ingesta manual o de la comunidad.

## Implementación — Expandir NearbyVets

En vez de crear una nueva pantalla desde cero, la estrategia es:

1. **Renombrar** NearbyVets → NearbyPlaces (o "Explorar")
2. **Agregar tabs/filtros** por categoría (vets, cafés, parques, shops, etc.)
3. **Reusar** la misma infraestructura de Google Places API
4. **Agregar** scoring personalizado encima de los resultados de Google

### Motor de scoring personalizado

```typescript
interface RecommendationScore {
  placeId: string;              // Google Places ID (compatible con favoritePlaces existente)
  userId: string;
  finalScore: number;           // 0-100
  
  components: {
    preference_match: number;   // 0-30 — tags del dueño + favoriteActivities de la mascota
    proximity: number;          // 0-25 — distancia (ya calculada en NearbyVets)
    rating: number;             // 0-15 — Google rating normalizado (ya existe)
    pet_compatibility: number;  // 0-15 — petPolicy vs tamaño/personalidad mascota
    context: number;            // 0-15 — hora + clima + día de semana
  };
  
  reason: string;               // "Porque te gustan los cafés y {nombre} es social"
}
```

### Scoring de preference_match (0-30)
Cruza `UserLifestyleProfile.tags` + `PetContext.preferences.favoriteActivities`:
- `café_lover` (tag) + lugar tipo `cafe` = +15
- `favoriteActivities.includes('park')` + lugar tipo `park` = +15
- `personality.includes('social')` + lugar con dog park = +10
- Matches secundarios: +5 cada uno, max 15

### Scoring de proximity (0-25)
Ya calculado en NearbyVets. Reusar:
- < 1km = 25 · 1-3km = 20 · 3-5km = 15 · 5-10km = 10 · > 10km = 5

### Scoring de context (0-15)
- Mañana + outdoor = +10 · Mediodía + café/restaurant = +10
- Fin de semana → boost eventos y outdoor
- Lluvia → boost indoor, penalizar outdoor
- `walkTimes` del PetContext → boost si coincide con horario habitual

## Firestore — Places collection

Para lugares que NO vienen de Google Places (custom, community-submitted):

```typescript
// Colección: places
interface PessyPlace {
  id: string;
  googlePlaceId?: string;        // si viene de Google, linkeamos
  name: string;
  category: PlaceCategory;
  
  location: GeoPoint;
  address: string;
  neighborhood: string;
  
  petPolicy: {
    dogsAllowed: boolean;
    catsAllowed: boolean;
    sizeRestriction?: 'small_only' | 'medium_max' | 'all';
    outdoorOnly: boolean;
    waterAvailable: boolean;
  };
  
  // Rating PESSY (además del de Google)
  pessyRating: number;
  pessyReviewCount: number;
  pessyVerified: boolean;
  
  addedBy: string;
  addedAt: Timestamp;
  active: boolean;
}
```

## Feedback loop

| Acción del usuario | Efecto en el motor |
|--------------------|--------------------|
| Tap en recomendación | +1 score a esa categoría |
| "No me interesa" | -2 categoría, ajustar tags |
| Check-in confirmado | +5 score + reforzar tags + puntos gamificación |
| Agregar a favoritePlaces | Sync con PetContext existente + boost permanente |
| Dejar review | +10 puntos gamificación + data para comunidad |

## Plan gating

- **Free**: NearbyVets (ya existe) + 2 recomendaciones extra por día
- **Premium**: Todas las categorías + 5 recomendaciones + push proactivas + reviews

## Fuentes de datos

1. **Google Places API** (ya integrada) — vets, cafés, parques, restaurants, shops
2. **Comunidad PESSY** — usuarios sugieren → moderación → publicar
3. **NotebookLM** notebook `lugares` — directorio curado manualmente
4. **Partners** — negocios se registran como "PESSY verified"
