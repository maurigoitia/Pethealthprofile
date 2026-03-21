/**
 * Job processing handlers extracted from clinicalIngestion.ts
 * (Strangler Fig refactoring).
 *
 * Covers:
 * - AES-256-GCM encryption / decryption (temporary document protection)
 * - Temporary raw-document & attachment-extraction persistence
 * - Gmail API helpers (token exchange, JSON fetcher, scope validation)
 * - Attachment download, OCR dispatch, and GCS upload
 * - Plan & pet resolution
 * - The three queue-job handlers: scan, attachment, ai_extract
 * - The scan-session orchestrator (`processSession`)
 */

import * as admin from "firebase-admin";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import { Readable } from "stream";
import { pipeline } from "stream/promises";
import * as mammoth from "mammoth/lib/index";

import type {
  AiExtractQueueJobPayload,
  AttachmentMetadata,
  AttachmentQueueJobPayload,
  ClinicalEventExtraction,
  ClinicalExtractionOutput,
  ExternalLinkExtractionMetadata,
  GmailAttachmentResponse,
  GmailMessageDetailResponse,
  GmailMessageListResponse,
  GmailMessagePart,
  GmailProfileResponse,
  GoogleTokenResponse,
  IngestionStatus,
  PetCandidateProfile,
  PetResolutionHints,
  ProcessOptions,
  QueueJobStage,
  QueueStatus,
  RawDocumentLike,
  ScanQueueJobPayload,
  SessionCounters,
  UserEmailConfig,
  UserPlanType,
} from "./types";

import {
  DEDUP_WINDOW_DAYS,
  FREE_PLAN_ATTACHMENT_PROCESS_LIMIT,
  GMAIL_API_BASE_URL,
  GMAIL_SCOPE_READONLY,
  GOOGLE_GMAIL_PROFILE_URL,
  GOOGLE_TOKEN_URL,
  LOW_RESULT_FALLBACK_MAX_CANDIDATES,
  LOW_RESULT_FALLBACK_MAX_SCANNED,
  MAX_AI_DOCUMENT_TEXT_CHARS,
  MAX_ATTACHMENTS_PER_EMAIL,
  MAX_ATTACHMENT_SIZE_BYTES,
  ONE_DAY_MS,
  RAW_DOCUMENT_TTL_MS,
} from "./types";

import {
  asNonNegativeNumber,
  asRecord,
  asString,
  base64UrlToBase64,
  buildAttachmentStoragePath,
  clamp,
  calculateAgeYears,
  calculateMaxLookbackMonths,
  createBase64DecodeTransform,
  decodeBase64UrlToBuffer,
  decodeBase64UrlToText,
  getMaxMailsPerSync,
  getNowIso,
  iterateBase64Chunks,
  normalizeForHash,
  parseBirthDateFromPet,
  parseDateOnly,
  parseGmailDate,
  parseIsoDate,
  sha256,
  toIsoDateOnly,
} from "./utils";

import {
  domainMatches,
  getAutoIngestConfidenceThreshold,
  getFreePlanMaxEmailsPerSync,
  getMaxConcurrentExtractionJobs,
  getPremiumPlanMaxEmailsPerSync,
  getScanBatchSize,
  isAttachmentStorageEnabled,
  isEmailAllowedForQa,
  isSmartPetMatchingEnabled,
} from "./envConfig";

import {
  extractBodyText,
  fetchAttachmentMetadata as fetchAttachmentMetadataFromParsing,
  getHeader,
  isCandidateClinicalEmail,
  isImageMime,
  isSupportedAttachmentType,
  listAllMessageParts,
  normalizeMimeType,
  sanitizeAttachmentMetadataForFirestore,
} from "./emailParsing";

import {
  classifyClinicalContentWithAi,
  extractClinicalEventsWithAi,
  heuristicClinicalExtraction,
  ocrAttachmentViaGemini,
} from "./clinicalAi";

import {
  applyConstitutionalGuardrails,
  buildBrainEntitiesFromEvent,
  buildCanonicalEventTitle,
  inferBrainCategoryFromSubject,
  isPrescriptionEventType,
  mapEventTypeToBrainCategory,
} from "./clinicalNormalization";

import {
  detectSemanticDuplicateCandidate,
  ingestEventToDomain,
  isDuplicateEventByFingerprint,
  mirrorBrainResolution,
  persistReviewEvent,
  selectBestAttachmentForReview,
  storeKnowledgeSignal,
  upsertClinicalReviewDraft,
  upsertIncompleteTreatmentPendingAction,
  upsertSyncReviewPendingAction,
} from "./reviewActions";

import {
  buildScanCountersPatch,
  countActiveSessions,
  ensurePendingScanJob,
  enqueueStageJob,
  incrementSessionCounters,
  markJobCompleted,
  maybeFinalizeSession,
  recordSessionStageMetric,
  toFirestoreCounterFields,
  updateIngestionProgress,
} from "./sessionQueue";

import {
  fetchExternalLinkTextChunks,
} from "./textProcessing";

import {
  choosePetByHints,
  detectPetIdentityConflict,
  resolvePetConditionHints,
} from "./petMatching";

// ── AES-256-GCM encryption helpers ──────────────────────────────────────────

export function getEncryptionKey(): Buffer {
  const raw = asString(process.env.MAIL_TOKEN_ENCRYPTION_KEY);
  if (!raw) {
    throw new Error("MAIL_TOKEN_ENCRYPTION_KEY missing");
  }
  const maybeB64 = Buffer.from(raw, "base64");
  if (maybeB64.length === 32) return maybeB64;
  return createHash("sha256").update(raw).digest();
}

export function encryptText(value: string): { ciphertext: string; iv: string; tag: string } {
  const key = getEncryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(Buffer.from(value, "utf8")), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    ciphertext: encrypted.toString("base64"),
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
  };
}

export function decryptText(payload: { ciphertext: string; iv: string; tag: string }): string {
  const key = getEncryptionKey();
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(payload.iv, "base64"));
  decipher.setAuthTag(Buffer.from(payload.tag, "base64"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(payload.ciphertext, "base64")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}

export function decryptPayload(input: { ciphertext: string; iv: string; tag: string }): Record<string, unknown> {
  const key = getEncryptionKey();
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(input.iv, "base64"));
  decipher.setAuthTag(Buffer.from(input.tag, "base64"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(input.ciphertext, "base64")),
    decipher.final(),
  ]);
  return JSON.parse(decrypted.toString("utf8")) as Record<string, unknown>;
}

// ── Temporary raw-document persistence ──────────────────────────────────────

export async function persistTemporaryRawDocument(args: {
  uid: string;
  sessionId: string;
  rawDocument: RawDocumentLike;
  sourceSender: string;
  sourceSubject: string;
}): Promise<string> {
  const docId = `${args.sessionId}_${args.rawDocument.message_id}`;
  const nowIso = getNowIso();
  const expiresAtIso = new Date(Date.now() + RAW_DOCUMENT_TTL_MS).toISOString();
  const encrypted = encryptText(args.rawDocument.body_text);
  await admin.firestore().collection("gmail_raw_documents_tmp").doc(docId).set(
    {
      doc_id: docId,
      session_id: args.sessionId,
      user_id: args.uid,
      source: "email",
      message_id: args.rawDocument.message_id,
      thread_id: args.rawDocument.thread_id,
      email_date: args.rawDocument.email_date,
      source_sender: args.sourceSender.slice(0, 320),
      source_subject: args.sourceSubject.slice(0, 400),
      body_text_encrypted: encrypted,
      attachment_meta: sanitizeAttachmentMetadataForFirestore(args.rawDocument.attachment_meta),
      hash_signature_raw: args.rawDocument.hash_signature_raw,
      created_at: nowIso,
      expires_at: expiresAtIso,
    },
    { merge: true }
  );
  return docId;
}

export async function deleteTemporaryRawDocument(docId: string): Promise<void> {
  await admin.firestore().collection("gmail_raw_documents_tmp").doc(docId).delete().catch(() => undefined);
}

