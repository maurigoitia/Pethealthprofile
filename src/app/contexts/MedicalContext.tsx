import { createContext, useContext, useState, ReactNode, useEffect } from "react";
import { db } from "../../lib/firebase";
import { collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, doc, setDoc, getDoc } from "firebase/firestore";
import { usePet } from "./PetContext";
import { useAuth } from "./AuthContext";
import {
  MedicalEvent,
  PendingAction,
  ActiveMedication,
  MonthSummary,
  DocumentType,
  Appointment,
  ClinicalCondition,
  ClinicalAlert,
  TreatmentEntity,
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

interface MedicalContextType {
  events: MedicalEvent[];
  addEvent: (event: MedicalEvent) => Promise<boolean>;
  updateEvent: (id: string, updates: Partial<MedicalEvent>) => Promise<void>;
  confirmEvent: (id: string, overrides?: Partial<MedicalEvent>) => Promise<void>;
  getEventsByPetId: (petId: string) => MedicalEvent[];

  pendingActions: PendingAction[];
  addPendingAction: (action: PendingAction) => Promise<void>;
  completePendingAction: (id: string) => Promise<void>;
  getPendingActionsByPetId: (petId: string) => PendingAction[];

  activeMedications: ActiveMedication[];
  addMedication: (medication: ActiveMedication) => Promise<void>;
  deactivateMedication: (id: string) => Promise<void>;
  getActiveMedicationsByPetId: (petId: string) => ActiveMedication[];

  getMonthSummary: (petId: string, month: Date) => MonthSummary;
  saveVerifiedReport: (report: any) => Promise<string>;

  appointments: Appointment[];
  addAppointment: (appointment: Appointment) => Promise<void>;
  updateAppointment: (id: string, updates: Partial<Appointment>) => Promise<void>;
  getAppointmentsByPetId: (petId: string) => Appointment[];

  clinicalConditions: ClinicalCondition[];
  clinicalAlerts: ClinicalAlert[];
  consolidatedTreatments: TreatmentEntity[];
  getClinicalConditionsByPetId: (petId: string) => ClinicalCondition[];
  getClinicalAlertsByPetId: (petId: string) => ClinicalAlert[];
  getConsolidatedTreatmentsByPetId: (petId: string) => TreatmentEntity[];
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

  // No se autoguardan turnos desde extracción: solo se mantienen sugerencias para confirmación manual.
  // Esta rutina limpia turnos legacy autogenerados si aún existen.
  const syncAutoAppointmentFromEvent = async (event: MedicalEvent) => {
    if (!event?.id) return;
    await deleteDoc(doc(db, "appointments", `auto_${event.id}`)).catch(() => undefined);
  };

  const persistDerivedDataFromEvent = async (event: MedicalEvent) => {
    if (event.derivedDataPersistedAt) return;
    if (event.extractedData.documentType !== "medication") return;
    if (!event.extractedData.medications || event.extractedData.medications.length === 0) return;

    const treatmentStart = event.extractedData.eventDate || event.createdAt;

    for (const medicationExtracted of event.extractedData.medications) {
      const treatmentEnd = parseDurationToEndDate(medicationExtracted.duration, treatmentStart);

      const medication: ActiveMedication = {
        id: `med_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
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
      const activeOutOfRange = clinicalAlerts.filter((alert) => alert.petId === event.petId && alert.type === "out_of_range" && alert.status === "active");
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
      const hasFutureAppointment = appointments.some((appointment) => {
        if (appointment.petId !== event.petId) return false;
        if (appointment.status !== "upcoming") return false;
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
    const latestEventTs = Math.max(
      ...getEventsByPetId(event.petId).map((row) => toTimestampSafe(row.extractedData?.eventDate || row.createdAt)),
      toTimestampSafe(eventEntity.event_date || event.createdAt)
    );

    const activeTreatmentsForPet = consolidatedTreatments
      .filter((treatment) => treatment.petId === event.petId && treatment.status === "active")
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
        ...events
          .filter((row) => row.petId === event.petId)
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
    return onSnapshot(q, (snapshot) => {
      setEvents(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as MedicalEvent)));
    });
  }, [activePet]);

  // 2. Sync Pending Actions
  useEffect(() => {
    if (!activePet) {
      setPendingActions([]);
      return;
    }
    const q = query(collection(db, "pending_actions"), where("petId", "==", activePet.id));
    return onSnapshot(q, (snapshot) => {
      setPendingActions(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as PendingAction)));
    });
  }, [activePet]);

  // 3. Sync Medications
  useEffect(() => {
    if (!activePet) {
      setActiveMedications([]);
      return;
    }
    const q = query(collection(db, "medications"), where("petId", "==", activePet.id));
    return onSnapshot(q, (snapshot) => {
      setActiveMedications(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as ActiveMedication)));
    });
  }, [activePet]);

  // 4. Sync Appointments
  useEffect(() => {
    if (!activePet) {
      setAppointments([]);
      return;
    }
    const q = query(collection(db, "appointments"), where("petId", "==", activePet.id));
    return onSnapshot(q, (snapshot) => {
      setAppointments(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Appointment)));
    });
  }, [activePet]);

  // 5. Sync Clinical Conditions
  useEffect(() => {
    if (!activePet) {
      setClinicalConditions([]);
      return;
    }
    const q = query(collection(db, "clinical_conditions"), where("petId", "==", activePet.id));
    return onSnapshot(q, (snapshot) => {
      setClinicalConditions(snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as ClinicalCondition)));
    });
  }, [activePet]);

  // 6. Sync Clinical Alerts
  useEffect(() => {
    if (!activePet) {
      setClinicalAlerts([]);
      return;
    }
    const q = query(collection(db, "clinical_alerts"), where("petId", "==", activePet.id));
    return onSnapshot(q, (snapshot) => {
      setClinicalAlerts(snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as ClinicalAlert)));
    });
  }, [activePet]);

  // 7. Sync Consolidated Treatments
  useEffect(() => {
    if (!activePet) {
      setConsolidatedTreatments([]);
      return;
    }
    const q = query(collection(db, "treatments"), where("petId", "==", activePet.id));
    return onSnapshot(q, (snapshot) => {
      setConsolidatedTreatments(snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as TreatmentEntity)));
    });
  }, [activePet]);

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
    const payload = {
      ...data,
      id: persistedEventId,
      userId: data.userId || user?.uid,
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
      updatedAt: new Date().toISOString(),
    };

    await updateDoc(doc(db, "medical_events", id), payload);
    await syncAutoAppointmentFromEvent(mergedEvent);
    const confirmedEvent = { ...mergedEvent, ...payload } as MedicalEvent;
    await persistDerivedDataFromEvent(confirmedEvent);
    await upsertClinicalBrainFromEvent(confirmedEvent);
  };

  const getEventsByPetId = (petId: string) => {
    return dedupeEvents(events.filter(e => e.petId === petId)).sort((a, b) => {
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
    await updateDoc(ref, { completed: true, completedAt: new Date().toISOString() });
  };

  const getPendingActionsByPetId = (petId: string) => {
    return dedupePendingActions(pendingActions.filter(a => a.petId === petId && !a.completed))
      .sort((a, b) => toTimestampSafe(a.dueDate) - toTimestampSafe(b.dueDate));
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
    const docRef = id ? doc(db, "medications", id) : doc(collection(db, "medications"));
    await setDoc(docRef, {
      ...data,
      userId: data.userId || user?.uid,
    });
  };

  const deactivateMedication = async (id: string) => {
    const ref = doc(db, "medications", id);
    await updateDoc(ref, { active: false });
  };

  const getActiveMedicationsByPetId = (petId: string) => {
    return dedupeMedications(activeMedications.filter(m => m.petId === petId && m.active));
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
      const type = event.extractedData.documentType;
      eventsByType[type] = (eventsByType[type] || 0) + 1;
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

  const saveVerifiedReport = async (report: any) => {
    const docRef = await addDoc(collection(db, "verified_reports"), {
      ...report,
      generatedAt: new Date().toISOString(),
    });
    return docRef.id;
  };

  const addAppointment = async (appointment: Appointment) => {
    const { id, ...data } = appointment;
    const docRef = id ? doc(db, "appointments", id) : doc(collection(db, "appointments"));
    await setDoc(docRef, {
      ...data,
      userId: data.userId || user?.uid,
      autoGenerated: data.autoGenerated ?? false,
    });
  };

  const updateAppointment = async (id: string, updates: Partial<Appointment>) => {
    const ref = doc(db, "appointments", id);
    await updateDoc(ref, updates);
  };

  const getAppointmentsByPetId = (petId: string) => {
    const toTimestamp = (appointment: Appointment) => {
      const withTime = appointment.time
        ? `${appointment.date}T${appointment.time}:00`
        : `${appointment.date}T00:00:00`;
      const parsed = new Date(withTime);
      if (!Number.isNaN(parsed.getTime())) return parsed.getTime();
      return toTimestampSafe(appointment.createdAt);
    };

    return dedupeAppointments(appointments.filter(a => a.petId === petId))
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

  return (
    <MedicalContext.Provider
      value={{
        events, addEvent, updateEvent, confirmEvent, getEventsByPetId,
        pendingActions, addPendingAction, completePendingAction, getPendingActionsByPetId,
        activeMedications, addMedication, deactivateMedication, getActiveMedicationsByPetId,
        getMonthSummary, saveVerifiedReport,
        appointments, addAppointment, updateAppointment, getAppointmentsByPetId,
        clinicalConditions,
        clinicalAlerts,
        consolidatedTreatments,
        getClinicalConditionsByPetId,
        getClinicalAlertsByPetId,
        getConsolidatedTreatmentsByPetId,
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
