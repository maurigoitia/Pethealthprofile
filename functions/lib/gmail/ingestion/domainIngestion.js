"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.storeKnowledgeSignal = storeKnowledgeSignal;
exports.mapEventTypeToBrainCategory = mapEventTypeToBrainCategory;
exports.inferBrainCategoryFromSubject = inferBrainCategoryFromSubject;
exports.buildBrainEntitiesFromEvent = buildBrainEntitiesFromEvent;
exports.mirrorBrainResolution = mirrorBrainResolution;
exports.appointmentStatusToCollectionStatus = appointmentStatusToCollectionStatus;
exports.findExistingOperationalAppointmentEvent = findExistingOperationalAppointmentEvent;
exports.upsertOperationalAppointmentProjection = upsertOperationalAppointmentProjection;
exports.ingestEventToDomain = ingestEventToDomain;
const admin = require("firebase-admin");
const types_1 = require("./types");
const utils_1 = require("./utils");
const clinicalNormalization_1 = require("./clinicalNormalization");
const reviewActions_1 = require("./reviewActions");
const brainResolver_1 = require("../../clinical/brainResolver");
// ─── Knowledge signal persistence ───────────────────────────────────────────
async function storeKnowledgeSignal(args) {
    const key = (0, utils_1.sha256)([
        args.uid,
        args.petId || "no_pet",
        args.sessionId,
        args.event.event_type,
        args.event.event_date || "no_date",
        (0, utils_1.normalizeForHash)(args.event.description_summary).slice(0, 180),
    ].join("|"));
    await admin.firestore().collection("structured_medical_dataset").doc(key).set({
        user_id: args.uid,
        pet_id: args.petId || null,
        session_id: args.sessionId,
        validated_event: args.event,
        user_edits_if_any: args.userEdits || null,
        extraction_confidence: (0, utils_1.clamp)(args.extractionConfidence, 0, 100),
        original_confidence: (0, utils_1.clamp)(args.originalConfidence, 0, 100),
        validated_by_human: args.validatedByHuman === true,
        validation_status: args.validationStatus || "pending_human_review",
        source_truth_level: args.sourceTruthLevel || "review_queue",
        requires_manual_confirmation: args.requiresManualConfirmation !== false,
        is_training_eligible: args.validatedByHuman === true,
        created_at: (0, utils_1.getNowIso)(),
    }, { merge: true });
}
// ─── Brain integration helpers ───────────────────────────────────────────────
function mapEventTypeToBrainCategory(eventType) {
    if (eventType === "prescription_record")
        return "Medication";
    if (eventType === "vaccination_record")
        return "Vaccine";
    if (eventType === "study_report")
        return "Diagnostic";
    return "ClinicalEvent";
}
function inferBrainCategoryFromSubject(subject) {
    const normalized = (0, utils_1.normalizeForHash)(subject);
    if (/\b(vacuna|vaccine|revacuna)\b/.test(normalized))
        return "Vaccine";
    if (/\b(receta|prescrip|medicaci[oó]n|medication|tratamiento)\b/.test(normalized))
        return "Medication";
    if (/\b(laboratorio|analisis|an[aá]lisis|ecograf|radiograf|resultado)\b/.test(normalized))
        return "Diagnostic";
    return "ClinicalEvent";
}
function buildBrainEntitiesFromEvent(event) {
    const entities = [];
    if (event.diagnosis) {
        entities.push({
            type: "diagnosis",
            value: event.diagnosis,
            confidence: (0, utils_1.clamp)(event.confidence_score / 100, 0, 1),
        });
    }
    for (const medication of event.medications) {
        entities.push({
            type: "medication",
            name: (0, utils_1.asString)(medication.name) || null,
            dose: (0, utils_1.asString)(medication.dose) || null,
            frequency: (0, utils_1.asString)(medication.frequency) || null,
            duration_days: medication.duration_days,
            is_active: medication.is_active,
            confidence: (0, utils_1.clamp)(event.confidence_score / 100, 0, 1),
        });
    }
    for (const lab of event.lab_results) {
        entities.push({
            type: "lab_result",
            test_name: (0, utils_1.asString)(lab.test_name) || null,
            result: (0, utils_1.asString)(lab.result) || null,
            unit: (0, utils_1.asString)(lab.unit) || null,
            reference_range: (0, utils_1.asString)(lab.reference_range) || null,
            confidence: (0, utils_1.clamp)(event.confidence_score / 100, 0, 1),
        });
    }
    if (entities.length === 0) {
        entities.push({
            type: "summary",
            value: event.description_summary.slice(0, 500),
            confidence: (0, utils_1.clamp)(event.confidence_score / 100, 0, 1),
        });
    }
    return entities;
}
// ─── Brain resolver mirror ───────────────────────────────────────────────────
async function mirrorBrainResolution(args) {
    try {
        await (0, brainResolver_1.resolveBrainOutput)({
            userId: args.uid,
            brainOutput: {
                pet_reference: (0, utils_1.asString)(args.petReference) || null,
                category: args.category,
                entities: args.entities,
                confidence: (0, utils_1.clamp)(args.confidence01, 0, 1),
                review_required: args.reviewRequired,
                reason_if_review_needed: (0, utils_1.asString)(args.reasonIfReviewNeeded) || null,
                ui_hint: (0, utils_1.asRecord)(args.sourceMetadata.ui_hint),
            },
            sourceMetadata: Object.assign(Object.assign({}, args.sourceMetadata), { source: (0, utils_1.asString)(args.sourceMetadata.source) || "gmail", pet_id_hint: (0, utils_1.asString)(args.petIdHint) || null }),
        });
    }
    catch (error) {
        console.warn("[gmail-ingestion] brain resolver mirror failed:", error);
    }
}
// ─── Appointment projection ──────────────────────────────────────────────────
function appointmentStatusToCollectionStatus(status) {
    if (status === "cancelled")
        return "cancelled";
    return "upcoming";
}
async function findExistingOperationalAppointmentEvent(args) {
    const snap = await admin.firestore().collection("medical_events").where("petId", "==", args.petId).limit(60).get();
    let bestMatch = null;
    for (const doc of snap.docs) {
        const row = (0, utils_1.asRecord)(doc.data());
        const extracted = (0, utils_1.asRecord)(row.extractedData);
        if ((0, utils_1.asString)(extracted.documentType) !== "appointment")
            continue;
        const existingDate = (0, utils_1.asString)(extracted.eventDate) || (0, utils_1.asString)(row.eventDate) || null;
        const existingTime = (0, utils_1.asString)(extracted.appointmentTime) || null;
        const existingProvider = (0, utils_1.asString)(extracted.provider) || "";
        const existingClinic = (0, utils_1.asString)(extracted.clinic) || "";
        const existingReason = (0, utils_1.asString)(extracted.suggestedTitle) ||
            (0, utils_1.asString)(row.title) ||
            (0, utils_1.asString)((0, utils_1.asRecord)((Array.isArray(extracted.detectedAppointments) ? extracted.detectedAppointments[0] : null)).title) ||
            "";
        const dateScore = existingDate === args.eventDate ? 1 : (0, utils_1.dateProximityScore)(args.eventDate, existingDate);
        const timeScore = args.appointmentTime && existingTime
            ? (args.appointmentTime === existingTime ? 1 : 0)
            : 0.35;
        const providerScore = args.professionalName ? (0, utils_1.jaccardSimilarity)(args.professionalName, existingProvider) : 0.35;
        const clinicScore = args.clinicName ? (0, utils_1.jaccardSimilarity)(args.clinicName, existingClinic) : 0.35;
        const reasonScore = args.appointmentReason ? (0, utils_1.jaccardSimilarity)(args.appointmentReason, existingReason) : 0.35;
        const total = (dateScore * 0.4) + (timeScore * 0.2) + (providerScore * 0.15) + (clinicScore * 0.1) + (reasonScore * 0.15);
        if (!bestMatch || total > bestMatch.score) {
            bestMatch = { id: doc.id, score: total };
        }
    }
    return bestMatch && bestMatch.score >= 0.7 ? bestMatch.id : null;
}
async function upsertOperationalAppointmentProjection(args) {
    const existingAppointmentSnap = await admin
        .firestore()
        .collection("appointments")
        .where("sourceEventId", "==", args.appointmentEventId)
        .limit(1)
        .get();
    const appointmentId = existingAppointmentSnap.empty
        ? `gmail_appt_${(0, utils_1.sha256)(args.appointmentEventId).slice(0, 16)}`
        : existingAppointmentSnap.docs[0].id;
    // Guard: no sobreescribir status si fue confirmado manualmente por el usuario.
    const existingDoc = existingAppointmentSnap.empty ? null : existingAppointmentSnap.docs[0];
    const existingValidatedByHuman = (existingDoc === null || existingDoc === void 0 ? void 0 : existingDoc.get("validated_by_human")) === true;
    const existingStatus = (0, utils_1.asString)(existingDoc === null || existingDoc === void 0 ? void 0 : existingDoc.get("status"));
    const computedStatus = appointmentStatusToCollectionStatus(args.event.appointment_status);
    const effectiveStatus = existingValidatedByHuman && existingStatus === "completed" ? "completed" : computedStatus;
    await admin.firestore().collection("appointments").doc(appointmentId).set({
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
        createdAt: existingAppointmentSnap.empty ? args.nowIso : (0, utils_1.asString)(existingAppointmentSnap.docs[0].get("createdAt")) || args.nowIso,
        updatedAt: args.nowIso,
        source: "email_import",
        source_email_id: args.sourceEmailId,
        requires_confirmation: args.effectiveRequiresConfirmation,
        source_truth_level: args.sourceTruthLevel,
        validated_by_human: false,
        protocolSnapshotFrozenAt: existingAppointmentSnap.empty
            ? args.nowIso
            : (0, utils_1.asString)(existingAppointmentSnap.docs[0].get("protocolSnapshotFrozenAt")) || args.nowIso,
    }, { merge: true });
}
// ─── Domain ingestion orchestrator ───────────────────────────────────────────
async function ingestEventToDomain(args) {
    var _a, _b, _c;
    const nowIso = (0, utils_1.getNowIso)();
    const petId = args.petId || "";
    const eventDate = args.event.event_date || (0, utils_1.toIsoDateOnly)(new Date(args.sourceDate));
    const title = (0, clinicalNormalization_1.buildCanonicalEventTitle)(args.event);
    const incompleteTreatmentMeds = (0, clinicalNormalization_1.isPrescriptionEventType)(args.event.event_type)
        ? args.event.medications.filter((medication) => !(0, clinicalNormalization_1.medicationHasDoseAndFrequency)(medication))
        : [];
    const hasIncompleteTreatmentMeds = incompleteTreatmentMeds.length > 0;
    const effectiveRequiresConfirmation = args.requiresConfirmation || hasIncompleteTreatmentMeds;
    const sourceTruthLevel = effectiveRequiresConfirmation ? "review_queue" : "ai_auto_ingested";
    const reviewReasons = effectiveRequiresConfirmation
        ? [(0, utils_1.asString)(args.reviewReason) || (hasIncompleteTreatmentMeds ? "missing_treatment_dose_or_frequency" : "requires_review")]
        : [];
    const severityMap = { mild: "leve", moderate: "moderado", severe: "severo" };
    const severity = args.event.severity ? severityMap[args.event.severity] || null : null;
    const canonicalEventId = `gmail_evt_${(0, utils_1.sha256)(`${args.uid}_${args.sourceEmailId}_${args.event.event_type}_${eventDate}_${title}`).slice(0, 20)}`;
    const extractedData = (0, reviewActions_1.buildDefaultExtractedData)({
        event: args.event,
        sourceDate: args.sourceDate,
        sourceSubject: args.sourceSubject,
        sourceSender: args.sourceSender,
        sourceAttachment: args.sourceAttachment,
    });
    const sourceSignedUrl = (0, utils_1.asString)((_a = args.sourceAttachment) === null || _a === void 0 ? void 0 : _a.storage_signed_url) || "";
    const sourceMimeType = (0, utils_1.asString)((_b = args.sourceAttachment) === null || _b === void 0 ? void 0 : _b.mimetype).toLowerCase();
    const inferredFileType = sourceMimeType.includes("pdf") ? "pdf" : sourceMimeType.startsWith("image/") ? "image" : "pdf";
    const treatmentMissingFields = incompleteTreatmentMeds.map((medication) => ({
        medication: (0, utils_1.asString)(medication.name) || null,
        missingDose: !(0, utils_1.asString)(medication.dose),
        missingFrequency: !(0, utils_1.asString)(medication.frequency),
    }));
    const appointmentReason = (0, utils_1.asString)((Array.isArray(extractedData.detectedAppointments) ? (0, utils_1.asRecord)(extractedData.detectedAppointments[0]) : {}).title) ||
        title;
    const existingAppointmentEventId = petId && (0, clinicalNormalization_1.isAppointmentEventType)(args.event.event_type)
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
    const secondaryAppointmentCandidate = !(0, clinicalNormalization_1.isAppointmentEventType)(args.event.event_type)
        ? (0, clinicalNormalization_1.extractOperationalAppointmentCandidate)({
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
    await medicalEventRef.set({
        id: effectiveCanonicalEventId,
        petId,
        userId: args.uid,
        title: title.slice(0, 160),
        documentUrl: sourceSignedUrl,
        documentPreviewUrl: sourceSignedUrl || null,
        fileName: (0, utils_1.asString)((_c = args.sourceAttachment) === null || _c === void 0 ? void 0 : _c.filename) || "email_import",
        fileType: inferredFileType,
        status: effectiveRequiresConfirmation ? "draft" : "completed",
        workflowStatus: effectiveRequiresConfirmation ? "review_required" : "confirmed",
        requiresManualConfirmation: effectiveRequiresConfirmation,
        reviewReasons,
        validatedByHuman: false,
        sourceTruthLevel: sourceTruthLevel,
        truthStatus: effectiveRequiresConfirmation ? "pending_human_review" : "auto_ingested_unconfirmed",
        overallConfidence: args.event.confidence_score,
        extractedData: Object.assign(Object.assign({}, extractedData), { treatmentValidationStatus: hasIncompleteTreatmentMeds ? "needs_review" : "complete", treatmentMissingFields }),
        ocrProcessed: true,
        aiProcessed: true,
        createdAt: (existingMedicalEventSnap === null || existingMedicalEventSnap === void 0 ? void 0 : existingMedicalEventSnap.exists) ? (0, utils_1.asString)(existingMedicalEventSnap.get("createdAt")) || nowIso : nowIso,
        updatedAt: nowIso,
        protocolSnapshotFrozenAt: (existingMedicalEventSnap === null || existingMedicalEventSnap === void 0 ? void 0 : existingMedicalEventSnap.exists)
            ? (0, utils_1.asString)(existingMedicalEventSnap.get("protocolSnapshotFrozenAt")) || nowIso
            : nowIso,
        relatedEventIds: (existingMedicalEventSnap === null || existingMedicalEventSnap === void 0 ? void 0 : existingMedicalEventSnap.exists)
            ? existingMedicalEventSnap.get("relatedEventIds") || []
            : [],
        aiSuggestedRelation: null,
        source: "email_import",
        source_email_id: args.sourceEmailId,
        latest_source_email_id: args.sourceEmailId,
        source_email_ids: admin.firestore.FieldValue.arrayUnion(args.sourceEmailId),
        domain_ingestion_type: (0, clinicalNormalization_1.isVaccinationEventType)(args.event.event_type)
            ? "vaccination"
            : (0, clinicalNormalization_1.isAppointmentEventType)(args.event.event_type)
                ? "appointment"
                : hasIncompleteTreatmentMeds
                    ? "medical_event"
                    : (0, clinicalNormalization_1.isPrescriptionEventType)(args.event.event_type)
                        ? "treatment"
                        : "medical_event",
        severity,
        findings: args.event.lab_results.length > 0
            ? args.event.lab_results.map((row) => `${row.test_name}: ${row.result}`).join(" | ").slice(0, 1400)
            : null,
    }, { merge: true });
    if ((0, clinicalNormalization_1.isAppointmentEventType)(args.event.event_type)) {
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
            title: (0, clinicalNormalization_1.buildCanonicalEventTitle)(secondaryAppointmentCandidate),
            eventDate,
            event: secondaryAppointmentCandidate,
            narrativeSummary: (0, utils_1.cleanSentence)([args.narrativeSummary, args.sourceSubject, title].filter(Boolean).join(" · ")),
            sourceEmailId: args.sourceEmailId,
            sourceTruthLevel,
            effectiveRequiresConfirmation,
            nowIso,
        });
    }
    if ((0, clinicalNormalization_1.isPrescriptionEventType)(args.event.event_type)) {
        if (hasIncompleteTreatmentMeds) {
            return {
                domainType: "medical_event",
                canonicalEventId: effectiveCanonicalEventId,
                blockedMedicationCount: incompleteTreatmentMeds.length,
            };
        }
        const eventStartDate = (0, utils_1.parseDateOnly)(eventDate) || new Date(args.sourceDate);
        for (const medication of args.event.medications) {
            const medName = (0, utils_1.asString)(medication.name) || "medication";
            const trtId = `gmail_trt_${(0, utils_1.sha256)(`${args.uid}_${args.sourceEmailId}_${medName}`).slice(0, 18)}`;
            const computedEndDate = medication.duration_days
                ? new Date(eventStartDate.getTime() + medication.duration_days * types_1.ONE_DAY_MS)
                : null;
            await admin.firestore().collection("treatments").doc(trtId).set({
                id: trtId,
                petId,
                userId: args.uid,
                ownerId: args.uid,
                normalizedName: (0, utils_1.normalizeForHash)(medName),
                startDate: eventDate,
                endDate: computedEndDate ? (0, utils_1.toIsoDateOnly)(computedEndDate) : null,
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
            }, { merge: true });
            const medId = `gmail_med_${(0, utils_1.sha256)(`${args.uid}_${args.sourceEmailId}_${medName}`).slice(0, 18)}`;
            await admin.firestore().collection("medications").doc(medId).set({
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
            }, { merge: true });
        }
        return {
            domainType: "treatment",
            canonicalEventId: effectiveCanonicalEventId,
            blockedMedicationCount: 0,
        };
    }
    return {
        domainType: (0, clinicalNormalization_1.isVaccinationEventType)(args.event.event_type) ? "vaccination" : "medical_event",
        canonicalEventId: effectiveCanonicalEventId,
        blockedMedicationCount: 0,
    };
}
//# sourceMappingURL=domainIngestion.js.map