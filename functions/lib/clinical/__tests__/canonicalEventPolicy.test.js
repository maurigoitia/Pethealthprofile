"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const canonicalEventPolicy_1 = require("../canonicalEventPolicy");
(0, vitest_1.describe)("canonicalEventPolicy", () => {
    (0, vitest_1.it)("detects mail-import records from explicit source and source email ids", () => {
        (0, vitest_1.expect)((0, canonicalEventPolicy_1.isMailImportRecord)({ source: "email_import" })).toBe(true);
        (0, vitest_1.expect)((0, canonicalEventPolicy_1.isMailImportRecord)({ source_email_id: "msg_1" })).toBe(true);
        (0, vitest_1.expect)((0, canonicalEventPolicy_1.isMailImportRecord)({ source_email_ids: ["msg_1"] })).toBe(true);
        (0, vitest_1.expect)((0, canonicalEventPolicy_1.isMailImportRecord)({ source: "manual" })).toBe(false);
    });
    (0, vitest_1.it)("blocks episode projection for mail-import events still in review queue", () => {
        const row = {
            source: "email_import",
            status: "completed",
            workflowStatus: "confirmed",
            requiresManualConfirmation: false,
            sourceTruthLevel: "review_queue",
            truthStatus: "pending_human_review",
        };
        (0, vitest_1.expect)((0, canonicalEventPolicy_1.isMedicalEventEligibleForEpisodeProjection)(row)).toBe(false);
        (0, vitest_1.expect)((0, canonicalEventPolicy_1.getEpisodeProjectionBlockers)(row)).toEqual(["source_truth_level", "truth_status"]);
    });
    (0, vitest_1.it)("blocks episode projection for incomplete treatment review state", () => {
        const row = {
            source: "email_import",
            status: "completed",
            workflowStatus: "confirmed",
            requiresManualConfirmation: false,
            sourceTruthLevel: "ai_auto_ingested",
            truthStatus: "auto_ingested_unconfirmed",
            extractedData: {
                treatmentValidationStatus: "needs_review",
            },
        };
        (0, vitest_1.expect)((0, canonicalEventPolicy_1.isMedicalEventEligibleForEpisodeProjection)(row)).toBe(false);
        (0, vitest_1.expect)((0, canonicalEventPolicy_1.getEpisodeProjectionBlockers)(row)).toEqual(["treatment_validation"]);
    });
    (0, vitest_1.it)("allows episode projection for clean auto-ingested email events", () => {
        const row = {
            source: "email_import",
            status: "completed",
            workflowStatus: "confirmed",
            requiresManualConfirmation: false,
            sourceTruthLevel: "ai_auto_ingested",
            truthStatus: "auto_ingested_unconfirmed",
            extractedData: {
                treatmentValidationStatus: "complete",
            },
        };
        (0, vitest_1.expect)((0, canonicalEventPolicy_1.isMedicalEventEligibleForEpisodeProjection)(row)).toBe(true);
        (0, vitest_1.expect)((0, canonicalEventPolicy_1.getEpisodeProjectionBlockers)(row)).toEqual([]);
    });
    (0, vitest_1.it)("allows non-mail confirmed records into episodes", () => {
        const row = {
            status: "completed",
            workflowStatus: "confirmed",
            requiresManualConfirmation: false,
            truthStatus: "human_confirmed",
        };
        (0, vitest_1.expect)((0, canonicalEventPolicy_1.isMedicalEventEligibleForEpisodeProjection)(row)).toBe(true);
    });
});
//# sourceMappingURL=canonicalEventPolicy.test.js.map