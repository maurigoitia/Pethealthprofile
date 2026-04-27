/**
 * SECURITY CONFIG & HELPERS
 * ═════════════════════════════════════════════════════════════════════════
 * Rate limiting, input sanitization, and auth validation patterns
 * for scalable backend (50K users target)
 * ═════════════════════════════════════════════════════════════════════════
 */

import type { User } from "firebase/auth";

// ─────────────────────────────────────────────────────────────────────────
// RATE LIMITING CONFIGURATION
// ─────────────────────────────────────────────────────────────────────────

export interface RateLimitConfig {
  windowMs: number;      // Window in milliseconds
  maxRequests: number;   // Max requests per window
  keyGenerator?: (context: any) => string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

/**
 * Predefined rate limiting configs for different endpoints
 * Para implementar en Cloud Functions
 */
export const RATE_LIMIT_PRESETS = {
  /**
   * Análisis clínico (ingestHistory, brainResolver)
   * Heavy operations, expensive AI calls
   */
  CLINICAL_ANALYSIS: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 10,            // 10 análisis por hora max
  } as RateLimitConfig,

  /**
   * Gmail sync (clinicalIngestion)
   * Expensive Pub/Sub operations
   */
  GMAIL_SYNC: {
    windowMs: 24 * 60 * 60 * 1000, // 24 hours
    maxRequests: 5,                  // 5 sincronizaciones por día
  } as RateLimitConfig,

  /**
   * Pet management (create, update, delete)
   * Standard CRUD operations
   */
  PET_MANAGEMENT: {
    windowMs: 60 * 1000,  // 1 minute
    maxRequests: 50,      // 50 requests per minute
  } as RateLimitConfig,

  /**
   * Medical event creation
   * High frequency but bounded
   */
  MEDICAL_EVENTS: {
    windowMs: 60 * 1000,  // 1 minute
    maxRequests: 100,     // 100 events per minute
  } as RateLimitConfig,

  /**
   * File uploads (Storage)
   * Monitor size and frequency
   */
  FILE_UPLOAD: {
    windowMs: 60 * 1000,  // 1 minute
    maxRequests: 10,      // 10 uploads per minute
  } as RateLimitConfig,

  /**
   * Auth endpoints (login, register, password reset)
   * Security-critical
   */
  AUTH_ENDPOINTS: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5,             // 5 attempts per 15 mins (brute force protection)
  } as RateLimitConfig,

  /**
   * General API fallback
   * Conservative default
   */
  DEFAULT: {
    windowMs: 60 * 1000,  // 1 minute
    maxRequests: 60,      // 60 requests per minute
  } as RateLimitConfig,
} as const;

// ─────────────────────────────────────────────────────────────────────────
// INPUT SANITIZATION & VALIDATION
// ─────────────────────────────────────────────────────────────────────────

/**
 * Sanitize string input to prevent XSS/injection attacks
 * Use in Cloud Functions before processing user input
 */
export function sanitizeInput(input: unknown): string {
  if (typeof input !== "string") {
    throw new Error("Input debe ser string");
  }

  return input
    .trim()
    .substring(0, 10000) // Max 10KB per string
    .replace(/[<>]/g, "") // Remove HTML chars
    .replace(/javascript:/gi, "") // Remove javascript: protocol
    .replace(/on\w+\s*=/gi, ""); // Remove event handlers
}

/**
 * Sanitize email for security validation
 */
export function sanitizeEmail(email: unknown): string {
  const sanitized = sanitizeInput(email);
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailRegex.test(sanitized)) {
    throw new Error("Email inválido");
  }

  return sanitized.toLowerCase();
}

/**
 * Sanitize pet ID (Firestore document ID format)
 * Firestore IDs: alphanumeric + underscore/hyphen
 */
export function sanitizePetId(petId: unknown): string {
  if (typeof petId !== "string") {
    throw new Error("petId debe ser string");
  }

  const sanitized = petId.substring(0, 255);

  if (!/^[a-zA-Z0-9_-]+$/.test(sanitized)) {
    throw new Error("petId inválido");
  }

  return sanitized;
}

/**
 * Validate and sanitize user ID (Firebase UID format)
 * UIDs are typically 28 alphanumeric characters
 */
export function sanitizeUserId(userId: unknown): string {
  if (typeof userId !== "string") {
    throw new Error("userId debe ser string");
  }

  const sanitized = userId.substring(0, 128);

  if (!/^[a-zA-Z0-9_-]+$/.test(sanitized)) {
    throw new Error("userId inválido");
  }

  return sanitized;
}

/**
 * Validate medical event object structure
 * Ensure no unexpected fields, correct types
 */
