/**
 * buildExportPayload — pure builder for the source-backed export payload.
 *
 * Architectural rules enforced here (NOT delegated to the model):
 *   1. Empty pet (no events anywhere) → return safeTemplate=true and DO NOT
 *      call the question generator.
 *   2. Only events with a documented `source` count toward documentedDiagnoses,
 *      vaccinations, treatments. tutor_input → observations.
 *   3. Every clinical item carries `sourceEventIds` populated from real
 *      Firestore document ids. Items whose sourceEventIds are empty or
 *      reference an id we did not load are dropped.
 *   4. suggestedQuestionsForVet pass through `filterSuggestedQuestions`.
 *
 * No diagnosis, no treatment recommendation, no hardcoded pet/species/
 * condition is produced here. Ever.
 */

import {
  Diagnosis,
  ExportPayload,
  Observation,
  PendingReviewItem,
  RawEvent,
  RawPet,
  Treatment,
  Vaccination,
  isDocumentedSource,
  isPendingReviewSource,
} from "./types";
import { filterSuggestedQuestions } from "./questionFilter";

export interface ExportDeps {
  loadPet: (petId: string) => Promise<RawPet | null>;
  loadMedicalEvents: (petId: string) => Promise<RawEvent[]>;
  loadVaccinations: (petId: string) => Promise<RawEvent[]>;
  loadTreatments: (petId: string) => Promise<RawEvent[]>;
  /**
   * Generates suggested questions for the vet based on already-validated
   * documented events. Implementations are expected to call Gemini/Vertex.
   * Receives only sanitized inputs; output is filtered downstream.
   */
  generateSuggestedQuestions: (input: GenerateQuestionsInput) => Promise<string[]>;
  now?: () => Date;
}

export interface GenerateQuestionsInput {
  petName: string | null;
  documentedDiagnoses: Diagnosis[];
  vaccinations: Vaccination[];
  treatments: Treatment[];
}

