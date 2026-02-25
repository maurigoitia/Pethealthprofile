import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { MaterialIcon } from "./MaterialIcon";
import { usePet } from "../contexts/PetContext";
import { useMedical } from "../contexts/MedicalContext";
import { Appointment } from "../types/medical";

interface AddAppointmentModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function AddAppointmentModal({ isOpen, onClose }: AddAppointmentModalProps) {
    const { activePet } = usePet();
    const { addAppointment } = useMedical();

    const [type, setType] = useState<Appointment["type"]>("checkup");
    const [title, setTitle] = useState("");
    const [date, setDate] = useState("");
    const [time, setTime] = useState("");
    const [veterinarian, setVeterinarian] = useState("");
    const [clinic, setClinic] = useState("");
    const [notes, setNotes] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!activePet) return;

        setIsSubmitting(true);
        try {
            const newAppointment: Appointment = {
                id: `apt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                petId: activePet.id,
                type,
                title,
                date,
                time,
                veterinarian: veterinarian || null,
                clinic: clinic || null,
                status: "upcoming",
                notes: notes || undefined,
                createdAt: new Date().toISOString(),
            };

            await addAppointment(newAppointment);
            onClose();
            // Reset form
            setTitle("");
            setDate("");
            setTime("");
            setVeterinarian("");
            setClinic("");
            setNotes("");
        } catch (error) {
            console.error("Error adding appointment:", error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const typeOptions: { id: Appointment["type"]; label: string; icon: string; color: string }[] = [
        { id: "checkup", label: "Control", icon: "medical_services", color: "bg-blue-500" },
        { id: "vaccine", label: "Vacuna", icon: "vaccines", color: "bg-purple-500" },
        { id: "surgery", label: "Cirugía", icon: "healing", color: "bg-red-500" },
        { id: "emergency", label: "Urgencia", icon: "emergency", color: "bg-orange-500" },
        { id: "other", label: "Otro", icon: "more_horiz", color: "bg-slate-500" },
    ];

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
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60]"
                    />

                    {/* Bottom Sheet */}
                    <motion.div
                        initial={{ y: "100%" }}
                        animate={{ y: 0 }}
                        exit={{ y: "100%" }}
                        transition={{ type: "spring", damping: 30, stiffness: 300 }}
                        className="fixed inset-x-0 bottom-0 z-[70] bg-white dark:bg-slate-900 rounded-t-3xl shadow-2xl max-h-[90vh] overflow-hidden flex flex-col"
                    >
                        {/* Handle */}
                        <div className="flex justify-center pt-3 pb-2">
                            <div className="w-12 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full" />
                        </div>

                        <div className="p-6 overflow-y-auto">
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-2xl font-black text-slate-900 dark:text-white">Agendar Cita</h2>
                                <button
                                    onClick={onClose}
                                    className="size-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                                >
                                    <MaterialIcon name="close" className="text-xl" />
                                </button>
                            </div>

                            <form onSubmit={handleSubmit} className="space-y-5 pb-8">
                                {/* Type Selection */}
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-3">Tipo de Cita</label>
                                    <div className="flex flex-wrap gap-2">
                                        {typeOptions.map((opt) => (
                                            <button
                                                key={opt.id}
                                                type="button"
                                                onClick={() => setType(opt.id)}
                                                className={`px-4 py-2.5 rounded-xl border-2 transition-all flex items-center gap-2 ${type === opt.id
                                                        ? "border-[#2b6fee] bg-[#2b6fee]/5 text-[#2b6fee] font-bold"
                                                        : "border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-slate-500"
                                                    }`}
                                            >
                                                <MaterialIcon name={opt.icon} className="text-xl" />
                                                <span className="text-sm">{opt.label}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Title */}
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Motivo / Título</label>
                                    <input
                                        type="text"
                                        value={title}
                                        onChange={(e) => setTitle(e.target.value)}
                                        placeholder="Ej: Control anual, Vacuna rabia..."
                                        className="w-full px-4 py-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-[#2b6fee] outline-none"
                                        required
                                    />
                                </div>

                                {/* Date & Time */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Fecha</label>
                                        <input
                                            type="date"
                                            value={date}
                                            onChange={(e) => setDate(e.target.value)}
                                            className="w-full px-4 py-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-[#2b6fee] outline-none"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Hora</label>
                                        <input
                                            type="time"
                                            value={time}
                                            onChange={(e) => setTime(e.target.value)}
                                            className="w-full px-4 py-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-[#2b6fee] outline-none"
                                            required
                                        />
                                    </div>
                                </div>

                                {/* Veterinarian & Clinic */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Veterinario</label>
                                        <input
                                            type="text"
                                            value={veterinarian}
                                            onChange={(e) => setVeterinarian(e.target.value)}
                                            placeholder="Dr. Smith"
                                            className="w-full px-4 py-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-[#2b6fee] outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Clínica</label>
                                        <input
                                            type="text"
                                            value={clinic}
                                            onChange={(e) => setClinic(e.target.value)}
                                            placeholder="VetPlus"
                                            className="w-full px-4 py-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-[#2b6fee] outline-none"
                                        />
                                    </div>
                                </div>

                                {/* Notes */}
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Notas adicionales</label>
                                    <textarea
                                        value={notes}
                                        onChange={(e) => setNotes(e.target.value)}
                                        placeholder="Llevar estudios previos, en ayunas, etc..."
                                        rows={3}
                                        className="w-full px-4 py-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-[#2b6fee] outline-none resize-none"
                                    />
                                </div>

                                {/* Submit */}
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="w-full py-4 rounded-xl bg-[#2b6fee] text-white font-bold text-lg shadow-lg shadow-[#2b6fee]/30 hover:bg-[#5a8aff] active:scale-[0.98] transition-all disabled:opacity-50 mt-4"
                                >
                                    {isSubmitting ? "Agendando..." : "Confirmar Cita"}
                                </button>
                            </form>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
