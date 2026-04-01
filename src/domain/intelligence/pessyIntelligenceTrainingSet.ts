import {
  runPessyIntelligence,
  type PessyIntelligenceInput,
} from "./pessyIntelligenceEngine";
import type { TrainingSegmentId } from "../training/training_master_book";

export interface PessyTrainingCase {
  id: string;
  label: string;
  input: PessyIntelligenceInput;
  expectedCodes: string[];
  forbiddenCodes?: string[];
  expectedSegmentId: TrainingSegmentId | null;
}

export interface PessyTrainingCaseResult {
  id: string;
  label: string;
  passed: boolean;
  expectedCodes: string[];
  producedCodes: string[];
  missingCodes: string[];
  extraCodes: string[];
  forbiddenCodesFound: string[];
  expectedSegmentId: TrainingSegmentId | null;
  producedSegmentId: TrainingSegmentId | null;
  segmentLabel: string | null;
}

export interface PessyTrainingRunResult {
  total: number;
  passed: number;
  failed: number;
  scorePct: number;
  cases: PessyTrainingCaseResult[];
}

export const PESSY_INTELLIGENCE_TRAINING_SET: PessyTrainingCase[] = [
  {
    id: "thor_heat",
    label: "Thor · calor brachy",
    input: {
      petName: "Thor",
      species: "dog",
      breed: "Pug",
      ageLabel: "8 anos",
      groupIds: ["dog.brachycephalic", "dog.companion"],
      temperatureC: 31,
      humidityPct: 74,
    },
    expectedCodes: [
      "avoid_walk_heat",
      "indoor_play_heat",
      "practice_wait_signal",
      "segment_short_daily_sessions",
      "segment_same_words_in_household",
    ],
    expectedSegmentId: "companion",
  },
  {
    id: "lola_puppy",
    label: "Lola · cachorro sin vacunas",
    input: {
      petName: "Lola",
      species: "dog",
      breed: "Teckel",
      ageLabel: "12 semanas",
      ageWeeks: 12,
      groupIds: ["dog.puppy", "dog.companion"],
      temperatureC: 20,
      humidityPct: 58,
      isPuppy: true,
      isUnvaccinated: true,
    },
    expectedCodes: [
      "safe_socialization_session",
      "no_public_ground_unvaccinated",
      "practice_come",
      "segment_no_punishment",
      "segment_gradual_exposure",
    ],
    expectedSegmentId: "puppies",
  },
  {
    id: "milo_anxiety",
    label: "Milo · ansiedad por separacion",
    input: {
      petName: "Milo",
      species: "dog",
      breed: "Mestizo adoptado",
      ageLabel: "4 anos",
      groupIds: ["dog.reactive"],
      temperatureC: 23,
      humidityPct: 48,
      hasSeparationAnxiety: true,
    },
    expectedCodes: [
      "departure_routine_predictable",
      "special_toy_departure",
      "camera_monitoring",
      "practice_watch_me",
      "segment_strict_no_aversives",
      "segment_loose_leash_only",
      "segment_trigger_management",
    ],
    expectedSegmentId: "reactive",
  },
  {
    id: "nori_heat",
    label: "Nori · gato persa con calor",
    input: {
      petName: "Nori",
      species: "cat",
      breed: "Persa",
      ageLabel: "5 anos",
      groupIds: ["cat.brachycephalic"],
      temperatureC: 31,
      humidityPct: 71,
    },
    expectedCodes: ["indoor_cooling_now", "cooling_support"],
    expectedSegmentId: null,
  },
  {
    id: "rocky_aggression_reactive",
    label: "Rocky · mestizo adoptado con senales de agresividad",
    input: {
      petName: "Rocky",
      species: "dog",
      breed: "Mestizo adoptado",
      ageLabel: "3 anos",
      groupIds: ["dog.reactive"],
      temperatureC: 22,
      humidityPct: 50,
      hasAggressionSigns: true,
    },
    expectedCodes: [
      "identify_aggression_triggers",
      "vet_pain_check_aggression",
      "desensitization_gradual",
      "never_punish_growl",
      "refer_professional_aggression",
      "practice_leave_it",
      "segment_strict_no_aversives",
      "segment_loose_leash_only",
      "segment_trigger_management",
    ],
    expectedSegmentId: "reactive",
  },
  {
    id: "luna_puppy_aggression",
    label: "Luna · cachorra con senales de miedo-agresividad temprana",
    input: {
      petName: "Luna",
      species: "dog",
      breed: "Pastor Aleman",
      ageLabel: "14 semanas",
      ageWeeks: 14,
      groupIds: ["dog.puppy", "dog.active_working"],
      temperatureC: 18,
      humidityPct: 45,
      isPuppy: true,
      hasAggressionSigns: true,
    },
    expectedCodes: [
      "safe_socialization_session",
      "identify_aggression_triggers",
      "vet_pain_check_aggression",
      "desensitization_gradual",
      "never_punish_growl",
      "refer_professional_aggression",
      "practice_leave_it",
      "segment_strict_no_aversives",
      "segment_loose_leash_only",
      "segment_trigger_management",
    ],
    expectedSegmentId: "reactive",
  },
];

export function runPessyIntelligenceTrainingSet(): PessyTrainingRunResult {
  const cases = PESSY_INTELLIGENCE_TRAINING_SET.map<PessyTrainingCaseResult>((trainingCase) => {
    const result = runPessyIntelligence(trainingCase.input);
    const producedCodes = result.recommendations.map((recommendation) => recommendation.code);
    const missingCodes = trainingCase.expectedCodes.filter((code) => !producedCodes.includes(code));
    const extraCodes = producedCodes.filter((code) => !trainingCase.expectedCodes.includes(code));
    const forbiddenCodesFound = (trainingCase.forbiddenCodes || []).filter((code) => producedCodes.includes(code));
    const segmentMatches = result.segmentId === trainingCase.expectedSegmentId;
    const passed = missingCodes.length === 0 && segmentMatches && forbiddenCodesFound.length === 0;

    return {
      id: trainingCase.id,
      label: trainingCase.label,
      passed,
      expectedCodes: trainingCase.expectedCodes,
      producedCodes,
      missingCodes,
      extraCodes,
      forbiddenCodesFound,
      expectedSegmentId: trainingCase.expectedSegmentId,
      producedSegmentId: result.segmentId,
      segmentLabel: result.segmentLabel,
    };
  });

  const passed = cases.filter((item) => item.passed).length;
  const total = cases.length;

  return {
    total,
    passed,
    failed: total - passed,
    scorePct: Math.round((passed / total) * 100),
    cases,
  };
}
