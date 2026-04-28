/**
 * Source-backed export types.
 *
 * Why these types exist: the export payload must be safe by *architecture*,
 * not safe by prompt. Every clinical claim carries a `source` discriminator
 * and `sourceEventIds` so a human reviewer (and runtime validators) can
 * verify each item traces to a real Firestore event.
 *
 * Three-bucket model (replaces the previous binary documented vs tutor_input):
 *
 *   1. DOCUMENTED — evidence-grade. Confirmed by a vet or by the tutor on
 *      top of a real document. Counts as a documented diagnosis.
 *      Repo provenance labels that map here: vet_input, tutor_confirmed.
 *      Type-level enum: vet_document, vaccination_card, lab_pdf, prescription.
 *
 *   2. PENDING_REVIEW — extracted from a real source (vet PDF, lab,
 *      email-attached document) by the AI pipeline but NOT yet confirmed
 *      by tutor or vet. Should be visible to the tutor as "pending review",
 *      never as a confirmed diagnosis. Repo provenance: ai_extraction,
 *      ai_pending_review.
 *
 *   3. TUTOR_NOTE — free-form text the tutor typed by hand, no document
 *      backing. Always shown as observation. Repo provenance: tutor_input.
 *
 * The previous 2-bucket model collapsed PENDING_REVIEW into TUTOR_NOTE,
 * which made the PDF describe AI-extracted-from-vet-PDF events as
 * "cargado por el tutor sin verificación clínica" — misleading.
 */

export const DOCUMENTED_SOURCES = [
  "vet_document",
  "vaccination_card",
  "lab_pdf",
  "prescription",
] as const;

export type DocumentedSource = (typeof DOCUMENTED_SOURCES)[number];

export type PendingReviewSource = "ai_extraction" | "ai_pending_review";

export type TutorNoteSource = "tutor_input";

export type AnySource = DocumentedSource | PendingReviewSource | TutorNoteSource;

export const PENDING_REVIEW_SOURCES: readonly PendingReviewSource[] = [
  "ai_extraction",
  "ai_pending_review",
];

export interface Diagnosis {
  id: string;
  condition: string;
  date: string; // ISO 8601
  source: DocumentedSource;
  sourceEventIds: string[];
}

export interface Observation {
  id: string;
  text: string;
  date: string;
  source: TutorNoteSource;
  sourceEventIds: string[];
}

/**
 * AI-extracted finding that is NOT yet confirmed by a vet or by the tutor.
 * Comes from a real source (PDF, email attachment, OCR) but should be
 * shown as "pending review", never as documented evidence.
 */
export interface PendingReviewItem {
  id: string;
  /** Best-effort label of the finding (diagnosis text, study type, etc.). */
  label: string;
  date: string;
  source: PendingReviewSource;
  sourceEventIds: string[];
}

export interface Vaccination {
  id: string;
  name: string;
  date: string;
  source: DocumentedSource;
  sourceEventIds: string[];
}

export interface Treatment {
  id: string;
  name: string;
  date: string;
  source: DocumentedSource;
  sourceEventIds: string[];
}

export interface ExportPayload {
  petId: string;
  petName: string | null;
  /**
   * True iff the pet has zero medical_events / vaccinations / treatments
   * loaded. When true, the frontend should render an honest empty state
   * and never call the question generator.
   */
  safeTemplate: boolean;
  documentedDiagnoses: Diagnosis[];
  /**
   * AI-extracted findings still pending vet/tutor confirmation. The
   * underlying source IS a real document; the data just hasn't been
   * verified yet. UI should label these explicitly as "pending review",
   * not as documented diagnoses.
   */
  pendingReview: PendingReviewItem[];
  /** Free-form tutor notes. Never count as documented evidence. */
  observations: Observation[];
  vaccinations: Vaccination[];
  treatments: Treatment[];
  suggestedQuestionsForVet: string[];
  /** Convenience counter for the UI; equals pendingReview.length. */
  pendingReviewCount: number;
  generatedAt: string; // ISO 8601
}

/** Generic shape for events loaded from Firestore (medical_events / treatments / vaccinations). */
export interface RawEvent {
  id: string;
  petId?: string;
  source?: string;
  type?: string;
  condition?: string;
  diagnosis?: string;
  name?: string;
  text?: string;
  notes?: string;
  date?: string;
  createdAt?: string;
}

export interface RawPet {
  id: string;
  name?: string;
  ownerId?: string;
}

export function isDocumentedSource(s: unknown): s is DocumentedSource {
  return typeof s === "string" && (DOCUMENTED_SOURCES as readonly string[]).includes(s);
}

export function isPendingReviewSource(s: unknown): s is PendingReviewSource {
  return typeof s === "string" && (PENDING_REVIEW_SOURCES as readonly string[]).includes(s);
}
