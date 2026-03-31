"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getNowIso = getNowIso;
exports.asRecord = asRecord;
exports.asString = asString;
exports.asNonNegativeNumber = asNonNegativeNumber;
exports.clamp = clamp;
exports.hasNumericSignal = hasNumericSignal;
exports.sanitizeReferenceRange = sanitizeReferenceRange;
exports.normalizeClinicalToken = normalizeClinicalToken;
exports.cleanSentence = cleanSentence;
exports.sanitizeNarrativeLabel = sanitizeNarrativeLabel;
exports.normalizeForHash = normalizeForHash;
exports.normalizeTextForMatch = normalizeTextForMatch;
exports.toIsoDateOnly = toIsoDateOnly;
exports.toGmailDate = toGmailDate;
exports.parseIsoDate = parseIsoDate;
exports.parseDateOnly = parseDateOnly;
exports.parseBirthDateFromPet = parseBirthDateFromPet;
exports.calculateAgeYears = calculateAgeYears;
exports.calculateMaxLookbackMonths = calculateMaxLookbackMonths;
exports.getMaxMailsPerSync = getMaxMailsPerSync;
exports.parseGmailDate = parseGmailDate;
exports.monthsBetween = monthsBetween;
exports.sha256 = sha256;
exports.base64UrlToBase64 = base64UrlToBase64;
exports.decodeBase64UrlToBuffer = decodeBase64UrlToBuffer;
exports.decodeBase64UrlToText = decodeBase64UrlToText;
exports.decodeHtmlEntitiesBasic = decodeHtmlEntitiesBasic;
exports.stripHtmlToText = stripHtmlToText;
exports.normalizeExternalLink = normalizeExternalLink;
exports.extractCandidateExternalLinks = extractCandidateExternalLinks;
exports.isPrivateOrLocalHost = isPrivateOrLocalHost;
exports.sanitizePathToken = sanitizePathToken;
exports.buildAttachmentStoragePath = buildAttachmentStoragePath;
exports.createBase64DecodeTransform = createBase64DecodeTransform;
exports.iterateBase64Chunks = iterateBase64Chunks;
exports.tokenizeIdentity = tokenizeIdentity;
exports.hasAnyIdentityToken = hasAnyIdentityToken;
exports.hasExactPhrase = hasExactPhrase;
exports.listStringValues = listStringValues;
exports.uniqueNonEmpty = uniqueNonEmpty;
exports.speciesAliases = speciesAliases;
exports.canonicalSpeciesKey = canonicalSpeciesKey;
exports.inferSpeciesSignalsFromCorpus = inferSpeciesSignalsFromCorpus;
exports.normalizeSemanticText = normalizeSemanticText;
exports.jaccardSimilarity = jaccardSimilarity;
exports.dateProximityScore = dateProximityScore;
exports.tryParseJson = tryParseJson;
exports.splitTextForAi = splitTextForAi;
exports.domainMatches = domainMatches;
exports.parseDomainListEnv = parseDomainListEnv;
exports.getEncryptionKey = getEncryptionKey;
exports.encryptText = encryptText;
exports.decryptText = decryptText;
exports.decryptPayload = decryptPayload;
const crypto_1 = require("crypto");
const stream_1 = require("stream");
// ---------------------------------------------------------------------------
// Generic helpers
// ---------------------------------------------------------------------------
function getNowIso() {
    return new Date().toISOString();
}
function asRecord(value) {
    return typeof value === "object" && value !== null ? value : {};
}
function asString(value) {
    return typeof value === "string" ? value.trim() : "";
}
function asNonNegativeNumber(value, fallback = 0) {
    if (typeof value !== "number" || Number.isNaN(value) || value < 0)
        return fallback;
    return value;
}
function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}
// ---------------------------------------------------------------------------
// Clinical text helpers
// ---------------------------------------------------------------------------
function hasNumericSignal(value) {
    const text = asString(value);
    return /\d/.test(text);
}
function sanitizeReferenceRange(referenceRange, resultValue) {
    const range = asString(referenceRange);
    if (!range)
        return null;
    const quantitative = hasNumericSignal(range) || hasNumericSignal(resultValue);
    if (quantitative)
        return range;
    if (/(alto|bajo|alterado|fuera\s+de\s+rango|normal)/i.test(range))
        return null;
    return range;
}
function normalizeClinicalToken(value) {
    return asString(value)
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9\s/.-]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}
function cleanSentence(value) {
    return asString(value)
        .replace(/\s+/g, " ")
        .replace(/\s+[·|]\s+/g, " · ")
        .trim();
}
function sanitizeNarrativeLabel(value, fallback) {
    const cleaned = asString(value)
        .replace(/\s+/g, " ")
        .replace(/[·|]+/g, " · ")
        .trim();
    return cleaned.slice(0, 120) || fallback;
}
// ---------------------------------------------------------------------------
// Normalisation / hashing helpers
// ---------------------------------------------------------------------------
function normalizeForHash(text) {
    return text.toLowerCase().replace(/\s+/g, " ").trim();
}
function normalizeTextForMatch(value) {
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
function toIsoDateOnly(date) {
    const yyyy = date.getUTCFullYear();
    const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(date.getUTCDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
}
function toGmailDate(date) {
    const yyyy = date.getUTCFullYear();
    const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(date.getUTCDate()).padStart(2, "0");
    return `${yyyy}/${mm}/${dd}`;
}
function parseIsoDate(value) {
    if (typeof value !== "string" || !value.trim())
        return null;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime()))
        return null;
    return parsed;
}
function parseDateOnly(value) {
    if (typeof value !== "string" || !value.trim())
        return null;
    const trimmed = value.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed))
        return null;
    const parsed = new Date(`${trimmed}T00:00:00.000Z`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}