export async function buildExportPayload(
  petId: string,
  deps: ExportDeps,
): Promise<ExportPayload> {
  if (!petId || typeof petId !== "string") {
    throw new Error("buildExportPayload: petId required");
  }

  const now = (deps.now?.() ?? new Date()).toISOString();
  const pet = await deps.loadPet(petId);
  const petName = pet?.name ?? null;

  const [eventsRaw, vaccsRaw, treatmentsRaw] = await Promise.all([
    deps.loadMedicalEvents(petId),
    deps.loadVaccinations(petId),
    deps.loadTreatments(petId),
  ]);

  const totalLoaded = eventsRaw.length + vaccsRaw.length + treatmentsRaw.length;

  // Fix 1: empty pet — return safe template, never call the generator.
  if (totalLoaded === 0) {
    return {
      petId,
      petName,
      safeTemplate: true,
      documentedDiagnoses: [],
      pendingReview: [],
      observations: [],
      vaccinations: [],
      treatments: [],
      suggestedQuestionsForVet: [],
      pendingReviewCount: 0,
      generatedAt: now,
    };
  }

  // Build the loaded-id set up front for sourceEventIds validation.
  const loadedIds = new Set<string>();
  for (const e of eventsRaw) loadedIds.add(e.id);
  for (const e of vaccsRaw) loadedIds.add(e.id);
  for (const e of treatmentsRaw) loadedIds.add(e.id);

  const documentedDiagnoses: Diagnosis[] = [];
  const pendingReview: PendingReviewItem[] = [];
  const observations: Observation[] = [];

  for (const e of eventsRaw) {
    if (isDocumentedSource(e.source)) {
      const condition = (e.condition ?? e.diagnosis ?? "").trim();
      if (!condition) continue;
      documentedDiagnoses.push({
        id: e.id,
        condition,
        date: e.date ?? e.createdAt ?? now,
        source: e.source,
        sourceEventIds: [e.id],
      });
    } else if (isPendingReviewSource(e.source)) {
      // AI-extracted from a real source but not yet vet/tutor confirmed.
      // Surfaces in the UI as "pending review", never as documented.
      const label = (e.condition ?? e.diagnosis ?? e.text ?? e.notes ?? e.type ?? "").trim();
      if (!label) continue;
      pendingReview.push({
        id: e.id,
        label,
        date: e.date ?? e.createdAt ?? now,
        source: e.source,
        sourceEventIds: [e.id],
      });
    } else if (e.source === "tutor_input") {
      const text = (e.text ?? e.notes ?? e.condition ?? e.diagnosis ?? "").trim();
      if (!text) continue;
      observations.push({
        id: e.id,
        text,
        date: e.date ?? e.createdAt ?? now,
        source: "tutor_input",
        sourceEventIds: [e.id],
      });
    }
    // Unknown source → drop silently. Fail closed.
  }

  const vaccinations: Vaccination[] = [];
  for (const v of vaccsRaw) {
    if (!isDocumentedSource(v.source)) continue;
    const name = (v.name ?? "").trim();
    if (!name) continue;
    vaccinations.push({
      id: v.id,
      name,
      date: v.date ?? v.createdAt ?? now,
      source: v.source,
      sourceEventIds: [v.id],
    });
  }

  const treatments: Treatment[] = [];
  for (const t of treatmentsRaw) {
    if (!isDocumentedSource(t.source)) continue;
    const name = (t.name ?? "").trim();
    if (!name) continue;
    treatments.push({
      id: t.id,
      name,
      date: t.date ?? t.createdAt ?? now,
      source: t.source,
      sourceEventIds: [t.id],
    });
  }

  // Defense-in-depth: drop any item whose sourceEventIds reference an id
  // we did not actually load. Catches upstream bugs and prompt-injected
  // fabrications if any future refactor passes generated content through here.
  const validatedDiagnoses = documentedDiagnoses.filter((d) =>
    hasOnlyLoadedIds(d.sourceEventIds, loadedIds),
  );
  const validatedPending = pendingReview.filter((p) =>
    hasOnlyLoadedIds(p.sourceEventIds, loadedIds),
  );
  const validatedObservations = observations.filter((o) =>
    hasOnlyLoadedIds(o.sourceEventIds, loadedIds),
  );
  const validatedVaccinations = vaccinations.filter((v) =>
    hasOnlyLoadedIds(v.sourceEventIds, loadedIds),
  );
  const validatedTreatments = treatments.filter((t) =>
    hasOnlyLoadedIds(t.sourceEventIds, loadedIds),
  );

  // Final guard for Fix 3: nothing tagged tutor_input may sneak into
  // documentedDiagnoses. If this ever fires, it's a programmer bug.
  for (const d of validatedDiagnoses) {
    if ((d as unknown as { source: string }).source === "tutor_input") {
      throw new Error(
        "buildExportPayload: tutor_input leaked into documentedDiagnoses",
      );
    }
  }

  let questions: string[] = [];
  // Only call the generator when there's something documented to ground it.
  if (
    validatedDiagnoses.length + validatedVaccinations.length + validatedTreatments.length >
    0
  ) {
    const raw = await deps.generateSuggestedQuestions({
      petName,
      documentedDiagnoses: validatedDiagnoses,
      vaccinations: validatedVaccinations,
      treatments: validatedTreatments,
    });
    questions = filterSuggestedQuestions(raw).questions;
  }

  return {
    petId,
    petName,
    safeTemplate: false,
    documentedDiagnoses: validatedDiagnoses,
    pendingReview: validatedPending,
    observations: validatedObservations,
    vaccinations: validatedVaccinations,
    treatments: validatedTreatments,
    suggestedQuestionsForVet: questions,
    pendingReviewCount: validatedPending.length,
    generatedAt: now,
  };
}

export function hasOnlyLoadedIds(ids: string[], loaded: Set<string>): boolean {
  if (!Array.isArray(ids) || ids.length === 0) return false;
  for (const id of ids) {
    if (typeof id !== "string" || !loaded.has(id)) return false;
  }
  return true;
}
