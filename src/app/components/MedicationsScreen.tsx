import { useMemo, useState } from "react";
import { MaterialIcon } from "./MaterialIcon";
import { motion } from "motion/react";
import { usePet } from "../contexts/PetContext";
import { useMedical } from "../contexts/MedicalContext";
import { MedicalEvent, TreatmentNote } from "../types/medical";

interface MedicationsScreenProps {
  onBack: () => void;
}

type MedicationStatus = "active" | "completed";

type MedicationCardItem = {
  id: string;
  event: MedicalEvent;
  medicationName: string;
  dosage: string;
  frequency: string;
  duration: string;
  provider: string;
  referenceDate: string;
  sourceLabel: "document" | "scan";
  status: MedicationStatus;
};

const NOTE_LABELS: Record<TreatmentNote["interpretedAs"], string> = {
  dose_change: "Cambio de dosis",
  interruption: "Tratamiento interrumpido",
  positive_progress: "Evolucion positiva",
  adverse_effect: "Interferencia o efecto",
  general_note: "Observacion",
};

function interpretTreatmentNote(text: string): TreatmentNote["interpretedAs"] {
  const normalized = text.toLowerCase();

  if (
    normalized.includes("aument") ||
    normalized.includes("subi") ||
    normalized.includes("baje") ||
    normalized.includes("doble") ||
    normalized.includes("dosis")
  ) {
    return "dose_change";
  }

  if (
    normalized.includes("suspend") ||
    normalized.includes("interrump") ||
    normalized.includes("deje") ||
    normalized.includes("no lo tomo")
  ) {
    return "interruption";
  }

  if (
    normalized.includes("vomit") ||
    normalized.includes("diarrea") ||
    normalized.includes("alerg") ||
    normalized.includes("reaccion") ||
    normalized.includes("efecto")
  ) {
    return "adverse_effect";
  }

  if (
    normalized.includes("mejor") ||
    normalized.includes("evoluc") ||
    normalized.includes("estable") ||
    normalized.includes("sin sintomas")
  ) {
    return "positive_progress";
  }

  return "general_note";
}

