import { AnimatePresence, motion } from "motion/react";
import { MaterialIcon } from "../shared/MaterialIcon";
import { useMemo } from "react";
import { usePet } from "../contexts/PetContext";
import { useMedical } from "../contexts/MedicalContext";
import { cleanText } from "../utils/cleanText";
import { formatDateSafe, toTimestampSafe } from "../utils/dateUtils";
import { PetPhoto } from "../pet/PetPhoto";

interface HealthReportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type TimelineRow = {
  id: string;
  dateIso: string;
  title: string;
  subtitle: string;
  typeLabel: string;
  documentUrl?: string;
};

const typeLabelMap: Record<string, string> = {
  vaccine: "Vacuna",
  appointment: "Turno",
  lab_test: "Laboratorio",
  xray: "Radiografia",
  echocardiogram: "Ecocardiograma",
  electrocardiogram: "Electrocardiograma",
  surgery: "Cirugia",
  medication: "Medicacion",
  checkup: "Control",
  other: "Documento",
};

const formatDate = (iso?: string | null) => {
  return formatDateSafe(iso, "es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }, "Sin fecha");
};

const buildTimelineSubtitle = (event: any) => {
  const diagnosis = cleanText(event.extractedData?.diagnosis || "");
  const observations = cleanText(event.extractedData?.observations || "");
  const aiSummary = cleanText(event.extractedData?.aiGeneratedSummary || "");
  if (diagnosis) return diagnosis;
  if (observations) return observations;
  if (aiSummary) return `Resumen IA pendiente de validación: ${aiSummary}`;
  return "Sin observaciones cargadas";
};

export function HealthReportModal({ isOpen, onClose }: HealthReportModalProps) {
  const { activePet } = usePet();
  const { getEventsByPetId, getActiveMedicationsByPetId, getPendingActionsByPetId } = useMedical();

  const reportData = useMemo(() => {
    if (!activePet) return null;

    const events = getEventsByPetId(activePet.id);
    const activeMedications = getActiveMedicationsByPetId(activePet.id);
    const pendingActions = getPendingActionsByPetId(activePet.id);

    const vaccines = events.filter((event) => event.extractedData.documentType === "vaccine");
    const weightHistory = [...((activePet as any)?.weightHistory || [])]
      .sort((a: any, b: any) => toTimestampSafe(b.date) - toTimestampSafe(a.date))
      .slice(0, 8);

    const timeline: TimelineRow[] = events.slice(0, 12).map((event) => {
      const dateIso = event.extractedData.eventDate || event.createdAt;
      return {
        id: event.id,
        dateIso,
        title: event.title,
        subtitle: buildTimelineSubtitle(event),
        typeLabel: typeLabelMap[event.extractedData.documentType] || "Documento",
        documentUrl: event.documentUrl,
      };
    });

    return {
      events,
      vaccines,
      activeMedications,
      pendingActions,
      weightHistory,
      timeline,
    };
  }, [activePet, getActiveMedicationsByPetId, getEventsByPetId, getPendingActionsByPetId]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 z-[100]"
          />

          <motion.div
            initial={{ opacity: 0, y: "100%" }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed inset-0 z-[101] bg-[#f6f6f8] dark:bg-[#101622] overflow-y-auto"
          >
            <div className="sticky top-0 z-20 bg-white/95 dark:bg-slate-900/95 border-b border-slate-200 dark:border-slate-800 px-4 py-4">
              <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <button
                    onClick={onClose}
                    className="size-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center"
                  >
                    <MaterialIcon name="arrow_back" className="text-xl" />
                  </button>
                  <div>
                    <h2 className="text-xl font-black text-slate-900 dark:text-white">Reporte de Salud</h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Actualizado: {formatDate(new Date().toISOString())}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <main className="max-w-4xl mx-auto p-4 md:p-6 space-y-4 pb-24">
              {!activePet || !reportData ? (
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 text-center">
                  <h3 className="text-lg font-black text-slate-900 dark:text-white mb-2">Sin mascota activa</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Selecciona una mascota para ver el reporte.</p>
                </div>
              ) : (
                <>
                  <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 md:p-5">
                    <div className="flex items-center gap-3 mb-4">
                      <PetPhoto
                        src={activePet.photo}
                        alt={activePet.name}
                        className="size-16 rounded-2xl object-cover border border-slate-200 dark:border-slate-800"
                        fallbackClassName="rounded-2xl"
                      />
                      <div>
                        <h3 className="text-2xl font-black text-slate-900 dark:text-white leading-none">{activePet.name}</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                          {activePet.breed || "Raza no registrada"}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      <div className="rounded-xl bg-slate-50 dark:bg-slate-800 p-3">
                        <p className="text-[11px] uppercase tracking-wide text-slate-500">Eventos</p>
                        <p className="text-lg font-black text-slate-900 dark:text-white">{reportData.events.length}</p>
                      </div>
                      <div className="rounded-xl bg-slate-50 dark:bg-slate-800 p-3">
                        <p className="text-[11px] uppercase tracking-wide text-slate-500">Vacunas</p>
                        <p className="text-lg font-black text-slate-900 dark:text-white">{reportData.vaccines.length}</p>
                      </div>
                      <div className="rounded-xl bg-slate-50 dark:bg-slate-800 p-3">
                        <p className="text-[11px] uppercase tracking-wide text-slate-500">Pendientes</p>
                        <p className="text-lg font-black text-slate-900 dark:text-white">{reportData.pendingActions.length}</p>
                      </div>
                      <div className="rounded-xl bg-slate-50 dark:bg-slate-800 p-3">
                        <p className="text-[11px] uppercase tracking-wide text-slate-500">Tratamientos</p>
                        <p className="text-lg font-black text-slate-900 dark:text-white">{reportData.activeMedications.length}</p>
                      </div>
                    </div>
                  </section>

                  <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 md:p-5">
                    <h4 className="text-sm font-black uppercase tracking-wide text-slate-500 mb-3">Historial de peso</h4>
                    {reportData.weightHistory.length === 0 ? (
                      <p className="text-sm text-slate-500 dark:text-slate-400">Sin registros de peso.</p>
                    ) : (
                      <div className="space-y-2">
                        {reportData.weightHistory.map((entry: any) => (
                          <div
                            key={entry.date}
                            className="flex items-center justify-between rounded-xl bg-slate-50 dark:bg-slate-800 px-3 py-2"
                          >
                            <span className="text-sm text-slate-600 dark:text-slate-300">{formatDate(entry.date)}</span>
                            <span className="text-sm font-black text-slate-900 dark:text-white">{entry.weight} kg</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>

                  <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 md:p-5">
                    <h4 className="text-sm font-black uppercase tracking-wide text-slate-500 mb-3">Vacunas registradas</h4>
                    {reportData.vaccines.length === 0 ? (
                      <p className="text-sm text-slate-500 dark:text-slate-400">Sin vacunas registradas.</p>
                    ) : (
                      <div className="space-y-2">
                        {reportData.vaccines.slice(0, 8).map((event) => (
                          <div key={event.id} className="rounded-xl bg-slate-50 dark:bg-slate-800 p-3">
                            <p className="text-sm font-bold text-slate-900 dark:text-white">{event.title}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                              {formatDate(event.extractedData.eventDate || event.createdAt)}
                              {event.extractedData.nextAppointmentDate
                                ? ` · Próxima: ${formatDate(event.extractedData.nextAppointmentDate)}`
                                : ""}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>

                  <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 md:p-5">
                    <h4 className="text-sm font-black uppercase tracking-wide text-slate-500 mb-3">Tratamientos activos</h4>
                    {reportData.activeMedications.length === 0 ? (
                      <p className="text-sm text-slate-500 dark:text-slate-400">No hay tratamientos activos.</p>
                    ) : (
                      <div className="space-y-2">
                        {reportData.activeMedications.map((medication) => (
                          <div key={medication.id} className="rounded-xl bg-slate-50 dark:bg-slate-800 p-3">
                            <p className="text-sm font-bold text-slate-900 dark:text-white">{medication.name}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                              {medication.dosage || "Dosis no especificada"}
                              {medication.frequency ? ` · ${medication.frequency}` : ""}
                              {medication.endDate ? ` · hasta ${formatDate(medication.endDate)}` : " · sin fecha fin"}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>

                  <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 md:p-5">
                    <h4 className="text-sm font-black uppercase tracking-wide text-slate-500 mb-3">Historial cronologico</h4>
                    {reportData.timeline.length === 0 ? (
                      <p className="text-sm text-slate-500 dark:text-slate-400">Todavia no hay documentos en el historial.</p>
                    ) : (
                      <div className="space-y-2">
                        {reportData.timeline.map((row) => (
                          <div key={row.id} className="rounded-xl bg-slate-50 dark:bg-slate-800 p-3">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-sm font-bold text-slate-900 dark:text-white">{row.title}</p>
                                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                                  {row.typeLabel} · {formatDate(row.dateIso)}
                                </p>
                              </div>
                              {row.documentUrl && (
                                <a
                                  href={row.documentUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[11px] font-bold text-[#074738]"
                                >
                                  Ver
                                </a>
                              )}
                            </div>
                            <p className="text-xs text-slate-600 dark:text-slate-300 mt-2 leading-relaxed">{row.subtitle}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                </>
              )}
            </main>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