export function validateMedicalEvent(data: unknown): Record<string, any> {
  if (typeof data !== "object" || data === null) {
    throw new Error("Evento médico debe ser un objeto");
  }

  const obj = data as Record<string, any>;
  const allowed = new Set([
    "petId",
    "userId",
    "type",
    "date",
    "time",
    "clinic",
    "veterinarian",
    "notes",
    "title",
    "status",
    "createdAt",
    "updatedAt",
  ]);

  // Check for unexpected fields
  for (const key of Object.keys(obj)) {
    if (!allowed.has(key)) {
      throw new Error(`Campo no permitido: ${key}`);
    }
  }

  // Validate required fields
  if (!obj.petId || typeof obj.petId !== "string") {
    throw new Error("petId requerido");
  }

  if (!obj.type || typeof obj.type !== "string") {
    throw new Error("type requerido");
  }

  // Validate date format if present
  if (obj.date && typeof obj.date === "string") {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(obj.date)) {
      throw new Error("Fecha debe ser YYYY-MM-DD");
    }
  }

  // Validate time format if present
  if (obj.time && typeof obj.time === "string") {
    if (!/^\d{2}:\d{2}$/.test(obj.time)) {
      throw new Error("Hora debe ser HH:MM");
    }
  }

  return obj;
}

/**
 * Validate document size (Firestore limit: 1MB per doc)
 * Recommend max: 500KB for safety margin
 */
