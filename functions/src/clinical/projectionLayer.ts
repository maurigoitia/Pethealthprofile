// ============================================================================
// PESSY - Clinical Projection Layer
//
// Cierra el dead-end del path Gmail:
//   clinical_events (brainResolver) → colecciones operacionales
//
// Trigger: onDocumentCreated("clinical_events/{docId}")
// También expone projectClinicalEvent() para llamado directo desde otros módulos.
// ============================================================================

import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import { onDocumentCreated } from "firebase-functions/v2/firestore";

// ─── Routing table (mirror del frontend clinicalRouting.ts) ──────────────────
// Mantenemos una copia en backend para que la proyección no dependa del cliente.

type OperationalCollection = "medical_events" | "appointments" | "treatments";
type TreatmentSubtype =
  | "medication" | "supplement" | "vaccine_schedule" | "physical_therapy"
  | "surgical_follow" | "diet" | "monitoring" | "topical" | "other";

interface RoutingDecision {
  collection: OperationalCollection;
  documentType?: string;
  treatmentSubtype?: TreatmentSubtype;
  requiresHumanReview: boolean;
  reviewReason?: string;
}

const ROUTING_TABLE: Record<string, RoutingDecision> = {
  // Vacunas
  "Vaccine/vaccination_record":       { collection: "medical_events", documentType: "vaccine",   requiresHumanReview: false },
  "Vaccine/general_clinical_report":  { collection: "medical_events", documentType: "vaccine",   requiresHumanReview: false },
  // Citas / Turnos
  "ClinicalEvent/appointment_confirmation": { collection: "appointments",   requiresHumanReview: false },
  "ClinicalEvent/referral_letter":          { collection: "appointments",   requiresHumanReview: true,  reviewReason: "Derivación — confirmar fecha y especialidad" },
  "ClinicalEvent/general_clinical_report":  { collection: "medical_events", documentType: "checkup",    requiresHumanReview: false },
  "ClinicalEvent/surgical_report":          { collection: "medical_events", documentType: "surgery",    requiresHumanReview: false },
  "ClinicalEvent/anesthesia_report":        { collection: "medical_events", documentType: "surgery",    requiresHumanReview: false },
  "ClinicalEvent/equine_dental_exam":       { collection: "medical_events", documentType: "checkup",    requiresHumanReview: false },
  "ClinicalEvent/equine_reproductive_exam": { collection: "medical_events", documentType: "checkup",    requiresHumanReview: false },
  "ClinicalEvent/exotic_wellness_exam":     { collection: "medical_events", documentType: "checkup",    requiresHumanReview: false },
  // Medicación
  "Medication/prescription":          { collection: "treatments", treatmentSubtype: "medication", requiresHumanReview: true,  reviewReason: "Prescripción — verificar dosis y frecuencia" },
  "Medication/discharge_summary":     { collection: "treatments", treatmentSubtype: "medication", requiresHumanReview: true,  reviewReason: "Alta médica con medicación" },
  "Medication/general_clinical_report":{ collection: "treatments", treatmentSubtype: "medication", requiresHumanReview: true, reviewReason: "Medicación en informe — confirmar indicación" },
  // Laboratorio
  "Diagnostic/blood_panel":           { collection: "medical_events", documentType: "lab_test",   requiresHumanReview: false },
  "Diagnostic/biochemistry_panel":    { collection: "medical_events", documentType: "lab_test",   requiresHumanReview: false },
  "Diagnostic/urinalysis":            { collection: "medical_events", documentType: "lab_test",   requiresHumanReview: false },
  "Diagnostic/fecal_exam":            { collection: "medical_events", documentType: "lab_test",   requiresHumanReview: false },
  "Diagnostic/cytology":              { collection: "medical_events", documentType: "lab_test",   requiresHumanReview: false },
  "Diagnostic/culture_sensitivity":   { collection: "medical_events", documentType: "lab_test",   requiresHumanReview: false },
  "Diagnostic/serology":              { collection: "medical_events", documentType: "lab_test",   requiresHumanReview: false },
  "Diagnostic/hormonal_panel":        { collection: "medical_events", documentType: "lab_test",   requiresHumanReview: false },
  "Diagnostic/coagulation_panel":     { collection: "medical_events", documentType: "lab_test",   requiresHumanReview: false },
  "Diagnostic/dermatology_microscopy":{ collection: "medical_events", documentType: "lab_test",   requiresHumanReview: false },
  "Diagnostic/skin_biopsy":           { collection: "medical_events", documentType: "lab_test",   requiresHumanReview: false },
  "Diagnostic/pathology_report":      { collection: "medical_events", documentType: "lab_test",   requiresHumanReview: false },
  "Diagnostic/equine_lameness_exam":  { collection: "medical_events", documentType: "checkup",    requiresHumanReview: false },
  "Diagnostic/dental_radiograph":     { collection: "medical_events", documentType: "xray",       requiresHumanReview: false },
  // Imágenes
  "Diagnostic/radiology_report":      { collection: "medical_events", documentType: "xray",       requiresHumanReview: false },
  "Diagnostic/ultrasound_report":     { collection: "medical_events", documentType: "xray",       requiresHumanReview: false },
  "Diagnostic/echocardiogram_report": { collection: "medical_events", documentType: "echocardiogram", requiresHumanReview: false },
  "Diagnostic/ct_scan_report":        { collection: "medical_events", documentType: "xray",       requiresHumanReview: false },
  "Diagnostic/mri_report":            { collection: "medical_events", documentType: "xray",       requiresHumanReview: false },
  "Diagnostic/endoscopy_report":      { collection: "medical_events", documentType: "other",      requiresHumanReview: false },
  "Diagnostic/electrocardiogram_report": { collection: "medical_events", documentType: "electrocardiogram", requiresHumanReview: false },
};

