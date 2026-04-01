import * as admin from "firebase-admin";
import {
  ClinicalExtractionOutput, ClinicalEventExtraction,
  ClinicalMedication, ClinicalLabResult,
  ClinicalClassificationOutput, ClinicalClassificationInput,
  AttachmentMetadata, StudySubtype, EventType,
  OCR_TIMEOUT_MS, CLINICAL_AI_TIMEOUT_MS,
  CLASSIFICATION_AI_TIMEOUT_MS, MAX_AI_DOCUMENT_TEXT_CHARS,
  ONE_DAY_MS,
} from "./types";
import {
  asString, asRecord, asNonNegativeNumber, clamp,
  getNowIso, normalizeForHash, tryParseJson, splitTextForAi,
  toIsoDateOnly,
} from "./utils";
import {
  isAppointmentEventType, isStudyEventType,
  normalizeExtractedEventType,
  inferAppointmentStatusFromText, normalizeAppointmentStatusValue,
  sanitizeAppointmentTime, extractAppointmentTimeFromText,
  extractProfessionalNameFromText, extractClinicNameFromText,
  extractAppointmentSpecialtyFromText,
  inferImagingTypeFromSignals, inferStudySubtypeFromSignals,
  applyConstitutionalGuardrails,
} from "./clinicalNormalization";
import {
  isTrustedClinicalSender, isVetDomain,
  hasStrongHumanHealthcareSignal, hasStrongVeterinaryEvidence,
  hasStrongNonClinicalSignal, attachmentNamesContainClinicalSignal,
} from "./petMatching";
import { recordSessionStageMetric } from "./sessionQueue";
import { resolveClinicalKnowledgeContext } from "../../clinical/knowledgeBase";

// ─── Rate limiting ──────────────────────────────────────────────────────────

export async function consumeUserAiQuota(userId: string, units = 1): Promise<void> {
  const capRaw = Number(process.env.CLINICAL_AI_MAX_CALLS_PER_MINUTE_PER_USER || 5);
  const perUserCap = Number.isFinite(capRaw) ? clamp(Math.round(capRaw), 1, 600) : 5;
  const now = new Date();
  const minuteKey = now.toISOString().slice(0, 16);
  const docId = `${userId}_${minuteKey}`;
  const quotaRef = admin.firestore().collection("gmail_ai_quota_user").doc(docId);
  let blocked = false;
  await admin.firestore().runTransaction(async (tx) => {
    blocked = false;
    const snap = await tx.get(quotaRef);
    const data = asRecord(snap.data());
    const used = asNonNegativeNumber(data.used, 0);
    if (used + units > perUserCap) {
      blocked = true;
      return;
    }
    tx.set(
      quotaRef,
      {
        user_id: userId,
        minute_key: minuteKey,
        used: used + units,
        cap: perUserCap,
        updated_at: getNowIso(),
        expires_at: new Date(Date.now() + 10 * ONE_DAY_MS).toISOString(),
      },
      { merge: true }
    );
  });
  if (blocked) {
    throw new Error("user_ai_rate_limited");
  }
}

export async function consumeGlobalAiQuota(units = 1): Promise<void> {
  const capRaw = Number(process.env.CLINICAL_AI_MAX_CALLS_PER_MINUTE || 30);
  const perMinuteCap = Number.isFinite(capRaw) ? clamp(Math.round(capRaw), 1, 600) : 30;
  const now = new Date();
  const minuteKey = now.toISOString().slice(0, 16);
  const quotaRef = admin.firestore().collection("gmail_ai_quota").doc(minuteKey);
  let blocked = false;
  await admin.firestore().runTransaction(async (tx) => {
    blocked = false;
    const snap = await tx.get(quotaRef);
    const data = asRecord(snap.data());
    const used = asNonNegativeNumber(data.used, 0);
    if (used + units > perMinuteCap) {
      blocked = true;
      return;
    }
    tx.set(
      quotaRef,
      {
        minute_key: minuteKey,
        used: used + units,
        cap: perMinuteCap,
        updated_at: getNowIso(),
        expires_at: new Date(Date.now() + 10 * ONE_DAY_MS).toISOString(),
      },
      { merge: true }
    );
  });
  if (blocked) {
    throw new Error("global_ai_rate_limited");
  }
}

// ─── Core Gemini call ───────────────────────────────────────────────────────

