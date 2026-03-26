"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sanitizeGmailQueryTerm = sanitizeGmailQueryTerm;
exports.buildSessionDateWindow = buildSessionDateWindow;
exports.buildGmailSearchQuery = buildGmailSearchQuery;
exports.createIngestionSession = createIngestionSession;
exports.updateIngestionProgress = updateIngestionProgress;
exports.queueCollectionForStage = queueCollectionForStage;
exports.enqueueStageJob = enqueueStageJob;
exports.pickPendingJobs = pickPendingJobs;
exports.markJobProcessing = markJobProcessing;
exports.markJobCompleted = markJobCompleted;
exports.markJobFailed = markJobFailed;
exports.incrementSessionCounters = incrementSessionCounters;
exports.recordSessionStageMetric = recordSessionStageMetric;
exports.maybeFinalizeSession = maybeFinalizeSession;
exports.closeStuckSessionAsPartial = closeStuckSessionAsPartial;
exports.acquireUserIngestionLock = acquireUserIngestionLock;
exports.releaseUserIngestionLock = releaseUserIngestionLock;
exports.ensurePendingScanJob = ensurePendingScanJob;
const utils_1 = require("./utils");
const types_1 = require("./types");
const admin = require("firebase-admin");
const crypto_1 = require("crypto");
// ─── Gmail Search ────────────────────────────────────────────────
const GMAIL_MAX_QUERY_CHARS = 480;
const GMAIL_OPERATOR_PREFIXES = [
    "from:", "to:", "subject:", "has:", "in:", "is:", "label:", "filename:",
    "after:", "before:", "newer_than:", "older_than:", "larger:", "smaller:",
    "deliveredto:", "cc:", "bcc:", "rfc822msgid:",
];
/**
 * Sanitizes a user-supplied string so it is safe to embed inside a quoted
 * Gmail search term, e.g. `"<sanitized>"`.
 *
 * Removes:
 *  - double quotes (would break out of the phrase match)
 *  - grouping characters: ( ) { }
 *  - standalone boolean operators OR / AND (case-sensitive, whole-word)
 *  - known Gmail field-operator prefixes (from:, subject:, has:, …)
 */
