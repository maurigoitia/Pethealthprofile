// ============================================================================
// PESSY - Medical Data Types
// Estructura completa para eventos médicos extraídos por el motor de analisis
// ============================================================================

export type DocumentType =
  | "vaccine"
  | "appointment"
  | "lab_test"
  | "xray"
  | "echocardiogram"
  | "electrocardiogram"
  | "surgery"
  | "medication"
  | "checkup"
  | "other";

export type EventStatus = "processing" | "completed" | "pending" | "draft";

export type ExtractionConfidence = "high" | "medium" | "low" | "not_detected";

export type MasterDocumentType =
  | "clinical_report"
  | "laboratory_result"
  | "medical_appointment"
  | "medical_study"
  | "lab_result"
  | "prescription"
  | "appointment"
  | "vaccination_record"
  | "invoice"
  | "other";

export interface MasterClinicalDiagnosis {
  condition_name: string | null;
  organ_system: string | null;
  classification: "nuevo" | "recurrente" | "persistente" | null;
  severity: "leve" | "moderado" | "severo" | "no_especificado" | null;
}

export interface MasterClinicalFinding {
  parameter: string | null;
  value: string | null;
  reference_range: string | null;
  status: "alto" | "bajo" | "alterado" | "normal" | "no_observado" | "inconcluso" | null;
}

export interface MasterClinicalTreatment {
  treatment_name: string | null;
  start_date: string | null;
  end_date: string | null;
  dosage: string | null;
  status: "activo" | "finalizado" | "desconocido" | null;
}

export interface MasterClinicalImagingFinding {
  region: "torax" | "abdomen" | "pelvis" | "columna" | "cadera" | "otro" | null;
  view: "ventrodorsal" | "lateral" | "dorsoventral" | "oblicua" | "otro" | null;
  finding: string | null;
  severity: "leve" | "moderado" | "severo" | "no_especificado" | null;
}

export interface MasterClinicalAppointment {
  date: string | null;
  time: string | null;
  specialty: string | null;
  procedure: string | null;
  clinic_name: string | null;
  clinic_address: string | null;
  professional_name: string | null;
  status: "confirmado" | "programado" | "recordatorio" | null;
}

export interface MasterClinicalPayload {
  document_type: MasterDocumentType;
  pet: {
    name: string | null;
    species: string | null;
    breed: string | null;
    age_at_document: string | null;
    owner: string | null;
  };
  document_info: {
    date: string | null;
    clinic_name: string | null;
    clinic_address: string | null;
    veterinarian_name: string | null;
    veterinarian_license: string | null;
    record_number: string | null;
  };
  diagnoses: MasterClinicalDiagnosis[];
  abnormal_findings: MasterClinicalFinding[];
  imaging_findings?: MasterClinicalImagingFinding[];
  treatments: MasterClinicalTreatment[];
  appointments: MasterClinicalAppointment[];
  recommendations: string[];
  requires_followup: boolean;
  vaccine_artifacts?: {
    sticker_detected: boolean | null;
    stamp_detected: boolean | null;
    signature_detected: boolean | null;
    product_name: string | null;
    manufacturer: string | null;
    lot_number: string | null;
    serial_number: string | null;
    expiry_date: string | null;
    application_date: string | null;
    revaccination_date: string | null;
  } | null;
  appointment_event?: {
    event_type: "medical_appointment";
    date: string | null;
    time: string | null;
    specialty: string | null;
    procedure: string | null;
    clinic: string | null;
    address: string | null;
    professional_name: string | null;
    preparation_required: string | null;
    status: "scheduled" | "programado" | "confirmado" | "recordatorio" | null;
  } | null;
}

// ============================================================================
// Datos extraídos por el motor de analisis
// ============================================================================
export interface ExtractedData {
  // Clasificación automática
  documentType: DocumentType;
  documentTypeConfidence: ExtractionConfidence;

  // Fecha del estudio/evento
  eventDate: string | null; // ISO 8601
  eventDateConfidence: ExtractionConfidence;

  // Hora del turno (solo para documentType="appointment")
  appointmentTime: string | null; // "HH:mm"
  // Lista de turnos detectados en documentos con múltiples filas
  detectedAppointments: DetectedAppointment[];

  // Clínica/institución
  clinic: string | null;

  // Profesional/Clínica
  provider: string | null;
  providerConfidence: ExtractionConfidence;

  // Diagnóstico literal extraído
  diagnosis: string | null;
  diagnosisConfidence: ExtractionConfidence;

  // Observaciones médicas
  observations: string | null;
  observationsConfidence: ExtractionConfidence;

  // Medicación indicada
  medications: MedicationExtracted[];

