// ============================================================================
// PESSY - Servicio de analisis documental
// Mock + implementacion real
// ============================================================================

import {
  ActiveMedication,
  Appointment,
  ExtractedData,
  DocumentExtractionResponse,
  DocumentType,
  ProactiveCareAlert,
  ProactiveCarePlan,
  ProactiveImagingFinding,
  ProactiveMedicationPlan,
  MasterClinicalPayload,
  MedicalEvent,
  MedicationExtracted,
  Measurement,
} from "../types/medical";
import { toDateKeySafe, toTimestampSafe } from "../utils/dateUtils";
import { httpsCallable } from "firebase/functions";
import { functions as firebaseFunctions } from "../../lib/firebase";

const DOCUMENT_TYPES: DocumentType[] = [
  "vaccine",
  "appointment",
  "lab_test",
  "xray",
  "echocardiogram",
  "electrocardiogram",
  "surgery",
  "medication",
  "checkup",
  "other",
];

const CONFIDENCE_LEVELS = ["high", "medium", "low", "not_detected"] as const;
const APPOINTMENT_HINT_REGEX = /(turno|confirmad|consulta|especialidad|prestaci[oó]n|centro de atenci[oó]n|agenda|cita)/i;
const QUALITATIVE_MICROSCOPY_HINT_REGEX = /(tricogram|k[\s-]?oh|dermatofit|ectoparasit|microscop|citolog|raspado)/i;
type MasterImagingFinding = NonNullable<MasterClinicalPayload["imaging_findings"]>[number];

const USE_BACKEND_ANALYSIS = String((import.meta as any).env.VITE_USE_BACKEND_ANALYSIS || "true").toLowerCase() === "true";
const ALLOW_DIRECT_AI_FALLBACK =
  String((import.meta as any).env.VITE_ALLOW_DIRECT_ANALYSIS_FALLBACK || "false").toLowerCase() === "true";
const RUNTIME_ALLOW_DIRECT_AI_FALLBACK = ALLOW_DIRECT_AI_FALLBACK && !import.meta.env.PROD;
const OCTET_STREAM_MIME_TYPES = new Set(["", "application/octet-stream", "binary/octet-stream"]);
const PDF_MIME_ALIASES = new Set(["application/pdf", "application/x-pdf", "application/acrobat", "applications/vnd.pdf", "text/pdf"]);
const IMAGE_MIME_NORMALIZATION: Record<string, string> = {
  "image/jpg": "image/jpeg",
  "image/pjpeg": "image/jpeg",
};
const SUPPORTED_ANALYSIS_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);
const HEIC_EXTENSIONS = new Set(["heic", "heif"]);

function getFileExtension(fileName: string): string {
  const match = fileName.toLowerCase().match(/\.([a-z0-9]+)$/);
  return match?.[1] || "";
}

function normalizeAnalysisMimeType(file: File): string {
  const rawMime = (file.type || "").toLowerCase().trim();
  if (PDF_MIME_ALIASES.has(rawMime)) return "application/pdf";
  if (IMAGE_MIME_NORMALIZATION[rawMime]) return IMAGE_MIME_NORMALIZATION[rawMime];
  if (!OCTET_STREAM_MIME_TYPES.has(rawMime)) return rawMime;

  const extension = getFileExtension(file.name || "");
  if (extension === "pdf") return "application/pdf";
  if (extension === "jpg" || extension === "jpeg") return "image/jpeg";
  if (extension === "png") return "image/png";
  if (extension === "webp") return "image/webp";
  if (extension === "heic" || extension === "heif") return "image/heic";

  return rawMime || "application/octet-stream";
}

function isHeicLike(file: File): boolean {
  const extension = getFileExtension(file.name || "");
  const mime = (file.type || "").toLowerCase();
  return HEIC_EXTENSIONS.has(extension) || mime.includes("heic") || mime.includes("heif");
}

function isSupportedAnalysisMimeType(mimeType: string): boolean {
  return SUPPORTED_ANALYSIS_MIME_TYPES.has(mimeType);
}

async function convertHeicToJpeg(file: File): Promise<File> {
  const { default: heic2any } = await import("heic2any");
  const converted = await heic2any({
    blob: file,
    toType: "image/jpeg",
    quality: 0.92,
  });
  const convertedBlob = Array.isArray(converted) ? converted[0] : converted;
  if (!(convertedBlob instanceof Blob)) {
    throw new Error("No se pudo convertir HEIC/HEIF para análisis.");
  }

  return new File([convertedBlob], file.name.replace(/\.[^/.]+$/, ".jpg"), {
    type: "image/jpeg",
    lastModified: Date.now(),
  });
}

interface BackendAnalyzeResponse {
  rawText: string;
  model?: string;
  tokensUsed?: number;
  processingTimeMs?: number;
}

interface BackendSummaryResponse {
  rawText: string;
  model?: string;
  tokensUsed?: number;
  processingTimeMs?: number;
}

async function callBackendFunction<TPayload extends Record<string, unknown>, TResult>(
  name: string,
  payload: TPayload
): Promise<TResult> {
  const callable = httpsCallable<TPayload, TResult>(firebaseFunctions, name);
  const result = await callable(payload);
  return result.data;
}

const asStringOrNull = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const asObject = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : {};

const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
const asBooleanOrNull = (value: unknown): boolean | null => {
  if (typeof value === "boolean") return value;
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (["true", "si", "sí", "yes", "1", "detectado", "presente"].includes(normalized)) return true;
  if (["false", "no", "0", "ausente", "no_detectado"].includes(normalized)) return false;
  return null;
};

const hasNumericSignal = (value: unknown): boolean => {
  const text = asStringOrNull(value);
  if (!text) return false;
  return /\d/.test(text);
};

const isQualitativeMicroscopyText = (value: unknown): boolean => {
  const text = asStringOrNull(value)?.toLowerCase() || "";
  if (!text) return false;
  return QUALITATIVE_MICROSCOPY_HINT_REGEX.test(text);
};

const isNoObservedPathogenFinding = (value: unknown): boolean => {
  const text = asStringOrNull(value)?.toLowerCase() || "";
  if (!text) return false;
  return /(no\s+se\s+observ|ausenc|negativ|sin\s+evidencia)/i.test(text) &&
    /(dermatofit|ectoparasit|hongo|parasit)/i.test(text);
};

const isQualitativeMicroscopyMeasurement = (measurement: Pick<Measurement, "name" | "value" | "referenceRange">): boolean => {
  const joined = [measurement.name, measurement.value, measurement.referenceRange]
    .filter(Boolean)
    .join(" ");
  if (!isQualitativeMicroscopyText(joined)) return false;
  const hasNumeric = hasNumericSignal(measurement.value) || hasNumericSignal(measurement.referenceRange);
  return !hasNumeric;
};

const sanitizeMeasurementReferenceRange = (
  measurement: Pick<Measurement, "name" | "value" | "referenceRange">
): string | null => {
  const rawRange = asStringOrNull(measurement.referenceRange);
  if (!rawRange) return null;
  const hasNumeric = hasNumericSignal(measurement.value) || hasNumericSignal(rawRange);
  if (hasNumeric) return rawRange;
  // Regla global: sin números/rangos explícitos no hay "fuera de rango".
  if (/(alto|bajo|alterado|fuera\s+de\s+rango|normal)/i.test(rawRange)) return null;
  return rawRange;
};

const collapseQualitativeMicroscopyMeasurements = (measurements: Measurement[]): Measurement[] => {
  const microscopyRows = measurements.filter((row) => isQualitativeMicroscopyMeasurement(row));
  if (microscopyRows.length === 0) return measurements;

  const primary = microscopyRows.find((row) => isNoObservedPathogenFinding(row.value)) || microscopyRows[0];
  if (!primary) return measurements;

  const primaryName = asStringOrNull(primary.name) || "Pelos, OD con KOH";
  const primaryValue = asStringOrNull(primary.value);
  if (!primaryValue) return [];

  return [{
    name: primaryName,
    value: primaryValue,
    unit: null,
    referenceRange: null,
    confidence: primary.confidence || "high",
  }];
};

const asConfidence = (value: unknown): "high" | "medium" | "low" | "not_detected" => {
  if (typeof value === "number") {
    if (value >= 0.85) return "high";
    if (value >= 0.65) return "medium";
    if (value >= 0.45) return "low";
    return "not_detected";
  }
  if (typeof value !== "string") return "not_detected";
  const normalized = value.toLowerCase().trim();
  if (normalized === "alta" || normalized === "alto") return "high";
  if (normalized === "media" || normalized === "medio") return "medium";
  if (normalized === "baja" || normalized === "bajo") return "low";
  if (normalized === "no_detectado" || normalized === "no detectado") return "not_detected";
  return (CONFIDENCE_LEVELS as readonly string[]).includes(normalized)
    ? (normalized as "high" | "medium" | "low" | "not_detected")
    : "not_detected";
};

const normalizeFindingStatus = (
  value: unknown
): MasterClinicalPayload["abnormal_findings"][number]["status"] => {
  const normalized = asStringOrNull(value)?.toLowerCase();
  if (!normalized) return null;

  if (/(^|[\s_-])(alto|elevado|high)([\s_-]|$)/i.test(normalized)) return "alto";
  if (/(^|[\s_-])(bajo|disminuido|low)([\s_-]|$)/i.test(normalized)) return "bajo";
  if (/alterad|fuera\s+de\s+rango/i.test(normalized)) return "alterado";
  if (/normal|en\s+rango/i.test(normalized)) return "normal";
  if (/no[_\s-]?observado|ausencia|negativ|sin\s+evidencia|no\s+se\s+observ/i.test(normalized)) return "no_observado";
  if (/inconclus|indeterminado|no\s+concluyente/i.test(normalized)) return "inconcluso";
  return null;
};

const findingStatusLabel = (
  status: MasterClinicalPayload["abnormal_findings"][number]["status"]
): string | null => {
  if (!status) return null;
  if (status === "alto") return "alto";
  if (status === "bajo") return "bajo";
  if (status === "alterado") return "alterado";
  if (status === "normal") return "normal";
  if (status === "no_observado") return "no observado";
  if (status === "inconcluso") return "inconcluso";
  return null;
};

const extractPrioritizedClinicalRecommendations = (recommendations: string[]) => {
  const clean = recommendations
    .map((item) => item.trim())
    .filter(Boolean);

  const startsWith = (prefix: RegExp) => clean.find((item) => prefix.test(item));
  const byPattern = (pattern: RegExp) => clean.find((item) => pattern.test(item));

  const mainResult =
    startsWith(/^resultado\s+principal:/i) ||
    byPattern(/no\s+se\s+observ|negativ|positivo|compatible|hallazgo\s+principal/i) ||
    null;
  const notExcluded =
    startsWith(/^no\s+descarta:/i) ||
    byPattern(/no\s+descarta|no\s+exclu|falso\s+negativo|ausencia\s+no\s+es\s+excluyente/i) ||
    null;
  const limitation =
    startsWith(/^limitaci[oó]n:/i) ||
    byPattern(/limitaci[oó]n|muestra|representativa|calidad|no\s+concluyente/i) ||
    null;
  const nextStep =
    startsWith(/^siguiente\s+paso:/i) ||
    byPattern(/seguimiento|repetir|control|confirmar|cultivo|l[aá]mpara|citolog|raspado/i) ||
    null;

  return {
    mainResult,
    notExcluded,
    limitation,
    nextStep,
  };
};

const extractVaccineArtifactsFromRecommendations = (recommendations: string[]) => {
  const joined = recommendations.join(" | ");
  const pick = (regex: RegExp): string | null => asStringOrNull(joined.match(regex)?.[1] || null);
  const pickDate = (regex: RegExp): string | null => {
    const raw = asStringOrNull(joined.match(regex)?.[1] || null);
    return raw ? asDateKeyOrNull(raw) : null;
  };

  return {
    product_name: pick(/(?:vacuna|producto)\s*:\s*([^|]+)/i),
    manufacturer: pick(/(?:fabricante|laboratorio|marca)\s*:\s*([^|]+)/i),
    lot_number: pick(/(?:lote|lot)\s*:\s*([a-z0-9\-\/]+)/i),
    serial_number: pick(/(?:serie|serial|n[ºo]\.?\s*serie)\s*:\s*([a-z0-9\-\/]+)/i),
    expiry_date: pickDate(/(?:vto|vencimiento|expiry)\s*:\s*([0-9\/\-]+)/i),
    application_date: pickDate(/(?:aplicaci[oó]n|application)\s*:\s*([0-9\/\-]+)/i),
    revaccination_date: pickDate(/(?:revacunaci[oó]n|refuerzo|pr[oó]xima\s+vacuna)\s*:\s*([0-9\/\-]+)/i),
  };
};

const toIsoDateKey = (value: Date): string =>
  `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, "0")}-${String(value.getUTCDate()).padStart(2, "0")}`;

