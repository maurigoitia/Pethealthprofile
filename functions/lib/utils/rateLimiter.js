"use strict";
/**
 * rateLimiter.ts
 * In-memory rate limiting utility for Firebase Cloud Functions.
 * Uses a Map keyed by IP address; auto-cleans expired entries every 5 minutes.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AUTH_RATE_LIMIT = void 0;
exports.checkRateLimit = checkRateLimit;
exports.withRateLimit = withRateLimit;
// Defaults
const DEFAULT_LIMIT = 100;
const DEFAULT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
/** Stricter limit for auth-related endpoints: 10 req / 15 min */
exports.AUTH_RATE_LIMIT = {
    limit: 10,
    windowMs: DEFAULT_WINDOW_MS,
};
// Internal store: ip -> RateLimitEntry
const store = new Map();
// Auto-cleanup: remove entries whose window has already expired
function cleanupExpired() {
    const now = Date.now();
    for (const [ip, entry] of store.entries()) {
        if (now >= entry.resetTime) {
            store.delete(ip);
        }
    }
}
// Schedule cleanup every 5 minutes.
// setInterval is kept alive for the lifetime of the Cloud Function instance.
setInterval(cleanupExpired, CLEANUP_INTERVAL_MS);
/**
 * Check whether a given IP is within its rate limit.
 *
 * @param ip       - Client IP address used as the rate-limit key.
 * @param limit    - Maximum allowed requests per window (default 100).
 * @param windowMs - Length of the sliding window in ms (default 15 min).
 * @returns { allowed, remaining } — `allowed` is false once the limit is hit.
 */
function checkRateLimit(ip, limit = DEFAULT_LIMIT, windowMs = DEFAULT_WINDOW_MS) {
    const now = Date.now();
    const existing = store.get(ip);
    if (!existing || now >= existing.resetTime) {
        // First request in this window (or window just expired)
        store.set(ip, { count: 1, resetTime: now + windowMs });
        return { allowed: true, remaining: limit - 1 };
    }
    existing.count += 1;
    if (existing.count > limit) {
        return { allowed: false, remaining: 0 };
    }
    return { allowed: true, remaining: limit - existing.count };
}
/**
 * Higher-order wrapper that applies rate limiting before calling the handler.
 * Works with plain Express-style request/response objects used by Firebase
 * HTTPS callable wrappers and onRequest functions.
 *
 * Usage:
 *   export const myFn = functions.https.onRequest(
 *     withRateLimit(async (req, res) => { ... })
 *   );
 *
 * @param handler - The original request handler.
 * @param options - Optional overrides for limit and windowMs.
 */
function withRateLimit(handler, options) {
    var _a, _b;
    const limit = (_a = options === null || options === void 0 ? void 0 : options.limit) !== null && _a !== void 0 ? _a : DEFAULT_LIMIT;
    const windowMs = (_b = options === null || options === void 0 ? void 0 : options.windowMs) !== null && _b !== void 0 ? _b : DEFAULT_WINDOW_MS;
    return async (req, res) => {
        var _a, _b, _c, _d;
        // Prefer the forwarded IP when behind Cloud Load Balancer / Firebase hosting
        const ip = ((_c = (_b = (_a = req.headers) === null || _a === void 0 ? void 0 : _a["x-forwarded-for"]) === null || _b === void 0 ? void 0 : _b.split(",")[0]) === null || _c === void 0 ? void 0 : _c.trim()) ||
            req.ip ||
            ((_d = req.connection) === null || _d === void 0 ? void 0 : _d.remoteAddress) ||
            "unknown";
        const result = checkRateLimit(ip, limit, windowMs);
        // Expose standard rate-limit response headers
        res.set("X-RateLimit-Limit", String(limit));
        res.set("X-RateLimit-Remaining", String(result.remaining));
        if (!result.allowed) {
            res.set("Retry-After", String(Math.ceil(windowMs / 1000)));
            res.status(429).json({
                error: "Too Many Requests",
                message: "Rate limit exceeded. Please try again later.",
            });
            return;
        }
        await handler(req, res);
    };
}
//# sourceMappingURL=rateLimiter.js.map