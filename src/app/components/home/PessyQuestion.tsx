/**
 * PessyQuestion — Cork asks the owner what Pessy doesn't know yet.
 *
 * Used when a personality topic (sleep_habits, training_level, etc.)
 * is unknown. After answering, the data saves to Firestore and future
 * tips are personalized based on the answer.
 *
 * Shows ONE question at a time. Never a survey.
 */

import { CorkMascot } from "../shared/CorkMascot";

interface Option {
  label: string;
  value: string;
  emoji?: string;
}

interface PessyQuestionProps {
  question: string;
  subtext?: string;
  options: Option[];
  onAnswer: (value: string) => void;
  saving?: boolean;
}

export default function PessyQuestion({ question, subtext, options, onAnswer, saving }: PessyQuestionProps) {
  return (
    <div
      className="bg-white rounded-2xl border border-[#E5E7EB] overflow-hidden"
      style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}
    >
      {/* Cork asks */}
      <div className="bg-[#F0FAF9] dark:bg-[#0D2B24] px-4 py-3 flex items-start gap-2.5">
        <CorkMascot size={32} />
        <div className="min-w-0">
          <p className="text-sm font-bold text-[#074738] dark:text-emerald-300 leading-snug">{question}</p>
          {subtext && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{subtext}</p>}
        </div>
      </div>

      {/* Answer buttons */}
      <div className={`p-3 flex gap-2 ${options.length > 2 ? "flex-wrap" : ""}`}>
        {options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onAnswer(opt.value)}
            disabled={saving}
            className="flex-1 min-w-[80px] py-3 rounded-2xl border-2 border-[#E5E7EB] flex flex-col items-center gap-1 disabled:opacity-50 active:scale-[0.97] transition-all hover:border-[#1A9B7D] hover:bg-[#F0FAF9]"
          >
            {opt.emoji && <span className="text-xl leading-none">{opt.emoji}</span>}
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300 text-center leading-tight">{opt.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
