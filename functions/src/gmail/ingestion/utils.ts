import { createHash } from "crypto";
import { Transform } from "stream";

import type { UserPlanType } from "./types";

// ---------------------------------------------------------------------------
// Generic helpers
// ---------------------------------------------------------------------------

export function getNowIso(): string {
  return new Date().toISOString();
}

export function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

export function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function asNonNegativeNumber(value: unknown, fallback = 0): number {
  if (typeof value !== "number" || Number.isNaN(value) || value < 0) return fallback;
  return value;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// ---------------------------------------------------------------------------
// Clinical text helpers
// ---------------------------------------------------------------------------

export function hasNumericSignal(value: unknown): boolean {
  const text = asString(value);
  return /\d/.test(text);
}

export function sanitizeReferenceRange(referenceRange: unknown, resultValue: unknown): string | null {
  const range = asString(referenceRange);
  if (!range) return null;
  const quantitative = hasNumericSignal(range) || hasNumericSignal(resultValue);
  if (quantitative) return range;
  if (/(alto|bajo|alterado|fuera\s+de\s+rango|normal)/i.test(range)) return null;
  return range;
}

export function normalizeClinicalToken(value: string): string {
  return asString(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s/.-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function cleanSentence(value: string): string {
  return asString(value)
    .replace(/\s+/g, " ")
    .replace(/\s+[·|]\s+/g, " · ")
    .trim();
}

export function sanitizeNarrativeLabel(value: string, fallback: string): string {
  const cleaned = asString(value)
    .replace(/\s+/g, " ")
    .replace(/[·|]+/g, " · ")
    .trim();
  return cleaned.slice(0, 120) || fallback;
}

// ---------------------------------------------------------------------------
// Normalisation / hashing helpers
// ---------------------------------------------------------------------------

export function normalizeForHash(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

export function normalizeTextForMatch(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// ---------------------------------------------------------------------------
// Date / time utilities
// ---------------------------------------------------------------------------

export function toIsoDateOnly(date: Date): string {
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function toGmailDate(date: Date): string {
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  return `${yyyy}/${mm}/${dd}`;
}

export function parseIsoDate(value: unknown): Date | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

export function parseDateOnly(value: unknown): Date | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;
  const parsed = new Date(`${trimmed}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function parseBirthDateFromPet(petData: Record<string, unknown>): Date | null {
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

export function calculateAgeYears(birthDate: Date | null): number {
  if (!birthDate) return 0;
  const now = new Date();
  const diffMs = now.getTime() - birthDate.getTime();
  if (diffMs <= 0) return 0;
  return Math.max(0, Math.floor(diffMs / (365.25 * 24 * 60 * 60 * 1000)));
}

export function calculateMaxLookbackMonths(args: {
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

export function getMaxMailsPerSync(planType: UserPlanType): number {
  return planType === "premium" ? getPremiumPlanMaxEmailsPerSync() : getFreePlanMaxEmailsPerSync();
}

export function parseGmailDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return getNowIso();
  return parsed.toISOString();
}

export function monthsBetween(nowTimestamp: number, targetTimestamp: number): number {
  const current = new Date(nowTimestamp);
  const target = new Date(targetTimestamp);
  return Math.max(
    0,
    (current.getFullYear() - target.getFullYear()) * 12 + (current.getMonth() - target.getMonth())
  );
}

// ---------------------------------------------------------------------------
// Crypto utilities
// ---------------------------------------------------------------------------

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function base64UrlToBase64(value: string): string {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  return padded;
}

export function decodeBase64UrlToBuffer(value: string): Buffer {
  return Buffer.from(base64UrlToBase64(value), "base64");
}

export function decodeBase64UrlToText(value: string): string {
  try {
    return decodeBase64UrlToBuffer(value).toString("utf8");
  } catch {
    return "";
  }
}

// ---------------------------------------------------------------------------
// HTML utilities
// ---------------------------------------------------------------------------

export function decodeHtmlEntitiesBasic(value: string): string {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;/gi, "'")
    .replace(/&nbsp;/gi, " ");
}

export function stripHtmlToText(value: string): string {
  const withoutScript = value.replace(/<script[\s\S]*?<\/script>/gi, " ");
  const withoutStyle = withoutScript.replace(/<style[\s\S]*?<\/style>/gi, " ");
  const withoutTags = withoutStyle.replace(/<[^>]+>/g, " ");
  return decodeHtmlEntitiesBasic(withoutTags).replace(/\s+/g, " ").trim();
}

// ---------------------------------------------------------------------------
// External link utilities
// ---------------------------------------------------------------------------

export function normalizeExternalLink(raw: string): string {
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

export function extractCandidateExternalLinks(bodyText: string): string[] {
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

export function isPrivateOrLocalHost(hostname: string): boolean {
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

// ---------------------------------------------------------------------------
// Storage / binary utilities
// ---------------------------------------------------------------------------

export function sanitizePathToken(value: string): string {
  const safe = value.replace(/[^a-z0-9._-]+/gi, "_").replace(/^_+|_+$/g, "");
  if (!safe) return "attachment";
  return safe.slice(0, 120);
}

export function buildAttachmentStoragePath(args: {
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

export function createBase64DecodeTransform(): Transform {
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

export function* iterateBase64Chunks(value: string, chunkSize = 256 * 1024): Generator<string> {
  for (let offset = 0; offset < value.length; offset += chunkSize) {
    yield value.slice(offset, offset + chunkSize);
  }
}

// ---------------------------------------------------------------------------
// Pet identity / token utilities
// ---------------------------------------------------------------------------

export function tokenizeIdentity(value: string): string[] {
  return Array.from(
    new Set(
      normalizeTextForMatch(value)
        .split(/[^a-z0-9]+/g)
        .map((token) => token.trim())
        .filter((token) => token.length >= 3)
    )
  );
}

export function hasAnyIdentityToken(corpus: string, tokens: string[]): boolean {
  return tokens.some((token) => corpus.includes(token));
}

export function hasExactPhrase(corpus: string, phrase: string): boolean {
  const normalizedPhrase = normalizeTextForMatch(phrase);
  if (!normalizedPhrase) return false;
  return corpus.includes(normalizedPhrase);
}

export function listStringValues(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => asString(entry))
    .filter(Boolean);
}

export function uniqueNonEmpty(values: string[]): string[] {
  return Array.from(new Set(values.map((entry) => entry.trim()).filter(Boolean)));
}

// ---------------------------------------------------------------------------
// Species utilities
// ---------------------------------------------------------------------------

export function speciesAliases(species: string): string[] {
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

export function canonicalSpeciesKey(species: string): string | null {
  const aliases = speciesAliases(species);
  if (aliases.includes("dog")) return "dog";
  if (aliases.includes("cat")) return "cat";
  const normalized = normalizeTextForMatch(species);
  return normalized || null;
}

export function inferSpeciesSignalsFromCorpus(corpus: string): string[] {
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

// ---------------------------------------------------------------------------
// Similarity / dedup utilities
// ---------------------------------------------------------------------------

export function normalizeSemanticText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function jaccardSimilarity(a: string, b: string): number {
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

export function dateProximityScore(dateA: string | null, dateB: string | null): number {
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;
  const a = parseDateOnly(dateA);
  const b = parseDateOnly(dateB);
  if (!a || !b) return 0.35;
  const diffDays = Math.abs(a.getTime() - b.getTime()) / ONE_DAY_MS;
  if (diffDays <= 1) return 1;
  if (diffDays <= 3) return 0.85;
  if (diffDays <= 7) return 0.7;
  return 0;
}

// ---------------------------------------------------------------------------
// AI text utilities
// ---------------------------------------------------------------------------

export function tryParseJson(text: string): Record<string, unknown> | null {
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

export function splitTextForAi(text: string, maxChars: number, maxChunks: number): string[] {
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

// ---------------------------------------------------------------------------
// Internal helpers (not exported, used by getMaxMailsPerSync)
// ---------------------------------------------------------------------------

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

// Local copies of the constants used by the env helpers above, to avoid
// circular dependency on types.ts for runtime values only needed here.
const MAX_EMAILS_PER_USER_PER_DAY = 500;
const FREE_PLAN_MAX_EMAILS_PER_SYNC = 300;
