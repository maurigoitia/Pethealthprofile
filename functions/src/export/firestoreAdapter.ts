/**
 * Adapter between Firestore documents and the source-backed export types.
 *
 * The repo's existing provenance model uses these labels on medical_events:
 *   vet_input | tutor_confirmed | ai_extraction | ai_pending_review | tutor_input
 *
 * Three-bucket mapping (matches functions/src/export/types.ts):
 *   - documented (vet_document):     vet_input, tutor_confirmed
 *   - pending_review (ai_extraction): ai_extraction, ai_pending_review
 *   - tutor_input:                    tutor_input, manual, unknown
 *
 * Why three buckets instead of two: an event AI-extracted from a real vet
 * PDF should NOT be presented to the user as "tutor_input / sin verificación
 * clínica". The 2-bucket model collapsed those cases and made the PDF lie
 * about the origin of the data. The 3-bucket model preserves that an
 * underlying document exists but is still pending review.
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

/**
 * Maps the repo provenance label onto the export-safety bucket.
 *
 * Returns one of:
 *   - "vet_document"      → counts as documented evidence
 *   - "ai_extraction"     → pending review (real source, unconfirmed)
 *   - "tutor_input"       → free-form tutor note
 */
export function bucketForProvenance(
  provenance: string,
): "vet_document" | "ai_extraction" | "tutor_input" {
  if (provenance === "vet_input" || provenance === "tutor_confirmed") {
    return "vet_document";
  }
  if (provenance === "ai_extraction" || provenance === "ai_pending_review") {
    return "ai_extraction";
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

  // Vet/clinic identity from the document. Preferred path is the
  // masterPayload structure, with falls back to flat extractedData.
  const veterinarian =
    str(di.veterinarian_name) ??
    str(ed.veterinarian_name) ??
    null;
  const veterinarianLicense =
    str(di.veterinarian_license) ??
    str(ed.veterinarian_license) ??
    null;
  const clinic =
    str(di.clinic_name) ??
    str(ed.clinic_name) ??
    null;

  // Specific finding/observation phrase (no inference). Used by the
  // study summary so the PDF can quote what the document says verbatim,
  // not interpret it.
  const mainFinding =
    str(di.findings) ??
    str(ed.findings) ??
    str(di.mainFinding) ??
    str(ed.aiGeneratedSummary) ??
    null;

  // Medications array — preserves dosage/frequency/route when present.
  const medsRaw = (ed.medications as unknown[] | undefined)
    ?? (di.medications as unknown[] | undefined)
    ?? null;
  const medications = Array.isArray(medsRaw)
    ? medsRaw
        .map((m): { name?: string | null; dosage?: string | null; frequency?: string | null; route?: string | null } | null => {
          if (!m || typeof m !== "object") return null;
          const r = m as Record<string, unknown>;
          return {
            name: str(r.name),
            dosage: str(r.dosage),
            frequency: str(r.frequency),
            route: str(r.route),
          };
        })
        .filter((m): m is NonNullable<typeof m> => !!m && !!m.name)
    : null;

  // Detected appointments inside this event (e.g. "next checkup on …").
  const apptsRaw = (ed.detectedAppointments as unknown[] | undefined) ?? null;
  const detectedAppointments = Array.isArray(apptsRaw)
    ? apptsRaw
        .map((a) => {
          if (!a || typeof a !== "object") return null;
          const r = a as Record<string, unknown>;
          return {
            date: str(r.date),
            time: str(r.time),
            specialty: str(r.specialty),
            location: str(r.location),
          };
        })
        .filter((a): a is NonNullable<typeof a> => !!a)
    : null;

  return {
    id,
    petId: str(e.petId) ?? undefined,
    source: bucket,
    type: str(ed.eventType) ?? str(e.type) ?? str(di.document_type) ?? undefined,
    condition: condition ?? undefined,
    text: text ?? undefined,
    date: str(ed.eventDate) ?? str(e.createdAt) ?? undefined,
    createdAt: str(e.createdAt) ?? undefined,
    documentType: str(di.document_type) ?? str(ed.documentType) ?? null,
    veterinarian,
    veterinarianLicense,
    clinic,
    mainFinding,
    medications: medications && medications.length > 0 ? medications : null,
    detectedAppointments: detectedAppointments && detectedAppointments.length > 0 ? detectedAppointments : null,
  };
}

/**
 * Loader for the appointments collection. Pet appointments live in their
 * own collection, separate from medical_events.
 */
export async function loadAppointments(
  firestore: FirestoreLike,
  petId: string,
  limit = 100,
): Promise<RawAppointment[]> {
  const snap = await firestore
    .collection("appointments")
    .where("petId", "==", petId)
    .limit(limit)
    .get();
  return snap.docs.map((d) => mapAppointment(d.id, d.data() ?? {}));
}

/** Raw shape for appointments collection rows. */
export interface RawAppointment {
  id: string;
  date: string | null;
  type: string | null;
  status: "upcoming" | "completed" | "cancelled" | "unknown";
  professional: string | null;
  institution: string | null;
  notes: string | null;
}

export function mapAppointment(id: string, raw: Record<string, unknown>): RawAppointment {
  const r = raw as Record<string, unknown>;
  const statusRaw = str(r.status);
  const status: RawAppointment["status"] =
    statusRaw === "upcoming" || statusRaw === "completed" || statusRaw === "cancelled"
      ? statusRaw
      : "unknown";
  return {
    id,
    date: str(r.date) ?? str(r.scheduledFor) ?? str(r.startDate) ?? null,
    type: str(r.type) ?? str(r.title) ?? null,
    status,
    professional: str(r.professional) ?? str(r.veterinarian_name) ?? null,
    institution: str(r.clinic) ?? str(r.location) ?? null,
    notes: str(r.notes) ?? null,
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
