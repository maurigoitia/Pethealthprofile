import { useMemo, useState, useEffect, useRef } from "react";
import { useLocation } from "react-router";
import { MaterialIcon } from "../shared/MaterialIcon";
import { usePet } from "../../contexts/PetContext";
import { useMedical } from "../../contexts/MedicalContext";
import { useReminders } from "../../contexts/RemindersContext";
import { MedicalEvent, TreatmentNote } from "../../types/medical";
import { cleanText } from "../../utils/cleanText";
import { formatDateSafe, parseDateSafe, toDateKeySafe, toTimestampSafe } from "../../utils/dateUtils";
import { isFocusExperienceHost } from "../../utils/runtimeFlags";
import { EditMedicationModal } from "./EditMedicationModal";
import { DeleteMedicationModal } from "./DeleteMedicationModal";

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
  isExpired: boolean;
  daysLeft: number | null;       // null si crónico o vencido
  linkedMedicationId: string | null;
  lastDoseAt: string | null;
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
    if (daysLeft> 0) return { status: "active", endDate: assumed.toISOString(), daysLeft, durationDays: 30 };
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

  if (daysLeft> 0) return { status: "active", endDate: end.toISOString(), daysLeft, durationDays: parsed.days };
  return { status: "completed", endDate: end.toISOString(), daysLeft: 0, durationDays: parsed.days };
}

function parseFrequencyHours(value?: string | null): number | null {
  if (!value) return null;
  const text = value
    .toLowerCase()
    .replace(",", ".")
    .replace(/\s+/g, " ")
    .trim();

  const eachMatch =
    text.match(/(?:cada|c\/|q)\s*(\d+(?:\.\d+)?)\s*(?:h|hs|hora|horas)\b/) ||
    text.match(/\b(\d+(?:\.\d+)?)\s*(?:h|hs|hora|horas)\b/);
  if (eachMatch) {
    const num = Number(eachMatch[1]);
    return Number.isFinite(num) && num> 0 ? num : null;
  }
  const dailyMatch = text.match(/(\d+)\s*vez(?:es)?\s*al\s*d[ií]a/);
  if (dailyMatch) {
    const times = Number(dailyMatch[1]);
    if (Number.isFinite(times) && times> 0) return Math.round(24 / times);
  }
  if (/diario|diaria|cada\s+24\s*h/.test(text)) return 24;
  return null;
}

function computeNextDoseDate(anchorIso: string, frequency: string): Date | null {
  const hours = parseFrequencyHours(frequency);
  if (!hours) return null;
  const step = Math.round(hours * 60 * 60 * 1000);
  let nextTs = toTimestampSafe(anchorIso, Date.now());
  let guard = 0;
  while (nextTs <= Date.now() && guard < 2000) {
    nextTs += step;
    guard += 1;
  }
  return new Date(nextTs);
}

function nextDoseLabel(anchorIso: string, frequency: string): string {
  const next = computeNextDoseDate(anchorIso, frequency);
  if (!next) return "según receta";
  const dayLabel = toDateKeySafe(next.toISOString()) === toDateKeySafe(new Date().toISOString()) ? "hoy" : "próx.";
  return `${dayLabel} ${next.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}`;
}

