import { useMemo, useState } from "react";
import { MaterialIcon } from "../shared/MaterialIcon";
import {
  WELLBEING_MASTER_BOOK,
  type BreedBehaviorProfile,
  type FoodSafetyItem,
  type SeparationAnxietyRule,
  type ThermalSafetyProfile,
  type WellbeingSpeciesGroupId,
} from "../../domain/wellbeing/wellbeingMasterBook";
import {
  TRAINING_MASTER_BOOK,
} from "../../domain/training/training_master_book";
import {
  runPessyIntelligence,
  inferTrainingSegmentId,
} from "../../domain/intelligence/pessyIntelligenceEngine";
import { runPessyIntelligenceTrainingSet } from "../../domain/intelligence/pessyIntelligenceTrainingSet";
import {
  DEFAULT_WALK_ROUTINE_PREFERENCES,
  type UserRoutinePreferences,
} from "../../domain/intelligence/userRoutinePreferences";
import { generateWalkSmartSuggestion } from "../../domain/intelligence/smartSuggestionGenerator";

type PreviewScenarioId = "thor_heat" | "lola_puppy" | "milo_anxiety" | "nori_heat";
type PreviewActionKind = "block" | "alert" | "recommendation";

interface PreviewScenario {
  id: PreviewScenarioId;
  petName: string;
  speciesLabel: string;
  breed: string;
  ageLabel: string;
  summary: string;
  temperatureC: number | null;
  humidityPct: number | null;
  groupIds: WellbeingSpeciesGroupId[];
  hasSeparationAnxiety?: boolean;
  isPuppy?: boolean;
  isUnvaccinated?: boolean;
}

const PREVIEW_SCENARIOS: PreviewScenario[] = [
  {
    id: "thor_heat",
    petName: "Thor",
    speciesLabel: "Perro",
    breed: "Pug",
    ageLabel: "8 anos",
    summary: "Dia muy caluroso. Pessy debe bloquear esfuerzo y bajar la carga mental del tutor.",
    temperatureC: 31,
    humidityPct: 74,
    groupIds: ["dog.brachycephalic", "dog.companion"],
  },
  {
    id: "lola_puppy",
    petName: "Lola",
    speciesLabel: "Perro",
    breed: "Teckel",
    ageLabel: "12 semanas",
    summary: "Cachorra sin esquema completo. La app tiene que ordenar socializacion segura y mini sesiones.",
    temperatureC: 20,
    humidityPct: 58,
    groupIds: ["dog.puppy", "dog.companion"],
    isPuppy: true,
    isUnvaccinated: true,
  },
  {
    id: "milo_anxiety",
    petName: "Milo",
    speciesLabel: "Perro",
    breed: "Mestizo adoptado",
    ageLabel: "4 anos",
    summary: "Tutor reporta roturas y llanto al salir. Pessy tiene que sugerir rutina de salida y guardrails.",
    temperatureC: 23,
    humidityPct: 48,
    groupIds: ["dog.reactive"],
    hasSeparationAnxiety: true,
  },
  {
    id: "nori_heat",
    petName: "Nori",
    speciesLabel: "Gato",
    breed: "Persa",
    ageLabel: "5 anos",
    summary: "Gato persa en dia pesado. La app debe priorizar interior fresco, agua y vigilancia.",
    temperatureC: 31,
    humidityPct: 71,
    groupIds: ["cat.brachycephalic"],
  },
];

const ACTION_STYLES: Record<
  PreviewActionKind,
  { card: string; badge: string; iconWrap: string; label: string }
> = {
  block: {
    card: "border-rose-200 bg-rose-50",
    badge: "bg-rose-100 text-rose-700",
    iconWrap: "bg-rose-100 text-rose-700",
    label: "Bloqueo",
  },
  alert: {
    card: "border-amber-200 bg-amber-50",
    badge: "bg-amber-100 text-amber-700",
    iconWrap: "bg-amber-100 text-amber-700",
    label: "Alerta",
  },
  recommendation: {
    card: "border-emerald-200 bg-emerald-50",
    badge: "bg-emerald-100 text-emerald-700",
    iconWrap: "bg-emerald-100 text-emerald-700",
    label: "Recomendacion",
  },
};