const addMonthsToDateKey = (dateKey: string | null, months: number): string | null => {
  if (!dateKey || !Number.isFinite(months)) return null;
  const parsed = new Date(`${dateKey}T12:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  parsed.setUTCMonth(parsed.getUTCMonth() + months);
  return toIsoDateKey(parsed);
};

const normalizeConditionLabel = (value: string): string =>
  value
    .replace(/\([^)]*\)/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const deriveProactiveCarePlan = (args: {
  eventDate: string | null;
  documentType: DocumentType;
  sourceDocumentType: MasterClinicalPayload["document_type"];
  diagnosisText: string | null;
  diagnoses: Array<{ condition_name: string | null; severity?: string | null }>;
  medications: MedicationExtracted[];
  recommendations: string[];
  imagingFindings: ProactiveImagingFinding[];
  vaccineArtifacts: MasterClinicalPayload["vaccine_artifacts"] | null;
}): ProactiveCarePlan | null => {
  const isAppointmentOnly =
    args.documentType === "appointment" ||
    args.sourceDocumentType === "medical_appointment" ||
    args.sourceDocumentType === "appointment";

  const chronicSet = new Set<string>();
  for (const item of args.diagnoses) {
    const label = normalizeConditionLabel(asStringOrNull(item.condition_name) || "");
    if (label) chronicSet.add(label);
  }

  const diagnosisText = (args.diagnosisText || "").toLowerCase();
  if (/cardiomiopat/i.test(diagnosisText)) chronicSet.add("Cardiomiopatía");
  if (/displasia/i.test(diagnosisText)) chronicSet.add("Displasia");
  if (/hepatomegalia/i.test(diagnosisText)) chronicSet.add("Hepatomegalia");

  const chronicConditions = Array.from(chronicSet);
  if (
    isAppointmentOnly &&
    chronicConditions.length === 0 &&
    args.medications.length === 0 &&
    args.imagingFindings.length === 0 &&
    !args.vaccineArtifacts?.revaccination_date
  ) {
    return null;
  }

  const alerts: ProactiveCareAlert[] = [];
  if (args.vaccineArtifacts?.revaccination_date) {
    alerts.push({
      type: "vaccine",
      title: `Revacunación${args.vaccineArtifacts.product_name ? ` · ${args.vaccineArtifacts.product_name}` : ""}`,
      dueDate: args.vaccineArtifacts.revaccination_date,
      reason: "Fecha detectada en certificado de vacunación.",
      confidence: "high",
    });
  }

  if (chronicConditions.some((name) => /cardiomiopat/i.test(name))) {
    alerts.push({
      type: "control",
      title: "Control cardiológico",
      dueDate: addMonthsToDateKey(args.eventDate, 3),
      reason: "Condición cardíaca crónica detectada.",
      confidence: "medium",
    });
  }

  if (chronicConditions.some((name) => /displasia/i.test(name))) {
    alerts.push({
      type: "control",
      title: "Control ortopédico / movilidad",
      dueDate: addMonthsToDateKey(args.eventDate, 6),
      reason: "Displasia detectada en historial.",
      confidence: "medium",
    });
  }

  for (const finding of args.imagingFindings) {
    const highImpact = finding.severity === "severo" || finding.severity === "moderado";
    if (!highImpact) continue;
    alerts.push({
      type: "imaging_followup",
      title: `Seguimiento de imagen${finding.region ? ` · ${finding.region}` : ""}`,
      dueDate: addMonthsToDateKey(args.eventDate, finding.severity === "severo" ? 2 : 3),
      reason: finding.finding,
      confidence: finding.confidence,
    });
  }

  if (args.medications.length > 0) {
    alerts.push({
      type: "medication",
      title: "Revisión de plan de medicación",
      dueDate: addMonthsToDateKey(args.eventDate, 1),
      reason: "Se detectó prescripción activa en documento reciente.",
      confidence: "medium",
    });
  }

  const dedupAlertMap = new Map<string, ProactiveCareAlert>();
  for (const alert of alerts) {
    const key = `${alert.type}|${alert.title}|${alert.dueDate || ""}`;
    if (!dedupAlertMap.has(key)) dedupAlertMap.set(key, alert);
  }

  const medicationPlan: ProactiveMedicationPlan[] = args.medications.map((med) => ({
    drug: med.name,
    dosage: med.dosage || null,
    frequency: med.frequency || null,
    duration: med.duration || null,
    confidence: med.confidence,
  }));

  const hasAny =
    dedupAlertMap.size > 0 ||
    chronicConditions.length > 0 ||
    medicationPlan.length > 0 ||
    args.imagingFindings.length > 0;
  if (!hasAny) return null;

  return {
    alerts: Array.from(dedupAlertMap.values()),
    chronicConditions,
    medicationPlan,
    imagingFindings: args.imagingFindings,
  };
};

const asDocumentType = (value: unknown): DocumentType => {
  if (typeof value !== "string") return "other";
  return DOCUMENT_TYPES.includes(value as DocumentType) ? (value as DocumentType) : "other";
};

const asDateKeyOrNull = (value: unknown): string | null => {
  const key = toDateKeySafe(value);
  return key || null;
};

const asAppointmentTimeOrNull = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (/^\d{2}:\d{2}$/.test(trimmed)) return trimmed;

  const match = trimmed.match(/(\d{1,2})\s*[:.h]\s*(\d{2})/i);
  if (match) {
    const hh = Number(match[1]);
    const mm = Number(match[2]);
    if (hh >= 0 && hh <= 23 && mm >= 0 && mm <= 59) {
      return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
    }
  }

  const hourOnlyMatch = trimmed.match(/\b(\d{1,2})\s*hs?\b/i);
  if (hourOnlyMatch) {
    const hh = Number(hourOnlyMatch[1]);
    if (hh >= 0 && hh <= 23) {
      return `${String(hh).padStart(2, "0")}:00`;
    }
  }

  return null;
};

const MAX_CONDITION_NAME_CHARS = 80;

// Extrae el label corto de un término clínico.
// Si el modelo devuelve una frase larga ("Infiltrado intersticial bilateral compatible con..."),
// intentamos aislar la entidad clínica principal antes del primer calificador largo.
const extractShortClinicalLabel = (source: string): string => {
  // Cortar en el primer calificador de extensión ("compatible con", "compatible a", "consistente con",
  // "sugestivo de", "en relación a", "asociado a", "secundario a", "de probable etiología")
  const qualifierPattern = /\b(compatible\s+(con|a)|consistente\s+con|sugestivo\s+de|en\s+relaci[oó]n\s+(a|con)|asociado\s+a|secundario\s+a|de\s+probable|de\s+etiolog[ií]a|sin\s+evidencia\s+de|a\s+descartar)\b/i;
  const qualifierMatch = source.search(qualifierPattern);
  const candidate = qualifierMatch > 8 ? source.slice(0, qualifierMatch).trim() : source;

  // Si aun es largo, cortar en la primera coma o punto que no sea decimal
  const commaOrPeriod = candidate.search(/[,;]|\.\s/);
  const shortened = commaOrPeriod > 8 ? candidate.slice(0, commaOrPeriod).trim() : candidate;

  // Truncar hard al límite
  return shortened.length > MAX_CONDITION_NAME_CHARS
    ? shortened.slice(0, MAX_CONDITION_NAME_CHARS).trimEnd() + "…"
    : shortened;
};

const normalizeClinicalTerm = (value: string): string => {
  const source = value.toLowerCase().trim();
  const dictionary: Array<[RegExp, string]> = [
    // Cardiovascular
    [/cardiomiopat[ií]a\s+dilatada|cmd\b/g, "cardiomiopatia dilatada"],
    [/cardiomiopat[ií]a\s+hipertr[oó]fica|cmh\b/g, "cardiomiopatia hipertrofica"],
    [/insuficiencia\s+card[ií]aca/g, "insuficiencia cardiaca"],
    [/endocardiosis\s+mitral|degeneraci[oó]n\s+mitral/g, "degeneracion valvula mitral"],
    // Hepático / renal
    [/hepatopat[ií]a|enfermedad\s+hep[aá]tica\s+cr[oó]nica?/g, "hepatopatia cronica"],
    [/enfermedad\s+hep[aá]tica/g, "hepatopatia"],
    [/enfermedad\s+renal\s+cr[oó]nica?|erc\b/g, "enfermedad renal cronica"],
    [/fallo\s+renal\s+agudo?|fra\b/g, "fallo renal agudo"],
    // Locomotor
    [/displasia\s+de\s+cadera/g, "displasia de cadera"],
    [/displasia\s+de\s+codo/g, "displasia de codo"],
    [/artritis\s+reumat[oó]nica?/g, "artritis"],
    [/enfermedad\s+articular\s+degenerativa?|osteoartritis/g, "osteoartritis"],
    // Piel
    [/dermatitis\s+at[oó]pica/g, "dermatitis atopica"],
    [/dermatitis\s+al[eé]rgica|alergia\s+cut[aá]nea/g, "dermatitis alergica"],
    [/dermatofitosis|ti[ñn]a/g, "dermatofitosis"],
    // Neurológico
    [/epilepsia\s+idiop[aá]tica/g, "epilepsia idiopatica"],
    [/hernias?\s+discales?|enfermedad\s+discal/g, "hernia discal"],
    // Endocrino / metabólico
    [/diabetes\s+mellitus/g, "diabetes mellitus"],
    [/hipotiroidismo/g, "hipotiroidismo"],
    [/hipertiroidismo/g, "hipertiroidismo"],
    [/hiperadrenocorticismo|s[ií]ndrome\s+de\s+cushing/g, "hiperadrenocorticismo"],
    [/hipoadrenocorticismo|s[ií]ndrome\s+de\s+addison/g, "hipoadrenocorticismo"],
    // Respiratorio
    [/colapso\s+de\s+tr[aá]quea/g, "colapso de traquea"],
    [/neumon[ií]a/g, "neumonia"],
    [/asma\s+(felina|bronquial|veterinaria)/g, "asma bronquial"],
    // Oncológico
    [/tumor\s+de\s+c[eé]lulas\s+cebadas?|mastocitoma/g, "mastocitoma"],
    [/carcinoma\s+de\s+c[eé]lulas\s+escamosas?/g, "carcinoma escamoso"],
    [/adenocarcinoma/g, "adenocarcinoma"],
    [/linfoma/g, "linfoma"],
    // Digestivo
    [/enfermedad\s+inflamatoria\s+intestinal|eii\b/g, "enfermedad inflamatoria intestinal"],
    [/gastroenteritis/g, "gastroenteritis"],
    [/pancreatitis/g, "pancreatitis"],
    // Parasitario / infeccioso
    [/leishmaniasis|leishmaniosis/g, "leishmaniasis"],
    [/dirofilariasis|dirofilariosis/g, "dirofilariasis"],
    [/erliquiosis/g, "erliquiosis"],
    [/leptospirosis/g, "leptospirosis"],
    // Équidos
    [/s[ií]ndrome\s+metab[oó]lico\s+(equino|del\s+caballo)/g, "sindrome metabolico equino"],
    [/laminitis|founder/g, "laminitis"],
    [/c[oó]lico\s+(equino|en\s+caballo)/g, "colico equino"],
    // Lagomorfos / exóticos
    [/[eé]stasis\s+gastrointestinal|gi\s+stasis/g, "estasis gastrointestinal"],
    [/enfermedad\s+dental\s+(en\s+)?(conejo|lagomorfo)|malocluci[oó]n\s+dental/g, "maloclucion dental"],
  ];

  for (const [pattern, normalized] of dictionary) {
    if (pattern.test(source)) return normalized;
  }

  // Para términos no reconocidos: extraer label corto en lugar de copiar texto completo
  return extractShortClinicalLabel(source);
};

const titleFromDocumentType = (documentType: DocumentType): string => {
  const labelMap: Record<DocumentType, string> = {
    vaccine: "Registro de Vacunación",
    appointment: "Turno Médico",
    lab_test: "Resultado de Laboratorio",
    xray: "Estudio Radiográfico",
    echocardiogram: "Ecocardiograma",
    electrocardiogram: "Electrocardiograma",
    surgery: "Informe de Cirugía",
    medication: "Prescripción Médica",
    checkup: "Control Clínico",
    other: "Documento Médico",
  };
  return labelMap[documentType];
};

const mapMasterDocumentType = (value: unknown): DocumentType => {
  const type = asStringOrNull(value);
  if (!type) return "other";
  if (type === "ecografia") return "echocardiogram";
  if (type === "radiografia" || type === "xray" || type === "rx") return "xray";
  if (type === "laboratorio") return "lab_test";
  if (type === "receta") return "medication";
  if (type === "informe") return "checkup";
  if (type === "otro") return "other";
  if (type === "medical_appointment") return "appointment";
  if (type === "clinical_report") return "checkup";
  if (type === "laboratory_result") return "lab_test";
  if (type === "vaccination_record") return "vaccine";
  if (type === "appointment") return "appointment";
  if (type === "lab_result") return "lab_test";
  if (type === "prescription") return "medication";
  if (type === "medical_study") return "checkup";
  return "other";
};

const normalizeToMasterDocumentType = (value: unknown): MasterClinicalPayload["document_type"] => {
  const type = asStringOrNull(value)?.toLowerCase();
  if (!type) return "other";
  if (type === "ecografia") return "medical_study";
  if (type === "radiografia" || type === "xray" || type === "rx") return "medical_study";
  if (type === "laboratorio") return "laboratory_result";
  if (type === "receta") return "prescription";
  if (type === "informe") return "clinical_report";
  if (type === "otro") return "other";
  if (type === "medical_appointment") return "medical_appointment";
  if (type === "clinical_report") return "clinical_report";
  if (type === "laboratory_result") return "laboratory_result";
  if (type === "prescription") return "prescription";
  if (type === "vaccination_record") return "vaccination_record";
  if (type === "appointment") return "appointment";
  if (type === "medical_study") return "medical_study";
  if (type === "lab_result") return "lab_result";
  if (type === "invoice") return "invoice";
  if (type === "other") return "other";
  return "other";
};

const normalizeImagingRegion = (value: unknown): MasterImagingFinding["region"] => {
  const normalized = asStringOrNull(value)?.toLowerCase();
  if (!normalized) return null;
  if (/(t[oó]rax|torax|pecho)/i.test(normalized)) return "torax";
  if (/(abdomen|abdominal)/i.test(normalized)) return "abdomen";
  if (/(pelvis|pelv)/i.test(normalized)) return "pelvis";
  if (/(columna|vertebral|lumb|dors)/i.test(normalized)) return "columna";
  if (/(cadera|coxofemoral|hip)/i.test(normalized)) return "cadera";
  if (/(otro|other)/i.test(normalized)) return "otro";
  return null;
};

const normalizeImagingView = (value: unknown): MasterImagingFinding["view"] => {
  const normalized = asStringOrNull(value)?.toLowerCase();
  if (!normalized) return null;
  if (/(ventrodorsal|\bvd\b|v-d|ventro\s*dorsal)/i.test(normalized)) return "ventrodorsal";
  if (/(dorsoventral|\bdv\b|d-v|dorso\s*ventral)/i.test(normalized)) return "dorsoventral";
  if (/(lateral|latero|\bll\b|l-l)/i.test(normalized)) return "lateral";
  if (/(oblicua|oblique)/i.test(normalized)) return "oblicua";
  if (/(otro|other)/i.test(normalized)) return "otro";
  return null;
};

const normalizeImagingSeverity = (value: unknown): MasterImagingFinding["severity"] => {
  const normalized = asStringOrNull(value)?.toLowerCase();
  if (!normalized) return null;
  if (normalized === "leve") return "leve";
  if (normalized === "moderado" || normalized === "moderada") return "moderado";
  if (normalized === "severo" || normalized === "severa" || normalized === "grave") return "severo";
  if (normalized === "no_especificado" || normalized === "no especificado") return "no_especificado";
  return null;
};

const MEDICATION_SIGNAL_REGEX = /(comprimid|capsul|tableta|pastilla|jarabe|gotas|ampolla|inyecci[oó]n|cada\s+\d+\s*(h|hs|hora|horas)|\b\d+\/\d+\s*comprimido|\b\d+\s*(mg|mcg)\b|pimobendan|ursomax|predni|furosemida|omeprazol|enroflox|amoxic|metronidazol|gabapentin|carprofeno)/i;
const NON_MEDICATION_SIGNAL_REGEX = /(pr[oó]stata|diametr|volumen|vol:|ecograf|radiograf|ultrason|hallazgo|medida|eje|cm\b|mm\b|ml\s*x\s*|sin\s+fractura|sin\s+luxaci[oó]n)/i;

const isLikelyMedicationTreatment = (
  treatment: MasterClinicalPayload["treatments"][number]
): boolean => {
  const name = asStringOrNull(treatment.treatment_name) || "";
  const dosage = asStringOrNull(treatment.dosage) || "";
  const combined = `${name} ${dosage}`.toLowerCase();

  const hasMedicationSignal = MEDICATION_SIGNAL_REGEX.test(combined);
  const hasNonMedicationSignal = NON_MEDICATION_SIGNAL_REGEX.test(combined);

  if (hasNonMedicationSignal && !hasMedicationSignal) return false;
  if (hasMedicationSignal) return true;

  // Requiere al menos nombre corto + dato de dosificación para evitar "hallazgos" como tratamiento.
  if (name && dosage && name.split(/\s+/).length <= 4) return true;
  return false;
};

const isQuantitativeMasterFinding = (finding: MasterClinicalPayload["abnormal_findings"][number]): boolean => {
  return hasNumericSignal(finding.value) || hasNumericSignal(finding.reference_range);
};

const isQualitativeMicroscopyPayload = (payload: MasterClinicalPayload): boolean => {
  const haystack = [
    payload.document_type,
    payload.document_info.record_number,
    payload.document_info.clinic_name,
    ...payload.abnormal_findings.map((finding) => finding.parameter),
    ...payload.abnormal_findings.map((finding) => finding.value),
    ...payload.recommendations,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (!isQualitativeMicroscopyText(haystack)) return false;

  const hasQuantitative = payload.abnormal_findings.some((finding) => isQuantitativeMasterFinding(finding));
  return !hasQuantitative;
};

const inferLegacyDocumentTypeFromMaster = (payload: MasterClinicalPayload): DocumentType => {
  const mapped = mapMasterDocumentType(payload.document_type);
  if (mapped !== "checkup") return mapped;

  const imagingText = (payload.imaging_findings || [])
    .map((item) => [item.region, item.view, item.finding].filter(Boolean).join(" "))
    .join(" ")
    .toLowerCase();
  if (imagingText) {
    if (/(ecocardi|eco\s*card|doppler|mitral|ventricul)/i.test(imagingText)) return "echocardiogram";
    if (/(ecg|electrocardi|ritmo\s*sinusal|qrs|pr\b)/i.test(imagingText)) return "electrocardiogram";
    return "xray";
  }

  const haystack = [
    payload.document_info.record_number,
    payload.document_info.clinic_name,
    payload.document_info.veterinarian_name,
    ...payload.diagnoses.map((diagnosis) => diagnosis.condition_name),
    ...payload.abnormal_findings.map((finding) => finding.parameter),
    ...payload.recommendations,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (/(rx|radiograf|placa|torax dv|torax ld|d-v|l-l)/i.test(haystack)) return "xray";
  if (/(ecocardi|eco cardi|doppler)/i.test(haystack)) return "echocardiogram";
  if (/(ecg|electrocardi|ritmo sinusal)/i.test(haystack)) return "electrocardiogram";
  if (/(laboratorio|hemograma|bioquim|analisis|glucosa|creatinina|urea|alt|ast)/i.test(haystack)) return "lab_test";
  if (/(cirug|quirurg|operatorio|postoperatorio)/i.test(haystack)) return "surgery";
  if (payload.treatments.some((treatment) => isLikelyMedicationTreatment(treatment))) return "medication";
  return "checkup";
};

const buildSummaryFromMaster = (
  documentType: DocumentType,
  sourceDocumentType: MasterClinicalPayload["document_type"],
  diagnosis: string | null,
  treatments: MedicationExtracted[],
  findings: Measurement[],
  recommendations: string[],
  context: {
    petName?: string | null;
    eventDate?: string | null;
    appointmentTime?: string | null;
    appointments?: ExtractedData["detectedAppointments"];
    provider?: string | null;
    clinic?: string | null;
    title?: string | null;
    observations?: string | null;
    vaccineProductName?: string | null;
    vaccineLotNumber?: string | null;
    vaccineExpiryDate?: string | null;
    vaccineRevaccinationDate?: string | null;
  } = {}
): string => {
  const diagnosisText = diagnosis?.replace(/\bno_especificado\b/gi, "").trim() || null;
  const quantitativeFindings = findings.filter((item) =>
    hasNumericSignal(item.value) || hasNumericSignal(item.referenceRange)
  );
  const alteredFindings = quantitativeFindings.filter((item) => /(alto|bajo|alterado|fuera)/i.test(item.referenceRange || ""));
  const petName = asStringOrNull(context.petName) || "la mascota";
  const eventDate = asDateKeyOrNull(context.eventDate) || "fecha no disponible";
  const provider = asStringOrNull(context.provider);
  const clinic = asStringOrNull(context.clinic);
  const whoWhere = [provider, clinic].filter(Boolean).join(" · ");
  const firstAppointment = context.appointments?.[0] || null;
  const appointmentDate = asDateKeyOrNull(firstAppointment?.date) || eventDate;
  const appointmentTime = asAppointmentTimeOrNull(context.appointmentTime || firstAppointment?.time);
  const appointmentReason =
    asStringOrNull(firstAppointment?.title) ||
    asStringOrNull(firstAppointment?.specialty) ||
    asStringOrNull(context.title) ||
    "consulta veterinaria";

  const isAppointmentDocument =
    documentType === "appointment" ||
    sourceDocumentType === "medical_appointment" ||
    sourceDocumentType === "appointment";

  if (isAppointmentDocument) {
    return `Turno programado para ${petName}: ${appointmentReason}, ${appointmentDate}${appointmentTime ? ` a las ${appointmentTime}` : ""}${whoWhere ? `. Centro/profesional: ${whoWhere}` : ""}.`;
  }

  if (documentType === "medication") {
    const first = treatments[0];
    const looksLikePlan = /(plan|sesiones|terapia|hiperb[aá]rica)/i.test(
      [context.title, context.observations, recommendations[0]].filter(Boolean).join(" ")
    );
    if (looksLikePlan && !first) {
      return `Plan de tratamiento registrado para ${petName} con fecha ${eventDate}${whoWhere ? `. Centro/profesional: ${whoWhere}` : ""}.`;
    }
    if (first) {
      const details = [first.dosage, first.frequency, first.duration].filter(Boolean).join(", ");
      return `Tratamiento indicado para ${petName}: ${first.name}${details ? ` (${details})` : ""}. Fecha de receta: ${eventDate}${whoWhere ? `. Prescriptor: ${whoWhere}` : ""}.`;
    }
    return `Receta médica registrada para ${petName} en ${eventDate}${whoWhere ? `. Prescriptor: ${whoWhere}` : ""}.`;
  }

  if (documentType === "xray" || documentType === "echocardiogram" || documentType === "electrocardiogram") {
    if (diagnosisText) return `Según informe por imágenes de ${eventDate}, ${petName} presenta: ${diagnosisText}${whoWhere ? `. Firmado por ${whoWhere}` : ""}.`;
    return `Estudio por imágenes de ${eventDate} para ${petName}. El documento no incluye interpretación clínica explícita${whoWhere ? ` (${whoWhere})` : ""}.`;
  }

  if (documentType === "lab_test") {
    const prioritized = extractPrioritizedClinicalRecommendations(recommendations);
    const findingPhrases = findings
      .map((item) => {
        const name = asStringOrNull(item.name);
        const value = asStringOrNull(item.value);
        if (!name || !value) return null;
        return `${name}: ${value}`;
      })
      .filter(Boolean) as string[];
    const hasQuantitativeSignals = quantitativeFindings.length > 0;
    const negativeQualitative = findingPhrases.filter((line) =>
      /(no\s+se\s+observ|negativ|ausenci|sin\s+evidencia|no\s+compatible)/i.test(line)
    );
    const positiveQualitative = findingPhrases.filter((line) =>
      /(positivo|compatible|presencia|detectad|se\s+observ)/i.test(line) &&
      !/(no\s+se\s+observ|no\s+compatible|sin\s+evidencia)/i.test(line)
    );
    const limitationNote = prioritized.limitation || prioritized.notExcluded;
    const recommendationMain = prioritized.mainResult;

    if (!hasQuantitativeSignals && findingPhrases.length > 0) {
      const mainFinding = negativeQualitative[0] || positiveQualitative[0] || findingPhrases[0];
      const normalizedMainFinding = mainFinding.replace(/[.!?]\s*$/, "");
      const noExclusionText = prioritized.notExcluded
        ? ` No descarta: ${prioritized.notExcluded}.`
        : "";
      const limitationText = limitationNote ? ` Limitación: ${limitationNote}.` : "";
      const nextStepText = prioritized.nextStep ? ` Siguiente paso: ${prioritized.nextStep}.` : "";
      return `Laboratorio de ${eventDate}: ${normalizedMainFinding}.${noExclusionText}${limitationText}${nextStepText}${whoWhere ? ` Laboratorio: ${whoWhere}.` : ""}`.trim();
    }

    if (quantitativeFindings.length > 0) {
      return `Resultado de laboratorio de ${eventDate}: ${alteredFindings.length} de ${quantitativeFindings.length} mediciones fuera de rango${whoWhere ? `. Laboratorio: ${whoWhere}` : ""}.`;
    }
    if (recommendationMain) {
      const normalizedRecommendation = recommendationMain.replace(/[.!?]\s*$/, "");
      const noExclusionText = prioritized.notExcluded
        ? ` No descarta: ${prioritized.notExcluded}.`
        : "";
      const limitationText = limitationNote ? ` Limitación: ${limitationNote}.` : "";
      const nextStepText = prioritized.nextStep ? ` Siguiente paso: ${prioritized.nextStep}.` : "";
      return `Laboratorio de ${eventDate}: ${normalizedRecommendation}.${noExclusionText}${limitationText}${nextStepText}${whoWhere ? ` Laboratorio: ${whoWhere}.` : ""}`.trim();
    }
    return `Laboratorio registrado en ${eventDate}${whoWhere ? `. Laboratorio: ${whoWhere}` : ""}.`;
  }

  if (documentType === "vaccine" || sourceDocumentType === "vaccination_record") {
    const product = asStringOrNull(context.vaccineProductName);
    const lot = asStringOrNull(context.vaccineLotNumber);
    const expiry = asDateKeyOrNull(context.vaccineExpiryDate);
    const revaccination = asDateKeyOrNull(context.vaccineRevaccinationDate);
    const detailTokens = [
      product ? `vacuna ${product}` : null,
      lot ? `lote ${lot}` : null,
      expiry ? `vto ${expiry}` : null,
    ].filter(Boolean);
    const details = detailTokens.length > 0 ? ` (${detailTokens.join(", ")})` : "";
    const revaccinationText = revaccination ? ` Próxima revacunación: ${revaccination}.` : "";
    return `Registro de vacunación para ${petName} en ${eventDate}${details}${whoWhere ? `. Aplicada en ${whoWhere}` : ""}.${revaccinationText}`.trim();
  }

  if (diagnosisText) {
    return `Informe clínico de ${eventDate}: ${petName} presenta ${diagnosisText}${whoWhere ? `. Atención en ${whoWhere}` : ""}.`;
  }

  const recommendation = recommendations[0] ? `Recomendación registrada: ${recommendations[0]}.` : "";
  return (`Documento clínico de ${petName} cargado en ${eventDate}. ${recommendation}`).trim();
};

const inferAppointmentByContent = (params: {
  documentType: DocumentType;
  title: string | null;
  observations: string | null;
  diagnosis: string | null;
  eventDate: string | null;
  appointmentTime: string | null;
  detectedAppointments: ExtractedData["detectedAppointments"];
}): boolean => {
  const blockedByType: DocumentType[] = [
    "medication",
    "lab_test",
    "xray",
    "echocardiogram",
    "electrocardiogram",
    "vaccine",
    "surgery",
  ];
  if (blockedByType.includes(params.documentType)) return false;

  const haystack = [
    params.title,
    params.observations,
    params.diagnosis,
  ].filter(Boolean).join(" ").toLowerCase();

  const likelyClinicalResult = /(receta|prescrip|comprimido|cada\s+\d+\s*(h|hora|horas)|diagn[oó]stico|hallazgo|medici[oó]n|resultado|valor|vacun|se detecta|presenta)/i.test(
    haystack
  );
  const hasAppointmentKeywords = APPOINTMENT_HINT_REGEX.test(haystack);
  const hasScheduleData = Boolean(
    params.eventDate && (params.appointmentTime || /\b\d{1,2}[:.]\d{2}\b/.test(haystack))
  );
  const hasDetectedAppointmentSignals = (params.detectedAppointments || []).some((item) => {
    const text = [item.title, item.specialty, item.clinic, item.provider].filter(Boolean).join(" ").toLowerCase();
    return Boolean(item.date && (item.time || APPOINTMENT_HINT_REGEX.test(text)));
  });

  if (likelyClinicalResult && !hasAppointmentKeywords) return false;
  if (params.documentType === "appointment") return true;
  return (hasAppointmentKeywords || hasDetectedAppointmentSignals) && hasScheduleData;
};

const toMasterPayload = (value: Record<string, unknown>): MasterClinicalPayload => {
  const pet = asObject(value.pet);
  const documentInfoLegacy = asObject(value.document_info);
  const documentInfoV2 = asObject(value.document);
  const documentInfo = Object.keys(documentInfoV2).length > 0 ? documentInfoV2 : documentInfoLegacy;
  const appointmentEventRaw = asObject(value.appointment_event);
  const topLevelAppointmentEvent = asStringOrNull(value.event_type) === "medical_appointment";
  const diagnoses = asArray(value.diagnoses_detected ?? value.diagnoses).map((item) => {
    if (typeof item === "string") {
      return {
        condition_name: asStringOrNull(item),
        organ_system: null,
        classification: null,
        severity: "no_especificado" as const,
      };
    }
    const row = asObject(item);
    return {
      condition_name: asStringOrNull(row.condition_name ?? row.name),
      organ_system: asStringOrNull(row.organ_system ?? row.system),
      classification: asStringOrNull(row.classification ?? row.status) as MasterClinicalPayload["diagnoses"][number]["classification"],
      severity: asStringOrNull(row.severity) as MasterClinicalPayload["diagnoses"][number]["severity"],
    };
  });

  const abnormalFindings = asArray(value.abnormal_findings).map((item) => {
    if (typeof item === "string") {
      return {
        parameter: asStringOrNull(item),
        value: null,
        reference_range: null,
        status: null,
      };
    }
    const row = asObject(item);
    return {
      parameter: asStringOrNull(row.parameter ?? row.name),
      value: asStringOrNull(row.value ?? row.result),
      reference_range: asStringOrNull(row.reference_range ?? row.range),
      status: normalizeFindingStatus(row.status ?? row.interpretation),
    };
  });
  const imagingFindings = asArray(value.imaging_findings ?? value.radiology_findings ?? value.imagingFindings).map((item) => {
    if (typeof item === "string") {
      return {
        region: null,
        view: null,
        finding: asStringOrNull(item),
        severity: "no_especificado" as const,
      };
    }
    const row = asObject(item);
    return {
      region: normalizeImagingRegion(row.region ?? row.area),
      view: normalizeImagingView(row.view ?? row.projection),
      finding: asStringOrNull(row.finding ?? row.hallazgo ?? row.description),
      severity: normalizeImagingSeverity(row.severity),
    };
  }).filter((item) => Boolean(item.finding));

  const treatments = asArray(value.treatments_detected ?? value.treatments).map((item) => {
    if (typeof item === "string") {
      return {
        treatment_name: asStringOrNull(item),
        start_date: null,
        end_date: null,
        dosage: null,
        status: "desconocido" as const,
      };
    }
    const row = asObject(item);
    return {
      treatment_name: asStringOrNull(row.treatment_name ?? row.name),
      start_date: asDateKeyOrNull(row.start_date ?? row.startDate),
      end_date: asDateKeyOrNull(row.end_date ?? row.endDate),
      dosage: asStringOrNull(row.dosage ?? row.dose),
      status: asStringOrNull(row.status) as MasterClinicalPayload["treatments"][number]["status"],
    };
  });

  const appointments = asArray(value.appointments).map((item) => {
    if (typeof item === "string") {
      return {
        date: null,
        time: null,
        specialty: null,
        procedure: asStringOrNull(item),
        clinic_name: null,
        clinic_address: null,
        professional_name: null,
        status: "recordatorio" as const,
      };
    }
    const row = asObject(item);
    const rawStatus = asStringOrNull(row.status);
    return {
      date: asDateKeyOrNull(row.date ?? row.event_date),
      time: asAppointmentTimeOrNull(row.time ?? row.hour),
      specialty: asStringOrNull(row.specialty ?? row.area),
      procedure: asStringOrNull(row.procedure ?? row.title),
      clinic_name: asStringOrNull(row.clinic_name ?? row.clinic),
      clinic_address: asStringOrNull(row.clinic_address ?? row.address),
      professional_name: asStringOrNull(row.professional_name ?? row.provider),
      status: (rawStatus === "scheduled" ? "programado" : rawStatus) as MasterClinicalPayload["appointments"][number]["status"],
    };
  });

  const appointmentEvent = (() => {
    const source = Object.keys(appointmentEventRaw).length > 0 ? appointmentEventRaw : value;
    if (asStringOrNull(source.event_type) !== "medical_appointment") return null;
    const statusRaw = asStringOrNull(source.status);
    return {
      event_type: "medical_appointment" as const,
      date: asDateKeyOrNull(source.date ?? source.event_date),
      time: asAppointmentTimeOrNull(source.time ?? source.hour),
      specialty: asStringOrNull(source.specialty),
      procedure: asStringOrNull(source.procedure ?? source.title),
      clinic: asStringOrNull(source.clinic ?? source.clinic_name ?? source.center ?? source.centro),
      address: asStringOrNull(source.address ?? source.clinic_address),
      professional_name: asStringOrNull(source.professional_name ?? source.provider ?? source.veterinarian_name),
      preparation_required: asStringOrNull(source.preparation_required ?? source.preparation ?? source.instructions),
      status: (statusRaw === "programado" ? "scheduled" : statusRaw) as any,
    };
  })();
  const vaccineArtifactsRaw = asObject(value.vaccine_artifacts);
  const vaccineArtifactsFromRec = extractVaccineArtifactsFromRecommendations(
    asArray(value.medical_recommendations ?? value.recommendations)
      .map((item) => asStringOrNull(item))
      .filter(Boolean) as string[]
  );
  const vaccineArtifacts = {
    sticker_detected: asBooleanOrNull(
      vaccineArtifactsRaw.sticker_detected ?? vaccineArtifactsRaw.troquel_detected ?? value.sticker_detected
    ),
    stamp_detected: asBooleanOrNull(
      vaccineArtifactsRaw.stamp_detected ?? vaccineArtifactsRaw.sello_detected ?? value.stamp_detected
    ),
    signature_detected: asBooleanOrNull(
      vaccineArtifactsRaw.signature_detected ?? vaccineArtifactsRaw.firma_detected ?? value.signature_detected
    ),
    product_name: asStringOrNull(vaccineArtifactsRaw.product_name ?? vaccineArtifactsRaw.vaccine_name ?? vaccineArtifactsFromRec.product_name),
    manufacturer: asStringOrNull(vaccineArtifactsRaw.manufacturer ?? vaccineArtifactsRaw.laboratory ?? vaccineArtifactsFromRec.manufacturer),
    lot_number: asStringOrNull(vaccineArtifactsRaw.lot_number ?? vaccineArtifactsRaw.lote ?? vaccineArtifactsFromRec.lot_number),
    serial_number: asStringOrNull(vaccineArtifactsRaw.serial_number ?? vaccineArtifactsRaw.serie ?? vaccineArtifactsFromRec.serial_number),
    expiry_date: asDateKeyOrNull(vaccineArtifactsRaw.expiry_date ?? vaccineArtifactsRaw.vto ?? vaccineArtifactsFromRec.expiry_date),
    application_date: asDateKeyOrNull(vaccineArtifactsRaw.application_date ?? vaccineArtifactsRaw.applied_date ?? vaccineArtifactsFromRec.application_date),
    revaccination_date: asDateKeyOrNull(vaccineArtifactsRaw.revaccination_date ?? vaccineArtifactsRaw.next_due_date ?? vaccineArtifactsFromRec.revaccination_date),
  };

  const mergedAppointments = [...appointments];
  if (appointmentEvent?.date) {
    mergedAppointments.unshift({
      date: appointmentEvent.date,
      time: appointmentEvent.time,
      specialty: appointmentEvent.specialty,
      procedure: appointmentEvent.procedure,
      clinic_name: appointmentEvent.clinic,
      clinic_address: appointmentEvent.address,
      professional_name: appointmentEvent.professional_name,
      status: appointmentEvent.status === "scheduled" ? "programado" : appointmentEvent.status,
    });
  }

  const recommendationsSource = asArray(value.medical_recommendations ?? value.recommendations);
  const vaccineRecommendationLines = [
    vaccineArtifacts.product_name ? `Producto vacuna: ${vaccineArtifacts.product_name}` : null,
    vaccineArtifacts.manufacturer ? `Fabricante: ${vaccineArtifacts.manufacturer}` : null,
    vaccineArtifacts.lot_number ? `Lote: ${vaccineArtifacts.lot_number}` : null,
    vaccineArtifacts.serial_number ? `Serie: ${vaccineArtifacts.serial_number}` : null,
    vaccineArtifacts.expiry_date ? `Vto: ${vaccineArtifacts.expiry_date}` : null,
    vaccineArtifacts.revaccination_date ? `Revacunación: ${vaccineArtifacts.revaccination_date}` : null,
    vaccineArtifacts.sticker_detected === true ? "Troquel detectado: sí" : null,
    vaccineArtifacts.stamp_detected === true ? "Sello detectado: sí" : null,
    vaccineArtifacts.signature_detected === true ? "Firma detectada: sí" : null,
  ].filter(Boolean) as string[];
  const requestedDocumentType = topLevelAppointmentEvent
    ? "medical_appointment"
    : (asStringOrNull(value.document_type) ?? asStringOrNull(documentInfo.type));
  let normalizedDocumentType = normalizeToMasterDocumentType(requestedDocumentType);

  const hasClinicalPayload =
    diagnoses.some((row) => Boolean(row.condition_name)) ||
    abnormalFindings.some((row) => Boolean(row.parameter || row.value)) ||
    imagingFindings.some((row) => Boolean(row.finding)) ||
    treatments.some((row) => Boolean(row.treatment_name || row.dosage));
  if ((normalizedDocumentType === "medical_appointment" || normalizedDocumentType === "appointment") && hasClinicalPayload) {
    if (treatments.some((row) => Boolean(row.treatment_name || row.dosage))) {
      normalizedDocumentType = "prescription";
    } else if (abnormalFindings.some((row) => Boolean(row.parameter || row.value))) {
      normalizedDocumentType = "laboratory_result";
    } else if (imagingFindings.some((row) => Boolean(row.finding))) {
      normalizedDocumentType = "medical_study";
    } else {
      normalizedDocumentType = "clinical_report";
    }
  }

  return {
    document_type: normalizedDocumentType,
    pet: {
      name: asStringOrNull(pet.name),
      species: asStringOrNull(pet.species),
      breed: asStringOrNull(pet.breed),
      age_at_document: asStringOrNull(pet.age_at_document ?? pet.age),
      owner: asStringOrNull(pet.owner ?? documentInfo.owner),
    },
    document_info: {
      date: asDateKeyOrNull(documentInfo.study_date ?? documentInfo.date ?? documentInfo.document_date),
      clinic_name: asStringOrNull(documentInfo.clinic_name),
      clinic_address: asStringOrNull(documentInfo.clinic_address),
      veterinarian_name: asStringOrNull(documentInfo.veterinarian_name ?? documentInfo.vet_name),
      veterinarian_license: asStringOrNull(documentInfo.veterinarian_license),
      record_number: asStringOrNull(documentInfo.protocol_or_record_number ?? documentInfo.record_number ?? documentInfo.study_type),
    },
    diagnoses,
    abnormal_findings: abnormalFindings,
    imaging_findings: imagingFindings,
    treatments,
    appointments: mergedAppointments,
    recommendations: [
      ...(recommendationsSource.map((item) => asStringOrNull(item)).filter(Boolean) as string[]),
      ...vaccineRecommendationLines,
    ],
    requires_followup: Boolean(value.requires_followup),
    vaccine_artifacts:
      Object.values(vaccineArtifacts).some((value) => value !== null && value !== "")
        ? vaccineArtifacts
        : null,
    appointment_event: appointmentEvent,
  };
};

const isMasterProtocolPayload = (value: Record<string, unknown>): boolean => {
  const hasLegacy = typeof value.document_type === "string" && value.document_info != null && value.pet != null;
  const documentV2 = asObject(value.document);
  const hasV2 = value.pet != null && typeof documentV2.type === "string";
  return hasLegacy || hasV2;
};

const isAppointmentEventPayload = (value: Record<string, unknown>): boolean => {
  if (asStringOrNull(value.event_type) === "medical_appointment") return true;
  const nested = asObject(value.appointment_event);
  return asStringOrNull(nested.event_type) === "medical_appointment";
};

const mapMasterPayloadToLegacy = (payload: MasterClinicalPayload): Record<string, unknown> => {
  const documentType = inferLegacyDocumentTypeFromMaster(payload);
  const appointmentEvent = payload.appointment_event || null;
  const vaccineArtifacts = payload.vaccine_artifacts || null;
  const sourceDocumentType = payload.document_type;
  const canExtractDiagnoses = ["clinical_report", "laboratory_result", "medical_study", "lab_result"].includes(sourceDocumentType);
  const isQualitativeMicroscopy = canExtractDiagnoses && isQualitativeMicroscopyPayload(payload);

  const normalizedDiagnoses = (canExtractDiagnoses ? payload.diagnoses : [])
    .map((entry) => ({
      ...entry,
      condition_name: entry.condition_name ? normalizeClinicalTerm(entry.condition_name) : null,
    }))
    .filter((entry) => Boolean(entry.condition_name));

  let diagnosis = normalizedDiagnoses.length > 0
    ? normalizedDiagnoses
      .map((entry) => {
        const details = [entry.organ_system, entry.classification, entry.severity]
          .filter(Boolean)
          .join(", ");
        return details ? `${entry.condition_name} (${details})` : entry.condition_name;
      })
      .join("; ")
    : null;

  const primaryQualitativeFinding = isQualitativeMicroscopy
    ? payload.abnormal_findings.find((finding) =>
      isNoObservedPathogenFinding(finding.value) || isNoObservedPathogenFinding(finding.parameter)
    ) || payload.abnormal_findings[0] || null
    : null;

  const measurements: Measurement[] = isQualitativeMicroscopy
    ? (() => {
      const primaryValue = asStringOrNull(primaryQualitativeFinding?.value);
      const primaryLabel = asStringOrNull(primaryQualitativeFinding?.parameter) || "Pelos, OD con KOH";
      if (!primaryValue) return [];
      return [{
        name: primaryLabel,
        value: primaryValue,
        unit: null,
        referenceRange: null,
        confidence: "high" as const,
      }];
    })()
    : (canExtractDiagnoses ? payload.abnormal_findings : [])
      .map((finding) => {
        if (!finding.parameter || !finding.value) return null;
        const isQuantitative = isQuantitativeMasterFinding(finding);
        const baseRange = isQuantitative ? asStringOrNull(finding.reference_range) : null;
        const status = isQuantitative ? findingStatusLabel(finding.status) : null;
        return {
          name: finding.parameter,
          value: finding.value,
          unit: null,
          referenceRange: [baseRange, status].filter(Boolean).join(" · ") || null,
          confidence: "high",
        };
      })
      .filter(Boolean) as Measurement[];
  const imagingFindings: ProactiveImagingFinding[] = (payload.imaging_findings || [])
    .map((item) => {
      if (!item?.finding) return null;
      return {
        region: item.region || null,
        view: item.view || null,
        finding: item.finding,
        severity: item.severity || "no_especificado",
        confidence: "high" as const,
      };
    })
    .filter(Boolean) as ProactiveImagingFinding[];
  if (!diagnosis && imagingFindings.length > 0) {
    diagnosis = imagingFindings.slice(0, 3).map((item) => item.finding).join("; ");
  }

  const medications: MedicationExtracted[] = (documentType === "appointment"
    ? []
    : payload.treatments.filter((treatment) => isLikelyMedicationTreatment(treatment)))
    .map((treatment) => {
      if (!treatment.treatment_name) return null;
      const dosage = treatment.dosage || null;
      const frequencyFromDosage = dosage ? asStringOrNull(dosage.match(/cada\s+\d+\s*horas?/i)?.[0] || null) : null;
      const duration =
        treatment.start_date && treatment.end_date
          ? `${treatment.start_date} a ${treatment.end_date}`
          : treatment.status === "activo"
            ? "indefinido"
            : null;

      return {
        name: treatment.treatment_name,
        dosage,
        frequency: frequencyFromDosage,
        duration,
        confidence: "high",
      };
    })
    .filter(Boolean) as MedicationExtracted[];

  const detectedAppointments = payload.appointments
    .map((appointment) => {
      if (!appointment.date) return null;
      return {
        date: appointment.date,
        time: appointment.time,
        title: appointment.procedure,
        specialty: appointment.specialty,
        clinic: appointment.clinic_name,
        provider: appointment.professional_name,
        confidence: "high" as const,
      };
    })
    .filter(Boolean) as ExtractedData["detectedAppointments"];

  if (appointmentEvent?.date) {
    const exists = detectedAppointments.some(
      (item) =>
        item.date === appointmentEvent.date &&
        (item.time || null) === (appointmentEvent.time || null)
    );
    if (!exists) {
      detectedAppointments.unshift({
        date: appointmentEvent.date,
        time: appointmentEvent.time,
        title: appointmentEvent.procedure || appointmentEvent.specialty || "Turno médico",
        specialty: appointmentEvent.specialty,
        clinic: appointmentEvent.clinic,
        provider: appointmentEvent.professional_name,
        confidence: "high",
      });
    }
  }

  const firstAppointment = detectedAppointments[0] || null;
  const eventDate = appointmentEvent?.date || payload.document_info.date || firstAppointment?.date || null;
  const appointmentTime = documentType === "appointment"
    ? (appointmentEvent?.time || firstAppointment?.time || null)
    : null;

  const isAppointmentDocument = documentType === "appointment";
  const nextAppointment = !isAppointmentDocument
    ? detectedAppointments.find((item) => {
      const timestamp = toTimestampSafe(item.date);
      return timestamp >= Date.now() - 24 * 60 * 60 * 1000;
    }) || null
    : null;

  const qualitativeSecondaryFindings = isQualitativeMicroscopy
    ? payload.abnormal_findings
      .filter((finding) => finding !== primaryQualitativeFinding)
      .map((finding) => {
        const parameter = asStringOrNull(finding.parameter);
        const value = asStringOrNull(finding.value);
        if (!parameter || !value) return null;
        return `${parameter}: ${value}`;
      })
      .filter(Boolean) as string[]
    : [];

  const qualitativeLimitation = isQualitativeMicroscopy
    ? (
      payload.abnormal_findings
        .map((finding) => asStringOrNull(finding.value))
        .find((value) => /ausencia\s+no\s+es\s+excluyente|no\s+excluyente|no\s+descarta/i.test(value || "")) ||
      payload.recommendations.find((value) => /ausencia\s+no\s+es\s+excluyente|no\s+excluyente|no\s+descarta/i.test(value || "")) ||
      null
    )
    : null;

  const recommendations = [...(payload.recommendations || [])];
  if (isQualitativeMicroscopy) {
    const primaryValue = asStringOrNull(primaryQualitativeFinding?.value);
    if (
      primaryValue &&
      !recommendations.some((item) => /resultado\s+principal:|no\s+se\s+observ|dermatofit|ectoparasit/i.test(item))
    ) {
      recommendations.unshift(`Resultado principal: ${primaryValue}`);
    }
    if (
      qualitativeLimitation &&
      !recommendations.some((item) => /no\s+descarta:|no\s+exclu|ausencia\s+no\s+es\s+excluyente/i.test(item))
    ) {
      recommendations.push(`No descarta: ${qualitativeLimitation}`);
    }
  }
  const prioritized = extractPrioritizedClinicalRecommendations(recommendations);
  const qualitativeFindings = (isQualitativeMicroscopy ? qualitativeSecondaryFindings : payload.abnormal_findings
    .map((finding) => {
      const parameter = asStringOrNull(finding.parameter);
      const value = asStringOrNull(finding.value);
      if (!parameter || !value) return null;
      return `${parameter}: ${value}`;
    })
    .filter(Boolean)) as string[];
  const cautionNotes = recommendations
    .filter((item) =>
      /(no\s+exclu|no\s+descarta|ausencia\s+no\s+es\s+excluyente|falso\s+negativo|limitaci[oó]n)/i.test(item)
    )
    .slice(0, 2);
  const observationsParts = [
    payload.document_info.record_number ? `Registro: ${payload.document_info.record_number}` : null,
    appointmentEvent?.address ? `Dirección: ${appointmentEvent.address}` : null,
    appointmentEvent?.preparation_required ? `Preparación: ${appointmentEvent.preparation_required}` : null,
    vaccineArtifacts?.product_name ? `Vacuna: ${vaccineArtifacts.product_name}` : null,
    vaccineArtifacts?.manufacturer ? `Fabricante: ${vaccineArtifacts.manufacturer}` : null,
    vaccineArtifacts?.lot_number ? `Lote: ${vaccineArtifacts.lot_number}` : null,
    vaccineArtifacts?.serial_number ? `Serie: ${vaccineArtifacts.serial_number}` : null,
    vaccineArtifacts?.expiry_date ? `Vto: ${vaccineArtifacts.expiry_date}` : null,
    vaccineArtifacts?.revaccination_date ? `Revacunación: ${vaccineArtifacts.revaccination_date}` : null,
    vaccineArtifacts?.sticker_detected === true ? "Troquel detectado" : null,
    vaccineArtifacts?.stamp_detected === true ? "Sello detectado" : null,
    vaccineArtifacts?.signature_detected === true ? "Firma detectada" : null,
    imagingFindings.length > 0
      ? `Imágenes: ${imagingFindings
        .slice(0, 4)
        .map((item) => [item.region, item.view, item.finding].filter(Boolean).join(" · "))
        .join(" | ")}`
      : null,
    isQualitativeMicroscopy && qualitativeSecondaryFindings.length > 0
      ? `Tricograma y observaciones: ${qualitativeSecondaryFindings.join(" | ")}`
      : null,
    qualitativeFindings.length > 0 ? `Hallazgos: ${qualitativeFindings.slice(0, 5).join(" | ")}` : null,
    prioritized.mainResult ? `Resultado principal: ${prioritized.mainResult}` : null,
    prioritized.notExcluded ? `No descarta: ${prioritized.notExcluded}` : null,
    cautionNotes.length > 0 ? `Limitaciones: ${cautionNotes.join(" | ")}` : null,
    prioritized.nextStep ? `Siguiente paso: ${prioritized.nextStep}` : null,
    recommendations.length > 0 ? `Recomendaciones: ${recommendations.join(" | ")}` : null,
  ].filter(Boolean);
  const provider = appointmentEvent?.professional_name || payload.document_info.veterinarian_name;
  const clinic = appointmentEvent?.clinic || payload.document_info.clinic_name;

  const aiGeneratedSummary = isAppointmentDocument
    ? buildSummaryFromMaster(
      documentType,
      sourceDocumentType,
      diagnosis,
      medications,
      measurements,
      recommendations,
      {
        petName: payload.pet.name,
        eventDate,
        appointmentTime,
        appointments: detectedAppointments,
        provider,
        clinic,
        title: appointmentEvent?.procedure,
        observations: appointmentEvent?.preparation_required,
      }
    )
    : buildSummaryFromMaster(
      documentType,
      sourceDocumentType,
      diagnosis,
      medications,
      measurements,
      recommendations,
      {
        petName: payload.pet.name,
        eventDate,
        appointmentTime,
        appointments: detectedAppointments,
        provider,
        clinic,
        title: payload.document_info.record_number,
        observations: observationsParts.join(". "),
        vaccineProductName: vaccineArtifacts?.product_name || null,
        vaccineLotNumber: vaccineArtifacts?.lot_number || null,
        vaccineExpiryDate: vaccineArtifacts?.expiry_date || null,
        vaccineRevaccinationDate: vaccineArtifacts?.revaccination_date || null,
      }
    );
  const suggestedTitle = (isAppointmentDocument
    ? (appointmentEvent?.procedure || appointmentEvent?.specialty || firstAppointment?.title || "Turno médico")
    : firstAppointment?.title)
    || medications[0]?.name
    || normalizedDiagnoses[0]?.condition_name
    || (isQualitativeMicroscopy ? "Microscopía dermatológica (KOH)" : null)
    || titleFromDocumentType(documentType);
  const proactiveCarePlan = deriveProactiveCarePlan({
    eventDate,
    documentType,
    sourceDocumentType,
    diagnosisText: diagnosis,
    diagnoses: normalizedDiagnoses,
    medications,
    recommendations,
    imagingFindings,
    vaccineArtifacts,
  });

  return {
    documentType,
    documentTypeConfidence: "high",
    eventDate,
    eventDateConfidence: eventDate ? "high" : "not_detected",
    appointmentTime,
    detectedAppointments,
    provider,
    providerConfidence: provider ? "high" : "not_detected",
    clinic,
    diagnosis: isAppointmentDocument ? null : diagnosis,
    diagnosisConfidence: isAppointmentDocument ? "not_detected" : (diagnosis ? "high" : "not_detected"),
    observations: observationsParts.join(". ") || null,
    observationsConfidence: observationsParts.length > 0 ? "medium" : "not_detected",
    medications,
    nextAppointmentDate: isAppointmentDocument
      ? null
      : (nextAppointment?.date || vaccineArtifacts?.revaccination_date || null),
    nextAppointmentReason: isAppointmentDocument
      ? null
      : nextAppointment
        ? `Seguimiento sugerido: ${nextAppointment.title || nextAppointment.specialty || "control"}`
        : (recommendations[0] || (vaccineArtifacts?.revaccination_date ? "Revacunación sugerida por certificado." : null)),
    nextAppointmentConfidence: isAppointmentDocument
      ? "not_detected"
      : (nextAppointment ? "high" : (recommendations.length > 0 ? "medium" : "not_detected")),
    suggestedTitle,
    aiGeneratedSummary,
    measurements: isAppointmentDocument ? [] : measurements,
    vaccineProductName: vaccineArtifacts?.product_name || null,
    vaccineManufacturer: vaccineArtifacts?.manufacturer || null,
    vaccineLotNumber: vaccineArtifacts?.lot_number || null,
    vaccineSerialNumber: vaccineArtifacts?.serial_number || null,
    vaccineExpiryDate: vaccineArtifacts?.expiry_date || null,
    vaccineApplicationDate: vaccineArtifacts?.application_date || null,
    vaccineRevaccinationDate: vaccineArtifacts?.revaccination_date || null,
    vaccineStickerDetected: vaccineArtifacts?.sticker_detected ?? null,
    vaccineStampDetected: vaccineArtifacts?.stamp_detected ?? null,
    vaccineSignatureDetected: vaccineArtifacts?.signature_detected ?? null,
    proactiveCarePlan,
    masterClinical: payload,
    extractionProtocol: "pessy_clinical_processing_protocol_v1",
  };
};

const sanitizeDetectedAppointments = (
  value: unknown,
  fallbackFields: {
    eventDate: string | null;
    appointmentTime: string | null;
    title: string | null;
    clinic: string | null;
    provider: string | null;
    allowDateFallback: boolean;
  }
): ExtractedData["detectedAppointments"] => {
  const fromArray = Array.isArray(value)
    ? value
      .map((item) => {
        const row = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
        const date = asDateKeyOrNull(row.date ?? row.eventDate);
        const time = asAppointmentTimeOrNull(row.time ?? row.appointmentTime);
        const title = asStringOrNull(row.title ?? row.reason ?? row.prestacion ?? row.specialty);
        const specialty = asStringOrNull(row.specialty ?? row.especialidad);
        const clinic = asStringOrNull(row.clinic ?? row.center ?? row.centro);
        const provider = asStringOrNull(row.provider ?? row.professional ?? row.veterinarian);
        const confidence = asConfidence(row.confidence);

        if (!date) return null;

        return {
          date,
          time,
          title,
          specialty,
          clinic,
          provider,
          confidence,
        };
      })
      .filter(Boolean)
    : [];

  if (fromArray.length > 0) {
    return fromArray as ExtractedData["detectedAppointments"];
  }

  if (fallbackFields.allowDateFallback && fallbackFields.eventDate) {
    return [{
      date: fallbackFields.eventDate,
      time: fallbackFields.appointmentTime,
      title: fallbackFields.title || "Turno médico",
      specialty: null,
      clinic: fallbackFields.clinic,
      provider: fallbackFields.provider,
      confidence: "medium",
    }];
  }

  return [];
};

const normalizeProactiveAlertType = (value: unknown): ProactiveCareAlert["type"] => {
  const normalized = asStringOrNull(value)?.toLowerCase();
  if (!normalized) return "control";
  if (normalized === "vaccine" || /vacun|revacun|antirr[aá]b/i.test(normalized)) return "vaccine";
  if (normalized === "medication" || /medic|dosis|pastill|tableta|comp/i.test(normalized)) return "medication";
  if (normalized === "imaging_followup" || /imag|radiograf|eco|rx/.test(normalized)) return "imaging_followup";
  return "control";
};

const sanitizeProactiveImagingFindings = (value: unknown): ProactiveImagingFinding[] =>
  asArray(value)
    .map((item) => {
      const row = asObject(item);
      const finding = asStringOrNull(row.finding ?? row.hallazgo ?? row.description);
      if (!finding) return null;
      const normalizedRegion = normalizeImagingRegion(row.region ?? row.area);
      const normalizedView = normalizeImagingView(row.view ?? row.projection);
      return {
        region: normalizedRegion || asStringOrNull(row.region ?? row.area),
        view: normalizedView || asStringOrNull(row.view ?? row.projection),
        finding,
        severity: normalizeImagingSeverity(row.severity),
        confidence: asConfidence(row.confidence),
      };
    })
    .filter(Boolean) as ProactiveImagingFinding[];

const sanitizeProactiveCarePlan = (value: unknown): ProactiveCarePlan | null => {
  const parsed = asObject(value);
  if (Object.keys(parsed).length === 0) return null;

  const alerts = asArray(parsed.alerts)
    .map((item) => {
      const row = asObject(item);
      const title = asStringOrNull(row.title);
      if (!title) return null;
      return {
        type: normalizeProactiveAlertType(row.type),
        title,
        dueDate: asDateKeyOrNull(row.dueDate ?? row.due_date ?? row.date),
        reason: asStringOrNull(row.reason),
        confidence: asConfidence(row.confidence),
      };
    })
    .filter(Boolean) as ProactiveCareAlert[];

  const chronicConditions = asArray(parsed.chronicConditions ?? parsed.chronic_conditions)
    .map((item) => asStringOrNull(item))
    .filter(Boolean) as string[];

  const medicationPlan = asArray(parsed.medicationPlan ?? parsed.medication_plan)
    .map((item) => {
      const row = asObject(item);
      const drug = asStringOrNull(row.drug ?? row.name);
      if (!drug) return null;
      return {
        drug,
        dosage: asStringOrNull(row.dosage),
        frequency: asStringOrNull(row.frequency),
        duration: asStringOrNull(row.duration),
        confidence: asConfidence(row.confidence),
      };
    })
    .filter(Boolean) as ProactiveMedicationPlan[];

  const imagingFindings = sanitizeProactiveImagingFindings(
    parsed.imagingFindings ?? parsed.imaging_findings
  );

  const hasAny =
    alerts.length > 0 ||
    chronicConditions.length > 0 ||
    medicationPlan.length > 0 ||
    imagingFindings.length > 0;
  if (!hasAny) return null;

  return {
    alerts,
    chronicConditions,
    medicationPlan,
    imagingFindings,
  };
};

const sanitizeExtractedData = (raw: unknown, fallbackRawText = ""): ExtractedData => {
  const parsed = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const fallback = buildSafeFallbackExtraction(fallbackRawText);
  const eventDate = asDateKeyOrNull(parsed.eventDate);
  const appointmentTime = asAppointmentTimeOrNull(parsed.appointmentTime);
  const provider = asStringOrNull(parsed.provider);
  const clinic = asStringOrNull(parsed.clinic);
  const suggestedTitle = asStringOrNull(parsed.suggestedTitle) || fallback.suggestedTitle;
  const rawDocumentType = asDocumentType(parsed.documentType);
  const parsedMasterClinical =
    parsed.masterClinical && typeof parsed.masterClinical === "object"
      ? (parsed.masterClinical as MasterClinicalPayload)
      : null;
  const masterClinical = asObject(parsedMasterClinical);
  const masterDocumentType = asStringOrNull(masterClinical.document_type)?.toLowerCase();
  const appointmentHintText = [
    suggestedTitle,
    asStringOrNull(parsed.observations),
    asStringOrNull(parsed.diagnosis),
    asStringOrNull(parsed.aiGeneratedSummary),
    asStringOrNull(parsed.nextAppointmentReason),
    asStringOrNull(masterDocumentType),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const hasClinicalHint = /(receta|prescrip|comprimido|diagn[oó]stic|hallazgo|laboratorio|radiograf|ecograf|vacuna|medici[oó]n|resultado|sesiones|tratamiento)/i.test(appointmentHintText);
  const allowAppointmentFallback =
    rawDocumentType === "appointment" ||
    masterDocumentType === "medical_appointment" ||
    masterDocumentType === "appointment" ||
    (APPOINTMENT_HINT_REGEX.test(appointmentHintText) && Boolean(eventDate || appointmentTime) && !hasClinicalHint);

  const medications = Array.isArray(parsed.medications)
    ? parsed.medications
      .map((item) => {
        const med = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
        const name = asStringOrNull(med.name);
        if (!name) return null;
        return {
          name,
          dosage: asStringOrNull(med.dosage),
          frequency: asStringOrNull(med.frequency),
          duration: asStringOrNull(med.duration),
          confidence: asConfidence(med.confidence),
        };
      })
      .filter(Boolean)
    : [];

  const rawMeasurements = Array.isArray(parsed.measurements)
    ? parsed.measurements
      .map((item) => {
        const measurement = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
        const name = asStringOrNull(measurement.name);
        const value = asStringOrNull(measurement.value);
        if (!name || !value) return null;
        const provisional: Measurement = {
          name,
          value,
          unit: asStringOrNull(measurement.unit),
          referenceRange: asStringOrNull(measurement.referenceRange),
          confidence: asConfidence(measurement.confidence),
        };
        return {
          ...provisional,
          referenceRange: sanitizeMeasurementReferenceRange(provisional),
        };
      })
      .filter(Boolean)
    : [];

  const detectedAppointments = sanitizeDetectedAppointments(
    parsed.detectedAppointments ?? parsed.appointments ?? null,
    { eventDate, appointmentTime, title: suggestedTitle, clinic, provider, allowDateFallback: allowAppointmentFallback }
  );

  let inferredType = rawDocumentType;
  const forceAppointment = inferAppointmentByContent({
    documentType: inferredType,
    title: suggestedTitle,
    observations: asStringOrNull(parsed.observations),
    diagnosis: asStringOrNull(parsed.diagnosis),
    eventDate,
    appointmentTime,
    detectedAppointments,
  });
  if (forceAppointment) inferredType = "appointment";

  const measurements = collapseQualitativeMicroscopyMeasurements(rawMeasurements as Measurement[]);

  const summaryFromParsed = asStringOrNull(parsed.aiGeneratedSummary) || fallback.aiGeneratedSummary;
  const adjustedSummary = inferredType === "appointment"
    ? "Confirmación de turno detectada. Revisá fecha, hora y profesional para agregarla a agenda."
    : summaryFromParsed;
  const parsedVaccineArtifacts = asObject(
    parsed.vaccineArtifacts ??
    parsed.vaccine_artifacts ??
    asObject(masterClinical.vaccine_artifacts)
  );
  const vaccineProductName = asStringOrNull(parsed.vaccineProductName ?? parsedVaccineArtifacts.product_name);
  const vaccineManufacturer = asStringOrNull(parsed.vaccineManufacturer ?? parsedVaccineArtifacts.manufacturer);
  const vaccineLotNumber = asStringOrNull(parsed.vaccineLotNumber ?? parsedVaccineArtifacts.lot_number ?? parsedVaccineArtifacts.lote);
  const vaccineSerialNumber = asStringOrNull(parsed.vaccineSerialNumber ?? parsedVaccineArtifacts.serial_number ?? parsedVaccineArtifacts.serie);
  const vaccineExpiryDate = asDateKeyOrNull(parsed.vaccineExpiryDate ?? parsedVaccineArtifacts.expiry_date ?? parsedVaccineArtifacts.vto);
  const vaccineApplicationDate = asDateKeyOrNull(parsed.vaccineApplicationDate ?? parsedVaccineArtifacts.application_date);
  const vaccineRevaccinationDate = asDateKeyOrNull(parsed.vaccineRevaccinationDate ?? parsedVaccineArtifacts.revaccination_date);
  const vaccineStickerDetected = asBooleanOrNull(parsed.vaccineStickerDetected ?? parsedVaccineArtifacts.sticker_detected);
  const vaccineStampDetected = asBooleanOrNull(parsed.vaccineStampDetected ?? parsedVaccineArtifacts.stamp_detected);
  const vaccineSignatureDetected = asBooleanOrNull(parsed.vaccineSignatureDetected ?? parsedVaccineArtifacts.signature_detected);
  const parsedProactiveCarePlan = sanitizeProactiveCarePlan(
    parsed.proactiveCarePlan ?? parsed.proactive_care_plan
  );
  const parsedImagingFindings = sanitizeProactiveImagingFindings(
    parsed.imagingFindings ?? parsed.imaging_findings
  );

  const derivedCarePlanFromMaster = (() => {
    if (!parsedMasterClinical) return null;
    const normalizedMaster = toMasterPayload(asObject(parsedMasterClinical));
    const normalizedDocumentType = inferLegacyDocumentTypeFromMaster(normalizedMaster);
    const normalizedImagingFindings = (normalizedMaster.imaging_findings || [])
      .map((item) => {
        if (!item?.finding) return null;
        return {
          region: item.region || null,
          view: item.view || null,
          finding: item.finding,
          severity: item.severity || "no_especificado",
          confidence: "high" as const,
        };
      })
      .filter(Boolean) as ProactiveImagingFinding[];

    const normalizedMedications = normalizedMaster.treatments
      .filter((item) => isLikelyMedicationTreatment(item))
      .map((item) => {
        if (!item.treatment_name) return null;
        const dosage = item.dosage || null;
        return {
          name: item.treatment_name,
          dosage,
          frequency: dosage ? asStringOrNull(dosage.match(/cada\s+\d+\s*horas?/i)?.[0] || null) : null,
          duration:
            item.start_date && item.end_date
              ? `${item.start_date} a ${item.end_date}`
              : item.status === "activo"
                ? "indefinido"
                : null,
          confidence: "high" as const,
        };
      })
      .filter(Boolean) as MedicationExtracted[];

    return deriveProactiveCarePlan({
      eventDate: eventDate || normalizedMaster.document_info.date || null,
      documentType: normalizedDocumentType,
      sourceDocumentType: normalizedMaster.document_type,
      diagnosisText: asStringOrNull(parsed.diagnosis),
      diagnoses: normalizedMaster.diagnoses.map((item) => ({
        condition_name: item.condition_name,
        severity: item.severity,
      })),
      medications: normalizedMedications,
      recommendations: normalizedMaster.recommendations || [],
      imagingFindings: normalizedImagingFindings,
      vaccineArtifacts: normalizedMaster.vaccine_artifacts || null,
    });
  })();

  const derivedCarePlanFromLegacy = deriveProactiveCarePlan({
    eventDate,
    documentType: inferredType,
    sourceDocumentType: normalizeToMasterDocumentType(masterDocumentType),
    diagnosisText: inferredType === "appointment" ? null : asStringOrNull(parsed.diagnosis),
    diagnoses: (
      asStringOrNull(parsed.diagnosis)
        ?.split(/;\s*/)
        .map((item) => asStringOrNull(item))
        .filter(Boolean)
        .map((item) => ({ condition_name: item || null, severity: null })) || []
    ),
    medications: (inferredType === "appointment" ? [] : medications) as MedicationExtracted[],
    recommendations: [
      asStringOrNull(parsed.nextAppointmentReason),
      asStringOrNull(parsed.observations),
      ...(asArray(parsed.recommendations).map((item) => asStringOrNull(item)).filter(Boolean) as string[]),
    ].filter(Boolean) as string[],
    imagingFindings: parsedImagingFindings,
    vaccineArtifacts: {
      sticker_detected: vaccineStickerDetected,
      stamp_detected: vaccineStampDetected,
      signature_detected: vaccineSignatureDetected,
      product_name: vaccineProductName,
      manufacturer: vaccineManufacturer,
      lot_number: vaccineLotNumber,
      serial_number: vaccineSerialNumber,
      expiry_date: vaccineExpiryDate,
      application_date: vaccineApplicationDate,
      revaccination_date: vaccineRevaccinationDate,
    },
  });
  const proactiveCarePlan = parsedProactiveCarePlan || derivedCarePlanFromMaster || derivedCarePlanFromLegacy;

  return {
    ...fallback,
    documentType: inferredType,
    documentTypeConfidence: asConfidence(parsed.documentTypeConfidence),
    eventDate,
    eventDateConfidence: asConfidence(parsed.eventDateConfidence),
    appointmentTime,
    detectedAppointments,
    provider,
    providerConfidence: asConfidence(parsed.providerConfidence),
    clinic,
    diagnosis: inferredType === "appointment" ? null : asStringOrNull(parsed.diagnosis),
    diagnosisConfidence: inferredType === "appointment" ? "not_detected" : asConfidence(parsed.diagnosisConfidence),
    observations: asStringOrNull(parsed.observations),
    observationsConfidence: asConfidence(parsed.observationsConfidence),
    medications: (inferredType === "appointment" ? [] : medications) as ExtractedData["medications"],
    nextAppointmentDate: inferredType === "appointment"
      ? null
      : asDateKeyOrNull(parsed.nextAppointmentDate) || (inferredType === "vaccine" ? vaccineRevaccinationDate : null),
    nextAppointmentReason: asStringOrNull(parsed.nextAppointmentReason) || (
      inferredType === "vaccine" && vaccineRevaccinationDate ? "Revacunación sugerida por certificado." : null
    ),
    nextAppointmentConfidence: inferredType === "appointment" ? "not_detected" : asConfidence(parsed.nextAppointmentConfidence),
    suggestedTitle,
    aiGeneratedSummary: adjustedSummary,
    measurements: (inferredType === "appointment" ? [] : measurements) as ExtractedData["measurements"],
    vaccineProductName,
    vaccineManufacturer,
    vaccineLotNumber,
    vaccineSerialNumber,
    vaccineExpiryDate,
    vaccineApplicationDate,
    vaccineRevaccinationDate,
    vaccineStickerDetected,
    vaccineStampDetected,
    vaccineSignatureDetected,
    proactiveCarePlan,
    masterClinical: parsedMasterClinical,
    extractionProtocol:
      asStringOrNull(parsed.extractionProtocol) === "pessy_clinical_processing_protocol_v1"
        ? "pessy_clinical_processing_protocol_v1"
        : asStringOrNull(parsed.extractionProtocol) === "pessy_master_clinical_protocol_v1"
          ? "pessy_master_clinical_protocol_v1"
          : asStringOrNull(parsed.extractionProtocol) === "legacy_v1"
            ? "legacy_v1"
            : "legacy_v1",
  };
};

const buildSafeFallbackExtraction = (rawText?: string | null): ExtractedData => {
  const summary = (rawText || "")
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 500);

  return {
    documentType: "other",
    documentTypeConfidence: "low",
    eventDate: null,
    eventDateConfidence: "not_detected",
    appointmentTime: null,
    detectedAppointments: [],
    provider: null,
    providerConfidence: "not_detected",
    clinic: null,
    diagnosis: null,
    diagnosisConfidence: "not_detected",
    observations: null,
    observationsConfidence: "not_detected",
    medications: [],
    nextAppointmentDate: null,
    nextAppointmentReason: null,
    nextAppointmentConfidence: "not_detected",
    suggestedTitle: "Documento médico",
    aiGeneratedSummary: summary || "Documento recibido. Revisá los datos manualmente.",
    measurements: [],
    proactiveCarePlan: null,
    masterClinical: null,
    extractionProtocol: "legacy_v1",
  };
};

const extractJsonCandidate = (rawText: string): string | null => {
  const stripped = rawText
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/g, "")
    .replace(/[“”]/g, "\"")
    .replace(/[‘’]/g, "'")
    .trim();

  const firstBrace = stripped.indexOf("{");
  const lastBrace = stripped.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) return null;
  const candidate = stripped.slice(firstBrace, lastBrace + 1);
  return candidate.replace(/,\s*([}\]])/g, "$1");
};

const safeParseExtractedData = (rawText: string): ExtractedData | null => {
  const candidate = extractJsonCandidate(rawText);
  if (!candidate) return null;
  try {
    const parsed = JSON.parse(candidate);
    const record = asObject(parsed);
    if (isAppointmentEventPayload(record)) {
      const masterPayload = toMasterPayload(record);
      const mapped = mapMasterPayloadToLegacy(masterPayload);
      return sanitizeExtractedData(mapped, rawText);
    }
    if (isMasterProtocolPayload(record)) {
      const masterPayload = toMasterPayload(record);
      const mapped = mapMasterPayloadToLegacy(masterPayload);
      return sanitizeExtractedData(mapped, rawText);
    }
    return sanitizeExtractedData(record, rawText);
  } catch {
    return null;
  }
};

// ============================================================================
// MOCK - Reemplazar con API real
// ============================================================================

export async function mockProcessDocument(
  file: File
): Promise<DocumentExtractionResponse> {
  // Simular delay de procesamiento
  await new Promise((resolve) => setTimeout(resolve, 2500));

  // Detectar tipo aproximado por nombre de archivo
  const fileName = file.name.toLowerCase();
  let documentType: DocumentType = "other";

  if (fileName.includes("vacun") || fileName.includes("vaccine")) {
    documentType = "vaccine";
  } else if (fileName.includes("lab") || fileName.includes("analisis")) {
    documentType = "lab_test";
  } else if (fileName.includes("radio") || fileName.includes("xray") || fileName.includes("rx")) {
    documentType = "xray";
  } else if (fileName.includes("eco") || fileName.includes("echo")) {
    documentType = "echocardiogram";
  } else if (fileName.includes("ecg") || fileName.includes("electro")) {
    documentType = "electrocardiogram";
  } else if (fileName.includes("cirug") || fileName.includes("surgery")) {
    documentType = "surgery";
  } else if (fileName.includes("receta") || fileName.includes("med")) {
    documentType = "medication";
  } else if (fileName.includes("control") || fileName.includes("consulta")) {
    documentType = "checkup";
  }

  // Mock data basado en el tipo detectado
  const mockResponses: Partial<Record<DocumentType, Partial<ExtractedData>>> = {
    vaccine: {
      documentType: "vaccine",
      documentTypeConfidence: "high",
      eventDate: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
      eventDateConfidence: "high",
      provider: "Clínica Veterinaria del Parque",
      providerConfidence: "high",
      diagnosis: null,
      diagnosisConfidence: "not_detected",
      observations: "Aplicación de vacuna séxtuple. Mascota en buen estado general.",
      observationsConfidence: "high",
      medications: [],
      nextAppointmentDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      nextAppointmentReason: "Refuerzo anual de vacuna séxtuple",
      nextAppointmentConfidence: "high",
      suggestedTitle: "Vacunación Séxtuple",
      aiGeneratedSummary:
        "Se aplicó la vacuna séxtuple de forma exitosa. La mascota respondió bien al procedimiento. Se recomienda refuerzo en un año.",
      measurements: [],
    },

    lab_test: {
      documentType: "lab_test",
      documentTypeConfidence: "high",
      eventDate: new Date(Date.now() - Math.random() * 20 * 24 * 60 * 60 * 1000).toISOString(),
      eventDateConfidence: "high",
      provider: "Laboratorio Veterinario Diagnóstica",
      providerConfidence: "medium",
      diagnosis: "Perfil bioquímico completo dentro de parámetros normales",
      diagnosisConfidence: "high",
      observations: "Todos los valores en rango de referencia. Función renal y hepática estables.",
      observationsConfidence: "high",
      medications: [],
      nextAppointmentDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString(),
      nextAppointmentReason: "Control bioquímico semestral",
      nextAppointmentConfidence: "medium",
      suggestedTitle: "Análisis Bioquímico",
      aiGeneratedSummary:
        "Los resultados de laboratorio muestran que todos los valores están dentro de los rangos normales. La función renal y hepática están funcionando correctamente. Se recomienda repetir análisis en 6 meses como control preventivo.",
      measurements: [
        {
          name: "Glucosa",
          value: "92",
          unit: "mg/dL",
          referenceRange: "70-110",
          confidence: "high",
        },
        {
          name: "Creatinina",
          value: "1.1",
          unit: "mg/dL",
          referenceRange: "0.5-1.5",
          confidence: "high",
        },
        {
          name: "ALT",
          value: "45",
          unit: "U/L",
          referenceRange: "10-100",
          confidence: "high",
        },
      ],
    },

    xray: {
      documentType: "xray",
      documentTypeConfidence: "high",
      eventDate: new Date(Date.now() - Math.random() * 15 * 24 * 60 * 60 * 1000).toISOString(),
      eventDateConfidence: "high",
      provider: "Centro de Diagnóstico Veterinario",
      providerConfidence: "high",
      diagnosis: "Displasia de cadera grado leve. Sin evidencia de fracturas.",
      diagnosisConfidence: "high",
      observations: "Remodelación articular mínima. Se recomienda manejo conservador con suplementación.",
      observationsConfidence: "high",
      medications: [
        {
          name: "Condroprotectores",
          dosage: "1 comprimido",
          frequency: "cada 24 horas",
          duration: "Crónico",
          confidence: "high",
        },
      ],
      nextAppointmentDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString(),
      nextAppointmentReason: "Control radiográfico de seguimiento",
      nextAppointmentConfidence: "medium",
      suggestedTitle: "Radiografía de Cadera",
      aiGeneratedSummary:
        "La radiografía registra displasia de cadera leve según los parámetros documentados. Se sugiere considerar tratamiento preventivo con condroprotectores y control de peso según evaluación veterinaria profesional.",
      measurements: [],
    },

    echocardiogram: {
      documentType: "echocardiogram",
      documentTypeConfidence: "high",
      eventDate: new Date(Date.now() - Math.random() * 10 * 24 * 60 * 60 * 1000).toISOString(),
      eventDateConfidence: "high",
      provider: "Servicio de Cardiología Veterinaria",
      providerConfidence: "high",
      diagnosis: "Cardiomiopatía dilatada en fase inicial",
      diagnosisConfidence: "high",
      observations: "Fracción de acortamiento 24%. Leve regurgitación mitral. Se inicia tratamiento con Pimobendan.",
      observationsConfidence: "high",
      medications: [
        {
          name: "Pimobendan",
          dosage: "5mg",
          frequency: "cada 12 horas",
          duration: "Crónico",
          confidence: "high",
        },
      ],
      nextAppointmentDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
      nextAppointmentReason: "Control ecocardiográfico de seguimiento",
      nextAppointmentConfidence: "high",
      suggestedTitle: "Ecocardiograma de Control",
      aiGeneratedSummary:
        "El ecocardiograma reveló una cardiomiopatía dilatada en etapa temprana. El corazón está trabajando con menor eficiencia de lo normal, pero el diagnóstico a tiempo permite un tratamiento efectivo. La medicación prescrita ayudará a mejorar la función cardíaca. Es importante el seguimiento cada 3 meses.",
      measurements: [
        {
          name: "Fracción de acortamiento",
          value: "24",
          unit: "%",
          referenceRange: "25-45",
          confidence: "high",
        },
      ],
    },

    electrocardiogram: {
      documentType: "electrocardiogram",
      documentTypeConfidence: "high",
      eventDate: new Date(Date.now() - Math.random() * 12 * 24 * 60 * 60 * 1000).toISOString(),
      eventDateConfidence: "high",
      provider: "Clínica Cardiológica Veterinaria",
      providerConfidence: "high",
      diagnosis: "Ritmo sinusal estable. Sin arritmias detectadas.",
      diagnosisConfidence: "high",
      observations: "Frecuencia cardíaca promedio 128 lpm. Intervalo PR 84ms. Complejo QRS 76ms.",
      observationsConfidence: "high",
      medications: [],
      nextAppointmentDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString(),
      nextAppointmentReason: "ECG de control preventivo",
      nextAppointmentConfidence: "medium",
      suggestedTitle: "Electrocardiograma (ECG)",
      aiGeneratedSummary:
        "El electrocardiograma muestra un ritmo cardíaco normal y estable. No se detectaron irregularidades ni arritmias. El corazón está funcionando de manera adecuada desde el punto de vista eléctrico.",
      measurements: [
        {
          name: "Frecuencia cardíaca",
          value: "128",
          unit: "lpm",
          referenceRange: "70-160",
          confidence: "high",
        },
        {
          name: "Intervalo PR",
          value: "84",
          unit: "ms",
          referenceRange: "60-130",
          confidence: "high",
        },
      ],
    },

    surgery: {
      documentType: "surgery",
      documentTypeConfidence: "high",
      eventDate: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
      eventDateConfidence: "high",
      provider: "Hospital Veterinario Quirúrgico",
      providerConfidence: "high",
      diagnosis: "Castración realizada exitosamente. Sin complicaciones.",
      diagnosisConfidence: "high",
      observations: "Procedimiento quirúrgico sin incidentes. Se retiran puntos en 10 días.",
      observationsConfidence: "high",
      medications: [
        {
          name: "Carprofeno",
          dosage: "50mg",
          frequency: "cada 12 horas",
          duration: "7 días",
          confidence: "high",
        },
        {
          name: "Cefalexina",
          dosage: "500mg",
          frequency: "cada 12 horas",
          duration: "10 días",
          confidence: "high",
        },
      ],
      nextAppointmentDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
      nextAppointmentReason: "Retiro de puntos",
      nextAppointmentConfidence: "high",
      suggestedTitle: "Cirugía de Castración",
      aiGeneratedSummary:
        "La cirugía de castración se realizó sin complicaciones. Se prescribió medicación antiinflamatoria y antibióticos para prevenir infecciones. Es importante mantener la zona limpia y evitar que la mascota se lama la herida. Los puntos se retiran en 10 días.",
      measurements: [],
    },

    medication: {
      documentType: "medication",
      documentTypeConfidence: "high",
      eventDate: new Date().toISOString(),
      eventDateConfidence: "high",
      provider: "Veterinaria del Centro",
      providerConfidence: "medium",
      diagnosis: null,
      diagnosisConfidence: "not_detected",
      observations: "Receta médica para tratamiento ambulatorio.",
      observationsConfidence: "medium",
      medications: [
        {
          name: "Amoxicilina + Ácido Clavulánico",
          dosage: "500mg",
          frequency: "cada 12 horas",
          duration: "14 días",
          confidence: "high",
        },
      ],
      nextAppointmentDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      nextAppointmentReason: "Control post-tratamiento",
      nextAppointmentConfidence: "low",
      suggestedTitle: "Receta de Antibióticos",
      aiGeneratedSummary:
        "Se prescribió antibiótico para tratamiento de infección. Es importante completar el ciclo completo de medicación aunque los síntomas mejoren antes. No suspender el tratamiento sin consultar al veterinario.",
      measurements: [],
    },

    checkup: {
      documentType: "checkup",
      documentTypeConfidence: "high",
      eventDate: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
      eventDateConfidence: "high",
      provider: "Clínica Veterinaria Salud Animal",
      providerConfidence: "high",
      diagnosis: "Parámetros observados dentro de rangos documentados.",
      diagnosisConfidence: "high",
      observations: "Peso documentado: 31.2kg. Dentadura revisada. Pelaje evaluado.",
      observationsConfidence: "high",
      medications: [],
      nextAppointmentDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString(),
      nextAppointmentReason: "Control preventivo semestral",
      nextAppointmentConfidence: "medium",
      suggestedTitle: "Control de Rutina",
      aiGeneratedSummary:
        "La consulta de control registró los parámetros vitales habituales. No se documentaron hallazgos que requieran atención inmediata según el profesional actuante. Se sugiere próximo control en 6 meses.",
      measurements: [
        {
          name: "Peso",
          value: "31.2",
          unit: "kg",
          referenceRange: "28-32",
          confidence: "high",
        },
        {
          name: "Temperatura",
          value: "38.5",
          unit: "°C",
          referenceRange: "38-39.5",
          confidence: "high",
        },
      ],
    },

    other: {
      documentType: "other",
      documentTypeConfidence: "low",
      eventDate: new Date().toISOString(),
      eventDateConfidence: "medium",
      provider: null,
      providerConfidence: "not_detected",
      diagnosis: null,
      diagnosisConfidence: "not_detected",
      observations: "Documento cargado exitosamente. Información no categorizada automáticamente.",
      observationsConfidence: "low",
      medications: [],
      nextAppointmentDate: null,
      nextAppointmentReason: null,
      nextAppointmentConfidence: "not_detected",
      suggestedTitle: "Documento Adicional",
      aiGeneratedSummary:
        "Este documento fue procesado pero no se pudo identificar automáticamente su tipo. Puedes revisarlo manualmente o volver a cargarlo con mejor calidad de imagen.",
      measurements: [],
    },
  };

  const extractedData = sanitizeExtractedData(mockResponses[documentType] || mockResponses["other"] || {});

  return {
    extractedData,
    processingTimeMs: 2500,
    model: "servicio-analisis (mock)",
    tokensUsed: 1250,
  };
}

// ============================================================================
// IMPLEMENTACION REAL
// ============================================================================

async function callAnalysisAPIFromBackend(file: File): Promise<DocumentExtractionResponse> {
  const startedAt = Date.now();
  const optimizedFile = await prepareFileForAnalysis(file);
  const normalizedMimeType = normalizeAnalysisMimeType(optimizedFile);
  if (!isSupportedAnalysisMimeType(normalizedMimeType)) {
    throw new Error("Formato no compatible. Subí PDF, JPG, PNG o WEBP.");
  }
  const base64 = await fileToBase64(optimizedFile);

  const result = await callBackendFunction<
    { mimeType: string; base64: string; contextHint?: string; fileName?: string },
    BackendAnalyzeResponse
  >(
    "analyzeDocument",
    {
      mimeType: normalizedMimeType,
      base64,
      contextHint: file.name || undefined,
      fileName: file.name || undefined,
    }
  );

  const rawText = typeof result?.rawText === "string" ? result.rawText : "";
  const extractedData = safeParseExtractedData(rawText) || buildSafeFallbackExtraction(rawText);

  return {
    extractedData,
    processingTimeMs:
      typeof result?.processingTimeMs === "number"
        ? result.processingTimeMs
        : Date.now() - startedAt,
    model: typeof result?.model === "string" ? result.model : "servicio-analisis-backend",
    tokensUsed: typeof result?.tokensUsed === "number" ? result.tokensUsed : 0,
  };
}

export async function callAnalysisAPI(
  file: File
): Promise<DocumentExtractionResponse> {
  if (USE_BACKEND_ANALYSIS) {
    try {
      return await callAnalysisAPIFromBackend(file);
    } catch (backendError) {
      if (!RUNTIME_ALLOW_DIRECT_AI_FALLBACK) {
        throw backendError;
      }
      console.warn("Backend analysis failed, fallback to direct API:", backendError);
    }
  }

  const startTime = Date.now();
  const analysisApiKey = import.meta.env.VITE_GEMINI_API_KEY;
  const analysisModel = import.meta.env.VITE_ANALYSIS_MODEL;

  if (!analysisApiKey || !analysisModel) {
    throw new Error("Servicio de analisis no configurado");
  }

  const optimizedFile = await prepareFileForAnalysis(file);
  const normalizedMimeType = normalizeAnalysisMimeType(optimizedFile);
  if (!isSupportedAnalysisMimeType(normalizedMimeType)) {
    throw new Error("Formato no compatible. Subí PDF, JPG, PNG o WEBP.");
  }
  const base64 = await fileToBase64(optimizedFile);

  const today = new Date().toISOString().slice(0, 10);
  const prompt = `Sos el motor de extracción clínica de PESSY.
Fecha de hoy: ${today}

PESSY CLINICAL PROCESSING PROTOCOL

FASE 0 — CLASIFICACIÓN OBLIGATORIA
Clasificá primero el documento en UNA categoría:
- clinical_report
- laboratory_result
- prescription
- medical_study
- medical_appointment
- vaccination_record
- other

Reglas críticas:
- Si detectás fecha futura + hora + especialidad o términos de turno (turno, confirmado, centro de atención, consulta), tratar como medical_appointment.
- Si es medical_appointment, NO generar diagnósticos ni hallazgos clínicos.
- No inventar datos faltantes.

FASE 0.5 — LECTURA CLÍNICA OBLIGATORIA (informes cualitativos: KOH, tricograma, citología, raspado)
1) Identificá estudio solicitado y técnica.
2) Extraé resultado principal literal (ej. "no se observaron...", "compatible con...", "positivo/negativo").
3) Diferenciá explícitamente:
   - qué descarta en esta muestra,
   - qué NO descarta de forma global.
