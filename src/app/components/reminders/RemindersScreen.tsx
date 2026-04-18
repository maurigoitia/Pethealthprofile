import { useState } from "react";
import { MaterialIcon } from "../shared/MaterialIcon";
import { useReminders } from "../../contexts/RemindersContext";
import { usePet } from "../../contexts/PetContext";
import { AddReminderModal } from "./AddReminderModal";
import { ManualReminder, ReminderType } from "../../types/medical";

interface RemindersScreenProps {
  onBack?: () => void;
}

// ── Config visual por tipo ────────────────────────────────────────────────────
const TYPE_CONFIG: Record<ReminderType, { label: string; icon: string; color: string; bg: string }> = {
  vaccine:    { label: "Vacuna",      icon: "vaccines",         color: "#1A9B7D", bg: "#D1FAE5" },
  medication: { label: "Medicación",  icon: "medication",       color: "#074738", bg: "#E0F2F1" },
  checkup:    { label: "Control",     icon: "stethoscope",      color: "#8b5cf6", bg: "#ede9fe" },
  grooming:   { label: "Peluquería",  icon: "content_cut",      color: "#f59e0b", bg: "#fef3c7" },
  deworming:  { label: "Desparasit.", icon: "bug_report",       color: "#ef4444", bg: "#fee2e2" },
  other:      { label: "Otro",        icon: "notifications",    color: "#64748b", bg: "#f1f5f9" },
};

function daysDiff(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr + "T00:00:00");
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

function formatDueDate(dateStr: string): string {
  const diff = daysDiff(dateStr);
  if (diff < -1) return `Hace ${Math.abs(diff)} días`;
  if (diff === -1) return "Ayer";
  if (diff === 0) return "Hoy";
  if (diff === 1) return "Mañana";
  if (diff <= 7) return `En ${diff} días`;
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("es-AR", { day: "numeric", month: "short" });
}

function urgencyGroup(r: ManualReminder): "overdue" | "today" | "week" | "upcoming" {
  const diff = daysDiff(r.dueDate);
  if (diff < 0) return "overdue";
  if (diff === 0) return "today";
  if (diff <= 7) return "week";
  return "upcoming";
}

const GROUP_CONFIG = {
  overdue:  { label: "Vencidos",      color: "text-red-600",    dot: "bg-red-500"    },
  today:    { label: "Hoy",           color: "text-[#1A9B7D]",  dot: "bg-[#1A9B7D]"  },
  week:     { label: "Esta semana",   color: "text-amber-600",  dot: "bg-amber-400"  },
  upcoming: { label: "Próximos",      color: "text-slate-500",  dot: "bg-slate-300"  },
};

