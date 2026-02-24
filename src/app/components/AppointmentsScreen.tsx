import { useState } from "react";
import { MaterialIcon } from "./MaterialIcon";
import { motion } from "motion/react";
import { usePet } from "../contexts/PetContext";

interface AppointmentsScreenProps {
  onBack: () => void;
}

interface Appointment {
  id: number;
  petId: string; // Added petId
  type: "checkup" | "vaccine" | "surgery" | "emergency";
  title: string;
  date: string;
  time: string;
  veterinarian: string;
  clinic: string;
  status: "upcoming" | "completed" | "cancelled";
  notes?: string;
}

export function AppointmentsScreen({ onBack }: AppointmentsScreenProps) {
  const [activeTab, setActiveTab] = useState<"upcoming" | "past">("upcoming");
  const [showAddModal, setShowAddModal] = useState(false);
  
  // Get active pet from context
  const { activePetId, activePet } = usePet();

  // Mock data with petId for multi-pet support
  const allAppointments: Appointment[] = [
    {
      id: 1,
      petId: "pet-1", // Bruno
      type: "checkup",
      title: "Control de peso mensual",
      date: "28 Feb 2026",
      time: "10:00 AM",
      veterinarian: "Dra. López",
      clinic: "VetCenter",
      status: "upcoming",
      notes: "Llevar carnet de vacunación",
    },
    {
      id: 2,
      petId: "pet-1", // Bruno
      type: "vaccine",
      title: "Vacuna DHPPi",
      date: "15 Mar 2026",
      time: "3:30 PM",
      veterinarian: "Dr. Martínez",
      clinic: "PetCare",
      status: "upcoming",
    },
    {
      id: 3,
      petId: "pet-1", // Bruno
      type: "checkup",
      title: "Revisión general",
      date: "20 Ene 2026",
      time: "11:00 AM",
      veterinarian: "Dra. López",
      clinic: "VetCenter",
      status: "completed",
      notes: "Todo en orden. Peso: 28.5kg",
    },
    {
      id: 4,
      petId: "pet-1", // Bruno
      type: "vaccine",
      title: "Antirrábica",
      date: "23 Feb 2025",
      time: "4:00 PM",
      veterinarian: "Dra. López",
      clinic: "VetCenter",
      status: "completed",
    },
    {
      id: 5,
      petId: "pet-2", // Rocky
      type: "checkup",
      title: "Chequeo respiratorio",
      date: "5 Mar 2026",
      time: "9:00 AM",
      veterinarian: "Dr. García",
      clinic: "VetPlus",
      status: "upcoming",
      notes: "Control de respiración",
    },
    {
      id: 6,
      petId: "pet-2", // Rocky
      type: "vaccine",
      title: "Vacuna Parvovirus",
      date: "10 Ene 2026",
      time: "2:00 PM",
      veterinarian: "Dr. García",
      clinic: "VetPlus",
      status: "completed",
    },
  ];

  // Filter appointments by active pet
  const appointments = allAppointments.filter((a) => a.petId === activePetId);

  const upcomingAppointments = appointments.filter((a) => a.status === "upcoming");
  const pastAppointments = appointments.filter((a) => a.status === "completed" || a.status === "cancelled");

  const getTypeIcon = (type: Appointment["type"]) => {
    switch (type) {
      case "checkup":
        return "medical_services";
      case "vaccine":
        return "vaccines";
      case "surgery":
        return "healing";
      case "emergency":
        return "emergency";
      default:
        return "medical_services";
    }
  };

  const getTypeColor = (type: Appointment["type"]) => {
    switch (type) {
      case "checkup":
        return "bg-blue-500";
      case "vaccine":
        return "bg-purple-500";
      case "surgery":
        return "bg-red-500";
      case "emergency":
        return "bg-orange-500";
      default:
        return "bg-blue-500";
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
                Citas
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {upcomingAppointments.length} próximas
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
              onClick={() => setActiveTab("upcoming")}
              className={`flex-1 py-2.5 rounded-lg font-bold text-sm transition-all ${
                activeTab === "upcoming"
                  ? "bg-white dark:bg-slate-900 text-[#2b6fee] shadow-sm"
                  : "text-slate-600 dark:text-slate-400"
              }`}
            >
              Próximas ({upcomingAppointments.length})
            </button>
            <button
              onClick={() => setActiveTab("past")}
              className={`flex-1 py-2.5 rounded-lg font-bold text-sm transition-all ${
                activeTab === "past"
                  ? "bg-white dark:bg-slate-900 text-[#2b6fee] shadow-sm"
                  : "text-slate-600 dark:text-slate-400"
              }`}
            >
              Pasadas ({pastAppointments.length})
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {activeTab === "upcoming" && upcomingAppointments.length === 0 && (
            <div className="text-center py-12">
              <div className="size-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                <MaterialIcon name="event" className="text-4xl text-slate-400" />
              </div>
              <h3 className="font-black text-slate-900 dark:text-white mb-2">
                No hay citas próximas
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                Agenda la primera cita para Bruno
              </p>
            </div>
          )}

          {activeTab === "upcoming" &&
            upcomingAppointments.map((appointment) => (
              <motion.div
                key={appointment.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm"
              >
                <div className="flex gap-3">
                  {/* Icon */}
                  <div className={`size-12 ${getTypeColor(appointment.type)} rounded-xl flex items-center justify-center shrink-0`}>
                    <MaterialIcon name={getTypeIcon(appointment.type)} className="text-white text-2xl" />
                  </div>

                  {/* Info */}
                  <div className="flex-1">
                    <h3 className="font-bold text-slate-900 dark:text-white mb-1">
                      {appointment.title}
                    </h3>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                        <MaterialIcon name="event" className="text-base" />
                        <span>{appointment.date} a las {appointment.time}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                        <MaterialIcon name="location_on" className="text-base" />
                        <span>{appointment.clinic}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                        <MaterialIcon name="person" className="text-base" />
                        <span>{appointment.veterinarian}</span>
                      </div>
                    </div>

                    {appointment.notes && (
                      <div className="mt-2 p-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-lg">
                        <p className="text-xs text-amber-800 dark:text-amber-300">
                          <MaterialIcon name="info" className="text-sm inline mr-1 align-text-bottom" />
                          {appointment.notes}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <button className="flex-1 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-sm hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                    Reprogramar
                  </button>
                  <button className="flex-1 py-2 rounded-lg bg-[#2b6fee] text-white font-semibold text-sm hover:bg-[#5a8aff] transition-colors">
                    Ver detalles
                  </button>
                </div>
              </motion.div>
            ))}

          {activeTab === "past" &&
            pastAppointments.map((appointment) => (
              <motion.div
                key={appointment.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm opacity-75"
              >
                <div className="flex gap-3">
                  <div className={`size-12 ${getTypeColor(appointment.type)} rounded-xl flex items-center justify-center shrink-0 opacity-60`}>
                    <MaterialIcon name={getTypeIcon(appointment.type)} className="text-white text-2xl" />
                  </div>

                  <div className="flex-1">
                    <h3 className="font-bold text-slate-900 dark:text-white mb-1">
                      {appointment.title}
                    </h3>
                    <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 mb-1">
                      <MaterialIcon name="event" className="text-base" />
                      <span>{appointment.date}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                      <MaterialIcon name="person" className="text-base" />
                      <span>{appointment.veterinarian} - {appointment.clinic}</span>
                    </div>

                    {appointment.notes && (
                      <div className="mt-2 p-2 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 rounded-lg">
                        <p className="text-xs text-emerald-800 dark:text-emerald-300">
                          <MaterialIcon name="check_circle" className="text-sm inline mr-1 align-text-bottom" />
                          {appointment.notes}
                        </p>
                      </div>
                    )}
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
            Agendar nueva cita
          </button>
        </div>
      </div>
    </div>
  );
}