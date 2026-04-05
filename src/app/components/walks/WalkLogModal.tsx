import { useState } from "react";
import { X } from "lucide-react";
import { useWalks } from "../../contexts/WalkContext";

interface WalkLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  petId: string;
  petName: string;
}

export function WalkLogModal({ isOpen, onClose, petId, petName }: WalkLogModalProps) {
  const { addWalk } = useWalks();
  const [durationMinutes, setDurationMinutes] = useState<string>("30");
  const [distanceKm, setDistanceKm] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) return null;

  const handleSave = async () => {
    if (!durationMinutes || parseInt(durationMinutes) <= 0) {
      alert("La duración debe ser mayor a 0 minutos");
      return;
    }

    setIsSaving(true);
    try {
      addWalk({
        petId,
        date: new Date().toISOString(),
        durationMinutes: parseInt(durationMinutes),
        distanceKm: distanceKm ? parseFloat(distanceKm) : undefined,
        notes: notes.trim() || undefined,
      });

      // Reset form
      setDurationMinutes("30");
      setDistanceKm("");
      setNotes("");
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md mx-auto bg-white dark:bg-slate-900 rounded-t-3xl p-6 space-y-5 animate-in slide-in-from-bottom-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              Registrar paseo
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {petName}
            </p>
          </div>
          <button
            onClick={onClose}
            className="size-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            <X size={20} className="text-slate-600 dark:text-slate-300" />
          </button>
        </div>

        {/* Duration Input */}
        <div className="space-y-2">
          <label className="block text-sm font-bold text-slate-900 dark:text-white">
            Duración (minutos)
          </label>
          <input
            type="number"
            min="1"
            max="1000"
            value={durationMinutes}
            onChange={(e) => setDurationMinutes(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#074738]"
            placeholder="30"
          />
        </div>

        {/* Distance Input */}
        <div className="space-y-2">
          <label className="block text-sm font-bold text-slate-900 dark:text-white">
            Distancia (km) <span className="text-xs font-normal text-slate-500">— opcional</span>
          </label>
          <input
            type="number"
            min="0"
            step="0.1"
            max="100"
            value={distanceKm}
            onChange={(e) => setDistanceKm(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#074738]"
            placeholder="2.5"
          />
        </div>

        {/* Notes Input */}
        <div className="space-y-2">
          <label className="block text-sm font-bold text-slate-900 dark:text-white">
            Notas <span className="text-xs font-normal text-slate-500">— opcional</span>
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={150}
            className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#074738] resize-none"
            placeholder="Ej: Fue a jugar en el parque, vio otros perros..."
            rows={3}
          />
          <p className="text-xs text-slate-400">
            {notes.length}/150
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 pt-4">
          <button
            onClick={onClose}
            disabled={isSaving}
            className="flex-1 px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-bold text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex-1 px-4 py-3 rounded-xl bg-[#074738] text-white font-bold text-sm hover:bg-[#053729] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isSaving ? (
              <>
                <span className="inline-block w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                Guardando...
              </>
            ) : (
              "Registrar paseo"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
