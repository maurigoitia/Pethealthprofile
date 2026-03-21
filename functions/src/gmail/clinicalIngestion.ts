import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from "crypto";
import { Readable, Transform } from "stream";
import { pipeline } from "stream/promises";
import * as mammoth from "mammoth/lib/index";
import { resolveClinicalKnowledgeContext } from "../clinical/knowledgeBase";
import { resolveBrainOutput } from "../clinical/brainResolver";
import { assertGmailInvitationOrThrow } from "./invitation";
import {
  isVetDomain, isTrustedClinicalSender, isBlockedClinicalDomain,
  isMassMarketingDomain, scorePetCandidate, choosePetByHints,
  detectPetIdentityConflict, inferSpeciesSignalsFromCorpus,
  petMatchesByName, petMatchesByBreed, petMatchesBySpeciesSignal,
  resolvePetConditionHints, isCandidateClinicalEmail,
  hasStrongHumanHealthcareSignal, hasStrongVeterinaryEvidence,
  hasStrongNonClinicalSignal, attachmentNamesContainClinicalSignal,
  extractSenderDomain, speciesAliases, canonicalSpeciesKey,
} from "./ingestion/petMatching";
import {
  uniqueNonEmpty, getNowIso, asRecord, asString,
  asNonNegativeNumber, clamp, hasNumericSignal,
  sanitizeReferenceRange, normalizeClinicalToken, cleanSentence,
  normalizeForHash, sha256, base64UrlToBase64,
  decodeBase64UrlToBuffer, decodeBase64UrlToText,
  sanitizePathToken, buildAttachmentStoragePath,
  createBase64DecodeTransform, iterateBase64Chunks,
  toIsoDateOnly, toGmailDate, parseIsoDate, parseDateOnly,
  parseBirthDateFromPet, calculateAgeYears, calculateMaxLookbackMonths,
  getMaxMailsPerSync, parseGmailDate, monthsBetween,
  sanitizeNarrativeLabel,
  normalizeSemanticText, jaccardSimilarity, dateProximityScore,
  tryParseJson, splitTextForAi,
  encryptText, decryptText, decryptPayload, getEncryptionKey,
} from "./ingestion/utils";
import {
  PetResolutionHints, PetCandidateProfile, UserPlanType,
  ClinicalClassificationOutput, ClinicalClassificationInput,
  ClinicalExtractionOutput,
} from "./ingestion/types";
import {
  createIngestionSession, updateIngestionProgress,
  queueCollectionForStage, enqueueStageJob, pickPendingJobs,
  markJobProcessing, markJobCompleted, markJobFailed,
  incrementSessionCounters, recordSessionStageMetric,
  maybeFinalizeSession, closeStuckSessionAsPartial,
  acquireUserIngestionLock, releaseUserIngestionLock,
  ensurePendingScanJob,
  buildSessionDateWindow, buildGmailSearchQuery,
} from "./ingestion/sessionQueue";
import {
  isAppointmentEventType, isPrescriptionEventType, isVaccinationEventType, isStudyEventType,
  inferAppointmentStatusFromText, normalizeAppointmentStatusValue,
  sanitizeAppointmentTime, extractAppointmentTimeFromText,
  extractProfessionalNameFromText,
  extractClinicNameFromText, extractAppointmentSpecialtyFromText,
  deriveAppointmentLabel,
  inferImagingTypeFromSignals, inferStudySubtypeFromSignals,
  normalizeExtractedEventType,
  buildCanonicalEventTitle,
  toMedicalEventDocumentType,
  reconstructStoredEventForTaxonomy,
  extractOperationalAppointmentCandidate,
  shouldReplaceLegacyStoredTitle, shouldPreserveExistingObservations,
  medicationHasDoseAndFrequency,
  applyConstitutionalGuardrails,
  isLegacyMailsyncEvent, classifyLegacyMailsyncEvent,
  GmailTaxonomyBackfillResult, LegacyMailsyncCleanupResult,
} from "./ingestion/clinicalNormalization";
import {
  listAllMessageParts, extractBodyText, getHeader,
  isImageMime, isSupportedAttachmentType,
  normalizeMimeType, fetchAttachmentMetadata,
} from "./ingestion/emailParsing";
import {
  decodeHtmlEntitiesBasic, stripHtmlToText,
  normalizeExternalLink, extractCandidateExternalLinks,
  isPrivateOrLocalHost, shouldFetchExternalLink,
  isRedirectStatus, resolveRedirectUrl, likelyLoginUrl,
  detectLoginRequiredHtml,
  fetchWithControlledRedirects, readResponseBodyWithLimit,
  fetchExternalLinkTextChunks,
} from "./ingestion/textProcessing";
import {
  consumeGlobalAiQuota, callGemini, extractGeminiText,
  ocrAttachmentViaGemini, buildClinicalPrompt,
  deriveVeterinaryEvidenceHints, applyVeterinaryEvidencePriority,
  toClinicalOutput, heuristicClinicalExtraction,
  heuristicClinicalClassification,
  classifyClinicalContentWithAi, extractClinicalEventsWithAi,
} from "./ingestion/clinicalAi";
import {
  sanitizeAttachmentMetadataForFirestore,
  persistTemporaryRawDocument, deleteTemporaryRawDocument,
  loadTemporaryRawDocument, saveTemporaryAttachmentExtraction,
  loadTemporaryAttachmentExtraction, deleteTemporaryAttachmentExtraction,
  purgeExpiredRawDocuments,
} from "./ingestion/jobProcessing";
import {
  persistReviewEvent, buildDefaultExtractedData,
  buildIncompleteTreatmentSubtitle, selectBestAttachmentForReview,
  upsertClinicalReviewDraft, upsertIncompleteTreatmentPendingAction,
  buildSyncReviewTitle, buildReviewReasonCopy, buildSyncReviewSubtitle,
  upsertSyncReviewPendingAction, detectSemanticDuplicateCandidate,
  isDuplicateEventByFingerprint,
} from "./ingestion/reviewActions";
import {
  storeKnowledgeSignal, mapEventTypeToBrainCategory,
  inferBrainCategoryFromSubject, buildBrainEntitiesFromEvent,
  mirrorBrainResolution, appointmentStatusToCollectionStatus,
  findExistingOperationalAppointmentEvent,
  upsertOperationalAppointmentProjection,
  ingestEventToDomain,
} from "./ingestion/domainIngestion";
import {
  getBoundedIntFromEnv, getPremiumPlanMaxEmailsPerSync,
  getFreePlanMaxEmailsPerSync, getScanBatchSize,
  getMaxConcurrentExtractionJobs, getScanWorkersPerTick,
  getAttachmentWorkersPerTick, getAiWorkersPerTick,
  getMaxExternalLinksPerEmail, getExternalLinkFetchTimeoutMs,
  getExternalLinkMaxBytes, getExternalLinkMaxRedirects,
  isExternalLinkFetchEnabled, getAutoIngestConfidenceThreshold,
  getSilentApprovalWindowHours, parseDomainListEnv,
  parseEmailListEnv, getQaAllowedUserEmails, isEmailAllowedForQa,
  isSmartPetMatchingEnabled, domainMatches, isAttachmentStorageEnabled,
} from "./ingestion/envConfig";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_GMAIL_PROFILE_URL = "https://gmail.googleapis.com/gmail/v1/users/me/profile";
const GMAIL_API_BASE_URL = "https://gmail.googleapis.com/gmail/v1/users/me";

