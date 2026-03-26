import { useMemo, useState } from "react";
import { MaterialIcon } from "./MaterialIcon";
import {
  WELLBEING_PROTOCOL_VERSION,
  type WellbeingProtocolInput,
  type WellbeingRoutineKind,
} from "../../domain/wellbeing/wellbeingProtocol.contract";
import { evaluateWellbeingProtocolEligibility } from "../../domain/wellbeing/wellbeingProtocol.guards";

type PreviewFeedback = "bien" | "cansado" | "apatico";

interface PreviewTask {
  id: string;
  kind: WellbeingRoutineKind;
  title: string;
  detail: string;
  scheduledAt: string;
  blocked?: boolean;
  blockedReason?: string;
}

interface WalkWindowRecommendation {
  avoidWindow: string;
  primaryWindow: string;
  secondaryWindow: string;
}

const PREVIEW_INPUT: Omit<WellbeingProtocolInput, "eligibility"> = {
  version: WELLBEING_PROTOCOL_VERSION,
  generatedAt: "2026-03-19T09:00:00.000Z",
  profile: {
    petId: "thor",
    name: "Thor",
    species: "dog",
    breed: "Pug",
    ageLabel: "8 años",
    ageYearsApprox: 8,
    weightKg: 9.4,
    weightRaw: "9.4 kg",
    sex: "male",
    isNeutered: true,
    energyLevel: "medium",
  },
  environment: {
    capturedAt: "2026-03-19T08:40:00.000Z",
    timezone: "America/Argentina/Buenos_Aires",
    localDateKey: "2026-03-19",
    localHour24: 14,
    temperatureC: 31,
    humidityPct: 74,
    source: "weather_api",
  },
  riskFlags: {
    isSenior: false,
    isBrachycephalic: true,
    hasOsteoarthritis: false,
    hasCardiacCondition: true,
    hasPostMedicationRestFlag: true,
  },
  conditions: [
    {
      conditionId: "heart_murmur",
      normalizedName: "heart_murmur",
      organSystem: "sistema_cardiovascular",
      status: "active",
      pattern: "chronic",
      firstDetectedDate: "2025-08-14",
      lastDetectedDate: "2026-03-17",
      evidenceEventIds: ["evt_cardio_001"],
      affectsRoutineKinds: ["activity"],
      sourceMeta: {
        sourceCollection: "clinical_conditions",
        sourceId: "cond_heart_murmur",
        sourceEventId: "evt_cardio_001",
        sourceDocumentId: "doc_cardio_001",
        sourceTruthLevel: "human_confirmed",
        validationStatus: "complete",
        requiresManualConfirmation: false,
        protocolSnapshotFrozenAt: "2026-03-17T11:05:00.000Z",
        confidence01: 0.98,
      },
    },
  ],
  alerts: [
    {
      alertId: "alert_thermal_001",
      type: "out_of_range",
      severity: "high",
      status: "active",
      title: "Riesgo térmico por calor",
      linkedConditionIds: ["cond_heart_murmur"],
      linkedEventIds: ["evt_cardio_001"],
      linkedAppointmentIds: [],
      blocksRoutineKinds: ["activity"],
      sourceMeta: {
        sourceCollection: "clinical_alerts",
        sourceId: "alert_thermal_001",
        sourceEventId: "evt_cardio_001",
        sourceDocumentId: "doc_cardio_001",
        sourceTruthLevel: "user_curated",
        validationStatus: "complete",
        requiresManualConfirmation: false,
        protocolSnapshotFrozenAt: "2026-03-19T08:45:00.000Z",
        confidence01: 0.96,
      },
    },
  ],
  medications: [
    {
      treatmentId: "tx_meloxicam_001",
      normalizedName: "meloxicam",
      subtype: "medication",
      status: "active",
      dosage: "0.5 comprimido",
      frequency: "Cada 24 horas",
      startDate: "2026-03-18",
      endDate: "2026-03-24",
      linkedConditionIds: ["cond_heart_murmur"],
      affectsRoutineKinds: ["assistance", "activity"],
      sourceMeta: {
        sourceCollection: "treatments",
        sourceId: "tx_meloxicam_001",
        sourceEventId: "evt_cardio_001",
        sourceDocumentId: "doc_cardio_001",
        sourceTruthLevel: "ai_auto_ingested",
        validationStatus: "auto_ingested_unconfirmed",
        requiresManualConfirmation: false,
        protocolSnapshotFrozenAt: "2026-03-18T19:10:00.000Z",
        confidence01: 0.92,
      },
    },
  ],
  appointments: [
    {
      appointmentId: "appt_echo_001",
      type: "checkup",
      status: "upcoming",
      date: "2026-03-22",
      time: "09:30",
      title: "Control cardiológico",
      clinic: "CardioVet Palermo",
      veterinarian: "Dra. Rinaldi",
      affectsRoutineKinds: ["activity", "attention"],
      sourceMeta: {
        sourceCollection: "appointments",
        sourceId: "appt_echo_001",
        sourceEventId: "evt_cardio_001",
        sourceDocumentId: "doc_cardio_001",
        sourceTruthLevel: "human_confirmed",
        validationStatus: "complete",
        requiresManualConfirmation: false,
        protocolSnapshotFrozenAt: "2026-03-18T19:10:00.000Z",
        confidence01: 0.99,
      },
    },
  ],
};

