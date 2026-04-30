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
 *   5. Studies, professionals, institutions are AGGREGATED across raw events
 *      via deterministic projection — never inferred. Narrative blocks are
 *      template-based counts of those structures.
 *
 * No diagnosis, no treatment recommendation, no hardcoded pet/species/
 * condition is produced here. Ever.
 */

import {
  Appointment,
  Diagnosis,
  ExportPayload,
  Institution,
  Observation,
  PendingReviewItem,
  Professional,
  RawEvent,
  RawPet,
  Study,
  StudyType,
  Treatment,
  Vaccination,
  isDocumentedSource,
  isPendingReviewSource,
} from "./types";
import { filterSuggestedQuestions } from "./questionFilter";
import { buildNarrative } from "./narrativeBuilder";
import type { RawAppointment } from "./firestoreAdapter";

export interface ExportDeps {
  loadPet: (petId: string) => Promise<RawPet | null>;
  loadMedicalEvents: (petId: string) => Promise<RawEvent[]>;
  loadVaccinations: (petId: string) => Promise<RawEvent[]>;
  loadTreatments: (petId: string) => Promise<RawEvent[]>;
  /** Optional: pet appointments from the appointments collection. */
  loadAppointments?: (petId: string) => Promise<RawAppointment[]>;
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

  const [eventsRaw, vaccsRaw, treatmentsRaw, apptsRaw] = await Promise.all([
    deps.loadMedicalEvents(petId),
    deps.loadVaccinations(petId),
    deps.loadTreatments(petId),
    deps.loadAppointments ? deps.loadAppointments(petId) : Promise.resolve<RawAppointment[]>([]),
  ]);

  const totalLoaded =
    eventsRaw.length + vaccsRaw.length + treatmentsRaw.length + apptsRaw.length;