  // Próxima fecha recomendada (para pendientes)
  nextAppointmentDate: string | null; // ISO 8601
  nextAppointmentReason: string | null;
  nextAppointmentConfidence: ExtractionConfidence;
  suggestedTitle: string | null;

  // Resumen clínico generado automaticamente (lenguaje simple)
  aiGeneratedSummary: string | null;

  // Valores extraídos (para labs, ECG, etc)
  measurements: Measurement[];

  // Payload estructurado con protocolo clínico longitudinal.
  masterClinical?: MasterClinicalPayload | null;
  extractionProtocol?: "pessy_clinical_processing_protocol_v1" | "pessy_master_clinical_protocol_v1" | "legacy_v1" | null;

  // Artefactos visuales en certificados de vacunación/troqueles.
  vaccineProductName?: string | null;
  vaccineManufacturer?: string | null;
  vaccineLotNumber?: string | null;
  vaccineSerialNumber?: string | null;
  vaccineExpiryDate?: string | null; // YYYY-MM-DD
  vaccineApplicationDate?: string | null; // YYYY-MM-DD
  vaccineRevaccinationDate?: string | null; // YYYY-MM-DD
  vaccineStickerDetected?: boolean | null;
  vaccineStampDetected?: boolean | null;
  vaccineSignatureDetected?: boolean | null;
  proactiveCarePlan?: ProactiveCarePlan | null;

  // Estudios por mail/adjunto (tipificación explícita).
  studyType?: string | null;
  anatomyTags?: string[];
  systemTags?: string[];

  // Enlaces clínicos explícitos (evitar inferencia visual en timeline).
  linkedConditionId?: string | null;
  linkedConditionLabel?: string | null;
  linkedEpisodeKey?: string | null;
  topicTags?: string[];

  // Metadatos de origen (correo).
  sourceReceivedAt?: string | null;
  sourceSubject?: string | null;
  sourceSender?: string | null;
  sourceFileName?: string | null;

  // Estado de validación para tratamientos extraídos por correo.
  treatmentValidationStatus?: "complete" | "needs_review";
  treatmentMissingFields?: Array<{
    medication: string | null;
    missingDose: boolean;
    missingFrequency: boolean;
  }>;
}

export interface MedicationExtracted {
  name: string;
  dosage: string | null;
  frequency: string | null;
  duration: string | null;
  confidence: ExtractionConfidence;
}

export interface Measurement {
  name: string; // e.g., "Frecuencia cardíaca", "Peso", "Temperatura"
  value: string;
  unit: string | null;
  referenceRange: string | null;
  confidence: ExtractionConfidence;
}

export interface DetectedAppointment {
  date: string | null; // YYYY-MM-DD
  time: string | null; // HH:mm
  title: string | null;
  specialty: string | null;
  clinic: string | null;
  provider: string | null;
  confidence: ExtractionConfidence;
}

export interface ProactiveCareAlert {
  type: "vaccine" | "control" | "medication" | "imaging_followup";
  title: string;
  dueDate: string | null; // YYYY-MM-DD
  reason: string | null;
  confidence: ExtractionConfidence;
}

export interface ProactiveMedicationPlan {
  drug: string;
  dosage: string | null;
  frequency: string | null;
  duration: string | null;
  confidence: ExtractionConfidence;
}

export interface ProactiveImagingFinding {
  region: string | null;
  view: string | null;
  finding: string;
  severity: "leve" | "moderado" | "severo" | "no_especificado" | null;
  confidence: ExtractionConfidence;
}

export interface ProactiveCarePlan {
  alerts: ProactiveCareAlert[];
  chronicConditions: string[];
  medicationPlan: ProactiveMedicationPlan[];
  imagingFindings: ProactiveImagingFinding[];
}

export type RoutineKind =
  | "walk"
  | "play"
  | "hydration"
  | "symptom_check"
  | "medication_support";

export type RoutineCompletionFeedback =
  | "perfect"
  | "too_easy"
  | "too_intense"
  | "skipped";

// ============================================================================
// Evento médico completo
// ============================================================================
export interface MedicalEvent {
  id: string;
  petId: string;
  userId?: string;
  title: string;
  // Archivo original
  documentUrl: string; // URL del Storage (Supabase o local)
  documentPreviewUrl: string | null; // Thumbnail generado
  fileName: string;
  fileType: "image" | "pdf";

  // Estado del procesamiento
  status: EventStatus;
  workflowStatus?: "draft" | "review_required" | "confirmed" | "invalid_future_date";
  requiresManualConfirmation?: boolean;
  reviewReasons?: string[];
  overallConfidence?: number;
  validatedByHuman?: boolean;
  sourceTruthLevel?: "human_confirmed" | "user_curated" | "ai_auto_ingested" | "review_queue";
  truthStatus?: "human_confirmed" | "pending_human_review" | "auto_ingested_unconfirmed";
  dismissedNextAppointment?: boolean;
  derivedDataPersistedAt?: string | null;
  hidden?: boolean;
  deletedAt?: string | null;
  deletedBy?: string | null;