function findThermalProfile(scenario: PreviewScenario): ThermalSafetyProfile | null {
  const priority = scenario.groupIds.find((id) => id === "dog.brachycephalic" || id === "cat.brachycephalic");

  if (priority) {
    return WELLBEING_MASTER_BOOK.thermal_safety.groups.find((group) => group.id === priority) ?? null;
  }

  if (scenario.speciesLabel === "Gato") {
    return WELLBEING_MASTER_BOOK.thermal_safety.groups.find((group) => group.id === "cat.general") ?? null;
  }

  return WELLBEING_MASTER_BOOK.thermal_safety.groups.find((group) => group.id === "dog.general") ?? null;
}

function findBreedProfiles(scenario: PreviewScenario): BreedBehaviorProfile[] {
  return scenario.groupIds
    .map((id) => WELLBEING_MASTER_BOOK.breed_profiles.groups.find((group) => group.id === id))
    .filter((group): group is BreedBehaviorProfile => Boolean(group));
}

function getFoodRule(scenario: PreviewScenario): FoodSafetyItem | null {
  if (scenario.speciesLabel !== "Perro") {
    return null;
  }

  return WELLBEING_MASTER_BOOK.food_safety.prohibited.find((item) => item.id === "spoiled_food") ?? null;
}

function buildScenarioGuardrails(
  scenario: PreviewScenario,
  thermalProfile: ThermalSafetyProfile | null
): SeparationAnxietyRule[] {
  const guardrails: SeparationAnxietyRule[] = [];

  if (scenario.hasSeparationAnxiety) {
    guardrails.push(...WELLBEING_MASTER_BOOK.separation_anxiety.never_do);
  }

  if (scenario.isPuppy && scenario.isUnvaccinated) {
    guardrails.push(
      {
        id: "no_public_ground",
        label: "No al suelo publico",
        detail: WELLBEING_MASTER_BOOK.puppy_socialization.avoidBeforeVaccines[0],
        kind: "guardrail",
        guardrailType: "block",
      },
      {
        id: "no_force_fear",
        label: "No forzar si se asusta",
        detail: WELLBEING_MASTER_BOOK.puppy_socialization.ifFearAppears[1],
        kind: "guardrail",
        guardrailType: "block",
      }
    );
  }

  if (thermalProfile) {
    guardrails.push({
      id: `${scenario.id}_thermal_watch`,
      label: "Senales a observar",
      detail: thermalProfile.earlySigns.join(" / "),
      kind: thermalProfile.kind,
      guardrailType: thermalProfile.guardrailType,
    });
  }

  return guardrails;
}

function formatPayload(
  scenario: PreviewScenario,
  actions: DerivedPreviewAction[],
  groupLabels: string[],
  trainingSegment: TrainingSegment | null
) {
  return JSON.stringify(
    {
      qaOnly: true,
      scenario: scenario.id,
      pet: {
        name: scenario.petName,
        species: scenario.speciesLabel,
        breed: scenario.breed,
        ageLabel: scenario.ageLabel,
      },
      environment: {
        temperatureC: scenario.temperatureC,
        humidityPct: scenario.humidityPct,
      },
      matchedGroups: groupLabels,
      trainingSegment: trainingSegment
        ? {
            id: trainingSegment.id,
            priority: trainingSegment.priority,
            recommendedTasks: trainingSegment.recommendedTasks,
          }
        : null,
      activatedModules: [...new Set(actions.map((action) => action.sourceModule))],
      pendingActions: actions.map((action) => ({
        id: action.id,
        kind: action.kind,
        title: action.title,
        sourceModule: action.sourceModule,
      })),
    },
    null,
    2
  );
}

