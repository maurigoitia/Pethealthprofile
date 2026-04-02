"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateString = validateString;
exports.validateRequired = validateRequired;
exports.sanitizeInput = sanitizeInput;
const functions = require("firebase-functions");
/**
 * Trims and validates a string field.
 * Throws HttpsError("invalid-argument") if the value isn't a string or exceeds maxLen.
 */
function validateString(val, maxLen, fieldName = "field") {
    if (typeof val !== "string") {
        throw new functions.https.HttpsError("invalid-argument", `${fieldName} must be a string.`);
    }
    const trimmed = val.trim();
    if (trimmed.length > maxLen) {
        throw new functions.https.HttpsError("invalid-argument", `${fieldName} exceeds maximum length of ${maxLen}.`);
    }
    return trimmed;
}
/**
 * Asserts that all required fields exist and are non-empty on obj.
 * Throws HttpsError("invalid-argument") listing the first missing field.
 */
function validateRequired(obj, fields) {
    for (const field of fields) {
        const val = obj[field];
        if (val === undefined || val === null || val === "") {
            throw new functions.https.HttpsError("invalid-argument", `Missing required field: ${field}.`);
        }
    }
}
/**
 * Returns a shallow copy of obj containing only the keys in allowedFields.
 * Use this to strip unexpected / injected fields from user input.
 */
function sanitizeInput(obj, allowedFields) {
    const allowed = new Set(allowedFields);
    return Object.fromEntries(Object.entries(obj).filter(([key]) => allowed.has(key)));
}
//# sourceMappingURL=inputValidator.js.map