"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cleanupOldNotifications = exports.onAppointmentCreated = exports.recomputeClinicalAlertsDaily = exports.reconcileExistingTreatments = exports.sendBroadcastPushCampaigns = exports.sendDailyCareSummary = exports.sendScheduledNotifications = void 0;
const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();
const db = admin.firestore();
const messaging = admin.messaging();
const LAB_LIKE_DOCUMENT_TYPES = new Set(["laboratory_result", "lab_result", "lab_test", "clinical_report"]);
const userSettingsCache = new Map();
const userTokenCache = new Map();
const userTimezoneCache = new Map();
const petNameCache = new Map();
function toDateKeyInTimezone(date, timeZone) {
    const formatter = new Intl.DateTimeFormat("en-CA", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    });
    return formatter.format(date);
}
function parseYmdOrIsoToDateKey(value, timeZone = "UTC") {
    if (typeof value !== "string" || !value.trim())
        return "";
    const trimmed = value.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed))
        return trimmed;
    const parsed = new Date(trimmed);
    if (Number.isNaN(parsed.getTime()))
        return "";
    return toDateKeyInTimezone(parsed, timeZone);
}
function normalizeMedicationName(value) {
    if (typeof value !== "string")
        return "";
    return value
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim();
}
function parseDurationToEndDate(duration, startDateIso) {
    if (typeof duration !== "string" || !duration.trim())
        return null;
    if (typeof startDateIso !== "string" || !startDateIso.trim())
        return null;
    const normalized = duration.toLowerCase().trim();
    if (normalized.includes("cronic") ||
        normalized.includes("indefin") ||
        normalized.includes("continu")) {
        return null;
    }
    const match = normalized.match(/(\d+)\s*(dia|dias|días|semana|semanas|mes|meses)/i);
    if (!match)
        return null;
    const quantity = Number(match[1]);
    if (!Number.isFinite(quantity) || quantity <= 0)
        return null;
    const start = new Date(startDateIso);
    if (Number.isNaN(start.getTime()))
        return null;
    const end = new Date(start);
    const unit = match[2].toLowerCase();
    if (unit.startsWith("dia") || unit.startsWith("día"))
        end.setDate(end.getDate() + quantity);
    if (unit.startsWith("semana"))
        end.setDate(end.getDate() + quantity * 7);
    if (unit.startsWith("mes"))
        end.setMonth(end.getMonth() + quantity);
    return end.toISOString();
}
function isChronicMarker(value) {
    if (typeof value !== "string")
        return false;
    const normalized = value.toLowerCase();
    return normalized.includes("cronic") || normalized.includes("indefin") || normalized.includes("continu");
}
function isTypeEnabled(settings, type) {
    if (settings.enabled === false)
        return false;
    if (type === "medication")
        return settings.medications !== false;
    if (type === "appointment")
        return settings.appointments !== false;
    if (type === "vaccine_reminder")
        return settings.vaccines !== false;
    return true;
}
/**
 * Parsea una fecha y hora local (YYYY-MM-DD y HH:mm) en una zona horaria específica
 * y devuelve un objeto Date en UTC.
 */
