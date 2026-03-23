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
  recommendations: PessyIntelligenceRecommendation[];
  activatedModules: string[];
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

  if (input.hasSeparationAnxiety || input.groupIds.includes("dog.reactive")) {
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

  if (input.species === "dog") {
    const foodRule = WELLBEING_MASTER_BOOK.food_safety.prohibited.find((item) => item.id === "spoiled_food");
    if (foodRule) {
      recommendations.push({
        id: `${input.petName}_kitchen`,
        code: "kitchen_trash_check",
        title: "Chequeo de cocina y basura",
        detail: `${foodRule.label}: ${foodRule.danger}. ${foodRule.action}.`,
        slot: "Casa",
        icon: "kitchen",
        kind: foodRule.guardrailType === "block" ? "block" : "alert",
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
      const groupId = input.groupIds[0] || "dog.companion";
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

  // ─── MODULE: Breed-specific daily needs ───────────────────────────────────
  const breedProfile = WELLBEING_MASTER_BOOK.breed_profiles?.find((p) =>
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
    const groupId = input.groupIds[0] || "dog.companion";
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

    // Alertar cerca de fechas con pirotecnia (24-25 dic, 31 dic-1 ene, fiestas patrias)
    const isFireworksSeason = (month === 11 && day >= 20) || (month === 0 && day <= 2);

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

  return {
    segmentId,
    recommendations,
    activatedModules: [...new Set(recommendations.map((item) => item.sourceModule))],
  };
}
