import { TRAINING_MASTER_BOOK, type TrainingSegmentId } from "../training/training_master_book";
import {
  WELLBEING_MASTER_BOOK,
  type ThermalSafetyProfile,
  type WellbeingSpeciesGroupId,
} from "../wellbeing/wellbeingMasterBook";

export type PessyRecommendationKind = "block" | "alert" | "recommendation";

export interface PessyIntelligenceInput {
  petName: string;
  species: "dog" | "cat";
  breed: string;
  ageLabel: string;
  ageWeeks?: number | null;
  groupIds: WellbeingSpeciesGroupId[];
  temperatureC: number | null;
  humidityPct: number | null;
  hasSeparationAnxiety?: boolean;
  hasAggressionSigns?: boolean; // tutor reporta senales de agresividad
  isPuppy?: boolean;
  isUnvaccinated?: boolean;
  // ─── New interactive inputs ──────────────────────────────────────────
  isRaining?: boolean;
  isStormy?: boolean; // truenos / tormenta eléctrica
  windSpeedKmh?: number | null;
  uvIndex?: number | null;
  currentHour?: number; // 0-23
  fears?: string[]; // "Truenos", "Fuegos artificiales", etc.
  personality?: string[]; // "calm", "energetic", etc.
  favoriteActivities?: string[]; // "walk", "park", "cafe", etc.
  walkTimes?: string[]; // "08:00", "14:00"
  foodDaysLeft?: number | null; // from supply predictor
}

export interface PessyIntelligenceRecommendation {
  id: string;
  code: string;
  title: string;
  detail: string;
  slot: string;
  icon: string;
  kind: PessyRecommendationKind;
  sourceModule: string;
}

export interface PessyIntelligenceResult {
  segmentId: TrainingSegmentId | null;
  segmentLabel: string | null;
  segmentDescription: string | null;
  /** All recommendations, sorted by segment strategy (blocks → priority → normal → demoted) */
  recommendations: PessyIntelligenceRecommendation[];
  /** Top priority items — what the tutor should see first ("Lo más importante hoy") */
  primary: PessyIntelligenceRecommendation[];
  /** Secondary items — collapsed/expandable in UI ("También podés hacer esto") */
  secondary: PessyIntelligenceRecommendation[];
  activatedModules: string[];
}

// ─── SEGMENT ROUTING LAYER ─────────────────────────────────────────────────
// Turns segments from labels into active routers that control recommendation
// priority, ordering, and guardrail injection.

export interface SegmentStrategy {
  id: TrainingSegmentId;
  label: string;
  description: string;
  priorityModules: string[];
  demoteModules: string[];
  injectGuardrailCodes: string[];
}

export const SEGMENT_STRATEGIES: Record<TrainingSegmentId, SegmentStrategy> = {
  reactive: {
    id: "reactive",
    label: "Reactivo / Sensible",
    description: "Prioridad: seguridad, desensibilización y manejo de gatillos",
    priorityModules: ["aggression_prevention", "separation_anxiety", "thermal_safety"],
    demoteModules: ["daily_activity", "breed_profile", "supply_tracker", "fears_seasonal"],
    injectGuardrailCodes: ["strict_no_aversives", "loose_leash_only", "trigger_management"],
  },
  puppies: {
    id: "puppies",
    label: "Cachorro",
    description: "Prioridad: socialización segura y habituación gradual",
    priorityModules: ["puppy_socialization", "thermal_safety"],
    demoteModules: ["breed_profile", "supply_tracker"],
    injectGuardrailCodes: ["no_punishment", "gradual_exposure"],
  },
  active_working: {
    id: "active_working",
    label: "Activo / Trabajo",
    description: "Prioridad: estimulación cognitiva y control de impulsos",
    priorityModules: ["thermal_safety", "daily_activity", "training_master_book"],
    demoteModules: [],
    injectGuardrailCodes: ["avoid_understimulation", "avoid_inconsistent_commands"],
  },
  companion: {
    id: "companion",
    label: "Compañero",
    description: "Prioridad: rutina equilibrada y enriquecimiento diario",
    priorityModules: ["thermal_safety", "training_master_book"],
    demoteModules: [],
    injectGuardrailCodes: ["short_daily_sessions", "same_words_in_household"],
  },
};

