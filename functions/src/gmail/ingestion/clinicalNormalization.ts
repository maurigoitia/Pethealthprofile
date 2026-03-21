/**
 * Clinical normalization functions extracted from clinicalIngestion.ts
 * (Strangler Fig refactoring).
 *
 * Covers: event-type classification, appointment-status normalization,
 * medication / lab-result validation, imaging inference, study-subtype
 * resolution, canonical title building, brain-category mapping, and
 * constitutional guardrails.
 */

import type {
  AppointmentEventStatus,
  ClinicalEventExtraction,
  ClinicalLabResult,
  ClinicalMedication,
  EventType,
  StudySubtype,
} from "./types";

import {
  ANATOMICAL_MEASUREMENT_HINT_REGEX,
  HISTORICAL_ONLY_SIGNAL_REGEX,
  MEDICATION_DOSING_HINT_REGEX,
  MEDICATION_NAME_BLOCKLIST,
  MEDICATION_UNIT_ONLY_REGEX,
  STRUCTURED_DIAGNOSIS_HINT_REGEX,
} from "./types";

import {
  asString,
  cleanSentence,
  clamp,
  normalizeClinicalToken,
  normalizeForHash,
} from "./utils";

// ---------------------------------------------------------------------------
// Event-type predicates
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Appointment status inference & normalization
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Appointment time / entity sanitisation
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Appointment entity extraction from free text
// ---------------------------------------------------------------------------

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
  const senderDomain = extractSenderDomainLocal(sourceSender);
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

// ---------------------------------------------------------------------------
// Medication / treatment signal detection
// ---------------------------------------------------------------------------

export function hasMedicationOrTreatmentSignal(text: string): boolean {
  const haystack = normalizeClinicalToken(text);
  if (!haystack) return false;
  return /\b(receta|prescrip|tratamiento|medicaci[oó]n|dosis|cada\s+\d+\s*(?:h|hs|hora|horas)|comprimid|capsul|tableta|jarabe|gotas|pimobendan|ursomax|ursomas|furosemida|omeprazol|predni|amoxic|metronidazol|gabapentin|carprofeno|dieta\s+[a-záéíóúñ]+)\b/i.test(
    haystack
  );
}

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

export function medicationHasDoseAndFrequency(medication: ClinicalMedication): boolean {
  return Boolean(asString(medication.dose)) && Boolean(asString(medication.frequency));
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

// ---------------------------------------------------------------------------
// Medication & lab-result coercion from raw AI output
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Imaging inference
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Event-type normalisation & classification
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Confidence bucket conversion
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Canonical event title building
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Brain-category mapping (for pet-brain integration)
// ---------------------------------------------------------------------------

export function mapEventTypeToBrainCategory(eventType: EventType): string {
  if (eventType === "prescription_record") return "Medication";
  if (eventType === "vaccination_record") return "Vaccine";
  if (eventType === "study_report") return "Diagnostic";
  return "ClinicalEvent";
}

export function inferBrainCategoryFromSubject(subject: string): string {
  const normalized = normalizeForHash(subject);
  if (/\b(vacuna|vaccine|revacuna)\b/.test(normalized)) return "Vaccine";
  if (/\b(receta|prescrip|medicaci[oó]n|medication|tratamiento)\b/.test(normalized)) return "Medication";
  if (/\b(laboratorio|analisis|an[aá]lisis|ecograf|radiograf|resultado)\b/.test(normalized)) return "Diagnostic";
  return "ClinicalEvent";
}

export function buildBrainEntitiesFromEvent(event: ClinicalEventExtraction): Array<Record<string, unknown>> {
  const entities: Array<Record<string, unknown>> = [];

  if (event.diagnosis) {
    entities.push({
      type: "diagnosis",
      value: event.diagnosis,
      confidence: clamp(event.confidence_score / 100, 0, 1),
    });
  }

  for (const medication of event.medications) {
    entities.push({
      type: "medication",
      name: asString(medication.name) || null,
      dose: asString(medication.dose) || null,
      frequency: asString(medication.frequency) || null,
      duration_days: medication.duration_days,
      is_active: medication.is_active,
      confidence: clamp(event.confidence_score / 100, 0, 1),
    });
  }

  for (const lab of event.lab_results) {
    entities.push({
      type: "lab_result",
      test_name: asString(lab.test_name) || null,
      result: asString(lab.result) || null,
      unit: asString(lab.unit) || null,
      reference_range: asString(lab.reference_range) || null,
      confidence: clamp(event.confidence_score / 100, 0, 1),
    });
  }

  if (entities.length === 0) {
    entities.push({
      type: "summary",
      value: event.description_summary.slice(0, 500),
      confidence: clamp(event.confidence_score / 100, 0, 1),
    });
  }

  return entities;
}

// ---------------------------------------------------------------------------
// Quality / review guardrails
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Legacy title replacement check
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Internal helper — kept private, used only by extractClinicNameFromText
// ---------------------------------------------------------------------------

function extractSenderDomainLocal(email: string): string {
  const match = email.toLowerCase().match(/@([a-z0-9.-]+\.[a-z]{2,})/i);
  return match?.[1] || "";
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}
