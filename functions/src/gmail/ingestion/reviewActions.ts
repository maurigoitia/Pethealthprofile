/**
 * Review / persistence functions extracted from clinicalIngestion.ts
 * (Strangler Fig refactoring).
 *
 * Covers: review-event persistence, pending-action upserts, clinical-review
 * drafts, deduplication (fingerprint + semantic), brain-sync mirroring,
 * appointment-projection management, and the main domain-ingestion
 * orchestrator (`ingestEventToDomain`).
 */

import * as admin from "firebase-admin";

import type {
  AppointmentEventStatus,
  AttachmentMetadata,
  ClinicalEventExtraction,
  DomainIngestionType,
  EventType,
} from "./types";

import { ONE_DAY_MS } from "./types";

import {
  asNonNegativeNumber,
  asRecord,
  asString,
  clamp,
  cleanSentence,
  dateProximityScore,
  getNowIso,
  jaccardSimilarity,
  normalizeForHash,
  normalizeClinicalToken,
  parseDateOnly,
  sanitizeReferenceRange,
  sha256,
  toIsoDateOnly,
} from "./utils";

import {
  buildCanonicalEventTitle,
  deriveAppointmentLabel,
  extractAppointmentSpecialtyFromText,
  extractAppointmentTimeFromText,
  extractClinicNameFromText,
  extractProfessionalNameFromText,
  hasMedicationOrTreatmentSignal,
  inferImagingDocumentType,
  isAppointmentEventType,
  isPrescriptionEventType,
  isStudyEventType,
  isVaccinationEventType,
  medicationHasDoseAndFrequency,
  normalizeAppointmentStatusValue,
  sanitizeAppointmentTime,
  sanitizeExtractedEntity,
} from "./clinicalNormalization";

import { getSilentApprovalWindowHours } from "./envConfig";

import { resolveBrainOutput } from "../../clinical/brainResolver";

// ---------------------------------------------------------------------------
// Review event persistence
// ---------------------------------------------------------------------------

export async function persistReviewEvent(args: {
  uid: string;
  petId: string | null;
  sessionId: string;
  sourceEmailId: string;
  sourceSubject: string;
  sourceSender: string;
  sourceDate: string;
  event: ClinicalEventExtraction;
  overallConfidence: number;
  narrativeSummary: string;
  reason: string;
}): Promise<string> {
  const docId = `${args.sessionId}_${sha256(JSON.stringify(args.event)).slice(0, 12)}`;
  const silentApprovalExpiresAt = new Date(Date.now() + getSilentApprovalWindowHours() * 60 * 60 * 1000).toISOString();
  await admin.firestore().collection("gmail_event_reviews").doc(docId).set(
    {
      user_id: args.uid,
      pet_id: args.petId,
      session_id: args.sessionId,
      status: "pending",
      reason: args.reason,
      confidence_overall: args.overallConfidence,
      event: args.event,
      narrative_summary: args.narrativeSummary,
      source_email: {
        message_id: args.sourceEmailId,
        subject: args.sourceSubject,
        sender: args.sourceSender,
        date: args.sourceDate,
      },
      silent_approval_expires_at: silentApprovalExpiresAt,
      created_at: getNowIso(),
      updated_at: getNowIso(),
    },
    { merge: true }
  );
  return docId;
}

// ---------------------------------------------------------------------------
// Medical-event document-type mapping
// ---------------------------------------------------------------------------

export function toMedicalEventDocumentType(event: ClinicalEventExtraction):
  "appointment" | "medication" | "vaccine" | "lab_test" | "xray" | "echocardiogram" | "electrocardiogram" | "checkup" | "other" {
  if (isAppointmentEventType(event.event_type)) return "appointment";
  if (isPrescriptionEventType(event.event_type)) return "medication";
  if (isVaccinationEventType(event.event_type)) return "vaccine";
  if (isStudyEventType(event.event_type)) {
    return event.study_subtype === "imaging" ? inferImagingDocumentType(event) : "lab_test";
  }
  if (event.event_type === "clinical_report") return "checkup";
  return "other";
}

// ---------------------------------------------------------------------------
// Default extracted-data payload builder
// ---------------------------------------------------------------------------

