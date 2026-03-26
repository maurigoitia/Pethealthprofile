import {
  EventType,
  AppointmentEventStatus,
  ClinicalEventExtraction,
  ClinicalMedication,
  ClinicalLabResult,
  StudySubtype,
} from "./types";
import {
  asString,
  asRecord,
  asNonNegativeNumber,
  normalizeClinicalToken,
  cleanSentence,
  clamp,
  toIsoDateOnly,
  getNowIso,
  normalizeTextForMatch,
  parseDateOnly,
} from "./utils";
import { extractSenderDomain, hasStrongHumanHealthcareSignal } from "./petMatching";

// ─── Constants ──────────────────────────────────────────────────────────────

const MEDICATION_UNIT_ONLY_REGEX = /^(?:\d+(?:[.,]\d+)?\s*)?(?:ml|mm|cm|kg|g|mg|mcg|ug|%|cc|x|comp(?:rimidos?)?)$/i;
const MEDICATION_DOSING_HINT_REGEX = /\b(cada|hora|horas|hs|comprim|capsul|tableta|pastilla|jarabe|gotas|inyec|ampolla|sobres?)\b/i;
const HISTORICAL_ONLY_SIGNAL_REGEX =
  /\b(desde\s+\d{4}|historic[oa]|revacun|calendario\s+de\s+vacun|esquema\s+de\s+vacun|vigencia|desde\s+hace|informaci[oó]n\s+general|referencia\s+hist[oó]rica)\b/i;
export const STRUCTURED_DIAGNOSIS_HINT_REGEX =
  /\b(cardiomegalia|cardiomiopat|dcm|hepatomegalia|esplenitis|esplenomegalia|fractura|luxaci[oó]n|insuficien|neoplas|masa|dermatitis|otitis|gastritis|nefritis|dilataci[oó]n)\b/i;
const ANATOMICAL_MEASUREMENT_HINT_REGEX =
  /\b(prostata|prost[aá]tica|vol(?:umen)?|diametr|medida|eje|vejiga|renal|ri[nñ]on|ri[nñ]ones|hep[aá]tic|h[ií]gado|espl[eé]nic|bazo|coraz[oó]n|tor[aá]x|abdomen|pelvis|femoral|aur[ií]cula|ventr[ií]cul)\b/i;
export const MEDICATION_NAME_BLOCKLIST = new Set([
  "ml",
  "mm",
  "cm",
  "kg",
  "g",
  "mg",
  "mcg",
  "ug",
  "cc",
  "vol",
  "volumen",
  "diametro",
  "diam",
  "eje",
  "medida",
  "medidas",
  "prostata",
  "prostatica",
  "vejiga",
  "renal",
  "rinon",
  "rinones",
  "hepatico",
  "higado",
  "esplenico",
  "bazo",
  "corazon",
  "torax",
  "abdomen",
  "pelvis",
  "izquierdo",
  "derecho",
  "hallazgo",
  "normal",
  "alterado",
  "cada",
  "frecuencia",
  "dosis",
]);

// ─── Event type predicates ──────────────────────────────────────────────────

export function isAppointmentEventType(eventType: EventType): boolean {
  return (
    eventType === "appointment_confirmation" ||
    eventType === "appointment_reminder" ||
    eventType === "appointment_cancellation"
  );
}

export function isPrescriptionEventType(eventType: EventType): boolean {
  return eventType === "prescription_record";
}

export function isVaccinationEventType(eventType: EventType): boolean {
  return eventType === "vaccination_record";
}

export function isStudyEventType(eventType: EventType): boolean {
  return eventType === "study_report";
}

// ─── Appointment status ─────────────────────────────────────────────────────

export function inferAppointmentStatusFromText(text: string): AppointmentEventStatus {
  const normalized = normalizeClinicalToken(text);
  if (!normalized) return null;
  if (/\b(cancelad|reprogramad|suspendid)\b/.test(normalized)) return "cancelled";
  if (/\b(recordatorio|recorda|recuerda)\b/.test(normalized)) return "reminder";
  if (/\b(confirmad|confirmacion)\b/.test(normalized)) return "confirmed";
  if (/\b(turno|consulta|control)\b/.test(normalized)) return "scheduled";
  return null;
}

export function normalizeAppointmentStatusValue(value: unknown, fallbackText = ""): AppointmentEventStatus {
  const normalized = normalizeClinicalToken(asString(value));
  if (normalized === "confirmed" || normalized === "confirmado") return "confirmed";
  if (normalized === "reminder" || normalized === "recordatorio") return "reminder";
  if (normalized === "cancelled" || normalized === "canceled" || normalized === "cancelado" || normalized === "reprogramado") {
    return "cancelled";
  }
  if (normalized === "scheduled" || normalized === "programado" || normalized === "agendado") return "scheduled";
  return inferAppointmentStatusFromText(fallbackText);
}

// ─── Time extraction ────────────────────────────────────────────────────────

export function sanitizeAppointmentTime(value: unknown): string | null {
  const raw = asString(value);
  if (!raw) return null;
  const match = raw.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
  if (!match) return null;
  return `${match[1].padStart(2, "0")}:${match[2]}`;
}

