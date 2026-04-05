import { createContext, useContext, useState, ReactNode, useEffect } from "react";
import { db } from "../../lib/firebase";
import { collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, doc, setDoc, getDoc, getDocs } from "firebase/firestore";
import { usePet } from "./PetContext";
import { useAuth } from "./AuthContext";
import {
  MedicalEvent,
  PendingAction,
  ClinicalReviewDraft,
  ActiveMedication,
  MonthSummary,
  DocumentType,
  Appointment,
  ClinicalCondition,
  ClinicalAlert,
  TreatmentEntity,
  ProactiveCareAlert,
} from "../types/medical";
import {
  buildEventDedupKey,
  buildEventSemanticKey,
  buildMedicationDedupKey,
  buildPendingActionDedupKey,
  dedupeAppointments,
  dedupeEvents,
  dedupeMedications,
  dedupePendingActions,
} from "../utils/deduplication";
import { parseDateSafe, toTimestampSafe } from "../utils/dateUtils";
import {
  buildAlertId,
  buildAppointmentEntityId,
  buildConditionId,
  buildMedicalEventEntityPayload,
  buildTreatmentId,
  computeConditionPattern,
  computeConditionStatus,
  hasFollowupKeyword,
  slugifyKey,
} from "../utils/clinicalBrain";
import { syncAppointmentWithGoogleCalendar } from "../services/calendarSyncService";
import { isEmailSyncEnabled, isFocusHistoryExperimentHost } from "../utils/runtimeFlags";

// Kill-switch operativo: desactiva visualización de datos provenientes de sincronización por mail.
const EMAIL_SYNC_ENABLED = isEmailSyncEnabled();

// ─── Tipos episódicos (mirror de episodeCompiler) ──────────────────────────────
export interface ClinicalEpisodeMedication {
  name: string;
  dosage: string | null;
  frequency: string | null;
}

export interface ClinicalEpisode {
  id: string;
  userId: string;
  petId: string;
  petName: string;
  date: string;
  timestamp: string;
  episodeType: "consultation" | "vaccination" | "prescription" | "appointment" | "study" | "laboratory" | "mixed";
  headline: string;
  summary: string;
  diagnoses: string[];
  medications: ClinicalEpisodeMedication[];
  studies: string[];
  provider: { name: string | null; clinic: string | null; specialty: string | null };
  sourceEventIds: string[];
  confidence: number;
  status: "confirmed" | "draft" | "needs_clean_upload";
  sourceMode: string;
  updatedAt: string;
}

export interface ClinicalProfileSnapshot {
  id: string;
  userId: string;
  petId: string;
  petName: string;
  generatedAt: string;
  activeConditions: string[];
  pastConditions: string[];
  currentMedications: Array<{ name: string; dosage: string | null; frequency: string | null }>;
  allergies: string[];
  recurrentPathologies: string[];
  narrative: string;
  sourceEpisodeIds: string[];
}

