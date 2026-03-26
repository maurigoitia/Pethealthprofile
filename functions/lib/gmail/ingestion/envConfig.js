"use strict";
/**
 * Environment configuration helpers for the Gmail clinical-ingestion pipeline.
 *
 * Every getter reads from `process.env` with a sensible default and clamped
 * range so the system stays within safe operational bounds even when an
 * operator fat-fingers a value.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getBoundedIntFromEnv = getBoundedIntFromEnv;
exports.getPremiumPlanMaxEmailsPerSync = getPremiumPlanMaxEmailsPerSync;
exports.getFreePlanMaxEmailsPerSync = getFreePlanMaxEmailsPerSync;
exports.getScanBatchSize = getScanBatchSize;
exports.getMaxConcurrentExtractionJobs = getMaxConcurrentExtractionJobs;
exports.getScanWorkersPerTick = getScanWorkersPerTick;
exports.getAttachmentWorkersPerTick = getAttachmentWorkersPerTick;
exports.getAiWorkersPerTick = getAiWorkersPerTick;
exports.getMaxExternalLinksPerEmail = getMaxExternalLinksPerEmail;
exports.getExternalLinkFetchTimeoutMs = getExternalLinkFetchTimeoutMs;
exports.getExternalLinkMaxBytes = getExternalLinkMaxBytes;
exports.getExternalLinkMaxRedirects = getExternalLinkMaxRedirects;
exports.isExternalLinkFetchEnabled = isExternalLinkFetchEnabled;
exports.isAttachmentStorageEnabled = isAttachmentStorageEnabled;
exports.getAutoIngestConfidenceThreshold = getAutoIngestConfidenceThreshold;
exports.getSilentApprovalWindowHours = getSilentApprovalWindowHours;
exports.parseDomainListEnv = parseDomainListEnv;
exports.parseEmailListEnv = parseEmailListEnv;
exports.getQaAllowedUserEmails = getQaAllowedUserEmails;
exports.isEmailAllowedForQa = isEmailAllowedForQa;
exports.isSmartPetMatchingEnabled = isSmartPetMatchingEnabled;
exports.domainMatches = domainMatches;
const types_1 = require("./types");
const utils_1 = require("./utils");
// ---------------------------------------------------------------------------
// Core bounded-int helper
// ---------------------------------------------------------------------------
function getBoundedIntFromEnv(name, fallback, min, max) {
    const raw = Number(process.env[name] || fallback);
    if (!Number.isFinite(raw))
        return fallback;
    return (0, utils_1.clamp)(Math.round(raw), min, max);
}
// ---------------------------------------------------------------------------
// Plan limits
// ---------------------------------------------------------------------------
function getPremiumPlanMaxEmailsPerSync() {
    return getBoundedIntFromEnv("GMAIL_PREMIUM_MAX_EMAILS_PER_SYNC", types_1.MAX_EMAILS_PER_USER_PER_DAY, 25, 5000);
}
function getFreePlanMaxEmailsPerSync() {
    return getBoundedIntFromEnv("GMAIL_FREE_MAX_EMAILS_PER_SYNC", types_1.FREE_PLAN_MAX_EMAILS_PER_SYNC, 25, 1000);
}
// ---------------------------------------------------------------------------
// Batch / concurrency knobs
// ---------------------------------------------------------------------------
function getScanBatchSize() {
    return getBoundedIntFromEnv("GMAIL_SCAN_BATCH_SIZE", types_1.DEFAULT_BATCH_SIZE, 5, 100);
}
function getMaxConcurrentExtractionJobs() {
    return getBoundedIntFromEnv("GMAIL_MAX_CONCURRENT_EXTRACTION_JOBS", types_1.MAX_CONCURRENT_EXTRACTION_JOBS, 1, 200);
}
function getScanWorkersPerTick() {
    return getBoundedIntFromEnv("GMAIL_SCAN_WORKERS_PER_TICK", types_1.MAX_SCAN_WORKERS_PER_TICK, 1, 10);
}
function getAttachmentWorkersPerTick() {
    return getBoundedIntFromEnv("GMAIL_ATTACHMENT_WORKERS_PER_TICK", types_1.MAX_ATTACHMENT_WORKERS_PER_TICK, 1, 12);
}
function getAiWorkersPerTick() {
    return getBoundedIntFromEnv("GMAIL_AI_WORKERS_PER_TICK", types_1.MAX_AI_WORKERS_PER_TICK, 1, 12);
}
// ---------------------------------------------------------------------------
// External-link fetching
// ---------------------------------------------------------------------------
function getMaxExternalLinksPerEmail() {
    return getBoundedIntFromEnv("GMAIL_MAX_EXTERNAL_LINKS_PER_EMAIL", types_1.DEFAULT_MAX_EXTERNAL_LINKS_PER_EMAIL, 0, types_1.MAX_EXTERNAL_LINKS_PER_EMAIL_HARD_CAP);
}
function getExternalLinkFetchTimeoutMs() {
    return getBoundedIntFromEnv("GMAIL_EXTERNAL_LINK_FETCH_TIMEOUT_MS", types_1.DEFAULT_EXTERNAL_LINK_FETCH_TIMEOUT_MS, 2000, 20000);
}
function getExternalLinkMaxBytes() {
    return getBoundedIntFromEnv("GMAIL_EXTERNAL_LINK_MAX_BYTES", types_1.DEFAULT_EXTERNAL_LINK_MAX_BYTES, 100000, 20 * 1024 * 1024);
}
function getExternalLinkMaxRedirects() {
    return getBoundedIntFromEnv("GMAIL_EXTERNAL_LINK_MAX_REDIRECTS", types_1.DEFAULT_EXTERNAL_LINK_MAX_REDIRECTS, 0, types_1.MAX_EXTERNAL_LINK_REDIRECTS_HARD_CAP);
}
function isExternalLinkFetchEnabled() {
    const raw = (0, utils_1.asString)(process.env.GMAIL_EXTERNAL_LINK_FETCH_ENABLED).toLowerCase();
    if (!raw)
        return true;
    return raw !== "false" && raw !== "0" && raw !== "no";
}
// ---------------------------------------------------------------------------
// Attachment storage
// ---------------------------------------------------------------------------
function isAttachmentStorageEnabled() {
    const raw = (0, utils_1.asString)(process.env.GMAIL_ATTACHMENT_GCS_ENABLED).toLowerCase();
    if (!raw)
        return true;
    return raw !== "false" && raw !== "0" && raw !== "no";
}
// ---------------------------------------------------------------------------
// Auto-ingest / silent approval
// ---------------------------------------------------------------------------
function getAutoIngestConfidenceThreshold() {
    const raw = Number(process.env.CLINICAL_AUTO_INGEST_MIN_CONFIDENCE || 85);
    if (!Number.isFinite(raw))
        return 85;
    return (0, utils_1.clamp)(raw, 70, 95);
}
function getSilentApprovalWindowHours() {
    const raw = Number(process.env.CLINICAL_SILENT_APPROVAL_WINDOW_HOURS || 24);
    if (!Number.isFinite(raw))
        return 24;
    return (0, utils_1.clamp)(raw, 1, 168);
}
// ---------------------------------------------------------------------------
// Domain / email list parsing
// ---------------------------------------------------------------------------
function parseDomainListEnv(name) {
    return (0, utils_1.asString)(process.env[name])
        .toLowerCase()
        .split(/[,\n;]+/g)
        .map((item) => item.trim())
        .filter((item) => Boolean(item) && /[a-z0-9-]+\.[a-z]{2,}/i.test(item))
        .map((item) => item.replace(/^\.+/, "").replace(/\.+$/, ""));
}
function parseEmailListEnv(name) {
    return (0, utils_1.asString)(process.env[name])
        .toLowerCase()
        .split(/[,\n;]+/g)
        .map((item) => item.trim())
        .filter((item) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(item));
}
// ---------------------------------------------------------------------------
// QA allow-list
// ---------------------------------------------------------------------------
function getQaAllowedUserEmails() {
    return parseEmailListEnv("GMAIL_QA_ALLOWED_USER_EMAILS");
}
function isEmailAllowedForQa(email) {
    const allowlist = getQaAllowedUserEmails();
    if (allowlist.length === 0)
        return true;
    return allowlist.includes((0, utils_1.asString)(email).toLowerCase());
}
// ---------------------------------------------------------------------------
// Feature flags
// ---------------------------------------------------------------------------
function isSmartPetMatchingEnabled() {
    const raw = (0, utils_1.asString)(process.env.GMAIL_SMART_PET_MATCH_ENABLED).toLowerCase();
    return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}
// ---------------------------------------------------------------------------
// Domain matching utility
// ---------------------------------------------------------------------------
function domainMatches(domain, candidate) {
    return domain === candidate || domain.endsWith(`.${candidate}`);
}
//# sourceMappingURL=envConfig.js.map