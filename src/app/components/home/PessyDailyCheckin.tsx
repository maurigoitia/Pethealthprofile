import { useState } from "react";
import { doc, setDoc } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import { useAuth } from "../../contexts/AuthContext";
import { MaterialIcon } from "../shared/MaterialIcon";

interface PessyDailyCheckinProps {
  petName: string;
  petId: string;
  hasMedications?: boolean;
}

type FormState = {
  howWas: string;
  ateWell: boolean | null;
  exercised: boolean | null;
  concern: string;
};

// Cork mascot — inline SVG so no extra deps
function CorkMascot({ size = 44 }: { size?: number }) {
  const s = size / 60;
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
      {/* invisible scale ref */}
      <rect opacity="0" x="0" y="0" width={60 / s} height={72 / s} />
    </svg>
  );
}

export default function PessyDailyCheckin({ petName, petId, hasMedications }: PessyDailyCheckinProps) {
  const { user } = useAuth();
  const [expanded, setExpanded] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormState>({
    howWas: "",
    ateWell: null,
    exercised: null,
    concern: "",
  });

  const handleSubmit = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const ref = doc(db, "users", user.uid, "pets", petId, "dailyCheckins", today);
      await setDoc(ref, {
        date: today,
        petId,
        howWas: form.howWas.trim(),
        ateWell: form.ateWell,
        exercised: form.exercised,
        concern: form.concern.trim(),
        createdAt: new Date().toISOString(),
      });
      setSubmitted(true);
    } catch (e) {
      console.error("[PessyDailyCheckin] save error:", e);
    } finally {
      setSaving(false);
    }
  };

  // ── Confirmation ────────────────────────────────────────────────────────────
  if (submitted) {
    return (
      <div className="bg-white rounded-2xl border border-[#E5E7EB] p-4 shadow-[0_2px_8px_rgba(0,0,0,0.04)] flex items-center gap-3">
        <CorkMascot size={44} />
        <div>
          <p
            className="text-sm font-bold text-[#074738]"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          >
            ¡Genial! Anoté todo sobre {petName}
          </p>
          <p className="text-xs text-slate-500 mt-0.5">
            Gracias por contarme. Mañana vuelvo a preguntar 🐾
          </p>
        </div>
      </div>
    );
  }

  // ── Collapsed card ──────────────────────────────────────────────────────────
  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className="w-full bg-white rounded-2xl border border-[#E5E7EB] p-4 text-left shadow-[0_2px_8px_rgba(0,0,0,0.04)] active:scale-[0.98] transition-transform"
      >
        <div className="flex items-start gap-3">
          <div className="shrink-0 mt-0.5">
            <CorkMascot size={36} />
          </div>
          <div className="flex-1 min-w-0">
            {hasMedications && (
              <p className="text-xs font-bold text-[#1A9B7D] mb-1">
                💊 Estoy pendiente del tratamiento de {petName}
              </p>
            )}
            <p
              className="text-sm font-semibold text-slate-800 leading-snug"
              style={{ fontFamily: "'Manrope', sans-serif" }}
            >
              Extraño saber de {petName}. Cuando quieras, contame cómo está.
            </p>
            <p className="text-xs text-[#1A9B7D] font-bold mt-1.5 flex items-center gap-1">
              <MaterialIcon name="chat_bubble_outline" className="!text-[13px]" />
              Contame
            </p>
          </div>
          <MaterialIcon name="expand_more" className="text-[#9CA3AF] shrink-0 text-xl mt-0.5" />
        </div>
      </button>
    );
  }

  // ── Expanded check-in form ──────────────────────────────────────────────────
  return (
    <div className="bg-white rounded-2xl border border-[#1A9B7D]/30 shadow-[0_4px_16px_rgba(26,155,125,0.12)] overflow-hidden">
      {/* Header */}
      <div className="bg-[#E0F2F1] px-4 py-3 flex items-center gap-2">
        <CorkMascot size={28} />
        <p
          className="text-sm font-bold text-[#074738] flex-1"
          style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
        >
          ¿Cómo fue el día de {petName}?
        </p>
        <button onClick={() => setExpanded(false)} className="size-8 flex items-center justify-center">
          <MaterialIcon name="close" className="text-[#9CA3AF] text-lg" />
        </button>
      </div>

      <div className="p-4 space-y-4">
        {/* How was the day */}
        <div>
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-1.5">
            ¿Cómo estuvo {petName} hoy?
          </label>
          <input
            type="text"
            value={form.howWas}
            onChange={(e) => setForm((f) => ({ ...f, howWas: e.target.value }))}
            placeholder="Cuéntame en pocas palabras..."
            className="w-full px-3 py-2.5 rounded-xl border border-[#E5E7EB] text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#1A9B7D] transition-colors"
          />
        </div>

        {/* Ate well */}
        <div>
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-1.5">
            ¿Comió bien?
          </label>
          <div className="flex gap-2">
            {([true, false] as const).map((val) => (
              <button
                key={String(val)}
                onClick={() => setForm((f) => ({ ...f, ateWell: val }))}
                className={`flex-1 py-2.5 rounded-xl text-sm font-bold border-2 transition-colors ${
                  form.ateWell === val
                    ? "bg-[#074738] text-white border-[#074738]"
                    : "bg-white text-slate-700 border-[#E5E7EB] active:bg-[#F0FAF9]"
                }`}
              >
                {val ? "Sí" : "No"}
              </button>
            ))}
          </div>
        </div>

        {/* Exercised */}
        <div>
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-1.5">
            ¿Hizo ejercicio?
          </label>
          <div className="flex gap-2">
            {([true, false] as const).map((val) => (
              <button
                key={String(val)}
                onClick={() => setForm((f) => ({ ...f, exercised: val }))}
                className={`flex-1 py-2.5 rounded-xl text-sm font-bold border-2 transition-colors ${
                  form.exercised === val
                    ? "bg-[#074738] text-white border-[#074738]"
                    : "bg-white text-slate-700 border-[#E5E7EB] active:bg-[#F0FAF9]"
                }`}
              >
                {val ? "Sí" : "No"}
              </button>
            ))}
          </div>
        </div>

        {/* Concern */}
        <div>
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-1.5">
            ¿Algo que te preocupe?
          </label>
          <input
            type="text"
            value={form.concern}
            onChange={(e) => setForm((f) => ({ ...f, concern: e.target.value }))}
            placeholder="Opcional..."
            className="w-full px-3 py-2.5 rounded-xl border border-[#E5E7EB] text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#1A9B7D] transition-colors"
          />
        </div>

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={saving}
          className="w-full py-3 rounded-xl bg-[#1A9B7D] text-white font-bold text-sm shadow-lg shadow-[#1A9B7D]/25 active:scale-[0.98] transition-transform disabled:opacity-60"
          style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
        >
          {saving ? "Guardando..." : `Anotar el día de ${petName}`}
        </button>
      </div>
    </div>
  );
}
