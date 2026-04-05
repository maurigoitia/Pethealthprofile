# Mascotas Perdidas + Adopción

## Mascotas Perdidas

### Flujo del dueño (reportar)

1. Tap "Mi mascota se perdió" → formulario rápido
2. Auto-fill con datos de la mascota (foto, nombre, raza, color, tamaño)
3. Agregar: última ubicación conocida, hora, detalles extra
4. Publicar → alerta geolocalizada

### Flujo de la comunidad (buscar)

1. Push notification a usuarios en radio de 5km (configurable)
2. Feed de mascotas perdidas en la zona, ordenado por cercanía y recencia
3. Botón "La vi" → formulario de avistamiento (ubicación, hora, foto opcional)
4. Cada avistamiento notifica al dueño en tiempo real

### Firestore Schema

```typescript
// Colección: lost_pets
interface LostPetReport {
  id: string;
  petId: string;                  // ref a mascota registrada
  ownerId: string;
  status: 'active' | 'found' | 'expired';
  
  // Datos de la mascota (snapshot al momento del reporte)
  petSnapshot: {
    name: string;
    species: 'dog' | 'cat';
    breed: string;
    color: string;
    size: 'small' | 'medium' | 'large';
    photoUrls: string[];
    distinctiveFeatures: string;  // "collar rojo", "cicatriz en oreja"
  };

  // Ubicación y tiempo
  lastSeenLocation: GeoPoint;
  lastSeenAddress: string;        // dirección legible
  lastSeenAt: Timestamp;
  searchRadius: number;           // km, default 5
  
  // Metadata
  reportedAt: Timestamp;
  updatedAt: Timestamp;
  expiresAt: Timestamp;           // auto-expire a 30 días
  viewCount: number;
  sightingCount: number;
}

// Colección: lost_pet_sightings
interface PetSighting {
  id: string;
  lostPetId: string;              // ref al reporte
  reporterId: string;             // quién lo vio
  location: GeoPoint;
  address: string;
  seenAt: Timestamp;
  photoUrl?: string;
  notes: string;
  verified: boolean;              // el dueño confirma que es su mascota
}
```

### Notificaciones push geolocalizadas

Para no spamear a 50K usuarios, las notificaciones se mandan en batch por zona:

1. Al publicar: push inmediato a usuarios en radio de 2km
2. A los 30 min: expandir a 5km si no hay avistamientos
3. A las 2h: expandir a 10km
4. Máximo 3 notificaciones de perdidos por día por usuario

## Adopción

### Flujo del refugio/publicador

1. Publicar mascota en adopción con perfil completo
2. El cerebro genera un "match profile" automático basado en las características

### Flujo del adoptante

1. Expresar interés → el cerebro evalúa compatibilidad
2. Cuestionario rápido de compatibilidad (5 preguntas)
3. Match score + razón explícita

### Matching inteligente

El cerebro cruza:

| Factor adoptante | Factor mascota | Peso |
|-----------------|----------------|------|
| livingSpace (apt vs casa) | size + energy level | 25% |
| experienceLevel | temperamento + necesidades especiales | 25% |
| otherPets | socialización con otros animales | 20% |
| activityPrefs | energy level | 15% |
| scheduleAvailability | necesidades de atención | 15% |

**Match score:**
- 80-100% = "Excelente match" → conexión directa
- 60-79% = "Buen match" → conexión con nota
- 40-59% = "Match posible" → mostrar pero con advertencia
- <40% = No mostrar

### Firestore Schema

```typescript
// Colección: adoption_listings
interface AdoptionListing {
  id: string;
  publisherId: string;            // refugio o usuario
  publisherType: 'shelter' | 'individual';
  status: 'active' | 'adopted' | 'removed';
  
  petProfile: {
    name: string;
    species: 'dog' | 'cat';
    breed: string;
    age: number;                  // meses
    size: 'small' | 'medium' | 'large';
    energyLevel: 'low' | 'medium' | 'high';
    temperament: string[];        // ["tranquilo", "juguetón", "tímido"]
    goodWith: {
      kids: boolean;
      dogs: boolean;
      cats: boolean;
    };
    specialNeeds: string[];
    photoUrls: string[];
    description: string;
  };
  
  location: GeoPoint;
  publishedAt: Timestamp;
  viewCount: number;
  applicationCount: number;
}
```

### Gamificación de comunidad

| Acción | Puntos |
|--------|--------|
| Reportar mascota perdida | +10 |
| Reportar avistamiento | +25 |
| Avistamiento verificado (era la mascota) | +100 |
| Publicar mascota en adopción | +20 |
| Adopción exitosa | +200 |
| Compartir alerta de perdido | +5 |
