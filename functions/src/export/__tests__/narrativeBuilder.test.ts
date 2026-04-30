import { describe, expect, it } from "vitest";
import {
  buildDataStatusSentence,
  buildCurrentCareSentence,
  buildStudiesSummary,
  buildPendingReviewSummary,
  buildNarrative,
} from "../narrativeBuilder";
import type {
  Diagnosis,
  Study,
  Treatment,
  Appointment,
  PendingReviewItem,
  Professional,
  Institution,
  Observation,
  Vaccination,
} from "../types";

const emptyInput = {
  petName: "Thor" as string | null,
  documentedDiagnoses: [] as Diagnosis[],
  pendingReview: [] as PendingReviewItem[],
  observations: [] as Observation[],
  vaccinations: [] as Vaccination[],
  treatments: [] as Treatment[],
  studies: [] as Study[],
  appointments: [] as Appointment[],
  professionals: [] as Professional[],
  institutions: [] as Institution[],
};

const treatment = (name: string, status: "active" | "historical" = "active"): Treatment => ({
  id: `t-${name}`, name, date: "2026-01-01",
  source: "vet_document" as const, sourceEventIds: [`t-${name}`], status,
});

const study = (type: Study["type"], signedBy: string | null = "Dr. García"): Study => ({
  id: `s-${type}`, type, subtype: null, date: "2026-02-18",
  finding: null, signedBy, institution: null,
  source: "vet_document" as const, sourceEventIds: [`s-${type}`],
});

const appt = (status: Appointment["status"], professional: string | null = "Dr. García"): Appointment => ({
  id: `a-${status}-${professional ?? "x"}`, type: "checkup", date: "2026-03-15",
  status, professional, institution: null, notes: null, sourceEventIds: ["a-1"],
});

describe("narrativeBuilder — data status", () => {
  it("empty pet returns honest empty-state sentence", () => {
    expect(buildDataStatusSentence(emptyInput)).toBe(
      "Aún no hay información clínica cargada en este perfil.",
    );
  });

  it("rich pet enumerates known buckets only", () => {
    const out = buildDataStatusSentence({
      ...emptyInput,
      documentedDiagnoses: [
        { id: "d1", condition: "Otitis", date: "2026-03-10", source: "vet_document", sourceEventIds: ["d1"] },
        { id: "d2", condition: "Dermatitis", date: "2026-03-11", source: "vet_document", sourceEventIds: ["d2"] },
      ],
      studies: [study("imaging_echocardiogram"), study("lab")],
      treatments: [treatment("Pimobendan")],
      vaccinations: [
        { id: "v1", name: "Antirrábica", date: "2026-01-15", source: "vaccination_card", sourceEventIds: ["v1"] },
      ],
    });
    expect(out).toContain("2 diagnósticos documentados");
    expect(out).toContain("2 estudios");
    expect(out).toContain("1 tratamiento");
    expect(out).toContain("1 vacuna");
    // Never asserts disease/diagnosis names — just counts and category nouns.
    expect(out).not.toContain("Otitis");
    expect(out).not.toContain("Dermatitis");
  });

  it("pending review clause is separate and factual", () => {
    const out = buildDataStatusSentence({
      ...emptyInput,
      documentedDiagnoses: [
        { id: "d1", condition: "X", date: "2026-03-10", source: "vet_document", sourceEventIds: ["d1"] },
      ],
      pendingReview: [
        { id: "p1", label: "Y", date: "2026-03-11", source: "ai_extraction", sourceEventIds: ["p1"] },
        { id: "p2", label: "Z", date: "2026-03-12", source: "ai_pending_review", sourceEventIds: ["p2"] },
      ],
    });
    expect(out).toContain("2 registros extraídos");
    expect(out).toContain("pendientes de revisión");
  });
});

describe("narrativeBuilder — current care", () => {
  it("active treatments appear by name when count is small", () => {
    const out = buildCurrentCareSentence({
      ...emptyInput,
      treatments: [treatment("Pimobendan"), treatment("Optamox")],
    });
    expect(out).toContain("Thor");
    expect(out).toContain("Pimobendan");
    expect(out).toContain("Optamox");
    expect(out).toContain("activos registrados");
  });

  it("historical treatments are excluded from current care", () => {
    const out = buildCurrentCareSentence({
      ...emptyInput,
      treatments: [treatment("Pimobendan", "active"), treatment("Old Med", "historical")],
    });
    expect(out).toContain("Pimobendan");
    expect(out).not.toContain("Old Med");
  });

  it("upcoming appointments are mentioned without inventing detail", () => {
    const out = buildCurrentCareSentence({
      ...emptyInput,
      appointments: [appt("upcoming"), appt("upcoming"), appt("completed")],
    });
    expect(out).toContain("2 turnos próximos");
  });

  it("empty input returns honest empty sentence (no diagnostic claim)", () => {
    const out = buildCurrentCareSentence(emptyInput);
    expect(out).toBe("No hay tratamientos activos ni turnos próximos registrados en este perfil.");
    expect(out).not.toContain("sano");
    expect(out).not.toContain("enfermo");
  });
});