export async function loadTemporaryRawDocument(docId: string): Promise<{
  sessionId: string;
  uid: string;
  messageId: string;
  threadId: string;
  emailDate: string;
  sourceSender: string;
  sourceSubject: string;
  bodyText: string;
  attachmentMeta: AttachmentMetadata[];
  hashSignatureRaw: string;
} | null> {
  const snap = await admin.firestore().collection("gmail_raw_documents_tmp").doc(docId).get();
  if (!snap.exists) return null;
  const data = asRecord(snap.data());
  const encrypted = asRecord(data.body_text_encrypted);
  const ciphertext = asString(encrypted.ciphertext);
  const iv = asString(encrypted.iv);
  const tag = asString(encrypted.tag);
  if (!ciphertext || !iv || !tag) return null;
  let bodyText = "";
  try {
    bodyText = decryptText({ ciphertext, iv, tag });
  } catch {
    return null;
  }

  const attachmentMetaRaw = Array.isArray(data.attachment_meta) ? data.attachment_meta : [];
  const attachmentMeta: AttachmentMetadata[] = attachmentMetaRaw.map((row) => {
    const item = asRecord(row);
    return {
      filename: asString(item.filename) || "attachment",
      mimetype: asString(item.mimetype) || "application/octet-stream",
      size_bytes: asNonNegativeNumber(item.size_bytes, 0),
      ocr_success: item.ocr_success === true,
      ocr_reason: asString(item.ocr_reason) || "",
      ocr_detail: asString(item.ocr_detail) || null,
      original_mimetype: asString(item.original_mimetype) || null,
      normalized_mimetype: asString(item.normalized_mimetype) || null,
      storage_uri: asString(item.storage_uri) || null,
      storage_path: asString(item.storage_path) || null,
      storage_bucket: asString(item.storage_bucket) || null,
      storage_signed_url: asString(item.storage_signed_url) || null,
      storage_success: item.storage_success === true,
      storage_error: asString(item.storage_error) || null,
    };
  });

  return {
    sessionId: asString(data.session_id),
    uid: asString(data.user_id),
    messageId: asString(data.message_id),
    threadId: asString(data.thread_id),
    emailDate: asString(data.email_date),
    sourceSender: asString(data.source_sender),
    sourceSubject: asString(data.source_subject),
    bodyText,
    attachmentMeta,
    hashSignatureRaw: asString(data.hash_signature_raw),
  };
}

// ── Temporary attachment-extraction persistence ─────────────────────────────

export async function saveTemporaryAttachmentExtraction(args: {
  rawDocId: string;
  sessionId: string;
  uid: string;
  attachmentMetadata: AttachmentMetadata[];
  extractedText: string;
}): Promise<void> {
  const encrypted = encryptText(args.extractedText);
  const expiresAtIso = new Date(Date.now() + RAW_DOCUMENT_TTL_MS).toISOString();
  await admin.firestore().collection("gmail_attachment_extract_tmp").doc(args.rawDocId).set(
    {
      raw_doc_id: args.rawDocId,
      session_id: args.sessionId,
      user_id: args.uid,
      attachment_metadata: sanitizeAttachmentMetadataForFirestore(args.attachmentMetadata),
      extracted_text_encrypted: encrypted,
      created_at: getNowIso(),
      expires_at: expiresAtIso,
    },
    { merge: true }
  );
}

export async function loadTemporaryAttachmentExtraction(rawDocId: string): Promise<{
  attachmentMetadata: AttachmentMetadata[];
  extractedText: string;
} | null> {
  const snap = await admin.firestore().collection("gmail_attachment_extract_tmp").doc(rawDocId).get();
  if (!snap.exists) return null;
  const data = asRecord(snap.data());
  const encrypted = asRecord(data.extracted_text_encrypted);
  const ciphertext = asString(encrypted.ciphertext);
  const iv = asString(encrypted.iv);
  const tag = asString(encrypted.tag);
  let extractedText = "";
  if (ciphertext && iv && tag) {
    try {
      extractedText = decryptText({ ciphertext, iv, tag });
    } catch {
      extractedText = "";
    }
  }
  const attachmentMetaRaw = Array.isArray(data.attachment_metadata) ? data.attachment_metadata : [];
  const attachmentMetadata: AttachmentMetadata[] = attachmentMetaRaw.map((row) => {
    const item = asRecord(row);
    return {
      filename: asString(item.filename) || "attachment",
      mimetype: asString(item.mimetype) || "application/octet-stream",
      size_bytes: asNonNegativeNumber(item.size_bytes, 0),
      ocr_success: item.ocr_success === true,
      ocr_reason: asString(item.ocr_reason) || "",
      ocr_detail: asString(item.ocr_detail) || null,
      original_mimetype: asString(item.original_mimetype) || null,
      normalized_mimetype: asString(item.normalized_mimetype) || null,
      storage_uri: asString(item.storage_uri) || null,
      storage_path: asString(item.storage_path) || null,
      storage_bucket: asString(item.storage_bucket) || null,
      storage_signed_url: asString(item.storage_signed_url) || null,
      storage_success: item.storage_success === true,
      storage_error: asString(item.storage_error) || null,
    };
  });
  return {
    attachmentMetadata,
    extractedText,
  };
}

export async function deleteTemporaryAttachmentExtraction(rawDocId: string): Promise<void> {
  await admin.firestore().collection("gmail_attachment_extract_tmp").doc(rawDocId).delete().catch(() => undefined);
}

export async function purgeExpiredRawDocuments(limit = 50): Promise<void> {
  const cutoffIso = getNowIso();
  const stale = await admin
    .firestore()
    .collection("gmail_raw_documents_tmp")
    .where("expires_at", "<=", cutoffIso)
    .limit(limit)
    .get();
  if (stale.empty) return;
  await Promise.all(stale.docs.map((doc) => doc.ref.delete().catch(() => undefined)));

  const staleAttachment = await admin
    .firestore()
    .collection("gmail_attachment_extract_tmp")
    .where("expires_at", "<=", cutoffIso)
    .limit(limit)
    .get();
  if (!staleAttachment.empty) {
    await Promise.all(staleAttachment.docs.map((doc) => doc.ref.delete().catch(() => undefined)));
  }
}

// ── Gmail API helpers ───────────────────────────────────────────────────────

export async function callGoogleJson<T>(url: string, accessToken: string): Promise<T> {
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
  return (await response.json()) as T;
}

export function isMetadataOnlyScopeError(error: unknown): boolean {
  const message = String(error || "");
  if (!message.includes("google_api_failed_403")) return false;
  return /metadata scope|format\s*full|scope does not support format full/i.test(message);
}

export async function assertGmailFullPayloadAccess(accessToken: string): Promise<void> {
  const listUrl = new URL(`${GMAIL_API_BASE_URL}/messages`);
  listUrl.searchParams.set("maxResults", "1");
  const listResponse = await callGoogleJson<GmailMessageListResponse>(listUrl.toString(), accessToken);
  const messageId = (Array.isArray(listResponse.messages) ? listResponse.messages : [])
    .map((row) => asString(row.id))
    .find(Boolean);
  if (!messageId) return;

  const detailUrl = new URL(`${GMAIL_API_BASE_URL}/messages/${encodeURIComponent(messageId)}`);
  detailUrl.searchParams.set("format", "full");
  const detail = await callGoogleJson<GmailMessageDetailResponse>(detailUrl.toString(), accessToken);
  if (!detail.payload) {
    throw new Error("gmail_full_payload_unavailable");
  }
}

export async function markGmailReconsentRequired(args: {
  uid: string;
  sessionRef: FirebaseFirestore.DocumentReference<FirebaseFirestore.DocumentData>;
}): Promise<void> {
  const nowIso = getNowIso();
  await args.sessionRef.set(
    {
      status: "failed",
      updated_at: nowIso,
      error: "gmail_reconsent_required",
    },
    { merge: true }
  );

  await admin.firestore().collection("user_email_config").doc(args.uid).set(
    {
      ingestion_status: "requires_review",
      sync_status: "requires_review",
      oauth_status: "reconsent_required",
      last_error: "gmail_reconsent_required",
      updated_at: nowIso,
    },
    { merge: true }
  );

  await admin.firestore().collection("users").doc(args.uid).set(
    {
      gmailSync: {
        connected: false,
        inviteEnabled: true,
        inviteStatus: "reconsent_required",
        updatedAt: nowIso,
        reconsentRequiredAt: nowIso,
        lastError: "gmail_reconsent_required",
      },
    },
    { merge: true }
  );

  await updateIngestionProgress(args.uid, "requires_review");
}

