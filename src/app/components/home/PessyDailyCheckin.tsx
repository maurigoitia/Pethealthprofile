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

import { useState } from "react";
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
  medications: Med[];
  nextAppointment: ApptInfo | null;
  onPointsEarned?: (total: number) => void;
}

// Cork mascot — inline SVG, no external deps
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

export default function PessyDailyCheckin({ petName, petId, medications, nextAppointment, onPointsEarned }: Props) {
  const { user } = useAuth();
  const [expanded, setExpanded] = useState(false);
  const [done, setDone] = useState(false);
  const [saving, setSaving] = useState(false);

  const ctx = buildContext(petName, medications, nextAppointment);

  const save = async (payload: Record<string, unknown>, pts: number) => {
    if (!user || saving) return;
    setSaving(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const ref = doc(db, "users", user.uid, "pets", petId, "dailyCheckins", today);
      await setDoc(ref, { date: today, petId, ...payload, createdAt: new Date().toISOString() });
      const total = addPoints(pts);
      onPointsEarned?.(total);
      setDone(true);
    } catch (e) {
      console.error("[PessyDailyCheckin]", e);
      setSaving(false);
    }
  };

  // ── Confirmed ────────────────────────────────────────────────────────────────
  if (done) {
    return (
      <div className="bg-white rounded-2xl border border-[#E5E7EB] p-4 flex items-center gap-3"
        style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
        <CorkMascot size={40} />
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
            <CorkMascot size={36} />
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
        <CorkMascot size={28} />
        <p className="text-sm font-bold text-[#074738] flex-1">{ctx.headline}</p>
        <button onClick={() => setExpanded(false)} className="size-8 flex items-center justify-center">
          <MaterialIcon name="close" className="text-[#9CA3AF] text-lg" />
        </button>
      </div>

      <div className="p-4">
        {/* Medication: binary yes/no — gamification reward on yes */}
        {ctx.kind === "medication" && (
          <>
            <p className="text-xs text-slate-500 mb-3">{ctx.subtext}</p>
            <div className="flex gap-3">
              <button
                onClick={() => save({ kind: "medication", medName: ctx.medLabel, takenToday: true }, 20)}
                disabled={saving}
                className="flex-1 py-4 rounded-2xl bg-[#074738] text-white font-bold text-sm disabled:opacity-60 active:scale-[0.98] transition-transform"
              >
                ✓ Sí, ya la tomó
                <span className="block text-[10px] text-white/70 font-normal mt-0.5">+20 pts</span>
              </button>
              <button
                onClick={() => save({ kind: "medication", medName: ctx.medLabel, takenToday: false }, 5)}
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
