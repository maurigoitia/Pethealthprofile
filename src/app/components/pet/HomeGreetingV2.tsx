interface Props {
  userName: string;
  petName: string;
  petId: string;
  /** Items pendientes hoy: meds + turnos del día. */
  pendingTodayCount?: number;
  /** Reviews pendientes en historial (docs por confirmar). */
  pendingReviewCount?: number;
  /** Recordatorios atrasados (overdue) */
  overdueCount?: number;
}

/**
 * HomeGreetingV2 — Pessy Dynamic Message (counts-driven 2026-04-26)
 *
 * Reglas del producto:
 * - NO frases genéricas ("buenos días", "todo en orden", "salud al día")
 * - Mensaje contextual basado en data real de Firestore
 * - Si nada relevante → return null (silencio correcto)
 *
 * Nota: la versión AI-driven (pessyHomeIntelligence callable) está lista
 * en functions/src/index.ts pero queda detrás de un feature flag hasta
 * que functions deployen a prod. Hoy: counts-only (zero risk).
 */
export function HomeGreetingV2({
  petName,
  pendingTodayCount = 0,
  pendingReviewCount = 0,
  overdueCount = 0,
}: Props) {
  const displayPet = petName?.trim() || "tu mascota";

  let line: string | null = null;
  let accent: string = "#074738";

  if (overdueCount > 0) {
    line =
      overdueCount === 1
        ? `${displayPet} tiene 1 recordatorio atrasado`
        : `${displayPet} tiene ${overdueCount} recordatorios atrasados`;
    accent = "#EF4444";
  } else if (pendingTodayCount > 0) {
    line =
      pendingTodayCount === 1
        ? `Hoy: 1 cosa para ${displayPet}`
        : `Hoy: ${pendingTodayCount} cosas para ${displayPet}`;
    accent = "#1A9B7D";
  } else if (pendingReviewCount > 0) {
    line =
      pendingReviewCount === 1
        ? `1 documento esperando que lo confirmes`
        : `${pendingReviewCount} documentos esperando que los confirmes`;
    accent = "#074738";
  }

  if (!line) return null;

  return (
    <div className="px-[18px] pt-3.5 pb-2">
      <h1
        className="text-[22px] font-[800] leading-[1.15]"
        style={{
          fontFamily: "'Plus Jakarta Sans', sans-serif",
          letterSpacing: "-0.02em",
          color: accent,
        }}
      >
        {line}
      </h1>
    </div>
  );
}