export function buildDefaultExtractedData(args: {
  event: ClinicalEventExtraction;
  sourceDate: string;
  sourceSubject: string;
  sourceSender: string;
  sourceAttachment?: AttachmentMetadata | null;
}): Record<string, unknown> {
  const eventDate = args.event.event_date || toIsoDateOnly(new Date(args.sourceDate));
  const documentType = toMedicalEventDocumentType(args.event);
  const confidence =
    args.event.confidence_score >= 85 ? "high" : args.event.confidence_score >= 60 ? "medium" : "low";
  const appointmentConfidence =
    args.event.date_confidence >= 85 ? "high" : args.event.date_confidence >= 60 ? "medium" : "low";
  const meds = args.event.medications.map((med) => ({
    name: med.name,
    dosage: med.dose,
    frequency: med.frequency,
    duration: med.duration_days ? `${med.duration_days} días` : null,
    confidence,
  }));

  const findings = args.event.lab_results.map((row) => ({
    name: row.test_name,
    value: row.result,
    unit: row.unit,
    referenceRange: sanitizeReferenceRange(row.reference_range, row.result),
    confidence,
  }));
  const suggestedTitle = buildCanonicalEventTitle(args.event).slice(0, 120);
  const appointmentLabel = deriveAppointmentLabel(args.event) || suggestedTitle;
  const sourceStorageUri = asString(args.sourceAttachment?.storage_uri) || null;
  const sourceStoragePath = asString(args.sourceAttachment?.storage_path) || null;
  const sourceStorageSignedUrl = asString(args.sourceAttachment?.storage_signed_url) || null;
  const sourceFileName = asString(args.sourceAttachment?.filename) || null;
  const sourceMimeType = asString(args.sourceAttachment?.mimetype) || null;
  const detectedAppointments = isAppointmentEventType(args.event.event_type)
    ? [
        {
          date: eventDate,
          time: args.event.appointment_time,
          title: appointmentLabel,
          specialty: args.event.appointment_specialty,
          clinic: args.event.clinic_name,
          provider: args.event.professional_name,
          status: args.event.appointment_status,
          confidence: appointmentConfidence,
        },
      ]
    : [];

  return {
    documentType,
    documentTypeConfidence: confidence,
    eventDate,
    eventDateConfidence: appointmentConfidence,
    appointmentTime: args.event.appointment_time,
    detectedAppointments,
    clinic: args.event.clinic_name,
    provider: args.event.professional_name,
    providerConfidence: args.event.professional_name ? confidence : "not_detected",
    diagnosis: args.event.diagnosis,
    diagnosisConfidence: args.event.diagnosis ? "medium" : "not_detected",
    observations: null,
    observationsConfidence: "not_detected",
    medications: meds,
    nextAppointmentDate: null,
    nextAppointmentReason: null,
    nextAppointmentConfidence: "not_detected",
    suggestedTitle,
    aiGeneratedSummary: args.event.description_summary,
    measurements: findings,
    taxonomyEventType: args.event.event_type,
    taxonomyRoute:
      isAppointmentEventType(args.event.event_type)
        ? "operational_appointment"
        : isStudyEventType(args.event.event_type)
          ? "study_report"
          : isPrescriptionEventType(args.event.event_type)
            ? "prescription_record"
            : isVaccinationEventType(args.event.event_type)
              ? "vaccination_record"
              : "clinical_report",
    appointmentStatus: args.event.appointment_status,
    studySubtype: args.event.study_subtype,
    sourceReceivedAt: args.sourceDate,
    sourceSubject: args.sourceSubject,
    sourceSender: args.sourceSender,
    sourceFileName,
    sourceStorageUri,
    sourceStoragePath,
    sourceStorageSignedUrl,
    sourceMimeType,
  };
}

// ---------------------------------------------------------------------------
// Incomplete treatment subtitle
// ---------------------------------------------------------------------------

export function buildIncompleteTreatmentSubtitle(event: ClinicalEventExtraction): string {
  const incomplete = event.medications
    .filter((med) => !medicationHasDoseAndFrequency(med))
    .map((med) => {
      const medName = asString(med.name) || "medicación";
      const missing: string[] = [];
      if (!asString(med.dose)) missing.push("dosis");
      if (!asString(med.frequency)) missing.push("frecuencia");
      return `${medName} (falta ${missing.join(" y ")})`;
    })
    .slice(0, 3);

  if (incomplete.length === 0) {
    return "Detectamos tratamiento, pero falta confirmar dosis o frecuencia antes de activar alarmas.";
  }
  return `Detectamos tratamiento incompleto: ${incomplete.join(", ")}. Confirmá los datos para activar recordatorios.`;
}

// ---------------------------------------------------------------------------
// Attachment selection for review
// ---------------------------------------------------------------------------

export function selectBestAttachmentForReview(attachmentMetadata: AttachmentMetadata[]): AttachmentMetadata | null {
  if (!Array.isArray(attachmentMetadata) || attachmentMetadata.length === 0) return null;
  const withSignedUrl = attachmentMetadata.find((row) => Boolean(asString(row.storage_signed_url)));
  if (withSignedUrl) return withSignedUrl;
  const withStoredUri = attachmentMetadata.find((row) => Boolean(asString(row.storage_uri)));
  if (withStoredUri) return withStoredUri;
  return attachmentMetadata[0] || null;
}

// ---------------------------------------------------------------------------
// Clinical review draft upsert
// ---------------------------------------------------------------------------

