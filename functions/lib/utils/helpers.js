"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.chunkItems = chunkItems;
exports.toStringDataRecord = toStringDataRecord;
exports.asRecord = asRecord;
exports.parseIsoToMs = parseIsoToMs;
function chunkItems(items, size) {
    if (size <= 0)
        return [items];
    const chunks = [];
    for (let i = 0; i < items.length; i += size) {
        chunks.push(items.slice(i, i + size));
    }
    return chunks;
}
function toStringDataRecord(value) {
    if (!value || typeof value !== "object")
        return {};
    const entries = Object.entries(value);
    const out = {};
    for (const [key, raw] of entries) {
        if (raw == null)
            continue;
        if (typeof raw === "string")
            out[key] = raw;
        else if (typeof raw === "number" || typeof raw === "boolean")
            out[key] = String(raw);
        else
            out[key] = JSON.stringify(raw);
    }
    return out;
}
function asRecord(value) {
    if (!value || typeof value !== "object")
        return {};
    return value;
}
function parseIsoToMs(value) {
    if (typeof value !== "string" || !value.trim())
        return 0;
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : parsed;
}
//# sourceMappingURL=helpers.js.map