/**
 * Email Classifier for Pessy Gmail Ingestion Pipeline
 *
 * Provides a formal enum and pure classification function for categorizing
 * veterinary emails. Zero side effects, no Firebase, fully testable.
 */

// ── Formal enum ───────────────────────────────────────────────────────────────

export enum EmailClassType {
  APPOINTMENT_CONFIRMATION = "appointment_confirmation",
  APPOINTMENT_REMINDER = "appointment_reminder",
  APPOINTMENT_CANCELLATION = "appointment_cancellation",
  CLINICAL_REPORT = "clinical_report",
  PRESCRIPTION = "prescription",
  VACCINATION = "vaccination",
  ADMINISTRATIVE = "administrative",
  FORWARD = "forward",
  HUMAN_MEDICAL = "human_medical",
  NON_CLINICAL = "non_clinical",
  UNKNOWN = "unknown",
}

// ── Interfaces ────────────────────────────────────────────────────────────────

export interface EmailClassification {
  type: EmailClassType;
  confidence: number;
  signals: string[];
  method: "rule" | "heuristic";
  requiresAiReview: boolean;
  isForwarded: boolean;
  originalType?: EmailClassType;
}

export interface EmailClassifierInput {
  subject: string;
  fromEmail: string;
  bodyText: string;
  attachmentFilenames: string[];
  snippet?: string;
}

// ── Domain lists ──────────────────────────────────────────────────────────────

const HUMAN_BLOCKED_DOMAINS = new Set([
  "huesped.org",
  "huesped.org.ar",
  "osde.com.ar",
  "osdebinario.com.ar",
  "swissmedical.com.ar",
  "medicus.com.ar",
  "galeno.com.ar",
  "omint.com.ar",
  "hospitalitaliano.org.ar",
  "hospitalaleman.com",
  "afip.gob.ar",
  "afip.gov.ar",
  "ioma.gob.ar",
  "pami.org.ar",
  "cuil.gob.ar",
]);

const KNOWN_VET_SENDERS = new Set([
  "turnos@veterinariapanda.com.ar",
  "citas@veterinariapanda.com.ar",
  "lvdiazz@yahoo.com.ar",
  "noreply@myvete.com",
]);

const ADMINISTRATIVE_SENDERS = new Set([
  "facturaelectronica@veterinariapanda.com.ar",
]);

// ── Helpers ───────────────────────────────────────────────────────────────────

function getSenderDomain(fromEmail: string): string {
  const match = fromEmail.toLowerCase().match(/@([\w.-]+)/);
  return match ? match[1] : "";
}

function isAttachmentFirstEmail(bodyText: string, attachmentFilenames: string[], subject: string): boolean {
  // Check if body is minimal (< 30 chars)
  if (bodyText.trim().length >= 30) return false;
  // Must have at least one attachment
  if (attachmentFilenames.length < 1) return false;
  
  const clinicalKeywords = [
    "eco", "rx", "radiografia", "laboratorio", "resultado", "informe", "estudio", "diagnostico",
    "historia", "clinica", "goita", "consulta", "biopsia", "hemograma", "bioquim", "analisis",
    "ultrasonido", "tomografia", "resonancia", "placa", "rayos",
  ];
  
  const subjectLower = subject.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const hasSubjectKeyword = clinicalKeywords.some(kw => subjectLower.includes(kw));
  
  const attachmentNamesLower = attachmentFilenames.map(f => f.toLowerCase()).join(" ");
  const hasAttachmentKeyword = clinicalKeywords.some(kw => attachmentNamesLower.includes(kw));
  
  return hasSubjectKeyword || hasAttachmentKeyword;
}