export async function exchangeRefreshToken(params: {
  refreshToken: string;
  clientId: string;
  clientSecret: string;
}): Promise<string> {
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
  const payload = (await response.json()) as GoogleTokenResponse;
  const accessToken = asString(payload.access_token);
  if (!accessToken) throw new Error("missing_access_token_from_refresh");
  return accessToken;
}

export async function fetchUserRefreshToken(uid: string): Promise<{ refreshToken: string; grantedScopes: string[] }> {
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
  const data = asRecord(snap.data());
  const ciphertext = asString(data.ciphertext);
  const iv = asString(data.iv);
  const tag = asString(data.tag);
  if (!ciphertext || !iv || !tag) {
    throw new Error("gmail_token_invalid");
  }
  const decrypted = decryptPayload({ ciphertext, iv, tag });
  const refreshToken = asString(decrypted.refreshToken);
  if (!refreshToken) {
    throw new Error("gmail_refresh_token_missing");
  }
  const grantedScopes = Array.isArray(decrypted.grantedScopes)
    ? decrypted.grantedScopes.filter((row): row is string => typeof row === "string")
    : [];
  return { refreshToken, grantedScopes };
}

export async function fetchGmailProfile(accessToken: string): Promise<{ email: string | null; historyId: string | null }> {
  try {
    const profile = await callGoogleJson<GmailProfileResponse>(GOOGLE_GMAIL_PROFILE_URL, accessToken);
    return {
      email: asString(profile.emailAddress) || null,
      historyId: asString(profile.historyId) || null,
    };
  } catch {
    return { email: null, historyId: null };
  }
}

// ── Attachment storage upload ───────────────────────────────────────────────

