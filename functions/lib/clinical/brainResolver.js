"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveBrainOutput = resolveBrainOutput;
const admin = require("firebase-admin");
const DEFAULT_REVIEW_THRESHOLD = 0.85;
const RESOLVER_VERSION = "brain_resolver_v2";
const DEFAULT_BRAIN_SCHEMA_VERSION = "brain_payload_v2";
const ALLOWED_CATEGORIES = new Set(["Medication", "Vaccine", "Diagnostic", "ClinicalEvent"]);
const ALLOWED_DOCUMENT_TYPES = new Set([
    "blood_panel",
    "biochemistry_panel",
    "urinalysis",
    "dermatology_microscopy",
    "cytology",
    "radiology_report",
    "general_clinical_report",
]);
const QUALITATIVE_DOCUMENT_TYPES = new Set(["dermatology_microscopy", "cytology", "radiology_report"]);
const OUT_OF_RANGE_HINT_REGEX = /\b(fuera de rango|out of range|alterad[oa]s?|anormal(?:es)?|high|low)\b/i;
const NUMERIC_SIGNAL_REGEX = /\d+(?:[.,]\d+)?\s*(?:mg\/dl|g\/dl|mmol\/l|iu\/l|u\/l|%|x10|\/µl|\/ul|kg|g|ml)\b/i;
function asRecord(value) {
    if (!value || typeof value !== "object")
        return {};
    return value;
}
function asString(value) {
    return typeof value === "string" ? value.trim() : "";
}
function asNullableString(value) {
    const normalized = asString(value);
    return normalized || null;
}
function asNullableNumber(value) {
    if (typeof value === "number" && Number.isFinite(value))
        return value;
    const raw = asString(value).replace(",", ".");
    if (!raw)
        return null;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
}
function clamp(value, min, max) {
    if (Number.isNaN(value))
        return min;
    return Math.min(max, Math.max(min, value));
}
function normalizeText(value) {
    return asString(value)
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim();
}
function hasNumericSignal(value) {
    if (typeof value === "number" && Number.isFinite(value))
        return true;
    const text = asString(value);
    if (!text)
        return false;
    return NUMERIC_SIGNAL_REGEX.test(text) || /\b\d+(?:[.,]\d+)?\b/.test(text);
}
function hasOwnerAccess(petData, userId) {
    const ownerId = asString(petData.ownerId);
    return ownerId === userId;
}
function sanitizeCategory(rawCategory) {
    const category = asString(rawCategory);
    return ALLOWED_CATEGORIES.has(category) ? category : "ClinicalEvent";
}
function sanitizeDocumentType(rawDocumentType, rawStudyType) {
    const fromDocumentType = asString(rawDocumentType);
    if (ALLOWED_DOCUMENT_TYPES.has(fromDocumentType))
        return fromDocumentType;
    const fromStudyType = asString(rawStudyType);
    return ALLOWED_DOCUMENT_TYPES.has(fromStudyType) ? fromStudyType : "general_clinical_report";
}
function detectPathogenNotObservedText(text) {
    if (!text)
        return false;
    return /\bno se observaron\b/i.test(text) && /\b(dermatofitos|ectopar[aá]sitos|parasitos)\b/i.test(text);
}
function normalizeEntitiesForResolver(args) {
    const qualitativeStudy = QUALITATIVE_DOCUMENT_TYPES.has(args.documentType);
    let numericSignalDetected = false;
    let blockedOutOfRangeInference = false;
    const normalizedEntities = args.entities.map((entry) => {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
        const row = asRecord(entry);
        const value = asNullableString((_b = (_a = row.value) !== null && _a !== void 0 ? _a : row.result) !== null && _b !== void 0 ? _b : row.observation);
        const numericValue = asNullableNumber((_d = (_c = row.numeric_value) !== null && _c !== void 0 ? _c : row.numericValue) !== null && _d !== void 0 ? _d : value);
        const referenceRangeRaw = asString((_f = (_e = row.reference_range) !== null && _e !== void 0 ? _e : row.referenceRange) !== null && _f !== void 0 ? _f : row.ref);
        const statusRaw = asString((_g = row.status) !== null && _g !== void 0 ? _g : row.interpretation);
        const hasNumeric = numericValue !== null || hasNumericSignal(value) || hasNumericSignal(referenceRangeRaw);
        if (hasNumeric)
            numericSignalDetected = true;
        let status = statusRaw || null;
        let referenceRange = referenceRangeRaw || null;
        let semanticKind = hasNumeric ? "measurement" : "observation";
        if (qualitativeStudy && !hasNumeric) {
            if (OUT_OF_RANGE_HINT_REGEX.test(statusRaw) || OUT_OF_RANGE_HINT_REGEX.test(referenceRangeRaw)) {
                status = "observational";
                referenceRange = null;
                blockedOutOfRangeInference = true;
            }
            semanticKind = "observation";
        }
        return Object.assign(Object.assign({}, row), { type: asString(row.type) || "observation", label: asNullableString((_h = row.label) !== null && _h !== void 0 ? _h : row.name), value, unit: asNullableString(row.unit), numeric_value: numericValue, reference_range: referenceRange, status, semantic_kind: semanticKind, has_numeric_signal: hasNumeric, blocked_out_of_range_inference: qualitativeStudy && !hasNumeric, evidence_excerpt: asNullableString((_k = (_j = row.evidence_excerpt) !== null && _j !== void 0 ? _j : row.evidence) !== null && _k !== void 0 ? _k : row.source_excerpt) });
    });
    return {
        normalizedEntities,
        qualitativeStudy,
        numericSignalDetected,
        blockedOutOfRangeInference,
    };
}
async function resolvePetId(args) {
    const userId = asString(args.userId);
    if (!userId)
        return null;
    const petIdHint = asString(args.petIdHint);
    const petReference = asString(args.petReference);
    if (petIdHint) {
        const hintSnap = await admin.firestore().collection("pets").doc(petIdHint).get();
        if (hintSnap.exists && hasOwnerAccess(asRecord(hintSnap.data()), userId)) {
            return hintSnap.id;
        }
    }
    if (petReference) {
        const directSnap = await admin.firestore().collection("pets").doc(petReference).get();
        if (directSnap.exists && hasOwnerAccess(asRecord(directSnap.data()), userId)) {
            return directSnap.id;
        }
        const exactQuery = await admin
            .firestore()
            .collection("pets")
            .where("ownerId", "==", userId)
            .where("name", "==", petReference)
            .limit(1)
            .get();
        if (!exactQuery.empty) {
            return exactQuery.docs[0].id;
        }
        const normalizedReference = normalizeText(petReference);
        if (normalizedReference) {
            const ownerPets = await admin
                .firestore()
                .collection("pets")
                .where("ownerId", "==", userId)
                .limit(100)
                .get();
            for (const doc of ownerPets.docs) {
                const petName = normalizeText(asRecord(doc.data()).name);
                if (!petName)
                    continue;
                if (petName === normalizedReference)
                    return doc.id;
            }
        }
    }
    return null;
}
function derivePrimaryFinding(args) {
    const provided = asString(args.providedPrimaryFinding);
    if (provided)
        return provided;
    const stitchedText = args.entities
        .flatMap((entity) => [asString(entity.value), asString(entity.observation), asString(entity.evidence_excerpt)])
        .filter(Boolean)
        .join(" ");
    if (detectPathogenNotObservedText(stitchedText)) {
        return "No se observaron estructuras compatibles con dermatofitos ni ectoparásitos.";
    }
    return null;
}
function computeContractReason(args) {
    if (!args.categoryRaw)
        return "missing_category";
    if (args.entitiesCount === 0 && !args.primaryFinding)
        return "empty_entities_and_primary_finding";
    return null;
}
function computeReviewReason(args) {
    if (asString(args.contractReason))
        return asString(args.contractReason);
    const provided = asString(args.providedReason);
    if (provided)
        return provided;
    if (!args.hasPet)
        return "pet_not_found";
    if (args.reviewRequired)
        return "review_required_by_brain";
    if (args.confidence < args.threshold)
        return "low_confidence";
    return null;
}
async function resolveBrainOutput(args) {
    var _a;
    const nowIso = new Date().toISOString();
    const threshold = clamp((_a = args.reviewThreshold) !== null && _a !== void 0 ? _a : DEFAULT_REVIEW_THRESHOLD, 0, 1);
    const confidence = clamp(Number(args.brainOutput.confidence || 0), 0, 1);
    const reviewRequired = args.brainOutput.review_required === true;
    const categoryRaw = asString(args.brainOutput.category);
    const category = sanitizeCategory(categoryRaw);
    const documentType = sanitizeDocumentType(args.brainOutput.document_type, args.brainOutput.study_type);
    const entityNormalization = normalizeEntitiesForResolver({
        entities: Array.isArray(args.brainOutput.entities) ? args.brainOutput.entities : [],
        documentType,
    });
    const primaryFinding = derivePrimaryFinding({
        providedPrimaryFinding: args.brainOutput.primary_finding,
        entities: entityNormalization.normalizedEntities,
    });
    const contractReason = computeContractReason({
        categoryRaw,
        entitiesCount: entityNormalization.normalizedEntities.length,
        primaryFinding,
    });
    const finalPetId = await resolvePetId({
        userId: args.userId,
        petReference: asString(args.brainOutput.pet_reference) || null,
        petIdHint: asString(args.sourceMetadata.pet_id_hint) || null,
    });
    const needsManualReview = reviewRequired || !finalPetId || confidence < threshold || Boolean(contractReason);
    const targetCollection = needsManualReview ? "pending_reviews" : "clinical_events";
    const action = needsManualReview ? "sent_to_review" : "added_to_timeline";
    const reason = computeReviewReason({
        reviewRequired,
        hasPet: Boolean(finalPetId),
        confidence,
        threshold,
        providedReason: asString(args.brainOutput.reason_if_review_needed) || null,
        contractReason,
    });
    const normalizedEntities = entityNormalization.normalizedEntities.map((entry) => (Object.assign(Object.assign({}, entry), { verified: !needsManualReview, last_updated: nowIso })));
    const inputSemanticFlags = asRecord(args.brainOutput.semantic_flags);
    const semanticFlags = {
        qualitative_study: inputSemanticFlags.qualitative_study === true || entityNormalization.qualitativeStudy,
        numeric_signal_detected: inputSemanticFlags.numeric_signal_detected === true || entityNormalization.numericSignalDetected,
        blocked_out_of_range_inference: inputSemanticFlags.blocked_out_of_range_inference === true || entityNormalization.blockedOutOfRangeInference,
    };
    const record = {
        userId: asString(args.userId),
        petId: finalPetId,
        pet_reference: asString(args.brainOutput.pet_reference) || null,
        category,
        document_type: documentType,
        study_type: asString(args.brainOutput.study_type) || null,
        primary_finding: primaryFinding,
        extracted_at: nowIso,
        source_metadata: args.sourceMetadata,
        brain_confidence: confidence,
        brain_schema_version: asString(args.brainOutput.schema_version) || DEFAULT_BRAIN_SCHEMA_VERSION,
        brain_output: Object.assign(Object.assign({}, args.brainOutput), { category, document_type: documentType, primary_finding: primaryFinding, confidence, entities_count: normalizedEntities.length, semantic_flags: semanticFlags }),
        io_contract: {
            has_entities: normalizedEntities.length > 0,
            has_primary_finding: Boolean(primaryFinding),
            contract_reason: contractReason,
        },
        data: normalizedEntities,
        semantic_flags: semanticFlags,
        status: needsManualReview ? "pending" : "verified",
        reason,
        ui_hint: args.brainOutput.ui_hint || args.sourceMetadata.ui_hint || null,
        resolver_version: RESOLVER_VERSION,
        // ─── Source-of-truth lineage ───────────────────────────────────────────
        validated_by_human: false,
        source_truth_level: needsManualReview
            ? "ai_low_confidence"
            : "ai_high_confidence",
        validation_timestamp: null,
        review_action: null,
        // ──────────────────────────────────────────────────────────────────────
        updated_at: nowIso,
        created_at: nowIso,
    };
    const docRef = await admin.firestore().collection(targetCollection).add(record);
    return {
        success: true,
        docId: docRef.id,
        action,
        targetCollection,
        petId: finalPetId,
        reason,
    };
}
//# sourceMappingURL=brainResolver.js.map