const MAX_EMAILS_PER_USER_PER_DAY = 500;
const FREE_PLAN_MAX_EMAILS_PER_SYNC = 300;
const DEFAULT_BATCH_SIZE = 20;
const MAX_CONCURRENT_EXTRACTION_JOBS = 20;
const MAX_ATTACHMENT_SIZE_BYTES = 25 * 1024 * 1024;
const MAX_ATTACHMENTS_PER_EMAIL = 10;
const DEDUP_WINDOW_DAYS = 30;
const SESSION_AUDIT_RETENTION_DAYS = 90;
const OCR_TIMEOUT_MS = 120_000;
const CLINICAL_AI_TIMEOUT_MS = 15_000;
const CLASSIFICATION_AI_TIMEOUT_MS = 7_000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const GMAIL_SCOPE_READONLY = "https://www.googleapis.com/auth/gmail.readonly";
const RAW_DOCUMENT_TTL_MS = 24 * ONE_DAY_MS;
const FREE_PLAN_ATTACHMENT_PROCESS_LIMIT = 20;
const MAX_AI_DOCUMENT_TEXT_CHARS = 120_000;
const MIN_LIGHTWEIGHT_BODY_LENGTH = 140;
const MAX_SCAN_WORKERS_PER_TICK = 1;
const MAX_ATTACHMENT_WORKERS_PER_TICK = 2;
const MAX_AI_WORKERS_PER_TICK = 2;
const MAX_JOB_ATTEMPTS = 5;
const JOB_RETRY_DELAYS_MS = [
  15 * 60 * 1000, // 15m
  60 * 60 * 1000, // 1h
  24 * 60 * 60 * 1000, // 24h
  24 * 60 * 60 * 1000, // +24h (48h total)
];
const LOW_RESULT_FALLBACK_MAX_SCANNED = 3;
const LOW_RESULT_FALLBACK_MAX_CANDIDATES = 1;
const STALE_PROCESSING_JOB_MS = 5 * 60 * 1000;
const STALE_PROCESSING_SCAN_FACTOR = 6;
const STALE_ACTIVE_SESSION_MS = 60 * 60 * 1000;
const FORCE_DRAIN_POLL_MS = 1200;
const FORCE_DRAIN_MAX_WAIT_MS = 4 * 60 * 1000;
const FORCE_DRAIN_MAX_JOBS_PER_STAGE = 30;
const DEFAULT_MAX_EXTERNAL_LINKS_PER_EMAIL = 2;
const MAX_EXTERNAL_LINKS_PER_EMAIL_HARD_CAP = 5;
const DEFAULT_EXTERNAL_LINK_FETCH_TIMEOUT_MS = 9000;
const DEFAULT_EXTERNAL_LINK_MAX_BYTES = 6 * 1024 * 1024;
const DEFAULT_EXTERNAL_LINK_MAX_REDIRECTS = 4;
const MAX_EXTERNAL_LINK_REDIRECTS_HARD_CAP = 8;
const MAX_EXTERNAL_LINK_TEXT_CHARS = 120_000;
const RECENT_HISTORY_WINDOW_DAYS = 90;
const MONTHLY_BUCKET_UNTIL_MONTHS = 18;
const DEFAULT_HUMAN_BLOCKED_SENDER_DOMAINS = [
  "huesped.org",
  "huesped.org.ar",
  "osde.com.ar",
  "osdebinario.com.ar",
  "swissmedical.com.ar",
  "medicus.com.ar",
  "galeno.com.ar",
  "omint.com.ar",
  "hospitalitaliano.org.ar",
  "hospitalaleman.com",
];

type IngestionStatus =
  | "idle"
  | "processing"
  | "scanning_emails"
  | "analyzing_documents"
  | "extracting_medical_events"
  | "organizing_history"
  | "completed"
  | "requires_review";
type QueueStatus = "queued" | "processing" | "completed" | "requires_review" | "failed";
type EventType =
  | "appointment_confirmation"
  | "appointment_reminder"
  | "appointment_cancellation"
  | "clinical_report"
  | "study_report"
  | "prescription_record"
  | "vaccination_record";
type DomainIngestionType = "appointment" | "treatment" | "vaccination" | "medical_event";
type QueueJobStatus = "pending" | "processing" | "completed" | "failed";
type QueueJobStage = "scan" | "attachment" | "ai_extract";
type AppointmentEventStatus = "confirmed" | "reminder" | "cancelled" | "scheduled" | null;
type StudySubtype = "imaging" | "lab" | null;

interface GoogleTokenResponse {
  access_token?: string;
  expires_in?: number;
}

interface GmailProfileResponse {
  emailAddress?: string;
  historyId?: string;
}

interface GmailMessageListResponse {
  messages?: Array<{ id?: string; threadId?: string }>;
  nextPageToken?: string;
}

interface GmailAttachmentResponse {
  data?: string;
  size?: number;
}

interface GmailMessagePart {
  mimeType?: string;
  filename?: string;
  body?: {
    data?: string;
    size?: number;
    attachmentId?: string;
  };
  parts?: GmailMessagePart[];
  headers?: Array<{ name?: string; value?: string }>;
}

interface GmailMessageDetailResponse {
  id?: string;
  threadId?: string;
  labelIds?: string[];
  snippet?: string;
  internalDate?: string;
  payload?: GmailMessagePart;
}

interface UserEmailConfig {
  user_id: string;
  gmail_account: string | null;
  plan_type: UserPlanType;
  pet_id: string | null;
  pet_name: string | null;
  fallback_pet_id?: string | null;
  fallback_pet_name?: string | null;
  active_pet_count?: number;
  pet_birthdate: string | null;
  pet_age_years: number;
  max_lookback_months: number;
  max_mails_per_sync: number;
  ingestion_status: IngestionStatus;
  last_sync_timestamp: string;
  token_encrypted: boolean;
  token_ref: string;
  sync_status: IngestionStatus;
  last_history_id: string | null;
  updated_at: string;
  total_emails_scanned?: number;
  clinical_candidates_detected?: number;
  documents_processed?: number;
  duplicates_removed?: number;
}

interface AttachmentMetadata {
  filename: string;
  mimetype: string;
  size_bytes: number;
  ocr_success: boolean;
  ocr_reason?: string;
  ocr_detail?: string | null;
  original_mimetype?: string | null;
  normalized_mimetype?: string | null;
  storage_uri?: string | null;
  storage_path?: string | null;
  storage_bucket?: string | null;
  storage_signed_url?: string | null;
  storage_success?: boolean;
  storage_error?: string | null;
}

interface ExternalLinkExtractionMetadata {
  url: string;
  final_url: string | null;
  host: string;
  content_type: string | null;
  status: "fetched" | "skipped" | "failed";
  reason: string;
  extracted_chars: number;
  ocr_used: boolean;
  redirect_count: number;
  login_required: boolean;
}

interface RawDocumentLike {
  source: "email";
  message_id: string;
  thread_id: string;
  email_date: string;
  body_text: string;
  attachment_meta: AttachmentMetadata[];
  hash_signature_raw: string;
}

interface ClinicalMedication {
  name: string;
  dose: string | null;
  frequency: string | null;
  duration_days: number | null;
  is_active: boolean | null;
}

interface ClinicalLabResult {
  test_name: string;
  result: string;
  unit: string | null;
  reference_range: string | null;
}

interface ClinicalEventExtraction {
  event_type: EventType;
  event_date: string | null;
  date_confidence: number;
  description_summary: string;
  diagnosis: string | null;
  medications: ClinicalMedication[];
  lab_results: ClinicalLabResult[];
  imaging_type: string | null;
  study_subtype: StudySubtype;
  appointment_time: string | null;
  appointment_specialty: string | null;
  professional_name: string | null;
  clinic_name: string | null;
  appointment_status: AppointmentEventStatus;
  severity: "mild" | "moderate" | "severe" | null;
  confidence_score: number;
}

interface SessionCounters {
  total_emails_scanned: number;
  candidate_emails_detected: number;
  emails_with_attachments: number;
  emails_with_images: number;
  total_attachments_processed: number;
  duplicates_removed: number;
  new_medical_events_created: number;
  events_requiring_review: number;
  errors_count: number;
}

function buildScanCountersPatch(counters: SessionCounters): Partial<SessionCounters> {
  return {
    total_emails_scanned: counters.total_emails_scanned,
    candidate_emails_detected: counters.candidate_emails_detected,
    emails_with_attachments: counters.emails_with_attachments,
    emails_with_images: counters.emails_with_images,
    duplicates_removed: counters.duplicates_removed,
  };
}

function toFirestoreCounterFields(counters: Partial<SessionCounters>): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(counters)) {
    patch[`counters.${key}`] = value;
  }
  return patch;
}

interface ProcessOptions {
  maxEmailsToProcess: number;
  hardDeadlineMs: number;
  disableDedup?: boolean;
}

interface QueueJobBase {
  stage: QueueJobStage;
  status: QueueJobStatus;
  session_id: string;
  user_id: string;
  attempts: number;
  available_at: string;
  created_at: string;
  updated_at: string;
}

interface ScanQueueJobPayload {
  page_token?: string | null;
}

interface AttachmentQueueJobPayload {
  message_id: string;
  raw_doc_id: string;
}

interface AiExtractQueueJobPayload {
  message_id: string;
  raw_doc_id: string;
  source_sender: string;
  source_subject: string;
  mode: "classify" | "extract";
}

