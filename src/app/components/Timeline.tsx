import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { clsx } from "clsx";
import { MaterialIcon } from "./MaterialIcon";
import { EmptyState } from "./EmptyState";
import { usePet } from "../contexts/PetContext";
import { useMedical } from "../contexts/MedicalContext";
import type { ClinicalEpisode } from "../contexts/MedicalContext";
import { MedicalEvent, DocumentType } from "../types/medical";
import { EditEventModal } from "./EditEventModal";
import { formatDateSafe, parseDateSafe, toTimestampSafe } from "../utils/dateUtils";
import { isFocusHistoryExperimentHost } from "../utils/runtimeFlags";

interface TimelineProps {
  activePet?: { name: string; photo: string };
  onExportReport?: () => void;
}

type TimelineFilter = "all" | "studies" | "diagnosis" | "vaccines" | "treatments";
type ClinicalRenderKind =
  | "appointment_confirmation"
  | "prescription"
  | "treatment_plan"
  | "imaging_report"
  | "laboratory_report"
  | "vaccination_record"
  | "clinical_report"
  | "other";

type HistoricalPeriodType = "month" | "year";

type TimelineEntry =
  | { kind: "event"; id: string; yearKey: string; timestamp: number; event: MedicalEvent }
  | {
    kind: "episode";
    id: string;
    yearKey: string;
    timestamp: number;
    periodType: HistoricalPeriodType;
    periodLabel: string;
    threadLabel: string;
    headline: string;
    narrative: string;
    diagnoses: string[];
    medications: string[];
    providers: string[];
    sourceEvents: MedicalEvent[];
    eventCount: number;
  };

interface AnnualSummaryCard {
  yearKey: string;
  headline: string;
  narrative: string;
  highlights: string[];
  eventCount: number;
}

const RECENT_HISTORY_WINDOW_DAYS = 90;
const MONTHLY_BUCKET_UNTIL_MONTHS = 18;

const FILTERS: { label: string; value: TimelineFilter }[] = [
  { label: "Todos", value: "all" },
  { label: "Estudios", value: "studies" },
  { label: "Diagnósticos", value: "diagnosis" },
  { label: "Vacunas", value: "vaccines" },
  { label: "Tratamientos", value: "treatments" },
];

const KIND_CONFIG: Record<ClinicalRenderKind, { icon: string; label: string; iconTone: string; badgeTone: string; accent: string }> = {
  appointment_confirmation: { icon: "event", label: "Turno", iconTone: "bg-[#074738]/10 text-[#074738]", badgeTone: "bg-[#074738]/10 text-[#074738]", accent: "#074738" },
  prescription: { icon: "medication", label: "Receta", iconTone: "bg-amber-100 text-amber-700", badgeTone: "bg-amber-100 text-amber-700", accent: "#d97706" },
  treatment_plan: { icon: "healing", label: "Tratamiento", iconTone: "bg-amber-100 text-amber-700", badgeTone: "bg-amber-100 text-amber-700", accent: "#d97706" },
  imaging_report: { icon: "radiology", label: "Estudio", iconTone: "bg-violet-100 text-violet-700", badgeTone: "bg-violet-100 text-violet-700", accent: "#7c3aed" },
  laboratory_report: { icon: "biotech", label: "Laboratorio", iconTone: "bg-teal-100 text-teal-700", badgeTone: "bg-teal-100 text-teal-700", accent: "#0d9488" },
  vaccination_record: { icon: "vaccines", label: "Vacuna", iconTone: "bg-emerald-100 text-emerald-600", badgeTone: "bg-emerald-100 text-emerald-700", accent: "#10b981" },
  clinical_report: { icon: "stethoscope", label: "Diagnóstico", iconTone: "bg-sky-100 text-sky-700", badgeTone: "bg-sky-100 text-sky-700", accent: "#0284c7" },
  other: { icon: "description", label: "Documento", iconTone: "bg-slate-100 text-slate-600", badgeTone: "bg-slate-100 text-slate-600", accent: "#64748b" },
};

