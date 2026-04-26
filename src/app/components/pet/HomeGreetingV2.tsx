interface Props {
  userName: string;
  petName: string;
  /** Items pendientes hoy: meds + turnos del día. */
  pendingTodayCount?: number;
  /** Reviews pendientes en historial (docs por confirmar). */
  pendingReviewCount?: number;
  /** Recordatorios atrasados (overdue) */
  overdueCount?: number;
}

/**
 * HomeGreetingV2 — Pessy App v2 (rediseñado 2026-04-26)
 *
 * Regla del producto: Home no muestra saludos estáticos ("Buenos días").
 * Solo muestra UNA línea CONTEXTUAL basada en data real. Si no hay nada
 * que decir → no renderiza nada (silencio es correcto).
 *
 * Prioridad de mensaje:
 * 1. overdueCount > 0 → mensaje urgencia
 * 2. pendingTodayCount > 0 → mensaje del día
 * 3. pendingReviewCount > 0 → mensaje docs por confirmar
 * 4. nada → return null (Home no necesita relleno)
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
