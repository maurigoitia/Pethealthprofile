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
