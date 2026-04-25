import { useState, useMemo, useEffect } from "react";
import type { ActiveMedication, Appointment } from "../../types/medical";

interface Props {
  medications: ActiveMedication[] | undefined | null;
  appointments: Appointment[] | undefined | null;
  petName: string;
}

// Storage key per-day per-pet — para que "marcado como tomado" persista
// entre refreshes y desaparezca de la lista. Cross-device sync queda para
// próximo sprint (Firestore medication_intakes — ver gamification spec).
const todayKey = () => new Date().toISOString().slice(0, 10);
const storageKey = (petName: string) => `pessy_taken_${todayKey()}_${petName}`;

function loadTakenToday(petName: string): Set<string> {
  try {
    const raw = localStorage.getItem(storageKey(petName));
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

function saveTakenToday(petName: string, taken: Set<string>) {
  try {
    localStorage.setItem(storageKey(petName), JSON.stringify([...taken]));
  } catch {
    /* quota exceeded or disabled — fail silent */
  }
}

interface PendingItem {
  id: string;
  kind: "med" | "appointment";
  title: string;
  subtitle: string;
  time: string | null;
  iconSrc: string;
  tag?: { label: string; color: "purple" | "green" | "amber" };
}

/**
 * PendienteHoyCard — Pessy App v2
 * Card central de Inicio: agenda del día de hoy.
 * - Medicamentos activos (1 entrada por med; si son multi-toma, se muestra la frecuencia)
 * - Turnos con date === hoy
 * - Toggles iOS (estado local, no persiste en Firestore)
 * - Progress bar de completados
 * - Empty state: "Todo al día" con chip verde
 */
export function PendienteHoyCard({ medications, appointments, petName }: Props) {
  const items = useMemo<PendingItem[]>(() => {
    try {
      const todayStr = new Date().toISOString().slice(0, 10);
      const safeMeds = Array.isArray(medications) ? medications : [];
      const safeAppts = Array.isArray(appointments) ? appointments : [];

      const medItems: PendingItem[] = safeMeds
        .filter((m) => m && m.active !== false)
        .map((m) => ({
          id: `med-${m.id}`,
          kind: "med" as const,
          title: m.name || "Medicamento",
          subtitle: [m.dosage, m.frequency].filter(Boolean).join(" · ") || "Medicación activa",
          time: null,
          iconSrc: "/illustrations/oval_prescription_meds.svg",
        }));

      const apptItems: PendingItem[] = safeAppts
        .filter((a) => a && a.status === "upcoming" && a.date && a.date.slice(0, 10) === todayStr)
        .sort((a, b) => (a.time || "").localeCompare(b.time || ""))
        .map((a) => ({
          id: `appt-${a.id}`,
          kind: "appointment" as const,
          title: a.title || "Turno",
          subtitle: [a.veterinarian, a.clinic].filter(Boolean).join(" · ") || "Turno médico",
          time: a.time || null,
          iconSrc: a.type === "vaccine"
            ? "/illustrations/oval_cork_vet_vaccinations.svg"
            : "/illustrations/oval_vet_visit.svg",
          tag: { label: "Turno", color: "purple" as const },
        }));

      return [...apptItems, ...medItems];
    } catch (err) {
      console.error("[PendienteHoyCard] error building items:", err);
      return [];
    }
  }, [medications, appointments]);

  const [completed, setCompleted] = useState<Set<string>>(() => loadTakenToday(petName));
  const [fadingOut, setFadingOut] = useState<Set<string>>(new Set());

  // Reload from storage si cambia la mascota activa o el día
  useEffect(() => {
    setCompleted(loadTakenToday(petName));
  }, [petName]);

  const toggle = (id: string) => {
    // Animación fade-out 200ms antes de filtrar visualmente
    setFadingOut((prev) => new Set(prev).add(id));
    setTimeout(() => {
      setCompleted((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        saveTakenToday(petName, next);
        return next;
      });
      setFadingOut((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }, 200);
  };

  // Filtrar items: los marcados como tomados HOY no se muestran (excepto durante el fade-out)
  const visibleItems = useMemo(
    () => items.filter((it) => !completed.has(it.id) || fadingOut.has(it.id)),
    [items, completed, fadingOut],
  );

  const total = items.length;
  const doneCount = items.filter((i) => completed.has(i.id)).length;
  const pct = total === 0 ? 0 : Math.round((doneCount / total) * 100);

  // Si todos los items fueron tomados HOY, comportarse como empty state
  if (total === 0 || visibleItems.length === 0) {
    return (
      <div
        className="mx-4 mb-3.5 rounded-[16px] bg-white border border-[rgba(7,71,56,0.08)] px-4 py-4 flex items-center gap-3"
        style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}
      >
        <span className="text-2xl">😊</span>
        <div className="flex-1 min-w-0">
          <div
            className="text-[15px] font-[800] text-[#074738]"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", letterSpacing: "-0.01em" }}
          >
            Todo al día
          </div>
          <div className="text-[12px] text-[#3d5a50] mt-0.5">
            {petName} no tiene pendientes para hoy.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="mx-4 mb-3.5 rounded-[16px] bg-white border border-[rgba(7,71,56,0.08)] overflow-hidden"
      style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-3.5 pb-2.5">
        <div
          className="text-[15px] font-[800] text-[#074738]"
          style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
        >
          Pendiente hoy
        </div>
        <span
          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-[700] ${
            doneCount === total
              ? "bg-[rgba(26,155,125,0.12)] text-[#1A9B7D]"
              : "bg-[#FEF3C7] text-[#92400E]"
          }`}
          style={{ fontFamily: "'Manrope', sans-serif" }}
        >
          {doneCount === total ? "Completo" : `${total - doneCount} pendiente${total - doneCount > 1 ? "s" : ""}`}
        </span>
      </div>

      {/* Items — solo los que NO están marcados tomados hoy (con fade-out animation) */}
      <div className="px-4 pb-3.5">
        {visibleItems.map((it, idx) => {
          const done = completed.has(it.id);
          const isFading = fadingOut.has(it.id);
          return (
            <button
              key={it.id}
              type="button"
              onClick={() => toggle(it.id)}
              className={`w-full flex items-center gap-3 py-3 text-left transition-opacity duration-200 ${
                isFading ? "opacity-0" : "opacity-100"
              } ${idx < visibleItems.length - 1 ? "border-b border-[rgba(7,71,56,0.05)]" : ""}`}
              style={{ fontFamily: "'Manrope', sans-serif", WebkitTapHighlightColor: "transparent" }}
            >
              <div className="w-9 h-9 rounded-[10px] bg-[#E0F2F1] flex items-center justify-center shrink-0">
                <img src={it.iconSrc} alt="" className="w-[22px] h-[22px] object-contain" />
              </div>
              <div className="flex-1 min-w-0">
                <div
                  className={`text-[14px] font-[700] truncate transition-all ${
                    done ? "text-[#9CA3AF] line-through" : "text-[#074738]"
                  }`}
                >
                  {it.title}
                </div>
                <div className={`text-[11px] mt-0.5 truncate ${done ? "text-[#9CA3AF]" : "text-[#6B7280]"}`}>
                  {it.time ? `${it.time} · ${it.subtitle}` : it.subtitle}
                </div>
              </div>
              {it.tag ? (
                <span
                  className={`shrink-0 px-2 py-0.5 rounded-full text-[9px] font-[800] uppercase ${
                    it.tag.color === "purple"
                      ? "bg-[rgba(80,72,202,0.10)] text-[#5048CA]"
                      : it.tag.color === "amber"
                      ? "bg-[#FEF3C7] text-[#92400E]"
                      : "bg-[rgba(26,155,125,0.12)] text-[#1A9B7D]"
                  }`}
                  style={{ letterSpacing: "0.15em" }}
                >
                  {it.tag.label}
                </span>
              ) : (
                <div
                  role="checkbox"
                  aria-checked={done}
                  className={`relative w-11 h-[26px] rounded-full shrink-0 transition-colors duration-200 ${
                    done ? "bg-[#1A9B7D]" : "bg-[#E5E7EB]"
                  }`}
                >
                  <span
                    className="absolute top-[3px] w-5 h-5 rounded-full bg-white transition-transform duration-200"
                    style={{
                      left: 3,
                      transform: done ? "translateX(18px)" : "translateX(0)",
                      boxShadow: "0 1px 4px rgba(0,0,0,0.18)",
                    }}
                  />
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Progress bar */}
      <div className="mx-4 mb-3.5">
        <div className="h-[5px] rounded-full bg-[rgba(7,71,56,0.07)] overflow-hidden">
          <div
            className="h-full rounded-full transition-[width] duration-500"
            style={{
              width: `${pct}%`,
              background: "linear-gradient(90deg, #074738, #1A9B7D)",
            }}
          />
        </div>
      </div>
    </div>
  );
}
