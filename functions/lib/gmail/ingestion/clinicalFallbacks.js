"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.shouldPersistCanonicalReviewDraft = shouldPersistCanonicalReviewDraft;
exports.buildFallbackClinicalExtraction = buildFallbackClinicalExtraction;
exports.buildFallbackClinicalExtractions = buildFallbackClinicalExtractions;
exports.resolveClinicalDocumentProcessingStatus = resolveClinicalDocumentProcessingStatus;
const petMatching_1 = require("./petMatching");
const clinicalNormalization_1 = require("./clinicalNormalization");
const utils_1 = require("./utils");
function shouldPersistCanonicalReviewDraft(args) {
    const normalizedReviewReason = (0, utils_1.cleanSentence)((0, utils_1.asString)(args.reviewReason)).toLowerCase();
    if (normalizedReviewReason.includes("historical_info_only")) {
        return false;
    }
    const evidenceText = (0, utils_1.cleanSentence)([
        args.sourceSubject,
        args.sourceSender,
        args.extractedText,
        args.event.description_summary,
        args.reviewReason,
        args.attachmentMetadata.map((row) => row.filename).join(" "),
    ]
        .filter(Boolean)
        .join(" · "));
    if ((0, clinicalNormalization_1.isAppointmentEventType)(args.event.event_type)) {
        const appointmentTime = args.event.appointment_time || (0, clinicalNormalization_1.extractAppointmentTimeFromText)(evidenceText);
        return Boolean(args.event.event_date) && Boolean(appointmentTime) && hasAppointmentSignal(evidenceText);
    }
    if ((0, clinicalNormalization_1.isStudyEventType)(args.event.event_type)) {
        return (Boolean(args.event.event_date) &&
            (Boolean(args.event.study_subtype) ||
                Boolean(args.event.imaging_type) ||
                (0, petMatching_1.attachmentNamesContainClinicalSignal)(args.attachmentMetadata) ||
                hasStudySignal(evidenceText)));
    }
    return false;
}
function buildFallbackDescription(subject, extractedText, fallback) {
    return (0, utils_1.cleanSentence)([subject, extractedText].filter(Boolean).join(" · ")).slice(0, 240) || fallback;
}
function hasAppointmentSignal(text) {
    return /\b(turno|consulta|control|recordatorio|confirmacion|confirmación|cancelacion|cancelación|reprogramaci|cita)\b/i.test(text);
}
function hasStudySignal(text) {
    return /\b(radiograf|ecograf|\beco\b|ultrasound|ecocard|doppler|ecg|electrocard|hemograma|bioquim|analisis de sangre|extraccion de sangre|perfil hep|perfil renal|quimica sanguinea|laboratorio|rx\b|placa|koh|citolog|microscop)\b/i.test(text);
}
function extractOperationalSegmentParts(segment) {
    const cleaned = (0, utils_1.cleanSentence)(segment)
        .replace(/\b\d{1,2}[\/.-]\d{1,2}(?:[\/.-]\d{2,4})?\b/g, " ")
        .replace(/\b\d{1,2}(?::|\.)\d{2}\b/g, " ")
        .replace(/\b\d{1,2}\s*(?:hs?|h)\b/gi, " ")
        .replace(/\b(?:fecha|hora|especialidad|prestacion|prestación|profesional|centro de atencion|centro de atención|equipo|sector atención|sector atencion)\b[:\s-]*/gi, " ")
        .replace(/\|/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    const clinicMatch = cleaned.match(/\b(PANDA\s+(?:HUIDOBRO|OBLIGADO|HUAPI|BAUNESS)(?:\s+24HS)?)\b/i);
    const clinicName = (0, clinicalNormalization_1.sanitizeExtractedEntity)((clinicMatch === null || clinicMatch === void 0 ? void 0 : clinicMatch[1]) || null);
    const clinicIndex = clinicName ? cleaned.toUpperCase().indexOf(clinicName.toUpperCase()) : -1;
    const preClinic = clinicIndex >= 0 ? cleaned.slice(0, clinicIndex).trim() : cleaned;
    const postClinic = clinicIndex >= 0 ? cleaned.slice(clinicIndex + clinicName.length).trim() : "";
    const professionalMatch = preClinic.match(/\b([A-ZÁÉÍÓÚÑ]+,\s*[A-ZÁÉÍÓÚÑ]+)\b/);
    const professionalName = (0, clinicalNormalization_1.sanitizeExtractedEntity)((professionalMatch === null || professionalMatch === void 0 ? void 0 : professionalMatch[1]) || null);
    return {
        cleaned,
        clinicName,
        preClinic,
        postClinic,
        professionalName,
    };
}
function normalizeOperationalLabel(segment) {
    const parts = extractOperationalSegmentParts(segment);
    const specialty = (0, clinicalNormalization_1.sanitizeExtractedEntity)((0, clinicalNormalization_1.extractAppointmentSpecialtyFromText)(segment));
    const preClinicWithoutProfessional = parts.professionalName
        ? parts.preClinic.replace(parts.professionalName, "").replace(/\s+/g, " ").trim()
        : parts.preClinic;
    const likelyLabel = (0, clinicalNormalization_1.sanitizeExtractedEntity)(parts.postClinic || preClinicWithoutProfessional || specialty || parts.cleaned);
    if (!likelyLabel)
        return null;
    return likelyLabel.slice(0, 120);
}
function extractProfessionalNameFromOperationalSegment(segment) {
    return extractOperationalSegmentParts(segment).professionalName;
}
function extractClinicNameFromOperationalSegment(segment, sourceSender) {
    const explicit = extractOperationalSegmentParts(segment).clinicName;
    if (explicit)
        return explicit;
    return (0, clinicalNormalization_1.extractClinicNameFromText)(segment, sourceSender);
}
function dedupeFallbackEvents(events) {
    const seen = new Set();
    const out = [];
    for (const row of events) {
        const event = row.event;
        if (!event)
            continue;
        const key = [
            event.event_type,
            event.event_date || "no_date",
            event.appointment_time || "no_time",
            event.appointment_specialty || normalizeOperationalLabel(event.description_summary) || "no_label",
            event.professional_name || "no_professional",
            event.clinic_name || "no_clinic",
            event.study_subtype || "no_study",
            event.imaging_type || "no_imaging",
        ]
            .map((value) => (0, utils_1.cleanSentence)((0, utils_1.asString)(value)).toLowerCase())
            .join("|");
        if (seen.has(key))
            continue;
        seen.add(key);
        out.push(row);
    }
    return out;
}
function extractOperationalFallbackEvents(args) {
    var _a;
    const fallbackConfidence = (0, utils_1.clamp)((_a = args.confidenceOverall) !== null && _a !== void 0 ? _a : 62, 0, 100);
    const sourceText = (0, utils_1.cleanSentence)([args.sourceSubject, args.extractedText].filter(Boolean).join(" · "));
    if (!hasAppointmentSignal(sourceText))
        return [];
    const trustedOperationalSender = (0, petMatching_1.isTrustedClinicalSender)(args.sourceSender) || /panda/i.test(args.sourceSender);
    const contextualHeader = (0, utils_1.cleanSentence)(args.sourceSubject) ||
        args.extractedText
            .split(/\n+/)
            .map((line) => (0, utils_1.cleanSentence)(line))
            .find((line) => hasAppointmentSignal(line)) ||
        "";
    const segments = args.extractedText
        .split(/\n+/)
        .map((line) => (0, utils_1.cleanSentence)(line))
        .filter((line) => /\b\d{1,2}[\/.-]\d{1,2}(?:[\/.-]\d{2,4})?\b/.test(line) && /\b\d{1,2}(?::|\.)\d{2}|\b\d{1,2}\s*(?:hs?|h)\b/i.test(line));
    const candidateSegments = segments.length > 0 ? segments : [sourceText];
    const results = [];
    for (const segment of candidateSegments) {
        const eventDate = (0, clinicalNormalization_1.extractAppointmentDateFromText)(segment, args.emailDate);
        if (!eventDate)
            continue;
        const segmentSourceText = (0, utils_1.cleanSentence)([contextualHeader, segment].filter(Boolean).join(" · "));
        const appointmentCandidate = (0, clinicalNormalization_1.extractOperationalAppointmentCandidate)({
            eventDate,
            sourceText: segmentSourceText,
            sourceSender: args.sourceSender,
            existingTime: (0, clinicalNormalization_1.extractAppointmentTimeFromText)(segment),
            existingSpecialty: normalizeOperationalLabel(segment),
            professionalName: extractProfessionalNameFromOperationalSegment(segment) ||
                (0, clinicalNormalization_1.extractProfessionalNameFromText)(segment) ||
                (0, clinicalNormalization_1.extractProfessionalNameFromText)(segmentSourceText) ||
                (0, clinicalNormalization_1.extractProfessionalNameFromText)(sourceText),
            clinicName: extractClinicNameFromOperationalSegment(segment, args.sourceSender) ||
                (0, clinicalNormalization_1.extractClinicNameFromText)(sourceText, args.sourceSender),
            confidenceScore: (0, utils_1.clamp)(Math.max(fallbackConfidence, 84), 0, 100),
        });
        if (!appointmentCandidate)
            continue;
        const guarded = (0, clinicalNormalization_1.applyConstitutionalGuardrails)(Object.assign(Object.assign({}, appointmentCandidate), { description_summary: buildFallbackDescription(args.sourceSubject, segment, "Turno veterinario detectado"), appointment_specialty: appointmentCandidate.appointment_specialty || normalizeOperationalLabel(segment) || normalizeOperationalLabel(sourceText) }));
        const requiresHumanReview = guarded.reviewReasons.length > 0 || !trustedOperationalSender;
        results.push({
            event: guarded.event,
            confidenceOverall: (0, utils_1.clamp)(Math.max(fallbackConfidence, 84), 0, 100),
            requiresHumanReview,
            reasonIfReviewNeeded: guarded.reviewReasons[0] || (requiresHumanReview ? "operational_appointment_fallback" : null),
        });
    }
    return dedupeFallbackEvents(results);
}
function deriveStudyFallbackHints(args) {
    const evidenceText = [
        args.sourceSubject,
        args.sourceSender,
        args.extractedText,
        args.attachmentMetadata.map((row) => row.filename).join(" "),
    ]
        .filter(Boolean)
        .join(" ");
    const inferredImagingType = (0, clinicalNormalization_1.inferImagingTypeFromSignals)(evidenceText);
    const preferredStudySubtype = (0, clinicalNormalization_1.inferStudySubtypeFromSignals)({
        rawStudySubtype: null,
        imagingType: inferredImagingType,
        labResults: [],
        descriptionSummary: evidenceText,
        diagnosis: null,
    });
    const preferStudyReport = preferredStudySubtype !== null ||
        /\b(radiograf|ecograf|\beco\b|ultrasound|ecocard|doppler|ecg|electrocard|hemograma|bioquim|analisis de sangre|extraccion de sangre|perfil hep|perfil renal|quimica sanguinea|laboratorio|rx\b|placa|koh|citolog|microscop)\b/i.test(evidenceText) ||
        (0, petMatching_1.attachmentNamesContainClinicalSignal)(args.attachmentMetadata);
    return {
        preferStudyReport,
        preferredStudySubtype,
        inferredImagingType,
        hasHumanHealthcareNoise: (0, petMatching_1.hasStrongHumanHealthcareSignal)(evidenceText),
    };
}
function buildFallbackClinicalExtraction(args) {
    return buildFallbackClinicalExtractions(args)[0] || null;
}
function buildFallbackClinicalExtractions(args) {
    var _a;
    const fallbackConfidence = (0, utils_1.clamp)((_a = args.confidenceOverall) !== null && _a !== void 0 ? _a : 62, 0, 100);
    const fullText = (0, utils_1.cleanSentence)([args.sourceSubject, args.extractedText].filter(Boolean).join(" · "));
    if (!fullText)
        return [];
    if ((0, petMatching_1.hasVeterinaryAdministrativeOnlySignal)(args))
        return [];
    const hints = deriveStudyFallbackHints(args);
    if (hints.hasHumanHealthcareNoise && !hints.preferStudyReport)
        return [];
    const operationalEvents = extractOperationalFallbackEvents(args);
    if (operationalEvents.length > 0)
        return operationalEvents;
    if (hints.preferStudyReport) {
        const guarded = (0, clinicalNormalization_1.applyConstitutionalGuardrails)({
            event_type: "study_report",
            event_date: (0, clinicalNormalization_1.extractAppointmentDateFromText)(fullText, args.emailDate) || (0, utils_1.toIsoDateOnly)(new Date(args.emailDate)),
            date_confidence: 68,
            description_summary: buildFallbackDescription(args.sourceSubject, args.extractedText, "Estudio clínico detectado"),
            diagnosis: null,
            medications: [],
            lab_results: [],
            imaging_type: hints.inferredImagingType,
            study_subtype: hints.preferredStudySubtype,
            appointment_time: null,
            appointment_specialty: null,
            professional_name: null,
            clinic_name: (0, clinicalNormalization_1.extractClinicNameFromText)(fullText, args.sourceSender),
            appointment_status: null,
            severity: null,
            confidence_score: (0, utils_1.clamp)(Math.max(fallbackConfidence, 72), 0, 100),
        });
        return [{
                event: guarded.event,
                confidenceOverall: (0, utils_1.clamp)(Math.max(fallbackConfidence, 72), 0, 100),
                requiresHumanReview: true,
                reasonIfReviewNeeded: guarded.reviewReasons[0] || "study_fallback_from_attachment_signal",
            }];
    }
    if (!hasAppointmentSignal(fullText) && !hasStudySignal(fullText))
        return [];
    return [];
}
function resolveClinicalDocumentProcessingStatus(args) {
    if (args.reviewsForMessage > 0)
        return "requires_review";
    if (args.createdForMessage > 0)
        return "ingested";
    if (!args.isClinicalContent)
        return "discarded_non_clinical";
    const fallbacks = buildFallbackClinicalExtractions({
        sourceSubject: args.sourceSubject,
        sourceSender: args.sourceSender,
        extractedText: args.extractedText,
        emailDate: args.emailDate,
        attachmentMetadata: args.attachmentMetadata,
        confidenceOverall: 60,
    });
    if (fallbacks.some((row) => row.event)) {
        return fallbacks.some((row) => row.requiresHumanReview) ? "requires_review_no_extractable_event" : "ingested";
    }
    if (hasAppointmentSignal((0, utils_1.cleanSentence)([args.sourceSubject, args.extractedText].filter(Boolean).join(" · ")))) {
        return "discarded_operational_no_structured_event";
    }
    if ((0, petMatching_1.attachmentNamesContainClinicalSignal)(args.attachmentMetadata) ||
        /\b(estudio|radiograf|ecograf|\beco\b|electrocard|ecocard|doppler|laboratorio|hemograma|bioquim|analisis de sangre|extraccion de sangre|perfil hep|perfil renal|sangre)\b/i.test([args.sourceSubject, args.extractedText, args.reasonIfReviewNeeded].filter(Boolean).join(" "))) {
        return "requires_review_no_extractable_event";
    }
    return "discarded_no_extractable_event";
}
//# sourceMappingURL=clinicalFallbacks.js.map