export function extractAppointmentTimeFromText(text: string): string | null {
  return sanitizeAppointmentTime(text);
}

// ─── Entity extraction ──────────────────────────────────────────────────────

export function sanitizeExtractedEntity(value: string | null): string | null {
  const raw = asString(value);
  if (!raw) return null;
  const trimmed = raw
    .replace(/\s+(?:en|a\s+las|con|para)\b.*$/i, "")
    .replace(/\s+(?:programad[oa]|confirmad[oa]|agendad[oa]|recordad[oa]|cancelad[oa])\b.*$/i, "")
    .replace(/^[\s:·,-]+|[\s:·,-]+$/g, "")
    .trim();
  return trimmed || null;
}

export function extractProfessionalNameFromText(text: string): string | null {
  const match = text.match(/(?:dr\.?|dra\.?|doctor|doctora)\s+([A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚÑ' -]+(?:\s+[A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚÑ' -]+){0,3})/i);
  return sanitizeExtractedEntity(asString(match?.[1]) || null);
}

export function extractClinicNameFromText(text: string, sourceSender = ""): string | null {
  const centerMatch = text.match(/centro\/profesional:\s*([^.,]+(?:\s*·\s*[^.,]+)?)/i);
  if (centerMatch?.[1]) {
    const parts = centerMatch[1]
      .split("·")
      .map((part) => sanitizeExtractedEntity(asString(part)))
      .filter(Boolean) as string[];
    if (parts.length > 1) return parts[1];
    if (parts.length === 1) return parts[0];
  }
  const clinicMatch = text.match(
    /\b(?:clinica|clínica|centro|hospital|sucursal)\s+([A-ZÁÉÍÓÚÑ][^.,]+?)(?=\s+a\s+las|\s+con\b|\s+para\b|\.|,|$)/i
  );
  if (clinicMatch?.[1]) return sanitizeExtractedEntity(asString(clinicMatch[1]) || null);
  const senderDomain = extractSenderDomain(sourceSender);
  if (senderDomain?.includes("panda")) return "PANDA CLINICA VETERINARIA";
  return null;
}

export function hasClinicSignalInText(text: string, sourceSender = ""): boolean {
  const haystack = normalizeClinicalToken([text, sourceSender].filter(Boolean).join(" "));
  return /\b(clinica|clinica veterinaria|centro|hospital|sucursal|panda|veterinaria|pet shop)\b/.test(haystack);
}

export function extractAppointmentSpecialtyFromText(text: string): string | null {
  const match = text.match(
    /\b(?:consulta|control|turno)\s+([a-záéíóúñ]+(?:\s+[a-záéíóúñ]+){0,3})(?=\s+(?:programad[oa]|confirmad[oa]|agendad[oa]|recordad[oa]|cancelad[oa]|con|en|a\s+las|para)\b|[.,]|$)/i
  );
  return sanitizeExtractedEntity(asString(match?.[1]) || null);
}

// ─── Signal detection ───────────────────────────────────────────────────────

export function hasMedicationOrTreatmentSignal(text: string): boolean {
  const haystack = normalizeClinicalToken(text);
  if (!haystack) return false;
  return /\b(receta|prescrip|tratamiento|medicaci[oó]n|dosis|cada\s+\d+\s*(?:h|hs|hora|horas)|comprimid|capsul|tableta|jarabe|gotas|pimobendan|ursomax|ursomas|furosemida|omeprazol|predni|amoxic|metronidazol|gabapentin|carprofeno|dieta\s+[a-záéíóúñ]+)\b/i.test(
    haystack
  );
}

export function deriveAppointmentLabel(event: ClinicalEventExtraction): string | null {
  const specialty = sanitizeExtractedEntity(event.appointment_specialty || null);
  if (specialty) return specialty;

  const description = cleanSentence(event.description_summary || "");
  const patterns = [
    /\bconsulta\s+([a-záéíóúñ]+(?:\s+[a-záéíóúñ]+){0,3})/i,
    /\bturno\s+([a-záéíóúñ]+(?:\s+[a-záéíóúñ]+){0,3})/i,
    /\bcontrol\s+([a-záéíóúñ]+(?:\s+[a-záéíóúñ]+){0,3})/i,
  ];
  for (const pattern of patterns) {
    const match = description.match(pattern);
    if (match?.[1]) return sanitizeExtractedEntity(match[1]);
  }

  const diagnosis = sanitizeExtractedEntity(event.diagnosis || null);
  if (diagnosis && diagnosis.length <= 80) return diagnosis;
  return null;
}

export function inferImagingTypeFromSignals(text: string): string | null {
  const haystack = normalizeClinicalToken(text);
  if (!haystack) return null;
  if (/\b(ecocard[a-z]*|eco cardio|ecocardi[a-z]*|doppler|mitral|ventricul[a-z]*)\b/.test(haystack)) return "ecocardiograma";
  if (/\b(ecg|electrocard[a-z]*|ritmo sinusal|qrs|pr)\b/.test(haystack)) return "electrocardiograma";
  if (/\b(eco|ecograf[a-z]*|ultrason[a-z]*|ultrasound|sonogra[a-z]*)\b/.test(haystack)) return "ecografía";
  if (/\b(rx|radiograf[a-z]*|radiolog[a-z]*|placa[s]?|proyeccion[a-z]*|ll|vd|dv|torax dv|torax ld|d v|l l)\b/.test(haystack)) {
    return "radiografía";
  }
  return null;
}

