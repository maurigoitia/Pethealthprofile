import * as admin from "firebase-admin";
import {
  AttachmentMetadata,
  RAW_DOCUMENT_TTL_MS,
  RawDocumentLike,
} from "./types";
import {
  getNowIso, asRecord, asString, asNonNegativeNumber,
  encryptText, decryptText, sha256,
} from "./utils";

// ─── Firestore helpers ──────────────────────────────────────────────────────

export function sanitizeAttachmentMetadataForFirestore(rows: AttachmentMetadata[]): AttachmentMetadata[] {
  return rows.map((row) => {
    const safe: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(row)) {
      if (value !== undefined) safe[key] = value;
    }
    return safe as unknown as AttachmentMetadata;
  });
}

export interface LoadedTemporaryRawDocument {
  sessionId: string;
  uid: string;
  messageId: string;
  threadId: string;
  emailDate: string;
  sourceSender: string;
  sourceSubject: string;
  bodyText: string;
  attachmentMeta: AttachmentMetadata[];
  hashSignatureRaw: string;
}

function hydrateAttachmentMetadata(rows: unknown[]): AttachmentMetadata[] {
  return rows.map((row) => {
    const item = asRecord(row);
    return {
      filename: asString(item.filename) || "attachment",
      mimetype: asString(item.mimetype) || "application/octet-stream",
      size_bytes: asNonNegativeNumber(item.size_bytes, 0),
      ocr_success: item.ocr_success === true,
      ocr_reason: asString(item.ocr_reason) || "",
      ocr_detail: asString(item.ocr_detail) || null,
      original_mimetype: asString(item.original_mimetype) || null,
      normalized_mimetype: asString(item.normalized_mimetype) || null,
      storage_uri: asString(item.storage_uri) || null,
      storage_path: asString(item.storage_path) || null,
      storage_bucket: asString(item.storage_bucket) || null,
      storage_signed_url: asString(item.storage_signed_url) || null,
      storage_success: item.storage_success === true,
      storage_error: asString(item.storage_error) || null,
    };
  });
}

