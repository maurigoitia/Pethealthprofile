import { MaterialIcon } from "./MaterialIcon";
import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useMedical } from "../contexts/MedicalContext";
import { usePet, type PetPreferences } from "../contexts/PetContext";
import { toTimestampSafe } from "../utils/dateUtils";
import { PetPhoto } from "./PetPhoto";

const PetPreferencesEditor = lazy(() =>
  import("./PetPreferencesEditor").then((m) => ({ default: m.PetPreferencesEditor }))
);
import {
  WELLBEING_MASTER_BOOK,
  type ThermalSafetyProfile,
  type WellbeingSpeciesGroupId,
} from "../../domain/wellbeing/wellbeingMasterBook";
import {
  runPessyIntelligence,
  type PessyIntelligenceRecommendation,
} from "../../domain/intelligence/pessyIntelligenceEngine";

import DailyHookCard from "./home/DailyHookCard";
import RoutineChecklist from "./home/RoutineChecklist";
import ProfileNudge from "./home/ProfileNudge";
import QuickActions from "./home/QuickActions";
import PessyTip, { SectionTitle } from "./home/PessyTip";

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
  const isBrachy = BRACHY_BREEDS.some((item) => normalizedBreed.includes(normalizeText(item)));

  if (species === "cat") {
    return [isBrachy ? "cat.brachycephalic" : "cat.general"];
  }

  return [isBrachy ? "dog.brachycephalic" : "dog.general"];
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

// ─── Inline WeatherPill ───────────────────────────────────────────────────────

