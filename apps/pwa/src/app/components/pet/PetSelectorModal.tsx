
import { MaterialIcon } from "../shared/MaterialIcon";
import { useAuth } from "../../contexts/AuthContext";
import { PetPhoto } from "./PetPhoto";

interface Pet {
  id: string;
  name: string;
  breed: string;
  photo: string;
  ownerId?: string;
}

interface PetSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  pets: Pet[];
  activePetId: string;
  onPetChange: (petId: string) => void;
  onViewProfile: () => void;
  onAddNewPet: () => void;
}

export function PetSelectorModal({
  isOpen,
  onClose,
  pets,
  activePetId,
  onPetChange,
  onViewProfile,
  onAddNewPet,
}: PetSelectorModalProps) {
  const hasMultiplePets = pets.length > 1;
  const activePet = pets.find((p) => p.id === activePetId);
  const { user } = useAuth();

  const handlePetSelect = (petId: string) => {
    if (petId !== activePetId) {
      onPetChange(petId);
      // Slight delay before closing so user sees the change
      setTimeout(() => {
        onClose();
      }, 300);
    }
  };

  if (!isOpen) return null;

  return (
        <>
          {/* Backdrop */}
          <div
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 animate-fadeIn"
          />

          {/* Modal */}
          <div



            className="fixed inset-x-0 bottom-0 z-50 bg-white dark:bg-slate-900 rounded-t-3xl shadow-2xl max-w-md mx-auto"
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-12 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full" />
            </div>

            {/* Content */}
            <div className="px-6 pb-8 pt-4">
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-black text-slate-900 dark:text-white">
                  {hasMultiplePets ? "Tus Mascotas" : "Mi Mascota"}
                </h2>
                <button
                  onClick={onClose}
                  className="size-9 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                >
                  <MaterialIcon name="close" className="text-lg" />
                </button>
              </div>

              {/* Pets List - Vertical for better UX */}
              {hasMultiplePets && (
                <div className="space-y-3 mb-6">
                  {pets.map((pet) => {
                    const isActive = pet.id === activePetId;
                    return (
                      <button
                        key={pet.id}
                        onClick={() => handlePetSelect(pet.id)}
                                                className={`w-full p-4 rounded-2xl flex items-center gap-4 transition-all ${
                          isActive
                            ? "bg-[#074738] shadow-lg shadow-[#074738]/30"
                            : "bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-750 border border-slate-200 dark:border-slate-700"
                        }`}
                      >
                        {/* Pet Photo */}
                        <div className={`relative ${isActive ? "scale-105" : ""}`}>
                          <div className="size-16 rounded-xl overflow-hidden ring-2 ring-offset-2 ring-offset-white dark:ring-offset-slate-900 ${isActive ? 'ring-white' : 'ring-transparent'}">
                            <PetPhoto
                              src={pet.photo}
                              alt={pet.name}
                              className="size-full object-cover"
                              fallbackClassName="rounded-xl"
                            />
                          </div>
                          {isActive && (
                            <div className="absolute -bottom-1 -right-1 size-6 rounded-full bg-white flex items-center justify-center shadow-md">
                              <MaterialIcon
                                name="check_circle"
                                className="text-[#074738] text-xl fill-current"
                              />
                            </div>
                          )}
                        </div>

                        {/* Pet Info */}
                        <div className="flex-1 text-left">
                          <div className="flex items-center gap-2 mb-0.5">
                            <p className={`font-black text-base ${isActive ? "text-white" : "text-slate-900 dark:text-white"}`}>
                              {pet.name}
                            </p>
                            {pet.ownerId !== user?.uid && (
                              <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${isActive ? "bg-white/20 text-white" : "bg-emerald-100 text-emerald-600"}`}>
                                CO-TUTOR
                              </span>
                            )}
                          </div>
                          <p className={`text-sm ${isActive ? "text-white/80" : "text-slate-500 dark:text-slate-400"}`}>
                            {pet.breed}
                          </p>
                        </div>

                        {/* Indicator */}
                        {isActive ? (
                          <div className="px-3 py-1.5 rounded-full bg-white/20 backdrop-blur-sm">
                            <span className="text-xs font-bold text-white">
                              ACTIVA
                            </span>
                          </div>
                        ) : (
                          <MaterialIcon
                            name="chevron_right"
                            className="text-slate-400 text-xl"
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Single Pet Display */}
              {!hasMultiplePets && activePet && (
                <div className="mb-6 p-5 rounded-2xl bg-gradient-to-br from-[#074738]/10 to-emerald-500/10 border border-[#074738]/20">
                  <div className="flex items-center gap-4">
                    <div className="size-20 rounded-2xl overflow-hidden ring-4 ring-[#074738]/20">
                      <PetPhoto
                        src={activePet.photo}
                        alt={activePet.name}
                        className="size-full object-cover"
                        fallbackClassName="rounded-2xl"
                      />
                    </div>
                    <div className="flex-1">
                      <p className="text-lg font-black text-slate-900 dark:text-white mb-1">
                        {activePet.name}
                      </p>
                      <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                        {activePet.breed}
                      </p>
                      <div className="flex items-center gap-2 bg-[#074738] text-white px-3 py-1 rounded-full w-fit">
                        <MaterialIcon name="check_circle" className="text-sm fill-current" />
                        <span className="text-xs font-bold">TU MASCOTA</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Divider */}
              <div className="h-px bg-slate-200 dark:bg-slate-800 my-6" />

              {/* Action Buttons */}
              <div className="space-y-3">
                {/* View Profile */}
                <button
                  onClick={() => {
                    onViewProfile();
                    onClose();
                  }}
                  className="w-full p-4 rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-750 transition-all flex items-center gap-3 border border-slate-200 dark:border-slate-700"
                >
                  <div className="size-11 rounded-xl bg-[#074738]/10 flex items-center justify-center">
                    <MaterialIcon
                      name="info"
                      className="text-[#074738] text-xl"
                    />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="font-black text-sm text-slate-900 dark:text-white">
                      Ver Perfil de {activePet?.name}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Información y carnet de vacunación
                    </p>
                  </div>
                  <MaterialIcon
                    name="chevron_right"
                    className="text-slate-400 text-xl"
                  />
                </button>

                {/* Add New Pet */}
                <button
                  onClick={() => {
                    onAddNewPet();
                    onClose();
                  }}
                  className="w-full p-4 rounded-xl bg-[#074738] text-white hover:bg-[#1a9b7d] transition-all flex items-center gap-3 shadow-lg shadow-[#074738]/30"
                >
                  <div className="size-11 rounded-xl bg-white/20 flex items-center justify-center">
                    <MaterialIcon name="add" className="text-white text-xl" />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="font-black text-sm text-white">
                      Agregar Nueva Mascota
                    </p>
                    <p className="text-xs text-white/80">
                      Registra otra mascota en tu cuenta
                    </p>
                  </div>
                  <MaterialIcon
                    name="chevron_right"
                    className="text-white/80 text-xl"
                  />
                </button>
              </div>
            </div>
          </div>
        </>
  );
}
