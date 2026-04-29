export interface WalkSchedulePreference {
  id: "walk_1" | "walk_2";
  label: string;
  time24: string;
}

export interface UserRoutinePreferences {
  walkSchedule: WalkSchedulePreference[];
}

export const DEFAULT_WALK_ROUTINE_PREFERENCES: Record<string, UserRoutinePreferences> = {
  thor_heat: {
    walkSchedule: [
      { id: "walk_1", label: "Paseo 1", time24: "08:00" },
      { id: "walk_2", label: "Paseo 2", time24: "14:00" },
    ],
  },
  lola_puppy: {
    walkSchedule: [
      { id: "walk_1", label: "Salida controlada", time24: "09:00" },
      { id: "walk_2", label: "Jardin o brazos", time24: "18:00" },
    ],
  },
  milo_anxiety: {
    walkSchedule: [
      { id: "walk_1", label: "Salida previa", time24: "07:30" },
      { id: "walk_2", label: "Salida habitual", time24: "13:30" },
    ],
  },
};
