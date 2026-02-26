import { useMemo, useState } from "react";
import { MaterialIcon } from "./MaterialIcon";
import { motion, AnimatePresence } from "motion/react";
import { usePet } from "../contexts/PetContext";
import { useMedical } from "../contexts/MedicalContext";
import { MedicalEvent, TreatmentNote } from "../types/medical";
import { cleanText } from "../utils/cleanText";
import { formatDateSafe, parseDateSafe, toDateKeySafe, toTimestampSafe } from "../utils/dateUtils";

interface MedicationsScreenProps {
  onBack: () => void;
}

type MedicationStatus = "active" | "chronic" | "completed";

type MedicationCardItem = {
  id: string;
  event: MedicalEvent;
  medicationName: string;
  dosage: string;
  frequency: string;
  duration: string;
  durationDays: number | null;   // null = crónico/indefinido
  startDate: string;
  endDate: string | null;        // null = sin fecha fin
  provider: string;
  sourceLabel: "document" | "scan";
  status: MedicationStatus;
  daysLeft: number | null;       // null si crónico o vencido
};

const NOTE_LABELS: Record<TreatmentNote["interpretedAs"], string> = {
  dose_change:      "Cambio de dosis",
  interruption:     "Tratamiento interrumpido",
  positive_progress:"Evolución positiva",
  adverse_effect:   "Interferencia o efecto",
  general_note:     "Observación",
};

function interpretTreatmentNote(text: string): TreatmentNote["interpretedAs"] {
  const t = text.toLowerCase();
  if (t.match(/aument|subi|baje|doble|dosis/)) return "dose_change";
  if (t.match(/suspend|interrump|deje|no lo tomo|ya no|finaliz|termin|complet|listo|no usa|dejo|dej[oó]|no toma/)) return "interruption";
  if (t.match(/vomit|diarrea|alerg|reaccion|efecto/)) return "adverse_effect";
  if (t.match(/mejor|evoluc|estable|sin sintomas/)) return "positive_progress";
  return "general_note";
}

// Si alguna nota del evento indica interrupción/finalización → forzar completed
function isInterruptedByNotes(event: MedicalEvent): boolean {
  return (event.treatmentNotes || []).some((n) => n.interpretedAs === "interruption");
}

const formatDate = (iso: string) =>
  formatDateSafe(iso, "es-AR", { day: "2-digit", month: "short", year: "numeric" }, "Sin fecha");

/**
 * Parsea el campo `duration` de Gemini y devuelve:
 *  - { type: "chronic" }  — para tratamientos indefinidos
 *  - { type: "days", days: N }  — para duraciones concretas
 *  - null  — si no se pudo parsear
 */
function parseDuration(duration?: string | null): { type: "chronic" } | { type: "days"; days: number } | null {
  if (!duration) return null;
  const n = duration.toLowerCase().trim();

  if (n.match(/cronic|indefinid|continu|permanente|toda la vida|siempre/)) {
    return { type: "chronic" };
  }

  // Formato "X días/semanas/meses"
  const match = n.match(/(\d+)\s*(d[ií]a|semana|mes)/i);
  if (!match) return null;
  const qty = Number(match[1]);
  const unit = match[2].toLowerCase();
  if (!Number.isFinite(qty) || qty <= 0) return null;

  if (unit.startsWith("d")) return { type: "days", days: qty };
  if (unit.startsWith("s")) return { type: "days", days: qty * 7 };
  if (unit.startsWith("m")) return { type: "days", days: qty * 30 };
  return null;
}

function calcStatus(startIso: string, parsed: ReturnType<typeof parseDuration>): {
  status: MedicationStatus;
  endDate: string | null;
  daysLeft: number | null;
  durationDays: number | null;
} {
  if (!parsed) {
    // Sin info de duración: asumir activo 30 días desde inicio
    const start = parseDateSafe(startIso);
    if (!start) return { status: "completed", endDate: null, daysLeft: 0, durationDays: null };
    const assumed = new Date(start);
    assumed.setDate(assumed.getDate() + 30);
    const daysLeft = Math.ceil((assumed.getTime() - Date.now()) / 86400000);
    if (daysLeft > 0) return { status: "active", endDate: assumed.toISOString(), daysLeft, durationDays: 30 };
    return { status: "completed", endDate: assumed.toISOString(), daysLeft: 0, durationDays: 30 };
  }

  if (parsed.type === "chronic") {
    return { status: "chronic", endDate: null, daysLeft: null, durationDays: null };
  }

  const start = parseDateSafe(startIso);
  if (!start) return { status: "completed", endDate: null, daysLeft: 0, durationDays: null };
  const end = new Date(start);
  end.setDate(end.getDate() + parsed.days);
  const daysLeft = Math.ceil((end.getTime() - Date.now()) / 86400000);

  if (daysLeft > 0) return { status: "active", endDate: end.toISOString(), daysLeft, durationDays: parsed.days };
  return { status: "completed", endDate: end.toISOString(), daysLeft: 0, durationDays: parsed.days };
}

