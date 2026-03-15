import * as admin from "firebase-admin";
import {
  AttachmentMetadata,
  ClinicalEventExtraction,
  DomainIngestionType,
  EventType,
  ONE_DAY_MS,
} from "./types";
import {
  sha256, getNowIso, asString, asRecord,
  normalizeForHash, clamp, toIsoDateOnly, parseDateOnly,
  cleanSentence, jaccardSimilarity, dateProximityScore,
} from "./utils";
import {
  isAppointmentEventType, isPrescriptionEventType,
  isVaccinationEventType,
  buildCanonicalEventTitle, extractOperationalAppointmentCandidate,
  medicationHasDoseAndFrequency,
} from "./clinicalNormalization";
import { buildDefaultExtractedData } from "./reviewActions";
import { resolveBrainOutput } from "../../clinical/brainResolver";

// ─── Knowledge signal persistence ───────────────────────────────────────────

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

// ─── Brain integration helpers ───────────────────────────────────────────────

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

// ─── Brain resolver mirror ───────────────────────────────────────────────────

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

// ─── Appointment projection ──────────────────────────────────────────────────

export function appointmentStatusToCollectionStatus(status: import("./types").AppointmentEventStatus): "upcoming" | "completed" | "cancelled" {
  if (status === "cancelled") return "cancelled";
  return "upcoming";
}

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

  // Guard: no sobreescribir status si fue confirmado manualmente por el usuario.
  const existingDoc = existingAppointmentSnap.empty ? null : existingAppointmentSnap.docs[0];
  const existingValidatedByHuman = existingDoc?.get("validated_by_human") === true;
  const existingStatus = asString(existingDoc?.get("status"));
  const computedStatus = appointmentStatusToCollectionStatus(args.event.appointment_status);
  const effectiveStatus =
    existingValidatedByHuman && existingStatus === "completed" ? "completed" : computedStatus;

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
      status: effectiveStatus,
      notes: args.narrativeSummary.slice(0, 1200),
      createdAt: existingAppointmentSnap.empty ? args.nowIso : asString(existingAppointmentSnap.docs[0].get("createdAt")) || args.nowIso,
      updatedAt: args.nowIso,
      source: "email_import",
      source_email_id: args.sourceEmailId,
      requires_confirmation: args.effectiveRequiresConfirmation,
      source_truth_level: args.sourceTruthLevel,
      validated_by_human: false,
      protocolSnapshotFrozenAt: existingAppointmentSnap.empty
        ? args.nowIso
        : asString(existingAppointmentSnap.docs[0].get("protocolSnapshotFrozenAt")) || args.nowIso,
    },
    { merge: true }
  );
}

// ─── Domain ingestion orchestrator ───────────────────────────────────────────

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
          validated_by_human: false,
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
          validated_by_human: false,
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
