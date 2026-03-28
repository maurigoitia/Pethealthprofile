// ── API URLs ──────────────────────────────────────────────────────────────────
export const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
export const GOOGLE_GMAIL_PROFILE_URL = "https://gmail.googleapis.com/gmail/v1/users/me/profile";
export const GMAIL_API_BASE_URL = "https://gmail.googleapis.com/gmail/v1/users/me";

// ── Quotas & Rate Limits ─────────────────────────────────────────────────────
export const MAX_EMAILS_PER_USER_PER_DAY = 500;
export const FREE_PLAN_MAX_EMAILS_PER_SYNC = 300;
export const DEFAULT_BATCH_SIZE = 20;
export const MAX_CONCURRENT_EXTRACTION_JOBS = 20;
export const MAX_ATTACHMENT_SIZE_BYTES = 25 * 1024 * 1024;
export const MAX_ATTACHMENTS_PER_EMAIL = 10;
export const DEDUP_WINDOW_DAYS = 30;
export const SESSION_AUDIT_RETENTION_DAYS = 90;
export const ONE_DAY_MS = 24 * 60 * 60 * 1000;
export const FREE_PLAN_ATTACHMENT_PROCESS_LIMIT = 20;
export const MAX_AI_DOCUMENT_TEXT_CHARS = 120_000;
export const MIN_LIGHTWEIGHT_BODY_LENGTH = 140;
export const MAX_EXTERNAL_LINK_TEXT_CHARS = 120_000;
export const RECENT_HISTORY_WINDOW_DAYS = 90;
export const MONTHLY_BUCKET_UNTIL_MONTHS = 18;

// ── Timeouts ─────────────────────────────────────────────────────────────────
export const OCR_TIMEOUT_MS = 120_000;
export const CLINICAL_AI_TIMEOUT_MS = 15_000;
export const CLASSIFICATION_AI_TIMEOUT_MS = 7_000;

// ── Gmail ────────────────────────────────────────────────────────────────────
export const GMAIL_SCOPE_READONLY = "https://www.googleapis.com/auth/gmail.readonly";
export const RAW_DOCUMENT_TTL_MS = 1 * ONE_DAY_MS; // 24h — destrucción rápida por privacidad

// ── Workers ──────────────────────────────────────────────────────────────────
export const MAX_SCAN_WORKERS_PER_TICK = 1;
export const MAX_ATTACHMENT_WORKERS_PER_TICK = 2;
export const MAX_AI_WORKERS_PER_TICK = 2;

// ── Job Retry ────────────────────────────────────────────────────────────────
export const MAX_JOB_ATTEMPTS = 5;
export const JOB_RETRY_DELAYS_MS = [
  15 * 60 * 1000, // 15m
  60 * 60 * 1000, // 1h
  24 * 60 * 60 * 1000, // 24h
  24 * 60 * 60 * 1000, // +24h (48h total)
];
export const LOW_RESULT_FALLBACK_MAX_SCANNED = 3;
export const LOW_RESULT_FALLBACK_MAX_CANDIDATES = 1;
export const STALE_PROCESSING_JOB_MS = 5 * 60 * 1000;
export const STALE_PROCESSING_SCAN_FACTOR = 6;
export const STALE_ACTIVE_SESSION_MS = 60 * 60 * 1000;
export const FORCE_DRAIN_POLL_MS = 1200;
export const FORCE_DRAIN_MAX_WAIT_MS = 4 * 60 * 1000;
export const FORCE_DRAIN_MAX_JOBS_PER_STAGE = 30;

// ── External Links ───────────────────────────────────────────────────────────
export const DEFAULT_MAX_EXTERNAL_LINKS_PER_EMAIL = 2;
export const MAX_EXTERNAL_LINKS_PER_EMAIL_HARD_CAP = 5;
export const DEFAULT_EXTERNAL_LINK_FETCH_TIMEOUT_MS = 9000;
export const DEFAULT_EXTERNAL_LINK_MAX_BYTES = 6 * 1024 * 1024;
export const DEFAULT_EXTERNAL_LINK_MAX_REDIRECTS = 4;
export const MAX_EXTERNAL_LINK_REDIRECTS_HARD_CAP = 8;

