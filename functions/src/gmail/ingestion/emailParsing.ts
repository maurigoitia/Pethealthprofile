/**
 * Email parsing module — MIME traversal, body/header extraction,
 * attachment metadata, sender domain analysis, and clinical email
 * candidacy scoring.
 *
 * Extracted from clinicalIngestion.ts as part of the Strangler Fig refactor.
 */

import type {
  AttachmentMetadata,
  GmailMessagePart,
} from "./types";

import {
  DEFAULT_HUMAN_BLOCKED_SENDER_DOMAINS,
  MAX_ATTACHMENTS_PER_EMAIL,
  MAX_ATTACHMENT_SIZE_BYTES,
  MIN_LIGHTWEIGHT_BODY_LENGTH,
} from "./types";

import {
  asNonNegativeNumber,
  asRecord,
  asString,
  decodeBase64UrlToText,
  normalizeTextForMatch,
  tokenizeIdentity,
  hasAnyIdentityToken,
  uniqueNonEmpty,
} from "./utils";

import {
  domainMatches,
  parseDomainListEnv,
} from "./envConfig";

// ── MIME tree traversal ─────────────────────────────────────────────────────

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

// ── Email body extraction ───────────────────────────────────────────────────

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

// ── Header extraction ───────────────────────────────────────────────────────

export function getHeader(payload: GmailMessagePart | undefined, headerName: string): string {
  const wanted = headerName.toLowerCase();
  const headers = payload?.headers || [];
  for (const header of headers) {
    if (asString(header.name).toLowerCase() === wanted) return asString(header.value);
  }
  return "";
}

// ── MIME type helpers ────────────────────────────────────────────────────────

export function isImageMime(mimeType: string): boolean {
  return mimeType.startsWith("image/");
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

// ── Attachment metadata extraction ──────────────────────────────────────────

export function fetchAttachmentMetadata(args: {
  payload: GmailMessagePart | undefined;
}): { attachmentMetadata: AttachmentMetadata[]; imageCount: number } {
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

export function sanitizeAttachmentMetadataForFirestore(rows: AttachmentMetadata[]): AttachmentMetadata[] {
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

// ── Sender domain analysis ──────────────────────────────────────────────────

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

// ── Clinical signal detection ───────────────────────────────────────────────

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

// ── Clinical email candidacy scoring ────────────────────────────────────────

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
