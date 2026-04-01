import * as admin from "firebase-admin";
import * as functions from "firebase-functions";

/**
 * Auth guard for callable functions.
 * Throws HttpsError("unauthenticated") if context.auth is absent.
 * Returns the authenticated uid.
 */
export function requireCallableAuth(
  context: functions.https.CallableContext,
): string {
  if (!context.auth?.uid) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "Authentication required.",
    );
  }
  return context.auth.uid;
}

/**
 * Auth guard for HTTP functions.
 * Reads the Firebase ID token from the Authorization: Bearer <token> header,
 * verifies it with Firebase Admin, and returns the decoded uid.
 * Throws a plain Error with .status = 401 on failure (caller must handle).
 */
export async function requireHttpAuth(
  req: functions.https.Request,
): Promise<string> {
  const authHeader = (req.headers.authorization || "").trim();
  if (!authHeader.startsWith("Bearer ")) {
    const err = new Error("Missing or invalid Authorization header") as Error & { status: number };
    err.status = 401;
    throw err;
  }
  const idToken = authHeader.slice(7).trim();
  try {
    const decoded = await admin.auth().verifyIdToken(idToken);
    return decoded.uid;
  } catch {
    const err = new Error("Invalid or expired ID token") as Error & { status: number };
    err.status = 401;
    throw err;
  }
}
