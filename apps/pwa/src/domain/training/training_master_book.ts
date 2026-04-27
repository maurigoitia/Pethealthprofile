import { WELLBEING_MASTER_BOOK } from "../wellbeing/wellbeingMasterBook";

export const TRAINING_MASTER_BOOK_VERSION = "training_master_book_v1";

export type TrainingGuardrailType = "block" | "alert" | "recommendation";
export type TrainingSegmentId = "puppies" | "active_working" | "reactive" | "companion";

export interface TrainingGlobalPrinciples {
  minSessionDurationMinutes: number;
  maxSessionDurationMinutes: number;
  preferredMethodology: "positive_reinforcement";
  prohibitedTools: string[];
  consistencyRule: "all_tutors_use_same_commands";
}

export interface TrainingSegment {
  id: TrainingSegmentId;
  species: "dog";
  priority: string;
  criticalWindowWeeks?: { start: number; end: number };
  extendedSupportUntilWeeks?: number;
  needs?: string[];
  risks?: string[];
  guardrails: string[];
  recommendedTasks: string[];
}

export interface TrainingCommand {
  id: string;
  label: string;
  goal: string;
  instruction: string;
  guardrailType: TrainingGuardrailType;
}

export interface TrainingMasterBook {
  version: typeof TRAINING_MASTER_BOOK_VERSION;
  global_principles: TrainingGlobalPrinciples;
  segments: Record<TrainingSegmentId, TrainingSegment>;
  command_library: TrainingCommand[];
}

const sessionMin = WELLBEING_MASTER_BOOK.training_foundations.sessionMinutes.min;
const sessionMax = WELLBEING_MASTER_BOOK.training_foundations.sessionMinutes.max;

export const TRAINING_MASTER_BOOK: TrainingMasterBook = {
  version: TRAINING_MASTER_BOOK_VERSION,
  global_principles: {
    minSessionDurationMinutes: sessionMin,
    maxSessionDurationMinutes: sessionMax,
    preferredMethodology: "positive_reinforcement",
    prohibitedTools: [
      "aversive_collars",
      "choke_chains",
      "punishment_physical",
    ],
    consistencyRule: "all_tutors_use_same_commands",
  },
  segments: {
    puppies: {
      id: "puppies",
      species: "dog",
      priority: "socialization_and_habituation",
      criticalWindowWeeks: {
        start: WELLBEING_MASTER_BOOK.puppy_socialization.criticalWindowWeeks.start,
        end: WELLBEING_MASTER_BOOK.puppy_socialization.criticalWindowWeeks.end,
      },
      extendedSupportUntilWeeks: 16,
      guardrails: [
        "no_punishment",
        "gradual_exposure",
        "no_public_ground_if_unvaccinated",
      ],
      recommendedTasks: [
        "noise_habituation",
        "tactile_exploration",
        "brief_social_play",
      ],
    },
    active_working: {
      id: "active_working",
      species: "dog",
      priority: "cognitive_load_and_impulse_control",
      needs: ["mental_stimulation", "work_tasks"],
      risks: ["anxiety_lack_of_stimulus", "destructive_behavior"],
      guardrails: ["avoid_understimulation", "avoid_inconsistent_commands"],
      recommendedTasks: ["advanced_recall", "scent_work", "long_stay"],
    },
    reactive: {
      id: "reactive",
      species: "dog",
      priority: "desensitization_and_safety",
      guardrails: [
        "strict_no_aversives",
        "loose_leash_only",
        "trigger_management",
      ],
      risks: ["aggression_escalation", "chronic_stress"],
      recommendedTasks: ["calm_reinforcement", "distance_management"],
    },
    companion: {
      id: "companion",
      species: "dog",
      priority: "routine_and_enrichment",
      needs: ["physical_exercise", "basic_manners"],
      risks: ["boredom_barking", "indoor_destruction"],
      guardrails: ["short_daily_sessions", "same_words_in_household"],
      recommendedTasks: ["daily_trick_session", "structured_play"],
    },
  },
  command_library: WELLBEING_MASTER_BOOK.impulse_control.commands.map((command) => ({
    id: command.id,
    label: command.label,
    goal: command.goal,
    instruction: command.instruction,
    guardrailType: command.guardrailType,
  })),
};