function formatDoseMoment(value: string | null): string {
  if (!value) return "sin registro";
  const parsed = parseDateSafe(value);
  if (!parsed) return "sin registro";
  return parsed.toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const STATUS_CONFIG: Record<MedicationStatus, { label: string; color: string; bg: string; accent: string }> = {
  active:    { label: "Activo",   color: "text-[#074738]",   bg: "bg-[#074738]/10",  accent: "#074738" },
  chronic:   { label: "Crónico",  color: "text-violet-600",  bg: "bg-violet-100",     accent: "#7c3aed" },
  completed: { label: "Finalizado", color: "text-slate-500", bg: "bg-slate-100",      accent: "#94a3b8" },
};

const HARD_MEDICATION_SIGNAL_REGEX = /(comprimid|capsul|tableta|pastilla|jarabe|gotas|ampolla|inyecci[oó]n|\b\d+\/\d+\s*comprimido|\b\d+\s*(mg|mcg)\b|pimobendan|ursomax|predni|furosemida|omeprazol|enroflox|amoxic|metronidazol|gabapentin|carprofeno)/i;
const SCHEDULE_MEDICATION_SIGNAL_REGEX = /(cada\s+\d+\s*(h|hs|hora|horas)|\b\d+\s*veces?\s*al\s*d[ií]a\b|(tomar|administrar|dar)[^\n]{0,32}\b\d+(?:[.,]\d+)?\s*ml\b)/i;
const NON_MEDICATION_SIGNAL_REGEX = /(pr[oó]stata|diametr|volumen|vol:|ecograf|radiograf|ultrason|hallazgo|medida|eje|cm\b|mm\b|sin\s+fractura|sin\s+luxaci[oó]n)/i;

function isPlausibleMedicationEntry(
  event: MedicalEvent,
  medication: { name?: string | null; dosage?: string | null; frequency?: string | null; duration?: string | null }
): boolean {
  const combined = [
    cleanText(medication.name),
    cleanText(medication.dosage),
    cleanText(medication.frequency),
    cleanText(medication.duration),
    cleanText(event.extractedData.observations),
  ]
    .filter(Boolean)
    .join(" ");

  const hasHardMedicationSignal = HARD_MEDICATION_SIGNAL_REGEX.test(combined);
  const hasScheduleSignal = SCHEDULE_MEDICATION_SIGNAL_REGEX.test(combined);
  const hasStudySignal = NON_MEDICATION_SIGNAL_REGEX.test(combined);

  if (hasStudySignal && !hasHardMedicationSignal) return false;
  if (hasHardMedicationSignal || hasScheduleSignal) return true;

  return Boolean(
    cleanText(medication.name) &&
      (cleanText(medication.dosage) || cleanText(medication.frequency))
  );
}

export function MedicationsScreen({ onBack }: MedicationsScreenProps) {
  const [activeTab, setActiveTab] = useState<"active" | "history">("active");
  const [showExpiredInActive, setShowExpiredInActive] = useState(false);
  const [expandedNotesByEvent, setExpandedNotesByEvent] = useState<Record<string, boolean>>({});
  const [draftNoteByEvent, setDraftNoteByEvent] = useState<Record<string, string>>({});
  const [savingNoteByEvent, setSavingNoteByEvent] = useState<Record<string, boolean>>({});
  const [confirmingByEvent, setConfirmingByEvent] = useState<Record<string, boolean>>({});

  // Editar
  const [editingItem, setEditingItem] = useState<MedicationCardItem | null>(null);
  const [editFeedback, setEditFeedback] = useState("");

  // Borrar con confirmación
  const [deletingItem, setDeletingItem] = useState<MedicationCardItem | null>(null);

  const location = useLocation();
  const highlightEventId = new URLSearchParams(location.search).get("eventId") || "";
  const highlightRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (highlightEventId && highlightRef.current) {
      setTimeout(() => highlightRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 300);
    }
  }, [highlightEventId]);

  const { activePetId, activePet } = usePet();
  const { getEventsByPetId, updateEvent, confirmEvent, activeMedications, updateMedication, addMedication } = useMedical();
  const focusExperienceEnabled = isFocusExperienceHost();

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
        if (!hasMeds) return [];

        const startDate = event.extractedData.eventDate || event.createdAt;
        const sourceLabel: "document" | "scan" = event.extractedData.eventDate ? "document" : "scan";

        const meds = event.extractedData.medications.filter((med) => isPlausibleMedicationEntry(event, med));

        if (meds.length === 0) return [];

        return meds.flatMap((med, idx) => {
          const name = cleanText(med.name) || "Medicación";
          const key = normalizeKey(name, med.dosage, med.frequency, startDate, event.extractedData.provider);
          if (seen.has(key)) return [];
          seen.add(key);

          const linkedMedication =
            activeMedications.find(
              (medication) =>
                medication.active &&
                medication.generatedFromEventId === event.id &&
                cleanText(medication.name).toLowerCase() === name.toLowerCase()
            ) ||
            activeMedications.find(
              (medication) => medication.active && medication.generatedFromEventId === event.id
            ) ||
            null;

          const parsed = parseDuration(med.duration);
          const { status: calcedStatus, endDate, daysLeft, durationDays } = calcStatus(startDate, parsed);

          // Si el usuario marcó en notas que ya no lo toma → forzar completed (pero no "vencido")
          const interruptedByNotes = isInterruptedByNotes(event);
          const status: MedicationStatus = interruptedByNotes ? "completed" : calcedStatus;
          const isExpired = !interruptedByNotes && status === "completed";

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
            isExpired,
            daysLeft,
            linkedMedicationId: linkedMedication?.id || null,
            lastDoseAt: linkedMedication?.lastDoseAt || null,
          }];
        });
      })
      .sort((a, b) => toTimestampSafe(b.startDate) - toTimestampSafe(a.startDate));
  }, [activeMedications, activePetId, getEventsByPetId]);

  const activeBaseItems = medicationItems.filter((i) => i.status === "active" || i.status === "chronic");
  const expiredItems = medicationItems.filter((i) => i.isExpired);
  const completedItems = medicationItems.filter((i) => i.status === "completed" && !i.isExpired);
  const activeItems = (showExpiredInActive ? [...activeBaseItems, ...expiredItems] : activeBaseItems)
    .sort((a, b) => toTimestampSafe(b.startDate) - toTimestampSafe(a.startDate));
  const shownItems = activeTab === "active" ? activeItems : completedItems;
  const todayKey = toDateKeySafe(new Date().toISOString());
  const reminderPills = activeBaseItems
    .map((item) => {
      const next = computeNextDoseDate(item.lastDoseAt || item.startDate, item.frequency);
      if (!next) return null;
      if (toDateKeySafe(next.toISOString()) !== todayKey) return null;
      return {
        id: item.id,
        name: item.medicationName,
        when: `hoy ${next.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}`,
      };
    })
    .filter(Boolean)
    .slice(0, 6) as { id: string; name: string; when: string }[];

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



  const registerDoseNow = async (item: MedicationCardItem) => {
    if (!activePet) return;

    const nowIso = new Date().toISOString();
    const nextDose = computeNextDoseDate(nowIso, item.frequency);
    const nextDoseIso = nextDose ? nextDose.toISOString() : null;

    const linked = activeMedications.filter((medication) => {
      if (!medication.active) return false;
      if (item.linkedMedicationId && medication.id === item.linkedMedicationId) return true;
      return (
        medication.generatedFromEventId === item.event.id &&
        cleanText(medication.name).toLowerCase() === cleanText(item.medicationName).toLowerCase()
      );
    });

    const fallbackLinked = linked.length> 0
      ? linked
      : activeMedications.filter(
          (medication) => medication.active && medication.generatedFromEventId === item.event.id
        );

    if (fallbackLinked.length === 0) {
      const newMedicationId = `med_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      const newMedication = {
        id: newMedicationId,
        petId: item.event.petId,
        userId: item.event.userId || "",
        name: item.medicationName,
        dosage: item.dosage,
        frequency: item.frequency,
        type: "Receta",
        startDate: item.startDate,
        endDate: item.endDate || null,
        prescribedBy: item.provider || null,
        generatedFromEventId: item.event.id,
        active: true,
        lastDoseAt: nowIso,
        nextDoseAt: nextDoseIso,
      };
      await addMedication(newMedication);

      if (parseFrequencyHours(item.frequency)) {
        await NotificationService.scheduleMedicationReminders({
          petId: newMedication.petId,
          petName: activePet.name,
          medicationName: newMedication.name,
          dosage: item.dosage || "Según receta",
          frequency: item.frequency,
          startDate: newMedication.startDate,
          endDate: newMedication.endDate,
          sourceEventId: item.event.id,
          sourceMedicationId: newMedication.id,
          lastDoseAt: nowIso,
        });
      }
    } else {
      for (const medication of fallbackLinked) {
        await updateMedication(medication.id, {
          lastDoseAt: nowIso,
          nextDoseAt: nextDoseIso,
        });

        if (parseFrequencyHours(item.frequency)) {
          await NotificationService.scheduleMedicationReminders({
            petId: medication.petId,
            petName: activePet.name,
            medicationName: medication.name,
            dosage: item.dosage || medication.dosage || "Según receta",
            frequency: item.frequency,
            startDate: medication.startDate,
            endDate: medication.endDate,
            sourceEventId: item.event.id,
            sourceMedicationId: medication.id,
            lastDoseAt: nowIso,
          });
        }
      }
    }

    const adherenceNote: TreatmentNote = {
      id: `dose_${Date.now()}`,
      text: `Dosis administrada el ${formatDoseMoment(nowIso)}.`,
      interpretedAs: "general_note",
      createdAt: nowIso,
    };

    await updateEvent(item.event.id, {
      treatmentNotes: [...(item.event.treatmentNotes || []), adherenceNote],
    });

    const nextLabel = nextDose
      ? nextDose.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })
      : "según receta";
    setEditFeedback(`Dosis registrada. Próximo recordatorio: ${nextLabel}.`);
    window.setTimeout(() => setEditFeedback(""), 5000);
  };



  return (
    <>
      <div className={`min-h-screen flex flex-col ${focusExperienceEnabled ? "bg-[#f3f7f5] dark:bg-[#101622]" : "bg-[#F0FAF9] dark:bg-[#101622]"}`}>
      <div className="max-w-md mx-auto w-full flex flex-col min-h-screen">

        {/* Header */}
        <div className={focusExperienceEnabled
          ? "px-4 pt-6 pb-6 bg-[linear-gradient(180deg,rgba(7,71,56,0.18)_0%,rgba(7,71,56,0.08)_40%,rgba(243,247,245,0)_100%)]"
          : "bg-white border-b border-slate-100 sticky top-0 z-10 px-4 pt-6 pb-4"}>
          <div className="flex items-center gap-3 mb-4">
            <button onClick={onBack}
              className={`size-10 rounded-full flex items-center justify-center ${focusExperienceEnabled ? "bg-white/80 dark:bg-slate-900/70 shadow-[0_2px_12px_rgba(0,0,0,0.06)]" : "bg-[#E0F2F1]"}`}>
              <MaterialIcon name="arrow_back" className={`text-xl ${focusExperienceEnabled ? "text-[#074738]" : "text-[#074738]"}`} />
            </button>
            <div>
              {focusExperienceEnabled && (
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#074738] mb-1">Tratamientos</p>
              )}
              {!focusExperienceEnabled && (
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Rutinas</p>
              )}
              <h1 className={`text-2xl font-black ${focusExperienceEnabled ? "text-slate-900 dark:text-white" : "text-[#074738]"}`}>
                Tratamientos y medicación
              </h1>
              <p className={`text-sm ${focusExperienceEnabled ? "text-slate-600 dark:text-slate-300" : "text-slate-500"}`}>
                {activeBaseItems.length} activos · {expiredItems.length} vencidos · {completedItems.length} finalizados
              </p>
            </div>
          </div>

          {focusExperienceEnabled && (
            <div className="mb-4 rounded-[28px] border border-[#074738]/10 dark:border-[#1a9b7d]/20 bg-[#dbe7e2] dark:bg-[#17382f] p-4 shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 leading-5">
                PESSY separa tratamientos activos, crónicos e históricos para que el tutor vea continuidad y próxima dosis sin leer toda la historia.
              </p>
            </div>
          )}

          <div className={`flex gap-2 p-1 ${focusExperienceEnabled ? "rounded-full bg-white/80 dark:bg-slate-900/70" : "bg-[#E0F2F1] rounded-[14px]"}`}>
            {(["active", "history"] as const).map((tab) => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={[
                  "flex-1 py-2.5 font-semibold text-sm transition-all",
                  activeTab === tab
                    ? focusExperienceEnabled ? "bg-[#074738] text-white rounded-full shadow-[0_2px_12px_rgba(0,0,0,0.06)]" : "bg-white text-[#074738] rounded-[10px] shadow-sm"
                    : focusExperienceEnabled ? "text-slate-600 dark:text-slate-300 rounded-full" : "text-[#1A9B7D] rounded-[10px]"
                ].join(" ")}>
                {tab === "active" ? "Activos (" + activeBaseItems.length + ")" : "Historial (" + completedItems.length + ")"}
              </button>
            ))}
          </div>
          {activeTab === "active" && (
            <div className={`mt-3 flex items-center justify-between border px-3 py-2 ${focusExperienceEnabled ? "rounded-[22px] border-[#074738]/10 bg-white/90 dark:border-slate-800 dark:bg-slate-900/70" : "rounded-[14px] border-[#E0F2F1] bg-[#F0FAF9]"}`}>
              <div>
                <p className="text-xs font-bold text-slate-700 dark:text-slate-300">Mostrar vencidos</p>
                <p className="text-[11px] text-slate-500">{expiredItems.length} tratamiento(s) vencido(s)</p>
              </div>
              <button
                onClick={() => setShowExpiredInActive((prev) => !prev)}
                className={`relative h-7 w-12 rounded-full transition-colors ${showExpiredInActive ? "bg-red-500" : "bg-slate-300 dark:bg-slate-700"}`}
                aria-label="Mostrar vencidos">
                <span
                  className={`absolute top-0.5 size-6 rounded-full bg-white shadow transition-transform ${showExpiredInActive ? "translate-x-5" : "translate-x-0.5"}`}
                />
              </button>
            </div>
          )}
          {editFeedback && (
            <div className="mt-3 rounded-[12px] border border-emerald-200 bg-[#F0FAF9] px-3 py-2">
              <p className="text-xs font-semibold text-emerald-700">{editFeedback}</p>
            </div>
          )}
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {activeTab === "active" && reminderPills.length> 0 && (
            <div className={`${focusExperienceEnabled ? "rounded-[24px]" : "rounded-[16px]"} bg-white shadow-[0_2px_8px_rgba(0,0,0,0.04)] p-3`}>
              <p className="text-[11px] font-black uppercase tracking-wide text-slate-500 mb-2">Recordatorios de hoy</p>
              <div className="flex flex-wrap gap-1.5">
                {reminderPills.map((pill) => (
                  <span
                    key={pill.id}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#074738]/10 text-[#074738] text-[11px] font-semibold">
                    <MaterialIcon name="schedule" className="text-sm" />
                    <span className="max-w-[150px] truncate">{pill.name}</span>
                    <span className="text-[10px] font-black">{pill.when}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {shownItems.length === 0 ? (
            <div className="text-center py-16">
              <div className="size-20 bg-[#E0F2F1] rounded-full flex items-center justify-center mx-auto mb-4">
                <MaterialIcon name="medication" className="text-4xl text-[#1A9B7D]" />
              </div>
              <h3 className="font-semibold text-slate-800 mb-2">Sin registros</h3>
              <p className="text-sm text-slate-500">Subí recetas y notas de tratamiento para verlos acá.</p>
            </div>
          ) : (
            shownItems.map((item) => {
              const sc = item.isExpired
                ? { label: "Vencido", color: "text-red-600", bg: "bg-red-100", accent: "#dc2626" }
                : STATUS_CONFIG[item.status];
              const noteCount = item.event.treatmentNotes?.length || 0;
              const isExpanded = Boolean(expandedNotesByEvent[item.event.id]);
              const needsReview = item.event.requiresManualConfirmation || item.event.workflowStatus === "review_required" || item.event.workflowStatus === "invalid_future_date" || item.event.status === "draft";

              return (
                <div
                  key={item.id}
                  ref={highlightEventId === item.event.id ? highlightRef : undefined} className={`bg-white rounded-[16px] shadow-[0_2px_8px_rgba(0,0,0,0.04)] overflow-hidden transition-all ${
                    highlightEventId === item.event.id
                      ? "ring-2 ring-amber-300/50"
                      : ""
                  }`}>

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
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className={`text-[10px] font-semibold px-3 py-1 rounded-full ${sc.bg} ${sc.color}`}>
                          {needsReview ? "Por confirmar" : sc.label}
                        </span>
                        {/* Acciones editar / borrar */}
                        <button
                          onClick={() => setEditingItem(item)}
                          className="size-7 rounded-full bg-[#E0F2F1] flex items-center justify-center hover:bg-[#c8e6e0] transition-colors"
                          title="Editar">
                          <MaterialIcon name="edit" className="text-sm text-[#074738]" />
                        </button>
                        <button
                          onClick={() => { setDeletingItem(item); setDeleteStage("confirm"); }}
                          className="size-7 rounded-full bg-red-50 flex items-center justify-center hover:bg-red-100 transition-colors"
                          title="Eliminar">
                          <MaterialIcon name="delete" className="text-sm text-red-500" />
                        </button>
                      </div>
                    </div>

                    {needsReview && (
                      <div className="mb-3 p-2.5 rounded-[12px] bg-amber-50 border border-amber-200">
                        <p className="text-[11px] font-semibold text-amber-700">
                          {item.event.reviewReasons?.[0] || "Revisión manual requerida antes de guardar como definitivo."}
                        </p>
                      </div>
                    )}

                    {/* Dosis + Frecuencia */}
                    <div className="grid grid-cols-2 gap-2 mb-3">
                      <div className="bg-[#E0F2F1] rounded-[12px] p-3">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Dosis</p>
                        <p className="text-sm font-semibold text-slate-800">{item.dosage}</p>
                      </div>
                      <div className="bg-[#E0F2F1] rounded-[12px] p-3">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Frecuencia</p>
                        <p className="text-sm font-semibold text-slate-800">{item.frequency}</p>
                      </div>
                    </div>

                    {/* Fechas y duración */}
                    <div className="bg-[#E0F2F1] rounded-[12px] p-3 mb-3 space-y-1.5">
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
                          {item.daysLeft !== null && item.daysLeft> 0 && (
                            <div className="flex justify-between text-xs">
                              <span className="text-slate-400">Días restantes</span>
                              <span className={`font-bold ${item.daysLeft <= 7 ? "text-amber-500" : "text-[#074738]"}`}>
                                {item.daysLeft} día{item.daysLeft !== 1 ? "s" : ""}
                              </span>
                            </div>
                          )}
                          {item.isExpired && item.endDate && (
                            <div className="flex justify-between text-xs">
                              <span className="text-slate-400">Estado</span>
                              <span className="font-bold text-red-600">
                                Vencido
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
                              className="h-full bg-[#074738] rounded-full transition-all"
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

                    {(item.status === "active" || item.status === "chronic") && (
                      <div className="mb-3 p-3 rounded-[12px] bg-[#F0FAF9] border border-[#E0F2F1]">
                        <div className="flex items-center justify-between text-xs mb-2">
                          <span className="text-slate-500">Última dosis</span>
                          <span className="font-semibold text-slate-700">{formatDoseMoment(item.lastDoseAt)}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs mb-3">
                          <span className="text-slate-500">Próxima dosis</span>
                          <span className="font-semibold text-[#074738]">{nextDoseLabel(item.lastDoseAt || item.startDate, item.frequency)}</span>
                        </div>
                        {!needsReview && (
                          <button
                            onClick={() => void registerDoseNow(item)}
                            className="w-full py-3 rounded-[14px] bg-[#074738] text-white text-xs font-semibold active:scale-[0.97] transition-all">
                            Marcar dosis dada ahora
                          </button>
                        )}
                      </div>
                    )}

                    {/* Treatment notes */}
                    <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
                      {needsReview && (
                        <div className="flex gap-2 mb-3">
                          <button
                            onClick={() => confirmMedicationEvent(item.event)}
                            disabled={Boolean(confirmingByEvent[item.event.id])}
                            className="flex-1 px-3 py-2 rounded-[14px] bg-[#1A9B7D] text-white text-xs font-semibold disabled:opacity-60 active:scale-[0.97] transition-all">
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
                          className="w-full mb-3 py-2.5 rounded-[14px] border border-[#E0F2F1] text-xs font-semibold text-[#074738] flex items-center justify-center gap-1.5 hover:bg-[#E0F2F1] transition-colors active:scale-[0.97]">
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

                      {isExpanded && (<div className="overflow-hidden">
                            <div className="mt-3 space-y-2">
                              {(item.event.treatmentNotes || []).map((note) => (
                                <div key={note.id} className="p-3 rounded-[12px] bg-[#F0FAF9] border border-[#E0F2F1]">
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="text-[10px] uppercase tracking-wide font-black text-[#074738]">
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
                                  className="flex-1 px-3 py-2 rounded-[12px] border border-[#E0F2F1] bg-[#F0FAF9] text-xs focus:outline-none focus:ring-2 focus:ring-[#074738]"
                                />
                                <button onClick={() => saveNote(item.event)}
                                  disabled={Boolean(savingNoteByEvent[item.event.id])}
                                  className="px-4 py-2 rounded-[12px] bg-[#074738] text-white text-xs font-semibold disabled:opacity-60 active:scale-[0.97] transition-all">
                                  {savingNoteByEvent[item.event.id] ? "..." : "Agregar"}
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>

    {/* ─── MODALES ──────────────────────────────────────────────────────── */}
    <EditMedicationModal
      isOpen={!!editingItem}
      item={editingItem}
      onClose={() => setEditingItem(null)}
      onSaved={(msg) => {
        setEditingItem(null);
        setEditFeedback(msg);
        window.setTimeout(() => setEditFeedback(""), 5000);
      }}
    />
    <DeleteMedicationModal
      isOpen={!!deletingItem}
      item={deletingItem}
      onClose={() => setDeletingItem(null)}
      onDeleted={() => setDeletingItem(null)}
    />
    </>
  );
}
