import { useState, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { MaterialIcon } from "./MaterialIcon";
import { usePet } from "../contexts/PetContext";
import { useMedical } from "../contexts/MedicalContext";
import { useAuth } from "../contexts/AuthContext";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "../../lib/firebase";
import { extractMedicalData } from "../services/analysisService";
import { NotificationService } from "../services/notificationService";
import { MedicalEvent, PendingAction, ActiveMedication } from "../types/medical";
import { buildEventDedupKey } from "../utils/deduplication";

interface DocumentScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type UploadStage = "select" | "processing" | "success" | "error";

export function DocumentScannerModal({
  isOpen,
  onClose,
}: DocumentScannerModalProps) {
  const { user } = useAuth();
  const { activePet } = usePet();
  const { addEvent, addPendingAction, addMedication, getEventsByPetId } = useMedical();

  const [uploadStage, setUploadStage] = useState<UploadStage>("select");
  const [fileName, setFileName] = useState<string>("");
  const [processingStatus, setProcessingStatus] = useState<string>("Iniciando...");
  const [extractedType, setExtractedType] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const parseDurationToEndDate = (duration: string | null | undefined, startDateIso: string): string | null => {
    if (!duration) return null;
    const normalized = duration.toLowerCase().trim();

    if (
      normalized.includes("cronic") ||
      normalized.includes("indefin") ||
      normalized.includes("continu")
    ) {
      return null;
    }

    const match = normalized.match(/(\d+)\s*(día|dias|días|semana|semanas|mes|meses)/i);
    if (!match) return null;

    const quantity = Number(match[1]);
    const unit = match[2].toLowerCase();
    if (!Number.isFinite(quantity) || quantity <= 0) return null;

    const startDate = new Date(startDateIso);
    if (Number.isNaN(startDate.getTime())) return null;

    const end = new Date(startDate);
    if (unit.startsWith("día") || unit.startsWith("dia")) end.setDate(end.getDate() + quantity);
    if (unit.startsWith("semana")) end.setDate(end.getDate() + quantity * 7);
    if (unit.startsWith("mes")) end.setMonth(end.getMonth() + quantity);

    return end.toISOString();
  };

  const handleFileSelect = () => {
    fileInputRef.current?.click();
  };

  const hashFile = async (file: File): Promise<string> => {
    const bytes = await file.arrayBuffer();
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest))
      .map((value) => value.toString(16).padStart(2, "0"))
      .join("");
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!activePet) {
      setUploadStage("error");
      setProcessingStatus("Selecciona una mascota primero");
      return;
    }

    const currentFileName = file.name;
    try {
      setFileName(currentFileName);
      setUploadStage("processing");

      setProcessingStatus("Verificando duplicados...");
      const fileHash = await hashFile(file);
      const existingEvents = getEventsByPetId(activePet.id);
      const duplicated = existingEvents.find((event) => event.fileHash && event.fileHash === fileHash);

      if (duplicated) {
        setUploadStage("error");
        setProcessingStatus("Documento duplicado: ya existe en el historial. Se canceló para evitar doble costo.");
        return;
      }

      // Subida y extracción en paralelo para reducir tiempo total.
      setProcessingStatus("Procesando documento...");
      const storagePath = `documents/${user?.uid || "anonymous"}/${Date.now()}_${currentFileName}`;
      const storageRef = ref(storage, storagePath);
      const uploadTask = uploadBytes(storageRef, file);
      const extractionTask = extractMedicalData(file);

      const [uploadResult, extractionResponse] = await Promise.all([
        uploadTask,
        extractionTask,
      ]);
      const downloadUrl = await getDownloadURL(uploadResult.ref);
      const aiData = extractionResponse.extractedData;

      setProcessingStatus("Guardando en tu historial...");
      const documentType = aiData.documentType || "other";
      const suggestedTitle = (aiData as any).suggestedTitle || currentFileName;

      const typeMap: Record<string, string> = {
        vaccine: "Vacuna",
        lab_test: "Análisis de Laboratorio",
        xray: "Radiografía",
        echocardiogram: "Ecocardiograma",
        electrocardiogram: "Electrocardiograma",
        surgery: "Cirugía",
        medication: "Medicación",
        checkup: "Control",
        other: "Documento General",
      };
      setExtractedType(typeMap[documentType] || "Documento");

      const newEvent: MedicalEvent = {
        id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        petId: activePet.id,
        userId: user?.uid,
        title: aiData.suggestedTitle || currentFileName,
        documentUrl: downloadUrl,
        documentPreviewUrl: downloadUrl,
        fileName: currentFileName,
        fileType: file.type.startsWith("image/") ? "image" : "pdf",
        status: "completed",
        ocrProcessed: true,
        aiProcessed: true,
        extractedData: aiData,
        fileHash,
        dedupKey: "",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        relatedEventIds: [],
        aiSuggestedRelation: null,
      };

      newEvent.dedupKey = buildEventDedupKey(newEvent);

      await addEvent(newEvent);

      // Crear pendiente si se detectó próxima fecha
      if (aiData.nextAppointmentDate) {
        const pending: PendingAction = {
          id: `pend_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          petId: activePet.id,
          userId: user?.uid,
          type: "follow_up",
          title: aiData.nextAppointmentReason || "Próximo control",
          subtitle: `Generado desde: ${aiData.suggestedTitle || currentFileName}`,
          dueDate: aiData.nextAppointmentDate,
          createdAt: new Date().toISOString(),
          generatedFromEventId: newEvent.id,
          autoGenerated: true,
          completed: false,
          completedAt: null,
          reminderEnabled: true,
          reminderDaysBefore: 3,
        };
        await addPendingAction(pending);
      }

      // Crear medicaciones activas detectadas en el documento
      if (aiData.medications && aiData.medications.length > 0) {
        await NotificationService.requestPermissionAndGetToken();

        for (const med of aiData.medications) {
          const treatmentStart = aiData.eventDate || newEvent.createdAt;
          const treatmentEnd = parseDurationToEndDate(med.duration, treatmentStart);

          const medication: ActiveMedication = {
            id: `med_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            petId: activePet.id,
            userId: user?.uid,
            name: med.name,
            dosage: med.dosage || "",
            frequency: med.frequency || "",
            type: typeMap[documentType] || "General",
            startDate: treatmentStart,
            endDate: treatmentEnd,
            prescribedBy: aiData.provider || null,
            generatedFromEventId: newEvent.id,
            active: true,
          };
          await addMedication(medication);

          try {
            await NotificationService.scheduleMedicationReminders({
              petId: activePet.id,
              petName: activePet.name,
              medicationName: med.name,
              dosage: med.dosage || "Según receta",
              frequency: med.frequency || "Cada 24 horas",
              startDate: treatmentStart,
              endDate: treatmentEnd,
              sourceEventId: newEvent.id,
              sourceMedicationId: medication.id,
            });
          } catch (scheduleError) {
            console.warn("No se pudo programar recordatorio de medicación:", scheduleError);
          }
        }
      }

      setUploadStage("success");
    } catch (error: any) {
      console.error("Error processing document:", error);
      setUploadStage("error");
      const msg = error?.message || String(error);
      if (error?.code?.includes("storage/")) {
        setProcessingStatus(`Error de almacenamiento: ${msg}`);
      } else {
        setProcessingStatus(`No se pudo procesar el documento: ${msg}`);
      }
    }
  };

  const handleClose = () => {
    onClose();
    // Reset after animation
    setTimeout(() => {
      setUploadStage("select");
      setFileName("");
      setProcessingStatus("Iniciando...");
      setExtractedType("");
    }, 300);
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
            onClick={handleClose}
            className="fixed inset-0 bg-black/60 z-50"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, y: "100%" }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed inset-x-0 bottom-0 z-50 bg-white dark:bg-slate-900 rounded-t-3xl shadow-xl max-h-[85vh] overflow-hidden flex flex-col"
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-12 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full" />
            </div>

            {/* Hidden File Input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.pdf"
              onChange={handleFileChange}
              className="hidden"
            />

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
              {/* SELECT TYPE STAGE */}
              {uploadStage === "select" && (
                <div className="p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-black text-slate-900 dark:text-white">
                      Agregar Documento
                    </h2>
                    <button
                      onClick={handleClose}
                      className="size-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                    >
                      <MaterialIcon name="close" className="text-xl" />
                    </button>
                  </div>

                  {/* Info sobre procesamiento */}
                  <div className="mb-6 p-4 bg-[#2b7cee]/10 border border-[#2b7cee]/20 rounded-2xl">
                    <div className="flex items-start gap-3">
                      <MaterialIcon name="description" className="text-[#2b7cee] text-xl mt-0.5" />
                      <div>
                        <p className="text-sm font-bold text-slate-900 dark:text-white mb-1">
                          Procesamiento inteligente automático
                        </p>
                        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                          PESSY analizará el documento, extraerá información relevante y generará eventos automáticamente.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Two Simple Options */}
                  <div className="space-y-3">
                    {/* Scan with Camera */}
                    <button
                      onClick={handleFileSelect}
                      className="w-full p-5 rounded-2xl bg-[#2b7cee] hover:bg-[#5a8aff] active:scale-95 transition-all flex items-center gap-4"
                    >
                      <div className="size-14 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                        <MaterialIcon name="photo_camera" className="text-white text-3xl" />
                      </div>
                      <div className="flex-1 text-left">
                        <h3 className="font-black text-white text-lg mb-0.5">
                          Escanear con Cámara
                        </h3>
                        <p className="text-sm text-white/80">
                          Tomar foto del documento
                        </p>
                      </div>
                      <MaterialIcon name="chevron_right" className="text-white/80 text-2xl" />
                    </button>

                    {/* Upload from Files */}
                    <button
                      onClick={handleFileSelect}
                      className="w-full p-5 rounded-2xl bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 hover:border-[#2b7cee] dark:hover:border-[#2b7cee] active:scale-95 transition-all flex items-center gap-4"
                    >
                      <div className="size-14 rounded-xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center shrink-0">
                        <MaterialIcon name="upload_file" className="text-slate-700 dark:text-slate-300 text-3xl" />
                      </div>
                      <div className="flex-1 text-left">
                        <h3 className="font-black text-slate-900 dark:text-white text-lg mb-0.5">
                          Seleccionar Archivo
                        </h3>
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                          Desde galería o archivos
                        </p>
                      </div>
                      <MaterialIcon name="chevron_right" className="text-slate-400 text-2xl" />
                    </button>
                  </div>
                </div>
              )}

              {/* PROCESSING STAGE */}
              {uploadStage === "processing" && (
                <div className="p-6 flex flex-col items-center justify-center min-h-[400px]">
                  <div className="size-14 rounded-full border-4 border-slate-200 dark:border-slate-800 border-t-[#2b7cee] animate-spin mb-6" />
                  <h3 className="text-xl font-black text-slate-900 dark:text-white mb-2">
                    {processingStatus}
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 text-center max-w-xs mb-2">
                    {fileName}
                  </p>
                  <div className="flex gap-2 mt-4">
                    {["Lectura", "Extraccion", "Guardado"].map((step) => (
                      <span
                        key={step}
                        className="px-3 py-1.5 rounded-full bg-[#2b7cee]/10 text-[#2b7cee] text-xs font-bold"
                      >
                        {step}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* SUCCESS STAGE */}
              {uploadStage === "success" && (
                <div className="p-6 flex flex-col items-center justify-center min-h-[400px]">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", damping: 15 }}
                    className="size-24 rounded-full bg-emerald-500 flex items-center justify-center mb-6"
                  >
                    <MaterialIcon name="check" className="text-white text-5xl" />
                  </motion.div>
                  <h3 className="text-xl font-black text-slate-900 dark:text-white mb-2">
                    ¡Documento procesado!
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 text-center max-w-xs mb-1">
                    {fileName}
                  </p>
                  <div className="px-4 py-2 rounded-full bg-[#2b7cee]/10 mb-6">
                    <p className="text-xs font-bold text-[#2b7cee]">
                      Tipo detectado: {extractedType}
                    </p>
                  </div>
                  <button
                    onClick={handleClose}
                    className="px-8 py-3 rounded-xl bg-[#2b7cee] text-white font-bold hover:bg-[#5a8aff] transition-colors shadow-lg shadow-[#2b7cee]/30"
                  >
                    Ver en Timeline
                  </button>
                </div>
              )}

              {/* ERROR STAGE */}
              {uploadStage === "error" && (
                <div className="p-6 flex flex-col items-center justify-center min-h-[400px]">
                  <div className="size-24 rounded-full bg-red-500 flex items-center justify-center mb-6">
                    <MaterialIcon name="error" className="text-white text-5xl" />
                  </div>
                  <h3 className="text-xl font-black text-slate-900 dark:text-white mb-2">
                    Error al procesar
                  </h3>
                  <p className="text-xs text-red-500 text-center max-w-xs mb-2 font-mono bg-red-50 dark:bg-red-950/30 p-3 rounded-xl break-all">
                    {processingStatus}
                  </p>
                  <button
                    onClick={() => setUploadStage("select")}
                    className="mt-4 px-8 py-3 rounded-xl bg-slate-900 dark:bg-slate-800 text-white font-bold hover:bg-black dark:hover:bg-slate-700 transition-colors"
                  >
                    Intentar de nuevo
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
