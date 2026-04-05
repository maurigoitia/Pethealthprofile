import { MaterialIcon } from "../shared/MaterialIcon";
import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useMedical } from "../../contexts/MedicalContext";
import { usePet, type PetPreferences } from "../../contexts/PetContext";
import { useAuth } from "../../contexts/AuthContext";
import { toTimestampSafe } from "../../utils/dateUtils";
import { PetPhoto } from "./PetPhoto";
import { getPoints, addPoints, isDailyActivityDone, markDailyActivityDone } from "../../utils/gamification";
import { db } from "../../../lib/firebase";
import { collection, doc, getDoc, getDocs, setDoc } from "firebase/firestore";

const PetPreferencesEditor = lazy(() =>
  import("./PetPreferencesEditor.tsx").then((m) => ({ default: m.PetPreferencesEditor }))
);
import {
  WELLBEING_MASTER_BOOK,
  type ThermalSafetyProfile,
  type WellbeingSpeciesGroupId,
} from "../../../domain/wellbeing/wellbeingMasterBook";
import {
  runPessyIntelligence,
  type PessyIntelligenceRecommendation,
} from "../../../domain/intelligence/pessyIntelligenceEngine";

import DailyHookCard from "../home/DailyHookCard";
import RoutineChecklist from "../home/RoutineChecklist";
import { MissionDetailScreen } from "../home/MissionDetailScreen";
import { MISSIONS } from "../home/missionData";
import ProfileNudge from "../home/ProfileNudge";
import QuickActions from "../home/QuickActions";
import PessyTip, { SectionTitle } from "../home/PessyTip";
import PessyDailyCheckin from "../home/PessyDailyCheckin";
import { EcosystemRow } from "../home/EcosystemRow";
import PersonalityOnboarding from "./PersonalityOnboarding";
import BreedInsightCard from "../home/BreedInsightCard";
import { VaccineAlertBanner } from "../home/VaccineAlertBanner";
import { detectWalkPattern } from "../../../domain/intelligence/walkPatternDetector";
import { useWalks } from "../../contexts/WalkContext";

// ─── Types ────────────────────────────────────────────────────────────────────

type PetSpecies = "dog" | "cat";
type WalkSafetyStatus = "missing_data" | "unavailable" | "safe" | "caution" | "blocked";

interface LiveWeatherSnapshot {
  status: "loading" | "ready" | "unavailable";
  temperatureC: number | null;
  humidityPct: number | null;
  weatherCode: number | null;
  windSpeedKmh: number | null;
  uvIndex: number | null;
}

interface WalkSafetyState {
  status: WalkSafetyStatus;
  badge: string;
}

const WEATHER_CACHE_KEY = "pessy_home_weather_v1";

