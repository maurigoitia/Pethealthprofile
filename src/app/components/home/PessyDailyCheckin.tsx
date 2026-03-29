/**
 * PessyDailyCheckin — Pessy thinks, not just collects
 *
 * Reads real pet data (active medications, upcoming appointments) and surfaces
 * ONE contextual question. Not a generic form — a context-aware brain card.
 *
 * Priority:
 *   1. Has active medication → "¿Ya tomó [med] hoy?" (gamification: 20pts ✓ / 5pts ✗)
 *   2. Appointment within 7 days → mood check before the vet
 *   3. Default → quick mood emoji pick (10pts)
 */

import { useState, useEffect } from "react";
import { doc, setDoc } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import { useAuth } from "../../contexts/AuthContext";
import { addPoints } from "../../utils/gamification";
import { MaterialIcon } from "../shared/MaterialIcon";

interface Med {
  name: string;
  dosage: string;
}

interface ApptInfo {
  dateTime?: string;
  date?: string;
  time?: string;
}

interface Props {
  petName: string;
  petId: string;
  species?: "dog" | "cat";
  medications: Med[];
  nextAppointment: ApptInfo | null;
  onPointsEarned?: (total: number) => void;
}

// Cork — dog mascot (teal)
function CorkMascot({ size = 40 }: { size?: number }) {
  return (
    <svg viewBox="0 0 60 72" width={size} height={size * 1.2} style={{ display: "block" }}>
      <ellipse cx="30" cy="56" rx="15" ry="11" fill="#d4ede8" stroke="#074738" strokeWidth="1.5" />
      <circle cx="30" cy="30" r="14" fill="#d4ede8" stroke="#074738" strokeWidth="1.5" />
      <ellipse cx="18" cy="18" rx="5.5" ry="9" fill="#1A9B7D" stroke="#074738" strokeWidth="1.5" transform="rotate(-18,18,18)" />
      <ellipse cx="42" cy="18" rx="5.5" ry="9" fill="#1A9B7D" stroke="#074738" strokeWidth="1.5" transform="rotate(18,42,18)" />
      <circle cx="25" cy="28" r="2.5" fill="#074738" />
      <circle cx="35" cy="28" r="2.5" fill="#074738" />
      <circle cx="25.8" cy="27" r="1" fill="white" />
      <circle cx="35.8" cy="27" r="1" fill="white" />
      <ellipse cx="30" cy="35" rx="4" ry="3" fill="#074738" />
      <path d="M24 38 Q30 44 36 38" stroke="#074738" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      <rect x="22" y="60" width="6" height="8" rx="3" fill="#d4ede8" stroke="#074738" strokeWidth="1.5" />
      <rect x="32" y="60" width="6" height="8" rx="3" fill="#d4ede8" stroke="#074738" strokeWidth="1.5" />
    </svg>
  );
}

// Fizz — cat mascot (warm peach/orange)
function FizzMascot({ size = 40 }: { size?: number }) {
  return (
    <svg viewBox="0 0 60 72" width={size} height={size * 1.2} style={{ display: "block" }}>
      {/* Body */}
      <ellipse cx="30" cy="57" rx="13" ry="10" fill="#FDDCB5" stroke="#C67B3A" strokeWidth="1.5" />
      {/* Head */}
      <circle cx="30" cy="30" r="14" fill="#FDDCB5" stroke="#C67B3A" strokeWidth="1.5" />
      {/* Pointed cat ears */}
      <polygon points="16,20 11,6 23,14" fill="#F4A261" stroke="#C67B3A" strokeWidth="1.5" strokeLinejoin="round" />
      <polygon points="44,20 49,6 37,14" fill="#F4A261" stroke="#C67B3A" strokeWidth="1.5" strokeLinejoin="round" />
      {/* Eyes */}
      <ellipse cx="25" cy="28" rx="2.5" ry="3" fill="#5C3A1E" />
      <ellipse cx="35" cy="28" rx="2.5" ry="3" fill="#5C3A1E" />
      <circle cx="25.8" cy="27" r="1" fill="white" />
      <circle cx="35.8" cy="27" r="1" fill="white" />
      {/* Nose */}
      <ellipse cx="30" cy="34" rx="2.5" ry="1.8" fill="#E8856A" />
      {/* Whiskers */}
      <line x1="14" y1="33" x2="25" y2="34" stroke="#C67B3A" strokeWidth="0.8" />
      <line x1="14" y1="36" x2="25" y2="35" stroke="#C67B3A" strokeWidth="0.8" />
      <line x1="46" y1="33" x2="35" y2="34" stroke="#C67B3A" strokeWidth="0.8" />
      <line x1="46" y1="36" x2="35" y2="35" stroke="#C67B3A" strokeWidth="0.8" />
      {/* Smile */}
      <path d="M26 37 Q30 41 34 37" stroke="#C67B3A" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      {/* Paws */}
      <ellipse cx="24" cy="64" rx="5" ry="4" fill="#FDDCB5" stroke="#C67B3A" strokeWidth="1.5" />
      <ellipse cx="36" cy="64" rx="5" ry="4" fill="#FDDCB5" stroke="#C67B3A" strokeWidth="1.5" />
    </svg>
  );
}

