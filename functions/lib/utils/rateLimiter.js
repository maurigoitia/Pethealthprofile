"use strict";
/**
 * In-memory rate limiter with TTL-based cleanup.
 *
 * NOTE: This is per-instance rate limiting. In Cloud Functions each instance
 * is independent, so limits are approximate when multiple instances scale up.
 * For strict global rate limiting, use a Firestore counter instead.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.perUser = perUser;
exports.globalLimit = globalLimit;
const userBuckets = new Map();
const globalBuckets = new Map();
let lastCleanup = Date.now();
function cleanup() {
    const now = Date.now();
    for (const [key, entry] of userBuckets) {
        if (now >= entry.resetAt)
            userBuckets.delete(key);
    }
    for (const [key, entry] of globalBuckets) {
        if (now >= entry.resetAt)
            globalBuckets.delete(key);
    }
    lastCleanup = now;
}
function maybeCleanup() {
    if (Date.now() - lastCleanup > 60000)
        cleanup();
}
function check(buckets, key, limit, windowMs) {
    maybeCleanup();
    const now = Date.now();
    const entry = buckets.get(key);
    if (!entry || now >= entry.resetAt) {
        buckets.set(key, { count: 1, resetAt: now + windowMs });
        return true;
    }
    if (entry.count >= limit)
        return false;
    entry.count++;
    return true;
}
/** Check per-user rate limit. Returns false if exceeded (→ throw 429). */
function perUser(uid, limit, windowMs) {
    return check(userBuckets, uid, limit, windowMs);
}
/** Check global rate limit keyed by function name or IP. Returns false if exceeded. */
function globalLimit(key, limit, windowMs) {
    return check(globalBuckets, key, limit, windowMs);
}
//# sourceMappingURL=rateLimiter.js.map