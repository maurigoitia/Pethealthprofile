import React, { useState } from 'react';
import {
  Lightbulb, AlertTriangle, ShieldAlert, Thermometer, Droplets,
  Wind, CloudRain, Dog, Heart, Activity, Utensils, Star,
} from 'lucide-react';
import { MaterialIcon } from '../shared/MaterialIcon';
import { addPoints } from '../../utils/gamification';

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
  // Mission mode — turns the tip into a completable quest
  isMission?: boolean;
  missionPoints?: number;
  onMissionComplete?: (earnedTotal: number) => void;
}

const colorStyles = {
  green: { bg: 'bg-[#E0F2F1]', text: 'text-[#074738]' },
  blue:  { bg: 'bg-[#E3F2FD]', text: 'text-[#3B82F6]' },
  orange:{ bg: 'bg-[#FEF3C7]', text: 'text-[#D97706]' },
};

export default function PessyTip({ icon, color, title, description, isMission, missionPoints = 15, onMissionComplete }: PessyTipProps) {
  const styles = colorStyles[color];
  const [completed, setCompleted] = useState(false);

  const handleComplete = () => {
    if (completed) return;
    setCompleted(true);
    const total = addPoints(missionPoints);
    onMissionComplete?.(total);
  };

  return (
    <div
      className={`bg-white rounded-[16px] border transition-all ${completed ? 'border-[#1A9B7D]' : 'border-[#E5E7EB]'}`}
      style={{ padding: '14px 16px', boxShadow: completed ? '0 0 0 1px #1A9B7D20' : undefined }}
    >
      <div className="flex flex-row items-start gap-3">
        {/* Icon container */}
        <div className={`flex items-center justify-center shrink-0 w-[32px] h-[32px] rounded-[10px] ${styles.bg}`}>
          {isMission
            ? <span className="text-[16px] leading-none">🔍</span>
            : LUCIDE_MAP[icon]
              ? React.createElement(LUCIDE_MAP[icon], { size: 18, strokeWidth: 1.8, className: styles.text })
              : <MaterialIcon name={icon} className={`${styles.text} !text-[18px]`} />
          }
        </div>

        {/* Text content */}
        <div className="flex flex-col min-w-0 flex-1">
          <span className="text-[13px] font-bold text-[#1A1A1A] leading-tight" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            {isMission && !completed && <span className="text-[#1A9B7D]">Misión: </span>}
            {completed ? '✓ ' : ''}{title}
          </span>
          <span className="text-[12px] text-[#6B7280] leading-snug mt-1" style={{ fontFamily: "'Manrope', sans-serif" }}>
            {description}
          </span>

          {/* Mission complete button */}
          {isMission && !completed && (
            <button
              onClick={handleComplete}
              className="mt-2 self-start px-3 py-1.5 rounded-full bg-[#074738] text-white text-[11px] font-bold active:scale-[0.96] transition-transform"
            >
              Completar · +{missionPoints} pts
            </button>
          )}
          {isMission && completed && (
            <span className="mt-1 text-[11px] font-bold text-[#1A9B7D]">+{missionPoints} pts ganados 🎉</span>
          )}
        </div>
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