export async function upsertClinicalReviewDraft(args: {
  uid: string;
  petId: string;
  sessionId: string;
  canonicalEventId: string;
  sourceEmailId: string;
  sourceSubject: string;
  sourceSender: string;
  sourceDate: string;
  event: ClinicalEventExtraction;
  attachmentMetadata: AttachmentMetadata[];
  gmailReviewId?: string | null;
}): Promise<string> {
  const reviewId = `review_${sha256(`${args.uid}_${args.canonicalEventId}`).slice(0, 24)}`;
  const nowIso = getNowIso();
  const selectedAttachment = selectBestAttachmentForReview(args.attachmentMetadata);
  const sourceStorageUri = asString(selectedAttachment?.storage_uri) || null;
  const sourceStoragePath = asString(selectedAttachment?.storage_path) || null;
  const sourceStorageSignedUrl = asString(selectedAttachment?.storage_signed_url) || null;
  const sourceFileName = asString(selectedAttachment?.filename) || null;
  const sourceMimeType = asString(selectedAttachment?.mimetype) || null;
  const imageFragmentUrl = sourceStorageSignedUrl || sourceStorageUri || null;

  const missingFields = args.event.medications
    .filter((medication) => !medicationHasDoseAndFrequency(medication))
    .map((medication) => ({
      medication: asString(medication.name) || null,
      missingDose: !asString(medication.dose),
      missingFrequency: !asString(medication.frequency),
      detectedDose: asString(medication.dose) || null,
      detectedFrequency: asString(medication.frequency) || null,
    }));

  await admin.firestore().collection("clinical_review_drafts").doc(reviewId).set(
    {
      id: reviewId,
      userId: args.uid,
      petId: args.petId,
      sessionId: args.sessionId,
      generatedFromEventId: args.canonicalEventId,
      status: "pending",
      validationStatus: "needs_review",
      reviewType: "incomplete_treatment_data",
      reviewReason: "missing_treatment_dose_or_frequency",
      isDraft: true,
      is_draft: true,
      sourceMessageId: args.sourceEmailId,
      source_message_id: args.sourceEmailId,
      sourceSubject: args.sourceSubject.slice(0, 400),
      source_subject: args.sourceSubject.slice(0, 400),
      sourceSender: args.sourceSender.slice(0, 320),
      source_sender: args.sourceSender.slice(0, 320),
      sourceDate: args.sourceDate,
      source_date: args.sourceDate,
      sourceFileName,
      source_file_name: sourceFileName,
      sourceMimeType,
      source_mime_type: sourceMimeType,
      sourceStorageUri,
      source_storage_uri: sourceStorageUri,
      sourceStoragePath,
      source_file_path: sourceStoragePath,
      sourceStorageSignedUrl,
      source_signed_url: sourceStorageSignedUrl,
      imageFragmentUrl,
      image_fragment_url: imageFragmentUrl,
      gmailReviewId: asString(args.gmailReviewId) || null,
      missingFields,
      missing_fields: missingFields,
      medications: args.event.medications.map((medication) => ({
        name: asString(medication.name) || null,
        dose: asString(medication.dose) || null,
        frequency: asString(medication.frequency) || null,
        duration_days: medication.duration_days || null,
        is_active: medication.is_active !== false,
      })),
      diagnosis: asString(args.event.diagnosis) || null,
      eventDate: asString(args.event.event_date) || null,
      createdAt: nowIso,
      updatedAt: nowIso,
      resolvedAt: null,
      resolvedBy: null,
    },
    { merge: true }
  );

  return reviewId;
}

// ---------------------------------------------------------------------------
// Incomplete-treatment pending action
// ---------------------------------------------------------------------------

export async function upsertIncompleteTreatmentPendingAction(args: {
  uid: string;
  petId: string;
  sessionId: string;
  canonicalEventId: string;
  sourceEmailId: string;
  event: ClinicalEventExtraction;
  reviewId: string;
  sourceAttachment?: AttachmentMetadata | null;
}): Promise<void> {
  const pendingId = `incomplete_treatment_${args.canonicalEventId}`;
  const nowIso = getNowIso();
  const sourceStorageUri = asString(args.sourceAttachment?.storage_uri) || null;
  const sourceStoragePath = asString(args.sourceAttachment?.storage_path) || null;
  const sourceStorageSignedUrl = asString(args.sourceAttachment?.storage_signed_url) || null;
  const sourceFileName = asString(args.sourceAttachment?.filename) || null;
  const sourceMimeType = asString(args.sourceAttachment?.mimetype) || null;
  const imageFragmentUrl = sourceStorageSignedUrl || sourceStorageUri || null;
  await admin.firestore().collection("pending_actions").doc(pendingId).set(
    {
      id: pendingId,
      petId: args.petId,
      userId: args.uid,
      type: "incomplete_data",
      title: "Completar tratamiento detectado",
      subtitle: buildIncompleteTreatmentSubtitle(args.event),
      dueDate: nowIso,
      createdAt: nowIso,
      generatedFromEventId: args.canonicalEventId,
      autoGenerated: true,
      completed: false,
      completedAt: null,
      reminderEnabled: true,
      reminderDaysBefore: 0,
      source: "email_import",
      source_email_id: args.sourceEmailId,
      sourceMessageId: args.sourceEmailId,
      sessionId: args.sessionId,
      reviewId: args.reviewId,
      sourceStorageUri,
      sourceStoragePath,
      sourceStorageSignedUrl,
      sourceFileName,
      sourceMimeType,
      imageFragmentUrl,
      updatedAt: nowIso,
    },
    { merge: true }
  );
}

// ---------------------------------------------------------------------------
// Sync-review title / subtitle / reason copy
// ---------------------------------------------------------------------------

export function buildSyncReviewTitle(event: ClinicalEventExtraction): string {
  const eventLabel: Record<EventType, string> = {
    appointment_confirmation: "turno confirmado",
    appointment_reminder: "recordatorio de turno",
    appointment_cancellation: "cancelación de turno",
    clinical_report: "informe clínico",
    study_report: "estudio",
    prescription_record: "receta",
    vaccination_record: "vacuna",
  };
  const typeLabel = eventLabel[event.event_type] || "registro";
  return `Revisar ${typeLabel} detectado por email`;
}

