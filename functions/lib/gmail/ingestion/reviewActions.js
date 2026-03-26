"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.persistReviewEvent = persistReviewEvent;
exports.buildDefaultExtractedData = buildDefaultExtractedData;
exports.buildIncompleteTreatmentSubtitle = buildIncompleteTreatmentSubtitle;
exports.selectBestAttachmentForReview = selectBestAttachmentForReview;
exports.upsertClinicalReviewDraft = upsertClinicalReviewDraft;
exports.upsertIncompleteTreatmentPendingAction = upsertIncompleteTreatmentPendingAction;
exports.buildSyncReviewTitle = buildSyncReviewTitle;
exports.buildReviewReasonCopy = buildReviewReasonCopy;
exports.buildSyncReviewSubtitle = buildSyncReviewSubtitle;
exports.upsertSyncReviewPendingAction = upsertSyncReviewPendingAction;
exports.detectSemanticDuplicateCandidate = detectSemanticDuplicateCandidate;
exports.isDuplicateEventByFingerprint = isDuplicateEventByFingerprint;
const admin = require("firebase-admin");
const utils_1 = require("./utils");
const clinicalNormalization_1 = require("./clinicalNormalization");
const envConfig_1 = require("./envConfig");
// ─── Review event persistence ────────────────────────────────────────────────
async function persistReviewEvent(args) {
    const docId = `${args.sessionId}_${(0, utils_1.sha256)(JSON.stringify(args.event)).slice(0, 12)}`;
    const silentApprovalExpiresAt = new Date(Date.now() + (0, envConfig_1.getSilentApprovalWindowHours)() * 60 * 60 * 1000).toISOString();
    await admin.firestore().collection("gmail_event_reviews").doc(docId).set({
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
        created_at: (0, utils_1.getNowIso)(),
        updated_at: (0, utils_1.getNowIso)(),
    }, { merge: true });
    return docId;
}
// ─── Default extracted data builder ──────────────────────────────────────────
function buildDefaultExtractedData(args) {
    var _a, _b, _c, _d, _e;
    const eventDate = args.event.event_date || (0, utils_1.toIsoDateOnly)(new Date(args.sourceDate));
    const documentType = (0, clinicalNormalization_1.toMedicalEventDocumentType)(args.event);
    const confidence = args.event.confidence_score >= 85 ? "high" : args.event.confidence_score >= 60 ? "medium" : "low";
    const appointmentConfidence = args.event.date_confidence >= 85 ? "high" : args.event.date_confidence >= 60 ? "medium" : "low";
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
        referenceRange: (0, utils_1.sanitizeReferenceRange)(row.reference_range, row.result),
        confidence,
    }));
    const suggestedTitle = (0, clinicalNormalization_1.buildCanonicalEventTitle)(args.event).slice(0, 120);
    const appointmentLabel = (0, clinicalNormalization_1.deriveAppointmentLabel)(args.event) || suggestedTitle;
    const sourceStorageUri = (0, utils_1.asString)((_a = args.sourceAttachment) === null || _a === void 0 ? void 0 : _a.storage_uri) || null;
    const sourceStoragePath = (0, utils_1.asString)((_b = args.sourceAttachment) === null || _b === void 0 ? void 0 : _b.storage_path) || null;
    const sourceStorageSignedUrl = (0, utils_1.asString)((_c = args.sourceAttachment) === null || _c === void 0 ? void 0 : _c.storage_signed_url) || null;
    const sourceFileName = (0, utils_1.asString)((_d = args.sourceAttachment) === null || _d === void 0 ? void 0 : _d.filename) || null;
    const sourceMimeType = (0, utils_1.asString)((_e = args.sourceAttachment) === null || _e === void 0 ? void 0 : _e.mimetype) || null;
    const detectedAppointments = (0, clinicalNormalization_1.isAppointmentEventType)(args.event.event_type)
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
        taxonomyRoute: (0, clinicalNormalization_1.isAppointmentEventType)(args.event.event_type)
            ? "operational_appointment"
            : (0, clinicalNormalization_1.isStudyEventType)(args.event.event_type)
                ? "study_report"
                : (0, clinicalNormalization_1.isPrescriptionEventType)(args.event.event_type)
                    ? "prescription_record"
                    : (0, clinicalNormalization_1.isVaccinationEventType)(args.event.event_type)
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
function buildIncompleteTreatmentSubtitle(event) {
    const incomplete = event.medications
        .filter((med) => !(0, clinicalNormalization_1.medicationHasDoseAndFrequency)(med))
        .map((med) => {
        const medName = (0, utils_1.asString)(med.name) || "medicación";
        const missing = [];
        if (!(0, utils_1.asString)(med.dose))
            missing.push("dosis");
        if (!(0, utils_1.asString)(med.frequency))
            missing.push("frecuencia");
        return `${medName} (falta ${missing.join(" y ")})`;
    })
        .slice(0, 3);
    if (incomplete.length === 0) {
        return "Detectamos tratamiento, pero falta confirmar dosis o frecuencia antes de activar alarmas.";
    }
    return `Detectamos tratamiento incompleto: ${incomplete.join(", ")}. Confirmá los datos para activar recordatorios.`;
}
// ─── Best attachment selection ───────────────────────────────────────────────
function selectBestAttachmentForReview(attachmentMetadata) {
    if (!Array.isArray(attachmentMetadata) || attachmentMetadata.length === 0)
        return null;
    const withSignedUrl = attachmentMetadata.find((row) => Boolean((0, utils_1.asString)(row.storage_signed_url)));
    if (withSignedUrl)
        return withSignedUrl;
    const withStoredUri = attachmentMetadata.find((row) => Boolean((0, utils_1.asString)(row.storage_uri)));
    if (withStoredUri)
        return withStoredUri;
    return attachmentMetadata[0] || null;
}
// ─── Clinical review draft upsert ────────────────────────────────────────────
async function upsertClinicalReviewDraft(args) {
    const reviewId = `review_${(0, utils_1.sha256)(`${args.uid}_${args.canonicalEventId}`).slice(0, 24)}`;
    const nowIso = (0, utils_1.getNowIso)();
    const selectedAttachment = selectBestAttachmentForReview(args.attachmentMetadata);
    const sourceStorageUri = (0, utils_1.asString)(selectedAttachment === null || selectedAttachment === void 0 ? void 0 : selectedAttachment.storage_uri) || null;
    const sourceStoragePath = (0, utils_1.asString)(selectedAttachment === null || selectedAttachment === void 0 ? void 0 : selectedAttachment.storage_path) || null;
    const sourceStorageSignedUrl = (0, utils_1.asString)(selectedAttachment === null || selectedAttachment === void 0 ? void 0 : selectedAttachment.storage_signed_url) || null;
    const sourceFileName = (0, utils_1.asString)(selectedAttachment === null || selectedAttachment === void 0 ? void 0 : selectedAttachment.filename) || null;
    const sourceMimeType = (0, utils_1.asString)(selectedAttachment === null || selectedAttachment === void 0 ? void 0 : selectedAttachment.mimetype) || null;
    const imageFragmentUrl = sourceStorageSignedUrl || sourceStorageUri || null;
    const missingFields = args.event.medications
        .filter((medication) => !(0, clinicalNormalization_1.medicationHasDoseAndFrequency)(medication))
        .map((medication) => ({
        medication: (0, utils_1.asString)(medication.name) || null,
        missingDose: !(0, utils_1.asString)(medication.dose),
        missingFrequency: !(0, utils_1.asString)(medication.frequency),
        detectedDose: (0, utils_1.asString)(medication.dose) || null,
        detectedFrequency: (0, utils_1.asString)(medication.frequency) || null,
    }));
    await admin.firestore().collection("clinical_review_drafts").doc(reviewId).set({
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
        gmailReviewId: (0, utils_1.asString)(args.gmailReviewId) || null,
        missingFields,
        missing_fields: missingFields,
        medications: args.event.medications.map((medication) => ({
            name: (0, utils_1.asString)(medication.name) || null,
            dose: (0, utils_1.asString)(medication.dose) || null,
            frequency: (0, utils_1.asString)(medication.frequency) || null,
            duration_days: medication.duration_days || null,
            is_active: medication.is_active !== false,
        })),
        diagnosis: (0, utils_1.asString)(args.event.diagnosis) || null,
        eventDate: (0, utils_1.asString)(args.event.event_date) || null,
        createdAt: nowIso,
        updatedAt: nowIso,
        resolvedAt: null,
        resolvedBy: null,
    }, { merge: true });
    return reviewId;
}
// ─── Incomplete treatment pending action ─────────────────────────────────────
async function upsertIncompleteTreatmentPendingAction(args) {
    var _a, _b, _c, _d, _e;
    const pendingId = `incomplete_treatment_${args.canonicalEventId}`;
    const nowIso = (0, utils_1.getNowIso)();
    const sourceStorageUri = (0, utils_1.asString)((_a = args.sourceAttachment) === null || _a === void 0 ? void 0 : _a.storage_uri) || null;
    const sourceStoragePath = (0, utils_1.asString)((_b = args.sourceAttachment) === null || _b === void 0 ? void 0 : _b.storage_path) || null;
    const sourceStorageSignedUrl = (0, utils_1.asString)((_c = args.sourceAttachment) === null || _c === void 0 ? void 0 : _c.storage_signed_url) || null;
    const sourceFileName = (0, utils_1.asString)((_d = args.sourceAttachment) === null || _d === void 0 ? void 0 : _d.filename) || null;
    const sourceMimeType = (0, utils_1.asString)((_e = args.sourceAttachment) === null || _e === void 0 ? void 0 : _e.mimetype) || null;
    const imageFragmentUrl = sourceStorageSignedUrl || sourceStorageUri || null;
    await admin.firestore().collection("pending_actions").doc(pendingId).set({
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
    }, { merge: true });
}
// ─── Sync review helpers ─────────────────────────────────────────────────────
function buildSyncReviewTitle(event) {
    const eventLabel = {
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
function buildReviewReasonCopy(reason) {
    const normalized = (0, utils_1.normalizeClinicalToken)(reason);
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
function buildSyncReviewSubtitle(args) {
    return `Email ${args.sourceEmailId.slice(0, 8)} · ${buildReviewReasonCopy(args.reason)}`;
}
// ─── Sync review pending action ──────────────────────────────────────────────
async function upsertSyncReviewPendingAction(args) {
    var _a, _b, _c, _d, _e;
    if (!args.petId)
        return;
    const pendingId = `sync_review_${args.gmailReviewId}`;
    const nowIso = (0, utils_1.getNowIso)();
    const sourceStorageUri = (0, utils_1.asString)((_a = args.sourceAttachment) === null || _a === void 0 ? void 0 : _a.storage_uri) || null;
    const sourceStoragePath = (0, utils_1.asString)((_b = args.sourceAttachment) === null || _b === void 0 ? void 0 : _b.storage_path) || null;
    const sourceStorageSignedUrl = (0, utils_1.asString)((_c = args.sourceAttachment) === null || _c === void 0 ? void 0 : _c.storage_signed_url) || null;
    const sourceFileName = (0, utils_1.asString)((_d = args.sourceAttachment) === null || _d === void 0 ? void 0 : _d.filename) || null;
    const sourceMimeType = (0, utils_1.asString)((_e = args.sourceAttachment) === null || _e === void 0 ? void 0 : _e.mimetype) || null;
    const imageFragmentUrl = sourceStorageSignedUrl || sourceStorageUri || null;
    await admin.firestore().collection("pending_actions").doc(pendingId).set({
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
    }, { merge: true });
}
// ─── Duplicate detection ─────────────────────────────────────────────────────
async function detectSemanticDuplicateCandidate(args) {
    var _a;
    const petId = args.petId || "";
    if (!petId)
        return { isLikelyDuplicate: false, score: 0 };
    const candidateCollections = [
        { name: "medical_events", dateField: "eventDate", diagnosisField: "diagnosis", clinicField: "sourceSender" },
        { name: "treatments", dateField: "startDate", diagnosisField: "clinical_indication", clinicField: "clinic_name" },
        { name: "medications", dateField: "startDate", diagnosisField: "indication", clinicField: "prescribedBy" },
    ];
    let maxScore = 0;
    const eventDate = args.event.event_date || null;
    const medicationName = ((_a = args.event.medications[0]) === null || _a === void 0 ? void 0 : _a.name) || "";
    const diagnosis = args.event.diagnosis || args.event.description_summary;
    for (const coll of candidateCollections) {
        const snap = await admin
            .firestore()
            .collection(coll.name)
            .where("petId", "==", petId)
            .limit(40)
            .get();
        for (const doc of snap.docs) {
            const row = (0, utils_1.asRecord)(doc.data());
            const extractedData = (0, utils_1.asRecord)(row.extractedData);
            const extractedMedications = Array.isArray(extractedData.medications)
                ? extractedData.medications
                    .map((med) => {
                    const medRow = (0, utils_1.asRecord)(med);
                    return (0, utils_1.asString)(medRow.name) || (0, utils_1.asString)(medRow.medication) || (0, utils_1.asString)(medRow.drug);
                })
                    .filter(Boolean)
                    .join(" ")
                : (0, utils_1.asString)(extractedData.medications);
            const existingDate = (0, utils_1.asString)(row[coll.dateField]) || null;
            const existingMedication = (0, utils_1.asString)(row.name) ||
                (0, utils_1.asString)(row.treatment_name) ||
                extractedMedications ||
                "";
            const existingDiagnosis = (0, utils_1.asString)(row[coll.diagnosisField]) ||
                (0, utils_1.asString)(row.title) ||
                (0, utils_1.asString)(extractedData.diagnosis) ||
                "";
            const existingClinic = (0, utils_1.asString)(row[coll.clinicField]) || (0, utils_1.asString)((0, utils_1.asRecord)(row.source).sender) || "";
            const medicationScore = medicationName
                ? (0, utils_1.jaccardSimilarity)(medicationName, existingMedication || existingDiagnosis)
                : 0.5;
            const dateScore = (0, utils_1.dateProximityScore)(eventDate, existingDate);
            const diagnosisScore = (0, utils_1.jaccardSimilarity)(diagnosis, existingDiagnosis || existingMedication);
            const clinicScore = (0, utils_1.jaccardSimilarity)(args.sourceSender, existingClinic);
            const total = (medicationScore * 0.35) + (dateScore * 0.3) + (diagnosisScore * 0.25) + (clinicScore * 0.1);
            if (total > maxScore)
                maxScore = total;
        }
    }
    return {
        isLikelyDuplicate: maxScore >= 0.78,
        score: Math.round(maxScore * 100),
    };
}
async function isDuplicateEventByFingerprint(args) {
    const keyParts = [
        args.uid,
        args.petId || "no_pet",
        args.event.event_type,
        args.event.event_date || "no_date",
        (0, utils_1.normalizeForHash)(args.event.description_summary).slice(0, 180),
    ];
    const hash = (0, utils_1.sha256)(keyParts.join("|"));
    const ref = admin.firestore().collection("gmail_event_fingerprints").doc(hash);
    const snap = await ref.get();
    if (snap.exists) {
        return true;
    }
    await ref.set({
        user_id: args.uid,
        pet_id: args.petId,
        event_type: args.event.event_type,
        event_date: args.event.event_date,
        summary: args.event.description_summary.slice(0, 250),
        created_at: (0, utils_1.getNowIso)(),
    }, { merge: true });
    return false;
}
//# sourceMappingURL=reviewActions.js.map