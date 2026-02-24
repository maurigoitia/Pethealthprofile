import { MaterialIcon } from "./MaterialIcon";
import { usePet } from "../contexts/PetContext";
import { useMedical } from "../contexts/MedicalContext";

export function MonthSummary() {
  const { activePetId } = usePet();
  const { getMonthSummary } = useMedical();

  // Get summary for current month
  const summary = getMonthSummary(activePetId, new Date());

  // Don't show if there are no events
  if (summary.totalEvents === 0 && summary.pendingActions === 0 && summary.activeMedications === 0) {
    return null;
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-black flex items-center gap-2">
          <MaterialIcon name="calendar_month" className="text-[#2b7cee] dark:text-[#5a8aff] text-xl" />
          Resumen de {summary.month}
        </h2>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm">
        <div className="grid grid-cols-2 gap-3">
          {/* Total Events */}
          <div className="bg-[#2b7cee]/5 dark:bg-[#2b7cee]/10 rounded-xl p-4 text-center">
            <div className="text-3xl font-black text-[#2b7cee] dark:text-[#5a8aff] mb-1">
              {summary.totalEvents}
            </div>
            <p className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
              Eventos médicos
            </p>
          </div>

          {/* Pending Actions */}
          <div className="bg-amber-500/5 dark:bg-amber-500/10 rounded-xl p-4 text-center">
            <div className="text-3xl font-black text-amber-600 dark:text-amber-400 mb-1">
              {summary.pendingActions}
            </div>
            <p className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
              Pendientes
            </p>
          </div>

          {/* Completed Actions */}
          <div className="bg-emerald-500/5 dark:bg-emerald-500/10 rounded-xl p-4 text-center">
            <div className="text-3xl font-black text-emerald-600 dark:text-emerald-400 mb-1">
              {summary.completedActions}
            </div>
            <p className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
              Completados
            </p>
          </div>

          {/* Active Medications */}
          <div className="bg-purple-500/5 dark:bg-purple-500/10 rounded-xl p-4 text-center">
            <div className="text-3xl font-black text-purple-600 dark:text-purple-400 mb-1">
              {summary.activeMedications}
            </div>
            <p className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
              Medicaciones
            </p>
          </div>
        </div>

        {/* Event Breakdown */}
        {summary.totalEvents > 0 && (
          <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800">
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-3 uppercase tracking-wider">
              Desglose por tipo
            </p>
            <div className="grid grid-cols-3 gap-2 text-center">
              {summary.eventsByType.vaccine > 0 && (
                <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-2">
                  <div className="text-sm font-black text-emerald-500 mb-0.5">
                    {summary.eventsByType.vaccine}
                  </div>
                  <p className="text-[9px] font-semibold text-slate-600 dark:text-slate-400 uppercase">
                    Vacunas
                  </p>
                </div>
              )}
              {summary.eventsByType.lab_test > 0 && (
                <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-2">
                  <div className="text-sm font-black text-purple-500 mb-0.5">
                    {summary.eventsByType.lab_test}
                  </div>
                  <p className="text-[9px] font-semibold text-slate-600 dark:text-slate-400 uppercase">
                    Laboratorio
                  </p>
                </div>
              )}
              {(summary.eventsByType.xray + summary.eventsByType.echocardiogram + summary.eventsByType.electrocardiogram) > 0 && (
                <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-2">
                  <div className="text-sm font-black text-purple-500 mb-0.5">
                    {summary.eventsByType.xray + summary.eventsByType.echocardiogram + summary.eventsByType.electrocardiogram}
                  </div>
                  <p className="text-[9px] font-semibold text-slate-600 dark:text-slate-400 uppercase">
                    Estudios
                  </p>
                </div>
              )}
              {summary.eventsByType.surgery > 0 && (
                <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-2">
                  <div className="text-sm font-black text-red-500 mb-0.5">
                    {summary.eventsByType.surgery}
                  </div>
                  <p className="text-[9px] font-semibold text-slate-600 dark:text-slate-400 uppercase">
                    Cirugías
                  </p>
                </div>
              )}
              {summary.eventsByType.medication > 0 && (
                <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-2">
                  <div className="text-sm font-black text-amber-500 mb-0.5">
                    {summary.eventsByType.medication}
                  </div>
                  <p className="text-[9px] font-semibold text-slate-600 dark:text-slate-400 uppercase">
                    Medicación
                  </p>
                </div>
              )}
              {summary.eventsByType.checkup > 0 && (
                <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-2">
                  <div className="text-sm font-black text-emerald-500 mb-0.5">
                    {summary.eventsByType.checkup}
                  </div>
                  <p className="text-[9px] font-semibold text-slate-600 dark:text-slate-400 uppercase">
                    Controles
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