// Guardrail definitions that the routing layer can inject per segment.
// These are hardcoded rules from the training master book, surfaced as recommendations.
const INJECTABLE_GUARDRAILS: Record<string, { title: string; detail: string; icon: string }> = {
  strict_no_aversives: {
    title: "Prohibido usar herramientas aversivas",
    detail: "Ni collares de castigo, ni cadenas de ahogo, ni castigo físico. Perros reactivos empeoran con métodos aversivos.",
    icon: "block",
  },
  loose_leash_only: {
    title: "Solo correa floja y distancia segura",
    detail: "Nunca tirar de la correa ni forzar cercanía al estímulo. Mantener distancia donde el perro pueda pensar.",
    icon: "pets",
  },
  trigger_management: {
    title: "Manejo activo de gatillos",
    detail: "Identificar los gatillos (perros, personas, ruidos) y gestionar el entorno para evitar exposiciones no controladas.",
    icon: "shield",
  },
  no_punishment: {
    title: "Cero castigo en etapa cachorro",
    detail: "El cachorro está aprendiendo el mundo. Castigar genera miedo, no obediencia. Solo refuerzo positivo.",
    icon: "block",
  },
  gradual_exposure: {
    title: "Exposición gradual a estímulos nuevos",
    detail: "Presentar sonidos, superficies, personas y otros animales de forma controlada y positiva. Nunca forzar.",
    icon: "school",
  },
  avoid_understimulation: {
    title: "Evitar la falta de estímulo mental",
    detail: "Perros activos/de trabajo necesitan desafíos cognitivos diarios. Sin ellos, aparecen conductas destructivas.",
    icon: "psychology",
  },
  avoid_inconsistent_commands: {
    title: "Comandos consistentes en todo el hogar",
    detail: "Todos los tutores deben usar las mismas palabras y señales. La inconsistencia confunde al perro.",
    icon: "group",
  },
  short_daily_sessions: {
    title: "Sesiones cortas y diarias",
    detail: "Mejor 5 minutos todos los días que 30 minutos una vez por semana. La consistencia es clave.",
    icon: "schedule",
  },
  same_words_in_household: {
    title: "Mismas palabras en todo el hogar",
    detail: "Si uno dice 'vení' y otro dice 'come', el perro no aprende. Acordar un vocabulario familiar.",
    icon: "group",
  },
};

// ─── TOP 3 PRIORITY SPLIT ───────────────────────────────────────────────────
// Splits routed recommendations into primary (what the tutor sees first) and
// secondary (collapsed/expandable). Rules:
//   1. ALL blocks go to primary (safety is never hidden)
//   2. ALL alerts go to primary (important signals)
//   3. Fill remaining primary slots with top recommendations (up to softCap)
//   4. Everything else → secondary
const PRIMARY_SOFT_CAP = 5;

function splitPrimarySecondary(
  recommendations: PessyIntelligenceRecommendation[],
): { primary: PessyIntelligenceRecommendation[]; secondary: PessyIntelligenceRecommendation[] } {
  const primary: PessyIntelligenceRecommendation[] = [];
  const secondary: PessyIntelligenceRecommendation[] = [];

  for (const rec of recommendations) {
    if (rec.kind === "block" || rec.kind === "alert") {
      // Safety items ALWAYS go to primary — no cap
      primary.push(rec);
    } else if (primary.length < PRIMARY_SOFT_CAP) {
      // Fill remaining primary slots with top recommendations
      primary.push(rec);
    } else {
      secondary.push(rec);
    }
  }

  return { primary, secondary };
}

function applySegmentStrategy(
  segmentId: TrainingSegmentId | null,
  petName: string,
  recommendations: PessyIntelligenceRecommendation[],
): PessyIntelligenceRecommendation[] {
  if (!segmentId) return recommendations;

  const strategy = SEGMENT_STRATEGIES[segmentId];
  if (!strategy) return recommendations;

  // Inject segment guardrails that aren't already covered by existing recommendations
  const existingCodes = new Set(recommendations.map((r) => r.code));
  for (const guardrailCode of strategy.injectGuardrailCodes) {
    if (existingCodes.has(`segment_${guardrailCode}`)) continue;
    const guardrail = INJECTABLE_GUARDRAILS[guardrailCode];
    if (!guardrail) continue;

    recommendations.push({
      id: `${petName}_segment_${guardrailCode}`,
      code: `segment_${guardrailCode}`,
      title: guardrail.title,
      detail: guardrail.detail,
      slot: "Guardrail",
      icon: guardrail.icon,
      kind: "block",
      sourceModule: "segment_strategy",
    });
  }

  // Sort: blocks first, then priority modules, then normal, then demoted
  const kindOrder: Record<PessyRecommendationKind, number> = {
    block: 0,
    alert: 1,
    recommendation: 2,
  };

  const moduleTier = (sourceModule: string): number => {
    if (strategy.priorityModules.includes(sourceModule)) return 0;
    if (strategy.demoteModules.includes(sourceModule)) return 2;
    return 1;
  };

  return [...recommendations].sort((a, b) => {
    const kindDiff = kindOrder[a.kind] - kindOrder[b.kind];
    if (kindDiff !== 0) return kindDiff;
    return moduleTier(a.sourceModule) - moduleTier(b.sourceModule);
  });
}

