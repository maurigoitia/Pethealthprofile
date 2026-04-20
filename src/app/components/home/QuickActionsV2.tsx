/**
 * QuickActionsV2 — action-oriented quick actions for the Home screen.
 *
 * Instead of passive counters, this shows ACTION buttons that let the user
 * immediately do something. Also shows a pending reviews badge when there
 * are email ingestion items awaiting confirmation.
 */
import { useNavigate } from "react-router";
import {
  CalendarPlus,
  FileUp,
  Stethoscope,
  MapPin,
  AlertCircle,
  Pill,
} from "lucide-react";
import { useAppLayout } from "../layout/AppLayout";

interface QuickActionsV2Props {
  /** Number of pending review items from email ingestion */
  pendingReviewCount?: number;
  /** Number of upcoming appointments */
  upcomingAppointments?: number;
  /** Number of active medications */
  activeMedications?: number;
}

export function QuickActionsV2({
  pendingReviewCount = 0,
  upcomingAppointments = 0,
  activeMedications = 0,
}: QuickActionsV2Props) {
  const navigate = useNavigate();
  const { openScanner } = useAppLayout();

  return (
    <div className="mx-4 space-y-3">
      {/* ── Pending reviews banner ── */}
      {pendingReviewCount > 0 && (
        <button
          onClick={() => navigate("/historial")}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl bg-[#FEF3C7] border border-[#F59E0B]/30 text-left transition-all active:scale-[0.98]"
        >
          <div className="size-10 rounded-xl bg-[#F59E0B]/20 flex items-center justify-center shrink-0">
            <AlertCircle size={20} className="text-[#D97706]" strokeWidth={2} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-[#92400E]">
              {pendingReviewCount === 1
                ? "1 registro necesita tu confirmacion"
                : `${pendingReviewCount} registros necesitan tu confirmacion`}
            </p>
            <p className="text-xs text-[#B45309] mt-0.5">
              De correos procesados por Pessy
            </p>
          </div>
          <div className="size-6 rounded-full bg-[#F59E0B] text-white flex items-center justify-center text-xs font-black shrink-0">
            {pendingReviewCount > 9 ? "9+" : pendingReviewCount}
          </div>
        </button>
      )}

      {/* ── Action buttons grid ── */}
      <div className="grid grid-cols-2 gap-3">
        <ActionButton
          icon={<CalendarPlus size={22} strokeWidth={1.8} />}
          label="Agregar turno"
          sublabel={upcomingAppointments > 0 ? `${upcomingAppointments} próximo${upcomingAppointments > 1 ? "s" : ""}` : undefined}
          onClick={() => navigate("/turnos")}
          iconBg="bg-[#E0F2F1]"
          iconColor="text-[#1A9B7D]"
        />
        <ActionButton
          icon={<FileUp size={22} strokeWidth={1.8} />}
          label="Subir documento"
          onClick={openScanner}
          iconBg="bg-[#EDE9FE]"
          iconColor="text-[#5048CA]"
        />
        <ActionButton
          icon={<Pill size={22} strokeWidth={1.8} />}
          label="Tratamientos"
          sublabel={activeMedications > 0 ? `${activeMedications} activo${activeMedications > 1 ? "s" : ""}` : "Ver todos"}
          onClick={() => navigate("/tratamientos")}
          iconBg="bg-[#E0F2F1]"
          iconColor="text-[#1A9B7D]"
        />
        <ActionButton
          icon={<Stethoscope size={22} strokeWidth={1.8} />}
          label="Ver historial"
          onClick={() => navigate("/historial")}
          iconBg="bg-[#F0F0FF]"
          iconColor="text-[#5048CA]"
        />
      </div>
    </div>
  );
}

// ── Internal action button ──

function ActionButton({
  icon,
  label,
  sublabel,
  onClick,
  iconBg,
  iconColor,
}: {
  icon: React.ReactNode;
  label: string;
  sublabel?: string;
  onClick: () => void;
  iconBg: string;
  iconColor: string;
}) {
  return (
    <button
      onClick={onClick}
      className="rounded-[16px] p-4 text-left border border-[#E5E7EB] bg-white transition-all active:scale-[0.97] hover:border-[#1A9B7D]/30 min-h-[88px]"
    >
      <div className={`size-11 rounded-[12px] ${iconBg} flex items-center justify-center mb-2.5`}>
        <span className={iconColor}>{icon}</span>
      </div>
      <p className="text-[14px] font-bold text-[#074738] leading-tight">{label}</p>
      {sublabel && (
        <p className="text-[12px] text-[#6B7280] mt-0.5 font-medium">{sublabel}</p>
      )}
    </button>
  );
}
