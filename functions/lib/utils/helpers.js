"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleCors = handleCors;
exports.chunkItems = chunkItems;
exports.toStringDataRecord = toStringDataRecord;
exports.asRecord = asRecord;
exports.parseIsoToMs = parseIsoToMs;
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
function handleCors(req, res) {
    const origin = req.headers.origin || "";
    res.set("Access-Control-Allow-Origin", ALLOWED_ORIGINS.has(origin) ? origin : "https://pessy.app");
    res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type, Authorization, x-force-sync-key, x-brain-key, x-admin-secret");
    if (req.method === "OPTIONS") {
        res.status(204).send("");
        return true;
    }
    return false;
}
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