export function inferStudySubtypeFromSignals(args: {
  rawStudySubtype?: unknown;
  imagingType?: unknown;
  labResults: ClinicalLabResult[];
  descriptionSummary: string;
  diagnosis: string | null;
}): StudySubtype {
  const raw = asString(args.rawStudySubtype).toLowerCase();
  const haystack = normalizeClinicalToken(
    [
      asString(args.imagingType),
      args.descriptionSummary,
      args.diagnosis,
      ...args.labResults.flatMap((row) => [row.test_name, row.result, row.reference_range || ""]),
    ]
      .filter(Boolean)
      .join(" ")
  );
  const hasImagingSignal = /\b(rx|radiograf[a-z]*|radiolog[a-z]*|ecograf[a-z]*|ultrason[a-z]*|ultrasound|eco|ecocard[a-z]*|ecg|electrocard[a-z]*|imagen(?:es)?|placa[s]?|proyeccion[a-z]*)\b/.test(
    haystack
  );
  const hasLabSignal = /\b(laboratorio|hemograma|bioquim|analisis|an[aá]lisis|glucosa|creatinina|urea|alt|ast)\b/.test(
    haystack
  );
  if (hasImagingSignal) {
    return "imaging";
  }
  if (hasLabSignal) {
    return "lab";
  }
  if (raw === "imaging" || raw === "lab") return raw;
  if (args.labResults.length > 0) return "lab";
  return null;
}

// ─── Document type inference ────────────────────────────────────────────────

export function inferImagingDocumentType(event: ClinicalEventExtraction):
  "lab_test" | "xray" | "echocardiogram" | "electrocardiogram" {
  const haystack = normalizeClinicalToken(
    [event.imaging_type, event.description_summary, event.diagnosis].filter(Boolean).join(" ")
  );
  if (/\b(ecocard[a-z]*|eco cardi|doppler)\b/.test(haystack)) return "echocardiogram";
  if (/\b(ecg|electrocard[a-z]*)\b/.test(haystack)) return "electrocardiogram";
  if (/\b(rx|radiograf[a-z]*|radiolog[a-z]*|placa[s]?|ecograf[a-z]*|ultrason[a-z]*|ultrasound|proyeccion[a-z]*)\b/.test(haystack)) {
    return "xray";
  }
  return "lab_test";
}

export function normalizeExtractedEventType(rawType: string, row: Record<string, unknown>): EventType | null {
  const normalized = normalizeClinicalToken(rawType);
  const hintText = normalizeClinicalToken(
    [
      asString(row.description_summary),
      asString(row.diagnosis),
      asString(row.appointment_status),
      asString(row.study_subtype),
      asString(row.imaging_type),
    ].join(" ")
  );

  if (
    normalized === "appointment_confirmation" ||
    normalized === "appointment_reminder" ||
    normalized === "appointment_cancellation" ||
    normalized === "clinical_report" ||
    normalized === "study_report" ||
    normalized === "prescription_record" ||
    normalized === "vaccination_record"
  ) {
    return normalized as EventType;
  }

  if (normalized === "visit") {
    const status = inferAppointmentStatusFromText(hintText);
    if (status === "cancelled") return "appointment_cancellation";
    if (status === "reminder") return "appointment_reminder";
    return "appointment_confirmation";
  }
  if (normalized === "treatment") return "prescription_record";
  if (normalized === "vaccination") return "vaccination_record";
  if (normalized === "diagnostic" || normalized === "imaging") return "study_report";
  if (normalized === "episode") return "clinical_report";
  return null;
}

// ─── Canonical title ────────────────────────────────────────────────────────

export function buildCanonicalEventTitle(event: ClinicalEventExtraction): string {
  if (event.event_type === "appointment_confirmation") {
    const label = deriveAppointmentLabel(event);
    return label ? `Turno · ${label}` : "Turno confirmado";
  }
  if (event.event_type === "appointment_reminder") {
    const label = deriveAppointmentLabel(event);
    return label ? `Recordatorio · ${label}` : "Recordatorio de turno";
  }
  if (event.event_type === "appointment_cancellation") {
    const label = deriveAppointmentLabel(event);
    return label ? `Cancelación · ${label}` : "Turno cancelado";
  }
  if (event.event_type === "vaccination_record") return "Registro de vacunación";
  if (event.event_type === "prescription_record") {
    const firstMedication = asString(event.medications[0]?.name);
    return firstMedication ? `Receta médica · ${firstMedication}` : "Receta médica";
  }
  if (event.event_type === "study_report") {
    if (event.study_subtype === "imaging") {
      if (event.imaging_type && /ecocard|doppler/i.test(event.imaging_type)) return "Ecocardiograma";
      if (event.imaging_type && /electrocard|ecg/i.test(event.imaging_type)) return "Electrocardiograma";
      if (event.imaging_type && /radiograf|rx|placa/i.test(event.imaging_type)) return "Radiografía";
      if (event.diagnosis) return cleanSentence(event.diagnosis).slice(0, 120) || "Informe por imágenes";
      return "Informe por imágenes";
    }
    return "Resultado de laboratorio";
  }
  if (event.event_type === "clinical_report" && event.diagnosis) return event.diagnosis.slice(0, 120);
  return "Informe clínico";
}

