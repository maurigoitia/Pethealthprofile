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
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import { useAuth } from "../../contexts/AuthContext";
import { useMedical } from "../../contexts/MedicalContext";
import type { PendingAction } from "../../types/medical";
import { useGamification } from "../../contexts/GamificationContext";
import { cleanText } from "../../utils/cleanText";
import { MaterialIcon } from "../shared/MaterialIcon";
import { CorkMascot } from "../shared/CorkMascot";
import { FizzMascot } from "../shared/FizzMascot";

interface Med {
  name: string;
  dosage: string;
  frequency?: string;
  startDate?: string;
  endDate?: string | null;
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
  pendingActions: PendingAction[];
  onPointsEarned?: (total: number) => void;
}

function PetMascot({ species, size }: { species?: "dog" | "cat"; size?: number }) {
  return species === "cat" ? <FizzMascot size={size} /> : <CorkMascot size={size} />;
}

function daysUntil(appt: ApptInfo): number {
  const iso = appt.dateTime || (appt.date ? `${appt.date}T${appt.time || "09:00"}:00` : "");
  if (!iso) return 999;
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
}

type Kind = "medication" | "appointment" | "pending" | "mood";

interface Context {
  kind: Kind;
  headline: string;
  subtext: string;
  medName?: string;
  medLabel?: string;
  apptDays?: number;
  pendingActionId?: string;
  pendingActionType?: PendingAction["type"];
}

function parseFrequencyHours(value?: string | null): number | null {
  if (!value) return null;
  const normalized = value
    .toLowerCase()
    .replace(",", ".")
    .replace(/\s+/g, " ")
    .trim();

  const eachMatch =
    normalized.match(/(?:cada|c\/|q)\s*(\d+(?:\.\d+)?)\s*(?:h|hs|hora|horas)\b/) ||
    normalized.match(/\b(\d+(?:\.\d+)?)\s*(?:h|hs|hora|horas)\b/);

  if (eachMatch) {
    const hours = Number(eachMatch[1]);
    return Number.isFinite(hours) && hours > 0 ? hours : null;
  }

  const dailyMatch = normalized.match(/(\d+)\s*veces?\s*al\s*d[ií]a/);
  if (dailyMatch) {
    const times = Number(dailyMatch[1]);
    return Number.isFinite(times) && times > 0 ? Math.round(24 / times) : null;
  }

  if (/diario|diaria|cada\s+24\s*h/.test(normalized)) return 24;
  return null;
}

function computeNextDoseIso(frequency?: string | null): string | null {
  const hours = parseFrequencyHours(frequency);
  if (!hours) return null;
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}

function getProactivePendingAction(pendingActions: PendingAction[]): PendingAction | null {
  return pendingActions.find((action) =>
    action.type === "vaccine_due" || action.type === "follow_up" || action.type === "checkup_due"
  ) ?? null;
}

