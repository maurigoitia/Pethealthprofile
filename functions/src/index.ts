import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import {
  disconnectGmailSync,
  getGmailConnectUrl,
  gmailAuthCallback,
  syncAppointmentCalendarEvent,
} from "./gmail/oauth";
import {
  forceRunEmailClinicalIngestion,
  ingestClinicalEmailWebhook,
  runEmailClinicalAiWorker,
  runEmailClinicalAttachmentWorker,
  runEmailClinicalIngestionQueue,
  runEmailClinicalScanWorker,
  triggerEmailClinicalIngestion,
} from "./gmail/clinicalIngestion";
import { uploadPetPhoto } from "./media/petPhotos";
import { resolveClinicalKnowledgeContext } from "./clinical/knowledgeBase";
import { resolveBrainOutput } from "./clinical/brainResolver";
import { pessyClinicalBrainGrounding } from "./clinical/groundedBrain";
import { provisionPessyVertexDatastore } from "./clinical/vertexDatastoreAdmin";
import {
  dispatchTreatmentRemindersV3,
  evaluateTreatmentDedupV3,
  markMissedTreatmentDosesV3,
  onMedicationWriteScheduleV3,
  onTreatmentWriteScheduleV3,
  recordDoseEventV3,
  syncTreatmentTimezoneV3,
} from "./clinical/treatmentReminderEngine";

admin.initializeApp();
const db = admin.firestore();
const messaging = admin.messaging();

type NotificationType = "medication" | "appointment" | "vaccine_reminder" | "results";

interface NotificationSettings {
  enabled?: boolean;
  vaccines?: boolean;
  appointments?: boolean;
  medications?: boolean;
  results?: boolean;
}

interface AppointmentRow {
  id: string;
  status?: string;
  date?: string;
  time?: string;
  title?: string;
  petId?: string;
  petName?: string;
  sourceEventId?: string;
}

interface ClinicalConditionRow {
  id: string;
  petId: string;
  normalizedName?: string;
  firstDetectedDate?: string;
  lastDetectedDate?: string;
  occurrencesCount?: number;
  pattern?: string;
  linkedConditionIds?: string[];
}

interface TreatmentRow {
  id: string;
  petId: string;
  normalizedName?: string;
  status?: string;
  linkedConditionIds?: string[];
}

interface ClinicalAlertRow {
  id: string;
  petId: string;
  type: "out_of_range" | "followup_not_scheduled" | "condition_persistent" | "treatment_no_followup" | "recommendation_pending";
  severity: "low" | "medium" | "high";
  title: string;
  description: string;
  triggeredOn: string;
  lastSeenOn: string;
  status: "active" | "resolved" | "dismissed";
  resolutionNotes: string | null;
  linkedConditionIds: string[];
  linkedEventIds: string[];
  linkedAppointmentIds: string[];
  ruleId: string;
}

const LAB_LIKE_DOCUMENT_TYPES = new Set(["laboratory_result", "lab_result", "lab_test", "clinical_report"]);

const userSettingsCache = new Map<string, NotificationSettings>();
const userTokenCache = new Map<string, string | null>();
const userTimezoneCache = new Map<string, string>();
const petNameCache = new Map<string, string>();
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const GMAIL_SYNC_REMINDER_LAST_DAY = 3;
const GMAIL_SYNC_AUTO_ACCEPT_DAY = 4;

function toDateKeyInTimezone(date: Date, timeZone: string): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(date);
}

function parseYmdOrIsoToDateKey(value: unknown, timeZone = "UTC"): string {
  if (typeof value !== "string" || !value.trim()) return "";
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return "";
  return toDateKeyInTimezone(parsed, timeZone);
}

