/**
 * Text processing functions extracted from clinicalIngestion.ts
 *
 * Covers: HTML stripping, link extraction/fetching, email body text extraction,
 * MIME type normalisation, sender domain analysis, and clinical email
 * candidate classification.
 */

import type {
  AttachmentMetadata,
  ExternalLinkExtractionMetadata,
  GmailMessagePart,
} from "./types";

import {
  DEFAULT_HUMAN_BLOCKED_SENDER_DOMAINS,
  MAX_ATTACHMENTS_PER_EMAIL,
  MAX_EXTERNAL_LINK_TEXT_CHARS,
  MIN_LIGHTWEIGHT_BODY_LENGTH,
} from "./types";

import {
  asNonNegativeNumber,
  asString,
  decodeBase64UrlToText,
  decodeHtmlEntitiesBasic,
  extractCandidateExternalLinks,
  isPrivateOrLocalHost,
  normalizeExternalLink,
  normalizeTextForMatch,
  stripHtmlToText,
  tokenizeIdentity,
  hasAnyIdentityToken,
  uniqueNonEmpty,
} from "./utils";

import {
  domainMatches,
  getExternalLinkFetchTimeoutMs,
  getExternalLinkMaxBytes,
  getExternalLinkMaxRedirects,
  getMaxExternalLinksPerEmail,
  isExternalLinkFetchEnabled,
  parseDomainListEnv,
} from "./envConfig";

// ── Re-exports from utils (kept for backward compatibility) ─────────────────
export {
  decodeHtmlEntitiesBasic,
  stripHtmlToText,
  normalizeExternalLink,
  extractCandidateExternalLinks,
  isPrivateOrLocalHost,
} from "./utils";

// ── MIME type utilities ─────────────────────────────────────────────────────

export function isImageMime(mimeType: string): boolean {
  return mimeType.startsWith("image/");
}

