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
import { useAppLayout } from "../layout/AppLayout";
import { SafeBoundary } from "../shared/SafeBoundary";


const PetPreferencesEditor = lazy(() =>
  import("./PetPreferencesEditor.tsx").then((m) => ({ default: m.PetPreferencesEditor }))
);
import {
  WELLBEING_MASTER_BOOK,
  type WellbeingSpeciesGroupId,
} from "../../../domain/wellbeing/wellbeingMasterBook";
import HealthPulse from "../home/HealthPulse";
import RoutineChecklist from "../home/RoutineChecklist";
import { QuickActionsV2 } from "../home/QuickActionsV2";
import LearningVideosSection from "../learning/LearningVideosSection";

// ─── Types ────────────────────────────────────────────────────────────────────

type PetSpecies = "dog" | "cat";

interface LiveWeatherSnapshot {
  status: "loading" | "ready" | "unavailable";
  temperatureC: number | null;
  humidityPct: number | null;
  weatherCode: number | null;
  windSpeedKmh: number | null;
  uvIndex: number | null;
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
  const { openSymptomLog } = useAppLayout();
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
  const [checkedRoutineItems, setCheckedRoutineItems] = useState<string[]>(() => activePetId ? loadCheckedItemsLocal(activePetId) : []);
  const [pendingReviewCount, setPendingReviewCount] = useState(0);

  const { getEventsByPetId, getActiveMedicationsByPetId, getAppointmentsByPetId } = useMedical();
  const gamification = useGamification();

  const currentIndex = pets.findIndex((pet) => pet.id === activePetId);
  const safeCurrentIndex = currentIndex >= 0 ? currentIndex : 0;
  const activePet = pets[safeCurrentIndex];

  const petEvents = activePetId ? getEventsByPetId(activePetId) : [];
  const appointments = activePetId ? getAppointmentsByPetId(activePetId) : [];
  const activeMedications = activePetId ? getActiveMedicationsByPetId(activePetId) : [];

  const upcomingAppointments = appointments.filter((appointment) => {
    const dateValue = appointment.dateTime || `${appointment.date || ""}T${appointment.time || "00:00"}:00`;
    return toTimestampSafe(dateValue, 0) >= Date.now();
  });

  const species = resolveSpecies(activePet?.species, activePet?.breed);
  const groupIds = resolveGroupIds(species, activePet?.breed || "");

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

