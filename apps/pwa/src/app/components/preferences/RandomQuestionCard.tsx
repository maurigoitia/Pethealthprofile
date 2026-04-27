/**
 * RandomQuestionCard
 *
 * A single micro-question that slides in during low-activity moments.
 * Follows PESSY design: Plano tokens, CSS transitions (no framer-motion), 44×44 touch targets.
 *
 * Usage:
 *   <RandomQuestionCard
 *     question={question}
 *     petName="Luna"
 *     onAnswer={(questionId, answer, tag) => { ... }}
 *     onDismiss={() => { ... }}
 *   />
 */

import { useState } from "react";
import type { RandomQuestion } from "../../../domain/preferences/userPreference.contract";

interface Props {
  question: RandomQuestion;
  petName: string;
  onAnswer: (questionId: string, answer: string, tag: string) => void;
  onDismiss: () => void;
}

export default function RandomQuestionCard({ question, petName, onAnswer, onDismiss }: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const [animatingOut, setAnimatingOut] = useState(false);

  const displayText = question.text.replace("{petName}", petName);

  function handleSelect(value: string, tag: string) {
    setSelected(value);
    // Small delay so user sees their selection before card exits
    setTimeout(() => {
      setAnimatingOut(true);
      setTimeout(() => onAnswer(question.id, value, tag), 150);
    }, 300);
  }

  function handleDismiss() {
    setAnimatingOut(true);
    setTimeout(onDismiss, 150);
  }

  return (
    <div
      className={`mx-4 rounded-2xl bg-[#E0F2F1] p-4 shadow-sm ${
        animatingOut ? "opacity-0 translate-y-2" : "opacity-100 translate-y-0"
      }`}
      style={{ transition: "all 150ms ease" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-[#074738]/60 uppercase tracking-wide">
          Te queremos conocer
        </span>
        <button
          onClick={handleDismiss}
          className="w-[44px] h-[44px] flex items-center justify-center rounded-full text-[#074738]/40 hover:text-[#074738]/70"
          style={{ transition: "color 150ms ease" }}
          aria-label="Cerrar"
        >
          <span className="material-icons text-xl">close</span>
        </button>
      </div>

      {/* Question */}
      <p className="text-base font-semibold text-[#074738] mb-4 leading-snug">
        {displayText}
      </p>

      {/* Options */}
      <div className="flex flex-col gap-2">
        {question.options.map((opt) => {
          const isSelected = selected === opt.value;
          return (
            <button
              key={opt.value}
              onClick={() => handleSelect(opt.value, opt.tag)}
              disabled={selected !== null}
              className={`w-full min-h-[44px] px-4 py-3 rounded-2xl text-sm font-medium text-left ${
                isSelected
                  ? "bg-[#1A9B7D] text-white"
                  : "bg-white text-[#074738] hover:bg-[#1A9B7D]/10"
              } ${selected !== null && !isSelected ? "opacity-50" : ""}`}
              style={{ transition: "all 150ms ease" }}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      {/* Points hint */}
      <p className="text-xs text-[#074738]/40 mt-3 text-center">
        +8 puntos por responder
      </p>
    </div>
  );
}
