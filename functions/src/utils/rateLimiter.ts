import * as admin from "firebase-admin";

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  resetInSeconds: number;
}

/**
 * Check rate limit for a user action by tier (free vs premium).
 * Uses Firestore counters with TTL-based reset windows.
 */
export async function checkRateLimitByTier(
  uid: string,
  action: string,
  isPremium: boolean
): Promise<RateLimitResult> {
  const limits: Record<string, { free: number; premium: number; windowMs: number }> = {
    "document-scan": { free: 5, premium: 50, windowMs: 24 * 60 * 60 * 1000 },
    "gmail-sync": { free: 3, premium: 20, windowMs: 60 * 60 * 1000 },
    "brain-query": { free: 10, premium: 100, windowMs: 60 * 60 * 1000 },
    default: { free: 10, premium: 50, windowMs: 60 * 60 * 1000 },
  };

  const config = limits[action] || limits.default;
  const maxRequests = isPremium ? config.premium : config.free;
  const windowMs = config.windowMs;

  const db = admin.firestore();
  const counterRef = db.collection("rate_limits").doc(`${uid}_${action}`);

  const now = Date.now();
  const doc = await counterRef.get();
  const data = doc.data();

  if (!data || (data.windowStart && now - data.windowStart > windowMs)) {
    // New window
    await counterRef.set({ count: 1, windowStart: now });
    return { allowed: true, remaining: maxRequests - 1, resetAt: new Date(now + windowMs), resetInSeconds: Math.ceil(windowMs / 1000) };
  }

  if (data.count >= maxRequests) {
    const resetAt = new Date(data.windowStart + windowMs);
    const resetInSeconds = Math.max(0, Math.ceil((data.windowStart + windowMs - now) / 1000));
    return { allowed: false, remaining: 0, resetAt, resetInSeconds };
  }

  const resetInSeconds = Math.max(0, Math.ceil((data.windowStart + windowMs - now) / 1000));
  await counterRef.update({ count: admin.firestore.FieldValue.increment(1) });
  return {
    allowed: true,
    remaining: maxRequests - data.count - 1,
    resetAt: new Date(data.windowStart + windowMs),
    resetInSeconds,
  };
}
