import { MaterialIcon } from "../shared/MaterialIcon";
import { PetPhoto } from "../pet/PetPhoto";
import { Timeline } from "../medical/Timeline";
import { MonthSummary } from "../medical/MonthSummary";
import { ActionTray } from "../medical/ActionTray";
import { ClinicalProfileBlock } from "../medical/ClinicalProfileBlock";
import { useMedical } from "../../contexts/MedicalContext";
import { formatDateSafe, toTimestampSafe } from "../../utils/dateUtils";
import { isFocusHistoryExperimentHost } from "../../utils/runtimeFlags";

interface FocusedHomeExperienceProps {
  userName: string;
  activePetId: string;
  activePet: {
    name: string;
    photo: string;
    breed: string;
    species?: string;
    age?: string;
    weight?: string;
  };
  onPetClick: () => void;
  onOpenFeed: () => void;
  onOpenAppointments: () => void;
  onOpenMedications: () => void;
  onOpenScanner: () => void;
  onExportReport: () => void;
}

const getVaccineStatus = (
  vaccineEvents: Array<{ extractedData: { nextAppointmentDate?: string | null; eventDate?: string | null }; createdAt: string }>
) => {
  if (vaccineEvents.length === 0) {
    return { label: "Sin registro", tone: "text-slate-500" };
  }

  const now = Date.now();
  let hasOverdue = false;
  let hasSoon = false;

  vaccineEvents.forEach((event) => {
    if (!event.extractedData.nextAppointmentDate) return;
    const diffDays = (toTimestampSafe(event.extractedData.nextAppointmentDate, now) - now) / 86400000;
    if (diffDays < 0) hasOverdue = true;
    else if (diffDays <= 30) hasSoon = true;
  });

  if (hasOverdue) return { label: "Vencida", tone: "text-red-600" };
  if (hasSoon) return { label: "Próxima", tone: "text-amber-600" };

  return {
    label: formatDateSafe(
      vaccineEvents[0].extractedData.eventDate || vaccineEvents[0].createdAt,
      "es-AR",
      { day: "numeric", month: "short", year: "numeric" },
      "Al día"
    ),
    tone: "text-emerald-600",
  };
};

