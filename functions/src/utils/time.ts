export function toDateKeyInTimezone(date: Date, timeZone: string): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(date);
}

export function parseYmdOrIsoToDateKey(value: unknown, timeZone = "UTC"): string {
  if (typeof value !== "string" || !value.trim()) return "";
  const trimmed = value.trim();
  if (/^\\d{4}-\\d{2}-\\d{2}$/.test(trimmed)) return trimmed;
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return "";
  return toDateKeyInTimezone(parsed, timeZone);
}

/**
 * Parsea una fecha y hora local (YYYY-MM-DD y HH:mm) en una zona horaria específica
 * y devuelve un objeto Date en UTC.
 */
export function parseLocalToUtc(dateStr: string, timeStr: string, timeZone: string): Date {
  const localIso = `${dateStr}T${timeStr}:00`;
  // Paso 1: Interpretar el string local como si fuera UTC para obtener un punto de referencia
  const tempDate = new Date(`${localIso}Z`);

  // Paso 2: Ver qué hora "cree" el formateador que es ese punto en la zona destino
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(tempDate);
  const partMap = new Map(parts.map((p) => [p.type, p.value]));

  // Paso 3: Reconstruir la fecha que el formateador devolvió
  const reconstructed = `${partMap.get("year")}-${partMap.get("month")}-${partMap.get("day")}T${partMap.get("hour")}:${partMap.get("minute")}:${partMap.get("second")}Z`;
  const reconstructedDate = new Date(reconstructed);

  // Paso 4: La diferencia entre lo que pedimos y lo que el formateador devolvió es el offset
  const offsetMs = reconstructedDate.getTime() - tempDate.getTime();

  // Paso 5: Aplicar el offset inverso para obtener la fecha UTC real
  return new Date(tempDate.getTime() - offsetMs);
}
