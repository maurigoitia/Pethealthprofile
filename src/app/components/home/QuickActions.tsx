'use client';

import { CalendarDays, Pill, Clock, ChevronRight } from 'lucide-react';

interface QuickActionsProps {
  appointments: number;
  medications: number;
  historyCount: number;
  onAppointmentsClick: () => void;
  onMedicationsClick: () => void;
  onHistoryClick: () => void;
}

export default function QuickActions({
  appointments,
  medications,
  historyCount,
  onAppointmentsClick,
  onMedicationsClick,
  onHistoryClick,
}: QuickActionsProps) {
  if (appointments === 0 && medications === 0 && historyCount === 0) {
    return null;
  }

  const cards = [
    {
      Icon: CalendarDays,
      label: 'Turnos',
      value: appointments,
      hasAlert: false,
      onClick: onAppointmentsClick,
      iconBg: 'bg-[#E0F2F1]',
      iconColor: 'text-[#1A9B7D]',
    },
    {
      Icon: Pill,
      label: 'Medicación',
      value: medications,
      hasAlert: medications > 0,
      onClick: onMedicationsClick,
      iconBg: medications > 0 ? 'bg-[#FEF3C7]' : 'bg-[#EDE9FE]',
      iconColor: medications > 0 ? 'text-[#D97706]' : 'text-[#5048CA]',
    },
    {
      Icon: Clock,
      label: 'Historial',
      value: historyCount,
      hasAlert: false,
      onClick: onHistoryClick,
      iconBg: 'bg-[#FEE2E2]',
      iconColor: 'text-[#EF4444]',
    },
  ];

  return (
    <div className="mx-3 pessy-stagger">
      <div className="grid grid-cols-3 gap-2.5">
        {cards.map((card) => (
          <button
            key={card.label}
            onClick={card.onClick}
            aria-label={card.label}
            className={`pessy-card-interactive rounded-[16px] p-4 text-left border ${
              card.hasAlert
                ? 'border-[#F59E0B]/30 bg-[#FFFBEB]'
                : 'border-[rgba(0,0,0,0.04)] bg-white'
            } shadow-[0_2px_8px_rgba(0,0,0,0.04)]`}
          >
            <div className={`size-11 rounded-xl ${card.iconBg} flex items-center justify-center mb-3`}>
              <card.Icon size={20} strokeWidth={1.8} className={card.iconColor} />
            </div>
            <p
              className="text-[22px] font-[800] text-[#074738] leading-none"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            >
              {card.value}
            </p>
            <div className="flex items-center justify-between mt-1.5">
              <span
                className="text-[11px] font-bold text-[#6B7280]"
                style={{ fontFamily: "'Manrope', sans-serif" }}
              >
                {card.label}
              </span>
              <ChevronRight size={14} className="text-[#9CA3AF]" strokeWidth={2} />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
