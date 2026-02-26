import { ActiveMedication, Appointment, MedicalEvent, PendingAction } from "../types/medical";
import { toDateKeySafe, toTimestampSafe } from "./dateUtils";

function normalizeText(value?: string | null): string {
  return (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[^a-z0-9\s|:-]/g, "");
}

function toDateKey(value?: string | null): string {
  return toDateKeySafe(value);
}

function providerFingerprint(value?: string | null): string {
  const normalized = normalizeText(value)
    .replace(/\bdr\/a\b/g, "")
    .replace(/\bdra\b/g, "")
    .replace(/\bdr\b/g, "")
    .replace(/\bveterinaria\b/g, "")
    .replace(/\bvet\b/g, "")
    .replace(/\bclinica\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) return "";
  return normalized.split(" ")[0] || "";
}

function documentTypeBucket(value?: string | null): string {
  const type = (value || "").toLowerCase();
  if (!type) return "other";
  if (["xray", "echocardiogram", "electrocardiogram", "lab_test", "checkup", "other"].includes(type)) {
    return "study";
  }
  if (["vaccine"].includes(type)) return "vaccine";
  if (["medication"].includes(type)) return "medication";
  if (["appointment"].includes(type)) return "appointment";
  if (["surgery"].includes(type)) return "surgery";
  return type;
}

export function buildEventDedupKey(event: MedicalEvent): string {
  if (event.fileHash) return `hash:${event.fileHash}`;
  if (event.dedupKey) return `dedup:${event.dedupKey}`;

  return buildEventSemanticKey(event);
}

export function buildEventSemanticKey(event: MedicalEvent): string {
  const extracted = event.extractedData;
  const diagnosisSignature = normalizeText(extracted.diagnosis);
  const titleSignature = normalizeText(extracted.suggestedTitle || event.title || event.fileName);
  const measurementSignature = (extracted.measurements || [])
    .map((measurement) => normalizeText(`${measurement.name}|${measurement.value}|${measurement.unit || ""}`))
    .filter(Boolean)
    .sort()
    .join(";");

  const medSignature = (extracted.medications || [])
    .map((med) =>
      normalizeText(`${med.name}|${med.dosage || ""}|${med.frequency || ""}|${med.duration || ""}`)
    )
    .sort()
    .join(";");

  const fallbackSignature = normalizeText(
    [diagnosisSignature, titleSignature, measurementSignature].filter(Boolean).join("|")
  ) || normalizeText(extracted.observations).slice(0, 40) || "sin_firma";

  return [
    "event",
    documentTypeBucket(extracted.documentType),
    toDateKey(extracted.eventDate || event.createdAt),
    providerFingerprint(extracted.provider),
    medSignature || fallbackSignature,
  ].join("|");
}

export function dedupeEvents(events: MedicalEvent[]): MedicalEvent[] {
  const sorted = [...events].sort(
    (a, b) => toTimestampSafe(b.updatedAt || b.createdAt) - toTimestampSafe(a.updatedAt || a.createdAt)
  );
  const seen = new Set<string>();
  const result: MedicalEvent[] = [];

  for (const event of sorted) {
    const key = buildEventDedupKey(event);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(event);
  }

  return result;
}

export function buildPendingActionDedupKey(action: PendingAction): string {
  const baseKey = [
    "pending",
    action.petId,
    action.type,
    toDateKey(action.dueDate),
    normalizeText(action.title),
    normalizeText(action.subtitle),
  ].join("|");

  // Si no hay metadata semántica suficiente, incluir sourceEventId como desempate.
  if (
    action.generatedFromEventId &&
    !normalizeText(action.title) &&
    !normalizeText(action.subtitle) &&
    !toDateKey(action.dueDate)
  ) {
    return `${baseKey}|${action.generatedFromEventId}`;
  }

  return baseKey;
}

export function dedupePendingActions(actions: PendingAction[]): PendingAction[] {
  const sorted = [...actions].sort(
    (a, b) => toTimestampSafe(b.createdAt) - toTimestampSafe(a.createdAt)
  );
  const seen = new Set<string>();
  const result: PendingAction[] = [];

  for (const action of sorted) {
    const key = buildPendingActionDedupKey(action);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(action);
  }

  return result;
}

export function buildMedicationDedupKey(medication: ActiveMedication): string {
  return [
    "med",
    medication.petId,
    normalizeText(medication.name),
    normalizeText(medication.dosage),
    normalizeText(medication.frequency),
    toDateKey(medication.startDate),
    toDateKey(medication.endDate),
  ].join("|");
}

export function dedupeMedications(medications: ActiveMedication[]): ActiveMedication[] {
  const sorted = [...medications].sort(
    (a, b) => toTimestampSafe(b.startDate || b.id) - toTimestampSafe(a.startDate || a.id)
  );
  const seen = new Set<string>();
  const result: ActiveMedication[] = [];

  for (const medication of sorted) {
    const key = buildMedicationDedupKey(medication);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(medication);
  }

  return result;
}

export function buildAppointmentDedupKey(appointment: Appointment): string {
  return [
    "appt",
    appointment.petId,
    appointment.sourceEventId || "",
    appointment.type,
    toDateKey(appointment.date),
    normalizeText(appointment.time),
    normalizeText(appointment.title),
    normalizeText(appointment.clinic),
    normalizeText(appointment.veterinarian),
  ].join("|");
}

export function dedupeAppointments(appointments: Appointment[]): Appointment[] {
  const sorted = [...appointments].sort(
    (a, b) => toTimestampSafe(b.createdAt) - toTimestampSafe(a.createdAt)
  );
  const seen = new Set<string>();
  const result: Appointment[] = [];

  for (const appointment of sorted) {
    const key = buildAppointmentDedupKey(appointment);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(appointment);
  }

  return result;
}