export function buildReviewReasonCopy(reason: string): string {
  const normalized = normalizeClinicalToken(reason);
  if (normalized.includes("identity_conflict")) {
    return "La identidad de la mascota entra en conflicto con el contenido del correo.";
  }
  if (normalized.includes("missing_treatment_dose_or_frequency")) {
    return "Falta confirmar dosis o frecuencia del tratamiento.";
  }
  if (normalized.includes("incomplete_appointment_details")) {
    return "Faltan hora, profesional, clínica o estado del turno para consolidarlo.";
  }
  if (normalized.includes("study_subtype_undetermined")) {
    return "No se pudo distinguir con seguridad si el estudio es laboratorio o imágenes.";
  }
  if (normalized.includes("possible_clinical_conflict")) {
    return "Podría contradecir el historial clínico actual.";
  }
  if (normalized.includes("historical_info_only")) {
    return "Parece información histórica o informativa, no una indicación activa.";
  }
  if (normalized.includes("medication_without_explicit_drug_name")) {
    return "Se detectó una supuesta medicación sin fármaco explícito.";
  }
  if (normalized.includes("unstructured_clinical_finding")) {
    return "Hay un hallazgo clínico que no quedó estructurado con seguridad.";
  }
  if (normalized.includes("external_link_login_required")) {
    return "Hace falta abrir la fuente original para validar el documento.";
  }
  if (normalized.includes("semantic_duplicate_candidate")) {
    return "Podría duplicar un registro ya existente.";
  }
  if (normalized.includes("confidence_below_auto_ingest_threshold") || normalized.includes("low_confidence")) {
    return "La confianza fue insuficiente para guardarlo automáticamente.";
  }
  return "Revisión manual requerida antes de consolidar el historial.";
}

export function buildSyncReviewSubtitle(args: {
  sourceEmailId: string;
  event: ClinicalEventExtraction;
  narrativeSummary: string;
  reason: string;
}): string {
  return `Email ${args.sourceEmailId.slice(0, 8)} · ${buildReviewReasonCopy(args.reason)}`;
}

// ---------------------------------------------------------------------------
// Sync-review pending action
// ---------------------------------------------------------------------------

export async function upsertSyncReviewPendingAction(args: {
  uid: string;
  petId: string | null;
  sessionId: string;
  sourceEmailId: string;
  event: ClinicalEventExtraction;
  narrativeSummary: string;
  reason: string;
  gmailReviewId: string;
  generatedFromEventId?: string | null;
  sourceAttachment?: AttachmentMetadata | null;
}): Promise<void> {
  if (!args.petId) return;

  const pendingId = `sync_review_${args.gmailReviewId}`;
  const nowIso = getNowIso();
  const sourceStorageUri = asString(args.sourceAttachment?.storage_uri) || null;
  const sourceStoragePath = asString(args.sourceAttachment?.storage_path) || null;
  const sourceStorageSignedUrl = asString(args.sourceAttachment?.storage_signed_url) || null;
  const sourceFileName = asString(args.sourceAttachment?.filename) || null;
  const sourceMimeType = asString(args.sourceAttachment?.mimetype) || null;
  const imageFragmentUrl = sourceStorageSignedUrl || sourceStorageUri || null;

  await admin.firestore().collection("pending_actions").doc(pendingId).set(
    {
      id: pendingId,
      petId: args.petId,
      userId: args.uid,
      type: "sync_review",
      title: buildSyncReviewTitle(args.event),
      subtitle: buildSyncReviewSubtitle({
        sourceEmailId: args.sourceEmailId,
        event: args.event,
        narrativeSummary: args.narrativeSummary,
        reason: args.reason,
      }),
      dueDate: nowIso,
      createdAt: nowIso,
      generatedFromEventId: args.generatedFromEventId || null,
      autoGenerated: true,
      completed: false,
      completedAt: null,
      reminderEnabled: true,
      reminderDaysBefore: 0,
      source: "email_import",
      source_email_id: args.sourceEmailId,
      sourceMessageId: args.sourceEmailId,
      sessionId: args.sessionId,
      reviewId: null,
      gmailReviewId: args.gmailReviewId,
      sourceStorageUri,
      sourceStoragePath,
      sourceStorageSignedUrl,
      sourceFileName,
      sourceMimeType,
      imageFragmentUrl,
      updatedAt: nowIso,
    },
    { merge: true }
  );
}

// ---------------------------------------------------------------------------
// Deduplication — semantic
// ---------------------------------------------------------------------------

