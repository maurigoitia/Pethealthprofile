/**
 * Domain ingestion orchestration extracted from clinicalIngestion.ts
 * (Strangler Fig refactoring).
 *
 * Covers: taxonomy backfill, narrative history generation,
 * legacy mailsync cleanup, and supporting reconstruction / classification
 * helpers used by those top-level operations.
 */

import * as admin from "firebase-admin";
import * as functions from "firebase-functions";

import type {
  AppointmentEventStatus,
  ClinicalEventExtraction,
  ClinicalLabResult,
  ClinicalMedication,
  DomainIngestionType,
  EventType,
  GmailTaxonomyBackfillResult,
  LegacyCleanupAction,
  LegacyCleanupSample,
  LegacyMailsyncCleanupResult,
  NarrativeHistoryBackfillResult,
  NarrativePeriodType,
} from "./types";

import {
  LEGACY_DELETE_DOMAIN_HINTS,
  LEGACY_GENERIC_TITLES,
  LEGACY_OPERATIONAL_NOISE_REGEX,
  LEGACY_SALVAGE_STUDY_REGEX,
  MEDICATION_NAME_BLOCKLIST,
  MONTHLY_BUCKET_UNTIL_MONTHS,
  ONE_DAY_MS,
  RECENT_HISTORY_WINDOW_DAYS,
  STRUCTURED_DIAGNOSIS_HINT_REGEX,
} from "./types";

import {
  asNonNegativeNumber,
  asRecord,
  asString,
  clamp,
  cleanSentence,
  getNowIso,
  monthsBetween,
  normalizeClinicalToken,
  normalizeTextForMatch,
  sanitizeNarrativeLabel,
  sha256,
  toIsoDateOnly,
  uniqueNonEmpty,
} from "./utils";

import {
  buildCanonicalEventTitle,
  confidenceBucketToScore,
  extractAppointmentSpecialtyFromText,
  extractAppointmentTimeFromText,
  extractClinicNameFromText,
  extractProfessionalNameFromText,
  hasClinicSignalInText,
  hasMedicationOrTreatmentSignal,
  inferAppointmentStatusFromText,
  inferImagingTypeFromSignals,
  inferStudySubtypeFromSignals,
  isAppointmentEventType,
  isPrescriptionEventType,
  isStudyEventType,
  isVaccinationEventType,
  normalizeAppointmentStatusValue,
  normalizeExtractedEventType,
  shouldReplaceLegacyStoredTitle,
  toStoredClinicalLabResults,
  toStoredClinicalMedications,
} from "./clinicalNormalization";

import {
  buildDefaultExtractedData,
  extractOperationalAppointmentCandidate,
  upsertOperationalAppointmentProjection,
} from "./reviewActions";

import { hasStrongHumanHealthcareSignal } from "./emailParsing";

// ---------------------------------------------------------------------------
// Stored-event reconstruction (for taxonomy backfill)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Observation preservation guard
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Gmail Taxonomy Backfill
// ---------------------------------------------------------------------------

