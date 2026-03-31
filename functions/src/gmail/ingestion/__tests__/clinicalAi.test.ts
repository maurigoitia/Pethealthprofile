// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  classifyClinicalContentWithAi,
  heuristicClinicalClassification,
  heuristicClinicalExtraction,
  heuristicClinicalExtractionWithContext,
} from "../clinicalAi";

describe("clinicalAi heuristics", () => {
  it("descarta facturas veterinarias administrativas como no clínicas", () => {
    const result = heuristicClinicalClassification({
      subject: "Comprobante de Pago",
      fromEmail: "facturaelectronica@veterinariapanda.com.ar",
      bodyText:
        "Estimado GOITIA, MAURICIO. Anexo a este mail encontrará la factura electronica en formato PDF. Total 45000.",
      attachmentMetadata: [],
    });

    expect(result.is_clinical).toBe(false);
    expect(result.confidence).toBeLessThan(20);
  });

  it("descarta comprobantes administrativos de Honorio como no clínicos", () => {
    const result = heuristicClinicalClassification({
      subject: "Comprobantes de Cliente - Número de Cliente: 105152 - VH-AP",
      fromEmail: "\"Veterinaria Honorio S.R.L.\" <info@veterinariahonorio.com.ar>",
      bodyText:
        "Estimado Cliente. Adjunto encontrará los comprobantes de sus consumos. Saludos cordiales. Visite http://www.veterinariahonorio.com.ar",
      attachmentMetadata: [
        {
          filename: "105152-FC-[B]-0001-00833108.pdf",
          mimetype: "application/pdf",
          size_bytes: 13496,
          ocr_success: false,
        },
      ],
    });

    expect(result.is_clinical).toBe(false);
    expect(result.confidence).toBeLessThan(20);
  });

  it("reconstruye más de un turno cuando el mail trae varios actos", () => {
    const result = heuristicClinicalExtraction(
      [
        "Información de Turno Solicitado",
        "21/03/26 09:45 LASALA, LUCAS CARDIOLOGIA PANDA HUIDOBRO 24HS CONSULTA CARDIOLOGICA",
        "21/03/26 10:30 ROBERTI, PAULA ECOGRAFIAS PANDA HUIDOBRO 24HS ECOGRAFIA ABDOMINAL",
        "21/03/26 11:00 RAYOS PANDA HUIDOBRO 24HS PLACA RADIOGRAFICA SIMPLE",
      ].join("\n"),
      "2026-03-13T18:47:58.000Z"
    );

    expect(result.is_clinical_content).toBe(true);
    expect(result.detected_events).toHaveLength(3);
    expect(result.detected_events.map((row) => row.appointment_time)).toEqual(["09:45", "10:30", "11:00"]);
  });

  it("clasifica recordatorios operativos veterinarios como clínicos antes de AI", async () => {
    const result = await classifyClinicalContentWithAi({
      subject: "Recordatorio del Turno",
      fromEmail: "turnos@veterinariapanda.com.ar",
      bodyText: [
        "Fecha: 21/03/26",
        "Hora: 09:45",
        "Especialidad: CARDIOLOGIA",
        "Prestación: CONSULTA CARDIOLOGICA",
        "Profesional: LASALA, LUCAS",
        "Centro de Atención: PANDA HUIDOBRO 24hs",
      ].join("\n"),
      attachmentMetadata: [],
    });

    expect(result.is_clinical).toBe(true);
    expect(result.confidence).toBeGreaterThanOrEqual(88);
  });

  it("descarta mails automáticos de Pessy como no clínicos", async () => {
    const result = await classifyClinicalContentWithAi({
      subject: "Hora de la medicación de thor — Pessy",
      fromEmail: "PESSY <noreply@pessy.app>",
      bodyText: "Thor tiene medicación programada. Abrir Pessy.",
      attachmentMetadata: [],
    });

    expect(result.is_clinical).toBe(false);
    expect(result.confidence).toBeLessThan(10);
  });

  it("usa adjuntos clínicos para rescatar estudios cuando AI no aporta evento", () => {
    const result = heuristicClinicalExtractionWithContext({
      sourceSubject: "Radiografias de Thor",
      sourceSender: "\"noreply@myvete.com\" <noreply@myvete.com>",
      extractedText: "Adjunto radiografias de Thor para control.",
      emailDate: "2024-07-20T17:13:37.000Z",
      attachmentMetadata: [
        {
          filename: "302042.pdf",
          mimetype: "application/pdf",
          size_bytes: 1024,
          ocr_success: false,
        },
        {
          filename: "HistoriaClinica.pdf",
          mimetype: "application/pdf",
          size_bytes: 1024,
          ocr_success: false,
        },
      ],
    });

    expect(result.is_clinical_content).toBe(true);
    expect(result.detected_events).toHaveLength(1);
    expect(result.detected_events[0]?.event_type).toBe("study_report");
    expect(result.reason_if_review_needed).toBe("study_fallback_from_attachment_signal");
  });

  it("rescata un mail attachment-first de eco aunque el body esté vacío", () => {
    const result = heuristicClinicalExtractionWithContext({
      sourceSubject: "ECO THOR",
      sourceSender: "laura diaz <lvdiazz@yahoo.com.ar>",
      extractedText: "",
      emailDate: "2025-08-22T00:13:39.000Z",
      attachmentMetadata: [
        {
          filename: "GOITA THOR.pdf",
          mimetype: "application/pdf",
          size_bytes: 321937,
          ocr_success: false,
        },
      ],
    });

    expect(result.is_clinical_content).toBe(true);
    expect(result.detected_events).toHaveLength(1);
    expect(result.detected_events[0]?.event_type).toBe("study_report");
  });

  it("clasifica estudios de sangre con nombre de mascota como clínicos", async () => {
    const result = await classifyClinicalContentWithAi({
      subject: "Hemograma Thor",
      fromEmail: "resultados@clinicavet.com",
      bodyText: "Adjuntamos hemograma y perfil bioquímico de Thor para control.",
      attachmentMetadata: [
        {
          filename: "thor-hemograma.pdf",
          mimetype: "application/pdf",
          size_bytes: 2048,
          ocr_success: false,
        },
      ],
    });

    expect(result.is_clinical).toBe(true);
    expect(result.confidence).toBeGreaterThanOrEqual(80);
  });
});