4) Capturá limitaciones/disclaimers del informe (ej. "su ausencia no es excluyente").
5) Listá observaciones secundarias separadas del resultado principal.
6) Traducí términos técnicos en lenguaje simple dentro de recomendaciones.

FASE 1 — EXTRACCIÓN ESTRUCTURADA
Analizá el documento completo en modo multimodal y devolvé SOLO JSON válido:
{
  "pet": {
    "name": "string|null",
    "species": "string|null",
    "breed": "string|null",
    "age_at_study": "string|null",
    "owner": "string|null"
  },
  "document": {
    "type": "radiografia|ecografia|laboratorio|receta|informe|otro",
    "study_date": "YYYY-MM-DD|null",
    "clinic_name": "string|null",
    "clinic_address": "string|null",
    "veterinarian_name": "string|null",
    "veterinarian_license": "string|null",
    "protocol_or_record_number": "string|null"
  },
  "diagnoses_detected": [
    {
      "condition_name": "string|null",
      "organ_system": "string|null",
      "status": "nuevo|recurrente|persistente|null",
      "severity": "leve|moderado|severo|no_especificado|null"
    }
  ],
  "abnormal_findings": [
    {
      "parameter": "string|null",
      "value": "string|null",
      "reference_range": "string|null",
      "interpretation": "alto|bajo|alterado|normal|no_observado|inconcluso|null"
    }
  ],
  "imaging_findings": [
    {
      "region": "torax|abdomen|pelvis|columna|cadera|otro|null",
      "view": "ventrodorsal|lateral|dorsoventral|oblicua|otro|null",
      "finding": "string|null",
      "severity": "leve|moderado|severo|no_especificado|null"
    }
  ],
  "treatments_detected": [
    {
      "treatment_name": "string|null",
      "start_date": "YYYY-MM-DD|null",
      "end_date": "YYYY-MM-DD|null",
      "dosage": "string|null",
      "status": "activo|finalizado|desconocido|null"
    }
  ],
  "medical_recommendations": ["string"],
  "requires_followup": true
}

