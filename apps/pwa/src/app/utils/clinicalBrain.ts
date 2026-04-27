import {
  ClinicalConditionPattern,
  ClinicalConditionStatus,
  MasterClinicalPayload,
  MedicalEvent,
} from "../types/medical";
import { parseDateSafe, toDateKeySafe, toTimestampSafe } from "./dateUtils";

export interface NormalizedDiagnosisDetected {
  normalized_name: string;
  raw_label: string;
  organ_system: string | null;
  severity: string | null;
}

export interface NormalizedAbnormalFinding {
  parameter: string;
  value: string | null;
  reference_range: string | null;
  status: "alto" | "bajo" | "alterado";
}

export interface NormalizedTreatmentDetected {
  normalized_name: string;
  raw_name: string;
  start_date: string | null;
  end_date: string | null;
  dosage: string | null;
  frequency: string | null;
  status: "active" | "completed" | "unknown";
}

export interface NormalizedAppointmentDetected {
  date: string | null;
  time: string | null;
  specialty: string | null;
  procedure: string | null;
  clinic_name: string | null;
  clinic_address: string | null;
  professional_name: string | null;
  preparation_required: string | null;
  status: "scheduled" | "programado" | "confirmado" | "recordatorio" | null;
}

export interface MedicalEventEntityPayload {
  event_id: string;
  pet_id: string;
  source_document_id: string;
  document_type: string;
  event_date: string | null;
  clinic: { name: string | null; address: string | null };
  professional: { name: string | null; license: string | null };
  diagnoses_detected: NormalizedDiagnosisDetected[];
  abnormal_findings: NormalizedAbnormalFinding[];
  treatments_detected: NormalizedTreatmentDetected[];
  appointments_detected: NormalizedAppointmentDetected[];
  recommendations: string[];
  created_at: string;
}

const CLINICAL_DIAGNOSIS_MASTER_TYPES = new Set([
  "clinical_report",
  "laboratory_result",
  "medical_study",
  "lab_result",
]);

