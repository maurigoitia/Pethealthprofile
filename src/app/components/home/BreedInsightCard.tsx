import React, { useState } from 'react';
import { Lightbulb, AlertTriangle, Heart, Activity, Utensils, Users } from 'lucide-react';
import { MaterialIcon } from '../shared/MaterialIcon';
import { getBreedInsight, type BreedInsight } from '../../../domain/intelligence/breedInsights';

const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  activity: { bg: 'bg-[#E0F2F1]', text: 'text-[#074738]' },
  health: { bg: 'bg-[#FEE2E2]', text: 'text-[#DC2626]' },
  nutrition: { bg: 'bg-[#FEF3C7]', text: 'text-[#D97706]' },
  behavior: { bg: 'bg-[#F0E7FF]', text: 'text-[#7C3AED]' },
  social: { bg: 'bg-[#E3F2FD]', text: 'text-[#3B82F6]' },
};

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  activity: Activity,
  health: Heart,
  nutrition: Utensils,
  behavior: Lightbulb,
  social: Users,
};

interface BreedInsightCardProps {
  petName: string;
  breed: string;
  ageMonths: number;
  onAction?: (actionType: string) => void;
  onDismiss?: () => void;
}

export default function BreedInsightCard({
  petName,
  breed,
  ageMonths,
  onAction,
  onDismiss,
}: BreedInsightCardProps) {
  const [isDismissed, setIsDismissed] = useState(false);

  const insight = getBreedInsight(breed, ageMonths, petName);

  // No hay insight relevante para esta raza/edad
  if (!insight || isDismissed) {
    return null;
  }

  const colorStyle = CATEGORY_COLORS[insight.category] || CATEGORY_COLORS.activity;
  const IconComponent = CATEGORY_ICONS[insight.category] || Lightbulb;

  const handleDismiss = () => {
    setIsDismissed(true);
    onDismiss?.();
  };

  const handleAction = () => {
    if (insight.actionType) {
      onAction?.(insight.actionType);
    }
  };

  return (
    <div
      className="bg-white rounded-[16px] border border-[#E5E7EB] transition-all"
      style={{ padding: '14px 16px' }}
    >
      <div className="flex flex-row items-start gap-3">
        {/* Icon container */}
        <div className={`flex items-center justify-center shrink-0 w-[32px] h-[32px] rounded-[10px] ${colorStyle.bg}`}>
          <IconComponent size={18} strokeWidth={1.8} className={colorStyle.text} />
        </div>

        {/* Text content */}
        <div className="flex flex-col min-w-0 flex-1">
          <span
            className="text-[13px] font-bold text-[#1A1A1A] leading-tight"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          >
            {insight.breed}
          </span>
          <span
            className="text-[12px] text-[#6B7280] leading-snug mt-1"
            style={{ fontFamily: "'Manrope', sans-serif" }}
          >
            {insight.insight}
          </span>

          {/* Question (optional) */}
          {insight.question && (
            <span
              className="text-[11px] text-[#9CA3AF] italic leading-snug mt-2"
              style={{ fontFamily: "'Manrope', sans-serif" }}
            >
              {insight.question}
            </span>
          )}

          {/* Action buttons */}
          {(insight.actionLabel || onDismiss) && (
            <div className="mt-3 flex flex-wrap gap-2">
              {insight.actionLabel && (
                <button
                  onClick={handleAction}
                  className="px-3 py-1.5 rounded-full bg-[#074738] text-white text-[11px] font-bold active:scale-[0.96] transition-transform"
                >
                  {insight.actionLabel}
                </button>
              )}
              {onDismiss && (
                <button
                  onClick={handleDismiss}
                  className="px-3 py-1.5 rounded-full border border-[#D1D5DB] text-[11px] font-bold text-[#6B7280] active:scale-[0.96] transition-transform"
                >
                  Descartar
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
