import { motion, AnimatePresence } from "motion/react";
import { MaterialIcon } from "./MaterialIcon";
import { useState } from "react";
import { VaccinationCardModal } from "./VaccinationCardModal";
import { usePet } from "../contexts/PetContext";

interface PetProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type ViewMode = "profile" | "edit" | "vaccination";

interface Vaccine {
  id: number;
  name: string;
  date: string;
  nextDue: string;
  veterinarian: string;
  status: "current" | "due-soon" | "overdue";
}

export function PetProfileModal({ isOpen, onClose }: PetProfileModalProps) {
  const [activeTab, setActiveTab] = useState<"info" | "vaccines">("info");
  const [isEditing, setIsEditing] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("profile");
  const [showVaccinationCard, setShowVaccinationCard] = useState(false);
  
  // Get active pet from context
  const { activePet } = usePet();

  // Mock data based on active pet
  const petProfileData = {
    "pet-1": {
      name: "Bruno",
      species: "Canino",
      breed: "Golden Retriever",
      age: "3 años",
      weight: "28.5 kg",
      birthDate: "15 Mar 2023",
      gender: "Macho",
      hasChip: true,
      microchip: "982000123456789",
      photo: "https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=400&h=400&fit=crop",
    },
    "pet-2": {
      name: "Rocky",
      species: "Canino",
      breed: "Bulldog Francés",
      age: "2 años",
      weight: "12.0 kg",
      birthDate: "22 Jul 2024",
      gender: "Macho",
      hasChip: true,
      microchip: "982000987654321",
      photo: "https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?w=400&h=400&fit=crop",
    },
  };

  const [petData, setPetData] = useState(petProfileData[activePet.id as keyof typeof petProfileData] || petProfileData["pet-1"]);

  const vaccines: Vaccine[] = [
    {
      id: 1,
      name: "Antirrábica",
      date: "23 Feb 2025",
      nextDue: "23 Feb 2027",
      veterinarian: "Dra. López - VetCenter",
      status: "current",
    },
    {
      id: 2,
      name: "Parvovirus + Moquillo (DHPPi)",
      date: "23 Feb 2025",
      nextDue: "23 Feb 2026",
      veterinarian: "Dra. López - VetCenter",
      status: "due-soon",
    },
    {
      id: 3,
      name: "Leptospirosis",
      date: "10 Ene 2025",
      nextDue: "10 Ene 2026",
      veterinarian: "Dr. Martínez - PetCare",
      status: "current",
    },
    {
      id: 4,
      name: "Tos de las perreras",
      date: "05 Ago 2024",
      nextDue: "05 Ago 2025",
      veterinarian: "Dr. Martínez - PetCare",
      status: "overdue",
    },
  ];

  const getStatusColor = (status: Vaccine["status"]) => {
    switch (status) {
      case "current":
        return "bg-emerald-500";
      case "due-soon":
        return "bg-amber-500";
      case "overdue":
        return "bg-red-500";
    }
  };

  const getStatusLabel = (status: Vaccine["status"]) => {
    switch (status) {
      case "current":
        return "Al día";
      case "due-soon":
        return "Próxima";
      case "overdue":
        return "Vencida";
    }
  };

  const handleSave = () => {
    setIsEditing(false);
    setViewMode("profile");
    // Aquí guardarías los cambios en la BD
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, y: "100%" }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed inset-x-0 bottom-0 z-50 bg-white dark:bg-slate-900 rounded-t-3xl shadow-2xl max-h-[92vh] overflow-hidden flex flex-col"
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-12 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full" />
            </div>

            {/* Header with Tabs */}
            <div className="px-6 pb-4 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-black text-slate-900 dark:text-white">
                  {viewMode === "profile" && "Perfil de Mascota"}
                  {viewMode === "edit" && "Editar Perfil"}
                  {viewMode === "vaccination" && "Carnet de Vacunación"}
                </h2>
                <button
                  onClick={onClose}
                  className="size-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                >
                  <MaterialIcon name="close" className="text-xl" />
                </button>
              </div>

              {/* Tab Navigation */}
              <div className="flex gap-2">
                <button
                  onClick={() => setViewMode("profile")}
                  className={`flex-1 py-2.5 px-4 rounded-lg font-bold text-sm transition-all ${
                    viewMode === "profile"
                      ? "bg-[#2b6fee] text-white shadow-lg shadow-[#2b6fee]/30"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                  }`}
                >
                  <MaterialIcon name="info" className="inline text-lg mr-1 align-text-bottom" />
                  Datos
                </button>
                <button
                  onClick={() => setViewMode("vaccination")}
                  className={`flex-1 py-2.5 px-4 rounded-lg font-bold text-sm transition-all ${
                    viewMode === "vaccination"
                      ? "bg-[#2b6fee] text-white shadow-lg shadow-[#2b6fee]/30"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                  }`}
                >
                  <MaterialIcon name="vaccines" className="inline text-lg mr-1 align-text-bottom" />
                  Vacunas
                </button>
              </div>
            </div>

            {/* Content - Scrollable */}
            <div className="flex-1 overflow-y-auto">
              {/* PROFILE VIEW */}
              {viewMode === "profile" && (
                <div className="p-6 space-y-6">
                  {/* Pet Photo */}
                  <div className="flex flex-col items-center">
                    <div className="relative mb-4">
                      <div className="size-32 rounded-3xl bg-gradient-to-br from-[#2b6fee] to-purple-500 p-1">
                        <div className="size-full rounded-[23px] overflow-hidden">
                          <img
                            src={petData.photo}
                            alt={petData.name}
                            className="size-full object-cover"
                          />
                        </div>
                      </div>
                      {!isEditing && (
                        <button className="absolute bottom-0 right-0 size-10 rounded-full bg-[#2b6fee] text-white flex items-center justify-center shadow-lg">
                          <MaterialIcon name="photo_camera" className="text-xl" />
                        </button>
                      )}
                    </div>
                    <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-1">
                      {petData.name}
                    </h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      {petData.breed}
                    </p>
                  </div>

                  {/* Quick Stats */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3 text-center">
                      <MaterialIcon name="cake" className="text-[#2b6fee] text-2xl mb-1" />
                      <p className="text-xs text-slate-500 dark:text-slate-400 mb-0.5">Edad</p>
                      <p className="text-sm font-bold text-slate-900 dark:text-white">
                        {petData.age}
                      </p>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3 text-center">
                      <MaterialIcon name="monitor_weight" className="text-[#2b6fee] text-2xl mb-1" />
                      <p className="text-xs text-slate-500 dark:text-slate-400 mb-0.5">Peso</p>
                      <p className="text-sm font-bold text-slate-900 dark:text-white">
                        {petData.weight}
                      </p>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3 text-center">
                      <MaterialIcon name="male" className="text-[#2b6fee] text-2xl mb-1" />
                      <p className="text-xs text-slate-500 dark:text-slate-400 mb-0.5">Sexo</p>
                      <p className="text-sm font-bold text-slate-900 dark:text-white">
                        {petData.gender}
                      </p>
                    </div>
                  </div>

                  {/* Detailed Info */}
                  <div className="space-y-3">
                    <h4 className="font-black text-sm text-slate-900 dark:text-white">
                      Información Detallada
                    </h4>
                    
                    {[
                      { label: "Especie", value: petData.species, icon: "pets" },
                      { label: "Raza", value: petData.breed, icon: "category" },
                      { label: "Fecha de nacimiento", value: petData.birthDate, icon: "event" },
                      { label: "Microchip", value: petData.microchip, icon: "memory" },
                    ].map((item, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between py-3 border-b border-slate-100 dark:border-slate-800 last:border-0"
                      >
                        <div className="flex items-center gap-3">
                          <MaterialIcon name={item.icon} className="text-[#2b6fee] text-xl" />
                          <span className="text-sm text-slate-500 dark:text-slate-400">
                            {item.label}
                          </span>
                        </div>
                        <span className="text-sm font-bold text-slate-900 dark:text-white">
                          {item.value}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Edit Button */}
                  <button
                    onClick={() => setIsEditing(true)}
                    className="w-full py-3 rounded-xl bg-[#2b6fee] text-white font-bold hover:bg-[#5a8aff] transition-colors shadow-lg shadow-[#2b6fee]/30 flex items-center justify-center gap-2"
                  >
                    <MaterialIcon name="edit" className="text-xl" />
                    Editar Perfil
                  </button>
                </div>
              )}

              {/* VACCINATION VIEW */}
              {viewMode === "vaccination" && (
                <div className="p-6 space-y-4">
                  {/* Header Info */}
                  <div className="bg-gradient-to-br from-[#2b6fee]/10 to-purple-100/50 dark:from-[#2b6fee]/20 dark:to-purple-950/30 rounded-xl p-4 border border-[#2b6fee]/20">
                    <div className="flex items-start gap-3">
                      <div className="size-12 rounded-xl bg-[#2b6fee] flex items-center justify-center shrink-0">
                        <MaterialIcon name="verified" className="text-white text-2xl" />
                      </div>
                      <div className="flex-1">
                        <h4 className="font-bold text-slate-900 dark:text-white mb-1">
                          Carnet Oficial de Vacunación
                        </h4>
                        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                          Registro completo de vacunas aplicadas a {petData.name}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Vaccines List */}
                  <div className="space-y-3">
                    {vaccines.map((vaccine) => (
                      <div
                        key={vaccine.id}
                        className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <h5 className="font-bold text-slate-900 dark:text-white mb-1">
                              {vaccine.name}
                            </h5>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              {vaccine.veterinarian}
                            </p>
                          </div>
                          <div className={`px-2.5 py-1 rounded-full ${getStatusColor(vaccine.status)} text-white text-[10px] font-black uppercase tracking-wide`}>
                            {getStatusLabel(vaccine.status)}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-2">
                            <p className="text-[10px] text-slate-500 dark:text-slate-400 mb-0.5">
                              Aplicada
                            </p>
                            <p className="text-xs font-bold text-slate-900 dark:text-white">
                              {vaccine.date}
                            </p>
                          </div>
                          <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-2">
                            <p className="text-[10px] text-slate-500 dark:text-slate-400 mb-0.5">
                              Próxima dosis
                            </p>
                            <p className="text-xs font-bold text-slate-900 dark:text-white">
                              {vaccine.nextDue}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Add Vaccine Button */}
                  <button className="w-full py-3 rounded-xl border-2 border-dashed border-[#2b6fee]/30 text-[#2b6fee] font-bold hover:bg-[#2b6fee]/5 transition-colors flex items-center justify-center gap-2">
                    <MaterialIcon name="add_circle" className="text-xl" />
                    Agregar Vacuna
                  </button>

                  {/* View Vaccination Card Button */}
                  <button 
                    onClick={() => setShowVaccinationCard(true)}
                    className="w-full py-3 rounded-xl bg-[#2b6fee] text-white font-bold hover:bg-[#5a8aff] transition-colors shadow-lg shadow-[#2b6fee]/30 flex items-center justify-center gap-2"
                  >
                    <MaterialIcon name="badge" className="text-xl" />
                    Ver Carnet
                  </button>
                </div>
              )}

              {/* EDIT MODE OVERLAY */}
              <AnimatePresence>
                {isEditing && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-white dark:bg-slate-900 z-10 overflow-y-auto"
                  >
                    <div className="p-6 space-y-4">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-xl font-black text-slate-900 dark:text-white">
                          Editar Información
                        </h3>
                        <button
                          onClick={() => setIsEditing(false)}
                          className="size-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center"
                        >
                          <MaterialIcon name="close" className="text-lg" />
                        </button>
                      </div>

                      {/* Form Fields */}
                      <div className="space-y-4">
                        <div>
                          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                            Nombre
                          </label>
                          <input
                            type="text"
                            value={petData.name}
                            onChange={(e) => setPetData({ ...petData, name: e.target.value })}
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-[#2b6fee]"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                            Raza
                          </label>
                          <input
                            type="text"
                            value={petData.breed}
                            onChange={(e) => setPetData({ ...petData, breed: e.target.value })}
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-[#2b6fee]"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                              Peso (kg)
                            </label>
                            <input
                              type="text"
                              value={petData.weight}
                              onChange={(e) => setPetData({ ...petData, weight: e.target.value })}
                              className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-[#2b6fee]"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                              Fecha de nacimiento
                            </label>
                            <input
                              type="text"
                              value={petData.birthDate}
                              onChange={(e) => setPetData({ ...petData, birthDate: e.target.value })}
                              className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-[#2b6fee]"
                            />
                          </div>
                        </div>

                        {/* Has Chip Toggle */}
                        <div>
                          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                            ¿Tiene microchip?
                          </label>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => setPetData({ ...petData, hasChip: true })}
                              className={`flex-1 py-3 rounded-xl font-bold transition-all ${
                                petData.hasChip
                                  ? "bg-[#2b6fee] text-white shadow-lg shadow-[#2b6fee]/30"
                                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                              }`}
                            >
                              Sí
                            </button>
                            <button
                              type="button"
                              onClick={() => setPetData({ ...petData, hasChip: false })}
                              className={`flex-1 py-3 rounded-xl font-bold transition-all ${
                                !petData.hasChip
                                  ? "bg-[#2b6fee] text-white shadow-lg shadow-[#2b6fee]/30"
                                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                              }`}
                            >
                              No
                            </button>
                          </div>
                        </div>

                        {/* Microchip Number - Only show if hasChip is true */}
                        {petData.hasChip && (
                          <div>
                            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                              Número de Microchip
                            </label>
                            <input
                              type="text"
                              value={petData.microchip}
                              onChange={(e) => setPetData({ ...petData, microchip: e.target.value })}
                              className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-[#2b6fee]"
                            />
                          </div>
                        )}
                      </div>

                      {/* Action Buttons */}
                      <div className="flex gap-3 pt-4">
                        <button
                          onClick={() => setIsEditing(false)}
                          className="flex-1 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                        >
                          Cancelar
                        </button>
                        <button
                          onClick={handleSave}
                          className="flex-1 py-3 rounded-xl bg-[#2b6fee] text-white font-bold hover:bg-[#5a8aff] transition-colors shadow-lg shadow-[#2b6fee]/30"
                        >
                          Guardar Cambios
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>

          {/* Vaccination Card Modal */}
          <VaccinationCardModal
            isOpen={showVaccinationCard}
            onClose={() => setShowVaccinationCard(false)}
            petData={{
              name: petData.name,
              breed: petData.breed,
              birthDate: petData.birthDate,
              microchip: petData.microchip,
              photo: petData.photo,
            }}
            vaccines={vaccines}
          />
        </>
      )}
    </AnimatePresence>
  );
}