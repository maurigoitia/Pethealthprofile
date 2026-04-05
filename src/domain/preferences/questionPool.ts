/**
 * Random Question Pool
 *
 * Micro-preguntas que aparecen 1 por sesión para construir el perfil del tutor.
 * Cada respuesta genera tags que alimentan el motor de recomendaciones.
 *
 * Reglas:
 *   - Máximo 1 pregunta por sesión
 *   - Nunca repetir antes del cooldown
 *   - Respetar minSessionCount (no bombardear usuarios nuevos)
 *   - {petName} se reemplaza en runtime con el nombre real
 */

import type { RandomQuestion } from "./userPreference.contract";

export const QUESTION_POOL: RandomQuestion[] = [
  // ── Outdoor ──────────────────────────────────────
  {
    id: "outdoor-paseo-lugar",
    category: "outdoor",
    text: "¿A dónde llevás a {petName} a pasear normalmente?",
    options: [
      { label: "Parque o plaza", value: "park", tag: "park_lover" },
      { label: "Calle del barrio", value: "street", tag: "neighborhood_walker" },
      { label: "Playa o río", value: "beach", tag: "beach_goer" },
      { label: "Montaña o senderos", value: "mountain", tag: "mountain_hiker" },
    ],
    cooldownDays: 30,
    minSessionCount: 3,
    tagsGenerated: ["park_lover", "neighborhood_walker", "beach_goer", "mountain_hiker"],
  },
  {
    id: "outdoor-frecuencia",
    category: "outdoor",
    text: "¿Cuántas veces al día sale {petName}?",
    options: [
      { label: "1 vez", value: "1", tag: "low_outdoor" },
      { label: "2 veces", value: "2", tag: "medium_outdoor" },
      { label: "3 o más", value: "3+", tag: "high_outdoor" },
    ],
    cooldownDays: 60,
    minSessionCount: 5,
    tagsGenerated: ["low_outdoor", "medium_outdoor", "high_outdoor"],
  },

  // ── Social ───────────────────────────────────────
  {
    id: "social-otros-perros",
    category: "social",
    text: "¿{petName} se lleva bien con otros perros?",
    options: [
      { label: "Sí, le encanta", value: "loves", tag: "social_pet" },
      { label: "Depende del perro", value: "selective", tag: "selective_social" },
      { label: "Prefiere estar solo/a", value: "solo", tag: "solo_walker" },
    ],
    cooldownDays: 45,
    minSessionCount: 3,
    tagsGenerated: ["social_pet", "selective_social", "solo_walker"],
  },
  {
    id: "social-otros-duenos",
    category: "social",
    text: "¿Te gusta charlar con otros tutores en el paseo?",
    options: [
      { label: "Sí, siempre", value: "always", tag: "social_owner" },
      { label: "A veces", value: "sometimes", tag: "casual_social" },
      { label: "Prefiero ir a mi aire", value: "solo", tag: "introvert_owner" },
    ],
    cooldownDays: 45,
    minSessionCount: 5,
    tagsGenerated: ["social_owner", "casual_social", "introvert_owner"],
  },

  // ── Foodie ───────────────────────────────────────
  {
    id: "foodie-cafe",
    category: "foodie",
    text: "¿Te gusta ir a cafés o restaurantes con {petName}?",
    options: [
      { label: "Sí, siempre busco pet-friendly", value: "always", tag: "café_lover" },
      { label: "A veces, si tiene terraza", value: "sometimes", tag: "casual_foodie" },
      { label: "No, prefiero dejarlo/a en casa", value: "never", tag: "homebody" },
    ],
    cooldownDays: 30,
    minSessionCount: 3,
    tagsGenerated: ["café_lover", "casual_foodie", "homebody"],
  },

  // ── Shopping ─────────────────────────────────────
  {
    id: "shopping-comida",
    category: "shopping",
    text: "¿Qué tipo de comida le das a {petName}?",
    options: [
      { label: "Premium / holístico", value: "premium", tag: "premium_buyer" },
      { label: "Marca conocida", value: "standard", tag: "standard_buyer" },
      { label: "BARF / natural", value: "barf", tag: "barf_buyer" },
      { label: "Mix de todo", value: "mixed", tag: "budget_conscious" },
    ],
    cooldownDays: 60,
    minSessionCount: 5,
    tagsGenerated: ["premium_buyer", "standard_buyer", "barf_buyer", "budget_conscious"],
  },

  // ── Activity ─────────────────────────────────────
  {
    id: "activity-ejercicio",
    category: "activity",
    text: "¿Hacés alguna actividad física con {petName}?",
    options: [
      { label: "Correr / running", value: "running", tag: "runner" },
      { label: "Caminatas largas", value: "hiking", tag: "hiker" },
      { label: "Juegos en el parque", value: "park_play", tag: "park_player" },
      { label: "Paseos tranquilos", value: "walks", tag: "casual_walker" },
    ],
    cooldownDays: 30,
    minSessionCount: 3,
    tagsGenerated: ["runner", "hiker", "park_player", "casual_walker"],
  },

  // ── Travel ───────────────────────────────────────
  {
    id: "travel-viaje",
    category: "travel",
    text: "¿Viajás con {petName}?",
    options: [
      { label: "Sí, siempre viene", value: "always", tag: "traveler" },
      { label: "A veces, si es cerca", value: "sometimes", tag: "weekend_tripper" },
      { label: "No, se queda con alguien", value: "never", tag: "homebody" },
    ],
    cooldownDays: 60,
    minSessionCount: 7,
    tagsGenerated: ["traveler", "weekend_tripper", "homebody"],
  },

  // ── Schedule ─────────────────────────────────────
  {
    id: "schedule-horario",
    category: "schedule",
    text: "¿A qué hora sale {petName} a pasear?",
    options: [
      { label: "Temprano (6-9h)", value: "early", tag: "early_bird" },
      { label: "Media mañana (9-12h)", value: "mid_morning", tag: "mid_morning" },
      { label: "Tarde (16-19h)", value: "afternoon", tag: "afternoon_walker" },
      { label: "Noche (19-22h)", value: "night", tag: "night_walker" },
    ],
    cooldownDays: 45,
    minSessionCount: 3,
    tagsGenerated: ["early_bird", "mid_morning", "afternoon_walker", "night_walker"],
  },

  // ── Care ─────────────────────────────────────────
  {
    id: "care-grooming",
    category: "care",
    text: "¿Cada cuánto bañás o llevás a peluquería a {petName}?",
    options: [
      { label: "Cada 2 semanas o menos", value: "frequent", tag: "grooming_regular" },
      { label: "Una vez al mes", value: "monthly", tag: "grooming_monthly" },
      { label: "Cada 2-3 meses", value: "occasional", tag: "low_maintenance" },
    ],
    cooldownDays: 60,
    minSessionCount: 5,
    tagsGenerated: ["grooming_regular", "grooming_monthly", "low_maintenance"],
  },

  // ── Walk Routine ─────────────────────────────────────
  {
    id: "walk-routine-hora",
    category: "walk_routine",
    text: "¿A qué hora salen a caminar normalmente con {petName}?",
    options: [
      { label: "Temprano (6-9h)", value: "early", tag: "walk_early" },
      { label: "Media mañana (9-12h)", value: "mid_morning", tag: "walk_mid_morning" },
      { label: "Tarde (16-19h)", value: "afternoon", tag: "walk_afternoon" },
      { label: "Noche (19-22h)", value: "night", tag: "walk_night" },
    ],
    cooldownDays: 90,
    minSessionCount: 5,
    tagsGenerated: ["walk_early", "walk_mid_morning", "walk_afternoon", "walk_night"],
  },
  {
    id: "walk-routine-frecuencia",
    category: "walk_routine",
    text: "¿Cuántas veces por día sale {petName} a pasear?",
    options: [
      { label: "1 vez", value: "1", tag: "walk_once_daily" },
      { label: "2 veces", value: "2", tag: "walk_twice_daily" },
      { label: "3 o más", value: "3+", tag: "walk_frequent" },
    ],
    cooldownDays: 90,
    minSessionCount: 5,
    tagsGenerated: ["walk_once_daily", "walk_twice_daily", "walk_frequent"],
  },
  {
    id: "walk-routine-lugar",
    category: "walk_routine",
    text: "¿Tienen un parque o recorrido favorito?",
    options: [
      { label: "Parque específico", value: "park", tag: "walk_park_regular" },
      { label: "Varios lugares", value: "varied", tag: "walk_varied_routes" },
      { label: "Lo que salga en el momento", value: "spontaneous", tag: "walk_spontaneous" },
    ],
    cooldownDays: 120,
    minSessionCount: 5,
    tagsGenerated: ["walk_park_regular", "walk_varied_routes", "walk_spontaneous"],
  },

  // ── Vet Routine ──────────────────────────────────────
  {
    id: "vet-routine-veterinaria",
    category: "vet_routine",
    text: "¿A qué veterinaria llevás a {petName} habitualmente?",
    options: [
      { label: "Tengo una de confianza", value: "regular", tag: "vet_regular" },
      { label: "Voy a distintas", value: "varied", tag: "vet_varied" },
      { label: "Aún no tengo una", value: "none", tag: "vet_none" },
    ],
    cooldownDays: 180,
    minSessionCount: 3,
    tagsGenerated: ["vet_regular", "vet_varied", "vet_none"],
  },
  {
    id: "vet-routine-lastcheckup",
    category: "vet_routine",
    text: "¿Cuándo fue la última vez que lo revisaron?",
    options: [
      { label: "Este año", value: "recent", tag: "vet_current" },
      { label: "Hace más de un año", value: "overdue", tag: "vet_overdue" },
      { label: "No recuerdo", value: "unknown", tag: "vet_unknown" },
    ],
    cooldownDays: 90,
    minSessionCount: 3,
    tagsGenerated: ["vet_current", "vet_overdue", "vet_unknown"],
  },

  // ── Feeding Routine ──────────────────────────────────
  {
    id: "feeding-routine-desayuno",
    category: "feeding_routine",
    text: "¿A qué hora le das el desayuno a {petName}?",
    options: [
      { label: "Temprano (6-8h)", value: "early", tag: "feed_early" },
      { label: "Media mañana (8-10h)", value: "mid_morning", tag: "feed_mid_morning" },
      { label: "Más tarde (10h+)", value: "late", tag: "feed_late" },
    ],
    cooldownDays: 90,
    minSessionCount: 5,
    tagsGenerated: ["feed_early", "feed_mid_morning", "feed_late"],
  },
  {
    id: "feeding-routine-marca",
    category: "feeding_routine",
    text: "¿Qué marca de alimento come {petName}?",
    options: [
      { label: "Premium / holístico", value: "premium", tag: "feed_premium" },
      { label: "Marca conocida", value: "standard", tag: "feed_standard" },
      { label: "BARF / natural", value: "barf", tag: "feed_barf" },
      { label: "No recuerdo la marca", value: "unknown", tag: "feed_unknown" },
    ],
    cooldownDays: 120,
    minSessionCount: 5,
    tagsGenerated: ["feed_premium", "feed_standard", "feed_barf", "feed_unknown"],
  },
];