function buildContext(petName: string, medications: Med[], nextAppointment: ApptInfo | null, pendingActions: PendingAction[]): Context {
  // Priority 1: active medication → ask if taken today
  if (medications.length > 0) {
    const med = medications[0];
    const medLabel = med.dosage ? `${med.name} · ${med.dosage}` : med.name;
    return {
      kind: "medication",
      headline: `¿Ya tomó ${med.name} hoy?`,
      subtext: `Cuando la confirmás acá, también actualizamos el seguimiento del tratamiento.`,
      medName: med.name,
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

  const pendingAction = getProactivePendingAction(pendingActions);
  if (pendingAction) {
    const dueDateLabel = pendingAction.dueDate
      ? new Date(pendingAction.dueDate).toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "short" })
      : null;
    const headline =
      pendingAction.type === "vaccine_due"
        ? `Vacuna pendiente para ${petName}`
        : pendingAction.type === "follow_up"
          ? `Seguimiento pendiente de ${petName}`
          : `Control pendiente para ${petName}`;
    const summary = pendingAction.subtitle || pendingAction.title;
    return {
      kind: "pending",
      headline,
      subtext: dueDateLabel ? `${summary}. Vence ${dueDateLabel}. ¿Cómo está hoy?` : `${summary}. ¿Cómo está hoy?`,
      pendingActionId: pendingAction.id,
      pendingActionType: pendingAction.type,
    };
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

export default function PessyDailyCheckin({ petName, petId, species, medications, nextAppointment, pendingActions, onPointsEarned }: Props) {
  const { user } = useAuth();
  const { getActiveMedicationsByPetId, updateMedication } = useMedical();
  const { addPoints: addPointsToContext } = useGamification();
  const [expanded, setExpanded] = useState(false);
  const [completedToday, setCompletedToday] = useState(false);
  const [saving, setSaving] = useState(false);
  const [celebrating, setCelebrating] = useState<"yes" | "no" | null>(null);

  const ctx = buildContext(petName, medications, nextAppointment, pendingActions);

  useEffect(() => {
    let cancelled = false;
    setExpanded(false);
    setCompletedToday(false);

    const loadTodayCheckin = async () => {
      if (!user || !petId) return;
      try {
        const today = new Date().toISOString().slice(0, 10);
        const ref = doc(db, "users", user.uid, "pets", petId, "dailyCheckins", today);
        const snapshot = await getDoc(ref);
        if (!cancelled && snapshot.exists()) {
          setCompletedToday(true);
        }
      } catch (e) {
        console.error("[PessyDailyCheckin] loadTodayCheckin", e);
      }
    };

    void loadTodayCheckin();

    return () => {
      cancelled = true;
    };
  }, [user?.uid, petId]);

  // Auto-dismiss celebration → done
  useEffect(() => {
    if (!celebrating) return;
    const t = setTimeout(() => { setCelebrating(null); setCompletedToday(true); }, celebrating === "yes" ? 2200 : 1400);
    return () => clearTimeout(t);
  }, [celebrating]);

  const save = async (payload: Record<string, unknown>, pts: number) => {
    if (!user || saving) return;
    setSaving(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const ref = doc(db, "users", user.uid, "pets", petId, "dailyCheckins", today);
      await setDoc(ref, { date: today, petId, ...payload, createdAt: new Date().toISOString() });
      if (pts > 0) {
        await addPointsToContext("medication_logged");
        onPointsEarned?.(pts);
      }
    } catch (e) {
      console.error("[PessyDailyCheckin]", e);
      setCelebrating(null);
    } finally {
      setSaving(false);
    }
  };

  const syncCanonicalMedication = async () => {
    if (!petId || !ctx.medName) return;

    const normalizedTarget = cleanText(ctx.medName).toLowerCase();
    if (!normalizedTarget) return;

    const linkedMedication = getActiveMedicationsByPetId(petId).find((medication) => {
      if (!medication.active) return false;
      return cleanText(medication.name).toLowerCase() === normalizedTarget;
    });

    if (!linkedMedication) return;

    const nowIso = new Date().toISOString();
    await updateMedication(linkedMedication.id, {
      lastDoseAt: nowIso,
      nextDoseAt: computeNextDoseIso(linkedMedication.frequency),
    });
  };

  const handleMedResponse = (taken: boolean) => {
    setCelebrating(taken ? "yes" : "no");
    void (async () => {
      if (taken) {
        try {
          await syncCanonicalMedication();
        } catch (error) {
          console.error("[PessyDailyCheckin] syncCanonicalMedication", error);
        }
      }

      await save(
        { kind: "medication", medName: ctx.medLabel, takenToday: taken },
        taken ? 20 : 0
      );
    })();
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
              {isYes ? "Listo, registré la dosis de hoy." : "Entendido, la dejamos pendiente por hoy."}
            </p>
            <p className={`text-xs mt-0.5 font-medium ${isYes ? "text-white/70" : "text-slate-500"}`}>
              {isYes ? "También quedó actualizada en tratamientos." : "Mañana volvemos a preguntarlo."}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Completed for today — hide card until tomorrow ──────────────────────────
  if (completedToday) {
    return null;
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
              <MaterialIcon name="check_circle" className="!text-[13px]" />
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
              </button>
              <button
                onClick={() => handleMedResponse(false)}
                disabled={saving}
                className="flex-1 py-4 rounded-2xl border-2 border-slate-200 text-slate-600 font-bold text-sm disabled:opacity-60 active:scale-[0.98] transition-transform"
              >
                Todavía no
              </button>
            </div>
          </>
        )}

        {/* Appointment or mood: emoji picker — 1 tap done */}
        {(ctx.kind === "appointment" || ctx.kind === "pending" || ctx.kind === "mood") && (
          <>
            <p className="text-xs text-slate-500 mb-3">{ctx.subtext}</p>
            <div className="flex gap-2">
              {MOODS.map((m) => (
                <button
                  key={m.value}
                  onClick={() => save({ kind: ctx.kind, mood: m.value, pendingActionId: ctx.pendingActionId, pendingActionType: ctx.pendingActionType }, 10)}
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
