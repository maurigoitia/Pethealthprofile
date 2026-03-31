import { isAppointmentEventType, isPrescriptionEventType } from "./clinicalNormalization";
import { EventType } from "./types";
import { uniqueNonEmpty } from "./utils";

export interface MailRoutingSummary {
  route_status:
    | "pending_background_processing"
    | "discarded"
    | "review_queue"
    | "canonical_ingested"
    | "mixed"
    | "duplicate_only"
    | "pending_resolution";
  source_truth_level: "discarded" | "review_queue" | "ai_auto_ingested" | null;
  event_types_detected: EventType[];
  ingested_event_types: EventType[];
  review_event_types: EventType[];
  actual_write_targets: string[];
  downstream_projection_targets: string[];
  duplicates_removed: number;
}

function uniqueEventTypes(values: EventType[]): EventType[] {
  return Array.from(new Set(values));
}

function deriveDownstreamProjectionTargets(eventTypes: EventType[]): string[] {
  const targets: string[] = [];
  if (eventTypes.some((eventType) => isAppointmentEventType(eventType))) {
    targets.push("appointments");
  }
  if (eventTypes.some((eventType) => isPrescriptionEventType(eventType))) {
    targets.push("treatments", "medications");
  }
  return uniqueNonEmpty(targets);
}

export function buildMailRoutingSummary(args: {
  processingStatus: string;
  isClinicalContent: boolean;
  ingestedEventTypes: EventType[];
  reviewEventTypes: EventType[];
  duplicatesRemoved: number;
  hasClinicalReviewDraft: boolean;
}): MailRoutingSummary {
  const ingestedEventTypes = uniqueEventTypes(args.ingestedEventTypes);
  const reviewEventTypes = uniqueEventTypes(args.reviewEventTypes);
  const eventTypesDetected = uniqueEventTypes([...ingestedEventTypes, ...reviewEventTypes]);

  const actualWriteTargets = ["gmail_ingestion_documents"];
  if (reviewEventTypes.length > 0) {
    actualWriteTargets.push("gmail_event_reviews", "pending_actions");
  }
  if (args.hasClinicalReviewDraft) {
    actualWriteTargets.push("clinical_review_drafts");
  }
  if (ingestedEventTypes.length > 0) {
    actualWriteTargets.push("medical_events");
  }
  const downstreamProjectionTargets = deriveDownstreamProjectionTargets(ingestedEventTypes);
  actualWriteTargets.push(...downstreamProjectionTargets);

  let routeStatus: MailRoutingSummary["route_status"] = "pending_resolution";
  if (args.processingStatus.startsWith("queued_")) {
    routeStatus = "pending_background_processing";
  } else if (args.processingStatus.startsWith("discarded")) {
    routeStatus = "discarded";
  } else if (ingestedEventTypes.length > 0 && reviewEventTypes.length > 0) {
    routeStatus = "mixed";
  } else if (ingestedEventTypes.length > 0) {
    routeStatus = "canonical_ingested";
  } else if (reviewEventTypes.length > 0 || args.processingStatus.includes("requires_review")) {
    routeStatus = "review_queue";
  } else if (args.duplicatesRemoved > 0) {
    routeStatus = "duplicate_only";
  } else if (!args.isClinicalContent) {
    routeStatus = "discarded";
  }

  const sourceTruthLevel: MailRoutingSummary["source_truth_level"] =
    routeStatus === "canonical_ingested"
      ? "ai_auto_ingested"
      : routeStatus === "mixed" || routeStatus === "review_queue"
        ? "review_queue"
        : routeStatus === "discarded"
          ? "discarded"
          : null;

  return {
    route_status: routeStatus,
    source_truth_level: sourceTruthLevel,
    event_types_detected: eventTypesDetected,
    ingested_event_types: ingestedEventTypes,
    review_event_types: reviewEventTypes,
    actual_write_targets: uniqueNonEmpty(actualWriteTargets),
    downstream_projection_targets: downstreamProjectionTargets,
    duplicates_removed: args.duplicatesRemoved,
  };
}
