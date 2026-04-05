/**
 * LogrosScreen — Pantalla de Puntos, Nivel y Logros (Badges)
 *
 * Muestra:
 * - Nivel actual con barra de progreso al siguiente
 * - Racha de días activos
 * - Badges desbloqueados / bloqueados
 * - Historial reciente de puntos
 */

import { MaterialIcon } from "../shared/MaterialIcon";
import { useGamification } from "../../contexts/GamificationContext";
import { LEVEL_THRESHOLDS } from "../../../domain/gamification/gamification.contract";

interface LogrosScreenProps {
  onBack: () => void;
}

function LevelProgressBar({ level, totalPoints }: { level: number; totalPoints: number }) {
  const currentThreshold = LEVEL_THRESHOLDS[level] ?? 0;
  const nextThreshold = LEVEL_THRESHOLDS[level + 1] ?? LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1];
  const isMax = level >= LEVEL_THRESHOLDS.length - 1;
  const pointsInLevel = totalPoints - currentThreshold;
  const pointsNeeded = nextThreshold - currentThreshold;
  const progress = isMax ? 100 : Math.min(100, Math.round((pointsInLevel / pointsNeeded) * 100));

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
          Nivel {level}
        </span>
        {!isMax ? (
          <span className="text-xs text-slate-400">
            {totalPoints - currentThreshold} / {pointsNeeded} pts para Nivel {level + 1}
          </span>
        ) : (
          <span className="text-xs text-amber-500 font-bold">¡Nivel máximo!</span>
        )}
      </div>
      <div className="h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-[#1A9B7D] to-[#074738] rounded-full transition-all duration-700"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

const STREAK_LABEL: Record<number, string> = {
  0: "Sin racha aún",
  1: "¡Empezando!",
  3: "3 días seguidos 🔥",
  7: "¡Una semana! 🔥🔥",
  14: "¡Dos semanas! 🔥🔥🔥",
  30: "¡Un mes! 🏆",
};
function streakLabel(streak: number): string {
  const thresholds = Object.keys(STREAK_LABEL).map(Number).sort((a, b) => b - a);
  for (const t of thresholds) {
    if (streak >= t) return STREAK_LABEL[t].replace("3 días", `${streak} días`).replace("¡Una", `¡${streak}d —`).replace("¡Dos", `¡${streak}d —`).replace("¡Un", `¡${streak}d —`);
  }
  return `${streak} día${streak !== 1 ? "s" : ""} seguido${streak !== 1 ? "s" : ""} 🔥`;
}

const POINT_SOURCE_LABELS: Record<string, string> = {
  daily_checkin: "Check-in diario",
  complete_routine: "Rutina completada",
  answer_random_question: "Pregunta respondida",
  scan_document: "Documento escaneado",
  add_appointment: "Turno registrado",
  report_lost_pet: "Mascota perdida reportada",
  report_sighting: "Avistamiento reportado",
  verified_sighting: "Avistamiento verificado",
  publish_adoption: "Publicación de adopción",
  successful_adoption: "Adopción exitosa",
  share_lost_alert: "Alerta compartida",
  leave_place_review: "Reseña de lugar",
  confirmed_place_checkin: "Check-in en lugar",
};

