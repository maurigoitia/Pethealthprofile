"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireCallableAuth = requireCallableAuth;
exports.requireHttpAuth = requireHttpAuth;
const admin = require("firebase-admin");
const functions = require("firebase-functions");
/**
 * Auth guard for callable functions.
 * Throws HttpsError("unauthenticated") if context.auth is absent.
 * Returns the authenticated uid.
 */
function requireCallableAuth(context) {
    var _a;
    if (!((_a = context.auth) === null || _a === void 0 ? void 0 : _a.uid)) {
        throw new functions.https.HttpsError("unauthenticated", "Authentication required.");
    }
    return context.auth.uid;
}
/**
 * Auth guard for HTTP functions.
 * Reads the Firebase ID token from the Authorization: Bearer <token> header,
 * verifies it with Firebase Admin, and returns the decoded uid.
 * Throws a plain Error with .status = 401 on failure (caller must handle).
 */
async function requireHttpAuth(req) {
    const authHeader = (req.headers.authorization || "").trim();
    if (!authHeader.startsWith("Bearer ")) {
        const err = new Error("Missing or invalid Authorization header");
        err.status = 401;
        throw err;
    }
    const idToken = authHeader.slice(7).trim();
    try {
        const decoded = await admin.auth().verifyIdToken(idToken);
        return decoded.uid;
    }
    catch (_a) {
        const err = new Error("Invalid or expired ID token");
        err.status = 401;
        throw err;
    }
}
//# sourceMappingURL=authGuard.js.map