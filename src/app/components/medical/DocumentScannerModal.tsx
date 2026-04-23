import { useState, useRef } from "react";
import { MaterialIcon } from "../shared/MaterialIcon";
import { useNavigate } from "react-router";
import { usePet } from "../../contexts/PetContext";
import { useMedical } from "../../contexts/MedicalContext";
import { useAuth } from "../../contexts/AuthContext";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { collection, query, where, getDocs } from "firebase/firestore";
import { storage, db } from "../../../lib/firebase";
import { extractMedicalData } from "../../services/analysisService";
import { MedicalEvent, ActiveMedication } from "../../types/medical";
import { buildEventSemanticKey } from "../../utils/deduplication";
import { evaluateDocumentForReview, ReviewTarget } from "../../utils/medicalRulesEngine";
import { parseDateSafe } from "../../utils/dateUtils";
import { useStorageQuota } from "../../hooks/useStorageQuota";

interface DocumentScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type UploadStage = "select" | "processing" | "success" | "error";

export function DocumentScannerModal({
  isOpen,
  onClose,
}: DocumentScannerModalProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { activePet } = usePet();
  const { addEvent, addMedication } = useMedical();
  const { canUpload, trackUpload } = useStorageQuota();

  const [uploadStage, setUploadStage] = useState<UploadStage>("select");
  const [fileName, setFileName] = useState<string>("");
  const [processingStatus, setProcessingStatus] = useState<string>("Iniciando...");
  const [extractedType, setExtractedType] = useState<string>("");
  const [requiresReview, setRequiresReview] = useState(false);
  const [reviewReasons, setReviewReasons] = useState<string[]>([]);
  const [reviewTarget, setReviewTarget] = useState<ReviewTarget>("feed");
  const [savedMedicationsCount, setSavedMedicationsCount] = useState<number>(0);
  const [extractionPreview, setExtractionPreview] = useState<{
    vetName: string | null;
    date: string | null;
    clinic: string | null;
    diagnosis: string | null;
    medications: string[];
  } | null>(null);
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
      // Consultar Firestore directamente para evitar falsos positivos por estado React desactualizado
      // (puede pasar si el usuario acaba de eliminar el evento y el listener no refrescó aún).
      const hashSnap = await getDocs(
        query(collection(db, "medical_events"), where("petId", "==", activePet.id), where("fileHash", "==", fileHash))
      );
      if (!hashSnap.empty) {
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
      const analysisModel = extractionResponse.model || "unknown";
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

      // Armar preview legible de lo que se extrajo
      const mp = (aiData as Record<string, unknown>)?.masterPayload as Record<string, unknown> | undefined;
      const docInfo = mp?.document_info as Record<string, unknown> | undefined;
      setExtractionPreview({
        vetName: (docInfo?.veterinarian_name as string) || (aiData as Record<string, unknown>)?.provider as string || null,
        date: (aiData.eventDate as string) || (docInfo?.date as string) || null,
        clinic: (docInfo?.clinic_name as string) || (aiData as Record<string, unknown>)?.clinic as string || null,
        diagnosis: (aiData.diagnosis as string) || (aiData.observations as string) || null,
        medications: ((aiData.medications as Array<{ name: string }>) || []).map(m => m.name).filter(Boolean).slice(0, 3),
      });

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
        analysisModel,
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

      // Consultar Firestore directamente (no estado local) para evitar falso
      // positivo cuando el usuario acaba de eliminar el evento y el listener
      // de React aún no actualizó el array local.
      const dedupSnap = await getDocs(
        query(collection(db, "medical_events"),
          where("petId", "==", activePet.id),
          where("dedupKey", "==", newEvent.dedupKey))
      );
      if (!dedupSnap.empty) {
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
      // Guardar eventId para navegación de revisión
      if (reviewDecision.requiresManualConfirmation) {
        (window as any).__pessy_last_review_event_id = newEvent.id;
      }

      // Crear medicaciones activas detectadas en el documento cuando la extracción es confiable.
      // Se guardan con los defaults extraídos; el usuario puede editarlas luego desde MedicationsScreen.
      if (reviewDecision.shouldPersistDerivedData && aiData.medications && aiData.medications.length > 0) {
        const treatmentStart = aiData.eventDate || newEvent.createdAt;
        const baseDate = (treatmentStart || new Date().toISOString()).slice(0, 10);
        const startDate = `${baseDate}T09:00:00`;
        const treatmentType = typeMap[documentType] || "General";

        for (const med of aiData.medications) {
          const frequency = (med.frequency && med.frequency.trim()) || "Frecuencia no especificada";
          const duration = (med.duration && med.duration.trim()) || "";
          const endDate = parseDurationToEndDate(duration || null, startDate);

          const medication: ActiveMedication = {
            id: `med_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            petId: activePet.id,
            userId: user?.uid,
            name: med.name,
            dosage: med.dosage || "",
            frequency,
            type: treatmentType,
            startDate,
            endDate,
            prescribedBy: aiData.provider || null,
            generatedFromEventId: newEvent.id,
            active: true,
          };

          try {
            await addMedication(medication);
          } catch (medErr) {
            console.warn("No se pudo guardar una medicación detectada:", medErr);
          }
        }

        setSavedMedicationsCount(aiData.medications.length);
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
      if (msg.includes("formato no compatible") || msg.includes("pdf, jpg, png o webp")) {
        setProcessingStatus("Formato no compatible. Subí PDF, JPG, PNG o WEBP.");
        return;
      }
      if (msg.includes("demasiado grande") || msg.includes("8mb")) {
        setProcessingStatus("El archivo es demasiado grande para análisis en tiempo real. Probá con uno más liviano.");
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
      setSavedMedicationsCount(0);
      setExtractionPreview(null);
    }, 300);
  };

  const handleGoToReview = () => {
    const reviewParam = reviewTarget === "medications"
      ? "medications"
      : reviewTarget === "appointments"
        ? "appointments"
        : "feed";
    // Pasamos el eventId para que la pantalla destino resalte el item que necesita revisión
    const savedEventId = (window as any).__pessy_last_review_event_id || "";
    const extra = savedEventId ? `&eventId=${savedEventId}` : "";
    navigate(`/home?review=${reviewParam}${extra}`);
    handleClose();
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={handleClose}
        className="fixed inset-0 bg-black/60 z-50 animate-fadeIn"
      />

      {/* Modal */}
      <div className="fixed inset-x-0 bottom-0 z-50 bg-white dark:bg-slate-900 rounded-t-[16px] shadow-[0_2px_8px_rgba(0,0,0,0.04)] max-h-[85vh] overflow-hidden flex flex-col animate-slideUp">
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
                  <div className="mb-6 p-4 bg-[#074738]/10 border border-[#074738]/20 rounded-[16px]">
                    <div className="flex items-start gap-3">
                      <MaterialIcon name="description" className="text-[#074738] text-xl mt-0.5" />
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
                      className="w-full p-5 rounded-[14px] bg-[#074738] hover:bg-[#1a9b7d] active:scale-[0.97] transition-all flex items-center gap-4"
                    >
                      <div className="size-14 rounded-[12px] bg-white/20 flex items-center justify-center shrink-0">
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
                      className="w-full p-5 rounded-[14px] bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 hover:border-[#074738] dark:hover:border-[#074738] active:scale-[0.97] transition-all flex items-center gap-4"
                    >
                      <div className="size-14 rounded-[12px] bg-[#E0F2F1] dark:bg-slate-700 flex items-center justify-center shrink-0">
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
                  <div className="size-14 rounded-full border-4 border-slate-200 dark:border-slate-800 border-t-[#074738] animate-spin mb-6" />
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
                        className="px-3 py-1.5 rounded-full bg-[#074738]/10 text-[#074738] text-xs font-bold"
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
                  <div className={`size-24 rounded-full flex items-center justify-center mb-6 ${
                      requiresReview ? "bg-amber-500" : "bg-emerald-500"
                    }`}>
                    <MaterialIcon name={requiresReview ? "rule_folder" : "check"} className="text-white text-5xl" />
                  </div>
                  <h3 className="text-xl font-black text-slate-900 dark:text-white mb-2">
                    {requiresReview ? "Revisión requerida" : "¡Documento procesado!"}
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 text-center max-w-xs mb-1">
                    {fileName}
                  </p>
                  <div className="px-4 py-2 rounded-full bg-[#074738]/10 mb-6">
                    <p className="text-xs font-bold text-[#074738]">
                      Tipo detectado: {extractedType}
                    </p>
                  </div>
                  {/* Preview de datos extraídos */}
                  {extractionPreview && (extractionPreview.vetName || extractionPreview.date || extractionPreview.clinic || extractionPreview.diagnosis || extractionPreview.medications.length > 0) && (
                    <div className="w-full max-w-xs mb-4 rounded-[16px] bg-[#F0FAF9] border border-[rgba(7,71,56,.08)] overflow-hidden">
                      <p className="text-[10px] font-[800] text-[#1A9B7D] tracking-widest uppercase px-4 pt-3 pb-1">
                        Lo que se encontró
                      </p>
                      <div className="px-4 pb-3 flex flex-col gap-1.5">
                        {extractionPreview.vetName && (
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-[700] text-[#9CA3AF] w-16 shrink-0">Veterinario</span>
                            <span className="text-[12px] font-[600] text-[#0F172A] truncate">{extractionPreview.vetName}</span>
                          </div>
                        )}
                        {extractionPreview.date && (
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-[700] text-[#9CA3AF] w-16 shrink-0">Fecha</span>
                            <span className="text-[12px] text-[#374151]">{extractionPreview.date}</span>
                          </div>
                        )}
                        {extractionPreview.clinic && (
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-[700] text-[#9CA3AF] w-16 shrink-0">Clínica</span>
                            <span className="text-[12px] text-[#374151] truncate">{extractionPreview.clinic}</span>
                          </div>
                        )}
                        {extractionPreview.diagnosis && (
                          <div className="flex items-start gap-2">
                            <span className="text-[10px] font-[700] text-[#9CA3AF] w-16 shrink-0 pt-0.5">Hallazgo</span>
                            <span className="text-[12px] text-[#374151] line-clamp-2">{extractionPreview.diagnosis}</span>
                          </div>
                        )}
                        {extractionPreview.medications.length > 0 && (
                          <div className="flex items-start gap-2">
                            <span className="text-[10px] font-[700] text-[#9CA3AF] w-16 shrink-0 pt-0.5">Medicación</span>
                            <span className="text-[12px] text-[#374151]">{extractionPreview.medications.join(", ")}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  {savedMedicationsCount > 0 && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 text-center max-w-xs mb-4">
                      {savedMedicationsCount} medicamento{savedMedicationsCount === 1 ? "" : "s"} guardado{savedMedicationsCount === 1 ? "" : "s"} — podés editarlos en Rutinas.
                    </p>
                  )}
                  <button
                    onClick={requiresReview ? handleGoToReview : handleClose}
                    className={`px-8 py-3 rounded-[14px] text-white font-bold active:scale-[0.97] transition-all shadow-[0_4px_12px_rgba(26,155,125,0.3)] ${
                      requiresReview
                        ? "bg-amber-500 hover:bg-amber-600"
                        : "bg-[#074738] hover:bg-[#1a9b7d]"
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
                  <p className="text-xs text-red-500 text-center max-w-xs mb-2 font-mono bg-red-50 dark:bg-red-950/30 p-3 rounded-[12px] break-all">
                    {processingStatus}
                  </p>
                  <button
                    onClick={() => setUploadStage("select")}
                    className="mt-4 px-8 py-3 rounded-[14px] bg-slate-900 dark:bg-slate-800 text-white font-bold hover:bg-black dark:hover:bg-slate-700 active:scale-[0.97] transition-all"
                  >
                    Intentar de nuevo
                  </button>
                </div>
              )}
            </div>
      </div>
    </>
  );
}
