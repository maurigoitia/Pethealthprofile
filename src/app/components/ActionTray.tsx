import { MaterialIcon } from "./MaterialIcon";
import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { EmptyState } from "./EmptyState";
import { usePet } from "../contexts/PetContext";
import { useMedical } from "../contexts/MedicalContext";
import { PendingAction } from "../types/medical";
import { formatDateSafe, parseDateSafe } from "../utils/dateUtils";

export function ActionTray() {
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  
  const { activePetId } = usePet();
  const { getPendingActionsByPetId, completePendingAction } = useMedical();

  // Get real pending actions from context
  const pendingActions = getPendingActionsByPetId(activePetId);
  const hasActions = pendingActions.length > 0;

  const toggleCard = (id: string) => {
    setExpandedCard(expandedCard === id ? null : id);
  };

  const handleComplete = (id: string) => {
    completePendingAction(id);
  };

  // Map action type to icon
  const getActionIcon = (type: PendingAction["type"]) => {
    switch (type) {
      case "vaccine_due":
        return "vaccines";
      case "checkup_due":
        return "event";
      case "medication_refill":
        return "medication";
      case "test_pending":
        return "biotech";
      case "follow_up":
        return "event";
      default:
        return "task_alt";
    }
  };

  // Calculate priority based on due date
  const getPriority = (dueDate: string): "high" | "medium" | "low" => {
    const now = new Date();
    const due = parseDateSafe(dueDate);
    if (!due) return "medium";
    const daysUntil = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysUntil < 0) return "high"; // Overdue
    if (daysUntil <= 7) return "high";
    if (daysUntil <= 30) return "medium";
    return "low";
  };

  const getPriorityColor = (priority: "high" | "medium" | "low") => {
    switch (priority) {
      case "high":
        return "bg-red-500";
      case "medium":
        return "bg-amber-500";
      case "low":
        return "bg-emerald-500";
    }
  };

  // Format due date
  const formatDueDate = (isoDate: string) => {
    const date = parseDateSafe(isoDate);
    if (!date) return "Fecha no disponible";
    const now = new Date();
    const daysUntil = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysUntil < 0) {
      return `Vencido hace ${Math.abs(daysUntil)} días`;
    }
    if (daysUntil === 0) {
      return "Vence hoy";
    }
    if (daysUntil <= 7) {
      return `Vence en ${daysUntil} ${daysUntil === 1 ? "día" : "días"}`;
    }
    
    return date.toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });
  };

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-black flex items-center gap-2">
          <MaterialIcon name="inbox" className="text-[#2b7cee] dark:text-[#5a8aff] text-xl" />
          Pendientes
        </h2>
        {hasActions && (
          <span className="bg-[#2b7cee]/10 text-[#2b7cee] dark:text-[#5a8aff] text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider">
            {pendingActions.length}
          </span>
        )}
      </div>

      {!hasActions ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
          <EmptyState
            icon="task_alt"
            title="¡Todo al día!"
            description="No tienes tareas pendientes. Tus mascotas están al día con sus cuidados médicos."
            illustration="medical"
          />
        </div>
      ) : (
        <div className="space-y-2.5">
          {pendingActions.map((action) => {
            const isExpanded = expandedCard === action.id;
            const priority = getPriority(action.dueDate);
            const icon = getActionIcon(action.type);
            
            return (
              <motion.div
                key={action.id}
                layout
                className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm"
              >
                <button
                  onClick={() => toggleCard(action.id)}
                  className="w-full p-4 flex items-start gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                >
                  <div className="relative">
                    <div className="size-11 bg-[#2b7cee]/10 text-[#2b7cee] dark:text-[#5a8aff] rounded-xl flex items-center justify-center shrink-0">
                      <MaterialIcon name={icon} className="text-xl" />
                    </div>
                    <div
                      className={`absolute -top-1 -right-1 size-3 rounded-full ${getPriorityColor(
                        priority
                      )} border-2 border-white dark:border-slate-900`}
                    />
                  </div>

                  <div className="flex-1 text-left min-w-0">
                    <h3 className="font-bold text-sm text-slate-900 dark:text-white leading-tight mb-1">
                      {action.title}
                    </h3>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-xs text-[#2b7cee] dark:text-[#5a8aff] font-semibold">
                        {action.subtitle}
                      </p>
                      <span className="text-xs text-slate-300 dark:text-slate-700">•</span>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {formatDueDate(action.dueDate)}
                      </p>
                    </div>
                    {action.autoGenerated && (
                      <p className="text-[9px] text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-wider mt-1">
                        Generado automáticamente
                      </p>
                    )}
                  </div>

                  <MaterialIcon
                    name={isExpanded ? "expand_less" : "expand_more"}
                    className="text-slate-400 text-xl shrink-0"
                  />
                </button>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <div className="px-4 pb-4 space-y-3 border-t border-slate-100 dark:border-slate-800 pt-3">
                        {/* Info */}
                        <div className="space-y-2 bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-slate-500 dark:text-slate-400">
                              Fecha programada
                            </span>
                              <span className="text-xs font-semibold text-slate-900 dark:text-white">
                              {formatDateSafe(
                                action.dueDate,
                                "es-ES",
                                { day: "numeric", month: "long", year: "numeric" },
                                "Fecha no disponible"
                              )}
                            </span>
                          </div>
                          {action.reminderEnabled && (
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-slate-500 dark:text-slate-400">
                                Recordatorio
                              </span>
                              <span className="text-xs font-semibold text-slate-900 dark:text-white">
                                {action.reminderDaysBefore} días antes
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Action Buttons */}
                        <div className="flex gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleComplete(action.id);
                            }}
                            className="flex-1 px-4 py-2.5 rounded-lg text-xs font-bold bg-[#2b7cee] text-white hover:bg-[#5a8aff] transition-colors"
                          >
                            Marcar como completado
                          </button>
                          <button className="px-4 py-2.5 rounded-lg text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                            Posponer
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      )}
    </section>
  );
}
