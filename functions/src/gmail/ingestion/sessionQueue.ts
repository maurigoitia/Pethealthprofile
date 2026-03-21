/**
 * sessionQueue.ts — Session lifecycle, queue CRUD, stage workers, counters & metrics.
 *
 * Strangler-Fig extraction from clinicalIngestion.ts.
 * This module owns all Firestore operations for ingestion sessions and
 * the three-stage job queues (scan → attachment → ai_extract).
 */

import * as admin from "firebase-admin";
import { randomUUID } from "crypto";

import type {
  IngestionStatus,
  QueueJobBase,
  QueueJobStage,
  QueueJobStatus,
  QueueStatus,
  ScanQueueJobPayload,
  SessionCounters,
  UserEmailConfig,
} from "./types";

import {
  asNonNegativeNumber,
  asRecord,
  asString,
  getNowIso,
  parseIsoDate,
  toGmailDate,
  toIsoDateOnly,
} from "./utils";

import {
  STALE_PROCESSING_JOB_MS,
  STALE_PROCESSING_SCAN_FACTOR,
  MAX_JOB_ATTEMPTS,
  JOB_RETRY_DELAYS_MS,
  FORCE_DRAIN_MAX_JOBS_PER_STAGE,
  FORCE_DRAIN_POLL_MS,
} from "./types";

import {
  getMaxConcurrentExtractionJobs,
} from "./envConfig";

// ── Counter helpers ─────────────────────────────────────────────────────────

export function buildScanCountersPatch(counters: SessionCounters): Partial<SessionCounters> {
  return {
    total_emails_scanned: counters.total_emails_scanned,
    candidate_emails_detected: counters.candidate_emails_detected,
    emails_with_attachments: counters.emails_with_attachments,
    emails_with_images: counters.emails_with_images,
    duplicates_removed: counters.duplicates_removed,
  };
}

export function toFirestoreCounterFields(counters: Partial<SessionCounters>): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(counters)) {
    patch[`counters.${key}`] = value;
  }
  return patch;
}

// ── Session date window & Gmail query ───────────────────────────────────────

export function buildSessionDateWindow(maxLookbackMonths: number): { afterDate: Date; beforeDate: Date } {
  const beforeDate = new Date();
  const afterDate = new Date(beforeDate);
  afterDate.setUTCMonth(afterDate.getUTCMonth() - maxLookbackMonths);
  return { afterDate, beforeDate };
}

export function buildGmailSearchQuery(args: {
  afterDate: Date;
  beforeDate: Date;
  petName?: string | null;
  petId?: string | null;
}): string {
  // Keep query selective to reduce non-clinical load before AI classification.
  const clinicalTerms = [
    "veterinaria",
    "veterinario",
    "veterinary",
    "clinic",
    "clinica",
    "hospital veterinario",
    "turno veterinario",
    "diagnosis",
    "diagnostico",
    "diagnóstico",
    "vacuna",
    "vaccine",
    "tratamiento",
    "medicacion",
    "medicación",
    "receta",
    "prescription",
    "laboratorio",
    "lab",
    "ecografia",
    "ultrasound",
    "radiografia",
    "radiography",
    "electrocardiograma",
    "ecg",
  ]
    .map((term) => `"${term}"`)
    .join(" OR ");

  const filenameTerms = [
    "receta",
    "prescription",
    "laboratorio",
    "analisis",
    "informe",
    "radiografia",
    "ecografia",
    "ultrasound",
    "ecg",
  ]
    .map((term) => `filename:${term}`)
    .join(" OR ");

  const petFilters: string[] = [];
  const petName = asString(args.petName);
  const petId = asString(args.petId);
  if (petName) petFilters.push(`"${petName}"`);
  if (petId) petFilters.push(`"${petId}"`);

  const petClause = petFilters.length > 0 ? `(${petFilters.join(" OR ")})` : "";
  const senderHints = "(from:vet OR from:veterinaria OR from:veterinary OR from:clinic OR from:clinica)";
  const clinicalCore = `(${clinicalTerms} OR ${filenameTerms} OR ${senderHints})`;
  const queryCore = petClause ? `${petClause} AND ${clinicalCore}` : clinicalCore;

  return `${queryCore} after:${toGmailDate(args.afterDate)} before:${toGmailDate(args.beforeDate)}`;
}

