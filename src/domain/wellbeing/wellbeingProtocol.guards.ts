import {
  DEFAULT_WELLBEING_ELIGIBILITY_THRESHOLDS,
  type WellbeingAlertSignal,
  type WellbeingConditionSignal,
  type WellbeingEligibilityReason,
  type WellbeingEligibilityStatus,
  type WellbeingEligibilityThresholds,
  type WellbeingMedicationSignal,
  type WellbeingProtocolEligibility,
  type WellbeingProtocolInput,
  type WellbeingProtocolSourceMeta,
  type WellbeingRoutineEligibility,
  type WellbeingRoutineKind,
} from "./wellbeingProtocol.contract";

const ROUTINE_KINDS: WellbeingRoutineKind[] = ["activity", "assistance", "attention"];

const NON_CANONICAL_TRUTH_LEVELS = new Set(["review_queue"]);
const REVIEW_VALIDATION_STATUSES = new Set(["needs_review", "pending_human_review", "duplicate_candidate"]);

function cloneThresholds(
  overrides?: Partial<WellbeingEligibilityThresholds>
): WellbeingEligibilityThresholds {
  return {
    ...DEFAULT_WELLBEING_ELIGIBILITY_THRESHOLDS,
    ...overrides,
  };
}

function emptyRoutineEligibility(): WellbeingRoutineEligibility {
  return { status: "eligible", reasons: [] };
}

function pushReason(
  eligibility: WellbeingRoutineEligibility,
  reason: WellbeingEligibilityReason,
  nextStatus: WellbeingEligibilityStatus
) {
  if (!eligibility.reasons.includes(reason)) {
    eligibility.reasons.push(reason);
  }
  if (eligibility.status === "blocked") return;
  if (nextStatus === "blocked") {
    eligibility.status = "blocked";
    return;
  }
  if (nextStatus === "needs_review") {
    eligibility.status = "needs_review";
  }
}

function sourceMetaReasons(
  meta: WellbeingProtocolSourceMeta,
  thresholds: WellbeingEligibilityThresholds
): WellbeingEligibilityReason[] {
  const reasons: WellbeingEligibilityReason[] = [];

  if (NON_CANONICAL_TRUTH_LEVELS.has(meta.sourceTruthLevel)) {
    reasons.push("source_not_canonical");
  }
  if (meta.requiresManualConfirmation) {
    reasons.push("source_requires_manual_confirmation");
  }
  if (REVIEW_VALIDATION_STATUSES.has(meta.validationStatus)) {
    reasons.push("source_pending_review");
  }
  if (thresholds.requireFrozenSnapshot && !meta.protocolSnapshotFrozenAt) {
    reasons.push("source_snapshot_not_frozen");
  }
  if (meta.confidence01 != null && meta.confidence01 < thresholds.minimumCanonicalConfidence01) {
    reasons.push("source_below_confidence_threshold");
  }

  return Array.from(new Set(reasons));
}

function applyReasonsToKinds(
  byRoutineKind: Record<WellbeingRoutineKind, WellbeingRoutineEligibility>,
  kinds: WellbeingRoutineKind[],
  reasons: WellbeingEligibilityReason[],
  nextStatus: WellbeingEligibilityStatus
) {
  for (const kind of kinds) {
    const target = byRoutineKind[kind];
    for (const reason of reasons) {
      pushReason(target, reason, nextStatus);
    }
  }
}

function applySignalMeta(
  byRoutineKind: Record<WellbeingRoutineKind, WellbeingRoutineEligibility>,
  kinds: WellbeingRoutineKind[],
  meta: WellbeingProtocolSourceMeta,
  thresholds: WellbeingEligibilityThresholds
) {
  const reasons = sourceMetaReasons(meta, thresholds);
  if (reasons.length === 0) return;
  applyReasonsToKinds(byRoutineKind, kinds, reasons, "blocked");
}

function applyHighSeverityAlerts(
  byRoutineKind: Record<WellbeingRoutineKind, WellbeingRoutineEligibility>,
  alerts: WellbeingAlertSignal[]
) {
  for (const alert of alerts) {
    if (alert.status !== "active" || alert.severity !== "high") continue;
    applyReasonsToKinds(
      byRoutineKind,
      alert.blocksRoutineKinds,
      ["active_high_severity_alert"],
      "blocked"
    );
  }
}