export async function callGemini(
  payload: Record<string, unknown>,
  timeoutMs: number,
  options?: { softFailUnsupportedMime?: boolean; userId?: string }
): Promise<Record<string, unknown>> {
  const apiKey = asString(process.env.GEMINI_API_KEY);
  if (!apiKey) throw new Error("gemini_api_key_missing");
  if (options?.userId) {
    await consumeUserAiQuota(options.userId, 1);
  }
  await consumeGlobalAiQuota(1);
  const model = asString(process.env.ANALYSIS_MODEL) || "gemini-2.5-flash";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      }
    );

    if (!response.ok) {
      const text = await response.text();
      if (options?.softFailUnsupportedMime && /Unsupported MIME type/i.test(text)) {
        return {};
      }
      throw new Error(`gemini_failed_${response.status}: ${text.slice(0, 800)}`);
    }

    return (await response.json()) as Record<string, unknown>;
  } finally {
    clearTimeout(timeout);
  }
}

// ─── Response parsing ───────────────────────────────────────────────────────

export function extractGeminiText(data: Record<string, unknown>): string {
  const candidates = data.candidates as Array<Record<string, unknown>> | undefined;
  const first = Array.isArray(candidates) ? candidates[0] : null;
  const content = first ? asRecord(first.content) : {};
  const parts = content.parts as Array<Record<string, unknown>> | undefined;
  const firstPart = Array.isArray(parts) ? parts[0] : null;
  return firstPart ? asString(firstPart.text) : "";
}

// ─── OCR ────────────────────────────────────────────────────────────────────