function normalizedLower(text: string): string {
  return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function hasKeyword(text: string, keywords: string[]): string | null {
  const normalized = normalizedLower(text);
  for (const kw of keywords) {
    if (normalized.includes(normalizedLower(kw))) return kw;
  }
  return null;
}

// ── Classification logic ──────────────────────────────────────────────────────

export function classifyEmail(input: EmailClassifierInput): EmailClassification {
  const { subject, fromEmail, bodyText, attachmentFilenames } = input;
  const fromLower = fromEmail.toLowerCase();
  const subjectLower = subject.toLowerCase();
  const bodyLower = bodyText.toLowerCase();
  const combined = `${subjectLower} ${bodyLower}`;
  const domain = getSenderDomain(fromEmail);
  const signals: string[] = [];

  // ── 1. HUMAN_MEDICAL ──────────────────────────────────────────────────────
  if (HUMAN_BLOCKED_DOMAINS.has(domain)) {
    signals.push(`blocked_domain:${domain}`);
    return {
      type: EmailClassType.HUMAN_MEDICAL,
      confidence: 100,
      signals,
      method: "rule",
      requiresAiReview: false,
      isForwarded: false,
    };
  }
  const humanKeywords = [
    "afiliado", "afiliada", "numero de socio", "nro de socio",
    "cobertura medica", "plan medico", "medico de cabecera",
    "guardia medica", "autorización medica", "autorización de practica",
    "obra social", "cuil", "dni",
  ];
  const humanKw = hasKeyword(combined, humanKeywords);
  if (humanKw) {
    signals.push(`human_keyword:${humanKw}`);
    return {
      type: EmailClassType.HUMAN_MEDICAL,
      confidence: 85,
      signals,
      method: "rule",
      requiresAiReview: false,
      isForwarded: false,
    };
  }

  // ── 2. Detect FORWARD ─────────────────────────────────────────────────────
  const fwdPattern = /^(fwd?:|re(env[íi]o?|nv):|rv:|tr:)\s*/i;
  const isForwarded = fwdPattern.test(subject.trim());
  if (isForwarded) signals.push("forward_prefix");

  // ── 3. ADMINISTRATIVE ─────────────────────────────────────────────────────
  if (ADMINISTRATIVE_SENDERS.has(fromLower)) {
    signals.push("administrative_sender");
    return {
      type: EmailClassType.ADMINISTRATIVE,
      confidence: 100,
      signals,
      method: "rule",
      requiresAiReview: false,
      isForwarded,
    };
  }
  const adminKw = hasKeyword(combined, ["comprobante de pago", "factura electronica", "recibo de pago"]);
  if (adminKw) {
    const clinicalOverride = hasKeyword(combined, ["ecografia", "radiografia", "laboratorio", "vacuna", "diagnostico"]);
    if (!clinicalOverride) {
      signals.push(`admin_keyword:${adminKw}`);
      return {
        type: EmailClassType.ADMINISTRATIVE,
        confidence: 90,
        signals,
        method: "rule",
        requiresAiReview: false,
        isForwarded,
      };
    }
  }

  // ── 4. APPOINTMENT_REMINDER ───────────────────────────────────────────────
  const reminderKw = hasKeyword(combined, [
    "recordatorio del turno", "recordatorio de turno",
    "te recordamos tu turno", "recordatorio de tu turno",
  ]);
  if (reminderKw) {
    signals.push(`reminder:${reminderKw}`);
    return {
      type: EmailClassType.APPOINTMENT_REMINDER,
      confidence: KNOWN_VET_SENDERS.has(fromLower) ? 98 : 88,
      signals,
      method: "rule",
      requiresAiReview: false,
      isForwarded,
    };
  }

  // ── 5. APPOINTMENT_CONFIRMATION ───────────────────────────────────────────
  const confirmKw = hasKeyword(combined, [
    "informacion de turno solicitado", "información de turno solicitado",
    "turno confirmado", "confirmacion de turno", "tu turno ha sido confirmado",
    "hemos recibido tu turno",
  ]);
  if (confirmKw) {
    signals.push(`confirmation:${confirmKw}`);
    return {
      type: EmailClassType.APPOINTMENT_CONFIRMATION,
      confidence: KNOWN_VET_SENDERS.has(fromLower) ? 98 : 88,
      signals,
      method: "rule",
      requiresAiReview: false,
      isForwarded,
    };
  }

  // ── 6. APPOINTMENT_CANCELLATION ───────────────────────────────────────────
  const cancelKw = hasKeyword(combined, [
    "turno cancelado", "cancelacion de turno", "cancelación de turno",
    "reprogramacion", "reprogramación", "turno reprogramado",
  ]);
  if (cancelKw) {
    signals.push(`cancellation:${cancelKw}`);
    return {
      type: EmailClassType.APPOINTMENT_CANCELLATION,
      confidence: 90,
      signals,
      method: "rule",
      requiresAiReview: false,
      isForwarded,
    };
  }

  // ── 7. CLINICAL_REPORT ────────────────────────────────────────────────────
  const clinicalAttachmentNames = [
    "eco", "rx", "radiografia", "laboratorio", "resultado", "informe", "estudio", "thor", "diagnostico",
    "historia", "clinica", "goita", "consulta", "biopsia", "hemograma", "bioquim", "analisis",
    "ultrasonido", "tomografia", "resonancia", "placa", "rayos", "vet",
  ];
  for (const fname of attachmentFilenames) {
    const nameLower = fname.toLowerCase();
    const match = clinicalAttachmentNames.find((k) => nameLower.includes(k));
    if (match) {
      signals.push(`clinical_attachment:${fname}`);
    }
  }
  const clinicalBodyKw = hasKeyword(combined, [
    "ecografia", "ecográfica", "eco abdominal", "eco cardiaco",
    "radiografia", "placa de torax", "laboratorio clinico",
    "resultado de laboratorio", "informe radiologico",
    "hemograma", "bioquimica", "koh", "biopsia",
    "cardiomegalia", "hepatomegalia", "hallazgos",
  ]);
  const isAttachmentFirst = isAttachmentFirstEmail(bodyText, attachmentFilenames, subject);
  if (isAttachmentFirst) {
    signals.push("attachment_first:true");
  }
  if (signals.some((s) => s.startsWith("clinical_attachment")) || clinicalBodyKw || isAttachmentFirst) {
    if (clinicalBodyKw) signals.push(`clinical_body:${clinicalBodyKw}`);
    let confidence = 80;
    if (signals.some((s) => s.startsWith("clinical_attachment"))) confidence = 92;
    if (isAttachmentFirst) confidence = 95;
    return {
      type: EmailClassType.CLINICAL_REPORT,
      confidence,
      signals,
      method: "rule",
      requiresAiReview: false,
      isForwarded,
    };
  }

  // ── 8. VACCINATION ────────────────────────────────────────────────────────
  const vacKw = hasKeyword(combined, [
    "vacuna", "revacunacion", "revacunación", "esquema de vacunacion",
    "calendario vacunal", "vacunacion antirrábica", "refuerzo de vacuna",
  ]);
  if (vacKw) {
    signals.push(`vaccination:${vacKw}`);
    return {
      type: EmailClassType.VACCINATION,
      confidence: 88,
      signals,
      method: "rule",
      requiresAiReview: false,
      isForwarded,
    };
  }

  // ── 9. PRESCRIPTION ──────────────────────────────────────────────────────
  const rxKw = hasKeyword(combined, [
    "receta veterinaria", "prescripcion", "prescripción",
    "medicacion indicada", "medicación indicada", "tratamiento indicado",
    "dosis", "administrar cada",
  ]);
  if (rxKw) {
    signals.push(`prescription:${rxKw}`);
    return {
      type: EmailClassType.PRESCRIPTION,
      confidence: 82,
      signals,
      method: "rule",
      requiresAiReview: false,
      isForwarded,
    };
  }

  // ── 10. FORWARD (final — si no pudo resolver el tipo real) ────────────────
  if (isForwarded) {
    return {
      type: EmailClassType.FORWARD,
      confidence: 70,
      signals,
      method: "heuristic",
      requiresAiReview: true,
      isForwarded: true,
    };
  }

  // ── 11. NON_CLINICAL or UNKNOWN ───────────────────────────────────────────
  const anyVetSignal = hasKeyword(combined, [
    "veterinaria", "veterinario", "mascota", "canino", "felino",
    "turno", "cita", "consulta veterinaria",
  ]);
  if (anyVetSignal) {
    signals.push(`vet_signal:${anyVetSignal}`);
    return {
      type: EmailClassType.UNKNOWN,
      confidence: 40,
      signals,
      method: "heuristic",
      requiresAiReview: true,
      isForwarded,
    };
  }

  return {
    type: EmailClassType.NON_CLINICAL,
    confidence: 85,
    signals: [...signals, "no_vet_signals_found"],
    method: "heuristic",
    requiresAiReview: false,
    isForwarded,
  };
}