// ── Active session counting ─────────────────────────────────────────────────

export async function countActiveSessions(): Promise<number> {
  const maxConcurrent = getMaxConcurrentExtractionJobs();
  const snapshot = await admin
    .firestore()
    .collection("gmail_ingestion_sessions")
    .where("status", "in", ["queued", "processing"])
    .limit(maxConcurrent + 1)
    .get();
  return snapshot.size;
}

// ── Ingestion progress ──────────────────────────────────────────────────────

export async function updateIngestionProgress(uid: string, status: IngestionStatus): Promise<void> {
  const nowIso = getNowIso();
  await admin.firestore().collection("user_email_config").doc(uid).set(
    {
      ingestion_status: status,
      sync_status: status,
      updated_at: nowIso,
    },
    { merge: true }
  );
  await admin.firestore().collection("users").doc(uid).set(
    {
      gmailSync: {
        syncStatus: status,
        ingestionStatus: status,
        updatedAt: nowIso,
      },
    },
    { merge: true }
  );
}

// ── Session creation ────────────────────────────────────────────────────────

export async function createIngestionSession(args: {
  uid: string;
  config: UserEmailConfig;
  preferredPetId?: string | null;
}): Promise<string> {
  const { afterDate, beforeDate } = buildSessionDateWindow(args.config.max_lookback_months);
  const preferredPetId = asString(args.preferredPetId) || args.config.pet_id || args.config.fallback_pet_id || null;
  const preferredPetName = args.config.pet_name || args.config.fallback_pet_name || null;
  const query = buildGmailSearchQuery({
    afterDate,
    beforeDate,
    petName: preferredPetName,
    petId: preferredPetId,
  });
  const fallbackQuery = buildGmailSearchQuery({
    afterDate,
    beforeDate,
    petName: null,
    petId: null,
  });
  const nowIso = getNowIso();
  const sessionId = randomUUID();
  await admin.firestore().collection("gmail_ingestion_sessions").doc(sessionId).set(
    {
      session_id: sessionId,
      user_id: args.uid,
      pet_id: preferredPetId || null,
      pet_name: preferredPetName,
      fallback_pet_id: args.config.fallback_pet_id || null,
      fallback_pet_name: args.config.fallback_pet_name || null,
      active_pet_count: args.config.active_pet_count || 0,
      status: "queued" as QueueStatus,
      query,
      fallback_query: fallbackQuery,
      fallback_query_applied: false,
      next_page_token: null,
      started_at: nowIso,
      updated_at: nowIso,
      lookback_after: toIsoDateOnly(afterDate),
      lookback_before: toIsoDateOnly(beforeDate),
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
      } as SessionCounters,
      summary: null,
    },
    { merge: true }
  );
  return sessionId;
}

// ── Queue collection routing ────────────────────────────────────────────────

export function queueCollectionForStage(stage: QueueJobStage): string {
  if (stage === "scan") return "gmail_scan_jobs";
  if (stage === "attachment") return "gmail_attachment_jobs";
  return "gmail_ai_jobs";
}

// ── Queue CRUD ──────────────────────────────────────────────────────────────

export async function enqueueStageJob<TPayload extends object>(args: {
  stage: QueueJobStage;
  sessionId: string;
  uid: string;
  payload: TPayload;
  availableAtIso?: string;
}): Promise<void> {
  const nowIso = getNowIso();
  const docId = randomUUID();
  const collectionName = queueCollectionForStage(args.stage);
  const base: QueueJobBase = {
    stage: args.stage,
    status: "pending",
    session_id: args.sessionId,
    user_id: args.uid,
    attempts: 0,
    available_at: args.availableAtIso || nowIso,
    created_at: nowIso,
    updated_at: nowIso,
  };
  await admin.firestore().collection(collectionName).doc(docId).set({
    id: docId,
    ...base,
    payload: args.payload,
  });
}

