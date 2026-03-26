/**
 * Environment configuration helpers for the Gmail clinical-ingestion pipeline.
 *
 * Every getter reads from `process.env` with a sensible default and clamped
 * range so the system stays within safe operational bounds even when an
 * operator fat-fingers a value.
 */

import {
  DEFAULT_BATCH_SIZE,
  DEFAULT_EXTERNAL_LINK_FETCH_TIMEOUT_MS,
  DEFAULT_EXTERNAL_LINK_MAX_BYTES,
  DEFAULT_EXTERNAL_LINK_MAX_REDIRECTS,
  DEFAULT_MAX_EXTERNAL_LINKS_PER_EMAIL,
  FREE_PLAN_MAX_EMAILS_PER_SYNC,
  MAX_AI_WORKERS_PER_TICK,
  MAX_ATTACHMENT_WORKERS_PER_TICK,
  MAX_CONCURRENT_EXTRACTION_JOBS,
  MAX_EMAILS_PER_USER_PER_DAY,
  MAX_EXTERNAL_LINKS_PER_EMAIL_HARD_CAP,
  MAX_EXTERNAL_LINK_REDIRECTS_HARD_CAP,
  MAX_SCAN_WORKERS_PER_TICK,
} from "./types";

import { asString, clamp } from "./utils";

// ---------------------------------------------------------------------------
// Core bounded-int helper
// ---------------------------------------------------------------------------

export function getBoundedIntFromEnv(name: string, fallback: number, min: number, max: number): number {
  const raw = Number(process.env[name] || fallback);
  if (!Number.isFinite(raw)) return fallback;
  return clamp(Math.round(raw), min, max);
}

// ---------------------------------------------------------------------------
// Plan limits
// ---------------------------------------------------------------------------

export function getPremiumPlanMaxEmailsPerSync(): number {
  return getBoundedIntFromEnv("GMAIL_PREMIUM_MAX_EMAILS_PER_SYNC", MAX_EMAILS_PER_USER_PER_DAY, 25, 5000);
}

export function getFreePlanMaxEmailsPerSync(): number {
  return getBoundedIntFromEnv("GMAIL_FREE_MAX_EMAILS_PER_SYNC", FREE_PLAN_MAX_EMAILS_PER_SYNC, 25, 1000);
}

// ---------------------------------------------------------------------------
// Batch / concurrency knobs
// ---------------------------------------------------------------------------

export function getScanBatchSize(): number {
  return getBoundedIntFromEnv("GMAIL_SCAN_BATCH_SIZE", DEFAULT_BATCH_SIZE, 5, 100);
}

export function getMaxConcurrentExtractionJobs(): number {
  return getBoundedIntFromEnv("GMAIL_MAX_CONCURRENT_EXTRACTION_JOBS", MAX_CONCURRENT_EXTRACTION_JOBS, 1, 200);
}

export function getScanWorkersPerTick(): number {
  return getBoundedIntFromEnv("GMAIL_SCAN_WORKERS_PER_TICK", MAX_SCAN_WORKERS_PER_TICK, 1, 10);
}

export function getAttachmentWorkersPerTick(): number {
  return getBoundedIntFromEnv("GMAIL_ATTACHMENT_WORKERS_PER_TICK", MAX_ATTACHMENT_WORKERS_PER_TICK, 1, 12);
}

export function getAiWorkersPerTick(): number {
  return getBoundedIntFromEnv("GMAIL_AI_WORKERS_PER_TICK", MAX_AI_WORKERS_PER_TICK, 1, 12);
}

// ---------------------------------------------------------------------------
// External-link fetching
// ---------------------------------------------------------------------------

export function getMaxExternalLinksPerEmail(): number {
  return getBoundedIntFromEnv(
    "GMAIL_MAX_EXTERNAL_LINKS_PER_EMAIL",
    DEFAULT_MAX_EXTERNAL_LINKS_PER_EMAIL,
    0,
    MAX_EXTERNAL_LINKS_PER_EMAIL_HARD_CAP
  );
}

