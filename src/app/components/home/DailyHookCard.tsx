"use client";

import React from "react";
import { MaterialIcon } from "../shared/MaterialIcon";
import { isDailyActivityDone, markDailyActivityDone } from "../../utils/gamification";

interface DailyHookCardProps {
  category: string;
  categoryIcon: string;
  title: string;
  description: string;
  duration: string;
  points: number;
  onStart?: (points: number) => void;
}

export default function DailyHookCard({
  category,
  categoryIcon,
  title,
  description,
  duration,
  points,
  onStart,
}: DailyHookCardProps) {
  return (
    <div
      className="relative overflow-hidden w-full p-5"
      style={{
        backgroundColor: "#074738",
        borderRadius: 18,
      }}
    >
      {/* Decorative circle overlay */}
      <div
        className="absolute pointer-events-none"
        style={{
          width: 140,
          height: 140,
          borderRadius: "50%",
          backgroundColor: "rgba(26,155,125,0.25)",
          top: -30,
          right: -20,
        }}
      />

      {/* Category label */}
      <div className="flex items-center gap-1.5 mb-3">
        <MaterialIcon
          name={categoryIcon}
          className="text-white/60 !text-[14px]"
        />
        <span
          className="text-[10px] font-semibold tracking-wider uppercase"
          style={{ color: "rgba(255,255,255,0.6)" }}
        >
          {category}
        </span>
      </div>

      {/* Title */}
      <h3
        className="text-white mb-1.5 leading-snug"
        style={{
          fontFamily: "'Plus Jakarta Sans', sans-serif",
          fontSize: 17,
          fontWeight: 900,
        }}
      >
        {title}
      </h3>

      {/* Description */}
      <p
        className="text-white/80 leading-relaxed mb-4"
        style={{ fontSize: 12 }}
      >
        {description}
      </p>

      {/* Footer */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Duration pill */}
          <span
            className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-white/90 text-[11px] font-medium"
            style={{ backgroundColor: "rgba(255,255,255,0.15)" }}
          >
            <MaterialIcon
              name="schedule"
              className="text-white/70 !text-[13px]"
            />
            {duration}
          </span>

          {/* Points */}
          <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-amber-300">
            <MaterialIcon
              name="star"
              className="text-amber-300 !text-[13px]"
              filled
            />
            +{points} pts
          </span>
        </div>

        {/* Start button */}
        <button
          onClick={() => {
            if (onStart && !isDailyActivityDone()) {
              markDailyActivityDone();
              onStart(points);
            }
          }}
          className="px-4 py-2 bg-white text-[13px] active:scale-95 transition-transform"
          style={{
            color: "#074738",
            borderRadius: 12,
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontWeight: 800,
          }}
        >
          Empezar actividad
        </button>
      </div>
    </div>
  );
}
