import { useState } from "react";
import { usePet } from "../../contexts/PetContext";
import { useMedical } from "../../contexts/MedicalContext";
import { cleanText } from "../../utils/cleanText";
import { parseDateSafe } from "../../utils/dateUtils";
import { NotificationService } from "../../services/notificationService";
import type { MedicationCardItem } from "./MedicationsScreen";

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

interface EditMedicationModalProps {
  isOpen: boolean;
  item: MedicationCardItem | null;
  onClose: () => void;
  onSaved: (feedbackMessage: string) => void;
}

export function EditMedicationModal({ isOpen, item, onClose, onSaved }: EditMedicationModalProps) {
  const { activePet } = usePet();
  const { updateEvent, activeMedications, updateMedication } = useMedical();

  const [editDosage, setEditDosage] = useState("");
  const [editFrequency, setEditFrequency] = useState("");
  const [editDuration, setEditDuration] = useState("");
  const [editIntakeTime, setEditIntakeTime] = useState("09:00");
  const [savingEdit, setSavingEdit] = useState(false);

  const extractTimeHHmm = (isoDate: string): string => {
    const parsed = parseDateSafe(isoDate);
    if (!parsed) return "09:00";
    const hh = String(parsed.getHours()).padStart(2, "0");
    const mm = String(parsed.getMinutes()).padStart(2, "0");
    return `${hh}:${mm}`;
  };

  const applyTimeToIso = (baseIso: string, hhmm: string): string => {
    const parsed = parseDateSafe(baseIso) || new Date();
    const [rawH, rawM] = String(hhmm || "").split(":");
    const h = Number(rawH);
    const m = Number(rawM);
    parsed.setHours(Number.isFinite(h) ? h : 9, Number.isFinite(m) ? m : 0, 0, 0);
    return parsed.toISOString();
  };

  const computeEndDateFromDuration = (startIso: string, durationValue: string): string | null => {
    const parsedDuration = parseDuration(durationValue);
    if (!parsedDuration || parsedDuration.type === "chronic") return null;
    const start = parseDateSafe(startIso);
    if (!start) return null;
    const end = new Date(start);
    end.setDate(end.getDate() + parsedDuration.days);
    return end.toISOString();
  };

  // Track which item we last initialized for, to re-init fields when item changes
  const [lastInitId, setLastInitId] = useState<string | null>(null);
  if (item && item.id !== lastInitId) {
    setLastInitId(item.id);
    setEditDosage(item.dosage === "Según receta" ? "" : item.dosage);
    setEditFrequency(item.frequency === "Frecuencia no especificada" ? "" : item.frequency);
    setEditDuration(item.duration === "Sin duración definida" ? "" : item.duration);
    setEditIntakeTime(extractTimeHHmm(item.startDate));
  }
  if (!item && lastInitId !== null) {
    setLastInitId(null);
  }

  const saveEdit = async () => {
    if (!item) return;
    setSavingEdit(true);
    try {
      const normalizedDosage = editDosage.trim();
      const normalizedFrequency = editFrequency.trim();
      const normalizedDuration = editDuration.trim();
      const updatedStartDate = applyTimeToIso(item.startDate, editIntakeTime);

      const meds = item.event.extractedData.medications || [];
      // Encontrar índice de la medicación en el evento
      const idx = Number(item.id.split("-").at(-1)) || 0;
      const updatedMeds = meds.map((m, i) =>
        i === idx
          ? {
              ...m,
              dosage: normalizedDosage || m.dosage,
              frequency: normalizedFrequency || m.frequency,
              duration: normalizedDuration || m.duration,
            }
          : m
      );
      await updateEvent(item.event.id, {
        extractedData: {
          ...item.event.extractedData,
          eventDate: updatedStartDate,
          medications: updatedMeds,
        },
      });

      const linkedMedications = activeMedications.filter(
        (medication) =>
          medication.active &&
          medication.generatedFromEventId === item.event.id &&
          cleanText(medication.name).toLowerCase() === cleanText(item.medicationName).toLowerCase()
      );

      const fallbackLinkedMedications =
        linkedMedications.length > 0
          ? linkedMedications
          : activeMedications.filter(
              (medication) => medication.active && medication.generatedFromEventId === item.event.id
            );

      const finalFrequency =
        normalizedFrequency ||
        (item.frequency === "Frecuencia no especificada" ? "" : item.frequency);
      const finalDosage =
        normalizedDosage || (item.dosage === "Según receta" ? "" : item.dosage);
      const finalDuration =
        normalizedDuration || (item.duration === "Sin duración definida" ? "" : item.duration);
      const computedEndDate = computeEndDateFromDuration(updatedStartDate, finalDuration);

      let remindersScheduled = 0;

      for (const medication of fallbackLinkedMedications) {
        await updateMedication(medication.id, {
          dosage: finalDosage || medication.dosage,
          frequency: finalFrequency || medication.frequency,
          startDate: updatedStartDate,
          endDate: finalDuration ? computedEndDate : medication.endDate,
        });

        if (activePet && finalFrequency) {
          await NotificationService.scheduleMedicationReminders({
            petId: medication.petId,
            petName: activePet.name,
            medicationName: medication.name,
            dosage: finalDosage || medication.dosage || "Según receta",
            frequency: finalFrequency,
            startDate: updatedStartDate,
            endDate: finalDuration ? computedEndDate : medication.endDate,
            sourceEventId: item.event.id,
            sourceMedicationId: medication.id,
          });
          remindersScheduled += 1;
        }
      }

      if (activePet && finalFrequency && fallbackLinkedMedications.length === 0) {
        await NotificationService.scheduleMedicationReminders({
          petId: item.event.petId,
          petName: activePet.name,
          medicationName: item.medicationName,
          dosage: finalDosage || "Según receta",
          frequency: finalFrequency,
          startDate: updatedStartDate,
          endDate: finalDuration ? computedEndDate : null,
          sourceEventId: item.event.id,
        });
        remindersScheduled += 1;
      }

      const feedbackMessage = remindersScheduled > 0
        ? "Horario actualizado. Creamos un recordatorio automático en tu celular."
        : "Horario actualizado. Si completás una frecuencia válida, activamos recordatorios automáticos.";
      onSaved(feedbackMessage);
    } finally {
      setSavingEdit(false);
    }
  };

  if (!isOpen || !item) return null;

  return (
    <>
      <div onClick={onClose}
        className="fixed inset-0 bg-black/60 z-50 animate-fadeIn" />
      <div className="fixed inset-x-0 bottom-0 z-50 bg-white dark:bg-slate-900 rounded-t-3xl p-6 shadow-xl animate-slideUp">
          <div className="w-10 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mb-5" />
          <h3 className="text-lg font-black text-slate-900 dark:text-white mb-1">{item.medicationName}</h3>
          <p className="text-xs text-slate-500 mb-5">Editá los datos que quieras corregir</p>

          <div className="space-y-3">
            <label className="block">
              <span className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1 block">Dosis</span>
              <input value={editDosage} onChange={(e) => setEditDosage(e.target.value)}
                placeholder={item.dosage}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#074738]" />
            </label>
            <label className="block">
              <span className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1 block">Frecuencia</span>
              <input value={editFrequency} onChange={(e) => setEditFrequency(e.target.value)}
                placeholder={item.frequency}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#074738]" />
            </label>
            <label className="block">
              <span className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1 block">Duración</span>
              <input value={editDuration} onChange={(e) => setEditDuration(e.target.value)}
                placeholder={item.duration}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#074738]" />
            </label>
            <label className="block">
              <span className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1 block">Hora base de toma</span>
              <input
                type="time"
                value={editIntakeTime}
                onChange={(e) => setEditIntakeTime(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#074738]"
              />
              <span className="text-[11px] text-slate-500 mt-1 block">
                Al guardar, PESSY reprograma recordatorios automáticos en tu celular.
              </span>
            </label>
          </div>

          <div className="flex gap-2 mt-5">
            <button onClick={onClose}
              className="flex-1 py-3 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-600 dark:text-slate-400">
              Cancelar
            </button>
            <button onClick={saveEdit} disabled={savingEdit}
              className="flex-1 py-3 rounded-xl bg-[#074738] text-white text-sm font-bold disabled:opacity-60">
              {savingEdit ? "Guardando..." : "Guardar cambios"}
            </button>
          </div>
        </div>
      </>
  );
}
