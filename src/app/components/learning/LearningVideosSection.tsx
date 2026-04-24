import { useMedical } from "../../contexts/MedicalContext";
import { useLearningVideos } from "../../hooks/useLearningVideos";
import type { LearningVideoSpecies } from "../../types/learningVideo";
import { LearningVideoCard } from "./LearningVideoCard";

interface LearningVideosSectionPet {
  id: string;
  name: string;
  species?: string;
  age?: string;
}

interface LearningVideosSectionProps {
  pet: LearningVideosSectionPet | null | undefined;
}

/** Convierte especies libre-texto al enum soportado. Default: dog. */
function resolveSpecies(raw?: string): LearningVideoSpecies | null {
  if (!raw) return null;
  const s = raw.toLowerCase();
  if (s.includes("cat") || s.includes("gato")) return "cat";
  if (s.includes("dog") || s.includes("perro")) return "dog";
  if (s.includes("rabbit") || s.includes("conejo")) return "rabbit";
  if (s.includes("bird") || s.includes("ave") || s.includes("pajaro") || s.includes("pájaro")) return "bird";
  if (s.includes("reptil")) return "reptile";
  return null;
}

/**
 * Parsea edad libre tipo "3 años", "6 meses", "2 años y 3 meses".
 * Devuelve null si no se puede inferir.
 */
function parseAgeMonths(raw?: string): number | null {
  if (!raw) return null;
  const text = raw.toLowerCase();
  const yearsMatch = text.match(/(\d+)\s*(año|year)/);
  const monthsMatch = text.match(/(\d+)\s*(mes|month)/);
  let months = 0;
  if (yearsMatch) months += Number.parseInt(yearsMatch[1], 10) * 12;
  if (monthsMatch) months += Number.parseInt(monthsMatch[1], 10);
  if (!yearsMatch && !monthsMatch) {
    // fallback: número suelto → asumimos años
    const solo = text.match(/(\d+)/);
    if (solo) months = Number.parseInt(solo[1], 10) * 12;
  }
  return months > 0 ? months : null;
}

export function LearningVideosSection({ pet }: LearningVideosSectionProps) {
  const { getClinicalConditionsByPetId } = useMedical();
  const species = resolveSpecies(pet?.species);
  const ageMonths = parseAgeMonths(pet?.age);
  const conditions = pet?.id ? getClinicalConditionsByPetId(pet.id) : [];

  const { videos, loading } = useLearningVideos({
    species,
    ageMonths,
    conditions,
    limit: 3,
  });

  if (loading) return null;
  if (videos.length === 0) return null;

  return (
    <section className="mx-3 mt-4" aria-label="Videos educativos recomendados">
      <h2
        className="text-[14px] font-[800] text-[#074738] mb-2 px-1"
        style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
      >
        Aprendé sobre {pet?.name || "tu mascota"}
      </h2>
      <div className="space-y-2">
        {videos.map((v) => (
          <LearningVideoCard key={v.id} video={v} />
        ))}
      </div>
    </section>
  );
}

export default LearningVideosSection;
