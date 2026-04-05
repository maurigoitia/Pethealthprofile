import * as admin from "firebase-admin";
import {
  AttachmentMetadata,
  ClinicalEventExtraction,
  EventType,
} from "./types";
import {
  sha256, getNowIso, asString, asRecord,
  normalizeForHash, normalizeClinicalToken,
  sanitizeReferenceRange, toIsoDateOnly,
  jaccardSimilarity, dateProximityScore,
} from "./utils";
import {
  isAppointmentEventType, isPrescriptionEventType,
  isVaccinationEventType, isStudyEventType,
  buildCanonicalEventTitle, deriveAppointmentLabel,
  toMedicalEventDocumentType, medicationHasDoseAndFrequency,
} from "./clinicalNormalization";
import { getSilentApprovalWindowHours } from "./envConfig";

// ─── Review event persistence ────────────────────────────────────────────────

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

// ─── Default extracted data builder ──────────────────────────────────────────

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

// ─── Incomplete treatment helpers ────────────────────────────────────────────

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

// ─── Best attachment selection ───────────────────────────────────────────────

export function selectBestAttachmentForReview(attachmentMetadata: AttachmentMetadata[]): AttachmentMetadata | null {
  if (!Array.isArray(attachmentMetadata) || attachmentMetadata.length === 0) return null;
  const withSignedUrl = attachmentMetadata.find((row) => Boolean(asString(row.storage_signed_url)));
  if (withSignedUrl) return withSignedUrl;
  const withStoredUri = attachmentMetadata.find((row) => Boolean(asString(row.storage_uri)));
  if (withStoredUri) return withStoredUri;
  return attachmentMetadata[0] || null;
}

// ─── Clinical review draft upsert ────────────────────────────────────────────

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

// ─── Incomplete treatment pending action ─────────────────────────────────────

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

// ─── Sync review helpers ─────────────────────────────────────────────────────

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

// ─── Sync review pending action ──────────────────────────────────────────────

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

// ─── Duplicate detection ─────────────────────────────────────────────────────

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
          .map((med) => {
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
