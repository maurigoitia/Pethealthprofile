/**
 * VaccineAlertBanner — Connection Rule card
 *
 * Detected need: vaccine_due pending action
 * Pessy processes: finds most urgent, formats date
 * Next step: [Agendar turno] → opens NearbyVetsScreen
 *
 * "Vence el 15. Agendar con vet cercano → [Agendar]"
 */
import { useMemo, useState } from "react";
import { MaterialIcon } from "../shared/MaterialIcon";
import { useMedical } from "../../contexts/MedicalContext";
import { usePet } from "../../contexts/PetContext";

interface VaccineAlertBannerProps {
  petName: string;
  onOpenNearbyVets: () => void;
}

function formatDueDate(iso: string): string {
  try {
    const d = new Date(iso);
    const today = new Date();
    const diffDays = Math.ceil((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return "ya venció";
    if (diffDays === 0) return "vence hoy";
    if (diffDays === 1) return "vence mañana";
    if (diffDays <= 7) return `vence en ${diffDays} días`;

    const day = d.getDate();
    const months = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
    return `vence el ${day} de ${months[d.getMonth()]}`;
  } catch {
    return "próxima";
  }
}

function extractVaccineName(title: string): string {
  // title examples: "Llamar al vet — vacuna pendiente de Thor"
  // or just "Vacuna antirrábica"
  const match = title.match(/vacuna[^—]*(—|$)/i);
  if (match) {
    const clean = title.replace(/llamar al vet\s*—\s*/i, "").replace(/vacuna pendiente de \w+/i, "").trim();
    if (clean) return clean;
  }
  return "Vacuna pendiente";
}

const DISMISS_KEY_PREFIX = "pessy_vaccine_banner_dismissed_";

export function VaccineAlertBanner({ petName, onOpenNearbyVets }: VaccineAlertBannerProps) {
  const { activePetId } = usePet();
  const { getPendingActionsByPetId } = useMedical();
  const [dismissed, setDismissed] = useState(() => {
    try {
      const val = localStorage.getItem(`${DISMISS_KEY_PREFIX}${activePetId}`);
      if (!val) return false;
      // Dismiss expires after 24 hours
      const ts = parseInt(val, 10);
      return Date.now() - ts < 24 * 60 * 60 * 1000;
    } catch {
      return false;
    }
  });

  const urgentVaccine = useMemo(() => {
    const actions = getPendingActionsByPetId(activePetId);
    const vaccineActions = actions
      .filter((a) => a.type === "vaccine_due" && !a.completed)
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
    return vaccineActions[0] ?? null;
  }, [getPendingActionsByPetId, activePetId]);

  if (!urgentVaccine || dismissed) return null;

  const dueDateLabel = formatDueDate(urgentVaccine.dueDate);
  const isOverdue = new Date(urgentVaccine.dueDate) < new Date();

  const handleDismiss = () => {
    try {
      localStorage.setItem(`${DISMISS_KEY_PREFIX}${activePetId}`, String(Date.now()));
    } catch {
      // noop
    }
    setDismissed(true);
  };

  return (
    <div
      className={`mx-3 mt-4 rounded-[20px] overflow-hidden ${
        isOverdue
          ? "bg-red-50 border border-red-200"
          : "bg-amber-50 border border-amber-200"
      }`}
      style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}
    >
      {/* Accent bar */}
      <div className={`h-1 ${isOverdue ? "bg-red-500" : "bg-amber-400"}`} />

      <div className="p-4">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <div className={`size-8 rounded-full flex items-center justify-center shrink-0 ${
              isOverdue ? "bg-red-100" : "bg-amber-100"
            }`}>
              <MaterialIcon
                name="vaccines"
                className={`!text-lg ${isOverdue ? "text-red-600" : "text-amber-600"}`}
              />
            </div>
            <div>
              <p className={`text-[10px] font-black uppercase tracking-widest ${
                isOverdue ? "text-red-600" : "text-amber-600"
              }`}>
                {isOverdue ? "Vacuna vencida" : "Vacuna próxima"}
              </p>
              <p className="text-sm font-bold text-slate-800 leading-tight">
                {petName} · {dueDateLabel}
              </p>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="text-slate-400 hover:text-slate-600 transition-colors shrink-0 mt-0.5"
            aria-label="Cerrar"
          >
            <MaterialIcon name="close" className="!text-base" />
          </button>
        </div>

        {/* Vaccine name */}
        <p className="text-xs text-slate-600 mb-3 pl-10">
          {urgentVaccine.subtitle || urgentVaccine.title}
        </p>

        {/* CTA — the 1-tap action */}
        <button
          onClick={onOpenNearbyVets}
          className={`w-full py-3 rounded-[14px] flex items-center justify-center gap-2 font-bold text-sm text-white transition-all active:scale-[0.98] ${
            isOverdue
              ? "bg-red-500 hover:bg-red-600"
              : "bg-[#074738] hover:bg-[#053729]"
          }`}
        >
          <MaterialIcon name="local_hospital" className="!text-base" />
          Agendar turno con vet
        </button>
      </div>
    </div>
  );
}
