import React from 'react';
import { MaterialIcon } from '../shared/MaterialIcon';

interface PessyTipProps {
  icon: string;
  color: 'green' | 'blue' | 'orange';
  title: string;
  description: string;
}

const colorStyles = {
  green: {
    bg: 'bg-[#eef8f3]',
    text: 'text-[#074738]',
  },
  blue: {
    bg: 'bg-[#E3F2FD]',
    text: 'text-[#1565C0]',
  },
  orange: {
    bg: 'bg-[#FFF3E0]',
    text: 'text-[#E65100]',
  },
};

export default function PessyTip({ icon, color, title, description }: PessyTipProps) {
  const styles = colorStyles[color];

  return (
    <div
      className="flex flex-row items-start gap-[10px] bg-white rounded-[14px] border border-[#eef0ee]"
      style={{ padding: '12px 14px' }}
    >
      {/* Icon container */}
      <div
        className={`flex items-center justify-center shrink-0 w-[28px] h-[28px] rounded-[8px] ${styles.bg}`}
      >
        <MaterialIcon name={icon} className={`${styles.text} !text-[16px]`} />
      </div>

      {/* Text content */}
      <div className="flex flex-col min-w-0">
        <span
          className="text-[12px] font-[800] text-[#002f24] leading-tight"
        >
          {title}
        </span>
        <span
          className="text-[11px] text-[#5e716b] leading-tight mt-[2px]"
        >
          {description}
        </span>
      </div>
    </div>
  );
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3
      className="text-[11px] font-[800] text-[#9ca8a2] uppercase tracking-[0.14em]"
      style={{
        margin: '16px 16px 8px',
        fontFamily: "'Plus Jakarta Sans', sans-serif",
      }}
    >
      {children}
    </h3>
  );
}