export async function pickPendingJobs(args: {
  stage: QueueJobStage;
  limit: number;
}): Promise<FirebaseFirestore.QueryDocumentSnapshot<FirebaseFirestore.DocumentData>[]> {
  const collectionName = queueCollectionForStage(args.stage);
  const nowIso = getNowIso();
  const nowMs = Date.now();

  const staleProcessing = await admin
    .firestore()
    .collection(collectionName)
    .where("status", "==", "processing")
    .limit(Math.max(args.limit * STALE_PROCESSING_SCAN_FACTOR, args.limit))
    .get();

  const staleDocs = staleProcessing.docs.filter((doc) => {
    const data = asRecord(doc.data());
    const updatedAt = parseIsoDate(data.updated_at) || parseIsoDate(data.created_at);
    if (!updatedAt) return false;
    return nowMs - updatedAt.getTime() >= STALE_PROCESSING_JOB_MS;
  });
  if (staleDocs.length > 0) {
    await Promise.all(
      staleDocs.map((doc) =>
        doc.ref.set(
          {
            status: "pending",
            available_at: nowIso,
            updated_at: nowIso,
            error: "stale_processing_requeued",
          },
          { merge: true }
        )
      )
    );
  }

  try {
    const indexed = await admin
      .firestore()
      .collection(collectionName)
      .where("status", "==", "pending")
      .where("available_at", "<=", nowIso)
      .orderBy("available_at", "asc")
      .limit(args.limit)
      .get();
    if (!indexed.empty) return indexed.docs;
  } catch (error) {
    const message = String((error as Error)?.message || error).toLowerCase();
    if (!message.includes("requires an index")) {
      throw error;
    }
  }

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
      const data = asRecord(doc.data());
      const availableAt = parseIsoDate(data.available_at);
      return !availableAt || availableAt.getTime() <= now;
    })
    .sort((a, b) => {
      const aDate = parseIsoDate(asRecord(a.data()).available_at);
      const bDate = parseIsoDate(asRecord(b.data()).available_at);
      return (aDate?.getTime() || 0) - (bDate?.getTime() || 0);
    })
    .slice(0, args.limit);
}

export async function markJobProcessing(
  docRef: FirebaseFirestore.DocumentReference<FirebaseFirestore.DocumentData>,
  attempts: number
): Promise<void> {
  await docRef.set(
    {
      status: "processing",
      attempts: attempts + 1,
      updated_at: getNowIso(),
    },
    { merge: true }
  );
}

export async function markJobCompleted(
  docRef: FirebaseFirestore.DocumentReference<FirebaseFirestore.DocumentData>
): Promise<void> {
  await docRef.set(
    {
      status: "completed",
      updated_at: getNowIso(),
      completed_at: getNowIso(),
    },
    { merge: true }
  );
}

export async function markJobFailed(
  docRef: FirebaseFirestore.DocumentReference<FirebaseFirestore.DocumentData>,
  attempts: number,
  error: unknown
): Promise<void> {
  const retryable = attempts + 1 < MAX_JOB_ATTEMPTS;
  const now = Date.now();
  const retryDelayMs = JOB_RETRY_DELAYS_MS[Math.min(attempts, JOB_RETRY_DELAYS_MS.length - 1)] || (24 * 60 * 60 * 1000);
  const nextAvailableAt = new Date(now + retryDelayMs).toISOString();
  await docRef.set(
    {
      status: retryable ? "pending" : ("failed" as QueueJobStatus),
      updated_at: getNowIso(),
      available_at: retryable ? nextAvailableAt : getNowIso(),
      error: String(error).slice(0, 1500),
    },
    { merge: true }
  );
}