function sanitizeGmailQueryTerm(term) {
    // Remove Gmail field-operator prefixes (case-insensitive for robustness)
    let sanitized = term;
    for (const prefix of GMAIL_OPERATOR_PREFIXES) {
        // Replace every occurrence, case-insensitively
        const regex = new RegExp(prefix.replace(":", "\\:"), "gi");
        sanitized = sanitized.replace(regex, "");
    }
    // Remove double quotes
    sanitized = sanitized.replace(/"/g, "");
    // Remove grouping characters
    sanitized = sanitized.replace(/[(){}]/g, "");
    // Remove standalone OR / AND (case-sensitive, surrounded by word boundaries)
    sanitized = sanitized.replace(/\bOR\b/g, "").replace(/\bAND\b/g, "");
    // Collapse multiple spaces left by removals
    sanitized = sanitized.replace(/\s{2,}/g, " ").trim();
    return sanitized;
}
function buildSessionDateWindow(maxLookbackMonths) {
    const beforeDate = new Date();
    const afterDate = new Date(beforeDate);
    afterDate.setUTCMonth(afterDate.getUTCMonth() - maxLookbackMonths);
    return { afterDate, beforeDate };
}
function buildGmailSearchQuery(args) {
    const clinicalTerms = [
        "veterinaria", "veterinario", "veterinary", "clinic", "clinica",
        "hospital veterinario", "turno veterinario", "diagnosis", "diagnostico",
        "diagnóstico", "vacuna", "vaccine", "tratamiento", "medicacion",
        "medicación", "receta", "prescription", "laboratorio", "lab",
        "ecografia", "ultrasound", "radiografia", "radiography",
        "electrocardiograma", "ecg",
    ]
        .map((term) => `"${term}"`)
        .join(" OR ");
    const filenameTerms = [
        "receta", "prescription", "laboratorio", "analisis", "informe",
        "radiografia", "ecografia", "ultrasound", "ecg",
    ]
        .map((term) => `filename:${term}`)
        .join(" OR ");
    const petFilters = [];
    const petName = sanitizeGmailQueryTerm((0, utils_1.asString)(args.petName));
    const petId = sanitizeGmailQueryTerm((0, utils_1.asString)(args.petId));
    if (petName)
        petFilters.push(`"${petName}"`);
    if (petId)
        petFilters.push(`"${petId}"`);
    const petClause = petFilters.length > 0 ? `(${petFilters.join(" OR ")})` : "";
    const senderHints = "(from:vet OR from:veterinaria OR from:veterinary OR from:clinic OR from:clinica)";
    const clinicalCore = `(${clinicalTerms} OR ${filenameTerms} OR ${senderHints})`;
    const queryCore = petClause ? `${petClause} AND ${clinicalCore}` : clinicalCore;
    const dateClause = `after:${(0, utils_1.toGmailDate)(args.afterDate)} before:${(0, utils_1.toGmailDate)(args.beforeDate)}`;
    const full = `${queryCore} ${dateClause}`;
    if (full.length <= GMAIL_MAX_QUERY_CHARS)
        return full;
    const minimal = `${clinicalCore} ${dateClause}`;
    if (minimal.length <= GMAIL_MAX_QUERY_CHARS)
        return minimal;
    return dateClause;
}
// ─── Session CRUD ────────────────────────────────────────────────
async function createIngestionSession(args) {
    const { afterDate, beforeDate } = buildSessionDateWindow(args.config.max_lookback_months);
    const preferredPetId = (0, utils_1.asString)(args.preferredPetId) || args.config.pet_id || args.config.fallback_pet_id || null;
    const preferredPetName = args.config.pet_name || args.config.fallback_pet_name || null;
    const query = buildGmailSearchQuery({ afterDate, beforeDate, petName: preferredPetName, petId: preferredPetId });
    const fallbackQuery = buildGmailSearchQuery({ afterDate, beforeDate, petName: null, petId: null });
    const nowIso = (0, utils_1.getNowIso)();
    const sessionId = (0, crypto_1.randomUUID)();
    await admin.firestore().collection("gmail_ingestion_sessions").doc(sessionId).set({
        session_id: sessionId,
        user_id: args.uid,
        pet_id: preferredPetId || null,
        pet_name: preferredPetName,
        fallback_pet_id: args.config.fallback_pet_id || null,
        fallback_pet_name: args.config.fallback_pet_name || null,
        active_pet_count: args.config.active_pet_count || 0,
        status: "queued",
        query,
        fallback_query: fallbackQuery,
        fallback_query_applied: false,
        next_page_token: null,
        started_at: nowIso,
        updated_at: nowIso,
        lookback_after: (0, utils_1.toIsoDateOnly)(afterDate),
        lookback_before: (0, utils_1.toIsoDateOnly)(beforeDate),
        max_mails_per_sync: args.config.max_mails_per_sync,
        counters: {
            total_emails_scanned: 0,
            candidate_emails_detected: 0,
            emails_with_attachments: 0,
            emails_with_images: 0,
            total_attachments_processed: 0,
            duplicates_removed: 0,
            new_medical_events_created: 0,
            events_requiring_review: 0,
            errors_count: 0,
        },
        summary: null,
    }, { merge: true });
    return sessionId;
}
async function updateIngestionProgress(uid, status) {
    const nowIso = (0, utils_1.getNowIso)();
    await admin.firestore().collection("user_email_config").doc(uid).set({ ingestion_status: status, sync_status: status, updated_at: nowIso }, { merge: true });
    await admin.firestore().collection("users").doc(uid).set({ gmailSync: { syncStatus: status, ingestionStatus: status, updatedAt: nowIso } }, { merge: true });
}
// ─── Queue helpers ───────────────────────────────────────────────
function queueCollectionForStage(stage) {
    if (stage === "scan")
        return "gmail_scan_jobs";
    if (stage === "attachment")
        return "gmail_attachment_jobs";
    return "gmail_ai_jobs";
}
async function enqueueStageJob(args) {
    const nowIso = (0, utils_1.getNowIso)();
    const docId = (0, crypto_1.randomUUID)();
    const collectionName = queueCollectionForStage(args.stage);
    const base = {
        stage: args.stage,
        status: "pending",
        session_id: args.sessionId,
        user_id: args.uid,
        attempts: 0,
        available_at: args.availableAtIso || nowIso,
        created_at: nowIso,
        updated_at: nowIso,
    };
    await admin.firestore().collection(collectionName).doc(docId).set(Object.assign(Object.assign({ id: docId }, base), { payload: args.payload }));
}
async function pickPendingJobs(args) {
    const collectionName = queueCollectionForStage(args.stage);
    const nowIso = (0, utils_1.getNowIso)();
    const nowMs = Date.now();
    // Recover stale "processing" jobs
    const staleProcessing = await admin
        .firestore()
        .collection(collectionName)
        .where("status", "==", "processing")
        .limit(Math.max(args.limit * types_1.STALE_PROCESSING_SCAN_FACTOR, args.limit))
        .get();
    const staleDocs = staleProcessing.docs.filter((doc) => {
        const data = (0, utils_1.asRecord)(doc.data());
        const updatedAt = (0, utils_1.parseIsoDate)(data.updated_at) || (0, utils_1.parseIsoDate)(data.created_at);
        if (!updatedAt)
            return false;
        return nowMs - updatedAt.getTime() >= types_1.STALE_PROCESSING_JOB_MS;
    });
    if (staleDocs.length > 0) {
        await Promise.all(staleDocs.map((doc) => doc.ref.set({ status: "pending", available_at: nowIso, updated_at: nowIso, error: "stale_processing_requeued" }, { merge: true })));
    }
    // Try indexed query first
    try {
        const indexed = await admin
            .firestore()
            .collection(collectionName)
            .where("status", "==", "pending")
            .where("available_at", "<=", nowIso)
            .orderBy("available_at", "asc")
            .limit(args.limit)
            .get();
        if (!indexed.empty)
            return indexed.docs;
    }
    catch (error) {
        const message = String((error === null || error === void 0 ? void 0 : error.message) || error).toLowerCase();
        if (!message.includes("requires an index"))
            throw error;
    }
    // Fallback: unindexed scan
    const fallbackSampleSize = Math.max(args.limit * 20, 200);
    const snapshot = await admin
        .firestore()
        .collection(collectionName)
        .where("status", "==", "pending")
        .limit(fallbackSampleSize)
        .get();
    const now = Date.now();
    return snapshot.docs
        .filter((doc) => {
        const data = (0, utils_1.asRecord)(doc.data());
        const availableAt = (0, utils_1.parseIsoDate)(data.available_at);
        return !availableAt || availableAt.getTime() <= now;
    })
        .sort((a, b) => {
        const aDate = (0, utils_1.parseIsoDate)((0, utils_1.asRecord)(a.data()).available_at);
        const bDate = (0, utils_1.parseIsoDate)((0, utils_1.asRecord)(b.data()).available_at);
        return ((aDate === null || aDate === void 0 ? void 0 : aDate.getTime()) || 0) - ((bDate === null || bDate === void 0 ? void 0 : bDate.getTime()) || 0);
    })
        .slice(0, args.limit);
}
// ─── Job status transitions ─────────────────────────────────────
async function markJobProcessing(docRef, attempts) {
    await docRef.set({ status: "processing", attempts: attempts + 1, updated_at: (0, utils_1.getNowIso)() }, { merge: true });
}
async function markJobCompleted(docRef) {
    await docRef.set({ status: "completed", updated_at: (0, utils_1.getNowIso)(), completed_at: (0, utils_1.getNowIso)() }, { merge: true });
}
async function markJobFailed(docRef, attempts, error) {
    const retryable = attempts + 1 < types_1.MAX_JOB_ATTEMPTS;
    const now = Date.now();
    const retryDelayMs = types_1.JOB_RETRY_DELAYS_MS[Math.min(attempts, types_1.JOB_RETRY_DELAYS_MS.length - 1)] || 24 * 60 * 60 * 1000;
    const nextAvailableAt = new Date(now + retryDelayMs).toISOString();
    const errorStr = String(error).slice(0, 1500);
    const nowIso = (0, utils_1.getNowIso)();
    await docRef.set({
        status: retryable ? "pending" : "failed",
        updated_at: nowIso,
        available_at: retryable ? nextAvailableAt : nowIso,
        error: errorStr,
        lastErrorAt: nowIso,
        attemptsFailed: attempts + 1,
    }, { merge: true });
    if (!retryable) {
        console.error(`[INGESTION] Job ${docRef.id} permanently failed after ${attempts + 1} attempts:`, errorStr.slice(0, 300));
    }
}
// ─── Session counters & metrics ─────────────────────────────────
async function incrementSessionCounters(sessionId, deltas) {
    const patch = { updated_at: (0, utils_1.getNowIso)() };
    for (const [key, value] of Object.entries(deltas)) {
        if (!value)
            continue;
        patch[`counters.${key}`] = admin.firestore.FieldValue.increment(value);
    }
    await admin.firestore().collection("gmail_ingestion_sessions").doc(sessionId).update(patch);
}
async function recordSessionStageMetric(args) {
    const patch = {
        [`metrics.${args.stageKey}_ms`]: admin.firestore.FieldValue.increment(Math.max(0, Math.round(args.durationMs))),
        [`metrics.${args.stageKey}_count`]: admin.firestore.FieldValue.increment(1),
        updated_at: (0, utils_1.getNowIso)(),
    };
    if (args.aiCalls)
        patch["metrics.ai_calls_total"] = admin.firestore.FieldValue.increment(args.aiCalls);
    const tokenEstimate = Math.ceil(((args.aiInputChars || 0) + (args.aiOutputChars || 0)) / 4);
    if (tokenEstimate > 0) {
        patch["metrics.ai_tokens_estimated"] = admin.firestore.FieldValue.increment(tokenEstimate);
    }
    await admin.firestore().collection("gmail_ingestion_sessions").doc(args.sessionId).update(patch);
}
// ─── Session finalization ────────────────────────────────────────
async function maybeFinalizeSession(sessionId) {
    const sessionRef = admin.firestore().collection("gmail_ingestion_sessions").doc(sessionId);
    const sessionSnap = await sessionRef.get();
    if (!sessionSnap.exists)
        return;
    const sessionData = (0, utils_1.asRecord)(sessionSnap.data());
    const scanComplete = sessionData.scan_complete === true;
    const status = (0, utils_1.asString)(sessionData.status);
    if (!scanComplete)
        return;
    if (status === "completed" || status === "requires_review" || status === "failed")
        return;
    const outstandingStages = scanComplete
        ? ["attachment", "ai_extract"]
        : ["scan", "attachment", "ai_extract"];
    const hasOutstanding = await Promise.all(outstandingStages.map(async (stage) => {
        const collection = admin.firestore().collection(queueCollectionForStage(stage));
        const pending = await collection.where("session_id", "==", sessionId).where("status", "==", "pending").limit(1).get();
        if (!pending.empty)
            return true;
        const processing = await collection.where("session_id", "==", sessionId).where("status", "==", "processing").limit(1).get();
        return !processing.empty;
    }));
    if (hasOutstanding.some(Boolean))
        return;
    const counters = (0, utils_1.asRecord)(sessionData.counters);
    const uid = (0, utils_1.asString)(sessionData.user_id);
    if (!uid)
        return;
    const requiresReview = (0, utils_1.asNonNegativeNumber)(counters.events_requiring_review, 0) > 0;
    const finalStatus = requiresReview ? "requires_review" : "completed";
    const updatedAtIso = (0, utils_1.getNowIso)();
    const totalActionableEvents = (0, utils_1.asNonNegativeNumber)(counters.new_medical_events_created, 0) + (0, utils_1.asNonNegativeNumber)(counters.events_requiring_review, 0);
    const reviewRatio = totalActionableEvents > 0 ? (0, utils_1.asNonNegativeNumber)(counters.events_requiring_review, 0) / totalActionableEvents : 0;
    const metrics = (0, utils_1.asRecord)(sessionData.metrics);
    const estimatedTokens = (0, utils_1.asNonNegativeNumber)(metrics.ai_tokens_estimated, 0);
    const costPer1kTokens = Number(process.env.CLINICAL_AI_COST_PER_1K_TOKENS || 0.003);
    const estimatedCostUsd = Number(((estimatedTokens / 1000) * costPer1kTokens).toFixed(4));
    const summary = {
        import_session_id: sessionId,
        timestamp: updatedAtIso,
        status: (0, utils_1.asNonNegativeNumber)(counters.errors_count, 0) > 0 ? "completed_with_warnings" : "completed",
        metrics: {
            total_emails_scanned: (0, utils_1.asNonNegativeNumber)(counters.total_emails_scanned, 0),
            emails_with_medical_content: (0, utils_1.asNonNegativeNumber)(counters.candidate_emails_detected, 0),
            documents_with_images: (0, utils_1.asNonNegativeNumber)(counters.emails_with_images, 0),
            documents_with_attachments: (0, utils_1.asNonNegativeNumber)(counters.emails_with_attachments, 0),
            new_medical_events_created: (0, utils_1.asNonNegativeNumber)(counters.new_medical_events_created, 0),
            events_requiring_review: (0, utils_1.asNonNegativeNumber)(counters.events_requiring_review, 0),
            duplicates_skipped: (0, utils_1.asNonNegativeNumber)(counters.duplicates_removed, 0),
            errors_count: (0, utils_1.asNonNegativeNumber)(counters.errors_count, 0),
            review_ratio: Number(reviewRatio.toFixed(3)),
            ai_calls_total: (0, utils_1.asNonNegativeNumber)(metrics.ai_calls_total, 0),
            ai_tokens_estimated: estimatedTokens,
            ai_estimated_cost_usd: estimatedCostUsd,
            scan_ms: (0, utils_1.asNonNegativeNumber)(metrics.scan_ms, 0),
            classification_ms: (0, utils_1.asNonNegativeNumber)(metrics.classification_ms, 0),
            attachment_ms: (0, utils_1.asNonNegativeNumber)(metrics.attachment_ms, 0),
            extraction_ms: (0, utils_1.asNonNegativeNumber)(metrics.extraction_ms, 0),
        },
    };
    await sessionRef.set({ status: finalStatus, updated_at: updatedAtIso, completed_at: updatedAtIso, summary }, { merge: true });
    const configStatus = finalStatus === "requires_review" ? "requires_review" : "completed";
    await updateIngestionProgress(uid, configStatus);
    await admin.firestore().collection("user_email_config").doc(uid).set({
        ingestion_status: configStatus,
        sync_status: configStatus,
        last_sync_timestamp: updatedAtIso,
        updated_at: updatedAtIso,
        total_emails_scanned: (0, utils_1.asNonNegativeNumber)(counters.total_emails_scanned, 0),
        clinical_candidates_detected: (0, utils_1.asNonNegativeNumber)(counters.candidate_emails_detected, 0),
        documents_processed: (0, utils_1.asNonNegativeNumber)(counters.new_medical_events_created, 0) +
            (0, utils_1.asNonNegativeNumber)(counters.events_requiring_review, 0),
        duplicates_removed: (0, utils_1.asNonNegativeNumber)(counters.duplicates_removed, 0),
        threshold_tuning_recommended: reviewRatio > 0.3,
        ai_estimated_cost_usd: estimatedCostUsd,
    }, { merge: true });
}
// ─── Watchdog: stuck session closer ──────────────────────────────
async function closeStuckSessionAsPartial(args) {
    const nowIso = (0, utils_1.getNowIso)();
    const counters = (0, utils_1.asRecord)(args.sessionData.counters);
    const sessionRef = admin.firestore().collection("gmail_ingestion_sessions").doc(args.sessionId);
    await sessionRef.set({
        status: "requires_review",
        scan_complete: true,
        watchdog_forced_close: true,
        watchdog_reason: args.reason,
        updated_at: nowIso,
        completed_at: nowIso,
        summary: {
            import_session_id: args.sessionId,
            timestamp: nowIso,
            status: "partial_sync",
            reason: args.reason,
            pending_jobs: args.pendingJobs,
            metrics: {
                total_emails_scanned: (0, utils_1.asNonNegativeNumber)(counters.total_emails_scanned, 0),
                emails_with_medical_content: (0, utils_1.asNonNegativeNumber)(counters.candidate_emails_detected, 0),
                new_medical_events_created: (0, utils_1.asNonNegativeNumber)(counters.new_medical_events_created, 0),
                events_requiring_review: (0, utils_1.asNonNegativeNumber)(counters.events_requiring_review, 0),
                duplicates_skipped: (0, utils_1.asNonNegativeNumber)(counters.duplicates_removed, 0),
                errors_count: (0, utils_1.asNonNegativeNumber)(counters.errors_count, 0),
            },
        },
    }, { merge: true });
    await updateIngestionProgress(args.uid, "requires_review");
    await admin.firestore().collection("user_email_config").doc(args.uid).set({
        ingestion_status: "requires_review",
        sync_status: "requires_review",
        last_sync_timestamp: nowIso,
        updated_at: nowIso,
        watchdog_last_forced_close_at: nowIso,
    }, { merge: true });
}
// ─── Locking ─────────────────────────────────────────────────────
async function acquireUserIngestionLock(uid, owner) {
    const ref = admin.firestore().collection("gmail_user_locks").doc(uid);
    const now = Date.now();
    const leaseMs = 90000;
    let acquired = false;
    await admin.firestore().runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        const data = (0, utils_1.asRecord)(snap.data());
        const currentOwner = (0, utils_1.asString)(data.owner);
        const expiresAt = (0, utils_1.parseIsoDate)(data.expires_at);
        const expired = !expiresAt || expiresAt.getTime() <= now;
        if (!expired && currentOwner && currentOwner !== owner) {
            acquired = false;
            return;
        }
        acquired = true;
        tx.set(ref, {
            uid,
            owner,
            acquired_at: (0, utils_1.getNowIso)(),
            expires_at: new Date(now + leaseMs).toISOString(),
            updated_at: (0, utils_1.getNowIso)(),
        }, { merge: true });
    });
    return acquired;
}
async function releaseUserIngestionLock(uid, owner) {
    const ref = admin.firestore().collection("gmail_user_locks").doc(uid);
    await admin.firestore().runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists)
            return;
        const data = (0, utils_1.asRecord)(snap.data());
        const currentOwner = (0, utils_1.asString)(data.owner);
        if (currentOwner !== owner)
            return;
        tx.delete(ref);
    }).catch(() => undefined);
}
// ─── Scan job bootstrapping ──────────────────────────────────────
async function ensurePendingScanJob(sessionId, uid) {
    const sessionSnap = await admin.firestore().collection("gmail_ingestion_sessions").doc(sessionId).get();
    if (!sessionSnap.exists)
        return;
    const sessionData = (0, utils_1.asRecord)(sessionSnap.data());
    const sessionStatus = (0, utils_1.asString)(sessionData.status);
    if (sessionStatus === "completed" || sessionStatus === "requires_review" || sessionStatus === "failed")
        return;
    if (sessionData.scan_complete === true)
        return;
    const pending = await admin
        .firestore()
        .collection(queueCollectionForStage("scan"))
        .where("session_id", "==", sessionId)
        .where("status", "==", "pending")
        .limit(1)
        .get();
    if (!pending.empty)
        return;
    const processing = await admin
        .firestore()
        .collection(queueCollectionForStage("scan"))
        .where("session_id", "==", sessionId)
        .where("status", "==", "processing")
        .limit(1)
        .get();
    if (!processing.empty)
        return;
    await enqueueStageJob({
        stage: "scan",
        sessionId,
        uid,
        payload: { page_token: null },
    });
}
//# sourceMappingURL=sessionQueue.js.map