interface PetHomeViewProps {
  userName: string;
  onViewHistory: () => void;
  onProfileClick: () => void;
  onPetClick: () => void;
  onAppointmentsClick: () => void;
  onMedicationsClick: () => void;
  onOpenScanner?: () => void;
  onOpenNearbyVets?: () => void;
  pets: Array<{
    id: string;
    name: string;
    breed: string;
    photo: string;
    species?: string;
    age?: string;
    weight?: string;
    preferences?: PetPreferences;
  }>;
  activePetId: string;
  onPetChange: (petId: string) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const BRACHY_BREEDS = [
  "bulldog frances",
  "bulldog inglés",
  "bulldog ingles",
  "pug",
  "boxer",
  "boston terrier",
  "shih tzu",
  "persa",
];

const ACTIVE_WORKING_BREEDS = [
  "border collie", "pastor aleman", "pastor alemán", "husky", "malinois",
  "australian shepherd", "pastor australiano", "labrador", "golden retriever",
  "weimaraner", "vizsla", "pointer", "setter", "dalmata", "dálmata",
  "jack russell", "beagle", "cocker spaniel", "springer spaniel",
];

const COMPANION_BREEDS = [
  "chihuahua", "pomeranian", "pomerania", "maltés", "maltes", "bichon",
  "cavalier", "papillon", "havanese", "lhasa apso", "shih tzu",
  "yorkshire", "yorkie", "caniche", "poodle", "coton",
];

function normalizeText(value?: string | null) {
  return (value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function resolveSpecies(rawSpecies?: string, breed?: string): PetSpecies {
  const species = normalizeText(rawSpecies);
  if (species.includes("cat") || species.includes("gato") || normalizeText(breed).includes("persa")) {
    return "cat";
  }
  return "dog";
}

function resolveGroupIds(species: PetSpecies, breed: string): WellbeingSpeciesGroupId[] {
  const normalizedBreed = normalizeText(breed);
  const matchesList = (list: string[]) => list.some((item) => normalizedBreed.includes(normalizeText(item)));

  if (species === "cat") {
    const ids: WellbeingSpeciesGroupId[] = ["cat.general"];
    if (matchesList(BRACHY_BREEDS)) ids.unshift("cat.brachycephalic");
    return ids;
  }

  // Dogs: collect all matching groups, always include "dog.general" as fallback
  const ids: WellbeingSpeciesGroupId[] = [];

  if (matchesList(BRACHY_BREEDS)) ids.push("dog.brachycephalic");
  if (matchesList(ACTIVE_WORKING_BREEDS)) ids.push("dog.active_working");
  if (matchesList(COMPANION_BREEDS)) ids.push("dog.companion");

  // Always include dog.general as fallback
  ids.push("dog.general");

  return ids;
}

function resolveThermalProfile(species: PetSpecies, groupIds: WellbeingSpeciesGroupId[]): ThermalSafetyProfile | null {
  const priority = groupIds.find((id) => id === "dog.brachycephalic" || id === "cat.brachycephalic");

  if (priority) {
    return WELLBEING_MASTER_BOOK.thermal_safety.groups.find((group) => group.id === priority) ?? null;
  }

  const fallbackId = species === "cat" ? "cat.general" : "dog.general";
  return WELLBEING_MASTER_BOOK.thermal_safety.groups.find((group) => group.id === fallbackId) ?? null;
}

const WMO_RAIN_CODES = [51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82];

/** Parses an age string like "6 meses", "2 años", "1 año 3 meses" → total months */
function parseAgeToMonths(age?: string | null): number | null {
  if (!age) return null;
  const lower = age.toLowerCase();
  const yearMatch = lower.match(/(\d+)\s*(año|year)/);
  const monthMatch = lower.match(/(\d+)\s*(mes|month)/);
  const years = yearMatch ? parseInt(yearMatch[1]) : 0;
  const months = monthMatch ? parseInt(monthMatch[1]) : 0;
  if (!yearMatch && !monthMatch) return null;
  return years * 12 + months;
}

function computeFoodDaysLeft(prefs: PetPreferences | undefined): number | null {
  if (!prefs?.foodBagKg || !prefs?.foodDailyGrams || !prefs?.foodLastPurchase) return null;
  const totalGrams = prefs.foodBagKg * 1000;
  const daysSince = Math.max(0, Math.floor((Date.now() - new Date(prefs.foodLastPurchase).getTime()) / 86_400_000));
  const gramsLeft = Math.max(0, totalGrams - daysSince * prefs.foodDailyGrams);
  return Math.max(0, Math.floor(gramsLeft / prefs.foodDailyGrams));
}

/** Map generic groupIds to the closest match in daily_suggestions/routines */
function resolveRoutineGroupId(groupIds: WellbeingSpeciesGroupId[], species: PetSpecies): WellbeingSpeciesGroupId {
  // If the groupId exists in routines, use it directly
  const routineGroupIds = WELLBEING_MASTER_BOOK.routines.map((r) => r.groupId);
  const direct = groupIds.find((id) => routineGroupIds.includes(id));
  if (direct) return direct;

  // Fallback mapping
  if (species === "cat") return "cat.general";
  return "dog.companion"; // dog.general -> dog.companion
}

const CATEGORY_ICONS: Record<string, string> = {
  outdoor: "park",
  indoor: "home",
  grooming: "content_cut",
  training: "school",
  social: "groups",
};

const CATEGORY_LABELS: Record<string, string> = {
  outdoor: "Aire libre",
  indoor: "En casa",
  grooming: "Cuidado",
  training: "Entrenamiento",
  social: "Social",
};

// ─── Inline WeatherPill ───────────────────────────────────────────────────────

function WeatherPill({
  emoji,
  value,
  label,
  highlight,
}: {
  emoji: string;
  value: string;
  label: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`flex-1 flex items-center gap-1.5 rounded-[14px] px-2.5 py-2 border ${
        highlight
          ? "border-[#1A9B7D] bg-[#eef8f3]"
          : "border-[#E5E7EB] bg-white"
      }`}
    >
      <span className="text-[16px] leading-none" role="img">{emoji}</span>
      <div className="min-w-0">
        <p className="text-[12px] font-[800] text-[#074738] leading-none">{value}</p>
        <p className="text-[10px] text-[#9CA3AF] leading-none mt-0.5">{label}</p>
      </div>
    </div>
  );
}

// ─── ROUTINE STORAGE HELPERS ──────────────────────────────────────────────────

function getRoutineStorageKey(petId: string): string {
  const today = new Date().toISOString().slice(0, 10);
  return `pessy_routine_${petId}_${today}`;
}

function loadCheckedItems(petId: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(getRoutineStorageKey(petId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveCheckedItems(petId: string, items: string[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(getRoutineStorageKey(petId), JSON.stringify(items));
}

// ─── TYPES ────────────────────────────────────────────────────────────────────

/** Personality data stored in Firestore: users/{uid}/pets/{petId}/personality/{topic} */
type Personality = Record<string, { value: string }>;

/** Extended recommendation — adds optional mission mode fields */
type EnhancedTip = PessyIntelligenceRecommendation & {
  isMission?: boolean;
  missionPoints?: number;
};

// ─── CONTEXTUAL TIPS FROM REAL DATA ──────────────────────────────────────────
// These override generic tips — if there's real medication/appointment data,
// it shows FIRST (kind: "alert") before breed/weather recommendations.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildContextualTips(petName: string, medications: any[], appointments: any[], personality?: Personality, species?: string, breed?: string): EnhancedTip[] {
  // Hour-of-day context for time-sensitive missions
  const currentHour = new Date().getHours();
  const isEvening = currentHour >= 18 || currentHour < 6;
  const isDog = !species || species === "dog";
  const tips: PessyIntelligenceRecommendation[] = [];

  // Active medications → always relevant, show name + dosage
  medications.slice(0, 2).forEach((med, i) => {
    const daysLeft = med.endDate
      ? Math.ceil((new Date(med.endDate).getTime() - Date.now()) / 86_400_000)
      : null;

    if (daysLeft !== null && daysLeft <= 3 && daysLeft >= 0) {
      // Treatment ending soon — urgent
      const when = daysLeft === 0 ? "hoy" : daysLeft === 1 ? "mañana" : `en ${daysLeft} días`;
      tips.push({
        id: `med-ending-${i}`,
        code: "med_ending",
        title: `${med.name} termina ${when}`,
        detail: `Consultá con el vet si ${petName} necesita continuar el tratamiento.`,
        slot: "alert",
        icon: "medication",
        kind: "alert",
        sourceModule: "contextual",
      });
    } else {
      // Active treatment — already shown in Medical Profile card, skip duplicate tip
    }
  });

  // Upcoming appointment within 7 days
  const nextAppt = appointments[0];
  if (nextAppt) {
    const iso = nextAppt.dateTime || (nextAppt.date ? `${nextAppt.date}T${nextAppt.time || "09:00"}:00` : "");
    if (iso) {
      const days = Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
      if (days >= 0 && days <= 7) {
        const when = days === 0 ? "hoy" : days === 1 ? "mañana" : `en ${days} días`;
        const dateLabel = new Date(iso).toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
        tips.push({
          id: "appt-upcoming",
          code: "appt_upcoming",
          title: `Cita con el vet ${when}`,
          detail: dateLabel,
          slot: days <= 1 ? "alert" : "recommendation",
          icon: "event",
          kind: days <= 1 ? "alert" : "recommendation",
          sourceModule: "contextual",
        });
      }
    }
  }

  // Personality-aware mission tips — solo perros, con contexto de raza
  const training = personality?.training_level?.value;
  if (training && isDog) {
    const breedHint = breed ? ` (${breed})` : "";
    const missionTitle = training === "none"
      ? `Enseñarle 'Sentado' a ${petName}`
      : training === "partial"
        ? `Reforzar 'Quieto' con ${petName}${breedHint}`
        : `Practicar 'Espera la señal' con ${petName}${breedHint}`;
    tips.push({
      id: "mission-training",
      code: "mission_training",
      title: missionTitle,
      detail: training === "none" ? "5 min. Recompensá cada intento." : training === "partial" ? "10 min con más distancia." : "Con distracciones activas.",
      slot: "recommendation",
      icon: "school",
      kind: "recommendation",
      sourceModule: "mission",
      isMission: true,
    });
  }

  // Rutina de calma — solo en la tarde/noche (18hs en adelante o antes de las 6am)
  const sleep = personality?.sleep_habits?.value;
  if (sleep && isEvening) {
    tips.push({
      id: "mission-sleep",
      code: "mission_sleep",
      title: sleep === "with_owner" ? `Noche cómoda para los dos` : `Rutina de calma para ${petName}`,
      detail: sleep === "with_owner" ? `Definí el espacio de ${petName} en la cama.` : `10 min de calma antes de separarse.`,
      slot: "recommendation",
      icon: "bedtime",
      kind: "recommendation",
      sourceModule: "mission",
      isMission: true,
    });
  }

  return tips;
}

// ─── RECOMMENDATION COLOR MAPPING ────────────────────────────────────────────

function mapRecToTipColor(rec: PessyIntelligenceRecommendation): "green" | "blue" | "orange" {
  if (rec.kind === "block" || rec.kind === "alert") return "orange";
  // Contextual tips (real data: medications, appointments) show in green
  if (rec.sourceModule === "contextual") return "green";
  if (rec.slot?.includes("training") || rec.slot?.includes("routine")) return "green";
  return "blue";
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export function PetHomeView({
  onViewHistory,
  onProfileClick,
  onOpenScanner,
  onOpenNearbyVets,
  onPetClick,
  onAppointmentsClick,
  onMedicationsClick,
  pets,
  activePetId,
  onPetChange,
}: PetHomeViewProps) {
  const { updatePet } = usePet();
  const { user } = useAuth();
  const { walks } = useWalks();
  const walkPattern = useMemo(() => detectWalkPattern(walks), [walks]);
  const [showPreferences, setShowPreferences] = useState(false);
  const [personality, setPersonality] = useState<Personality>({});
  const [showPersonalityOnboarding, setShowPersonalityOnboarding] = useState(false);
  const [weather, setWeather] = useState<LiveWeatherSnapshot>({
    status: "loading",
    temperatureC: null,
    humidityPct: null,
    weatherCode: null,
    windSpeedKmh: null,
    uvIndex: null,
  });
  const [nudgedBreed, setNudgedBreed] = useState(false);
  const [checkedRoutineItems, setCheckedRoutineItems] = useState<string[]>([]);
  const [points, setPoints] = useState(() => getPoints());
  const [completedMissions, setCompletedMissions] = useState<Set<string>>(new Set());
  const [activeMissionCode, setActiveMissionCode] = useState<string | null>(null);
  const [preWalkDismissed, setPreWalkDismissed] = useState(false);
  const [breedInsightDismissed, setBreedInsightDismissed] = useState(false);
  const {
    getEventsByPetId,
    getActiveMedicationsByPetId,
    getAppointmentsByPetId,
    getClinicalConditionsByPetId,
    getProfileSnapshotByPetId,
    getPendingActionsByPetId,
  } = useMedical();

  const currentIndex = pets.findIndex((pet) => pet.id === activePetId);
  const safeCurrentIndex = currentIndex >= 0 ? currentIndex : 0;
  const activePet = pets[safeCurrentIndex];
  const hasMultiplePets = pets.length > 1;

  const petEvents = activePetId ? getEventsByPetId(activePetId) : [];
  const appointments = activePetId ? getAppointmentsByPetId(activePetId) : [];
  const activeMedications = activePetId ? getActiveMedicationsByPetId(activePetId) : [];

  // ─── Medical intelligence summary ───────────────────────────────────────────
  const profileSnapshot = activePetId ? getProfileSnapshotByPetId(activePetId) : null;
  const clinicalConditions = activePetId ? getClinicalConditionsByPetId(activePetId) : [];

  // Chronic/active conditions: prefer profile snapshot, fallback to raw clinical conditions
  const chronicConditions: string[] = profileSnapshot?.activeConditions?.length
    ? profileSnapshot.activeConditions
    : profileSnapshot?.recurrentPathologies?.length
      ? profileSnapshot.recurrentPathologies
      : clinicalConditions
          .filter((c) => c.status === "active" || c.pattern === "chronic")
          .map((c) => c.normalizedName)
          .slice(0, 4);

  const hasMedicalSummary =
    chronicConditions.length > 0 ||
    activeMedications.length > 0;

  const upcomingAppointments = appointments.filter((appointment) => {
    const dateValue = appointment.dateTime || `${appointment.date || ""}T${appointment.time || "00:00"}:00`;
    return toTimestampSafe(dateValue, 0) >= Date.now();
  });

  const species = resolveSpecies(activePet?.species, activePet?.breed);
  const ageMonths = parseAgeToMonths(activePet?.age);
  const showPreWalkPrompt = useMemo(() => {
    if (preWalkDismissed || !activePet) return false;
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinutes = now.getMinutes();
    const currentTimeInMinutes = currentHour * 60 + currentMinutes;
    const usualWalkTimeInMinutes = (walkPattern.usualWalkHour || 0) * 60;
    const withinTimeWindow = Math.abs(currentTimeInMinutes - usualWalkTimeInMinutes) <= 30;
    return (
      walkPattern.hasEstablishedPattern &&
      withinTimeWindow &&
      walkPattern.daysSinceLastWalk >= 1
    );
  }, [walkPattern, activePet, preWalkDismissed]);
  const isPuppy = species === "dog" && ageMonths !== null && ageMonths < 12;
  const baseGroupIds = resolveGroupIds(species, activePet?.breed || "");
  // Inject dog.puppy group if age indicates a puppy (< 12 months)
  const groupIds: WellbeingSpeciesGroupId[] = (isPuppy && !baseGroupIds.includes("dog.puppy"))
    ? (["dog.puppy", ...baseGroupIds] as WellbeingSpeciesGroupId[])
    : baseGroupIds;
  const thermalProfile = resolveThermalProfile(species, groupIds);
  const foodDaysLeft = computeFoodDaysLeft(activePet?.preferences);

  // ─── Profile completeness ───────────────────────────────────────────────────
  const missingItems: string[] = [];
  if (!activePet?.photo) missingItems.push("foto");
  if (!activePet?.weight) missingItems.push("peso");
  if (!activePet?.breed) missingItems.push("raza");
  const profileIncomplete = missingItems.length > 0;

  // ─── Intelligence engine ────────────────────────────────────────────────────
  const hasVaccineOnRecord = petEvents.some((e: any) => e.extractedData?.documentType === "vaccine");
  const hasSeparationAnxiety = (activePet?.preferences?.fears || []).some((f: string) =>
    f.toLowerCase().includes("sola") || f.toLowerCase().includes("separac") || f.toLowerCase().includes("ansiedad")
  );

  const intelligenceResult = useMemo(() => {
    if (!activePet?.breed) return null;
    const wc = weather.weatherCode;
    return runPessyIntelligence({
      petName: activePet.name,
      species,
      breed: activePet.breed,
      ageLabel: activePet.age || "",
      ageWeeks: ageMonths !== null ? ageMonths * 4 : null,
      groupIds,
      temperatureC: weather.temperatureC,
      humidityPct: weather.humidityPct,
      isRaining: wc !== null && WMO_RAIN_CODES.includes(wc),
      isStormy: wc !== null && wc >= 95,
      windSpeedKmh: weather.windSpeedKmh,
      uvIndex: weather.uvIndex,
      currentHour: new Date().getHours(),
      fears: activePet.preferences?.fears,
      personality: activePet.preferences?.personality,
      favoriteActivities: activePet.preferences?.favoriteActivities,
      walkTimes: activePet.preferences?.walkTimes,
      foodDaysLeft,
      isPuppy,
      hasSeparationAnxiety,
      isUnvaccinated: isPuppy && !hasVaccineOnRecord,
    });
  }, [activePet?.id, activePet?.breed, activePet?.name, activePet?.age, activePet?.preferences, species, groupIds, weather, foodDaysLeft, isPuppy, hasSeparationAnxiety, hasVaccineOnRecord]);

  const sortedRecommendations = useMemo(() => {
    // Contextual tips from real data (meds, appointments) always come first
    const contextual = buildContextualTips(activePet?.name || "", activeMedications, upcomingAppointments, personality, activePet?.species, activePet?.breed);
    const intelligence = intelligenceResult?.recommendations || [];
    const order: Record<string, number> = { block: 0, alert: 1, recommendation: 2 };
    const all = [...contextual, ...intelligence].sort((a, b) => (order[a.kind] ?? 2) - (order[b.kind] ?? 2));
    // Max 4 tips — show what matters, not everything
    return all.slice(0, 4);
  }, [activePet?.name, activeMedications, upcomingAppointments, intelligenceResult, personality]);

  // ─── Personality — load from Firestore, trigger onboarding if not done ──────
  useEffect(() => {
    if (!user || !activePetId) return;
    setPersonality({});
    setShowPersonalityOnboarding(false);
    getDocs(collection(db, "users", user.uid, "pets", activePetId, "personality"))
      .then((snap) => {
        const data: Personality = {};
        snap.docs.forEach((d) => { data[d.id] = d.data() as { value: string }; });
        setPersonality(data);
        // Show onboarding if the pet has never completed it
        const completed = snap.docs.find((d) => d.id === "onboardingComplete");
        if (!completed) {
          // Delay slightly so the home screen renders first
          setTimeout(() => setShowPersonalityOnboarding(true), 800);
        }
      })
      .catch(() => {}); // Non-critical — graceful fallback
  }, [user, activePetId]);

  // ─── Load mission completions from Firestore (daily, per pet) ───────────────
  useEffect(() => {
    if (!user || !activePetId) return;
    const today = new Date().toISOString().slice(0, 10);
    const codes = Object.keys(MISSIONS);
    const completed = new Set<string>();
    Promise.all(
      codes.map(async (code) => {
        const ref = doc(db, "users", user.uid, "pets", activePetId, "missions", code);
        const snap = await getDoc(ref);
        if (snap.exists() && snap.data().completedDate === today) completed.add(code);
      })
    ).then(() => setCompletedMissions(new Set(completed))).catch(() => {});
  }, [user, activePetId]);

  // ─── Handle mission complete — persist to Firestore, award points once ──────
  const handleMissionComplete = useCallback(
    async (missionCode: string) => {
      if (completedMissions.has(missionCode)) {
        setActiveMissionCode(null);
        return;
      }
      const missionDef = MISSIONS[missionCode];
      const pts = missionDef?.points ?? 0;
      const today = new Date().toISOString().slice(0, 10);
      if (user && activePetId) {
        const ref = doc(db, "users", user.uid, "pets", activePetId, "missions", missionCode);
        setDoc(ref, { completedDate: today, points: pts }).catch(() => {});
      }
      const total = addPoints(pts);
      setPoints(total);
      setCompletedMissions((prev) => new Set([...prev, missionCode]));
      setActiveMissionCode(null);
    },
    [user, activePetId, completedMissions]
  );

  // ─── Walk safety (simplified for badge) ─────────────────────────────────────
  const walkSafety: WalkSafetyState = useMemo(() => {
    const breed = (activePet?.breed || "").trim();
    if (!breed || !thermalProfile) return { status: "missing_data", badge: "Falta dato" };
    if (weather.status !== "ready" || weather.temperatureC === null) return { status: "unavailable", badge: "Sin clima" };

    const humidityPenalty = thermalProfile.humiditySensitive && (weather.humidityPct ?? 0) >= 70;
    const severeRisk = thermalProfile.severeRiskAboveC ?? Number.POSITIVE_INFINITY;
    const avoidExercise = thermalProfile.avoidExerciseAboveC ?? Number.POSITIVE_INFINITY;
    const cautionThreshold =
      typeof avoidExercise === "number" && Number.isFinite(avoidExercise)
        ? Math.max((thermalProfile.comfortableMaxC ?? avoidExercise) + 1, avoidExercise - 3)
        : thermalProfile.comfortableMaxC ?? 26;

    if (weather.temperatureC >= severeRisk || weather.temperatureC > avoidExercise || humidityPenalty) {
      return { status: "blocked", badge: "STOP" };
    }
    if (weather.temperatureC >= cautionThreshold) {
      return { status: "caution", badge: "Precaución" };
    }
    return { status: "safe", badge: "OK" };
  }, [activePet?.breed, thermalProfile, weather]);

  // ─── Daily suggestions (deterministic by day-of-year, up to 3) ─────────────
  const dailySuggestions = useMemo(() => {
    const weatherCondition = walkSafety.status === "blocked" ? "blocked" : walkSafety.status === "safe" ? "safe" : "any";

    // Collect candidates from ALL matching groupIds (breed-aware)
    const candidates = WELLBEING_MASTER_BOOK.daily_suggestions.filter(
      (s) => groupIds.includes(s.groupId) && (s.weatherCondition === weatherCondition || s.weatherCondition === "any")
    );

    // If no candidates for the matched groups, try all suggestions for weather condition
    const pool = candidates.length > 0
      ? candidates
      : WELLBEING_MASTER_BOOK.daily_suggestions.filter(
          (s) => s.weatherCondition === weatherCondition || s.weatherCondition === "any"
        );

    const fallback = {
      category: "Actividad",
      icon: "park",
      title: `Tiempo de calidad con ${activePet?.name || "tu mascota"}`,
      detail: "Un buen momento para compartir tiempo con tu mascota.",
      duration: "15 min",
      points: 10,
    };

    if (pool.length === 0) {
      return [fallback];
    }

    const dayOfYear = Math.floor(
      (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86_400_000
    );

    // Pick up to 3 unique suggestions, rotating deterministically by day-of-year
    const count = Math.min(3, pool.length);
    const results: Array<{ category: string; icon: string; title: string; detail: string; duration: string; points: number }> = [];
    for (let i = 0; i < count; i++) {
      const pick = pool[(dayOfYear + i) % pool.length];
      results.push({
        category: pick.category,
        icon: CATEGORY_ICONS[pick.category] || "star",
        title: pick.title,
        detail: pick.detail,
        duration: pick.duration,
        points: pick.gamificationPoints,
      });
    }

    return results;
  }, [groupIds, species, walkSafety.status, activePet?.name]);

  // ─── Routine items ──────────────────────────────────────────────────────────
  const currentHour = new Date().getHours();
  const currentRoutineItems = useMemo(() => {
    const routineGroup = resolveRoutineGroupId(groupIds, species);
    const routine = WELLBEING_MASTER_BOOK.routines.find((r) => r.groupId === routineGroup);
    if (!routine) return null;
    // Before 14:00 → morning routine
    // 14:00-21:00 → evening routine
    // After 21:00 → sleep message (no checklist)
    return currentHour < 14
      ? routine.morningRoutine
      : currentHour < 21
        ? routine.eveningRoutine
        : null; // Sleep time - no routine
  }, [groupIds, species, currentHour]);

  const routineTitle = currentHour < 14
    ? "Rutina de la mañana"
    : currentHour < 21
      ? "Rutina de la tarde"
      : "Descanso";

  const routineIcon = currentHour < 14
    ? "wb_sunny"
    : currentHour < 21
      ? "wb_twilight"
      : "bedtime";

  // ─── Load checked routine items from localStorage ───────────────────────────
  useEffect(() => {
    if (activePetId) {
      setCheckedRoutineItems(loadCheckedItems(activePetId));
    }
  }, [activePetId]);

  const handleRoutineToggle = useCallback(
    (item: string) => {
      setCheckedRoutineItems((prev) => {
        const wasChecked = prev.includes(item);
        const next = wasChecked ? prev.filter((i) => i !== item) : [...prev, item];
        if (activePetId) saveCheckedItems(activePetId, next);
        // Award points only when checking an item (not unchecking)
        if (!wasChecked) {
          const earned = addPoints(5);
          setPoints(earned);
        }
        return next;
      });
    },
    [activePetId]
  );

  // ─── Nudge for new user without breed ───────────────────────────────────────
  useEffect(() => {
    if (nudgedBreed) return;
    const breed = (activePet?.breed || "").trim();
    if (!breed) {
      const timer = setTimeout(() => {
        onProfileClick();
        setNudgedBreed(true);
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, [activePet?.id, nudgedBreed]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Weather fetching ───────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    const setUnavailable = () => {
      if (!cancelled) {
        setWeather({
          status: "unavailable",
          temperatureC: null,
          humidityPct: null,
          weatherCode: null,
          windSpeedKmh: null,
          uvIndex: null,
        });
      }
    };

    const loadWeather = async (lat: number, lng: number) => {
      try {
        const response = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&hourly=uv_index&forecast_days=1&timezone=auto`
        );
        if (!response.ok) throw new Error(`weather_http_${response.status}`);
        const payload = await response.json();
        const currentHourIndex = new Date().getHours();
        const uvArray = payload?.hourly?.uv_index;
        const snapshot: LiveWeatherSnapshot = {
          status: "ready",
          temperatureC: typeof payload?.current?.temperature_2m === "number" ? Math.round(payload.current.temperature_2m) : null,
          humidityPct:
            typeof payload?.current?.relative_humidity_2m === "number"
              ? Math.round(payload.current.relative_humidity_2m)
              : null,
          weatherCode: typeof payload?.current?.weather_code === "number" ? payload.current.weather_code : null,
          windSpeedKmh: typeof payload?.current?.wind_speed_10m === "number" ? Math.round(payload.current.wind_speed_10m) : null,
          uvIndex: Array.isArray(uvArray) && typeof uvArray[currentHourIndex] === "number" ? Math.round(uvArray[currentHourIndex]) : null,
        };
        if (!cancelled) {
          setWeather(snapshot);
        }
        if (typeof window !== "undefined") {
          window.localStorage.setItem(
            WEATHER_CACHE_KEY,
            JSON.stringify({ ...snapshot, cachedAt: Date.now() })
          );
        }
      } catch (_error) {
        setUnavailable();
      }
    };

    if (typeof window !== "undefined") {
      const rawCache = window.localStorage.getItem(WEATHER_CACHE_KEY);
      if (rawCache) {
        try {
          const parsed = JSON.parse(rawCache) as LiveWeatherSnapshot & { cachedAt?: number };
          if (
            parsed.status === "ready" &&
            typeof parsed.cachedAt === "number" &&
            Date.now() - parsed.cachedAt < 30 * 60 * 1000
          ) {
            setWeather({
              status: "ready",
              temperatureC: parsed.temperatureC,
              humidityPct: parsed.humidityPct,
              weatherCode: parsed.weatherCode ?? null,
              windSpeedKmh: parsed.windSpeedKmh ?? null,
              uvIndex: parsed.uvIndex ?? null,
            });
            return () => {
              cancelled = true;
            };
          }
        } catch (_error) {
          window.localStorage.removeItem(WEATHER_CACHE_KEY);
        }
      }
    }

    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setUnavailable();
      return () => {
        cancelled = true;
      };
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        void loadWeather(position.coords.latitude, position.coords.longitude);
      },
      () => {
        setUnavailable();
      },
      {
        enableHighAccuracy: false,
        timeout: 7000,
        maximumAge: 15 * 60 * 1000,
      }
    );

    return () => {
      cancelled = true;
    };
  }, []);

  // ─── Medical counts ─────────────────────────────────────────────────────────
  const appointmentCount = upcomingAppointments.length;
  const medicationCount = activeMedications.length;
  const historyCount = petEvents.length;

  if (!activePet) return null;

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════

  return (
    <div className="bg-[#F0FAF9] dark:bg-[#0D1B16] min-h-screen font-['Manrope',sans-serif]">
      <div className="max-w-md mx-auto pb-24">

        {/* 1. HERO - Pet photo with name overlay + blob */}
        <div className="relative h-[220px] overflow-hidden pessy-fade-up">
          <PetPhoto
            src={activePet.photo}
            alt={activePet.name}
            className="w-full h-full object-cover"
            fallbackClassName="rounded-none"
          />
          <div className="absolute bottom-0 left-0 right-0 h-[120px] bg-gradient-to-t from-[rgba(7,71,56,0.92)] via-[rgba(7,71,56,0.4)] to-transparent" />
          {/* Decorative blob — pessy.app organic feel */}
          <div className="pessy-blob absolute -top-10 -right-10 w-[120px] h-[120px] bg-[rgba(26,155,125,0.15)]" style={{ animationDelay: '2s' }} />
          <div className="absolute bottom-3.5 left-4 text-white">
            <h1
              className="text-[26px] font-[900] leading-none"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            >
              {activePet.name}
            </h1>
            <p className="text-xs opacity-80 mt-0.5">{activePet.breed}</p>
          </div>
          {/* Gamification points badge top-right */}
          <div className="absolute top-3 right-3 bg-[rgba(7,71,56,0.85)] text-white text-xs font-[800] px-3 py-1.5 rounded-full flex items-center gap-1 backdrop-blur-sm">
            <MaterialIcon name="star" className="!text-sm" /> {points} pts
          </div>
        </div>

        {/* ── MEDICAL PROFILE SUMMARY ─────────────────────────────────────── */}
        {hasMedicalSummary && (
          <div className="mx-3 mt-4 rounded-[20px] border border-[#074738]/10 bg-white overflow-hidden"
            style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
            <div className="h-1 bg-[#074738]" />
            <div className="px-4 py-3">
              <div className="flex items-center gap-1.5 mb-2.5">
                <MaterialIcon name="local_hospital" className="text-[#074738] !text-[15px]" />
                <p className="text-[11px] font-black uppercase tracking-widest text-[#074738]">
                  Perfil médico
                </p>
              </div>

              {profileSnapshot?.narrative ? (
                <p className="text-[12px] text-slate-600 leading-relaxed mb-2.5 line-clamp-2">
                  {profileSnapshot.narrative}
                </p>
              ) : null}

              {chronicConditions.length > 0 && (
                <div className="mb-2">
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5">
                    Condiciones activas
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {chronicConditions.slice(0, 4).map((condition, i) => (
                      <span
                        key={i}
                        className="text-[10px] font-semibold px-2.5 py-1 rounded-full bg-sky-50 text-sky-700 border border-sky-100"
                      >
                        {condition}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {activeMedications.length > 0 && (
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5">
                    Medicación activa
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {activeMedications.slice(0, 3).map((med, i) => (
                      <span
                        key={i}
                        className="text-[10px] font-semibold px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-100"
                      >
                        {med.name}{med.dosage ? ` · ${med.dosage}` : ""}
                      </span>
                    ))}
                    {activeMedications.length > 3 && (
                      <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-500">
                        +{activeMedications.length - 3}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── VACCINE ALERT BANNER — Connection Rule: 1-tap to book vet ── */}
        {onOpenNearbyVets && (
          <VaccineAlertBanner
            petName={activePet.name}
            onOpenNearbyVets={onOpenNearbyVets}
          />
        )}

        {/* ── SECTION 2: Cork/Fizz — the ONE most important thing right now ── */}
        <div className="mx-3 mt-4">
          <PessyDailyCheckin
            petName={activePet.name}
            petId={activePetId}
            species={species}
            medications={activeMedications.map((m) => ({ name: m.name, dosage: m.dosage }))}
            nextAppointment={upcomingAppointments[0] ?? null}
            pendingActions={getPendingActionsByPetId(activePetId)}
            onPointsEarned={(total) => setPoints(total)}
          />
        </div>



        {/* ── PRE-WALK PROMPT CARD ── */}
        {showPreWalkPrompt && (
          <div className="mx-3 mt-3 bg-white rounded-[16px] border border-[#E5E7EB] transition-all" style={{ padding: "14px 16px" }}>
            <div className="flex flex-col gap-3">
              <p className="text-[13px] font-bold text-[#1A1A1A]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                Son las {new Date().getHours()}:{String(new Date().getMinutes()).padStart(2, "0")} — ¿hoy salen con {activePet.name}?
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    /* TODO: abrir WalkLogModal */
                    setPreWalkDismissed(true);
                  }}
                  className="flex-1 px-3 py-1.5 rounded-full bg-[#074738] text-white text-[11px] font-bold active:scale-[0.96] transition-transform"
                >
                  ¡Sí, salimos!
                </button>
                <button
                  onClick={() => setPreWalkDismissed(true)}
                  className="flex-1 px-3 py-1.5 rounded-full border border-[#D1D5DB] text-[11px] font-bold text-[#6B7280] active:scale-[0.96] transition-transform"
                >
                  Hoy no
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── SECTION 3: Quick actions — 2 buttons max ── */}
        {(historyCount > 0 || medicationCount > 0 || appointmentCount > 0) && (
          <div className="mx-3 mt-3 flex gap-3">
            {historyCount > 0 && (
              <button
                onClick={onViewHistory}
                className="flex-1 flex items-center gap-2 bg-white rounded-2xl border border-[#E5E7EB] px-4 py-3 active:scale-[0.97] transition-transform"
                style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}
              >
                <MaterialIcon name="history" className="text-[#1A9B7D] !text-xl shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-bold text-[#074738]">Historial</p>
                  <p className="text-[10px] text-slate-400">{historyCount} eventos</p>
                </div>
              </button>
            )}
            {medicationCount > 0 ? (
              <button
                onClick={onMedicationsClick}
                className="flex-1 flex items-center gap-2 bg-white rounded-2xl border border-[#E5E7EB] px-4 py-3 active:scale-[0.97] transition-transform"
                style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}
              >
                <MaterialIcon name="medication" className="text-[#1A9B7D] !text-xl shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-bold text-[#074738]">Medicaciones</p>
                  <p className="text-[10px] text-slate-400">{medicationCount} activa{medicationCount !== 1 ? "s" : ""}</p>
                </div>
              </button>
            ) : appointmentCount > 0 ? (
              <button
                onClick={onAppointmentsClick}
                className="flex-1 flex items-center gap-2 bg-white rounded-2xl border border-[#E5E7EB] px-4 py-3 active:scale-[0.97] transition-transform"
                style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}
              >
                <MaterialIcon name="event" className="text-[#1A9B7D] !text-xl shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-bold text-[#074738]">Turnos</p>
                  <p className="text-[10px] text-slate-400">{appointmentCount} próximo{appointmentCount !== 1 ? "s" : ""}</p>
                </div>
              </button>
            ) : null}
          </div>
        )}

        {/* ── SECTION 4: Pessy te dice — 1-2 real tips ── */}
        {sortedRecommendations.length === 0 && historyCount === 0 && (
          <div className="mx-3 mt-3">
            <div className="bg-white rounded-2xl border border-[#E5E7EB] p-4" style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
              <div className="flex items-start gap-3">
                <div className="size-10 rounded-xl bg-[#E0F2F1] flex items-center justify-center shrink-0">
                  <span className="text-lg">📋</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-[#074738]">
                    {activePet?.name ? `Sumá el primer registro de ${activePet.name}` : "Sumá el primer registro"}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                    {activePet?.breed
                      ? `Con el historial de un ${activePet.breed}, Pessy puede darte sugerencias específicas.`
                      : "Con tu historial, Pessy puede darte sugerencias útiles."}
                  </p>
                  <button
                    onClick={onOpenScanner}
                    className="mt-3 px-4 py-2 rounded-xl bg-[#074738] text-white text-xs font-bold"
                  >
                    Agregar documento
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        {sortedRecommendations.length > 0 && (
          <div className="mx-3 mt-3 space-y-2">
            {sortedRecommendations.slice(0, 2).map((rec) => {
              const enhanced = rec as EnhancedTip;
              const missionCode = enhanced.isMission ? enhanced.code : undefined;
              return (
                <PessyTip
                  key={rec.id}
                  icon={rec.icon}
                  color={mapRecToTipColor(rec)}
                  title={rec.title}
                  description={rec.detail}
                  isMission={enhanced.isMission}
                  missionPoints={enhanced.missionPoints}
                  isCompleted={enhanced.isMission && enhanced.code ? completedMissions.has(enhanced.code) : false}
                  onMissionStart={enhanced.isMission && enhanced.code ? () => setActiveMissionCode(enhanced.code!) : undefined}
                  onMissionComplete={(total) => setPoints(total)}
                />
              );
            })}
          </div>
        )}

        {/* ── BREED INSIGHT CARD ── */}
        {activePet?.breed && !breedInsightDismissed && (
          <div className="mx-3 mt-3">
            <BreedInsightCard
              petName={activePet.name}
              breed={activePet.breed}
              ageMonths={ageMonths || 0}
              onAction={(actionType) => {
                if (actionType === "walk") {
                  /* TODO: abrir WalkLogModal */
                }
                if (actionType === "vet") {
                  onAppointmentsClick?.();
                }
                if (actionType === "routines") {
                  /* TODO: cambiar a tab rutinas */
                }
              }}
              onDismiss={() => setBreedInsightDismissed(true)}
            />
          </div>
        )}
      </div>

      {/* ─── Personality Onboarding (one-time quiz) ──────────────────────── */}
      {showPersonalityOnboarding && activePet && (
        <PersonalityOnboarding
          petName={activePet.name}
          petId={activePetId}
          species={species}
          onComplete={() => {
            setShowPersonalityOnboarding(false);
            // Reload personality so tips update immediately
            if (user && activePetId) {
              getDocs(collection(db, "users", user.uid, "pets", activePetId, "personality"))
                .then((snap) => {
                  const data: Personality = {};
                  snap.docs.forEach((d) => { data[d.id] = d.data() as { value: string }; });
                  setPersonality(data);
                })
                .catch(() => {});
            }
          }}
        />
      )}

      {/* ─── Mission Detail Screen ────────────────────────────────────────── */}
      {activeMissionCode && activePet && (
        <MissionDetailScreen
          missionCode={activeMissionCode}
          petName={activePet.name}
          onComplete={() => handleMissionComplete(activeMissionCode)}
          onClose={() => setActiveMissionCode(null)}
        />
      )}

      {/* ─── Preferences Editor Modal ─────────────────────────────────────── */}
      {showPreferences && activePet && (
        <Suspense fallback={null}>
          <PetPreferencesEditor
            petName={activePet.name}
            preferences={activePet.preferences || {}}
            onSave={async (prefs) => {
              await updatePet(activePetId, { preferences: prefs } as any);
              setShowPreferences(false);
            }}
            onClose={() => setShowPreferences(false)}
          />
        </Suspense>
      )}
    </div>
  );
}
