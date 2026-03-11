import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from "crypto";
import { Readable, Transform } from "stream";
import { pipeline } from "stream/promises";
import * as mammoth from "mammoth/lib/index";
import { resolveClinicalKnowledgeContext } from "../clinical/knowledgeBase";
import { resolveBrainOutput } from "../clinical/brainResolver";
import { assertGmailInvitationOrThrow } from "./invitation";

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

type UserPlanType = "free" | "premium";
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

interface ClinicalExtractionOutput {
  is_clinical_content: boolean;
  confidence_overall: number;
  detected_events: ClinicalEventExtraction[];
  narrative_summary: string;
  requires_human_review: boolean;
  reason_if_review_needed: string | null;
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

function sanitizeAttachmentMetadataForFirestore(rows: AttachmentMetadata[]): AttachmentMetadata[] {
  return rows.map((row) => ({
    filename: asString(row.filename) || "attachment",
    mimetype: asString(row.mimetype) || "application/octet-stream",
    size_bytes: asNonNegativeNumber(row.size_bytes, 0),
    ocr_success: row.ocr_success === true,
    ocr_reason: asString(row.ocr_reason) || "",
    ocr_detail: asString(row.ocr_detail) || null,
    original_mimetype: asString(row.original_mimetype) || null,
    normalized_mimetype: asString(row.normalized_mimetype) || null,
    storage_uri: asString(row.storage_uri) || null,
    storage_path: asString(row.storage_path) || null,
    storage_bucket: asString(row.storage_bucket) || null,
    storage_signed_url: asString(row.storage_signed_url) || null,
    storage_success: row.storage_success === true,
    storage_error: asString(row.storage_error) || null,
  }));
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

function getNowIso(): string {
  return new Date().toISOString();
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function hasNumericSignal(value: unknown): boolean {
  const text = asString(value);
  return /\d/.test(text);
}

function sanitizeReferenceRange(referenceRange: unknown, resultValue: unknown): string | null {
  const range = asString(referenceRange);
  if (!range) return null;
  const quantitative = hasNumericSignal(range) || hasNumericSignal(resultValue);
  if (quantitative) return range;
  if (/(alto|bajo|alterado|fuera\s+de\s+rango|normal)/i.test(range)) return null;
  return range;
}

const MEDICATION_UNIT_ONLY_REGEX = /^(?:\d+(?:[.,]\d+)?\s*)?(?:ml|mm|cm|kg|g|mg|mcg|ug|%|cc|x|comp(?:rimidos?)?)$/i;
const MEDICATION_DOSING_HINT_REGEX = /\b(cada|hora|horas|hs|comprim|capsul|tableta|pastilla|jarabe|gotas|inyec|ampolla|sobres?)\b/i;
const HISTORICAL_ONLY_SIGNAL_REGEX =
  /\b(desde\s+\d{4}|historic[oa]|revacun|calendario\s+de\s+vacun|esquema\s+de\s+vacun|vigencia|desde\s+hace|informaci[oó]n\s+general|referencia\s+hist[oó]rica)\b/i;
const STRUCTURED_DIAGNOSIS_HINT_REGEX =
  /\b(cardiomegalia|cardiomiopat|dcm|hepatomegalia|esplenitis|esplenomegalia|fractura|luxaci[oó]n|insuficien|neoplas|masa|dermatitis|otitis|gastritis|nefritis|dilataci[oó]n)\b/i;
const ANATOMICAL_MEASUREMENT_HINT_REGEX =
  /\b(prostata|prost[aá]tica|vol(?:umen)?|diametr|medida|eje|vejiga|renal|ri[nñ]on|ri[nñ]ones|hep[aá]tic|h[ií]gado|espl[eé]nic|bazo|coraz[oó]n|tor[aá]x|abdomen|pelvis|femoral|aur[ií]cula|ventr[ií]cul)\b/i;
const MEDICATION_NAME_BLOCKLIST = new Set([
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

function normalizeClinicalToken(value: string): string {
  return asString(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s/.-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanSentence(value: string): string {
  return asString(value)
    .replace(/\s+/g, " ")
    .replace(/\s+[·|]\s+/g, " · ")
    .trim();
}

function isAppointmentEventType(eventType: EventType): boolean {
  return (
    eventType === "appointment_confirmation" ||
    eventType === "appointment_reminder" ||
    eventType === "appointment_cancellation"
  );
}

function isPrescriptionEventType(eventType: EventType): boolean {
  return eventType === "prescription_record";
}

function isVaccinationEventType(eventType: EventType): boolean {
  return eventType === "vaccination_record";
}

function isStudyEventType(eventType: EventType): boolean {
  return eventType === "study_report";
}

function inferAppointmentStatusFromText(text: string): AppointmentEventStatus {
  const normalized = normalizeClinicalToken(text);
  if (!normalized) return null;
  if (/\b(cancelad|reprogramad|suspendid)\b/.test(normalized)) return "cancelled";
  if (/\b(recordatorio|recorda|recuerda)\b/.test(normalized)) return "reminder";
  if (/\b(confirmad|confirmacion)\b/.test(normalized)) return "confirmed";
  if (/\b(turno|consulta|control)\b/.test(normalized)) return "scheduled";
  return null;
}

function normalizeAppointmentStatusValue(value: unknown, fallbackText = ""): AppointmentEventStatus {
  const normalized = normalizeClinicalToken(asString(value));
  if (normalized === "confirmed" || normalized === "confirmado") return "confirmed";
  if (normalized === "reminder" || normalized === "recordatorio") return "reminder";
  if (normalized === "cancelled" || normalized === "canceled" || normalized === "cancelado" || normalized === "reprogramado") {
    return "cancelled";
  }
  if (normalized === "scheduled" || normalized === "programado" || normalized === "agendado") return "scheduled";
  return inferAppointmentStatusFromText(fallbackText);
}

function sanitizeAppointmentTime(value: unknown): string | null {
  const raw = asString(value);
  if (!raw) return null;
  const match = raw.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
  if (!match) return null;
  return `${match[1].padStart(2, "0")}:${match[2]}`;
}

function extractAppointmentTimeFromText(text: string): string | null {
  return sanitizeAppointmentTime(text);
}

function sanitizeExtractedEntity(value: string | null): string | null {
  const raw = asString(value);
  if (!raw) return null;
  const trimmed = raw
    .replace(/\s+(?:en|a\s+las|con|para)\b.*$/i, "")
    .replace(/\s+(?:programad[oa]|confirmad[oa]|agendad[oa]|recordad[oa]|cancelad[oa])\b.*$/i, "")
    .replace(/^[\s:·,-]+|[\s:·,-]+$/g, "")
    .trim();
  return trimmed || null;
}

function extractProfessionalNameFromText(text: string): string | null {
  const match = text.match(/(?:dr\.?|dra\.?|doctor|doctora)\s+([A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚÑ' -]+(?:\s+[A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚÑ' -]+){0,3})/i);
  return sanitizeExtractedEntity(asString(match?.[1]) || null);
}

function extractClinicNameFromText(text: string, sourceSender = ""): string | null {
  const centerMatch = text.match(/centro\/profesional:\s*([^.,]+(?:\s*·\s*[^.,]+)?)/i);
  if (centerMatch?.[1]) {
    const parts = centerMatch[1]
      .split("·")
      .map((part) => sanitizeExtractedEntity(asString(part)))
      .filter(Boolean) as string[];
    if (parts.length > 1) return parts[1];
    if (parts.length === 1) return parts[0];
  }
  const clinicMatch = text.match(
    /\b(?:clinica|clínica|centro|hospital|sucursal)\s+([A-ZÁÉÍÓÚÑ][^.,]+?)(?=\s+a\s+las|\s+con\b|\s+para\b|\.|,|$)/i
  );
  if (clinicMatch?.[1]) return sanitizeExtractedEntity(asString(clinicMatch[1]) || null);
  const senderDomain = extractSenderDomain(sourceSender);
  if (senderDomain?.includes("panda")) return "PANDA CLINICA VETERINARIA";
  return null;
}

function hasClinicSignalInText(text: string, sourceSender = ""): boolean {
  const haystack = normalizeClinicalToken([text, sourceSender].filter(Boolean).join(" "));
  return /\b(clinica|clinica veterinaria|centro|hospital|sucursal|panda|veterinaria|pet shop)\b/.test(haystack);
}

function extractAppointmentSpecialtyFromText(text: string): string | null {
  const match = text.match(
    /\b(?:consulta|control|turno)\s+([a-záéíóúñ]+(?:\s+[a-záéíóúñ]+){0,3})(?=\s+(?:programad[oa]|confirmad[oa]|agendad[oa]|recordad[oa]|cancelad[oa]|con|en|a\s+las|para)\b|[.,]|$)/i
  );
  return sanitizeExtractedEntity(asString(match?.[1]) || null);
}

function hasMedicationOrTreatmentSignal(text: string): boolean {
  const haystack = normalizeClinicalToken(text);
  if (!haystack) return false;
  return /\b(receta|prescrip|tratamiento|medicaci[oó]n|dosis|cada\s+\d+\s*(?:h|hs|hora|horas)|comprimid|capsul|tableta|jarabe|gotas|pimobendan|ursomax|ursomas|furosemida|omeprazol|predni|amoxic|metronidazol|gabapentin|carprofeno|dieta\s+[a-záéíóúñ]+)\b/i.test(
    haystack
  );
}

function deriveAppointmentLabel(event: ClinicalEventExtraction): string | null {
  const specialty = sanitizeExtractedEntity(event.appointment_specialty || null);
  if (specialty) return specialty;

  const description = cleanSentence(event.description_summary || "");
  const patterns = [
    /\bconsulta\s+([a-záéíóúñ]+(?:\s+[a-záéíóúñ]+){0,3})/i,
    /\bturno\s+([a-záéíóúñ]+(?:\s+[a-záéíóúñ]+){0,3})/i,
    /\bcontrol\s+([a-záéíóúñ]+(?:\s+[a-záéíóúñ]+){0,3})/i,
  ];
  for (const pattern of patterns) {
    const match = description.match(pattern);
    if (match?.[1]) return sanitizeExtractedEntity(match[1]);
  }

  const diagnosis = sanitizeExtractedEntity(event.diagnosis || null);
  if (diagnosis && diagnosis.length <= 80) return diagnosis;
  return null;
}

function inferImagingTypeFromSignals(text: string): string | null {
  const haystack = normalizeClinicalToken(text);
  if (!haystack) return null;
  if (/\b(ecocard[a-z]*|eco cardio|ecocardi[a-z]*|doppler|mitral|ventricul[a-z]*)\b/.test(haystack)) return "ecocardiograma";
  if (/\b(ecg|electrocard[a-z]*|ritmo sinusal|qrs|pr)\b/.test(haystack)) return "electrocardiograma";
  if (/\b(eco|ecograf[a-z]*|ultrason[a-z]*|ultrasound|sonogra[a-z]*)\b/.test(haystack)) return "ecografía";
  if (/\b(rx|radiograf[a-z]*|radiolog[a-z]*|placa[s]?|proyeccion[a-z]*|ll|vd|dv|torax dv|torax ld|d v|l l)\b/.test(haystack)) {
    return "radiografía";
  }
  return null;
}

function inferStudySubtypeFromSignals(args: {
  rawStudySubtype?: unknown;
  imagingType?: unknown;
  labResults: ClinicalLabResult[];
  descriptionSummary: string;
  diagnosis: string | null;
}): StudySubtype {
  const raw = asString(args.rawStudySubtype).toLowerCase();
  const haystack = normalizeClinicalToken(
    [
      asString(args.imagingType),
      args.descriptionSummary,
      args.diagnosis,
      ...args.labResults.flatMap((row) => [row.test_name, row.result, row.reference_range || ""]),
    ]
      .filter(Boolean)
      .join(" ")
  );
  const hasImagingSignal = /\b(rx|radiograf[a-z]*|radiolog[a-z]*|ecograf[a-z]*|ultrason[a-z]*|ultrasound|eco|ecocard[a-z]*|ecg|electrocard[a-z]*|imagen(?:es)?|placa[s]?|proyeccion[a-z]*)\b/.test(
    haystack
  );
  const hasLabSignal = /\b(laboratorio|hemograma|bioquim|analisis|an[aá]lisis|glucosa|creatinina|urea|alt|ast)\b/.test(
    haystack
  );
  if (hasImagingSignal) {
    return "imaging";
  }
  if (hasLabSignal) {
    return "lab";
  }
  if (raw === "imaging" || raw === "lab") return raw;
  if (args.labResults.length > 0) return "lab";
  return null;
}

function inferImagingDocumentType(event: ClinicalEventExtraction):
  "lab_test" | "xray" | "echocardiogram" | "electrocardiogram" {
  const haystack = normalizeClinicalToken(
    [event.imaging_type, event.description_summary, event.diagnosis].filter(Boolean).join(" ")
  );
  if (/\b(ecocard[a-z]*|eco cardi|doppler)\b/.test(haystack)) return "echocardiogram";
  if (/\b(ecg|electrocard[a-z]*)\b/.test(haystack)) return "electrocardiogram";
  if (/\b(rx|radiograf[a-z]*|radiolog[a-z]*|placa[s]?|ecograf[a-z]*|ultrason[a-z]*|ultrasound|proyeccion[a-z]*)\b/.test(haystack)) {
    return "xray";
  }
  return "lab_test";
}

function normalizeExtractedEventType(rawType: string, row: Record<string, unknown>): EventType | null {
  const normalized = normalizeClinicalToken(rawType);
  const hintText = normalizeClinicalToken(
    [
      asString(row.description_summary),
      asString(row.diagnosis),
      asString(row.appointment_status),
      asString(row.study_subtype),
      asString(row.imaging_type),
    ].join(" ")
  );

  if (
    normalized === "appointment_confirmation" ||
    normalized === "appointment_reminder" ||
    normalized === "appointment_cancellation" ||
    normalized === "clinical_report" ||
    normalized === "study_report" ||
    normalized === "prescription_record" ||
    normalized === "vaccination_record"
  ) {
    return normalized as EventType;
  }

  if (normalized === "visit") {
    const status = inferAppointmentStatusFromText(hintText);
    if (status === "cancelled") return "appointment_cancellation";
    if (status === "reminder") return "appointment_reminder";
    return "appointment_confirmation";
  }
  if (normalized === "treatment") return "prescription_record";
  if (normalized === "vaccination") return "vaccination_record";
  if (normalized === "diagnostic" || normalized === "imaging") return "study_report";
  if (normalized === "episode") return "clinical_report";
  return null;
}

function buildCanonicalEventTitle(event: ClinicalEventExtraction): string {
  if (event.event_type === "appointment_confirmation") {
    const label = deriveAppointmentLabel(event);
    return label ? `Turno · ${label}` : "Turno confirmado";
  }
  if (event.event_type === "appointment_reminder") {
    const label = deriveAppointmentLabel(event);
    return label ? `Recordatorio · ${label}` : "Recordatorio de turno";
  }
  if (event.event_type === "appointment_cancellation") {
    const label = deriveAppointmentLabel(event);
    return label ? `Cancelación · ${label}` : "Turno cancelado";
  }
  if (event.event_type === "vaccination_record") return "Registro de vacunación";
  if (event.event_type === "prescription_record") {
    const firstMedication = asString(event.medications[0]?.name);
    return firstMedication ? `Receta médica · ${firstMedication}` : "Receta médica";
  }
  if (event.event_type === "study_report") {
    if (event.study_subtype === "imaging") {
      if (event.imaging_type && /ecocard|doppler/i.test(event.imaging_type)) return "Ecocardiograma";
      if (event.imaging_type && /electrocard|ecg/i.test(event.imaging_type)) return "Electrocardiograma";
      if (event.imaging_type && /radiograf|rx|placa/i.test(event.imaging_type)) return "Radiografía";
      if (event.diagnosis) return cleanSentence(event.diagnosis).slice(0, 120) || "Informe por imágenes";
      return "Informe por imágenes";
    }
    return "Resultado de laboratorio";
  }
  if (event.event_type === "clinical_report" && event.diagnosis) return event.diagnosis.slice(0, 120);
  return "Informe clínico";
}

function confidenceBucketToScore(value: unknown, fallback = 70): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return clamp(Math.round(value), 0, 100);
  }
  const normalized = normalizeClinicalToken(asString(value));
  if (normalized === "high") return 90;
  if (normalized === "medium") return 75;
  if (normalized === "low") return 55;
  if (normalized === "not detected" || normalized === "not_detected") return 0;
  return clamp(fallback, 0, 100);
}

function toStoredClinicalMedications(value: unknown): ClinicalMedication[] {
  const rows = Array.isArray(value) ? value : [];
  return rows
    .map((row) => {
      const data = asRecord(row);
      const name = asString(data.name);
      if (!name) return null;
      return {
        name,
        dose: asString(data.dosage) || asString(data.dose) || null,
        frequency: asString(data.frequency) || null,
        duration_days: null,
        is_active: true,
      } as ClinicalMedication;
    })
    .filter((row): row is ClinicalMedication => Boolean(row));
}

function toStoredClinicalLabResults(value: unknown): ClinicalLabResult[] {
  const rows = Array.isArray(value) ? value : [];
  return rows
    .map((row) => {
      const data = asRecord(row);
      const testName = asString(data.name);
      const result = asString(data.value);
      if (!testName || !result) return null;
      return {
        test_name: testName,
        result,
        unit: asString(data.unit) || null,
        reference_range: asString(data.referenceRange) || null,
      } as ClinicalLabResult;
    })
    .filter((row): row is ClinicalLabResult => Boolean(row));
}

function inferStoredEventTypeFromRecord(args: {
  row: Record<string, unknown>;
  extractedData: Record<string, unknown>;
  sourceText: string;
  medications: ClinicalMedication[];
  labResults: ClinicalLabResult[];
}): EventType | null {
  const normalizedExistingType = normalizeExtractedEventType(
    asString(args.extractedData.taxonomyEventType),
    args.extractedData
  );
  if (normalizedExistingType) return normalizedExistingType;

  const documentType = asString(args.extractedData.documentType);
  const normalizedSourceText = normalizeClinicalToken(args.sourceText);
  const appointmentStructured =
    Boolean(asString(args.extractedData.appointmentTime)) ||
    Boolean(asString(args.extractedData.provider)) ||
    Boolean(asString(args.extractedData.clinic)) ||
    (Array.isArray(args.extractedData.detectedAppointments) ? args.extractedData.detectedAppointments.length : 0) > 0;
  const studySignal = /\b(laboratorio|hemograma|bioquim|radiograf|ecograf|electrocard|resultado|informe|microscop|koh|citolog|rx|placa)\b/.test(
    normalizedSourceText
  );
  const medicationSignal = args.medications.length > 0 || hasMedicationOrTreatmentSignal(args.sourceText);
  if (documentType === "appointment") {
    if (!appointmentStructured && studySignal) return "study_report";
    if (!appointmentStructured && medicationSignal) return "prescription_record";
    const status = normalizeAppointmentStatusValue(args.extractedData.appointmentStatus, args.sourceText);
    if (status === "cancelled") return "appointment_cancellation";
    if (status === "reminder") return "appointment_reminder";
    return "appointment_confirmation";
  }
  if (documentType === "medication" && args.medications.length > 0) return "prescription_record";
  if (documentType === "vaccine") return "vaccination_record";
  if (
    documentType === "lab_test" ||
    documentType === "xray" ||
    documentType === "echocardiogram" ||
    documentType === "electrocardiogram"
  ) {
    return "study_report";
  }
  if (documentType === "checkup") return "clinical_report";

  if (args.medications.length > 0) return "prescription_record";
  if (args.labResults.length > 0) return "study_report";

  const normalized = normalizedSourceText;
  if (!normalized) return null;
  if (/\b(vacuna|vacunacion|revacuna)\b/.test(normalized)) return "vaccination_record";
  if (/\b(turno|consulta|recordatorio|confirmacion|confirmación|cancelacion|cancelación|reprogramaci)\b/.test(normalized)) {
    const status = inferAppointmentStatusFromText(normalized);
    if (status === "cancelled") return "appointment_cancellation";
    if (status === "reminder") return "appointment_reminder";
    return "appointment_confirmation";
  }
  if (/\b(laboratorio|hemograma|bioquim|radiograf|ecograf|ecocard|electrocard|resultado|informe)\b/.test(normalized)) {
    return "study_report";
  }
  return "clinical_report";
}

function reconstructStoredEventForTaxonomy(row: Record<string, unknown>): ClinicalEventExtraction | null {
  const extractedData = asRecord(row.extractedData);
  const sourceText = [
    asString(extractedData.aiGeneratedSummary),
    asString(extractedData.suggestedTitle),
    asString(extractedData.diagnosis),
    asString(extractedData.sourceSubject),
    asString(extractedData.sourceSender),
    asString(row.title),
  ]
    .filter(Boolean)
    .join(" · ");

  const medications = toStoredClinicalMedications(extractedData.medications);
  const labResults = toStoredClinicalLabResults(extractedData.measurements);
  const eventType = inferStoredEventTypeFromRecord({
    row,
    extractedData,
    sourceText,
    medications,
    labResults,
  });
  if (!eventType) return null;

  const detectedAppointment = asRecord(Array.isArray(extractedData.detectedAppointments) ? extractedData.detectedAppointments[0] : null);
  const diagnosis = asString(extractedData.diagnosis) || null;
  const imagingType =
    asString(extractedData.imagingType) ||
    inferImagingTypeFromSignals(sourceText) ||
    (asString(extractedData.documentType) === "xray"
      ? "radiografía"
      : asString(extractedData.documentType) === "echocardiogram"
        ? "ecocardiograma"
        : asString(extractedData.documentType) === "electrocardiogram"
          ? "electrocardiograma"
          : null);
  const appointmentTime =
    asString(extractedData.appointmentTime) ||
    asString(detectedAppointment.time) ||
    extractAppointmentTimeFromText(sourceText) ||
    null;
  const parsedAppointmentSpecialty = extractAppointmentSpecialtyFromText(sourceText);
  const parsedProfessionalName = extractProfessionalNameFromText(sourceText);
  const parsedClinicName = extractClinicNameFromText(sourceText, asString(extractedData.sourceSender));
  const appointmentSpecialty =
    parsedAppointmentSpecialty ||
    asString(detectedAppointment.specialty) ||
    null;
  const professionalName =
    parsedProfessionalName ||
    asString(extractedData.provider) ||
    asString(detectedAppointment.provider) ||
    null;
  const clinicName =
    parsedClinicName ||
    (hasClinicSignalInText(sourceText, asString(extractedData.sourceSender))
      ? asString(extractedData.clinic) || asString(detectedAppointment.clinic) || null
      : null);

  let appointmentStatus: AppointmentEventStatus = null;
  if (isAppointmentEventType(eventType)) {
    appointmentStatus = normalizeAppointmentStatusValue(
      asString(extractedData.appointmentStatus) || asString(detectedAppointment.status),
      sourceText
    );
    if (!appointmentStatus) {
      if (eventType === "appointment_cancellation") appointmentStatus = "cancelled";
      if (eventType === "appointment_reminder") appointmentStatus = "reminder";
      if (eventType === "appointment_confirmation") appointmentStatus = "confirmed";
    }
  }

  const studySubtype = isStudyEventType(eventType)
    ? inferStudySubtypeFromSignals({
        rawStudySubtype: extractedData.studySubtype,
        imagingType,
        labResults,
        descriptionSummary: sourceText,
        diagnosis,
      })
    : null;

  const eventDate =
    asString(extractedData.eventDate) ||
    asString(row.eventDate) ||
    toIsoDateOnly(new Date(asString(extractedData.sourceReceivedAt) || asString(row.createdAt) || getNowIso()));

  return {
    event_type: eventType,
    event_date: eventDate,
    date_confidence: confidenceBucketToScore(extractedData.eventDateConfidence, 70),
    description_summary: asString(extractedData.aiGeneratedSummary) || asString(row.title) || sourceText.slice(0, 240),
    diagnosis,
    medications,
    lab_results: labResults,
    imaging_type: imagingType,
    study_subtype: studySubtype,
    appointment_time: isAppointmentEventType(eventType) ? appointmentTime : null,
    appointment_specialty: isAppointmentEventType(eventType) ? appointmentSpecialty : null,
    professional_name: professionalName,
    clinic_name: clinicName,
    appointment_status: appointmentStatus,
    severity: null,
    confidence_score: clamp(asNonNegativeNumber(row.overallConfidence, 72), 0, 100),
  };
}

function extractOperationalAppointmentCandidate(args: {
  eventDate: string | null;
  sourceText: string;
  sourceSender?: string | null;
  existingStatus?: unknown;
  existingTime?: unknown;
  existingSpecialty?: unknown;
  professionalName?: string | null;
  clinicName?: string | null;
  diagnosis?: string | null;
  confidenceScore?: number;
}): ClinicalEventExtraction | null {
  const eventDate = asString(args.eventDate) || null;
  const parsedEventDate = parseDateOnly(eventDate || "");
  if (!parsedEventDate) return null;

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  if (parsedEventDate.getTime() < startOfToday.getTime()) return null;

  const sourceText = cleanSentence(args.sourceText);
  const normalized = normalizeClinicalToken(sourceText);
  if (!normalized) return null;

  const hasAppointmentLanguage = /\b(turno|consulta|control|recordatorio|confirmacion|confirmado|agendad|programad|reprogramad|cancelad|cita)\b/.test(
    normalized
  );
  if (!hasAppointmentLanguage) return null;

  const appointmentTime = sanitizeAppointmentTime(args.existingTime) || extractAppointmentTimeFromText(sourceText) || null;
  const appointmentSpecialty =
    sanitizeExtractedEntity(asString(args.existingSpecialty) || extractAppointmentSpecialtyFromText(sourceText)) || null;
  const professionalName =
    sanitizeExtractedEntity(args.professionalName || extractProfessionalNameFromText(sourceText)) || null;
  const clinicName =
    sanitizeExtractedEntity(args.clinicName || extractClinicNameFromText(sourceText, asString(args.sourceSender))) || null;
  const appointmentStatus = normalizeAppointmentStatusValue(args.existingStatus, sourceText) || "scheduled";

  const strongStudySignal = /\b(radiograf|ecograf|electrocard|laboratorio|hemograma|microscop|koh|prueba|informe|resultado|prostata|torax|pelvis|proyeccion)\b/.test(
    normalized
  );
  const strongMedicationSignal = hasMedicationOrTreatmentSignal(sourceText);

  if (!appointmentTime && !appointmentSpecialty && !professionalName && !clinicName) return null;
  if (!appointmentTime && !professionalName && !clinicName && (strongStudySignal || strongMedicationSignal)) return null;

  const eventType: EventType =
    appointmentStatus === "cancelled"
      ? "appointment_cancellation"
      : appointmentStatus === "reminder"
        ? "appointment_reminder"
        : "appointment_confirmation";

  return {
    event_type: eventType,
    event_date: eventDate,
    date_confidence: 85,
    description_summary: sourceText.slice(0, 240),
    diagnosis: sanitizeExtractedEntity(args.diagnosis || null),
    medications: [],
    lab_results: [],
    imaging_type: null,
    study_subtype: null,
    appointment_time: appointmentTime,
    appointment_specialty: appointmentSpecialty,
    professional_name: professionalName,
    clinic_name: clinicName,
    appointment_status: appointmentStatus,
    severity: null,
    confidence_score: clamp(asNonNegativeNumber(args.confidenceScore, 82), 0, 100),
  };
}

function shouldReplaceLegacyStoredTitle(currentTitle: string): boolean {
  const normalized = normalizeClinicalToken(currentTitle);
  if (!normalized) return true;
  return [
    "diagnostico detectado por correo",
    "documento",
    "informe clinico",
    "turno programado",
    "resultado de laboratorio",
    "informe de estudio",
  ].includes(normalized);
}

function shouldPreserveExistingObservations(args: {
  row: Record<string, unknown>;
  extractedData: Record<string, unknown>;
}): boolean {
  const existingObservation = asString(args.extractedData.observations);
  if (!existingObservation) return false;
  if (asString(args.row.sourceTruthLevel) === "human_confirmed") return true;
  const narrative = asString(args.extractedData.aiGeneratedSummary);
  return normalizeClinicalToken(existingObservation) !== normalizeClinicalToken(narrative);
}

interface GmailTaxonomyBackfillResult {
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

type LegacyCleanupAction = "delete" | "salvage" | "keep";

interface LegacyCleanupSample {
  docId: string;
  action: LegacyCleanupAction;
  title: string | null;
  sender: string | null;
  provider: string | null;
  documentType: string | null;
  reasons: string[];
}

interface LegacyMailsyncCleanupResult {
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

const LEGACY_GENERIC_TITLES = new Set([
  "diagnostico detectado por correo",
  "estudio detectado por correo",
  "documento",
  "documento detectado por correo",
  "turno programado",
  "resultado de laboratorio",
  "informe de estudio",
  "diagnostico",
]);

const LEGACY_DELETE_DOMAIN_HINTS = [
  "huesped.org",
  "ikeargentina.com",
  "osde",
  "swissmedical",
  "medicus",
  "galeno",
  "omint",
  "afip",
];

const LEGACY_OPERATIONAL_NOISE_REGEX =
  /\b(tipo detectado:\s*cancelacion|tipo detectado:\s*recordatorio_turno|tipo detectado:\s*confirmacion_turno|recordatorio del turno|informacion de turno solicitado|información de turno solicitado|turno confirmado|turno cancelado|reprogramacion|reprogramación|recordatorio de turno|cancelacion de turno|cancelación de turno)\b/i;

const LEGACY_SALVAGE_STUDY_REGEX =
  /\b(radiograf(?:ia|ias)?|rx\b|placa(?:s)?\s+de\s+t[oó]rax|ecograf(?:ia|ias)?|ultrason(?:ido)?|ultrasound|ecg|electrocardiograma|electrocardiograf|informe radiol[oó]gico|bronquitis|cardiomegalia|hepatomegalia|esplenitis|enfermedad discal|koh\b|microscop[ií]a|hemograma|bioqu[ií]mica|laboratorio)\b/i;

function isLegacyMailsyncEvent(docId: string, row: Record<string, unknown>, extractedData: Record<string, unknown>): boolean {
  return (
    docId.startsWith("mailsync_") ||
    asString(extractedData.extractionProtocol) === "legacy_v1" ||
    asString(row.extractionProtocol) === "legacy_v1"
  );
}

function selectLegacySender(row: Record<string, unknown>, extractedData: Record<string, unknown>): string {
  return (
    asString(extractedData.sourceSender) ||
    asString(row.sourceSender) ||
    (asString(extractedData.provider).includes("@") ? asString(extractedData.provider) : "") ||
    (asString(row.provider).includes("@") ? asString(row.provider) : "")
  );
}

function hasLegacyMedicationPayload(extractedData: Record<string, unknown>): boolean {
  const medicationsRaw = Array.isArray(extractedData.medications) ? extractedData.medications : [];
  return medicationsRaw.some((item) => {
    const medication = asRecord(item);
    const name = normalizeClinicalToken(asString(medication.name));
    if (!name || MEDICATION_NAME_BLOCKLIST.has(name)) return false;
    return Boolean(asString(medication.dose) || asString(medication.frequency) || name.length >= 4);
  });
}

function classifyLegacyMailsyncEvent(docId: string, row: Record<string, unknown>): LegacyCleanupSample {
  const extractedData = asRecord(row.extractedData);
  const title = asString(row.title);
  const sender = selectLegacySender(row, extractedData);
  const provider = asString(extractedData.provider) || asString(row.provider) || null;
  const documentType = asString(extractedData.documentType) || asString(row.documentType) || null;
  const diagnosis = asString(extractedData.diagnosis);
  const observations = asString(extractedData.observations);
  const corpus = [
    title,
    asString(extractedData.aiGeneratedSummary),
    observations,
    diagnosis,
    asString(extractedData.sourceSubject),
    sender,
    provider,
    asString(row.findings),
  ].join(" \n ");
  const normalizedTitle = normalizeClinicalToken(title);
  const genericLegacyTitle = LEGACY_GENERIC_TITLES.has(normalizedTitle);
  const humanNoise =
    hasStrongHumanHealthcareSignal(corpus) ||
    LEGACY_DELETE_DOMAIN_HINTS.some((hint) => normalizeTextForMatch(sender).includes(normalizeTextForMatch(hint))) ||
    LEGACY_DELETE_DOMAIN_HINTS.some((hint) => normalizeTextForMatch(corpus).includes(normalizeTextForMatch(hint)));
  const operationalNoise = LEGACY_OPERATIONAL_NOISE_REGEX.test(corpus);
  const documentImpliesStudy = ["xray", "lab_test", "laboratory_result", "clinical_report", "electrocardiogram", "ultrasound"].includes(
    documentType || ""
  );
  const structuredClinicalFinding =
    STRUCTURED_DIAGNOSIS_HINT_REGEX.test(normalizeClinicalToken(diagnosis)) ||
    STRUCTURED_DIAGNOSIS_HINT_REGEX.test(normalizeClinicalToken(observations)) ||
    Boolean(asString(row.findings));
  const medicationPayload = hasLegacyMedicationPayload(extractedData);
  const veterinaryStudyEvidence =
    LEGACY_SALVAGE_STUDY_REGEX.test(corpus) ||
    structuredClinicalFinding ||
    medicationPayload ||
    (documentImpliesStudy && !operationalNoise);
  const reasons: string[] = [];

  if (humanNoise) reasons.push("human_noise");
  if (operationalNoise) reasons.push("operational_noise");
  if (genericLegacyTitle) reasons.push("generic_legacy_title");
  if (veterinaryStudyEvidence) reasons.push("veterinary_study_evidence");
  if (structuredClinicalFinding) reasons.push("structured_clinical_finding");
  if (medicationPayload) reasons.push("medication_payload");

  let action: LegacyCleanupAction = "keep";
  if (humanNoise) {
    action = "delete";
  } else if (operationalNoise && ["checkup", "appointment"].includes(documentType || "") && !structuredClinicalFinding && !medicationPayload) {
    action = "delete";
  } else if (veterinaryStudyEvidence) {
    action = "salvage";
  } else if (operationalNoise && (genericLegacyTitle || !veterinaryStudyEvidence)) {
    action = "delete";
  } else if (genericLegacyTitle && !veterinaryStudyEvidence) {
    action = "delete";
  }

  return {
    docId,
    action,
    title: title || null,
    sender: sender || null,
    provider,
    documentType,
    reasons,
  };
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

function sanitizeNarrativeLabel(value: string, fallback: string): string {
  const cleaned = asString(value)
    .replace(/\s+/g, " ")
    .replace(/[·|]+/g, " · ")
    .trim();
  return cleaned.slice(0, 120) || fallback;
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

function monthsBetween(nowTimestamp: number, targetTimestamp: number): number {
  const current = new Date(nowTimestamp);
  const target = new Date(targetTimestamp);
  return Math.max(
    0,
    (current.getFullYear() - target.getFullYear()) * 12 + (current.getMonth() - target.getMonth())
  );
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
    diagnositcos_clave: diagnoses,
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

function medicationNameHasExplicitDrugSignal(name: string): boolean {
  const normalized = normalizeClinicalToken(name);
  if (!normalized || MEDICATION_UNIT_ONLY_REGEX.test(normalized)) return false;
  const tokens = normalized.split(/\s+/).filter(Boolean);
  const candidateTokens = tokens.filter((token) => {
    if (token.length < 3) return false;
    if (MEDICATION_NAME_BLOCKLIST.has(token)) return false;
    if (/^\d/.test(token)) return false;
    if (MEDICATION_UNIT_ONLY_REGEX.test(token)) return false;
    return /[a-z]/.test(token);
  });
  return candidateTokens.length > 0;
}

function isMedicationMeasurementFalsePositive(medication: ClinicalMedication): boolean {
  if (!medicationNameHasExplicitDrugSignal(medication.name)) return true;
  const combined = normalizeClinicalToken(
    [medication.name, medication.dose, medication.frequency].filter(Boolean).join(" ")
  );
  if (ANATOMICAL_MEASUREMENT_HINT_REGEX.test(combined) && !MEDICATION_DOSING_HINT_REGEX.test(combined)) {
    return true;
  }
  return false;
}

function looksHistoricalOnlyTreatmentEvent(event: ClinicalEventExtraction): boolean {
  if (!isPrescriptionEventType(event.event_type)) return false;
  const normalized = normalizeClinicalToken(
    [
      event.description_summary,
      event.diagnosis,
      ...event.medications.map((medication) => medication.name),
    ]
      .filter(Boolean)
      .join(" ")
  );
  if (!HISTORICAL_ONLY_SIGNAL_REGEX.test(normalized)) return false;
  return !/\b(cada|administrar|dar|tomar|iniciar|continuar|indicado|receta|prescrip)\b/.test(normalized);
}

function hasUnstructuredClinicalFinding(event: ClinicalEventExtraction): boolean {
  if (event.diagnosis) return false;
  if (!(event.event_type === "clinical_report" || isStudyEventType(event.event_type))) return false;
  return STRUCTURED_DIAGNOSIS_HINT_REGEX.test(normalizeClinicalToken(event.description_summary));
}

function hasIncompleteAppointmentMetadata(event: ClinicalEventExtraction): boolean {
  if (!isAppointmentEventType(event.event_type)) return false;
  return !event.appointment_status || !event.appointment_time || !event.professional_name || !event.clinic_name;
}

function hasIncompletePrescriptionMetadata(event: ClinicalEventExtraction): boolean {
  if (!isPrescriptionEventType(event.event_type)) return false;
  if (event.medications.length === 0) return true;
  return event.medications.some((medication) => !medicationHasDoseAndFrequency(medication));
}

function hasUndifferentiatedStudySubtype(event: ClinicalEventExtraction): boolean {
  return isStudyEventType(event.event_type) && !event.study_subtype;
}

function applyConstitutionalGuardrails(event: ClinicalEventExtraction): {
  event: ClinicalEventExtraction;
  reviewReasons: string[];
} {
  const reviewReasons = new Set<string>();
  const medications = event.medications.filter((medication) => {
    const blocked = isMedicationMeasurementFalsePositive(medication);
    if (blocked) reviewReasons.add("medication_without_explicit_drug_name");
    return !blocked;
  });

  const sanitizedEvent: ClinicalEventExtraction = {
    ...event,
    medications,
  };

  if (looksHistoricalOnlyTreatmentEvent(sanitizedEvent)) {
    reviewReasons.add("historical_info_only");
  }
  if (hasUnstructuredClinicalFinding(sanitizedEvent)) {
    reviewReasons.add("unstructured_clinical_finding");
  }
  if (hasIncompleteAppointmentMetadata(sanitizedEvent)) {
    reviewReasons.add("incomplete_appointment_details");
  }
  if (hasIncompletePrescriptionMetadata(sanitizedEvent)) {
    reviewReasons.add("missing_treatment_dose_or_frequency");
  }
  if (hasUndifferentiatedStudySubtype(sanitizedEvent)) {
    reviewReasons.add("study_subtype_undetermined");
  }

  return {
    event: sanitizedEvent,
    reviewReasons: [...reviewReasons],
  };
}

function asNonNegativeNumber(value: unknown, fallback = 0): number {
  if (typeof value !== "number" || Number.isNaN(value) || value < 0) return fallback;
  return value;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function getBoundedIntFromEnv(name: string, fallback: number, min: number, max: number): number {
  const raw = Number(process.env[name] || fallback);
  if (!Number.isFinite(raw)) return fallback;
  return clamp(Math.round(raw), min, max);
}

function getPremiumPlanMaxEmailsPerSync(): number {
  return getBoundedIntFromEnv("GMAIL_PREMIUM_MAX_EMAILS_PER_SYNC", MAX_EMAILS_PER_USER_PER_DAY, 25, 5000);
}

function getFreePlanMaxEmailsPerSync(): number {
  return getBoundedIntFromEnv("GMAIL_FREE_MAX_EMAILS_PER_SYNC", FREE_PLAN_MAX_EMAILS_PER_SYNC, 25, 1000);
}

function getScanBatchSize(): number {
  return getBoundedIntFromEnv("GMAIL_SCAN_BATCH_SIZE", DEFAULT_BATCH_SIZE, 5, 100);
}

function getMaxConcurrentExtractionJobs(): number {
  return getBoundedIntFromEnv("GMAIL_MAX_CONCURRENT_EXTRACTION_JOBS", MAX_CONCURRENT_EXTRACTION_JOBS, 1, 200);
}

function getScanWorkersPerTick(): number {
  return getBoundedIntFromEnv("GMAIL_SCAN_WORKERS_PER_TICK", MAX_SCAN_WORKERS_PER_TICK, 1, 10);
}

function getAttachmentWorkersPerTick(): number {
  return getBoundedIntFromEnv("GMAIL_ATTACHMENT_WORKERS_PER_TICK", MAX_ATTACHMENT_WORKERS_PER_TICK, 1, 12);
}

function getAiWorkersPerTick(): number {
  return getBoundedIntFromEnv("GMAIL_AI_WORKERS_PER_TICK", MAX_AI_WORKERS_PER_TICK, 1, 12);
}

function getMaxExternalLinksPerEmail(): number {
  return getBoundedIntFromEnv(
    "GMAIL_MAX_EXTERNAL_LINKS_PER_EMAIL",
    DEFAULT_MAX_EXTERNAL_LINKS_PER_EMAIL,
    0,
    MAX_EXTERNAL_LINKS_PER_EMAIL_HARD_CAP
  );
}

function getExternalLinkFetchTimeoutMs(): number {
  return getBoundedIntFromEnv("GMAIL_EXTERNAL_LINK_FETCH_TIMEOUT_MS", DEFAULT_EXTERNAL_LINK_FETCH_TIMEOUT_MS, 2000, 20_000);
}

function getExternalLinkMaxBytes(): number {
  return getBoundedIntFromEnv("GMAIL_EXTERNAL_LINK_MAX_BYTES", DEFAULT_EXTERNAL_LINK_MAX_BYTES, 100_000, 20 * 1024 * 1024);
}

function getExternalLinkMaxRedirects(): number {
  return getBoundedIntFromEnv(
    "GMAIL_EXTERNAL_LINK_MAX_REDIRECTS",
    DEFAULT_EXTERNAL_LINK_MAX_REDIRECTS,
    0,
    MAX_EXTERNAL_LINK_REDIRECTS_HARD_CAP
  );
}

function isExternalLinkFetchEnabled(): boolean {
  const raw = asString(process.env.GMAIL_EXTERNAL_LINK_FETCH_ENABLED).toLowerCase();
  if (!raw) return true;
  return raw !== "false" && raw !== "0" && raw !== "no";
}

function getAutoIngestConfidenceThreshold(): number {
  const raw = Number(process.env.CLINICAL_AUTO_INGEST_MIN_CONFIDENCE || 85);
  if (!Number.isFinite(raw)) return 85;
  return clamp(raw, 70, 95);
}

function getSilentApprovalWindowHours(): number {
  const raw = Number(process.env.CLINICAL_SILENT_APPROVAL_WINDOW_HOURS || 24);
  if (!Number.isFinite(raw)) return 24;
  return clamp(raw, 1, 168);
}

function parseDomainListEnv(name: string): string[] {
  return asString(process.env[name])
    .toLowerCase()
    .split(/[,\n;]+/g)
    .map((item) => item.trim())
    .filter((item) => Boolean(item) && /[a-z0-9-]+\.[a-z]{2,}/i.test(item))
    .map((item) => item.replace(/^\.+/, "").replace(/\.+$/, ""));
}

function parseEmailListEnv(name: string): string[] {
  return asString(process.env[name])
    .toLowerCase()
    .split(/[,\n;]+/g)
    .map((item) => item.trim())
    .filter((item) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(item));
}

function getQaAllowedUserEmails(): string[] {
  return parseEmailListEnv("GMAIL_QA_ALLOWED_USER_EMAILS");
}

function isEmailAllowedForQa(email: string): boolean {
  const allowlist = getQaAllowedUserEmails();
  if (allowlist.length === 0) return true;
  return allowlist.includes(asString(email).toLowerCase());
}

function isSmartPetMatchingEnabled(): boolean {
  const raw = asString(process.env.GMAIL_SMART_PET_MATCH_ENABLED).toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

function domainMatches(domain: string, candidate: string): boolean {
  return domain === candidate || domain.endsWith(`.${candidate}`);
}

function toIsoDateOnly(date: Date): string {
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function toGmailDate(date: Date): string {
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  return `${yyyy}/${mm}/${dd}`;
}

function parseIsoDate(value: unknown): Date | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function parseDateOnly(value: unknown): Date | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;
  const parsed = new Date(`${trimmed}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseBirthDateFromPet(petData: Record<string, unknown>): Date | null {
  const raw = asString(petData.birthDate);
  if (!raw) return null;
  if (/^\d{4}$/.test(raw)) {
    return new Date(`${raw}-01-01T00:00:00.000Z`);
  }
  if (/^\d{4}-\d{2}$/.test(raw)) {
    return new Date(`${raw}-01T00:00:00.000Z`);
  }
  return parseIsoDate(raw);
}

function calculateAgeYears(birthDate: Date | null): number {
  if (!birthDate) return 0;
  const now = new Date();
  const diffMs = now.getTime() - birthDate.getTime();
  if (diffMs <= 0) return 0;
  return Math.max(0, Math.floor(diffMs / (365.25 * 24 * 60 * 60 * 1000)));
}

function calculateMaxLookbackMonths(args: {
  planType: UserPlanType;
  birthDate: Date | null;
  petAgeYears: number;
}): number {
  if (args.planType === "free") return 12;

  const now = new Date();
  if (args.petAgeYears <= 2 && args.birthDate) {
    const months =
      (now.getUTCFullYear() - args.birthDate.getUTCFullYear()) * 12 +
      (now.getUTCMonth() - args.birthDate.getUTCMonth());
    return clamp(Math.max(months, 36), 36, 180);
  }

  const computed = args.petAgeYears > 0 ? args.petAgeYears * 12 + 6 : 12;
  return clamp(Math.max(computed, 36), 36, 180);
}

function getMaxMailsPerSync(planType: UserPlanType): number {
  return planType === "premium" ? getPremiumPlanMaxEmailsPerSync() : getFreePlanMaxEmailsPerSync();
}

function normalizeForHash(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function base64UrlToBase64(value: string): string {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  return padded;
}

function decodeBase64UrlToBuffer(value: string): Buffer {
  return Buffer.from(base64UrlToBase64(value), "base64");
}

function decodeBase64UrlToText(value: string): string {
  try {
    return decodeBase64UrlToBuffer(value).toString("utf8");
  } catch {
    return "";
  }
}

function isAttachmentStorageEnabled(): boolean {
  const raw = asString(process.env.GMAIL_ATTACHMENT_GCS_ENABLED).toLowerCase();
  if (!raw) return true;
  return raw !== "false" && raw !== "0" && raw !== "no";
}

function sanitizePathToken(value: string): string {
  const safe = value.replace(/[^a-z0-9._-]+/gi, "_").replace(/^_+|_+$/g, "");
  if (!safe) return "attachment";
  return safe.slice(0, 120);
}

function buildAttachmentStoragePath(args: {
  uid: string;
  sessionId: string;
  messageId: string;
  attachmentId: string;
  filename: string;
}): string {
  const safeFile = sanitizePathToken(args.filename);
  const safeAttachmentId = sanitizePathToken(args.attachmentId);
  return [
    "gmail_ingestion",
    sanitizePathToken(args.uid),
    sanitizePathToken(args.sessionId),
    sanitizePathToken(args.messageId),
    `${Date.now()}_${safeAttachmentId}_${safeFile}`,
  ].join("/");
}

function createBase64DecodeTransform(): Transform {
  let carry = "";
  return new Transform({
    transform(chunk, _encoding, callback) {
      try {
        const input = carry + chunk.toString("ascii");
        const usableLength = input.length - (input.length % 4);
        const decodeNow = input.slice(0, usableLength);
        carry = input.slice(usableLength);
        if (decodeNow.length > 0) {
          callback(null, Buffer.from(decodeNow, "base64"));
          return;
        }
        callback();
      } catch (error) {
        callback(error as Error);
      }
    },
    flush(callback) {
      try {
        if (!carry) {
          callback();
          return;
        }
        const padded = carry.padEnd(Math.ceil(carry.length / 4) * 4, "=");
        callback(null, Buffer.from(padded, "base64"));
      } catch (error) {
        callback(error as Error);
      }
    },
  });
}

function decodeHtmlEntitiesBasic(value: string): string {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;/gi, "'")
    .replace(/&nbsp;/gi, " ");
}

function stripHtmlToText(value: string): string {
  const withoutScript = value.replace(/<script[\s\S]*?<\/script>/gi, " ");
  const withoutStyle = withoutScript.replace(/<style[\s\S]*?<\/style>/gi, " ");
  const withoutTags = withoutStyle.replace(/<[^>]+>/g, " ");
  return decodeHtmlEntitiesBasic(withoutTags).replace(/\s+/g, " ").trim();
}

function normalizeExternalLink(raw: string): string {
  const trimmed = decodeHtmlEntitiesBasic(asString(raw))
    .replace(/^<+|>+$/g, "")
    .replace(/[)\],.;]+$/g, "");
  if (!trimmed) return "";
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return "";
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return "";
  }
}

function extractCandidateExternalLinks(bodyText: string): string[] {
  const out = new Set<string>();
  const hrefRegex = /href\s*=\s*["']([^"'#]+)["']/gi;
  const plainRegex = /\bhttps?:\/\/[^\s<>"'`]+/gi;
  let match: RegExpExecArray | null;

  while ((match = hrefRegex.exec(bodyText)) !== null) {
    const normalized = normalizeExternalLink(match[1] || "");
    if (normalized) out.add(normalized);
  }

  while ((match = plainRegex.exec(bodyText)) !== null) {
    const normalized = normalizeExternalLink(match[0] || "");
    if (normalized) out.add(normalized);
  }

  return Array.from(out);
}

function isPrivateOrLocalHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (!host) return true;
  if (host === "localhost" || host === "::1") return true;
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) {
    if (/^127\./.test(host)) return true;
    if (/^10\./.test(host)) return true;
    if (/^192\.168\./.test(host)) return true;
    if (/^169\.254\./.test(host)) return true;
    const m172 = host.match(/^172\.(\d+)\./);
    if (m172) {
      const second = Number(m172[1]);
      if (second >= 16 && second <= 31) return true;
    }
  }
  if (host.startsWith("fc") || host.startsWith("fd") || host.startsWith("fe80:")) return true;
  return false;
}

function shouldFetchExternalLink(urlValue: string, sourceSender: string): { ok: boolean; reason: string } {
  let parsed: URL;
  try {
    parsed = new URL(urlValue);
  } catch {
    return { ok: false, reason: "invalid_url" };
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { ok: false, reason: "unsupported_protocol" };
  }
  if (isPrivateOrLocalHost(parsed.hostname)) {
    return { ok: false, reason: "private_or_local_host" };
  }

  const blockedDomains = parseDomainListEnv("GMAIL_LINK_FETCH_BLOCKED_DOMAINS");
  if (blockedDomains.some((item) => domainMatches(parsed.hostname, item))) {
    return { ok: false, reason: "blocked_domain" };
  }

  const explicitAllowlist = parseDomainListEnv("GMAIL_LINK_FETCH_ALLOWED_DOMAINS");
  if (explicitAllowlist.length > 0) {
    const allowed = explicitAllowlist.some((item) => domainMatches(parsed.hostname, item));
    return allowed ? { ok: true, reason: "explicit_allowlist" } : { ok: false, reason: "not_in_explicit_allowlist" };
  }

  const senderDomain = extractSenderDomain(sourceSender);
  if (senderDomain && domainMatches(parsed.hostname, senderDomain)) {
    return { ok: true, reason: "sender_domain_match" };
  }

  const trustedClinicalHosts = [
    "drive.google.com",
    "docs.google.com",
    "storage.googleapis.com",
    "pegasusvet-his.com.ar",
    "dropbox.com",
    "onedrive.live.com",
    "sharepoint.com",
  ];
  if (isTrustedClinicalSender(sourceSender) && trustedClinicalHosts.some((item) => domainMatches(parsed.hostname, item))) {
    return { ok: true, reason: "trusted_sender_known_host" };
  }

  return { ok: false, reason: "domain_not_allowed" };
}

function isRedirectStatus(status: number): boolean {
  return status === 301 || status === 302 || status === 303 || status === 307 || status === 308;
}

function resolveRedirectUrl(locationHeader: string, currentUrl: string): string {
  const normalizedHeader = decodeHtmlEntitiesBasic(asString(locationHeader));
  if (!normalizedHeader) return "";
  try {
    const resolved = new URL(normalizedHeader, currentUrl);
    return normalizeExternalLink(resolved.toString());
  } catch {
    return "";
  }
}

function likelyLoginUrl(urlValue: string): boolean {
  const lower = urlValue.toLowerCase();
  return /(\/login\b|\/signin\b|\/sign-in\b|\/auth\b|\/oauth\b|\/sso\b|iniciar[-_\s]?sesion|iniciar[-_\s]?sesión)/i.test(lower);
}

function detectLoginRequiredHtml(args: {
  html: string;
  url: string;
  status: number;
  contentType: string;
}): boolean {
  if (args.status === 401 || args.status === 403 || args.status === 407) return true;
  const normalizedType = args.contentType.toLowerCase();
  if (!normalizedType.includes("text/html")) return false;
  const snippet = args.html.slice(0, 8000).toLowerCase();
  const hasPasswordField = /type\s*=\s*["']password["']/.test(snippet);
  const hasLoginWords =
    /\b(login|log in|sign in|iniciar sesion|iniciar sesión|acceder|ingresar|usuario|contrasena|contraseña|auth|oauth|sso)\b/.test(
      snippet
    );
  if (hasPasswordField && hasLoginWords) return true;
  if (likelyLoginUrl(args.url) && hasLoginWords) return true;
  return false;
}

async function fetchWithControlledRedirects(args: {
  url: string;
  sourceSender: string;
  timeoutMs: number;
  maxRedirects: number;
}): Promise<
  | {
    ok: true;
    response: Response;
    finalUrl: string;
    redirectCount: number;
  }
  | {
    ok: false;
    reason: string;
    finalUrl: string | null;
    redirectCount: number;
    statusCode: number | null;
  }
> {
  let currentUrl = args.url;
  let redirectCount = 0;

  for (let attempt = 0; attempt <= args.maxRedirects; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), args.timeoutMs);
    try {
      const response = await fetch(currentUrl, {
        method: "GET",
        redirect: "manual",
        headers: {
          "User-Agent": "PessyClinicalIngestionBot/1.0",
          Accept: "text/html,application/pdf,image/*,text/plain;q=0.9,*/*;q=0.5",
        },
        signal: controller.signal,
      });

      if (!isRedirectStatus(response.status)) {
        if (response.status === 401 || response.status === 403 || response.status === 407) {
          return {
            ok: false,
            reason: "login_required",
            finalUrl: currentUrl,
            redirectCount,
            statusCode: response.status,
          };
        }
        return {
          ok: true,
          response,
          finalUrl: currentUrl,
          redirectCount,
        };
      }

      if (redirectCount >= args.maxRedirects) {
        return {
          ok: false,
          reason: "too_many_redirects",
          finalUrl: currentUrl,
          redirectCount,
          statusCode: response.status,
        };
      }

      const locationHeader = asString(response.headers.get("location"));
      const nextUrl = resolveRedirectUrl(locationHeader, currentUrl);
      if (!nextUrl) {
        return {
          ok: false,
          reason: "redirect_missing_location",
          finalUrl: currentUrl,
          redirectCount,
          statusCode: response.status,
        };
      }

      const redirectAllow = shouldFetchExternalLink(nextUrl, args.sourceSender);
      if (!redirectAllow.ok) {
        return {
          ok: false,
          reason: `redirect_${redirectAllow.reason}`,
          finalUrl: nextUrl,
          redirectCount,
          statusCode: response.status,
        };
      }
      if (likelyLoginUrl(nextUrl)) {
        return {
          ok: false,
          reason: "redirect_login_required",
          finalUrl: nextUrl,
          redirectCount,
          statusCode: response.status,
        };
      }

      currentUrl = nextUrl;
      redirectCount += 1;
    } catch (error) {
      const errorName = String((error as Error)?.name || "").toLowerCase();
      if (errorName.includes("abort")) {
        return {
          ok: false,
          reason: "timeout",
          finalUrl: currentUrl,
          redirectCount,
          statusCode: null,
        };
      }
      return {
        ok: false,
        reason: String((error as Error)?.message || "fetch_failed").slice(0, 80),
        finalUrl: currentUrl,
        redirectCount,
        statusCode: null,
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  return {
    ok: false,
    reason: "too_many_redirects",
    finalUrl: currentUrl,
    redirectCount,
    statusCode: null,
  };
}

async function readResponseBodyWithLimit(response: Response, maxBytes: number): Promise<Buffer> {
  const body = response.body;
  if (!body) return Buffer.alloc(0);
  const reader = body.getReader();
  const chunks: Buffer[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > maxBytes) {
      throw new Error("link_payload_too_large");
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks);
}

async function fetchExternalLinkTextChunks(args: {
  bodyText: string;
  sourceSender: string;
}): Promise<{
  detectedCount: number;
  fetchedCount: number;
  extractedChunks: string[];
  metadata: ExternalLinkExtractionMetadata[];
}> {
  if (!isExternalLinkFetchEnabled()) {
    return { detectedCount: 0, fetchedCount: 0, extractedChunks: [], metadata: [] };
  }

  const allUrls = extractCandidateExternalLinks(args.bodyText);
  const urls = allUrls.slice(0, getMaxExternalLinksPerEmail());
  const metadata: ExternalLinkExtractionMetadata[] = [];
  const chunks: string[] = [];
  let fetchedCount = 0;

  for (const url of urls) {
    const parsed = new URL(url);
    const allow = shouldFetchExternalLink(url, args.sourceSender);
    if (!allow.ok) {
      metadata.push({
        url,
        final_url: null,
        host: parsed.hostname,
        content_type: null,
        status: "skipped",
        reason: allow.reason,
        extracted_chars: 0,
        ocr_used: false,
        redirect_count: 0,
        login_required: false,
      });
      continue;
    }

    const timeoutMs = getExternalLinkFetchTimeoutMs();
    const maxRedirects = getExternalLinkMaxRedirects();
    try {
      const fetchResult = await fetchWithControlledRedirects({
        url,
        sourceSender: args.sourceSender,
        timeoutMs,
        maxRedirects,
      });
      if (!fetchResult.ok) {
        const finalUrl = fetchResult.finalUrl || null;
        const finalHost = finalUrl ? new URL(finalUrl).hostname : parsed.hostname;
        const isPolicySkip =
          /domain_not_allowed|blocked_domain|not_in_explicit_allowlist|private_or_local_host/.test(fetchResult.reason);
        metadata.push({
          url,
          final_url: finalUrl,
          host: finalHost,
          content_type: null,
          status: isPolicySkip ? "skipped" : "failed",
          reason: fetchResult.reason,
          extracted_chars: 0,
          ocr_used: false,
          redirect_count: fetchResult.redirectCount,
          login_required: fetchResult.reason.includes("login_required"),
        });
        continue;
      }

      const response = fetchResult.response;
      if (!response.ok) {
        metadata.push({
          url,
          final_url: fetchResult.finalUrl,
          host: new URL(fetchResult.finalUrl).hostname,
          content_type: null,
          status: "failed",
          reason: `http_${response.status}`,
          extracted_chars: 0,
          ocr_used: false,
          redirect_count: fetchResult.redirectCount,
          login_required: response.status === 401 || response.status === 403 || response.status === 407,
        });
        continue;
      }

      const finalUrl = normalizeExternalLink(fetchResult.finalUrl || url) || url;
      const finalParsed = new URL(finalUrl);
      const finalAllow = shouldFetchExternalLink(finalUrl, args.sourceSender);
      if (!finalAllow.ok) {
        metadata.push({
          url,
          final_url: finalUrl,
          host: finalParsed.hostname,
          content_type: null,
          status: "skipped",
          reason: `redirect_${finalAllow.reason}`,
          extracted_chars: 0,
          ocr_used: false,
          redirect_count: fetchResult.redirectCount,
          login_required: false,
        });
        continue;
      }

      const contentType = asString(response.headers.get("content-type")).toLowerCase();
      const contentLength = Number(response.headers.get("content-length"));
      const maxBytes = getExternalLinkMaxBytes();
      if (Number.isFinite(contentLength) && contentLength > maxBytes) {
        metadata.push({
          url,
          final_url: finalUrl,
          host: finalParsed.hostname,
          content_type: contentType || null,
          status: "failed",
          reason: "content_length_exceeds_limit",
          extracted_chars: 0,
          ocr_used: false,
          redirect_count: fetchResult.redirectCount,
          login_required: false,
        });
        continue;
      }

      const bytes = await readResponseBodyWithLimit(response, maxBytes);
      const pathLower = finalParsed.pathname.toLowerCase();
      const inferredMime = normalizeMimeType(contentType.split(";")[0], pathLower);
      let extractedText = "";
      let ocrUsed = false;
      let reason = "no_extractable_text";
      let loginRequired = false;

      if (
        inferredMime === "application/pdf" ||
        isImageMime(inferredMime) ||
        pathLower.endsWith(".pdf") ||
        pathLower.endsWith(".jpg") ||
        pathLower.endsWith(".jpeg") ||
        pathLower.endsWith(".png") ||
        pathLower.endsWith(".webp")
      ) {
        ocrUsed = true;
        extractedText = await ocrAttachmentViaGemini({
          mimeType: inferredMime || "application/pdf",
          base64Data: bytes.toString("base64"),
        });
        reason = extractedText.trim() ? "ocr_ok" : "ocr_empty";
      } else if (inferredMime.startsWith("text/html")) {
        const htmlRaw = bytes.toString("utf8");
        if (detectLoginRequiredHtml({
          html: htmlRaw,
          url: finalUrl,
          status: response.status,
          contentType: inferredMime || contentType,
        })) {
          extractedText = "";
          reason = "login_required";
          loginRequired = true;
        } else {
          extractedText = stripHtmlToText(htmlRaw);
          reason = extractedText.trim() ? "html_text_ok" : "html_text_empty";
        }
      } else if (inferredMime.startsWith("text/") || pathLower.endsWith(".txt") || pathLower.endsWith(".csv")) {
        extractedText = bytes.toString("utf8");
        reason = extractedText.trim() ? "text_ok" : "text_empty";
      }

      const clipped = extractedText.trim().slice(0, MAX_EXTERNAL_LINK_TEXT_CHARS);
      if (clipped) {
        chunks.push(clipped);
        fetchedCount += 1;
      }

      metadata.push({
        url,
        final_url: finalUrl,
        host: finalParsed.hostname,
        content_type: inferredMime || contentType || null,
        status: clipped ? "fetched" : "failed",
        reason,
        extracted_chars: clipped.length,
        ocr_used: ocrUsed,
        redirect_count: fetchResult.redirectCount,
        login_required: loginRequired,
      });
    } catch (error) {
      metadata.push({
        url,
        final_url: null,
        host: parsed.hostname,
        content_type: null,
        status: "failed",
        reason: String((error as Error)?.name || (error as Error)?.message || "fetch_failed").slice(0, 80),
        extracted_chars: 0,
        ocr_used: false,
        redirect_count: 0,
        login_required: false,
      });
    }
  }

  return {
    detectedCount: allUrls.length,
    fetchedCount,
    extractedChunks: chunks,
    metadata,
  };
}

function* iterateBase64Chunks(value: string, chunkSize = 256 * 1024): Generator<string> {
  for (let offset = 0; offset < value.length; offset += chunkSize) {
    yield value.slice(offset, offset + chunkSize);
  }
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

function getEncryptionKey(): Buffer {
  const raw = asString(process.env.MAIL_TOKEN_ENCRYPTION_KEY);
  if (!raw) {
    throw new Error("MAIL_TOKEN_ENCRYPTION_KEY missing");
  }
  const maybeB64 = Buffer.from(raw, "base64");
  if (maybeB64.length === 32) return maybeB64;
  return createHash("sha256").update(raw).digest();
}

function decryptPayload(input: { ciphertext: string; iv: string; tag: string }): Record<string, unknown> {
  const key = getEncryptionKey();
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(input.iv, "base64"));
  decipher.setAuthTag(Buffer.from(input.tag, "base64"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(input.ciphertext, "base64")),
    decipher.final(),
  ]);
  return JSON.parse(decrypted.toString("utf8")) as Record<string, unknown>;
}

function encryptText(value: string): { ciphertext: string; iv: string; tag: string } {
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

function listAllMessageParts(payload: GmailMessagePart | undefined): GmailMessagePart[] {
  if (!payload) return [];
  const stack: GmailMessagePart[] = [payload];
  const output: GmailMessagePart[] = [];
  while (stack.length > 0) {
    const part = stack.pop()!;
    output.push(part);
    if (Array.isArray(part.parts) && part.parts.length > 0) {
      stack.push(...part.parts);
    }
  }
  return output;
}

function extractBodyText(payload: GmailMessagePart | undefined): string {
  if (!payload) return "";
  const parts = listAllMessageParts(payload);
  const chunks: string[] = [];
  for (const part of parts) {
    const mime = asString(part.mimeType).toLowerCase();
    const data = asString(part.body?.data);
    if (!data) continue;
    if (mime === "text/plain" || mime === "text/html" || mime === "application/json") {
      const decoded = decodeBase64UrlToText(data);
      if (decoded.trim()) chunks.push(decoded.trim());
    }
  }
  return chunks.join("\n\n").slice(0, 120_000);
}

function getHeader(payload: GmailMessagePart | undefined, headerName: string): string {
  const wanted = headerName.toLowerCase();
  const headers = payload?.headers || [];
  for (const header of headers) {
    if (asString(header.name).toLowerCase() === wanted) return asString(header.value);
  }
  return "";
}

function isImageMime(mimeType: string): boolean {
  return mimeType.startsWith("image/");
}

function isSupportedAttachmentType(filename: string, mimeType: string): boolean {
  const lowerName = filename.toLowerCase();
  const lowerMime = mimeType.toLowerCase();
  return (
    lowerMime === "application/pdf" ||
    lowerMime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    lowerMime === "application/msword" ||
    lowerMime === "text/plain" ||
    lowerMime === "text/csv" ||
    lowerMime === "application/dicom" ||
    isImageMime(lowerMime) ||
    lowerName.endsWith(".pdf") ||
    lowerName.endsWith(".docx") ||
    lowerName.endsWith(".doc") ||
    lowerName.endsWith(".txt") ||
    lowerName.endsWith(".png") ||
    lowerName.endsWith(".jpg") ||
    lowerName.endsWith(".jpeg") ||
    lowerName.endsWith(".heic") ||
    lowerName.endsWith(".dcm")
  );
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

async function consumeGlobalAiQuota(units = 1): Promise<void> {
  const capRaw = Number(process.env.CLINICAL_AI_MAX_CALLS_PER_MINUTE || 30);
  const perMinuteCap = Number.isFinite(capRaw) ? clamp(Math.round(capRaw), 1, 600) : 30;
  const now = new Date();
  const minuteKey = now.toISOString().slice(0, 16);
  const quotaRef = admin.firestore().collection("gmail_ai_quota").doc(minuteKey);
  let blocked = false;
  await admin.firestore().runTransaction(async (tx) => {
    const snap = await tx.get(quotaRef);
    const data = asRecord(snap.data());
    const used = asNonNegativeNumber(data.used, 0);
    if (used + units > perMinuteCap) {
      blocked = true;
      return;
    }
    tx.set(
      quotaRef,
      {
        minute_key: minuteKey,
        used: used + units,
        cap: perMinuteCap,
        updated_at: getNowIso(),
        expires_at: new Date(Date.now() + 10 * ONE_DAY_MS).toISOString(),
      },
      { merge: true }
    );
  });
  if (blocked) {
    throw new Error("global_ai_rate_limited");
  }
}

async function callGemini(
  payload: Record<string, unknown>,
  timeoutMs: number,
  options?: { softFailUnsupportedMime?: boolean }
): Promise<Record<string, unknown>> {
  const apiKey = asString(process.env.GEMINI_API_KEY);
  if (!apiKey) throw new Error("gemini_api_key_missing");
  await consumeGlobalAiQuota(1);
  const model = asString(process.env.ANALYSIS_MODEL) || "gemini-2.5-flash";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      }
    );

    if (!response.ok) {
      const text = await response.text();
      if (options?.softFailUnsupportedMime && /Unsupported MIME type/i.test(text)) {
        return {};
      }
      throw new Error(`gemini_failed_${response.status}: ${text.slice(0, 800)}`);
    }

    return (await response.json()) as Record<string, unknown>;
  } finally {
    clearTimeout(timeout);
  }
}

function extractGeminiText(data: Record<string, unknown>): string {
  const candidates = data.candidates as Array<Record<string, unknown>> | undefined;
  const first = Array.isArray(candidates) ? candidates[0] : null;
  const content = first ? asRecord(first.content) : {};
  const parts = content.parts as Array<Record<string, unknown>> | undefined;
  const firstPart = Array.isArray(parts) ? parts[0] : null;
  return firstPart ? asString(firstPart.text) : "";
}

async function ocrAttachmentViaGemini(args: {
  mimeType: string;
  base64Data: string;
}): Promise<string> {
  const payload = {
    contents: [
      {
        parts: [
          {
            text:
              "Extraé texto clínico veterinario de este archivo. Devolver texto plano sin markdown. " +
              "Si no hay texto legible, devolver cadena vacía.",
          },
          {
            inline_data: {
              mime_type: args.mimeType,
              data: args.base64Data,
            },
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0,
      topK: 1,
      topP: 1,
      maxOutputTokens: 1600,
    },
  };
  const data = await callGemini(payload, OCR_TIMEOUT_MS, { softFailUnsupportedMime: true });
  return extractGeminiText(data).slice(0, 120_000);
}

function buildClinicalPrompt(args: {
  extractedText: string;
  emailDate: string;
  sourceSubject: string;
  sourceSender: string;
  petContext: Record<string, unknown>;
  attachmentMetadata: AttachmentMetadata[];
  knowledgeContext: string;
}): string {
  const systemPrompt = `
Role: Veterinary Clinical Data Extractor for Pessy.app.
Mission: transform veterinary email content into structured clinical facts, avoiding false positives.

Strict rules:
1) Ignore non-clinical content: promotions, pet food/accessories ads, newsletters, ecommerce, banking, generic admin emails.
2) Process only explicit clinical evidence: diagnosis, lab result, imaging findings, vaccination records, prescriptions, interconsult notes, follow-up indications.
3) Never invent values. If not explicit in text, use null.
4) Keep source-of-truth hierarchy: extracted medical facts > generic narrative.
5) Medication extraction priority: name, concentration (if present), dose, frequency, duration.
6) Date normalization: YYYY-MM-DD when confidence is enough, otherwise null.
7) If clinical signal exists but certainty is low, set requires_human_review=true.
8) Narrative summary must be in Spanish, simple and non-alarming.
9) Nunca interpretes medidas anatómicas, volúmenes u órganos (ej. "vol 14.53 ml") como medicamento o dosis. Si no hay fármaco explícito, medications debe quedar [].
10) Nunca crees tratamiento activo desde texto histórico, calendarios de vacunación o referencias informativas antiguas. En esos casos set requires_human_review=true y reason_if_review_needed="historical_info_only".
11) Nunca entierres un hallazgo clínico en description_summary. Si hay hallazgo explícito, copiarlo en diagnosis o dejar requires_human_review=true con reason_if_review_needed="unstructured_clinical_finding".
12) Si el nuevo contenido contradice known_conditions del contexto, no lo des por confirmado: set requires_human_review=true y reason_if_review_needed="possible_clinical_conflict".
13) Si detectás una posible medicación sin nombre de droga explícito, set requires_human_review=true y reason_if_review_needed="medication_without_explicit_drug_name".
14) No uses description_summary del mail para poblar observations clínicas. Solo resume el hecho detectado; no copies logística como dato clínico.
15) Para appointment_* extrae obligatoriamente appointment_time, professional_name, clinic_name y appointment_status. Si falta alguno, set requires_human_review=true y reason_if_review_needed="incomplete_appointment_details".
16) Para study_report define study_subtype="imaging" o "lab". Si no podés distinguirlo con seguridad, set requires_human_review=true y reason_if_review_needed="study_subtype_undetermined".
17) Para prescription_record solo confirmar si hay droga + dosis + frecuencia. Si falta alguno, set requires_human_review=true y reason_if_review_needed="missing_treatment_dose_or_frequency".
18) appointment_confirmation, appointment_reminder y appointment_cancellation son operativos; no los conviertas en diagnóstico clínico.
19) Si el contexto de identidad de la mascota entra en conflicto con el correo o adjunto (por nombre, especie o raza), set requires_human_review=true y reason_if_review_needed="IDENTITY_CONFLICT".
20) Si el adjunto, OCR o informe menciona radiografía, Rx, ecografía, ultrasound, ECG, electrocardiograma, laboratorio, hemograma o bioquímica, la salida debe ser study_report aunque el cuerpo del mail hable de turno, agenda, recordatorio o confirmación.
21) Si hay conflicto entre el texto logístico del mail y el contenido clínico del adjunto, el adjunto pesa más.
22) Si el correo parece de medicina humana, obra social u ONG de salud y no hay evidencia explícita de veterinaria o mascota, set is_clinical_content=false.

Return valid JSON only with this schema:
{
  "is_clinical_content": boolean,
  "confidence_overall": number,
  "detected_events": [
    {
      "event_type": "appointment_confirmation" | "appointment_reminder" | "appointment_cancellation" | "clinical_report" | "study_report" | "prescription_record" | "vaccination_record",
      "event_date": "YYYY-MM-DD" | null,
      "date_confidence": number,
      "description_summary": string,
      "diagnosis": string | null,
      "appointment_time": "HH:mm" | null,
      "appointment_specialty": string | null,
      "professional_name": string | null,
      "clinic_name": string | null,
      "appointment_status": "confirmed" | "reminder" | "cancelled" | "scheduled" | null,
      "study_subtype": "imaging" | "lab" | null,
      "medications": [
        {
          "name": string,
          "dose": string | null,
          "frequency": string | null,
          "duration_days": number | null,
          "is_active": boolean | null
        }
      ],
      "lab_results": [
        {
          "test_name": string,
          "result": string,
          "unit": string | null,
          "reference_range": string | null
        }
      ],
      "imaging_type": string | null,
      "severity": "mild" | "moderate" | "severe" | null,
      "confidence_score": number
    }
  ],
  "narrative_summary": string,
  "requires_human_review": boolean,
  "reason_if_review_needed": string | null
}`;

  return [
    systemPrompt.trim(),
    "",
    "Clinical context:",
    args.knowledgeContext.slice(0, 7000),
    "",
    "Pet context JSON:",
    JSON.stringify(args.petContext),
    "",
    "Email date:",
    args.emailDate,
    "",
    "Email subject:",
    args.sourceSubject.slice(0, 400),
    "",
    "Email sender:",
    args.sourceSender.slice(0, 320),
    "",
    "Attachment metadata JSON:",
    JSON.stringify(args.attachmentMetadata),
    "",
    "Extracted text:",
    args.extractedText.slice(0, 35_000),
  ].join("\n");
}

function tryParseJson(text: string): Record<string, unknown> | null {
  if (!text.trim()) return null;
  const cleaned = text
    .replace(/^```json/i, "")
    .replace(/^```/i, "")
    .replace(/```$/i, "")
    .trim();
  try {
    return JSON.parse(cleaned) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function splitTextForAi(text: string, maxChars: number, maxChunks: number): string[] {
  const cleaned = text.trim();
  if (!cleaned) return [];
  if (cleaned.length <= maxChars) return [cleaned];

  const chunks: string[] = [];
  let cursor = 0;
  while (cursor < cleaned.length && chunks.length < maxChunks) {
    const remaining = cleaned.length - cursor;
    if (remaining <= maxChars) {
      chunks.push(cleaned.slice(cursor));
      break;
    }
    let end = cursor + maxChars;
    const window = cleaned.slice(cursor, end);
    const breakAt = Math.max(
      window.lastIndexOf("\n\n"),
      window.lastIndexOf(". "),
      window.lastIndexOf("; "),
      window.lastIndexOf(", ")
    );
    if (breakAt > maxChars * 0.45) {
      end = cursor + breakAt + 1;
    }
    chunks.push(cleaned.slice(cursor, end));
    cursor = end;
  }
  return chunks;
}

function deriveVeterinaryEvidenceHints(args: {
  extractedText: string;
  sourceSubject: string;
  sourceSender: string;
  attachmentMetadata: AttachmentMetadata[];
}): {
  preferStudyReport: boolean;
  preferredStudySubtype: StudySubtype;
  inferredImagingType: string | null;
  humanHealthcareNoise: boolean;
} {
  const evidenceText = [
    args.sourceSubject,
    args.sourceSender,
    args.extractedText,
    args.attachmentMetadata.map((row) => row.filename).join(" "),
  ].join(" ");
  const inferredImagingType = inferImagingTypeFromSignals(evidenceText);
  const preferredStudySubtype = inferStudySubtypeFromSignals({
    rawStudySubtype: null,
    imagingType: inferredImagingType,
    labResults: [],
    descriptionSummary: evidenceText,
    diagnosis: null,
  });
  const preferStudyReport =
    preferredStudySubtype !== null ||
    /\b(informe|resultado|estudio|radiograf|ecograf|ultrasound|ecg|electrocard|hemograma|bioquim|laboratorio|koh|citolog|microscop)\b/i.test(
      evidenceText
    ) ||
    attachmentNamesContainClinicalSignal(args.attachmentMetadata);
  return {
    preferStudyReport,
    preferredStudySubtype,
    inferredImagingType,
    humanHealthcareNoise: hasStrongHumanHealthcareSignal(evidenceText),
  };
}

function applyVeterinaryEvidencePriority(args: {
  event: ClinicalEventExtraction;
  hints: ReturnType<typeof deriveVeterinaryEvidenceHints>;
}): ClinicalEventExtraction {
  const { event, hints } = args;
  if (!hints.preferStudyReport) return event;

  if (
    event.event_type === "appointment_confirmation" ||
    event.event_type === "appointment_reminder" ||
    event.event_type === "appointment_cancellation" ||
    event.event_type === "clinical_report"
  ) {
    return {
      ...event,
      event_type: "study_report",
      study_subtype: event.study_subtype || hints.preferredStudySubtype,
      imaging_type: event.imaging_type || hints.inferredImagingType,
      appointment_time: null,
      appointment_specialty: null,
      appointment_status: null,
    };
  }

  if (event.event_type === "study_report") {
    return {
      ...event,
      study_subtype: event.study_subtype || hints.preferredStudySubtype,
      imaging_type: event.imaging_type || hints.inferredImagingType,
    };
  }

  return event;
}

function toClinicalOutput(
  json: Record<string, unknown> | null,
  context?: {
    extractedText: string;
    sourceSubject: string;
    sourceSender: string;
    attachmentMetadata: AttachmentMetadata[];
  }
): ClinicalExtractionOutput {
  if (!json) {
    return {
      is_clinical_content: false,
      confidence_overall: 0,
      detected_events: [],
      narrative_summary: "",
      requires_human_review: true,
      reason_if_review_needed: "invalid_ai_json",
    };
  }

  const eventsRaw = Array.isArray(json.detected_events) ? json.detected_events : [];
  const constitutionalReviewReasons = new Set<string>();
  const evidenceHints = context
    ? deriveVeterinaryEvidenceHints({
        extractedText: context.extractedText,
        sourceSubject: context.sourceSubject,
        sourceSender: context.sourceSender,
        attachmentMetadata: context.attachmentMetadata,
      })
    : {
        preferStudyReport: false,
        preferredStudySubtype: null as StudySubtype,
        inferredImagingType: null,
        humanHealthcareNoise: false,
      };
  const detectedEvents: ClinicalEventExtraction[] = eventsRaw
    .map((item) => {
      const row = asRecord(item);
      const meds = Array.isArray(row.medications) ? row.medications : [];
      const labs = Array.isArray(row.lab_results) ? row.lab_results : [];
      const normalizedMeds = meds
        .map((med) => {
          const m = asRecord(med);
          const name = asString(m.name);
          if (!name) return null;
          return {
            name,
            dose: asString(m.dose) || null,
            frequency: asString(m.frequency) || null,
            duration_days: asNonNegativeNumber(m.duration_days, 0) || null,
            is_active: typeof m.is_active === "boolean" ? m.is_active : null,
          } as ClinicalMedication;
        })
        .filter((value): value is ClinicalMedication => Boolean(value));
      const normalizedLabs = labs
        .map((lab) => {
          const l = asRecord(lab);
          const testName = asString(l.test_name);
          const result = asString(l.result);
          if (!testName || !result) return null;
          return {
            test_name: testName,
            result,
            unit: asString(l.unit) || null,
            reference_range: asString(l.reference_range) || null,
          } as ClinicalLabResult;
        })
        .filter((value): value is ClinicalLabResult => Boolean(value));
      const eventType = normalizeExtractedEventType(asString(row.event_type), row);
      if (!eventType) {
        return null;
      }

      const descriptionSummary = asString(row.description_summary) || "Registro clínico detectado";
      const diagnosis = asString(row.diagnosis) || null;
      const eventTextContext = [
        descriptionSummary,
        diagnosis,
        asString(row.professional_name),
        asString(row.clinic_name),
      ]
        .filter(Boolean)
        .join(" ");
      const appointmentStatus = isAppointmentEventType(eventType)
        ? normalizeAppointmentStatusValue(row.appointment_status, eventTextContext)
        : null;
      const appointmentTime = isAppointmentEventType(eventType)
        ? sanitizeAppointmentTime(row.appointment_time ?? row.time) || extractAppointmentTimeFromText(eventTextContext)
        : null;
      const professionalName = isAppointmentEventType(eventType)
        ? asString(row.professional_name) || extractProfessionalNameFromText(eventTextContext)
        : null;
      const clinicName = isAppointmentEventType(eventType)
        ? asString(row.clinic_name) || extractClinicNameFromText(eventTextContext)
        : null;
      const appointmentSpecialty = isAppointmentEventType(eventType)
        ? asString(row.appointment_specialty) || extractAppointmentSpecialtyFromText(eventTextContext)
        : null;
      const studySubtype = isStudyEventType(eventType)
        ? inferStudySubtypeFromSignals({
            rawStudySubtype: row.study_subtype,
            imagingType: row.imaging_type,
            labResults: normalizedLabs,
            descriptionSummary,
            diagnosis,
          })
        : null;

      return {
        event_type: eventType,
        event_date: asString(row.event_date) || null,
        date_confidence: clamp(asNonNegativeNumber(row.date_confidence, 0), 0, 100),
        description_summary: descriptionSummary,
        diagnosis,
        medications: normalizedMeds,
        lab_results: normalizedLabs,
        imaging_type: asString(row.imaging_type) || null,
        study_subtype: studySubtype,
        appointment_time: appointmentTime,
        appointment_specialty: appointmentSpecialty,
        professional_name: professionalName,
        clinic_name: clinicName,
        appointment_status: appointmentStatus,
        severity: ((): "mild" | "moderate" | "severe" | null => {
          const sev = asString(row.severity).toLowerCase();
          if (sev === "mild" || sev === "moderate" || sev === "severe") return sev;
          return null;
        })(),
        confidence_score: clamp(asNonNegativeNumber(row.confidence_score, 0), 0, 100),
      } as ClinicalEventExtraction;
    })
    .filter((value): value is ClinicalEventExtraction => Boolean(value))
    .map((event) => {
      const grounded = applyVeterinaryEvidencePriority({
        event,
        hints: evidenceHints,
      });
      const guarded = applyConstitutionalGuardrails(grounded);
      guarded.reviewReasons.forEach((reason) => constitutionalReviewReasons.add(reason));
      return guarded.event;
    });

  return {
    is_clinical_content:
      json.is_clinical_content === true && !(evidenceHints.humanHealthcareNoise && !evidenceHints.preferStudyReport),
    confidence_overall: clamp(asNonNegativeNumber(json.confidence_overall, 0), 0, 100),
    detected_events: detectedEvents,
    narrative_summary: asString(json.narrative_summary),
    requires_human_review: json.requires_human_review === true || constitutionalReviewReasons.size > 0,
    reason_if_review_needed: asString(json.reason_if_review_needed) || [...constitutionalReviewReasons][0] || null,
  };
}

function heuristicClinicalExtraction(extractedText: string, emailDate: string): ClinicalExtractionOutput {
  const normalized = normalizeForHash(extractedText);
  const keywordRegex =
    /\b(veterinari|vet|receta|prescrip|dosis|vacuna|turno|diagn[oó]stic|laboratorio|ecograf|radiograf|electrocard|tratamiento)\b/i;
  const isClinical = keywordRegex.test(normalized);
  if (!isClinical) {
    return {
      is_clinical_content: false,
      confidence_overall: 15,
      detected_events: [],
      narrative_summary: "",
      requires_human_review: false,
      reason_if_review_needed: null,
    };
  }

  const inferredType: EventType = normalized.includes("vacuna")
    ? "vaccination_record"
    : normalized.includes("dosis") || normalized.includes("tratamiento") || normalized.includes("prescrip")
      ? "prescription_record"
      : /\b(laboratorio|hemograma|bioquim|radiograf|ecograf|electrocard|resultado|koh|citolog|microscop)\b/i.test(normalized)
        ? "study_report"
      : /\b(turno|consulta|recordatorio|confirmaci[oó]n|cancelaci[oó]n|reprogramaci[oó]n)\b/i.test(normalized)
        ? ((): EventType => {
            const status = inferAppointmentStatusFromText(normalized);
            if (status === "cancelled") return "appointment_cancellation";
            if (status === "reminder") return "appointment_reminder";
            return "appointment_confirmation";
          })()
        : "clinical_report";

  return {
    is_clinical_content: true,
    confidence_overall: 62,
    detected_events: [
      {
        event_type: inferredType,
        event_date: toIsoDateOnly(new Date(emailDate)),
        date_confidence: 60,
        description_summary: extractedText.slice(0, 220) || "Documento clínico detectado por reglas",
        diagnosis: null,
        medications: [],
        lab_results: [],
        imaging_type: null,
        study_subtype: inferredType === "study_report" ? inferStudySubtypeFromSignals({
          descriptionSummary: extractedText,
          diagnosis: null,
          imagingType: null,
          labResults: [],
        }) : null,
        appointment_time: isAppointmentEventType(inferredType) ? extractAppointmentTimeFromText(extractedText) : null,
        appointment_specialty: isAppointmentEventType(inferredType) ? extractAppointmentSpecialtyFromText(extractedText) : null,
        professional_name: isAppointmentEventType(inferredType) ? extractProfessionalNameFromText(extractedText) : null,
        clinic_name: isAppointmentEventType(inferredType) ? extractClinicNameFromText(extractedText) : null,
        appointment_status: isAppointmentEventType(inferredType) ? inferAppointmentStatusFromText(extractedText) : null,
        severity: null,
        confidence_score: 62,
      },
    ],
    narrative_summary:
      "Se detectó contenido clínico en el correo. Requiere validación manual para confirmar los datos.",
    requires_human_review: true,
    reason_if_review_needed: "heuristic_fallback",
  };
}

interface ClinicalClassificationOutput {
  is_clinical: boolean;
  confidence: number;
}

interface ClinicalClassificationInput {
  bodyText: string;
  subject?: string;
  fromEmail?: string;
  attachmentMetadata?: AttachmentMetadata[];
}

function heuristicClinicalClassification(input: ClinicalClassificationInput): ClinicalClassificationOutput {
  const normalized = normalizeForHash(
    [input.subject || "", input.fromEmail || "", input.bodyText || ""].filter(Boolean).join("\n")
  );
  const keywordRegex =
    /\b(veterinari|vet|receta|prescrip|dosis|vacuna|turno|diagn[oó]stic|laboratorio|ecograf|radiograf|electrocard|tratamiento|medicaci[oó]n)\b/i;
  const hasClinicalAttachment = attachmentNamesContainClinicalSignal(input.attachmentMetadata || []);
  const hasNoise = hasStrongNonClinicalSignal(normalized);
  const hasHumanHealthcareNoise = hasStrongHumanHealthcareSignal(normalized);
  const hasVeterinaryEvidence = hasStrongVeterinaryEvidence(input);
  const isClinical =
    (keywordRegex.test(normalized) || hasClinicalAttachment || hasVeterinaryEvidence) &&
    !(!hasClinicalAttachment && (hasNoise || hasHumanHealthcareNoise) && !hasVeterinaryEvidence);
  return {
    is_clinical: isClinical,
    confidence: isClinical ? 65 : 20,
  };
}

async function classifyClinicalContentWithAi(
  input: ClinicalClassificationInput,
  sessionId?: string
): Promise<ClinicalClassificationOutput> {
  const bodyText = asString(input.bodyText);
  const subject = asString(input.subject).slice(0, 500);
  const fromEmail = asString(input.fromEmail).slice(0, 320);
  const hasClinicalAttachment = attachmentNamesContainClinicalSignal(input.attachmentMetadata || []);
  const hasHumanHealthcareNoise = hasStrongHumanHealthcareSignal(`${subject}\n${fromEmail}\n${bodyText}`);
  const hasVeterinaryEvidence = hasStrongVeterinaryEvidence(input);
  const subjectLooksClinical =
    /\b(receta|prescrip|vacuna|diagn[oó]stic|laboratorio|ecograf|radiograf|electrocard|tratamiento|medicaci[oó]n|resultado|resultados)\b/i
      .test(subject);
  const senderLooksClinical = isTrustedClinicalSender(fromEmail) || isVetDomain(fromEmail);
  const hasBody = bodyText.trim().length > 0;

  if (!hasBody && !subject && !hasClinicalAttachment) {
    return { is_clinical: false, confidence: 0 };
  }
  if (hasHumanHealthcareNoise && !hasVeterinaryEvidence && !hasClinicalAttachment) {
    return { is_clinical: false, confidence: 12 };
  }

  // Attachment-only and short-subject clinical mails are common in vet workflows.
  // Promote these to extraction to avoid false negatives.
  if (hasClinicalAttachment) {
    return {
      is_clinical: true,
      confidence: senderLooksClinical ? 92 : 82,
    };
  }
  if (subjectLooksClinical) {
    return {
      is_clinical: true,
      confidence: senderLooksClinical ? 78 : 72,
    };
  }

  const hasGemini = Boolean(asString(process.env.GEMINI_API_KEY));
  if (!hasGemini) return heuristicClinicalClassification(input);

  const attachmentNames = (input.attachmentMetadata || []).map((row) => row.filename).join(" | ").slice(0, 1800);
  const prompt = [
    "Role: You are a strict high-precision classifier for veterinary clinical emails for Pessy.app.",
    "Mission: classify whether the email contains actionable veterinary clinical information.",
    "Return ONLY JSON, no markdown.",
    "Schema:",
    "{\"is_clinical\": boolean, \"confidence\": number, \"reason\": string}",
    "Rules:",
    "1) Set is_clinical=true ONLY if there is explicit veterinary medical evidence.",
    "2) Ignore non-clinical emails: promotions, pet food marketing, newsletters, ecommerce, banking, invoices/receipts without clinical findings.",
    "2b) Ignore human-healthcare, obra social or NGO medical emails unless there is explicit evidence of veterinaria or mascota.",
    "3) Process as clinical when there is at least one of:",
    "- veterinary report / lab result / imaging finding",
    "- prescription with dose and frequency",
    "- vaccination record with date/lot/product/next due",
    "- clinical visit/control with medical context",
    "3b) If an attachment/report indicates imaging or lab evidence, that outweighs generic logistics in the body.",
    "4) If uncertain, set is_clinical=false and confidence <= 40.",
    "5) If sender looks trusted but there is no clinical evidence, keep is_clinical=false.",
    "Known trusted sender hints (if present): Veterinaria Panda, EcoForm, Instituto de Gastroenterologia Veterinaria (IGV).",
    "",
    "Sender:",
    fromEmail || "(unknown)",
    "",
    "Subject:",
    subject || "(empty)",
    "",
    "Attachment names:",
    attachmentNames || "(none)",
    "",
    "Body text:",
    bodyText.slice(0, 20_000),
  ].join("\n");

  const payload = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.1,
      topK: 1,
      topP: 1,
      responseMimeType: "application/json",
      maxOutputTokens: 250,
    },
  };

  try {
    const started = Date.now();
    const response = await callGemini(payload, CLASSIFICATION_AI_TIMEOUT_MS);
    const rawText = extractGeminiText(response);
    const parsed = tryParseJson(rawText);
    const json = asRecord(parsed);
    if (sessionId) {
      await recordSessionStageMetric({
        sessionId,
        stageKey: "classification",
        durationMs: Date.now() - started,
        aiCalls: 1,
        aiInputChars: prompt.length,
        aiOutputChars: rawText.length,
      });
    }
    return {
      is_clinical: json.is_clinical === true,
      confidence: clamp(asNonNegativeNumber(json.confidence, 0), 0, 100),
    };
  } catch (error) {
    console.warn("[gmail-ingestion] AI classification fallback:", error);
    return heuristicClinicalClassification(input);
  }
}

async function extractClinicalEventsWithAi(args: {
  extractedText: string;
  emailDate: string;
  sourceSubject: string;
  sourceSender: string;
  petContext: Record<string, unknown>;
  attachmentMetadata: AttachmentMetadata[];
  sessionId?: string;
}): Promise<ClinicalExtractionOutput> {
  if (!asString(args.extractedText)) {
    return {
      is_clinical_content: false,
      confidence_overall: 0,
      detected_events: [],
      narrative_summary: "",
      requires_human_review: true,
      reason_if_review_needed: "empty_extracted_text",
    };
  }

  const hasGemini = Boolean(asString(process.env.GEMINI_API_KEY));
  if (!hasGemini) {
    return heuristicClinicalExtraction(`${args.sourceSubject}\n${args.extractedText}`, args.emailDate);
  }

  try {
    const context = await resolveClinicalKnowledgeContext({
      query: args.extractedText.slice(0, 6000),
      maxSections: 7,
    });
    const chunks = splitTextForAi(args.extractedText, MAX_AI_DOCUMENT_TEXT_CHARS, 4);
    const chunkOutputs: ClinicalExtractionOutput[] = [];

    for (const chunk of chunks) {
      const prompt = buildClinicalPrompt({
        extractedText: chunk,
        emailDate: args.emailDate,
        sourceSubject: args.sourceSubject,
        sourceSender: args.sourceSender,
        petContext: args.petContext,
        attachmentMetadata: args.attachmentMetadata,
        knowledgeContext: context.contextText,
      });
      const payload = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.1,
          topK: 1,
          topP: 1,
          responseMimeType: "application/json",
          maxOutputTokens: 2000,
        },
      };
      const started = Date.now();
      let aiCallsUsed = 1;
      let response = await callGemini(payload, CLINICAL_AI_TIMEOUT_MS);
      let rawText = extractGeminiText(response);
      let parsed = tryParseJson(rawText);

      // Retry once when the model returns malformed JSON.
      if (!parsed) {
        aiCallsUsed += 1;
        response = await callGemini(payload, CLINICAL_AI_TIMEOUT_MS);
        rawText = extractGeminiText(response);
        parsed = tryParseJson(rawText);
      }

      if (args.sessionId) {
        await recordSessionStageMetric({
          sessionId: args.sessionId,
          stageKey: "extraction",
          durationMs: Date.now() - started,
          aiCalls: aiCallsUsed,
          aiInputChars: prompt.length,
          aiOutputChars: rawText.length,
        });
      }
      if (parsed) {
        chunkOutputs.push(
          toClinicalOutput(parsed, {
            extractedText: chunk,
            sourceSubject: args.sourceSubject,
            sourceSender: args.sourceSender,
            attachmentMetadata: args.attachmentMetadata,
          })
        );
      } else {
        // If JSON parsing still fails after retry, degrade gracefully to deterministic heuristic.
        chunkOutputs.push(heuristicClinicalExtraction(chunk, args.emailDate));
      }
    }

    if (chunkOutputs.length === 0) {
      return heuristicClinicalExtraction(args.extractedText, args.emailDate);
    }

    const mergedEvents = chunkOutputs.flatMap((row) => row.detected_events).slice(0, 40);
    const confidenceOverall = Math.round(
      chunkOutputs.reduce((sum, row) => sum + row.confidence_overall, 0) / chunkOutputs.length
    );
    const isClinical = chunkOutputs.some((row) => row.is_clinical_content);
    const requiresHumanReview = chunkOutputs.some((row) => row.requires_human_review) || mergedEvents.length === 0;
    const narrativeSummary = chunkOutputs
      .map((row) => row.narrative_summary)
      .filter((row) => row.trim().length > 0)
      .slice(0, 2)
      .join(" ");
    const reason = chunkOutputs.find((row) => row.reason_if_review_needed)?.reason_if_review_needed || null;

    if (mergedEvents.length === 0 && isClinical) {
      return {
        is_clinical_content: true,
        confidence_overall: confidenceOverall,
        detected_events: [],
        narrative_summary: narrativeSummary,
        requires_human_review: true,
        reason_if_review_needed: reason || "empty_events_from_ai",
      };
    }

    return {
      is_clinical_content: isClinical,
      confidence_overall: confidenceOverall,
      detected_events: mergedEvents,
      narrative_summary: narrativeSummary,
      requires_human_review: requiresHumanReview,
      reason_if_review_needed: reason,
    };
  } catch (error) {
    console.warn("[gmail-ingestion] AI extraction fallback:", error);
    return heuristicClinicalExtraction(args.extractedText, args.emailDate);
  }
}

async function fetchAttachmentMetadata(args: {
  payload: GmailMessagePart | undefined;
}): Promise<{ attachmentMetadata: AttachmentMetadata[]; imageCount: number }> {
  const allParts = listAllMessageParts(args.payload);
  const attachments = allParts
    .filter((part) => Boolean(asString(part.filename) || asString(part.body?.attachmentId)))
    .slice(0, MAX_ATTACHMENTS_PER_EMAIL);

  const metadata: AttachmentMetadata[] = [];
  let imageCount = 0;

  for (const part of attachments) {
    const filename = asString(part.filename) || "attachment";
    const originalMimeType = asString(part.mimeType).toLowerCase() || "application/octet-stream";
    const mimeType = normalizeMimeType(originalMimeType, filename);
    const attachmentId = asString(part.body?.attachmentId);
    const sizeBytes = asNonNegativeNumber(part.body?.size, 0);
    const supported = isSupportedAttachmentType(filename, mimeType);
    const oversized = sizeBytes > MAX_ATTACHMENT_SIZE_BYTES;
    const isImage = isImageMime(mimeType) || /\.(png|jpe?g)$/i.test(filename);
    if (isImage) imageCount += 1;

    metadata.push({
      filename,
      mimetype: mimeType,
      size_bytes: sizeBytes,
      ocr_success: supported && !oversized && Boolean(attachmentId),
      original_mimetype: originalMimeType,
      normalized_mimetype: mimeType,
    });
  }

  return { attachmentMetadata: metadata, imageCount };
}

function normalizeMimeType(mimeType: string | undefined, filename: string): string {
  const lowerName = filename.toLowerCase();
  const normalized = asString(mimeType).toLowerCase();
  if (normalized && normalized !== "application/octet-stream") return normalized;
  if (lowerName.endsWith(".pdf")) return "application/pdf";
  if (lowerName.endsWith(".docx")) return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (lowerName.endsWith(".doc")) return "application/msword";
  if (lowerName.endsWith(".txt")) return "text/plain";
  if (lowerName.endsWith(".csv")) return "text/csv";
  if (lowerName.endsWith(".jpg") || lowerName.endsWith(".jpeg")) return "image/jpeg";
  if (lowerName.endsWith(".png")) return "image/png";
  if (lowerName.endsWith(".webp")) return "image/webp";
  if (lowerName.endsWith(".heic")) return "image/heic";
  if (lowerName.endsWith(".dcm")) return "application/dicom";
  return normalized || "application/octet-stream";
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

function isVetDomain(email: string): boolean {
  const normalized = email.toLowerCase();
  return (
    normalized.includes("vet") ||
    normalized.includes("veterin") ||
    normalized.includes("clinic") ||
    normalized.includes("clinica") ||
    normalized.includes("hospital")
  );
}

function extractSenderDomain(email: string): string {
  const match = email.toLowerCase().match(/@([a-z0-9.-]+\.[a-z]{2,})/i);
  return match?.[1] || "";
}

function isMassMarketingDomain(email: string): boolean {
  const domain = extractSenderDomain(email);
  if (!domain) return false;
  const knownMassDomains = [
    "linkedin.com",
    "mailchimp.com",
    "sendgrid.net",
    "hubspotemail.net",
    "amazon.com",
    "mercadolibre.com",
    "mercadopago.com",
    "facebookmail.com",
    "instagram.com",
    "tiktok.com",
    "x.com",
    "twitter.com",
    "news.",
    "newsletter.",
  ];
  return knownMassDomains.some((pattern) => domain.includes(pattern));
}

function isTrustedClinicalDomain(email: string): boolean {
  const domain = extractSenderDomain(email);
  if (!domain) return false;
  const allowlist = parseDomainListEnv("GMAIL_TRUSTED_SENDER_DOMAINS");
  if (allowlist.length === 0) return false;
  return allowlist.some((item) => domainMatches(domain, item));
}

function isTrustedClinicalSenderName(emailHeader: string): boolean {
  const normalized = normalizeTextForMatch(emailHeader);
  if (!normalized) return false;
  const knownTrustedNames = [
    "veterinaria panda",
    "panda clinica veterinaria",
    "panda - clinica veterinaria",
    "ecoform",
    "silvana formoso",
    "instituto de gastroenterologia veterinaria",
    "igv",
  ];
  return knownTrustedNames.some((item) => normalized.includes(item));
}

function isTrustedClinicalSender(emailHeader: string): boolean {
  return isTrustedClinicalDomain(emailHeader) || isTrustedClinicalSenderName(emailHeader);
}

function isBlockedClinicalDomain(email: string): boolean {
  const domain = extractSenderDomain(email);
  if (!domain) return false;
  const blocklist = uniqueNonEmpty([
    ...DEFAULT_HUMAN_BLOCKED_SENDER_DOMAINS,
    ...parseDomainListEnv("GMAIL_BLOCKED_SENDER_DOMAINS"),
  ]);
  if (blocklist.length === 0) return false;
  return blocklist.some((item) => domainMatches(domain, item));
}

function normalizeTextForMatch(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenizeIdentity(value: string): string[] {
  return Array.from(
    new Set(
      normalizeTextForMatch(value)
        .split(/[^a-z0-9]+/g)
        .map((token) => token.trim())
        .filter((token) => token.length >= 3)
    )
  );
}

function hasAnyIdentityToken(corpus: string, tokens: string[]): boolean {
  return tokens.some((token) => corpus.includes(token));
}

function hasExactPhrase(corpus: string, phrase: string): boolean {
  const normalizedPhrase = normalizeTextForMatch(phrase);
  if (!normalizedPhrase) return false;
  return corpus.includes(normalizedPhrase);
}

function listStringValues(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => asString(entry))
    .filter(Boolean);
}

function uniqueNonEmpty(values: string[]): string[] {
  return Array.from(new Set(values.map((entry) => entry.trim()).filter(Boolean)));
}

function speciesAliases(species: string): string[] {
  const normalized = normalizeTextForMatch(species);
  if (!normalized) return [];
  if (normalized === "dog" || normalized === "perro" || normalized === "canine" || normalized === "canino") {
    return ["dog", "perro", "canino", "canine"];
  }
  if (normalized === "cat" || normalized === "gato" || normalized === "feline" || normalized === "felino") {
    return ["cat", "gato", "felino", "feline"];
  }
  return [normalized];
}

function canonicalSpeciesKey(species: string): string | null {
  const aliases = speciesAliases(species);
  if (aliases.includes("dog")) return "dog";
  if (aliases.includes("cat")) return "cat";
  const normalized = normalizeTextForMatch(species);
  return normalized || null;
}

function inferSpeciesSignalsFromCorpus(corpus: string): string[] {
  const normalized = normalizeTextForMatch(corpus);
  if (!normalized) return [];

  const signals = new Set<string>();
  const signalMap: Array<{ key: string; patterns: string[] }> = [
    {
      key: "dog",
      patterns: ["dog", "perro", "canino", "canine", "vacuna canina", "sextuple canina", "parvovirus", "moquillo"],
    },
    {
      key: "cat",
      patterns: ["cat", "gato", "felino", "feline", "triple felina", "leucemia felina", "felv", "vif"],
    },
  ];

  for (const entry of signalMap) {
    if (entry.patterns.some((pattern) => normalized.includes(normalizeTextForMatch(pattern)))) {
      signals.add(entry.key);
    }
  }

  return [...signals];
}

function petMatchesByName(corpus: string, pet: Pick<PetCandidateProfile, "name">): boolean {
  const normalizedCorpus = normalizeTextForMatch(corpus);
  if (!normalizedCorpus) return false;

  const normalizedName = normalizeTextForMatch(pet.name);
  if (normalizedName && hasExactPhrase(normalizedCorpus, normalizedName)) return true;

  const nameTokens = tokenizeIdentity(pet.name);
  return nameTokens.length > 0 && hasAnyIdentityToken(normalizedCorpus, nameTokens);
}

function petMatchesByBreed(corpus: string, pet: Pick<PetCandidateProfile, "breed">): boolean {
  const normalizedCorpus = normalizeTextForMatch(corpus);
  if (!normalizedCorpus) return false;

  const normalizedBreed = normalizeTextForMatch(pet.breed);
  if (normalizedBreed && hasExactPhrase(normalizedCorpus, normalizedBreed)) return true;

  const breedTokens = tokenizeIdentity(pet.breed);
  return breedTokens.length > 0 && hasAnyIdentityToken(normalizedCorpus, breedTokens);
}

function petMatchesBySpeciesSignal(speciesSignals: string[], pet: Pick<PetCandidateProfile, "species">): boolean {
  const canonicalSpecies = canonicalSpeciesKey(pet.species);
  if (!canonicalSpecies) return false;
  return speciesSignals.includes(canonicalSpecies);
}

function detectPetIdentityConflict(args: {
  pets: PetCandidateProfile[];
  chosenPet: PetCandidateProfile;
  subjectText?: string;
  bodyText?: string;
}): {
  hasConflict: boolean;
  label: "IDENTITY_CONFLICT" | null;
  reasons: string[];
  speciesSignals: string[];
  mentionedPetNames: string[];
} {
  const subjectCorpus = normalizeTextForMatch(asString(args.subjectText));
  const bodyCorpus = normalizeTextForMatch(asString(args.bodyText));
  const fullCorpus = `${subjectCorpus}\n${bodyCorpus}`.trim();
  if (!fullCorpus) {
    return {
      hasConflict: false,
      label: null,
      reasons: [],
      speciesSignals: [],
      mentionedPetNames: [],
    };
  }

  const reasons: string[] = [];
  const speciesSignals = inferSpeciesSignalsFromCorpus(fullCorpus);
  const mentionedPets = args.pets.filter((pet) => petMatchesByName(fullCorpus, pet));
  const mentionedPetNames = uniqueNonEmpty(mentionedPets.map((pet) => pet.name));
  const chosenSpecies = canonicalSpeciesKey(args.chosenPet.species);

  if (mentionedPets.some((pet) => pet.id !== args.chosenPet.id)) {
    const otherNames = uniqueNonEmpty(mentionedPets.filter((pet) => pet.id !== args.chosenPet.id).map((pet) => pet.name));
    reasons.push(`other_pet_name_mentioned:${otherNames.join("|")}`);
  }

  if (speciesSignals.length > 0 && chosenSpecies && !speciesSignals.includes(chosenSpecies)) {
    reasons.push(`species_conflict:${chosenSpecies}->${speciesSignals.join("|")}`);
  }

  const uniqueSpeciesMatch =
    speciesSignals.length > 0
      ? args.pets.filter((pet) => petMatchesBySpeciesSignal(speciesSignals, pet))
      : [];
  if (uniqueSpeciesMatch.length === 1 && uniqueSpeciesMatch[0].id !== args.chosenPet.id) {
    reasons.push(`species_points_to_other_pet:${uniqueSpeciesMatch[0].name}`);
  }

  return {
    hasConflict: reasons.length > 0,
    label: reasons.length > 0 ? "IDENTITY_CONFLICT" : null,
    reasons,
    speciesSignals,
    mentionedPetNames,
  };
}

async function resolvePetConditionHints(petId: string, petData: Record<string, unknown>): Promise<string[]> {
  const direct = uniqueNonEmpty([
    ...listStringValues(petData.knownConditions),
    ...listStringValues(petData.known_conditions),
    ...listStringValues(petData.chronic_conditions),
  ]);
  if (direct.length > 0) return direct.slice(0, 8);

  try {
    const snap = await admin.firestore().collection("clinical_conditions").where("petId", "==", petId).limit(8).get();
    const fromConditions = snap.docs
      .map((doc) => {
        const row = asRecord(doc.data());
        return asString(row.normalizedName) || asString(row.name) || asString(row.title);
      })
      .filter(Boolean);
    return uniqueNonEmpty(fromConditions).slice(0, 8);
  } catch {
    return [];
  }
}

interface PetResolutionHints {
  subjectText?: string;
  bodyText?: string;
}

interface PetCandidateProfile {
  id: string;
  data: Record<string, unknown>;
  name: string;
  species: string;
  breed: string;
  knownConditions: string[];
}

interface PetCandidateScore {
  pet: PetCandidateProfile;
  score: number;
  anchors: number;
  reasons: string[];
}

function scorePetCandidate(args: {
  subjectCorpus: string;
  bodyCorpus: string;
  pet: PetCandidateProfile;
}): PetCandidateScore {
  const { subjectCorpus, bodyCorpus, pet } = args;
  const fullCorpus = `${subjectCorpus}\n${bodyCorpus}`.trim();
  let score = 0;
  let anchors = 0;
  const reasons: string[] = [];

  const add = (value: number, reason: string, anchor = false) => {
    score += value;
    if (anchor) anchors += 1;
    reasons.push(reason);
  };

  const name = normalizeTextForMatch(pet.name);
  const breed = normalizeTextForMatch(pet.breed);
  const conditionHints = pet.knownConditions.map((entry) => normalizeTextForMatch(entry)).filter(Boolean);
  const nameTokens = tokenizeIdentity(pet.name);
  const breedTokens = tokenizeIdentity(pet.breed);
  const speciesHints = speciesAliases(pet.species);
  const corpusSpeciesSignals = inferSpeciesSignalsFromCorpus(fullCorpus);
  const canonicalPetSpecies = canonicalSpeciesKey(pet.species);

  if (name && hasExactPhrase(subjectCorpus, name)) add(140, `name_subject:${name}`, true);
  else if (name && hasExactPhrase(bodyCorpus, name)) add(110, `name_body:${name}`, true);
  else if (nameTokens.length > 0 && hasAnyIdentityToken(subjectCorpus, nameTokens)) add(90, `name_token_subject:${nameTokens[0]}`, true);
  else if (nameTokens.length > 0 && hasAnyIdentityToken(bodyCorpus, nameTokens)) add(65, `name_token_body:${nameTokens[0]}`, true);

  if (breed && hasExactPhrase(subjectCorpus, breed)) add(50, `breed_subject:${breed}`, true);
  else if (breed && hasExactPhrase(bodyCorpus, breed)) add(35, `breed_body:${breed}`, true);
  else if (breedTokens.length > 0 && hasAnyIdentityToken(bodyCorpus, breedTokens)) add(18, `breed_token:${breedTokens[0]}`);

  if (speciesHints.some((alias) => hasExactPhrase(subjectCorpus, alias))) add(22, `species_subject:${pet.species}`);
  else if (speciesHints.some((alias) => hasExactPhrase(bodyCorpus, alias))) add(12, `species_body:${pet.species}`);
  if (corpusSpeciesSignals.length > 0 && canonicalPetSpecies && !corpusSpeciesSignals.includes(canonicalPetSpecies)) {
    add(-55, `species_exclusion:${canonicalPetSpecies}->${corpusSpeciesSignals.join("|")}`);
  }

  for (const condition of conditionHints.slice(0, 3)) {
    if (condition.length < 4) continue;
    if (hasExactPhrase(subjectCorpus, condition)) {
      add(48, `condition_subject:${condition}`, true);
      continue;
    }
    if (hasExactPhrase(bodyCorpus, condition)) {
      add(34, `condition_body:${condition}`, true);
    }
  }

  return { pet, score, anchors, reasons };
}

function choosePetByHints(args: {
  pets: PetCandidateProfile[];
  hints?: PetResolutionHints | null;
}): PetCandidateScore | null {
  const subjectCorpus = normalizeTextForMatch(asString(args.hints?.subjectText));
  const bodyCorpus = normalizeTextForMatch(asString(args.hints?.bodyText));
  const fullCorpus = `${subjectCorpus}\n${bodyCorpus}`.trim();
  if (!subjectCorpus && !bodyCorpus) return null;

  const namedMatches = args.pets.filter((pet) => petMatchesByName(fullCorpus, pet));
  if (namedMatches.length === 1) {
    const forced = scorePetCandidate({ subjectCorpus, bodyCorpus, pet: namedMatches[0] });
    return {
      ...forced,
      score: Math.max(forced.score, 120),
      anchors: Math.max(forced.anchors, 1),
      reasons: uniqueNonEmpty([...forced.reasons, `unique_name_match:${namedMatches[0].name}`]).slice(0, 8),
    };
  }

  const breedMatches = args.pets.filter((pet) => petMatchesByBreed(fullCorpus, pet));
  if (namedMatches.length === 0 && breedMatches.length === 1) {
    const forced = scorePetCandidate({ subjectCorpus, bodyCorpus, pet: breedMatches[0] });
    return {
      ...forced,
      score: Math.max(forced.score, 88),
      anchors: Math.max(forced.anchors, 1),
      reasons: uniqueNonEmpty([...forced.reasons, `unique_breed_match:${breedMatches[0].breed}`]).slice(0, 8),
    };
  }

  const speciesSignals = inferSpeciesSignalsFromCorpus(fullCorpus);
  const speciesMatches = speciesSignals.length > 0
    ? args.pets.filter((pet) => petMatchesBySpeciesSignal(speciesSignals, pet))
    : [];
  if (namedMatches.length === 0 && breedMatches.length === 0 && speciesMatches.length === 1) {
    const forced = scorePetCandidate({ subjectCorpus, bodyCorpus, pet: speciesMatches[0] });
    return {
      ...forced,
      score: Math.max(forced.score, 72),
      anchors: Math.max(forced.anchors, 1),
      reasons: uniqueNonEmpty([...forced.reasons, `unique_species_match:${speciesMatches[0].species}`]).slice(0, 8),
    };
  }

  const ranked = args.pets
    .map((pet) => scorePetCandidate({ subjectCorpus, bodyCorpus, pet }))
    .sort((a, b) => b.score - a.score);
  const best = ranked[0];
  const second = ranked[1];
  if (!best || best.score < 60 || best.anchors === 0) return null;
  if (second && second.score > 0 && best.score - second.score < 25) return null;
  if (best.anchors < 2 && best.score < 95) return null;
  return best;
}

function attachmentNamesContainClinicalSignal(metadata: AttachmentMetadata[]): boolean {
  const joined = normalizeTextForMatch(metadata.map((row) => row.filename).join(" "));
  if (!joined) return false;
  return (
    joined.includes("receta") ||
    joined.includes("prescrip") ||
    joined.includes("estudio") ||
    joined.includes("analisis") ||
    joined.includes("informe") ||
    joined.includes("laboratorio") ||
    joined.includes("radiografia") ||
    joined.includes("ecografia") ||
    joined.includes("ultrasound") ||
    joined.includes("ecg")
  );
}

function hasStrongHumanHealthcareSignal(text: string): boolean {
  const normalized = normalizeTextForMatch(text);
  if (!normalized) return false;
  const pattern =
    /\b(huesped|vih|hiv|infectologia|infectolog|obra social|prep|hepati(?:tis)?|paciente humano|paciente adulto|adulto mayor|turno medico|turno médico|medicina humana|clinica humana|clínica humana|oncologia humana|ginecolog|urolog|mastograf|mamograf|papanicolau|pap smear|colonoscop|endoscop|resonancia de cerebro|tomografia de torax humano|tomografía de tórax humano|hospital italiano|hospital aleman|hospital alemán|sanatorio|osde|swiss medical|medicus|galeno|omint)\b/;
  return pattern.test(normalized);
}

function hasStrongVeterinaryEvidence(args: {
  subject?: string;
  fromEmail?: string;
  bodyText?: string;
  attachmentMetadata?: AttachmentMetadata[];
}): boolean {
  const haystack = normalizeTextForMatch(
    [
      asString(args.subject),
      asString(args.fromEmail),
      asString(args.bodyText),
      ...(args.attachmentMetadata || []).flatMap((row) => [row.filename, row.mimetype, row.normalized_mimetype || ""]),
    ].join(" ")
  );
  if (!haystack) return false;
  if (attachmentNamesContainClinicalSignal(args.attachmentMetadata || [])) return true;
  if (isTrustedClinicalSender(asString(args.fromEmail)) || isVetDomain(asString(args.fromEmail))) return true;
  return /\b(veterinari|vet\b|canino|canina|felino|felina|mascota|thor|loki|perro|gato|ecografia veterinaria|radiografia veterinaria|vacuna canina|vacuna felina|placa de torax|placa de tórax|ecocard|electrocard|rx)\b/.test(
    haystack
  );
}

function hasStrongNonClinicalSignal(text: string): boolean {
  const normalized = normalizeTextForMatch(text);
  if (!normalized) return false;
  const pattern =
    /\b(delivery status notification|mail delivery subsystem|newsletter|unsubscribe|linkedin|mercadopago|mercado pago|supervielle|banco|tarjeta|factura|invoice|pedido|shipping|envio|orden de compra|webinar|meeting invite|zoom|promocion|promoción|promo|oferta|descuento|alimento|balanceado|petshop|pet shop|accesorios)\b/;
  return pattern.test(normalized);
}

function isCandidateClinicalEmail(args: {
  subject: string;
  fromEmail: string;
  bodyText: string;
  attachmentCount: number;
  attachmentMetadata: AttachmentMetadata[];
  petName: string;
  petId: string;
}): boolean {
  const corpus = `${args.subject}\n${args.bodyText}`;
  const normalizedCorpus = normalizeTextForMatch(corpus);
  const normalizedFrom = normalizeTextForMatch(args.fromEmail);
  const attachmentNames = normalizeTextForMatch(args.attachmentMetadata.map((row) => row.filename).join(" "));
  const fullSearchCorpus = `${normalizedCorpus}\n${normalizedFrom}\n${attachmentNames}`;

  const keywordPattern =
    /\b(appointment|turno|diagnosis|diagnostico|vaccine|vacuna|lab|laboratorio|rx|receta|veterinary|veterinaria|veterinario|radiograf|electrocardiograma|ultrasound|ecografia|tratamiento|medicacion|consulta|hospital)\b/;
  const hasClinicalKeywords = keywordPattern.test(fullSearchCorpus);
  const hasVetSender = isVetDomain(args.fromEmail);
  const hasTrustedSender = isTrustedClinicalSender(args.fromEmail);
  const hasBlockedSender = isBlockedClinicalDomain(args.fromEmail);
  const hasAttachment = args.attachmentCount > 0;
  const hasClinicalAttachment = attachmentNamesContainClinicalSignal(args.attachmentMetadata);
  const hasLongBody = normalizeTextForMatch(args.bodyText).length >= MIN_LIGHTWEIGHT_BODY_LENGTH;
  const notMassMarketingSender = !isMassMarketingDomain(args.fromEmail);
  const hasNonClinicalNoise = hasStrongNonClinicalSignal(`${args.subject}\n${args.fromEmail}\n${args.bodyText}`);
  const hasHumanHealthcareNoise = hasStrongHumanHealthcareSignal(`${args.subject}\n${args.fromEmail}\n${args.bodyText}`);
  const hasPromoSignal = /\b(promocion|promoción|promo|oferta|descuento|alimento|balanceado|accesorios)\b/.test(fullSearchCorpus);
  const hasAdministrativeOnlySignal = /\b(comprobante|factura|invoice|payment|pago|recibo)\b/.test(fullSearchCorpus);
  const hasVeterinaryEvidence = hasStrongVeterinaryEvidence({
    subject: args.subject,
    fromEmail: args.fromEmail,
    bodyText: args.bodyText,
    attachmentMetadata: args.attachmentMetadata,
  });

  const petTokens = [
    ...tokenizeIdentity(args.petName),
    ...tokenizeIdentity(args.petId),
  ];
  const hasPetMention = petTokens.length > 0 && hasAnyIdentityToken(fullSearchCorpus, petTokens);

  // Lightweight but non-destructive scoring:
  // avoid false positives from generic "turno/consulta" and marketing domains.
  let score = 0;
  if (hasVetSender) score += 3;
  if (hasTrustedSender) score += 4;
  if (hasClinicalKeywords) score += 3;
  if (hasClinicalAttachment) score += 3;
  if (hasPetMention) score += 2;
  if (hasAttachment) score += 1;
  if (hasLongBody && hasPetMention) score += 1;
  if (hasBlockedSender) score -= 6;
  if (!notMassMarketingSender) score -= 4;
  if (hasNonClinicalNoise) score -= 3;
  if (hasHumanHealthcareNoise) score -= 5;

  const hasClinicalAnchor = hasClinicalKeywords || hasClinicalAttachment || hasVetSender || hasTrustedSender;

  // Hard negative: sender bloqueado + sin evidencia fuerte clínica.
  if (hasBlockedSender && !hasClinicalAttachment && !hasPetMention) return false;

  // Hard negative: correo humano / financiador sin evidencia veterinaria fuerte.
  if (hasHumanHealthcareNoise && !hasVeterinaryEvidence && !hasPetMention) return false;

  // Hard negative: ruido no clínico fuerte sin anclas clínicas verificables.
  if (hasNonClinicalNoise && !hasClinicalAttachment && !hasVetSender && !hasTrustedSender) return false;

  // Hard negative: promo/comercial sin evidencia clínica verificable.
  if (hasPromoSignal && !hasClinicalAttachment && !hasTrustedSender) return false;

  // Hard negative: administrativos (comprobante/factura) sin evidencia clínica.
  if (hasAdministrativeOnlySignal && !hasClinicalAttachment && !hasClinicalKeywords) return false;

  // Hard positive: allowlist + adjunto clínico.
  if (hasTrustedSender && hasClinicalAttachment) return true;

  if (score >= 4 && (hasClinicalAnchor || (hasPetMention && hasAttachment))) return true;

  return false;
}

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

function parseGmailDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return getNowIso();
  return parsed.toISOString();
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

function buildSessionDateWindow(maxLookbackMonths: number): { afterDate: Date; beforeDate: Date } {
  const beforeDate = new Date();
  const afterDate = new Date(beforeDate);
  afterDate.setUTCMonth(afterDate.getUTCMonth() - maxLookbackMonths);
  return { afterDate, beforeDate };
}

function buildGmailSearchQuery(args: {
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

async function createIngestionSession(args: {
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

async function updateIngestionProgress(uid: string, status: IngestionStatus): Promise<void> {
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

function queueCollectionForStage(stage: QueueJobStage): string {
  if (stage === "scan") return "gmail_scan_jobs";
  if (stage === "attachment") return "gmail_attachment_jobs";
  return "gmail_ai_jobs";
}

async function enqueueStageJob<TPayload extends object>(args: {
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

async function pickPendingJobs(args: {
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

async function markJobProcessing(
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

async function markJobCompleted(
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

async function markJobFailed(
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
      status: retryable ? "pending" : "failed",
      updated_at: getNowIso(),
      available_at: retryable ? nextAvailableAt : getNowIso(),
      error: String(error).slice(0, 1500),
    },
    { merge: true }
  );
}

async function incrementSessionCounters(
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

async function recordSessionStageMetric(args: {
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

async function maybeFinalizeSession(sessionId: string): Promise<void> {
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

async function closeStuckSessionAsPartial(args: {
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

async function acquireUserIngestionLock(uid: string, owner: string): Promise<boolean> {
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

async function releaseUserIngestionLock(uid: string, owner: string): Promise<void> {
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

async function ensurePendingScanJob(sessionId: string, uid: string): Promise<void> {
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

async function persistTemporaryRawDocument(args: {
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

async function deleteTemporaryRawDocument(docId: string): Promise<void> {
  await admin.firestore().collection("gmail_raw_documents_tmp").doc(docId).delete().catch(() => undefined);
}

function decryptText(payload: { ciphertext: string; iv: string; tag: string }): string {
  const key = getEncryptionKey();
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(payload.iv, "base64"));
  decipher.setAuthTag(Buffer.from(payload.tag, "base64"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(payload.ciphertext, "base64")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}

async function loadTemporaryRawDocument(docId: string): Promise<{
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

async function saveTemporaryAttachmentExtraction(args: {
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

async function loadTemporaryAttachmentExtraction(rawDocId: string): Promise<{
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

async function deleteTemporaryAttachmentExtraction(rawDocId: string): Promise<void> {
  await admin.firestore().collection("gmail_attachment_extract_tmp").doc(rawDocId).delete().catch(() => undefined);
}

async function purgeExpiredRawDocuments(limit = 50): Promise<void> {
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

async function persistReviewEvent(args: {
  uid: string;
  petId: string | null;
  sessionId: string;
  sourceEmailId: string;
  sourceSubject: string;
  sourceSender: string;
  sourceDate: string;
  event: ClinicalEventExtraction;
  overallConfidence: number;
  narrativeSummary: string;
  reason: string;
}): Promise<string> {
  const docId = `${args.sessionId}_${sha256(JSON.stringify(args.event)).slice(0, 12)}`;
  const silentApprovalExpiresAt = new Date(Date.now() + getSilentApprovalWindowHours() * 60 * 60 * 1000).toISOString();
  await admin.firestore().collection("gmail_event_reviews").doc(docId).set(
    {
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
      created_at: getNowIso(),
      updated_at: getNowIso(),
    },
    { merge: true }
  );
  return docId;
}

function toMedicalEventDocumentType(event: ClinicalEventExtraction):
  "appointment" | "medication" | "vaccine" | "lab_test" | "xray" | "echocardiogram" | "electrocardiogram" | "checkup" | "other" {
  if (isAppointmentEventType(event.event_type)) return "appointment";
  if (isPrescriptionEventType(event.event_type)) return "medication";
  if (isVaccinationEventType(event.event_type)) return "vaccine";
  if (isStudyEventType(event.event_type)) {
    return event.study_subtype === "imaging" ? inferImagingDocumentType(event) : "lab_test";
  }
  if (event.event_type === "clinical_report") return "checkup";
  return "other";
}

function buildDefaultExtractedData(args: {
  event: ClinicalEventExtraction;
  sourceDate: string;
  sourceSubject: string;
  sourceSender: string;
  sourceAttachment?: AttachmentMetadata | null;
}): Record<string, unknown> {
  const eventDate = args.event.event_date || toIsoDateOnly(new Date(args.sourceDate));
  const documentType = toMedicalEventDocumentType(args.event);
  const confidence =
    args.event.confidence_score >= 85 ? "high" : args.event.confidence_score >= 60 ? "medium" : "low";
  const appointmentConfidence =
    args.event.date_confidence >= 85 ? "high" : args.event.date_confidence >= 60 ? "medium" : "low";
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
    referenceRange: sanitizeReferenceRange(row.reference_range, row.result),
    confidence,
  }));
  const suggestedTitle = buildCanonicalEventTitle(args.event).slice(0, 120);
  const appointmentLabel = deriveAppointmentLabel(args.event) || suggestedTitle;
  const sourceStorageUri = asString(args.sourceAttachment?.storage_uri) || null;
  const sourceStoragePath = asString(args.sourceAttachment?.storage_path) || null;
  const sourceStorageSignedUrl = asString(args.sourceAttachment?.storage_signed_url) || null;
  const sourceFileName = asString(args.sourceAttachment?.filename) || null;
  const sourceMimeType = asString(args.sourceAttachment?.mimetype) || null;
  const detectedAppointments = isAppointmentEventType(args.event.event_type)
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
    taxonomyRoute:
      isAppointmentEventType(args.event.event_type)
        ? "operational_appointment"
        : isStudyEventType(args.event.event_type)
          ? "study_report"
          : isPrescriptionEventType(args.event.event_type)
            ? "prescription_record"
            : isVaccinationEventType(args.event.event_type)
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

function medicationHasDoseAndFrequency(medication: ClinicalMedication): boolean {
  return Boolean(asString(medication.dose)) && Boolean(asString(medication.frequency));
}

function buildIncompleteTreatmentSubtitle(event: ClinicalEventExtraction): string {
  const incomplete = event.medications
    .filter((med) => !medicationHasDoseAndFrequency(med))
    .map((med) => {
      const medName = asString(med.name) || "medicación";
      const missing: string[] = [];
      if (!asString(med.dose)) missing.push("dosis");
      if (!asString(med.frequency)) missing.push("frecuencia");
      return `${medName} (falta ${missing.join(" y ")})`;
    })
    .slice(0, 3);

  if (incomplete.length === 0) {
    return "Detectamos tratamiento, pero falta confirmar dosis o frecuencia antes de activar alarmas.";
  }
  return `Detectamos tratamiento incompleto: ${incomplete.join(", ")}. Confirmá los datos para activar recordatorios.`;
}

function selectBestAttachmentForReview(attachmentMetadata: AttachmentMetadata[]): AttachmentMetadata | null {
  if (!Array.isArray(attachmentMetadata) || attachmentMetadata.length === 0) return null;
  const withSignedUrl = attachmentMetadata.find((row) => Boolean(asString(row.storage_signed_url)));
  if (withSignedUrl) return withSignedUrl;
  const withStoredUri = attachmentMetadata.find((row) => Boolean(asString(row.storage_uri)));
  if (withStoredUri) return withStoredUri;
  return attachmentMetadata[0] || null;
}

async function upsertClinicalReviewDraft(args: {
  uid: string;
  petId: string;
  sessionId: string;
  canonicalEventId: string;
  sourceEmailId: string;
  sourceSubject: string;
  sourceSender: string;
  sourceDate: string;
  event: ClinicalEventExtraction;
  attachmentMetadata: AttachmentMetadata[];
  gmailReviewId?: string | null;
}): Promise<string> {
  const reviewId = `review_${sha256(`${args.uid}_${args.canonicalEventId}`).slice(0, 24)}`;
  const nowIso = getNowIso();
  const selectedAttachment = selectBestAttachmentForReview(args.attachmentMetadata);
  const sourceStorageUri = asString(selectedAttachment?.storage_uri) || null;
  const sourceStoragePath = asString(selectedAttachment?.storage_path) || null;
  const sourceStorageSignedUrl = asString(selectedAttachment?.storage_signed_url) || null;
  const sourceFileName = asString(selectedAttachment?.filename) || null;
  const sourceMimeType = asString(selectedAttachment?.mimetype) || null;
  const imageFragmentUrl = sourceStorageSignedUrl || sourceStorageUri || null;

  const missingFields = args.event.medications
    .filter((medication) => !medicationHasDoseAndFrequency(medication))
    .map((medication) => ({
      medication: asString(medication.name) || null,
      missingDose: !asString(medication.dose),
      missingFrequency: !asString(medication.frequency),
      detectedDose: asString(medication.dose) || null,
      detectedFrequency: asString(medication.frequency) || null,
    }));

  await admin.firestore().collection("clinical_review_drafts").doc(reviewId).set(
    {
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
      gmailReviewId: asString(args.gmailReviewId) || null,
      missingFields,
      missing_fields: missingFields,
      medications: args.event.medications.map((medication) => ({
        name: asString(medication.name) || null,
        dose: asString(medication.dose) || null,
        frequency: asString(medication.frequency) || null,
        duration_days: medication.duration_days || null,
        is_active: medication.is_active !== false,
      })),
      diagnosis: asString(args.event.diagnosis) || null,
      eventDate: asString(args.event.event_date) || null,
      createdAt: nowIso,
      updatedAt: nowIso,
      resolvedAt: null,
      resolvedBy: null,
    },
    { merge: true }
  );

  return reviewId;
}

async function upsertIncompleteTreatmentPendingAction(args: {
  uid: string;
  petId: string;
  sessionId: string;
  canonicalEventId: string;
  sourceEmailId: string;
  event: ClinicalEventExtraction;
  reviewId: string;
  sourceAttachment?: AttachmentMetadata | null;
}): Promise<void> {
  const pendingId = `incomplete_treatment_${args.canonicalEventId}`;
  const nowIso = getNowIso();
  const sourceStorageUri = asString(args.sourceAttachment?.storage_uri) || null;
  const sourceStoragePath = asString(args.sourceAttachment?.storage_path) || null;
  const sourceStorageSignedUrl = asString(args.sourceAttachment?.storage_signed_url) || null;
  const sourceFileName = asString(args.sourceAttachment?.filename) || null;
  const sourceMimeType = asString(args.sourceAttachment?.mimetype) || null;
  const imageFragmentUrl = sourceStorageSignedUrl || sourceStorageUri || null;
  await admin.firestore().collection("pending_actions").doc(pendingId).set(
    {
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
    },
    { merge: true }
  );
}

function buildSyncReviewTitle(event: ClinicalEventExtraction): string {
  const eventLabel: Record<EventType, string> = {
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

function buildReviewReasonCopy(reason: string): string {
  const normalized = normalizeClinicalToken(reason);
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

function buildSyncReviewSubtitle(args: {
  sourceEmailId: string;
  event: ClinicalEventExtraction;
  narrativeSummary: string;
  reason: string;
}): string {
  return `Email ${args.sourceEmailId.slice(0, 8)} · ${buildReviewReasonCopy(args.reason)}`;
}

async function upsertSyncReviewPendingAction(args: {
  uid: string;
  petId: string | null;
  sessionId: string;
  sourceEmailId: string;
  event: ClinicalEventExtraction;
  narrativeSummary: string;
  reason: string;
  gmailReviewId: string;
  generatedFromEventId?: string | null;
  sourceAttachment?: AttachmentMetadata | null;
}): Promise<void> {
  if (!args.petId) return;

  const pendingId = `sync_review_${args.gmailReviewId}`;
  const nowIso = getNowIso();
  const sourceStorageUri = asString(args.sourceAttachment?.storage_uri) || null;
  const sourceStoragePath = asString(args.sourceAttachment?.storage_path) || null;
  const sourceStorageSignedUrl = asString(args.sourceAttachment?.storage_signed_url) || null;
  const sourceFileName = asString(args.sourceAttachment?.filename) || null;
  const sourceMimeType = asString(args.sourceAttachment?.mimetype) || null;
  const imageFragmentUrl = sourceStorageSignedUrl || sourceStorageUri || null;

  await admin.firestore().collection("pending_actions").doc(pendingId).set(
    {
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
    },
    { merge: true }
  );
}

function normalizeSemanticText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function jaccardSimilarity(a: string, b: string): number {
  const tokensA = new Set(normalizeSemanticText(a).split(" ").filter((token) => token.length >= 3));
  const tokensB = new Set(normalizeSemanticText(b).split(" ").filter((token) => token.length >= 3));
  if (tokensA.size === 0 || tokensB.size === 0) return 0;
  let intersection = 0;
  for (const token of tokensA) {
    if (tokensB.has(token)) intersection += 1;
  }
  const union = new Set([...tokensA, ...tokensB]).size;
  return union > 0 ? intersection / union : 0;
}

function dateProximityScore(dateA: string | null, dateB: string | null): number {
  const a = parseDateOnly(dateA);
  const b = parseDateOnly(dateB);
  if (!a || !b) return 0.35;
  const diffDays = Math.abs(a.getTime() - b.getTime()) / ONE_DAY_MS;
  if (diffDays <= 1) return 1;
  if (diffDays <= 3) return 0.85;
  if (diffDays <= 7) return 0.7;
  return 0;
}

async function detectSemanticDuplicateCandidate(args: {
  uid: string;
  petId: string | null;
  event: ClinicalEventExtraction;
  sourceSender: string;
}): Promise<{ isLikelyDuplicate: boolean; score: number }> {
  const petId = args.petId || "";
  if (!petId) return { isLikelyDuplicate: false, score: 0 };

  const candidateCollections = [
    { name: "medical_events", dateField: "eventDate", diagnosisField: "diagnosis", clinicField: "sourceSender" },
    { name: "treatments", dateField: "startDate", diagnosisField: "clinical_indication", clinicField: "clinic_name" },
    { name: "medications", dateField: "startDate", diagnosisField: "indication", clinicField: "prescribedBy" },
  ];

  let maxScore = 0;
  const eventDate = args.event.event_date || null;
  const medicationName = args.event.medications[0]?.name || "";
  const diagnosis = args.event.diagnosis || args.event.description_summary;

  for (const coll of candidateCollections) {
    const snap = await admin
      .firestore()
      .collection(coll.name)
      .where("petId", "==", petId)
      .limit(40)
      .get();

    for (const doc of snap.docs) {
      const row = asRecord(doc.data());
      const extractedData = asRecord(row.extractedData);
      const extractedMedications = Array.isArray(extractedData.medications)
        ? extractedData.medications
          .map((med) => {
            const medRow = asRecord(med);
            return asString(medRow.name) || asString(medRow.medication) || asString(medRow.drug);
          })
          .filter(Boolean)
          .join(" ")
        : asString(extractedData.medications);
      const existingDate = asString(row[coll.dateField]) || null;
      const existingMedication =
        asString(row.name) ||
        asString(row.treatment_name) ||
        extractedMedications ||
        "";
      const existingDiagnosis =
        asString(row[coll.diagnosisField]) ||
        asString(row.title) ||
        asString(extractedData.diagnosis) ||
        "";
      const existingClinic = asString(row[coll.clinicField]) || asString(asRecord(row.source).sender) || "";

      const medicationScore = medicationName
        ? jaccardSimilarity(medicationName, existingMedication || existingDiagnosis)
        : 0.5;
      const dateScore = dateProximityScore(eventDate, existingDate);
      const diagnosisScore = jaccardSimilarity(diagnosis, existingDiagnosis || existingMedication);
      const clinicScore = jaccardSimilarity(args.sourceSender, existingClinic);

      const total = (medicationScore * 0.35) + (dateScore * 0.3) + (diagnosisScore * 0.25) + (clinicScore * 0.1);
      if (total > maxScore) maxScore = total;
    }
  }

  return {
    isLikelyDuplicate: maxScore >= 0.78,
    score: Math.round(maxScore * 100),
  };
}

async function isDuplicateEventByFingerprint(args: {
  uid: string;
  petId: string | null;
  event: ClinicalEventExtraction;
}): Promise<boolean> {
  const keyParts = [
    args.uid,
    args.petId || "no_pet",
    args.event.event_type,
    args.event.event_date || "no_date",
    normalizeForHash(args.event.description_summary).slice(0, 180),
  ];
  const hash = sha256(keyParts.join("|"));
  const ref = admin.firestore().collection("gmail_event_fingerprints").doc(hash);
  const snap = await ref.get();
  if (snap.exists) {
    return true;
  }
  await ref.set(
    {
      user_id: args.uid,
      pet_id: args.petId,
      event_type: args.event.event_type,
      event_date: args.event.event_date,
      summary: args.event.description_summary.slice(0, 250),
      created_at: getNowIso(),
    },
    { merge: true }
  );
  return false;
}

async function storeKnowledgeSignal(args: {
  uid: string;
  petId: string | null;
  sessionId: string;
  event: ClinicalEventExtraction;
  extractionConfidence: number;
  originalConfidence: number;
  userEdits?: Record<string, unknown> | null;
  validatedByHuman?: boolean;
  validationStatus?: "pending_human_review" | "auto_ingested_unconfirmed" | "duplicate_candidate";
  sourceTruthLevel?: "review_queue" | "ai_auto_ingested" | "human_confirmed";
  requiresManualConfirmation?: boolean;
}): Promise<void> {
  const key = sha256(
    [
      args.uid,
      args.petId || "no_pet",
      args.sessionId,
      args.event.event_type,
      args.event.event_date || "no_date",
      normalizeForHash(args.event.description_summary).slice(0, 180),
    ].join("|")
  );

  await admin.firestore().collection("structured_medical_dataset").doc(key).set(
    {
      user_id: args.uid,
      pet_id: args.petId || null,
      session_id: args.sessionId,
      validated_event: args.event,
      user_edits_if_any: args.userEdits || null,
      extraction_confidence: clamp(args.extractionConfidence, 0, 100),
      original_confidence: clamp(args.originalConfidence, 0, 100),
      validated_by_human: args.validatedByHuman === true,
      validation_status: args.validationStatus || "pending_human_review",
      source_truth_level: args.sourceTruthLevel || "review_queue",
      requires_manual_confirmation: args.requiresManualConfirmation !== false,
      is_training_eligible: args.validatedByHuman === true,
      created_at: getNowIso(),
    },
    { merge: true }
  );
}

function mapEventTypeToBrainCategory(eventType: EventType): string {
  if (eventType === "prescription_record") return "Medication";
  if (eventType === "vaccination_record") return "Vaccine";
  if (eventType === "study_report") return "Diagnostic";
  return "ClinicalEvent";
}

function inferBrainCategoryFromSubject(subject: string): string {
  const normalized = normalizeForHash(subject);
  if (/\b(vacuna|vaccine|revacuna)\b/.test(normalized)) return "Vaccine";
  if (/\b(receta|prescrip|medicaci[oó]n|medication|tratamiento)\b/.test(normalized)) return "Medication";
  if (/\b(laboratorio|analisis|an[aá]lisis|ecograf|radiograf|resultado)\b/.test(normalized)) return "Diagnostic";
  return "ClinicalEvent";
}

function buildBrainEntitiesFromEvent(event: ClinicalEventExtraction): Array<Record<string, unknown>> {
  const entities: Array<Record<string, unknown>> = [];

  if (event.diagnosis) {
    entities.push({
      type: "diagnosis",
      value: event.diagnosis,
      confidence: clamp(event.confidence_score / 100, 0, 1),
    });
  }

  for (const medication of event.medications) {
    entities.push({
      type: "medication",
      name: asString(medication.name) || null,
      dose: asString(medication.dose) || null,
      frequency: asString(medication.frequency) || null,
      duration_days: medication.duration_days,
      is_active: medication.is_active,
      confidence: clamp(event.confidence_score / 100, 0, 1),
    });
  }

  for (const lab of event.lab_results) {
    entities.push({
      type: "lab_result",
      test_name: asString(lab.test_name) || null,
      result: asString(lab.result) || null,
      unit: asString(lab.unit) || null,
      reference_range: asString(lab.reference_range) || null,
      confidence: clamp(event.confidence_score / 100, 0, 1),
    });
  }

  if (entities.length === 0) {
    entities.push({
      type: "summary",
      value: event.description_summary.slice(0, 500),
      confidence: clamp(event.confidence_score / 100, 0, 1),
    });
  }

  return entities;
}

async function mirrorBrainResolution(args: {
  uid: string;
  petReference?: string | null;
  petIdHint?: string | null;
  category: string;
  entities: Array<Record<string, unknown>>;
  confidence01: number;
  reviewRequired: boolean;
  reasonIfReviewNeeded?: string | null;
  sourceMetadata: Record<string, unknown>;
}): Promise<void> {
  try {
    await resolveBrainOutput({
      userId: args.uid,
      brainOutput: {
        pet_reference: asString(args.petReference) || null,
        category: args.category,
        entities: args.entities,
        confidence: clamp(args.confidence01, 0, 1),
        review_required: args.reviewRequired,
        reason_if_review_needed: asString(args.reasonIfReviewNeeded) || null,
        ui_hint: asRecord(args.sourceMetadata.ui_hint),
      },
      sourceMetadata: {
        ...args.sourceMetadata,
        source: asString(args.sourceMetadata.source) || "gmail",
        pet_id_hint: asString(args.petIdHint) || null,
      },
    });
  } catch (error) {
    console.warn("[gmail-ingestion] brain resolver mirror failed:", error);
  }
}

function appointmentStatusToCollectionStatus(status: AppointmentEventStatus): "upcoming" | "completed" | "cancelled" {
  if (status === "cancelled") return "cancelled";
  return "upcoming";
}

async function findExistingOperationalAppointmentEvent(args: {
  petId: string;
  eventDate: string;
  appointmentTime: string | null;
  professionalName: string | null;
  clinicName: string | null;
  appointmentReason: string;
}): Promise<string | null> {
  const snap = await admin.firestore().collection("medical_events").where("petId", "==", args.petId).limit(60).get();
  let bestMatch: { id: string; score: number } | null = null;

  for (const doc of snap.docs) {
    const row = asRecord(doc.data());
    const extracted = asRecord(row.extractedData);
    if (asString(extracted.documentType) !== "appointment") continue;

    const existingDate = asString(extracted.eventDate) || asString(row.eventDate) || null;
    const existingTime = asString(extracted.appointmentTime) || null;
    const existingProvider = asString(extracted.provider) || "";
    const existingClinic = asString(extracted.clinic) || "";
    const existingReason =
      asString(extracted.suggestedTitle) ||
      asString(row.title) ||
      asString(asRecord((Array.isArray(extracted.detectedAppointments) ? extracted.detectedAppointments[0] : null)).title) ||
      "";

    const dateScore = existingDate === args.eventDate ? 1 : dateProximityScore(args.eventDate, existingDate);
    const timeScore =
      args.appointmentTime && existingTime
        ? (args.appointmentTime === existingTime ? 1 : 0)
        : 0.35;
    const providerScore = args.professionalName ? jaccardSimilarity(args.professionalName, existingProvider) : 0.35;
    const clinicScore = args.clinicName ? jaccardSimilarity(args.clinicName, existingClinic) : 0.35;
    const reasonScore = args.appointmentReason ? jaccardSimilarity(args.appointmentReason, existingReason) : 0.35;
    const total = (dateScore * 0.4) + (timeScore * 0.2) + (providerScore * 0.15) + (clinicScore * 0.1) + (reasonScore * 0.15);

    if (!bestMatch || total > bestMatch.score) {
      bestMatch = { id: doc.id, score: total };
    }
  }

  return bestMatch && bestMatch.score >= 0.7 ? bestMatch.id : null;
}

async function upsertOperationalAppointmentProjection(args: {
  appointmentEventId: string;
  petId: string;
  uid: string;
  title: string;
  eventDate: string;
  event: ClinicalEventExtraction;
  narrativeSummary: string;
  sourceEmailId: string;
  sourceTruthLevel: string;
  effectiveRequiresConfirmation: boolean;
  nowIso: string;
}): Promise<void> {
  const existingAppointmentSnap = await admin
    .firestore()
    .collection("appointments")
    .where("sourceEventId", "==", args.appointmentEventId)
    .limit(1)
    .get();

  const appointmentId = existingAppointmentSnap.empty
    ? `gmail_appt_${sha256(args.appointmentEventId).slice(0, 16)}`
    : existingAppointmentSnap.docs[0].id;

  await admin.firestore().collection("appointments").doc(appointmentId).set(
    {
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
      status: appointmentStatusToCollectionStatus(args.event.appointment_status),
      notes: args.narrativeSummary.slice(0, 1200),
      createdAt: existingAppointmentSnap.empty ? args.nowIso : asString(existingAppointmentSnap.docs[0].get("createdAt")) || args.nowIso,
      updatedAt: args.nowIso,
      source: "email_import",
      source_email_id: args.sourceEmailId,
      requires_confirmation: args.effectiveRequiresConfirmation,
      source_truth_level: args.sourceTruthLevel,
      validated_by_human: false,
      protocolSnapshotFrozenAt: existingAppointmentSnap.empty
        ? args.nowIso
        : asString(existingAppointmentSnap.docs[0].get("protocolSnapshotFrozenAt")) || args.nowIso,
    },
    { merge: true }
  );
}

async function ingestEventToDomain(args: {
  uid: string;
  petId: string | null;
  sourceEmailId: string;
  sourceSubject: string;
  sourceSender: string;
  sourceDate: string;
  event: ClinicalEventExtraction;
  narrativeSummary: string;
  requiresConfirmation: boolean;
  reviewReason?: string | null;
  sourceAttachment?: AttachmentMetadata | null;
}): Promise<{
  domainType: DomainIngestionType;
  canonicalEventId: string;
  blockedMedicationCount: number;
}> {
  const nowIso = getNowIso();
  const petId = args.petId || "";
  const eventDate = args.event.event_date || toIsoDateOnly(new Date(args.sourceDate));
  const title = buildCanonicalEventTitle(args.event);
  const incompleteTreatmentMeds =
    isPrescriptionEventType(args.event.event_type)
      ? args.event.medications.filter((medication) => !medicationHasDoseAndFrequency(medication))
      : [];
  const hasIncompleteTreatmentMeds = incompleteTreatmentMeds.length > 0;
  const effectiveRequiresConfirmation = args.requiresConfirmation || hasIncompleteTreatmentMeds;
  const sourceTruthLevel = effectiveRequiresConfirmation ? "review_queue" : "ai_auto_ingested";
  const reviewReasons = effectiveRequiresConfirmation
    ? [asString(args.reviewReason) || (hasIncompleteTreatmentMeds ? "missing_treatment_dose_or_frequency" : "requires_review")]
    : [];
  const severityMap: Record<string, string> = { mild: "leve", moderate: "moderado", severe: "severo" };
  const severity = args.event.severity ? severityMap[args.event.severity] || null : null;
  const canonicalEventId = `gmail_evt_${sha256(
    `${args.uid}_${args.sourceEmailId}_${args.event.event_type}_${eventDate}_${title}`
  ).slice(0, 20)}`;
  const extractedData = buildDefaultExtractedData({
    event: args.event,
    sourceDate: args.sourceDate,
    sourceSubject: args.sourceSubject,
    sourceSender: args.sourceSender,
    sourceAttachment: args.sourceAttachment,
  });
  const sourceSignedUrl = asString(args.sourceAttachment?.storage_signed_url) || "";
  const sourceMimeType = asString(args.sourceAttachment?.mimetype).toLowerCase();
  const inferredFileType = sourceMimeType.includes("pdf") ? "pdf" : sourceMimeType.startsWith("image/") ? "image" : "pdf";
  const treatmentMissingFields = incompleteTreatmentMeds.map((medication) => ({
    medication: asString(medication.name) || null,
    missingDose: !asString(medication.dose),
    missingFrequency: !asString(medication.frequency),
  }));
  const appointmentReason =
    asString((Array.isArray(extractedData.detectedAppointments) ? asRecord(extractedData.detectedAppointments[0]) : {}).title) ||
    title;
  const existingAppointmentEventId =
    petId && isAppointmentEventType(args.event.event_type)
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
  const secondaryAppointmentCandidate = !isAppointmentEventType(args.event.event_type)
    ? extractOperationalAppointmentCandidate({
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
  await medicalEventRef.set(
    {
      id: effectiveCanonicalEventId,
      petId,
      userId: args.uid,
      title: title.slice(0, 160),
      documentUrl: sourceSignedUrl,
      documentPreviewUrl: sourceSignedUrl || null,
      fileName: asString(args.sourceAttachment?.filename) || "email_import",
      fileType: inferredFileType,
      status: effectiveRequiresConfirmation ? "draft" : "completed",
      workflowStatus: effectiveRequiresConfirmation ? "review_required" : "confirmed",
      requiresManualConfirmation: effectiveRequiresConfirmation,
      reviewReasons,
      validatedByHuman: false,
      sourceTruthLevel: sourceTruthLevel,
      truthStatus: effectiveRequiresConfirmation ? "pending_human_review" : "auto_ingested_unconfirmed",
      overallConfidence: args.event.confidence_score,
      extractedData: {
        ...extractedData,
        treatmentValidationStatus: hasIncompleteTreatmentMeds ? "needs_review" : "complete",
        treatmentMissingFields,
      },
      ocrProcessed: true,
      aiProcessed: true,
      createdAt: existingMedicalEventSnap?.exists ? asString(existingMedicalEventSnap.get("createdAt")) || nowIso : nowIso,
      updatedAt: nowIso,
      protocolSnapshotFrozenAt: existingMedicalEventSnap?.exists
        ? asString(existingMedicalEventSnap.get("protocolSnapshotFrozenAt")) || nowIso
        : nowIso,
      relatedEventIds: existingMedicalEventSnap?.exists
        ? existingMedicalEventSnap.get("relatedEventIds") || []
        : [],
      aiSuggestedRelation: null,
      source: "email_import",
      source_email_id: args.sourceEmailId,
      latest_source_email_id: args.sourceEmailId,
      source_email_ids: admin.firestore.FieldValue.arrayUnion(args.sourceEmailId),
      domain_ingestion_type:
        isVaccinationEventType(args.event.event_type)
          ? "vaccination"
          : isAppointmentEventType(args.event.event_type)
            ? "appointment"
            : hasIncompleteTreatmentMeds
            ? "medical_event"
            : isPrescriptionEventType(args.event.event_type)
              ? "treatment"
              : "medical_event",
      severity,
      findings:
        args.event.lab_results.length > 0
          ? args.event.lab_results.map((row) => `${row.test_name}: ${row.result}`).join(" | ").slice(0, 1400)
          : null,
    },
    { merge: true }
  );

  if (isAppointmentEventType(args.event.event_type)) {
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
      title: buildCanonicalEventTitle(secondaryAppointmentCandidate),
      eventDate,
      event: secondaryAppointmentCandidate,
      narrativeSummary: cleanSentence(
        [args.narrativeSummary, args.sourceSubject, title].filter(Boolean).join(" · ")
      ),
      sourceEmailId: args.sourceEmailId,
      sourceTruthLevel,
      effectiveRequiresConfirmation,
      nowIso,
    });
  }

  if (isPrescriptionEventType(args.event.event_type)) {
    if (hasIncompleteTreatmentMeds) {
      return {
        domainType: "medical_event",
        canonicalEventId: effectiveCanonicalEventId,
        blockedMedicationCount: incompleteTreatmentMeds.length,
      };
    }

    const eventStartDate = parseDateOnly(eventDate) || new Date(args.sourceDate);
    for (const medication of args.event.medications) {
      const medName = asString(medication.name) || "medication";
      const trtId = `gmail_trt_${sha256(`${args.uid}_${args.sourceEmailId}_${medName}`).slice(0, 18)}`;
      const computedEndDate = medication.duration_days
        ? new Date(eventStartDate.getTime() + medication.duration_days * ONE_DAY_MS)
        : null;
      await admin.firestore().collection("treatments").doc(trtId).set(
        {
          id: trtId,
          petId,
          userId: args.uid,
          ownerId: args.uid,
          normalizedName: normalizeForHash(medName),
          startDate: eventDate,
          endDate: computedEndDate ? toIsoDateOnly(computedEndDate) : null,
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
        },
        { merge: true }
      );

      const medId = `gmail_med_${sha256(`${args.uid}_${args.sourceEmailId}_${medName}`).slice(0, 18)}`;
      await admin.firestore().collection("medications").doc(medId).set(
        {
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
        },
        { merge: true }
      );
    }
    return {
      domainType: "treatment",
      canonicalEventId: effectiveCanonicalEventId,
      blockedMedicationCount: 0,
    };
  }

  return {
    domainType: isVaccinationEventType(args.event.event_type) ? "vaccination" : "medical_event",
    canonicalEventId: effectiveCanonicalEventId,
    blockedMedicationCount: 0,
  };
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
    const aiHandled = await runSessionStageWorkers({
      stage: "ai_extract",
      sessionId: args.sessionId,
      limit: FORCE_DRAIN_MAX_JOBS_PER_STAGE,
      lockPrefix: "ai",
      handler: processAiQueueJob,
    });
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

    const handledThisTick = scanHandled + aiHandled + attachmentHandled + aiHandledAfterAttachment;
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