  // Fix 1: empty pet — return safe template, never call the generator.
  if (totalLoaded === 0) {
    const emptyNarrative = buildNarrative({
      petName,
      documentedDiagnoses: [],
      pendingReview: [],
      observations: [],
      vaccinations: [],
      treatments: [],
      studies: [],
      appointments: [],
      professionals: [],
      institutions: [],
    });
    return {
      petId,
      petName,
      safeTemplate: true,
      documentedDiagnoses: [],
      pendingReview: [],
      observations: [],
      vaccinations: [],
      treatments: [],
      studies: [],
      appointments: [],
      professionals: [],
      institutions: [],
      narrative: emptyNarrative,
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
  for (const a of apptsRaw) loadedIds.add(a.id);

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

  // Treatments: enrich with dosage/frequency/route from event medications[]
  // when the treatment doc itself doesn't carry them. Done by matching the
  // treatment's name to a medication entry in any related event. No
  // inference — just verbatim copy of fields.
  const treatments: Treatment[] = [];
  const medsByName = new Map<string, { dosage?: string; frequency?: string; route?: string; sourceEventId?: string }>();
  for (const e of eventsRaw) {
    if (!e.medications) continue;
    for (const med of e.medications) {
      if (!med.name) continue;
      const key = med.name.trim().toLowerCase();
      if (!medsByName.has(key)) {
        medsByName.set(key, {
          dosage: med.dosage ?? undefined,
          frequency: med.frequency ?? undefined,
          route: med.route ?? undefined,
          sourceEventId: e.id,
        });
      }
    }
  }
  for (const t of treatmentsRaw) {
    if (!isDocumentedSource(t.source)) continue;
    const name = (t.name ?? "").trim();
    if (!name) continue;
    const enriched = medsByName.get(name.toLowerCase());
    treatments.push({
      id: t.id,
      name,
      date: t.date ?? t.createdAt ?? now,
      source: t.source,
      sourceEventIds: [t.id],
      dosage: enriched?.dosage,
      frequency: enriched?.frequency,
      route: enriched?.route,
      // Treatments collection doesn't always carry status; default to active.
      // Rendering side can apply additional rules if needed.
      status: "active",
    });
  }

  // Studies: pulled from medical_events whose documentType matches a known
  // study category. Only documented or pending-review sources are kept.
  const studies = aggregateStudies(eventsRaw);

  // Professionals + institutions: deduped across documented + pending-review
  // events that contain a vet name or clinic name. Tutor-input events do
  // not contribute (they have no document basis).
  const { professionals, institutions } = aggregateRosters(eventsRaw);

  // Appointments: past from medical_events with documentType="appointment"
  // OR explicit detectedAppointments in extractedData; future from the
  // appointments collection.
  const appointments = aggregateAppointments(eventsRaw, apptsRaw, now);

  // Defense-in-depth: drop any item whose sourceEventIds reference an id
  // we did not actually load.
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

  // Studies + appointments: filter by sourceEventIds being subsets of loadedIds.
  // (For studies the sourceEventIds match the medical_event id; for appointments
  // they match either the event id or the appointment doc id.)
  const validatedStudies = studies.filter((s) => hasOnlyLoadedIds(s.sourceEventIds, loadedIds));
  const validatedAppointments = appointments.filter((a) => hasOnlyLoadedIds(a.sourceEventIds, loadedIds));

  // Final guard for Fix 3: nothing tagged tutor_input may sneak into documentedDiagnoses.
  for (const d of validatedDiagnoses) {
    if ((d as unknown as { source: string }).source === "tutor_input") {
      throw new Error(
        "buildExportPayload: tutor_input leaked into documentedDiagnoses",
      );
    }
  }

  let questions: string[] = [];
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

  // Build narrative blocks from the validated structured data.
  const narrative = buildNarrative({
    petName,
    documentedDiagnoses: validatedDiagnoses,
    pendingReview: validatedPending,
    observations: validatedObservations,
    vaccinations: validatedVaccinations,
    treatments: validatedTreatments,
    studies: validatedStudies,
    appointments: validatedAppointments,
    professionals,
    institutions,
  });

  return {
    petId,
    petName,
    safeTemplate: false,
    documentedDiagnoses: validatedDiagnoses,
    pendingReview: validatedPending,
    observations: validatedObservations,
    vaccinations: validatedVaccinations,
    treatments: validatedTreatments,
    studies: validatedStudies,
    appointments: validatedAppointments,
    professionals,
    institutions,
    narrative,
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

// ── Aggregators ─────────────────────────────────────────────────────────────

const STUDY_TYPE_PATTERNS: Array<{ test: RegExp; type: StudyType }> = [
  // Most specific first.
  { test: /\b(echo|eco)?\s*cardio?gram|ecocardio/i, type: "imaging_echocardiogram" },
  { test: /\b(ecograf|ultrasound|ultrasonido)/i, type: "imaging_ultrasound" },
  { test: /\b(radio|x[- ]?ray)/i, type: "imaging_radiology" },
  { test: /\b(ecg|electrocardio)/i, type: "ecg" },
  { test: /\b(koh|microscop|dermatolog|raspaje)/i, type: "dermatology_microscopy" },
  { test: /\b(oftalm|ojo)/i, type: "ophthalmology" },
  { test: /\b(biops)/i, type: "biopsy" },
  { test: /\b(lab|laborator|hemograma|bioquim|sangre|orina|urin|coprolog)/i, type: "lab" },
];

/** Maps a free-form documentType string to a coarse StudyType. */
export function classifyStudyType(documentType: string | null | undefined): StudyType | null {
  if (!documentType) return null;
  const lower = documentType.toLowerCase();
  for (const { test, type } of STUDY_TYPE_PATTERNS) {
    if (test.test(lower)) return type;
  }
  // Common explicit values we expect from extractedData.documentType
  if (lower === "lab" || lower === "lab_test") return "lab";
  if (lower === "xray" || lower === "x_ray") return "imaging_radiology";
  if (lower === "ecocardiogram" || lower === "echocardiogram") return "imaging_echocardiogram";
  if (lower === "ecg") return "ecg";
  // No match → return null (caller decides whether to bucket as "other" or skip).
  return null;
}

function aggregateStudies(events: RawEvent[]): Study[] {
  const out: Study[] = [];
  for (const e of events) {
    const docType = e.documentType ?? e.type ?? null;
    const studyType = classifyStudyType(docType);
    if (!studyType) continue;
    // Only documented or pending-review can become a study (not tutor notes).
    if (e.source !== "vet_document" && e.source !== "ai_extraction") continue;
    out.push({
      id: e.id,
      type: studyType,
      subtype: docType,
      date: e.date ?? e.createdAt ?? "",
      finding: e.mainFinding ?? null,
      signedBy: e.veterinarian ?? null,
      institution: e.clinic ?? null,
      source: e.source === "vet_document" ? "vet_document" : "ai_extraction",
      sourceEventIds: [e.id],
    });
  }
  return out;
}

function normalizeName(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ").replace(/^dr[a]?\.?\s*/i, "");
}

function aggregateRosters(events: RawEvent[]): { professionals: Professional[]; institutions: Institution[] } {
  const profMap = new Map<string, Professional>();
  const instMap = new Map<string, Institution>();
  for (const e of events) {
    if (e.source !== "vet_document" && e.source !== "ai_extraction") continue;
    if (e.veterinarian) {
      const key = normalizeName(e.veterinarian);
      const existing = profMap.get(key);
      if (existing) {
        existing.eventCount += 1;
        existing.sourceEventIds.push(e.id);
        if (e.veterinarianLicense && !existing.license) existing.license = e.veterinarianLicense;
        if (e.clinic && (!existing.institution || existing.institution !== e.clinic)) {
          // Last-seen wins.
          existing.institution = e.clinic;
        }
        const eventDate = e.date ?? e.createdAt ?? null;
        if (eventDate && (!existing.lastSeenAt || eventDate > existing.lastSeenAt)) {
          existing.lastSeenAt = eventDate;
        }
      } else {
        profMap.set(key, {
          name: e.veterinarian,
          license: e.veterinarianLicense ?? null,
          institution: e.clinic ?? null,
          eventCount: 1,
          lastSeenAt: e.date ?? e.createdAt ?? null,
          sourceEventIds: [e.id],
        });
      }
    }
    if (e.clinic) {
      const key = normalizeName(e.clinic);
      const existing = instMap.get(key);
      if (existing) {
        existing.eventCount += 1;
        existing.sourceEventIds.push(e.id);
      } else {
        instMap.set(key, {
          name: e.clinic,
          kind: null,
          address: null,
          phone: null,
          eventCount: 1,
          sourceEventIds: [e.id],
        });
      }
    }
  }
  return {
    professionals: Array.from(profMap.values()).sort((a, b) => b.eventCount - a.eventCount),
    institutions: Array.from(instMap.values()).sort((a, b) => b.eventCount - a.eventCount),
  };
}

function aggregateAppointments(
  events: RawEvent[],
  apptsRaw: RawAppointment[],
  now: string,
): Appointment[] {
  const out: Appointment[] = [];
  // 1) From the appointments collection (future-leaning).
  for (const a of apptsRaw) {
    out.push({
      id: a.id,
      type: a.type ?? "turno",
      date: a.date ?? "",
      status: a.status,
      professional: a.professional,
      institution: a.institution,
      notes: a.notes,
      sourceEventIds: [a.id],
    });
  }
  // 2) From medical_events with documentType="appointment" (past).
  for (const e of events) {
    const docType = (e.documentType ?? "").toLowerCase();
    const isApptEvent = docType === "appointment" || docType === "turno";
    if (isApptEvent && (e.source === "vet_document" || e.source === "ai_extraction")) {
      const eventDate = e.date ?? e.createdAt ?? "";
      const isFuture = eventDate > now;
      out.push({
        id: e.id,
        type: e.type ?? "turno",
        date: eventDate,
        status: isFuture ? "upcoming" : "completed",
        professional: e.veterinarian ?? null,
        institution: e.clinic ?? null,
        notes: e.text ?? null,
        sourceEventIds: [e.id],
      });
    }
    // 3) detectedAppointments inside extracted data.
    if (e.detectedAppointments && e.detectedAppointments.length > 0) {
      for (const da of e.detectedAppointments) {
        if (!da.date) continue;
        const isFuture = da.date > now;
        out.push({
          id: `${e.id}#detected-${out.length}`,
          type: da.specialty ?? "turno",
          date: da.date,
          status: isFuture ? "upcoming" : "completed",
          professional: e.veterinarian ?? null,
          institution: da.location ?? e.clinic ?? null,
          notes: null,
          // Detected appts trace back to the event that announced them.
          sourceEventIds: [e.id],
        });
      }
    }
  }
  // Dedup: same date + same type + same institution → keep first.
  const seen = new Set<string>();
  const deduped: Appointment[] = [];
  for (const a of out) {
    const key = `${a.date}|${a.type}|${a.institution ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(a);
  }
  return deduped.sort((a, b) => (a.date || "").localeCompare(b.date || ""));
}
