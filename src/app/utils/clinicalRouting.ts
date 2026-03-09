// ============================================================================
// PESSY - Clinical Routing Table
// Puente canónico entre el schema del cerebro (backend) y las colecciones
// operacionales (frontend/Firestore).
//
// REGLA: el tipo de documento determina la colección destino. Siempre.
// ============================================================================

import type { DocumentType } from "../types/medical";

// ─── Tipos del backend (groundedBrain / brainResolver) ───────────────────────

export type BrainCategory =
  | "Medication"
  | "Vaccine"
  | "Diagnostic"
  | "ClinicalEvent";

export type BrainDocumentType =
  // Laboratorio
  | "blood_panel"
  | "biochemistry_panel"
  | "urinalysis"
  | "fecal_exam"
  | "cytology"
  | "culture_sensitivity"
  | "serology"
  | "hormonal_panel"
  | "coagulation_panel"
  // Imágenes
  | "radiology_report"
  | "ultrasound_report"
  | "echocardiogram_report"
  | "endoscopy_report"
  | "ct_scan_report"
  | "mri_report"
  // Piel
  | "dermatology_microscopy"
  | "skin_biopsy"
  // Clínico
  | "general_clinical_report"
  | "surgical_report"
  | "anesthesia_report"
  | "pathology_report"
  // Cita / turno
  | "appointment_confirmation"
  | "referral_letter"
  // Prescripción / medicación
  | "prescription"
  | "discharge_summary"
  // Vacuna
  | "vaccination_record"
  // Équidos específicos
  | "equine_lameness_exam"
  | "equine_dental_exam"
  | "equine_reproductive_exam"
  // Exóticos / lagomorfos
  | "exotic_wellness_exam"
  | "dental_radiograph";

// ─── Colecciones operacionales Firestore ─────────────────────────────────────

export type OperationalCollection =
  | "medical_events"
  | "appointments"
  | "treatments";   // unifica medications + treatments históricos

// ─── Subtipo de tratamiento (unifica medications y treatments) ────────────────

export type TreatmentSubtype =
  | "medication"        // fármaco oral, inyectable, tópico
  | "supplement"        // suplemento, probiótico, vitamina
  | "vaccine_schedule"  // esquema de vacunación
  | "physical_therapy"  // rehabilitación, fisioterapia
  | "surgical_follow"   // post-quirúrgico / curaciones
  | "diet"              // restricción o cambio dietario
  | "monitoring"        // control de peso, PA, glucemia
  | "topical"           // champú, crema, spray
  | "other";

// ─── Resultado del routing ────────────────────────────────────────────────────

export interface RoutingDecision {
  collection: OperationalCollection;
  /** Para medical_events: mapea al DocumentType del frontend */
  documentType?: DocumentType;
  /** Para treatments: subtipo semántico */
  treatmentSubtype?: TreatmentSubtype;
  /** True si necesita revisión humana obligatoria antes de crear el registro */
  requiresHumanReview: boolean;
  /** Razón legible para mostrar en la UI de revisión */
  reviewReason?: string;
}

// ─── Tabla de routing por (category, document_type) ──────────────────────────

