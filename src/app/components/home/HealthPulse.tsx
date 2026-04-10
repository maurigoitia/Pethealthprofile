"use client";

import React from "react";
import { Heart, Syringe, Pill, Calendar, AlertTriangle } from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface HealthPulseProps {
  petName: string;
  overdueVaccines: number;
  activeMedications: number;
  lastVetVisitDaysAgo: number | null;
  recurringConditions: string[];
  upcomingAppointments: number;
}

type PulseStatus = "great" | "attention" | "urgent";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function computeOverallStatus(props: HealthPulseProps): PulseStatus {
  if (props.overdueVaccines > 0) return "urgent";
  if (props.lastVetVisitDaysAgo !== null && props.lastVetVisitDaysAgo > 365) return "urgent";
  if (props.recurringConditions.length > 0) return "attention";
  if (props.activeMedications >= 3) return "attention";
  if (props.lastVetVisitDaysAgo !== null && props.lastVetVisitDaysAgo > 270) return "attention";
  return "great";
}

function formatLastVisit(daysAgo: number | null): string {
  if (daysAgo === null) return "Sin registro";
  if (daysAgo === 0) return "Hoy";
  if (daysAgo === 1) return "Ayer";
  if (daysAgo < 30) return `Hace ${daysAgo} días`;
  const months = Math.round(daysAgo / 30);
  if (months < 12) return `Hace ${months} mes${months > 1 ? "es" : ""}`;
  const years = Math.round(daysAgo / 365);
  return `Hace ${years} año${years > 1 ? "s" : ""}`;
}

const STATUS_CONFIG: Record<PulseStatus, { bg: string; border: string; dot: string; label: string; icon: React.ElementType }> = {
  great: { bg: "bg-[#E8F5E9]", border: "border-[#A5D6A7]", dot: "bg-[#4CAF50]", label: "Todo en orden", icon: Heart },
  attention: { bg: "bg-[#FFF8E1]", border: "border-[#FFE082]", dot: "bg-[#FFA726]", label: "Atención", icon: AlertTriangle },
  urgent: { bg: "bg-[#FFEBEE]", border: "border-[#EF9A9A]", dot: "bg-[#EF5350]", label: "Requiere acción", icon: AlertTriangle },
};

// ─── Component ───────────────────────────────────────────────────────────────

export default function HealthPulse(props: HealthPulseProps) {
  const { petName, overdueVaccines, activeMedications, lastVetVisitDaysAgo, recurringConditions, upcomingAppointments } = props;
  const status = computeOverallStatus(props);
  const config = STATUS_CONFIG[status];
  const StatusIcon = config.icon;

  // Don't render if there's zero medical data
  const hasAnyData = overdueVaccines > 0 || activeMedications > 0 || lastVetVisitDaysAgo !== null || recurringConditions.length > 0 || upcomingAppointments > 0;
  if (!hasAnyData) return null;

  return (
    <div className={`rounded-[16px] border ${config.border} ${config.bg} transition-colors`} style={{ padding: "14px 16px" }}>
      {/* Header: status dot + label */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`w-2.5 h-2.5 rounded-full ${config.dot}`} />
          <span
            className="text-[13px] font-[800] text-[#074738]"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          >
            Salud de {petName}
          </span>
        </div>
        <span className="text-[11px] font-[700] text-[#6B7280] uppercase tracking-wide">
          {config.label}
        </span>
      </div>

      {/* Indicators grid */}
      <div className="grid grid-cols-2 gap-2">
        {/* Vaccines */}
        <Indicator
          icon={Syringe}
          label="Vacunas"
          value={overdueVaccines > 0 ? `${overdueVaccines} vencida${overdueVaccines > 1 ? "s" : ""}` : "Al día"}
          alert={overdueVaccines > 0}
        />

        {/* Medications */}
        <Indicator
          icon={Pill}
          label="Tratamientos"
          value={activeMedications > 0 ? `${activeMedications} activo${activeMedications > 1 ? "s" : ""}` : "Ninguno"}
          alert={activeMedications >= 3}
        />

        {/* Last vet visit */}
        <Indicator
          icon={Heart}
          label="Última visita"
          value={formatLastVisit(lastVetVisitDaysAgo)}
          alert={lastVetVisitDaysAgo !== null && lastVetVisitDaysAgo > 365}
        />

        {/* Next appointment */}
        <Indicator
          icon={Calendar}
          label="Próximo turno"
          value={upcomingAppointments > 0 ? `${upcomingAppointments} agendado${upcomingAppointments > 1 ? "s" : ""}` : "Ninguno"}
          alert={false}
        />
      </div>

      {/* Recurring conditions note (only if any) */}
      {recurringConditions.length > 0 && (
        <div className="mt-2.5 pt-2.5 border-t border-[rgba(0,0,0,0.06)]">
          <p className="text-[11px] font-[600] text-[#6B7280]">
            Condiciones recurrentes: {recurringConditions.slice(0, 3).join(", ")}
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Sub-component ───────────────────────────────────────────────────────────

function Indicator({ icon: Icon, label, value, alert }: { icon: React.ElementType; label: string; value: string; alert: boolean }) {
  return (
    <div className="flex items-center gap-2 bg-white/60 rounded-[10px] px-2.5 py-2">
      <Icon
        size={16}
        strokeWidth={2}
        className={alert ? "text-[#EF5350]" : "text-[#074738]"}
      />
      <div className="min-w-0">
        <p className="text-[10px] font-[600] text-[#9CA3AF] leading-none">{label}</p>
        <p className={`text-[12px] font-[700] leading-tight mt-0.5 truncate ${alert ? "text-[#EF5350]" : "text-[#074738]"}`}>
          {value}
        </p>
      </div>
    </div>
  );
}
