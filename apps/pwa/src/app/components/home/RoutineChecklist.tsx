"use client";

import React from "react";
import { MaterialIcon } from "../shared/MaterialIcon";

interface RoutineChecklistProps {
  title: string;
  icon: string;
  items: string[];
  checkedItems: string[];
  onToggle: (item: string) => void;
}

export default function RoutineChecklist({
  title,
  icon,
  items,
  checkedItems,
  onToggle,
}: RoutineChecklistProps) {
  const completedCount = checkedItems.length;
  const totalCount = items.length;

  return (
    <div className="rounded-3xl border border-[#c8d9d2] bg-white p-4 transition-all">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-[#074738]">
            <MaterialIcon name={icon} className="!text-[22px]" />
          </span>
          <span className="text-sm font-[800] text-[#074738]">
            {title}
          </span>
        </div>
        <span className="text-sm font-bold text-[#1A9B7D]">
          {completedCount}/{totalCount}
        </span>
      </div>

      {/* Items */}
      <div className="flex flex-col gap-2.5">
        {items.map((item) => {
          const isDone = checkedItems.includes(item);
          return (
            <button
              key={item}
              type="button"
              onClick={() => onToggle(item)}
              className="flex items-center gap-2.5 w-full text-left transition-opacity active:opacity-70"
            >
              {/* Checkbox */}
              <div
                className={`flex-shrink-0 flex items-center justify-center w-[22px] h-[22px] rounded-[6px] border-2 transition-all ${
                  isDone
                    ? "bg-[#074738] border-[#074738]"
                    : "border-[#c8d9d2] bg-transparent"
                }`}
              >
                {isDone && (
                  <MaterialIcon name="check" className="text-white !text-[16px] !font-bold" />
                )}
              </div>

              {/* Label */}
              <span
                className={`text-sm font-medium transition-colors ${
                  isDone
                    ? "text-[#6b8a7e] line-through"
                    : "text-[#074738]"
                }`}
              >
                {item}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
