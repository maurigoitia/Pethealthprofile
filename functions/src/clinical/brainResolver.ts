import * as admin from "firebase-admin";

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

export type BrainResolverAction = "sent_to_review" | "added_to_timeline";
export type BrainResolverCollection = "pending_reviews" | "clinical_events";

export interface BrainSourceMetadata {
  source: string;
  message_id?: string | null;
  import_session_id?: string | null;
  subject?: string | null;
  from_email?: string | null;
  source_date?: string | null;
  attachment_count?: number;
  pet_id_hint?: string | null;
  canonical_event_id?: string | null;
  ui_hint?: Record<string, unknown> | null;
  [key: string]: unknown;
}

export interface BrainOutputPayload {
  schema_version?: string;
  pet_reference?: string | null;
  category: string;
  document_type?: string | null;
  study_type?: string | null;
  primary_finding?: string | null;
  entities: Array<Record<string, unknown>>;
  confidence: number;
  review_required?: boolean;
  reason_if_review_needed?: string | null;
  semantic_flags?: Record<string, unknown> | null;
  ui_hint?: Record<string, unknown> | null;
}

export interface ResolveBrainOutputArgs {
  brainOutput: BrainOutputPayload;
  userId: string;
  sourceMetadata: BrainSourceMetadata;
  reviewThreshold?: number;
}

export interface ResolveBrainOutputResult {
  success: true;
  docId: string;
  action: BrainResolverAction;
  targetCollection: BrainResolverCollection;
  petId: string | null;
  reason: string | null;
}

interface EntityNormalizationResult {
  normalizedEntities: Array<Record<string, unknown>>;
  qualitativeStudy: boolean;
  numericSignalDetected: boolean;
  blockedOutOfRangeInference: boolean;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object") return {};
  return value as Record<string, unknown>;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asNullableString(value: unknown): string | null {
  const normalized = asString(value);
  return normalized || null;
}

function asNullableNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const raw = asString(value).replace(",", ".");
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function normalizeText(value: unknown): string {
  return asString(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function hasNumericSignal(value: unknown): boolean {
  if (typeof value === "number" && Number.isFinite(value)) return true;
  const text = asString(value);
  if (!text) return false;
  return NUMERIC_SIGNAL_REGEX.test(text) || /\b\d+(?:[.,]\d+)?\b/.test(text);
}

function hasOwnerAccess(petData: Record<string, unknown>, userId: string): boolean {
  const ownerId = asString(petData.ownerId);
  return ownerId === userId;
}

function sanitizeCategory(rawCategory: unknown): string {
  const category = asString(rawCategory);
  return ALLOWED_CATEGORIES.has(category) ? category : "ClinicalEvent";
}

function sanitizeDocumentType(rawDocumentType: unknown, rawStudyType: unknown): string {
  const fromDocumentType = asString(rawDocumentType);
  if (ALLOWED_DOCUMENT_TYPES.has(fromDocumentType)) return fromDocumentType;
  const fromStudyType = asString(rawStudyType);
  return ALLOWED_DOCUMENT_TYPES.has(fromStudyType) ? fromStudyType : "general_clinical_report";
}

function detectPathogenNotObservedText(text: string): boolean {
  if (!text) return false;
  return /\bno se observaron\b/i.test(text) && /\b(dermatofitos|ectopar[aá]sitos|parasitos)\b/i.test(text);
}

function normalizeEntitiesForResolver(args: {
  entities: Array<Record<string, unknown>>;
  documentType: string;
}): EntityNormalizationResult {
  const qualitativeStudy = QUALITATIVE_DOCUMENT_TYPES.has(args.documentType);
  let numericSignalDetected = false;
  let blockedOutOfRangeInference = false;

  const normalizedEntities = args.entities.map((entry) => {
    const row = asRecord(entry);
    const value = asNullableString(row.value ?? row.result ?? row.observation);
    const numericValue = asNullableNumber(row.numeric_value ?? row.numericValue ?? value);
    const referenceRangeRaw = asString(row.reference_range ?? row.referenceRange ?? row.ref);
    const statusRaw = asString(row.status ?? row.interpretation);
    const hasNumeric = numericValue !== null || hasNumericSignal(value) || hasNumericSignal(referenceRangeRaw);
    if (hasNumeric) numericSignalDetected = true;

    let status = statusRaw || null;
    let referenceRange = referenceRangeRaw || null;
    let semanticKind: "measurement" | "observation" = hasNumeric ? "measurement" : "observation";

    if (qualitativeStudy && !hasNumeric) {
      if (OUT_OF_RANGE_HINT_REGEX.test(statusRaw) || OUT_OF_RANGE_HINT_REGEX.test(referenceRangeRaw)) {
        status = "observational";
        referenceRange = null;
        blockedOutOfRangeInference = true;
      }
      semanticKind = "observation";
    }

    return {
      ...row,
      type: asString(row.type) || "observation",
      label: asNullableString(row.label ?? row.name),
      value,
      unit: asNullableString(row.unit),
      numeric_value: numericValue,
      reference_range: referenceRange,
      status,
      semantic_kind: semanticKind,
      has_numeric_signal: hasNumeric,
      blocked_out_of_range_inference: qualitativeStudy && !hasNumeric,
      evidence_excerpt: asNullableString(row.evidence_excerpt ?? row.evidence ?? row.source_excerpt),
    };
  });

  return {
    normalizedEntities,
    qualitativeStudy,
    numericSignalDetected,
    blockedOutOfRangeInference,
  };
}

async function resolvePetId(args: {
  userId: string;
  petReference: string | null;
  petIdHint?: string | null;
}): Promise<string | null> {
  const userId = asString(args.userId);
  if (!userId) return null;
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
        if (!petName) continue;
        if (petName === normalizedReference) return doc.id;
      }
    }
  }

