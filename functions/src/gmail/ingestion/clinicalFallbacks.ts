import {
  attachmentNamesContainClinicalSignal,
  hasStrongHumanHealthcareSignal,
  hasVeterinaryAdministrativeOnlySignal,
  isTrustedClinicalSender,
} from "./petMatching";
import { AttachmentMetadata, ClinicalEventExtraction } from "./types";
import {
  applyConstitutionalGuardrails,
  extractAppointmentDateFromText,
  extractAppointmentSpecialtyFromText,
  extractAppointmentTimeFromText,
  extractClinicNameFromText,
  extractOperationalAppointmentCandidate,
  extractProfessionalNameFromText,
  inferImagingTypeFromSignals,
  inferStudySubtypeFromSignals,
  isAppointmentEventType,
  isStudyEventType,
  sanitizeExtractedEntity,
} from "./clinicalNormalization";
import { asString, cleanSentence, clamp, toIsoDateOnly } from "./utils";

export interface ClinicalFallbackResolution {
  event: ClinicalEventExtraction | null;
  confidenceOverall: number;
  requiresHumanReview: boolean;
  reasonIfReviewNeeded: string | null;
}

export interface ClinicalDocumentDispositionArgs {
  createdForMessage: number;
  reviewsForMessage: number;
  isClinicalContent: boolean;
  reasonIfReviewNeeded?: string | null;
  sourceSubject: string;
  sourceSender: string;
  extractedText: string;
  emailDate: string;
  attachmentMetadata: AttachmentMetadata[];
}

export function shouldPersistCanonicalReviewDraft(args: {
  event: ClinicalEventExtraction;
  sourceSubject: string;
  sourceSender: string;
  extractedText: string;
  reviewReason?: string | null;
  attachmentMetadata: AttachmentMetadata[];
}): boolean {
  const normalizedReviewReason = cleanSentence(asString(args.reviewReason)).toLowerCase();
  if (normalizedReviewReason.includes("historical_info_only")) {
    return false;
  }

  const evidenceText = cleanSentence(
    [
      args.sourceSubject,
      args.sourceSender,
      args.extractedText,
      args.event.description_summary,
      args.reviewReason,
      args.attachmentMetadata.map((row) => row.filename).join(" "),
    ]
      .filter(Boolean)
      .join(" · ")
  );

  if (isAppointmentEventType(args.event.event_type)) {
    const appointmentTime = args.event.appointment_time || extractAppointmentTimeFromText(evidenceText);
    return Boolean(args.event.event_date) && Boolean(appointmentTime) && hasAppointmentSignal(evidenceText);
  }

  if (isStudyEventType(args.event.event_type)) {
    return (
      Boolean(args.event.event_date) &&
      (
        Boolean(args.event.study_subtype) ||
        Boolean(args.event.imaging_type) ||
        attachmentNamesContainClinicalSignal(args.attachmentMetadata) ||
        hasStudySignal(evidenceText)
      )
    );
  }

  return false;
}

function buildFallbackDescription(subject: string, extractedText: string, fallback: string): string {
  return cleanSentence([subject, extractedText].filter(Boolean).join(" · ")).slice(0, 240) || fallback;
}

function hasAppointmentSignal(text: string): boolean {
  return /\b(turno|consulta|control|recordatorio|confirmacion|confirmación|cancelacion|cancelación|reprogramaci|cita)\b/i.test(text);
}

function hasStudySignal(text: string): boolean {
  return /\b(radiograf|ecograf|\beco\b|ultrasound|ecocard|doppler|ecg|electrocard|hemograma|bioquim|analisis de sangre|extraccion de sangre|perfil hep|perfil renal|quimica sanguinea|laboratorio|rx\b|placa|koh|citolog|microscop)\b/i.test(
      text
    );
}