function parseLocalToUtc(dateStr, timeStr, timeZone) {
    const localIso = `${dateStr}T${timeStr}:00`;
    // Paso 1: Interpretar el string local como si fuera UTC para obtener un punto de referencia
    const tempDate = new Date(`${localIso}Z`);
    // Paso 2: Ver qué hora "cree" el formateador que es ese punto en la zona destino
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
    const partMap = new Map(parts.map((p) => [p.type, p.value]));
    // Paso 3: Reconstruir la fecha que el formateador devolvió
    const reconstructed = `${partMap.get("year")}-${partMap.get("month")}-${partMap.get("day")}T${partMap.get("hour")}:${partMap.get("minute")}:${partMap.get("second")}Z`;
    const reconstructedDate = new Date(reconstructed);
    // Paso 4: La diferencia entre lo que pedimos y lo que el formateador devolvió es el offset
    const offsetMs = reconstructedDate.getTime() - tempDate.getTime();
    // Paso 5: Aplicar el offset inverso para obtener la fecha UTC real
    return new Date(tempDate.getTime() - offsetMs);
}
async function getUserSettings(userId) {
    var _a;
    if (userSettingsCache.has(userId))
        return userSettingsCache.get(userId);
    const userSnap = await db.collection("users").doc(userId).get();
    const settings = (((_a = userSnap.data()) === null || _a === void 0 ? void 0 : _a.notificationSettings) || {});
    userSettingsCache.set(userId, settings);
    return settings;
}
async function getUserTokenAndTimezone(userId) {
    var _a, _b;
    let token = userTokenCache.get(userId);
    let timezone = userTimezoneCache.get(userId);
    if (token === undefined || !timezone) {
        const tokenDoc = await db
            .collection("users")
            .doc(userId)
            .collection("fcm_tokens")
            .doc("primary")
            .get();
        token = tokenDoc.exists ? ((_a = tokenDoc.data()) === null || _a === void 0 ? void 0 : _a.token) || null : null;
        timezone = tokenDoc.exists ? ((_b = tokenDoc.data()) === null || _b === void 0 ? void 0 : _b.timezone) || "UTC" : "UTC";
        userTokenCache.set(userId, token);
        userTimezoneCache.set(userId, timezone);
    }
    return { token: token || null, timezone: timezone || "UTC" };
}
async function resolvePetName(petId) {
    var _a;
    if (!petId)
        return "tu mascota";
    if (petNameCache.has(petId))
        return petNameCache.get(petId);
    const petSnap = await db.collection("pets").doc(petId).get();
    const name = petSnap.exists ? ((_a = petSnap.data()) === null || _a === void 0 ? void 0 : _a.name) || "tu mascota" : "tu mascota";
    petNameCache.set(petId, name);
    return name;
}
async function sendPushMessage(args) {
    const message = {
        token: args.token,
        notification: {
            title: args.title,
            body: args.body,
        },
        data: {
            notificationId: args.notificationId || "",
            type: args.type || "general",
            petId: args.petId || "",
            petName: args.petName || "",
            sourceEventId: args.sourceEventId || "",
        },
        android: {
            priority: "high",
            notification: {
                channelId: "pessy_reminders",
                priority: "high",
                defaultVibrateTimings: true,
                icon: "ic_notification",
            },
        },
        apns: {
            payload: {
                aps: {
                    sound: "default",
                    badge: 1,
                    contentAvailable: true,
                },
            },
        },
        webpush: {
            headers: { Urgency: "high" },
            notification: {
                icon: "/pwa-192x192.png",
                badge: "/pwa-192x192.png",
                requireInteraction: true,
                actions: [
                    { action: "view", title: "Ver detalles" },
                    { action: "dismiss", title: "Descartar" },
                ],
            },
        },
    };
    await messaging.send(message);
}
function chunkItems(items, size) {
    if (size <= 0)
        return [items];
    const chunks = [];
    for (let i = 0; i < items.length; i += size) {
        chunks.push(items.slice(i, i + size));
    }
    return chunks;
}
function toStringDataRecord(value) {
    if (!value || typeof value !== "object")
        return {};
    const entries = Object.entries(value);
    const out = {};
    for (const [key, raw] of entries) {
        if (raw == null)
            continue;
        if (typeof raw === "string")
            out[key] = raw;
        else if (typeof raw === "number" || typeof raw === "boolean")
            out[key] = String(raw);
        else
            out[key] = JSON.stringify(raw);
    }
    return out;
}
function asRecord(value) {
    if (!value || typeof value !== "object")
        return {};
    return value;
}
function slugifyKey(value) {
    if (typeof value !== "string")
        return "unknown";
    return value
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "")
        .trim() || "unknown";
}
function buildAlertId(petId, ruleId, scopeKey) {
    return `alt_${petId}_${slugifyKey(ruleId)}_${slugifyKey(scopeKey)}`;
}
function parseEventTimestamp(event) {
    const extracted = asRecord(event.extractedData);
    const candidate = event.eventDate || extracted.eventDate || event.createdAt || "";
    const ts = Date.parse(candidate);
    return Number.isNaN(ts) ? 0 : ts;
}
function getEventDocumentType(event) {
    const extracted = asRecord(event.extractedData);
    const raw = (event.documentType || extracted.documentType || "").toString().toLowerCase().trim();
    return raw;
}
function hasFollowupKeyword(text) {
    if (typeof text !== "string")
        return false;
    const normalized = text
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
    return /(control|recheck|re chequeo|seguimiento|cardio|presion|consulta|turno|revision)/i.test(normalized);
}
function extractRecommendations(event) {
    const extracted = asRecord(event.extractedData);
    const master = asRecord(extracted.masterClinical);
    const fromTop = Array.isArray(event.recommendations) ? event.recommendations : [];
    const fromMaster = Array.isArray(master.recommendations) ? master.recommendations : [];
    const fromLegacy = [extracted.nextAppointmentReason];
    return [...fromTop, ...fromMaster, ...fromLegacy]
        .filter((item) => typeof item === "string")
        .map((item) => String(item).trim())
        .filter(Boolean);
}
function extractAbnormalFindings(event) {
    const findings = [];
    const topLevel = Array.isArray(event.abnormalFindings) ? event.abnormalFindings : [];
    for (const row of topLevel) {
        const item = asRecord(row);
        const parameter = typeof item.parameter === "string" ? item.parameter.trim() : "";
        const status = typeof item.status === "string" ? item.status.trim().toLowerCase() : "";
        if (!parameter || !status)
            continue;
        if (status === "alto" || status === "bajo" || status === "alterado") {
            findings.push({ parameter, status });
        }
    }
    if (findings.length > 0)
        return findings;
    const extracted = asRecord(event.extractedData);
    const measurements = Array.isArray(extracted.measurements) ? extracted.measurements : [];
    for (const row of measurements) {
        const item = asRecord(row);
        const parameter = typeof item.name === "string" ? item.name.trim() : "";
        const range = typeof item.referenceRange === "string" ? item.referenceRange.toLowerCase() : "";
        let status = "";
        if (range.includes("alto") || range.includes("elevado") || range.includes("high"))
            status = "alto";
        if (range.includes("bajo") || range.includes("low") || range.includes("disminuido"))
            status = "bajo";
        if (range.includes("alterado") || range.includes("abnormal"))
            status = "alterado";
        if (!parameter || !status)
            continue;
        findings.push({ parameter, status });
    }
    return findings;
}
async function upsertClinicalAlert(alert) {
    const ref = db.collection("clinical_alerts").doc(alert.id);
    const prevSnap = await ref.get();
    if (!prevSnap.exists) {
        await ref.set(alert);
        return;
    }
    const prev = prevSnap.data();
    const uniq = (items = []) => Array.from(new Set(items.filter(Boolean)));
    await ref.set(Object.assign(Object.assign(Object.assign({}, prev), alert), { triggeredOn: prev.triggeredOn || alert.triggeredOn, lastSeenOn: alert.lastSeenOn, status: alert.status, linkedConditionIds: uniq([...(prev.linkedConditionIds || []), ...(alert.linkedConditionIds || [])]), linkedEventIds: uniq([...(prev.linkedEventIds || []), ...(alert.linkedEventIds || [])]), linkedAppointmentIds: uniq([...(prev.linkedAppointmentIds || []), ...(alert.linkedAppointmentIds || [])]) }), { merge: true });
}
async function resolveClinicalAlert(alertId, notes, nowIso) {
    const ref = db.collection("clinical_alerts").doc(alertId);
    const snap = await ref.get();
    if (!snap.exists)
        return;
    const current = snap.data();
    if (current.status !== "active")
        return;
    await ref.update({
        status: "resolved",
        resolutionNotes: notes,
        lastSeenOn: nowIso,
    });
}
// ─────────────────────────────────────────────────────────────────────────────
// CRON: Revisa cada 15 minutos si hay notificaciones pendientes para enviar
// ─────────────────────────────────────────────────────────────────────────────
exports.sendScheduledNotifications = functions.pubsub
    .schedule("every 15 minutes")
    .onRun(async () => {
    const now = new Date();
    const windowEnd = new Date(now.getTime() + 15 * 60 * 1000);
    const nowIso = now.toISOString();
    console.log(`[CRON] Revisando notificaciones hasta ${windowEnd.toISOString()}`);
    const snapshot = await db
        .collection("scheduled_notifications")
        .where("active", "==", true)
        .where("sent", "==", false)
        .where("scheduledFor", "<=", windowEnd.toISOString())
        .get();
    if (snapshot.empty) {
        console.log("[CRON] Sin notificaciones pendientes");
        return null;
    }
    const uniqueDocs = [];
    const seenKeys = new Set();
    for (const docSnap of snapshot.docs) {
        const data = docSnap.data();
        const dedupeKey = [
            data.repeatRootId || data.sourceMedicationId || docSnap.id,
            data.userId || "",
            data.petId || "",
            data.type || "",
            data.scheduledFor || "",
        ].join("|");
        if (seenKeys.has(dedupeKey)) {
            await docSnap.ref.update({ sent: true, sentAt: nowIso, skipped: "duplicate_window" });
            continue;
        }
        seenKeys.add(dedupeKey);
        uniqueDocs.push(docSnap);
    }
    console.log(`[CRON] ${uniqueDocs.length} notificaciones únicas a enviar`);
    const results = await Promise.allSettled(uniqueDocs.map(async (docSnap) => {
        const notification = docSnap.data();
        const userId = notification.userId || "";
        const type = notification.type || "medication";
        if (!userId) {
            await docSnap.ref.update({ sent: true, sentAt: nowIso, error: "missing_user" });
            return;
        }
        const settings = await getUserSettings(userId);
        if (!isTypeEnabled(settings, type)) {
            await docSnap.ref.update({ sent: true, sentAt: nowIso, skipped: "settings_disabled" });
            return;
        }
        const { token } = await getUserTokenAndTimezone(userId);
        if (!token) {
            console.warn(`[CRON] Sin token para usuario ${userId}`);
            await docSnap.ref.update({ sent: true, sentAt: nowIso, error: "no_token" });
            return;
        }
        await sendPushMessage({
            token,
            title: notification.title || "Pessy",
            body: notification.body || "",
            type,
            petId: notification.petId,
            petName: notification.petName,
            sourceEventId: notification.sourceEventId,
            notificationId: docSnap.id,
        });
        await docSnap.ref.update({ sent: true, sentAt: nowIso });
        if (notification.repeat !== "none" && Number(notification.repeatInterval) > 0) {
            const currentScheduled = new Date(notification.scheduledFor);
            const nextDate = new Date(currentScheduled.getTime() + Number(notification.repeatInterval) * 3600000);
            if (!Number.isNaN(nextDate.getTime())) {
                const endAtRaw = notification.endAt;
                const endAt = endAtRaw ? new Date(endAtRaw) : null;
                const shouldScheduleNext = !endAt || nextDate.getTime() <= endAt.getTime();
                if (shouldScheduleNext) {
                    const repeatRootId = notification.repeatRootId || docSnap.id;
                    const nextDocId = `${repeatRootId}_${nextDate.getTime()}`;
                    await db.collection("scheduled_notifications").doc(nextDocId).set({
                        userId,
                        petId: notification.petId || "",
                        petName: notification.petName || "Tu mascota",
                        type,
                        title: notification.title || "Pessy",
                        body: notification.body || "",
                        scheduledFor: nextDate.toISOString(),
                        sourceEventId: notification.sourceEventId || null,
                        sourceMedicationId: notification.sourceMedicationId || null,
                        repeat: notification.repeat || "none",
                        repeatInterval: Number(notification.repeatInterval) || null,
                        repeatRootId,
                        endAt: endAtRaw || null,
                        active: true,
                        sent: false,
                        createdAt: nowIso,
                    });
                }
            }
        }
        console.log(`[CRON] ✅ Enviada: ${notification.title} → ${notification.petName}`);
    }));
    const failed = results.filter((r) => r.status === "rejected");
    if (failed.length > 0) {
        console.error(`[CRON] ${failed.length} notificaciones fallaron`);
    }
    return null;
});
// ─────────────────────────────────────────────────────────────────────────────
// CRON: Avisos diarios core ("hoy toca medicación" / "hoy toca turno")
// ─────────────────────────────────────────────────────────────────────────────
exports.sendDailyCareSummary = functions.pubsub
    .schedule("every 60 minutes")
    .onRun(async () => {
    const now = new Date();
    const usersSnap = await db.collection("users").get();
    if (usersSnap.empty)
        return null;
    const sends = [];
    for (const userDoc of usersSnap.docs) {
        const userId = userDoc.id;
        const settings = await getUserSettings(userId);
        if (settings.enabled === false)
            continue;
        const { token, timezone } = await getUserTokenAndTimezone(userId);
        if (!token)
            continue;
        const localHour = Number(new Intl.DateTimeFormat("en-GB", {
            timeZone: timezone,
            hour: "2-digit",
            hour12: false,
        }).format(now));
        // Ventana de envío diaria: mañana.
        if (localHour < 7 || localHour > 10)
            continue;
        const todayKey = toDateKeyInTimezone(now, timezone);
        if (settings.appointments !== false) {
            const appointmentsSnap = await db.collection("appointments").where("userId", "==", userId).get();
            const appointmentsToday = appointmentsSnap.docs
                .map((d) => (Object.assign({ id: d.id }, d.data())))
                .filter((a) => (a.status || "upcoming") === "upcoming" && (a.date || "") === todayKey);
            for (const appointment of appointmentsToday) {
                const logId = `daily_turno_${appointment.id}_${todayKey}`;
                const logRef = db.collection("daily_notification_logs").doc(logId);
                const logSnap = await logRef.get();
                if (logSnap.exists)
                    continue;
                const title = `📌 Hoy toca turno — ${appointment.petName || "tu mascota"}`;
                const body = `${appointment.title || "Consulta"}${appointment.time ? ` a las ${appointment.time}` : ""}`;
                sends.push(sendPushMessage({
                    token,
                    title,
                    body,
                    type: "appointment",
                    petId: appointment.petId,
                    petName: appointment.petName,
                    sourceEventId: appointment.sourceEventId || appointment.id,
                }).then(() => logRef.set({ userId, kind: "appointment", petId: appointment.petId || "", date: todayKey, sentAt: now.toISOString() })));
            }
        }
        if (settings.medications !== false) {
            const medsSnap = await db.collection("medications").where("userId", "==", userId).get();
            const activeByPet = new Map();
            for (const medDoc of medsSnap.docs) {
                const med = medDoc.data();
                if (med.active === false)
                    continue;
                const startKey = parseYmdOrIsoToDateKey(med.startDate, timezone);
                const endKey = parseYmdOrIsoToDateKey(med.endDate, timezone);
                const isActiveToday = startKey && startKey <= todayKey && (!endKey || endKey >= todayKey);
                if (!isActiveToday)
                    continue;
                const petId = med.petId || "unknown_pet";
                const existing = activeByPet.get(petId);
                const resolvedName = med.petName || (await resolvePetName(petId));
                activeByPet.set(petId, {
                    petName: resolvedName || (existing === null || existing === void 0 ? void 0 : existing.petName) || "tu mascota",
                    count: ((existing === null || existing === void 0 ? void 0 : existing.count) || 0) + 1,
                });
            }
            for (const [petId, info] of activeByPet.entries()) {
                const logId = `daily_med_${userId}_${petId}_${todayKey}`;
                const logRef = db.collection("daily_notification_logs").doc(logId);
                const logSnap = await logRef.get();
                if (logSnap.exists)
                    continue;
                const title = `💊 Hoy toca medicación — ${info.petName}`;
                const body = info.count === 1
                    ? "Tenés 1 tratamiento activo para hoy."
                    : `Tenés ${info.count} tratamientos activos para hoy.`;
                sends.push(sendPushMessage({
                    token,
                    title,
                    body,
                    type: "medication",
                    petId,
                    petName: info.petName,
                }).then(() => logRef.set({ userId, kind: "medication", petId, date: todayKey, sentAt: now.toISOString() })));
            }
        }
    }
    const results = await Promise.allSettled(sends);
    const failed = results.filter((r) => r.status === "rejected");
    if (failed.length > 0) {
        console.error(`[DAILY] ${failed.length} envíos diarios fallaron`);
    }
    return null;
});
// ─────────────────────────────────────────────────────────────────────────────
// CRON: campañas push masivas
// Cargar en Firestore (colección "broadcast_push_campaigns") un doc con:
// {
//   active: true,
//   sent: false,
//   sendAt: "<ISO>",
//   title: "Activá notificaciones en PESSY",
//   body: "Entrá a Perfil > Notificaciones y activalas para recibir recordatorios.",
//   data: { cta: "open_notifications_settings" }
// }
// ─────────────────────────────────────────────────────────────────────────────
exports.sendBroadcastPushCampaigns = functions.pubsub
    .schedule("every 15 minutes")
    .onRun(async () => {
    const nowIso = new Date().toISOString();
    const campaignsSnap = await db
        .collection("broadcast_push_campaigns")
        .where("active", "==", true)
        .where("sent", "==", false)
        .where("sendAt", "<=", nowIso)
        .get();
    if (campaignsSnap.empty) {
        return null;
    }
    const tokenDocs = await db.collectionGroup("fcm_tokens").get();
    const tokenEntries = [];
    const seenTokens = new Set();
    for (const tokenDoc of tokenDocs.docs) {
        const data = tokenDoc.data();
        const token = typeof data.token === "string" ? data.token.trim() : "";
        if (!token || seenTokens.has(token))
            continue;
        seenTokens.add(token);
        tokenEntries.push({
            token,
            ref: tokenDoc.ref,
            platform: typeof data.platform === "string" ? data.platform : "web",
        });
    }
    if (tokenEntries.length === 0) {
        await Promise.all(campaignsSnap.docs.map((doc) => doc.ref.update({
            sent: true,
            sentAt: nowIso,
            totalTokens: 0,
            successCount: 0,
            failureCount: 0,
            invalidTokenCount: 0,
            warning: "no_tokens",
        })));
        return null;
    }
    for (const campaignDoc of campaignsSnap.docs) {
        const campaign = campaignDoc.data();
        const title = campaign.title || "PESSY";
        const body = campaign.body || "";
        const extraData = toStringDataRecord(campaign.data || {});
        const audience = campaign.audience || "all";
        const selectedTokens = tokenEntries
            .filter((entry) => {
            if (audience === "all")
                return true;
            return entry.platform === audience;
        })
            .map((entry) => entry.token);
        if (selectedTokens.length === 0) {
            await campaignDoc.ref.update({
                sent: true,
                sentAt: nowIso,
                totalTokens: 0,
                successCount: 0,
                failureCount: 0,
                invalidTokenCount: 0,
                warning: "no_tokens_for_audience",
            });
            continue;
        }
        const tokenChunks = chunkItems(selectedTokens, 500);
        let successCount = 0;
        let failureCount = 0;
        const invalidTokens = new Set();
        for (const tokenChunk of tokenChunks) {
            const response = await messaging.sendEachForMulticast({
                tokens: tokenChunk,
                notification: { title, body },
                data: Object.assign({ campaignId: campaignDoc.id, type: "broadcast" }, extraData),
                android: {
                    priority: "high",
                    notification: {
                        channelId: "pessy_reminders",
                        priority: "high",
                        defaultVibrateTimings: true,
                        icon: "ic_notification",
                    },
                },
                apns: {
                    payload: {
                        aps: {
                            sound: "default",
                            badge: 1,
                            contentAvailable: true,
                        },
                    },
                },
                webpush: {
                    headers: { Urgency: "high" },
                    notification: {
                        icon: "/pwa-192x192.png",
                        badge: "/pwa-192x192.png",
                        requireInteraction: true,
                    },
                },
            });
            successCount += response.successCount;
            failureCount += response.failureCount;
            response.responses.forEach((sendResponse, idx) => {
                var _a;
                if (sendResponse.success)
                    return;
                const code = ((_a = sendResponse.error) === null || _a === void 0 ? void 0 : _a.code) || "";
                if (code === "messaging/registration-token-not-registered" ||
                    code === "messaging/invalid-registration-token") {
                    invalidTokens.add(tokenChunk[idx]);
                }
            });
        }
        if (invalidTokens.size > 0) {
            const invalidRefs = tokenEntries
                .filter((entry) => invalidTokens.has(entry.token))
                .map((entry) => entry.ref);
            await Promise.all(invalidRefs.map((ref) => ref.delete()));
        }
        await campaignDoc.ref.update({
            sent: true,
            sentAt: nowIso,
            totalTokens: selectedTokens.length,
            successCount,
            failureCount,
            invalidTokenCount: invalidTokens.size,
        });
    }
    return null;
});
// ─────────────────────────────────────────────────────────────────────────────
// CRON: Reconciliación de tratamientos existentes
// - Completa frecuencia/fin usando el documento médico fuente cuando falta.
// - Si no alcanza la info, crea pendiente y avisa al usuario.
// ─────────────────────────────────────────────────────────────────────────────
exports.reconcileExistingTreatments = functions.pubsub
    .schedule("every 6 hours")
    .onRun(async () => {
    var _a, _b;
    const now = new Date();
    const nowIso = now.toISOString();
    const medsSnap = await db
        .collection("medications")
        .where("active", "==", true)
        .get();
    if (medsSnap.empty)
        return null;
    let patched = 0;
    let reviewQueued = 0;
    let notified = 0;
    for (const medDoc of medsSnap.docs) {
        const med = medDoc.data();
        const userId = med.userId || "";
        const petId = med.petId || "";
        if (!userId || !petId)
            continue;
        const hasFrequency = typeof med.frequency === "string" && med.frequency.trim().length > 0;
        const hasEndDate = typeof med.endDate === "string" && med.endDate.trim().length > 0;
        if (hasFrequency && (hasEndDate || isChronicMarker(med.frequency)))
            continue;
        let nextFrequency = hasFrequency ? String(med.frequency) : "";
        let nextEndDate = hasEndDate ? String(med.endDate) : null;
        const sourceEventId = med.generatedFromEventId || "";
        if (sourceEventId) {
            const eventSnap = await db.collection("medical_events").doc(sourceEventId).get();
            if (eventSnap.exists) {
                const event = eventSnap.data();
                const extracted = (event.extractedData || {});
                const medsExtracted = Array.isArray(extracted.medications) ? extracted.medications : [];
                const targetName = normalizeMedicationName(med.name);
                const matched = medsExtracted.find((item) => normalizeMedicationName(item === null || item === void 0 ? void 0 : item.name) === targetName)
                    || medsExtracted[0];
                if (matched) {
                    if (!hasFrequency && typeof matched.frequency === "string" && matched.frequency.trim()) {
                        nextFrequency = matched.frequency.trim();
                    }
                    if (!hasEndDate && !isChronicMarker(nextFrequency)) {
                        const startDate = (typeof med.startDate === "string" && med.startDate.trim())
                            ? med.startDate
                            : (typeof extracted.eventDate === "string" && extracted.eventDate.trim())
                                ? extracted.eventDate
                                : (typeof event.createdAt === "string" ? event.createdAt : nowIso);
                        const inferredEndDate = parseDurationToEndDate(matched.duration, startDate);
                        if (inferredEndDate) {
                            nextEndDate = inferredEndDate;
                        }
                    }
                }
            }
        }
        const patch = {};
        if (!hasFrequency && nextFrequency)
            patch.frequency = nextFrequency;
        if (!hasEndDate && nextEndDate)
            patch.endDate = nextEndDate;
        if (Object.keys(patch).length > 0) {
            patch.updatedAt = nowIso;
            patch.metadataReconciledAt = nowIso;
            await medDoc.ref.update(patch);
            patched += 1;
        }
        const resolvedFrequency = (_a = patch.frequency) !== null && _a !== void 0 ? _a : med.frequency;
        const resolvedEndDate = (_b = patch.endDate) !== null && _b !== void 0 ? _b : med.endDate;
        const stillMissingFrequency = !(typeof resolvedFrequency === "string" && String(resolvedFrequency).trim());
        const stillMissingEnd = !isChronicMarker(String(resolvedFrequency || "")) &&
            !(typeof resolvedEndDate === "string" && String(resolvedEndDate).trim());
        if (!stillMissingFrequency && !stillMissingEnd)
            continue;
        const pendingId = `med_review_${medDoc.id}`;
        const pendingRef = db.collection("pending_actions").doc(pendingId);
        const pendingSnap = await pendingRef.get();
        if (!pendingSnap.exists) {
            await pendingRef.set({
                petId,
                userId,
                type: "follow_up",
                title: `Completar tratamiento: ${med.name || "Medicacion"}`,
                subtitle: "Falta confirmar frecuencia o duracion para recordatorios precisos.",
                dueDate: nowIso,
                createdAt: nowIso,
                generatedFromEventId: sourceEventId || null,
                autoGenerated: true,
                completed: false,
                completedAt: null,
                reminderEnabled: true,
                reminderDaysBefore: 0,
            });
            reviewQueued += 1;
        }
        const { token, timezone } = await getUserTokenAndTimezone(userId);
        const settings = await getUserSettings(userId);
        if (!token || !isTypeEnabled(settings, "medication"))
            continue;
        const dateKey = toDateKeyInTimezone(now, timezone);
        const notifyLogId = `med_reconcile_prompt_${medDoc.id}_${dateKey}`;
        const notifyLogRef = db.collection("daily_notification_logs").doc(notifyLogId);
        const notifyLogSnap = await notifyLogRef.get();
        if (notifyLogSnap.exists)
            continue;
        await sendPushMessage({
            token,
            title: `📝 Revisá un tratamiento de ${await resolvePetName(petId)}`,
            body: "Falta confirmar frecuencia o duración para activar recordatorios correctos.",
            type: "medication",
            petId,
            petName: await resolvePetName(petId),
            sourceEventId: sourceEventId || medDoc.id,
        });
        await notifyLogRef.set({
            userId,
            kind: "medication_reconcile",
            petId,
            medicationId: medDoc.id,
            date: dateKey,
            sentAt: nowIso,
        });
        notified += 1;
    }
    console.log(`[RECONCILE] patched=${patched} reviewQueued=${reviewQueued} notified=${notified}`);
    return null;
});
// ─────────────────────────────────────────────────────────────────────────────
// CRON: Recalcula alertas clínicas persistentes desde entidades consolidadas
// - No relee PDFs
// - Reevalúa R1/R2/R3/R4 una vez por día
// ─────────────────────────────────────────────────────────────────────────────
exports.recomputeClinicalAlertsDaily = functions.pubsub
    .schedule("every 24 hours")
    .onRun(async () => {
    const now = new Date();
    const nowIso = now.toISOString();
    const nowTs = now.getTime();
    const recentWindowMs = 120 * 24 * 3600000;
    const followupWindowMs = 45 * 24 * 3600000;
    const treatmentFollowupGapMs = 45 * 24 * 3600000;
    const [petsSnap, conditionsSnap, treatmentsSnap, appointmentsSnap, eventsSnap, activeAlertsSnap] = await Promise.all([
        db.collection("pets").get(),
        db.collection("clinical_conditions").get(),
        db.collection("treatments").get(),
        db.collection("appointments").get(),
        db.collection("medical_events").get(),
        db.collection("clinical_alerts").where("status", "==", "active").get(),
    ]);
    if (petsSnap.empty)
        return null;
    const petIds = new Set(petsSnap.docs.map((docSnap) => docSnap.id));
    const conditionsByPet = new Map();
    conditionsSnap.docs.forEach((docSnap) => {
        const row = Object.assign({ id: docSnap.id }, docSnap.data());
        if (!row.petId)
            return;
        const list = conditionsByPet.get(row.petId) || [];
        list.push(row);
        conditionsByPet.set(row.petId, list);
        petIds.add(row.petId);
    });
    const treatmentsByPet = new Map();
    treatmentsSnap.docs.forEach((docSnap) => {
        const row = Object.assign({ id: docSnap.id }, docSnap.data());
        if (!row.petId)
            return;
        const list = treatmentsByPet.get(row.petId) || [];
        list.push(row);
        treatmentsByPet.set(row.petId, list);
        petIds.add(row.petId);
    });
    const appointmentsByPet = new Map();
    appointmentsSnap.docs.forEach((docSnap) => {
        const row = Object.assign({ id: docSnap.id }, docSnap.data());
        if (!row.petId)
            return;
        const list = appointmentsByPet.get(row.petId) || [];
        list.push(row);
        appointmentsByPet.set(row.petId, list);
        petIds.add(row.petId);
    });
    const eventsByPet = new Map();
    eventsSnap.docs.forEach((docSnap) => {
        const row = Object.assign({ id: docSnap.id }, docSnap.data());
        const petId = typeof row.petId === "string" ? row.petId : "";
        if (!petId)
            return;
        const list = eventsByPet.get(petId) || [];
        list.push(row);
        eventsByPet.set(petId, list);
        petIds.add(petId);
    });
    const activeAlertsByPet = new Map();
    activeAlertsSnap.docs.forEach((docSnap) => {
        const row = Object.assign({ id: docSnap.id }, docSnap.data());
        if (!row.petId)
            return;
        const list = activeAlertsByPet.get(row.petId) || [];
        list.push(row);
        activeAlertsByPet.set(row.petId, list);
        petIds.add(row.petId);
    });
    let upserted = 0;
    let resolved = 0;
    for (const petId of petIds) {
        const petConditions = conditionsByPet.get(petId) || [];
        const petTreatments = treatmentsByPet.get(petId) || [];
        const petAppointments = appointmentsByPet.get(petId) || [];
        const petEvents = eventsByPet.get(petId) || [];
        const petActiveAlerts = activeAlertsByPet.get(petId) || [];
        // R1: laboratorio fuera de rango (solo con eventos lab/clinical)
        const latestLabEvent = [...petEvents]
            .filter((event) => LAB_LIKE_DOCUMENT_TYPES.has(getEventDocumentType(event)))
            .sort((a, b) => parseEventTimestamp(b) - parseEventTimestamp(a))[0];
        const currentOutOfRangeAlertIds = new Set();
        const abnormalFindings = latestLabEvent ? extractAbnormalFindings(latestLabEvent) : [];
        if (abnormalFindings.length > 0) {
            for (const finding of abnormalFindings) {
                const alertId = buildAlertId(petId, "R1_out_of_range", finding.parameter);
                currentOutOfRangeAlertIds.add(alertId);
                await upsertClinicalAlert({
                    id: alertId,
                    petId,
                    type: "out_of_range",
                    severity: "medium",
                    title: `Valor fuera de rango: ${finding.parameter}`,
                    description: `${finding.parameter} reportado como ${finding.status}. Revisar seguimiento clínico.`,
                    triggeredOn: nowIso,
                    lastSeenOn: nowIso,
                    status: "active",
                    resolutionNotes: null,
                    linkedConditionIds: [],
                    linkedEventIds: (latestLabEvent === null || latestLabEvent === void 0 ? void 0 : latestLabEvent.id) ? [String(latestLabEvent.id)] : [],
                    linkedAppointmentIds: [],
                    ruleId: "R1_out_of_range",
                });
                upserted += 1;
            }
        }
        for (const alert of petActiveAlerts) {
            if (alert.type !== "out_of_range")
                continue;
            if (currentOutOfRangeAlertIds.has(alert.id))
                continue;
            await resolveClinicalAlert(alert.id, "No persiste hallazgo alterado en el último control de laboratorio.", nowIso);
            resolved += 1;
        }
        // R2: condición persistente
        for (const condition of petConditions) {
            const occurrences = Number(condition.occurrencesCount || 0);
            const lastSeenTs = Date.parse(condition.lastDetectedDate || "");
            const recentEnough = !Number.isNaN(lastSeenTs) && nowTs - lastSeenTs <= recentWindowMs;
            const conditionScope = condition.normalizedName || condition.id;
            const alertId = buildAlertId(petId, "R2_condition_persistent", conditionScope);
            const isPersistent = occurrences >= 2 && recentEnough;
            if (isPersistent) {
                await upsertClinicalAlert({
                    id: alertId,
                    petId,
                    type: "condition_persistent",
                    severity: condition.pattern === "chronic" ? "high" : "medium",
                    title: `Condición persistente: ${condition.normalizedName || "sin nombre"}`,
                    description: `Detectada ${occurrences} veces entre ${condition.firstDetectedDate || "—"} y ${condition.lastDetectedDate || "—"}.`,
                    triggeredOn: nowIso,
                    lastSeenOn: nowIso,
                    status: "active",
                    resolutionNotes: null,
                    linkedConditionIds: [condition.id],
                    linkedEventIds: [],
                    linkedAppointmentIds: [],
                    ruleId: "R2_condition_persistent",
                });
                upserted += 1;
            }
            else {
                await resolveClinicalAlert(alertId, "No cumple criterio actual de persistencia clínica.", nowIso);
                resolved += 1;
            }
        }
        // R3: seguimiento recomendado sin turno futuro
        const followupEvents = petEvents.filter((event) => {
            const eventTs = parseEventTimestamp(event);
            if (eventTs <= 0 || nowTs - eventTs > recentWindowMs)
                return false;
            return extractRecommendations(event).some(hasFollowupKeyword);
        });
        const hasUpcomingAppointment = petAppointments.some((appointment) => {
            const status = (appointment.status || "").toLowerCase();
            if (status && status !== "upcoming" && status !== "programado" && status !== "confirmado")
                return false;
            if (!appointment.date)
                return false;
            const appointmentTs = Date.parse(`${appointment.date}T${appointment.time || "00:00"}:00`);
            if (Number.isNaN(appointmentTs))
                return false;
            return appointmentTs >= nowTs && appointmentTs <= nowTs + followupWindowMs;
        });
        const followupAlertId = buildAlertId(petId, "R3_followup_not_scheduled", "pet_followup");
        if (followupEvents.length > 0 && !hasUpcomingAppointment) {
            const linkedEventIds = followupEvents
                .map((event) => (typeof event.id === "string" ? event.id : ""))
                .filter(Boolean);
            await upsertClinicalAlert({
                id: followupAlertId,
                petId,
                type: "followup_not_scheduled",
                severity: "medium",
                title: "Seguimiento recomendado sin turno agendado",
                description: "Hay recomendación de control sin cita futura dentro de la ventana sugerida.",
                triggeredOn: nowIso,
                lastSeenOn: nowIso,
                status: "active",
                resolutionNotes: null,
                linkedConditionIds: [],
                linkedEventIds,
                linkedAppointmentIds: [],
                ruleId: "R3_followup_not_scheduled",
            });
            upserted += 1;
        }
        else {
            await resolveClinicalAlert(followupAlertId, "Seguimiento clínico cubierto por turno futuro o sin recomendación vigente.", nowIso);
            resolved += 1;
        }
        // R4: tratamiento activo sin seguimiento reciente
        const latestEventTs = Math.max(...petEvents.map((event) => parseEventTimestamp(event)), 0);
        const activeTreatments = petTreatments.filter((treatment) => (treatment.status || "").toLowerCase() === "active");
        for (const treatment of activeTreatments) {
            const scope = treatment.normalizedName || treatment.id;
            const alertId = buildAlertId(petId, "R4_treatment_no_followup", scope);
            const stale = latestEventTs <= 0 || nowTs - latestEventTs > treatmentFollowupGapMs;
            if (stale) {
                await upsertClinicalAlert({
                    id: alertId,
                    petId,
                    type: "treatment_no_followup",
                    severity: "medium",
                    title: `Tratamiento activo sin seguimiento: ${treatment.normalizedName || "sin nombre"}`,
                    description: "No hay eventos clínicos recientes para validar evolución del tratamiento activo.",
                    triggeredOn: nowIso,
                    lastSeenOn: nowIso,
                    status: "active",
                    resolutionNotes: null,
                    linkedConditionIds: treatment.linkedConditionIds || [],
                    linkedEventIds: [],
                    linkedAppointmentIds: [],
                    ruleId: "R4_treatment_no_followup",
                });
                upserted += 1;
            }
            else {
                await resolveClinicalAlert(alertId, "Se detectó seguimiento clínico reciente.", nowIso);
                resolved += 1;
            }
        }
    }
    console.log(`[CLINICAL_ALERTS_DAILY] upserted=${upserted} resolved=${resolved} pets=${petIds.size}`);
    return null;
});
// ─────────────────────────────────────────────────────────────────────────────
// TRIGGER: Cuando se agrega una cita en Firestore → programa recordatorios
// ─────────────────────────────────────────────────────────────────────────────
exports.onAppointmentCreated = functions.firestore
    .document("appointments/{appointmentId}")
    .onCreate(async (snap, context) => {
    const appointment = snap.data();
    if (!appointment || !appointment.date)
        return;
    const now = new Date();
    const nowIso = now.toISOString();
    const userId = appointment.userId || appointment.ownerId;
    if (!userId)
        return;
    // Obtener la zona horaria del usuario para parsear la fecha correctamente
    const { timezone } = await getUserTokenAndTimezone(userId);
    const appointmentDate = parseLocalToUtc(appointment.date, appointment.time || "09:00", timezone);
    if (Number.isNaN(appointmentDate.getTime())) {
        console.warn(`[TRIGGER] Fecha/hora inválida para cita ${context.params.appointmentId}`);
        return;
    }
    const reminders = [];
    const oneDayBefore = new Date(appointmentDate.getTime() - 24 * 3600000);
    if (oneDayBefore > now) {
        reminders.push({
            id: `appt_${context.params.appointmentId}_24h`,
            payload: {
                userId,
                petId: appointment.petId || "",
                petName: appointment.petName || "Tu mascota",
                type: "appointment",
                title: `📅 Turno mañana — ${appointment.petName || "Tu mascota"}`,
                body: `${appointment.title || "Consulta"}${appointment.clinic ? ` · ${appointment.clinic}` : ""}`,
                scheduledFor: oneDayBefore.toISOString(),
                sourceEventId: context.params.appointmentId,
                repeat: "none",
                repeatInterval: null,
                repeatRootId: `appt_${context.params.appointmentId}`,
                endAt: null,
                active: true,
                sent: false,
                createdAt: nowIso,
            },
        });
    }
    const twoHoursBefore = new Date(appointmentDate.getTime() - 2 * 3600000);
    if (twoHoursBefore > now) {
        reminders.push({
            id: `appt_${context.params.appointmentId}_2h`,
            payload: {
                userId,
                petId: appointment.petId || "",
                petName: appointment.petName || "Tu mascota",
                type: "appointment",
                title: `⏰ Turno en 2 horas — ${appointment.petName || "Tu mascota"}`,
                body: `${appointment.title || "Consulta"}${appointment.veterinarian ? ` · Dr. ${appointment.veterinarian}` : ""}`,
                scheduledFor: twoHoursBefore.toISOString(),
                sourceEventId: context.params.appointmentId,
                repeat: "none",
                repeatInterval: null,
                repeatRootId: `appt_${context.params.appointmentId}`,
                endAt: null,
                active: true,
                sent: false,
                createdAt: nowIso,
            },
        });
    }
    // Mensaje explícito de "hoy toca turno" para el mismo día.
    const appointmentDayKey = toDateKeyInTimezone(appointmentDate, timezone);
    const localHour = Number(new Intl.DateTimeFormat("en-GB", {
        timeZone: timezone,
        hour: "2-digit",
        hour12: false,
    }).format(appointmentDate));
    // Recordatorio a las 7 AM o 3 horas antes del turno (lo que sea más tarde)
    const targetHour = Math.max(7, localHour - 3);
    const sameDayReminderTime = `${targetHour.toString().padStart(2, "0")}:00`;
    const sameDayReminder = parseLocalToUtc(appointmentDayKey, sameDayReminderTime, timezone);
    if (sameDayReminder > now && sameDayReminder < appointmentDate) {
        reminders.push({
            id: `appt_${context.params.appointmentId}_today`,
            payload: {
                userId,
                petId: appointment.petId || "",
                petName: appointment.petName || "Tu mascota",
                type: "appointment",
                title: `📌 Hoy toca turno — ${appointment.petName || "Tu mascota"}`,
                body: `${appointment.title || "Consulta"}${appointment.time ? ` a las ${appointment.time}` : ""}`,
                scheduledFor: sameDayReminder.toISOString(),
                sourceEventId: context.params.appointmentId,
                repeat: "none",
                repeatInterval: null,
                repeatRootId: `appt_${context.params.appointmentId}`,
                endAt: null,
                active: true,
                sent: false,
                createdAt: nowIso,
            },
        });
    }
    if (reminders.length > 0) {
        await Promise.all(reminders.map((r) => db.collection("scheduled_notifications").doc(r.id).set(r.payload)));
        console.log(`[TRIGGER] ${reminders.length} recordatorios creados para cita ${context.params.appointmentId}`);
    }
});
// ─────────────────────────────────────────────────────────────────────────────
// CLEANUP: Borra notificaciones enviadas con más de 7 días
// ─────────────────────────────────────────────────────────────────────────────
exports.cleanupOldNotifications = functions.pubsub
    .schedule("every 24 hours")
    .onRun(async () => {
    const cutoff = new Date(Date.now() - 7 * 24 * 3600000).toISOString();
    const old = await db
        .collection("scheduled_notifications")
        .where("sent", "==", true)
        .where("sentAt", "<=", cutoff)
        .get();
    if (!old.empty) {
        const batch = db.batch();
        old.docs.forEach((doc) => batch.delete(doc.ref));
        await batch.commit();
        console.log(`[CLEANUP] Borradas ${old.size} notificaciones viejas`);
    }
    const dailyOld = await db
        .collection("daily_notification_logs")
        .where("sentAt", "<=", cutoff)
        .get();
    if (!dailyOld.empty) {
        const batch = db.batch();
        dailyOld.docs.forEach((doc) => batch.delete(doc.ref));
        await batch.commit();
        console.log(`[CLEANUP] Borrados ${dailyOld.size} logs diarios`);
    }
    return null;
});
//# sourceMappingURL=index.js.map