function formatDate(dateIso: string): string {
  return new Date(dateIso).toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function parseDurationToEndDate(startDateIso: string, duration: string): string | null {
  if (!duration) return null;
  const normalized = duration.toLowerCase().trim();

  if (
    normalized.includes("cronic") ||
    normalized.includes("indefin") ||
    normalized.includes("continu")
  ) {
    return null;
  }

  const match = normalized.match(/(\d+)\s*(dia|dias|días|semana|semanas|mes|meses)/i);
  if (!match) return null;

  const quantity = Number(match[1]);
  if (!Number.isFinite(quantity) || quantity <= 0) return null;

  const end = new Date(startDateIso);
  if (Number.isNaN(end.getTime())) return null;

  const unit = match[2].toLowerCase();
  if (unit.startsWith("dia") || unit.startsWith("día")) end.setDate(end.getDate() + quantity);
  if (unit.startsWith("semana")) end.setDate(end.getDate() + quantity * 7);
  if (unit.startsWith("mes")) end.setMonth(end.getMonth() + quantity);

  return end.toISOString();
}

export function MedicationsScreen({ onBack }: MedicationsScreenProps) {
  const [activeTab, setActiveTab] = useState<"active" | "history">("active");
  const [expandedNotesByEvent, setExpandedNotesByEvent] = useState<Record<string, boolean>>({});
  const [draftNoteByEvent, setDraftNoteByEvent] = useState<Record<string, string>>({});
  const [savingNoteByEvent, setSavingNoteByEvent] = useState<Record<string, boolean>>({});

  const { activePetId } = usePet();
  const { getEventsByPetId, updateEvent } = useMedical();

  const medicationItems = useMemo(() => {
    if (!activePetId) return [] as MedicationCardItem[];

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return getEventsByPetId(activePetId)
      .flatMap((event) => {
        const hasMedicationArray = Boolean(event.extractedData.medications?.length);
        const isMedicationDocument = event.extractedData.documentType === "medication";
        if (!hasMedicationArray && !isMedicationDocument) return [];

        const referenceDate = event.extractedData.eventDate || event.createdAt;
        const sourceLabel = event.extractedData.eventDate ? "document" : "scan";

        const meds = hasMedicationArray
          ? event.extractedData.medications
          : [
              {
                name: event.extractedData.diagnosis || event.title || event.fileName,
                dosage: null,
                frequency: null,
                duration: null,
                confidence: "not_detected" as const,
              },
            ];

        return meds.map((med, idx) => {
          const durationEnd = med.duration ? parseDurationToEndDate(referenceDate, med.duration) : null;
          const comparisonDate = durationEnd || referenceDate;
          const status: MedicationStatus = new Date(comparisonDate).getTime() < today.getTime()
            ? "completed"
            : "active";

          return {
            id: `${event.id}-${idx}`,
            event,
            medicationName: med.name || "Medicacion",
            dosage: med.dosage || "Segun receta",
            frequency: med.frequency || "Frecuencia no especificada",
            duration: med.duration || "Sin duracion definida",
            provider: event.extractedData.provider || "Profesional no especificado",
            referenceDate,
            sourceLabel,
            status,
          };
        });
      })
      .sort((a, b) => new Date(b.referenceDate).getTime() - new Date(a.referenceDate).getTime());
  }, [activePetId, getEventsByPetId]);

  const activeItems = medicationItems.filter((item) => item.status === "active");
  const completedItems = medicationItems.filter((item) => item.status === "completed");
  const shownItems = activeTab === "active" ? activeItems : completedItems;

  const saveNote = async (event: MedicalEvent) => {
    const raw = draftNoteByEvent[event.id] || "";
    const text = raw.trim();
    if (!text) return;

    setSavingNoteByEvent((prev) => ({ ...prev, [event.id]: true }));

    try {
      const newNote: TreatmentNote = {
        id: `note_${Date.now()}`,
        text,
        interpretedAs: interpretTreatmentNote(text),
        createdAt: new Date().toISOString(),
      };

      const existingNotes = event.treatmentNotes || [];
      await updateEvent(event.id, {
        treatmentNotes: [...existingNotes, newNote],
      });

      setDraftNoteByEvent((prev) => ({ ...prev, [event.id]: "" }));
      setExpandedNotesByEvent((prev) => ({ ...prev, [event.id]: true }));
    } finally {
      setSavingNoteByEvent((prev) => ({ ...prev, [event.id]: false }));
    }
  };

  return (
    <div className="min-h-screen bg-[#f6f6f8] dark:bg-[#101622] flex flex-col">
      <div className="max-w-md mx-auto w-full flex flex-col min-h-screen">
        <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 pt-6 pb-4">
          <div className="flex items-center gap-3 mb-4">
            <button
              onClick={onBack}
              className="size-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            >
              <MaterialIcon name="arrow_back" className="text-xl" />
            </button>
            <div className="flex-1">
              <h1 className="text-2xl font-black text-slate-900 dark:text-white">Tratamientos y medicacion</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {medicationItems.length} registros detectados
              </p>
            </div>
          </div>

          <div className="flex gap-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
            <button
              onClick={() => setActiveTab("active")}
              className={`flex-1 py-2.5 rounded-lg font-bold text-sm transition-all ${
                activeTab === "active"
                  ? "bg-white dark:bg-slate-900 text-[#2b6fee] shadow-sm"
                  : "text-slate-600 dark:text-slate-400"
              }`}
            >
              Activos ({activeItems.length})
            </button>
            <button
              onClick={() => setActiveTab("history")}
              className={`flex-1 py-2.5 rounded-lg font-bold text-sm transition-all ${
                activeTab === "history"
                  ? "bg-white dark:bg-slate-900 text-[#2b6fee] shadow-sm"
                  : "text-slate-600 dark:text-slate-400"
              }`}
            >
              Historial ({completedItems.length})
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {shownItems.length === 0 ? (
            <div className="text-center py-12">
              <div className="size-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                <MaterialIcon name="medication" className="text-4xl text-slate-400" />
              </div>
              <h3 className="font-black text-slate-900 dark:text-white mb-2">Sin registros para esta vista</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Subi recetas y notas de tratamiento para enriquecer el historial
              </p>
            </div>
          ) : (
            shownItems.map((item) => {
              const noteCount = item.event.treatmentNotes?.length || 0;
              const isExpanded = Boolean(expandedNotesByEvent[item.event.id]);

              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden"
                >
                  <div className={`h-1.5 ${item.status === "active" ? "bg-[#2b6fee]" : "bg-emerald-500"}`} />

                  <div className="p-4">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div>
                        <h3 className="font-black text-slate-900 dark:text-white text-base leading-tight">
                          {item.medicationName}
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{item.provider}</p>
                      </div>
                      <span
                        className={`text-[10px] font-black uppercase tracking-wide px-2.5 py-1 rounded-full ${
                          item.status === "active"
                            ? "bg-[#2b6fee]/10 text-[#2b6fee]"
                            : "bg-emerald-100 text-emerald-700"
                        }`}
                      >
                        {item.status === "active" ? "Activo" : "Completado"}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 mb-3">
                      <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-2">
                        <p className="text-[10px] text-slate-500 uppercase tracking-wide">Dosis</p>
                        <p className="text-xs font-bold text-slate-900 dark:text-white">{item.dosage}</p>
                      </div>
                      <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-2">
                        <p className="text-[10px] text-slate-500 uppercase tracking-wide">Frecuencia</p>
                        <p className="text-xs font-bold text-slate-900 dark:text-white">{item.frequency}</p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-[11px]">
                      <span className="px-2 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold">
                        {item.sourceLabel === "document" ? "Fecha documento" : "Fecha escaneo"}: {formatDate(item.referenceDate)}
                      </span>
                      <span className="px-2 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold">
                        Duracion: {item.duration}
                      </span>
                    </div>

                    <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                      <button
                        onClick={() =>
                          setExpandedNotesByEvent((prev) => ({
                            ...prev,
                            [item.event.id]: !prev[item.event.id],
                          }))
                        }
                        className="w-full flex items-center justify-between text-sm font-bold text-slate-700 dark:text-slate-300"
                      >
                        <span>Notas del tratamiento ({noteCount})</span>
                        <MaterialIcon
                          name={isExpanded ? "keyboard_arrow_up" : "keyboard_arrow_down"}
                          className="text-xl"
                        />
                      </button>

                      {isExpanded && (
                        <div className="mt-3 space-y-2">
                          {(item.event.treatmentNotes || []).map((note) => (
                            <div
                              key={note.id}
                              className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                            >
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-[10px] uppercase tracking-wide font-bold text-[#2b6fee]">
                                  {NOTE_LABELS[note.interpretedAs]}
                                </span>
                                <span className="text-[10px] text-slate-500">{formatDate(note.createdAt)}</span>
                              </div>
                              <p className="text-xs text-slate-700 dark:text-slate-300">{note.text}</p>
                            </div>
                          ))}

                          <div className="flex gap-2">
                            <input
                              value={draftNoteByEvent[item.event.id] || ""}
                              onChange={(e) =>
                                setDraftNoteByEvent((prev) => ({ ...prev, [item.event.id]: e.target.value }))
                              }
                              placeholder="Ej: se redujo dosis por indicacion veterinaria"
                              className="flex-1 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#2b6fee]"
                            />
                            <button
                              onClick={() => saveNote(item.event)}
                              disabled={Boolean(savingNoteByEvent[item.event.id])}
                              className="px-3 py-2 rounded-lg bg-[#2b6fee] text-white text-xs font-bold disabled:opacity-60"
                            >
                              {savingNoteByEvent[item.event.id] ? "Guardando" : "Agregar"}
                            </button>
                          </div>
                        </div>
                      )}
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
