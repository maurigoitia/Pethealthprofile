import * as admin from "firebase-admin";
import {
  QueueJobStage,
  QueueJobStatus,
  AttachmentQueueJobPayload,
  AiExtractQueueJobPayload,
  RawDocumentLike,
} from "./types";
import { getNowIso, asRecord, encryptText, decryptText, sha256 } from "./utils";
import { RAW_DOCUMENT_TTL_MS } from "./types";

/**
 * Guarda un documento crudo encriptado de forma temporal para que el
 * siguiente worker lo procese sin volver a llamar a la API de Gmail.
 */
export async function persistTemporaryRawDocument(args: {
  uid: string;
  sessionId: string;
  rawDocument: RawDocumentLike;
  sourceSender: string;
  sourceSubject: string;
}): Promise<string> {
  const docId = `${args.sessionId}_${args.rawDocument.message_id}`;
  const encrypted = encryptText(args.rawDocument.body_text);
  const expiresAt = new Date(Date.now() + RAW_DOCUMENT_TTL_MS).toISOString();

  await admin
    .firestore()
    .collection("gmail_raw_documents_tmp")
    .doc(docId)
    .set(
      {
        doc_id: docId,
        session_id: args.sessionId,
        user_id: args.uid,
        source_sender: args.sourceSender,
        source_subject: args.sourceSubject,
        body_text_encrypted: encrypted,
        expires_at: expiresAt,
        created_at: getNowIso(),
      },
      { merge: true }
    );

  return docId;
}

/**
 * Carga el documento temporal y lo desencripta para el worker de AI.
 */
export async function loadTemporaryRawDocument(docId: string) {
  const snap = await admin.firestore().collection("gmail_raw_documents_tmp").doc(docId).get();
  if (!snap.exists) return null;
  const data = asRecord(snap.data());
  const encrypted = asRecord(data.body_text_encrypted);

  try {
    const bodyText = decryptText({
      ciphertext: String(encrypted.ciphertext),
      iv: String(encrypted.iv),
      tag: String(encrypted.tag),
    });
    return { ...data, bodyText };
  } catch (e) {
    return null;
  }
}

/**
 * Marca el progreso de un job en la cola.
 */
export async function markJobStatus(
  collection: string,
  docId: string,
  status: QueueJobStatus,
  error?: any
) {
  await admin
    .firestore()
    .collection(collection)
    .doc(docId)
    .update({
      status,
      updated_at: getNowIso(),
      ...(error ? { error: String(error) } : {}),
    });
}