function PetMascot({ species, size }: { species?: "dog" | "cat"; size?: number }) {
  return species === "cat" ? <FizzMascot size={size} /> : <CorkMascot size={size} />;
}

function daysUntil(appt: ApptInfo): number {
  const iso = appt.dateTime || (appt.date ? `${appt.date}T${appt.time || "09:00"}:00` : "");
  if (!iso) return 999;
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
}

type Kind = "medication" | "appointment" | "mood";

interface Context {
  kind: Kind;
  headline: string;
  subtext: string;
  medLabel?: string;
  apptDays?: number;
}

function buildContext(petName: string, medications: Med[], nextAppointment: ApptInfo | null): Context {
  // Priority 1: active medication → ask if taken today
  if (medications.length > 0) {
    const med = medications[0];
    const medLabel = med.dosage ? `${med.name} · ${med.dosage}` : med.name;
    return {
      kind: "medication",
      headline: `¿Ya tomó ${med.name} hoy?`,
      subtext: `${petName} tiene tratamiento activo. Registrar la dosis mantiene el historial al día.`,
      medLabel,
    };
  }

  // Priority 2: appointment within 7 days
  if (nextAppointment) {
    const days = daysUntil(nextAppointment);
    if (days >= 0 && days <= 7) {
      const apptDays = days;
      const headline =
        days === 0 ? "Cita con el vet hoy 🩺" :
        days === 1 ? "Cita con el vet mañana" :
        `Cita con el vet en ${days} días`;
      return {
        kind: "appointment",
        headline,
        subtext: `¿Cómo está ${petName} antes de la cita?`,
        apptDays,
      };
    }
  }

  // Default: quick mood check
  return {
    kind: "mood",
    headline: `¿Cómo estuvo ${petName} hoy?`,
    subtext: "Un segundo nada más.",
  };
}

const MOODS = [
  { emoji: "😊", label: "Bien", value: "bien" },
  { emoji: "😐", label: "Normal", value: "normal" },
  { emoji: "😟", label: "No tan bien", value: "mal" },
];