describe("narrativeBuilder — studies summary", () => {
  it("groups by type and orders by count desc", () => {
    const out = buildStudiesSummary({
      ...emptyInput,
      studies: [
        study("imaging_echocardiogram"), study("imaging_echocardiogram"),
        study("imaging_echocardiogram"), study("imaging_echocardiogram"),
        study("lab"), study("lab"), study("lab"),
        study("imaging_radiology"), study("imaging_radiology"),
        study("dermatology_microscopy"),
      ],
    });
    expect(out).toMatch(/^10 estudios registrados/);
    expect(out).toContain("4 ecocardiogramas");
    expect(out).toContain("3 análisis de laboratorio");
    expect(out).toContain("2 radiografías");
    expect(out).toContain("1 microscopía dermatológica");
    // Order: echocardiogram (4) before lab (3) before radiology (2) before dermatology (1)
    expect(out.indexOf("4 ecocardiogramas")).toBeLessThan(out.indexOf("3 análisis"));
  });

  it("empty studies → empty string (the renderer decides what to show)", () => {
    expect(buildStudiesSummary(emptyInput)).toBe("");
  });
});

describe("narrativeBuilder — pending review summary", () => {
  it("counts unsigned studies + pending extractions + tutor observations", () => {
    const out = buildPendingReviewSummary({
      ...emptyInput,
      studies: [
        study("lab", "Dr. García"),
        study("imaging_radiology", null),
        study("imaging_radiology", null),
      ],
      pendingReview: [
        { id: "p1", label: "x", date: "2026-03-10", source: "ai_extraction", sourceEventIds: ["p1"] },
      ],
      appointments: [
        appt("upcoming", null),
      ],
      observations: [
        { id: "o1", text: "raspándose mucho", date: "2026-03-12", source: "tutor_input", sourceEventIds: ["o1"] },
      ],
    });
    expect(out).toContain("1 registro extraído");
    expect(out).toContain("2 estudios sin firma");
    expect(out).toContain("1 turno sin profesional asignado");
    expect(out).toContain("1 observación cargada por el tutor");
  });

  it("empty when nothing is pending", () => {
    expect(buildPendingReviewSummary(emptyInput)).toBe("");
  });
});

describe("narrativeBuilder — full pack", () => {
  it("all four blocks produced at once", () => {
    const out = buildNarrative({
      ...emptyInput,
      treatments: [treatment("Pimobendan")],
      studies: [study("imaging_echocardiogram"), study("lab")],
      appointments: [appt("upcoming")],
    });
    expect(out.dataStatus).toContain("información clínica registrada");
    expect(out.currentCare).toContain("Pimobendan");
    expect(out.studiesSummary).toContain("2 estudios registrados");
    // Pending summary may be empty here since nothing flagged.
  });

  it("safety: no medication name is invented when treatments is empty", () => {
    const out = buildNarrative(emptyInput);
    expect(out.currentCare).not.toMatch(/[A-Z][a-z]+amox|[A-Z][a-z]+pril|Pimobendan/);
    expect(out.dataStatus).not.toMatch(/[A-Z][a-z]+amox|[A-Z][a-z]+pril|Pimobendan/);
  });

  it("safety: no diagnostic claim is produced when documentedDiagnoses is empty", () => {
    const out = buildNarrative({
      ...emptyInput,
      observations: [
        { id: "o1", text: "creo que tiene alergia", date: "2026-03-12", source: "tutor_input", sourceEventIds: ["o1"] },
      ],
    });
    // The tutor's note text must NOT leak into any narrative block.
    expect(out.dataStatus).not.toContain("alergia");
    expect(out.currentCare).not.toContain("alergia");
    expect(out.studiesSummary).not.toContain("alergia");
    expect(out.pendingReviewSummary).not.toContain("alergia");
  });
});
