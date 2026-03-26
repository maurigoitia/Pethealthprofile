import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { MaterialIcon } from "./MaterialIcon";
import { MedicalEvent, DocumentType } from "../types/medical";
import { useMedical } from "../contexts/MedicalContext";
import { cleanText } from "../utils/cleanText";

interface EditEventModalProps {
    isOpen: boolean;
    onClose: () => void;
    event: MedicalEvent | null;
}

export function EditEventModal({ isOpen, onClose, event }: EditEventModalProps) {
    const { updateEvent, confirmEvent } = useMedical();
    const [formData, setFormData] = useState<any>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [isConfirming, setIsConfirming] = useState(false);

    useEffect(() => {
        if (event) {
            setFormData({
                title: event.title,
                documentType: event.extractedData.documentType,
                eventDate: event.extractedData.eventDate || "",
                provider: event.extractedData.provider || "",
                diagnosis: cleanText(event.extractedData.diagnosis) || "",
                observations: cleanText(event.extractedData.observations) || "",
                nextAppointmentDate: event.extractedData.nextAppointmentDate || "",
            });
        }
    }, [event]);

    if (!event || !formData) return null;

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await updateEvent(event.id, {
                title: formData.title,
                extractedData: {
                    ...event.extractedData,
                    documentType: formData.documentType as DocumentType,
                    eventDate: formData.eventDate || null,
                    provider: formData.provider || null,
                    diagnosis: formData.diagnosis || null,
                    observations: formData.observations || null,
                    nextAppointmentDate: formData.nextAppointmentDate || null,
                },
                updatedAt: new Date().toISOString(),
            });
            onClose();
        } catch (error) {
            console.error("Error updating event:", error);
        } finally {
            setIsSaving(false);
        }
    };

    const handleSaveAndConfirm = async () => {
        setIsConfirming(true);
        try {
            await confirmEvent(event.id, {
                title: formData.title,
                extractedData: {
                    ...event.extractedData,
                    documentType: formData.documentType as DocumentType,
                    eventDate: formData.eventDate || null,
                    provider: formData.provider || null,
                    diagnosis: formData.diagnosis || null,
                    observations: formData.observations || null,
                    nextAppointmentDate: formData.nextAppointmentDate || null,
                },
                updatedAt: new Date().toISOString(),
            });
            onClose();
        } catch (error) {
            const message = error instanceof Error ? error.message : "No se pudo confirmar el registro.";
            alert(message);
        } finally {
            setIsConfirming(false);
        }
    };

    const documentTypes: { value: DocumentType; label: string }[] = [
        { value: "vaccine", label: "Vacuna" },
        { value: "lab_test", label: "Análisis de Laboratorio" },
        { value: "xray", label: "Radiografía" },
        { value: "echocardiogram", label: "Ecocardiograma" },
        { value: "electrocardiogram", label: "Electrocardiograma" },
        { value: "surgery", label: "Cirugía" },
        { value: "medication", label: "Medicación" },
        { value: "checkup", label: "Control" },
        { value: "other", label: "Otro" },
    ];

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60]"
                    />
                    <motion.div
                        initial={{ opacity: 0, y: "100%" }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: "100%" }}
                        className="fixed inset-x-0 bottom-0 z-[70] bg-white dark:bg-slate-900 rounded-t-3xl shadow-2xl max-h-[90vh] overflow-hidden flex flex-col max-w-md mx-auto"
                    >
                        <div className="flex justify-center pt-3 pb-2">
                            <div className="w-12 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full" />
                        </div>

                        <div className="px-6 py-4 flex items-center justify-between border-b border-slate-100 dark:border-slate-800">
                            <h2 className="text-xl font-black text-slate-900 dark:text-white">Editar Registro</h2>
                            <button
                                onClick={onClose}
                                className="size-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center"
                            >
                                <MaterialIcon name="close" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 space-y-5">
                            {/* Título */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-black text-slate-500 uppercase tracking-wider">Título del Evento</label>
                                <input
                                    type="text"
                                    value={formData.title}
                                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                    className="w-full p-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl focus:border-[#074738] outline-none"
                                />
                            </div>

                            {/* Tipo de Documento */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-black text-slate-500 uppercase tracking-wider">Categoría</label>
                                <select
                                    value={formData.documentType}
                                    onChange={(e) => setFormData({ ...formData, documentType: e.target.value })}
                                    className="w-full p-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl focus:border-[#074738] outline-none appearance-none"
                                >
                                    {documentTypes.map((type) => (
                                        <option key={type.value} value={type.value}>{type.label}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Fecha */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-black text-slate-500 uppercase tracking-wider">Fecha de Realización</label>
                                <input
                                    type="date"
                                    value={formData.eventDate}
                                    onChange={(e) => setFormData({ ...formData, eventDate: e.target.value })}
                                    className="w-full p-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl focus:border-[#074738] outline-none"
                                />
                            </div>

                            {/* Proveedor */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-black text-slate-500 uppercase tracking-wider">Clínica / Profesional</label>
                                <input
                                    type="text"
                                    value={formData.provider}
                                    onChange={(e) => setFormData({ ...formData, provider: e.target.value })}
                                    className="w-full p-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl focus:border-[#074738] outline-none"
                                />
                            </div>

                            {/* Diagnóstico */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-black text-slate-500 uppercase tracking-wider">Diagnóstico / Hallazgo</label>
                                <textarea
                                    value={formData.diagnosis}
                                    onChange={(e) => setFormData({ ...formData, diagnosis: e.target.value })}
                                    className="w-full p-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl focus:border-[#074738] outline-none min-h-[100px]"
                                />
                            </div>

                            {/* Observaciones */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-black text-slate-500 uppercase tracking-wider">Notas adicionales</label>
                                <textarea
                                    value={formData.observations}
                                    onChange={(e) => setFormData({ ...formData, observations: e.target.value })}
                                    className="w-full p-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl focus:border-[#074738] outline-none min-h-[80px]"
                                />
                            </div>
                        </div>

                        <div className="p-6 border-t border-slate-100 dark:border-slate-800 flex gap-3">
                            <button
                                onClick={onClose}
                                className="flex-1 py-4 px-6 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold rounded-2xl"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={isSaving}
                                className="flex-[2] py-4 px-6 bg-[#074738] text-white font-bold rounded-2xl shadow-lg shadow-[#074738]/30 disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {isSaving ? (
                                    <div className="size-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <>
                                        <MaterialIcon name="save" className="text-lg" />
                                        Guardar Cambios
                                    </>
                                )}
                            </button>
                            {(event.requiresManualConfirmation || event.workflowStatus === "review_required" || event.workflowStatus === "invalid_future_date" || event.status === "draft") && (
                                <button
                                    onClick={handleSaveAndConfirm}
                                    disabled={isConfirming}
                                    className="flex-[2] py-4 px-6 bg-emerald-500 text-white font-bold rounded-2xl shadow-lg shadow-emerald-500/30 disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {isConfirming ? (
                                        <div className="size-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    ) : (
                                        <>
                                            <MaterialIcon name="check_circle" className="text-lg" />
                                            Confirmar
                                        </>
                                    )}
                                </button>
                            )}
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
