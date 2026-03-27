'use client';

import React from 'react';
import { MaterialIcon } from "../shared/MaterialIcon";

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
  // Don't render for new users with no data
  if (appointments === 0 && medications === 0 && historyCount === 0) {
    return null;
  }

  const cards = [
    {
      icon: 'calendar_month',
      label: 'Turnos',
      value: appointments,
      hasAlert: false,
      onClick: onAppointmentsClick,
    },
    {
      icon: 'medication',
      label: 'Medicación',
      value: medications,
      hasAlert: medications > 0,
      onClick: onMedicationsClick,
    },
    {
      icon: 'history',
      label: 'Historial',
      value: historyCount,
      hasAlert: false,
      onClick: onHistoryClick,
    },
  ];

  return (
    <div className="flex flex-row mx-3 gap-2">
      {cards.map((card) => (
        <button
          key={card.label}
          onClick={card.onClick}
          className={`flex-1 rounded-[16px] py-4 px-3 text-center border cursor-pointer transition-colors hover:shadow-md ${
            card.hasAlert
              ? 'border-[#F59E0B] bg-[#FEF3C7]'
              : 'border-[#E5E7EB] bg-white'
          }`}
        >
          <span style={{ color: card.hasAlert ? '#D97706' : '#074738' }}>
            <MaterialIcon name={card.icon} className={`!text-[24px] block`} />
          </span>
          <span
            className="block text-[10px] font-bold mt-2"
            style={{ color: '#6B7280', fontFamily: "'Manrope', sans-serif" }}
          >
            {card.label}
          </span>
          <span
            className="block text-[18px] mt-1 font-bold"
            style={{
              color: '#074738',
              fontFamily: "'Plus Jakarta Sans', sans-serif",
            }}
          >
            {card.value}
          </span>
        </button>
      ))}
    </div>
  );
}
