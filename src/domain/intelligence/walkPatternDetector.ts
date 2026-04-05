/**
 * Walk Pattern Detector
 *
 * Detecta patrones de paseos a partir del historial guardado en WalkContext.
 * Analiza los últimos 7-14 paseos registrados para inferir:
 *   - Hora habitual de paseo
 *   - Cantidad promedio por día
 *   - Días desde último paseo
 *   - Si existe patrón establecido (consistencia)
 */

import type { Walk } from "../../app/contexts/WalkContext";

export interface WalkPattern {
  usualWalkHour: number | null; // 0-23, ej: 18
  usualWalkCount: number; // Promedio de paseos por día
  daysSinceLastWalk: number; // Días desde el último paseo (0 si fue hoy)
  hasEstablishedPattern: boolean; // true si hay >5 registros consistentes
  patternConfidence: "low" | "medium" | "high"; // Confianza en el patrón detectado
  streakDays: number; // Días consecutivos que ha caminado
}

/**
 * Detecta el patrón de paseos a partir del historial.
 * Lógica:
 *   1. Toma los últimos 7-14 paseos
 *   2. Calcula hora más frecuente
 *   3. Calcula promedio de paseos por día
 *   4. Calcula días desde último paseo
 *   5. Detecta racha de días consecutivos
 */
export function detectWalkPattern(walks: Walk[]): WalkPattern {
  if (walks.length === 0) {
    return {
      usualWalkHour: null,
      usualWalkCount: 0,
      daysSinceLastWalk: 0,
      hasEstablishedPattern: false,
      patternConfidence: "low",
      streakDays: 0,
    };
  }

  // Tomar últimos 14 paseos (últimas 2 semanas aproximadamente)
  const recentWalks = walks.slice(0, Math.min(14, walks.length));

  // ─── Calculate usual walk hour ─────────────────────────────────────────────
  const hourCounts: Record<number, number> = {};
  recentWalks.forEach((walk) => {
    const date = new Date(walk.date);
    const hour = date.getHours();
    hourCounts[hour] = (hourCounts[hour] || 0) + 1;
  });

  const sortedHours = Object.entries(hourCounts).sort(([, countA], [, countB]) => countB - countA);
  const usualWalkHour = sortedHours.length > 0 ? parseInt(sortedHours[0][0]) : null;

  // ─── Calculate usual walk count per day ────────────────────────────────────
  const dateMap: Record<string, number> = {};
  recentWalks.forEach((walk) => {
    const date = new Date(walk.date);
    const dateStr = date.toISOString().split("T")[0]; // YYYY-MM-DD
    dateMap[dateStr] = (dateMap[dateStr] || 0) + 1;
  });

  const daysWithWalks = Object.keys(dateMap).length;
  const usualWalkCount = daysWithWalks > 0 ? Math.round((recentWalks.length / daysWithWalks) * 10) / 10 : 0;

  // ─── Calculate days since last walk ────────────────────────────────────────
  const lastWalk = recentWalks[0];
  const lastWalkDate = new Date(lastWalk.date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  lastWalkDate.setHours(0, 0, 0, 0);

  const daysSinceLastWalk = Math.floor((today.getTime() - lastWalkDate.getTime()) / (1000 * 60 * 60 * 24));

  // ─── Detect streak (consecutive days with walks) ────────────────────────────
  const sortedDates = Object.keys(dateMap).sort().reverse();
  let streakDays = 0;

  if (sortedDates.length > 0) {
    const todayStr = today.toISOString().split("T")[0];
    let currentDate = new Date(todayStr);

    for (const dateStr of sortedDates) {
      const walkDate = new Date(dateStr);
      const diffDays = Math.floor((currentDate.getTime() - walkDate.getTime()) / (1000 * 60 * 60 * 24));

      if (diffDays === 0 || diffDays === 1) {
        streakDays++;
        currentDate = walkDate;
      } else {
        break;
      }
    }
  }

  // ─── Determine pattern confidence ──────────────────────────────────────────
  const hasEnoughData = recentWalks.length > 5;
  const isConsistent = sortedHours.length > 0 && sortedHours[0][1] >= 3; // Al menos 3 paseos a la misma hora
  const hasRegularDays = Object.values(dateMap).every((count) => count >= 1) && daysWithWalks >= 5;

  let patternConfidence: "low" | "medium" | "high" = "low";
  if (hasEnoughData && isConsistent && hasRegularDays) {
    patternConfidence = "high";
  } else if (hasEnoughData && isConsistent) {
    patternConfidence = "medium";
  }

  const hasEstablishedPattern = recentWalks.length > 5 && patternConfidence !== "low";

  return {
    usualWalkHour,
    usualWalkCount,
    daysSinceLastWalk,
    hasEstablishedPattern,
    patternConfidence,
    streakDays,
  };
}