Opcional para documentos de turno:
{
  "appointment_event": {
    "event_type": "medical_appointment",
    "date": "YYYY-MM-DD|null",
    "time": "HH:MM|null",
    "specialty": "string|null",
    "procedure": "string|null",
    "clinic": "string|null",
    "address": "string|null",
    "professional_name": "string|null",
    "preparation_required": "string|null",
    "status": "scheduled|programado|confirmado|recordatorio|null"
  }
}

Opcional para certificados/carnets de vacunación:
{
  "vaccine_artifacts": {
    "sticker_detected": true,
    "stamp_detected": true,
    "signature_detected": true,
    "product_name": "string|null",
    "manufacturer": "string|null",
    "lot_number": "string|null",
    "serial_number": "string|null",
    "expiry_date": "YYYY-MM-DD|null",
    "application_date": "YYYY-MM-DD|null",
    "revaccination_date": "YYYY-MM-DD|null"
  }
}

FASE 2 — NORMALIZACIÓN
- Fechas en ISO YYYY-MM-DD.
- Unificar patologías equivalentes.
- Estandarizar órgano/sistema cuando esté explícito.

Reglas:
- Si un campo no está presente: null.
- No inventar información.
- No devolver texto fuera del JSON.
- No exceder 6 elementos por lista.
- Ignorar fecha de impresión y priorizar fecha clínica principal.
- Si el documento es turno, no completar diagnósticos ni hallazgos clínicos.
- En estudios cualitativos, usar "abnormal_findings.value" con literal clínico (ej. "no se observaron estructuras compatibles...").
- Regla crítica: si NO hay valor numérico y NO hay rango numérico explícito, NO usar interpretaciones "alto|bajo|alterado|fuera de rango". Usar "no_observado" o null.
- Para dermatología microscópica (KOH/tricograma/citología/raspado): devolver UN estudio padre y observaciones como texto, no separar en múltiples "valores de laboratorio" cuantitativos.
- Si aparece "ausencia no excluyente" o equivalente, incluirlo textualmente en "medical_recommendations".
- Si el documento es por imágenes (radiografía/ecografía/ECG), completar "imaging_findings" con región, vista/proyección y hallazgo.
- Para radiografía, mapear abreviaturas de proyección cuando aparezcan (VD, DV, LL) a "view".
- Priorizar recomendaciones con prefijos:
  1) "Resultado principal: ..."
  2) "No descarta: ..." (si aplica)
  3) "Limitación: ..." (si aplica)
  4) "Siguiente paso: ..." (si aplica).