// ─── Confidence ─────────────────────────────────────────────────────────────

export function confidenceBucketToScore(value: unknown, fallback = 70): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return clamp(Math.round(value), 0, 100);
  }
  const normalized = normalizeClinicalToken(asString(value));
  if (normalized === "high") return 90;
  if (normalized === "medium") return 75;
  if (normalized === "low") return 55;
  if (normalized === "not detected" || normalized === "not_detected") return 0;
  return clamp(fallback, 0, 100);
}

// ─── Domain document type mapping ───────────────────────────────────────────

export function toMedicalEventDocumentType(event: ClinicalEventExtraction):
  "appointment" | "medication" | "vaccine" | "lab_test" | "xray" | "echocardiogram" | "electrocardiogram" | "checkup" | "other" | "clinical_report" {
  if (isAppointmentEventType(event.event_type)) return "appointment";
  if (isPrescriptionEventType(event.event_type)) return "medication";
  if (isVaccinationEventType(event.event_type)) return "vaccine";
  if (isStudyEventType(event.event_type)) {
    return event.study_subtype === "imaging" ? inferImagingDocumentType(event) : "lab_test";
  }
  if (event.event_type === "clinical_report") return "checkup";
  return "other";
}

// ─── Stored data converters ─────────────────────────────────────────────────

export function toStoredClinicalMedications(value: unknown): ClinicalMedication[] {
  const rows = Array.isArray(value) ? value : [];
  return rows
    .map((row) => {
      const data = asRecord(row);
      const name = asString(data.name);
      if (!name) return null;
      return {
        name,
        dose: asString(data.dosage) || asString(data.dose) || null,
        frequency: asString(data.frequency) || null,
        duration_days: null,
        is_active: true,
      } as ClinicalMedication;
    })
    .filter((row): row is ClinicalMedication => Boolean(row));
}

export function toStoredClinicalLabResults(value: unknown): ClinicalLabResult[] {
  const rows = Array.isArray(value) ? value : [];
  return rows
    .map((row) => {
      const data = asRecord(row);
      const testName = asString(data.name);
      const result = asString(data.value);
      if (!testName || !result) return null;
      return {
        test_name: testName,
        result,
        unit: asString(data.unit) || null,
        reference_range: asString(data.referenceRange) || null,
      } as ClinicalLabResult;
    })
    .filter((row): row is ClinicalLabResult => Boolean(row));
}

// ─── Stored event reconstruction (for taxonomy backfill) ────────────────────

export function inferStoredEventTypeFromRecord(args: {
  row: Record<string, unknown>;
  extractedData: Record<string, unknown>;
  sourceText: string;
  medications: ClinicalMedication[];
  labResults: ClinicalLabResult[];
}): EventType | null {
  const normalizedExistingType = normalizeExtractedEventType(
    asString(args.extractedData.taxonomyEventType),
    args.extractedData
  );
  if (normalizedExistingType) return normalizedExistingType;

  const documentType = asString(args.extractedData.documentType);
  const normalizedSourceText = normalizeClinicalToken(args.sourceText);
  const appointmentStructured =
    Boolean(asString(args.extractedData.appointmentTime)) ||
    Boolean(asString(args.extractedData.provider)) ||
    Boolean(asString(args.extractedData.clinic)) ||
    (Array.isArray(args.extractedData.detectedAppointments) ? args.extractedData.detectedAppointments.length : 0) > 0;
  const studySignal = /\b(laboratorio|hemograma|bioquim|radiograf|ecograf|electrocard|resultado|informe|microscop|koh|citolog|rx|placa)\b/.test(
    normalizedSourceText
  );
  const medicationSignal = args.medications.length > 0 || hasMedicationOrTreatmentSignal(args.sourceText);
  if (documentType === "appointment") {
    if (!appointmentStructured && studySignal) return "study_report";
    if (!appointmentStructured && medicationSignal) return "prescription_record";
    const status = normalizeAppointmentStatusValue(args.extractedData.appointmentStatus, args.sourceText);
    if (status === "cancelled") return "appointment_cancellation";
    if (status === "reminder") return "appointment_reminder";
    return "appointment_confirmation";
  }
  if (documentType === "medication" && args.medications.length > 0) return "prescription_record";
  if (documentType === "vaccine") return "vaccination_record";
  if (
    documentType === "lab_test" ||
    documentType === "xray" ||
    documentType === "echocardiogram" ||
    documentType === "electrocardiogram"
  ) {
    return "study_report";
  }
  if (documentType === "checkup") return "clinical_report";

  if (args.medications.length > 0) return "prescription_record";
  if (args.labResults.length > 0) return "study_report";

  const normalized = normalizedSourceText;
  if (!normalized) return null;
  if (/\b(vacuna|vacunacion|revacuna)\b/.test(normalized)) return "vaccination_record";
  if (/\b(turno|consulta|recordatorio|confirmacion|confirmación|cancelacion|cancelación|reprogramaci)\b/.test(normalized)) {
    const status = inferAppointmentStatusFromText(normalized);
    if (status === "cancelled") return "appointment_cancellation";
    if (status === "reminder") return "appointment_reminder";
    return "appointment_confirmation";
  }
  if (/\b(laboratorio|hemograma|bioquim|radiograf|ecograf|ecocard|electrocard|resultado|informe)\b/.test(normalized)) {
    return "study_report";
  }
  return "clinical_report";
}

