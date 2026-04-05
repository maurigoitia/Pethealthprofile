"use strict";
// ============================================================================
// PESSY - Clinical Projection Layer
//
// Cierra el dead-end del path Gmail:
//   clinical_events (brainResolver) → colecciones operacionales
//
// Trigger: onDocumentCreated("clinical_events/{docId}")
// También expone projectClinicalEvent() para llamado directo desde otros módulos.
// ============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.onClinicalEventProjection = void 0;
exports.projectClinicalEvent = projectClinicalEvent;
const admin = require("firebase-admin");
const functions = require("firebase-functions");
const firestore_1 = require("firebase-functions/v2/firestore");
const ROUTING_TABLE = {
    // Vacunas
    "Vaccine/vaccination_record": { collection: "medical_events", documentType: "vaccine", requiresHumanReview: false },
    "Vaccine/general_clinical_report": { collection: "medical_events", documentType: "vaccine", requiresHumanReview: false },
    // Citas / Turnos
    "ClinicalEvent/appointment_confirmation": { collection: "appointments", requiresHumanReview: false },
    "ClinicalEvent/referral_letter": { collection: "appointments", requiresHumanReview: true, reviewReason: "Derivación — confirmar fecha y especialidad" },
    "ClinicalEvent/general_clinical_report": { collection: "medical_events", documentType: "checkup", requiresHumanReview: false },
    "ClinicalEvent/surgical_report": { collection: "medical_events", documentType: "surgery", requiresHumanReview: false },
    "ClinicalEvent/anesthesia_report": { collection: "medical_events", documentType: "surgery", requiresHumanReview: false },
    "ClinicalEvent/equine_dental_exam": { collection: "medical_events", documentType: "checkup", requiresHumanReview: false },
    "ClinicalEvent/equine_reproductive_exam": { collection: "medical_events", documentType: "checkup", requiresHumanReview: false },
    "ClinicalEvent/exotic_wellness_exam": { collection: "medical_events", documentType: "checkup", requiresHumanReview: false },
    // Medicación
    "Medication/prescription": { collection: "treatments", treatmentSubtype: "medication", requiresHumanReview: true, reviewReason: "Prescripción — verificar dosis y frecuencia" },
    "Medication/discharge_summary": { collection: "treatments", treatmentSubtype: "medication", requiresHumanReview: true, reviewReason: "Alta médica con medicación" },
    "Medication/general_clinical_report": { collection: "treatments", treatmentSubtype: "medication", requiresHumanReview: true, reviewReason: "Medicación en informe — confirmar indicación" },
    // Laboratorio
    "Diagnostic/blood_panel": { collection: "medical_events", documentType: "lab_test", requiresHumanReview: false },
    "Diagnostic/biochemistry_panel": { collection: "medical_events", documentType: "lab_test", requiresHumanReview: false },
    "Diagnostic/urinalysis": { collection: "medical_events", documentType: "lab_test", requiresHumanReview: false },
    "Diagnostic/fecal_exam": { collection: "medical_events", documentType: "lab_test", requiresHumanReview: false },
    "Diagnostic/cytology": { collection: "medical_events", documentType: "lab_test", requiresHumanReview: false },
    "Diagnostic/culture_sensitivity": { collection: "medical_events", documentType: "lab_test", requiresHumanReview: false },
    "Diagnostic/serology": { collection: "medical_events", documentType: "lab_test", requiresHumanReview: false },
    "Diagnostic/hormonal_panel": { collection: "medical_events", documentType: "lab_test", requiresHumanReview: false },
    "Diagnostic/coagulation_panel": { collection: "medical_events", documentType: "lab_test", requiresHumanReview: false },
    "Diagnostic/dermatology_microscopy": { collection: "medical_events", documentType: "lab_test", requiresHumanReview: false },
    "Diagnostic/skin_biopsy": { collection: "medical_events", documentType: "lab_test", requiresHumanReview: false },
    "Diagnostic/pathology_report": { collection: "medical_events", documentType: "lab_test", requiresHumanReview: false },
    "Diagnostic/equine_lameness_exam": { collection: "medical_events", documentType: "checkup", requiresHumanReview: false },
    "Diagnostic/dental_radiograph": { collection: "medical_events", documentType: "xray", requiresHumanReview: false },
    // Imágenes
    "Diagnostic/radiology_report": { collection: "medical_events", documentType: "xray", requiresHumanReview: false },
    "Diagnostic/ultrasound_report": { collection: "medical_events", documentType: "xray", requiresHumanReview: false },
    "Diagnostic/echocardiogram_report": { collection: "medical_events", documentType: "echocardiogram", requiresHumanReview: false },
    "Diagnostic/ct_scan_report": { collection: "medical_events", documentType: "xray", requiresHumanReview: false },
    "Diagnostic/mri_report": { collection: "medical_events", documentType: "xray", requiresHumanReview: false },
    "Diagnostic/endoscopy_report": { collection: "medical_events", documentType: "other", requiresHumanReview: false },
    "Diagnostic/electrocardiogram_report": { collection: "medical_events", documentType: "electrocardiogram", requiresHumanReview: false },
};
const CATEGORY_FALLBACK = {
    Vaccine: { collection: "medical_events", documentType: "vaccine", requiresHumanReview: false },
    Medication: { collection: "treatments", treatmentSubtype: "medication", requiresHumanReview: true, reviewReason: "Medicación — confirmar protocolo" },
    Diagnostic: { collection: "medical_events", documentType: "other", requiresHumanReview: false },
    ClinicalEvent: { collection: "medical_events", documentType: "checkup", requiresHumanReview: false },
};
function resolveRouting(category, documentType, forceReview) {
    var _a, _b;
    const key = `${category}/${documentType}`;
    const base = (_b = (_a = ROUTING_TABLE[key]) !== null && _a !== void 0 ? _a : CATEGORY_FALLBACK[category]) !== null && _b !== void 0 ? _b : { collection: "medical_events", documentType: "other", requiresHumanReview: true, reviewReason: "Tipo no reconocido" };
    if (forceReview) {
        return Object.assign(Object.assign({}, base), { requiresHumanReview: true, reviewReason: forceReview });
    }
    return base;
}
// ─── Helpers ──────────────────────────────────────────────────────────────────
function asString(v) {
    return typeof v === "string" ? v.trim() : "";
}
function buildDeduplicationId(petId, documentType, eventDate) {
    // ID determinista para evitar duplicados si el trigger se ejecuta más de una vez
    const dateKey = eventDate ? eventDate.slice(0, 10) : "no-date";
    return `proj_${petId}_${documentType.replace(/[^a-z0-9]/gi, "_")}_${dateKey}`;
}
// ─── Proyección a medical_events ─────────────────────────────────────────────
async function projectToMedicalEvent(args) {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    const { data, decision, clinicalEventId } = args;
    const petId = asString(data.petId);
    const userId = asString(data.userId);
    const eventDate = asString((_b = (_a = data.source_metadata) === null || _a === void 0 ? void 0 : _a.source_date) !== null && _b !== void 0 ? _b : data.extracted_at);
    const documentType = (_c = decision.documentType) !== null && _c !== void 0 ? _c : "other";
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
    const entities = Array.isArray(data.data) ? data.data : [];
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
    const payload = {
        petId,
        userId,
        documentType,
        status: "completed",
        title: asString(data.primary_finding) || documentType,
        source: "gmail_projection",
        clinicalEventId, // lineage al clinical_event origen
        validatedByHuman: data.validated_by_human === true,
        sourceTruthLevel: asString(data.source_truth_level) || "ai_high_confidence",
        truthStatus: data.validated_by_human === true ? "human_confirmed" : "ai_verified",
        requiresManualConfirmation: false,
        extractedData: {
            documentType,
            eventDate: eventDate || null,
            clinic: asString((_d = data.source_metadata) === null || _d === void 0 ? void 0 : _d.sender) || null,
            provider: null,
            diagnosis: diagnoses.map((d) => d.condition_name).filter(Boolean).join("; ") || null,
            diagnosisConfidence: data.brain_confidence >= 0.85 ? "high" : "medium",
            observations: asString(data.primary_finding) || null,
            measurements: findings,
            medications: [],
            detectedAppointments: [],
            studyType: asString(data.study_type) || null,
            aiGeneratedSummary: null, // No copiar resumen largo sin revisar
            masterClinical: (_e = data.brain_output) !== null && _e !== void 0 ? _e : null,
            sourceReceivedAt: asString((_f = data.source_metadata) === null || _f === void 0 ? void 0 : _f.source_date) || null,
            sourceSubject: asString((_g = data.source_metadata) === null || _g === void 0 ? void 0 : _g.subject) || null,
            sourceSender: asString((_h = data.source_metadata) === null || _h === void 0 ? void 0 : _h.from_email) || null,
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
async function projectToAppointment(args) {
    var _a, _b, _c, _d, _e, _f;
    const { data, clinicalEventId } = args;
    const petId = asString(data.petId);
    const userId = asString(data.userId);
    const nowIso = new Date().toISOString();
    // Buscar entidades de tipo appointment en el brain output
    const entities = Array.isArray(data.data) ? data.data : [];
    const appointmentEntities = entities.filter((e) => asString(e.type) === "appointment" || asString(e.type) === "scheduled_event");
    const sourceDate = asString((_a = data.source_metadata) === null || _a === void 0 ? void 0 : _a.source_date);
    const subject = asString((_b = data.source_metadata) === null || _b === void 0 ? void 0 : _b.subject);
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
                date: asString((_c = firstAppt.value) !== null && _c !== void 0 ? _c : firstAppt.date) || sourceDate || null,
                time: asString(firstAppt.time) || null,
                title: asString((_d = firstAppt.label) !== null && _d !== void 0 ? _d : data.primary_finding) || subject || "Turno detectado",
                veterinarian: null,
                clinic: asString((_e = data.source_metadata) === null || _e === void 0 ? void 0 : _e.from_email) || null,
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
            clinic: asString((_f = data.source_metadata) === null || _f === void 0 ? void 0 : _f.from_email) || null,
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
async function projectToTreatment(args) {
    var _a, _b, _c, _d;
    const { data, decision, clinicalEventId } = args;
    const petId = asString(data.petId);
    const userId = asString(data.userId);
    const nowIso = new Date().toISOString();
    const entities = Array.isArray(data.data) ? data.data : [];
    const medicationEntities = entities.filter((e) => asString(e.type) === "medication" || asString(e.type) === "drug" || asString(e.type) === "prescription_item");
    const treatmentId = `tx_proj_${clinicalEventId}`;
    const docRef = admin.firestore().collection("treatments").doc(treatmentId);
    const existing = await docRef.get();
    if (existing.exists)
        return treatmentId;
    const firstMed = (_a = medicationEntities[0]) !== null && _a !== void 0 ? _a : {};
    const drugName = asString((_b = firstMed.label) !== null && _b !== void 0 ? _b : data.primary_finding) || "Medicación detectada";
    await docRef.set({
        petId,
        userId,
        normalizedName: drugName.toLowerCase().replace(/\s+/g, " "),
        displayName: drugName,
        subtype: (_c = decision.treatmentSubtype) !== null && _c !== void 0 ? _c : "medication",
        status: "active",
        dosage: asString(firstMed.value) || null,
        unit: asString(firstMed.unit) || null,
        frequency: null, // no se puede inferir sin revisión humana
        startDate: asString((_d = data.source_metadata) === null || _d === void 0 ? void 0 : _d.source_date) || null,
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
async function projectClinicalEvent(clinicalEventId, data) {
    var _a, _b, _c;
    const nowIso = new Date().toISOString();
    // ── Anti-duplicate: si Gmail ya creó el medical_events (via ingestEventToDomain),
    //    reusar ese doc en lugar de crear uno nuevo. Evita duplicados en el Timeline.
    const sourceMeta = ((_a = data.source_metadata) !== null && _a !== void 0 ? _a : {});
    const existingCanonicalId = asString(sourceMeta.canonical_event_id);
    if (existingCanonicalId) {
        const existingSnap = await admin
            .firestore()
            .collection("medical_events")
            .doc(existingCanonicalId)
            .get();
        if (existingSnap.exists) {
            await existingSnap.ref.update({ clinicalEventId, lastProjectedAt: nowIso });
            await admin.firestore().collection("clinical_events").doc(clinicalEventId).update({
                projected: true,
                projectedTo: "medical_events",
                projectedDocId: existingCanonicalId,
                projectedAt: nowIso,
            });
            functions.logger.info("[PROJECTION] ♻️ Reutilizando medical_events existente", {
                clinicalEventId,
                existingCanonicalId,
            });
            return {
                projectedTo: "medical_events",
                projectedDocId: existingCanonicalId,
                requiresHumanReview: false,
            };
        }
    }
    const category = asString(data.category);
    const documentType = asString(data.document_type);
    const confidence = typeof data.brain_confidence === "number" ? data.brain_confidence : 0;
    // Forzar revisión si confianza baja o mascota no resuelta
    const forceReview = confidence < 0.85
        ? `Confianza baja (${Math.round(confidence * 100)}%) — verificar datos extraídos`
        : !asString(data.petId)
            ? "Mascota no identificada — asignar manualmente"
            : undefined;
    const decision = resolveRouting(category, documentType, forceReview);
    let projectedDocId;
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
            const collectionLabel = {
                treatments: "tratamiento/medicación",
                appointments: "turno médico",
                medical_events: "evento clínico",
            };
            const label = (_b = collectionLabel[decision.collection]) !== null && _b !== void 0 ? _b : decision.collection;
            await paRef.set({
                petId,
                userId,
                type: "incomplete_data",
                title: (_c = decision.reviewReason) !== null && _c !== void 0 ? _c : `IA detectó ${label} — confirmá antes de activar`,
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
// ─── Cloud Function trigger ─────────────────────────────── v2.1 ─────────────
exports.onClinicalEventProjection = (0, firestore_1.onDocumentCreated)({
    document: "clinical_events/{docId}",
    timeoutSeconds: 60,
    memory: "256MiB",
    region: "us-central1",
}, async (event) => {
    const snap = event.data;
    if (!snap)
        return;
    const data = snap.data();
    const clinicalEventId = event.params.docId;
    // Solo proyectar eventos verificados
    if (asString(data.status) !== "verified")
        return;
    // Evitar reproyectar si ya se procesó
    if (data.projected === true)
        return;
    try {
        const result = await projectClinicalEvent(clinicalEventId, data);
        functions.logger.info("[PROJECTION] ✅ Proyectado", {
            clinicalEventId,
            projectedTo: result.projectedTo,
            projectedDocId: result.projectedDocId,
            requiresHumanReview: result.requiresHumanReview,
        });
    }
    catch (err) {
        functions.logger.error("[PROJECTION] ❌ Error proyectando", { clinicalEventId, err });
    }
});
//# sourceMappingURL=projectionLayer.js.map