export async function ocrAttachmentViaGemini(args: {
  mimeType: string;
  base64Data: string;
  userId?: string;
}): Promise<string> {
  const payload = {
    contents: [
      {
        parts: [
          {
            text:
              "Extraé texto clínico veterinario de este archivo. Devolver texto plano sin markdown. " +
              "Si no hay texto legible, devolver cadena vacía.",
          },
          {
            inline_data: {
              mime_type: args.mimeType,
              data: args.base64Data,
            },
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0,
      topK: 1,
      topP: 1,
      maxOutputTokens: 1600,
    },
  };
  const data = await callGemini(payload, OCR_TIMEOUT_MS, { softFailUnsupportedMime: true, userId: args.userId });
  return extractGeminiText(data).slice(0, 120_000);
}

// ─── Clinical extraction prompt ─────────────────────────────────────────────

export function buildClinicalPrompt(args: {
  extractedText: string;
  emailDate: string;
  sourceSubject: string;
  sourceSender: string;
  petContext: Record<string, unknown>;
  attachmentMetadata: AttachmentMetadata[];
  knowledgeContext: string;
}): string {
  const systemPrompt = `
Role: Veterinary Clinical Data Extractor for Pessy.app.
Mission: transform veterinary email content into structured clinical facts, avoiding false positives.

Strict rules:
1) Ignore non-clinical content: promotions, pet food/accessories ads, newsletters, ecommerce, banking, generic admin emails.
2) Process only explicit clinical evidence: diagnosis, lab result, imaging findings, vaccination records, prescriptions, interconsult notes, follow-up indications.
3) Never invent values. If not explicit in text, use null.
4) Keep source-of-truth hierarchy: extracted medical facts > generic narrative.
5) Medication extraction priority: name, concentration (if present), dose, frequency, duration.
6) Date normalization: YYYY-MM-DD when confidence is enough, otherwise null.
7) If clinical signal exists but certainty is low, set requires_human_review=true.
8) Narrative summary must be in Spanish, simple and non-alarming.
9) Nunca interpretes medidas anatómicas, volúmenes u órganos (ej. "vol 14.53 ml") como medicamento o dosis. Si no hay fármaco explícito, medications debe quedar [].
10) Nunca crees tratamiento activo desde texto histórico, calendarios de vacunación o referencias informativas antiguas. En esos casos set requires_human_review=true y reason_if_review_needed="historical_info_only".
11) Nunca entierres un hallazgo clínico en description_summary. Si hay hallazgo explícito, copiarlo en diagnosis o dejar requires_human_review=true con reason_if_review_needed="unstructured_clinical_finding".
12) Si el nuevo contenido contradice known_conditions del contexto, no lo des por confirmado: set requires_human_review=true y reason_if_review_needed="possible_clinical_conflict".
13) Si detectás una posible medicación sin nombre de droga explícito, set requires_human_review=true y reason_if_review_needed="medication_without_explicit_drug_name".
14) No uses description_summary del mail para poblar observations clínicas. Solo resume el hecho detectado; no copies logística como dato clínico.
15) Para appointment_* extrae obligatoriamente appointment_time, professional_name, clinic_name y appointment_status. Si falta alguno, set requires_human_review=true y reason_if_review_needed="incomplete_appointment_details".
16) Para study_report define study_subtype="imaging" o "lab". Si no podés distinguirlo con seguridad, set requires_human_review=true y reason_if_review_needed="study_subtype_undetermined".
17) Para prescription_record solo confirmar si hay droga + dosis + frecuencia. Si falta alguno, set requires_human_review=true y reason_if_review_needed="missing_treatment_dose_or_frequency".
18) appointment_confirmation, appointment_reminder y appointment_cancellation son operativos; no los conviertas en diagnóstico clínico.
19) Si el contexto de identidad de la mascota entra en conflicto con el correo o adjunto (por nombre, especie o raza), set requires_human_review=true y reason_if_review_needed="IDENTITY_CONFLICT".
20) Si el adjunto, OCR o informe menciona radiografía, Rx, ecografía, ultrasound, ECG, electrocardiograma, laboratorio, hemograma o bioquímica, la salida debe ser study_report aunque el cuerpo del mail hable de turno, agenda, recordatorio o confirmación.
21) Si hay conflicto entre el texto logístico del mail y el contenido clínico del adjunto, el adjunto pesa más.
22) Si el correo parece de medicina humana, obra social u ONG de salud y no hay evidencia explícita de veterinaria o mascota, set is_clinical_content=false.

Return valid JSON only with this schema:
{
  "is_clinical_content": boolean,
  "confidence_overall": number,
  "detected_events": [
    {
      "event_type": "appointment_confirmation" | "appointment_reminder" | "appointment_cancellation" | "clinical_report" | "study_report" | "prescription_record" | "vaccination_record",
      "event_date": "YYYY-MM-DD" | null,
      "date_confidence": number,
      "description_summary": string,
      "diagnosis": string | null,
      "appointment_time": "HH:mm" | null,
      "appointment_specialty": string | null,
      "professional_name": string | null,
      "clinic_name": string | null,
      "appointment_status": "confirmed" | "reminder" | "cancelled" | "scheduled" | null,
      "study_subtype": "imaging" | "lab" | null,
      "medications": [
        {
          "name": string,
          "dose": string | null,
          "frequency": string | null,
          "duration_days": number | null,
          "is_active": boolean | null
        }
      ],
      "lab_results": [
        {
          "test_name": string,
          "result": string,
          "unit": string | null,
          "reference_range": string | null
        }
      ],
      "imaging_type": string | null,
      "severity": "mild" | "moderate" | "severe" | null,
      "confidence_score": number
    }
  ],
  "narrative_summary": string,
  "requires_human_review": boolean,
  "reason_if_review_needed": string | null
}`;

  return [
    systemPrompt.trim(),
    "",
    "Clinical context:",
    args.knowledgeContext.slice(0, 7000),
    "",
    "Pet context JSON:",
    JSON.stringify(args.petContext),
    "",
    "Email date:",
    args.emailDate,
    "",
    "Email subject:",
    args.sourceSubject.slice(0, 400),
    "",
    "Email sender:",
    args.sourceSender.slice(0, 320),
    "",
    "Attachment metadata JSON:",
    JSON.stringify(args.attachmentMetadata),
    "",
    "Extracted text:",
    args.extractedText.slice(0, 35_000),
  ].join("\n");
}

// ─── Veterinary evidence inference ──────────────────────────────────────────

/**
 * Derive ALL classification hints from purely deterministic sources:
 * email subject line patterns (regex), attachment filenames, and known sender
 * domain mappings. No AI inference is used here.
 *
 * Golden rule: deterministic logic decides document_type; AI only writes
 * the human-facing message (description_summary, narrative_summary, etc.).
 */
export function deriveVeterinaryEvidenceHints(args: {
  extractedText: string;
  sourceSubject: string;
  sourceSender: string;
  attachmentMetadata: AttachmentMetadata[];
}): {
  preferStudyReport: boolean;
  preferredStudySubtype: StudySubtype;
  inferredImagingType: string | null;
  humanHealthcareNoise: boolean;
  /**
   * When non-null, this is the document_type determined entirely by regex /
   * hardcoded rules on email metadata (subject, attachments, sender domain).
   * applyVeterinaryEvidencePriority MUST use this value as the authoritative
   * event_type; AI classification output is demoted to ai_type_hint metadata.
   */
  deterministicEventType: EventType | null;
} {
  const evidenceText = [
    args.sourceSubject,
    args.sourceSender,
    args.extractedText,
    args.attachmentMetadata.map((row) => row.filename).join(" "),
  ].join(" ");
  const inferredImagingType = inferImagingTypeFromSignals(evidenceText);
  const preferredStudySubtype = inferStudySubtypeFromSignals({
    rawStudySubtype: null,
    imagingType: inferredImagingType,
    labResults: [],
    descriptionSummary: evidenceText,
    diagnosis: null,
  });
  const preferStudyReport =
    preferredStudySubtype !== null ||
    /\b(informe|resultado|estudio|radiograf|ecograf|ultrasound|ecg|electrocard|hemograma|bioquim|laboratorio|koh|citolog|microscop)\b/i.test(
      evidenceText
    ) ||
    attachmentNamesContainClinicalSignal(args.attachmentMetadata);

  // ── Deterministic event_type derivation from email metadata only ──────────
  // Priority order: study signals > vaccination > prescription > appointment.
  // Each branch uses only regex on subject / filenames / sender — no AI output.
  let deterministicEventType: EventType | null = null;
  if (preferStudyReport) {
    deterministicEventType = "study_report";
  } else if (/\b(vacuna|vacunaci[oó]n|vaccine|vaccination)\b/i.test(evidenceText)) {
    deterministicEventType = "vaccination_record";
  } else if (/\b(receta|prescripci[oó]n|medicaci[oó]n|dosis|tratamiento|prescrip)\b/i.test(evidenceText)) {
    deterministicEventType = "prescription_record";
  } else if (
    /\b(turno|recordatorio|confirmaci[oó]n|cancelaci[oó]n|reprogramaci[oó]n|cita|appointment|reminder|cancel)\b/i.test(
      evidenceText
    )
  ) {
    // Narrow down appointment subtype deterministically from subject keywords.
    if (/\b(cancelaci[oó]n|cancelado|cancel)\b/i.test(args.sourceSubject)) {
      deterministicEventType = "appointment_cancellation";
    } else if (/\b(recordatorio|reminder)\b/i.test(args.sourceSubject)) {
      deterministicEventType = "appointment_reminder";
    } else {
      deterministicEventType = "appointment_confirmation";
    }
  }
  // If none of the above patterns match, deterministicEventType stays null —
  // the caller should fall back to "clinical_report" as a safe default rather
  // than trusting AI classification directly.

  return {
    preferStudyReport,
    preferredStudySubtype,
    inferredImagingType,
    humanHealthcareNoise: hasStrongHumanHealthcareSignal(evidenceText),
    deterministicEventType,
  };
}

// ─── Evidence priority application ──────────────────────────────────────────

/**
 * Apply deterministic classification evidence to the event produced by the AI
 * extractor.
 *
 * Golden rule (MUST NOT be violated):
 *   "Logic is deterministic. AI only writes the human-facing message."
 *
 * This means `event_type` (document_type) MUST come from hardcoded regex
 * patterns on email metadata — never from AI confidence scores or AI-inferred
 * type labels.  The AI's original type suggestion is preserved in the
 * `ai_type_hint` field for auditability but MUST NOT influence routing,
 * storage, or any business logic.
 *
 * Precedence:
 *   1. hints.deterministicEventType  — regex on subject / filenames / sender
 *   2. "clinical_report"             — safe hardcoded fallback
 *   (The AI-inferred event.event_type is NEVER used as the final event_type.)
 */
export function applyVeterinaryEvidencePriority(args: {
  event: ClinicalEventExtraction;
  hints: ReturnType<typeof deriveVeterinaryEvidenceHints>;
}): ClinicalEventExtraction {
  const { event, hints } = args;

  // Store the AI-inferred type as metadata only — it must not decide the
  // final document_type.  Downstream consumers MUST read `event_type`, not
  // `ai_type_hint`, for any classification decisions.
  const ai_type_hint: string = event.event_type;

  // Resolve the authoritative event_type from deterministic sources only.
  const deterministicType: EventType = hints.deterministicEventType ?? "clinical_report";

  // When the deterministic type is study_report, enrich study-specific fields
  // from the evidence hints (also deterministic — inferred from filenames /
  // subject regex).
  if (deterministicType === "study_report") {
    return {
      ...event,
      event_type: "study_report",
      study_subtype: event.study_subtype || hints.preferredStudySubtype,
      imaging_type: event.imaging_type || hints.inferredImagingType,
      // Appointment fields are not applicable for study reports.
      appointment_time: null,
      appointment_specialty: null,
      appointment_status: null,
      ai_type_hint,
    };
  }

  // For all other deterministic types, apply the resolved type directly.
  // Appointment-specific enrichment is valid only for appointment event types.
  const isAppointment =
    deterministicType === "appointment_confirmation" ||
    deterministicType === "appointment_reminder" ||
    deterministicType === "appointment_cancellation";

  // At this point deterministicType is guaranteed NOT to be "study_report"
  // (that branch returned early above), so study fields are always cleared.
  return {
    ...event,
    event_type: deterministicType,
    study_subtype: null,
    imaging_type: null,
    // Clear appointment fields when the document is not an appointment.
    appointment_time: isAppointment ? event.appointment_time : null,
    appointment_specialty: isAppointment ? event.appointment_specialty : null,
    appointment_status: isAppointment ? event.appointment_status : null,
    ai_type_hint,
  };
}

// ─── AI output → structured output ─────────────────────────────────────────

export function toClinicalOutput(
  json: Record<string, unknown> | null,
  context?: {
    extractedText: string;
    sourceSubject: string;
    sourceSender: string;
    attachmentMetadata: AttachmentMetadata[];
  }
): ClinicalExtractionOutput {
  if (!json) {
    return {
      is_clinical_content: false,
      confidence_overall: 0,
      detected_events: [],
      narrative_summary: "",
      requires_human_review: true,
      reason_if_review_needed: "invalid_ai_json",
    };
  }

  const eventsRaw = Array.isArray(json.detected_events) ? json.detected_events : [];
  const constitutionalReviewReasons = new Set<string>();
  const evidenceHints = context
    ? deriveVeterinaryEvidenceHints({
        extractedText: context.extractedText,
        sourceSubject: context.sourceSubject,
        sourceSender: context.sourceSender,
        attachmentMetadata: context.attachmentMetadata,
      })
    : {
        preferStudyReport: false,
        preferredStudySubtype: null as StudySubtype,
        inferredImagingType: null,
        humanHealthcareNoise: false,
        deterministicEventType: null as EventType | null,
      };
  const detectedEvents: ClinicalEventExtraction[] = eventsRaw
    .map((item) => {
      const row = asRecord(item);
      const meds = Array.isArray(row.medications) ? row.medications : [];
      const labs = Array.isArray(row.lab_results) ? row.lab_results : [];
      const normalizedMeds = meds
        .map((med) => {
          const m = asRecord(med);
          const name = asString(m.name);
          if (!name) return null;
          return {
            name,
            dose: asString(m.dose) || null,
            frequency: asString(m.frequency) || null,
            duration_days: asNonNegativeNumber(m.duration_days, 0) || null,
            is_active: typeof m.is_active === "boolean" ? m.is_active : null,
          } as ClinicalMedication;
        })
        .filter((value): value is ClinicalMedication => Boolean(value));
      const normalizedLabs = labs
        .map((lab) => {
          const l = asRecord(lab);
          const testName = asString(l.test_name);
          const result = asString(l.result);
          if (!testName || !result) return null;
          return {
            test_name: testName,
            result,
            unit: asString(l.unit) || null,
            reference_range: asString(l.reference_range) || null,
          } as ClinicalLabResult;
        })
        .filter((value): value is ClinicalLabResult => Boolean(value));
      const eventType = normalizeExtractedEventType(asString(row.event_type), row);
      if (!eventType) {
        return null;
      }

      const descriptionSummary = asString(row.description_summary) || "Registro clínico detectado";
      const diagnosis = asString(row.diagnosis) || null;
      const eventTextContext = [
        descriptionSummary,
        diagnosis,
        asString(row.professional_name),
        asString(row.clinic_name),
      ]
        .filter(Boolean)
        .join(" ");
      const appointmentStatus = isAppointmentEventType(eventType)
        ? normalizeAppointmentStatusValue(row.appointment_status, eventTextContext)
        : null;
      const appointmentTime = isAppointmentEventType(eventType)
        ? sanitizeAppointmentTime(row.appointment_time ?? row.time) || extractAppointmentTimeFromText(eventTextContext)
        : null;
      const professionalName = isAppointmentEventType(eventType)
        ? asString(row.professional_name) || extractProfessionalNameFromText(eventTextContext)
        : null;
      const clinicName = isAppointmentEventType(eventType)
        ? asString(row.clinic_name) || extractClinicNameFromText(eventTextContext)
        : null;
      const appointmentSpecialty = isAppointmentEventType(eventType)
        ? asString(row.appointment_specialty) || extractAppointmentSpecialtyFromText(eventTextContext)
        : null;
      const studySubtype = isStudyEventType(eventType)
        ? inferStudySubtypeFromSignals({
            rawStudySubtype: row.study_subtype,
            imagingType: row.imaging_type,
            labResults: normalizedLabs,
            descriptionSummary,
            diagnosis,
          })
        : null;

      return {
        event_type: eventType,
        event_date: asString(row.event_date) || null,
        date_confidence: clamp(asNonNegativeNumber(row.date_confidence, 0), 0, 100),
        description_summary: descriptionSummary,
        diagnosis,
        medications: normalizedMeds,
        lab_results: normalizedLabs,
        imaging_type: asString(row.imaging_type) || null,
        study_subtype: studySubtype,
        appointment_time: appointmentTime,
        appointment_specialty: appointmentSpecialty,
        professional_name: professionalName,
        clinic_name: clinicName,
        appointment_status: appointmentStatus,
        severity: ((): "mild" | "moderate" | "severe" | null => {
          const sev = asString(row.severity).toLowerCase();
          if (sev === "mild" || sev === "moderate" || sev === "severe") return sev;
          return null;
        })(),
        confidence_score: clamp(asNonNegativeNumber(row.confidence_score, 0), 0, 100),
      } as ClinicalEventExtraction;
    })
    .filter((value): value is ClinicalEventExtraction => Boolean(value))
    .map((event) => {
      const grounded = applyVeterinaryEvidencePriority({
        event,
        hints: evidenceHints,
      });
      const guarded = applyConstitutionalGuardrails(grounded);
      guarded.reviewReasons.forEach((reason) => constitutionalReviewReasons.add(reason));
      return guarded.event;
    });

  return {
    is_clinical_content:
      json.is_clinical_content === true && !(evidenceHints.humanHealthcareNoise && !evidenceHints.preferStudyReport),
    confidence_overall: clamp(asNonNegativeNumber(json.confidence_overall, 0), 0, 100),
    detected_events: detectedEvents,
    narrative_summary: asString(json.narrative_summary),
    requires_human_review: json.requires_human_review === true || constitutionalReviewReasons.size > 0,
    reason_if_review_needed: asString(json.reason_if_review_needed) || [...constitutionalReviewReasons][0] || null,
  };
}

// ─── Heuristic fallbacks ────────────────────────────────────────────────────

export function heuristicClinicalExtraction(extractedText: string, emailDate: string): ClinicalExtractionOutput {
  const normalized = normalizeForHash(extractedText);
  const keywordRegex =
    /\b(veterinari|vet|receta|prescrip|dosis|vacuna|turno|diagn[oó]stic|laboratorio|ecograf|radiograf|electrocard|tratamiento)\b/i;
  const isClinical = keywordRegex.test(normalized);
  if (!isClinical) {
    return {
      is_clinical_content: false,
      confidence_overall: 15,
      detected_events: [],
      narrative_summary: "",
      requires_human_review: false,
      reason_if_review_needed: null,
    };
  }

  const inferredType: EventType = normalized.includes("vacuna")
    ? "vaccination_record"
    : normalized.includes("dosis") || normalized.includes("tratamiento") || normalized.includes("prescrip")
      ? "prescription_record"
      : /\b(laboratorio|hemograma|bioquim|radiograf|ecograf|electrocard|resultado|koh|citolog|microscop)\b/i.test(normalized)
        ? "study_report"
      : /\b(turno|consulta|recordatorio|confirmaci[oó]n|cancelaci[oó]n|reprogramaci[oó]n)\b/i.test(normalized)
        ? ((): EventType => {
            const status = inferAppointmentStatusFromText(normalized);
            if (status === "cancelled") return "appointment_cancellation";
            if (status === "reminder") return "appointment_reminder";
            return "appointment_confirmation";
          })()
        : "clinical_report";

  return {
    is_clinical_content: true,
    confidence_overall: 62,
    detected_events: [
      {
        event_type: inferredType,
        event_date: toIsoDateOnly(new Date(emailDate)),
        date_confidence: 60,
        description_summary: extractedText.slice(0, 220) || "Documento clínico detectado por reglas",
        diagnosis: null,
        medications: [],
        lab_results: [],
        imaging_type: null,
        study_subtype: inferredType === "study_report" ? inferStudySubtypeFromSignals({
          descriptionSummary: extractedText,
          diagnosis: null,
          imagingType: null,
          labResults: [],
        }) : null,
        appointment_time: isAppointmentEventType(inferredType) ? extractAppointmentTimeFromText(extractedText) : null,
        appointment_specialty: isAppointmentEventType(inferredType) ? extractAppointmentSpecialtyFromText(extractedText) : null,
        professional_name: isAppointmentEventType(inferredType) ? extractProfessionalNameFromText(extractedText) : null,
        clinic_name: isAppointmentEventType(inferredType) ? extractClinicNameFromText(extractedText) : null,
        appointment_status: isAppointmentEventType(inferredType) ? inferAppointmentStatusFromText(extractedText) : null,
        severity: null,
        confidence_score: 62,
      },
    ],
    narrative_summary:
      "Se detectó contenido clínico en el correo. Requiere validación manual para confirmar los datos.",
    requires_human_review: true,
    reason_if_review_needed: "heuristic_fallback",
  };
}

export function heuristicClinicalClassification(input: ClinicalClassificationInput): ClinicalClassificationOutput {
  const normalized = normalizeForHash(
    [input.subject || "", input.fromEmail || "", input.bodyText || ""].filter(Boolean).join("\n")
  );
  const keywordRegex =
    /\b(veterinari|vet|receta|prescrip|dosis|vacuna|turno|diagn[oó]stic|laboratorio|ecograf|radiograf|electrocard|tratamiento|medicaci[oó]n)\b/i;
  const hasClinicalAttachment = attachmentNamesContainClinicalSignal(input.attachmentMetadata || []);
  const hasNoise = hasStrongNonClinicalSignal(normalized);
  const hasHumanHealthcareNoise = hasStrongHumanHealthcareSignal(normalized);
  const hasVetEvidence = hasStrongVeterinaryEvidence(input);
  const isClinical =
    (keywordRegex.test(normalized) || hasClinicalAttachment || hasVetEvidence) &&
    !(!hasClinicalAttachment && (hasNoise || hasHumanHealthcareNoise) && !hasVetEvidence);
  return {
    is_clinical: isClinical,
    confidence: isClinical ? 65 : 20,
  };
}

// ─── AI classification ──────────────────────────────────────────────────────

export async function classifyClinicalContentWithAi(
  input: ClinicalClassificationInput,
  sessionId?: string,
  userId?: string,
): Promise<ClinicalClassificationOutput> {
  const bodyText = asString(input.bodyText);
  const subject = asString(input.subject).slice(0, 500);
  const fromEmail = asString(input.fromEmail).slice(0, 320);
  const hasClinicalAttachment = attachmentNamesContainClinicalSignal(input.attachmentMetadata || []);
  const hasHumanHealthcareNoise = hasStrongHumanHealthcareSignal(`${subject}\n${fromEmail}\n${bodyText}`);
  const hasVetEvidence = hasStrongVeterinaryEvidence(input);
  const subjectLooksClinical =
    /\b(receta|prescrip|vacuna|diagn[oó]stic|laboratorio|ecograf|radiograf|electrocard|tratamiento|medicaci[oó]n|resultado|resultados)\b/i
      .test(subject);
  const senderLooksClinical = isTrustedClinicalSender(fromEmail) || isVetDomain(fromEmail);
  const hasBody = bodyText.trim().length > 0;

  if (!hasBody && !subject && !hasClinicalAttachment) {
    return { is_clinical: false, confidence: 0 };
  }
  if (hasHumanHealthcareNoise && !hasVetEvidence && !hasClinicalAttachment) {
    return { is_clinical: false, confidence: 12 };
  }

  if (hasClinicalAttachment) {
    return {
      is_clinical: true,
      confidence: senderLooksClinical ? 92 : 82,
    };
  }
  if (subjectLooksClinical) {
    return {
      is_clinical: true,
      confidence: senderLooksClinical ? 78 : 72,
    };
  }

  const hasGemini = Boolean(asString(process.env.GEMINI_API_KEY));
  if (!hasGemini) return heuristicClinicalClassification(input);

  const attachmentNames = (input.attachmentMetadata || []).map((row) => row.filename).join(" | ").slice(0, 1800);
  const prompt = [
    "Role: You are a strict high-precision classifier for veterinary clinical emails for Pessy.app.",
    "Mission: classify whether the email contains actionable veterinary clinical information.",
    "Return ONLY JSON, no markdown.",
    "Schema:",
    "{\"is_clinical\": boolean, \"confidence\": number, \"reason\": string}",
    "Rules:",
    "1) Set is_clinical=true ONLY if there is explicit veterinary medical evidence.",
    "2) Ignore non-clinical emails: promotions, pet food marketing, newsletters, ecommerce, banking, invoices/receipts without clinical findings.",
    "2b) Ignore human-healthcare, obra social or NGO medical emails unless there is explicit evidence of veterinaria or mascota.",
    "3) Process as clinical when there is at least one of:",
    "- veterinary report / lab result / imaging finding",
    "- prescription with dose and frequency",
    "- vaccination record with date/lot/product/next due",
    "- clinical visit/control with medical context",
    "3b) If an attachment/report indicates imaging or lab evidence, that outweighs generic logistics in the body.",
    "4) If uncertain, set is_clinical=false and confidence <= 40.",
    "5) If sender looks trusted but there is no clinical evidence, keep is_clinical=false.",
    "Known trusted sender hints (if present): Veterinaria Panda, EcoForm, Instituto de Gastroenterologia Veterinaria (IGV).",
    "",
    "Sender:",
    fromEmail || "(unknown)",
    "",
    "Subject:",
    subject || "(empty)",
    "",
    "Attachment names:",
    attachmentNames || "(none)",
    "",
    "Body text:",
    bodyText.slice(0, 20_000),
  ].join("\n");

  const payload = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.1,
      topK: 1,
      topP: 1,
      responseMimeType: "application/json",
      maxOutputTokens: 250,
    },
  };

  try {
    const started = Date.now();
    const response = await callGemini(payload, CLASSIFICATION_AI_TIMEOUT_MS, { userId });
    const rawText = extractGeminiText(response);
    const parsed = tryParseJson(rawText);
    const json = asRecord(parsed);
    if (sessionId) {
      await recordSessionStageMetric({
        sessionId,
        stageKey: "classification",
        durationMs: Date.now() - started,
        aiCalls: 1,
        aiInputChars: prompt.length,
        aiOutputChars: rawText.length,
      });
    }
    return {
      is_clinical: json.is_clinical === true,
      confidence: clamp(asNonNegativeNumber(json.confidence, 0), 0, 100),
    };
  } catch (error) {
    console.warn("[gmail-ingestion] AI classification fallback:", error);
    const result = heuristicClinicalClassification(input);
    return { ...result, classificationMethod: "heuristic" as const };
  }
}

// ─── AI extraction ──────────────────────────────────────────────────────────

export async function extractClinicalEventsWithAi(args: {
  extractedText: string;
  emailDate: string;
  sourceSubject: string;
  sourceSender: string;
  petContext: Record<string, unknown>;
  attachmentMetadata: AttachmentMetadata[];
  sessionId?: string;
  userId?: string;
}): Promise<ClinicalExtractionOutput> {
  if (!asString(args.extractedText)) {
    return {
      is_clinical_content: false,
      confidence_overall: 0,
      detected_events: [],
      narrative_summary: "",
      requires_human_review: true,
      reason_if_review_needed: "empty_extracted_text",
    };
  }

  const hasGemini = Boolean(asString(process.env.GEMINI_API_KEY));
  if (!hasGemini) {
    return heuristicClinicalExtraction(`${args.sourceSubject}\n${args.extractedText}`, args.emailDate);
  }

  try {
    const context = await resolveClinicalKnowledgeContext({
      query: args.extractedText.slice(0, 6000),
      maxSections: 7,
    });
    const chunks = splitTextForAi(args.extractedText, MAX_AI_DOCUMENT_TEXT_CHARS, 4);
    const chunkOutputs: ClinicalExtractionOutput[] = [];

    for (const chunk of chunks) {
      const prompt = buildClinicalPrompt({
        extractedText: chunk,
        emailDate: args.emailDate,
        sourceSubject: args.sourceSubject,
        sourceSender: args.sourceSender,
        petContext: args.petContext,
        attachmentMetadata: args.attachmentMetadata,
        knowledgeContext: context.contextText,
      });
      const payload = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.1,
          topK: 1,
          topP: 1,
          responseMimeType: "application/json",
          maxOutputTokens: 2000,
        },
      };
      const started = Date.now();
      let aiCallsUsed = 1;
      let response = await callGemini(payload, CLINICAL_AI_TIMEOUT_MS, { userId: args.userId });
      let rawText = extractGeminiText(response);
      let parsed = tryParseJson(rawText);

      // Retry once when the model returns malformed JSON.
      if (!parsed) {
        aiCallsUsed += 1;
        response = await callGemini(payload, CLINICAL_AI_TIMEOUT_MS, { userId: args.userId });
        rawText = extractGeminiText(response);
        parsed = tryParseJson(rawText);
      }

      if (args.sessionId) {
        await recordSessionStageMetric({
          sessionId: args.sessionId,
          stageKey: "extraction",
          durationMs: Date.now() - started,
          aiCalls: aiCallsUsed,
          aiInputChars: prompt.length,
          aiOutputChars: rawText.length,
        });
      }
      if (parsed) {
        chunkOutputs.push(
          toClinicalOutput(parsed, {
            extractedText: chunk,
            sourceSubject: args.sourceSubject,
            sourceSender: args.sourceSender,
            attachmentMetadata: args.attachmentMetadata,
          })
        );
      } else {
        chunkOutputs.push(heuristicClinicalExtraction(chunk, args.emailDate));
      }
    }

    if (chunkOutputs.length === 0) {
      return heuristicClinicalExtraction(args.extractedText, args.emailDate);
    }

    const mergedEvents = chunkOutputs.flatMap((row) => row.detected_events).slice(0, 40);
    const confidenceOverall = Math.round(
      chunkOutputs.reduce((sum, row) => sum + row.confidence_overall, 0) / chunkOutputs.length
    );
    const isClinical = chunkOutputs.some((row) => row.is_clinical_content);
    const requiresHumanReview = chunkOutputs.some((row) => row.requires_human_review) || mergedEvents.length === 0;
    const narrativeSummary = chunkOutputs
      .map((row) => row.narrative_summary)
      .filter((row) => row.trim().length > 0)
      .slice(0, 2)
      .join(" ");
    const reason = chunkOutputs.find((row) => row.reason_if_review_needed)?.reason_if_review_needed || null;

    if (mergedEvents.length === 0 && isClinical) {
      return {
        is_clinical_content: true,
        confidence_overall: confidenceOverall,
        detected_events: [],
        narrative_summary: narrativeSummary,
        requires_human_review: true,
        reason_if_review_needed: reason || "empty_events_from_ai",
      };
    }

    return {
      is_clinical_content: isClinical,
      confidence_overall: confidenceOverall,
      detected_events: mergedEvents,
      narrative_summary: narrativeSummary,
      requires_human_review: requiresHumanReview,
      reason_if_review_needed: reason,
    };
  } catch (error) {
    console.warn("[gmail-ingestion] AI extraction fallback:", error);
    const result = heuristicClinicalExtraction(args.extractedText, args.emailDate);
    return { ...result, extractionMethod: "heuristic" };
  }
}