export function RemindersScreen({ onBack }: RemindersScreenProps) {
  const { activePetId } = usePet();
  const { getRemindersByPetId, completeReminder, dismissReminder, deleteReminder } = useReminders();
  const [showAdd, setShowAdd] = useState(false);
  const [tab, setTab] = useState<"pending" | "done">("pending");
  const [swipedId, setSwipedId] = useState<string | null>(null);

  const all = activePetId ? getRemindersByPetId(activePetId) : [];
  const pending = all.filter((r) => !r.completed && !r.dismissed);
  const done    = all.filter((r) => r.completed || r.dismissed);

  // Agrupar pendientes
  const groups: Record<string, ManualReminder[]> = { overdue: [], today: [], week: [], upcoming: [] };
  pending.forEach((r) => groups[urgencyGroup(r)].push(r));

  const shownGroups = (["overdue", "today", "week", "upcoming"] as const).filter(
    (g) => groups[g].length> 0
  );

  return (
    <div className="min-h-screen bg-[#F0FAF9] dark:bg-[#101622] flex flex-col">
      <div className="max-w-md mx-auto w-full flex flex-col min-h-screen">

        {/* Header */}
        <div className="bg-white dark:bg-slate-900 px-4 pt-6 pb-0 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3 mb-5">
            {onBack && (
              <button onClick={onBack}
                className="size-10 rounded-full bg-[#E0F2F1] dark:bg-slate-800 flex items-center justify-center">
                <MaterialIcon name="arrow_back" className="text-[#074738]" />
              </button>
            )}
            <div className="flex-1">
              <h1 className="text-2xl font-black text-slate-900 dark:text-white">Recordatorios</h1>
              <p className="text-sm text-slate-500">
                {pending.length === 0 ? "Todo al día" : `${pending.filter(r => urgencyGroup(r) !== "upcoming").length} requieren atención`}
              </p>
            </div>
            <button onClick={() => setShowAdd(true)}
              className="size-10 rounded-full bg-[#1A9B7D] flex items-center justify-center shadow-[0_4px_12px_rgba(26,155,125,0.3)] active:scale-[0.97] transition-all">
              <MaterialIcon name="add" className="text-white text-xl" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex">
            {(["pending", "done"] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)}
                className={`flex-1 pb-3 text-sm font-bold border-b-2 transition-all ${
                  tab === t
                    ? "border-[#1A9B7D] text-[#074738]"
                    : "border-transparent text-slate-400"
                }`}>
                {t === "pending" ? `Pendientes (${pending.length})` : `Completados (${done.length})`}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto pb-28">
          

            {/* ── PENDIENTES ── */}
            {tab === "pending" && (
              <div className="p-4 space-y-6">

                {pending.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-center">
                    <div className="size-20 rounded-full bg-emerald-50 flex items-center justify-center mb-4">
                      <MaterialIcon name="check_circle" className="text-4xl text-emerald-400" />
                    </div>
                    <h3 className="text-lg font-black text-slate-900 dark:text-white mb-1">¡Todo al día!</h3>
                    <p className="text-sm text-slate-500 max-w-xs">No tenés recordatorios pendientes. Agregá uno para no olvidar nada.</p>
                    <button onClick={() => setShowAdd(true)}
                      className="mt-5 px-6 py-3 rounded-[14px] bg-[#1A9B7D] text-white font-bold text-sm active:scale-[0.97] transition-all">
                      Agregar recordatorio
                    </button>
                  </div>
                ) : (
                  shownGroups.map((group) => (
                    <div key={group}>
                      {/* Group header */}
                      <div className="flex items-center gap-2 mb-3">
                        <div className={`size-2 rounded-full ${GROUP_CONFIG[group].dot}`} />
                        <span className={`text-xs font-black uppercase tracking-wider ${GROUP_CONFIG[group].color}`}>
                          {GROUP_CONFIG[group].label}
                        </span>
                        <div className="flex-1 h-px bg-slate-100 dark:bg-slate-800" />
                        <span className="text-xs text-slate-400">{groups[group].length}</span>
                      </div>

                      <div className="space-y-2">
                        {groups[group].map((r) => {
                          const tc = TYPE_CONFIG[r.type];
                          const diff = daysDiff(r.dueDate);
                          const isOverdue = diff < 0;
                          const isToday = diff === 0;
                          const isSwiped = swipedId === r.id;

                          return (
                            <div key={r.id}
                              layout className="relative overflow-hidden rounded-[16px]">
                              {/* Swipe actions background */}
                              {isSwiped && (
                                <div className="absolute inset-0 flex items-center justify-end gap-2 pr-3 bg-[#E0F2F1] dark:bg-slate-800 rounded-[12px]">
                                  <button onClick={() => { deleteReminder(r.id); setSwipedId(null); }}
                                    className="size-11 rounded-[12px] bg-red-500 flex items-center justify-center active:scale-[0.97] transition-all">
                                    <MaterialIcon name="delete" className="text-white text-lg" />
                                  </button>
                                </div>
                              )}

                              <div
                                className={`relative bg-white dark:bg-slate-900 rounded-[12px] border transition-all ${
                                  isOverdue ? "border-red-200 dark:border-red-900/50" :
                                  isToday   ? "border-[#1A9B7D]/30" :
                                              "border-slate-200 dark:border-slate-800"
                                }`}
                                style={{ transform: isSwiped ? "translateX(-80px)" : "translateX(0)", transition: "transform 0.2s" }}>
                                <div className="flex items-center gap-3 p-3.5">
                                  {/* Tipo icon */}
                                  <div className="size-11 rounded-[12px] flex items-center justify-center shrink-0"
                                    style={{ backgroundColor: tc.bg }}>
                                    <MaterialIcon name={tc.icon} className="text-xl" style={{ color: tc.color }} />
                                  </div>

                                  {/* Info */}
                                  <div className="flex-1 min-w-0">
                                    <p className="font-bold text-sm text-slate-900 dark:text-white truncate">{r.title}</p>
                                    <div className="flex items-center gap-1.5 mt-0.5">
                                      <span className={`text-xs font-semibold ${
                                        isOverdue ? "text-red-500" :
                                        isToday   ? "text-[#1A9B7D]" :
                                        diff <= 3  ? "text-amber-500" :
                                                    "text-slate-500"
                                      }`}>
                                        {formatDueDate(r.dueDate)}
                                        {r.dueTime && ` · ${r.dueTime}`}
                                      </span>
                                      {r.repeat !== "none" && (
                                        <span className="text-[10px] text-slate-400 bg-[#E0F2F1] dark:bg-slate-800 px-1.5 py-0.5 rounded-full">
                                          ↻
                                        </span>
                                      )}
                                    </div>
                                    {r.notes && (
                                      <p className="text-[11px] text-slate-400 mt-0.5 truncate">{r.notes}</p>
                                    )}
                                  </div>

                                  {/* Actions */}
                                  <div className="flex items-center gap-1 shrink-0">
                                    <button
                                      onClick={() => completeReminder(r.id)}
                                      className={`size-9 rounded-[12px] flex items-center justify-center transition-colors ${
                                        isOverdue
                                          ? "bg-red-50 dark:bg-red-950/30 text-red-500"
                                          : isToday
                                          ? "bg-[#E0F2F1] text-[#1A9B7D]"
                                          : "bg-[#E0F2F1] dark:bg-slate-800 text-slate-500"
                                      }`}>
                                      <MaterialIcon name="check" className="text-lg" />
                                    </button>
                                    <button
                                      onClick={() => setSwipedId(isSwiped ? null : r.id)}
                                      className="size-9 rounded-[12px] bg-[#E0F2F1] dark:bg-slate-800 flex items-center justify-center text-slate-400">
                                      <MaterialIcon name="more_horiz" className="text-lg" />
                                    </button>
                                  </div>
                                </div>

                                {/* Urgency strip for overdue/today */}
                                {(isOverdue || isToday) && (
                                  <div className={`h-0.5 mx-3 mb-3 rounded-full ${isOverdue ? "bg-red-400" : "bg-[#1A9B7D]"}`} />
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* ── COMPLETADOS ── */}
            {tab === "done" && (
              <div className="p-4 space-y-2">
                {done.length === 0 ? (
                  <div className="text-center py-20">
                    <MaterialIcon name="task_alt" className="text-5xl text-slate-300 mb-3" />
                    <p className="text-slate-500 text-sm">Aún no completaste ningún recordatorio</p>
                  </div>
                ) : done.map((r) => {
                  const tc = TYPE_CONFIG[r.type];
                  return (
                    <div key={r.id}
                      className="bg-white dark:bg-slate-900 rounded-[12px] border border-slate-100 dark:border-slate-800 flex items-center gap-3 p-3.5 opacity-60">
                      <div className="size-10 rounded-[12px] flex items-center justify-center shrink-0 bg-[#E0F2F1] dark:bg-slate-800">
                        <MaterialIcon name={tc.icon} className="text-lg text-slate-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm text-slate-700 dark:text-slate-300 line-through truncate">{r.title}</p>
                        <p className="text-xs text-slate-400">{formatDueDate(r.dueDate)}</p>
                      </div>
                      <button onClick={() => deleteReminder(r.id)}
                        className="size-8 rounded-[12px] bg-[#E0F2F1] dark:bg-slate-800 flex items-center justify-center">
                        <MaterialIcon name="close" className="text-sm text-slate-400" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

          
        </div>
      </div>

      <AddReminderModal isOpen={showAdd} onClose={() => setShowAdd(false)} />
    </div>
  );
}
