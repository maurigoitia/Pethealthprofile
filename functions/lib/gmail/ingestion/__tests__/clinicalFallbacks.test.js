"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// @vitest-environment node
const vitest_1 = require("vitest");
const clinicalNormalization_1 = require("../clinicalNormalization");
const clinicalFallbacks_1 = require("../clinicalFallbacks");
const EMPTY_ATTACHMENTS = [];
(0, vitest_1.describe)("clinical fallback extraction", () => {
    (0, vitest_1.it)("parsea fecha y hora operativa en castellano", () => {
        (0, vitest_1.expect)((0, clinicalNormalization_1.extractAppointmentDateFromText)("Tu turno es el 31/03/2026 a las 15 hs", "2026-03-29T10:00:00.000Z"))
            .toBe("2026-03-31");
        (0, vitest_1.expect)((0, clinicalNormalization_1.extractAppointmentDateFromText)("Turno confirmado para el 2 de abril", "2026-03-29T10:00:00.000Z"))
            .toBe("2026-04-02");
        (0, vitest_1.expect)((0, clinicalNormalization_1.extractAppointmentTimeFromText)("Te esperamos a las 15 hs")).toBe("15:00");
    });
    (0, vitest_1.it)("extrae profesional desde plantillas centro/profesional", () => {
        (0, vitest_1.expect)((0, clinicalNormalization_1.extractProfessionalNameFromText)("Centro/profesional: Dra. Maria Lopez · PANDA")).toBe("Dra. Maria Lopez");
    });
    (0, vitest_1.it)("convierte un recordatorio de Panda en appointment operativo usable", () => {
        var _a, _b, _c, _d, _e;
        const fallback = (0, clinicalFallbacks_1.buildFallbackClinicalExtraction)({
            sourceSubject: "Recordatorio del Turno",
            sourceSender: "turnos@veterinariapanda.com.ar",
            extractedText: "Centro/profesional: Dra. Maria Lopez · PANDA Clinica Veterinaria. Te esperamos el 31/03/2026 a las 15 hs para cardiologia.",
            emailDate: "2026-03-29T10:00:00.000Z",
            attachmentMetadata: EMPTY_ATTACHMENTS,
            confidenceOverall: 62,
        });
        (0, vitest_1.expect)((_a = fallback === null || fallback === void 0 ? void 0 : fallback.event) === null || _a === void 0 ? void 0 : _a.event_type).toBe("appointment_reminder");
        (0, vitest_1.expect)((_b = fallback === null || fallback === void 0 ? void 0 : fallback.event) === null || _b === void 0 ? void 0 : _b.event_date).toBe("2026-03-31");
        (0, vitest_1.expect)((_c = fallback === null || fallback === void 0 ? void 0 : fallback.event) === null || _c === void 0 ? void 0 : _c.appointment_time).toBe("15:00");
        (0, vitest_1.expect)((_d = fallback === null || fallback === void 0 ? void 0 : fallback.event) === null || _d === void 0 ? void 0 : _d.clinic_name).toBe("PANDA Clinica Veterinaria");
        (0, vitest_1.expect)((_e = fallback === null || fallback === void 0 ? void 0 : fallback.event) === null || _e === void 0 ? void 0 : _e.professional_name).toBe("Dra. Maria Lopez");
        (0, vitest_1.expect)(fallback === null || fallback === void 0 ? void 0 : fallback.requiresHumanReview).toBe(false);
    });
    (0, vitest_1.it)("convierte mails logísticos con evidencia de eco/rx en study_report revisable", () => {
        var _a, _b, _c;
        const fallback = (0, clinicalFallbacks_1.buildFallbackClinicalExtraction)({
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
        (0, vitest_1.expect)((_a = fallback === null || fallback === void 0 ? void 0 : fallback.event) === null || _a === void 0 ? void 0 : _a.event_type).toBe("study_report");
        (0, vitest_1.expect)((_b = fallback === null || fallback === void 0 ? void 0 : fallback.event) === null || _b === void 0 ? void 0 : _b.study_subtype).toBe("imaging");
        (0, vitest_1.expect)((_c = fallback === null || fallback === void 0 ? void 0 : fallback.event) === null || _c === void 0 ? void 0 : _c.imaging_type).toBe("ecografía");
        (0, vitest_1.expect)(fallback === null || fallback === void 0 ? void 0 : fallback.requiresHumanReview).toBe(true);
    });
    (0, vitest_1.it)("extrae múltiples actos veterinarios desde un mismo mail operativo", () => {
        var _a, _b, _c, _d, _e, _f;
        const fallbacks = (0, clinicalFallbacks_1.buildFallbackClinicalExtractions)({
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
        (0, vitest_1.expect)(fallbacks).toHaveLength(3);
        (0, vitest_1.expect)(fallbacks.map((row) => { var _a; return (_a = row.event) === null || _a === void 0 ? void 0 : _a.appointment_time; })).toEqual(["09:45", "10:30", "11:00"]);
        (0, vitest_1.expect)(fallbacks.every((row) => { var _a; return ((_a = row.event) === null || _a === void 0 ? void 0 : _a.event_type) === "appointment_confirmation"; })).toBe(true);
        (0, vitest_1.expect)((_b = (_a = fallbacks[0]) === null || _a === void 0 ? void 0 : _a.event) === null || _b === void 0 ? void 0 : _b.professional_name).toBe("LASALA, LUCAS");
        (0, vitest_1.expect)((_d = (_c = fallbacks[1]) === null || _c === void 0 ? void 0 : _c.event) === null || _d === void 0 ? void 0 : _d.appointment_specialty).toContain("ECOGRAFIA ABDOMINAL");
        (0, vitest_1.expect)((_f = (_e = fallbacks[2]) === null || _e === void 0 ? void 0 : _e.event) === null || _f === void 0 ? void 0 : _f.appointment_specialty).toContain("PLACA RADIOGRAFICA SIMPLE");
    });
    (0, vitest_1.it)("no intenta convertir facturas veterinarias en hecho clínico", () => {
        const fallbacks = (0, clinicalFallbacks_1.buildFallbackClinicalExtractions)({
            sourceSubject: "Comprobante de Pago",
            sourceSender: "facturaelectronica@veterinariapanda.com.ar",
            extractedText: "Estimado GOITIA, MAURICIO. Anexo a este mail encontrará la factura electronica en formato PDF. Total: 45000. IVA incluido.",
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
        (0, vitest_1.expect)(fallbacks).toEqual([]);
    });
    (0, vitest_1.it)("mantiene estudios reenviados como study_report attachment-first", () => {
        var _a, _b;
        const fallback = (0, clinicalFallbacks_1.buildFallbackClinicalExtraction)({
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
        (0, vitest_1.expect)((_a = fallback === null || fallback === void 0 ? void 0 : fallback.event) === null || _a === void 0 ? void 0 : _a.event_type).toBe("study_report");
        (0, vitest_1.expect)((_b = fallback === null || fallback === void 0 ? void 0 : fallback.event) === null || _b === void 0 ? void 0 : _b.study_subtype).toBe("imaging");
        (0, vitest_1.expect)(fallback === null || fallback === void 0 ? void 0 : fallback.requiresHumanReview).toBe(true);
    });
    (0, vitest_1.it)("descarta recordatorios operativos sin estructura suficiente en vez de marcarlos ingested", () => {
        const status = (0, clinicalFallbacks_1.resolveClinicalDocumentProcessingStatus)({
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
        (0, vitest_1.expect)(status).toBe("discarded_operational_no_structured_event");
    });
    (0, vitest_1.it)("crea draft canónico para turnos estructurados aunque requieran review", () => {
        const shouldPersist = (0, clinicalFallbacks_1.shouldPersistCanonicalReviewDraft)({
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
        (0, vitest_1.expect)(shouldPersist).toBe(true);
    });
    (0, vitest_1.it)("crea draft canónico para estudios con señal clínica en adjuntos", () => {
        const shouldPersist = (0, clinicalFallbacks_1.shouldPersistCanonicalReviewDraft)({
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
        (0, vitest_1.expect)(shouldPersist).toBe(true);
    });
    (0, vitest_1.it)("no crea draft canónico para ruido ambiguo sin estructura clínica suficiente", () => {
        const shouldPersist = (0, clinicalFallbacks_1.shouldPersistCanonicalReviewDraft)({
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
        (0, vitest_1.expect)(shouldPersist).toBe(false);
    });
    (0, vitest_1.it)("mantiene recordatorios historicos de vacuna solo en review", () => {
        const shouldPersist = (0, clinicalFallbacks_1.shouldPersistCanonicalReviewDraft)({
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
        (0, vitest_1.expect)(shouldPersist).toBe(false);
    });
});
//# sourceMappingURL=clinicalFallbacks.test.js.map