function findThermalProfile(input: PessyIntelligenceInput): ThermalSafetyProfile | null {
  const priority = input.groupIds.find((id) => id === "dog.brachycephalic" || id === "cat.brachycephalic");

  if (priority) {
    return WELLBEING_MASTER_BOOK.thermal_safety.groups.find((group) => group.id === priority) ?? null;
  }

  if (input.species === "cat") {
    return WELLBEING_MASTER_BOOK.thermal_safety.groups.find((group) => group.id === "cat.general") ?? null;
  }

  return WELLBEING_MASTER_BOOK.thermal_safety.groups.find((group) => group.id === "dog.general") ?? null;
}

export function inferTrainingSegmentId(input: PessyIntelligenceInput): TrainingSegmentId | null {
  if (input.species !== "dog") {
    return null;
  }

  if (input.hasSeparationAnxiety || input.hasAggressionSigns || input.groupIds.includes("dog.reactive")) {
    return "reactive";
  }

  if (input.isPuppy || input.groupIds.includes("dog.puppy")) {
    return "puppies";
  }

  if (input.groupIds.includes("dog.active_working")) {
    return "active_working";
  }

  return "companion";
}

function getRecommendedTrainingCommand(input: PessyIntelligenceInput) {
  if (input.species !== "dog") {
    return null;
  }

  if (input.hasAggressionSigns) {
    return TRAINING_MASTER_BOOK.command_library.find((command) => command.id === "leave_it") ?? null;
  }

  if (input.hasSeparationAnxiety) {
    return TRAINING_MASTER_BOOK.command_library.find((command) => command.id === "watch_me") ?? null;
  }

  if (input.isPuppy) {
    return TRAINING_MASTER_BOOK.command_library.find((command) => command.id === "come") ?? null;
  }

  return TRAINING_MASTER_BOOK.command_library.find((command) => command.id === "wait_signal") ?? null;
}

