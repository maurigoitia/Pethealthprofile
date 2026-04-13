"use client";

import React, { useState } from "react";
import { MaterialIcon } from "../shared/MaterialIcon";
import { isDailyActivityDone, markDailyActivityDone } from "../../utils/gamification";

interface DailyHookCardProps {
  category: string;
  categoryIcon: string;
  title: string;
  description: string;
  duration: string;
  points: number;
  steps?: string[];
  onStart?: (points: number) => void;
}

export default function DailyHookCard({
  category,
  categoryIcon,
  title,
  description,
  duration,
  points,
  steps,
  onStart,
}: DailyHookCardProps) {
  const [showSteps, setShowSteps] = useState(false);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());

  const allDone = steps ? completedSteps.size === steps.length : false;

  const toggleStep = (idx: number) => {
    setCompletedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  return (
    <div className="rounded-3xl bg-[#074738] p-5 text-white">
      {/* Category label */}
      <div className="flex items-center gap-1.5 mb-2">
        <MaterialIcon name={categoryIcon} className="text-white/60 !text-[14px]" />
        <span className="text-[10px] font-semibold tracking-wider uppercase text-white/60">
          {category}
        </span>
      </div>

      {/* Title */}
      <h3 className="text-[17px] font-[900] leading-snug mb-1">{title}</h3>

      {/* Description */}
      <p className="text-white/80 text-xs leading-relaxed mb-4">{description}</p>

      {/* Stepper — inline checklist */}
      {showSteps && steps && (
        <div className="mb-4 space-y-2">
          {allDone && (
            <div className="rounded-2xl bg-[#1A9B7D] px-3 py-2 text-center text-xs font-bold">
              ✅ Completado
            </div>
          )}
          {steps.map((step, idx) => (
            <button
              key={idx}
              onClick={() => toggleStep(idx)}
              className={`flex items-start gap-2 w-full text-left rounded-2xl px-3 py-2.5 transition-colors ${
                completedSteps.has(idx)
                  ? "bg-[#1A9B7D]/20 text-white/60 line-through"
                  : "bg-white/10 text-white"
              }`}
            >
              <span className="mt-0.5 shrink-0 text-sm">
                {completedSteps.has(idx) ? "☑️" : "⬜"}
              </span>
              <span className="text-xs leading-relaxed">{step}</span>
            </button>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 text-white/90 text-[11px] font-medium">
            <MaterialIcon name="schedule" className="text-white/70 !text-[13px]" />
            {duration}
          </span>
          <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-amber-300">
            <MaterialIcon name="star" className="text-amber-300 !text-[13px]" filled />
            +{points} pts
          </span>
        </div>

        {steps ? (
          <button
            onClick={() => setShowSteps((v) => !v)}
            className="rounded-full bg-white px-5 py-2 text-xs font-bold text-[#074738] active:scale-95 transition-transform"
          >
            {showSteps ? "Cerrar" : "Ver guía"}
          </button>
        ) : (
          <button
            onClick={() => {
              if (onStart && !isDailyActivityDone()) {
                markDailyActivityDone();
                onStart(points);
              }
            }}
            className="rounded-full bg-white px-5 py-2 text-xs font-bold text-[#074738] active:scale-95 transition-transform hover:bg-[#E0F2F1]"
          >
            Empezar
          </button>
        )}
      </div>
    </div>
  );
}
