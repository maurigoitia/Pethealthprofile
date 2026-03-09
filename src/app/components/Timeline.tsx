import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { clsx } from "clsx";
import { MaterialIcon } from "./MaterialIcon";
import { EmptyState } from "./EmptyState";
import { usePet } from "../contexts/PetContext";
import { useMedical } from "../contexts/MedicalContext";
import { MedicalEvent, DocumentType } from "../types/medical";
import { EditEventModal } from "./EditEventModal";
import { formatDateSafe, parseDateSafe, toTimestampSafe } from "../utils/dateUtils";

interface TimelineProps {
  activePet?: { name: string; photo: string };
  onExportReport?: () => void;
}

type TimelineFilter = "all" | "studies" | "diagnosis" | "vaccines" | "treatments";
type ClinicalRenderKind =
  | "appointment_confirmation"
  | "prescription"
  | "treatment_plan"
  | "imaging_report"
  | "laboratory_report"
  | "vaccination_record"
  | "clinical_report"
  | "other";

const FILTERS: { label: string; value: TimelineFilter }[] = [
  { label: "Todos", value: "all" },
  { label: "Estudios", value: "studies" },
  { label: "Diagnósticos", value: "diagnosis" },
  { label: "Vacunas", value: "vaccines" },
  { label: "Tratamientos", value: "treatments" },
];

const STUDY_TYPES: DocumentType[] = ["lab_test", "xray", "echocardiogram", "electrocardiogram"];
const DIAGNOSIS_TYPES: DocumentType[] = ["checkup", "surgery", "other"];
const VACCINE_TYPES: DocumentType[] = ["vaccine"];
const TREATMENT_TYPES: DocumentType[] = ["medication"];

const TYPE_CONFIG: Record<DocumentType, { icon: string; label: string; iconTone: string; badgeTone: string; accent: string }> = {
  vaccine: { icon: "vaccines", label: "Vacuna", iconTone: "bg-emerald-100 text-emerald-600", badgeTone: "bg-emerald-100 text-emerald-700", accent: "#10b981" },
  appointment: { icon: "event", label: "Turno", iconTone: "bg-[#074738]/10 text-[#074738]", badgeTone: "bg-[#074738]/10 text-[#074738]", accent: "#074738" },
  lab_test: { icon: "biotech", label: "Laboratorio", iconTone: "bg-teal-100 text-teal-700", badgeTone: "bg-teal-100 text-teal-700", accent: "#0d9488" },
  xray: { icon: "radiology", label: "Radiografía", iconTone: "bg-violet-100 text-violet-700", badgeTone: "bg-violet-100 text-violet-700", accent: "#7c3aed" },
  echocardiogram: { icon: "monitor_heart", label: "Ecocardiograma", iconTone: "bg-rose-100 text-rose-700", badgeTone: "bg-rose-100 text-rose-700", accent: "#e11d48" },
  electrocardiogram: { icon: "ecg", label: "Electrocardiograma", iconTone: "bg-rose-100 text-rose-700", badgeTone: "bg-rose-100 text-rose-700", accent: "#e11d48" },
  surgery: { icon: "local_hospital", label: "Cirugía", iconTone: "bg-red-100 text-red-700", badgeTone: "bg-red-100 text-red-700", accent: "#dc2626" },
  medication: { icon: "medication", label: "Tratamiento", iconTone: "bg-amber-100 text-amber-700", badgeTone: "bg-amber-100 text-amber-700", accent: "#d97706" },
  checkup: { icon: "stethoscope", label: "Diagnóstico", iconTone: "bg-sky-100 text-sky-700", badgeTone: "bg-sky-100 text-sky-700", accent: "#0284c7" },
  other: { icon: "description", label: "Documento", iconTone: "bg-slate-100 text-slate-600", badgeTone: "bg-slate-100 text-slate-600", accent: "#64748b" },
};

