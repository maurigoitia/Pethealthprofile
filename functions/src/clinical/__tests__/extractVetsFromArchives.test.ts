/**
 * Tests para los helpers puros de extractVetsFromArchives.
 * No tocan firestore — solo lógica de normalización y agregación.
 */
import { describe, expect, it } from "vitest";
import {
  aggregateVets,
  appointmentToSourceRow,
  extractEmail,
  extractPhone,
  medicalEventToSourceRow,
  normalizeVetName,
  treatmentToSourceRow,
  vetDocId,
} from "../extractVetsFromArchives";

describe("normalizeVetName", () => {
  it("strips Dr./Dra. prefixes", () => {
    expect(normalizeVetName("Dra. María López")).toBe("maria lopez");
    expect(normalizeVetName("DR. JOSE PEREZ")).toBe("jose perez");
    expect(normalizeVetName("Dr Juan Gómez")).toBe("juan gómez".normalize("NFD").replace(/[̀-ͯ]/g, ""));
  });

  it("collapses whitespace and trims", () => {
    expect(normalizeVetName("  Dr.  Juan   Gomez  ")).toBe("juan gomez");
  });

  it("strips accents (NFD + combining marks)", () => {
    expect(normalizeVetName("Pérez")).toBe("perez");
    expect(normalizeVetName("Núñez")).toBe("nunez");
  });
});

describe("vetDocId", () => {
  it("is stable for the same input", () => {
    expect(vetDocId("jose perez")).toBe(vetDocId("jose perez"));
  });

  it("returns 24-char hex string", () => {
    const id = vetDocId("any name");
    expect(id).toMatch(/^[a-f0-9]{24}$/);
  });

  it("differs for different inputs", () => {
    expect(vetDocId("a")).not.toBe(vetDocId("b"));
  });
});

describe("extractEmail", () => {
  it("captures basic email", () => {
    expect(extractEmail("contacto: vet@clinic.com")).toBe("vet@clinic.com");
  });

  it("lowercases the result", () => {
    expect(extractEmail("Mail: VET@Clinic.COM")).toBe("vet@clinic.com");
  });

  it("returns null when no email present", () => {
    expect(extractEmail("just plain text")).toBeNull();
    expect(extractEmail(null)).toBeNull();
    expect(extractEmail(undefined)).toBeNull();
  });
});

describe("extractPhone", () => {
  it("captures AR mobile with country code", () => {
    expect(extractPhone("+54 9 11 1234-5678")).toBe("+54 9 11 1234-5678");
  });

  it("captures landline with area code", () => {
    expect(extractPhone("011 4567 8900")).toBe("011 4567 8900");
  });

  it("rejects matricula numbers (too short)", () => {
    expect(extractPhone("Mat. M.P. 4587")).toBeNull();
    expect(extractPhone("123")).toBeNull();
  });

  it("returns null on null/undefined", () => {
    expect(extractPhone(null)).toBeNull();
    expect(extractPhone(undefined)).toBeNull();
  });
});

