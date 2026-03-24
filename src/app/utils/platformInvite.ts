import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  setDoc,
  Timestamp,
  where,
} from "firebase/firestore";
import { db } from "../../lib/firebase";
import { buildAuthActionUrl } from "./authActionLinks";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Charset excludes I, O, 0, 1 to avoid visual ambiguity. */
const INVITE_CHARSET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** Length of platform invite codes. */
const PLATFORM_INVITE_CODE_LENGTH = 6;

/** Length of access tokens issued to waitlist applicants. */
const ACCESS_TOKEN_LENGTH = 8;

/** Platform invite TTL in milliseconds (24 hours). */
const PLATFORM_INVITE_TTL_MS = 24 * 60 * 60 * 1000;

/** Waitlist access token TTL in milliseconds (24 hours). */
const ACCESS_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

/** localStorage key for pending platform invite code. */
export const PLATFORM_INVITE_STORAGE_KEY = "pessy_pending_platform_invite";

// ---------------------------------------------------------------------------
// Code generation
// ---------------------------------------------------------------------------

/** Generates a random string of `length` chars from `INVITE_CHARSET`. */
const generateCode = (length: number): string => {
  const result: string[] = [];
  for (let i = 0; i < length; i++) {
    result.push(INVITE_CHARSET[Math.floor(Math.random() * INVITE_CHARSET.length)]!);
  }
  return result.join("");
};

/** Generates a 6-char platform invite code. */
export const generatePlatformInviteCode = (): string =>
  generateCode(PLATFORM_INVITE_CODE_LENGTH);

/** Generates an 8-char waitlist access token. */
export const generateAccessToken = (): string => generateCode(ACCESS_TOKEN_LENGTH);

// ---------------------------------------------------------------------------
// Normalization
// ---------------------------------------------------------------------------

export const normalizePlatformInviteCode = (value?: string | null): string =>
  (value || "").trim().toUpperCase();

// ---------------------------------------------------------------------------
// Firestore document shape
// ---------------------------------------------------------------------------

export interface PlatformInvitationDoc {
  type: "platform";
  code: string;
  createdBy: string;
  createdAt: Timestamp;
  expiresAt: Timestamp;
  used: boolean;
  usedBy?: string;
  usedAt?: Timestamp;
}

export interface AccessRequestDoc {
  token: string;
  email: string;
  name?: string;
  docId?: string;
  createdAt: Timestamp;
  expiresAt: Timestamp;
  used: boolean;
  usedBy?: string;
  usedAt?: Timestamp;
}

// ---------------------------------------------------------------------------
// Create invitation
// ---------------------------------------------------------------------------

/**
 * Creates a platform invitation document in the `invitations` Firestore
 * collection and returns the generated invite code.
 *
 * @param createdBy - UID of the admin/user creating the invite.
 */
export const createPlatformInvitation = async (createdBy: string): Promise<string> => {
  const code = generatePlatformInviteCode();
  const now = Timestamp.now();
  const expiresAt = Timestamp.fromMillis(now.toMillis() + PLATFORM_INVITE_TTL_MS);

  const invitationData: PlatformInvitationDoc = {
    type: "platform",
    code,
    createdBy,
    createdAt: now,
    expiresAt,
    used: false,
  };

  const ref = doc(collection(db, "invitations"), code);
  await setDoc(ref, invitationData);

  return code;
};

// ---------------------------------------------------------------------------
// Validate invitation
// ---------------------------------------------------------------------------

export type PlatformInviteValidationResult =
  | { valid: true; doc: PlatformInvitationDoc }
  | { valid: false; reason: "not_found" | "wrong_type" | "already_used" | "expired" };

/**
 * Validates a platform invite code by checking existence, type, used status,
 * and expiration. Does NOT mark the invite as used — call `markPlatformInviteUsed`
 * in the same flow after account creation.
 */
export const validatePlatformInviteCode = async (
  rawCode: string
): Promise<PlatformInviteValidationResult> => {
  const code = normalizePlatformInviteCode(rawCode);
  if (!code) return { valid: false, reason: "not_found" };

  const ref = doc(db, "invitations", code);
  const snap = await getDoc(ref);

  if (!snap.exists()) return { valid: false, reason: "not_found" };

  const data = snap.data() as PlatformInvitationDoc;

  if (data.type !== "platform") return { valid: false, reason: "wrong_type" };
  if (data.used) return { valid: false, reason: "already_used" };
  if (data.expiresAt.toMillis() < Date.now()) return { valid: false, reason: "expired" };

  return { valid: true, doc: data };
};

// ---------------------------------------------------------------------------
// Mark invite as used (transactional)
// ---------------------------------------------------------------------------