export function reconstructStoredEventForTaxonomy(row: Record<string, unknown>): ClinicalEventExtraction | null {
  const extractedData = asRecord(row.extractedData);
  const sourceText = [
    asString(extractedData.aiGeneratedSummary),
    asString(extractedData.suggestedTitle),
    asString(extractedData.diagnosis),
    asString(extractedData.sourceSubject),
    asString(extractedData.sourceSender),
    asString(row.title),
  ]
    .filter(Boolean)
    .join(" · ");

  const medications = toStoredClinicalMedications(extractedData.medications);
  const labResults = toStoredClinicalLabResults(extractedData.measurements);
  const eventType = inferStoredEventTypeFromRecord({
    row,
    extractedData,
    sourceText,
    medications,
    labResults,
  });
  if (!eventType) return null;

  const detectedAppointment = asRecord(Array.isArray(extractedData.detectedAppointments) ? extractedData.detectedAppointments[0] : null);
  const diagnosis = asString(extractedData.diagnosis) || null;
  const imagingType =
    asString(extractedData.imagingType) ||
    inferImagingTypeFromSignals(sourceText) ||
    (asString(extractedData.documentType) === "xray"
      ? "radiografía"
      : asString(extractedData.documentType) === "echocardiogram"
        ? "ecocardiograma"
        : asString(extractedData.documentType) === "electrocardiogram"
          ? "electrocardiograma"
          : null);
  const appointmentTime =
    asString(extractedData.appointmentTime) ||
    asString(detectedAppointment.time) ||
    extractAppointmentTimeFromText(sourceText) ||
    null;
  const parsedAppointmentSpecialty = extractAppointmentSpecialtyFromText(sourceText);
  const parsedProfessionalName = extractProfessionalNameFromText(sourceText);
  const parsedClinicName = extractClinicNameFromText(sourceText, asString(extractedData.sourceSender));
  const appointmentSpecialty =
    parsedAppointmentSpecialty ||
    asString(detectedAppointment.specialty) ||
    null;
  const professionalName =
    parsedProfessionalName ||
    asString(extractedData.provider) ||
    asString(detectedAppointment.provider) ||
    null;
  const clinicName =
    parsedClinicName ||
    (hasClinicSignalInText(sourceText, asString(extractedData.sourceSender))
      ? asString(extractedData.clinic) || asString(detectedAppointment.clinic) || null
      : null);

  let appointmentStatus: AppointmentEventStatus = null;
  if (isAppointmentEventType(eventType)) {
    appointmentStatus = normalizeAppointmentStatusValue(
      asString(extractedData.appointmentStatus) || asString(detectedAppointment.status),
      sourceText
    );
    if (!appointmentStatus) {
      if (eventType === "appointment_cancellation") appointmentStatus = "cancelled";
      if (eventType === "appointment_reminder") appointmentStatus = "reminder";
      if (eventType === "appointment_confirmation") appointmentStatus = "confirmed";
    }
  }

  const studySubtype = isStudyEventType(eventType)
    ? inferStudySubtypeFromSignals({
        rawStudySubtype: extractedData.studySubtype,
        imagingType,
        labResults,
        descriptionSummary: sourceText,
        diagnosis,
      })
    : null;

  const eventDate =
    asString(extractedData.eventDate) ||
    asString(row.eventDate) ||
    toIsoDateOnly(new Date(asString(extractedData.sourceReceivedAt) || asString(row.createdAt) || getNowIso()));

  return {
    event_type: eventType,
    event_date: eventDate,
    date_confidence: confidenceBucketToScore(extractedData.eventDateConfidence, 70),
    description_summary: asString(extractedData.aiGeneratedSummary) || asString(row.title) || sourceText.slice(0, 240),
    diagnosis,
    medications,
    lab_results: labResults,
    imaging_type: imagingType,
    study_subtype: studySubtype,
    appointment_time: isAppointmentEventType(eventType) ? appointmentTime : null,
    appointment_specialty: isAppointmentEventType(eventType) ? appointmentSpecialty : null,
    professional_name: professionalName,
    clinic_name: clinicName,
    appointment_status: appointmentStatus,
    severity: null,
    confidence_score: clamp(asNonNegativeNumber(row.overallConfidence, 72), 0, 100),
  };
}

// ─── Operational appointment candidate ──────────────────────────────────────

