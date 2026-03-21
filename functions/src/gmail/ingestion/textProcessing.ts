import { ExternalLinkExtractionMetadata, MAX_EXTERNAL_LINK_TEXT_CHARS } from "./types";
import { asString } from "./utils";
import {
  parseDomainListEnv, domainMatches,
  getMaxExternalLinksPerEmail, getExternalLinkFetchTimeoutMs,
  getExternalLinkMaxBytes, getExternalLinkMaxRedirects,
  isExternalLinkFetchEnabled,
} from "./envConfig";
import {
  extractSenderDomain,
  isTrustedClinicalSender,
} from "./petMatching";
import { normalizeMimeType, isImageMime } from "./emailParsing";
import { ocrAttachmentViaGemini } from "./clinicalAi";

// ─── HTML entity decoding ───────────────────────────────────────────────────

export function decodeHtmlEntitiesBasic(value: string): string {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;/gi, "'")
    .replace(/&nbsp;/gi, " ");
}

// ─── HTML stripping ─────────────────────────────────────────────────────────

export function stripHtmlToText(value: string): string {
  const withoutScript = value.replace(/<script[\s\S]*?<\/script>/gi, " ");
  const withoutStyle = withoutScript.replace(/<style[\s\S]*?<\/style>/gi, " ");
  const withoutTags = withoutStyle.replace(/<[^>]+>/g, " ");
  return decodeHtmlEntitiesBasic(withoutTags).replace(/\s+/g, " ").trim();
}

// ─── External link extraction ───────────────────────────────────────────────

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

// ─── SSRF protection ────────────────────────────────────────────────────────

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

// ─── Link fetch policy ──────────────────────────────────────────────────────

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

// ─── Redirect handling ──────────────────────────────────────────────────────

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

// ─── Login detection ────────────────────────────────────────────────────────

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

// ─── Controlled fetch with redirect following ───────────────────────────────

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

// ─── Response body reader ───────────────────────────────────────────────────

export async function readResponseBodyWithLimit(response: Response, maxBytes: number): Promise<Buffer> {
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

// ─── External link content extraction ───────────────────────────────────────

export async function fetchExternalLinkTextChunks(args: {
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
