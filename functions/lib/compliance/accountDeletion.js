"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.submitDataDeletionRequest = exports.deleteAllUserClinicalData = exports.deleteUserAccount = void 0;
const admin = require("firebase-admin");
const functions = require("firebase-functions");
const DELETE_BATCH_SIZE = 200;
const USER_SCOPED_DELETES = [
    { collection: "medical_events", field: "userId" },
    { collection: "appointments", field: "userId" },
    { collection: "medications", field: "userId" },
    { collection: "treatments", field: "userId" },
    { collection: "pending_reviews", field: "userId" },
    { collection: "clinical_review_drafts", field: "userId" },
    { collection: "reminders", field: "userId" },
    { collection: "scheduled_notifications", field: "userId" },
    { collection: "scheduled_reminders", field: "userId" },
    { collection: "dose_events", field: "userId" },
    { collection: "verified_reports", field: "ownerId" },
    { collection: "gmail_ingestion_sessions", field: "user_id" },
    { collection: "gmail_ingestion_documents", field: "user_id" },
    { collection: "gmail_raw_documents_tmp", field: "user_id" },
    { collection: "gmail_attachment_extract_tmp", field: "user_id" },
    { collection: "gmail_event_reviews", field: "user_id" },
    { collection: "gmail_event_fingerprints", field: "user_id" },
    { collection: "gmail_document_hashes", field: "user_id" },
    { collection: "gmail_ingestion_errors", field: "user_id" },
    { collection: "structured_medical_dataset", field: "user_id" },
    { collection: "gmail_oauth_states", field: "uid" },
    { collection: "invitations", field: "createdBy" },
    { collection: "invitations", field: "usedBy" },
];
const PET_SCOPED_DELETES = [
    { collection: "medical_events", field: "petId" },
    { collection: "appointments", field: "petId" },
    { collection: "medications", field: "petId" },
    { collection: "treatments", field: "petId" },
    { collection: "clinical_conditions", field: "petId" },
    { collection: "diagnoses", field: "petId" },
    { collection: "clinical_alerts", field: "petId" },
    { collection: "clinical_review_drafts", field: "petId" },
    { collection: "clinical_episodes", field: "petId" },
    { collection: "clinical_profile_snapshots", field: "petId" },
    { collection: "pending_actions", field: "petId" },
    { collection: "pending_reviews", field: "petId" },
    { collection: "clinical_events", field: "petId" },
    { collection: "reminders", field: "petId" },
    { collection: "scheduled_notifications", field: "petId" },
    { collection: "scheduled_reminders", field: "petId" },
    { collection: "dose_events", field: "petId" },
    { collection: "structured_medical_dataset", field: "pet_id" },
    { collection: "gmail_event_reviews", field: "pet_id" },
    { collection: "invitations", field: "petId" },
];
const USER_DOC_IDS = [
    { collection: "user_email_config" },
    { collection: "userGmailConnections" },
    { collection: "gmail_oauth_attempts" },
    { collection: "gmail_sync_invitations" },
    { collection: "email_sync_plan_overrides" },
    { collection: "gmail_user_locks" },
];
function nowIso() {
    return new Date().toISOString();
}
function asString(value) {
    return typeof value === "string" ? value.trim() : "";
}
async function deleteQueryInBatches(query) {
    let deleted = 0;
    while (true) {
        const snap = await query.limit(DELETE_BATCH_SIZE).get();
        if (snap.empty)
            break;
        const batch = admin.firestore().batch();
        snap.docs.forEach((docSnap) => batch.delete(docSnap.ref));
        await batch.commit();
        deleted += snap.size;
        if (snap.size < DELETE_BATCH_SIZE)
            break;
    }
    return deleted;
}
async function deleteDocsByField(collectionName, field, value) {
    return deleteQueryInBatches(admin.firestore().collection(collectionName).where(field, "==", value));
}
async function deleteSubcollections(docRef) {
    let deleted = 0;
    const subcollections = await docRef.listCollections();
    for (const subcollection of subcollections) {
        deleted += await deleteQueryInBatches(subcollection);
    }
    return deleted;
}
async function deleteStoragePrefix(prefix) {
    try {
        await admin.storage().bucket().deleteFiles({ prefix });
        return true;
    }
    catch (error) {
        const message = String((error === null || error === void 0 ? void 0 : error.message) || error || "");
        if (message.includes("No such object") || message.includes("no such object")) {
            return false;
        }
        throw error;
    }
}
async function removeUserAsCoTutor(uid) {
    const snap = await admin
        .firestore()
        .collection("pets")
        .where("coTutorUids", "array-contains", uid)
        .get();
    let updated = 0;
    for (const docSnap of snap.docs) {
        const data = docSnap.data();
        const ownerId = asString(data.ownerId);
        if (ownerId === uid)
            continue;
        const coTutorUids = Array.isArray(data.coTutorUids)
            ? data.coTutorUids.filter((row) => typeof row === "string" && row !== uid)
            : [];
        const coTutors = Array.isArray(data.coTutors)
            ? data.coTutors.filter((row) => {
                const item = typeof row === "object" && row !== null ? row : {};
                return asString(item.uid) !== uid;
            })
            : [];
        await docSnap.ref.update({
            coTutorUids,
            coTutors,
            updatedAt: nowIso(),
        });
        updated += 1;
    }
    return updated;
}
async function deleteOwnedPetData(petId) {
    let deleted = 0;
    for (const config of PET_SCOPED_DELETES) {
        deleted += await deleteDocsByField(config.collection, config.field, petId);
    }
    const petRef = admin.firestore().collection("pets").doc(petId);
    deleted += await deleteSubcollections(petRef);
    await petRef.delete().catch(() => undefined);
    deleted += 1;
    return deleted;
}
async function deleteUserScopedDocs(uid) {
    let deleted = 0;
    for (const config of USER_SCOPED_DELETES) {
        deleted += await deleteDocsByField(config.collection, config.field, uid);
    }
    for (const config of USER_DOC_IDS) {
        const ref = admin.firestore().collection(config.collection).doc(uid);
        const snap = await ref.get();
        if (snap.exists) {
            await ref.delete();
            deleted += 1;
        }
    }
    return deleted;
}
async function deleteUserDocumentTree(uid) {
    const userRef = admin.firestore().collection("users").doc(uid);
    let deleted = await deleteSubcollections(userRef);
    const userSnap = await userRef.get();
    if (userSnap.exists) {
        await userRef.delete();
        deleted += 1;
    }
    return deleted;
}
async function performAccountDeletion(uid) {
    const ownedPetsSnap = await admin.firestore().collection("pets").where("ownerId", "==", uid).get();
    const ownedPetIds = ownedPetsSnap.docs.map((docSnap) => docSnap.id);
    const coTutorLinksRemoved = await removeUserAsCoTutor(uid);
    let firestoreDocsDeleted = 0;
    for (const petId of ownedPetIds) {
        firestoreDocsDeleted += await deleteOwnedPetData(petId);
    }
    firestoreDocsDeleted += await deleteUserScopedDocs(uid);
    const userSubcollectionsDeleted = await deleteUserDocumentTree(uid);
    firestoreDocsDeleted += userSubcollectionsDeleted;
    const storagePrefixesDeleted = [];
    for (const prefix of [`users/${uid}/`, `documents/${uid}/`, `gmail_ingestion/${uid}/`]) {
        const removed = await deleteStoragePrefix(prefix);
        if (removed)
            storagePrefixesDeleted.push(prefix);
    }
    await admin.auth().deleteUser(uid);
    return {
        userId: uid,
        ownedPetsDeleted: ownedPetIds.length,
        coTutorLinksRemoved,
        firestoreDocsDeleted,
        userSubcollectionsDeleted,
        storagePrefixesDeleted,
    };
}
exports.deleteUserAccount = functions
    .region("us-central1")
    .https.onCall(async (_data, context) => {
    var _a;
    if (!((_a = context.auth) === null || _a === void 0 ? void 0 : _a.uid)) {
        throw new functions.https.HttpsError("unauthenticated", "Debes iniciar sesión.");
    }
    const uid = context.auth.uid;
    functions.logger.warn("[deleteUserAccount] Starting account deletion", { uid });
    try {
        const summary = await performAccountDeletion(uid);
        functions.logger.warn("[deleteUserAccount] Account deletion completed", summary);
        return Object.assign({ ok: true }, summary);
    }
    catch (error) {
        functions.logger.error("[deleteUserAccount] Account deletion failed", { uid, error });
        throw new functions.https.HttpsError("internal", "No se pudo eliminar la cuenta completa. Reintentá en unos minutos.");
    }
});
/**
 * GDPR Art. 17 — Right to erasure of health data.
 * Deletes ALL clinical + Gmail ingestion data for the authenticated user
 * WITHOUT deleting the user account itself.
 * Also disconnects Gmail sync and wipes clinical Storage prefixes.
 */
