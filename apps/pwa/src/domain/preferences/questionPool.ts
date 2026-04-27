/**
 * Random Question Pool
 *
 * Micro-preguntas que aparecen 1 por sesión para construir el perfil del dueño.
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
    text: "¿Te gusta charlar con otros dueños en el paseo?",
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
];