export async function runGmailTaxonomyBackfill(args: {
  uid: string;
  email?: string | null;
  dryRun?: boolean;
  limit?: number;
  includeAppointments?: boolean;
}): Promise<GmailTaxonomyBackfillResult> {
  const dryRun = args.dryRun !== false;
  const limit = clamp(asNonNegativeNumber(args.limit, 150), 1, 500);
  const includeAppointments = args.includeAppointments !== false;
  const result: GmailTaxonomyBackfillResult = {
    total_scanned: 0,
    eligible_email_events: 0,
    updated: 0,
    unchanged: 0,
    skipped_non_email: 0,
    skipped_unclassified: 0,
    appointment_projections_updated: 0,
    errors: 0,
    samples: [],
    error_details: [],
  };

  const snap = await admin.firestore().collection("medical_events").where("userId", "==", args.uid).limit(limit).get();
  result.total_scanned = snap.size;

  for (const doc of snap.docs) {
    const row = asRecord(doc.data());
    const extractedData = asRecord(row.extractedData);
    const source = asString(row.source);
    const sourceEmailId = asString(row.source_email_id);
    if (source !== "email_import" && !sourceEmailId) {
      result.skipped_non_email += 1;
      continue;
    }

    result.eligible_email_events += 1;
    const reconstructedEvent = reconstructStoredEventForTaxonomy(row);
    if (!reconstructedEvent) {
      result.skipped_unclassified += 1;
      continue;
    }

    const sourceDate = asString(extractedData.sourceReceivedAt) || asString(row.createdAt) || getNowIso();
    const nextExtractedData = {
      ...extractedData,
      ...buildDefaultExtractedData({
        event: reconstructedEvent,
        sourceDate,
        sourceSubject: asString(extractedData.sourceSubject),
        sourceSender: asString(extractedData.sourceSender),
      }),
    } as Record<string, unknown>;
    const rescuedAppointment = !isAppointmentEventType(reconstructedEvent.event_type)
      ? extractOperationalAppointmentCandidate({
          eventDate: asString(nextExtractedData.eventDate) || reconstructedEvent.event_date,
          sourceText: [
            asString(nextExtractedData.sourceSubject),
            asString(nextExtractedData.suggestedTitle),
            asString(nextExtractedData.aiGeneratedSummary),
            asString(nextExtractedData.observations),
            asString(row.title),
          ]
            .filter(Boolean)
            .join(" · "),
          sourceSender: asString(nextExtractedData.sourceSender),
          existingStatus: nextExtractedData.appointmentStatus,
          existingTime: nextExtractedData.appointmentTime,
          existingSpecialty: asString(asRecord(Array.isArray(nextExtractedData.detectedAppointments) ? nextExtractedData.detectedAppointments[0] : null).specialty),
          professionalName: asString(nextExtractedData.provider),
          clinicName: asString(nextExtractedData.clinic),
          diagnosis: asString(nextExtractedData.diagnosis),
          confidenceScore: reconstructedEvent.confidence_score,
        })
      : null;

    if (shouldPreserveExistingObservations({ row, extractedData })) {
      nextExtractedData.observations = extractedData.observations;
      nextExtractedData.observationsConfidence = extractedData.observationsConfidence || "medium";
    }

    const nextDomainType: DomainIngestionType =
      isAppointmentEventType(reconstructedEvent.event_type)
        ? "appointment"
        : isPrescriptionEventType(reconstructedEvent.event_type)
          ? "treatment"
          : isVaccinationEventType(reconstructedEvent.event_type)
            ? "vaccination"
            : "medical_event";

    const nextTitle = buildCanonicalEventTitle(reconstructedEvent).slice(0, 160);
    const nextFindings =
      reconstructedEvent.lab_results.length > 0
        ? reconstructedEvent.lab_results.map((item) => `${item.test_name}: ${item.result}`).join(" | ").slice(0, 1400)
        : null;

    const changes: string[] = [];
    if (asString(extractedData.taxonomyEventType) !== asString(nextExtractedData.taxonomyEventType)) changes.push("taxonomyEventType");
    if (asString(extractedData.documentType) !== asString(nextExtractedData.documentType)) changes.push("documentType");
    if (asString(extractedData.taxonomyRoute) !== asString(nextExtractedData.taxonomyRoute)) changes.push("taxonomyRoute");
    if (asString(extractedData.appointmentStatus) !== asString(nextExtractedData.appointmentStatus)) changes.push("appointmentStatus");
    if (asString(extractedData.studySubtype) !== asString(nextExtractedData.studySubtype)) changes.push("studySubtype");
    if (asString(extractedData.appointmentTime) !== asString(nextExtractedData.appointmentTime)) changes.push("appointmentTime");
    if (asString(extractedData.provider) !== asString(nextExtractedData.provider)) changes.push("provider");
    if (asString(extractedData.clinic) !== asString(nextExtractedData.clinic)) changes.push("clinic");
    if (asString(row.domain_ingestion_type) !== nextDomainType) changes.push("domain_ingestion_type");
    if (shouldReplaceLegacyStoredTitle(asString(row.title)) && asString(row.title) !== nextTitle) changes.push("title");
    if (asString(row.findings) !== asString(nextFindings)) changes.push("findings");

    if (changes.length === 0) {
      result.unchanged += 1;
      continue;
    }

    const sample = {
      docId: doc.id,
      title_before: asString(row.title) || null,
      title_after: shouldReplaceLegacyStoredTitle(asString(row.title)) ? nextTitle : asString(row.title) || null,
      taxonomy_before: asString(extractedData.taxonomyEventType) || null,
      taxonomy_after: asString(nextExtractedData.taxonomyEventType) || null,
      documentType_before: asString(extractedData.documentType) || null,
      documentType_after: asString(nextExtractedData.documentType) || null,
      changes,
    };
    if (result.samples.length < 20) result.samples.push(sample);

    if (dryRun) {
      result.updated += 1;
      continue;
    }

    try {
      const patch: Record<string, unknown> = {
        extractedData: nextExtractedData,
        domain_ingestion_type: nextDomainType,
        updatedAt: getNowIso(),
        findings: nextFindings,
      };
      if (shouldReplaceLegacyStoredTitle(asString(row.title))) patch.title = nextTitle;

      await doc.ref.set(patch, { merge: true });

      const projectionEvent = isAppointmentEventType(reconstructedEvent.event_type)
        ? reconstructedEvent
        : rescuedAppointment;
      if (includeAppointments && projectionEvent && asString(row.petId)) {
        await upsertOperationalAppointmentProjection({
          appointmentEventId: doc.id,
          petId: asString(row.petId),
          uid: args.uid,
          title: buildCanonicalEventTitle(projectionEvent),
          eventDate: projectionEvent.event_date || toIsoDateOnly(new Date(sourceDate)),
          event: projectionEvent,
          narrativeSummary: cleanSentence(
            [
              asString(nextExtractedData.aiGeneratedSummary),
              asString(nextExtractedData.sourceSubject),
              asString(row.title),
            ]
              .filter(Boolean)
              .join(" · ")
          ),
          sourceEmailId: sourceEmailId || `legacy_${doc.id}`,
          sourceTruthLevel: asString(row.sourceTruthLevel) || "ai_auto_ingested",
          effectiveRequiresConfirmation: row.requiresManualConfirmation === true || asString(row.workflowStatus) === "review_required",
          nowIso: asString(patch.updatedAt),
        });
        result.appointment_projections_updated += 1;
      }

      result.updated += 1;
    } catch (error) {
      result.errors += 1;
      const message = error instanceof Error ? error.message : String(error);
      result.error_details.push({ docId: doc.id, error: message });
    }
  }

  functions.logger.info("[gmail-taxonomy-backfill] completed", {
    uid: args.uid,
    email: args.email || null,
    dryRun,
    limit,
    result,
  });
  return result;
}