export async function detectSemanticDuplicateCandidate(args: {
  uid: string;
  petId: string | null;
  event: ClinicalEventExtraction;
  sourceSender: string;
}): Promise<{ isLikelyDuplicate: boolean; score: number }> {
  const petId = args.petId || "";
  if (!petId) return { isLikelyDuplicate: false, score: 0 };

  const candidateCollections = [
    { name: "medical_events", dateField: "eventDate", diagnosisField: "diagnosis", clinicField: "sourceSender" },
    { name: "treatments", dateField: "startDate", diagnosisField: "clinical_indication", clinicField: "clinic_name" },
    { name: "medications", dateField: "startDate", diagnosisField: "indication", clinicField: "prescribedBy" },
  ];

  let maxScore = 0;
  const eventDate = args.event.event_date || null;
  const medicationName = args.event.medications[0]?.name || "";
  const diagnosis = args.event.diagnosis || args.event.description_summary;

  for (const coll of candidateCollections) {
    const snap = await admin
      .firestore()
      .collection(coll.name)
      .where("petId", "==", petId)
      .limit(40)
      .get();

    for (const doc of snap.docs) {
      const row = asRecord(doc.data());
      const extractedData = asRecord(row.extractedData);
      const extractedMedications = Array.isArray(extractedData.medications)
        ? extractedData.medications
          .map((med: unknown) => {
            const medRow = asRecord(med);
            return asString(medRow.name) || asString(medRow.medication) || asString(medRow.drug);
          })
          .filter(Boolean)
          .join(" ")
        : asString(extractedData.medications);
      const existingDate = asString(row[coll.dateField]) || null;
      const existingMedication =
        asString(row.name) ||
        asString(row.treatment_name) ||
        extractedMedications ||
        "";
      const existingDiagnosis =
        asString(row[coll.diagnosisField]) ||
        asString(row.title) ||
        asString(extractedData.diagnosis) ||
        "";
      const existingClinic = asString(row[coll.clinicField]) || asString(asRecord(row.source).sender) || "";

      const medicationScore = medicationName
        ? jaccardSimilarity(medicationName, existingMedication || existingDiagnosis)
        : 0.5;
      const dateScore = dateProximityScore(eventDate, existingDate);
      const diagnosisScore = jaccardSimilarity(diagnosis, existingDiagnosis || existingMedication);
      const clinicScore = jaccardSimilarity(args.sourceSender, existingClinic);

      const total = (medicationScore * 0.35) + (dateScore * 0.3) + (diagnosisScore * 0.25) + (clinicScore * 0.1);
      if (total > maxScore) maxScore = total;
    }
  }

  return {
    isLikelyDuplicate: maxScore >= 0.78,
    score: Math.round(maxScore * 100),
  };
}

// ---------------------------------------------------------------------------
// Deduplication — fingerprint
// ---------------------------------------------------------------------------

export async function isDuplicateEventByFingerprint(args: {
  uid: string;
  petId: string | null;
  event: ClinicalEventExtraction;
}): Promise<boolean> {
  const keyParts = [
    args.uid,
    args.petId || "no_pet",
    args.event.event_type,
    args.event.event_date || "no_date",
    normalizeForHash(args.event.description_summary).slice(0, 180),
  ];
  const hash = sha256(keyParts.join("|"));
  const ref = admin.firestore().collection("gmail_event_fingerprints").doc(hash);
  const snap = await ref.get();
  if (snap.exists) {
    return true;
  }
  await ref.set(
    {
      user_id: args.uid,
      pet_id: args.petId,
      event_type: args.event.event_type,
      event_date: args.event.event_date,
      summary: args.event.description_summary.slice(0, 250),
      created_at: getNowIso(),
    },
    { merge: true }
  );
  return false;
}

// ---------------------------------------------------------------------------
// Structured medical dataset (knowledge signal)
// ---------------------------------------------------------------------------

export async function storeKnowledgeSignal(args: {
  uid: string;
  petId: string | null;
  sessionId: string;
  event: ClinicalEventExtraction;
  extractionConfidence: number;
  originalConfidence: number;
  userEdits?: Record<string, unknown> | null;
  validatedByHuman?: boolean;
  validationStatus?: "pending_human_review" | "auto_ingested_unconfirmed" | "duplicate_candidate";
  sourceTruthLevel?: "review_queue" | "ai_auto_ingested" | "human_confirmed";
  requiresManualConfirmation?: boolean;
}): Promise<void> {
  const key = sha256(
    [
      args.uid,
      args.petId || "no_pet",
      args.sessionId,
      args.event.event_type,
      args.event.event_date || "no_date",
      normalizeForHash(args.event.description_summary).slice(0, 180),
    ].join("|")
  );

  await admin.firestore().collection("structured_medical_dataset").doc(key).set(
    {
      user_id: args.uid,
      pet_id: args.petId || null,
      session_id: args.sessionId,
      validated_event: args.event,
      user_edits_if_any: args.userEdits || null,
      extraction_confidence: clamp(args.extractionConfidence, 0, 100),
      original_confidence: clamp(args.originalConfidence, 0, 100),
      validated_by_human: args.validatedByHuman === true,
      validation_status: args.validationStatus || "pending_human_review",
      source_truth_level: args.sourceTruthLevel || "review_queue",
      requires_manual_confirmation: args.requiresManualConfirmation !== false,
      is_training_eligible: args.validatedByHuman === true,
      created_at: getNowIso(),
    },
    { merge: true }
  );
}

// ---------------------------------------------------------------------------
// Brain-sync mirroring
// ---------------------------------------------------------------------------

export async function mirrorBrainResolution(args: {
  uid: string;
  petReference?: string | null;
  petIdHint?: string | null;
  category: string;
  entities: Array<Record<string, unknown>>;
  confidence01: number;
  reviewRequired: boolean;
  reasonIfReviewNeeded?: string | null;
  sourceMetadata: Record<string, unknown>;
}): Promise<void> {
  try {
    await resolveBrainOutput({
      userId: args.uid,
      brainOutput: {
        pet_reference: asString(args.petReference) || null,
        category: args.category,
        entities: args.entities,
        confidence: clamp(args.confidence01, 0, 1),
        review_required: args.reviewRequired,
        reason_if_review_needed: asString(args.reasonIfReviewNeeded) || null,
        ui_hint: asRecord(args.sourceMetadata.ui_hint),
      },
      sourceMetadata: {
        ...args.sourceMetadata,
        source: asString(args.sourceMetadata.source) || "gmail",
        pet_id_hint: asString(args.petIdHint) || null,
      },
    });
  } catch (error) {
    console.warn("[gmail-ingestion] brain resolver mirror failed:", error);
  }
}

