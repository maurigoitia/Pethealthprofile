import * as admin from "firebase-admin";
import * as functions from "firebase-functions";

// ──────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────
const BATCH_THRESHOLD = 30;   // docs above this → overnight queue
const BATCH_ETA_HOURS = 24;

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────
interface IngestHistoryRequest {
  petId: string;
  docs: Array<{ storagePath: string; mimeType: string; fileName: string }>;
}

type ProcessingMode = "instant" | "batch";

interface JobRecord {
  uid: string;
  petId: string;
  status: "queued" | "processing" | "completed" | "failed";
  processingMode: ProcessingMode;
  docCount: number;
  etaHours: number | null;
  createdAt: admin.firestore.Timestamp;
  updatedAt: admin.firestore.Timestamp;
}

// ──────────────────────────────────────────────
// Guards
// ──────────────────────────────────────────────
function assertAuth(uid: string | undefined): asserts uid is string {
  if (!uid) {
    throw new functions.https.HttpsError("unauthenticated", "Sesión requerida.");
  }
}

function assertRequest(data: unknown): asserts data is IngestHistoryRequest {
  const d = data as IngestHistoryRequest;
  if (!d?.petId || typeof d.petId !== "string") {
    throw new functions.https.HttpsError("invalid-argument", "petId requerido.");
  }
  if (!Array.isArray(d.docs) || d.docs.length === 0) {
    throw new functions.https.HttpsError("invalid-argument", "docs[] no puede estar vacío.");
  }
}

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────
async function createJob(
  uid: string,
  petId: string,
  docs: IngestHistoryRequest["docs"]
): Promise<string> {
  const mode: ProcessingMode = docs.length > BATCH_THRESHOLD ? "batch" : "instant";

  const job: JobRecord = {
    uid,
    petId,
    status: "queued",
    processingMode: mode,
    docCount: docs.length,
    etaHours: mode === "batch" ? BATCH_ETA_HOURS : null,
    createdAt: admin.firestore.Timestamp.now(),
    updatedAt: admin.firestore.Timestamp.now(),
  };

  const ref = await admin.firestore()
    .collection("historyIngestionJobs")
    .add(job);

  return ref.id;
}

// ──────────────────────────────────────────────
// Cloud Function
// ──────────────────────────────────────────────
export const ingestHistory = functions
  .region("us-central1")
  .https.onCall(async (data, context) => {
    assertAuth(context.auth?.uid);
    assertRequest(data);

    const { petId, docs } = data;
    const uid = context.auth.uid;
    const isBatch = docs.length > BATCH_THRESHOLD;

    const jobId = await createJob(uid, petId, docs);

    if (isBatch) {
      // Large history → overnight queue
      // Frontend reads processingMode to show the "processing tomorrow" message
      return {
        jobId,
        processingMode: "batch" as ProcessingMode,
        docCount: docs.length,
        message: "batch_queued",
      };
    }

    // Small history → start now, delegates to analyzeDocument pipeline
    await admin.firestore()
      .collection("historyIngestionJobs")
      .doc(jobId)
      .update({
        status: "processing",
        updatedAt: admin.firestore.Timestamp.now(),
      });

    return {
      jobId,
      processingMode: "instant" as ProcessingMode,
      docCount: docs.length,
      message: "processing_started",
    };
  });
