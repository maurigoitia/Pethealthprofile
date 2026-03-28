import React from 'react';
import {
  Lightbulb, AlertTriangle, ShieldAlert, Thermometer, Droplets,
  Wind, CloudRain, Dog, Heart, Activity, Utensils, Star,
} from 'lucide-react';
import { MaterialIcon } from '../shared/MaterialIcon';

const LUCIDE_MAP: Record<string, React.ElementType> = {
  lightbulb: Lightbulb, tips_and_updates: Lightbulb,
  warning: AlertTriangle, report: ShieldAlert,
  thermostat: Thermometer, water_drop: Droplets,
  air: Wind, rainy: CloudRain,
  pets: Dog, favorite: Heart,
  fitness_center: Activity, restaurant: Utensils,
  star: Star,
};

interface PessyTipProps {
  icon: string;
  color: 'green' | 'blue' | 'orange';
  title: string;
  description: string;
}

const colorStyles = {
  green: {
    bg: 'bg-[#E0F2F1]',
    text: 'text-[#074738]',
  },
  blue: {
    bg: 'bg-[#E3F2FD]',
    text: 'text-[#3B82F6]',
  },
  orange: {
    bg: 'bg-[#FEF3C7]',
    text: 'text-[#D97706]',
  },
};

export default function PessyTip({ icon, color, title, description }: PessyTipProps) {
  const styles = colorStyles[color];

  return (
    <div
      className="flex flex-row items-start gap-3 bg-white rounded-[16px] border border-[#E5E7EB]"
      style={{ padding: '14px 16px' }}
    >
      {/* Icon container */}
      <div
        className={`flex items-center justify-center shrink-0 w-[32px] h-[32px] rounded-[10px] ${styles.bg}`}
      >
        {LUCIDE_MAP[icon]
          ? React.createElement(LUCIDE_MAP[icon], { size: 18, strokeWidth: 1.8, className: styles.text })
          : <MaterialIcon name={icon} className={`${styles.text} !text-[18px]`} />
        }
      </div>

      {/* Text content */}
      <div className="flex flex-col min-w-0">
        <span
          className="text-[13px] font-bold text-[#1A1A1A] leading-tight"
          style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
        >
          {title}
        </span>
        <span
          className="text-[12px] text-[#6B7280] leading-snug mt-1"
          style={{ fontFamily: "'Manrope', sans-serif" }}
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
      className="text-[12px] font-bold text-[#9CA3AF] uppercase tracking-[0.14em]"
      style={{
        margin: '20px 16px 12px',
        fontFamily: "'Plus Jakarta Sans', sans-serif",
        letterSpacing: '0.5px',
      }}
    >
      {children}
    </h3>
  );
}