export function buildRecoveredRawDocumentFromIngestionDocument(args: {
  ingestionDocument: Record<string, unknown>;
  sessionId: string;
  uid: string;
  messageId: string;
  sourceSender?: string;
  sourceSubject?: string;
}): LoadedTemporaryRawDocument | null {
  const attachmentMeta = hydrateAttachmentMetadata(
    Array.isArray(args.ingestionDocument.attachment_metadata) ? args.ingestionDocument.attachment_metadata : []
  );
  const sourceSender = asString(args.sourceSender) || asString(args.ingestionDocument.from_email);
  const sourceSubject = asString(args.sourceSubject) || asString(args.ingestionDocument.subject);
  const emailDate = asString(args.ingestionDocument.email_date) || getNowIso();
  const threadId = asString(args.ingestionDocument.thread_id);
  const hashSignatureRaw =
    asString(args.ingestionDocument.hash_signature_raw) ||
    sha256(
      [
        args.sessionId,
        args.messageId,
        emailDate,
        sourceSender,
        sourceSubject,
        attachmentMeta.map((row) => row.filename).join("|"),
      ].join("|")
    );

  const hasRecoverySignal = Boolean(sourceSender || sourceSubject || threadId || attachmentMeta.length > 0);
  if (!hasRecoverySignal) return null;

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

export async function persistTemporaryRawDocument(args: {
  uid: string;
  sessionId: string;
  rawDocument: RawDocumentLike;
  sourceSender: string;
  sourceSubject: string;
}): Promise<string> {
  const docId = `${args.sessionId}_${args.rawDocument.message_id}`;
  const nowIso = getNowIso();
  const expiresAtIso = new Date(Date.now() + RAW_DOCUMENT_TTL_MS).toISOString();
  const encrypted = encryptText(args.rawDocument.body_text);
  await admin.firestore().collection("gmail_raw_documents_tmp").doc(docId).set(
    {
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
    },
    { merge: true }
  );
  return docId;
}

export async function deleteTemporaryRawDocument(docId: string): Promise<void> {
  await admin.firestore().collection("gmail_raw_documents_tmp").doc(docId).delete().catch(() => undefined);
}

export async function loadTemporaryRawDocument(docId: string): Promise<{
  sessionId: string;
  uid: string;
  messageId: string;
  threadId: string;
  emailDate: string;
  sourceSender: string;
  sourceSubject: string;
  bodyText: string;
  attachmentMeta: AttachmentMetadata[];
  hashSignatureRaw: string;
} | null> {
  const snap = await admin.firestore().collection("gmail_raw_documents_tmp").doc(docId).get();
  if (!snap.exists) return null;
  const data = asRecord(snap.data());
  const encrypted = asRecord(data.body_text_encrypted);
  const ciphertext = asString(encrypted.ciphertext);
  const iv = asString(encrypted.iv);
  const tag = asString(encrypted.tag);
  if (!ciphertext || !iv || !tag) return null;
  let bodyText = "";
  try {
    bodyText = decryptText({ ciphertext, iv, tag });
  } catch {
    return null;
  }

  const attachmentMetaRaw = Array.isArray(data.attachment_meta) ? data.attachment_meta : [];
  const attachmentMeta = hydrateAttachmentMetadata(attachmentMetaRaw);

  return {
    sessionId: asString(data.session_id),
    uid: asString(data.user_id),
    messageId: asString(data.message_id),
    threadId: asString(data.thread_id),
    emailDate: asString(data.email_date),
    sourceSender: asString(data.source_sender),
    sourceSubject: asString(data.source_subject),
    bodyText,
    attachmentMeta,
    hashSignatureRaw: asString(data.hash_signature_raw),
  };
}

export async function loadTemporaryRawDocumentWithFallback(args: {
  docId: string;
  sessionId: string;
  uid: string;
  messageId: string;
  sourceSender?: string;
  sourceSubject?: string;
}): Promise<{
  document: LoadedTemporaryRawDocument;
  source: "temporary_raw_document" | "ingestion_document_fallback";
} | null> {
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
  if (!ingestionDocSnap.exists) return null;

  const recovered = buildRecoveredRawDocumentFromIngestionDocument({
    ingestionDocument: asRecord(ingestionDocSnap.data()),
    sessionId: args.sessionId,
    uid: args.uid,
    messageId: args.messageId,
    sourceSender: args.sourceSender,
    sourceSubject: args.sourceSubject,
  });
  if (!recovered) return null;

  return {
    document: recovered,
    source: "ingestion_document_fallback",
  };
}

// ─── Temporary attachment extraction ────────────────────────────────────────

export async function saveTemporaryAttachmentExtraction(args: {
  rawDocId: string;
  sessionId: string;
  uid: string;
  attachmentMetadata: AttachmentMetadata[];
  extractedText: string;
}): Promise<void> {
  const encrypted = encryptText(args.extractedText);
  const expiresAtIso = new Date(Date.now() + RAW_DOCUMENT_TTL_MS).toISOString();
  await admin.firestore().collection("gmail_attachment_extract_tmp").doc(args.rawDocId).set(
    {
      raw_doc_id: args.rawDocId,
      session_id: args.sessionId,
      user_id: args.uid,
      attachment_metadata: sanitizeAttachmentMetadataForFirestore(args.attachmentMetadata),
      extracted_text_encrypted: encrypted,
      created_at: getNowIso(),
      expires_at: expiresAtIso,
    },
    { merge: true }
  );
}

export async function loadTemporaryAttachmentExtraction(rawDocId: string): Promise<{
  attachmentMetadata: AttachmentMetadata[];
  extractedText: string;
} | null> {
  const snap = await admin.firestore().collection("gmail_attachment_extract_tmp").doc(rawDocId).get();
  if (!snap.exists) return null;
  const data = asRecord(snap.data());
  const encrypted = asRecord(data.extracted_text_encrypted);
  const ciphertext = asString(encrypted.ciphertext);
  const iv = asString(encrypted.iv);
  const tag = asString(encrypted.tag);
  let extractedText = "";
  if (ciphertext && iv && tag) {
    try {
      extractedText = decryptText({ ciphertext, iv, tag });
    } catch {
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

export async function deleteTemporaryAttachmentExtraction(rawDocId: string): Promise<void> {
  await admin.firestore().collection("gmail_attachment_extract_tmp").doc(rawDocId).delete().catch(() => undefined);
}

// ─── Cleanup ────────────────────────────────────────────────────────────────

export async function purgeExpiredRawDocuments(limit = 50): Promise<void> {
  const cutoffIso = getNowIso();
  const stale = await admin
    .firestore()
    .collection("gmail_raw_documents_tmp")
    .where("expires_at", "<=", cutoffIso)
    .limit(limit)
    .get();
  if (stale.empty) return;
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
