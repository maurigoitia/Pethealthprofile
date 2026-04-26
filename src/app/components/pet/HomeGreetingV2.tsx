import { useEffect, useState } from "react";
import { httpsCallable } from "firebase/functions";
import { functions } from "../../../lib/firebase";

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

interface AIMessage {
  state: "needs_action" | "upcoming" | "recent_change" | "stable";
  message: string;
  alerts: string[];
  recommendation: string;
  actions: string[];
  tone: "neutral" | "alert" | "positive";
}

const TONE_COLORS: Record<AIMessage["tone"], string> = {
  neutral: "#074738",
  alert: "#EF4444",
  positive: "#1A9B7D",
};

/**
 * HomeGreetingV2 — Pessy Dynamic Message Engine (2026-04-26)
 *
 * Reglas del producto:
 * - NO frases genéricas ("buenos días", "todo en orden", "salud al día")
 * - Mensaje vacío permitido → silencio + animación de mascota tranquila (próx)
 * - Render rápido con counts mientras Gemini procesa (no congela el Home)
 *
 * Flujo:
 * 1. Render inmediato basado en counts locales (latencia 0)
 * 2. useEffect dispara pessyHomeIntelligence (Gemini)
 * 3. Cuando llega respuesta AI → reemplaza mensaje
 * 4. Si AI message vacío → return null (regla "stable" silencioso)
 */
export function HomeGreetingV2({
  petName,
  petId,
  pendingTodayCount = 0,
  pendingReviewCount = 0,
  overdueCount = 0,
}: Props) {
  const [ai, setAi] = useState<AIMessage | null>(null);
  const [aiLoaded, setAiLoaded] = useState(false);

  useEffect(() => {
    if (!petId) return;
    let cancelled = false;
    (async () => {
      try {
        const fn = httpsCallable<
          { petId: string },
          AIMessage
        >(functions, "pessyHomeIntelligence");
        const res = await fn({ petId });
        if (!cancelled) {
          setAi(res.data);
          setAiLoaded(true);
        }
      } catch (err) {
        // Falla silenciosa: keep el fallback de counts
        console.warn("[HomeGreetingV2] pessyHomeIntelligence falló:", err);
        if (!cancelled) setAiLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [petId]);

  // ── 1. Si ya cargó AI y mensaje viene vacío → silencio
  if (aiLoaded && ai && !ai.message) {
    return null;
  }

  // ── 2. Si AI tiene mensaje, usarlo
  if (ai && ai.message) {
    const color = TONE_COLORS[ai.tone] || "#074738";
    return (
      <div className="px-[18px] pt-3.5 pb-2">
        <h1
          className="text-[22px] font-[800] leading-[1.2]"
          style={{
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            letterSpacing: "-0.02em",
            color,
          }}
        >
          {ai.message}
        </h1>
        {ai.recommendation && (
          <p
            className="mt-2 text-[13px] text-[#6B7280] leading-[1.4]"
            style={{ fontFamily: "Manrope, sans-serif" }}
          >
            {ai.recommendation}
          </p>
        )}
      </div>
    );
  }

  // ── 3. Fallback rápido mientras AI procesa (counts locales)
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
