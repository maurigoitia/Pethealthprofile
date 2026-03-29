# Lugares y Recomendaciones — PESSY Knowledge Base

## Categorías de lugares
| Categoría | Icono | Ejemplos |
|---|---|---|
| cafe | local_cafe | Cafés pet-friendly, brunch spots |
| park | park | Parques, plazas, áreas verdes |
| vet | local_hospital | Veterinarias, clínicas, emergencias 24h |
| shop | shopping_bag | Pet shops, tiendas de accesorios |
| grooming | content_cut | Peluquerías, baño, spa canino |
| restaurant | restaurant | Restaurantes con espacio para mascotas |
| outdoor | terrain | Senderos, playas, camping pet-friendly |
| hotel | hotel | Alojamiento que acepta mascotas |
| training | school | Escuelas de adiestramiento, puppy class |
| event | event | Eventos pet-friendly, ferias, meetups |

## Motor de scoring
El score de recomendación combina 5 factores:

### 1. Preference Match (peso: 30%)
- Tags del usuario (café_lover, runner, premium_buyer, etc.)
- Actividades favoritas de la mascota (walk, park, cafe, beach)
- Historial de lugares visitados
- Scoring: coincidencia directa = 1.0, categoría similar = 0.5

### 2. Proximidad (peso: 25%)
- Distancia desde ubicación actual del usuario
- Score: <1km = 1.0, 1-3km = 0.8, 3-5km = 0.5, 5-10km = 0.3, >10km = 0.1
- Ajuste por medio de transporte habitual (a pie vs auto)

### 3. Rating (peso: 15%)
- Rating Google Places (1-5 estrellas)
- Rating comunidad PESSY (cuando exista)
- Ponderado: PESSY rating pesa más si hay >10 reviews
- Score: rating/5

### 4. Pet Compatibility (peso: 15%)
- ¿El lugar acepta mascotas? (obligatorio)
- ¿Tiene espacio adecuado para el tamaño de la mascota?
- ¿Tiene agua disponible?
- ¿Es seguro (cercado, lejos de tráfico)?
- Scoring: todos los criterios cumplidos = 1.0, parcial = 0.5

### 5. Contexto (peso: 15%)
- Hora del día (brunch spot mañana, parque tarde)
- Clima (interior si llueve, sombra si calor)
- Día de semana vs fin de semana
- Temporada (playa verano, indoor invierno)

## Razones personalizadas — Ejemplos
Las recomendaciones siempre llevan una razón explícita:
- "Porque te gustan los cafés pet-friendly" (tag: café_lover)
- "A {nombre} le encanta pasear — este parque tiene zona off-leash" (activity: walk)
- "Está a 800m de tu zona habitual" (proximidad)
- "Rating 4.8 en la comunidad PESSY" (rating alto)
- "Ideal para el fin de semana con lluvia" (contexto: indoor + weather)

## Plan gating
| Feature | Free | Premium |
|---|---|---|
| Recomendaciones/día | 2 | Ilimitadas |
| Categorías visibles | vet, park | Todas |
| Push proactivas de lugares | No | Sí |
| Reviews de la comunidad | Leer | Leer + escribir |
| Filtros avanzados | No | Sí |
