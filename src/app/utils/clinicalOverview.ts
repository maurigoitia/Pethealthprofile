/**
 * clinicalOverview — genera UNA oración de síntesis clínica para el PDF.
 *
 * No llama a IA externa. Deriva la narrativa de datos ya estructurados:
 *   - condiciones activas normalizadas
 *   - medicamentos activos
 *   - eventos recientes (últimos 60 días) con diagnóstico real
 *
 * Regla de producto: la frase debe leerse natural en 30 segundos
 * y responder "¿qué tiene, qué está tomando, qué viene?"
 */

export interface ClinicalOverviewInput {
  petName: string;
  activeConditionNames: string[];   // ej. ["cardiomiopatía dilatada", "bronquitis"]
  activeMedicationNames: string[];  // ej. ["Pimobendan", "Fórmula hepática"]
  recentFindings: string[];         // diagnósticos únicos de últimos 60 días
  hasUpcomingAppointment: boolean;
  hasPendingReviews: boolean;
}

const SYSTEM_LABELS: Record<string, string> = {
  cardio: "cardíaca",
  cardiovasc: "cardíaca",
  cardiaca: "cardíaca",
  respirator: "respiratoria",
  bronquit: "respiratoria",
  hepat: "hepática",
  renal: "renal",
  dermato: "dermatológica",
  ortoped: "ortopédica",
  gastroint: "digestiva",
  neuro: "neurológica",
};

function inferSystemsFromConditions(conditionNames: string[]): string[] {
  const systems = new Set<string>();
  for (const name of conditionNames) {
    const lower = name.toLowerCase();
    for (const [key, label] of Object.entries(SYSTEM_LABELS)) {
      if (lower.includes(key)) {
        systems.add(label);
        break;
      }
    }
  }
  return Array.from(systems);
}

function joinHuman(items: string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} y ${items[1]}`;
  return `${items.slice(0, -1).join(", ")} y ${items[items.length - 1]}`;
}

/**
 * Devuelve una síntesis clínica en 1-2 oraciones.
 * Si no hay datos, devuelve null (el caller debe omitir la sección).
 */
export function generateClinicalOverview(input: ClinicalOverviewInput): string | null {
  const { petName, activeConditionNames, activeMedicationNames, recentFindings, hasUpcomingAppointment, hasPendingReviews } = input;

  // Sin info clínica real → no inventar
  if (activeConditionNames.length === 0 && activeMedicationNames.length === 0 && recentFindings.length === 0) {
    return null;
  }

  const parts: string[] = [];

  // Oración 1: estado actual (sistemas afectados + tratamiento)
  const systems = inferSystemsFromConditions([...activeConditionNames, ...recentFindings]);

  if (systems.length > 0 && activeMedicationNames.length > 0) {
    const systemsText = joinHuman(systems);
    const article = systems.length === 1 ? "la afección" : "afecciones";
    parts.push(`${petName} está en tratamiento activo por ${article} ${systemsText}.`);
  } else if (systems.length > 0) {
    parts.push(`${petName} tiene seguimiento clínico por condiciones ${joinHuman(systems)}.`);
  } else if (activeConditionNames.length > 0 && activeMedicationNames.length > 0) {
    parts.push(`${petName} está en tratamiento activo por ${joinHuman(activeConditionNames.slice(0, 2))}.`);
  } else if (activeMedicationNames.length > 0) {
    parts.push(`${petName} tiene ${activeMedicationNames.length} tratamiento${activeMedicationNames.length > 1 ? "s" : ""} en curso.`);
  } else if (recentFindings.length > 0) {
    parts.push(`${petName} tuvo evaluaciones recientes por ${joinHuman(recentFindings.slice(0, 2))}.`);
  }

  // Oración 2: próximo paso (si hay info)
  if (hasUpcomingAppointment) {
    parts.push("Tiene un próximo control agendado.");
  } else if (recentFindings.length >= 2) {
    parts.push("Continúa en seguimiento con controles programados.");
  }

  // Flag de calidad de datos (solo si es relevante)
  if (hasPendingReviews) {
    parts.push("Algunos documentos aún están pendientes de confirmación.");
  }

  if (parts.length === 0) return null;
  return parts.join(" ");
}