const normalizeForHint = (value?: string | null) =>
  (value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const hasMailSyncHint = (value?: string | null) => {
  const text = normalizeForHint(value);
  if (!text) return false;
  return /(correo|mail|gmail|sincroniz|sync)/.test(text);
};

const normalizeMedicationKey = (value?: string | null) =>
  (value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const extractTimeFromText = (value?: string | null): string | null => {
  const text = (value || "").trim();
  const match = text.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
  if (!match) return null;
  return `${match[1].padStart(2, "0")}:${match[2]}`;
};

const hasAppointmentLanguage = (value?: string | null): boolean => {
  const text = normalizeForHint(value);
  if (!text) return false;
  return /(turno|consulta|control|recordatorio|confirmacion|confirmado|agendad|programad|reprogramad|cancelad|cita)/.test(text);
};

const extractSpecialtyFromText = (value?: string | null): string | null => {
  const text = (value || "").trim();
  const match = text.match(/\b(?:consulta|control|turno)\s+([a-záéíóúñ]+(?:\s+[a-záéíóúñ]+){0,3})/i);
  return match?.[1]?.trim() || null;
};

const deriveAppointmentCandidateFromEvent = (event: MedicalEvent): Appointment | null => {
  const extracted = event.extractedData || {};
  const sourceText = [
    extracted.sourceSubject,
    extracted.suggestedTitle,
    extracted.observations,
    extracted.aiGeneratedSummary,
    event.title,
  ]
    .filter(Boolean)
    .join(" · ");
  const detectedRows = Array.isArray(extracted.detectedAppointments) ? extracted.detectedAppointments : [];
  const detected = (detectedRows[0] || {}) as Record<string, unknown>;
  const rawDate =
    (typeof detected.date === "string" ? detected.date : "") ||
    extracted.nextAppointmentDate ||
    extracted.eventDate ||
    "";
  const parsedDate = parseDateSafe(rawDate);
  if (!parsedDate) return null;

  const endOfYesterday = new Date();
  endOfYesterday.setHours(0, 0, 0, 0);
  if (parsedDate.getTime() < endOfYesterday.getTime()) return null;

  const explicitAppointment =
    extracted.documentType === "appointment" ||
    detectedRows.length > 0 ||
    Boolean(extracted.appointmentTime);
  if (!explicitAppointment && !hasAppointmentLanguage(sourceText)) return null;

  const title =
    (typeof detected.title === "string" ? detected.title.trim() : "") ||
    extracted.suggestedTitle ||
    event.title ||
    "Turno veterinario";
  const time =
    extracted.appointmentTime ||
    (typeof detected.time === "string" ? detected.time : "") ||
    extractTimeFromText(sourceText) ||
    "";
  const veterinarian =
    extracted.provider ||
    (typeof detected.provider === "string" ? detected.provider : "") ||
    null;
  const clinic =
    extracted.clinic ||
    (typeof detected.clinic === "string" ? detected.clinic : "") ||
    null;
  const specialty =
    (typeof detected.specialty === "string" ? detected.specialty.trim() : "") ||
    extractSpecialtyFromText(sourceText) ||
    "";

  if (!explicitAppointment && !time && !veterinarian && !clinic && !specialty) return null;

  const normalizedTitle = title.trim();
  return {
    id: `auto_${event.id}`,
    petId: event.petId,
    userId: event.userId,
    ownerId: event.userId,
    sourceEventId: event.id,
    sourceSuggestionKey: `${event.id}|${rawDate}|${time}|${normalizedTitle.toLowerCase()}`,
    autoGenerated: true,
    type: extracted.documentType === "vaccine" ? "vaccine" : "checkup",
    title: normalizedTitle,
    date: rawDate,
    time,
    veterinarian,
    clinic,
    status: /cancelad/i.test(sourceText) ? "cancelled" : "upcoming",
    notes: sourceText.slice(0, 500),
    createdAt: event.createdAt,
  };
};

const isMailSyncedEvent = (event: MedicalEvent): boolean => {
  if (EMAIL_SYNC_ENABLED) return false;
  const extracted = event.extractedData || {};
  if (
    extracted.sourceSender ||
    extracted.sourceReceivedAt ||
    extracted.sourceSubject ||
    extracted.sourceFileName
  ) {
    return true;
  }

  const reviewHints = event.reviewReasons || [];
  const textHints = [
    event.title,
    extracted.suggestedTitle,
    extracted.observations,
    extracted.aiGeneratedSummary,
    ...reviewHints,
  ];
  return textHints.some((value) => hasMailSyncHint(value));
};

const isMailSyncedPendingAction = (action: PendingAction): boolean => {
  if (EMAIL_SYNC_ENABLED) return false;
  if (action.type === "sync_review") return true;
  return hasMailSyncHint(action.title) || hasMailSyncHint(action.subtitle);
};

const normalizeProactiveScope = (value: string): string =>
  (value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48) || "alerta";

const toIsoAtLocalTime = (dateKey: string | null, hour = 9, minute = 0): string | null => {
  if (!dateKey) return null;
  const parsed = parseDateSafe(`${dateKey}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00`);
  return parsed ? parsed.toISOString() : null;
};

const shiftIsoByMs = (iso: string | null, ms: number): string | null => {
  if (!iso) return null;
  const parsed = parseDateSafe(iso);
  if (!parsed) return null;
  return new Date(parsed.getTime() + ms).toISOString();
};

const mapProactiveAlertToPendingType = (alertType: ProactiveCareAlert["type"]): PendingAction["type"] => {
  if (alertType === "vaccine") return "vaccine_due";
  if (alertType === "medication") return "medication_refill";
  return "follow_up";
};

const mapProactiveAlertToNotificationType = (
  alertType: ProactiveCareAlert["type"]
): "medication" | "appointment" | "vaccine_reminder" => {
  if (alertType === "vaccine") return "vaccine_reminder";
  if (alertType === "medication") return "medication";
  return "appointment";
};

interface MedicalContextType {
  events: MedicalEvent[];
  addEvent: (event: MedicalEvent) => Promise<boolean>;
  updateEvent: (id: string, updates: Partial<MedicalEvent>) => Promise<void>;
  deleteEvent: (id: string) => Promise<void>;
  confirmEvent: (id: string, overrides?: Partial<MedicalEvent>) => Promise<void>;
  getEventsByPetId: (petId: string) => MedicalEvent[];

  pendingActions: PendingAction[];
  addPendingAction: (action: PendingAction) => Promise<void>;
  completePendingAction: (id: string) => Promise<void>;
  deletePendingAction: (id: string) => Promise<void>;
  getPendingActionsByPetId: (petId: string) => PendingAction[];
  getClinicalReviewDraftById: (reviewId: string) => Promise<ClinicalReviewDraft | null>;
  submitClinicalReviewDraft: (
    reviewId: string,
    payload: {
      medications: Array<{
        name: string;
        dosage: string;
        frequency: string;
        duration?: string | null;
      }>;
      eventDate?: string | null;
    }
  ) => Promise<void>;

  activeMedications: ActiveMedication[];
  addMedication: (medication: ActiveMedication) => Promise<void>;
  updateMedication: (id: string, updates: Partial<ActiveMedication>) => Promise<void>;
  deactivateMedication: (id: string) => Promise<void>;
  getActiveMedicationsByPetId: (petId: string) => ActiveMedication[];

  getMonthSummary: (petId: string, month: Date) => MonthSummary;
  saveVerifiedReport: (report: Record<string, unknown>) => Promise<string>;

  appointments: Appointment[];
  addAppointment: (appointment: Appointment) => Promise<void>;
  updateAppointment: (id: string, updates: Partial<Appointment>) => Promise<void>;
  deleteAppointment: (id: string) => Promise<void>;
  getAppointmentsByPetId: (petId: string) => Appointment[];

  clinicalConditions: ClinicalCondition[];
  clinicalAlerts: ClinicalAlert[];
  consolidatedTreatments: TreatmentEntity[];
  getClinicalConditionsByPetId: (petId: string) => ClinicalCondition[];
  getClinicalAlertsByPetId: (petId: string) => ClinicalAlert[];
  getConsolidatedTreatmentsByPetId: (petId: string) => TreatmentEntity[];

  // ─── Modelo episódico (solo con flag experimental) ────────────────────────────
  clinicalEpisodes: ClinicalEpisode[];
  clinicalProfileSnapshot: ClinicalProfileSnapshot | null;
  getClinicalEpisodesByPetId: (petId: string) => ClinicalEpisode[];
  getProfileSnapshotByPetId: (petId: string) => ClinicalProfileSnapshot | null;
}

const MedicalContext = createContext<MedicalContextType | undefined>(undefined);

export function MedicalProvider({ children }: { children: ReactNode }) {
  const { activePet } = usePet();
  const { user } = useAuth();
  const [events, setEvents] = useState<MedicalEvent[]>([]);
  const [pendingActions, setPendingActions] = useState<PendingAction[]>([]);
  const [activeMedications, setActiveMedications] = useState<ActiveMedication[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [clinicalConditions, setClinicalConditions] = useState<ClinicalCondition[]>([]);
  const [clinicalAlerts, setClinicalAlerts] = useState<ClinicalAlert[]>([]);
  const [consolidatedTreatments, setConsolidatedTreatments] = useState<TreatmentEntity[]>([]);

  // ─── Estado episódico (solo con flag experimental) ───────────────────────────
  const [clinicalEpisodes, setClinicalEpisodes] = useState<ClinicalEpisode[]>([]);
  const [clinicalProfileSnapshot, setClinicalProfileSnapshot] = useState<ClinicalProfileSnapshot | null>(null);

  const isMedicationCurrentlyActive = (medication: ActiveMedication): boolean => {
    if (!medication.active) return false;
    if (!medication.endDate) return true;

    const endDateRaw = medication.endDate.trim();
    if (!endDateRaw) return true;

    // Si viene solo fecha (YYYY-MM-DD), consideramos activo hasta fin de ese día local.
    if (/^\d{4}-\d{2}-\d{2}$/.test(endDateRaw)) {
      const parsedDate = parseDateSafe(endDateRaw);
      if (!parsedDate) return true;
      const endOfDay = new Date(parsedDate);
      endOfDay.setHours(23, 59, 59, 999);
      return endOfDay.getTime() >= Date.now();
    }

    const endTs = toTimestampSafe(endDateRaw, Number.NaN);
    if (!Number.isFinite(endTs)) return true;
    return endTs >= Date.now();
  };

  const parseDurationToEndDate = (duration: string | null | undefined, startDateIso: string): string | null => {
    if (!duration) return null;
    const normalized = duration.toLowerCase().trim();

    if (
      normalized.includes("cronic") ||
      normalized.includes("indefin") ||
      normalized.includes("continu")
    ) {
      return null;
    }

    const match = normalized.match(/(\d+)\s*(día|dias|días|semana|semanas|mes|meses)/i);
    if (!match) return null;

    const quantity = Number(match[1]);
    const unit = match[2].toLowerCase();
    if (!Number.isFinite(quantity) || quantity <= 0) return null;

    const startDate = parseDateSafe(startDateIso);
    if (!startDate) return null;

    const end = new Date(startDate);
    if (unit.startsWith("día") || unit.startsWith("dia")) end.setDate(end.getDate() + quantity);
    if (unit.startsWith("semana")) end.setDate(end.getDate() + quantity * 7);
    if (unit.startsWith("mes")) end.setMonth(end.getMonth() + quantity);

    return end.toISOString();
  };

  const syncAutoAppointmentFromEvent = async (event: MedicalEvent) => {
    if (!event?.id) return;
    const autoRef = doc(db, "appointments", `auto_${event.id}`);
    await deleteDoc(autoRef).catch(() => undefined);

    const alreadyPersisted = appointments.some(
      (appointment) => appointment.sourceEventId === event.id && appointment.id !== `auto_${event.id}`
    );
    if (alreadyPersisted) return;

    const candidate = deriveAppointmentCandidateFromEvent(event);
    if (!candidate) return;
    await setDoc(autoRef, candidate, { merge: true });
  };

  const persistDerivedDataFromEvent = async (event: MedicalEvent) => {
    if (event.derivedDataPersistedAt) return;
    if (!event.extractedData?.medications || event.extractedData.medications.length === 0) return;

    // Verificar contra Firestore (no el argumento) para evitar race conditions
    const freshSnap = await getDoc(doc(db, "medical_events", event.id));
    if (freshSnap.exists() && freshSnap.data()?.derivedDataPersistedAt) return;

    const treatmentStart = event.extractedData?.eventDate || event.createdAt;

    for (let idx = 0; idx < (event.extractedData?.medications?.length ?? 0); idx++) {
      const medicationExtracted = event.extractedData.medications[idx];
      const treatmentEnd = parseDurationToEndDate(medicationExtracted.duration, treatmentStart);
      // ID determinístico basado en evento + índice — evita duplicados si se re-ejecuta
      const medName = (medicationExtracted.name || "").toLowerCase().replace(/[^a-z0-9]/g, "_").slice(0, 40);
      const medication: ActiveMedication = {
        id: `med_${event.id}_${idx}_${medName}`,
        petId: event.petId,
        userId: event.userId || user?.uid,
        name: medicationExtracted.name,
        dosage: medicationExtracted.dosage || "",
        frequency: medicationExtracted.frequency || "",
        type: "Receta",
        startDate: treatmentStart,
        endDate: treatmentEnd,
        prescribedBy: event.extractedData.provider || null,
        generatedFromEventId: event.id,
        active: true,
      };
      await addMedication(medication);
    }

    await updateDoc(doc(db, "medical_events", event.id), {
      derivedDataPersistedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  };

  const syncProactiveCareFromEvent = async (event: MedicalEvent) => {
    const proactivePlan = event.extractedData?.proactiveCarePlan;
    if (!event?.id || !event.petId || !proactivePlan) return;

    const userId = event.userId || user?.uid || "";
    if (!userId) return;

    const petName = activePet?.id === event.petId ? (activePet.name || "Tu mascota") : "Tu mascota";
    const nowIso = new Date().toISOString();
    const nowTs = Date.now();

    const desiredPendingIds = new Set<string>();
    const desiredNotificationIds = new Set<string>();

    for (let index = 0; index < (proactivePlan.alerts || []).length; index += 1) {
      const alert = proactivePlan.alerts[index];
      if (!alert?.dueDate) continue;

      const dueIso = toIsoAtLocalTime(alert.dueDate, 9, 0);
      if (!dueIso) continue;
      const dueTs = toTimestampSafe(dueIso);

      const scope = `${normalizeProactiveScope(alert.title)}_${normalizeProactiveScope(alert.dueDate)}_${index}`;
      const pendingId = `proactive_${event.id}_${scope}`.slice(0, 140);
      desiredPendingIds.add(pendingId);

      await setDoc(doc(db, "pending_actions", pendingId), {
        petId: event.petId,
        userId,
        type: mapProactiveAlertToPendingType(alert.type),
        title: alert.title || "Para revisar",
        subtitle: alert.reason || "Para revisar.",
        dueDate: dueIso,
        createdAt: nowIso,
        generatedFromEventId: event.id,
        autoGenerated: true,
        completed: false,
        completedAt: null,
        reminderEnabled: true,
        reminderDaysBefore: alert.type === "medication" ? 0 : 7,
        sourceTag: "proactive_care",
      }, { merge: true });

      const notificationType = mapProactiveAlertToNotificationType(alert.type);
      const baseBody = alert.reason || `Recordatorio clínico: ${alert.title || "Seguimiento"}`;
      const sameDayId = `proactive_notif_${event.id}_${scope}_d0`.slice(0, 160);
      const weekBeforeId = `proactive_notif_${event.id}_${scope}_d7`.slice(0, 160);

      if (dueTs > nowTs) {
        desiredNotificationIds.add(sameDayId);
        await setDoc(doc(db, "scheduled_notifications", sameDayId), {
          userId,
          petId: event.petId,
          petName,
          type: notificationType,
          title: `Hoy: ${alert.title || "seguimiento clínico"}`,
          body: baseBody,
          scheduledFor: dueIso,
          sourceEventId: event.id,
          repeat: "none",
          repeatInterval: null,
          active: true,
          sent: false,
          createdAt: nowIso,
          sourceTag: "proactive_care",
        }, { merge: true });
      }

      const weekBeforeIso = shiftIsoByMs(dueIso, -7 * 24 * 60 * 60 * 1000);
      const weekBeforeTs = toTimestampSafe(weekBeforeIso);
      if (weekBeforeIso && weekBeforeTs > nowTs) {
        desiredNotificationIds.add(weekBeforeId);
        await setDoc(doc(db, "scheduled_notifications", weekBeforeId), {
          userId,
          petId: event.petId,
          petName,
          type: notificationType,
          title: `Próximo control: ${alert.title || "seguimiento clínico"}`,
          body: baseBody,
          scheduledFor: weekBeforeIso,
          sourceEventId: event.id,
          repeat: "none",
          repeatInterval: null,
          active: true,
          sent: false,
          createdAt: nowIso,
          sourceTag: "proactive_care",
        }, { merge: true });
      }
    }

    const [pendingSnap, notificationsSnap] = await Promise.all([
      getDocs(query(collection(db, "pending_actions"), where("generatedFromEventId", "==", event.id))),
      getDocs(query(collection(db, "scheduled_notifications"), where("sourceEventId", "==", event.id))),
    ]);

    const cleanupPendingPromises: Promise<void>[] = [];
    for (const row of pendingSnap.docs) {
      const data = row.data() as Record<string, unknown>;
      if (data.sourceTag !== "proactive_care") continue;
      if (desiredPendingIds.has(row.id)) continue;
      cleanupPendingPromises.push(deleteDoc(row.ref));
    }

    const cleanupNotificationPromises: Promise<void>[] = [];
    for (const row of notificationsSnap.docs) {
      const data = row.data() as Record<string, unknown>;
      if (data.sourceTag !== "proactive_care") continue;
      if (data.sent === true) continue;
      if (desiredNotificationIds.has(row.id)) continue;
      cleanupNotificationPromises.push(deleteDoc(row.ref));
    }

    await Promise.all([...cleanupPendingPromises, ...cleanupNotificationPromises]);
  };

  const mergeUnique = (a: string[] = [], b: string[] = []) => Array.from(new Set([...(a || []), ...(b || [])]));

  const upsertClinicalAlert = async (alert: ClinicalAlert) => {
    const ref = doc(db, "clinical_alerts", alert.id);
    const prevSnap = await getDoc(ref);
    if (!prevSnap.exists()) {
      await setDoc(ref, alert);
      return;
    }
    const prev = prevSnap.data() as ClinicalAlert;
    await setDoc(ref, {
      ...prev,
      ...alert,
      triggeredOn: prev.triggeredOn || alert.triggeredOn,
      lastSeenOn: alert.lastSeenOn,
      status: alert.status,
      linkedConditionIds: mergeUnique(prev.linkedConditionIds, alert.linkedConditionIds),
      linkedEventIds: mergeUnique(prev.linkedEventIds, alert.linkedEventIds),
      linkedAppointmentIds: mergeUnique(prev.linkedAppointmentIds, alert.linkedAppointmentIds),
    }, { merge: true });
  };

  const resolveClinicalAlert = async (alertId: string, notes: string) => {
    const ref = doc(db, "clinical_alerts", alertId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return;
    const prev = snap.data() as ClinicalAlert;
    if (prev.status !== "active") return;
    await updateDoc(ref, {
      status: "resolved",
      resolutionNotes: notes,
      lastSeenOn: new Date().toISOString(),
    });
  };

  const upsertClinicalBrainFromEvent = async (event: MedicalEvent) => {
    if (!event?.id || !event.petId) return;

    const nowIso = new Date().toISOString();
    const eventEntity = buildMedicalEventEntityPayload(event);

    // Normalización persistida sobre el evento (snapshot inmutable una vez confirmado).
    const eventRef = doc(db, "medical_events", event.id);
    const eventSnap = await getDoc(eventRef);
    const isSnapshotFrozen = Boolean(eventSnap.exists() && eventSnap.data()?.protocolSnapshotFrozenAt);
    if (!isSnapshotFrozen) {
      await setDoc(eventRef, {
        eventId: eventEntity.event_id,
        sourceDocumentId: eventEntity.source_document_id,
        documentType: eventEntity.document_type,
        eventDate: eventEntity.event_date,
        clinic: eventEntity.clinic,
        professional: eventEntity.professional,
        diagnosesDetected: eventEntity.diagnoses_detected,
        abnormalFindings: eventEntity.abnormal_findings,
        treatmentsDetected: eventEntity.treatments_detected,
        appointmentsDetected: eventEntity.appointments_detected,
        recommendations: eventEntity.recommendations,
        protocolSnapshotFrozenAt: nowIso,
      }, { merge: true });
    }

    const linkedConditionIds: string[] = [];
    const recentConditionIds: string[] = [];

    for (const diagnosis of eventEntity.diagnoses_detected) {
      const conditionId = buildConditionId(event.petId, diagnosis.normalized_name);
      recentConditionIds.push(conditionId);
      const conditionRef = doc(db, "clinical_conditions", conditionId);
      const prevSnap = await getDoc(conditionRef);
      const prev = prevSnap.exists() ? (prevSnap.data() as ClinicalCondition) : null;

      const priorEvidence = prev?.evidenceEventIds || [];
      const alreadyLinked = priorEvidence.includes(event.id);
      const evidenceEventIds = mergeUnique(priorEvidence, [event.id]);
      const occurrencesCount = alreadyLinked ? (prev?.occurrencesCount || 1) : (prev?.occurrencesCount || 0) + 1;

      const firstDetectedDate = prev?.firstDetectedDate || eventEntity.event_date || nowIso.slice(0, 10);
      const prevLast = prev?.lastDetectedDate || firstDetectedDate;
      const candidateLast = eventEntity.event_date || prevLast;
      const lastDetectedDate = toTimestampSafe(candidateLast) > toTimestampSafe(prevLast) ? candidateLast : prevLast;

      const pattern = computeConditionPattern(firstDetectedDate, lastDetectedDate, occurrencesCount);
      const status = computeConditionStatus(pattern);
      const relatedLabFlags = mergeUnique(prev?.relatedLabFlags || [], eventEntity.abnormal_findings.map((f) => `${f.parameter}:${f.status}`));

      await setDoc(conditionRef, {
        petId: event.petId,
        normalizedName: diagnosis.normalized_name,
        organSystem: diagnosis.organ_system || prev?.organSystem || null,
        firstDetectedDate,
        lastDetectedDate,
        occurrencesCount,
        status,
        pattern,
        evidenceEventIds,
        relatedLabFlags,
        lastSummaryUpdateAt: nowIso,
      }, { merge: true });

      linkedConditionIds.push(conditionId);

      const diagnosisId = `dx_${event.id}_${slugifyKey(diagnosis.normalized_name)}`;
      await setDoc(doc(db, "diagnoses", diagnosisId), {
        petId: event.petId,
        conditionId,
        eventId: event.id,
        date: eventEntity.event_date,
        rawLabel: diagnosis.raw_label || null,
        severity: diagnosis.severity || null,
        notes: null,
      }, { merge: true });
    }

    for (const treatment of eventEntity.treatments_detected) {
      const treatmentId = buildTreatmentId(event.petId, treatment.normalized_name, treatment.start_date);
      const treatmentRef = doc(db, "treatments", treatmentId);
      const prevSnap = await getDoc(treatmentRef);
      const prev = prevSnap.exists() ? (prevSnap.data() as TreatmentEntity) : null;

      const evidenceEventIds = mergeUnique(prev?.evidenceEventIds || [], [event.id]);
      const linkedByEvent = mergeUnique(prev?.linkedConditionIds || [], linkedConditionIds);

      await setDoc(treatmentRef, {
        petId: event.petId,
        normalizedName: treatment.normalized_name,
        subtype: prev?.subtype || "other",
        startDate: treatment.start_date || prev?.startDate || eventEntity.event_date,
        endDate: treatment.end_date || prev?.endDate || null,
        status: treatment.status,
        linkedConditionIds: linkedByEvent,
        evidenceEventIds,
        prescribingProfessional: {
          name: eventEntity.professional.name || prev?.prescribingProfessional?.name || null,
          license: eventEntity.professional.license || prev?.prescribingProfessional?.license || null,
        },
        clinic: {
          name: eventEntity.clinic.name || prev?.clinic?.name || null,
        },
        dosage: treatment.dosage || prev?.dosage || null,
        frequency: treatment.frequency || prev?.frequency || null,
        createdAt: prev?.createdAt || nowIso,
        updatedAt: nowIso,
      }, { merge: true });
    }

    const createdAppointmentIds: string[] = [];
    for (const appointmentDetected of eventEntity.appointments_detected) {
      if (!appointmentDetected.date) continue;
      const appointmentId = buildAppointmentEntityId(event.petId, appointmentDetected);
      createdAppointmentIds.push(appointmentId);
      const appointmentDateTs = toTimestampSafe(`${appointmentDetected.date}T${appointmentDetected.time || "00:00"}:00`);
      const status: Appointment["status"] = appointmentDateTs >= Date.now() ? "upcoming" : "completed";
      const type: Appointment["type"] = /vacun/i.test(appointmentDetected.procedure || "") ? "vaccine" : "other";

      await setDoc(doc(db, "appointments", appointmentId), {
        petId: event.petId,
        userId: event.userId || user?.uid || "",
        ownerId: event.userId || user?.uid || "",
        petName: activePet?.name || "",
        sourceEventId: event.id,
        autoGenerated: false,
        type,
        title: appointmentDetected.procedure || appointmentDetected.specialty || "Turno médico",
        date: appointmentDetected.date,
        time: appointmentDetected.time || "00:00",
        veterinarian: appointmentDetected.professional_name || null,
        clinic: appointmentDetected.clinic_name || null,
        status,
        notes: appointmentDetected.preparation_required || null,
        linkedRecommendationConditionIds: eventEntity.recommendations.some(hasFollowupKeyword) ? linkedConditionIds : [],
        evidenceEventId: event.id,
        createdAt: nowIso,
      }, { merge: true });
    }

    const isMedicalAppointmentDoc =
      eventEntity.document_type === "medical_appointment" ||
      eventEntity.document_type === "appointment";

    // Protocolo: los documentos de turno no generan diagnósticos/alertas clínicas.
    if (isMedicalAppointmentDoc) {
      return;
    }

    // R1: lab fuera de rango
    const isLabLike = ["laboratory_result", "lab_result", "lab_test", "clinical_report"].includes(eventEntity.document_type);
    if (eventEntity.abnormal_findings.length > 0) {
      for (const finding of eventEntity.abnormal_findings) {
        const alertId = buildAlertId(event.petId, "R1_out_of_range", finding.parameter);
        await upsertClinicalAlert({
          id: alertId,
          petId: event.petId,
          type: "out_of_range",
          severity: "medium",
          title: `Valor fuera de rango: ${finding.parameter}`,
          description: `${finding.parameter} reportado como ${finding.status}. Revisar seguimiento clínico.`,
          triggeredOn: nowIso,
          lastSeenOn: nowIso,
          status: "active",
          resolutionNotes: null,
          linkedConditionIds: linkedConditionIds,
          linkedEventIds: [event.id],
          linkedAppointmentIds: [],
          ruleId: "R1_out_of_range",
        });
      }
    } else if (isLabLike) {
      // Leer directo de Firestore para evitar stale closures del estado React
      const activeOutOfRangeSnap = await getDocs(
        query(collection(db, "clinical_alerts"),
          where("petId", "==", event.petId),
          where("type", "==", "out_of_range"),
          where("status", "==", "active"),
        )
      );
      const activeOutOfRange = activeOutOfRangeSnap.docs.map(d => ({ id: d.id, ...d.data() } as ClinicalAlert));
      for (const alert of activeOutOfRange) {
        await resolveClinicalAlert(alert.id, "Normalizado en control posterior sin hallazgos alterados.");
      }
    }

    // R2: condición persistente
    for (const conditionId of recentConditionIds) {
      const conditionSnap = await getDoc(doc(db, "clinical_conditions", conditionId));
      if (!conditionSnap.exists()) continue;
      const condition = conditionSnap.data() as ClinicalCondition;
      const alertId = buildAlertId(event.petId, "R2_condition_persistent", condition.normalizedName);
      if (condition.occurrencesCount >= 2) {
        await upsertClinicalAlert({
          id: alertId,
          petId: event.petId,
          type: "condition_persistent",
          severity: condition.pattern === "chronic" ? "high" : "medium",
          title: `Condición persistente: ${condition.normalizedName}`,
          description: `Detectada ${condition.occurrencesCount} veces entre ${condition.firstDetectedDate || "—"} y ${condition.lastDetectedDate || "—"}.`,
          triggeredOn: nowIso,
          lastSeenOn: nowIso,
          status: "active",
          resolutionNotes: null,
          linkedConditionIds: [conditionId],
          linkedEventIds: [event.id],
          linkedAppointmentIds: [],
          ruleId: "R2_condition_persistent",
        });
      } else {
        await resolveClinicalAlert(alertId, "No cumple criterio de persistencia actualmente.");
      }
    }

    // R3: seguimiento sugerido sin turno
    const requiresFollowup = eventEntity.recommendations.some(hasFollowupKeyword);
    if (requiresFollowup) {
      const windowMs = 45 * 24 * 60 * 60 * 1000;
      const nowTs = Date.now();
      // Leer appointments desde Firestore para evitar stale closures
      const petAppointmentsSnap = await getDocs(
        query(collection(db, "appointments"),
          where("petId", "==", event.petId),
          where("status", "==", "upcoming"),
        )
      );
      const freshAppointments = petAppointmentsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Appointment));
      const hasFutureAppointment = freshAppointments.some((appointment) => {
        const ts = toTimestampSafe(`${appointment.date}T${appointment.time || "00:00"}:00`);
        return ts >= nowTs && ts <= nowTs + windowMs;
      }) || createdAppointmentIds.length > 0;

      const alertId = buildAlertId(event.petId, "R3_followup_not_scheduled", "pet_followup");
      if (!hasFutureAppointment) {
        await upsertClinicalAlert({
          id: alertId,
          petId: event.petId,
          type: "followup_not_scheduled",
          severity: "medium",
          title: "Seguimiento recomendado sin turno agendado",
          description: "Hay recomendación de control sin cita futura dentro de la ventana sugerida.",
          triggeredOn: nowIso,
          lastSeenOn: nowIso,
          status: "active",
          resolutionNotes: null,
          linkedConditionIds: linkedConditionIds,
          linkedEventIds: [event.id],
          linkedAppointmentIds: [],
          ruleId: "R3_followup_not_scheduled",
        });
      } else {
        await resolveClinicalAlert(alertId, "Se detectó turno futuro dentro de la ventana de seguimiento.");
      }
    }

    // R4: tratamiento activo sin seguimiento reciente
    const followupGapMs = 45 * 24 * 60 * 60 * 1000;
    // Leer events frescos desde Firestore en vez del state (evita stale closures)
    const freshEventsSnap = await getDocs(
      query(collection(db, "medical_events"), where("petId", "==", event.petId))
    );
    const freshEvents = freshEventsSnap.docs
      .map(d => ({ id: d.id, ...d.data() } as MedicalEvent))
      .filter(e => !e.deletedAt);
    const latestEventTs = Math.max(
      ...freshEvents.map((row) => toTimestampSafe(row.extractedData?.eventDate || row.createdAt)),
      toTimestampSafe(eventEntity.event_date || event.createdAt)
    );

    // Leer treatments frescos desde Firestore
    const freshTreatmentsSnap = await getDocs(
      query(collection(db, "treatments"), where("petId", "==", event.petId), where("status", "==", "active"))
    );
    const freshTreatments = freshTreatmentsSnap.docs.map(d => ({ id: d.id, ...d.data() } as TreatmentEntity));
    const activeTreatmentsForPet = freshTreatments
      .concat(
        eventEntity.treatments_detected
          .filter((treatment) => treatment.status === "active")
          .map((treatment) => ({
            id: buildTreatmentId(event.petId, treatment.normalized_name, treatment.start_date),
            petId: event.petId,
            normalizedName: treatment.normalized_name,
            status: "active" as const,
          } as TreatmentEntity))
      );

    for (const treatment of activeTreatmentsForPet) {
      const alertId = buildAlertId(event.petId, "R4_treatment_no_followup", treatment.normalizedName);
      const lastEvidenceTs = Math.max(
        latestEventTs,
        ...freshEvents
          .map((row) => toTimestampSafe(row.extractedData?.eventDate || row.createdAt))
      );
      const stale = Date.now() - lastEvidenceTs > followupGapMs;
      if (stale) {
        await upsertClinicalAlert({
          id: alertId,
          petId: event.petId,
          type: "treatment_no_followup",
          severity: "medium",
          title: `Tratamiento activo sin seguimiento: ${treatment.normalizedName}`,
          description: "No hay eventos clínicos recientes para validar evolución del tratamiento activo.",
          triggeredOn: nowIso,
          lastSeenOn: nowIso,
          status: "active",
          resolutionNotes: null,
          linkedConditionIds: treatment.linkedConditionIds || [],
          linkedEventIds: [event.id],
          linkedAppointmentIds: [],
          ruleId: "R4_treatment_no_followup",
        });
      } else {
        await resolveClinicalAlert(alertId, "Se detectó seguimiento clínico reciente.");
      }
    }
  };

  // 1. Sync Events
  useEffect(() => {
    if (!activePet) {
      setEvents([]);
      return;
    }
    const q = query(collection(db, "medical_events"), where("petId", "==", activePet.id));
    return onSnapshot(
      q,
      (snapshot) => {
        // Filtrar soft-deleted en el listener para que nunca lleguen al estado.
        // Sin esto, componentes que usen `events` directo ven fantasmas.
        setEvents(
          snapshot.docs
            .map(d => ({ id: d.id, ...d.data() } as MedicalEvent))
            .filter(e => !e.deletedAt)
        );
      },
      (error) => {
        console.warn("[MedicalContext] medical_events unavailable", error);
        setEvents([]);
      },
    );
  }, [activePet]);

  // 2. Sync Pending Actions
  useEffect(() => {
    if (!activePet) {
      setPendingActions([]);
      return;
    }
    const q = query(collection(db, "pending_actions"), where("petId", "==", activePet.id));
    return onSnapshot(
      q,
      (snapshot) => {
        setPendingActions(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as PendingAction)));
      },
      (error) => {
        console.warn("[MedicalContext] pending_actions unavailable", error);
        setPendingActions([]);
      },
    );
  }, [activePet]);

  // 3. Sync Medications
  useEffect(() => {
    if (!activePet) {
      setActiveMedications([]);
      return;
    }
    const q = query(collection(db, "treatments"), where("petId", "==", activePet.id), where("subtype", "==", "medication"));
    return onSnapshot(
      q,
      (snapshot) => {
        setActiveMedications(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as ActiveMedication)));
      },
      (error) => {
        console.warn("[MedicalContext] treatments.medication unavailable", error);
        setActiveMedications([]);
      },
    );
  }, [activePet]);

  // 4. Sync Appointments
  useEffect(() => {
    if (!activePet) {
      setAppointments([]);
      return;
    }
    const q = query(collection(db, "appointments"), where("petId", "==", activePet.id));
    return onSnapshot(
      q,
      (snapshot) => {
        setAppointments(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Appointment)));
      },
      (error) => {
        console.warn("[MedicalContext] appointments unavailable", error);
        setAppointments([]);
      },
    );
  }, [activePet]);

  // 5. Sync Clinical Conditions
  useEffect(() => {
    if (!activePet) {
      setClinicalConditions([]);
      return;
    }
    const q = query(collection(db, "clinical_conditions"), where("petId", "==", activePet.id));
    return onSnapshot(
      q,
      (snapshot) => {
        setClinicalConditions(snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as ClinicalCondition)));
      },
      (error) => {
        console.warn("[MedicalContext] clinical_conditions unavailable", error);
        setClinicalConditions([]);
      },
    );
  }, [activePet]);

  // 6. Sync Clinical Alerts
  useEffect(() => {
    if (!activePet) {
      setClinicalAlerts([]);
      return;
    }
    const q = query(collection(db, "clinical_alerts"), where("petId", "==", activePet.id));
    return onSnapshot(
      q,
      (snapshot) => {
        setClinicalAlerts(snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as ClinicalAlert)));
      },
      (error) => {
        console.warn("[MedicalContext] clinical_alerts unavailable", error);
        setClinicalAlerts([]);
      },
    );
  }, [activePet]);

  // 7. Sync Consolidated Treatments
  useEffect(() => {
    if (!activePet) {
      setConsolidatedTreatments([]);
      return;
    }
    const q = query(collection(db, "treatments"), where("petId", "==", activePet.id));
    return onSnapshot(
      q,
      (snapshot) => {
        setConsolidatedTreatments(snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as TreatmentEntity)));
      },
      (error) => {
        console.warn("[MedicalContext] treatments unavailable", error);
        setConsolidatedTreatments([]);
      },
    );
  }, [activePet]);

  // ─── Suscripciones episódicas (solo con flag experimental) ───────────────────
  useEffect(() => {
    if (!activePet || !user?.uid || !isFocusHistoryExperimentHost()) {
      setClinicalEpisodes([]);
      return;
    }
    const q = query(
      collection(db, "clinical_episodes"),
      where("petId", "==", activePet.id),
      where("userId", "==", user.uid),
    );
    return onSnapshot(
      q,
      (snapshot) => {
        const episodes = snapshot.docs
          .map((d) => ({ id: d.id, ...d.data() } as ClinicalEpisode))
          .filter((ep) => ep.status !== "needs_clean_upload" && ep.confidence >= 0.75);
        setClinicalEpisodes(episodes);
      },
      (error) => {
        console.warn("[MedicalContext] clinical_episodes unavailable", error);
        setClinicalEpisodes([]);
      },
    );
  }, [activePet, user?.uid]);

  useEffect(() => {
    if (!activePet || !user?.uid || !isFocusHistoryExperimentHost()) {
      setClinicalProfileSnapshot(null);
      return;
    }
    const q = query(
      collection(db, "clinical_profile_snapshots"),
      where("petId", "==", activePet.id),
      where("userId", "==", user.uid),
    );
    return onSnapshot(
      q,
      (snapshot) => {
        if (snapshot.empty) {
          setClinicalProfileSnapshot(null);
          return;
        }
        // Tomar el snapshot más reciente
        const sorted = snapshot.docs
          .map((d) => ({ id: d.id, ...d.data() } as ClinicalProfileSnapshot))
          .sort((a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime());
        setClinicalProfileSnapshot(sorted[0] ?? null);
      },
      (error) => {
        console.warn("[MedicalContext] clinical_profile_snapshots unavailable", error);
        setClinicalProfileSnapshot(null);
      },
    );
  }, [activePet, user?.uid]);



  const addEvent = async (event: MedicalEvent): Promise<boolean> => {
    const eventKey = buildEventDedupKey(event);
    const eventSemanticKey = buildEventSemanticKey(event);
    const alreadyExists = events.some(
      (existing) =>
        existing.petId === event.petId &&
        (
          buildEventDedupKey(existing) === eventKey ||
          buildEventSemanticKey(existing) === eventSemanticKey
        )
    );
    if (alreadyExists) return false;

    const { id, ...data } = event;
    const docRef = id ? doc(db, "medical_events", id) : doc(collection(db, "medical_events"));
    const persistedEventId = id || docRef.id;
    const protocolEntity = buildMedicalEventEntityPayload({ ...event, id: persistedEventId });
    const defaultValidatedByHuman = event.validatedByHuman ?? !(event.requiresManualConfirmation === true);
    const defaultSourceTruthLevel = event.sourceTruthLevel || (defaultValidatedByHuman ? "user_curated" : "review_queue");
    const payload = {
      ...data,
      id: persistedEventId,
      userId: data.userId || user?.uid,
      validatedByHuman: defaultValidatedByHuman,
      sourceTruthLevel: defaultSourceTruthLevel,
      truthStatus: defaultValidatedByHuman ? "human_confirmed" : "pending_human_review",
      // Snapshot estructurado inmutable por documento (base del cerebro clínico).
      eventId: protocolEntity.event_id,
      sourceDocumentId: protocolEntity.source_document_id,
      documentType: protocolEntity.document_type,
      eventDate: protocolEntity.event_date,
      clinic: protocolEntity.clinic,
      professional: protocolEntity.professional,
      diagnosesDetected: protocolEntity.diagnoses_detected,
      abnormalFindings: protocolEntity.abnormal_findings,
      treatmentsDetected: protocolEntity.treatments_detected,
      appointmentsDetected: protocolEntity.appointments_detected,
      recommendations: protocolEntity.recommendations,
    };
    await setDoc(docRef, payload);
    const persistedEvent: MedicalEvent = { ...event, id: persistedEventId, userId: payload.userId };

    try {
      await syncAutoAppointmentFromEvent(persistedEvent);
    } catch (err) {
      // No bloquear la carga del documento si falla la sincronización derivada.
      console.warn("syncAutoAppointmentFromEvent failed:", err);
    }

    const shouldUpsertBrain = !persistedEvent.requiresManualConfirmation && persistedEvent.status === "completed";
    if (shouldUpsertBrain) {
      try {
        await upsertClinicalBrainFromEvent(persistedEvent);
      } catch (err) {
        // El evento principal ya está persistido; evitamos cortar el flujo del usuario.
        console.warn("upsertClinicalBrainFromEvent failed:", err);
      }
      try {
        await syncProactiveCareFromEvent(persistedEvent);
      } catch (err) {
        console.warn("syncProactiveCareFromEvent failed:", err);
      }
    }
    return true;
  };

  const updateEvent = async (id: string, updates: Partial<MedicalEvent>) => {
    const ref = doc(db, "medical_events", id);
    await updateDoc(ref, updates);

    const current = events.find((e) => e.id === id);
    if (!current) return;

    const mergedExtractedData = updates.extractedData
      ? { ...current.extractedData, ...updates.extractedData }
      : current.extractedData;

    const mergedEvent: MedicalEvent = {
      ...current,
      ...updates,
      extractedData: mergedExtractedData,
    };

    await syncAutoAppointmentFromEvent(mergedEvent);
    const shouldRefreshBrain = mergedEvent.status === "completed" && mergedEvent.requiresManualConfirmation !== true;
    if (shouldRefreshBrain) {
      await upsertClinicalBrainFromEvent(mergedEvent).catch((err) => {
        console.warn("upsertClinicalBrainFromEvent failed after updateEvent:", err);
      });
      await syncProactiveCareFromEvent(mergedEvent).catch((err) => {
        console.warn("syncProactiveCareFromEvent failed after updateEvent:", err);
      });
    }
  };

  const deleteEvent = async (id: string) => {
    const current = events.find((event) => event.id === id);
    const petId = current?.petId || null;

    const isPermissionError = (error: unknown): boolean => {
      if (!error || typeof error !== "object") return false;
      const withCode = error as { code?: string; message?: string };
      const code = (withCode.code || "").toLowerCase();
      const message = (withCode.message || "").toLowerCase();
      return code.includes("permission-denied") || message.includes("insufficient permissions");
    };

    const getDocsSafe = async (label: string, runnable: () => Promise<any[]>) => {
      try {
        return await runnable();
      } catch (error) {
        if (isPermissionError(error)) {
          console.warn(`[deleteEvent] skipping ${label} due to permission-denied`);
          return [];
        }
        throw error;
      }
    };

    const deleteDocSafe = async (label: string, ref: any) => {
      try {
        await deleteDoc(ref);
      } catch (error) {
        if (isPermissionError(error)) {
          console.warn(`[deleteEvent] skipping delete ${label} due to permission-denied`);
          return;
        }
        throw error;
      }
    };

    try {
      // Soft-delete: marcar con deletedAt en lugar de deleteDoc.
      // El backend puede recrear eventos email-importados (deterministic IDs + set merge:true).
      // Al preservar deletedAt en Firestore, el campo sobrevive a re-ingestas futuras
      // y getEventsByPetId lo filtra, impidiendo que la vacuna "reaparezca".
      await updateDoc(doc(db, "medical_events", id), {
        deletedAt: new Date().toISOString(),
        deletedBy: user?.uid ?? null,
      });
      // Actualizar estado local de forma optimista — el onSnapshot tarda
      // unos ms en reflejar el update y el usuario ve el evento "hardcodeado"
      // hasta que llega. Esto lo elimina de la UI de forma inmediata.
      setEvents((prev) => prev.filter((e) => e.id !== id));
    } catch (error) {
      if (isPermissionError(error)) {
        throw new Error("No tenés permisos para eliminar este evento.");
      }
      throw error;
    }

    const medicationQuery = petId
      ? query(collection(db, "treatments"), where("subtype", "==", "medication"), where("generatedFromEventId", "==", id), where("petId", "==", petId))
      : query(collection(db, "treatments"), where("subtype", "==", "medication"), where("generatedFromEventId", "==", id));
    const medicationDocs = await getDocsSafe("medications", async () => (await getDocs(medicationQuery)).docs);
    const medicationIds = medicationDocs.map((entry) => entry.id);
    await Promise.all(medicationDocs.map((entry) => deleteDocSafe("medication", entry.ref)));

    const pendingQuery = petId
      ? query(collection(db, "pending_actions"), where("generatedFromEventId", "==", id), where("petId", "==", petId))
      : query(collection(db, "pending_actions"), where("generatedFromEventId", "==", id));
    const pendingDocs = await getDocsSafe("pending_actions", async () => (await getDocs(pendingQuery)).docs);
    await Promise.all(pendingDocs.map((entry) => deleteDocSafe("pending_action", entry.ref)));

    await deleteDocSafe("appointment:auto", doc(db, "appointments", `auto_${id}`));
    const appointmentsQuery = petId
      ? query(collection(db, "appointments"), where("sourceEventId", "==", id), where("petId", "==", petId))
      : query(collection(db, "appointments"), where("sourceEventId", "==", id));
    const appointmentDocs = await getDocsSafe("appointments", async () => (await getDocs(appointmentsQuery)).docs);
    await Promise.all(appointmentDocs.map((entry) => deleteDocSafe("appointment", entry.ref)));

    const notificationRefs = new Map<string, any>();
    const notificationsByEventQuery = petId
      ? query(collection(db, "scheduled_notifications"), where("sourceEventId", "==", id), where("petId", "==", petId))
      : query(collection(db, "scheduled_notifications"), where("sourceEventId", "==", id));
    const notificationsByEventDocs = await getDocsSafe(
      "scheduled_notifications_by_event",
      async () => (await getDocs(notificationsByEventQuery)).docs
    );
    notificationsByEventDocs.forEach((entry) => {
      notificationRefs.set(entry.ref.path, entry.ref);
    });

    for (const medicationId of medicationIds) {
      const notificationsByMedicationQuery = petId
        ? query(
          collection(db, "scheduled_notifications"),
          where("sourceMedicationId", "==", medicationId),
          where("petId", "==", petId)
        )
        : query(collection(db, "scheduled_notifications"), where("sourceMedicationId", "==", medicationId));
      const notificationsByMedicationDocs = await getDocsSafe(
        "scheduled_notifications_by_medication",
        async () => (await getDocs(notificationsByMedicationQuery)).docs
      );
      notificationsByMedicationDocs.forEach((entry) => {
        notificationRefs.set(entry.ref.path, entry.ref);
      });
    }

    await Promise.all(
      Array.from(notificationRefs.values()).map((ref) => deleteDocSafe("scheduled_notification", ref))
    );
  };

  const confirmEvent = async (id: string, overrides?: Partial<MedicalEvent>) => {
    const current = events.find((event) => event.id === id);
    if (!current) throw new Error("No se encontró el evento para confirmar.");

    const mergedExtractedData = overrides?.extractedData
      ? { ...current.extractedData, ...overrides.extractedData }
      : current.extractedData;

    const mergedEvent: MedicalEvent = {
      ...current,
      ...overrides,
      extractedData: mergedExtractedData,
    };

    const now = new Date();
    const eventDate = mergedEvent.extractedData.eventDate ? parseDateSafe(mergedEvent.extractedData.eventDate) : null;
    if (eventDate && !Number.isNaN(eventDate.getTime())) {
      const endOfToday = new Date(now);
      endOfToday.setHours(23, 59, 59, 999);
      const isAppointmentDocument = mergedEvent.extractedData.documentType === "appointment";
      if (!isAppointmentDocument && eventDate.getTime() > endOfToday.getTime()) {
        throw new Error("La fecha detectada está en el futuro. Corrígela antes de confirmar.");
      }
    }

    const payload: Partial<MedicalEvent> = {
      ...(overrides || {}),
      extractedData: mergedExtractedData,
      status: "completed",
      workflowStatus: "confirmed",
      requiresManualConfirmation: false,
      reviewReasons: [],
      validatedByHuman: true,
      sourceTruthLevel: "human_confirmed",
      truthStatus: "human_confirmed",
      updatedAt: new Date().toISOString(),
    };

    await updateDoc(doc(db, "medical_events", id), payload);
    await syncAutoAppointmentFromEvent(mergedEvent);
    const confirmedEvent = { ...mergedEvent, ...payload } as MedicalEvent;
    await persistDerivedDataFromEvent(confirmedEvent);
    await upsertClinicalBrainFromEvent(confirmedEvent);
    await syncProactiveCareFromEvent(confirmedEvent);
  };

  const getEventsByPetId = (petId: string) => {
    const visibleEvents = events.filter((event) => event.petId === petId && !isMailSyncedEvent(event) && !event.deletedAt);
    return dedupeEvents(visibleEvents).sort((a, b) => {
      // Ordenar por fecha del documento (eventDate), si no existe usar createdAt (fecha de escaneo)
      const dateA = a.extractedData?.eventDate || a.createdAt;
      const dateB = b.extractedData?.eventDate || b.createdAt;
      return toTimestampSafe(dateB) - toTimestampSafe(dateA);
    });
  };

  const addPendingAction = async (action: PendingAction) => {
    const actionKey = buildPendingActionDedupKey(action);
    const pendingDuplicate = pendingActions.some(
      (existing) =>
        existing.petId === action.petId &&
        !existing.completed &&
        buildPendingActionDedupKey(existing) === actionKey
    );
    if (pendingDuplicate) return;

    const { id, ...data } = action;
    const docRef = id ? doc(db, "pending_actions", id) : doc(collection(db, "pending_actions"));
    await setDoc(docRef, {
      ...data,
      userId: data.userId || user?.uid,
    });
  };

  const completePendingAction = async (id: string) => {
    const ref = doc(db, "pending_actions", id);
    await updateDoc(ref, {
      completed: true,
      completedAt: new Date().toISOString(),
    });
  };

  const deletePendingAction = async (id: string) => {
    await deleteDoc(doc(db, "pending_actions", id));
  };

  const getPendingActionsByPetId = (petId: string) => {
    const visiblePendingActions = pendingActions.filter(
      (action) =>
        action.petId === petId &&
        !action.completed &&
        !isMailSyncedPendingAction(action)
    );
    return dedupePendingActions(visiblePendingActions)
      .sort((a, b) => toTimestampSafe(a.dueDate) - toTimestampSafe(b.dueDate));
  };

  const getClinicalReviewDraftById = async (reviewId: string): Promise<ClinicalReviewDraft | null> => {
    if (!reviewId) return null;
    const reviewRef = doc(db, "clinical_review_drafts", reviewId);
    const reviewSnap = await getDoc(reviewRef);
    if (!reviewSnap.exists()) return null;
    return { id: reviewSnap.id, ...(reviewSnap.data() as ClinicalReviewDraft) };
  };

  const submitClinicalReviewDraft = async (
    reviewId: string,
    payload: {
      medications: Array<{
        name: string;
        dosage: string;
        frequency: string;
        duration?: string | null;
      }>;
      eventDate?: string | null;
    }
  ) => {
    if (!reviewId) throw new Error("No se encontró el borrador de revisión.");

    const reviewRef = doc(db, "clinical_review_drafts", reviewId);
    const reviewSnap = await getDoc(reviewRef);
    if (!reviewSnap.exists()) throw new Error("No encontramos el borrador de revisión.");
    const review = { id: reviewSnap.id, ...(reviewSnap.data() as ClinicalReviewDraft) };

    const eventId = (review.generatedFromEventId || "").trim();
    if (!eventId) throw new Error("No se encontró el evento clínico vinculado.");

    const validEdits = (payload.medications || []).map((row) => ({
      name: (row.name || "").trim(),
      dosage: (row.dosage || "").trim(),
      frequency: (row.frequency || "").trim(),
      duration: (row.duration || "").trim(),
    }));
    const invalid = validEdits.find((row) => !row.name || !row.dosage || !row.frequency);
    if (invalid) {
      throw new Error("Completá nombre, dosis y frecuencia para todas las medicaciones.");
    }

    const currentEvent = events.find((row) => row.id === eventId);
    if (!currentEvent) {
      throw new Error("No encontramos el evento a confirmar. Reintentá en unos segundos.");
    }

    const overrideMap = new Map(validEdits.map((row) => [normalizeMedicationKey(row.name), row]));
    const currentMeds = currentEvent.extractedData.medications || [];

    const mergedMeds = currentMeds.map((medication) => {
      const key = normalizeMedicationKey(medication.name);
      const override = overrideMap.get(key);
      if (!override) return medication;
      return {
        ...medication,
        dosage: override.dosage,
        frequency: override.frequency,
        duration: override.duration || medication.duration || null,
      };
    });

    for (const override of validEdits) {
      const key = normalizeMedicationKey(override.name);
      const alreadyInEvent = currentMeds.some((medication) => normalizeMedicationKey(medication.name) === key);
      if (alreadyInEvent) continue;
      mergedMeds.push({
        name: override.name,
        dosage: override.dosage,
        frequency: override.frequency,
        duration: override.duration || null,
        confidence: "medium",
      });
    }

    const nextEventDate = (payload.eventDate || currentEvent.extractedData.eventDate || "").trim();
    if (!nextEventDate) {
      throw new Error("Este registro necesita fecha clínica antes de confirmarse.");
    }

    await confirmEvent(eventId, {
      status: "completed",
      workflowStatus: "confirmed",
      requiresManualConfirmation: false,
      reviewReasons: [],
      validatedByHuman: true,
      sourceTruthLevel: "human_confirmed",
      truthStatus: "human_confirmed",
      extractedData: {
        ...currentEvent.extractedData,
        eventDate: nextEventDate,
        medications: mergedMeds,
        treatmentValidationStatus: "complete",
        treatmentMissingFields: [],
      },
    });

    const nowIso = new Date().toISOString();
    await updateDoc(reviewRef, {
      status: "resolved",
      validationStatus: "complete",
      isDraft: false,
      is_draft: false,
      resolvedAt: nowIso,
      resolvedBy: user?.uid || null,
      updatedAt: nowIso,
      finalMedications: validEdits,
      eventDate: nextEventDate,
    });

    // ── Cerrar el ciclo de lineage en clinical_events y pending_reviews ──
    // Buscamos el brain_resolver record asociado a este reviewId o eventId
    // para marcar validated_by_human=true y source_truth_level=human_confirmed
    try {
      const brainRecordQuery = await getDocs(
        query(
          collection(db, "pending_reviews"),
          where("source_metadata.canonical_event_id", "==", eventId)
        )
      );
      await Promise.all(
        brainRecordQuery.docs.map((row) =>
          updateDoc(row.ref, {
            validated_by_human: true,
            source_truth_level: "human_confirmed",
            validation_timestamp: nowIso,
            review_action: "approved",
            status: "verified",
            updated_at: nowIso,
          })
        )
      );
      const clinicalEventBrainQuery = await getDocs(
        query(
          collection(db, "clinical_events"),
          where("source_metadata.canonical_event_id", "==", eventId)
        )
      );
      await Promise.all(
        clinicalEventBrainQuery.docs.map((row) =>
          updateDoc(row.ref, {
            validated_by_human: true,
            source_truth_level: "human_confirmed",
            validation_timestamp: nowIso,
            review_action: "approved",
            updated_at: nowIso,
          })
        )
      );
    } catch {
      // No bloquear el flujo principal si falla el update de lineage
    }
    // ─────────────────────────────────────────────────────────────────────

    const pendingByReview = await getDocs(query(collection(db, "pending_actions"), where("reviewId", "==", reviewId)));
    const pendingByEvent = pendingByReview.empty
      ? await getDocs(query(collection(db, "pending_actions"), where("generatedFromEventId", "==", eventId)))
      : null;
    const pendingDocs = pendingByReview.empty ? pendingByEvent?.docs || [] : pendingByReview.docs;
    await Promise.all(
      pendingDocs
        .filter((row) => {
          const data = row.data() as PendingAction;
          return data.type === "incomplete_data" && data.completed !== true;
        })
        .map((row) =>
          updateDoc(row.ref, {
            completed: true,
            completedAt: nowIso,
            updatedAt: nowIso,
          })
        )
    );
  };

  const addMedication = async (medication: ActiveMedication) => {
    const medicationKey = buildMedicationDedupKey(medication);
    const activeDuplicate = activeMedications.some(
      (existing) =>
        existing.petId === medication.petId &&
        existing.active &&
        buildMedicationDedupKey(existing) === medicationKey
    );
    if (activeDuplicate) return;

    const { id, ...data } = medication;
    const docRef = id ? doc(db, "treatments", id) : doc(collection(db, "treatments"));
    await setDoc(docRef, {
      ...data,
      subtype: "medication",
      userId: data.userId || user?.uid,
    });
  };

  const updateMedication = async (id: string, updates: Partial<ActiveMedication>) => {
    const ref = doc(db, "treatments", id);
    await updateDoc(ref, updates);
  };

  const deactivateMedication = async (id: string) => {
    const ref = doc(db, "treatments", id);
    await updateDoc(ref, { active: false });
  };

  const getActiveMedicationsByPetId = (petId: string) => {
    return dedupeMedications(
      activeMedications.filter((medication) => medication.petId === petId && isMedicationCurrentlyActive(medication))
    );
  };

  const getMonthSummary = (petId: string, month: Date): MonthSummary => {
    const startOfMonth = new Date(month.getFullYear(), month.getMonth(), 1);
    const endOfMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0);

    const petEvents = getEventsByPetId(petId).filter((event) => {
      const eventDate = parseDateSafe(event.extractedData?.eventDate || event.createdAt);
      if (!eventDate) return false;
      return event.petId === petId && eventDate >= startOfMonth && eventDate <= endOfMonth;
    });

    const eventsByType: Record<DocumentType, number> = {
      vaccine: 0, appointment: 0, lab_test: 0, xray: 0, echocardiogram: 0, electrocardiogram: 0,
      surgery: 0, medication: 0, checkup: 0, other: 0,
    };

    petEvents.forEach((event) => {
      const type = event.extractedData?.documentType;
      if (type) eventsByType[type] = (eventsByType[type] || 0) + 1;
    });

    const petPendingActions = dedupePendingActions(pendingActions.filter((action) => action.petId === petId));
    const completedThisMonth = petPendingActions.filter((action) => {
      if (!action.completedAt) return false;
      const completedDate = parseDateSafe(action.completedAt);
      if (!completedDate) return false;
      return completedDate >= startOfMonth && completedDate <= endOfMonth;
    });

    const monthName = month.toLocaleDateString("es-ES", { month: "long" });

    return {
      month: monthName.charAt(0).toUpperCase() + monthName.slice(1),
      totalEvents: petEvents.length,
      eventsByType,
      pendingActions: getPendingActionsByPetId(petId).length,
      completedActions: completedThisMonth.length,
      activeMedications: getActiveMedicationsByPetId(petId).length,
    };
  };

  const saveVerifiedReport = async (report: Record<string, unknown>) => {
    if (!user?.uid) {
      throw new Error("auth_required_for_verified_report");
    }
    const summaryRaw = typeof report?.summary === "string" ? report.summary : "";
    const summary = summaryRaw
      .replace(/\*\*(.*?)\*\*/g, "$1")
      .replace(/\*(.*?)\*/g, "$1")
      .replace(/#{1,6}\s+/g, "")
      .replace(/```json\s*/gi, "")
      .replace(/```\s*/g, "")
      .replace(/`{1,3}/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 1100);
    const documentCountRaw = Number(report?.documentCount ?? report?.totalEvents ?? report?.eventsCount ?? 0);
    const documentCount = Number.isFinite(documentCountRaw) && documentCountRaw > 0 ? Math.round(documentCountRaw) : 0;
    const docRef = await addDoc(collection(db, "verified_reports"), {
      ownerId: user.uid,
      generatedAt: new Date().toISOString(),
      summary,
      visibility: "private",
      isRedactedPublic: false,
      certificateType: "clinical_integrity_certificate",
      documentCount,
      includesAiNarrative: true,
      sourceTruthLevel: "redacted_public_certificate",
      verificationVersion: "pessy_verified_v2",
    });
    return docRef.id;
  };

  const persistCalendarSyncMetadata = async (
    ref: ReturnType<typeof doc>,
    appointment: Appointment
  ) => {
    try {
      const syncResult = await syncAppointmentWithGoogleCalendar(appointment);
      if (syncResult.ok) {
        await updateDoc(ref, {
          googleCalendarEventId: syncResult.action === "deleted" ? null : (syncResult.eventId || appointment.googleCalendarEventId || null),
          googleCalendarHtmlLink: syncResult.action === "deleted" ? null : (syncResult.htmlLink || null),
          googleCalendarSyncedAt: syncResult.syncedAt || new Date().toISOString(),
          googleCalendarSyncStatus: "synced",
          googleCalendarSyncReason: syncResult.reason || null,
        });
        return;
      }

      await updateDoc(ref, {
        googleCalendarSyncStatus: "skipped",
        googleCalendarSyncReason: syncResult.reason || "sync_skipped",
      });
    } catch (error) {
      console.warn("syncAppointmentWithGoogleCalendar failed:", error);
      await updateDoc(ref, {
        googleCalendarSyncStatus: "error",
        googleCalendarSyncReason: String(error).slice(0, 180),
      }).catch(() => undefined);
    }
  };

  const addAppointment = async (appointment: Appointment) => {
    const { id, ...data } = appointment;
    const resolvedUserId = data.userId || user?.uid;
    if (!resolvedUserId) {
      throw new Error("No hay sesión activa para guardar la cita.");
    }

    const cleanData = Object.fromEntries(
      Object.entries({
        ...data,
        userId: resolvedUserId,
        autoGenerated: data.autoGenerated ?? false,
      }).filter(([, value]) => value !== undefined)
    );

    const docRef = id ? doc(db, "appointments", id) : doc(collection(db, "appointments"));
    await setDoc(docRef, cleanData);

    const persistedAppointment: Appointment = {
      ...(cleanData as Appointment),
      id: docRef.id,
    };
    await persistCalendarSyncMetadata(docRef, persistedAppointment);
  };

  const updateAppointment = async (id: string, updates: Partial<Appointment>) => {
    const ref = doc(db, "appointments", id);
    await updateDoc(ref, updates);

    const syncRelevantFields: Array<keyof Appointment> = [
      "status",
      "title",
      "date",
      "time",
      "clinic",
      "veterinarian",
      "notes",
      "petName",
      "googleCalendarEventId",
    ];
    const shouldSync = syncRelevantFields.some((field) => field in updates);
    if (!shouldSync) return;

    const current = appointments.find((appointment) => appointment.id === id);
    if (!current) return;
    const merged: Appointment = { ...current, ...updates, id };
    await persistCalendarSyncMetadata(ref, merged);
  };

  const deleteAppointment = async (id: string) => {
    const current = appointments.find((appointment) => appointment.id === id);
    if (current?.googleCalendarEventId) {
      try {
        await syncAppointmentWithGoogleCalendar({
          ...current,
          status: "cancelled",
        });
      } catch (error) {
        console.warn("deleteAppointment calendar cleanup failed:", error);
      }
    }

    const notificationRefs = new Map<string, ReturnType<typeof doc>>();
    const notificationsQuery = query(
      collection(db, "scheduled_notifications"),
      where("sourceEventId", "==", id)
    );
    const notificationsSnapshot = await getDocs(notificationsQuery);
    notificationsSnapshot.docs.forEach((entry) => {
      notificationRefs.set(entry.ref.path, entry.ref);
    });
    await Promise.all(Array.from(notificationRefs.values()).map((ref) => deleteDoc(ref))).catch(() => undefined);

    await deleteDoc(doc(db, "appointments", id));
  };

  const getAppointmentsByPetId = (petId: string) => {
    const mailEventIds = new Set(
      events
        .filter((event) => event.petId === petId && isMailSyncedEvent(event))
        .map((event) => event.id)
    );

    const toTimestamp = (appointment: Appointment) => {
      const withTime = appointment.time
        ? `${appointment.date}T${appointment.time}:00`
        : `${appointment.date}T00:00:00`;
      const parsed = new Date(withTime);
      if (!Number.isNaN(parsed.getTime())) return parsed.getTime();
      return toTimestampSafe(appointment.createdAt);
    };

    const visibleAppointments = appointments.filter((appointment) => {
      if (appointment.petId !== petId) return false;
      if (EMAIL_SYNC_ENABLED) return true;
      if (appointment.sourceEventId && mailEventIds.has(appointment.sourceEventId)) return false;
      const hasTextHint =
        hasMailSyncHint(appointment.notes || null) ||
        hasMailSyncHint(appointment.title || null);
      if (hasTextHint && Boolean(appointment.sourceEventId || appointment.sourceSuggestionKey)) return false;
      return true;
    });

    return dedupeAppointments(visibleAppointments)
      .sort((a, b) => toTimestamp(a) - toTimestamp(b));
  };

  const getClinicalConditionsByPetId = (petId: string) => {
    return clinicalConditions
      .filter((condition) => condition.petId === petId)
      .sort((a, b) => toTimestampSafe(b.lastDetectedDate) - toTimestampSafe(a.lastDetectedDate));
  };

  const getClinicalAlertsByPetId = (petId: string) => {
    return clinicalAlerts
      .filter((alert) => alert.petId === petId)
      .sort((a, b) => toTimestampSafe(b.lastSeenOn) - toTimestampSafe(a.lastSeenOn));
  };

  const getConsolidatedTreatmentsByPetId = (petId: string) => {
    return consolidatedTreatments
      .filter((treatment) => treatment.petId === petId)
      .sort((a, b) => toTimestampSafe(b.updatedAt) - toTimestampSafe(a.updatedAt));
  };

  // ─── Accessors episódicos (solo con flag experimental) ───────────────────────
  const getClinicalEpisodesByPetId = (petId: string): ClinicalEpisode[] => {
    return clinicalEpisodes
      .filter((ep) => ep.petId === petId)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  };

  const getProfileSnapshotByPetId = (petId: string): ClinicalProfileSnapshot | null => {
    return clinicalProfileSnapshot?.petId === petId ? clinicalProfileSnapshot : null;
  };

  return (
    <MedicalContext.Provider
      value={{
        events, addEvent, updateEvent, deleteEvent, confirmEvent, getEventsByPetId,
        pendingActions,
        addPendingAction,
        completePendingAction,
        deletePendingAction,
        getPendingActionsByPetId,
        getClinicalReviewDraftById,
        submitClinicalReviewDraft,
        activeMedications, addMedication, updateMedication, deactivateMedication, getActiveMedicationsByPetId,
        getMonthSummary, saveVerifiedReport,
        appointments, addAppointment, updateAppointment, deleteAppointment, getAppointmentsByPetId,
        clinicalConditions,
        clinicalAlerts,
        consolidatedTreatments,
        getClinicalConditionsByPetId,
        getClinicalAlertsByPetId,
        getConsolidatedTreatmentsByPetId,
        clinicalEpisodes,
        clinicalProfileSnapshot,
        getClinicalEpisodesByPetId,
        getProfileSnapshotByPetId,
      }}
    >
      {children}
    </MedicalContext.Provider>
  );
}

export function useMedical() {
  const context = useContext(MedicalContext);
  if (!context) throw new Error("useMedical must be used within MedicalProvider");
  return context;
}
