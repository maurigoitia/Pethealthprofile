import { ActiveMedication, Appointment, MedicalEvent, PendingAction } from "../types/medical";

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
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

export function buildEventDedupKey(event: MedicalEvent): string {
  if (event.fileHash) return `hash:${event.fileHash}`;
  if (event.dedupKey) return `dedup:${event.dedupKey}`;

  const extracted = event.extractedData;
  const medSignature = (extracted.medications || [])
    .map((med) =>
      normalizeText(`${med.name}|${med.dosage || ""}|${med.frequency || ""}|${med.duration || ""}`)
    )
    .sort()
    .join(";");

  const fallbackSignature = normalizeText(
    extracted.observations || extracted.diagnosis || extracted.suggestedTitle || event.title || event.fileName
  ).slice(0, 120);

  return [
    "event",
    extracted.documentType,
    toDateKey(extracted.eventDate || event.createdAt),
    normalizeText(extracted.provider),
    medSignature || fallbackSignature,
  ].join("|");
}

export function dedupeEvents(events: MedicalEvent[]): MedicalEvent[] {
  const sorted = [...events].sort(
    (a, b) =>
      new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime()
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
  return [
    "pending",
    action.petId,
    action.type,
    toDateKey(action.dueDate),
    normalizeText(action.title),
    normalizeText(action.subtitle),
  ].join("|");
}

export function dedupePendingActions(actions: PendingAction[]): PendingAction[] {
  const sorted = [...actions].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
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
    (a, b) => new Date(b.startDate || b.id).getTime() - new Date(a.startDate || a.id).getTime()
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
    (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
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
