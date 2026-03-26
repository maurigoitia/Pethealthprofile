import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { MaterialIcon } from "../shared/MaterialIcon";
import { useReminders } from "../contexts/RemindersContext";
import { usePet } from "../contexts/PetContext";
import { ReminderType, ReminderRepeat } from "../types/medical";

interface AddReminderModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const TYPE_OPTIONS: { id: ReminderType; icon: string; label: string; color: string; bg: string }[] = [
  { id: "vaccine",     icon: "vaccines",         label: "Vacuna",           color: "text-emerald-600", bg: "bg-emerald-50" },
  { id: "medication",  icon: "medication",        label: "Medicación",       color: "text-amber-600",   bg: "bg-amber-50"   },
  { id: "checkup",     icon: "stethoscope",       label: "Control",          color: "text-[#074738]",   bg: "bg-emerald-50"    },
  { id: "grooming",    icon: "content_cut",       label: "Baño / Peluq.",    color: "text-emerald-600",  bg: "bg-emerald-50"  },
  { id: "deworming",   icon: "bug_report",        label: "Desparasitación",  color: "text-orange-600",  bg: "bg-orange-50"  },
  { id: "other",       icon: "event_note",        label: "Otro",             color: "text-slate-500",   bg: "bg-slate-50"   },
];

const REPEAT_OPTIONS: { id: ReminderRepeat; label: string }[] = [
  { id: "none",    label: "Sin repetición" },
  { id: "daily",   label: "Diario" },
  { id: "weekly",  label: "Semanal" },
  { id: "monthly", label: "Mensual" },
  { id: "yearly",  label: "Anual" },
];

