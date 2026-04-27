/**
 * AdopterProfileSetup — onboarding del usuario para matchings de adopción.
 *
 * Captura los inputs que necesita `computeMatchScore` (adoptionMatcher.ts):
 *   - livingSpace
 *   - hasYard
 *   - otherPets (count)
 *   - experienceLevel
 *   - activityPrefs (tags)
 *   - scheduleAvailability
 *
 * Persiste en Firestore: `users/{uid}/adopter_profile/main`.
 * Estilo Stitch + tokens Plano consistente con LoginScreen/Welcome.
 */
import { useState, useEffect } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import { useAuth } from "../../contexts/AuthContext";
import { ArrowLeft } from "lucide-react";
import { MaterialIcon } from "../shared/MaterialIcon";
import type {
  AdopterProfile,
  LivingSpace,
  ExperienceLevel,
} from "../../../domain/community/adoption.contract";

interface Props {
  onBack?: () => void;
  onComplete?: (profile: AdopterProfile) => void;
}

const LIVING_SPACE_OPTIONS: Array<{ value: LivingSpace; label: string; sub: string; icon: string }> = [
  { value: "apartment", label: "Departamento", sub: "Sin patio", icon: "apartment" },
  { value: "house_small", label: "Casa chica", sub: "Patio pequeño", icon: "home" },
  { value: "house_big", label: "Casa grande", sub: "Espacio amplio", icon: "house" },
  { value: "rural", label: "Campo / quinta", sub: "Espacio abierto", icon: "yard" },
];

const EXPERIENCE_OPTIONS: Array<{ value: ExperienceLevel; label: string; sub: string }> = [
  { value: "first_time", label: "Primera vez", sub: "Voy a aprender" },
  { value: "experienced", label: "Tuve antes", sub: "Sé manejar lo básico" },
  { value: "professional", label: "Mucha experiencia", sub: "Casos especiales OK" },
];

const SCHEDULE_OPTIONS = [
  { value: "low" as const, label: "Poco tiempo", sub: "Trabajo full-time, fines de semana" },
  { value: "medium" as const, label: "Tiempo medio", sub: "Algunas horas todos los días" },
  { value: "high" as const, label: "Mucho tiempo", sub: "Estoy bastante en casa" },
];

const ACTIVITY_TAGS = [
  "Caminatas largas",
  "Correr",
  "Jugar",
  "Ir a la plaza",
  "Estar en casa",
  "Viajes cortos",
];