// ---------------------------------------------------------------------------
// Legacy mailsync cleanup helpers
// ---------------------------------------------------------------------------

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

export function classifyLegacyMailsyncEvent(docId: string, row: Record<string, unknown>): LegacyCleanupSample {
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

export async function deleteLegacyEventArtifacts(eventId: string): Promise<number> {
  let deleted = 0;
  const collections = [
    { name: "appointments", field: "sourceEventId" },
    { name: "pending_actions", field: "sourceEventId" },
    { name: "gmail_event_reviews", field: "eventId" },
  ];

  for (const target of collections) {
    const snap = await admin.firestore().collection(target.name).where(target.field, "==", eventId).limit(25).get();
    for (const doc of snap.docs) {
      await doc.ref.delete();
      deleted += 1;
    }
  }

  return deleted;
}

// ---------------------------------------------------------------------------
// Legacy mailsync cleanup orchestrator
// ---------------------------------------------------------------------------

export async function runLegacyMailsyncCleanup(args: {
  uid: string;
  email?: string | null;
  petId?: string | null;
  dryRun?: boolean;
  limit?: number;
  refreshNarrative?: boolean;
}): Promise<LegacyMailsyncCleanupResult> {
  const dryRun = args.dryRun !== false;
  const limit = clamp(asNonNegativeNumber(args.limit, 200), 1, 500);
  const result: LegacyMailsyncCleanupResult = {
    total_scanned: 0,
    eligible_legacy_events: 0,
    delete_candidates: 0,
    salvage_candidates: 0,
    deleted: 0,
    skipped: 0,
    artifacts_deleted: 0,
    errors: 0,
    narrative_refreshed: false,
    samples: [],
    error_details: [],
  };

  let query: FirebaseFirestore.Query = admin.firestore().collection("medical_events").where("userId", "==", args.uid);
  if (args.petId) query = query.where("petId", "==", args.petId);
  const snap = await query.limit(limit).get();
  result.total_scanned = snap.size;

  for (const doc of snap.docs) {
    const row = asRecord(doc.data());
    const extractedData = asRecord(row.extractedData);
    if (!isLegacyMailsyncEvent(doc.id, row, extractedData)) {
      result.skipped += 1;
      continue;
    }

    result.eligible_legacy_events += 1;
    const sample = classifyLegacyMailsyncEvent(doc.id, row);
    if (sample.action === "delete") result.delete_candidates += 1;
    if (sample.action === "salvage") result.salvage_candidates += 1;
    if (result.samples.length < 40) result.samples.push(sample);

    if (sample.action !== "delete") continue;
    if (dryRun) {
      result.deleted += 1;
      continue;
    }

    try {
      result.artifacts_deleted += await deleteLegacyEventArtifacts(doc.id);
      await doc.ref.delete();
      result.deleted += 1;
    } catch (error) {
      result.errors += 1;
      const message = error instanceof Error ? error.message : String(error);
      result.error_details.push({ docId: doc.id, error: message });
    }
  }

  if (!dryRun && args.refreshNarrative !== false && result.deleted > 0) {
    await runNarrativeHistoryBackfill({
      uid: args.uid,
      email: args.email || null,
      petId: args.petId || null,
      dryRun: false,
      limit: 250,
    });
    result.narrative_refreshed = true;
  }

  functions.logger.info("[gmail-legacy-cleanup] completed", {
    uid: args.uid,
    email: args.email || null,
    petId: args.petId || null,
    dryRun,
    limit,
    result,
  });

  return result;
}

// ---------------------------------------------------------------------------
// Narrative history helpers
// ---------------------------------------------------------------------------

export function buildNarrativeThreadLabel(event: ClinicalEventExtraction): string {
  if (isVaccinationEventType(event.event_type)) return "Vacunación";
  if (isPrescriptionEventType(event.event_type)) {
    const med = sanitizeNarrativeLabel(asString(event.medications[0]?.name), "");
    return med || "Tratamiento";
  }
  if (isAppointmentEventType(event.event_type)) {
    const specialty = sanitizeNarrativeLabel(event.appointment_specialty || "", "");
    return specialty || "Agenda veterinaria";
  }
  if (isStudyEventType(event.event_type)) {
    if (event.study_subtype === "imaging") {
      return sanitizeNarrativeLabel(event.imaging_type || "", "Estudios por imágenes");
    }
    return "Laboratorio";
  }
  return sanitizeNarrativeLabel(event.diagnosis || "", "Seguimiento clínico");
}

export function summarizeNarrativeDiagnosis(value: string | null): string | null {
  const cleaned = sanitizeNarrativeLabel(asString(value), "");
  if (!cleaned) return null;
  const [firstSentence] = cleaned.split(/(?<=[.!?])\s+/);
  return (firstSentence || cleaned).slice(0, 180);
}

export function buildNarrativePeriodMeta(timestamp: number, nowTimestamp: number): {
  periodType: NarrativePeriodType;
  periodKey: string;
  periodLabel: string;
  yearKey: string;
  fromDate: string;
  toDate: string;
} {
  const parsed = new Date(timestamp);
  const monthsAgo = monthsBetween(nowTimestamp, timestamp);
  const yearKey = String(parsed.getFullYear());
  if (monthsAgo > MONTHLY_BUCKET_UNTIL_MONTHS) {
    return {
      periodType: "year",
      periodKey: yearKey,
      periodLabel: yearKey,
      yearKey,
      fromDate: `${yearKey}-01-01`,
      toDate: `${yearKey}-12-31`,
    };
  }

  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const periodKey = `${yearKey}-${month}`;
  const monthLabel = parsed.toLocaleDateString("es-AR", { month: "long", year: "numeric" });
  const lastDay = new Date(parsed.getFullYear(), parsed.getMonth() + 1, 0).getDate();
  return {
    periodType: "month",
    periodKey,
    periodLabel: monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1),
    yearKey,
    fromDate: `${yearKey}-${month}-01`,
    toDate: `${yearKey}-${month}-${String(lastDay).padStart(2, "0")}`,
  };
}

