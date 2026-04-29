/**
 * publicId.ts — Pack ID generator for user-facing pet identity.
 *
 * Format: `pet-XXXXXX` (6 chars, lowercase alphanumeric).
 * Alphabet omits ambiguous characters (0, O, 1, l, i) to avoid confusion
 * when users read or type the ID aloud.
 *
 * The internal Firestore document `petId` stays unchanged — `publicId`
 * is the human-readable handle shown in UI (e.g. vaccination card).
 */

// 32-char alphabet — no 0, O, 1, l, i.
const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
const ID_LENGTH = 6;

/**
 * Generates a new Pack ID like `pet-abc234`.
 * Uses crypto.getRandomValues when available for unbiased randomness.
 */
export function generatePublicId(): string {
  const len = ALPHABET.length;
  let id = "";

  // Prefer crypto.getRandomValues (browser + modern Node) for better entropy.
  const cryptoObj: Crypto | undefined =
    typeof globalThis !== "undefined" && (globalThis as { crypto?: Crypto }).crypto
      ? (globalThis as { crypto?: Crypto }).crypto
      : undefined;

  if (cryptoObj && typeof cryptoObj.getRandomValues === "function") {
    const buf = new Uint8Array(ID_LENGTH);
    cryptoObj.getRandomValues(buf);
    for (let i = 0; i < ID_LENGTH; i++) {
      id += ALPHABET[buf[i] % len];
    }
  } else {
    for (let i = 0; i < ID_LENGTH; i++) {
      id += ALPHABET[Math.floor(Math.random() * len)];
    }
  }

  return `pet-${id}`;
}
