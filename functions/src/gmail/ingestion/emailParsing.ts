import {
  GmailMessagePart,
  AttachmentMetadata,
  MAX_ATTACHMENTS_PER_EMAIL,
  MAX_ATTACHMENT_SIZE_BYTES,
} from "./types";
import {
  asString,
  asNonNegativeNumber,
  decodeBase64UrlToText,
} from "./utils";

// ─── MIME helpers ───────────────────────────────────────────────────────────

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

export function isImageMime(mimeType: string): boolean {
  return mimeType.startsWith("image/");
}

// ─── Message part traversal ─────────────────────────────────────────────────

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

// ─── Body extraction ────────────────────────────────────────────────────────

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

// ─── Header extraction ─────────────────────────────────────────────────────

export function getHeader(payload: GmailMessagePart | undefined, headerName: string): string {
  const wanted = headerName.toLowerCase();
  const headers = payload?.headers || [];
  for (const header of headers) {
    if (asString(header.name).toLowerCase() === wanted) return asString(header.value);
  }
  return "";
}

// ─── Attachment type validation ─────────────────────────────────────────────

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

// ─── Attachment metadata ────────────────────────────────────────────────────

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
