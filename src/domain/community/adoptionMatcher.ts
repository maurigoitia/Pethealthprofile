/**
 * Adoption Matcher — Intelligent matching between adopters and pets
 *
 * Scoring (0-100):
 *   livingSpace (0-25): Does the adopter's home fit the pet's size + energy?
 *   experience (0-25): Can the adopter handle this pet's temperament + needs?
 *   otherPets (0-20): Is the pet compatible with existing animals?
 *   activity (0-15): Does the adopter's activity level match the pet's energy?
 *   schedule (0-15): Does the adopter have time for this pet?
 */

import type {
  AdopterProfile,
  AdoptionPetProfile,
  MatchResult,
} from "./adoption.contract";
import { getMatchLabel } from "./adoption.contract";

export function computeMatchScore(
  adopter: AdopterProfile,
  pet: AdoptionPetProfile,
): MatchResult {
  const components = {
    livingSpace: scoreLivingSpace(adopter, pet),
    experience: scoreExperience(adopter, pet),
    otherPets: scoreOtherPets(adopter, pet),
    activity: scoreActivity(adopter, pet),
    schedule: scoreSchedule(adopter, pet),
  };

  const totalScore =
    components.livingSpace +
    components.experience +
    components.otherPets +
    components.activity +
    components.schedule;

  return {
    listingId: "",
    adopterId: adopter.userId,
    totalScore,
    components,
    label: getMatchLabel(totalScore),
    reason: buildReason(adopter, pet, components),
  };
}

// ── Living Space (0-25) ─────────────────────────────────────────────────────

function scoreLivingSpace(a: AdopterProfile, p: AdoptionPetProfile): number {
  const spaceScore: Record<string, number> = { apartment: 1, house_small: 2, house_big: 3, rural: 4 };
  const sizeNeed: Record<string, number> = { small: 1, medium: 2, large: 3 };
  const energyNeed: Record<string, number> = { low: 0, medium: 1, high: 2 };

  const space = spaceScore[a.livingSpace] ?? 2;
  const need = sizeNeed[p.size] + energyNeed[p.energyLevel];

  // Yard bonus for high-energy pets
  const yardBonus = a.hasYard && p.energyLevel === "high" ? 5 : 0;

  if (space >= need) return Math.min(25, 20 + yardBonus);
  if (space >= need - 1) return Math.min(25, 15 + yardBonus);
  return Math.min(25, 5 + yardBonus);
}

// ── Experience (0-25) ───────────────────────────────────────────────────────

function scoreExperience(a: AdopterProfile, p: AdoptionPetProfile): number {
  const hasSpecialNeeds = p.specialNeeds.length > 0;
  const isChallengingTemp = p.temperament.some((t) =>
    ["reactivo", "tímido", "miedoso", "agresivo", "reactive", "shy", "fearful"].includes(t.toLowerCase()),
  );

  if (a.experienceLevel === "professional") return 25;
  if (a.experienceLevel === "experienced") {
    if (hasSpecialNeeds && isChallengingTemp) return 18;
    return 23;
  }
  // first_time
  if (hasSpecialNeeds || isChallengingTemp) return 8;
  return 15;
}

// ── Other Pets (0-20) ───────────────────────────────────────────────────────

function scoreOtherPets(a: AdopterProfile, p: AdoptionPetProfile): number {
  if (a.otherPets === 0) return 20; // no conflict possible

  // Check compatibility flags
  const hasDogs = a.otherPets > 0; // simplified — assume dogs
  if (hasDogs && !p.goodWith.dogs) return 3;
  if (hasDogs && p.goodWith.dogs) return 18;
  return 12;
}

// ── Activity (0-15) ─────────────────────────────────────────────────────────

function scoreActivity(a: AdopterProfile, p: AdoptionPetProfile): number {
  const activeKeywords = ["runner", "hiker", "park_player", "high_outdoor", "mountain_hiker"];
  const calmKeywords = ["casual_walker", "low_outdoor", "homebody", "couch_potato"];

  const isAdopterActive = a.activityPrefs.some((t) => activeKeywords.includes(t));
  const isAdopterCalm = a.activityPrefs.some((t) => calmKeywords.includes(t));

  if (p.energyLevel === "high" && isAdopterActive) return 15;
  if (p.energyLevel === "high" && isAdopterCalm) return 5;
  if (p.energyLevel === "low" && isAdopterCalm) return 15;
  if (p.energyLevel === "low" && isAdopterActive) return 8;
  return 10; // medium matches most
}

// ── Schedule (0-15) ─────────────────────────────────────────────────────────

function scoreSchedule(a: AdopterProfile, p: AdoptionPetProfile): number {
  if (a.scheduleAvailability === "high") return 15;
  if (a.scheduleAvailability === "medium") {
    return p.energyLevel === "high" ? 8 : 13;
  }
  // low availability
  return p.energyLevel === "low" ? 10 : 5;
}

// ── Reason builder ──────────────────────────────────────────────────────────

function buildReason(
  a: AdopterProfile,
  p: AdoptionPetProfile,
  c: MatchResult["components"],
): string {
  const parts: string[] = [];

  if (c.livingSpace >= 20) parts.push(`tu ${a.hasYard ? "casa con jardín" : "espacio"} es ideal para ${p.name}`);
  if (c.experience >= 20) parts.push("tenés experiencia con mascotas");
  if (c.otherPets >= 15 && a.otherPets > 0) parts.push(`${p.name} se lleva bien con otros animales`);
  if (c.activity >= 12) parts.push("tu nivel de actividad es compatible");

  if (parts.length === 0) parts.push("podría funcionar con algo de adaptación");

  const first = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
  return parts.length === 1 ? first : `${first} y ${parts.slice(1).join(", ")}`;
}
