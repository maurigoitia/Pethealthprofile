"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ingestClinicalEmailWebhook = exports.cleanupLegacyMailsyncMedicalEvents = exports.backfillNarrativeHistory = exports.backfillGmailTaxonomy = exports.forceRunEmailClinicalIngestion = exports.runEmailClinicalAiWorker = exports.runEmailClinicalAttachmentWorker = exports.runEmailClinicalScanWorker = exports.runEmailClinicalIngestionQueue = exports.triggerEmailClinicalIngestion = void 0;
exports.initializeEmailIngestionAfterOauth = initializeEmailIngestionAfterOauth;
const admin = require("firebase-admin");
const functions = require("firebase-functions");
const stream_1 = require("stream");
const promises_1 = require("stream/promises");
const mammoth = require("mammoth/lib/index");
const invitation_1 = require("./invitation");
const petMatching_1 = require("./ingestion/petMatching");
const utils_1 = require("./ingestion/utils");
const sessionQueue_1 = require("./ingestion/sessionQueue");
const clinicalNormalization_1 = require("./ingestion/clinicalNormalization");
const emailParsing_1 = require("./ingestion/emailParsing");
const textProcessing_1 = require("./ingestion/textProcessing");
const clinicalAi_1 = require("./ingestion/clinicalAi");
const jobProcessing_1 = require("./ingestion/jobProcessing");
const reviewActions_1 = require("./ingestion/reviewActions");
const domainIngestion_1 = require("./ingestion/domainIngestion");
const envConfig_1 = require("./ingestion/envConfig");
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_GMAIL_PROFILE_URL = "https://gmail.googleapis.com/gmail/v1/users/me/profile";
const GMAIL_API_BASE_URL = "https://gmail.googleapis.com/gmail/v1/users/me";
const MAX_ATTACHMENT_SIZE_BYTES = 25 * 1024 * 1024;
const MAX_ATTACHMENTS_PER_EMAIL = 10;
const DEDUP_WINDOW_DAYS = 30;
const SESSION_AUDIT_RETENTION_DAYS = 90;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const GMAIL_SCOPE_READONLY = "https://www.googleapis.com/auth/gmail.readonly";
const FREE_PLAN_ATTACHMENT_PROCESS_LIMIT = 20;
const MAX_AI_DOCUMENT_TEXT_CHARS = 120000;
const LOW_RESULT_FALLBACK_MAX_SCANNED = 3;
const LOW_RESULT_FALLBACK_MAX_CANDIDATES = 1;
const STALE_PROCESSING_JOB_MS = 5 * 60 * 1000;
const STALE_PROCESSING_SCAN_FACTOR = 6;
const STALE_ACTIVE_SESSION_MS = 60 * 60 * 1000;
const FORCE_DRAIN_POLL_MS = 1200;
const FORCE_DRAIN_MAX_WAIT_MS = 4 * 60 * 1000;
const FORCE_DRAIN_MAX_JOBS_PER_STAGE = 30;
const RECENT_HISTORY_WINDOW_DAYS = 90;
const MONTHLY_BUCKET_UNTIL_MONTHS = 18;
function buildScanCountersPatch(counters) {
    return {
        total_emails_scanned: counters.total_emails_scanned,
        candidate_emails_detected: counters.candidate_emails_detected,
        emails_with_attachments: counters.emails_with_attachments,
        emails_with_images: counters.emails_with_images,
        duplicates_removed: counters.duplicates_removed,
    };
}
function toFirestoreCounterFields(counters) {
    const patch = {};
    for (const [key, value] of Object.entries(counters)) {
        patch[`counters.${key}`] = value;
    }
    return patch;
}
async function deleteLegacyEventArtifacts(eventId) {
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
async function runLegacyMailsyncCleanup(args) {
    const dryRun = args.dryRun !== false;
    const limit = (0, utils_1.clamp)((0, utils_1.asNonNegativeNumber)(args.limit, 200), 1, 500);
    const result = {
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
    let query = admin.firestore().collection("medical_events").where("userId", "==", args.uid);
    if (args.petId)
        query = query.where("petId", "==", args.petId);
    const snap = await query.limit(limit).get();
    result.total_scanned = snap.size;
    for (const doc of snap.docs) {
        const row = (0, utils_1.asRecord)(doc.data());
        const extractedData = (0, utils_1.asRecord)(row.extractedData);
        if (!(0, clinicalNormalization_1.isLegacyMailsyncEvent)(doc.id, row, extractedData)) {
            result.skipped += 1;
            continue;
        }
        result.eligible_legacy_events += 1;
        const sample = (0, clinicalNormalization_1.classifyLegacyMailsyncEvent)(doc.id, row);
        if (sample.action === "delete")
            result.delete_candidates += 1;
        if (sample.action === "salvage")
            result.salvage_candidates += 1;
        if (result.samples.length < 40)
            result.samples.push(sample);
        if (sample.action !== "delete")
            continue;
        if (dryRun) {
            result.deleted += 1;
            continue;
        }
        try {
            result.artifacts_deleted += await deleteLegacyEventArtifacts(doc.id);
            await doc.ref.delete();
            result.deleted += 1;
        }
        catch (error) {
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
async function runGmailTaxonomyBackfill(args) {
    const dryRun = args.dryRun !== false;
    const limit = (0, utils_1.clamp)((0, utils_1.asNonNegativeNumber)(args.limit, 150), 1, 500);
    const includeAppointments = args.includeAppointments !== false;
    const result = {
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
        const row = (0, utils_1.asRecord)(doc.data());
        const extractedData = (0, utils_1.asRecord)(row.extractedData);
        const source = (0, utils_1.asString)(row.source);
        const sourceEmailId = (0, utils_1.asString)(row.source_email_id);
        if (source !== "email_import" && !sourceEmailId) {
            result.skipped_non_email += 1;
            continue;
        }
        result.eligible_email_events += 1;
        const reconstructedEvent = (0, clinicalNormalization_1.reconstructStoredEventForTaxonomy)(row);
        if (!reconstructedEvent) {
            result.skipped_unclassified += 1;
            continue;
        }
        const sourceDate = (0, utils_1.asString)(extractedData.sourceReceivedAt) || (0, utils_1.asString)(row.createdAt) || (0, utils_1.getNowIso)();
        const nextExtractedData = Object.assign(Object.assign({}, extractedData), (0, reviewActions_1.buildDefaultExtractedData)({
            event: reconstructedEvent,
            sourceDate,
            sourceSubject: (0, utils_1.asString)(extractedData.sourceSubject),
            sourceSender: (0, utils_1.asString)(extractedData.sourceSender),
        }));
        const rescuedAppointment = !(0, clinicalNormalization_1.isAppointmentEventType)(reconstructedEvent.event_type)
            ? (0, clinicalNormalization_1.extractOperationalAppointmentCandidate)({
                eventDate: (0, utils_1.asString)(nextExtractedData.eventDate) || reconstructedEvent.event_date,
                sourceText: [
                    (0, utils_1.asString)(nextExtractedData.sourceSubject),
                    (0, utils_1.asString)(nextExtractedData.suggestedTitle),
                    (0, utils_1.asString)(nextExtractedData.aiGeneratedSummary),
                    (0, utils_1.asString)(nextExtractedData.observations),
                    (0, utils_1.asString)(row.title),
                ]
                    .filter(Boolean)
                    .join(" · "),
                sourceSender: (0, utils_1.asString)(nextExtractedData.sourceSender),
                existingStatus: nextExtractedData.appointmentStatus,
                existingTime: nextExtractedData.appointmentTime,
                existingSpecialty: (0, utils_1.asString)((0, utils_1.asRecord)(Array.isArray(nextExtractedData.detectedAppointments) ? nextExtractedData.detectedAppointments[0] : null).specialty),
                professionalName: (0, utils_1.asString)(nextExtractedData.provider),
                clinicName: (0, utils_1.asString)(nextExtractedData.clinic),
                diagnosis: (0, utils_1.asString)(nextExtractedData.diagnosis),
                confidenceScore: reconstructedEvent.confidence_score,
            })
            : null;
        if ((0, clinicalNormalization_1.shouldPreserveExistingObservations)({ row, extractedData })) {
            nextExtractedData.observations = extractedData.observations;
            nextExtractedData.observationsConfidence = extractedData.observationsConfidence || "medium";
        }
        const nextDomainType = (0, clinicalNormalization_1.isAppointmentEventType)(reconstructedEvent.event_type)
            ? "appointment"
            : (0, clinicalNormalization_1.isPrescriptionEventType)(reconstructedEvent.event_type)
                ? "treatment"
                : (0, clinicalNormalization_1.isVaccinationEventType)(reconstructedEvent.event_type)
                    ? "vaccination"
                    : "medical_event";
        const nextTitle = (0, clinicalNormalization_1.buildCanonicalEventTitle)(reconstructedEvent).slice(0, 160);
        const nextFindings = reconstructedEvent.lab_results.length > 0
            ? reconstructedEvent.lab_results.map((item) => `${item.test_name}: ${item.result}`).join(" | ").slice(0, 1400)
            : null;
        const changes = [];
        if ((0, utils_1.asString)(extractedData.taxonomyEventType) !== (0, utils_1.asString)(nextExtractedData.taxonomyEventType))
            changes.push("taxonomyEventType");
        if ((0, utils_1.asString)(extractedData.documentType) !== (0, utils_1.asString)(nextExtractedData.documentType))
            changes.push("documentType");
        if ((0, utils_1.asString)(extractedData.taxonomyRoute) !== (0, utils_1.asString)(nextExtractedData.taxonomyRoute))
            changes.push("taxonomyRoute");
        if ((0, utils_1.asString)(extractedData.appointmentStatus) !== (0, utils_1.asString)(nextExtractedData.appointmentStatus))
            changes.push("appointmentStatus");
        if ((0, utils_1.asString)(extractedData.studySubtype) !== (0, utils_1.asString)(nextExtractedData.studySubtype))
            changes.push("studySubtype");
        if ((0, utils_1.asString)(extractedData.appointmentTime) !== (0, utils_1.asString)(nextExtractedData.appointmentTime))
            changes.push("appointmentTime");
        if ((0, utils_1.asString)(extractedData.provider) !== (0, utils_1.asString)(nextExtractedData.provider))
            changes.push("provider");
        if ((0, utils_1.asString)(extractedData.clinic) !== (0, utils_1.asString)(nextExtractedData.clinic))
            changes.push("clinic");
        if ((0, utils_1.asString)(row.domain_ingestion_type) !== nextDomainType)
            changes.push("domain_ingestion_type");
        if ((0, clinicalNormalization_1.shouldReplaceLegacyStoredTitle)((0, utils_1.asString)(row.title)) && (0, utils_1.asString)(row.title) !== nextTitle)
            changes.push("title");
        if ((0, utils_1.asString)(row.findings) !== (0, utils_1.asString)(nextFindings))
            changes.push("findings");
        if (changes.length === 0) {
            result.unchanged += 1;
            continue;
        }
        const sample = {
            docId: doc.id,
            title_before: (0, utils_1.asString)(row.title) || null,
            title_after: (0, clinicalNormalization_1.shouldReplaceLegacyStoredTitle)((0, utils_1.asString)(row.title)) ? nextTitle : (0, utils_1.asString)(row.title) || null,
            taxonomy_before: (0, utils_1.asString)(extractedData.taxonomyEventType) || null,
            taxonomy_after: (0, utils_1.asString)(nextExtractedData.taxonomyEventType) || null,
            documentType_before: (0, utils_1.asString)(extractedData.documentType) || null,
            documentType_after: (0, utils_1.asString)(nextExtractedData.documentType) || null,
            changes,
        };
        if (result.samples.length < 20)
            result.samples.push(sample);
        if (dryRun) {
            result.updated += 1;
            continue;
        }
        try {
            const patch = {
                extractedData: nextExtractedData,
                domain_ingestion_type: nextDomainType,
                updatedAt: (0, utils_1.getNowIso)(),
                findings: nextFindings,
            };
            if ((0, clinicalNormalization_1.shouldReplaceLegacyStoredTitle)((0, utils_1.asString)(row.title)))
                patch.title = nextTitle;
            await doc.ref.set(patch, { merge: true });
            const projectionEvent = (0, clinicalNormalization_1.isAppointmentEventType)(reconstructedEvent.event_type)
                ? reconstructedEvent
                : rescuedAppointment;
            if (includeAppointments && projectionEvent && (0, utils_1.asString)(row.petId)) {
                await (0, domainIngestion_1.upsertOperationalAppointmentProjection)({
                    appointmentEventId: doc.id,
                    petId: (0, utils_1.asString)(row.petId),
                    uid: args.uid,
                    title: (0, clinicalNormalization_1.buildCanonicalEventTitle)(projectionEvent),
                    eventDate: projectionEvent.event_date || (0, utils_1.toIsoDateOnly)(new Date(sourceDate)),
                    event: projectionEvent,
                    narrativeSummary: (0, utils_1.cleanSentence)([
                        (0, utils_1.asString)(nextExtractedData.aiGeneratedSummary),
                        (0, utils_1.asString)(nextExtractedData.sourceSubject),
                        (0, utils_1.asString)(row.title),
                    ]
                        .filter(Boolean)
                        .join(" · ")),
                    sourceEmailId: sourceEmailId || `legacy_${doc.id}`,
                    sourceTruthLevel: (0, utils_1.asString)(row.sourceTruthLevel) || "ai_auto_ingested",
                    effectiveRequiresConfirmation: row.requiresManualConfirmation === true || (0, utils_1.asString)(row.workflowStatus) === "review_required",
                    nowIso: (0, utils_1.asString)(patch.updatedAt),
                });
                result.appointment_projections_updated += 1;
            }
            result.updated += 1;
        }
        catch (error) {
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
function buildNarrativeThreadLabel(event) {
    var _a;
    if ((0, clinicalNormalization_1.isVaccinationEventType)(event.event_type))
        return "Vacunación";
    if ((0, clinicalNormalization_1.isPrescriptionEventType)(event.event_type)) {
        const med = (0, utils_1.sanitizeNarrativeLabel)((0, utils_1.asString)((_a = event.medications[0]) === null || _a === void 0 ? void 0 : _a.name), "");
        return med || "Tratamiento";
    }
    if ((0, clinicalNormalization_1.isAppointmentEventType)(event.event_type)) {
        const specialty = (0, utils_1.sanitizeNarrativeLabel)(event.appointment_specialty || "", "");
        return specialty || "Agenda veterinaria";
    }
    if ((0, clinicalNormalization_1.isStudyEventType)(event.event_type)) {
        if (event.study_subtype === "imaging") {
            return (0, utils_1.sanitizeNarrativeLabel)(event.imaging_type || "", "Estudios por imágenes");
        }
        return "Laboratorio";
    }
    return (0, utils_1.sanitizeNarrativeLabel)(event.diagnosis || "", "Seguimiento clínico");
}
function buildNarrativePeriodMeta(timestamp, nowTimestamp) {
    const parsed = new Date(timestamp);
    const monthsAgo = (0, utils_1.monthsBetween)(nowTimestamp, timestamp);
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
function summarizeNarrativeDiagnosis(value) {
    const cleaned = (0, utils_1.sanitizeNarrativeLabel)((0, utils_1.asString)(value), "");
    if (!cleaned)
        return null;
    const [firstSentence] = cleaned.split(/(?<=[.!?])\s+/);
    return (firstSentence || cleaned).slice(0, 180);
}
function buildNarrativeEpisodeRecord(args) {
    const diagnoses = (0, utils_1.uniqueNonEmpty)(args.events.map((item) => summarizeNarrativeDiagnosis(item.event.diagnosis)).filter(Boolean)).slice(0, 3);
    const medications = (0, utils_1.uniqueNonEmpty)(args.events.flatMap((item) => item.event.medications.map((medication) => (0, utils_1.sanitizeNarrativeLabel)(medication.name, "")))).slice(0, 3);
    const providers = (0, utils_1.uniqueNonEmpty)(args.events.flatMap((item) => [(0, utils_1.sanitizeNarrativeLabel)(item.event.professional_name || "", ""), (0, utils_1.sanitizeNarrativeLabel)(item.event.clinic_name || "", "")])).filter(Boolean).slice(0, 2);
    const imagingCount = args.events.filter((item) => (0, clinicalNormalization_1.isStudyEventType)(item.event.event_type) && item.event.study_subtype === "imaging").length;
    const appointmentCount = args.events.filter((item) => (0, clinicalNormalization_1.isAppointmentEventType)(item.event.event_type)).length;
    const treatmentCount = args.events.filter((item) => (0, clinicalNormalization_1.isPrescriptionEventType)(item.event.event_type)).length;
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
        episodio_id: `hep_${(0, utils_1.sha256)(`${args.uid}_${args.petId}_${args.periodMeta.periodKey}_${args.threadLabel}`).slice(0, 24)}`,
        userId: args.uid,
        petId: args.petId,
        petName: args.petName,
        periodType: args.periodMeta.periodType,
        periodKey: args.periodMeta.periodKey,
        periodLabel: args.periodMeta.periodLabel,
        yearKey: args.periodMeta.yearKey,
        titulo_narrativo: (0, utils_1.sanitizeNarrativeLabel)(args.threadLabel, "Resumen clínico"),
        headline: (0, utils_1.sanitizeNarrativeLabel)(args.threadLabel, "Resumen clínico"),
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
        generated_at: (0, utils_1.getNowIso)(),
        event_count: args.events.length,
    };
}
function buildAnnualSummaryRecord(args) {
    const diagnoses = (0, utils_1.uniqueNonEmpty)(args.events.map((item) => summarizeNarrativeDiagnosis(item.event.diagnosis)).filter(Boolean)).slice(0, 3);
    const medications = (0, utils_1.uniqueNonEmpty)(args.events.flatMap((item) => item.event.medications.map((medication) => (0, utils_1.sanitizeNarrativeLabel)(medication.name, "")))).slice(0, 3);
    const providers = (0, utils_1.uniqueNonEmpty)(args.events.flatMap((item) => [(0, utils_1.sanitizeNarrativeLabel)(item.event.professional_name || "", ""), (0, utils_1.sanitizeNarrativeLabel)(item.event.clinic_name || "", "")])).filter(Boolean).slice(0, 2);
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
async function deleteExistingNarrativeHistory(args) {
    const collections = [
        { name: "history_buckets", key: "buckets" },
        { name: "history_episodes", key: "episodes" },
    ];
    const deleted = { buckets: 0, episodes: 0 };
    for (const collection of collections) {
        const snap = await admin.firestore().collection(collection.name).where("userId", "==", args.uid).limit(500).get();
        if (snap.empty)
            continue;
        const batch = admin.firestore().batch();
        let count = 0;
        for (const doc of snap.docs) {
            const row = (0, utils_1.asRecord)(doc.data());
            if ((0, utils_1.asString)(row.source_mode || row.sourceMode) !== "derived_history_v1")
                continue;
            if (args.petId && (0, utils_1.asString)(row.petId) !== args.petId)
                continue;
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
async function runNarrativeHistoryBackfill(args) {
    const dryRun = args.dryRun !== false;
    const limit = (0, utils_1.clamp)((0, utils_1.asNonNegativeNumber)(args.limit, 250), 25, 1000);
    const nowTimestamp = Date.now();
    const recentCutoff = nowTimestamp - RECENT_HISTORY_WINDOW_DAYS * ONE_DAY_MS;
    const result = {
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
    const petNameCache = new Map();
    const fetchPetName = async (petId) => {
        if (petNameCache.has(petId))
            return petNameCache.get(petId);
        const petSnap = await admin.firestore().collection("pets").doc(petId).get();
        const petName = (0, utils_1.sanitizeNarrativeLabel)((0, utils_1.asString)((0, utils_1.asRecord)(petSnap.data()).name), "Mascota");
        petNameCache.set(petId, petName);
        return petName;
    };
    const snap = await admin.firestore().collection("medical_events").where("userId", "==", args.uid).limit(limit).get();
    result.total_scanned = snap.size;
    const eligibleEvents = [];
    for (const doc of snap.docs) {
        const row = (0, utils_1.asRecord)(doc.data());
        const petId = (0, utils_1.asString)(row.petId);
        if (!petId)
            continue;
        if (args.petId && petId !== args.petId)
            continue;
        if ((0, utils_1.asString)(row.status) === "processing" || (0, utils_1.asString)(row.status) === "draft")
            continue;
        if ((0, utils_1.asString)(row.workflowStatus) === "review_required" || (0, utils_1.asString)(row.workflowStatus) === "invalid_future_date")
            continue;
        if (row.requiresManualConfirmation === true)
            continue;
        const reconstructed = (0, clinicalNormalization_1.reconstructStoredEventForTaxonomy)(row);
        if (!reconstructed)
            continue;
        const timestamp = Date.parse(reconstructed.event_date || (0, utils_1.asString)(row.createdAt) || "");
        if (!Number.isFinite(timestamp) || timestamp >= recentCutoff)
            continue;
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
    const bucketDocs = new Map();
    const episodeDocs = new Map();
    const annualGroups = new Map();
    const bucketEventCounts = new Map();
    for (const item of eligibleEvents) {
        const periodMeta = buildNarrativePeriodMeta(item.timestamp, nowTimestamp);
        const threadLabel = buildNarrativeThreadLabel(item.event);
        const bucketId = `hb_${(0, utils_1.sha256)(`${args.uid}_${item.petId}_${periodMeta.periodType}_${periodMeta.periodKey}`).slice(0, 24)}`;
        const bucketKey = `${bucketId}::${threadLabel}`;
        const yearGroupKey = `${item.petId}::${periodMeta.yearKey}`;
        if (!annualGroups.has(yearGroupKey))
            annualGroups.set(yearGroupKey, []);
        annualGroups.get(yearGroupKey).push(item);
        bucketEventCounts.set(bucketId, (bucketEventCounts.get(bucketId) || 0) + 1);
        const episodeKey = `${bucketKey}`;
        const existing = episodeDocs.get(episodeKey);
        const nextEvents = (existing === null || existing === void 0 ? void 0 : existing.__events) ? [...existing.__events, item] : [item];
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
        });
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
            generatedAt: (0, utils_1.getNowIso)(),
            updatedAt: (0, utils_1.getNowIso)(),
        });
    }
    for (const [bucketId, bucket] of bucketDocs.entries()) {
        const episodesForBucket = Array.from(episodeDocs.values()).filter((episode) => (0, utils_1.asString)(episode.bucketId) === bucketId);
        const eventCount = bucketEventCounts.get(bucketId) || 0;
        bucket.eventCount = eventCount;
        bucket.episodeCount = episodesForBucket.length;
        if (bucket.periodType === "month" && eventCount > 10) {
            bucket.densityMode = "compacted";
            bucket.bucket_summary = {
                headline: `Mes de alta intensidad clínica`,
                narrative: `Durante ${(0, utils_1.asString)(bucket.periodLabel)}, ${(0, utils_1.asString)(bucket.petName)} tuvo ${eventCount} eventos confirmados. PESSY los comprimió en episodios narrativos para lectura rápida.`,
            };
        }
    }
    for (const [annualKey, events] of annualGroups.entries()) {
        const [petId, yearKey] = annualKey.split("::");
        const first = events[0];
        const annualBucketId = `hb_${(0, utils_1.sha256)(`${args.uid}_${petId}_year_${yearKey}`).slice(0, 24)}`;
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
            generatedAt: (0, utils_1.getNowIso)(),
            updatedAt: (0, utils_1.getNowIso)(),
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
            const clone = Object.assign({}, episode);
            delete clone.__events;
            return clone;
        });
        for (const bucket of allBucketDocs) {
            await admin.firestore().collection("history_buckets").doc((0, utils_1.asString)(bucket.bucketId)).set(bucket, { merge: true });
            result.buckets_written += 1;
            if (result.sample_bucket_ids.length < 10)
                result.sample_bucket_ids.push((0, utils_1.asString)(bucket.bucketId));
            if (bucket.annual_summary)
                result.yearly_summaries_written += 1;
        }
        for (const episode of allEpisodeDocs) {
            await admin.firestore().collection("history_episodes").doc((0, utils_1.asString)(episode.episodio_id)).set(episode, { merge: true });
            result.episodes_written += 1;
            if (result.sample_episode_ids.length < 10)
                result.sample_episode_ids.push((0, utils_1.asString)(episode.episodio_id));
        }
    }
    else {
        result.buckets_written = bucketDocs.size;
        result.episodes_written = episodeDocs.size;
        result.yearly_summaries_written = Array.from(bucketDocs.values()).filter((bucket) => Boolean(bucket.annual_summary)).length;
        result.sample_bucket_ids = Array.from(bucketDocs.keys()).slice(0, 10);
        result.sample_episode_ids = Array.from(episodeDocs.values()).map((episode) => (0, utils_1.asString)(episode.episodio_id)).slice(0, 10);
    }
    return result;
}
async function uploadAttachmentBase64ToStorage(args) {
    if (!(0, envConfig_1.isAttachmentStorageEnabled)()) {
        return {
            ok: false,
            uri: null,
            path: null,
            bucket: null,
            signedUrl: null,
            error: "storage_disabled",
        };
    }
    try {
        const bucket = admin.storage().bucket();
        const objectPath = (0, utils_1.buildAttachmentStoragePath)({
            uid: args.uid,
            sessionId: args.sessionId,
            messageId: args.messageId,
            attachmentId: args.attachmentId,
            filename: args.filename,
        });
        const file = bucket.file(objectPath);
        const normalizedBase64 = (0, utils_1.base64UrlToBase64)(args.base64UrlData);
        await (0, promises_1.pipeline)(stream_1.Readable.from((0, utils_1.iterateBase64Chunks)(normalizedBase64), { encoding: "ascii" }), (0, utils_1.createBase64DecodeTransform)(), file.createWriteStream({
            resumable: false,
            metadata: {
                contentType: args.mimeType || "application/octet-stream",
                metadata: {
                    source: "gmail_ingestion",
                    message_id: args.messageId,
                    attachment_id: args.attachmentId,
                    uploaded_at: (0, utils_1.getNowIso)(),
                },
            },
        }));
        let signedUrl = null;
        try {
            const [url] = await file.getSignedUrl({
                version: "v4",
                action: "read",
                expires: Date.now() + (6 * 60 * 60 * 1000),
            });
            signedUrl = (0, utils_1.asString)(url) || null;
        }
        catch (_a) {
            signedUrl = null;
        }
        return {
            ok: true,
            uri: `gs://${bucket.name}/${objectPath}`,
            path: objectPath,
            bucket: bucket.name,
            signedUrl,
            error: null,
        };
    }
    catch (error) {
        return {
            ok: false,
            uri: null,
            path: null,
            bucket: null,
            signedUrl: null,
            error: String((error === null || error === void 0 ? void 0 : error.message) || error).slice(0, 300),
        };
    }
}
async function callGoogleJson(url, accessToken) {
    const response = await fetch(url, {
        method: "GET",
        headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: "application/json",
        },
    });
    if (!response.ok) {
        const text = await response.text();
        throw new Error(`google_api_failed_${response.status}: ${text.slice(0, 300)}`);
    }
    return (await response.json());
}
function isMetadataOnlyScopeError(error) {
    const message = String(error || "");
    if (!message.includes("google_api_failed_403"))
        return false;
    return /metadata scope|format\s*full|scope does not support format full/i.test(message);
}
async function assertGmailFullPayloadAccess(accessToken) {
    const listUrl = new URL(`${GMAIL_API_BASE_URL}/messages`);
    listUrl.searchParams.set("maxResults", "1");
    const listResponse = await callGoogleJson(listUrl.toString(), accessToken);
    const messageId = (Array.isArray(listResponse.messages) ? listResponse.messages : [])
        .map((row) => (0, utils_1.asString)(row.id))
        .find(Boolean);
    if (!messageId)
        return;
    const detailUrl = new URL(`${GMAIL_API_BASE_URL}/messages/${encodeURIComponent(messageId)}`);
    detailUrl.searchParams.set("format", "full");
    const detail = await callGoogleJson(detailUrl.toString(), accessToken);
    if (!detail.payload) {
        throw new Error("gmail_full_payload_unavailable");
    }
}
async function markGmailReconsentRequired(args) {
    const nowIso = (0, utils_1.getNowIso)();
    await args.sessionRef.set({
        status: "failed",
        updated_at: nowIso,
        error: "gmail_reconsent_required",
    }, { merge: true });
    await admin.firestore().collection("user_email_config").doc(args.uid).set({
        ingestion_status: "requires_review",
        sync_status: "requires_review",
        oauth_status: "reconsent_required",
        last_error: "gmail_reconsent_required",
        updated_at: nowIso,
    }, { merge: true });
    await admin.firestore().collection("users").doc(args.uid).set({
        gmailSync: {
            connected: false,
            inviteEnabled: true,
            inviteStatus: "reconsent_required",
            updatedAt: nowIso,
            reconsentRequiredAt: nowIso,
            lastError: "gmail_reconsent_required",
        },
    }, { merge: true });
    await (0, sessionQueue_1.updateIngestionProgress)(args.uid, "requires_review");
}
async function exchangeRefreshToken(params) {
    const body = new URLSearchParams({
        client_id: params.clientId,
        client_secret: params.clientSecret,
        refresh_token: params.refreshToken,
        grant_type: "refresh_token",
    });
    const response = await fetch(GOOGLE_TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
    });
    if (!response.ok) {
        const text = await response.text();
        throw new Error(`refresh_token_exchange_failed_${response.status}: ${text.slice(0, 300)}`);
    }
    const payload = (await response.json());
    const accessToken = (0, utils_1.asString)(payload.access_token);
    if (!accessToken)
        throw new Error("missing_access_token_from_refresh");
    return accessToken;
}
async function extractDocxTextFromBase64(base64DataOrUrl) {
    const buffer = (0, utils_1.decodeBase64UrlToBuffer)(base64DataOrUrl);
    const result = await mammoth.extractRawText({ buffer });
    return (0, utils_1.asString)(result.value).slice(0, 40000);
}
async function fetchAttachmentTextChunks(args) {
    var _a, _b;
    const allParts = (0, emailParsing_1.listAllMessageParts)(args.payload);
    const attachments = allParts
        .filter((part) => { var _a; return Boolean((0, utils_1.asString)(part.filename) || (0, utils_1.asString)((_a = part.body) === null || _a === void 0 ? void 0 : _a.attachmentId)); })
        .slice(0, MAX_ATTACHMENTS_PER_EMAIL);
    const metadata = [];
    const extractedChunks = [];
    let processedCount = 0;
    for (const part of attachments) {
        const filename = (0, utils_1.asString)(part.filename) || "attachment";
        const originalMimeType = (0, utils_1.asString)(part.mimeType).toLowerCase() || "application/octet-stream";
        const mimeType = (0, emailParsing_1.normalizeMimeType)(originalMimeType, filename);
        const attachmentId = (0, utils_1.asString)((_a = part.body) === null || _a === void 0 ? void 0 : _a.attachmentId);
        const sizeBytes = (0, utils_1.asNonNegativeNumber)((_b = part.body) === null || _b === void 0 ? void 0 : _b.size, 0);
        const supported = (0, emailParsing_1.isSupportedAttachmentType)(filename, mimeType);
        const oversized = sizeBytes > MAX_ATTACHMENT_SIZE_BYTES;
        if (!supported || oversized || !attachmentId || processedCount >= args.maxAttachmentsToProcess) {
            let reason = "unsupported_mime";
            if (oversized)
                reason = "oversized_attachment";
            else if (!attachmentId)
                reason = "missing_attachment_id";
            else if (processedCount >= args.maxAttachmentsToProcess)
                reason = "plan_attachment_limit_reached";
            metadata.push({
                filename,
                mimetype: mimeType,
                size_bytes: sizeBytes,
                ocr_success: false,
                ocr_reason: reason,
                original_mimetype: originalMimeType,
                normalized_mimetype: mimeType,
            });
            continue;
        }
        let ocrSuccess = false;
        let extractedText = "";
        let reason;
        let detail = null;
        let storageUri = null;
        let storagePath = null;
        let storageBucket = null;
        let storageSignedUrl = null;
        let storageError = null;
        try {
            const attachmentUrl = `${GMAIL_API_BASE_URL}/messages/${encodeURIComponent(args.messageId)}/attachments/${encodeURIComponent(attachmentId)}`;
            const attachmentResponse = await callGoogleJson(attachmentUrl, args.accessToken);
            const data = (0, utils_1.asString)(attachmentResponse.data);
            if (!data) {
                reason = "empty_attachment_payload";
            }
            else {
                const storageResult = await uploadAttachmentBase64ToStorage({
                    base64UrlData: data,
                    mimeType,
                    uid: args.uid,
                    sessionId: args.sessionId,
                    messageId: args.messageId,
                    attachmentId,
                    filename,
                });
                storageUri = storageResult.uri;
                storagePath = storageResult.path;
                storageBucket = storageResult.bucket;
                storageSignedUrl = storageResult.signedUrl;
                storageError = storageResult.error;
                const isPlainText = mimeType.startsWith("text/") ||
                    filename.toLowerCase().endsWith(".txt") ||
                    filename.toLowerCase().endsWith(".csv");
                if (isPlainText) {
                    extractedText = (0, utils_1.decodeBase64UrlToText)(data).slice(0, 40000);
                    ocrSuccess = Boolean(extractedText.trim());
                    reason = ocrSuccess ? "plain_text_decode" : "plain_text_empty";
                }
                else if (mimeType === "application/dicom" || filename.toLowerCase().endsWith(".dcm")) {
                    extractedText = "";
                    ocrSuccess = false;
                    reason = "dicom_skipped";
                }
                else if (mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
                    filename.toLowerCase().endsWith(".docx")) {
                    try {
                        extractedText = await extractDocxTextFromBase64(data);
                        ocrSuccess = Boolean(extractedText.trim());
                        reason = ocrSuccess ? "docx_native_parse" : "docx_empty";
                    }
                    catch (error) {
                        extractedText = "";
                        ocrSuccess = false;
                        reason = "docx_parse_failed";
                        detail = String((error === null || error === void 0 ? void 0 : error.message) || error).slice(0, 300);
                    }
                }
                else if (mimeType === "application/pdf" || (0, emailParsing_1.isImageMime)(mimeType)) {
                    try {
                        const normalizedBase64 = (0, utils_1.base64UrlToBase64)(data);
                        extractedText = await (0, clinicalAi_1.ocrAttachmentViaGemini)({
                            mimeType,
                            base64Data: normalizedBase64,
                            userId: args.uid,
                        });
                        ocrSuccess = Boolean(extractedText.trim());
                        reason = ocrSuccess ? "gemini_ocr" : "gemini_ocr_empty";
                    }
                    catch (error) {
                        extractedText = "";
                        ocrSuccess = false;
                        reason = "gemini_ocr_failed";
                        detail = String((error === null || error === void 0 ? void 0 : error.message) || error).slice(0, 300);
                    }
                }
                else {
                    extractedText = "";
                    ocrSuccess = false;
                    reason = "unsupported_mime";
                }
            }
        }
        catch (error) {
            console.warn(`[gmail-ingestion] attachment OCR failed (${filename}):`, error);
            ocrSuccess = false;
            reason = "attachment_download_failed";
            detail = String((error === null || error === void 0 ? void 0 : error.message) || error).slice(0, 300);
        }
        metadata.push({
            filename,
            mimetype: mimeType,
            size_bytes: sizeBytes,
            ocr_success: ocrSuccess,
            ocr_reason: reason,
            ocr_detail: detail,
            original_mimetype: originalMimeType,
            normalized_mimetype: mimeType,
            storage_uri: storageUri,
            storage_path: storagePath,
            storage_bucket: storageBucket,
            storage_signed_url: storageSignedUrl,
            storage_success: Boolean(storageUri),
            storage_error: storageError,
        });
        if (extractedText.trim())
            extractedChunks.push(extractedText.trim());
        processedCount += 1;
    }
    return {
        attachmentMetadata: metadata,
        extractedChunks,
        processedCount,
    };
}
// ─── Pet Matching, Sender Classification, Clinical Signal Detection ───
// TRASPLANTADO → ./ingestion/petMatching.ts
// extractSenderDomain → petMatching.ts
// isMassMarketingDomain → petMatching.ts
// isTrustedClinicalDomain → petMatching.ts
// isTrustedClinicalSenderName → petMatching.ts
// isTrustedClinicalSender → petMatching.ts
// isBlockedClinicalDomain → petMatching.ts
// normalizeTextForMatch → petMatching.ts (also in utils.ts)
// tokenizeIdentity → petMatching.ts (also in utils.ts)
// hasAnyIdentityToken → petMatching.ts (also in utils.ts)
// hasExactPhrase → petMatching.ts (also in utils.ts)
// listStringValues → petMatching.ts (also in utils.ts)
// uniqueNonEmpty → petMatching.ts (also in utils.ts)
// speciesAliases → petMatching.ts
// canonicalSpeciesKey → petMatching.ts
// inferSpeciesSignalsFromCorpus → petMatching.ts
// petMatchesByName → petMatching.ts
// petMatchesByBreed → petMatching.ts
// petMatchesBySpeciesSignal → petMatching.ts
// detectPetIdentityConflict → petMatching.ts
// resolvePetConditionHints → petMatching.ts
// PetResolutionHints → types.ts
// PetCandidateProfile → types.ts
// PetCandidateScore → types.ts
// scorePetCandidate → petMatching.ts
// choosePetByHints → petMatching.ts
// attachmentNamesContainClinicalSignal → petMatching.ts
// hasStrongHumanHealthcareSignal → petMatching.ts
// hasStrongVeterinaryEvidence → petMatching.ts
// hasStrongNonClinicalSignal → petMatching.ts
// isCandidateClinicalEmail → petMatching.ts
function normalizeWebhookAttachmentMetadata(rawValue) {
    if (!Array.isArray(rawValue))
        return [];
    return rawValue
        .map((entry) => {
        if (typeof entry === "string") {
            const filename = (0, utils_1.asString)(entry) || "attachment";
            return {
                filename,
                mimetype: (0, emailParsing_1.normalizeMimeType)("", filename),
                size_bytes: 0,
                ocr_success: false,
                ocr_reason: "",
                original_mimetype: null,
                normalized_mimetype: (0, emailParsing_1.normalizeMimeType)("", filename),
            };
        }
        const row = (0, utils_1.asRecord)(entry);
        const filename = (0, utils_1.asString)(row.filename) || (0, utils_1.asString)(row.name) || "attachment";
        const mimeType = (0, emailParsing_1.normalizeMimeType)((0, utils_1.asString)(row.mimeType) || (0, utils_1.asString)(row.mimetype), filename);
        return {
            filename,
            mimetype: mimeType,
            size_bytes: (0, utils_1.asNonNegativeNumber)(row.sizeBytes, (0, utils_1.asNonNegativeNumber)(row.size_bytes, 0)),
            ocr_success: false,
            ocr_reason: "",
            original_mimetype: (0, utils_1.asString)(row.mimeType) || (0, utils_1.asString)(row.mimetype) || null,
            normalized_mimetype: mimeType,
        };
    })
        .slice(0, MAX_ATTACHMENTS_PER_EMAIL);
}
async function fetchUserRefreshToken(uid) {
    const snap = await admin
        .firestore()
        .collection("users")
        .doc(uid)
        .collection("mail_sync_tokens")
        .doc("gmail")
        .get();
    if (!snap.exists) {
        throw new Error("gmail_token_not_found");
    }
    const data = (0, utils_1.asRecord)(snap.data());
    const ciphertext = (0, utils_1.asString)(data.ciphertext);
    const iv = (0, utils_1.asString)(data.iv);
    const tag = (0, utils_1.asString)(data.tag);
    if (!ciphertext || !iv || !tag) {
        throw new Error("gmail_token_invalid");
    }
    const decrypted = (0, utils_1.decryptPayload)({ ciphertext, iv, tag });
    const refreshToken = (0, utils_1.asString)(decrypted.refreshToken);
    if (!refreshToken) {
        throw new Error("gmail_refresh_token_missing");
    }
    const grantedScopes = Array.isArray(decrypted.grantedScopes)
        ? decrypted.grantedScopes.filter((row) => typeof row === "string")
        : [];
    return { refreshToken, grantedScopes };
}
async function resolvePlanAndPet(args) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
    const overrideSnap = await admin.firestore().collection("email_sync_plan_overrides").doc(args.uid).get();
    const overrideData = (0, utils_1.asRecord)(overrideSnap.data());
    const overridePlanRaw = (0, utils_1.asString)(overrideData.plan_type).toLowerCase();
    const userSnap = await admin.firestore().collection("users").doc(args.uid).get();
    const userData = (0, utils_1.asRecord)(userSnap.data());
    const userEmail = (0, utils_1.asString)(userData.email).toLowerCase();
    const candidatePlans = [
        (0, utils_1.asString)(userData.plan),
        (0, utils_1.asString)(userData.planType),
        (0, utils_1.asString)(userData.subscriptionPlan),
        (0, utils_1.asString)((0, utils_1.asRecord)(userData.subscription).plan),
    ]
        .join(" ")
        .toLowerCase();
    const isPremiumByProfile = ["premium", "pro", "founder", "unlimited"].some((token) => candidatePlans.includes(token));
    const planType = overridePlanRaw === "premium" || (overridePlanRaw !== "free" && isPremiumByProfile)
        ? "premium"
        : "free";
    const canUseSmartPetHints = (0, envConfig_1.isSmartPetMatchingEnabled)() && (0, envConfig_1.isEmailAllowedForQa)(userEmail || "");
    const ownerPets = await admin
        .firestore()
        .collection("pets")
        .where("ownerId", "==", args.uid)
        .limit(12)
        .get();
    const ownerPetRows = ownerPets.docs.map((doc) => ({ id: doc.id, data: (0, utils_1.asRecord)(doc.data()) }));
    const activePetCount = ownerPetRows.length;
    const fallbackPet = activePetCount === 1 ? ownerPetRows[0] : null;
    const petCandidates = canUseSmartPetHints
        ? await Promise.all(ownerPetRows.map(async (row) => ({
            id: row.id,
            data: row.data,
            name: (0, utils_1.asString)(row.data.name),
            species: (0, utils_1.asString)(row.data.species),
            breed: (0, utils_1.asString)(row.data.breed),
            knownConditions: await (0, petMatching_1.resolvePetConditionHints)(row.id, row.data),
        })))
        : [];
    let petId = (0, utils_1.asString)(args.preferredPetId) || null;
    let petData = null;
    let petResolutionDebug = {
        mode: petId ? "preferred_pet_id" : "unresolved",
        smart_matching_enabled: canUseSmartPetHints,
        active_pet_count: activePetCount,
        fallback_pet_id: (fallbackPet === null || fallbackPet === void 0 ? void 0 : fallbackPet.id) || null,
        fallback_pet_name: (0, utils_1.asString)((_a = fallbackPet === null || fallbackPet === void 0 ? void 0 : fallbackPet.data) === null || _a === void 0 ? void 0 : _a.name) || null,
    };
    if (petId) {
        const petSnap = await admin.firestore().collection("pets").doc(petId).get();
        if (petSnap.exists) {
            petData = (0, utils_1.asRecord)(petSnap.data());
            petResolutionDebug = {
                mode: "preferred_pet_id",
                smart_matching_enabled: canUseSmartPetHints,
                chosen_pet_id: petId,
                chosen_pet_name: (0, utils_1.asString)(petData.name) || null,
                active_pet_count: activePetCount,
                fallback_pet_id: (fallbackPet === null || fallbackPet === void 0 ? void 0 : fallbackPet.id) || null,
                fallback_pet_name: (0, utils_1.asString)((_b = fallbackPet === null || fallbackPet === void 0 ? void 0 : fallbackPet.data) === null || _b === void 0 ? void 0 : _b.name) || null,
            };
        }
        else {
            petResolutionDebug = {
                mode: "preferred_pet_missing",
                smart_matching_enabled: canUseSmartPetHints,
                requested_pet_id: petId,
                active_pet_count: activePetCount,
                fallback_pet_id: (fallbackPet === null || fallbackPet === void 0 ? void 0 : fallbackPet.id) || null,
                fallback_pet_name: (0, utils_1.asString)((_c = fallbackPet === null || fallbackPet === void 0 ? void 0 : fallbackPet.data) === null || _c === void 0 ? void 0 : _c.name) || null,
            };
        }
    }
    if (!petData) {
        if (canUseSmartPetHints && petCandidates.length > 1) {
            const matched = (0, petMatching_1.choosePetByHints)({
                pets: petCandidates.filter((row) => Boolean(row.name)),
                hints: args.contextHints,
            });
            if (matched) {
                petId = matched.pet.id;
                petData = matched.pet.data;
                petResolutionDebug = {
                    mode: "smart_match",
                    smart_matching_enabled: true,
                    candidate_count: petCandidates.length,
                    chosen_pet_id: matched.pet.id,
                    chosen_pet_name: matched.pet.name || null,
                    score: matched.score,
                    anchors: matched.anchors,
                    reasons: matched.reasons.slice(0, 8),
                    active_pet_count: activePetCount,
                    fallback_pet_id: (fallbackPet === null || fallbackPet === void 0 ? void 0 : fallbackPet.id) || null,
                    fallback_pet_name: (0, utils_1.asString)((_d = fallbackPet === null || fallbackPet === void 0 ? void 0 : fallbackPet.data) === null || _d === void 0 ? void 0 : _d.name) || null,
                };
            }
            else {
                petResolutionDebug = {
                    mode: "smart_match_ambiguous",
                    smart_matching_enabled: true,
                    candidate_count: petCandidates.length,
                    active_pet_count: activePetCount,
                    fallback_pet_id: (fallbackPet === null || fallbackPet === void 0 ? void 0 : fallbackPet.id) || null,
                    fallback_pet_name: (0, utils_1.asString)((_e = fallbackPet === null || fallbackPet === void 0 ? void 0 : fallbackPet.data) === null || _e === void 0 ? void 0 : _e.name) || null,
                };
            }
        }
        if (!petData && fallbackPet) {
            petId = fallbackPet.id;
            petData = fallbackPet.data;
            petResolutionDebug = {
                mode: "single_pet_fallback",
                smart_matching_enabled: canUseSmartPetHints,
                chosen_pet_id: petId,
                chosen_pet_name: (0, utils_1.asString)(petData.name) || null,
                active_pet_count: activePetCount,
                fallback_pet_id: fallbackPet.id,
                fallback_pet_name: (0, utils_1.asString)(fallbackPet.data.name) || null,
            };
        }
        else if (!petData && activePetCount > 1) {
            petId = null;
            petData = null;
            petResolutionDebug = {
                mode: "ambiguous_multi_pet",
                smart_matching_enabled: canUseSmartPetHints,
                candidate_count: activePetCount,
                active_pet_count: activePetCount,
                fallback_pet_id: (fallbackPet === null || fallbackPet === void 0 ? void 0 : fallbackPet.id) || null,
                fallback_pet_name: (0, utils_1.asString)((_f = fallbackPet === null || fallbackPet === void 0 ? void 0 : fallbackPet.data) === null || _f === void 0 ? void 0 : _f.name) || null,
            };
        }
        else if (!petData && activePetCount === 0) {
            petResolutionDebug = {
                mode: "no_pet_available",
                smart_matching_enabled: canUseSmartPetHints,
                active_pet_count: activePetCount,
                fallback_pet_id: null,
                fallback_pet_name: null,
            };
        }
    }
    if (petData && canUseSmartPetHints && petCandidates.length > 1) {
        const chosenCandidate = petCandidates.find((candidate) => candidate.id === petId) || {
            id: petId || "unknown_pet",
            data: petData,
            name: (0, utils_1.asString)(petData.name),
            species: (0, utils_1.asString)(petData.species),
            breed: (0, utils_1.asString)(petData.breed),
            knownConditions: await (0, petMatching_1.resolvePetConditionHints)(petId || "", petData),
        };
        const identityConflict = (0, petMatching_1.detectPetIdentityConflict)({
            pets: petCandidates.filter((row) => Boolean(row.name)),
            chosenPet: chosenCandidate,
            subjectText: (_g = args.contextHints) === null || _g === void 0 ? void 0 : _g.subjectText,
            bodyText: (_h = args.contextHints) === null || _h === void 0 ? void 0 : _h.bodyText,
        });
        if (identityConflict.hasConflict) {
            petResolutionDebug = Object.assign(Object.assign({}, petResolutionDebug), { identity_conflict: true, identity_conflict_label: identityConflict.label, identity_conflict_reasons: identityConflict.reasons, species_signals: identityConflict.speciesSignals, mentioned_pet_names: identityConflict.mentionedPetNames, requires_human_review: true });
        }
    }
    const birthDate = (0, utils_1.parseBirthDateFromPet)(petData || {});
    const petAgeYears = (0, utils_1.calculateAgeYears)(birthDate);
    const petBirthDateIso = birthDate ? birthDate.toISOString() : null;
    return {
        planType,
        petId,
        petName: (0, utils_1.asString)((petData || {}).name) || null,
        fallbackPetId: (fallbackPet === null || fallbackPet === void 0 ? void 0 : fallbackPet.id) || null,
        fallbackPetName: (0, utils_1.asString)((_j = fallbackPet === null || fallbackPet === void 0 ? void 0 : fallbackPet.data) === null || _j === void 0 ? void 0 : _j.name) || null,
        activePetCount,
        petBirthDateIso,
        petAgeYears,
        petContext: {
            name: (0, utils_1.asString)((petData || {}).name) || null,
            species: (0, utils_1.asString)((petData || {}).species) || null,
            breed: (0, utils_1.asString)((petData || {}).breed) || null,
            age_years: petAgeYears,
            active_pet_count: activePetCount,
            fallback_pet_id: (fallbackPet === null || fallbackPet === void 0 ? void 0 : fallbackPet.id) || null,
            fallback_pet_name: (0, utils_1.asString)((_k = fallbackPet === null || fallbackPet === void 0 ? void 0 : fallbackPet.data) === null || _k === void 0 ? void 0 : _k.name) || null,
            identity_conflict: petResolutionDebug.identity_conflict === true,
            identity_conflict_label: (0, utils_1.asString)(petResolutionDebug.identity_conflict_label) || null,
            known_conditions: Array.isArray((petData || {}).knownConditions)
                ? (petData || {}).knownConditions.filter((row) => typeof row === "string")
                : [],
            known_allergies: Array.isArray((petData || {}).knownAllergies)
                ? (petData || {}).knownAllergies.filter((row) => typeof row === "string")
                : [],
        },
        petResolutionDebug,
    };
}
async function fetchGmailProfile(accessToken) {
    try {
        const profile = await callGoogleJson(GOOGLE_GMAIL_PROFILE_URL, accessToken);
        return {
            email: (0, utils_1.asString)(profile.emailAddress) || null,
            historyId: (0, utils_1.asString)(profile.historyId) || null,
        };
    }
    catch (_a) {
        return { email: null, historyId: null };
    }
}
async function countActiveSessions() {
    const maxConcurrent = (0, envConfig_1.getMaxConcurrentExtractionJobs)();
    const snapshot = await admin
        .firestore()
        .collection("gmail_ingestion_sessions")
        .where("status", "in", ["queued", "processing"])
        .limit(maxConcurrent + 1)
        .get();
    return snapshot.size;
}
async function createOrUpdateUserEmailConfig(args) {
    const planAndPet = await resolvePlanAndPet({ uid: args.uid, preferredPetId: args.preferredPetId });
    const maxLookbackMonths = (0, utils_1.calculateMaxLookbackMonths)({
        planType: planAndPet.planType,
        birthDate: (0, utils_1.parseIsoDate)(planAndPet.petBirthDateIso),
        petAgeYears: planAndPet.petAgeYears,
    });
    const maxMailsPerSync = (0, utils_1.getMaxMailsPerSync)(planAndPet.planType);
    const nowIso = (0, utils_1.getNowIso)();
    const config = {
        user_id: args.uid,
        gmail_account: args.gmailAccount,
        plan_type: planAndPet.planType,
        pet_id: planAndPet.petId,
        pet_name: planAndPet.petName,
        fallback_pet_id: planAndPet.fallbackPetId,
        fallback_pet_name: planAndPet.fallbackPetName,
        active_pet_count: planAndPet.activePetCount,
        pet_birthdate: planAndPet.petBirthDateIso,
        pet_age_years: planAndPet.petAgeYears,
        max_lookback_months: maxLookbackMonths,
        max_mails_per_sync: maxMailsPerSync,
        ingestion_status: args.ingestionStatus,
        last_sync_timestamp: nowIso,
        token_encrypted: true,
        token_ref: `users/${args.uid}/mail_sync_tokens/gmail`,
        sync_status: args.ingestionStatus === "requires_review" ? "requires_review" : args.ingestionStatus,
        last_history_id: args.lastHistoryId,
        updated_at: nowIso,
        total_emails_scanned: 0,
        clinical_candidates_detected: 0,
        documents_processed: 0,
        duplicates_removed: 0,
    };
    await admin.firestore().collection("user_email_config").doc(args.uid).set(config, { merge: true });
    await admin.firestore().collection("users").doc(args.uid).set({
        gmailSync: {
            syncStatus: config.sync_status,
            lastHistoryId: config.last_history_id,
            petId: config.pet_id,
            petName: config.pet_name,
            fallbackPetId: config.fallback_pet_id || null,
            fallbackPetName: config.fallback_pet_name || null,
            activePetCount: config.active_pet_count || 0,
            maxLookbackMonths: config.max_lookback_months,
            maxMailsPerSync: config.max_mails_per_sync,
            ingestionStatus: config.ingestion_status,
            updatedAt: nowIso,
        },
    }, { merge: true });
    return config;
}
// ─── Session, Queue, Locking ───────────────────────────────────────
// TRASPLANTADO → ./ingestion/sessionQueue.ts
// createIngestionSession → sessionQueue.ts
// updateIngestionProgress → sessionQueue.ts
// queueCollectionForStage → sessionQueue.ts
// enqueueStageJob → sessionQueue.ts
// pickPendingJobs → sessionQueue.ts
// markJobProcessing → sessionQueue.ts
// markJobCompleted → sessionQueue.ts
// markJobFailed → sessionQueue.ts
// incrementSessionCounters → sessionQueue.ts
// recordSessionStageMetric → sessionQueue.ts
// maybeFinalizeSession → sessionQueue.ts
// closeStuckSessionAsPartial → sessionQueue.ts
// acquireUserIngestionLock → sessionQueue.ts
// releaseUserIngestionLock → sessionQueue.ts
// ensurePendingScanJob → sessionQueue.ts
async function processScanQueueJob(doc) {
    const data = (0, utils_1.asRecord)(doc.data());
    const sessionId = (0, utils_1.asString)(data.session_id);
    const uid = (0, utils_1.asString)(data.user_id);
    if (!sessionId || !uid) {
        await (0, sessionQueue_1.markJobCompleted)(doc.ref);
        return;
    }
    const sessionSnap = await admin.firestore().collection("gmail_ingestion_sessions").doc(sessionId).get();
    if (!sessionSnap.exists) {
        await (0, sessionQueue_1.markJobCompleted)(doc.ref);
        return;
    }
    const sessionData = (0, utils_1.asRecord)(sessionSnap.data());
    const status = (0, utils_1.asString)(sessionData.status);
    if (status === "completed" || status === "requires_review" || status === "failed") {
        await (0, sessionQueue_1.markJobCompleted)(doc.ref);
        return;
    }
    await processSession(sessionId, {
        maxEmailsToProcess: (0, envConfig_1.getScanBatchSize)(),
        hardDeadlineMs: 4 * 60 * 1000,
    });
    const refreshed = await admin.firestore().collection("gmail_ingestion_sessions").doc(sessionId).get();
    const refreshedData = (0, utils_1.asRecord)(refreshed.data());
    const refreshedStatus = (0, utils_1.asString)(refreshedData.status);
    const scanComplete = refreshedData.scan_complete === true;
    const hasNextPage = Boolean((0, utils_1.asString)(refreshedData.next_page_token));
    if (!scanComplete && (refreshedStatus === "queued" || refreshedStatus === "processing") && hasNextPage) {
        await (0, sessionQueue_1.ensurePendingScanJob)(sessionId, uid);
    }
    await (0, sessionQueue_1.markJobCompleted)(doc.ref);
    await (0, sessionQueue_1.maybeFinalizeSession)(sessionId);
}
async function processAttachmentQueueJob(doc) {
    const data = (0, utils_1.asRecord)(doc.data());
    const payload = (0, utils_1.asRecord)(data.payload);
    const messageId = (0, utils_1.asString)(payload.message_id);
    const rawDocId = (0, utils_1.asString)(payload.raw_doc_id);
    const sessionId = (0, utils_1.asString)(data.session_id);
    const uid = (0, utils_1.asString)(data.user_id);
    if (!messageId || !rawDocId || !sessionId || !uid) {
        await (0, sessionQueue_1.markJobCompleted)(doc.ref);
        return;
    }
    const rawDoc = await (0, jobProcessing_1.loadTemporaryRawDocument)(rawDocId);
    if (!rawDoc) {
        await (0, sessionQueue_1.markJobCompleted)(doc.ref);
        await (0, sessionQueue_1.maybeFinalizeSession)(sessionId);
        return;
    }
    const token = await fetchUserRefreshToken(uid);
    const clientId = (0, utils_1.asString)(process.env.GMAIL_OAUTH_CLIENT_ID);
    const clientSecret = (0, utils_1.asString)(process.env.GMAIL_OAUTH_CLIENT_SECRET);
    if (!clientId || !clientSecret) {
        throw new Error("gmail_client_credentials_missing");
    }
    const accessToken = await exchangeRefreshToken({
        refreshToken: token.refreshToken,
        clientId,
        clientSecret,
    });
    const configSnap = await admin.firestore().collection("user_email_config").doc(uid).get();
    const config = (0, utils_1.asRecord)(configSnap.data());
    const planType = ((0, utils_1.asString)(config.plan_type) === "premium" ? "premium" : "free");
    const sessionSnap = await admin.firestore().collection("gmail_ingestion_sessions").doc(sessionId).get();
    const sessionData = (0, utils_1.asRecord)(sessionSnap.data());
    const counters = (0, utils_1.asRecord)(sessionData.counters);
    const alreadyProcessedAttachments = (0, utils_1.asNonNegativeNumber)(counters.total_attachments_processed, 0);
    const maxAttachmentsToProcess = planType === "free"
        ? Math.max(0, FREE_PLAN_ATTACHMENT_PROCESS_LIMIT - alreadyProcessedAttachments)
        : MAX_ATTACHMENTS_PER_EMAIL;
    const detailUrl = new URL(`${GMAIL_API_BASE_URL}/messages/${encodeURIComponent(messageId)}`);
    detailUrl.searchParams.set("format", "full");
    const detail = await callGoogleJson(detailUrl.toString(), accessToken);
    await (0, sessionQueue_1.updateIngestionProgress)(uid, "extracting_medical_events");
    const started = Date.now();
    const attachmentExtraction = await fetchAttachmentTextChunks({
        accessToken,
        uid,
        sessionId,
        messageId,
        payload: detail.payload,
        maxAttachmentsToProcess,
    });
    await (0, sessionQueue_1.recordSessionStageMetric)({
        sessionId,
        stageKey: "attachment",
        durationMs: Date.now() - started,
    });
    await (0, sessionQueue_1.incrementSessionCounters)(sessionId, {
        total_attachments_processed: attachmentExtraction.processedCount,
    });
    await (0, jobProcessing_1.saveTemporaryAttachmentExtraction)({
        rawDocId,
        sessionId,
        uid,
        attachmentMetadata: attachmentExtraction.attachmentMetadata,
        extractedText: attachmentExtraction.extractedChunks.join("\n\n").slice(0, 250000),
    });
    await (0, sessionQueue_1.enqueueStageJob)({
        stage: "ai_extract",
        sessionId,
        uid,
        payload: {
            message_id: messageId,
            raw_doc_id: rawDocId,
            source_sender: rawDoc.sourceSender,
            source_subject: rawDoc.sourceSubject,
            mode: "extract",
        },
    });
    await (0, sessionQueue_1.markJobCompleted)(doc.ref);
    await (0, sessionQueue_1.maybeFinalizeSession)(sessionId);
}
async function processAiQueueJob(doc) {
    const data = (0, utils_1.asRecord)(doc.data());
    const payload = (0, utils_1.asRecord)(data.payload);
    const messageId = (0, utils_1.asString)(payload.message_id);
    const rawDocId = (0, utils_1.asString)(payload.raw_doc_id);
    const sourceSender = (0, utils_1.asString)(payload.source_sender);
    const sourceSubject = (0, utils_1.asString)(payload.source_subject);
    const mode = ((0, utils_1.asString)(payload.mode) === "extract" ? "extract" : "classify");
    const sessionId = (0, utils_1.asString)(data.session_id);
    const uid = (0, utils_1.asString)(data.user_id);
    if (!messageId || !rawDocId || !sessionId || !uid) {
        await (0, sessionQueue_1.markJobCompleted)(doc.ref);
        return;
    }
    const rawDoc = await (0, jobProcessing_1.loadTemporaryRawDocument)(rawDocId);
    if (!rawDoc) {
        await (0, sessionQueue_1.markJobCompleted)(doc.ref);
        await (0, sessionQueue_1.maybeFinalizeSession)(sessionId);
        return;
    }
    if (mode === "classify") {
        await (0, sessionQueue_1.updateIngestionProgress)(uid, "analyzing_documents");
        const classification = await (0, clinicalAi_1.classifyClinicalContentWithAi)({
            bodyText: rawDoc.bodyText,
            subject: sourceSubject,
            fromEmail: sourceSender,
            attachmentMetadata: rawDoc.attachmentMeta,
        }, sessionId, uid);
        if (!classification.is_clinical) {
            await admin.firestore().collection("gmail_ingestion_documents").doc(`${sessionId}_${messageId}`).set({
                session_id: sessionId,
                user_id: uid,
                message_id: messageId,
                thread_id: rawDoc.threadId,
                email_date: rawDoc.emailDate,
                from_email: sourceSender,
                subject: sourceSubject.slice(0, 400),
                attachment_count: rawDoc.attachmentMeta.length,
                attachment_metadata: (0, jobProcessing_1.sanitizeAttachmentMetadataForFirestore)(rawDoc.attachmentMeta),
                hash_signature_raw: rawDoc.hashSignatureRaw,
                ai_classification: classification,
                processing_status: "discarded_non_clinical",
                created_at: (0, utils_1.getNowIso)(),
            }, { merge: true });
            await (0, jobProcessing_1.deleteTemporaryRawDocument)(rawDocId);
            await (0, sessionQueue_1.markJobCompleted)(doc.ref);
            await (0, sessionQueue_1.maybeFinalizeSession)(sessionId);
            return;
        }
        await (0, sessionQueue_1.enqueueStageJob)({
            stage: "attachment",
            sessionId,
            uid,
            payload: {
                message_id: messageId,
                raw_doc_id: rawDocId,
            },
        });
        await admin.firestore().collection("gmail_ingestion_documents").doc(`${sessionId}_${messageId}`).set({
            session_id: sessionId,
            user_id: uid,
            message_id: messageId,
            thread_id: rawDoc.threadId,
            email_date: rawDoc.emailDate,
            from_email: sourceSender,
            subject: sourceSubject.slice(0, 400),
            attachment_count: rawDoc.attachmentMeta.length,
            attachment_metadata: (0, jobProcessing_1.sanitizeAttachmentMetadataForFirestore)(rawDoc.attachmentMeta),
            hash_signature_raw: rawDoc.hashSignatureRaw,
            ai_classification: classification,
            processing_status: "queued_attachment_ocr",
            updated_at: (0, utils_1.getNowIso)(),
        }, { merge: true });
        await (0, sessionQueue_1.markJobCompleted)(doc.ref);
        return;
    }
    const attachmentTmp = await (0, jobProcessing_1.loadTemporaryAttachmentExtraction)(rawDocId);
    const attachmentText = (attachmentTmp === null || attachmentTmp === void 0 ? void 0 : attachmentTmp.extractedText) || "";
    const attachmentMetadata = (attachmentTmp === null || attachmentTmp === void 0 ? void 0 : attachmentTmp.attachmentMetadata) || rawDoc.attachmentMeta;
    const hasExternalLinkSignal = /https?:\/\/|href\s*=|\b(link|enlace|adjunto|attachment|pdf|drive|resultados|receta|estudio)\b/i.test(`${sourceSubject}\n${rawDoc.bodyText}`);
    const shouldTryExternalLinks = hasExternalLinkSignal && (!attachmentText.trim() || attachmentMetadata.length === 0);
    const externalLinkExtraction = shouldTryExternalLinks
        ? await (0, textProcessing_1.fetchExternalLinkTextChunks)({
            bodyText: rawDoc.bodyText,
            sourceSender,
        })
        : { detectedCount: 0, fetchedCount: 0, extractedChunks: [], metadata: [] };
    const externalLinkRequiresLogin = externalLinkExtraction.metadata.some((row) => row.login_required === true || /login_required/i.test((0, utils_1.asString)(row.reason)));
    const extractedText = [rawDoc.bodyText, attachmentText, externalLinkExtraction.extractedChunks.join("\n\n")]
        .join("\n\n")
        .trim()
        .slice(0, MAX_AI_DOCUMENT_TEXT_CHARS * 2);
    const configSnap = await admin.firestore().collection("user_email_config").doc(uid).get();
    const config = (0, utils_1.asRecord)(configSnap.data());
    const petId = config.pet_id || null;
    const planAndPet = await resolvePlanAndPet({
        uid,
        preferredPetId: petId,
        contextHints: {
            subjectText: sourceSubject,
            bodyText: extractedText,
        },
    });
    const effectivePetId = planAndPet.petId || petId || planAndPet.fallbackPetId;
    // Si el resolver no pudo elegir pet (multi-mascota ambiguo) pero hay un fallback,
    // tratar igual que identity conflict para forzar review manual.
    const petWasAmbiguous = planAndPet.petId === null &&
        (0, utils_1.asNonNegativeNumber)(planAndPet.activePetCount, 0) > 1 &&
        Boolean(effectivePetId);
    const identityConflict = planAndPet.petResolutionDebug.identity_conflict === true || petWasAmbiguous;
    const identityConflictReason = identityConflict
        ? planAndPet.petResolutionDebug.identity_conflict === true
            ? "IDENTITY_CONFLICT"
            : "AMBIGUOUS_PET_MULTI_MATCH"
        : null;
    const sessionSettingsSnap = await admin.firestore().collection("gmail_ingestion_sessions").doc(sessionId).get();
    const sessionSettings = (0, utils_1.asRecord)(sessionSettingsSnap.data());
    const dedupDisabled = sessionSettings.qa_disable_dedup === true;
    await (0, sessionQueue_1.updateIngestionProgress)(uid, "extracting_medical_events");
    const extractionStarted = Date.now();
    const clinical = await (0, clinicalAi_1.extractClinicalEventsWithAi)({
        extractedText,
        emailDate: rawDoc.emailDate,
        sourceSubject,
        sourceSender,
        petContext: planAndPet.petContext,
        attachmentMetadata,
        sessionId,
        userId: uid,
    });
    await (0, sessionQueue_1.recordSessionStageMetric)({
        sessionId,
        stageKey: "extraction",
        durationMs: Date.now() - extractionStarted,
    });
    if (!clinical.is_clinical_content || clinical.confidence_overall < 60) {
        const lowConfidenceReason = (0, utils_1.asString)(clinical.reason_if_review_needed);
        const looksLikeExternalClinicalLink = /\b(link|enlace|adjunto|attachment|pdf|drive|resultados|receta|estudio)\b/i.test(`${sourceSubject}\n${rawDoc.bodyText}\n${lowConfidenceReason}`);
        const shouldRouteToReview = clinical.is_clinical_content || looksLikeExternalClinicalLink || externalLinkRequiresLogin || identityConflict;
        const preferredAttachment = (0, reviewActions_1.selectBestAttachmentForReview)(attachmentMetadata);
        const lowConfidenceReviewReason = identityConflictReason ||
            lowConfidenceReason ||
            (externalLinkRequiresLogin ? "external_link_login_required" : "low_confidence_external_reference");
        if (shouldRouteToReview) {
            const fallbackOperationalEvent = (0, clinicalAi_1.heuristicClinicalExtraction)(`${sourceSubject}\n${rawDoc.bodyText}`, rawDoc.emailDate).detected_events[0] || null;
            const syntheticEvent = {
                event_type: (fallbackOperationalEvent === null || fallbackOperationalEvent === void 0 ? void 0 : fallbackOperationalEvent.event_type) || "clinical_report",
                event_date: (0, utils_1.toIsoDateOnly)((0, utils_1.parseIsoDate)(rawDoc.emailDate) || new Date()),
                date_confidence: 40,
                description_summary: lowConfidenceReason ||
                    "Contenido clínico potencial detectado con baja confianza. Requiere revisión manual.",
                diagnosis: null,
                medications: [],
                lab_results: [],
                imaging_type: null,
                study_subtype: (fallbackOperationalEvent === null || fallbackOperationalEvent === void 0 ? void 0 : fallbackOperationalEvent.study_subtype) || null,
                appointment_time: (fallbackOperationalEvent === null || fallbackOperationalEvent === void 0 ? void 0 : fallbackOperationalEvent.appointment_time) || null,
                appointment_specialty: (fallbackOperationalEvent === null || fallbackOperationalEvent === void 0 ? void 0 : fallbackOperationalEvent.appointment_specialty) || null,
                professional_name: (fallbackOperationalEvent === null || fallbackOperationalEvent === void 0 ? void 0 : fallbackOperationalEvent.professional_name) || null,
                clinic_name: (fallbackOperationalEvent === null || fallbackOperationalEvent === void 0 ? void 0 : fallbackOperationalEvent.clinic_name) || null,
                appointment_status: (fallbackOperationalEvent === null || fallbackOperationalEvent === void 0 ? void 0 : fallbackOperationalEvent.appointment_status) || null,
                severity: null,
                confidence_score: (0, utils_1.clamp)(clinical.confidence_overall, 0, 100),
            };
            const gmailReviewId = await (0, reviewActions_1.persistReviewEvent)({
                uid,
                petId: effectivePetId,
                sessionId,
                sourceEmailId: messageId,
                sourceSubject,
                sourceSender,
                sourceDate: rawDoc.emailDate,
                event: syntheticEvent,
                overallConfidence: clinical.confidence_overall,
                narrativeSummary: clinical.narrative_summary || lowConfidenceReason,
                reason: lowConfidenceReviewReason,
            });
            await (0, reviewActions_1.upsertSyncReviewPendingAction)({
                uid,
                petId: effectivePetId,
                sessionId,
                sourceEmailId: messageId,
                event: syntheticEvent,
                narrativeSummary: clinical.narrative_summary,
                reason: lowConfidenceReviewReason,
                gmailReviewId,
                generatedFromEventId: null,
                sourceAttachment: preferredAttachment,
            });
            await (0, sessionQueue_1.incrementSessionCounters)(sessionId, { events_requiring_review: 1 });
        }
        await (0, domainIngestion_1.mirrorBrainResolution)({
            uid,
            petReference: (0, utils_1.asString)(planAndPet.petContext.name) || null,
            petIdHint: effectivePetId,
            category: (0, domainIngestion_1.inferBrainCategoryFromSubject)(sourceSubject),
            entities: [{
                    type: "low_confidence_document",
                    summary: clinical.narrative_summary.slice(0, 600),
                    reason: lowConfidenceReason || null,
                }],
            confidence01: (0, utils_1.clamp)(clinical.confidence_overall / 100, 0, 1),
            reviewRequired: shouldRouteToReview,
            reasonIfReviewNeeded: lowConfidenceReviewReason,
            sourceMetadata: {
                source: "gmail",
                import_session_id: sessionId,
                message_id: messageId,
                subject: sourceSubject,
                from_email: sourceSender,
                source_date: rawDoc.emailDate,
                attachment_count: attachmentMetadata.length,
                canonical_event_id: null,
                ui_hint: {
                    image_fragment_url: (preferredAttachment === null || preferredAttachment === void 0 ? void 0 : preferredAttachment.storage_signed_url) || null,
                    storage_uri: (preferredAttachment === null || preferredAttachment === void 0 ? void 0 : preferredAttachment.storage_uri) || null,
                    storage_path: (preferredAttachment === null || preferredAttachment === void 0 ? void 0 : preferredAttachment.storage_path) || null,
                    source_file_name: (preferredAttachment === null || preferredAttachment === void 0 ? void 0 : preferredAttachment.filename) || null,
                },
            },
        });
        await admin.firestore().collection("gmail_ingestion_documents").doc(`${sessionId}_${messageId}`).set({
            session_id: sessionId,
            user_id: uid,
            message_id: messageId,
            thread_id: rawDoc.threadId,
            email_date: rawDoc.emailDate,
            from_email: sourceSender,
            subject: sourceSubject.slice(0, 400),
            attachment_count: attachmentMetadata.length,
            attachment_metadata: (0, jobProcessing_1.sanitizeAttachmentMetadataForFirestore)(attachmentMetadata),
            hash_signature_raw: rawDoc.hashSignatureRaw,
            ai_result: {
                is_clinical_content: clinical.is_clinical_content,
                confidence_overall: clinical.confidence_overall,
                reason_if_review_needed: identityConflictReason || clinical.reason_if_review_needed,
            },
            identity_resolution: {
                pet_id: effectivePetId,
                pet_name: planAndPet.petName,
                fallback_pet_id: planAndPet.fallbackPetId,
                fallback_pet_name: planAndPet.fallbackPetName,
                active_pet_count: planAndPet.activePetCount,
                pet_resolution: planAndPet.petResolutionDebug,
            },
            link_extraction: {
                links_detected: externalLinkExtraction.detectedCount,
                links_fetched: externalLinkExtraction.fetchedCount,
                links_with_text: externalLinkExtraction.extractedChunks.length,
                links: externalLinkExtraction.metadata.slice(0, 8),
            },
            processing_status: shouldRouteToReview ? "requires_review_low_confidence" : "discarded_low_confidence",
            created_at: (0, utils_1.getNowIso)(),
        }, { merge: true });
        await (0, jobProcessing_1.deleteTemporaryAttachmentExtraction)(rawDocId);
        await (0, jobProcessing_1.deleteTemporaryRawDocument)(rawDocId);
        await (0, sessionQueue_1.markJobCompleted)(doc.ref);
        await (0, sessionQueue_1.maybeFinalizeSession)(sessionId);
        return;
    }
    let createdForMessage = 0;
    let reviewsForMessage = 0;
    let duplicatesForMessage = 0;
    const preferredAttachment = (0, reviewActions_1.selectBestAttachmentForReview)(attachmentMetadata);
    for (const event of clinical.detected_events) {
        if (!dedupDisabled) {
            const semanticDuplicate = await (0, reviewActions_1.detectSemanticDuplicateCandidate)({
                uid,
                petId: effectivePetId,
                event,
                sourceSender,
            });
            if (semanticDuplicate.isLikelyDuplicate) {
                reviewsForMessage += 1;
                const gmailReviewId = await (0, reviewActions_1.persistReviewEvent)({
                    uid,
                    petId: effectivePetId,
                    sessionId,
                    sourceEmailId: messageId,
                    sourceSubject,
                    sourceSender,
                    sourceDate: rawDoc.emailDate,
                    event,
                    overallConfidence: clinical.confidence_overall,
                    narrativeSummary: clinical.narrative_summary,
                    reason: `semantic_duplicate_candidate_${semanticDuplicate.score}`,
                });
                await (0, reviewActions_1.upsertSyncReviewPendingAction)({
                    uid,
                    petId: effectivePetId,
                    sessionId,
                    sourceEmailId: messageId,
                    event,
                    narrativeSummary: clinical.narrative_summary,
                    reason: `semantic_duplicate_candidate_${semanticDuplicate.score}`,
                    gmailReviewId,
                    generatedFromEventId: null,
                    sourceAttachment: preferredAttachment,
                });
                await (0, domainIngestion_1.storeKnowledgeSignal)({
                    uid,
                    petId: effectivePetId,
                    sessionId,
                    event,
                    extractionConfidence: event.confidence_score,
                    originalConfidence: clinical.confidence_overall,
                    validatedByHuman: false,
                    validationStatus: "duplicate_candidate",
                    sourceTruthLevel: "review_queue",
                    requiresManualConfirmation: true,
                });
                continue;
            }
            if (await (0, reviewActions_1.isDuplicateEventByFingerprint)({ uid, petId: effectivePetId, event })) {
                duplicatesForMessage += 1;
                continue;
            }
        }
        const missingDoseInTreatment = (0, clinicalNormalization_1.isPrescriptionEventType)(event.event_type) &&
            event.medications.some((row) => !(0, utils_1.asString)(row.dose) || !(0, utils_1.asString)(row.frequency));
        const autoIngestThreshold = (0, envConfig_1.getAutoIngestConfidenceThreshold)();
        const requiresReview = identityConflict ||
            clinical.confidence_overall < autoIngestThreshold ||
            event.confidence_score < autoIngestThreshold ||
            clinical.requires_human_review ||
            externalLinkRequiresLogin ||
            missingDoseInTreatment;
        if (requiresReview) {
            const reviewReason = identityConflictReason ||
                clinical.reason_if_review_needed ||
                (externalLinkRequiresLogin ? "external_link_login_required" : "") ||
                (missingDoseInTreatment ? "missing_treatment_dose_or_frequency" : "confidence_below_auto_ingest_threshold");
            reviewsForMessage += 1;
            let canonicalEventIdForResolver = null;
            const gmailReviewId = await (0, reviewActions_1.persistReviewEvent)({
                uid,
                petId: effectivePetId,
                sessionId,
                sourceEmailId: messageId,
                sourceSubject,
                sourceSender,
                sourceDate: rawDoc.emailDate,
                event,
                overallConfidence: clinical.confidence_overall,
                narrativeSummary: clinical.narrative_summary,
                reason: reviewReason,
            });
            if (missingDoseInTreatment) {
                const ingestionResult = await (0, domainIngestion_1.ingestEventToDomain)({
                    uid,
                    petId: effectivePetId,
                    sourceEmailId: messageId,
                    sourceSubject,
                    sourceSender,
                    sourceDate: rawDoc.emailDate,
                    event,
                    narrativeSummary: clinical.narrative_summary,
                    requiresConfirmation: true,
                    reviewReason,
                    sourceAttachment: preferredAttachment,
                });
                canonicalEventIdForResolver = ingestionResult.canonicalEventId;
                if (effectivePetId && ingestionResult.blockedMedicationCount > 0) {
                    const reviewId = await (0, reviewActions_1.upsertClinicalReviewDraft)({
                        uid,
                        petId: effectivePetId,
                        sessionId,
                        canonicalEventId: ingestionResult.canonicalEventId,
                        sourceEmailId: messageId,
                        sourceSubject,
                        sourceSender,
                        sourceDate: rawDoc.emailDate,
                        event,
                        attachmentMetadata,
                        gmailReviewId,
                    });
                    await (0, reviewActions_1.upsertIncompleteTreatmentPendingAction)({
                        uid,
                        petId: effectivePetId,
                        sessionId,
                        canonicalEventId: ingestionResult.canonicalEventId,
                        sourceEmailId: messageId,
                        event,
                        reviewId,
                        sourceAttachment: preferredAttachment,
                    });
                }
                createdForMessage += 1;
            }
            else {
                await (0, reviewActions_1.upsertSyncReviewPendingAction)({
                    uid,
                    petId: effectivePetId,
                    sessionId,
                    sourceEmailId: messageId,
                    event,
                    narrativeSummary: clinical.narrative_summary,
                    reason: reviewReason,
                    gmailReviewId,
                    generatedFromEventId: canonicalEventIdForResolver,
                    sourceAttachment: preferredAttachment,
                });
            }
            await (0, domainIngestion_1.mirrorBrainResolution)({
                uid,
                petReference: (0, utils_1.asString)(planAndPet.petContext.name) || null,
                petIdHint: effectivePetId,
                category: (0, domainIngestion_1.mapEventTypeToBrainCategory)(event.event_type),
                entities: (0, domainIngestion_1.buildBrainEntitiesFromEvent)(event),
                confidence01: (0, utils_1.clamp)(clinical.confidence_overall / 100, 0, 1),
                reviewRequired: true,
                reasonIfReviewNeeded: reviewReason,
                sourceMetadata: {
                    source: "gmail",
                    import_session_id: sessionId,
                    message_id: messageId,
                    subject: sourceSubject,
                    from_email: sourceSender,
                    source_date: rawDoc.emailDate,
                    attachment_count: attachmentMetadata.length,
                    review_id: gmailReviewId,
                    canonical_event_id: canonicalEventIdForResolver,
                    ui_hint: {
                        image_fragment_url: (preferredAttachment === null || preferredAttachment === void 0 ? void 0 : preferredAttachment.storage_signed_url) || null,
                        source_file_name: (preferredAttachment === null || preferredAttachment === void 0 ? void 0 : preferredAttachment.filename) || null,
                    },
                },
            });
            await (0, domainIngestion_1.storeKnowledgeSignal)({
                uid,
                petId: effectivePetId,
                sessionId,
                event,
                extractionConfidence: event.confidence_score,
                originalConfidence: clinical.confidence_overall,
                validatedByHuman: false,
                validationStatus: "pending_human_review",
                sourceTruthLevel: "review_queue",
                requiresManualConfirmation: true,
            });
            continue;
        }
        const ingestionResult = await (0, domainIngestion_1.ingestEventToDomain)({
            uid,
            petId: effectivePetId,
            sourceEmailId: messageId,
            sourceSubject,
            sourceSender,
            sourceDate: rawDoc.emailDate,
            event,
            narrativeSummary: clinical.narrative_summary,
            requiresConfirmation: false,
            sourceAttachment: preferredAttachment,
        });
        await (0, domainIngestion_1.mirrorBrainResolution)({
            uid,
            petReference: (0, utils_1.asString)(planAndPet.petContext.name) || null,
            petIdHint: effectivePetId,
            category: (0, domainIngestion_1.mapEventTypeToBrainCategory)(event.event_type),
            entities: (0, domainIngestion_1.buildBrainEntitiesFromEvent)(event),
            confidence01: (0, utils_1.clamp)(clinical.confidence_overall / 100, 0, 1),
            reviewRequired: false,
            reasonIfReviewNeeded: null,
            sourceMetadata: {
                source: "gmail",
                import_session_id: sessionId,
                message_id: messageId,
                subject: sourceSubject,
                from_email: sourceSender,
                source_date: rawDoc.emailDate,
                attachment_count: attachmentMetadata.length,
                canonical_event_id: ingestionResult.canonicalEventId,
                ui_hint: {
                    source_file_name: (preferredAttachment === null || preferredAttachment === void 0 ? void 0 : preferredAttachment.filename) || null,
                    image_fragment_url: (preferredAttachment === null || preferredAttachment === void 0 ? void 0 : preferredAttachment.storage_signed_url) || null,
                },
            },
        });
        await (0, domainIngestion_1.storeKnowledgeSignal)({
            uid,
            petId: effectivePetId,
            sessionId,
            event,
            extractionConfidence: event.confidence_score,
            originalConfidence: clinical.confidence_overall,
            validatedByHuman: false,
            validationStatus: "auto_ingested_unconfirmed",
            sourceTruthLevel: "ai_auto_ingested",
            requiresManualConfirmation: false,
        });
        createdForMessage += 1;
    }
    await (0, sessionQueue_1.incrementSessionCounters)(sessionId, {
        new_medical_events_created: createdForMessage,
        events_requiring_review: reviewsForMessage,
        duplicates_removed: duplicatesForMessage,
    });
    await admin.firestore().collection("gmail_ingestion_documents").doc(`${sessionId}_${messageId}`).set({
        session_id: sessionId,
        user_id: uid,
        message_id: messageId,
        thread_id: rawDoc.threadId,
        email_date: rawDoc.emailDate,
        from_email: sourceSender,
        subject: sourceSubject.slice(0, 400),
        attachment_count: attachmentMetadata.length,
        attachment_metadata: (0, jobProcessing_1.sanitizeAttachmentMetadataForFirestore)(attachmentMetadata),
        hash_signature_raw: rawDoc.hashSignatureRaw,
        ai_result: {
            is_clinical_content: clinical.is_clinical_content,
            confidence_overall: clinical.confidence_overall,
            detected_events_count: clinical.detected_events.length,
            narrative_summary: clinical.narrative_summary.slice(0, 1200),
            requires_human_review: clinical.requires_human_review,
            reason_if_review_needed: identityConflictReason || clinical.reason_if_review_needed,
        },
        identity_resolution: {
            pet_id: effectivePetId,
            pet_name: planAndPet.petName,
            fallback_pet_id: planAndPet.fallbackPetId,
            fallback_pet_name: planAndPet.fallbackPetName,
            active_pet_count: planAndPet.activePetCount,
            pet_resolution: planAndPet.petResolutionDebug,
        },
        link_extraction: {
            links_detected: externalLinkExtraction.detectedCount,
            links_fetched: externalLinkExtraction.fetchedCount,
            links_with_text: externalLinkExtraction.extractedChunks.length,
            links: externalLinkExtraction.metadata.slice(0, 8),
        },
        processing_status: reviewsForMessage > 0 ? "requires_review" : "ingested",
        ingested_count: createdForMessage,
        review_count: reviewsForMessage,
        created_at: (0, utils_1.getNowIso)(),
    }, { merge: true });
    await (0, jobProcessing_1.deleteTemporaryAttachmentExtraction)(rawDocId);
    await (0, jobProcessing_1.deleteTemporaryRawDocument)(rawDocId);
    await (0, sessionQueue_1.markJobCompleted)(doc.ref);
    await (0, sessionQueue_1.maybeFinalizeSession)(sessionId);
}
async function processSession(sessionId, options) {
    const sessionRef = admin.firestore().collection("gmail_ingestion_sessions").doc(sessionId);
    const sessionSnap = await sessionRef.get();
    if (!sessionSnap.exists)
        return;
    const sessionData = (0, utils_1.asRecord)(sessionSnap.data());
    const status = (0, utils_1.asString)(sessionData.status);
    if (status === "completed" || status === "failed")
        return;
    const uid = (0, utils_1.asString)(sessionData.user_id);
    if (!uid)
        return;
    const configSnap = await admin.firestore().collection("user_email_config").doc(uid).get();
    if (!configSnap.exists) {
        await sessionRef.set({ status: "failed", updated_at: (0, utils_1.getNowIso)(), error: "user_email_config_missing" }, { merge: true });
        return;
    }
    const config = (0, utils_1.asRecord)(configSnap.data());
    const petId = (0, utils_1.asString)(sessionData.pet_id) || config.pet_id || null;
    const dedupDisabled = options.disableDedup === true || sessionData.qa_disable_dedup === true;
    const currentCounters = (0, utils_1.asRecord)(sessionData.counters);
    const counters = {
        total_emails_scanned: (0, utils_1.asNonNegativeNumber)(currentCounters.total_emails_scanned),
        candidate_emails_detected: (0, utils_1.asNonNegativeNumber)(currentCounters.candidate_emails_detected),
        emails_with_attachments: (0, utils_1.asNonNegativeNumber)(currentCounters.emails_with_attachments),
        emails_with_images: (0, utils_1.asNonNegativeNumber)(currentCounters.emails_with_images),
        total_attachments_processed: (0, utils_1.asNonNegativeNumber)(currentCounters.total_attachments_processed),
        duplicates_removed: (0, utils_1.asNonNegativeNumber)(currentCounters.duplicates_removed),
        new_medical_events_created: (0, utils_1.asNonNegativeNumber)(currentCounters.new_medical_events_created),
        events_requiring_review: (0, utils_1.asNonNegativeNumber)(currentCounters.events_requiring_review),
        errors_count: (0, utils_1.asNonNegativeNumber)(currentCounters.errors_count),
    };
    const nowIso = (0, utils_1.getNowIso)();
    await sessionRef.set({ status: "processing", updated_at: nowIso }, { merge: true });
    await (0, sessionQueue_1.updateIngestionProgress)(uid, "scanning_emails");
    const maxConcurrentJobs = (0, envConfig_1.getMaxConcurrentExtractionJobs)();
    const activeSessions = await countActiveSessions();
    if (activeSessions > maxConcurrentJobs) {
        await sessionRef.set({
            status: "queued",
            updated_at: (0, utils_1.getNowIso)(),
            throttle_reason: "max_concurrent_jobs_reached",
        }, { merge: true });
        return;
    }
    const { refreshToken, grantedScopes } = await fetchUserRefreshToken(uid);
    const hasReadonlyScope = grantedScopes.includes(GMAIL_SCOPE_READONLY);
    if (!hasReadonlyScope) {
        await sessionRef.set({
            status: "failed",
            updated_at: (0, utils_1.getNowIso)(),
            error: "missing_required_scope_gmail_readonly",
        }, { merge: true });
        await (0, sessionQueue_1.updateIngestionProgress)(uid, "requires_review");
        return;
    }
    const clientId = (0, utils_1.asString)(process.env.GMAIL_OAUTH_CLIENT_ID);
    const clientSecret = (0, utils_1.asString)(process.env.GMAIL_OAUTH_CLIENT_SECRET);
    if (!clientId || !clientSecret) {
        throw new Error("gmail_client_credentials_missing");
    }
    const accessToken = await exchangeRefreshToken({ refreshToken, clientId, clientSecret });
    try {
        await assertGmailFullPayloadAccess(accessToken);
    }
    catch (error) {
        if (isMetadataOnlyScopeError(error)) {
            await markGmailReconsentRequired({ uid, sessionRef });
            return;
        }
        throw error;
    }
    const planAndPet = await resolvePlanAndPet({ uid, preferredPetId: petId });
    let query = (0, utils_1.asString)(sessionData.query);
    const fallbackQuery = (0, utils_1.asString)(sessionData.fallback_query);
    let fallbackQueryApplied = sessionData.fallback_query_applied === true;
    const useSearchQuery = Boolean(query);
    const disableFallbackQuery = sessionData.qa_disable_fallback_query === true;
    let nextPageToken = (0, utils_1.asString)(sessionData.next_page_token);
    const lookbackAfter = (0, utils_1.parseDateOnly)(sessionData.lookback_after);
    const lookbackBefore = (0, utils_1.parseDateOnly)(sessionData.lookback_before);
    let stopByLookbackFloor = false;
    let processedInRun = 0;
    let processedSinceFlush = 0;
    const started = Date.now();
    const scanStageStarted = Date.now();
    const scanBatchSize = (0, envConfig_1.getScanBatchSize)();
    const planType = ((0, utils_1.asString)(config.plan_type) === "premium" ? "premium" : "free");
    const planHardCap = planType === "premium" ? (0, envConfig_1.getPremiumPlanMaxEmailsPerSync)() : (0, envConfig_1.getFreePlanMaxEmailsPerSync)();
    const configuredCap = (0, utils_1.asNonNegativeNumber)(sessionData.max_mails_per_sync, (0, utils_1.asNonNegativeNumber)(config.max_mails_per_sync, (0, utils_1.getMaxMailsPerSync)(planType)));
    const normalizedConfiguredCap = configuredCap > 0 ? Math.min(configuredCap, planHardCap) : planHardCap;
    const sessionQaTotalCap = (0, utils_1.asNonNegativeNumber)(sessionData.qa_total_scan_cap, 0);
    const maxEmailsForUser = sessionQaTotalCap > 0
        ? Math.min(normalizedConfiguredCap, sessionQaTotalCap)
        : normalizedConfiguredCap;
    while (processedInRun < options.maxEmailsToProcess && Date.now() - started < options.hardDeadlineMs) {
        if (counters.total_emails_scanned >= maxEmailsForUser)
            break;
        const remaining = options.maxEmailsToProcess - processedInRun;
        const listUrl = new URL(`${GMAIL_API_BASE_URL}/messages`);
        if (useSearchQuery && query) {
            listUrl.searchParams.set("q", query);
        }
        listUrl.searchParams.set("maxResults", String(Math.min(scanBatchSize, remaining)));
        if (nextPageToken)
            listUrl.searchParams.set("pageToken", nextPageToken);
        const listResponse = await callGoogleJson(listUrl.toString(), accessToken);
        const messages = Array.isArray(listResponse.messages) ? listResponse.messages : [];
        if (messages.length === 0) {
            if (useSearchQuery &&
                !disableFallbackQuery &&
                !nextPageToken &&
                !fallbackQueryApplied &&
                fallbackQuery &&
                fallbackQuery !== query &&
                counters.total_emails_scanned === 0 &&
                processedInRun === 0) {
                query = fallbackQuery;
                fallbackQueryApplied = true;
                await sessionRef.set({
                    query,
                    fallback_query_applied: true,
                    updated_at: (0, utils_1.getNowIso)(),
                }, { merge: true });
                continue;
            }
            nextPageToken = "";
            break;
        }
        for (const message of messages) {
            if (processedInRun >= options.maxEmailsToProcess)
                break;
            if (Date.now() - started >= options.hardDeadlineMs)
                break;
            if (counters.total_emails_scanned >= maxEmailsForUser)
                break;
            const messageId = (0, utils_1.asString)(message.id);
            if (!messageId)
                continue;
            counters.total_emails_scanned += 1;
            processedInRun += 1;
            try {
                const detailBaseUrl = `${GMAIL_API_BASE_URL}/messages/${encodeURIComponent(messageId)}`;
                const detailUrl = new URL(detailBaseUrl);
                detailUrl.searchParams.set("format", "full");
                const detail = await callGoogleJson(detailUrl.toString(), accessToken);
                const payload = detail.payload;
                const fromEmail = (0, emailParsing_1.getHeader)(payload, "From");
                const subject = (0, emailParsing_1.getHeader)(payload, "Subject") || (0, utils_1.asString)(detail.snippet).slice(0, 120);
                const bodyText = (0, emailParsing_1.extractBodyText)(payload) || (0, utils_1.asString)(detail.snippet);
                const dateIso = (0, utils_1.parseGmailDate)((0, utils_1.asString)((0, emailParsing_1.getHeader)(payload, "Date")) || new Date(Number(detail.internalDate || Date.now())).toISOString());
                const messageDate = (0, utils_1.parseIsoDate)(dateIso);
                if (messageDate && lookbackBefore && messageDate.getTime() > lookbackBefore.getTime()) {
                    continue;
                }
                if (messageDate && lookbackAfter && messageDate.getTime() < lookbackAfter.getTime()) {
                    if (!useSearchQuery) {
                        stopByLookbackFloor = true;
                        break;
                    }
                    continue;
                }
                const { attachmentMetadata, imageCount } = await (0, emailParsing_1.fetchAttachmentMetadata)({
                    payload,
                });
                const attachmentCount = attachmentMetadata.length;
                if (attachmentCount > 0)
                    counters.emails_with_attachments += 1;
                if (imageCount > 0)
                    counters.emails_with_images += 1;
                const isCandidate = (0, petMatching_1.isCandidateClinicalEmail)({
                    subject,
                    fromEmail,
                    bodyText,
                    attachmentCount,
                    attachmentMetadata,
                    petName: (0, utils_1.asString)(planAndPet.petContext.name),
                    petId: planAndPet.petId || "",
                });
                if (!isCandidate)
                    continue;
                counters.candidate_emails_detected += 1;
                const rawBase = [
                    (0, utils_1.normalizeForHash)(bodyText).slice(0, 100000),
                    (0, utils_1.normalizeForHash)(subject),
                    (0, utils_1.normalizeForHash)(fromEmail),
                    (0, utils_1.normalizeForHash)(attachmentMetadata.map((row) => row.filename).join("|")),
                    (0, utils_1.normalizeForHash)(dateIso),
                ].join("|");
                const hashSignatureRaw = (0, utils_1.sha256)(rawBase);
                const normalized = (0, utils_1.normalizeForHash)(bodyText);
                const applyHashDedup = (normalized.length >= 40 || attachmentCount > 0) && !dedupDisabled;
                if (applyHashDedup) {
                    const hashDocId = `${uid}_${hashSignatureRaw}`;
                    const hashRef = admin.firestore().collection("gmail_document_hashes").doc(hashDocId);
                    const hashSnap = await hashRef.get();
                    if (hashSnap.exists) {
                        const hashData = (0, utils_1.asRecord)(hashSnap.data());
                        const lastSeen = (0, utils_1.parseIsoDate)(hashData.last_seen_at);
                        if (lastSeen && Date.now() - lastSeen.getTime() <= DEDUP_WINDOW_DAYS * ONE_DAY_MS) {
                            counters.duplicates_removed += 1;
                            continue;
                        }
                    }
                    await hashRef.set({
                        user_id: uid,
                        hash_signature: hashSignatureRaw,
                        first_seen_at: hashSnap.exists ? (0, utils_1.asString)((0, utils_1.asRecord)(hashSnap.data()).first_seen_at) || (0, utils_1.getNowIso)() : (0, utils_1.getNowIso)(),
                        last_seen_at: (0, utils_1.getNowIso)(),
                    }, { merge: true });
                }
                const rawDocument = {
                    source: "email",
                    message_id: messageId,
                    thread_id: (0, utils_1.asString)(detail.threadId),
                    email_date: dateIso,
                    body_text: bodyText,
                    attachment_meta: (0, jobProcessing_1.sanitizeAttachmentMetadataForFirestore)(attachmentMetadata),
                    hash_signature_raw: hashSignatureRaw,
                };
                const tmpDocId = await (0, jobProcessing_1.persistTemporaryRawDocument)({
                    uid,
                    sessionId,
                    rawDocument,
                    sourceSender: fromEmail,
                    sourceSubject: subject,
                });
                await (0, sessionQueue_1.enqueueStageJob)({
                    stage: "ai_extract",
                    sessionId,
                    uid,
                    payload: {
                        message_id: messageId,
                        raw_doc_id: tmpDocId,
                        source_sender: fromEmail,
                        source_subject: subject,
                        mode: "classify",
                    },
                });
                await admin.firestore().collection("gmail_ingestion_documents").doc(`${sessionId}_${messageId}`).set({
                    session_id: sessionId,
                    user_id: uid,
                    message_id: messageId,
                    thread_id: rawDocument.thread_id,
                    email_date: rawDocument.email_date,
                    from_email: fromEmail,
                    subject: subject.slice(0, 400),
                    attachment_count: attachmentCount,
                    attachment_metadata: (0, jobProcessing_1.sanitizeAttachmentMetadataForFirestore)(attachmentMetadata),
                    hash_signature_raw: rawDocument.hash_signature_raw,
                    processing_status: "queued_classification",
                    created_at: (0, utils_1.getNowIso)(),
                }, { merge: true });
            }
            catch (error) {
                counters.errors_count += 1;
                await (0, sessionQueue_1.incrementSessionCounters)(sessionId, { errors_count: 1 });
                await admin.firestore().collection("gmail_ingestion_errors").add({
                    session_id: sessionId,
                    user_id: uid,
                    message_id: messageId,
                    error: String(error),
                    created_at: (0, utils_1.getNowIso)(),
                });
            }
            processedSinceFlush += 1;
            if (processedSinceFlush >= 5) {
                const scanCountersPatch = toFirestoreCounterFields(buildScanCountersPatch(counters));
                await sessionRef.update(Object.assign({ updated_at: (0, utils_1.getNowIso)() }, scanCountersPatch));
                processedSinceFlush = 0;
            }
        }
        if (stopByLookbackFloor) {
            nextPageToken = "";
            break;
        }
        nextPageToken = (0, utils_1.asString)(listResponse.nextPageToken);
        if (!nextPageToken) {
            if (useSearchQuery &&
                !disableFallbackQuery &&
                !fallbackQueryApplied &&
                fallbackQuery &&
                fallbackQuery !== query &&
                counters.total_emails_scanned <= LOW_RESULT_FALLBACK_MAX_SCANNED &&
                counters.candidate_emails_detected <= LOW_RESULT_FALLBACK_MAX_CANDIDATES &&
                processedInRun < options.maxEmailsToProcess &&
                Date.now() - started < options.hardDeadlineMs) {
                query = fallbackQuery;
                fallbackQueryApplied = true;
                await sessionRef.set({
                    query,
                    fallback_query_applied: true,
                    fallback_reason: "low_result_set",
                    updated_at: (0, utils_1.getNowIso)(),
                }, { merge: true });
                continue;
            }
            break;
        }
    }
    const reachedSyncCap = counters.total_emails_scanned >= maxEmailsForUser;
    const scanComplete = !nextPageToken || reachedSyncCap;
    await sessionRef.update(Object.assign({ status: scanComplete ? "processing" : "queued", query, fallback_query_applied: fallbackQueryApplied, qa_disable_dedup: dedupDisabled, effective_scan_cap: maxEmailsForUser, next_page_token: nextPageToken || null, scan_complete: scanComplete, updated_at: (0, utils_1.getNowIso)() }, toFirestoreCounterFields(buildScanCountersPatch(counters))));
    await (0, sessionQueue_1.recordSessionStageMetric)({
        sessionId,
        stageKey: "scan",
        durationMs: Date.now() - scanStageStarted,
    });
    await admin.firestore().collection("user_email_config").doc(uid).set({
        ingestion_status: scanComplete ? "analyzing_documents" : "scanning_emails",
        sync_status: scanComplete ? "analyzing_documents" : "scanning_emails",
        updated_at: (0, utils_1.getNowIso)(),
        total_emails_scanned: counters.total_emails_scanned,
        clinical_candidates_detected: counters.candidate_emails_detected,
        duplicates_removed: counters.duplicates_removed,
    }, { merge: true });
    if (scanComplete) {
        await (0, sessionQueue_1.maybeFinalizeSession)(sessionId);
    }
    else {
        await (0, sessionQueue_1.ensurePendingScanJob)(sessionId, uid);
    }
}
async function initializeEmailIngestionAfterOauth(args) {
    const profile = await fetchGmailProfile(args.accessToken);
    const config = await createOrUpdateUserEmailConfig({
        uid: args.uid,
        gmailAccount: args.accountEmail || profile.email,
        preferredPetId: args.preferredPetId,
        lastHistoryId: profile.historyId,
        ingestionStatus: "scanning_emails",
    });
    const sessionId = await (0, sessionQueue_1.createIngestionSession)({ uid: args.uid, config, preferredPetId: args.preferredPetId });
    await (0, sessionQueue_1.ensurePendingScanJob)(sessionId, args.uid);
    return { config, sessionId };
}
exports.triggerEmailClinicalIngestion = functions
    .runWith({
    timeoutSeconds: 120,
    memory: "512MB",
    secrets: ["GMAIL_OAUTH_CLIENT_ID", "GMAIL_OAUTH_CLIENT_SECRET", "MAIL_TOKEN_ENCRYPTION_KEY", "GEMINI_API_KEY"],
})
    .region("us-central1")
    .https.onCall(async (data, context) => {
    var _a;
    if (!((_a = context.auth) === null || _a === void 0 ? void 0 : _a.uid)) {
        throw new functions.https.HttpsError("unauthenticated", "Debes iniciar sesión.");
    }
    const uid = context.auth.uid;
    await (0, invitation_1.assertGmailInvitationOrThrow)(uid);
    const preferredPetId = (0, utils_1.asString)(data === null || data === void 0 ? void 0 : data.petId) || null;
    const token = await fetchUserRefreshToken(uid).catch(() => null);
    if (!token) {
        throw new functions.https.HttpsError("failed-precondition", "No hay Gmail conectado para este usuario.");
    }
    const clientId = (0, utils_1.asString)(process.env.GMAIL_OAUTH_CLIENT_ID);
    const clientSecret = (0, utils_1.asString)(process.env.GMAIL_OAUTH_CLIENT_SECRET);
    if (!clientId || !clientSecret) {
        throw new functions.https.HttpsError("failed-precondition", "Credenciales OAuth de Gmail no configuradas.");
    }
    const accessToken = await exchangeRefreshToken({
        refreshToken: token.refreshToken,
        clientId,
        clientSecret,
    });
    const profile = await fetchGmailProfile(accessToken);
    const bootstrap = await initializeEmailIngestionAfterOauth({
        uid,
        accountEmail: profile.email,
        accessToken,
        preferredPetId,
    });
    await (0, sessionQueue_1.ensurePendingScanJob)(bootstrap.sessionId, uid);
    return {
        ok: true,
        session_id: bootstrap.sessionId,
        status: "scanning_emails",
        message: "Sincronización iniciada. Te avisaremos cuando finalice.",
    };
});
exports.runEmailClinicalIngestionQueue = functions
    .runWith({
    timeoutSeconds: 540,
    memory: "1GB",
    secrets: ["GMAIL_OAUTH_CLIENT_ID", "GMAIL_OAUTH_CLIENT_SECRET", "MAIL_TOKEN_ENCRYPTION_KEY", "GEMINI_API_KEY"],
})
    .region("us-central1")
    .pubsub.schedule("every 15 minutes")
    .timeZone("America/Argentina/Buenos_Aires")
    .onRun(async () => {
    const now = Date.now();
    const retentionCutoff = new Date(now - SESSION_AUDIT_RETENTION_DAYS * ONE_DAY_MS).toISOString();
    const staleSessions = await admin
        .firestore()
        .collection("gmail_ingestion_sessions")
        .where("updated_at", "<", retentionCutoff)
        .limit(30)
        .get();
    await Promise.all(staleSessions.docs.map((doc) => doc.ref.delete().catch(() => undefined)));
    await (0, jobProcessing_1.purgeExpiredRawDocuments)(120);
    const activeSessions = await admin
        .firestore()
        .collection("gmail_ingestion_sessions")
        .where("status", "in", ["queued", "processing"])
        .limit((0, envConfig_1.getMaxConcurrentExtractionJobs)())
        .get();
    for (const sessionDoc of activeSessions.docs) {
        const sessionData = (0, utils_1.asRecord)(sessionDoc.data());
        const uid = (0, utils_1.asString)(sessionData.user_id);
        if (!uid)
            continue;
        await (0, sessionQueue_1.ensurePendingScanJob)(sessionDoc.id, uid);
        await (0, sessionQueue_1.maybeFinalizeSession)(sessionDoc.id);
        const refreshedSession = await sessionDoc.ref.get();
        if (!refreshedSession.exists)
            continue;
        const refreshedData = (0, utils_1.asRecord)(refreshedSession.data());
        const refreshedStatus = (0, utils_1.asString)(refreshedData.status);
        if (refreshedStatus !== "queued" && refreshedStatus !== "processing")
            continue;
        const updatedAt = (0, utils_1.parseIsoDate)(refreshedData.updated_at) || (0, utils_1.parseIsoDate)(refreshedData.created_at);
        if (!updatedAt)
            continue;
        const staleMs = now - updatedAt.getTime();
        if (staleMs < STALE_ACTIVE_SESSION_MS)
            continue;
        const pendingJobs = await countPendingJobsForSession(sessionDoc.id);
        if (pendingJobs.total > 0)
            continue;
        await (0, sessionQueue_1.closeStuckSessionAsPartial)({
            sessionId: sessionDoc.id,
            uid,
            sessionData: refreshedData,
            pendingJobs,
            reason: "watchdog_timeout_no_pending_jobs",
        });
    }
    return null;
});
async function runStageWorkers(args) {
    const jobs = await (0, sessionQueue_1.pickPendingJobs)({ stage: args.stage, limit: args.limit });
    for (const job of jobs) {
        const jobData = (0, utils_1.asRecord)(job.data());
        const attempts = (0, utils_1.asNonNegativeNumber)(jobData.attempts, 0);
        const uid = (0, utils_1.asString)(jobData.user_id);
        const lockOwner = `${args.lockPrefix}:${job.id}`;
        if (!uid) {
            await job.ref.set({
                status: "failed",
                updated_at: (0, utils_1.getNowIso)(),
                completed_at: (0, utils_1.getNowIso)(),
                error: "invalid_job_missing_user_id",
            }, { merge: true });
            const sessionId = (0, utils_1.asString)(jobData.session_id);
            if (sessionId) {
                await (0, sessionQueue_1.incrementSessionCounters)(sessionId, { errors_count: 1 });
            }
            continue;
        }
        const lock = await (0, sessionQueue_1.acquireUserIngestionLock)(uid, lockOwner);
        if (!lock) {
            await job.ref.set({
                available_at: new Date(Date.now() + 20000).toISOString(),
                updated_at: (0, utils_1.getNowIso)(),
            }, { merge: true });
            continue;
        }
        await (0, sessionQueue_1.markJobProcessing)(job.ref, attempts);
        try {
            await args.handler(job);
        }
        catch (error) {
            await (0, sessionQueue_1.markJobFailed)(job.ref, attempts, error);
            const sessionId = (0, utils_1.asString)(jobData.session_id);
            if (sessionId) {
                await (0, sessionQueue_1.incrementSessionCounters)(sessionId, { errors_count: 1 });
            }
        }
        finally {
            await (0, sessionQueue_1.releaseUserIngestionLock)(uid, lockOwner);
        }
    }
}
async function pickPendingJobsForSession(args) {
    const collectionName = (0, sessionQueue_1.queueCollectionForStage)(args.stage);
    const nowIso = (0, utils_1.getNowIso)();
    const nowMs = Date.now();
    const snap = await admin
        .firestore()
        .collection(collectionName)
        .where("session_id", "==", args.sessionId)
        .limit(Math.max(args.limit * STALE_PROCESSING_SCAN_FACTOR, args.limit))
        .get();
    const staleDocs = snap.docs.filter((doc) => {
        const row = (0, utils_1.asRecord)(doc.data());
        if ((0, utils_1.asString)(row.status) !== "processing")
            return false;
        const updatedAt = (0, utils_1.parseIsoDate)(row.updated_at) || (0, utils_1.parseIsoDate)(row.created_at);
        if (!updatedAt)
            return false;
        return nowMs - updatedAt.getTime() >= STALE_PROCESSING_JOB_MS;
    });
    if (staleDocs.length > 0) {
        await Promise.all(staleDocs.map((doc) => doc.ref.set({
            status: "pending",
            available_at: nowIso,
            updated_at: nowIso,
            error: "stale_processing_requeued",
        }, { merge: true })));
    }
    return snap.docs
        .filter((doc) => {
        const row = (0, utils_1.asRecord)(doc.data());
        const status = (0, utils_1.asString)(row.status);
        if (status !== "pending")
            return false;
        const availableAt = (0, utils_1.parseIsoDate)(row.available_at);
        return !availableAt || availableAt.getTime() <= nowMs;
    })
        .sort((a, b) => {
        const aDate = (0, utils_1.parseIsoDate)((0, utils_1.asRecord)(a.data()).available_at);
        const bDate = (0, utils_1.parseIsoDate)((0, utils_1.asRecord)(b.data()).available_at);
        return ((aDate === null || aDate === void 0 ? void 0 : aDate.getTime()) || 0) - ((bDate === null || bDate === void 0 ? void 0 : bDate.getTime()) || 0);
    })
        .slice(0, args.limit);
}
async function runSessionStageWorkers(args) {
    const jobs = await pickPendingJobsForSession({
        stage: args.stage,
        sessionId: args.sessionId,
        limit: args.limit,
    });
    let processed = 0;
    for (const job of jobs) {
        const jobData = (0, utils_1.asRecord)(job.data());
        const attempts = (0, utils_1.asNonNegativeNumber)(jobData.attempts, 0);
        const uid = (0, utils_1.asString)(jobData.user_id);
        const lockOwner = `${args.lockPrefix}:${job.id}`;
        if (!uid) {
            await job.ref.set({
                status: "failed",
                updated_at: (0, utils_1.getNowIso)(),
                completed_at: (0, utils_1.getNowIso)(),
                error: "invalid_job_missing_user_id",
            }, { merge: true });
            const sessionId = (0, utils_1.asString)(jobData.session_id);
            if (sessionId) {
                await (0, sessionQueue_1.incrementSessionCounters)(sessionId, { errors_count: 1 });
            }
            processed += 1;
            continue;
        }
        const lock = await (0, sessionQueue_1.acquireUserIngestionLock)(uid, lockOwner);
        if (!lock) {
            await job.ref.set({
                available_at: new Date(Date.now() + 20000).toISOString(),
                updated_at: (0, utils_1.getNowIso)(),
            }, { merge: true });
            continue;
        }
        await (0, sessionQueue_1.markJobProcessing)(job.ref, attempts);
        try {
            await args.handler(job);
        }
        catch (error) {
            await (0, sessionQueue_1.markJobFailed)(job.ref, attempts, error);
            const sessionId = (0, utils_1.asString)(jobData.session_id);
            if (sessionId) {
                await (0, sessionQueue_1.incrementSessionCounters)(sessionId, { errors_count: 1 });
            }
        }
        finally {
            await (0, sessionQueue_1.releaseUserIngestionLock)(uid, lockOwner);
        }
        processed += 1;
    }
    return processed;
}
async function countPendingJobsForSession(sessionId) {
    const countForStage = async (stage) => {
        const snap = await admin
            .firestore()
            .collection((0, sessionQueue_1.queueCollectionForStage)(stage))
            .where("session_id", "==", sessionId)
            .limit(400)
            .get();
        return snap.docs.filter((doc) => {
            const row = (0, utils_1.asRecord)(doc.data());
            const status = (0, utils_1.asString)(row.status);
            return status === "pending" || status === "processing";
        }).length;
    };
    const [scan, ai_extract, attachment] = await Promise.all([
        countForStage("scan"),
        countForStage("ai_extract"),
        countForStage("attachment"),
    ]);
    return {
        scan,
        ai_extract,
        attachment,
        total: scan + ai_extract + attachment,
    };
}
async function drainSessionQueues(args) {
    const deadline = Date.now() + args.maxWaitMs;
    const sessionRef = admin.firestore().collection("gmail_ingestion_sessions").doc(args.sessionId);
    while (Date.now() < deadline) {
        // Run sequentially to avoid lock contention for the same uid inside a force-run.
        const scanHandled = await runSessionStageWorkers({
            stage: "scan",
            sessionId: args.sessionId,
            limit: FORCE_DRAIN_MAX_JOBS_PER_STAGE,
            lockPrefix: "scan",
            handler: processScanQueueJob,
        });
        const attachmentHandled = await runSessionStageWorkers({
            stage: "attachment",
            sessionId: args.sessionId,
            limit: FORCE_DRAIN_MAX_JOBS_PER_STAGE,
            lockPrefix: "attachment",
            handler: processAttachmentQueueJob,
        });
        // Correr AI una sola vez DESPUÉS de attachment para procesar todos los jobs encolados.
        // Eliminada la segunda llamada redundante que desperdiciaba cuota de AI.
        const aiHandledAfterAttachment = await runSessionStageWorkers({
            stage: "ai_extract",
            sessionId: args.sessionId,
            limit: FORCE_DRAIN_MAX_JOBS_PER_STAGE,
            lockPrefix: "ai",
            handler: processAiQueueJob,
        });
        await (0, sessionQueue_1.maybeFinalizeSession)(args.sessionId);
        const [pending, sessionSnap] = await Promise.all([
            countPendingJobsForSession(args.sessionId),
            sessionRef.get(),
        ]);
        const sessionData = (0, utils_1.asRecord)(sessionSnap.data());
        const sessionStatus = (0, utils_1.asString)(sessionData.status);
        if ((sessionStatus === "completed" || sessionStatus === "failed") && pending.total === 0) {
            return;
        }
        const handledThisTick = scanHandled + attachmentHandled + aiHandledAfterAttachment;
        if (pending.total === 0 && handledThisTick === 0) {
            return;
        }
        await new Promise((resolve) => setTimeout(resolve, FORCE_DRAIN_POLL_MS));
    }
}
exports.runEmailClinicalScanWorker = functions
    .runWith({
    timeoutSeconds: 540,
    memory: "1GB",
    secrets: ["GMAIL_OAUTH_CLIENT_ID", "GMAIL_OAUTH_CLIENT_SECRET", "MAIL_TOKEN_ENCRYPTION_KEY", "GEMINI_API_KEY"],
})
    .region("us-central1")
    .pubsub.schedule("every 15 minutes")
    .timeZone("America/Argentina/Buenos_Aires")
    .onRun(async () => {
    await runStageWorkers({
        stage: "scan",
        limit: (0, envConfig_1.getScanWorkersPerTick)(),
        lockPrefix: "scan",
        handler: processScanQueueJob,
    });
    return null;
});
exports.runEmailClinicalAttachmentWorker = functions
    .runWith({
    timeoutSeconds: 540,
    memory: "1GB",
    secrets: ["GMAIL_OAUTH_CLIENT_ID", "GMAIL_OAUTH_CLIENT_SECRET", "MAIL_TOKEN_ENCRYPTION_KEY", "GEMINI_API_KEY"],
})
    .region("us-central1")
    .pubsub.schedule("every 15 minutes")
    .timeZone("America/Argentina/Buenos_Aires")
    .onRun(async () => {
    await runStageWorkers({
        stage: "attachment",
        limit: (0, envConfig_1.getAttachmentWorkersPerTick)(),
        lockPrefix: "attachment",
        handler: processAttachmentQueueJob,
    });
    return null;
});
exports.runEmailClinicalAiWorker = functions
    .runWith({
    timeoutSeconds: 540,
    memory: "1GB",
    secrets: ["GMAIL_OAUTH_CLIENT_ID", "GMAIL_OAUTH_CLIENT_SECRET", "MAIL_TOKEN_ENCRYPTION_KEY", "GEMINI_API_KEY"],
})
    .region("us-central1")
    .pubsub.schedule("every 15 minutes")
    .timeZone("America/Argentina/Buenos_Aires")
    .onRun(async () => {
    await runStageWorkers({
        stage: "ai_extract",
        limit: (0, envConfig_1.getAiWorkersPerTick)(),
        lockPrefix: "ai",
        handler: processAiQueueJob,
    });
    return null;
});
exports.forceRunEmailClinicalIngestion = functions
    .runWith({
    timeoutSeconds: 540,
    memory: "1GB",
    secrets: [
        "GMAIL_OAUTH_CLIENT_ID",
        "GMAIL_OAUTH_CLIENT_SECRET",
        "MAIL_TOKEN_ENCRYPTION_KEY",
        "GEMINI_API_KEY",
        "GMAIL_FORCE_SYNC_KEY",
    ],
})
    .region("us-central1")
    .https.onRequest(async (req, res) => {
    var _a;
    if (req.method !== "POST") {
        res.status(405).json({ ok: false, error: "method_not_allowed" });
        return;
    }
    const configuredKey = (0, utils_1.asString)(process.env.GMAIL_FORCE_SYNC_KEY);
    const incomingHeader = (0, utils_1.asString)(req.headers["x-force-sync-key"]);
    const authHeader = (0, utils_1.asString)(req.headers.authorization).replace(/^Bearer\s+/i, "");
    const incomingKey = incomingHeader || authHeader;
    if (!configuredKey || !incomingKey || incomingKey !== configuredKey) {
        res.status(401).json({ ok: false, error: "unauthorized" });
        return;
    }
    const body = (0, utils_1.asRecord)(req.body);
    if (body.listConnected === true) {
        const tokenDocs = await admin.firestore().collectionGroup("mail_sync_tokens").limit(100).get();
        const connected = [];
        for (const doc of tokenDocs.docs) {
            if (doc.id !== "gmail")
                continue;
            const uid = ((_a = doc.ref.parent.parent) === null || _a === void 0 ? void 0 : _a.id) || "";
            if (!uid)
                continue;
            const userSnap = await admin.firestore().collection("users").doc(uid).get();
            const userData = (0, utils_1.asRecord)(userSnap.data());
            const email = (0, utils_1.asString)(userData.email) || null;
            if (!email && (0, envConfig_1.getQaAllowedUserEmails)().length > 0)
                continue;
            if (email && !(0, envConfig_1.isEmailAllowedForQa)(email))
                continue;
            connected.push({
                uid,
                email,
                fullName: (0, utils_1.asString)(userData.fullName) || (0, utils_1.asString)(userData.name) || null,
                gmailAccount: (0, utils_1.asString)((0, utils_1.asRecord)(userData.gmailSync).accountEmail) || null,
            });
        }
        res.status(200).json({ ok: true, connected });
        return;
    }
    const byUid = (0, utils_1.asString)(body.uid);
    const byEmail = (0, utils_1.asString)(body.email).toLowerCase();
    const preferredPetId = (0, utils_1.asString)(body.petId) || null;
    const planOverrideRaw = (0, utils_1.asString)(body.planOverride).toLowerCase();
    const planOverride = planOverrideRaw === "premium" || planOverrideRaw === "free"
        ? planOverrideRaw
        : null;
    const maxEmails = (0, utils_1.clamp)((0, utils_1.asNonNegativeNumber)(body.maxEmails, 50), 1, (0, envConfig_1.getPremiumPlanMaxEmailsPerSync)());
    const lookbackOverrideRaw = (0, utils_1.asNonNegativeNumber)(body.lookbackMonths, 0);
    const lookbackOverrideMonths = lookbackOverrideRaw > 0 ? (0, utils_1.clamp)(lookbackOverrideRaw, 1, 180) : null;
    const disableDedup = body.disableDedup === true;
    const disableFallbackQuery = body.disableFallbackQuery === true;
    const waitForCompletion = body.waitForCompletion !== false;
    const drainTimeoutMs = (0, utils_1.clamp)((0, utils_1.asNonNegativeNumber)(body.drainTimeoutMs, FORCE_DRAIN_MAX_WAIT_MS), 10000, 8 * 60 * 1000);
    const includeExtracted = body.includeExtracted === true;
    const debugLimit = (0, utils_1.clamp)((0, utils_1.asNonNegativeNumber)(body.debugLimit, 5), 1, 20);
    let uid = byUid;
    if (!uid && byEmail) {
        const userQuery = await admin
            .firestore()
            .collection("users")
            .where("email", "==", byEmail)
            .limit(1)
            .get();
        if (!userQuery.empty) {
            uid = userQuery.docs[0].id;
        }
    }
    if (!uid) {
        res.status(404).json({ ok: false, error: "user_not_found" });
        return;
    }
    const targetUserSnap = await admin.firestore().collection("users").doc(uid).get();
    const targetUserData = (0, utils_1.asRecord)(targetUserSnap.data());
    const targetEmail = (0, utils_1.asString)(targetUserData.email) || byEmail;
    if (!(0, envConfig_1.isEmailAllowedForQa)(targetEmail)) {
        res.status(403).json({ ok: false, error: "qa_user_not_allowed" });
        return;
    }
    if (planOverride) {
        await admin
            .firestore()
            .collection("email_sync_plan_overrides")
            .doc(uid)
            .set({
            plan_type: planOverride,
            updated_at: (0, utils_1.getNowIso)(),
            source: "force_run_api",
        }, { merge: true });
    }
    const token = await fetchUserRefreshToken(uid).catch(() => null);
    if (!token) {
        res.status(412).json({ ok: false, error: "gmail_not_connected" });
        return;
    }
    const clientId = (0, utils_1.asString)(process.env.GMAIL_OAUTH_CLIENT_ID);
    const clientSecret = (0, utils_1.asString)(process.env.GMAIL_OAUTH_CLIENT_SECRET);
    if (!clientId || !clientSecret) {
        res.status(500).json({ ok: false, error: "oauth_credentials_missing" });
        return;
    }
    const accessToken = await exchangeRefreshToken({
        refreshToken: token.refreshToken,
        clientId,
        clientSecret,
    });
    const profile = await fetchGmailProfile(accessToken);
    const bootstrap = await initializeEmailIngestionAfterOauth({
        uid,
        accountEmail: profile.email || byEmail || null,
        accessToken,
        preferredPetId,
    });
    await admin
        .firestore()
        .collection("gmail_ingestion_sessions")
        .doc(bootstrap.sessionId)
        .set({
        qa_disable_dedup: disableDedup,
        qa_disable_fallback_query: disableFallbackQuery,
        qa_total_scan_cap: maxEmails,
        max_mails_per_sync: maxEmails,
        updated_at: (0, utils_1.getNowIso)(),
    }, { merge: true });
    if (lookbackOverrideMonths) {
        const { afterDate, beforeDate } = (0, sessionQueue_1.buildSessionDateWindow)(lookbackOverrideMonths);
        const forcedQuery = (0, sessionQueue_1.buildGmailSearchQuery)({
            afterDate,
            beforeDate,
            petName: bootstrap.config.pet_name,
            petId: bootstrap.config.pet_id,
        });
        const fallbackQuery = (0, sessionQueue_1.buildGmailSearchQuery)({
            afterDate,
            beforeDate,
            petName: null,
            petId: null,
        });
        await admin
            .firestore()
            .collection("gmail_ingestion_sessions")
            .doc(bootstrap.sessionId)
            .set({
            query: forcedQuery,
            fallback_query: fallbackQuery,
            fallback_query_applied: false,
            lookback_after: (0, utils_1.toIsoDateOnly)(afterDate),
            lookback_before: (0, utils_1.toIsoDateOnly)(beforeDate),
            updated_at: (0, utils_1.getNowIso)(),
        }, { merge: true });
    }
    await processSession(bootstrap.sessionId, {
        maxEmailsToProcess: maxEmails,
        hardDeadlineMs: 8 * 60 * 1000,
        disableDedup,
    });
    if (waitForCompletion) {
        await drainSessionQueues({
            sessionId: bootstrap.sessionId,
            maxWaitMs: drainTimeoutMs,
        });
    }
    const sessionSnap = await admin
        .firestore()
        .collection("gmail_ingestion_sessions")
        .doc(bootstrap.sessionId)
        .get();
    const sessionData = (0, utils_1.asRecord)(sessionSnap.data());
    const pendingJobs = await countPendingJobsForSession(bootstrap.sessionId);
    let debugExtraction = null;
    if (includeExtracted) {
        const docsSnap = await admin
            .firestore()
            .collection("gmail_ingestion_documents")
            .where("session_id", "==", bootstrap.sessionId)
            .limit(Math.max(debugLimit * 6, 30))
            .get();
        const docs = docsSnap.docs
            .map((doc) => {
            const row = (0, utils_1.asRecord)(doc.data());
            const status = (0, utils_1.asString)(row.processing_status);
            const aiClassification = (0, utils_1.asRecord)(row.ai_classification);
            const aiResult = (0, utils_1.asRecord)(row.ai_result);
            const linkExtraction = (0, utils_1.asRecord)(row.link_extraction);
            const linkRowsRaw = Array.isArray(linkExtraction.links) ? linkExtraction.links : [];
            const linkRows = linkRowsRaw.slice(0, 3).map((item) => {
                const record = (0, utils_1.asRecord)(item);
                return {
                    url: (0, utils_1.asString)(record.url),
                    status: (0, utils_1.asString)(record.status),
                    reason: (0, utils_1.asString)(record.reason),
                    host: (0, utils_1.asString)(record.host),
                    extracted_chars: (0, utils_1.asNonNegativeNumber)(record.extracted_chars, 0),
                    ocr_used: record.ocr_used === true,
                    redirect_count: (0, utils_1.asNonNegativeNumber)(record.redirect_count, 0),
                    login_required: record.login_required === true,
                };
            });
            const extractedEvents = Array.isArray(aiResult.detected_events) ? aiResult.detected_events : [];
            return {
                doc_id: doc.id,
                message_id: (0, utils_1.asString)(row.message_id),
                from_email: (0, utils_1.asString)(row.from_email),
                subject: (0, utils_1.asString)(row.subject),
                processing_status: status,
                classification: {
                    is_clinical: aiClassification.is_clinical === true,
                    confidence: (0, utils_1.asNonNegativeNumber)(aiClassification.confidence, 0),
                },
                extraction: {
                    is_clinical_content: aiResult.is_clinical_content === true,
                    confidence_overall: (0, utils_1.asNonNegativeNumber)(aiResult.confidence_overall, 0),
                    detected_events_count: extractedEvents.length,
                },
                link_extraction: {
                    links_detected: (0, utils_1.asNonNegativeNumber)(linkExtraction.links_detected, 0),
                    links_fetched: (0, utils_1.asNonNegativeNumber)(linkExtraction.links_fetched, 0),
                    links_with_text: (0, utils_1.asNonNegativeNumber)(linkExtraction.links_with_text, 0),
                    sample: linkRows,
                },
                created_at: (0, utils_1.asString)(row.created_at),
                updated_at: (0, utils_1.asString)(row.updated_at),
            };
        })
            .sort((a, b) => Date.parse(b.updated_at || b.created_at || "") - Date.parse(a.updated_at || a.created_at || ""));
        const selectedDocs = docs
            .filter((row) => row.processing_status !== "queued_classification" && row.processing_status !== "queued_attachment_ocr")
            .slice(0, debugLimit);
        const selectedMessageIds = new Set(selectedDocs.map((row) => row.message_id).filter(Boolean));
        const sessionMessageIds = new Set(docs.map((row) => row.message_id).filter(Boolean));
        const eventMessageIds = selectedMessageIds.size > 0 ? selectedMessageIds : sessionMessageIds;
        const reviewsSnap = await admin
            .firestore()
            .collection("gmail_event_reviews")
            .where("session_id", "==", bootstrap.sessionId)
            .limit(debugLimit)
            .get();
        const reviews = reviewsSnap.docs.map((doc) => {
            const row = (0, utils_1.asRecord)(doc.data());
            const event = (0, utils_1.asRecord)(row.event);
            const source = (0, utils_1.asRecord)(row.source_email);
            return {
                review_id: doc.id,
                status: (0, utils_1.asString)(row.status),
                reason: (0, utils_1.asString)(row.reason),
                confidence_overall: (0, utils_1.asNonNegativeNumber)(row.confidence_overall, 0),
                source_email_id: (0, utils_1.asString)(source.message_id),
                source_subject: (0, utils_1.asString)(source.subject),
                event_type: (0, utils_1.asString)(event.event_type),
                event_date: (0, utils_1.asString)(event.event_date),
                diagnosis: (0, utils_1.asString)(event.diagnosis),
                summary: (0, utils_1.asString)(event.description_summary).slice(0, 220),
            };
        });
        const eventsSnap = await admin
            .firestore()
            .collection("medical_events")
            .where("userId", "==", uid)
            .where("source", "==", "email_import")
            .limit(120)
            .get();
        const medicalEvents = eventsSnap.docs
            .map((doc) => {
            const row = (0, utils_1.asRecord)(doc.data());
            const extracted = (0, utils_1.asRecord)(row.extractedData);
            return {
                event_id: doc.id,
                title: (0, utils_1.asString)(row.title),
                source_email_id: (0, utils_1.asString)(row.source_email_id),
                status: (0, utils_1.asString)(row.status),
                workflow_status: (0, utils_1.asString)(row.workflowStatus),
                confidence: (0, utils_1.asNonNegativeNumber)(row.overallConfidence, 0),
                document_type: (0, utils_1.asString)(extracted.documentType),
                diagnosis: (0, utils_1.asString)(extracted.diagnosis),
                observations: (0, utils_1.asString)(extracted.observations).slice(0, 220),
                medications_count: Array.isArray(extracted.medications) ? extracted.medications.length : 0,
                created_at: (0, utils_1.asString)(row.createdAt),
            };
        })
            .filter((row) => eventMessageIds.size > 0 && eventMessageIds.has(row.source_email_id))
            .sort((a, b) => Date.parse(b.created_at || "") - Date.parse(a.created_at || ""))
            .slice(0, debugLimit);
        debugExtraction = {
            docs: selectedDocs,
            reviews,
            medical_events: medicalEvents,
        };
    }
    res.status(200).json({
        ok: true,
        uid,
        gmail_account: profile.email || bootstrap.config.gmail_account,
        plan_type: bootstrap.config.plan_type,
        session_id: bootstrap.sessionId,
        lookback_months_applied: lookbackOverrideMonths || bootstrap.config.max_lookback_months,
        dedup_disabled: disableDedup,
        wait_for_completion: waitForCompletion,
        pending_jobs: pendingJobs,
        status: (0, utils_1.asString)(sessionData.status) || "scanning_emails",
        counters: (0, utils_1.asRecord)(sessionData.counters),
        summary: (0, utils_1.asRecord)(sessionData.summary),
        debug_extraction: debugExtraction,
    });
});
exports.backfillGmailTaxonomy = functions
    .runWith({
    timeoutSeconds: 540,
    memory: "1GB",
    secrets: ["GMAIL_FORCE_SYNC_KEY"],
})
    .region("us-central1")
    .https.onRequest(async (req, res) => {
    if (req.method !== "POST") {
        res.status(405).json({ ok: false, error: "method_not_allowed" });
        return;
    }
    const configuredKey = (0, utils_1.asString)(process.env.GMAIL_FORCE_SYNC_KEY);
    const incomingHeader = (0, utils_1.asString)(req.headers["x-force-sync-key"]);
    const authHeader = (0, utils_1.asString)(req.headers.authorization).replace(/^Bearer\s+/i, "");
    const incomingKey = incomingHeader || authHeader;
    if (!configuredKey || !incomingKey || incomingKey !== configuredKey) {
        res.status(401).json({ ok: false, error: "unauthorized" });
        return;
    }
    const body = (0, utils_1.asRecord)(req.body);
    let uid = (0, utils_1.asString)(body.uid);
    const byEmail = (0, utils_1.asString)(body.email).toLowerCase();
    if (!uid && byEmail) {
        const userQuery = await admin.firestore().collection("users").where("email", "==", byEmail).limit(1).get();
        if (!userQuery.empty)
            uid = userQuery.docs[0].id;
    }
    if (!uid) {
        res.status(400).json({ ok: false, error: "uid_or_email_required" });
        return;
    }
    const userSnap = await admin.firestore().collection("users").doc(uid).get();
    const userData = (0, utils_1.asRecord)(userSnap.data());
    const targetEmail = (0, utils_1.asString)(userData.email) || byEmail;
    if (!targetEmail) {
        res.status(404).json({ ok: false, error: "user_email_not_found" });
        return;
    }
    if (!(0, envConfig_1.isEmailAllowedForQa)(targetEmail)) {
        res.status(403).json({ ok: false, error: "qa_user_not_allowed" });
        return;
    }
    try {
        const result = await runGmailTaxonomyBackfill({
            uid,
            email: targetEmail,
            dryRun: body.dryRun !== false,
            limit: (0, utils_1.asNonNegativeNumber)(body.limit, 150),
            includeAppointments: body.includeAppointments !== false,
        });
        res.status(200).json({
            ok: true,
            uid,
            email: targetEmail,
            dryRun: body.dryRun !== false,
            result,
        });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        res.status(500).json({ ok: false, error: message });
    }
});
exports.backfillNarrativeHistory = functions
    .runWith({
    timeoutSeconds: 540,
    memory: "1GB",
    secrets: ["GMAIL_FORCE_SYNC_KEY"],
})
    .region("us-central1")
    .https.onRequest(async (req, res) => {
    if (req.method !== "POST") {
        res.status(405).json({ ok: false, error: "method_not_allowed" });
        return;
    }
    const configuredKey = (0, utils_1.asString)(process.env.GMAIL_FORCE_SYNC_KEY);
    const incomingHeader = (0, utils_1.asString)(req.headers["x-force-sync-key"]);
    const authHeader = (0, utils_1.asString)(req.headers.authorization).replace(/^Bearer\s+/i, "");
    const incomingKey = incomingHeader || authHeader;
    if (!configuredKey || !incomingKey || incomingKey !== configuredKey) {
        res.status(401).json({ ok: false, error: "unauthorized" });
        return;
    }
    const body = (0, utils_1.asRecord)(req.body);
    let uid = (0, utils_1.asString)(body.uid);
    const byEmail = (0, utils_1.asString)(body.email).toLowerCase();
    if (!uid && byEmail) {
        const userQuery = await admin.firestore().collection("users").where("email", "==", byEmail).limit(1).get();
        if (!userQuery.empty)
            uid = userQuery.docs[0].id;
    }
    if (!uid) {
        res.status(400).json({ ok: false, error: "uid_or_email_required" });
        return;
    }
    const userSnap = await admin.firestore().collection("users").doc(uid).get();
    const userData = (0, utils_1.asRecord)(userSnap.data());
    const targetEmail = (0, utils_1.asString)(userData.email) || byEmail;
    if (!targetEmail) {
        res.status(404).json({ ok: false, error: "user_email_not_found" });
        return;
    }
    if (!(0, envConfig_1.isEmailAllowedForQa)(targetEmail)) {
        res.status(403).json({ ok: false, error: "qa_user_not_allowed" });
        return;
    }
    try {
        const result = await runNarrativeHistoryBackfill({
            uid,
            email: targetEmail,
            petId: (0, utils_1.asString)(body.petId) || null,
            dryRun: body.dryRun !== false,
            limit: (0, utils_1.asNonNegativeNumber)(body.limit, 250),
        });
        res.status(200).json({
            ok: true,
            uid,
            email: targetEmail,
            petId: (0, utils_1.asString)(body.petId) || null,
            dryRun: body.dryRun !== false,
            result,
        });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        res.status(500).json({ ok: false, error: message });
    }
});
exports.cleanupLegacyMailsyncMedicalEvents = functions
    .runWith({
    timeoutSeconds: 540,
    memory: "1GB",
    secrets: ["GMAIL_FORCE_SYNC_KEY"],
})
    .region("us-central1")
    .https.onRequest(async (req, res) => {
    if (req.method !== "POST") {
        res.status(405).json({ ok: false, error: "method_not_allowed" });
        return;
    }
    const configuredKey = (0, utils_1.asString)(process.env.GMAIL_FORCE_SYNC_KEY);
    const incomingHeader = (0, utils_1.asString)(req.headers["x-force-sync-key"]);
    const authHeader = (0, utils_1.asString)(req.headers.authorization).replace(/^Bearer\s+/i, "");
    const incomingKey = incomingHeader || authHeader;
    if (!configuredKey || !incomingKey || incomingKey !== configuredKey) {
        res.status(401).json({ ok: false, error: "unauthorized" });
        return;
    }
    const body = (0, utils_1.asRecord)(req.body);
    let uid = (0, utils_1.asString)(body.uid);
    const byEmail = (0, utils_1.asString)(body.email).toLowerCase();
    if (!uid && byEmail) {
        const userQuery = await admin.firestore().collection("users").where("email", "==", byEmail).limit(1).get();
        if (!userQuery.empty)
            uid = userQuery.docs[0].id;
    }
    if (!uid) {
        res.status(400).json({ ok: false, error: "uid_or_email_required" });
        return;
    }
    const userSnap = await admin.firestore().collection("users").doc(uid).get();
    const userData = (0, utils_1.asRecord)(userSnap.data());
    const targetEmail = (0, utils_1.asString)(userData.email) || byEmail;
    if (!targetEmail) {
        res.status(404).json({ ok: false, error: "user_email_not_found" });
        return;
    }
    if (!(0, envConfig_1.isEmailAllowedForQa)(targetEmail)) {
        res.status(403).json({ ok: false, error: "qa_user_not_allowed" });
        return;
    }
    try {
        const result = await runLegacyMailsyncCleanup({
            uid,
            email: targetEmail,
            petId: (0, utils_1.asString)(body.petId) || null,
            dryRun: body.dryRun !== false,
            limit: (0, utils_1.asNonNegativeNumber)(body.limit, 250),
            refreshNarrative: body.refreshNarrative !== false,
        });
        res.status(200).json({
            ok: true,
            uid,
            email: targetEmail,
            petId: (0, utils_1.asString)(body.petId) || null,
            dryRun: body.dryRun !== false,
            result,
        });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        res.status(500).json({ ok: false, error: message });
    }
});
exports.ingestClinicalEmailWebhook = functions
    .runWith({
    timeoutSeconds: 300,
    memory: "512MB",
    secrets: [
        "GMAIL_OAUTH_CLIENT_ID",
        "GMAIL_OAUTH_CLIENT_SECRET",
        "MAIL_TOKEN_ENCRYPTION_KEY",
        "GEMINI_API_KEY",
        "GMAIL_FORCE_SYNC_KEY",
    ],
})
    .region("us-central1")
    .https.onRequest(async (req, res) => {
    if (req.method !== "POST") {
        res.status(405).json({ ok: false, error: "method_not_allowed" });
        return;
    }
    const configuredKey = (0, utils_1.asString)(process.env.GMAIL_FORCE_SYNC_KEY);
    const incomingHeader = (0, utils_1.asString)(req.headers["x-webhook-key"]) || (0, utils_1.asString)(req.headers["x-force-sync-key"]);
    const authHeader = (0, utils_1.asString)(req.headers.authorization).replace(/^Bearer\s+/i, "");
    const incomingKey = incomingHeader || authHeader;
    if (!configuredKey || !incomingKey || incomingKey !== configuredKey) {
        res.status(401).json({ ok: false, error: "unauthorized" });
        return;
    }
    const body = (0, utils_1.asRecord)(req.body);
    const previewOnly = body.preview === true || body.dryRun === true;
    const forceIngest = body.force === true;
    const message = (0, utils_1.asRecord)(body.message);
    const fromEmail = (0, utils_1.asString)(message.from) || (0, utils_1.asString)(body.from);
    const subject = (0, utils_1.asString)(message.subject) || (0, utils_1.asString)(body.subject);
    const bodyText = (0, utils_1.asString)(message.text) ||
        (0, utils_1.asString)(message.body) ||
        (0, utils_1.asString)(body.bodyText) ||
        (0, utils_1.asString)(body.text) ||
        "";
    const attachmentMetadata = normalizeWebhookAttachmentMetadata(message.attachments || body.attachments || body.attachmentNames);
    let uid = (0, utils_1.asString)(body.uid);
    const byEmail = (0, utils_1.asString)(body.email).toLowerCase();
    const preferredPetId = (0, utils_1.asString)(body.petId) || null;
    if (!uid && byEmail) {
        const userQuery = await admin
            .firestore()
            .collection("users")
            .where("email", "==", byEmail)
            .limit(1)
            .get();
        if (!userQuery.empty)
            uid = userQuery.docs[0].id;
    }
    let petName = (0, utils_1.asString)(body.petName);
    let petId = preferredPetId || (0, utils_1.asString)(body.petId);
    let resolvedPlanAndPet = null;
    if (uid) {
        resolvedPlanAndPet = await resolvePlanAndPet({
            uid,
            preferredPetId,
            contextHints: {
                subjectText: subject,
                bodyText,
            },
        });
        petName = resolvedPlanAndPet.petName || petName;
        petId = resolvedPlanAndPet.petId || petId;
    }
    const candidate = (0, petMatching_1.isCandidateClinicalEmail)({
        subject,
        fromEmail,
        bodyText,
        attachmentCount: attachmentMetadata.length,
        attachmentMetadata,
        petName,
        petId,
    });
    const prefilter = {
        is_candidate: candidate,
        sender_trusted: (0, petMatching_1.isTrustedClinicalSender)(fromEmail),
        sender_blocked: (0, petMatching_1.isBlockedClinicalDomain)(fromEmail),
        clinical_attachment: (0, petMatching_1.attachmentNamesContainClinicalSignal)(attachmentMetadata),
        non_clinical_noise: (0, petMatching_1.hasStrongNonClinicalSignal)(`${subject}\n${fromEmail}\n${bodyText}`),
        human_healthcare_noise: (0, petMatching_1.hasStrongHumanHealthcareSignal)(`${subject}\n${fromEmail}\n${bodyText}`),
    };
    if (previewOnly) {
        res.status(200).json({
            ok: true,
            preview: true,
            prefilter,
            resolved_identity: {
                uid: uid || null,
                pet_id: petId || null,
                pet_name: petName || null,
                plan_type: (resolvedPlanAndPet === null || resolvedPlanAndPet === void 0 ? void 0 : resolvedPlanAndPet.planType) || null,
                pet_resolution: (resolvedPlanAndPet === null || resolvedPlanAndPet === void 0 ? void 0 : resolvedPlanAndPet.petResolutionDebug) || null,
            },
        });
        return;
    }
    if (!candidate && !forceIngest) {
        res.status(200).json({
            ok: true,
            ignored: true,
            reason: prefilter.human_healthcare_noise ? "ignored_human_content" : "prefilter_non_clinical",
            prefilter,
        });
        return;
    }
    if (!uid) {
        res.status(404).json({ ok: false, error: "user_not_found" });
        return;
    }
    const targetUserSnap = await admin.firestore().collection("users").doc(uid).get();
    const targetUserData = (0, utils_1.asRecord)(targetUserSnap.data());
    const targetEmail = (0, utils_1.asString)(targetUserData.email) || byEmail;
    if (!(0, envConfig_1.isEmailAllowedForQa)(targetEmail)) {
        res.status(403).json({ ok: false, error: "qa_user_not_allowed" });
        return;
    }
    const token = await fetchUserRefreshToken(uid).catch(() => null);
    if (!token) {
        res.status(412).json({ ok: false, error: "gmail_not_connected" });
        return;
    }
    const clientId = (0, utils_1.asString)(process.env.GMAIL_OAUTH_CLIENT_ID);
    const clientSecret = (0, utils_1.asString)(process.env.GMAIL_OAUTH_CLIENT_SECRET);
    if (!clientId || !clientSecret) {
        res.status(500).json({ ok: false, error: "oauth_credentials_missing" });
        return;
    }
    const accessToken = await exchangeRefreshToken({
        refreshToken: token.refreshToken,
        clientId,
        clientSecret,
    });
    const profile = await fetchGmailProfile(accessToken);
    const bootstrap = await initializeEmailIngestionAfterOauth({
        uid,
        accountEmail: profile.email || byEmail || null,
        accessToken,
        preferredPetId,
    });
    const maxEmails = (0, utils_1.clamp)((0, utils_1.asNonNegativeNumber)(body.maxEmails, 20), 1, (0, envConfig_1.getPremiumPlanMaxEmailsPerSync)());
    const lookbackMonths = (0, utils_1.clamp)((0, utils_1.asNonNegativeNumber)(body.lookbackMonths, 2), 1, 24);
    await admin
        .firestore()
        .collection("gmail_ingestion_sessions")
        .doc(bootstrap.sessionId)
        .set({
        qa_disable_fallback_query: true,
        qa_total_scan_cap: maxEmails,
        max_mails_per_sync: maxEmails,
        updated_at: (0, utils_1.getNowIso)(),
    }, { merge: true });
    const { afterDate, beforeDate } = (0, sessionQueue_1.buildSessionDateWindow)(lookbackMonths);
    const forcedQuery = (0, sessionQueue_1.buildGmailSearchQuery)({
        afterDate,
        beforeDate,
        petName: bootstrap.config.pet_name,
        petId: bootstrap.config.pet_id,
    });
    const fallbackQuery = (0, sessionQueue_1.buildGmailSearchQuery)({
        afterDate,
        beforeDate,
        petName: null,
        petId: null,
    });
    await admin
        .firestore()
        .collection("gmail_ingestion_sessions")
        .doc(bootstrap.sessionId)
        .set({
        query: forcedQuery,
        fallback_query: fallbackQuery,
        fallback_query_applied: false,
        lookback_after: (0, utils_1.toIsoDateOnly)(afterDate),
        lookback_before: (0, utils_1.toIsoDateOnly)(beforeDate),
        updated_at: (0, utils_1.getNowIso)(),
    }, { merge: true });
    await processSession(bootstrap.sessionId, {
        maxEmailsToProcess: maxEmails,
        hardDeadlineMs: 5 * 60 * 1000,
        disableDedup: false,
    });
    const sessionSnap = await admin
        .firestore()
        .collection("gmail_ingestion_sessions")
        .doc(bootstrap.sessionId)
        .get();
    const sessionData = (0, utils_1.asRecord)(sessionSnap.data());
    res.status(200).json({
        ok: true,
        uid,
        session_id: bootstrap.sessionId,
        status: (0, utils_1.asString)(sessionData.status) || "processing",
        counters: (0, utils_1.asRecord)(sessionData.counters),
        summary: (0, utils_1.asRecord)(sessionData.summary),
        prefilter,
    });
});
//# sourceMappingURL=clinicalIngestion.js.map