export function WellbeingMasterBookPreviewScreen() {
  const [selectedScenarioId, setSelectedScenarioId] = useState<PreviewScenarioId>("thor_heat");
  const [completedActionIds, setCompletedActionIds] = useState<string[]>([]);
  const [routinePreferencesByScenarioId, setRoutinePreferencesByScenarioId] = useState<
    Record<string, UserRoutinePreferences>
  >(DEFAULT_WALK_ROUTINE_PREFERENCES);

  const scenario = useMemo(
    () => PREVIEW_SCENARIOS.find((item) => item.id === selectedScenarioId) ?? PREVIEW_SCENARIOS[0],
    [selectedScenarioId]
  );

  const thermalProfile = useMemo(() => findThermalProfile(scenario), [scenario]);
  const breedProfiles = useMemo(() => findBreedProfiles(scenario), [scenario]);
  const trainingSegmentId = useMemo(
    () =>
      inferTrainingSegmentId({
        petName: scenario.petName,
        species: scenario.speciesLabel === "Gato" ? "cat" : "dog",
        breed: scenario.breed,
        ageLabel: scenario.ageLabel,
        groupIds: scenario.groupIds,
        temperatureC: scenario.temperatureC,
        humidityPct: scenario.humidityPct,
        hasSeparationAnxiety: scenario.hasSeparationAnxiety,
        isPuppy: scenario.isPuppy,
        isUnvaccinated: scenario.isUnvaccinated,
      }),
    [scenario]
  );
  const trainingSegment = useMemo(
    () => (trainingSegmentId ? TRAINING_MASTER_BOOK.segments[trainingSegmentId] : null),
    [trainingSegmentId]
  );
  const foodRule = useMemo(() => getFoodRule(scenario), [scenario]);
  const intelligenceRun = useMemo(
    () =>
      runPessyIntelligence({
        petName: scenario.petName,
        species: scenario.speciesLabel === "Gato" ? "cat" : "dog",
        breed: scenario.breed,
        ageLabel: scenario.ageLabel,
        groupIds: scenario.groupIds,
        temperatureC: scenario.temperatureC,
        humidityPct: scenario.humidityPct,
        hasSeparationAnxiety: scenario.hasSeparationAnxiety,
        isPuppy: scenario.isPuppy,
        isUnvaccinated: scenario.isUnvaccinated,
      }),
    [scenario]
  );
  const trainingEval = useMemo(() => runPessyIntelligenceTrainingSet(), []);
  const walkRoutinePreferences = routinePreferencesByScenarioId[scenario.id] ?? null;
  const smartWalkSuggestion = useMemo(
    () =>
      walkRoutinePreferences
        ? generateWalkSmartSuggestion({
            petName: scenario.petName,
            species: scenario.speciesLabel === "Gato" ? "cat" : "dog",
            breed: scenario.breed,
            groupIds: scenario.groupIds,
            temperatureC: scenario.temperatureC,
            humidityPct: scenario.humidityPct,
            walkSchedule: walkRoutinePreferences.walkSchedule,
          })
        : null,
    [scenario, walkRoutinePreferences]
  );

  const actions = intelligenceRun.recommendations;

  const guardrails = useMemo(
    () => buildScenarioGuardrails(scenario, thermalProfile),
    [scenario, thermalProfile]
  );

  const householdFoodRules = useMemo(
    () => WELLBEING_MASTER_BOOK.food_safety.prohibited.slice(0, 4),
    []
  );

  const payload = useMemo(
    () => formatPayload(scenario, actions, breedProfiles.map((profile) => profile.label), trainingSegment),
    [scenario, actions, breedProfiles, trainingSegment]
  );

  const activeModules = intelligenceRun.activatedModules;

  const toggleAction = (actionId: string) => {
    setCompletedActionIds((current) =>
      current.includes(actionId) ? current.filter((id) => id !== actionId) : [...current, actionId]
    );
  };

  const updateWalkTime = (slotId: "walk_1" | "walk_2", time24: string) => {
    setRoutinePreferencesByScenarioId((current) => {
      const scenarioPreferences = current[scenario.id];
      if (!scenarioPreferences) {
        return current;
      }

      return {
        ...current,
        [scenario.id]: {
          ...scenarioPreferences,
          walkSchedule: scenarioPreferences.walkSchedule.map((slot) =>
            slot.id === slotId ? { ...slot, time24 } : slot
          ),
        },
      };
    });
  };

  return (
    <div className="min-h-screen bg-[#f4f4f8] text-slate-900">
      <div className="mx-auto max-w-6xl px-4 pb-16 pt-6 sm:px-6 lg:px-8">
        <div className="overflow-hidden rounded-[32px] bg-gradient-to-br from-[#074738] via-[#0b5a47] to-[#169675] px-5 py-6 text-white shadow-[0_28px_80px_rgba(7,71,56,0.28)] sm:px-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/70">
                QA only · master book preview
              </p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
                Pessy ya puede leer bienestar, entrenamiento y ansiedad sin tocar produccion
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-6 text-white/80 sm:text-base">
                Esta pantalla no escribe en base. Solo muestra como el libro maestro se traduce a acciones,
                guardrails y copy dentro de la PWA.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div className="rounded-3xl border border-white/12 bg-white/10 p-4 backdrop-blur">
                <p className="text-xs uppercase tracking-[0.2em] text-white/60">Escenarios</p>
                <p className="mt-2 text-2xl font-semibold">{PREVIEW_SCENARIOS.length}</p>
              </div>
              <div className="rounded-3xl border border-white/12 bg-white/10 p-4 backdrop-blur">
                <p className="text-xs uppercase tracking-[0.2em] text-white/60">Modelo QA</p>
                <p className="mt-2 text-2xl font-semibold">{trainingEval.scorePct}%</p>
              </div>
              <div className="rounded-3xl border border-white/12 bg-white/10 p-4 backdrop-blur col-span-2 sm:col-span-1">
                <p className="text-xs uppercase tracking-[0.2em] text-white/60">Casos</p>
                <p className="mt-2 text-2xl font-semibold">{trainingEval.passed}/{trainingEval.total}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 flex gap-3 overflow-x-auto pb-2">
          {PREVIEW_SCENARIOS.map((item) => {
            const isActive = item.id === selectedScenarioId;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelectedScenarioId(item.id)}
                className={`min-w-[240px] rounded-[28px] border px-4 py-4 text-left transition ${
                  isActive
                    ? "border-[#074738] bg-[#074738] text-white shadow-[0_18px_40px_rgba(7,71,56,0.18)]"
                    : "border-slate-200 bg-white text-slate-900 hover:border-[#074738]/30"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className={`text-xs font-semibold uppercase tracking-[0.18em] ${isActive ? "text-white/70" : "text-slate-400"}`}>
                      {item.speciesLabel}
                    </p>
                    <p className="mt-2 text-lg font-semibold">
                      {item.petName} · {item.breed}
                    </p>
                    <p className={`mt-2 text-sm leading-5 ${isActive ? "text-white/80" : "text-slate-600"}`}>
                      {item.summary}
                    </p>
                  </div>
                  <MaterialIcon name={isActive ? "radio_button_checked" : "radio_button_unchecked"} className={isActive ? "text-white" : "text-slate-400"} />
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-6">
            <section className="rounded-[28px] bg-white p-5 shadow-[0_20px_60px_rgba(15,23,42,0.06)] sm:p-6">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Escenario activo
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold text-[#0b3c31]">
                    {scenario.petName} · {scenario.breed}
                  </h2>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{scenario.summary}</p>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-3xl bg-slate-50 px-4 py-3">
                    <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Edad</p>
                    <p className="mt-1 font-semibold text-slate-900">{scenario.ageLabel}</p>
                  </div>
                  <div className="rounded-3xl bg-slate-50 px-4 py-3">
                    <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Clima</p>
                    <p className="mt-1 font-semibold text-slate-900">
                      {scenario.temperatureC === null ? "N/A" : `${scenario.temperatureC} C`}
                    </p>
                  </div>
                  <div className="rounded-3xl bg-slate-50 px-4 py-3">
                    <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Humedad</p>
                    <p className="mt-1 font-semibold text-slate-900">
                      {scenario.humidityPct === null ? "N/A" : `${scenario.humidityPct}%`}
                    </p>
                  </div>
                  <div className="rounded-3xl bg-slate-50 px-4 py-3">
                    <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Motor</p>
                    <p className="mt-1 font-semibold text-slate-900">{activeModules.join(", ")}</p>
                  </div>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                {breedProfiles.map((profile) => (
                  <span
                    key={profile.id}
                    className="rounded-full border border-[#074738]/15 bg-[#074738]/5 px-3 py-1 text-xs font-semibold text-[#074738]"
                  >
                    {profile.label}
                  </span>
                ))}
                {!breedProfiles.length && (
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-500">
                    Sin grupo extra
                  </span>
                )}
              </div>
            </section>

            <section className="rounded-[28px] bg-white p-5 shadow-[0_20px_60px_rgba(15,23,42,0.06)] sm:p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Habitos del tutor
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold text-[#0b3c31]">
                    Formulario de horarios de paseo
                  </h2>
                </div>
                <MaterialIcon name="schedule" className="text-3xl text-[#074738]" />
              </div>

              {walkRoutinePreferences ? (
                <div className="mt-5 space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    {walkRoutinePreferences.walkSchedule.map((slot) => (
                      <label key={slot.id} className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                        <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                          {slot.label}
                        </span>
                        <input
                          type="time"
                          value={slot.time24}
                          onChange={(event) => updateWalkTime(slot.id, event.target.value)}
                          className="mt-3 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base font-semibold text-slate-900 outline-none ring-0"
                        />
                      </label>
                    ))}
                  </div>

                  {smartWalkSuggestion && (
                    <div className="rounded-[24px] border border-[#074738]/15 bg-[#074738] p-4 text-white">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/70">
                            Sugerencia proactiva
                          </p>
                          <h3 className="mt-2 text-lg font-semibold">{smartWalkSuggestion.headline}</h3>
                          <p className="mt-2 text-sm leading-6 text-white/85">{smartWalkSuggestion.body}</p>
                        </div>
                        <MaterialIcon name="wb_sunny" className="text-3xl text-white" />
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        {smartWalkSuggestion.riskyWalkTimes.map((time24) => (
                          <span
                            key={time24}
                            className="rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-700"
                          >
                            Riesgoso: {time24}
                          </span>
                        ))}
                        {smartWalkSuggestion.safeWalkTimes.map((time24) => (
                          <span
                            key={time24}
                            className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700"
                          >
                            Seguro: {time24}
                          </span>
                        ))}
                      </div>

                      {smartWalkSuggestion.replacementTime && (
                        <button
                          type="button"
                          className="mt-4 inline-flex items-center gap-2 rounded-full bg-white px-4 py-3 text-sm font-semibold text-[#074738]"
                        >
                          <MaterialIcon name="notifications_active" className="text-lg text-[#074738]" />
                          Avisame a las {smartWalkSuggestion.replacementTime}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="mt-5 rounded-[24px] border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600">
                  Este bloque se muestra cuando hay rutina de paseo. En gatos por ahora no se pide horario
                  exterior; el motor solo actua con guardrails de entorno.
                </div>
              )}
            </section>

            <section className="rounded-[28px] bg-white p-5 shadow-[0_20px_60px_rgba(15,23,42,0.06)] sm:p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Pessy hoy te diria
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold text-[#0b3c31]">Pending actions QA</h2>
                </div>
                <div className="rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-600">
                  {completedActionIds.length}/{actions.length} completadas
                </div>
              </div>

              <div className="mt-5 space-y-4">
                {actions.map((action) => {
                  const style = ACTION_STYLES[action.kind];
                  const isDone = completedActionIds.includes(action.id);

                  return (
                    <div
                      key={action.id}
                      className={`rounded-[24px] border p-4 transition ${style.card} ${isDone ? "opacity-70" : ""}`}
                    >
                      <div className="flex items-start gap-4">
                        <button
                          type="button"
                          onClick={() => toggleAction(action.id)}
                          className={`mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border ${
                            isDone
                              ? "border-[#074738] bg-[#074738] text-white"
                              : "border-slate-300 bg-white text-slate-400"
                          }`}
                          aria-label={`Marcar ${action.title}`}
                        >
                          <MaterialIcon name={isDone ? "check" : "circle"} className="text-lg" />
                        </button>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${style.badge}`}>
                              <MaterialIcon name={action.icon} className="text-base" />
                              {style.label}
                            </span>
                            <span className="rounded-full bg-white/70 px-3 py-1 text-xs font-semibold text-slate-500">
                              {action.sourceModule}
                            </span>
                            <span className="rounded-full bg-white/70 px-3 py-1 text-xs font-semibold text-slate-500">
                              {action.slot}
                            </span>
                          </div>

                          <h3 className="mt-3 text-lg font-semibold text-slate-900">{action.title}</h3>
                          <p className="mt-2 text-sm leading-6 text-slate-600">{action.detail}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="rounded-[28px] bg-white p-5 shadow-[0_20px_60px_rgba(15,23,42,0.06)] sm:p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Entrenamiento del modelo</p>
                  <h2 className="mt-2 text-2xl font-semibold text-[#0b3c31]">Eval loop QA</h2>
                </div>
                <div className="rounded-full bg-[#074738] px-4 py-2 text-sm font-semibold text-white">
                  {trainingEval.scorePct}% pass
                </div>
              </div>

              <div className="mt-5 space-y-3">
                {trainingEval.cases.map((trainingCase) => (
                  <div key={trainingCase.id} className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{trainingCase.label}</p>
                        <p className="mt-1 text-sm text-slate-500">
                          Segmento esperado: {trainingCase.expectedSegmentId ?? "none"} · obtenido: {trainingCase.producedSegmentId ?? "none"}
                        </p>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${trainingCase.passed ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
                        {trainingCase.passed ? "PASS" : "FAIL"}
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {trainingCase.expectedCodes.map((code) => (
                        <span
                          key={code}
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${
                            trainingCase.producedCodes.includes(code)
                              ? "bg-[#074738]/10 text-[#074738]"
                              : "bg-rose-100 text-rose-700"
                          }`}
                        >
                          {code}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-[28px] bg-white p-5 shadow-[0_20px_60px_rgba(15,23,42,0.06)] sm:p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Guardrails
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold text-[#0b3c31]">Nunca hacer / senales a mirar</h2>
                </div>
                <MaterialIcon name="shield" className="text-3xl text-[#074738]" />
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                {guardrails.map((item) => (
                  <div key={item.id} className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                      <MaterialIcon
                        name={item.guardrailType === "block" ? "block" : item.guardrailType === "alert" ? "notification_important" : "check_circle"}
                        className={item.guardrailType === "block" ? "text-rose-500" : item.guardrailType === "alert" ? "text-amber-500" : "text-emerald-500"}
                      />
                      {item.label}
                    </div>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{item.detail}</p>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <div className="space-y-6">
            <section className="rounded-[28px] bg-white p-5 shadow-[0_20px_60px_rgba(15,23,42,0.06)] sm:p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Training layer</p>
              <h2 className="mt-2 text-2xl font-semibold text-[#0b3c31]">Coach silencioso</h2>

              <div className="mt-5 space-y-4">
                <div className="rounded-[24px] bg-[#074738] p-4 text-white">
                  <p className="text-xs uppercase tracking-[0.18em] text-white/70">Base de entrenamiento</p>
                  <p className="mt-2 text-sm leading-6 text-white/85">
                    Sesiones de {TRAINING_MASTER_BOOK.global_principles.minSessionDurationMinutes}-
                    {TRAINING_MASTER_BOOK.global_principles.maxSessionDurationMinutes} minutos. Refuerzo
                    positivo unicamente. Todos los tutores usan la misma palabra.
                  </p>
                </div>

                <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Segmento activo</p>
                  {trainingSegment ? (
                    <>
                      <div className="mt-2 flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{trainingSegment.id}</p>
                          <p className="mt-1 text-sm text-slate-500">{trainingSegment.priority}</p>
                        </div>
                        <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-500">
                          dog
                        </span>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {trainingSegment.recommendedTasks.map((task) => (
                          <span
                            key={task}
                            className="rounded-full border border-[#074738]/15 bg-white px-3 py-1 text-xs font-semibold text-[#074738]"
                          >
                            {task}
                          </span>
                        ))}
                      </div>
                    </>
                  ) : (
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      Este bloque todavia no segmenta entrenamiento para gatos. Aca solo aplican guardrails de
                      entorno y bienestar.
                    </p>
                  )}
                </div>

                {TRAINING_MASTER_BOOK.command_library.map((command) => (
                  <div key={command.id} className="rounded-[24px] border border-slate-200 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{command.label}</p>
                        <p className="mt-1 text-sm text-slate-500">{command.goal}</p>
                      </div>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">
                        {command.guardrailType}
                      </span>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-slate-600">{command.instruction}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-[28px] bg-white p-5 shadow-[0_20px_60px_rgba(15,23,42,0.06)] sm:p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Food safety</p>
              <h2 className="mt-2 text-2xl font-semibold text-[#0b3c31]">Reglas de casa</h2>
              <div className="mt-5 space-y-3">
                {householdFoodRules.map((rule) => (
                  <div key={rule.id} className="flex items-start gap-3 rounded-[22px] border border-slate-200 bg-slate-50 p-4">
                    <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${ACTION_STYLES[rule.guardrailType === "block" ? "block" : "alert"].iconWrap}`}>
                      <MaterialIcon name={rule.id === "chocolate" ? "cookie" : "warning"} className="text-lg" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{rule.label}</p>
                      <p className="mt-1 text-sm leading-6 text-slate-600">
                        {rule.danger}. {rule.action}.
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-[28px] bg-white p-5 shadow-[0_20px_60px_rgba(15,23,42,0.06)] sm:p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Payload estructurado</p>
              <h2 className="mt-2 text-2xl font-semibold text-[#0b3c31]">Lo que el motor realmente ve</h2>
              <pre className="mt-5 overflow-x-auto rounded-[24px] bg-slate-950 p-4 text-xs leading-6 text-slate-200">
                {payload}
              </pre>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