function applyThermalRisk(
  input: Pick<WellbeingProtocolInput, "environment" | "riskFlags">,
  thresholds: WellbeingEligibilityThresholds,
  byRoutineKind: Record<WellbeingRoutineKind, WellbeingRoutineEligibility>
) {
  const temperatureC = input.environment.temperatureC;
  if (
    input.riskFlags.isBrachycephalic &&
    temperatureC != null &&
    temperatureC > thresholds.highHeatThresholdC
  ) {
    applyReasonsToKinds(
      byRoutineKind,
      ["activity"],
      ["thermal_risk_brachycephalic"],
      "blocked"
    );
  }
}

function applyMissingProfileData(
  input: Pick<WellbeingProtocolInput, "profile" | "environment">,
  byRoutineKind: Record<WellbeingRoutineKind, WellbeingRoutineEligibility>
) {
  if (!input.profile.species) {
    applyReasonsToKinds(byRoutineKind, ROUTINE_KINDS, ["missing_species"], "blocked");
  }
  if (!input.profile.breed) {
    applyReasonsToKinds(byRoutineKind, ["activity"], ["missing_breed"], "needs_review");
  }
  if (input.profile.weightKg == null) {
    applyReasonsToKinds(byRoutineKind, ["activity"], ["missing_weight"], "needs_review");
  }
  if (input.profile.energyLevel === "unknown") {
    applyReasonsToKinds(byRoutineKind, ["activity"], ["missing_energy_level"], "needs_review");
  }
  if (input.environment.temperatureC == null || input.environment.humidityPct == null) {
    applyReasonsToKinds(
      byRoutineKind,
      ["activity"],
      ["missing_environment_context"],
      "needs_review"
    );
  }
}

function applySignals(
  byRoutineKind: Record<WellbeingRoutineKind, WellbeingRoutineEligibility>,
  conditions: WellbeingConditionSignal[],
  medications: WellbeingMedicationSignal[],
  thresholds: WellbeingEligibilityThresholds
) {
  for (const condition of conditions) {
    applySignalMeta(byRoutineKind, condition.affectsRoutineKinds, condition.sourceMeta, thresholds);
  }
  for (const medication of medications) {
    applySignalMeta(byRoutineKind, medication.affectsRoutineKinds, medication.sourceMeta, thresholds);
  }
}

function summarizeOverallStatus(
  byRoutineKind: Record<WellbeingRoutineKind, WellbeingRoutineEligibility>
): WellbeingEligibilityStatus {
  const statuses = ROUTINE_KINDS.map((kind) => byRoutineKind[kind].status);
  if (statuses.every((status) => status === "blocked")) return "blocked";
  if (statuses.some((status) => status !== "eligible")) return "needs_review";
  return "eligible";
}

function summarizeReasons(
  byRoutineKind: Record<WellbeingRoutineKind, WellbeingRoutineEligibility>
): WellbeingEligibilityReason[] {
  return Array.from(
    new Set(ROUTINE_KINDS.flatMap((kind) => byRoutineKind[kind].reasons))
  );
}

export function evaluateWellbeingProtocolEligibility(
  input: Pick<
    WellbeingProtocolInput,
    "profile" | "environment" | "riskFlags" | "conditions" | "alerts" | "medications"
  >,
  overrides?: Partial<WellbeingEligibilityThresholds>
): WellbeingProtocolEligibility {
  const thresholds = cloneThresholds(overrides);
  const byRoutineKind = {
    activity: emptyRoutineEligibility(),
    assistance: emptyRoutineEligibility(),
    attention: emptyRoutineEligibility(),
  };

  applyMissingProfileData(input, byRoutineKind);
  applySignals(byRoutineKind, input.conditions, input.medications, thresholds);
  applyHighSeverityAlerts(byRoutineKind, input.alerts);
  applyThermalRisk(input, thresholds, byRoutineKind);

  return {
    overallStatus: summarizeOverallStatus(byRoutineKind),
    reasons: summarizeReasons(byRoutineKind),
    byRoutineKind,
    thresholdSnapshot: thresholds,
  };
}