// ── Session counters & metrics ──────────────────────────────────────────────

export async function incrementSessionCounters(
  sessionId: string,
  deltas: Partial<Record<keyof SessionCounters, number>>
): Promise<void> {
  const patch: Record<string, unknown> = {
    updated_at: getNowIso(),
  };
  for (const [key, value] of Object.entries(deltas)) {
    if (!value) continue;
    patch[`counters.${key}`] = admin.firestore.FieldValue.increment(value);
  }
  await admin.firestore().collection("gmail_ingestion_sessions").doc(sessionId).update(patch);
}

export async function recordSessionStageMetric(args: {
  sessionId: string;
  stageKey: "scan" | "classification" | "attachment" | "extraction";
  durationMs: number;
  aiCalls?: number;
  aiInputChars?: number;
  aiOutputChars?: number;
}): Promise<void> {
  const patch: Record<string, unknown> = {
    [`metrics.${args.stageKey}_ms`]: admin.firestore.FieldValue.increment(Math.max(0, Math.round(args.durationMs))),
    [`metrics.${args.stageKey}_count`]: admin.firestore.FieldValue.increment(1),
    updated_at: getNowIso(),
  };
  if (args.aiCalls) patch["metrics.ai_calls_total"] = admin.firestore.FieldValue.increment(args.aiCalls);
  const tokenEstimate = Math.ceil(((args.aiInputChars || 0) + (args.aiOutputChars || 0)) / 4);
  if (tokenEstimate > 0) {
    patch["metrics.ai_tokens_estimated"] = admin.firestore.FieldValue.increment(tokenEstimate);
  }
  await admin.firestore().collection("gmail_ingestion_sessions").doc(args.sessionId).update(patch);
}

// ── Session finalization ────────────────────────────────────────────────────

