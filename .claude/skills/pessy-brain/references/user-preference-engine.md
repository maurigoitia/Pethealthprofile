# User Preference Engine

## Lo que YA existe en PetContext

PESSY ya captura preferencias de la mascota. Estos datos son la base:

```typescript
// REAL — en PetContext.tsx
preferences: {
  favoriteActivities: string[];  // walk, park, cafe, beach, hiking, playdate, training, swim
  favoritePlaces: string[];      // Google Places IDs
  walkTimes: string[];
  foodPreferences: { brand: string; type: 'balanced' | 'BARF' | 'mixed'; supplyTracking: boolean };
  allergies: string[];
  fears: string[];
  personality: string[];         // calm, energetic, shy, social, independent, playful, protective
}
weightHistory: { date: string; weight: number }[];
coTutors: { uid: string; email: string; name: string; addedAt: Timestamp }[];
```

## Lo que se agrega — Perfil del DUEÑO

El perfil de la mascota ya es rico. Lo que falta es entender al DUEÑO para personalizar recomendaciones.

### Preguntas random

Micro-preguntas que aparecen en la app (1 por sesión, nunca repetir):

| Categoría | Pregunta | Tags que genera |
|-----------|----------|-----------------|
| Outdoor | "¿A dónde llevás a {nombre} a pasear?" | park_lover, beach_goer, mountain_hiker |
| Social | "¿{nombre} se lleva bien con otros perros?" | social_pet, solo_walker |
| Foodie | "¿Te gusta ir a cafés con {nombre}?" | café_lover, restaurant_goer |
| Shopping | "¿Comprás comida premium o estándar?" | premium_buyer, budget_conscious |
| Activity | "¿Hacés actividad física con {nombre}?" | runner, walker, couch_potato |
| Travel | "¿Viajás con {nombre}?" | traveler, homebody |
| Schedule | "¿A qué hora sale {nombre} a pasear?" | early_bird, night_walker |
| Care | "¿Cada cuánto bañás a {nombre}?" | grooming_regular, low_maintenance |

### Schema — lo nuevo que se agrega a Firestore

```typescript
// Colección: user_preferences/{userId}
// NUEVO — complementa PetContext, no lo reemplaza
interface UserLifestyleProfile {
  userId: string;
  
  lifestyle: {
    outdoorLevel: 'low' | 'medium' | 'high';
    socialLevel: 'introvert' | 'social' | 'very_social';
    spendingTier: 'budget' | 'mid' | 'premium';
    locationPrefs: string[];    // derivado de respuestas + favoriteActivities existente
    activityPrefs: string[];    // derivado de respuestas + favoriteActivities existente
    shoppingPrefs: string[];
  };
  
  tags: string[];               // ["café_lover", "runner", "premium_buyer"]
  
  questionsAnswered: {
    questionId: string;
    answeredAt: Timestamp;
    answer: string;
  }[];
  
  engagement: {
    firstSeen: Timestamp;
    lastSeen: Timestamp;
    totalSessions: number;
    streakDays: number;         // migrar de localStorage
    currentPlan: 'free' | 'premium';  // los planes reales actuales
    responseRate: number;
  };
  
  profileVersion: number;
  lastComputed: Timestamp;
}
```

### Cómputo del perfil

El perfil se construye cruzando:
1. **Datos existentes de PetContext** (favoriteActivities, personality, favoritePlaces)
2. **Respuestas a preguntas random** (tags explícitos)
3. **Comportamiento implícito** (features usadas, frecuencia, horarios)

Peso: explícito 3x > implícito 1x. Decay a 90 días.
Recálculo: después de cada pregunta + batch nocturno. Max 1/hora.

### Integración con código existente

Al implementar, NO crear un nuevo context desde cero. En su lugar:
1. Agregar `userLifestyle` al `AuthContext` o crear un `PreferenceContext` que lee de Firestore
2. Usar los `favoriteActivities` y `personality` existentes como seed del perfil
3. Los `favoritePlaces` (Google Places IDs) ya son la base de recomendaciones de lugares
4. Las `walkTimes` ya indican preferencia horaria