export function extractOperationalAppointmentCandidate(args: {
  eventDate: string | null;
  sourceText: string;
  sourceSender?: string | null;
  existingStatus?: unknown;
  existingTime?: unknown;
  existingSpecialty?: unknown;
  professionalName?: string | null;
  clinicName?: string | null;
  diagnosis?: string | null;
  confidenceScore?: number;
}): ClinicalEventExtraction | null {
  const eventDate = asString(args.eventDate) || null;
  const parsedEventDate = parseDateOnly(eventDate || "");
  if (!parsedEventDate) return null;

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  if (parsedEventDate.getTime() < startOfToday.getTime()) return null;

  const sourceText = cleanSentence(args.sourceText);
  const normalized = normalizeClinicalToken(sourceText);
  if (!normalized) return null;

  const hasAppointmentLanguage = /\b(turno|consulta|control|recordatorio|confirmacion|confirmado|agendad|programad|reprogramad|cancelad|cita)\b/.test(
    normalized
  );
  if (!hasAppointmentLanguage) return null;

  const appointmentTime = sanitizeAppointmentTime(args.existingTime) || extractAppointmentTimeFromText(sourceText) || null;
  const appointmentSpecialty =
    sanitizeExtractedEntity(asString(args.existingSpecialty) || extractAppointmentSpecialtyFromText(sourceText)) || null;
  const professionalName =
    sanitizeExtractedEntity(args.professionalName || extractProfessionalNameFromText(sourceText)) || null;
  const clinicName =
    sanitizeExtractedEntity(args.clinicName || extractClinicNameFromText(sourceText, asString(args.sourceSender))) || null;
  const appointmentStatus = normalizeAppointmentStatusValue(args.existingStatus, sourceText) || "scheduled";

  const strongStudySignal = /\b(radiograf|ecograf|electrocard|laboratorio|hemograma|microscop|koh|prueba|informe|resultado|prostata|torax|pelvis|proyeccion)\b/.test(
    normalized
  );
  const strongMedicationSignal = hasMedicationOrTreatmentSignal(sourceText);

  if (!appointmentTime && !appointmentSpecialty && !professionalName && !clinicName) return null;
  if (!appointmentTime && !professionalName && !clinicName && (strongStudySignal || strongMedicationSignal)) return null;

  const eventType: EventType =
    appointmentStatus === "cancelled"
      ? "appointment_cancellation"
      : appointmentStatus === "reminder"
        ? "appointment_reminder"
        : "appointment_confirmation";

  return {
    event_type: eventType,
    event_date: eventDate,
    date_confidence: 85,
    description_summary: sourceText.slice(0, 240),
    diagnosis: sanitizeExtractedEntity(args.diagnosis || null),
    medications: [],
    lab_results: [],
    imaging_type: null,
    study_subtype: null,
    appointment_time: appointmentTime,
    appointment_specialty: appointmentSpecialty,
    professional_name: professionalName,
    clinic_name: clinicName,
    appointment_status: appointmentStatus,
    severity: null,
    confidence_score: clamp(asNonNegativeNumber(args.confidenceScore, 82), 0, 100),
  };
}

// ─── Legacy title / observations checks ─────────────────────────────────────

export function shouldReplaceLegacyStoredTitle(currentTitle: string): boolean {
  const normalized = normalizeClinicalToken(currentTitle);
  if (!normalized) return true;
  return [
    "diagnostico detectado por correo",
    "documento",
    "informe clinico",
    "turno programado",
    "resultado de laboratorio",
    "informe de estudio",
  ].includes(normalized);
}

export function shouldPreserveExistingObservations(args: {
  row: Record<string, unknown>;
  extractedData: Record<string, unknown>;
}): boolean {
  const existingObservation = asString(args.extractedData.observations);
  if (!existingObservation) return false;
  if (asString(args.row.sourceTruthLevel) === "human_confirmed") return true;
  const narrative = asString(args.extractedData.aiGeneratedSummary);
  return normalizeClinicalToken(existingObservation) !== normalizeClinicalToken(narrative);
}

// ─── Medication validation ──────────────────────────────────────────────────

export function medicationNameHasExplicitDrugSignal(name: string): boolean {
  const normalized = normalizeClinicalToken(name);
  if (!normalized || MEDICATION_UNIT_ONLY_REGEX.test(normalized)) return false;
  const tokens = normalized.split(/\s+/).filter(Boolean);
  const candidateTokens = tokens.filter((token) => {
    if (token.length < 3) return false;
    if (MEDICATION_NAME_BLOCKLIST.has(token)) return false;
    if (/^\d/.test(token)) return false;
    if (MEDICATION_UNIT_ONLY_REGEX.test(token)) return false;
    return /[a-z]/.test(token);
  });
  return candidateTokens.length > 0;
}

export function isMedicationMeasurementFalsePositive(medication: ClinicalMedication): boolean {
  if (!medicationNameHasExplicitDrugSignal(medication.name)) return true;
  const combined = normalizeClinicalToken(
    [medication.name, medication.dose, medication.frequency].filter(Boolean).join(" ")
  );
  if (ANATOMICAL_MEASUREMENT_HINT_REGEX.test(combined) && !MEDICATION_DOSING_HINT_REGEX.test(combined)) {
    return true;
  }
  return false;
}

export function medicationHasDoseAndFrequency(medication: ClinicalMedication): boolean {
  return Boolean(asString(medication.dose)) && Boolean(asString(medication.frequency));
}

