# Spec — Gamification honesta para Pessy

## Contexto

El dueño rechazó el modelo XP/missions tipo videojuego que apareció en un
mockup externo de Gemini ("Caminata 15 min +50 XP", "Limpieza de oídos +100
XP"). Cita textual: "ESTO NO ME GUSTA NADA. SI QUIERO GAMIFICATION PERO NO
ASÍ".

Pessy NO debe sentirse como Candy Crush para perros. Debe sentirse como un
sistema profesional que reconoce el esfuerzo real del tutor.

## Reglas duras

1. **Cada métrica viene de data real** del context — `events`, `medication_intakes`, `appointments`, `clinical_conditions`, `daysSinceFirstUse`. Nada inventado.
2. **No números arbitrarios** — nada de "XP", "levels", "points", "rewards".
3. **Tono adulto** — alineado a "Functional Warm Tech" del Plano. Frases descriptivas, no exclamativas.
4. **Refuerza sin presionar** — celebrar lo logrado, NO recordar lo que falta para llegar al próximo nivel.
5. **El protagonista es la mascota**, no el user — "Thor está al día" mejor que "Ganaste un badge".

## Componentes propuestos

### 1. Streaks reales — `useStreaks(petId)`

Calcular en cliente desde `medication_intakes`:

```ts
interface MedicationStreak {
  petId: string;
  currentStreakDays: number;       // días consecutivos con TODAS las dosis tomadas
  longestStreakDays: number;       // récord histórico
  startedAt: string;               // primer día de la racha actual
}
```

UI: chip pequeño en `PendienteHoyCard` → "Llevás 12 días al día con sus medicamentos"

NO mostrar si `currentStreakDays < 3` — celebrar pequeño se siente fake. Mostrar a partir de 3 días.

### 2. Hitos (achievements) — colección `pet_milestones`

Schema:
```ts
interface PetMilestone {
  id: string;
  petId: string;
  type: "first_document" | "vaccination_card_complete" | "first_vet_visit" |
        "six_months_history" | "co_tutor_added" | "all_meds_30days_streak";
  achievedAt: string;
  triggeredBy: string; // event id, intake id, etc.
}
```

Calculados automáticamente por Cloud Function trigger (`onCreate` en `medical_events`, `medication_intakes`, etc.).

UI: en `MedicalSummaryCard` o sección "Logros" del perfil — máximo 3 chips visibles, "Ver todos" abre lista completa. Tono: "Carnet de vacunas completo", "Primer documento médico cargado".

NO badges con dibujitos — solo chip text + ícono Material discreto.

### 3. Progress bars reales (no porcentajes inventados)

En `MedicalSummaryCard` o `CuidadosScreen`:
- "Vacunas registradas: 4 de 8 esperadas para su edad" (con bar visual)
- "Documentos cargados: 12 este año"
- "Eventos médicos: 3 confirmados, 1 pendiente"

Datos verificables, no abstractos.

### 4. "Aniversario" del cuidado

En el perfil del pet, fecha calculada `pet.createdAt`:
- 1 mes: "Llevás 1 mes ordenando la salud de {pet}"
- 6 meses: "Hace 6 meses que la información de {pet} está al día"
- 1 año: "1 año cuidando a {pet} con Pessy"

Banner sutil, no popup intrusivo. Una vez por hito, no recurrente.

### 5. Reconocimiento al co-tutor

Si hay co-tutores activos:
- "Vos y {nombre del co-tutor} cuidan a {pet} juntos"
- "{X} cargas este mes — sumando entre los 2"

Refuerza la dimensión social sin gamificarla.

## Lo que NO va a haber

- ❌ XP, niveles, levels
- ❌ Misiones diarias inventadas con valores fake
- ❌ Leaderboards entre usuarios
- ❌ Recompensas con badges infantiles (estrellas, trofeos, medallas)
- ❌ Notificaciones tipo "Te faltan 50 XP para subir al level 3"
- ❌ Racha mostrada antes de 3 días
- ❌ Comparación con otros pets/users

## Implementación por fases

### Fase A — Streaks (básico)
- Hook `useStreaks(petId)` cliente-side desde `medication_intakes`
- Chip en `PendienteHoyCard` si `currentStreakDays >= 3`
- Sin Cloud Function, todo cliente
- ~2h

### Fase B — Milestones (Cloud Functions)
- Colección `pet_milestones`
- Triggers: `onCreate medical_events`, `onCreate medication_intakes`, `onUpdate pets.coTutorUids`
- Componente `MilestonesList.tsx` en perfil
- ~3h

### Fase C — Progress bars y aniversario
- Componente `VaccinationProgress.tsx` (4/8 esperadas)
- Banner aniversario en HomeHeader
- ~2h

### Fase D — Reconocimiento co-tutor
- Métricas mensuales de cargas por user
- UI en perfil
- ~1h

**Total**: ~8h. Distribuible en 2 sesiones.

## Bloqueado por

- Épica 2B (medication_intakes schema) tiene que existir antes de Fase A.

## Decisión pendiente

¿Implementar Fase A (streaks) tan pronto como Épica 2B esté lista, o esperar
a tener todo el roadmap del audit Feb-baseline cerrado primero? Mi voto:
después de Épica 2B porque streaks usa la misma colección.