  // Datos extraídos automaticamente
  extractedData: ExtractedData;

  // Metadatos
  ocrProcessed: boolean;
  aiProcessed: boolean;
  fileHash?: string;
  dedupKey?: string;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601

  // Correlación futura con otros eventos
  relatedEventIds: string[];
  aiSuggestedRelation: string | null; // e.g., "Relacionado con estudio del 18 Nov 2024"
  treatmentNotes?: TreatmentNote[];
}

export interface TreatmentNote {
  id: string;
  text: string;
  interpretedAs: "dose_change" | "interruption" | "positive_progress" | "adverse_effect" | "general_note";
  createdAt: string;
}

// ============================================================================
// Pendiente generado automáticamente
// ============================================================================
export interface PendingAction {
  id: string;
  petId: string;
  userId?: string;

  // Tipo de acción
  type:
    | "vaccine_due"
    | "checkup_due"
    | "medication_refill"
    | "test_pending"
    | "follow_up"
    | "sync_review"
    | "incomplete_data";

  // Información visible
  title: string;
  subtitle: string;

  // Fechas
  dueDate: string; // ISO 8601
  createdAt: string;

  // Origen
  generatedFromEventId: string | null; // Link al evento que lo generó
  autoGenerated: boolean; // true si fue creado automaticamente
  reviewId?: string | null;
  sessionId?: string | null;
  sourceMessageId?: string | null;
  sourceStorageUri?: string | null;
  sourceStoragePath?: string | null;
  sourceStorageSignedUrl?: string | null;
  sourceFileName?: string | null;
  sourceMimeType?: string | null;
  imageFragmentUrl?: string | null;

  // Estado
  completed: boolean;
  completedAt: string | null;

  // Notificaciones
  reminderEnabled: boolean;
  reminderDaysBefore: number; // Días antes de dueDate para recordar

  // Metadatos de origen (opcional)
  sourceTag?: string | null;       // e.g. "ai_projection", "proactive_care"
  clinicalEventId?: string | null; // ID del clinical_event si vino de proyección
  targetCollection?: string | null; // Colección destino del item proyectado
  routineKind?: RoutineKind | null;
  routineDateKey?: string | null;
  habitPoints?: number | null;
  coachSummary?: string | null;
  coachTitle?: string | null;
  adaptiveLabel?: "subiendo_desafio" | "equilibrado" | "bajando_intensidad" | null;
  routineVersion?: string | null;
  intensityHint?: "low" | "medium" | "high" | null;
  completionFeedback?: RoutineCompletionFeedback | null;
  completionOutcome?: "done" | "skipped" | null;
}

export interface ClinicalReviewMedicationDraft {
  name: string | null;
  dose: string | null;
  frequency: string | null;
  duration_days?: number | null;
  is_active?: boolean | null;
}

export interface ClinicalReviewMissingField {
  medication: string | null;
  missingDose: boolean;
  missingFrequency: boolean;
  detectedDose?: string | null;
  detectedFrequency?: string | null;
}

export interface ClinicalReviewDraft {
  id: string;
  userId?: string;
  petId: string;
  sessionId?: string | null;
  generatedFromEventId: string;
  status: "pending" | "resolved" | "dismissed" | string;
  validationStatus?: "needs_review" | "complete" | string;
  reviewType?: string;
  reviewReason?: string | null;
  isDraft?: boolean;
  sourceMessageId?: string | null;
  sourceSubject?: string | null;
  sourceSender?: string | null;
  sourceDate?: string | null;
  sourceFileName?: string | null;
  sourceMimeType?: string | null;
  sourceStorageUri?: string | null;
  sourceStoragePath?: string | null;
  sourceStorageSignedUrl?: string | null;
  imageFragmentUrl?: string | null;
  gmailReviewId?: string | null;
  missingFields?: ClinicalReviewMissingField[];
  medications?: ClinicalReviewMedicationDraft[];
  diagnosis?: string | null;
  eventDate?: string | null;
  createdAt?: string;
  updatedAt?: string;
  resolvedAt?: string | null;
  resolvedBy?: string | null;
}

// ============================================================================
// Medicación activa
// ============================================================================
export interface ActiveMedication {
  id: string;
  petId: string;
  userId?: string;

  // Información del medicamento
  name: string;
  dosage: string;
  frequency: string;
  type: string; // "Cardiológico", "Articular", "Antibiótico", etc.

  // Fechas
  startDate: string; // ISO 8601
  endDate: string | null; // null = crónico

  // Origen
  prescribedBy: string | null;
  generatedFromEventId: string | null;

  // Estado
  active: boolean;

