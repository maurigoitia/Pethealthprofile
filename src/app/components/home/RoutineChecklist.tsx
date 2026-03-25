"use client";

import React from "react";

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
    <div
      className="rounded-[16px] border border-[#eef0ee] bg-white"
      style={{ padding: "14px 16px" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5">
          <span
            className="material-symbols-rounded text-[#002f24]"
            style={{ fontSize: 18 }}
          >
            {icon}
          </span>
          <span
            className="text-[13px] font-[800] text-[#002f24]"
          >
            {title}
          </span>
        </div>
        <span className="text-[13px] font-[800] text-[#1A9B7D]">
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
              className="flex items-center gap-2.5 w-full text-left"
            >
              {/* Checkbox */}
              <div
                className={`flex-shrink-0 flex items-center justify-center w-[22px] h-[22px] rounded-[6px] border-2 transition-colors ${
                  isDone
                    ? "bg-[#074738] border-[#074738]"
                    : "border-[#d4d8d6] bg-transparent"
                }`}
              >
                {isDone && (
                  <svg
                    width="12"
                    height="10"
                    viewBox="0 0 12 10"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M1 5L4.5 8.5L11 1.5"
                      stroke="white"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </div>

              {/* Label */}
              <span
                className={`text-[13px] transition-colors ${
                  isDone
                    ? "text-[#9ca8a2] line-through"
                    : "text-[#002f24]"
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
