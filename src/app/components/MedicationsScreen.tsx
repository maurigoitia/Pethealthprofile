import { useState } from "react";
import { MaterialIcon } from "./MaterialIcon";
import { motion } from "motion/react";
import { usePet } from "../contexts/PetContext";

interface MedicationsScreenProps {
  onBack: () => void;
}

interface Medication {
  id: number;
  petId: string; // Added petId
  name: string;
  type: "pill" | "injection" | "topical" | "drops";
  dosage: string;
  frequency: string;
  startDate: string;
  endDate?: string;
  status: "active" | "completed" | "paused";
  instructions: string;
  prescribedBy: string;
  refillsLeft?: number;
  nextDose?: string;
}

export function MedicationsScreen({ onBack }: MedicationsScreenProps) {
  const [activeTab, setActiveTab] = useState<"active" | "history">("active");
  const [showAddModal, setShowAddModal] = useState(false);
  
  // Get active pet from context
  const { activePetId, activePet } = usePet();

  // Mock data with petId for multi-pet support
  const allMedications: Medication[] = [
    {
      id: 1,
      petId: "pet-1", // Bruno
      name: "Apoquel 16mg",
      type: "pill",
      dosage: "1 tableta",
      frequency: "Cada 12 horas",
      startDate: "10 Feb 2026",
      status: "active",
      instructions: "Dar con comida para evitar malestar estomacal",
      prescribedBy: "Dra. López - VetCenter",
      refillsLeft: 2,
      nextDose: "Hoy, 6:00 PM",
    },
    {
      id: 2,
      petId: "pet-1", // Bruno
      name: "Simparica (Antiparasitario)",
      type: "pill",
      dosage: "1 tableta masticable",
      frequency: "Mensual",
      startDate: "23 Ene 2026",
      status: "active",
      instructions: "Dar el día 23 de cada mes",
      prescribedBy: "Dr. Martínez - PetCare",
      nextDose: "23 Feb 2026",
    },
    {
      id: 3,
      petId: "pet-1", // Bruno
      name: "Gotas óticas (Otitis)",
      type: "drops",
      dosage: "3 gotas en cada oído",
      frequency: "Cada 8 horas",
      startDate: "05 Feb 2026",
      endDate: "19 Feb 2026",
      status: "completed",
      instructions: "Limpiar oído antes de aplicar. Masajear después.",
      prescribedBy: "Dra. López - VetCenter",
    },
    {
      id: 4,
      petId: "pet-1", // Bruno
      name: "Meloxicam (Antiinflamatorio)",
      type: "injection",
      dosage: "0.2mg/kg",
      frequency: "Cada 24 horas",
      startDate: "20 Dic 2025",
      endDate: "05 Ene 2026",
      status: "completed",
      instructions: "Post-operatorio. Suspender si hay vómitos.",
      prescribedBy: "Dr. Ramírez - Clínica Central",
    },
    {
      id: 5,
      petId: "pet-2", // Rocky
      name: "Prednisona 5mg",
      type: "pill",
      dosage: "1 tableta",
      frequency: "Cada 24 horas",
      startDate: "15 Feb 2026",
      status: "active",
      instructions: "Reducir dosis gradualmente según indicaciones",
      prescribedBy: "Dr. García - VetPlus",
      refillsLeft: 1,
      nextDose: "Mañana, 8:00 AM",
    },
  ];

  // Filter medications by active pet
  const medications = allMedications.filter((m) => m.petId === activePetId);

  const activeMedications = medications.filter((m) => m.status === "active");
  const historyMedications = medications.filter((m) => m.status === "completed" || m.status === "paused");

  const getTypeIcon = (type: Medication["type"]) => {
    switch (type) {
      case "pill":
        return "medication";
      case "injection":
        return "vaccines";
      case "topical":
        return "healing";
      case "drops":
        return "water_drop";
      default:
        return "medication";
    }
  };

  const getTypeColor = (type: Medication["type"]) => {
    switch (type) {
      case "pill":
        return "bg-purple-500";
      case "injection":
        return "bg-blue-500";
      case "topical":
        return "bg-green-500";
      case "drops":
        return "bg-cyan-500";
      default:
        return "bg-purple-500";
    }
  };

  const getTypeLabel = (type: Medication["type"]) => {
    switch (type) {
      case "pill":
        return "Oral";
      case "injection":
        return "Inyección";
      case "topical":
        return "Tópico";
      case "drops":
        return "Gotas";
      default:
        return "Oral";
    }
  };

  return (
    <div className="min-h-screen bg-[#f6f6f8] dark:bg-[#101622] flex flex-col">
      <div className="max-w-md mx-auto w-full flex flex-col min-h-screen">
        {/* Header */}
        <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 pt-6 pb-4">
          <div className="flex items-center gap-3 mb-4">
            <button
              onClick={onBack}
              className="size-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            >
              <MaterialIcon name="arrow_back" className="text-xl" />
            </button>
            <div className="flex-1">
              <h1 className="text-2xl font-black text-slate-900 dark:text-white">
                Medicamentos
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {activeMedications.length} tratamientos activos
              </p>
            </div>
            <button
              onClick={() => setShowAddModal(true)}
              className="size-10 rounded-full bg-[#2b6fee] text-white flex items-center justify-center shadow-lg shadow-[#2b6fee]/30 hover:bg-[#5a8aff] transition-colors"
            >
              <MaterialIcon name="add" className="text-2xl" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
            <button
              onClick={() => setActiveTab("active")}
              className={`flex-1 py-2.5 rounded-lg font-bold text-sm transition-all ${
                activeTab === "active"
                  ? "bg-white dark:bg-slate-900 text-[#2b6fee] shadow-sm"
                  : "text-slate-600 dark:text-slate-400"
              }`}
            >
              Activos ({activeMedications.length})
            </button>
            <button
              onClick={() => setActiveTab("history")}
              className={`flex-1 py-2.5 rounded-lg font-bold text-sm transition-all ${
                activeTab === "history"
                  ? "bg-white dark:bg-slate-900 text-[#2b6fee] shadow-sm"
                  : "text-slate-600 dark:text-slate-400"
              }`}
            >
              Historial ({historyMedications.length})
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {/* Next Dose Alert */}
          {activeTab === "active" && activeMedications.some((m) => m.nextDose?.includes("Hoy")) && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-gradient-to-br from-amber-500 to-orange-500 rounded-2xl p-4 text-white shadow-lg"
            >
              <div className="flex items-start gap-3">
                <div className="size-10 bg-white/20 rounded-full flex items-center justify-center shrink-0">
                  <MaterialIcon name="schedule" className="text-2xl" />
                </div>
                <div className="flex-1">
                  <h3 className="font-black mb-1">Próxima dosis pendiente</h3>
                  <p className="text-sm opacity-90">
                    Apoquel 16mg - Hoy a las 6:00 PM
                  </p>
                </div>
                <button className="size-8 bg-white/20 rounded-full flex items-center justify-center hover:bg-white/30 transition-colors">
                  <MaterialIcon name="check" className="text-xl" />
                </button>
              </div>
            </motion.div>
          )}

          {activeTab === "active" && activeMedications.length === 0 && (
            <div className="text-center py-12">
              <div className="size-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                <MaterialIcon name="medication" className="text-4xl text-slate-400" />
              </div>
              <h3 className="font-black text-slate-900 dark:text-white mb-2">
                No hay medicamentos activos
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                Agrega un tratamiento cuando lo necesites
              </p>
            </div>
          )}

          {activeTab === "active" &&
            activeMedications.map((medication) => (
              <motion.div
                key={medication.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm"
              >
                <div className="flex gap-3 mb-3">
                  {/* Icon */}
                  <div className={`size-12 ${getTypeColor(medication.type)} rounded-xl flex items-center justify-center shrink-0`}>
                    <MaterialIcon name={getTypeIcon(medication.type)} className="text-white text-2xl" />
                  </div>

                  {/* Info */}
                  <div className="flex-1">
                    <div className="flex items-start justify-between mb-1">
                      <h3 className="font-bold text-slate-900 dark:text-white">
                        {medication.name}
                      </h3>
                      <span className="text-[10px] bg-purple-100 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 px-2 py-0.5 rounded-full font-bold uppercase">
                        {getTypeLabel(medication.type)}
                      </span>
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                      {medication.dosage} - {medication.frequency}
                    </p>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      Prescrito por {medication.prescribedBy}
                    </div>
                  </div>
                </div>

                {/* Next Dose */}
                {medication.nextDose && (
                  <div className="mb-3 p-2 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 rounded-lg flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <MaterialIcon name="schedule" className="text-blue-600 dark:text-blue-400 text-lg" />
                      <span className="text-xs font-semibold text-blue-800 dark:text-blue-300">
                        Próxima dosis: {medication.nextDose}
                      </span>
                    </div>
                    <button className="text-xs font-bold text-blue-600 dark:text-blue-400">
                      Marcar
                    </button>
                  </div>
                )}

                {/* Instructions */}
                <div className="mb-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    <MaterialIcon name="info" className="text-sm inline mr-1 align-text-bottom text-slate-500" />
                    {medication.instructions}
                  </p>
                </div>

                {/* Refills */}
                {medication.refillsLeft !== undefined && (
                  <div className="flex items-center gap-2 mb-3">
                    <MaterialIcon name="autorenew" className="text-emerald-600 dark:text-emerald-400 text-lg" />
                    <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                      {medication.refillsLeft} recargas disponibles
                    </span>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <button className="flex-1 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-sm hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                    Editar
                  </button>
                  <button className="flex-1 py-2 rounded-lg bg-[#2b6fee] text-white font-semibold text-sm hover:bg-[#5a8aff] transition-colors">
                    Ver historial
                  </button>
                </div>
              </motion.div>
            ))}

          {activeTab === "history" &&
            historyMedications.map((medication) => (
              <motion.div
                key={medication.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm opacity-75"
              >
                <div className="flex gap-3">
                  <div className={`size-12 ${getTypeColor(medication.type)} rounded-xl flex items-center justify-center shrink-0 opacity-60`}>
                    <MaterialIcon name={getTypeIcon(medication.type)} className="text-white text-2xl" />
                  </div>

                  <div className="flex-1">
                    <div className="flex items-start justify-between mb-1">
                      <h3 className="font-bold text-slate-900 dark:text-white">
                        {medication.name}
                      </h3>
                      <span className="text-[10px] bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-full font-bold uppercase">
                        Completado
                      </span>
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                      {medication.dosage} - {medication.frequency}
                    </p>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      {medication.startDate} - {medication.endDate}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Prescrito por {medication.prescribedBy}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
        </div>

        {/* Quick Add Button */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <button
            onClick={() => setShowAddModal(true)}
            className="w-full py-4 rounded-xl bg-[#2b6fee] text-white font-bold shadow-lg shadow-[#2b6fee]/30 hover:bg-[#5a8aff] transition-colors flex items-center justify-center gap-2"
          >
            <MaterialIcon name="add_circle" className="text-xl" />
            Agregar medicamento
          </button>
        </div>
      </div>
    </div>
  );
}