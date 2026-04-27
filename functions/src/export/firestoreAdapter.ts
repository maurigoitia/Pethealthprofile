/**
 * Adapter between Firestore documents and the source-backed export types.
 *
 * The repo's existing provenance model uses these labels on medical_events:
 *   vet_input | tutor_confirmed | ai_extraction | ai_pending_review | tutor_input
 *
 * For the export safety layer, we collapse them into the two buckets the
 * payload builder understands:
 *   - documented (counts as evidence): vet_input, tutor_confirmed
 *   - tutor_input (observation only):  ai_extraction, ai_pending_review,
 *                                      tutor_input, anything unknown
 *
 * Mapping is intentionally conservative — when in doubt, the event drops
 * into observations, never into documentedDiagnoses.
 */

import { RawEvent, RawPet } from "./types";

// Structural type for the slice of Firestore we use here — keeps this
// module decoupled from firebase-admin so it can be unit-tested without
// the SDK installed.
interface FirestoreLike {
  doc(path: string): {
    get(): Promise<{ exists: boolean; id: string; data(): Record<string, unknown> | undefined }>;
  };
  collection(path: string): FirestoreQueryLike;
}
interface FirestoreQueryLike {
  where(field: string, op: string, value: unknown): FirestoreQueryLike;
  orderBy(field: string, direction?: "asc" | "desc"): FirestoreQueryLike;
  limit(n: number): FirestoreQueryLike;
  get(): Promise<{
    docs: Array<{ id: string; data(): Record<string, unknown> | undefined }>;
  }>;
}

interface ProvenanceInput {
  createdBy?: unknown;
  source?: unknown;
  tutorConfirmed?: unknown;
  userConfirmed?: unknown;
  requiresManualConfirmation?: unknown;
  workflowStatus?: unknown;
  extractedData?: { masterPayload?: unknown } | null;
}

/** Returns one of: 'vet_input' | 'tutor_confirmed' | 'ai_pending_review' | 'tutor_input' | 'ai_extraction'. */
export function deriveProvenanceSource(e: ProvenanceInput): string {
  if (e.createdBy === "vet" || e.source === "vet_input") return "vet_input";
  if (e.tutorConfirmed === true || e.userConfirmed === true) return "tutor_confirmed";
  if (e.requiresManualConfirmation === true || e.workflowStatus === "review_required") {
    return "ai_pending_review";
  }
  if (e.source === "manual" || !e.extractedData?.masterPayload) return "tutor_input";
  return "ai_extraction";
}

/** Maps the repo provenance label onto the export-safety bucket. */
export function bucketForProvenance(provenance: string): "vet_document" | "tutor_input" {
  if (provenance === "vet_input" || provenance === "tutor_confirmed") {
    return "vet_document";
  }
  return "tutor_input";
}

/** Pure mapper from a raw Firestore medical_event doc to a RawEvent for the builder. */
export function mapMedicalEvent(id: string, raw: Record<string, unknown>): RawEvent {
  const e = raw as ProvenanceInput & Record<string, unknown>;
  const ed = (e.extractedData as Record<string, unknown> | undefined) ?? {};
  const mp = (ed.masterPayload as Record<string, unknown> | undefined) ?? {};
  const di = (mp.document_info as Record<string, unknown> | undefined) ??
    (ed.document_info as Record<string, unknown> | undefined) ?? {};

  const provenance = deriveProvenanceSource(e);
  const bucket = bucketForProvenance(provenance);

  const condition =
    str(di.diagnoses) ??
    str(ed.diagnoses) ??
    str(di.title) ??
    str(ed.title) ??
    str(e.title) ??
    null;

  const text = str(di.notes) ?? str(ed.notes) ?? str(e.notes) ?? null;

  return {
    id,
    petId: str(e.petId) ?? undefined,
    source: bucket,
    type: str(ed.eventType) ?? str(e.type) ?? str(di.document_type) ?? undefined,
    condition: condition ?? undefined,
    text: text ?? undefined,
    date: str(ed.eventDate) ?? str(e.createdAt) ?? undefined,
    createdAt: str(e.createdAt) ?? undefined,
  };
}

/** Pure mapper from a raw treatments doc to a RawEvent. */
export function mapTreatment(id: string, raw: Record<string, unknown>): RawEvent {
  const e = raw as ProvenanceInput & Record<string, unknown>;
  const provenance = deriveProvenanceSource(e);
  const bucket = bucketForProvenance(provenance);
  return {
    id,
    petId: str(e.petId) ?? undefined,
    source: bucket,
    name: str(e.name) ?? str(e.title) ?? undefined,
    date: str(e.startDate) ?? str(e.date) ?? str(e.createdAt) ?? undefined,
    createdAt: str(e.createdAt) ?? undefined,
  };
}

/** Pet loader. Returns null if the pet doc does not exist. */
export async function loadPet(
  firestore: FirestoreLike,
  petId: string,
): Promise<RawPet | null> {
  const snap = await firestore.doc(`pets/${petId}`).get();
  if (!snap.exists) return null;
  const d = snap.data() ?? {};
  return {
    id: snap.id,
    name: str(d.name) ?? undefined,
    ownerId: str(d.ownerId) ?? undefined,
  };
}

export async function loadMedicalEvents(
  firestore: FirestoreLike,
  petId: string,
  limit = 200,
): Promise<RawEvent[]> {
  const snap = await firestore
    .collection("medical_events")
    .where("petId", "==", petId)
    .orderBy("createdAt", "desc")
    .limit(limit)
    .get();
  return snap.docs.map((d) => mapMedicalEvent(d.id, d.data() ?? {}));
}

export async function loadTreatments(
  firestore: FirestoreLike,
  petId: string,
  limit = 100,
): Promise<RawEvent[]> {
  const snap = await firestore
    .collection("treatments")
    .where("petId", "==", petId)
    .limit(limit)
    .get();
  return snap.docs.map((d) => mapTreatment(d.id, d.data() ?? {}));
}

function str(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
}