  return null;
}

function derivePrimaryFinding(args: {
  providedPrimaryFinding?: string | null;
  entities: Array<Record<string, unknown>>;
}): string | null {
  const provided = asString(args.providedPrimaryFinding);
  if (provided) return provided;

  const stitchedText = args.entities
    .flatMap((entity) => [asString(entity.value), asString(entity.observation), asString(entity.evidence_excerpt)])
    .filter(Boolean)
    .join(" ");

  if (detectPathogenNotObservedText(stitchedText)) {
    return "No se observaron estructuras compatibles con dermatofitos ni ectoparásitos.";
  }

  return null;
}

function computeContractReason(args: {
  categoryRaw: string;
  entitiesCount: number;
  primaryFinding: string | null;
}): string | null {
  if (!args.categoryRaw) return "missing_category";
  if (args.entitiesCount === 0 && !args.primaryFinding) return "empty_entities_and_primary_finding";
  return null;
}

function computeReviewReason(args: {
  reviewRequired: boolean;
  hasPet: boolean;
  confidence: number;
  threshold: number;
  providedReason?: string | null;
  contractReason?: string | null;
}): string | null {
  if (asString(args.contractReason)) return asString(args.contractReason);
  const provided = asString(args.providedReason);
  if (provided) return provided;
  if (!args.hasPet) return "pet_not_found";
  if (args.reviewRequired) return "review_required_by_brain";
  if (args.confidence < args.threshold) return "low_confidence";
  return null;
}

export async function resolveBrainOutput(args: ResolveBrainOutputArgs): Promise<ResolveBrainOutputResult> {
  const nowIso = new Date().toISOString();
  const threshold = clamp(args.reviewThreshold ?? DEFAULT_REVIEW_THRESHOLD, 0, 1);
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
  const targetCollection: BrainResolverCollection = needsManualReview ? "pending_reviews" : "clinical_events";
  const action: BrainResolverAction = needsManualReview ? "sent_to_review" : "added_to_timeline";
  const reason = computeReviewReason({
    reviewRequired,
    hasPet: Boolean(finalPetId),
    confidence,
    threshold,
    providedReason: asString(args.brainOutput.reason_if_review_needed) || null,
    contractReason,
  });

  const normalizedEntities = entityNormalization.normalizedEntities.map((entry) => ({
    ...entry,
    verified: !needsManualReview,
    last_updated: nowIso,
  }));

  const inputSemanticFlags = asRecord(args.brainOutput.semantic_flags);
  const semanticFlags = {
    qualitative_study:
      inputSemanticFlags.qualitative_study === true || entityNormalization.qualitativeStudy,
    numeric_signal_detected:
      inputSemanticFlags.numeric_signal_detected === true || entityNormalization.numericSignalDetected,
    blocked_out_of_range_inference:
      inputSemanticFlags.blocked_out_of_range_inference === true || entityNormalization.blockedOutOfRangeInference,
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
    brain_output: {
      ...args.brainOutput,
      category,
      document_type: documentType,
      primary_finding: primaryFinding,
      confidence,
      entities_count: normalizedEntities.length,
      semantic_flags: semanticFlags,
    },
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