export function buildNarrativeEpisodeRecord(args: {
  uid: string;
  petId: string;
  petName: string;
  periodMeta: ReturnType<typeof buildNarrativePeriodMeta>;
  threadLabel: string;
  events: Array<{ id: string; event: ClinicalEventExtraction; row: Record<string, unknown>; timestamp: number }>;
}): Record<string, unknown> {
  const diagnoses = uniqueNonEmpty(
    args.events.map((item) => summarizeNarrativeDiagnosis(item.event.diagnosis)).filter(Boolean) as string[]
  ).slice(0, 3);

  const medications = uniqueNonEmpty(
    args.events.flatMap((item) => item.event.medications.map((medication) => sanitizeNarrativeLabel(medication.name, "")))
  ).slice(0, 3);

  const providers = uniqueNonEmpty(
    args.events.flatMap((item) => [sanitizeNarrativeLabel(item.event.professional_name || "", ""), sanitizeNarrativeLabel(item.event.clinic_name || "", "")])
  ).filter(Boolean).slice(0, 2);

  const imagingCount = args.events.filter((item) => isStudyEventType(item.event.event_type) && item.event.study_subtype === "imaging").length;
  const appointmentCount = args.events.filter((item) => isAppointmentEventType(item.event.event_type)).length;
  const treatmentCount = args.events.filter((item) => isPrescriptionEventType(item.event.event_type)).length;
  const highlights = [
    diagnoses[0] ? `Patología principal: ${diagnoses[0]}` : "",
    medications[0] ? `Medicación: ${medications[0]}` : "",
    imagingCount > 0 ? `${imagingCount} estudio${imagingCount === 1 ? "" : "s"} de imagen` : "",
    treatmentCount > 0 && !medications[0] ? `${treatmentCount} indicación${treatmentCount === 1 ? "" : "es"} terapéutica${treatmentCount === 1 ? "" : "s"}` : "",
  ].filter(Boolean).slice(0, 3);

  const narrative = [
    diagnoses.length > 0
      ? `En ${args.periodMeta.periodLabel} ${args.petName} tuvo seguimiento por ${diagnoses.join(", ")}.`
      : imagingCount > 0
        ? `En ${args.periodMeta.periodLabel} ${args.petName} tuvo ${imagingCount} estudio${imagingCount === 1 ? "" : "s"} por imágenes y controles asociados.`
        : appointmentCount > 0
          ? `En ${args.periodMeta.periodLabel} ${args.petName} tuvo seguimiento veterinario con ${appointmentCount} turno${appointmentCount === 1 ? "" : "s"} o recordatorio${appointmentCount === 1 ? "" : "s"}.`
          : `En ${args.periodMeta.periodLabel} ${args.petName} tuvo seguimiento clínico registrado.`,
    medications.length > 0 ? `También estuvo medicado con ${medications.join(", ")}.` : "",
    providers.length > 0 ? `Intervinieron ${providers.join(" · ")}.` : "",
  ].filter(Boolean).slice(0, 3).join(" ");

  return {
    episodio_id: `hep_${sha256(`${args.uid}_${args.petId}_${args.periodMeta.periodKey}_${args.threadLabel}`).slice(0, 24)}`,
    userId: args.uid,
    petId: args.petId,
    petName: args.petName,
    periodType: args.periodMeta.periodType,
    periodKey: args.periodMeta.periodKey,
    periodLabel: args.periodMeta.periodLabel,
    yearKey: args.periodMeta.yearKey,
    titulo_narrativo: sanitizeNarrativeLabel(args.threadLabel, "Resumen clínico"),
    headline: sanitizeNarrativeLabel(args.threadLabel, "Resumen clínico"),
    resumen: narrative,
    narrative,
    diagnosticos_clave: diagnoses,
    medicacion_relevante: medications,
    hitos: highlights,
    eventos_referenciados: args.events.map((item) => item.id),
    links: args.events.map((item) => item.id),
    providers,
    confianza_ia: 0.95,
    requires_review: false,
    source_mode: "derived_history_v1",
    generated_at: getNowIso(),
    event_count: args.events.length,
  };
}