export function getExternalLinkFetchTimeoutMs(): number {
  return getBoundedIntFromEnv("GMAIL_EXTERNAL_LINK_FETCH_TIMEOUT_MS", DEFAULT_EXTERNAL_LINK_FETCH_TIMEOUT_MS, 2000, 20_000);
}

export function getExternalLinkMaxBytes(): number {
  return getBoundedIntFromEnv("GMAIL_EXTERNAL_LINK_MAX_BYTES", DEFAULT_EXTERNAL_LINK_MAX_BYTES, 100_000, 20 * 1024 * 1024);
}

export function getExternalLinkMaxRedirects(): number {
  return getBoundedIntFromEnv(
    "GMAIL_EXTERNAL_LINK_MAX_REDIRECTS",
    DEFAULT_EXTERNAL_LINK_MAX_REDIRECTS,
    0,
    MAX_EXTERNAL_LINK_REDIRECTS_HARD_CAP
  );
}

export function isExternalLinkFetchEnabled(): boolean {
  const raw = asString(process.env.GMAIL_EXTERNAL_LINK_FETCH_ENABLED).toLowerCase();
  if (!raw) return true;
  return raw !== "false" && raw !== "0" && raw !== "no";
}

// ---------------------------------------------------------------------------
// Attachment storage
// ---------------------------------------------------------------------------

export function isAttachmentStorageEnabled(): boolean {
  const raw = asString(process.env.GMAIL_ATTACHMENT_GCS_ENABLED).toLowerCase();
  if (!raw) return true;
  return raw !== "false" && raw !== "0" && raw !== "no";
}

// ---------------------------------------------------------------------------
// Auto-ingest / silent approval
// ---------------------------------------------------------------------------

export function getAutoIngestConfidenceThreshold(): number {
  const raw = Number(process.env.CLINICAL_AUTO_INGEST_MIN_CONFIDENCE || 85);
  if (!Number.isFinite(raw)) return 85;
  return clamp(raw, 70, 95);
}

export function getSilentApprovalWindowHours(): number {
  const raw = Number(process.env.CLINICAL_SILENT_APPROVAL_WINDOW_HOURS || 24);
  if (!Number.isFinite(raw)) return 24;
  return clamp(raw, 1, 168);
}

// ---------------------------------------------------------------------------
// Domain / email list parsing
// ---------------------------------------------------------------------------

export function parseDomainListEnv(name: string): string[] {
  return asString(process.env[name])
    .toLowerCase()
    .split(/[,\n;]+/g)
    .map((item) => item.trim())
    .filter((item) => Boolean(item) && /[a-z0-9-]+\.[a-z]{2,}/i.test(item))
    .map((item) => item.replace(/^\.+/, "").replace(/\.+$/, ""));
}

export function parseEmailListEnv(name: string): string[] {
  return asString(process.env[name])
    .toLowerCase()
    .split(/[,\n;]+/g)
    .map((item) => item.trim())
    .filter((item) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(item));
}

// ---------------------------------------------------------------------------
// QA allow-list
// ---------------------------------------------------------------------------

export function getQaAllowedUserEmails(): string[] {
  return parseEmailListEnv("GMAIL_QA_ALLOWED_USER_EMAILS");
}

export function isEmailAllowedForQa(email: string): boolean {
  const allowlist = getQaAllowedUserEmails();
  if (allowlist.length === 0) return true;
  return allowlist.includes(asString(email).toLowerCase());
}

// ---------------------------------------------------------------------------
// Feature flags
// ---------------------------------------------------------------------------

export function isSmartPetMatchingEnabled(): boolean {
  const raw = asString(process.env.GMAIL_SMART_PET_MATCH_ENABLED).toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

// ---------------------------------------------------------------------------
// Domain matching utility
// ---------------------------------------------------------------------------

export function domainMatches(domain: string, candidate: string): boolean {
  return domain === candidate || domain.endsWith(`.${candidate}`);
}
