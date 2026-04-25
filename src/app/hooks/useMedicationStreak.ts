/**
 * useMedicationStreak — calcula la racha de días consecutivos en los que
 * la mascota recibió TODAS sus dosis registradas.
 *
 * Lee de Firestore `medication_intakes` filtrado por `petId`.
 * Se queda con los últimos 90 días (corte razonable, no escala infinita).
 *
 * Reglas de la racha:
 * - Día con racha = al menos 1 intake registrado para el pet ese día.
 * - Hoy cuenta solo si ya hay un intake (sino "preserva" la racha sin
 *   incrementarla — el día está en curso).
 * - Si hubo gap de 1+ días sin ningún intake, la racha se rompe.
 *
 * Devuelve también:
 *   - `currentStreakDays`: racha actual hasta hoy
 *   - `longestStreakDays`: récord en los últimos 90 días
 *   - `startedAt`: fecha de inicio de la racha actual (o null si 0)
 *
 * Política UI: NO mostrar si currentStreakDays < 3 (ver
 * docs/superpowers/specs/2026-04-24-gamification-honest.md regla "celebrar
 * pequeño se siente fake").
 */
import { useEffect, useState } from "react";
import {
  collection,
  query,
  where,
  onSnapshot,
} from "firebase/firestore";
import { db } from "../../lib/firebase";

export interface MedicationStreak {
  currentStreakDays: number;
  longestStreakDays: number;
  startedAt: string | null;
  intakesLast90Days: number;
}

const ZERO: MedicationStreak = {
  currentStreakDays: 0,
  longestStreakDays: 0,
  startedAt: null,
  intakesLast90Days: 0,
};

const dayKey = (iso: string): string => iso.slice(0, 10);

function calcStreaks(intakeDayKeys: Set<string>, todayIso: string): MedicationStreak {
  if (intakeDayKeys.size === 0) return ZERO;

  // Reconstruir lista ordenada de días con intake (asc)
  const days = [...intakeDayKeys].sort();

  // Calcular racha actual hacia atrás desde hoy (o desde ayer si hoy aún no tiene)
  const today = dayKey(todayIso);
  let cursor = today;
  let currentStreakDays = 0;
  let startedAt: string | null = null;

  // Si hoy no está en el set, empezamos desde ayer
  if (!intakeDayKeys.has(today)) {
    const d = new Date(today + "T00:00:00");
    d.setDate(d.getDate() - 1);
    cursor = d.toISOString().slice(0, 10);
  }

  while (intakeDayKeys.has(cursor)) {
    currentStreakDays += 1;
    startedAt = cursor;
    const d = new Date(cursor + "T00:00:00");
    d.setDate(d.getDate() - 1);
    cursor = d.toISOString().slice(0, 10);
  }

  // Calcular el récord buscando la racha más larga consecutiva en `days`
  let longestStreakDays = 0;
  let runStart: string | null = null;
  let runLen = 0;
  let prev: string | null = null;
  for (const day of days) {
    if (prev === null) {
      runLen = 1;
      runStart = day;
    } else {
      const prevDate = new Date(prev + "T00:00:00");
      prevDate.setDate(prevDate.getDate() + 1);
      const expected = prevDate.toISOString().slice(0, 10);
      if (expected === day) {
        runLen += 1;
      } else {
        runLen = 1;
        runStart = day;
      }
    }
    if (runLen > longestStreakDays) longestStreakDays = runLen;
    prev = day;
  }

  return {
    currentStreakDays,
    longestStreakDays,
    startedAt,
    intakesLast90Days: intakeDayKeys.size,
  };
}

export function useMedicationStreak(petId: string | null | undefined): MedicationStreak {
  const [streak, setStreak] = useState<MedicationStreak>(ZERO);

  useEffect(() => {
    if (!petId) {
      setStreak(ZERO);
      return;
    }

    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    ninetyDaysAgo.setHours(0, 0, 0, 0);

    const q = query(
      collection(db, "medication_intakes"),
      where("petId", "==", petId),
      where("takenAt", ">=", ninetyDaysAgo.toISOString()),
    );

    return onSnapshot(
      q,
      (snap) => {
        try {
          const dayKeys = new Set<string>();
          snap.docs.forEach((d) => {
            const data = d.data() as { takenAt?: string };
            if (typeof data.takenAt === "string") dayKeys.add(dayKey(data.takenAt));
          });
          setStreak(calcStreaks(dayKeys, new Date().toISOString()));
        } catch (err) {
          console.error("[useMedicationStreak] calc error:", err);
          setStreak(ZERO);
        }
      },
      (err) => {
        console.error("[useMedicationStreak] snapshot error:", err);
        setStreak(ZERO);
      },
    );
  }, [petId]);

  return streak;
}