export function AdopterProfileSetup({ onBack, onComplete }: Props) {
  const { user } = useAuth();
  const [livingSpace, setLivingSpace] = useState<LivingSpace>("apartment");
  const [hasYard, setHasYard] = useState(false);
  const [otherPets, setOtherPets] = useState(0);
  const [experience, setExperience] = useState<ExperienceLevel>("first_time");
  const [schedule, setSchedule] = useState<"low" | "medium" | "high">("medium");
  const [activityPrefs, setActivityPrefs] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Cargar perfil existente
  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const snap = await getDoc(doc(db, "users", user.uid, "adopter_profile", "main"));
        if (snap.exists()) {
          const data = snap.data() as AdopterProfile;
          setLivingSpace(data.livingSpace || "apartment");
          setHasYard(!!data.hasYard);
          setOtherPets(data.otherPets || 0);
          setExperience(data.experienceLevel || "first_time");
          setSchedule(data.scheduleAvailability || "medium");
          setActivityPrefs(data.activityPrefs || []);
        }
      } catch (err) {
        console.warn("[AdopterProfile] no se pudo cargar perfil:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  const toggleTag = (tag: string) => {
    setActivityPrefs((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  };

  const handleSave = async () => {
    if (!user) {
      setError("Tenés que iniciar sesión para guardar.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const profile: AdopterProfile = {
        userId: user.uid,
        livingSpace,
        hasYard,
        otherPets,
        experienceLevel: experience,
        activityPrefs,
        scheduleAvailability: schedule,
      };
      await setDoc(doc(db, "users", user.uid, "adopter_profile", "main"), profile);
      onComplete?.(profile);
    } catch (e: any) {
      console.error("[AdopterProfile] error saving:", e);
      setError(e?.message || "No pudimos guardar. Probá de nuevo.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F0FAF9] flex items-center justify-center">
        <div className="size-10 rounded-full border-4 border-[#074738]/20 border-t-[#074738] animate-spin" />
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-[#F0FAF9]"
      style={{ fontFamily: "Manrope, sans-serif" }}
    >
      {/* Header sticky Stitch */}
      <div className="sticky top-0 z-40 bg-[#F0FAF9]/85 backdrop-blur-md px-4 pt-4 pb-3">
        <div className="flex items-center gap-3 mb-1">
          {onBack && (
            <button
              onClick={onBack}
              aria-label="Volver"
              className="size-11 rounded-full bg-white border border-[#E5E7EB] flex items-center justify-center active:scale-[0.96] transition-transform"
              style={{ boxShadow: "0 1px 3px rgba(7,71,56,0.04)" }}
            >
              <ArrowLeft size={18} color="#074738" />
            </button>
          )}
          <h1
            className="flex-1 text-[22px] font-extrabold text-[#074738] leading-tight"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", letterSpacing: "-0.02em" }}
          >
            Tu perfil de adoptante
          </h1>
        </div>
      </div>

      <main
        className="max-w-md mx-auto px-4 py-2 pb-32"
        style={{ paddingBottom: "max(8rem, env(safe-area-inset-bottom))" }}
      >
        <p
          className="text-sm text-[#6B7280] mb-6 leading-relaxed"
          style={{ fontFamily: "Manrope, sans-serif" }}
        >
          Esto nos ayuda a mostrarte mascotas que encajen con tu casa y tu rutina.
          Podés cambiarlo cuando quieras.
        </p>

        {/* Living space */}
        <Section title="¿Cómo es tu casa?">
          <div className="grid grid-cols-2 gap-2">
            {LIVING_SPACE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setLivingSpace(opt.value)}
                className={`p-3 rounded-[14px] border text-left active:scale-[0.97] transition-all min-h-[72px] ${
                  livingSpace === opt.value
                    ? "bg-[#1A9B7D]/10 border-[#1A9B7D] text-[#074738]"
                    : "bg-white border-[#E5E7EB] text-[#1A1A1A]"
                }`}
              >
                <MaterialIcon
                  name={opt.icon}
                  className={`text-xl mb-1 block ${livingSpace === opt.value ? "text-[#1A9B7D]" : "text-[#6B7280]"}`}
                />
                <p
                  className="text-sm font-bold leading-tight"
                  style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                >
                  {opt.label}
                </p>
                <p className="text-[11px] text-[#6B7280] mt-0.5">{opt.sub}</p>
              </button>
            ))}
          </div>
        </Section>

        {/* Has yard */}
        <Section title="¿Tenés patio o jardín?">
          <ToggleCard checked={hasYard} onChange={setHasYard} />
        </Section>

        {/* Other pets */}
        <Section title="¿Cuántas mascotas tenés ya?">
          <div className="flex items-center gap-3 bg-white rounded-[14px] border border-[#E5E7EB] px-4 py-3">
            <button
              type="button"
              onClick={() => setOtherPets(Math.max(0, otherPets - 1))}
              className="size-11 rounded-full bg-[#F0FAF9] border border-[#E5E7EB] flex items-center justify-center active:scale-[0.96] transition-transform"
              aria-label="Menos"
            >
              <span className="text-2xl text-[#074738] leading-none">−</span>
            </button>
            <div className="flex-1 text-center">
              <span
                className="text-3xl font-extrabold text-[#074738]"
                style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
              >
                {otherPets}
              </span>
              <p className="text-xs text-[#6B7280] mt-0.5">
                {otherPets === 0 ? "ninguna" : otherPets === 1 ? "mascota" : "mascotas"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOtherPets(Math.min(10, otherPets + 1))}
              className="size-11 rounded-full bg-[#1A9B7D] flex items-center justify-center active:scale-[0.96] transition-transform"
              aria-label="Más"
            >
              <span className="text-2xl text-white leading-none">+</span>
            </button>
          </div>
        </Section>

        {/* Experience */}
        <Section title="¿Cuánta experiencia con mascotas?">
          <div className="space-y-2">
            {EXPERIENCE_OPTIONS.map((opt) => (
              <RadioCard
                key={opt.value}
                checked={experience === opt.value}
                onClick={() => setExperience(opt.value)}
                label={opt.label}
                sub={opt.sub}
              />
            ))}
          </div>
        </Section>

        {/* Schedule */}
        <Section title="¿Cuánto tiempo tenés en casa?">
          <div className="space-y-2">
            {SCHEDULE_OPTIONS.map((opt) => (
              <RadioCard
                key={opt.value}
                checked={schedule === opt.value}
                onClick={() => setSchedule(opt.value)}
                label={opt.label}
                sub={opt.sub}
              />
            ))}
          </div>
        </Section>

        {/* Activity prefs */}
        <Section title="¿Qué te gustaría hacer con tu mascota?">
          <p className="text-xs text-[#6B7280] mb-3">Marcá lo que aplique. Podés elegir varios.</p>
          <div className="flex flex-wrap gap-2">
            {ACTIVITY_TAGS.map((tag) => {
              const active = activityPrefs.includes(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTag(tag)}
                  className={`min-h-[44px] px-4 py-2 rounded-full text-sm font-semibold border transition-all active:scale-[0.97] ${
                    active
                      ? "bg-[#1A9B7D]/10 border-[#1A9B7D] text-[#1A9B7D]"
                      : "bg-white border-[#E5E7EB] text-[#6B7280]"
                  }`}
                  style={{ fontFamily: "Manrope, sans-serif" }}
                >
                  {tag}
                </button>
              );
            })}
          </div>
        </Section>

        {error && (
          <div className="rounded-[12px] bg-red-50 border border-red-200 px-4 py-3 mb-3 text-sm font-semibold text-red-700">
            {error}
          </div>
        )}
      </main>

      {/* Save CTA fijo abajo */}
      <div
        className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-[#E5E7EB] px-4 py-3 z-50"
        style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
      >
        <div className="max-w-md mx-auto">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="w-full h-14 bg-[#074738] hover:bg-[#0e5c49] text-white text-[15px] font-bold rounded-[16px] shadow-[0_4px_14px_rgba(7,71,56,0.18)] active:scale-[0.97] disabled:opacity-60 transition-all flex items-center justify-center gap-2"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          >
            {saving ? (
              <>
                <div className="size-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                Guardando...
              </>
            ) : (
              "Guardar y ver matches"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Reusable subcomponents ─────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h2
        className="text-[10px] font-black uppercase tracking-[0.18em] text-[#074738] mb-2 ml-1"
        style={{ fontFamily: "Manrope, sans-serif" }}
      >
        {title}
      </h2>
      {children}
    </div>
  );
}

function RadioCard({
  checked,
  onClick,
  label,
  sub,
}: {
  checked: boolean;
  onClick: () => void;
  label: string;
  sub: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center gap-3 p-3 rounded-[14px] border min-h-[60px] active:scale-[0.98] transition-all text-left ${
        checked
          ? "bg-[#1A9B7D]/10 border-[#1A9B7D]"
          : "bg-white border-[#E5E7EB]"
      }`}
    >
      <div
        className={`size-6 rounded-full border-2 flex items-center justify-center shrink-0 ${
          checked ? "border-[#1A9B7D] bg-[#1A9B7D]" : "border-[#E5E7EB] bg-white"
        }`}
      >
        {checked && <div className="size-2.5 rounded-full bg-white" />}
      </div>
      <div className="flex-1 min-w-0">
        <p
          className="text-sm font-bold text-[#074738]"
          style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
        >
          {label}
        </p>
        <p className="text-[12px] text-[#6B7280] mt-0.5">{sub}</p>
      </div>
    </button>
  );
}

function ToggleCard({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between bg-white rounded-[14px] border border-[#E5E7EB] px-4 py-3 min-h-[60px]">
      <div className="flex-1">
        <p
          className="text-sm font-bold text-[#074738]"
          style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
        >
          {checked ? "Sí, tengo patio" : "No, sin patio"}
        </p>
        <p className="text-[12px] text-[#6B7280] mt-0.5">
          {checked ? "Espacio abierto disponible" : "Solo espacio interior"}
        </p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative w-12 h-7 rounded-full transition-colors min-h-[44px] min-w-[48px] flex items-center px-1 ${
          checked ? "bg-[#1A9B7D]" : "bg-slate-300"
        }`}
      >
        <span
          className={`size-5 bg-white rounded-full shadow transition-transform ${
            checked ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}