function extractOperationalSegmentParts(segment: string): {
  cleaned: string;
  clinicName: string | null;
  preClinic: string;
  postClinic: string;
  professionalName: string | null;
} {
  const cleaned = cleanSentence(segment)
    .replace(/\b\d{1,2}[\/.-]\d{1,2}(?:[\/.-]\d{2,4})?\b/g, " ")
    .replace(/\b\d{1,2}(?::|\.)\d{2}\b/g, " ")
    .replace(/\b\d{1,2}\s*(?:hs?|h)\b/gi, " ")
    .replace(/\b(?:fecha|hora|especialidad|prestacion|prestación|profesional|centro de atencion|centro de atención|equipo|sector atención|sector atencion)\b[:\s-]*/gi, " ")
    .replace(/\|/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const clinicMatch = cleaned.match(/\b(PANDA\s+(?:HUIDOBRO|OBLIGADO|HUAPI|BAUNESS)(?:\s+24HS)?)\b/i);
  const clinicName = sanitizeExtractedEntity(clinicMatch?.[1] || null);
  const clinicIndex = clinicName ? cleaned.toUpperCase().indexOf(clinicName.toUpperCase()) : -1;
  const preClinic = clinicIndex >= 0 ? cleaned.slice(0, clinicIndex).trim() : cleaned;
  const postClinic = clinicIndex >= 0 ? cleaned.slice(clinicIndex + clinicName!.length).trim() : "";
  const professionalMatch = preClinic.match(/\b([A-ZÁÉÍÓÚÑ]+,\s*[A-ZÁÉÍÓÚÑ]+)\b/);
  const professionalName = sanitizeExtractedEntity(professionalMatch?.[1] || null);

  return {
    cleaned,
    clinicName,
    preClinic,
    postClinic,
    professionalName,
  };
}

function normalizeOperationalLabel(segment: string): string | null {
  const parts = extractOperationalSegmentParts(segment);
  const specialty = sanitizeExtractedEntity(extractAppointmentSpecialtyFromText(segment));
  const preClinicWithoutProfessional = parts.professionalName
    ? parts.preClinic.replace(parts.professionalName, "").replace(/\s+/g, " ").trim()
    : parts.preClinic;
  const likelyLabel = sanitizeExtractedEntity(parts.postClinic || preClinicWithoutProfessional || specialty || parts.cleaned);
  if (!likelyLabel) return null;
  return likelyLabel.slice(0, 120);
}

function extractProfessionalNameFromOperationalSegment(segment: string): string | null {
  return extractOperationalSegmentParts(segment).professionalName;
}

function extractClinicNameFromOperationalSegment(segment: string, sourceSender: string): string | null {
  const explicit = extractOperationalSegmentParts(segment).clinicName;
  if (explicit) return explicit;
  return extractClinicNameFromText(segment, sourceSender);
}

function dedupeFallbackEvents(events: ClinicalFallbackResolution[]): ClinicalFallbackResolution[] {
  const seen = new Set<string>();
  const out: ClinicalFallbackResolution[] = [];
  for (const row of events) {
    const event = row.event;
    if (!event) continue;
    const key = [
      event.event_type,
      event.event_date || "no_date",
      event.appointment_time || "no_time",
      event.appointment_specialty || normalizeOperationalLabel(event.description_summary) || "no_label",
      event.professional_name || "no_professional",
      event.clinic_name || "no_clinic",
      event.study_subtype || "no_study",
      event.imaging_type || "no_imaging",
    ]
      .map((value) => cleanSentence(asString(value)).toLowerCase())
      .join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}

function extractOperationalFallbackEvents(args: {
  sourceSubject: string;
  sourceSender: string;
  extractedText: string;
  emailDate: string;
  confidenceOverall?: number;
}): ClinicalFallbackResolution[] {
  const fallbackConfidence = clamp(args.confidenceOverall ?? 62, 0, 100);
  const sourceText = cleanSentence([args.sourceSubject, args.extractedText].filter(Boolean).join(" · "));
  if (!hasAppointmentSignal(sourceText)) return [];

  const trustedOperationalSender = isTrustedClinicalSender(args.sourceSender) || /panda/i.test(args.sourceSender);
  const contextualHeader =
    cleanSentence(args.sourceSubject) ||
    args.extractedText
      .split(/\n+/)
      .map((line) => cleanSentence(line))
      .find((line) => hasAppointmentSignal(line)) ||
    "";
  const segments = args.extractedText
    .split(/\n+/)
    .map((line) => cleanSentence(line))
    .filter((line) => /\b\d{1,2}[\/.-]\d{1,2}(?:[\/.-]\d{2,4})?\b/.test(line) && /\b\d{1,2}(?::|\.)\d{2}|\b\d{1,2}\s*(?:hs?|h)\b/i.test(line));

  const candidateSegments = segments.length > 0 ? segments : [sourceText];
  const results: ClinicalFallbackResolution[] = [];

  for (const segment of candidateSegments) {
    const eventDate = extractAppointmentDateFromText(segment, args.emailDate);
    if (!eventDate) continue;
    const segmentSourceText = cleanSentence([contextualHeader, segment].filter(Boolean).join(" · "));
    const appointmentCandidate = extractOperationalAppointmentCandidate({
      eventDate,
      sourceText: segmentSourceText,
      sourceSender: args.sourceSender,
      existingTime: extractAppointmentTimeFromText(segment),
      existingSpecialty: normalizeOperationalLabel(segment),
      professionalName:
        extractProfessionalNameFromOperationalSegment(segment) ||
        extractProfessionalNameFromText(segment) ||
        extractProfessionalNameFromText(segmentSourceText) ||
        extractProfessionalNameFromText(sourceText),
      clinicName:
        extractClinicNameFromOperationalSegment(segment, args.sourceSender) ||
        extractClinicNameFromText(sourceText, args.sourceSender),
      confidenceScore: clamp(Math.max(fallbackConfidence, 84), 0, 100),
    });
    if (!appointmentCandidate) continue;

    const guarded = applyConstitutionalGuardrails({
      ...appointmentCandidate,
      description_summary: buildFallbackDescription(args.sourceSubject, segment, "Turno veterinario detectado"),
      appointment_specialty:
        appointmentCandidate.appointment_specialty || normalizeOperationalLabel(segment) || normalizeOperationalLabel(sourceText),
    });
    const requiresHumanReview = guarded.reviewReasons.length > 0 || !trustedOperationalSender;
    results.push({
      event: guarded.event,
      confidenceOverall: clamp(Math.max(fallbackConfidence, 84), 0, 100),
      requiresHumanReview,
      reasonIfReviewNeeded:
        guarded.reviewReasons[0] || (requiresHumanReview ? "operational_appointment_fallback" : null),
    });
  }

  return dedupeFallbackEvents(results);
}

function deriveStudyFallbackHints(args: {
  sourceSubject: string;
  sourceSender: string;
  extractedText: string;
  attachmentMetadata: AttachmentMetadata[];
}): {
  preferStudyReport: boolean;
  preferredStudySubtype: "imaging" | "lab" | null;
  inferredImagingType: string | null;
  hasHumanHealthcareNoise: boolean;
} {
  const evidenceText = [
    args.sourceSubject,
    args.sourceSender,
    args.extractedText,
    args.attachmentMetadata.map((row) => row.filename).join(" "),
  ]
    .filter(Boolean)
    .join(" ");
  const inferredImagingType = inferImagingTypeFromSignals(evidenceText);
  const preferredStudySubtype = inferStudySubtypeFromSignals({
    rawStudySubtype: null,
    imagingType: inferredImagingType,
    labResults: [],
    descriptionSummary: evidenceText,
    diagnosis: null,
  });
  const preferStudyReport =
    preferredStudySubtype !== null ||
    /\b(radiograf|ecograf|\beco\b|ultrasound|ecocard|doppler|ecg|electrocard|hemograma|bioquim|analisis de sangre|extraccion de sangre|perfil hep|perfil renal|quimica sanguinea|laboratorio|rx\b|placa|koh|citolog|microscop)\b/i.test(
      evidenceText
    ) ||
    attachmentNamesContainClinicalSignal(args.attachmentMetadata);

  return {
    preferStudyReport,
    preferredStudySubtype,
    inferredImagingType,
    hasHumanHealthcareNoise: hasStrongHumanHealthcareSignal(evidenceText),
  };
}

export function buildFallbackClinicalExtraction(args: {
  sourceSubject: string;
  sourceSender: string;
  extractedText: string;
  emailDate: string;
  attachmentMetadata: AttachmentMetadata[];
  confidenceOverall?: number;
}): ClinicalFallbackResolution | null {
  return buildFallbackClinicalExtractions(args)[0] || null;
}

export function buildFallbackClinicalExtractions(args: {
  sourceSubject: string;
  sourceSender: string;
  extractedText: string;
  emailDate: string;
  attachmentMetadata: AttachmentMetadata[];
  confidenceOverall?: number;
}): ClinicalFallbackResolution[] {
  const fallbackConfidence = clamp(args.confidenceOverall ?? 62, 0, 100);
  const fullText = cleanSentence([args.sourceSubject, args.extractedText].filter(Boolean).join(" · "));
  if (!fullText) return [];
  if (hasVeterinaryAdministrativeOnlySignal(args)) return [];

  const hints = deriveStudyFallbackHints(args);
  if (hints.hasHumanHealthcareNoise && !hints.preferStudyReport) return [];

  const operationalEvents = extractOperationalFallbackEvents(args);
  if (operationalEvents.length > 0) return operationalEvents;

  if (hints.preferStudyReport) {
    const guarded = applyConstitutionalGuardrails({
      event_type: "study_report",
      event_date: extractAppointmentDateFromText(fullText, args.emailDate) || toIsoDateOnly(new Date(args.emailDate)),
      date_confidence: 68,
      description_summary: buildFallbackDescription(args.sourceSubject, args.extractedText, "Estudio clínico detectado"),
      diagnosis: null,
      medications: [],
      lab_results: [],
      imaging_type: hints.inferredImagingType,
      study_subtype: hints.preferredStudySubtype,
      appointment_time: null,
      appointment_specialty: null,
      professional_name: null,
      clinic_name: extractClinicNameFromText(fullText, args.sourceSender),
      appointment_status: null,
      severity: null,
      confidence_score: clamp(Math.max(fallbackConfidence, 72), 0, 100),
    });

    return [{
      event: guarded.event,
      confidenceOverall: clamp(Math.max(fallbackConfidence, 72), 0, 100),
      requiresHumanReview: true,
      reasonIfReviewNeeded: guarded.reviewReasons[0] || "study_fallback_from_attachment_signal",
    }];
  }

  if (!hasAppointmentSignal(fullText) && !hasStudySignal(fullText)) return [];
  return [];
}

export function resolveClinicalDocumentProcessingStatus(args: ClinicalDocumentDispositionArgs): string {
  if (args.reviewsForMessage > 0) return "requires_review";
  if (args.createdForMessage > 0) return "ingested";
  if (!args.isClinicalContent) return "discarded_non_clinical";

  const fallbacks = buildFallbackClinicalExtractions({
    sourceSubject: args.sourceSubject,
    sourceSender: args.sourceSender,
    extractedText: args.extractedText,
    emailDate: args.emailDate,
    attachmentMetadata: args.attachmentMetadata,
    confidenceOverall: 60,
  });
  if (fallbacks.some((row) => row.event)) {
    return fallbacks.some((row) => row.requiresHumanReview) ? "requires_review_no_extractable_event" : "ingested";
  }

  if (hasAppointmentSignal(cleanSentence([args.sourceSubject, args.extractedText].filter(Boolean).join(" · ")))) {
    return "discarded_operational_no_structured_event";
  }

  if (
    attachmentNamesContainClinicalSignal(args.attachmentMetadata) ||
    /\b(estudio|radiograf|ecograf|\beco\b|electrocard|ecocard|doppler|laboratorio|hemograma|bioquim|analisis de sangre|extraccion de sangre|perfil hep|perfil renal|sangre)\b/i.test(
      [args.sourceSubject, args.extractedText, args.reasonIfReviewNeeded].filter(Boolean).join(" ")
    )
  ) {
    return "requires_review_no_extractable_event";
  }

  return "discarded_no_extractable_event";
}
