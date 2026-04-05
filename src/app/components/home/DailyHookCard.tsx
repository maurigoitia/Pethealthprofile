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
      className="relative overflow-hidden w-full p-4"
      style={{
        backgroundColor: "#074738",
        borderRadius: 16,
      }}
    >
      {/* Decorative blob overlays — pessy.app style */}
      <div
        className="absolute pointer-events-none pessy-blob"
        style={{
          width: 160,
          height: 160,
          backgroundColor: "rgba(26,155,125,0.2)",
          top: -40,
          right: -30,
        }}
      />
      <div
        className="absolute pointer-events-none pessy-blob"
        style={{
          width: 80,
          height: 80,
          backgroundColor: "rgba(80,72,202,0.15)",
          bottom: -20,
          left: -15,
          animationDelay: '3s',
          animationDuration: '15s',
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
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          {/* Duration pill */}
          <span
            className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-white/90 text-[10px] font-medium shrink-0"
            style={{ backgroundColor: "rgba(255,255,255,0.15)" }}
          >
            <MaterialIcon
              name="schedule"
              className="text-white/70 !text-[12px]"
            />
            {duration}
          </span>

          {/* Points */}
          <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-amber-300 shrink-0">
            <MaterialIcon
              name="star"
              className="text-amber-300 !text-[12px]"
              filled
            />
            +{points}
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
          className="shrink-0 px-4 py-2 bg-white text-[11px] font-bold active:scale-95 transition-transform hover:bg-[#E0F2F1]"
          style={{
            color: "#074738",
            borderRadius: 12,
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontWeight: 700,
          }}
        >
          Empezar
        </button>
      </div>
    </div>
  );
}
