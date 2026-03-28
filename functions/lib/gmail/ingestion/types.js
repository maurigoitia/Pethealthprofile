"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LEGACY_GENERIC_TITLES = exports.MEDICATION_NAME_BLOCKLIST = exports.ANATOMICAL_MEASUREMENT_HINT_REGEX = exports.STRUCTURED_DIAGNOSIS_HINT_REGEX = exports.HISTORICAL_ONLY_SIGNAL_REGEX = exports.MEDICATION_DOSING_HINT_REGEX = exports.MEDICATION_UNIT_ONLY_REGEX = exports.DEFAULT_HUMAN_BLOCKED_SENDER_DOMAINS = exports.MAX_EXTERNAL_LINK_REDIRECTS_HARD_CAP = exports.DEFAULT_EXTERNAL_LINK_MAX_REDIRECTS = exports.DEFAULT_EXTERNAL_LINK_MAX_BYTES = exports.DEFAULT_EXTERNAL_LINK_FETCH_TIMEOUT_MS = exports.MAX_EXTERNAL_LINKS_PER_EMAIL_HARD_CAP = exports.DEFAULT_MAX_EXTERNAL_LINKS_PER_EMAIL = exports.FORCE_DRAIN_MAX_JOBS_PER_STAGE = exports.FORCE_DRAIN_MAX_WAIT_MS = exports.FORCE_DRAIN_POLL_MS = exports.STALE_ACTIVE_SESSION_MS = exports.STALE_PROCESSING_SCAN_FACTOR = exports.STALE_PROCESSING_JOB_MS = exports.LOW_RESULT_FALLBACK_MAX_CANDIDATES = exports.LOW_RESULT_FALLBACK_MAX_SCANNED = exports.JOB_RETRY_DELAYS_MS = exports.MAX_JOB_ATTEMPTS = exports.MAX_AI_WORKERS_PER_TICK = exports.MAX_ATTACHMENT_WORKERS_PER_TICK = exports.MAX_SCAN_WORKERS_PER_TICK = exports.RAW_DOCUMENT_TTL_MS = exports.GMAIL_SCOPE_READONLY = exports.CLASSIFICATION_AI_TIMEOUT_MS = exports.CLINICAL_AI_TIMEOUT_MS = exports.OCR_TIMEOUT_MS = exports.MONTHLY_BUCKET_UNTIL_MONTHS = exports.RECENT_HISTORY_WINDOW_DAYS = exports.MAX_EXTERNAL_LINK_TEXT_CHARS = exports.MIN_LIGHTWEIGHT_BODY_LENGTH = exports.MAX_AI_DOCUMENT_TEXT_CHARS = exports.FREE_PLAN_ATTACHMENT_PROCESS_LIMIT = exports.ONE_DAY_MS = exports.SESSION_AUDIT_RETENTION_DAYS = exports.DEDUP_WINDOW_DAYS = exports.MAX_ATTACHMENTS_PER_EMAIL = exports.MAX_ATTACHMENT_SIZE_BYTES = exports.MAX_CONCURRENT_EXTRACTION_JOBS = exports.DEFAULT_BATCH_SIZE = exports.FREE_PLAN_MAX_EMAILS_PER_SYNC = exports.MAX_EMAILS_PER_USER_PER_DAY = exports.GMAIL_API_BASE_URL = exports.GOOGLE_GMAIL_PROFILE_URL = exports.GOOGLE_TOKEN_URL = void 0;
exports.LEGACY_SALVAGE_STUDY_REGEX = exports.LEGACY_OPERATIONAL_NOISE_REGEX = exports.LEGACY_DELETE_DOMAIN_HINTS = void 0;
// ── API URLs ──────────────────────────────────────────────────────────────────
exports.GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
exports.GOOGLE_GMAIL_PROFILE_URL = "https://gmail.googleapis.com/gmail/v1/users/me/profile";
exports.GMAIL_API_BASE_URL = "https://gmail.googleapis.com/gmail/v1/users/me";
// ── Quotas & Rate Limits ─────────────────────────────────────────────────────
exports.MAX_EMAILS_PER_USER_PER_DAY = 500;
exports.FREE_PLAN_MAX_EMAILS_PER_SYNC = 300;
exports.DEFAULT_BATCH_SIZE = 20;
exports.MAX_CONCURRENT_EXTRACTION_JOBS = 20;
exports.MAX_ATTACHMENT_SIZE_BYTES = 25 * 1024 * 1024;
exports.MAX_ATTACHMENTS_PER_EMAIL = 10;
exports.DEDUP_WINDOW_DAYS = 30;
exports.SESSION_AUDIT_RETENTION_DAYS = 90;
exports.ONE_DAY_MS = 24 * 60 * 60 * 1000;
exports.FREE_PLAN_ATTACHMENT_PROCESS_LIMIT = 20;
exports.MAX_AI_DOCUMENT_TEXT_CHARS = 120000;
exports.MIN_LIGHTWEIGHT_BODY_LENGTH = 140;
exports.MAX_EXTERNAL_LINK_TEXT_CHARS = 120000;
exports.RECENT_HISTORY_WINDOW_DAYS = 90;
exports.MONTHLY_BUCKET_UNTIL_MONTHS = 18;
// ── Timeouts ─────────────────────────────────────────────────────────────────
exports.OCR_TIMEOUT_MS = 120000;
exports.CLINICAL_AI_TIMEOUT_MS = 15000;
exports.CLASSIFICATION_AI_TIMEOUT_MS = 7000;
// ── Gmail ────────────────────────────────────────────────────────────────────
exports.GMAIL_SCOPE_READONLY = "https://www.googleapis.com/auth/gmail.readonly";
exports.RAW_DOCUMENT_TTL_MS = 1 * exports.ONE_DAY_MS; // 24h — destrucción rápida por privacidad
// ── Workers ──────────────────────────────────────────────────────────────────
exports.MAX_SCAN_WORKERS_PER_TICK = 1;
exports.MAX_ATTACHMENT_WORKERS_PER_TICK = 2;
exports.MAX_AI_WORKERS_PER_TICK = 2;
// ── Job Retry ────────────────────────────────────────────────────────────────
exports.MAX_JOB_ATTEMPTS = 5;
exports.JOB_RETRY_DELAYS_MS = [
    15 * 60 * 1000, // 15m
    60 * 60 * 1000, // 1h
    24 * 60 * 60 * 1000, // 24h
    24 * 60 * 60 * 1000, // +24h (48h total)
];
exports.LOW_RESULT_FALLBACK_MAX_SCANNED = 3;
exports.LOW_RESULT_FALLBACK_MAX_CANDIDATES = 1;
exports.STALE_PROCESSING_JOB_MS = 5 * 60 * 1000;
exports.STALE_PROCESSING_SCAN_FACTOR = 6;
exports.STALE_ACTIVE_SESSION_MS = 60 * 60 * 1000;
exports.FORCE_DRAIN_POLL_MS = 1200;
exports.FORCE_DRAIN_MAX_WAIT_MS = 4 * 60 * 1000;
exports.FORCE_DRAIN_MAX_JOBS_PER_STAGE = 30;
// ── External Links ───────────────────────────────────────────────────────────
exports.DEFAULT_MAX_EXTERNAL_LINKS_PER_EMAIL = 2;
exports.MAX_EXTERNAL_LINKS_PER_EMAIL_HARD_CAP = 5;
exports.DEFAULT_EXTERNAL_LINK_FETCH_TIMEOUT_MS = 9000;
exports.DEFAULT_EXTERNAL_LINK_MAX_BYTES = 6 * 1024 * 1024;
exports.DEFAULT_EXTERNAL_LINK_MAX_REDIRECTS = 4;
exports.MAX_EXTERNAL_LINK_REDIRECTS_HARD_CAP = 8;
// ── Domain Lists ─────────────────────────────────────────────────────────────
exports.DEFAULT_HUMAN_BLOCKED_SENDER_DOMAINS = [
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
exports.MEDICATION_UNIT_ONLY_REGEX = /^(?:\d+(?:[.,]\d+)?\s*)?(?:ml|mm|cm|kg|g|mg|mcg|ug|%|cc|x|comp(?:rimidos?)?)$/i;
exports.MEDICATION_DOSING_HINT_REGEX = /\b(cada|hora|horas|hs|comprim|capsul|tableta|pastilla|jarabe|gotas|inyec|ampolla|sobres?)\b/i;
exports.HISTORICAL_ONLY_SIGNAL_REGEX = /\b(desde\s+\d{4}|historic[oa]|revacun|calendario\s+de\s+vacun|esquema\s+de\s+vacun|vigencia|desde\s+hace|informaci[oó]n\s+general|referencia\s+hist[oó]rica)\b/i;
exports.STRUCTURED_DIAGNOSIS_HINT_REGEX = /\b(cardiomegalia|cardiomiopat|dcm|hepatomegalia|esplenitis|esplenomegalia|fractura|luxaci[oó]n|insuficien|neoplas|masa|dermatitis|otitis|gastritis|nefritis|dilataci[oó]n)\b/i;
exports.ANATOMICAL_MEASUREMENT_HINT_REGEX = /\b(prostata|prost[aá]tica|vol(?:umen)?|diametr|medida|eje|vejiga|renal|ri[nñ]on|ri[nñ]ones|hep[aá]tic|h[ií]gado|espl[eé]nic|bazo|coraz[oó]n|tor[aá]x|abdomen|pelvis|femoral|aur[ií]cula|ventr[ií]cul)\b/i;
exports.MEDICATION_NAME_BLOCKLIST = new Set([
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
exports.LEGACY_GENERIC_TITLES = new Set([
    "diagnostico detectado por correo",
    "estudio detectado por correo",
    "documento",
    "documento detectado por correo",
    "turno programado",
    "resultado de laboratorio",
    "informe de estudio",
    "diagnostico",
]);
exports.LEGACY_DELETE_DOMAIN_HINTS = [
    "huesped.org",
    "ikeargentina.com",
    "osde",
    "swissmedical",
    "medicus",
    "galeno",
    "omint",
    "afip",
];
exports.LEGACY_OPERATIONAL_NOISE_REGEX = /\b(tipo detectado:\s*cancelacion|tipo detectado:\s*recordatorio_turno|tipo detectado:\s*confirmacion_turno|recordatorio del turno|informacion de turno solicitado|información de turno solicitado|turno confirmado|turno cancelado|reprogramacion|reprogramación|recordatorio de turno|cancelacion de turno|cancelación de turno)\b/i;
exports.LEGACY_SALVAGE_STUDY_REGEX = /\b(radiograf(?:ia|ias)?|rx\b|placa(?:s)?\s+de\s+t[oó]rax|ecograf(?:ia|ias)?|ultrason(?:ido)?|ultrasound|ecg|electrocardiograma|electrocardiograf|informe radiol[oó]gico|bronquitis|cardiomegalia|hepatomegalia|esplenitis|enfermedad discal|koh\b|microscop[ií]a|hemograma|bioqu[ií]mica|laboratorio)\b/i;
//# sourceMappingURL=types.js.map