export function FocusedHomeExperience({
  userName,
  activePetId,
  activePet,
  onPetClick,
  onOpenFeed,
  onOpenAppointments,
  onOpenMedications,
  onOpenScanner,
  onExportReport,
}: FocusedHomeExperienceProps) {
  const {
    getEventsByPetId,
    getPendingActionsByPetId,
    getActiveMedicationsByPetId,
    getAppointmentsByPetId,
    getProfileSnapshotByPetId,
  } = useMedical();

  const profileSnapshot = isFocusHistoryExperimentHost() ? getProfileSnapshotByPetId(activePetId) : null;

  const safeUserName = (userName || "").trim() || "Tutor";
  const events = getEventsByPetId(activePetId);
  const pendingActions = getPendingActionsByPetId(activePetId);
  const activeMedications = getActiveMedicationsByPetId(activePetId);
  const appointments = getAppointmentsByPetId(activePetId);

  const sortedEvents = [...events].sort(
    (a, b) =>
      toTimestampSafe(b.extractedData?.eventDate || b.createdAt) -
      toTimestampSafe(a.extractedData?.eventDate || a.createdAt)
  );

  const latestEvent = sortedEvents[0] || null;
  const vaccineEvents = sortedEvents.filter(
    (event) => event.status === "completed" && event.extractedData?.documentType === "vaccine"
  );
  const vaccineStatus = getVaccineStatus(vaccineEvents);

  const now = Date.now();
  const upcomingAppointments = appointments.filter((appointment) => {
    const timeValue = appointment.date || appointment.dateTime || appointment.createdAt || "";
    return toTimestampSafe(timeValue, 0) >= now;
  });
  const nextAppointment = [...upcomingAppointments].sort(
    (a, b) =>
      toTimestampSafe(a.dateTime || `${a.date}T${a.time || "00:00"}:00`, now) -
      toTimestampSafe(b.dateTime || `${b.date}T${b.time || "00:00"}:00`, now)
  )[0] || null;
  const activeHeaderChips = [
    activePet.species || "Mascota",
    activePet.breed || null,
    activePet.age || null,
  ].filter(Boolean) as string[];
  const heroStats = [
    {
      icon: "event",
      label: "Turnos",
      value: String(upcomingAppointments.length),
    },
    {
      icon: "medication",
      label: "Seguimientos",
      value: String(activeMedications.length),
    },
    {
      icon: "fact_check",
      label: "Pendientes",
      value: String(pendingActions.length),
    },
  ];

  const profileCards = [
    {
      icon: "monitor_weight",
      label: "Peso",
      value: activePet.weight ? `${activePet.weight} kg` : "Sin dato",
      tone: "text-slate-900 dark:text-white",
    },
    {
      icon: "vaccines",
      label: "Vacunas",
      value: vaccineStatus.label,
      tone: vaccineStatus.tone,
    },
    {
      icon: "medication",
      label: "Seguimientos",
      value: String(activeMedications.length),
      tone: "text-slate-900 dark:text-white",
    },
    {
      icon: "checklist",
      label: "Pendientes",
      value: String(pendingActions.length),
      tone: pendingActions.length > 0 ? "text-amber-600" : "text-emerald-600",
    },
  ];

  return (
    <>
      <div className="px-4 pt-6 pb-6 bg-[linear-gradient(180deg,rgba(7,71,56,0.16)_0%,rgba(7,71,56,0.07)_46%,rgba(246,246,248,0)_100%)] dark:bg-[linear-gradient(180deg,rgba(7,71,56,0.34)_0%,rgba(16,22,34,0)_100%)]">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#074738]">Perfil vivo</p>
            <h1 className="text-[28px] leading-[32px] font-black text-slate-900 dark:text-white mt-2">
              Así se ve hoy {activePet.name}.
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
              Hola, {safeUserName}. PESSY convierte la historia de tu mascota en agenda, recordatorios y proximos pasos.
            </p>
          </div>
        </div>

        <button
          onClick={onPetClick}
          className="w-full rounded-[32px] border border-[#074738]/10 dark:border-[#1a9b7d]/20 bg-[#E0F2F1] dark:bg-[#17382f] p-4 text-left shadow-[0_20px_50px_rgba(7,71,56,0.16)]"
        >
          <div className="flex items-start gap-4">
            <div className="size-24 rounded-full overflow-hidden bg-white/80 dark:bg-slate-900/50 shrink-0 ring-4 ring-white/70 dark:ring-white/10">
              <PetPhoto
                src={activePet.photo}
                alt={activePet.name}
                className="size-full object-cover"
                fallbackClassName="rounded-full"
              />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-col gap-2">
                <div className="inline-flex w-fit items-center gap-2 rounded-full bg-[#1A9B7D] px-3 py-1.5 text-white">
                  <MaterialIcon name="check_circle" className="text-sm" />
                  <span className="text-[11px] font-black uppercase tracking-[0.14em]">
                    Perfil activo
                  </span>
                </div>
                <div className="rounded-[18px] bg-[#1A9B7D] px-4 py-3 text-white">
                  <p className="text-[11px] font-black uppercase tracking-[0.14em] text-white/70">Hoy</p>
                  <p className="text-sm font-semibold leading-5 mt-1">
                    {nextAppointment
                      ? `Próximo turno ${formatDateSafe(nextAppointment.date, "es-AR", { day: "numeric", month: "short" }, "sin fecha")}${nextAppointment.time ? ` · ${nextAppointment.time}` : ""}`
                      : "Sin turnos próximos cargados"}
                  </p>
                </div>
              </div>
            </div>
            <div className="size-11 shrink-0 rounded-full bg-white/80 dark:bg-slate-900/50 flex items-center justify-center">
              <MaterialIcon name="chevron_right" className="text-[#074738] text-2xl" />
            </div>
          </div>
          <div className="mt-3 rounded-[18px] bg-white px-4 py-3 dark:bg-slate-900">
            <p className="text-[19px] leading-[22px] font-black text-[#074738] dark:text-white text-center">
              {activePet.name}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 text-center mt-1">
              {[activePet.species, activePet.breed, activePet.age].filter(Boolean).join(" · ") || "Mascota registrada"}
            </p>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {heroStats.map((stat) => (
              <div key={stat.label} className="rounded-[18px] bg-white/80 dark:bg-slate-950/25 px-3 py-2">
                <div className="flex items-center gap-1.5">
                  <MaterialIcon name={stat.icon} className="text-[#074738] text-sm" />
                  <span className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500 dark:text-slate-300">
                    {stat.label}
                  </span>
                </div>
                <p className="text-lg font-black text-slate-900 dark:text-white mt-1">{stat.value}</p>
              </div>
            ))}
          </div>
          {activeHeaderChips.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {activeHeaderChips.map((chip) => (
                <span
                  key={chip}
                  className="rounded-full border border-white/55 bg-white/65 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-[#074738]"
                >
                  {chip}
                </span>
              ))}
            </div>
          )}
        </button>

        <div className="mt-4 rounded-[16px] border border-slate-200/70 dark:border-slate-800 bg-white/92 dark:bg-slate-900 p-5 shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">Último movimiento</p>
              <h2 className="text-lg font-black text-slate-900 dark:text-white mt-1">
                {latestEvent?.title || "Todavía no hay actividad cargada"}
              </h2>
            </div>
            <button
              onClick={onOpenScanner}
              className="shrink-0 rounded-[14px] bg-[#1A9B7D] px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-white"
            >
              Agregar
            </button>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-3 leading-6">
            {latestEvent
              ? (latestEvent.extractedData?.diagnosis ||
                latestEvent.extractedData?.suggestedTitle ||
                latestEvent.extractedData?.observations ||
                latestEvent.extractedData?.aiGeneratedSummary ||
                "Evento registrado en el historial.")
              : "Subí un documento o conectá tus correos para empezar a construir el perfil vivo de tu mascota."}
          </p>
          {latestEvent && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-[#E0F2F1] px-3 py-1 text-[11px] font-semibold text-[#074738]">
                {formatDateSafe(
                  latestEvent.extractedData?.eventDate || latestEvent.createdAt,
                  "es-AR",
                  { day: "numeric", month: "long", year: "numeric" },
                  "Fecha no disponible"
                )}
              </span>
              {latestEvent.extractedData?.documentType && (
                <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-3 py-1 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                  {latestEvent.extractedData.documentType}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      <main className="flex-1 px-4 space-y-6 pb-6">
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-black text-slate-900 dark:text-white">Estado actual</h2>
            <button onClick={onOpenFeed} className="text-xs font-black uppercase tracking-[0.14em] text-[#074738]">
              Ver historia
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {profileCards.map((card) => (
              <div
                key={card.label}
                className="rounded-[16px] border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-[0_2px_12px_rgba(0,0,0,0.06)]"
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="size-9 rounded-[12px] bg-[#E0F2F1] flex items-center justify-center">
                    <MaterialIcon name={card.icon} className="text-[#074738] text-base" />
                  </div>
                  <span className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">{card.label}</span>
                </div>
                <p className={`text-lg font-black ${card.tone}`}>{card.value}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-black text-slate-900 dark:text-white">Qué hacer ahora</h2>
          <div className="rounded-[28px] border border-[#074738]/10 dark:border-[#1a9b7d]/20 bg-[#E0F2F1] dark:bg-[#17382f] p-4">
            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={onOpenAppointments}
                className="rounded-[16px] border border-white/70 dark:border-white/10 bg-white dark:bg-slate-900 p-4 text-left shadow-[0_2px_12px_rgba(0,0,0,0.06)]"
              >
                <MaterialIcon name="event" className="text-[#074738] text-xl mb-3" />
                <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">Turnos</p>
                <p className="text-lg font-black text-slate-900 dark:text-white mt-1">{upcomingAppointments.length}</p>
              </button>
              <button
                onClick={onOpenMedications}
                className="rounded-[16px] border border-white/70 dark:border-white/10 bg-white dark:bg-slate-900 p-4 text-left shadow-[0_2px_12px_rgba(0,0,0,0.06)]"
              >
                <MaterialIcon name="medication" className="text-[#074738] text-xl mb-3" />
                <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">Seguimientos</p>
                <p className="text-lg font-black text-slate-900 dark:text-white mt-1">{activeMedications.length}</p>
              </button>
              <button
                onClick={onOpenFeed}
                className="rounded-[16px] border border-white/70 dark:border-white/10 bg-white dark:bg-slate-900 p-4 text-left shadow-[0_2px_12px_rgba(0,0,0,0.06)]"
              >
                <MaterialIcon name="history" className="text-[#074738] text-xl mb-3" />
                <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">Historia</p>
                <p className="text-lg font-black text-slate-900 dark:text-white mt-1">{events.length}</p>
              </button>
            </div>
            {nextAppointment && (
              <div className="mt-4 rounded-[16px] bg-white dark:bg-slate-900 px-4 py-3 shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
                <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">Próximo turno</p>
                <div className="mt-1 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-black text-slate-900 dark:text-white truncate">
                      {nextAppointment.title}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {formatDateSafe(nextAppointment.date, "es-AR", { weekday: "short", day: "numeric", month: "short" }, "sin fecha")}
                      {nextAppointment.time ? ` · ${nextAppointment.time}` : ""}
                    </p>
                  </div>
                  <button
                    onClick={onOpenAppointments}
                    className="rounded-[14px] bg-[#1A9B7D] px-4 py-2 text-[11px] font-black uppercase tracking-[0.14em] text-white"
                  >
                    Ver
                  </button>
                </div>
              </div>
            )}
          </div>
          <ActionTray />
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-black text-slate-900 dark:text-white">Historia y actividad</h2>
            <button onClick={onExportReport} className="text-xs font-black uppercase tracking-[0.14em] text-[#074738]">
              Exportar
            </button>
          </div>
          <MonthSummary />
          {profileSnapshot && (
            <ClinicalProfileBlock snapshot={profileSnapshot} petName={activePet.name} />
          )}
          <Timeline
            activePet={{
              name: activePet.name,
              photo: activePet.photo,
            }}
            onExportReport={onExportReport}
          />
        </section>
      </main>
    </>
  );
}
