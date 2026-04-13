import * as admin from "firebase-admin";
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGO = "aes-256-gcm";
const KEY_ENV = "GMAIL_TOKEN_ENCRYPTION_KEY";

function getKey(): Buffer {
  const hex = process.env[KEY_ENV];
  if (!hex) throw new Error(`Missing ${KEY_ENV} environment variable`);
  return Buffer.from(hex, "hex");
}

interface GmailTokenPayload {
  [key: string]: unknown;
}

/**
 * Encrypt and store a Gmail OAuth token in Firestore.
 */
export async function saveGmailToken(uid: string, payload: GmailTokenPayload): Promise<void> {
  const key = getKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, key, iv);

  const plaintext = JSON.stringify(payload);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  await admin.firestore().collection("gmail_tokens").doc(uid).set({
    iv: iv.toString("hex"),
    tag: tag.toString("hex"),
    data: encrypted.toString("hex"),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}

/**
 * Load and decrypt a stored Gmail OAuth token.
 */
export async function loadGmailToken(uid: string): Promise<GmailTokenPayload | null> {
  const doc = await admin.firestore().collection("gmail_tokens").doc(uid).get();
  if (!doc.exists) return null;

  const { iv, tag, data } = doc.data() as { iv: string; tag: string; data: string };
  const key = getKey();
  const decipher = createDecipheriv(ALGO, key, Buffer.from(iv, "hex"));
  decipher.setAuthTag(Buffer.from(tag, "hex"));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(data, "hex")),
    decipher.final(),
  ]);

  return JSON.parse(decrypted.toString("utf8"));
}

/**
 * Delete a stored Gmail OAuth token.
 */
export async function deleteGmailToken(uid: string): Promise<void> {
  await admin.firestore().collection("gmail_tokens").doc(uid).delete();
}