const cleanText = (text?: unknown) => {
  const raw =
    typeof text === "string"
      ? text
      : typeof text === "number" || typeof text === "boolean"
        ? String(text)
        : "";
  return raw
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/#{1,6}\s+/g, "")
    .replace(/`{1,3}[^`]*`{1,3}/g, "")
    .replace(/\n{2,}/g, " ")
    .trim();
};

function getEventTags(isProcessing: boolean): string[] {
  const tags: string[] = [];
  if (isProcessing) tags.push("PROCESANDO");
  return tags;
}

const parseNumeric = (value: unknown): number | null => {
  const raw =
    typeof value === "string"
      ? value
      : typeof value === "number"
        ? String(value)
        : "";
  const normalized = raw.replace(",", ".").trim();
  const numeric = Number(normalized);
  return Number.isFinite(numeric) ? numeric : null;
};

const parseRange = (referenceRange: unknown): { min: number; max: number } | null => {
  if (typeof referenceRange !== "string") return null;
  const match = referenceRange.match(/(-?\d+(?:[.,]\d+)?)\s*[-a]\s*(-?\d+(?:[.,]\d+)?)/i);
  if (!match) return null;
  const min = parseNumeric(match[1]);
  const max = parseNumeric(match[2]);
  if (min == null || max == null) return null;
  return { min, max };
};

function resolveMeasurementStatus(measurement: { value: string; referenceRange: string | null }): "Fuera de rango" | "En rango" | null {
  const range = measurement.referenceRange || "";
  if (range) {
    const numericValue = parseNumeric(measurement.value);
    const parsedRange = parseRange(range);
    if (numericValue != null && parsedRange) {
      return numericValue < parsedRange.min || numericValue > parsedRange.max ? "Fuera de rango" : "En rango";
    }
  }

  const normalized = range.toLowerCase();
  if (!normalized) return null;
  if (/(alto|bajo|alterado|fuera)/.test(normalized)) return "Fuera de rango";
  if (/(normal|dentro de rango|en rango)/.test(normalized)) return "En rango";
  return null;
}

function cleanDiagnosisText(value?: string | null): string {
  const diagnosis = cleanText(value);
  return diagnosis
    .replace(/\bno_especificado\b/gi, "")
    .replace(/\b(nuevo|recurrente|persistente|leve|moderado|severo)\b/gi, "")
    .replace(/[(),]{2,}/g, ",")
    .replace(/\s+,/g, ",")
    .replace(/\s{2,}/g, " ")
    .replace(/(^[;,\s]+)|([;,\s]+$)/g, "")
    .trim();
}

function condenseClinicalSentence(value?: string | null, fallback = ""): string {
  const cleaned = cleanDiagnosisText(value || "");
  if (!cleaned) return fallback;
  const firstSentence = cleaned.split(/(?<=[.!?])\s+/)[0] || cleaned;
  return firstSentence.slice(0, 180);
}

interface AppointmentNarrativeHints {
  status: "confirmed" | "reminder" | "cancelled" | "scheduled" | null;
  reason: string | null;
  specialty: string | null;
  time: string | null;
  provider: string | null;
  clinic: string | null;
}

function stripGenericEventTitle(value: string): string {
  return cleanText(value)
    .replace(/^diagn[oó]stico detectado por correo$/i, "")
    .replace(/^turno programado$/i, "")
    .replace(/^documento cl[ií]nico(?: de .*?)?$/i, "")
    .trim();
}

function extractAppointmentNarrativeHints(event: MedicalEvent): AppointmentNarrativeHints {
  const d = getExtractedData(event);
  const appointment = d.detectedAppointments?.[0] || null;
  const sourceText = [
    d.sourceSubject,
    d.suggestedTitle,
    event.title,
    d.observations,
    d.aiGeneratedSummary,
  ]
    .filter(Boolean)
    .map((value) => cleanText(value))
    .join(" · ");

  const providerMatch = sourceText.match(/(?:dr\.?|dra\.?|doctor|doctora)\s+([A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚÑ' -]+(?:\s+[A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚÑ' -]+){0,3})/i);
  const centerMatch = sourceText.match(/centro\/profesional:\s*([^.,]+(?:\s*·\s*[^.,]+)?)/i);
  const clinicMatch = sourceText.match(/\ben\s+([A-ZÁÉÍÓÚÑ][^.,]+?)(?=\s+a\s+las|\s+con|\s+el\s+dr|\.)/i);
  const timeMatch = sourceText.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
  const specialtyMatch = sourceText.match(/\b(?:consulta|control|turno)\s+([a-záéíóúñ]+(?:\s+[a-záéíóúñ]+){0,2})/i);
  const normalized = sourceText.toLowerCase();

  let provider = cleanText(d.provider || appointment?.provider || providerMatch?.[1] || "");
  let clinic = cleanText(d.clinic || appointment?.clinic || clinicMatch?.[1] || "");

  if (centerMatch) {
    const [firstPart, secondPart] = centerMatch[1].split("·").map((item) => cleanText(item));
    if (!provider && firstPart) provider = firstPart;
    if (!clinic && secondPart) clinic = secondPart;
    if (!clinic && !provider && firstPart) clinic = firstPart;
  }

  const reason =
    stripGenericEventTitle(appointment?.title || "") ||
    stripGenericEventTitle(d.suggestedTitle || "") ||
    stripGenericEventTitle(event.title || "") ||
    stripGenericEventTitle(d.sourceSubject || "") ||
    null;

  return {
    status:
      /cancelad|reprogramad|suspendid/i.test(normalized)
        ? "cancelled"
        : /recordatorio|recorda/i.test(normalized)
          ? "reminder"
          : /confirmad/i.test(normalized)
            ? "confirmed"
            : /turno|consulta/i.test(normalized)
              ? "scheduled"
              : null,
    reason,
    specialty: cleanText(appointment?.specialty || specialtyMatch?.[1] || "") || null,
    time: cleanText(d.appointmentTime || appointment?.time || timeMatch?.[0] || "") || null,
    provider: provider || null,
    clinic: clinic || null,
  };
}

function getExtractedData(event: MedicalEvent): MedicalEvent["extractedData"] {
  const extracted = event?.extractedData;
  if (extracted && typeof extracted === "object") return extracted;
  return {} as MedicalEvent["extractedData"];
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function isSignedStorageUrl(urlValue: string): boolean {
  try {
    const parsed = new URL(urlValue);
    const q = parsed.searchParams;
    return (
      q.has("token") ||
      q.has("X-Goog-Algorithm") ||
      q.has("X-Goog-Credential") ||
      q.has("GoogleAccessId") ||
      q.has("Signature")
    );
  } catch {
    return false;
  }
}

function canOpenDocumentUrl(urlValue?: string | null): boolean {
  const normalized = typeof urlValue === "string" ? urlValue.trim() : "";
  if (!normalized) return false;
  if (!/^https?:\/\//i.test(normalized)) return false;
  if (normalized.includes("firebasestorage.googleapis.com")) {
    return isSignedStorageUrl(normalized);
  }
  return true;
}

function hasStructuredAppointmentData(event: MedicalEvent): boolean {
  const d = getExtractedData(event);
  return Boolean(
    d.appointmentTime ||
    d.detectedAppointments?.length ||
    d.masterClinical?.appointment_event?.date ||
    d.provider ||
    d.clinic
  );
}

function hasStudySignalInEvent(event: MedicalEvent): boolean {
  const d = getExtractedData(event) as unknown as Record<string, unknown>;
  const studySubtype = cleanText((d.studySubtype as string) || "");
  if (studySubtype.toLowerCase() === "imaging" || studySubtype.toLowerCase() === "lab") return true;
  const sourceText = [
    d.sourceSubject,
    d.suggestedTitle,
    d.observations,
    d.aiGeneratedSummary,
    d.diagnosis,
    event.title,
    d.studyType,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return /(radiograf|rx\b|ecograf|ultrason|ecg\b|electrocard|laboratorio|hemograma|bioquim|microscop|imagen|proyecci[oó]n|t[oó]rax|pelvis|abdomen|koh\b)/i.test(
    sourceText
  );
}

function hasMedicationSignalInEvent(event: MedicalEvent): boolean {
  const d = getExtractedData(event);
  if ((d.medications || []).length > 0) return true;
  const sourceText = [
    d.sourceSubject,
    d.suggestedTitle,
    d.observations,
    d.aiGeneratedSummary,
    d.diagnosis,
    event.title,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return /(receta|prescrip|tratamiento|medicaci[oó]n|dosis|cada\s+\d+\s*h|pimobendan|ursomax|ursomas|furosemida|omeprazol|dieta\s+[a-záéíóúñ]+)/i.test(
    sourceText
  );
}

function looksMisclassifiedAppointment(event: MedicalEvent): boolean {
  const d = getExtractedData(event) as unknown as Record<string, unknown>;
  if (d.documentType !== "appointment") return false;
  if (d.taxonomyEventType && cleanText(d.taxonomyEventType as string).startsWith("appointment_")) return false;
  if (hasStructuredAppointmentData(event) && !hasStudySignalInEvent(event) && !hasMedicationSignalInEvent(event)) return false;
  return hasStudySignalInEvent(event) || hasMedicationSignalInEvent(event);
}

function resolveClinicalRenderKind(event: MedicalEvent): ClinicalRenderKind {
  const d = getExtractedData(event);
  const masterType = d.masterClinical?.document_type;
  const appointmentHints = extractAppointmentNarrativeHints(event);
  const sourceText = [
    d.sourceSubject,
    d.suggestedTitle,
    d.observations,
    d.aiGeneratedSummary,
    d.diagnosis,
    event.title,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const looksOperationalAppointment =
    /(turno|consulta|recordatorio|confirmaci[oó]n|cancelaci[oó]n|reprogramaci[oó]n)/i.test(sourceText) &&
    !/(vacuna|hemograma|laboratorio|radiograf|ecograf|electrocard|pimobendan|amoxicilina|comprimido|dosis)/i.test(sourceText);
  const misclassifiedAppointment = looksMisclassifiedAppointment(event);

  if (misclassifiedAppointment) {
    if (hasStudySignalInEvent(event)) {
      const dR = getExtractedData(event) as unknown as Record<string, unknown>;
      return dR.documentType === "lab_test" || String(dR.studySubtype || "").toLowerCase() === "lab"
        ? "laboratory_report"
        : "imaging_report";
    }
    if (hasMedicationSignalInEvent(event)) {
      return (d.medications || []).length > 0 ? "prescription" : "treatment_plan";
    }
  }

  const hasDetectedAppointments = (d.detectedAppointments || []).length > 0;
  const hasMasterAppointment = Boolean(d.masterClinical?.appointment_event?.date);
  if (
    d.documentType === "appointment" ||
    masterType === "medical_appointment" ||
    masterType === "appointment" ||
    hasDetectedAppointments ||
    hasMasterAppointment ||
    looksOperationalAppointment ||
    appointmentHints.status !== null
  ) {
    return "appointment_confirmation";
  }

  if (d.documentType === "vaccine" || masterType === "vaccination_record") return "vaccination_record";
  if (d.documentType === "lab_test" || masterType === "laboratory_result" || masterType === "lab_result") return "laboratory_report";
  if (
    d.documentType === "xray" ||
    d.documentType === "echocardiogram" ||
    d.documentType === "electrocardiogram" ||
    (masterType === "medical_study" && /(radiograf|ecograf|ecg|electro)/i.test(sourceText))
  ) {
    return "imaging_report";
  }

  if (
    d.documentType === "medication" ||
    masterType === "prescription" ||
    /(receta|prescrip|comprimido|cada\s+\d+\s*h)/i.test(sourceText)
  ) {
    if (d.medications?.length > 0) return "prescription";
    return "treatment_plan";
  }

  if (/(plan|sesiones|tratamiento|terapia|hiperb[aá]rica)/i.test(sourceText)) return "treatment_plan";
  if (d.documentType === "checkup" || masterType === "clinical_report" || masterType === "medical_study") return "clinical_report";
  return "other";
}

function buildEventTitle(event: MedicalEvent, petName: string): string {
  const d = getExtractedData(event);
  const kind = resolveClinicalRenderKind(event);
  const cleanTitle = cleanText(event.title || d.suggestedTitle);
  const specificTitle = stripGenericEventTitle(cleanTitle);
  const firstMedication = cleanText(d.medications?.[0]?.name);
  const appointmentHints = extractAppointmentNarrativeHints(event);
  const firstAppointment = d.detectedAppointments?.[0];

  switch (kind) {
    case "appointment_confirmation":
      return `${appointmentHints.status === "cancelled"
        ? "Cancelación de turno"
        : appointmentHints.status === "reminder"
          ? "Recordatorio de turno"
          : appointmentHints.status === "confirmed"
            ? "Turno confirmado"
            : "Turno programado"
        }${cleanText(firstAppointment?.specialty || appointmentHints.specialty) ? ` · ${cleanText(firstAppointment?.specialty || appointmentHints.specialty)}` : ""}`;
    case "prescription":
      return firstMedication ? `Receta médica · ${firstMedication}` : "Receta médica";
    case "treatment_plan":
      return specificTitle || "Plan de tratamiento";
    case "imaging_report":
      if (d.documentType === "xray") return specificTitle || cleanText(d.studyType) || "Radiografía";
      if (d.documentType === "echocardiogram") return specificTitle || cleanText(d.studyType) || "Ecocardiograma";
      if (d.documentType === "electrocardiogram") return specificTitle || cleanText(d.studyType) || "Electrocardiograma";
      return specificTitle || cleanText(d.studyType) || cleanDiagnosisText(d.diagnosis) || "Informe por imágenes";
    case "laboratory_report":
      return specificTitle || cleanText(d.studyType) || "Resultado de laboratorio";
    case "vaccination_record":
      return specificTitle || "Registro de vacunación";
    case "clinical_report":
      return specificTitle || cleanDiagnosisText(d.diagnosis) || `Informe clínico de ${petName}`;
    default:
      return specificTitle || cleanText(d.studyType) || `Documento clínico de ${petName}`;
  }
}

function buildEventSummary(event: MedicalEvent, petName: string): string {
  const d = getExtractedData(event);
  const measurements = asArray<{ value: unknown; referenceRange: string | null }>(d.measurements);
  const kind = resolveClinicalRenderKind(event);
  const appointmentHints = extractAppointmentNarrativeHints(event);
  const eventDate = formatDateSafe(
    d.eventDate || event.createdAt,
    "es-AR",
    { day: "numeric", month: "long", year: "numeric" },
    "fecha no disponible"
  );
  const provider = cleanText(d.provider || appointmentHints.provider);
  const clinic = cleanText(d.clinic || appointmentHints.clinic);
  const diagnosis = cleanDiagnosisText(d.diagnosis);
  const firstMedication = d.medications?.[0];
  const detected = d.detectedAppointments?.[0] || null;
  const whoWhere = [provider, clinic].filter(Boolean).join(" · ");

  if (kind === "appointment_confirmation") {
    const time = d.appointmentTime || detected?.time || appointmentHints.time;
    const specialty = cleanText(detected?.specialty || appointmentHints.specialty || "");
    const reason = cleanText(detected?.title || appointmentHints.reason || d.suggestedTitle || "consulta veterinaria");
    const appointmentDate = formatDateSafe(
      detected?.date || d.eventDate || event.createdAt,
      "es-AR",
      { day: "numeric", month: "long", year: "numeric" },
      "fecha no disponible"
    );
    const prefix =
      appointmentHints.status === "cancelled"
        ? "Turno cancelado"
        : appointmentHints.status === "reminder"
          ? "Recordatorio de turno"
          : appointmentHints.status === "confirmed"
            ? "Turno confirmado"
            : "Turno programado";
    return `${prefix} para ${petName}: ${reason}${specialty ? ` (${specialty})` : ""}, ${appointmentDate}${time ? ` a las ${time}` : ""}${whoWhere ? `. Centro/profesional: ${whoWhere}` : ""}.`;
  }

  if (kind === "prescription") {
    if (firstMedication) {
      const dose = cleanText(firstMedication.dosage);
      const freq = cleanText(firstMedication.frequency);
      const details = [dose, freq].filter(Boolean).join(" · ");
      return `Tratamiento indicado para ${petName}: ${cleanText(firstMedication.name)}${details ? ` (${details})` : ""}. Fecha de receta: ${eventDate}${whoWhere ? `. Prescriptor: ${whoWhere}` : ""}.`;
    }
    return `Receta médica registrada para ${petName} el ${eventDate}${whoWhere ? `. Prescriptor: ${whoWhere}` : ""}.`;
  }

  if (kind === "treatment_plan") {
    const treatmentNarrative = cleanText(d.observations || d.aiGeneratedSummary);
    const narrativePrefix = d.aiGeneratedSummary && !d.observations ? "Resumen IA (no canónico): " : "";
    return `Plan terapéutico registrado el ${eventDate} para ${petName}${whoWhere ? `. Centro/profesional: ${whoWhere}` : ""}. ${narrativePrefix}${treatmentNarrative}`;
  }

  if (kind === "imaging_report") {
    const conciseDiagnosis = condenseClinicalSentence(diagnosis);
    if (conciseDiagnosis) {
      return `Hallazgo principal del ${eventDate}: ${conciseDiagnosis}${whoWhere ? `. Firmado por ${whoWhere}` : ""}.`;
    }
    return `Estudio por imágenes del ${eventDate} para ${petName}. El documento no incluye interpretación clínica explícita${whoWhere ? ` (${whoWhere})` : ""}.`;
  }

  if (kind === "laboratory_report") {
    const altered = measurements.filter((m) => resolveMeasurementStatus({ value: String(m.value ?? ""), referenceRange: m.referenceRange ?? null }) === "Fuera de rango").length;
    const total = measurements.length;
    if (total > 0) {
      return `Laboratorio del ${eventDate}: ${altered} de ${total} mediciones fuera de rango${whoWhere ? `. Laboratorio: ${whoWhere}` : ""}.`;
    }
    return `Resultado de laboratorio del ${eventDate}${whoWhere ? `. Laboratorio: ${whoWhere}` : ""}${diagnosis ? `. Interpretación: ${diagnosis}` : ""}.`;
  }

  if (kind === "vaccination_record") {
    return `Vacuna registrada para ${petName} el ${eventDate}${whoWhere ? `. Aplicada en ${whoWhere}` : ""}.`;
  }

  if (kind === "clinical_report" && diagnosis) {
    return `Hallazgo clínico del ${eventDate}: ${condenseClinicalSentence(diagnosis, diagnosis)}${whoWhere ? `. Atención en ${whoWhere}` : ""}.`;
  }

  const genericNarrative = cleanText(d.aiGeneratedSummary || d.observations);
  if (d.aiGeneratedSummary) {
    return `Resumen IA (no canónico): ${genericNarrative || `Documento clínico de ${petName} registrado el ${eventDate}.`}`;
  }
  return genericNarrative || `Documento clínico de ${petName} registrado el ${eventDate}.`;
}

function buildMetaPills(event: MedicalEvent, kind: ClinicalRenderKind): string[] {
  const d = getExtractedData(event);
  const measurements = asArray<{ value: unknown; referenceRange: string | null }>(d.measurements);
  const medications = asArray<{ frequency?: string | null; dosage?: string | null }>(d.medications);
  const appointmentHints = extractAppointmentNarrativeHints(event);
  const pills: string[] = [];
  const appointment = d.detectedAppointments?.[0] || null;
  const eventDate = formatDateSafe(
    d.eventDate || event.createdAt,
    "es-AR",
    { day: "2-digit", month: "2-digit", year: "numeric" },
    ""
  );

  if (kind === "appointment_confirmation") {
    const time = d.appointmentTime || appointment?.time || appointmentHints.time;
    const specialty = cleanText(appointment?.specialty || appointmentHints.specialty);
    if (eventDate) pills.push(eventDate);
    if (time) pills.push(time);
    if (specialty) pills.push(specialty);
    if (!specialty && appointmentHints.status === "cancelled") pills.push("Cancelado");
    return pills.slice(0, 3);
  }

  if (kind === "prescription") {
    const first = medications[0];
    if (first?.frequency) pills.push(cleanText(first.frequency));
    if (first?.dosage) pills.push(cleanText(first.dosage));
    if (d.provider) pills.push(cleanText(d.provider));
    return pills.slice(0, 3);
  }

  if (kind === "laboratory_report") {
    const total = measurements.length;
    if (total > 0) {
      const altered = measurements.filter((m) =>
        resolveMeasurementStatus({ value: String(m.value ?? ""), referenceRange: m.referenceRange ?? null }) === "Fuera de rango"
      ).length;
      pills.push(`${altered}/${total} fuera de rango`);
    }
    if (d.provider) pills.push(cleanText(d.provider));
    return pills.slice(0, 3);
  }

  if (kind === "imaging_report") {
    pills.push(d.provider ? "Informe firmado" : "Sin firma clínica");
    if (d.provider) pills.push(cleanText(d.provider));
    return pills.slice(0, 3);
  }

  if (kind === "vaccination_record") {
    if (d.nextAppointmentDate) {
      pills.push(
        `Revacunación ${formatDateSafe(
          d.nextAppointmentDate,
          "es-AR",
          { day: "2-digit", month: "2-digit", year: "numeric" },
          ""
        )}`
      );
    }
    if (d.provider) pills.push(cleanText(d.provider));
    return pills.slice(0, 3);
  }

  if (kind === "treatment_plan") {
    if (medications.length) pills.push(`${medications.length} indicación(es)`);
    if (d.provider) pills.push(cleanText(d.provider));
    return pills.slice(0, 3);
  }

  if (d.provider) pills.push(cleanText(d.provider));
  if (eventDate) pills.push(eventDate);
  return pills.slice(0, 3);
}

function buildSourceOriginPill(event: MedicalEvent): string | null {
  const d = getExtractedData(event) as unknown as Record<string, unknown>;
  if (d.sourceSender || d.sourceSubject || d.sourceStorageSignedUrl || d.sourceFileName) return "Correo";
  if (event.fileName || event.documentUrl) return "Escaneo";
  return null;
}

function formatEventDate(event: MedicalEvent): string {
  const d = getExtractedData(event);
  const dateStr = d.eventDate || event.createdAt;
  const isFromScan = !d.eventDate;
  const formatted = formatDateSafe(
    dateStr,
    "es-AR",
    { day: "numeric", month: "short", year: "numeric" },
    "Sin fecha"
  );
  return isFromScan ? `${formatted} · escaneo` : formatted;
}

function buildFlowLabel(event: MedicalEvent): string {
  const source = getExtractedData(event) || {};
  const isEmailFlow = Boolean(
    source.sourceSender ||
    source.sourceReceivedAt ||
    source.sourceSubject ||
    source.sourceFileName
  );
  if (isEmailFlow) return "Flujo: sincronización por correo";
  if (event.requiresManualConfirmation || event.workflowStatus === "review_required" || event.status === "draft") {
    return "Flujo: escáner + revisión manual";
  }
  return "Flujo: escáner de documento";
}

const normalizeReviewReason = (value?: string | null) =>
  (value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

function hasIncompleteTreatmentData(event: MedicalEvent): boolean {
  const extracted = getExtractedData(event);
  if (extracted?.treatmentValidationStatus === "needs_review") return true;
  if ((extracted?.treatmentMissingFields || []).length > 0) return true;
  const reasons = event.reviewReasons || [];
  return reasons.some((reason) => {
    const normalized = normalizeReviewReason(reason);
    return normalized.includes("missing_treatment_dose_or_frequency") || normalized.includes("incomplete_data");
  });
}

function getReviewReasonCopy(event: MedicalEvent): string {
  if (hasIncompleteTreatmentData(event)) {
    return "Detectamos medicación sin dosis o frecuencia completa. Pessy bloqueó la activación del tratamiento hasta que lo confirmes.";
  }
  return event.reviewReasons?.[0] || "Este evento quedó para revisión manual antes de consolidarlo.";
}

function matchesFilter(event: MedicalEvent, filter: TimelineFilter): boolean {
  const type = (getExtractedData(event).documentType || "other") as DocumentType;
  const kind = resolveClinicalRenderKind(event);
  if (filter === "all") return true;
  if (filter === "studies") return kind === "laboratory_report" || kind === "imaging_report";
  if (filter === "diagnosis") return kind === "clinical_report" || type === "surgery";
  if (filter === "vaccines") return kind === "vaccination_record";
  if (filter === "treatments") return kind === "prescription" || kind === "treatment_plan";
  return true;
}

function getYearKey(event: MedicalEvent): string {
  const raw = getExtractedData(event)?.eventDate || event.createdAt;
  const parsed = parseDateSafe(raw);
  return parsed ? String(parsed.getFullYear()) : "Sin año";
}

function getEventTimestamp(event: MedicalEvent): number {
  return toTimestampSafe(getExtractedData(event)?.eventDate || event.createdAt);
}

function isEmailOriginEvent(event: MedicalEvent): boolean {
  const d = getExtractedData(event);
  return Boolean(d.sourceSender || d.sourceSubject || d.sourceReceivedAt || d.sourceFileName);
}

function monthsFromNow(timestamp: number, nowTimestamp: number): number {
  const current = new Date(nowTimestamp);
  const target = new Date(timestamp);
  return Math.max(
    0,
    (current.getFullYear() - target.getFullYear()) * 12 + (current.getMonth() - target.getMonth())
  );
}

function capitalizeSpanish(value: string): string {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function buildHistoricalPeriodMeta(timestamp: number, nowTimestamp: number): {
  periodType: HistoricalPeriodType;
  periodKey: string;
  periodLabel: string;
  yearKey: string;
} {
  const parsed = new Date(timestamp);
  const monthsAgo = monthsFromNow(timestamp, nowTimestamp);
  const yearKey = String(parsed.getFullYear());
  if (monthsAgo > MONTHLY_BUCKET_UNTIL_MONTHS) {
    return {
      periodType: "year",
      periodKey: yearKey,
      periodLabel: yearKey,
      yearKey,
    };
  }

  const monthKey = `${yearKey}-${String(parsed.getMonth() + 1).padStart(2, "0")}`;
  return {
    periodType: "month",
    periodKey: monthKey,
    periodLabel: capitalizeSpanish(
      parsed.toLocaleDateString("es-AR", { month: "long", year: "numeric" })
    ),
    yearKey,
  };
}

function buildEpisodeThreadLabel(event: MedicalEvent): string {
  const d = getExtractedData(event);
  const kind = resolveClinicalRenderKind(event);
  const diagnosis = cleanDiagnosisText(d.diagnosis);
  const medicationNames = asArray<{ name?: unknown }>(d.medications)
    .map((med) => cleanText(med.name))
    .filter(Boolean);
  const specialty = cleanText(d.detectedAppointments?.[0]?.specialty || d.nextAppointmentReason || "");
  const topic = cleanText(d.linkedConditionLabel || d.topicTags?.[0] || d.systemTags?.[0] || d.studyType || "");

  if (d.linkedEpisodeKey) return cleanText(d.linkedEpisodeKey);
  if (kind === "vaccination_record") return "Vacunación";
  if (kind === "appointment_confirmation") return specialty || "Agenda veterinaria";
  if ((kind === "prescription" || kind === "treatment_plan") && medicationNames.length > 0) {
    return medicationNames.slice(0, 2).join(" · ");
  }
  if (diagnosis) return diagnosis;
  if (topic) return topic;
  if (kind === "imaging_report") return "Estudios por imágenes";
  if (kind === "laboratory_report") return "Laboratorio";
  if (kind === "clinical_report") return "Seguimiento clínico";
  return KIND_CONFIG[kind]?.label || "Resumen histórico";
}

function buildHistoricalNarrative(events: MedicalEvent[], petName: string, periodLabel: string): {
  headline: string;
  narrative: string;
  diagnoses: string[];
  medications: string[];
  providers: string[];
} {
  const diagnoses = Array.from(
    new Set(
      events
        .map((event) => cleanDiagnosisText(getExtractedData(event).diagnosis))
        .filter(Boolean)
    )
  ).slice(0, 3);

  const medications = Array.from(
    new Set(
      events.flatMap((event) =>
        asArray<{ name?: unknown }>(getExtractedData(event).medications)
          .map((med) => cleanText(med.name))
          .filter(Boolean)
      )
    )
  ).slice(0, 3);

  const providers = Array.from(
    new Set(
      events.flatMap((event) => {
        const d = getExtractedData(event);
        return [cleanText(d.provider), cleanText(d.clinic)].filter(Boolean);
      })
    )
  ).slice(0, 2);

  const kindCounts = events.reduce<Record<ClinicalRenderKind, number>>((acc, event) => {
    const kind = resolveClinicalRenderKind(event);
    acc[kind] = (acc[kind] || 0) + 1;
    return acc;
  }, {} as Record<ClinicalRenderKind, number>);

  const imagingCount = (kindCounts.imaging_report || 0) + (kindCounts.laboratory_report || 0);
  const appointmentCount = kindCounts.appointment_confirmation || 0;
  const vaccineCount = kindCounts.vaccination_record || 0;
  const treatmentCount = (kindCounts.prescription || 0) + (kindCounts.treatment_plan || 0);
  const dominantLabel =
    diagnoses[0] ||
    (imagingCount > 0 ? "estudios y controles" : "") ||
    (medications[0] ? "tratamiento crónico" : "") ||
    (vaccineCount > 0 ? "seguimiento preventivo" : "") ||
    (appointmentCount > 0 ? "actividad veterinaria" : "") ||
    "seguimiento clínico";

  const firstSentence = diagnoses.length > 0
    ? `En ${periodLabel} ${petName} tuvo seguimiento por ${diagnoses.join(", ")}.`
    : imagingCount > 0
      ? `En ${periodLabel} ${petName} tuvo ${imagingCount} estudio${imagingCount > 1 ? "s" : ""} y controles asociados.`
      : treatmentCount > 0
        ? `En ${periodLabel} ${petName} tuvo continuidad terapéutica y seguimiento clínico.`
        : vaccineCount > 0
          ? `En ${periodLabel} ${petName} tuvo actividad preventiva y control veterinario.`
          : `En ${periodLabel} ${petName} tuvo actividad veterinaria registrada por correo.`;

  const extraSentences = [
    medications.length > 0 ? `También estuvo medicado con ${medications.join(", ")}.` : "",
    appointmentCount > 0 && diagnoses.length === 0 ? `Se registraron ${appointmentCount} turno${appointmentCount > 1 ? "s" : ""} o recordatorio${appointmentCount > 1 ? "s" : ""}.` : "",
    providers.length > 0 ? `Intervinieron ${providers.join(" · ")}.` : "",
  ].filter(Boolean);

  return {
    headline: capitalizeSpanish(dominantLabel),
    narrative: [firstSentence, ...extraSentences].slice(0, 3).join(" "),
    diagnoses,
    medications,
    providers,
  };
}

function buildAnnualSummary(events: MedicalEvent[], petName: string, yearKey: string): AnnualSummaryCard {
  const diagnoses = Array.from(
    new Set(
      events
        .map((event) => cleanDiagnosisText(getExtractedData(event).diagnosis))
        .filter(Boolean)
    )
  ).slice(0, 3);

  const medications = Array.from(
    new Set(
      events.flatMap((event) =>
        asArray<{ name?: unknown }>(getExtractedData(event).medications)
          .map((med) => cleanText(med.name))
          .filter(Boolean)
      )
    )
  ).slice(0, 3);

  const providers = Array.from(
    new Set(
      events.flatMap((event) => {
        const d = getExtractedData(event);
        return [cleanText(d.provider), cleanText(d.clinic)].filter(Boolean);
      })
    )
  ).slice(0, 2);

  const appointmentEvents = events.filter((event) => resolveClinicalRenderKind(event) === "appointment_confirmation").length;
  const imagingEvents = events.filter((event) => {
    const kind = resolveClinicalRenderKind(event);
    return kind === "imaging_report" || kind === "laboratory_report";
  }).length;
  const dominantProblem =
    diagnoses[0] ||
    medications[0] ||
    (imagingEvents > 0 ? "estudios y controles" : "") ||
    (appointmentEvents > 0 ? "seguimiento veterinario" : "") ||
    "actividad clínica registrada";
  const dominantProvider = providers[0] || "prestadores habituales";

  return {
    yearKey,
    headline: `Anuario ${yearKey}`,
    narrative: [
      `Durante ${yearKey}, ${petName} tuvo principalmente ${dominantProblem}.`,
      `La atención se concentró en ${dominantProvider}.`,
      medications[0]
        ? `La medicación más repetida fue ${medications[0]}.`
        : appointmentEvents > 0
          ? `Se registraron ${appointmentEvents} turno${appointmentEvents === 1 ? "" : "s"} o recordatorio${appointmentEvents === 1 ? "" : "s"} en el período.`
          : "",
    ]
      .filter(Boolean)
      .slice(0, 3)
      .join(" "),
    highlights: [
      diagnoses[0] ? `Patología principal: ${diagnoses[0]}` : "",
      medications[0] ? `Medicación relevante: ${medications[0]}` : "",
      imagingEvents > 0 ? `${imagingEvents} estudio${imagingEvents === 1 ? "" : "s"} registrados` : "",
    ].filter(Boolean),
    eventCount: events.length,
  };
}

export function Timeline({ activePet, onExportReport }: TimelineProps) {
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [activeFilter, setActiveFilter] = useState<TimelineFilter>("all");
  const [showEditModal, setShowEditModal] = useState(false);
  const [eventToEdit, setEventToEdit] = useState<MedicalEvent | null>(null);
  const [eventToDelete, setEventToDelete] = useState<MedicalEvent | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirmingEventId, setConfirmingEventId] = useState<string | null>(null);
  const [deletingEventId, setDeletingEventId] = useState<string | null>(null);

  const { activePetId } = usePet();
  const { getEventsByPetId, confirmEvent, deleteEvent, getClinicalEpisodesByPetId } = useMedical();
  const historicalEpisodesEnabled = isFocusHistoryExperimentHost();

  const allEvents = getEventsByPetId(activePetId);

  const filteredSortedEvents = useMemo(
    () =>
      [...allEvents]
        .filter((event) => matchesFilter(event, activeFilter))
        .sort((a, b) => {
          const da = toTimestampSafe(getExtractedData(a)?.eventDate || a.createdAt);
          const db = toTimestampSafe(getExtractedData(b)?.eventDate || b.createdAt);
          return db - da;
        }),
    [allEvents, activeFilter]
  );


  // ─── Mapeo de episodeType a etiqueta en español ────────────────────────────────
  const episodeTypeToThreadLabel = (ep: ClinicalEpisode): string => {
    const typeMap: Record<string, string> = {
      consultation: "Consulta clínica",
      vaccination: "Vacunación",
      prescription: "Receta / Tratamiento",
      appointment: "Turno veterinario",
      study: "Estudio por imágenes",
      laboratory: "Laboratorio",
      mixed: "Acto clínico mixto",
    };
    const base = typeMap[ep.episodeType] ?? "Episodio clínico";
    if (ep.provider?.specialty) return `${base} – ${ep.provider.specialty}`;
    return base;
  };

  const timelineEntries = useMemo(() => {
    if (!historicalEpisodesEnabled) {
      return filteredSortedEvents.map<TimelineEntry>((event) => ({
        kind: "event",
        id: event.id,
        yearKey: getYearKey(event),
        timestamp: getEventTimestamp(event),
        event,
      }));
    }

    const recentCutoff = Date.now() - RECENT_HISTORY_WINDOW_DAYS * 86400000;
    const entries: TimelineEntry[] = [];

    // Zona activa (≤90 días): mostrar medical_events crudos individuales
    for (const event of filteredSortedEvents) {
      const timestamp = getEventTimestamp(event);
      if (timestamp < recentCutoff) continue; // los históricos los manejamos desde Firestore
      if (
        event.status === "processing" ||
        event.status === "draft" ||
        event.workflowStatus === "review_required" ||
        event.workflowStatus === "invalid_future_date" ||
        event.requiresManualConfirmation
      ) {
        // Solo mostrar en activo si necesita acción del usuario
      }
      entries.push({
        kind: "event",
        id: event.id,
        yearKey: getYearKey(event),
        timestamp,
        event,
      });
    }

    // Zona histórica (>90 días): usar clinical_episodes baked de Firestore
    const firestoreEpisodes = getClinicalEpisodesByPetId(activePetId);
    for (const ep of firestoreEpisodes) {
      const timestamp = new Date(ep.date).getTime();
      if (timestamp >= recentCutoff) continue; // ya aparece en zona activa si es reciente

      const periodMeta = buildHistoricalPeriodMeta(timestamp, Date.now());
      const threadLabel = episodeTypeToThreadLabel(ep);

      entries.push({
        kind: "episode",
        id: ep.id,
        yearKey: periodMeta.yearKey,
        timestamp,
        periodType: periodMeta.periodType,
        periodLabel: periodMeta.periodLabel,
        threadLabel,
        headline: ep.headline,
        narrative: ep.summary,
        diagnoses: ep.diagnoses,
        medications: ep.medications.map((m) => m.name),
        providers: [ep.provider?.name, ep.provider?.clinic].filter(Boolean) as string[],
        sourceEvents: [], // los source events no se necesitan para la vista baked
        eventCount: ep.sourceEventIds.length || 1,
      });
    }

    return entries.sort((a, b) => b.timestamp - a.timestamp);
  }, [filteredSortedEvents, historicalEpisodesEnabled, activePetId, getClinicalEpisodesByPetId]);

  const displayedEntries = showAll ? timelineEntries : timelineEntries.slice(0, 8);
  const visibleEntryCount = historicalEpisodesEnabled ? timelineEntries.length : filteredSortedEvents.length;

  const groupedByYear = useMemo(() => {
    const map = new Map<string, TimelineEntry[]>();
    for (const entry of displayedEntries) {
      const year = entry.yearKey;
      if (!map.has(year)) map.set(year, []);
      map.get(year)!.push(entry);
    }
    return [...map.entries()];
  }, [displayedEntries]);

  const annualSummaryByYear = useMemo(() => {
    if (!historicalEpisodesEnabled) return new Map<string, AnnualSummaryCard>();
    const recentCutoff = Date.now() - RECENT_HISTORY_WINDOW_DAYS * 86400000;
    const petName = cleanText(activePet?.name) || "tu mascota";
    const groupedEvents = new Map<string, MedicalEvent[]>();

    for (const entry of timelineEntries) {
      if (entry.timestamp >= recentCutoff) continue;
      const sourceEvents = entry.kind === "episode" ? entry.sourceEvents : [entry.event];
      if (!groupedEvents.has(entry.yearKey)) groupedEvents.set(entry.yearKey, []);
      groupedEvents.get(entry.yearKey)!.push(...sourceEvents);
    }

    const summaries = new Map<string, AnnualSummaryCard>();
    for (const [yearKey, events] of groupedEvents.entries()) {
      if (events.length === 0) continue;
      summaries.set(yearKey, buildAnnualSummary(events, petName, yearKey));
    }
    return summaries;
  }, [activePet?.name, historicalEpisodesEnabled, timelineEntries]);

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
          <MaterialIcon name="timeline" className="text-[#074738] text-xl" />
          Historial Médico
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onExportReport?.()}
            className="size-9 rounded-full bg-[#074738]/10 flex items-center justify-center hover:bg-[#074738]/20 transition-colors"
            title="Exportar Reporte"
          >
            <MaterialIcon name="description" className="text-[#074738] text-lg" />
          </button>
          {visibleEntryCount > 8 && (
            <button
              onClick={() => setShowAll(!showAll)}
              className="text-xs font-bold text-[#074738] hover:underline"
            >
              {showAll ? "Ver menos" : `Ver todo (${visibleEntryCount})`}
            </button>
          )}
        </div>
      </div>

      {allEvents.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-2 mb-4 overflow-x-auto no-scrollbar">
          <div className="flex gap-2 min-w-max">
            {FILTERS.map((filter) => (
              <button
                key={filter.value}
                onClick={() => {
                  setActiveFilter(filter.value);
                  setShowAll(false);
                }}
                className={clsx(
                  "px-3 py-2 rounded-xl text-[11px] font-black uppercase tracking-wide whitespace-nowrap transition-all",
                  activeFilter === filter.value
                    ? "bg-[#074738] text-white shadow-lg shadow-[#074738]/25"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                )}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {actionError && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2">
          <p className="text-xs font-semibold text-red-700">{actionError}</p>
        </div>
      )}

      {filteredSortedEvents.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
          <EmptyState
            icon="inbox"
            title={allEvents.length === 0 ? "Sin eventos médicos" : "Sin resultados para este filtro"}
            description={
              allEvents.length === 0
                ? "Los documentos que subas aparecerán aquí automáticamente"
                : "Probá con otro filtro para ver más eventos"
            }
            illustration="medical"
          />
        </div>
      ) : (
        <div className="space-y-8">
          {groupedByYear.map(([year, events], groupIndex) => (
            <div key={year} className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-px bg-slate-200 dark:bg-slate-800 flex-1" />
                <p className="text-[10px] font-black uppercase tracking-[0.35em] text-slate-400">{year}</p>
                <div className="h-px bg-slate-200 dark:bg-slate-800 flex-1" />
              </div>

              <div className="space-y-3">
                {historicalEpisodesEnabled && annualSummaryByYear.has(year) && (
                  <div className="rounded-[24px] border border-[#074738]/15 bg-[#074738]/5 p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-wide text-[#074738]">Memoria clínica</p>
                        <h3 className="text-[15px] font-black text-slate-900 mt-1">
                          {annualSummaryByYear.get(year)!.headline}
                        </h3>
                      </div>
                      <span className="text-[10px] font-semibold px-2 py-1 rounded-full bg-white text-[#074738]">
                        {annualSummaryByYear.get(year)!.eventCount} eventos
                      </span>
                    </div>

                    <p className="text-xs text-slate-700 mt-2 leading-relaxed">
                      {annualSummaryByYear.get(year)!.narrative}
                    </p>

                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {annualSummaryByYear.get(year)!.highlights.map((highlight, idx) => (
                        <span
                          key={`${year}-annual-highlight-${idx}`}
                          className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white text-slate-600 border border-[#074738]/10"
                        >
                          {highlight}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {events.map((entry, index) => {
                  if (entry.kind === "episode") {
                    const isExpanded = expandedEvent === entry.id;
                    const episodeTone = entry.periodType === "year"
                      ? "bg-[#074738]/5 border-[#074738]/15"
                      : "bg-white/90 border-slate-200/70";

                    return (
                      <motion.div
                        key={entry.id}
                        layout
                        initial={{ y: 18, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: (groupIndex * 0.04) + (index * 0.03) }}
                      >
                        <button
                          onClick={() => setExpandedEvent(isExpanded ? null : entry.id)}
                          className="w-full text-left"
                        >
                          <div className="flex gap-3 items-start">
                            <div className="size-14 rounded-full flex items-center justify-center shrink-0 border-4 border-white shadow-sm bg-[#074738]/10 text-[#074738]">
                              <MaterialIcon name="auto_stories" className="text-[28px]" />
                            </div>

                            <div className={clsx("flex-1 backdrop-blur-sm rounded-[24px] border shadow-sm overflow-hidden hover:shadow-md transition-shadow", episodeTone)}>
                              <div className="h-1 bg-[#074738]" />

                              <div className="p-4">
                                <div className="flex items-start justify-between gap-2 mb-2">
                                  <div>
                                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                                      {entry.periodLabel}
                                    </p>
                                    <p className="text-[10px] font-bold uppercase tracking-wide text-[#074738] mt-1">
                                      Vista derivada del historial
                                    </p>
                                  </div>
                                  <span className="px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider bg-[#074738]/10 text-[#074738]">
                                    {entry.eventCount} evento{entry.eventCount === 1 ? "" : "s"}
                                  </span>
                                </div>

                                <h3 className="text-[15px] font-black text-slate-900 dark:text-white leading-tight mb-1">
                                  {entry.headline}
                                </h3>

                                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-1.5">
                                  {entry.threadLabel}
                                </p>

                                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed line-clamp-3">
                                  {entry.narrative}
                                </p>

                                <div className="flex gap-1.5 flex-wrap mt-3">
                                  {entry.diagnoses.map((diagnosis, chipIndex) => (
                                    <span
                                      key={`${entry.id}-diagnosis-${chipIndex}`}
                                      className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-sky-100 text-sky-700"
                                    >
                                      {diagnosis}
                                    </span>
                                  ))}
                                  {entry.medications.map((medication, chipIndex) => (
                                    <span
                                      key={`${entry.id}-medication-${chipIndex}`}
                                      className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700"
                                    >
                                      {medication}
                                    </span>
                                  ))}
                                  {entry.providers.map((provider, chipIndex) => (
                                    <span
                                      key={`${entry.id}-provider-${chipIndex}`}
                                      className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600"
                                    >
                                      {provider}
                                    </span>
                                  ))}
                                </div>

                                <div className="flex items-center justify-between mt-3">
                                  <div className="flex flex-wrap gap-1.5">
                                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#074738]/10 text-[#074738]">
                                      {entry.periodType === "year" ? "Resumen anual" : "Resumen mensual"}
                                    </span>
                                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                                      Historial confirmado
                                    </span>
                                  </div>
                                  <MaterialIcon
                                    name={isExpanded ? "expand_less" : "expand_more"}
                                    className="text-slate-400 text-lg shrink-0"
                                  />
                                </div>
                              </div>

                              <AnimatePresence>
                                {isExpanded && (
                                  <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: "auto", opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.2 }}
                                    className="overflow-hidden"
                                  >
                                    <div className="border-t border-slate-100 dark:border-slate-800 px-4 py-3 space-y-3">
                                      <div className="rounded-xl border border-[#074738]/15 bg-[#074738]/5 px-3 py-2.5">
                                        <p className="text-[10px] font-black uppercase tracking-wide text-[#074738] mb-1">
                                          Regla de lectura
                                        </p>
                                        <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                                          Este bloque resume eventos históricos confirmados para hacer legible la vida clínica de la mascota. Los eventos originales siguen siendo la fuente canónica.
                                        </p>
                                      </div>

                                      <div>
                                        <p className="text-[10px] font-black uppercase tracking-wide text-slate-400 mb-2">
                                          Eventos originales
                                        </p>
                                        <div className="space-y-2">
                                          {entry.sourceEvents.map((sourceEvent) => {
                                            const sourceKind = resolveClinicalRenderKind(sourceEvent);
                                            const sourceCfg = KIND_CONFIG[sourceKind] || KIND_CONFIG.other;
                                            const petName = cleanText(activePet?.name) || "la mascota";

                                            return (
                                              <div
                                                key={`${entry.id}-${sourceEvent.id}`}
                                                className="rounded-xl border border-slate-200 bg-white px-3 py-2.5"
                                              >
                                                <div className="flex items-start justify-between gap-3">
                                                  <div>
                                                    <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">
                                                      {formatEventDate(sourceEvent)}
                                                    </p>
                                                    <p className="text-xs font-bold text-slate-900 mt-1">
                                                      {buildEventTitle(sourceEvent, petName)}
                                                    </p>
                                                    <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">
                                                      {buildEventSummary(sourceEvent, petName)}
                                                    </p>
                                                  </div>
                                                  <span className={clsx(
                                                    "px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-wide shrink-0",
                                                    sourceCfg.badgeTone
                                                  )}>
                                                    {sourceCfg.label}
                                                  </span>
                                                </div>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          </div>
                        </button>
                      </motion.div>
                    );
                  }

                  const event = entry.event;
                  const isExpanded = expandedEvent === event.id;
                  const isProcessing = event.status === "processing";
                  const isUnderReview =
                    event.requiresManualConfirmation ||
                    event.workflowStatus === "review_required" ||
                    event.workflowStatus === "invalid_future_date" ||
                    event.status === "draft";
                  const isIncompleteTreatmentReview = isUnderReview && hasIncompleteTreatmentData(event);
                  const renderKind = resolveClinicalRenderKind(event);
                  const cfg = KIND_CONFIG[renderKind] || KIND_CONFIG.other;
                  const d = getExtractedData(event);
                  const petName = cleanText(activePet?.name) || "la mascota";
                  const summary = buildEventSummary(event, petName);
                  const metaPills = buildMetaPills(event, renderKind);
                  const documentUrl =
                    (typeof event.documentUrl === "string" ? event.documentUrl.trim() : "") ||
                    (typeof (d as unknown as Record<string, unknown>).sourceStorageSignedUrl === "string" ? ((d as unknown as Record<string, unknown>).sourceStorageSignedUrl as string).trim() : "");
                  const canOpenDocument = canOpenDocumentUrl(documentUrl);
                  const medications = asArray<{ name?: unknown; dosage?: unknown; frequency?: unknown }>(d.medications);
                  const measurements = asArray<{ name?: unknown; value?: unknown; unit?: unknown; referenceRange?: string | null }>(d.measurements);
                  const sourceOriginPill = buildSourceOriginPill(event);
                  const badgeText = isProcessing
                    ? "Procesando"
                    : isIncompleteTreatmentReview
                      ? "Datos incompletos"
                      : isUnderReview
                        ? "Por revisar"
                        : cfg.label;
                  const badgeTone = isIncompleteTreatmentReview
                    ? "bg-red-100 text-red-700 border border-red-200"
                    : isUnderReview
                      ? "bg-slate-100 text-slate-600 border border-slate-200"
                      : cfg.badgeTone;

                  const sourceTruth = (event as unknown as Record<string, unknown>).sourceTruthLevel as string | undefined;
                  const validatedByHuman = (event as unknown as Record<string, unknown>).validatedByHuman === true;
                  const sourceOriginBadge: { label: string; tone: string } | null =
                    isUnderReview
                      ? null
                      : validatedByHuman || sourceTruth === "human_confirmed" || sourceTruth === "user_curated"
                        ? { label: "✓ Confirmado", tone: "bg-emerald-50 text-emerald-700 border border-emerald-200" }
                        : null;

                  return (
                    <motion.div
                      key={event.id}
                      layout
                      initial={{ y: 18, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: (groupIndex * 0.04) + (index * 0.03) }}
                    >
                      <button
                        onClick={() => setExpandedEvent(isExpanded ? null : event.id)}
                        className="w-full text-left"
                      >
                        <div className="flex gap-3 items-start">
                          <div className={clsx("size-14 rounded-full flex items-center justify-center shrink-0 border-4 border-white shadow-sm", cfg.iconTone)}>
                            <MaterialIcon
                              name={isProcessing ? "sync" : cfg.icon}
                              className={clsx("text-[28px]", isProcessing && "animate-spin")}
                            />
                          </div>

                          <div className="flex-1 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm rounded-[24px] border border-slate-200/70 dark:border-slate-800/70 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                            <div className="h-1" style={{ backgroundColor: isProcessing ? "#074738" : isIncompleteTreatmentReview ? "#dc2626" : cfg.accent }} />

                            <div className="p-4">
                              <div className="flex items-start justify-between gap-2 mb-2">
                                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{formatEventDate(event)}</p>
                                <span className={clsx(
                                  "px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider",
                                  badgeTone
                                )}>
                                  {badgeText}
                                </span>
                              </div>

                              <h3 className="text-[15px] font-black text-slate-900 dark:text-white leading-tight mb-1.5">
                                {buildEventTitle(event, petName)}
                              </h3>

                              {summary && (
                                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed line-clamp-2">
                                  {summary}
                                </p>
                              )}

                              <div className="flex gap-1.5 flex-wrap mt-2">
                                {metaPills.map((pill, idx) => (
                                  <span
                                    key={`${event.id}-meta-${idx}`}
                                    className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-300"
                                  >
                                    {pill}
                                  </span>
                                ))}
                                {sourceOriginPill && (
                                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#074738]/10 text-[#074738]">
                                    {sourceOriginPill}
                                  </span>
                                )}
                                {getEventTags(isProcessing).map((tag) => (
                                  <span
                                    key={`${event.id}-${tag}`}
                                    className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-[#074738]/10 text-[#074738]"
                                  >
                                    {tag}
                                  </span>
                                ))}
                              </div>

                              {/* Badge de origen de dato */}
                              {sourceOriginBadge && (
                                <div className="mt-2">
                                  <span className={clsx(
                                    "text-[9px] font-black uppercase tracking-wide px-2 py-0.5 rounded-full",
                                    sourceOriginBadge.tone
                                  )}>
                                    {sourceOriginBadge.label}
                                  </span>
                                </div>
                              )}

                              <div className="flex items-center justify-between mt-2">
                                <div className="flex flex-wrap gap-1.5">
                                  {medications.length > 0 && (
                                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                                      {medications.length} trat.
                                    </span>
                                  )}
                                  {measurements.length > 0 && (
                                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-teal-100 text-teal-700">
                                      {measurements.length} vals.
                                    </span>
                                  )}
                                  {d.nextAppointmentDate && (
                                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#074738]/10 text-[#074738]">
                                      Próx. turno
                                    </span>
                                  )}
                                </div>
                                <MaterialIcon
                                  name={isExpanded ? "expand_less" : "expand_more"}
                                  className="text-slate-400 text-lg shrink-0"
                                />
                              </div>
                            </div>

                            <AnimatePresence>
                              {isExpanded && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: "auto", opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  transition={{ duration: 0.2 }}
                                  className="overflow-hidden"
                                >
                                  <div className="border-t border-slate-100 dark:border-slate-800 px-4 py-3 space-y-3">
                                    {isUnderReview && (
                                      <div className={clsx(
                                        "rounded-xl p-3",
                                        isIncompleteTreatmentReview
                                          ? "bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/40"
                                          : "bg-slate-50 dark:bg-slate-800"
                                      )}>
                                        <p className={clsx(
                                          "text-[10px] font-black uppercase tracking-wide mb-1",
                                          isIncompleteTreatmentReview ? "text-red-700 dark:text-red-300" : "text-slate-500"
                                        )}>
                                          {isIncompleteTreatmentReview ? "Tratamiento bloqueado" : "Pendiente de revisión"}
                                        </p>
                                        <p className={clsx(
                                          "text-xs leading-relaxed",
                                          isIncompleteTreatmentReview ? "text-red-700 dark:text-red-200" : "text-slate-700 dark:text-slate-300"
                                        )}>
                                          {getReviewReasonCopy(event)}
                                        </p>
                                      </div>
                                    )}

                                    {d.diagnosis && renderKind !== "appointment_confirmation" && (
                                      <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3">
                                        <p className="text-[10px] font-black uppercase tracking-wide text-slate-400 mb-1">Diagnóstico / Hallazgo</p>
                                        <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                                          {cleanDiagnosisText(d.diagnosis)}
                                        </p>
                                      </div>
                                    )}

                                    {measurements.length > 0 && (
                                      <div>
                                        <p className="text-[10px] font-black uppercase tracking-wide text-slate-400 mb-2">Mediciones</p>
                                        <div className="grid grid-cols-2 gap-2">
                                          {measurements.map((m, i) => (
                                            <div key={i} className="bg-slate-50 dark:bg-slate-800 rounded-xl p-2.5">
                                              <p className="text-[10px] text-slate-400 mb-0.5">{cleanText(m.name)}</p>
                                              <p className="text-sm font-black text-slate-900 dark:text-white">
                                                {cleanText(m.value)}{m.unit ? ` ${cleanText(m.unit)}` : ""}
                                              </p>
                                              {m.referenceRange && <p className="text-[10px] text-slate-400">ref: {m.referenceRange}</p>}
                                              {resolveMeasurementStatus({ value: String(m.value ?? ""), referenceRange: m.referenceRange ?? null }) && (
                                                <p
                                                  className={clsx(
                                                    "text-[10px] font-bold mt-0.5",
                                                    resolveMeasurementStatus({ value: String(m.value ?? ""), referenceRange: m.referenceRange ?? null }) === "Fuera de rango"
                                                      ? "text-rose-600"
                                                      : "text-emerald-600"
                                                  )}
                                                >
                                                  {resolveMeasurementStatus({ value: String(m.value ?? ""), referenceRange: m.referenceRange ?? null })}
                                                </p>
                                              )}
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}

                                    {medications.length > 0 && (
                                      <div>
                                        <p className="text-[10px] font-black uppercase tracking-wide text-slate-400 mb-2">Medicaciones indicadas</p>
                                        <div className="space-y-1.5">
                                          {medications.map((med, i) => (
                                            <div key={i} className="flex items-center justify-between bg-amber-50 dark:bg-amber-900/20 rounded-xl px-3 py-2">
                                              <span className="text-xs font-bold text-amber-800 dark:text-amber-300">{cleanText(med.name)}</span>
                                              <span className="text-[10px] text-amber-600 dark:text-amber-400">
                                                {[med.dosage, med.frequency].filter(Boolean).map(cleanText).join(" · ")}
                                              </span>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}

                                    {d.nextAppointmentDate && (
                                      <div className="flex items-center gap-3 bg-[#074738]/5 rounded-xl px-3 py-2.5">
                                        <MaterialIcon name="event" className="text-[#074738] text-lg shrink-0" />
                                        <div>
                                          <p className="text-[10px] font-black uppercase tracking-wide text-[#074738] mb-0.5">Próxima cita</p>
                                          <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                            {formatDateSafe(
                                              d.nextAppointmentDate,
                                              "es-AR",
                                              { day: "numeric", month: "long", year: "numeric" },
                                              "Sin fecha"
                                            )}
                                            {d.nextAppointmentReason ? ` — ${cleanText(d.nextAppointmentReason)}` : ""}
                                          </p>
                                        </div>
                                      </div>
                                    )}

                                    <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                                      <MaterialIcon name="hub" className="text-sm" />
                                      <span>{buildFlowLabel(event)}</span>
                                    </div>

                                    <div className="flex gap-2 pt-1">
                                      {documentUrl && canOpenDocument && (
                                        <a
                                          href={documentUrl}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          onClick={(e) => e.stopPropagation()}
                                          className="flex-1 py-2.5 bg-[#074738]/10 text-[#074738] text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 hover:bg-[#074738]/20 transition-colors"
                                        >
                                          <MaterialIcon name={event.fileType === "pdf" ? "picture_as_pdf" : "image"} className="text-sm" />
                                          Ver documento
                                        </a>
                                      )}
                                      {documentUrl && !canOpenDocument && (
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setActionError("No pudimos abrir el documento original porque requiere permisos adicionales de Storage.");
                                          }}
                                          className="flex-1 py-2.5 bg-slate-100 text-slate-500 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5"
                                        >
                                          <MaterialIcon name="lock" className="text-sm" />
                                          Documento restringido
                                        </button>
                                      )}
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setActionError(null);
                                          setEventToEdit(event);
                                          setShowEditModal(true);
                                        }}
                                        className="flex-1 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                                      >
                                        <MaterialIcon name="edit" className="text-sm" />
                                        Editar
                                      </button>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setActionError(null);
                                          setEventToDelete(event);
                                        }}
                                        className="flex-1 py-2.5 bg-red-50 text-red-600 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 hover:bg-red-100 transition-colors"
                                      >
                                        <MaterialIcon
                                          name={deletingEventId === event.id ? "sync" : "delete"}
                                          className={clsx("text-sm", deletingEventId === event.id && "animate-spin")}
                                        />
                                        Eliminar
                                      </button>
                                      {isUnderReview && (
                                        <button
                                          onClick={async (e) => {
                                            e.stopPropagation();
                                            setActionError(null);
                                            setConfirmingEventId(event.id);
                                            try {
                                              await confirmEvent(event.id);
                                            } catch (error) {
                                              const message = error instanceof Error ? error.message : "No se pudo confirmar el evento.";
                                              setActionError(message);
                                            } finally {
                                              setConfirmingEventId(null);
                                            }
                                          }}
                                          className="flex-1 py-2.5 bg-emerald-500 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 hover:bg-emerald-600 transition-colors"
                                        >
                                          <MaterialIcon
                                            name={confirmingEventId === event.id ? "sync" : "check_circle"}
                                            className={clsx("text-sm", confirmingEventId === event.id && "animate-spin")}
                                          />
                                          Confirmar
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        </div>
                      </button>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      <EditEventModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        event={eventToEdit}
      />

      <AnimatePresence>
        {eventToDelete && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                if (deletingEventId) return;
                setEventToDelete(null);
              }}
              className="fixed inset-0 z-50 bg-black/45"
            />
            <motion.div
              initial={{ opacity: 0, y: "100%" }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed inset-x-0 bottom-0 z-50 bg-white dark:bg-slate-900 rounded-t-3xl p-6 shadow-xl"
            >
              <div className="w-10 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mb-5" />
              <div className="flex items-start gap-3 mb-4">
                <div className="size-11 rounded-full bg-red-100 dark:bg-red-950/40 flex items-center justify-center shrink-0">
                  <MaterialIcon name="delete" className="text-xl text-red-500" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">¿Eliminar este evento?</h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Esta acción elimina el registro del historial y no se puede deshacer.
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={Boolean(deletingEventId)}
                  onClick={() => setEventToDelete(null)}
                  className="flex-1 py-3 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-600 dark:text-slate-300 disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={Boolean(deletingEventId)}
                  onClick={async () => {
                    const targetId = eventToDelete.id;
                    setDeletingEventId(targetId);
                    setActionError(null);
                    try {
                      await deleteEvent(targetId);
                      if (expandedEvent === targetId) setExpandedEvent(null);
                      setEventToDelete(null);
                    } catch (error) {
                      const message = error instanceof Error ? error.message : "No se pudo eliminar el evento.";
                      setActionError(message);
                    } finally {
                      setDeletingEventId(null);
                    }
                  }}
                  className="flex-1 py-3 rounded-xl bg-red-600 text-white text-sm font-bold disabled:opacity-60"
                >
                  {deletingEventId ? "Eliminando..." : "Eliminar"}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </section>
  );
}
