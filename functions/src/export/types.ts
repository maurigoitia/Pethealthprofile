/**
 * Source-backed export types.
 *
 * Why these types exist: the export payload must be safe by *architecture*,
 * not safe by prompt. Every clinical claim carries a `source` discriminator
 * and `sourceEventIds` so a human reviewer (and runtime validators) can
 * verify each item traces to a real Firestore event.
 *
 * Documented sources (count as evidence): vet_document, vaccination_card,
 *   lab_pdf, prescription.
 * Tutor-only sources (NEVER count as documented): tutor_input.
 */

export const DOCUMENTED_SOURCES = [
  "vet_document",
  "vaccination_card",
  "lab_pdf",
  "prescription",
] as const;

export type DocumentedSource = (typeof DOCUMENTED_SOURCES)[number];

export type ObservationSource = "tutor_input";

export type AnySource = DocumentedSource | ObservationSource;

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
  source: ObservationSource;
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
  safeTemplate: boolean;
  documentedDiagnoses: Diagnosis[];
  observations: Observation[];
  vaccinations: Vaccination[];
  treatments: Treatment[];
  suggestedQuestionsForVet: string[];
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
