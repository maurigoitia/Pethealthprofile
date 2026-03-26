"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ingestHistory = void 0;
const admin = require("firebase-admin");
const functions = require("firebase-functions");
// ──────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────
const BATCH_THRESHOLD = 30; // docs above this → overnight queue
const BATCH_ETA_HOURS = 24;
// ──────────────────────────────────────────────
// Guards
// ──────────────────────────────────────────────
function assertAuth(uid) {
    if (!uid) {
        throw new functions.https.HttpsError("unauthenticated", "Sesión requerida.");
    }
}
function assertRequest(data) {
    const d = data;
    if (!(d === null || d === void 0 ? void 0 : d.petId) || typeof d.petId !== "string") {
        throw new functions.https.HttpsError("invalid-argument", "petId requerido.");
    }
    if (!Array.isArray(d.docs) || d.docs.length === 0) {
        throw new functions.https.HttpsError("invalid-argument", "docs[] no puede estar vacío.");
    }
}
// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────
async function createJob(uid, petId, docs) {
    const mode = docs.length > BATCH_THRESHOLD ? "batch" : "instant";
    const job = {
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
exports.ingestHistory = functions
    .region("us-central1")
    .https.onCall(async (data, context) => {
    var _a;
    assertAuth((_a = context.auth) === null || _a === void 0 ? void 0 : _a.uid);
    assertRequest(data);
    const { petId, docs } = data;
    const uid = context.auth.uid;
    // SEC: Verify the calling user owns this pet or is a co-tutor
    const petSnap = await admin.firestore().collection("pets").doc(petId).get();
    if (!petSnap.exists) {
        throw new functions.https.HttpsError("not-found", "Mascota no encontrada.");
    }
    const petData = petSnap.data();
    const isOwner = petData.ownerId === uid;
    const isCoTutor = Array.isArray(petData.coTutorUids) && petData.coTutorUids.includes(uid);
    if (!isOwner && !isCoTutor) {
        throw new functions.https.HttpsError("permission-denied", "No tenés acceso a esta mascota.");
    }
    const isBatch = docs.length > BATCH_THRESHOLD;
    const jobId = await createJob(uid, petId, docs);
    if (isBatch) {
        // Large history → overnight queue
        // Frontend reads processingMode to show the "processing tomorrow" message
        return {
            jobId,
            processingMode: "batch",
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
        processingMode: "instant",
        docCount: docs.length,
        message: "processing_started",
    };
});
//# sourceMappingURL=ingestHistory.js.map