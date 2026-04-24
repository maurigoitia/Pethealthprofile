import { MaterialIcon } from "../shared/MaterialIcon";
import type { ClinicalCondition, ActiveMedication } from "../../types/medical";

interface LastVetVisit {
  date: string; // ISO o YYYY-MM-DD
  clinic?: string | null;
}

interface MedicalSummaryCardProps {
  petName: string;
  /** Todas las condiciones clínicas detectadas para la mascota */
  conditions: ClinicalCondition[];
  /** Medicaciones activas reales */
  activeMedications: ActiveMedication[];
  /** Si existe al menos una vacuna registrada */
  hasVaccinationCard: boolean;
  /** Última visita registrada (consulta/checkup pasada) */
  lastVetVisit?: LastVetVisit | null;
}

/**
 * Resumen médico legible en ≤30 segundos.
 * NO inventa info: si no hay datos → empty state honesto.
 * Detecta alergias por keyword en normalizedName/organSystem (no hay
 * type="allergy" explícito en ClinicalCondition).
 */
const ALLERGY_KEYWORDS = [
  "alergi",       // alergia, alergico
  "atopi",        // atopia, atopica, dermatitis atopica
  "hipersensib",  // hipersensibilidad
  "urticari",
];

function isAllergy(c: ClinicalCondition): boolean {
  const haystack = `${c.normalizedName || ""} ${c.organSystem || ""}`.toLowerCase();
  return ALLERGY_KEYWORDS.some((kw) => haystack.includes(kw));
}

function formatPattern(pattern: ClinicalCondition["pattern"]): string | null {
  if (pattern === "chronic") return "crónica";
  if (pattern === "recurrent") return "recurrente";
  return null;
}

function daysSince(dateStr: string): number | null {
  const t = Date.parse(dateStr);
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.floor((Date.now() - t) / (1000 * 60 * 60 * 24)));
}

function capitalize(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function MedicalSummaryCard({
  petName,
  conditions,
  activeMedications,
  hasVaccinationCard,
  lastVetVisit,
}: MedicalSummaryCardProps) {
  const allergies = conditions.filter(isAllergy);
  const activeConditions = conditions.filter(
    (c) => !isAllergy(c) && (c.status === "active" || c.status === "monitoring")
  );

  const hasAnyData =
    allergies.length > 0 ||
    activeConditions.length > 0 ||
    activeMedications.length > 0 ||
    hasVaccinationCard ||
    !!lastVetVisit;

  // Empty state honesto
  if (!hasAnyData) {
    return (
      <div
        className="rounded-[20px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5"
        style={{ fontFamily: "Manrope, sans-serif" }}
      >
        <div className="flex items-center gap-2 mb-2">
          <MaterialIcon name="medical_information" className="text-[#1A9B7D] text-xl" />
          <h4
            className="font-black text-base text-[#074738] dark:text-white"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          >
            Resumen médico
          </h4>
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
          Aún no hay información médica cargada para {petName}. Subí documentos
          (recetas, carnet, estudios) para empezar a ver su historial ordenado.
        </p>
      </div>
    );
  }

  const medsToShow = activeMedications.slice(0, 3);
  const medsExtra = Math.max(0, activeMedications.length - medsToShow.length);

  const lastVisitDays = lastVetVisit?.date ? daysSince(lastVetVisit.date) : null;

  return (
    <div
      className="rounded-[20px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-4"
      style={{ fontFamily: "Manrope, sans-serif" }}
    >
      {/* Header */}
      <div className="flex items-center gap-2">
        <MaterialIcon name="medical_information" className="text-[#1A9B7D] text-xl" />
        <h4
          className="font-black text-base text-[#074738] dark:text-white"
          style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
        >
          Resumen médico
        </h4>
      </div>

      {/* Alergias — banner destacado */}
      {allergies.length > 0 && (
        <div className="rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800 p-3 flex items-start gap-2">
          <MaterialIcon name="warning" className="text-amber-600 dark:text-amber-400 text-lg shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-bold text-amber-900 dark:text-amber-200">
              Alergias conocidas
            </p>
            <p className="text-amber-800 dark:text-amber-300 leading-snug">
              {allergies.map((a) => capitalize(a.normalizedName)).join(", ")}
            </p>
          </div>
        </div>
      )}

      {/* Condiciones activas / monitoreo */}
      {activeConditions.length > 0 && (
        <div>
          <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">
            Condiciones relevantes
          </p>
          <div className="flex flex-wrap gap-1.5">
            {activeConditions.map((c) => {
              const patternLabel = formatPattern(c.pattern);
              return (
                <span
                  key={c.id}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#E0F2F1] dark:bg-[#074738]/30 text-[#074738] dark:text-emerald-200 text-xs font-semibold"
                >
                  {capitalize(c.normalizedName)}
                  {patternLabel && (
                    <span className="text-[10px] opacity-75 font-normal">
                      · {patternLabel}
                    </span>
                  )}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Tratamientos activos */}
      {activeMedications.length > 0 && (
        <div>
          <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">
            Tratamiento activo
          </p>
          <p className="text-sm text-slate-800 dark:text-slate-200">
            {medsToShow.map((m) => m.name).join(" · ")}
            {medsExtra > 0 && (
              <span className="text-slate-500"> · +{medsExtra} más</span>
            )}
          </p>
        </div>
      )}

      {/* Última visita */}
      {lastVetVisit && lastVisitDays !== null && (
        <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
          <MaterialIcon name="event_available" className="text-[#1A9B7D] text-base" />
          <span>
            Última consulta: hace {lastVisitDays} {lastVisitDays === 1 ? "día" : "días"}
            {lastVetVisit.clinic ? ` en ${lastVetVisit.clinic}` : ""}
          </span>
        </div>
      )}

      {/* Datos pendientes destacados */}
      {!hasVaccinationCard && (
        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800 pt-3">
          <MaterialIcon name="info" className="text-base" />
          <span>Sin carnet de vacunación cargado</span>
        </div>
      )}
    </div>
  );
}

export default MedicalSummaryCard;
