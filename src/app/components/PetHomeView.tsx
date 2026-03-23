import { MaterialIcon } from "./MaterialIcon";
import { motion, PanInfo } from "motion/react";
import { useEffect, useState } from "react";
import { useMedical } from "../contexts/MedicalContext";
import { formatDateSafe, toTimestampSafe } from "../utils/dateUtils";
import { PetPhoto } from "./PetPhoto";
import {
  WELLBEING_MASTER_BOOK,
  type ThermalSafetyProfile,
  type WellbeingSpeciesGroupId,
} from "../../domain/wellbeing/wellbeingMasterBook";

type DietPreference = "balanced" | "barf" | "mixed";
type PetSpecies = "dog" | "cat";
type WalkSafetyStatus = "missing_data" | "unavailable" | "safe" | "caution" | "blocked";

interface LiveWeatherSnapshot {
  status: "loading" | "ready" | "unavailable";
  temperatureC: number | null;
  humidityPct: number | null;
}

interface WalkSafetyState {
  status: WalkSafetyStatus;
  badge: string;
  title: string;
  detail: string;
  helper: string;
  primaryLabel: string;
  primaryAction: "profile" | "appointments" | "medications";
  secondaryLabel: string;
  secondaryAction: "profile" | "appointments" | "medications" | "history";
  toneClassName: string;
  icon: string;
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

const DIET_OPTIONS: Array<{ value: DietPreference; label: string }> = [
  { value: "balanced", label: "Balanceado" },
  { value: "barf", label: "BARF" },
  { value: "mixed", label: "Mixto" },
];

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

function getReplacementTime(groupIds: WellbeingSpeciesGroupId[]) {
  return groupIds.includes("dog.brachycephalic") ? "19:00" : "18:30";
}

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
  const [isDragging, setIsDragging] = useState(false);
  const [dietPreference, setDietPreference] = useState<DietPreference | null>(null);
  const [weather, setWeather] = useState<LiveWeatherSnapshot>({
    status: "loading",
    temperatureC: null,
    humidityPct: null,
  });
  const [nudgedBreed, setNudgedBreed] = useState(false);
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

  const nextAppointment =
    [...upcomingAppointments].sort(
      (a, b) =>
        toTimestampSafe(a.dateTime || `${a.date || ""}T${a.time || "00:00"}:00`, Date.now()) -
        toTimestampSafe(b.dateTime || `${b.date || ""}T${b.time || "00:00"}:00`, Date.now())
    )[0] || null;

  const identityItems = [
    { label: "Perfil", ready: Boolean(activePet?.name && activePet?.breed) },
    { label: "Foto", ready: Boolean(activePet?.photo) },
    { label: "Peso", ready: Boolean(activePet?.weight) },
    { label: "Papeles", ready: petEvents.length > 0 },
  ];
  const identityReadyCount = identityItems.filter((item) => item.ready).length;
  const identityProgress = Math.round((identityReadyCount / identityItems.length) * 100);

  const servicesCount = upcomingAppointments.length + activeMedications.length;
  const dietStorageKey = activePetId ? `pessy_supply_diet_${activePetId}` : null;
  const species = resolveSpecies(activePet?.species, activePet?.breed);
  const groupIds = resolveGroupIds(species, activePet?.breed || "");
  const thermalProfile = resolveThermalProfile(species, groupIds);

  useEffect(() => {
    if (!dietStorageKey || typeof window === "undefined") {
      setDietPreference(null);
      return;
    }

    const stored = window.localStorage.getItem(dietStorageKey);
    if (stored === "balanced" || stored === "barf" || stored === "mixed") {
      setDietPreference(stored);
      return;
    }

    setDietPreference(null);
  }, [dietStorageKey]);

  // Nudge automático para usuario nuevo sin raza cargada
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

