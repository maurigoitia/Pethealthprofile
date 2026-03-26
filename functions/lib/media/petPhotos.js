"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadPetPhoto = void 0;
const admin = require("firebase-admin");
const functions = require("firebase-functions");
const crypto_1 = require("crypto");
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024; // 8 MB binary
const ALLOWED_CONTENT_TYPES = new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/heic",
    "image/heif",
]);
function asTrimmedString(value) {
    return typeof value === "string" ? value.trim() : "";
}
function dedupeNonEmpty(values) {
    return Array.from(new Set(values.filter((value) => typeof value === "string" && value.trim().length > 0)));
}
function collectUidCandidates(value) {
    if (typeof value === "string") {
        return dedupeNonEmpty([value.trim()]);
    }
    if (Array.isArray(value)) {
        const fromArray = value.flatMap((item) => {
            if (typeof item === "string")
                return [item.trim()];
            if (!item || typeof item !== "object")
                return [];
            const row = item;
            return [
                asTrimmedString(row.uid),
                asTrimmedString(row.userId),
                asTrimmedString(row.id),
            ];
        });
        return dedupeNonEmpty(fromArray);
    }
    if (!value || typeof value !== "object")
        return [];
    const row = value;
    const fromObjectValues = Object.values(row).flatMap((item) => {
        if (typeof item === "string")
            return [item.trim()];
        if (!item || typeof item !== "object")
            return [];
        const nested = item;
        return [
            asTrimmedString(nested.uid),
            asTrimmedString(nested.userId),
            asTrimmedString(nested.id),
        ];
    });
    const fromObjectKeys = Object.entries(row)
        .filter(([, item]) => item === true)
        .map(([key]) => key.trim());
    return dedupeNonEmpty([
        asTrimmedString(row.uid),
        asTrimmedString(row.userId),
        asTrimmedString(row.id),
        ...fromObjectValues,
        ...fromObjectKeys,
    ]);
}
function sanitizeFileName(raw) {
    return raw
        .trim()
        .replace(/[^a-zA-Z0-9._-]/g, "_")
        .replace(/_+/g, "_")
        .slice(0, 80) || "pet_photo.jpg";
}
function normalizeBase64(raw) {
    const cleaned = raw.trim();
    if (cleaned.startsWith("data:")) {
        const commaIdx = cleaned.indexOf(",");
        if (commaIdx >= 0)
            return cleaned.slice(commaIdx + 1);
    }
    return cleaned;
}
function inferContentType(fileName, providedType) {
    const loweredType = providedType.toLowerCase().trim();
    if (ALLOWED_CONTENT_TYPES.has(loweredType))
        return loweredType;
    const lowerName = fileName.toLowerCase();
    if (lowerName.endsWith(".png"))
        return "image/png";
    if (lowerName.endsWith(".webp"))
        return "image/webp";
    if (lowerName.endsWith(".heic"))
        return "image/heic";
    if (lowerName.endsWith(".heif"))
        return "image/heif";
    return "image/jpeg";
}
function buildDownloadUrl(bucketName, path, token) {
    return `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(path)}?alt=media&token=${token}`;
}
async function assertPetAccess(petId, uid) {
    const snap = await admin.firestore().collection("pets").doc(petId).get();
    if (!snap.exists) {
        throw new functions.https.HttpsError("not-found", "Mascota no encontrada.");
    }
    const data = snap.data();
    const ownerCandidates = dedupeNonEmpty([
        asTrimmedString(data.ownerId),
        asTrimmedString(data.userId),
        asTrimmedString(data.uid),
        asTrimmedString(data.ownerUid),
        asTrimmedString(data.owner),
        asTrimmedString(data.createdBy),
        asTrimmedString(data.created_by),
        ...collectUidCandidates(data.ownerIds),
        ...collectUidCandidates(data.owners),
    ]);
    const coTutorUids = dedupeNonEmpty([
        ...collectUidCandidates(data.coTutorUids),
        ...collectUidCandidates(data.coTutors),
        ...collectUidCandidates(data.coTutorIds),
        ...collectUidCandidates(data.cotutorUids),
        ...collectUidCandidates(data.cotutors),
        ...collectUidCandidates(data.tutorUids),
        ...collectUidCandidates(data.caregiverUids),
    ]);
    const sharedCandidates = dedupeNonEmpty([
        ...collectUidCandidates(data.sharedWith),
        ...collectUidCandidates(data.sharedWithUids),
        ...collectUidCandidates(data.members),
        ...collectUidCandidates(data.accessUids),
    ]);
    let canAccess = ownerCandidates.includes(uid) || coTutorUids.includes(uid) || sharedCandidates.includes(uid);
    let hasLegacyUserLink = false;
    if (!canAccess) {
        const legacyMembershipSnap = await admin
            .firestore()
            .collection("users")
            .doc(uid)
            .collection("pets")
            .doc(petId)
            .get();
        hasLegacyUserLink = legacyMembershipSnap.exists;
        canAccess = hasLegacyUserLink;
    }
    if (!canAccess) {
        console.warn("[uploadPetPhoto] pet access denied", {
            petId,
            uid,
            ownerCandidatesCount: ownerCandidates.length,
            coTutorUidsCount: coTutorUids.length,
            sharedCandidatesCount: sharedCandidates.length,
            hasLegacyUserLink,
        });
        throw new functions.https.HttpsError("permission-denied", "No tenés permisos para esta mascota.");
    }
}
exports.uploadPetPhoto = functions
    .runWith({ timeoutSeconds: 60, memory: "512MB" })
    .region("us-central1")
    .https.onCall(async (rawData, context) => {
    var _a;
    let uid = ((_a = context.auth) === null || _a === void 0 ? void 0 : _a.uid) || "";
    // Fallback para casos móviles/PWA donde el SDK no adjunta auth en callable.
    if (!uid && typeof (rawData === null || rawData === void 0 ? void 0 : rawData.idToken) === "string" && rawData.idToken.trim()) {
        try {
            const decoded = await admin.auth().verifyIdToken(rawData.idToken.trim());
            uid = decoded.uid || "";
        }
        catch (error) {
            throw new functions.https.HttpsError("unauthenticated", "Sesión inválida.");
        }
    }
    if (uid && typeof (rawData === null || rawData === void 0 ? void 0 : rawData.uid) === "string" && rawData.uid.trim() && rawData.uid.trim() !== uid) {
        console.warn("[uploadPetPhoto] uid mismatch payload/auth", {
            authUid: uid,
            payloadUid: rawData.uid.trim(),
            petId: typeof (rawData === null || rawData === void 0 ? void 0 : rawData.petId) === "string" ? rawData.petId.trim() : "",
        });
    }
    if (!uid) {
        throw new functions.https.HttpsError("unauthenticated", "Debes iniciar sesión.");
    }
    const petId = typeof (rawData === null || rawData === void 0 ? void 0 : rawData.petId) === "string" ? rawData.petId.trim() : "";
    if (!petId) {
        throw new functions.https.HttpsError("invalid-argument", "Falta petId.");
    }
    await assertPetAccess(petId, uid);
    const fileName = sanitizeFileName(typeof (rawData === null || rawData === void 0 ? void 0 : rawData.fileName) === "string" ? rawData.fileName : "pet_photo.jpg");
    const base64 = normalizeBase64(typeof (rawData === null || rawData === void 0 ? void 0 : rawData.base64) === "string" ? rawData.base64 : "");
    if (!base64) {
        throw new functions.https.HttpsError("invalid-argument", "Falta base64.");
    }
    let binary;
    try {
        binary = Buffer.from(base64, "base64");
    }
    catch (error) {
        throw new functions.https.HttpsError("invalid-argument", `Base64 inválido: ${String(error)}`);
    }
    if (!binary.length || binary.length > MAX_UPLOAD_BYTES) {
        throw new functions.https.HttpsError("invalid-argument", "La imagen supera el tamaño máximo permitido (8 MB).");
    }
    const contentType = inferContentType(fileName, typeof (rawData === null || rawData === void 0 ? void 0 : rawData.contentType) === "string" ? rawData.contentType : "");
    if (!ALLOWED_CONTENT_TYPES.has(contentType)) {
        throw new functions.https.HttpsError("invalid-argument", "Formato de imagen no permitido.");
    }
    const bucket = admin.storage().bucket();
    const timestamp = Date.now();
    const safeExt = contentType === "image/png" ? "png" : contentType === "image/webp" ? "webp" : "jpg";
    const path = `users/${uid}/pets/${petId}_photo_${timestamp}.${safeExt}`;
    const token = (0, crypto_1.randomBytes)(24).toString("hex");
    const file = bucket.file(path);
    await file.save(binary, {
        resumable: false,
        metadata: {
            contentType,
            cacheControl: "public,max-age=3600",
            metadata: {
                firebaseStorageDownloadTokens: token,
                uploadedBy: uid,
                petId,
                source: "uploadPetPhoto_callable",
            },
        },
    });
    const url = buildDownloadUrl(bucket.name, path, token);
    // Persistir foto en el perfil de mascota desde backend evita desincronía
    // si el update del cliente falla después de una subida exitosa.
    await admin.firestore().collection("pets").doc(petId).set({
        photo: url,
        photoUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    await admin.firestore().collection("pet_photo_upload_logs").add({
        uid,
        petId,
        path,
        bucket: bucket.name,
        sizeBytes: binary.length,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        source: "callable",
        petPhotoUpdated: true,
    });
    return {
        ok: true,
        url,
        path,
        bucket: bucket.name,
        contentType,
        sizeBytes: binary.length,
        petPhotoUpdated: true,
    };
});
//# sourceMappingURL=petPhotos.js.map