const TASK_KIND_META: Record<WellbeingRoutineKind, { label: string; icon: string; tone: string }> = {
  activity: {
    label: "Actividad",
    icon: "directions_walk",
    tone: "bg-rose-50 text-rose-700 border-rose-100",
  },
  assistance: {
    label: "Asistencia",
    icon: "health_and_safety",
    tone: "bg-emerald-50 text-emerald-700 border-emerald-100",
  },
  attention: {
    label: "Atención",
    icon: "pets",
    tone: "bg-sky-50 text-sky-700 border-sky-100",
  },
};

const FEEDBACK_OPTIONS: Array<{ value: PreviewFeedback; label: string }> = [
  { value: "bien", label: "Bien" },
  { value: "cansado", label: "Cansado" },
  { value: "apatico", label: "Apático" },
];

function getWalkWindowRecommendation(input: typeof PREVIEW_INPUT): WalkWindowRecommendation {
  const isBrachy = input.riskFlags.isBrachycephalic;
  const temperature = input.environment.temperatureC ?? 0;
  const humidity = input.environment.humidityPct ?? 0;

  if (isBrachy && (temperature > 27 || humidity >= 70)) {
    return {
      avoidWindow: "12:00 a 18:30",
      primaryWindow: "19:30 a 20:15",
      secondaryWindow: "07:00 a 07:45",
    };
  }

  return {
    avoidWindow: "13:00 a 17:30",
    primaryWindow: "18:30 a 19:15",
    secondaryWindow: "08:00 a 08:45",
  };
}

function getActivityHeadline(input: typeof PREVIEW_INPUT, walkWindow: WalkWindowRecommendation) {
  const name = input.profile.name;
  const temperature = input.environment.temperatureC;
  const isBrachy = input.riskFlags.isBrachycephalic;
  const hasCardiacSignal = input.riskFlags.hasCardiacCondition;

  if (isBrachy && hasCardiacSignal) {
    return {
      eyebrow: "Alerta de calor",
      title: `Hoy hace calor. No saques a ${name} en este horario.`,
      body: `${name} tiene perfil braquicéfalo y señal cardiovascular activa. Evitá paseos entre ${walkWindow.avoidWindow}.`,
      recommendation: `Horario recomendado: ${walkWindow.primaryWindow}. Si preferís salir temprano, una segunda ventana segura es ${walkWindow.secondaryWindow}.`,
      badge: `${temperature}°C hoy`,
    };
  }

  return {
    eyebrow: "Alerta preventiva",
    title: `Hoy conviene bajar intensidad con ${name}.`,
    body: `La temperatura actual puede aumentar el riesgo de fatiga y estrés térmico.`,
    recommendation: `Horario recomendado: ${walkWindow.primaryWindow}.`,
    badge: `${temperature}°C hoy`,
  };
}

