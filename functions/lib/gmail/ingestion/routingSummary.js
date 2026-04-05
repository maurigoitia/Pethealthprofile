"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildMailRoutingSummary = buildMailRoutingSummary;
const clinicalNormalization_1 = require("./clinicalNormalization");
const utils_1 = require("./utils");
function uniqueEventTypes(values) {
    return Array.from(new Set(values));
}
function deriveDownstreamProjectionTargets(eventTypes) {
    const targets = [];
    if (eventTypes.some((eventType) => (0, clinicalNormalization_1.isAppointmentEventType)(eventType))) {
        targets.push("appointments");
    }
    if (eventTypes.some((eventType) => (0, clinicalNormalization_1.isPrescriptionEventType)(eventType))) {
        targets.push("treatments", "medications");
    }
    return (0, utils_1.uniqueNonEmpty)(targets);
}
function buildMailRoutingSummary(args) {
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
    let routeStatus = "pending_resolution";
    if (args.processingStatus.startsWith("queued_")) {
        routeStatus = "pending_background_processing";
    }
    else if (args.processingStatus.startsWith("discarded")) {
        routeStatus = "discarded";
    }
    else if (ingestedEventTypes.length > 0 && reviewEventTypes.length > 0) {
        routeStatus = "mixed";
    }
    else if (ingestedEventTypes.length > 0) {
        routeStatus = "canonical_ingested";
    }
    else if (reviewEventTypes.length > 0 || args.processingStatus.includes("requires_review")) {
        routeStatus = "review_queue";
    }
    else if (args.duplicatesRemoved > 0) {
        routeStatus = "duplicate_only";
    }
    else if (!args.isClinicalContent) {
        routeStatus = "discarded";
    }
    const sourceTruthLevel = routeStatus === "canonical_ingested"
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
        actual_write_targets: (0, utils_1.uniqueNonEmpty)(actualWriteTargets),
        downstream_projection_targets: downstreamProjectionTargets,
        duplicates_removed: args.duplicatesRemoved,
    };
}
//# sourceMappingURL=routingSummary.js.map