import { getMessaging, getToken, isSupported, onMessage, type MessagePayload, type Messaging } from "firebase/messaging";
import { doc, setDoc, collection, addDoc, getDocs, query, where, deleteDoc } from "firebase/firestore";
import { app, auth, db } from "../../lib/firebase";
import { parseDateSafe } from "../utils/dateUtils";

// VAPID key — generala en Firebase Console > Project Settings > Cloud Messaging > Web Push certificates
const DEFAULT_VAPID_KEY = "BG4wi3_yDKJa6XYueelKVk-Tz8qt2Adg34fzK5lhCduewZ-CyaPULVu8VqA2oP_jVz9FYpONPy68J_zV9KQ";
const RAW_VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY || DEFAULT_VAPID_KEY;
const VAPID_KEY = RAW_VAPID_KEY.replace(/\s+/g, "").trim();

export interface ScheduledNotification {
  id?: string;
  userId: string;
  petId: string;
  petName: string;
  type: "medication" | "appointment" | "vaccine_reminder" | "results";
  title: string;
  body: string;
  scheduledFor: string; // ISO 8601
  sourceEventId?: string;
  sourceMedicationId?: string;
  repeat?: "daily" | "weekly" | "monthly" | "yearly" | "none";
  repeatInterval?: number; // horas entre dosis
  repeatRootId?: string;
  endAt?: string | null;
  active: boolean;
  sent: boolean;
  createdAt: string;
}

class NotificationServiceClass {
  private messaging: Messaging | null = null;
  private initialized = false;

  async init(): Promise<boolean> {
    if (this.initialized) return true;
    if (!("Notification" in window)) {
      console.warn("Este browser no soporta notificaciones");
      return false;
    }

    try {
      const supported = await isSupported();
      if (!supported) {
        console.warn("FCM no está soportado en este navegador");
        return false;
      }

      this.messaging = getMessaging(app);
      this.initialized = true;
      return true;
    } catch (err) {
      console.error("Error inicializando FCM:", err);
      return false;
    }
  }

  async requestPermissionAndGetToken(): Promise<string | null> {
    const ready = await this.init();
    if (!ready) return null;

    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        console.warn("Permiso de notificaciones denegado");
        return null;
      }

      if (!VAPID_KEY) {
        console.warn("VAPID_KEY no configurada — notificaciones push en background deshabilitadas");
        return null;
      }
      if (RAW_VAPID_KEY !== VAPID_KEY) {
        console.warn("VAPID_KEY contenia espacios o saltos de linea y fue normalizada automaticamente");
      }

      // Evita conflicto con el SW de PWA registrando FCM en un scope dedicado.
      const swRegistration = await navigator.serviceWorker.register(
        "/firebase-messaging-sw.js",
        { scope: "/firebase-cloud-messaging-push-scope" }
      );

