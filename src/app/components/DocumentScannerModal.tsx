import { useState, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { MaterialIcon } from "./MaterialIcon";
import { useNavigate } from "react-router";
import { usePet } from "../contexts/PetContext";
import { useMedical } from "../contexts/MedicalContext";
import { useAuth } from "../contexts/AuthContext";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "../../lib/firebase";
import { extractMedicalData } from "../services/analysisService";
import { NotificationService } from "../services/notificationService";
import { MedicalEvent, ActiveMedication } from "../types/medical";
import { buildEventSemanticKey } from "../utils/deduplication";
import { evaluateDocumentForReview, ReviewTarget } from "../utils/medicalRulesEngine";
import { parseDateSafe } from "../utils/dateUtils";
import { downloadIcsEvent } from "../utils/calendarExport";
import { useStorageQuota } from "../hooks/useStorageQuota";
import { VoiceInputButton } from "./VoiceInputButton";

interface DocumentScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type UploadStage = "select" | "processing" | "treatment_questions" | "success" | "error";

interface TreatmentQuestionItem {
  id: string;
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
  reminderEnabled: boolean;
  reminderInterval: "8" | "12" | "24" | "other";
  reminderCustomHours: string;
  addToCalendar: boolean;
}

interface PendingTreatmentContext {
  eventId: string;
  treatmentStart: string;
  treatmentType: string;
  provider: string | null;
  items: TreatmentQuestionItem[];
}

export function DocumentScannerModal({
  isOpen,
  onClose,
}: DocumentScannerModalProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { activePet } = usePet();
  const { addEvent, addMedication, getEventsByPetId } = useMedical();
  const { canUpload, trackUpload } = useStorageQuota();

  const [uploadStage, setUploadStage] = useState<UploadStage>("select");
  const [fileName, setFileName] = useState<string>("");
  const [processingStatus, setProcessingStatus] = useState<string>("Iniciando...");
  const [extractedType, setExtractedType] = useState<string>("");
  const [requiresReview, setRequiresReview] = useState(false);
  const [reviewReasons, setReviewReasons] = useState<string[]>([]);
  const [reviewTarget, setReviewTarget] = useState<ReviewTarget>("feed");
  const [pendingTreatmentContext, setPendingTreatmentContext] = useState<PendingTreatmentContext | null>(null);
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

    const startDate = parseDateSafe(startDateIso);
    if (!startDate) return null;

    const end = new Date(startDate);
    if (unit.startsWith("día") || unit.startsWith("dia")) end.setDate(end.getDate() + quantity);
    if (unit.startsWith("semana")) end.setDate(end.getDate() + quantity * 7);
    if (unit.startsWith("mes")) end.setMonth(end.getMonth() + quantity);

    return end.toISOString();
  };

  const handleFileSelect = () => {
    fileInputRef.current?.click();
  };

  const toLocalDate = (isoLike: string): string => {
    const parsed = parseDateSafe(isoLike) || new Date();
    return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}-${String(parsed.getDate()).padStart(2, "0")}`;
  };

  const toLocalTime = (isoLike: string): string => {
    const parsed = parseDateSafe(isoLike) || new Date();
    return `${String(parsed.getHours()).padStart(2, "0")}:${String(parsed.getMinutes()).padStart(2, "0")}`;
  };

  const parseHoursFromText = (value: string): number | null => {
    if (!value) return null;
    const match = value.toLowerCase().match(/(\d+)\s*h/);
    if (!match) return null;
    const num = Number(match[1]);
    return Number.isFinite(num) && num > 0 ? num : null;
  };

  const reminderHoursToFrequencyText = (item: TreatmentQuestionItem): string => {
    if (item.reminderInterval === "other") {
      const custom = Number(item.reminderCustomHours);
      if (Number.isFinite(custom) && custom > 0) {
        return `Cada ${custom} horas`;
      }
    }
    return `Cada ${item.reminderInterval} horas`;
  };

  const updateTreatmentItem = (id: string, updates: Partial<TreatmentQuestionItem>) => {
    setPendingTreatmentContext((previous) => {
      if (!previous) return previous;
      return {
        ...previous,
        items: previous.items.map((item) => (item.id === id ? { ...item, ...updates } : item)),
      };
    });
  };

  const finalizeTreatments = async () => {
    if (!pendingTreatmentContext || !activePet) return;

    try {
      setUploadStage("processing");
      setProcessingStatus("Guardando tratamiento y recordatorios...");

      const shouldRequestNotifications = pendingTreatmentContext.items.some((item) => item.reminderEnabled);
      if (shouldRequestNotifications) {
        await NotificationService.requestPermissionAndGetToken();
      }

      for (const item of pendingTreatmentContext.items) {
        const startDate = pendingTreatmentContext.treatmentStart;
        const frequency = item.frequency.trim() || "Frecuencia no especificada";
        const duration = item.duration.trim();
        const endDate = parseDurationToEndDate(duration || null, startDate);

        const medication: ActiveMedication = {
          id: `med_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          petId: activePet.id,
          userId: user?.uid,
          name: item.name,
          dosage: item.dosage || "",
          frequency,
          type: pendingTreatmentContext.treatmentType,
          startDate,
          endDate,
          prescribedBy: pendingTreatmentContext.provider || null,
          generatedFromEventId: pendingTreatmentContext.eventId,
          active: true,
        };

        await addMedication(medication);

        if (item.reminderEnabled) {
          const reminderFrequency = reminderHoursToFrequencyText(item);
          try {
            await NotificationService.scheduleMedicationReminders({
              petId: activePet.id,
              petName: activePet.name,
              medicationName: item.name,
              dosage: item.dosage || "Según receta",
              frequency: reminderFrequency,
              startDate,
              endDate,
              sourceEventId: pendingTreatmentContext.eventId,
              sourceMedicationId: medication.id,
            });
          } catch (scheduleError) {
            console.warn("No se pudo programar recordatorio de medicación:", scheduleError);
          }
        }

        if (item.addToCalendar) {
          downloadIcsEvent(
            {
              title: `Tratamiento ${activePet.name}: ${item.name}`,
              date: toLocalDate(startDate),
              time: toLocalTime(startDate),
              durationMinutes: 30,
              location: pendingTreatmentContext.provider || "",
              description: [
                `Medicacion: ${item.name}`,
                item.dosage ? `Dosis: ${item.dosage}` : null,
                frequency ? `Frecuencia: ${frequency}` : null,
                duration ? `Duracion: ${duration}` : null,
              ]
                .filter(Boolean)
                .join(" · "),
            },
            `tratamiento-${item.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.ics`
          );
        }
      }

      setPendingTreatmentContext(null);
      setUploadStage("success");
    } catch (error) {
      console.error("No se pudo guardar el tratamiento confirmado:", error);
      setUploadStage("error");
      setProcessingStatus("No se pudo guardar el tratamiento. Reintentá en unos segundos.");
    }
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

      // ── Verificar quota ANTES de subir ──────────────────────────────────
      setProcessingStatus("Verificando almacenamiento...");
      const { allowed, quota } = await canUpload(file.size);
      if (!allowed) {
        setUploadStage("error");
        setProcessingStatus(
          `Límite de almacenamiento alcanzado (${Math.round(quota.percentUsed)}%). Eliminá archivos antiguos para seguir subiendo documentos.`
        );
        return;
      }

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
      let downloadUrl = "";
      try {
        downloadUrl = await getDownloadURL(uploadResult.ref);
      } catch (downloadError) {
        // En algunos entornos móviles la lectura inmediata de metadata puede fallar
        // aunque la subida fue exitosa. Usamos token devuelto por la subida como fallback.
        const metadata: any = uploadResult?.metadata || {};
        const rawToken = typeof metadata.downloadTokens === "string" ? metadata.downloadTokens : "";
        const token = rawToken.split(",")[0]?.trim();
        const fullPath = encodeURIComponent(metadata.fullPath || uploadResult.ref.fullPath || "");
        const bucket = metadata.bucket || uploadResult.ref.bucket;

        if (token && fullPath && bucket) {
          downloadUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${fullPath}?alt=media&token=${token}`;
        } else if (fullPath && bucket) {
          downloadUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${fullPath}?alt=media`;
        } else {
          throw downloadError;
        }
      }
      // ── Registrar bytes usados ─────────────────────────────────────────
      trackUpload(file.size).catch(() => {});
      const aiData = extractionResponse.extractedData;
      const reviewDecision = evaluateDocumentForReview(aiData);

      setProcessingStatus("Guardando en tu historial...");
      const documentType = aiData.documentType || "other";
      const suggestedTitle = (aiData as any).suggestedTitle || currentFileName;

      const typeMap: Record<string, string> = {
        vaccine: "Vacuna",
        appointment: "Turno Médico",
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
      setRequiresReview(reviewDecision.requiresManualConfirmation);
      setReviewReasons(reviewDecision.reviewReasons);
      setReviewTarget(reviewDecision.reviewTarget);

      const newEvent: MedicalEvent = {
        id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        petId: activePet.id,
        userId: user?.uid,
        title: aiData.suggestedTitle || currentFileName,
        documentUrl: downloadUrl,
        documentPreviewUrl: downloadUrl,
        fileName: currentFileName,
        fileType: file.type.startsWith("image/") ? "image" : "pdf",
        status: reviewDecision.requiresManualConfirmation ? "draft" : "completed",
        workflowStatus: reviewDecision.workflowStatus,
        requiresManualConfirmation: reviewDecision.requiresManualConfirmation,
        reviewReasons: reviewDecision.reviewReasons,
        overallConfidence: reviewDecision.overallConfidence,
        ocrProcessed: true,
        aiProcessed: true,
        extractedData: aiData,
        fileHash,
        dedupKey: "",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        relatedEventIds: [],
        aiSuggestedRelation: null,
        derivedDataPersistedAt: reviewDecision.shouldPersistDerivedData ? new Date().toISOString() : null,
      };

      newEvent.dedupKey = buildEventSemanticKey(newEvent);

      const duplicatedByContent = existingEvents.some(
        (event) => buildEventSemanticKey(event) === newEvent.dedupKey
      );
      if (duplicatedByContent) {
        setUploadStage("error");
        setProcessingStatus("Documento duplicado: ya existe uno equivalente en el historial.");
        return;
      }

      const created = await addEvent(newEvent);
      if (!created) {
        setUploadStage("error");
        setProcessingStatus("Documento duplicado: se evitó guardar para no generar costos duplicados.");
        return;
      }

      // Crear medicaciones activas detectadas en el documento cuando la extracción es confiable.
      // Antes de persistir, pedimos completar datos clave de tratamiento.
      if (reviewDecision.shouldPersistDerivedData && aiData.medications && aiData.medications.length > 0) {
        const treatmentStart = aiData.eventDate || newEvent.createdAt;
        const items: TreatmentQuestionItem[] = aiData.medications.map((med, index) => {
          const detectedHours = parseHoursFromText(med.frequency || "");
          const interval: TreatmentQuestionItem["reminderInterval"] = detectedHours === 8 || detectedHours === 12 || detectedHours === 24
            ? (String(detectedHours) as "8" | "12" | "24")
            : "other";

          return {
            id: `${newEvent.id}_med_${index}`,
            name: med.name,
            dosage: med.dosage || "",
            frequency: med.frequency || "Cada 24 horas",
            duration: med.duration || "",
            reminderEnabled: Boolean(med.frequency),
            reminderInterval: interval,
            reminderCustomHours: detectedHours && ![8, 12, 24].includes(detectedHours) ? String(detectedHours) : "",
            addToCalendar: false,
          };
        });

        setPendingTreatmentContext({
          eventId: newEvent.id,
          treatmentStart,
          treatmentType: typeMap[documentType] || "General",
          provider: aiData.provider || null,
          items,
        });
        setUploadStage("treatment_questions");
        return;
      }

      if (reviewDecision.requiresManualConfirmation) {
        setProcessingStatus(
          "Documento cargado. Revisemos algunos datos antes de confirmarlos."
        );
      }
      setUploadStage("success");
    } catch (error: any) {
      console.error("Error processing document:", error);
      setUploadStage("error");
      const msg = (error?.message || String(error) || "").toLowerCase();

      if (error?.code?.includes("storage/")) {
        setProcessingStatus("No se pudo subir el archivo. Verificá conexión y reintentá.");
        return;
      }
      if (msg.includes("no configurado")) {
        setProcessingStatus("El servicio de análisis no está disponible en este entorno.");
        return;
      }
      if (msg.includes("network") || msg.includes("fetch")) {
        setProcessingStatus("Sin conexión con el servicio de análisis. Reintentá en unos segundos.");
        return;
      }
      if (msg.includes("429") || msg.includes("quota") || msg.includes("rate")) {
        setProcessingStatus("Servicio saturado temporalmente. Probá nuevamente en un minuto.");
        return;
      }

      setProcessingStatus("No se pudo procesar el documento en este intento. Probá con una foto más clara o reintentá.");
    }
  };

  const handleClose = () => {
    onClose();
    setTimeout(() => {
      setUploadStage("select");
      setFileName("");
      setProcessingStatus("Iniciando...");
      setExtractedType("");
      setRequiresReview(false);
      setReviewReasons([]);
      setReviewTarget("feed");
      setPendingTreatmentContext(null);
    }, 300);
  };

  const handleGoToReview = () => {
    const reviewParam = reviewTarget === "medications"
      ? "medications"
      : reviewTarget === "appointments"
        ? "appointments"
        : "feed";
    navigate(`/home?review=${reviewParam}`);
    handleClose();
  };

  return (
    <>
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
                      aria-label="Cerrar"
                      className="size-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors focus-visible:ring-2 focus-visible:ring-[#074738] focus-visible:ring-offset-2"
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
                          PESSY analizará el documento, extraerá información relevante y te mostrará sugerencias para confirmar.
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
              {uploadStage === "treatment_questions" && pendingTreatmentContext && (
                <div className="p-6 space-y-5">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-black text-slate-900 dark:text-white">
                      Confirmar tratamiento detectado
                    </h3>
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                      {pendingTreatmentContext.items.length} registro(s)
                    </span>
                  </div>

                  <p className="text-sm text-slate-600 dark:text-slate-300">
                    Completá estos datos antes de guardar para activar recordatorios y calendario correctamente.
                  </p>

                  <div className="space-y-4">
                    {pendingTreatmentContext.items.map((item) => (
                      <div key={item.id} className="rounded-2xl border border-slate-200 dark:border-slate-700 p-4 space-y-4 bg-slate-50/50 dark:bg-slate-800/40">
                        <div>
                          <p className="text-base font-bold text-slate-900 dark:text-white">{item.name}</p>
                          {item.dosage && (
                            <p className="text-xs text-slate-500 dark:text-slate-400">Dosis detectada: {item.dosage}</p>
                          )}
                        </div>

                        <div className="grid grid-cols-1 gap-3">
                          <label className="space-y-1">
                            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Cada cuánto lo toma</span>
                            <div className="flex items-center gap-2">
                              <input
                                value={item.frequency}
                                onChange={(event) => updateTreatmentItem(item.id, { frequency: event.target.value })}
                                className="flex-1 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                                placeholder="Ej: cada 12 horas"
                              />
                              <VoiceInputButton
                                onTranscript={(text) => updateTreatmentItem(item.id, { frequency: item.frequency + (item.frequency ? " " : "") + text })}
                                className="size-10"
                              />
                            </div>
                          </label>

                          <label className="space-y-1">
                            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Por cuánto tiempo</span>
                            <div className="flex items-center gap-2">
                              <input
                                value={item.duration}
                                onChange={(event) => updateTreatmentItem(item.id, { duration: event.target.value })}
                                className="flex-1 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                                placeholder="Ej: 10 días / 2 semanas / crónico"
                              />
                              <VoiceInputButton
                                onTranscript={(text) => updateTreatmentItem(item.id, { duration: item.duration + (item.duration ? " " : "") + text })}
                                className="size-10"
                              />
                            </div>
                          </label>
                        </div>

                        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 space-y-3">
                          <label className="flex items-center justify-between gap-3">
                            <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">Querés recordatorio</span>
                            <input
                              type="checkbox"
                              checked={item.reminderEnabled}
                              onChange={(event) => updateTreatmentItem(item.id, { reminderEnabled: event.target.checked })}
                              className="size-4 accent-[#2b7cee]"
                            />
                          </label>

                          {item.reminderEnabled && (
                            <div className="space-y-2">
                              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Frecuencia del recordatorio</label>
                              <div className="grid grid-cols-4 gap-2">
                                {(["8", "12", "24", "other"] as const).map((option) => (
                                  <button
                                    key={option}
                                    type="button"
                                    onClick={() => updateTreatmentItem(item.id, { reminderInterval: option })}
                                    className={`rounded-lg px-2 py-2 text-xs font-bold border ${
                                      item.reminderInterval === option
                                        ? "bg-[#2b7cee] text-white border-[#2b7cee]"
                                        : "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-600"
                                    }`}
                                  >
                                    {option === "other" ? "Otro" : `${option}h`}
                                  </button>
                                ))}
                              </div>
                              {item.reminderInterval === "other" && (
                                <input
                                  value={item.reminderCustomHours}
                                  onChange={(event) => updateTreatmentItem(item.id, { reminderCustomHours: event.target.value })}
                                  className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                                  placeholder="Cada cuántas horas"
                                  inputMode="numeric"
                                />
                              )}
                            </div>
                          )}

                          <label className="flex items-center justify-between gap-3">
                            <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">Agregar al calendario (ICS)</span>
                            <input
                              type="checkbox"
                              checked={item.addToCalendar}
                              onChange={(event) => updateTreatmentItem(item.id, { addToCalendar: event.target.checked })}
                              className="size-4 accent-[#2b7cee]"
                            />
                          </label>
                        </div>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={finalizeTreatments}
                    className="w-full py-3 rounded-xl bg-[#2b7cee] hover:bg-[#5a8aff] text-white font-bold shadow-lg shadow-[#2b7cee]/30 transition-colors"
                  >
                    Confirmar y guardar tratamiento
                  </button>
                </div>
              )}

              {/* SUCCESS STAGE */}
              {uploadStage === "success" && (
                <div className="p-6 flex flex-col items-center justify-center min-h-[400px]">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", damping: 15 }}
                    className={`size-24 rounded-full flex items-center justify-center mb-6 ${
                      requiresReview ? "bg-amber-500" : "bg-emerald-500"
                    }`}
                  >
                    <MaterialIcon name={requiresReview ? "rule_folder" : "check"} className="text-white text-5xl" />
                  </motion.div>
                  <h3 className="text-xl font-black text-slate-900 dark:text-white mb-2">
                    {requiresReview ? "Revisión requerida" : "¡Documento procesado!"}
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 text-center max-w-xs mb-1">
                    {fileName}
                  </p>
                  <div className="px-4 py-2 rounded-full bg-[#2b7cee]/10 mb-6">
                    <p className="text-xs font-bold text-[#2b7cee]">
                      Tipo detectado: {extractedType}
                    </p>
                  </div>
                  {requiresReview && (
                    <div className="w-full max-w-xs p-3 rounded-xl bg-amber-50 border border-amber-200 mb-6">
                      <p className="text-xs font-bold text-amber-700 mb-1">
                        Revisemos algunos datos antes de confirmarlos:
                      </p>
                      <ul className="text-xs text-amber-700 list-disc list-inside space-y-0.5">
                        {reviewReasons.slice(0, 3).map((reason, index) => (
                          <li key={`${reason}-${index}`}>{reason}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <button
                    onClick={requiresReview ? handleGoToReview : handleClose}
                    className={`px-8 py-3 rounded-xl text-white font-bold transition-colors shadow-lg ${
                      requiresReview
                        ? "bg-amber-500 hover:bg-amber-600 shadow-amber-500/30"
                        : "bg-[#2b7cee] hover:bg-[#5a8aff] shadow-[#2b7cee]/30"
                    }`}
                  >
                    {requiresReview ? "Revisar y confirmar" : "Ver en Timeline"}
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
    </>
  );
}
