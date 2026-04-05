import { describe, expect, it } from "vitest";
import {
  getEpisodeProjectionBlockers,
  isMailImportRecord,
  isMedicalEventEligibleForEpisodeProjection,
} from "../canonicalEventPolicy";

describe("canonicalEventPolicy", () => {
  it("detects mail-import records from explicit source and source email ids", () => {
    expect(isMailImportRecord({ source: "email_import" })).toBe(true);
    expect(isMailImportRecord({ source_email_id: "msg_1" })).toBe(true);
    expect(isMailImportRecord({ source_email_ids: ["msg_1"] })).toBe(true);
    expect(isMailImportRecord({ source: "manual" })).toBe(false);
  });

  it("blocks episode projection for mail-import events still in review queue", () => {
    const row = {
      source: "email_import",
      status: "completed",
      workflowStatus: "confirmed",
      requiresManualConfirmation: false,
      sourceTruthLevel: "review_queue",
      truthStatus: "pending_human_review",
    };

    expect(isMedicalEventEligibleForEpisodeProjection(row)).toBe(false);
    expect(getEpisodeProjectionBlockers(row)).toEqual(["source_truth_level", "truth_status"]);
  });

  it("blocks episode projection for incomplete treatment review state", () => {
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

    expect(isMedicalEventEligibleForEpisodeProjection(row)).toBe(false);
    expect(getEpisodeProjectionBlockers(row)).toEqual(["treatment_validation"]);
  });

  it("allows episode projection for clean auto-ingested email events", () => {
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

    expect(isMedicalEventEligibleForEpisodeProjection(row)).toBe(true);
    expect(getEpisodeProjectionBlockers(row)).toEqual([]);
  });

  it("allows non-mail confirmed records into episodes", () => {
    const row = {
      status: "completed",
      workflowStatus: "confirmed",
      requiresManualConfirmation: false,
      truthStatus: "human_confirmed",
    };

    expect(isMedicalEventEligibleForEpisodeProjection(row)).toBe(true);
  });
});
