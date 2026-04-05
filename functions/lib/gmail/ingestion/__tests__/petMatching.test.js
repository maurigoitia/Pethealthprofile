"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// @vitest-environment node
const vitest_1 = require("vitest");
const petMatching_1 = require("../petMatching");
(0, vitest_1.describe)("pet matching candidate guardrails", () => {
    (0, vitest_1.it)("descarta mails auto-generados de Pessy antes del pipeline clínico", () => {
        (0, vitest_1.expect)((0, petMatching_1.isSelfGeneratedPessyEmail)({
            subject: "Hora de la medicación de Thor — Pessy",
            fromEmail: "PESSY <noreply@pessy.app>",
            bodyText: "Abrir Pessy para ver el recordatorio de Thor.",
        })).toBe(true);
        (0, vitest_1.expect)((0, petMatching_1.isCandidateClinicalEmail)({
            subject: "Hora de la medicación de Thor — Pessy",
            fromEmail: "PESSY <noreply@pessy.app>",
            bodyText: "Abrir Pessy para ver el recordatorio de Thor.",
            attachmentCount: 0,
            attachmentMetadata: [],
            petName: "Thor",
            petId: "iVoXhESOZ8FvuiWT43Ey",
        })).toBe(false);
    });
    (0, vitest_1.it)("toma como candidato un mail de eco con nombre de mascota y adjunto aunque el body sea mínimo", () => {
        (0, vitest_1.expect)((0, petMatching_1.isCandidateClinicalEmail)({
            subject: "ECO THOR",
            fromEmail: "laura diaz <lvdiazz@yahoo.com.ar>",
            bodyText: "",
            attachmentCount: 1,
            attachmentMetadata: [
                {
                    filename: "GOITA THOR.pdf",
                    mimetype: "application/pdf",
                    size_bytes: 321937,
                    ocr_success: false,
                },
            ],
            petName: "Thor",
            petId: "iVoXhESOZ8FvuiWT43Ey",
        })).toBe(true);
    });
    (0, vitest_1.it)("toma como candidato un estudio de sangre con nombre de mascota", () => {
        (0, vitest_1.expect)((0, petMatching_1.isCandidateClinicalEmail)({
            subject: "Hemograma Thor",
            fromEmail: "\"Veterinaria Honorio S.R.L.\" <info@veterinariahonorio.com.ar>",
            bodyText: "Extracción de sangre y perfil bioquímico para Thor.",
            attachmentCount: 1,
            attachmentMetadata: [
                {
                    filename: "thor-hemograma.pdf",
                    mimetype: "application/pdf",
                    size_bytes: 2048,
                    ocr_success: false,
                },
            ],
            petName: "Thor",
            petId: "iVoXhESOZ8FvuiWT43Ey",
        })).toBe(true);
    });
});
//# sourceMappingURL=petMatching.test.js.map