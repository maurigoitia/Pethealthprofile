"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.backfillClinicalEpisodes = void 0;
const admin = require("firebase-admin");
const functions = require("firebase-functions");
const crypto_1 = require("crypto");
const RECENT_WINDOW_DAYS = 90;
const MONTH_BUCKET_UNTIL_MONTHS = 18;
const QA_ALLOWED_EMAILS_DEFAULT = ["mauriciogoitia@gmail.com"];
const START_OF_DAY_MS = 24 * 60 * 60 * 1000;
function asRecord(value) {
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}
function asString(value, fallback = "") {
    return typeof value === "string" ? value.trim() : fallback;
}
function asBoolean(value) {
    return value === true;
}
function asArray(value) {
    return Array.isArray(value) ? value : [];
}
function asNumber(value) {
    return typeof value === "number" && Number.isFinite(value) ? value : null;
}
function sha(value) {
    return (0, crypto_1.createHash)("sha256").update(value).digest("hex");
}
function unique(values) {
    return Array.from(new Set(values
        .map((value) => asString(value))
        .filter(Boolean)));
}
function cleanLabel(value, fallback = "") {
    return asString(value, fallback)
        .replace(/```[\s\S]*?```/g, "")
        .replace(/\*\*(.*?)\*\*/g, "$1")
        .replace(/\*(.*?)\*/g, "$1")
        .replace(/#{1,6}\s+/g, "")
        .replace(/`/g, "")
        .replace(/\s+/g, " ")
        .trim();
}
function normalize(value) {
    return cleanLabel(value)
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
}
function confidenceFromLabel(value) {
    const normalized = normalize(value);
    if (normalized === "high" || normalized === "alta" || normalized === "confirmado")
        return 0.92;
    if (normalized === "medium" || normalized === "media")
        return 0.8;
    if (normalized === "low" || normalized === "baja")
        return 0.65;
    return 0.45;
}
function inferEventConfidence(row) {
    const overall = asNumber(row.overallConfidence);
    if (overall !== null) {
        if (overall > 1)
            return Math.max(0, Math.min(1, overall / 100));
        return Math.max(0, Math.min(1, overall));
    }
    const extracted = asRecord(row.extractedData);
    const values = [
        confidenceFromLabel(extracted.documentTypeConfidence),
        confidenceFromLabel(extracted.eventDateConfidence),
        confidenceFromLabel(extracted.providerConfidence),
        confidenceFromLabel(extracted.diagnosisConfidence),
        confidenceFromLabel(extracted.observationsConfidence),
    ].filter((value) => Number.isFinite(value));
    if (values.length === 0)
        return 0.8;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
}
function parseTimestamp(value) {
    if (!value)
        return null;
    const timestamp = Date.parse(value);
    return Number.isFinite(timestamp) ? timestamp : null;
}
function extractEventDate(row) {
    const extracted = asRecord(row.extractedData);
    return (asString(extracted.eventDate) ||
        asString(row.eventDate) ||
        asString(row.createdAt) ||
        null);
}
function isRecentOrFuture(timestamp, nowTs) {
    const recentCutoff = nowTs - RECENT_WINDOW_DAYS * START_OF_DAY_MS;
    return timestamp >= recentCutoff;
}
function monthDistance(nowTs, targetTs) {
    const now = new Date(nowTs);
    const target = new Date(targetTs);
    return Math.max(0, (now.getFullYear() - target.getFullYear()) * 12 + (now.getMonth() - target.getMonth()));
}
function buildPeriodMeta(timestamp, nowTs) {
    const date = new Date(timestamp);
    const yearKey = String(date.getFullYear());
    const monthsAgo = monthDistance(nowTs, timestamp);
    if (monthsAgo > MONTH_BUCKET_UNTIL_MONTHS) {
        return {
            bucketId: `ceb_${sha(`year_${yearKey}`).slice(0, 24)}`,
            periodType: "year",
            periodKey: yearKey,
            periodLabel: yearKey,
            yearKey,
        };
    }
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const periodKey = `${yearKey}-${month}`;
    const monthLabel = date
        .toLocaleDateString("es-AR", { month: "long", year: "numeric" })
        .replace(/^\w/, (char) => char.toUpperCase());
    return {
        bucketId: `ceb_${sha(`month_${periodKey}`).slice(0, 24)}`,
        periodType: "month",
        periodKey,
        periodLabel: monthLabel,
        yearKey,
    };
}
function isStudyDocument(documentType, extracted) {
    return (["xray", "lab_test", "echocardiogram", "electrocardiogram"].includes(documentType) ||
        /(radiografia|ecografia|ecg|laboratorio|lab|koh|microscopia|rx|imagen|radiologico)/.test(normalize(extracted.studyType || extracted.suggestedTitle || extracted.observations || "")));
}
function hasAppointmentLanguage(value) {
    return /(turno|consulta|recordatorio|confirmacion|confirmado|agendad|programad|reprogramad|cancelad|cita)/.test(normalize(value));
}
function isLikelyPrescription(documentType, extracted) {
    const medications = asArray(extracted.medications);
    if (documentType === "medication") {
        return medications.some((medication) => Boolean(asString(medication.name)) && Boolean(asString(medication.dosage)) && Boolean(asString(medication.frequency)));
    }
    return medications.some((medication) => Boolean(asString(medication.name)) && Boolean(asString(medication.dosage)) && Boolean(asString(medication.frequency)));
}
function classifyEpisodeType(row) {
    const extracted = asRecord(row.extractedData);
    const documentType = asString(extracted.documentType);
    const titleText = [
        extracted.suggestedTitle,
        row.title,
        extracted.observations,
        extracted.aiGeneratedSummary,
        extracted.sourceSubject,
    ]
        .map((value) => asString(value))
        .filter(Boolean)
        .join(" · ");
    if (documentType === "vaccine")
        return "vaccination";
    if (isLikelyPrescription(documentType, extracted))
        return "prescription";
    if (documentType === "appointment" || hasAppointmentLanguage(titleText))
        return "appointment";
    if (isStudyDocument(documentType, extracted)) {
        return /(laboratorio|lab|koh|microscopia|analisis|prick test)/.test(normalize(titleText))
            ? "laboratory"
            : "study";
    }
    return "consultation";
}
function primaryStudyLabel(row) {
    const extracted = asRecord(row.extractedData);
    return (cleanLabel(extracted.studyType) ||
        cleanLabel(extracted.suggestedTitle) ||
        (isStudyDocument(asString(extracted.documentType), extracted) ? cleanLabel(row.title, "Estudio clínico") : null));
}
function extractMedications(row) {
    const extracted = asRecord(row.extractedData);
    return asArray(extracted.medications)
        .map((medication) => ({
        name: cleanLabel(medication.name),
        dosage: cleanLabel(medication.dosage) || null,
        frequency: cleanLabel(medication.frequency) || null,
    }))
        .filter((medication) => medication.name && medication.dosage && medication.frequency);
}
function inferSource(row) {
    const extracted = asRecord(row.extractedData);
    if (asString(extracted.sourceSender) || asString(extracted.sourceSubject) || asString(extracted.sourceReceivedAt))
        return "gmail";
    if (asBoolean(row.ocrProcessed) || asString(row.fileType) === "pdf" || asString(row.fileType) === "image")
        return "scanner";
    return "manual";
}
function buildSourceEvent(row, id) {
    const extracted = asRecord(row.extractedData);
    return {
        id,
        title: cleanLabel(extracted.suggestedTitle || row.title || "Documento clínico"),
        documentType: asString(extracted.documentType) || null,
        date: extractEventDate(row),
        source: inferSource(row),
    };
}
function buildEpisodeSeedFromEvent(row, id) {
    var _a;
    const extracted = asRecord(row.extractedData);
    const confidence = inferEventConfidence(row);
    const date = extractEventDate(row);
    const timestamp = parseTimestamp(date);
    if (!date || timestamp === null)
        return null;
    const diagnoses = unique([
        cleanLabel(extracted.diagnosis),
        cleanLabel(extracted.linkedConditionLabel),
    ]).slice(0, 3);
    const medications = extractMedications(row);
    const studies = unique([primaryStudyLabel(row)]).slice(0, 3);
    const providerName = cleanLabel(extracted.provider || row.professional) || null;
    const clinicName = cleanLabel(extracted.clinic || row.clinic) || null;
    const specialty = cleanLabel((asArray(extracted.detectedAppointments)[0] || {}).specialty) || null;
    const episodeType = classifyEpisodeType(row);
    const status = confidence >= 0.85 ? "confirmed" : confidence >= 0.75 ? "draft" : "needs_clean_upload";
    const headline = cleanLabel(extracted.suggestedTitle) ||
        (episodeType === "appointment"
            ? "Turno veterinario"
            : episodeType === "prescription"
                ? ((_a = medications[0]) === null || _a === void 0 ? void 0 : _a.name) || "Prescripción"
                : studies[0] || diagnoses[0] || cleanLabel(row.title, "Acto clínico"));
    const narrativeParts = [
        diagnoses[0] ? `Diagnóstico principal: ${diagnoses[0]}.` : "",
        studies[0] ? `Estudio: ${studies[0]}.` : "",
        medications[0] ? `Tratamiento: ${medications[0].name}${medications[0].dosage ? ` (${medications[0].dosage})` : ""}.` : "",
    ].filter(Boolean);
    return {
        id,
        date,
        timestamp,
        title: headline,
        episodeType,
        diagnoses,
        medications,
        studies,
        provider: {
            name: providerName,
            clinic: clinicName,
            specialty,
        },
        sourceEventIds: [id],
        sourceEvents: [buildSourceEvent(row, id)],
        confidence,
        status,
        narrative: narrativeParts.slice(0, 3).join(" "),
        source: inferSource(row),
    };
}
function buildGroupKey(seed) {
    var _a;
    const providerKey = normalize(seed.provider.name || seed.provider.clinic || "sin_prestador");
    const actKey = normalize(seed.diagnoses[0] || seed.studies[0] || ((_a = seed.medications[0]) === null || _a === void 0 ? void 0 : _a.name) || seed.title || seed.episodeType);
    return `${seed.date.slice(0, 10)}::${providerKey}::${seed.episodeType}::${actKey}`;
}
function mergeEpisodeSeeds(args) {
    const sorted = [...args.seeds].sort((a, b) => a.timestamp - b.timestamp);
    const first = sorted[0];
    const date = first.date;
    const episodeId = `cep_${sha(`${args.uid}_${args.petId}_${args.groupKey}`).slice(0, 24)}`;
    const diagnoses = unique(sorted.flatMap((seed) => seed.diagnoses)).slice(0, 4);
    const medicationsMap = new Map();
    for (const medication of sorted.flatMap((seed) => seed.medications)) {
        medicationsMap.set(`${normalize(medication.name)}::${normalize(medication.dosage)}::${normalize(medication.frequency)}`, medication);
    }
    const medications = Array.from(medicationsMap.values()).slice(0, 4);
    const studies = unique(sorted.flatMap((seed) => seed.studies)).slice(0, 4);
    const providers = sorted
        .map((seed) => seed.provider)
        .filter((provider) => provider.name || provider.clinic);
    const provider = providers[0] || { name: null, clinic: null, specialty: null };
    const sourceEvents = sorted.flatMap((seed) => seed.sourceEvents);
    const sourceEventIds = sourceEvents.map((event) => event.id);
    const confidence = sorted.reduce((sum, seed) => sum + seed.confidence, 0) / sorted.length;
    const maxStatus = confidence >= 0.85 ? "confirmed" : confidence >= 0.75 ? "draft" : "needs_clean_upload";
    const episodeType = sorted.every((seed) => seed.episodeType === "appointment")
        ? "appointment"
        : sorted.every((seed) => seed.episodeType === "prescription")
            ? "prescription"
            : sorted.every((seed) => seed.episodeType === "study" || seed.episodeType === "laboratory")
                ? (sorted.some((seed) => seed.episodeType === "laboratory") && !sorted.some((seed) => seed.episodeType === "study")
                    ? "laboratory"
                    : "study")
                : sorted.length > 1
                    ? "mixed"
                    : first.episodeType;
    const headline = (() => {
        var _a;
        if (episodeType === "appointment") {
            const specialtyLabel = cleanLabel(provider.specialty || first.title || "Consulta veterinaria");
            return `${specialtyLabel.replace(/^consulta\s+/i, "Consulta ")} – ${new Date(date).toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" })}`;
        }
        if (episodeType === "prescription") {
            return ((_a = medications[0]) === null || _a === void 0 ? void 0 : _a.name) ? `Tratamiento – ${medications[0].name}` : "Tratamiento indicado";
        }
        if (episodeType === "study" || episodeType === "laboratory") {
            return studies[0] || first.title || "Estudio clínico";
        }
        return first.title || diagnoses[0] || "Acto clínico";
    })();
    const summaryParts = [
        diagnoses[0] ? `Diagnóstico principal: ${diagnoses[0]}.` : "",
        studies[0] ? `Estudio principal: ${studies[0]}.` : "",
        medications[0]
            ? `Medicación asociada: ${medications[0].name}${medications[0].dosage ? ` (${medications[0].dosage})` : ""}${medications[0].frequency ? ` · ${medications[0].frequency}` : ""}.`
            : "",
        provider.name || provider.clinic
            ? `Prestador: ${[provider.name, provider.clinic].filter(Boolean).join(" · ")}.`
            : "",
    ].filter(Boolean);
    return {
        id: episodeId,
        userId: args.uid,
        petId: args.petId,
        petName: args.petName,
        date,
        timestamp: new Date(date).toISOString(),
        episodeType,
        headline,
        summary: summaryParts.slice(0, 3).join(" "),
        diagnoses,
        medications,
        studies,
        provider,
        sourceEventIds,
        sourceEvents,
        sourceAppointmentIds: [],
        source: unique(sorted.map((seed) => seed.source)),
        confidence: Number(confidence.toFixed(2)),
        status: maxStatus,
        sourceMode: "derived_episode_v1",
        updatedAt: new Date().toISOString(),
    };
}
function looksLikeClinicalAppointment(title, provider, clinic, date) {
    return Boolean(title && date && (provider || clinic) && hasAppointmentLanguage(title));
}
function buildEpisodeFromAppointment(args) {
    const date = asString(args.row.date);
    const timestamp = parseTimestamp(date);
    if (!date || timestamp === null)
        return null;
    const title = cleanLabel(args.row.title || "Turno veterinario");
    const provider = cleanLabel(args.row.veterinarian) || null;
    const clinic = cleanLabel(args.row.clinic) || null;
    if (!looksLikeClinicalAppointment(title, provider, clinic, date))
        return null;
    const id = `cep_${sha(`${args.uid}_${args.petId}_appointment_${args.appointmentId}`).slice(0, 24)}`;
    const time = cleanLabel(args.row.time) || null;
    const status = asString(args.row.status) === "upcoming" ? "confirmed" : "confirmed";
    return {
        id,
        userId: args.uid,
        petId: args.petId,
        petName: args.petName,
        date,
        timestamp: new Date(`${date}T${time || "00:00"}:00`).toISOString(),
        episodeType: "appointment",
        headline: title,
        summary: `Turno ${time ? `a las ${time}` : "confirmado"}${provider || clinic ? ` con ${[provider, clinic].filter(Boolean).join(" · ")}` : ""}.`,
        diagnoses: [],
        medications: [],
        studies: [],
        provider: { name: provider, clinic, specialty: null },
        sourceEventIds: [],
        sourceEvents: [],
        sourceAppointmentIds: [args.appointmentId],
        source: ["manual"],
        confidence: 0.95,
        status,
        sourceMode: "derived_episode_v1",
        updatedAt: new Date().toISOString(),
    };
}
function buildBucketSummary(episodes, petName, periodLabel) {
    if (episodes.length <= 10)
        return null;
    const diagnoses = unique(episodes.flatMap((episode) => asArray(episode.diagnoses))).slice(0, 3);
    const medications = unique(episodes.flatMap((episode) => asArray(episode.medications).map((medication) => cleanLabel(medication.name)))).slice(0, 3);
    return {
        headline: "Mes de alta intensidad clínica",
        narrative: [
            `Durante ${periodLabel}, ${petName} tuvo ${episodes.length} episodios confirmados.`,
            diagnoses[0] ? `Predominaron ${diagnoses.join(", ")}.` : "",
            medications[0] ? `La medicación más repetida fue ${medications.join(", ")}.` : "",
        ]
            .filter(Boolean)
            .slice(0, 3)
            .join(" "),
        highlights: [
            diagnoses[0] ? `Patología principal: ${diagnoses[0]}` : "",
            medications[0] ? `Medicación relevante: ${medications[0]}` : "",
        ].filter(Boolean),
    };
}
function buildAnnualSummary(episodes, petName, yearKey) {
    const diagnoses = unique(episodes.flatMap((episode) => asArray(episode.diagnoses))).slice(0, 3);
    const medications = unique(episodes.flatMap((episode) => asArray(episode.medications).map((medication) => cleanLabel(medication.name)))).slice(0, 3);
    const providers = unique(episodes.flatMap((episode) => {
        const provider = asRecord(episode.provider);
        return [cleanLabel(provider.name), cleanLabel(provider.clinic)];
    })).slice(0, 2);
    return {
        headline: `Anuario ${yearKey}`,
        narrative: [
            `Durante ${yearKey}, ${petName} tuvo principalmente ${diagnoses[0] || medications[0] || "seguimiento clínico"}.`,
            `La atención se concentró en ${providers[0] || "prestadores habituales"}.`,
            medications[0] ? `La medicación más repetida fue ${medications[0]}.` : "",
        ]
            .filter(Boolean)
            .slice(0, 3)
            .join(" "),
        highlights: [
            diagnoses[0] ? `Patología principal: ${diagnoses[0]}` : "",
            medications[0] ? `Medicación actual/relevante: ${medications[0]}` : "",
        ].filter(Boolean),
    };
}
function isQaUserAllowed(email) {
    const configured = (process.env.GMAIL_QA_ALLOWED_USER_EMAILS || "")
        .split(",")
        .map((value) => value.trim().toLowerCase())
        .filter(Boolean);
    const allowlist = configured.length > 0 ? configured : QA_ALLOWED_EMAILS_DEFAULT;
    return allowlist.includes(email.toLowerCase());
}
async function deleteExistingDerivedDocs(args) {
    const deleted = { episodes: 0, buckets: 0, profiles: 0 };
    for (const collectionName of ["clinical_episodes", "clinical_episode_buckets"]) {
        const snap = await admin.firestore().collection(collectionName).where("userId", "==", args.uid).where("petId", "==", args.petId).limit(500).get();
        if (snap.empty)
            continue;
        const batch = admin.firestore().batch();
        let count = 0;
        for (const document of snap.docs) {
            batch.delete(document.ref);
            count += 1;
        }
        await batch.commit();
        if (collectionName === "clinical_episodes")
            deleted.episodes += count;
        else
            deleted.buckets += count;
    }
    const snapshotId = `cps_${sha(`${args.uid}_${args.petId}`).slice(0, 24)}`;
    const snapshotRef = admin.firestore().collection("clinical_profile_snapshots").doc(snapshotId);
    const snapshot = await snapshotRef.get();
    if (snapshot.exists) {
        await snapshotRef.delete();
        deleted.profiles += 1;
    }
    return deleted;
}
function buildProfileSnapshot(args) {
    const activeConditions = args.conditions
        .filter((condition) => ["active", "monitoring"].includes(asString(condition.status)))
        .map((condition) => cleanLabel(condition.normalizedName))
        .filter(Boolean)
        .slice(0, 4);
    const pastConditions = args.conditions
        .filter((condition) => asString(condition.status) === "resolved")
        .map((condition) => cleanLabel(condition.normalizedName))
        .filter(Boolean)
        .slice(0, 4);
    const currentMedications = args.treatments
        .filter((treatment) => asString(treatment.subtype || "medication") === "medication" && asString(treatment.status) === "active")
        .map((treatment) => ({
        name: cleanLabel(treatment.normalizedName),
        dosage: cleanLabel(treatment.dosage) || null,
        frequency: cleanLabel(treatment.frequency) || null,
    }))
        .filter((medication) => medication.name)
        .slice(0, 5);
    const recurrentPathologies = args.conditions
        .filter((condition) => ["recurrent", "chronic"].includes(asString(condition.pattern)))
        .map((condition) => cleanLabel(condition.normalizedName))
        .filter(Boolean)
        .slice(0, 4);
    const allergyCandidates = unique([
        ...args.conditions.map((condition) => cleanLabel(condition.normalizedName)),
        ...args.episodes.flatMap((episode) => asArray(episode.diagnoses)),
    ])
        .filter((label) => /(alerg|atopia|otitis alergica|dermatitis)/.test(normalize(label)))
        .slice(0, 4);
    const breed = cleanLabel(args.petRow.breed);
    const narrativeParts = [
        `${args.petName}${breed ? `, ${breed},` : ""} presenta antecedentes de ${activeConditions[0] || pastConditions[0] || recurrentPathologies[0] || "seguimiento clínico"}${activeConditions.length > 1 ? `, además de ${activeConditions.slice(1).join(", ")}` : ""}.`,
        currentMedications[0]
            ? `Actualmente medicado con ${currentMedications.map((medication) => medication.name).join(", ")}.`
            : "",
        pastConditions[0] ? `Entre sus antecedentes relevantes se incluyen ${pastConditions.join(", ")}.` : "",
    ].filter(Boolean);
    return {
        id: `cps_${sha(`${args.uid}_${args.petId}`).slice(0, 24)}`,
        userId: args.uid,
        petId: args.petId,
        petName: args.petName,
        generatedAt: new Date().toISOString(),
        sourceMode: "derived_episode_v1",
        activeConditions,
        pastConditions,
        currentMedications,
        allergies: allergyCandidates,
        recurrentPathologies,
        narrative: narrativeParts.slice(0, 3).join(" "),
        sourceEpisodeIds: args.episodes.map((episode) => asString(episode.id)),
    };
}
async function maybeProjectAppointmentFromEpisode(episode) {
    if (asString(episode.episodeType) !== "appointment")
        return false;
    if (asString(episode.status) !== "confirmed")
        return false;
    const date = asString(episode.date);
    const timestamp = parseTimestamp(date);
    if (timestamp === null)
        return false;
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    if (timestamp < startOfToday.getTime())
        return false;
    const appointmentId = `episode_${asString(episode.id)}`;
    const ref = admin.firestore().collection("appointments").doc(appointmentId);
    const existing = await ref.get();
    if (existing.exists)
        return false;
    const provider = asRecord(episode.provider);
    await ref.set({
        petId: asString(episode.petId),
        userId: asString(episode.userId),
        ownerId: asString(episode.userId),
        petName: asString(episode.petName),
        sourceEventId: asArray(episode.sourceEventIds)[0] || null,
        sourceSuggestionKey: appointmentId,
        autoGenerated: true,
        type: "checkup",
        title: asString(episode.headline, "Turno veterinario"),
        date,
        time: "",
        veterinarian: cleanLabel(provider.name) || null,
        clinic: cleanLabel(provider.clinic) || null,
        status: "upcoming",
        notes: asString(episode.summary) || "",
        createdAt: new Date().toISOString(),
    }, { merge: true });
    return true;
}
async function runClinicalEpisodeBackfill(args) {
    const dryRun = args.dryRun !== false;
    const limit = Math.max(50, Math.min(2000, args.limit || 500));
    const nowTs = Date.now();
    const result = {
        total_medical_events_scanned: 0,
        eligible_medical_events: 0,
        total_appointments_scanned: 0,
        recent_episodes_written: 0,
        historical_episodes_written: 0,
        buckets_written: 0,
        profile_snapshots_written: 0,
        appointments_projected: 0,
        deleted_episodes: 0,
        deleted_buckets: 0,
        deleted_profiles: 0,
        sample_episode_ids: [],
        sample_bucket_ids: [],
        errors: 0,
    };
    const petSnap = await admin.firestore().collection("pets").doc(args.petId).get();
    if (!petSnap.exists)
        throw new Error("pet_not_found");
    const petRow = asRecord(petSnap.data());
    const petName = cleanLabel(petRow.name, "Mascota");
    const eventsSnap = await admin.firestore().collection("medical_events").where("userId", "==", args.uid).limit(limit).get();
    result.total_medical_events_scanned = eventsSnap.size;
    const seedsByGroup = new Map();
    for (const document of eventsSnap.docs) {
        const row = asRecord(document.data());
        if (asString(row.petId) !== args.petId)
            continue;
        if (["processing", "draft"].includes(asString(row.status)))
            continue;
        if (["review_required", "invalid_future_date"].includes(asString(row.workflowStatus)))
            continue;
        if (asBoolean(row.requiresManualConfirmation))
            continue;
        const seed = buildEpisodeSeedFromEvent(row, document.id);
        if (!seed)
            continue;
        if (seed.status === "needs_clean_upload")
            continue;
        result.eligible_medical_events += 1;
        const groupKey = buildGroupKey(seed);
        if (!seedsByGroup.has(groupKey))
            seedsByGroup.set(groupKey, []);
        seedsByGroup.get(groupKey).push(seed);
    }
    const episodeDocs = Array.from(seedsByGroup.entries()).map(([groupKey, seeds]) => mergeEpisodeSeeds({
        uid: args.uid,
        petId: args.petId,
        petName,
        groupKey,
        seeds,
    }));
    const appointmentsSnap = await admin.firestore().collection("appointments").where("petId", "==", args.petId).limit(limit).get();
    result.total_appointments_scanned = appointmentsSnap.size;
    for (const document of appointmentsSnap.docs) {
        const episode = buildEpisodeFromAppointment({
            uid: args.uid,
            petId: args.petId,
            petName,
            appointmentId: document.id,
            row: asRecord(document.data()),
        });
        if (!episode)
            continue;
        const duplicate = episodeDocs.some((candidate) => asArray(candidate.sourceAppointmentIds).includes(document.id));
        if (!duplicate)
            episodeDocs.push(episode);
    }
    episodeDocs.sort((a, b) => (parseTimestamp(asString(b.date)) || 0) - (parseTimestamp(asString(a.date)) || 0));
    const bucketDocs = new Map();
    const yearEpisodes = new Map();
    for (const episode of episodeDocs) {
        const timestamp = parseTimestamp(asString(episode.date)) || parseTimestamp(asString(episode.timestamp)) || nowTs;
        if (isRecentOrFuture(timestamp, nowTs)) {
            result.recent_episodes_written += 1;
            continue;
        }
        result.historical_episodes_written += 1;
        const period = buildPeriodMeta(timestamp, nowTs);
        const bucket = bucketDocs.get(period.bucketId) || {
            id: period.bucketId,
            userId: args.uid,
            petId: args.petId,
            petName,
            periodType: period.periodType,
            periodKey: period.periodKey,
            periodLabel: period.periodLabel,
            yearKey: period.yearKey,
            episodeIds: [],
            generatedAt: new Date().toISOString(),
            sourceMode: "derived_episode_v1",
        };
        asArray(bucket.episodeIds).push(asString(episode.id));
        bucket.episodeCount = asArray(bucket.episodeIds).length;
        bucketDocs.set(period.bucketId, bucket);
        if (!yearEpisodes.has(period.yearKey))
            yearEpisodes.set(period.yearKey, []);
        yearEpisodes.get(period.yearKey).push(episode);
    }
    for (const [bucketId, bucket] of bucketDocs.entries()) {
        if (asString(bucket.periodType) === "month") {
            const bucketEpisodes = episodeDocs.filter((episode) => asArray(bucket.episodeIds).includes(asString(episode.id)));
            bucket.bucketSummary = buildBucketSummary(bucketEpisodes, petName, asString(bucket.periodLabel));
        }
        if (result.sample_bucket_ids.length < 10)
            result.sample_bucket_ids.push(bucketId);
    }
    for (const [yearKey, episodes] of yearEpisodes.entries()) {
        const yearBucketId = `ceb_${sha(`year_summary_${args.uid}_${args.petId}_${yearKey}`).slice(0, 24)}`;
        bucketDocs.set(yearBucketId, {
            id: yearBucketId,
            userId: args.uid,
            petId: args.petId,
            petName,
            periodType: "year",
            periodKey: yearKey,
            periodLabel: yearKey,
            yearKey,
            episodeIds: episodes.map((episode) => asString(episode.id)),
            episodeCount: episodes.length,
            annualSummary: buildAnnualSummary(episodes, petName, yearKey),
            generatedAt: new Date().toISOString(),
            sourceMode: "derived_episode_v1",
        });
        if (result.sample_bucket_ids.length < 10)
            result.sample_bucket_ids.push(yearBucketId);
    }
    const conditionsSnap = await admin.firestore().collection("clinical_conditions").where("petId", "==", args.petId).limit(limit).get();
    const treatmentsSnap = await admin.firestore().collection("treatments").where("petId", "==", args.petId).limit(limit).get();
    const profileSnapshot = buildProfileSnapshot({
        uid: args.uid,
        petId: args.petId,
        petName,
        petRow,
        conditions: conditionsSnap.docs.map((document) => asRecord(document.data())),
        treatments: treatmentsSnap.docs.map((document) => asRecord(document.data())),
        episodes: episodeDocs,
    });
    if (!dryRun) {
        const deleted = await deleteExistingDerivedDocs({ uid: args.uid, petId: args.petId });
        result.deleted_episodes = deleted.episodes;
        result.deleted_buckets = deleted.buckets;
        result.deleted_profiles = deleted.profiles;
        for (const episode of episodeDocs) {
            await admin.firestore().collection("clinical_episodes").doc(asString(episode.id)).set(episode, { merge: true });
            if (result.sample_episode_ids.length < 10)
                result.sample_episode_ids.push(asString(episode.id));
            if (await maybeProjectAppointmentFromEpisode(episode)) {
                result.appointments_projected += 1;
            }
        }
        for (const bucket of bucketDocs.values()) {
            await admin.firestore().collection("clinical_episode_buckets").doc(asString(bucket.id)).set(bucket, { merge: true });
            result.buckets_written += 1;
        }
        await admin.firestore().collection("clinical_profile_snapshots").doc(asString(profileSnapshot.id)).set(profileSnapshot, { merge: true });
        result.profile_snapshots_written = 1;
    }
    else {
        result.buckets_written = bucketDocs.size;
        result.profile_snapshots_written = 1;
        result.appointments_projected = episodeDocs.filter((episode) => asString(episode.episodeType) === "appointment").length;
        result.sample_episode_ids = episodeDocs.slice(0, 10).map((episode) => asString(episode.id));
    }
    return result;
}
exports.backfillClinicalEpisodes = functions
    .runWith({
    timeoutSeconds: 540,
    memory: "1GB",
    secrets: ["GMAIL_FORCE_SYNC_KEY", "GMAIL_QA_ALLOWED_USER_EMAILS"],
})
    .region("us-central1")
    .https.onRequest(async (req, res) => {
    if (req.method !== "POST") {
        res.status(405).json({ ok: false, error: "method_not_allowed" });
        return;
    }
    const configuredKey = asString(process.env.GMAIL_FORCE_SYNC_KEY);
    const incomingHeader = asString(req.headers["x-force-sync-key"]);
    const authHeader = asString(req.headers.authorization).replace(/^Bearer\s+/i, "");
    const incomingKey = incomingHeader || authHeader;
    if (!configuredKey || !incomingKey || incomingKey !== configuredKey) {
        res.status(401).json({ ok: false, error: "unauthorized" });
        return;
    }
    const body = asRecord(req.body);
    let uid = asString(body.uid);
    const byEmail = asString(body.email).toLowerCase();
    if (!uid && byEmail) {
        const userQuery = await admin.firestore().collection("users").where("email", "==", byEmail).limit(1).get();
        if (!userQuery.empty)
            uid = userQuery.docs[0].id;
    }
    if (!uid) {
        res.status(400).json({ ok: false, error: "uid_or_email_required" });
        return;
    }
    const userSnap = await admin.firestore().collection("users").doc(uid).get();
    const userData = asRecord(userSnap.data());
    const targetEmail = asString(userData.email) || byEmail;
    if (!targetEmail) {
        res.status(404).json({ ok: false, error: "user_email_not_found" });
        return;
    }
    if (!isQaUserAllowed(targetEmail)) {
        res.status(403).json({ ok: false, error: "qa_user_not_allowed" });
        return;
    }
    const petId = asString(body.petId);
    if (!petId) {
        res.status(400).json({ ok: false, error: "petId_required" });
        return;
    }
    try {
        const result = await runClinicalEpisodeBackfill({
            uid,
            email: targetEmail,
            petId,
            dryRun: body.dryRun !== false,
            limit: asNumber(body.limit) || 500,
        });
        res.status(200).json({
            ok: true,
            uid,
            email: targetEmail,
            petId,
            dryRun: body.dryRun !== false,
            result,
        });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        res.status(500).json({ ok: false, error: message });
    }
});
//# sourceMappingURL=episodeCompiler.js.map