- Si hay troquel/sello/firma visibles, registrarlo en "vaccine_artifacts".
- Si el troquel tiene lote o serie, priorizar esos valores como fuente de verdad sobre texto libre.
`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${analysisModel}:generateContent?key=${analysisApiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: prompt },
            { inline_data: { mime_type: normalizedMimeType, data: base64 } },
          ],
        }],
        generationConfig: {
          temperature: 0,
          topK: 1,
          topP: 1,
          responseMimeType: "application/json",
          maxOutputTokens: 2600,
          thinkingConfig: {
            thinkingBudget: 0,
          },
        },
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Error del servicio de analisis (${response.status}): ${errorText}`);
  }

  const result = await response.json();
  const rawText = result.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!rawText) {
    return {
      extractedData: buildSafeFallbackExtraction(""),
      processingTimeMs: Date.now() - startTime,
      model: "servicio-analisis-v1",
      tokensUsed: result.usageMetadata?.totalTokenCount ?? 0,
    };
  }

  const extractedData = safeParseExtractedData(rawText) || buildSafeFallbackExtraction(rawText);

  return {
    extractedData,
    processingTimeMs: Date.now() - startTime,
    model: "servicio-analisis-v1",
    tokensUsed: result.usageMetadata?.totalTokenCount ?? 0,
  };
}

