"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.decodeHtmlEntitiesBasic = decodeHtmlEntitiesBasic;
exports.stripHtmlToText = stripHtmlToText;
exports.normalizeExternalLink = normalizeExternalLink;
exports.extractCandidateExternalLinks = extractCandidateExternalLinks;
exports.isPrivateOrLocalHost = isPrivateOrLocalHost;
exports.resolveAndValidateUrl = resolveAndValidateUrl;
exports.isPrivateOrLocalHostIp = isPrivateOrLocalHostIp;
exports.shouldFetchExternalLink = shouldFetchExternalLink;
exports.isRedirectStatus = isRedirectStatus;
exports.resolveRedirectUrl = resolveRedirectUrl;
exports.likelyLoginUrl = likelyLoginUrl;
exports.detectLoginRequiredHtml = detectLoginRequiredHtml;
exports.fetchWithControlledRedirects = fetchWithControlledRedirects;
exports.readResponseBodyWithLimit = readResponseBodyWithLimit;
exports.fetchExternalLinkTextChunks = fetchExternalLinkTextChunks;
const dns = require("dns");
const types_1 = require("./types");
const utils_1 = require("./utils");
const envConfig_1 = require("./envConfig");
const petMatching_1 = require("./petMatching");
const emailParsing_1 = require("./emailParsing");
const clinicalAi_1 = require("./clinicalAi");
// ─── HTML entity decoding ───────────────────────────────────────────────────
function decodeHtmlEntitiesBasic(value) {
    return value
        .replace(/&amp;/gi, "&")
        .replace(/&lt;/gi, "<")
        .replace(/&gt;/gi, ">")
        .replace(/&quot;/gi, "\"")
        .replace(/&#39;/gi, "'")
        .replace(/&nbsp;/gi, " ");
}
// ─── HTML stripping ─────────────────────────────────────────────────────────
function stripHtmlToText(value) {
    const withoutScript = value.replace(/<script[\s\S]*?<\/script>/gi, " ");
    const withoutStyle = withoutScript.replace(/<style[\s\S]*?<\/style>/gi, " ");
    const withoutTags = withoutStyle.replace(/<[^>]+>/g, " ");
    return decodeHtmlEntitiesBasic(withoutTags).replace(/\s+/g, " ").trim();
}
// ─── External link extraction ───────────────────────────────────────────────
function normalizeExternalLink(raw) {
    const trimmed = decodeHtmlEntitiesBasic((0, utils_1.asString)(raw))
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
// ─── SSRF protection ────────────────────────────────────────────────────────
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
// ─── DNS-based SSRF protection (resolves hostname → checks resolved IP) ─────
/**
 * Resolves the hostname in `url` via DNS and checks whether the resolved IP
 * falls in any private / reserved range.  Returns `true` if the URL is safe
 * to fetch, `false` if the resolved IP is private/reserved or if DNS fails.
 *
 * This is an ADDITIONAL layer on top of the string-based `isPrivateOrLocalHost`
 * check — it defends against DNS rebinding attacks where a public-looking
 * hostname resolves to an internal address.
 */
async function resolveAndValidateUrl(url) {
    let hostname;
    try {
        hostname = new URL(url).hostname;
    }
    catch (_a) {
        return false;
    }
    // Strip IPv6 bracket notation so dns.promises.lookup receives a bare address.
    const bare = hostname.startsWith("[") && hostname.endsWith("]")
        ? hostname.slice(1, -1)
        : hostname;
    // If the hostname is already an IP literal, re-use the existing string check.
    if (isPrivateOrLocalHost(bare))
        return false;
    let resolvedAddress;
    try {
        // `verbatim: true` preserves the address family returned by the OS resolver.
        const result = await dns.promises.lookup(bare, { verbatim: true });
        resolvedAddress = result.address;
    }
    catch (_b) {
        // Resolution failure → refuse the URL.
        return false;
    }
    return !isPrivateOrLocalHostIp(resolvedAddress);
}
/**
 * Checks a *resolved* IP address string (IPv4 or IPv6) against private /
 * reserved ranges.  Separated from `isPrivateOrLocalHost` so it can be used
 * independently on the result of `dns.promises.lookup`.
 */
function isPrivateOrLocalHostIp(address) {
    const addr = address.trim().toLowerCase();
    if (!addr)
        return true;
    // ── IPv6 ──────────────────────────────────────────────────────────────────
    if (addr.includes(":")) {
        if (addr === "::1")
            return true; // loopback
        if (addr.startsWith("fc") || addr.startsWith("fd"))
            return true; // ULA fc00::/7
        if (addr.startsWith("fe80:"))
            return true; // link-local fe80::/10
        return false;
    }
    // ── IPv4 ──────────────────────────────────────────────────────────────────
    const parts = addr.split(".").map(Number);
    if (parts.length !== 4 || parts.some((p) => !Number.isFinite(p) || p < 0 || p > 255)) {
        // Unrecognised format — treat as private to be safe.
        return true;
    }
    const [a, b] = parts;
    if (a === 0)
        return true; // 0.0.0.0/8 — unspecified
    if (a === 10)
        return true; // 10.0.0.0/8
    if (a === 127)
        return true; // 127.0.0.0/8 — loopback
    if (a === 169 && b === 254)
        return true; // 169.254.0.0/16 — link-local
    if (a === 172 && b >= 16 && b <= 31)
        return true; // 172.16.0.0/12
    if (a === 192 && b === 168)
        return true; // 192.168.0.0/16
    return false;
}
// ─── Link fetch policy ──────────────────────────────────────────────────────
function shouldFetchExternalLink(urlValue, sourceSender) {
    let parsed;
    try {
        parsed = new URL(urlValue);
    }
    catch (_a) {
        return { ok: false, reason: "invalid_url" };
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return { ok: false, reason: "unsupported_protocol" };
    }
    if (isPrivateOrLocalHost(parsed.hostname)) {
        return { ok: false, reason: "private_or_local_host" };
    }
    const blockedDomains = (0, envConfig_1.parseDomainListEnv)("GMAIL_LINK_FETCH_BLOCKED_DOMAINS");
    if (blockedDomains.some((item) => (0, envConfig_1.domainMatches)(parsed.hostname, item))) {
        return { ok: false, reason: "blocked_domain" };
    }
    const explicitAllowlist = (0, envConfig_1.parseDomainListEnv)("GMAIL_LINK_FETCH_ALLOWED_DOMAINS");
    if (explicitAllowlist.length > 0) {
        const allowed = explicitAllowlist.some((item) => (0, envConfig_1.domainMatches)(parsed.hostname, item));
        return allowed ? { ok: true, reason: "explicit_allowlist" } : { ok: false, reason: "not_in_explicit_allowlist" };
    }
    const senderDomain = (0, petMatching_1.extractSenderDomain)(sourceSender);
    if (senderDomain && (0, envConfig_1.domainMatches)(parsed.hostname, senderDomain)) {
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
    if ((0, petMatching_1.isTrustedClinicalSender)(sourceSender) && trustedClinicalHosts.some((item) => (0, envConfig_1.domainMatches)(parsed.hostname, item))) {
        return { ok: true, reason: "trusted_sender_known_host" };
    }
    return { ok: false, reason: "domain_not_allowed" };
}
// ─── Redirect handling ──────────────────────────────────────────────────────
function isRedirectStatus(status) {
    return status === 301 || status === 302 || status === 303 || status === 307 || status === 308;
}
function resolveRedirectUrl(locationHeader, currentUrl) {
    const normalizedHeader = decodeHtmlEntitiesBasic((0, utils_1.asString)(locationHeader));
    if (!normalizedHeader)
        return "";
    try {
        const resolved = new URL(normalizedHeader, currentUrl);
        return normalizeExternalLink(resolved.toString());
    }
    catch (_a) {
        return "";
    }
}
function likelyLoginUrl(urlValue) {
    const lower = urlValue.toLowerCase();
    return /(\/login\b|\/signin\b|\/sign-in\b|\/auth\b|\/oauth\b|\/sso\b|iniciar[-_\s]?sesion|iniciar[-_\s]?sesión)/i.test(lower);
}
// ─── Login detection ────────────────────────────────────────────────────────
function detectLoginRequiredHtml(args) {
    if (args.status === 401 || args.status === 403 || args.status === 407)
        return true;
    const normalizedType = args.contentType.toLowerCase();
    if (!normalizedType.includes("text/html"))
        return false;
    const snippet = args.html.slice(0, 8000).toLowerCase();
    const hasPasswordField = /type\s*=\s*["']password["']/.test(snippet);
    const hasLoginWords = /\b(login|log in|sign in|iniciar sesion|iniciar sesión|acceder|ingresar|usuario|contrasena|contraseña|auth|oauth|sso)\b/.test(snippet);
    if (hasPasswordField && hasLoginWords)
        return true;
    if (likelyLoginUrl(args.url) && hasLoginWords)
        return true;
    return false;
}
// ─── Controlled fetch with redirect following ───────────────────────────────
async function fetchWithControlledRedirects(args) {
    let currentUrl = args.url;
    let redirectCount = 0;
    for (let attempt = 0; attempt <= args.maxRedirects; attempt += 1) {
        // DNS-resolution check: defend against DNS rebinding — a hostname that
        // passes the string-based isPrivateOrLocalHost check but resolves to a
        // private/reserved IP.  We run this before every fetch attempt so that
        // both the initial URL and any redirect destinations are validated.
        const dnsOk = await resolveAndValidateUrl(currentUrl);
        if (!dnsOk) {
            return {
                ok: false,
                reason: attempt === 0 ? "dns_resolved_private_ip" : "redirect_dns_resolved_private_ip",
                finalUrl: currentUrl,
                redirectCount,
                statusCode: null,
            };
        }
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
            const locationHeader = (0, utils_1.asString)(response.headers.get("location"));
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
        }
        catch (error) {
            const errorName = String((error === null || error === void 0 ? void 0 : error.name) || "").toLowerCase();
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
                reason: String((error === null || error === void 0 ? void 0 : error.message) || "fetch_failed").slice(0, 80),
                finalUrl: currentUrl,
                redirectCount,
                statusCode: null,
            };
        }
        finally {
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
async function readResponseBodyWithLimit(response, maxBytes) {
    const body = response.body;
    if (!body)
        return Buffer.alloc(0);
    const reader = body.getReader();
    const chunks = [];
    let total = 0;
    while (true) {
        const { done, value } = await reader.read();
        if (done)
            break;
        if (!value)
            continue;
        total += value.byteLength;
        if (total > maxBytes) {
            throw new Error("link_payload_too_large");
        }
        chunks.push(Buffer.from(value));
    }
    return Buffer.concat(chunks);
}
// ─── External link content extraction ───────────────────────────────────────
async function fetchExternalLinkTextChunks(args) {
    if (!(0, envConfig_1.isExternalLinkFetchEnabled)()) {
        return { detectedCount: 0, fetchedCount: 0, extractedChunks: [], metadata: [] };
    }
    const allUrls = extractCandidateExternalLinks(args.bodyText);
    const urls = allUrls.slice(0, (0, envConfig_1.getMaxExternalLinksPerEmail)());
    const metadata = [];
    const chunks = [];
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
        const timeoutMs = (0, envConfig_1.getExternalLinkFetchTimeoutMs)();
        const maxRedirects = (0, envConfig_1.getExternalLinkMaxRedirects)();
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
                const isPolicySkip = /domain_not_allowed|blocked_domain|not_in_explicit_allowlist|private_or_local_host/.test(fetchResult.reason);
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
            const contentType = (0, utils_1.asString)(response.headers.get("content-type")).toLowerCase();
            const contentLength = Number(response.headers.get("content-length"));
            const maxBytes = (0, envConfig_1.getExternalLinkMaxBytes)();
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
            const inferredMime = (0, emailParsing_1.normalizeMimeType)(contentType.split(";")[0], pathLower);
            let extractedText = "";
            let ocrUsed = false;
            let reason = "no_extractable_text";
            let loginRequired = false;
            if (inferredMime === "application/pdf" ||
                (0, emailParsing_1.isImageMime)(inferredMime) ||
                pathLower.endsWith(".pdf") ||
                pathLower.endsWith(".jpg") ||
                pathLower.endsWith(".jpeg") ||
                pathLower.endsWith(".png") ||
                pathLower.endsWith(".webp")) {
                ocrUsed = true;
                extractedText = await (0, clinicalAi_1.ocrAttachmentViaGemini)({
                    mimeType: inferredMime || "application/pdf",
                    base64Data: bytes.toString("base64"),
                });
                reason = extractedText.trim() ? "ocr_ok" : "ocr_empty";
            }
            else if (inferredMime.startsWith("text/html")) {
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
                }
                else {
                    extractedText = stripHtmlToText(htmlRaw);
                    reason = extractedText.trim() ? "html_text_ok" : "html_text_empty";
                }
            }
            else if (inferredMime.startsWith("text/") || pathLower.endsWith(".txt") || pathLower.endsWith(".csv")) {
                extractedText = bytes.toString("utf8");
                reason = extractedText.trim() ? "text_ok" : "text_empty";
            }
            const clipped = extractedText.trim().slice(0, types_1.MAX_EXTERNAL_LINK_TEXT_CHARS);
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
        }
        catch (error) {
            metadata.push({
                url,
                final_url: null,
                host: parsed.hostname,
                content_type: null,
                status: "failed",
                reason: String((error === null || error === void 0 ? void 0 : error.name) || (error === null || error === void 0 ? void 0 : error.message) || "fetch_failed").slice(0, 80),
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
//# sourceMappingURL=textProcessing.js.map