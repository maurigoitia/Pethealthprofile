import { useState } from "react";
import { MaterialIcon } from "../shared/MaterialIcon";
import { usePet } from "../../contexts/PetContext";
import { useMedical } from "../../contexts/MedicalContext";
import { useReminders } from "../../contexts/RemindersContext";
import { downloadIcsEvent } from "../../utils/calendarExport";
import type { MedicationCardItem } from "./MedicationsScreen";

type DeleteStage = "confirm" | "after_options";

interface DeleteMedicationModalProps {
  isOpen: boolean;
  item: MedicationCardItem | null;
  onClose: () => void;
  onDeleted: () => void;
}

export function DeleteMedicationModal({ isOpen, item, onClose, onDeleted }: DeleteMedicationModalProps) {
  const { activePetId, activePet } = usePet();
  const { deleteEvent } = useMedical();
  const { addReminder } = useReminders();

  const [deleteStage, setDeleteStage] = useState<DeleteStage>("confirm");
  const [deletingInProgress, setDeletingInProgress] = useState(false);

  // Reset stage when item changes
  const [lastItemId, setLastItemId] = useState<string | null>(null);
  if (item && item.id !== lastItemId) {
    setLastItemId(item.id);
    setDeleteStage("confirm");
  }
  if (!item && lastItemId !== null) {
    setLastItemId(null);
  }

  const confirmDelete = async (targetItem: MedicationCardItem, withReminder: boolean, withCalendar: boolean) => {
    setDeletingInProgress(true);
    try {
      // Crear recordatorio en la app si eligió esa opción
      if (withReminder && activePetId) {
        await addReminder({
          id: `rem_${Date.now()}`,
          petId: activePetId,
          userId: targetItem.event.userId || "",
          type: "medication",
          title: `Verificar si retoma ${targetItem.medicationName}`,
          notes: "Recordatorio creado al eliminar tratamiento",
          dueDate: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
          dueTime: null,
          repeat: "none",
          completed: false,
          completedAt: null,
          dismissed: false,
          notifyEnabled: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }

      // Crear evento en calendario si eligió esa opción
      if (withCalendar && activePet) {
        downloadIcsEvent(
          {
            title: `Fin de tratamiento: ${targetItem.medicationName} — ${activePet.name}`,
            date: new Date().toISOString().slice(0, 10),
            time: "09:00",
            durationMinutes: 30,
            location: targetItem.provider,
            description: `Dosis: ${targetItem.dosage} · Frecuencia: ${targetItem.frequency}`,
          },
          `fin-tratamiento-${targetItem.medicationName.toLowerCase().replace(/\s+/g, "-")}.ics`
        );
      }

      await deleteEvent(targetItem.event.id);
      onDeleted();
    } finally {
      setDeletingInProgress(false);
    }
  };

  if (!isOpen || !item) return null;

  return (
    <>
      <div onClick={() => !deletingInProgress && onClose()}
        className="fixed inset-0 bg-black/60 z-50 animate-fadeIn" />
      <div className="fixed inset-x-0 bottom-0 z-50 bg-white dark:bg-slate-900 rounded-t-3xl p-6 shadow-xl animate-slideUp">
          <div className="w-10 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mb-5" />

          {deleteStage === "confirm" ? (
            <>
              <div className="flex items-center gap-3 mb-4">
                <div className="size-12 rounded-full bg-red-100 dark:bg-red-950/40 flex items-center justify-center shrink-0">
                  <MaterialIcon name="delete" className="text-2xl text-red-500" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">¿Eliminar tratamiento?</h3>
                  <p className="text-xs text-slate-500">{item.medicationName}</p>
                </div>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-5 leading-relaxed">
                Se va a mover a Historial. El documento original se mantiene en el Timeline.
              </p>
              <div className="flex gap-2">
                <button onClick={onClose}
                  className="flex-1 py-3 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-600 dark:text-slate-400">
                  Cancelar
                </button>
                <button onClick={() => setDeleteStage("after_options")}
                  className="flex-1 py-3 rounded-xl bg-red-500 text-white text-sm font-bold">
                  Sí, eliminar
                </button>
              </div>
            </>
          ) : (
            <>
              <h3 className="text-base font-black text-slate-900 dark:text-white mb-1">¿Querés crear un registro?</h3>
              <p className="text-sm text-slate-500 mb-5">Antes de eliminarlo, podés dejar un recordatorio o anotarlo en el calendario.</p>

              <div className="space-y-2 mb-5">
                <button
                  onClick={() => confirmDelete(item, true, false)}
                  disabled={deletingInProgress}
                  className="w-full py-3.5 rounded-xl border border-[#074738]/30 bg-[#074738]/5 text-[#074738] text-sm font-bold flex items-center gap-2 justify-center disabled:opacity-60">
                  <MaterialIcon name="notifications" className="text-lg" />
                  Crear recordatorio en PESSY
                </button>
                <button
                  onClick={() => confirmDelete(item, false, true)}
                  disabled={deletingInProgress}
                  className="w-full py-3.5 rounded-xl border border-emerald-200 bg-[#F0FAF9] dark:bg-emerald-950/30 dark:border-emerald-900/50 text-emerald-700 dark:text-emerald-400 text-sm font-bold flex items-center gap-2 justify-center disabled:opacity-60">
                  <MaterialIcon name="event" className="text-lg" />
                  Agregar al calendario (.ics)
                </button>
                <button
                  onClick={() => confirmDelete(item, false, false)}
                  disabled={deletingInProgress}
                  className="w-full py-3 rounded-xl text-slate-500 text-sm font-bold disabled:opacity-60">
                  {deletingInProgress ? "Eliminando..." : "Eliminar sin crear registro"}
                </button>
              </div>
            </>
          )}
        </div>
      </>
  );
}
