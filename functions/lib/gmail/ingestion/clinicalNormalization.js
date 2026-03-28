"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LEGACY_SALVAGE_STUDY_REGEX = exports.LEGACY_OPERATIONAL_NOISE_REGEX = exports.LEGACY_DELETE_DOMAIN_HINTS = exports.LEGACY_GENERIC_TITLES = exports.MEDICATION_NAME_BLOCKLIST = exports.STRUCTURED_DIAGNOSIS_HINT_REGEX = void 0;
exports.isAppointmentEventType = isAppointmentEventType;
exports.isPrescriptionEventType = isPrescriptionEventType;
exports.isVaccinationEventType = isVaccinationEventType;
exports.isStudyEventType = isStudyEventType;
exports.inferAppointmentStatusFromText = inferAppointmentStatusFromText;
exports.normalizeAppointmentStatusValue = normalizeAppointmentStatusValue;
exports.sanitizeAppointmentTime = sanitizeAppointmentTime;
exports.extractAppointmentTimeFromText = extractAppointmentTimeFromText;
exports.sanitizeExtractedEntity = sanitizeExtractedEntity;
exports.extractProfessionalNameFromText = extractProfessionalNameFromText;
exports.extractClinicNameFromText = extractClinicNameFromText;
exports.hasClinicSignalInText = hasClinicSignalInText;
exports.extractAppointmentSpecialtyFromText = extractAppointmentSpecialtyFromText;
exports.hasMedicationOrTreatmentSignal = hasMedicationOrTreatmentSignal;
exports.deriveAppointmentLabel = deriveAppointmentLabel;
exports.inferImagingTypeFromSignals = inferImagingTypeFromSignals;
exports.inferStudySubtypeFromSignals = inferStudySubtypeFromSignals;
exports.inferImagingDocumentType = inferImagingDocumentType;
exports.normalizeExtractedEventType = normalizeExtractedEventType;
exports.buildCanonicalEventTitle = buildCanonicalEventTitle;
exports.confidenceBucketToScore = confidenceBucketToScore;
exports.toMedicalEventDocumentType = toMedicalEventDocumentType;
exports.toStoredClinicalMedications = toStoredClinicalMedications;
exports.toStoredClinicalLabResults = toStoredClinicalLabResults;
exports.inferStoredEventTypeFromRecord = inferStoredEventTypeFromRecord;
exports.reconstructStoredEventForTaxonomy = reconstructStoredEventForTaxonomy;
exports.extractOperationalAppointmentCandidate = extractOperationalAppointmentCandidate;
exports.shouldReplaceLegacyStoredTitle = shouldReplaceLegacyStoredTitle;
exports.shouldPreserveExistingObservations = shouldPreserveExistingObservations;
exports.medicationNameHasExplicitDrugSignal = medicationNameHasExplicitDrugSignal;
exports.isMedicationMeasurementFalsePositive = isMedicationMeasurementFalsePositive;
exports.medicationHasDoseAndFrequency = medicationHasDoseAndFrequency;
exports.looksHistoricalOnlyTreatmentEvent = looksHistoricalOnlyTreatmentEvent;
exports.hasUnstructuredClinicalFinding = hasUnstructuredClinicalFinding;
exports.hasIncompleteAppointmentMetadata = hasIncompleteAppointmentMetadata;
exports.hasIncompletePrescriptionMetadata = hasIncompletePrescriptionMetadata;
exports.hasUndifferentiatedStudySubtype = hasUndifferentiatedStudySubtype;
exports.applyConstitutionalGuardrails = applyConstitutionalGuardrails;
exports.isLegacyMailsyncEvent = isLegacyMailsyncEvent;
exports.selectLegacySender = selectLegacySender;
exports.hasLegacyMedicationPayload = hasLegacyMedicationPayload;
exports.classifyLegacyMailsyncEvent = classifyLegacyMailsyncEvent;
const utils_1 = require("./utils");
const petMatching_1 = require("./petMatching");
// ─── Constants ──────────────────────────────────────────────────────────────
const MEDICATION_UNIT_ONLY_REGEX = /^(?:\d+(?:[.,]\d+)?\s*)?(?:ml|mm|cm|kg|g|mg|mcg|ug|%|cc|x|comp(?:rimidos?)?)$/i;
const MEDICATION_DOSING_HINT_REGEX = /\b(cada|hora|horas|hs|comprim|capsul|tableta|pastilla|jarabe|gotas|inyec|ampolla|sobres?)\b/i;
const HISTORICAL_ONLY_SIGNAL_REGEX = /\b(desde\s+\d{4}|historic[oa]|revacun|calendario\s+de\s+vacun|esquema\s+de\s+vacun|vigencia|desde\s+hace|informaci[oó]n\s+general|referencia\s+hist[oó]rica)\b/i;
exports.STRUCTURED_DIAGNOSIS_HINT_REGEX = /\b(cardiomegalia|cardiomiopat|dcm|hepatomegalia|esplenitis|esplenomegalia|fractura|luxaci[oó]n|insuficien|neoplas|masa|dermatitis|otitis|gastritis|nefritis|dilataci[oó]n)\b/i;
const ANATOMICAL_MEASUREMENT_HINT_REGEX = /\b(prostata|prost[aá]tica|vol(?:umen)?|diametr|medida|eje|vejiga|renal|ri[nñ]on|ri[nñ]ones|hep[aá]tic|h[ií]gado|espl[eé]nic|bazo|coraz[oó]n|tor[aá]x|abdomen|pelvis|femoral|aur[ií]cula|ventr[ií]cul)\b/i;
exports.MEDICATION_NAME_BLOCKLIST = new Set([
    "ml",
    "mm",
    "cm",
    "kg",
    "g",
    "mg",
    "mcg",
    "ug",
    "cc",
    "vol",
    "volumen",
    "diametro",
    "diam",
    "eje",
    "medida",
    "medidas",
    "prostata",
    "prostatica",
    "vejiga",
    "renal",
    "rinon",
    "rinones",
    "hepatico",
    "higado",
    "esplenico",
    "bazo",
    "corazon",
    "torax",
    "abdomen",
    "pelvis",
    "izquierdo",
    "derecho",
    "hallazgo",
    "normal",
    "alterado",
    "cada",
    "frecuencia",
    "dosis",
]);
// ─── Event type predicates ──────────────────────────────────────────────────
function isAppointmentEventType(eventType) {
    return (eventType === "appointment_confirmation" ||
        eventType === "appointment_reminder" ||
        eventType === "appointment_cancellation");
}
function isPrescriptionEventType(eventType) {
    return eventType === "prescription_record";
}
function isVaccinationEventType(eventType) {
    return eventType === "vaccination_record";
}
function isStudyEventType(eventType) {
    return eventType === "study_report";
}
// ─── Appointment status ─────────────────────────────────────────────────────
function inferAppointmentStatusFromText(text) {
    const normalized = (0, utils_1.normalizeClinicalToken)(text);
    if (!normalized)
        return null;
    if (/\b(cancelad|reprogramad|suspendid)\b/.test(normalized))
        return "cancelled";
    if (/\b(recordatorio|recorda|recuerda)\b/.test(normalized))
        return "reminder";
    if (/\b(confirmad|confirmacion)\b/.test(normalized))
        return "confirmed";
    if (/\b(turno|consulta|control)\b/.test(normalized))
        return "scheduled";
    return null;
}
function normalizeAppointmentStatusValue(value, fallbackText = "") {
    const normalized = (0, utils_1.normalizeClinicalToken)((0, utils_1.asString)(value));
    if (normalized === "confirmed" || normalized === "confirmado")
        return "confirmed";
    if (normalized === "reminder" || normalized === "recordatorio")
        return "reminder";
    if (normalized === "cancelled" || normalized === "canceled" || normalized === "cancelado" || normalized === "reprogramado") {
        return "cancelled";
    }
    if (normalized === "scheduled" || normalized === "programado" || normalized === "agendado")
        return "scheduled";
    return inferAppointmentStatusFromText(fallbackText);
}
// ─── Time extraction ────────────────────────────────────────────────────────
function sanitizeAppointmentTime(value) {
    const raw = (0, utils_1.asString)(value);
    if (!raw)
        return null;
    const match = raw.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
    if (!match)
        return null;
    return `${match[1].padStart(2, "0")}:${match[2]}`;
}
function extractAppointmentTimeFromText(text) {
    return sanitizeAppointmentTime(text);
}
// ─── Entity extraction ──────────────────────────────────────────────────────
function sanitizeExtractedEntity(value) {
    const raw = (0, utils_1.asString)(value);
    if (!raw)
        return null;
    const trimmed = raw
        .replace(/\s+(?:en|a\s+las|con|para)\b.*$/i, "")
        .replace(/\s+(?:programad[oa]|confirmad[oa]|agendad[oa]|recordad[oa]|cancelad[oa])\b.*$/i, "")
        .replace(/^[\s:·,-]+|[\s:·,-]+$/g, "")
        .trim();
    return trimmed || null;
}
function extractProfessionalNameFromText(text) {
    const match = text.match(/(?:dr\.?|dra\.?|doctor|doctora)\s+([A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚÑ' -]+(?:\s+[A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚÑ' -]+){0,3})/i);
    return sanitizeExtractedEntity((0, utils_1.asString)(match === null || match === void 0 ? void 0 : match[1]) || null);
}
function extractClinicNameFromText(text, sourceSender = "") {
    const centerMatch = text.match(/centro\/profesional:\s*([^.,]+(?:\s*·\s*[^.,]+)?)/i);
    if (centerMatch === null || centerMatch === void 0 ? void 0 : centerMatch[1]) {
        const parts = centerMatch[1]
            .split("·")
            .map((part) => sanitizeExtractedEntity((0, utils_1.asString)(part)))
            .filter(Boolean);
        if (parts.length > 1)
            return parts[1];
        if (parts.length === 1)
            return parts[0];
    }
    const clinicMatch = text.match(/\b(?:clinica|clínica|centro|hospital|sucursal)\s+([A-ZÁÉÍÓÚÑ][^.,]+?)(?=\s+a\s+las|\s+con\b|\s+para\b|\.|,|$)/i);
    if (clinicMatch === null || clinicMatch === void 0 ? void 0 : clinicMatch[1])
        return sanitizeExtractedEntity((0, utils_1.asString)(clinicMatch[1]) || null);
    const senderDomain = (0, petMatching_1.extractSenderDomain)(sourceSender);
    if (senderDomain === null || senderDomain === void 0 ? void 0 : senderDomain.includes("panda"))
        return "PANDA CLINICA VETERINARIA";
    return null;
}
function hasClinicSignalInText(text, sourceSender = "") {
    const haystack = (0, utils_1.normalizeClinicalToken)([text, sourceSender].filter(Boolean).join(" "));
    return /\b(clinica|clinica veterinaria|centro|hospital|sucursal|panda|veterinaria|pet shop)\b/.test(haystack);
}
function extractAppointmentSpecialtyFromText(text) {
    const match = text.match(/\b(?:consulta|control|turno)\s+([a-záéíóúñ]+(?:\s+[a-záéíóúñ]+){0,3})(?=\s+(?:programad[oa]|confirmad[oa]|agendad[oa]|recordad[oa]|cancelad[oa]|con|en|a\s+las|para)\b|[.,]|$)/i);
    return sanitizeExtractedEntity((0, utils_1.asString)(match === null || match === void 0 ? void 0 : match[1]) || null);
}
// ─── Signal detection ───────────────────────────────────────────────────────
function hasMedicationOrTreatmentSignal(text) {
    const haystack = (0, utils_1.normalizeClinicalToken)(text);
    if (!haystack)
        return false;
    return /\b(receta|prescrip|tratamiento|medicaci[oó]n|dosis|cada\s+\d+\s*(?:h|hs|hora|horas)|comprimid|capsul|tableta|jarabe|gotas|pimobendan|ursomax|ursomas|furosemida|omeprazol|predni|amoxic|metronidazol|gabapentin|carprofeno|dieta\s+[a-záéíóúñ]+)\b/i.test(haystack);
}
function deriveAppointmentLabel(event) {
    const specialty = sanitizeExtractedEntity(event.appointment_specialty || null);
    if (specialty)
        return specialty;
    const description = (0, utils_1.cleanSentence)(event.description_summary || "");
    const patterns = [
        /\bconsulta\s+([a-záéíóúñ]+(?:\s+[a-záéíóúñ]+){0,3})/i,
        /\bturno\s+([a-záéíóúñ]+(?:\s+[a-záéíóúñ]+){0,3})/i,
        /\bcontrol\s+([a-záéíóúñ]+(?:\s+[a-záéíóúñ]+){0,3})/i,
    ];
    for (const pattern of patterns) {
        const match = description.match(pattern);
        if (match === null || match === void 0 ? void 0 : match[1])
            return sanitizeExtractedEntity(match[1]);
    }
    const diagnosis = sanitizeExtractedEntity(event.diagnosis || null);
    if (diagnosis && diagnosis.length <= 80)
        return diagnosis;
    return null;
}
function inferImagingTypeFromSignals(text) {
    const haystack = (0, utils_1.normalizeClinicalToken)(text);
    if (!haystack)
        return null;
    if (/\b(ecocard[a-z]*|eco cardio|ecocardi[a-z]*|doppler|mitral|ventricul[a-z]*)\b/.test(haystack))
        return "ecocardiograma";
    if (/\b(ecg|electrocard[a-z]*|ritmo sinusal|qrs|pr)\b/.test(haystack))
        return "electrocardiograma";
    if (/\b(eco|ecograf[a-z]*|ultrason[a-z]*|ultrasound|sonogra[a-z]*)\b/.test(haystack))
        return "ecografía";
    if (/\b(rx|radiograf[a-z]*|radiolog[a-z]*|placa[s]?|proyeccion[a-z]*|ll|vd|dv|torax dv|torax ld|d v|l l)\b/.test(haystack)) {
        return "radiografía";
    }
    return null;
}
function inferStudySubtypeFromSignals(args) {
    const raw = (0, utils_1.asString)(args.rawStudySubtype).toLowerCase();
    const haystack = (0, utils_1.normalizeClinicalToken)([
        (0, utils_1.asString)(args.imagingType),
        args.descriptionSummary,
        args.diagnosis,
        ...args.labResults.flatMap((row) => [row.test_name, row.result, row.reference_range || ""]),
    ]
        .filter(Boolean)
        .join(" "));
    const hasImagingSignal = /\b(rx|radiograf[a-z]*|radiolog[a-z]*|ecograf[a-z]*|ultrason[a-z]*|ultrasound|eco|ecocard[a-z]*|ecg|electrocard[a-z]*|imagen(?:es)?|placa[s]?|proyeccion[a-z]*)\b/.test(haystack);
    const hasLabSignal = /\b(laboratorio|hemograma|bioquim|analisis|an[aá]lisis|glucosa|creatinina|urea|alt|ast)\b/.test(haystack);
    if (hasImagingSignal) {
        return "imaging";
    }
    if (hasLabSignal) {
        return "lab";
    }
    if (raw === "imaging" || raw === "lab")
        return raw;
    if (args.labResults.length > 0)
        return "lab";
    return null;
}
// ─── Document type inference ────────────────────────────────────────────────
function inferImagingDocumentType(event) {
    const haystack = (0, utils_1.normalizeClinicalToken)([event.imaging_type, event.description_summary, event.diagnosis].filter(Boolean).join(" "));
    if (/\b(ecocard[a-z]*|eco cardi|doppler)\b/.test(haystack))
        return "echocardiogram";
    if (/\b(ecg|electrocard[a-z]*)\b/.test(haystack))
        return "electrocardiogram";
    if (/\b(rx|radiograf[a-z]*|radiolog[a-z]*|placa[s]?|ecograf[a-z]*|ultrason[a-z]*|ultrasound|proyeccion[a-z]*)\b/.test(haystack)) {
        return "xray";
    }
    return "lab_test";
}
function normalizeExtractedEventType(rawType, row) {
    const normalized = (0, utils_1.normalizeClinicalToken)(rawType);
    const hintText = (0, utils_1.normalizeClinicalToken)([
        (0, utils_1.asString)(row.description_summary),
        (0, utils_1.asString)(row.diagnosis),
        (0, utils_1.asString)(row.appointment_status),
        (0, utils_1.asString)(row.study_subtype),
        (0, utils_1.asString)(row.imaging_type),
    ].join(" "));
    if (normalized === "appointment_confirmation" ||
        normalized === "appointment_reminder" ||
        normalized === "appointment_cancellation" ||
        normalized === "clinical_report" ||
        normalized === "study_report" ||
        normalized === "prescription_record" ||
        normalized === "vaccination_record") {
        return normalized;
    }
    if (normalized === "visit") {
        const status = inferAppointmentStatusFromText(hintText);
        if (status === "cancelled")
            return "appointment_cancellation";
        if (status === "reminder")
            return "appointment_reminder";
        return "appointment_confirmation";
    }
    if (normalized === "treatment")
        return "prescription_record";
    if (normalized === "vaccination")
        return "vaccination_record";
    if (normalized === "diagnostic" || normalized === "imaging")
        return "study_report";
    if (normalized === "episode")
        return "clinical_report";
    return null;
}
// ─── Canonical title ────────────────────────────────────────────────────────
function buildCanonicalEventTitle(event) {
    var _a;
    if (event.event_type === "appointment_confirmation") {
        const label = deriveAppointmentLabel(event);
        return label ? `Turno · ${label}` : "Turno confirmado";
    }
    if (event.event_type === "appointment_reminder") {
        const label = deriveAppointmentLabel(event);
        return label ? `Recordatorio · ${label}` : "Recordatorio de turno";
    }
    if (event.event_type === "appointment_cancellation") {
        const label = deriveAppointmentLabel(event);
        return label ? `Cancelación · ${label}` : "Turno cancelado";
    }
    if (event.event_type === "vaccination_record")
        return "Registro de vacunación";
    if (event.event_type === "prescription_record") {
        const firstMedication = (0, utils_1.asString)((_a = event.medications[0]) === null || _a === void 0 ? void 0 : _a.name);
        return firstMedication ? `Receta médica · ${firstMedication}` : "Receta médica";
    }
    if (event.event_type === "study_report") {
        if (event.study_subtype === "imaging") {
            if (event.imaging_type && /ecocard|doppler/i.test(event.imaging_type))
                return "Ecocardiograma";
            if (event.imaging_type && /electrocard|ecg/i.test(event.imaging_type))
                return "Electrocardiograma";
            if (event.imaging_type && /radiograf|rx|placa/i.test(event.imaging_type))
                return "Radiografía";
            if (event.diagnosis)
                return (0, utils_1.cleanSentence)(event.diagnosis).slice(0, 120) || "Informe por imágenes";
            return "Informe por imágenes";
        }
        return "Resultado de laboratorio";
    }
    if (event.event_type === "clinical_report" && event.diagnosis)
        return event.diagnosis.slice(0, 120);
    return "Informe clínico";
}
// ─── Confidence ─────────────────────────────────────────────────────────────
function confidenceBucketToScore(value, fallback = 70) {
    if (typeof value === "number" && Number.isFinite(value)) {
        return (0, utils_1.clamp)(Math.round(value), 0, 100);
    }
    const normalized = (0, utils_1.normalizeClinicalToken)((0, utils_1.asString)(value));
    if (normalized === "high")
        return 90;
    if (normalized === "medium")
        return 75;
    if (normalized === "low")
        return 55;
    if (normalized === "not detected" || normalized === "not_detected")
        return 0;
    return (0, utils_1.clamp)(fallback, 0, 100);
}
// ─── Domain document type mapping ───────────────────────────────────────────
function toMedicalEventDocumentType(event) {
    if (isAppointmentEventType(event.event_type))
        return "appointment";
    if (isPrescriptionEventType(event.event_type))
        return "medication";
    if (isVaccinationEventType(event.event_type))
        return "vaccine";
    if (isStudyEventType(event.event_type)) {
        return event.study_subtype === "imaging" ? inferImagingDocumentType(event) : "lab_test";
    }
    if (event.event_type === "clinical_report")
        return "checkup";
    return "other";
}
// ─── Stored data converters ─────────────────────────────────────────────────
function toStoredClinicalMedications(value) {
    const rows = Array.isArray(value) ? value : [];
    return rows
        .map((row) => {
        const data = (0, utils_1.asRecord)(row);
        const name = (0, utils_1.asString)(data.name);
        if (!name)
            return null;
        return {
            name,
            dose: (0, utils_1.asString)(data.dosage) || (0, utils_1.asString)(data.dose) || null,
            frequency: (0, utils_1.asString)(data.frequency) || null,
            duration_days: null,
            is_active: true,
        };
    })
        .filter((row) => Boolean(row));
}
function toStoredClinicalLabResults(value) {
    const rows = Array.isArray(value) ? value : [];
    return rows
        .map((row) => {
        const data = (0, utils_1.asRecord)(row);
        const testName = (0, utils_1.asString)(data.name);
        const result = (0, utils_1.asString)(data.value);
        if (!testName || !result)
            return null;
        return {
            test_name: testName,
            result,
            unit: (0, utils_1.asString)(data.unit) || null,
            reference_range: (0, utils_1.asString)(data.referenceRange) || null,
        };
    })
        .filter((row) => Boolean(row));
}
// ─── Stored event reconstruction (for taxonomy backfill) ────────────────────
function inferStoredEventTypeFromRecord(args) {
    const normalizedExistingType = normalizeExtractedEventType((0, utils_1.asString)(args.extractedData.taxonomyEventType), args.extractedData);
    if (normalizedExistingType)
        return normalizedExistingType;
    const documentType = (0, utils_1.asString)(args.extractedData.documentType);
    const normalizedSourceText = (0, utils_1.normalizeClinicalToken)(args.sourceText);
    const appointmentStructured = Boolean((0, utils_1.asString)(args.extractedData.appointmentTime)) ||
        Boolean((0, utils_1.asString)(args.extractedData.provider)) ||
        Boolean((0, utils_1.asString)(args.extractedData.clinic)) ||
        (Array.isArray(args.extractedData.detectedAppointments) ? args.extractedData.detectedAppointments.length : 0) > 0;
    const studySignal = /\b(laboratorio|hemograma|bioquim|radiograf|ecograf|electrocard|resultado|informe|microscop|koh|citolog|rx|placa)\b/.test(normalizedSourceText);
    const medicationSignal = args.medications.length > 0 || hasMedicationOrTreatmentSignal(args.sourceText);
    if (documentType === "appointment") {
        if (!appointmentStructured && studySignal)
            return "study_report";
        if (!appointmentStructured && medicationSignal)
            return "prescription_record";
        const status = normalizeAppointmentStatusValue(args.extractedData.appointmentStatus, args.sourceText);
        if (status === "cancelled")
            return "appointment_cancellation";
        if (status === "reminder")
            return "appointment_reminder";
        return "appointment_confirmation";
    }
    if (documentType === "medication" && args.medications.length > 0)
        return "prescription_record";
    if (documentType === "vaccine")
        return "vaccination_record";
    if (documentType === "lab_test" ||
        documentType === "xray" ||
        documentType === "echocardiogram" ||
        documentType === "electrocardiogram") {
        return "study_report";
    }
    if (documentType === "checkup")
        return "clinical_report";
    if (args.medications.length > 0)
        return "prescription_record";
    if (args.labResults.length > 0)
        return "study_report";
    const normalized = normalizedSourceText;
    if (!normalized)
        return null;
    if (/\b(vacuna|vacunacion|revacuna)\b/.test(normalized))
        return "vaccination_record";
    if (/\b(turno|consulta|recordatorio|confirmacion|confirmación|cancelacion|cancelación|reprogramaci)\b/.test(normalized)) {
        const status = inferAppointmentStatusFromText(normalized);
        if (status === "cancelled")
            return "appointment_cancellation";
        if (status === "reminder")
            return "appointment_reminder";
        return "appointment_confirmation";
    }
    if (/\b(laboratorio|hemograma|bioquim|radiograf|ecograf|ecocard|electrocard|resultado|informe)\b/.test(normalized)) {
        return "study_report";
    }
    return "clinical_report";
}
function reconstructStoredEventForTaxonomy(row) {
    const extractedData = (0, utils_1.asRecord)(row.extractedData);
    const sourceText = [
        (0, utils_1.asString)(extractedData.aiGeneratedSummary),
        (0, utils_1.asString)(extractedData.suggestedTitle),
        (0, utils_1.asString)(extractedData.diagnosis),
        (0, utils_1.asString)(extractedData.sourceSubject),
        (0, utils_1.asString)(extractedData.sourceSender),
        (0, utils_1.asString)(row.title),
    ]
        .filter(Boolean)
        .join(" · ");
    const medications = toStoredClinicalMedications(extractedData.medications);
    const labResults = toStoredClinicalLabResults(extractedData.measurements);
    const eventType = inferStoredEventTypeFromRecord({
        row,
        extractedData,
        sourceText,
        medications,
        labResults,
    });
    if (!eventType)
        return null;
    const detectedAppointment = (0, utils_1.asRecord)(Array.isArray(extractedData.detectedAppointments) ? extractedData.detectedAppointments[0] : null);
    const diagnosis = (0, utils_1.asString)(extractedData.diagnosis) || null;
    const imagingType = (0, utils_1.asString)(extractedData.imagingType) ||
        inferImagingTypeFromSignals(sourceText) ||
        ((0, utils_1.asString)(extractedData.documentType) === "xray"
            ? "radiografía"
            : (0, utils_1.asString)(extractedData.documentType) === "echocardiogram"
                ? "ecocardiograma"
                : (0, utils_1.asString)(extractedData.documentType) === "electrocardiogram"
                    ? "electrocardiograma"
                    : null);
    const appointmentTime = (0, utils_1.asString)(extractedData.appointmentTime) ||
        (0, utils_1.asString)(detectedAppointment.time) ||
        extractAppointmentTimeFromText(sourceText) ||
        null;
    const parsedAppointmentSpecialty = extractAppointmentSpecialtyFromText(sourceText);
    const parsedProfessionalName = extractProfessionalNameFromText(sourceText);
    const parsedClinicName = extractClinicNameFromText(sourceText, (0, utils_1.asString)(extractedData.sourceSender));
    const appointmentSpecialty = parsedAppointmentSpecialty ||
        (0, utils_1.asString)(detectedAppointment.specialty) ||
        null;
    const professionalName = parsedProfessionalName ||
        (0, utils_1.asString)(extractedData.provider) ||
        (0, utils_1.asString)(detectedAppointment.provider) ||
        null;
    const clinicName = parsedClinicName ||
        (hasClinicSignalInText(sourceText, (0, utils_1.asString)(extractedData.sourceSender))
            ? (0, utils_1.asString)(extractedData.clinic) || (0, utils_1.asString)(detectedAppointment.clinic) || null
            : null);
    let appointmentStatus = null;
    if (isAppointmentEventType(eventType)) {
        appointmentStatus = normalizeAppointmentStatusValue((0, utils_1.asString)(extractedData.appointmentStatus) || (0, utils_1.asString)(detectedAppointment.status), sourceText);
        if (!appointmentStatus) {
            if (eventType === "appointment_cancellation")
                appointmentStatus = "cancelled";
            if (eventType === "appointment_reminder")
                appointmentStatus = "reminder";
            if (eventType === "appointment_confirmation")
                appointmentStatus = "confirmed";
        }
    }
    const studySubtype = isStudyEventType(eventType)
        ? inferStudySubtypeFromSignals({
            rawStudySubtype: extractedData.studySubtype,
            imagingType,
            labResults,
            descriptionSummary: sourceText,
            diagnosis,
        })
        : null;
    const eventDate = (0, utils_1.asString)(extractedData.eventDate) ||
        (0, utils_1.asString)(row.eventDate) ||
        (0, utils_1.toIsoDateOnly)(new Date((0, utils_1.asString)(extractedData.sourceReceivedAt) || (0, utils_1.asString)(row.createdAt) || (0, utils_1.getNowIso)()));
    return {
        event_type: eventType,
        event_date: eventDate,
        date_confidence: confidenceBucketToScore(extractedData.eventDateConfidence, 70),
        description_summary: (0, utils_1.asString)(extractedData.aiGeneratedSummary) || (0, utils_1.asString)(row.title) || sourceText.slice(0, 240),
        diagnosis,
        medications,
        lab_results: labResults,
        imaging_type: imagingType,
        study_subtype: studySubtype,
        appointment_time: isAppointmentEventType(eventType) ? appointmentTime : null,
        appointment_specialty: isAppointmentEventType(eventType) ? appointmentSpecialty : null,
        professional_name: professionalName,
        clinic_name: clinicName,
        appointment_status: appointmentStatus,
        severity: null,
        confidence_score: (0, utils_1.clamp)((0, utils_1.asNonNegativeNumber)(row.overallConfidence, 72), 0, 100),
    };
}
// ─── Operational appointment candidate ──────────────────────────────────────
function extractOperationalAppointmentCandidate(args) {
    const eventDate = (0, utils_1.asString)(args.eventDate) || null;
    const parsedEventDate = (0, utils_1.parseDateOnly)(eventDate || "");
    if (!parsedEventDate)
        return null;
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    if (parsedEventDate.getTime() < startOfToday.getTime())
        return null;
    const sourceText = (0, utils_1.cleanSentence)(args.sourceText);
    const normalized = (0, utils_1.normalizeClinicalToken)(sourceText);
    if (!normalized)
        return null;
    const hasAppointmentLanguage = /\b(turno|consulta|control|recordatorio|confirmacion|confirmado|agendad|programad|reprogramad|cancelad|cita)\b/.test(normalized);
    if (!hasAppointmentLanguage)
        return null;
    const appointmentTime = sanitizeAppointmentTime(args.existingTime) || extractAppointmentTimeFromText(sourceText) || null;
    const appointmentSpecialty = sanitizeExtractedEntity((0, utils_1.asString)(args.existingSpecialty) || extractAppointmentSpecialtyFromText(sourceText)) || null;
    const professionalName = sanitizeExtractedEntity(args.professionalName || extractProfessionalNameFromText(sourceText)) || null;
    const clinicName = sanitizeExtractedEntity(args.clinicName || extractClinicNameFromText(sourceText, (0, utils_1.asString)(args.sourceSender))) || null;
    const appointmentStatus = normalizeAppointmentStatusValue(args.existingStatus, sourceText) || "scheduled";
    const strongStudySignal = /\b(radiograf|ecograf|electrocard|laboratorio|hemograma|microscop|koh|prueba|informe|resultado|prostata|torax|pelvis|proyeccion)\b/.test(normalized);
    const strongMedicationSignal = hasMedicationOrTreatmentSignal(sourceText);
    if (!appointmentTime && !appointmentSpecialty && !professionalName && !clinicName)
        return null;
    if (!appointmentTime && !professionalName && !clinicName && (strongStudySignal || strongMedicationSignal))
        return null;
    const eventType = appointmentStatus === "cancelled"
        ? "appointment_cancellation"
        : appointmentStatus === "reminder"
            ? "appointment_reminder"
            : "appointment_confirmation";
    return {
        event_type: eventType,
        event_date: eventDate,
        date_confidence: 85,
        description_summary: sourceText.slice(0, 240),
        diagnosis: sanitizeExtractedEntity(args.diagnosis || null),
        medications: [],
        lab_results: [],
        imaging_type: null,
        study_subtype: null,
        appointment_time: appointmentTime,
        appointment_specialty: appointmentSpecialty,
        professional_name: professionalName,
        clinic_name: clinicName,
        appointment_status: appointmentStatus,
        severity: null,
        confidence_score: (0, utils_1.clamp)((0, utils_1.asNonNegativeNumber)(args.confidenceScore, 82), 0, 100),
    };
}
// ─── Legacy title / observations checks ─────────────────────────────────────
function shouldReplaceLegacyStoredTitle(currentTitle) {
    const normalized = (0, utils_1.normalizeClinicalToken)(currentTitle);
    if (!normalized)
        return true;
    return [
        "diagnostico detectado por correo",
        "documento",
        "informe clinico",
        "turno programado",
        "resultado de laboratorio",
        "informe de estudio",
    ].includes(normalized);
}
function shouldPreserveExistingObservations(args) {
    const existingObservation = (0, utils_1.asString)(args.extractedData.observations);
    if (!existingObservation)
        return false;
    if ((0, utils_1.asString)(args.row.sourceTruthLevel) === "human_confirmed")
        return true;
    const narrative = (0, utils_1.asString)(args.extractedData.aiGeneratedSummary);
    return (0, utils_1.normalizeClinicalToken)(existingObservation) !== (0, utils_1.normalizeClinicalToken)(narrative);
}
// ─── Medication validation ──────────────────────────────────────────────────
function medicationNameHasExplicitDrugSignal(name) {
    const normalized = (0, utils_1.normalizeClinicalToken)(name);
    if (!normalized || MEDICATION_UNIT_ONLY_REGEX.test(normalized))
        return false;
    const tokens = normalized.split(/\s+/).filter(Boolean);
    const candidateTokens = tokens.filter((token) => {
        if (token.length < 3)
            return false;
        if (exports.MEDICATION_NAME_BLOCKLIST.has(token))
            return false;
        if (/^\d/.test(token))
            return false;
        if (MEDICATION_UNIT_ONLY_REGEX.test(token))
            return false;
        return /[a-z]/.test(token);
    });
    return candidateTokens.length > 0;
}
function isMedicationMeasurementFalsePositive(medication) {
    if (!medicationNameHasExplicitDrugSignal(medication.name))
        return true;
    const combined = (0, utils_1.normalizeClinicalToken)([medication.name, medication.dose, medication.frequency].filter(Boolean).join(" "));
    if (ANATOMICAL_MEASUREMENT_HINT_REGEX.test(combined) && !MEDICATION_DOSING_HINT_REGEX.test(combined)) {
        return true;
    }
    return false;
}
function medicationHasDoseAndFrequency(medication) {
    return Boolean((0, utils_1.asString)(medication.dose)) && Boolean((0, utils_1.asString)(medication.frequency));
}
function looksHistoricalOnlyTreatmentEvent(event) {
    if (!isPrescriptionEventType(event.event_type))
        return false;
    const normalized = (0, utils_1.normalizeClinicalToken)([
        event.description_summary,
        event.diagnosis,
        ...event.medications.map((medication) => medication.name),
    ]
        .filter(Boolean)
        .join(" "));
    if (!HISTORICAL_ONLY_SIGNAL_REGEX.test(normalized))
        return false;
    return !/\b(cada|administrar|dar|tomar|iniciar|continuar|indicado|receta|prescrip)\b/.test(normalized);
}
function hasUnstructuredClinicalFinding(event) {
    if (event.diagnosis)
        return false;
    if (!(event.event_type === "clinical_report" || isStudyEventType(event.event_type)))
        return false;
    return exports.STRUCTURED_DIAGNOSIS_HINT_REGEX.test((0, utils_1.normalizeClinicalToken)(event.description_summary));
}
function hasIncompleteAppointmentMetadata(event) {
    if (!isAppointmentEventType(event.event_type))
        return false;
    return !event.appointment_status || !event.appointment_time || !event.professional_name || !event.clinic_name;
}
function hasIncompletePrescriptionMetadata(event) {
    if (!isPrescriptionEventType(event.event_type))
        return false;
    if (event.medications.length === 0)
        return true;
    return event.medications.some((medication) => !medicationHasDoseAndFrequency(medication));
}
function hasUndifferentiatedStudySubtype(event) {
    return isStudyEventType(event.event_type) && !event.study_subtype;
}
// ─── Constitutional guardrails ──────────────────────────────────────────────
function applyConstitutionalGuardrails(event) {
    const reviewReasons = new Set();
    const medications = event.medications.filter((medication) => {
        const blocked = isMedicationMeasurementFalsePositive(medication);
        if (blocked)
            reviewReasons.add("medication_without_explicit_drug_name");
        return !blocked;
    });
    const sanitizedEvent = Object.assign(Object.assign({}, event), { medications });
    if (looksHistoricalOnlyTreatmentEvent(sanitizedEvent)) {
        reviewReasons.add("historical_info_only");
    }
    if (hasUnstructuredClinicalFinding(sanitizedEvent)) {
        reviewReasons.add("unstructured_clinical_finding");
    }
    if (hasIncompleteAppointmentMetadata(sanitizedEvent)) {
        reviewReasons.add("incomplete_appointment_details");
    }
    if (hasIncompletePrescriptionMetadata(sanitizedEvent)) {
        reviewReasons.add("missing_treatment_dose_or_frequency");
    }
    if (hasUndifferentiatedStudySubtype(sanitizedEvent)) {
        reviewReasons.add("study_subtype_undetermined");
    }
    return {
        event: sanitizedEvent,
        reviewReasons: [...reviewReasons],
    };
}
exports.LEGACY_GENERIC_TITLES = new Set([
    "diagnostico detectado por correo",
    "estudio detectado por correo",
    "documento",
    "documento detectado por correo",
    "turno programado",
    "resultado de laboratorio",
    "informe de estudio",
    "diagnostico",
]);
exports.LEGACY_DELETE_DOMAIN_HINTS = [
    "huesped.org",
    "ikeargentina.com",
    "osde",
    "swissmedical",
    "medicus",
    "galeno",
    "omint",
    "afip",
];
exports.LEGACY_OPERATIONAL_NOISE_REGEX = /\b(tipo detectado:\s*cancelacion|tipo detectado:\s*recordatorio_turno|tipo detectado:\s*confirmacion_turno|recordatorio del turno|informacion de turno solicitado|información de turno solicitado|turno confirmado|turno cancelado|reprogramacion|reprogramación|recordatorio de turno|cancelacion de turno|cancelación de turno)\b/i;
exports.LEGACY_SALVAGE_STUDY_REGEX = /\b(radiograf(?:ia|ias)?|rx\b|placa(?:s)?\s+de\s+t[oó]rax|ecograf(?:ia|ias)?|ultrason(?:ido)?|ultrasound|ecg|electrocardiograma|electrocardiograf|informe radiol[oó]gico|bronquitis|cardiomegalia|hepatomegalia|esplenitis|enfermedad discal|koh\b|microscop[ií]a|hemograma|bioqu[ií]mica|laboratorio)\b/i;
function isLegacyMailsyncEvent(docId, row, extractedData) {
    return (docId.startsWith("mailsync_") ||
        (0, utils_1.asString)(extractedData.extractionProtocol) === "legacy_v1" ||
        (0, utils_1.asString)(row.extractionProtocol) === "legacy_v1");
}
function selectLegacySender(row, extractedData) {
    return ((0, utils_1.asString)(extractedData.sourceSender) ||
        (0, utils_1.asString)(row.sourceSender) ||
        ((0, utils_1.asString)(extractedData.provider).includes("@") ? (0, utils_1.asString)(extractedData.provider) : "") ||
        ((0, utils_1.asString)(row.provider).includes("@") ? (0, utils_1.asString)(row.provider) : ""));
}
function hasLegacyMedicationPayload(extractedData) {
    const medicationsRaw = Array.isArray(extractedData.medications) ? extractedData.medications : [];
    return medicationsRaw.some((item) => {
        const medication = (0, utils_1.asRecord)(item);
        const name = (0, utils_1.normalizeClinicalToken)((0, utils_1.asString)(medication.name));
        if (!name || exports.MEDICATION_NAME_BLOCKLIST.has(name))
            return false;
        return Boolean((0, utils_1.asString)(medication.dose) || (0, utils_1.asString)(medication.frequency) || name.length >= 4);
    });
}
function classifyLegacyMailsyncEvent(docId, row) {
    const extractedData = (0, utils_1.asRecord)(row.extractedData);
    const title = (0, utils_1.asString)(row.title);
    const sender = selectLegacySender(row, extractedData);
    const provider = (0, utils_1.asString)(extractedData.provider) || (0, utils_1.asString)(row.provider) || null;
    const documentType = (0, utils_1.asString)(extractedData.documentType) || (0, utils_1.asString)(row.documentType) || null;
    const diagnosis = (0, utils_1.asString)(extractedData.diagnosis);
    const observations = (0, utils_1.asString)(extractedData.observations);
    const corpus = [
        title,
        (0, utils_1.asString)(extractedData.aiGeneratedSummary),
        observations,
        diagnosis,
        (0, utils_1.asString)(extractedData.sourceSubject),
        sender,
        provider,
        (0, utils_1.asString)(row.findings),
    ].join(" \n ");
    const normalizedTitle = (0, utils_1.normalizeClinicalToken)(title);
    const genericLegacyTitle = exports.LEGACY_GENERIC_TITLES.has(normalizedTitle);
    const humanNoise = (0, petMatching_1.hasStrongHumanHealthcareSignal)(corpus) ||
        exports.LEGACY_DELETE_DOMAIN_HINTS.some((hint) => (0, utils_1.normalizeTextForMatch)(sender).includes((0, utils_1.normalizeTextForMatch)(hint))) ||
        exports.LEGACY_DELETE_DOMAIN_HINTS.some((hint) => (0, utils_1.normalizeTextForMatch)(corpus).includes((0, utils_1.normalizeTextForMatch)(hint)));
    const operationalNoise = exports.LEGACY_OPERATIONAL_NOISE_REGEX.test(corpus);
    const documentImpliesStudy = ["xray", "lab_test", "laboratory_result", "clinical_report", "electrocardiogram", "ultrasound"].includes(documentType || "");
    const structuredClinicalFinding = exports.STRUCTURED_DIAGNOSIS_HINT_REGEX.test((0, utils_1.normalizeClinicalToken)(diagnosis)) ||
        exports.STRUCTURED_DIAGNOSIS_HINT_REGEX.test((0, utils_1.normalizeClinicalToken)(observations)) ||
        Boolean((0, utils_1.asString)(row.findings));
    const medicationPayload = hasLegacyMedicationPayload(extractedData);
    const veterinaryStudyEvidence = exports.LEGACY_SALVAGE_STUDY_REGEX.test(corpus) ||
        structuredClinicalFinding ||
        medicationPayload ||
        (documentImpliesStudy && !operationalNoise);
    const reasons = [];
    if (humanNoise)
        reasons.push("human_noise");
    if (operationalNoise)
        reasons.push("operational_noise");
    if (genericLegacyTitle)
        reasons.push("generic_legacy_title");
    if (veterinaryStudyEvidence)
        reasons.push("veterinary_study_evidence");
    if (structuredClinicalFinding)
        reasons.push("structured_clinical_finding");
    if (medicationPayload)
        reasons.push("medication_payload");
    let action = "keep";
    if (humanNoise) {
        action = "delete";
    }
    else if (operationalNoise && ["checkup", "appointment"].includes(documentType || "") && !structuredClinicalFinding && !medicationPayload) {
        action = "delete";
    }
    else if (veterinaryStudyEvidence) {
        action = "salvage";
    }
    else if (operationalNoise && (genericLegacyTitle || !veterinaryStudyEvidence)) {
        action = "delete";
    }
    else if (genericLegacyTitle && !veterinaryStudyEvidence) {
        action = "delete";
    }
    return {
        docId,
        action,
        title: title || null,
        sender: sender || null,
        provider,
        documentType,
        reasons,
    };
}
//# sourceMappingURL=clinicalNormalization.js.map