export function buildAnnualSummaryRecord(args: {
  uid: string;
  petId: string;
  petName: string;
  yearKey: string;
  events: Array<{ id: string; event: ClinicalEventExtraction; row: Record<string, unknown>; timestamp: number }>;
}): Record<string, unknown> {
  const diagnoses = uniqueNonEmpty(
    args.events.map((item) => summarizeNarrativeDiagnosis(item.event.diagnosis)).filter(Boolean) as string[]
  ).slice(0, 3);
  const medications = uniqueNonEmpty(
    args.events.flatMap((item) => item.event.medications.map((medication) => sanitizeNarrativeLabel(medication.name, "")))
  ).slice(0, 3);
  const providers = uniqueNonEmpty(
    args.events.flatMap((item) => [sanitizeNarrativeLabel(item.event.professional_name || "", ""), sanitizeNarrativeLabel(item.event.clinic_name || "", "")])
  ).filter(Boolean).slice(0, 2);
  const dominantDiagnosis = diagnoses[0] || medications[0] || "seguimiento clínico";
  const highlights = [
    dominantDiagnosis ? `Patología principal: ${dominantDiagnosis}` : "",
    medications[0] ? `Medicación crónica: ${medications[0]}` : "",
    providers[0] ? `Prestador frecuente: ${providers[0]}` : "",
  ].filter(Boolean);

  return {
    headline: `Anuario ${args.yearKey}`,
    narrative: [
      `Durante ${args.yearKey}, ${args.petName} asistió principalmente a ${providers[0] || "sus prestadores habituales"}.`,
      `Presentó principalmente ${dominantDiagnosis}.`,
      medications[0] ? `La medicación más repetida fue ${medications[0]}.` : "",
    ].filter(Boolean).slice(0, 3).join(" "),
    highlights,
    diagnosticos_clave: diagnoses,
    medicacion_relevante: medications,
    providers,
    confidence_ia: 0.94,
  };
}

