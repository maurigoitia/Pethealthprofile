"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeMimeType = normalizeMimeType;
exports.isImageMime = isImageMime;
exports.listAllMessageParts = listAllMessageParts;
exports.extractBodyText = extractBodyText;
exports.getHeader = getHeader;
exports.isSupportedAttachmentType = isSupportedAttachmentType;
exports.fetchAttachmentMetadata = fetchAttachmentMetadata;
const types_1 = require("./types");
const utils_1 = require("./utils");
// ─── MIME helpers ───────────────────────────────────────────────────────────
function normalizeMimeType(mimeType, filename) {
    const lowerName = filename.toLowerCase();
    const normalized = (0, utils_1.asString)(mimeType).toLowerCase();
    if (normalized && normalized !== "application/octet-stream")
        return normalized;
    if (lowerName.endsWith(".pdf"))
        return "application/pdf";
    if (lowerName.endsWith(".docx"))
        return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    if (lowerName.endsWith(".doc"))
        return "application/msword";
    if (lowerName.endsWith(".txt"))
        return "text/plain";
    if (lowerName.endsWith(".csv"))
        return "text/csv";
    if (lowerName.endsWith(".jpg") || lowerName.endsWith(".jpeg"))
        return "image/jpeg";
    if (lowerName.endsWith(".png"))
        return "image/png";
    if (lowerName.endsWith(".webp"))
        return "image/webp";
    if (lowerName.endsWith(".heic"))
        return "image/heic";
    if (lowerName.endsWith(".dcm"))
        return "application/dicom";
    return normalized || "application/octet-stream";
}
function isImageMime(mimeType) {
    return mimeType.startsWith("image/");
}
// ─── Message part traversal ─────────────────────────────────────────────────
function listAllMessageParts(payload) {
    if (!payload)
        return [];
    const stack = [payload];
    const output = [];
    while (stack.length > 0) {
        const part = stack.pop();
        output.push(part);
        if (Array.isArray(part.parts) && part.parts.length > 0) {
            stack.push(...part.parts);
        }
    }
    return output;
}
// ─── Body extraction ────────────────────────────────────────────────────────
function extractBodyText(payload) {
    var _a;
    if (!payload)
        return "";
    const parts = listAllMessageParts(payload);
    const chunks = [];
    for (const part of parts) {
        const mime = (0, utils_1.asString)(part.mimeType).toLowerCase();
        const data = (0, utils_1.asString)((_a = part.body) === null || _a === void 0 ? void 0 : _a.data);
        if (!data)
            continue;
        if (mime === "text/plain" || mime === "text/html" || mime === "application/json") {
            const decoded = (0, utils_1.decodeBase64UrlToText)(data);
            if (decoded.trim())
                chunks.push(decoded.trim());
        }
    }
    return chunks.join("\n\n").slice(0, 120000);
}
// ─── Header extraction ─────────────────────────────────────────────────────
function getHeader(payload, headerName) {
    const wanted = headerName.toLowerCase();
    const headers = (payload === null || payload === void 0 ? void 0 : payload.headers) || [];
    for (const header of headers) {
        if ((0, utils_1.asString)(header.name).toLowerCase() === wanted)
            return (0, utils_1.asString)(header.value);
    }
    return "";
}
// ─── Attachment type validation ─────────────────────────────────────────────
function isSupportedAttachmentType(filename, mimeType) {
    const lowerName = filename.toLowerCase();
    const lowerMime = mimeType.toLowerCase();
    return (lowerMime === "application/pdf" ||
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
        lowerName.endsWith(".dcm"));
}
// ─── Attachment metadata ────────────────────────────────────────────────────
function fetchAttachmentMetadata(args) {
    var _a, _b;
    const allParts = listAllMessageParts(args.payload);
    const attachments = allParts
        .filter((part) => { var _a; return Boolean((0, utils_1.asString)(part.filename) || (0, utils_1.asString)((_a = part.body) === null || _a === void 0 ? void 0 : _a.attachmentId)); })
        .slice(0, types_1.MAX_ATTACHMENTS_PER_EMAIL);
    const metadata = [];
    let imageCount = 0;
    for (const part of attachments) {
        const filename = (0, utils_1.asString)(part.filename) || "attachment";
        const originalMimeType = (0, utils_1.asString)(part.mimeType).toLowerCase() || "application/octet-stream";
        const mimeType = normalizeMimeType(originalMimeType, filename);
        const attachmentId = (0, utils_1.asString)((_a = part.body) === null || _a === void 0 ? void 0 : _a.attachmentId);
        const sizeBytes = (0, utils_1.asNonNegativeNumber)((_b = part.body) === null || _b === void 0 ? void 0 : _b.size, 0);
        const supported = isSupportedAttachmentType(filename, mimeType);
        const oversized = sizeBytes > types_1.MAX_ATTACHMENT_SIZE_BYTES;
        const isImage = isImageMime(mimeType) || /\.(png|jpe?g)$/i.test(filename);
        if (isImage)
            imageCount += 1;
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
//# sourceMappingURL=emailParsing.js.map