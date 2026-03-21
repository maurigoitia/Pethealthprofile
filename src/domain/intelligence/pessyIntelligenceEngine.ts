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

  return {
    segmentId,
    recommendations,
    activatedModules: [...new Set(recommendations.map((item) => item.sourceModule))],
  };
}