// ---------------------------------------------------------------------------
// Narrative history – delete existing
// ---------------------------------------------------------------------------

export async function deleteExistingNarrativeHistory(args: {
  uid: string;
  petId?: string | null;
}): Promise<{ buckets: number; episodes: number }> {
  const collections: Array<{ name: "history_buckets" | "history_episodes"; key: "buckets" | "episodes" }> = [
    { name: "history_buckets", key: "buckets" },
    { name: "history_episodes", key: "episodes" },
  ];
  const deleted = { buckets: 0, episodes: 0 };

  for (const collection of collections) {
    const snap = await admin.firestore().collection(collection.name).where("userId", "==", args.uid).limit(500).get();
    if (snap.empty) continue;
    const batch = admin.firestore().batch();
    let count = 0;
    for (const doc of snap.docs) {
      const row = asRecord(doc.data());
      if (asString(row.source_mode || row.sourceMode) !== "derived_history_v1") continue;
      if (args.petId && asString(row.petId) !== args.petId) continue;
      batch.delete(doc.ref);
      count += 1;
    }
    if (count > 0) {
      await batch.commit();
      deleted[collection.key] += count;
    }
  }

  return deleted;
}

// ---------------------------------------------------------------------------
// Narrative history backfill orchestrator
// ---------------------------------------------------------------------------