exports.deleteAllUserClinicalData = functions
    .region("us-central1")
    .https.onCall(async (_data, context) => {
    var _a;
    if (!((_a = context.auth) === null || _a === void 0 ? void 0 : _a.uid)) {
        throw new functions.https.HttpsError("unauthenticated", "Debes iniciar sesión.");
    }
    const uid = context.auth.uid;
    functions.logger.warn("[deleteAllUserClinicalData] Starting clinical data deletion", { uid });
    try {
        const CLINICAL_USER_COLLECTIONS = [
            { collection: "medical_events", field: "userId" },
            { collection: "clinical_review_drafts", field: "userId" },
            { collection: "gmail_ingestion_sessions", field: "user_id" },
            { collection: "gmail_ingestion_documents", field: "user_id" },
            { collection: "gmail_raw_documents_tmp", field: "user_id" },
            { collection: "gmail_attachment_extract_tmp", field: "user_id" },
            { collection: "gmail_event_reviews", field: "user_id" },
            { collection: "gmail_event_fingerprints", field: "user_id" },
            { collection: "gmail_document_hashes", field: "user_id" },
            { collection: "gmail_ingestion_errors", field: "user_id" },
            { collection: "structured_medical_dataset", field: "user_id" },
            { collection: "dose_events", field: "userId" },
            { collection: "verified_reports", field: "ownerId" },
        ];
        const CLINICAL_PET_COLLECTIONS = [
            { collection: "medical_events", field: "petId" },
            { collection: "clinical_conditions", field: "petId" },
            { collection: "diagnoses", field: "petId" },
            { collection: "clinical_alerts", field: "petId" },
            { collection: "clinical_episodes", field: "petId" },
            { collection: "clinical_profile_snapshots", field: "petId" },
            { collection: "clinical_events", field: "petId" },
            { collection: "clinical_review_drafts", field: "petId" },
            { collection: "structured_medical_dataset", field: "pet_id" },
            { collection: "gmail_event_reviews", field: "pet_id" },
            { collection: "dose_events", field: "petId" },
        ];
        let docsDeleted = 0;
        // Delete user-scoped clinical docs
        for (const config of CLINICAL_USER_COLLECTIONS) {
            docsDeleted += await deleteDocsByField(config.collection, config.field, uid);
        }
        // Delete pet-scoped clinical docs for all owned pets
        const ownedPetsSnap = await admin.firestore().collection("pets").where("ownerId", "==", uid).get();
        for (const petDoc of ownedPetsSnap.docs) {
            for (const config of CLINICAL_PET_COLLECTIONS) {
                docsDeleted += await deleteDocsByField(config.collection, config.field, petDoc.id);
            }
            // Clear clinical subcollections from pet docs
            const petRef = admin.firestore().collection("pets").doc(petDoc.id);
            const subcollections = await petRef.listCollections();
            for (const sub of subcollections) {
                if (sub.id.startsWith("clinical_") || sub.id.startsWith("gmail_") || sub.id === "medical_events") {
                    docsDeleted += await deleteQueryInBatches(sub);
                }
            }
        }
        // Disconnect Gmail sync
        const userRef = admin.firestore().collection("users").doc(uid);
        await userRef.update({
            "gmailSync.connected": false,
            "gmailSync.accountEmail": null,
            "gmailSync.grantedScopes": [],
            "gmailSync.updatedAt": nowIso(),
        });
        // Delete Gmail OAuth state docs
        for (const col of ["userGmailConnections", "gmail_oauth_attempts", "gmail_oauth_states", "gmail_user_locks"]) {
            const ref = admin.firestore().collection(col).doc(uid);
            const snap = await ref.get();
            if (snap.exists) {
                await ref.delete();
                docsDeleted += 1;
            }
        }
        // Wipe clinical Storage
        const storagePrefixesDeleted = [];
        for (const prefix of [`documents/${uid}/`, `gmail_ingestion/${uid}/`]) {
            const removed = await deleteStoragePrefix(prefix);
            if (removed)
                storagePrefixesDeleted.push(prefix);
        }
        const summary = { userId: uid, docsDeleted, storagePrefixesDeleted };
        functions.logger.warn("[deleteAllUserClinicalData] Completed", summary);
        return Object.assign({ ok: true }, summary);
    }
    catch (error) {
        functions.logger.error("[deleteAllUserClinicalData] Failed", { uid, error });
        throw new functions.https.HttpsError("internal", "No se pudo eliminar los datos clínicos. Reintentá en unos minutos.");
    }
});
// SEC-002 FIX: CORS restringido a dominios Pessy (no wildcard *).
const ALLOWED_ORIGINS = new Set([
    "https://pessy.app",
    "https://www.pessy.app",
    "https://app.pessy.app",
    "https://polar-scene-488615-i0.web.app",
    "https://polar-scene-488615-i0.firebaseapp.com",
]);
function setCorsHeaders(req, res) {
    const origin = req.headers.origin || "";
    if (ALLOWED_ORIGINS.has(origin)) {
        res.set("Access-Control-Allow-Origin", origin);
    }
    else {
        res.set("Access-Control-Allow-Origin", "https://pessy.app");
    }
    res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type");
}
exports.submitDataDeletionRequest = functions
    .region("us-central1")
    .https.onRequest(async (req, res) => {
    var _a, _b, _c;
    setCorsHeaders(req, res);
    if (req.method === "OPTIONS") {
        res.status(204).send("");
        return;
    }
    if (req.method !== "POST") {
        res.status(405).json({ ok: false, error: "method_not_allowed" });
        return;
    }
    const name = asString((_a = req.body) === null || _a === void 0 ? void 0 : _a.name);
    const email = asString((_b = req.body) === null || _b === void 0 ? void 0 : _b.email).toLowerCase();
    const message = asString((_c = req.body) === null || _c === void 0 ? void 0 : _c.message);
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        res.status(400).json({ ok: false, error: "invalid_email" });
        return;
    }
    const requestRef = admin.firestore().collection("data_deletion_requests").doc();
    await requestRef.set({
        requestId: requestRef.id,
        name: name || null,
        email,
        message: message || null,
        status: "pending",
        source: "public_data_deletion_form",
        createdAt: nowIso(),
    });
    res.status(200).json({ ok: true, requestId: requestRef.id });
});
//# sourceMappingURL=accountDeletion.js.map