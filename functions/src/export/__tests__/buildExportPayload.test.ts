import { describe, expect, it, vi } from "vitest";
import { buildExportPayload, hasOnlyLoadedIds } from "../buildExportPayload";
import { ExportDeps } from "../buildExportPayload";
import { RawEvent } from "../types";

function makeDeps(overrides: Partial<ExportDeps> = {}): ExportDeps {
  return {
    loadPet: async () => ({ id: "pet1", name: "Generic Pet" }),
    loadMedicalEvents: async () => [],
    loadVaccinations: async () => [],
    loadTreatments: async () => [],
    generateSuggestedQuestions: async () => [],
    now: () => new Date("2026-04-27T00:00:00.000Z"),
    ...overrides,
  };
}

describe("buildExportPayload", () => {
  it("Fix 1: empty pet returns safeTemplate and never calls the generator", async () => {
    const generator = vi.fn(async () => ["should not be called"]);
    const payload = await buildExportPayload("pet1", makeDeps({
      generateSuggestedQuestions: generator,
    }));
    expect(payload.safeTemplate).toBe(true);
    expect(payload.documentedDiagnoses).toEqual([]);
    expect(payload.observations).toEqual([]);
    expect(payload.suggestedQuestionsForVet).toEqual([]);
    expect(generator).not.toHaveBeenCalled();
  });

  it("Fix 3: tutor_input never appears as a documented diagnosis", async () => {
    const events: RawEvent[] = [
      {
        id: "e1",
        source: "tutor_input",
        condition: "creo que tiene alergia",
      },
      {
        id: "e2",
        source: "vet_document",
        condition: "Otitis externa",
        date: "2026-03-10",
      },
    ];
    const payload = await buildExportPayload("pet1", makeDeps({
      loadMedicalEvents: async () => events,
    }));
    expect(payload.documentedDiagnoses.map((d) => d.id)).toEqual(["e2"]);
    expect(payload.observations.map((o) => o.id)).toEqual(["e1"]);
    for (const d of payload.documentedDiagnoses) {
      expect(d.source).not.toBe("tutor_input");
    }
  });

  it("AI-extracted events go to pendingReview, never to documentedDiagnoses", async () => {
    const events: RawEvent[] = [
      {
        id: "p1",
        source: "ai_extraction",
        condition: "Otitis (extraído de PDF, sin confirmar)",
        date: "2026-03-10",
      },
      {
        id: "p2",
        source: "ai_pending_review",
        condition: "Cardiomiopatía dilatada",
        date: "2026-03-11",
      },
      {
        id: "e1",
        source: "vet_document",
        condition: "Otitis externa",
        date: "2026-03-12",
      },
    ];
    const payload = await buildExportPayload("pet1", makeDeps({
      loadMedicalEvents: async () => events,
      generateSuggestedQuestions: async () => [],
    }));
    expect(payload.documentedDiagnoses.map((d) => d.id)).toEqual(["e1"]);
    expect(payload.pendingReview.map((p) => p.id).sort()).toEqual(["p1", "p2"]);
    expect(payload.pendingReviewCount).toBe(2);
    // Pending items must not leak into documentedDiagnoses or observations.
    for (const d of payload.documentedDiagnoses) {
      expect(d.source).not.toBe("ai_extraction");
      expect(d.source).not.toBe("ai_pending_review");
    }
    expect(payload.observations).toEqual([]);
  });

  it("documented sources only: unknown sources are dropped", async () => {
    const events: RawEvent[] = [
      { id: "e1", source: "vet_document", condition: "Otitis", date: "2026-03-10" },
      { id: "e2", source: "rumor", condition: "Algo raro" },
      { id: "e3", source: "lab_pdf", condition: "Hipotiroidismo", date: "2026-03-11" },
    ];
    const payload = await buildExportPayload("pet1", makeDeps({
      loadMedicalEvents: async () => events,
      generateSuggestedQuestions: async () => [],
    }));
    expect(payload.documentedDiagnoses.map((d) => d.id).sort()).toEqual([
      "e1",
      "e3",
    ]);
  });

  it("sourceEventIds: items referencing ids we did not load are filtered", () => {
    const loaded = new Set(["e1", "e2"]);
    expect(hasOnlyLoadedIds(["e1"], loaded)).toBe(true);
    expect(hasOnlyLoadedIds(["e1", "e2"], loaded)).toBe(true);
    expect(hasOnlyLoadedIds(["e1", "phantom"], loaded)).toBe(false);
    expect(hasOnlyLoadedIds([], loaded)).toBe(false);
  });

  it("suggestedQuestionsForVet: unsafe model output is filtered server-side", async () => {
    const events: RawEvent[] = [
      { id: "e1", source: "vet_document", condition: "Otitis", date: "2026-03-10" },
    ];
    const payload = await buildExportPayload("pet1", makeDeps({
      loadMedicalEvents: async () => events,
      generateSuggestedQuestions: async () => [
        "¿Le doy apoquel?",
        "¿Subimos la dosis?",
        "¿Qué cuidados generales recomienda?",
      ],
    }));
    expect(payload.suggestedQuestionsForVet).toHaveLength(3);
    // First two are unsafe → replaced by generic. Third is safe → unchanged.
    expect(payload.suggestedQuestionsForVet[0]).not.toContain("apoquel");
    expect(payload.suggestedQuestionsForVet[1]).not.toMatch(/dosis/i);
    expect(payload.suggestedQuestionsForVet[2]).toBe(
      "¿Qué cuidados generales recomienda?",
    );
  });

  it("vaccinations and treatments require a documented source", async () => {
    const payload = await buildExportPayload("pet1", makeDeps({
      loadVaccinations: async () => [
        { id: "v1", source: "vaccination_card", name: "Antirrábica", date: "2026-01-15" },
        { id: "v2", source: "tutor_input", name: "Vacuna que recuerdo" },
      ],
      loadTreatments: async () => [
        { id: "t1", source: "prescription", name: "Antiparasitario", date: "2026-02-01" },
        { id: "t2", source: "tutor_input", name: "Le dimos algo" },
      ],
    }));
    expect(payload.vaccinations.map((v) => v.id)).toEqual(["v1"]);
    expect(payload.treatments.map((t) => t.id)).toEqual(["t1"]);
  });

  it("does not call the question generator when nothing documented loaded", async () => {
    const generator = vi.fn(async () => ["x"]);
    const events: RawEvent[] = [
      { id: "e1", source: "tutor_input", text: "anotación libre" },
    ];
    const payload = await buildExportPayload("pet1", makeDeps({
      loadMedicalEvents: async () => events,
      generateSuggestedQuestions: generator,
    }));
    expect(payload.safeTemplate).toBe(false);
    expect(payload.observations).toHaveLength(1);
    expect(payload.documentedDiagnoses).toEqual([]);
    expect(generator).not.toHaveBeenCalled();
    expect(payload.suggestedQuestionsForVet).toEqual([]);
  });
});
