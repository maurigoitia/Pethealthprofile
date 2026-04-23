import { MaterialIcon } from "../shared/MaterialIcon";
import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useMedical } from "../../contexts/MedicalContext";
import { useGamification } from "../../contexts/GamificationContext";
import { usePet, type PetPreferences } from "../../contexts/PetContext";
import { toTimestampSafe } from "../../utils/dateUtils";
import { doc, getDoc, setDoc, collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import { useAuth } from "../../contexts/AuthContext";
import { PetPhoto } from "./PetPhoto";
import { HomeHeaderV2 } from "./HomeHeaderV2";
import { HomeGreetingV2 } from "./HomeGreetingV2";
import { PendienteHoyCard } from "./PendienteHoyCard";
import { SafeBoundary } from "../shared/SafeBoundary";


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
import HealthPulse from "../home/HealthPulse";
import RoutineChecklist from "../home/RoutineChecklist";
import ProfileNudge from "../home/ProfileNudge";
import { QuickActionsV2 } from "../home/QuickActionsV2";
import PessyTip, { SectionTitle } from "../home/PessyTip";

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

// ─── Routine persistence: localStorage (cache) + Firestore (source of truth) ─
function getRoutineDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function getRoutineStorageKey(petId: string): string {
  return `pessy_routine_${petId}_${getRoutineDate()}`;
}

/** Read from localStorage cache (instant, works offline) */
function loadCheckedItemsLocal(petId: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(getRoutineStorageKey(petId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/** Save to both localStorage (instant) and Firestore (persistent, cross-device) */
function saveCheckedItems(petId: string, userId: string, items: string[]) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(getRoutineStorageKey(petId), JSON.stringify(items));
  }
  const date = getRoutineDate();
  const docId = `${petId}_${date}`;
  setDoc(doc(db, "routine_completions", docId), {
    petId,
    userId,
    date,
    checkedItems: items,
    updatedAt: new Date().toISOString(),
  }, { merge: true }).catch(() => {
    // Firestore write failed — localStorage still has the data, will retry on next toggle
  });
}

/** Load from Firestore (cross-device sync); falls back to localStorage */
async function loadCheckedItemsFromFirestore(petId: string): Promise<string[] | null> {
  try {
    const date = getRoutineDate();
    const docId = `${petId}_${date}`;
    const snap = await getDoc(doc(db, "routine_completions", docId));
    if (snap.exists()) {
      const data = snap.data();
      return Array.isArray(data.checkedItems) ? data.checkedItems : null;
    }
    return null;
  } catch {
    return null;
  }
}

// ─── RECOMMENDATION COLOR MAPPING ────────────────────────────────────────────

function mapRecToTipColor(rec: PessyIntelligenceRecommendation): "green" | "blue" | "orange" {
  const segment = rec.slot?.toLowerCase() || "";
  if (segment.includes("block") || segment.includes("alert") || rec.kind === "block" || rec.kind === "alert") {
    return "orange";
  }
  if (segment.includes("training") || segment.includes("routine")) {
    return "green";
  }
  return "blue";
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export function PetHomeView({
  userName,
  onViewHistory,
  onProfileClick,
  onPetClick,
  onAppointmentsClick,
  onMedicationsClick,
  pets,
  activePetId,
  onPetChange,
}: PetHomeViewProps) {
  const { updatePet } = usePet();
  const { user } = useAuth();
  const [showPreferences, setShowPreferences] = useState(false);
  const [showAllTasks, setShowAllTasks] = useState(false);
  const [weather, setWeather] = useState<LiveWeatherSnapshot>({
    status: "loading",
    temperatureC: null,
    humidityPct: null,
    weatherCode: null,
    windSpeedKmh: null,
    uvIndex: null,
  });
  const [nudgedBreed, setNudgedBreed] = useState(false);
  const [checkedRoutineItems, setCheckedRoutineItems] = useState<string[]>(() => activePetId ? loadCheckedItemsLocal(activePetId) : []);
  const [pendingReviewCount, setPendingReviewCount] = useState(0);

  const { getEventsByPetId, getActiveMedicationsByPetId, getAppointmentsByPetId } = useMedical();
  const gamification = useGamification();

  const currentIndex = pets.findIndex((pet) => pet.id === activePetId);
  const safeCurrentIndex = currentIndex >= 0 ? currentIndex : 0;
  const activePet = pets[safeCurrentIndex];
  const hasMultiplePets = pets.length > 1;

  const petEvents = activePetId ? getEventsByPetId(activePetId) : [];
  const appointments = activePetId ? getAppointmentsByPetId(activePetId) : [];
  const activeMedications = activePetId ? getActiveMedicationsByPetId(activePetId) : [];

  const upcomingAppointments = appointments.filter((appointment) => {
    const dateValue = appointment.dateTime || `${appointment.date || ""}T${appointment.time || "00:00"}:00`;
    return toTimestampSafe(dateValue, 0) >= Date.now();
  });

  const species = resolveSpecies(activePet?.species, activePet?.breed);
  const groupIds = resolveGroupIds(species, activePet?.breed || "");
  const thermalProfile = resolveThermalProfile(species, groupIds);
  const foodDaysLeft = computeFoodDaysLeft(activePet?.preferences);

  // ─── Profile completeness ───────────────────────────────────────────────────
  const missingItems: string[] = [];
  if (!activePet?.photo) missingItems.push("foto");
  if (!activePet?.weight) missingItems.push("peso");
  if (!activePet?.breed) missingItems.push("raza");
  const profileIncomplete = missingItems.length > 0;

  // ─── Medical history derivation for intelligence engine ─────────────────────
  const medicalHistoryInputs = useMemo(() => {
    const now = Date.now();
    const DAY_MS = 86_400_000;

    // Last vet visit (checkup, surgery, appointment events)
    const vetVisitTypes = new Set(["checkup", "appointment", "surgery"]);
    const vetVisitDates = petEvents
      .filter(e => vetVisitTypes.has(e.extractedData?.documentType))
      .map(e => toTimestampSafe(e.extractedData?.eventDate || e.createdAt, 0))
      .filter(ts => ts > 0);
    const lastVetVisitDaysAgo = vetVisitDates.length > 0
      ? Math.round((now - Math.max(...vetVisitDates)) / DAY_MS)
      : null;

    // Overdue vaccines: vaccine events with revaccination_date in the past
    let overdueVaccineCount = 0;
    for (const e of petEvents) {
      if (e.extractedData?.documentType !== "vaccine") continue;
      const revacDate = e.extractedData?.vaccine_artifacts?.revaccination_date;
      if (revacDate) {
        const ts = toTimestampSafe(revacDate, 0);
        if (ts > 0 && ts < now) overdueVaccineCount++;
      }
    }

    // Recurring conditions: diagnoses that appear 2+ times
    const diagnosisCounts = new Map<string, number>();
    for (const e of petEvents) {
      const diag = e.extractedData?.diagnosis?.toLowerCase().trim();
      if (diag && diag.length > 2) {
        diagnosisCounts.set(diag, (diagnosisCounts.get(diag) || 0) + 1);
      }
    }
    const recurringConditions = [...diagnosisCounts.entries()]
      .filter(([, count]) => count >= 2)
      .map(([diag]) => diag.charAt(0).toUpperCase() + diag.slice(1));

    return {
      lastVetVisitDaysAgo,
      overdueVaccineCount,
      activeMedicationCount: activeMedications.length,
      upcomingAppointmentCount: upcomingAppointments.length,
      recurringConditions: recurringConditions.length > 0 ? recurringConditions : undefined,
    };
  }, [petEvents, activeMedications.length, upcomingAppointments.length]);

  // ─── Intelligence engine ────────────────────────────────────────────────────
  const intelligenceResult = useMemo(() => {
    if (!activePet?.breed) return null;
    const wc = weather.weatherCode;
    return runPessyIntelligence({
      petName: activePet.name,
      species,
      breed: activePet.breed,
      ageLabel: activePet.age || "",
      groupIds,
      temperatureC: weather.temperatureC,
      humidityPct: weather.humidityPct,
      isRaining: wc !== null && WMO_RAIN_CODES.includes(wc),
      isStormy: wc !== null && wc >= 95,
      windSpeedKmh: weather.windSpeedKmh,
      uvIndex: weather.uvIndex,
      currentHour: new Date().getHours(),
      // Normalizar arrays: datos legacy en Firestore pueden venir como string/null/objeto
      // en lugar de array. '.some()' / '.includes()' en el engine crashean si no es array.
      fears: Array.isArray(activePet.preferences?.fears) ? activePet.preferences!.fears! : [],
      personality: Array.isArray(activePet.preferences?.personality) ? activePet.preferences!.personality! : [],
      favoriteActivities: Array.isArray(activePet.preferences?.favoriteActivities) ? activePet.preferences!.favoriteActivities! : [],
      walkTimes: Array.isArray(activePet.preferences?.walkTimes) ? activePet.preferences!.walkTimes! : [],
      foodDaysLeft,
      ...medicalHistoryInputs,
    });
  }, [activePet?.id, activePet?.breed, activePet?.name, activePet?.age, activePet?.preferences, species, groupIds, weather, foodDaysLeft, medicalHistoryInputs]);

  const sortedRecommendations = useMemo(() => {
    if (!intelligenceResult) return [];
    const order: Record<string, number> = { block: 0, alert: 1, recommendation: 2 };
    return [...intelligenceResult.recommendations].sort((a, b) => (order[a.kind] ?? 2) - (order[b.kind] ?? 2));
  }, [intelligenceResult]);

  // ─── Critical alert for "Pessy te dice" (single most urgent) ───────────────
  const criticalAlert = sortedRecommendations.find(
    (rec) => rec.kind === "block" || rec.kind === "alert"
  ) ?? null;

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

  // ─── Load checked routine items: localStorage first (instant), then Firestore ─
  useEffect(() => {
    if (!activePetId) return;
    // Instant load from localStorage cache
    setCheckedRoutineItems(loadCheckedItemsLocal(activePetId));
    // Then sync from Firestore (cross-device, persistent)
    loadCheckedItemsFromFirestore(activePetId).then((firestoreItems) => {
      if (firestoreItems && firestoreItems.length > 0) {
        setCheckedRoutineItems(firestoreItems);
        // Update localStorage cache with Firestore truth
        if (typeof window !== "undefined") {
          window.localStorage.setItem(getRoutineStorageKey(activePetId), JSON.stringify(firestoreItems));
        }
      }
    });
  }, [activePetId]);

  const handleRoutineToggle = useCallback(
    (item: string) => {
      setCheckedRoutineItems((prev) => {
        const wasChecked = prev.includes(item);
        const next = wasChecked ? prev.filter((i) => i !== item) : [...prev, item];
        if (activePetId && user?.uid) saveCheckedItems(activePetId, user.uid, next);
        // Award points only when checking an item (not unchecking)
        if (!wasChecked) {
          void gamification.addPoints("complete_routine");
        }
        return next;
      });
    },
    [activePetId, user?.uid]
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

  // ─── Pending email reviews (real-time) ──────────────────────────────────────
  useEffect(() => {
    if (!activePetId) { setPendingReviewCount(0); return; }
    const q = query(
      collection(db, "pending_reviews"),
      where("petId", "==", activePetId),
      where("status", "==", "pending"),
    );
    const unsub = onSnapshot(q, (snap) => setPendingReviewCount(snap.size), () => setPendingReviewCount(0));
    return unsub;
  }, [activePetId]);

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
      <div id="main-content" role="main" className="max-w-md mx-auto pb-24">

        {/* 1. HEADER V2 + GREETING V2 — compact avatar + morning greeting */}
        <div className="pessy-fade-up pt-2">
          <SafeBoundary name="HomeHeaderV2">
            <HomeHeaderV2
              petName={activePet.name}
              petBreed={activePet.breed}
              petPhoto={activePet.photo}
              notificationCount={pendingReviewCount}
              pointsTotal={gamification.totalPoints}
              onBellClick={onViewHistory}
            />
          </SafeBoundary>
          <SafeBoundary name="HomeGreetingV2">
            <HomeGreetingV2 userName={userName} petName={activePet.name} />
          </SafeBoundary>
        </div>

        {/* Pet selector for multiple pets */}
        {hasMultiplePets && (
          <div className="mx-3 mt-2 flex items-center gap-2 overflow-x-auto pb-1">
            {pets.map((pet) => (
              <button
                key={pet.id}
                onClick={() => onPetChange(pet.id)}
                className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold transition-colors ${
                  pet.id === activePetId
                    ? "bg-[#074738] text-white"
                    : "bg-white text-[#9CA3AF] border border-[#E5E7EB]"
                }`}
              >
                {pet.name}
              </button>
            ))}
          </div>
        )}

        {/* 2. WEATHER STRIP - 3 pills */}
        {weather.status === "ready" && (
          <div className="flex gap-1.5 mx-3 mt-2.5">
            <WeatherPill emoji="🌡️" value={`${weather.temperatureC}°C`} label="Ahora" />
            <WeatherPill emoji="💧" value={`${weather.humidityPct}%`} label="Humedad" />
            <WeatherPill
              emoji={walkSafety.status === "safe" ? "✅" : walkSafety.status === "caution" ? "⚠️" : "🚫"}
              value={walkSafety.badge}
              label="Paseo"
              highlight={walkSafety.status === "safe"}
            />
          </div>
        )}

        {/* 2b. PENDIENTE HOY — card central v2 con meds + turnos del día */}
        <SafeBoundary name="PendienteHoyCard">
          <PendienteHoyCard
            medications={activeMedications.filter((m) => !activePet.id || m.petId === activePet.id)}
            appointments={appointments.filter((a) => a.petId === activePet.id)}
            petName={activePet.name}
          />
        </SafeBoundary>

        {/* 3. DAILY TASKS — contexto del día, primero para dar orientación inmediata */}
        <SectionTitle>Hoy con {activePet.name}</SectionTitle>
        <div className="pessy-stagger mx-4 space-y-2">
          {(showAllTasks ? dailySuggestions : dailySuggestions.slice(0, 2)).map((s, i) => (
            <DailyHookCard
              key={i}
              category={CATEGORY_LABELS[s.category] || s.category}
              categoryIcon={s.icon}
              title={s.title}
              description={s.detail}
              duration={s.duration}
              points={s.points}
              steps={s.steps}
              onStart={() => { void gamification.addPoints("daily_checkin"); }}
            />
          ))}
          {dailySuggestions.length > 2 && !showAllTasks && (
            <button
              onClick={() => setShowAllTasks(true)}
              className="w-full rounded-full border border-[#E5E7EB] bg-white py-2.5 text-xs font-bold text-[#074738] hover:bg-[#E0F2F1] transition-colors"
            >
              Ver más actividades
            </button>
          )}
        </div>

        {/* 4. ROUTINE CHECKLIST - morning, evening, or sleep based on time */}
        {currentRoutineItems && currentRoutineItems.length > 0 ? (
          <div className="mx-3 mt-2">
            <RoutineChecklist
              title={routineTitle}
              icon={routineIcon}
              items={currentRoutineItems}
              checkedItems={checkedRoutineItems}
              onToggle={handleRoutineToggle}
            />
          </div>
        ) : currentRoutineItems === null ? (
          <div className="mx-3 mt-2">
            <div className="rounded-[16px] border border-[#E5E7EB] bg-white flex items-center gap-3" style={{ padding: "14px 16px" }}>
              <span className="text-[#074738]">
                <MaterialIcon name="bedtime" className="!text-[22px]" />
              </span>
              <span className="text-[13px] font-[800] text-[#074738]">
                {activePet.name} ya descansa. Mañana seguimos.
              </span>
            </div>
          </div>
        ) : null}

        {/* 5. HEALTH PULSE — alertas de salud, después del contexto */}
        <div className="mx-3 mt-2">
          <HealthPulse
            petName={activePet.name}
            overdueVaccines={medicalHistoryInputs.overdueVaccineCount}
            activeMedications={activeMedications.length}
            lastVetVisitDaysAgo={medicalHistoryInputs.lastVetVisitDaysAgo}
            recurringConditions={medicalHistoryInputs.recurringConditions || []}
            upcomingAppointments={upcomingAppointments.length}
          />
        </div>

        {/* 5a. QUICK ACTIONS — always visible, action-oriented */}
        <div className="mt-3">
          <QuickActionsV2
            pendingReviewCount={pendingReviewCount}
            upcomingAppointments={appointmentCount}
            activeMedications={medicationCount}
          />
        </div>

        {/* 5b. PREFERENCES NUDGE — OCULTO (no estaba en UI kit v2)
            User flag: estas cards amarillas/mint distorsionan el flow del kit.
            Mover a un settings screen dedicado en el futuro. */}
        {false && activePet && !(Array.isArray(activePet.preferences?.personality) ? activePet.preferences!.personality!.length : 0) && !(Array.isArray(activePet.preferences?.fears) ? activePet.preferences!.fears!.length : 0) && !(Array.isArray(activePet.preferences?.favoriteActivities) ? activePet.preferences!.favoriteActivities!.length : 0) && (
          <div className="mx-3 mt-2">
            <button
              type="button"
              onClick={() => setShowPreferences(true)}
              className="w-full rounded-[16px] border border-[#1A9B7D]/20 bg-[#E0F2F1] flex items-center gap-3 text-left transition-colors hover:bg-[#C8E6E3]"
              style={{ padding: "14px 16px" }}
            >
              <span className="text-[22px]">🎯</span>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-[800] text-[#074738]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                  Contanos sobre {activePet.name}
                </p>
                <p className="text-[11px] font-[500] text-[#6B7280] mt-0.5">
                  Personalidad, actividades y miedos — para sugerencias más precisas
                </p>
              </div>
              <span className="text-[#1A9B7D] text-lg shrink-0">→</span>
            </button>
          </div>
        )}

        {/* 6. PROFILE NUDGE — OCULTO (no estaba en UI kit v2) */}
        {false && profileIncomplete && (
          <div className="mx-3 mt-2">
            <ProfileNudge
              petName={activePet.name}
              species={species}
              missingItems={missingItems}
              onComplete={onProfileClick}
            />
          </div>
        )}

        {/* 7. PESSY TE DICE — OCULTO (no estaba en UI kit v2) */}
        {false && criticalAlert && (
          <>
            <SectionTitle>Pessy te dice</SectionTitle>
            <div className="mx-4">
              <PessyTip
                icon={criticalAlert.icon}
                color={mapRecToTipColor(criticalAlert)}
                title={criticalAlert.title}
                description={criticalAlert.detail}
                actionLabel={
                  criticalAlert.sourceModule === "medical_history" ? "Ver historial" :
                  criticalAlert.sourceModule === "supply_tracker" ? "Ver recordatorios" :
                  criticalAlert.sourceModule === "breed_profile" ? "Completar perfil" :
                  criticalAlert.sourceModule === "weight_trend" ? "Ver historial" :
                  criticalAlert.sourceModule === "recurring_conditions" ? "Ver historial" :
                  undefined
                }
                onAction={
                  criticalAlert.sourceModule === "medical_history" ? onViewHistory :
                  criticalAlert.sourceModule === "supply_tracker" ? onMedicationsClick :
                  criticalAlert.sourceModule === "breed_profile" ? onProfileClick :
                  criticalAlert.sourceModule === "weight_trend" ? onViewHistory :
                  criticalAlert.sourceModule === "recurring_conditions" ? onViewHistory :
                  undefined
                }
              />
            </div>
          </>
        )}
      </div>

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