// ---------------------------------------------------------------------------
// Appointment-status mapping
// ---------------------------------------------------------------------------

export function appointmentStatusToCollectionStatus(status: AppointmentEventStatus): "upcoming" | "completed" | "cancelled" {
  if (status === "cancelled") return "cancelled";
  return "upcoming";
}

// ---------------------------------------------------------------------------
// Existing appointment lookup
// ---------------------------------------------------------------------------

export async function findExistingOperationalAppointmentEvent(args: {
  petId: string;
  eventDate: string;
  appointmentTime: string | null;
  professionalName: string | null;
  clinicName: string | null;
  appointmentReason: string;
}): Promise<string | null> {
  const snap = await admin.firestore().collection("medical_events").where("petId", "==", args.petId).limit(60).get();
  let bestMatch: { id: string; score: number } | null = null;

  for (const doc of snap.docs) {
    const row = asRecord(doc.data());
    const extracted = asRecord(row.extractedData);
    if (asString(extracted.documentType) !== "appointment") continue;

    const existingDate = asString(extracted.eventDate) || asString(row.eventDate) || null;
    const existingTime = asString(extracted.appointmentTime) || null;
    const existingProvider = asString(extracted.provider) || "";
    const existingClinic = asString(extracted.clinic) || "";
    const existingReason =
      asString(extracted.suggestedTitle) ||
      asString(row.title) ||
      asString(asRecord((Array.isArray(extracted.detectedAppointments) ? extracted.detectedAppointments[0] : null)).title) ||
      "";

    const dateScore = existingDate === args.eventDate ? 1 : dateProximityScore(args.eventDate, existingDate);
    const timeScore =
      args.appointmentTime && existingTime
        ? (args.appointmentTime === existingTime ? 1 : 0)
        : 0.35;
    const providerScore = args.professionalName ? jaccardSimilarity(args.professionalName, existingProvider) : 0.35;
    const clinicScore = args.clinicName ? jaccardSimilarity(args.clinicName, existingClinic) : 0.35;
    const reasonScore = args.appointmentReason ? jaccardSimilarity(args.appointmentReason, existingReason) : 0.35;
    const total = (dateScore * 0.4) + (timeScore * 0.2) + (providerScore * 0.15) + (clinicScore * 0.1) + (reasonScore * 0.15);

    if (!bestMatch || total > bestMatch.score) {
      bestMatch = { id: doc.id, score: total };
    }
  }

  return bestMatch && bestMatch.score >= 0.7 ? bestMatch.id : null;
}

// ---------------------------------------------------------------------------
// Operational appointment projection upsert
// ---------------------------------------------------------------------------

export async function upsertOperationalAppointmentProjection(args: {
  appointmentEventId: string;
  petId: string;
  uid: string;
  title: string;
  eventDate: string;
  event: ClinicalEventExtraction;
  narrativeSummary: string;
  sourceEmailId: string;
  sourceTruthLevel: string;
  effectiveRequiresConfirmation: boolean;
  nowIso: string;
}): Promise<void> {
  const existingAppointmentSnap = await admin
    .firestore()
    .collection("appointments")
    .where("sourceEventId", "==", args.appointmentEventId)
    .limit(1)
    .get();

  const appointmentId = existingAppointmentSnap.empty
    ? `gmail_appt_${sha256(args.appointmentEventId).slice(0, 16)}`
    : existingAppointmentSnap.docs[0].id;

  await admin.firestore().collection("appointments").doc(appointmentId).set(
    {
      id: appointmentId,
      petId: args.petId,
      userId: args.uid,
      ownerId: args.uid,
      sourceEventId: args.appointmentEventId,
      autoGenerated: true,
      type: "checkup",
      title: args.title.slice(0, 120),
      date: args.eventDate,
      time: args.event.appointment_time || null,
      veterinarian: args.event.professional_name || null,
      clinic: args.event.clinic_name || null,
      status: appointmentStatusToCollectionStatus(args.event.appointment_status),
      notes: args.narrativeSummary.slice(0, 1200),
      createdAt: existingAppointmentSnap.empty ? args.nowIso : asString(existingAppointmentSnap.docs[0].get("createdAt")) || args.nowIso,
      updatedAt: args.nowIso,
      source: "email_import",
      source_email_id: args.sourceEmailId,
      requires_confirmation: args.effectiveRequiresConfirmation,
      source_truth_level: args.sourceTruthLevel,
      validated_by_human: existingAppointmentSnap.empty
        ? false
        : existingAppointmentSnap.docs[0].get("validated_by_human") === true,
      protocolSnapshotFrozenAt: existingAppointmentSnap.empty
        ? args.nowIso
        : asString(existingAppointmentSnap.docs[0].get("protocolSnapshotFrozenAt")) || args.nowIso,
    },
    { merge: true }
  );
}

// ---------------------------------------------------------------------------
// Secondary appointment candidate extraction
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Domain ingestion orchestrator
// ---------------------------------------------------------------------------

