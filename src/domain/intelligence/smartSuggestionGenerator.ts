import type { ThermalSafetyProfile, WellbeingSpeciesGroupId } from "../wellbeing/wellbeingMasterBook";
import { WELLBEING_MASTER_BOOK } from "../wellbeing/wellbeingMasterBook";
import type { WalkSchedulePreference } from "./userRoutinePreferences";

export interface SmartSuggestionInput {
  petName: string;
  species: "dog" | "cat";
  breed: string;
  groupIds: WellbeingSpeciesGroupId[];
  temperatureC: number | null;
  humidityPct: number | null;
  walkSchedule: WalkSchedulePreference[];
}

export interface SmartSuggestionResult {
  headline: string;
  body: string;
  replacementTime: string | null;
  riskyWalkTimes: string[];
  safeWalkTimes: string[];
}

function parseHourMinutes(time24: string) {
  const [hours, minutes] = time24.split(":").map((part) => Number(part));
  return hours * 60 + minutes;
}

function isWithinWindow(time24: string, start: string, end: string) {
  const value = parseHourMinutes(time24);
  return value >= parseHourMinutes(start) && value <= parseHourMinutes(end);
}

function resolveThermalProfile(input: SmartSuggestionInput): ThermalSafetyProfile | null {
  const priority = input.groupIds.find((id) => id === "dog.brachycephalic" || id === "cat.brachycephalic");

  if (priority) {
    return WELLBEING_MASTER_BOOK.thermal_safety.groups.find((group) => group.id === priority) ?? null;
  }

  if (input.species === "cat") {
    return WELLBEING_MASTER_BOOK.thermal_safety.groups.find((group) => group.id === "cat.general") ?? null;
  }

  return WELLBEING_MASTER_BOOK.thermal_safety.groups.find((group) => group.id === "dog.general") ?? null;
}

export function generateWalkSmartSuggestion(input: SmartSuggestionInput): SmartSuggestionResult | null {
  if (input.species !== "dog" || input.temperatureC === null) {
    return null;
  }

  const thermalProfile = resolveThermalProfile(input);
  if (!thermalProfile) {
    return null;
  }

  const riskyWindowStart = "12:00";
  const riskyWindowEnd = "19:00";
  const replacementTime = input.groupIds.includes("dog.brachycephalic") ? "19:00" : "18:30";

  const riskyWalkTimes = input.walkSchedule
    .map((item) => item.time24)
    .filter((time24) => isWithinWindow(time24, riskyWindowStart, riskyWindowEnd));

  const safeWalkTimes = input.walkSchedule
    .map((item) => item.time24)
    .filter((time24) => !riskyWalkTimes.includes(time24));

  if (!riskyWalkTimes.length) {
    return {
      headline: `Los horarios de ${input.petName} se ven seguros para hoy`,
      body: `No detecte cruces peligrosos con el clima actual. Igual conviene observar ${thermalProfile.earlySigns[0].toLowerCase()}.`,
      replacementTime: null,
      riskyWalkTimes,
      safeWalkTimes,
    };
  }

  return {
    headline: `Pessy detecto un cruce riesgoso para ${input.petName}`,
    body: `Vi que soles salir a las ${riskyWalkTimes.join(" y ")}, pero hoy va a hacer ${input.temperatureC} C. Para ${input.breed} esto cruza el guardrail de ${thermalProfile.avoidExerciseAboveC} C.`,
    replacementTime,
    riskyWalkTimes,
    safeWalkTimes,
  };
}