const normalizeText = (value?: string | null): string =>
  (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export const slugifyKey = (value?: string | null): string => {
  const normalized = normalizeText(value).replace(/\s+/g, "_");
  return normalized || "unknown";
};

const unique = <T>(items: T[]): T[] => Array.from(new Set(items));

const normalizeConditionDictionary: Array<[RegExp, string]> = [
  [/hepatomegalia\s+(inflamatoria|vacuolar|metabolica)/i, "hepatomegaly"],
  [/hepatomegalia/i, "hepatomegaly"],
  [/cardiomegalia/i, "cardiomegaly"],
  [/bronquitis/i, "bronchitis"],
  [/displasia\s+de\s+cadera/i, "hip_dysplasia"],
  [/insuficiencia\s+cardiaca/i, "heart_failure"],
];

export const normalizeConditionName = (raw: string): string => {
  const cleaned = normalizeText(raw);
  for (const [pattern, normalized] of normalizeConditionDictionary) {
    if (pattern.test(cleaned)) return normalized;
  }
  return cleaned;
};

const normalizeOrganSystemDictionary: Array<[RegExp, string]> = [
  [/higado|hepatic|hepatico|hep[aá]tico/i, "sistema_hepatico"],
  [/cardio|corazon|corazon|cardiac/i, "sistema_cardiovascular"],
  [/respiratorio|pulmon/i, "sistema_respiratorio"],
  [/gastro|digest/i, "sistema_digestivo"],
  [/renal|rinon|riñon/i, "sistema_renal"],
  [/derma|piel/i, "sistema_dermatologico"],
  [/neuro|nervioso/i, "sistema_neurologico"],
  [/musculo|oseo|ortoped|locomotor/i, "sistema_musculoesqueletico"],
];

export const normalizeOrganSystem = (raw?: string | null): string | null => {
  const cleaned = normalizeText(raw || "");
  if (!cleaned) return null;
  for (const [pattern, normalized] of normalizeOrganSystemDictionary) {
    if (pattern.test(cleaned)) return normalized;
  }
  return cleaned;
};

const normalizeTreatmentDictionary: Array<[RegExp, string]> = [
  [/ursomax/i, "ursomax"],
  [/pimobendan/i, "pimobendan"],
  [/prednisolona/i, "prednisolona"],
  [/formula\s+magistral\s+hepatica/i, "formula_magistral_hepatica"],
];

export const normalizeTreatmentName = (raw: string): string => {
  const cleaned = normalizeText(raw);
  for (const [pattern, normalized] of normalizeTreatmentDictionary) {
    if (pattern.test(cleaned)) return normalized;
  }
  return cleaned;
};

const inferFindingStatus = (value?: string | null): "alto" | "bajo" | "alterado" | null => {
  const text = normalizeText(value);
  if (!text) return null;
  if (text.includes("alto") || text.includes("elevado") || text.includes("high")) return "alto";
  if (text.includes("bajo") || text.includes("low") || text.includes("disminuido")) return "bajo";
  if (text.includes("alterado") || text.includes("abnormal")) return "alterado";
  return null;
};

const toIsoDate = (value?: string | null): string | null => {
  const key = toDateKeySafe(value || "");
  return key || null;
};

const pickMaster = (event: MedicalEvent): MasterClinicalPayload | null => event.extractedData.masterClinical || null;

export const extractDiagnosesFromEvent = (event: MedicalEvent): NormalizedDiagnosisDetected[] => {
  const master = pickMaster(event);
  if (master) {
    if (!CLINICAL_DIAGNOSIS_MASTER_TYPES.has(master.document_type)) return [];
    return master.diagnoses
      .filter((row) => Boolean(row.condition_name))
      .map((row) => ({
        normalized_name: normalizeConditionName(row.condition_name || ""),
        raw_label: row.condition_name || "",
        organ_system: normalizeOrganSystem(row.organ_system),
        severity: row.severity || null,
      }))
      .filter((row) => Boolean(row.normalized_name));
  }

  // Legacy fallback: solo para tipos clínicos/lab, nunca para appointment.
  if (event.extractedData.documentType === "appointment") return [];
  const allowedLegacyTypes = new Set(["lab_test", "xray", "echocardiogram", "electrocardiogram", "checkup", "surgery"]);
  if (!allowedLegacyTypes.has(event.extractedData.documentType)) return [];

  const diagnosisText = event.extractedData.diagnosis || "";
  if (!diagnosisText.trim()) return [];

  return unique(
    diagnosisText
      .split(/[;\n,]/)
      .map((part) => part.trim())
      .filter(Boolean)
  ).map((raw) => ({
    normalized_name: normalizeConditionName(raw),
    raw_label: raw,
    organ_system: null,
    severity: null,
  }));
};

export const extractAbnormalFindingsFromEvent = (event: MedicalEvent): NormalizedAbnormalFinding[] => {
  const master = pickMaster(event);
  if (master) {
    return master.abnormal_findings
      .map((row) => {
        const parameter = (row.parameter || "").trim();
        const status = row.status || inferFindingStatus(row.reference_range) || inferFindingStatus(row.value);
        if (!parameter || !status) return null;
        return {
          parameter,
          value: row.value || null,
          reference_range: row.reference_range || null,
          status,
        };
      })
      .filter(Boolean) as NormalizedAbnormalFinding[];
  }

  return (event.extractedData.measurements || [])
    .map((measurement) => {
      const status = inferFindingStatus(measurement.referenceRange);
      if (!measurement.name || !status) return null;
      return {
        parameter: measurement.name,
        value: measurement.value || null,
        reference_range: measurement.referenceRange || null,
        status,
      };
    })
    .filter(Boolean) as NormalizedAbnormalFinding[];
};

const inferTreatmentStatus = (startDate: string | null, endDate: string | null): "active" | "completed" | "unknown" => {
  if (!startDate && !endDate) return "unknown";
  if (!endDate) return "active";
  const endTs = toTimestampSafe(endDate);
  if (!endTs) return "completed";
  return endTs >= Date.now() ? "active" : "completed";
};

export const extractTreatmentsFromEvent = (event: MedicalEvent): NormalizedTreatmentDetected[] => {
  const master = pickMaster(event);
  if (master) {
    return master.treatments
      .filter((row) => Boolean(row.treatment_name))
      .map((row) => {
        const rawName = (row.treatment_name || "").trim();
        const startDate = toIsoDate(row.start_date || event.extractedData.eventDate || event.createdAt);
        const endDate = toIsoDate(row.end_date);
        return {
          normalized_name: normalizeTreatmentName(rawName),
          raw_name: rawName,
          start_date: startDate,
          end_date: endDate,
          dosage: row.dosage || null,
          frequency: null,
          status: row.status === "activo" ? "active" : row.status === "finalizado" ? "completed" : inferTreatmentStatus(startDate, endDate),
        };
      })
      .filter((row) => Boolean(row.normalized_name));
  }

  return (event.extractedData.medications || [])
    .filter((row) => Boolean(row.name))
    .map((row) => {
      const rawName = row.name.trim();
      const startDate = toIsoDate(event.extractedData.eventDate || event.createdAt);
      const endDate = null;
      return {
        normalized_name: normalizeTreatmentName(rawName),
        raw_name: rawName,
        start_date: startDate,
        end_date: endDate,
        dosage: row.dosage || null,
        frequency: row.frequency || null,
        status: inferTreatmentStatus(startDate, endDate),
      };
    })
    .filter((row) => Boolean(row.normalized_name));
};

export const extractAppointmentsFromEvent = (event: MedicalEvent): NormalizedAppointmentDetected[] => {
  const master = pickMaster(event);
  const rows: NormalizedAppointmentDetected[] = [];

  if (master?.appointment_event?.event_type === "medical_appointment") {
    rows.push({
      date: toIsoDate(master.appointment_event.date),
      time: master.appointment_event.time || null,
      specialty: master.appointment_event.specialty || null,
      procedure: master.appointment_event.procedure || null,
      clinic_name: master.appointment_event.clinic || null,
      clinic_address: master.appointment_event.address || null,
      professional_name: master.appointment_event.professional_name || null,
      preparation_required: master.appointment_event.preparation_required || null,
      status: master.appointment_event.status || "scheduled",
    });
  }

  if (master?.appointments?.length) {
    for (const row of master.appointments) {
      rows.push({
        date: toIsoDate(row.date),
        time: row.time || null,
        specialty: row.specialty || null,
        procedure: row.procedure || null,
        clinic_name: row.clinic_name || null,
        clinic_address: row.clinic_address || null,
        professional_name: row.professional_name || null,
        preparation_required: null,
        status: row.status || "programado",
      });
    }
  }

  if ((event.extractedData.detectedAppointments || []).length > 0) {
    for (const row of event.extractedData.detectedAppointments) {
      rows.push({
        date: toIsoDate(row.date),
        time: row.time || null,
        specialty: row.specialty || null,
        procedure: row.title || null,
        clinic_name: row.clinic || null,
        clinic_address: null,
        professional_name: row.provider || null,
        preparation_required: null,
        status: "programado",
      });
    }
  }

  if (event.extractedData.documentType === "appointment" && event.extractedData.eventDate) {
    rows.push({
      date: toIsoDate(event.extractedData.eventDate),
      time: event.extractedData.appointmentTime || null,
      specialty: null,
      procedure: event.extractedData.suggestedTitle || event.title || null,
      clinic_name: event.extractedData.clinic || null,
      clinic_address: null,
      professional_name: event.extractedData.provider || null,
      preparation_required: null,
      status: "scheduled",
    });
  }

  const uniq = new Map<string, NormalizedAppointmentDetected>();
  for (const row of rows) {
    if (!row.date) continue;
    const key = `${row.date}|${row.time || ""}|${slugifyKey(row.procedure)}|${slugifyKey(row.clinic_name)}`;
    if (!uniq.has(key)) uniq.set(key, row);
  }
  return Array.from(uniq.values());
};

export const extractRecommendationsFromEvent = (event: MedicalEvent): string[] => {
  const master = pickMaster(event);
  const recs = [
    ...(master?.recommendations || []),
    event.extractedData.nextAppointmentReason || "",
  ]
    .map((v) => (v || "").trim())
    .filter(Boolean);

  return unique(recs);
};

export const buildMedicalEventEntityPayload = (event: MedicalEvent): MedicalEventEntityPayload => {
  const master = pickMaster(event);
  const eventDate = toIsoDate(master?.document_info?.date || event.extractedData.eventDate || event.createdAt);
  const clinicName = master?.document_info?.clinic_name || event.extractedData.clinic || null;
  const clinicAddress = master?.document_info?.clinic_address || null;
  const professionalName = master?.document_info?.veterinarian_name || event.extractedData.provider || null;
  const professionalLicense = master?.document_info?.veterinarian_license || null;

  return {
    event_id: event.id,
    pet_id: event.petId,
    source_document_id: event.fileHash || event.id,
    document_type: master?.document_type || event.extractedData.documentType || "other",
    event_date: eventDate,
    clinic: {
      name: clinicName,
      address: clinicAddress,
    },
    professional: {
      name: professionalName,
      license: professionalLicense,
    },
    diagnoses_detected: extractDiagnosesFromEvent(event),
    abnormal_findings: extractAbnormalFindingsFromEvent(event),
    treatments_detected: extractTreatmentsFromEvent(event),
    appointments_detected: extractAppointmentsFromEvent(event),
    recommendations: extractRecommendationsFromEvent(event),
    created_at: event.createdAt,
  };
};

export const computeConditionPattern = (
  firstDetectedDate: string | null,
  lastDetectedDate: string | null,
  occurrencesCount: number,
  thresholdDays = 21,
  chronicWindowDays = 120
): ClinicalConditionPattern => {
  if (!firstDetectedDate || !lastDetectedDate || occurrencesCount <= 1) return "unknown";
  const first = parseDateSafe(firstDetectedDate);
  const last = parseDateSafe(lastDetectedDate);
  if (!first || !last) return "unknown";
  const deltaDays = Math.floor((last.getTime() - first.getTime()) / 86400000);
  if (deltaDays >= chronicWindowDays) return "chronic";
  if (occurrencesCount >= 2 && deltaDays >= thresholdDays) return "recurrent";
  return "acute";
};

export const computeConditionStatus = (pattern: ClinicalConditionPattern): ClinicalConditionStatus => {
  if (pattern === "chronic" || pattern === "recurrent") return "active";
  if (pattern === "acute") return "monitoring";
  return "monitoring";
};

export const hasFollowupKeyword = (text: string): boolean => {
  const value = normalizeText(text);
  return /(control|recheck|re chequeo|seguimiento|cardio|presion|consulta|turno|revision)/i.test(value);
};

export const buildConditionId = (petId: string, normalizedName: string): string =>
  `cond_${petId}_${slugifyKey(normalizedName)}`;

export const buildTreatmentId = (petId: string, normalizedName: string, startDate: string | null): string =>
  `trt_${petId}_${slugifyKey(normalizedName)}_${slugifyKey(startDate || "na")}`;

export const buildAppointmentEntityId = (petId: string, row: NormalizedAppointmentDetected): string =>
  `apt_${petId}_${slugifyKey(row.date)}_${slugifyKey(row.time)}_${slugifyKey(row.procedure)}_${slugifyKey(row.clinic_name)}`;

export const buildAlertId = (petId: string, ruleId: string, scopeKey: string): string =>
  `alt_${petId}_${slugifyKey(ruleId)}_${slugifyKey(scopeKey)}`;