function parseBirthDateFromPet(petData) {
    const raw = asString(petData.birthDate);
    if (!raw)
        return null;
    if (/^\d{4}$/.test(raw)) {
        return new Date(`${raw}-01-01T00:00:00.000Z`);
    }
    if (/^\d{4}-\d{2}$/.test(raw)) {
        return new Date(`${raw}-01T00:00:00.000Z`);
    }
    return parseIsoDate(raw);
}
function calculateAgeYears(birthDate) {
    if (!birthDate)
        return 0;
    const now = new Date();
    const diffMs = now.getTime() - birthDate.getTime();
    if (diffMs <= 0)
        return 0;
    return Math.max(0, Math.floor(diffMs / (365.25 * 24 * 60 * 60 * 1000)));
}
function calculateMaxLookbackMonths(args) {
    if (args.planType === "free")
        return 12;
    const now = new Date();
    if (args.petAgeYears <= 2 && args.birthDate) {
        const months = (now.getUTCFullYear() - args.birthDate.getUTCFullYear()) * 12 +
            (now.getUTCMonth() - args.birthDate.getUTCMonth());
        return clamp(Math.max(months, 36), 36, 180);
    }
    const computed = args.petAgeYears > 0 ? args.petAgeYears * 12 + 6 : 12;
    return clamp(Math.max(computed, 36), 36, 180);
}
function getMaxMailsPerSync(planType) {
    return planType === "premium" ? getPremiumPlanMaxEmailsPerSync() : getFreePlanMaxEmailsPerSync();
}
function parseGmailDate(value) {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime()))
        return getNowIso();
    return parsed.toISOString();
}
function monthsBetween(nowTimestamp, targetTimestamp) {
    const current = new Date(nowTimestamp);
    const target = new Date(targetTimestamp);
    return Math.max(0, (current.getFullYear() - target.getFullYear()) * 12 + (current.getMonth() - target.getMonth()));
}
// ---------------------------------------------------------------------------
// Crypto utilities
// ---------------------------------------------------------------------------
function sha256(value) {
    return (0, crypto_1.createHash)("sha256").update(value).digest("hex");
}
function base64UrlToBase64(value) {
    const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    return padded;
}
function decodeBase64UrlToBuffer(value) {
    return Buffer.from(base64UrlToBase64(value), "base64");
}
function decodeBase64UrlToText(value) {
    try {
        return decodeBase64UrlToBuffer(value).toString("utf8");
    }
    catch (_a) {
        return "";
    }
}
// ---------------------------------------------------------------------------
// HTML utilities
// ---------------------------------------------------------------------------
function decodeHtmlEntitiesBasic(value) {
    return value
        .replace(/&amp;/gi, "&")
        .replace(/&lt;/gi, "<")
        .replace(/&gt;/gi, ">")
        .replace(/&quot;/gi, "\"")
        .replace(/&#39;/gi, "'")
        .replace(/&nbsp;/gi, " ");
}
function stripHtmlToText(value) {
    const withoutScript = value.replace(/<script[\s\S]*?<\/script>/gi, " ");
    const withoutStyle = withoutScript.replace(/<style[\s\S]*?<\/style>/gi, " ");
    const withStructuralBreaks = withoutStyle
        .replace(/<(?:br|hr)\s*\/?>/gi, "\n")
        .replace(/<\/(?:p|div|section|article|header|footer|li|ul|ol|tr|table|h[1-6])>/gi, "\n")
        .replace(/<(?:p|div|section|article|header|footer|li|tr|table|h[1-6])[^>]*>/gi, "\n")
        .replace(/<\/(?:td|th)>/gi, " | ")
        .replace(/<(?:td|th)[^>]*>/gi, " ");
    const withoutTags = withStructuralBreaks.replace(/<[^>]+>/g, " ");
    return decodeHtmlEntitiesBasic(withoutTags)
        .replace(/[ \t]+\n/g, "\n")
        .replace(/\n[ \t]+/g, "\n")
        .replace(/[ \t]{2,}/g, " ")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
}
// ---------------------------------------------------------------------------
// External link utilities
// ---------------------------------------------------------------------------
function normalizeExternalLink(raw) {
    const trimmed = decodeHtmlEntitiesBasic(asString(raw))
        .replace(/^<+|>+$/g, "")
        .replace(/[)\],.;]+$/g, "");
    if (!trimmed)
        return "";
    try {
        const parsed = new URL(trimmed);
        if (parsed.protocol !== "https:" && parsed.protocol !== "http:")
            return "";
        parsed.hash = "";
        return parsed.toString();
    }
    catch (_a) {
        return "";
    }
}
function extractCandidateExternalLinks(bodyText) {
    const out = new Set();
    const hrefRegex = /href\s*=\s*["']([^"'#]+)["']/gi;
    const plainRegex = /\bhttps?:\/\/[^\s<>"'`]+/gi;
    let match;
    while ((match = hrefRegex.exec(bodyText)) !== null) {
        const normalized = normalizeExternalLink(match[1] || "");
        if (normalized)
            out.add(normalized);
    }
    while ((match = plainRegex.exec(bodyText)) !== null) {
        const normalized = normalizeExternalLink(match[0] || "");
        if (normalized)
            out.add(normalized);
    }
    return Array.from(out);
}
function isPrivateOrLocalHost(hostname) {
    const host = hostname.toLowerCase();
    if (!host)
        return true;
    if (host === "localhost" || host === "::1")
        return true;
    if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) {
        if (/^127\./.test(host))
            return true;
        if (/^10\./.test(host))
            return true;
        if (/^192\.168\./.test(host))
            return true;
        if (/^169\.254\./.test(host))
            return true;
        const m172 = host.match(/^172\.(\d+)\./);
        if (m172) {
            const second = Number(m172[1]);
            if (second >= 16 && second <= 31)
                return true;
        }
    }
    if (host.startsWith("fc") || host.startsWith("fd") || host.startsWith("fe80:"))
        return true;
    return false;
}
// ---------------------------------------------------------------------------
// Storage / binary utilities
// ---------------------------------------------------------------------------
function sanitizePathToken(value) {
    const safe = value.replace(/[^a-z0-9._-]+/gi, "_").replace(/^_+|_+$/g, "");
    if (!safe)
        return "attachment";
    return safe.slice(0, 120);
}
function buildAttachmentStoragePath(args) {
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
function createBase64DecodeTransform() {
    let carry = "";
    return new stream_1.Transform({
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
            }
            catch (error) {
                callback(error);
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
            }
            catch (error) {
                callback(error);
            }
        },
    });
}
function* iterateBase64Chunks(value, chunkSize = 256 * 1024) {
    for (let offset = 0; offset < value.length; offset += chunkSize) {
        yield value.slice(offset, offset + chunkSize);
    }
}
// ---------------------------------------------------------------------------
// Pet identity / token utilities
// ---------------------------------------------------------------------------
function tokenizeIdentity(value) {
    return Array.from(new Set(normalizeTextForMatch(value)
        .split(/[^a-z0-9]+/g)
        .map((token) => token.trim())
        .filter((token) => token.length >= 3)));
}
function hasAnyIdentityToken(corpus, tokens) {
    return tokens.some((token) => corpus.includes(token));
}
function hasExactPhrase(corpus, phrase) {
    const normalizedPhrase = normalizeTextForMatch(phrase);
    if (!normalizedPhrase)
        return false;
    return corpus.includes(normalizedPhrase);
}
function listStringValues(value) {
    if (!Array.isArray(value))
        return [];
    return value
        .map((entry) => asString(entry))
        .filter(Boolean);
}
function uniqueNonEmpty(values) {
    return Array.from(new Set(values.map((entry) => entry.trim()).filter(Boolean)));
}
// ---------------------------------------------------------------------------
// Species utilities
// ---------------------------------------------------------------------------
function speciesAliases(species) {
    const normalized = normalizeTextForMatch(species);
    if (!normalized)
        return [];
    if (normalized === "dog" || normalized === "perro" || normalized === "canine" || normalized === "canino") {
        return ["dog", "perro", "canino", "canine"];
    }
    if (normalized === "cat" || normalized === "gato" || normalized === "feline" || normalized === "felino") {
        return ["cat", "gato", "felino", "feline"];
    }
    return [normalized];
}
function canonicalSpeciesKey(species) {
    const aliases = speciesAliases(species);
    if (aliases.includes("dog"))
        return "dog";
    if (aliases.includes("cat"))
        return "cat";
    const normalized = normalizeTextForMatch(species);
    return normalized || null;
}
function inferSpeciesSignalsFromCorpus(corpus) {
    const normalized = normalizeTextForMatch(corpus);
    if (!normalized)
        return [];
    const signals = new Set();
    const signalMap = [
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
function normalizeSemanticText(value) {
    return value
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}
function jaccardSimilarity(a, b) {
    const tokensA = new Set(normalizeSemanticText(a).split(" ").filter((token) => token.length >= 3));
    const tokensB = new Set(normalizeSemanticText(b).split(" ").filter((token) => token.length >= 3));
    if (tokensA.size === 0 || tokensB.size === 0)
        return 0;
    let intersection = 0;
    for (const token of tokensA) {
        if (tokensB.has(token))
            intersection += 1;
    }
    const union = new Set([...tokensA, ...tokensB]).size;
    return union > 0 ? intersection / union : 0;
}
function dateProximityScore(dateA, dateB) {
    const ONE_DAY_MS = 24 * 60 * 60 * 1000;
    const a = parseDateOnly(dateA);
    const b = parseDateOnly(dateB);
    if (!a || !b)
        return 0.35;
    const diffDays = Math.abs(a.getTime() - b.getTime()) / ONE_DAY_MS;
    if (diffDays <= 1)
        return 1;
    if (diffDays <= 3)
        return 0.85;
    if (diffDays <= 7)
        return 0.7;
    return 0;
}
// ---------------------------------------------------------------------------
// AI text utilities
// ---------------------------------------------------------------------------
function tryParseJson(text) {
    if (!text.trim())
        return null;
    const cleaned = text
        .replace(/^```json/i, "")
        .replace(/^```/i, "")
        .replace(/```$/i, "")
        .trim();
    try {
        return JSON.parse(cleaned);
    }
    catch (_a) {
        return null;
    }
}
function splitTextForAi(text, maxChars, maxChunks) {
    const cleaned = text.trim();
    if (!cleaned)
        return [];
    if (cleaned.length <= maxChars)
        return [cleaned];
    const chunks = [];
    let cursor = 0;
    while (cursor < cleaned.length && chunks.length < maxChunks) {
        const remaining = cleaned.length - cursor;
        if (remaining <= maxChars) {
            chunks.push(cleaned.slice(cursor));
            break;
        }
        let end = cursor + maxChars;
        const window = cleaned.slice(cursor, end);
        const breakAt = Math.max(window.lastIndexOf("\n\n"), window.lastIndexOf(". "), window.lastIndexOf("; "), window.lastIndexOf(", "));
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
function getBoundedIntFromEnv(name, fallback, min, max) {
    const raw = Number(process.env[name] || fallback);
    if (!Number.isFinite(raw))
        return fallback;
    return clamp(Math.round(raw), min, max);
}
function getPremiumPlanMaxEmailsPerSync() {
    return getBoundedIntFromEnv("GMAIL_PREMIUM_MAX_EMAILS_PER_SYNC", MAX_EMAILS_PER_USER_PER_DAY, 25, 5000);
}
function getFreePlanMaxEmailsPerSync() {
    return getBoundedIntFromEnv("GMAIL_FREE_MAX_EMAILS_PER_SYNC", FREE_PLAN_MAX_EMAILS_PER_SYNC, 25, 1000);
}
function domainMatches(domain, candidate) {
    return domain === candidate || domain.endsWith(`.${candidate}`);
}
function parseDomainListEnv(name) {
    return asString(process.env[name])
        .toLowerCase()
        .split(/[,\n;]+/g)
        .map((item) => item.trim())
        .filter((item) => Boolean(item) && /[a-z0-9-]+\.[a-z]{2,}/i.test(item))
        .map((item) => item.replace(/^\.+/, "").replace(/\.+$/, ""));
}
// ─── Encryption (AES-256-GCM) ───────────────────────────────────────────────
function getEncryptionKey() {
    const raw = asString(process.env.MAIL_TOKEN_ENCRYPTION_KEY);
    if (!raw) {
        throw new Error("MAIL_TOKEN_ENCRYPTION_KEY missing");
    }
    const maybeB64 = Buffer.from(raw, "base64");
    if (maybeB64.length === 32)
        return maybeB64;
    return (0, crypto_1.createHash)("sha256").update(raw).digest();
}
function encryptText(value) {
    const key = getEncryptionKey();
    const iv = (0, crypto_1.randomBytes)(12);
    const cipher = (0, crypto_1.createCipheriv)("aes-256-gcm", key, iv);
    const encrypted = Buffer.concat([cipher.update(Buffer.from(value, "utf8")), cipher.final()]);
    const tag = cipher.getAuthTag();
    return {
        ciphertext: encrypted.toString("base64"),
        iv: iv.toString("base64"),
        tag: tag.toString("base64"),
    };
}
function decryptText(payload) {
    const key = getEncryptionKey();
    const decipher = (0, crypto_1.createDecipheriv)("aes-256-gcm", key, Buffer.from(payload.iv, "base64"));
    decipher.setAuthTag(Buffer.from(payload.tag, "base64"));
    const decrypted = Buffer.concat([
        decipher.update(Buffer.from(payload.ciphertext, "base64")),
        decipher.final(),
    ]);
    return decrypted.toString("utf8");
}
function decryptPayload(input) {
    const key = getEncryptionKey();
    const decipher = (0, crypto_1.createDecipheriv)("aes-256-gcm", key, Buffer.from(input.iv, "base64"));
    decipher.setAuthTag(Buffer.from(input.tag, "base64"));
    const decrypted = Buffer.concat([
        decipher.update(Buffer.from(input.ciphertext, "base64")),
        decipher.final(),
    ]);
    return JSON.parse(decrypted.toString("utf8"));
}
// Local copies of the constants used by the env helpers above, to avoid
// circular dependency on types.ts for runtime values only needed here.
const MAX_EMAILS_PER_USER_PER_DAY = 500;
const FREE_PLAN_MAX_EMAILS_PER_SYNC = 300;
//# sourceMappingURL=utils.js.map