export function looksHistoricalOnlyTreatmentEvent(event: ClinicalEventExtraction): boolean {
  if (!isPrescriptionEventType(event.event_type)) return false;
  const normalized = normalizeClinicalToken(
    [
      event.description_summary,
      event.diagnosis,
      ...event.medications.map((medication) => medication.name),
    ]
      .filter(Boolean)
      .join(" ")
  );
  if (!HISTORICAL_ONLY_SIGNAL_REGEX.test(normalized)) return false;
  return !/\b(cada|administrar|dar|tomar|iniciar|continuar|indicado|receta|prescrip)\b/.test(normalized);
}

export function hasUnstructuredClinicalFinding(event: ClinicalEventExtraction): boolean {
  if (event.diagnosis) return false;
  if (!(event.event_type === "clinical_report" || isStudyEventType(event.event_type))) return false;
  return STRUCTURED_DIAGNOSIS_HINT_REGEX.test(normalizeClinicalToken(event.description_summary));
}

export function hasIncompleteAppointmentMetadata(event: ClinicalEventExtraction): boolean {
  if (!isAppointmentEventType(event.event_type)) return false;
  return !event.appointment_status || !event.appointment_time || !event.professional_name || !event.clinic_name;
}

export function hasIncompletePrescriptionMetadata(event: ClinicalEventExtraction): boolean {
  if (!isPrescriptionEventType(event.event_type)) return false;
  if (event.medications.length === 0) return true;
  return event.medications.some((medication) => !medicationHasDoseAndFrequency(medication));
}

export function hasUndifferentiatedStudySubtype(event: ClinicalEventExtraction): boolean {
  return isStudyEventType(event.event_type) && !event.study_subtype;
}

// ─── Constitutional guardrails ──────────────────────────────────────────────

export function applyConstitutionalGuardrails(event: ClinicalEventExtraction): {
  event: ClinicalEventExtraction;
  reviewReasons: string[];
} {
  const reviewReasons = new Set<string>();
  const medications = event.medications.filter((medication) => {
    const blocked = isMedicationMeasurementFalsePositive(medication);
    if (blocked) reviewReasons.add("medication_without_explicit_drug_name");
    return !blocked;
  });

  const sanitizedEvent: ClinicalEventExtraction = {
    ...event,
    medications,
  };

  if (looksHistoricalOnlyTreatmentEvent(sanitizedEvent)) {
    reviewReasons.add("historical_info_only");
  }
  if (hasUnstructuredClinicalFinding(sanitizedEvent)) {
    reviewReasons.add("unstructured_clinical_finding");
  }
  if (hasIncompleteAppointmentMetadata(sanitizedEvent)) {
    reviewReasons.add("incomplete_appointment_details");
  }
  if (hasIncompletePrescriptionMetadata(sanitizedEvent)) {
    reviewReasons.add("missing_treatment_dose_or_frequency");
  }
  if (hasUndifferentiatedStudySubtype(sanitizedEvent)) {
    reviewReasons.add("study_subtype_undetermined");
  }

  return {
    event: sanitizedEvent,
    reviewReasons: [...reviewReasons],
  };
}

// ─── Legacy cleanup classification ──────────────────────────────────────────

export type LegacyCleanupAction = "delete" | "salvage" | "keep";

export interface LegacyCleanupSample {
  docId: string;
  action: LegacyCleanupAction;
  title: string | null;
  sender: string | null;
  provider: string | null;
  documentType: string | null;
  reasons: string[];
}

export interface LegacyMailsyncCleanupResult {
  total_scanned: number;
  eligible_legacy_events: number;
  delete_candidates: number;
  salvage_candidates: number;
  deleted: number;
  skipped: number;
  artifacts_deleted: number;
  errors: number;
  narrative_refreshed: boolean;
  samples: LegacyCleanupSample[];
  error_details: Array<{ docId: string; error: string }>;
}

export interface GmailTaxonomyBackfillResult {
  total_scanned: number;
  eligible_email_events: number;
  updated: number;
  unchanged: number;
  skipped_non_email: number;
  skipped_unclassified: number;
  appointment_projections_updated: number;
  errors: number;
  samples: Array<Record<string, unknown>>;
  error_details: Array<{ docId: string; error: string }>;
}

export const LEGACY_GENERIC_TITLES = new Set([
  "diagnostico detectado por correo",
  "estudio detectado por correo",
  "documento",
  "documento detectado por correo",
  "turno programado",
  "resultado de laboratorio",
  "informe de estudio",
  "diagnostico",
]);

export const LEGACY_DELETE_DOMAIN_HINTS = [
  "huesped.org",
  "ikeargentina.com",
  "osde",
  "swissmedical",
  "medicus",
  "galeno",
  "omint",
  "afip",
];

export const LEGACY_OPERATIONAL_NOISE_REGEX =
  /\b(tipo detectado:\s*cancelacion|tipo detectado:\s*recordatorio_turno|tipo detectado:\s*confirmacion_turno|recordatorio del turno|informacion de turno solicitado|información de turno solicitado|turno confirmado|turno cancelado|reprogramacion|reprogramación|recordatorio de turno|cancelacion de turno|cancelación de turno)\b/i;