/**
 * Marks a platform invite as used inside a Firestore transaction to prevent
 * race conditions / double-use.
 *
 * @param code   - The raw or normalized invite code.
 * @param userId - UID of the user who just registered.
 * @throws If the invite is not found, wrong type, already used, or expired.
 */
export const markPlatformInviteUsed = async (
  code: string,
  userId: string
): Promise<void> => {
  const normalizedCode = normalizePlatformInviteCode(code);
  const ref = doc(db, "invitations", normalizedCode);

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);

    if (!snap.exists()) throw new Error("platform_invite_not_found");

    const data = snap.data() as PlatformInvitationDoc;

    if (data.type !== "platform") throw new Error("platform_invite_wrong_type");
    if (data.used) throw new Error("platform_invite_already_used");
    if (data.expiresAt.toMillis() < Date.now()) throw new Error("platform_invite_expired");

    tx.update(ref, {
      used: true,
      usedBy: userId,
      usedAt: Timestamp.now(),
    });
  });
};

// ---------------------------------------------------------------------------
// Validate waitlist access token
// ---------------------------------------------------------------------------

export type AccessTokenValidationResult =
  | { valid: true; doc: AccessRequestDoc }
  | { valid: false; reason: "not_found" | "already_used" | "expired" };

/**
 * Validates a waitlist access token from the `access_requests` collection.
 * Does NOT mark the token as used.
 */
export const validateAccessToken = async (
  token: string
): Promise<AccessTokenValidationResult> => {
  const normalizedToken = token.trim().toUpperCase();
  if (!normalizedToken) return { valid: false, reason: "not_found" };

  // Query by accessToken field (docs have auto-generated IDs)
  const q = query(
    collection(db, "access_requests"),
    where("accessToken", "==", normalizedToken),
    where("status", "==", "approved")
  );
  const snapshot = await getDocs(q);

  if (snapshot.empty) return { valid: false, reason: "not_found" };

  const docSnap = snapshot.docs[0]!;
  const data = docSnap.data();

  if (data.used) return { valid: false, reason: "already_used" };
  if (data.accessTokenExpiresAt?.toMillis() < Date.now()) return { valid: false, reason: "expired" };

  return {
    valid: true,
    doc: {
      token: normalizedToken,
      email: data.email,
      name: data.name,
      createdAt: data.createdAt,
      expiresAt: data.accessTokenExpiresAt,
      used: data.used ?? false,
      docId: docSnap.id,
    } as AccessRequestDoc & { name?: string; docId: string },
  };
};

/**
 * Marks a waitlist access token as used inside a Firestore transaction.
 *
 * @param token  - The raw or normalized access token.
 * @param userId - UID of the user who just registered.
 * @throws If the token is not found, already used, or expired.
 */
export const markAccessTokenUsed = async (
  token: string,
  userId: string
): Promise<void> => {
  const normalizedToken = token.trim().toUpperCase();

  // Find the doc by accessToken field (auto-generated ID)
  const q = query(
    collection(db, "access_requests"),
    where("accessToken", "==", normalizedToken)
  );
  const snapshot = await getDocs(q);
  if (snapshot.empty) throw new Error("access_token_not_found");

  const docRef = snapshot.docs[0]!.ref;

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(docRef);
    if (!snap.exists()) throw new Error("access_token_not_found");

    const data = snap.data();
    if (data.used) throw new Error("access_token_already_used");

    tx.update(docRef, {
      used: true,
      usedBy: userId,
      usedAt: Timestamp.now(),
    });
  });
};

// ---------------------------------------------------------------------------
// URL building
// ---------------------------------------------------------------------------

/**
 * Builds a platform invite URL using the `?ref=CODE` query param.
 * Note: `?invite=` is reserved for co-tutor invites.
 */
export const buildPlatformInviteUrl = (inviteCode: string): string =>
  buildAuthActionUrl("/register-user", { ref: normalizePlatformInviteCode(inviteCode) });

// ---------------------------------------------------------------------------
// localStorage helpers
// ---------------------------------------------------------------------------

export const rememberPendingPlatformInvite = (inviteCode?: string | null): void => {
  const normalized = normalizePlatformInviteCode(inviteCode);
  if (!normalized) return;
  localStorage.setItem(PLATFORM_INVITE_STORAGE_KEY, normalized);
};

export const readPendingPlatformInvite = (): string =>
  normalizePlatformInviteCode(localStorage.getItem(PLATFORM_INVITE_STORAGE_KEY));

export const clearPendingPlatformInvite = (): void => {
  localStorage.removeItem(PLATFORM_INVITE_STORAGE_KEY);
};