export function normalizeMimeType(mimeType: string | undefined, filename: string): string {
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

export function isSupportedAttachmentType(filename: string, mimeType: string): boolean {
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

// ── Gmail message part traversal ────────────────────────────────────────────

export function listAllMessageParts(payload: GmailMessagePart | undefined): GmailMessagePart[] {
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

export function extractBodyText(payload: GmailMessagePart | undefined): string {
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

export function getHeader(payload: GmailMessagePart | undefined, headerName: string): string {
  const wanted = headerName.toLowerCase();
  const headers = payload?.headers || [];
  for (const header of headers) {
    if (asString(header.name).toLowerCase() === wanted) return asString(header.value);
  }
  return "";
}

// ── Sender / domain analysis ────────────────────────────────────────────────

export function extractSenderDomain(email: string): string {
  const match = email.toLowerCase().match(/@([a-z0-9.-]+\.[a-z]{2,})/i);
  return match?.[1] || "";
}

export function isVetDomain(email: string): boolean {
  const normalized = email.toLowerCase();
  return (
    normalized.includes("vet") ||
    normalized.includes("veterin") ||
    normalized.includes("clinic") ||
    normalized.includes("clinica") ||
    normalized.includes("hospital")
  );
}

export function isMassMarketingDomain(email: string): boolean {
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

export function isTrustedClinicalDomain(email: string): boolean {
  const domain = extractSenderDomain(email);
  if (!domain) return false;
  const allowlist = parseDomainListEnv("GMAIL_TRUSTED_SENDER_DOMAINS");
  if (allowlist.length === 0) return false;
  return allowlist.some((item) => domainMatches(domain, item));
}

export function isTrustedClinicalSenderName(emailHeader: string): boolean {
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

export function isTrustedClinicalSender(emailHeader: string): boolean {
  return isTrustedClinicalDomain(emailHeader) || isTrustedClinicalSenderName(emailHeader);
}

export function isBlockedClinicalDomain(email: string): boolean {
  const domain = extractSenderDomain(email);
  if (!domain) return false;
  const blocklist = uniqueNonEmpty([
    ...DEFAULT_HUMAN_BLOCKED_SENDER_DOMAINS,
    ...parseDomainListEnv("GMAIL_BLOCKED_SENDER_DOMAINS"),
  ]);
  if (blocklist.length === 0) return false;
  return blocklist.some((item) => domainMatches(domain, item));
}

// ── Link fetch decision & HTTP helpers ──────────────────────────────────────

export function shouldFetchExternalLink(urlValue: string, sourceSender: string): { ok: boolean; reason: string } {
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

export function isRedirectStatus(status: number): boolean {
  return status === 301 || status === 302 || status === 303 || status === 307 || status === 308;
}

export function resolveRedirectUrl(locationHeader: string, currentUrl: string): string {
  const normalizedHeader = decodeHtmlEntitiesBasic(asString(locationHeader));
  if (!normalizedHeader) return "";
  try {
    const resolved = new URL(normalizedHeader, currentUrl);
    return normalizeExternalLink(resolved.toString());
  } catch {
    return "";
  }
}

export function likelyLoginUrl(urlValue: string): boolean {
  const lower = urlValue.toLowerCase();
  return /(\/login\b|\/signin\b|\/sign-in\b|\/auth\b|\/oauth\b|\/sso\b|iniciar[-_\s]?sesion|iniciar[-_\s]?sesión)/i.test(lower);
}

export function detectLoginRequiredHtml(args: {
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

// ── Controlled-redirect HTTP fetch ──────────────────────────────────────────

export async function fetchWithControlledRedirects(args: {
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

export async function readResponseBodyWithLimit(response: Response, maxBytes: number): Promise<Buffer> {
  const body = response.body;
  if (!body) return Buffer.alloc(0);
  const reader = (body as ReadableStream<Uint8Array>).getReader();
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

// ── External link text extraction ───────────────────────────────────────────

/**
 * Callback type for OCR processing of binary attachments (PDF, images).
 * This dependency is injected to avoid coupling text processing to the
 * Gemini AI module.
 */
export type OcrFn = (args: { mimeType: string; base64Data: string }) => Promise<string>;

export async function fetchExternalLinkTextChunks(args: {
  bodyText: string;
  sourceSender: string;
  ocrFn: OcrFn;
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
        extractedText = await args.ocrFn({
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

// ── Clinical signal detection (text-based) ──────────────────────────────────

export function attachmentNamesContainClinicalSignal(metadata: AttachmentMetadata[]): boolean {
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

export function hasStrongHumanHealthcareSignal(text: string): boolean {
  const normalized = normalizeTextForMatch(text);
  if (!normalized) return false;
  const pattern =
    /\b(huesped|vih|hiv|infectologia|infectolog|obra social|prep|hepati(?:tis)?|paciente humano|paciente adulto|adulto mayor|turno medico|turno médico|medicina humana|clinica humana|clínica humana|oncologia humana|ginecolog|urolog|mastograf|mamograf|papanicolau|pap smear|colonoscop|endoscop|resonancia de cerebro|tomografia de torax humano|tomografía de tórax humano|hospital italiano|hospital aleman|hospital alemán|sanatorio|osde|swiss medical|medicus|galeno|omint)\b/;
  return pattern.test(normalized);
}

export function hasStrongVeterinaryEvidence(args: {
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

export function hasStrongNonClinicalSignal(text: string): boolean {
  const normalized = normalizeTextForMatch(text);
  if (!normalized) return false;
  const pattern =
    /\b(delivery status notification|mail delivery subsystem|newsletter|unsubscribe|linkedin|mercadopago|mercado pago|supervielle|banco|tarjeta|factura|invoice|pedido|shipping|envio|orden de compra|webinar|meeting invite|zoom|promocion|promoción|promo|oferta|descuento|alimento|balanceado|petshop|pet shop|accesorios)\b/;
  return pattern.test(normalized);
}

export function isCandidateClinicalEmail(args: {
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

// ── Webhook attachment metadata normalisation ───────────────────────────────

export function normalizeWebhookAttachmentMetadata(rawValue: unknown): AttachmentMetadata[] {
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
      const row = typeof entry === "object" && entry !== null ? (entry as Record<string, unknown>) : {};
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