export const LEGACY_SALVAGE_STUDY_REGEX =
  /\b(radiograf(?:ia|ias)?|rx\b|placa(?:s)?\s+de\s+t[oó]rax|ecograf(?:ia|ias)?|ultrason(?:ido)?|ultrasound|ecg|electrocardiograma|electrocardiograf|informe radiol[oó]gico|bronquitis|cardiomegalia|hepatomegalia|esplenitis|enfermedad discal|koh\b|microscop[ií]a|hemograma|bioqu[ií]mica|laboratorio)\b/i;

export function isLegacyMailsyncEvent(docId: string, row: Record<string, unknown>, extractedData: Record<string, unknown>): boolean {
  return (
    docId.startsWith("mailsync_") ||
    asString(extractedData.extractionProtocol) === "legacy_v1" ||
    asString(row.extractionProtocol) === "legacy_v1"
  );
}

export function selectLegacySender(row: Record<string, unknown>, extractedData: Record<string, unknown>): string {
  return (
    asString(extractedData.sourceSender) ||
    asString(row.sourceSender) ||
    (asString(extractedData.provider).includes("@") ? asString(extractedData.provider) : "") ||
    (asString(row.provider).includes("@") ? asString(row.provider) : "")
  );
}

export function hasLegacyMedicationPayload(extractedData: Record<string, unknown>): boolean {
  const medicationsRaw = Array.isArray(extractedData.medications) ? extractedData.medications : [];
  return medicationsRaw.some((item) => {
    const medication = asRecord(item);
    const name = normalizeClinicalToken(asString(medication.name));
    if (!name || MEDICATION_NAME_BLOCKLIST.has(name)) return false;
    return Boolean(asString(medication.dose) || asString(medication.frequency) || name.length >= 4);
  });
}

export function classifyLegacyMailsyncEvent(
  docId: string,
  row: Record<string, unknown>,
): LegacyCleanupSample {
  const extractedData = asRecord(row.extractedData);
  const title = asString(row.title);
  const sender = selectLegacySender(row, extractedData);
  const provider = asString(extractedData.provider) || asString(row.provider) || null;
  const documentType = asString(extractedData.documentType) || asString(row.documentType) || null;
  const diagnosis = asString(extractedData.diagnosis);
  const observations = asString(extractedData.observations);
  const corpus = [
    title,
    asString(extractedData.aiGeneratedSummary),
    observations,
    diagnosis,
    asString(extractedData.sourceSubject),
    sender,
    provider,
    asString(row.findings),
  ].join(" \n ");
  const normalizedTitle = normalizeClinicalToken(title);
  const genericLegacyTitle = LEGACY_GENERIC_TITLES.has(normalizedTitle);
  const humanNoise =
    hasStrongHumanHealthcareSignal(corpus) ||
    LEGACY_DELETE_DOMAIN_HINTS.some((hint) => normalizeTextForMatch(sender).includes(normalizeTextForMatch(hint))) ||
    LEGACY_DELETE_DOMAIN_HINTS.some((hint) => normalizeTextForMatch(corpus).includes(normalizeTextForMatch(hint)));
  const operationalNoise = LEGACY_OPERATIONAL_NOISE_REGEX.test(corpus);
  const documentImpliesStudy = ["xray", "lab_test", "laboratory_result", "clinical_report", "electrocardiogram", "ultrasound"].includes(
    documentType || ""
  );
  const structuredClinicalFinding =
    STRUCTURED_DIAGNOSIS_HINT_REGEX.test(normalizeClinicalToken(diagnosis)) ||
    STRUCTURED_DIAGNOSIS_HINT_REGEX.test(normalizeClinicalToken(observations)) ||
    Boolean(asString(row.findings));
  const medicationPayload = hasLegacyMedicationPayload(extractedData);
  const veterinaryStudyEvidence =
    LEGACY_SALVAGE_STUDY_REGEX.test(corpus) ||
    structuredClinicalFinding ||
    medicationPayload ||
    (documentImpliesStudy && !operationalNoise);
  const reasons: string[] = [];

  if (humanNoise) reasons.push("human_noise");
  if (operationalNoise) reasons.push("operational_noise");
  if (genericLegacyTitle) reasons.push("generic_legacy_title");
  if (veterinaryStudyEvidence) reasons.push("veterinary_study_evidence");
  if (structuredClinicalFinding) reasons.push("structured_clinical_finding");
  if (medicationPayload) reasons.push("medication_payload");

  let action: LegacyCleanupAction = "keep";
  if (humanNoise) {
    action = "delete";
  } else if (operationalNoise && ["checkup", "appointment"].includes(documentType || "") && !structuredClinicalFinding && !medicationPayload) {
    action = "delete";
  } else if (veterinaryStudyEvidence) {
    action = "salvage";
  } else if (operationalNoise && (genericLegacyTitle || !veterinaryStudyEvidence)) {
    action = "delete";
  } else if (genericLegacyTitle && !veterinaryStudyEvidence) {
    action = "delete";
  }

  return {
    docId,
    action,
    title: title || null,
    sender: sender || null,
    provider,
    documentType,
    reasons,
  };
}
