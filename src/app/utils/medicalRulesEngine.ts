import { DocumentType, ExtractedData, ExtractionConfidence } from "../types/medical";
import { parseDateSafe } from "./dateUtils";

export type ReviewTarget = "feed" | "medications" | "appointments";

export interface ReviewDecision {
  overallConfidence: number;
  requiresManualConfirmation: boolean;
  workflowStatus: "confirmed" | "review_required" | "invalid_future_date";
  reviewReasons: string[];
  reviewTarget: ReviewTarget;
  shouldPersistDerivedData: boolean;
  appointmentSuggested: boolean;
}

const confidenceToScore = (value?: ExtractionConfidence | null): number => {
  if (value === "high") return 0.95;
  if (value === "medium") return 0.8;
  if (value === "low") return 0.55;
  if (value === "not_detected") return 0.2;
  return 0.5;
};

const scoreAverage = (scores: number[]): number => {
  if (scores.length === 0) return 0;
  return scores.reduce((acc, current) => acc + current, 0) / scores.length;
};

const hasFutureEventDate = (eventDate?: string | null, now = new Date()): boolean => {
  if (!eventDate) return false;
  const parsed = parseDateSafe(eventDate);
  if (!parsed) return false;
  const today = new Date(now);
  today.setHours(23, 59, 59, 999);
  return parsed.getTime() > today.getTime();
};

const maybeLowQualityDocument = (data: ExtractedData): boolean => {
  const mergedText = [
    data.aiGeneratedSummary || "",
    data.observations || "",
    data.diagnosis || "",
  ]
    .join(" ")
    .toLowerCase();

  return (
    mergedText.includes("no se pudo identificar") ||
    mergedText.includes("imagen de baja calidad") ||
    mergedText.includes("texto borroso") ||
    mergedText.includes("información no categorizada")
  );
};

const missingCriticalFields = (docType: DocumentType, data: ExtractedData): string[] => {
  const reasons: string[] = [];
  const hasEventDate = Boolean(data.eventDate);
  const hasDetectedAppointments = Array.isArray(data.detectedAppointments) && data.detectedAppointments.length > 0;
  const hasDetectedAppointmentTime = hasDetectedAppointments
    && data.detectedAppointments.some((item) => Boolean(item.time));
  const hasProvider = Boolean(data.provider && data.provider.trim());
  const hasDiagnosisOrObs = Boolean((data.diagnosis || "").trim() || (data.observations || "").trim());

  if (!hasEventDate && !hasDetectedAppointments) {
    reasons.push("No se detectó fecha del evento con certeza.");
  }

  if ((docType === "medication" || data.medications.length > 0) && data.medications.length === 0) {
    reasons.push("Se detectó receta/tratamiento sin medicamento claramente identificado.");
  }

  if (docType === "vaccine" && !hasProvider) {
    reasons.push("Vacuna sin profesional o clínica clara.");
  }

  if ((docType === "lab_test" || docType === "xray" || docType === "checkup") && !hasDiagnosisOrObs) {
    reasons.push("Faltan hallazgos clínicos para confirmar el documento.");
  }

  if (docType === "appointment" && !data.appointmentTime && !hasDetectedAppointmentTime) {
    reasons.push("No se detectó hora del turno con certeza.");
  }

  return reasons;
};

const mentionsAppointmentSuggestion = (data: ExtractedData): boolean => {
  if (data.documentType === "appointment") return true;
  if (data.nextAppointmentDate) return true;
  if (Array.isArray(data.detectedAppointments) && data.detectedAppointments.length > 0) return true;
  const mergedText = [
    data.nextAppointmentReason || "",
    data.observations || "",
    data.aiGeneratedSummary || "",
  ]
    .join(" ")
    .toLowerCase();
  return /turno|cita|control|revisión|consulta/.test(mergedText);
};

const inferReviewTarget = (docType: DocumentType, appointmentSuggested: boolean): ReviewTarget => {
  if (docType === "medication") return "medications";
  if (appointmentSuggested) return "appointments";
  return "feed";
};

export function evaluateDocumentForReview(data: ExtractedData, now = new Date()): ReviewDecision {
  const confidenceScores = [
    confidenceToScore(data.documentTypeConfidence),
    confidenceToScore(data.eventDateConfidence),
    confidenceToScore(data.providerConfidence),
    confidenceToScore(data.diagnosisConfidence),
    confidenceToScore(data.observationsConfidence),
    ...data.medications.map((medication) => confidenceToScore(medication.confidence)),
    ...data.measurements.map((measurement) => confidenceToScore(measurement.confidence)),
  ];

  const overallConfidence = scoreAverage(confidenceScores);
  const reviewReasons: string[] = [];
  const appointmentSuggested = mentionsAppointmentSuggestion(data);
  const hasFutureDate = hasFutureEventDate(data.eventDate, now);
  const hasUnexpectedFutureDate = hasFutureDate && data.documentType !== "appointment";

  if (hasUnexpectedFutureDate) {
    const today = now.toISOString().slice(0, 10);
    reviewReasons.push(
      `La fecha detectada (${data.eventDate}) es posterior a hoy (${today}) y debe validarse manualmente.`
    );
  }

  reviewReasons.push(...missingCriticalFields(data.documentType, data));

  if (overallConfidence < 0.85) {
    reviewReasons.push("La confianza general de extracción es menor al 85%.");
  }

  if (maybeLowQualityDocument(data)) {
    reviewReasons.push("El documento parece ambiguo o de baja calidad.");
  }

  const forceAppointmentConfirmation = data.documentType === "appointment";
  if (forceAppointmentConfirmation) {
    reviewReasons.push("Detectamos un posible turno. Confirmalo antes de agregarlo a tu agenda.");
  }

  const requiresManualConfirmation = reviewReasons.length > 0;
  const workflowStatus = hasUnexpectedFutureDate
    ? "invalid_future_date"
    : requiresManualConfirmation
      ? "review_required"
      : "confirmed";

  return {
    overallConfidence,
    requiresManualConfirmation,
    workflowStatus,
    reviewReasons,
    reviewTarget: inferReviewTarget(data.documentType, appointmentSuggested),
    shouldPersistDerivedData: !requiresManualConfirmation,
    appointmentSuggested,
  };
}
