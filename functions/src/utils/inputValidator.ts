import * as functions from "firebase-functions";

/**
 * Trims and validates a string field.
 * Throws HttpsError("invalid-argument") if the value isn't a string or exceeds maxLen.
 */
export function validateString(val: unknown, maxLen: number, fieldName = "field"): string {
  if (typeof val !== "string") {
    throw new functions.https.HttpsError(
      "invalid-argument",
      `${fieldName} must be a string.`,
    );
  }
  const trimmed = val.trim();
  if (trimmed.length > maxLen) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      `${fieldName} exceeds maximum length of ${maxLen}.`,
    );
  }
  return trimmed;
}

/**
 * Asserts that all required fields exist and are non-empty on obj.
 * Throws HttpsError("invalid-argument") listing the first missing field.
 */
export function validateRequired(
  obj: Record<string, unknown>,
  fields: string[],
): void {
  for (const field of fields) {
    const val = obj[field];
    if (val === undefined || val === null || val === "") {
      throw new functions.https.HttpsError(
        "invalid-argument",
        `Missing required field: ${field}.`,
      );
    }
  }
}

/**
 * Returns a shallow copy of obj containing only the keys in allowedFields.
 * Use this to strip unexpected / injected fields from user input.
 */
export function sanitizeInput<T extends Record<string, unknown>>(
  obj: T,
  allowedFields: string[],
): Partial<T> {
  const allowed = new Set(allowedFields);
  return Object.fromEntries(
    Object.entries(obj).filter(([key]) => allowed.has(key)),
  ) as Partial<T>;
}
