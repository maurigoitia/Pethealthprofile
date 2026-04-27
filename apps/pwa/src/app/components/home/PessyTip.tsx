"use client";

import React, { useState } from "react";

interface PessyTipProps {
  icon: string;
  color: "green" | "orange" | "blue" | "red";
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

const COLOR_MAP: Record<string, { bg: string; border: string; text: string; accent: string }> = {
  green:  { bg: "bg-[#E0F2F1]", border: "border-[#1A9B7D]/20", text: "text-[#074738]", accent: "text-[#1A9B7D]" },
  orange: { bg: "bg-[#FEF3C7]", border: "border-[#F59E0B]/20", text: "text-[#92400E]", accent: "text-[#D97706]" },
  blue:   { bg: "bg-[#E0F2F1]", border: "border-[#1A9B7D]/20", text: "text-[#074738]", accent: "text-[#1A9B7D]" },
  red:    { bg: "bg-[#FEE2E2]", border: "border-[#EF4444]/20", text: "text-[#991B1B]", accent: "text-[#EF4444]" },
};

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[12px] font-bold text-[#9CA3AF] uppercase tracking-[0.14em] mx-4 mt-5 mb-3">
      {children}
    </h3>
  );
}

export default function PessyTip({ icon, color, title, description, actionLabel, onAction }: PessyTipProps) {
  const [expanded, setExpanded] = useState(false);
  const c = COLOR_MAP[color] || COLOR_MAP.green;

  return (
    <button
      onClick={() => setExpanded((v) => !v)}
      className={`w-full text-left rounded-3xl border ${c.border} ${c.bg} p-4 transition-all`}
    >
      <div className="flex items-start gap-3">
        <span className="text-xl shrink-0">{icon}</span>
        <div className="min-w-0 flex-1">
          <p className={`text-sm font-[800] ${c.text}`}>{title}</p>
          {!expanded && (
            <p className="text-[10px] text-[#9CA3AF] mt-0.5">Tocar para ver más</p>
          )}
          {expanded && (
            <>
              <p className={`text-xs ${c.text} opacity-80 mt-1 leading-relaxed`}>{description}</p>
              {actionLabel && onAction && (
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    onAction();
                  }}
                  className={`inline-block mt-2 text-xs font-bold ${c.accent} underline underline-offset-2`}
                >
                  {actionLabel} →
                </span>
              )}
            </>
          )}
        </div>
        <span className={`text-xs ${c.accent} shrink-0 mt-1`}>
          {expanded ? "▲" : "▼"}
        </span>
      </div>
    </button>
  );
}