export async function maybeFinalizeSession(sessionId: string): Promise<void> {
  const sessionRef = admin.firestore().collection("gmail_ingestion_sessions").doc(sessionId);
  const sessionSnap = await sessionRef.get();
  if (!sessionSnap.exists) return;
  const sessionData = asRecord(sessionSnap.data());
  const scanComplete = sessionData.scan_complete === true;
  const status = asString(sessionData.status);
  if (!scanComplete) return;
  if (status === "completed" || status === "requires_review" || status === "failed") return;

  const outstandingStages = scanComplete
    ? (["attachment", "ai_extract"] as QueueJobStage[])
    : (["scan", "attachment", "ai_extract"] as QueueJobStage[]);

  const hasOutstanding = await Promise.all(
    outstandingStages.map(async (stage) => {
      const collection = admin.firestore().collection(queueCollectionForStage(stage));
      const pending = await collection
        .where("session_id", "==", sessionId)
        .where("status", "==", "pending")
        .limit(1)
        .get();
      if (!pending.empty) return true;
      const processing = await collection
        .where("session_id", "==", sessionId)
        .where("status", "==", "processing")
        .limit(1)
        .get();
      return !processing.empty;
    })
  );
  if (hasOutstanding.some(Boolean)) return;

  const counters = asRecord(sessionData.counters) as unknown as SessionCounters;
  const uid = asString(sessionData.user_id);
  if (!uid) return;

  const requiresReview = asNonNegativeNumber(counters.events_requiring_review, 0) > 0;
  const finalStatus: QueueStatus = requiresReview ? "requires_review" : "completed";
  const updatedAtIso = getNowIso();
  const totalActionableEvents =
    asNonNegativeNumber(counters.new_medical_events_created, 0) + asNonNegativeNumber(counters.events_requiring_review, 0);
  const reviewRatio = totalActionableEvents > 0
    ? asNonNegativeNumber(counters.events_requiring_review, 0) / totalActionableEvents
    : 0;
  const metrics = asRecord(sessionData.metrics);
  const estimatedTokens = asNonNegativeNumber(metrics.ai_tokens_estimated, 0);
  const costPer1kTokens = Number(process.env.CLINICAL_AI_COST_PER_1K_TOKENS || 0.003);
  const estimatedCostUsd = Number(((estimatedTokens / 1000) * costPer1kTokens).toFixed(4));

  const summary = {
    import_session_id: sessionId,
    timestamp: updatedAtIso,
    status: asNonNegativeNumber(counters.errors_count, 0) > 0 ? "completed_with_warnings" : "completed",
    metrics: {
      total_emails_scanned: asNonNegativeNumber(counters.total_emails_scanned, 0),
      emails_with_medical_content: asNonNegativeNumber(counters.candidate_emails_detected, 0),
      documents_with_images: asNonNegativeNumber(counters.emails_with_images, 0),
      documents_with_attachments: asNonNegativeNumber(counters.emails_with_attachments, 0),
      new_medical_events_created: asNonNegativeNumber(counters.new_medical_events_created, 0),
      events_requiring_review: asNonNegativeNumber(counters.events_requiring_review, 0),
      duplicates_skipped: asNonNegativeNumber(counters.duplicates_removed, 0),
      errors_count: asNonNegativeNumber(counters.errors_count, 0),
      review_ratio: Number(reviewRatio.toFixed(3)),
      ai_calls_total: asNonNegativeNumber(metrics.ai_calls_total, 0),
      ai_tokens_estimated: estimatedTokens,
      ai_estimated_cost_usd: estimatedCostUsd,
      scan_ms: asNonNegativeNumber(metrics.scan_ms, 0),
      classification_ms: asNonNegativeNumber(metrics.classification_ms, 0),
      attachment_ms: asNonNegativeNumber(metrics.attachment_ms, 0),
      extraction_ms: asNonNegativeNumber(metrics.extraction_ms, 0),
    },
  };

  await sessionRef.set(
    {
      status: finalStatus,
      updated_at: updatedAtIso,
      completed_at: updatedAtIso,
      summary,
    },
    { merge: true }
  );

  const configStatus: IngestionStatus = finalStatus === "requires_review" ? "requires_review" : "completed";
  await updateIngestionProgress(uid, configStatus);
  await admin.firestore().collection("user_email_config").doc(uid).set(
    {
      ingestion_status: configStatus,
      sync_status: configStatus,
      last_sync_timestamp: updatedAtIso,
      updated_at: updatedAtIso,
      total_emails_scanned: asNonNegativeNumber(counters.total_emails_scanned, 0),
      clinical_candidates_detected: asNonNegativeNumber(counters.candidate_emails_detected, 0),
      documents_processed:
        asNonNegativeNumber(counters.new_medical_events_created, 0) +
        asNonNegativeNumber(counters.events_requiring_review, 0),
      duplicates_removed: asNonNegativeNumber(counters.duplicates_removed, 0),
      threshold_tuning_recommended: reviewRatio > 0.3,
      ai_estimated_cost_usd: estimatedCostUsd,
    },
    { merge: true }
  );
}

// ── Stuck session cleanup ───────────────────────────────────────────────────

export async function closeStuckSessionAsPartial(args: {
  sessionId: string;
  uid: string;
  sessionData: Record<string, unknown>;
  pendingJobs: { scan: number; ai_extract: number; attachment: number; total: number };
  reason: string;
}): Promise<void> {
  const nowIso = getNowIso();
  const counters = asRecord(args.sessionData.counters) as unknown as SessionCounters;
  const sessionRef = admin.firestore().collection("gmail_ingestion_sessions").doc(args.sessionId);

  await sessionRef.set(
    {
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
          total_emails_scanned: asNonNegativeNumber(counters.total_emails_scanned, 0),
          emails_with_medical_content: asNonNegativeNumber(counters.candidate_emails_detected, 0),
          new_medical_events_created: asNonNegativeNumber(counters.new_medical_events_created, 0),
          events_requiring_review: asNonNegativeNumber(counters.events_requiring_review, 0),
          duplicates_skipped: asNonNegativeNumber(counters.duplicates_removed, 0),
          errors_count: asNonNegativeNumber(counters.errors_count, 0),
        },
      },
    },
    { merge: true }
  );

  await updateIngestionProgress(args.uid, "requires_review");
  await admin.firestore().collection("user_email_config").doc(args.uid).set(
    {
      ingestion_status: "requires_review",
      sync_status: "requires_review",
      last_sync_timestamp: nowIso,
      updated_at: nowIso,
      watchdog_last_forced_close_at: nowIso,
    },
    { merge: true }
  );
}