const CATEGORY_FALLBACK: Record<string, RoutingDecision> = {
  Vaccine:       { collection: "medical_events", documentType: "vaccine",   requiresHumanReview: false },
  Medication:    { collection: "treatments",     treatmentSubtype: "medication", requiresHumanReview: true, reviewReason: "Medicación — confirmar protocolo" },
  Diagnostic:    { collection: "medical_events", documentType: "other",     requiresHumanReview: false },
  ClinicalEvent: { collection: "medical_events", documentType: "checkup",   requiresHumanReview: false },
};

function resolveRouting(
  category: string,
  documentType: string,
  forceReview?: string
): RoutingDecision {
  const key = `${category}/${documentType}`;
  const base =
    ROUTING_TABLE[key] ??
    CATEGORY_FALLBACK[category] ??
    { collection: "medical_events" as const, documentType: "other", requiresHumanReview: true, reviewReason: "Tipo no reconocido" };

  if (forceReview) {
    return { ...base, requiresHumanReview: true, reviewReason: forceReview };
  }
  return base;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function asString(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function buildDeduplicationId(petId: string, documentType: string, eventDate: string): string {
  // ID determinista para evitar duplicados si el trigger se ejecuta más de una vez
  const dateKey = eventDate ? eventDate.slice(0, 10) : "no-date";
  return `proj_${petId}_${documentType.replace(/[^a-z0-9]/gi, "_")}_${dateKey}`;
}

// ─── Proyección a medical_events ─────────────────────────────────────────────

async function projectToMedicalEvent(args: {
  clinicalEventId: string;
  data: admin.firestore.DocumentData;
  decision: RoutingDecision;
}): Promise<string> {
  const { data, decision, clinicalEventId } = args;
  const petId = asString(data.petId);
  const userId = asString(data.userId);
  const eventDate = asString(
    data.source_metadata?.source_date ??
    data.extracted_at
  );
  const documentType = decision.documentType ?? "other";
  const nowIso = new Date().toISOString();

  const dedupeId = buildDeduplicationId(petId, documentType, eventDate);
  const docRef = admin.firestore().collection("medical_events").doc(dedupeId);

  // Si ya existe (dedup), solo actualizamos lineage
  const existing = await docRef.get();
  if (existing.exists) {
    await docRef.update({
      clinicalEventId,
      lastProjectedAt: nowIso,
    });
    return dedupeId;
  }

  // Extraer entidades del brain para construir el snapshot del evento
  const entities: Array<Record<string, unknown>> = Array.isArray(data.data) ? data.data : [];
  const diagnoses = entities
    .filter((e) => asString(e.type) === "diagnosis")
    .map((e) => ({ condition_name: asString(e.label), severity: asString(e.status) || null }));
  const findings = entities
    .filter((e) => asString(e.type) === "lab_value" || asString(e.type) === "observation")
    .map((e) => ({
      parameter: asString(e.label),
      value: asString(e.value),
      unit: asString(e.unit) || null,
      reference_range: asString(e.reference_range) || null,
      status: asString(e.status) || null,
    }));

  const payload: Record<string, unknown> = {
    petId,
    userId,
    documentType,
    status: "completed",
    title: asString(data.primary_finding) || documentType,
    source: "gmail_projection",
    clinicalEventId,         // lineage al clinical_event origen
    validatedByHuman: data.validated_by_human === true,
    sourceTruthLevel: asString(data.source_truth_level) || "ai_high_confidence",
    truthStatus: data.validated_by_human === true ? "human_confirmed" : "ai_verified",
    requiresManualConfirmation: false,
    extractedData: {
      documentType,
      eventDate: eventDate || null,
      clinic: asString(data.source_metadata?.sender) || null,
      provider: null,
      diagnosis: diagnoses.map((d) => d.condition_name).filter(Boolean).join("; ") || null,
      diagnosisConfidence: data.brain_confidence >= 0.85 ? "high" : "medium",
      observations: asString(data.primary_finding) || null,
      measurements: findings,
      medications: [],
      detectedAppointments: [],
      studyType: asString(data.study_type) || null,
      aiGeneratedSummary: null, // No copiar resumen largo sin revisar
      masterClinical: data.brain_output ?? null,
      sourceReceivedAt: asString(data.source_metadata?.source_date) || null,
      sourceSubject: asString(data.source_metadata?.subject) || null,
      sourceSender: asString(data.source_metadata?.from_email) || null,
    },
    diagnosesDetected: diagnoses,
    abnormalFindings: findings.filter((f) => f.status === "alto" || f.status === "bajo" || f.status === "alterado"),
    treatmentsDetected: [],
    appointmentsDetected: [],
    recommendations: [],
    protocolSnapshotFrozenAt: nowIso,
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  await docRef.set(payload);
  return dedupeId;
}

// ─── Proyección a appointments ────────────────────────────────────────────────

async function projectToAppointment(args: {
  clinicalEventId: string;
  data: admin.firestore.DocumentData;
}): Promise<string> {
  const { data, clinicalEventId } = args;
  const petId = asString(data.petId);
  const userId = asString(data.userId);
  const nowIso = new Date().toISOString();

  // Buscar entidades de tipo appointment en el brain output
  const entities: Array<Record<string, unknown>> = Array.isArray(data.data) ? data.data : [];
  const appointmentEntities = entities.filter((e) => asString(e.type) === "appointment" || asString(e.type) === "scheduled_event");

  const sourceDate = asString(data.source_metadata?.source_date);
  const subject = asString(data.source_metadata?.subject);

  // Si hay entidades de turno, crear una por cada una
  if (appointmentEntities.length > 0) {
    const firstAppt = appointmentEntities[0];
    const apptId = `appt_proj_${clinicalEventId}_0`;
    const docRef = admin.firestore().collection("appointments").doc(apptId);
    const existing = await docRef.get();
    if (!existing.exists) {
      await docRef.set({
        petId,
        userId,
        date: asString(firstAppt.value ?? firstAppt.date) || sourceDate || null,
        time: asString(firstAppt.time) || null,
        title: asString(firstAppt.label ?? data.primary_finding) || subject || "Turno detectado",
        veterinarian: null,
        clinic: asString(data.source_metadata?.from_email) || null,
        status: "upcoming",
        sourceEventId: null,
        clinicalEventId,
        isFromGmail: true,
        validatedByHuman: false,
        createdAt: nowIso,
        updatedAt: nowIso,
      });
    }
    return apptId;
  }

  // Fallback: crear turno solo con la fecha del documento
  const apptId = `appt_proj_${clinicalEventId}_fallback`;
  const docRef = admin.firestore().collection("appointments").doc(apptId);
  const existing = await docRef.get();
  if (!existing.exists) {
    await docRef.set({
      petId,
      userId,
      date: sourceDate || null,
      time: null,
      title: asString(data.primary_finding) || subject || "Turno detectado por correo",
      veterinarian: null,
      clinic: asString(data.source_metadata?.from_email) || null,
      status: "upcoming",
      clinicalEventId,
      isFromGmail: true,
      validatedByHuman: false,
      requiresManualConfirmation: true,
      createdAt: nowIso,
      updatedAt: nowIso,
    });
  }
  return apptId;
}

// ─── Proyección a treatments ──────────────────────────────────────────────────

async function projectToTreatment(args: {
  clinicalEventId: string;
  data: admin.firestore.DocumentData;
  decision: RoutingDecision;
}): Promise<string> {
  const { data, decision, clinicalEventId } = args;
  const petId = asString(data.petId);
  const userId = asString(data.userId);
  const nowIso = new Date().toISOString();

  const entities: Array<Record<string, unknown>> = Array.isArray(data.data) ? data.data : [];
  const medicationEntities = entities.filter((e) =>
    asString(e.type) === "medication" || asString(e.type) === "drug" || asString(e.type) === "prescription_item"
  );

  const treatmentId = `tx_proj_${clinicalEventId}`;
  const docRef = admin.firestore().collection("treatments").doc(treatmentId);
  const existing = await docRef.get();
  if (existing.exists) return treatmentId;

  const firstMed = medicationEntities[0] ?? {};
  const drugName = asString(firstMed.label ?? data.primary_finding) || "Medicación detectada";

  await docRef.set({
    petId,
    userId,
    normalizedName: drugName.toLowerCase().replace(/\s+/g, " "),
    displayName: drugName,
    subtype: decision.treatmentSubtype ?? "medication",
    status: "active",
    dosage: asString(firstMed.value) || null,
    unit: asString(firstMed.unit) || null,
    frequency: null,   // no se puede inferir sin revisión humana
    startDate: asString(data.source_metadata?.source_date) || null,
    endDate: null,
    // Si hay más de un medicamento, los registramos como entidades adicionales
    additionalMedications: medicationEntities.slice(1).map((e) => ({
      name: asString(e.label),
      dosage: asString(e.value) || null,
    })),
    clinicalEventId,
    sourceEventId: null,
    isFromGmail: true,
    validatedByHuman: false,
    requiresManualConfirmation: true, // siempre requiere confirmación para activar recordatorios
    createdAt: nowIso,
    updatedAt: nowIso,
  });

  return treatmentId;
}

// ─── Función principal de proyección ─────────────────────────────────────────

export async function projectClinicalEvent(
  clinicalEventId: string,
  data: admin.firestore.DocumentData
): Promise<{
  projectedTo: OperationalCollection;
  projectedDocId: string;
  requiresHumanReview: boolean;
}> {
  const category = asString(data.category);
  const documentType = asString(data.document_type);
  const confidence: number = typeof data.brain_confidence === "number" ? data.brain_confidence : 0;

  // Forzar revisión si confianza baja o mascota no resuelta
  const forceReview = confidence < 0.85
    ? `Confianza baja (${Math.round(confidence * 100)}%) — verificar datos extraídos`
    : !asString(data.petId)
      ? "Mascota no identificada — asignar manualmente"
      : undefined;

  const decision = resolveRouting(category, documentType, forceReview);

  let projectedDocId: string;

  switch (decision.collection) {
    case "appointments":
      projectedDocId = await projectToAppointment({ clinicalEventId, data });
      break;
    case "treatments":
      projectedDocId = await projectToTreatment({ clinicalEventId, data, decision });
      break;
    default:
      projectedDocId = await projectToMedicalEvent({ clinicalEventId, data, decision });
  }

  // Si requiere revisión humana, crear un pending_action en la home
  if (decision.requiresHumanReview) {
    const petId = asString(data.petId);
    const userId = asString(data.userId);
    const nowIso = new Date().toISOString();
    const paRef = admin.firestore().collection("pending_actions").doc(`pa_proj_${clinicalEventId}`);
    const existing = await paRef.get();
    if (!existing.exists) {
      const collectionLabel: Record<string, string> = {
        treatments: "tratamiento/medicación",
        appointments: "turno médico",
        medical_events: "evento clínico",
      };
      const label = collectionLabel[decision.collection] ?? decision.collection;
      await paRef.set({
        petId,
        userId,
        type: "incomplete_data",
        title: decision.reviewReason ?? `IA detectó ${label} — confirmá antes de activar`,
        subtitle: `Revisión de ${label} proyectado por el cerebro clínico`,
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 días
        generatedFromEventId: projectedDocId,
        clinicalEventId,
        targetCollection: decision.collection,
        sourceTag: "ai_projection",
        autoGenerated: true,
        completed: false,
        completedAt: null,
        reminderEnabled: false,
        reminderDaysBefore: 0,
        createdAt: nowIso,
        updatedAt: nowIso,
      });
    }
  }

  // Marcar el clinical_event como proyectado
  await admin.firestore().collection("clinical_events").doc(clinicalEventId).update({
    projected: true,
    projectedTo: decision.collection,
    projectedDocId,
    projectedAt: new Date().toISOString(),
  });

  return {
    projectedTo: decision.collection,
    projectedDocId,
    requiresHumanReview: decision.requiresHumanReview,
  };
}

// ─── Cloud Function trigger ───────────────────────────────────────────────────

export const onClinicalEventProjection = onDocumentCreated(
  {
    document: "clinical_events/{docId}",
    timeoutSeconds: 60,
    memory: "256MiB",
    region: "us-central1",
  },
  async (event) => {
    const snap = event.data;
    if (!snap) return;
    const data = snap.data();
    const clinicalEventId = event.params.docId;

    // Solo proyectar eventos verificados
    if (asString(data.status) !== "verified") return;

    // Evitar reproyectar si ya se procesó
    if (data.projected === true) return;

    try {
      const result = await projectClinicalEvent(clinicalEventId, data);
      functions.logger.info("[PROJECTION] ✅ Proyectado", {
        clinicalEventId,
        projectedTo: result.projectedTo,
        projectedDocId: result.projectedDocId,
        requiresHumanReview: result.requiresHumanReview,
      });
    } catch (err) {
      functions.logger.error("[PROJECTION] ❌ Error proyectando", { clinicalEventId, err });
    }
  }
);
