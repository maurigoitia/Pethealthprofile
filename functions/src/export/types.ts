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
  /** Optional dosage as written on the prescription. Never inferred. */
  dosage?: string;
  /** e.g. "cada 12 horas". Never inferred. */
  frequency?: string;
  /** e.g. "vía oral". Never inferred. */
  route?: string;
  /** Active vs historical. */
  status?: "active" | "historical";
  /** Vet who prescribed, when known. */
  prescribedBy?: string;
}

/**
 * Categorized study record (lab, imaging, ECG, etc). Studies are grouped
 * for narrative output ("3 estudios cardiológicos / 2 análisis de laboratorio").
 * Never contains diagnostic interpretation.
 */
export interface Study {
  id: string;
  /** Coarse type used for grouping in the narrative. */
  type: StudyType;
  /** Specific subtype if known: "ecocardiograma", "radiografía pelvis", "KOH". */
  subtype: string | null;
  date: string;
  /**
   * One-line factual finding extracted verbatim from the document
   * (e.g. "cardiomiopatía dilatada"). Quoted, not interpreted. Optional.
   */
  finding: string | null;
  /** Vet/professional who signed the study. Null if unsigned/unknown. */
  signedBy: string | null;
  /** Lab / clinic / institution that issued the study. */
  institution: string | null;
  source: DocumentedSource | PendingReviewSource;
  sourceEventIds: string[];
}

export const STUDY_TYPES = [
  "lab",
  "imaging_radiology",
  "imaging_ultrasound",
  "imaging_echocardiogram",
  "ecg",
  "dermatology_microscopy",
  "ophthalmology",
  "biopsy",
  "other",
] as const;

export type StudyType = (typeof STUDY_TYPES)[number];

export interface Appointment {
  id: string;
  type: string;
  date: string;
  /** Past: status="completed" | "cancelled"; Future: status="upcoming". */
  status: "upcoming" | "completed" | "cancelled" | "unknown";
  professional: string | null;
  institution: string | null;
  notes: string | null;
  sourceEventIds: string[];
}

/** Deduplicated professional record, aggregated across all events. */
export interface Professional {
  /** Normalized name used for dedup. */
  name: string;
  /** License/matrícula if known. */
  license: string | null;
  /** Most-recent institution this professional was associated with. */
  institution: string | null;
  /** How many distinct events mention this professional. */
  eventCount: number;
  /** Last seen date across all events. */
  lastSeenAt: string | null;
  sourceEventIds: string[];
}

/** Deduplicated institution / clinic / lab record. */
export interface Institution {
  name: string;
  /** "clinica", "laboratorio", "hospital", etc — best-effort. */
  kind: string | null;
  address: string | null;
  phone: string | null;
  eventCount: number;
  sourceEventIds: string[];
}

/**
 * Pre-rendered narrative blocks. The frontend should display these as
 * sentences in the existing PDF sections instead of building lists from
 * scratch. Each block is a deterministic projection of the structured
 * payload — no AI generation, no invented content.
 */
export interface NarrativeBlocks {
  /** "Este perfil contiene información clínica registrada, incluyendo X, Y, Z..." */
  dataStatus: string;
  /** "Thor tiene tratamiento activo registrado con Pimobendan. También hay..." */
  currentCare: string;
  /** "10 estudios documentados — 4 cardiológicos, 3 de laboratorio, 2 radiológicos, 1 dermatológico." */
  studiesSummary: string;
  /** "Algunos documentos todavía requieren revisión: 3 estudios sin firma, 2 turnos sin hora confirmada." */
  pendingReviewSummary: string;
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
  /**
   * Studies grouped from medical_events with imaging/lab/ECG/etc document
   * types. Used by PDF section 5 ("Estudios realizados") for narrative
   * output instead of raw event dumps.
   */
  studies: Study[];
  /**
   * Past + upcoming appointments. Past come from medical_events with
   * documentType="appointment"; upcoming come from the appointments
   * collection (when present).
   */
  appointments: Appointment[];
  /** Deduped vet/specialist roster across all events. */
  professionals: Professional[];
  /** Deduped clinic/lab/hospital roster across all events. */
  institutions: Institution[];
  /** Pre-rendered narrative sentences, see NarrativeBlocks. */
  narrative: NarrativeBlocks;
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
  /** Optional document_type from extractedData (e.g. "lab_test", "echocardiogram"). */
  documentType?: string | null;
  /** Vet name extracted from the document. */
  veterinarian?: string | null;
  /** Vet license extracted from the document. */
  veterinarianLicense?: string | null;
  /** Clinic / institution name extracted from the document. */
  clinic?: string | null;
  /** Specific finding/observation phrase extracted (no inference). */
  mainFinding?: string | null;
  /** Medications array as extracted, items: { name, dosage?, frequency?, route? }. */
  medications?: Array<{
    name?: string | null;
    dosage?: string | null;
    frequency?: string | null;
    route?: string | null;
  }> | null;
  /** Detected appointments inside this event (not the same as the appointments collection). */
  detectedAppointments?: Array<{
    date?: string | null;
    time?: string | null;
    specialty?: string | null;
    location?: string | null;
  }> | null;
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