export async function generateHealthSummary(prompt: string): Promise<string> {
  if (USE_BACKEND_ANALYSIS) {
    try {
      const result = await callBackendFunction<
        { prompt: string; temperature: number; maxOutputTokens: number },
        BackendSummaryResponse
      >("generateClinicalSummary", {
        prompt,
        temperature: 0.2,
        maxOutputTokens: 450,
      });
      return (result?.rawText || "").trim() || "No se pudo generar el resumen.";
    } catch (backendError) {
      if (!RUNTIME_ALLOW_DIRECT_AI_FALLBACK) {
        throw backendError;
      }
      console.warn("Backend summary failed, fallback to direct API:", backendError);
    }
  }

  const apiKey = (import.meta as any).env.VITE_GEMINI_API_KEY;
  const analysisModel = (import.meta as any).env.VITE_ANALYSIS_MODEL;
  if (!apiKey || !analysisModel) throw new Error("Servicio de analisis no configurado");

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${analysisModel}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 450,
        },
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Error del servicio de analisis (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text || "No se pudo generar el resumen.";
}

export type ReportType = "health" | "vaccine" | "treatment";

interface ClinicalReportSynthesisInput {
  reportType: ReportType;
  pet: {
    id: string;
    name: string;
    breed?: string;
    species?: string;
    age?: string;
  };
  ownerName: string;
  events: MedicalEvent[];
  medications: ActiveMedication[];
  appointments: Appointment[];
}