export function WellbeingProtocolPreviewScreen() {
  const [completedTaskIds, setCompletedTaskIds] = useState<string[]>(["task_hydration"]);
  const [feedbackByTaskId, setFeedbackByTaskId] = useState<Record<string, PreviewFeedback>>({
    task_hydration: "bien",
  });

  const eligibility = useMemo(
    () =>
      evaluateWellbeingProtocolEligibility({
        profile: PREVIEW_INPUT.profile,
        environment: PREVIEW_INPUT.environment,
        riskFlags: PREVIEW_INPUT.riskFlags,
        conditions: PREVIEW_INPUT.conditions,
        alerts: PREVIEW_INPUT.alerts,
        medications: PREVIEW_INPUT.medications,
      }),
    []
  );

  const walkWindow = useMemo(() => getWalkWindowRecommendation(PREVIEW_INPUT), []);
  const activityHeadline = useMemo(
    () => getActivityHeadline(PREVIEW_INPUT, walkWindow),
    [walkWindow]
  );

  const previewTasks = useMemo<PreviewTask[]>(
    () => [
      {
        id: "task_walk",
        kind: "activity",
        title: "Salida reprogramada",
        detail: `Hoy no conviene sacar a ${PREVIEW_INPUT.profile.name} entre ${walkWindow.avoidWindow}. Próxima ventana recomendada: ${walkWindow.primaryWindow}.`,
        scheduledAt: walkWindow.primaryWindow,
        blocked: true,
        blockedReason: `Si ves jadeo más intenso, apatía o calor corporal alto, priorizá hidratación, sombra y descanso. Alternativa temprana: ${walkWindow.secondaryWindow}.`,
      },
      {
        id: "task_hydration",
        kind: "assistance",
        title: "Hidratación reforzada",
        detail: "Ofrecer agua fresca y una pausa en sombra durante la tarde.",
        scheduledAt: "14:30",
      },
      {
        id: "task_medication",
        kind: "assistance",
        title: "Meloxicam",
        detail: "0.5 comprimido con comida. Observá si aparece somnolencia o apatía.",
        scheduledAt: "20:00",
      },
      {
        id: "task_sniff",
        kind: "attention",
        title: "Juego de olfato indoor",
        detail: "10 minutos de búsqueda tranquila en casa para bajar ansiedad sin esfuerzo físico.",
        scheduledAt: "18:00",
      },
    ],
    [walkWindow]
  );

  const completedCount = completedTaskIds.length;
  const adherenceScore = Math.round((completedCount / previewTasks.filter((task) => !task.blocked).length) * 100);

  const toggleTask = (taskId: string) => {
    setCompletedTaskIds((current) =>
      current.includes(taskId) ? current.filter((id) => id !== taskId) : [...current, taskId]
    );
  };

  const timelineEntries = previewTasks.filter((task) => completedTaskIds.includes(task.id)).map((task) => ({
    id: `timeline_${task.id}`,
    title: task.title,
    caption: feedbackByTaskId[task.id] === "cansado"
      ? "Completado con feedback: cansado"
      : feedbackByTaskId[task.id] === "apatico"
        ? "Completado con feedback: apático"
        : "Completado con feedback: bien",
    time: task.scheduledAt,
  }));

  return (
    <div className="min-h-screen bg-[#f5f7f8] text-slate-900">
      <div className="mx-auto flex min-h-screen max-w-md flex-col px-4 pb-10 pt-6">
        <div className="rounded-[28px] bg-gradient-to-br from-[#074738] via-[#0c5e4b] to-[#159a79] p-5 text-white shadow-[0_24px_60px_rgba(7,71,56,0.28)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/70">
                Preview real en app
              </p>
              <h1 className="mt-2 text-[28px] font-semibold leading-8">Plan del Día</h1>
              <p className="mt-2 text-sm text-white/80">
                {PREVIEW_INPUT.profile.name} · {PREVIEW_INPUT.profile.breed} · {activityHeadline.badge}
              </p>
            </div>
            <div className="rounded-2xl bg-white/14 px-3 py-2 text-right backdrop-blur">
              <p className="text-[11px] uppercase tracking-[0.2em] text-white/60">Hoy</p>
              <p className="text-2xl font-semibold">{adherenceScore} de 100</p>
            </div>
          </div>

          <div className="mt-5 rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 rounded-full bg-amber-300/20 p-2 text-amber-100">
                <MaterialIcon name="warning" className="text-lg" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/65">
                  {activityHeadline.eyebrow}
                </p>
                <p className="mt-1 text-sm font-semibold">{activityHeadline.title}</p>
                <p className="mt-1 text-sm leading-5 text-white/80">
                  {activityHeadline.body}
                </p>
                <p className="mt-3 text-sm font-medium text-amber-100">{activityHeadline.recommendation}</p>
              </div>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-3">
            {(["activity", "assistance", "attention"] as WellbeingRoutineKind[]).map((kind) => {
              const status = eligibility.byRoutineKind[kind].status;
              return (
                <div key={kind} className="rounded-2xl bg-white/10 p-3 backdrop-blur">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-white/60">
                    {TASK_KIND_META[kind].label}
                  </p>
                  <p className="mt-2 text-sm font-semibold">
                    {status === "blocked" ? "Con alerta" : status === "needs_review" ? "A revisar" : "Activa"}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        <section className="mt-5 rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Vista home</p>
              <h2 className="mt-1 text-xl font-semibold text-slate-900">Rutinas sugeridas</h2>
            </div>
            <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
              Thor
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {previewTasks.map((task) => {
              const kindMeta = TASK_KIND_META[task.kind];
              const isDone = completedTaskIds.includes(task.id);
              return (
                <div
                  key={task.id}
                  className={`rounded-2xl border p-4 transition ${
                    task.blocked
                      ? "border-rose-200 bg-rose-50"
                      : isDone
                        ? "border-emerald-200 bg-emerald-50"
                        : "border-slate-200 bg-white"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-medium ${kindMeta.tone}`}>
                        <MaterialIcon name={kindMeta.icon} className="text-sm" />
                        {kindMeta.label}
                      </div>
                      <h3 className="mt-3 text-base font-semibold text-slate-900">{task.title}</h3>
                      <p className="mt-1 text-sm leading-5 text-slate-600">{task.detail}</p>
                      <p className="mt-3 text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
                        {task.scheduledAt}
                      </p>
                    </div>
                    {task.blocked ? (
                      <div className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-amber-700">
                        Reprogramar
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => toggleTask(task.id)}
                        className={`rounded-full px-3 py-2 text-xs font-semibold transition ${
                          isDone
                            ? "bg-emerald-600 text-white"
                            : "bg-slate-900 text-white hover:bg-slate-800"
                        }`}
                      >
                        {isDone ? "Hecho" : "Marcar"}
                      </button>
                    )}
                  </div>

                  {task.blocked && task.blockedReason ? (
                    <div className="mt-3 rounded-xl bg-white/80 p-3 text-sm text-rose-700">
                      {task.blockedReason}
                    </div>
                  ) : null}

                  {isDone ? (
                    <div className="mt-4 rounded-xl bg-white/80 p-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                        Feedback instantáneo
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {FEEDBACK_OPTIONS.map((option) => {
                          const selected = feedbackByTaskId[task.id] === option.value;
                          return (
                            <button
                              key={option.value}
                              type="button"
                              onClick={() =>
                                setFeedbackByTaskId((current) => ({
                                  ...current,
                                  [task.id]: option.value,
                                }))
                              }
                              className={`rounded-full px-3 py-2 text-sm font-medium transition ${
                                selected
                                  ? "bg-[#074738] text-white"
                                  : "bg-slate-100 text-slate-700"
                              }`}
                            >
                              {option.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>

        <section className="mt-5 rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Vista timeline</p>
          <h2 className="mt-1 text-xl font-semibold text-slate-900">Alertas y decisiones del día</h2>
          <div className="mt-4 space-y-3">
            {timelineEntries.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-5 text-sm text-slate-500">
                Todavía no hay tareas completadas en esta preview.
              </div>
            ) : (
              timelineEntries.map((entry) => (
                <div key={entry.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="inline-flex items-center gap-2 rounded-full bg-[#074738]/10 px-2.5 py-1 text-xs font-semibold text-[#074738]">
                        [Protocolo]
                      </div>
                      <p className="mt-3 text-base font-semibold text-slate-900">{entry.title}</p>
                      <p className="mt-1 text-sm text-slate-600">{entry.caption}</p>
                    </div>
                    <div className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
                      {entry.time}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="mt-5 rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Lineage clínico</p>
          <h2 className="mt-1 text-xl font-semibold text-slate-900">Señales que usó Pessy</h2>
          <div className="mt-4 space-y-3">
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-900">Alerta activa</p>
              <p className="mt-1 text-sm text-slate-600">
                {PREVIEW_INPUT.alerts[0].title} · severidad {PREVIEW_INPUT.alerts[0].severity}
              </p>
              <p className="mt-2 text-xs text-slate-500">
                {PREVIEW_INPUT.alerts[0].sourceMeta.sourceCollection} / {PREVIEW_INPUT.alerts[0].sourceMeta.sourceId}
              </p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-900">Condición asociada</p>
              <p className="mt-1 text-sm text-slate-600">
                {PREVIEW_INPUT.conditions[0].normalizedName} · {PREVIEW_INPUT.conditions[0].sourceMeta.sourceTruthLevel}
              </p>
              <p className="mt-2 text-xs text-slate-500">
                snapshot: {PREVIEW_INPUT.conditions[0].sourceMeta.protocolSnapshotFrozenAt}
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