export function LogrosScreen({ onBack }: LogrosScreenProps) {
  const { profile, totalPoints, level, streak, loading } = useGamification();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F0FAF9] dark:bg-[#101622] flex items-center justify-center">
        <div className="size-8 rounded-full border-4 border-[#074738]/20 border-t-[#074738] animate-spin" />
      </div>
    );
  }

  const badges = profile?.badges ?? [];
  const unlockedBadges = badges.filter((b) => b.unlockedAt != null);
  const lockedBadges = badges.filter((b) => b.unlockedAt == null);
  const recentPoints = profile?.recentPoints?.slice(0, 10) ?? [];

  return (
    <div className="bg-[#F0FAF9] dark:bg-[#101622] min-h-screen pb-24">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="sticky top-0 z-50 bg-[#F0FAF9]/80 dark:bg-[#101622]/80 backdrop-blur-md px-4 py-4 flex items-center justify-between border-b border-slate-200 dark:border-slate-800">
          <button
            onClick={onBack}
            aria-label="Volver"
            className="size-10 rounded-full bg-white dark:bg-slate-800 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors shadow-sm"
          >
            <MaterialIcon name="arrow_back" className="text-xl" />
          </button>
          <h1 className="text-lg font-extrabold tracking-tight text-slate-900 dark:text-white">
            Logros y puntos
          </h1>
          <div className="size-10" />
        </div>

        {/* Level card */}
        <div className="px-6 pt-6 pb-4">
          <div className="bg-gradient-to-br from-[#074738] to-[#1a9b7d] rounded-[24px] p-6 text-white shadow-xl shadow-[#074738]/30">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm font-medium text-white/70 mb-0.5">Nivel actual</p>
                <p className="text-5xl font-black">{level}</p>
                <p className="text-sm font-bold text-white/80 mt-1">{totalPoints} puntos totales</p>
              </div>
              <div className="size-20 rounded-full bg-white/20 flex items-center justify-center">
                <MaterialIcon name="star" className="text-4xl text-amber-300" />
              </div>
            </div>
            <LevelProgressBar level={level} totalPoints={totalPoints} />
          </div>
        </div>

        {/* Streak card */}
        <div className="px-6 mb-4">
          <div className="bg-white dark:bg-slate-900 rounded-[20px] border border-[#E5E7EB] dark:border-slate-800 p-4 flex items-center gap-4 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
            <div className="size-12 rounded-xl bg-orange-100 dark:bg-orange-950/30 flex items-center justify-center">
              <MaterialIcon name="local_fire_department" className="text-2xl text-orange-500" />
            </div>
            <div className="flex-1">
              <p className="font-extrabold text-slate-900 dark:text-white text-xl">{streak} días</p>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                {streak === 0 ? "Abrí la app todos los días para mantener tu racha" : `Racha activa · Mejor racha: ${profile?.streak.longestStreak ?? streak}`}
              </p>
            </div>
          </div>
        </div>

        {/* Badges — Unlocked */}
        {unlockedBadges.length > 0 && (
          <div className="px-6 mb-4">
            <h2 className="text-sm font-black text-slate-900 dark:text-white mb-3 flex items-center gap-2">
              <MaterialIcon name="emoji_events" className="text-amber-400" />
              Logros desbloqueados ({unlockedBadges.length})
            </h2>
            <div className="grid grid-cols-2 gap-3">
              {unlockedBadges.map((badge) => (
                <div
                  key={badge.id}
                  className="bg-white dark:bg-slate-900 rounded-[16px] border border-amber-200 dark:border-amber-800/30 p-4 flex flex-col items-center text-center shadow-[0_2px_8px_rgba(0,0,0,0.04)]"
                >
                  <div className="size-12 rounded-full bg-amber-50 dark:bg-amber-950/30 flex items-center justify-center mb-2">
                    <MaterialIcon name={badge.icon} className="text-2xl text-amber-500" />
                  </div>
                  <p className="text-sm font-black text-slate-900 dark:text-white mb-0.5">{badge.name}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-tight">{badge.description}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Badges — Locked */}
        {lockedBadges.length > 0 && (
          <div className="px-6 mb-4">
            <h2 className="text-sm font-black text-slate-500 dark:text-slate-400 mb-3 flex items-center gap-2">
              <MaterialIcon name="lock" className="text-slate-400" />
              Por desbloquear ({lockedBadges.length})
            </h2>
            <div className="grid grid-cols-2 gap-3">
              {lockedBadges.map((badge) => (
                <div
                  key={badge.id}
                  className="bg-white dark:bg-slate-900 rounded-[16px] border border-slate-200 dark:border-slate-800 p-4 flex flex-col items-center text-center opacity-50"
                >
                  <div className="size-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-2">
                    <MaterialIcon name={badge.icon} className="text-2xl text-slate-400" />
                  </div>
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-0.5">{badge.name}</p>
                  <p className="text-xs text-slate-400 leading-tight">{badge.description}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent points history */}
        {recentPoints.length > 0 && (
          <div className="px-6 mb-6">
            <h2 className="text-sm font-black text-slate-900 dark:text-white mb-3 flex items-center gap-2">
              <MaterialIcon name="history" className="text-[#1A9B7D]" />
              Actividad reciente
            </h2>
            <div className="bg-white dark:bg-slate-900 rounded-[20px] border border-[#E5E7EB] dark:border-slate-800 overflow-hidden shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
              {recentPoints.map((entry, idx) => {
                const label = POINT_SOURCE_LABELS[entry.source] ?? entry.source;
                const dateStr = entry.earnedAt?.toDate?.()
                  ? new Intl.DateTimeFormat("es", { day: "numeric", month: "short" }).format(entry.earnedAt.toDate())
                  : "";
                return (
                  <div
                    key={idx}
                    className="flex items-center gap-3 px-4 py-3 border-b border-slate-100 dark:border-slate-800 last:border-0"
                  >
                    <div className="size-8 rounded-lg bg-[#E0F2F1] dark:bg-emerald-900/20 flex items-center justify-center shrink-0">
                      <MaterialIcon name="add_circle" className="text-[#1A9B7D] text-sm" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{label}</p>
                      {dateStr && <p className="text-xs text-slate-400 mt-0.5">{dateStr}</p>}
                    </div>
                    <span className="text-sm font-black text-[#1A9B7D] shrink-0">+{entry.amount}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Empty state */}
        {totalPoints === 0 && (
          <div className="px-6 py-8 text-center">
            <MaterialIcon name="emoji_events" className="text-5xl text-slate-200 dark:text-slate-700 mb-4" />
            <p className="text-base font-bold text-slate-700 dark:text-slate-300 mb-2">Todavía no tenés puntos</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Completá rutinas, hacé check-ins diarios y participá en la comunidad para ganar puntos y desbloquear logros.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