export function validateDocumentSize(data: unknown): void {
  const jsonStr = JSON.stringify(data);
  const sizeKb = new Blob([jsonStr]).size / 1024;

  if (sizeKb > 500) {
    throw new Error(
      `Documento muy grande: ${sizeKb.toFixed(2)}KB (máximo 500KB)`
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────
// AUTH VALIDATION PATTERNS
// ─────────────────────────────────────────────────────────────────────────

/**
 * Pattern: Verify user is authenticated
 * Use in callables: if (!context.auth?.uid) throw new HttpsError('unauthenticated')
 */
export function requireAuth(uid: string | undefined): asserts uid is string {
  if (!uid) {
    throw new Error("Autenticación requerida");
  }
}

/**
 * Pattern: Verify user owns a pet
 * Typical usage in Cloud Functions:
 * const petSnap = await db.collection("pets").doc(petId).get();
 * verifyPetOwnership(petSnap.data(), uid);
 */
export function verifyPetOwnership(
  petData: any,
  userId: string
): asserts petData {
  if (!petData) {
    throw new Error("Mascota no encontrada");
  }

  if (petData.ownerId !== userId) {
    throw new Error("No tenés acceso a esta mascota");
  }
}

/**
 * Pattern: Verify user is co-tutor of pet
 */
export function verifyPetAccess(
  petData: any,
  userId: string
): asserts petData {
  if (!petData) {
    throw new Error("Mascota no encontrada");
  }

  const isOwner = petData.ownerId === userId;
  const isCoTutor =
    Array.isArray(petData.coTutorUids) && petData.coTutorUids.includes(userId);

  if (!isOwner && !isCoTutor) {
    throw new Error("No tenés acceso a esta mascota");
  }
}

/**
 * Pattern: Check if user is admin
 * Use with Firebase custom claims:
 * const decodedToken = await admin.auth().verifyIdToken(token);
 * if (!decodedToken.admin) throw error
 */
export function requireAdmin(decodedToken: any): asserts decodedToken {
  if (!decodedToken?.admin) {
    throw new Error("Admin access requerido");
  }
}

// ─────────────────────────────────────────────────────────────────────────
// ERROR HANDLING PATTERNS
// ─────────────────────────────────────────────────────────────────────────

export interface StructuredError {
  code: string;
  message: string;
  statusCode: number;
  details?: Record<string, any>;
  timestamp: string;
}

/**
 * Create structured error for Cloud Function responses
 * Use this for consistent error logging and monitoring
 */
export function createStructuredError(
  code: string,
  message: string,
  statusCode: number = 500,
  details?: Record<string, any>
): StructuredError {
  return {
    code,
    message,
    statusCode,
    details,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Wrap Cloud Function logic with error handling
 * Usage:
 * export const myFunction = functions.https.onCall(
 *   withErrorHandler(async (data, context) => {
 *     // your logic
 *   })
 * );
 */
export function withErrorHandler(
  fn: (data: any, context: any) => Promise<any>
) {
  return async (data: any, context: any) => {
    try {
      return await fn(data, context);
    } catch (error) {
      console.error("[Function Error]", {
        error,
        uid: context.auth?.uid,
        timestamp: new Date().toISOString(),
      });

      if (error instanceof Error) {
        throw new Error(error.message);
      }
      throw error;
    }
  };
}

// ─────────────────────────────────────────────────────────────────────────
// CORS CONFIGURATION
// ─────────────────────────────────────────────────────────────────────────

/**
 * CORS headers for Cloud Functions
 * Agregar a funciones HTTP que son llamadas desde cliente
 */
export const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "https://pessy.app",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
} as const;

/**
 * Verificar origin en Cloud Functions
 */
export function verifyCorsOrigin(origin: string | undefined): boolean {
  const allowed = [
    "https://pessy.app",
    "https://app.pessy.app",
    "https://qa.pessy.app",
    "https://localhost:5173", // local dev
    "http://localhost:5173",
  ];

  return allowed.includes(origin || "");
}

// ─────────────────────────────────────────────────────────────────────────
// SECURITY CONSTANTS
// ─────────────────────────────────────────────────────────────────────────

export const SECURITY_CONSTANTS = {
  /**
   * Max document size in bytes (Firestore limit: 1MB)
   * Setting to 500KB for safety margin
   */
  MAX_DOC_SIZE_BYTES: 500 * 1024,

  /**
   * Max Storage file size in bytes
   * Current limit: 30MB (storage.rules)
   */
  MAX_UPLOAD_SIZE_BYTES: 30 * 1024 * 1024,

  /**
   * Max string field length in bytes
   */
  MAX_STRING_LENGTH: 10000,

  /**
   * Cloud Function timeout (seconds)
   * Firebase default: 60s, should increase to 540s for batch operations
   */
  FUNCTION_TIMEOUT_SECONDS: 540,

  /**
   * Gemini API timeout (seconds)
   * Prevent Cloud Function timeouts waiting for AI
   */
  GEMINI_TIMEOUT_SECONDS: 30,

  /**
   * FCM notification max size (bytes)
   * FCM limit: 4KB, but recommend 2KB for safety
   */
  FCM_NOTIFICATION_MAX_SIZE: 2048,

  /**
   * Batch operation size
   * Firestore batch.commit() max: 500 operations
   */
  FIRESTORE_BATCH_SIZE: 500,

  /**
   * Retry attempts for failed operations
   * Exponential backoff: 1s, 2s, 4s, 8s...
   */
  RETRY_ATTEMPTS: 4,

  /**
   * Initial backoff milliseconds for retries
   */
  RETRY_INITIAL_BACKOFF_MS: 1000,
} as const;

// ─────────────────────────────────────────────────────────────────────────
// VALIDATION SCHEMAS (TypeScript guards)
// ─────────────────────────────────────────────────────────────────────────

/**
 * Type guard: Check if value is valid petId
 */
export function isPetId(value: unknown): value is string {
  return typeof value === "string" && /^[a-zA-Z0-9_-]{1,255}$/.test(value);
}

/**
 * Type guard: Check if value is valid userId (Firebase UID)
 */
export function isUserId(value: unknown): value is string {
  return typeof value === "string" && /^[a-zA-Z0-9_-]{1,128}$/.test(value);
}

/**
 * Type guard: Check if value is valid email
 */
export function isEmail(value: unknown): value is string {
  if (typeof value !== "string") return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

/**
 * Type guard: Check if value is valid ISO date string
 */
export function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string") return false;
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

/**
 * Type guard: Check if value is valid ISO time string
 */
export function isIsoTime(value: unknown): value is string {
  if (typeof value !== "string") return false;
  return /^\d{2}:\d{2}$/.test(value);
}

// ─────────────────────────────────────────────────────────────────────────
// INTEGRATION EXAMPLES (Comments para referencia)
// ─────────────────────────────────────────────────────────────────────────

/**
 * EJEMPLO: Rate Limiting en Cloud Function
 *
 * import * as functions from "firebase-functions";
 * import { RATE_LIMIT_PRESETS, requireAuth, withErrorHandler } from "./config/security";
 *
 * // TODO: Implementar con Redis o Firestore
 * // const rateLimiter = createRateLimiter(RATE_LIMIT_PRESETS.CLINICAL_ANALYSIS);
 *
 * export const ingestHistory = functions.https.onCall(
 *   withErrorHandler(async (data, context) => {
 *     requireAuth(context.auth?.uid);
 *     // await rateLimiter.check(context.auth.uid);
 *     // ... rest of logic
 *   })
 * );
 */

/**
 * EJEMPLO: Input Validation
 *
 * import { sanitizePetId, validateMedicalEvent } from "./config/security";
 *
 * export const createMedicalEvent = functions.https.onCall(async (data, context) => {
 *   const petId = sanitizePetId(data.petId);
 *   const medicalEvent = validateMedicalEvent(data.event);
 *   // ... rest of logic
 * });
 */

/**
 * EJEMPLO: Custom Claims (Admin)
 *
 * // En Firebase Console o script:
 * await admin.auth().setCustomUserClaims("user-uid", { admin: true });
 *
 * // En Cloud Function:
 * const decodedToken = await admin.auth().verifyIdToken(token);
 * requireAdmin(decodedToken);
 */

export default {
  RATE_LIMIT_PRESETS,
  SECURITY_CONSTANTS,
  sanitizeInput,
  sanitizeEmail,
  sanitizePetId,
  sanitizeUserId,
  validateMedicalEvent,
  validateDocumentSize,
  requireAuth,
  verifyPetOwnership,
  verifyPetAccess,
  requireAdmin,
  createStructuredError,
  withErrorHandler,
  CORS_HEADERS,
  verifyCorsOrigin,
  isPetId,
  isUserId,
  isEmail,
  isIsoDate,
  isIsoTime,
};