const STATUS_CONFIG: Record<MedicationStatus, { label: string; color: string; bg: string; accent: string }> = {
  active:    { label: "Activo",   color: "text-[#2b6fee]",   bg: "bg-[#2b6fee]/10",  accent: "#2b6fee" },
  chronic:   { label: "Crónico",  color: "text-violet-600",  bg: "bg-violet-100",     accent: "#7c3aed" },
  completed: { label: "Finalizado", color: "text-slate-500", bg: "bg-slate-100",      accent: "#94a3b8" },
};

export function MedicationsScreen({ onBack }: MedicationsScreenProps) {
  const [activeTab, setActiveTab] = useState<"active" | "history">("active");
  const [expandedNotesByEvent, setExpandedNotesByEvent] = useState<Record<string, boolean>>({});
  const [draftNoteByEvent, setDraftNoteByEvent] = useState<Record<string, string>>({});
  const [savingNoteByEvent, setSavingNoteByEvent] = useState<Record<string, boolean>>({});
  const [confirmingByEvent, setConfirmingByEvent] = useState<Record<string, boolean>>({});

  const { activePetId } = usePet();
  const { getEventsByPetId, updateEvent, confirmEvent } = useMedical();

  const medicationItems = useMemo(() => {
    if (!activePetId) return [] as MedicationCardItem[];

    // Dedup por nombre+dosis+frecuencia entre documentos distintos
    const seen = new Set<string>();
    const normalizeKey = (
      name: string,
      dosage: string | null,
      freq: string | null,
      startDate: string,
      provider: string | null | undefined
    ) =>
      [
        (name || "").toLowerCase().trim(),
        (dosage || "").toLowerCase().trim(),
        (freq || "").toLowerCase().trim(),
        toDateKeySafe(startDate),
        (provider || "").toLowerCase().trim(),
      ].join("|");

    return getEventsByPetId(activePetId)
      .flatMap((event) => {
        const hasMeds = Boolean(event.extractedData.medications?.length);
        const isMedDoc = event.extractedData.documentType === "medication";
        if (!hasMeds && !isMedDoc) return [];

        const startDate = event.extractedData.eventDate || event.createdAt;
        const sourceLabel: "document" | "scan" = event.extractedData.eventDate ? "document" : "scan";

        const meds = hasMeds
          ? event.extractedData.medications
          : [{
              name: cleanText(event.extractedData.diagnosis || event.title || event.fileName),
              dosage: null,
              frequency: null,
              duration: null,
              confidence: "not_detected" as const,
            }];

        return meds.flatMap((med, idx) => {
          const name = cleanText(med.name) || "Medicación";
          const key = normalizeKey(name, med.dosage, med.frequency, startDate, event.extractedData.provider);
          if (seen.has(key)) return [];
          seen.add(key);

          const parsed = parseDuration(med.duration);
          const { status: calcedStatus, endDate, daysLeft, durationDays } = calcStatus(startDate, parsed);

          // Si el usuario marcó en notas que ya no lo toma → forzar completed
          const status: MedicationStatus = isInterruptedByNotes(event) ? "completed" : calcedStatus;

          return [{
            id: `${event.id}-${idx}`,
            event,
            medicationName: name,
            dosage: cleanText(med.dosage) || "Según receta",
            frequency: cleanText(med.frequency) || "Frecuencia no especificada",
            duration: cleanText(med.duration) || "Sin duración definida",
            durationDays,
            startDate,
            endDate,
            provider: cleanText(event.extractedData.provider) || "Profesional no especificado",
            sourceLabel,
            status,
            daysLeft,
          }];
        });
      })
      .sort((a, b) => toTimestampSafe(b.startDate) - toTimestampSafe(a.startDate));
  }, [activePetId, getEventsByPetId]);

  const activeItems = medicationItems.filter((i) => i.status === "active" || i.status === "chronic");
  const completedItems = medicationItems.filter((i) => i.status === "completed");
  const shownItems = activeTab === "active" ? activeItems : completedItems;

  const saveNote = async (event: MedicalEvent) => {
    const text = (draftNoteByEvent[event.id] || "").trim();
    if (!text) return;
    setSavingNoteByEvent((prev) => ({ ...prev, [event.id]: true }));
    try {
      const newNote: TreatmentNote = {
        id: `note_${Date.now()}`,
        text,
        interpretedAs: interpretTreatmentNote(text),
        createdAt: new Date().toISOString(),
      };
      await updateEvent(event.id, { treatmentNotes: [...(event.treatmentNotes || []), newNote] });
      setDraftNoteByEvent((prev) => ({ ...prev, [event.id]: "" }));
      setExpandedNotesByEvent((prev) => ({ ...prev, [event.id]: true }));
    } finally {
      setSavingNoteByEvent((prev) => ({ ...prev, [event.id]: false }));
    }
  };

  const confirmMedicationEvent = async (event: MedicalEvent) => {
    setConfirmingByEvent((prev) => ({ ...prev, [event.id]: true }));
    try {
      await confirmEvent(event.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo confirmar el tratamiento.";
      alert(message);
    } finally {
      setConfirmingByEvent((prev) => ({ ...prev, [event.id]: false }));
    }
  };

  return (
    <div className="min-h-screen bg-[#f6f6f8] dark:bg-[#101622] flex flex-col">
      <div className="max-w-md mx-auto w-full flex flex-col min-h-screen">

        {/* Header */}
        <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 pt-6 pb-4">
          <div className="flex items-center gap-3 mb-4">
            <button onClick={onBack}
              className="size-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
              <MaterialIcon name="arrow_back" className="text-xl" />
            </button>
            <div>
              <h1 className="text-2xl font-black text-slate-900 dark:text-white">Tratamientos</h1>
              <p className="text-sm text-slate-500">{activeItems.length} activos · {completedItems.length} finalizados</p>
            </div>
          </div>

          <div className="flex gap-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
            {(["active", "history"] as const).map((tab) => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`flex-1 py-2.5 rounded-lg font-bold text-sm transition-all ${activeTab === tab
                  ? "bg-white dark:bg-slate-900 text-[#2b6fee] shadow-sm"
                  : "text-slate-600 dark:text-slate-400"}`}>
                {tab === "active" ? `Activos (${activeItems.length})` : `Historial (${completedItems.length})`}
              </button>
            ))}
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {shownItems.length === 0 ? (
            <div className="text-center py-16">
              <div className="size-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                <MaterialIcon name="medication" className="text-4xl text-slate-400" />
              </div>
              <h3 className="font-black text-slate-900 dark:text-white mb-2">Sin registros</h3>
              <p className="text-sm text-slate-500">Subí recetas y notas de tratamiento para verlos acá.</p>
            </div>
          ) : (
            shownItems.map((item) => {
              const sc = STATUS_CONFIG[item.status];
              const noteCount = item.event.treatmentNotes?.length || 0;
              const isExpanded = Boolean(expandedNotesByEvent[item.event.id]);
              const needsReview = item.event.requiresManualConfirmation || item.event.workflowStatus === "review_required" || item.event.workflowStatus === "invalid_future_date" || item.event.status === "draft";

              return (
                <motion.div key={item.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">

                  {/* Accent bar */}
                  <div className="h-1" style={{ backgroundColor: sc.accent }} />

                  <div className="p-4">
                    {/* Top */}
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex-1">
                        <h3 className="font-black text-slate-900 dark:text-white text-base leading-tight mb-0.5">
                          {item.medicationName}
                        </h3>
                        <p className="text-xs text-slate-500">{item.provider}</p>
                      </div>
                      <span className={`text-[10px] font-black uppercase tracking-wide px-2.5 py-1 rounded-full ${sc.bg} ${sc.color}`}>
                        {needsReview ? "Por confirmar" : sc.label}
                      </span>
                    </div>

                    {needsReview && (
                      <div className="mb-3 p-2.5 rounded-xl bg-amber-50 border border-amber-200">
                        <p className="text-[11px] font-semibold text-amber-700">
                          {item.event.reviewReasons?.[0] || "Revisión manual requerida antes de guardar como definitivo."}
                        </p>
                      </div>
                    )}

                    {/* Dosis + Frecuencia */}
                    <div className="grid grid-cols-2 gap-2 mb-3">
                      <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3">
                        <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-0.5">Dosis</p>
                        <p className="text-sm font-bold text-slate-900 dark:text-white">{item.dosage}</p>
                      </div>
                      <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3">
                        <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-0.5">Frecuencia</p>
                        <p className="text-sm font-bold text-slate-900 dark:text-white">{item.frequency}</p>
                      </div>
                    </div>

                    {/* Fechas y duración */}
                    <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3 mb-3 space-y-1.5">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-400">Inicio</span>
                        <span className="font-semibold text-slate-700 dark:text-slate-300">{formatDate(item.startDate)}</span>
                      </div>
                      {item.status === "chronic" ? (
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-400">Duración</span>
                          <span className="font-semibold text-violet-600">Tratamiento crónico</span>
                        </div>
                      ) : item.endDate ? (
                        <>
                          <div className="flex justify-between text-xs">
                            <span className="text-slate-400">Fin estimado</span>
                            <span className="font-semibold text-slate-700 dark:text-slate-300">{formatDate(item.endDate)}</span>
                          </div>
                          {item.daysLeft !== null && item.daysLeft > 0 && (
                            <div className="flex justify-between text-xs">
                              <span className="text-slate-400">Días restantes</span>
                              <span className={`font-bold ${item.daysLeft <= 7 ? "text-amber-500" : "text-[#2b6fee]"}`}>
                                {item.daysLeft} día{item.daysLeft !== 1 ? "s" : ""}
                              </span>
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-400">Duración</span>
                          <span className="font-semibold text-slate-500">{item.duration}</span>
                        </div>
                      )}

                      {/* Progress bar para activos con fecha fin */}
                      {item.status === "active" && item.durationDays && item.daysLeft !== null && (
                        <div className="mt-1.5">
                          <div className="h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-[#2b6fee] rounded-full transition-all"
                              style={{ width: `${Math.max(0, Math.min(100, (1 - item.daysLeft / item.durationDays) * 100))}%` }}
                            />
                          </div>
                          <p className="text-[10px] text-slate-400 mt-0.5 text-right">
                            {Math.round((1 - item.daysLeft / item.durationDays) * 100)}% completado
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Source chip */}
                    <div className="flex items-center gap-2 mb-3">
                      <MaterialIcon
                        name={item.sourceLabel === "document" ? "description" : "document_scanner"}
                        className="text-slate-400 text-sm"
                      />
                      <span className="text-[11px] text-slate-400">
                        {item.sourceLabel === "document" ? "Fecha del documento" : "Fecha de escaneo"}: {formatDate(item.startDate)}
                      </span>
                    </div>

                    {/* Treatment notes */}
                    <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
                      {needsReview && (
                        <div className="flex gap-2 mb-3">
                          <button
                            onClick={() => confirmMedicationEvent(item.event)}
                            disabled={Boolean(confirmingByEvent[item.event.id])}
                            className="flex-1 px-3 py-2 rounded-xl bg-emerald-500 text-white text-xs font-bold disabled:opacity-60"
                          >
                            {confirmingByEvent[item.event.id] ? "Confirmando..." : "Confirmar tratamiento"}
                          </button>
                        </div>
                      )}

                      {/* Botón rápido finalizar — solo en activos/crónicos */}
                      {(item.status === "active" || item.status === "chronic") && !needsReview && (
                        <button
                          onClick={async () => {
                            const note: TreatmentNote = {
                              id: `note_${Date.now()}`,
                              text: "Ya no lo toma — marcado como finalizado",
                              interpretedAs: "interruption",
                              createdAt: new Date().toISOString(),
                            };
                            await updateEvent(item.event.id, {
                              treatmentNotes: [...(item.event.treatmentNotes || []), note],
                            });
                          }}
                          className="w-full mb-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-400 flex items-center justify-center gap-1.5 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                        >
                          <MaterialIcon name="check_circle" className="text-sm text-slate-400" />
                          Ya no lo toma — marcar como finalizado
                        </button>
                      )}
                      <button
                        onClick={() => setExpandedNotesByEvent((prev) => ({ ...prev, [item.event.id]: !prev[item.event.id] }))}
                        className="w-full flex items-center justify-between text-sm font-bold text-slate-700 dark:text-slate-300">
                        <span>Notas clínicas ({noteCount})</span>
                        <MaterialIcon name={isExpanded ? "keyboard_arrow_up" : "keyboard_arrow_down"} className="text-xl" />
                      </button>

                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                            <div className="mt-3 space-y-2">
                              {(item.event.treatmentNotes || []).map((note) => (
                                <div key={note.id} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="text-[10px] uppercase tracking-wide font-black text-[#2b6fee]">
                                      {NOTE_LABELS[note.interpretedAs]}
                                    </span>
                                    <span className="text-[10px] text-slate-400">{formatDate(note.createdAt)}</span>
                                  </div>
                                  <p className="text-xs text-slate-700 dark:text-slate-300">{note.text}</p>
                                </div>
                              ))}
                              <div className="flex gap-2">
                                <input
                                  value={draftNoteByEvent[item.event.id] || ""}
                                  onChange={(e) => setDraftNoteByEvent((prev) => ({ ...prev, [item.event.id]: e.target.value }))}
                                  placeholder="Ej: se redujo dosis por indicación veterinaria"
                                  className="flex-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-[#2b6fee]"
                                />
                                <button onClick={() => saveNote(item.event)}
                                  disabled={Boolean(savingNoteByEvent[item.event.id])}
                                  className="px-4 py-2 rounded-xl bg-[#2b6fee] text-white text-xs font-bold disabled:opacity-60">
                                  {savingNoteByEvent[item.event.id] ? "..." : "Agregar"}
                                </button>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                </motion.div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
