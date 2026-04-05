// @vitest-environment node
import { describe, expect, it } from "vitest";

import { AttachmentMetadata } from "../types";
import {
  extractAppointmentDateFromText,
  extractAppointmentTimeFromText,
  extractProfessionalNameFromText,
} from "../clinicalNormalization";
import {
  buildFallbackClinicalExtraction,
  buildFallbackClinicalExtractions,
  resolveClinicalDocumentProcessingStatus,
  shouldPersistCanonicalReviewDraft,
} from "../clinicalFallbacks";

const EMPTY_ATTACHMENTS: AttachmentMetadata[] = [];

describe("clinical fallback extraction", () => {
  it("parsea fecha y hora operativa en castellano", () => {
    expect(extractAppointmentDateFromText("Tu turno es el 31/03/2026 a las 15 hs", "2026-03-29T10:00:00.000Z"))
      .toBe("2026-03-31");
    expect(extractAppointmentDateFromText("Turno confirmado para el 2 de abril", "2026-03-29T10:00:00.000Z"))
      .toBe("2026-04-02");
    expect(extractAppointmentTimeFromText("Te esperamos a las 15 hs")).toBe("15:00");
  });

  it("extrae profesional desde plantillas centro/profesional", () => {
    expect(extractProfessionalNameFromText("Centro/profesional: Dra. Maria Lopez · PANDA")).toBe("Dra. Maria Lopez");
  });

  it("convierte un recordatorio de Panda en appointment operativo usable", () => {
    const fallback = buildFallbackClinicalExtraction({
      sourceSubject: "Recordatorio del Turno",
      sourceSender: "turnos@veterinariapanda.com.ar",
      extractedText:
        "Centro/profesional: Dra. Maria Lopez · PANDA Clinica Veterinaria. Te esperamos el 31/03/2026 a las 15 hs para cardiologia.",
      emailDate: "2026-03-29T10:00:00.000Z",
      attachmentMetadata: EMPTY_ATTACHMENTS,
      confidenceOverall: 62,
    });

    expect(fallback?.event?.event_type).toBe("appointment_reminder");
    expect(fallback?.event?.event_date).toBe("2026-03-31");
    expect(fallback?.event?.appointment_time).toBe("15:00");
    expect(fallback?.event?.clinic_name).toBe("PANDA Clinica Veterinaria");
    expect(fallback?.event?.professional_name).toBe("Dra. Maria Lopez");
    expect(fallback?.requiresHumanReview).toBe(false);
  });

  it("convierte mails logísticos con evidencia de eco/rx en study_report revisable", () => {
    const fallback = buildFallbackClinicalExtraction({
      sourceSubject: "Estudio adjunto de Thor",
      sourceSender: "estudios@igv.com.ar",
      extractedText: "Adjuntamos informe de ecografia abdominal de Thor con hallazgos para control.",
      emailDate: "2026-03-29T10:00:00.000Z",
      attachmentMetadata: [
        {
          filename: "thor_ecografia_abdominal.pdf",
          mimetype: "application/pdf",
          size_bytes: 1024,
          ocr_success: true,
        },
      ],
      confidenceOverall: 61,
    });

    expect(fallback?.event?.event_type).toBe("study_report");
    expect(fallback?.event?.study_subtype).toBe("imaging");
    expect(fallback?.event?.imaging_type).toBe("ecografía");
    expect(fallback?.requiresHumanReview).toBe(true);
  });

  it("extrae múltiples actos veterinarios desde un mismo mail operativo", () => {
    const fallbacks = buildFallbackClinicalExtractions({
      sourceSubject: "Información de Turno Solicitado",
      sourceSender: "turnos@veterinariapanda.com.ar",
      extractedText: [
        "Le recordamos sus próximos turnos",
        "21/03/26 09:45 LASALA, LUCAS CARDIOLOGIA PANDA HUIDOBRO 24HS CONSULTA CARDIOLOGICA",
        "21/03/26 10:30 ROBERTI, PAULA ECOGRAFIAS PANDA HUIDOBRO 24HS ECOGRAFIA ABDOMINAL",
        "21/03/26 11:00 RAYOS PANDA HUIDOBRO 24HS PLACA RADIOGRAFICA SIMPLE",
      ].join("\n"),
      emailDate: "2026-03-13T18:47:58.000Z",
      attachmentMetadata: EMPTY_ATTACHMENTS,
      confidenceOverall: 71,
    });

    expect(fallbacks).toHaveLength(3);
    expect(fallbacks.map((row) => row.event?.appointment_time)).toEqual(["09:45", "10:30", "11:00"]);
    expect(fallbacks.every((row) => row.event?.event_type === "appointment_confirmation")).toBe(true);
    expect(fallbacks[0]?.event?.professional_name).toBe("LASALA, LUCAS");
    expect(fallbacks[1]?.event?.appointment_specialty).toContain("ECOGRAFIA ABDOMINAL");
    expect(fallbacks[2]?.event?.appointment_specialty).toContain("PLACA RADIOGRAFICA SIMPLE");
  });

  it("no intenta convertir facturas veterinarias en hecho clínico", () => {
    const fallbacks = buildFallbackClinicalExtractions({
      sourceSubject: "Comprobante de Pago",
      sourceSender: "facturaelectronica@veterinariapanda.com.ar",
      extractedText:
        "Estimado GOITIA, MAURICIO. Anexo a este mail encontrará la factura electronica en formato PDF. Total: 45000. IVA incluido.",
      emailDate: "2026-03-21T21:31:58.000Z",
      attachmentMetadata: [
        {
          filename: "factura.pdf",
          mimetype: "application/pdf",
          size_bytes: 1024,
          ocr_success: true,
        },
      ],
      confidenceOverall: 64,
    });

    expect(fallbacks).toEqual([]);
  });

  it("mantiene estudios reenviados como study_report attachment-first", () => {
    const fallback = buildFallbackClinicalExtraction({
      sourceSubject: "Fwd: Radiografias de Thor",
      sourceSender: "mauriciogoitia@gmail.com",
      extractedText: "Aca te paso de nuevo. Radiografias de Thor.",
      emailDate: "2024-07-20T17:13:37.000Z",
      attachmentMetadata: [
        {
          filename: "302042.pdf",
          mimetype: "application/pdf",
          size_bytes: 1024,
          ocr_success: true,
        },
        {
          filename: "HistoriaClinica.pdf",
          mimetype: "application/pdf",
          size_bytes: 1024,
          ocr_success: true,
        },
      ],
      confidenceOverall: 67,
    });

    expect(fallback?.event?.event_type).toBe("study_report");
    expect(fallback?.event?.study_subtype).toBe("imaging");
    expect(fallback?.requiresHumanReview).toBe(true);
  });

  it("descarta recordatorios operativos sin estructura suficiente en vez de marcarlos ingested", () => {
    const status = resolveClinicalDocumentProcessingStatus({
      createdForMessage: 0,
      reviewsForMessage: 0,
      isClinicalContent: true,
      reasonIfReviewNeeded: "empty_events_from_ai",
      sourceSubject: "Recordatorio del Turno",
      sourceSender: "turnos@veterinariapanda.com.ar",
      extractedText: "Hacé click en el enlace para revisar tu turno.",
      emailDate: "2026-03-29T10:00:00.000Z",
      attachmentMetadata: EMPTY_ATTACHMENTS,
    });

    expect(status).toBe("discarded_operational_no_structured_event");
  });

  it("crea draft canónico para turnos estructurados aunque requieran review", () => {
    const shouldPersist = shouldPersistCanonicalReviewDraft({
      event: {
        event_type: "appointment_reminder",
        event_date: "2026-03-31",
        date_confidence: 80,
        description_summary: "Recordatorio de turno con fecha y hora detectadas",
        diagnosis: null,
        medications: [],
        lab_results: [],
        imaging_type: null,
        study_subtype: null,
        appointment_time: "15:00",
        appointment_specialty: "Cardiologia",
        professional_name: null,
        clinic_name: null,
        appointment_status: "reminder",
        severity: null,
        confidence_score: 63,
      },
      sourceSubject: "Recordatorio del Turno",
      sourceSender: "turnos@veterinaria.com",
      extractedText: "Te esperamos el 31/03/2026 a las 15 hs para cardiologia.",
      reviewReason: "incomplete_appointment_details",
      attachmentMetadata: EMPTY_ATTACHMENTS,
    });

    expect(shouldPersist).toBe(true);
  });

  it("crea draft canónico para estudios con señal clínica en adjuntos", () => {
    const shouldPersist = shouldPersistCanonicalReviewDraft({
      event: {
        event_type: "study_report",
        event_date: "2024-07-20",
        date_confidence: 70,
        description_summary: "Radiografias de Thor adjuntas",
        diagnosis: null,
        medications: [],
        lab_results: [],
        imaging_type: "radiografía",
        study_subtype: "imaging",
        appointment_time: null,
        appointment_specialty: null,
        professional_name: null,
        clinic_name: null,
        appointment_status: null,
        severity: null,
        confidence_score: 61,
      },
      sourceSubject: "Radiografias de Thor",
      sourceSender: "imagenes@veterinaria.com",
      extractedText: "Se adjunta estudio para control.",
      reviewReason: "study_fallback_from_attachment_signal",
      attachmentMetadata: [
        {
          filename: "Radiografias_Thor.pdf",
          mimetype: "application/pdf",
          size_bytes: 2048,
          ocr_success: true,
        },
      ],
    });

    expect(shouldPersist).toBe(true);
  });

  it("no crea draft canónico para ruido ambiguo sin estructura clínica suficiente", () => {
    const shouldPersist = shouldPersistCanonicalReviewDraft({
      event: {
        event_type: "clinical_report",
        event_date: "2026-03-29",
        date_confidence: 40,
        description_summary: "Demora",
        diagnosis: null,
        medications: [],
        lab_results: [],
        imaging_type: null,
        study_subtype: null,
        appointment_time: null,
        appointment_specialty: null,
        professional_name: null,
        clinic_name: null,
        appointment_status: null,
        severity: null,
        confidence_score: 42,
      },
      sourceSubject: "Demora",
      sourceSender: "hola@example.com",
      extractedText: "Te escribo para avisar que llego tarde.",
      reviewReason: "heuristic_fallback",
      attachmentMetadata: EMPTY_ATTACHMENTS,
    });

    expect(shouldPersist).toBe(false);
  });

  it("mantiene recordatorios historicos de vacuna solo en review", () => {
    const shouldPersist = shouldPersistCanonicalReviewDraft({
      event: {
        event_type: "vaccination_record",
        event_date: "2026-03-29",
        date_confidence: 62,
        description_summary: "Recordatorio de vacuna pendiente para Thor",
        diagnosis: null,
        medications: [],
        lab_results: [],
        imaging_type: null,
        study_subtype: null,
        appointment_time: null,
        appointment_specialty: null,
        professional_name: null,
        clinic_name: null,
        appointment_status: null,
        severity: null,
        confidence_score: 61,
      },
      sourceSubject: "Recordatorio de Vacuna para Thor",
      sourceSender: "recordatorios@vetclinic.com",
      extractedText: "Thor tiene refuerzo de vacuna pendiente este mes.",
      reviewReason: "historical_info_only",
      attachmentMetadata: EMPTY_ATTACHMENTS,
    });

    expect(shouldPersist).toBe(false);
  });
});
