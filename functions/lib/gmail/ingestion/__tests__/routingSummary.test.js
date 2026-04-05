"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// @vitest-environment node
const vitest_1 = require("vitest");
const routingSummary_1 = require("../routingSummary");
(0, vitest_1.describe)("routingSummary", () => {
    (0, vitest_1.it)("marca mails en cola como procesamiento en segundo plano", () => {
        const summary = (0, routingSummary_1.buildMailRoutingSummary)({
            processingStatus: "queued_attachment_ocr",
            isClinicalContent: true,
            ingestedEventTypes: [],
            reviewEventTypes: [],
            duplicatesRemoved: 0,
            hasClinicalReviewDraft: false,
        });
        (0, vitest_1.expect)(summary.route_status).toBe("pending_background_processing");
        (0, vitest_1.expect)(summary.actual_write_targets).toEqual(["gmail_ingestion_documents"]);
    });
    (0, vitest_1.it)("marca review queue con colecciones operativas claras", () => {
        const summary = (0, routingSummary_1.buildMailRoutingSummary)({
            processingStatus: "requires_review_low_confidence",
            isClinicalContent: true,
            ingestedEventTypes: [],
            reviewEventTypes: ["study_report"],
            duplicatesRemoved: 0,
            hasClinicalReviewDraft: false,
        });
        (0, vitest_1.expect)(summary.route_status).toBe("review_queue");
        (0, vitest_1.expect)(summary.source_truth_level).toBe("review_queue");
        (0, vitest_1.expect)(summary.actual_write_targets).toContain("gmail_event_reviews");
        (0, vitest_1.expect)(summary.actual_write_targets).toContain("pending_actions");
    });
    (0, vitest_1.it)("marca canónico + proyecciones para turnos y tratamientos", () => {
        const summary = (0, routingSummary_1.buildMailRoutingSummary)({
            processingStatus: "ingested",
            isClinicalContent: true,
            ingestedEventTypes: ["appointment_confirmation", "prescription_record"],
            reviewEventTypes: [],
            duplicatesRemoved: 0,
            hasClinicalReviewDraft: false,
        });
        (0, vitest_1.expect)(summary.route_status).toBe("canonical_ingested");
        (0, vitest_1.expect)(summary.actual_write_targets).toContain("medical_events");
        (0, vitest_1.expect)(summary.downstream_projection_targets).toContain("appointments");
        (0, vitest_1.expect)(summary.downstream_projection_targets).toContain("treatments");
        (0, vitest_1.expect)(summary.downstream_projection_targets).toContain("medications");
    });
    (0, vitest_1.it)("marca mixed cuando hay canónico y review en el mismo mail", () => {
        const summary = (0, routingSummary_1.buildMailRoutingSummary)({
            processingStatus: "requires_review",
            isClinicalContent: true,
            ingestedEventTypes: ["prescription_record"],
            reviewEventTypes: ["prescription_record"],
            duplicatesRemoved: 0,
            hasClinicalReviewDraft: true,
        });
        (0, vitest_1.expect)(summary.route_status).toBe("mixed");
        (0, vitest_1.expect)(summary.actual_write_targets).toContain("clinical_review_drafts");
        (0, vitest_1.expect)(summary.actual_write_targets).toContain("medical_events");
    });
});
//# sourceMappingURL=routingSummary.test.js.map