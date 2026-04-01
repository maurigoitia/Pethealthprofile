import * as functions from "firebase-functions";

const ALLOWED_ORIGINS = new Set([
  "https://pessy.app",
  "https://www.pessy.app",
  "https://app.pessy.app",
  "https://polar-scene-488615-i0.web.app",
  "https://polar-scene-488615-i0.firebaseapp.com",
]);

/**
 * Sets CORS response headers, restricting the Access-Control-Allow-Origin header
 * to known Pessy origins. Falls back to pessy.app for unlisted origins.
 * Returns true if the request was an OPTIONS preflight (caller should return early).
 */
export function handleCors(
  req: functions.https.Request,
  res: functions.Response,
): boolean {
  const origin = (req.headers.origin as string) || "";
  res.set("Access-Control-Allow-Origin", ALLOWED_ORIGINS.has(origin) ? origin : "https://pessy.app");
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization, x-force-sync-key, x-brain-key, x-admin-secret");

  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return true;
  }
  return false;
}

export function chunkItems<T>(items: T[], size: number): T[][] {
  if (size <= 0) return [items];
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

export function toStringDataRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object") return {};
  const entries = Object.entries(value as Record<string, unknown>);
  const out: Record<string, string> = {};
  for (const [key, raw] of entries) {
    if (raw == null) continue;
    if (typeof raw === "string") out[key] = raw;
    else if (typeof raw === "number" || typeof raw === "boolean") out[key] = String(raw);
    else out[key] = JSON.stringify(raw);
  }
  return out;
}

export function asRecord(value: unknown): Record<string, any> {
  if (!value || typeof value !== "object") return {};
  return value as Record<string, any>;
}

export function parseIsoToMs(value: unknown): number {
  if (typeof value !== "string" || !value.trim()) return 0;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}