// ── User ingestion lock ─────────────────────────────────────────────────────

export async function acquireUserIngestionLock(uid: string, owner: string): Promise<boolean> {
  const ref = admin.firestore().collection("gmail_user_locks").doc(uid);
  const now = Date.now();
  const leaseMs = 90_000;
  let acquired = false;
  await admin.firestore().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = asRecord(snap.data());
    const currentOwner = asString(data.owner);
    const expiresAt = parseIsoDate(data.expires_at);
    const expired = !expiresAt || expiresAt.getTime() <= now;
    if (!expired && currentOwner && currentOwner !== owner) {
      acquired = false;
      return;
    }
    acquired = true;
    tx.set(
      ref,
      {
        uid,
        owner,
        acquired_at: getNowIso(),
        expires_at: new Date(now + leaseMs).toISOString(),
        updated_at: getNowIso(),
      },
      { merge: true }
    );
  });
  return acquired;
}

export async function releaseUserIngestionLock(uid: string, owner: string): Promise<void> {
  const ref = admin.firestore().collection("gmail_user_locks").doc(uid);
  await admin.firestore().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return;
    const data = asRecord(snap.data());
    const currentOwner = asString(data.owner);
    if (currentOwner !== owner) return;
    tx.delete(ref);
  }).catch(() => undefined);
}

// ── Scan job guard ──────────────────────────────────────────────────────────

export async function ensurePendingScanJob(sessionId: string, uid: string): Promise<void> {
  const sessionSnap = await admin.firestore().collection("gmail_ingestion_sessions").doc(sessionId).get();
  if (!sessionSnap.exists) return;
  const sessionData = asRecord(sessionSnap.data());
  const sessionStatus = asString(sessionData.status);
  if (sessionStatus === "completed" || sessionStatus === "requires_review" || sessionStatus === "failed") return;
  if (sessionData.scan_complete === true) return;

  const pending = await admin
    .firestore()
    .collection(queueCollectionForStage("scan"))
    .where("session_id", "==", sessionId)
    .where("status", "==", "pending")
    .limit(1)
    .get();
  if (!pending.empty) return;
  const processing = await admin
    .firestore()
    .collection(queueCollectionForStage("scan"))
    .where("session_id", "==", sessionId)
    .where("status", "==", "processing")
    .limit(1)
    .get();
  if (!processing.empty) return;
  await enqueueStageJob<ScanQueueJobPayload>({
    stage: "scan",
    sessionId,
    uid,
    payload: { page_token: null },
  });
}

// ── Stage worker infrastructure ─────────────────────────────────────────────

