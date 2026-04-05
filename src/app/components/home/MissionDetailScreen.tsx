import React, { useState, useEffect } from 'react';
import { CorkMascot } from '../shared/CorkMascot';
import { MISSIONS } from './missionData';

// ─── Circular Timer ───────────────────────────────────────────────────────────

function CircularTimer({ seconds, total }: { seconds: number; total: number }) {
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const progress = total > 0 ? (total - seconds) / total : 1;
  const offset = circumference * (1 - progress);

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width="100" height="100" viewBox="0 0 100 100" aria-hidden="true">
        <circle cx="50" cy="50" r={radius} fill="none" stroke="#E0F2F1" strokeWidth="8" />
        <circle
          cx="50" cy="50" r={radius}
          fill="none" stroke="#1A9B7D" strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{
            transform: 'rotate(-90deg)',
            transformOrigin: '50px 50px',
            transition: 'stroke-dashoffset 1s linear',
          }}
        />
      </svg>
      <span className="absolute text-2xl font-black text-[#074738]" aria-live="polite">
        {seconds}
      </span>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

interface MissionDetailScreenProps {
  missionCode: string;
  petName: string;
  onComplete: () => void;
  onClose: () => void;
}

export function MissionDetailScreen({
  missionCode,
  petName,
  onComplete,
  onClose,
}: MissionDetailScreenProps) {
  const mission = MISSIONS[missionCode];

  const [selectedLevelId, setSelectedLevelId] = useState(
    () => mission?.defaultLevelId ?? 'easy'
  );
  const [timerActive, setTimerActive] = useState(false);
  const [timerDone, setTimerDone] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number>(() => {
    const level = mission?.levels?.find(l => l.id === (mission?.defaultLevelId ?? 'easy'));
    return level?.timerSeconds ?? 5;
  });
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());
  const [showCelebration, setShowCelebration] = useState(false);

  const selectedLevel = mission?.levels?.find(l => l.id === selectedLevelId);
  const totalSeconds = selectedLevel?.timerSeconds ?? 5;

  // Reset timer when level changes
  useEffect(() => {
    if (selectedLevel) {
      setTimeLeft(selectedLevel.timerSeconds);
      setTimerActive(false);
      setTimerDone(false);
    }
  }, [selectedLevelId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Countdown
  useEffect(() => {
    if (!timerActive) return;
    if (timeLeft <= 0) {
      setTimerActive(false);
      setTimerDone(true);
      return;
    }
    const id = window.setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          setTimerActive(false);
          setTimerDone(true);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [timerActive, timeLeft]);

  // Auto-close celebration after 1.4s — parent handles points + Firestore persistence
  useEffect(() => {
    if (!showCelebration) return;
    const id = window.setTimeout(() => {
      onComplete();
    }, 1400);
    return () => window.clearTimeout(id);
  }, [showCelebration]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!mission) {
    return (
      <div className="fixed inset-0 z-50 bg-[#F0FAF9] flex items-center justify-center">
        <div className="text-center p-8">
          <p className="text-slate-600 text-sm">Misión no encontrada</p>
          <button
            onClick={onClose}
            className="mt-4 px-4 py-2 bg-[#074738] text-white rounded-full text-sm font-bold"
          >
            Volver
          </button>
        </div>
      </div>
    );
  }

  const allChecked =
    mission.type === 'checklist'
      ? (mission.checklist?.every(item => checkedItems.has(item.id)) ?? false)
      : true;

  const canComplete = mission.type === 'checklist' ? allChecked : true;

  const handleStartTimer = () => {
    setTimeLeft(totalSeconds);
    setTimerDone(false);
    setTimerActive(true);
  };

  const handleToggleChecklist = (id: string) => {
    setCheckedItems(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleTermine = () => {
    if (!canComplete) return;
    setShowCelebration(true);
  };

  const youtubeUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(mission.youtubeSearchQuery)}`;

  // ── Celebration overlay ──────────────────────────────────────────────────────
  if (showCelebration) {
    return (
      <div className="fixed inset-0 z-50 bg-[#F0FAF9] flex flex-col items-center justify-center p-8">
        <CorkMascot size={80} />
        <p className="mt-6 text-3xl font-black text-[#074738] text-center">
          🎉
        </p>
        <p className="mt-3 text-[15px] text-slate-600 text-center leading-relaxed max-w-xs">
          {mission.completionMessage(petName)}
        </p>
      </div>
    );
  }

  // ── Main screen ──────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 bg-[#F0FAF9] overflow-y-auto font-['Manrope',sans-serif]">
      {/* Sticky header */}
      <div className="sticky top-0 bg-[#F0FAF9]/95 backdrop-blur-sm border-b border-[#D7EFE9] px-4 py-3 flex items-center gap-3 z-10">
        <button
          onClick={onClose}
          className="size-9 rounded-full bg-white border border-[#D7EFE9] flex items-center justify-center active:scale-95 transition-transform shrink-0"
          aria-label="Volver"
        >
          <span className="material-symbols-outlined text-[#074738] text-xl">arrow_back</span>
        </button>
        <h1 className="flex-1 text-[15px] font-black text-[#074738] leading-tight line-clamp-1">
          {mission.title(petName)}
        </h1>
      </div>

      <div className="max-w-md mx-auto px-4 pb-32 space-y-3 pt-4">
        {/* Hero card */}
        <div className="bg-white rounded-[20px] border border-[#D7EFE9] p-5 text-center shadow-sm">
          <div className="text-4xl mb-2">{mission.heroEmoji}</div>
          <p className="text-[13px] text-slate-500 leading-relaxed">{mission.subtitle}</p>
        </div>

        {/* Steps — for steps_with_levels and timed_steps */}
        {(mission.type === 'steps_with_levels' || mission.type === 'timed_steps') && mission.steps && (
          <div className="space-y-2">
            {mission.steps.map((step, i) => (
              <div
                key={i}
                className="bg-white rounded-[16px] border border-[#E5E7EB] p-4 flex items-start gap-3 shadow-sm"
              >
                <div className="shrink-0 w-7 h-7 rounded-full bg-[#E0F2F1] flex items-center justify-center text-xs font-black text-[#074738]">
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{step.emoji}</span>
                    <span className="text-[14px] font-bold text-[#1A1A1A]">{step.text}</span>
                  </div>
                  {step.hint && (
                    <p className="text-[12px] text-slate-500 mt-1 leading-snug">{step.hint}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Level selector + timer — for steps_with_levels */}
        {mission.type === 'steps_with_levels' && mission.levels && (
          <div className="bg-white rounded-[20px] border border-[#D7EFE9] p-4 shadow-sm">
            <p className="text-[11px] font-bold text-[#9CA3AF] uppercase tracking-wider mb-3">
              Nivel de dificultad
            </p>
            <div className="grid grid-cols-3 gap-2">
              {mission.levels.map(level => (
                <button
                  key={level.id}
                  onClick={() => setSelectedLevelId(level.id)}
                  className={`rounded-[12px] p-3 border text-center transition-all active:scale-95 ${
                    selectedLevelId === level.id
                      ? 'border-[#1A9B7D] bg-[#E0F2F1]'
                      : 'border-[#E5E7EB] bg-white'
                  }`}
                >
                  <div className="text-xl mb-1">{level.badge}</div>
                  <div className="text-[12px] font-bold text-[#1A1A1A]">{level.label}</div>
                  <div className="text-[10px] text-slate-500 mt-0.5 leading-tight">
                    {level.description}
                  </div>
                </button>
              ))}
            </div>

            {/* Timer widget */}
            <div className="mt-4 flex flex-col items-center gap-3">
              {timerActive || timerDone ? (
                <>
                  <CircularTimer seconds={timeLeft} total={totalSeconds} />
                  {timerDone ? (
                    <div className="flex items-center gap-2">
                      <span className="text-[#1A9B7D] font-bold text-sm">¡Tiempo!</span>
                      <button
                        onClick={handleStartTimer}
                        className="px-3 py-1.5 rounded-full border border-[#1A9B7D] text-[#1A9B7D] text-[12px] font-bold active:scale-95"
                      >
                        Repetir
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        setTimerActive(false);
                        setTimeLeft(totalSeconds);
                        setTimerDone(false);
                      }}
                      className="text-[12px] text-slate-400 underline underline-offset-2"
                    >
                      Cancelar
                    </button>
                  )}
                </>
              ) : (
                <button
                  onClick={handleStartTimer}
                  className="w-full py-3 rounded-[12px] bg-[#E0F2F1] text-[#074738] font-bold text-sm active:scale-[0.98] transition-transform"
                >
                  ▶ Empezar timer — {totalSeconds}s
                </button>
              )}
            </div>
          </div>
        )}

        {/* Checklist — for checklist type */}
        {mission.type === 'checklist' && mission.checklist && (
          <div className="space-y-2">
            {mission.checklist.map(item => {
              const checked = checkedItems.has(item.id);
              return (
                <button
                  key={item.id}
                  onClick={() => handleToggleChecklist(item.id)}
                  className={`w-full bg-white rounded-[16px] border p-4 flex items-center gap-3 text-left transition-all active:scale-[0.98] shadow-sm ${
                    checked ? 'border-[#1A9B7D]' : 'border-[#E5E7EB]'
                  }`}
                >
                  <div
                    className={`shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                      checked ? 'border-[#1A9B7D] bg-[#1A9B7D]' : 'border-[#D1D5DB]'
                    }`}
                  >
                    {checked && (
                      <span className="text-white text-[10px] font-black leading-none">✓</span>
                    )}
                  </div>
                  <span className="text-xl shrink-0">{item.emoji}</span>
                  <span className="flex-1 text-[14px] font-semibold text-[#1A1A1A] leading-snug">
                    {item.text}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* YouTube link */}
        <a
          href={youtubeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 bg-white rounded-[16px] border border-[#E5E7EB] p-4 active:scale-[0.98] transition-transform shadow-sm"
        >
          <div className="shrink-0 w-10 h-10 rounded-[10px] bg-red-50 flex items-center justify-center">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="#FF0000" aria-hidden="true">
              <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-bold text-[#1A1A1A]">Ver video tutorial</p>
            <p className="text-[11px] text-slate-500 mt-0.5 truncate">{mission.youtubeSearchQuery}</p>
          </div>
          <span className="material-symbols-outlined text-slate-400 text-[18px] shrink-0">
            open_in_new
          </span>
        </a>
      </div>

      {/* Fixed bottom CTA */}
      <div className="fixed bottom-0 left-0 right-0 bg-[#F0FAF9]/95 backdrop-blur-sm border-t border-[#D7EFE9] p-4 safe-area-bottom">
        <div className="max-w-md mx-auto">
          {mission.type === 'checklist' && !allChecked && mission.checklist && (
            <p className="text-[12px] text-center text-slate-500 mb-2">
              Marcá todos los items para completar · {checkedItems.size}/{mission.checklist.length}
            </p>
          )}
          <button
            onClick={handleTermine}
            disabled={!canComplete}
            className={`w-full py-4 rounded-[16px] font-black text-[15px] transition-all ${
              canComplete
                ? 'bg-[#074738] text-white active:scale-[0.98] shadow-[0_4px_12px_rgba(26,155,125,0.3)]'
                : 'bg-[#E5E7EB] text-[#9CA3AF] cursor-not-allowed'
            }`}
          >
            Terminé
          </button>
        </div>
      </div>
    </div>
  );
}
