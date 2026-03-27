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
    <div className="flex flex-row mx-3 gap-1.5">
      {cards.map((card) => (
        <button
          key={card.label}
          onClick={card.onClick}
          className={`flex-1 rounded-[14px] py-3 px-2 text-center border cursor-pointer transition-colors ${
            card.hasAlert
              ? 'border-[#FFB74D] bg-[#FFF8E1]'
              : 'border-[#eef0ee] bg-white'
          }`}
        >
          <span style={{ color: card.hasAlert ? '#E65100' : '#074738' }}>
            <MaterialIcon name={card.icon} className={`!text-[22px] block`} />
          </span>
          <span
            className="block text-[10px] font-bold mt-1"
            style={{ color: '#5e716b' }}
          >
            {card.label}
          </span>
          <span
            className="block text-[16px] mt-0.5"
            style={{
              color: '#074738',
              fontWeight: 900,
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