  // Adherencia y recordatorios (opcional)
  lastDoseAt?: string | null; // ISO: última toma confirmada por el tutor
  nextDoseAt?: string | null; // ISO: próxima toma estimada
}

// ============================================================================
// Resumen del mes (calculado dinámicamente)
// ============================================================================
export interface MonthSummary {
  month: string; // "Febrero 2026"
  totalEvents: number;
  eventsByType: Record<DocumentType, number>;
  pendingActions: number;
  completedActions: number;
  activeMedications: number;
}

// ============================================================================
// Cita Médica (Turno)
// ============================================================================
export interface Appointment {
  id: string;
  petId: string;
  userId?: string;
  ownerId?: string;
  petName?: string;
  sourceEventId?: string;
  sourceSuggestionKey?: string;
  autoGenerated?: boolean;
  type: "checkup" | "vaccine" | "surgery" | "emergency" | "other";
  title: string;
  date: string; // YYYY-MM-DD o ISO
  time: string; // HH:mm
  veterinarian: string | null;
  clinic: string | null;
  status: "upcoming" | "completed" | "cancelled";
  notes?: string;
  googleCalendarEventId?: string | null;
  googleCalendarHtmlLink?: string | null;
  googleCalendarSyncedAt?: string | null;
  googleCalendarSyncStatus?: "synced" | "skipped" | "error";
  googleCalendarSyncReason?: string | null;
  createdAt: string;
}

export type ClinicalConditionStatus = "active" | "monitoring" | "resolved";
export type ClinicalConditionPattern = "acute" | "recurrent" | "chronic" | "unknown";

export interface ClinicalCondition {
  id: string;
  petId: string;
  normalizedName: string;
  organSystem: string | null;
  firstDetectedDate: string | null;
  lastDetectedDate: string | null;
  occurrencesCount: number;
  status: ClinicalConditionStatus;
  pattern: ClinicalConditionPattern;
  evidenceEventIds: string[];
  relatedLabFlags: string[];
  lastSummaryUpdateAt: string;
}

export interface DiagnosisEntity {
  id: string;
  petId: string;
  conditionId: string;
  eventId: string;
  date: string | null;
  rawLabel: string | null;
  severity: string | null;
  notes: string | null;
}

export type TreatmentEntityStatus = "active" | "completed" | "unknown";

export type TreatmentSubtype =
  | "medication"
  | "supplement"
  | "vaccine_schedule"
  | "physical_therapy"
  | "surgical_follow"
  | "diet"
  | "monitoring"
  | "topical"
  | "other";

export interface TreatmentEntity {
  id: string;
  petId: string;
  normalizedName: string;
  /** Subtipo semántico — unifica medications + treatments históricos */
  subtype?: TreatmentSubtype;
  startDate: string | null;
  endDate: string | null;
  status: TreatmentEntityStatus;
  linkedConditionIds: string[];
  evidenceEventIds: string[];
  prescribingProfessional: {
    name: string | null;
    license: string | null;
  };
  clinic: {
    name: string | null;
  };
  dosage: string | null;
  frequency: string | null;
  createdAt: string;
  updatedAt: string;
}

export type ClinicalAlertType =
  | "out_of_range"
  | "followup_not_scheduled"
  | "condition_persistent"
  | "treatment_no_followup"
  | "recommendation_pending";

export type ClinicalAlertSeverity = "low" | "medium" | "high";
export type ClinicalAlertStatus = "active" | "resolved" | "dismissed";

export interface ClinicalAlert {
  id: string;
  petId: string;
  type: ClinicalAlertType;
  severity: ClinicalAlertSeverity;
  title: string;
  description: string;
  triggeredOn: string;
  lastSeenOn: string;
  status: ClinicalAlertStatus;
  resolutionNotes: string | null;
  linkedConditionIds: string[];
  linkedEventIds: string[];
  linkedAppointmentIds: string[];
  ruleId: string;
}

export interface DocumentExtractionResponse {
  extractedData: ExtractedData;
  processingTimeMs: number;
  model: string;
  tokensUsed: number;
}

// ============================================================================
// Recordatorio Manual (independiente del historial médico)
// ============================================================================
export type ReminderType =
  | "vaccine"
  | "medication"
  | "checkup"
  | "grooming"
  | "deworming"
  | "other";

export type ReminderRepeat =
  | "none"
  | "daily"
  | "weekly"
  | "monthly"
  | "yearly";

export interface ManualReminder {
  id: string;
  petId: string;
  userId: string;
  type: ReminderType;
  title: string;
  notes: string | null;
  dueDate: string;        // YYYY-MM-DD
  dueTime: string | null; // HH:mm
  repeat: ReminderRepeat;
  completed: boolean;
  completedAt: string | null;
  dismissed: boolean;
  notifyEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}