export default function PessyDailyCheckin({ petName, petId, species, medications, nextAppointment, onPointsEarned }: Props) {
  const { user } = useAuth();
  const [expanded, setExpanded] = useState(false);
  const [done, setDone] = useState(false);
  const [saving, setSaving] = useState(false);
  const [celebrating, setCelebrating] = useState<"yes" | "no" | null>(null);

  const ctx = buildContext(petName, medications, nextAppointment);

  // Auto-dismiss celebration → done
  useEffect(() => {
    if (!celebrating) return;
    const t = setTimeout(() => { setCelebrating(null); setDone(true); }, celebrating === "yes" ? 2200 : 1400);
    return () => clearTimeout(t);
  }, [celebrating]);

  const save = async (payload: Record<string, unknown>, pts: number) => {
    if (!user || saving) return;
    setSaving(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const ref = doc(db, "users", user.uid, "pets", petId, "dailyCheckins", today);
      await setDoc(ref, { date: today, petId, ...payload, createdAt: new Date().toISOString() });
      const total = addPoints(pts);
      onPointsEarned?.(total);
    } catch (e) {
      console.error("[PessyDailyCheckin]", e);
      setCelebrating(null);
    } finally {
      setSaving(false);
    }
  };

  const handleMedResponse = (taken: boolean) => {
    setCelebrating(taken ? "yes" : "no");
    void save({ kind: "medication", medName: ctx.medLabel, takenToday: taken }, taken ? 20 : 5);
  };

  // ── Celebrating — stars + bouncing Cork ─────────────────────────────────────
  if (celebrating) {
    const isYes = celebrating === "yes";
    return (
      <div
        className={`rounded-2xl p-4 transition-all duration-500 ${isYes ? "bg-[#074738]" : "bg-white border border-[#E5E7EB]"}`}
        style={{ boxShadow: isYes ? "0 8px 24px rgba(7,71,56,0.3)" : "0 2px 8px rgba(0,0,0,0.04)" }}
      >
        {isYes && (
          <div className="flex justify-around mb-3 pointer-events-none select-none">
            {["⭐", "✨", "🌟", "⭐", "✨"].map((s, i) => (
              <span key={i} className="animate-bounce text-xl inline-block"
                style={{ animationDelay: `${i * 90}ms`, animationDuration: "0.6s" }}>{s}</span>
            ))}
          </div>
        )}
        <div className="flex items-center gap-3">
          <div className={isYes ? "animate-bounce" : ""} style={{ animationDuration: "0.7s" }}>
            <PetMascot species={species} size={44} />
          </div>
          <div>
            <p className={`text-sm font-bold ${isYes ? "text-white" : "text-slate-700"}`}>
              {isYes ? `¡Genial! ${petName} está al día 🌟` : "Sin problema, te recuerdo más tarde 🐾"}
            </p>
            {isYes && <p className="text-white/60 text-xs mt-0.5 font-medium">+20 pts ganados</p>}
          </div>
        </div>
      </div>
    );
  }

  // ── Confirmed ────────────────────────────────────────────────────────────────
  if (done) {
    return (
      <div className="bg-white rounded-2xl border border-[#E5E7EB] p-4 flex items-center gap-3"
        style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
        <PetMascot species={species} size={40} />
        <div>
          <p className="text-sm font-bold text-[#074738]">¡Listo! Anotado ✓</p>
          <p className="text-xs text-slate-500 mt-0.5">Mañana vuelvo a preguntar 🐾</p>
        </div>
      </div>
    );
  }

  // ── Collapsed ────────────────────────────────────────────────────────────────
  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className="w-full bg-white rounded-2xl border border-[#E5E7EB] p-4 text-left active:scale-[0.98] transition-transform"
        style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}
      >
        <div className="flex items-start gap-3">
          <div className="shrink-0">
            <PetMascot species={species} size={36} />
          </div>
          <div className="flex-1 min-w-0">
            {ctx.kind === "medication" && ctx.medLabel && (
              <p className="text-xs font-bold text-[#1A9B7D] mb-1">
                💊 {ctx.medLabel}
              </p>
            )}
            <p className="text-sm font-bold text-slate-800 leading-snug">{ctx.headline}</p>
            <p className="text-xs text-[#1A9B7D] font-bold mt-2 flex items-center gap-1">
              <MaterialIcon name="touch_app" className="!text-[13px]" />
              Responder
            </p>
          </div>
        </div>
      </button>
    );
  }

  // ── Expanded — ONE question ──────────────────────────────────────────────────
  return (
    <div className="bg-white rounded-2xl border border-[#1A9B7D]/30 overflow-hidden"
      style={{ boxShadow: "0 4px 16px rgba(26,155,125,0.12)" }}>
      {/* Header */}
      <div className="bg-[#E0F2F1] px-4 py-3 flex items-center gap-2">
        <PetMascot species={species} size={28} />
        <p className="text-sm font-bold text-[#074738] flex-1">{ctx.headline}</p>
        <button onClick={() => setExpanded(false)} className="size-8 flex items-center justify-center">
          <MaterialIcon name="close" className="text-[#9CA3AF] text-lg" />
        </button>
      </div>

      <div className="p-4">
        {/* Medication: binary yes/no — celebration on yes, gentle dismiss on no */}
        {ctx.kind === "medication" && (
          <>
            <p className="text-xs text-slate-500 mb-3">{ctx.subtext}</p>
            <div className="flex gap-3">
              <button
                onClick={() => handleMedResponse(true)}
                disabled={saving}
                className="flex-1 py-4 rounded-2xl bg-[#074738] text-white font-bold text-sm disabled:opacity-60 active:scale-[0.98] transition-transform"
              >
                ✓ Sí, ya la tomó
                <span className="block text-[10px] text-white/70 font-normal mt-0.5">+20 pts</span>
              </button>
              <button
                onClick={() => handleMedResponse(false)}
                disabled={saving}
                className="flex-1 py-4 rounded-2xl border-2 border-slate-200 text-slate-600 font-bold text-sm disabled:opacity-60 active:scale-[0.98] transition-transform"
              >
                Todavía no
                <span className="block text-[10px] text-slate-400 font-normal mt-0.5">+5 pts igual</span>
              </button>
            </div>
          </>
        )}

        {/* Appointment or mood: emoji picker — 1 tap done */}
        {(ctx.kind === "appointment" || ctx.kind === "mood") && (
          <>
            <p className="text-xs text-slate-500 mb-3">{ctx.subtext}</p>
            <div className="flex gap-2">
              {MOODS.map((m) => (
                <button
                  key={m.value}
                  onClick={() => save({ kind: ctx.kind, mood: m.value }, 10)}
                  disabled={saving}
                  className="flex-1 py-3 rounded-2xl border-2 border-slate-200 flex flex-col items-center gap-1 disabled:opacity-60 active:scale-[0.97] transition-transform"
                >
                  <span className="text-2xl">{m.emoji}</span>
                  <span className="text-xs font-bold text-slate-600">{m.label}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
