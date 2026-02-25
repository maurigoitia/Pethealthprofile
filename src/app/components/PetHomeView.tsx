import { MaterialIcon } from "./MaterialIcon";
import { motion, PanInfo } from "motion/react";
import { useState } from "react";

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

  const currentIndex = pets.findIndex(p => p.id === activePetId);
  const activePet = pets[currentIndex];
  const hasMultiplePets = pets.length > 1;

  // Real data logic for active pet
  const petData = {
    age: activePet?.age || "Edad no registrada",
    isActive: true,
    lastVaccineDate: "Ver en historial", // Future: calculate from medical records
    weight: activePet?.weight || "Sin peso",
  };

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
          ¡Hola, {userName}!
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
            <img
              src={activePet.photo}
              alt={activePet.name}
              className="w-full h-full object-cover"
            />

            {/* Status Badge */}
            {petData.isActive && (
              <div className="absolute top-4 right-4">
                <div className="bg-[#2b6fee] text-white px-4 py-2 rounded-full text-xs font-black uppercase tracking-wide shadow-lg backdrop-blur-sm">
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
              <div className="size-12 rounded-full bg-[#2b6fee]/10 flex items-center justify-center">
                <MaterialIcon name="ecg_heart" className="text-[#2b6fee] text-2xl" />
              </div>
            </div>

            {/* Quick Stats Row */}
            <div className="grid grid-cols-2 gap-3 mb-5">
              {/* Vaccine Stat */}
              <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3">
                <div className="flex items-center gap-2 mb-1">
                  <MaterialIcon name="vaccines" className="text-[#2b6fee] text-lg" />
                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                    Vacuna
                  </span>
                </div>
                <p className="text-lg font-black text-slate-900 dark:text-white">
                  {petData.lastVaccineDate}
                </p>
              </div>

              {/* Weight Stat */}
              <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3">
                <div className="flex items-center gap-2 mb-1">
                  <MaterialIcon name="monitor_weight" className="text-[#2b6fee] text-lg" />
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
              className="w-full py-4 rounded-2xl bg-[#2b6fee] text-white font-bold text-base hover:bg-[#5a8aff] transition-all shadow-lg shadow-[#2b6fee]/30 hover:shadow-xl hover:shadow-[#2b6fee]/40 active:scale-[0.98]"
            >
              Ver Historial Médico
            </button>
          </div>
        </motion.div>

        {/* Dots Indicator - Only if multiple pets */}
        {hasMultiplePets && (
          <div className="flex items-center justify-center gap-2 mt-4">
            {pets.map((pet, idx) => (
              <button
                key={pet.id}
                onClick={() => onPetChange(pet.id)}
                className={`h-2 rounded-full transition-all ${pet.id === activePetId
                  ? "w-8 bg-[#2b6fee]"
                  : "w-2 bg-slate-300 dark:bg-slate-700 hover:bg-slate-400"
                  }`}
              />
            ))}
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
              Citas
            </span>
          </div>
        </button>

        <button
          onClick={onMedicationsClick}
          className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shadow-sm active:scale-[0.98]"
        >
          <div className="flex flex-col items-center gap-2">
            <div className="size-12 rounded-full bg-purple-500/10 flex items-center justify-center">
              <MaterialIcon name="medication" className="text-purple-500 text-2xl" />
            </div>
            <span className="text-sm font-bold text-slate-900 dark:text-white">
              Medicamentos
            </span>
          </div>
        </button>
      </motion.div>
    </div>
  );
}