// ── Domain Lists ─────────────────────────────────────────────────────────────
export const DEFAULT_HUMAN_BLOCKED_SENDER_DOMAINS = [
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

// ── Regex Constants ──────────────────────────────────────────────────────────
export const MEDICATION_UNIT_ONLY_REGEX = /^(?:\d+(?:[.,]\d+)?\s*)?(?:ml|mm|cm|kg|g|mg|mcg|ug|%|cc|x|comp(?:rimidos?)?)$/i;
export const MEDICATION_DOSING_HINT_REGEX = /\b(cada|hora|horas|hs|comprim|capsul|tableta|pastilla|jarabe|gotas|inyec|ampolla|sobres?)\b/i;
export const HISTORICAL_ONLY_SIGNAL_REGEX =
  /\b(desde\s+\d{4}|historic[oa]|revacun|calendario\s+de\s+vacun|esquema\s+de\s+vacun|vigencia|desde\s+hace|informaci[oó]n\s+general|referencia\s+hist[oó]rica)\b/i;
export const STRUCTURED_DIAGNOSIS_HINT_REGEX =
  /\b(cardiomegalia|cardiomiopat|dcm|hepatomegalia|esplenitis|esplenomegalia|fractura|luxaci[oó]n|insuficien|neoplas|masa|dermatitis|otitis|gastritis|nefritis|dilataci[oó]n)\b/i;
export const ANATOMICAL_MEASUREMENT_HINT_REGEX =
  /\b(prostata|prost[aá]tica|vol(?:umen)?|diametr|medida|eje|vejiga|renal|ri[nñ]on|ri[nñ]ones|hep[aá]tic|h[ií]gado|espl[eé]nic|bazo|coraz[oó]n|tor[aá]x|abdomen|pelvis|femoral|aur[ií]cula|ventr[ií]cul)\b/i;

export const MEDICATION_NAME_BLOCKLIST = new Set([
  "ml",
  "mm",
  "cm",
  "kg",
  "g",
  "mg",
  "mcg",
  "ug",
  "cc",
  "vol",
  "volumen",
  "diametro",
  "diam",
  "eje",
  "medida",
  "medidas",
  "prostata",
  "prostatica",
  "vejiga",
  "renal",
  "rinon",
  "rinones",
  "hepatico",
  "higado",
  "esplenico",
  "bazo",
  "corazon",
  "torax",
  "abdomen",
  "pelvis",
  "izquierdo",
  "derecho",
  "hallazgo",
  "normal",
  "alterado",
  "cada",
  "frecuencia",
  "dosis",
]);

// ── Legacy Constants ─────────────────────────────────────────────────────────
export const LEGACY_GENERIC_TITLES = new Set([
  "diagnostico detectado por correo",
  "estudio detectado por correo",
  "documento",
  "documento detectado por correo",
  "turno programado",
  "resultado de laboratorio",
  "informe de estudio",
  "diagnostico",
]);

export const LEGACY_DELETE_DOMAIN_HINTS = [
  "huesped.org",
  "ikeargentina.com",
  "osde",
  "swissmedical",
  "medicus",
  "galeno",
  "omint",
  "afip",
];

export const LEGACY_OPERATIONAL_NOISE_REGEX =
  /\b(tipo detectado:\s*cancelacion|tipo detectado:\s*recordatorio_turno|tipo detectado:\s*confirmacion_turno|recordatorio del turno|informacion de turno solicitado|información de turno solicitado|turno confirmado|turno cancelado|reprogramacion|reprogramación|recordatorio de turno|cancelacion de turno|cancelación de turno)\b/i;

export const LEGACY_SALVAGE_STUDY_REGEX =
  /\b(radiograf(?:ia|ias)?|rx\b|placa(?:s)?\s+de\s+t[oó]rax|ecograf(?:ia|ias)?|ultrason(?:ido)?|ultrasound|ecg|electrocardiograma|electrocardiograf|informe radiol[oó]gico|bronquitis|cardiomegalia|hepatomegalia|esplenitis|enfermedad discal|koh\b|microscop[ií]a|hemograma|bioqu[ií]mica|laboratorio)\b/i;

// ── Type Aliases ─────────────────────────────────────────────────────────────
export type UserPlanType = "free" | "premium";
export type IngestionStatus =
  | "idle"
  | "processing"
  | "scanning_emails"
  | "analyzing_documents"
  | "extracting_medical_events"
  | "organizing_history"
  | "completed"
  | "requires_review";
export type QueueStatus = "queued" | "processing" | "completed" | "requires_review" | "failed";
export type EventType =
  | "appointment_confirmation"
  | "appointment_reminder"
  | "appointment_cancellation"
  | "clinical_report"
  | "study_report"
  | "prescription_record"
  | "vaccination_record";
export type DomainIngestionType = "appointment" | "treatment" | "vaccination" | "medical_event";
export type QueueJobStatus = "pending" | "processing" | "completed" | "failed";
export type QueueJobStage = "scan" | "attachment" | "ai_extract";
export type AppointmentEventStatus = "confirmed" | "reminder" | "cancelled" | "scheduled" | null;
export type StudySubtype = "imaging" | "lab" | null;
export type LegacyCleanupAction = "delete" | "salvage" | "keep";
export type NarrativePeriodType = "month" | "year";

// ── Interfaces ───────────────────────────────────────────────────────────────
export interface GoogleTokenResponse {
  access_token?: string;
  expires_in?: number;
}

export interface GmailProfileResponse {
  emailAddress?: string;
  historyId?: string;
}

export interface GmailMessageListResponse {
  messages?: Array<{ id?: string; threadId?: string }>;
  nextPageToken?: string;
}

export interface GmailAttachmentResponse {
  data?: string;
  size?: number;
}

export interface GmailMessagePart {
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

export interface GmailMessageDetailResponse {
  id?: string;
  threadId?: string;
  labelIds?: string[];
  snippet?: string;
  internalDate?: string;
  payload?: GmailMessagePart;
}

export interface UserEmailConfig {
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

export interface AttachmentMetadata {
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

export interface ExternalLinkExtractionMetadata {
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

export interface RawDocumentLike {
  source: "email";
  message_id: string;
  thread_id: string;
  email_date: string;
  body_text: string;
  attachment_meta: AttachmentMetadata[];
  hash_signature_raw: string;
}

export interface ClinicalMedication {
  name: string;
  dose: string | null;
  frequency: string | null;
  duration_days: number | null;
  is_active: boolean | null;
}

export interface ClinicalLabResult {
  test_name: string;
  result: string;
  unit: string | null;
  reference_range: string | null;
}

export interface ClinicalEventExtraction {
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

export interface ClinicalExtractionOutput {
  is_clinical_content: boolean;
  confidence_overall: number;
  detected_events: ClinicalEventExtraction[];
  narrative_summary: string;
  requires_human_review: boolean;
  reason_if_review_needed: string | null;
  /** "ai" (default) o "heuristic" cuando Claude API no estaba disponible */
  extractionMethod?: "ai" | "heuristic";
}

export interface SessionCounters {
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

export interface ProcessOptions {
  maxEmailsToProcess: number;
  hardDeadlineMs: number;
  disableDedup?: boolean;
}

export interface QueueJobBase {
  stage: QueueJobStage;
  status: QueueJobStatus;
  session_id: string;
  user_id: string;
  attempts: number;
  available_at: string;
  created_at: string;
  updated_at: string;
}

export interface ScanQueueJobPayload {
  page_token?: string | null;
}

export interface AttachmentQueueJobPayload {
  message_id: string;
  raw_doc_id: string;
}

export interface AiExtractQueueJobPayload {
  message_id: string;
  raw_doc_id: string;
  source_sender: string;
  source_subject: string;
  mode: "classify" | "extract";
}

export interface BootstrapResult {
  config: UserEmailConfig;
  sessionId: string;
}

export interface GmailTaxonomyBackfillResult {
  total_scanned: number;
  eligible_email_events: number;
  updated: number;
  unchanged: number;
  skipped_non_email: number;
  skipped_unclassified: number;
  appointment_projections_updated: number;
  errors: number;
  samples: Array<Record<string, unknown>>;
  error_details: Array<{ docId: string; error: string }>;
}

export interface LegacyCleanupSample {
  docId: string;
  action: LegacyCleanupAction;
  title: string | null;
  sender: string | null;
  provider: string | null;
  documentType: string | null;
  reasons: string[];
}

export interface LegacyMailsyncCleanupResult {
  total_scanned: number;
  eligible_legacy_events: number;
  delete_candidates: number;
  salvage_candidates: number;
  deleted: number;
  skipped: number;
  artifacts_deleted: number;
  errors: number;
  narrative_refreshed: boolean;
  samples: LegacyCleanupSample[];
  error_details: Array<{ docId: string; error: string }>;
}

export interface NarrativeHistoryBackfillResult {
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

export interface ClinicalClassificationOutput {
  is_clinical: boolean;
  confidence: number;
  /** "ai" (default) o "heuristic" cuando Claude API no estaba disponible */
  classificationMethod?: "ai" | "heuristic";
}

export interface ClinicalClassificationInput {
  bodyText: string;
  subject?: string;
  fromEmail?: string;
  attachmentMetadata?: AttachmentMetadata[];
}

export interface PetResolutionHints {
  subjectText?: string;
  bodyText?: string;
}

export interface PetCandidateProfile {
  id: string;
  data: Record<string, unknown>;
  name: string;
  species: string;
  breed: string;
  knownConditions: string[];
}

export interface PetCandidateScore {
  pet: PetCandidateProfile;
  score: number;
  anchors: number;
  reasons: string[];
}
