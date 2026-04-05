// @vitest-environment node
import { describe, expect, it } from "vitest";

import { buildMailRoutingSummary } from "../routingSummary";

describe("routingSummary", () => {
  it("marca mails en cola como procesamiento en segundo plano", () => {
    const summary = buildMailRoutingSummary({
      processingStatus: "queued_attachment_ocr",
      isClinicalContent: true,
      ingestedEventTypes: [],
      reviewEventTypes: [],
      duplicatesRemoved: 0,
      hasClinicalReviewDraft: false,
    });

    expect(summary.route_status).toBe("pending_background_processing");
    expect(summary.actual_write_targets).toEqual(["gmail_ingestion_documents"]);
  });

  it("marca review queue con colecciones operativas claras", () => {
    const summary = buildMailRoutingSummary({
      processingStatus: "requires_review_low_confidence",
      isClinicalContent: true,
      ingestedEventTypes: [],
      reviewEventTypes: ["study_report"],
      duplicatesRemoved: 0,
      hasClinicalReviewDraft: false,
    });

    expect(summary.route_status).toBe("review_queue");
    expect(summary.source_truth_level).toBe("review_queue");
    expect(summary.actual_write_targets).toContain("gmail_event_reviews");
    expect(summary.actual_write_targets).toContain("pending_actions");
  });

  it("marca canónico + proyecciones para turnos y tratamientos", () => {
    const summary = buildMailRoutingSummary({
      processingStatus: "ingested",
      isClinicalContent: true,
      ingestedEventTypes: ["appointment_confirmation", "prescription_record"],
      reviewEventTypes: [],
      duplicatesRemoved: 0,
      hasClinicalReviewDraft: false,
    });

    expect(summary.route_status).toBe("canonical_ingested");
    expect(summary.actual_write_targets).toContain("medical_events");
    expect(summary.downstream_projection_targets).toContain("appointments");
    expect(summary.downstream_projection_targets).toContain("treatments");
    expect(summary.downstream_projection_targets).toContain("medications");
  });

  it("marca mixed cuando hay canónico y review en el mismo mail", () => {
    const summary = buildMailRoutingSummary({
      processingStatus: "requires_review",
      isClinicalContent: true,
      ingestedEventTypes: ["prescription_record"],
      reviewEventTypes: ["prescription_record"],
      duplicatesRemoved: 0,
      hasClinicalReviewDraft: true,
    });

    expect(summary.route_status).toBe("mixed");
    expect(summary.actual_write_targets).toContain("clinical_review_drafts");
    expect(summary.actual_write_targets).toContain("medical_events");
  });
});
