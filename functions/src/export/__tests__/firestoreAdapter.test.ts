import { describe, expect, it } from "vitest";
import {
  bucketForProvenance,
  deriveProvenanceSource,
  mapMedicalEvent,
  mapTreatment,
} from "../firestoreAdapter";

describe("firestoreAdapter — provenance derivation", () => {
  it("vet-created events derive vet_input", () => {
    expect(deriveProvenanceSource({ createdBy: "vet" })).toBe("vet_input");
    expect(deriveProvenanceSource({ source: "vet_input" })).toBe("vet_input");
  });

  it("tutor-confirmed events derive tutor_confirmed", () => {
    expect(deriveProvenanceSource({ tutorConfirmed: true })).toBe("tutor_confirmed");
    expect(deriveProvenanceSource({ userConfirmed: true })).toBe("tutor_confirmed");
  });

  it("review-required events derive ai_pending_review", () => {
    expect(deriveProvenanceSource({ requiresManualConfirmation: true })).toBe("ai_pending_review");
    expect(deriveProvenanceSource({ workflowStatus: "review_required" })).toBe("ai_pending_review");
  });

  it("manual-source or no-masterPayload events derive tutor_input", () => {
    expect(deriveProvenanceSource({ source: "manual" })).toBe("tutor_input");
    expect(deriveProvenanceSource({})).toBe("tutor_input");
  });

  it("AI-extracted events with masterPayload derive ai_extraction", () => {
    expect(
      deriveProvenanceSource({ extractedData: { masterPayload: { foo: 1 } } }),
    ).toBe("ai_extraction");
  });
});

describe("firestoreAdapter — bucketing", () => {
  it("vet_input and tutor_confirmed are bucketed as documented", () => {
    expect(bucketForProvenance("vet_input")).toBe("vet_document");
    expect(bucketForProvenance("tutor_confirmed")).toBe("vet_document");
  });

  it("everything else (incl. ai_extraction) is bucketed as tutor_input", () => {
    expect(bucketForProvenance("ai_extraction")).toBe("tutor_input");
    expect(bucketForProvenance("ai_pending_review")).toBe("tutor_input");
    expect(bucketForProvenance("tutor_input")).toBe("tutor_input");
    expect(bucketForProvenance("unknown_label")).toBe("tutor_input");
  });
});

describe("firestoreAdapter — mapMedicalEvent", () => {
  it("vet-created event becomes documented with diagnosis as condition", () => {
    const out = mapMedicalEvent("e1", {
      petId: "p1",
      createdBy: "vet",
      createdAt: "2026-03-10T00:00:00Z",
      extractedData: {
        eventDate: "2026-03-10",
        masterPayload: {
          document_info: { diagnoses: "Otitis externa" },
        },
      },
    });
    expect(out.id).toBe("e1");
    expect(out.source).toBe("vet_document");
    expect(out.condition).toBe("Otitis externa");
    expect(out.date).toBe("2026-03-10");
  });

  it("tutor_input event keeps tutor_input bucket and notes go to text", () => {
    const out = mapMedicalEvent("e2", {
      petId: "p1",
      source: "manual",
      createdAt: "2026-03-12T00:00:00Z",
      notes: "creo que está raspándose mucho",
    });
    expect(out.source).toBe("tutor_input");
    expect(out.text).toBe("creo que está raspándose mucho");
  });

  it("AI-extracted unverified event lands in tutor_input bucket", () => {
    const out = mapMedicalEvent("e3", {
      petId: "p1",
      extractedData: {
        masterPayload: { document_info: { diagnoses: "Sospecha de algo" } },
      },
    });
    expect(out.source).toBe("tutor_input");
  });
});

describe("firestoreAdapter — mapTreatment", () => {
  it("documented vet treatment carries name and start date", () => {
    const out = mapTreatment("t1", {
      petId: "p1",
      createdBy: "vet",
      name: "Antiparasitario",
      startDate: "2026-02-01",
    });
    expect(out.source).toBe("vet_document");
    expect(out.name).toBe("Antiparasitario");
    expect(out.date).toBe("2026-02-01");
  });

  it("manual treatment lands in tutor_input bucket", () => {
    const out = mapTreatment("t2", {
      petId: "p1",
      source: "manual",
      name: "Algo que le di",
    });
    expect(out.source).toBe("tutor_input");
  });
});