export function runPessyIntelligence(input: PessyIntelligenceInput): PessyIntelligenceResult {
  const recommendations: PessyIntelligenceRecommendation[] = [];
  const thermalProfile = findThermalProfile(input);
  const segmentId = inferTrainingSegmentId(input);
  const sessionWindow = `${TRAINING_MASTER_BOOK.global_principles.minSessionDurationMinutes}-${TRAINING_MASTER_BOOK.global_principles.maxSessionDurationMinutes} min`;

  if (thermalProfile && input.temperatureC !== null) {
    const severeRisk = thermalProfile.severeRiskAboveC ?? Number.POSITIVE_INFINITY;
    const avoidExercise = thermalProfile.avoidExerciseAboveC ?? Number.POSITIVE_INFINITY;
    const humidityPenalty = thermalProfile.humiditySensitive && (input.humidityPct ?? 0) >= 70;
    const isHotAlert = input.temperatureC >= severeRisk || humidityPenalty;

    if (input.temperatureC > avoidExercise || isHotAlert) {
      if (input.species === "cat") {
        recommendations.push({
          id: `${input.petName}_cat_heat`,
          code: "indoor_cooling_now",
          title: `Mejor que ${input.petName} siga adentro ahora`,
          detail: `${input.breed} + ${input.temperatureC} C${humidityPenalty ? " con humedad alta" : ""}. Priorizar interior fresco y cero estres termico.`,
          slot: "Ahora",
          icon: "home",
          kind: thermalProfile.guardrailType === "block" ? "block" : "alert",
          sourceModule: "thermal_safety",
        });
        recommendations.push({
          id: `${input.petName}_cat_support`,
          code: "cooling_support",
          title: "Agua, ventilacion y zonas frescas",
          detail: thermalProfile.prevention.slice(0, 2).join(". "),
          slot: "Proximo paso",
          icon: "water_drop",
          kind: "recommendation",
          sourceModule: "thermal_safety",
        });
      } else {
        recommendations.push({
          id: `${input.petName}_heat_block`,
          code: "avoid_walk_heat",
          title: `No saques a ${input.petName} en este horario`,
          detail: `${input.breed} + ${input.temperatureC} C. El libro maestro marca restriccion por encima de ${thermalProfile.avoidExerciseAboveC} C.`,
          slot: "12:00-19:00",
          icon: "warning",
          kind: thermalProfile.guardrailType === "block" ? "block" : "alert",
          sourceModule: "thermal_safety",
        });
        recommendations.push({
          id: `${input.petName}_indoor_play`,
          code: "indoor_play_heat",
          title: "Juego indoor y agua fresca",
          detail: `En vez de paseo, usar una actividad tranquila en casa por ${sessionWindow}.`,
          slot: "Proximo paso",
          icon: "pets",
          kind: "recommendation",
          sourceModule: "thermal_safety",
        });
      }
    }

    // ─── Cold weather check (comfortableMinC data exists, was never used) ───
    const comfortMin = thermalProfile.comfortableMinC;
    if (comfortMin !== null && input.temperatureC < comfortMin) {
      const isSevere = input.temperatureC <= comfortMin - 5;
      if (input.species === "cat") {
        recommendations.push({
          id: `${input.petName}_cold_indoor`,
          code: "cold_keep_indoor",
          title: `Frío para ${input.petName} — mantener adentro`,
          detail: `${input.breed} está más cómodo arriba de ${comfortMin}°C. Hoy hace ${input.temperatureC}°C. Verificar que tenga mantas y un lugar reparado.`,
          slot: "Ahora",
          icon: "ac_unit",
          kind: isSevere ? "alert" : "recommendation",
          sourceModule: "thermal_safety",
        });
      } else {
        recommendations.push({
          id: `${input.petName}_cold_walk`,
          code: "cold_short_walk",
          title: `Hace frío — paseo corto y abrigado`,
          detail: `${input.temperatureC}°C es por debajo del rango cómodo (${comfortMin}°C+) para ${input.breed}. Paseo breve, evitar asfalto helado, y secar bien al volver.`,
          slot: "Hoy",
          icon: "ac_unit",
          kind: isSevere ? "alert" : "recommendation",
          sourceModule: "thermal_safety",
        });
      }
    }
  }

  if (input.species === "dog" && (input.isPuppy || input.groupIds.includes("dog.puppy"))) {
    recommendations.push({
      id: `${input.petName}_socialization`,
      code: "safe_socialization_session",
      title: "Sesion corta de socializacion segura",
      detail: `${WELLBEING_MASTER_BOOK.puppy_socialization.safeExposure[0]}. Mantener sesion breve de ${sessionWindow}.`,
      slot: "Hoy",
      icon: "school",
      kind: "recommendation",
      sourceModule: "puppy_socialization",
    });

    if (input.isUnvaccinated) {
      recommendations.push({
        id: `${input.petName}_no_public_ground`,
        code: "no_public_ground_unvaccinated",
        title: "No al suelo publico todavia",
        detail: `${WELLBEING_MASTER_BOOK.puppy_socialization.avoidBeforeVaccines[0]}. Mejor brazos, transportin o jardin controlado.`,
        slot: "Guardrail",
        icon: "shield",
        kind: "block",
        sourceModule: "puppy_socialization",
      });
    }
  }

  if (input.species === "dog" && input.hasSeparationAnxiety) {
    const departureRoutine = WELLBEING_MASTER_BOOK.separation_anxiety.do_first.find(
      (rule) => rule.id === "departure_routine"
    );
    const specialToy = WELLBEING_MASTER_BOOK.separation_anxiety.do_first.find(
      (rule) => rule.id === "special_toy"
    );
    const cameraMonitoring = WELLBEING_MASTER_BOOK.separation_anxiety.do_first.find(
      (rule) => rule.id === "camera_monitoring"
    );

    if (departureRoutine) {
      recommendations.push({
        id: `${input.petName}_departure_routine`,
        code: "departure_routine_predictable",
        title: departureRoutine.label,
        detail: departureRoutine.detail,
        slot: "Antes de salir",
        icon: "door_front",
        kind: "recommendation",
        sourceModule: "separation_anxiety",
      });
    }

    if (specialToy) {
      recommendations.push({
        id: `${input.petName}_special_toy`,
        code: "special_toy_departure",
        title: specialToy.label,
        detail: specialToy.detail,
        slot: "Salida",
        icon: "toys",
        kind: "recommendation",
        sourceModule: "separation_anxiety",
      });
    }

    if (cameraMonitoring) {
      recommendations.push({
        id: `${input.petName}_camera`,
        code: "camera_monitoring",
        title: cameraMonitoring.label,
        detail: cameraMonitoring.detail,
        slot: "Seguimiento",
        icon: "videocam",
        kind: "alert",
        sourceModule: "separation_anxiety",
      });
    }

    // Never-do guardrails (from master book)
    for (const neverDo of WELLBEING_MASTER_BOOK.separation_anxiety.never_do) {
      recommendations.push({
        id: `${input.petName}_anxiety_${neverDo.id}`,
        code: `anxiety_${neverDo.id}`,
        title: neverDo.label,
        detail: neverDo.detail,
        slot: "Guardrail",
        icon: "block",
        kind: "block",
        sourceModule: "separation_anxiety",
      });
    }
  }

  // ─── MODULE: Aggression Prevention ────────────────────────────────────────
  if (input.species === "dog" && input.hasAggressionSigns) {
    const aggressionRules = WELLBEING_MASTER_BOOK.aggression_prevention;

    // Guardrail: identify triggers
    const identifyTriggers = aggressionRules.do_first.find((r) => r.id === "identify_triggers");
    if (identifyTriggers) {
      recommendations.push({
        id: `${input.petName}_aggression_triggers`,
        code: "identify_aggression_triggers",
        title: identifyTriggers.label,
        detail: identifyTriggers.detail,
        slot: "Primer paso",
        icon: "search",
        kind: "alert",
        sourceModule: "aggression_prevention",
      });
    }

    // Guardrail: vet pain check
    const vetCheck = aggressionRules.do_first.find((r) => r.id === "vet_pain_check");
    if (vetCheck) {
      recommendations.push({
        id: `${input.petName}_aggression_vet`,
        code: "vet_pain_check_aggression",
        title: vetCheck.label,
        detail: vetCheck.detail,
        slot: "Urgente",
        icon: "medical_services",
        kind: "alert",
        sourceModule: "aggression_prevention",
      });
    }

    // Recommendation: desensitization
    const desensitization = aggressionRules.do_first.find((r) => r.id === "desensitization_protocol");
    if (desensitization) {
      recommendations.push({
        id: `${input.petName}_aggression_desens`,
        code: "desensitization_gradual",
        title: desensitization.label,
        detail: desensitization.detail,
        slot: "Plan de trabajo",
        icon: "psychology",
        kind: "recommendation",
        sourceModule: "aggression_prevention",
      });
    }

    // Block: never punish growl
    const noPunishGrowl = aggressionRules.never_do.find((r) => r.id === "no_punish_growl");
    if (noPunishGrowl) {
      recommendations.push({
        id: `${input.petName}_no_punish_growl`,
        code: "never_punish_growl",
        title: noPunishGrowl.label,
        detail: noPunishGrowl.detail,
        slot: "Guardrail",
        icon: "block",
        kind: "block",
        sourceModule: "aggression_prevention",
      });
    }

    // Alert: refer professional
    recommendations.push({
      id: `${input.petName}_refer_etologo`,
      code: "refer_professional_aggression",
      title: "Consultar con etologo clinico veterinario",
      detail: `Si ${input.petName} mordio, gruñe seguido o la situacion escala, un etologo clinico es el profesional indicado. No un adiestrador comun.`,
      slot: "Profesional",
      icon: "person_search",
      kind: "alert",
      sourceModule: "aggression_prevention",
    });
  }

  // ─── MODULE: Active/Working dog needs ──────────────────────────────────────
  if (input.species === "dog" && input.groupIds.includes("dog.active_working") && !input.hasAggressionSigns) {
    const segment = TRAINING_MASTER_BOOK.segments.active_working;

    recommendations.push({
      id: `${input.petName}_mental_stimulation`,
      code: "mental_stimulation_needed",
      title: `${input.petName} necesita desafío mental hoy`,
      detail: "Olfateo, búsqueda de premios escondidos, juguetes interactivos o entrenamiento de obediencia avanzada. Sin esto, puede aparecer ansiedad o conducta destructiva.",
      slot: "Diario",
      icon: "psychology",
      kind: "recommendation",
      sourceModule: "active_working",
    });

    if (segment.risks && segment.risks.includes("destructive_behavior")) {
      recommendations.push({
        id: `${input.petName}_frustration_risk`,
        code: "frustration_risk_working",
        title: "Riesgo de frustración por falta de actividad",
        detail: `Razas activas como ${input.breed} sin descarga cognitiva pueden romper objetos, ladrar en exceso o auto-estimularse. La actividad mental cansa más que el ejercicio físico.`,
        slot: "Preventivo",
        icon: "warning",
        kind: "alert",
        sourceModule: "active_working",
      });
    }
  }

  const trainingCommand = getRecommendedTrainingCommand(input);
  if (trainingCommand) {
    recommendations.push({
      id: `${input.petName}_training`,
      code: `practice_${trainingCommand.id}`,
      title: `Practicar ${trainingCommand.label}`,
      detail: `${trainingCommand.goal}. ${trainingCommand.instruction}`,
      slot: sessionWindow,
      icon: "neurology",
      kind: "recommendation",
      sourceModule: "training_master_book",
    });
  }

  // ─── MODULE: Food safety (species-filtered, daily rotation) ──────────────
  {
    const speciesFilter = input.species;
    const relevantItems = WELLBEING_MASTER_BOOK.food_safety.prohibited.filter(
      (item) => item.appliesTo.includes(speciesFilter) || item.appliesTo.includes("general"),
    );

    if (relevantItems.length > 0) {
      // Rotate by day of year — tutor learns 1 new toxic item daily
      const dayOfYear = Math.floor(
        (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24),
      );
      const todayItem = relevantItems[dayOfYear % relevantItems.length];

      recommendations.push({
        id: `${input.petName}_food_safety_${todayItem.id}`,
        code: `food_safety_${todayItem.id}`,
        title: `⚠ ${todayItem.label}`,
        detail: `${todayItem.danger}. ${todayItem.action}.`,
        slot: "Sabías que...",
        icon: todayItem.guardrailType === "block" ? "dangerous" : "warning",
        kind: todayItem.guardrailType === "block" ? "block" : "alert",
        sourceModule: "food_safety",
      });
    }
  }

  // ─── MODULE: Rain & Storm ─────────────────────────────────────────────────
  if (input.isRaining || input.isStormy) {
    const hasThunderFear = (input.fears || []).some((f) =>
      f.toLowerCase().includes("trueno") || f.toLowerCase().includes("tormenta") || f.toLowerCase().includes("thunder")
    );

    if (input.isStormy && hasThunderFear) {
      recommendations.push({
        id: `${input.petName}_storm_fear`,
        code: "storm_fear_protocol",
        title: `${input.petName} le tiene miedo a las tormentas`,
        detail: "Cerrá persianas, poné música suave o ruido blanco, y quedate cerca. No lo fuerces ni lo retes si tiembla o se esconde.",
        slot: "Ahora",
        icon: "thunderstorm",
        kind: "alert",
        sourceModule: "fears_weather",
      });
    }

    if (input.isRaining) {
      // Find indoor activities for current breed group
      let groupId = input.groupIds[0] || "dog.companion";
      // Fallback: no master book entries exist for these generic groupIds
      if (groupId === "dog.general") groupId = "dog.companion";
      if (groupId === "cat.brachycephalic") groupId = "cat.general";
      const indoorSuggestions = WELLBEING_MASTER_BOOK.daily_suggestions.filter(
        (s) => s.groupId === groupId && s.category === "indoor"
      );
      const pick = indoorSuggestions.length > 0 ? indoorSuggestions[0] : null;

      recommendations.push({
        id: `${input.petName}_rain_indoor`,
        code: "rainy_day_plan",
        title: pick ? pick.title : "Día de juegos en casa",
        detail: pick ? pick.detail : "Juegos de olfato, Kong relleno congelado, o entrenamiento de calma. Actividad mental cansa tanto como un paseo.",
        slot: "Hoy",
        icon: "rainy",
        kind: "recommendation",
        sourceModule: "weather_activity",
      });
    }
  }

  // ─── MODULE: Time-of-day recommendations ──────────────────────────────────
  if (input.currentHour !== undefined) {
    const hour = input.currentHour;
    const groupId = input.groupIds[0] || "dog.companion";

    if (hour >= 21 || hour < 6) {
      // Night — calm routines
      recommendations.push({
        id: `${input.petName}_night_routine`,
        code: "evening_calm",
        title: "Rutina nocturna de calma",
        detail: "Buen momento para cepillado suave, masaje o juego tranquilo antes de dormir. Nada de estímulos fuertes.",
        slot: "Ahora",
        icon: "bedtime",
        kind: "recommendation",
        sourceModule: "time_of_day",
      });
    } else if (hour >= 6 && hour < 9) {
      // Early morning — best walk time
      const isBrachy = input.groupIds.some((id) => id.includes("brachycephalic"));
      if (isBrachy) {
        recommendations.push({
          id: `${input.petName}_morning_walk`,
          code: "morning_walk_brachy",
          title: "Mejor hora para pasear",
          detail: `Para ${input.breed}, las mañanas temprano (antes de las 9) son la ventana más segura. Máximo 15 minutos con agua.`,
          slot: "Ahora",
          icon: "wb_sunny",
          kind: "recommendation",
          sourceModule: "time_of_day",
        });
      }
    } else if (hour >= 12 && hour < 16) {
      // Midday — check if walk scheduled conflicts with heat
      if (input.walkTimes?.includes("14:00") && input.temperatureC !== null && input.temperatureC > 28) {
        recommendations.push({
          id: `${input.petName}_walk_conflict`,
          code: "walk_time_conflict",
          title: `Tu paseo de las 14:00 no conviene hoy`,
          detail: `Hace ${input.temperatureC}°C. Mové el paseo a las 19:00 o hacé un juego de olfato adentro.`,
          slot: "Cambio de plan",
          icon: "schedule",
          kind: "alert",
          sourceModule: "routine_conflict",
        });
      }
    }
  }

  // ─── MODULE: UV Index alert ──────────────────────────────────────────────
  if (input.uvIndex !== null && input.uvIndex !== undefined && input.uvIndex >= 8) {
    const isLightCoated = input.groupIds.some((id) => id.includes("brachycephalic")) || input.species === "cat";
    recommendations.push({
      id: `${input.petName}_uv_alert`,
      code: "high_uv_protection",
      title: `UV muy alto hoy (${input.uvIndex})`,
      detail: isLightCoated
        ? `${input.breed} tiene mayor riesgo de quemaduras en nariz y orejas. Evitá exposición directa al sol entre 11:00 y 16:00.`
        : `Evitá paseos largos bajo sol directo. Si no hay sombra, acortá la salida. El asfalto también quema las almohadillas.`,
      slot: "Hoy",
      icon: "wb_sunny",
      kind: input.uvIndex >= 11 ? "alert" : "recommendation",
      sourceModule: "uv_index",
    });
  }

  // ─── MODULE: Wind chill / strong wind ───────────────────────────────────
  if (input.windSpeedKmh !== null && input.windSpeedKmh !== undefined && input.windSpeedKmh >= 50) {
    const isSmallOrPuppy = input.isPuppy || input.groupIds.includes("dog.puppy");
    recommendations.push({
      id: `${input.petName}_wind_alert`,
      code: "strong_wind_caution",
      title: `Viento fuerte hoy (${input.windSpeedKmh} km/h)`,
      detail: isSmallOrPuppy
        ? `Cachorros y perros chicos pueden estresarse mucho con viento fuerte. Mejor salida corta y protegida.`
        : `El viento puede levantar objetos y generar ruidos que estresan. Paseo corto en zona reparada.`,
      slot: "Hoy",
      icon: "air",
      kind: "recommendation",
      sourceModule: "wind_alert",
    });
  }

  // ─── MODULE: Breed-specific daily needs ───────────────────────────────────
  const breedProfile = WELLBEING_MASTER_BOOK.breed_profiles.groups?.find((p) =>
    input.groupIds.includes(p.id as WellbeingSpeciesGroupId)
  );
  if (breedProfile) {
    // Primary risk alert
    if (breedProfile.primaryRisks && breedProfile.primaryRisks.length > 0) {
      const topRisk = breedProfile.primaryRisks[0];
      recommendations.push({
        id: `${input.petName}_breed_risk`,
        code: "breed_primary_risk",
        title: `Riesgo de raza: ${topRisk}`,
        detail: `Como ${input.breed}, ${input.petName} tiene predisposición a ${topRisk}. Consultá con tu veterinario si notás cambios.`,
        slot: "Preventivo",
        icon: "health_and_safety",
        kind: "recommendation",
        sourceModule: "breed_profile",
      });
    }
  }

  // ─── MODULE: Daily activity suggestion (personalized) ─────────────────────
  {
    let groupId = input.groupIds[0] || "dog.companion";
    // Fallback: no master book entries exist for these generic groupIds
    if (groupId === "dog.general") groupId = "dog.companion";
    if (groupId === "cat.brachycephalic") groupId = "cat.general";
    const weatherCondition = (input.isRaining || (input.temperatureC !== null && thermalProfile && input.temperatureC > (thermalProfile.avoidExerciseAboveC ?? 999)))
      ? "blocked"
      : "safe";

    const eligible = WELLBEING_MASTER_BOOK.daily_suggestions.filter(
      (s) => s.groupId === groupId && (s.weatherCondition === weatherCondition || s.weatherCondition === "any")
    );

    // Prefer activities matching pet's favorites
    const favorites = input.favoriteActivities || [];
    const categoryMap: Record<string, string> = { walk: "outdoor", park: "outdoor", cafe: "social", training: "training", swim: "outdoor" };
    const preferredCategories = favorites.map((f) => categoryMap[f]).filter(Boolean);

    let bestSuggestion = eligible.find((s) => preferredCategories.includes(s.category));
    if (!bestSuggestion && eligible.length > 0) {
      // Rotate by day of year
      const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24));
      bestSuggestion = eligible[dayOfYear % eligible.length];
    }

    if (bestSuggestion) {
      recommendations.push({
        id: `${input.petName}_daily_activity`,
        code: "daily_activity_suggestion",
        title: bestSuggestion.title,
        detail: `${bestSuggestion.detail} (${bestSuggestion.duration})`,
        slot: "Plan del día",
        icon: bestSuggestion.placeType === "park" ? "park" : bestSuggestion.placeType === "cafe" ? "local_cafe" : "sports_handball",
        kind: "recommendation",
        sourceModule: "daily_activity",
      });
    }
  }

  // ─── MODULE: Supply alert ─────────────────────────────────────────────────
  if (input.foodDaysLeft !== null && input.foodDaysLeft !== undefined) {
    if (input.foodDaysLeft <= 3) {
      recommendations.push({
        id: `${input.petName}_food_urgent`,
        code: "food_running_out",
        title: input.foodDaysLeft === 0 ? "Sin stock de comida" : `Quedan ${input.foodDaysLeft} días de comida`,
        detail: "Comprá ya para que no te quedes sin alimento.",
        slot: "Urgente",
        icon: "shopping_cart",
        kind: "alert",
        sourceModule: "supply_tracker",
      });
    } else if (input.foodDaysLeft <= 7) {
      recommendations.push({
        id: `${input.petName}_food_soon`,
        code: "food_restock_soon",
        title: `${input.foodDaysLeft} días de comida`,
        detail: "Conviene reponer esta semana.",
        slot: "Esta semana",
        icon: "inventory_2",
        kind: "recommendation",
        sourceModule: "supply_tracker",
      });
    }
  }

  // ─── MODULE: Fireworks/loud noises fear (seasonal) ────────────────────────
  {
    const today = new Date();
    const month = today.getMonth(); // 0-indexed
    const day = today.getDate();
    const hasNoiseFear = (input.fears || []).some((f) =>
      f.toLowerCase().includes("fuego") || f.toLowerCase().includes("pirotecnia") || f.toLowerCase().includes("artifici")
    );

    // Alertar cerca de fechas con pirotecnia:
    // - Navidad y Año Nuevo (20 dic - 2 ene)
    // - Día de la Revolución de Mayo (24-25 mayo)
    // - Día de la Independencia Argentina (8-9 julio)
    const isFireworksSeason =
      (month === 11 && day >= 20) || (month === 0 && day <= 2) ||
      (month === 4 && day >= 24 && day <= 25) ||
      (month === 6 && day >= 8 && day <= 9);

    if (hasNoiseFear && isFireworksSeason) {
      recommendations.push({
        id: `${input.petName}_fireworks_prep`,
        code: "fireworks_season_prep",
        title: `Preparar a ${input.petName} para la pirotecnia`,
        detail: "Cerrá ventanas, armá un refugio seguro, poné música relajante. Considerá chaleco antiansiedad si es muy intenso. No lo retes si se asusta.",
        slot: "Preventivo",
        icon: "shield",
        kind: "alert",
        sourceModule: "fears_seasonal",
      });
    }
  }

  // ─── ROUTING LAYER: apply segment strategy ────────────────────────────────
  const strategy = segmentId ? SEGMENT_STRATEGIES[segmentId] : null;
  const routedRecommendations = applySegmentStrategy(segmentId, input.petName, recommendations);

  // ─── TOP 3 SPLIT: primary (visible) vs secondary (collapsed) ─────────────
  const { primary, secondary } = splitPrimarySecondary(routedRecommendations);

  return {
    segmentId,
    segmentLabel: strategy?.label ?? null,
    segmentDescription: strategy?.description ?? null,
    recommendations: routedRecommendations,
    primary,
    secondary,
    activatedModules: [...new Set(routedRecommendations.map((item) => item.sourceModule))],
  };
}
