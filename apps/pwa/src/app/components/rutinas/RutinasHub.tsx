import { useState } from "react";
import { useNavigate } from "react-router";
import { MaterialIcon } from "../shared/MaterialIcon";
import { doc, updateDoc } from "firebase/firestore";
import { usePet } from "../../contexts/PetContext";
import { useMedical } from "../../contexts/MedicalContext";
import { db } from "../../../lib/firebase";
import type { Pet, PetPreferences } from "../../contexts/PetContext";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Props {
  onBack: () => void;
}

type EnergyLevel = "high" | "medium" | "low";
type DataCompleteness = "rich" | "partial" | "minimal";

interface Recommendation {
  id: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  category: "actividad" | "alimentacion" | "cuidado" | "social";
  isActionable: boolean;
  ctaLabel?: string;
  ctaRoute?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getAgeYears(birthDate?: string): number | null {
  if (!birthDate) return null;
  const birth = new Date(birthDate);
  const now = new Date();
  return Math.floor((now.getTime() - birth.getTime()) / (1000 * 60 * 60 * 24 * 365.25));
}

function todayLabel(): string {
  return new Date().toLocaleDateString("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function classifyEnergy(pet: Pet, ageYears: number | null): EnergyLevel {
  const personality = pet.preferences?.personality ?? [];

  // Age-based overrides
  if (ageYears !== null) {
    if (ageYears < 1) return "high"; // Cachorro
    if (ageYears > 7 && (pet.species === "dog" || !pet.species)) return "low"; // Senior perro
  }

  // Personality-based
  if (personality.includes("energetic") || personality.includes("playful")) return "high";
  if (personality.includes("calm") || personality.includes("independent")) return "low";

  return "medium";
}

function getDataCompleteness(pet: Pet): DataCompleteness {
  const prefs = pet.preferences ?? {};
  const prefFields = [
    prefs.personality,
    prefs.favoriteActivities,
    prefs.walkTimes,
    prefs.foodType,
    prefs.fears,
  ].filter((f) => f !== undefined && (Array.isArray(f) ? f.length > 0 : true));

  if (pet.breed && pet.birthDate && prefFields.length >= 2) return "rich";
  if (pet.breed || pet.birthDate) return "partial";
  return "minimal";
}

function getNextWalkTime(walkTimes?: string[]): string | null {
  if (!walkTimes || walkTimes.length === 0) return null;
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const sorted = [...walkTimes].sort();
  for (const t of sorted) {
    const [h, m] = t.split(":").map(Number);
    if (isNaN(h) || isNaN(m)) continue;
    if (h * 60 + m > nowMinutes) return t;
  }
  // All walks passed today — show first walk of tomorrow
  return sorted[0];
}

function getRecommendations(
  pet: Pet,
  ageYears: number | null,
  energy: EnergyLevel
): Recommendation[] {
  const prefs = pet.preferences ?? {};
  const species = pet.species ?? "dog";
  const petName = pet.name;
  const recs: Recommendation[] = [];

  // No preferences at all → single prompt card
    if (!prefs.personality && !prefs.favoriteActivities && !prefs.walkTimes && !prefs.foodType && !prefs.fears) {
      recs.push({
        id: "complete-profile",
        icon: <MaterialIcon name="favorite" className="!text-[20px] text-[#1A9B7D]" />,
        title: "Completá el perfil",
      description: `Cuéntanos sobre ${petName} para recibir recomendaciones personalizadas cada día.`,
      category: "cuidado",
      isActionable: true,
      ctaLabel: "Cargar preferencias",
      ctaRoute: "/perfil",
    });
    return recs;
  }

  // Walk time reminder
  const nextWalk = getNextWalkTime(prefs.walkTimes);
  if (nextWalk) {
    recs.push({
      id: "walk-time",
      icon: <MaterialIcon name="pets" className="!text-[20px] text-[#1A9B7D]" />,
      title: "Próximo paseo",
      description: `Tu próximo paseo con ${petName} está programado para las ${nextWalk}.`,
      category: "actividad",
      isActionable: false,
    });
  }

  // Cat: environmental enrichment
  if (species === "cat") {
    recs.push({
      id: "cat-enrichment",
      icon: <MaterialIcon name="pets" className="!text-[20px] text-[#1A9B7D]" />,
      title: "Enriquecimiento ambiental",
      description: `Dedica 10 min hoy a jugar con ${petName} usando una varita o simulando una presa en movimiento.`,
      category: "actividad",
      isActionable: false,
    });
  }

  // Dog: activity by energy
  if (species === "dog" || !pet.species) {
    if (energy === "high") {
      recs.push({
        id: "active-play",
        icon: <MaterialIcon name="bolt" className="!text-[20px] text-[#074738]" />,
        title: "Tiempo de juego activo",
        description: `${petName} tiene mucha energía hoy. Un juego de búsqueda o carrera de 20-30 min sería ideal.`,
        category: "actividad",
        isActionable: false,
      });
    } else if (energy === "low") {
      recs.push({
        id: "gentle-walk",
        icon: <MaterialIcon name="air" className="!text-[20px] text-[#1A9B7D]" />,
        title: "Paseo suave",
        description: `Una caminata corta y sin esfuerzo es perfecta para ${petName} hoy.`,
        category: "actividad",
        isActionable: false,
      });
    } else if (energy === "medium") {
      recs.push({
        id: "moderate-activity",
        icon: <MaterialIcon name="remove" className="!text-[20px] text-[#1A9B7D]" />,
        title: "Actividad moderada",
        description: `Un paseo de 20-30 min o juego suave en casa es perfecto para ${petName} hoy.`,
        category: "actividad",
        isActionable: false,
      });
    }

    // Park suggestion if favorite activity includes park
    if (prefs.favoriteActivities?.includes("park")) {
      recs.push({
        id: "park-today",
        icon: <MaterialIcon name="park" className="!text-[20px] text-[#1A9B7D]" />,
        title: "Llevalo al parque hoy",
        description: `El parque es una de las actividades favoritas de ${petName}. ¡Hoy es un buen día para ir!`,
        category: "actividad",
        isActionable: true,
        ctaLabel: "Ver parques cercanos",
        ctaRoute: "/explorar",
      });
    }
  }

  // Puppy socialization
  if (ageYears !== null && ageYears < 1) {
    recs.push({
      id: "puppy-socialization",
      icon: <MaterialIcon name="people" className="!text-[20px] text-[#1A9B7D]" />,
      title: "Socialización temprana",
      description: `${petName} está en etapa clave. Exponerlo a personas nuevas, sonidos y entornos distintos hoy lo ayuda a crecer seguro.`,
      category: "social",
      isActionable: false,
    });
  }

  // Fear management if fears are set
  if (prefs.fears && prefs.fears.length > 0) {
    const fearList = prefs.fears.slice(0, 2).join(", ");
    recs.push({
      id: "fear-management",
      icon: <MaterialIcon name="security" className="!text-[20px] text-[#074738]" />,
      title: "Manejo de miedos",
      description: `${petName} puede tener sensibilidad a: ${fearList}. Si aparece ese estímulo, mantené calma y usá refuerzo positivo gradual.`,
      category: "cuidado",
      isActionable: false,
    });
  }

  // Max 4 recommendations
  return recs.slice(0, 4);
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2
      className="text-base font-bold text-[#074738] mb-3"
      style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
    >
      {children}
    </h2>
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white rounded-[16px] shadow-[0_2px_8px_rgba(0,0,0,0.04)] p-4 ${className}`}>
      {children}
    </div>
  );
}

const ENERGY_CONFIG: Record<EnergyLevel, { label: string; color: string; bg: string; iconName: string }> = {
  high: { label: "Energía alta", color: "text-green-700", bg: "bg-green-100", iconName: "bolt" },
  medium: { label: "Energía normal", color: "text-yellow-700", bg: "bg-yellow-100", iconName: "remove" },
  low: { label: "Energía baja", color: "text-slate-500", bg: "bg-slate-100", iconName: "air" },
};

// ---------------------------------------------------------------------------
// RutinasHub
// ---------------------------------------------------------------------------

export function RutinasHub({ onBack }: Props) {
  const navigate = useNavigate();
  const { activePet } = usePet();
  const { activeMedications } = useMedical();
  const [savingEnergy, setSavingEnergy] = useState(false);

  const pet = activePet;
  const petName = pet?.name ?? "tu mascota";
  const petMeds = pet ? activeMedications.filter((m) => m.petId === pet.id) : [];

  const ageYears = getAgeYears(pet?.birthDate);
  const energy = pet ? classifyEnergy(pet, ageYears) : "medium";
  const completeness = pet ? getDataCompleteness(pet) : "minimal";
  const recommendations = pet
    ? getRecommendations(pet, ageYears, energy)
    : [{
        id: "add-pet",
        icon: <MaterialIcon name="add_circle" className="!text-[20px] text-[#1A9B7D]" />,
        title: "Agregá tu mascota",
        description: "Creá el perfil de tu mascota para ver recomendaciones personalizadas.",
        category: "cuidado" as const,
        isActionable: true,
        ctaLabel: "Ir al inicio",
        ctaRoute: "/inicio",
      }];
  const nextWalk = getNextWalkTime(pet?.preferences?.walkTimes);

  const energyCfg = ENERGY_CONFIG[energy];

  async function handleQuickEnergy(value: "calm" | "energetic" | "playful") {
    if (!pet) return;
    setSavingEnergy(true);
    try {
      await updateDoc(doc(db, "pets", pet.id), {
        "preferences.personality": [value],
      });
    } catch (err) {
      console.error("[RutinasHub] Error guardando energía:", err);
    } finally {
      setSavingEnergy(false);
    }
  }

  return (
    <div
      className="min-h-screen bg-[#F0FAF9] pb-28"
      style={{ fontFamily: "'Manrope', sans-serif" }}
    >
      {/* ── Sticky header ── */}
      <div className="sticky top-0 z-20 bg-[#F0FAF9] border-b border-[#E0F2F1]">
        <div className="max-w-md mx-auto flex items-center gap-3 px-4 py-3">
          <button
            type="button"
            onClick={onBack}
            aria-label="Volver"
            className="flex items-center justify-center w-11 h-11 rounded-full hover:bg-[#E0F2F1] transition-colors"
          >
            <MaterialIcon name="chevron_left" className="!text-[20px] text-[#074738]" />
          </button>
          <h1
            className="text-lg font-bold text-[#074738]"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          >
            Rutinas
          </h1>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 pt-5 space-y-6">
        {/* ── Card "Hoy con [petName]" ── */}
        <section>
          <Card>
            <p
              className="text-sm font-semibold text-[#074738] capitalize"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            >
              {todayLabel()}
            </p>
            <p className="text-lg font-bold text-[#074738] mt-1" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              Hoy con {petName}
            </p>

            {/* Energy chip */}
            <div className="mt-3 flex items-center gap-2 flex-wrap">
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${energyCfg.bg} ${energyCfg.color}`}
              >
                <MaterialIcon name={energyCfg.iconName} className="!text-[14px]" />
                {energyCfg.label}
              </span>
            </div>

            {/* Next walk */}
            {nextWalk && (
              <div className="mt-3 flex items-center gap-2 rounded-[12px] bg-[#E0F2F1] px-3 py-2">
                <MaterialIcon name="location_on" className="!text-[16px] text-[#1A9B7D] shrink-0" />
                <p className="text-xs font-semibold text-[#074738]">
                  Próximo paseo: {nextWalk}
                </p>
              </div>
            )}
          </Card>
        </section>

        {/* ── Recommendations ── */}
        {recommendations.length > 0 && (
          <section>
            <SectionTitle>Recomendaciones de hoy</SectionTitle>
            <div className="space-y-3">
              {recommendations.map((rec) => (
                <Card key={rec.id}>
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-[10px] bg-[#E0F2F1] flex items-center justify-center shrink-0">
                      {rec.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p
                        className="text-sm font-bold text-[#074738]"
                        style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                      >
                        {rec.title}
                      </p>
                      <p className="text-[13px] text-slate-600 mt-0.5 leading-relaxed">
                        {rec.description}
                      </p>
                      {rec.isActionable && rec.ctaLabel && rec.ctaRoute && (
                        <button
                          type="button"
                          onClick={() => navigate(rec.ctaRoute!)}
                          className="mt-2 text-[13px] font-bold text-[#1A9B7D] hover:underline min-h-[44px] flex items-center"
                        >
                          {rec.ctaLabel} →
                        </button>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </section>
        )}

        {/* ── Quick energy capture (minimal data) ── */}
        {completeness === "minimal" && (
          <section>
            <Card>
              <p
                className="text-sm font-bold text-[#074738] mb-1"
                style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
              >
                Ayudanos a conocer a {petName}
              </p>
              <p className="text-xs text-slate-500 mb-3">
                ¿Cuánta energía tiene {petName} normalmente?
              </p>
              <div className="flex gap-2 flex-wrap">
                {[
                  { label: "Tranquilo", value: "calm" as const },
                  { label: "Normal", value: "playful" as const },
                  { label: "Mucha energía", value: "energetic" as const },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    disabled={savingEnergy}
                    onClick={() => handleQuickEnergy(opt.value)}
                    className="flex-1 min-w-[80px] min-h-[44px] rounded-[12px] border border-[#E0F2F1] bg-[#F0FAF9] text-xs font-bold text-[#074738] hover:bg-[#E0F2F1] active:scale-[0.97] transition-all disabled:opacity-50"
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </Card>
          </section>
        )}

        {/* ── Active medications ── */}
        {petMeds.length > 0 && (
          <section>
            <SectionTitle>Rutinas activas</SectionTitle>
            <div className="space-y-3">
              {petMeds.map((med) => (
                <Card key={med.id}>
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-[10px] bg-[#E0F2F1] flex items-center justify-center shrink-0">
                      <MaterialIcon name="medication" className="!text-[16px] text-[#1A9B7D]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p
                        className="text-sm font-bold text-[#074738]"
                        style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                      >
                        {med.name}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {med.dosage} · {med.frequency}
                      </p>
                      {med.type && (
                        <span className="mt-1.5 inline-block px-2 py-0.5 rounded-full bg-[#E0F2F1] text-xs text-[#1A9B7D] font-semibold">
                          {med.type}
                        </span>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
              <button
                type="button"
                onClick={() => navigate("/tratamientos")}
                className="w-full min-h-[44px] rounded-[12px] border border-[#E0F2F1] text-sm font-bold text-[#1A9B7D] hover:bg-[#E0F2F1] transition-colors"
              >
                Ver todas las rutinas
              </button>
            </div>
          </section>
        )}

        {/* ── Footer note ── */}
        {/* [Capa futura] Motor de recomendación IA: contextualización por clima, ubicación,
            comportamiento histórico y patrones de uso. NotebookLM / cuaderno por mascota. */}
        <p className="text-xs text-slate-400 text-center pb-2 leading-relaxed">
          Rutinas mejora con el tiempo a medida que conocemos más a {petName}.
        </p>
      </div>
    </div>
  );
}