export async function runNarrativeHistoryBackfill(args: {
  uid: string;
  email?: string | null;
  petId?: string | null;
  dryRun?: boolean;
  limit?: number;
}): Promise<NarrativeHistoryBackfillResult> {
  const dryRun = args.dryRun !== false;
  const limit = clamp(asNonNegativeNumber(args.limit, 250), 25, 1000);
  const nowTimestamp = Date.now();
  const recentCutoff = nowTimestamp - RECENT_HISTORY_WINDOW_DAYS * ONE_DAY_MS;
  const result: NarrativeHistoryBackfillResult = {
    total_scanned: 0,
    eligible_events: 0,
    buckets_written: 0,
    episodes_written: 0,
    buckets_deleted: 0,
    episodes_deleted: 0,
    yearly_summaries_written: 0,
    errors: 0,
    sample_bucket_ids: [],
    sample_episode_ids: [],
  };

  const petNameCache = new Map<string, string>();
  const fetchPetName = async (petId: string): Promise<string> => {
    if (petNameCache.has(petId)) return petNameCache.get(petId)!;
    const petSnap = await admin.firestore().collection("pets").doc(petId).get();
    const petName = sanitizeNarrativeLabel(asString(asRecord(petSnap.data()).name), "Mascota");
    petNameCache.set(petId, petName);
    return petName;
  };

  const snap = await admin.firestore().collection("medical_events").where("userId", "==", args.uid).limit(limit).get();
  result.total_scanned = snap.size;

  const eligibleEvents: Array<{
    id: string;
    row: Record<string, unknown>;
    event: ClinicalEventExtraction;
    timestamp: number;
    petId: string;
    petName: string;
  }> = [];

  for (const doc of snap.docs) {
    const row = asRecord(doc.data());
    const petId = asString(row.petId);
    if (!petId) continue;
    if (args.petId && petId !== args.petId) continue;
    if (asString(row.status) === "processing" || asString(row.status) === "draft") continue;
    if (asString(row.workflowStatus) === "review_required" || asString(row.workflowStatus) === "invalid_future_date") continue;
    if (row.requiresManualConfirmation === true) continue;
    const reconstructed = reconstructStoredEventForTaxonomy(row);
    if (!reconstructed) continue;
    const timestamp = Date.parse(reconstructed.event_date || asString(row.createdAt) || "");
    if (!Number.isFinite(timestamp) || timestamp >= recentCutoff) continue;
    eligibleEvents.push({
      id: doc.id,
      row,
      event: reconstructed,
      timestamp,
      petId,
      petName: await fetchPetName(petId),
    });
  }

  result.eligible_events = eligibleEvents.length;

  const bucketDocs = new Map<string, Record<string, unknown>>();
  const episodeDocs = new Map<string, Record<string, unknown>>();
  const annualGroups = new Map<string, Array<typeof eligibleEvents[number]>>();
  const bucketEventCounts = new Map<string, number>();

  for (const item of eligibleEvents) {
    const periodMeta = buildNarrativePeriodMeta(item.timestamp, nowTimestamp);
    const threadLabel = buildNarrativeThreadLabel(item.event);
    const bucketId = `hb_${sha256(`${args.uid}_${item.petId}_${periodMeta.periodType}_${periodMeta.periodKey}`).slice(0, 24)}`;
    const bucketKey = `${bucketId}::${threadLabel}`;
    const yearGroupKey = `${item.petId}::${periodMeta.yearKey}`;

    if (!annualGroups.has(yearGroupKey)) annualGroups.set(yearGroupKey, []);
    annualGroups.get(yearGroupKey)!.push(item);

    bucketEventCounts.set(bucketId, (bucketEventCounts.get(bucketId) || 0) + 1);

    const episodeKey = `${bucketKey}`;
    const existing = episodeDocs.get(episodeKey) as { __events?: typeof eligibleEvents } | undefined;
    const nextEvents = existing?.__events ? [...existing.__events, item] : [item];

    const episodeRecord = buildNarrativeEpisodeRecord({
      uid: args.uid,
      petId: item.petId,
      petName: item.petName,
      periodMeta,
      threadLabel,
      events: nextEvents.map((entry) => ({
        id: entry.id,
        event: entry.event,
        row: entry.row,
        timestamp: entry.timestamp,
      })),
    }) as Record<string, unknown> & { __events?: typeof eligibleEvents };

    episodeRecord.bucketId = bucketId;
    episodeRecord.thread_label = threadLabel;
    episodeRecord.__events = nextEvents;
    episodeDocs.set(episodeKey, episodeRecord);

    bucketDocs.set(bucketId, {
      bucketId,
      userId: args.uid,
      petId: item.petId,
      petName: item.petName,
      periodType: periodMeta.periodType,
      periodKey: periodMeta.periodKey,
      periodLabel: periodMeta.periodLabel,
      yearKey: periodMeta.yearKey,
      from: periodMeta.fromDate,
      to: periodMeta.toDate,
      sourceMode: "derived_history_v1",
      generatedAt: getNowIso(),
      updatedAt: getNowIso(),
    });
  }

  for (const [bucketId, bucket] of bucketDocs.entries()) {
    const episodesForBucket = Array.from(episodeDocs.values()).filter((episode) => asString(episode.bucketId) === bucketId);
    const eventCount = bucketEventCounts.get(bucketId) || 0;
    bucket.eventCount = eventCount;
    bucket.episodeCount = episodesForBucket.length;
    if (bucket.periodType === "month" && eventCount > 10) {
      bucket.densityMode = "compacted";
      bucket.bucket_summary = {
        headline: `Mes de alta intensidad clínica`,
        narrative: `Durante ${asString(bucket.periodLabel)}, ${asString(bucket.petName)} tuvo ${eventCount} eventos confirmados. PESSY los comprimió en episodios narrativos para lectura rápida.`,
      };
    }
  }

  for (const [annualKey, events] of annualGroups.entries()) {
    const [petId, yearKey] = annualKey.split("::");
    const first = events[0];
    const annualBucketId = `hb_${sha256(`${args.uid}_${petId}_year_${yearKey}`).slice(0, 24)}`;
    const annualBucket = bucketDocs.get(annualBucketId) || {
      bucketId: annualBucketId,
      userId: args.uid,
      petId,
      petName: first.petName,
      periodType: "year",
      periodKey: yearKey,
      periodLabel: yearKey,
      yearKey,
      from: `${yearKey}-01-01`,
      to: `${yearKey}-12-31`,
      sourceMode: "derived_history_v1",
      generatedAt: getNowIso(),
      updatedAt: getNowIso(),
    };
    annualBucket.eventCount = events.length;
    annualBucket.annual_summary = buildAnnualSummaryRecord({
      uid: args.uid,
      petId,
      petName: first.petName,
      yearKey,
      events: events.map((entry) => ({
        id: entry.id,
        event: entry.event,
        row: entry.row,
        timestamp: entry.timestamp,
      })),
    });
    bucketDocs.set(annualBucketId, annualBucket);
  }

  if (!dryRun) {
    const deleted = await deleteExistingNarrativeHistory({
      uid: args.uid,
      petId: args.petId || null,
    });
    result.buckets_deleted = deleted.buckets;
    result.episodes_deleted = deleted.episodes;

    const allBucketDocs = Array.from(bucketDocs.values());
    const allEpisodeDocs = Array.from(episodeDocs.values()).map((episode) => {
      const clone = { ...episode };
      delete clone.__events;
      return clone;
    });

    for (const bucket of allBucketDocs) {
      await admin.firestore().collection("history_buckets").doc(asString(bucket.bucketId)).set(bucket, { merge: true });
      result.buckets_written += 1;
      if (result.sample_bucket_ids.length < 10) result.sample_bucket_ids.push(asString(bucket.bucketId));
      if (bucket.annual_summary) result.yearly_summaries_written += 1;
    }

    for (const episode of allEpisodeDocs) {
      await admin.firestore().collection("history_episodes").doc(asString(episode.episodio_id)).set(episode, { merge: true });
      result.episodes_written += 1;
      if (result.sample_episode_ids.length < 10) result.sample_episode_ids.push(asString(episode.episodio_id));
    }
  } else {
    result.buckets_written = bucketDocs.size;
    result.episodes_written = episodeDocs.size;
    result.yearly_summaries_written = Array.from(bucketDocs.values()).filter((bucket) => Boolean(bucket.annual_summary)).length;
    result.sample_bucket_ids = Array.from(bucketDocs.keys()).slice(0, 10);
    result.sample_episode_ids = Array.from(episodeDocs.values()).map((episode) => asString(episode.episodio_id)).slice(0, 10);
  }

  return result;
}