      const token = await getToken(this.messaging, {
        vapidKey: VAPID_KEY,
        serviceWorkerRegistration: swRegistration,
      });
      if (token) {
        await this.saveTokenToFirestore(token);
        return token;
      }
      return null;
    } catch (err) {
      console.error("Error obteniendo FCM token:", err);
      return null;
    }
  }

  private async saveTokenToFirestore(token: string) {
    const user = auth.currentUser;
    if (!user) return;
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    const nowIso = new Date().toISOString();

    await setDoc(doc(db, "users", user.uid, "fcm_tokens", "primary"), {
      token,
      platform: this.detectPlatform(),
      timezone,
      updatedAt: nowIso,
    }, { merge: true });

    // Persiste timezone en el doc usuario para que jobs backend no tengan que
    // leer el subdocumento de token solo para resolver huso horario.
    await setDoc(doc(db, "users", user.uid), {
      timezone,
      fcmTokenUpdatedAt: nowIso,
    }, { merge: true });
  }

  private detectPlatform(): string {
    const ua = navigator.userAgent;
    if (/iPad|iPhone|iPod/.test(ua)) return "ios";
    if (/Android/.test(ua)) return "android";
    return "web";
  }

  // Escucha notificaciones cuando la app ESTÁ abierta (foreground)
  onForegroundMessage(callback: (payload: MessagePayload) => void) {
    if (!this.messaging) return () => { };
    return onMessage(this.messaging, callback);
  }

  // ─── Crea notificaciones programadas en Firestore ─────────────────────────

  async scheduleMedicationReminders(params: {
    petId: string;
    petName: string;
    medicationName: string;
    dosage: string;
    frequency: string; // "Cada 12 horas", "Cada 24 horas", "Mensual", etc
    startDate: string;
    endDate: string | null;
    sourceEventId: string;
    sourceMedicationId?: string;
    lastDoseAt?: string | null; // si está, la próxima alarma se calcula desde esta toma real
  }) {
    const user = auth.currentUser;
    if (!user) return;

    const intervalHours = this.parseFrequencyToHours(params.frequency);
    if (!intervalHours) return;

    const hasExplicitStartTime = typeof params.startDate === "string" && /T\d{2}:\d{2}/.test(params.startDate);
    const hasExplicitEndTime = typeof params.endDate === "string" && /T\d{2}:\d{2}/.test(params.endDate);

    const start = parseDateSafe(params.startDate);
    const lastDose = params.lastDoseAt ? parseDateSafe(params.lastDoseAt) : null;
    const end = params.endDate ? parseDateSafe(params.endDate) : null;
    if (!start) return;
    const now = new Date();

    // Si la fecha vino sin hora explícita, fijamos 09:00 local para evitar
    // recordatorios ambiguos en "mediodía por defecto".
    let current = new Date(lastDose || start);
    if (!lastDose && !hasExplicitStartTime) {
      current.setHours(9, 0, 0, 0);
    }

    if (lastDose) {
      current = new Date(current.getTime() + intervalHours * 3600000);
    }

    // Avanzar hasta ahora si quedó atrasado.
    while (current <= now) {
      current = new Date(current.getTime() + intervalHours * 3600000);
    }

    if (end) {
      const effectiveEnd = new Date(end);
      if (!hasExplicitEndTime) {
        effectiveEnd.setHours(23, 59, 59, 999);
      }
      if (current > effectiveEnd) {
        return;
      }
    }

    // Limpia pendientes previos del mismo tratamiento para evitar duplicados.
    const cleanupQueries = [];
    if (params.sourceMedicationId) {
      cleanupQueries.push(query(
        collection(db, "scheduled_notifications"),
        where("userId", "==", user.uid),
        where("sourceMedicationId", "==", params.sourceMedicationId),
        where("sent", "==", false)
      ));
    }
    if (params.sourceEventId) {
      cleanupQueries.push(query(
        collection(db, "scheduled_notifications"),
        where("userId", "==", user.uid),
        where("sourceEventId", "==", params.sourceEventId),
        where("type", "==", "medication"),
        where("sent", "==", false)
      ));
    }

    const snapResults = await Promise.all(cleanupQueries.map((q) => getDocs(q)));
    const seenIds = new Set<string>();
    const deletePromises: Promise<void>[] = [];

    for (const snap of snapResults) {
      for (const docSnap of snap.docs) {
        if (!seenIds.has(docSnap.id)) {
          seenIds.add(docSnap.id);
          deletePromises.push(deleteDoc(docSnap.ref));
        }
      }
    }
    await Promise.all(deletePromises);

    const repeatRootId = `med_${params.sourceMedicationId || params.sourceEventId}`;
    const nowIso = new Date().toISOString();
    const primaryReminder: ScheduledNotification = {
      userId: user.uid,
      petId: params.petId,
      petName: params.petName,
      type: "medication",
      title: `Hoy toca medicacion — ${params.petName}`,
      body: `${params.medicationName} · ${params.dosage}`,
      scheduledFor: current.toISOString(),
      sourceEventId: params.sourceEventId,
      sourceMedicationId: params.sourceMedicationId,
      repeat: intervalHours <= 24 ? "daily" : "weekly",
      repeatInterval: intervalHours,
      repeatRootId,
      endAt: params.endDate || null,
      active: true,
      sent: false,
      createdAt: nowIso,
    };

    const reminders: ScheduledNotification[] = [primaryReminder];

    // Aviso 1 hora antes
    const oneHourBefore = new Date(current.getTime() - 60 * 60 * 1000);
    if (oneHourBefore.getTime() > Date.now()) {
      reminders.push({
        userId: user.uid,
        petId: params.petId,
        petName: params.petName,
        type: "medication",
        title: `En 1 hora medicación — ${params.petName}`,
        body: `${params.medicationName} · ${params.dosage}`,
        scheduledFor: oneHourBefore.toISOString(),
        sourceEventId: params.sourceEventId,
        sourceMedicationId: params.sourceMedicationId,
        repeat: intervalHours <= 24 ? "daily" : "weekly",
        repeatInterval: intervalHours,
        repeatRootId: `${repeatRootId}_pre60`,
        endAt: params.endDate || null,
        active: true,
        sent: false,
        createdAt: nowIso,
      });
    }

    // Aviso 5 min antes
    const fiveMinBefore = new Date(current.getTime() - 5 * 60 * 1000);
    if (fiveMinBefore.getTime() > Date.now()) {
      reminders.push({
        userId: user.uid,
        petId: params.petId,
        petName: params.petName,
        type: "medication",
        title: `¡En 5 min! Medicación — ${params.petName}`,
        body: `${params.medicationName} · ${params.dosage}`,
        scheduledFor: fiveMinBefore.toISOString(),
        sourceEventId: params.sourceEventId,
        sourceMedicationId: params.sourceMedicationId,
        repeat: intervalHours <= 24 ? "daily" : "weekly",
        repeatInterval: intervalHours,
        repeatRootId: `${repeatRootId}_pre5`,
        endAt: params.endDate || null,
        active: true,
        sent: false,
        createdAt: nowIso,
      });
    }

    await Promise.all(reminders.map((notification) =>
      addDoc(collection(db, "scheduled_notifications"), notification)
    ));

  }

  async scheduleAppointmentReminder(params: {
    petId: string;
    petName: string;
    title: string;
    date: string; // ISO
    clinic?: string;
    veterinarian?: string;
    appointmentId: string;
  }) {
    const user = auth.currentUser;
    if (!user) return;

    const appointmentDate = parseDateSafe(params.date);
    if (!appointmentDate) return;
    const oneDayBefore = new Date(appointmentDate.getTime() - 24 * 3600000);
    const twoHoursBefore = new Date(appointmentDate.getTime() - 2 * 3600000);
    const now = new Date();

    const reminders: ScheduledNotification[] = [];

    if (oneDayBefore > now) {
      reminders.push({
        userId: user.uid,
        petId: params.petId,
        petName: params.petName,
        type: "appointment",
        title: `Turno manana — ${params.petName}`,
        body: `${params.title}${params.clinic ? ` · ${params.clinic}` : ""}`,
        scheduledFor: oneDayBefore.toISOString(),
        sourceEventId: params.appointmentId,
        repeat: "none",
        active: true,
        sent: false,
        createdAt: new Date().toISOString(),
      });
    }

    if (twoHoursBefore > now) {
      reminders.push({
        userId: user.uid,
        petId: params.petId,
        petName: params.petName,
        type: "appointment",
        title: `Turno en 2 horas — ${params.petName}`,
        body: `${params.title}${params.veterinarian ? ` · ${params.veterinarian}` : ""}`,
        scheduledFor: twoHoursBefore.toISOString(),
        sourceEventId: params.appointmentId,
        repeat: "none",
        active: true,
        sent: false,
        createdAt: new Date().toISOString(),
      });
    }

    await Promise.all(reminders.map((n) =>
      addDoc(collection(db, "scheduled_notifications"), n)
    ));

  }

  async scheduleManualReminder(params: {
    reminderId: string;
    petId: string;
    petName: string;
    title: string;
    notes?: string | null;
    type: "vaccine" | "medication" | "checkup" | "grooming" | "deworming" | "other";
    dueDate: string;
    dueTime?: string | null;
    repeat: "none" | "daily" | "weekly" | "monthly" | "yearly";
  }) {
    const user = auth.currentUser;
    if (!user) return;

    const sourceEventId = this.buildManualSourceEventId(params.reminderId);
    await this.cancelPendingBySourceEvent(sourceEventId);

    const start = this.parseReminderDateTime(params.dueDate, params.dueTime || null);
    if (!start) return;

    const repeatInterval = this.parseRepeatToIntervalHours(params.repeat);
    const now = new Date();
    const scheduled = new Date(start);

    if (scheduled <= now && repeatInterval) {
      while (scheduled <= now) {
        scheduled.setTime(scheduled.getTime() + repeatInterval * 3600000);
      }
    }

    if (scheduled <= now && !repeatInterval) {
      return;
    }

    const mappedType: ScheduledNotification["type"] =
      params.type === "medication"
        ? "medication"
        : params.type === "vaccine" || params.type === "deworming"
          ? "vaccine_reminder"
          : "appointment";

    const body = params.notes?.trim()
      ? params.notes.trim()
      : `Recordatorio: ${params.title}`;

    const payload: ScheduledNotification = {
      userId: user.uid,
      petId: params.petId,
      petName: params.petName,
      type: mappedType,
      title: `${params.petName} — ${params.title}`,
      body,
      scheduledFor: scheduled.toISOString(),
      sourceEventId,
      repeat: params.repeat,
      repeatInterval: repeatInterval || undefined,
      repeatRootId: sourceEventId,
      active: true,
      sent: false,
      createdAt: new Date().toISOString(),
    };

    await addDoc(collection(db, "scheduled_notifications"), payload);
  }

  async cancelManualReminderNotifications(reminderId: string) {
    await this.cancelPendingBySourceEvent(this.buildManualSourceEventId(reminderId));
  }

  private async cancelPendingBySourceEvent(sourceEventId: string) {
    const user = auth.currentUser;
    if (!user) return;

    const snap = await getDocs(query(
      collection(db, "scheduled_notifications"),
      where("userId", "==", user.uid),
      where("sourceEventId", "==", sourceEventId),
    ));

    const deletions: Promise<void>[] = [];
    for (const docSnap of snap.docs) {
      const data = docSnap.data() as { sent?: boolean; active?: boolean };
      if (data.sent !== true && data.active !== false) {
        deletions.push(deleteDoc(docSnap.ref));
      }
    }
    await Promise.all(deletions);
  }

  private buildManualSourceEventId(reminderId: string): string {
    return `manual_reminder_${reminderId}`;
  }

  private parseReminderDateTime(dueDate: string, dueTime: string | null): Date | null {
    if (!dueDate) return null;
    const composed = dueTime && dueTime.trim()
      ? `${dueDate}T${dueTime.trim()}:00`
      : `${dueDate}T09:00:00`;
    return parseDateSafe(composed);
  }

  private parseRepeatToIntervalHours(repeat: string): number | null {
    if (repeat === "daily") return 24;
    if (repeat === "weekly") return 168;
    if (repeat === "monthly") return 720;
    if (repeat === "yearly") return 8760;
    return null;
  }

  // Parsea "Cada 12 horas" -> 12, "Mensual" -> 720, etc
  private parseFrequencyToHours(frequency: string): number | null {
    const f = (frequency || "")
      .toLowerCase()
      .replace(",", ".")
      .replace(/\s+/g, " ")
      .trim();

    // "cada 12 horas", "c/12h", "q8h", "12 hs"
    const eachHoursMatch =
      f.match(/(?:cada|c\/|q)\s*(\d+(?:\.\d+)?)\s*(?:h|hs|hora|horas)\b/) ||
      f.match(/\b(\d+(?:\.\d+)?)\s*(?:h|hs|hora|horas)\b/);
    if (eachHoursMatch) {
      const parsed = Number(eachHoursMatch[1]);
      if (Number.isFinite(parsed) && parsed > 0) return parsed;
    }

    // "2 veces al día" => cada 12h, "3 veces al día" => cada 8h
    const dailyMatch = f.match(/(\d+)\s*vez(?:es)?\s*al\s*d[ií]a/);
    if (dailyMatch) {
      const times = Number(dailyMatch[1]);
      if (Number.isFinite(times) && times > 0) {
        return Math.round(24 / times);
      }
    }

    if (/diario|diaria|cada\s+24\s*h/.test(f)) return 24;
    if (/cada\s+48\s*h|2\s*d[ií]as/.test(f)) return 48;
    if (/semanal|7\s*d[ií]as/.test(f)) return 168;
    if (/mensual|30\s*d[ií]as/.test(f)) return 720;
    return null;
  }
}

export const NotificationService = new NotificationServiceClass();
