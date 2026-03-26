"use strict";
/**
 * securityMiddleware.ts
 * Origin validation, input sanitization, and structured security event logging
 * for Firebase Cloud Functions.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateOrigin = validateOrigin;
exports.sanitizeInput = sanitizeInput;
exports.logSecurityEvent = logSecurityEvent;
// ---------------------------------------------------------------------------
// Allowed origins
// ---------------------------------------------------------------------------
const PRODUCTION_ORIGINS = [
    "https://pessy.app",
    "https://www.pessy.app",
    "https://app.pessy.app",
    "https://polar-scene-488615-i0.web.app",
    "https://polar-scene-488615-i0.firebaseapp.com",
];
// SEC-012 FIX: Localhost solo permitido fuera de produccion
const IS_PRODUCTION = process.env.NODE_ENV === "production" ||
    process.env.GCLOUD_PROJECT === "polar-scene-488615-i0";
const ALLOWED_ORIGINS = IS_PRODUCTION
    ? PRODUCTION_ORIGINS
    : [
        ...PRODUCTION_ORIGINS,
        "http://localhost",
        "http://localhost:3000",
        "http://localhost:4000",
        "http://localhost:5000",
        "http://localhost:8080",
    ];
/**
 * Check whether a request origin is trusted.
 *
 * @param origin - The value of the `Origin` header (may include protocol + host + optional port).
 * @returns `true` if the origin is in the allow-list (localhost only in dev).
 */
function validateOrigin(origin) {
    if (!origin || typeof origin !== "string")
        return false;
    const normalized = origin.trim().toLowerCase();
    // Exact match against known origins
    if (ALLOWED_ORIGINS.some((allowed) => allowed.toLowerCase() === normalized)) {
        return true;
    }
    // SEC-012 FIX: solo permitir localhost en desarrollo
    if (!IS_PRODUCTION && /^https?:\/\/localhost(:\d+)?(\/.*)?$/.test(normalized)) {
        return true;
    }
    return false;
}
// ---------------------------------------------------------------------------
// Input sanitization
// ---------------------------------------------------------------------------
const MAX_INPUT_LENGTH = 2000;
/**
 * Strip HTML tags, trim whitespace, and truncate to `MAX_INPUT_LENGTH` characters.
 * Suitable for user-supplied strings before they are stored or processed.
 *
 * @param input - Raw string from user input.
 * @returns Sanitized string, safe for logging and storage.
 */
function sanitizeInput(input) {
    if (typeof input !== "string")
        return "";
    return input
        // Remove any HTML / script tags
        .replace(/<[^>]*>/g, "")
        // Collapse multiple whitespace characters into a single space
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, MAX_INPUT_LENGTH);
}
/**
 * Log a structured security event to stdout.
 * Cloud Logging (formerly Stackdriver) picks up structured JSON written to
 * stdout in Cloud Functions and indexes each field for filtering.
 *
 * @param event - Security event payload.
 */
function logSecurityEvent(event) {
    const entry = {
        severity: "WARNING",
        message: `[SECURITY] ${event.type}`,
        security_event: Object.assign({ type: event.type, ip: event.ip, path: event.path, timestamp: new Date().toISOString() }, (event.details ? { details: event.details } : {})),
    };
    // console.warn serializes objects as JSON in Cloud Functions runtime,
    // which makes them queryable via Cloud Logging.
    console.warn(JSON.stringify(entry));
}
//# sourceMappingURL=securityMiddleware.js.map