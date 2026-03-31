"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// @vitest-environment node
const vitest_1 = require("vitest");
const jobProcessing_1 = require("../jobProcessing");
(0, vitest_1.describe)("jobProcessing raw context recovery", () => {
    (0, vitest_1.it)("reconstruye contexto mínimo desde gmail_ingestion_documents para mails attachment-first", () => {
        var _a;
        const recovered = (0, jobProcessing_1.buildRecoveredRawDocumentFromIngestionDocument)({
            ingestionDocument: {
                thread_id: "thread-1",
                email_date: "2025-08-22T00:13:39.000Z",
                from_email: "laura diaz <lvdiazz@yahoo.com.ar>",
                subject: "ECO THOR",
                hash_signature_raw: "raw-hash-1",
                attachment_metadata: [
                    {
                        filename: "GOITA THOR.pdf",
                        mimetype: "application/pdf",
                        size_bytes: 321937,
                        ocr_success: false,
                    },
                ],
            },
            sessionId: "session-1",
            uid: "user-1",
            messageId: "msg-1",
        });
        (0, vitest_1.expect)(recovered).toMatchObject({
            sessionId: "session-1",
            uid: "user-1",
            messageId: "msg-1",
            threadId: "thread-1",
            emailDate: "2025-08-22T00:13:39.000Z",
            sourceSender: "laura diaz <lvdiazz@yahoo.com.ar>",
            sourceSubject: "ECO THOR",
            bodyText: "",
            hashSignatureRaw: "raw-hash-1",
        });
        (0, vitest_1.expect)(recovered === null || recovered === void 0 ? void 0 : recovered.attachmentMeta).toHaveLength(1);
        (0, vitest_1.expect)((_a = recovered === null || recovered === void 0 ? void 0 : recovered.attachmentMeta[0]) === null || _a === void 0 ? void 0 : _a.filename).toBe("GOITA THOR.pdf");
    });
    (0, vitest_1.it)("usa sender y subject del payload cuando el documento persistido es parcial", () => {
        const recovered = (0, jobProcessing_1.buildRecoveredRawDocumentFromIngestionDocument)({
            ingestionDocument: {
                attachment_metadata: [
                    {
                        filename: "thor-eco.pdf",
                        mimetype: "application/pdf",
                        size_bytes: 2048,
                        ocr_success: false,
                    },
                ],
            },
            sessionId: "session-2",
            uid: "user-2",
            messageId: "msg-2",
            sourceSender: "estudios@vetclinic.com",
            sourceSubject: "Ecografia Thor",
        });
        (0, vitest_1.expect)(recovered === null || recovered === void 0 ? void 0 : recovered.sourceSender).toBe("estudios@vetclinic.com");
        (0, vitest_1.expect)(recovered === null || recovered === void 0 ? void 0 : recovered.sourceSubject).toBe("Ecografia Thor");
        (0, vitest_1.expect)(recovered === null || recovered === void 0 ? void 0 : recovered.hashSignatureRaw).toBeTruthy();
    });
});
//# sourceMappingURL=jobProcessing.test.js.map