export async function uploadAttachmentBase64ToStorage(args: {
  base64UrlData: string;
  mimeType: string;
  uid: string;
  sessionId: string;
  messageId: string;
  attachmentId: string;
  filename: string;
}): Promise<{
  ok: boolean;
  uri: string | null;
  path: string | null;
  bucket: string | null;
  signedUrl: string | null;
  error: string | null;
}> {
  if (!isAttachmentStorageEnabled()) {
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
    const objectPath = buildAttachmentStoragePath({
      uid: args.uid,
      sessionId: args.sessionId,
      messageId: args.messageId,
      attachmentId: args.attachmentId,
      filename: args.filename,
    });
    const file = bucket.file(objectPath);
    const normalizedBase64 = base64UrlToBase64(args.base64UrlData);

    await pipeline(
      Readable.from(iterateBase64Chunks(normalizedBase64), { encoding: "ascii" }),
      createBase64DecodeTransform(),
      file.createWriteStream({
        resumable: false,
        metadata: {
          contentType: args.mimeType || "application/octet-stream",
          metadata: {
            source: "gmail_ingestion",
            message_id: args.messageId,
            attachment_id: args.attachmentId,
            uploaded_at: getNowIso(),
          },
        },
      })
    );

    let signedUrl: string | null = null;
    try {
      const [url] = await file.getSignedUrl({
        version: "v4",
        action: "read",
        expires: Date.now() + (6 * 60 * 60 * 1000),
      });
      signedUrl = asString(url) || null;
    } catch {
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
  } catch (error) {
    return {
      ok: false,
      uri: null,
      path: null,
      bucket: null,
      signedUrl: null,
      error: String((error as Error)?.message || error).slice(0, 300),
    };
  }
}

// ── DOCX text extraction ────────────────────────────────────────────────────

export async function extractDocxTextFromBase64(base64DataOrUrl: string): Promise<string> {
  const buffer = decodeBase64UrlToBuffer(base64DataOrUrl);
  const result = await mammoth.extractRawText({ buffer });
  return asString(result.value).slice(0, 40_000);
}

// ── Attachment text-chunk fetcher ───────────────────────────────────────────

export async function fetchAttachmentTextChunks(args: {
  accessToken: string;
  uid: string;
  sessionId: string;
  messageId: string;
  payload: GmailMessagePart | undefined;
  maxAttachmentsToProcess: number;
}): Promise<{ attachmentMetadata: AttachmentMetadata[]; extractedChunks: string[]; processedCount: number }> {
  const allParts = listAllMessageParts(args.payload);
  const attachments = allParts
    .filter((part) => Boolean(asString(part.filename) || asString(part.body?.attachmentId)))
    .slice(0, MAX_ATTACHMENTS_PER_EMAIL);

  const metadata: AttachmentMetadata[] = [];
  const extractedChunks: string[] = [];
  let processedCount = 0;

  for (const part of attachments) {
    const filename = asString(part.filename) || "attachment";
    const originalMimeType = asString(part.mimeType).toLowerCase() || "application/octet-stream";
    const mimeType = normalizeMimeType(originalMimeType, filename);
    const attachmentId = asString(part.body?.attachmentId);
    const sizeBytes = asNonNegativeNumber(part.body?.size, 0);
    const supported = isSupportedAttachmentType(filename, mimeType);
    const oversized = sizeBytes > MAX_ATTACHMENT_SIZE_BYTES;

    if (!supported || oversized || !attachmentId || processedCount >= args.maxAttachmentsToProcess) {
      let reason = "unsupported_mime";
      if (oversized) reason = "oversized_attachment";
      else if (!attachmentId) reason = "missing_attachment_id";
      else if (processedCount >= args.maxAttachmentsToProcess) reason = "plan_attachment_limit_reached";

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
    let reason = "unknown";
    let detail: string | null = null;
    let storageUri: string | null = null;
    let storagePath: string | null = null;
    let storageBucket: string | null = null;
    let storageSignedUrl: string | null = null;
    let storageError: string | null = null;

    try {
      const attachmentUrl =
        `${GMAIL_API_BASE_URL}/messages/${encodeURIComponent(args.messageId)}/attachments/${encodeURIComponent(attachmentId)}`;
      const attachmentResponse = await callGoogleJson<GmailAttachmentResponse>(attachmentUrl, args.accessToken);
      const data = asString(attachmentResponse.data);
      if (!data) {
        reason = "empty_attachment_payload";
      } else {
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

        const isPlainText =
          mimeType.startsWith("text/") ||
          filename.toLowerCase().endsWith(".txt") ||
          filename.toLowerCase().endsWith(".csv");

        if (isPlainText) {
          extractedText = decodeBase64UrlToText(data).slice(0, 40_000);
          ocrSuccess = Boolean(extractedText.trim());
          reason = ocrSuccess ? "plain_text_decode" : "plain_text_empty";
        } else if (mimeType === "application/dicom" || filename.toLowerCase().endsWith(".dcm")) {
          extractedText = "";
          ocrSuccess = false;
          reason = "dicom_skipped";
        } else if (
          mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
          filename.toLowerCase().endsWith(".docx")
        ) {
          try {
            extractedText = await extractDocxTextFromBase64(data);
            ocrSuccess = Boolean(extractedText.trim());
            reason = ocrSuccess ? "docx_native_parse" : "docx_empty";
          } catch (error) {
            extractedText = "";
            ocrSuccess = false;
            reason = "docx_parse_failed";
            detail = String((error as Error)?.message || error).slice(0, 300);
          }
        } else if (mimeType === "application/pdf" || isImageMime(mimeType)) {
          try {
            const normalizedBase64 = base64UrlToBase64(data);
            extractedText = await ocrAttachmentViaGemini({
              mimeType,
              base64Data: normalizedBase64,
            });
            ocrSuccess = Boolean(extractedText.trim());
            reason = ocrSuccess ? "gemini_ocr" : "gemini_ocr_empty";
          } catch (error) {
            extractedText = "";
            ocrSuccess = false;
            reason = "gemini_ocr_failed";
            detail = String((error as Error)?.message || error).slice(0, 300);
          }
        } else {
          extractedText = "";
          ocrSuccess = false;
          reason = "unsupported_mime";
        }
      }
    } catch (error) {
      console.warn(`[gmail-ingestion] attachment OCR failed (${filename}):`, error);
      ocrSuccess = false;
      reason = "attachment_download_failed";
      detail = String((error as Error)?.message || error).slice(0, 300);
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
    if (extractedText.trim()) extractedChunks.push(extractedText.trim());
    processedCount += 1;
  }

  return {
    attachmentMetadata: metadata,
    extractedChunks,
    processedCount,
  };
}

// ── Plan & pet resolution ───────────────────────────────────────────────────

export async function resolvePlanAndPet(args: {
  uid: string;
  preferredPetId?: string | null;
  contextHints?: PetResolutionHints | null;
}): Promise<{
  planType: UserPlanType;
  petId: string | null;
  petName: string | null;
  fallbackPetId: string | null;
  fallbackPetName: string | null;
  activePetCount: number;
  petBirthDateIso: string | null;
  petAgeYears: number;
  petContext: Record<string, unknown>;
  petResolutionDebug: Record<string, unknown>;
}> {
  const overrideSnap = await admin.firestore().collection("email_sync_plan_overrides").doc(args.uid).get();
  const overrideData = asRecord(overrideSnap.data());
  const overridePlanRaw = asString(overrideData.plan_type).toLowerCase();

  const userSnap = await admin.firestore().collection("users").doc(args.uid).get();
  const userData = asRecord(userSnap.data());
  const userEmail = asString(userData.email).toLowerCase();
  const candidatePlans = [
    asString(userData.plan),
    asString(userData.planType),
    asString(userData.subscriptionPlan),
    asString(asRecord(userData.subscription).plan),
  ]
    .join(" ")
    .toLowerCase();
  const isPremiumByProfile = ["premium", "pro", "founder", "unlimited"].some((token) => candidatePlans.includes(token));
  const planType: UserPlanType = overridePlanRaw === "premium" || (overridePlanRaw !== "free" && isPremiumByProfile)
    ? "premium"
    : "free";

  const canUseSmartPetHints = isSmartPetMatchingEnabled() && isEmailAllowedForQa(userEmail || "");
  const ownerPets = await admin
    .firestore()
    .collection("pets")
    .where("ownerId", "==", args.uid)
    .limit(12)
    .get();
  const ownerPetRows = ownerPets.docs.map((doc) => ({ id: doc.id, data: asRecord(doc.data()) }));
  const activePetCount = ownerPetRows.length;
  const fallbackPet = activePetCount === 1 ? ownerPetRows[0] : null;
  const petCandidates = canUseSmartPetHints
    ? await Promise.all(
      ownerPetRows.map(async (row) => ({
        id: row.id,
        data: row.data,
        name: asString(row.data.name),
        species: asString(row.data.species),
        breed: asString(row.data.breed),
        knownConditions: await resolvePetConditionHints(row.id, row.data),
      } satisfies PetCandidateProfile))
    )
    : [];
  let petId = asString(args.preferredPetId) || null;
  let petData: Record<string, unknown> | null = null;
  let petResolutionDebug: Record<string, unknown> = {
    mode: petId ? "preferred_pet_id" : "unresolved",
    smart_matching_enabled: canUseSmartPetHints,
    active_pet_count: activePetCount,
    fallback_pet_id: fallbackPet?.id || null,
    fallback_pet_name: asString(fallbackPet?.data?.name) || null,
  };
  if (petId) {
    const petSnap = await admin.firestore().collection("pets").doc(petId).get();
    if (petSnap.exists) {
      petData = asRecord(petSnap.data());
      petResolutionDebug = {
        mode: "preferred_pet_id",
        smart_matching_enabled: canUseSmartPetHints,
        chosen_pet_id: petId,
        chosen_pet_name: asString(petData.name) || null,
        active_pet_count: activePetCount,
        fallback_pet_id: fallbackPet?.id || null,
        fallback_pet_name: asString(fallbackPet?.data?.name) || null,
      };
    } else {
      petResolutionDebug = {
        mode: "preferred_pet_missing",
        smart_matching_enabled: canUseSmartPetHints,
        requested_pet_id: petId,
        active_pet_count: activePetCount,
        fallback_pet_id: fallbackPet?.id || null,
        fallback_pet_name: asString(fallbackPet?.data?.name) || null,
      };
    }
  }
  if (!petData) {
    if (canUseSmartPetHints && petCandidates.length > 1) {
      const matched = choosePetByHints({
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
          fallback_pet_id: fallbackPet?.id || null,
          fallback_pet_name: asString(fallbackPet?.data?.name) || null,
        };
      } else {
        petResolutionDebug = {
          mode: "smart_match_ambiguous",
          smart_matching_enabled: true,
          candidate_count: petCandidates.length,
          active_pet_count: activePetCount,
          fallback_pet_id: fallbackPet?.id || null,
          fallback_pet_name: asString(fallbackPet?.data?.name) || null,
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
        chosen_pet_name: asString(petData.name) || null,
        active_pet_count: activePetCount,
        fallback_pet_id: fallbackPet.id,
        fallback_pet_name: asString(fallbackPet.data.name) || null,
      };
    } else if (!petData && activePetCount > 1) {
      petId = null;
      petData = null;
      petResolutionDebug = {
        mode: "ambiguous_multi_pet",
        smart_matching_enabled: canUseSmartPetHints,
        candidate_count: activePetCount,
        active_pet_count: activePetCount,
        fallback_pet_id: fallbackPet?.id || null,
        fallback_pet_name: asString(fallbackPet?.data?.name) || null,
      };
    } else if (!petData && activePetCount === 0) {
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
    const chosenCandidate =
      petCandidates.find((candidate) => candidate.id === petId) || {
        id: petId || "unknown_pet",
        data: petData,
        name: asString(petData.name),
        species: asString(petData.species),
        breed: asString(petData.breed),
        knownConditions: await resolvePetConditionHints(petId || "", petData),
      };
    const identityConflict = detectPetIdentityConflict({
      pets: petCandidates.filter((row) => Boolean(row.name)),
      chosenPet: chosenCandidate,
      subjectText: args.contextHints?.subjectText,
      bodyText: args.contextHints?.bodyText,
    });
    if (identityConflict.hasConflict) {
      petResolutionDebug = {
        ...petResolutionDebug,
        identity_conflict: true,
        identity_conflict_label: identityConflict.label,
        identity_conflict_reasons: identityConflict.reasons,
        species_signals: identityConflict.speciesSignals,
        mentioned_pet_names: identityConflict.mentionedPetNames,
        requires_human_review: true,
      };
    }
  }

  const birthDate = parseBirthDateFromPet(petData || {});
  const petAgeYears = calculateAgeYears(birthDate);
  const petBirthDateIso = birthDate ? birthDate.toISOString() : null;

  return {
    planType,
    petId,
    petName: asString((petData || {}).name) || null,
    fallbackPetId: fallbackPet?.id || null,
    fallbackPetName: asString(fallbackPet?.data?.name) || null,
    activePetCount,
    petBirthDateIso,
    petAgeYears,
    petContext: {
      name: asString((petData || {}).name) || null,
      species: asString((petData || {}).species) || null,
      breed: asString((petData || {}).breed) || null,
      age_years: petAgeYears,
      active_pet_count: activePetCount,
      fallback_pet_id: fallbackPet?.id || null,
      fallback_pet_name: asString(fallbackPet?.data?.name) || null,
      identity_conflict: petResolutionDebug.identity_conflict === true,
      identity_conflict_label: asString(petResolutionDebug.identity_conflict_label) || null,
      known_conditions: Array.isArray((petData || {}).knownConditions)
        ? ((petData || {}).knownConditions as unknown[]).filter((row): row is string => typeof row === "string")
        : [],
      known_allergies: Array.isArray((petData || {}).knownAllergies)
        ? ((petData || {}).knownAllergies as unknown[]).filter((row): row is string => typeof row === "string")
        : [],
    },
    petResolutionDebug,
  };
}

// ── Scan queue-job handler ──────────────────────────────────────────────────

export async function processScanQueueJob(
  doc: FirebaseFirestore.QueryDocumentSnapshot<FirebaseFirestore.DocumentData>
): Promise<void> {
  const data = asRecord(doc.data());
  const sessionId = asString(data.session_id);
  const uid = asString(data.user_id);
  if (!sessionId || !uid) {
    await markJobCompleted(doc.ref);
    return;
  }

  const sessionSnap = await admin.firestore().collection("gmail_ingestion_sessions").doc(sessionId).get();
  if (!sessionSnap.exists) {
    await markJobCompleted(doc.ref);
    return;
  }
  const sessionData = asRecord(sessionSnap.data());
  const status = asString(sessionData.status);
  if (status === "completed" || status === "requires_review" || status === "failed") {
    await markJobCompleted(doc.ref);
    return;
  }

  await processSession(sessionId, {
    maxEmailsToProcess: getScanBatchSize(),
    hardDeadlineMs: 4 * 60 * 1000,
  });

  const refreshed = await admin.firestore().collection("gmail_ingestion_sessions").doc(sessionId).get();
  const refreshedData = asRecord(refreshed.data());
  const refreshedStatus = asString(refreshedData.status);
  const scanComplete = refreshedData.scan_complete === true;
  const hasNextPage = Boolean(asString(refreshedData.next_page_token));
  if (!scanComplete && (refreshedStatus === "queued" || refreshedStatus === "processing") && hasNextPage) {
    await ensurePendingScanJob(sessionId, uid);
  }

  await markJobCompleted(doc.ref);
  await maybeFinalizeSession(sessionId);
}

// ── Attachment queue-job handler ────────────────────────────────────────────

export async function processAttachmentQueueJob(
  doc: FirebaseFirestore.QueryDocumentSnapshot<FirebaseFirestore.DocumentData>
): Promise<void> {
  const data = asRecord(doc.data());
  const payload = asRecord(data.payload) as unknown as AttachmentQueueJobPayload;
  const messageId = asString(payload.message_id);
  const rawDocId = asString(payload.raw_doc_id);
  const sessionId = asString(data.session_id);
  const uid = asString(data.user_id);
  if (!messageId || !rawDocId || !sessionId || !uid) {
    await markJobCompleted(doc.ref);
    return;
  }

  const rawDoc = await loadTemporaryRawDocument(rawDocId);
  if (!rawDoc) {
    await markJobCompleted(doc.ref);
    await maybeFinalizeSession(sessionId);
    return;
  }

  const token = await fetchUserRefreshToken(uid);
  const clientId = asString(process.env.GMAIL_OAUTH_CLIENT_ID);
  const clientSecret = asString(process.env.GMAIL_OAUTH_CLIENT_SECRET);
  if (!clientId || !clientSecret) {
    throw new Error("gmail_client_credentials_missing");
  }
  const accessToken = await exchangeRefreshToken({
    refreshToken: token.refreshToken,
    clientId,
    clientSecret,
  });

  const configSnap = await admin.firestore().collection("user_email_config").doc(uid).get();
  const config = asRecord(configSnap.data());
  const planType = (asString(config.plan_type) === "premium" ? "premium" : "free") as UserPlanType;

  const sessionSnap = await admin.firestore().collection("gmail_ingestion_sessions").doc(sessionId).get();
  const sessionData = asRecord(sessionSnap.data());
  const counters = asRecord(sessionData.counters);
  const alreadyProcessedAttachments = asNonNegativeNumber(counters.total_attachments_processed, 0);
  const maxAttachmentsToProcess = planType === "free"
    ? Math.max(0, FREE_PLAN_ATTACHMENT_PROCESS_LIMIT - alreadyProcessedAttachments)
    : MAX_ATTACHMENTS_PER_EMAIL;

  const detailUrl = new URL(`${GMAIL_API_BASE_URL}/messages/${encodeURIComponent(messageId)}`);
  detailUrl.searchParams.set("format", "full");
  const detail = await callGoogleJson<GmailMessageDetailResponse>(detailUrl.toString(), accessToken);

  await updateIngestionProgress(uid, "extracting_medical_events");
  const started = Date.now();
  const attachmentExtraction = await fetchAttachmentTextChunks({
    accessToken,
    uid,
    sessionId,
    messageId,
    payload: detail.payload,
    maxAttachmentsToProcess,
  });
  await recordSessionStageMetric({
    sessionId,
    stageKey: "attachment",
    durationMs: Date.now() - started,
  });

  await incrementSessionCounters(sessionId, {
    total_attachments_processed: attachmentExtraction.processedCount,
  });

  await saveTemporaryAttachmentExtraction({
    rawDocId,
    sessionId,
    uid,
    attachmentMetadata: attachmentExtraction.attachmentMetadata,
    extractedText: attachmentExtraction.extractedChunks.join("\n\n").slice(0, 250_000),
  });

  await enqueueStageJob<AiExtractQueueJobPayload>({
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
  await markJobCompleted(doc.ref);
  await maybeFinalizeSession(sessionId);
}

// ── AI-extract queue-job handler ────────────────────────────────────────────

export async function processAiQueueJob(
  doc: FirebaseFirestore.QueryDocumentSnapshot<FirebaseFirestore.DocumentData>
): Promise<void> {
  const data = asRecord(doc.data());
  const payload = asRecord(data.payload) as unknown as AiExtractQueueJobPayload;
  const messageId = asString(payload.message_id);
  const rawDocId = asString(payload.raw_doc_id);
  const sourceSender = asString(payload.source_sender);
  const sourceSubject = asString(payload.source_subject);
  const mode = (asString(payload.mode) === "extract" ? "extract" : "classify") as "classify" | "extract";
  const sessionId = asString(data.session_id);
  const uid = asString(data.user_id);
  if (!messageId || !rawDocId || !sessionId || !uid) {
    await markJobCompleted(doc.ref);
    return;
  }

  const rawDoc = await loadTemporaryRawDocument(rawDocId);
  if (!rawDoc) {
    await markJobCompleted(doc.ref);
    await maybeFinalizeSession(sessionId);
    return;
  }

  if (mode === "classify") {
    await updateIngestionProgress(uid, "analyzing_documents");
    const classification = await classifyClinicalContentWithAi(
      {
        bodyText: rawDoc.bodyText,
        subject: sourceSubject,
        fromEmail: sourceSender,
        attachmentMetadata: rawDoc.attachmentMeta,
      },
      sessionId
    );

    if (!classification.is_clinical) {
      await admin.firestore().collection("gmail_ingestion_documents").doc(`${sessionId}_${messageId}`).set(
        {
          session_id: sessionId,
          user_id: uid,
          message_id: messageId,
          thread_id: rawDoc.threadId,
          email_date: rawDoc.emailDate,
          from_email: sourceSender,
          subject: sourceSubject.slice(0, 400),
          attachment_count: rawDoc.attachmentMeta.length,
          attachment_metadata: sanitizeAttachmentMetadataForFirestore(rawDoc.attachmentMeta),
          hash_signature_raw: rawDoc.hashSignatureRaw,
          ai_classification: classification,
          processing_status: "discarded_non_clinical",
          created_at: getNowIso(),
        },
        { merge: true }
      );
      await deleteTemporaryRawDocument(rawDocId);
      await markJobCompleted(doc.ref);
      await maybeFinalizeSession(sessionId);
      return;
    }

    await enqueueStageJob<AttachmentQueueJobPayload>({
      stage: "attachment",
      sessionId,
      uid,
      payload: {
        message_id: messageId,
        raw_doc_id: rawDocId,
      },
    });
    await admin.firestore().collection("gmail_ingestion_documents").doc(`${sessionId}_${messageId}`).set(
      {
        session_id: sessionId,
        user_id: uid,
        message_id: messageId,
        thread_id: rawDoc.threadId,
        email_date: rawDoc.emailDate,
        from_email: sourceSender,
        subject: sourceSubject.slice(0, 400),
        attachment_count: rawDoc.attachmentMeta.length,
        attachment_metadata: sanitizeAttachmentMetadataForFirestore(rawDoc.attachmentMeta),
        hash_signature_raw: rawDoc.hashSignatureRaw,
        ai_classification: classification,
        processing_status: "queued_attachment_ocr",
        updated_at: getNowIso(),
      },
      { merge: true }
    );
    await markJobCompleted(doc.ref);
    return;
  }

  const attachmentTmp = await loadTemporaryAttachmentExtraction(rawDocId);
  const attachmentText = attachmentTmp?.extractedText || "";
  const attachmentMetadata = attachmentTmp?.attachmentMetadata || rawDoc.attachmentMeta;
  const hasExternalLinkSignal =
    /https?:\/\/|href\s*=|\b(link|enlace|adjunto|attachment|pdf|drive|resultados|receta|estudio)\b/i.test(
      `${sourceSubject}\n${rawDoc.bodyText}`
    );
  const shouldTryExternalLinks = hasExternalLinkSignal && (!attachmentText.trim() || attachmentMetadata.length === 0);
  const externalLinkExtraction = shouldTryExternalLinks
    ? await fetchExternalLinkTextChunks({
      bodyText: rawDoc.bodyText,
      sourceSender,
    })
    : { detectedCount: 0, fetchedCount: 0, extractedChunks: [] as string[], metadata: [] as ExternalLinkExtractionMetadata[] };
  const externalLinkRequiresLogin = externalLinkExtraction.metadata.some(
    (row) => row.login_required === true || /login_required/i.test(asString(row.reason))
  );
  const extractedText = [rawDoc.bodyText, attachmentText, externalLinkExtraction.extractedChunks.join("\n\n")]
    .join("\n\n")
    .trim()
    .slice(0, MAX_AI_DOCUMENT_TEXT_CHARS * 2);

  const configSnap = await admin.firestore().collection("user_email_config").doc(uid).get();
  const config = asRecord(configSnap.data()) as unknown as UserEmailConfig;
  const petId = config.pet_id || null;
  const planAndPet = await resolvePlanAndPet({
    uid,
    preferredPetId: petId,
    contextHints: {
      subjectText: sourceSubject,
      bodyText: extractedText,
    },
  });
  const effectivePetId = planAndPet.petId || petId;
  const identityConflict = planAndPet.petResolutionDebug.identity_conflict === true;
  const identityConflictReason = identityConflict ? "IDENTITY_CONFLICT" : null;
  const sessionSettingsSnap = await admin.firestore().collection("gmail_ingestion_sessions").doc(sessionId).get();
  const sessionSettings = asRecord(sessionSettingsSnap.data());
  const dedupDisabled = sessionSettings.qa_disable_dedup === true;

  await updateIngestionProgress(uid, "extracting_medical_events");
  const extractionStarted = Date.now();
  const clinical = await extractClinicalEventsWithAi({
    extractedText,
    emailDate: rawDoc.emailDate,
    sourceSubject,
    sourceSender,
    petContext: planAndPet.petContext,
    attachmentMetadata,
    sessionId,
  });
  await recordSessionStageMetric({
    sessionId,
    stageKey: "extraction",
    durationMs: Date.now() - extractionStarted,
  });

  if (!clinical.is_clinical_content || clinical.confidence_overall < 60) {
    const lowConfidenceReason = asString(clinical.reason_if_review_needed);
    const looksLikeExternalClinicalLink =
      /\b(link|enlace|adjunto|attachment|pdf|drive|resultados|receta|estudio)\b/i.test(
        `${sourceSubject}\n${rawDoc.bodyText}\n${lowConfidenceReason}`
      );
    const shouldRouteToReview =
      clinical.is_clinical_content || looksLikeExternalClinicalLink || externalLinkRequiresLogin || identityConflict;
    const preferredAttachment = selectBestAttachmentForReview(attachmentMetadata);
    const lowConfidenceReviewReason =
      identityConflictReason ||
      lowConfidenceReason ||
      (externalLinkRequiresLogin ? "external_link_login_required" : "low_confidence_external_reference");

    if (shouldRouteToReview) {
      const fallbackOperationalEvent =
        heuristicClinicalExtraction(`${sourceSubject}\n${rawDoc.bodyText}`, rawDoc.emailDate).detected_events[0] || null;
      const syntheticEvent: ClinicalEventExtraction = {
        event_type: fallbackOperationalEvent?.event_type || "clinical_report",
        event_date: toIsoDateOnly(parseIsoDate(rawDoc.emailDate) || new Date()),
        date_confidence: 40,
        description_summary:
          lowConfidenceReason ||
          "Contenido clínico potencial detectado con baja confianza. Requiere revisión manual.",
        diagnosis: null,
        medications: [],
        lab_results: [],
        imaging_type: null,
        study_subtype: fallbackOperationalEvent?.study_subtype || null,
        appointment_time: fallbackOperationalEvent?.appointment_time || null,
        appointment_specialty: fallbackOperationalEvent?.appointment_specialty || null,
        professional_name: fallbackOperationalEvent?.professional_name || null,
        clinic_name: fallbackOperationalEvent?.clinic_name || null,
        appointment_status: fallbackOperationalEvent?.appointment_status || null,
        severity: null,
        confidence_score: clamp(clinical.confidence_overall, 0, 100),
      };
      const gmailReviewId = await persistReviewEvent({
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
      await upsertSyncReviewPendingAction({
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
      await incrementSessionCounters(sessionId, { events_requiring_review: 1 });
    }

    await mirrorBrainResolution({
      uid,
      petReference: asString(planAndPet.petContext.name) || null,
      petIdHint: effectivePetId,
      category: inferBrainCategoryFromSubject(sourceSubject),
      entities: [{
        type: "low_confidence_document",
        summary: clinical.narrative_summary.slice(0, 600),
        reason: lowConfidenceReason || null,
      }],
      confidence01: clamp(clinical.confidence_overall / 100, 0, 1),
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
          image_fragment_url: preferredAttachment?.storage_signed_url || null,
          storage_uri: preferredAttachment?.storage_uri || null,
          storage_path: preferredAttachment?.storage_path || null,
          source_file_name: preferredAttachment?.filename || null,
        },
      },
    });

    await admin.firestore().collection("gmail_ingestion_documents").doc(`${sessionId}_${messageId}`).set(
      {
        session_id: sessionId,
        user_id: uid,
        message_id: messageId,
        thread_id: rawDoc.threadId,
        email_date: rawDoc.emailDate,
        from_email: sourceSender,
        subject: sourceSubject.slice(0, 400),
        attachment_count: attachmentMetadata.length,
        attachment_metadata: sanitizeAttachmentMetadataForFirestore(attachmentMetadata),
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
        created_at: getNowIso(),
      },
      { merge: true }
    );
    await deleteTemporaryAttachmentExtraction(rawDocId);
    await deleteTemporaryRawDocument(rawDocId);
    await markJobCompleted(doc.ref);
    await maybeFinalizeSession(sessionId);
    return;
  }

  let createdForMessage = 0;
  let reviewsForMessage = 0;
  let duplicatesForMessage = 0;
  const preferredAttachment = selectBestAttachmentForReview(attachmentMetadata);

  for (const event of clinical.detected_events) {
    if (!dedupDisabled) {
      const semanticDuplicate = await detectSemanticDuplicateCandidate({
        uid,
        petId: effectivePetId,
        event,
        sourceSender,
      });
      if (semanticDuplicate.isLikelyDuplicate) {
        reviewsForMessage += 1;
        const gmailReviewId = await persistReviewEvent({
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
        await upsertSyncReviewPendingAction({
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
        await storeKnowledgeSignal({
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

      if (await isDuplicateEventByFingerprint({ uid, petId: effectivePetId, event })) {
        duplicatesForMessage += 1;
        continue;
      }
    }

    const missingDoseInTreatment =
      isPrescriptionEventType(event.event_type) &&
      event.medications.some((row) => !asString(row.dose) || !asString(row.frequency));
    const autoIngestThreshold = getAutoIngestConfidenceThreshold();
    const requiresReview =
      identityConflict ||
      clinical.confidence_overall < autoIngestThreshold ||
      event.confidence_score < autoIngestThreshold ||
      clinical.requires_human_review ||
      externalLinkRequiresLogin ||
      missingDoseInTreatment;

    if (requiresReview) {
      const reviewReason =
        identityConflictReason ||
        clinical.reason_if_review_needed ||
        (externalLinkRequiresLogin ? "external_link_login_required" : "") ||
        (missingDoseInTreatment ? "missing_treatment_dose_or_frequency" : "confidence_below_auto_ingest_threshold");
      reviewsForMessage += 1;
      let canonicalEventIdForResolver: string | null = null;
      const gmailReviewId = await persistReviewEvent({
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
        const ingestionResult = await ingestEventToDomain({
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
          const reviewId = await upsertClinicalReviewDraft({
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
          await upsertIncompleteTreatmentPendingAction({
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
      } else {
        await upsertSyncReviewPendingAction({
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
      await mirrorBrainResolution({
        uid,
        petReference: asString(planAndPet.petContext.name) || null,
        petIdHint: effectivePetId,
        category: mapEventTypeToBrainCategory(event.event_type),
        entities: buildBrainEntitiesFromEvent(event),
        confidence01: clamp(clinical.confidence_overall / 100, 0, 1),
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
            image_fragment_url: preferredAttachment?.storage_signed_url || null,
            source_file_name: preferredAttachment?.filename || null,
          },
        },
      });
      await storeKnowledgeSignal({
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

    const ingestionResult = await ingestEventToDomain({
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
    await mirrorBrainResolution({
      uid,
      petReference: asString(planAndPet.petContext.name) || null,
      petIdHint: effectivePetId,
      category: mapEventTypeToBrainCategory(event.event_type),
      entities: buildBrainEntitiesFromEvent(event),
      confidence01: clamp(clinical.confidence_overall / 100, 0, 1),
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
          source_file_name: preferredAttachment?.filename || null,
          image_fragment_url: preferredAttachment?.storage_signed_url || null,
        },
      },
    });
    await storeKnowledgeSignal({
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

  await incrementSessionCounters(sessionId, {
    new_medical_events_created: createdForMessage,
    events_requiring_review: reviewsForMessage,
    duplicates_removed: duplicatesForMessage,
  });

  await admin.firestore().collection("gmail_ingestion_documents").doc(`${sessionId}_${messageId}`).set(
    {
      session_id: sessionId,
      user_id: uid,
      message_id: messageId,
      thread_id: rawDoc.threadId,
      email_date: rawDoc.emailDate,
      from_email: sourceSender,
      subject: sourceSubject.slice(0, 400),
      attachment_count: attachmentMetadata.length,
      attachment_metadata: sanitizeAttachmentMetadataForFirestore(attachmentMetadata),
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
      created_at: getNowIso(),
    },
    { merge: true }
  );

  await deleteTemporaryAttachmentExtraction(rawDocId);
  await deleteTemporaryRawDocument(rawDocId);
  await markJobCompleted(doc.ref);
  await maybeFinalizeSession(sessionId);
}

// ── Scan-session orchestrator ───────────────────────────────────────────────

export async function processSession(sessionId: string, options: ProcessOptions): Promise<void> {
  const sessionRef = admin.firestore().collection("gmail_ingestion_sessions").doc(sessionId);
  const sessionSnap = await sessionRef.get();
  if (!sessionSnap.exists) return;

  const sessionData = asRecord(sessionSnap.data());
  const status = asString(sessionData.status) as QueueStatus;
  if (status === "completed" || status === "failed") return;

  const uid = asString(sessionData.user_id);
  if (!uid) return;

  const configSnap = await admin.firestore().collection("user_email_config").doc(uid).get();
  if (!configSnap.exists) {
    await sessionRef.set({ status: "failed", updated_at: getNowIso(), error: "user_email_config_missing" }, { merge: true });
    return;
  }
  const config = asRecord(configSnap.data()) as unknown as UserEmailConfig;
  const petId = asString(sessionData.pet_id) || config.pet_id || null;
  const dedupDisabled = options.disableDedup === true || sessionData.qa_disable_dedup === true;

  const currentCounters = asRecord(sessionData.counters) as unknown as SessionCounters;
  const counters: SessionCounters = {
    total_emails_scanned: asNonNegativeNumber(currentCounters.total_emails_scanned),
    candidate_emails_detected: asNonNegativeNumber(currentCounters.candidate_emails_detected),
    emails_with_attachments: asNonNegativeNumber(currentCounters.emails_with_attachments),
    emails_with_images: asNonNegativeNumber(currentCounters.emails_with_images),
    total_attachments_processed: asNonNegativeNumber(currentCounters.total_attachments_processed),
    duplicates_removed: asNonNegativeNumber(currentCounters.duplicates_removed),
    new_medical_events_created: asNonNegativeNumber(currentCounters.new_medical_events_created),
    events_requiring_review: asNonNegativeNumber(currentCounters.events_requiring_review),
    errors_count: asNonNegativeNumber(currentCounters.errors_count),
  };

  const nowIso = getNowIso();
  await sessionRef.set({ status: "processing", updated_at: nowIso }, { merge: true });
  await updateIngestionProgress(uid, "scanning_emails");

  const maxConcurrentJobs = getMaxConcurrentExtractionJobs();
  const activeSessions = await countActiveSessions();
  if (activeSessions > maxConcurrentJobs) {
    await sessionRef.set(
      {
        status: "queued",
        updated_at: getNowIso(),
        throttle_reason: "max_concurrent_jobs_reached",
      },
      { merge: true }
    );
    return;
  }

  const { refreshToken, grantedScopes } = await fetchUserRefreshToken(uid);
  const hasReadonlyScope = grantedScopes.includes(GMAIL_SCOPE_READONLY);
  if (!hasReadonlyScope) {
    await sessionRef.set(
      {
        status: "failed",
        updated_at: getNowIso(),
        error: "missing_required_scope_gmail_readonly",
      },
      { merge: true }
    );
    await updateIngestionProgress(uid, "requires_review");
    return;
  }
  const clientId = asString(process.env.GMAIL_OAUTH_CLIENT_ID);
  const clientSecret = asString(process.env.GMAIL_OAUTH_CLIENT_SECRET);
  if (!clientId || !clientSecret) {
    throw new Error("gmail_client_credentials_missing");
  }
  const accessToken = await exchangeRefreshToken({ refreshToken, clientId, clientSecret });
  try {
    await assertGmailFullPayloadAccess(accessToken);
  } catch (error) {
    if (isMetadataOnlyScopeError(error)) {
      await markGmailReconsentRequired({ uid, sessionRef });
      return;
    }
    throw error;
  }
  const planAndPet = await resolvePlanAndPet({ uid, preferredPetId: petId });

  let query = asString(sessionData.query);
  const fallbackQuery = asString(sessionData.fallback_query);
  let fallbackQueryApplied = sessionData.fallback_query_applied === true;
  const useSearchQuery = Boolean(query);
  const disableFallbackQuery = sessionData.qa_disable_fallback_query === true;
  let nextPageToken = asString(sessionData.next_page_token);
  const lookbackAfter = parseDateOnly(sessionData.lookback_after);
  const lookbackBefore = parseDateOnly(sessionData.lookback_before);
  let stopByLookbackFloor = false;
  let processedInRun = 0;
  let processedSinceFlush = 0;
  const started = Date.now();
  const scanStageStarted = Date.now();
  const scanBatchSize = getScanBatchSize();
  const planType = (asString(config.plan_type) === "premium" ? "premium" : "free") as UserPlanType;
  const planHardCap = planType === "premium" ? getPremiumPlanMaxEmailsPerSync() : getFreePlanMaxEmailsPerSync();
  const configuredCap = asNonNegativeNumber(
    sessionData.max_mails_per_sync,
    asNonNegativeNumber(config.max_mails_per_sync, getMaxMailsPerSync(planType))
  );
  const normalizedConfiguredCap = configuredCap > 0 ? Math.min(configuredCap, planHardCap) : planHardCap;
  const sessionQaTotalCap = asNonNegativeNumber(sessionData.qa_total_scan_cap, 0);
  const maxEmailsForUser = sessionQaTotalCap > 0
    ? Math.min(normalizedConfiguredCap, sessionQaTotalCap)
    : normalizedConfiguredCap;

  while (processedInRun < options.maxEmailsToProcess && Date.now() - started < options.hardDeadlineMs) {
    if (counters.total_emails_scanned >= maxEmailsForUser) break;
    const remaining = options.maxEmailsToProcess - processedInRun;
    const listUrl = new URL(`${GMAIL_API_BASE_URL}/messages`);
    if (useSearchQuery && query) {
      listUrl.searchParams.set("q", query);
    }
    listUrl.searchParams.set("maxResults", String(Math.min(scanBatchSize, remaining)));
    if (nextPageToken) listUrl.searchParams.set("pageToken", nextPageToken);

    const listResponse = await callGoogleJson<GmailMessageListResponse>(listUrl.toString(), accessToken);
    const messages = Array.isArray(listResponse.messages) ? listResponse.messages : [];
    if (messages.length === 0) {
      if (
        useSearchQuery &&
        !disableFallbackQuery &&
        !nextPageToken &&
        !fallbackQueryApplied &&
        fallbackQuery &&
        fallbackQuery !== query &&
        counters.total_emails_scanned === 0 &&
        processedInRun === 0
      ) {
        query = fallbackQuery;
        fallbackQueryApplied = true;
        await sessionRef.set(
          {
            query,
            fallback_query_applied: true,
            updated_at: getNowIso(),
          },
          { merge: true }
        );
        continue;
      }
      nextPageToken = "";
      break;
    }

    for (const message of messages) {
      if (processedInRun >= options.maxEmailsToProcess) break;
      if (Date.now() - started >= options.hardDeadlineMs) break;
      if (counters.total_emails_scanned >= maxEmailsForUser) break;

      const messageId = asString(message.id);
      if (!messageId) continue;

      counters.total_emails_scanned += 1;
      processedInRun += 1;

      try {
        const detailBaseUrl = `${GMAIL_API_BASE_URL}/messages/${encodeURIComponent(messageId)}`;
        const detailUrl = new URL(detailBaseUrl);
        detailUrl.searchParams.set("format", "full");
        const detail = await callGoogleJson<GmailMessageDetailResponse>(detailUrl.toString(), accessToken);
        const messagePayload = detail.payload;
        const fromEmail = getHeader(messagePayload, "From");
        const subject = getHeader(messagePayload, "Subject") || asString(detail.snippet).slice(0, 120);
        const bodyText = extractBodyText(messagePayload) || asString(detail.snippet);
        const dateIso = parseGmailDate(
          asString(getHeader(messagePayload, "Date")) || new Date(Number(detail.internalDate || Date.now())).toISOString()
        );
        const messageDate = parseIsoDate(dateIso);
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

        const { attachmentMetadata, imageCount } = fetchAttachmentMetadataFromParsing({
          payload: messagePayload,
        });

        const attachmentCount = attachmentMetadata.length;
        if (attachmentCount > 0) counters.emails_with_attachments += 1;
        if (imageCount > 0) counters.emails_with_images += 1;

        const isCandidate = isCandidateClinicalEmail({
          subject,
          fromEmail,
          bodyText,
          attachmentCount,
          attachmentMetadata,
          petName: asString(planAndPet.petContext.name),
          petId: planAndPet.petId || "",
        });
        if (!isCandidate) continue;
        counters.candidate_emails_detected += 1;

        const rawBase = [
          normalizeForHash(bodyText).slice(0, 100_000),
          normalizeForHash(subject),
          normalizeForHash(fromEmail),
          normalizeForHash(attachmentMetadata.map((row) => row.filename).join("|")),
          normalizeForHash(dateIso),
        ].join("|");
        const hashSignatureRaw = sha256(rawBase);
        const normalized = normalizeForHash(bodyText);
        const applyHashDedup = (normalized.length >= 40 || attachmentCount > 0) && !dedupDisabled;

        if (applyHashDedup) {
          const hashDocId = `${uid}_${hashSignatureRaw}`;
          const hashRef = admin.firestore().collection("gmail_document_hashes").doc(hashDocId);
          const hashSnap = await hashRef.get();
          if (hashSnap.exists) {
            const hashData = asRecord(hashSnap.data());
            const lastSeen = parseIsoDate(hashData.last_seen_at);
            if (lastSeen && Date.now() - lastSeen.getTime() <= DEDUP_WINDOW_DAYS * ONE_DAY_MS) {
              counters.duplicates_removed += 1;
              continue;
            }
          }
          await hashRef.set(
            {
              user_id: uid,
              hash_signature: hashSignatureRaw,
              first_seen_at: hashSnap.exists ? asString(asRecord(hashSnap.data()).first_seen_at) || getNowIso() : getNowIso(),
              last_seen_at: getNowIso(),
            },
            { merge: true }
          );
        }

        const rawDocument: RawDocumentLike = {
          source: "email",
          message_id: messageId,
          thread_id: asString(detail.threadId),
          email_date: dateIso,
          body_text: bodyText,
          attachment_meta: sanitizeAttachmentMetadataForFirestore(attachmentMetadata),
          hash_signature_raw: hashSignatureRaw,
        };

        const tmpDocId = await persistTemporaryRawDocument({
          uid,
          sessionId,
          rawDocument,
          sourceSender: fromEmail,
          sourceSubject: subject,
        });

        await enqueueStageJob<AiExtractQueueJobPayload>({
          stage: "ai_extract",
          sessionId,
          uid,
          payload: {
            message_id: messageId,
            raw_doc_id: tmpDocId,
            source_sender: fromEmail,
            source_subject: subject,
            mode: "classify",
          } as AiExtractQueueJobPayload,
        });
        await admin.firestore().collection("gmail_ingestion_documents").doc(`${sessionId}_${messageId}`).set(
          {
            session_id: sessionId,
            user_id: uid,
            message_id: messageId,
            thread_id: rawDocument.thread_id,
            email_date: rawDocument.email_date,
            from_email: fromEmail,
            subject: subject.slice(0, 400),
            attachment_count: attachmentCount,
            attachment_metadata: sanitizeAttachmentMetadataForFirestore(attachmentMetadata),
            hash_signature_raw: rawDocument.hash_signature_raw,
            processing_status: "queued_classification",
            created_at: getNowIso(),
          },
          { merge: true }
        );
      } catch (error) {
        counters.errors_count += 1;
        await incrementSessionCounters(sessionId, { errors_count: 1 });
        await admin.firestore().collection("gmail_ingestion_errors").add({
          session_id: sessionId,
          user_id: uid,
          message_id: messageId,
          error: String(error),
          created_at: getNowIso(),
        });
      }

      processedSinceFlush += 1;
      if (processedSinceFlush >= 5) {
        const scanCountersPatch = toFirestoreCounterFields(buildScanCountersPatch(counters));
        await sessionRef.update({
          updated_at: getNowIso(),
          ...scanCountersPatch,
        });
        processedSinceFlush = 0;
      }
    }

    if (stopByLookbackFloor) {
      nextPageToken = "";
      break;
    }

    nextPageToken = asString(listResponse.nextPageToken);
    if (!nextPageToken) {
      if (
        useSearchQuery &&
        !disableFallbackQuery &&
        !fallbackQueryApplied &&
        fallbackQuery &&
        fallbackQuery !== query &&
        counters.total_emails_scanned <= LOW_RESULT_FALLBACK_MAX_SCANNED &&
        counters.candidate_emails_detected <= LOW_RESULT_FALLBACK_MAX_CANDIDATES &&
        processedInRun < options.maxEmailsToProcess &&
        Date.now() - started < options.hardDeadlineMs
      ) {
        query = fallbackQuery;
        fallbackQueryApplied = true;
        await sessionRef.set(
          {
            query,
            fallback_query_applied: true,
            fallback_reason: "low_result_set",
            updated_at: getNowIso(),
          },
          { merge: true }
        );
        continue;
      }
      break;
    }
  }

  const reachedSyncCap = counters.total_emails_scanned >= maxEmailsForUser;
  const scanComplete = !nextPageToken || reachedSyncCap;

  await sessionRef.update({
    status: scanComplete ? "processing" : "queued",
    query,
    fallback_query_applied: fallbackQueryApplied,
    qa_disable_dedup: dedupDisabled,
    effective_scan_cap: maxEmailsForUser,
    next_page_token: nextPageToken || null,
    scan_complete: scanComplete,
    updated_at: getNowIso(),
    ...toFirestoreCounterFields(buildScanCountersPatch(counters)),
  });
  await recordSessionStageMetric({
    sessionId,
    stageKey: "scan",
    durationMs: Date.now() - scanStageStarted,
  });

  await admin.firestore().collection("user_email_config").doc(uid).set(
    {
      ingestion_status: scanComplete ? "analyzing_documents" : "scanning_emails",
      sync_status: scanComplete ? "analyzing_documents" : "scanning_emails",
      updated_at: getNowIso(),
      total_emails_scanned: counters.total_emails_scanned,
      clinical_candidates_detected: counters.candidate_emails_detected,
      duplicates_removed: counters.duplicates_removed,
    },
    { merge: true }
  );

  if (scanComplete) {
    await maybeFinalizeSession(sessionId);
  } else {
    await ensurePendingScanJob(sessionId, uid);
  }
}