interface ClinicalReportSynthesis {
  executiveSummary: string;
  clinicalNarrative: string;
  carePlan: string;
}

const DOC_TYPE_LABEL: Record<DocumentType, string> = {
  vaccine: "vacuna",
  appointment: "turno",
  lab_test: "laboratorio",
  xray: "radiografia",
  echocardiogram: "ecocardiograma",
  electrocardiogram: "electrocardiograma",
  surgery: "cirugia",
  medication: "medicacion",
  checkup: "control",
  other: "documento",
};

const cleanReportText = (value?: string | null): string =>
  (value || "")
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/g, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/#{1,6}\s+/g, "")
    .replace(/`{1,3}/g, "")
    .replace(/\s+/g, " ")
    .trim();

const formatIsoShort = (iso?: string | null): string => {
  const key = toDateKeySafe(iso);
  return key || "sin fecha";
};

const buildFallbackSynthesis = (input: ClinicalReportSynthesisInput): ClinicalReportSynthesis => {
  const sortedEvents = [...input.events].sort((a, b) => {
    const da = toTimestampSafe(a.extractedData?.eventDate || a.createdAt);
    const db = toTimestampSafe(b.extractedData?.eventDate || b.createdAt);
    return db - da;
  });
  const latest = sortedEvents[0];
  const upcoming = input.appointments.filter((appointment) => appointment.status === "upcoming").length;
  const executiveSummary = latest
    ? `${input.pet.name} presenta un seguimiento clínico con ${sortedEvents.length} registro(s). Actualmente hay ${input.medications.length} tratamiento(s) activo(s) y ${upcoming} turno(s) próximo(s).`
    : `${input.pet.name} aún no tiene registros suficientes para construir un resumen clínico completo.`;

  const clinicalNarrative = latest
    ? [
      `1. Introducción del paciente: ${input.pet.name}, ${cleanReportText(input.pet.species) || "especie no registrada"}, ${cleanReportText(input.pet.breed) || "raza no registrada"}. Seguimiento disponible: ${sortedEvents.length} documento(s).`,
      `2. Resumen cronológico: el registro más reciente es "${cleanReportText(latest.title)}" (${formatIsoShort(latest.extractedData?.eventDate || latest.createdAt)}). La evolución se interpreta desde la base estructurada cargada por el tutor.`,
      `3. Condiciones identificadas: ${cleanReportText(latest.extractedData?.diagnosis) || "sin diagnóstico consolidado en el último registro"}.`,
      `4. Eventos relevantes: ${cleanReportText(latest.extractedData?.observations || latest.extractedData?.aiGeneratedSummary) || "sin eventos críticos explícitos"}.`,
      `5. Estado clínico actual estimado: ${input.medications.length > 0 ? "en seguimiento con tratamiento activo" : "estable según datos disponibles, requiere controles periódicos"}.`,
    ].join(" ")
    : "No hay antecedentes clínicos suficientes para construir narrativa longitudinal completa.";

  const carePlan =
    input.medications.length > 0 || upcoming > 0
      ? `Mantener adherencia al plan actual, registrar cambios clínicos y asistir a controles programados. Este resumen no reemplaza la evaluación veterinaria presencial.`
      : `Continuar con medicina preventiva y controles periódicos. Este resumen no reemplaza la evaluación veterinaria presencial.`;

  return {
    executiveSummary,
    clinicalNarrative,
    carePlan,
  };
};

export async function generateClinicalReportSynthesis(
  input: ClinicalReportSynthesisInput
): Promise<ClinicalReportSynthesis> {
  const useBackendSummary = USE_BACKEND_ANALYSIS;
  const apiKey = (import.meta as any).env.VITE_GEMINI_API_KEY;
  const analysisModel = (import.meta as any).env.VITE_ANALYSIS_MODEL;

  if (!useBackendSummary && (!apiKey || !analysisModel)) {
    return buildFallbackSynthesis(input);
  }

  const sortedEvents = [...input.events].sort((a, b) => {
    const da = toTimestampSafe(a.extractedData?.eventDate || a.createdAt);
    const db = toTimestampSafe(b.extractedData?.eventDate || b.createdAt);
    return da - db;
  });

  const eventLines = sortedEvents.map((event, index) => {
    const extracted = event.extractedData;
    const masterDiagnoses = (extracted.masterClinical?.diagnoses || [])
      .map((diagnosisRow) => cleanReportText(diagnosisRow.condition_name))
      .filter(Boolean)
      .join(" | ");
    const masterRecommendations = (extracted.masterClinical?.recommendations || [])
      .map((rec) => cleanReportText(rec))
      .filter(Boolean)
      .join(" | ");
    const meds = (extracted.medications || [])
      .map((medication) =>
        [cleanReportText(medication.name), cleanReportText(medication.dosage), cleanReportText(medication.frequency)]
          .filter(Boolean)
          .join(" ")
      )
      .filter(Boolean)
      .join(" | ");
    const measures = (extracted.measurements || [])
      .map((measurement) =>
        `${cleanReportText(measurement.name)}: ${cleanReportText(measurement.value)} ${cleanReportText(measurement.unit)}`
      )
      .join(" | ");

    return [
      `${index + 1}.`,
      `fecha=${formatIsoShort(extracted.eventDate || event.createdAt)}`,
      `tipo=${DOC_TYPE_LABEL[extracted.documentType] || "documento"}`,
      `titulo=${cleanReportText(event.title || extracted.suggestedTitle) || "sin titulo"}`,
      `proveedor=${cleanReportText(extracted.provider) || "no especificado"}`,
      `diagnostico=${cleanReportText(extracted.diagnosis) || "no especificado"}`,
      `observaciones=${cleanReportText(extracted.observations || extracted.aiGeneratedSummary) || "sin observaciones"}`,
      `diagnosticos_estructurados=${masterDiagnoses || "no"}`,
      `recomendaciones_estructuradas=${masterRecommendations || "no"}`,
      `medicacion=${meds || "no"}`,
      `mediciones=${measures || "no"}`,
      `proximo_control=${formatIsoShort(extracted.nextAppointmentDate)}`,
      `archivo=${cleanReportText(event.fileName) || "sin nombre"}`,
    ].join(" ; ");
  });

  const medicationLines = input.medications.map((medication, index) =>
    `${index + 1}. ${cleanReportText(medication.name)} ; dosis=${cleanReportText(medication.dosage) || "sin dato"} ; frecuencia=${cleanReportText(medication.frequency) || "sin dato"} ; inicio=${formatIsoShort(medication.startDate)} ; fin=${formatIsoShort(medication.endDate)}`
  );

  const appointmentLines = input.appointments
    .filter((appointment) => appointment.status === "upcoming")
    .map((appointment, index) =>
      `${index + 1}. ${cleanReportText(appointment.title) || "turno"} ; fecha=${cleanReportText(appointment.date)} ${cleanReportText(appointment.time)} ; veterinario=${cleanReportText(appointment.veterinarian) || "no especificado"}`
    );

  const focusByType: Record<ReportType, string> = {
    health: "prioriza estado clinico integral, hitos diagnosticos y evolucion temporal",
    vaccine: "prioriza vacunas aplicadas, cobertura actual y proximos refuerzos",
    treatment: "prioriza medicaciones, adherencia, cambios de dosis e interacciones a vigilar",
  };

  const prompt = `Eres redactor clínico veterinario de PESSY.
Objetivo: generar análisis longitudinal narrativo usando SOLO la base estructurada recibida.
No reanalices archivos PDF o imágenes.
No inventes datos.
Si faltan datos, indícalo explícitamente.
No uses markdown.
Idioma: español neutro.

Devuelve SOLO JSON valido con este schema exacto:
{
  "executiveSummary":"string",
  "clinicalNarrative":"string",
  "carePlan":"string"
}

Contexto:
- tipo_reporte: ${input.reportType}
- foco: ${focusByType[input.reportType]}
- mascota: ${cleanReportText(input.pet.name)} (${cleanReportText(input.pet.breed) || "raza no registrada"})
- especie: ${cleanReportText(input.pet.species) || "no especificada"}
- edad: ${cleanReportText(input.pet.age) || "no registrada"}
- tutor: ${cleanReportText(input.ownerName) || "no registrado"}
- total_documentos: ${sortedEvents.length}
- total_medicaciones_activas: ${input.medications.length}
- total_turnos_proximos: ${appointmentLines.length}

Documentos (orden cronologico):
${eventLines.join("\n")}

Medicaciones activas:
${medicationLines.length > 0 ? medicationLines.join("\n") : "sin medicaciones activas"}

Turnos proximos:
${appointmentLines.length > 0 ? appointmentLines.join("\n") : "sin turnos proximos"}

Reglas de escritura:
- executiveSummary: 2 a 4 oraciones de situación global.
- clinicalNarrative: debe cubrir en prosa 5 partes:
  1) introducción del paciente,
  2) resumen cronológico,
  3) condiciones identificadas (aguda/recurrente/crónica/resuelta/en seguimiento cuando aplique),
  4) eventos relevantes,
  5) estado clínico actual estimado.