const cleanText = (text?: unknown) => {
  const raw =
    typeof text === "string"
      ? text
      : typeof text === "number" || typeof text === "boolean"
        ? String(text)
        : "";
  return raw
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/#{1,6}\s+/g, "")
    .replace(/`{1,3}[^`]*`{1,3}/g, "")
    .replace(/\n{2,}/g, " ")
    .trim();
};

function getEventTags(isProcessing: boolean): string[] {
  const tags: string[] = [];
  if (isProcessing) tags.push("PROCESANDO");
  return tags;
}

const parseNumeric = (value: unknown): number | null => {
  const raw =
    typeof value === "string"
      ? value
      : typeof value === "number"
        ? String(value)
        : "";
  const normalized = raw.replace(",", ".").trim();
  const numeric = Number(normalized);
  return Number.isFinite(numeric) ? numeric : null;
};

const parseRange = (referenceRange: unknown): { min: number; max: number } | null => {
  if (typeof referenceRange !== "string") return null;
  const match = referenceRange.match(/(-?\d+(?:[.,]\d+)?)\s*[-a]\s*(-?\d+(?:[.,]\d+)?)/i);
  if (!match) return null;
  const min = parseNumeric(match[1]);
  const max = parseNumeric(match[2]);
  if (min == null || max == null) return null;
  return { min, max };
};

function resolveMeasurementStatus(measurement: { value: string; referenceRange: string | null }): "Fuera de rango" | "En rango" | null {
  const range = measurement.referenceRange || "";
  if (range) {
    const numericValue = parseNumeric(measurement.value);
    const parsedRange = parseRange(range);
    if (numericValue != null && parsedRange) {
      return numericValue < parsedRange.min || numericValue > parsedRange.max ? "Fuera de rango" : "En rango";
    }
  }

  const normalized = range.toLowerCase();
  if (!normalized) return null;
  if (/(alto|bajo|alterado|fuera)/.test(normalized)) return "Fuera de rango";
  if (/(normal|dentro de rango|en rango)/.test(normalized)) return "En rango";
  return null;
}

function cleanDiagnosisText(value?: string | null): string {
  const diagnosis = cleanText(value);
  return diagnosis
    .replace(/\bno_especificado\b/gi, "")
    .replace(/\b(nuevo|recurrente|persistente|leve|moderado|severo)\b/gi, "")
    .replace(/[(),]{2,}/g, ",")
    .replace(/\s+,/g, ",")
    .replace(/\s{2,}/g, " ")
    .replace(/(^[;,\s]+)|([;,\s]+$)/g, "")
    .trim();
}

function getExtractedData(event: MedicalEvent): MedicalEvent["extractedData"] {
  const extracted = event?.extractedData;
  if (extracted && typeof extracted === "object") return extracted;
  return {} as MedicalEvent["extractedData"];
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function isSignedStorageUrl(urlValue: string): boolean {
  try {
    const parsed = new URL(urlValue);
    const q = parsed.searchParams;
    return (
      q.has("token") ||
      q.has("X-Goog-Algorithm") ||
      q.has("X-Goog-Credential") ||
      q.has("GoogleAccessId") ||
      q.has("Signature")
    );
  } catch {
    return false;
  }
}

function canOpenDocumentUrl(urlValue?: string | null): boolean {
  const normalized = typeof urlValue === "string" ? urlValue.trim() : "";
  if (!normalized) return false;
  if (!/^https?:\/\//i.test(normalized)) return false;
  if (normalized.includes("firebasestorage.googleapis.com")) {
    return isSignedStorageUrl(normalized);
  }
  return true;
}

function resolveClinicalRenderKind(event: MedicalEvent): ClinicalRenderKind {
  const d = getExtractedData(event);
  const masterType = d.masterClinical?.document_type;
  const sourceText = [
    d.suggestedTitle,
    d.observations,
    d.aiGeneratedSummary,
    d.diagnosis,
    event.title,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const hasDetectedAppointments = (d.detectedAppointments || []).length > 0;
  const hasMasterAppointment = Boolean(d.masterClinical?.appointment_event?.date);
  if (
    d.documentType === "appointment" ||
    masterType === "medical_appointment" ||
    masterType === "appointment" ||
    hasDetectedAppointments ||
    hasMasterAppointment
  ) {
    return "appointment_confirmation";
  }

  if (d.documentType === "vaccine" || masterType === "vaccination_record") return "vaccination_record";
  if (d.documentType === "lab_test" || masterType === "laboratory_result" || masterType === "lab_result") return "laboratory_report";
  if (
    d.documentType === "xray" ||
    d.documentType === "echocardiogram" ||
    d.documentType === "electrocardiogram" ||
    (masterType === "medical_study" && /(radiograf|ecograf|ecg|electro)/i.test(sourceText))
  ) {
    return "imaging_report";
  }

  if (
    d.documentType === "medication" ||
    masterType === "prescription" ||
    /(receta|prescrip|comprimido|cada\s+\d+\s*h)/i.test(sourceText)
  ) {
    if (d.medications?.length > 0) return "prescription";
    return "treatment_plan";
  }

  if (/(plan|sesiones|tratamiento|terapia|hiperb[aá]rica)/i.test(sourceText)) return "treatment_plan";
  if (d.documentType === "checkup" || masterType === "clinical_report" || masterType === "medical_study") return "clinical_report";
  return "other";
}

function buildEventTitle(event: MedicalEvent, petName: string): string {
  const d = getExtractedData(event);
  const kind = resolveClinicalRenderKind(event);
  const cleanTitle = cleanText(event.title || d.suggestedTitle);
  const firstMedication = cleanText(d.medications?.[0]?.name);
  const firstAppointment = d.detectedAppointments?.[0];

  switch (kind) {
    case "appointment_confirmation":
      return `Turno programado${firstAppointment?.specialty ? ` · ${cleanText(firstAppointment.specialty)}` : ""}`;
    case "prescription":
      return firstMedication ? `Receta médica · ${firstMedication}` : "Receta médica";
    case "treatment_plan":
      return cleanTitle || "Plan de tratamiento";
    case "imaging_report":
      if (d.documentType === "xray") return cleanTitle || "Radiografía";
      if (d.documentType === "echocardiogram") return cleanTitle || "Ecocardiograma";
      if (d.documentType === "electrocardiogram") return cleanTitle || "Electrocardiograma";
      return cleanTitle || "Informe por imágenes";
    case "laboratory_report":
      return cleanTitle || "Resultado de laboratorio";
    case "vaccination_record":
      return cleanTitle || "Registro de vacunación";
    case "clinical_report":
      return cleanTitle || `Informe clínico de ${petName}`;
    default:
      return cleanTitle || `Documento clínico de ${petName}`;
  }
}

function buildEventSummary(event: MedicalEvent, petName: string): string {
  const d = getExtractedData(event);
  const measurements = asArray<{ value: unknown; referenceRange: string | null }>(d.measurements);
  const kind = resolveClinicalRenderKind(event);
  const eventDate = formatDateSafe(
    d.eventDate || event.createdAt,
    "es-AR",
    { day: "numeric", month: "long", year: "numeric" },
    "fecha no disponible"
  );
  const provider = cleanText(d.provider);
  const clinic = cleanText(d.clinic);
  const diagnosis = cleanDiagnosisText(d.diagnosis);
  const firstMedication = d.medications?.[0];
  const detected = d.detectedAppointments?.[0] || null;
  const whoWhere = [provider, clinic].filter(Boolean).join(" · ");

  if (kind === "appointment_confirmation") {
    const time = d.appointmentTime || detected?.time;
    const specialty = cleanText(detected?.specialty || "");
    const reason = cleanText(detected?.title || d.suggestedTitle || "consulta veterinaria");
    const appointmentDate = formatDateSafe(
      detected?.date || d.eventDate || event.createdAt,
      "es-AR",
      { day: "numeric", month: "long", year: "numeric" },
      "fecha no disponible"
    );
    return `Turno programado para ${petName}: ${reason}${specialty ? ` (${specialty})` : ""}, ${appointmentDate}${time ? ` a las ${time}` : ""}${whoWhere ? `. Centro/profesional: ${whoWhere}` : ""}.`;
  }

  if (kind === "prescription") {
    if (firstMedication) {
      const dose = cleanText(firstMedication.dosage);
      const freq = cleanText(firstMedication.frequency);
      const details = [dose, freq].filter(Boolean).join(" · ");
      return `Tratamiento indicado para ${petName}: ${cleanText(firstMedication.name)}${details ? ` (${details})` : ""}. Fecha de receta: ${eventDate}${whoWhere ? `. Prescriptor: ${whoWhere}` : ""}.`;
    }
    return `Receta médica registrada para ${petName} el ${eventDate}${whoWhere ? `. Prescriptor: ${whoWhere}` : ""}.`;
  }

  if (kind === "treatment_plan") {
    const treatmentNarrative = cleanText(d.observations || d.aiGeneratedSummary);
    const narrativePrefix = d.aiGeneratedSummary && !d.observations ? "Resumen IA (no canónico): " : "";
    return `Plan terapéutico registrado el ${eventDate} para ${petName}${whoWhere ? `. Centro/profesional: ${whoWhere}` : ""}. ${narrativePrefix}${treatmentNarrative}`;
  }

  if (kind === "imaging_report") {
    if (diagnosis) {
      return `Según informe por imágenes del ${eventDate}, ${petName} presenta: ${diagnosis}${whoWhere ? `. Firmado por ${whoWhere}` : ""}.`;
    }
    return `Estudio por imágenes del ${eventDate} para ${petName}. El documento no incluye interpretación clínica explícita${whoWhere ? ` (${whoWhere})` : ""}.`;
  }

  if (kind === "laboratory_report") {
    const altered = measurements.filter((m) => resolveMeasurementStatus({ value: m.value, referenceRange: m.referenceRange }) === "Fuera de rango").length;
    const total = measurements.length;
    if (total > 0) {
      return `Laboratorio del ${eventDate}: ${altered} de ${total} mediciones fuera de rango${whoWhere ? `. Laboratorio: ${whoWhere}` : ""}.`;
    }
    return `Resultado de laboratorio del ${eventDate}${whoWhere ? `. Laboratorio: ${whoWhere}` : ""}${diagnosis ? `. Interpretación: ${diagnosis}` : ""}.`;
  }

  if (kind === "vaccination_record") {
    return `Vacuna registrada para ${petName} el ${eventDate}${whoWhere ? `. Aplicada en ${whoWhere}` : ""}.`;
  }

  if (kind === "clinical_report" && diagnosis) {
    return `Informe clínico del ${eventDate}: ${petName} presenta ${diagnosis}${whoWhere ? `. Atención en ${whoWhere}` : ""}.`;
  }

  const genericNarrative = cleanText(d.aiGeneratedSummary || d.observations);
  if (d.aiGeneratedSummary) {
    return `Resumen IA (no canónico): ${genericNarrative || `Documento clínico de ${petName} registrado el ${eventDate}.`}`;
  }
  return genericNarrative || `Documento clínico de ${petName} registrado el ${eventDate}.`;
}

function buildMetaPills(event: MedicalEvent, kind: ClinicalRenderKind): string[] {
  const d = getExtractedData(event);
  const measurements = asArray<{ value: unknown; referenceRange: string | null }>(d.measurements);
  const medications = asArray<{ frequency?: string | null; dosage?: string | null }>(d.medications);
  const pills: string[] = [];
  const appointment = d.detectedAppointments?.[0] || null;
  const eventDate = formatDateSafe(
    d.eventDate || event.createdAt,
    "es-AR",
    { day: "2-digit", month: "2-digit", year: "numeric" },
    ""
  );

  if (kind === "appointment_confirmation") {
    const time = d.appointmentTime || appointment?.time;
    const specialty = cleanText(appointment?.specialty);
    if (eventDate) pills.push(eventDate);
    if (time) pills.push(time);
    if (specialty) pills.push(specialty);
    return pills.slice(0, 3);
  }

  if (kind === "prescription") {
    const first = medications[0];
    if (first?.frequency) pills.push(cleanText(first.frequency));
    if (first?.dosage) pills.push(cleanText(first.dosage));
    if (d.provider) pills.push(cleanText(d.provider));
    return pills.slice(0, 3);
  }

  if (kind === "laboratory_report") {
    const total = measurements.length;
    if (total > 0) {
      const altered = measurements.filter((m) =>
        resolveMeasurementStatus({ value: m.value, referenceRange: m.referenceRange }) === "Fuera de rango"
      ).length;
      pills.push(`${altered}/${total} fuera de rango`);
    }
    if (d.provider) pills.push(cleanText(d.provider));
    return pills.slice(0, 3);
  }

  if (kind === "imaging_report") {
    pills.push(d.provider ? "Informe firmado" : "Sin firma clínica");
    if (d.provider) pills.push(cleanText(d.provider));
    return pills.slice(0, 3);
  }

  if (kind === "vaccination_record") {
    if (d.nextAppointmentDate) {
      pills.push(
        `Revacunación ${formatDateSafe(
          d.nextAppointmentDate,
          "es-AR",
          { day: "2-digit", month: "2-digit", year: "numeric" },
          ""
        )}`
      );
    }
    if (d.provider) pills.push(cleanText(d.provider));
    return pills.slice(0, 3);
  }

  if (kind === "treatment_plan") {
    if (medications.length) pills.push(`${medications.length} indicación(es)`);
    if (d.provider) pills.push(cleanText(d.provider));
    return pills.slice(0, 3);
  }

  if (d.provider) pills.push(cleanText(d.provider));
  if (eventDate) pills.push(eventDate);
  return pills.slice(0, 3);
}

function formatEventDate(event: MedicalEvent): string {
  const d = getExtractedData(event);
  const dateStr = d.eventDate || event.createdAt;
  const isFromScan = !d.eventDate;
  const formatted = formatDateSafe(
    dateStr,
    "es-AR",
    { day: "numeric", month: "short", year: "numeric" },
    "Sin fecha"
  );
  return isFromScan ? `${formatted} · escaneo` : formatted;
}

function buildFlowLabel(event: MedicalEvent): string {
  const source = getExtractedData(event) || {};
  const isEmailFlow = Boolean(
    source.sourceSender ||
    source.sourceReceivedAt ||
    source.sourceSubject ||
    source.sourceFileName
  );
  if (isEmailFlow) return "Flujo: sincronización por correo";
  if (event.requiresManualConfirmation || event.workflowStatus === "review_required" || event.status === "draft") {
    return "Flujo: escáner + revisión manual";
  }
  return "Flujo: escáner de documento";
}

const normalizeReviewReason = (value?: string | null) =>
  (value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

function hasIncompleteTreatmentData(event: MedicalEvent): boolean {
  const extracted = getExtractedData(event);
  if (extracted?.treatmentValidationStatus === "needs_review") return true;
  if ((extracted?.treatmentMissingFields || []).length > 0) return true;
  const reasons = event.reviewReasons || [];
  return reasons.some((reason) => {
    const normalized = normalizeReviewReason(reason);
    return normalized.includes("missing_treatment_dose_or_frequency") || normalized.includes("incomplete_data");
  });
}

function getReviewReasonCopy(event: MedicalEvent): string {
  if (hasIncompleteTreatmentData(event)) {
    return "Detectamos medicación sin dosis o frecuencia completa. Pessy bloqueó la activación del tratamiento hasta que lo confirmes.";
  }
  return event.reviewReasons?.[0] || "Este evento quedó para revisión manual antes de consolidarlo.";
}

function matchesFilter(type: DocumentType, filter: TimelineFilter): boolean {
  if (filter === "all") return true;
  if (filter === "studies") return STUDY_TYPES.includes(type);
  if (filter === "diagnosis") return DIAGNOSIS_TYPES.includes(type);
  if (filter === "vaccines") return VACCINE_TYPES.includes(type);
  if (filter === "treatments") return TREATMENT_TYPES.includes(type);
  return true;
}

function getYearKey(event: MedicalEvent): string {
  const raw = getExtractedData(event)?.eventDate || event.createdAt;
  const parsed = parseDateSafe(raw);
  return parsed ? String(parsed.getFullYear()) : "Sin año";
}

export function Timeline({ activePet, onExportReport }: TimelineProps) {
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [activeFilter, setActiveFilter] = useState<TimelineFilter>("all");
  const [showEditModal, setShowEditModal] = useState(false);
  const [eventToEdit, setEventToEdit] = useState<MedicalEvent | null>(null);
  const [eventToDelete, setEventToDelete] = useState<MedicalEvent | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirmingEventId, setConfirmingEventId] = useState<string | null>(null);
  const [deletingEventId, setDeletingEventId] = useState<string | null>(null);

  const { activePetId } = usePet();
  const { getEventsByPetId, confirmEvent, deleteEvent } = useMedical();

  const allEvents = getEventsByPetId(activePetId);

  const filteredSortedEvents = useMemo(
    () =>
      [...allEvents]
        .filter((event) => {
          const type = (getExtractedData(event).documentType || "other") as DocumentType;
          return matchesFilter(type, activeFilter);
        })
        .sort((a, b) => {
          const da = toTimestampSafe(getExtractedData(a)?.eventDate || a.createdAt);
          const db = toTimestampSafe(getExtractedData(b)?.eventDate || b.createdAt);
          return db - da;
        }),
    [allEvents, activeFilter]
  );

  const displayed = showAll ? filteredSortedEvents : filteredSortedEvents.slice(0, 8);

  const groupedByYear = useMemo(() => {
    const map = new Map<string, MedicalEvent[]>();
    for (const event of displayed) {
      const year = getYearKey(event);
      if (!map.has(year)) map.set(year, []);
      map.get(year)!.push(event);
    }
    return [...map.entries()];
  }, [displayed]);

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
          <MaterialIcon name="timeline" className="text-[#074738] text-xl" />
          Historial Médico
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onExportReport?.()}
            className="size-9 rounded-full bg-[#074738]/10 flex items-center justify-center hover:bg-[#074738]/20 transition-colors"
            title="Exportar Reporte"
          >
            <MaterialIcon name="description" className="text-[#074738] text-lg" />
          </button>
          {filteredSortedEvents.length > 8 && (
            <button
              onClick={() => setShowAll(!showAll)}
              className="text-xs font-bold text-[#074738] hover:underline"
            >
              {showAll ? "Ver menos" : `Ver todo (${filteredSortedEvents.length})`}
            </button>
          )}
        </div>
      </div>

      {allEvents.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-2 mb-4 overflow-x-auto no-scrollbar">
          <div className="flex gap-2 min-w-max">
            {FILTERS.map((filter) => (
              <button
                key={filter.value}
                onClick={() => {
                  setActiveFilter(filter.value);
                  setShowAll(false);
                }}
                className={clsx(
                  "px-3 py-2 rounded-xl text-[11px] font-black uppercase tracking-wide whitespace-nowrap transition-all",
                  activeFilter === filter.value
                    ? "bg-[#074738] text-white shadow-lg shadow-[#074738]/25"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                )}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {actionError && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2">
          <p className="text-xs font-semibold text-red-700">{actionError}</p>
        </div>
      )}

      {filteredSortedEvents.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
          <EmptyState
            icon="inbox"
            title={allEvents.length === 0 ? "Sin eventos médicos" : "Sin resultados para este filtro"}
            description={
              allEvents.length === 0
                ? "Los documentos que subas aparecerán aquí automáticamente"
                : "Probá con otro filtro para ver más eventos"
            }
            illustration="medical"
          />
        </div>
      ) : (
        <div className="space-y-8">
          {groupedByYear.map(([year, events], groupIndex) => (
            <div key={year} className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-px bg-slate-200 dark:bg-slate-800 flex-1" />
                <p className="text-[10px] font-black uppercase tracking-[0.35em] text-slate-400">{year}</p>
                <div className="h-px bg-slate-200 dark:bg-slate-800 flex-1" />
              </div>

              <div className="space-y-3">
                {events.map((event, index) => {
                  const isExpanded = expandedEvent === event.id;
                  const isProcessing = event.status === "processing";
                  const isUnderReview =
                    event.requiresManualConfirmation ||
                    event.workflowStatus === "review_required" ||
                    event.workflowStatus === "invalid_future_date" ||
                    event.status === "draft";
                  const isIncompleteTreatmentReview = isUnderReview && hasIncompleteTreatmentData(event);
                  const d = getExtractedData(event);
                  const documentType = (d.documentType || "other") as DocumentType;
                  const cfg = TYPE_CONFIG[documentType] || TYPE_CONFIG.other;
                  const renderKind = resolveClinicalRenderKind(event);
                  const petName = cleanText(activePet?.name) || "la mascota";
                  const summary = buildEventSummary(event, petName);
                  const metaPills = buildMetaPills(event, renderKind);
                  const documentUrl = typeof event.documentUrl === "string" ? event.documentUrl.trim() : "";
                  const canOpenDocument = canOpenDocumentUrl(documentUrl);
                  const medications = asArray<{ name?: unknown; dosage?: unknown; frequency?: unknown }>(d.medications);
                  const measurements = asArray<{ name?: unknown; value?: unknown; unit?: unknown; referenceRange?: string | null }>(d.measurements);
                  const badgeText = isProcessing
                      ? "Procesando"
                      : isIncompleteTreatmentReview
                        ? "Datos incompletos"
                        : isUnderReview
                          ? "Por revisar"
                          : cfg.label;
                  const badgeTone = isIncompleteTreatmentReview
                      ? "bg-red-100 text-red-700 border border-red-200"
                      : isUnderReview
                        ? "bg-slate-100 text-slate-600 border border-slate-200"
                        : cfg.badgeTone;

                  // ── Badge de origen de dato (source-of-truth) ──────────────
                  const sourceTruth = (event as Record<string, unknown>).sourceTruthLevel as string | undefined;
                  const validatedByHuman = (event as Record<string, unknown>).validatedByHuman === true;
                  const sourceOriginBadge: { label: string; tone: string } | null =
                    isUnderReview
                      ? null
                      : validatedByHuman || sourceTruth === "human_confirmed" || sourceTruth === "user_curated"
                        ? { label: "✓ Confirmado", tone: "bg-emerald-50 text-emerald-700 border border-emerald-200" }
                        : sourceTruth === "ai_auto_ingested"
                          ? { label: "IA auto-ingestada", tone: "bg-amber-50 text-amber-700 border border-amber-200" }
                        : sourceTruth === "ai_high_confidence"
                          ? { label: "⚡ Extraído por IA", tone: "bg-blue-50 text-blue-600 border border-blue-200" }
                          : null;
                  // ──────────────────────────────────────────────────────────

                  return (
                    <motion.div
                      key={event.id}
                      layout
                      initial={{ y: 18, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: (groupIndex * 0.04) + (index * 0.03) }}
                    >
                      <button
                        onClick={() => setExpandedEvent(isExpanded ? null : event.id)}
                        className="w-full text-left"
                      >
                        <div className="flex gap-3 items-start">
                          <div className={clsx("size-14 rounded-full flex items-center justify-center shrink-0 border-4 border-white shadow-sm", cfg.iconTone)}>
                            <MaterialIcon
                              name={isProcessing ? "sync" : cfg.icon}
                              className={clsx("text-[28px]", isProcessing && "animate-spin")}
                            />
                          </div>

                          <div className="flex-1 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm rounded-[24px] border border-slate-200/70 dark:border-slate-800/70 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                            <div className="h-1" style={{ backgroundColor: isProcessing ? "#074738" : isIncompleteTreatmentReview ? "#dc2626" : cfg.accent }} />

                            <div className="p-4">
                              <div className="flex items-start justify-between gap-2 mb-2">
                                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{formatEventDate(event)}</p>
                                <span className={clsx(
                                  "px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider",
                                  badgeTone
                                )}>
                                  {badgeText}
                                </span>
                              </div>

                              <h3 className="text-[15px] font-black text-slate-900 dark:text-white leading-tight mb-1.5">
                                {buildEventTitle(event, petName)}
                              </h3>

                              {summary && (
                                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed line-clamp-2">
                                  {summary}
                                </p>
                              )}

                              <div className="flex gap-1.5 flex-wrap mt-2">
                                {metaPills.map((pill, idx) => (
                                  <span
                                    key={`${event.id}-meta-${idx}`}
                                    className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-300"
                                  >
                                    {pill}
                                  </span>
                                ))}
                                {getEventTags(isProcessing).map((tag) => (
                                  <span
                                    key={`${event.id}-${tag}`}
                                    className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-[#074738]/10 text-[#074738]"
                                  >
                                    {tag}
                                  </span>
                                ))}
                              </div>

                              {/* Badge de origen de dato */}
                              {sourceOriginBadge && (
                                <div className="mt-2">
                                  <span className={clsx(
                                    "text-[9px] font-black uppercase tracking-wide px-2 py-0.5 rounded-full",
                                    sourceOriginBadge.tone
                                  )}>
                                    {sourceOriginBadge.label}
                                  </span>
                                </div>
                              )}

                              <div className="flex items-center justify-between mt-2">
                                <div className="flex flex-wrap gap-1.5">
                                  {medications.length > 0 && (
                                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                                      {medications.length} trat.
                                    </span>
                                  )}
                                  {measurements.length > 0 && (
                                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-teal-100 text-teal-700">
                                      {measurements.length} vals.
                                    </span>
                                  )}
                                  {d.nextAppointmentDate && (
                                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#074738]/10 text-[#074738]">
                                      Próx. turno
                                    </span>
                                  )}
                                </div>
                                <MaterialIcon
                                  name={isExpanded ? "expand_less" : "expand_more"}
                                  className="text-slate-400 text-lg shrink-0"
                                />
                              </div>
                            </div>

                            <AnimatePresence>
                              {isExpanded && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: "auto", opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  transition={{ duration: 0.2 }}
                                  className="overflow-hidden"
                                >
                                  <div className="border-t border-slate-100 dark:border-slate-800 px-4 py-3 space-y-3">
                                    {isUnderReview && (
                                      <div className={clsx(
                                        "rounded-xl p-3",
                                        isIncompleteTreatmentReview
                                          ? "bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/40"
                                          : "bg-slate-50 dark:bg-slate-800"
                                      )}>
                                        <p className={clsx(
                                          "text-[10px] font-black uppercase tracking-wide mb-1",
                                          isIncompleteTreatmentReview ? "text-red-700 dark:text-red-300" : "text-slate-500"
                                        )}>
                                          {isIncompleteTreatmentReview ? "Tratamiento bloqueado" : "Pendiente de revisión"}
                                        </p>
                                        <p className={clsx(
                                          "text-xs leading-relaxed",
                                          isIncompleteTreatmentReview ? "text-red-700 dark:text-red-200" : "text-slate-700 dark:text-slate-300"
                                        )}>
                                          {getReviewReasonCopy(event)}
                                        </p>
                                      </div>
                                    )}

                                    {d.diagnosis && renderKind !== "appointment_confirmation" && (
                                      <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3">
                                        <p className="text-[10px] font-black uppercase tracking-wide text-slate-400 mb-1">Diagnóstico / Hallazgo</p>
                                        <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                                          {cleanDiagnosisText(d.diagnosis)}
                                        </p>
                                      </div>
                                    )}

                                    {measurements.length > 0 && (
                                      <div>
                                        <p className="text-[10px] font-black uppercase tracking-wide text-slate-400 mb-2">Mediciones</p>
                                        <div className="grid grid-cols-2 gap-2">
                                          {measurements.map((m, i) => (
                                            <div key={i} className="bg-slate-50 dark:bg-slate-800 rounded-xl p-2.5">
                                              <p className="text-[10px] text-slate-400 mb-0.5">{cleanText(m.name)}</p>
                                              <p className="text-sm font-black text-slate-900 dark:text-white">
                                                {cleanText(m.value)}{m.unit ? ` ${cleanText(m.unit)}` : ""}
                                              </p>
                                              {m.referenceRange && <p className="text-[10px] text-slate-400">ref: {m.referenceRange}</p>}
                                              {resolveMeasurementStatus({ value: m.value, referenceRange: m.referenceRange }) && (
                                                <p
                                                  className={clsx(
                                                    "text-[10px] font-bold mt-0.5",
                                                    resolveMeasurementStatus({ value: m.value, referenceRange: m.referenceRange }) === "Fuera de rango"
                                                      ? "text-rose-600"
                                                      : "text-emerald-600"
                                                  )}
                                                >
                                                  {resolveMeasurementStatus({ value: m.value, referenceRange: m.referenceRange })}
                                                </p>
                                              )}
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}

                                    {medications.length > 0 && (
                                      <div>
                                        <p className="text-[10px] font-black uppercase tracking-wide text-slate-400 mb-2">Medicaciones indicadas</p>
                                        <div className="space-y-1.5">
                                          {medications.map((med, i) => (
                                            <div key={i} className="flex items-center justify-between bg-amber-50 dark:bg-amber-900/20 rounded-xl px-3 py-2">
                                              <span className="text-xs font-bold text-amber-800 dark:text-amber-300">{cleanText(med.name)}</span>
                                              <span className="text-[10px] text-amber-600 dark:text-amber-400">
                                                {[med.dosage, med.frequency].filter(Boolean).map(cleanText).join(" · ")}
                                              </span>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}

                                    {d.nextAppointmentDate && (
                                      <div className="flex items-center gap-3 bg-[#074738]/5 rounded-xl px-3 py-2.5">
                                        <MaterialIcon name="event" className="text-[#074738] text-lg shrink-0" />
                                        <div>
                                          <p className="text-[10px] font-black uppercase tracking-wide text-[#074738] mb-0.5">Próxima cita</p>
                                          <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                            {formatDateSafe(
                                              d.nextAppointmentDate,
                                              "es-AR",
                                              { day: "numeric", month: "long", year: "numeric" },
                                              "Sin fecha"
                                            )}
                                            {d.nextAppointmentReason ? ` — ${cleanText(d.nextAppointmentReason)}` : ""}
                                          </p>
                                        </div>
                                      </div>
                                    )}

                                    <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                                      <MaterialIcon name="hub" className="text-sm" />
                                      <span>{buildFlowLabel(event)}</span>
                                    </div>

                                    <div className="flex gap-2 pt-1">
                                      {documentUrl && canOpenDocument && (
                                        <a
                                          href={documentUrl}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          onClick={(e) => e.stopPropagation()}
                                          className="flex-1 py-2.5 bg-[#074738]/10 text-[#074738] text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 hover:bg-[#074738]/20 transition-colors"
                                        >
                                          <MaterialIcon name={event.fileType === "pdf" ? "picture_as_pdf" : "image"} className="text-sm" />
                                          Ver documento
                                        </a>
                                      )}
                                      {documentUrl && !canOpenDocument && (
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setActionError("No pudimos abrir el documento original porque requiere permisos adicionales de Storage.");
                                          }}
                                          className="flex-1 py-2.5 bg-slate-100 text-slate-500 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5"
                                        >
                                          <MaterialIcon name="lock" className="text-sm" />
                                          Documento restringido
                                        </button>
                                      )}
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setActionError(null);
                                          setEventToEdit(event);
                                          setShowEditModal(true);
                                        }}
                                        className="flex-1 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                                      >
                                        <MaterialIcon name="edit" className="text-sm" />
                                        Editar
                                      </button>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setActionError(null);
                                          setEventToDelete(event);
                                        }}
                                        className="flex-1 py-2.5 bg-red-50 text-red-600 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 hover:bg-red-100 transition-colors"
                                      >
                                        <MaterialIcon
                                          name={deletingEventId === event.id ? "sync" : "delete"}
                                          className={clsx("text-sm", deletingEventId === event.id && "animate-spin")}
                                        />
                                        Eliminar
                                      </button>
                                      {isUnderReview && (
                                        <button
                                          onClick={async (e) => {
                                            e.stopPropagation();
                                            setActionError(null);
                                            setConfirmingEventId(event.id);
                                            try {
                                              await confirmEvent(event.id);
                                            } catch (error) {
                                              const message = error instanceof Error ? error.message : "No se pudo confirmar el evento.";
                                              setActionError(message);
                                            } finally {
                                              setConfirmingEventId(null);
                                            }
                                          }}
                                          className="flex-1 py-2.5 bg-emerald-500 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 hover:bg-emerald-600 transition-colors"
                                        >
                                          <MaterialIcon
                                            name={confirmingEventId === event.id ? "sync" : "check_circle"}
                                            className={clsx("text-sm", confirmingEventId === event.id && "animate-spin")}
                                          />
                                          Confirmar
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        </div>
                      </button>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      <EditEventModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        event={eventToEdit}
      />

      <AnimatePresence>
        {eventToDelete && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                if (deletingEventId) return;
                setEventToDelete(null);
              }}
              className="fixed inset-0 z-50 bg-black/45"
            />
            <motion.div
              initial={{ opacity: 0, y: "100%" }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed inset-x-0 bottom-0 z-50 bg-white dark:bg-slate-900 rounded-t-3xl p-6 shadow-xl"
            >
              <div className="w-10 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mb-5" />
              <div className="flex items-start gap-3 mb-4">
                <div className="size-11 rounded-full bg-red-100 dark:bg-red-950/40 flex items-center justify-center shrink-0">
                  <MaterialIcon name="delete" className="text-xl text-red-500" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">¿Eliminar este evento?</h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Esta acción elimina el registro del historial y no se puede deshacer.
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={Boolean(deletingEventId)}
                  onClick={() => setEventToDelete(null)}
                  className="flex-1 py-3 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-600 dark:text-slate-300 disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={Boolean(deletingEventId)}
                  onClick={async () => {
                    const targetId = eventToDelete.id;
                    setDeletingEventId(targetId);
                    setActionError(null);
                    try {
                      await deleteEvent(targetId);
                      if (expandedEvent === targetId) setExpandedEvent(null);
                      setEventToDelete(null);
                    } catch (error) {
                      const message = error instanceof Error ? error.message : "No se pudo eliminar el evento.";
                      setActionError(message);
                    } finally {
                      setDeletingEventId(null);
                    }
                  }}
                  className="flex-1 py-3 rounded-xl bg-red-600 text-white text-sm font-bold disabled:opacity-60"
                >
                  {deletingEventId ? "Eliminando..." : "Eliminar"}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </section>
  );
}
