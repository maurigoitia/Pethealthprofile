"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sanitizeAttachmentMetadataForFirestore = sanitizeAttachmentMetadataForFirestore;
exports.buildRecoveredRawDocumentFromIngestionDocument = buildRecoveredRawDocumentFromIngestionDocument;
exports.persistTemporaryRawDocument = persistTemporaryRawDocument;
exports.deleteTemporaryRawDocument = deleteTemporaryRawDocument;
exports.loadTemporaryRawDocument = loadTemporaryRawDocument;
exports.loadTemporaryRawDocumentWithFallback = loadTemporaryRawDocumentWithFallback;
exports.saveTemporaryAttachmentExtraction = saveTemporaryAttachmentExtraction;
exports.loadTemporaryAttachmentExtraction = loadTemporaryAttachmentExtraction;
exports.deleteTemporaryAttachmentExtraction = deleteTemporaryAttachmentExtraction;
exports.purgeExpiredRawDocuments = purgeExpiredRawDocuments;
const admin = require("firebase-admin");
const types_1 = require("./types");
const utils_1 = require("./utils");
// ─── Firestore helpers ──────────────────────────────────────────────────────
function sanitizeAttachmentMetadataForFirestore(rows) {
    return rows.map((row) => {
        const safe = {};
        for (const [key, value] of Object.entries(row)) {
            if (value !== undefined)
                safe[key] = value;
        }
        return safe;
    });
}
function hydrateAttachmentMetadata(rows) {
    return rows.map((row) => {
        const item = (0, utils_1.asRecord)(row);
        return {
            filename: (0, utils_1.asString)(item.filename) || "attachment",
            mimetype: (0, utils_1.asString)(item.mimetype) || "application/octet-stream",
            size_bytes: (0, utils_1.asNonNegativeNumber)(item.size_bytes, 0),
            ocr_success: item.ocr_success === true,
            ocr_reason: (0, utils_1.asString)(item.ocr_reason) || "",
            ocr_detail: (0, utils_1.asString)(item.ocr_detail) || null,
            original_mimetype: (0, utils_1.asString)(item.original_mimetype) || null,
            normalized_mimetype: (0, utils_1.asString)(item.normalized_mimetype) || null,
            storage_uri: (0, utils_1.asString)(item.storage_uri) || null,
            storage_path: (0, utils_1.asString)(item.storage_path) || null,
            storage_bucket: (0, utils_1.asString)(item.storage_bucket) || null,
            storage_signed_url: (0, utils_1.asString)(item.storage_signed_url) || null,
            storage_success: item.storage_success === true,
            storage_error: (0, utils_1.asString)(item.storage_error) || null,
        };
    });
}
function buildRecoveredRawDocumentFromIngestionDocument(args) {
    const attachmentMeta = hydrateAttachmentMetadata(Array.isArray(args.ingestionDocument.attachment_metadata) ? args.ingestionDocument.attachment_metadata : []);
    const sourceSender = (0, utils_1.asString)(args.sourceSender) || (0, utils_1.asString)(args.ingestionDocument.from_email);
    const sourceSubject = (0, utils_1.asString)(args.sourceSubject) || (0, utils_1.asString)(args.ingestionDocument.subject);
    const emailDate = (0, utils_1.asString)(args.ingestionDocument.email_date) || (0, utils_1.getNowIso)();
    const threadId = (0, utils_1.asString)(args.ingestionDocument.thread_id);
    const hashSignatureRaw = (0, utils_1.asString)(args.ingestionDocument.hash_signature_raw) ||
        (0, utils_1.sha256)([
            args.sessionId,
            args.messageId,
            emailDate,
            sourceSender,
            sourceSubject,
            attachmentMeta.map((row) => row.filename).join("|"),
        ].join("|"));
    const hasRecoverySignal = Boolean(sourceSender || sourceSubject || threadId || attachmentMeta.length > 0);
    if (!hasRecoverySignal)
        return null;
    return {
        sessionId: args.sessionId,
        uid: args.uid,
        messageId: args.messageId,
        threadId,
        emailDate,
        sourceSender,
        sourceSubject,
        bodyText: "",
        attachmentMeta,
        hashSignatureRaw,
    };
}
// ─── Temporary raw document persistence ─────────────────────────────────────
async function persistTemporaryRawDocument(args) {
    const docId = `${args.sessionId}_${args.rawDocument.message_id}`;
    const nowIso = (0, utils_1.getNowIso)();
    const expiresAtIso = new Date(Date.now() + types_1.RAW_DOCUMENT_TTL_MS).toISOString();
    const encrypted = (0, utils_1.encryptText)(args.rawDocument.body_text);
    await admin.firestore().collection("gmail_raw_documents_tmp").doc(docId).set({
        doc_id: docId,
        session_id: args.sessionId,
        user_id: args.uid,
        source: "email",
        message_id: args.rawDocument.message_id,
        thread_id: args.rawDocument.thread_id,
        email_date: args.rawDocument.email_date,
        source_sender: args.sourceSender.slice(0, 320),
        source_subject: args.sourceSubject.slice(0, 400),
        body_text_encrypted: encrypted,
        attachment_meta: sanitizeAttachmentMetadataForFirestore(args.rawDocument.attachment_meta),
        hash_signature_raw: args.rawDocument.hash_signature_raw,
        created_at: nowIso,
        expires_at: expiresAtIso,
    }, { merge: true });
    return docId;
}
async function deleteTemporaryRawDocument(docId) {
    await admin.firestore().collection("gmail_raw_documents_tmp").doc(docId).delete().catch(() => undefined);
}
async function loadTemporaryRawDocument(docId) {
    const snap = await admin.firestore().collection("gmail_raw_documents_tmp").doc(docId).get();
    if (!snap.exists)
        return null;
    const data = (0, utils_1.asRecord)(snap.data());
    const encrypted = (0, utils_1.asRecord)(data.body_text_encrypted);
    const ciphertext = (0, utils_1.asString)(encrypted.ciphertext);
    const iv = (0, utils_1.asString)(encrypted.iv);
    const tag = (0, utils_1.asString)(encrypted.tag);
    if (!ciphertext || !iv || !tag)
        return null;
    let bodyText = "";
    try {
        bodyText = (0, utils_1.decryptText)({ ciphertext, iv, tag });
    }
    catch (_a) {
        return null;
    }
    const attachmentMetaRaw = Array.isArray(data.attachment_meta) ? data.attachment_meta : [];
    const attachmentMeta = hydrateAttachmentMetadata(attachmentMetaRaw);
    return {
        sessionId: (0, utils_1.asString)(data.session_id),
        uid: (0, utils_1.asString)(data.user_id),
        messageId: (0, utils_1.asString)(data.message_id),
        threadId: (0, utils_1.asString)(data.thread_id),
        emailDate: (0, utils_1.asString)(data.email_date),
        sourceSender: (0, utils_1.asString)(data.source_sender),
        sourceSubject: (0, utils_1.asString)(data.source_subject),
        bodyText,
        attachmentMeta,
        hashSignatureRaw: (0, utils_1.asString)(data.hash_signature_raw),
    };
}
async function loadTemporaryRawDocumentWithFallback(args) {
    const direct = await loadTemporaryRawDocument(args.docId);
    if (direct) {
        return {
            document: direct,
            source: "temporary_raw_document",
        };
    }
    const ingestionDocSnap = await admin
        .firestore()
        .collection("gmail_ingestion_documents")
        .doc(`${args.sessionId}_${args.messageId}`)
        .get();
    if (!ingestionDocSnap.exists)
        return null;
    const recovered = buildRecoveredRawDocumentFromIngestionDocument({
        ingestionDocument: (0, utils_1.asRecord)(ingestionDocSnap.data()),
        sessionId: args.sessionId,
        uid: args.uid,
        messageId: args.messageId,
        sourceSender: args.sourceSender,
        sourceSubject: args.sourceSubject,
    });
    if (!recovered)
        return null;
    return {
        document: recovered,
        source: "ingestion_document_fallback",
    };
}
// ─── Temporary attachment extraction ────────────────────────────────────────
async function saveTemporaryAttachmentExtraction(args) {
    const encrypted = (0, utils_1.encryptText)(args.extractedText);
    const expiresAtIso = new Date(Date.now() + types_1.RAW_DOCUMENT_TTL_MS).toISOString();
    await admin.firestore().collection("gmail_attachment_extract_tmp").doc(args.rawDocId).set({
        raw_doc_id: args.rawDocId,
        session_id: args.sessionId,
        user_id: args.uid,
        attachment_metadata: sanitizeAttachmentMetadataForFirestore(args.attachmentMetadata),
        extracted_text_encrypted: encrypted,
        created_at: (0, utils_1.getNowIso)(),
        expires_at: expiresAtIso,
    }, { merge: true });
}
async function loadTemporaryAttachmentExtraction(rawDocId) {
    const snap = await admin.firestore().collection("gmail_attachment_extract_tmp").doc(rawDocId).get();
    if (!snap.exists)
        return null;
    const data = (0, utils_1.asRecord)(snap.data());
    const encrypted = (0, utils_1.asRecord)(data.extracted_text_encrypted);
    const ciphertext = (0, utils_1.asString)(encrypted.ciphertext);
    const iv = (0, utils_1.asString)(encrypted.iv);
    const tag = (0, utils_1.asString)(encrypted.tag);
    let extractedText = "";
    if (ciphertext && iv && tag) {
        try {
            extractedText = (0, utils_1.decryptText)({ ciphertext, iv, tag });
        }
        catch (_a) {
            extractedText = "";
        }
    }
    const attachmentMetaRaw = Array.isArray(data.attachment_metadata) ? data.attachment_metadata : [];
    const attachmentMetadata = hydrateAttachmentMetadata(attachmentMetaRaw);
    return {
        attachmentMetadata,
        extractedText,
    };
}
async function deleteTemporaryAttachmentExtraction(rawDocId) {
    await admin.firestore().collection("gmail_attachment_extract_tmp").doc(rawDocId).delete().catch(() => undefined);
}
// ─── Cleanup ────────────────────────────────────────────────────────────────
async function purgeExpiredRawDocuments(limit = 50) {
    const cutoffIso = (0, utils_1.getNowIso)();
    const stale = await admin
        .firestore()
        .collection("gmail_raw_documents_tmp")
        .where("expires_at", "<=", cutoffIso)
        .limit(limit)
        .get();
    if (stale.empty)
        return;
    await Promise.all(stale.docs.map((doc) => doc.ref.delete().catch(() => undefined)));
    const staleAttachment = await admin
        .firestore()
        .collection("gmail_attachment_extract_tmp")
        .where("expires_at", "<=", cutoffIso)
        .limit(limit)
        .get();
    if (!staleAttachment.empty) {
        await Promise.all(staleAttachment.docs.map((doc) => doc.ref.delete().catch(() => undefined)));
    }
}
//# sourceMappingURL=jobProcessing.js.map