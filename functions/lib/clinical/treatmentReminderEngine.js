"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.syncTreatmentTimezoneV3 = exports.evaluateTreatmentDedupV3 = exports.recordDoseEventV3 = exports.markMissedTreatmentDosesV3 = exports.dispatchTreatmentRemindersV3 = exports.onTreatmentWriteScheduleV3 = exports.onMedicationWriteScheduleV3 = void 0;
const admin = require("firebase-admin");
const functions = require("firebase-functions");
const rateLimiter = require("../utils/rateLimiter");
const db = () => admin.firestore();
const messagingClient = () => admin.messaging();
const ONE_MINUTE_MS = 60 * 1000;
const ONE_HOUR_MS = 60 * ONE_MINUTE_MS;
const TWO_HOURS_MS = 2 * ONE_HOUR_MS;
const ONE_DAY_MS = 24 * ONE_HOUR_MS;
const MAX_REMINDERS_PER_TREATMENT = 400;
const MAX_GENERATION_HORIZON_DAYS = 30;
function asRecord(value) {
    if (!value || typeof value !== "object")
        return {};
    return value;
}
function normalizeText(value) {
    if (typeof value !== "string")
        return "";
    return value
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/\s+/g, " ")
        .trim();
}
function slugKey(value) {
    return normalizeText(value).replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "n_a";
}
function parseDateSafe(value) {
    if (typeof value !== "string" || !value.trim())
        return null;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime()))
        return null;
    return parsed;
}
function parseIsoMs(value) {
    const parsed = parseDateSafe(value);
    return parsed ? parsed.getTime() : 0;
}
function formatDateKeyInTz(date, timeZone) {
    const formatter = new Intl.DateTimeFormat("en-CA", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    });
    return formatter.format(date);
}
function parseLocalTimeOrDefault(value) {
    if (typeof value === "string" && /^\d{2}:\d{2}$/.test(value.trim())) {
        const [h, m] = value.trim().split(":").map(Number);
        if (Number.isFinite(h) && Number.isFinite(m)) {
            return { hour: h, minute: m };
        }
    }
    return { hour: 9, minute: 0 };
}
function parseLocalDateTimeToUtc(dateKey, hour, minute, timeZone) {
    const localIso = `${dateKey}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00`;
    const tempDate = new Date(`${localIso}Z`);
    const formatter = new Intl.DateTimeFormat("en-US", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
    });
    const parts = formatter.formatToParts(tempDate);
    const mapped = new Map(parts.map((p) => [p.type, p.value]));
    const reconstructed = `${mapped.get("year")}-${mapped.get("month")}-${mapped.get("day")}T${mapped.get("hour")}:${mapped.get("minute")}:${mapped.get("second")}Z`;
    const reconstructedDate = new Date(reconstructed);
    const offsetMs = reconstructedDate.getTime() - tempDate.getTime();
    return new Date(tempDate.getTime() - offsetMs);
}
function parseFrequencyHours(raw) {
    const text = normalizeText(raw);
    if (!text)
        return null;
    if (/(cronico|indefin|continu)/.test(text))
        return 24;
    const eachMatch = text.match(/(?:cada|c\/|q)\s*(\d+(?:[.,]\d+)?)\s*(?:h|hs|hora|horas)\b/) ||
        text.match(/\b(\d+(?:[.,]\d+)?)\s*(?:h|hs|hora|horas)\b/);
    if (eachMatch) {
        const hours = Number(eachMatch[1].replace(",", "."));
        if (Number.isFinite(hours) && hours > 0)
            return hours;
    }
    const perDayMatch = text.match(/(\d+)\s*veces?\s*al\s*dia/);
    if (perDayMatch) {
        const times = Number(perDayMatch[1]);
        if (Number.isFinite(times) && times > 0) {
            return 24 / times;
        }
    }
    if (/diario|cada 24/.test(text))
        return 24;
    if (/semanal|cada 7 dias/.test(text))
        return 24 * 7;
    if (/mensual|cada 30 dias/.test(text))
        return 24 * 30;
    return null;
}
function parseDosageMagnitude(raw) {
    if (typeof raw !== "string")
        return null;
    const match = raw
        .replace(",", ".")
        .match(/(\d+(?:\.\d+)?)(?:\s*)(mg|ml|comprimido|capsula|tablet|gota|ampolla)?/i);
    if (!match)
        return null;
    const value = Number(match[1]);
    return Number.isFinite(value) ? value : null;
}
function computeDateProximityScore(aIso, bIso) {
    const a = parseDateSafe(aIso);
    const b = parseDateSafe(bIso);
    if (!a || !b)
        return 0;
    const diffDays = Math.abs(a.getTime() - b.getTime()) / ONE_DAY_MS;
    if (diffDays <= 5)
        return 80;
    if (diffDays <= 15)
        return 40;
    return 0;
}
function levenshtein(a, b) {
    if (a === b)
        return 0;
    if (!a.length)
        return b.length;
    if (!b.length)
        return a.length;
    const matrix = Array.from({ length: b.length + 1 }, () => []);
    for (let i = 0; i <= b.length; i += 1)
        matrix[i][0] = i;
    for (let j = 0; j <= a.length; j += 1)
        matrix[0][j] = j;
    for (let i = 1; i <= b.length; i += 1) {
        for (let j = 1; j <= a.length; j += 1) {
            const cost = b[i - 1] === a[j - 1] ? 0 : 1;
            matrix[i][j] = Math.min(matrix[i - 1][j] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j - 1] + cost);
        }
    }
    return matrix[b.length][a.length];
}
function computeNameSimilarity(a, b) {
    const aa = normalizeText(a);
    const bb = normalizeText(b);
    if (!aa || !bb)
        return 0;
    const distance = levenshtein(aa, bb);
    const maxLen = Math.max(aa.length, bb.length);
    const ratio = maxLen > 0 ? 1 - distance / maxLen : 0;
    return Math.max(0, Math.min(100, Math.round(ratio * 100)));
}
function computeDosageSimilarity(aRaw, bRaw) {
    const a = parseDosageMagnitude(aRaw);
    const b = parseDosageMagnitude(bRaw);
    if (!a || !b)
        return 0;
    const pct = Math.abs(a - b) / Math.max(a, b);
    if (pct <= 0.1)
        return 85;
    if (pct <= 0.25)
        return 50;
    return 0;
}
function computeClinicScore(a, b) {
    const aa = normalizeText(a);
    const bb = normalizeText(b);
    if (!aa || !bb)
        return 0;
    if (aa === bb)
        return 100;
    if (aa.includes(bb) || bb.includes(aa))
        return 60;
    return 0;
}
function computeDedupeScore(candidate, existing) {
    const nameScore = computeNameSimilarity(candidate.medicationName, existing.medicationName);
    const dateScore = computeDateProximityScore(candidate.startDateIso, existing.startDateIso);
    const dosageScore = computeDosageSimilarity(candidate.dosage, existing.dosage);
    const clinicScore = computeClinicScore(candidate.clinic, existing.clinic);
    const weighted = (nameScore * 0.4) + (dateScore * 0.3) + (dosageScore * 0.2) + (clinicScore * 0.1);
    return {
        weighted: Math.round(weighted),
        breakdown: {
            nameScore,
            dateScore,
            dosageScore,
            clinicScore,
        },
    };
}
async function getUserTimezone(userId) {
    const userSnap = await db().collection("users").doc(userId).get();
    const userData = asRecord(userSnap.data());
    const timezone = typeof userData.timezone === "string" && userData.timezone.trim()
        ? userData.timezone.trim()
        : "UTC";
    return timezone;
}
async function resolvePetName(petId) {
    if (!petId)
        return "tu mascota";
    const petSnap = await db().collection("pets").doc(petId).get();
    if (!petSnap.exists)
        return "tu mascota";
    const data = asRecord(petSnap.data());
    return (typeof data.name === "string" && data.name.trim()) ? data.name.trim() : "tu mascota";
}
async function canAccessPet(uid, petId) {
    const petSnap = await db().collection("pets").doc(petId).get();
    if (!petSnap.exists)
        return false;
    const data = asRecord(petSnap.data());
    const ownerId = typeof data.ownerId === "string" ? data.ownerId : "";
    const coTutorUids = Array.isArray(data.coTutorUids)
        ? data.coTutorUids.filter((x) => typeof x === "string")
        : [];
    return ownerId === uid || coTutorUids.includes(uid);
}
function extractTreatmentFromMedication(docId, data, timezone) {
    const userId = typeof data.userId === "string" ? data.userId : "";
    const petId = typeof data.petId === "string" ? data.petId : "";
    const medicationName = typeof data.name === "string" ? data.name : "";
    if (!userId || !petId || !medicationName.trim())
        return null;
    const active = data.active !== false;
    if (!active)
        return null;
    const frequency = typeof data.frequency === "string" ? data.frequency : "";
    const intervalHours = parseFrequencyHours(frequency);
    if (!intervalHours || intervalHours <= 0)
        return null;
    const startDateIso = typeof data.startDate === "string" && data.startDate.trim()
        ? data.startDate
        : new Date().toISOString();
    const endDateIso = typeof data.endDate === "string" && data.endDate.trim()
        ? data.endDate
        : null;
    const chronicByMeta = data.endDate == null || /(cronico|indefin|continu)/.test(normalizeText(data.type));
    const isChronic = chronicByMeta || endDateIso == null;
    const petName = typeof data.petName === "string" && data.petName.trim() ? data.petName.trim() : "tu mascota";
    return {
        id: docId,
        userId,
        petId,
        petName,
        medicationName: medicationName.trim(),
        dosage: typeof data.dosage === "string" ? data.dosage : "",
        frequency,
        clinic: typeof data.prescribedBy === "string" ? data.prescribedBy : null,
        startDateIso,
        endDateIso,
        isChronic,
        timezone,
        sourceCollection: "medications",
    };
}
function extractTreatmentFromTreatmentDoc(docId, data, timezone) {
    const userId = typeof data.userId === "string" ? data.userId : "";
    const petId = typeof data.petId === "string" ? data.petId : "";
    const medicationName = typeof data.normalizedName === "string" && data.normalizedName.trim()
        ? data.normalizedName
        : (typeof data.name === "string" ? data.name : "");
    if (!userId || !petId || !medicationName.trim())
        return null;
    const status = normalizeText(data.status);
    if (status && status !== "active")
        return null;
    const frequency = typeof data.frequency === "string" ? data.frequency : "";
    const intervalHours = parseFrequencyHours(frequency);
    if (!intervalHours || intervalHours <= 0)
        return null;
    const startDateIso = typeof data.startDate === "string" && data.startDate.trim()
        ? data.startDate
        : new Date().toISOString();
    const endDateIso = typeof data.endDate === "string" && data.endDate.trim()
        ? data.endDate
        : null;
    const isChronic = endDateIso == null;
    const petName = typeof data.petName === "string" && data.petName.trim() ? data.petName.trim() : "tu mascota";
    return {
        id: docId,
        userId,
        petId,
        petName,
        medicationName: medicationName.trim(),
        dosage: typeof data.dosage === "string" ? data.dosage : "",
        frequency,
        clinic: asRecord(data.clinic).name || null,
        startDateIso,
        endDateIso,
        isChronic,
        timezone,
        sourceCollection: "treatments",
    };
}
async function cancelPendingByTreatment(treatmentId) {
    const [schedSnap, doseSnap] = await Promise.all([
        db().collection("scheduled_reminders")
            .where("treatmentId", "==", treatmentId)
            .where("status", "==", "pending")
            .get(),
        db().collection("dose_events")
            .where("treatmentId", "==", treatmentId)
            .where("status", "==", "pending")
            .get(),
    ]);
    const updates = [];
    schedSnap.docs.forEach((docSnap) => {
        updates.push(docSnap.ref.set({
            status: "cancelled",
            cancelledAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        }, { merge: true }));
    });
    doseSnap.docs.forEach((docSnap) => {
        updates.push(docSnap.ref.set({
            status: "cancelled",
            cancelledAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        }, { merge: true }));
    });
    await Promise.all(updates);
}
async function scheduleFromTreatment(treatment) {
    const intervalHours = parseFrequencyHours(treatment.frequency);
    if (!intervalHours || intervalHours <= 0)
        return;
    await cancelPendingByTreatment(treatment.id);
    const now = new Date();
    const start = parseDateSafe(treatment.startDateIso) || now;
    const end = treatment.endDateIso ? parseDateSafe(treatment.endDateIso) : null;
    const horizonDays = treatment.isChronic
        ? 14
        : Math.min(MAX_GENERATION_HORIZON_DAYS, Math.max(1, Math.ceil((((end === null || end === void 0 ? void 0 : end.getTime()) || now.getTime()) - now.getTime()) / ONE_DAY_MS)));
    const localStartKey = formatDateKeyInTz(start, treatment.timezone);
    const defaultTime = parseLocalTimeOrDefault(start.toISOString().slice(11, 16));
    let nextAt = parseLocalDateTimeToUtc(localStartKey, defaultTime.hour, defaultTime.minute, treatment.timezone);
    const stepMs = Math.round(intervalHours * ONE_HOUR_MS);
    if (stepMs <= 0)
        return;
    while (nextAt.getTime() <= now.getTime()) {
        nextAt = new Date(nextAt.getTime() + stepMs);
    }
    const horizonEnd = new Date(now.getTime() + horizonDays * ONE_DAY_MS);
    const batch = db().batch();
    const createdAt = now.toISOString();
    let generated = 0;
    while (nextAt.getTime() <= horizonEnd.getTime() && generated < MAX_REMINDERS_PER_TREATMENT) {
        if (end && nextAt.getTime() > end.getTime())
            break;
        const ts = nextAt.getTime();
        const doseEventId = `dose_${slugKey(treatment.id)}_${ts}`;
        const reminderId = `sched_${slugKey(treatment.id)}_${ts}`;
        const doseRef = db().collection("dose_events").doc(doseEventId);
        batch.set(doseRef, {
            id: doseEventId,
            treatmentId: treatment.id,
            sourceCollection: treatment.sourceCollection,
            userId: treatment.userId,
            petId: treatment.petId,
            petName: treatment.petName,
            medicationName: treatment.medicationName,
            dosage: treatment.dosage,
            frequency: treatment.frequency,
            dueAt: new Date(ts).toISOString(),
            timezone: treatment.timezone,
            status: "pending",
            createdAt,
            updatedAt: createdAt,
        }, { merge: true });
        const reminderRef = db().collection("scheduled_reminders").doc(reminderId);
        batch.set(reminderRef, {
            id: reminderId,
            treatmentId: treatment.id,
            sourceCollection: treatment.sourceCollection,
            doseEventId,
            userId: treatment.userId,
            petId: treatment.petId,
            petName: treatment.petName,
            medicationName: treatment.medicationName,
            dosage: treatment.dosage,
            frequency: treatment.frequency,
            scheduledFor: new Date(ts).toISOString(),
            timezone: treatment.timezone,
            status: "pending",
            attempts: 0,
            createdAt,
            updatedAt: createdAt,
        }, { merge: true });
        generated += 1;
        nextAt = new Date(nextAt.getTime() + stepMs);
    }
    await batch.commit();
}
async function listUserTokens(userId) {
    const snap = await db().collection("users").doc(userId).collection("fcm_tokens").get();
    return snap.docs
        .map((docSnap) => {
        const data = asRecord(docSnap.data());
        return {
            id: docSnap.id,
            token: typeof data.token === "string" ? data.token.trim() : "",
        };
    })
        .filter((row) => Boolean(row.token));
}
async function sendPushMulticast(args) {
    const tokens = await listUserTokens(args.userId);
    if (tokens.length === 0)
        return { sent: 0, failed: 0 };
    const payload = {
        tokens: tokens.map((t) => t.token),
        notification: {
            title: args.title,
            body: args.body,
        },
        data: args.data,
        webpush: {
            headers: { Urgency: "high" },
            notification: {
                icon: "/pwa-192x192.png",
                badge: "/pwa-192x192.png",
            },
            fcmOptions: {
                link: "/home",
            },
        },
    };
    const response = await messagingClient().sendEachForMulticast(payload);
    const cleanup = [];
    response.responses.forEach((item, index) => {
        var _a;
        if (item.success)
            return;
        const code = ((_a = item.error) === null || _a === void 0 ? void 0 : _a.code) || "";
        if (code.includes("registration-token-not-registered") ||
            code.includes("invalid-argument")) {
            cleanup.push(db().collection("users").doc(args.userId).collection("fcm_tokens").doc(tokens[index].id).delete());
        }
    });
    await Promise.all(cleanup);
    return {
        sent: response.successCount,
        failed: response.failureCount,
    };
}
async function recomputeTreatmentMetrics(treatmentId) {
    const eventsSnap = await db().collection("dose_events").where("treatmentId", "==", treatmentId).get();
    let taken = 0;
    let missed = 0;
    let skipped = 0;
    let pending = 0;
    eventsSnap.docs.forEach((docSnap) => {
        var _a;
        const status = String(((_a = docSnap.data()) === null || _a === void 0 ? void 0 : _a.status) || "pending");
        if (status === "given" || status === "given_late")
            taken += 1;
        else if (status === "missed")
            missed += 1;
        else if (status === "skipped")
            skipped += 1;
        else if (status === "pending")
            pending += 1;
    });
    const totalResolved = taken + missed + skipped;
    const completionPct = totalResolved > 0 ? Math.round((taken / totalResolved) * 100) : 0;
    const payload = {
        adherence: {
            doses_taken: taken,
            doses_missed: missed,
            doses_skipped: skipped,
            doses_pending: pending,
            completion_percentage: completionPct,
            updatedAt: new Date().toISOString(),
        },
    };
    await Promise.all([
        db().collection("treatments").doc(treatmentId).set(payload, { merge: true }).catch(() => undefined),
        db().collection("medications").doc(treatmentId).set(payload, { merge: true }).catch(() => undefined),
    ]);
}
exports.onMedicationWriteScheduleV3 = functions
    .region("us-central1")
    .firestore.document("medications/{medicationId}")
    .onWrite(async (change, context) => {
    const medicationId = context.params.medicationId;
    if (!change.after.exists) {
        await cancelPendingByTreatment(medicationId);
        return null;
    }
    const data = asRecord(change.after.data());
    const userId = typeof data.userId === "string" ? data.userId : "";
    if (!userId)
        return null;
    const timezone = await getUserTimezone(userId);
    const treatment = extractTreatmentFromMedication(medicationId, data, timezone);
    if (!treatment) {
        await cancelPendingByTreatment(medicationId);
        return null;
    }
    await scheduleFromTreatment(treatment);
    return null;
});
exports.onTreatmentWriteScheduleV3 = functions
    .region("us-central1")
    .firestore.document("treatments/{treatmentId}")
    .onWrite(async (change, context) => {
    const treatmentId = context.params.treatmentId;
    if (!change.after.exists) {
        await cancelPendingByTreatment(treatmentId);
        return null;
    }
    const data = asRecord(change.after.data());
    const userId = typeof data.userId === "string" ? data.userId : "";
    if (!userId)
        return null;
    const timezone = await getUserTimezone(userId);
    const treatment = extractTreatmentFromTreatmentDoc(treatmentId, data, timezone);
    if (!treatment) {
        await cancelPendingByTreatment(treatmentId);
        return null;
    }
    await scheduleFromTreatment(treatment);
    return null;
});
exports.dispatchTreatmentRemindersV3 = functions
    .region("us-central1")
    .pubsub.schedule("every 5 minutes")
    .onRun(async () => {
    const now = Date.now();
    const windowEnd = new Date(now + 5 * ONE_MINUTE_MS).toISOString();
    const snap = await db().collection("scheduled_reminders")
        .where("status", "==", "pending")
        .where("scheduledFor", "<=", windowEnd)
        .limit(500)
        .get();
    if (snap.empty)
        return null;
    for (const docSnap of snap.docs) {
        const data = asRecord(docSnap.data());
        const status = String(data.status || "pending");
        if (status !== "pending")
            continue;
        const scheduledMs = parseIsoMs(data.scheduledFor);
        if (!scheduledMs || scheduledMs > now + 5 * ONE_MINUTE_MS)
            continue;
        if (scheduledMs < now - 90 * ONE_MINUTE_MS) {
            await docSnap.ref.set({
                status: "cancelled",
                cancelledAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                cancelReason: "expired_delivery_window",
            }, { merge: true });
            continue;
        }
        const userId = typeof data.userId === "string" ? data.userId : "";
        if (!userId)
            continue;
        const title = `💊 Hora de medicación · ${data.petName || "tu mascota"}`;
        const body = `${data.medicationName || "Tratamiento"}${data.dosage ? ` · ${data.dosage}` : ""}`;
        const send = await sendPushMulticast({
            userId,
            title,
            body,
            data: {
                type: "medication",
                doseEventId: String(data.doseEventId || ""),
                treatmentId: String(data.treatmentId || ""),
                petId: String(data.petId || ""),
            },
        });
        await docSnap.ref.set({
            status: "sent",
            sentAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            attempts: Number(data.attempts || 0) + 1,
            sendStats: send,
        }, { merge: true });
        if (typeof data.doseEventId === "string" && data.doseEventId) {
            await db().collection("dose_events").doc(data.doseEventId).set({
                notifiedAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                status: "pending",
            }, { merge: true });
        }
    }
    return null;
});
exports.markMissedTreatmentDosesV3 = functions
    .region("us-central1")
    .pubsub.schedule("every 30 minutes")
    .onRun(async () => {
    const cutoffIso = new Date(Date.now() - TWO_HOURS_MS).toISOString();
    const snap = await db().collection("dose_events")
        .where("status", "==", "pending")
        .where("dueAt", "<=", cutoffIso)
        .limit(500)
        .get();
    if (snap.empty)
        return null;
    for (const docSnap of snap.docs) {
        const data = asRecord(docSnap.data());
        const status = String(data.status || "pending");
        if (status !== "pending")
            continue;
        await docSnap.ref.set({
            status: "missed",
            missedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            missedReason: "auto_after_2h",
        }, { merge: true });
        const userId = typeof data.userId === "string" ? data.userId : "";
        if (!userId)
            continue;
        await sendPushMulticast({
            userId,
            title: `⚠️ Dosis omitida · ${data.petName || "tu mascota"}`,
            body: `${data.medicationName || "Tratamiento"} quedó marcada como no administrada.`,
            data: {
                type: "medication_missed",
                doseEventId: docSnap.id,
                treatmentId: String(data.treatmentId || ""),
                petId: String(data.petId || ""),
            },
        });
    }
    return null;
});
exports.recordDoseEventV3 = functions
    .region("us-central1")
    .https.onCall(async (data, context) => {
    var _a;
    const uid = (_a = context.auth) === null || _a === void 0 ? void 0 : _a.uid;
    if (!uid) {
        throw new functions.https.HttpsError("unauthenticated", "Debes iniciar sesión.");
    }
    if (!rateLimiter.perUser(uid, 10, 60000))
        throw new functions.https.HttpsError("resource-exhausted", "Too many requests.");
    if (!rateLimiter.globalLimit("recordDoseEventV3", 100, 60000))
        throw new functions.https.HttpsError("resource-exhausted", "Service is busy.");
    const doseEventId = typeof (data === null || data === void 0 ? void 0 : data.doseEventId) === "string" ? data.doseEventId.trim() : "";
    const action = String((data === null || data === void 0 ? void 0 : data.action) || "").trim();
    const reason = typeof (data === null || data === void 0 ? void 0 : data.reason) === "string" ? data.reason.trim().slice(0, 500) : null;
    const snoozeMinutes = Number((data === null || data === void 0 ? void 0 : data.snoozeMinutes) || 30);
    if (!doseEventId) {
        throw new functions.https.HttpsError("invalid-argument", "Falta doseEventId.");
    }
    if (!["given", "given_late", "missed", "skipped", "snoozed"].includes(action)) {
        throw new functions.https.HttpsError("invalid-argument", "Acción inválida.");
    }
    const doseRef = db().collection("dose_events").doc(doseEventId);
    const doseSnap = await doseRef.get();
    if (!doseSnap.exists) {
        throw new functions.https.HttpsError("not-found", "Dosis no encontrada.");
    }
    const dose = asRecord(doseSnap.data());
    const petId = typeof dose.petId === "string" ? dose.petId : "";
    const userId = typeof dose.userId === "string" ? dose.userId : "";
    const treatmentId = typeof dose.treatmentId === "string" ? dose.treatmentId : "";
    const hasAccess = userId === uid || (petId ? await canAccessPet(uid, petId) : false);
    if (!hasAccess) {
        throw new functions.https.HttpsError("permission-denied", "No tienes permiso para esta dosis.");
    }
    const nowIso = new Date().toISOString();
    if (action === "snoozed") {
        const minutes = Number.isFinite(snoozeMinutes) ? Math.max(5, Math.min(240, Math.round(snoozeMinutes))) : 30;
        const nextAt = new Date(Date.now() + minutes * ONE_MINUTE_MS);
        const newDoseEventId = `dose_${slugKey(treatmentId || doseEventId)}_${nextAt.getTime()}`;
        const newReminderId = `sched_${slugKey(treatmentId || doseEventId)}_${nextAt.getTime()}`;
        const batch = db().batch();
        batch.set(doseRef, {
            status: "snoozed",
            updatedAt: nowIso,
            snoozedAt: nowIso,
            snoozeReason: reason || null,
        }, { merge: true });
        batch.set(db().collection("dose_events").doc(newDoseEventId), Object.assign(Object.assign({}, dose), { id: newDoseEventId, dueAt: nextAt.toISOString(), status: "pending", updatedAt: nowIso, createdAt: nowIso, originalDoseEventId: doseEventId }), { merge: true });
        batch.set(db().collection("scheduled_reminders").doc(newReminderId), {
            id: newReminderId,
            treatmentId,
            sourceCollection: dose.sourceCollection || "medications",
            doseEventId: newDoseEventId,
            userId,
            petId,
            petName: dose.petName || "tu mascota",
            medicationName: dose.medicationName || "Tratamiento",
            dosage: dose.dosage || "",
            frequency: dose.frequency || "",
            scheduledFor: nextAt.toISOString(),
            timezone: dose.timezone || "UTC",
            status: "pending",
            attempts: 0,
            createdAt: nowIso,
            updatedAt: nowIso,
        }, { merge: true });
        await batch.commit();
        await recomputeTreatmentMetrics(treatmentId);
        return { ok: true, action, nextDoseEventId: newDoseEventId };
    }
    await doseRef.set({
        status: action,
        updatedAt: nowIso,
        actedAt: nowIso,
        reason: reason || null,
        takenAt: action === "given" || action === "given_late" ? nowIso : null,
    }, { merge: true });
    if (treatmentId) {
        await recomputeTreatmentMetrics(treatmentId);
    }
    if (action === "skipped" && userId) {
        const weekAgoIso = new Date(Date.now() - 7 * ONE_DAY_MS).toISOString();
        const skipSnap = await db().collection("dose_events")
            .where("treatmentId", "==", treatmentId)
            .where("status", "==", "skipped")
            .where("updatedAt", ">=", weekAgoIso)
            .get();
        if (skipSnap.size >= 3) {
            await sendPushMulticast({
                userId,
                title: "⚠️ Atención con omisiones de dosis",
                body: `Detectamos ${skipSnap.size} dosis omitidas esta semana en ${dose.medicationName || "el tratamiento"}.`,
                data: {
                    type: "medication_skip_warning",
                    treatmentId,
                    petId,
                },
            });
        }
    }
    return { ok: true, action };
});
exports.evaluateTreatmentDedupV3 = functions
    .region("us-central1")
    .https.onCall(async (data, context) => {
    var _a;
    if (!((_a = context.auth) === null || _a === void 0 ? void 0 : _a.uid)) {
        throw new functions.https.HttpsError("unauthenticated", "Debes iniciar sesión.");
    }
    if (!rateLimiter.perUser(context.auth.uid, 10, 60000))
        throw new functions.https.HttpsError("resource-exhausted", "Too many requests.");
    if (!rateLimiter.globalLimit("evaluateTreatmentDedupV3", 100, 60000))
        throw new functions.https.HttpsError("resource-exhausted", "Service is busy.");
    const candidate = asRecord(data === null || data === void 0 ? void 0 : data.candidate);
    const existingList = Array.isArray(data === null || data === void 0 ? void 0 : data.existing)
        ? data.existing.map((x) => asRecord(x))
        : [];
    const candidateModel = {
        medicationName: String(candidate.medicationName || candidate.name || ""),
        startDateIso: String(candidate.startDateIso || candidate.startDate || ""),
        dosage: String(candidate.dosage || ""),
        clinic: String(candidate.clinic || ""),
    };
    const scored = existingList.map((item) => {
        const model = {
            medicationName: String(item.medicationName || item.name || ""),
            startDateIso: String(item.startDateIso || item.startDate || ""),
            dosage: String(item.dosage || ""),
            clinic: String(item.clinic || ""),
        };
        const score = computeDedupeScore(candidateModel, model);
        return {
            existing: model,
            score: score.weighted,
            breakdown: score.breakdown,
            requiresReview: score.weighted >= 80,
        };
    }).sort((a, b) => b.score - a.score);
    return {
        threshold: 80,
        top: scored[0] || null,
        all: scored,
        hasPotentialDuplicate: scored.some((row) => row.score >= 80),
    };
});
exports.syncTreatmentTimezoneV3 = functions
    .region("us-central1")
    .https.onCall(async (data, context) => {
    var _a;
    const uid = (_a = context.auth) === null || _a === void 0 ? void 0 : _a.uid;
    if (!uid) {
        throw new functions.https.HttpsError("unauthenticated", "Debes iniciar sesión.");
    }
    if (!rateLimiter.perUser(uid, 10, 60000))
        throw new functions.https.HttpsError("resource-exhausted", "Too many requests.");
    if (!rateLimiter.globalLimit("syncTreatmentTimezoneV3", 100, 60000))
        throw new functions.https.HttpsError("resource-exhausted", "Service is busy.");
    const timezone = typeof (data === null || data === void 0 ? void 0 : data.timezone) === "string" && data.timezone.trim()
        ? data.timezone.trim()
        : "UTC";
    await db().collection("users").doc(uid).set({
        timezone,
        timezoneUpdatedAt: new Date().toISOString(),
    }, { merge: true });
    const medsSnap = await db().collection("medications")
        .where("userId", "==", uid)
        .where("active", "==", true)
        .get();
    let regenerated = 0;
    for (const medDoc of medsSnap.docs) {
        const treatment = extractTreatmentFromMedication(medDoc.id, asRecord(medDoc.data()), timezone);
        if (!treatment)
            continue;
        if (!treatment.petName || treatment.petName === "tu mascota") {
            treatment.petName = await resolvePetName(treatment.petId);
        }
        await scheduleFromTreatment(treatment);
        regenerated += 1;
    }
    return {
        ok: true,
        timezone,
        regenerated,
    };
});
//# sourceMappingURL=treatmentReminderEngine.js.map