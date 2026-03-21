import type {
  ClinicalAlertSeverity,
  ClinicalAlertStatus,
  ClinicalAlertType,
  ClinicalConditionPattern,
  ClinicalConditionStatus,
  TreatmentEntityStatus,
  TreatmentSubtype,
} from "../../app/types/medical";

export const WELLBEING_PROTOCOL_VERSION = "wellbeing_protocol_v1";

export const WELLBEING_PROTOCOL_ALLOWED_COLLECTIONS = [
  "pets",
  "clinical_conditions",
  "clinical_alerts",
  "treatments",
  "appointments",
  "medical_events",
] as const;

// Air gap explicito: estas superficies quedan fuera del motor de bienestar.
export const WELLBEING_PROTOCOL_FORBIDDEN_FIELDS = [
  "medical_events.documentUrl",
  "medical_events.documentPreviewUrl",
  "medical_events.fileName",
  "medical_events.extractedData.aiGeneratedSummary",
  "medical_events.extractedData.observations",
  "medical_events.extractedData.diagnosis",
  "medical_events.extractedData.sourceSubject",
  "medical_events.extractedData.sourceSender",
  "medical_events.extractedData.sourceFileName",
  "medical_events.extractedData.recommendations",
  "medical_events.treatmentNotes",
] as const;

export type WellbeingRoutineKind = "activity" | "assistance" | "attention";

export type WellbeingEnergyLevel = "low" | "medium" | "high" | "unknown";

export type WellbeingProtocolSourceCollection =
  | "pets"
  | "clinical_conditions"
  | "clinical_alerts"
  | "treatments"
  | "appointments"
  | "medical_events";

export type WellbeingProtocolTruthLevel =
  | "human_confirmed"
  | "user_curated"
  | "ai_auto_ingested"
  | "review_queue";

export type WellbeingProtocolValidationStatus =
  | "complete"
  | "needs_review"
  | "pending_human_review"
  | "auto_ingested_unconfirmed"
  | "duplicate_candidate"
  | "unknown";

export type WellbeingEligibilityStatus = "eligible" | "needs_review" | "blocked";

export type WellbeingEligibilityReason =
  | "missing_species"
  | "missing_breed"
  | "missing_weight"
  | "missing_energy_level"
  | "missing_environment_context"
  | "source_not_canonical"
  | "source_pending_review"
  | "source_requires_manual_confirmation"
  | "source_snapshot_not_frozen"
  | "source_below_confidence_threshold"
  | "active_high_severity_alert"
  | "thermal_risk_brachycephalic";

export interface WellbeingEligibilityThresholds {
  minimumCanonicalConfidence01: number;
  highHeatThresholdC: number;
  requireFrozenSnapshot: boolean;
}

export const DEFAULT_WELLBEING_ELIGIBILITY_THRESHOLDS: WellbeingEligibilityThresholds = {
  minimumCanonicalConfidence01: 0.85,
  highHeatThresholdC: 27,
  requireFrozenSnapshot: true,
};

export interface WellbeingProtocolSourceMeta {
  sourceCollection: Exclude<WellbeingProtocolSourceCollection, "pets">;
  sourceId: string;
  sourceEventId: string | null;
  sourceDocumentId: string | null;
  sourceTruthLevel: WellbeingProtocolTruthLevel;
  validationStatus: WellbeingProtocolValidationStatus;
  requiresManualConfirmation: boolean;
  protocolSnapshotFrozenAt: string | null;
  confidence01: number | null;
}

export interface WellbeingProtocolProfile {
  petId: string;
  name: string;
  species: string | null;
  breed: string | null;
  ageLabel: string | null;
  ageYearsApprox: number | null;
  weightKg: number | null;
  weightRaw: string | null;
  sex: "male" | "female" | null;
  isNeutered: boolean | null;
  energyLevel: WellbeingEnergyLevel;
}

export interface WellbeingEnvironmentSnapshot {
  capturedAt: string;
  timezone: string;
  localDateKey: string | null;
  localHour24: number | null;
  temperatureC: number | null;
  humidityPct: number | null;
  source: "weather_api" | "manual" | "unknown";
}

export interface WellbeingRiskFlags {
  isSenior: boolean;
  isBrachycephalic: boolean;
  hasOsteoarthritis: boolean;
  hasCardiacCondition: boolean;
  hasPostMedicationRestFlag: boolean;
}

export interface WellbeingConditionSignal {
  conditionId: string;
  normalizedName: string;
  organSystem: string | null;
  status: ClinicalConditionStatus;
  pattern: ClinicalConditionPattern;
  firstDetectedDate: string | null;
  lastDetectedDate: string | null;
  evidenceEventIds: string[];
  affectsRoutineKinds: WellbeingRoutineKind[];
  sourceMeta: WellbeingProtocolSourceMeta;
}

export interface WellbeingAlertSignal {
  alertId: string;
  type: ClinicalAlertType;
  severity: ClinicalAlertSeverity;
  status: ClinicalAlertStatus;
  title: string;
  linkedConditionIds: string[];
  linkedEventIds: string[];
  linkedAppointmentIds: string[];
  blocksRoutineKinds: WellbeingRoutineKind[];
  sourceMeta: WellbeingProtocolSourceMeta;
}

export interface WellbeingMedicationSignal {
  treatmentId: string;
  normalizedName: string;
  subtype: TreatmentSubtype | null;
  status: TreatmentEntityStatus;
  dosage: string | null;
  frequency: string | null;
  startDate: string | null;
  endDate: string | null;
  linkedConditionIds: string[];
  affectsRoutineKinds: WellbeingRoutineKind[];
  sourceMeta: WellbeingProtocolSourceMeta;
}

export interface WellbeingAppointmentSignal {
  appointmentId: string;
  type: "checkup" | "vaccine" | "surgery" | "emergency" | "other";
  status: "upcoming" | "completed" | "cancelled";
  date: string;
  time: string;
  title: string;
  clinic: string | null;
  veterinarian: string | null;
  affectsRoutineKinds: WellbeingRoutineKind[];
  sourceMeta: WellbeingProtocolSourceMeta;
}

export interface WellbeingRoutineEligibility {
  status: WellbeingEligibilityStatus;
  reasons: WellbeingEligibilityReason[];
}

export interface WellbeingProtocolEligibility {
  overallStatus: WellbeingEligibilityStatus;
  reasons: WellbeingEligibilityReason[];
  byRoutineKind: Record<WellbeingRoutineKind, WellbeingRoutineEligibility>;
  thresholdSnapshot: WellbeingEligibilityThresholds;
}

export interface WellbeingProtocolInput {
  version: typeof WELLBEING_PROTOCOL_VERSION;
  generatedAt: string;
  profile: WellbeingProtocolProfile;
  environment: WellbeingEnvironmentSnapshot;
  riskFlags: WellbeingRiskFlags;
  conditions: WellbeingConditionSignal[];
  alerts: WellbeingAlertSignal[];
  medications: WellbeingMedicationSignal[];
  appointments: WellbeingAppointmentSignal[];
  eligibility: WellbeingProtocolEligibility;
}
