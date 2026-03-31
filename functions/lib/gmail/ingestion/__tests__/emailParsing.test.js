"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// @vitest-environment node
const vitest_1 = require("vitest");
const emailParsing_1 = require("../emailParsing");
(0, vitest_1.describe)("emailParsing", () => {
    (0, vitest_1.it)("limpia html crudo antes de mandarlo al extractor clínico", () => {
        const html = Buffer.from('<html><head><style>.x{color:red}</style></head><body><a href="https://fonts.googleapis.com">foo</a><p>Recordatorio del Turno</p><p>31/03/2026 15 hs</p></body></html>', "utf8")
            .toString("base64")
            .replace(/\+/g, "-")
            .replace(/\//g, "_")
            .replace(/=+$/g, "");
        const body = (0, emailParsing_1.extractBodyText)({
            mimeType: "multipart/alternative",
            parts: [
                {
                    mimeType: "text/html",
                    body: {
                        data: html,
                    },
                },
            ],
        });
        (0, vitest_1.expect)(body).toContain("Recordatorio del Turno");
        (0, vitest_1.expect)(body).toContain("31/03/2026 15 hs");
        (0, vitest_1.expect)(body).not.toContain("fonts.googleapis.com");
        (0, vitest_1.expect)(body).not.toContain("<html>");
    });
    (0, vitest_1.it)("preserva cortes útiles de tablas y bloques html para no perder actos clínicos", () => {
        const html = Buffer.from("<html><body><table><tr><td>21/03/26</td><td>09:45</td><td>CONSULTA CARDIOLOGICA</td></tr><tr><td>21/03/26</td><td>10:30</td><td>ECOGRAFIA ABDOMINAL</td></tr></table></body></html>", "utf8")
            .toString("base64")
            .replace(/\+/g, "-")
            .replace(/\//g, "_")
            .replace(/=+$/g, "");
        const body = (0, emailParsing_1.extractBodyText)({
            mimeType: "multipart/alternative",
            parts: [
                {
                    mimeType: "text/html",
                    body: {
                        data: html,
                    },
                },
            ],
        });
        (0, vitest_1.expect)(body).toContain("21/03/26 | 09:45 | CONSULTA CARDIOLOGICA");
        (0, vitest_1.expect)(body).toContain("21/03/26 | 10:30 | ECOGRAFIA ABDOMINAL");
    });
});
//# sourceMappingURL=emailParsing.test.js.map