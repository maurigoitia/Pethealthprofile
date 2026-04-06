import type { ClinicalProfileSnapshot } from "../contexts/MedicalContext";
import { cleanText } from "./cleanText";

interface ConditionLike {
  normalizedName?: string | null;
}

interface TreatmentLike {
  name?: string | null;
  normalizedName?: string | null;
  dosage?: string | null;
}

interface StudyLike {
  title?: string | null;
  extractedData?: {
    studyType?: string | null;
    suggestedTitle?: string | null;
    documentType?: string | null;
  };
}

interface ClinicalNarrativeInput {
  petName: string;
  speciesLabel?: string | null;
  breed?: string | null;
  ageLabel?: string | null;
  snapshot?: ClinicalProfileSnapshot | null;
  activeConditions?: ConditionLike[];
  resolvedConditions?: ConditionLike[];
  treatmentRows?: TreatmentLike[];
  studies?: StudyLike[];
}

function uniqueValues(values: Array<string | null | undefined>, limit = 3): string[] {
  return Array.from(
    new Set(values.map((value) => cleanText(value || "")).filter(Boolean))
  ).slice(0, limit);
}

function joinHumanList(values: string[]): string {
  if (values.length === 0) return "";
  if (values.length === 1) return values[0];
  if (values.length === 2) return `${values[0]} y ${values[1]}`;
  return `${values.slice(0, -1).join(", ")} y ${values[values.length - 1]}`;
}

function buildStudyLabels(studies: StudyLike[]): string[] {
  return uniqueValues(
    studies.map((study) =>
      study.extractedData?.studyType ||
      study.title ||
      study.extractedData?.suggestedTitle ||
      study.extractedData?.documentType ||
      ""
    ),
    3
  );
}

export function buildClinicalNarrativeSummary({
  petName,
  speciesLabel,
  breed,
  ageLabel,
  snapshot,
  activeConditions = [],
  resolvedConditions = [],
  treatmentRows = [],
  studies = [],
}: ClinicalNarrativeInput): string | null {
  const snapshotNarrative = cleanText(snapshot?.narrative || "");
  if (snapshotNarrative) return snapshotNarrative;

  const activeNames = uniqueValues(activeConditions.map((item) => item.normalizedName), 3);
  const resolvedNames = uniqueValues(resolvedConditions.map((item) => item.normalizedName), 2);
  const medicationNames = uniqueValues(
    treatmentRows.map((item) => item.name || item.normalizedName || ""),
    3
  );
  const studyLabels = buildStudyLabels(studies);

  // If no clinical data at all, return null instead of empty string
  if (activeNames.length === 0 && resolvedNames.length === 0 && medicationNames.length === 0 && studyLabels.length === 0) {
    return null;
  }

  const introParts = [speciesLabel, breed, ageLabel].map((value) => cleanText(value || "")).filter(Boolean);
  const intro =
    introParts.length > 0
      ? `${petName} es ${introParts.join(" · ")}.`
      : `${petName} tiene un historial clínico consolidado en Pessy.`;

  const sentences = [intro];

  if (activeNames.length > 0) {
    sentences.push(`Actualmente se observa seguimiento de ${joinHumanList(activeNames)}.`);
  } else if (resolvedNames.length > 0) {
    sentences.push(`Entre sus antecedentes registrados figuran ${joinHumanList(resolvedNames)}.`);
  }

  if (medicationNames.length > 0) {
    sentences.push(`Los tratamientos registrados incluyen ${joinHumanList(medicationNames)}.`);
  }

  if (studyLabels.length > 0) {
    sentences.push(`Entre los estudios disponibles se encuentran ${joinHumanList(studyLabels)}.`);
  }

  return sentences.join(" ").trim();
}

export function buildClinicalNarrativeHighlights({
  snapshot,
  activeConditions = [],
  resolvedConditions = [],
  treatmentRows = [],
  studies = [],
}: Omit<ClinicalNarrativeInput, "petName">): string[] {
  const highlights = [
    ...uniqueValues(snapshot?.activeConditions || [], 2).map((item) => `Seguimiento: ${item}`),
    ...uniqueValues(snapshot?.currentMedications?.map((medication) => medication.name) || [], 2).map((item) => `Tratamiento: ${item}`),
    ...uniqueValues(snapshot?.recurrentPathologies || [], 1).map((item) => `Patrón observado: ${item}`),
  ];

  if (highlights.length > 0) return highlights.slice(0, 3);

  const fallbackHighlights = [
    ...uniqueValues(activeConditions.map((item) => item.normalizedName), 1).map((item) => `Seguimiento: ${item}`),
    ...uniqueValues(treatmentRows.map((item) => item.name || item.normalizedName || ""), 1).map((item) => `Tratamiento: ${item}`),
    ...buildStudyLabels(studies).slice(0, 1).map((item) => `Estudio: ${item}`),
    ...uniqueValues(resolvedConditions.map((item) => item.normalizedName), 1).map((item) => `Antecedente: ${item}`),
  ];

  return fallbackHighlights.slice(0, 3);
}