- carePlan: plan de seguimiento y alertas de control sin indicar tratamientos nuevos.
- Mantén tono profesional veterinario para tutores.
- Incluir aclaración breve de que no reemplaza evaluación veterinaria presencial.
`;

  let rawText = "";
  if (useBackendSummary) {
    try {
      const backend = await callBackendFunction<
        { prompt: string; temperature: number; maxOutputTokens: number; responseMimeType: string },
        BackendSummaryResponse
      >("generateClinicalSummary", {
        prompt,
        temperature: 0.1,
        maxOutputTokens: 1200,
        responseMimeType: "application/json",
      });
      rawText = backend?.rawText || "";
    } catch (error) {
      console.warn("No se pudo generar resumen clinico en backend:", error);
      return buildFallbackSynthesis(input);
    }
  } else {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${analysisModel}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.1,
            topK: 1,
            topP: 1,
            responseMimeType: "application/json",
            maxOutputTokens: 1200,
          },
        }),
      }
    );

    if (!response.ok) {
      return buildFallbackSynthesis(input);
    }

    const data = await response.json();
    rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
  }
  const stripped = rawText.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  const jsonMatch = stripped.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return buildFallbackSynthesis(input);
  }

  const parsed = JSON.parse(jsonMatch[0]);
  const executiveSummary = cleanReportText(parsed?.executiveSummary);
  const clinicalNarrative = cleanReportText(parsed?.clinicalNarrative);
  const carePlan = cleanReportText(parsed?.carePlan);

  if (!executiveSummary || !clinicalNarrative || !carePlan) {
    return buildFallbackSynthesis(input);
  }

  return {
    executiveSummary,
    clinicalNarrative,
    carePlan,
  };
}

export const extractMedicalData = callAnalysisAPI;

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(",")[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function prepareFileForAnalysis(file: File): Promise<File> {
  let normalizedFile = file;
  if (isHeicLike(file)) {
    try {
      normalizedFile = await convertHeicToJpeg(file);
    } catch (error) {
      console.warn("No se pudo convertir HEIC/HEIF, se usa archivo original:", error);
      normalizedFile = file;
    }
  }

  const normalizedMimeType = normalizeAnalysisMimeType(normalizedFile);
  if (!normalizedMimeType.startsWith("image/")) return normalizedFile;
  if (normalizedFile.size < 450_000) return normalizedFile;

  try {
    const image = await createImageBitmap(normalizedFile);
    // Preservar más detalle en documentos escaneados (texto chico / troqueles).
    const shortest = Math.min(image.width, image.height);
    const longest = Math.max(image.width, image.height);
    const aspectRatio = longest > 0 ? shortest / longest : 1;
    const likelyDocumentScan = aspectRatio >= 0.62 && aspectRatio <= 0.82;
    const maxSide = likelyDocumentScan ? 2200 : 1600;
    const jpegQuality = likelyDocumentScan ? 0.9 : 0.82;
    const largerSide = Math.max(image.width, image.height);
    const scale = largerSide > maxSide ? maxSide / largerSide : 1;
    const width = Math.max(1, Math.round(image.width * scale));
    const height = Math.max(1, Math.round(image.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      image.close();
      return normalizedFile;
    }

    ctx.drawImage(image, 0, 0, width, height);
    image.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", jpegQuality)
    );

    if (!blob) return normalizedFile;
    if (blob.size >= normalizedFile.size) return normalizedFile;

    return new File([blob], normalizedFile.name.replace(/\.[^/.]+$/, ".jpg"), {
      type: "image/jpeg",
      lastModified: Date.now(),
    });
  } catch (error) {
    console.warn("No se pudo optimizar imagen para análisis, se usa original:", error);
    return normalizedFile;
  }
}