export async function ingestEventToDomain(args: {
  uid: string;
  petId: string | null;
  sourceEmailId: string;
  sourceSubject: string;
  sourceSender: string;
  sourceDate: string;
  event: ClinicalEventExtraction;
  narrativeSummary: string;
  requiresConfirmation: boolean;
  reviewReason?: string | null;
  sourceAttachment?: AttachmentMetadata | null;
}): Promise<{
  domainType: DomainIngestionType;
  canonicalEventId: string;
  blockedMedicationCount: number;
}> {
  const nowIso = getNowIso();
  const petId = args.petId || "";
  const eventDate = args.event.event_date || toIsoDateOnly(new Date(args.sourceDate));
  const title = buildCanonicalEventTitle(args.event);
  const incompleteTreatmentMeds =
    isPrescriptionEventType(args.event.event_type)
      ? args.event.medications.filter((medication) => !medicationHasDoseAndFrequency(medication))
      : [];
  const hasIncompleteTreatmentMeds = incompleteTreatmentMeds.length > 0;
  const effectiveRequiresConfirmation = args.requiresConfirmation || hasIncompleteTreatmentMeds;
  const sourceTruthLevel = effectiveRequiresConfirmation ? "review_queue" : "ai_auto_ingested";
  const reviewReasons = effectiveRequiresConfirmation
    ? [asString(args.reviewReason) || (hasIncompleteTreatmentMeds ? "missing_treatment_dose_or_frequency" : "requires_review")]
    : [];
  const severityMap: Record<string, string> = { mild: "leve", moderate: "moderado", severe: "severo" };
  const severity = args.event.severity ? severityMap[args.event.severity] || null : null;
  const canonicalEventId = `gmail_evt_${sha256(
    `${args.uid}_${args.sourceEmailId}_${args.event.event_type}_${eventDate}_${title}`
  ).slice(0, 20)}`;
  const extractedData = buildDefaultExtractedData({
    event: args.event,
    sourceDate: args.sourceDate,
    sourceSubject: args.sourceSubject,
    sourceSender: args.sourceSender,
    sourceAttachment: args.sourceAttachment,
  });
  const sourceSignedUrl = asString(args.sourceAttachment?.storage_signed_url) || "";
  const sourceMimeType = asString(args.sourceAttachment?.mimetype).toLowerCase();
  const inferredFileType = sourceMimeType.includes("pdf") ? "pdf" : sourceMimeType.startsWith("image/") ? "image" : "pdf";
  const treatmentMissingFields = incompleteTreatmentMeds.map((medication) => ({
    medication: asString(medication.name) || null,
    missingDose: !asString(medication.dose),
    missingFrequency: !asString(medication.frequency),
  }));
  const appointmentReason =
    asString((Array.isArray(extractedData.detectedAppointments) ? asRecord(extractedData.detectedAppointments[0]) : {}).title) ||
    title;
  const existingAppointmentEventId =
    petId && isAppointmentEventType(args.event.event_type)
      ? await findExistingOperationalAppointmentEvent({
          petId,
          eventDate,
          appointmentTime: args.event.appointment_time,
          professionalName: args.event.professional_name,
          clinicName: args.event.clinic_name,
          appointmentReason,
        })
      : null;
  const effectiveCanonicalEventId = existingAppointmentEventId || canonicalEventId;
  const secondaryAppointmentCandidate = !isAppointmentEventType(args.event.event_type)
    ? extractOperationalAppointmentCandidate({
        eventDate,
        sourceText: [
          args.sourceSubject,
          title,
          args.event.description_summary,
          args.event.diagnosis,
          args.narrativeSummary,
        ]
          .filter(Boolean)
          .join(" · "),
        sourceSender: args.sourceSender,
        existingStatus: args.event.appointment_status,
        existingTime: args.event.appointment_time,
        existingSpecialty: args.event.appointment_specialty,
        professionalName: args.event.professional_name,
        clinicName: args.event.clinic_name,
        diagnosis: args.event.diagnosis,
        confidenceScore: args.event.confidence_score,
      })
    : null;
  const medicalEventRef = admin.firestore().collection("medical_events").doc(effectiveCanonicalEventId);
  const existingMedicalEventSnap = existingAppointmentEventId ? await medicalEventRef.get() : null;

  // Always persist the canonical event so Timeline and downstream UIs have a single source.
  await medicalEventRef.set(
    {
      id: effectiveCanonicalEventId,
      petId,
      userId: args.uid,
      title: title.slice(0, 160),
      documentUrl: sourceSignedUrl,
      documentPreviewUrl: sourceSignedUrl || null,
      fileName: asString(args.sourceAttachment?.filename) || "email_import",
      fileType: inferredFileType,
      status: effectiveRequiresConfirmation ? "draft" : "completed",
      workflowStatus: effectiveRequiresConfirmation ? "review_required" : "confirmed",
      requiresManualConfirmation: effectiveRequiresConfirmation,
      reviewReasons,
      validatedByHuman: false,
      sourceTruthLevel: sourceTruthLevel,
      truthStatus: effectiveRequiresConfirmation ? "pending_human_review" : "auto_ingested_unconfirmed",
      overallConfidence: args.event.confidence_score,
      extractedData: {
        ...extractedData,
        treatmentValidationStatus: hasIncompleteTreatmentMeds ? "needs_review" : "complete",
        treatmentMissingFields,
      },
      ocrProcessed: true,
      aiProcessed: true,
      createdAt: existingMedicalEventSnap?.exists ? asString(existingMedicalEventSnap.get("createdAt")) || nowIso : nowIso,
      updatedAt: nowIso,
      protocolSnapshotFrozenAt: existingMedicalEventSnap?.exists
        ? asString(existingMedicalEventSnap.get("protocolSnapshotFrozenAt")) || nowIso
        : nowIso,
      relatedEventIds: existingMedicalEventSnap?.exists
        ? existingMedicalEventSnap.get("relatedEventIds") || []
        : [],
      aiSuggestedRelation: null,
      source: "email_import",
      source_email_id: args.sourceEmailId,
      latest_source_email_id: args.sourceEmailId,
      source_email_ids: admin.firestore.FieldValue.arrayUnion(args.sourceEmailId),
      domain_ingestion_type:
        isVaccinationEventType(args.event.event_type)
          ? "vaccination"
          : isAppointmentEventType(args.event.event_type)
            ? "appointment"
            : hasIncompleteTreatmentMeds
            ? "medical_event"
            : isPrescriptionEventType(args.event.event_type)
              ? "treatment"
              : "medical_event",
      severity,
      findings:
        args.event.lab_results.length > 0
          ? args.event.lab_results.map((row) => `${row.test_name}: ${row.result}`).join(" | ").slice(0, 1400)
          : null,
    },
    { merge: true }
  );

  if (isAppointmentEventType(args.event.event_type)) {
    if (petId) {
      await upsertOperationalAppointmentProjection({
        appointmentEventId: effectiveCanonicalEventId,
        petId,
        uid: args.uid,
        title,
        eventDate,
        event: args.event,
        narrativeSummary: args.narrativeSummary,
        sourceEmailId: args.sourceEmailId,
        sourceTruthLevel,
        effectiveRequiresConfirmation,
        nowIso,
      });
    }
    return {
      domainType: "appointment",
      canonicalEventId: effectiveCanonicalEventId,
      blockedMedicationCount: 0,
    };
  }

  if (secondaryAppointmentCandidate && petId) {
    await upsertOperationalAppointmentProjection({
      appointmentEventId: effectiveCanonicalEventId,
      petId,
      uid: args.uid,
      title: buildCanonicalEventTitle(secondaryAppointmentCandidate),
      eventDate,
      event: secondaryAppointmentCandidate,
      narrativeSummary: cleanSentence(
        [args.narrativeSummary, args.sourceSubject, title].filter(Boolean).join(" · ")
      ),
      sourceEmailId: args.sourceEmailId,
      sourceTruthLevel,
      effectiveRequiresConfirmation,
      nowIso,
    });
  }

  if (isPrescriptionEventType(args.event.event_type)) {
    if (hasIncompleteTreatmentMeds) {
      return {
        domainType: "medical_event",
        canonicalEventId: effectiveCanonicalEventId,
        blockedMedicationCount: incompleteTreatmentMeds.length,
      };
    }

    const eventStartDate = parseDateOnly(eventDate) || new Date(args.sourceDate);
    for (const medication of args.event.medications) {
      const medName = asString(medication.name) || "medication";
      const trtId = `gmail_trt_${sha256(`${args.uid}_${args.sourceEmailId}_${medName}`).slice(0, 18)}`;
      const computedEndDate = medication.duration_days
        ? new Date(eventStartDate.getTime() + medication.duration_days * ONE_DAY_MS)
        : null;
      await admin.firestore().collection("treatments").doc(trtId).set(
        {
          id: trtId,
          petId,
          userId: args.uid,
          ownerId: args.uid,
          normalizedName: normalizeForHash(medName),
          startDate: eventDate,
          endDate: computedEndDate ? toIsoDateOnly(computedEndDate) : null,
          status: medication.is_active === false ? "completed" : "active",
          linkedConditionIds: [],
          evidenceEventIds: [effectiveCanonicalEventId],
          prescribingProfessional: { name: args.event.professional_name || null, license: null },
          clinic: { name: args.event.clinic_name || null },
          dosage: medication.dose,
          frequency: medication.frequency,
          validation_status: "complete",
          createdAt: nowIso,
          updatedAt: nowIso,
          source: "email_import",
          source_email_id: args.sourceEmailId,
          requires_user_confirmation: effectiveRequiresConfirmation,
          source_truth_level: sourceTruthLevel,
          protocolSnapshotFrozenAt: nowIso,
        },
        { merge: true }
      );

      const medId = `gmail_med_${sha256(`${args.uid}_${args.sourceEmailId}_${medName}`).slice(0, 18)}`;
      await admin.firestore().collection("medications").doc(medId).set(
        {
          id: medId,
          petId,
          userId: args.uid,
          name: medName,
          dosage: medication.dose,
          frequency: medication.frequency,
          type: "Medicación",
          startDate: eventDate,
          endDate: computedEndDate ? computedEndDate.toISOString() : null,
          prescribedBy: args.event.professional_name || null,
          generatedFromEventId: effectiveCanonicalEventId,
          active: medication.is_active !== false,
          validation_status: "complete",
          createdAt: nowIso,
          updatedAt: nowIso,
          source: "email_import",
          source_email_id: args.sourceEmailId,
          requires_confirmation: effectiveRequiresConfirmation,
          source_truth_level: sourceTruthLevel,
          protocolSnapshotFrozenAt: nowIso,
        },
        { merge: true }
      );
    }
    return {
      domainType: "treatment",
      canonicalEventId: effectiveCanonicalEventId,
      blockedMedicationCount: 0,
    };
  }

  return {
    domainType: isVaccinationEventType(args.event.event_type) ? "vaccination" : "medical_event",
    canonicalEventId: effectiveCanonicalEventId,
    blockedMedicationCount: 0,
  };
}