describe("aggregateVets", () => {
  it("dedupes by normalized name across casing/accent variations", () => {
    const out = aggregateVets([
      { eventId: "e1", dateIso: "2025-01-15T10:00:00Z", bucket: "vet_document", vetName: "Dra. María López", vetLicense: "MP 1234", clinic: "VetCenter", rawText: "" },
      { eventId: "e2", dateIso: "2025-03-20T10:00:00Z", bucket: "ai_extraction", vetName: "Dr. María Lopez", vetLicense: null, clinic: "VetCenter Norte", rawText: "" },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].eventCount).toBe(2);
    expect(out[0].sourceEventIds).toEqual(expect.arrayContaining(["e1", "e2"]));
    // last-seen wins for clinic
    expect(out[0].clinic).toBe("VetCenter Norte");
    // license preserved from first event
    expect(out[0].license).toBe("MP 1234");
    // first/last seen
    expect(out[0].firstSeenAtIso).toBe("2025-01-15T10:00:00Z");
    expect(out[0].lastSeenAtIso).toBe("2025-03-20T10:00:00Z");
  });

  it("excludes tutor_input bucket events", () => {
    const out = aggregateVets([
      { eventId: "e1", dateIso: "2025-01-01", bucket: "tutor_input", vetName: "Dr. Pérez", vetLicense: null, clinic: null, rawText: "" },
    ]);
    expect(out).toHaveLength(0);
  });

  it("captures phone/email from rawText (best-effort)", () => {
    const out = aggregateVets([
      { eventId: "e1", dateIso: "2025-01-01", bucket: "vet_document", vetName: "Dr. X", vetLicense: null, clinic: null, rawText: "tel 011-4567-8900 mail: dr.x@vet.com" },
    ]);
    expect(out[0].phone).toBe("011-4567-8900");
    expect(out[0].email).toBe("dr.x@vet.com");
  });

  it("computes confidence: high when license + 2+ events", () => {
    const out = aggregateVets([
      { eventId: "e1", dateIso: "2025-01-01", bucket: "vet_document", vetName: "Dr. A", vetLicense: "MP 1", clinic: null, rawText: "" },
      { eventId: "e2", dateIso: "2025-02-01", bucket: "vet_document", vetName: "Dr. A", vetLicense: "MP 1", clinic: null, rawText: "" },
    ]);
    expect(out[0].confidence).toBe("high");
  });

  it("computes confidence: medium when license OR 2+ events", () => {
    const onlyLicense = aggregateVets([
      { eventId: "e1", dateIso: "2025-01-01", bucket: "vet_document", vetName: "Dr. A", vetLicense: "MP 1", clinic: null, rawText: "" },
    ]);
    expect(onlyLicense[0].confidence).toBe("medium");

    const only2events = aggregateVets([
      { eventId: "e1", dateIso: "2025-01-01", bucket: "ai_extraction", vetName: "Dr. B", vetLicense: null, clinic: null, rawText: "" },
      { eventId: "e2", dateIso: "2025-02-01", bucket: "ai_extraction", vetName: "Dr. B", vetLicense: null, clinic: null, rawText: "" },
    ]);
    expect(only2events[0].confidence).toBe("medium");
  });

  it("computes confidence: low when single event without license", () => {
    const out = aggregateVets([
      { eventId: "e1", dateIso: "2025-01-01", bucket: "ai_extraction", vetName: "Dr. C", vetLicense: null, clinic: null, rawText: "" },
    ]);
    expect(out[0].confidence).toBe("low");
  });
});

describe("medicalEventToSourceRow", () => {
  it("extracts vet from masterPayload.document_info path", () => {
    const row = medicalEventToSourceRow("ev1", {
      petId: "p1",
      createdBy: "tutor",
      tutorConfirmed: true,
      extractedData: {
        masterPayload: {
          document_info: {
            veterinarian_name: "Dra. Ana Ruiz",
            veterinarian_license: "MP 7777",
            clinic_name: "Clínica Norte",
          },
        },
      },
    });
    expect(row).not.toBeNull();
    expect(row!.vetName).toBe("Dra. Ana Ruiz");
    expect(row!.vetLicense).toBe("MP 7777");
    expect(row!.clinic).toBe("Clínica Norte");
    expect(row!.bucket).toBe("vet_document"); // tutorConfirmed → vet_document
  });

  it("falls back to flat extractedData paths", () => {
    const row = medicalEventToSourceRow("ev2", {
      petId: "p1",
      extractedData: {
        masterPayload: { foo: 1 }, // ai_extraction
        veterinarian_name: "Dr. Pedro",
      },
    });
    expect(row).not.toBeNull();
    expect(row!.vetName).toBe("Dr. Pedro");
    expect(row!.bucket).toBe("ai_extraction");
  });

  it("returns null when no vet info present", () => {
    const row = medicalEventToSourceRow("ev3", { petId: "p1" });
    expect(row).toBeNull();
  });
});

describe("treatmentToSourceRow", () => {
  it("captures veterinarian field", () => {
    const row = treatmentToSourceRow("t1", {
      petId: "p1",
      veterinarian: "Dr. Pablo",
      startDate: "2025-04-01",
    });
    expect(row).not.toBeNull();
    expect(row!.vetName).toBe("Dr. Pablo");
    expect(row!.dateIso).toBe("2025-04-01");
  });

  it("returns null without vet", () => {
    expect(treatmentToSourceRow("t2", { petId: "p1" })).toBeNull();
  });
});

describe("appointmentToSourceRow", () => {
  it("captures veterinarian field with vet_document bucket if vet-created", () => {
    const row = appointmentToSourceRow("a1", {
      petId: "p1",
      veterinarian: "Dra. Eugenia",
      clinic: "VetUrgencias",
      date: "2025-05-10",
      createdBy: "vet",
    });
    expect(row).not.toBeNull();
    expect(row!.vetName).toBe("Dra. Eugenia");
    expect(row!.bucket).toBe("vet_document");
    expect(row!.clinic).toBe("VetUrgencias");
  });

  it("defaults to ai_extraction bucket for tutor-entered appointments", () => {
    const row = appointmentToSourceRow("a2", {
      petId: "p1",
      veterinarian: "Dra. Eugenia",
      date: "2025-05-10",
    });
    expect(row!.bucket).toBe("ai_extraction");
  });
});