function WeatherPill({
  icon,
  value,
  label,
  highlight,
}: {
  icon: string;
  value: string;
  label: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`flex-1 flex items-center gap-1.5 rounded-[12px] px-2.5 py-2 border ${
        highlight
          ? "border-[#1A9B7D] bg-[#eef8f3]"
          : "border-[#eef0ee] bg-white"
      }`}
    >
      <span
        className="material-symbols-rounded text-[#074738]"
        style={{ fontSize: 16 }}
      >
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-[12px] font-[800] text-[#002f24] leading-none">{value}</p>
        <p className="text-[10px] text-[#9ca8a2] leading-none mt-0.5">{label}</p>
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
  const [showPreferences, setShowPreferences] = useState(false);
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
  const { getEventsByPetId, getActiveMedicationsByPetId, getAppointmentsByPetId } = useMedical();

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
      fears: activePet.preferences?.fears,
      personality: activePet.preferences?.personality,
      favoriteActivities: activePet.preferences?.favoriteActivities,
      walkTimes: activePet.preferences?.walkTimes,
      foodDaysLeft,
    });
  }, [activePet?.id, activePet?.breed, activePet?.name, activePet?.age, activePet?.preferences, species, groupIds, weather, foodDaysLeft]);

  const sortedRecommendations = useMemo(() => {
    if (!intelligenceResult) return [];
    const order: Record<string, number> = { block: 0, alert: 1, recommendation: 2 };
    return [...intelligenceResult.recommendations].sort((a, b) => (order[a.kind] ?? 2) - (order[b.kind] ?? 2));
  }, [intelligenceResult]);

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
    return { status: "safe", badge: "Seguro" };
  }, [activePet?.breed, thermalProfile, weather]);

  // ─── Daily suggestion (deterministic by day-of-year) ────────────────────────
  const dailySuggestion = useMemo(() => {
    const routineGroup = resolveRoutineGroupId(groupIds, species);
    const weatherCondition = walkSafety.status === "blocked" ? "blocked" : walkSafety.status === "safe" ? "safe" : "any";

    const candidates = WELLBEING_MASTER_BOOK.daily_suggestions.filter(
      (s) => s.groupId === routineGroup && (s.weatherCondition === weatherCondition || s.weatherCondition === "any")
    );

    // If no candidates for the exact group, try all suggestions for weather condition
    const pool = candidates.length > 0
      ? candidates
      : WELLBEING_MASTER_BOOK.daily_suggestions.filter(
          (s) => s.weatherCondition === weatherCondition || s.weatherCondition === "any"
        );

    if (pool.length === 0) {
      return {
        category: "Actividad",
        icon: "park",
        title: `Tiempo de calidad con ${activePet?.name || "tu mascota"}`,
        detail: "Un buen momento para compartir tiempo con tu mascota.",
        duration: "15 min",
        points: 10,
      };
    }

    const dayOfYear = Math.floor(
      (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86_400_000
    );
    const pick = pool[dayOfYear % pool.length];

    return {
      category: pick.category,
      icon: CATEGORY_ICONS[pick.category] || "star",
      title: pick.title,
      detail: pick.detail,
      duration: pick.duration,
      points: pick.gamificationPoints,
    };
  }, [groupIds, species, walkSafety.status, activePet?.name]);

  // ─── Routine items ──────────────────────────────────────────────────────────
  const currentHour = new Date().getHours();
  const currentRoutineItems = useMemo(() => {
    const routineGroup = resolveRoutineGroupId(groupIds, species);
    const routine = WELLBEING_MASTER_BOOK.routines.find((r) => r.groupId === routineGroup);
    if (!routine) return [];
    return currentHour < 14 ? routine.morningRoutine : routine.eveningRoutine;
  }, [groupIds, species, currentHour]);

  // ─── Load checked routine items from localStorage ───────────────────────────
  useEffect(() => {
    if (activePetId) {
      setCheckedRoutineItems(loadCheckedItems(activePetId));
    }
  }, [activePetId]);

  const handleRoutineToggle = useCallback(
    (item: string) => {
      setCheckedRoutineItems((prev) => {
        const next = prev.includes(item) ? prev.filter((i) => i !== item) : [...prev, item];
        if (activePetId) saveCheckedItems(activePetId, next);
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
    <div className="bg-[#f6f6f8] dark:bg-[#101622] min-h-screen font-['Manrope',sans-serif]">
      <div className="max-w-md mx-auto pb-24">

        {/* 1. HERO - Pet photo with name overlay */}
        <div className="relative h-[200px] overflow-hidden">
          <PetPhoto
            src={activePet.photo}
            alt={activePet.name}
            className="w-full h-full object-cover"
            fallbackClassName="rounded-none"
          />
          <div className="absolute bottom-0 left-0 right-0 h-[100px] bg-gradient-to-t from-[rgba(7,71,56,0.85)] to-transparent" />
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
            <MaterialIcon name="star" className="!text-sm" /> 0 pts
          </div>
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
                    : "bg-white text-[#5e716b] border border-[#eef0ee]"
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
            <WeatherPill icon="thermostat" value={`${weather.temperatureC}°C`} label="Ahora" />
            <WeatherPill icon="water_drop" value={`${weather.humidityPct}%`} label="Humedad" />
            <WeatherPill
              icon="verified_user"
              value={walkSafety.badge}
              label="Paseo"
              highlight={walkSafety.status === "safe"}
            />
          </div>
        )}

        {/* 3. PROFILE NUDGE - only if incomplete */}
        {profileIncomplete && (
          <div className="mx-3 mt-2">
            <ProfileNudge
              petName={activePet.name}
              species={species}
              missingItems={missingItems}
              onComplete={onProfileClick}
            />
          </div>
        )}

        {/* 4. DAILY HOOK - suggestion from intelligence engine */}
        <SectionTitle>Hoy con {activePet.name}</SectionTitle>
        <div className="mx-3">
          <DailyHookCard
            category={dailySuggestion.category}
            categoryIcon={dailySuggestion.icon}
            title={dailySuggestion.title}
            description={dailySuggestion.detail}
            duration={dailySuggestion.duration}
            points={dailySuggestion.points}
          />
        </div>

        {/* 5. ROUTINE CHECKLIST - morning or evening based on time */}
        {currentRoutineItems.length > 0 && (
          <div className="mx-3 mt-2">
            <RoutineChecklist
              title={currentHour < 14 ? "Rutina de la mañana" : "Rutina de la noche"}
              icon={currentHour < 14 ? "wb_sunny" : "nightlight"}
              items={currentRoutineItems}
              checkedItems={checkedRoutineItems}
              onToggle={handleRoutineToggle}
            />
          </div>
        )}

        {/* 6. QUICK ACTIONS - only if pet has medical data */}
        <SectionTitle>Servicios</SectionTitle>
        <QuickActions
          appointments={appointmentCount}
          medications={medicationCount}
          historyCount={historyCount}
          onAppointmentsClick={onAppointmentsClick}
          onMedicationsClick={onMedicationsClick}
          onHistoryClick={onViewHistory}
        />

        {/* 7. PESSY TE DICE - tips from intelligence engine */}
        {sortedRecommendations.length > 0 && (
          <>
            <SectionTitle>Pessy te dice</SectionTitle>
            <div className="mx-3 space-y-1.5">
              {sortedRecommendations.map((rec) => (
                <PessyTip
                  key={rec.id}
                  icon={rec.icon}
                  color={mapRecToTipColor(rec)}
                  title={rec.title}
                  description={rec.detail}
                />
              ))}
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