  useEffect(() => {
    let cancelled = false;

    const setUnavailable = () => {
      if (!cancelled) {
        setWeather({
          status: "unavailable",
          temperatureC: null,
          humidityPct: null,
        });
      }
    };

    const loadWeather = async (lat: number, lng: number) => {
      try {
        const response = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,relative_humidity_2m&forecast_days=1&timezone=auto`
        );
        if (!response.ok) throw new Error(`weather_http_${response.status}`);
        const payload = await response.json();
        const snapshot: LiveWeatherSnapshot = {
          status: "ready",
          temperatureC: typeof payload?.current?.temperature_2m === "number" ? Math.round(payload.current.temperature_2m) : null,
          humidityPct:
            typeof payload?.current?.relative_humidity_2m === "number"
              ? Math.round(payload.current.relative_humidity_2m)
              : null,
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

  const saveDietPreference = (value: DietPreference) => {
    setDietPreference(value);
    if (!dietStorageKey || typeof window === "undefined") return;
    window.localStorage.setItem(dietStorageKey, value);
  };

  const serviceSummary = nextAppointment
    ? {
        title: "Se viene algo agendado",
        detail: [
          formatDateSafe(
            nextAppointment.date || nextAppointment.dateTime,
            "es-AR",
            { day: "numeric", month: "short" },
            "Sin fecha"
          ),
          nextAppointment.time ? `${nextAppointment.time} hs` : null,
        ]
          .filter(Boolean)
          .join(" · "),
      }
    : activeMedications.length > 0
      ? {
          title: `${activeMedications.length} cuidado${activeMedications.length !== 1 ? "s" : ""} en curso`,
          detail: "Todo lo que está siguiendo ahora vive en un solo lugar.",
        }
      : {
        title: `Todo en orden con ${activePet?.name || "tu mascota"}`,
        detail: "No hay nada próximo para resolver ahora.",
      };

  const walkSafety: WalkSafetyState = (() => {
    const breed = (activePet?.breed || "").trim();

    if (!breed || !thermalProfile) {
      return {
        status: "missing_data",
        badge: "Falta dato",
        title: `No puedo calcular la salida de ${activePet.name}`,
        detail: `Sin la raza de ${activePet.name} no puedo decirte si hoy conviene salir o esperar.`,
        helper: "Cargá la raza y Pessy activa el semáforo de seguridad.",
        primaryLabel: "Completar perfil",
        primaryAction: "profile",
        secondaryLabel: "Actividad",
        secondaryAction: "history",
        toneClassName: "border-slate-300 bg-slate-100 text-slate-900 dark:border-slate-700 dark:bg-slate-800/80 dark:text-white",
        icon: "help",
      };
    }

    if (weather.status !== "ready" || weather.temperatureC === null) {
      return {
        status: "unavailable",
        badge: "Sin clima",
        title: "Activá ubicación para ver el clima de hoy",
        detail: `Con tu ubicación, Pessy te dice si hoy es un buen momento para salir con ${activePet.name}.`,
        helper: serviceSummary.detail,
        primaryLabel: "Ver turnos",
        primaryAction: "appointments",
        secondaryLabel: "Ver tratamientos",
        secondaryAction: "medications",
        toneClassName: "border-slate-300 bg-slate-50 text-slate-900 dark:border-slate-700 dark:bg-slate-800/80 dark:text-white",
        icon: "location_off",
      };
    }

    const humidityPenalty = thermalProfile.humiditySensitive && (weather.humidityPct ?? 0) >= 70;
    const severeRisk = thermalProfile.severeRiskAboveC ?? Number.POSITIVE_INFINITY;
    const avoidExercise = thermalProfile.avoidExerciseAboveC ?? Number.POSITIVE_INFINITY;
    const cautionThreshold =
      typeof avoidExercise === "number" && Number.isFinite(avoidExercise)
        ? Math.max((thermalProfile.comfortableMaxC ?? avoidExercise) + 1, avoidExercise - 3)
        : thermalProfile.comfortableMaxC ?? 26;
    const replacementTime = getReplacementTime(groupIds);

    if (weather.temperatureC >= severeRisk || weather.temperatureC > avoidExercise || humidityPenalty) {
      return {
        status: "blocked",
        badge: "STOP",
        title: species === "dog" ? "PASEO NO RECOMENDADO" : "CALOR NO RECOMENDADO",
        detail:
          species === "dog"
            ? `Hoy hace ${weather.temperatureC} C. Para ${breed}, salir ahora cruza el limite de ${thermalProfile.avoidExerciseAboveC} C.`
            : `Hoy hace ${weather.temperatureC} C${humidityPenalty ? " con humedad alta" : ""}. Para ${activePet.name}, mejor interior fresco y nada de calor sostenido.`,
        helper:
          species === "dog"
            ? `Mejor esperar hasta las ${replacementTime} y hacer una actividad tranquila en casa.`
            : "Agua fresca, ventilacion y un lugar fresco dentro de casa.",
        primaryLabel: "Ver tratamientos",
        primaryAction: "medications",
        secondaryLabel: "Ver turnos",
        secondaryAction: "appointments",
        toneClassName: "border-red-300 bg-red-50 text-red-950 dark:border-red-500/40 dark:bg-red-950/30 dark:text-red-100",
        icon: "thermostat",
      };
    }

    if (weather.temperatureC >= cautionThreshold) {
      return {
        status: "caution",
        badge: "Precaucion",
        title: species === "dog" ? "Paseo corto y con cuidado" : "Cuidado con el calor",
        detail:
          species === "dog"
            ? `Hace ${weather.temperatureC} C. Si salis con ${activePet.name}, que sea corto, con agua y buscando sombra.`
            : `Hace ${weather.temperatureC} C. Conviene vigilar a ${activePet.name} y evitar calor sostenido.`,
        helper: serviceSummary.detail,
        primaryLabel: "Ver turnos",
        primaryAction: "appointments",
        secondaryLabel: "Ver tratamientos",
        secondaryAction: "medications",
        toneClassName: "border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-500/40 dark:bg-amber-950/20 dark:text-amber-100",
        icon: "warning",
      };
    }

    return {
      status: "safe",
      badge: "Seguro",
      title: species === "dog" ? `Dia ideal para salir con ${activePet.name}` : `Clima tranquilo para ${activePet.name}`,
      detail:
        species === "dog"
          ? `Hace ${weather.temperatureC} C ahora. No veo riesgo termico para ${breed}.`
          : `Hace ${weather.temperatureC} C ahora. El ambiente se ve tranquilo para hoy.`,
      helper: serviceSummary.detail,
      primaryLabel: "Ver turnos",
      primaryAction: "appointments",
      secondaryLabel: "Ver tratamientos",
      secondaryAction: "medications",
      toneClassName: "border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-500/40 dark:bg-emerald-950/20 dark:text-emerald-100",
      icon: "check_circle",
    };
  })();

  const supplySummary = (() => {
    if (!activePet) {
      return {
        title: "Suministros",
        detail: "Cuando elijas cómo come, Pessy te ayuda a ordenar compras y recordatorios.",
      };
    }

    if (!dietPreference) {
      return {
        title: `¿Cómo viene ${activePet.name} de comida?`,
        detail: "Elegí una opción y desde acá organizamos compras, stock y reabastecimiento.",
      };
    }

    const labels: Record<DietPreference, string> = {
      balanced: "balanceado",
      barf: "BARF",
      mixed: "mixto",
    };

    return {
      title: `${activePet.name} viene con ${labels[dietPreference]}`,
      detail: "Cuando toque reponer o aparezcan ofertas útiles, lo vas a ver acá.",
    };
  })();

  const handleDragEnd = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    setIsDragging(false);

    const threshold = 100;
    const velocity = info.velocity.x;

    if (info.offset.x < -threshold || velocity < -500) {
      const nextIndex = (safeCurrentIndex + 1) % pets.length;
      onPetChange(pets[nextIndex].id);
      return;
    }

    if (info.offset.x > threshold || velocity > 500) {
      const prevIndex = safeCurrentIndex === 0 ? pets.length - 1 : safeCurrentIndex - 1;
      onPetChange(pets[prevIndex].id);
    }
  };

  const handleTap = (event: MouseEvent | TouchEvent | PointerEvent) => {
    const target = event.target as HTMLElement | null;
    if (!isDragging && !target?.closest("button")) {
      onProfileClick();
    }
  };

  const handleServicePrimaryAction = () => {
    if (walkSafety.primaryAction === "profile") {
      onProfileClick();
      return;
    }

    if (walkSafety.primaryAction === "medications") {
      onMedicationsClick();
      return;
    }

    onAppointmentsClick();
  };

  const handleServiceSecondaryAction = () => {
    if (walkSafety.secondaryAction === "history") {
      onViewHistory();
      return;
    }

    if (walkSafety.secondaryAction === "profile") {
      onProfileClick();
      return;
    }

    if (walkSafety.secondaryAction === "medications") {
      onMedicationsClick();
      return;
    }

    onAppointmentsClick();
  };

  if (!activePet) return null;

  return (
    <div className="px-4 pt-8 pb-8 space-y-5">
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
        className="space-y-2"
      >
        <p className="text-[11px] font-black uppercase tracking-[0.24em] text-[#074738]">
          Pessy
        </p>
        <h1 className="text-3xl font-black text-slate-900 dark:text-white leading-tight">
          Todo en orden con {activePet.name}
        </h1>
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
          Identidad, servicios y sus cosas en un solo lugar.
        </p>
      </motion.div>

      <motion.div
        key={activePetId}
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.45, delay: 0.05 }}
        className="space-y-3"
      >
        <motion.div
          drag={hasMultiplePets ? "x" : false}
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.16}
          onDragStart={() => setIsDragging(true)}
          onDragEnd={handleDragEnd}
          onTap={handleTap}
          className="overflow-hidden rounded-[28px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-[0_20px_60px_-20px_rgba(15,23,42,0.28)]"
        >
          <div className="relative h-64 bg-gradient-to-br from-[#d5efe8] via-[#eef7f4] to-white dark:from-slate-800 dark:via-slate-900 dark:to-slate-950">
            <PetPhoto
              src={activePet.photo}
              alt={activePet.name}
              className="h-full w-full object-cover"
              fallbackClassName="rounded-none"
            />
            <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-white dark:from-slate-900 to-transparent" />
            <div className="absolute right-4 top-4 rounded-full bg-[#074738] px-4 py-2 text-[11px] font-black uppercase tracking-wide text-white shadow-lg">
              Activo
            </div>
          </div>

          <div className="space-y-5 p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-3xl font-black text-slate-900 dark:text-white">
                  {activePet.name}
                </h2>
                <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">
                  {[activePet.age, activePet.breed].filter(Boolean).join(" · ") || "Su perfil ya está en marcha"}
                </p>
              </div>
              <div className="flex size-12 items-center justify-center rounded-full bg-[#074738]/10 text-[#074738]">
                <MaterialIcon name="pets" className="text-2xl" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-800/80">
                <p className="text-[11px] font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Identidad
                </p>
                <p className="mt-2 text-2xl font-black text-slate-900 dark:text-white">
                  {identityProgress}%
                </p>
                <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                  {identityReadyCount} de {identityItems.length} cosas listas
                </p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-800/80">
                <p className="text-[11px] font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Servicios
                </p>
                <p className="mt-2 text-2xl font-black text-slate-900 dark:text-white">
                  {servicesCount}
                </p>
                <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                  {servicesCount === 0 ? "Nada próximo" : "Cosas activas o agendadas"}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={(event) => {
                  event.stopPropagation();
                  onProfileClick();
                }}
                className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-900 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-white dark:hover:bg-slate-800"
              >
                Ver perfil
              </button>
              <button
                onClick={(event) => {
                  event.stopPropagation();
                  onViewHistory();
                }}
                className="rounded-2xl bg-[#074738] px-4 py-3 text-sm font-bold text-white shadow-lg shadow-[#074738]/25 transition-colors hover:bg-[#0c5d4a]"
              >
                Actividad
              </button>
            </div>
          </div>
        </motion.div>

        {hasMultiplePets && (
          <div className="rounded-2xl border border-slate-200 bg-white/90 px-3 py-3 dark:border-slate-800 dark:bg-slate-900/90">
            <div className="flex items-center justify-between px-1">
              <p className="text-[11px] font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Mascota {safeCurrentIndex + 1} de {pets.length}
              </p>
              <button
                onClick={onPetClick}
                className="text-[11px] font-bold text-[#074738] hover:underline"
              >
                Ver todas
              </button>
            </div>
            <div className="mt-3 flex items-center gap-2 overflow-x-auto pb-1">
              {pets.map((pet) => (
                <button
                  key={pet.id}
                  onClick={() => onPetChange(pet.id)}
                  className={`shrink-0 rounded-full px-3 py-2 text-xs font-bold transition-colors ${
                    pet.id === activePetId
                      ? "bg-[#074738] text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                  }`}
                >
                  {pet.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </motion.div>

      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.1 }}
        className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#074738]">
              Identidad
            </p>
            <h3 className="mt-2 text-2xl font-black text-slate-900 dark:text-white">
              Identidad al {identityProgress}%
            </h3>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Perfil, peso, foto y papeles organizados en un solo lugar.
            </p>
          </div>
          <div className="flex size-12 items-center justify-center rounded-full bg-[#074738]/10 text-[#074738]">
            <MaterialIcon name="badge" className="text-2xl" />
          </div>
        </div>

        <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
          <div
            className="h-full rounded-full bg-[#074738] transition-all"
            style={{ width: `${identityProgress}%` }}
          />
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {identityItems.map((item) => (
            <div
              key={item.label}
              className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-bold ${
                item.ready
                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300"
                  : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300"
              }`}
            >
              <MaterialIcon name={item.ready ? "check_circle" : "radio_button_unchecked"} className="text-sm" />
              {item.label}
            </div>
          ))}
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <button
            onClick={onProfileClick}
            className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-900 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-white dark:hover:bg-slate-800"
          >
            Ver perfil
          </button>
          <button
            onClick={onViewHistory}
            className="rounded-2xl bg-slate-100 px-4 py-3 text-sm font-bold text-slate-900 transition-colors hover:bg-slate-200 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700"
          >
            Actividad
          </button>
        </div>
      </motion.section>

      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.16 }}
        className={`rounded-[26px] border p-5 shadow-sm ${walkSafety.toneClassName}`}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-current/70">
              Servicios
            </p>
            <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-white/70 px-3 py-1 text-[11px] font-black uppercase tracking-wide text-current dark:bg-black/10">
              <MaterialIcon name={walkSafety.icon} className="text-sm" />
              {walkSafety.badge}
            </div>
            <h3 className="mt-3 text-2xl font-black text-current">
              {walkSafety.title}
            </h3>
            <p className="mt-1 text-sm text-current/80">
              {walkSafety.detail}
            </p>
            <p className="mt-3 text-sm font-semibold text-current/75">
              {walkSafety.helper}
            </p>
          </div>
          <div className="flex size-12 items-center justify-center rounded-full bg-white/70 text-current dark:bg-black/10">
            <MaterialIcon name={walkSafety.icon} className="text-2xl" />
          </div>
        </div>

        {weather.status === "ready" && weather.temperatureC !== null && (
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-white/70 px-3 py-1 text-xs font-bold text-current dark:bg-black/10">
              <MaterialIcon name="thermostat" className="text-sm" />
              {weather.temperatureC} C
            </span>
            {weather.humidityPct !== null && (
              <span className="inline-flex items-center gap-1 rounded-full bg-white/70 px-3 py-1 text-xs font-bold text-current dark:bg-black/10">
                <MaterialIcon name="water_drop" className="text-sm" />
                {weather.humidityPct}% humedad
              </span>
            )}
          </div>
        )}

        <div className="mt-5 grid grid-cols-2 gap-3">
          <button
            onClick={handleServicePrimaryAction}
            className="rounded-2xl bg-[#074738] px-4 py-3 text-sm font-bold text-white shadow-lg shadow-[#074738]/25 transition-colors hover:bg-[#0c5d4a]"
          >
            {walkSafety.primaryLabel}
          </button>
          <button
            onClick={handleServiceSecondaryAction}
            className="rounded-2xl border border-current/15 bg-white/60 px-4 py-3 text-sm font-bold text-current transition-colors hover:bg-white/80 dark:bg-black/5 dark:hover:bg-black/10"
          >
            {walkSafety.secondaryLabel}
          </button>
        </div>
      </motion.section>

      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.22 }}
        className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#074738]">
              Suministros
            </p>
            <h3 className="mt-2 text-2xl font-black text-slate-900 dark:text-white">
              {supplySummary.title}
            </h3>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {supplySummary.detail}
            </p>
          </div>
          <div className="flex size-12 items-center justify-center rounded-full bg-[#074738]/10 text-[#074738]">
            <MaterialIcon name="inventory_2" className="text-2xl" />
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-3">
          {DIET_OPTIONS.map((option) => {
            const selected = dietPreference === option.value;
            return (
              <button
                key={option.value}
                onClick={() => saveDietPreference(option.value)}
                className={`rounded-2xl px-4 py-3 text-sm font-bold transition-colors ${
                  selected
                    ? "bg-[#074738] text-white shadow-lg shadow-[#074738]/25"
                    : "border border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>

        <div className="mt-4 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:bg-slate-800/80 dark:text-slate-300">
          Esto arranca simple: qué come, cómo viene y cuándo conviene reponer.
        </div>
      </motion.section>
    </div>
  );
}