    // Overdue vaccines: vaccine events with revaccination_date in the past.
    // Track total vaccine events so HealthPulse can distinguish "Al día" vs "Sin datos".
    let overdueVaccineCount = 0;
    let vaccineEventCount = 0;
    for (const e of petEvents) {
      if (e.extractedData?.documentType !== "vaccine") continue;
      vaccineEventCount++;
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
      vaccineEventCount,
      activeMedicationCount: activeMedications.length,
      upcomingAppointmentCount: upcomingAppointments.length,
      recurringConditions: recurringConditions.length > 0 ? recurringConditions : undefined,
    };
  }, [petEvents, activeMedications.length, upcomingAppointments.length]);

  // NOTA Épica 6: bloque intelligenceResult/sortedRecommendations/criticalAlert
  // eliminado — solo alimentaba "Pessy te dice" que estaba oculto detrás de
  // false &&. Si en el futuro vuelve a usarse, recuperar runPessyIntelligence
  // desde domain/intelligence/pessyIntelligenceEngine.

  // walkSafety eliminado (Épica 6): solo alimentaba WeatherPills (también
  // removida). thermalProfile/groupIds quedan disponibles para futura mini-
  // badge dentro de HealthPulse si se decide volver a mostrar paseo.

  // NOTA: el bloque dailySuggestions (sugerencias rotativas tipo "Limpieza de
  // pliegues", "Sesión de calma", etc.) fue eliminado en Épica 1 — se computaba
  // pero nunca se renderizaba, y mostraba items que no tenían flow real de
  // "empezar". Si en el futuro se vuelve a usar contenido de
  // WELLBEING_MASTER_BOOK.daily_suggestions, hay que conectar un onClick que
  // realmente abra los `steps` o se elimina el botón.

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
              pets={pets}
              activePetId={activePetId}
              onPetChange={onPetChange}
            />
          </SafeBoundary>
          <SafeBoundary name="HomeGreetingV2">
            <HomeGreetingV2 userName={userName} petName={activePet.name} />
          </SafeBoundary>
        </div>

        {/* Pet selector eliminado (Épica 2A): el cambio de mascota ahora se
            hace por swipe horizontal en el HomeHeaderV2 + dots indicator. */}

        {/* WeatherPills eliminado (Épica 6 audit): decorativo sin CTA. El clima
            sigue alimentando walkSafety + intelligence engine en background.
            TODO: revisar si vale recuperar como mini-badge dentro de HealthPulse. */}

        {/* 2b. PENDIENTE HOY — card central v2 con meds + turnos del día */}
        <SafeBoundary name="PendienteHoyCard">
          <PendienteHoyCard
            medications={activeMedications.filter((m) => !activePet.id || m.petId === activePet.id)}
            appointments={appointments.filter((a) => a.petId === activePet.id)}
            petName={activePet.name}
          />
        </SafeBoundary>

        {/* 2c. ALGO RARO HOY — quick symptom log (foto + nota corta).
            Resuelve el pain del Reddit thread: "scrolling forever through camera roll". */}
        <SafeBoundary name="QuickLogButton">
          <button
            type="button"
            onClick={openSymptomLog}
            className="mx-3 mt-3 mb-1 flex w-[calc(100%-1.5rem)] items-center gap-3 rounded-[16px] border border-[#1A9B7D]/20 bg-gradient-to-br from-[#E0F2F1] to-white px-4 py-3.5 active:scale-[0.98] transition-transform shadow-[0_2px_8px_rgba(7,71,56,0.06)]"
          >
            <div className="size-11 rounded-[12px] bg-[#1A9B7D] flex items-center justify-center shrink-0">
              <MaterialIcon name="photo_camera" className="text-xl text-white" />
            </div>
            <div className="flex-1 text-left">
              <p
                className="text-sm font-extrabold text-[#074738] leading-tight"
                style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
              >
                ¿Algo raro hoy?
              </p>
              <p
                className="text-[11px] text-slate-500 mt-0.5"
                style={{ fontFamily: "Manrope, sans-serif" }}
              >
                Sacá foto y nota — al historial en 10 segundos
              </p>
            </div>
            <MaterialIcon name="chevron_right" className="text-lg text-slate-400 shrink-0" />
          </button>
        </SafeBoundary>

        {/* 3. QUICK ACTIONS — navegación principal, alta prioridad de acción */}
        <div className="mt-3">
          <QuickActionsV2
            pendingReviewCount={pendingReviewCount}
            upcomingAppointments={appointmentCount}
            activeMedications={medicationCount}
          />
        </div>

        {/* 4. HEALTH PULSE — diagnóstico actual (vacunas, vet visits, condiciones) */}
        <div className="mx-3 mt-2">
          <HealthPulse
            petName={activePet.name}
            overdueVaccines={medicalHistoryInputs.overdueVaccineCount}
            vaccineEventCount={medicalHistoryInputs.vaccineEventCount}
            activeMedications={activeMedications.length}
            lastVetVisitDaysAgo={medicalHistoryInputs.lastVetVisitDaysAgo}
            recurringConditions={medicalHistoryInputs.recurringConditions || []}
            upcomingAppointments={upcomingAppointments.length}
          />
        </div>

        {/* 5. ROUTINE CHECKLIST — morning/evening/sleep según hora.
            Si no hay rutina (sleep mode con 0 items), no rendereamos NADA
            para evitar card decorativa "ya descansa". */}
        {currentRoutineItems && currentRoutineItems.length > 0 && (
          <div className="mx-3 mt-2">
            <RoutineChecklist
              title={routineTitle}
              icon={routineIcon}
              items={currentRoutineItems}
              checkedItems={checkedRoutineItems}
              onToggle={handleRoutineToggle}
            />
          </div>
        )}

        {/* 6. LEARNING VIDEOS — al final: contenido educativo opcional.
            Matchea videos curados por especie + condiciones + edad. 0 matches → oculto. */}
        <SafeBoundary name="LearningVideosSection">
          <LearningVideosSection pet={activePet} />
        </SafeBoundary>

        {/* PreferencesNudge / ProfileNudge / PessyTeDice eliminados (Épica 6):
            estaban detrás de `false &&` desde el ajuste de UI kit v2. Si en el
            futuro hace falta un nudge de perfil incompleto, agregarlo dentro
            de HealthPulse o en un settings dedicado — no como card extra. */}
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