export function AddReminderModal({ isOpen, onClose }: AddReminderModalProps) {
  const { addReminder } = useReminders();
  const { activePet } = usePet();

  const [type, setType] = useState<ReminderType>("vaccine");
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [dueTime, setDueTime] = useState("");
  const [repeat, setRepeat] = useState<ReminderRepeat>("none");
  const [notifyEnabled, setNotifyEnabled] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const selectedType = TYPE_OPTIONS.find(t => t.id === type)!;

  // Auto-título si está vacío al cambiar tipo
  const autoTitle = () => {
    if (!title) setTitle(selectedType.label);
  };

  const resetForm = () => {
    setType("vaccine"); setTitle(""); setNotes("");
    setDueDate(""); setDueTime(""); setRepeat("none");
    setNotifyEnabled(true); setError("");
  };

  const handleClose = () => { resetForm(); onClose(); };

  const handleSave = async () => {
    if (!activePet) return;
    if (!title.trim()) { setError("Agregá un título"); return; }
    if (!dueDate) { setError("Elegí una fecha"); return; }

    setSaving(true);
    setError("");
    try {
      await addReminder({
        petId: activePet.id,
        type,
        title: title.trim(),
        notes: notes.trim() || null,
        dueDate,
        dueTime: dueTime || null,
        repeat,
        notifyEnabled,
      });
      handleClose();
    } catch {
      setError("No se pudo guardar. Intentá de nuevo.");
    } finally {
      setSaving(false);
    }
  };

  // Fecha mínima = hoy
  const today = new Date().toISOString().slice(0, 10);

  // Sugerir fecha según tipo
  const suggestDate = (t: ReminderType) => {
    const d = new Date();
    if (t === "vaccine")    d.setMonth(d.getMonth() + 6);
    if (t === "checkup")    d.setMonth(d.getMonth() + 3);
    if (t === "deworming")  d.setMonth(d.getMonth() + 3);
    if (t === "grooming")   d.setDate(d.getDate() + 30);
    if (t === "medication")  return;
    if (t === "other")       return;
    setDueDate(d.toISOString().slice(0, 10));
  };

  if (!isOpen) return null;

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-40 bg-slate-900/60" onClick={handleClose} />

      <motion.div
        initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
        className="fixed inset-x-0 bottom-0 z-50 bg-white dark:bg-slate-900 rounded-t-3xl shadow-xl max-h-[92vh] flex flex-col max-w-md mx-auto"
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-slate-200 dark:bg-slate-700 cursor-pointer" onClick={handleClose} />
        </div>

        {/* Header */}
        <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3">
          <div className={`size-10 rounded-xl flex items-center justify-center ${selectedType.bg}`}>
            <MaterialIcon name={selectedType.icon} className={`text-xl ${selectedType.color}`} />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-black text-slate-900 dark:text-white">Nuevo recordatorio</h2>
            <p className="text-xs text-slate-500">{activePet?.name}</p>
          </div>
          <button onClick={handleClose} className="size-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
            <MaterialIcon name="close" className="text-slate-500 text-lg" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* Tipo */}
          <div>
            <p className="text-xs font-black uppercase tracking-wider text-slate-400 mb-2">Tipo</p>
            <div className="grid grid-cols-3 gap-2">
              {TYPE_OPTIONS.map(opt => (
                <button key={opt.id}
                  onClick={() => { setType(opt.id); suggestDate(opt.id); }}
                  className={`p-3 rounded-2xl border-2 flex flex-col items-center gap-1.5 transition-all ${
                    type === opt.id
                      ? `border-current ${opt.bg} ${opt.color}`
                      : "border-slate-200 dark:border-slate-700 text-slate-500"
                  }`}>
                  <MaterialIcon name={opt.icon} className="text-2xl" />
                  <span className="text-[10px] font-bold leading-tight text-center">{opt.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Título */}
          <div>
            <p className="text-xs font-black uppercase tracking-wider text-slate-400 mb-2">Título</p>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              onFocus={autoTitle}
              placeholder={`Ej: ${selectedType.label} de ${activePet?.name || "tu mascota"}`}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 text-sm font-medium focus:outline-none focus:border-[#074738]"
            />
          </div>

          {/* Fecha y hora */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-wider text-slate-400 mb-2">Fecha *</p>
              <input type="date" value={dueDate} min={today}
                onChange={e => setDueDate(e.target.value)}
                className="w-full px-3 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-[#074738]"
              />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-wider text-slate-400 mb-2">Hora (opcional)</p>
              <input type="time" value={dueTime}
                onChange={e => setDueTime(e.target.value)}
                className="w-full px-3 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-[#074738]"
              />
            </div>
          </div>

          {/* Repetición */}
          <div>
            <p className="text-xs font-black uppercase tracking-wider text-slate-400 mb-2">Repetición</p>
            <div className="flex gap-2 flex-wrap">
              {REPEAT_OPTIONS.map(opt => (
                <button key={opt.id} onClick={() => setRepeat(opt.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    repeat === opt.id
                      ? "bg-[#074738] text-white"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                  }`}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Notas */}
          <div>
            <p className="text-xs font-black uppercase tracking-wider text-slate-400 mb-2">Notas (opcional)</p>
            <textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Ej: Llevar carnet de vacunación"
              className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 text-sm resize-none focus:outline-none focus:border-[#074738]"
            />
          </div>

          {/* Notificación */}
          <div className="flex items-center justify-between py-3 px-4 bg-slate-50 dark:bg-slate-800 rounded-xl">
            <div className="flex items-center gap-3">
              <MaterialIcon name="notifications" className="text-[#074738] text-xl" />
              <div>
                <p className="text-sm font-bold text-slate-900 dark:text-white">Recordarme</p>
                <p className="text-xs text-slate-500">Push notification el día indicado</p>
              </div>
            </div>
            <button onClick={() => setNotifyEnabled(v => !v)}
              className={`w-12 h-6 rounded-full transition-all ${notifyEnabled ? "bg-[#074738]" : "bg-slate-300 dark:bg-slate-600"}`}>
              <div className={`size-5 bg-white rounded-full shadow transition-transform ${notifyEnabled ? "translate-x-6" : "translate-x-0.5"}`} />
            </button>
          </div>

          {error && (
            <p className="text-sm text-red-600 font-medium text-center">{error}</p>
          )}
        </div>

        {/* Botón guardar */}
        <div className="px-5 pb-8 pt-3 border-t border-slate-100 dark:border-slate-800">
          <button onClick={handleSave} disabled={saving}
            className="w-full h-14 rounded-2xl bg-[#074738] text-white font-bold text-base flex items-center justify-center gap-2 shadow-lg shadow-[#074738]/25 disabled:opacity-60 active:scale-[0.98] transition-transform">
            {saving
              ? <><div className="size-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /><span>Guardando...</span></>
              : <><MaterialIcon name="check_circle" className="text-xl" /><span>Guardar recordatorio</span></>}
          </button>
        </div>
      </motion.div>
    </>
  );
}