export async function runStageWorkers(args: {
  stage: QueueJobStage;
  limit: number;
  lockPrefix: "scan" | "attachment" | "ai";
  handler: (job: FirebaseFirestore.QueryDocumentSnapshot) => Promise<void>;
}): Promise<void> {
  const jobs = await pickPendingJobs({ stage: args.stage, limit: args.limit });
  for (const job of jobs) {
    const jobData = asRecord(job.data());
    const attempts = asNonNegativeNumber(jobData.attempts, 0);
    const uid = asString(jobData.user_id);
    const lockOwner = `${args.lockPrefix}:${job.id}`;
    if (!uid) {
      await job.ref.set(
        {
          status: "failed",
          updated_at: getNowIso(),
          completed_at: getNowIso(),
          error: "invalid_job_missing_user_id",
        },
        { merge: true }
      );
      const sessionId = asString(jobData.session_id);
      if (sessionId) {
        await incrementSessionCounters(sessionId, { errors_count: 1 });
      }
      continue;
    }
    const lock = await acquireUserIngestionLock(uid, lockOwner);
    if (!lock) {
      await job.ref.set(
        {
          available_at: new Date(Date.now() + 20_000).toISOString(),
          updated_at: getNowIso(),
        },
        { merge: true }
      );
      continue;
    }

    await markJobProcessing(job.ref, attempts);
    try {
      await args.handler(job);
    } catch (error) {
      await markJobFailed(job.ref, attempts, error);
      const sessionId = asString(jobData.session_id);
      if (sessionId) {
        await incrementSessionCounters(sessionId, { errors_count: 1 });
      }
    } finally {
      await releaseUserIngestionLock(uid, lockOwner);
    }
  }
}

export async function pickPendingJobsForSession(args: {
  stage: QueueJobStage;
  sessionId: string;
  limit: number;
}): Promise<FirebaseFirestore.QueryDocumentSnapshot<FirebaseFirestore.DocumentData>[]> {
  const collectionName = queueCollectionForStage(args.stage);
  const nowIso = getNowIso();
  const nowMs = Date.now();
  const snap = await admin
    .firestore()
    .collection(collectionName)
    .where("session_id", "==", args.sessionId)
    .limit(Math.max(args.limit * STALE_PROCESSING_SCAN_FACTOR, args.limit))
    .get();

  const staleDocs = snap.docs.filter((doc) => {
    const row = asRecord(doc.data());
    if (asString(row.status) !== "processing") return false;
    const updatedAt = parseIsoDate(row.updated_at) || parseIsoDate(row.created_at);
    if (!updatedAt) return false;
    return nowMs - updatedAt.getTime() >= STALE_PROCESSING_JOB_MS;
  });
  if (staleDocs.length > 0) {
    await Promise.all(
      staleDocs.map((doc) =>
        doc.ref.set(
          {
            status: "pending",
            available_at: nowIso,
            updated_at: nowIso,
            error: "stale_processing_requeued",
          },
          { merge: true }
        )
      )
    );
  }

  return snap.docs
    .filter((doc) => {
      const row = asRecord(doc.data());
      const status = asString(row.status);
      if (status !== "pending") return false;
      const availableAt = parseIsoDate(row.available_at);
      return !availableAt || availableAt.getTime() <= nowMs;
    })
    .sort((a, b) => {
      const aDate = parseIsoDate(asRecord(a.data()).available_at);
      const bDate = parseIsoDate(asRecord(b.data()).available_at);
      return (aDate?.getTime() || 0) - (bDate?.getTime() || 0);
    })
    .slice(0, args.limit);
}

export async function runSessionStageWorkers(args: {
  stage: QueueJobStage;
  sessionId: string;
  limit: number;
  lockPrefix: "scan" | "attachment" | "ai";
  handler: (job: FirebaseFirestore.QueryDocumentSnapshot) => Promise<void>;
}): Promise<number> {
  const jobs = await pickPendingJobsForSession({
    stage: args.stage,
    sessionId: args.sessionId,
    limit: args.limit,
  });
  let processed = 0;

  for (const job of jobs) {
    const jobData = asRecord(job.data());
    const attempts = asNonNegativeNumber(jobData.attempts, 0);
    const uid = asString(jobData.user_id);
    const lockOwner = `${args.lockPrefix}:${job.id}`;
    if (!uid) {
      await job.ref.set(
        {
          status: "failed",
          updated_at: getNowIso(),
          completed_at: getNowIso(),
          error: "invalid_job_missing_user_id",
        },
        { merge: true }
      );
      const sessionId = asString(jobData.session_id);
      if (sessionId) {
        await incrementSessionCounters(sessionId, { errors_count: 1 });
      }
      processed += 1;
      continue;
    }

    const lock = await acquireUserIngestionLock(uid, lockOwner);
    if (!lock) {
      await job.ref.set(
        {
          available_at: new Date(Date.now() + 20_000).toISOString(),
          updated_at: getNowIso(),
        },
        { merge: true }
      );
      continue;
    }

    await markJobProcessing(job.ref, attempts);
    try {
      await args.handler(job);
    } catch (error) {
      await markJobFailed(job.ref, attempts, error);
      const sessionId = asString(jobData.session_id);
      if (sessionId) {
        await incrementSessionCounters(sessionId, { errors_count: 1 });
      }
    } finally {
      await releaseUserIngestionLock(uid, lockOwner);
    }
    processed += 1;
  }

  return processed;
}

