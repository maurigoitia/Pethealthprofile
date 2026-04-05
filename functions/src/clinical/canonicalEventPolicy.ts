function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value.trim() : fallback;
}

function asBoolean(value: unknown): boolean {
  return value === true;
}

function hasEmailSourceIds(value: unknown): boolean {
  return Array.isArray(value) && value.some((item) => Boolean(asString(item)));
}

export function isMailImportRecord(row: Record<string, unknown>): boolean {
  return (
    asString(row.source) === "email_import" ||
    Boolean(asString(row.source_email_id)) ||
    Boolean(asString(row.latest_source_email_id)) ||
    hasEmailSourceIds(row.source_email_ids)
  );
}

export function getEpisodeProjectionBlockers(row: Record<string, unknown>): string[] {
  const blockers: string[] = [];
  const status = asString(row.status);
  const workflowStatus = asString(row.workflowStatus);
  const truthStatus = asString(row.truthStatus);
  const sourceTruthLevel = asString(row.sourceTruthLevel);
  const extracted = asRecord(row.extractedData);
  const treatmentValidationStatus =
    asString(extracted.treatmentValidationStatus) ||
    asString(row.validation_status) ||
    asString(row.validationStatus);

  if (status === "processing" || status === "draft") blockers.push("status");
  if (workflowStatus === "review_required" || workflowStatus === "invalid_future_date") blockers.push("workflow_status");
  if (asBoolean(row.requiresManualConfirmation)) blockers.push("manual_confirmation");

  if (isMailImportRecord(row)) {
    if (sourceTruthLevel === "review_queue") blockers.push("source_truth_level");
    if (truthStatus === "pending_human_review") blockers.push("truth_status");
    if (treatmentValidationStatus === "needs_review") blockers.push("treatment_validation");
  }

  return blockers;
}

export function isMedicalEventEligibleForEpisodeProjection(row: Record<string, unknown>): boolean {
  return getEpisodeProjectionBlockers(row).length === 0;
}
