import { MaterialIcon } from "./MaterialIcon";
import { motion, PanInfo } from "motion/react";
import { useEffect, useState } from "react";
import { useMedical } from "../contexts/MedicalContext";
import { formatDateSafe, toTimestampSafe } from "../utils/dateUtils";
import { PetPhoto } from "./PetPhoto";
import { isHomeDoseCardsEnabled } from "../utils/runtimeFlags";

interface PetHomeViewProps {
  userName: string;
  onViewHistory: () => void;
  onPetClick: () => void;
  onAppointmentsClick: () => void;
  onMedicationsClick: () => void;
  pets: Array<{
    id: string;
    name: string;
    breed: string;
    photo: string;
    age?: string;
    weight?: string;
  }>;
  activePetId: string;
  onPetChange: (petId: string) => void;
}

export function PetHomeView({
  userName,
  onViewHistory,
  onPetClick,
  onAppointmentsClick,
  onMedicationsClick,
  pets,
  activePetId,
  onPetChange
}: PetHomeViewProps) {
  const [isDragging, setIsDragging] = useState(false);
  const { getEventsByPetId, getActiveMedicationsByPetId } = useMedical();
  const safeUserName = (userName || "").trim() || "Tutor";
  const homeDoseCardsEnabled = isHomeDoseCardsEnabled();

  const currentIndex = pets.findIndex(p => p.id === activePetId);
  const safeCurrentIndex = currentIndex >= 0 ? currentIndex : 0;
  const activePet = pets[safeCurrentIndex];
  const hasMultiplePets = pets.length > 1;

  // Calcular estado real de vacunas
  const petEvents = activePetId ? getEventsByPetId(activePetId) : [];
  const vaccineEvents = petEvents
    .filter((e) => e.extractedData.documentType === "vaccine" && e.status === "completed")
    .sort(
      (a, b) =>
        toTimestampSafe(b.extractedData.eventDate || b.createdAt) -
        toTimestampSafe(a.extractedData.eventDate || a.createdAt)
    );

  const lastVaccine = vaccineEvents[0];
  const lastVaccineDate = lastVaccine
    ? formatDateSafe(
        lastVaccine.extractedData.eventDate || lastVaccine.createdAt,
        "es-AR",
        { day: "numeric", month: "short", year: "numeric" },
        "Sin registro"
      )
    : "Sin registro";

  // Calcular si hay vacunas vencidas o próximas
  const vaccineStatusLabel = (() => {
    if (vaccineEvents.length === 0) return { text: "Sin registro", color: "text-slate-500" };
    const now = Date.now();
    let hasOverdue = false;
    let hasSoon = false;
    for (const e of vaccineEvents) {
      if (!e.extractedData.nextAppointmentDate) continue;
      const diff = (toTimestampSafe(e.extractedData.nextAppointmentDate, now) - now) / 86400000;
      if (diff < 0) hasOverdue = true;
      else if (diff < 30) hasSoon = true;
    }
    if (hasOverdue) return { text: "¡Vencida!", color: "text-red-500" };
    if (hasSoon) return { text: "Próxima", color: "text-amber-500" };
    return { text: lastVaccineDate, color: "text-slate-900 dark:text-white" };
  })();

  const petData = {
    age: activePet?.age || "Edad no registrada",
    isActive: true,
    lastVaccineDate,
    vaccineStatusLabel,
    weight: activePet?.weight ? `${activePet.weight} kg` : "Sin peso",
  };

  const parseFrequencyHours = (value: string | null | undefined): number | null => {
    if (!value) return null;
    const text = value.toLowerCase().replace(",", ".");
    const compact = text.replace(/\s+/g, "");

    const compactHoursMatch = compact.match(/c\/(\d+(?:\.\d+)?)h/);
    if (compactHoursMatch) {
      const num = Number(compactHoursMatch[1]);
      return Number.isFinite(num) && num > 0 ? num : null;
    }

    const compactDaysMatch = compact.match(/c\/(\d+(?:\.\d+)?)d/);
    if (compactDaysMatch) {
      const num = Number(compactDaysMatch[1]);
      return Number.isFinite(num) && num > 0 ? num * 24 : null;
    }

    const everyMatch = text.match(/cada\s+(\d+(?:\.\d+)?)\s*h/);
    if (everyMatch) {
      const num = Number(everyMatch[1]);
      return Number.isFinite(num) && num > 0 ? num : null;
    }

    const everyDaysMatch = text.match(/cada\s+(\d+(?:\.\d+)?)\s*d[ií]a/);
    if (everyDaysMatch) {
      const num = Number(everyDaysMatch[1]);
      return Number.isFinite(num) && num > 0 ? num * 24 : null;
    }

    const dailyMatch = text.match(/(\d+)\s*vez(?:es)?\s*al\s*d[ií]a/);
    if (dailyMatch) {
      const times = Number(dailyMatch[1]);
      if (Number.isFinite(times) && times > 0) return Math.round(24 / times);
    }
    if (/diario|diaria|cada\s+24\s*h/.test(text)) return 24;
    return null;
  };

  const getNextDoseTime = (startDate: string, frequencyHours: number | null): Date | null => {
    if (!frequencyHours || frequencyHours <= 0) return null;
    let nextTs = toTimestampSafe(startDate, Date.now());
    if (!Number.isFinite(nextTs)) return null;
    const step = Math.round(frequencyHours * 60 * 60 * 1000);
    const now = Date.now();
    let guard = 0;
    while (nextTs <= now && guard < 2000) {
      nextTs += step;
      guard += 1;
    }
    return new Date(nextTs);
  };

  const todayDateKey = new Date().toISOString().slice(0, 10);
  const storagePrefix = activePetId ? `pessy_treatment_taken_${activePetId}_${todayDateKey}_` : "pessy_treatment_taken_";

  const [takenMap, setTakenMap] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (typeof window === "undefined") return;
    const map: Record<string, boolean> = {};
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(storagePrefix)) continue;
      map[key.replace(storagePrefix, "")] = localStorage.getItem(key) === "1";
    }
    setTakenMap(map);
  }, [storagePrefix]);

  const toggleTaken = (medicationId: string) => {
    const key = `${storagePrefix}${medicationId}`;
    setTakenMap((prev) => {
      const nextState = !prev[medicationId];
      if (nextState) localStorage.setItem(key, "1");
      else localStorage.removeItem(key);
      return { ...prev, [medicationId]: nextState };
    });
  };

  const upcomingTreatments = homeDoseCardsEnabled && activePetId
    ? getActiveMedicationsByPetId(activePetId)
        .slice(0, 6)
        .map((med) => ({
          id: med.id,
          name: med.name,
          dosage: med.dosage || "",
          startDate: med.startDate,
          frequency: (med.frequency || "")
            .replace(/cada\s+/i, "c/")
            .replace(/\s+horas?/i, "h")
            .trim(),
          rawFrequency: med.frequency || null,
        }))
    : [];

  const handleDragEnd = (event: any, info: PanInfo) => {
    setIsDragging(false);

    const threshold = 100; // Minimum swipe distance
    const velocity = info.velocity.x;

    // Swipe left -> next pet
    if (info.offset.x < -threshold || velocity < -500) {
      const nextIndex = (currentIndex + 1) % pets.length;
      onPetChange(pets[nextIndex].id);
    }
    // Swipe right -> previous pet
    else if (info.offset.x > threshold || velocity > 500) {
      const prevIndex = currentIndex === 0 ? pets.length - 1 : currentIndex - 1;
      onPetChange(pets[prevIndex].id);
    }
  };

  const handleTap = (event: any) => {
    // Don't trigger onPetClick if clicking on a button or interactive element
    if (!isDragging && !event.target.closest('button')) {
      onPetClick();
    }
  };

  return (
    <div className="px-4 pt-8 pb-6">
      {/* Greeting Section */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mb-6"
      >
        <h1 className="text-3xl font-black text-slate-900 dark:text-white mb-2">
          ¡Hola, {safeUserName}!
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
          Tu mejor amigo está en buenas manos.
        </p>
      </motion.div>

      {/* Pet Card - Main Feature with Swipe */}
      <motion.div
        key={activePetId}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="relative"
      >
        <motion.div
          drag={hasMultiplePets ? "x" : false}
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.2}
          onDragStart={() => setIsDragging(true)}
          onDragEnd={handleDragEnd}
          onTap={handleTap}
          className="bg-white dark:bg-slate-900 rounded-3xl overflow-hidden shadow-2xl shadow-slate-300/50 dark:shadow-slate-950/50 border border-slate-200 dark:border-slate-800 cursor-pointer"
        >
          {/* Pet Photo Section */}
          <div className="relative h-72 bg-gradient-to-b from-slate-100 to-slate-50 dark:from-slate-800 dark:to-slate-900">
            <PetPhoto
              src={activePet.photo}
              alt={activePet.name}
              className="w-full h-full object-cover"
              fallbackClassName="rounded-none"
            />

            {/* Status Badge */}
            {petData.isActive && (
              <div className="absolute top-4 right-4">
                <div className="bg-[#074738] text-white px-4 py-2 rounded-full text-xs font-black uppercase tracking-wide shadow-lg backdrop-blur-sm">
                  ACTIVO
                </div>
              </div>
            )}

            {/* Gradient Overlay at bottom */}
            <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-white dark:from-slate-900 to-transparent" />
          </div>

          {/* Pet Info Section */}
          <div className="p-6">
            {/* Name and Icon */}
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-3xl font-black text-slate-900 dark:text-white mb-1">
                  {activePet.name}
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
                  {petData.age} • {activePet.breed}
                </p>
              </div>
              <div className="size-12 rounded-full bg-[#074738]/10 flex items-center justify-center">
                <MaterialIcon name="ecg_heart" className="text-[#074738] text-2xl" />
              </div>
            </div>

            {/* Quick Stats Row */}
            <div className="grid grid-cols-2 gap-3 mb-5">
              {/* Vaccine Stat */}
              <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3">
                <div className="flex items-center gap-2 mb-1">
                  <MaterialIcon name="vaccines" className="text-[#074738] text-lg" />
                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                    Vacuna
                  </span>
                </div>
                <p className={`text-lg font-black ${petData.vaccineStatusLabel.color}`}>
                  {petData.vaccineStatusLabel.text}
                </p>
              </div>

              {/* Weight Stat */}
              <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3">
                <div className="flex items-center gap-2 mb-1">
                  <MaterialIcon name="monitor_weight" className="text-[#074738] text-lg" />
                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                    Peso
                  </span>
                </div>
                <p className="text-lg font-black text-slate-900 dark:text-white">
                  {petData.weight}
                </p>
              </div>
            </div>

            {/* Action Button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onViewHistory();
              }}
              className="w-full py-4 rounded-2xl bg-[#074738] text-white font-bold text-base hover:bg-[#1a9b7d] transition-all shadow-lg shadow-[#074738]/30 hover:shadow-xl hover:shadow-[#074738]/40 active:scale-[0.98]"
            >
              Ver Historial Médico
            </button>
          </div>
        </motion.div>

        {/* Selector inferior (elegante) - Only if multiple pets */}
        {hasMultiplePets && (
          <div className="mt-4 bg-white/80 dark:bg-slate-900/80 rounded-2xl border border-slate-200 dark:border-slate-800 px-3 py-2.5">
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
            <div className="flex items-center justify-center gap-2.5 mt-2">
              {pets.map((pet) => (
                <button
                  key={pet.id}
                  onClick={() => onPetChange(pet.id)}
                  aria-label={`Cambiar a ${pet.name}`}
                  title={pet.name}
                  className={`h-2.5 rounded-full transition-all ${
                    pet.id === activePetId
                      ? "w-8 bg-[#074738]"
                      : "w-2.5 bg-slate-300 dark:bg-slate-600 hover:bg-slate-400 dark:hover:bg-slate-500"
                  }`}
                />
              ))}
            </div>
          </div>
        )}
      </motion.div>

      {/* Additional Quick Actions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="grid grid-cols-2 gap-3 mt-6"
      >
        <button
          onClick={onAppointmentsClick}
          className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shadow-sm active:scale-[0.98]"
        >
          <div className="flex flex-col items-center gap-2">
            <div className="size-12 rounded-full bg-emerald-500/10 flex items-center justify-center">
              <MaterialIcon name="event" className="text-emerald-500 text-2xl" />
            </div>
            <span className="text-sm font-bold text-slate-900 dark:text-white">
              Turnos
            </span>
          </div>
        </button>

        <button
          onClick={onMedicationsClick}
          className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shadow-sm active:scale-[0.98]"
        >
          <div className="flex flex-col items-center gap-2">
            <div className="size-12 rounded-full bg-emerald-500/10 flex items-center justify-center">
              <MaterialIcon name="medication" className="text-emerald-500 text-2xl" />
            </div>
            <span className="text-sm font-bold text-slate-900 dark:text-white">
              Tratamientos
            </span>
          </div>
        </button>
      </motion.div>

      {homeDoseCardsEnabled && upcomingTreatments.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.25 }}
          className="mt-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-3"
        >
          <div className="flex items-center justify-between mb-2">
            <p className="text-[11px] font-black uppercase tracking-wide text-slate-500">
              Próximas tomas
            </p>
            <button
              onClick={onMedicationsClick}
              className="text-[11px] font-bold text-[#074738] hover:underline"
            >
              Ver tratamientos
            </button>
          </div>

          <div className="flex gap-2 overflow-x-auto no-scrollbar snap-x snap-mandatory pb-1">
            {upcomingTreatments.map((treatment) => (
              <div
                key={treatment.id}
                className={`snap-start shrink-0 w-[180px] rounded-2xl border p-2.5 transition-all ${
                  takenMap[treatment.id]
                    ? "border-emerald-200 bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-900/20"
                    : "border-[#074738]/20 bg-[#074738]/5 dark:border-[#074738]/40 dark:bg-[#074738]/10"
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                    takenMap[treatment.id]
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                      : "bg-white/90 text-[#074738] dark:bg-slate-900 dark:text-[#1a9b7d]"
                  }`}>
                    {(() => {
                      const hours = parseFrequencyHours(treatment.rawFrequency);
                      const nextDose = getNextDoseTime(treatment.startDate, hours);
                      if (!nextDose) return "según receta";
                      return `hoy ${nextDose.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}`;
                    })()}
                  </span>
                  <button
                    onClick={() => toggleTaken(treatment.id)}
                    className={`size-7 rounded-full flex items-center justify-center border transition-colors ${
                      takenMap[treatment.id]
                        ? "border-emerald-300 bg-emerald-500 text-white"
                        : "border-slate-200 bg-white text-slate-400"
                    }`}
                    title={takenMap[treatment.id] ? "Marcar pendiente" : "Marcar tomada"}
                  >
                    <MaterialIcon name="check" className="text-sm" />
                  </button>
                </div>

                <p className="text-xs font-black text-slate-900 dark:text-white leading-tight line-clamp-2">
                  {treatment.name}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-1">
                  {treatment.dosage || "Dosis según receta"}
                </p>
                <p className="text-[10px] font-semibold text-[#074738] dark:text-[#1a9b7d] mt-1">
                  {treatment.frequency || "Frecuencia no especificada"}
                </p>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}
