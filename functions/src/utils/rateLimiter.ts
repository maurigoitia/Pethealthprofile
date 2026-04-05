/**
 * In-memory rate limiter with TTL-based cleanup.
 *
 * NOTE: This is per-instance rate limiting. In Cloud Functions each instance
 * is independent, so limits are approximate when multiple instances scale up.
 * For strict global rate limiting, use a Firestore counter instead.
 */

interface RateEntry {
  count: number;
  resetAt: number;
}

const userBuckets = new Map<string, RateEntry>();
const globalBuckets = new Map<string, RateEntry>();

let lastCleanup = Date.now();

function cleanup(): void {
  const now = Date.now();
  for (const [key, entry] of userBuckets) {
    if (now >= entry.resetAt) userBuckets.delete(key);
  }
  for (const [key, entry] of globalBuckets) {
    if (now >= entry.resetAt) globalBuckets.delete(key);
  }
  lastCleanup = now;
}

function maybeCleanup(): void {
  if (Date.now() - lastCleanup > 60_000) cleanup();
}

function check(
  buckets: Map<string, RateEntry>,
  key: string,
  limit: number,
  windowMs: number,
): boolean {
  maybeCleanup();
  const now = Date.now();
  const entry = buckets.get(key);

  if (!entry || now >= entry.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (entry.count >= limit) return false;
  entry.count++;
  return true;
}

/** Check per-user rate limit. Returns false if exceeded (→ throw 429). */
export function perUser(uid: string, limit: number, windowMs: number): boolean {
  return check(userBuckets, uid, limit, windowMs);
}

/** Check global rate limit keyed by function name or IP. Returns false if exceeded. */
export function globalLimit(key: string, limit: number, windowMs: number): boolean {
  return check(globalBuckets, key, limit, windowMs);
}