function normalizeMedicationName(value: unknown): string {
  if (typeof value !== "string") return "";
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function parseDurationToEndDate(duration: unknown, startDateIso: unknown): string | null {
  if (typeof duration !== "string" || !duration.trim()) return null;
  if (typeof startDateIso !== "string" || !startDateIso.trim()) return null;

  const normalized = duration.toLowerCase().trim();
  if (
    normalized.includes("cronic") ||
    normalized.includes("indefin") ||
    normalized.includes("continu")
  ) {
    return null;
  }

  const match = normalized.match(/(\d+)\s*(dia|dias|días|semana|semanas|mes|meses)/i);
  if (!match) return null;

  const quantity = Number(match[1]);
  if (!Number.isFinite(quantity) || quantity <= 0) return null;

  const start = new Date(startDateIso);
  if (Number.isNaN(start.getTime())) return null;

  const end = new Date(start);
  const unit = match[2].toLowerCase();
  if (unit.startsWith("dia") || unit.startsWith("día")) end.setDate(end.getDate() + quantity);
  if (unit.startsWith("semana")) end.setDate(end.getDate() + quantity * 7);
  if (unit.startsWith("mes")) end.setMonth(end.getMonth() + quantity);
  return end.toISOString();
}

function isChronicMarker(value: unknown): boolean {
  if (typeof value !== "string") return false;
  const normalized = value.toLowerCase();
  return normalized.includes("cronic") || normalized.includes("indefin") || normalized.includes("continu");
}

function isTypeEnabled(settings: NotificationSettings, type: NotificationType): boolean {
  if (settings.enabled === false) return false;
  if (type === "medication") return settings.medications !== false;
  if (type === "appointment") return settings.appointments !== false;
  if (type === "vaccine_reminder") return settings.vaccines !== false;
  if (type === "results") return settings.results !== false;
  return true;
}

/**
 * Parsea una fecha y hora local (YYYY-MM-DD y HH:mm) en una zona horaria específica
 * y devuelve un objeto Date en UTC.
 */
function parseLocalToUtc(dateStr: string, timeStr: string, timeZone: string): Date {
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

async function getUserSettings(userId: string): Promise<NotificationSettings> {
  if (userSettingsCache.has(userId)) return userSettingsCache.get(userId)!;
  const userSnap = await db.collection("users").doc(userId).get();
  const settings = (userSnap.data()?.notificationSettings || {}) as NotificationSettings;
  userSettingsCache.set(userId, settings);
  return settings;
}

async function getUserTokenAndTimezone(userId: string): Promise<{ token: string | null; timezone: string }> {
  let token = userTokenCache.get(userId);
  let timezone = userTimezoneCache.get(userId);

  if (token === undefined || !timezone) {
    const tokenCol = db.collection("users").doc(userId).collection("fcm_tokens");
    const primaryDoc = await tokenCol.doc("primary").get();
    if (primaryDoc.exists) {
      token = (primaryDoc.data()?.token as string | undefined) || null;
      timezone = (primaryDoc.data()?.timezone as string | undefined) || "UTC";
    } else {
      const fallbackSnap = await tokenCol.limit(1).get();
      if (!fallbackSnap.empty) {
        const fallback = fallbackSnap.docs[0].data();
        token = (fallback?.token as string | undefined) || null;
        timezone = (fallback?.timezone as string | undefined) || "UTC";
      } else {
        token = null;
        timezone = "UTC";
      }
    }

    userTokenCache.set(userId, token);
    userTimezoneCache.set(userId, timezone);
  }

  return { token: token || null, timezone: timezone || "UTC" };
}

async function resolvePetName(petId: string): Promise<string> {
  if (!petId) return "tu mascota";
  if (petNameCache.has(petId)) return petNameCache.get(petId)!;
  const petSnap = await db.collection("pets").doc(petId).get();
  const name = petSnap.exists ? (petSnap.data()?.name as string | undefined) || "tu mascota" : "tu mascota";
  petNameCache.set(petId, name);
  return name;
}

async function sendPushMessage(args: {
  token: string;
  title: string;
  body: string;
  type: string;
  petId?: string;
  petName?: string;
  sourceEventId?: string;
  notificationId?: string;
}) {
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
      priority: "high" as const,
      notification: {
        channelId: "pessy_reminders",
        priority: "high" as const,
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

function chunkItems<T>(items: T[], size: number): T[][] {
  if (size <= 0) return [items];
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

function toStringDataRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object") return {};
  const entries = Object.entries(value as Record<string, unknown>);
  const out: Record<string, string> = {};
  for (const [key, raw] of entries) {
    if (raw == null) continue;
    if (typeof raw === "string") out[key] = raw;
    else if (typeof raw === "number" || typeof raw === "boolean") out[key] = String(raw);
    else out[key] = JSON.stringify(raw);
  }
  return out;
}

function asRecord(value: unknown): Record<string, any> {
  if (!value || typeof value !== "object") return {};
  return value as Record<string, any>;
}

function parseIsoToMs(value: unknown): number {
  if (typeof value !== "string" || !value.trim()) return 0;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function getGmailReminderCopy(dayNumber: number): { title: string; body: string } {
  if (dayNumber >= 3) {
    return {
      title: "⚠️ Último aviso: activá Gmail Sync",
      body: "Último día para activar la sincronización de correos veterinarios en Pessy.",
    };
  }

  if (dayNumber === 2) {
    return {
      title: "📧 Recordatorio día 2: activá Gmail Sync",
      body: "Falta 1 día para cerrar este recordatorio. Podés activar Gmail Sync en segundos.",
    };
  }

  return {
    title: "📧 Recordatorio día 1: activá Gmail Sync",
    body: "Danos permiso para leer correos veterinarios y completar historial, turnos y tratamientos.",
  };
}

function slugifyKey(value: unknown): string {
  if (typeof value !== "string") return "unknown";
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .trim() || "unknown";
}

function buildAlertId(petId: string, ruleId: string, scopeKey: string): string {
  return `alt_${petId}_${slugifyKey(ruleId)}_${slugifyKey(scopeKey)}`;
}

function parseEventTimestamp(event: Record<string, any>): number {
  const extracted = asRecord(event.extractedData);
  const candidate = event.eventDate || extracted.eventDate || event.createdAt || "";
  const ts = Date.parse(candidate);
  return Number.isNaN(ts) ? 0 : ts;
}

function getEventDocumentType(event: Record<string, any>): string {
  const extracted = asRecord(event.extractedData);
  const raw = (event.documentType || extracted.documentType || "").toString().toLowerCase().trim();
  return raw;
}

function hasFollowupKeyword(text: unknown): boolean {
  if (typeof text !== "string") return false;
  const normalized = text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  return /(control|recheck|re chequeo|seguimiento|cardio|presion|consulta|turno|revision)/i.test(normalized);
}

function extractRecommendations(event: Record<string, any>): string[] {
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

function extractAbnormalFindings(event: Record<string, any>): Array<{ parameter: string; status: string }> {
  const findings: Array<{ parameter: string; status: string }> = [];
  const topLevel = Array.isArray(event.abnormalFindings) ? event.abnormalFindings : [];
  for (const row of topLevel) {
    const item = asRecord(row);
    const parameter = typeof item.parameter === "string" ? item.parameter.trim() : "";
    const status = typeof item.status === "string" ? item.status.trim().toLowerCase() : "";
    if (!parameter || !status) continue;
    if (status === "alto" || status === "bajo" || status === "alterado") {
      findings.push({ parameter, status });
    }
  }

  if (findings.length > 0) return findings;

  const extracted = asRecord(event.extractedData);
  const measurements = Array.isArray(extracted.measurements) ? extracted.measurements : [];
  for (const row of measurements) {
    const item = asRecord(row);
    const parameter = typeof item.name === "string" ? item.name.trim() : "";
    const range = typeof item.referenceRange === "string" ? item.referenceRange.toLowerCase() : "";
    let status = "";
    if (range.includes("alto") || range.includes("elevado") || range.includes("high")) status = "alto";
    if (range.includes("bajo") || range.includes("low") || range.includes("disminuido")) status = "bajo";
    if (range.includes("alterado") || range.includes("abnormal")) status = "alterado";
    if (!parameter || !status) continue;
    findings.push({ parameter, status });
  }

  return findings;
}

async function upsertClinicalAlert(alert: ClinicalAlertRow): Promise<void> {
  const ref = db.collection("clinical_alerts").doc(alert.id);
  const prevSnap = await ref.get();
  if (!prevSnap.exists) {
    await ref.set(alert);
    return;
  }

  const prev = prevSnap.data() as Partial<ClinicalAlertRow>;
  const uniq = (items: string[] = []): string[] => Array.from(new Set(items.filter(Boolean)));
  await ref.set(
    {
      ...prev,
      ...alert,
      triggeredOn: prev.triggeredOn || alert.triggeredOn,
      lastSeenOn: alert.lastSeenOn,
      status: alert.status,
      linkedConditionIds: uniq([...(prev.linkedConditionIds || []), ...(alert.linkedConditionIds || [])]),
      linkedEventIds: uniq([...(prev.linkedEventIds || []), ...(alert.linkedEventIds || [])]),
      linkedAppointmentIds: uniq([...(prev.linkedAppointmentIds || []), ...(alert.linkedAppointmentIds || [])]),
    },
    { merge: true }
  );
}

async function resolveClinicalAlert(alertId: string, notes: string, nowIso: string): Promise<void> {
  const ref = db.collection("clinical_alerts").doc(alertId);
  const snap = await ref.get();
  if (!snap.exists) return;
  const current = snap.data() as Partial<ClinicalAlertRow>;
  if (current.status !== "active") return;
  await ref.update({
    status: "resolved",
    resolutionNotes: notes,
    lastSeenOn: nowIso,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// CRON: Revisa cada 15 minutos si hay notificaciones pendientes para enviar
// ─────────────────────────────────────────────────────────────────────────────
export const sendScheduledNotifications = functions.pubsub
  .schedule("every 5 minutes")
  .onRun(async () => {
    const now = new Date();
    const windowEnd = new Date(now.getTime() + 6 * 60 * 1000); // ventana 6 min para cubrir gap entre ejecuciones
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

    const uniqueDocs: FirebaseFirestore.QueryDocumentSnapshot[] = [];
    const seenKeys = new Set<string>();
    for (const docSnap of snapshot.docs) {
      const data = docSnap.data() as Record<string, any>;
      const dedupeKey = [
        (data.repeatRootId as string | undefined) || (data.sourceMedicationId as string | undefined) || docSnap.id,
        (data.userId as string | undefined) || "",
        (data.petId as string | undefined) || "",
        (data.type as string | undefined) || "",
        (data.scheduledFor as string | undefined) || "",
      ].join("|");

      if (seenKeys.has(dedupeKey)) {
        await docSnap.ref.update({ sent: true, sentAt: nowIso, skipped: "duplicate_window" });
        continue;
      }
      seenKeys.add(dedupeKey);
      uniqueDocs.push(docSnap);
    }

    console.log(`[CRON] ${uniqueDocs.length} notificaciones únicas a enviar`);

    const results = await Promise.allSettled(
      uniqueDocs.map(async (docSnap) => {
        const notification = docSnap.data() as Record<string, any>;
        const userId = (notification.userId as string | undefined) || "";
        const type = (notification.type as NotificationType | undefined) || "medication";

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
          const currentScheduled = new Date(notification.scheduledFor as string);
          const nextDate = new Date(currentScheduled.getTime() + Number(notification.repeatInterval) * 3600000);
          if (!Number.isNaN(nextDate.getTime())) {
            const endAtRaw = notification.endAt as string | null | undefined;
            const endAt = endAtRaw ? new Date(endAtRaw) : null;
            const shouldScheduleNext = !endAt || nextDate.getTime() <= endAt.getTime();

            if (shouldScheduleNext) {
              const repeatRootId = (notification.repeatRootId as string | undefined) || docSnap.id;
              // Limpiar sufijo _pre60 / _pre5 del rootId para obtener el id base
              const baseRootId = repeatRootId.replace(/_pre60$|_pre5$/, "");

              // Dosis principal
              const nextDocId = `${baseRootId}_${nextDate.getTime()}`;
              const basePayload = {
                userId,
                petId: notification.petId || "",
                petName: notification.petName || "Tu mascota",
                type,
                body: notification.body || "",
                sourceEventId: notification.sourceEventId || null,
                sourceMedicationId: notification.sourceMedicationId || null,
                repeat: notification.repeat || "none",
                repeatInterval: Number(notification.repeatInterval) || null,
                endAt: endAtRaw || null,
                active: true,
                sent: false,
                createdAt: nowIso,
              };

              // Solo reprogramar si este doc es la dosis principal (no los pre-avisos)
              const isPreAlert = repeatRootId.endsWith("_pre60") || repeatRootId.endsWith("_pre5");
              if (!isPreAlert) {
                await db.collection("scheduled_notifications").doc(nextDocId).set({
                  ...basePayload,
                  title: notification.title || "Pessy",
                  scheduledFor: nextDate.toISOString(),
                  repeatRootId: baseRootId,
                });

                // Pre-aviso 1 hora
                const oneHourBefore = new Date(nextDate.getTime() - 60 * 60 * 1000);
                if (!endAt || oneHourBefore.getTime() <= endAt.getTime()) {
                  await db.collection("scheduled_notifications").doc(`${baseRootId}_pre60_${nextDate.getTime()}`).set({
                    ...basePayload,
                    title: `En 1 hora medicación — ${notification.petName || "tu mascota"}`,
                    scheduledFor: oneHourBefore.toISOString(),
                    repeatRootId: `${baseRootId}_pre60`,
                  });
                }

                // Pre-aviso 5 min
                const fiveMinBefore = new Date(nextDate.getTime() - 5 * 60 * 1000);
                if (!endAt || fiveMinBefore.getTime() <= endAt.getTime()) {
                  await db.collection("scheduled_notifications").doc(`${baseRootId}_pre5_${nextDate.getTime()}`).set({
                    ...basePayload,
                    title: `¡En 5 min! Medicación — ${notification.petName || "tu mascota"}`,
                    scheduledFor: fiveMinBefore.toISOString(),
                    repeatRootId: `${baseRootId}_pre5`,
                  });
                }
              }
            }
          }
        }

        console.log(`[CRON] ✅ Enviada: ${notification.title} → ${notification.petName}`);
      })
    );

    const failed = results.filter((r) => r.status === "rejected");
    if (failed.length > 0) {
      console.error(`[CRON] ${failed.length} notificaciones fallaron`);
    }

    return null;
  });

// ─────────────────────────────────────────────────────────────────────────────
// CRON: Avisos diarios core ("hoy toca medicación" / "hoy toca turno")
// ─────────────────────────────────────────────────────────────────────────────
export const sendDailyCareSummary = functions.pubsub
  .schedule("every 3 hours")
  .onRun(async () => {
    const now = new Date();
    const usersSnap = await db.collection("users").get();
    if (usersSnap.empty) return null;

    const sends: Promise<unknown>[] = [];

    for (const userDoc of usersSnap.docs) {
      const userId = userDoc.id;
      const userData = userDoc.data() as Record<string, any>;
      const settings = await getUserSettings(userId);
      if (settings.enabled === false) continue;
      const appointmentsEnabled = settings.appointments !== false;
      const medicationsEnabled = settings.medications !== false;
      if (!appointmentsEnabled && !medicationsEnabled) continue;

      let timezone =
        typeof userData.timezone === "string" && userData.timezone.trim()
          ? userData.timezone.trim()
          : "";
      if (!timezone) {
        const tokenData = await getUserTokenAndTimezone(userId);
        timezone = tokenData.timezone || "UTC";
      }

      const localHour = Number(
        new Intl.DateTimeFormat("en-GB", {
          timeZone: timezone,
          hour: "2-digit",
          hour12: false,
        }).format(now)
      );

      // Ventana de envío diaria: mañana.
      if (localHour < 7 || localHour > 10) continue;
      const { token } = await getUserTokenAndTimezone(userId);
      if (!token) continue;

      const todayKey = toDateKeyInTimezone(now, timezone);

      if (appointmentsEnabled) {
        const appointmentsSnap = await db.collection("appointments").where("userId", "==", userId).get();
        const appointmentsToday: AppointmentRow[] = appointmentsSnap.docs
          .map((d) => ({ id: d.id, ...(d.data() as Record<string, any>) } as AppointmentRow))
          .filter((a) => (a.status || "upcoming") === "upcoming" && (a.date || "") === todayKey);

        for (const appointment of appointmentsToday) {
          const logId = `daily_turno_${appointment.id}_${todayKey}`;
          const logRef = db.collection("daily_notification_logs").doc(logId);
          const logSnap = await logRef.get();
          if (logSnap.exists) continue;

          const title = `📌 Hoy toca turno — ${appointment.petName || "tu mascota"}`;
          const body = `${appointment.title || "Consulta"}${appointment.time ? ` a las ${appointment.time}` : ""}`;

          sends.push(
            sendPushMessage({
              token,
              title,
              body,
              type: "appointment",
              petId: appointment.petId,
              petName: appointment.petName,
              sourceEventId: appointment.sourceEventId || appointment.id,
            }).then(() => logRef.set({ userId, kind: "appointment", petId: appointment.petId || "", date: todayKey, sentAt: now.toISOString() }))
          );
        }
      }

      if (medicationsEnabled) {
        const medsSnap = await db.collection("medications").where("userId", "==", userId).get();
        const activeByPet = new Map<string, { petName: string; count: number }>();

        for (const medDoc of medsSnap.docs) {
          const med = medDoc.data() as Record<string, any>;
          if (med.active === false) continue;

          const startKey = parseYmdOrIsoToDateKey(med.startDate, timezone);
          const endKey = parseYmdOrIsoToDateKey(med.endDate, timezone);
          const isActiveToday = startKey && startKey <= todayKey && (!endKey || endKey >= todayKey);
          if (!isActiveToday) continue;

          const petId = (med.petId as string | undefined) || "unknown_pet";
          const existing = activeByPet.get(petId);
          const resolvedName = (med.petName as string | undefined) || (await resolvePetName(petId));
          activeByPet.set(petId, {
            petName: resolvedName || existing?.petName || "tu mascota",
            count: (existing?.count || 0) + 1,
          });
        }

        for (const [petId, info] of activeByPet.entries()) {
          const logId = `daily_med_${userId}_${petId}_${todayKey}`;
          const logRef = db.collection("daily_notification_logs").doc(logId);
          const logSnap = await logRef.get();
          if (logSnap.exists) continue;

          const title = `💊 Hoy toca medicación — ${info.petName}`;
          const body = info.count === 1
            ? "Tenés 1 tratamiento activo para hoy."
            : `Tenés ${info.count} tratamientos activos para hoy.`;

          sends.push(
            sendPushMessage({
              token,
              title,
              body,
              type: "medication",
              petId,
              petName: info.petName,
            }).then(() => logRef.set({ userId, kind: "medication", petId, date: todayKey, sentAt: now.toISOString() }))
          );
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
export const sendBroadcastPushCampaigns = functions.pubsub
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

    type TokenEntry = {
      token: string;
      ref: FirebaseFirestore.DocumentReference;
      platform: string;
    };

    const tokenDocs = await db.collectionGroup("fcm_tokens").get();
    const tokenEntries: TokenEntry[] = [];
    const seenTokens = new Set<string>();

    for (const tokenDoc of tokenDocs.docs) {
      const data = tokenDoc.data() as Record<string, unknown>;
      const token = typeof data.token === "string" ? data.token.trim() : "";
      if (!token || seenTokens.has(token)) continue;
      seenTokens.add(token);
      tokenEntries.push({
        token,
        ref: tokenDoc.ref,
        platform: typeof data.platform === "string" ? data.platform : "web",
      });
    }

    if (tokenEntries.length === 0) {
      await Promise.all(
        campaignsSnap.docs.map((doc) =>
          doc.ref.update({
            sent: true,
            sentAt: nowIso,
            totalTokens: 0,
            successCount: 0,
            failureCount: 0,
            invalidTokenCount: 0,
            warning: "no_tokens",
          })
        )
      );
      return null;
    }

    for (const campaignDoc of campaignsSnap.docs) {
      const campaign = campaignDoc.data() as Record<string, any>;
      const title = (campaign.title as string | undefined) || "PESSY";
      const body = (campaign.body as string | undefined) || "";
      const extraData = toStringDataRecord(campaign.data || {});
      const audience = (campaign.audience as string | undefined) || "all";

      const selectedTokens = tokenEntries
        .filter((entry) => {
          if (audience === "all") return true;
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
      const invalidTokens = new Set<string>();

      for (const tokenChunk of tokenChunks) {
        const response = await messaging.sendEachForMulticast({
          tokens: tokenChunk,
          notification: { title, body },
          data: {
            campaignId: campaignDoc.id,
            type: "broadcast",
            ...extraData,
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
            },
          },
        });

        successCount += response.successCount;
        failureCount += response.failureCount;

        response.responses.forEach((sendResponse, idx) => {
          if (sendResponse.success) return;
          const code = sendResponse.error?.code || "";
          if (
            code === "messaging/registration-token-not-registered" ||
            code === "messaging/invalid-registration-token"
          ) {
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
// CRON: Recordatorio de consentimiento Gmail Sync (Día 1, 2, 3 + auto-cierre en día 4)
// - Usuarios sin Gmail Sync conectado
// - Envío por push si hay token activo
// ─────────────────────────────────────────────────────────────────────────────
export const sendGmailSyncConsentReminders = functions.pubsub
  .schedule("every 24 hours")
  .onRun(async () => {
    const now = new Date();
    const nowIso = now.toISOString();
    const nowMs = now.getTime();

    const usersSnap = await db.collection("users").get();
    if (usersSnap.empty) {
      console.log("[GMAIL_CONSENT_REMINDER] No hay usuarios para revisar.");
      return null;
    }

    let sent = 0;
    let skippedConnected = 0;
    let skippedNotDue = 0;
    let skippedNoToken = 0;
    let autoAccepted = 0;
    let failed = 0;

    for (const userDoc of usersSnap.docs) {
      const userId = userDoc.id;
      const userData = userDoc.data() as Record<string, any>;
      const gmailSync = asRecord(userData.gmailSync);
      const reminderMeta = asRecord(userData.gmailSyncReminder);
      const connected = gmailSync.connected === true;

      if (connected) {
        skippedConnected += 1;
        continue;
      }

      const status = typeof reminderMeta.status === "string" ? reminderMeta.status : "pending_permission";
      if (status === "auto-accepted") {
        skippedNotDue += 1;
        continue;
      }

      const anchorMs =
        parseIsoToMs(gmailSync.consentRequestedAt) ||
        parseIsoToMs(reminderMeta.consentRequestedAt) ||
        parseIsoToMs(userData.createdAt) ||
        nowMs;
      const daysElapsed = Math.floor((nowMs - anchorMs) / ONE_DAY_MS);
      const dayNumberRaw = Number(reminderMeta.dayNumber);
      const dayNumber = Number.isFinite(dayNumberRaw) && dayNumberRaw > 0 ? Math.floor(dayNumberRaw) : 0;

      if (daysElapsed >= GMAIL_SYNC_AUTO_ACCEPT_DAY) {
        await userDoc.ref.set(
          {
            gmailSyncReminder: {
              status: "auto-accepted",
              dayNumber: GMAIL_SYNC_REMINDER_LAST_DAY,
              autoAcceptedAt: nowIso,
              updatedAt: nowIso,
              lastError: null,
            },
          },
          { merge: true }
        );
        autoAccepted += 1;
        continue;
      }

      const nextDayNumber = dayNumber + 1;
      const isDue =
        nextDayNumber >= 1 &&
        nextDayNumber <= GMAIL_SYNC_REMINDER_LAST_DAY &&
        daysElapsed >= nextDayNumber;

      if (!isDue) {
        skippedNotDue += 1;
        continue;
      }

      const { token } = await getUserTokenAndTimezone(userId);
      if (!token) {
        skippedNoToken += 1;
        continue;
      }

      try {
        const copy = getGmailReminderCopy(nextDayNumber);
        await sendPushMessage({
          token,
          title: copy.title,
          body: copy.body,
          type: "results",
        });

        await userDoc.ref.set(
          {
            gmailSync: {
              consentRequestedAt: typeof gmailSync.consentRequestedAt === "string"
                ? gmailSync.consentRequestedAt
                : nowIso,
              updatedAt: nowIso,
            },
            gmailSyncReminder: {
              lastPushSentAt: nowIso,
              sentCount: Number(reminderMeta.sentCount || 0) + 1,
              dayNumber: nextDayNumber,
              updatedAt: nowIso,
              status: `day_${nextDayNumber}_sent`,
              lastError: null,
            },
          },
          { merge: true }
        );
        sent += 1;
      } catch (error) {
        failed += 1;
        console.error(`[GMAIL_CONSENT_REMINDER] Error user=${userId}`, error);
        await userDoc.ref.set(
          {
            gmailSyncReminder: {
              updatedAt: nowIso,
              status: `day_${nextDayNumber}_failed`,
              lastError: String(error).slice(0, 300),
            },
          },
          { merge: true }
        );
      }
    }

    console.log(
      `[GMAIL_CONSENT_REMINDER] sent=${sent} connected=${skippedConnected} not_due=${skippedNotDue} noToken=${skippedNoToken} autoAccepted=${autoAccepted} failed=${failed}`
    );
    return null;
  });

// ─────────────────────────────────────────────────────────────────────────────
// CRON: Reconciliación de tratamientos existentes
// - Completa frecuencia/fin usando el documento médico fuente cuando falta.
// - Si no alcanza la info, crea pendiente y avisa al usuario.
// ─────────────────────────────────────────────────────────────────────────────
export const reconcileExistingTreatments = functions.pubsub
  .schedule("every 12 hours")
  .onRun(async () => {
    const now = new Date();
    const nowIso = now.toISOString();
    const medsSnap = await db
      .collection("medications")
      .where("active", "==", true)
      .get();

    if (medsSnap.empty) return null;

    let patched = 0;
    let reviewQueued = 0;
    let notified = 0;

    for (const medDoc of medsSnap.docs) {
      const med = medDoc.data() as Record<string, any>;
      const userId = (med.userId as string | undefined) || "";
      const petId = (med.petId as string | undefined) || "";
      if (!userId || !petId) continue;

      const hasFrequency = typeof med.frequency === "string" && med.frequency.trim().length > 0;
      const hasEndDate = typeof med.endDate === "string" && med.endDate.trim().length > 0;
      if (hasFrequency && (hasEndDate || isChronicMarker(med.frequency))) continue;

      let nextFrequency = hasFrequency ? String(med.frequency) : "";
      let nextEndDate = hasEndDate ? String(med.endDate) : null;
      const sourceEventId = (med.generatedFromEventId as string | undefined) || "";

      if (sourceEventId) {
        const eventSnap = await db.collection("medical_events").doc(sourceEventId).get();
        if (eventSnap.exists) {
          const event = eventSnap.data() as Record<string, any>;
          const extracted = (event.extractedData || {}) as Record<string, any>;
          const medsExtracted = Array.isArray(extracted.medications) ? extracted.medications : [];
          const targetName = normalizeMedicationName(med.name);
          const matched = medsExtracted.find((item: any) => normalizeMedicationName(item?.name) === targetName)
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

      const patch: Record<string, unknown> = {};
      if (!hasFrequency && nextFrequency) patch.frequency = nextFrequency;
      if (!hasEndDate && nextEndDate) patch.endDate = nextEndDate;
      if (Object.keys(patch).length > 0) {
        patch.updatedAt = nowIso;
        patch.metadataReconciledAt = nowIso;
        await medDoc.ref.update(patch);
        patched += 1;
      }

      const resolvedFrequency = patch.frequency ?? med.frequency;
      const resolvedEndDate = patch.endDate ?? med.endDate;
      const stillMissingFrequency = !(typeof resolvedFrequency === "string" && String(resolvedFrequency).trim());
      const stillMissingEnd = !isChronicMarker(String(resolvedFrequency || "")) &&
        !(typeof resolvedEndDate === "string" && String(resolvedEndDate).trim());

      if (!stillMissingFrequency && !stillMissingEnd) continue;

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
      if (!token || !isTypeEnabled(settings, "medication")) continue;

      const dateKey = toDateKeyInTimezone(now, timezone);
      const notifyLogId = `med_reconcile_prompt_${medDoc.id}_${dateKey}`;
      const notifyLogRef = db.collection("daily_notification_logs").doc(notifyLogId);
      const notifyLogSnap = await notifyLogRef.get();
      if (notifyLogSnap.exists) continue;

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
export const recomputeClinicalAlertsDaily = functions.pubsub
  .schedule("every 48 hours")
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

    if (petsSnap.empty) return null;

    const petIds = new Set<string>(petsSnap.docs.map((docSnap) => docSnap.id));

    const conditionsByPet = new Map<string, ClinicalConditionRow[]>();
    conditionsSnap.docs.forEach((docSnap) => {
      const row = { id: docSnap.id, ...(docSnap.data() as Record<string, unknown>) } as ClinicalConditionRow;
      if (!row.petId) return;
      const list = conditionsByPet.get(row.petId) || [];
      list.push(row);
      conditionsByPet.set(row.petId, list);
      petIds.add(row.petId);
    });

    const treatmentsByPet = new Map<string, TreatmentRow[]>();
    treatmentsSnap.docs.forEach((docSnap) => {
      const row = { id: docSnap.id, ...(docSnap.data() as Record<string, unknown>) } as TreatmentRow;
      if (!row.petId) return;
      const list = treatmentsByPet.get(row.petId) || [];
      list.push(row);
      treatmentsByPet.set(row.petId, list);
      petIds.add(row.petId);
    });

    const appointmentsByPet = new Map<string, AppointmentRow[]>();
    appointmentsSnap.docs.forEach((docSnap) => {
      const row = { id: docSnap.id, ...(docSnap.data() as Record<string, unknown>) } as AppointmentRow;
      if (!row.petId) return;
      const list = appointmentsByPet.get(row.petId) || [];
      list.push(row);
      appointmentsByPet.set(row.petId, list);
      petIds.add(row.petId);
    });

    const eventsByPet = new Map<string, Array<Record<string, any>>>();
    eventsSnap.docs.forEach((docSnap) => {
      const row = { id: docSnap.id, ...(docSnap.data() as Record<string, unknown>) } as Record<string, any>;
      const petId = typeof row.petId === "string" ? row.petId : "";
      if (!petId) return;
      const list = eventsByPet.get(petId) || [];
      list.push(row);
      eventsByPet.set(petId, list);
      petIds.add(petId);
    });

    const activeAlertsByPet = new Map<string, ClinicalAlertRow[]>();
    activeAlertsSnap.docs.forEach((docSnap) => {
      const row = { id: docSnap.id, ...(docSnap.data() as Record<string, unknown>) } as ClinicalAlertRow;
      if (!row.petId) return;
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

      const currentOutOfRangeAlertIds = new Set<string>();
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
            linkedEventIds: latestLabEvent?.id ? [String(latestLabEvent.id)] : [],
            linkedAppointmentIds: [],
            ruleId: "R1_out_of_range",
          });
          upserted += 1;
        }
      }

      for (const alert of petActiveAlerts) {
        if (alert.type !== "out_of_range") continue;
        if (currentOutOfRangeAlertIds.has(alert.id)) continue;
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
        } else {
          await resolveClinicalAlert(alertId, "No cumple criterio actual de persistencia clínica.", nowIso);
          resolved += 1;
        }
      }

      // R3: seguimiento recomendado sin turno futuro
      const followupEvents = petEvents.filter((event) => {
        const eventTs = parseEventTimestamp(event);
        if (eventTs <= 0 || nowTs - eventTs > recentWindowMs) return false;
        return extractRecommendations(event).some(hasFollowupKeyword);
      });

      const hasUpcomingAppointment = petAppointments.some((appointment) => {
        const status = (appointment.status || "").toLowerCase();
        if (status && status !== "upcoming" && status !== "programado" && status !== "confirmado") return false;
        if (!appointment.date) return false;
        const appointmentTs = Date.parse(`${appointment.date}T${appointment.time || "00:00"}:00`);
        if (Number.isNaN(appointmentTs)) return false;
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
      } else {
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
        } else {
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
export const onAppointmentCreated = functions.firestore
  .document("appointments/{appointmentId}")
  .onCreate(async (snap, context) => {
    const appointment = snap.data() as Record<string, any> | undefined;
    if (!appointment) return;
    await scheduleAppointmentReminders(context.params.appointmentId, appointment);
  });

async function clearPendingAppointmentNotifications(appointmentId: string): Promise<void> {
  const pendingSnap = await db
    .collection("scheduled_notifications")
    .where("sourceEventId", "==", appointmentId)
    .where("type", "==", "appointment")
    .where("sent", "==", false)
    .get();
  if (pendingSnap.empty) return;

  const batch = db.batch();
  pendingSnap.docs.forEach((docSnap) => batch.delete(docSnap.ref));
  await batch.commit();
}

async function scheduleAppointmentReminders(appointmentId: string, appointment: Record<string, any>): Promise<void> {
  await clearPendingAppointmentNotifications(appointmentId);
  if (!appointment.date) return;
  const appointmentStatus = typeof appointment.status === "string" ? appointment.status.toLowerCase() : "upcoming";
  if (!["upcoming", "scheduled", "confirmed"].includes(appointmentStatus)) return;

  const now = new Date();
  const nowIso = now.toISOString();
  const userId = appointment.userId || appointment.ownerId;
  if (!userId) return;

  const { timezone } = await getUserTokenAndTimezone(userId);
  const appointmentDate = parseLocalToUtc(
    appointment.date,
    appointment.time || "09:00",
    timezone
  );
  if (Number.isNaN(appointmentDate.getTime())) {
    console.warn(`[TRIGGER] Fecha/hora inválida para cita ${appointmentId}`);
    return;
  }

  const reminders: Array<{ id: string; payload: Record<string, any> }> = [];

  const oneDayBefore = new Date(appointmentDate.getTime() - 24 * 3600000);
  if (oneDayBefore > now) {
    reminders.push({
      id: `appt_${appointmentId}_24h`,
      payload: {
        userId,
        petId: appointment.petId || "",
        petName: appointment.petName || "Tu mascota",
        type: "appointment",
        title: `📅 Turno mañana — ${appointment.petName || "Tu mascota"}`,
        body: `${appointment.title || "Consulta"}${appointment.clinic ? ` · ${appointment.clinic}` : ""}`,
        scheduledFor: oneDayBefore.toISOString(),
        sourceEventId: appointmentId,
        repeat: "none",
        repeatInterval: null,
        repeatRootId: `appt_${appointmentId}`,
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
      id: `appt_${appointmentId}_2h`,
      payload: {
        userId,
        petId: appointment.petId || "",
        petName: appointment.petName || "Tu mascota",
        type: "appointment",
        title: `⏰ Turno en 2 horas — ${appointment.petName || "Tu mascota"}`,
        body: `${appointment.title || "Consulta"}${appointment.veterinarian ? ` · Dr. ${appointment.veterinarian}` : ""}`,
        scheduledFor: twoHoursBefore.toISOString(),
        sourceEventId: appointmentId,
        repeat: "none",
        repeatInterval: null,
        repeatRootId: `appt_${appointmentId}`,
        endAt: null,
        active: true,
        sent: false,
        createdAt: nowIso,
      },
    });
  }

  const appointmentDayKey = toDateKeyInTimezone(appointmentDate, timezone);
  const localHour = Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone,
      hour: "2-digit",
      hour12: false,
    }).format(appointmentDate)
  );
  const targetHour = Math.max(7, localHour - 3);
  const sameDayReminderTime = `${targetHour.toString().padStart(2, "0")}:00`;
  const sameDayReminder = parseLocalToUtc(appointmentDayKey, sameDayReminderTime, timezone);

  if (sameDayReminder > now && sameDayReminder < appointmentDate) {
    reminders.push({
      id: `appt_${appointmentId}_today`,
      payload: {
        userId,
        petId: appointment.petId || "",
        petName: appointment.petName || "Tu mascota",
        type: "appointment",
        title: `📌 Hoy toca turno — ${appointment.petName || "Tu mascota"}`,
        body: `${appointment.title || "Consulta"}${appointment.time ? ` a las ${appointment.time}` : ""}`,
        scheduledFor: sameDayReminder.toISOString(),
        sourceEventId: appointmentId,
        repeat: "none",
        repeatInterval: null,
        repeatRootId: `appt_${appointmentId}`,
        endAt: null,
        active: true,
        sent: false,
        createdAt: nowIso,
      },
    });
  }

  if (reminders.length > 0) {
    await Promise.all(
      reminders.map((r) =>
        db.collection("scheduled_notifications").doc(r.id).set(r.payload)
      )
    );
    console.log(`[TRIGGER] ${reminders.length} recordatorios creados para cita ${appointmentId}`);
  }
}

export const onAppointmentUpdated = functions.firestore
  .document("appointments/{appointmentId}")
  .onUpdate(async (change, context) => {
    const before = change.before.data() as Record<string, any> | undefined;
    const after = change.after.data() as Record<string, any> | undefined;
    if (!after) return null;

    const significantChange =
      (before?.date || "") !== (after.date || "") ||
      (before?.time || "") !== (after.time || "") ||
      (before?.status || "") !== (after.status || "") ||
      (before?.clinic || "") !== (after.clinic || "") ||
      (before?.veterinarian || "") !== (after.veterinarian || "") ||
      (before?.title || "") !== (after.title || "");

    if (!significantChange) return null;
    await scheduleAppointmentReminders(context.params.appointmentId, after);
    return null;
  });

export const onAppointmentDeleted = functions.firestore
  .document("appointments/{appointmentId}")
  .onDelete(async (_snap, context) => {
    await clearPendingAppointmentNotifications(context.params.appointmentId);
    return null;
  });

// ─────────────────────────────────────────────────────────────────────────────
// CLEANUP: Borra notificaciones enviadas con más de 7 días
// ─────────────────────────────────────────────────────────────────────────────
export const cleanupOldNotifications = functions.pubsub
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

// ─────────────────────────────────────────────────────────────────────────────
// ANALISIS IA (BACKEND-ONLY): evita exponer API keys en frontend
// ─────────────────────────────────────────────────────────────────────────────

const ANALYSIS_PROMPT_TEMPLATE = `Sos el motor de extracción clínica de PESSY.
Fecha de hoy: __TODAY__

PESSY CLINICAL PROCESSING PROTOCOL

FASE 0 — CLASIFICACIÓN OBLIGATORIA
Clasificá primero el documento en UNA categoría:
- clinical_report
- laboratory_result
- prescription
- medical_study
- medical_appointment
- vaccination_record
- other

Reglas críticas:
- Si detectás fecha futura + hora + especialidad o términos de turno (turno, confirmado, centro de atención, consulta), tratar como medical_appointment.
- Si es medical_appointment, NO generar diagnósticos ni hallazgos clínicos.
- No inventar datos faltantes.

FASE 0.5 — LECTURA CLÍNICA OBLIGATORIA (informes cualitativos: KOH, tricograma, citología, raspado)
1) Identificá estudio solicitado y técnica.
2) Extraé resultado principal literal (ej. "no se observaron...", "compatible con...", "positivo/negativo").
3) Diferenciá explícitamente:
   - qué descarta en esta muestra,
   - qué NO descarta de forma global.
4) Capturá limitaciones/disclaimers del informe (ej. "su ausencia no es excluyente").
5) Listá observaciones secundarias separadas del resultado principal.
6) Traducí términos técnicos en lenguaje simple dentro de recomendaciones.

FASE 1 — EXTRACCIÓN ESTRUCTURADA
Analizá el documento completo en modo multimodal y devolvé SOLO JSON válido:
{
  "pet": {
    "name": "string|null",
    "species": "string|null",
    "breed": "string|null",
    "age_at_study": "string|null",
    "owner": "string|null"
  },
  "document": {
    "type": "radiografia|ecografia|laboratorio|receta|informe|otro",
    "study_date": "YYYY-MM-DD|null",
    "clinic_name": "string|null",
    "clinic_address": "string|null",
    "veterinarian_name": "string|null",
    "veterinarian_license": "string|null",
    "protocol_or_record_number": "string|null"
  },
  "diagnoses_detected": [
    {
      "condition_name": "string|null",
      "organ_system": "string|null",
      "status": "nuevo|recurrente|persistente|null",
      "severity": "leve|moderado|severo|no_especificado|null"
    }
  ],
  "abnormal_findings": [
    {
      "parameter": "string|null",
      "value": "string|null",
      "reference_range": "string|null",
      "interpretation": "alto|bajo|alterado|normal|no_observado|inconcluso|null"
    }
  ],
  "imaging_findings": [
    {
      "region": "torax|abdomen|pelvis|columna|cadera|otro|null",
      "view": "ventrodorsal|lateral|dorsoventral|oblicua|otro|null",
      "finding": "string|null",
      "severity": "leve|moderado|severo|no_especificado|null"
    }
  ],
  "treatments_detected": [
    {
      "treatment_name": "string|null",
      "start_date": "YYYY-MM-DD|null",
      "end_date": "YYYY-MM-DD|null",
      "dosage": "string|null",
      "status": "activo|finalizado|desconocido|null"
    }
  ],
  "medical_recommendations": ["string"],
  "requires_followup": true
}

Opcional para documentos de turno:
{
  "appointment_event": {
    "event_type": "medical_appointment",
    "date": "YYYY-MM-DD|null",
    "time": "HH:MM|null",
    "specialty": "string|null",
    "procedure": "string|null",
    "clinic": "string|null",
    "address": "string|null",
    "professional_name": "string|null",
    "preparation_required": "string|null",
    "status": "scheduled|programado|confirmado|recordatorio|null"
  }
}

Opcional para certificados/carnets de vacunación:
{
  "vaccine_artifacts": {
    "sticker_detected": true,
    "stamp_detected": true,
    "signature_detected": true,
    "product_name": "string|null",
    "manufacturer": "string|null",
    "lot_number": "string|null",
    "serial_number": "string|null",
    "expiry_date": "YYYY-MM-DD|null",
    "application_date": "YYYY-MM-DD|null",
    "revaccination_date": "YYYY-MM-DD|null"
  }
}

FASE 2 — NORMALIZACIÓN
- Fechas en ISO YYYY-MM-DD.
- Unificar patologías equivalentes.
- Estandarizar órgano/sistema cuando esté explícito.

Reglas:
- Si un campo no está presente: null.
- No inventar información.
- No devolver texto fuera del JSON.
- No exceder 6 elementos por lista.
- Ignorar fecha de impresión y priorizar fecha clínica principal.
- Si el documento es turno, no completar diagnósticos ni hallazgos clínicos.
- En estudios cualitativos, usar "abnormal_findings.value" con literal clínico (ej. "no se observaron estructuras compatibles...").
- Si aparece "ausencia no excluyente" o equivalente, incluirlo textualmente en "medical_recommendations".
- Si el documento es por imágenes (radiografía/ecografía/ECG), completar "imaging_findings" con región, vista/proyección y hallazgo.
- Para radiografía, mapear abreviaturas de proyección cuando aparezcan (VD, DV, LL) a "view".
- Priorizar recomendaciones con prefijos:
  1) "Resultado principal: ..."
  2) "No descarta: ..." (si aplica)
  3) "Limitación: ..." (si aplica)
  4) "Siguiente paso: ..." (si aplica).
- Si hay troquel/sello/firma visibles, registrarlo en "vaccine_artifacts".
- Si el troquel tiene lote o serie, priorizar esos valores como fuente de verdad sobre texto libre.`;

const ANALYSIS_PDF_MIME_ALIASES = new Set([
  "application/pdf",
  "application/x-pdf",
  "application/acrobat",
  "applications/vnd.pdf",
  "text/pdf",
]);
const ANALYSIS_IMAGE_MIME_NORMALIZATION: Record<string, string> = {
  "image/jpg": "image/jpeg",
  "image/pjpeg": "image/jpeg",
};
const ANALYSIS_OCTET_STREAM_MIME_TYPES = new Set([
  "",
  "application/octet-stream",
  "binary/octet-stream",
]);
const SUPPORTED_ANALYSIS_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

function inferMimeTypeFromFilename(fileName: string): string {
  const lowerName = fileName.toLowerCase();
  if (lowerName.endsWith(".pdf")) return "application/pdf";
  if (lowerName.endsWith(".jpg") || lowerName.endsWith(".jpeg")) return "image/jpeg";
  if (lowerName.endsWith(".png")) return "image/png";
  if (lowerName.endsWith(".webp")) return "image/webp";
  if (lowerName.endsWith(".heic") || lowerName.endsWith(".heif")) return "image/heic";
  return "";
}

function inferMimeTypeFromBase64(base64: string): string {
  const normalized = base64.trim().replace(/\s+/g, "");
  if (!normalized) return "";
  if (normalized.startsWith("JVBERi0")) return "application/pdf";
  if (normalized.startsWith("/9j/")) return "image/jpeg";
  if (normalized.startsWith("iVBORw0KGgo")) return "image/png";
  if (normalized.startsWith("UklGR")) return "image/webp";
  return "";
}

function normalizeAnalysisMimeType(args: {
  rawMimeType: string;
  fileName: string;
  base64: string;
}): string {
  const raw = args.rawMimeType.toLowerCase().trim();
  if (ANALYSIS_PDF_MIME_ALIASES.has(raw)) return "application/pdf";
  if (ANALYSIS_IMAGE_MIME_NORMALIZATION[raw]) return ANALYSIS_IMAGE_MIME_NORMALIZATION[raw];
  if (!ANALYSIS_OCTET_STREAM_MIME_TYPES.has(raw)) return raw;

  const fromFilename = inferMimeTypeFromFilename(args.fileName);
  if (fromFilename) return fromFilename;

  const fromBase64 = inferMimeTypeFromBase64(args.base64);
  if (fromBase64) return fromBase64;

  return raw || "application/octet-stream";
}

const getGeminiSettings = () => {
  const keyFromEnv = process.env.GEMINI_API_KEY || "";
  const modelFromEnv = process.env.ANALYSIS_MODEL || "";

  return {
    apiKey: keyFromEnv,
    model: modelFromEnv || "gemini-2.5-flash",
  };
};

interface GeminiRequestPayload {
  contents: Array<{ parts: Array<Record<string, unknown>> }>;
  generationConfig?: Record<string, unknown>;
}

async function callGeminiBackend(payload: GeminiRequestPayload): Promise<{
  rawText: string;
  totalTokenCount: number;
}> {
  const { apiKey, model } = getGeminiSettings();
  if (!apiKey) {
    throw new functions.https.HttpsError("failed-precondition", "GEMINI_API_KEY no configurada en backend.");
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new functions.https.HttpsError(
      "internal",
      `Gemini backend error (${response.status}): ${errorText.slice(0, 600)}`
    );
  }

  const data = await response.json();
  const rawText = (data?.candidates?.[0]?.content?.parts?.[0]?.text as string | undefined) || "";
  const totalTokenCount = Number(data?.usageMetadata?.totalTokenCount || 0);

  return { rawText, totalTokenCount };
}

export const analyzeDocument = functions
  .runWith({ secrets: ["GEMINI_API_KEY"] })
  .region("us-central1")
  .https.onCall(async (data, context) => {
  if (!context.auth?.uid) {
    throw new functions.https.HttpsError("unauthenticated", "Debes iniciar sesión para analizar documentos.");
  }

  const requestedMimeType = typeof data?.mimeType === "string" ? data.mimeType.trim() : "";
  const fileName = typeof data?.fileName === "string" ? data.fileName.trim().slice(0, 260) : "";
  const base64 = typeof data?.base64 === "string" ? data.base64.trim() : "";
  const normalizedMimeType = normalizeAnalysisMimeType({
    rawMimeType: requestedMimeType,
    fileName,
    base64,
  });

  if (!base64) {
    throw new functions.https.HttpsError("invalid-argument", "Falta el contenido del archivo (base64).");
  }
  if (!SUPPORTED_ANALYSIS_MIME_TYPES.has(normalizedMimeType)) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Formato no compatible. Subí PDF, JPG, PNG o WEBP."
    );
  }

  // Base64 aproximado <= 8MB de binario
  const approxBytes = Math.floor((base64.length * 3) / 4);
  if (approxBytes > 8 * 1024 * 1024) {
    throw new functions.https.HttpsError("invalid-argument", "Documento demasiado grande para análisis en tiempo real.");
  }

  const today = new Date().toISOString().slice(0, 10);
  const contextHint = typeof data?.contextHint === "string" ? data.contextHint.slice(0, 1200) : "";
  const knowledgeContext = await resolveClinicalKnowledgeContext({
    query: [contextHint, fileName, normalizedMimeType, today].filter(Boolean).join(" "),
    maxSections: 7,
  });
  const prompt = `${ANALYSIS_PROMPT_TEMPLATE.replace("__TODAY__", today)}\n\n${knowledgeContext.contextText}`;

  const startedAt = Date.now();
  const { rawText, totalTokenCount } = await callGeminiBackend({
    contents: [
      {
        parts: [
          { text: prompt },
          {
            inline_data: {
              mime_type: normalizedMimeType,
              data: base64,
            },
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0,
      topK: 1,
      topP: 1,
      responseMimeType: "application/json",
      maxOutputTokens: 2600,
      thinkingConfig: {
        thinkingBudget: 0,
      },
    },
  });

  const { model } = getGeminiSettings();

  return {
    rawText,
    model,
    tokensUsed: totalTokenCount,
    processingTimeMs: Date.now() - startedAt,
    resolvedMimeType: normalizedMimeType,
    knowledgeVersion: knowledgeContext.version,
    knowledgeSectionIds: knowledgeContext.sectionIds,
    knowledgeSource: knowledgeContext.source,
  };
  });

export const generateClinicalSummary = functions
  .runWith({ secrets: ["GEMINI_API_KEY"] })
  .region("us-central1")
  .https.onCall(async (data, context) => {
  if (!context.auth?.uid) {
    throw new functions.https.HttpsError("unauthenticated", "Debes iniciar sesión para generar resúmenes.");
  }

  const prompt = typeof data?.prompt === "string" ? data.prompt.trim() : "";
  if (!prompt) {
    throw new functions.https.HttpsError("invalid-argument", "Falta prompt.");
  }
  if (prompt.length > 35000) {
    throw new functions.https.HttpsError("invalid-argument", "Prompt demasiado largo.");
  }

  const maxOutputTokens = Number(data?.maxOutputTokens || 1200);
  const temperature = Number(data?.temperature ?? 0.1);
  const responseMimeType = typeof data?.responseMimeType === "string" && data.responseMimeType.trim()
    ? data.responseMimeType.trim()
    : undefined;
  const knowledgeContext = await resolveClinicalKnowledgeContext({
    query: prompt.slice(0, 6000),
    maxSections: 8,
  });
  const promptWithKnowledge = `${knowledgeContext.contextText}\n\nINSTRUCCION_CLINICA:\n${prompt}`;

  const startedAt = Date.now();
  const { rawText, totalTokenCount } = await callGeminiBackend({
    contents: [{ parts: [{ text: promptWithKnowledge }] }],
    generationConfig: {
      temperature,
      topK: 1,
      topP: 1,
      maxOutputTokens,
      ...(responseMimeType ? { responseMimeType } : {}),
    },
  });

  const { model } = getGeminiSettings();

  return {
    rawText,
    model,
    tokensUsed: totalTokenCount,
    processingTimeMs: Date.now() - startedAt,
    knowledgeVersion: knowledgeContext.version,
    knowledgeSectionIds: knowledgeContext.sectionIds,
    knowledgeSource: knowledgeContext.source,
  };
  });

export const resolveBrainPayload = functions
  .region("us-central1")
  .https.onCall(async (data, context) => {
    if (!context.auth?.uid) {
      throw new functions.https.HttpsError("unauthenticated", "Debes iniciar sesión para resolver datos clínicos.");
    }

    const payload = asRecord(data?.brainOutput);
    const category = String(payload.category || "").trim();
    if (!category) {
      throw new functions.https.HttpsError("invalid-argument", "Falta brainOutput.category.");
    }

    const rawConfidence = Number(payload.confidence ?? 0);
    const confidence = rawConfidence > 1 ? rawConfidence / 100 : rawConfidence;
    const entities = Array.isArray(payload.entities)
      ? payload.entities.map((item) => asRecord(item))
      : [];
    const sourceMetadata = asRecord(data?.sourceMetadata);
    const reviewThresholdRaw = Number(data?.reviewThreshold ?? 0.85);
    const reviewThreshold = Number.isFinite(reviewThresholdRaw) ? reviewThresholdRaw : 0.85;

    const result = await resolveBrainOutput({
      userId: context.auth.uid,
      brainOutput: {
        schema_version: typeof payload.schema_version === "string" ? payload.schema_version : undefined,
        pet_reference: typeof payload.pet_reference === "string" ? payload.pet_reference : null,
        category,
        document_type: typeof payload.document_type === "string" ? payload.document_type : null,
        study_type: typeof payload.study_type === "string" ? payload.study_type : null,
        primary_finding: typeof payload.primary_finding === "string" ? payload.primary_finding : null,
        entities,
        confidence: Math.min(1, Math.max(0, confidence)),
        review_required: payload.review_required === true,
        reason_if_review_needed:
          typeof payload.reason_if_review_needed === "string" ? payload.reason_if_review_needed : null,
        semantic_flags: asRecord(payload.semantic_flags),
        ui_hint: asRecord(payload.ui_hint),
      },
      sourceMetadata: {
        source: typeof sourceMetadata.source === "string" ? sourceMetadata.source : "manual",
        ...sourceMetadata,
      },
      reviewThreshold: Math.min(1, Math.max(0, reviewThreshold)),
    });

    return {
      ok: true,
      ...result,
    };
  });

export {
  getGmailConnectUrl,
  gmailAuthCallback,
  disconnectGmailSync,
  syncAppointmentCalendarEvent,
  triggerEmailClinicalIngestion,
  runEmailClinicalIngestionQueue,
  runEmailClinicalScanWorker,
  runEmailClinicalAttachmentWorker,
  runEmailClinicalAiWorker,
  forceRunEmailClinicalIngestion,
  ingestClinicalEmailWebhook,
  pessyClinicalBrainGrounding,
  provisionPessyVertexDatastore,
  uploadPetPhoto,
  onMedicationWriteScheduleV3,
  onTreatmentWriteScheduleV3,
  dispatchTreatmentRemindersV3,
  markMissedTreatmentDosesV3,
  recordDoseEventV3,
  evaluateTreatmentDedupV3,
  syncTreatmentTimezoneV3,
};