interface BootstrapResult {
  config: UserEmailConfig;
  sessionId: string;
}
async function deleteLegacyEventArtifacts(eventId: string): Promise<number> {
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

async function runLegacyMailsyncCleanup(args: {
  uid: string;
  email?: string | null;
  petId?: string | null;
  dryRun?: boolean;
  limit?: number;
  refreshNarrative?: boolean;
}): Promise<LegacyMailsyncCleanupResult> {
  const dryRun = args.dryRun !== false;
  const limit = clamp(asNonNegativeNumber(args.limit, 200), 1, 500);
  const result: LegacyMailsyncCleanupResult = {
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

  let query: FirebaseFirestore.Query = admin.firestore().collection("medical_events").where("userId", "==", args.uid);
  if (args.petId) query = query.where("petId", "==", args.petId);
  const snap = await query.limit(limit).get();
  result.total_scanned = snap.size;

  for (const doc of snap.docs) {
    const row = asRecord(doc.data());
    const extractedData = asRecord(row.extractedData);
    if (!isLegacyMailsyncEvent(doc.id, row, extractedData)) {
      result.skipped += 1;
      continue;
    }

    result.eligible_legacy_events += 1;
    const sample = classifyLegacyMailsyncEvent(doc.id, row);
    if (sample.action === "delete") result.delete_candidates += 1;
    if (sample.action === "salvage") result.salvage_candidates += 1;
    if (result.samples.length < 40) result.samples.push(sample);

    if (sample.action !== "delete") continue;
    if (dryRun) {
      result.deleted += 1;
      continue;
    }

    try {
      result.artifacts_deleted += await deleteLegacyEventArtifacts(doc.id);
      await doc.ref.delete();
      result.deleted += 1;
    } catch (error) {
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

async function runGmailTaxonomyBackfill(args: {
  uid: string;
  email?: string | null;
  dryRun?: boolean;
  limit?: number;
  includeAppointments?: boolean;
}): Promise<GmailTaxonomyBackfillResult> {
  const dryRun = args.dryRun !== false;
  const limit = clamp(asNonNegativeNumber(args.limit, 150), 1, 500);
  const includeAppointments = args.includeAppointments !== false;
  const result: GmailTaxonomyBackfillResult = {
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
    const row = asRecord(doc.data());
    const extractedData = asRecord(row.extractedData);
    const source = asString(row.source);
    const sourceEmailId = asString(row.source_email_id);
    if (source !== "email_import" && !sourceEmailId) {
      result.skipped_non_email += 1;
      continue;
    }

    result.eligible_email_events += 1;
    const reconstructedEvent = reconstructStoredEventForTaxonomy(row);
    if (!reconstructedEvent) {
      result.skipped_unclassified += 1;
      continue;
    }

    const sourceDate = asString(extractedData.sourceReceivedAt) || asString(row.createdAt) || getNowIso();
    const nextExtractedData = {
      ...extractedData,
      ...buildDefaultExtractedData({
        event: reconstructedEvent,
        sourceDate,
        sourceSubject: asString(extractedData.sourceSubject),
        sourceSender: asString(extractedData.sourceSender),
      }),
    } as Record<string, unknown>;
    const rescuedAppointment = !isAppointmentEventType(reconstructedEvent.event_type)
      ? extractOperationalAppointmentCandidate({
          eventDate: asString(nextExtractedData.eventDate) || reconstructedEvent.event_date,
          sourceText: [
            asString(nextExtractedData.sourceSubject),
            asString(nextExtractedData.suggestedTitle),
            asString(nextExtractedData.aiGeneratedSummary),
            asString(nextExtractedData.observations),
            asString(row.title),
          ]
            .filter(Boolean)
            .join(" · "),
          sourceSender: asString(nextExtractedData.sourceSender),
          existingStatus: nextExtractedData.appointmentStatus,
          existingTime: nextExtractedData.appointmentTime,
          existingSpecialty: asString(asRecord(Array.isArray(nextExtractedData.detectedAppointments) ? nextExtractedData.detectedAppointments[0] : null).specialty),
          professionalName: asString(nextExtractedData.provider),
          clinicName: asString(nextExtractedData.clinic),
          diagnosis: asString(nextExtractedData.diagnosis),
          confidenceScore: reconstructedEvent.confidence_score,
        })
      : null;

    if (shouldPreserveExistingObservations({ row, extractedData })) {
      nextExtractedData.observations = extractedData.observations;
      nextExtractedData.observationsConfidence = extractedData.observationsConfidence || "medium";
    }

    const nextDomainType: DomainIngestionType =
      isAppointmentEventType(reconstructedEvent.event_type)
        ? "appointment"
        : isPrescriptionEventType(reconstructedEvent.event_type)
          ? "treatment"
          : isVaccinationEventType(reconstructedEvent.event_type)
            ? "vaccination"
            : "medical_event";

    const nextTitle = buildCanonicalEventTitle(reconstructedEvent).slice(0, 160);
    const nextFindings =
      reconstructedEvent.lab_results.length > 0
        ? reconstructedEvent.lab_results.map((item) => `${item.test_name}: ${item.result}`).join(" | ").slice(0, 1400)
        : null;

    const changes: string[] = [];
    if (asString(extractedData.taxonomyEventType) !== asString(nextExtractedData.taxonomyEventType)) changes.push("taxonomyEventType");
    if (asString(extractedData.documentType) !== asString(nextExtractedData.documentType)) changes.push("documentType");
    if (asString(extractedData.taxonomyRoute) !== asString(nextExtractedData.taxonomyRoute)) changes.push("taxonomyRoute");
    if (asString(extractedData.appointmentStatus) !== asString(nextExtractedData.appointmentStatus)) changes.push("appointmentStatus");
    if (asString(extractedData.studySubtype) !== asString(nextExtractedData.studySubtype)) changes.push("studySubtype");
    if (asString(extractedData.appointmentTime) !== asString(nextExtractedData.appointmentTime)) changes.push("appointmentTime");
    if (asString(extractedData.provider) !== asString(nextExtractedData.provider)) changes.push("provider");
    if (asString(extractedData.clinic) !== asString(nextExtractedData.clinic)) changes.push("clinic");
    if (asString(row.domain_ingestion_type) !== nextDomainType) changes.push("domain_ingestion_type");
    if (shouldReplaceLegacyStoredTitle(asString(row.title)) && asString(row.title) !== nextTitle) changes.push("title");
    if (asString(row.findings) !== asString(nextFindings)) changes.push("findings");

    if (changes.length === 0) {
      result.unchanged += 1;
      continue;
    }

    const sample = {
      docId: doc.id,
      title_before: asString(row.title) || null,
      title_after: shouldReplaceLegacyStoredTitle(asString(row.title)) ? nextTitle : asString(row.title) || null,
      taxonomy_before: asString(extractedData.taxonomyEventType) || null,
      taxonomy_after: asString(nextExtractedData.taxonomyEventType) || null,
      documentType_before: asString(extractedData.documentType) || null,
      documentType_after: asString(nextExtractedData.documentType) || null,
      changes,
    };
    if (result.samples.length < 20) result.samples.push(sample);

    if (dryRun) {
      result.updated += 1;
      continue;
    }

    try {
      const patch: Record<string, unknown> = {
        extractedData: nextExtractedData,
        domain_ingestion_type: nextDomainType,
        updatedAt: getNowIso(),
        findings: nextFindings,
      };
      if (shouldReplaceLegacyStoredTitle(asString(row.title))) patch.title = nextTitle;

      await doc.ref.set(patch, { merge: true });

      const projectionEvent = isAppointmentEventType(reconstructedEvent.event_type)
        ? reconstructedEvent
        : rescuedAppointment;
      if (includeAppointments && projectionEvent && asString(row.petId)) {
        await upsertOperationalAppointmentProjection({
          appointmentEventId: doc.id,
          petId: asString(row.petId),
          uid: args.uid,
          title: buildCanonicalEventTitle(projectionEvent),
          eventDate: projectionEvent.event_date || toIsoDateOnly(new Date(sourceDate)),
          event: projectionEvent,
          narrativeSummary: cleanSentence(
            [
              asString(nextExtractedData.aiGeneratedSummary),
              asString(nextExtractedData.sourceSubject),
              asString(row.title),
            ]
              .filter(Boolean)
              .join(" · ")
          ),
          sourceEmailId: sourceEmailId || `legacy_${doc.id}`,
          sourceTruthLevel: asString(row.sourceTruthLevel) || "ai_auto_ingested",
          effectiveRequiresConfirmation: row.requiresManualConfirmation === true || asString(row.workflowStatus) === "review_required",
          nowIso: asString(patch.updatedAt),
        });
        result.appointment_projections_updated += 1;
      }

      result.updated += 1;
    } catch (error) {
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

type NarrativePeriodType = "month" | "year";

interface NarrativeHistoryBackfillResult {
  total_scanned: number;
  eligible_events: number;
  buckets_written: number;
  episodes_written: number;
  buckets_deleted: number;
  episodes_deleted: number;
  yearly_summaries_written: number;
  errors: number;
  sample_bucket_ids: string[];
  sample_episode_ids: string[];
}
function buildNarrativeThreadLabel(event: ClinicalEventExtraction): string {
  if (isVaccinationEventType(event.event_type)) return "Vacunación";
  if (isPrescriptionEventType(event.event_type)) {
    const med = sanitizeNarrativeLabel(asString(event.medications[0]?.name), "");
    return med || "Tratamiento";
  }
  if (isAppointmentEventType(event.event_type)) {
    const specialty = sanitizeNarrativeLabel(event.appointment_specialty || "", "");
    return specialty || "Agenda veterinaria";
  }
  if (isStudyEventType(event.event_type)) {
    if (event.study_subtype === "imaging") {
      return sanitizeNarrativeLabel(event.imaging_type || "", "Estudios por imágenes");
    }
    return "Laboratorio";
  }
  return sanitizeNarrativeLabel(event.diagnosis || "", "Seguimiento clínico");
}

function buildNarrativePeriodMeta(timestamp: number, nowTimestamp: number): {
  periodType: NarrativePeriodType;
  periodKey: string;
  periodLabel: string;
  yearKey: string;
  fromDate: string;
  toDate: string;
} {
  const parsed = new Date(timestamp);
  const monthsAgo = monthsBetween(nowTimestamp, timestamp);
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
function summarizeNarrativeDiagnosis(value: string | null): string | null {
  const cleaned = sanitizeNarrativeLabel(asString(value), "");
  if (!cleaned) return null;
  const [firstSentence] = cleaned.split(/(?<=[.!?])\s+/);
  return (firstSentence || cleaned).slice(0, 180);
}

function buildNarrativeEpisodeRecord(args: {
  uid: string;
  petId: string;
  petName: string;
  periodMeta: ReturnType<typeof buildNarrativePeriodMeta>;
  threadLabel: string;
  events: Array<{ id: string; event: ClinicalEventExtraction; row: Record<string, unknown>; timestamp: number }>;
}): Record<string, unknown> {
  const diagnoses = uniqueNonEmpty(
    args.events.map((item) => summarizeNarrativeDiagnosis(item.event.diagnosis)).filter(Boolean) as string[]
  ).slice(0, 3);

  const medications = uniqueNonEmpty(
    args.events.flatMap((item) => item.event.medications.map((medication) => sanitizeNarrativeLabel(medication.name, "")))
  ).slice(0, 3);

  const providers = uniqueNonEmpty(
    args.events.flatMap((item) => [sanitizeNarrativeLabel(item.event.professional_name || "", ""), sanitizeNarrativeLabel(item.event.clinic_name || "", "")])
  ).filter(Boolean).slice(0, 2);

  const imagingCount = args.events.filter((item) => isStudyEventType(item.event.event_type) && item.event.study_subtype === "imaging").length;
  const appointmentCount = args.events.filter((item) => isAppointmentEventType(item.event.event_type)).length;
  const treatmentCount = args.events.filter((item) => isPrescriptionEventType(item.event.event_type)).length;
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
    episodio_id: `hep_${sha256(`${args.uid}_${args.petId}_${args.periodMeta.periodKey}_${args.threadLabel}`).slice(0, 24)}`,
    userId: args.uid,
    petId: args.petId,
    petName: args.petName,
    periodType: args.periodMeta.periodType,
    periodKey: args.periodMeta.periodKey,
    periodLabel: args.periodMeta.periodLabel,
    yearKey: args.periodMeta.yearKey,
    titulo_narrativo: sanitizeNarrativeLabel(args.threadLabel, "Resumen clínico"),
    headline: sanitizeNarrativeLabel(args.threadLabel, "Resumen clínico"),
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
    generated_at: getNowIso(),
    event_count: args.events.length,
  };
}

function buildAnnualSummaryRecord(args: {
  uid: string;
  petId: string;
  petName: string;
  yearKey: string;
  events: Array<{ id: string; event: ClinicalEventExtraction; row: Record<string, unknown>; timestamp: number }>;
}): Record<string, unknown> {
  const diagnoses = uniqueNonEmpty(
    args.events.map((item) => summarizeNarrativeDiagnosis(item.event.diagnosis)).filter(Boolean) as string[]
  ).slice(0, 3);
  const medications = uniqueNonEmpty(
    args.events.flatMap((item) => item.event.medications.map((medication) => sanitizeNarrativeLabel(medication.name, "")))
  ).slice(0, 3);
  const providers = uniqueNonEmpty(
    args.events.flatMap((item) => [sanitizeNarrativeLabel(item.event.professional_name || "", ""), sanitizeNarrativeLabel(item.event.clinic_name || "", "")])
  ).filter(Boolean).slice(0, 2);
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

async function deleteExistingNarrativeHistory(args: {
  uid: string;
  petId?: string | null;
}): Promise<{ buckets: number; episodes: number }> {
  const collections: Array<{ name: "history_buckets" | "history_episodes"; key: "buckets" | "episodes" }> = [
    { name: "history_buckets", key: "buckets" },
    { name: "history_episodes", key: "episodes" },
  ];
  const deleted = { buckets: 0, episodes: 0 };

  for (const collection of collections) {
    const snap = await admin.firestore().collection(collection.name).where("userId", "==", args.uid).limit(500).get();
    if (snap.empty) continue;
    const batch = admin.firestore().batch();
    let count = 0;
    for (const doc of snap.docs) {
      const row = asRecord(doc.data());
      if (asString(row.source_mode || row.sourceMode) !== "derived_history_v1") continue;
      if (args.petId && asString(row.petId) !== args.petId) continue;
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

async function runNarrativeHistoryBackfill(args: {
  uid: string;
  email?: string | null;
  petId?: string | null;
  dryRun?: boolean;
  limit?: number;
}): Promise<NarrativeHistoryBackfillResult> {
  const dryRun = args.dryRun !== false;
  const limit = clamp(asNonNegativeNumber(args.limit, 250), 25, 1000);
  const nowTimestamp = Date.now();
  const recentCutoff = nowTimestamp - RECENT_HISTORY_WINDOW_DAYS * ONE_DAY_MS;
  const result: NarrativeHistoryBackfillResult = {
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

  const petNameCache = new Map<string, string>();
  const fetchPetName = async (petId: string): Promise<string> => {
    if (petNameCache.has(petId)) return petNameCache.get(petId)!;
    const petSnap = await admin.firestore().collection("pets").doc(petId).get();
    const petName = sanitizeNarrativeLabel(asString(asRecord(petSnap.data()).name), "Mascota");
    petNameCache.set(petId, petName);
    return petName;
  };

  const snap = await admin.firestore().collection("medical_events").where("userId", "==", args.uid).limit(limit).get();
  result.total_scanned = snap.size;

  const eligibleEvents: Array<{
    id: string;
    row: Record<string, unknown>;
    event: ClinicalEventExtraction;
    timestamp: number;
    petId: string;
    petName: string;
  }> = [];

  for (const doc of snap.docs) {
    const row = asRecord(doc.data());
    const petId = asString(row.petId);
    if (!petId) continue;
    if (args.petId && petId !== args.petId) continue;
    if (asString(row.status) === "processing" || asString(row.status) === "draft") continue;
    if (asString(row.workflowStatus) === "review_required" || asString(row.workflowStatus) === "invalid_future_date") continue;
    if (row.requiresManualConfirmation === true) continue;
    const reconstructed = reconstructStoredEventForTaxonomy(row);
    if (!reconstructed) continue;
    const timestamp = Date.parse(reconstructed.event_date || asString(row.createdAt) || "");
    if (!Number.isFinite(timestamp) || timestamp >= recentCutoff) continue;
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

  const bucketDocs = new Map<string, Record<string, unknown>>();
  const episodeDocs = new Map<string, Record<string, unknown>>();
  const annualGroups = new Map<string, Array<typeof eligibleEvents[number]>>();
  const bucketEventCounts = new Map<string, number>();

  for (const item of eligibleEvents) {
    const periodMeta = buildNarrativePeriodMeta(item.timestamp, nowTimestamp);
    const threadLabel = buildNarrativeThreadLabel(item.event);
    const bucketId = `hb_${sha256(`${args.uid}_${item.petId}_${periodMeta.periodType}_${periodMeta.periodKey}`).slice(0, 24)}`;
    const bucketKey = `${bucketId}::${threadLabel}`;
    const yearGroupKey = `${item.petId}::${periodMeta.yearKey}`;

    if (!annualGroups.has(yearGroupKey)) annualGroups.set(yearGroupKey, []);
    annualGroups.get(yearGroupKey)!.push(item);

    bucketEventCounts.set(bucketId, (bucketEventCounts.get(bucketId) || 0) + 1);

    const episodeKey = `${bucketKey}`;
    const existing = episodeDocs.get(episodeKey) as { __events?: typeof eligibleEvents } | undefined;
    const nextEvents = existing?.__events ? [...existing.__events, item] : [item];

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
    }) as Record<string, unknown> & { __events?: typeof eligibleEvents };

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
      generatedAt: getNowIso(),
      updatedAt: getNowIso(),
    });
  }

  for (const [bucketId, bucket] of bucketDocs.entries()) {
    const episodesForBucket = Array.from(episodeDocs.values()).filter((episode) => asString(episode.bucketId) === bucketId);
    const eventCount = bucketEventCounts.get(bucketId) || 0;
    bucket.eventCount = eventCount;
    bucket.episodeCount = episodesForBucket.length;
    if (bucket.periodType === "month" && eventCount > 10) {
      bucket.densityMode = "compacted";
      bucket.bucket_summary = {
        headline: `Mes de alta intensidad clínica`,
        narrative: `Durante ${asString(bucket.periodLabel)}, ${asString(bucket.petName)} tuvo ${eventCount} eventos confirmados. PESSY los comprimió en episodios narrativos para lectura rápida.`,
      };
    }
  }

  for (const [annualKey, events] of annualGroups.entries()) {
    const [petId, yearKey] = annualKey.split("::");
    const first = events[0];
    const annualBucketId = `hb_${sha256(`${args.uid}_${petId}_year_${yearKey}`).slice(0, 24)}`;
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
      generatedAt: getNowIso(),
      updatedAt: getNowIso(),
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
      const clone = { ...episode };
      delete clone.__events;
      return clone;
    });

    for (const bucket of allBucketDocs) {
      await admin.firestore().collection("history_buckets").doc(asString(bucket.bucketId)).set(bucket, { merge: true });
      result.buckets_written += 1;
      if (result.sample_bucket_ids.length < 10) result.sample_bucket_ids.push(asString(bucket.bucketId));
      if (bucket.annual_summary) result.yearly_summaries_written += 1;
    }

    for (const episode of allEpisodeDocs) {
      await admin.firestore().collection("history_episodes").doc(asString(episode.episodio_id)).set(episode, { merge: true });
      result.episodes_written += 1;
      if (result.sample_episode_ids.length < 10) result.sample_episode_ids.push(asString(episode.episodio_id));
    }
  } else {
    result.buckets_written = bucketDocs.size;
    result.episodes_written = episodeDocs.size;
    result.yearly_summaries_written = Array.from(bucketDocs.values()).filter((bucket) => Boolean(bucket.annual_summary)).length;
    result.sample_bucket_ids = Array.from(bucketDocs.keys()).slice(0, 10);
    result.sample_episode_ids = Array.from(episodeDocs.values()).map((episode) => asString(episode.episodio_id)).slice(0, 10);
  }

  return result;
}

async function uploadAttachmentBase64ToStorage(args: {
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
async function callGoogleJson<T>(url: string, accessToken: string): Promise<T> {
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

function isMetadataOnlyScopeError(error: unknown): boolean {
  const message = String(error || "");
  if (!message.includes("google_api_failed_403")) return false;
  return /metadata scope|format\s*full|scope does not support format full/i.test(message);
}

async function assertGmailFullPayloadAccess(accessToken: string): Promise<void> {
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

async function markGmailReconsentRequired(args: {
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

async function exchangeRefreshToken(params: {
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
async function extractDocxTextFromBase64(base64DataOrUrl: string): Promise<string> {
  const buffer = decodeBase64UrlToBuffer(base64DataOrUrl);
  const result = await mammoth.extractRawText({ buffer });
  return asString(result.value).slice(0, 40_000);
}

async function fetchAttachmentTextChunks(args: {
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
    let reason: string;
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

function normalizeWebhookAttachmentMetadata(rawValue: unknown): AttachmentMetadata[] {
  if (!Array.isArray(rawValue)) return [];
  return rawValue
    .map((entry) => {
      if (typeof entry === "string") {
        const filename = asString(entry) || "attachment";
        return {
          filename,
          mimetype: normalizeMimeType("", filename),
          size_bytes: 0,
          ocr_success: false,
          ocr_reason: "",
          original_mimetype: null,
          normalized_mimetype: normalizeMimeType("", filename),
        } as AttachmentMetadata;
      }
      const row = asRecord(entry);
      const filename = asString(row.filename) || asString(row.name) || "attachment";
      const mimeType = normalizeMimeType(asString(row.mimeType) || asString(row.mimetype), filename);
      return {
        filename,
        mimetype: mimeType,
        size_bytes: asNonNegativeNumber(row.sizeBytes, asNonNegativeNumber(row.size_bytes, 0)),
        ocr_success: false,
        ocr_reason: "",
        original_mimetype: asString(row.mimeType) || asString(row.mimetype) || null,
        normalized_mimetype: mimeType,
      } as AttachmentMetadata;
    })
    .slice(0, MAX_ATTACHMENTS_PER_EMAIL);
}
async function fetchUserRefreshToken(uid: string): Promise<{ refreshToken: string; grantedScopes: string[] }> {
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

async function resolvePlanAndPet(args: {
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

async function fetchGmailProfile(accessToken: string): Promise<{ email: string | null; historyId: string | null }> {
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

async function countActiveSessions(): Promise<number> {
  const maxConcurrent = getMaxConcurrentExtractionJobs();
  const snapshot = await admin
    .firestore()
    .collection("gmail_ingestion_sessions")
    .where("status", "in", ["queued", "processing"])
    .limit(maxConcurrent + 1)
    .get();
  return snapshot.size;
}

async function createOrUpdateUserEmailConfig(args: {
  uid: string;
  gmailAccount: string | null;
  preferredPetId?: string | null;
  lastHistoryId: string | null;
  ingestionStatus: IngestionStatus;
}): Promise<UserEmailConfig> {
  const planAndPet = await resolvePlanAndPet({ uid: args.uid, preferredPetId: args.preferredPetId });
  const maxLookbackMonths = calculateMaxLookbackMonths({
    planType: planAndPet.planType,
    birthDate: parseIsoDate(planAndPet.petBirthDateIso),
    petAgeYears: planAndPet.petAgeYears,
  });
  const maxMailsPerSync = getMaxMailsPerSync(planAndPet.planType);
  const nowIso = getNowIso();

  const config: UserEmailConfig = {
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
  await admin.firestore().collection("users").doc(args.uid).set(
    {
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
    },
    { merge: true }
  );

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

async function processScanQueueJob(
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

async function processAttachmentQueueJob(
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

async function processAiQueueJob(
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
  const effectivePetId = planAndPet.petId || petId || planAndPet.fallbackPetId;
  // Si el resolver no pudo elegir pet (multi-mascota ambiguo) pero hay un fallback,
  // tratar igual que identity conflict para forzar review manual.
  const petWasAmbiguous =
    planAndPet.petId === null &&
    asNonNegativeNumber(planAndPet.activePetCount, 0) > 1 &&
    Boolean(effectivePetId);
  const identityConflict =
    planAndPet.petResolutionDebug.identity_conflict === true || petWasAmbiguous;
  const identityConflictReason = identityConflict
    ? planAndPet.petResolutionDebug.identity_conflict === true
      ? "IDENTITY_CONFLICT"
      : "AMBIGUOUS_PET_MULTI_MATCH"
    : null;
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


async function processSession(sessionId: string, options: ProcessOptions): Promise<void> {
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
        const payload = detail.payload;
        const fromEmail = getHeader(payload, "From");
        const subject = getHeader(payload, "Subject") || asString(detail.snippet).slice(0, 120);
        const bodyText = extractBodyText(payload) || asString(detail.snippet);
        const dateIso = parseGmailDate(
          asString(getHeader(payload, "Date")) || new Date(Number(detail.internalDate || Date.now())).toISOString()
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

        const { attachmentMetadata, imageCount } = await fetchAttachmentMetadata({
          payload,
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

export async function initializeEmailIngestionAfterOauth(args: {
  uid: string;
  accountEmail: string | null;
  accessToken: string;
  preferredPetId?: string | null;
}): Promise<BootstrapResult> {
  const profile = await fetchGmailProfile(args.accessToken);
  const config = await createOrUpdateUserEmailConfig({
    uid: args.uid,
    gmailAccount: args.accountEmail || profile.email,
    preferredPetId: args.preferredPetId,
    lastHistoryId: profile.historyId,
    ingestionStatus: "scanning_emails",
  });
  const sessionId = await createIngestionSession({ uid: args.uid, config, preferredPetId: args.preferredPetId });
  await ensurePendingScanJob(sessionId, args.uid);
  return { config, sessionId };
}

export const triggerEmailClinicalIngestion = functions
  .runWith({
    timeoutSeconds: 120,
    memory: "512MB",
    secrets: ["GMAIL_OAUTH_CLIENT_ID", "GMAIL_OAUTH_CLIENT_SECRET", "MAIL_TOKEN_ENCRYPTION_KEY", "GEMINI_API_KEY"],
  })
  .region("us-central1")
  .https.onCall(async (data, context) => {
    if (!context.auth?.uid) {
      throw new functions.https.HttpsError("unauthenticated", "Debes iniciar sesión.");
    }

    const uid = context.auth.uid;
    await assertGmailInvitationOrThrow(uid);

    const preferredPetId = asString(data?.petId) || null;
    const token = await fetchUserRefreshToken(uid).catch(() => null);
    if (!token) {
      throw new functions.https.HttpsError("failed-precondition", "No hay Gmail conectado para este usuario.");
    }

    const clientId = asString(process.env.GMAIL_OAUTH_CLIENT_ID);
    const clientSecret = asString(process.env.GMAIL_OAUTH_CLIENT_SECRET);
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

    await ensurePendingScanJob(bootstrap.sessionId, uid);

    return {
      ok: true,
      session_id: bootstrap.sessionId,
      status: "scanning_emails",
      message: "Sincronización iniciada. Te avisaremos cuando finalice.",
    };
  });

export const runEmailClinicalIngestionQueue = functions
  .runWith({
    timeoutSeconds: 540,
    memory: "1GB",
    secrets: ["GMAIL_OAUTH_CLIENT_ID", "GMAIL_OAUTH_CLIENT_SECRET", "MAIL_TOKEN_ENCRYPTION_KEY", "GEMINI_API_KEY"],
  })
  .region("us-central1")
  .pubsub.schedule("every 5 minutes")
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
    await purgeExpiredRawDocuments(120);
    const activeSessions = await admin
      .firestore()
      .collection("gmail_ingestion_sessions")
      .where("status", "in", ["queued", "processing"])
      .limit(getMaxConcurrentExtractionJobs())
      .get();

    for (const sessionDoc of activeSessions.docs) {
      const sessionData = asRecord(sessionDoc.data());
      const uid = asString(sessionData.user_id);
      if (!uid) continue;
      await ensurePendingScanJob(sessionDoc.id, uid);
      await maybeFinalizeSession(sessionDoc.id);

      const refreshedSession = await sessionDoc.ref.get();
      if (!refreshedSession.exists) continue;
      const refreshedData = asRecord(refreshedSession.data());
      const refreshedStatus = asString(refreshedData.status);
      if (refreshedStatus !== "queued" && refreshedStatus !== "processing") continue;

      const updatedAt = parseIsoDate(refreshedData.updated_at) || parseIsoDate(refreshedData.created_at);
      if (!updatedAt) continue;
      const staleMs = now - updatedAt.getTime();
      if (staleMs < STALE_ACTIVE_SESSION_MS) continue;

      const pendingJobs = await countPendingJobsForSession(sessionDoc.id);
      if (pendingJobs.total > 0) continue;

      await closeStuckSessionAsPartial({
        sessionId: sessionDoc.id,
        uid,
        sessionData: refreshedData,
        pendingJobs,
        reason: "watchdog_timeout_no_pending_jobs",
      });
    }
    return null;
  });

async function runStageWorkers(args: {
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

async function pickPendingJobsForSession(args: {
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

async function runSessionStageWorkers(args: {
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

async function countPendingJobsForSession(sessionId: string): Promise<{
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

async function drainSessionQueues(args: {
  sessionId: string;
  maxWaitMs: number;
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

    const handledThisTick = scanHandled + attachmentHandled + aiHandledAfterAttachment;
    if (pending.total === 0 && handledThisTick === 0) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, FORCE_DRAIN_POLL_MS));
  }
}

export const runEmailClinicalScanWorker = functions
  .runWith({
    timeoutSeconds: 540,
    memory: "1GB",
    secrets: ["GMAIL_OAUTH_CLIENT_ID", "GMAIL_OAUTH_CLIENT_SECRET", "MAIL_TOKEN_ENCRYPTION_KEY", "GEMINI_API_KEY"],
  })
  .region("us-central1")
  .pubsub.schedule("every 5 minutes")
  .timeZone("America/Argentina/Buenos_Aires")
  .onRun(async () => {
    await runStageWorkers({
      stage: "scan",
      limit: getScanWorkersPerTick(),
      lockPrefix: "scan",
      handler: processScanQueueJob,
    });
    return null;
  });

export const runEmailClinicalAttachmentWorker = functions
  .runWith({
    timeoutSeconds: 540,
    memory: "1GB",
    secrets: ["GMAIL_OAUTH_CLIENT_ID", "GMAIL_OAUTH_CLIENT_SECRET", "MAIL_TOKEN_ENCRYPTION_KEY", "GEMINI_API_KEY"],
  })
  .region("us-central1")
  .pubsub.schedule("every 5 minutes")
  .timeZone("America/Argentina/Buenos_Aires")
  .onRun(async () => {
    await runStageWorkers({
      stage: "attachment",
      limit: getAttachmentWorkersPerTick(),
      lockPrefix: "attachment",
      handler: processAttachmentQueueJob,
    });
    return null;
  });

export const runEmailClinicalAiWorker = functions
  .runWith({
    timeoutSeconds: 540,
    memory: "1GB",
    secrets: ["GMAIL_OAUTH_CLIENT_ID", "GMAIL_OAUTH_CLIENT_SECRET", "MAIL_TOKEN_ENCRYPTION_KEY", "GEMINI_API_KEY"],
  })
  .region("us-central1")
  .pubsub.schedule("every 5 minutes")
  .timeZone("America/Argentina/Buenos_Aires")
  .onRun(async () => {
    await runStageWorkers({
      stage: "ai_extract",
      limit: getAiWorkersPerTick(),
      lockPrefix: "ai",
      handler: processAiQueueJob,
    });
    return null;
  });

export const forceRunEmailClinicalIngestion = functions
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
    if (req.method !== "POST") {
      res.status(405).json({ ok: false, error: "method_not_allowed" });
      return;
    }

    const configuredKey = asString(process.env.GMAIL_FORCE_SYNC_KEY);
    const incomingHeader = asString(req.headers["x-force-sync-key"]);
    const authHeader = asString(req.headers.authorization).replace(/^Bearer\s+/i, "");
    const incomingKey = incomingHeader || authHeader;
    if (!configuredKey || !incomingKey || incomingKey !== configuredKey) {
      res.status(401).json({ ok: false, error: "unauthorized" });
      return;
    }

    const body = asRecord(req.body);
    if (body.listConnected === true) {
      const tokenDocs = await admin.firestore().collectionGroup("mail_sync_tokens").limit(100).get();
      const connected: Array<Record<string, unknown>> = [];
      for (const doc of tokenDocs.docs) {
        if (doc.id !== "gmail") continue;
        const uid = doc.ref.parent.parent?.id || "";
        if (!uid) continue;
        const userSnap = await admin.firestore().collection("users").doc(uid).get();
        const userData = asRecord(userSnap.data());
        const email = asString(userData.email) || null;
        if (!email && getQaAllowedUserEmails().length > 0) continue;
        if (email && !isEmailAllowedForQa(email)) continue;
        connected.push({
          uid,
          email,
          fullName: asString(userData.fullName) || asString(userData.name) || null,
          gmailAccount: asString(asRecord(userData.gmailSync).accountEmail) || null,
        });
      }
      res.status(200).json({ ok: true, connected });
      return;
    }

    const byUid = asString(body.uid);
    const byEmail = asString(body.email).toLowerCase();
    const preferredPetId = asString(body.petId) || null;
    const planOverrideRaw = asString(body.planOverride).toLowerCase();
    const planOverride: UserPlanType | null = planOverrideRaw === "premium" || planOverrideRaw === "free"
      ? (planOverrideRaw as UserPlanType)
      : null;
    const maxEmails = clamp(asNonNegativeNumber(body.maxEmails, 50), 1, getPremiumPlanMaxEmailsPerSync());
    const lookbackOverrideRaw = asNonNegativeNumber(body.lookbackMonths, 0);
    const lookbackOverrideMonths = lookbackOverrideRaw > 0 ? clamp(lookbackOverrideRaw, 1, 180) : null;
    const disableDedup = body.disableDedup === true;
    const disableFallbackQuery = body.disableFallbackQuery === true;
    const waitForCompletion = body.waitForCompletion !== false;
    const drainTimeoutMs = clamp(asNonNegativeNumber(body.drainTimeoutMs, FORCE_DRAIN_MAX_WAIT_MS), 10_000, 8 * 60 * 1000);
    const includeExtracted = body.includeExtracted === true;
    const debugLimit = clamp(asNonNegativeNumber(body.debugLimit, 5), 1, 20);

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
    const targetUserData = asRecord(targetUserSnap.data());
    const targetEmail = asString(targetUserData.email) || byEmail;
    if (!isEmailAllowedForQa(targetEmail)) {
      res.status(403).json({ ok: false, error: "qa_user_not_allowed" });
      return;
    }

    if (planOverride) {
      await admin
        .firestore()
        .collection("email_sync_plan_overrides")
        .doc(uid)
        .set(
          {
            plan_type: planOverride,
            updated_at: getNowIso(),
            source: "force_run_api",
          },
          { merge: true }
        );
    }

    const token = await fetchUserRefreshToken(uid).catch(() => null);
    if (!token) {
      res.status(412).json({ ok: false, error: "gmail_not_connected" });
      return;
    }

    const clientId = asString(process.env.GMAIL_OAUTH_CLIENT_ID);
    const clientSecret = asString(process.env.GMAIL_OAUTH_CLIENT_SECRET);
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
      .set(
        {
          qa_disable_dedup: disableDedup,
          qa_disable_fallback_query: disableFallbackQuery,
          qa_total_scan_cap: maxEmails,
          max_mails_per_sync: maxEmails,
          updated_at: getNowIso(),
        },
        { merge: true }
      );

    if (lookbackOverrideMonths) {
      const { afterDate, beforeDate } = buildSessionDateWindow(lookbackOverrideMonths);
      const forcedQuery = buildGmailSearchQuery({
        afterDate,
        beforeDate,
        petName: bootstrap.config.pet_name,
        petId: bootstrap.config.pet_id,
      });
      const fallbackQuery = buildGmailSearchQuery({
        afterDate,
        beforeDate,
        petName: null,
        petId: null,
      });
      await admin
        .firestore()
        .collection("gmail_ingestion_sessions")
        .doc(bootstrap.sessionId)
        .set(
          {
            query: forcedQuery,
            fallback_query: fallbackQuery,
            fallback_query_applied: false,
            lookback_after: toIsoDateOnly(afterDate),
            lookback_before: toIsoDateOnly(beforeDate),
            updated_at: getNowIso(),
          },
          { merge: true }
        );
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
    const sessionData = asRecord(sessionSnap.data());
    const pendingJobs = await countPendingJobsForSession(bootstrap.sessionId);

    let debugExtraction: Record<string, unknown> | null = null;
    if (includeExtracted) {
      const docsSnap = await admin
        .firestore()
        .collection("gmail_ingestion_documents")
        .where("session_id", "==", bootstrap.sessionId)
        .limit(Math.max(debugLimit * 6, 30))
        .get();

      const docs = docsSnap.docs
        .map((doc) => {
          const row = asRecord(doc.data());
          const status = asString(row.processing_status);
          const aiClassification = asRecord(row.ai_classification);
          const aiResult = asRecord(row.ai_result);
          const linkExtraction = asRecord(row.link_extraction);
          const linkRowsRaw = Array.isArray(linkExtraction.links) ? linkExtraction.links : [];
          const linkRows = linkRowsRaw.slice(0, 3).map((item) => {
            const record = asRecord(item);
            return {
              url: asString(record.url),
              status: asString(record.status),
              reason: asString(record.reason),
              host: asString(record.host),
              extracted_chars: asNonNegativeNumber(record.extracted_chars, 0),
              ocr_used: record.ocr_used === true,
              redirect_count: asNonNegativeNumber(record.redirect_count, 0),
              login_required: record.login_required === true,
            };
          });
          const extractedEvents = Array.isArray(aiResult.detected_events) ? aiResult.detected_events : [];
          return {
            doc_id: doc.id,
            message_id: asString(row.message_id),
            from_email: asString(row.from_email),
            subject: asString(row.subject),
            processing_status: status,
            classification: {
              is_clinical: aiClassification.is_clinical === true,
              confidence: asNonNegativeNumber(aiClassification.confidence, 0),
            },
            extraction: {
              is_clinical_content: aiResult.is_clinical_content === true,
              confidence_overall: asNonNegativeNumber(aiResult.confidence_overall, 0),
              detected_events_count: extractedEvents.length,
            },
            link_extraction: {
              links_detected: asNonNegativeNumber(linkExtraction.links_detected, 0),
              links_fetched: asNonNegativeNumber(linkExtraction.links_fetched, 0),
              links_with_text: asNonNegativeNumber(linkExtraction.links_with_text, 0),
              sample: linkRows,
            },
            created_at: asString(row.created_at),
            updated_at: asString(row.updated_at),
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
        const row = asRecord(doc.data());
        const event = asRecord(row.event);
        const source = asRecord(row.source_email);
        return {
          review_id: doc.id,
          status: asString(row.status),
          reason: asString(row.reason),
          confidence_overall: asNonNegativeNumber(row.confidence_overall, 0),
          source_email_id: asString(source.message_id),
          source_subject: asString(source.subject),
          event_type: asString(event.event_type),
          event_date: asString(event.event_date),
          diagnosis: asString(event.diagnosis),
          summary: asString(event.description_summary).slice(0, 220),
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
          const row = asRecord(doc.data());
          const extracted = asRecord(row.extractedData);
          return {
            event_id: doc.id,
            title: asString(row.title),
            source_email_id: asString(row.source_email_id),
            status: asString(row.status),
            workflow_status: asString(row.workflowStatus),
            confidence: asNonNegativeNumber(row.overallConfidence, 0),
            document_type: asString(extracted.documentType),
            diagnosis: asString(extracted.diagnosis),
            observations: asString(extracted.observations).slice(0, 220),
            medications_count: Array.isArray(extracted.medications) ? extracted.medications.length : 0,
            created_at: asString(row.createdAt),
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
      status: asString(sessionData.status) || "scanning_emails",
      counters: asRecord(sessionData.counters),
      summary: asRecord(sessionData.summary),
      debug_extraction: debugExtraction,
    });
  });

export const backfillGmailTaxonomy = functions
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

    const configuredKey = asString(process.env.GMAIL_FORCE_SYNC_KEY);
    const incomingHeader = asString(req.headers["x-force-sync-key"]);
    const authHeader = asString(req.headers.authorization).replace(/^Bearer\s+/i, "");
    const incomingKey = incomingHeader || authHeader;
    if (!configuredKey || !incomingKey || incomingKey !== configuredKey) {
      res.status(401).json({ ok: false, error: "unauthorized" });
      return;
    }

    const body = asRecord(req.body);
    let uid = asString(body.uid);
    const byEmail = asString(body.email).toLowerCase();
    if (!uid && byEmail) {
      const userQuery = await admin.firestore().collection("users").where("email", "==", byEmail).limit(1).get();
      if (!userQuery.empty) uid = userQuery.docs[0].id;
    }
    if (!uid) {
      res.status(400).json({ ok: false, error: "uid_or_email_required" });
      return;
    }

    const userSnap = await admin.firestore().collection("users").doc(uid).get();
    const userData = asRecord(userSnap.data());
    const targetEmail = asString(userData.email) || byEmail;
    if (!targetEmail) {
      res.status(404).json({ ok: false, error: "user_email_not_found" });
      return;
    }
    if (!isEmailAllowedForQa(targetEmail)) {
      res.status(403).json({ ok: false, error: "qa_user_not_allowed" });
      return;
    }

    try {
      const result = await runGmailTaxonomyBackfill({
        uid,
        email: targetEmail,
        dryRun: body.dryRun !== false,
        limit: asNonNegativeNumber(body.limit, 150),
        includeAppointments: body.includeAppointments !== false,
      });

      res.status(200).json({
        ok: true,
        uid,
        email: targetEmail,
        dryRun: body.dryRun !== false,
        result,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ ok: false, error: message });
    }
  });

export const backfillNarrativeHistory = functions
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

    const configuredKey = asString(process.env.GMAIL_FORCE_SYNC_KEY);
    const incomingHeader = asString(req.headers["x-force-sync-key"]);
    const authHeader = asString(req.headers.authorization).replace(/^Bearer\s+/i, "");
    const incomingKey = incomingHeader || authHeader;
    if (!configuredKey || !incomingKey || incomingKey !== configuredKey) {
      res.status(401).json({ ok: false, error: "unauthorized" });
      return;
    }

    const body = asRecord(req.body);
    let uid = asString(body.uid);
    const byEmail = asString(body.email).toLowerCase();
    if (!uid && byEmail) {
      const userQuery = await admin.firestore().collection("users").where("email", "==", byEmail).limit(1).get();
      if (!userQuery.empty) uid = userQuery.docs[0].id;
    }
    if (!uid) {
      res.status(400).json({ ok: false, error: "uid_or_email_required" });
      return;
    }

    const userSnap = await admin.firestore().collection("users").doc(uid).get();
    const userData = asRecord(userSnap.data());
    const targetEmail = asString(userData.email) || byEmail;
    if (!targetEmail) {
      res.status(404).json({ ok: false, error: "user_email_not_found" });
      return;
    }
    if (!isEmailAllowedForQa(targetEmail)) {
      res.status(403).json({ ok: false, error: "qa_user_not_allowed" });
      return;
    }

    try {
      const result = await runNarrativeHistoryBackfill({
        uid,
        email: targetEmail,
        petId: asString(body.petId) || null,
        dryRun: body.dryRun !== false,
        limit: asNonNegativeNumber(body.limit, 250),
      });

      res.status(200).json({
        ok: true,
        uid,
        email: targetEmail,
        petId: asString(body.petId) || null,
        dryRun: body.dryRun !== false,
        result,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ ok: false, error: message });
    }
  });

export const cleanupLegacyMailsyncMedicalEvents = functions
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

    const configuredKey = asString(process.env.GMAIL_FORCE_SYNC_KEY);
    const incomingHeader = asString(req.headers["x-force-sync-key"]);
    const authHeader = asString(req.headers.authorization).replace(/^Bearer\s+/i, "");
    const incomingKey = incomingHeader || authHeader;
    if (!configuredKey || !incomingKey || incomingKey !== configuredKey) {
      res.status(401).json({ ok: false, error: "unauthorized" });
      return;
    }

    const body = asRecord(req.body);
    let uid = asString(body.uid);
    const byEmail = asString(body.email).toLowerCase();
    if (!uid && byEmail) {
      const userQuery = await admin.firestore().collection("users").where("email", "==", byEmail).limit(1).get();
      if (!userQuery.empty) uid = userQuery.docs[0].id;
    }
    if (!uid) {
      res.status(400).json({ ok: false, error: "uid_or_email_required" });
      return;
    }

    const userSnap = await admin.firestore().collection("users").doc(uid).get();
    const userData = asRecord(userSnap.data());
    const targetEmail = asString(userData.email) || byEmail;
    if (!targetEmail) {
      res.status(404).json({ ok: false, error: "user_email_not_found" });
      return;
    }
    if (!isEmailAllowedForQa(targetEmail)) {
      res.status(403).json({ ok: false, error: "qa_user_not_allowed" });
      return;
    }

    try {
      const result = await runLegacyMailsyncCleanup({
        uid,
        email: targetEmail,
        petId: asString(body.petId) || null,
        dryRun: body.dryRun !== false,
        limit: asNonNegativeNumber(body.limit, 250),
        refreshNarrative: body.refreshNarrative !== false,
      });

      res.status(200).json({
        ok: true,
        uid,
        email: targetEmail,
        petId: asString(body.petId) || null,
        dryRun: body.dryRun !== false,
        result,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ ok: false, error: message });
    }
  });

export const ingestClinicalEmailWebhook = functions
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

    const configuredKey = asString(process.env.GMAIL_FORCE_SYNC_KEY);
    const incomingHeader = asString(req.headers["x-webhook-key"]) || asString(req.headers["x-force-sync-key"]);
    const authHeader = asString(req.headers.authorization).replace(/^Bearer\s+/i, "");
    const incomingKey = incomingHeader || authHeader;
    if (!configuredKey || !incomingKey || incomingKey !== configuredKey) {
      res.status(401).json({ ok: false, error: "unauthorized" });
      return;
    }

    const body = asRecord(req.body);
    const previewOnly = body.preview === true || body.dryRun === true;
    const forceIngest = body.force === true;

    const message = asRecord(body.message);
    const fromEmail = asString(message.from) || asString(body.from);
    const subject = asString(message.subject) || asString(body.subject);
    const bodyText =
      asString(message.text) ||
      asString(message.body) ||
      asString(body.bodyText) ||
      asString(body.text) ||
      "";
    const attachmentMetadata = normalizeWebhookAttachmentMetadata(
      message.attachments || body.attachments || body.attachmentNames
    );

    let uid = asString(body.uid);
    const byEmail = asString(body.email).toLowerCase();
    const preferredPetId = asString(body.petId) || null;
    if (!uid && byEmail) {
      const userQuery = await admin
        .firestore()
        .collection("users")
        .where("email", "==", byEmail)
        .limit(1)
        .get();
      if (!userQuery.empty) uid = userQuery.docs[0].id;
    }

    let petName = asString(body.petName);
    let petId = preferredPetId || asString(body.petId);
    let resolvedPlanAndPet: Awaited<ReturnType<typeof resolvePlanAndPet>> | null = null;
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

    const candidate = isCandidateClinicalEmail({
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
      sender_trusted: isTrustedClinicalSender(fromEmail),
      sender_blocked: isBlockedClinicalDomain(fromEmail),
      clinical_attachment: attachmentNamesContainClinicalSignal(attachmentMetadata),
      non_clinical_noise: hasStrongNonClinicalSignal(`${subject}\n${fromEmail}\n${bodyText}`),
      human_healthcare_noise: hasStrongHumanHealthcareSignal(`${subject}\n${fromEmail}\n${bodyText}`),
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
          plan_type: resolvedPlanAndPet?.planType || null,
          pet_resolution: resolvedPlanAndPet?.petResolutionDebug || null,
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
    const targetUserData = asRecord(targetUserSnap.data());
    const targetEmail = asString(targetUserData.email) || byEmail;
    if (!isEmailAllowedForQa(targetEmail)) {
      res.status(403).json({ ok: false, error: "qa_user_not_allowed" });
      return;
    }

    const token = await fetchUserRefreshToken(uid).catch(() => null);
    if (!token) {
      res.status(412).json({ ok: false, error: "gmail_not_connected" });
      return;
    }

    const clientId = asString(process.env.GMAIL_OAUTH_CLIENT_ID);
    const clientSecret = asString(process.env.GMAIL_OAUTH_CLIENT_SECRET);
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

    const maxEmails = clamp(asNonNegativeNumber(body.maxEmails, 20), 1, getPremiumPlanMaxEmailsPerSync());
    const lookbackMonths = clamp(asNonNegativeNumber(body.lookbackMonths, 2), 1, 24);

    await admin
      .firestore()
      .collection("gmail_ingestion_sessions")
      .doc(bootstrap.sessionId)
      .set(
        {
          qa_disable_fallback_query: true,
          qa_total_scan_cap: maxEmails,
          max_mails_per_sync: maxEmails,
          updated_at: getNowIso(),
        },
        { merge: true }
      );

    const { afterDate, beforeDate } = buildSessionDateWindow(lookbackMonths);
    const forcedQuery = buildGmailSearchQuery({
      afterDate,
      beforeDate,
      petName: bootstrap.config.pet_name,
      petId: bootstrap.config.pet_id,
    });
    const fallbackQuery = buildGmailSearchQuery({
      afterDate,
      beforeDate,
      petName: null,
      petId: null,
    });

    await admin
      .firestore()
      .collection("gmail_ingestion_sessions")
      .doc(bootstrap.sessionId)
      .set(
        {
          query: forcedQuery,
          fallback_query: fallbackQuery,
          fallback_query_applied: false,
          lookback_after: toIsoDateOnly(afterDate),
          lookback_before: toIsoDateOnly(beforeDate),
          updated_at: getNowIso(),
        },
        { merge: true }
      );

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
    const sessionData = asRecord(sessionSnap.data());

    res.status(200).json({
      ok: true,
      uid,
      session_id: bootstrap.sessionId,
      status: asString(sessionData.status) || "processing",
      counters: asRecord(sessionData.counters),
      summary: asRecord(sessionData.summary),
      prefilter,
    });
  });