// ── Pending job counting ────────────────────────────────────────────────────

export async function countPendingJobsForSession(sessionId: string): Promise<{
  scan: number;
  ai_extract: number;
  attachment: number;
  total: number;
}> {
  const countForStage = async (stage: QueueJobStage): Promise<number> => {
    const snap = await admin
      .firestore()
      .collection(queueCollectionForStage(stage))
      .where("session_id", "==", sessionId)
      .limit(400)
      .get();
    return snap.docs.filter((doc) => {
      const row = asRecord(doc.data());
      const status = asString(row.status);
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

// ── Queue drain (force-run) ─────────────────────────────────────────────────

export async function drainSessionQueues(args: {
  sessionId: string;
  maxWaitMs: number;
  handlers: {
    processScanQueueJob: (job: FirebaseFirestore.QueryDocumentSnapshot) => Promise<void>;
    processAttachmentQueueJob: (job: FirebaseFirestore.QueryDocumentSnapshot) => Promise<void>;
    processAiQueueJob: (job: FirebaseFirestore.QueryDocumentSnapshot) => Promise<void>;
  };
}): Promise<void> {
  const deadline = Date.now() + args.maxWaitMs;
  const sessionRef = admin.firestore().collection("gmail_ingestion_sessions").doc(args.sessionId);

  while (Date.now() < deadline) {
    // Run sequentially to avoid lock contention for the same uid inside a force-run.
    const scanHandled = await runSessionStageWorkers({
      stage: "scan",
      sessionId: args.sessionId,
      limit: FORCE_DRAIN_MAX_JOBS_PER_STAGE,
      lockPrefix: "scan",
      handler: args.handlers.processScanQueueJob,
    });
    const attachmentHandled = await runSessionStageWorkers({
      stage: "attachment",
      sessionId: args.sessionId,
      limit: FORCE_DRAIN_MAX_JOBS_PER_STAGE,
      lockPrefix: "attachment",
      handler: args.handlers.processAttachmentQueueJob,
    });
    const aiHandled = await runSessionStageWorkers({
      stage: "ai_extract",
      sessionId: args.sessionId,
      limit: FORCE_DRAIN_MAX_JOBS_PER_STAGE,
      lockPrefix: "ai",
      handler: args.handlers.processAiQueueJob,
    });
    const aiHandledAfterAttachment = await runSessionStageWorkers({
      stage: "ai_extract",
      sessionId: args.sessionId,
      limit: FORCE_DRAIN_MAX_JOBS_PER_STAGE,
      lockPrefix: "ai",
      handler: args.handlers.processAiQueueJob,
    });

    await maybeFinalizeSession(args.sessionId);
    const [pending, sessionSnap] = await Promise.all([
      countPendingJobsForSession(args.sessionId),
      sessionRef.get(),
    ]);
    const sessionData = asRecord(sessionSnap.data());
    const sessionStatus = asString(sessionData.status);
    if ((sessionStatus === "completed" || sessionStatus === "failed") && pending.total === 0) {
      return;
    }

    const handledThisTick = scanHandled + aiHandled + attachmentHandled + aiHandledAfterAttachment;
    if (pending.total === 0 && handledThisTick === 0) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, FORCE_DRAIN_POLL_MS));
  }
}
