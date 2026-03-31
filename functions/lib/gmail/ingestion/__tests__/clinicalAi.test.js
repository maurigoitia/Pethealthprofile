"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// @vitest-environment node
const vitest_1 = require("vitest");
const clinicalAi_1 = require("../clinicalAi");
(0, vitest_1.describe)("clinicalAi heuristics", () => {
    (0, vitest_1.it)("descarta facturas veterinarias administrativas como no clínicas", () => {
        const result = (0, clinicalAi_1.heuristicClinicalClassification)({
            subject: "Comprobante de Pago",
            fromEmail: "facturaelectronica@veterinariapanda.com.ar",
            bodyText: "Estimado GOITIA, MAURICIO. Anexo a este mail encontrará la factura electronica en formato PDF. Total 45000.",
            attachmentMetadata: [],
        });
        (0, vitest_1.expect)(result.is_clinical).toBe(false);
        (0, vitest_1.expect)(result.confidence).toBeLessThan(20);
    });
    (0, vitest_1.it)("descarta comprobantes administrativos de Honorio como no clínicos", () => {
        const result = (0, clinicalAi_1.heuristicClinicalClassification)({
            subject: "Comprobantes de Cliente - Número de Cliente: 105152 - VH-AP",
            fromEmail: "\"Veterinaria Honorio S.R.L.\" <info@veterinariahonorio.com.ar>",
            bodyText: "Estimado Cliente. Adjunto encontrará los comprobantes de sus consumos. Saludos cordiales. Visite http://www.veterinariahonorio.com.ar",
            attachmentMetadata: [
                {
                    filename: "105152-FC-[B]-0001-00833108.pdf",
                    mimetype: "application/pdf",
                    size_bytes: 13496,
                    ocr_success: false,
                },
            ],
        });
        (0, vitest_1.expect)(result.is_clinical).toBe(false);
        (0, vitest_1.expect)(result.confidence).toBeLessThan(20);
    });
    (0, vitest_1.it)("reconstruye más de un turno cuando el mail trae varios actos", () => {
        const result = (0, clinicalAi_1.heuristicClinicalExtraction)([
            "Información de Turno Solicitado",
            "21/03/26 09:45 LASALA, LUCAS CARDIOLOGIA PANDA HUIDOBRO 24HS CONSULTA CARDIOLOGICA",
            "21/03/26 10:30 ROBERTI, PAULA ECOGRAFIAS PANDA HUIDOBRO 24HS ECOGRAFIA ABDOMINAL",
            "21/03/26 11:00 RAYOS PANDA HUIDOBRO 24HS PLACA RADIOGRAFICA SIMPLE",
        ].join("\n"), "2026-03-13T18:47:58.000Z");
        (0, vitest_1.expect)(result.is_clinical_content).toBe(true);
        (0, vitest_1.expect)(result.detected_events).toHaveLength(3);
        (0, vitest_1.expect)(result.detected_events.map((row) => row.appointment_time)).toEqual(["09:45", "10:30", "11:00"]);
    });
    (0, vitest_1.it)("clasifica recordatorios operativos veterinarios como clínicos antes de AI", async () => {
        const result = await (0, clinicalAi_1.classifyClinicalContentWithAi)({
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
        (0, vitest_1.expect)(result.is_clinical).toBe(true);
        (0, vitest_1.expect)(result.confidence).toBeGreaterThanOrEqual(88);
    });
    (0, vitest_1.it)("descarta mails automáticos de Pessy como no clínicos", async () => {
        const result = await (0, clinicalAi_1.classifyClinicalContentWithAi)({
            subject: "Hora de la medicación de thor — Pessy",
            fromEmail: "PESSY <noreply@pessy.app>",
            bodyText: "Thor tiene medicación programada. Abrir Pessy.",
            attachmentMetadata: [],
        });
        (0, vitest_1.expect)(result.is_clinical).toBe(false);
        (0, vitest_1.expect)(result.confidence).toBeLessThan(10);
    });
    (0, vitest_1.it)("usa adjuntos clínicos para rescatar estudios cuando AI no aporta evento", () => {
        var _a;
        const result = (0, clinicalAi_1.heuristicClinicalExtractionWithContext)({
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
        (0, vitest_1.expect)(result.is_clinical_content).toBe(true);
        (0, vitest_1.expect)(result.detected_events).toHaveLength(1);
        (0, vitest_1.expect)((_a = result.detected_events[0]) === null || _a === void 0 ? void 0 : _a.event_type).toBe("study_report");
        (0, vitest_1.expect)(result.reason_if_review_needed).toBe("study_fallback_from_attachment_signal");
    });
    (0, vitest_1.it)("rescata un mail attachment-first de eco aunque el body esté vacío", () => {
        var _a;
        const result = (0, clinicalAi_1.heuristicClinicalExtractionWithContext)({
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
        (0, vitest_1.expect)(result.is_clinical_content).toBe(true);
        (0, vitest_1.expect)(result.detected_events).toHaveLength(1);
        (0, vitest_1.expect)((_a = result.detected_events[0]) === null || _a === void 0 ? void 0 : _a.event_type).toBe("study_report");
    });
    (0, vitest_1.it)("clasifica estudios de sangre con nombre de mascota como clínicos", async () => {
        const result = await (0, clinicalAi_1.classifyClinicalContentWithAi)({
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
        (0, vitest_1.expect)(result.is_clinical).toBe(true);
        (0, vitest_1.expect)(result.confidence).toBeGreaterThanOrEqual(80);
    });
});
//# sourceMappingURL=clinicalAi.test.js.map