const ROUTING_TABLE: Record<string, RoutingDecision> = {
  // ── Vacunas ────────────────────────────────────────────────────────────────
  "Vaccine/vaccination_record": { collection: "medical_events", documentType: "vaccine", requiresHumanReview: false },
  "Vaccine/general_clinical_report": { collection: "medical_events", documentType: "vaccine", requiresHumanReview: false },

  // ── Citas / Turnos ─────────────────────────────────────────────────────────
  "ClinicalEvent/appointment_confirmation": { collection: "appointments", requiresHumanReview: false },
  "ClinicalEvent/referral_letter": { collection: "appointments", requiresHumanReview: true, reviewReason: "Derivación médica — requiere confirmar fecha y especialidad" },
  "ClinicalEvent/general_clinical_report": { collection: "medical_events", documentType: "checkup", requiresHumanReview: false },

  // ── Medicación / Prescripciones ────────────────────────────────────────────
  "Medication/prescription": { collection: "treatments", treatmentSubtype: "medication", requiresHumanReview: true, reviewReason: "Prescripción detectada — verificar dosis y frecuencia" },
  "Medication/discharge_summary": { collection: "treatments", treatmentSubtype: "medication", requiresHumanReview: true, reviewReason: "Alta médica con medicación — verificar protocolo" },
  "Medication/general_clinical_report": { collection: "treatments", treatmentSubtype: "medication", requiresHumanReview: true, reviewReason: "Medicación detectada en informe — confirmar indicación" },

  // ── Laboratorio ────────────────────────────────────────────────────────────
  "Diagnostic/blood_panel": { collection: "medical_events", documentType: "lab_test", requiresHumanReview: false },
  "Diagnostic/biochemistry_panel": { collection: "medical_events", documentType: "lab_test", requiresHumanReview: false },
  "Diagnostic/urinalysis": { collection: "medical_events", documentType: "lab_test", requiresHumanReview: false },
  "Diagnostic/fecal_exam": { collection: "medical_events", documentType: "lab_test", requiresHumanReview: false },
  "Diagnostic/cytology": { collection: "medical_events", documentType: "lab_test", requiresHumanReview: false },
  "Diagnostic/culture_sensitivity": { collection: "medical_events", documentType: "lab_test", requiresHumanReview: false },
  "Diagnostic/serology": { collection: "medical_events", documentType: "lab_test", requiresHumanReview: false },
  "Diagnostic/hormonal_panel": { collection: "medical_events", documentType: "lab_test", requiresHumanReview: false },
  "Diagnostic/coagulation_panel": { collection: "medical_events", documentType: "lab_test", requiresHumanReview: false },

  // ── Imágenes ───────────────────────────────────────────────────────────────
  "Diagnostic/radiology_report": { collection: "medical_events", documentType: "xray", requiresHumanReview: false },
  "Diagnostic/ultrasound_report": { collection: "medical_events", documentType: "xray", requiresHumanReview: false },
  "Diagnostic/echocardiogram_report": { collection: "medical_events", documentType: "echocardiogram", requiresHumanReview: false },
  "Diagnostic/ct_scan_report": { collection: "medical_events", documentType: "xray", requiresHumanReview: false },
  "Diagnostic/mri_report": { collection: "medical_events", documentType: "xray", requiresHumanReview: false },
  "Diagnostic/endoscopy_report": { collection: "medical_events", documentType: "other", requiresHumanReview: false },

  // ── Piel ───────────────────────────────────────────────────────────────────
  "Diagnostic/dermatology_microscopy": { collection: "medical_events", documentType: "lab_test", requiresHumanReview: false },
  "Diagnostic/skin_biopsy": { collection: "medical_events", documentType: "lab_test", requiresHumanReview: false },

  // ── Cirugía ────────────────────────────────────────────────────────────────
  "ClinicalEvent/surgical_report": { collection: "medical_events", documentType: "surgery", requiresHumanReview: false },
  "ClinicalEvent/anesthesia_report": { collection: "medical_events", documentType: "surgery", requiresHumanReview: false },

  // ── Patología ─────────────────────────────────────────────────────────────
  "Diagnostic/pathology_report": { collection: "medical_events", documentType: "lab_test", requiresHumanReview: false },

  // ── ECG ───────────────────────────────────────────────────────────────────
  "Diagnostic/electrocardiogram_report": { collection: "medical_events", documentType: "electrocardiogram", requiresHumanReview: false },

  // ── Équidos ───────────────────────────────────────────────────────────────
  "Diagnostic/equine_lameness_exam": { collection: "medical_events", documentType: "checkup", requiresHumanReview: false },
  "ClinicalEvent/equine_dental_exam": { collection: "medical_events", documentType: "checkup", requiresHumanReview: false },
  "ClinicalEvent/equine_reproductive_exam": { collection: "medical_events", documentType: "checkup", requiresHumanReview: false },

  // ── Exóticos / lagomorfos ─────────────────────────────────────────────────
  "ClinicalEvent/exotic_wellness_exam": { collection: "medical_events", documentType: "checkup", requiresHumanReview: false },
  "Diagnostic/dental_radiograph": { collection: "medical_events", documentType: "xray", requiresHumanReview: false },
};

// ─── Fallbacks por categoría cuando no hay entrada exacta ────────────────────

const CATEGORY_FALLBACK: Record<BrainCategory, RoutingDecision> = {
  Vaccine: { collection: "medical_events", documentType: "vaccine", requiresHumanReview: false },
  Medication: { collection: "treatments", treatmentSubtype: "medication", requiresHumanReview: true, reviewReason: "Medicación — confirmar protocolo antes de activar" },
  Diagnostic: { collection: "medical_events", documentType: "other", requiresHumanReview: false },
  ClinicalEvent: { collection: "medical_events", documentType: "checkup", requiresHumanReview: false },
};

// ─── API pública ──────────────────────────────────────────────────────────────

/**
 * Determina dónde debe persistirse un registro producido por el cerebro clínico.
 *
 * @param category   - category del BrainOutputPayload  (e.g. "Diagnostic")
 * @param documentType - document_type del BrainOutputPayload (e.g. "blood_panel")
 * @param overrideRequiresReview - fuerza revisión humana (low confidence, pet_not_found, etc.)
 */
export function resolveRoutingDecision(
  category: string,
  documentType: string,
  overrideRequiresReview?: { force: true; reason: string }
): RoutingDecision {
  const key = `${category}/${documentType}`;
  const base: RoutingDecision =
    ROUTING_TABLE[key] ??
    CATEGORY_FALLBACK[category as BrainCategory] ??
    { collection: "medical_events", documentType: "other", requiresHumanReview: true, reviewReason: "Tipo de documento no reconocido" };

  if (overrideRequiresReview) {
    return { ...base, requiresHumanReview: true, reviewReason: overrideRequiresReview.reason };
  }
  return base;
}

/**
 * Mapeo inverso: dado un DocumentType del frontend, retorna el label
 * legible para la UI y el icono canónico.
 */
export const DOCUMENT_TYPE_UI: Record<DocumentType, { label: string; icon: string }> = {
  vaccine:           { label: "Vacunación",              icon: "💉" },
  appointment:       { label: "Turno médico",            icon: "📅" },
  lab_test:          { label: "Laboratorio",             icon: "🧪" },
  xray:              { label: "Estudio por imágenes",    icon: "🔬" },
  echocardiogram:    { label: "Ecocardiograma",          icon: "❤️" },
  electrocardiogram: { label: "Electrocardiograma",      icon: "📈" },
  surgery:           { label: "Cirugía",                 icon: "🏥" },
  medication:        { label: "Medicación / Tratamiento",icon: "💊" },
  checkup:           { label: "Control clínico",         icon: "🩺" },
  other:             { label: "Documento médico",        icon: "📄" },
};
