import { MaterialIcon } from "../shared/MaterialIcon";
import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useNavigate } from "react-router";
import { usePet } from "../../contexts/PetContext";
import { useMedical } from "../../contexts/MedicalContext";
import { PendingAction } from "../../types/medical";
import { formatDateSafe, parseDateSafe } from "../../utils/dateUtils";
import { isPendingActionsEnabled } from "../../utils/runtimeFlags";

export function ActionTray() {
  const pendingEnabled = isPendingActionsEnabled();
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const [showList, setShowList] = useState(false);
  const navigate = useNavigate();
  
  const { activePetId } = usePet();
  const { getPendingActionsByPetId, completePendingAction, deletePendingAction } = useMedical();

  // Get real pending actions from context
  const pendingActions = getPendingActionsByPetId(activePetId);
  const hasActions = pendingActions.length > 0;
  const incompleteActions = pendingActions.filter((action) => action.type === "incomplete_data");
  const shouldRender = pendingEnabled || incompleteActions.length > 0;

  const toggleCard = (id: string) => {
    setExpandedCard(expandedCard === id ? null : id);
  };

  const handleComplete = (id: string) => {
    completePendingAction(id);
  };

  const openReview = (action: PendingAction) => {
    if (!action.reviewId) return;
    navigate(`/review/${action.reviewId}`);
  };

  const resolveEvidenceUrl = (action: PendingAction): string | null => {
    const candidates = [
      action.imageFragmentUrl,
      action.sourceStorageSignedUrl,
      action.sourceStorageUri,
    ];
    const match = candidates.find((value) => typeof value === "string" && /^https?:\/\//i.test(value.trim()));
    return match ? match.trim() : null;
  };

  const openEvidence = (action: PendingAction) => {
    const url = resolveEvidenceUrl(action);
    if (!url) return;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  // Map action type to icon
  const getActionIcon = (action: PendingAction) => {
    if (action.sourceTag === "ai_projection") return "auto_awesome";
    switch (action.type) {
      case "vaccine_due":        return "vaccines";
      case "checkup_due":        return "event";
      case "medication_refill":  return "medication";
      case "test_pending":       return "biotech";
      case "follow_up":          return "event";
      case "incomplete_data":    return "warning";
      case "sync_review":        return "visibility";
      default:                   return "task_alt";
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

  if (!shouldRender || !hasActions) return null;

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold flex items-center gap-2 text-[#074738] dark:text-[#E0F2F1]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
          <MaterialIcon name="inbox" className="text-[#6B7280] dark:text-[#9CA3AF] text-lg" />
          Seguimientos
        </h2>
        <button
          onClick={() => setShowList((prev) => !prev)}
          className="text-[11px] font-bold uppercase tracking-wider text-[#1A9B7D] hover:text-[#074738] transition-colors"
          style={{ fontFamily: "'Manrope', sans-serif" }}
        >
          {showList ? "Ocultar" : `Ver ${pendingActions.length}`}
        </button>
      </div>

      {!showList ? (
        <button
          onClick={() => setShowList(true)}
          className="w-full bg-white dark:bg-slate-900 rounded-[16px] border border-[#E5E7EB] dark:border-slate-800 p-4 text-left hover:bg-[#F0FAF9] dark:hover:bg-slate-800/50 transition-colors"
        >
          <p className="text-base font-bold text-[#1A1A1A] dark:text-white" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            {pendingActions.length} pendiente{pendingActions.length !== 1 ? "s" : ""} activo{pendingActions.length !== 1 ? "s" : ""}
          </p>
          <p className="text-sm text-[#6B7280] dark:text-slate-400 mt-2" style={{ fontFamily: "'Manrope', sans-serif" }}>
            Se movieron acá para no tapar el historial principal.
          </p>
        </button>
      ) : (
        <div className="space-y-2.5">
          {incompleteActions.length > 0 && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3">
              <p className="text-xs font-black uppercase tracking-wide text-red-700">
                Datos clínicos incompletos
              </p>
              <p className="text-xs text-red-700 mt-1">
                Detectamos {incompleteActions.length} registro{incompleteActions.length > 1 ? "s" : ""} con medicación incompleta. Revisalo para activarlo.
              </p>
            </div>
          )}
          {pendingActions.map((action) => {
            const isExpanded = expandedCard === action.id;
            const priority = getPriority(action.dueDate);
            const isAiProjection = action.sourceTag === "ai_projection";

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
                    <div className="size-11 bg-[#074738]/10 text-[#074738] dark:text-[#1a9b7d] rounded-xl flex items-center justify-center shrink-0">
                      <MaterialIcon name={getActionIcon(action)} className="text-xl" />
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
                      <p className="text-xs text-[#074738] dark:text-[#1a9b7d] font-semibold">
                        {action.subtitle}
                      </p>
                      <span className="text-xs text-slate-300 dark:text-slate-700">•</span>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {formatDueDate(action.dueDate)}
                      </p>
                    </div>
                    {isAiProjection ? (
                      <p className="text-[9px] text-violet-600 dark:text-violet-400 font-bold uppercase tracking-wider mt-1 flex items-center gap-1">
                        <MaterialIcon name="auto_awesome" className="text-xs" />
                        Detectado por IA — pendiente confirmación
                      </p>
                    ) : action.autoGenerated && (
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

                        <div className="flex gap-2">
                          {isAiProjection && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleComplete(action.id);
                              }}
                              className="flex-1 px-4 py-2.5 rounded-lg text-xs font-bold bg-violet-600 text-white hover:bg-violet-700 transition-colors"
                            >
                              Confirmar
                            </button>
                          )}
                          {!isAiProjection && action.type === "incomplete_data" && action.reviewId && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                openReview(action);
                              }}
                              className="flex-1 px-4 py-2.5 rounded-lg text-xs font-bold bg-red-600 text-white hover:bg-red-700 transition-colors"
                            >
                              Ver y editar
                            </button>
                          )}
                          {action.type === "sync_review" && resolveEvidenceUrl(action) && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                openEvidence(action);
                              }}
                              className="flex-1 px-4 py-2.5 rounded-lg text-xs font-bold bg-amber-100 text-amber-800 hover:bg-amber-200 transition-colors"
                            >
                              Abrir evidencia
                            </button>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleComplete(action.id);
                            }}
                            className="flex-1 px-4 py-2.5 rounded-lg text-xs font-bold bg-[#074738] text-white hover:bg-[#1a9b7d] transition-colors"
                          >
                            Marcar completado
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              void deletePendingAction(action.id);
                            }}
                            className="px-4 py-2.5 rounded-lg text-xs font-bold bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                          >
                            Eliminar
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
